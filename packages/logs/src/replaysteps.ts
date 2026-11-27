// The replay's steps (replayrun.ts replayOnce): what the log says of the enemy's Stagger (its recoveries, its bar
// before each group of hits, its Stagger listing), the placed hidden holds, the casts and the sample frames, in the
// order the replay takes them at one frame (stepRank). Its own module (improvement round 8, round 5's parked point 12):
// a new kind of step is an edit here and one branch in replayOnce.

import { FPS, replayEvent, targetDies, type BattleEvent, type EventLanding, type TargetDeathOptions, type TimelineContext, type TimelineState } from "@efsim/engine";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import type { ReplayedCast } from "./castassembly.ts";

const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);

/**
 * Where the log's Stagger bar is back to full between two logged hits (LogHit.poise), in ms: the first hit after it.
 * The bar doesn't recover on its own (refillPoise), so it's a Stagger's end or the enemy's own recovery (Rhodagn 29.5 s
 * into 4e5e1390085e, cutting a Stagger short 33.2 s into 7e19489ae503; a second life's full bar: 3aa6ab93bad4). The
 * replay refills its bar there, so its Stagger follows the log's.
 */
export function loggedRecoveries(fx: Pick<LogFixture, "hits">): number[] {
  const shown = fx.hits.filter((h): h is LogHit & { poise: NonNullable<LogHit["poise"]> } => h.poise !== undefined).sort((a, b) => a.t - b.t);
  const full = Math.max(0, ...shown.map((h) => h.poise.bar + h.poise.dealt));
  const out: number[] = [];
  for (const [i, h] of shown.entries()) {
    const prev = shown[i - 1];
    const before = h.poise.bar + h.poise.dealt;
    // The first logged one too, when it finds the bar full: hits the replay gave Stagger before it didn't leave any
    // (7b54dc249bcd: Camille's and Si's battle skills at 3 s, the slug's bar full at 11418 ms).
    if ((prev ? h.t > prev.t && before > prev.poise.bar + 1 : true) && before >= full - 0.5 && out.at(-1) !== h.t) out.push(h.t);
  }
  return out;
}

/**
 * The log's Stagger bar before each group of logged hits with Stagger (LogHit.poise: the bar after a hit plus what it
 * dealt; hits less than POISE_ORDER_MS apart are one group, their order in the log not theirs: its highest), in ms. The
 * replay sets its bar to it a frame before, so each hit finds the bar the game had: the enemy's own recovery, which
 * some enemies' AI makes, isn't in the timeline (7b54dc249bcd's Woodcraft Slug: 27 → 42 in 1.9 s, never Staggered in
 * 26 s, where a bar that only falls broke twice), nor Stagger from hits the log doesn't show. A full bar is a
 * recovery (loggedRecoveries), a Stagger's end refills it.
 */
export function loggedPoiseBars(fx: Pick<LogFixture, "hits">): { readonly t: number; readonly bar: number; readonly notStaggered: boolean }[] {
  const shown = fx.hits.filter((h): h is LogHit & { poise: NonNullable<LogHit["poise"]> } => h.poise !== undefined).sort((a, b) => a.t - b.t);
  const out: { t: number; bar: number; notStaggered: boolean }[] = [];
  // Not Staggered: the hit lists no Stagger and leaves the bar above 0 (a Stagger the replay has there isn't the game's).
  const calm = (h: LogHit & { poise: NonNullable<LogHit["poise"]> }) => h.poise.bar > 0 && !h.effects.some((e) => /poise_break/.test(e.buff));
  for (const [i, h] of shown.entries()) {
    const prev = shown[i - 1];
    const before = h.poise.bar + h.poise.dealt;
    const last = out.at(-1);
    if (prev && last && h.t - prev.t < POISE_ORDER_MS) {
      last.bar = Math.max(last.bar, before);
      last.notStaggered = last.notStaggered && calm(h);
    } else out.push({ t: h.t, bar: before, notStaggered: calm(h) });
  }
  return out;
}

/**
 * The log's Stagger state at each logged moment (the hits at one ms), for the replay to follow (accuracy plan B1,
 * 2026-11-17): `through` where the hits list Stagger (buff_common_poise_break_damage_taken_scale), the next moment's
 * time when its hits list it too, else their own: the enemy is Staggered through it; `calm` where none of them lists it:
 * the enemy isn't Staggered, the bar the last logged hit before left (`bar`, null before any). The damage confirms the
 * listing where the replay's own Stagger disagrees: over the development logs, 597 hits the log lists as Staggered and
 * the replay didn't are ×1.30 (median) its reading, 214 the other way ×0.77; and no logged hit falls between a hit that
 * breaks the bar and the first that lists Stagger (77–2676 ms later), so a hit without it after a break means the
 * game's Stagger hadn't begun or was over. A log without Stagger listed anywhere says the enemy never was when it lists
 * buffs and Stagger bars (7b54dc249bcd's slug, which the replay Staggered twice); otherwise it says nothing (empty).
 */
export function loggedStaggerSteps(fx: Pick<LogFixture, "hits">): { readonly t: number; readonly through?: number; readonly calm?: { readonly bar: number | null } }[] {
  const staggered = (h: LogHit) => h.effects.some((e) => STAGGER_LISTING.test(e.buff));
  if (!fx.hits.some(staggered) && !(fx.hits.some((h) => h.poise) && fx.hits.some((h) => h.effects.length > 0))) return [];
  const moments = new Map<number, LogHit[]>();
  for (const h of fx.hits) moments.set(h.t, [...(moments.get(h.t) ?? []), h]);
  const times = [...moments.keys()].sort((a, b) => a - b);
  const out: { t: number; through?: number; calm?: { bar: number | null } }[] = [];
  let bar: number | null = null;
  for (const [i, t] of times.entries()) {
    const hs = moments.get(t) as LogHit[];
    const listed = hs.filter(staggered).length;
    const next = times[i + 1];
    if (listed > 0) {
      const on = next !== undefined && (moments.get(next) as LogHit[]).some(staggered);
      out.push({ t, through: on ? (next as number) : t });
    } else out.push({ t, calm: { bar } });
    // The bar after them: the lowest a hit at this moment left (their order in the log isn't theirs).
    if (hs.some((h) => h.poise)) bar = Math.min(...hs.filter((h) => h.poise).map((h) => (h.poise as NonNullable<LogHit["poise"]>).bar));
  }
  return out;
}

const STAGGER_LISTING = /poise_break/;

/** How far apart two logged hits must be for their bars' order to be theirs (ms; loggedPoiseGains). */
const POISE_ORDER_MS = 50;

/** The log's Stagger as the replay's steps take it (frames): its recoveries, its bar a frame before its hits, its Stagger state. */
export interface LoggedStagger {
  readonly recoveries: readonly number[];
  readonly poiseBars: readonly { readonly frame: number; readonly bar: number; readonly calm: boolean }[];
  readonly staggerState: readonly { readonly frame: number; readonly through?: number; readonly endBar?: number | null }[];
}

/** The log's Stagger steps of a fight (LoggedStagger). */
export function loggedStagger(fx: Pick<LogFixture, "hits">): LoggedStagger {
  const recoveries = loggedRecoveries(fx).map(frameOf);
  // The bar is set a frame before its hit, so the hit sees the bar the log has before it.
  const poiseBars = loggedPoiseBars(fx).map((g) => ({ frame: Math.max(0, frameOf(g.t) - 1), bar: g.bar, calm: g.notStaggered }));
  // The log's Stagger state, likewise a frame before its hits (loggedStaggerSteps): Staggered through the next listed
  // moment, or not Staggered (where no moment of that frame lists it, and no hit there breaks the bar: the breaking hit
  // itself lists none).
  const staggerSteps = loggedStaggerSteps(fx);
  const listedFrames = new Set(staggerSteps.filter((x) => x.through !== undefined).map((x) => frameOf(x.t)));
  const breakFrames = new Set(fx.hits.filter((h) => h.poise?.bar === 0).map((h) => frameOf(h.t)));
  const staggerState = staggerSteps.flatMap((x): { frame: number; through?: number; endBar?: number | null }[] => {
    const frame = Math.max(0, frameOf(x.t) - 1);
    if (x.through !== undefined) return [{ frame, through: frameOf(x.through) + 1 }];
    const f = frameOf(x.t);
    return x.calm && !listedFrames.has(f) && !breakFrames.has(f) ? [{ frame, endBar: x.calm.bar }] : [];
  });
  return { recoveries, poiseBars, staggerState };
}

/** One step of the replay: a cast, one of the log's Stagger steps, a hidden hold (frames), or a sample (none of them). */
export interface ReplayStep {
  readonly frame: number;
  readonly cast: ReplayedCast | null;
  readonly recover: boolean;
  readonly bar?: number;
  readonly calm?: boolean;
  readonly through?: number;
  readonly endBar?: number | null;
  readonly hold?: number;
  /** The hold at a Stagger break the log stamped inside it, placed before the break's ms (holds.ts breakHoldStarts). */
  readonly breakHold?: true;
  /** A battle event the log shows and no cast makes (engine replayEvent): a target's death, say. */
  readonly event?: ReplayEventStep;
}

/**
 * A log-driven battle event (round 20, the Vesperwings report point 1: the next one, Arcane's seal or Si's ink at a
 * kill, needs no new step kind): its words for a trace, the event as made from the state at its frame, and the landings
 * of the hits its triggers schedule, pinned at their logged frames (engine replayEvent, pinLanding).
 */
export interface ReplayEventStep {
  /** For a trace (stepWords): "a target's death (…)". */
  readonly words: string;
  readonly make: (st: TimelineState) => BattleEvent;
  readonly landings: readonly EventLanding[];
  /** A target's death (engine targetDies): the triggers that don't run at it, whether its statuses end with it, its target. */
  readonly death?: TargetDeathOptions;
  /** A death's why (targets.ts TargetDeath.why: the logged kill or move it stands for) and its moves' operators, for BuffReplay.deaths. */
  readonly why?: string;
  readonly operators?: readonly string[];
}

/** A target's death as a replay event (targets.ts targetDeaths: its landings the moves' logged hits). */
export function deathEvent(frame: number, why: string, landings: readonly EventLanding[], death: TargetDeathOptions = {}, operators: readonly string[] = []): { readonly frame: number; readonly event: ReplayEventStep } {
  return { frame, event: { words: `a target's death (${why})`, why, operators, make: (st) => ({ type: "targetDeath", frame, operator: st.controlled }), landings, death } };
}

/** Runs a log-driven event step at the state's frame: a death by targetDies (its options), any other by replayEvent. */
export function runEventStep(ctx: TimelineContext, st: TimelineState, e: ReplayEventStep): TimelineState {
  return e.death ? targetDies(ctx, st, st.frame, e.landings, e.death) : replayEvent(ctx, st, st.frame, e.make, e.landings);
}

/**
 * The order of steps at one frame: the log's Stagger recoveries first (the bar is full for that frame's hits), a hidden
 * hold before the casts (what's due after it is held), a cast before a sample at its frame (its frame-0 hits land
 * first); the log's Stagger end before its bar (the bar is the hit's), and its Stagger after it.
 */
export function stepRank(s: ReplayStep): number {
  return s.recover ? 0 : s.hold !== undefined || s.breakHold ? 1 : s.cast || s.event !== undefined ? 2 : s.endBar !== undefined ? 3 : s.bar !== undefined ? 4 : s.through !== undefined ? 5 : 6;
}

/**
 * Every step of one replay in frame order (stepRank at one frame): the log's Stagger, the holds (the hidden ones; the
 * breaks' placed before their ms, `breakHolds`), the casts (not those before the log), the log-driven events (`events`:
 * the deaths of several targets' ones, targets.ts targetDeaths; deathEvent) and the samples.
 */
export function replaySteps(logged: LoggedStagger, worldHolds: readonly { readonly frame: number; readonly frames: number }[], casts: readonly ReplayedCast[], sampleFrames: readonly number[], breakHolds: readonly number[] = [], events: readonly { readonly frame: number; readonly event: ReplayEventStep }[] = []): ReplayStep[] {
  return [
    ...events.map((d) => ({ frame: d.frame, cast: null, recover: false, event: d.event })),
    ...logged.recoveries.map((frame) => ({ frame, cast: null, recover: true })),
    ...worldHolds.map((h) => ({ frame: h.frame, cast: null, recover: false, hold: h.frames })),
    ...breakHolds.map((frame) => ({ frame, cast: null, recover: false, breakHold: true as const })),
    ...logged.poiseBars.map((g) => ({ frame: g.frame, cast: null, recover: false, bar: g.bar, calm: g.calm })),
    ...logged.staggerState.map((g) => ({ ...g, cast: null, recover: false })),
    ...casts.filter((c) => !c.beforeLog).map((c) => ({ frame: Math.max(0, frameOf(c.start)), cast: c, recover: false })),
    ...sampleFrames.map((frame) => ({ frame, cast: null, recover: false })),
  ].sort((a: ReplayStep, b: ReplayStep) => a.frame - b.frame || stepRank(a) - stepRank(b));
}

/** A step of the replay in words, for a trace (BuffTrace.step). */
export function stepWords(s: ReplayStep): string {
  if (s.cast) return `cast ${s.cast.skillId}`;
  if (s.recover) return "the log's Stagger recovery";
  if (s.endBar !== undefined) return "the log's calm hit";
  if (s.bar !== undefined) return "the log's Stagger bar";
  if (s.through !== undefined) return "the log's Stagger listing";
  if (s.hold !== undefined) return `a placed hidden hold of ${s.hold} frame(s)`;
  if (s.breakHold) return "the hold at a Stagger break, placed before the break's ms";
  if (s.event !== undefined) return s.event.words;
  return "time to the next sample (pauses, stops, holds)";
}
