// The stepping API's drivers: init, apply, a logged cast's replay, simulate, and helpers for the search.

import type { Build } from "../build.ts";
import { evalContext } from "../damage.ts";
import { EngineError } from "../errors.ts";
import type { GameData, KitHit, KitSkill } from "../model.ts";
import type { KitTrigger } from "../events.ts";
import { evaluate } from "../expr.ts";
import { NO_STATUS } from "../status.ts";
import { type DamageMoments, hitsMoments } from "../moments.ts";
import { FPS } from "../units.ts";
import type { Cast, LandedHit, PendingEnemyAction, PendingHit, PendingJump, ReactionRecord, RotationAction, TimelineContext, TimelineScenario, TimelineState } from "./state.ts";
import { SP, TIMELINE_ASSUMPTIONS } from "./rules.ts";
import { createContext, enemyActionsOf, kitSkill, maxPoise, panelAt, skillCosts } from "./context.ts";
import { maxEnergy, spAt, spCostAt } from "./resources.ts";
import { afterCantCast, earliestStart, needsWindow, startFrom, windowKey, windowOpen } from "./timing.ts";
import { runTriggers } from "./actions.ts";
import { castSkill, jumpToDive } from "./casting.ts";
import { advance } from "./advance.ts";
import { ofCast, ofKind, schedule } from "./schedule.ts";
import { teammateStart } from "./teammates.ts";

export function init(ctx: TimelineContext): TimelineState {
  const st = initialState(ctx);
  return runTriggers(ctx, st, [{ type: "fightStart", frame: 0, operator: st.controlled }], null);
}

function initialState(ctx: TimelineContext): TimelineState {
  const controlled = ctx.scenario.controlled ?? (ctx.scenario.team[0] as Build).operator;
  if (!ctx.builds.has(controlled)) throw new EngineError(`controlled operator ${controlled} isn't in the team`);
  return {
    frame: 0,
    rng: {},
    sp: SP.start,
    spReturned: 0,
    energy: Object.fromEntries(ctx.scenario.team.map((b) => {
      const v = ctx.scenario.startEnergy?.[b.operator] ?? 0;
      return [b.operator, v === "full" ? maxEnergy(ctx, b.operator) : Math.min(v, maxEnergy(ctx, b.operator))];
    })),
    energyBlockedUntil: {},
    energyOverflow: {},
    energyGained: {},
    energySpent: {},
    spOverflow: 0,
    comboWindow: {},
    comboTrigger: {},
    spPausedUntil: 0,
    controlled,
    acting: {},
    chainNext: {},
    readyAt: {},
    // The enemy's actions, in frame order (attacks before charges at one frame), on its clock; teammates' own attacks.
    scheduled: [
      ...enemyActionsOf(ctx.scenario).map((a): PendingEnemyAction => ({ kind: "enemyAction", frame: a.frame, clock: "enemy", act: a.kind, target: a.target, element: a.element })),
      ...(ctx.scenario.options.teammateAttacks ? ctx.scenario.team.filter((b) => b.operator !== controlled).map((b) => teammateStart(b.operator, 0)) : []),
    ],
    slowdowns: [],
    stagger: { poise: maxPoise(ctx), until: null, finisherUsed: false },
    enemyFrozenUntil: 0,
    enemyFrozenBy: {},
    link: [],
    enemy: NO_STATUS,
    buffs: [],
    triggerState: {},
    stacks: Object.fromEntries(ctx.scenario.team.map((b) => [b.operator, startStacks(ctx, b)])),
    casts: [],
    hits: [],
    reactions: [],
  };
}

/** An operator's stacks at the start: the scenario's, else the kit's `initial` (0 when absent), within each stack's maximum. */
function startStacks(ctx: TimelineContext, b: Build): Record<string, number> {
  const panel = panelAt(ctx, b.operator, 0);
  const given = ctx.scenario.startStacks?.[b.operator] ?? {};
  const out: Record<string, number> = {};
  for (const x of ctx.kits.get(b.operator)?.stacks ?? []) {
    const v = given[x.id] ?? (x.initial === undefined ? 0 : evaluate(x.initial, evalContext(ctx.data, b, panel, "", { team: ctx.scenario.team })));
    out[x.id] = Math.max(0, Math.min(x.max, v));
  }
  for (const id of Object.keys(given)) if (!(id in out)) throw new EngineError(`startStacks: ${b.operator} has no stack ${id}`);
  return out;
}

/** Applies one rotation action at its earliest legal frame. Throws if it can't happen. */
export function apply(ctx: TimelineContext, state: TimelineState, action: RotationAction): TimelineState {
  const start = earliestStart(ctx, state, action);
  if ("error" in start) throw new EngineError(`frame ${state.frame}: ${action.operator} ${action.skill}: ${start.error}`);
  const advanced = advance(ctx, state, start.frame);
  if (action.skill === "swap") {
    // The operator left starts attacking on its own (teammates.ts).
    const left = advanced.controlled;
    const swapped = { ...advanced, controlled: action.operator };
    return ctx.scenario.options.teammateAttacks ? schedule(swapped, [teammateStart(left, start.frame)]) : swapped;
  }
  const dive = ctx.data.operators[action.operator]?.dive;
  if (dive?.end === action.skill) {
    const j = jumpToDive(ctx, advanced, action.operator, dive, start.frame);
    return runTriggers(ctx, j.state, j.events, null);
  }
  const r = castSkill(ctx, advanced, action.operator, action.skill, start.frame, false);
  return runTriggers(ctx, r.state, r.events, r.origin);
}

/**
 * A logged cast replayed (the log checker's kit-buff replay, cli
 * buffreplay.ts): the skill starts at exactly `frame`, where the log places
 * it, without a rotation's checks (cooldowns, combo windows, priorities,
 * energy: the game allowed it). SP below its cost is raised to the cost
 * first, so the team's SP doesn't go negative; a basic attack or a dive
 * makes its operator the controlled one (not a `teammate`'s own attack).
 * The rest is a cast as `apply` makes it: its hits, what they do, and the
 * triggers they start.
 */
export function replayCast(ctx: TimelineContext, state: TimelineState, operator: string, skillId: string, frame: number, opts: ReplayCastOptions = {}): TimelineState {
  if (!ctx.builds.has(operator)) throw new EngineError(`${operator} isn't in the team`);
  let advanced = advance(ctx, state, frame);
  const costs = skillCosts(ctx, operator, skillId, frame);
  if (!opts.teammate && (costs.kind === "basic" || costs.timing.specification === 6)) advanced = { ...advanced, controlled: operator };
  const cost = spCostAt(ctx, advanced, operator, costs, frame);
  if (advanced.sp < cost) advanced = { ...advanced, sp: cost };
  // A combo the log shows had its window open: one opened by an event the replay didn't see counts 1 (its count isn't logged).
  const skill = kitSkill(ctx, operator, skillId);
  if (costs.kind === "combo" && skill.comboWindow !== false) {
    const key = windowKey(ctx, operator, skillId);
    if (!windowOpen(advanced, operator, key, frame)) advanced = { ...advanced, comboWindow: { ...advanced.comboWindow, [key]: { from: frame, until: frame + 1, count: 1 } } };
  }
  const index = advanced.casts.length;
  // The cast's chance jumps the log decides (opts.chanceJumps): not rolled; a taken one's jump scheduled below.
  const decided = opts.chanceJumps ? chanceJumpsOf(ctx.kits.get(operator)?.triggers ?? [], skillId).filter((c) => opts.chanceJumps?.[c.trigger] !== undefined).map((c) => ({ ...c, taken: opts.chanceJumps?.[c.trigger] === true })) : [];
  // Inside its operator's own cantCastSkill channel the game couldn't have cut the running cast: its hits and actions
  // stand (dbaee23b801d: a hit of Xaihi's attack 1 placed 0.45 s into her ultimate, whose Amp comes at frame 58).
  // A logged cast after which the previous one's logged hits go on keeps what that one had to come, but the follow-ups its
  // timeline would cast (bdf223db8e49: Typhoeus's shot 3 cuts the loop shot 2 started, whose landing at its frame 27 would
  // end her hover).
  const keepPrevious = afterCantCast(ctx, advanced, operator, frame, costs.kind) > frame ? true : opts.keepPrevious === true ? ("uncast" as const) : false;
  const r = castSkill(ctx, advanced, operator, skillId, frame, false, keepPrevious);
  let st = r.state;
  // A cast that hit nothing: its own hits never land, so nothing they do happens (damage, Stagger, SP, inflictions, the
  // stacks and energy they give, the triggers on them); what the cast does as it starts still does (its costs, the stacks
  // it uses up at the cast, its on-cast triggers and follow-ups).
  if (opts.missed) st = { ...st, scheduled: st.scheduled.filter((h) => h.kind !== "hit" || !ofCast(h, operator, index) || h.trigger !== undefined || h.skillId !== skillId) };
  else if (opts.landings?.length) {
    const landings = chancePathLandings(skill, decided, controlPathLandings(skill, ofKind(st.scheduled, "jump").filter((j) => !j.end && ofCast(j, operator, index)), opts.landings));
    // The cast's own landings of each kit hit, in frame order: the n-th moves to its logged frame.
    const own = new Map<string, PendingHit[]>();
    for (const h of ofKind(st.scheduled, "hit")) if (ofCast(h, operator, index) && !h.trigger && h.skillId === skillId) own.set(h.hitId, [...(own.get(h.hitId) ?? []), h]);
    for (const list of own.values()) list.sort((a, b) => a.frame - b.frame);
    const moved = new Map<PendingHit, { frame: number; ref?: string; loggedMs?: number }>();
    for (const l of landings) {
      const h = own.get(l.hitId)?.[l.nth];
      if (h) moved.set(h, { frame: Math.max(frame, l.frame), ...(l.ref !== undefined ? { ref: l.ref } : {}), ...(l.ms !== undefined && l.frame >= frame ? { loggedMs: l.ms } : {}) });
    }
    // A pinned landing was launched by its logged frame (a detached one's launch, KitHit.launch, is on the kit's timeline, which jumps shorten).
    // A delayed hit's logged frame is its damage's (KitHit.enemyDelay): its landing stays at its kit frame.
    const delayed = new Set(skill.hits.filter((h) => h.enemyDelay !== undefined).map((h) => h.id));
    const pin = (h: PendingHit, m: { frame: number; ref?: string; loggedMs?: number }): PendingHit =>
      delayed.has(h.hitId)
        ? { ...h, damageFrame: Math.max(m.frame, h.frame), ...(m.ref !== undefined ? { ref: m.ref } : {}) }
        : { ...h, ...m, pinned: true, ...(h.launchAt !== undefined ? { launchAt: Math.min(h.launchAt, m.frame) } : {}) };
    // A hit with a random landed count (KitHit.landedCount) lands as often as the log shows: its other planned landings
    // didn't (5082ceaffad1: 10 of Ardelia's 14 sheep). Not one that carries SP or uses stacks up.
    const random = new Set(skill.hits.filter((h) => h.landedCount !== undefined).map((h) => h.id));
    const unlanded = new Set([...own].filter(([id]) => random.has(id)).flatMap(([, list]) => list.filter((h) => !moved.has(h) && h.sp === 0 && !h.usesUp)));
    // A jump of the cast that would skip a landing the log shows wasn't taken (its condition read otherwise in the game):
    // it goes, and with it the landings of the path it would have jumped to, which the cast didn't play (Rossi's
    // sequence 2: its perfect hit logged 14 frames after the late path's landing, d5720d9ceb94 39.23 s and 489c0be3e162
    // 19.73 s; both landed, the late one consuming the infliction the perfect one's Lift and extra Vulnerable need).
    // Only where the landing is the skipped part's own: a kit hit with no landing past the jump's target (a hit that
    // lands on both paths, Pogranichnik's combo slashes at 23 / 223, may have been the jumped path's, the placement
    // matching it by kit frame).
    const contradicted = ofKind(st.scheduled, "jump").filter((j) => {
      if (j.end || !ofCast(j, operator, index)) return false;
      // A jump in the part a taken chance jump skips is never reached: the landings past it are that path's.
      if (decided.some((c) => c.taken && j.frame - frame >= c.at && j.frame - frame < c.to)) return false;
      const target = j.frame + (j.to - j.from);
      const skipped = [...moved.keys()].filter((h) => h.frame >= j.frame && h.frame < target);
      const drop = skipped.length > 0 && skipped.every((h) => !(own.get(h.hitId) ?? []).some((x) => x.frame >= target));
      // Record only (the log check's JUMPDROP lines): which jump went, and the logged landings it would have skipped.
      if (drop && opts.dropped) opts.dropped({ frame: j.frame, from: j.from, to: j.to }, skipped.map((h) => ({ hitId: h.hitId, frame: (moved.get(h) as { frame: number }).frame })));
      return drop;
    });
    const jumpedTo = new Set(contradicted.flatMap((j) => [...own.values()].flat().filter((h) => !moved.has(h) && h.frame >= j.frame + (j.to - j.from))));
    const taken = eventJumps(ctx, st, operator, skillId, index, frame, moved);
    st = { ...st, scheduled: [...st.scheduled.filter((h) => !(h.kind === "jump" && contradicted.includes(h)) && (h.kind !== "hit" || (!unlanded.has(h) && !jumpedTo.has(h)))).map((h) => { const m = h.kind === "hit" ? moved.get(h) : undefined; return m && h.kind === "hit" ? pin(h, m) : h; }), ...taken] };
  }
  if (opts.endsAt !== undefined && opts.endsAt > frame) {
    const end: PendingJump = { kind: "jump", frame: opts.endsAt, clock: { operator }, cast: { operator, index }, operator, from: opts.endsAt - frame, to: opts.endsAt - frame, end: true, pinned: true };
    // Its hits after the end don't land, detached ones too: the cut says none of them is in the log, which records every
    // landing (c83c75d02a85: Si's combo final at 56.73 s, an ability entity's detached hit, 374k the log never shows).
    const endsAt = opts.endsAt;
    st = schedule({ ...st, scheduled: st.scheduled.filter((x) => !(x.kind === "hit" && !x.pinned && ofCast(x, operator, index) && x.frame > endsAt)) }, [end]);
  }
  // A taken chance jump at its trigger's frame (its delay, within the jump's frames), on the cast's clock as the
  // trigger's delayed action would be; a decided one's trigger doesn't run on the cast (no roll).
  const takenJumps: PendingJump[] = decided.filter((c) => c.taken).map((c) => ({ kind: "jump", frame: frame + c.at, clock: { operator }, cast: { operator, index }, operator, from: c.at, to: c.to }));
  if (takenJumps.length) st = schedule(st, takenJumps);
  const decidedIds = new Set(decided.map((c) => c.trigger));
  return runTriggers(ctx, st, r.events, r.origin, decidedIds.size ? (t) => !decidedIds.has(t.id) : undefined);
}

/**
 * A skill's chance jumps (ReplayCastOptions.chanceJumps): its operator's kit triggers on its own cast of the skill with
 * a `chance` whose actions are a jump on the skill, each with the skill frame it jumps at (its delay, within the jump's
 * frames) and to. Alesh's Rare Fin (rare_fin: combo frame 10 → 65, its chance from her Intellect).
 */
export function chanceJumpsOf(triggers: readonly KitTrigger[], skillId: string): { readonly trigger: string; readonly at: number; readonly to: number }[] {
  return triggers.flatMap((t) => {
    if (t.chance === undefined || t.on.event !== "cast" || t.by !== "self" || !(t.on.skills ?? []).includes(skillId) || t.do.length !== 1) return [];
    const a = t.do[0];
    if (a?.kind !== "jump" || a.skill !== skillId) return [];
    const at = Math.max(t.delay ?? 0, a.from);
    return at < a.until && a.to > at ? [{ trigger: t.id, at, to: a.to }] : [];
  });
}

/**
 * A replayed cast's logged landings on the path its decided chance jumps took (replayCast, ReplayCastOptions.chanceJumps):
 * a kit hit in the part a chance jump skips and one with the same keys the jump's length later are one logged hit on either
 * path (Alesh's combo: hook 22 and slam 38 on the normal path, hook_ex 77 and slam_ex 93 after the Rare Fin jump 10 → 65,
 * the same frames from the cast's start), so the landings of the two go to the path's hit, in frame order (as
 * controlPathLandings does for a jump on control). Not when the cast has more such landings than the path's hit lands.
 */
function chancePathLandings(skill: KitSkill, decided: readonly { readonly at: number; readonly to: number; readonly taken: boolean }[], landings: NonNullable<ReplayCastOptions["landings"]>): NonNullable<ReplayCastOptions["landings"]> {
  let out = [...landings];
  const frames = (h: KitHit) => h.frames ?? [];
  for (const c of decided) {
    const skipped = skill.hits.filter((h) => frames(h).length > 0 && frames(h).every((f) => f >= c.at && f < c.to));
    const by = c.to - c.at;
    for (const a of skipped) {
      // Its hit on the other path: the same keys at the same frames from the cast's start (its frames the jump's length later).
      const b = skill.hits.find((x) => x !== a && frames(x).length === frames(a).length && frames(a).every((f, i) => frames(x)[i] === f + by) && x.events.length === a.events.length && x.events.every((e) => a.events.includes(e)));
      if (!b) continue;
      const path = c.taken ? b : a;
      const mine = out.filter((l) => l.hitId === a.id || l.hitId === b.id).sort((x, y) => x.frame - y.frame);
      if (mine.every((l) => l.hitId === path.id) || mine.length > frames(path).length) continue;
      const renamed = new Map(mine.map((l, i) => [l, { ...l, hitId: path.id, nth: i }]));
      out = out.map((l) => renamed.get(l) ?? l);
    }
  }
  return out;
}

/**
 * A replayed cast's logged landings on the path its jumps on control took (replayCast): a kit jump whose condition is
 * whether its operator is controlled (Rossi's attack 4: not controlled, it jumps 0 → 189 to hit_ai, × 0.5 a hit
 * against the controlled path's × 0.2) is decided by who the log shows controlled (the log check's controlledFromLog:
 * a teammate's own attack keeps the controlled operator), so a landing the placement gave a kit hit of the other path
 * goes to this path's hit of the same keys, the landings of the two in frame order. The placement matches the two by
 * their frames, which are the same after the jump (6, 8, 13, 15, 23 and 195, 198, 203, 205, 213), and the replay
 * dropped the jump the landing contradicted: 0c14fb3ce77d's attack 4 at 154.09 and 174.33 s while Si and the
 * Endministrator were controlled, 2fd915292bb7's and 99fb3c35fda2's under Mi Fu, all × 2.5 the controlled path's.
 * Not when the cast has more such landings than the path's hit lands (d5720d9ceb94's at 7.91 s: 7 landings placed in
 * one 5-hit cast, the last two as hit_ai with Rossi controlled, × 0.4). Other jumps stay as the landings show (Rossi's
 * sequence 2).
 */
function controlPathLandings(skill: KitSkill, taken: readonly PendingJump[], landings: NonNullable<ReplayCastOptions["landings"]>): NonNullable<ReplayCastOptions["landings"]> {
  let out = [...landings];
  for (const k of skill.jumps ?? []) {
    if (k.to === undefined || !JSON.stringify(k.if ?? null).includes('"controlled"')) continue;
    const to = k.to;
    const jumped = taken.some((j) => j.from === k.at && j.to === to);
    const frames = (h: KitHit) => h.frames ?? [];
    const skipped = skill.hits.filter((h) => frames(h).length > 0 && frames(h).every((f) => f >= k.at && f < to));
    const target = skill.hits.filter((h) => frames(h).length > 0 && frames(h).every((f) => f >= to));
    for (const a of skipped) {
      const b = target.find((x) => x.events.length === a.events.length && x.events.every((e) => a.events.includes(e)));
      if (!b) continue;
      const path = jumped ? b : a;
      const mine = out.filter((l) => l.hitId === a.id || l.hitId === b.id).sort((x, y) => x.frame - y.frame);
      if (mine.every((l) => l.hitId === path.id) || mine.length > frames(path).length) continue;
      const renamed = new Map(mine.map((l, i) => [l, { ...l, hitId: path.id, nth: i }]));
      out = out.map((l) => renamed.get(l) ?? l);
    }
  }
  return out;
}

/**
 * The jumps a replayed cast's logged landings show its triggers took (replayCast): an end of the cast that would drop a
 * landing the log shows wasn't reached, because a kit trigger's `jump` on the skill to past that end was taken on an
 * event the replay doesn't see (Snowshine's battle skill: attacked in frames 0–51, the counter jumps to 107; not
 * attacked, it ends at 106, before its bash at 125: 04d401ad257e's six bashes with the Solidification they cause, and
 * the Shatters after, dropped wherever no later cast of hers kept them). Each is taken at the frame that puts the first
 * such landing at its kit frame after the jump, within the trigger's frames; the landings stay at their logged frames.
 */
function eventJumps(ctx: TimelineContext, st: TimelineState, operator: string, skillId: string, index: number, frame: number, moved: ReadonlyMap<PendingHit, { readonly frame: number }>): PendingJump[] {
  const jumps = (ctx.kits.get(operator)?.triggers ?? []).flatMap((t) => t.do.flatMap((a) => (a.kind === "jump" && a.skill === skillId ? [a] : [])));
  if (jumps.length === 0) return [];
  const out: PendingJump[] = [];
  for (const end of ofKind(st.scheduled, "jump").filter((j) => j.end && ofCast(j, operator, index))) {
    const cut = [...moved].filter(([, m]) => m.frame > end.frame).sort((a, b) => a[1].frame - b[1].frame);
    const first = cut[0];
    if (!first) continue;
    const kitFrame = first[0].frame - frame;
    const a = jumps.find((x) => x.to > end.from && cut.every(([h]) => h.frame - frame >= x.to));
    if (!a) continue;
    const at = Math.min(frame + a.until - 1, Math.max(frame + a.from, first[1].frame - (kitFrame - a.to)));
    out.push({ kind: "jump", frame: at, clock: { operator }, cast: { operator, index }, operator, from: at - frame, to: a.to });
    break;
  }
  return out;
}

/** How a logged cast is replayed (replayCast). */
export interface ReplayCastOptions {
  /** The operator's current skill keeps its hits still to come (the log shows them landing after this cast started). */
  readonly keepPrevious?: boolean;
  /**
   * Landings at their logged frames: the `nth` landing (0: the first, in frame order) of the cast's kit hit `hitId` lands at `frame`;
   * with `ref`, its LandedHit carries the reference and its facts (LandingFacts).
   */
  readonly landings?: readonly { readonly hitId: string; readonly nth: number; readonly frame: number; readonly ref?: string; readonly ms?: number }[];
  /** A teammate's own basic attack (the log shows someone else controlled): the controlled operator stays. */
  readonly teammate?: boolean;
  /**
   * A cast that hit nothing (its hits aren't in the log, the enemy out of reach: the log check's inferred missed shots,
   * cli replayrun.ts missedCasts): its own hits are dropped as it's cast.
   */
  readonly missed?: boolean;
  /**
   * The cast ends at this frame (pinned: no stop or jump moves it), if it's still its operator's current action then:
   * a cut the log shows and no input does (the log check's unlogged tails, packages/logs replayrun.ts tailCuts: none of
   * the cast's landings after its last logged one is in the log, the enemy there). Its hits after it don't land,
   * detached ones too (none is in the log); its other detached actions go on.
   */
  readonly endsAt?: number;
  /**
   * Told of each kit jump the cast's logged landings contradicted, which the replay drops (above: the jump's frame, its
   * from and to on the cast's timeline, and the pinned landings in the part it would have skipped, at their logged
   * frames). Record only: nothing the cast does depends on it (0c14-and-operator-curve report point 2: a shared key's
   * path read off an operator's odd ratio, the jump's drop silent).
   */
  readonly dropped?: (jump: { readonly frame: number; readonly from: number; readonly to: number }, landings: readonly { readonly hitId: string; readonly frame: number }[]) => void;
  /**
   * The outcome of the cast's chance jumps the log shows (chanceJumpsOf: by trigger id, taken or not), instead of a
   * roll: a taken one jumps at its frame, and the logged landings go to its path's hits (chancePathLandings). The log
   * check reads it from the listing (packages/logs castassembly.ts listedPaths: Alesh's Rare Fin, whose P3 team ATK
   * the log lists from the slam's landing).
   */
  readonly chanceJumps?: Readonly<Record<string, boolean>>;
}

/** The count of the combo window a replayed combo would use at a frame (the state advanced to it), or null when none is open (replayCast then opens one, counting 1). */
export function replayWindowCount(ctx: TimelineContext, state: TimelineState, operator: string, skillId: string, frame: number): number | null {
  const skill = kitSkill(ctx, operator, skillId);
  if (skill.kind !== "combo" || skill.comboWindow === false) return null;
  const key = windowKey(ctx, operator, skillId);
  return windowOpen(state, operator, key, frame) ? (state.comboWindow[key]?.count ?? 1) : null;
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
  /**
   * This battle's total as a distribution over what's still random in it and changes nothing later (moments.ts
   * hitsMoments): expected crits' outcomes and random landed counts. Its mean is `total`. With rolled, never or always
   * crits (and hits a `distribution` battle rolls) all mass is at their values. For the fight's distribution over
   * what changes later too (dodges, chances, crit-triggered effects) and its true bounds: simulateDistribution.
   */
  readonly moments: DamageMoments;
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
    moments: { ...hitsMoments(state.hits), mean: total },
  };
}

/** How a rotation's total damage varies over battles with rolled crits. */
export interface RunSpread {
  readonly runs: number;
  /** The first run's seed; run i has seed + i. */
  readonly seed: number;
  readonly totals: readonly number[];
  readonly mean: number;
  /** Standard deviation of the totals (over the runs, not an estimate of the population's). */
  readonly sd: number;
  readonly min: number;
  readonly max: number;
  /** Nearest-rank percentiles of the totals. */
  readonly p5: number;
  readonly p50: number;
  readonly p95: number;
}

/** Runs a recorded rotation `runs` times with rolled crits, each with its own seed, for the spread of its damage. */
export function simulateRuns(data: GameData, scenario: TimelineScenario, runs: number, seed = scenario.options.seed ?? 1): RunSpread {
  if (!Number.isInteger(runs) || runs < 1) throw new EngineError(`runs must be a whole number ≥ 1, not ${runs}`);
  const totals = Array.from({ length: runs }, (_, i) => simulate(data, { ...scenario, options: { ...scenario.options, crit: "rolled", seed: (seed + i) >>> 0 } }).total);
  const mean = totals.reduce((a, b) => a + b, 0) / runs;
  const sorted = [...totals].sort((a, b) => a - b);
  const rank = (p: number) => sorted[Math.max(0, Math.ceil(p * runs) - 1)] as number;
  return {
    runs, seed, totals, mean,
    sd: Math.sqrt(totals.reduce((a, t) => a + (t - mean) ** 2, 0) / runs),
    min: sorted[0] as number, max: sorted[runs - 1] as number,
    p5: rank(0.05), p50: rank(0.5), p95: rank(0.95),
  };
}

// --- Helpers for search drivers (rotation search, search.ts) -----------------
//
// startsNow: whether an action can start at the state's own frame, i.e.
// earliestStart(…).frame === state.frame, without judging how much later it
// could start. At a decision point at the state's frame a later start isn't
// a choice, and judging it is most of the search's time (earliestStart
// replays the fight to when the current action ends; a combo waits for a
// window). Exact: earliestStart returns startFrom's frame when it's the
// state's own, and otherwise a later frame or an error; startFrom only ever
// moves the frame later, so a cooldown still running, too little SP, or a
// combo whose window isn't open at the state's frame means later.
export function startsNow(ctx: TimelineContext, state: TimelineState, action: RotationAction): boolean {
  if (action.at !== undefined && action.at > state.frame) return false;
  if (action.skill !== "swap" && ctx.builds.has(action.operator)) {
    let costs;
    try {
      costs = skillCosts(ctx, action.operator, action.skill, state.frame);
    } catch (e) {
      // As startFrom: an action that isn't one of the operator's skills can't start; anything else is a bug.
      if (!(e instanceof EngineError)) throw e;
      return false;
    }
    if ((state.readyAt[action.skill] ?? 0) > state.frame || spAt(state, state.frame) < spCostAt(ctx, state, action.operator, costs, state.frame)) return false;
    const skill = ctx.kits.get(action.operator)?.skills.find((x) => x.skillId === action.skill);
    if (skill && needsWindow(ctx, action.operator, skill) && !windowOpen(advance(ctx, state, state.frame), action.operator, windowKey(ctx, action.operator, action.skill), state.frame)) return false;
  }
  const r = startFrom(ctx, state, action);
  return "frame" in r && r.frame === state.frame;
}

/**
 * Whether an action can start at `frame` (at or after the state's own) with nothing pressed in between: the one "can
 * this start now" of a driver that steps over frames (the rule driver, policy.ts). It is startsNow on the state
 * advanced to that frame, so a press waits for the current skill's own hits as the search's do; and since earliestStart
 * judges an `at` on the state then, apply(state, { ...action, at: frame }) starts it at exactly that frame, and the
 * rotation a driver records replays with `simulate` (tests/timeline.test.ts checks both on the example rotations and
 * rule runs). Before 2026-11-16 a driver had to ask both startsNow on the advanced state and earliestStart from the
 * state after its last press: the latter read SP as it was then, without what hits granted on the way (every
 * disagreement on the three example rule lists, the dive-landing case among them).
 */
export function canStartAt(ctx: TimelineContext, state: TimelineState, action: RotationAction, frame: number): boolean {
  if (frame < state.frame) return false;
  const { at: _at, ...plain } = action;
  return startsNow(ctx, frame > state.frame ? advance(ctx, state, frame) : state, plain);
}
