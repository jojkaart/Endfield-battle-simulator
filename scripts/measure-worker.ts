// A worker thread of scripts/measure.ts: loads one checkout's code (the working tree's, or an at-commit worktree's:
// `workerData.tree`) and its game data once, then answers each fixture it's sent with what the log verdict snapshots
// record of it (the same computation as tests/logs.test.ts and tests/slow/pending.ts), or with a signature of its
// placed casts (for --changed placement).
//
// The tree's packages are imported by path, so a commit from before this script existed can be measured too (any
// commit with packages/logs, 2026-11-16 on).

import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";

export interface MeasureJob {
  readonly key: string;
  /** A snapshot entry, a placement signature, or the negative control (a verified log scaled ×0.97 and ×1.03: tests/slow/negative-control.test.ts). */
  readonly what: "entry" | "placement" | "negative";
  /** With the negative control: the factors to scale by. */
  readonly factors?: readonly number[];
  /** With an entry: each hit's verdict too (measure --hits); with a placement: its casts (--changed placement). Never asked for a hold-out. */
  readonly hits?: boolean;
  /**
   * Where to read the fixture (an absolute fixtures/ directory) when not the code tree's own: a log new since the
   * reference (or --base) commit is read from the measured tree, so the older code measures the same file.
   */
  readonly fixtures?: string;
}
/**
 * One hit's verdict for measure --hits: time (s), operator, event, verdict count (plain, mismatch, ...), logged ÷
 * primary, and the primary reading's modifiers at the landing ("<kit buff or source> <zone> <value>", sorted; absent
 * where the commit's code can't say), so a changed verdict names the buffs that moved at it (rossi-gilberta report
 * point 1: a scratch hitdiff.py did this).
 */
export type HitRow = readonly [t: number, operator: string, event: string, verdict: string, ratio: number | null, modifiers?: readonly string[]];
/** A log's per-hit fit: over every logged hit with a primary reading, how many and the mean |logged ÷ primary − 1|. */
export interface PerHit {
  readonly n: number;
  readonly meanAbs: number;
}
export type MeasureAnswer =
  | { readonly key: string; readonly entry: Record<string, Record<string, number | null>>; readonly perHit?: PerHit; readonly hits?: readonly HitRow[]; readonly seconds: number }
  | { readonly key: string; readonly placement: string; readonly casts?: readonly string[]; readonly seconds: number }
  | { readonly key: string; readonly negative: readonly NegativeCount[]; readonly seconds: number }
  | { readonly key: string; readonly error: string };
/** The negative control's count for one factor: chance matches among the judged hits (the test's own counting). */
export interface NegativeCount {
  readonly factor: number;
  readonly matches: number;
  readonly judged: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the tree's own modules, of whatever commit: typed loosely */
const { tree, assume } = workerData as { tree: string; assume?: Record<string, string> };
const logs: any = await import(pathToFileURL(join(tree, "packages/logs/src/index.ts")).href);
const dataPkg: any = await import(pathToFileURL(join(tree, "packages/data/src/index.ts")).href);
const data = dataPkg.loadGameData();
const under = assume && Object.keys(assume).length ? { assume } : undefined;
if (under) {
  // Older commits' replays take no readings: refuse rather than measure the defaults under another name.
  const engine: any = await import(pathToFileURL(join(tree, "packages/engine/src/index.ts")).href);
  if (typeof engine.allAssumptions !== "function") throw new Error("--assume: this commit's engine has no assumption registry (timeline/assumptions.ts)");
  const known = engine.allAssumptions(data) as { id: string; readings: Record<string, string> }[];
  for (const [id, r] of Object.entries(under.assume)) if (!known.some((a) => a.id === id && r in a.readings)) throw new Error(`--assume ${id}=${r}: no such reading (${known.map((a) => a.id).join(", ")})`);
}

function entryOf(fx: any, withHits = false): { entry: Record<string, Record<string, number | null>>; perHit: PerHit; hits?: HitRow[] } {
  // The snapshots' own computation (packages/logs/src/snapshotentry.ts) where the commit has it; before it, its five calls.
  const own = typeof logs.snapshotEntry === "function" ? logs.snapshotEntry(data, fx, under ?? {}) : undefined;
  const replay = own?.replay ?? (under ? logs.logBuffReplay(data, fx, logs.placeHits(data, fx), under) : logs.logBuffReplay(data, fx));
  const byHit = own?.byHit ?? logs.engineHits(data, fx, replay);
  const verdicts = own?.verdicts ?? logs.checkLog(data, fx, { replay, engineHits: byHit });
  const counts = own?.counts ?? logs.verdictCounts(fx, verdicts);
  const totals = own?.totals ?? logs.engineReport(data, fx, replay, byHit, verdicts).errors;
  // Not in the snapshots: what measure's "mixed" lines add (did the hits get closer while a signed total drifted?).
  const errors = (fx.hits as any[]).flatMap((h) => {
    const p = byHit.get(h)?.primary;
    return typeof p === "number" && p > 0 ? [Math.abs(h.value / p - 1)] : [];
  });
  const perHit = { n: errors.length, meanAbs: errors.length ? errors.reduce((s, x) => s + x, 0) / errors.length : 0 };
  if (!withHits) return { entry: { ...counts, totals }, perHit };
  // The primary reading's modifiers at each landing, where the commit's code has the calls (round 3 on).
  const modsOf = modifiersAt(fx, replay);
  // The verdicts are in fx.hits' order (checkLog maps over them).
  const hits = (verdicts as any[]).map((v): HitRow => {
    const p = byHit.get(v.hit)?.primary;
    const mods = modsOf(v.hit);
    const [t, op, event, verdict, ratio] = [v.hit.t, v.hit.operator, v.hit.event, v.kind === "match" ? v.class : v.kind, typeof p === "number" && p > 0 ? v.hit.value / p : null];
    return mods ? [t, op, event, verdict, ratio, mods] : [t, op, event, verdict, ratio];
  });
  return { entry: { ...counts, totals }, perHit, hits };
}

/** A hit's primary reading's modifiers (HitRow), or null where the tree's code lacks the calls or the hit has no landing. */
function modifiersAt(fx: any, replay: any): (hit: any) => string[] | null {
  if (typeof logs.engineCheck !== "function" || typeof logs.readingBasis !== "function" || typeof logs.hitPlace !== "function") return () => null;
  const placement = logs.placeHits(data, fx);
  const c = logs.engineCheck(data, fx, replay.replay);
  return (hit) => {
    try {
      const basis = logs.readingBasis(c, hit, logs.hitPlace(data, fx, placement, replay, hit));
      if (!basis || "unknown" in basis.landing) return null;
      return ((basis.primary.options.modifiers ?? []) as any[]).map((m) => `${m.kitBuff ? `${m.kitBuff.owner}:${m.kitBuff.id}` : m.source} ${m.zone} ${Number(m.value.toFixed(4))}`).sort();
    } catch {
      return null;
    }
  };
}

function placementOf(fx: any, withCasts = false): { placement: string; casts?: string[] } {
  const p = logs.placeHits(data, fx);
  const casts = logs.distinctCasts(p).map((c: any) => [c.operator, c.skillId, c.start]);
  const hits = fx.hits.map((h: any) => {
    const x = p.hits.get(h);
    return x ? [x.cast.start, x.cast.skillId, x.index, x.frame ?? null] : null;
  });
  const placement = createHash("sha1").update(JSON.stringify([casts, hits])).digest("hex");
  // A cast as measure prints a moved one: start (s), operator, skill.
  return withCasts ? { placement, casts: casts.map(([op, skill, start]: [string, string, number]) => `${(start / 1000).toFixed(2)} s ${op} ${skill}`) } : { placement };
}
/**
 * The negative control on one log (tests/slow/negative-control.test.ts, the same counting): every logged value scaled
 * by each factor, the matches that are left (a recording buff's burst aside), out of the judged hits.
 */
function negativeOf(fx: any, factors: readonly number[]): NegativeCount[] {
  return factors.map((k) => {
    const scaled = { ...fx, hits: fx.hits.map((h: any) => ({ ...h, value: Math.round(h.value * k), ...(h.uncapped !== undefined ? { uncapped: Math.round(h.uncapped * k) } : {}) })) };
    // Under the run's readings where the commit has snapshotEntry (the entries' own computation), else the test's call.
    const verdicts = (typeof logs.snapshotEntry === "function" ? logs.snapshotEntry(data, scaled, under ?? {}).verdicts : logs.checkLog(data, scaled)) as any[];
    const kept = verdicts.filter((v) => !(v.kind === "match" && (v.assumptions ?? []).some((a: any) => a.kind === "recordEnd")));
    const judged = kept.filter((v) => v.kind !== "uncovered" && !(v.kind === "unquantified" && v.reason !== "corrosion")).length;
    return { factor: k, matches: kept.filter((v) => v.kind === "match").length, judged };
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

parentPort?.on("message", (job: MeasureJob) => {
  const start = performance.now();
  try {
    const fx = logs.readLogFixture(join(job.fixtures ?? join(tree, "fixtures"), job.key));
    const seconds = () => (performance.now() - start) / 1000;
    if (job.what === "negative") parentPort?.postMessage({ key: job.key, negative: negativeOf(fx, job.factors ?? [0.97, 1.03]), seconds: seconds() });
    else parentPort?.postMessage(job.what === "entry" ? { key: job.key, ...entryOf(fx, job.hits === true), seconds: seconds() } : { key: job.key, ...placementOf(fx, job.hits === true), seconds: seconds() });
  } catch (e) {
    parentPort?.postMessage({ key: job.key, error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) });
  }
});
parentPort?.postMessage({ ready: true });
