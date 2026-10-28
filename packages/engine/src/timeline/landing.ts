// Hits and bursts landing: their applications, damage, SP, stagger and the events they start; the random streams.

import type { SkillType } from "../attributes.ts";
import type { Build } from "../build.ts";
import { computeHit, computeReaction, decide, finisherModifier, type DamageOptions, type DamageTarget, evalContext, fixedHit, type HitDamage, hitDecorations, type Situation, skillValue } from "../damage.ts";
import type { Modifier } from "../effects.ts";
import { EngineError } from "../errors.ts";
import { type GameData, type KitHit, type KitSkill, resolveApplication } from "../model.ts";
import { type BattleEvent, triggerActionAt } from "../events.ts";
import { evaluate } from "../expr.ts";
import { activeAt, resolveValue } from "../buffs.ts";
import { applyToEnemy, type EnemyStatus, expireStatus, NO_STATUS, type StatusEvent } from "../status.ts";
import type { LandedHit, LandingFacts, LandingInputs, PendingBurst, PendingHit, ReactionRecord, TimelineContext, TimelineState } from "./state.ts";
import { kitSkill, panelAt } from "./context.ts";
import { dealPoise, gainEnergy, gainSp, isStaggered, spGrantOf } from "./resources.ts";
import { artsIntensity, attackerSide, buffSituation, damageOptions, healEvents, situationAt, statusTweaks } from "./situation.ts";
import { addBuff, buffAppliedEvent, changedStacks, gainStacks, runTriggers } from "./actions.ts";
import { ofKind, schedule } from "./schedule.ts";

/** The modifiers a logged fight gives a kit hit's landing that no kit models (TimelineScenario.loggedModifiers): the nearest logged landing's within a frame, none without. */
function loggedModifiersAt(ctx: TimelineContext, operator: string, events: readonly string[], frame: number): readonly Modifier[] {
  if (!ctx.loggedModifiers) return [];
  const near = events.flatMap((e) => (ctx.loggedModifiers?.get(`${operator}|${e}`) ?? []).filter((x) => Math.abs(x.frame - frame) <= 1));
  return near.sort((a, b) => Math.abs(a.frame - frame) - Math.abs(b.frame - frame))[0]?.modifiers ?? [];
}

/**
 * The crit a logged fight gives a kit hit's landing (TimelineScenario.loggedCrits): a pinned landing's own logged hit's
 * (its `ref`), else of a logged landing of its operator with one of its events within a frame of it; null when there
 * is none, or both crit and not at once (several landings at one frame). Undefined without logged crits (a simulation).
 */
function loggedCritAt(ctx: TimelineContext, operator: string, events: readonly string[], frame: number, ref?: string): boolean | null | undefined {
  if (!ctx.loggedCrits) return undefined;
  const all = events.flatMap((e) => ctx.loggedCrits?.get(`${operator}|${e}`) ?? []);
  const own = ref !== undefined ? all.find((x) => x.ref === ref) : undefined;
  if (own) return own.crit;
  const near = all.filter((x) => Math.abs(x.frame - frame) <= 1);
  if (near.length === 0) return null;
  return near.every((x) => x.crit === near[0]?.crit) ? (near[0] as { crit: boolean }).crit : null;
}

/**
 * What a status event deals its damage as (computeReaction): bursts, reactions with an initial hit, physical statuses,
 * Shatter and Combustion ticks; null for the others. Every kind is listed, so a new one doesn't compile until decided.
 */
function eventReaction(e: StatusEvent): Parameters<typeof computeReaction>[4] | null {
  switch (e.kind) {
    case "burst":
      return { kind: "burst", element: e.element, stacks: 1 };
    case "reaction":
      // A forced reaction has no initial hit.
      return e.initialHit ? { kind: "reaction", element: e.element, stacks: e.level } : null;
    case "physical":
      return { kind: e.status, element: "physical", stacks: e.level };
    case "shatter":
      return { kind: "shatter", element: "physical", stacks: e.level };
    case "combustionTick":
      return { kind: "combustionTick", element: "fire", stacks: e.level };
    case "inflicted":
    case "consumed":
    case "statusConsumed":
    case "vulnerable":
    case "control":
      return null;
    default: {
      const unknown: never = e;
      throw new EngineError(`status event of unknown kind ${(unknown as { kind: string }).kind}`);
    }
  }
}

/** Whether a status event deals damage (eventReaction). */
const dealsDamage = (e: StatusEvent): boolean => eventReaction(e) !== null;

/**
 * A landing's damage from its inputs (LandedHit.inputs): the damage path the timeline takes for it (computeHit for a
 * kit hit, computeReaction and the event's scale for a status event), with `options` in place of the inputs' own and
 * another kit hit (and the skill its values come from) in place of the landed one when given. The log check computes its readings of a logged hit with it,
 * so they and the simulation share every rule.
 */
export function landingDamage(data: GameData, target: DamageTarget, inputs: LandingInputs, options: DamageOptions = inputs.options, other?: { readonly skill: Pick<KitSkill, "skillId">; readonly hit: KitHit }): HitDamage {
  if (inputs.kind === "hit") return computeHit(data, inputs.build, inputs.panel, target, other?.skill ?? inputs.skill, other?.hit ?? inputs.hit, options);
  return computeReaction(data, inputs.build, inputs.panel, target, inputs.reaction, options, inputs.scale);
}

function eventDamage(ctx: TimelineContext, e: StatusEvent, enemy: EnemyStatus, st: TimelineState, critRoll?: number, prior?: EnemyStatus): LandedHit | null {
  const reaction = eventReaction(e);
  if (!reaction) return null;
  // Corrosion's own hit comes before its status (buff_common_natural_*_triggered_wrapper creates the damage buff,
  // buff_common_natural_triggered, first): it sees the Corrosion that was on the enemy, not its own (2026-10-28,
  // accuracy plan B7: logged ×0.91–0.94 of the prediction with its own shred, matched without it).
  if (e.kind === "reaction" && e.status === "corrosion" && e.initialHit && prior) {
    enemy = { ...enemy, statuses: [...enemy.statuses.filter((x) => x.status !== "corrosion"), ...prior.statuses.filter((x) => x.status === "corrosion" && x.expiresAt > e.frame)] };
  }
  const build = ctx.builds.get(e.operator) as Build;
  // A Combustion tick keeps its applier's attacker side from the application (ActiveStatus.snapshot).
  const snapshot = e.kind === "combustionTick" ? e.snapshot : undefined;
  const scale = e.kind === "combustionTick" ? e.damageScale : e.kind === "physical" && e.multiplier !== undefined ? { key: "multiplier", value: e.multiplier } : undefined;
  const inputs: LandingInputs = {
    kind: "status", operator: e.operator, build, panel: panelAt(ctx, e.operator, e.frame), reaction,
    options: { ...damageOptions(ctx, st, e.operator, enemy, e.frame, undefined, snapshot), ...(critRoll !== undefined ? { critRoll } : {}) },
    ...(scale ? { scale } : {}),
  };
  // A replayed fight's landings keep their inputs (LandedHit.inputs: the log check computes them again).
  return { ...landingDamage(ctx.data, ctx.scenario.target, inputs), frame: e.frame, operator: e.operator, ...(ctx.loggedCrits ? { inputs } : {}) };
}

/** Landed hits, and what the recording buffs active at their frames record of them (KitBuff.records; not Fixed DMG). */
function addHits(st: TimelineState, landed: readonly LandedHit[]): TimelineState {
  if (landed.length === 0) return st;
  const buffs = st.buffs.some((b) => b.records)
    ? st.buffs.map((b) => {
        if (!b.records) return b;
        let total = b.records.total;
        for (const h of landed) if (!h.fixed && b.appliedAt <= h.frame && h.frame < b.expiresAt) total += b.records.rate * h.exact;
        return total === b.records.total ? b : { ...b, records: { ...b.records, total } };
      })
    : st.buffs;
  return { ...st, buffs, hits: [...st.hits, ...landed] };
}

/**
 * Status events: recorded, and the damage they deal (bursts, reactions, ticks) lands. `enemy` is the state their
 * damage sees: after a hit's own applications, before a tick's change.
 */
export function recordStatus(ctx: TimelineContext, st: TimelineState, events: readonly StatusEvent[], enemy: EnemyStatus, prior?: EnemyStatus): TimelineState {
  const records: ReactionRecord[] = [];
  const landed: LandedHit[] = [];
  let next = st;
  for (const e of events) {
    if (e.kind === "inflicted") continue;
    records.push(e);
    // Every damaging event draws its crit roll (a tick that can't crit too: the stream doesn't depend on what crits).
    let roll: number | undefined;
    if (ctx.scenario.options.crit === "rolled" && dealsDamage(e)) ({ value: roll, state: next } = draw(ctx, next, "crit"));
    const d = eventDamage(ctx, e, enemy, st, roll, prior);
    if (d) landed.push(d);
  }
  return records.length ? addHits({ ...next, reactions: [...next.reactions, ...records] }, landed) : st;
}

/** The next draw of the battle's random stream (mulberry32): a uniform value in [0, 1) and the stream's new state. */
export function nextRandom(seed: number): { readonly value: number; readonly seed: number } {
  const s = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), s | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: s };
}

/** A draw from one of the battle's random streams; each starts from the scenario's seed mixed with the stream's name. */
export function draw(ctx: TimelineContext, st: TimelineState, stream: string): { value: number; state: TimelineState } {
  let start = st.rng[stream];
  if (start === undefined) {
    // FNV-1a of the name, mixed into the seed.
    let h = 0x811c9dc5;
    for (const c of stream) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
    start = ((ctx.scenario.options.seed ?? 1) ^ h) >>> 0;
  }
  const r = nextRandom(start);
  return { value: r.value, state: { ...st, rng: { ...st.rng, [stream]: r.seed } } };
}

/** Status events as battle events, with the kind of the hit that caused them (and its cast). */
export const asEvents = (events: readonly StatusEvent[], fromKind: SkillType | "none", cast?: number): BattleEvent[] =>
  events.map((e) => ({ type: "status", frame: e.frame, operator: e.operator, event: e, fromKind, ...(cast !== undefined ? { cast } : {}) }));

/** An infliction's status events without its bursts, which are scheduled their element's delay later, on the enemy's clock (BattleConstants.burstDelayFrames). */
export function delayBursts(ctx: TimelineContext, st: TimelineState, events: readonly StatusEvent[], fromKind: SkillType | "none", cast?: number): { state: TimelineState; now: StatusEvent[] } {
  const delay = (e: StatusEvent) => (e.kind === "burst" ? ctx.burstDelayFrames[e.element] : 0);
  const now = events.filter((e) => delay(e) === 0);
  if (now.length === events.length) return { state: st, now };
  const later = events.flatMap((e): PendingBurst[] => {
    if (e.kind !== "burst" || delay(e) === 0) return [];
    const { frame: _at, ...event } = e;
    return [{ kind: "burst", frame: e.frame + delay(e), clock: "enemy", event, fromKind, ...(cast !== undefined ? { fromCast: cast } : {}) }];
  });
  return { state: schedule(st, later), now };
}

/** A pending hit's kit entry, the skill its values come from and its kind. */
function pendingHitDef(ctx: TimelineContext, hit: PendingHit): { skill: Pick<KitSkill, "skillId">; kind: SkillType | "none"; kitHit: KitHit } {
  if (!hit.trigger) {
    const skill = kitSkill(ctx, hit.operator, hit.skillId);
    return { skill, kind: skill.kind, kitHit: skill.hits.find((h) => h.id === hit.hitId) as KitHit };
  }
  const { id, action, nested } = hit.trigger;
  const t = ctx.kits.get(hit.operator)?.triggers.find((x) => x.id === id);
  const a = t && triggerActionAt(t, action, nested);
  const kitHit = a?.kind === "hits" ? a.hits.find((h) => h.id === hit.hitId) : undefined;
  if (!kitHit) throw new EngineError(`${hit.operator} trigger ${id} has no hit ${hit.hitId}`);
  return { skill: { skillId: hit.skillId }, kind: kitHit.damageType, kitHit };
}

/** A pending hit's position in its kit list (skill hits, or its trigger action's hits): alternatives are judged in this order. */
function hitOrder(ctx: TimelineContext, hit: PendingHit): number {
  if (!hit.trigger) return kitSkill(ctx, hit.operator, hit.skillId).hits.findIndex((h) => h.id === hit.hitId);
  const { id, action, nested } = hit.trigger;
  const t = ctx.kits.get(hit.operator)?.triggers.find((x) => x.id === id);
  const a = t && triggerActionAt(t, action, nested);
  return a?.kind === "hits" ? a.hits.findIndex((h) => h.id === hit.hitId) : 0;
}

/**
 * Lands one pending hit: its own effects, its damage, then the triggers its events start. A delayed hit
 * (KitHit.enemyDelay) lands twice: its effects at its frame, which schedules its damage (PendingHit.deferred).
 */
export function landHit(ctx: TimelineContext, state: TimelineState, hit: PendingHit): TimelineState {
  let st = state;
  const { skill, kind, kitHit } = pendingHitDef(ctx, hit);
  const castIndex = hit.cast?.index;
  // A delayed hit's damage (`late`: only its damage), or its landing without it (`withDamage` false).
  const late = hit.deferred !== undefined;
  const withDamage = kitHit.enemyDelay === undefined || late;
  const spEvents: BattleEvent[] = [];
  if (hit.sp > 0 && !late) {
    const spKind = hit.spKind ?? "returned";
    st = gainSp(st, hit.sp, hit.frame, spKind);
    spEvents.push({ type: "sp", frame: hit.frame, operator: hit.operator, amount: hit.sp, kind, natural: spKind === "natural", ...(hit.spSource !== undefined ? { sourceType: hit.spSource } : {}) });
  }
  const build = ctx.builds.get(hit.operator) as Build;
  st = { ...st, enemy: expireStatus(st.enemy, hit.frame) };
  const panel = panelAt(ctx, hit.operator, hit.frame);
  // Its situation as it lands, before its own effects: whether it happens (KitHit.if) and its extra scale.
  // Who counts as controlled is who was when its skill was cast.
  const controlled = hit.controlledAtCast ?? st.controlled;
  // The Link stacks its cast used (castLink; a triggered hit is of no cast: 0).
  const castLink = castIndex !== undefined ? (st.casts[castIndex]?.link ?? 0) : 0;
  const at = (consumedSoFar?: number): Situation => ({ ...situationAt(ctx, hit.operator, st, hit.frame, consumedSoFar), controlled, castLink, ...(hit.eventCount !== undefined ? { eventCount: hit.eventCount } : {}) });
  const before = at();
  const buffsAtLanding = st.buffs;
  const happens = (h: PendingHit) => {
    const def = h === hit ? kitHit : pendingHitDef(ctx, h).kitHit;
    return !def.if || decide(def.if, evalContext(ctx.data, build, panel, hit.skillId, before));
  };
  // Alternatives of one landing are judged together, on the situation before any of them: the first in kit order that happens lands.
  if (late) {
    // Its landing decided it.
  } else if (hit.branch) {
    const members = [hit, ...ofKind(st.scheduled, "hit").filter((p) => p.branch === hit.branch)].sort((a, b) => hitOrder(ctx, a) - hitOrder(ctx, b));
    const chosen = members.find(happens);
    st = { ...st, scheduled: st.scheduled.filter((p) => !(p.kind === "hit" && p.branch === hit.branch) || p === chosen) };
    if (chosen !== hit) return st;
  } else if (!happens(hit)) return st;
  // A poise-only landing (KitHit.poiseOnly): its Stagger and nothing else (the cast's SP on its first landing stays).
  if (kitHit.poiseOnly) {
    if (kitHit.poise === undefined || (kitHit.poiseControlledOnly && controlled !== hit.operator)) return spEvents.length ? runTriggers(ctx, st, spEvents, { operator: hit.operator, kind }) : st;
    const r = dealPoise(ctx, st, hit.operator, resolveValue(ctx.data, build, panel, hit.skillId, kitHit.poise, before), hit.frame);
    return runTriggers(ctx, r.state, [...r.events, ...spEvents], { operator: hit.operator, kind });
  }
  // What the hit applies comes first: its own damage and a reaction's initial hit already see the new status.
  // Applications marked afterDamage run after the damage instead (KitApplication.afterDamage).
  let consumed = hit.deferred?.consumed ?? 0;
  const applyPhase = (afterDamage: boolean): StatusEvent[] => {
    const out: StatusEvent[] = [];
    const apps = late ? [] : (kitHit.applies ?? []).filter((app) => (app.afterDamage ?? false) === afterDamage);
    if (!apps.length) return out;
    const ai = artsIntensity(ctx, st, hit.operator, hit.frame);
    for (const app of apps) {
      if (app.if && !decide(app.if, evalContext(ctx.data, build, panel, hit.skillId, at(consumed)))) continue;
      const resolved = resolveApplication(app, (v) => evaluate(v, evalContext(ctx.data, build, panel, hit.skillId, at(consumed))), hit.eventSource);
      if (!resolved) continue;
      const side = st;
      const r = applyToEnemy(st.enemy, resolved, hit.frame, hit.operator, ai, (key) => skillValue(ctx.data, panel, build, hit.skillId, key), statusTweaks(ctx, st, hit.operator, hit.frame), () => attackerSide(side, hit.operator, hit.frame));
      const d = delayBursts(ctx, { ...st, enemy: r.state }, r.events, kind, castIndex);
      st = d.state;
      out.push(...d.now);
      for (const x of r.events) if (x.kind === "consumed") consumed += x.stacks;
    }
    return out;
  };
  const statusEvents = applyPhase(false);
  // A hit computed as a burst is one for triggers too (its damage is the hit's own).
  const burst: StatusEvent[] = kitHit.reaction?.kind === "burst" && withDamage ? [{ kind: "burst", frame: hit.frame, operator: hit.operator, element: kitHit.reaction.element }] : [];
  // Triggers that act before the hit's damage on its own status events (a buff they apply already counts for it).
  if ((statusEvents.length || burst.length) && ctx.beforeDamage) st = runTriggers(ctx, st, asEvents([...statusEvents, ...burst], kind, castIndex), { operator: hit.operator, kind }, (t) => t.beforeDamage === true, false);
  let stacksChanged: string[] = [];
  const events: BattleEvent[] = [];
  if (kitHit.gains?.length && !late) {
    const was = st.stacks[hit.operator] ?? {};
    st = { ...st, stacks: gainStacks(ctx, st.stacks, hit.operator, kitHit.gains, evalContext(ctx.data, build, panel, hit.skillId, at(consumed))) };
    stacksChanged = changedStacks(was, st.stacks[hit.operator] ?? {});
  }
  const kitBuff = (id: string) => ctx.kits.get(hit.operator)?.buffs.find((b) => b.id === id);
  // Buffs applied before the damage: their buffApplied triggers run before it too (what they apply acts on the hit).
  const applyBuffs = (beforeDamage: boolean) => {
    const into = beforeDamage ? [] : events;
    for (const a of late ? [] : (kitHit.buffs ?? [])) {
      if ((a.beforeDamage ?? false) !== beforeDamage) continue;
      const def = kitBuff(a.buff);
      if (!def) throw new EngineError(`${hit.operator} has no buff ${a.buff}`);
      if (a.if && !decide(a.if, evalContext(ctx.data, build, panel, hit.skillId, at(consumed)))) continue;
      const r = addBuff(ctx, st, hit.operator, hit.skillId, a.duration !== undefined ? { ...def, duration: a.duration } : def, hit.frame, at(consumed), undefined, a.untilFrame);
      st = r.state;
      if (r.applied) into.push(buffAppliedEvent(ctx, hit.frame, hit.operator, def, kind, r.buff));
    }
    if (beforeDamage && into.length) st = runTriggers(ctx, st, into, { operator: hit.operator, kind });
  };
  applyBuffs(true);
  /** The hit's own SP (KitHit.sp), its event into `into`. */
  const grantSp = (into: BattleEvent[]) => {
    if (kitHit.sp === undefined || late) return;
    const amount = resolveValue(ctx.data, build, panel, hit.skillId, kitHit.sp, at(consumed));
    const grant = spGrantOf(ctx, hit.skillId, kitHit.sp, kitHit.spKind);
    st = gainSp(st, amount, hit.frame, grant.kind);
    if (amount > 0) into.push({ type: "sp", frame: hit.frame, operator: hit.operator, amount, kind, natural: grant.kind === "natural", ...(grant.sourceType !== undefined ? { sourceType: grant.sourceType } : {}) });
  };
  // SP granted before the damage (KitHit.spBeforeDamage): its triggers act before it too (a buff they apply counts for the hit).
  if (kitHit.spBeforeDamage) {
    const early: BattleEvent[] = [];
    grantSp(early);
    if (early.length) st = runTriggers(ctx, st, early, { operator: hit.operator, kind });
  }
  // A finisher (skillSpecification 8) is multiplied by the enemy's finisher multiplier (attribute 27).
  const finisher = !hit.trigger && ctx.data.skills[hit.skillId]?.timing?.specification === 8;
  let roll: number | undefined;
  if (ctx.scenario.options.crit === "rolled" && hit.fixed === undefined && withDamage) ({ value: roll, state: st } = draw(ctx, st, "crit"));
  // A replayed fight's logged crit for this landing (TimelineScenario.loggedCrits), which decides it.
  const loggedCrit = hit.fixed === undefined && withDamage ? loggedCritAt(ctx, hit.operator, kitHit.events, hit.frame, hit.ref) : undefined;
  const decorations = hitDecorations(kitHit, finisher);
  const options = hit.fixed !== undefined || !withDamage ? null : damageOptions(ctx, st, hit.operator, st.enemy, hit.frame, castIndex, hit.snapshot);
  const inputs: LandingInputs | null = !options ? null : { kind: "hit", operator: hit.operator, build, panel, skill, hit: kitHit, options: {
    ...options,
    decorations,
    ...(roll !== undefined ? { critRoll: roll } : {}),
    ...(typeof loggedCrit === "boolean" ? { crit: loggedCrit ? ("always" as const) : ("never" as const) } : {}),
    modifiers: [
      ...options.modifiers,
      ...(finisher ? [finisherModifier(ctx.data, ctx.enemy.id)] : []),
      ...loggedModifiersAt(ctx, hit.operator, kitHit.events, hit.frame),
    ],
    situation: { ...before, consumed },
    // Its modifiers' conditions see the enemy and the buffs as the damage is computed: after the hit's own applications and
    // beforeDamage buffs (whose modifiers count for it: Yvonne's 10th layer gives its Crit DMG to the shot that adds it).
    ...(st.enemy !== before.enemy || st.buffs !== buffsAtLanding ? { modifierSituation: { ...before, consumed, ...buffSituation(at(consumed)) } } : {}),
  } };
  const result = !withDamage ? null : !inputs ? fixedHit(skill.skillId, kitHit, hit.fixed as number) : landingDamage(ctx.data, ctx.scenario.target, inputs);
  const facts = (): LandingFacts => {
    const layers: Record<string, number> = {};
    for (const b of buffsAtLanding) if (b.owner === hit.operator && b.cast === undefined && activeAt(b, hit.frame)) layers[b.id] = (layers[b.id] ?? 0) + 1;
    return {
      stacks: before.stacks ?? {}, enemy: before.enemy ?? NO_STATUS, consumed, ...(hit.eventCount !== undefined ? { eventCount: hit.eventCount } : {}), castLink, controlled,
      buffLayers: layers, staggered: before.staggered ?? false, enemyHp: before.enemyHp ?? 1,
    };
  };
  if (result) st = addHits(st, [{ ...result, count: 1, frame: hit.frame, operator: hit.operator, ...(kitHit.fixedDamage !== undefined ? { fixed: true as const } : {}), ...(hit.ref !== undefined ? { ref: hit.ref } : {}),
    // A replay's landings carry their facts (a pinned one with its reference; one a trigger lands, matched to the log by time).
    ...(hit.ref !== undefined || ctx.loggedCrits ? { facts: facts() } : {}), ...(loggedCrit !== undefined ? { loggedCrit } : {}), ...(ctx.loggedCrits && inputs ? { inputs } : {}) }]);
  // The enemy the damage saw: the reactions of the applications before it see it too.
  const enemyAtDamage = st.enemy;
  const lateEvents = applyPhase(true);
  // Triggers that act on a hit's own status events before its damage act on these as they happen.
  if (lateEvents.length && ctx.beforeDamage) st = runTriggers(ctx, st, asEvents(lateEvents, kind, castIndex), { operator: hit.operator, kind }, (t) => t.beforeDamage === true, false);
  applyBuffs(false);
  if (hit.usesUp && !late) {
    const own = st.stacks[hit.operator] ?? {};
    st = { ...st, stacks: { ...st.stacks, [hit.operator]: { ...own, ...Object.fromEntries(hit.usesUp.map((u) => [u.stack, Math.max(0, (own[u.stack] ?? 0) - u.amount)])) } } };
  }
  if (kitHit.sp !== undefined && !kitHit.spBeforeDamage) grantSp(spEvents);
  if (kitHit.energy && !late) {
    const amount = resolveValue(ctx.data, build, panel, hit.skillId, kitHit.energy, at(consumed));
    st = gainEnergy(ctx, st, hit.operator, amount, hit.frame);
  }
  st = recordStatus(ctx, st, statusEvents, enemyAtDamage, before.enemy);
  if (lateEvents.length) st = recordStatus(ctx, st, lateEvents, st.enemy);
  // Stagger: Final Strikes' only while their operator is controlled (onlyEnableForMainChar).
  const poiseEvents: BattleEvent[] = [];
  if (withDamage && kitHit.poise !== undefined && (!kitHit.poiseControlledOnly || controlled === hit.operator)) {
    const landing = {
      hit: { element: kitHit.reaction?.element ?? kitHit.element, skillType: kitHit.reaction || kind === "none" ? null : kind, staggered: isStaggered(st, hit.frame), kind: kitHit.reaction?.kind ?? kind, decorations },
      ec: evalContext(ctx.data, build, panel, hit.skillId, at(consumed)),
      ...(castIndex !== undefined ? { cast: castIndex } : {}),
    };
    const r = dealPoise(ctx, st, hit.operator, resolveValue(ctx.data, build, panel, hit.skillId, kitHit.poise, at(consumed)), hit.frame, landing);
    st = r.state;
    poiseEvents.push(...r.events);
  }
  const hitEvent: BattleEvent = {
    // A skill's hit with a damage type of its own (KitHit.damageType) is a hit of that kind; the rest of the cast's events keep the skill's.
    type: "hit", frame: hit.frame, operator: hit.operator, skillId: hit.skillId, kind: kitHit.damageType,
    element: kitHit.reaction?.element ?? kitHit.element, finalStrike: kitHit.finalStrike ?? false, finisher, controlled: st.controlled === hit.operator,
    ...(kitHit.dive ? { dive: true } : {}),
    ...(kitHit.reaction ? { reaction: true } : {}),
    ...(castIndex !== undefined ? { cast: castIndex } : {}),
    ...(typeof loggedCrit === "boolean" ? (loggedCrit ? { crit: true } : {}) : (ctx.scenario.options.crit === "always" && hit.fixed === undefined) || result?.crit ? { crit: true } : {}),
  };
  if (!withDamage) {
    // Its damage, on the enemy's clock (a replay's at its logged frame); its landing is past, cut casts or not.
    const { branch: _b, launchAt: _l, damageFrame, pinned: _p, ...rest } = hit;
    const at = damageFrame ?? hit.frame + (kitHit.enemyDelay as number);
    st = schedule(st, [{ ...rest, frame: at, clock: "enemy", detached: true, deferred: { consumed }, ...(damageFrame !== undefined ? { pinned: true as const } : {}) }]);
  }
  const all: BattleEvent[] = [
    ...(withDamage ? [hitEvent] : []), ...asEvents(statusEvents, kind, castIndex), ...asEvents(burst, kind, castIndex), ...asEvents(lateEvents, kind, castIndex), ...poiseEvents, ...events, ...spEvents,
    ...(kitHit.heals && withDamage ? healEvents(ctx, st, hit.operator, kitHit.heals, hit.frame, kind) : []),
    ...(kitHit.gains?.length ? [{ type: "stacks" as const, frame: hit.frame, operator: hit.operator, changed: stacksChanged }] : []),
  ];
  return runTriggers(ctx, st, all, { operator: hit.operator, kind }, ctx.beforeDamage ? (t) => !t.beforeDamage : undefined);
}

/** A burst lands: before-damage triggers on it, its damage (on the enemy as it is now), then its other triggers. */
export function landBurst(ctx: TimelineContext, state: TimelineState, b: PendingBurst): TimelineState {
  const origin = { operator: b.event.operator, kind: b.fromKind };
  // As it was inflicted, at its own frame (kind and frame first, as status.ts makes it).
  const { kind: burstKind, ...rest } = b.event;
  const burst = { kind: burstKind, frame: b.frame, ...rest };
  const events = asEvents([burst], b.fromKind, b.fromCast);
  let st = { ...state, enemy: expireStatus(state.enemy, b.frame) };
  if (ctx.beforeDamage) st = runTriggers(ctx, st, events, origin, (t) => t.beforeDamage === true, false);
  st = recordStatus(ctx, st, [burst], st.enemy);
  return runTriggers(ctx, st, events, origin, ctx.beforeDamage ? (t) => !t.beforeDamage : undefined);
}
