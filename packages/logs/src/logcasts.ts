// Where a battle log's hits fall in their casts (batch 4 L1): each logged hit
// of an operator with a kit is mapped to the kit landing it is (the n-th
// logged landing of a key within a cast is the n-th kit landing with that
// key, in frame order), and each cast is placed in time from its first logged
// hit. The reaction replay applies the landing's own applications (L1) and
// the casts' time stops (L5); the log check counts Link sources (L3).

import { Attr, computeStats, cutAtResets, effectiveKit, evalContext, evaluate, FPS, hitAvailable, hitDecorations, parseReactionEvent, pathSlowdowns, pathTwin, skillValue, triggerSkillId, allActions, type Build, type HitDecoration, type GameData, type KitHit, type OperatorKit, type Predicate, readingOf, type Readings, type SkillTiming, type SkillType, type StatPanel } from "@efsim/engine";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { pairCasts } from "./castpairs.ts";
import { breakStops } from "./holds.ts";
import { batchTargets, DEFAULT_AT_ONCE, readsTargets, type BatchHit } from "./targets.ts";

/**
 * A logged cast whose next landing comes later than the key's landings span
 * plus this is a new cast: hit-stop and frame rounding stretch a cast in the
 * log (Haste shortens it). Other operators' logged time stops are taken out
 * of the time between landings first (worldMs).
 */
export const CAST_SLACK_MS = 1000;

/** A cast's next landing of a key logged this close to its slot's frame (from the key's first landing) is that landing (ms). */
const ON_TIME_MS = 150;

/**
 * How far past its channel's end (KitHit.latestFrame) a tick may land and still be its cast's, with no logged press of
 * its operator since the cast's last landing (ms; split:channel-end):
 * the logs run channels up to 0.23 s past the data's end (9090afbacec9 93.91 s Liino's attack 2, 4bfc6f3e84b8 52.23 s
 * Arclight's attack 4, c3c735dbb022 60.94 s Si's attack 4: holds the replay doesn't know of, or a later start), while a
 * new cast's ticks come 0.63 s or more past it (abfd4b7478ec 63.77 s, c3c735dbb022 33.64 s).
 */
const CHANNEL_SLACK_MS = 400;

/** A global slow-down a logged cast caused (SkillTiming.slowdowns: UltimateTimeAction, global TimeDilationAction): from frame `start`, the world's time scale per frame. */
export interface TimeStop {
  /** A frame (30 a second), not ms as the log's times; it lasts `scales.length` frames. */
  readonly start: number;
  readonly scales: readonly number[];
  readonly operator: string;
  readonly skillId: string;
  /** The cast kind of the skill that made it (absent: unknown). */
  readonly kind?: SkillType | null;
  /** Its dilation's priority tag, which a reset of the same priority ends (SkillTiming.resets). */
  readonly priority?: number;
}

/**
 * A cast's time stops from frame `at` (its skill's slow-downs along the path the cast took, with their priority) and its
 * resets as frames. Stops are cut at the resets of every cast among them (withResets), as the engine does
 * (timeline/clock.ts cutAtResets). `landed`: the kit frames of the cast's logged landings, which show the path
 * (pathOf); without them a skill with conditional jumps takes none of them.
 */
export function skillStops(data: GameData, skillId: string, at: number, who: Omit<TimeStop, "start" | "scales" | "priority">, landed?: readonly number[]): { readonly stops: TimeStop[]; readonly resets: { readonly frame: number; readonly priority: number }[] } {
  const t = data.skills[skillId]?.timing;
  return {
    stops: (t ? pathOf(t, landed) : []).map((d) => ({ start: at + d.from, scales: d.scales, ...who, ...(d.priority !== undefined ? { priority: d.priority } : {}) })),
    resets: (t?.resets ?? []).map((r) => ({ frame: at + r.at, priority: r.priority })),
  };
}

/**
 * A cast's slow-downs along the path its landings show (engine pathSlowdowns: its ends and the jumps taken): a conditional
 * jump is taken when a landing comes at or past its target and none between its frame and the target (of several from
 * one frame, the farthest so reached). Rossi's sequence 2 (combo_3) on its perfect path ends at frame 211, so its frame-212
 * slow-down, the late path's, never comes (489c0be3e162's at 51.90 s put 0.42 s of stop at 58.97 s that the replay's
 * own timeline, which judges the jump at the cast, never had). With conditional jumps and no landing to show one: the path
 * that takes none, the skill's own when no kit condition holds (every slow-down, as before 2026-11-23, is no path's:
 * Purrchena's combo, whose damage is all its giftbox's, put its shielded paths' slow-downs at frames 210 and 270 after
 * every unshielded cast, 26 stops in 04d401ad257e and 99fb3c35fda2 the engine never had).
 */
function pathOf(t: SkillTiming, landed?: readonly number[]): SkillTiming["slowdowns"] {
  const conditional = t.jumps.filter((j) => j.conditional);
  const taken = t.jumps.filter((j) => !j.conditional).map((j) => ({ from: j.at, to: j.to }));
  if (conditional.length > 0 && !landed?.length) return pathSlowdowns(t, taken);
  for (const at of new Set(conditional.map((j) => j.at))) {
    const reached = conditional.filter((j) => j.at === at && (landed ?? []).some((f) => f >= j.to) && !(landed ?? []).some((f) => f > j.at && f < j.to));
    const far = reached.reduce<(typeof reached)[number] | null>((m, j) => (!m || j.to > m.to ? j : m), null);
    if (far) taken.push({ from: far.at, to: far.to });
  }
  return pathSlowdowns(t, taken);
}

/** The kit frames of each placed cast's landings (PlacedHit.frame), which show the path it took (skillStops). */
export function castFrames(placement: Pick<Placement, "hits">): Map<LoggedCast, number[]> {
  const out = new Map<LoggedCast, number[]>();
  for (const p of placement.hits.values()) if (p.frame !== undefined && p.sameAs === undefined) out.set(p.cast, [...(out.get(p.cast) ?? []), p.frame]);
  return out;
}

/** Stops cut at the resets among their casts (skillStops; Arcane's combo at its frame 9: engine assumption combo-reset). */
export function withResets<T extends TimeStop>(parts: readonly { readonly stops: readonly T[]; readonly resets: readonly { readonly frame: number; readonly priority: number }[] }[]): T[] {
  return cutAtResets(
    parts.flatMap((p) => p.stops),
    parts.flatMap((p) => p.resets),
  ).filter((s) => s.scales.length > 0);
}

/**
 * The time stops of logged casts of skills that have them, each cast placed from its first logged hit: the placement's
 * stops. Which stop list for what (friction round 7: four builders each needed Arcane's reset):
 * - castTimeStops: what the placement knows (the placed casts); for code that runs before the replay's casts exist or
 *   must match it (withLoggedCasts, loggedCastFates, the reaction check's enemy clock).
 * - the placement's second pass: castTimeStops and the log's unplaced cast events' stops, those uncut (placeHits: an
 *   event's time is the press, no time to cut at).
 * - castassembly.ts replayedCastStops / query.ts replayTimeStops: what the replay holds (its casts, an ultimate placed
 *   from its cast event included); for every hold bound, world-time view and diagnosis text.
 * Every list is built by skillStops and cut by withResets; nothing else in packages/logs reads SkillTiming.slowdowns or
 * resets for a list (tests/stops-source.test.ts).
 */
export function castTimeStops(data: GameData, casts: readonly LoggedCast[], frames?: ReadonlyMap<LoggedCast, readonly number[]>): TimeStop[] {
  return withResets(distinctCasts({ hits: new Map(), casts }).map((c) => skillStops(data, c.skillId, Math.round((c.start * FPS) / 1000), { operator: c.operator, skillId: c.skillId, kind: c.kind }, frames?.get(c))));
}

/** The world's time from `from` to `to` ms under time stops, in ms: each frame counts at the lowest scale of the stops then (1 without one). */
export function worldMs(from: number, to: number, stops: readonly TimeStop[]): number {
  const [a, b] = [Math.round((from * FPS) / 1000), Math.round((to * FPS) / 1000)];
  const relevant = stops.filter((s) => s.start < b && s.start + s.scales.length > a);
  if (relevant.length === 0) return to - from;
  // Only the frames a stop covers (a cast long before a landing spans many without one), in frame order.
  const rates = new Map<number, number>();
  for (const s of relevant) {
    for (let f = Math.max(a, s.start); f < Math.min(b, s.start + s.scales.length); f++) rates.set(f, Math.min(rates.get(f) ?? 1, s.scales[f - s.start] as number));
  }
  let held = 0;
  for (const f of [...rates.keys()].sort((x, y) => x - y)) held += 1 - (rates.get(f) as number);
  return to - from - msOf(held);
}

/**
 * Where a cast started whose landing at kit frame `frame` is logged at `t` ms, if other casts' time stops held it:
 * `frame` frames of the world's time before it, each frame a stop covers counting at its lowest scale (worldMs's
 * inverse). Without a stop between, `t` less the frame.
 */
export function heldStart(t: number, frame: number, stops: readonly TimeStop[]): number {
  const plain = t - msOf(frame);
  if (frame <= 0) return plain;
  const b = Math.round((t * FPS) / 1000);
  if (!stops.some((s) => s.start < b && s.start + s.scales.length > Math.round((plain * FPS) / 1000))) return plain;
  const reach = frame + stops.reduce((n, s) => n + s.scales.length, 0);
  const relevant = stops.filter((s) => s.start < b && s.start + s.scales.length > b - reach);
  let world = 0;
  let n = 0;
  while (world < frame - 1e-9 && n < reach) {
    const f = b - 1 - n;
    let rate = 1;
    for (const s of relevant) if (f >= s.start && f < s.start + s.scales.length) rate = Math.min(rate, s.scales[f - s.start] as number);
    world += rate;
    n++;
  }
  return t - msOf(n);
}

/**
 * A slow-down's scale at or below which the world stands still for the log (ownStopLoggedFrame). A partial one doesn't
 * hold the log's hits: with any frame below 1 counted, 4e5e1390085e, db8711232de9, 0eef2474a26f and others moved too.
 */
export const OWN_STOP_SCALE = 0.05;

/**
 * The frame of its cast a landing at kit frame `frame` is logged at: inside the cast's own stop (a frame its slow-down,
 * SkillTiming.slowdowns, stops the world: OWN_STOP_SCALE) the log has it where the slow-down ends (its last frame below
 * scale 1), as it
 * batches every hit inside a stop (docs/design/data.md "What the log records"); elsewhere its frame. Liino's combo, hit 1
 * at frame 9 inside its slow-down (0.01 to frame 10, back to 1 at frame 26): in her 64 combos in the development logs
 * the latest teammate's hit before hit 1 is logged 0.79–1.8 s before it (median 1.0 s; 5 under 0.65 s where hits
 * overlap a log's start or another stop), and hit 2 (frame 33) follows it by 0.1–0.9 s (median 0.23 s), not 0.8 s;
 * placed at frame 9, her cast and its stop came 0.6 s late (d774d0ce7bd3 98.43 s: Zhuang Fangyi's Thunder Strikes ran on
 * 0.6 s into the hold the log shows from 97.9 s). A detached hit (on its way) isn't the cast's own landing.
 */
export function ownStopLoggedFrame(timing: SkillTiming | null | undefined, hits: readonly KitHit[], frame: number): number {
  if (!timing || hits.length === 0 || hits.some((h) => h.detached || h.launch !== undefined || h.enemyDelay !== undefined)) return frame;
  for (const d of timing.slowdowns) {
    const i = frame - d.from;
    if (i >= 0 && i < d.scales.length && (d.scales[i] as number) <= OWN_STOP_SCALE) return d.from + d.scales.findLastIndex((x) => x < 1) + 1;
  }
  return frame;
}

/** How far before a cast's held start (heldStart) the log's cast event of its skill may be and still be its (ms). */
const HELD_EVENT_MS = 2000;

/**
 * Where a new cast starts: its first logged landing less the landing's frame; or, when other casts' time stops fall
 * between, that many frames of the world's time before the landing (heldStart), if the log's cast event of the skill
 * says so: the event nearest the held start is nearer it than the plain one (1cd1657bc305: Typhoeus's combo, its
 * arrows at 39.04 s at frame 35, pressed at 34.70 s; placed at 37.87 s, after Liino's ultimate stop, the replay cast it
 * after her hover had ended). Without such an event the plain start: a stop placed a little off would move a cast
 * pressed as it ended to before it (dbaee23b801d: Li Zhiyan's combo at 8.0 s, its event at 8.26 s, after Liino's
 * ultimate stop). A combo isn't held by another's combo: combos pressed together take their turns, each starting as
 * the one before lets it (bdf223db8e49: Jsspsi's combo, its event at 10.46 s, its first slash at 11.94 s at frame 14
 * across Typhoeus's and Liino's combos; started before them, the replay held Corrosion's ramp 0.4 s too long). Not
 * before the event: a stop placed a little early moves the held start before what the operator did up to the press
 * (9090afbacec9: Typhoeus's combo, pressed at 60.63 s after her shot at 60.60 s, held from 60.01 s; cast before the
 * shot, the replay cast it grounded; 4d60e7fe92c2: Li Zhiyan's combo before her attack 4's last hits at 80.14 s).
 */
function castStart(t: number, frame: number, stops: readonly TimeStop[], events: readonly number[], breaks: readonly TimeStop[] = []): number {
  const plain = t - msOf(frame);
  const held = heldStart(t, frame, stops);
  // The breaks' holds after a start the landing gave (not the event's: a press is where it is), the cast running then.
  const atBreaks = (s: number, base: readonly TimeStop[]) => {
    const [a, b] = [Math.round((s * FPS) / 1000), Math.round((t * FPS) / 1000)];
    const running = breaks.filter((x) => x.start > a && x.start < b);
    return running.length ? heldStart(t, frame, [...base, ...running]) : s;
  };
  if (held >= plain - msOf(1)) return atBreaks(plain, []);
  const near = events.filter((e) => e >= held - HELD_EVENT_MS && e <= t);
  if (near.length === 0) return atBreaks(plain, []);
  const e = near.reduce((a, x) => (Math.abs(x - held) < Math.abs(a - held) ? x : a));
  if (Math.abs(e - held) >= Math.abs(e - plain)) return atBreaks(plain, []);
  return e > held ? e : Math.max(atBreaks(held, stops), e);
}

/** How close (ms) a landing logged at a frozen stop's end is to that end (the log's ms are batched). */
const STOP_END_MS = 150;
/** How long before a frozen stop's start (ms) a landing may come and still be logged at its end. */
const BEFORE_STOP_MS = 200;

/**
 * The start of a cast whose first landing the log gives at the end of another cast's frozen stop (scale ≤
 * OWN_STOP_SCALE) when its cast event puts that landing just before the stop (within BEFORE_STOP_MS, no stop between):
 * the event, or null. The log batches what lands as the world stops with the stop's end. a7a7a40c97ed: Arcane's battle
 * skill, its event at 2.31 s, its frame-20 hit at 2.98 s, before Liino's combo stop (3.00–3.93 s), logged at 3.86 s;
 * placed through the stop (from 2.56 s), the replay landed it and its Corrosion 0.9 s late.
 */
function beforeStopStart(t: number, frame: number, stops: readonly TimeStop[], events: readonly number[]): number | null {
  if (frame <= 0) return null;
  for (const s of stops) {
    if (!s.scales.some((x) => x <= OWN_STOP_SCALE)) continue;
    const [from, to] = [msOf(s.start), msOf(s.start + s.scales.findLastIndex((x) => x < 1) + 1)];
    if (Math.abs(t - to) > STOP_END_MS) continue;
    const fits = events.filter((e) => {
      const lands = e + msOf(frame);
      return lands <= from && lands >= from - BEFORE_STOP_MS && !stops.some((o) => o !== s && msOf(o.start) < from && msOf(o.start + o.scales.length) > e);
    });
    if (fits.length) return fits.reduce((a, e) => (Math.abs(e + msOf(frame) - from) < Math.abs(a + msOf(frame) - from) ? e : a));
  }
  return null;
}

/** How long (ms of the world's time) a detached landing may come after its ultimate's stop ends and the stop still be its event's (eventStopStart). */
const TRAVEL_MS = 1200;
/** How close to a stop's edges a logged hit may be and not count as inside it (ms; the log batches at a stop's end). */
const STOP_EDGE_MS = 100;
/**
 * How much earlier than its landing's frame says an event's start must be to move the cast (ms; eventStopStart): within
 * it the log's batching (its ms are a frame or two off) says nothing, and a frame's move shifts the holds and ramps
 * (d9e59d0fb737: Liino's ultimate 20 ms earlier, three Corrosion readings worse).
 */
const MIN_MOVE_MS = 150;

/**
 * The start of an ultimate whose first landing travels (KitHit.travels, from the data's LaunchProjectile: Liino's
 * Pyrotechnics, kit frame 76, which fly to the enemy and land 0.1–0.8 s of the world's time after the frame; Ardelia's
 * sheep; Fluorite's shots) from its cast event, which the log has at an
 * edge of the ultimate's time stop: at its end (no hit by anyone in the stop's length before the event: the press
 * waited for the stop to be logged, as Laevatain's, Si's and most ultimates' events are) or at its start (none in the
 * stop's length after it). Of such events between where the stop would start and the landing, the one whose stop
 * ends nearest before the landing, within TRAVEL_MS of the world's time; null without one (the landing's frame then
 * places it). 1cd1657bc305: Liino's event at 37.95 s after 3.6 s without a hit, her first projectiles at 38.73 s;
 * placed from them at 36.19 s, her Cosmovoice Amp (frame 77) began after Typhoeus's burst and Arcane's seal at 37.97 s,
 * both ×1.5 in the log. af7b7f865906: her event at 56.50 s, the projectiles at 59.94 s across Ardelia's ultimate stop;
 * placed at 57.41 s, her stop covered teammates' logged hits. A landing that travels always looks for its event; any
 * other detached one (an ability entity's: Tangtang's stare, Arclight's dash) only where its frame puts the stop over a
 * teammate's logged hit (`checked`), which keeps Si's slashes at their frames (b6aa). 2026-11-24: the event for every
 * travelling landing, with or without that check, placed each projectile ultimate in the logs the same; the ability
 * entities need it (only travelling landings from events: b7b3's Tangtang stare from its frame, plain 47 → 45).
 */
function eventStopStart(timing: SkillTiming | null | undefined, operator: string, t: number, frame: number, stops: readonly TimeStop[], events: readonly number[], hits: readonly LogHit[], checked: boolean): number | null {
  const frames = fullStopFrames(timing);
  if (frames === null) return null;
  const length = msOf(frames);
  const plain = t - msOf(frame);
  const quiet = (from: number, to: number) => !hits.some((h) => h.t > from + STOP_EDGE_MS && h.t < to - STOP_EDGE_MS);
  // Checked: only where the landing's frame puts the stop over a teammate's logged hit (not one batched at another
  // stop's end): the log then says the world ran there.
  const batched = (ms: number) => stops.some((s) => Math.abs(msOf(s.start + s.scales.length) - ms) <= STOP_EDGE_MS);
  if (checked && !hits.some((h) => h.operator !== operator && h.t > plain + STOP_EDGE_MS && h.t < plain + length - STOP_EDGE_MS && !batched(h.t))) return null;
  let best: { start: number; travel: number } | null = null;
  for (const e of events) {
    for (const start of [e - length, e]) {
      const end = start + length;
      if (start > plain - MIN_MOVE_MS || end > t + msOf(1)) continue;
      if (!(start === e ? quiet(e, e + length) : quiet(e - length, e))) continue;
      const travel = worldMs(end, t, stops);
      if (travel > TRAVEL_MS || (best && travel >= best.travel)) continue;
      best = { start: Math.round(start), travel };
    }
  }
  return best?.start ?? null;
}

/** The length (frames) of a skill's full time stop from its frame 0 (an ultimate's UltimateTimeAction), or null without one. */
function fullStopFrames(timing: SkillTiming | null | undefined): number | null {
  const stop = timing?.slowdowns.find((d) => d.from === 0 && Math.min(...d.scales) === 0);
  return stop ? stop.scales.length : null;
}

/** How many frames two ultimates' time stops may overlap and still have played in turn (the log's batching, a frame's rounding). */
const IN_TURN_SLACK_FRAMES = 1;

/**
 * The start of an ultimate whose landing's frame puts its time stop over another operator's ultimate stop, where the
 * game played them in turn: the landing held by the other's stop (heldStart), when that start's own stop ends before
 * any other ultimate's stop begins (IN_TURN_SLACK_FRAMES); null otherwise. Ultimates pressed together play their stops
 * one after the other, the later one's hits after its own: fc63a2001251 39.92 s, Gilberta's ultimate (hit at frame 60,
 * logged 43.58 s) before Perlica's (41.77 s, from her hit's frame 58): no logged hit by anyone in 39.94–41.73 s,
 * Typhoeus's Barrage Array ticking once in the gap (frame 75 at 41.73 s, frame 65 at 38.17 s), her shot's burst and
 * Arcane's after the second stop (43.58, 44.63 s). Placed from its frame overlapping Perlica's, the world ran 1.7 s
 * there and both bursts came early. 1d9198480e75: Arcane's ultimate_skill2 (frame 58 at 66.90 s) at 62.40 s, before
 * Liino's (her event at 64.22 s): the log has no hit in 62.23–64.01 s. scripts/probes/placement/ult-overlap.ts lists
 * the logs' overlapping pairs and the quiet stretch where the first one's stop was.
 */
function inTurnStart(timing: SkillTiming | null | undefined, t: number, frame: number, stops: readonly TimeStop[], hits: readonly LogHit[]): { readonly start: number | null; readonly why: Pick<InTurnRecord, "verdict" | "checks" | "candidate"> } {
  const n = fullStopFrames(timing);
  if (n === null || frame <= 0) return { start: null, why: { verdict: "no-overlap" } };
  const ults = stops.filter((s) => s.kind === "ultimate" && s.scales.some((x) => x <= OWN_STOP_SCALE));
  const overlaps = (start: number) => ults.some((s) => start < s.start + s.scales.length - IN_TURN_SLACK_FRAMES && s.start < start + n - IN_TURN_SLACK_FRAMES);
  const plain = Math.round(((t - msOf(frame)) * FPS) / 1000);
  const overlapped = ults.filter((s) => plain < s.start + s.scales.length - IN_TURN_SLACK_FRAMES && s.start < plain + n - IN_TURN_SLACK_FRAMES);
  if (overlapped.length === 0) return { start: null, why: { verdict: "no-overlap" } };
  // The log says the world stood still there: no logged hit inside the moved stop.
  const inside = (start: number) => hits.filter((h) => h.t > start + STOP_EDGE_MS && h.t < start + msOf(n) - STOP_EDGE_MS).length;
  const quiet = (start: number) => inside(start) === 0;
  // In turn, it moves by no more than the stops it overlapped (9c6e97486a9d: Arcane's ultimate_skill2 held 4.3 s
  // through Liino's stop and Ardelia's combo, which moved Liino's in turn: two targets' landings).
  const reach = overlapped.reduce((a, s) => a + s.scales.length, 0) + IN_TURN_SLACK_FRAMES;
  const checks = (start: number): InTurnChecks => ({
    early: start <= t - msOf(frame) - MIN_MOVE_MS,
    reach: t - msOf(frame) - start <= msOf(reach),
    reachMs: Math.round(msOf(reach)),
    free: !overlaps(Math.round((start * FPS) / 1000)),
    quiet: quiet(start),
    hitsInside: inside(start),
  });
  const fits = (start: number) => { const c = checks(start); return c.early && c.reach && c.free && c.quiet; };
  const held = heldStart(t, frame, stops);
  const verdict = (start: number | null, candidate: number) => ({ start, why: { verdict: start === null ? ("refused" as const) : ("moved" as const), checks: checks(start ?? candidate), candidate: Math.round(start ?? candidate) } });
  // A landing logged at the end of the stop it overlapped is batched there (it came due anywhere in that stop): its
  // stop ended between where the landing's world frames put it (heldStart) and where that stop begins, the latest
  // start the log leaves quiet (40d9a3c1da37: Gilberta's ultimate, frame 60, at Si's stop end 12.95 s, the log quiet
  // 9.33–11.00 s; 00ae0a364ad4: hers at Perlica's stop end 60.10 s, hits at 58.20 s between the two stops).
  const batched = overlapped.find((s) => Math.abs(t - msOf(s.start + s.scales.length)) <= STOP_EDGE_MS);
  if (batched) {
    for (let f = batched.start - n; f >= Math.round((held * FPS) / 1000); f--) if (fits(msOf(f))) return verdict(msOf(f), msOf(f));
    return verdict(null, msOf(batched.start - n));
  }
  return verdict(fits(held) ? held : null, held);
}

/** inTurnStart's checks of a candidate start (InTurnRecord.checks): each must hold for the move. */
export interface InTurnChecks {
  /** At least MIN_MOVE_MS before where its landing's frame puts it. */
  readonly early: boolean;
  /** No farther than the stops it overlapped hold (reachMs). */
  readonly reach: boolean;
  readonly reachMs: number;
  /** Its moved stop overlaps no other ultimate's. */
  readonly free: boolean;
  /** No logged hit inside its moved stop (hitsInside of them). */
  readonly quiet: boolean;
  readonly hitsInside: number;
}

/**
 * What the in-turn rule (inTurn) decided for an ultimate it looked at in the placement's last pass (Placement.inTurn,
 * round 13's backlog point 1): `moved` (to `candidate`), `event` (placed from its cast event: fromEvent), `beforeStop`
 * (at another stop's end), `held` (its start held to its event, not its landing's frame: castStart), `no-overlap`
 * (its stop overlaps no other ultimate's), `refused` (a check failed for `candidate`, the start it tried; `checks`).
 */
export interface InTurnRecord {
  readonly cast: LoggedCast;
  readonly verdict: "moved" | "event" | "beforeStop" | "held" | "no-overlap" | "refused";
  readonly checks?: InTurnChecks;
  /** The start tried (ms): the move's, or the refused one's. */
  readonly candidate?: number;
}

/**
 * The placement with each ultimate placed from its landing's frame (not from a cast event or a held start) whose time
 * stop overlaps another operator's ultimate stop moved to where the game played them in turn (inTurnStart): in time
 * order, against the stops of the placement as moved so far (a pair moves one of its two: fc63a2001251's Gilberta, not
 * Perlica, whose own start then stands).
 */
function inTurn(data: GameData, fx: LogFixture, placement: Placement): Placement {
  const sorted = [...fx.hits].sort((a, b) => a.t - b.t);
  const opening = new Map<LoggedCast, { readonly h: LogHit; readonly p: PlacedHit }>();
  for (const [h, p] of placement.hits) {
    if (p.index !== 0 || p.frame === undefined || p.sameAs !== undefined || h.event !== p.cast.key) continue;
    const cur = opening.get(p.cast);
    if (!cur || h.t < cur.h.t) opening.set(p.cast, { h, p });
  }
  const frames = castFrames(placement);
  let casts = [...placement.casts];
  const moved = new Map<LoggedCast, LoggedCast>();
  const records: InTurnRecord[] = [];
  for (const c of casts.filter((x) => x.kind === "ultimate").sort((a, b) => a.start - b.start)) {
    if (c.fromEvent || c.beforeStop !== undefined) {
      records.push({ cast: c, verdict: c.fromEvent ? "event" : "beforeStop" });
      continue;
    }
    const o = opening.get(c);
    if (!o || o.p.frame === undefined) continue;
    const timing = data.skills[c.skillId]?.timing;
    const frame = ownStopLoggedFrame(timing, o.p.hits, o.p.frame);
    // Only a cast its landing's frame placed (not one held to its event: castStart).
    if (Math.abs(c.start - (o.h.t - msOf(frame))) > msOf(1)) {
      records.push({ cast: c, verdict: "held" });
      continue;
    }
    const stops = castTimeStops(data, casts, frames).filter((s) => s.operator !== c.operator);
    const r = inTurnStart(timing, o.h.t, frame, stops, sorted);
    if (r.start === null) {
      records.push({ cast: c, ...r.why });
      continue;
    }
    const next: LoggedCast = { ...c, start: Math.round(r.start) };
    casts = casts.map((x) => (x === c ? next : x));
    frames.set(next, frames.get(c) ?? []);
    moved.set(c, next);
    records.push({ cast: next, ...r.why });
  }
  if (moved.size === 0) return { ...placement, inTurn: records };
  return { ...placement, casts, inTurn: records, hits: new Map([...placement.hits].map(([h, p]) => [h, moved.has(p.cast) ? { ...p, cast: moved.get(p.cast) as LoggedCast } : p])) };
}

/**
 * A new cast's start (castStart), or its event's with the landings the stop's end batched (beforeStopStart,
 * LoggedCast.beforeStop). `breaks`: the holds at the log's Stagger breaks the cast ran through (engine assumption
 * break-held-starts `held`; empty under `unheld`, the default).
 */
function newCastStart(t: number, frame: number, stops: readonly TimeStop[], events: readonly number[], breaks: readonly TimeStop[]): Pick<LoggedCast, "start" | "beforeStop"> {
  const early = beforeStopStart(t, frame, stops, events);
  return early === null ? { start: castStart(t, frame, stops, events, breaks) } : { start: early, beforeStop: t };
}

/**
 * Whether the log's cast event of `eventSkill` (LogFixture.casts) is one of the kit skill `skillId`: the same skill, or,
 * for an event of a skill the operator's kit doesn't have, the kit's skill in its slot (the log names the slot:
 * Typhoeus's battle skill normal_skill_floating_start as normal_skill, her hovering ultimate as ultimate_skill).
 */
/** The buffs a predicate needs active (a `buffActive`, alone or in an `all`). */
export function neededBuffs(p: Predicate | undefined): string[] {
  if (!p) return [];
  if ("buffActive" in p) return [p.buffActive];
  if ("all" in p) return p.all.flatMap(neededBuffs);
  return [];
}

/** Whether a condition (`not` a buff active: a branch's, a skill's availability) rules out a skill whose availability needs that buff. */
export function excludes(branch: Predicate | undefined, available: Predicate | undefined): boolean {
  const without = branch && "not" in branch ? neededBuffs(branch.not) : [];
  return without.length > 0 && neededBuffs(available).some((b) => without.includes(b));
}

/**
 * Whether two skills of a kind are one button's variants by their kits' availability: one is castable only without a
 * buff the other needs (Laevatain's battle skill, `not` Twilight, and her Twilight battle skill, which needs it), a buff
 * neither of them gives on its cast: not a skill and the follow-up its own cast makes ready (Purrchena's battle skill
 * gives counter_ready, which her counter needs: 04d401ad257e, 99fb3c35fda2, where each logged press is the battle skill).
 */
export function buttonVariants(kit: Pick<OperatorKit, "triggers">, a: { readonly skillId: string; readonly kind: SkillType; readonly available?: Predicate }, b: { readonly skillId: string; readonly kind: SkillType; readonly available?: Predicate }): boolean {
  const gives = (x: typeof a, buffs: readonly string[]) =>
    kit.triggers.some((t) => t.on.event === "cast" && (t.on.skills ?? []).includes(x.skillId) && allActions(t.do).some((d) => d.kind === "buff" && buffs.includes(d.buff)));
  return a.kind === b.kind && (excludes(a.available, b.available) || excludes(b.available, a.available)) && !gives(a, neededBuffs(b.available)) && !gives(b, neededBuffs(a.available));
}

export function castEventOf(eventSkill: string, skillId: string, kitSkills: ReadonlySet<string>): boolean {
  return skillId === eventSkill || (!kitSkills.has(eventSkill) && skillId.startsWith(eventSkill));
}

/** A kit skill's or trigger's hits: a skill's land on its cast's frames, a trigger's on its firing's. */
interface Group {
  readonly id: string;
  /** Where its hits' values come from (the skill, or the trigger's skill). */
  readonly skillId: string;
  /** The cast kind of a skill's hits; null for a trigger's. */
  readonly kind: SkillType | null;
  /** For a trigger on casts of some skills: those skills, and its delay in frames. */
  readonly anchor: { readonly skills: readonly string[]; readonly delay: number } | null;
  /**
   * For a trigger on landings with a decoration (a dive attack): the logged times (ms) of the hits that can fire it, its
   * firings' starts; its hits' casts are placed from these as a skill's are from its other keys (choose).
   */
  readonly firedAt?: readonly number[];
  readonly hits: readonly KitHit[];
  /** Each hit's multiplier from its skill's values (nominalScale), where it has one: what its landing's value is in proportion to. */
  readonly scales: ReadonlyMap<KitHit, number>;
  /** The multipliers a hit whose value expression reads its event's count takes (nominalScales), where it has no single one. */
  readonly ranges: ReadonlyMap<KitHit, readonly number[]>;
}

/** One landing slot of a key: the kit hits it can be (alternatives at one frame), the likeliest first. */
interface Slot {
  readonly frame: number;
  readonly hits: readonly KitHit[];
  /** The slots follow one of the key's variants (variantOrder): a cast may make fewer of them. */
  readonly variant?: true;
  /** The other variants' hits at this slot (their landing of the same turn), each at its own frame in its cast. */
  readonly at?: ReadonlyMap<KitHit, number>;
}

export interface LoggedCast {
  readonly operator: string;
  readonly key: string;
  /** The kit skill whose cast this is, or the trigger's group (`trigger:<id>`). */
  readonly group: string;
  /** Where the cast's hits' values come from. */
  readonly skillId: string;
  /** The skill's cast kind; null for a trigger's hits. */
  readonly kind: SkillType | null;
  /** The cast's start in ms: its first logged landing's time less that landing's frame. */
  readonly start: number;
  /** A trigger's hits on casts of some skills: those skills and its delay in frames (Group.anchor). */
  readonly anchor?: { readonly skills: readonly string[]; readonly delay: number };
  /**
   * The ms of the landings the log gave at the end of another cast's frozen stop although they landed before it
   * (beforeStopStart: the cast starts at its event): they land at their kit frames from the start, not at this ms.
   */
  readonly beforeStop?: number;
  /** Placed from its cast event at an edge of its stop (eventStopStart), not from its landing's frame. */
  readonly fromEvent?: true;
  /** Which rule chose its skill among the several its first key's candidates were (choose; `zmdlogs casts --choices`). */
  readonly chosen?: CastChoice;
  /**
   * A new cast's first landing on its skill's other paths (pathAlternatives): where it lies in the part a conditional
   * jump skips, its twin past the jump with the start that would give, and whether the operator's previous cast allows
   * each start (a record: `zmdlogs casts --choices` prints it on the CAST line; jumpedFirst decides).
   */
  readonly paths?: readonly PathAlternative[];
  /**
   * Opened because its first landing came past the channel's end of the operator's cast of its key before (logcasts.ts
   * placeWith `pastChannel`; a record for `zmdlogs casts --choices`): that cast's start, the world ms from its first
   * landing, the channel's end from there (ms), and which bound: past CHANNEL_SLACK_MS, or past ON_TIME_MS with a press
   * between. split:channel-end
   */
  readonly pastChannel?: { readonly cast: number; readonly elapsed: number; readonly end: number; readonly by: "slack" | "press" };
}

/**
 * One start a new cast's first landing could have (LoggedCast.paths): on the skipped part's slot (`jump` null: slot 0,
 * its frame) or on a conditional jump's path (its `at` → `to`, the twin hit past it, its slot's frame less the jump);
 * `allowed`: the operator's previous cast's windows let the skill start there (jumpedFirst's test).
 */
export interface PathAlternative {
  readonly jump: { readonly at: number; readonly to: number } | null;
  readonly hitId: string;
  readonly frame: number;
  readonly start: number;
  readonly allowed: boolean;
}

/**
 * How choose picked a new cast's skill among the groups sharing its key (round 13's backlog point 1): `anchor` the one
 * whose anchor's start (the skill's own cast from another key, or the skill a trigger fires on plus its delay) was
 * nearest (`ref` its ms, `d` how far); `alike` the step whose window of the latest cast (`by`) lies nearest (`d` ms
 * outside it); `window` the chain step after `by` whose windows list it; `restart` basic steps alike after a cast whose
 * windows list none of them (the chain restarted: the first in kit order); `first` the kit's order, nothing else
 * deciding; `late` a landing of a cast already opened (the latest it fits).
 */
export interface CastChoice {
  readonly rule: "anchor" | "alike" | "window" | "restart" | "first" | "late";
  /** The groups it chose among (kit order). */
  readonly candidates: readonly string[];
  /** The cast whose windows decided (alike, window, restart). */
  readonly by?: { readonly skillId: string; readonly start: number };
  /** The anchor's start (ms; anchor). */
  readonly ref?: number;
  /** The step between whose keys the log lacks (window: the candidate listed in its windows). */
  readonly via?: string;
  /** How far (ms): from the anchor, or outside the window. */
  readonly d?: number;
}

export interface PlacedHit {
  readonly cast: LoggedCast;
  /** Which logged landing of its key in the cast it is (0: the first). */
  readonly index: number;
  /** The kit hits it can be (the slot's), the likeliest first. */
  readonly hits: readonly KitHit[];
  /** The slot's frame in its cast (absent when the key's landing order is unknown). */
  readonly frame?: number;
  /** The slot's hits of other variants at their own frames (Slot.at): where one of them is the cast's, it lands there. */
  readonly at?: ReadonlyMap<KitHit, number>;
  /** The same landing on another enemy (a fight against several in a single-target log): the logged hit whose landing it shares. */
  readonly sameAs?: LogHit;
  /** The rule that made it sameAs (PlacedTwin; `zmdlogs casts --choices` prints it). */
  readonly twin?: PlacedTwin;
  /** Why it joined a cast placed before it rather than open one (absent: it opened its cast, or the realignment moved it): PlacedJoin. */
  readonly joined?: PlacedJoin;
}

/**
 * Which rule of placeWith joined a logged landing to a cast placed before it (round 18, the placement-cases report
 * point 1: f879's 94.71 s explosion joined its cast 7.6 s late, and which of six conditions did it took a read of
 * placeWith): `span` within the cast's landings' span, `to come` slots to come within the skill's whole action, `paced`
 * a detached series' next landing at its gap, `same ultimate` within an ultimate's action, `delayed` a delayed hit's
 * landing (joinDelayed), `reach` a key's first landing within an earlier cast's reach (joinable). `elapsed` the world
 * ms from the cast's first landing (from its start: delayed, reach), `due` the slot's kit frame from the same point (ms;
 * absent where the key's slots are unknown). `zmdlogs casts --choices` prints it where elapsed passes due by more than
 * CAST_SLACK_MS.
 */
export interface PlacedTwin {
  /**
   * `value` its value is the slot's landing's again and not the next slot's (sameByValue); `used` the cast's landings
   * of its key all logged, its value not a next cast's first's (nextByValue); `batch` in a fight read per target
   * (several-targets), its place in its batch (the key's alike hits at its ms) is a twin's by the batch's targets
   * (targets.ts batchTargets: `targets` per landing, of `batch` hits, decided `by`); `later` in such a fight, a used-up
   * combo's landing logged within TWIN_LATER_MS after its last, of its value, with no cast event of its skill between;
   * `time` in such a fight, logged at its slot's landing's ms where the next slot is due `due` ms later and no stop
   * between could have batched both at one ms (placeWith's byTime).
   */
  readonly rule: "value" | "used" | "batch" | "later" | "time";
  readonly due?: number;
  readonly targets?: number;
  readonly batch?: number;
  readonly by?: string;
}

export interface PlacedJoin {
  readonly by: "span" | "to come" | "paced" | "same ultimate" | "delayed" | "reach";
  readonly elapsed: number;
  readonly due?: number;
}

/**
 * A cast's landings of one key that realignByValue looked at and left on their slots by time, and why (round 18, the
 * replay-only report point 3: 6339's final, skipped as "every value of unknown crit", found by a stderr print), or
 * moved (`realigned`): `zmdlogs casts --choices`' REALIGN lines. Only keys with two landings or more and slots to spare.
 */
export interface RealignRecord {
  readonly cast: LoggedCast;
  readonly key: string;
  readonly landings: number;
  readonly why: string;
  readonly realigned: boolean;
}

export interface Placement {
  readonly hits: ReadonlyMap<LogHit, PlacedHit>;
  readonly casts: readonly LoggedCast[];
  /** Per skill, how close casts of it placed from different keys are one cast, in ms (mergeMs; absent: CAST_MERGE_MS). */
  readonly merge?: ReadonlyMap<string, number>;
  /** What the in-turn rule decided for each ultimate it looked at (inTurn; its last run's: `zmdlogs placement --choices`). */
  readonly inTurn?: readonly InTurnRecord[];
  /** What realignByValue decided for each cast's key it looked at (placeWith's own pass). */
  readonly realign?: readonly RealignRecord[];
}

/**
 * The placement's groups of an operator: one per kit skill, and one per kit trigger with hits (`trigger:<id>`, kind
 * null). A trigger group is placed for its hits' pairing only (their slots and values): the replay never casts it, it
 * lands the hits from the trigger's event and matches them to the log by time, so its landings are never pinned
 * (castassembly.ts replayedCasts says so on a NOLAND line; round 20, the Vesperwings report point 2). A trigger hit
 * given a log key therefore makes such a group by design.
 */
function groupsOf(data: GameData, build: Build, panel: StatPanel, fx: LogFixture): Group[] {
  const team = fx.team;
  const kit = effectiveKit(data, build);
  if (!kit) return [];
  const available = (skillId: string) => (h: KitHit) => hitAvailable(data, build, panel, skillId, h, { team });
  const scales = (skillId: string, hits: readonly KitHit[]) => {
    const out = new Map<KitHit, number>();
    for (const h of hits) {
      const v = nominalScale(data, build, panel, skillId, h);
      if (v !== null) out.set(h, v);
    }
    return out;
  };
  const ranges = (skillId: string, hits: readonly KitHit[]) => {
    const out = new Map<KitHit, readonly number[]>();
    for (const h of hits) {
      const v = nominalScales(data, build, panel, skillId, h);
      if (v !== null) out.set(h, v);
    }
    return out;
  };
  return [
    ...kit.skills.map((s): Group => {
      const hits = s.hits.filter(available(s.skillId));
      return { id: s.skillId, skillId: s.skillId, kind: s.kind, anchor: null, hits, scales: scales(s.skillId, hits), ranges: ranges(s.skillId, hits) };
    }),
    ...kit.triggers.flatMap((t): Group[] => {
      const skillId = triggerSkillId(kit.operator, t);
      const hits = allActions(t.do).flatMap((a) => (a.kind === "hits" ? a.hits : [])).filter(available(skillId));
      if (hits.length === 0) return [];
      const anchor = t.on.event === "cast" && t.on.skills?.length ? { skills: t.on.skills, delay: t.delay ?? 0 } : null;
      const fired = t.on.event === "hit" && t.on.decorations?.length ? decoratedHits(data, fx, t.on.decorations, t.by === "self" ? build.operator : null) : t.on.event === "physicalStatus" ? statusHits(fx, t.on.statuses, t.by, build.operator) : undefined;
      const firedAt = fired?.map((h) => h.t + msOf(t.delay ?? 0));
      return [{ id: `trigger:${t.id}`, skillId, kind: null, anchor, ...(firedAt ? { firedAt } : {}), hits, scales: scales(skillId, hits), ranges: ranges(skillId, hits) }];
    }),
  ];
}

/**
 * A kit hit's multiplier from its skill's values alone (the product of its `scale` keys and its literal factor): its
 * landings' values are in that proportion to another hit's of the cast, up to the buffs between them. Null for a hit
 * whose damage isn't a plain multiple of it (a reaction's, a status's, fixed damage, a value or extra scale judged at
 * the landing).
 */
export function nominalScale(data: GameData, build: Build, panel: StatPanel, skillId: string, h: KitHit): number | null {
  if (h.reaction || h.status || h.fixedDamage !== undefined || h.scaleValue !== undefined || h.extraScale?.length || h.scale.length === 0) return null;
  const v = h.scale.reduce((a, key) => a * skillValue(data, panel, build, skillId, key), h.factor ?? 1);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** The event counts a value expression's multiplier is read at (nominalScales): a combo's consumed stacks, 1 to 4. */
const NOMINAL_EVENT_COUNTS = [1, 2, 3, 4];

/**
 * The multipliers of a kit hit whose value expression (KitHit.scaleValue) reads only its skill's values and its event's
 * count (KitHit.scaleValue's `eventCount`), one per count of NOMINAL_EVENT_COUNTS, times its `scale` keys and factor; null
 * for any other hit (nominalScale's, or one the expression needs more for). Si's combo final (atk_scale2 + count ×
 * atk_scale2_1: ×11–20 a slash) was a slot the values couldn't place (pending/zmdlogs-63398339803e.json 11.31 s, the logged
 * final, 121,248 before the slug's cap, on a slash's slot and the replay's final unlogged).
 */
function nominalScales(data: GameData, build: Build, panel: StatPanel, skillId: string, h: KitHit): readonly number[] | null {
  if (h.scaleValue === undefined || h.reaction || h.status || h.fixedDamage !== undefined || h.extraScale?.length) return null;
  const keys = h.scale.reduce((a, key) => a * skillValue(data, panel, build, skillId, key), h.factor ?? 1);
  const out = new Set<number>();
  for (const eventCount of NOMINAL_EVENT_COUNTS) {
    let v: number;
    try {
      v = keys * evaluate(h.scaleValue, evalContext(data, build, panel, skillId, { eventCount }));
    } catch {
      return null;
    }
    if (!Number.isFinite(v) || v <= 0) return null;
    out.add(v);
  }
  return [...out];
}

/**
 * The logged hits that are landings with any of these decorations (hitDecorations: a kit hit of their operator's with the
 * key that has one), all operators' or one's (b7b3762d5da8: Arcane's plunging attack at 15374 ms fires Tangtang's
 * OLDEN STARE dive, whose riot spouts from 15928 ms share her battle skill's key: placed as a battle skill, they made
 * one the log doesn't have, with five shots).
 */
function decoratedHits(data: GameData, fx: LogFixture, decorations: readonly HitDecoration[], operator: string | null): LogHit[] {
  const keys = new Set<string>();
  for (const b of fx.team) {
    if (operator !== null && b.operator !== operator) continue;
    for (const s of effectiveKit(data, b)?.skills ?? []) {
      const finisher = data.skills[s.skillId]?.timing?.specification === 8;
      for (const h of s.hits) if (hitDecorations(h, finisher).some((d) => decorations.includes(d))) for (const e of h.events) keys.add(`${b.operator}|${e}`);
    }
  }
  return fx.hits.filter((h) => keys.has(`${h.operator}|${h.event}`));
}

/**
 * The logged physical-status hits (Lift, Knock Down, Crush, Breach: parseReactionEvent) that can fire a trigger on them
 * (`statuses`, every one when absent), by whom its `by` allows. The Endministrator's Originium Crystals shatter on a
 * teammate's Lift under the key her ultimate's third hit has: placed as an ultimate, each made one the log doesn't have
 * (0c14fb3ce77d: seven, every one at Rossi's Lift's millisecond, 1.17M of replay-only damage).
 */
function statusHits(fx: LogFixture, statuses: readonly string[] | undefined, by: string, operator: string): LogHit[] {
  return fx.hits.filter((h) => {
    const r = parseReactionEvent(h.event);
    if (!r || !["lift", "knockdown", "crush", "breach"].includes(r.kind) || (statuses && !statuses.includes(r.kind))) return false;
    return by === "self" ? h.operator === operator : by === "teammate" ? h.operator !== operator : true;
  });
}

/** A hit's landing frames (a count past its frames repeats the last, `framesEvery` apart); null when it has none. */
export function landingFrames(h: KitHit): number[] | null {
  if (!h.frames?.length) return null;
  const frames = [...h.frames];
  if (typeof h.count === "number") for (let i = frames.length; i < h.count; i++) frames.push((frames.at(-1) as number) + (h.framesEvery ?? 0));
  return frames;
}

/** The frames a hit's landings are logged at: its damage's, `enemyDelay` after a delayed hit's landing (KitHit.enemyDelay). */
export function loggedFrames(h: KitHit): number[] | null {
  return landingFrames(h)?.map((f) => f + (h.enemyDelay ?? 0)) ?? null;
}

/**
 * Where a cast whose landing is at kit frame `frame` ends on its path: the skill's first end (SkillTiming.ends: an
 * InterruptCurSkillAction) after the frame, where no jump from between them can skip it; else Infinity. Pogranichnik's
 * combo jumps at frame 0 to 200, 400 or 600 by its count, each path ended before the next (de6a94e9cf6b 132.20 s: a
 * combo with no logged event, its three slashes joined to the 108.61 s combo, 23 s earlier, whose path-0 slots ran on
 * into the other paths' frames 223, 237 and 261).
 */
export function pathEnd(timing: SkillTiming | null | undefined, frame: number): number {
  const end = timing?.ends.filter((e) => e > frame).sort((a, b) => a - b)[0];
  if (end === undefined || timing?.jumps.some((j) => j.at >= frame && j.at < end && j.to > end)) return Infinity;
  return end;
}

/** The frame a cast's path starts at (the latest jump destination at or before its landing's frame; 0 on the main path). */
function pathStart(timing: SkillTiming | null | undefined, frame: number): number {
  return Math.max(0, ...(timing?.jumps ?? []).map((j) => j.to).filter((to) => to <= frame));
}

/**
 * A group's landing slots of a key in frame order (kit order at one frame);
 * landings of different hits at one frame that both have conditions (`if`,
 * `branch` or `requires`) are alternatives, one slot. Null when a hit with the key has
 * no frames: the order is unknown.
 */
function slotsOf(g: Group, key: string): Slot[] | null {
  const withKey = g.hits.filter((h) => !h.poiseOnly && h.events.includes(key)); // a stagger-only landing (poiseOnly) isn't logged
  if (withKey.some((h) => !loggedFrames(h))) return null;
  const order = variantOrder(withKey);
  const landings: { frame: number; hit: KitHit; order: number }[] = [];
  let n = 0;
  for (const h of order.slotted) for (const frame of loggedFrames(h) as number[]) landings.push({ frame, hit: h, order: n++ });
  landings.sort((a, b) => a.frame - b.frame || a.order - b.order);
  // Alternatives: hits with a condition (`if`), a branch, or a stack requirement (Typhoeus's power shot needs an arrow, the
  // plain one none: one landing per cast, not two).
  const conditional = (h: KitHit) => h.if !== undefined || h.branch !== undefined || h.requires !== undefined;
  const slots: { frame: number; hits: KitHit[] }[] = [];
  for (const l of landings) {
    const last = slots.at(-1);
    if (last && last.frame === l.frame && conditional(l.hit) && last.hits.every((x) => x !== l.hit && conditional(x))) last.hits.push(l.hit);
    else slots.push({ frame: l.frame, hits: [l.hit] });
  }
  // The other variants' hits are alternatives in turn: a variant's n-th landing of the key is the cast's n-th logged one,
  // at that variant's own frame (3aa6ab93bad4: an 8-Sunderblade cast's strikes at frames 23, 29…, its final at 70, against
  // the slots of the 9-blade variant's 22, 28… 73: none fell on a slot's frame, so none was pinned, and the logged strikes
  // took the replay's landings nearest in time, a final for a strike).
  const at = slots.map(() => new Map<KitHit, number>());
  for (const variant of order.others) {
    const turns = variant.flatMap((h) => (loggedFrames(h) as number[]).map((frame, i) => ({ frame, hit: h, i }))).sort((a, b) => a.frame - b.frame || a.i - b.i);
    turns.forEach((x, j) => {
      const slot = slots[j];
      if (!slot || slot.hits.includes(x.hit)) return;
      slot.hits.push(x.hit);
      (at[j] as Map<KitHit, number>).set(x.hit, x.frame);
    });
  }
  return order.others.length ? slots.map((x, j) => ({ ...x, variant: true as const, ...((at[j] as Map<KitHit, number>).size ? { at: at[j] as Map<KitHit, number> } : {}) })) : slots;
}

/**
 * A key's hits split into variants by ranges of one stack (a requirement, or the hit's whole `if`; a cast makes one: Zhuang Fangyi's
 * strike_N / final_N by her Sunderblade count): the slots follow the variant with the most landings, and the others'
 * hits are only alternatives at its frames (3aa6ab93bad4: final_1 at frame 32, between strike_9's 27 and 33, took a
 * cast's second strike, so its seven strikes went to three casts). Without such variants every hit is slotted.
 */
function variantOrder(hits: readonly KitHit[]): { slotted: readonly KitHit[]; others: readonly (readonly KitHit[])[] } {
  const byStack = new Map<string, Map<string, KitHit[]>>();
  // A stack range as a requirement or as the hit's whole condition.
  const rangeOf = (h: KitHit): { stack: string; atLeast?: unknown; below?: unknown } | null => {
    if (h.requires) return h.requires;
    const c = h.if as { stack?: unknown; atLeast?: unknown; below?: unknown } | undefined;
    return c && typeof c.stack === "string" && Object.keys(c).every((k) => k === "stack" || k === "atLeast" || k === "below") ? { stack: c.stack, atLeast: c.atLeast, below: c.below } : null;
  };
  for (const h of hits) {
    const r = rangeOf(h);
    if (!r) continue;
    const range = `${r.atLeast ?? ""}..${r.below ?? ""}`;
    const ranges = byStack.get(r.stack) ?? new Map<string, KitHit[]>();
    ranges.set(range, [...(ranges.get(range) ?? []), h]);
    byStack.set(r.stack, ranges);
  }
  const others = new Set<KitHit>();
  const variants: KitHit[][] = [];
  for (const ranges of byStack.values()) {
    if (ranges.size < 3) continue; // two ranges are alternatives at one frame (an arrow or none)
    const count = (list: readonly KitHit[]) => list.reduce((a, h) => a + (loggedFrames(h)?.length ?? 0), 0);
    const best = [...ranges.values()].reduce((a, b) => (count(b) > count(a) ? b : a));
    for (const list of ranges.values())
      if (list !== best) {
        for (const h of list) others.add(h);
        variants.push(list);
      }
  }
  return { slotted: hits.filter((h) => !others.has(h)), others: variants };
}

const msOf = (frames: number) => (frames * 1000) / FPS;

/**
 * A landing on an ability entity's timeline (SpawnAbilityEntity: `launch`, not a projectile's flight, a buff's world
 * clock, a delay on the enemy's clock or a random count): it comes at its own frame after the launch, whatever the
 * cast does since. Not one the log keys as a buff's (a buff's timeline the cast creates, which the world's holds and
 * the enemy's state can hold: 9a8097fcf351's Rossi combo afterhits, buff_chr_0028_wulfa_combo_2_damage, the third 3.7 s
 * after the second).
 */
function onEntityClock(h: KitHit): boolean {
  return h.detached === true && h.launch !== undefined && h.travels === undefined && h.world === undefined && h.enemyDelay === undefined && h.landedCount === undefined && h.events.every((e) => !e.startsWith("buff_"));
}

/**
 * Whether a group's landings of a key are all known in number: every hit with the key has frames and a literal count (or
 * none). A landing on its way (`detached`, `launch`) may come late, but a cast still makes that many. Alternatives at one
 * frame are one slot (slotsOf).
 */
function exactSlots(g: Group, key: string): boolean {
  return g.hits.filter((h) => !h.poiseOnly && h.events.includes(key)).every((h) => landingFrames(h) !== null && (h.count === undefined || typeof h.count === "number"));
}

/**
 * Places every logged hit (see the file comment), in passes (placementPasses), each reading only what the one before
 * settled:
 *
 * 1. `first`: each operator's casts from its own landings and events, no other cast's stops (placeWith with none).
 * 2. `second`: again, with the first pass's stops (and the unplaced cast events'): the rules that place one cast
 *    against the stops it lies in read them (the world time between its landings, b7b3762d5da8: Tangtang's battle skill
 *    from 11.3 s runs on across Jsspsi's combo and Last Rite's ultimate; heldStart / castStart, beforeStopStart,
 *    eventStopStart, joinable). These stops are the first pass's, which this pass may move: not a fixed point
 *    (settleCheck counts the casts a third pass would move).
 * 3. After the placement settles: rules that compare one cast's stop with another cast's as placed (inTurn: ultimates
 *    pressed together play their stops in turn). Inside pass 2 such a rule cascades: it reads a stop pass 2 is about to
 *    move (remaining-leads report point 2: 4360's Gilberta moved against a Liino stop pass 2 then placed elsewhere;
 *    9c6e's Arcane at 4.3 s moved Liino's). A new rule that reads another cast's placed stop goes here, not in placeWith.
 *
 * ultimateOverlaps lists the ultimate stops still overlapping after pass 3 (tests/logcasts-stops.test.ts pins them).
 */
export function placeHits(data: GameData, fx: LogFixture, assume?: Readings): Placement {
  return placementPasses(data, fx, assume).placed;
}

/**
 * placeHits' passes (its comment): the first placement, the second (from the first's stops), and the placement after
 * the rules over the settled one. `assume`: the run's readings (the holds at the log's Stagger breaks: engine
 * assumptions break-hold, break-hold-place), as the replay's.
 */
export function placementPasses(data: GameData, fx: LogFixture, assume?: Readings): { readonly first: Placement; readonly second: Placement; readonly placed: Placement } {
  const firstPlacement = placeWith(data, fx, [], assume);
  // The placed casts' stops cut at their resets, and the unplaced cast events' stops as they are: an event's time is the
  // press, not the cast, so its reset is no time to cut at (1cd1657bc305: Arcane's combo event at 34.70 s, cast at
  // 35.70 s; cutting Typhoeus's combo at the event's frame 9 moved his basics there, plain 182 → 177: round 7's measure).
  const second = placeWith(data, fx, passStops(data, fx, firstPlacement), assume);
  const placed = inTurn(data, fx, second);
  // An ultimate isn't cast again within its own action: its casts placed from different keys within its duration are one
  // (d774d0ce7bd3: Liino's at 116.5 s, its beats, projectiles and side projectiles placed 2 s apart: three casts, three bombs).
  const merge = new Map<string, number>();
  for (const c of placed.casts) if (c.kind === "ultimate") merge.set(c.skillId, Math.max(CAST_MERGE_MS, msOf(data.skills[c.skillId]?.timing?.durationFrames ?? 0)));
  return { first: firstPlacement, second, placed: { ...placed, merge } };
}

/** The stops a placement pass reads from the one before: its placed casts' (cut at their resets) and the unplaced cast events'. */
function passStops(data: GameData, fx: LogFixture, before: Placement): TimeStop[] {
  return [...castTimeStops(data, before.casts, castFrames(before)), ...unplacedCastStops(data, fx, before.casts).flatMap((p) => p.stops)];
}

/**
 * Whether the placement is a fixed point of pass 2 (placeHits' comment): pass 2 run once more from the final placement's
 * stops, and the casts whose start that moves by more than a frame (each with its start now and in the third pass; a
 * cast gone or new counts too). Non-empty: the casts whose start rests on a stop that pass 2 itself moved, where a rule
 * reading other casts' stops cascades. A diagnosis (`zmdlogs casts --settle`), never part of the placement.
 */
export function settleCheck(data: GameData, fx: LogFixture, placement: Placement = placeHits(data, fx), assume?: Readings): { readonly operator: string; readonly skillId: string; readonly now: number | null; readonly third: number | null }[] {
  const third = inTurn(data, fx, placeWith(data, fx, passStops(data, fx, placement), assume));
  // One pairing (castpairs.ts, round 13's backlog point 1): the casts that stay first, then the moved ones by nearest.
  const pairs = pairCasts(placement.casts, third.casts);
  const out: { operator: string; skillId: string; now: number | null; third: number | null }[] = [
    ...pairs.moved.map(([c, d]) => ({ operator: c.operator, skillId: c.skillId, now: c.start, third: d.start })),
    ...pairs.gone.map((c) => ({ operator: c.operator, skillId: c.skillId, now: c.start, third: null })),
    ...pairs.added.map((d) => ({ operator: d.operator, skillId: d.skillId, now: null, third: d.start })),
  ];
  return out.sort((a, b) => (a.now ?? a.third ?? 0) - (b.now ?? b.third ?? 0));
}

/**
 * Ultimates of different operators whose placed time stops (down to OWN_STOP_SCALE) overlap by more than
 * IN_TURN_SLACK_FRAMES after the placement's last pass: the pairs the in-turn rule left (remaining-leads report point 2:
 * the overlap list as a measurable property; scripts/probes/placement/ult-overlap.ts prints the log's evidence for
 * each). `anchored`: both placed from their cast events or at another stop's end (fromEvent / beforeStop), where
 * the log's times set both; `chain`: one of them overlaps a third ultimate too.
 */
export function ultimateOverlaps(data: GameData, placement: Pick<Placement, "casts">): { readonly a: LoggedCast; readonly b: LoggedCast; readonly frames: number; readonly anchored: boolean; readonly chain: boolean }[] {
  const ults = placement.casts.filter((c) => c.kind === "ultimate");
  const stops = ults.flatMap((c) => castTimeStops(data, [c]).filter((s) => s.scales.some((x) => x <= OWN_STOP_SCALE)).slice(0, 1).map((s) => ({ c, s })));
  const pairs: { a: LoggedCast; b: LoggedCast; frames: number }[] = [];
  for (const x of stops) for (const y of stops) {
    if (x === y || x.c.operator === y.c.operator || !(x.s.start <= y.s.start && y.s.start < x.s.start + x.s.scales.length) || (x.s.start === y.s.start && x.c.operator > y.c.operator)) continue;
    const frames = Math.min(x.s.start + x.s.scales.length, y.s.start + y.s.scales.length) - y.s.start;
    if (frames > IN_TURN_SLACK_FRAMES) pairs.push({ a: x.c, b: y.c, frames });
  }
  const anchoredCast = (c: LoggedCast) => c.fromEvent === true || c.beforeStop !== undefined;
  return pairs.map((p) => ({ ...p, anchored: anchoredCast(p.a) && anchoredCast(p.b), chain: pairs.some((q) => q !== p && (q.a === p.a || q.b === p.a || q.a === p.b || q.b === p.b)) }));
}

/** How far from a placed cast of its skill a logged cast event may be and still be that cast (ms; unplacedCastStops). */
const UNPLACED_CAST_MS = 2500;

/**
 * The time stops of the log's cast events (LogFixture.casts) that no placed cast of their skill is near
 * (UNPLACED_CAST_MS): skills whose damage comes as other skills' keys, or none (5082ceaffad1: Yvonne's ultimate at
 * 38160 ms, between Ardelia's combo projectile at 36030 ms and its bomb at 42441 ms). Each from its event's time; an
 * event within the skill's duration of an earlier one is that cast's (the log repeats some ultimates' events while they
 * last: Liino's every ~3.5 s of Cosmovoice, Ardelia's ~3 s after hers).
 */
function unplacedCastStops(data: GameData, fx: LogFixture, placed: readonly LoggedCast[]): ReturnType<typeof skillStops>[] {
  const out: ReturnType<typeof skillStops>[] = [];
  const last = new Map<string, number>();
  const kits = new Map(fx.team.map((b) => [b.operator, effectiveKit(data, b)?.skills ?? []]));
  for (const lc of fx.casts ?? []) {
    const timing = data.skills[lc.skill]?.timing;
    if (!timing?.slowdowns.length) continue;
    const key = `${lc.operator}|${lc.skill}`;
    const prev = last.get(key);
    if (prev !== undefined && lc.t - prev <= msOf(timing.durationFrames)) continue;
    last.set(key, lc.t);
    const skills = kits.get(lc.operator) ?? [];
    const kit = new Set(skills.map((s) => s.skillId));
    if (placed.some((c) => c.operator === lc.operator && castEventOf(lc.skill, c.skillId, kit) && Math.abs(c.start - lc.t) <= UNPLACED_CAST_MS)) continue;
    const at = Math.round((lc.t * FPS) / 1000);
    const kind = skills.find((s) => castEventOf(lc.skill, s.skillId, kit))?.kind;
    out.push(skillStops(data, lc.skill, at, { operator: lc.operator, skillId: lc.skill, ...(kind ? { kind } : {}) }));
  }
  return out;
}

/**
 * The holds at the log's Stagger breaks a new cast's start reads under engine assumption break-held-starts `held`
 * (castStart): the engine's (holds.ts breakStops, from a pass with stops: none inside an ultimate's), which stop every
 * clock, a cast's own too, so a landing after one is that many frames later than its frame says (fc63a2001251:
 * Typhoeus's combo, its event at 98.42 s, its arrows at 101.87 s at frame 35 after Arcane's ultimate stop and the
 * 101.11 s break; placed from 99.03 s, the replay held it again and her battle skill at 102.33 s came inside its
 * uncuttable frames). Not one inside another operator's combo slow-down, where the log's next moments often come
 * sooner than a hold allows (4360447193ac 49.14 s, d4fb69b036fe 97.05 s: 0.13–0.25 s after). `others`: the stops of
 * the other operators.
 */
function heldBreaks(fx: LogFixture, stops: readonly TimeStop[], others: readonly TimeStop[], assume: Readings | undefined): TimeStop[] {
  const combos = others.filter((s) => s.kind === "combo");
  // The hold's length beside the slow-downs that hold the cast's operator (break-hold-combo `added`): not her own.
  return breakStops(fx, stops, assume, others).filter((b) => !combos.some((s) => b.start >= s.start && b.start <= s.start + s.scales.findLastIndex((x) => x < 1)));
}

function placeWith(data: GameData, fx: LogFixture, stops: readonly TimeStop[], assume: Readings | undefined): Placement {
  const hits = new Map<LogHit, PlacedHit>();
  const casts: LoggedCast[] = [];
  const realign: RealignRecord[] = [];
  const sorted = [...fx.hits].sort((a, b) => a.t - b.t);
  const teamGroups = new Map(fx.team.map((b) => [b.operator, groupsOf(data, b, computeStats(data, b), fx)]));
  const controlled = controlEvidence(fx, teamGroups);
  for (const build of fx.team) {
    const groups = teamGroups.get(build.operator) ?? [];
    if (groups.length === 0) continue;
    const mine = sorted.filter((h) => h.operator === build.operator);
    const others = stops.filter((x) => x.operator !== build.operator);
    // In a fight read per target, the log's hits of one landing on its targets (targets.ts batchTargets): the crit factor
    // that tells one target's crit from another target's non-crit.
    const several = readsTargets(fx, assume);
    const critFactor = 1 + (computeStats(data, build).attrs[Attr.CriticalDamageIncrease]?.total ?? 0.5);
    const breaks = stops.length && readingOf(assume, "break-held-starts") === "held" ? heldBreaks(fx, stops, others, assume) : [];
    const slotCache = new Map<string, Slot[] | null>();
    const slots = (g: Group, key: string) => {
      const k = `${g.id}|${key}`;
      if (!slotCache.has(k)) slotCache.set(k, slotsOf(g, key));
      return slotCache.get(k) ?? null;
    };
    // A hit of a key that happens only off-field isn't a candidate while the log shows its operator controlled
    // (fc63a2001251: Typhoeus's 4th shot at 89.24 s, keyed as her shots 1–4, taken for her 5th shot's off-field arrow,
    // which made the 5th shot's burst a shot of its own and shifted every shot after it).
    const offField = (h: KitHit) => JSON.stringify(h.if) === JSON.stringify({ not: { controlled: true } });
    const groupsWith = (key: string, t?: number) =>
      groups.filter((g) => g.hits.some((h) => h.events.includes(key) && !(t !== undefined && offField(h) && controlled(build.operator, t))));
    const kitSkills = new Set(groups.filter((g) => g.kind !== null).map((g) => g.skillId));
    const basicSkills = new Set(groups.filter((g) => g.kind === "basic").map((g) => g.skillId));
    // Not one logged at another operator's time-stopping cast's event: pressed during its stop, the log has it at the
    // stop's end (5082ceaffad1: Yvonne's and Ardelia's combos at Seraph's ultimate's 33.71 s; e82d45c46040: Li Zhiyan's at
    // 3.90 s, her seal at 7.02 s at frame 15 only after Jsspsi's and her own ultimates).
    const stopping = (fx.casts ?? []).filter((c) => c.operator !== build.operator && data.skills[c.skill]?.timing?.slowdowns.some((d) => Math.min(...d.scales) === 0));
    const events = (fx.casts ?? []).filter((c) => c.operator === build.operator && !stopping.some((x) => Math.abs(x.t - c.t) <= 1));
    // A kit skill whose own keys the log never shows for the operator is logged in place of its button's other variant
    // (buttonVariants): its cast events are the variant's (castassembly.ts variantCastOf; db8711232de9: Laevatain's
    // battle-skill presses in Twilight, logged as normal_skill, are normal_skill_during_ult, the 27.13 s one held by Si's
    // ultimate stop).
    const shownKeys = new Set(mine.map((h) => h.event));
    const kit = effectiveKit(data, build);
    const kitSkill = new Map((kit?.skills ?? []).map((s) => [s.skillId, s]));
    const shown = (skillId: string) => (kitSkill.get(skillId)?.hits ?? []).some((h) => h.events.some((e) => shownKeys.has(e)));
    const variantEvent = (eventSkill: string, g: Group) => {
      const [a, b] = [kitSkill.get(eventSkill), kitSkill.get(g.skillId)];
      return kit !== null && kit !== undefined && a !== undefined && b !== undefined && eventSkill !== g.skillId && !shown(eventSkill) && shown(g.skillId) && buttonVariants(kit, a, b);
    };
    const eventsOf = (g: Group) => (g.kind === null ? [] : events.filter((e) => castEventOf(e.skill, g.skillId, kitSkills) || variantEvent(e.skill, g)).map((e) => e.t));
    // Where a new cast of a group starts whose first logged landing `h` is at slot `first`.
    // An ultimate whose first landing is on its way places it from its cast event at an edge of its stop
    // (eventStopStart): a travelling one always, another detached one where its frame's stop contradicts the log.
    const startFor = (g: Group, h: LogHit, first: Slot | undefined): Pick<LoggedCast, "start" | "beforeStop" | "fromEvent"> => {
      const fromEvent = g.kind === "ultimate" && first && first.hits.every((x) => x.travels || x.detached || x.landedCount !== undefined) ? eventStopStart(data.skills[g.skillId]?.timing, build.operator, h.t, first.frame, others, eventsOf(g), sorted, !first.hits.every((x) => x.travels)) : null;
      return fromEvent !== null ? { start: fromEvent, fromEvent: true } : newCastStart(h.t, first ? (g.kind === null ? first.frame : ownStopLoggedFrame(data.skills[g.skillId]?.timing, first.hits, first.frame)) : 0, g.kind === "combo" ? others.filter((x) => x.kind !== "combo") : others, eventsOf(g), breaks);
    };
    /** One pass over the operator's logged hits; `starts` (by skill) picks among groups sharing a key. */
    const pass = (starts: ReadonlyMap<string, readonly number[]> | null) => {
      const placed = new Map<LogHit, PlacedHit>();
      // `targets`: the count of targets an earlier batch of the cast's key stood on (batchTargets, ≥ 2).
      const current = new Map<string, { cast: LoggedCast; first: number; last: LogHit; index: number; span: number; longest: number; slots: Slot[] | null; exact: boolean; scales: ReadonlyMap<KitHit, number>; ranges: ReadonlyMap<KitHit, readonly number[]>; targets?: number }>();
      const batches = new Map<string, { readonly hits: readonly LogHit[]; readonly targets: number; readonly by: string }>();
      // A hit's place in its batch: its key's hits at its ms alike in value to the cast's last landing (alikeValue: not a
      // final among slashes), in the log's order; a twin where it isn't the first of its landing's `targets` hits
      // (batchTargets; the count an earlier batch of the cast's key read held).
      const twinInBatch = (cur: { readonly last: LogHit; targets?: number }, h: LogHit) => {
        const k = `${h.event}|${h.t}`;
        let b = batches.get(k);
        if (!b) {
          const hs = mine.filter((x) => x.event === h.event && x.t === h.t && alikeValue(x, cur.last, critFactor));
          const r = batchTargets(
            hs.map((x): BatchHit => ({ value: x.uncapped ?? x.value, crit: x.crit })),
            critFactor,
            fx.severalTargets?.atOnce ?? DEFAULT_AT_ONCE,
            cur.targets,
          );
          b = { hits: hs, ...r };
          batches.set(k, b);
          if (r.targets >= 2) cur.targets = r.targets;
        }
        const i = b.hits.indexOf(h);
        return { twin: i > 0 && i % b.targets !== 0, targets: b.targets, size: b.hits.length, by: b.by };
      };
      // Casts placed so far, per group: a key's first landing within an earlier cast's reach is that cast's (joinable).
      const opened = new Map<string, LoggedCast[]>();
      // The operator's casts of skills so far, for a key several chain steps share (choose: the step after the latest
      // whose windows list one).
      const skillCasts: LoggedCast[] = [];
      // At one logged ms (a batch), the keys of one group first: the casts they open are the chain steps that decide a
      // shared key's (4d60e7fe92c2 25.79 s: Zhuang Fangyi's attack 4 range hit, attack 2's key, logged before attack 3's
      // swords at the same ms, was taken for attack 2 restarting the chain).
      const shared = (h: LogHit) => (groupsWith(h.event, h.t).length > 1 ? 1 : 0);
      const order = starts ? [...mine].sort((a, b) => a.t - b.t || shared(a) - shared(b)) : mine;
      for (const h of order) {
        const candidates = groupsWith(h.event, h.t);
        if (candidates.length === 0) continue;
        if (!starts && candidates.length > 1) continue; // the first pass places only keys of one group
        const cur = current.get(h.event);
        // The same cast while within its landings' span, or while it has landings to come within the skill's whole action
        // (a landing after a wait: Rossi's Lift 2.2 s after her charge, where the logged span is 0.6 s).
        const elapsed = cur ? worldMs(cur.first, h.t, others) : 0;
        // Not once another of the operator's skills was cast since, unless the landing to come is on its way (detached): the
        // new cast ended this one (4e5e1390085e: Rossi's attack 4 at 14708 ms after her attack 3, not hit_ai's landings at
        // frame 195+ of her attack 4 at 6974 ms).
        // A landing at its next slot's own frame is the cast's, whatever seems to start in between (012ae1c80ae6: Camille's
        // combo hits at 33910 / 34117 / 34798 ms, its frames 19 / 27 / 47, around an attack 3 placed at 33552 ms).
        const next = cur?.slots?.[cur.index + 1];
        const head = cur?.slots?.[0];
        const onTime = cur !== undefined && next !== undefined && head !== undefined && Math.abs(elapsed - msOf(next.frame - head.frame)) <= ON_TIME_MS;
        const since = (c: LoggedCast) => cur !== undefined && c !== cur.cast && c.kind !== null && c.start > cur.cast.start && c.start <= h.t;
        // Even a landing on its way isn't an older cast's once a newer cast of a skill with its key has started (3aa6ab93bad4:
        // Zhuang Fangyi's attack 4 at 98.59 s, cut after two range ticks, took attack 2's at 106.11 s, whose swords at that
        // ms had opened attack 2; attack 4 lasts 170 frames).
        const onItsWay = next !== undefined && next.hits.some((x) => x.detached || x.launch !== undefined);
        // Only one later than its frame by CAST_SLACK_MS: a projectile from the cast before lands after the next cast's
        // start (Yvonne's ultimate shots, 5082ceaffad1 42.44 s, abfd4b7478ec 35.99 s).
        const overdue = next !== undefined && head !== undefined && elapsed > msOf(next.frame - head.frame) + CAST_SLACK_MS;
        const rekeyed = onItsWay && overdue && [...opened.values()].flat().some((c) => since(c) && candidates.some((g) => g.id === c.group));
        const superseded = rekeyed || (cur !== undefined && next !== undefined && !onTime && !onItsWay && [...opened.values()].flat().some(since));
        // Not where every landing still to come is an ability entity's (onEntityClock): the entity's timeline runs on at
        // its own frames, which no jump or wait of the cast moves, so its landings are due within the slots' span (the
        // world's time: every stop but the cast's own holds them). f8793bc8aea2 94.71 s: Laevatain's Magma Fragment
        // explosion, 6.9 s after her 87.12 s battle skill's, whose ticks the log doesn't have, was taken for that cast's
        // first tick; the 95.94 s empowered hit then made a battle skill at 92.48 s, before her final strike's Heat
        // absorption, with no empowered hit.
        const entityLate = cur?.slots !== null && cur?.slots !== undefined && cur.slots.slice(cur.index + 1).every((x) => x.hits.every(onEntityClock)) && worldMs(cur.first, h.t, stops.filter((x) => x.operator !== cur.cast.operator || x.skillId !== cur.cast.skillId)) > cur.span + CAST_SLACK_MS;
        const toCome = cur?.slots && cur.index + 1 < cur.slots.length && elapsed <= cur.longest + CAST_SLACK_MS && !entityLate;
        // A variant's slot may never come (variantOrder): a logged press of a skill of the cast's kind since its first
        // landing starts a new cast (3aa6ab93bad4: a cast of two strikes doesn't take the next cast's seven; d774d0ce7bd3:
        // a battle skill's strikes 2.6 s apart, no press between, are one cast's).
        const pressed = next?.variant === true && cur !== undefined && (fx.casts ?? []).some((c) => c.operator === build.operator && c.t > cur.first && c.t <= h.t && groups.find((x) => x.id === c.skill)?.kind === cur.cast.kind);
        // A channel's tick lands by the channel's end (KitHit.latestFrame: its per-target cap, not the channel, ends its
        // ticks; an enemy in reach late takes them up to there), so a landing of its key later than that from the cast's
        // first landing is a new cast's, however long the skill's whole action (abfd4b7478ec 63.77 s: Si's attack 4 has
        // 552 frames and a channel to frame 40; two ticks at 61.96 / 62.08 s, a battle press, then six at 63.77–64.35 s,
        // which took the first cast's four slots left and cut the second's at 64.10 s; c3c735dbb022 33.64 s). Only one
        // channel's own ticks, from its first (head and next slot the same kit hit): a skill of several one-tick channels
        // (Laevatain's normal_skill_during_ult, frames 13 / 23 / 98) keeps the slack its stops need (db8711232de9 30.01 s).
        const channel = next?.hits.find((x) => x.latestFrame !== undefined && head?.hits.includes(x)); // split:channel-end
        // Past it by more than CHANNEL_SLACK_MS; or by more than ON_TIME_MS with a logged press of the operator's between
        // the cast's last landing and this one (c3c735dbb022 60.64 s: one tick at 59.30 s, a battle press at 59.50 s,
        // five ticks 0.1 s apart from 60.64 s, 1.34 s on; without the press the five would split at the slack).
        const channelEnd = channel !== undefined && head !== undefined ? msOf((channel.latestFrame as number) - head.frame) : Infinity; // split:channel-end
        // A channel on the world's clock (KitHit.world: an ability entity's) ends on that clock: every stop holds it, its
        // operator's own ultimate's too, not her own combos' slow-downs (their ignore list spares what she spawned), and so
        // do the hidden holds, which the placement doesn't have yet (holds.ts places them from the replay). Typhoeus's
        // Barrage Array (180 frames from its first tick): 18 ticks in 5.7–9.8 s of log time, 5.6–6.2 s of world time with
        // every stop and hidden hold out (00ae0a364ad4 24.63 s: 8.02 s, 6.79 s with the stops out, 0.68 s of hidden holds
        // placed inside it). So no slack bound there: a tick past its end is a new cast's only with a logged press of a
        // skill of the cast's kind between (a new array comes from a new combo, and the log has an event for each).
        const onWorld = channel?.world === true; // split:channel-end
        const channelElapsed = onWorld && cur ? worldMs(cur.first, h.t, stops.filter((x) => x.operator !== build.operator || x.kind === "ultimate")) : elapsed; // split:channel-end
        const pressedBetween = cur !== undefined && (fx.casts ?? []).some((c) => c.operator === build.operator && c.t > cur.last.t && c.t < h.t && (!onWorld || groups.find((x) => x.id === c.skill)?.kind === cur.cast.kind)); // split:channel-end
        // Not across an ultimate's event: logged at its stop's end, its stop isn't among this pass's (unplacedCastStops
        // start it at the event), and it held the channel (c83c75d02a85 92.48 s: Si's attack 4's third tick 0.01 s after
        // Laevatain's 90.43–92.47 s ultimate stop, its event at 92.48 s, 0.1 s of world time after the second).
        const ultimateBetween = cur !== undefined && (fx.casts ?? []).some((c) => c.t > cur.last.t && c.t <= h.t && data.kits.operators[c.operator]?.skills.find((s) => s.skillId === c.skill)?.kind === "ultimate"); // split:channel-end
        const pastSlack = !onWorld && elapsed > channelEnd + CHANNEL_SLACK_MS; // split:channel-end
        const pastChannel = !ultimateBetween && (pastSlack || (pressedBetween && channelElapsed > channelEnd + ON_TIME_MS)); // split:channel-end
        // A cast whose landings of the key are all known (exactSlots) and all logged already: another is a new cast, however
        // soon (Typhoeus's hover shots, 0.6 s apart under one key, were one cast with one landing: every second shot unlanded).
        const used = cur?.exact === true && cur.slots !== null && cur.index + 1 >= cur.slots.length;
        // Its landings all logged, another at its last one's time is that landing on a second enemy (9c6e97486a9d: two
        // targets, two hits per Typhoeus shot, were two shots each, which ended her hovers early): the same slot. So is one
        // at its last one's time whose value is that landing's and not the next slot's (sameByValue: 9c6e's Liino combo
        // at 47.72 s, hit 1 on both enemies, 6368 and 6035, took the second for hit 2 and her 48.49 s hit 2 for a new
        // combo's hit 1; 40d9a3c1da37's Si combo slashes, which the log batches at one ms, are alike in value, undecided).
        // Not one whose value, both of known crit, is a next cast's first landing's and not the same landing's
        // (nextByValue): 9a8097fcf351 34.94 s, Si's 25.00 s combo's final, 349,888, and her 32.51 s combo's first slash,
        // 28,396; taken for the final on a second enemy, the slash's cast lost it.
        // In a fight read per target (several-targets), where value can't tell a twin from the next slot (its multiplier
        // alike: Si's combo slashes), the batch's targets do (twinInBatch: 7b54 15.60 s, 2 slashes × 4 slugs took eight of
        // the ten slash slots, the final's slot two slugs' slashes, and a second combo was opened for the rest); a used-up
        // combo's landing a flush after its last is its last landing on another target (7b54 16.48 s: the final on a third
        // slug, 125 ms after two slugs' finals, opened a combo the log has no event for). Combos only: the log has an event
        // for each, and a basic attack's, a battle skill's or a trigger's next landing a flush later is a new cast's (9c6e:
        // Typhoeus's shots and arrows, Ardelia's attack 3, Liino's ultimate beats, taken for twins: with the batch rule on
        // landing-long batches, plain 314 → 312, mismatch 33 → 44).
        // In such a fight a slot's multipliers over event counts (nominalScales' ranges: Si's combo final) tell it too.
        const byValue = cur !== undefined && h.t === cur.last.t && (sameByValue(cur, h) || (several && nextDiffers(cur) && alikeValue(h, cur.last, critFactor)));
        // Nor where the next slot is due later than the slot's landing by more than ON_TIME_MS (the log flushes its hits
        // about every 100 ms and at a stop's end: castassembly.ts batchOrder) and no stop, the operator's own included,
        // holds the world in the ON_TIME_MS before the ms (a stop ending there could have batched both landings at it):
        // at the last landing's ms it is that landing on another target, alike in value (f57452bc1f02 16.98 s: Mi Fu's
        // Trail and Mangle on two
        // slugs, its flurries at frames 3 and 10 alike in value, 5181 twice at 16.98 s and twice at 17.27 s; the batch
        // rule read the first two as one slug's two flurries, the 17.27 s pair as the mangle and its twin, and the 17.75 s
        // mangles opened a second cast: 50 SP spent twice).
        const timeDue = cur && next && cur.slots?.[cur.index] ? msOf(next.frame - (cur.slots[cur.index] as Slot).frame) : 0;
        const byTime = several && cur !== undefined && !used && !byValue && h.t === cur.last.t && timeDue > ON_TIME_MS && ON_TIME_MS - worldMs(h.t - ON_TIME_MS, h.t, stops) < 1 && alikeValue(h, cur.last, critFactor);
        const batch = several && cur && !used && !byValue && !byTime && h.t === cur.last.t && !nextDiffers(cur) ? twinInBatch(cur, h) : null;
        const later = several && cur && used && cur.cast.kind === "combo" && h.t > cur.last.t && h.t - cur.last.t <= TWIN_LATER_MS && !nextByValue(cur, h) && alikeValue(h, cur.last, critFactor) && !eventsOf(groups.find((x) => x.id === cur.cast.group) as Group).some((t) => t > cur.last.t && t <= h.t);
        if (cur && (((used && !nextByValue(cur, h)) || byValue) && h.t === cur.last.t || byTime || batch?.twin || later)) {
          const slot = cur.slots?.[cur.index];
          const twin: PlacedTwin = byValue ? { rule: "value" } : byTime ? { rule: "time", due: timeDue } : batch?.twin ? { rule: "batch", targets: batch.targets, batch: batch.size, by: batch.by } : later ? { rule: "later" } : { rule: "used" };
          placed.set(h, { cast: cur.cast, index: cur.index, hits: slot ? slot.hits : allHits(candidates, h.event), ...(slot ? { frame: slot.frame, ...(slot.at ? { at: slot.at } : {}) } : {}), sameAs: cur.last, twin });
          continue;
        }
        // An ultimate isn't cast again within its own action: a landing of its key within the skill's duration is the same
        // cast's while it has landings to come, whatever the operator did since (5082ceaffad1: Ardelia's sheep, which fly
        // at random, so off their slots' frames, made three casts from 41880 to 45866 ms, around her combo's bomb;
        // af7b7f865906: five sheep, four casts, around her attack 3 at 59.7 s).
        const sameUltimate = cur !== undefined && cur.cast.kind === "ultimate" && (cur.slots === null || cur.index + 1 < cur.slots.length) && worldMs(cur.cast.start, h.t, others) <= cur.longest + CAST_SLACK_MS;
        // A series of landings on their way (detached: a field's ticks) goes on at its own pace, however long its pauses
        // made it: the next slot's landing within its gap from the last one's (ON_TIME_MS) is the same cast's
        // (fc63a2001251: Typhoeus's Barrage Array, 18 ticks from 81.47 s, its 18th at 94.26 s after her ultimate's stop,
        // 0.34 s after the 17th, was placed as a combo of its own, whose hovering conversion gave three Hunting Arrows).
        const atSlot = cur?.slots?.[cur.index];
        const paced = cur !== undefined && next !== undefined && atSlot !== undefined && next.hits.every((x) => x.detached) && worldMs(cur.last.t, h.t, others) <= msOf(next.frame - atSlot.frame) + ON_TIME_MS;
        if (cur && !used && (sameUltimate || (!superseded && !pressed && !pastChannel && (elapsed <= cur.span + CAST_SLACK_MS || toCome || paced)))) { // split:channel-end
          cur.index++;
          cur.last = h;
          const s = cur.slots;
          const slot = s ? s[Math.min(cur.index, s.length - 1)] : undefined;
          const joined: PlacedJoin = { by: sameUltimate ? "same ultimate" : elapsed <= cur.span + CAST_SLACK_MS ? "span" : toCome ? "to come" : "paced", elapsed, ...(slot && head ? { due: msOf(slot.frame - head.frame) } : {}) };
          placed.set(h, { cast: cur.cast, index: cur.index, hits: slot ? slot.hits : allHits(candidates, h.event), ...(slot ? { frame: slot.frame, ...(slot.at ? { at: slot.at } : {}) } : {}), joined });
          continue;
        }
        const free = (c: LoggedCast) => ![...placed].some(([x, p]) => p.cast === c && x.event === h.event);
        // A cast with a landing of a later frame logged already, a delayed one (a burst after its arrow), isn't joined
        // by a landing of an earlier frame: that landing is a later cast's (fc63a2001251 87–97 s: each of Typhoeus's
        // bursts opened a cast that the next shot's arrow joined, a shot late; tried 2026-11-18 without the off-field
        // rule, when bdf2 and 00ae lost a shot to it).
        const landedLater = (c: LoggedCast, frame: number) => [...placed].some(([x, p]) => p.cast === c && x.t < h.t && p.frame !== undefined && p.frame > frame && p.hits.some((k) => k.enemyDelay !== undefined));
        const late = joinDelayed(candidates, h, slots, opened, stops, free);
        // A trigger on casts fires once per cast: no new cast of its group once one was placed since the anchor before
        // the latest one it could be (a cast of the skills it fires on, plus its delay, placed up to the skill's duration
        // after where this cast would start: an ultimate's casts placed from its keys merge within it), while another
        // candidate is left (Liino's ultimate's first beat, trigger ult_song at frame 77, and her song's later beats,
        // cosmovoice_beat's ticks: each later beat made an ult_song of its own, so no tick was pinned to its logged beat;
        // a7a7a40c97ed's first beat at 45.64 s comes 3.1 s before the projectiles its ultimate is placed from,
        // 984748cfa662's at 129.37 s 2.0 s before, and each is still that ultimate's).
        const anchorFree = (g: Group) => {
          if (!g.anchor || !starts) return true;
          const a = g.anchor;
          const start = h.t - msOf(slots(g, h.event)?.[0]?.frame ?? 0);
          const reach = (s: string) => Math.max(ANCHOR_MS, msOf(data.skills[s]?.timing?.durationFrames ?? 0));
          const refs = a.skills.flatMap((s) => (starts.get(s) ?? []).map((t) => ({ at: t + msOf(a.delay), reach: reach(s) }))).filter((r) => r.at <= start + r.reach).sort((x, y) => x.at - y.at);
          if (refs.length === 0) return true;
          // One cast placed from several keys is one anchor (4bfc6f3e84b8: Liino's ultimate at 52.70, 52.84 and 55.40 s).
          const anchors: { first: number; last: number; reach: number }[] = [];
          for (const r of refs) {
            const cur = anchors.at(-1);
            if (cur && r.at - cur.last <= cur.reach) cur.last = r.at;
            else anchors.push({ first: r.at, last: r.at, reach: r.reach });
          }
          const prev = anchors.at(-2);
          const since = prev ? prev.last + prev.reach : -Infinity;
          return !(opened.get(g.id) ?? []).some((c) => c.start > since);
        };
        const eligible = candidates.filter(anchorFree);
        const choice = late ? null : choose(eligible.length ? eligible : candidates, h, starts, slots, skillCasts.map((c) => ({ cast: c, timing: data.skills[c.skillId]?.timing })), stops, (id) => (basicSkills.has(id) ? data.skills[id]?.timing : undefined));
        const g: Group = late?.g ?? (choice as { g: Group }).g;
        const chosen: CastChoice | null = candidates.length < 2 ? null : late ? { rule: "late", candidates: candidates.map((x) => x.id) } : (choice as { why: CastChoice }).why;
        const s = slots(g, h.event);
        const joined = late?.cast ?? joinable((opened.get(g.id) ?? []).filter((c) => !landedLater(c, s?.[0]?.frame ?? 0)), h, s?.[0]?.frame ?? 0, stops);
        // A new cast's first landing on the path a conditional jump goes to, where the skipped path's start is one its
        // operator's previous cast doesn't allow (jumpedFirst): the twin's slot, the start by its frame on that path.
        const jumped = joined === null && s ? jumpedFirst(data, g, h, s, skillCasts, others) : null;
        // The other paths' starts it had, as a record (the exposed-totals report point 3: 3f78's combo 3 at 49.59 s had
        // the late hit at 227 on the jumped path, 50.05 s, and nothing said so).
        const paths = joined === null && s ? pathAlternatives(data, g, h, s, skillCasts, others) : [];
        const firstIndex = jumped?.index ?? 0;
        const first = s?.[firstIndex];
        const cast: LoggedCast = joined ?? { operator: build.operator, key: h.event, group: g.id, skillId: g.skillId, kind: g.kind, ...(jumped ? { start: jumped.start } : startFor(g, h, first)), ...(g.anchor ? { anchor: g.anchor } : {}), ...(chosen ? { chosen } : {}), ...(paths.length ? { paths } : {}), ...(pastChannel && cur ? { pastChannel: { cast: cur.cast.start, elapsed: channelElapsed, end: channelEnd, by: pastSlack ? ("slack" as const) : ("press" as const) } } : {}) }; // split:channel-end
        if (!opened.get(g.id)?.includes(cast)) opened.set(g.id, [...(opened.get(g.id) ?? []), cast]);
        if (cast.kind !== null && !skillCasts.includes(cast)) skillCasts.push(cast);
        // The cast's slots end where its action ends on the path its first landing is on (pathEnd: a skill of several
        // paths from a jump, each ended by an InterruptCurSkillAction): the later paths' slots aren't its landings to come.
        const end = first && g.kind !== null ? pathEnd(data.skills[g.skillId]?.timing, first.frame) : Infinity;
        const onPath = s && end < Infinity ? s.filter((x) => x.frame < end) : s;
        const span = onPath && first ? msOf((onPath.at(-1) as Slot).frame - first.frame) : 0;
        const longest = Math.max(span, g.kind !== null ? msOf(Math.min(end, data.skills[g.skillId]?.timing?.durationFrames ?? 0) - (end < Infinity && first ? pathStart(data.skills[g.skillId]?.timing, first.frame) : 0)) : 0);
        current.set(h.event, { cast, first: h.t, last: h, index: firstIndex, span, longest, slots: onPath, exact: exactSlots(g, h.event), scales: g.scales, ranges: g.ranges });
        // A landing joined to a cast another key opened (joinDelayed, joinable): from the cast's start, against its frame.
        const via: PlacedJoin | undefined = joined === null ? undefined : { by: late ? "delayed" : "reach", elapsed: worldMs(cast.start, h.t, stops), ...(first ? { due: msOf(first.frame) } : {}) };
        placed.set(h, { cast, index: firstIndex, hits: first ? first.hits : allHits(candidates, h.event), ...(first ? { frame: first.frame, ...(first.at ? { at: first.at } : {}) } : {}), ...(via ? { joined: via } : {}) });
      }
      return placed;
    };
    const first = pass(null);
    const starts = new Map<string, number[]>();
    for (const p of new Set([...first.values()].map((x) => x.cast))) starts.set(p.group, [...(starts.get(p.group) ?? []), p.start]);
    const placed = pass(starts);
    const exactSlotsOf = (c: LoggedCast, key: string) => {
      const g = groups.find((x) => x.id === c.group);
      return g && exactSlots(g, key) ? slots(g, key) : null;
    };
    realignUltimates(placed, exactSlotsOf, others);
    realignByValue(placed, exactSlotsOf, (c) => {
      const g = groups.find((x) => x.id === c.group);
      return (k: KitHit) => {
        const one = g?.scales.get(k);
        return one !== undefined ? [one] : g?.ranges.get(k);
      };
    }, others, (c, h, slot) => {
      const g = groups.find((x) => x.id === c.group);
      const { beforeStop: _b, fromEvent: _f, ...rest } = c;
      return g ? { ...rest, ...startFor(g, h, slot) } : null;
    }, realign);
    for (const [h, p] of placed) hits.set(h, p);
    casts.push(...new Set([...placed.values()].map((p) => p.cast)));
  }
  return { hits, casts, ...(realign.length ? { realign } : {}) };
}

/**
 * Whether the log shows an operator controlled at a time (ms), from the log alone: the logged hit with Stagger nearest
 * that time among the kit hits whose Stagger only the controlled operator deals (poiseControlledOnly: basic attacks,
 * as castassembly.ts controlSwaps reads them) is the operator's, within CONTROL_EVIDENCE_MS. False without such a hit
 * (unknown).
 */
function controlEvidence(fx: LogFixture, groups: ReadonlyMap<string, readonly Group[]>): (operator: string, t: number) => boolean {
  const keys = new Map<string, Set<string>>();
  for (const [op, gs] of groups) keys.set(op, new Set(gs.flatMap((g) => (g.kind === "basic" ? g.hits.filter((h) => h.poise !== undefined && h.poiseControlledOnly).flatMap((h) => h.events) : []))));
  const shown = fx.hits.filter((h) => h.poise !== undefined && keys.get(h.operator)?.has(h.event));
  return (operator, t) => {
    let best: LogHit | undefined;
    for (const h of shown) if (!best || Math.abs(h.t - t) < Math.abs(best.t - t)) best = h;
    return best !== undefined && best.operator === operator && Math.abs(best.t - t) <= CONTROL_EVIDENCE_MS;
  };
}

/** How far from a time a hit showing control may be and still say who was controlled then (controlEvidence). */
const CONTROL_EVIDENCE_MS = 10_000;

/**
 * An ultimate's landings of a key fewer than its slots: the landings take the slots their world time from the first
 * landing fits best (in order, the first keeping its slot), not the first ones in turn. An ultimate isn't cut, so a
 * landing the log lacks may be any of them (3f78ceb15bc3: Rossi's at 18.98 s, 26 of her 27 landings logged, a stab
 * missing: her two slashes, ×10–30 a stab, took the last stab's and slash 1's slots, 9 and 11 frames off their own).
 * Applied only when it fits better than the turn order by REALIGN_MS in all; `slotsOf` gives a cast's key's slots when
 * all are known (exactSlots), else null.
 */
function realignUltimates(placed: Map<LogHit, PlacedHit>, slotsOf: (c: LoggedCast, key: string) => readonly Slot[] | null, stops: readonly TimeStop[]): void {
  const byCast = new Map<string, { cast: LoggedCast; key: string; hits: LogHit[] }>();
  for (const [h, p] of placed) {
    if (p.cast.kind !== "ultimate" || p.sameAs) continue;
    const k = `${p.cast.group}|${p.cast.start}|${h.event}`;
    const e = byCast.get(k) ?? { cast: p.cast, key: h.event, hits: [] };
    e.hits.push(h);
    byCast.set(k, e);
  }
  for (const { cast, key, hits } of byCast.values()) {
    const s = slotsOf(cast, key);
    // Not hits whose landings are a random count off their frames (KitHit.landedCount: Ardelia's sheep, 5082 af7b).
    if (!s || hits.length < 2 || hits.length >= s.length || s.some((x) => x.hits.some((k) => k.landedCount !== undefined))) continue;
    const list = [...hits].sort((a, b) => a.t - b.t);
    const j0 = (placed.get(list[0] as LogHit) as PlacedHit).index;
    if (list.length > s.length - j0) continue;
    const base = (s[j0] as Slot).frame;
    const w = list.map((h) => worldMs((list[0] as LogHit).t, h.t, stops));
    const cost = (i: number, j: number) => Math.abs((w[i] as number) - msOf((s[j] as Slot).frame - base));
    // best[i][j]: the least cost of landings 1..i with landing i at slot j (slots after j0, in order).
    const n = list.length;
    const best: number[][] = Array.from({ length: n }, () => new Array<number>(s.length).fill(Infinity));
    const from: number[][] = Array.from({ length: n }, () => new Array<number>(s.length).fill(-1));
    (best[0] as number[])[j0] = 0;
    for (let i = 1; i < n; i++) {
      for (let j = j0 + i; j <= s.length - (n - i); j++) {
        for (let k = j0 + i - 1; k < j; k++) {
          const c = (best[i - 1] as number[])[k] as number;
          // Ties keep the earlier slot (the turn order's).
          if (c + cost(i, j) < ((best[i] as number[])[j] as number) - 1e-9) {
            (best[i] as number[])[j] = c + cost(i, j);
            (from[i] as number[])[j] = k;
          }
        }
      }
    }
    const last = best[n - 1] as number[];
    let jEnd = -1;
    for (let j = 0; j < s.length; j++) if (Number.isFinite(last[j] as number) && (jEnd < 0 || (last[j] as number) < (last[jEnd] as number) - 1e-9)) jEnd = j;
    const turn = list.reduce((a, _h, i) => a + (i === 0 ? 0 : cost(i, j0 + i)), 0);
    if (jEnd < 0 || (last[jEnd] as number) > turn - REALIGN_MS) continue;
    const at: number[] = new Array<number>(n);
    for (let i = n - 1, j = jEnd; i >= 0; j = (from[i] as number[])[j] as number, i--) at[i] = j;
    list.forEach((h, i) => {
      const p = placed.get(h) as PlacedHit;
      const slot = s[at[i] as number] as Slot;
      const { at: _at, ...rest } = p;
      placed.set(h, { ...rest, index: at[i] as number, hits: slot.hits, frame: slot.frame, ...(slot.at ? { at: slot.at } : {}) });
    });
  }
}

/**
 * Whether a landing logged at its cast's last landing's ms is that landing on a second enemy by its value (placeWith):
 * within SAME_VALUE_TOLERANCE of the last one's, and not within it of what the next slot's multiplier would make it
 * (nominalScale); crits and hits of unknown crit aside, and where a slot's multiplier is unknown, undecided (false).
 */
function sameByValue(cur: { readonly last: LogHit; readonly index: number; readonly slots: readonly Slot[] | null; readonly scales: ReadonlyMap<KitHit, number> }, h: LogHit): boolean {
  const here = cur.slots?.[cur.index];
  const next = cur.slots?.[cur.index + 1];
  if (h.t !== cur.last.t || h.crit !== false || cur.last.crit !== false || !here || !next) return false;
  const a = here.hits.map((k) => cur.scales.get(k));
  const b = next.hits.map((k) => cur.scales.get(k));
  if ([...a, ...b].some((m) => m === undefined)) return false;
  const r = Math.log((h.uncapped ?? h.value) / (cur.last.uncapped ?? cur.last.value));
  const tolerance = Math.log(SAME_VALUE_TOLERANCE);
  if (!Number.isFinite(r) || Math.abs(r) > tolerance) return false;
  return !(b as number[]).some((y) => (a as number[]).some((x) => Math.abs(r - Math.log(y / x)) <= tolerance));
}

/**
 * A landing `h` at a used-up cast's last landing's ms whose value is a next cast's first landing's, not that landing's
 * again: both non-crits, the key's slot 0 and the last landing's slot differing in multiplier by more than
 * SAME_VALUE_TOLERANCE, and the two values in that ratio (within it), not alike (9a8097fcf351 34.94 s: Si's final and
 * her next combo's first slash, ×12 apart as their multipliers). Two enemies' values of one landing differ by their
 * debuffs, not by the slots' multipliers: 9c6e97486a9d's two targets, read by value alone (2026-11-27), lost 36 plain.
 */
function nextByValue(cur: { readonly last: LogHit; readonly index: number; readonly slots: readonly Slot[] | null; readonly scales: ReadonlyMap<KitHit, number>; readonly ranges: ReadonlyMap<KitHit, readonly number[]> }, h: LogHit): boolean {
  const here = cur.slots?.[cur.index];
  const head = cur.slots?.[0];
  if (h.crit !== false || cur.last.crit !== false || !here || !head || cur.index === 0) return false;
  // Each hit's multipliers: its one nominal scale, else those of its value expression over event counts (nominalScales).
  const of = (k: KitHit) => {
    const one = cur.scales.get(k);
    return one !== undefined ? [one] : cur.ranges.get(k);
  };
  const a = here.hits.map(of);
  const b = head.hits.map(of);
  if ([...a, ...b].some((m) => m === undefined)) return false;
  const r = Math.log((h.uncapped ?? h.value) / (cur.last.uncapped ?? cur.last.value));
  const tolerance = Math.log(SAME_VALUE_TOLERANCE);
  if (!Number.isFinite(r) || Math.abs(r) <= tolerance) return false;
  const [xs, ys] = [(a as (readonly number[])[]).flat(), (b as (readonly number[])[]).flat()];
  return ys.some((y) => xs.some((x) => Math.abs(Math.log(y / x)) > tolerance && Math.abs(r - Math.log(y / x)) <= tolerance));
}

/** How close (×, either way) a second enemy's landing's value is to the first's (sameByValue): the enemies' own debuffs differ a little (9c6e ×0.95). */
const SAME_VALUE_TOLERANCE = 1.25;

/** How long after a used-up cast's last landing its landing on another target may be logged (placeWith's `later`: one log flush, about 100 ms; 7b54 16.48 s, 125 ms). */
const TWIN_LATER_MS = 150;

/**
 * Whether the cast's next slot's multipliers (its nominal scale, else those of its value expression over event counts,
 * as nextByValue reads them) are all known and none within SAME_VALUE_TOLERANCE of the current slot's: a hit's value
 * then tells a twin from the next slot, and placeWith's batch rule doesn't apply.
 */
function nextDiffers(cur: { readonly index: number; readonly slots: readonly Slot[] | null; readonly scales: ReadonlyMap<KitHit, number>; readonly ranges: ReadonlyMap<KitHit, readonly number[]> }): boolean {
  const here = cur.slots?.[cur.index];
  const next = cur.slots?.[cur.index + 1];
  if (!here || !next) return false;
  const of = (k: KitHit) => {
    const one = cur.scales.get(k);
    return one !== undefined ? [one] : cur.ranges.get(k);
  };
  const a = here.hits.map(of);
  const b = next.hits.map(of);
  if ([...a, ...b].some((m) => m === undefined)) return false;
  const tolerance = Math.log(SAME_VALUE_TOLERANCE);
  const [xs, ys] = [(a as (readonly number[])[]).flat(), (b as (readonly number[])[]).flat()];
  return !ys.some((y) => xs.some((x) => Math.abs(Math.log(y / x)) <= tolerance));
}

/** Whether two logged hits' values are within SAME_VALUE_TOLERANCE of each other with their crits taken out (a hit of unknown crit either way). */
function alikeValue(a: LogHit, b: LogHit, critFactor: number): boolean {
  const norms = (h: LogHit) => {
    const v = h.uncapped ?? h.value;
    return h.crit === true ? [v / critFactor] : h.crit === false ? [v] : [v, v / critFactor];
  };
  const tolerance = Math.log(SAME_VALUE_TOLERANCE);
  return norms(a).some((x) => norms(b).some((y) => x > 0 && y > 0 && Math.abs(Math.log(x / y)) <= tolerance));
}

/** How much better (ms, summed over the landings) a realigned ultimate's slots must fit than the turn order (realignUltimates). */
const REALIGN_MS = 150;

/**
 * A cast's landings of a key fewer than its slots, where the slots' kit hits differ in multiplier (nominalScale) by more
 * than VALUE_TOLERANCE: the landings take the slots whose multipliers their logged values fit (one scale for the cast,
 * within VALUE_TOLERANCE; crits and hits of unknown crit aside), and among those the slots their world time from the
 * first landing fits best. Applied only where it leaves fewer landings off their slot's value than the placement did.
 * The first landing keeps its slot unless the key is the cast's only one and a later first slot fits the landings' times
 * better by REALIGN_MS or their values better; the cast then starts from it (startFor). 9c0bb09daff2: Camille's Hunter
 * Pursuit at 13.37 s, its first hit unlogged: the logged 3556, 4302 and 22946 are hits 2–4 by their gaps (479 and 718 ms
 * against the kit's 433 and 700) and the last's value (×5.3, hit 4's 3.2 against 0.6); placed as hits 1–3, the cast
 * started 0.47 s late and its frame-70 Link came after Arcane's ultimate press. 791020039384: Tangtang's rogue wave
 * (352,792 at 54.34 s, ×10 a stare's multiplier) placed on her eighth stare's slot by time, the wave replay-only.
 */
function realignByValue(
  placed: Map<LogHit, PlacedHit>,
  slotsOf: (c: LoggedCast, key: string) => readonly Slot[] | null,
  scalesOf: (c: LoggedCast) => (k: KitHit) => readonly number[] | undefined,
  stops: readonly TimeStop[],
  restart: (c: LoggedCast, h: LogHit, slot: Slot) => LoggedCast | null,
  record: RealignRecord[] = [],
): void {
  const byCast = new Map<LoggedCast, Map<string, LogHit[]>>();
  for (const [h, p] of placed) {
    if (p.sameAs) continue;
    const keys = byCast.get(p.cast) ?? new Map<string, LogHit[]>();
    keys.set(h.event, [...(keys.get(h.event) ?? []), h]);
    byCast.set(p.cast, keys);
  }
  const tolerance = Math.log(VALUE_TOLERANCE);
  for (const [cast, keys] of byCast) {
    for (const [key, hits] of keys) {
      const s = slotsOf(cast, key);
      const n = hits.length;
      if (!s || n < 2 || n >= s.length) continue;
      const note = (why: string) => record.push({ cast, key, landings: n, why, realigned: false });
      if (s.some((x) => x.hits.some((k) => k.landedCount !== undefined))) {
        note("a slot of a counted landing (landedCount): not by value");
        continue;
      }
      const scales = scalesOf(cast);
      // Each slot's multipliers (its alternatives', each of a hit's own: nominalScales); a slot with a hit of none leaves
      // the values undecided.
      const slotScales = s.map((x) => x.hits.map((k) => scales(k)));
      if (slotScales.some((v) => v.some((m) => m === undefined))) {
        note("a slot whose hit has no multiplier: the values undecided");
        continue;
      }
      const ms = (slotScales as (readonly number[])[][]).map((v) => v.flat());
      const all = [...new Set(ms.flat())];
      if (Math.max(...all) / Math.min(...all) <= VALUE_TOLERANCE) continue; // the values can't tell the slots apart
      const list = [...hits].sort((a, b) => a.t - b.t);
      const now = list.map((h) => (placed.get(h) as PlacedHit).index);
      if (now.some((j, i) => j >= s.length || (i > 0 && j <= (now[i - 1] as number)))) {
        note("its landings' slots aren't in time order");
        continue;
      }
      // A crit's value, or a hit's whose crit the log doesn't say, isn't compared (a value of unknown crit fitting a slot
      // up to a crit's factor above it measured worse on a hold-out's total: docs/tried/2026-11-27-unknown-crit-slots.diff).
      const value = (h: LogHit) => (h.crit === false ? (h.uncapped ?? h.value) : null);
      const refs = list.flatMap((h) => {
        const v = value(h);
        return v !== null && v > 0 ? all.map((m) => v / m) : [];
      });
      if (refs.length === 0) {
        note("no landing of a known non-crit value (each a crit or of unknown crit): nothing to scale by");
        continue;
      }
      const off = (i: number, j: number, ref: number) => {
        const v = value(list[i] as LogHit);
        return v === null || v <= 0 || (ms[j] as number[]).some((m) => Math.abs(Math.log(v / (m * ref))) <= tolerance) ? 0 : 1;
      };
      const offOf = (at: readonly number[]) => Math.min(...refs.map((r) => at.reduce((a, j, i) => a + off(i, j, r), 0)));
      const before = offOf(now);
      if (before === 0) continue;
      const w = list.map((h) => worldMs((list[0] as LogHit).t, h.t, stops));
      // The least (values off, time off) assignment with the first landing at slot j0, under one scale `ref`.
      const fit = (j0: number, ref: number): { at: number[]; off: number; cost: number } | null => {
        const base = (s[j0] as Slot).frame;
        const cost = (i: number, j: number) => Math.abs((w[i] as number) - msOf((s[j] as Slot).frame - base));
        const score = (o: number, c: number) => o * 1e9 + c;
        const best: number[][] = Array.from({ length: n }, () => new Array<number>(s.length).fill(Infinity));
        const from: number[][] = Array.from({ length: n }, () => new Array<number>(s.length).fill(-1));
        (best[0] as number[])[j0] = score(off(0, j0, ref), 0);
        for (let i = 1; i < n; i++)
          for (let j = j0 + i; j <= s.length - (n - i); j++)
            for (let k = j0 + i - 1; k < j; k++) {
              const c = ((best[i - 1] as number[])[k] as number) + score(off(i, j, ref), cost(i, j));
              // Ties keep the earlier slot.
              if (c < ((best[i] as number[])[j] as number) - 1e-9) {
                (best[i] as number[])[j] = c;
                (from[i] as number[])[j] = k;
              }
            }
        const last = best[n - 1] as number[];
        let jEnd = -1;
        for (let j = 0; j < s.length; j++) if (Number.isFinite(last[j] as number) && (jEnd < 0 || (last[j] as number) < (last[jEnd] as number) - 1e-9)) jEnd = j;
        if (jEnd < 0) return null;
        const at = new Array<number>(n);
        for (let i = n - 1, j = jEnd; i >= 0; j = (from[i] as number[])[j] as number, i--) at[i] = j;
        const o = Math.min(...refs.map((r) => at.reduce((a, j, i) => a + off(i, j, r), 0)));
        return { at, off: o, cost: at.reduce((a, j, i) => a + cost(i, j), 0) };
      };
      const better = (a: { off: number; cost: number } | null, b: { off: number; cost: number } | null) => a !== null && (b === null || a.off < b.off || (a.off === b.off && a.cost < b.cost - 1e-9));
      const bestOf = (j0s: readonly number[]) => {
        let out: ReturnType<typeof fit> = null;
        for (const j0 of j0s) for (const r of refs) {
          const f = fit(j0, r);
          if (better(f, out)) out = f;
        }
        return out;
      };
      const kept = bestOf([now[0] as number]);
      const free = keys.size === 1 ? bestOf(Array.from({ length: s.length - n + 1 }, (_x, j) => j).filter((j) => j !== now[0])) : null;
      // A start moved by time alone is judged by the landings no other cast's stop separates from the first: a stop's
      // hold the log's clock doesn't follow isn't a reason to move it (791020039384: Tangtang's stares at 15-frame steps
      // up to Liino's combo stop at 50.23 s, which fit her first logged stare at its frame 76 as well as at 91).
      const clean = list.filter((h) => !stops.some((x) => msOf(x.start) < h.t && msOf(x.start + x.scales.length) > (list[0] as LogHit).t)).length;
      const cleanCost = (f: { at: readonly number[] }) => f.at.slice(0, clean).reduce((a, j, i) => a + Math.abs((w[i] as number) - msOf((s[j] as Slot).frame - (s[f.at[0] as number] as Slot).frame)), 0);
      const chosen = free !== null && (kept === null || free.off < kept.off || (free.off === kept.off && cleanCost(free) < cleanCost(kept) - REALIGN_MS)) ? free : kept;
      if (chosen === null || chosen.off >= before) {
        note(`${before} value(s) off their slots, and no assignment fits more`);
        continue;
      }
      const first = chosen.at[0] as number;
      const moved = first !== now[0] ? restart(cast, list[0] as LogHit, s[first] as Slot) : cast;
      if (moved === null) {
        note(`a better fit starts the cast at slot ${first}, which its group can't start from`);
        continue;
      }
      record.push({ cast: moved, key, landings: n, why: `${before} → ${chosen.off} value(s) off: slots ${now.join(",")} → ${chosen.at.join(",")}${moved !== cast ? ", the cast restarted" : ""}`, realigned: true });
      list.forEach((h, i) => {
        const p = placed.get(h) as PlacedHit;
        const slot = s[chosen.at[i] as number] as Slot;
        const { at: _at, joined: _joined, ...rest } = p;
        placed.set(h, { ...rest, cast: moved, index: chosen.at[i] as number, hits: slot.hits, frame: slot.frame, ...(slot.at ? { at: slot.at } : {}) });
      });
      // Another enemy's landing of a realigned one (sameAs) takes its slot.
      for (const [h, p] of placed) {
        const q = p.sameAs && p.cast === cast ? placed.get(p.sameAs) : undefined;
        if (q) placed.set(h, { ...q, sameAs: p.sameAs as LogHit });
      }
    }
  }
}

/**
 * How far a cast's landings' values may stray from one scale (×, either way) and still fit their slots' multipliers
 * (realignByValue): the buffs that change within a cast (a Stagger's ×1.3, a susceptibility, an amp: 7910's stares
 * 13,050 → 20,160, ×1.54) stay inside it, a final's or a wave's ×5–10 doesn't.
 */
const VALUE_TOLERANCE = 2;

/**
 * The cast of the same skill, placed from another key, that a key's first logged landing belongs to: the latest that
 * started no later than the landing and no earlier than the landing's kit frame (plus CAST_SLACK_MS) of the world's time
 * before it. A skill's jumps shorten its timeline, so a late landing comes sooner than its kit frame says
 * (fixtures/zmdlogs-4e5e1390085e.json: Rossi's wolves, kit frame 230, land 115 frames after her battle skill at 9483 ms;
 * placed from their frame alone, they made a battle skill at 5647 ms the log doesn't have). The log's time runs on
 * through time stops, which hold a landing still to come, its own operator's too (5082ceaffad1: Ardelia's combo bomb,
 * 52 frames after its projectile at 36030 ms, logged at 42441 ms across Yvonne's ultimate and her own). Null: none, a
 * new cast.
 */
function joinable(casts: readonly LoggedCast[], h: LogHit, frame: number, stops: readonly TimeStop[]): LoggedCast | null {
  let best: LoggedCast | null = null;
  for (const c of casts) {
    // Not the cast's own stops: its frames run on through them (Liino's ultimate).
    const held = stops.filter((s) => s.operator !== c.operator || s.skillId !== c.skillId);
    if (c.key === h.event || c.start > h.t || worldMs(c.start, h.t, held) > msOf(frame) + CAST_SLACK_MS) continue;
    if (!best || c.start > best.start) best = c;
  }
  return best;
}

/**
 * The cast a delayed hit's logged landing (KitHit.enemyDelay: its damage) belongs to: of the groups whose landing of the
 * key is delayed, the latest cast that started before it and has no landing of the key yet, within the landing's frame
 * plus CAST_SLACK_MS of the enemy's time: every time stop holds it, its own operator's too (dbaee23b801d: Typhoeus's
 * burst 2.5 s after her arrow at 5890 ms, across Liino's ultimate). A shot's burst is the latest shot's, whichever step
 * (bdf223db8e49: a burst at 14487 ms made a shot 5 the log doesn't have, its own shot 1 at 14025 ms none). Null: none.
 */
function joinDelayed(candidates: readonly Group[], h: LogHit, slots: (g: Group, key: string) => Slot[] | null, opened: ReadonlyMap<string, readonly LoggedCast[]>, stops: readonly TimeStop[], free: (c: LoggedCast) => boolean): { g: Group; cast: LoggedCast } | null {
  let best: { g: Group; cast: LoggedCast } | null = null;
  for (const g of candidates) {
    const first = slots(g, h.event)?.[0];
    if (!first?.hits.some((x) => x.enemyDelay !== undefined)) continue;
    for (const c of opened.get(g.id) ?? []) {
      if (c.key === h.event || c.start > h.t || worldMs(c.start, h.t, stops) > msOf(first.frame) + CAST_SLACK_MS || !free(c)) continue;
      if (!best || c.start > best.cast.start) best = { g, cast: c };
    }
  }
  if (best) return best;
  // The latest cast of these groups, with no landing of the key yet, where the stops between would hold the landing that
  // long laid end to end (stackedHeldMs): a pass's stops are the pass before's, and an ultimate placed there from its hit
  // alone starts later than its stop held the world (fc63a2001251 43.58 s: Typhoeus's burst, 3.7 s after her arrow at
  // 39.94 s across Gilberta's and Perlica's ultimates, the first placed at 41.60 s in pass 1 and 39.92 s in pass 2, made a
  // shot of its own whose arrow the log doesn't have, and her arrow's burst landed unlogged).
  let latest: { g: Group; cast: LoggedCast } | null = null;
  for (const g of candidates) for (const c of opened.get(g.id) ?? []) if (c.start <= h.t && (!latest || c.start > latest.cast.start)) latest = { g, cast: c };
  if (!latest || latest.cast.key === h.event || !free(latest.cast)) return null;
  const first = slots(latest.g, h.event)?.[0];
  if (!first?.hits.some((x) => x.enemyDelay !== undefined)) return null;
  return h.t - latest.cast.start - stackedHeldMs(latest.cast.start, h.t, stops) <= msOf(first.frame) + CAST_SLACK_MS ? latest : null;
}

/** The world time the stops overlapping `from`–`to` (ms) hold within it, each on its own (worldMs counts frames two stops share once). */
function stackedHeldMs(from: number, to: number, stops: readonly TimeStop[]): number {
  const [a, b] = [Math.round((from * FPS) / 1000), Math.round((to * FPS) / 1000)];
  let held = 0;
  for (const s of stops) for (let f = Math.max(a, s.start); f < Math.min(b, s.start + s.scales.length); f++) held += 1 - (s.scales[f - s.start] as number);
  return msOf(held);
}

/**
 * A new cast's first landing `h` (the key's slot 0) taken on the path a conditional jump of its skill goes to: when the
 * slot's hits all lie in the part a jump at `at` to `to` skips, one of them has a twin past `to` (engine paths.ts
 * pathTwin) with a slot of its own, and the start by slot 0's frame is before the operator's latest cast lets the skill
 * start (its windows listing the skill, in the world's time: other operators' stops hold it), while the start by the
 * twin's frame on the jumped path (its kit frame less to − at) is not. Then that slot and that start; else null.
 * Rossi's sequence 2 (combo_3: frame 0 → 212 without the perfect-timing ring): pending/zmdlogs-3f78ceb15bc3.json's
 * 50.55 s landing, 1.0 s after sequence 1's second hit (2.2–5 s in every other cast of hers), placed by the perfect hit's
 * frame 29 at 49.59 s, 13 frames before sequence 1's window (its frame 37) opens; by the late hit's 227 − 212 = 15 at
 * 50.05 s, inside it, where the ring (sequence 1's frame 52) isn't on yet, so the kit's own condition takes the jump.
 */
function jumpedFirst(data: GameData, g: Group, h: LogHit, s: readonly Slot[], prevs: readonly LoggedCast[], held: readonly TimeStop[]): { readonly index: number; readonly start: number } | null {
  const timing = data.skills[g.skillId]?.timing;
  const head = s[0];
  if (!timing || !head || g.kind === null) return null;
  const prev = prevs.filter((c) => c.kind !== null && c.start <= h.t).reduce<LoggedCast | null>((m, c) => (!m || c.start > m.start ? c : m), null);
  const windows = prev ? (data.skills[prev.skillId]?.timing?.windows ?? []).filter((w) => w.skills.includes(g.skillId)) : [];
  if (!prev || windows.length === 0) return null;
  const opens = Math.min(...windows.map((w) => w.from));
  const allowed = (start: number) => start >= prev.start && worldMs(prev.start, start, held) >= msOf(opens) - ON_TIME_MS;
  const skipStart = h.t - msOf(head.frame);
  if (allowed(skipStart)) return null;
  for (const j of timing.jumps) {
    if (!j.conditional || !head.hits.every((x) => (x.frames ?? []).length > 0 && (x.frames ?? []).every((f) => f >= j.at && f < j.to))) continue;
    for (const x of head.hits) {
      const twin = pathTwin({ hits: g.hits }, x, j.at, j.to);
      const index = twin ? s.findIndex((slot, i) => i > 0 && slot.hits.includes(twin)) : -1;
      if (index < 0) continue;
      const start = h.t - msOf((s[index] as Slot).frame - (j.to - j.at));
      if (allowed(start)) return { index, start };
    }
  }
  return null;
}

/**
 * Every start a new cast's first landing `h` had on its skill's paths (LoggedCast.paths): slot 0's, and for each
 * conditional jump whose skipped part holds slot 0's hits, the twin's past it (pathTwin) with the start by its frame on
 * the jumped path, each with whether the operator's latest cast's windows allow it (jumpedFirst's test). Empty where no
 * conditional jump skips slot 0 or the previous cast has no window for the skill: no choice of path to show.
 */
function pathAlternatives(data: GameData, g: Group, h: LogHit, s: readonly Slot[], prevs: readonly LoggedCast[], held: readonly TimeStop[]): PathAlternative[] {
  const timing = data.skills[g.skillId]?.timing;
  const head = s[0];
  if (!timing || !head || g.kind === null) return [];
  const prev = prevs.filter((c) => c.kind !== null && c.start <= h.t).reduce<LoggedCast | null>((m, c) => (!m || c.start > m.start ? c : m), null);
  const windows = prev ? (data.skills[prev.skillId]?.timing?.windows ?? []).filter((w) => w.skills.includes(g.skillId)) : [];
  if (!prev || windows.length === 0) return [];
  const opens = Math.min(...windows.map((w) => w.from));
  const allowed = (start: number) => start >= prev.start && worldMs(prev.start, start, held) >= msOf(opens) - ON_TIME_MS;
  const out: PathAlternative[] = [];
  for (const j of timing.jumps) {
    if (!j.conditional || !head.hits.every((x) => (x.frames ?? []).length > 0 && (x.frames ?? []).every((f) => f >= j.at && f < j.to))) continue;
    for (const x of head.hits) {
      const twin = pathTwin({ hits: g.hits }, x, j.at, j.to);
      const index = twin ? s.findIndex((slot, i) => i > 0 && slot.hits.includes(twin)) : -1;
      if (!twin || index < 0) continue;
      const slot = s[index] as Slot;
      const start = h.t - msOf(slot.frame - (j.to - j.at));
      out.push({ jump: { at: j.at, to: j.to }, hitId: twin.id, frame: slot.frame, start, allowed: allowed(start) });
    }
  }
  if (!out.length) return [];
  const skipStart = h.t - msOf(head.frame);
  return [{ jump: null, hitId: head.hits.map((x) => x.id).join("+"), frame: head.frame, start: skipStart, allowed: allowed(skipStart) }, ...out];
}

/** Casts of one skill placed from different keys this close are one cast. */
const CAST_MERGE_MS = 1000;

/** How close casts of a skill placed from different keys are one cast (ms): Placement.merge, else CAST_MERGE_MS. */
export function mergeMs(placement: Pick<Placement, "merge">, skillId: string): number {
  return placement.merge?.get(skillId) ?? CAST_MERGE_MS;
}

/** The logged casts of kit skills (not triggers' hits), one per cast: a cast placed from several of its keys counts once, at its earliest start. */
export function distinctCasts(placement: Placement): LoggedCast[] {
  const out: LoggedCast[] = [];
  for (const c of [...placement.casts].sort((a, b) => a.start - b.start)) {
    if (c.kind === null) continue;
    // Placed from the same key they are two casts (the placement already joined what one cast's landings of it can be),
    // unless an ultimate's, which isn't cast again within its own action (9c6e97486a9d: Liino's projectiles at 71835 to
    // 73824 ms fill their slots, the rest at 74159 ms start another cast 2.3 s after the first).
    if (out.some((x) => x.operator === c.operator && x.skillId === c.skillId && (x.key !== c.key || c.kind === "ultimate") && Math.abs(x.start - c.start) <= mergeMs(placement, c.skillId))) continue;
    out.push(c);
  }
  // A trigger's landing on a skill's cast that puts the cast earlier than its own keys do moves it there (dbaee23b801d:
  // Liino's ultimate, its first song beat at 8258 ms at frame 77, its projectiles' start 0.4 s later, its Cosmovoice
  // buffs then after Arcane's hits that the log has them on).
  // One placed from its event (eventStopStart) takes the trigger's start when that is within MIN_MOVE_MS after it: the
  // event and the trigger's landing then say the same moment (d9e59d0fb737: Liino's event at 9.48 s, her first song
  // beat at 9.50 s; a frame's move shifted Corrosion's ramp).
  for (const t of placement.casts) {
    if (t.kind !== null || !t.anchor) continue;
    const at = t.start - msOf(t.anchor.delay);
    const i = out.findIndex((x) => x.operator === t.operator && t.anchor?.skills.includes(x.skillId) && (at < x.start ? x.start - at <= mergeMs(placement, x.skillId) : x.fromEvent === true && at - x.start < MIN_MOVE_MS));
    if (i >= 0) out[i] = { ...(out[i] as LoggedCast), start: at };
  }
  return out;
}

/** Without a landing order: every hit with the key, in kit order (the replay takes the first). */
function allHits(groups: readonly Group[], key: string): KitHit[] {
  return groups.flatMap((g) => g.hits.filter((h) => h.events.includes(key)));
}

/** How far a cast's start may be from its anchor's (a skill's own cast placed from another key, or the skill a trigger fires on). */
const ANCHOR_MS = 1500;

/**
 * Which group a new cast of a key shared by several is: the one whose
 * anchor (the skill itself, placed from its other keys, or the skill whose
 * cast fires the trigger, plus the delay) started closest to where this
 * cast would start; else the chain step after the operator's latest cast
 * whose windows list a candidate starting within its action plus
 * CAST_SLACK_MS (for steps alike in every key, the one whose window lies
 * nearest its start, past a skill that keeps the chain) (`prev`: Rossi's
 * chain steps share keys; a follow-up after
 * a basic attack cast during its skill: Wulfgard's combo 3); else the
 * first in kit order. Steps gated by the kit's state rather than windows (Typhoeus's
 * hover attacks): the replay casts the step the engine allows
 * (replayrun.ts replayedSkill).
 */
function choose(candidates: readonly Group[], h: LogHit, starts: ReadonlyMap<string, readonly number[]> | null, slots: (g: Group, key: string) => Slot[] | null, prevs: readonly { cast: LoggedCast; timing: SkillTiming | null | undefined }[], stops: readonly TimeStop[], basicTiming: (skillId: string) => SkillTiming | null | undefined): { readonly g: Group; readonly why: CastChoice } {
  const ids = candidates.map((g) => g.id);
  const pick = (g: Group, why: Omit<CastChoice, "candidates">) => ({ g, why: { ...why, candidates: ids } });
  if (candidates.length === 1 || !starts) return pick(candidates[0] as Group, { rule: "first" });
  let best: { g: Group; d: number; r: number } | null = null;
  // A skill's own cast placed from its other keys is one cast: once a new cast took it as its anchor (or starts at it),
  // it decides no other (4d60e7fe92c2 2.80 s: Zhuang Fangyi's attack 4, whose range entity's key is attack 2's, took
  // attack 2's start from its swords at 1.87 s, which attack 2's own range hit at 1.66 s had taken: ×3.125 low, every
  // attack 4 of hers in five logs).
  const claimed = (g: Group, r: number) => prevs.some(({ cast: c }) => c.group === g.id && ((c.chosen?.rule === "anchor" && c.chosen.ref === Math.round(r)) || Math.abs(c.start - r) < 1));
  for (const g of candidates) {
    const start = h.t - msOf(slots(g, h.event)?.[0]?.frame ?? 0);
    const own = !g.anchor && !g.firedAt;
    const refs = (g.anchor ? g.anchor.skills.flatMap((s) => (starts.get(s) ?? []).map((t) => t + msOf((g.anchor as { delay: number }).delay))) : (g.firedAt ?? starts.get(g.id) ?? [])).filter((r) => !own || !claimed(g, r));
    for (const r of refs) {
      const d = Math.abs(start - r);
      if (d <= ANCHOR_MS && (!best || d < best.d)) best = { g, d, r };
    }
  }
  if (best) return pick(best.g, { rule: "anchor", ref: Math.round(best.r), d: Math.round(best.d) });
  const start = (g: Group) => h.t - msOf(slots(g, h.event)?.[0]?.frame ?? 0);
  // The latest first. Within a cast's action in the world's time: other casts' time stops hold it (489c0be3e162:
  // Wulfgard's combo 2 at 103625 ms, its ticks after Li Zhiyan's ultimate, an attack 3 at 103925 ms, then combo 3's
  // perfect hit at 107319 ms).
  // Steps alike in every key (the same keys, one landing each: Zhuang Fangyi's Empyrean attacks 1 and 2, whose four
  // entities are the same files) only the windows tell apart.
  const keys = (g: Group) => [...new Set(g.hits.flatMap((x) => x.events))].sort().join(" ");
  const alike = candidates.length > 1 && candidates.every((g) => g.kind === "basic" && g.hits.length === 1 && g.hits[0]?.count === 1 && keys(g) === keys(candidates[0] as Group));
  for (const prev of [...prevs].sort((a, b) => b.cast.start - a.cast.start)) {
    if (!prev.timing) continue;
    const timing = prev.timing;
    const held = stops.filter((s) => s.operator !== prev.cast.operator || s.skillId !== prev.cast.skillId);
    if (alike) {
      // A skill that keeps the basic-attack chain (dontInterruptCombo) doesn't decide its next step; the step before it
      // does (her Empyrean battle skill between her Empyrean attacks 1 and 2: d774d0ce7bd3 26504 ms).
      if (timing.keepsChain) continue;
      // The one whose window of the latest cast lies nearest its start (in it, or the least outside it), the kit's order
      // between equals: attack 1's windows list attack 2 from frame 22 and attack 1 from 60 (d774d0ce7bd3's 17896 ms is
      // attack 2's, its damage x1.4 attack 1's; 3aa6ab93bad4's 120691 ms 0.43 s of the world's time after attack 1).
      let near: { g: Group; d: number } | null = null;
      for (const g of candidates) {
        if (start(g) < prev.cast.start) continue;
        const at = worldMs(prev.cast.start, start(g), held);
        if (at > msOf(timing.durationFrames) + CAST_SLACK_MS) continue;
        for (const w of timing.windows) {
          if (!w.skills.includes(g.skillId)) continue;
          const d = Math.max(0, msOf(w.from) - at, at - msOf(w.to));
          if (!near || d < near.d) near = { g, d };
        }
      }
      if (near) return pick(near.g, { rule: "alike", by: { skillId: prev.cast.skillId, start: prev.cast.start }, d: Math.round(near.d) });
      continue;
    }
    const listed = new Set(timing.windows.flatMap((w) => w.skills));
    const next = candidates.find((g) => g.kind !== null && listed.has(g.skillId) && start(g) >= prev.cast.start && worldMs(prev.cast.start, start(g), held) <= msOf(timing.durationFrames) + CAST_SLACK_MS);
    if (next) return pick(next, { rule: "window", by: { skillId: prev.cast.skillId, start: prev.cast.start } });
    // A basic-attack step between whose keys the log lacks (its hits missed): a candidate its windows list, within both
    // actions, is the chain going on, not a restart (4d60e7fe92c2 148.72 s, 4bfc6f3e84b8 136.59 s: Zhuang Fangyi's attack
    // 4 after an attack 2, no attack 3 swords logged, ×3.125 attack 2's range hit, her attack 5 after it). Only basic
    // steps, the candidate's start within the two windows' sum plus CAST_SLACK_MS.
    if (prev.cast.kind === "basic" && candidates.every((g) => g.kind === "basic") && !timing.keepsChain) {
      for (const via of listed) {
        const t2 = basicTiming(via);
        if (!t2 || candidates.some((g) => g.skillId === via)) continue;
        const step = candidates.find((g) => {
          if (start(g) < prev.cast.start) return false;
          const at = worldMs(prev.cast.start, start(g), held);
          return timing.windows.some((w1) => w1.skills.includes(via) && t2.windows.some((w2) => w2.skills.includes(g.skillId) && Math.max(0, msOf(w1.from + w2.from) - at, at - msOf(w1.to + w2.to)) <= CAST_SLACK_MS));
        });
        if (step) return pick(step, { rule: "window", by: { skillId: prev.cast.skillId, start: prev.cast.start }, via });
      }
    }
    // Basic-attack steps sharing a key: only the latest cast that doesn't keep the chain says the step; one whose
    // windows list none of them restarted the chain (Ardelia's attacks 1 and 2, both keyed attack1_projhit, attack 1's
    // value ×1.5 attack 2's per projectile: af7b7f865906's 7785 ms, after her attack 3 and combo, was placed as attack 2
    // from attack 1's window 5 s before; f879, 79cc, c3c7, f978 alike).
    if (candidates.every((g) => g.kind === "basic") && !timing.keepsChain) return pick(candidates[0] as Group, { rule: "restart", by: { skillId: prev.cast.skillId, start: prev.cast.start } });
  }
  return pick(candidates[0] as Group, { rule: "first" });
}
