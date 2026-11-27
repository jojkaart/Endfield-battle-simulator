// The screen for build offsets: per (log, operator), the median of logged ÷ the engine's primary reading over the
// operator's non-crit kit hits, and how many of them sit within 1% of it. A tight median away from 1 is one factor on
// every hit of the operator, all fight: a missing food, an attribute node or a weapon level the export got wrong, which
// `zmdlogs fit-build` then names (fight totals 2 report point 1: a9d7's −18.5% "fight-wide factor" was a missing food;
// a scratch screen of these medians found six more in minutes, sitting in the logs for weeks while the totals were
// blamed on kits). A spread-out median isn't one factor: the replay's timing, a stage's shield (×0.1–0.7 by phase).
//
// `efsim zmdlogs offsets` prints it over the development logs (from the hit records' cache); tests/slow/'s pending
// suite fails on a candidate no fixture `buildOverrides` or OFFSETS_EXPLAINED entry accounts for.

import { parseReactionEvent } from "@efsim/engine";
import type { HitRecord } from "./hitexport.ts";
import type { EngineHits, HitVerdict, VerdictCount } from "./logcheck.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";

/** One hit's part in the screen: its operator, logged ÷ primary, and (where known) logged ÷ the log's own reading. */
export interface OffsetHit {
  readonly operator: string;
  readonly ratio: number;
  readonly logRatio?: number;
}

/** An operator's offset in one log. */
export interface OperatorOffset {
  readonly operator: string;
  /** Hits counted (non-crit kit hits with a primary reading and a verdict that rests on one). */
  readonly n: number;
  /** Median logged ÷ primary. */
  readonly median: number;
  /** Share of the hits within `OFFSET_SCREEN.tight` of the median. */
  readonly tight: number;
  /** Median logged ÷ the log's reading (the log's listing in place of the replay's buffs), where the records have it. */
  readonly logMedian?: number;
}

/** The screen's thresholds: a candidate has at least `minHits`, its median off by `minOff` or more, `minTight` of its hits within `tight` of it. */
export const OFFSET_SCREEN = { minHits: 20, minOff: 0.03, minTight: 0.6, tight: 0.01 } as const;

/** The verdict classes whose primary reading means something for a build (not an unvalued or unquantified listing's). */
const COUNTED: ReadonlySet<VerdictCount> = new Set(["plain", "assumed", "fallback", "mismatch"]);

/** Whether a logged hit counts: a kit hit (not a reaction or status event), logged as no crit, with a primary reading. */
export function countsForOffset(hit: LogHit, verdictClass: VerdictCount, primary: number | null | undefined): primary is number {
  return hit.crit === false && parseReactionEvent(hit.event) === null && COUNTED.has(verdictClass) && typeof primary === "number" && primary > 0;
}

/** The same from a log's hit records (`zmdlogs hits`' cache): their predicted value is the primary reading, rounded. */
export function offsetHitsOfRecords(records: readonly HitRecord[]): OffsetHit[] {
  return records.flatMap((r) =>
    r.crit === false && r.kind === "skill" && COUNTED.has(r.class) && typeof r.predicted === "number" && r.predicted > 0
      ? [{ operator: r.operator, ratio: r.value / r.predicted, ...(typeof r.logReading === "number" && r.logReading > 0 ? { logRatio: r.value / r.logReading } : {}) }]
      : [],
  );
}

/** A log's offset hits from the check's own computation (snapshotEntry's byHit and verdicts). */
export function offsetHits(fx: LogFixture, byHit: EngineHits, verdicts: readonly HitVerdict[]): OffsetHit[] {
  const cls = new Map(verdicts.map((v) => [v.hit, v.kind === "match" ? v.class : v.kind]));
  return fx.hits.flatMap((h) => {
    const p = byHit.get(h)?.primary;
    const c = cls.get(h);
    return c !== undefined && countsForOffset(h, c, p) ? [{ operator: h.operator, ratio: h.value / p }] : [];
  });
}

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};

/** Per operator (in order of first hit): the median, its tightness and the hit count. */
export function screenOffsets(hits: readonly OffsetHit[]): OperatorOffset[] {
  const by = new Map<string, OffsetHit[]>();
  for (const h of hits) by.set(h.operator, [...(by.get(h.operator) ?? []), h]);
  return [...by].map(([operator, hs]) => {
    const m = median(hs.map((h) => h.ratio));
    const logs = hs.flatMap((h) => (h.logRatio !== undefined ? [h.logRatio] : []));
    return {
      operator,
      n: hs.length,
      median: m,
      tight: hs.filter((h) => Math.abs(h.ratio / m - 1) <= OFFSET_SCREEN.tight).length / hs.length,
      ...(logs.length ? { logMedian: median(logs) } : {}),
    };
  });
}

/** Whether an offset is a fit-build candidate by the screen's thresholds. */
export function isOffsetCandidate(o: OperatorOffset): boolean {
  return o.n >= OFFSET_SCREEN.minHits && Math.abs(o.median - 1) >= OFFSET_SCREEN.minOff && o.tight >= OFFSET_SCREEN.minTight;
}

/**
 * Candidates the screen finds that aren't a build input, each with why (log id's first four hex digits and operator
 * id → the reason): the slow test leaves them. A fixture's `buildOverrides` for the operator accounts for its own.
 */
export const OFFSETS_EXPLAINED: Readonly<Record<string, string>> = {
  // The stage logs: the stages' shields and phase factors (×0.1–0.7 on whole stretches: docs/open-problems.md "Fight
  // totals", the stage logs), tight where one phase holds most of an operator's hits. A stage's round factor is the
  // fixture's stageFactors instead (8915, c6d8: no offset left).
  "7b54 chr_0032_lizhiyan": "the stage's shield and phase factors: a stage log (under the log's reading ×1.00: the listing has them)",
  "6339 chr_0032_lizhiyan": "the stage's shield and phase factors: a stage log",
  // Build inputs known and not fitted (docs/open-problems.md "Hard 27", "Fight-wide factors in older imports").
  "99fb chr_0038_purrche": "her level is 1 in the export (×2.47); fit-build doesn't vary an operator's level",
  // Found by the screen (round 9), not decided: accuracy leads (a buildOverride moves the verdicts).
  "04d4 chr_0014_aurora": "open: ×0.962 on 77% of her hits; fit-build's best needs two inputs (weapon level 51 and a food, 91 of 207 fit): undecided",
};

/** A row of the offsets view: a log (its short id), its fixture and an operator's offset there. */
export interface OffsetRow {
  readonly short: string;
  readonly fx: LogFixture;
  readonly offset: OperatorOffset;
  /** For a candidate: the build inputs whose ATK gives its median (logcheck.ts offsetExplanations: a weapon level, nodes). */
  readonly fits?: readonly string[];
}

/**
 * `efsim zmdlogs offsets`: every (log, operator) with at least OFFSET_SCREEN.minHits counted hits, the candidates
 * first (`*`: a tight median off by 3% or more), then by |median − 1| × tightness; `top` rows (0: every one). Each says
 * what accounts for it (a buildOverride, an OFFSETS_EXPLAINED entry) or that fit-build is the next step, and when most
 * of a log's operators are off together (a team-wide factor: a food, the stage).
 */
export function offsetsView(data: { readonly operators: Readonly<Record<string, { readonly name?: string } | undefined>> }, rows: readonly OffsetRow[], opts: { readonly top?: number; readonly operators?: readonly string[] } = {}): string {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const pct = (x: number) => `${x >= 1 ? "+" : ""}${(100 * (x - 1)).toFixed(1)}%`;
  const shown = rows.filter((r) => r.offset.n >= OFFSET_SCREEN.minHits && (!opts.operators?.length || opts.operators.includes(r.offset.operator)));
  const score = (o: OperatorOffset) => (isOffsetCandidate(o) ? 10 : 0) + Math.abs(o.median - 1) * o.tight;
  const sorted = [...shown].sort((a, b) => score(b.offset) - score(a.offset) || a.short.localeCompare(b.short));
  const top = opts.top ?? 25;
  const teamOff = (short: string) => {
    const of = rows.filter((r) => r.short === short && r.offset.n >= OFFSET_SCREEN.minHits);
    const off = of.filter((r) => Math.abs(r.offset.median - 1) >= OFFSET_SCREEN.minOff && r.offset.tight >= OFFSET_SCREEN.minTight / 2);
    return of.length >= 2 && off.length >= Math.max(2, Math.ceil((of.length * 3) / 4)) ? ` (${off.length} of ${of.length} operators off: a team-wide factor? a food, the stage)` : "";
  };
  const out = [
    `Build offsets: per log and operator, the median of logged ÷ the primary reading over non-crit kit hits with a reading (n), and the share within ${100 * OFFSET_SCREEN.tight}% of it (tight); log: the same under the log's reading. * a fit-build candidate (n ≥ ${OFFSET_SCREEN.minHits}, off ≥ ${100 * OFFSET_SCREEN.minOff}%, tight ≥ ${100 * OFFSET_SCREEN.minTight}%): one factor on every hit (a food, a node, a weapon level); a loose median is timing or a stage.`,
    "  id    operator                    n   median   tight     log  ",
  ];
  const lines = top > 0 ? sorted.slice(0, top) : sorted;
  for (const r of lines) {
    const o = r.offset;
    const cand = isOffsetCandidate(o);
    const overridden = (r.fx.buildOverrides ?? []).some((b) => b.operator === o.operator);
    const explained = OFFSETS_EXPLAINED[`${r.short} ${o.operator}`];
    const fits = r.fits?.length ? ` (its ATK fits ${r.fits.join(" or ")})` : "";
    const note = cand ? (overridden ? "  buildOverrides set (fit-build again?)" : explained !== undefined ? `  explained: ${explained}` : `  → zmdlogs fit-build ${r.short} --operator ${o.operator}${fits}`) : overridden ? "  (buildOverrides set)" : "";
    out.push(`${cand ? "*" : " "} ${r.short.padEnd(5)} ${name(o.operator).slice(0, 24).padEnd(24)} ${String(o.n).padStart(4)}  ${pct(o.median).padStart(7)}  ${`${(100 * o.tight).toFixed(0)}%`.padStart(5)}  ${o.logMedian !== undefined ? pct(o.logMedian).padStart(7) : "      -"}${note}${cand ? teamOff(r.short) : ""}`);
  }
  if (top > 0 && sorted.length > top) out.push(`  … ${sorted.length - top} more (--top 0 for every row)`);
  const cands = shown.filter((r) => isOffsetCandidate(r.offset));
  const open = cands.filter((r) => !(r.fx.buildOverrides ?? []).some((b) => b.operator === r.offset.operator) && OFFSETS_EXPLAINED[`${r.short} ${r.offset.operator}`] === undefined);
  out.push("", `${cands.length} candidate(s) over ${new Set(rows.map((r) => r.short)).size} logs, ${open.length} with nothing accounting for them (tests/slow/ fails on those: fit-build, then a buildOverride or an OFFSETS_EXPLAINED entry in packages/logs/src/buildoffsets.ts). Hold-outs: never screened.`);
  return out.join("\n");
}

/** The candidates of a log that nothing accounts for: no buildOverride of the operator, no OFFSETS_EXPLAINED entry. */
export function unexplainedOffsets(fx: LogFixture, offsets: readonly OperatorOffset[]): OperatorOffset[] {
  const short = fx.id.replace(/^zmdlogs-/, "").slice(0, 4);
  const overridden = new Set((fx.buildOverrides ?? []).map((o) => o.operator));
  return offsets.filter((o) => isOffsetCandidate(o) && !overridden.has(o.operator) && OFFSETS_EXPLAINED[`${short} ${o.operator}`] === undefined);
}
