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

/**
 * One hit's part in the screen: its operator, logged ÷ primary, and (where known) logged ÷ the log's own reading, the
 * logged value and whether the hit is a mismatch.
 */
export interface OffsetHit {
  readonly operator: string;
  readonly ratio: number;
  readonly logRatio?: number;
  readonly value?: number;
  readonly mismatch?: boolean;
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
  /** The median logged value of the counted hits, and how many of them are mismatches, where the hits have them. */
  readonly medianValue?: number;
  readonly mismatched?: number;
}

/**
 * The screen's thresholds: a candidate has at least `minHits`, its median off by `minOff` or more, `minTight` of its
 * hits within `tight` of it, and the median's offset worth `minDamage` or more on its median hit (where the hits carry
 * their values). Round 20 (the build-fits report point 1): `minOff` was 3%, but the check's tolerance is ±1 damage, so
 * any offset over a few tenths of a percent on a tight row makes most of its hits mismatches: 04d4's Ember (×1.0226,
 * 80% mismatched) and 4e36's Alesh (×0.9745, 100%) sat under it for weeks, each fitted in minutes once looked at.
 */
export const OFFSET_SCREEN = { minHits: 20, minOff: 0.003, minTight: 0.6, tight: 0.01, minDamage: 2 } as const;

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
      ? [{ operator: r.operator, ratio: r.value / r.predicted, value: r.value, mismatch: r.class === "mismatch", ...(typeof r.logReading === "number" && r.logReading > 0 ? { logRatio: r.value / r.logReading } : {}) }]
      : [],
  );
}

/** A log's offset hits from the check's own computation (snapshotEntry's byHit and verdicts). */
export function offsetHits(fx: LogFixture, byHit: EngineHits, verdicts: readonly HitVerdict[]): OffsetHit[] {
  const cls = new Map(verdicts.map((v) => [v.hit, v.kind === "match" ? v.class : v.kind]));
  return fx.hits.flatMap((h) => {
    const p = byHit.get(h)?.primary;
    const c = cls.get(h);
    return c !== undefined && countsForOffset(h, c, p) ? [{ operator: h.operator, ratio: h.value / p, value: h.value, mismatch: c === "mismatch" }] : [];
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
    const values = hs.flatMap((h) => (h.value !== undefined ? [h.value] : []));
    const flagged = hs.filter((h) => h.mismatch !== undefined);
    return {
      operator,
      n: hs.length,
      median: m,
      tight: hs.filter((h) => Math.abs(h.ratio / m - 1) <= OFFSET_SCREEN.tight).length / hs.length,
      ...(logs.length ? { logMedian: median(logs) } : {}),
      ...(values.length === hs.length ? { medianValue: median(values) } : {}),
      ...(flagged.length === hs.length ? { mismatched: flagged.filter((h) => h.mismatch).length } : {}),
    };
  });
}

/** Whether an offset is a fit-build candidate by the screen's thresholds. */
export function isOffsetCandidate(o: OperatorOffset): boolean {
  const off = Math.abs(o.median - 1);
  return o.n >= OFFSET_SCREEN.minHits && off >= OFFSET_SCREEN.minOff && o.tight >= OFFSET_SCREEN.minTight && (o.medianValue === undefined || off * o.medianValue >= OFFSET_SCREEN.minDamage);
}

/** One operator's (or one event's) factor interval: the factors that put every clean hit within ±1 of its log value. */
export interface FactorBound {
  readonly operator: string;
  /** null: every event of the operator together. */
  readonly event: string | null;
  readonly n: number;
  /** The interval every hit allows (null: empty, no one factor fits them all). */
  readonly bound: readonly [number, number] | null;
  /** The factor that fits most hits within ±1, and how many it fits (the best overlap of their intervals). */
  readonly best: { readonly factor: number; readonly fits: number };
}

/** The check's tolerance on a logged value (±1 damage: a value is the game's rounding of the exact one). */
export const BOUND_TOLERANCE = 1;

/** Per hit [lo, hi]: the factors f with |f × exact − value| ≤ BOUND_TOLERANCE. */
function hitInterval(value: number, exact: number): [number, number] {
  return [(value - BOUND_TOLERANCE) / exact, (value + BOUND_TOLERANCE) / exact];
}

/** The best overlap of intervals (a sweep over their ends): the point most intervals hold, and how many. */
function bestOverlap(intervals: readonly (readonly [number, number])[]): { factor: number; fits: number } {
  const ends = intervals.flatMap(([a, b]) => [{ x: a, d: 1 }, { x: b, d: -1 }]).sort((p, q) => p.x - q.x || q.d - p.d);
  let [cur, best, at] = [0, 0, 1];
  for (const [i, e] of ends.entries()) {
    cur += e.d;
    if (cur > best) {
      best = cur;
      const next = ends[i + 1];
      at = next ? (e.x + next.x) / 2 : e.x;
    }
  }
  return { factor: at, fits: best };
}

/**
 * `zmdlogs offsets --bound` (round 20, the build-fits report point 3: Snowshine's [0.96232, 0.96258] and Catcher's DEF
 * strikes [1.02649, 1.02786] came from a scratch script over `hits --json`): per operator and per event, the interval of
 * factors that put every clean hit (non-crit kit hits with a primary reading the verdict rests on: plain, assumed,
 * fallback, mismatch) within ±1 of its logged value, from the primary reading's unrounded damage; empty when no one
 * factor fits them all, with the factor that fits most. A build candidate is checked against one interval.
 */
export function factorBounds(records: readonly Pick<HitRecord, "operator" | "event" | "kind" | "value" | "crit" | "class" | "landing">[]): FactorBound[] {
  const clean = records.filter((r) => r.crit === false && r.kind === "skill" && COUNTED.has(r.class) && (r.landing?.exact ?? 0) > 0);
  const groups = new Map<string, { operator: string; event: string | null; iv: [number, number][] }>();
  for (const r of clean) {
    const iv = hitInterval(r.value, (r.landing as { exact: number }).exact);
    for (const event of [null, r.event]) {
      const k = `${r.operator}|${event ?? ""}`;
      const g = groups.get(k) ?? { operator: r.operator, event, iv: [] };
      g.iv.push(iv);
      groups.set(k, g);
    }
  }
  // Per operator (in order of first hit) its whole set, then its events by hit count.
  const order = [...new Set(clean.map((r) => r.operator))];
  const sorted = [...groups.values()].sort((a, b) => order.indexOf(a.operator) - order.indexOf(b.operator) || (a.event === null ? -1 : b.event === null ? 1 : b.iv.length - a.iv.length || a.event.localeCompare(b.event)));
  return sorted.map((g) => {
    const lo = Math.max(...g.iv.map((x) => x[0]));
    const hi = Math.min(...g.iv.map((x) => x[1]));
    return { operator: g.operator, event: g.event, n: g.iv.length, bound: lo <= hi ? ([lo, hi] as const) : null, best: bestOverlap(g.iv) };
  });
}

/** The `--bound` section: per operator its interval over every event, then each event's (events with `minHits` or fewer hits too). */
export function factorBoundLines(data: { readonly operators: Readonly<Record<string, { readonly name?: string } | undefined>> }, logs: readonly { readonly short: string; readonly bounds: readonly FactorBound[] }[], opts: { readonly operators?: readonly string[] } = {}): string[] {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const f5 = (x: number) => x.toFixed(5);
  const out = ["", `Factor bounds (--bound): per log and operator, then per event, the factors that put every clean hit (non-crit kit hits with a primary reading: plain, assumed, fallback, mismatch) within ±${BOUND_TOLERANCE} of its logged value, from the primary reading's unrounded damage; empty: no one factor, with the factor that fits most:`];
  for (const l of logs) {
    const mine = l.bounds.filter((b) => !opts.operators?.length || opts.operators.includes(b.operator));
    for (const b of mine) {
      const what = b.event === null ? `${l.short.padEnd(5)} ${name(b.operator)}` : `        ${b.event}`;
      const iv = b.bound ? `[${f5(b.bound[0])}, ${f5(b.bound[1])}]` : "empty";
      out.push(`  ${what}  n ${b.n}  ${iv}  best ×${f5(b.best.factor)} fits ${b.best.fits} of ${b.n}`);
    }
  }
  if (out.length === 2) out.push("  none");
  return out;
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

/** A stretch where every operator's hits sit at one ratio (factorStretches): a stage factor's evidence. */
export interface FactorStretch {
  readonly from: number;
  readonly to: number;
  /** The median logged ÷ reading of the hits at it. */
  readonly factor: number;
  readonly at: number;
  readonly inside: number;
  readonly operators: readonly string[];
}

/** How factorStretches reads a run: within `tol` of its first hit's ratio, up to `gap` hits off in a row, at least `min` hits from two operators, the ratio off 1 by `off`. */
export const FACTOR_STRETCH = { tol: 0.02, gap: 6, min: 12, off: 0.04 } as const;

/**
 * Runs of a fight's logged hits whose logged ÷ reading sits at one factor across operators (round 17, the Arcane
 * stage-factors report point 2: a stage's shield phases, 8915 ×0.5 / ×0.05 / ×0.2 and c6d8 ×0.1, were "out of scope"
 * for months; scripts/probes/stage/stage-factors.ts as a view). A hit's ratio is logged ÷ the nearer to it of its
 * primary and log readings; a run is FACTOR_STRETCH's. The check's readings carry the fixture's stageFactors, so a
 * stretch a fixture holds is gone: what is printed isn't in the fixture yet.
 */
export function factorStretches(records: readonly Pick<HitRecord, "t" | "operator" | "value" | "predicted" | "logReading">[]): FactorStretch[] {
  const ratio = (h: (typeof records)[number]): number | null => {
    const c = [h.predicted, h.logReading].filter((x): x is number => typeof x === "number" && x > 20);
    if (!c.length || h.value < 20) return null;
    return c.map((x) => h.value / x).sort((a, b) => Math.abs(Math.log(a)) - Math.abs(Math.log(b)))[0] ?? null;
  };
  const rs = [...records].sort((a, b) => a.t - b.t).flatMap((h) => {
    const r = ratio(h);
    return r === null ? [] : [{ h, r }];
  });
  const out: FactorStretch[] = [];
  let i = 0;
  while (i < rs.length) {
    const v = (rs[i] as (typeof rs)[number]).r;
    if (Math.abs(v - 1) < FACTOR_STRETCH.off) {
      i++;
      continue;
    }
    let [j, on, off, lastOn] = [i, 0, 0, i];
    const ops = new Set<string>();
    while (j < rs.length) {
      const x = rs[j] as (typeof rs)[number];
      if (Math.abs(x.r / v - 1) <= FACTOR_STRETCH.tol) {
        on++;
        lastOn = j;
        ops.add(x.h.operator);
        off = 0;
      } else if (++off > FACTOR_STRETCH.gap) break;
      j++;
    }
    if (on >= FACTOR_STRETCH.min && ops.size >= 2) {
      const [a, b] = [(rs[i] as (typeof rs)[number]).h.t, (rs[lastOn] as (typeof rs)[number]).h.t];
      const inside = rs.filter((x) => x.h.t >= a && x.h.t <= b);
      const at = inside.filter((x) => Math.abs(x.r / v - 1) <= FACTOR_STRETCH.tol).map((x) => x.r).sort((p, q) => p - q);
      out.push({ from: a, to: b, factor: at[Math.floor(at.length / 2)] as number, at: at.length, inside: inside.length, operators: [...ops] });
      i = lastOn + 1;
    } else i++;
  }
  return out;
}

/** `zmdlogs offsets`' closing section: each log's factor stretches (factorStretches), or that there are none. */
export function factorStretchLines(data: { readonly operators: Readonly<Record<string, { readonly name?: string } | undefined>> }, logs: readonly { readonly short: string; readonly stretches: readonly FactorStretch[] }[]): string[] {
  const rows = logs.flatMap((l) => l.stretches.map((st) => `  ${l.short.padEnd(5)} ${(st.from / 1000).toFixed(2)}–${(st.to / 1000).toFixed(2)} s  ×${st.factor.toFixed(4)}  ${st.at} of ${st.inside} hits at it  ${st.operators.map((o) => data.operators[o]?.name ?? o).join(", ")}`));
  return [
    "",
    `Fight-wide factors not in the fixtures (every operator's hits at one ratio, ≥ ${FACTOR_STRETCH.min} hits from two operators within ${100 * FACTOR_STRETCH.tol}%: a stage's shield or phase factor is the fixture's stageFactors, with this as its evidence: docs/design/data.md):`,
    ...(rows.length ? rows : ["  none"]),
  ];
}

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
 * first (`*`: a tight median off by OFFSET_SCREEN's share and damage, by mismatches), then by |median − 1| × tightness; `top` rows (0: every one). Each says
 * what accounts for it (a buildOverride, an OFFSETS_EXPLAINED entry) or that fit-build is the next step, and when most
 * of a log's operators are off together (a team-wide factor: a food, the stage).
 */
export function offsetsView(data: { readonly operators: Readonly<Record<string, { readonly name?: string } | undefined>> }, rows: readonly OffsetRow[], opts: { readonly top?: number; readonly operators?: readonly string[] } = {}): string {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const pct = (x: number) => `${x >= 1 ? "+" : ""}${(100 * (x - 1)).toFixed(1)}%`;
  const shown = rows.filter((r) => r.offset.n >= OFFSET_SCREEN.minHits && (!opts.operators?.length || opts.operators.includes(r.offset.operator)));
  // Candidates by the hits they cost (round 20: a 2% offset on a tight row costs as many as a 20% one), then by size.
  const score = (o: OperatorOffset) => (isOffsetCandidate(o) ? 10 + (o.mismatched ?? 0) / 1e4 : 0) + Math.abs(o.median - 1) * o.tight;
  const sorted = [...shown].sort((a, b) => score(b.offset) - score(a.offset) || a.short.localeCompare(b.short));
  const top = opts.top ?? 25;
  const teamOff = (short: string) => {
    const of = rows.filter((r) => r.short === short && r.offset.n >= OFFSET_SCREEN.minHits);
    const off = of.filter((r) => Math.abs(r.offset.median - 1) >= OFFSET_SCREEN.minOff && r.offset.tight >= OFFSET_SCREEN.minTight / 2);
    return of.length >= 2 && off.length >= Math.max(2, Math.ceil((of.length * 3) / 4)) ? ` (${off.length} of ${of.length} operators off: a team-wide factor? a food, the stage)` : "";
  };
  const out = [
    `Build offsets: per log and operator, the median of logged ÷ the primary reading over non-crit kit hits with a reading (n), and the share within ${100 * OFFSET_SCREEN.tight}% of it (tight); log: the same under the log's reading; mism: the counted hits that are mismatches. * a fit-build candidate (n ≥ ${OFFSET_SCREEN.minHits}, off ≥ ${100 * OFFSET_SCREEN.minOff}% and ≥ ${OFFSET_SCREEN.minDamage} on its median hit, tight ≥ ${100 * OFFSET_SCREEN.minTight}%; candidates by mism first): one factor on every hit (a food, a node, a weapon level); a loose median is timing or a stage.`,
    "  id    operator                    n   median   tight     log  mism",
  ];
  const lines = top > 0 ? sorted.slice(0, top) : sorted;
  for (const r of lines) {
    const o = r.offset;
    const cand = isOffsetCandidate(o);
    const overridden = (r.fx.buildOverrides ?? []).some((b) => b.operator === o.operator);
    const explained = OFFSETS_EXPLAINED[`${r.short} ${o.operator}`];
    const fits = r.fits?.length ? ` (its ATK fits ${r.fits.join(" or ")})` : "";
    const note = cand ? (overridden ? "  buildOverrides set (fit-build again?)" : explained !== undefined ? `  explained: ${explained}` : `  → zmdlogs fit-build ${r.short} --operator ${o.operator}${fits}`) : overridden ? "  (buildOverrides set)" : "";
    out.push(`${cand ? "*" : " "} ${r.short.padEnd(5)} ${name(o.operator).slice(0, 24).padEnd(24)} ${String(o.n).padStart(4)}  ${pct(o.median).padStart(7)}  ${`${(100 * o.tight).toFixed(0)}%`.padStart(5)}  ${o.logMedian !== undefined ? pct(o.logMedian).padStart(7) : "      -"}  ${o.mismatched !== undefined ? String(o.mismatched).padStart(4) : "   -"}${note}${cand ? teamOff(r.short) : ""}`);
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
