// Views of how the log check sees a fight, for diagnosis (`efsim zmdlogs casts | replay | stagger | differences |
// groups`): what agents otherwise rebuilt in three to five scratch scripts each (round-3 friction reports).
//
// - castsView: the placement (logcasts.ts placeHits): logged hits with the cast, slot and frame each was placed at,
//   the log's cast events, the placed casts and their time stops, in time order.
// - replayView: the replay (buffreplay.ts): its landings, each with the logged hit it stands for or "replay only",
//   logged hits without a landing and why, casts it couldn't make or made without the log, its Stagger windows, and
//   chosen kit buffs' windows.
// - staggerView / staggerSummary: per logged Stagger run (consecutive hits listing buff_common_poise_break_*), the
//   replay's window against it and where the engine's own would have ended (BuffReplay.staggerSpans, staggerHolds).
// - differencesReport: where the log's listing and the replay disagree (logDifferences), grouped by what differs, with
//   the damage's verdict (logged value over the engine's primary reading) per group: does the damage side with the
//   log or the replay?
// - groupsReport: one operator's mismatches grouped: by skill event, by what the log and replay disagree on, and
//   whether a teammate mismatches at the same ratio nearby (team-wide, so not this operator's kit).
// The last two read hit records (hitexport.ts), so they run on worker threads with --workers like `zmdlogs hits`.

import { effectiveKit, FPS, parseReactionEvent, type GameData, type LandedHit } from "@efsim/engine";
import { loggedCastFates, type BuffReplay } from "./buffreplay.ts";
import type { HitRecord } from "./hitexport.ts";
import { statusLanes, type ClockWhy, type PlacedHolds } from "./holds.ts";
import type { AppliedStop, TracedStatus } from "./replayrecord.ts";
import { distinctCasts, placeHits } from "./logcasts.ts";
import { replayTimeStops } from "./query.ts";
import { checkLog, corrosionRamp, engineHits, engineReport, logBuffReplay } from "./logcheck.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import type { TotalsComparison, TotalsShares } from "./enginecheck.ts";

/** A time window and operator filter of a view (ms; operator ids). */
export interface ViewFilter {
  readonly from?: number;
  readonly to?: number;
  readonly operators?: readonly string[];
}

const msOf = (frames: number) => (frames * 1000) / FPS;
const s = (ms: number) => (ms / 1000).toFixed(2);
const inWindow = (f: ViewFilter, t: number) => t >= (f.from ?? -Infinity) && t <= (f.to ?? Infinity);
const mine = (f: ViewFilter, op: string) => !f.operators?.length || f.operators.includes(op);

/** An operator's short label: its name, else its id without the chr_NNNN_ prefix. */
function label(data: GameData, op: string): string {
  return data.operators[op]?.name ?? op.replace(/^chr_\d+_/, "");
}
const shortSkill = (id: string) => id.replace(/^chr_\d+_[a-z0-9]+_/, "");

type Line = { readonly t: number; readonly order: number; readonly text: string };
const render = (lines: Line[]) =>
  lines
    .sort((a, b) => a.t - b.t || a.order - b.order)
    .map((l) => `${s(l.t).padStart(7)}  ${l.text}`)
    .join("\n");

/** More logged hits than this at one ms: the log batched their timestamps (docs/design/data.md "Timestamps are batched"). */
const BATCH_HITS = 3;

/** A mark after a logged hit's time when more than BATCH_HITS hits share its ms (a residual there isn't timing evidence). */
function batchMark(fx: LogFixture): (t: number) => string {
  const at = new Map<number, number>();
  for (const h of fx.hits) at.set(h.t, (at.get(h.t) ?? 0) + 1);
  return (t) => {
    const n = at.get(t) ?? 0;
    return n > BATCH_HITS ? ` [batched: ${n} hits at this ms]` : "";
  };
}

/** `zmdlogs casts`: the placement of a fight in time order (hits, cast events, placed casts, time stops). */
export function castsView(data: GameData, fx: LogFixture, f: ViewFilter = {}): string {
  const placement = placeHits(data, fx);
  const lines: Line[] = [];
  const batched = batchMark(fx);
  for (const c of fx.casts ?? []) if (inWindow(f, c.t) && mine(f, c.operator)) lines.push({ t: c.t, order: 0, text: `EVENT  ${label(data, c.operator)} ${shortSkill(c.skill)} (the log's cast event)` });
  for (const c of distinctCasts(placement)) {
    if (!inWindow(f, c.start) || !mine(f, c.operator)) continue;
    lines.push({ t: c.start, order: 1, text: `CAST   ${label(data, c.operator)} ${shortSkill(c.group)}${c.kind ? ` (${c.kind})` : ""} key ${shortSkill(c.key)}` });
  }
  // The stops the replay holds (query.ts replayTimeStops, the views' one list): a cast placed from its cast event alone
  // (an ultimate at its logged stop's end: db87's Laevatain at 16.60 s) is marked.
  for (const st of replayTimeStops(data, fx, placement)) {
    const [a, z] = [msOf(st.start), msOf(st.start + st.scales.length)];
    if (z < (f.from ?? -Infinity) || a > (f.to ?? Infinity)) continue;
    const zero = st.scales.filter((x) => x === 0).length;
    lines.push({ t: a, order: 2, text: `STOP   ${label(data, st.operator)} ${shortSkill(st.skillId)} ${s(a)}–${s(z)} s (${zero} of ${st.scales.length} frames at 0, lowest scale ${Math.min(...st.scales).toFixed(2)})${st.placed ? "" : " [no placed hits: the replay's cast from its event or inferred]"}` });
  }
  for (const h of fx.hits) {
    if (!inWindow(f, h.t)) continue;
    if (!mine(f, h.operator)) {
      lines.push({ t: h.t, order: 4, text: `  .    ${label(data, h.operator)} ${shortSkill(h.event)}` });
      continue;
    }
    const p = placement.hits.get(h);
    const where = p ? `${shortSkill(p.cast.group)}@${s(p.cast.start)} #${p.index}${p.frame !== undefined ? ` frame ${p.frame}` : ""}${p.sameAs ? " (same landing as another enemy's)" : ""}` : parseReactionEvent(h.event) ? "a status event" : "unplaced";
    // Whose skill the log credits the hit's Stagger to (LogHit.poise.origin), where that isn't the hit's own key or cast:
    // a projectile's or an entity's skill (Si's bursts by the stroke or Inksoul behind them).
    const origin = h.poise?.origin;
    const credited = origin !== undefined && origin !== h.event && !h.event.startsWith(origin) && origin !== p?.cast.skillId ? ` (origin ${shortSkill(origin)})` : "";
    lines.push({ t: h.t, order: 3, text: `HIT    ${label(data, h.operator)} ${shortSkill(h.event)} ${h.value} → ${where}${credited}${batched(h.t)}` });
  }
  return [`${fx.id}: placement (logcasts.ts placeHits); times in s, EVENT the log's cast events, CAST the casts as placed (start = first landing less its frame)`, render(lines)].join("\n");
}

/**
 * The slow-downs a replay's timeline applied (BuffReplay.appliedStops) paired with the log tools' stop list of its casts
 * (replayTimeStops): each applied one with its listed one (same start and caster, the same length and priority first:
 * a skill may start two at one frame, Rossi's combo_3), or null; and the listed ones no applied one took.
 */
export function stopsAgainstList<L extends { readonly start: number; readonly scales: readonly number[]; readonly operator: string; readonly priority?: number }>(applied: readonly AppliedStop[], listed: readonly L[]): { pairs: { applied: AppliedStop; listed: L | null }[]; unapplied: L[] } {
  const free = new Set(listed);
  const take = (ok: (l: L) => boolean): L | null => {
    for (const l of free) if (ok(l)) {
      free.delete(l);
      return l;
    }
    return null;
  };
  const same = (x: AppliedStop, l: L) => l.start === x.start && l.operator === x.operator;
  const found = new Map<AppliedStop, L | null>();
  for (const x of applied) found.set(x, take((l) => same(x, l) && l.scales.length === x.scales.length && l.priority === x.priority));
  for (const x of applied) if (found.get(x) === null) found.set(x, take((l) => same(x, l) && l.priority === x.priority) ?? take((l) => same(x, l)));
  return { pairs: applied.map((x) => ({ applied: x, listed: found.get(x) ?? null })), unapplied: listed.filter((l) => free.has(l)) };
}

/** The replay's landing of each logged hit (the hit it stands for), as the log check finds it. */
function landingsOf(replay: BuffReplay, fx: LogFixture): { byLanding: Map<LandedHit, LogHit>; missing: Map<LogHit, string> } {
  const byLanding = new Map<LandedHit, LogHit>();
  const missing = new Map<LogHit, string>();
  for (const h of fx.hits) {
    const l = parseReactionEvent(h.event) ? replay.statusLanding(h) : replay.landing(h);
    if ("unknown" in l) missing.set(h, l.unknown);
    else byLanding.set(l, h);
  }
  return { byLanding, missing };
}

/**
 * `zmdlogs replay`: the replay of a fight in time order: its landings (with the logged hit each stands for, or
 * "replay only"), logged hits without a landing and why, failed and missed casts, Stagger windows, and the windows of
 * the kit buffs named (`owner:id`, at the owner unless `@operator` follows); under other readings of open assumptions
 * with `assume` (as `zmdlogs check --assume`).
 */
export function replayView(data: GameData, fx: LogFixture, f: ViewFilter & { readonly buffs?: readonly string[]; readonly trace?: readonly string[]; readonly assume?: Readonly<Record<string, string>>; readonly stops?: boolean } = {}): string {
  const { replay } = logBuffReplay(data, fx, undefined, { ...(f.assume && Object.keys(f.assume).length ? { assume: f.assume } : {}), ...(f.trace?.length ? { trace: f.trace } : {}) });
  const { byLanding, missing } = landingsOf(replay, fx);
  const lines: Line[] = [];
  const batched = batchMark(fx);
  for (const l of replay.hits) {
    const t = msOf(l.frame);
    if (!inWindow(f, t) || !mine(f, l.operator)) continue;
    const h = byLanding.get(l);
    // Where the log gives no crit: the crit the replay took and which inference gave it (BuffReplay.critSource).
    const crit = h && h.crit === null && l.loggedCrit !== undefined ? ` [crit ${l.loggedCrit ? "yes" : "no"}: ${replay.critSource(h)}]` : "";
    const what = h ? `= logged ${shortSkill(h.event)} ${h.value} at ${s(h.t)}${h.t !== Math.round(t) ? ` (${Math.round(h.t - t) > 0 ? "+" : ""}${Math.round(h.t - t)} ms)` : ""}${batched(h.t)}${crit}` : "replay only";
    lines.push({ t, order: 2, text: `LAND   ${label(data, l.operator)} ${shortSkill(l.skillId)} ${l.hitId} ${l.damage}${l.count > 1 ? ` ×${l.count}` : ""} ${what}` });
  }
  for (const [h, why] of missing) if (inWindow(f, h.t) && mine(f, h.operator)) lines.push({ t: h.t, order: 3, text: `NOLAND ${label(data, h.operator)} ${shortSkill(h.event)} ${h.value}: ${why}` });
  for (const x of replay.failed) if (inWindow(f, x.cast.start) && mine(f, x.cast.operator)) lines.push({ t: x.cast.start, order: 1, text: `FAILED ${label(data, x.cast.operator)} ${shortSkill(x.cast.skillId)}: ${x.error}` });
  for (const m of replay.missed) if (inWindow(f, m.start) && mine(f, m.operator)) lines.push({ t: m.start, order: 1, text: `MISSED ${label(data, m.operator)} ${shortSkill(m.skillId)} made for ${shortSkill(m.need.skillId)}@${s(m.need.start)} (a cast that hits nothing, which the log can't show)` });
  // The log's cast events and what the cast assembly made of each (loggedCastFates).
  for (const e of loggedCastFates(data, fx)) {
    if (!inWindow(f, e.t) || !mine(f, e.operator)) continue;
    const what =
      e.fate === "placed" && e.cast
        ? `the placed cast's at ${s(e.cast.start)} s (${s(e.cast.world)} s of world time apart)`
        : e.fate === "tick"
          ? `a tick of ${e.buff} (KitBuff.ticksLoggedAs)`
          : e.fate === "press"
            ? "a press of its own (the skill's hits show elsewhere: a slot press)"
            : e.fate === "cast"
              ? "a cast of its own (no hit of the skill in the log)"
              : e.fate === "follow-up"
                ? "a follow-up-only skill: left to the engine"
                : "no kit skill of that id: ignored";
    lines.push({ t: e.t, order: 1, text: `EVENT  ${label(data, e.operator)} ${shortSkill(e.skill)} (the log's cast event): ${what}` });
  }
  for (const x of replay.castFlags) {
    const t = msOf(x.frame);
    if (inWindow(f, t) && mine(f, x.cast.operator)) lines.push({ t, order: 1, text: x.kind === "cuts" ? `CUTS   ${label(data, x.cast.operator)} ${shortSkill(x.skillId)}: ${x.why}` : `${x.kind === "forced" ? "FORCED" : "INSIDE"} ${label(data, x.cast.operator)} ${shortSkill(x.skillId)} made against its kit: ${x.why}` });
  }
  for (const x of replay.traces) {
    const t = msOf(x.frame);
    if (!inWindow(f, t)) continue;
    const exp = (v: number | null) => (v === null ? "none" : v === Infinity ? "never" : `${s(msOf(v))} s`);
    const moved = x.from !== null && x.to !== null ? ` (${x.to - x.from > 0 ? "+" : ""}${x.to - x.from} frames)` : "";
    // Gone with its expiry already past: it ran out between steps (BuffTrace.to), not cut by this one.
    if (x.to === null && x.from !== null && x.from <= x.frame) lines.push({ t: msOf(x.from), order: 0, text: `TRACE  ${x.buff} from ${s(msOf(x.appliedAt))}: ran out at its expiry ${exp(x.from)} (seen gone at ${x.step}, ${s(t)} s)` });
    else lines.push({ t, order: 0, text: `TRACE  ${x.buff} from ${s(msOf(x.appliedAt))}: expiry ${exp(x.from)} → ${exp(x.to)}${moved} at ${x.step}` });
  }
  // An enemy status's changes (`--trace-buff status:<status>`): keyed by status and applier, so a moved application is
  // a hold, not a new one; beside the log's runs of it (holds.ts statusLanes: since, last listed hit, by applier).
  const st = (x: TracedStatus | null) =>
    x === null ? "none" : `level ${x.level}${x.appliedAt !== undefined ? ` applied ${s(msOf(x.appliedAt))}` : ""} expiry ${Number.isFinite(x.expiresAt) ? s(msOf(x.expiresAt)) : "never"}${x.rampHeld ? ` (its ramp held at ${s(msOf(x.rampHeld.elapsed))} s until ${s(msOf(x.rampHeld.until))})` : ""}`;
  for (const x of replay.statusTraces) {
    const t = msOf(x.frame);
    if (!inWindow(f, t)) continue;
    const moved = x.from?.appliedAt !== undefined && x.to?.appliedAt !== undefined && x.from.appliedAt !== x.to.appliedAt ? ` (application moved ${x.to.appliedAt - x.from.appliedAt > 0 ? "+" : ""}${x.to.appliedAt - x.from.appliedAt} frames: a hold, not a reapplication)` : "";
    lines.push({ t, order: 0, text: `TRACE  status:${x.status} by ${x.operator ? label(data, x.operator) : "-"}: ${st(x.from)} → ${st(x.to)}${moved} at ${x.step}` });
  }
  const tracedStatuses = (f.trace ?? []).filter((x) => x.startsWith("status:")).map((x) => x.slice("status:".length));
  if (tracedStatuses.length) {
    for (const [key, runs] of statusLanes(fx).runs) {
      const [status, applier] = key.split("|") as [string, string];
      if (!tracedStatuses.includes(status) && !tracedStatuses.includes("*")) continue;
      for (const r of runs) if (r.lastListed >= (f.from ?? -Infinity) && r.since <= (f.to ?? Infinity)) lines.push({ t: r.since, order: 0, text: `LANE   status:${status} by ${label(data, applier)}: the log's run since ${s(r.since)}, listed to ${s(r.lastListed)}${r.refreshed ? " (refreshed in the log)" : ""}` });
    }
  }
  // The slow-downs the replay's timeline applied against the stop list the log tools build for its casts (replayTimeStops).
  if (f.stops) {
    const { pairs, unapplied } = stopsAgainstList(replay.appliedStops, replayTimeStops(data, fx));
    for (const { applied: x, listed: l } of pairs) {
      const t = msOf(x.start);
      if (!inWindow(f, t) || (x.operator !== null && !mine(f, x.operator))) continue;
      // One the list lacks beside a listed one of its start and caster running at least as low at every frame (a jump's
      // own slow-down at the jump's frame next to the frame-0 one: Purrchena's shielded combo, Rossi's combo_3 judged
      // late) holds nothing more.
      const covering = !l ? pairs.find((p) => p.listed && p.applied.start === x.start && p.applied.operator === x.operator && x.scales.every((v, i) => (p.listed?.scales[i] ?? 1) <= v)) : undefined;
      const vs = !l ? (covering ? `not in the log tools' list, covered by its ${covering.listed?.scales.length}-frame one (the same holds)` : "not in the log tools' list") : l.scales.length !== x.scales.length ? `the log tools' list has ${l.scales.length} frames (${shortSkill(l.skillId)})` : `as listed (${shortSkill(l.skillId)})`;
      lines.push({ t, order: 0, text: `STOP   the timeline's ${x.ultimate ? "ultimate stop" : "slow-down"} of ${x.operator ? label(data, x.operator) : "-"} ${s(t)}–${s(msOf(x.start + x.scales.length))} s (${x.scales.length} frames, lowest ×${Number(Math.min(...x.scales).toPrecision(2))}): ${vs}` });
    }
    for (const l of unapplied) {
      const t = msOf(l.start);
      if (!inWindow(f, t) || !mine(f, l.operator)) continue;
      lines.push({ t, order: 0, text: `STOP   listed for ${label(data, l.operator)} ${shortSkill(l.skillId)} at ${s(t)} s (${l.scales.length} frames): the timeline never applied it` });
    }
  }
  for (const w of replay.staggerSpans) {
    const [a, z] = [msOf(w.start), msOf(w.end)];
    if (z >= (f.from ?? -Infinity) && a <= (f.to ?? Infinity)) lines.push({ t: a, order: 0, text: `STAGGER the replay's window ${s(a)}–${s(z)} s` });
  }
  for (const spec of f.buffs ?? []) {
    const [buff, at] = spec.split("@") as [string, string | undefined];
    const operator = at ?? buff.split(":")[0] ?? "";
    for (const w of replay.kitWindows(buff, operator)) {
      if (w.end < (f.from ?? -Infinity) || w.start > (f.to ?? Infinity)) continue;
      const chain = w.replaces !== undefined ? ` (refreshes the one from ${s(w.replaces)}: the log keeps a refreshed run's since)` : "";
      lines.push({ t: w.start, order: 0, text: `BUFF   ${buff} at ${label(data, operator)} ${s(w.start)}–${w.end === Infinity ? "end" : s(w.end)}${w.expired ? " (ran out)" : ""}${chain}` });
    }
  }
  const forced = replay.castFlags.filter((x) => x.kind === "forced").length;
  const inside = replay.castFlags.filter((x) => x.kind === "inside").length;
  const cuts = replay.castFlags.filter((x) => x.kind === "cuts").length;
  const flagged = forced + inside ? `${forced} cast(s) FORCED against the kit's availability and ${inside} INSIDE another action's uncuttable frames: the replay's state may be wrong from each on. ` : "";
  const cutting = cuts ? `${cuts} cast(s) CUTS the running cast's pending hits (a legal interrupt). ` : "";
  const head = `${fx.id}: the replay (buffreplay.ts); times in s. ${replay.brokenAt !== null ? `It stopped at ${s(msOf(replay.brokenAt))} s. ` : ""}${flagged}${cutting}LAND its landings, NOLAND logged hits without one, EVENT the log's cast events and what the replay made of each, FAILED / MISSED casts it couldn't make / made without the log${f.trace?.length ? ", TRACE each change of a traced kit buff's expiry (or an enemy status's) and the step that made it, LANE the log's runs of a traced status" : ""}${f.stops ? ", STOP the slow-downs the timeline applied against the log tools' stop list" : ""}`;
  return [head, render(lines)].join("\n");
}

const isStaggered = (h: Pick<LogHit, "effects">) => h.effects.some((e) => /poise_break/.test(e.buff));

/** A logged Stagger run against the replay: the log's first and last Staggered hit, the next hit, the replay's window and the engine's own end (ms). */
export interface StaggerRun {
  readonly start: number;
  readonly last: number;
  /** The first hit after the run (null: the fight ended Staggered). */
  readonly next: number | null;
  /** The replay's windows overlapping the run (ms). */
  readonly replay: readonly { readonly start: number; readonly end: number }[];
  /** Where the engine's own Stagger would have ended, where the replay held it past that for the log (null: none held; "none": it had none running). */
  readonly engineEnd: number | "none" | null;
  /** Where the log's calm hit ended the run while the engine's own Stagger still ran: when the engine's would have ended (ms; null: it didn't). */
  readonly engineCut: number | null;
  /** The Stagger dealt during the run (each logged event once). */
  readonly dealt: number;
}

/** Every logged Stagger run of a fight with the replay's windows and the engine's own ends (`assume`: readings of open assumptions to replay under, TimelineOptions.assume). */
export function staggerRuns(data: GameData, fx: LogFixture, opts: { readonly assume?: Readonly<Record<string, string>> } = {}): StaggerRun[] {
  const { replay } = logBuffReplay(data, fx, undefined, opts);
  const spans = replay.staggerSpans.map((w) => ({ start: msOf(w.start), end: msOf(w.end) }));
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const out: StaggerRun[] = [];
  for (let i = 0; i < hits.length; i++) {
    if (!isStaggered(hits[i] as LogHit) || (i > 0 && isStaggered(hits[i - 1] as LogHit))) continue;
    let k = i;
    while (k + 1 < hits.length && isStaggered(hits[k + 1] as LogHit)) k++;
    const [a, b] = [(hits[i] as LogHit).t, (hits[k] as LogHit).t];
    const holds = replay.staggerHolds.filter((h) => msOf(h.frame) >= a - 100 && msOf(h.frame) <= b);
    const own = holds.find((h) => h.engineUntil !== null);
    const seen = new Set<string>();
    let dealt = 0;
    for (const x of hits.slice(i, k + 1)) {
      if (!x.poise) continue;
      const key = `${x.t}|${x.poise.origin ?? x.event}|${x.poise.dealt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dealt += x.poise.dealt;
    }
    out.push({
      start: a,
      last: b,
      next: hits[k + 1]?.t ?? null,
      replay: spans.filter((w) => w.end > a - 2000 && w.start < b),
      engineEnd: own ? msOf(own.engineUntil as number) : holds.length ? "none" : null,
      engineCut: ((c) => (c ? msOf(c.engineUntil) : null))(replay.staggerCuts.find((c) => msOf(c.frame) >= b && msOf(c.frame) <= (hits[k + 1]?.t ?? b) + 100)),
      dealt,
    });
    i = k;
  }
  return out;
}

/** `zmdlogs stagger`: a fight's Stagger runs, the log's against the replay's. */
export function staggerView(data: GameData, fx: LogFixture): string {
  const runs = staggerRuns(data, fx);
  const input = attackInputKeys(data, fx);
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const lines = runs.map((r) => {
    // Each run's Finishers (their hits up to 1.5 s past its last Staggered hit: the second one may land after) and the
    // enhanced basic attacks landed in it (in-game test 108: no Finisher while one is the input).
    const fin = hits.filter((h) => h.t >= r.start && h.t <= r.last + 1500 && input.get(`${h.operator}|${h.event}`) === "finisher");
    const enh = new Map<string, LogHit[]>();
    for (const h of hits) if (h.t >= r.start && h.t <= r.last && input.get(`${h.operator}|${h.event}`) === "enhanced") enh.set(h.operator, [...(enh.get(h.operator) ?? []), h]);
    const name = (op: string) => data.operators[op]?.name ?? op;
    const attacks = `; ${fin[0] ? `Finisher ${s(fin[0].t)} (${name(fin[0].operator)})` : "no Finisher"}${[...enh].map(([op, hs]) => `, ${name(op)}'s enhanced basic hits ${hs.length} (${s((hs[0] as LogHit).t)}–${s((hs.at(-1) as LogHit).t)})`).join("")}`;
    return staggerLine(r) + attacks;
  });
  return [`${fx.id} (${fx.enemy.id}): ${runs.length} logged Stagger run(s), the log's (first–last Staggered hit) against the replay's windows (times in s), with the Finisher and enhanced basic attacks in each`, ...lines].join("\n");
}

/**
 * The team's basic-attack event keys (`operator|event`) of a Finisher (skillSpecification 8) and of an enhanced basic
 * attack (skillSpecification 1 in the battle skill's or ultimate's skill group: engine timing.ts enhancedBasic).
 */
function attackInputKeys(data: GameData, fx: LogFixture): Map<string, "finisher" | "enhanced"> {
  const out = new Map<string, "finisher" | "enhanced">();
  for (const b of fx.team) {
    for (const k of effectiveKit(data, b)?.skills ?? []) {
      if (k.kind !== "basic") continue;
      const spec = data.skills[k.skillId]?.timing?.specification;
      const cls = spec === 8 ? "finisher" : spec === 1 && (data.operators[b.operator]?.skillGroups[k.skillId] ?? "basic") !== "basic" ? "enhanced" : null;
      if (cls) for (const h of k.hits) for (const e of h.events) out.set(`${b.operator}|${e}`, cls);
    }
  }
  return out;
}

/** One Stagger run against the replay's windows and the engine's own end. */
function staggerLine(r: StaggerRun): string {
  const first = r.replay[0];
  const gap = first ? r.last - first.end : 0;
  const short = first ? `; the replay's first window ends ${s(Math.abs(gap))} s ${gap >= 0 ? "before" : "after"} the log's last Staggered hit` : "";
  const engine = r.engineEnd === null ? (r.engineCut !== null ? `the engine's own would have run to ${s(r.engineCut)} (cut by the log's calm hit)` : "the engine's own covered it") : r.engineEnd === "none" ? "the engine had none running (held for the log)" : `the engine's own ended ${s(r.engineEnd)} (held for the log)`;
  return `  log ${s(r.start)}–${s(r.last)}${r.next === null ? " (to the fight's end)" : ` (next hit ${s(r.next)})`}, Stagger dealt ${r.dealt}: replay ${r.replay.map((w) => `${s(w.start)}–${s(w.end)}`).join(", ") || "none"}${short}; ${engine}`;
}

const quartiles = (xs: readonly number[], digits = 3) => {
  if (!xs.length) return "-";
  const v = [...xs].sort((a, b) => a - b);
  const q = (p: number) => (v[Math.floor(p * (v.length - 1))] as number).toFixed(digits);
  return `${q(0.25)} ${q(0.5)} ${q(0.75)}`;
};

/** Over many fights: how the replay's Stagger ends compare with the log's (each fight's runs from staggerRuns). */
export function staggerSummary(runs: readonly StaggerRun[]): string {
  const ended = runs.filter((r) => r.next !== null);
  const short = ended.flatMap((r) => (typeof r.engineEnd === "number" ? [(r.last - r.engineEnd) / 1000] : []));
  const none = ended.filter((r) => r.engineEnd === "none").length;
  const noReplay = runs.filter((r) => !r.replay.length).length;
  return `${runs.length} logged Stagger runs: the engine's own ran short in ${short.length} (shortfall quartiles ${quartiles(short, 2)} s), had none running in ${none}, and the replay had no window at all in ${noReplay}`;
}

/** A record's ratio: logged value over the engine's primary reading (null without one). */
const ratioOf = (r: HitRecord) => (r.predicted ? r.value / r.predicted : null);

/**
 * `zmdlogs differences`: the logged hits where the log's listing and the replay disagree (HitRecord.differences),
 * grouped by what differs and which side has it, each with its count, its mismatches and the quartiles of the logged
 * value over the engine's primary reading: a group whose damage follows the log (×1.3 where the log alone lists
 * Stagger) says the replay is wrong, one at ×1.000 that the log's listing is. Hits without a difference are the
 * baseline row.
 */
export function differencesReport(records: readonly HitRecord[], opts: { readonly what?: RegExp; readonly hits?: boolean; readonly fixtureLabel?: (fixture: string) => string } = {}): string {
  const groups = new Map<string, { n: number; mismatch: number; ratios: number[]; hits: string[] }>();
  const add = (key: string, r: HitRecord, detail: string) => {
    const g = groups.get(key) ?? { n: 0, mismatch: 0, ratios: [], hits: [] };
    g.n++;
    if (r.class === "mismatch") g.mismatch++;
    const q = ratioOf(r);
    if (q !== null) g.ratios.push(q);
    if (opts.hits) g.hits.push(`    ${(opts.fixtureLabel ?? ((x: string) => x))(r.fixture)} ${s(r.t)} ${r.operator} ${r.event} ${r.class} ×${q?.toFixed(4) ?? "-"}${detail ? ` ${detail}` : ""}`);
    groups.set(key, g);
  };
  let baseline = 0;
  for (const r of records) {
    if (r.kind !== "skill" || !r.landing) continue;
    const ds = (r.differences ?? []).filter((d) => !opts.what || opts.what.test(d.what));
    if (!r.differences?.length) {
      if (!opts.what) add("(no difference)", r, "");
      baseline++;
      continue;
    }
    for (const d of ds) add(`${d.what} | ${d.kind === "engine" ? "replay only" : d.kind === "log" ? "log only" : d.sameTotals ? "other values, same totals (cosmetic)" : "other values"}`, r, `engine [${d.engine.join(", ")}] log [${d.log.join(", ")}]`);
  }
  const rows = [...groups].sort((a, b) => b[1].n - a[1].n);
  const out = [`Where the log's listing and the replay disagree at kit hits with a landing (${records.length} records, ${baseline} without a difference); ratio = logged value ÷ the engine's primary reading (quartiles):`];
  const w = Math.min(70, Math.max(10, ...rows.map(([k]) => k.length)));
  for (const [k, g] of rows) {
    out.push(`  ${k.padEnd(w)}  ${String(g.n).padStart(5)} hits  ${String(g.mismatch).padStart(5)} mismatches  ratio ${quartiles(g.ratios)}`);
    out.push(...g.hits);
  }
  return out.join("\n");
}

/** How close two ratios count as the same, and how near in time a teammate's mismatch counts as nearby, for groupsReport. */
const SAME_RATIO = 0.015;
const NEAR_MS = 1500;

/**
 * The matches only the log's listing made (class "fallback") by skill event, each group's median logged ÷ the engine's
 * primary reading: a fallback match counts as a match, so a missing modifier hides behind it (round 5: Perlica's combo
 * hits, "match" at ×1.500 of the primary in three logs, Pulser Labs' +0.5 missing from the applying hit). A constant
 * ratio away from 1 is a modifier the replay lacks or has too much of.
 */
export function fallbackGroups(records: readonly HitRecord[]): string[] {
  const groups = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.class !== "fallback") continue;
    const k = shortSkill(r.event).replace(/\d+$/, "");
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (r.predicted) groups.set(k, [...(groups.get(k) ?? []), r.value / r.predicted]);
  }
  if (!counts.size) return ["Matches only by the log's listing (fallback): none"];
  const median = (xs: readonly number[]) => (xs.length ? ([...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] as number) : null);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [
    `Matches only by the log's listing (fallback: counted as matches, though the replay's reading is off), ${total} by skill event, with the median logged ÷ primary (a constant ratio: a modifier the replay lacks):`,
    ...[...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => {
        const m = median(groups.get(k) ?? []);
        return `  ${String(n).padStart(5)}  ${k}  median logged ÷ primary ${m === null ? "- (no primary reading)" : `×${m.toFixed(3)}`}`;
      }),
  ];
}

/**
 * `zmdlogs groups --operator`: an operator's mismatches sorted into causes. Per log: its hits, mismatches, those a
 * teammate shares (a teammate's mismatch at the same ratio within NEAR_MS: a team-wide factor, not this kit), those
 * without a landing; then the operator's own mismatches by skill event and by what the log and replay disagree on, each
 * with its median ratio.
 */
export function groupsReport(records: readonly HitRecord[], operator: string, opts: { readonly verbose?: boolean; readonly fixtureLabel?: (fixture: string) => string } = {}): string {
  const fxLabel = opts.fixtureLabel ?? ((x: string) => x);
  const byFixture = new Map<string, HitRecord[]>();
  for (const r of records) byFixture.set(r.fixture, [...(byFixture.get(r.fixture) ?? []), r]);
  const own: { r: HitRecord; q: number | null }[] = [];
  const perLog: string[] = [];
  let [hits, mism, team, noLanding] = [0, 0, 0, 0];
  for (const [fixture, rs] of byFixture) {
    const ops = rs.filter((r) => r.operator === operator);
    if (!ops.length) continue;
    let [m, tw, nl] = [0, 0, 0];
    for (const r of ops) {
      if (r.class !== "mismatch") continue;
      m++;
      const q = ratioOf(r);
      if (!r.landing) {
        nl++;
        own.push({ r, q });
        continue;
      }
      const shared = q !== null && rs.some((o) => o.operator !== operator && o.class === "mismatch" && Math.abs(o.t - r.t) <= NEAR_MS && (ratioOf(o) ?? 0) > 0 && Math.abs((ratioOf(o) as number) / q - 1) < SAME_RATIO);
      if (shared) tw++;
      else own.push({ r, q });
    }
    hits += ops.length;
    mism += m;
    team += tw;
    noLanding += nl;
    perLog.push(`  ${fxLabel(fixture)}  ${String(ops.length).padStart(5)} hits  ${String(m).padStart(4)} mismatches  ${String(tw).padStart(4)} team-wide  ${String(nl).padStart(4)} no landing  ${String(m - tw - nl).padStart(4)} own`);
  }
  const median = (xs: number[]) => (xs.length ? ([...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] as number).toFixed(3) : "-");
  const by = (key: (x: { r: HitRecord; q: number | null }) => string[]) => {
    const g = new Map<string, number[]>();
    const n = new Map<string, number>();
    for (const x of own) {
      for (const k of key(x)) {
        n.set(k, (n.get(k) ?? 0) + 1);
        if (x.q !== null) g.set(k, [...(g.get(k) ?? []), x.q]);
      }
    }
    return [...n].sort((a, b) => b[1] - a[1]).map(([k, c]) => `  ${String(c).padStart(5)}  ${k}  median ratio ${median(g.get(k) ?? [])}`);
  };
  const event = (r: HitRecord) => shortSkill(r.event).replace(/\d+$/, "");
  const out = [
    `${operator}: ${hits} hits in ${perLog.length} logs, ${mism} mismatches: ${team} team-wide (a teammate mismatches at the same ratio ±${100 * SAME_RATIO}% within ${NEAR_MS / 1000} s), ${noLanding} without a landing, ${mism - team - noLanding} own`,
    ...perLog,
    "",
    "Own mismatches (not team-wide) by skill event:",
    ...by(({ r }) => [event(r)]),
    "",
    "Own mismatches by where the log and the replay disagree (none: they agree on every buff they both model):",
    ...by(({ r }) => (r.differences?.length ? r.differences.map((d) => `${d.what} (${d.kind === "engine" ? "replay only" : d.kind === "log" ? "log only" : d.sameTotals ? "other values, same totals (cosmetic)" : "other values"})`) : [r.landing ? "none" : `no landing: ${r.unknown ?? "?"}`])),
    "",
    ...fallbackGroups(records.filter((r) => r.operator === operator)),
  ];
  if (opts.verbose) {
    out.push("", "Each own mismatch:");
    for (const { r, q } of own) out.push(`  ${fxLabel(r.fixture)} ${s(r.t)} ${r.event} logged ${r.value} predicted ${r.predicted ?? "-"} ×${q?.toFixed(4) ?? "-"}${r.differences?.length ? `  ${r.differences.map((d) => `${d.kind}:${d.what}`).join("; ")}` : ""}`);
  }
  return out.join("\n");
}

/** How much of a placed hold a unit is: a perfect dodge's world slow-down (BuffData, 0.512 s). */
const HOLD_UNIT_MS = 512;

/** A clock's earliest or latest P at a time (ms, linear between nodes), and the time P first reaches a mass. */
function clockAt(h: PlacedHolds, P: readonly number[], t: number): number {
  let i = 1;
  while (i < h.times.length - 1 && (h.times[i] as number) < t) i++;
  const [t0, t1, p0, p1] = [h.times[i - 1] as number, h.times[i] as number, P[i - 1] as number, P[i] as number];
  return t1 === t0 ? p1 : p0 + (p1 - p0) * Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
}
function clockReaches(h: PlacedHolds, P: readonly number[], m: number): number {
  const i = P.findIndex((x) => x >= m - 1e-6);
  if (i <= 0) return h.times[0] as number;
  const [t0, t1, p0, p1] = [h.times[i - 1] as number, h.times[i] as number, P[i - 1] as number, P[i] as number];
  return p1 === p0 ? t1 : t0 + ((m - p0) / (p1 - p0)) * (t1 - t0);
}

/**
 * `zmdlogs holds`: the fight's hidden holds the replay places (engine assumption hidden-holds, reading `placed`:
 * holds.ts placeHolds): the least total, each dodge-sized unit of it with its earliest and latest time and the clocks
 * spanning it (a buff's run, a tick series), the bounds dropped as conflicting, and (with `verbose`) every bound.
 */
export function holdsView(data: GameData, fx: LogFixture, opts: { readonly verbose?: boolean; readonly why?: RegExp } = {}): string {
  const r = logBuffReplay(data, fx, placeHits(data, fx), { assume: { "hidden-holds": "placed" } }).replay;
  const h = r.hiddenHolds;
  if (!h) return `${fx.id}: no holds placed (no kit to replay)`;
  if (opts.why) return holdsWhy(data, fx, r.holdClocks ?? [], h, opts.why, r.logEnds);
  const series = (tag: string) => tag.replace(/ [0-9]+[→⇒][0-9]+ ms$/, "");
  const lines = [`${fx.id}: ${s(h.total)} s of hidden holds placed (the least total the clocks allow; ${Math.round(h.total / HOLD_UNIT_MS)} perfect dodges' worth at 0.512 s), ${new Set(h.kept.filter((b) => b.kind === "run").map((b) => b.tag)).size} buff runs and ${new Set(h.kept.filter((b) => b.kind === "tick").map((b) => series(b.tag))).size} tick series kept, ${h.dropped.length} bound(s) dropped; times in s`];
  for (let m = HOLD_UNIT_MS / 2; m < h.total; m += HOLD_UNIT_MS) {
    const [early, late, mid] = [clockReaches(h, h.early, m), clockReaches(h, h.late, m), clockReaches(h, h.mid, m)];
    const clocks = [...new Set(h.kept.filter((b) => b.a <= early && late <= b.b).map((b) => (b.kind === "run" ? b.tag : series(b.tag))))];
    lines.push(`  unit ${s(m)} s: placed at ${s(mid)} (earliest ${s(early)}, latest ${s(late)}), ${clocks.length} clock(s) span it${opts.verbose && clocks.length ? `: ${clocks.join("; ")}` : ""}`);
  }
  for (const b of h.dropped) lines.push(`  dropped: ${b.tag} (asks ${b.ex.toFixed(2)} s)`);
  if (opts.verbose) for (const b of h.kept) lines.push(`  bound: ${b.tag}: P(${s(b.b)}) − P(${s(b.a)}) in [${Number.isFinite(b.min) ? s(b.min) : "−∞"}, ${Number.isFinite(b.max) ? s(b.max) : "∞"}] s; placed ${s(clockAt(h, h.mid, b.b) - clockAt(h, h.mid, b.a))}`);
  return lines.join("\n");
}

/**
 * `zmdlogs holds --why <re>`: each replayed instance of the kit buffs (`owner:id`) and enemy statuses (`status:<name>`)
 * matching, from the replay without holds, with the log's run it was paired with and why it is a clock of the
 * placement or not (holds.ts ClockWhy: the one place runBounds and statusBounds say so), and for a bound whether the
 * placement kept or dropped it.
 */
function holdsWhy(data: GameData, fx: LogFixture, clocks: readonly ClockWhy[], h: PlacedHolds, re: RegExp, logEnds: BuffReplay["logEnds"] = []): string {
  // By id (owner:id, status:<name>) or with the owner's name (Perlica:wpn_funnel_0008.arts_taken), case aside.
  const named = (c: ClockWhy) => (c.clock.startsWith("status:") ? c.clock : `${label(data, c.clock.slice(0, c.clock.indexOf(":")))}${c.clock.slice(c.clock.indexOf(":"))}`);
  const ci = new RegExp(re.source, re.flags.includes("i") ? re.flags : `${re.flags}i`);
  const mine = clocks.filter((c) => ci.test(c.clock) || ci.test(named(c)));
  const known = [...new Set(clocks.map((c) => c.clock))].sort();
  if (!mine.length) return `${fx.id}: no kit buff or enemy status matching ${re} among the replay's (${known.length ? known.join(", ") : "none"})`;
  const dropped = new Set(h.dropped.map((b) => b.tag));
  const kept = new Set(h.kept.map((b) => b.tag));
  const lines = [`${fx.id}: why each instance is a clock of the hidden holds or not (the replay without them; instance and run times in s, the instance's end its expiry there)`];
  // One line per instance and run (an enemy buff's instances come once per recipient), by clock, then time.
  const once = [...new Map(mine.map((c) => [JSON.stringify(c), c])).values()].sort((a, b) => a.clock.localeCompare(b.clock) || (a.instance?.start ?? -1) - (b.instance?.start ?? -1) || (a.run?.since ?? 0) - (b.run?.since ?? 0));
  for (const c of once) {
    const who = c.clock.startsWith("status:") ? `by ${label(data, c.holder)}` : `on ${c.holder === "enemy" ? "the enemy" : label(data, c.holder)}`;
    const inst = c.instance ? `${s(msOf(c.instance.start))}–${s(msOf(c.instance.end))}` : "every instance";
    const run = c.run ? `; the log's run ${c.run.name} ${s(c.run.since)}–${s(c.run.lastListed)}` : "";
    const tag = c.verdict.startsWith("bound: ") ? c.verdict.slice(7) : null;
    const verdict = tag === null ? c.verdict : `a clock (asks ${(c.ask ?? 0).toFixed(2)} s): ${dropped.has(tag) ? "dropped by the placement as conflicting" : kept.has(tag) ? "kept" : "not placed"}`;
    lines.push(`  ${named(c)} ${who} ${inst}${run}: ${verdict.replace(/chr_\d{4}_[a-z0-9]+/g, (op) => label(data, op))}`);
  }
  // The log-end side (heldToLoggedEnds): each instance that reached its expiry in the check's replay, kept to the log's end or not, and why.
  const ends = logEnds.filter((e) => ci.test(e.buff) || ci.test(`${label(data, e.buff.slice(0, e.buff.indexOf(":")))}${e.buff.slice(e.buff.indexOf(":"))}`)).sort((a, b) => a.buff.localeCompare(b.buff) || a.appliedAt - b.appliedAt);
  if (ends.length) lines.push("the log's end (heldToLoggedEnds, in the check's replay): each instance that reached its expiry");
  for (const e of ends) lines.push(`  ${label(data, e.buff.slice(0, e.buff.indexOf(":")))}${e.buff.slice(e.buff.indexOf(":"))} from ${s(msOf(e.appliedAt))}: ${e.why}`);
  return lines.join("\n");
}

/**
 * `zmdlogs ramp`: Corrosion's ramp as the logged hits read it (rampsteps.ts rampSteps, at the replay's landings): per
 * Corrosion the log lists (its applier and application), each hit's steps that fit against the replay's own step, and
 * the hidden hold that reading allows between the application and the hit (P(hit) − P(since), s) beside the one the
 * replay placed. A hit outside its range says the placed holds miss the ramp there (`!`). `verbose`: every hit, not only
 * those where the log's step differs from the replay's or the placed hold falls outside.
 */
export function rampView(data: GameData, fx: LogFixture, opts: { readonly verbose?: boolean; readonly why?: boolean } = {}): string {
  const placement = placeHits(data, fx);
  const { replay } = logBuffReplay(data, fx, placement);
  const steps = corrosionRamp(data, fx, placement, replay);
  const h = replay.hiddenHolds;
  if (steps.length === 0) return `${fx.id}: no hit under the log's Corrosion reads a step (none listed, no landing with the replay's Corrosion, or no step fits)`;
  const lines = [`${fx.id}: ${steps.length} hits read Corrosion's ramp (steps: whole seconds of its world time; hold: P(hit) − P(since) in s, as the steps allow and as placed)${opts.why ? "; held: what held the replay's ramp from its application to the landing (time stops of the replay's casts, at their lowest scale; placed hidden holds; the rest: statuses created in a stop, the stop a reset cut, the frame grid; freezes run the ramp on)" : ""}`];
  const stops = opts.why ? replayTimeStops(data, fx, placement) : [];
  const heldText = (x: (typeof steps)[number]): string => {
    if (!x.replay) return "";
    const { applied, landing, elapsed } = x.replay;
    const real = landing - applied;
    const [a, b] = [Math.round((applied * FPS) / 1000), Math.round((landing * FPS) / 1000)];
    // Each stop's share: the frames it is the lowest scale in, at 1 less that scale.
    const share = new Map<string, number>();
    for (let f = a; f < b; f++) {
      let low: (typeof stops)[number] | null = null;
      for (const st of stops) if (f >= st.start && f < st.start + st.scales.length && (low === null || (st.scales[f - st.start] as number) < (low.scales[f - low.start] as number))) low = st;
      if (!low) continue;
      const k = `${label(data, low.operator)} ${shortSkill(low.skillId)}@${s(msOf(low.start))}`;
      share.set(k, (share.get(k) ?? 0) + msOf(1 - (low.scales[f - low.start] as number)));
    }
    const byStops = [...share.values()].reduce((t, v) => t + v, 0);
    const holds = h ? h.holds.filter((y) => y.frame >= a && y.frame < b).reduce((t, y) => t + msOf(y.frames), 0) : 0;
    const rest = real - elapsed - byStops - holds;
    const parts = [...share].sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k} ${s(v)}`);
    return `; held ${s(real - elapsed)} s of ${s(real)}: stops ${s(byStops)}${parts.length ? ` (${parts.join(", ")})` : ""}, holds ${s(holds)}, rest ${s(rest)}${x.since !== Math.round(applied) ? `; the log's application ${s(x.since)}, the replay's ${s(applied)}` : ""}`;
  };
  const by = new Map<string, typeof steps>();
  for (const x of steps) by.set(`${x.source}|${x.since}`, [...(by.get(`${x.source}|${x.since}`) ?? []), x]);
  for (const [k, list] of by) {
    const [source, since] = k.split("|") as [string, string];
    const off = list.filter((x) => x.replayStep < x.low || x.replayStep > x.high);
    lines.push(`  Corrosion level ${list[0]?.level} by ${label(data, source)} since ${s(Number(since))}: ${list.length} hits, ${off.length} at another step than the replay's`);
    for (const x of list) {
      const lo = x.capped ? -Infinity : x.world - (x.high + 1) * 1000;
      const hi = x.world - x.low * 1000;
      const placed = h ? clockAt(h, h.mid, x.hit.t) - clockAt(h, h.mid, x.since) : 0;
      const outside = placed < lo - 70 || placed > hi + 70;
      if (!opts.verbose && !outside && x.replayStep >= x.low && x.replayStep <= x.high) continue;
      const steps = `${x.low}${x.high !== x.low ? `–${x.high}` : ""}${x.capped ? "+" : ""}`;
      lines.push(`    ${s(x.hit.t)} ${label(data, x.hit.operator)} ${x.hit.event}: log step ${steps}, replay ${x.replayStep} (${x.reading}); hold ${Number.isFinite(lo) ? s(lo) : "−∞"}…${s(hi)}, placed ${s(placed)}${outside ? " !" : ""}${opts.why ? heldText(x) : ""}`);
    }
  }
  return lines.join("\n");
}

/**
 * `zmdlogs totals`: the simulated total split into its parts, per operator: the landings that stand for logged hits
 * (their predictions against the logged values), the replay-only landings (no logged hit: listed largest first) and
 * the logged hits the total has no landing for (the log's side only), with the recorded bursts' shifts (Si's Artful
 * Intent). A total that moves while the per-hit views improve is a compensating error: its other side shows here
 * (round 8: 458b's Laevatain, 9.0 → 11.3% from two replay-only finisher landings, found by hand from a replay dump).
 */
export function totalsView(data: GameData, fx: LogFixture, f: { readonly operators?: readonly string[]; readonly top?: number; readonly assume?: Readonly<Record<string, string>>; readonly byEvent?: boolean } = {}): string {
  const replay = f.assume && Object.keys(f.assume).length ? logBuffReplay(data, fx, undefined, { assume: f.assume }) : logBuffReplay(data, fx);
  const byHit = engineHits(data, fx, replay);
  const t = engineReport(data, fx, replay, byHit, checkLog(data, fx, { replay, engineHits: byHit })).totals;
  if (f.byEvent) return totalsByEvent(data, fx, t, f);
  const top = f.top ?? 10;
  const pct = (sim: number, log: number) => (log === 0 ? "n/a" : `${sim / log - 1 > 0 ? "+" : ""}${(100 * (sim / log - 1)).toFixed(1)}%`);
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  const counted = new Set(t.parts.flatMap((p) => (p.logged ? [p.logged] : [])));
  const ops = [...new Set([...Object.keys(t.logged.perOperator), ...Object.keys(t.simulated.perOperator)])].filter((op) => !f.operators?.length || f.operators.includes(op));
  const out = [
    `${fx.id}: the simulated total's parts (enginecheck.ts fightTotals; damage simulated vs logged). matched: the landings standing for logged hits, predicted vs their logged values; replay only: landings no logged hit stands for (counted to the log's last hit); log only: logged hits the total has no landing for; shifts: recorded bursts' teammate shares taken as logged.`,
    `  team: ${n(t.simulated.damage)} vs ${n(t.logged.damage)} (${pct(t.simulated.damage, t.logged.damage)})`,
    ...(t.away.windows.length ? [`  enemy away (engine assumption enemy-away; no logged hit for 6 s or more): ${t.away.windows.map((w) => `${s(w.from)}–${s(w.to)} s`).join(", ")}; ${t.away.leftOut} replay-only landing(s) there not counted`] : []),
  ];
  for (const op of ops) {
    const mine = t.parts.filter((p) => p.operator === op);
    const matched = mine.filter((p) => p.logged);
    const only = mine.filter((p) => !p.logged).sort((a, b) => b.damage - a.damage);
    const logOnly = fx.hits.filter((h) => h.operator === op && !counted.has(h));
    const sum = (xs: readonly { damage: number }[]) => xs.reduce((a, x) => a + x.damage, 0);
    const loggedOf = matched.reduce((a, p) => a + (p.logged as LogHit).value, 0);
    const logOnlySum = logOnly.reduce((a, h) => a + h.value, 0);
    const shift = t.recordedShifts.filter((x) => x.operator === op).reduce((a, x) => a + x.amount, 0);
    out.push(
      `  ${label(data, op)}: ${n(t.simulated.perOperator[op] ?? 0)} vs ${n(t.logged.perOperator[op] ?? 0)} (${pct(t.simulated.perOperator[op] ?? 0, t.logged.perOperator[op] ?? 0)}): matched ${n(sum(matched))} vs ${n(loggedOf)} (${pct(sum(matched), loggedOf)}, ${matched.length} landing(s)); simulated + replay only ${n(sum(only))} (${only.length} landing(s))${shift ? ` + shifts ${n(shift)}` : ""}; logged + log only ${n(logOnlySum)} (${logOnly.length} hit(s))`,
    );
    for (const p of only.slice(0, top)) out.push(`      replay only ${s(msOf(p.frame))} s  ${shortSkill(p.skillId)} ${p.hitId}  ${n(p.damage)}`);
    if (only.length > top) out.push(`      … and ${only.length - top} more replay-only landing(s), ${n(sum(only.slice(top)))}`);
    for (const h of [...logOnly].sort((a, b) => b.value - a.value).slice(0, top)) out.push(`      log only    ${s(h.t)} s  ${shortSkill(h.event)}  ${n(h.value)}`);
    if (logOnly.length > top) out.push(`      … and ${logOnly.length - top} more logged hit(s) without a counted landing`);
  }
  return out.join("\n");
}

/** `zmdlogs totals --by event`: the parts per operator and logged event (replay-only per skill and hit), as % of the logged total, largest |share| first. */
function totalsByEvent(data: GameData, fx: LogFixture, t: TotalsComparison, f: { readonly operators?: readonly string[]; readonly top?: number }): string {
  const L = t.logged.damage;
  const rows = new Map<string, { m: number; n: number; o: number; no: number; lo: number; nlo: number }>();
  const row = (k: string) => rows.get(k) ?? (rows.set(k, { m: 0, n: 0, o: 0, no: 0, lo: 0, nlo: 0 }), rows.get(k) as { m: number; n: number; o: number; no: number; lo: number; nlo: number });
  const counted = new Set(t.parts.flatMap((p) => (p.logged ? [p.logged] : [])));
  const mine = (op: string) => !f.operators?.length || f.operators.includes(op);
  for (const p of t.parts) {
    if (!mine(p.operator)) continue;
    if (p.logged) {
      const r = row(`${label(data, p.operator)} ${shortSkill(p.logged.event)}`);
      r.m += p.damage - p.logged.value;
      r.n++;
    } else {
      const r = row(`${label(data, p.operator)} [replay only] ${shortSkill(p.skillId)} ${p.hitId}`);
      r.o += p.damage;
      r.no++;
    }
  }
  for (const h of fx.hits) {
    if (counted.has(h) || !mine(h.operator)) continue;
    const r = row(`${label(data, h.operator)} ${shortSkill(h.event)}`);
    r.lo -= h.value;
    r.nlo++;
  }
  const pc = (x: number) => `${x >= 0 ? "+" : ""}${((100 * x) / L).toFixed(2)}%`;
  const all = [...rows].sort((a, b) => Math.abs(b[1].m + b[1].o + b[1].lo) - Math.abs(a[1].m + a[1].o + a[1].lo));
  const out = [`${fx.id}: the total ${pc(t.simulated.damage - L)} by operator and logged event (% of the logged total): matched (predicted − logged), replay only, log only`];
  for (const [k, r] of all.slice(0, f.top ?? 25)) {
    const parts = [r.n ? `matched ${pc(r.m)} (${r.n})` : "", r.no ? `replay only ${pc(r.o)} (${r.no})` : "", r.nlo ? `log only ${pc(r.lo)} (${r.nlo})` : ""].filter(Boolean);
    out.push(`  ${pc(r.m + r.o + r.lo).padStart(8)}  ${k}: ${parts.join(", ")}`);
  }
  if (all.length > (f.top ?? 25)) out.push(`  … and ${all.length - (f.top ?? 25)} more`);
  return out.join("\n");
}

/** One fight's row of `zmdlogs totals --all`: its short id, its group (TOTALS_GROUPS) and its shares. */
export interface TotalsRow {
  readonly short: string;
  readonly group: TotalsGroup;
  readonly shares: TotalsShares;
}
export type TotalsGroup = "verified" | "development" | "earlier" | "multi";
const TOTALS_GROUPS: readonly TotalsGroup[] = ["verified", "development", "earlier", "multi"];

/** The group means of some fights' shares (|error|, |matched|, replay-only, |log-only|) and how many are one-sided (replay-only + |log-only| over |matched|). */
export function totalsAggregate(shares: readonly TotalsShares[]): { readonly n: number; readonly error: number; readonly matched: number; readonly replayOnly: number; readonly logOnly: number; readonly oneSided: number; readonly within5: number } {
  const mean = (f: (x: TotalsShares) => number) => (shares.length ? shares.reduce((a, x) => a + f(x), 0) / shares.length : 0);
  return {
    n: shares.length,
    error: mean((x) => Math.abs(x.error)),
    matched: mean((x) => Math.abs(x.matched)),
    replayOnly: mean((x) => x.replayOnly),
    logOnly: mean((x) => -x.logOnly),
    oneSided: shares.filter((x) => x.replayOnly - x.logOnly > Math.abs(x.matched)).length,
    within5: shares.filter((x) => Math.abs(x.error) <= 5).length,
  };
}

/** An aggregate's line (totalsAggregate): the same for a group of development logs and for the hold-outs (measure). */
export function formatTotalsAggregate(name: string, a: ReturnType<typeof totalsAggregate>): string {
  const p = (x: number) => `${x.toFixed(1)}%`;
  return `  ${name}: ${a.n} fight(s), mean |error| ${p(a.error)} (within 5%: ${a.within5}); mean |matched| ${p(a.matched)}, replay-only ${p(a.replayOnly)}, log-only ${p(a.logOnly)}; one-sided (replay-only + log-only over |matched|) ${a.oneSided}`;
}

/**
 * `zmdlogs totals --all`: every fight's total error split into matched scale, replay-only and log-only landings (shares
 * of the logged total: TotalsShares), largest |error| first, with the operators carrying most of it; then each group's
 * means. A cause shared by several fights shows as a column or an operator recurring (2026-11-23: the enemy away and
 * the Endministrator's shatters were found from this table, built by hand). Hold-outs only as aggregates: measure.
 */
export function totalsAllView(data: GameData, rows: readonly TotalsRow[], f: { readonly operators?: readonly string[]; readonly top?: number } = {}): string {
  const sign = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}`.padStart(6);
  const top = f.top ?? 3;
  const out = [
    "Every fight's total error by where it lives, as % of its logged total (enginecheck.ts totalsShares): error = matched (the landings standing for logged hits, predicted − logged) + replay only (landings no logged hit stands for) + log only (logged hits without a counted landing). away: replay-only landings left out in stretches without logged hits (enemy-away), and those stretches' seconds. Operators: their matched / replay-only / log-only (+ shifts: a recorded burst's teammate share) shares, largest first.",
    "id    group        error matched replay  log  away     operators",
  ];
  const shown = [...rows].filter((r) => !f.operators?.length || r.shares.perOperator.some((o) => f.operators?.includes(o.operator))).sort((a, b) => Math.abs(b.shares.error) - Math.abs(a.shares.error));
  for (const r of shown) {
    const x = r.shares;
    const ops = x.perOperator
      .filter((o) => !f.operators?.length || f.operators.includes(o.operator))
      .slice(0, top)
      .map((o) => `${label(data, o.operator)} ${sign(o.matched).trim()}/${sign(o.replayOnly).trim()}/${sign(o.logOnly).trim()}${Math.abs(o.shifts) >= 0.05 ? ` (${sign(o.shifts).trim()})` : ""}`)
      .join("; ");
    const away = x.awayLeftOut ? `${String(x.awayLeftOut).padStart(3)}/${x.awaySeconds.toFixed(0).padStart(3)}s` : "        ";
    out.push(`${r.short.padEnd(5)} ${r.group.padEnd(11)} ${sign(x.error)} ${sign(x.matched)}  ${sign(x.replayOnly)} ${sign(x.logOnly)} ${away}  ${ops}`);
  }
  out.push("", "Means per group:");
  for (const g of TOTALS_GROUPS) {
    const of = shown.filter((r) => r.group === g).map((r) => r.shares);
    if (of.length) out.push(formatTotalsAggregate(g, totalsAggregate(of)));
  }
  out.push("Hold-outs: only their aggregates, from `npm run measure` (its summary's \"Totals by where the error lives\").");
  return out.join("\n");
}
