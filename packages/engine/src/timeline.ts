// The timeline engine, v1: the stepping API of docs/design.md#stepping-api.
// State is plain data; every function returns a new state. Recorded
// rotations and (later) search are drivers on top of init / legalActions /
// apply / advance.
//
// v1 models animation locks and cancel windows (from SkillData), team SP,
// cooldowns, hits landing at their kit frames with the modifiers active at
// that frame, and the enemy's arts state (status.ts): inflictions, bursts,
// reactions and their statuses. What it doesn't model yet is listed in TIMELINE_ASSUMPTIONS
// and returned with every result.

import type { SkillType } from "./attributes.ts";
import type { Build } from "./build.ts";
import {
  activeModifiers,
  computeHit,
  decide,
  evalContext,
  hitAvailable,
  type Situation,
  computeReaction,
  conditionModifiers,
  roundDamage,
  skillValue,
  type CritMode,
  type DamageTarget,
  type HitDamage,
} from "./damage.ts";
import { zoneSum, type Modifier } from "./effects.ts";
import { EngineError } from "./errors.ts";
import type { GameData, KitHit, KitSkill, OperatorKit, StackGain } from "./model.ts";
import { effectiveKit } from "./triggers.ts";
import { causeMatches, eventMatches, triggerSkillId, type BattleEvent, type KitTrigger } from "./events.ts";
import { evaluate, test, type EvalContext } from "./expr.ts";
import { applyBuff, buffModifiers, resolveValue, withBuff, type ActiveBuff } from "./buffs.ts";
import { computeStats, skillLevel, skillParam, type StatPanel } from "./stats.ts";
import { Attr } from "./attributes.ts";
import { applyToEnemy, expireStatus, nextTick, NO_STATUS, statusModifiers, tickStatus, type EnemyStatus, type StatusEvent } from "./status.ts";
import { FPS } from "./units.ts";

/**
 * Team SP. Values from Endaxis's notes on the native skill settings (team SP
 * max 300, start 200, 8 per second, regen paused 1.5 s after spending);
 * Zero Sanity uses a continuous 7.69/s instead. Not yet checked against a
 * fixture.
 */
export const SP = { max: 300, start: 200, perSecond: 8, pauseAfterSpendFrames: 45 } as const;

/**
 * Ultimate energy and combo windows (Endaxis's native skill settings and
 * Zero Sanity agree; docs/data-sources.md): a battle skill gives every team
 * member 0.065 energy per natural (not returned) SP spent; combo windows stay
 * open 6 s after their trigger.
 */
export const ENERGY = { perNaturalSp: 0.065 } as const;
export const COMBO_WINDOW_FRAMES = 6 * FPS;

/** What v1 doesn't model; returned with every result so numbers aren't over-trusted. */
export const TIMELINE_ASSUMPTIONS = [
  "Ultimate energy: max = the ultimate's cost, no passive gain; battle skills give the team 0.065 per natural SP spent (at the cast); kits list their fixed grants. Grants are scaled by Ultimate Gain Efficiency.",
  "Combo skills open a 6 s window on their kit's trigger (ignored while on cooldown); kits without a trigger allow the combo whenever off cooldown.",
  "Each operator has its own animation lock; basic attacks need the operator to be the controlled one, other skills don't. A swap waits for the controlled operator to finish its action and costs no time.",
  "Projectile hits land at their launch frame (travel time isn't in the data).",
  "SP gain: a skill's blackboard value `atb` (e.g. a final strike's 20) is added when its first hit lands (unverified timing).",
  "Buffs and debuffs from skills apply only where a kit declares them (OperatorKit.buffs); always-on conditions, given modifiers and the enemy's reaction statuses apply too.",
  "Inflictions and reactions follow the Talos Wiki rules (status.ts). What a hit applies takes effect before its own damage and the reaction's initial hit (logs: Gilberta's explosion and Arcane's battle skill include the Corrosion they trigger).",
  "Physical statuses (Vulnerable, Lift, Knockdown, Crush, Breach) and Shatter aren't modelled; Solidification only records its duration.",
  "One enemy; every hit lands on it.",
  `Team SP: max ${SP.max}, start ${SP.start}, ${SP.perSecond}/s, paused ${SP.pauseAfterSpendFrames / FPS} s after spending (unverified).`,
] as const;

export interface RotationAction {
  readonly operator: string;
  /** A kit skill ID, e.g. chr_0016_laevat_attack1, or "swap" to make the operator the controlled one. */
  readonly skill: string;
  /** Earliest frame to start (the action may start later if not legal yet). */
  readonly at?: number;
}

export interface TimelineOptions {
  readonly crit: CritMode;
  /** Conditions treated as always on (kit or weapon condition IDs, per operator). */
  readonly conditions?: Readonly<Record<string, readonly string[]>>;
  /** Extra modifiers on every hit (e.g. a fixed external buff). */
  readonly modifiers?: readonly Modifier[];
}

export interface TimelineScenario {
  readonly team: readonly Build[];
  readonly target: DamageTarget;
  readonly durationFrames: number;
  readonly rotation: readonly RotationAction[];
  readonly options: TimelineOptions;
  /** Controlled operator at the start; default the first in the team. */
  readonly controlled?: string;
  /** Ultimate energy at the start, per operator ("full" = the ultimate's cost); default 0. */
  readonly startEnergy?: Readonly<Record<string, number | "full">>;
}

interface PendingHit {
  readonly frame: number;
  readonly operator: string;
  readonly skillId: string;
  readonly hitId: string;
  /** SP this hit returns when it lands (the skill's `atb`, on its first hit). */
  readonly sp: number;
  /** Who was controlled when the hit's skill was cast (predicates on the hit judge `controlled` by it). */
  readonly controlledAtCast?: string;
  /** A triggered hit: the owner's trigger and the index of its `hits` action (`skillId` is then the trigger's value source). */
  readonly trigger?: { readonly id: string; readonly action: number };
}

export interface Cast {
  readonly frame: number;
  readonly operator: string;
  readonly skill: string;
  readonly spAfter: number;
  /** The caster's ultimate energy after the cast. */
  readonly energyAfter: number;
}

export interface LandedHit extends HitDamage {
  readonly frame: number;
  readonly operator: string;
}

/** A status event with the frame it happened at; the record of what the enemy's arts state did. */
export type ReactionRecord = StatusEvent;

/** The whole simulation state: plain data, cheap to copy for branching. */
export interface TimelineState {
  readonly frame: number;
  readonly sp: number;
  /** The part of `sp` that was returned by skills; it's spent first and gives no ultimate energy. */
  readonly spReturned: number;
  /** Per operator: ultimate energy. */
  readonly energy: Readonly<Record<string, number>>;
  /** Per operator: frame until which it gains no energy (some ultimates block it). */
  readonly energyBlockedUntil: Readonly<Record<string, number>>;
  /** Per operator with a combo trigger: the open combo window, if any. */
  readonly comboWindow: Readonly<Record<string, { readonly from: number; readonly until: number }>>;
  /** Frame until which SP doesn't regenerate. */
  readonly spPausedUntil: number;
  readonly controlled: string;
  /** Per operator: frame from which it can act again. */
  readonly freeAt: Readonly<Record<string, number>>;
  /** Per skill ID: frame from which it's off cooldown. */
  readonly readyAt: Readonly<Record<string, number>>;
  readonly pending: readonly PendingHit[];
  readonly enemy: EnemyStatus;
  /** Timed buffs and debuffs from skills. */
  readonly buffs: readonly ActiveBuff[];
  /** Per kit trigger (`operator:triggerId`): when it can fire again and how often it has. */
  readonly triggerState: Readonly<Record<string, { readonly readyAt: number; readonly count: number }>>;
  /** Per operator: its kit's stacks (e.g. Melting Flame). */
  readonly stacks: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly casts: readonly Cast[];
  readonly hits: readonly LandedHit[];
  /** Bursts, reactions, consumptions and Combustion ticks, in order. */
  readonly reactions: readonly ReactionRecord[];
}

/** Precomputed per scenario: the build stage of docs/design.md#simulation-model. */
export interface TimelineContext {
  readonly data: GameData;
  readonly scenario: TimelineScenario;
  readonly builds: ReadonlyMap<string, Build>;
  readonly panels: ReadonlyMap<string, StatPanel>;
  /** Per operator: always-on condition modifiers plus the scenario's extra modifiers (not the panel's own; the damage pipeline adds those). */
  readonly modifiers: ReadonlyMap<string, readonly Modifier[]>;
  /** Per operator: its kit with what it wears (triggers.ts effectiveKit). */
  readonly kits: ReadonlyMap<string, OperatorKit>;
}

export function createContext(data: GameData, scenario: TimelineScenario): TimelineContext {
  if (scenario.team.length === 0 || scenario.team.length > 4) throw new EngineError("a team has 1–4 operators");
  const builds = new Map(scenario.team.map((b) => [b.operator, b]));
  if (builds.size !== scenario.team.length) throw new EngineError("an operator appears twice in the team");
  const panels = new Map(scenario.team.map((b) => [b.operator, computeStats(data, b)]));
  const modifiers = new Map(
    scenario.team.map((b) => [b.operator, [...conditionModifiers(data, b, scenario.options.conditions?.[b.operator] ?? []), ...(scenario.options.modifiers ?? [])]]),
  );
  const kits = new Map(scenario.team.flatMap((b) => {
    const kit = effectiveKit(data, b);
    return kit ? [[b.operator, kit] as const] : [];
  }));
  return { data, scenario, builds, panels, modifiers, kits };
}

export function init(ctx: TimelineContext): TimelineState {
  const controlled = ctx.scenario.controlled ?? (ctx.scenario.team[0] as Build).operator;
  if (!ctx.builds.has(controlled)) throw new EngineError(`controlled operator ${controlled} isn't in the team`);
  return {
    frame: 0,
    sp: SP.start,
    spReturned: 0,
    energy: Object.fromEntries(ctx.scenario.team.map((b) => {
      const v = ctx.scenario.startEnergy?.[b.operator] ?? 0;
      return [b.operator, v === "full" ? maxEnergy(ctx, b.operator) : Math.min(v, maxEnergy(ctx, b.operator))];
    })),
    energyBlockedUntil: {},
    comboWindow: {},
    spPausedUntil: 0,
    controlled,
    freeAt: Object.fromEntries(ctx.scenario.team.map((b) => [b.operator, 0])),
    readyAt: {},
    pending: [],
    enemy: NO_STATUS,
    buffs: [],
    triggerState: {},
    stacks: Object.fromEntries(ctx.scenario.team.map((b) => [b.operator, Object.fromEntries((ctx.kits.get(b.operator)?.stacks ?? []).map((x) => [x.id, 0]))])),
    casts: [],
    hits: [],
    reactions: [],
  };
}

/** SP at a later frame, with regeneration (whole frames, no fractions lost). */
function spAt(state: TimelineState, frame: number): number {
  const from = Math.max(state.frame, state.spPausedUntil);
  const regen = frame > from ? ((frame - from) * SP.perSecond) / FPS : 0;
  return Math.min(SP.max, state.sp + regen);
}

function kitSkill(ctx: TimelineContext, operator: string, skillId: string): KitSkill {
  const kit = ctx.kits.get(operator);
  if (!kit) throw new EngineError(`no kit for ${operator}`);
  const s = kit.skills.find((x) => x.skillId === skillId);
  if (!s) throw new EngineError(`${operator}'s kit has no skill ${skillId}`);
  return s;
}

function skillGroup(ctx: TimelineContext, operator: string, skillId: string): SkillType {
  const g = ctx.data.operators[operator]?.skillGroups[skillId];
  if (!g) throw new EngineError(`${skillId} isn't one of ${operator}'s skills`);
  return g;
}

/** SP cost, cooldown frames and lock frames of a skill at the operator's level. */
function skillCosts(ctx: TimelineContext, operator: string, skillId: string) {
  const build = ctx.builds.get(operator) as Build;
  const skill = ctx.data.skills[skillId];
  if (!skill) throw new EngineError(`unknown skill ${skillId}`);
  const group = skillGroup(ctx, operator, skillId);
  const level = skillLevel(skill, build.skillLevels[group]);
  const timing = skill.timing;
  if (!timing) throw new EngineError(`${skillId}: SkillData isn't loaded, so its timing is unknown`);
  const panel = ctx.panels.get(operator) as StatPanel;
  const cost = skillParam(panel, skillId, "cost", level.costValue);
  return {
    group,
    /** The action's kind (KitSkill.kind), which basic-attack control and combo windows go by. */
    kind: kitSkill(ctx, operator, skillId).kind,
    spCost: level.costType === 1 ? cost : 0,
    /** costType 0: ultimate energy. */
    energyCost: level.costType === 0 ? cost : 0,
    cooldownFrames: Math.round(skillParam(panel, skillId, "cooldown", level.coolDown) * FPS),
    lockFrames: timing.cancelFrame ?? timing.exclusiveFrames,
  };
}

/** Most ultimate energy an operator can hold: its kit's ultimate cost (the highest, if it has several). */
function maxEnergy(ctx: TimelineContext, operator: string): number {
  const kit = ctx.kits.get(operator);
  const costs = (kit?.skills ?? []).filter((s) => ctx.data.operators[operator]?.skillGroups[s.skillId] === "ultimate").map((s) => skillCosts(ctx, operator, s.skillId).energyCost);
  return costs.length ? Math.max(...costs) : 0;
}

/** Ultimate energy gained, scaled by the recipient's Ultimate Gain Efficiency (attribute 44), unless blocked. */
function gainEnergy(ctx: TimelineContext, st: TimelineState, operator: string, amount: number, frame: number): TimelineState {
  if (amount <= 0 || (st.energyBlockedUntil[operator] ?? -1) > frame) return st;
  const panel = ctx.panels.get(operator) as StatPanel;
  const efficiency = panel.attrs[Attr.UltimateSpGainScalar]?.total ?? ctx.data.attributeDefaults[Attr.UltimateSpGainScalar] ?? 1;
  const now = st.energy[operator] ?? 0;
  return { ...st, energy: { ...st.energy, [operator]: Math.min(maxEnergy(ctx, operator), now + amount * efficiency) } };
}

/** SP a skill returns (its blackboard `atb` at the operator's level, after potentials). */
function skillSpGain(ctx: TimelineContext, operator: string, skillId: string): number {
  const build = ctx.builds.get(operator) as Build;
  const panel = ctx.panels.get(operator) as StatPanel;
  const skill = ctx.data.skills[skillId];
  const level = skill ? skillLevel(skill, build.skillLevels[skillGroup(ctx, operator, skillId)]) : undefined;
  if (level?.blackboard["atb"] === undefined && skill?.defaults["atb"] === undefined) return 0;
  return skillValue(ctx.data, panel, build, skillId, "atb");
}

function damageOptions(ctx: TimelineContext, operator: string, enemy: EnemyStatus, buffs: readonly ActiveBuff[], frame: number) {
  return {
    crit: ctx.scenario.options.crit,
    staggered: false,
    conditions: [],
    modifiers: [...(ctx.modifiers.get(operator) ?? []), ...statusModifiers(enemy, frame), ...buffModifiers(buffs, operator, frame)],
  };
}

/** Everything the timeline knows about a moment, for an operator's kit predicates and values. */
/** What kit predicates and values see for an operator at a frame. */
function situationAt(ctx: TimelineContext, operator: string, st: TimelineState, frame: number, consumed?: number): Situation {
  const active = (b: ActiveBuff) => b.appliedAt <= frame && b.expiresAt > frame;
  return {
    team: ctx.scenario.team,
    enemy: expireStatus(st.enemy, frame),
    stacks: st.stacks[operator] ?? {},
    buffActive: (id) => st.buffs.some((b) => b.id === id && b.owner === operator && active(b)),
    controlled: st.controlled,
    enemyModifiers: st.buffs.filter((b) => b.target === "enemy" && active(b)).flatMap((b) => b.modifiers),
    ...(consumed !== undefined ? { consumed } : {}),
  };
}

/** An operator's Arts Intensity: it sets the strength of the statuses it applies. */
function artsIntensity(ctx: TimelineContext, operator: string): number {
  const build = ctx.builds.get(operator) as Build;
  const mods = activeModifiers(ctx.data, build, ctx.panels.get(operator) as StatPanel, { crit: "never", staggered: false, conditions: [], modifiers: ctx.modifiers.get(operator) ?? [] });
  return zoneSum(mods, "artsIntensity", { element: "physical", skillType: null, staggered: false });
}

/** The damage a status event deals, if any (bursts, reactions with an initial hit, Combustion ticks). */
function eventDamage(ctx: TimelineContext, e: StatusEvent, enemy: EnemyStatus, buffs: readonly ActiveBuff[]): LandedHit | null {
  if (e.kind === "consumed" || e.kind === "inflicted" || (e.kind === "reaction" && !e.initialHit)) return null;
  const reaction =
    e.kind === "burst" ? { kind: "burst" as const, element: e.element, stacks: 1 }
    : e.kind === "reaction" ? { kind: "reaction" as const, element: e.element, stacks: e.level }
    : { kind: "combustionTick" as const, element: "fire" as const, stacks: e.level };
  const build = ctx.builds.get(e.operator) as Build;
  const result = computeReaction(ctx.data, build, ctx.panels.get(e.operator) as StatPanel, ctx.scenario.target, reaction, damageOptions(ctx, e.operator, enemy, buffs, e.frame));
  const scale = e.kind === "combustionTick" ? e.damageScale : undefined;
  if (!scale) return { ...result, frame: e.frame, operator: e.operator };
  const exact = result.exact * scale.value;
  return { ...result, scaleParts: [...result.scaleParts, scale], zones: { ...result.zones, scale: result.zones.scale * scale.value }, exact, damage: roundDamage(exact), frame: e.frame, operator: e.operator };
}

type Stacks = TimelineState["stacks"];

function gainStacks(ctx: TimelineContext, stacks: Stacks, owner: string, gains: readonly StackGain[], ec: EvalContext): Stacks {
  let out = stacks;
  for (const g of gains) {
    if (g.if && !decide(g.if, ec)) continue;
    const def = ctx.kits.get(owner)?.stacks.find((x) => x.id === g.stack);
    if (!def) throw new EngineError(`${owner} has no stack ${g.stack}`);
    const own = out[owner] ?? {};
    const amount = evaluate(g.amount, ec);
    out = { ...out, [owner]: { ...own, [g.stack]: Math.min(def.max, (own[g.stack] ?? 0) + amount) } };
  }
  return out;
}

/** Status events: recorded, and the damage they deal (bursts, reactions, ticks) lands. */
/** `enemy` is the state their damage sees: after a hit's own applications, before a tick's change. */
function recordStatus(ctx: TimelineContext, st: TimelineState, events: readonly StatusEvent[], enemy: EnemyStatus): TimelineState {
  const records: ReactionRecord[] = [];
  const landed: LandedHit[] = [];
  for (const e of events) {
    if (e.kind === "inflicted") continue;
    records.push(e);
    const d = eventDamage(ctx, e, enemy, st.buffs);
    if (d) landed.push(d);
  }
  return records.length ? { ...st, reactions: [...st.reactions, ...records], hits: [...st.hits, ...landed] } : st;
}

const asEvents = (events: readonly StatusEvent[]): BattleEvent[] => events.map((e) => ({ type: "status", frame: e.frame, operator: e.operator, event: e }));

/** What started a chain of events: an operator's own combo hits don't open its own combo window. */
interface Origin {
  readonly operator: string;
  readonly kind: SkillType | "none";
}

/** At most this many events in one chain of triggers (a loop in kit data is an error, not a hang). */
const MAX_CHAIN = 500;

/** What a trigger's predicates and values see: its owner's situation, and the context of the operator who caused the event. */
function triggerSituation(ctx: TimelineContext, owner: string, st: TimelineState, e: BattleEvent, consumed?: number): Situation {
  const cause = ctx.builds.get(e.operator);
  const eventOperator = cause ? evalContext(ctx.data, cause, ctx.panels.get(e.operator) as StatPanel, "", situationAt(ctx, e.operator, st, e.frame)) : undefined;
  return { ...situationAt(ctx, owner, st, e.frame, consumed), ...(eventOperator ? { eventOperator } : {}) };
}

/** Runs every team member's triggers on a chain of events, in order; what they do can add events to the chain. */
function runTriggers(ctx: TimelineContext, state: TimelineState, initial: readonly BattleEvent[], origin: Origin | null): TimelineState {
  let st = state;
  const queue = [...initial];
  for (let n = 0; queue.length > 0; n++) {
    if (n > MAX_CHAIN) throw new EngineError(`more than ${MAX_CHAIN} chained events at frame ${queue[0]?.frame}: a trigger loop in the kits?`);
    const e = queue.shift() as BattleEvent;
    for (const b of ctx.scenario.team) {
      const owner = b.operator;
      for (const t of ctx.kits.get(owner)?.triggers ?? []) {
        if (!eventMatches(t.on, e, owner, st.stacks[owner] ?? {}) || !causeMatches(t.by, e, owner)) continue;
        const key = `${owner}:${t.id}`;
        const ts = st.triggerState[key];
        if (ts && ((ts.readyAt ?? 0) > e.frame || (t.maxCount !== undefined && ts.count >= t.maxCount))) continue;
        const panel = ctx.panels.get(owner) as StatPanel;
        const ec = evalContext(ctx.data, b, panel, triggerSkillId(owner, t), triggerSituation(ctx, owner, st, e));
        if (t.if && !decide(t.if, ec)) continue;
        const cooldown = t.cooldown === undefined ? 0 : Math.round(evaluate(t.cooldown, ec) * FPS);
        st = { ...st, triggerState: { ...st.triggerState, [key]: { readyAt: e.frame + cooldown, count: (ts?.count ?? 0) + 1 } } };
        const r = runActions(ctx, st, t, owner, e, origin);
        st = r.state;
        queue.push(...r.events);
      }
    }
  }
  return st;
}

/** Does what a trigger says, as its owner, at the event's frame. Returns the events it caused. */
function runActions(ctx: TimelineContext, state: TimelineState, t: KitTrigger, owner: string, e: BattleEvent, origin: Origin | null): { state: TimelineState; events: BattleEvent[] } {
  let st = state;
  const events: BattleEvent[] = [];
  const frame = e.frame;
  const build = ctx.builds.get(owner) as Build;
  const panel = ctx.panels.get(owner) as StatPanel;
  let consumed = 0;
  const ec = () => evalContext(ctx.data, build, panel, triggerSkillId(owner, t), triggerSituation(ctx, owner, st, e, consumed));
  for (const a of t.do) {
    if (a.if && !decide(a.if, ec())) continue;
    switch (a.kind) {
      case "openCombo": {
        if (origin && origin.operator === owner && origin.kind === "combo") break;
        const combos = (ctx.kits.get(owner)?.skills ?? []).filter((s) => s.kind === "combo");
        if (combos.length > 0 && combos.every((s) => (st.readyAt[s.skillId] ?? 0) > frame)) break;
        st = { ...st, comboWindow: { ...st.comboWindow, [owner]: { from: frame, until: frame + COMBO_WINDOW_FRAMES } } };
        break;
      }
      case "apply": {
        const ai = artsIntensity(ctx, owner);
        for (const app of a.applies) {
          if (app.if && !decide(app.if, ec())) continue;
          const r = applyToEnemy(expireStatus(st.enemy, frame), app, frame, owner, ai, (key) => skillValue(ctx.data, panel, build, triggerSkillId(owner, t), key));
          st = recordStatus(ctx, { ...st, enemy: r.state }, r.events, r.state);
          for (const x of r.events) if (x.kind === "consumed") consumed += x.stacks;
          events.push(...asEvents(r.events));
        }
        break;
      }
      case "gain":
        st = { ...st, stacks: gainStacks(ctx, st.stacks, owner, a.gains, ec()) };
        events.push({ type: "stacks", frame, operator: owner });
        break;
      case "energy":
        st = gainEnergy(ctx, st, owner, evaluate(a.value, ec()), frame);
        break;
      case "sp": {
        const before = spAt(st, frame);
        const after = Math.min(SP.max, before + evaluate(a.value, ec()));
        st = { ...st, sp: after, spReturned: Math.min(after, st.spReturned + (after - before)), frame: Math.max(st.frame, frame) };
        break;
      }
      case "buff": {
        const def = ctx.kits.get(owner)?.buffs.find((x) => x.id === a.buff);
        if (!def) throw new EngineError(`${owner} has no buff ${a.buff}`);
        st = { ...st, buffs: withBuff(st.buffs, applyBuff(ctx.data, build, panel, triggerSkillId(owner, t), def, frame, situationAt(ctx, owner, st, frame, consumed))) };
        events.push({ type: "buffApplied", frame, operator: owner, buff: a.buff });
        break;
      }
      case "endBuff":
        if (st.buffs.some((x) => x.id === a.buff && x.owner === owner && x.expiresAt > frame)) {
          st = { ...st, buffs: st.buffs.filter((x) => !(x.id === a.buff && x.owner === owner)) };
          events.push({ type: "buffEnded", frame, operator: owner, buff: a.buff });
        }
        break;
      case "cooldown": {
        const who = a.who === "self" ? owner : a.who === "eventOperator" ? e.operator : ctx.scenario.team[a.who.slot]?.operator;
        if (!who) break;
        const change = Math.round(evaluate(a.seconds, ec()) * FPS);
        const readyAt = { ...st.readyAt };
        for (const s of ctx.kits.get(who)?.skills ?? []) {
          if (s.kind === a.skills && (readyAt[s.skillId] ?? 0) > frame) readyAt[s.skillId] = Math.max(frame, (readyAt[s.skillId] ?? 0) + change);
        }
        st = { ...st, readyAt };
        break;
      }
      case "hits": {
        const index = t.do.indexOf(a);
        const pending: PendingHit[] = [];
        for (const h of a.hits) {
          for (const f of h.frames ?? Array.from({ length: h.count }, () => 0)) {
            pending.push({ frame: frame + f, operator: owner, skillId: triggerSkillId(owner, t), hitId: h.id, sp: 0, trigger: { id: t.id, action: index } });
          }
        }
        st = { ...st, pending: [...st.pending, ...pending] };
        break;
      }
    }
  }
  return { state: st, events };
}

/** Earliest frame at or before `frame` when an active buff ends, or null. */
function nextExpiry(buffs: readonly ActiveBuff[], frame: number): number | null {
  let next: number | null = null;
  for (const b of buffs) if (b.expiresAt <= frame && (next === null || b.expiresAt < next)) next = b.expiresAt;
  return next;
}

/** A pending hit's kit entry, the skill its values come from and its kind. */
function pendingHitDef(ctx: TimelineContext, hit: PendingHit): { skill: Pick<KitSkill, "skillId">; kind: SkillType | "none"; kitHit: KitHit } {
  if (!hit.trigger) {
    const skill = kitSkill(ctx, hit.operator, hit.skillId);
    return { skill, kind: skill.kind, kitHit: skill.hits.find((h) => h.id === hit.hitId) as KitHit };
  }
  const { id, action } = hit.trigger;
  const a = ctx.kits.get(hit.operator)?.triggers.find((t) => t.id === id)?.do[action];
  const kitHit = a?.kind === "hits" ? a.hits.find((h) => h.id === hit.hitId) : undefined;
  if (!kitHit) throw new EngineError(`${hit.operator} trigger ${id} has no hit ${hit.hitId}`);
  return { skill: { skillId: hit.skillId }, kind: kitHit.damageType, kitHit };
}

/** Lands one pending hit: its own effects, its damage, then the triggers its events start. */
function landHit(ctx: TimelineContext, state: TimelineState, hit: PendingHit): TimelineState {
  let st = state;
  if (hit.sp > 0) {
    const before = spAt(st, hit.frame);
    const after = Math.min(SP.max, before + hit.sp);
    st = { ...st, sp: after, spReturned: Math.min(after, st.spReturned + (after - before)), frame: Math.max(st.frame, hit.frame) };
  }
  const build = ctx.builds.get(hit.operator) as Build;
  const { skill, kind, kitHit } = pendingHitDef(ctx, hit);
  st = { ...st, enemy: expireStatus(st.enemy, hit.frame) };
  const panel = ctx.panels.get(hit.operator) as StatPanel;
  // Its situation as it lands, before its own effects: whether it happens (KitHit.if) and its extra scale.
  // Who counts as controlled is who was when its skill was cast.
  const controlled = hit.controlledAtCast ?? st.controlled;
  const at = (consumedSoFar?: number): Situation => ({ ...situationAt(ctx, hit.operator, st, hit.frame, consumedSoFar), controlled });
  const before = at();
  if (kitHit.if && !decide(kitHit.if, evalContext(ctx.data, build, panel, hit.skillId, before))) return st;
  // What the hit applies comes first: its own damage and a reaction's initial hit already see the new status.
  const statusEvents: StatusEvent[] = [];
  let consumed = 0;
  if (kitHit.applies?.length) {
    const ai = artsIntensity(ctx, hit.operator);
    for (const app of kitHit.applies) {
      if (app.if && !decide(app.if, evalContext(ctx.data, build, panel, hit.skillId, at(consumed)))) continue;
      const r = applyToEnemy(st.enemy, app, hit.frame, hit.operator, ai, (key) => skillValue(ctx.data, panel, build, hit.skillId, key));
      st = { ...st, enemy: r.state };
      statusEvents.push(...r.events);
      for (const x of r.events) if (x.kind === "consumed") consumed += x.stacks;
    }
  }
  const events: BattleEvent[] = [];
  if (kitHit.gains?.length) {
    st = { ...st, stacks: gainStacks(ctx, st.stacks, hit.operator, kitHit.gains, evalContext(ctx.data, build, panel, hit.skillId, at(consumed))) };
  }
  const kitBuff = (id: string) => ctx.kits.get(hit.operator)?.buffs.find((b) => b.id === id);
  const applyBuffs = (beforeDamage: boolean) => {
    for (const a of kitHit.buffs ?? []) {
      if ((a.beforeDamage ?? false) !== beforeDamage) continue;
      const def = kitBuff(a.buff);
      if (!def) throw new EngineError(`${hit.operator} has no buff ${a.buff}`);
      if (a.if && !decide(a.if, evalContext(ctx.data, build, panel, hit.skillId, at(consumed)))) continue;
      st = { ...st, buffs: withBuff(st.buffs, applyBuff(ctx.data, build, panel, hit.skillId, def, hit.frame, at(consumed))) };
      events.push({ type: "buffApplied", frame: hit.frame, operator: hit.operator, buff: a.buff });
    }
  };
  applyBuffs(true);
  const result = computeHit(ctx.data, build, panel, ctx.scenario.target, skill, kitHit, {
    ...damageOptions(ctx, hit.operator, st.enemy, st.buffs, hit.frame),
    situation: { ...before, consumed },
  });
  st = { ...st, hits: [...st.hits, { ...result, count: 1, frame: hit.frame, operator: hit.operator }] };
  applyBuffs(false);
  if (kitHit.energy) {
    const amount = resolveValue(ctx.data, build, panel, hit.skillId, kitHit.energy, at(consumed));
    st = gainEnergy(ctx, st, hit.operator, amount, hit.frame);
  }
  st = recordStatus(ctx, st, statusEvents, st.enemy);
  const hitEvent: BattleEvent = {
    type: "hit", frame: hit.frame, operator: hit.operator, skillId: hit.skillId, kind,
    element: kitHit.reaction?.element ?? kitHit.element, finalStrike: kitHit.finalStrike ?? false, controlled: st.controlled === hit.operator,
  };
  const all: BattleEvent[] = [hitEvent, ...asEvents(statusEvents), ...events, ...(kitHit.gains?.length ? [{ type: "stacks" as const, frame: hit.frame, operator: hit.operator }] : [])];
  return runTriggers(ctx, st, all, { operator: hit.operator, kind });
}

/** Processes every pending hit, status tick and buff expiry up to (and including) a frame, in frame order. */
export function advance(ctx: TimelineContext, state: TimelineState, frame: number): TimelineState {
  if (frame < state.frame) throw new EngineError(`can't go back from frame ${state.frame} to ${frame}`);
  let st = state;
  for (;;) {
    // The next pending hit (triggers can add hits while this runs).
    let hit: PendingHit | null = null;
    for (const h of st.pending) if (h.frame <= frame && (!hit || h.frame < hit.frame || (h.frame === hit.frame && h.operator < hit.operator))) hit = h;
    const tick = nextTick(st.enemy);
    const expiry = nextExpiry(st.buffs, frame);
    const tickDue = tick !== null && tick <= frame ? tick : null;
    // Ticks of a status already on the enemy, then buffs ending, come before a hit at the same frame.
    if (tickDue !== null && (expiry === null || tickDue <= expiry) && (!hit || tickDue <= hit.frame)) {
      const before = st.enemy;
      const t = tickStatus(st.enemy, tickDue);
      st = recordStatus(ctx, { ...st, enemy: t.state }, t.events, before);
      st = runTriggers(ctx, st, asEvents(t.events), null);
      continue;
    }
    if (expiry !== null && (!hit || expiry <= hit.frame)) {
      const ended = st.buffs.filter((b) => b.expiresAt === expiry);
      st = { ...st, buffs: st.buffs.filter((b) => b.expiresAt !== expiry) };
      st = runTriggers(ctx, st, ended.map((b) => ({ type: "buffEnded" as const, frame: expiry, operator: b.owner, buff: b.id })), null);
      continue;
    }
    if (!hit) break;
    const h = hit;
    st = landHit(ctx, { ...st, pending: st.pending.filter((x) => x !== h) }, h);
  }
  return {
    ...st,
    sp: spAt(st, frame),
    frame,
    enemy: expireStatus(st.enemy, frame),
  };
}

/** The earliest frame an action could start from the current state, or a reason it can't. */
export function earliestStart(ctx: TimelineContext, state: TimelineState, action: RotationAction): { frame: number } | { error: string } {
  if (!ctx.builds.has(action.operator)) return { error: `${action.operator} isn't in the team` };
  let frame = Math.max(state.frame, action.at ?? 0, state.freeAt[action.operator] ?? 0);
  if (action.skill === "swap") {
    if (action.operator === state.controlled) return { error: `${action.operator} is already the controlled operator` };
    // The controlled operator finishes its current action first (no cancelling by swapping, assumed).
    return { frame: Math.max(frame, state.freeAt[state.controlled] ?? 0) };
  }
  let costs;
  try {
    kitSkill(ctx, action.operator, action.skill);
    costs = skillCosts(ctx, action.operator, action.skill);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  if (costs.kind === "basic" && state.controlled !== action.operator) return { error: `${action.operator} isn't the controlled operator (swap first)` };
  frame = Math.max(frame, state.readyAt[action.skill] ?? 0);
  if (costs.spCost > SP.max) return { error: `${action.skill} costs ${costs.spCost} SP, more than the maximum` };
  // Wait for SP: regen is linear after any pause.
  const spThen = spAt(state, frame);
  if (spThen < costs.spCost) {
    const from = Math.max(frame, state.spPausedUntil);
    frame = from + Math.ceil(((costs.spCost - spAt(state, from)) * FPS) / SP.perSecond);
  }
  if (frame > ctx.scenario.durationFrames) return { error: `${action.skill} can't start before the fight ends` };
  // Energy, combo windows and states change only as hits land, so check them as they'll be at the start frame.
  const skill = kitSkill(ctx, action.operator, action.skill);
  if (skill.availableWhile || skill.unavailableWhile) {
    const then = advance(ctx, state, frame);
    const active = (id: string) => then.buffs.some((x) => x.id === id && x.owner === action.operator && x.appliedAt <= frame && x.expiresAt > frame);
    if (skill.availableWhile && !active(skill.availableWhile)) return { error: `${action.skill} needs ${skill.availableWhile} active` };
    if (skill.unavailableWhile && active(skill.unavailableWhile)) return { error: `${action.skill} isn't available during ${skill.unavailableWhile}` };
  }
  if (costs.energyCost > 0 || (costs.kind === "combo" && hasComboTrigger(ctx, action.operator))) {
    const then = advance(ctx, state, frame);
    if (costs.energyCost > 0 && (then.energy[action.operator] ?? 0) < costs.energyCost - 1e-9) {
      return { error: `${action.skill} needs ${costs.energyCost} ultimate energy, ${(then.energy[action.operator] ?? 0).toFixed(1)} at frame ${frame}` };
    }
    if (costs.kind === "combo" && hasComboTrigger(ctx, action.operator)) {
      const w = then.comboWindow[action.operator];
      if (!w || w.until < frame) {
        // Not open yet: wait for a hit already on its way to open it (a recorded rotation's combo follows its trigger).
        const later = [...new Set(state.pending.map((h) => h.frame).filter((f) => f > frame))].sort((a, b) => a - b);
        const opens = later.find((f) => {
          const x = advance(ctx, state, f).comboWindow[action.operator];
          return x !== undefined && x.until >= f;
        });
        if (opens === undefined || opens > ctx.scenario.durationFrames) return { error: `${action.skill}: its combo trigger hasn't happened (no open window at frame ${frame})` };
        frame = opens;
      }
    }
  }
  return { frame };
}

/** Whether the operator's combo needs a window: some trigger of its kit opens one (for this build's modes). */
function hasComboTrigger(ctx: TimelineContext, operator: string): boolean {
  const panel = ctx.panels.get(operator) as StatPanel;
  const build = ctx.builds.get(operator) as Build;
  return (ctx.kits.get(operator)?.triggers ?? []).some(
    (t) => t.do.some((a) => a.kind === "openCombo") && (!t.if || test(t.if, evalContext(ctx.data, build, panel, triggerSkillId(operator, t), { team: ctx.scenario.team })) !== false),
  );
}

/** Applies one rotation action at its earliest legal frame. Throws if it can't happen. */
export function apply(ctx: TimelineContext, state: TimelineState, action: RotationAction): TimelineState {
  const start = earliestStart(ctx, state, action);
  if ("error" in start) throw new EngineError(`frame ${state.frame}: ${action.operator} ${action.skill}: ${start.error}`);
  const s = advance(ctx, state, start.frame);
  if (action.skill === "swap") return { ...s, controlled: action.operator };
  const skill = kitSkill(ctx, action.operator, action.skill);
  const costs = skillCosts(ctx, action.operator, action.skill);
  // Hits that need stacks happen only if the stacks are there at the cast; meeting a consuming requirement uses the stack up.
  const own = s.stacks[action.operator] ?? {};
  const panel = ctx.panels.get(action.operator) as StatPanel;
  const castSituation: Situation = { team: ctx.scenario.team, controlled: s.controlled, stacks: own, buffActive: (id) => s.buffs.some((b) => b.id === id && b.owner === action.operator && b.appliedAt <= start.frame && b.expiresAt > start.frame) };
  const met = (h: KitHit) => hitAvailable(ctx.data, ctx.builds.get(action.operator) as Build, panel, skill.skillId, h, castSituation) && (!h.requires || (own[h.requires.stack] ?? 0) >= h.requires.atLeast);
  const used = new Set(skill.hits.filter((h) => h.requires?.consume && met(h)).map((h) => h.requires?.stack as string));
  const stacks = used.size ? { ...s.stacks, [action.operator]: { ...own, ...Object.fromEntries([...used].map((id) => [id, 0])) } } : s.stacks;
  const pending: PendingHit[] = [];
  for (const h of skill.hits.filter(met)) {
    const frames = h.frames ?? Array.from({ length: h.count }, () => 0);
    for (const f of frames) pending.push({ frame: start.frame + f, operator: action.operator, skillId: skill.skillId, hitId: h.id, sp: 0, controlledAtCast: s.controlled });
  }
  const spGain = skillSpGain(ctx, action.operator, action.skill);
  if (spGain > 0 && pending.length > 0) {
    const first = pending.reduce((a, b) => (b.frame < a.frame ? b : a));
    pending[pending.indexOf(first)] = { ...first, sp: spGain };
  }
  // Returned SP is spent first; only the natural part gives the team ultimate energy.
  const natural = Math.max(0, costs.spCost - s.spReturned);
  let next: TimelineState = { ...s, spReturned: Math.max(0, s.spReturned - costs.spCost) };
  if (natural > 0) for (const b of ctx.scenario.team) next = gainEnergy(ctx, next, b.operator, natural * ENERGY.perNaturalSp, start.frame);
  if (costs.energyCost > 0) next = { ...next, energy: { ...next.energy, [action.operator]: Math.max(0, (next.energy[action.operator] ?? 0) - costs.energyCost) } };
  if (skill.energyBlockSeconds) next = { ...next, energyBlockedUntil: { ...next.energyBlockedUntil, [action.operator]: start.frame + Math.round(skill.energyBlockSeconds * FPS) } };
  if (costs.kind === "combo" && next.comboWindow[action.operator]) {
    const { [action.operator]: _used, ...rest } = next.comboWindow;
    next = { ...next, comboWindow: rest };
  }
  const cast: TimelineState = {
    ...next,
    sp: s.sp - costs.spCost,
    spPausedUntil: costs.spCost > 0 ? start.frame + SP.pauseAfterSpendFrames : s.spPausedUntil,
    freeAt: { ...s.freeAt, [action.operator]: start.frame + costs.lockFrames },
    readyAt: costs.cooldownFrames > 0 ? { ...next.readyAt, [action.skill]: start.frame + costs.cooldownFrames } : next.readyAt,
    pending: [...s.pending, ...pending],
    stacks,
    casts: [...s.casts, { frame: start.frame, operator: action.operator, skill: action.skill, spAfter: s.sp - costs.spCost, energyAfter: next.energy[action.operator] ?? 0 }],
  };
  const castEvent: BattleEvent = { type: "cast", frame: start.frame, operator: action.operator, skillId: action.skill, kind: costs.kind, controlled: s.controlled === action.operator };
  return runTriggers(ctx, cast, [castEvent], { operator: action.operator, kind: costs.kind });
}

export interface TimelineResult {
  readonly total: number;
  /** Total damage per second over the time to the last hit. */
  readonly dps: number;
  readonly lastHitFrame: number;
  readonly perOperator: Readonly<Record<string, number>>;
  readonly casts: readonly Cast[];
  readonly hits: readonly LandedHit[];
  readonly reactions: readonly ReactionRecord[];
  readonly assumptions: readonly string[];
}

/** Runs a recorded rotation: the simplest driver on the stepping API. */
export function simulate(data: GameData, scenario: TimelineScenario): TimelineResult {
  const ctx = createContext(data, scenario);
  let state = init(ctx);
  for (const action of scenario.rotation) state = apply(ctx, state, action);
  state = advance(ctx, state, scenario.durationFrames);
  const perOperator: Record<string, number> = Object.fromEntries(scenario.team.map((b) => [b.operator, 0]));
  let total = 0;
  for (const h of state.hits) {
    perOperator[h.operator] = (perOperator[h.operator] ?? 0) + h.exact;
    total += h.exact;
  }
  const lastHitFrame = state.hits.reduce((m, h) => Math.max(m, h.frame), 0);
  const missingFrames = state.hits.some((h) => {
    const s = data.kits.operators[h.operator]?.skills.find((x) => x.skillId === h.skillId);
    return s !== undefined && !s.hits.find((x) => x.id === h.hitId)?.frames;
  });
  return {
    total,
    dps: lastHitFrame > 0 ? total / (lastHitFrame / FPS) : 0,
    lastHitFrame,
    perOperator,
    casts: state.casts,
    hits: state.hits,
    reactions: state.reactions,
    assumptions: [...TIMELINE_ASSUMPTIONS, ...(missingFrames ? ["Some hits have no frames in their kit and land at the skill's start."] : [])],
  };
}
