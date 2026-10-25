// Timed buffs and debuffs from skills (OperatorKit.buffs), as Modifiers
// with an expiry. One implementation for every operator's buffs (design
// principle 15): a kit says which zone or attribute, which values (from the
// game data), for how long, whom it reaches and how it stacks; this module
// resolves the values for the applier and says which buffs act on a hit.

import { Attr, ELEMENTS, type AttrType, type Element, type SkillType } from "./attributes.ts";
import type { Build } from "./build.ts";
import { evalContext, type Situation } from "./damage.ts";
import { evaluate, type ValueExpr } from "./expr.ts";
import { attrFeedsZone, attrModifier, type HitDecoration, type HitKind, type Modifier } from "./effects.ts";
import type { BattleEvent, BuffCategory } from "./events.ts";
import type { Predicate } from "./expr.ts";
import { EngineError } from "./errors.ts";
import type { GameData, KitBuff } from "./model.ts";
import { ATK_ATTRIBUTES, percentOfLine, type StatLine, type StatPanel } from "./stats.ts";
import { FPS } from "./units.ts";

export interface ActiveBuff {
  readonly id: string;
  readonly stackGroup?: string;
  readonly owner: string;
  readonly target: KitBuff["target"];
  readonly appliedAt: number;
  /** Infinity for a buff that lasts until something ends it. */
  readonly expiresAt: number;
  readonly modifiers: readonly Modifier[];
  /**
   * Attributes that don't act on hits directly (e.g. Ultimate Gain Efficiency), read where the game reads them; `percent`: of the receiver's
   * panel line (KitBuffModifier.percent); `filters`: the modifier's hit filters, which only per-landing readers judge (Stagger efficiency).
   */
  readonly attrs?: readonly { readonly attr: AttrType; readonly value: number; readonly percent?: true; readonly filters?: AttrFilters }[];
  /** What it is, for the `operatorBuff` predicate (buffReach). */
  readonly categories?: readonly BuffCategory[];
  /** A team buff with a recipient filter: the team members it reaches. */
  readonly recipients?: readonly string[];
  /** Team members it no longer reaches: each used it up for itself (trigger action `endBuff` with `to: "eventSubject"`). */
  readonly excluded?: readonly string[];
  /** Layered: at most this many instances of the buff from one owner, each with its own expiry. */
  readonly maxLayers?: number;
  /** Instances with a priority (KitBuff.instances): at most this many from one owner (0: no limit), the strongest acting; at the limit the weakest goes. */
  readonly maxInstances?: number;
  /** The next cast of these kinds by someone it reaches consumes it (KitBuff.consumedBy). */
  readonly consumedBy?: readonly SkillType[];
  /** Consumed by a cast: acts only on that cast's hits (the index of the cast in the timeline). */
  readonly cast?: number;
  /** Consumed by a cast with KitBuff.consumedScope whileCasting: it also acts on every hit of `operator` before `until` (the cast's end). */
  readonly whileCasting?: { readonly operator: string; readonly until: number };
  /** While active, its owner gains no ultimate energy (KitBuff.blocksEnergy). */
  readonly blocksEnergy?: boolean;
  /** Periodic: frames between ticks (KitBuff.every), and the next tick's frame. */
  readonly every?: number;
  readonly nextTick?: number;
  /** Ends with its owner's cast of this index (KitBuff.endsWithCast). */
  readonly endsWithCast?: number;
  /** Frames its cast's jumps took from it (it ends that much sooner): counted as time it had left when it ends. */
  readonly skipped?: number;
  /** The BuffData buff it stands for (KitBuff.gameBuff). */
  readonly gameBuff?: string;
  /** Its layers share one timer each new layer refreshes (KitBuff.sharedTimer). */
  readonly sharedTimer?: boolean;
  /** Counts as a Link stack (KitBuff.link). */
  readonly link?: boolean;
  /** While active, its owner's basic-attack input is this skill (KitBuff.basicAttack). */
  readonly basicAttack?: string;
  /** A recording buff (KitBuff.records): its rate, and the damage it has recorded. */
  readonly records?: { readonly rate: number; readonly total: number };
  /** A ticking buff whose tick hits keep an ATK snapshot (KitHit.atkSnapshot): its owner's attacker-side modifiers when it was applied. */
  readonly snapshot?: readonly Modifier[];
}

/** Whether a buff is active at a frame: applied by then, not yet ended. */
export function activeAt(b: ActiveBuff, frame: number): boolean {
  return b.appliedAt <= frame && b.expiresAt > frame;
}

/** A buff's end, for triggers (BattleEvent buffEnded). */
export type BuffEndedEvent = Extract<BattleEvent, { readonly type: "buffEnded" }>;

/**
 * The buffEnded event of instances of one owner's buff that end together at a frame: the longest time one had left
 * (remainingOf), what they recorded (recordedOf), and `consumed` when an action ended them before they ran out.
 */
export function buffEndedEvent(instances: readonly ActiveBuff[], frame: number, consumed: boolean): BuffEndedEvent {
  const b = instances[0];
  if (!b) throw new EngineError("a buff's end needs an instance that ends");
  const recorded = recordedOf(instances);
  return {
    type: "buffEnded", frame, operator: b.owner, buff: b.id, remaining: remainingOf(instances, frame),
    ...(recorded !== undefined ? { recorded } : {}), ...(consumed ? { consumed: true } : {}), ...(b.gameBuff ? { gameBuff: b.gameBuff } : {}),
  };
}

/** One buffEnded event per owner and buff among instances that end together at a frame (buffEndedEvent), in order of first appearance. */
export function buffEndedEvents(instances: readonly ActiveBuff[], frame: number, consumed: boolean): BuffEndedEvent[] {
  const groups = new Map<string, ActiveBuff[]>();
  for (const b of instances) {
    const k = `${b.owner}:${b.id}`;
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  return [...groups.values()].map((g) => buffEndedEvent(g, frame, consumed));
}

/** A buff attribute's hit filters (its KitBuffModifier's), judged by readers of the attribute per landing. */
export interface AttrFilters {
  readonly skillType?: SkillType;
  readonly onlyKinds?: readonly HitKind[];
  readonly decorations?: readonly HitDecoration[];
  readonly elements?: readonly Element[];
  readonly when?: Predicate;
}

/**
 * What a kit buff is per category, with the elements each reaches: Amp and
 * Susceptibility from its modifiers of those zones (or attributes feeding
 * them), each modifier's elements (all of them without any); Weakness and
 * Protection from attributes 62 and 63 (every element). `KitBuff.categories`
 * replaces the list (a category its modifiers don't say reaches every
 * element: Shield, set by the loader from the game buff's tag).
 */
export function buffReach(def: Pick<KitBuff, "modifiers" | "categories">): Partial<Record<BuffCategory, Element[]>> {
  const inferred = new Map<BuffCategory, Set<Element>>();
  const add = (c: BuffCategory, els: readonly Element[]) => inferred.set(c, new Set([...(inferred.get(c) ?? []), ...els]));
  for (const m of def.modifiers) {
    const mapped = m.zone === undefined && m.attr !== undefined ? attrModifier(m.attr, 0, "") : null;
    const zone = m.zone ?? mapped?.zone;
    if (zone === "amp" || zone === "susceptibility") add(zone, m.elements ?? (mapped?.element ? [mapped.element] : ELEMENTS));
    if (m.attr === Attr.WeaknessDmgScalar) add("weakness", ELEMENTS);
    if (m.attr === Attr.ShelterDmgScalar) add("protection", ELEMENTS);
  }
  const out: Partial<Record<BuffCategory, Element[]>> = {};
  for (const c of def.categories ?? [...inferred.keys()]) out[c] = [...(inferred.get(c) ?? ELEMENTS)];
  return out;
}

/** A kit value for the applier, with `skillId` as the skill a plain key names. */
export function resolveValue(data: GameData, build: Build, panel: StatPanel, skillId: string, v: ValueExpr, situation: Situation = {}): number {
  return evaluate(v, evalContext(data, build, panel, skillId, situation));
}

/**
 * A kit buff applied at a frame by an operator's hit of `skillId`: values
 * and duration fixed at application. Null when its duration is 0 (a buff a
 * potential unlocks: below it, the game data has 0 s). `recipients` are the
 * team members a filtered team buff reaches.
 */
export function applyBuff(data: GameData, build: Build, panel: StatPanel, skillId: string, buff: KitBuff, frame: number, situation: Situation = {}, recipients?: readonly string[]): ActiveBuff | null {
  const seconds = buff.duration === undefined ? Infinity : resolveValue(data, build, panel, skillId, buff.duration, situation);
  if (seconds === 0) return null;
  if (!(seconds > 0)) throw new EngineError(`${build.operator} buff ${buff.id}: duration ${seconds} s`);
  const source = `${build.operator} ${buff.label}`;
  // Where its modifiers come from (Modifier.kitBuff, gameBuff).
  const origin = { kitBuff: { owner: build.operator, id: buff.id }, ...(buff.gameBuff ? { gameBuff: buff.gameBuff } : {}) };
  const modifiers: Modifier[] = [];
  const attrs: { attr: AttrType; value: number; percent?: true; filters?: AttrFilters }[] = [];
  for (const m of buff.modifiers) {
    const value = resolveValue(data, build, panel, skillId, m.value, situation);
    const filters = { ...(m.skillType ? { skillType: m.skillType } : {}), ...(m.onlyKinds ? { onlyKinds: m.onlyKinds } : {}), ...(m.decorations ? { decorations: m.decorations } : {}), ...(m.if ? { when: m.if } : {}) };
    if (m.percent) {
      if (m.attr === undefined || attrFeedsZone(m.attr)) throw new EngineError(`${build.operator} buff ${buff.id}: a percentage needs an attribute read where the game reads it (DEF, Strength, …), not a zone`);
      attrs.push({ attr: m.attr, value, percent: true, ...(Object.keys(filters).length ? { filters: { ...filters, ...(m.elements ? { elements: m.elements } : {}) } } : {}) });
      continue;
    }
    if (m.attr !== undefined) {
      const mapped = attrModifier(m.attr, value, source);
      if (mapped) modifiers.push({ ...mapped, ...filters, ...origin });
      else {
        const attrFilters: AttrFilters = { ...filters, ...(m.elements ? { elements: m.elements } : {}) };
        attrs.push({ attr: m.attr, value, ...(Object.keys(attrFilters).length ? { filters: attrFilters } : {}) });
      }
      continue;
    }
    if (!m.zone) throw new EngineError(`${build.operator} buff ${buff.id}: a modifier needs a zone or an attribute`);
    const base = { zone: m.zone, value, source, ...filters, ...origin };
    if (m.elements) for (const element of m.elements) modifiers.push({ ...base, element });
    else modifiers.push(base);
  }
  const every = buff.every === undefined ? undefined : Math.round(resolveValue(data, build, panel, skillId, buff.every, situation) * FPS);
  if (every !== undefined && !(every > 0)) throw new EngineError(`${build.operator} buff ${buff.id}: ticks every ${every} frames`);
  const maxLayers = buff.maxStacks === undefined ? undefined : Math.round(resolveValue(data, build, panel, skillId, buff.maxStacks, situation));
  const maxInstances = buff.instances === undefined ? undefined : Math.round(resolveValue(data, build, panel, skillId, buff.instances, situation));
  if (maxInstances !== undefined && (maxLayers !== undefined || !(maxInstances >= 0))) throw new EngineError(`${build.operator} buff ${buff.id}: ${maxLayers !== undefined ? "layers and instances with a priority don't go together" : `${maxInstances} instances`}`);
  return {
    id: buff.id,
    ...(buff.stackGroup ? { stackGroup: buff.stackGroup } : {}),
    ...(buff.gameBuff ? { gameBuff: buff.gameBuff } : {}),
    ...(buff.sharedTimer ? { sharedTimer: true } : {}),
    ...(buff.link ? { link: true } : {}),
    ...(((c) => (c.length ? { categories: c } : {}))(Object.keys(buffReach(buff)) as BuffCategory[])),
    ...(buff.basicAttack ? { basicAttack: buff.basicAttack } : {}),
    owner: build.operator,
    target: buff.target,
    appliedAt: frame,
    expiresAt: seconds === Infinity ? Infinity : frame + Math.round(seconds * FPS),
    modifiers,
    ...(attrs.length ? { attrs } : {}),
    ...(recipients ? { recipients } : {}),
    ...(maxLayers !== undefined ? { maxLayers } : {}),
    ...(maxInstances !== undefined ? { maxInstances } : {}),
    ...(buff.consumedBy ? { consumedBy: buff.consumedBy } : {}),
    ...(buff.blocksEnergy ? { blocksEnergy: true } : {}),
    ...(every !== undefined ? { every, nextTick: frame + (buff.tickOnApply ? 0 : every) } : {}),
    ...(buff.records ? { records: { rate: resolveValue(data, build, panel, skillId, buff.records.rate, situation), total: 0 } } : {}),
  };
}

/** An instance's strength, for which of a buff's instances with a priority goes at the limit (KitBuff.instances): its values summed. */
function instanceStrength(b: ActiveBuff): number {
  return b.modifiers.reduce((s, m) => s + m.value, 0) + (b.attrs ?? []).reduce((s, a) => s + a.value, 0);
}

/**
 * Adds a buff. A plain buff replaces the active instance of the same buff
 * from the same owner; a layered one adds a layer, replacing the oldest
 * when it's at its maximum; one with instances (KitBuff.instances) adds an
 * instance, and at its maximum the weakest goes (ties: the oldest; the new
 * one too, so a weaker one doesn't replace a stronger one).
 */
export function withBuff(buffs: readonly ActiveBuff[], b: ActiveBuff | null): ActiveBuff[] {
  if (!b) return [...buffs];
  // A buff given to some operators only keeps its layers per recipient set (Liino's weapon: 4 per teammate).
  const who = (x: ActiveBuff) => (x.recipients ? x.recipients.join(",") : "");
  const same = (x: ActiveBuff) => x.id === b.id && x.owner === b.owner && x.cast === undefined && who(x) === who(b);
  if (b.maxInstances !== undefined) {
    const all = [...buffs.filter(same), b];
    if (b.maxInstances === 0 || all.length <= b.maxInstances) return [...buffs, b];
    // Weakest first; among equals the oldest (the new one is last, so it stays over an equal one).
    const order = all.map((x, i) => ({ x, i })).sort((p, q) => instanceStrength(p.x) - instanceStrength(q.x) || p.i - q.i);
    const drop = new Set(order.slice(0, all.length - b.maxInstances).map((p) => p.x));
    return [...buffs, b].filter((x) => !drop.has(x));
  }
  if (b.maxLayers === undefined) return [...buffs.filter((x) => !same(x)), b];
  const layers = buffs.filter(same).sort((x, y) => x.appliedAt - y.appliedAt);
  const drop = new Set(layers.slice(0, Math.max(0, layers.length - b.maxLayers + 1)));
  // Layers on one shared timer: the new layer refreshes the others' end.
  return [...buffs.filter((x) => !drop.has(x)).map((x) => (b.sharedTimer && same(x) ? { ...x, expiresAt: b.expiresAt } : x)), b];
}

/** Ends a buff from an owner: all of it, or its oldest `layers`. Returns the buffs left and whether any ended. */
export function endBuff(buffs: readonly ActiveBuff[], id: string, owner: string, frame: number, layers?: number): { buffs: ActiveBuff[]; ended: boolean; gone: ActiveBuff[]; remaining: number; recorded?: number } {
  const active = buffs.filter((x) => x.id === id && x.owner === owner && x.cast === undefined && activeAt(x, frame)).sort((x, y) => x.appliedAt - y.appliedAt);
  const gone = [...new Set(layers === undefined ? active : active.slice(0, layers))];
  const recorded = recordedOf(gone);
  return { buffs: buffs.filter((x) => !gone.includes(x)), ended: gone.length > 0, gone, remaining: remainingOf(gone, frame), ...(recorded !== undefined ? { recorded } : {}) };
}

/**
 * Ends a team buff from an owner for one member only (trigger action
 * `endBuff` with `to: "eventSubject"`): each active instance stops reaching
 * it and keeps the others; an instance that then reaches none of the team
 * ends. `ended`: whether the buff ended altogether (no instance left).
 */
export function endBuffFor(buffs: readonly ActiveBuff[], id: string, owner: string, frame: number, member: string, team: readonly string[]): { buffs: ActiveBuff[]; ended: boolean; gone: ActiveBuff[]; remaining: number; recorded?: number } {
  const active = (x: ActiveBuff) => x.id === id && x.owner === owner && x.cast === undefined && activeAt(x, frame);
  const touched = buffs.filter((x) => active(x) && reaches(x, member));
  if (touched.length === 0) return { buffs: [...buffs], ended: false, gone: [], remaining: 0 };
  const narrowed = new Map(touched.map((x) => [x, { ...x, excluded: [...(x.excluded ?? []), member] }]));
  const gone = touched.filter((x) => team.every((m) => !reaches(narrowed.get(x) as ActiveBuff, m)));
  const out = buffs.flatMap((x) => (gone.includes(x) ? [] : [narrowed.get(x) ?? x]));
  const ended = gone.length > 0 && !out.some(active);
  const recorded = ended ? recordedOf(gone) : undefined;
  return { buffs: out, ended, gone: ended ? gone : [], remaining: ended ? remainingOf(gone, frame) : 0, ...(recorded !== undefined ? { recorded } : {}) };
}

/** The damage some recording buffs recorded, or undefined when none records. */
export function recordedOf(buffs: readonly ActiveBuff[]): number | undefined {
  return buffs.some((b) => b.records) ? buffs.reduce((t, b) => t + (b.records?.total ?? 0), 0) : undefined;
}

/** Frames the longest of some buffs had left at a frame (0 for buffs without an end). */
export function remainingOf(buffs: readonly ActiveBuff[], frame: number): number {
  let left = 0;
  for (const b of buffs) if (Number.isFinite(b.expiresAt)) left = Math.max(left, b.expiresAt - frame + (b.skipped ?? 0));
  return left;
}

/** Adds `frames` to the remaining time of an owner's active buff (every layer). Returns null when it isn't active. */
export function extendBuff(buffs: readonly ActiveBuff[], id: string, owner: string, frame: number, frames: number): ActiveBuff[] | null {
  let found = false;
  const out = buffs.map((x) => {
    if (x.id !== id || x.owner !== owner || x.cast !== undefined || !activeAt(x, frame)) return x;
    found = true;
    return { ...x, expiresAt: Math.max(frame + 1, x.expiresAt + frames) };
  });
  return found ? out : null;
}

/** Whether a buff reaches an operator: self buffs their owner, team buffs their recipients (everyone without a filter), enemy debuffs every hit on the enemy. */
export function reaches(b: ActiveBuff, operator: string): boolean {
  if (b.target === "self") return b.owner === operator;
  if (b.target === "team") return (!b.recipients || b.recipients.includes(operator)) && !b.excluded?.includes(operator);
  return true;
}

/**
 * A buff's attributes that raise ATK through its attribute bonus
 * (Strength, Agility, Intellect, Will: stats.ts ATK_ATTRIBUTES), as
 * modifiers of zone `attribute` with their filters; the damage pipeline
 * adds them to the hitter's panel attributes (a percentage of its line).
 */
function attributeModifiers(b: ActiveBuff): Modifier[] {
  return (b.attrs ?? []).filter((a) => ATK_ATTRIBUTES.has(a.attr)).flatMap((a) => {
    const f = a.filters;
    const m: Modifier = {
      zone: "attribute",
      attr: a.attr,
      value: a.value,
      ...(a.percent ? { percent: true } : {}),
      source: `${b.owner} ${b.id}`,
      kitBuff: { owner: b.owner, id: b.id },
      ...(b.gameBuff ? { gameBuff: b.gameBuff } : {}),
      ...(f?.skillType ? { skillType: f.skillType } : {}),
      ...(f?.onlyKinds ? { onlyKinds: f.onlyKinds } : {}),
      ...(f?.decorations ? { decorations: f.decorations } : {}),
      ...(f?.when ? { when: f.when } : {}),
    };
    return f?.elements ? f.elements.map((element) => ({ ...m, element })) : [m];
  });
}

/**
 * The modifiers active buffs give an operator's hits at a frame (its
 * attributes that raise ATK as zone `attribute`: attributeModifiers); a stack
 * group counts only its strongest modifier of each kind. Buffs consumed by
 * a cast act only on that cast's hits (`cast`).
 */
export function buffModifiers(buffs: readonly ActiveBuff[], operator: string, frame: number, cast?: number): Modifier[] {
  const out: Modifier[] = [];
  const strongest = new Map<string, Modifier>();
  for (const b of buffs) {
    if (!(activeAt(b, frame) && reaches(b, operator))) continue;
    // …and, attached to the cast (whileCasting), on its caster's other hits while the cast runs.
    if (b.cast !== undefined && b.cast !== cast && !(b.whileCasting && b.whileCasting.operator === operator && frame < b.whileCasting.until)) continue;
    // A buff a cast consumes acts only on that cast's hits: not before it's consumed.
    if (b.cast === undefined && b.consumedBy) continue;
    for (const m of [...b.modifiers, ...attributeModifiers(b)]) {
      if (!b.stackGroup) {
        out.push(m);
        continue;
      }
      // A modifier that holds only in a situation competes only with ones under the same condition.
      const k = JSON.stringify([b.stackGroup, m.zone, m.attr ?? null, m.element ?? null, m.skillType ?? null, m.onlyKinds ?? null, m.when ?? null]);
      const cur = strongest.get(k);
      if (!cur || m.value > cur.value) strongest.set(k, m);
    }
  }
  return [...out, ...strongest.values()];
}

/**
 * The sum of an attribute that active buffs give an operator (those that
 * don't act on hits directly), strongest per stack group. A percentage
 * (KitBuffModifier.percent) is of the operator's panel `line` for the
 * attribute: value × (base + Σ add) × Π multiply, the panel's percent slot.
 * For one landing (`landing`: its filter test and its cast), an entry with
 * filters counts only when they hold for it, and a buff its cast consumed
 * counts too; without it filters aren't judged (readers of a state).
 */
export function buffAttr(
  buffs: readonly ActiveBuff[], operator: string, frame: number, attr: AttrType, line?: Pick<StatLine, "base" | "add" | "multiply">,
  landing?: { readonly accepts: (f: AttrFilters) => boolean; readonly cast?: number },
): number {
  let sum = 0;
  const strongest = new Map<string, number>();
  const amount = (a: NonNullable<ActiveBuff["attrs"]>[number]) => {
    if (!a.percent) return a.value;
    if (!line) throw new EngineError(`a percentage buff on attribute ${attr} needs ${operator}'s panel line for it`);
    return percentOfLine(a.value, line);
  };
  for (const b of buffs) {
    const ofCast = landing !== undefined && b.cast !== undefined && b.cast === landing.cast;
    if (!(activeAt(b, frame) && reaches(b, operator) && ((b.cast === undefined && !b.consumedBy) || ofCast))) continue;
    for (const a of b.attrs ?? []) {
      if (a.attr !== attr) continue;
      if (landing && a.filters && !landing.accepts(a.filters)) continue;
      if (b.stackGroup) strongest.set(b.stackGroup, Math.max(strongest.get(b.stackGroup) ?? -Infinity, amount(a)));
      else sum += amount(a);
    }
  }
  for (const v of strongest.values()) sum += v;
  return sum;
}
