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

import { effectiveKit, everyTarget, expireStatus, FPS, kitHitEntries, parseReactionEvent, targetEnemy, type EnemyStatus, type GameData, type ReactionRecord } from "@efsim/engine";
import { NO_LANDING } from "./replaykeys.ts";
import type { BuffReplay } from "./buffreplay.ts";
import { batchOrder, loggedCastFates } from "./castassembly.ts";
import type { HitRecord } from "./hitexport.ts";
import { FACTOR_STRETCH, factorStretches } from "./buildoffsets.ts";
import { clockAt, clockReaches, holdPins, loggedBreaks, statusLanes, type ClockWhy, type HoldBound, type PlacedHolds } from "./holds.ts";
import type { AppliedStop, KitWindow, TracedStatus, TriggerTrace } from "./replayrecord.ts";
import { CAST_SLACK_MS, distinctCasts, placeHits, settleCheck, ultimateOverlaps, type LoggedCast, type PlacedJoin, type PlacedTwin } from "./logcasts.ts";
import { choiceWords, inTurnWords, joinWords, lateJoin, pastChannelWords, pathsWords, twinWords } from "./placementwords.ts";
import { buffLanes, castEventPlace, eventPlaceText, loggedStaggerSpans, replayTimeStops, tickReadNote, type BuffLane } from "./query.ts";
import { checkLog, corrosionRamp, engineHits, engineReport, logBuffReplay } from "./logcheck.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { stageNote, teamBuffNames, type KillKind, type TotalsComparison, type TotalsCrit, type TotalsShares } from "./enginecheck.ts";
import { kindsAggregate, type KindShare } from "./onesided.ts";
import { batchDecision, batchDisagreements, deathDecisions, decisionText, landingsOf, replayDecisions } from "./decisionsview.ts";
import { secondsText as s, shortSkill } from "./labels.ts";
import { triggerStartLines } from "./triggerstarts.ts";
import { spLines, topUpLines } from "./spview.ts";

/** A time window and operator filter of a view (ms; operator ids). */
export interface ViewFilter {
  readonly from?: number;
  readonly to?: number;
  readonly operators?: readonly string[];
}

/** A view's readings of open assumptions (`--assume`), as logBuffReplay takes them: none when empty, so the default replay is the very same call. */
export const underReadings = (assume?: Readonly<Record<string, string>>): { readonly assume?: Readonly<Record<string, string>> } => (assume && Object.keys(assume).length ? { assume } : {});

const msOf = (frames: number) => (frames * 1000) / FPS;
const inWindow = (f: ViewFilter, t: number) => t >= (f.from ?? -Infinity) && t <= (f.to ?? Infinity);
const mine = (f: ViewFilter, op: string) => !f.operators?.length || f.operators.includes(op);

/** An operator's short label: its name, else its id without the chr_NNNN_ prefix. */
function label(data: GameData, op: string): string {
  return data.operators[op]?.name ?? op.replace(/^chr_\d+_/, "");
}

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

/**
 * A logged hit's Stagger bar at a ms several casts' Stagger events share (castassembly.ts batchOrder: the log's only
 * order inside the batch), as " bar 274 → 264" (before it: bar + dealt), else "" (round 16, the batched-landings report
 * point 2: the order evidence took three scratch scripts).
 */
function barMark(fx: LogFixture): (h: LogHit) => string {
  const order = batchOrder(fx.hits);
  return (h) => (h.poise && order.has(h) ? ` [bar ${h.poise.bar + h.poise.dealt} → ${h.poise.bar}]` : "");
}


/**
 * One line of `zmdlogs casts` as a record (round 18, round 17's own report point 2: scripts/cli-ab.ts --placement
 * paired and counted casts by regexes over the text and broke on a skill id without an underscore): its kind and time
 * (ms), the operator (id) and the fields a comparison pairs by, with the line's text. `zmdlogs casts --json` prints
 * them; castsView renders the text.
 */
export interface CastsRecord {
  readonly kind: "EVENT" | "CAST" | "REALIGN" | "STOP" | "HIT" | "OTHER";
  readonly t: number;
  readonly operator: string;
  /** The operator's display name (as the text has it). */
  readonly name: string;
  /** EVENT, STOP: the skill; CAST, REALIGN: the cast's group (the skill placed); HIT: its event. */
  readonly skill: string;
  /** CAST: the kind of skill and the key it was placed from; REALIGN: the key. */
  readonly castKind?: string | null;
  readonly key?: string;
  /** CAST: the rule that chose its skill among those sharing its key (LoggedCast.chosen; `-` none). */
  readonly rule?: string;
  /** HIT: the value, and the cast and slot it was placed at (absent: unplaced or a status event). */
  readonly value?: number;
  readonly cast?: { readonly skill: string; readonly start: number; readonly index: number; readonly frame?: number; readonly sameAs?: boolean; readonly twin?: PlacedTwin };
  /** HIT: why it joined a cast placed before it (PlacedHit.joined), where it did. */
  readonly joined?: PlacedJoin;
  readonly text: string;
}

/** `zmdlogs casts`' lines as records, in time order (castsView's text, CastsRecord), and the view's header line. */
export function castsRecords(data: GameData, fx: LogFixture, f: ViewFilter & { readonly rules?: boolean } = {}): { readonly header: string; readonly records: CastsRecord[] } {
  const placement = placeHits(data, fx);
  const lines: (CastsRecord & { readonly order: number })[] = [];
  const batched = batchMark(fx);
  const bar = barMark(fx);
  for (const c of fx.casts ?? []) if (inWindow(f, c.t) && mine(f, c.operator)) lines.push({ kind: "EVENT", t: c.t, order: 0, operator: c.operator, name: label(data, c.operator), skill: c.skill, text: `EVENT  ${label(data, c.operator)} ${shortSkill(c.skill)} (the log's cast event)` });
  for (const c of distinctCasts(placement)) {
    if (!inWindow(f, c.start) || !mine(f, c.operator)) continue;
    // The first landing's other paths (LoggedCast.paths) and a past-channel opening (LoggedCast.pastChannel): placementwords.ts.
    const paths = f.rules && c.paths?.length ? `  [${pathsWords(c)}]` : "";
    const channel = f.rules && c.pastChannel ? `  [${pastChannelWords(c)}]` : "";
    lines.push({ kind: "CAST", t: c.start, order: 1, operator: c.operator, name: label(data, c.operator), skill: c.group, castKind: c.kind, key: c.key, rule: c.chosen?.rule ?? "-", text: `CAST   ${label(data, c.operator)} ${shortSkill(c.group)}${c.kind ? ` (${c.kind})` : ""} key ${shortSkill(c.key)}${f.rules && c.chosen ? `  [${choiceWords(c.chosen)}]` : ""}${paths}${channel}` });
  }
  // What the realignment by value decided for a cast's key (Placement.realign, round 18): moved, or left and why.
  if (f.rules)
    for (const r of placement.realign ?? []) {
      if (!inWindow(f, r.cast.start) || !mine(f, r.cast.operator)) continue;
      lines.push({ kind: "REALIGN", t: r.cast.start, order: 1, operator: r.cast.operator, name: label(data, r.cast.operator), skill: r.cast.group, key: r.key, text: `REALIGN ${label(data, r.cast.operator)} ${shortSkill(r.cast.group)} key ${shortSkill(r.key)} (${r.landings} landings): ${r.realigned ? "realigned by value" : "left by time"}: ${r.why}` });
    }
  // The stops the replay holds (query.ts replayTimeStops, the views' one list): a cast placed from its cast event alone
  // (an ultimate at its logged stop's end: db87's Laevatain at 16.60 s) is marked.
  for (const st of replayTimeStops(data, fx, placement)) {
    const [a, z] = [msOf(st.start), msOf(st.start + st.scales.length)];
    if (z < (f.from ?? -Infinity) || a > (f.to ?? Infinity)) continue;
    const zero = st.scales.filter((x) => x === 0).length;
    lines.push({ kind: "STOP", t: a, order: 2, operator: st.operator, name: label(data, st.operator), skill: st.skillId, text: `STOP   ${label(data, st.operator)} ${shortSkill(st.skillId)} ${s(a)}–${s(z)} s (${zero} of ${st.scales.length} frames at 0, lowest scale ${Math.min(...st.scales).toFixed(2)})${st.placed ? "" : " [no placed hits: the replay's cast from its event or inferred]"}${tickReadNote(st)}` });
  }
  for (const h of fx.hits) {
    if (!inWindow(f, h.t)) continue;
    if (!mine(f, h.operator)) {
      lines.push({ kind: "OTHER", t: h.t, order: 4, operator: h.operator, name: label(data, h.operator), skill: h.event, text: `  .    ${label(data, h.operator)} ${shortSkill(h.event)}` });
      continue;
    }
    const p = placement.hits.get(h);
    const where = p ? `${shortSkill(p.cast.group)}@${s(p.cast.start)} #${p.index}${p.frame !== undefined ? ` frame ${p.frame}` : ""}${p.sameAs ? " (same landing as another enemy's)" : ""}` : parseReactionEvent(h.event) ? "a status event" : "unplaced";
    // Whose skill the log credits the hit's Stagger to (LogHit.poise.origin), where that isn't the hit's own key or cast:
    // a projectile's or an entity's skill (Si's bursts by the stroke or Inksoul behind them).
    const origin = h.poise?.origin;
    const credited = origin !== undefined && origin !== h.event && !h.event.startsWith(origin) && origin !== p?.cast.skillId ? ` (origin ${shortSkill(origin)})` : "";
    const joined = f.rules && p?.joined && lateJoin(p.joined) ? `  [${joinWords(p.joined)}]` : "";
    const twin = f.rules && p?.twin ? `  [${twinWords(p.twin)}]` : "";
    const cast = p ? { skill: p.cast.group, start: p.cast.start, index: p.index, ...(p.frame !== undefined ? { frame: p.frame } : {}), ...(p.sameAs ? { sameAs: true } : {}), ...(p.twin ? { twin: p.twin } : {}) } : undefined;
    lines.push({ kind: "HIT", t: h.t, order: 3, operator: h.operator, name: label(data, h.operator), skill: h.event, value: h.value, ...(cast ? { cast } : {}), ...(p?.joined ? { joined: p.joined } : {}), text: `HIT    ${label(data, h.operator)} ${shortSkill(h.event)} ${h.value} → ${where}${credited}${batched(h.t)}${bar(h)}${joined}${twin}` });
  }
  const header = `${fx.id}: placement (logcasts.ts placeHits); times in s, EVENT the log's cast events, CAST the casts as placed (start = first landing less its frame)${f.rules ? `; [the rule that chose the skill among those sharing its key: logcasts.ts choose, LoggedCast.chosen]; a HIT's [joined: …] where it joined its cast more than ${CAST_SLACK_MS / 1000} s after its slot's frame (PlacedHit.joined: the rule and the times); REALIGN what the realignment by value did with a cast's key` : ""}`;
  const records = lines.sort((a, b) => a.t - b.t || a.order - b.order).map(({ order: _o, ...r }) => r);
  return { header, records };
}

/** `zmdlogs casts`: the placement of a fight in time order (hits, cast events, placed casts, time stops). */
export function castsView(data: GameData, fx: LogFixture, f: ViewFilter & { readonly rules?: boolean } = {}): string {
  const { header, records } = castsRecords(data, fx, f);
  return [header, records.map((l) => `${s(l.t).padStart(7)}  ${l.text}`).join("\n")].join("\n");
}

/** `zmdlogs casts --json`: one JSON line per record (CastsRecord), each with its fixture's id. */
export function castsJson(data: GameData, fx: LogFixture, f: ViewFilter & { readonly rules?: boolean } = {}): string {
  return castsRecords(data, fx, f).records.map((r) => JSON.stringify({ log: fx.id, ...r })).join("\n");
}

// The placement's records in words (lateJoin, twinWords, joinWords, choiceWords, inTurnWords, pathsWords,
// pastChannelWords): placementwords.ts, a placement round's own file (round 21).

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

/** How an applied slow-down and the log tools' stop list compare (stopLines): the same, another length, one side only, or a timeline-only one a listed one covers. */
export type StopKind = "as listed" | "length" | "timeline only" | "covered" | "list only";

/**
 * The STOP lines of `zmdlogs replay --stops` and `zmdlogs stops`: each slow-down the replay's timeline applied against
 * the log tools' stop list of its casts (stopsAgainstList), and each listed one never applied, with its kind.
 */
export function stopLines(data: GameData, fx: LogFixture, replay: BuffReplay, f: ViewFilter = {}): { t: number; kind: StopKind; text: string }[] {
  const out: { t: number; kind: StopKind; text: string }[] = [];
  // Without the replay's ticks (replayTimeStops with the replay: a hitless event it read as a buff's tick, not made).
  const { pairs, unapplied } = stopsAgainstList(replay.appliedStops, replayTimeStops(data, fx, undefined, replay));
  for (const { applied: x, listed: l } of pairs) {
    const t = msOf(x.start);
    if (!inWindow(f, t) || (x.operator !== null && !mine(f, x.operator))) continue;
    // One the list lacks beside a listed one of its start and caster running at least as low at every frame (a jump's
    // own slow-down at the jump's frame next to the frame-0 one: Purrchena's shielded combo, Rossi's combo_3 judged
    // late) holds nothing more.
    const covering = !l ? pairs.find((p) => p.listed && p.applied.start === x.start && p.applied.operator === x.operator && x.scales.every((v, i) => (p.listed?.scales[i] ?? 1) <= v)) : undefined;
    const kind: StopKind = !l ? (covering ? "covered" : "timeline only") : l.scales.length !== x.scales.length ? "length" : "as listed";
    const vs = !l ? (covering ? `not in the log tools' list, covered by its ${covering.listed?.scales.length}-frame one (the same holds)` : "not in the log tools' list") : l.scales.length !== x.scales.length ? `the log tools' list has ${l.scales.length} frames (${shortSkill(l.skillId)})` : `as listed (${shortSkill(l.skillId)})`;
    out.push({ t, kind, text: `STOP   the timeline's ${x.ultimate ? "ultimate stop" : "slow-down"} of ${x.operator ? label(data, x.operator) : "-"} ${s(t)}–${s(msOf(x.start + x.scales.length))} s (${x.scales.length} frames, lowest ×${Number(Math.min(...x.scales).toPrecision(2))}): ${vs}` });
  }
  for (const l of unapplied) {
    const t = msOf(l.start);
    if (!inWindow(f, t) || !mine(f, l.operator)) continue;
    out.push({ t, kind: "list only", text: `STOP   listed for ${label(data, l.operator)} ${shortSkill(l.skillId)} at ${s(t)} s (${l.scales.length} frames): the timeline never applied it` });
  }
  return out;
}

/**
 * `efsim zmdlogs placement <fixture…|--all>`: what the placement's passes leave (logcasts.ts placeHits' comment;
 * remaining-leads report point 2): the ultimates of different operators whose stops still overlap after the in-turn rule
 * (ultimateOverlaps: `anchored` both from their cast events, `chain` one overlapping a third), and the casts a third pass
 * of pass 2 would move (settleCheck: the placement isn't a fixed point there, so a rule reading other casts' stops
 * cascades through them); then the counts.
 */
export function placementView(data: GameData, logs: readonly { readonly short: string; readonly fx: LogFixture }[], opts: { readonly progress?: (line: string) => void; readonly rules?: boolean } = {}): string {
  const out = [`The placement's passes (logcasts.ts placeHits): OVERLAP ultimates whose time stops still overlap after the in-turn rule; SETTLE casts a third pass would move (now → third; - none)${opts.rules ? "; under each OVERLAP what the in-turn rule decided for both (Placement.inTurn: moved, event, beforeStop, held, no-overlap, refused and the checks of the start it tried)" : ""}. Times in s.`];
  let [overlaps, unsettled] = [0, 0];
  for (const { short, fx } of logs) {
    opts.progress?.(`placement ${short}`);
    const p = placeHits(data, fx);
    const lines: string[] = [];
    const record = (c: LoggedCast) => p.inTurn?.find((r) => r.cast === c);
    let shown = 0;
    for (const o of ultimateOverlaps(data, p)) {
      shown++;
      lines.push(`  OVERLAP ${label(data, o.a.operator)} ${shortSkill(o.a.skillId)}@${s(o.a.start)} / ${label(data, o.b.operator)} ${shortSkill(o.b.skillId)}@${s(o.b.start)}: ${o.frames} frames${o.anchored ? " (both from the log's events)" : ""}${o.chain ? " (a chain of three)" : ""}`);
      if (opts.rules) for (const c of [o.a, o.b]) {
        const r = record(c);
        lines.push(`    ${label(data, c.operator)} ${shortSkill(c.skillId)}@${s(c.start)}: ${r ? inTurnWords(r) : "not looked at (no opening landing of its key)"}`);
      }
    }
    const settle = settleCheck(data, fx, p);
    for (const x of settle) lines.push(`  SETTLE  ${label(data, x.operator)} ${shortSkill(x.skillId)}: ${x.now === null ? "-" : s(x.now)} → ${x.third === null ? "-" : s(x.third)}`);
    overlaps += shown;
    unsettled += settle.length;
    if (lines.length) out.push(`${short}:`, ...lines);
  }
  out.push("", `Over ${logs.length} logs: ${overlaps} overlapping ultimate pair(s), ${unsettled} cast(s) a third pass would move`);
  return out.join("\n");
}

/**
 * `efsim zmdlogs stops <fixture…|--all>`: the STOP lines of several logs (`replay --stops`'s), with `differ` only those
 * that aren't "as listed" or "covered", then a count per kind over the logs (stop-lists report point 1: a loop of
 * `replay --stops` over 80 fixtures took 6 minutes a run, mostly the CLI's start-up).
 */
export function stopsView(data: GameData, logs: readonly { readonly short: string; readonly fx: LogFixture }[], opts: { readonly differ?: boolean; readonly operators?: readonly string[]; readonly assume?: Readonly<Record<string, string>>; readonly progress?: (line: string) => void } = {}): string {
  const total = new Map<StopKind, number>();
  const logsWith = new Map<StopKind, Set<string>>();
  const out = [`The slow-downs each replay's timeline applied (BuffReplay.appliedStops) against the log tools' stop list of its casts (replayTimeStops), as \`zmdlogs replay --stops\` gives them${opts.differ ? "; only those that differ (not as listed, not covered)" : ""}; times in s.`];
  for (const { short, fx } of logs) {
    opts.progress?.(`stops ${short}`);
    const { replay } = logBuffReplay(data, fx, undefined, underReadings(opts.assume));
    const lines = stopLines(data, fx, replay, { operators: opts.operators ?? [] }).sort((a, b) => a.t - b.t);
    for (const l of lines) {
      total.set(l.kind, (total.get(l.kind) ?? 0) + 1);
      logsWith.set(l.kind, (logsWith.get(l.kind) ?? new Set()).add(short));
    }
    const shown = opts.differ ? lines.filter((l) => l.kind !== "as listed" && l.kind !== "covered") : lines;
    if (shown.length) out.push(`${short}:`, ...shown.map((l) => `  ${l.text}`));
  }
  const kinds: StopKind[] = ["as listed", "covered", "length", "timeline only", "list only"];
  out.push("", `Over ${logs.length} logs: ${kinds.map((k) => `${k} ${total.get(k) ?? 0}${k !== "as listed" && logsWith.get(k)?.size ? ` (${logsWith.get(k)?.size} logs)` : ""}`).join(", ")}`);
  return out.join("\n");
}


/** Every log key the team's kits list: their skills' and triggers' hits' events (kitHitEntries). */
export function kitKeys(data: GameData, fx: Pick<LogFixture, "team">): Set<string> {
  return new Set(fx.team.flatMap((b) => kitHitEntries(effectiveKit(data, b)).flatMap((e) => e.hit.events)));
}

/**
 * `zmdlogs replay`: the replay of a fight in time order: its landings (with the logged hit each stands for, or
 * "replay only"), logged hits without a landing and why, failed and missed casts, Stagger windows, and the windows of
 * the kit buffs named (`owner:id`, at the owner unless `@operator` follows); under other readings of open assumptions
 * with `assume` (as `zmdlogs check --assume`).
 */
export function replayView(data: GameData, fx: LogFixture, f: ViewFilter & { readonly buffs?: readonly string[]; readonly trace?: readonly string[]; readonly assume?: Readonly<Record<string, string>>; readonly stops?: boolean; readonly sp?: boolean; readonly againstLanes?: boolean; readonly againstStarts?: RegExp } = {}): string {
  const { replay, placement } = logBuffReplay(data, fx, undefined, { ...(f.assume && Object.keys(f.assume).length ? { assume: f.assume } : {}), ...(f.trace?.length ? { trace: f.trace } : {}) });
  const { byLanding, missing } = landingsOf(replay, fx);
  const lines: Line[] = [];
  const batched = batchMark(fx);
  const bar = barMark(fx);
  for (const l of replay.hits) {
    const t = msOf(l.frame);
    if (!inWindow(f, t) || !mine(f, l.operator)) continue;
    const h = byLanding.get(l);
    // Where the log gives no crit: the crit the replay took and which inference gave it (BuffReplay.critSource).
    const crit = h && h.crit === null && l.loggedCrit !== undefined ? ` [crit ${l.loggedCrit ? "yes" : "no"}: ${replay.critSource(h)}]` : "";
    // A logged hit the placement made another target's landing of its slot (PlacedHit.twin): the rule, as `casts --choices`
    // gives it (round 20, the several-targets report point 1: the placement's choice wasn't in the replay's lines).
    const twin = h ? placement?.hits.get(h)?.twin : undefined;
    const what = h ? `= logged ${shortSkill(h.event)} ${h.value} at ${s(h.t)}${h.t !== Math.round(t) ? ` (${Math.round(h.t - t) > 0 ? "+" : ""}${Math.round(h.t - t)} ms)` : ""}${batched(h.t)}${bar(h)}${crit}${twin ? ` [${twinWords(twin)}]` : ""}` : "replay only";
    // The stage's factor there (LogFixture.stageFactors): the replay's own damage doesn't have it, the check's does.
    const staged = stageNote(fx, l.damage, h?.t ?? t);
    // A pinned landing (its cast's `landings`: LandedHit.ref) sits at the logged frame, which no stop or hold moves (round 19).
    lines.push({ t, order: 2, text: `LAND   ${label(data, l.operator)} ${shortSkill(l.skillId)} ${l.hitId} ${l.damage}${staged}${l.count > 1 ? ` ×${l.count}` : ""}${l.ref !== undefined ? " [pinned]" : ""} ${what}` });
  }
  // A batched ms the replay landed in another order than the log's bars (round 16, batched-landings report point 2).
  for (const b of batchDisagreements(fx, replay.hits, byLanding)) {
    if (!inWindow(f, b.t) || !b.replay.some((h) => mine(f, h.operator))) continue;
    lines.push({ t: b.t, order: 1, text: decisionText(batchDecision(data, b)) });
  }
  // With the step that dropped its pinned landing, or why it was never pinned (BuffReplay.droppedLanding); a key no kit
  // hit of the team lists says so (round 20, the twins report point 3: Camille's normal_skill_abilityrange, her
  // Vesperwings' move, read as a placement error until `gamedata who`): a kit gap, for packages/data.
  const keys = kitKeys(data, fx);
  for (const [h, why] of missing) {
    if (!inWindow(f, h.t) || !mine(f, h.operator)) continue;
    const drop = replay.droppedLanding(h);
    const gap = why === NO_LANDING.notPlaced && !parseReactionEvent(h.event) && !keys.has(h.event) ? `: a key no kit hit or trigger hit of the team lists (a kit gap, not a placement error: \`efsim gamedata who ${h.event}\` names what casts it)` : "";
    lines.push({ t: h.t, order: 3, text: `NOLAND ${label(data, h.operator)} ${shortSkill(h.event)} ${h.value}: ${why}${drop ? `: ${drop}` : ""}${gap}` });
  }
  // The replay's own decisions (decisionsview.ts replayDecisions, from BuffReplay's records): SKIP the logged casts it
  // didn't make and why, TAILCUT those it ended after their last logged landing, FAILED / MISSED, INFER the hitless
  // presses it made from the listing, MADE a cast made as another skill than the placement's, FORCED / INSIDE / CUTS.
  for (const d of [...replayDecisions(data, replay), ...deathDecisions(data, replay)]) if (inWindow(f, d.t) && mine(f, d.operator)) lines.push({ t: d.t, order: 1, text: decisionText(d) });
  // The log's cast events and what the cast assembly made of each (loggedCastFates), with where the event sits in its
  // skill's stop (castEventPlace; placement leads report point 1: "0.02 s of world time apart" hid 1.76 s of log time).
  const hitTimes = fx.hits.map((h) => h.t).sort((a, b) => a - b);
  // A "tick" fate is the event's key (loggedCastFates: a kit buff ticks as its skill); what the replay did with it is its
  // own decision (BuffReplay.skipped, backlog after round 11 point 6): a tick it read (skipped, with why), or the cast
  // it made where the buff isn't on (3aa6ab93bad4: Zhuang Fangyi's real ultimates, read as Empyrean ticks by their
  // key), with the buff's last end and the event in frames: an end on the event's own frame is a whole lead's worth
  // (remaining-leads report point 4: 4bfc 179.51 s took instrumenting loggedTick).
  const ofEvent = (e: { readonly t: number; readonly operator: string; readonly skill: string }) => {
    const length = msOf(data.skills[e.skill]?.timing?.durationFrames ?? 0);
    return (c: { readonly operator: string; readonly skillId: string; readonly start: number }) => c.operator === e.operator && c.skillId === e.skill && c.start <= e.t + 100 && c.start >= e.t - length - 100;
  };
  // What the replay itself did with the event's cast (BuffReplay.made, skipped, failed: away-and-presses report point 2,
  // 8915 111.23 s read as a tick while the replay had made the press from the listing): its own record, not a match.
  // A placed cast made as itself says nothing new: only its other fates are added.
  // The cast nearest the event within ofEvent's span, not the first (round 23, the team-SP report point 2: 04d4's
  // Purrchena events each named the cast made for the event before, read as a 3–6 s shift that wasn't there).
  const nearest = <T>(xs: readonly T[], start: (x: T) => number, t: number): T | undefined => xs.reduce<T | undefined>((best, x) => (best === undefined || Math.abs(start(x) - t) < Math.abs(start(best) - t) ? x : best), undefined);
  const replayFate = (e: { readonly t: number; readonly operator: string; readonly skill: string; readonly fate: string }) => {
    const mine = ofEvent(e);
    const made = nearest(replay.made.filter((m) => !m.cast.missed && mine(m.cast)), (m) => m.cast.start, e.t);
    if (made?.inferred !== undefined) return `the replay made it at ${s(msOf(made.frame))} as ${shortSkill(made.skillId)}, a hitless press from the listing (INFER)`;
    if (made && made.skillId !== made.cast.skillId) return `the replay made it at ${s(msOf(made.frame))} as ${shortSkill(made.skillId)} (MADE)`;
    if (made) return e.fate === "placed" ? null : `the replay made it at ${s(msOf(made.frame))}`;
    const skip = nearest(replay.skipped.filter((x) => mine(x.cast)), (x) => x.cast.start, e.t);
    if (skip) return `the replay skipped it (SKIP)`;
    if (replay.failed.some((x) => mine(x.cast))) return "the replay couldn't make it (FAILED)";
    return null;
  };
  const tickOrCast = (e: { readonly t: number; readonly operator: string; readonly skill: string; readonly buff?: string }) => {
    const mine = ofEvent(e);
    const ef = Math.round((e.t * FPS) / 1000);
    const inferred = nearest(replay.made.filter((m) => m.inferred !== undefined && mine(m.cast)), (m) => m.cast.start, e.t);
    if (inferred) return `its key is a tick of ${e.buff} (KitBuff.ticksLoggedAs), but the replay made the press from the listing (hitless-presses inferred: ${inferred.inferred})`;
    // The buff's last instance that ended by the event (one the cast itself creates starts after it).
    const last = replay.kitWindows(`${e.operator}:${e.buff}`, e.operator).filter((w) => Number.isFinite(w.end) && w.end <= e.t + 100).at(-1);
    const lastText = last ? `its last instance ${s(last.start)}–${s(last.end)} ended at frame ${Math.round((last.end * FPS) / 1000)}, the event's frame ${ef}` : "no instance ended before it";
    const skip = nearest(replay.skipped.filter((x) => mine(x.cast)), (x) => x.cast.start, e.t);
    if (skip) return `a tick of ${e.buff} (KitBuff.ticksLoggedAs): ${skip.why.replace(/^a tick of a kit buff \(KitBuff\.ticksLoggedAs\)(: | )?/, "") || "read as its tick"}${/this very frame/.test(skip.why) ? ` (${lastText})` : ""}`;
    if (replay.failed.some((x) => mine(x.cast))) return `its key is a tick of ${e.buff} (KitBuff.ticksLoggedAs); the replay couldn't make the cast (FAILED)`;
    return `its key is a tick of ${e.buff} (KitBuff.ticksLoggedAs), but the replay made the cast: the buff wasn't on (${lastText})`;
  };
  // Only the first of an ultimate's repeated events (each ~3.5 s while it lasts) has a stop around it.
  const lastEvent = new Map<string, number>();
  for (const e of loggedCastFates(data, fx)) {
    const key = `${e.operator}|${e.skill}`;
    const prev = lastEvent.get(key);
    lastEvent.set(key, e.t);
    const repeat = prev !== undefined && e.t - prev < msOf(data.skills[e.skill]?.timing?.durationFrames ?? 0);
    if (!inWindow(f, e.t) || !mine(f, e.operator)) continue;
    const place = repeat ? null : castEventPlace(data, hitTimes, e);
    const what =
      e.fate === "placed" && e.cast
        ? `the placed cast's${e.variant ? ` (${shortSkill(e.variant)}, the variant its kit casts in its place)` : ""} at ${s(e.cast.start)} s (${s(e.cast.world)} s of world time apart, ${s(Math.abs(e.t - e.cast.start))} s of log time)`
        : e.fate === "tick"
          ? tickOrCast(e)
          : e.fate === "press"
            ? "a press of its own (the skill's hits show elsewhere: a slot press)"
            : e.fate === "cast"
              ? "a cast of its own (no hit of the skill in the log)"
              : e.fate === "follow-up"
                ? "a follow-up-only skill: left to the engine"
                : e.fate === "move"
                  ? `the log's record of ${e.move ?? "a kit trigger"}'s landing at a target's death (targets.ts moveEvent: the entity's cast logged under the skill): no press; the replay lands the move itself (a death step, DEATH)`
                  : "no kit skill of that id: ignored";
    const fate = e.fate === "tick" || e.fate === "move" ? null : replayFate(e);
    lines.push({ t: e.t, order: 1, text: `EVENT  ${label(data, e.operator)} ${shortSkill(e.skill)} (the log's cast event): ${what}${fate ? `; ${fate}` : ""}${place ? `; ${eventPlaceText(place)}` : ""}` });
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
  // A kit stack's value, each change with the step that made it (`--trace-stack`: BuffReplay.stackTraces, round 16).
  for (const x of replay.stackTraces) {
    const t = msOf(x.frame);
    if (!inWindow(f, t)) continue;
    lines.push({ t, order: 0, text: `TRACE  stack ${label(data, x.operator)}:${x.stack} ${x.from ?? "unset"} → ${x.to ?? "unset"} at ${x.step}` });
  }
  // A kit trigger's firings and its ready frame's shifts (`--trace-trigger`: BuffReplay.triggerTraces); consecutive
  // shifts by steps of one kind (a placed hold comes a frame at a time) on one line.
  const shifts: { first: TriggerTrace; last: TriggerTrace; n: number }[] = [];
  for (const x of replay.triggerTraces) {
    const fired = !x.from || x.to.count > x.from.count;
    const prev = shifts.findLast((y) => y.last.key === x.key);
    if (!fired && prev && prev.last.from && prev.last.to.count === prev.last.from.count && prev.last.step === x.step) {
      prev.last = x;
      prev.n++;
    } else shifts.push({ first: x, last: x, n: 1 });
  }
  for (const { first, last, n } of shifts) {
    const t = msOf(first.frame);
    if (!inWindow(f, t)) continue;
    const [owner, ...rest] = first.key.split(":");
    const name = `${label(data, owner ?? "")}:${rest.join(":")}`;
    const ready = (v: number) => (v === Infinity ? "never" : `${s(msOf(v))} s`);
    const clock = last.to.world ? "the world's clock" : "raw time";
    const from = first.from;
    const text = !from || last.to.count > from.count
      ? `fired (firing ${last.to.count}), ready again at ${ready(last.to.readyAt)} (on ${clock})`
      : `ready ${ready(from.readyAt)} → ${ready(last.to.readyAt)} (${last.to.readyAt - from.readyAt > 0 ? "+" : ""}${last.to.readyAt - from.readyAt} frames: held on ${clock})`;
    lines.push({ t, order: 0, text: `TRACE  trigger ${name}: ${text} at ${first.step}${n > 1 ? ` (${n} steps, to ${s(msOf(last.frame))} s)` : ""}` });
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
  if (f.stops) for (const l of stopLines(data, fx, replay, f)) lines.push({ t: l.t, order: 0, text: l.text });
  // The SP a logged cast lacked (TOPUP, always) and, with --sp, each grant's source and each cast's spend (spview.ts).
  for (const l of topUpLines(data, replay, f)) lines.push({ t: l.t, order: 1, text: l.text });
  if (f.sp) for (const l of spLines(data, replay, f)) lines.push({ t: l.t, order: 2, text: l.text });
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
  // Each logged run of a kit buff beside the replay's nearest window start (round 16, slots-and-paths report point 2).
  const pairs = [
    ...(f.againstLanes ? (f.buffs ?? []).flatMap((spec) => lanePairLines(data, fx, replay, spec, f)) : []),
    // Round 22 (the Estella-Akekuri report point 3): a traced trigger's firings against the log's starts of a game buff.
    ...(f.againstStarts ? triggerStartLines(data, fx, replay, (f.trace ?? []).filter((x) => x.startsWith("trigger:")).map((x) => x.slice("trigger:".length)), f.againstStarts, f) : []),
  ];
  const forced = replay.castFlags.filter((x) => x.kind === "forced").length;
  const inside = replay.castFlags.filter((x) => x.kind === "inside").length;
  const cuts = replay.castFlags.filter((x) => x.kind === "cuts").length;
  const flagged = forced + inside ? `${forced} cast(s) FORCED against the kit's availability and ${inside} INSIDE another action's uncuttable frames: the replay's state may be wrong from each on. ` : "";
  const cutting = cuts ? `${cuts} cast(s) CUTS the running cast's pending hits (a legal interrupt). ` : "";
  const head = `${fx.id}: the replay (buffreplay.ts); times in s. ${replay.brokenAt !== null ? `It stopped at ${s(msOf(replay.brokenAt))} s. ` : ""}${flagged}${cutting}LAND its landings ([pinned]: at the logged frame its cast pinned it to, which no stop or hold moves; the others where the kit's frames and the stops put them; [twin: …]: its logged hit the placement took for another target's landing of its slot, and the rule), NOLAND logged hits without one (and the step that dropped the pinned landing), EVENT the log's cast events and what the replay made of each, SKIP the logged casts it didn't make and why, FAILED / MISSED casts it couldn't make / made without the log, INFER hitless presses and casts it made from the listing, MADE casts made as another skill than placed, PATH chance jumps the listing decided, JUMPDROP / BOTHPATHS a kit jump its landings contradicted / kept with landings in its skipped part, BATCH a batched ms landed in another order than the log's Stagger bars, TAILCUT casts it ended early (TAILKEPT: a cast with an unlogged tail a guard of the cut kept whole, and which guard), LINK the team's Link stacks gained in a cast's step and those a cast took (MADE also: two casts of one operator at one frame), DEATH each target's death the replay made (its record: a logged kill, a kit's move logged after one; the target that dies where the statuses are per target)${f.trace?.length ? ", TRACE each change of a traced kit buff's expiry (or an enemy status's, a kit trigger's firings and ready frame, a kit stack's value) and the step that made it, LANE the log's runs of a traced status" : ""}${f.stops ? ", STOP the slow-downs the timeline applied against the log tools' stop list" : ""}${replay.spTopUps.length ? ", TOPUP a logged cast the replay's own SP couldn't pay (raised to its cost)" : ""}${f.sp ? ", SP each grant's operator and source (TimelineState.spGained) and each cast's spend, the team's SP after" : ""}`;
  return [head, render(lines), ...pairs].join("\n");
}

/** How far apart (ms) a logged run's start and a replay window's may be and still pair (lanePairs). */
export const LANE_PAIR_MS = 3000;

/** A logged run of a kit buff paired with the replay's window (lanePairs): either side may be missing. */
export interface LanePair {
  /** The run's start as the log has it (since, else its first listed hit), ms; null: a replay window no run pairs. */
  readonly logged: number | null;
  /** The window's start, ms; null: a logged run no window pairs. */
  readonly replay: number | null;
}

/**
 * The log's runs of a kit buff against the replay's windows of it, by start: each run's since (the log keeps a
 * refreshed run's since) with the nearest window that starts a chain (KitWindow.replaces unset) within LANE_PAIR_MS,
 * each once, in time order; the rest on their own. A kit trigger fix's first check (round 16, slots-and-paths report
 * point 2: Fervent Morale's starts lined up by hand from `raw --buffs` and `replay --kit-buff` over five logs).
 */
export function lanePairs(runs: readonly number[], windows: readonly number[]): LanePair[] {
  // The closest pairs first (a run between two windows takes the nearer, not the first in time).
  const candidates = runs.flatMap((r, i) => windows.flatMap((w, j) => (Math.abs(w - r) <= LANE_PAIR_MS ? [{ i, j, d: Math.abs(w - r) }] : []))).sort((a, b) => a.d - b.d || a.i - b.i);
  const [runOf, windowOf] = [new Map<number, number>(), new Set<number>()];
  for (const c of candidates) {
    if (runOf.has(c.i) || windowOf.has(c.j)) continue;
    runOf.set(c.i, c.j);
    windowOf.add(c.j);
  }
  const out: LanePair[] = runs.map((r, i) => ({ logged: r, replay: runOf.has(i) ? (windows[runOf.get(i) as number] as number) : null }));
  for (const [j, w] of windows.entries()) if (!windowOf.has(j)) out.push({ logged: null, replay: w });
  return out.sort((a, b) => (a.logged ?? a.replay ?? 0) - (b.logged ?? b.replay ?? 0));
}

/** `replay --kit-buff <spec> --against-lanes`: a kit buff's logged runs at an operator against the replay's windows. */
function lanePairLines(data: GameData, fx: LogFixture, replay: BuffReplay, spec: string, f: ViewFilter): string[] {
  const [buff, at] = spec.split("@") as [string, string | undefined];
  const owner = buff.split(":")[0] ?? "";
  const operator = at ?? owner;
  const logged = new Set(teamBuffNames(data, fx).ofKitBuff.get(buff) ?? []);
  // The runs of its logged names from its owner, on the operator's hits (a debuff: on anyone's).
  const runs = buffLanes(fx).filter((l) => logged.has(l.buff) && (l.source === null || l.source === owner) && (l.hitters.includes(operator) || at === undefined));
  const starts = [...new Set(runs.map((l) => l.since ?? l.firstListed))].filter((t) => inWindow(f, t));
  const all = replay.kitWindows(buff, operator);
  // A chain's start, or a refresh where the log starts a run of its own (a new since there: round 19).
  const startsRun = (w: KitWindow) => w.replaces === undefined || starts.some((t) => Math.abs(t - w.start) <= LANE_END_MS);
  const windows = all.filter((w) => startsRun(w) && inWindow(f, w.start)).map((w) => w.start);
  const pairs = lanePairs(starts, windows);
  const both = pairs.filter((p) => p.logged !== null && p.replay !== null).map((p) => (p.logged as number) - (p.replay as number)).sort((a, b) => a - b);
  const mid = both.length ? both[Math.floor((both.length - 1) / 2)] : undefined;
  const ends = pairs.map((p) => laneEnds(p, runs, all));
  const differ = ends.filter((e) => e?.differ).length;
  const endText = (e: LaneEnds | null) => {
    if (!e) return "";
    const log = e.log ? `log last listed ${s(e.log.last)}${e.log.unlisted !== null ? `, unlisted from ${s(e.log.unlisted)}` : ", listed to the fight's end"}` : "";
    const rep = e.replay ? `replay to ${e.replay.end === Infinity ? "the end" : s(e.replay.end)} (${e.replay.why})` : "";
    return `; ends: ${[log, rep].filter(Boolean).join("; ")}${e.differ ? `  ← ENDS DIFFER: ${e.differ}` : ""}`;
  };
  return [
    "",
    `${buff} at ${label(data, operator)}: the log's runs (since; its logged names ${[...logged].join(", ") || "none"}) against the replay's windows that start a chain (a refresh keeps the log's since; one where the log starts a run of its own starts one too), nearest start within ${LANE_PAIR_MS / 1000} s; ${both.length} paired${mid !== undefined ? `, median log − replay ${mid >= 0 ? "+" : ""}${s(mid)} s` : ""}, ${pairs.filter((p) => p.replay === null).length} log only, ${pairs.filter((p) => p.logged === null).length} replay only; each side's end (the log's last listing and its next hit without it, the replay chain's end and why), ${differ} pair(s) whose ends differ by more than ${LANE_END_MS} ms`,
    ...pairs.map((p, i) => (p.logged !== null && p.replay !== null ? `  ${s(p.logged).padStart(7)}  log since ${s(p.logged)}, replay from ${s(p.replay)} (${p.logged - p.replay >= 0 ? "+" : ""}${s(p.logged - p.replay)} s)` : p.logged !== null ? `  ${s(p.logged).padStart(7)}  log since ${s(p.logged)}, no replay window near` : `  ${s(p.replay as number).padStart(7)}  replay from ${s(p.replay as number)}, no logged run near`) + endText(ends[i] ?? null)),
  ];
}

/** How far (ms) the replay's end may fall outside the log's last listing and its next hit without the buff and still agree (laneEnds). */
export const LANE_END_MS = 300;

/** A lane pair's ends (laneEnds): the log's run (last listed hit, next hit without it) and the replay's chain (its last window's end, why). */
export interface LaneEnds {
  readonly log: { readonly last: number; readonly unlisted: number | null } | null;
  readonly replay: { readonly end: number; readonly why: string } | null;
  /** Why the two ends differ (the replay's end before the log's last listing, or past its next hit without it, by more than LANE_END_MS); absent: they agree or a side is missing. */
  readonly differ?: string;
}

/**
 * Each side's end of a lane pair (round 19, the Camille report point 4: `--against-lanes` paired starts only, and the
 * question was where each run ends): the log's run with that since (its last listed hit, the next hit of its holder
 * without it), the replay's chain from that window (each refresh followed: KitWindow.replaces) to its last window's end
 * and why it ended (ran out; ended early: a purge, a use, a target loss or a cut; the fight's end).
 */
export function laneEnds(p: LanePair, runs: readonly Pick<BuffLane, "since" | "firstListed" | "lastListed" | "nextUnlisted">[], windows: readonly KitWindow[]): LaneEnds | null {
  const mine = p.logged === null ? [] : runs.filter((l) => (l.since ?? l.firstListed) === p.logged);
  const last = mine.length ? mine.reduce((a, b) => (b.lastListed > a.lastListed ? b : a)) : null;
  // A refresh the log shows as a run of its own (a new since there) ends this pair's chain.
  const otherStarts = runs.map((l) => l.since ?? l.firstListed).filter((t) => t !== p.logged);
  let w = p.replay === null ? undefined : windows.find((x) => x.start === p.replay);
  let refreshed: number | undefined;
  for (let next = w && windows.find((x) => x.replaces === w?.start); w && next; next = windows.find((x) => x.replaces === w?.start)) {
    const at = next.start;
    if (otherStarts.some((t) => Math.abs(t - at) <= LANE_END_MS)) {
      refreshed = at;
      break;
    }
    w = next;
  }
  const log = last ? { last: last.lastListed, unlisted: last.nextUnlisted } : null;
  const rep = w ? { end: refreshed ?? w.end, why: refreshed !== undefined ? "refreshed where the log starts its next run" : w.end === Infinity ? "to the fight's end" : w.expired ? "ran out" : "ended early: a purge, a use, a target loss or a cut" } : null;
  if (!log && !rep) return null;
  let differ: string | undefined;
  if (log && rep) {
    if (rep.end < log.last - LANE_END_MS) differ = `the replay's end comes ${s(log.last - rep.end)} s before the log's last listing`;
    else if (log.unlisted !== null && rep.end > log.unlisted + LANE_END_MS) differ = `the replay keeps it ${rep.end === Infinity ? "to the end" : `${s(rep.end - log.unlisted)} s`} past the log's next hit without it`;
  }
  return { log, replay: rep, ...(differ ? { differ } : {}) };
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

/** A status event in a few words (`zmdlogs statuses`): its kind and what it is of (element, status, level, stacks). */
function statusEventWords(e: ReactionRecord): string {
  switch (e.kind) {
    case "burst":
      return `burst ${e.element}${e.inflictedAt !== undefined ? ` (inflicted at ${s(msOf(e.inflictedAt))})` : ""}`;
    case "reaction":
      return `reaction ${e.status} L${e.level} (${e.element}${e.consumed ? ` on ${e.consumed}` : ", forced"}${e.initialHit ? "" : ", no hit"})`;
    case "consumed":
      return `consumed ${e.element} ×${e.stacks}`;
    case "statusConsumed":
      return `consumed ${e.status} L${e.level}`;
    case "vulnerable":
      return `Vulnerable ${e.before} → ${e.stacks}`;
    case "physical":
      return `${e.status} L${e.level}${e.forced ? " (forced)" : ""}`;
    case "control":
      return `${e.status} ${e.frames} frames${e.freezes ? " (freezes)" : ""}`;
    case "shatter":
      return `shatter L${e.level}`;
    case "combustionTick":
      return `combustion tick L${e.level}`;
    case "inflicted":
      return `inflicted ${e.element} ×${e.stacks}`;
  }
}

/** An enemy's statuses in a few words: its infliction (element ×stacks), reactions and physical statuses with their levels, Vulnerable. */
function enemyWords(e: EnemyStatus | null, frame: number): string {
  if (!e) return "?";
  const x = expireStatus(e, frame);
  const parts = [
    ...(x.infliction ? [`${x.infliction.element}×${x.infliction.stacks}`] : []),
    ...x.statuses.map((y) => `${y.status} L${y.level}`),
    ...x.physical.map((y) => `${y.status} L${y.level}`),
    ...(x.vulnerable ? [`Vulnerable ${x.vulnerable.stacks}`] : []),
  ];
  return parts.length ? parts.join(", ") : "none";
}

/**
 * `zmdlogs statuses`: the replay's record of the enemy's statuses (BuffReplay.reactions: bursts, reactions,
 * consumptions, physical statuses, Combustion ticks), each with its target where the statuses are per target
 * (target-statuses `per-target`: ReactionRecord.target), its damage landing's value and the target's statuses after
 * it; the replay's deaths (BuffReplay.deaths) between. The target-statuses report point 1: a burst too many or a
 * reaction a kit hit's `if` needs, answered without a probe.
 */
export function statusesView(data: GameData, fx: LogFixture, f: ViewFilter & { readonly assume?: Readonly<Record<string, string>>; readonly targets?: readonly number[]; readonly inflictions?: boolean; readonly controls?: boolean } = {}): string {
  const { replay } = logBuffReplay(data, fx, underReadings(f.assume));
  const perTarget = replay.targets !== undefined;
  if (f.controls) return controlsLines(data, fx, replay, f).join("\n");
  const lines: { t: number; text: string }[] = [];
  const damage = new Map<string, number>();
  for (const l of replay.hits) if (l.skillId.startsWith("reaction:")) damage.set(`${l.frame}|${l.operator}|${l.target ?? ""}`, (damage.get(`${l.frame}|${l.operator}|${l.target ?? ""}`) ?? 0) + l.exact);
  const shown = (target: number | undefined) => !f.targets?.length || (target !== undefined && f.targets.includes(target));
  for (const e of replay.reactions) {
    const t = msOf(e.frame);
    if (!inWindow(f, t) || !mine(f, e.operator) || !shown(e.target)) continue;
    const d = damage.get(`${e.frame}|${e.operator}|${e.target ?? ""}`);
    const st = replay.stateAt(e.frame);
    const after = st ? (e.target !== undefined ? targetEnemy(st, e.target) : st.enemy) : null;
    lines.push({ t, text: `${s(t).padStart(7)}  ${e.target !== undefined ? `T${e.target}`.padEnd(4) : "    "}${label(data, e.operator).padEnd(12)} ${statusEventWords(e)}${d !== undefined ? `: ${Math.round(d)}` : ""}  → ${enemyWords(after, e.frame)}` });
  }
  // With inflictions (round 21, the target-statuses report point 1: a stack's arrival wasn't in any view): at each frame
  // a kit landing landed, each target whose infliction (element × stacks) differs from the frame before, the landings
  // there. From the replay's states (stateAt), no record of the engine's.
  if (f.inflictions) {
    const byFrame = new Map<number, typeof replay.hits>();
    for (const l of replay.hits) if (!l.skillId.startsWith("reaction:") && inWindow(f, msOf(l.frame))) byFrame.set(l.frame, [...(byFrame.get(l.frame) ?? []), l]);
    const inf = (e: EnemyStatus, frame: number) => {
      const x = expireStatus(e, frame).infliction;
      return x ? `${x.element}×${x.stacks}` : "none";
    };
    for (const [frame, ls] of [...byFrame].sort((a, b) => a[0] - b[0])) {
      const [was, now] = [replay.stateAt(Math.max(0, frame - 1)), replay.stateAt(frame)];
      if (!was || !now) continue;
      const ids = perTarget ? [...new Set([...everyTarget(was), ...everyTarget(now)].map((x) => x.target as number))] : [undefined];
      for (const id of ids) {
        if (!shown(id)) continue;
        const [a, b] = id === undefined ? [inf(was.enemy, frame - 1), inf(now.enemy, frame)] : [inf(targetEnemy(was, id), frame - 1), inf(targetEnemy(now, id), frame)];
        if (a === b) continue;
        const mine = ls.filter((l) => (id === undefined || l.target === id || (l.otherTargets ?? []).some((o) => o.target === id)) && (!f.operators?.length || f.operators.includes(l.operator)));
        if (!mine.length && f.operators?.length) continue;
        const t = msOf(frame);
        lines.push({ t, text: `${s(t).padStart(7)}  ${id !== undefined ? `T${id}`.padEnd(4) : "    "}infliction ${a} → ${b}  (landings: ${(mine.length ? mine : ls).map((l) => `${label(data, l.operator)} ${shortSkill(l.skillId)} ${l.hitId}`).join(", ")})` });
      }
    }
  }
  for (const d of replay.deaths) {
    const t = msOf(d.frame);
    if (!inWindow(f, t) || !shown(d.death.target)) continue;
    lines.push({ t, text: `${s(t).padStart(7)}  ${d.death.target !== undefined ? `T${d.death.target}`.padEnd(4) : "    "}DEATH (${d.why})${d.death.target !== undefined ? ": its statuses end" : ""}` });
  }
  lines.sort((a, b) => a.t - b.t);
  const head = `${fx.id}: the replay's status record (BuffReplay.reactions; times in s): each burst, reaction, consumption, physical status and Combustion tick with its operator, ${perTarget ? "its target (T<n>, the check's target numbering: target-statuses per-target), " : "(one enemy: not read per target, or target-statuses one) "}the damage the replay dealt with it, and → the ${perTarget ? "target's" : "enemy's"} statuses after it (infliction element×stacks, reactions and physical statuses with their levels, Vulnerable); DEATH the replay's deaths (BuffReplay.deaths)`;
  return [head, ...lines.map((l) => l.text), ...(lines.length ? [] : ["  (none in the window)"])].join("\n");
}

/**
 * `zmdlogs statuses <fixture> --controls` (round 22, the check-targets report point 2: "no fight read per target has a
 * freeze yet" was a backlog claim from the absence of a known case; a scratch script found three): each control status
 * the replay applied (BuffReplay.reactions `control`), whether it froze the enemy (TimelineState.enemyFrozenUntil past
 * it: none on a control-immune enemy) and to when, and every target's statuses at it (the ramp and the statuses a
 * freeze's run-on reads: clock.ts rampRunsOn, statusesRunOn); then a count.
 */
function controlsLines(data: GameData, fx: LogFixture, replay: BuffReplay, f: ViewFilter & { readonly targets?: readonly number[] }): string[] {
  const perTarget = replay.targets !== undefined;
  const out: string[] = [];
  let [freezes, held] = [0, 0];
  for (const e of replay.reactions) {
    if (e.kind !== "control") continue;
    const t = msOf(e.frame);
    if (!inWindow(f, t) || !mine(f, e.operator) || (f.targets?.length && (e.target === undefined || !f.targets.includes(e.target)))) continue;
    const st = replay.stateAt(e.frame);
    const until = st?.enemyFrozenUntil ?? 0;
    const froze = e.freezes && until > e.frame;
    if (e.freezes) freezes++;
    if (froze) held++;
    const frozen = !e.freezes ? "no freeze (not a freezing status)" : froze ? `froze the enemy to ${s(msOf(until))} s` : "no freeze (control-immune: the freezer's own debuffs only, or a freeze already running past it)";
    const each = st ? (perTarget ? everyTarget(st).map((x) => `T${x.target}: ${enemyWords(x.enemy, e.frame)}`).join("; ") : enemyWords(st.enemy, e.frame)) : "?";
    out.push(`${s(t).padStart(7)}  ${e.target !== undefined ? `T${e.target}`.padEnd(4) : "    "}${label(data, e.operator).padEnd(12)} ${statusEventWords(e)}: ${frozen}; ${perTarget ? "every target's statuses" : "the enemy's statuses"}: ${each}`);
  }
  return [
    `${fx.id}: the control statuses the replay applied (BuffReplay.reactions; times in s), whether each froze the enemy (TimelineState.enemyFrozenUntil) and to when, and ${perTarget ? "every target's" : "the enemy's"} statuses at it (what a freeze's run-on reads: clock.ts rampRunsOn, statusesRunOn, freeze-ramp)`,
    ...(out.length ? out : ["  (none in the window)"]),
    `${out.length} control status(es), ${freezes} freezing, ${held} froze the enemy`,
  ];
}

/** `zmdlogs stagger`: a fight's Stagger runs, the log's against the replay's. */
export function staggerView(data: GameData, fx: LogFixture, opts: { readonly assume?: Readonly<Record<string, string>> } = {}): string {
  const runs = staggerRuns(data, fx, underReadings(opts.assume));
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

/**
 * How far (ms) the replay's first window may start from the log's first Staggered hit before `zmdlogs stagger` flags
 * it (bursts-and-cooldowns report point 2: d4fb's replay window from 86.50 s against the log's 97.26 s, read as a
 * Stagger holding a cooldown; the record had derived a held Stagger's start from its end).
 */
export const STAGGER_START_FLAG_MS = 1000;

/** One Stagger run against the replay's windows and the engine's own end. */
export function staggerLine(r: StaggerRun): string {
  const first = r.replay[0];
  const gap = first ? r.last - first.end : 0;
  const lead = first ? r.start - first.start : 0;
  const flag = first && Math.abs(lead) > STAGGER_START_FLAG_MS ? `; FLAG: the replay's window starts ${s(Math.abs(lead))} s ${lead > 0 ? "before" : "after"} the log's first Staggered hit` : "";
  const short = first ? `; the replay's first window ends ${s(Math.abs(gap))} s ${gap >= 0 ? "before" : "after"} the log's last Staggered hit${flag}` : "";
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
/** How far apart (relative) two neighbouring ratios may be and be one cluster (ratioClusters). */
const CLUSTER_GAP = 0.005;

/**
 * Ratios in clusters (sorted; a gap over CLUSTER_GAP relative starts a new one), each with its median and size: equal
 * steps between clusters are a layered buff the listing shows once (damage-factors report point 4: Ember's Pay the
 * Ferric Price, ×1.023 / ×1.085 / ×1.147 on 04d4's hits, found by four jq passes).
 */
export function ratioClusters(ratios: readonly number[], gap = CLUSTER_GAP): { readonly ratio: number; readonly n: number }[] {
  const v = [...ratios].sort((a, b) => a - b);
  const out: number[][] = [];
  for (const x of v) {
    const c = out.at(-1);
    if (c && x / (c.at(-1) as number) - 1 <= gap) c.push(x);
    else out.push([x]);
  }
  return out.map((c) => ({ ratio: c[Math.floor((c.length - 1) / 2)] as number, n: c.length }));
}

/** A group's clusters in one line: those of two or more hits, by ratio, and how many hits are alone. */
function clusterText(ratios: readonly number[]): string {
  const cs = ratioClusters(ratios);
  const big = cs.filter((c) => c.n >= 2);
  const alone = cs.length - big.length;
  return `    clusters: ${big.map((c) => `×${c.ratio.toFixed(3)} n=${c.n}`).join(", ") || "none of two or more"}${alone ? `; ${alone} alone` : ""}`;
}

export function differencesReport(records: readonly HitRecord[], opts: { readonly what?: RegExp; readonly hits?: boolean; readonly clusters?: boolean; readonly fixtureLabel?: (fixture: string) => string } = {}): string {
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
    if (opts.clusters && g.ratios.length) out.push(clusterText(g.ratios));
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
  let [hits, mism, team, noLanding, wide] = [0, 0, 0, 0, 0];
  for (const [fixture, rs] of byFixture) {
    const ops = rs.filter((r) => r.operator === operator);
    if (!ops.length) continue;
    // A fight-wide factor the fixture doesn't hold (buildoffsets.ts factorStretches: every operator's hits at one ratio
    // over a stretch, a stage's shield or phase; round 17, the Zhuang Fangyi and Liino report point 3: c6d8's ×0.1 was
    // 122 of her 225 mismatches, listed first as her own).
    const stretches = factorStretches(rs);
    const inStretch = (r: HitRecord, q: number | null) => q !== null && stretches.some((st) => r.t >= st.from && r.t <= st.to && Math.abs(q / st.factor - 1) <= FACTOR_STRETCH.tol);
    let [m, tw, nl, fw] = [0, 0, 0, 0];
    for (const r of ops) {
      if (r.class !== "mismatch") continue;
      m++;
      const q = ratioOf(r);
      if (!r.landing) {
        nl++;
        own.push({ r, q });
        continue;
      }
      if (inStretch(r, q)) {
        fw++;
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
    wide += fw;
    perLog.push(`  ${fxLabel(fixture)}  ${String(ops.length).padStart(5)} hits  ${String(m).padStart(4)} mismatches  ${String(fw).padStart(4)} fight-wide  ${String(tw).padStart(4)} team-wide  ${String(nl).padStart(4)} no landing  ${String(m - fw - tw - nl).padStart(4)} own${stretches.length ? `  (factor stretches: ${stretches.map((st) => `${s(st.from)}–${s(st.to)} ×${st.factor.toFixed(3)}`).join(", ")})` : ""}`);
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
  const mine = records.filter((r) => r.operator === operator);
  const asOther = mine.filter((r) => r.assumptions?.some((a) => a.kind === "kitHit")).length;
  const out = [
    `${operator}: ${hits} hits in ${perLog.length} logs, ${mism} mismatches: ${wide} fight-wide (inside a stretch where two or more operators' hits sit at one ratio: a stage factor no fixture holds or one shared cause, zmdlogs offsets --all lists them), ${team} team-wide (a teammate mismatches at the same ratio ±${100 * SAME_RATIO}% within ${NEAR_MS / 1000} s), ${noLanding} without a landing, ${mism - wide - team - noLanding} own`,
    // First (round 17, the Zhuang Fangyi and Liino report point 1): a cast on the wrong step matches as the key's other
    // kit hit and moves no mismatch count (her attack 4 as attack 2: 125 hits ×3.125, "fallback" in five logs).
    `  ${asOther} hit(s) matched only as their event's other kit hit (the scoreboard's "as other kit hit")${asOther ? "; the casts every landing of which matched so, after the logs" : ""}`,
    ...perLog,
    ...otherKitHitCasts(mine, fxLabel),
    "",
    "Own mismatches (not team-wide) by skill event:",
    ...by(({ r }) => [event(r)]),
    "",
    "Own mismatches by where the log and the replay disagree (none: they agree on every buff they both model):",
    ...by(({ r }) => (r.differences?.length ? r.differences.map((d) => `${d.what} (${d.kind === "engine" ? "replay only" : d.kind === "log" ? "log only" : d.sameTotals ? "other values, same totals (cosmetic)" : "other values"})`) : [r.landing ? "none" : `no landing: ${r.unknown ?? "?"}`])),
    "",
    // What the replay can't verify (round 17, the exposed-totals report point 1: 207f's stage Electrification on
    // physical hits, ×0.847 on 41 hits, was one `log buff` among forty modifiers): the buffs the check takes from the
    // log alone, by their zone and element.
    "Own mismatches by the log-only buffs on them (the check adds them from the listing, no kit models them: an element or a skill type they don't reach is a whole-fight factor no difference line shows):",
    ...by(({ r }) => {
      const logged = [...new Set((r.landing?.modifiers ?? []).filter((m) => m.source.startsWith("log buff ")).map((m) => `${m.source.replace(/^log buff /, "")} ${m.zone}${m.element ? ` ${m.element}` : ""}`))];
      return logged.length ? logged : ["none"];
    }),
    "",
    ...fallbackGroups(mine),
  ];
  if (opts.verbose) {
    out.push("", "Each own mismatch:");
    for (const { r, q } of own) out.push(`  ${fxLabel(r.fixture)} ${s(r.t)} ${r.event} logged ${r.value} predicted ${r.predicted ?? "-"} ×${q?.toFixed(4) ?? "-"}${r.differences?.length ? `  ${r.differences.map((d) => `${d.kind}:${d.what}`).join("; ")}` : ""}`);
  }
  return out.join("\n");
}

/**
 * `zmdlogs groups`' rows of the replay's casts every one of whose logged landings matched only as the event's other
 * kit hit (a `kitHit` assumption on each: HitRecord.assumptions, landing.cast): the shape of a path the replay didn't
 * take where the log's key is shared (Rossi's attack 4 under a teammate, ×2.5 in 2fd9; Alesh's Rare Fin combos,
 * ×1.5–1.6 in 0c14, 4e36, a9d7), each found as an operator's odd ratio before (backlog after round 14 point 2). A row:
 * the log, the cast's first landing, its skill, how many landings, the kit hits they matched as for the ones landed,
 * and the median logged ÷ predicted (the replay's path).
 */
export function otherKitHitCasts(records: readonly HitRecord[], fxLabel: (fixture: string) => string = (x) => x): string[] {
  const casts = new Map<string, HitRecord[]>();
  for (const r of records) if (r.landing?.cast !== undefined) casts.set(`${r.fixture}|${r.landing.cast}`, [...(casts.get(`${r.fixture}|${r.landing.cast}`) ?? []), r]);
  const rows: { t: number; text: string }[] = [];
  for (const rs of casts.values()) {
    const kit = (r: HitRecord) => r.assumptions?.filter((a) => a.kind === "kitHit") ?? [];
    if (!rs.every((r) => (r.class === "assumed" || r.class === "fallback") && kit(r).length > 0)) continue;
    const first = rs.reduce((a, b) => (b.t < a.t ? b : a));
    const pairs = [...new Set(rs.map((r) => `${kit(r)[0]?.buffs?.[0] ?? "?"} for ${r.landing?.hitId ?? "?"}`))];
    const ratios = rs.flatMap((r) => (r.predicted ? [r.value / r.predicted] : [])).sort((a, b) => a - b);
    const median = ratios.length ? `×${(ratios[Math.floor((ratios.length - 1) / 2)] as number).toFixed(3)}` : "-";
    rows.push({ t: first.t, text: `  ${fxLabel(first.fixture)} ${s(first.t)} s ${first.landing?.skillId.replace(/^chr_\d+_[a-z0-9]+_/, "") ?? "?"}: ${rs.length} landing(s), matched as ${pairs.join(", ")}; logged ÷ the replay's path ${median}` });
  }
  if (!rows.length) return [];
  return ["", "Casts whose every landing matched only as the event's other kit hit (a path the replay didn't take, the log's key shared by both: the kit's jumps, a chance or control path; zmdlogs decisions has the replay's PATH and JUMPDROP lines):", ...rows.sort((a, b) => a.t - b.t).map((x) => x.text)];
}

/** totalsView's words for how the kill was found (TotalsComparison.kill.kind). */
const KILL_TEXT: Readonly<Record<KillKind, string>> = {
  "max-hp": "the data's Max HP",
  capped: "the last hit capped (its uncapped value above it)",
  lives: "the last life's (lastLifeKilled)",
  "stage-scaled": "a stage-scaled Max HP (stageScaledKill)",
  none: "none found (a whole multiple of the Max HP is a kill the log didn't mark)",
};

/** How much of a placed hold a unit is: a perfect dodge's world slow-down (BuffData, 0.512 s). */
const HOLD_UNIT_MS = 512;

/** A hold unit free over more than this (ms, from its earliest to its latest) is flagged WIDE by `zmdlogs holds`. */
const WIDE_HOLD_MS = 3000;

/** How many of the bounds pinning a unit `holds --verbose` names (nearest first; the rest counted). */
const PIN_TAGS = 4;


/**
 * `zmdlogs holds`: the fight's hidden holds the replay places (engine assumption hidden-holds, reading `placed`:
 * holds.ts placeHolds): the least total, each dodge-sized unit of it with its earliest and latest time and the clocks
 * spanning it (a buff's run, a tick series), the bounds dropped as conflicting, and (with `verbose`) every bound.
 */
export function holdsView(data: GameData, fx: LogFixture, opts: { readonly verbose?: boolean; readonly why?: RegExp; readonly assume?: Readonly<Record<string, string>> } = {}): string {
  const r = logBuffReplay(data, fx, placeHits(data, fx, opts.assume), { assume: { ...opts.assume, "hidden-holds": "placed" } }).replay;
  const h = r.hiddenHolds;
  if (!h) return `${fx.id}: no holds placed (no kit to replay)`;
  if (opts.why) return holdsWhy(data, fx, r.holdClocks ?? [], h, opts.why, r.logEnds);
  const series = (tag: string) => tag.replace(/ [0-9]+[→⇒][0-9]+ ms$/, "");
  const lines = [`${fx.id}: ${s(h.total)} s of hidden holds placed (the least total the clocks allow; ${Math.round(h.total / HOLD_UNIT_MS)} perfect dodges' worth at 0.512 s), ${new Set(h.kept.filter((b) => b.kind === "run").map((b) => b.tag)).size} buff runs and ${new Set(h.kept.filter((b) => b.kind === "tick").map((b) => series(b.tag))).size} tick series kept, ${h.dropped.length} bound(s) dropped; times in s`];
  // What holds a unit where it is (holds.ts holdPins; remaining-leads report point 1): its earliest by the bounds capping
  // the hold before it (the node before the one the earliest P reaches it at), its latest by those forcing it by then.
  const pinText = (p: ReturnType<typeof holdPins>) => {
    const tags = p.bounds.map((b) => b.tag);
    const shown = tags.length > PIN_TAGS ? [...tags.slice(0, PIN_TAGS), `+${tags.length - PIN_TAGS} more`] : tags;
    return [...(p.total ? ["the least total"] : []), ...shown].join("; ") || "P's own rules (nondecreasing, no faster than real time)";
  };
  let wideUnits = 0;
  for (let m = HOLD_UNIT_MS / 2; m < h.total; m += HOLD_UNIT_MS) {
    const [early, late, mid] = [clockReaches(h, h.early, m), clockReaches(h, h.late, m), clockReaches(h, h.mid, m)];
    const clocks = [...new Set(h.kept.filter((b) => b.a <= early && late <= b.b).map((b) => (b.kind === "run" ? b.tag : series(b.tag))))];
    let pins = "";
    if (opts.verbose) {
      const i = h.early.findIndex((x) => x >= m - 1e-6);
      const j = h.late.findIndex((x) => x >= m - 1e-6);
      pins = `; earliest held back by: ${i > 0 ? pinText(holdPins(h, i - 1, "early")) : "the fight's start"}; latest forced by: ${j >= 0 ? pinText(holdPins(h, j, "late")) : "none"}`;
    }
    // A unit the clocks leave free over seconds is placed at the window's midpoint, wherever that falls (round 17, the
    // away-statuses report point 3: 8 s of 4d60's pause spread over 21.9–45.9 s before holds.ts pausedBound).
    const wide = late - early > WIDE_HOLD_MS ? `  WIDE: the clocks don't pin it (${s(late - early)} s from earliest to latest; placed at the midpoint)` : "";
    if (wide) wideUnits++;
    lines.push(`  unit ${s(m)} s: placed at ${s(mid)} (earliest ${s(early)}, latest ${s(late)}), ${clocks.length} clock(s) span it${opts.verbose && clocks.length ? `: ${clocks.join("; ")}` : ""}${pins}${wide}`);
  }
  if (wideUnits) lines.splice(1, 0, `  ${wideUnits} unit(s) WIDE: free over more than ${s(WIDE_HOLD_MS)} s, placed at their window's midpoint, not where a clock puts them`);
  for (const [k, b] of h.dropped.entries()) {
    const against = (h.conflicts[k] ?? []).map((x) => x.tag);
    lines.push(`  dropped: ${b.tag} (asks ${b.ex.toFixed(2)} s)${opts.verbose && against.length ? `, conflicting with: ${against.join("; ")}` : ""}`);
  }
  if (opts.verbose) for (const b of h.kept) lines.push(`  bound: ${b.tag}: P(${s(b.b)}) − P(${s(b.a)}) in [${Number.isFinite(b.min) ? s(b.min) : "−∞"}, ${Number.isFinite(b.max) ? s(b.max) : "∞"}] s; placed ${s(clockAt(h, h.mid, b.b) - clockAt(h, h.mid, b.a))}`);
  return lines.join("\n");
}

/**
 * `zmdlogs holds <fixture> --steps <from>-<to>`: the hidden holds' per-frame steps the replay applies in a window (ms),
 * beside the slow-downs the timeline applied there and the log's Stagger breaks (round 19, backlog after round 18 point 3:
 * 5082's holds around Yvonne's break turned out spread over 1.5 s in 1-frame steps, which only a debug print showed).
 * Each step: its frame and time, the frames it holds the world, and the hold so far (from the fight's start and from
 * the window's); each applied stop: its frames and the world frames it holds (Σ 1 − scale).
 */
export function holdsSteps(data: GameData, fx: LogFixture, from: number, to: number, opts: { readonly assume?: Readonly<Record<string, string>> } = {}): string {
  const r = logBuffReplay(data, fx, placeHits(data, fx, opts.assume), { assume: { ...opts.assume, "hidden-holds": "placed" } }).replay;
  const h = r.hiddenHolds;
  if (!h) return `${fx.id}: no holds placed (no kit to replay)`;
  const ms = (f: number) => (f * 1000) / FPS;
  const before = h.holds.filter((x) => ms(x.frame) < from).reduce((n, x) => n + x.frames, 0);
  const lines: { t: number; text: string }[] = [];
  let sum = 0;
  for (const x of h.holds) {
    const t = ms(x.frame);
    if (t < from || t > to) continue;
    sum += x.frames;
    lines.push({ t, text: `  ${s(t).padStart(7)}  HOLD  frame ${x.frame}: ${x.frames} frame(s), ${sum} in the window, ${before + sum} from the start` });
  }
  for (const st of r.appliedStops) {
    const [a, b] = [ms(st.start), ms(st.start + st.scales.length)];
    if (b < from || a > to) continue;
    const held = st.scales.reduce((n, x) => n + (1 - x), 0);
    lines.push({ t: a, text: `  ${s(a).padStart(7)}  STOP  ${st.operator ? label(data, st.operator) : "the world"}${st.ultimate ? " ultimate" : ""} ${st.scales.length} frame(s) to ${s(b)}, holds ${held.toFixed(1)} world frame(s)` });
  }
  for (const t of loggedBreaks(fx)) if (t >= from && t <= to) lines.push({ t, text: `  ${s(t).padStart(7)}  BREAK the log's Stagger break (its hold: engine assumption break-hold)` });
  lines.sort((p, q) => p.t - q.t);
  return [`${fx.id}: the hidden holds' steps ${s(from)}–${s(to)} s (HOLD: frames the world is held at a frame, a frame at a time where the placed hold rises), the slow-downs the timeline applied there (STOP) and the log's Stagger breaks (BREAK); ${before} frame(s) held before the window, ${sum} in it; times in s`, ...lines.map((l) => l.text)].join("\n");
}

/** What covers a hold bound's span (droppedView): the log's Stagger, and which kinds of the replay's casts' stops lie in it. */
export function boundCover(b: Pick<HoldBound, "a" | "b">, stagger: readonly { readonly from: number; readonly to: number }[], stops: readonly { readonly start: number; readonly scales: readonly number[]; readonly kind?: string | null }[]): { readonly stagger: "inside" | "partly" | "outside"; readonly stops: string } {
  const len = Math.max(1, b.b - b.a);
  const inStagger = stagger.reduce((t, x) => t + Math.max(0, Math.min(b.b, x.to) - Math.max(b.a, x.from)), 0);
  const [fa, fb] = [Math.round((b.a * FPS) / 1000), Math.round((b.b * FPS) / 1000)];
  const kinds = new Set(stops.filter((st) => st.start < fb && st.start + st.scales.length > fa && st.scales.some((x) => x < 1)).map((st) => st.kind ?? "other"));
  const order = ["ultimate", "combo", "battle", "basic", "other"];
  return { stagger: inStagger >= len - 1 ? "inside" : inStagger > 0 ? "partly" : "outside", stops: [...kinds].sort((x, y) => order.indexOf(x) - order.indexOf(y)).join("+") || "no stop" };
}

/**
 * `zmdlogs holds --all --dropped` (enemy-clock report point 3: "never while the enemy is Staggered" rested on 1 of 92
 * tick pairs, and the combo-sized lateness in Staggers was dropped as conflicts log by log, with no count saying where):
 * the hold placement's dropped bounds over the logs, grouped by bound kind and by what covers their span (the log's
 * Stagger: query.ts loggedStaggerSpans; the kinds of the replay's casts' stops inside), each group with its count, the
 * logs it is in, its asks (quartiles, s) and how many bounds of the same group were kept, so a group dropped far more
 * often than kept, across many logs, stands out. `verbose`: each dropped bound.
 */
export function droppedView(data: GameData, logs: readonly { readonly short: string; readonly fx: LogFixture }[], opts: { readonly assume?: Readonly<Record<string, string>>; readonly verbose?: boolean; readonly progress?: (line: string) => void } = {}): string {
  const groups = new Map<string, { dropped: number; kept: number; logs: Set<string>; asks: number[] }>();
  const each: string[] = [];
  let none = 0;
  for (const { short, fx } of logs) {
    opts.progress?.(`holds ${short}`);
    const placement = placeHits(data, fx, opts.assume);
    const r = logBuffReplay(data, fx, placement, { assume: { ...opts.assume, "hidden-holds": "placed" } }).replay;
    const h = r.hiddenHolds;
    if (!h) {
      none++;
      continue;
    }
    const stagger = loggedStaggerSpans(fx);
    const stops = replayTimeStops(data, fx, placement, r);
    const key = (b: HoldBound) => {
      const c = boundCover(b, stagger, stops);
      return `${b.kind.padEnd(6)} ${`Stagger ${c.stagger}`.padEnd(15)} ${c.stops}`;
    };
    for (const [list, dropped] of [[h.dropped, true], [h.kept, false]] as const) {
      for (const b of list) {
        const k = key(b);
        const g = groups.get(k) ?? { dropped: 0, kept: 0, logs: new Set<string>(), asks: [] };
        if (dropped) {
          g.dropped++;
          g.logs.add(short);
          g.asks.push(b.ex);
          if (opts.verbose) each.push(`  ${short} ${k.replace(/ +/g, " ")}: ${b.tag} (asks ${b.ex.toFixed(2)} s)`);
        } else g.kept++;
        groups.set(k, g);
      }
    }
  }
  const rows = [...groups].filter(([, g]) => g.dropped > 0).sort((x, y) => y[1].dropped - x[1].dropped || y[1].logs.size - x[1].logs.size);
  const total = rows.reduce((t, [, g]) => t + g.dropped, 0);
  return [
    `The hold placement's dropped bounds over ${logs.length - none} logs${none ? ` (${none} with no holds placed)` : ""}${opts.assume && Object.keys(opts.assume).length ? ` under ${Object.entries(opts.assume).map(([k, v]) => `${k}=${v}`).join(", ")}` : ""}: ${total} dropped, by bound kind, the log's Stagger over its span (query.ts loggedStaggerSpans) and the kinds of the replay's casts' stops inside; kept: the bounds of the same group the placement kept; asks: the hold each asks (quartiles, s)`,
    ...rows.map(([k, g]) => `  ${k.padEnd(48)} ${String(g.dropped).padStart(4)} dropped in ${String(g.logs.size).padStart(2)} logs, ${String(g.kept).padStart(5)} kept; asks ${quartiles(g.asks, 2)}`),
    ...(opts.verbose && each.length ? ["", "Each dropped bound:", ...each] : []),
  ].join("\n");
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
export function rampView(data: GameData, fx: LogFixture, opts: { readonly verbose?: boolean; readonly why?: boolean; readonly assume?: Readonly<Record<string, string>> } = {}): string {
  const placement = placeHits(data, fx, opts.assume);
  const { replay } = logBuffReplay(data, fx, placement, underReadings(opts.assume));
  const steps = corrosionRamp(data, fx, placement, replay);
  const h = replay.hiddenHolds;
  if (steps.length === 0) return `${fx.id}: no hit under the log's Corrosion reads a step (none listed, no landing with the replay's Corrosion, or no step fits)`;
  const lines = [`${fx.id}: ${steps.length} hits read Corrosion's ramp (steps: whole seconds of its world time; hold: P(hit) − P(since) in s, as the steps allow and as placed)${opts.why ? "; held: what held the replay's ramp from its application to the landing (time stops of the replay's casts, at their lowest scale; placed hidden holds; the rest: statuses created in a stop, the stop a reset cut, the frame grid; freezes run the ramp on)" : ""}`];
  const stops = opts.why ? replayTimeStops(data, fx, placement, replay) : [];
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
export function totalsView(data: GameData, fx: LogFixture, f: { readonly operators?: readonly string[]; readonly top?: number; readonly assume?: Readonly<Record<string, string>>; readonly byEvent?: boolean; readonly byCrit?: boolean; readonly kinds?: boolean } = {}): string {
  const replay = f.assume && Object.keys(f.assume).length ? logBuffReplay(data, fx, undefined, { assume: f.assume }) : logBuffReplay(data, fx);
  const byHit = engineHits(data, fx, replay);
  const t = engineReport(data, fx, replay, byHit, checkLog(data, fx, { replay, engineHits: byHit })).totals;
  if (f.byEvent) return totalsByEvent(data, fx, t, f);
  if (f.byCrit) return totalsByCrit(data, fx, t, (h) => byHit.get(h)?.totalsCrit ?? "known", f);
  if (f.kinds) return totalsOneSided(data, fx, t, f);
  const top = f.top ?? 10;
  const pct = (sim: number, log: number) => (log === 0 ? "n/a" : `${sim / log - 1 > 0 ? "+" : ""}${(100 * (sim / log - 1)).toFixed(1)}%`);
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  const counted = new Set(t.parts.flatMap((p) => (p.logged ? [p.logged] : [])));
  const ops = [...new Set([...Object.keys(t.logged.perOperator), ...Object.keys(t.simulated.perOperator)])].filter((op) => !f.operators?.length || f.operators.includes(op));
  const out = [
    `${fx.id}: the simulated total's parts (enginecheck.ts fightTotals; damage simulated vs logged). matched: the landings standing for logged hits, predicted vs their logged values; replay only: landings no logged hit stands for (counted to the log's last hit); log only: logged hits the total has no landing for; shifts: recorded bursts' teammate shares taken as logged.`,
    `  team: ${n(t.simulated.damage)} vs ${n(t.logged.damage)} (${pct(t.simulated.damage, t.logged.damage)}); logged total ${t.kill.maxHp ? `×${(t.logged.damage / t.kill.maxHp).toFixed(4)} the data's Max HP (${n(t.kill.maxHp)})` : "- (no Max HP in the data)"}, kill: ${KILL_TEXT[t.kill.kind]}`,
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

/**
 * `zmdlogs totals --by crit`: the matched parts per operator by how the totals took each hit's crit (TotalsCrit: the
 * log's, the value's exact reading, read from the value, expected crits), each kind's sums and its share of the
 * operator's error: is a total's miss the model or the fight's crit luck (0c14-and-operator-curve report point 1)?
 */
function totalsByCrit(data: GameData, fx: LogFixture, t: TotalsComparison, critOf: (h: LogHit) => TotalsCrit, f: { readonly operators?: readonly string[] }): string {
  const L = t.logged.damage;
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  const pc = (x: number, of: number) => (of === 0 ? "n/a" : `${x >= 0 ? "+" : ""}${((100 * x) / of).toFixed(1)}%`);
  const KINDS: readonly TotalsCrit[] = ["known", "exact", "read", "expected"];
  const rows = new Map<string, Map<TotalsCrit, { n: number; sim: number; log: number }>>();
  for (const p of t.parts) {
    if (!p.logged || (f.operators?.length && !f.operators.includes(p.operator))) continue;
    const byKind = rows.get(p.operator) ?? rows.set(p.operator, new Map()).get(p.operator) as Map<TotalsCrit, { n: number; sim: number; log: number }>;
    const k = critOf(p.logged);
    const r = byKind.get(k) ?? { n: 0, sim: 0, log: 0 };
    r.n++;
    r.sim += p.damage;
    r.log += p.logged.value;
    byKind.set(k, r);
  }
  const out = [
    `${fx.id}: the matched landings by how the totals take each hit's crit (enginecheck.ts TotalsCrit; engine assumption totals-crits): known the log gives it, exact the value is one of its two readings, read near one of them only, expected neither (expected crits: that kind's error is partly the fight's crit luck). Per kind: landings, simulated vs logged, its error, and its share of the fight's logged total.`,
  ];
  for (const [op, byKind] of rows) {
    const all = [...byKind.values()].reduce((a, r) => ({ n: a.n + r.n, sim: a.sim + r.sim, log: a.log + r.log }), { n: 0, sim: 0, log: 0 });
    out.push(`  ${label(data, op)}: matched ${n(all.sim)} vs ${n(all.log)} (${pc(all.sim - all.log, all.log)}, ${all.n} landing(s))`);
    for (const k of KINDS) {
      const r = byKind.get(k);
      if (r) out.push(`      ${k.padEnd(8)} ${String(r.n).padStart(4)}  ${n(r.sim)} vs ${n(r.log)} (${pc(r.sim - r.log, r.log)}; ${pc(r.sim - r.log, L)} of the fight)`);
    }
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
/** `targets`: a pending fight against several enemies under one id (the fixture's severalTargets), the scoreboard's own row. */
export type TotalsGroup = "verified" | "development" | "earlier" | "targets" | "multi";
const TOTALS_GROUPS: readonly TotalsGroup[] = ["verified", "development", "earlier", "targets", "multi"];
/** The groups whose fights the combined rows and the by-key ranking leave out: multi-target imports, several targets under one id. */
const APART: ReadonlySet<TotalsGroup> = new Set(["multi", "targets"]);

const sharePct = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`;

/** `zmdlogs totals <fx> --kinds`: the fight's one-sided landings (onesided.ts), by where they sit, then each, largest first. */
function totalsOneSided(data: GameData, fx: LogFixture, t: TotalsComparison, f: { readonly operators?: readonly string[]; readonly top?: number }): string {
  const L = t.logged.damage;
  const items = t.oneSided.filter((x) => !f.operators?.length || f.operators.includes(x.operator));
  const byContext = kindsAggregate([items.map((x): KindShare => ({ context: x.context, nature: x.nature, skill: x.skill, replay: x.side === "replay" ? (100 * x.damage) / L : 0, log: x.side === "log" ? (100 * x.damage) / L : 0, n: 1, flagged: {} }))], (k) => k.context);
  const out = [
    `${fx.id}: the one-sided landings (onesided.ts; % of the logged total): replay-only (+) and log-only (−), each with where it sits (twin: an opposite-side landing of its operator within 1.5 s; cast tail / head / gap / unlogged: its cast's landings standing for logged hits; no landing: the replay's reason), its nature and skill kind, and flags (stop: inside a slow-down; cut: after a cast made as a cut; next cast: past its operator's next logged cast; end: within 1.5 s of the log's last hit; away: at a stretch without logged hits; kill: after a logged kill before the fight's end, before the next logged hit).`,
    "  by where they sit:",
    ...byContext.map((k) => `    ${sharePct(k.replay)} ${sharePct(k.log)}  ${k.kind}`),
    "  each:",
  ];
  const top = f.top ?? 40;
  const sorted = [...items].sort((a, b) => Math.abs(b.damage) - Math.abs(a.damage));
  for (const x of sorted.slice(0, top)) {
    const twin = x.twin ? `  ↔ ${s(x.twin.t)} s ${shortSkill(x.twin.key)} ${sharePct((100 * x.twin.damage) / L)}` : "";
    out.push(`    ${sharePct((100 * x.damage) / L).padStart(7)} ${s(x.t).padStart(7)} s  ${label(data, x.operator)} ${x.side.padEnd(6)} ${shortSkill(x.key)}  [${x.context}; ${x.nature} · ${x.skill}${x.flags.length ? `; ${x.flags.join(", ")}` : ""}]${twin}`);
  }
  if (sorted.length > top) out.push(`    … and ${sorted.length - top} more`);
  return out.join("\n");
}

/** A kind aggregate's lines (kindsAggregate): gross, replay-only, log-only, net, the fights it occurs in, flags' shares. */
export function formatKindLines(agg: ReturnType<typeof kindsAggregate>, top: number): string[] {
  const flags = (x: Readonly<Record<string, number>>) => {
    const parts = Object.entries(x).filter(([, v]) => v >= 0.005).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(2)}`);
    return parts.length ? `  [${parts.join(", ")}]` : "";
  };
  const lines = agg.slice(0, top).map((k) => `    ${(k.replay - k.log).toFixed(2).padStart(6)}%  ${sharePct(k.replay).padStart(7)} ${sharePct(k.log).padStart(7)}  net ${sharePct(k.replay + k.log).padStart(7)}  ${String(k.fights).padStart(3)} fight(s)  ${k.kind}${flags(k.flagged)}`);
  if (agg.length > top) lines.push(`    … and ${agg.length - top} more kinds, ${agg.slice(top).reduce((a, k) => a + k.replay - k.log, 0).toFixed(2)}% gross`);
  return lines;
}

/**
 * `zmdlogs totals --all --kinds`: the one-sided landings of every selected fight ranked by kind (onesided.ts: where
 * they sit, nature, skill kind; mean share of a fight's logged total), per group, then by operator and key over the
 * development, earlier-pending and verified fights with the fights carrying most. Hold-outs: measure, by kind only.
 */
export function totalsKindsView(data: GameData, rows: readonly TotalsRow[], f: { readonly operators?: readonly string[]; readonly top?: number } = {}): string {
  const top = f.top ?? 15;
  const kindsOf = (r: TotalsRow) => (r.shares.kinds ?? []).filter(() => !f.operators?.length || r.shares.perOperator.some((o) => f.operators?.includes(o.operator)));
  const out = [
    "The one-sided landings by kind (onesided.ts), as mean % of a fight's logged total: gross (replay-only + |log-only|), replay-only, log-only, net, the fights with any, and the flags' gross shares (stop: inside a slow-down; cut: after a cast made as a cut; next cast: past the operator's next logged cast; end: within 1.5 s of the log's last hit; away: at a stretch without logged hits; kill: after a logged kill before the fight's end). Where they sit: unread (a logged hit's own landing without a reading), twin like / other (an opposite-side landing of the operator within 1.5 s, values within ×1.5 or ×3), then the replay's cast (no cast, cast unlogged / tail / head / gap) or the log's reason (no landing: …).",
  ];
  const groups: { name: string; rows: TotalsRow[] }[] = [
    { name: "development, earlier pending and verified", rows: rows.filter((r) => !APART.has(r.group)) },
    ...TOTALS_GROUPS.filter((g) => g !== "multi").map((g) => ({ name: g === "targets" ? "several targets under one id" : g, rows: rows.filter((r) => r.group === g) })),
  ];
  for (const g of groups) {
    if (!g.rows.length) continue;
    const fights = g.rows.map(kindsOf);
    out.push("", `${g.name}: ${g.rows.length} fight(s); by where they sit:`, ...formatKindLines(kindsAggregate(fights, (k) => k.context), top));
    out.push(`  by nature:`, ...formatKindLines(kindsAggregate(fights, (k) => k.nature), top));
    out.push(`  by where they sit · nature · skill kind:`, ...formatKindLines(kindsAggregate(fights), top));
  }
  const all = rows.filter((r) => !APART.has(r.group));
  const keys = new Map<string, { operator: string; side: string; key: string; context: string; share: number; n: number; fights: Map<string, number> }>();
  for (const r of all)
    for (const k of r.shares.keys ?? []) {
      if (f.operators?.length && !f.operators.includes(k.operator)) continue;
      const id = `${k.operator}|${k.side}|${k.key}|${k.context}`;
      const a = keys.get(id) ?? { operator: k.operator, side: k.side, key: k.key, context: k.context, share: 0, n: 0, fights: new Map() };
      keys.set(id, a);
      a.share += k.share / all.length;
      a.n += k.n;
      a.fights.set(r.short, (a.fights.get(r.short) ?? 0) + k.share);
    }
  const ranked = [...keys.values()].sort((a, b) => Math.abs(b.share) - Math.abs(a.share));
  out.push("", `By operator, side, key and where they sit (mean % over the ${all.length} fights; the fights carrying most):`);
  for (const k of ranked.slice(0, top * 2)) {
    const fights = [...k.fights].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4).map(([id, v]) => `${id} ${sharePct(v)}`).join(", ");
    out.push(`  ${sharePct(k.share).padStart(7)}  ${label(data, k.operator)} ${k.side} ${shortSkill(k.key)} [${k.context}] ×${k.n}: ${fights}${k.fights.size > 4 ? ` … (${k.fights.size})` : ""}`);
  }
  out.push("Hold-outs: only their means by kind, from `npm run measure` (its summary's \"One-sided landings by kind\").");
  return out.join("\n");
}

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
