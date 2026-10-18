// Timed buffs and debuffs from skills (OperatorKit.buffs), as Modifiers
// with an expiry. One implementation for every operator's buffs (design
// principle 15): a kit says which zone or attribute, which values (from the
// game data), for how long, whom it reaches and how it stacks; this module
// resolves the values for the applier and says which buffs act on a hit.

import type { AttrType, SkillType } from "./attributes.ts";
import type { Build } from "./build.ts";
import { evalContext, type Situation } from "./damage.ts";
import { evaluate, type ValueExpr } from "./expr.ts";
import { attrModifier, type Modifier } from "./effects.ts";
import { EngineError } from "./errors.ts";
import type { GameData, KitBuff } from "./model.ts";
import type { StatPanel } from "./stats.ts";
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
  /** Attributes that don't act on hits directly (e.g. Ultimate Gain Efficiency), read where the game reads them. */
  readonly attrs?: readonly { readonly attr: AttrType; readonly value: number }[];
  /** A team buff with a recipient filter: the team members it reaches. */
  readonly recipients?: readonly string[];
  /** Layered: at most this many instances of the buff from one owner, each with its own expiry. */
  readonly maxLayers?: number;
  /** The next cast of these kinds by someone it reaches consumes it (KitBuff.consumedBy). */
  readonly consumedBy?: readonly SkillType[];
  /** Consumed by a cast: acts only on that cast's hits (the index of the cast in the timeline). */
  readonly cast?: number;
  /** While active, its owner gains no ultimate energy (KitBuff.blocksEnergy). */
  readonly blocksEnergy?: boolean;
  /** Periodic: frames between ticks (KitBuff.every), and the next tick's frame. */
  readonly every?: number;
  readonly nextTick?: number;
  /** Ends with its owner's cast of this index (KitBuff.endsWithCast). */
  readonly endsWithCast?: number;
  /** A recording buff (KitBuff.records): its rate, and the damage it has recorded. */
  readonly records?: { readonly rate: number; readonly total: number };
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
  const modifiers: Modifier[] = [];
  const attrs: { attr: AttrType; value: number }[] = [];
  for (const m of buff.modifiers) {
    const value = resolveValue(data, build, panel, skillId, m.value, situation);
    const filters = { ...(m.skillType ? { skillType: m.skillType } : {}), ...(m.onlyKinds ? { onlyKinds: m.onlyKinds } : {}) };
    if (m.attr !== undefined) {
      const mapped = attrModifier(m.attr, value, source);
      if (mapped) modifiers.push({ ...mapped, ...filters });
      else attrs.push({ attr: m.attr, value });
      continue;
    }
    if (!m.zone) throw new EngineError(`${build.operator} buff ${buff.id}: a modifier needs a zone or an attribute`);
    const base = { zone: m.zone, value, source, ...filters };
    if (m.elements) for (const element of m.elements) modifiers.push({ ...base, element });
    else modifiers.push(base);
  }
  const every = buff.every === undefined ? undefined : Math.round(resolveValue(data, build, panel, skillId, buff.every, situation) * FPS);
  if (every !== undefined && !(every > 0)) throw new EngineError(`${build.operator} buff ${buff.id}: ticks every ${every} frames`);
  const maxLayers = buff.maxStacks === undefined ? undefined : Math.round(resolveValue(data, build, panel, skillId, buff.maxStacks, situation));
  return {
    id: buff.id,
    ...(buff.stackGroup ? { stackGroup: buff.stackGroup } : {}),
    owner: build.operator,
    target: buff.target,
    appliedAt: frame,
    expiresAt: seconds === Infinity ? Infinity : frame + Math.round(seconds * FPS),
    modifiers,
    ...(attrs.length ? { attrs } : {}),
    ...(recipients ? { recipients } : {}),
    ...(maxLayers !== undefined ? { maxLayers } : {}),
    ...(buff.consumedBy ? { consumedBy: buff.consumedBy } : {}),
    ...(buff.blocksEnergy ? { blocksEnergy: true } : {}),
    ...(every !== undefined ? { every, nextTick: frame + (buff.tickOnApply ? 0 : every) } : {}),
    ...(buff.records ? { records: { rate: resolveValue(data, build, panel, skillId, buff.records.rate, situation), total: 0 } } : {}),
  };
}

/**
 * Adds a buff. A plain buff replaces the active instance of the same buff
 * from the same owner; a layered one adds a layer, replacing the oldest
 * when it's at its maximum.
 */
export function withBuff(buffs: readonly ActiveBuff[], b: ActiveBuff | null): ActiveBuff[] {
  if (!b) return [...buffs];
  // A buff given to some operators only keeps its layers per recipient set (Liino's weapon: 4 per teammate).
  const who = (x: ActiveBuff) => (x.recipients ? x.recipients.join(",") : "");
  const same = (x: ActiveBuff) => x.id === b.id && x.owner === b.owner && x.cast === undefined && who(x) === who(b);
  if (b.maxLayers === undefined) return [...buffs.filter((x) => !same(x)), b];
  const layers = buffs.filter(same).sort((x, y) => x.appliedAt - y.appliedAt);
  const drop = new Set(layers.slice(0, Math.max(0, layers.length - b.maxLayers + 1)));
  return [...buffs.filter((x) => !drop.has(x)), b];
}

/** Ends a buff from an owner: all of it, or its oldest `layers`. Returns the buffs left and whether any ended. */
export function endBuff(buffs: readonly ActiveBuff[], id: string, owner: string, frame: number, layers?: number): { buffs: ActiveBuff[]; ended: boolean; remaining: number; recorded?: number } {
  const active = buffs.filter((x) => x.id === id && x.owner === owner && x.cast === undefined && x.appliedAt <= frame && x.expiresAt > frame).sort((x, y) => x.appliedAt - y.appliedAt);
  const gone = [...new Set(layers === undefined ? active : active.slice(0, layers))];
  const recorded = recordedOf(gone);
  return { buffs: buffs.filter((x) => !gone.includes(x)), ended: gone.length > 0, remaining: remainingOf(gone, frame), ...(recorded !== undefined ? { recorded } : {}) };
}

/** The damage some recording buffs recorded, or undefined when none records. */
export function recordedOf(buffs: readonly ActiveBuff[]): number | undefined {
  return buffs.some((b) => b.records) ? buffs.reduce((t, b) => t + (b.records?.total ?? 0), 0) : undefined;
}

/** Frames the longest of some buffs had left at a frame (0 for buffs without an end). */
export function remainingOf(buffs: readonly ActiveBuff[], frame: number): number {
  let left = 0;
  for (const b of buffs) if (Number.isFinite(b.expiresAt)) left = Math.max(left, b.expiresAt - frame);
  return left;
}

/** Adds `frames` to the remaining time of an owner's active buff (every layer). Returns null when it isn't active. */
export function extendBuff(buffs: readonly ActiveBuff[], id: string, owner: string, frame: number, frames: number): ActiveBuff[] | null {
  let found = false;
  const out = buffs.map((x) => {
    if (x.id !== id || x.owner !== owner || x.cast !== undefined || !(x.appliedAt <= frame && x.expiresAt > frame)) return x;
    found = true;
    return { ...x, expiresAt: Math.max(frame + 1, x.expiresAt + frames) };
  });
  return found ? out : null;
}

/** Whether a buff reaches an operator: self buffs their owner, team buffs their recipients (everyone without a filter), enemy debuffs every hit on the enemy. */
export function reaches(b: ActiveBuff, operator: string): boolean {
  if (b.target === "self") return b.owner === operator;
  if (b.target === "team") return !b.recipients || b.recipients.includes(operator);
  return true;
}

/**
 * The modifiers active buffs give an operator's hits at a frame; a stack
 * group counts only its strongest modifier of each kind. Buffs consumed by
 * a cast act only on that cast's hits (`cast`).
 */
export function buffModifiers(buffs: readonly ActiveBuff[], operator: string, frame: number, cast?: number): Modifier[] {
  const out: Modifier[] = [];
  const strongest = new Map<string, Modifier>();
  for (const b of buffs) {
    if (!(b.expiresAt > frame && b.appliedAt <= frame && reaches(b, operator))) continue;
    if (b.cast !== undefined && b.cast !== cast) continue;
    for (const m of b.modifiers) {
      if (!b.stackGroup) {
        out.push(m);
        continue;
      }
      const k = JSON.stringify([b.stackGroup, m.zone, m.element ?? null, m.skillType ?? null, m.onlyKinds ?? null]);
      const cur = strongest.get(k);
      if (!cur || m.value > cur.value) strongest.set(k, m);
    }
  }
  return [...out, ...strongest.values()];
}

/** The sum of an attribute that active buffs give an operator (those that don't act on hits directly), strongest per stack group. */
export function buffAttr(buffs: readonly ActiveBuff[], operator: string, frame: number, attr: AttrType): number {
  let sum = 0;
  const strongest = new Map<string, number>();
  for (const b of buffs) {
    if (!(b.expiresAt > frame && b.appliedAt <= frame && reaches(b, operator) && b.cast === undefined)) continue;
    for (const a of b.attrs ?? []) {
      if (a.attr !== attr) continue;
      if (b.stackGroup) strongest.set(b.stackGroup, Math.max(strongest.get(b.stackGroup) ?? -Infinity, a.value));
      else sum += a.value;
    }
  }
  for (const v of strongest.values()) sum += v;
  return sum;
}
