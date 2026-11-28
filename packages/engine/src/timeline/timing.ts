// When an operator may act (docs/design/timeline.md "Skill timing"): action gates, chains, combo windows, earliest starts.

import type { Build } from "../build.ts";
import { decide, evalContext } from "../damage.ts";
import { EngineError } from "../errors.ts";
import type { KitSkill, SkillTiming } from "../model.ts";
import type { SkillType } from "../attributes.ts";
import { allActions, triggerSkillId } from "../events.ts";
import { test } from "../expr.ts";
import { activeAt } from "../buffs.ts";
import type { Acting, ChainStep, PendingJump, RotationAction, TimelineContext, TimelineState } from "./state.ts";
import { CHAIN_CACHE_FRAMES, priorityOf, SP } from "./rules.ts";
import { kitSkill, panelAt, skillCosts, timingOf } from "./context.ts";
import { isStaggered, spAt, spCostAt, spReachedAt } from "./resources.ts";
import { situationAt } from "./situation.ts";
import { advance, nextEventAfter } from "./advance.ts";
import { castBound, ofCast, ofKind } from "./schedule.ts";
import { engineReading } from "../assumptions.ts";

/**
 * Combo-kind skills of an operator that an `openCombo` with `skills` names:
 * each uses only a window of its own (windowKey), which its own combo may
 * open (Rossi's sequence 2). From the context (TimelineContext.ownWindows).
 */
export function ownWindowSkills(ctx: TimelineContext, operator: string): ReadonlySet<string> {
  return ctx.ownWindows.get(operator) ?? new Set();
}

/** The combo window a skill uses: one of its own (ownWindowSkills), else its operator's. */
export function windowKey(ctx: TimelineContext, operator: string, skillId: string): string {
  return ownWindowSkills(ctx, operator).has(skillId) ? `${operator}>${skillId}` : operator;
}

/**
 * Whether a combo window (by windowKey) of an operator is open at a frame: not past its end, and its buff (whileBuff)
 * active, an instance applied by the time it opened (one applied later doesn't reopen it).
 */
export function windowOpen(st: TimelineState, operator: string, key: string, frame: number): boolean {
  const w = st.comboWindow[key];
  if (!w || w.until < frame) return false;
  return !w.whileBuff || st.buffs.some((b) => b.id === w.whileBuff && b.owner === operator && b.cast === undefined && b.appliedAt <= Math.min(frame, w.from) && b.expiresAt > frame);
}

/** Whether a combo skill needs a window to be cast: one of its own, or its operator's when a trigger opens one; not one cast without it (KitSkill.comboWindow false). */
export function needsWindow(ctx: TimelineContext, operator: string, skill: KitSkill): boolean {
  if (skill.kind !== "combo" || skill.comboWindow === false) return false;
  return ownWindowSkills(ctx, operator).has(skill.skillId) || hasComboTrigger(ctx, operator);
}

/** The real frame of an action's skill frame `x`: from its start, less what its jumps skipped (a skipped frame is its jump's). */
export function actionFrame(cur: Acting, x: number): number {
  let f = cur.frame + x;
  for (const j of cur.skips ?? []) {
    if (x <= j.from) continue;
    if (x < j.to) return j.at;
    f -= j.length;
  }
  return f;
}

/** The chain's steps for an operator: the next one, then its alternatives. */
function chainSteps(st: TimelineState, operator: string): readonly ChainStep[] {
  const c = st.chainNext[operator];
  return c ? [c, ...(c.alternatives ?? [])] : [];
}

/**
 * The first skill frame of a window [from, to] the playhead plays, given the
 * jumps its cast took: frames a jump skipped are never played, so a window
 * wholly inside a skipped segment is null (closed) and one that starts
 * inside it opens at the jump's target.
 */
function windowReached(cur: Acting, from: number, to: number): number | null {
  let f = from;
  for (const k of cur.skips ?? []) {
    if (!(f > k.from && f < k.to)) continue;
    if (to < k.to) return null;
    f = k.to;
  }
  return f;
}

/** An action's exclusive frame, in skill frames: MarkCanInterrupt past the first mark no taken jump skipped, the cast counts as past it. */
function exclusiveOf(ct: SkillTiming, cur: Acting): number {
  const mark = (ct.interruptibleFrom ?? []).find((m) => !(cur.skips ?? []).some((k) => m > k.from && m < k.to));
  return mark !== undefined ? Math.min(ct.exclusiveFrames, mark) : ct.exclusiveFrames;
}

/**
 * The frame from which an operator's current action no longer holds what
 * doesn't outrank it (its exclusive frame, or its end), at least the
 * state's frame: for a driver that doesn't cancel a skill with a dive's
 * jump (search.ts).
 */
export function exclusiveUntil(ctx: TimelineContext, state: TimelineState, operator: string): number {
  const cur = state.acting[operator];
  if (!cur || cur.auto) return state.frame;
  const ct = timingOf(ctx, cur.skill);
  return Math.max(state.frame, Math.min(actionFrame(cur, ct.durationFrames), actionFrame(cur, exclusiveOf(ct, cur))));
}

/**
 * The earliest frame from `base` at which an operator may start a skill,
 * given its current action: once that's over, inside a window of it that
 * lists the skill, at once if it has no windows or the skill outranks it,
 * else from its exclusive frame. A basic-attack chain step only while the
 * chain points at it; another basic attack not while the chain points
 * elsewhere (the input would resolve to the step). `mapped`: what the
 * operator's basic-attack input is at the start (KitBuff.basicAttack), if
 * a buff maps it.
 */
function actionGate(ctx: TimelineContext, st: TimelineState, operator: string, skillId: string, base: number, mapped?: string): { frame: number } | { error: string } {
  const next = kitSkill(ctx, operator, skillId);
  const nt = timingOf(ctx, skillId);
  const steps = chainSteps(st, operator);
  let frame = base;
  // A teammate's own attack doesn't hold the operator's own casts (teammates.ts).
  const cur = st.acting[operator]?.auto ? undefined : st.acting[operator];
  if (cur) {
    const ct = timingOf(ctx, cur.skill);
    const at = (x: number) => actionFrame(cur, x);
    const options = [Math.max(frame, at(ct.durationFrames)), Math.max(frame, at(exclusiveOf(ct, cur)))];
    if (priorityOf(nt) > priorityOf(ct)) options.push(frame);
    ct.windows.forEach((w, i) => {
      // A conditional window only if its kit condition held at the cast; only from the first frame the playhead plays.
      // An entry naming another operator's skill opens nothing (Mi Fu's dive landing lists Ember's attack1: a data quirk).
      if (!w.skills.includes(skillId) || (w.conditional && !cur.windows?.includes(i))) return;
      const from = windowReached(cur, w.from, w.to);
      if (from !== null && Math.max(frame, at(from)) <= at(w.to)) options.push(Math.max(frame, at(from)));
    });
    frame = Math.min(...options);
  }
  if (next.kind === "basic" && nt.specification === 1 && mapped !== undefined) {
    // A buff maps the attack input: only that skill, as a chain head (no chain window defers or gates it).
    if (mapped !== skillId) return { error: `${skillId}: the basic-attack input is ${mapped} while a buff maps it` };
  } else if (next.kind === "basic" && nt.specification === 1) {
    if (next.chainStep) {
      const own = steps.filter((c) => c.skill === skillId);
      if (!own.length) return { error: `${skillId} is a basic-attack chain step, and the chain isn't at it` };
      // The first of its windows still open.
      const open = own.find((c) => Math.max(frame, c.from) <= c.until);
      if (!open) return { error: `${skillId}: the chain's window for it closes at frame ${Math.max(...own.map((c) => c.until))}` };
      frame = Math.max(frame, open.from);
    } else {
      // An attack input in one of the chain's windows becomes that window's step.
      const inWindow = steps.find((c) => c.skill !== skillId && c.from <= frame && frame <= c.until);
      if (inWindow) return actionGate(ctx, st, operator, skillId, inWindow.until + 1, mapped);
    }
  }
  return { frame };
}

/**
 * The chain's next step after a cast: a basic attack's window that lists a basic attack; kept for a moment by skills
 * that don't interrupt the chain, cleared by others. `openWindows`: its conditional windows open at this cast (Acting.windows).
 */
export function chainAfter(ctx: TimelineContext, st: TimelineState, operator: string, skill: KitSkill, frame: number, openWindows: readonly number[] = []): TimelineState["chainNext"] {
  const t = timingOf(ctx, skill.skillId);
  const at = (x: number) => frame + x;
  const { [operator]: prev, ...rest } = st.chainNext;
  if (skill.kind === "basic" && t.specification === 1) {
    const kit = ctx.kits.get(operator);
    const steps: ChainStep[] = [];
    t.windows.forEach((w, i) => {
      if (w.conditional && !openWindows.includes(i)) return;
      // Only a chain step (attack2…) continues the chain; a window listing the skill itself or another chain head doesn't;
      // with an input mapping (ComboCacheAction), only a step it maps the attack input to.
      const step = w.skills.find((id) => kit?.skills.some((s) => s.skillId === id && s.kind === "basic" && s.chainStep) && (!t.inputMap || t.inputMap.includes(id)));
      if (step) steps.push({ skill: step, from: at(w.from), until: at(w.to) });
    });
    const [first, ...alternatives] = steps;
    return first ? { ...rest, [operator]: { ...first, ...(alternatives.length ? { alternatives } : {}) } } : rest;
  }
  // dontInterruptCombo: the next attack still continues the chain up to 1 s after this skill's exclusive time (Endaxis: OffsetCacheTime).
  // The step that was next is kept (not its alternatives by timing: the timing is gone).
  if (t.keepsChain && prev && prev.until >= frame) return { ...rest, [operator]: { skill: prev.skill, from: frame, until: at(t.exclusiveFrames) + CHAIN_CACHE_FRAMES } };
  return rest;
}

/** The frame by which an operator's current cast has landed its hits, and run its awaited delayed actions, that an interrupt would cancel. */
export function ownHitsLanded(st: TimelineState, operator: string): number {
  // A teammate's own attack is cut at once (teammates.ts).
  if (st.acting[operator]?.auto) return 0;
  const cast = st.acting[operator]?.cast ?? st.casts.findLastIndex((c) => c.operator === operator);
  // An end on its timeline that comes before any jump (InterruptCurSkillAction) drops what lies past it: nothing there to
  // wait for on this path (Snowshine's bash, reached only through her counter's jump; a jump an attack sets off is judged again).
  const next = ofKind(st.scheduled, "jump").filter((j) => ofCast(j, operator, cast)).reduce<PendingJump | null>((a, x) => (!a || x.frame < a.frame ? x : a), null);
  const until = next?.end ? next.frame : Infinity;
  let last = 0;
  // What a jump still due on the cast will skip never happens, so nothing waits for it either (batch 3 S2: Wulfgard's plain
  // battle skill launches no frame-141 shot past its 117 → 247 jump).
  const skipped = skippedByJumps(st, operator, cast);
  const wait = (f: number) => {
    if (f <= until && !skipped(f)) last = Math.max(last, f);
  };
  // A detached hit is the cast's own until its launch: interrupting before it would cancel it (one on its way from frame 0 waits for nothing).
  for (const x of st.scheduled) {
    if (!ofCast(x, operator, cast)) continue;
    const bound = castBound(x);
    if (x.kind === "hit" && bound !== null) wait(bound);
    if (x.kind === "action" && (x.awaited || x.launchAt !== undefined)) wait(x.launchAt ?? x.frame);
  }
  return last;
}

/**
 * Whether a cast's jumps still to come skip a real frame (as takeJump drops
 * what falls in the skipped frames); a jump inside an earlier one's skipped
 * frames isn't reached.
 */
function skippedByJumps(st: TimelineState, operator: string, cast: number): (frame: number) => boolean {
  const spans: { readonly at: number; readonly until: number }[] = [];
  for (const j of ofKind(st.scheduled, "jump").filter((x) => ofCast(x, operator, cast) && !x.end).sort((a, b) => a.frame - b.frame)) {
    if (spans.some((s) => j.frame > s.at && j.frame < s.until)) continue;
    spans.push({ at: j.frame, until: j.frame + j.to - j.from });
  }
  return (frame) => spans.some((s) => frame > s.at && frame < s.until);
}

/** An action's playhead at a real frame, in skill frames: real frames since its start plus what its jumps skipped. */
export function playheadOf(cur: Acting, frame: number): number {
  return frame - cur.frame + (cur.skips ?? []).filter((k) => k.at <= frame).reduce((t, k) => t + k.length, 0);
}

/**
 * Whether an attack on the operator now would set off its current skill's counter: an `attacked` trigger with a
 * `jump` of this skill in range, or a range of the skill the operator doesn't dodge in (KitSkill.noDodge).
 */
export function counters(ctx: TimelineContext, operator: string, cur: Acting, frame: number): boolean {
  const p = playheadOf(cur, frame);
  const guard = ctx.kits.get(operator)?.skills.find((s) => s.skillId === cur.skill)?.noDodge;
  if (guard && p >= guard[0] && p < guard[1]) return true;
  return (ctx.kits.get(operator)?.triggers ?? []).some(
    (t) => t.on.event === "attacked" && t.by === "self" && t.do.some((x) => x.kind === "jump" && x.skill === cur.skill && p >= x.from && p < x.until),
  );
}

/**
 * The first frame at or after `frame` outside the operator's current skill's cantCastSkill channels that hold a cast of
 * this kind. A finisher's disable-cast buff doesn't hold an ultimate (engine assumption finisher-ultimate, `cuts`): the
 * ultimate cuts the finisher, its hits still to come with it.
 */
/**
 * Which gate of the operator's running action holds a start of `skillId` from `frame`, in words, and the frame it
 * gives (views only: the log replay's INSIDE line). The options actionGate weighs (the action's end, its uncuttable
 * frames, the priority, each window that lists the skill), the one it takes, then a cantCastSkill channel
 * (afterCantCast) on top: round 23, the break-combo report point 1 (458b's two INSIDE lines named "its uncuttable
 * frames" where a channel to frame 119 and a skillSpecification of 0 held them; an hour in the raw data).
 */
export function startGateWords(ctx: TimelineContext, state: TimelineState, operator: string, skillId: string, frame: number, until?: number): { readonly frame: number; readonly words: string } {
  const cur = state.acting[operator];
  if (!cur || cur.auto) return { frame, words: "no running action of its own holds it" };
  const [ct, nt] = [timingOf(ctx, cur.skill), timingOf(ctx, skillId)];
  const at = (x: number) => actionFrame(cur, x);
  const ex = exclusiveOf(ct, cur);
  const [pn, pc] = [priorityOf(nt), priorityOf(ct)];
  const rank = `priority ${pn} (skillSpecification ${nt.specification}) against its ${pc} (${ct.specification})`;
  const options: { frame: number; words: string }[] = [
    { frame: Math.max(frame, at(ct.durationFrames)), words: `${cur.skill}'s end (its frame ${ct.durationFrames})` },
    { frame: Math.max(frame, at(ex)), words: `${cur.skill}'s uncuttable frames to its frame ${ex}${ex !== ct.exclusiveFrames ? ` (a MarkCanInterrupt; exclusiveFrame ${ct.exclusiveFrames})` : ""}, ${rank}` },
  ];
  if (pn > pc) options.push({ frame, words: `its ${rank}: it outranks the running action` });
  ct.windows.forEach((w, i) => {
    if (!w.skills.includes(skillId)) return;
    if (w.conditional && !cur.windows?.includes(i)) {
      options.push({ frame: Infinity, words: `window ${i} (frames ${w.from}–${w.to}), conditional and shut at this cast` });
      return;
    }
    const from = windowReached(cur, w.from, w.to);
    if (from !== null && Math.max(frame, at(from)) <= at(w.to)) options.push({ frame: Math.max(frame, at(from)), words: `window ${i} of ${cur.skill} (its frames ${w.from}–${w.to})` });
  });
  const best = options.reduce((a, b) => (b.frame < a.frame ? b : a));
  const kind = kitSkill(ctx, operator, skillId).kind;
  const through = kind === "ultimate" && engineReading(ctx.scenario, "finisher-ultimate") === "cuts";
  const channel = [...ct.channels].sort((a, b) => a.from - b.from).filter((c) => c.cantCastSkill && !(through && c.finisher) && at(c.from) <= best.frame && best.frame < at(c.to));
  const last = channel.at(-1);
  const after = afterCantCast(ctx, state, operator, best.frame, kind);
  const windows = ct.windows.some((w) => w.skills.includes(skillId)) ? "" : "; no window of it lists the skill";
  const own = `${best.words}${windows}${last ? `; then a cantCastSkill channel of ${cur.skill} to its frame ${last.to}${last.finisher ? " (a finisher's disable-cast)" : ""}` : ""}`;
  // A later start than the running action allows (`until`, earliestStart's): one of startFrom's other gates.
  if (until === undefined || until <= after) return { frame: after, words: own };
  const then = advance(ctx, state, Math.max(state.frame, until - 1));
  const costs = skillCosts(ctx, operator, skillId, until - 1);
  const skill = kitSkill(ctx, operator, skillId);
  const later = Math.ceil(state.readyAt[skillId] ?? 0) >= until
    ? `its cooldown, ready at frame ${Math.ceil(state.readyAt[skillId] ?? 0)}`
    : needsWindow(ctx, operator, skill) && !windowOpen(then, operator, windowKey(ctx, operator, skillId), until - 1)
      ? "its combo window, shut until then"
      : spAt(then, until - 1) < spCostAt(ctx, then, operator, costs, until - 1) - 1e-6
        ? "its SP cost, reached then"
        : "a later gate (the running action's own hits, a jump or end on its way, the attack input's mapping)";
  return { frame: until, words: `${later}; the running action alone would let it start at ${after === frame ? "once" : `frame ${after}`} (${own})` };
}

export function afterCantCast(ctx: TimelineContext, state: TimelineState, operator: string, frame: number, kind?: SkillType): number {
  const cur = state.acting[operator];
  if (!cur || cur.auto) return frame;
  const through = kind === "ultimate" && engineReading(ctx.scenario, "finisher-ultimate") === "cuts";
  let f = frame;
  // Channels are in skill frames; a hasted cast plays them faster.
  const at = (x: number) => actionFrame(cur, x);
  for (const c of [...timingOf(ctx, cur.skill).channels].sort((a, b) => a.from - b.from)) if (c.cantCastSkill && !(through && c.finisher) && at(c.from) <= f && f < at(c.to)) f = at(c.to);
  return f;
}

/**
 * The earliest frame an action could start from the current state, or a
 * reason it can't. When the operator's kit can end its own action
 * (`endAction`), the action the gate waits on may end sooner: then it's
 * judged from the frame that happens.
 *
 * `action.at` is a lower bound, not "exactly then": the gates may move the
 * start later (a battle skill holding the input until an idle hover ends).
 * Whether it can start at exactly a frame: canStartAt.
 */
export function earliestStart(ctx: TimelineContext, state: TimelineState, action: RotationAction): { frame: number } | { error: string } {
  // A start not before a later frame (`at`) is judged on the state then: everything due by that frame happens whatever
  // is pressed (the SP its hits grant, a dive's landing replacing its jump, a teammate's own attack replacing a skill), and
  // the cast would see it all (apply advances to the start). Judged on the earlier state, the gates read SP and the
  // current action as they were (2026-11-16: Si's battle skill 67 frames late, an SP grant on the way missed; Typhoeus's
  // battle skill 48 frames late after a dive). So this agrees with startsNow on the state advanced to `at` (canStartAt).
  if (action.at !== undefined && action.at > state.frame && action.at <= ctx.scenario.durationFrames) return earliestStart(ctx, advance(ctx, state, action.at), action);
  const r = startFrom(ctx, state, action);
  const cur = state.acting[action.operator];
  // Its action may end sooner: a kit's endAction or follow-up cast (Purrchena's block or loop replaces the current skill), a jump or end on its timeline, a perfect dodge.
  const ends =
    ctx.kits.get(action.operator)?.triggers.some((t) => allActions(t.do).some((a) => a.kind === "endAction" || a.kind === "cast")) ||
    state.scheduled.some((x) => x.kind === "jump" && x.operator === action.operator) ||
    (ctx.scenario.options.dodge !== undefined && state.scheduled.some((x) => x.kind === "enemyAction" && x.act === "attack"));
  if (!cur || cur.auto || ("frame" in r && r.frame <= state.frame) || !ends) return r;
  const t = timingOf(ctx, cur.skill);
  const horizon = Math.min(ctx.scenario.durationFrames, "frame" in r ? r.frame : actionFrame(cur, t.durationFrames));
  // Over, replaced, or moved on by a jump.
  const same = (x: TimelineState) => x.acting[action.operator]?.frame === cur.frame && x.acting[action.operator]?.skill === cur.skill && (x.acting[action.operator]?.skips?.length ?? 0) === (cur.skips?.length ?? 0);
  if (horizon <= state.frame || same(advance(ctx, state, horizon))) return r;
  // The first frame its action is over or replaced: everything before it is as the plain judgement saw it.
  let lo = state.frame;
  let hi = horizon;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (same(advance(ctx, state, mid))) lo = mid;
    else hi = mid;
  }
  // Judged again from there: the action that follows may end sooner too (Catcher's counter jumps, then ends at 194). Each round moves forward.
  return earliestStart(ctx, advance(ctx, state, hi), action);
}

export function startFrom(ctx: TimelineContext, state: TimelineState, action: RotationAction): { frame: number } | { error: string } {
  if (!ctx.builds.has(action.operator)) return { error: `${action.operator} isn't in the team` };
  let frame = Math.max(state.frame, action.at ?? 0);
  if (action.skill === "swap") {
    if (action.operator === state.controlled) return { error: `${action.operator} is already the controlled operator` };
    // Swapping doesn't stop the current action, but a channel that forbids switching does stop the swap.
    const cur = state.acting[state.controlled];
    if (cur) for (const c of timingOf(ctx, cur.skill).channels) if (c.cantSwitch && actionFrame(cur, c.from) <= frame && frame < actionFrame(cur, c.to)) frame = actionFrame(cur, c.to);
    return { frame };
  }
  let costs;
  try {
    if (kitSkill(ctx, action.operator, action.skill).followUpOnly) return { error: `${action.skill} is cast only by its own skill (a follow-up), not by a rotation` };
    costs = skillCosts(ctx, action.operator, action.skill, frame);
  } catch (e) {
    // Not one of the operator's skills (or one without SkillData): not legal. Anything else is a bug, and is thrown.
    if (!(e instanceof EngineError)) throw e;
    return { error: e.message };
  }
  if (costs.kind === "basic" && state.controlled !== action.operator) return { error: `${action.operator} isn't the controlled operator (swap first)` };
  // A dive (skillSpecification 6): a rotation names its landing; it starts with a jump, which only the controlled operator makes (jumpToDive).
  if (costs.timing.specification === 6) {
    const dive = ctx.data.operators[action.operator]?.dive;
    if (dive?.start === action.skill) return { error: `${action.skill} is a dive's fall: a rotation dives with ${dive.end}` };
    if (dive?.end !== action.skill) return { error: `${action.skill} is a plunging skill, not ${action.operator}'s dive` };
    if (state.controlled !== action.operator) return { error: `${action.operator} isn't the controlled operator: only it jumps (swap first)` };
  }
  // Every gate below may move the start; one that does (waiting for a combo's window above all) is judged again from
  // there with all of them, until the start stops moving (round-two review: a wait for the window wasn't re-checked).
  for (let round = 0; round < MAX_GATE_ROUNDS; round++) {
    const r = gatesFrom(ctx, state, action, costs, frame);
    if ("error" in r || r.frame === frame) return r;
    frame = r.frame;
  }
  return { error: `${action.skill}: its start keeps moving as its gates are judged again (frame ${frame} after ${MAX_GATE_ROUNDS} rounds)` };
}

/** Whether a skill's kit `available` condition holds at a frame (judged on the state then); true without one. */
export function skillAvailable(ctx: TimelineContext, state: TimelineState, operator: string, skillId: string, frame: number): boolean {
  const skill = kitSkill(ctx, operator, skillId);
  if (!skill.available) return true;
  const then = advance(ctx, state, frame);
  const build = ctx.builds.get(operator) as Build;
  return decide(skill.available, evalContext(ctx.data, build, panelAt(ctx, operator, frame), skill.skillId, situationAt(ctx, operator, then, frame)));
}

/** Per context and operator: the kit's enhanced basic attacks (enhancedBasic). */
const enhancedCache = new WeakMap<TimelineContext, Map<string, readonly KitSkill[]>>();

/**
 * The enhanced basic attack the operator's attack input casts at a frame (the state advanced to it), or undefined: a
 * basic attack (skillSpecification 1) that CharGrowthTable puts in the battle skill's or the ultimate's skill group,
 * not the NormalAttack group (Laevatain's Twilight chain and Yvonne's ultimate chain in the ultimate's, Zhuang Fangyi's
 * Empyrean chain in the ultimate's, Typhoeus's aerial attacks in the battle skill's), while its kit `available` holds
 * or a buff maps the input to it (KitBuff.basicAttack: Yvonne's ultimate-end shot). The game switches the input to
 * these with a buff's SwitchModeAction (modeId `ult`, `UltMode`, `floating`) or ComboCacheAction; the Finisher is the
 * NormalAttack group's (skillSpecification 8), so none comes while the input is enhanced (the Talos Wiki's Stagger
 * article: the first basic attack "that aren't under any active enhancement effects (such as Laevatain's Twilight)";
 * in-game test 108: no logged Finisher while an operator's enhanced attacks run).
 */
export function enhancedBasic(ctx: TimelineContext, state: TimelineState, operator: string, frame: number): string | undefined {
  let byOperator = enhancedCache.get(ctx);
  if (!byOperator) enhancedCache.set(ctx, (byOperator = new Map()));
  let enhanced = byOperator.get(operator);
  if (!enhanced) {
    const groups = ctx.data.operators[operator]?.skillGroups ?? {};
    enhanced = (ctx.kits.get(operator)?.skills ?? []).filter((s) => s.kind === "basic" && ctx.data.skills[s.skillId]?.timing?.specification === 1 && (groups[s.skillId] ?? "basic") !== "basic");
    byOperator.set(operator, enhanced);
  }
  if (enhanced.length === 0) return undefined;
  const then = advance(ctx, state, frame);
  const mapped = then.buffs.find((b) => b.basicAttack !== undefined && b.owner === operator && b.cast === undefined && activeAt(b, frame))?.basicAttack;
  if (mapped !== undefined && enhanced.some((s) => s.skillId === mapped)) return mapped;
  // Only one whose kit says when it applies: a state's chain (one without a condition would block every Finisher).
  return enhanced.find((s) => s.available !== undefined && skillAvailable(ctx, then, operator, s.skillId, frame))?.skillId;
}

/** Rounds of startFrom's gates before a start that keeps moving is reported. */
const MAX_GATE_ROUNDS = 16;

/**
 * startFrom's gates from a frame on, in order: the cooldown (at a recovery rate, settled), the current skill's own hits,
 * the action gate (with the basic-attack input's mapping), a channel forbidding casts, a finisher's Stagger and plain
 * attack input (enhancedBasic), the SP cost
 * (waited for), availability, ultimate energy and the combo window (waited for: the first frame at which anything is due
 * that opens it). The frame they give, or an error; startFrom judges again from a frame that moved.
 */
function gatesFrom(ctx: TimelineContext, state: TimelineState, action: RotationAction, costs: ReturnType<typeof skillCosts>, start: number): { frame: number } | { error: string } {
  let frame = start;
  // (A cooldown run at a recovery rate may end within a frame: the skill is ready from the next whole one.)
  frame = Math.max(frame, Math.ceil(state.readyAt[action.skill] ?? 0));
  // A combo cooldown at a recovery rate (attribute 93) follows the rate buffs, which may change before it ends: judged on the state then.
  if (ctx.comboRates && costs.kind === "combo") {
    let settled = false;
    for (let i = 0; i < 8 && !settled; i++) {
      const r = Math.max(state.frame, action.at ?? 0, Math.ceil(advance(ctx, state, frame).readyAt[action.skill] ?? 0));
      settled = r === frame;
      frame = r;
    }
    if (!Number.isFinite(frame)) return { error: `${action.skill}: its cooldown doesn't end (recovery rate 0)` };
    // As the SP and input-mapping loops below: one that doesn't settle is reported, not taken as it stands.
    if (!settled) return { error: `${action.skill}: its cooldown's end keeps moving with the recovery-rate buffs on the way (frame ${frame} after 8 rounds)` };
  }
  // Without a time, an action waits for the current skill's own hits (interrupting would cancel them); with one, it may
  // interrupt. A skill that runs beside the current one cancels nothing, so it doesn't wait.
  const beside = ((s) => s.beside !== undefined && decide(s.beside, evalContext(ctx.data, ctx.builds.get(action.operator) as Build, panelAt(ctx, action.operator, frame), s.skillId, situationAt(ctx, action.operator, state, frame))))(kitSkill(ctx, action.operator, action.skill));
  if (action.at === undefined && !beside) frame = Math.max(frame, ownHitsLanded(state, action.operator));
  // What the basic-attack input is at the start (a buff that maps it: KitBuff.basicAttack), judged again where the start moves.
  const mappedAt = (f: number) => {
    if (!ctx.inputBuffs || costs.kind !== "basic" || costs.timing.specification !== 1) return undefined;
    return advance(ctx, state, f).buffs.find((b) => b.basicAttack !== undefined && b.owner === action.operator && b.cast === undefined && activeAt(b, f))?.basicAttack;
  };
  let mapped = mappedAt(frame);
  let gate = actionGate(ctx, state, action.operator, action.skill, frame, mapped);
  for (let i = 0; i < 4 && "frame" in gate && mappedAt(gate.frame) !== mapped; i++) {
    mapped = mappedAt(gate.frame);
    gate = actionGate(ctx, state, action.operator, action.skill, gate.frame, mapped);
  }
  if ("error" in gate) return gate;
  if (mappedAt(gate.frame) !== mapped) return { error: `${action.skill}: what the basic-attack input maps to changes at frame ${gate.frame}` };
  frame = gate.frame;
  // A channel that forbids casting (cantCastSkill, a finisher's disable-cast buff) holds every cast of its operator, whatever its priority.
  frame = afterCantCast(ctx, state, action.operator, frame, costs.kind);
  // A finisher only on a Staggered enemy, once per stagger, and only while the attack input isn't an enhanced basic attack.
  if (costs.timing.specification === 8) {
    const then = advance(ctx, state, frame);
    if (!isStaggered(then, frame) || then.stagger.finisherUsed) return { error: `${action.skill} is a finisher: the enemy isn't Staggered (or this stagger's finisher is used) at frame ${frame}` };
    const enhanced = enhancedBasic(ctx, then, action.operator, frame);
    if (enhanced !== undefined) return { error: `${action.skill} is a finisher: the attack input is the enhanced ${enhanced} at frame ${frame}` };
  }
  // Its SP cost at the start (attribute 45 of the caster's buffs then: judged again where the start moves).
  const costAt = (f: number) => spCostAt(ctx, ctx.costBuffs ? advance(ctx, state, f) : state, action.operator, costs, f);
  let spCost = costAt(frame);
  for (let i = 0; i < 4; i++) {
    if (spCost > SP.max) return { error: `${action.skill} costs ${spCost} SP, more than the maximum` };
    // Wait for SP: regen is linear after the pause, or comes in ticks (engine assumption sp-regen), on raw time.
    const spThen = spAt(state, frame);
    if (spThen >= spCost) break;
    frame = spReachedAt(state, frame, spCost);
    const again = costAt(frame);
    if (again === spCost) break;
    spCost = again;
  }
  if (spAt(state, frame) < spCost - 1e-6) return { error: `${action.skill}: its SP cost keeps changing as it waits for SP (${spCost} at frame ${frame})` };
  if (frame > ctx.scenario.durationFrames) return { error: `${action.skill} can't start before the fight ends` };
  // Energy, combo windows and states change only as hits land, so check them as they'll be at the start frame.
  const skill = kitSkill(ctx, action.operator, action.skill);
  if (!skillAvailable(ctx, state, action.operator, action.skill, frame)) return { error: `${action.skill} isn't available at frame ${frame} (${JSON.stringify(skill.available)})` };
  const windowed = needsWindow(ctx, action.operator, skill);
  if (costs.energyCost > 0 || windowed) {
    const then = advance(ctx, state, frame);
    if (costs.energyCost > 0 && (then.energy[action.operator] ?? 0) < costs.energyCost - 1e-9) {
      return { error: `${action.skill} needs ${costs.energyCost} ultimate energy, ${(then.energy[action.operator] ?? 0).toFixed(1)} at frame ${frame}` };
    }
    if (windowed) {
      const key = windowKey(ctx, action.operator, action.skill);
      if (!windowOpen(then, action.operator, key, frame)) {
        // Not open yet: wait for whatever is due to open it (a hit already on its way, a delayed trigger action, the enemy's
        // action, a burst, a status tick, a buff's end or tick: nextEventAfter), each frame judged on the state then.
        let s = then;
        let opens: number | null = null;
        for (let f = nextEventAfter(s, frame); f !== null && f <= ctx.scenario.durationFrames; f = nextEventAfter(s, f)) {
          s = advance(ctx, s, f);
          if (windowOpen(s, action.operator, key, f)) {
            opens = f;
            break;
          }
        }
        if (opens === null) return { error: `${action.skill}: its combo trigger hasn't happened (no open window at frame ${frame})` };
        frame = opens;
      }
    }
  }
  return { frame };
}

/** Whether the operator's combo needs a window: some trigger of its kit opens one (for this build's modes; a window of its own skills aside). */
function hasComboTrigger(ctx: TimelineContext, operator: string): boolean {
  const panel = panelAt(ctx, operator, 0); // whether a trigger can open a window at all: judged on the fight-start panel
  const build = ctx.builds.get(operator) as Build;
  return (ctx.kits.get(operator)?.triggers ?? []).some(
    (t) => allActions(t.do).some((a) => a.kind === "openCombo" && !a.skills) && (!t.if || test(t.if, evalContext(ctx.data, build, panel, triggerSkillId(operator, t), { team: ctx.scenario.team })) !== false),
  );
}
