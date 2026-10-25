// Casting a skill, ending one, jumps on a cast's timeline, a dive's jump.

import type { Build } from "../build.ts";
import { decide, evalContext, hitAvailable, type Situation } from "../damage.ts";
import { type KitHit, type KitSkill, landingFrames, type SkillTiming, type StackRequirement } from "../model.ts";
import type { BattleEvent } from "../events.ts";
import { type EvalContext, evaluate } from "../expr.ts";
import { activeAt, type ActiveBuff, buffEndedEvents, reaches } from "../buffs.ts";
import { FPS } from "../units.ts";
import { FINISHER_SP_SOURCE_TYPE } from "../constants.ts";
import type { Acting, Cast, Origin, PendingHit, PendingJump, TimelineContext, TimelineState } from "./state.ts";
import { DIVE, ENERGY, JUMP, linkValue, SP } from "./rules.ts";
import { kitSkill, panelAt, skillCosts } from "./context.ts";
import { actionSpeed, slowDown } from "./clock.ts";
import { castCooldowns, gainEnergy, rebaseCooldowns, skillSpGain, spCostAt, spGrantOf } from "./resources.ts";
import { chainAfter, windowKey } from "./timing.ts";
import { situationAt } from "./situation.ts";

/** Whether two skill lists name the same skills. */
const sameSkills = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** A cast's jumps and ends: the unconditional ones, and conditional ones whose kit condition holds at the cast. */
function castJumps(timing: SkillTiming, skill: KitSkill, ec: EvalContext, operator: string, cast: number, frame: number, scaled: (f: number) => number): PendingJump[] {
  const taken = timing.jumps.filter((j) => !j.conditional || skill.jumps?.some((k) => k.at === j.at && (k.to === undefined || k.to === j.to) && decide(k.if, ec)));
  return [
    ...taken.map((j) => ({ frame: frame + scaled(j.at), operator, cast, from: j.at, to: j.to })),
    ...timing.ends.map((e) => ({ frame: frame + scaled(e), operator, cast, from: e, to: e, end: true as const })),
  ];
}

/**
 * A cast's slow-downs along the path its jumps decided at the cast take: one
 * in a skipped segment or after the action's own end never starts, and one
 * after a jump starts that much sooner (skill frames). Event-driven jumps
 * (a trigger's `jump`) can't be foreseen here.
 */
function plannedSlowdowns(timing: SkillTiming, planned: readonly PendingJump[]): SkillTiming["slowdowns"] {
  if (planned.length === 0) return timing.slowdowns;
  const skips: { from: number; to: number }[] = [];
  for (const j of [...planned].filter((x) => !x.end).sort((a, b) => a.from - b.from)) if (!skips.some((k) => j.from > k.from && j.from < k.to)) skips.push({ from: j.from, to: j.to });
  const skipped = (x: number) => skips.some((k) => x > k.from && x < k.to);
  const end = Math.min(Infinity, ...planned.filter((x) => x.end && !skipped(x.from)).map((x) => x.from));
  return timing.slowdowns
    .filter((d) => !skipped(d.from) && d.from < end)
    .map((d) => ({ ...d, from: d.from - skips.filter((k) => k.to <= d.from).reduce((t, k) => t + (k.to - k.from), 0) }));
}

/**
 * A jump on an operator's current cast at its frame: what the cast has
 * still to do in the skipped frames doesn't happen (its own hits, delayed
 * actions, team energy, jumps; detached hits go on), what's after comes
 * that much sooner, and a buff that ends with the cast and would end in the
 * skipped frames ends now.
 */
export function takeJump(st: TimelineState, j: PendingJump): { state: TimelineState; events: BattleEvent[] } {
  const cur = st.acting[j.operator] as Acting;
  const at = j.frame;
  const length = cur.speed ? Math.round((j.to - j.from) / cur.speed) : j.to - j.from;
  const mine = (x: { readonly operator: string; readonly index: number } | undefined) => x !== undefined && x.operator === j.operator && x.index === j.cast;
  // Each list: drop what falls in the skipped frames, pull the rest in.
  const skip = <T extends { readonly frame: number }>(list: readonly T[], ownedBy: (x: T) => boolean): T[] =>
    list.flatMap((x) => (!ownedBy(x) || x.frame <= at ? [x] : x.frame < at + length ? [] : [{ ...x, frame: x.frame - length }]));
  const ending = st.buffs.filter((b) => b.owner === j.operator && b.endsWithCast === j.cast && b.expiresAt > at && b.expiresAt < at + length);
  const events: BattleEvent[] = buffEndedEvents(ending, at, false);
  return {
    state: {
      ...st,
      pending: [
        // A replayed landing pinned at its logged frame stays there (the log's time has the jumps in already).
        ...st.pending.filter((h) => h.pinned),
        ...skip(st.pending.filter((h) => !h.pinned && (!h.detached || h.launchAt === undefined)), (h) => h.operator === j.operator && h.cast === j.cast && !h.detached),
        // A detached hit not launched yet moves with its launch: dropped if the jump skips it, sooner if it comes after.
        ...st.pending
          .filter((h) => !h.pinned && h.detached && h.launchAt !== undefined)
          .flatMap((h) => (h.operator !== j.operator || h.cast !== j.cast || (h.launchAt as number) <= at ? [h] : (h.launchAt as number) < at + length ? [] : [{ ...h, frame: h.frame - length, launchAt: (h.launchAt as number) - length }])),
      ],
      pendingActions: [
        ...skip(st.pendingActions.filter((x) => x.launchAt === undefined), (x) => mine(x.cast)),
        // Launched later: moves with its launch, as a detached hit does.
        ...st.pendingActions
          .filter((x) => x.launchAt !== undefined)
          .flatMap((x) => (!mine(x.cast) || (x.launchAt as number) <= at ? [x] : (x.launchAt as number) < at + length ? [] : [{ ...x, frame: x.frame - length, launchAt: (x.launchAt as number) - length }])),
      ],
      pendingEnergy: skip(st.pendingEnergy, (x) => mine(x.cast) && !x.detached),
      pendingJumps: skip(st.pendingJumps, (x) => x.operator === j.operator && x.cast === j.cast),
      buffs: st.buffs.flatMap((b) => (ending.includes(b) ? [] : b.owner === j.operator && b.endsWithCast === j.cast && b.expiresAt >= at + length ? [{ ...b, expiresAt: b.expiresAt - length, skipped: (b.skipped ?? 0) + length }] : [b]))
        // A buff attached to the cast (whileCasting) ends with it, that much sooner.
        .map((b) => (b.whileCasting && b.cast === j.cast && b.whileCasting.until > at ? { ...b, whileCasting: { ...b.whileCasting, until: Math.max(at, b.whileCasting.until - length) } } : b)),
      acting: { ...st.acting, [j.operator]: { ...cur, skips: [...(cur.skips ?? []), { from: j.from, to: j.to, at, length }] } },
    },
    events,
  };
}

/**
 * The jump a dive starts with: it ends the operator's current action as a
 * skill's start would (a plunging attack may interrupt anything:
 * priorityOf; assumed for the jump too, as Endaxis has it), and the
 * operator is in the air (the action JUMP) until the dive's fall, its
 * start skill, `rise` frames later (when its kit has that skill), and the
 * landing `fall` frames after that; without the start skill, the landing
 * comes `rise + fall` frames after the jump. Each part happens only while
 * the one before is still the operator's current action. Assumed: the
 * jump keeps no basic-attack chain (the landing clears it).
 */
export function jumpToDive(ctx: TimelineContext, advanced: TimelineState, operator: string, dive: { readonly start?: string; readonly end: string }, frame: number): { state: TimelineState; events: BattleEvent[] } {
  const ended = endCurrentSkill(advanced, operator, frame);
  const s = ended.state;
  const index = s.casts.length;
  const start = dive.start !== undefined && ctx.kits.get(operator)?.skills.some((x) => x.skillId === dive.start) ? dive.start : undefined;
  const next: PendingJump =
    start !== undefined
      ? { frame: frame + DIVE.rise, operator, cast: index, from: 0, to: 0, then: start, landing: dive.end }
      : { frame: frame + DIVE.rise + DIVE.fall, operator, cast: index, from: 0, to: 0, then: dive.end };
  // In the cast list as the action "jump" (no cast event: nothing listens to a jump).
  const cast: Cast = { frame, operator, skill: JUMP, spAfter: s.sp, energyAfter: s.energy[operator] ?? 0 };
  const state = rebaseCooldowns(ctx, advanced, { ...s, acting: { ...s.acting, [operator]: { skill: JUMP, frame, cast: index } }, casts: [...s.casts, cast], pendingJumps: [...s.pendingJumps, next] }, frame);
  return { state, events: ended.events };
}

/**
 * Ends an operator's current skill at a frame: its hits still to land are
 * cancelled, unless already on their way (detached), and so are its
 * delayed cast-trigger actions; the buffs that end with it end (their
 * `buffEnded` events are returned).
 */
export function endCurrentSkill(advanced: TimelineState, operator: string, frame: number, keepHits = false): { state: TimelineState; events: BattleEvent[] } {
  // The current skill's cast (a skill cast beside it isn't the current one).
  const prevCast = advanced.acting[operator]?.cast ?? advanced.casts.findLastIndex((c) => c.operator === operator);
  const endsNow = advanced.buffs.filter((b) => b.owner === operator && b.endsWithCast !== undefined && b.endsWithCast === prevCast && b.expiresAt > frame);
  // A replayed cast whose logged hits go on after the next one started (replayCast keepPrevious) keeps what's to come.
  const state = keepHits ? { ...advanced, buffs: advanced.buffs.filter((b) => !endsNow.includes(b)) } : {
    ...advanced,
    pending: advanced.pending.filter((h) => !(h.operator === operator && h.cast === prevCast && h.frame > frame && (!h.detached || (h.launchAt !== undefined && h.launchAt > frame)))),
    pendingActions: advanced.pendingActions.filter((x) => !(x.cast && x.cast.operator === operator && x.cast.index === prevCast && x.frame > frame && (x.launchAt === undefined || x.launchAt > frame))),
    pendingEnergy: advanced.pendingEnergy.filter((x) => !(x.cast && !x.detached && x.cast.operator === operator && x.cast.index === prevCast && x.frame > frame)),
    pendingJumps: advanced.pendingJumps.filter((x) => !(x.operator === operator && x.cast === prevCast)),
    // A buff attached to the cast (consumedScope whileCasting) stops acting on the caster's other hits now.
    buffs: advanced.buffs.filter((b) => !endsNow.includes(b)).map((b) => (b.whileCasting && b.cast === prevCast && b.whileCasting.until > frame ? { ...b, whileCasting: { ...b.whileCasting, until: frame } } : b)),
  };
  const events: BattleEvent[] = buffEndedEvents(endsNow, frame, false);
  return { state, events };
}

/**
 * Casts a skill at a frame (the state already advanced to it): ends the
 * operator's current skill, schedules the hits, spends and grants
 * resources, and returns the cast's events for the triggers. A follow-up
 * cast (`followUp`: a skill casting another, CastSkill) costs nothing and
 * starts no cooldown.
 */
export function castSkill(ctx: TimelineContext, advanced: TimelineState, operator: string, skillId: string, frame: number, followUp: boolean, keepPrevious = false): { state: TimelineState; events: BattleEvent[]; origin: Origin } {
  const skill = kitSkill(ctx, operator, skillId);
  // Starting a skill ends the operator's current one, unless it runs beside it (KitSkill.beside).
  const beside = skill.beside !== undefined && decide(skill.beside, evalContext(ctx.data, ctx.builds.get(operator) as Build, panelAt(ctx, operator, frame), skillId, situationAt(ctx, operator, advanced, frame)));
  const ended = beside ? { state: advanced, events: [] } : endCurrentSkill(advanced, operator, frame, keepPrevious);
  const s = rebaseCooldowns(ctx, advanced, ended.state, frame);
  const endsNowEvents = ended.events;
  const full = skillCosts(ctx, operator, skillId, frame);
  // Its SP cost with the caster's cost buffs (attribute 45) as it starts.
  const costs = followUp ? { ...full, spCost: 0, energyCost: 0, cooldownFrames: 0 } : { ...full, spCost: spCostAt(ctx, advanced, operator, full, frame) };
  // Hits that need stacks happen only if the stacks are there at the cast; meeting a consuming requirement uses the stack up.
  const own = s.stacks[operator] ?? {};
  const panel = panelAt(ctx, operator, frame);
  const castSituation: Situation = {
    team: ctx.scenario.team, controlled: s.controlled, stacks: own, buffActive: (id) => s.buffs.some((b) => b.id === id && b.owner === operator && b.cast === undefined && activeAt(b, frame)),
    buffLayers: (id) => s.buffs.filter((b) => b.id === id && b.owner === operator && b.cast === undefined && activeAt(b, frame)).length,
  };
  const castIndex = s.casts.length;
  // Haste (attribute 92, KeywordSpeedUpScalar, default 1, at most 1.3): the cast plays faster (assumed; in-game test 19).
  const speed = actionSpeed(ctx, s, operator, frame);
  const scaled = (f: number) => (speed === 1 ? f : Math.round(f / speed));
  // A combo's window (its own, or its operator's; none for one cast without it): what opened it, and it's used up.
  const windowOf = costs.kind === "combo" && skill.comboWindow !== false ? windowKey(ctx, operator, skillId) : undefined;
  const windowCount = windowOf !== undefined ? s.comboWindow[windowOf]?.count : undefined;
  const windowSource = windowOf !== undefined ? s.comboWindow[windowOf]?.source : undefined;
  const inRange = (r: StackRequirement) => {
    const n = own[r.stack] ?? 0;
    return (r.atLeast === undefined || n >= r.atLeast) && (r.below === undefined || n < r.below);
  };
  const met = (h: KitHit) => hitAvailable(ctx.data, ctx.builds.get(operator) as Build, panel, skill.skillId, h, castSituation) && (!h.requires || inRange(h.requires));
  // What the happening hits use up, per stack: all of it, or the largest amount named; at the cast, or at the requiring hit.
  const castEc = evalContext(ctx.data, ctx.builds.get(operator) as Build, panel, skill.skillId, castSituation);
  const usage = new Map<string, { amount: number; atHit: string | null }>();
  for (const h of skill.hits.filter(met)) {
    const r = h.requires;
    if (!r?.consume) continue;
    const amount = r.consume === true ? Infinity : evaluate(r.consume, castEc);
    const cur = usage.get(r.stack);
    usage.set(r.stack, { amount: Math.max(cur?.amount ?? 0, amount), atHit: r.consumeAt === "hit" ? (cur?.atHit ?? h.id) : null });
  }
  const atCast = [...usage].filter(([, u]) => u.atHit === null);
  const stacks = atCast.length ? { ...s.stacks, [operator]: { ...own, ...Object.fromEntries(atCast.map(([id, u]) => [id, Math.max(0, (own[id] ?? 0) - u.amount)])) } } : s.stacks;
  const usesAtHit = (hitId: string) => [...usage].filter(([, u]) => u.atHit === hitId).map(([stack, u]) => ({ stack, amount: u.amount }));
  const pending: PendingHit[] = [];
  // A hit's `if` is judged as it lands (it may depend on what the skill itself does first); only its stack requirement is the cast's.
  // A count that's a value is judged here, before the cast uses stacks up.
  const countEc = () => evalContext(ctx.data, ctx.builds.get(operator) as Build, panel, skill.skillId, { ...situationAt(ctx, operator, s, frame), ...castSituation });
  for (const h of skill.hits.filter((x) => !x.requires || inRange(x.requires))) {
    const frames = typeof h.count === "number" ? (h.frames ?? Array.from({ length: h.count }, () => 0)) : landingFrames(h, evaluate(h.count, countEc()));
    frames.forEach((f, i) =>
      pending.push({
        frame: frame + scaled(f), operator, skillId: skill.skillId, hitId: h.id, sp: 0, controlledAtCast: s.controlled, cast: castIndex,
        ...(usesAtHit(h.id).length && i === 0 ? { usesUp: usesAtHit(h.id) } : {}), ...(h.detached || h.launch !== undefined ? { detached: true } : {}),
        ...(h.launch !== undefined ? { launchAt: frame + scaled(h.launch) } : {}),
        ...(windowCount !== undefined ? { eventCount: windowCount } : {}), ...(windowSource ? { eventSource: windowSource } : {}), ...(h.branch ? { branch: `${castIndex}:${h.branch}:${i}` } : {}),
      }),
    );
  }
  // A skill whose kit names the hit that returns SP gets it there, not on its first hit; a finisher also gets the enemy's finisher SP (GainBreakingAttackAtb).
  const finisherSp = full.timing.specification === 8 && !followUp ? ctx.enemy.finisherSp : 0;
  const ownGain = skill.hits.some((h) => h.sp !== undefined) ? 0 : skillSpGain(ctx, operator, skillId);
  const spGain = ownGain + finisherSp;
  if (spGain > 0 && pending.length > 0) {
    const first = pending.reduce((a, b) => (b.frame < a.frame ? b : a));
    // The skill's `atb` is of the kind its data gives; a finisher's SP (GainBreakingAttackAtb, atbGainMethod 0) is natural.
    const atb = spGrantOf(ctx, skillId, "atb");
    const spKind = ownGain > 0 ? atb.kind : "natural";
    // Its atbSourceType likewise: the `atb` key's, a finisher's 0.
    const spSource = ownGain > 0 ? atb.sourceType : FINISHER_SP_SOURCE_TYPE;
    pending[pending.indexOf(first)] = { ...first, sp: spGain, spKind, ...(spSource !== undefined ? { spSource } : {}) };
  }
  // Returned SP is spent first; only the natural part gives the team ultimate energy.
  const natural = Math.max(0, costs.spCost - s.spReturned);
  let next: TimelineState = { ...s, spReturned: Math.max(0, s.spReturned - costs.spCost) };
  if (natural > 0) {
    // A cast beside the current action plays no timeline (the game runs its switchToBuffConfig buff instead, which
    // creates buff_common_obtain_ultimate_sp as it starts: Last Rite's _inattack), so its team energy comes at the cast.
    if (skill.teamEnergy === undefined || beside) for (const b of ctx.scenario.team) next = gainEnergy(ctx, next, b.operator, natural * ENERGY.perNaturalSp, frame);
    else
      for (const part of skill.teamEnergy) {
        const at = frame + scaled(part.frame);
        const grants = ctx.scenario.team.map((b) => ({ frame: at, operator: b.operator, amount: natural * ENERGY.perNaturalSp * part.ratio, cast: { operator, index: castIndex }, ...(part.detached ? { detached: true } : {}), ...(part.if ? { if: part.if } : {}) }));
        next = { ...next, pendingEnergy: [...next.pendingEnergy, ...grants] };
      }
  }
  if (costs.energyCost > 0) next = { ...next, energy: { ...next.energy, [operator]: Math.max(0, (next.energy[operator] ?? 0) - costs.energyCost) } };
  if (skill.energyBlockSeconds) next = { ...next, energyBlockedUntil: { ...next.energyBlockedUntil, [operator]: frame + Math.round(skill.energyBlockSeconds * FPS) } };
  if (!followUp && windowOf !== undefined && next.comboWindow[windowOf]) {
    const { [windowOf]: _used, ...rest } = next.comboWindow;
    next = { ...next, comboWindow: rest };
  }
  // Link (buff_common_affixes_combo_trigger → skillimbue_atk): stacks a kit gives the team (trigger action `link`: the data's
  // ComboAction, not every combo; batch 4, Lifeng G2 and Camille G2, from the data and five logs); the next battle skill or
  // ultimate, by anyone, uses all of them (at most 4) for its own hits: +30/45/60/75% / +20/30/40/50%.
  const linkEnded: BattleEvent[] = [];
  let linkUsed = 0;
  if (!followUp) {
    const live = next.link.filter((f) => f > frame);
    // Kit buffs that count as a Link stack (KitBuff.link) for the caster, used up with the combo stacks.
    const linkBuffs = next.buffs.filter((b) => b.link && b.cast === undefined && reaches(b, operator) && activeAt(b, frame));
    if ((costs.kind === "battle" || costs.kind === "ultimate") && live.length + linkBuffs.length > 0) {
      const n = Math.min(4, live.length + linkBuffs.length);
      linkUsed = n;
      if (linkBuffs.length) {
        next = { ...next, buffs: next.buffs.filter((b) => !linkBuffs.includes(b)) };
        linkEnded.push(...buffEndedEvents(linkBuffs, frame, true));
      }
      const value = linkValue(costs.kind, n);
      const lastHit = Math.max(frame, ...pending.map((h) => h.frame));
      const link: ActiveBuff = { id: "link", owner: operator, target: "self", appliedAt: frame, expiresAt: lastHit + 1, cast: castIndex, modifiers: [{ zone: "multiplicative", value, source: `Link (${n})` }] };
      next = { ...next, link: [], buffs: [...next.buffs, link] };
    } else if (live.length !== next.link.length) next = { ...next, link: live };
  }
  // Buffs this cast consumes (Jade Vessel's, …) now act on its hits only, until its last hit; one attached to the cast
  // (KitBuff.consumedScope whileCasting) also on every hit of the caster until the cast ends (endCurrentSkill cuts it short).
  const consumedBuffs = next.buffs.filter((b) => b.cast === undefined && b.consumedBy?.includes(costs.kind) && reaches(b, operator) && activeAt(b, frame));
  if (consumedBuffs.length) {
    const lastHit = Math.max(frame, ...pending.map((h) => h.frame));
    const castEnd = frame + scaled(full.timing.durationFrames);
    const scopeOf = (b: ActiveBuff) => ctx.kits.get(b.owner)?.buffs.find((x) => x.id === b.id)?.consumedScope;
    next = {
      ...next,
      buffs: [
        ...next.buffs.filter((b) => !consumedBuffs.includes(b)),
        ...consumedBuffs.map((b) => (scopeOf(b) === "whileCasting" ? { ...b, cast: castIndex, appliedAt: frame, expiresAt: Math.max(lastHit + 1, castEnd), whileCasting: { operator, until: castEnd } } : { ...b, cast: castIndex, appliedAt: frame, expiresAt: lastHit + 1 })),
      ],
    };
  }
  // A conditional jump reads the situation at the cast, the enemy's state included (Arclight's battle skill on an Electrified target).
  const jumpEc = evalContext(ctx.data, ctx.builds.get(operator) as Build, panel, skill.skillId, { ...situationAt(ctx, operator, s, frame), ...castSituation, castLink: linkUsed });
  const planned = castJumps(full.timing, skill, jumpEc, operator, castIndex, frame, scaled);
  // Its conditional windows open at this cast (KitSkill.windows), judged as its jumps are.
  const openWindows = full.timing.windows.flatMap((w, i) => (w.conditional && skill.windows?.some((k) => k.from === w.from && (k.skills === undefined || sameSkills(k.skills, w.skills)) && (!k.if || decide(k.if, jumpEc))) ? [i] : []));
  const cast: TimelineState = {
    ...next,
    sp: s.sp - costs.spCost,
    // A spend never shortens a pause running longer (one a slow-down lengthened).
    spPausedUntil: costs.spCost > 0 ? Math.max(s.spPausedUntil, frame + SP.pauseAfterSpendFrames) : s.spPausedUntil,
    acting: beside ? s.acting : { ...s.acting, [operator]: { skill: skillId, frame, cast: castIndex, ...(speed !== 1 ? { speed } : {}), ...(openWindows.length ? { windows: openWindows } : {}) } },
    pendingJumps: beside ? next.pendingJumps : [...next.pendingJumps, ...planned],
    ...(full.timing.specification === 8 ? { stagger: { ...s.stagger, finisherUsed: true } } : {}),
    chainNext: beside ? next.chainNext : chainAfter(ctx, next, operator, skill, frame, speed, openWindows),
    readyAt: castCooldowns(ctx, next.readyAt, operator, skill, costs.cooldownFrames, frame, s.buffs),
    ...(skill.takesControl ? { controlled: operator } : {}),
    pending: [...s.pending, ...pending],
    stacks,
    casts: [...s.casts, { frame, operator, skill: skillId, spAfter: s.sp - costs.spCost, energyAfter: next.energy[operator] ?? 0, ...(linkUsed > 0 ? { link: linkUsed } : {}) }],
  };
  const castEvent: BattleEvent = {
    type: "cast", frame, operator, skillId, kind: costs.kind, finisher: full.timing.specification === 8, controlled: s.controlled === operator, cast: castIndex,
    ...(windowCount !== undefined ? { count: windowCount } : {}), ...(followUp ? { followUp: true } : {}), ...(beside ? { beside: true } : {}),
  };
  const endedEvents: BattleEvent[] = buffEndedEvents(consumedBuffs, frame, true);
  // Buffs the cast used up (Link, consumed ones) may have set a combo's recovery rate.
  const spent = rebaseCooldowns(ctx, { ...cast, buffs: s.buffs }, cast, frame);
  return { state: slowDown(ctx, spent, operator, { ...costs.timing, slowdowns: plannedSlowdowns(costs.timing, planned) }, frame), events: [...endsNowEvents, castEvent, ...endedEvents, ...linkEnded], origin: { operator, kind: costs.kind } };
}
