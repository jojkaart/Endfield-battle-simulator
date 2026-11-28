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
import { codeErrors } from "./code-errors.ts";

export interface MeasureJob {
  readonly key: string;
  /** A snapshot entry, a placement signature, or the negative control (a verified log scaled ×0.97 and ×1.03: tests/slow/negative-control.test.ts). */
  readonly what: "entry" | "placement" | "negative" | "identity" | "data";
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
 * point 1: a scratch hitdiff.py did this). Then the replay's landing it is paired with (`<frame> <skill> <hit>`), or
 * `NOLAND <reason>[: <the step that dropped it>]` (the replay view's NOLAND text) where it has none, absent where the
 * commit's code can't say: a changed hit says whether its landing went missing and why, or moved to another logged hit
 * (round 23, the combo-hold report point 1: a reading that only moves what the replay doesn't pin read as a wrong one).
 */
export type HitRow = readonly [t: number, operator: string, event: string, verdict: string, ratio: number | null, modifiers?: readonly string[] | undefined, landing?: string];
/**
 * One 0.512 s unit of the fight's placed hidden holds (BuffReplay.hiddenHolds, `zmdlogs holds`' unit lines): where the
 * placement puts it and its earliest and latest time (ms). measure --hits compares them, so a worse log that moved
 * because the holds were placed again says so in one line (stop-lists report point 4).
 */
export interface HoldUnit {
  readonly mid: number;
  readonly early: number;
  readonly late: number;
  /**
   * The bounds that set its earliest and latest time (holds.ts holdPins: the clocks a unit's move comes from; tags as
   * `zmdlogs holds --verbose` prints them), where the commit's code has them (round 15, low-plain report point 3: a
   * cascade through the placement took three views to trace to the clock that moved it).
   */
  readonly earlyBy?: readonly string[];
  readonly lateBy?: readonly string[];
}
/** A log's per-hit fit: over every logged hit with a primary reading, how many and the mean |logged ÷ primary − 1|. */
export interface PerHit {
  readonly n: number;
  readonly meanAbs: number;
}
export type MeasureAnswer =
  | {
      readonly key: string;
      readonly entry: Record<string, Record<string, number | null>>;
      readonly perHit?: PerHit;
      readonly hits?: readonly HitRow[];
      /** With hits: the placed hidden holds' units (absent where the commit's replay places none). */
      readonly holds?: readonly HoldUnit[];
      /** The log lists effects but none with `since` and `source` (imported before 2026-11-16): a change resting on the lanes can't move it. */
      readonly untimed?: boolean;
      /** The totals' error by where it lives (TotalsShares; where the commit's code has snapshotEntry's `shares`): measure's aggregates, hold-outs only in them. */
      readonly shares?: Shares;
      /**
       * The replay's decision lines counted by kind (packages/logs decisionsview.ts replayDecisions: SKIP, TAILCUT,
       * JUMPDROP, …; where the commit's code has them): a hold-out's only trace of which replay rule acted there, as
       * net changes summed over the moved hold-outs (round 18, the placement-cases report point 2). Kinds and counts only.
       */
      readonly decisions?: Readonly<Record<string, number>>;
      /**
       * The replay's cast errors that are code errors (scripts/code-errors.ts: a ReferenceError, a TypeError), absent
       * where none: a split part that threw is "not measured alone", not a −100% (round 21). Identifiers only.
       */
      readonly threw?: readonly string[];
      readonly seconds: number;
    }
  | { readonly key: string; readonly placement: string; readonly casts?: readonly string[]; readonly seconds: number }
  | { readonly key: string; readonly negative: readonly NegativeCount[]; readonly seconds: number }
  /** scripts/identity.ts: a hash per part of the log's replay record and placement (or of the compiled data: key "data"). */
  | { readonly key: string; readonly identity: Readonly<Record<string, string>>; readonly seconds: number }
  | { readonly key: string; readonly error: string };
/** A fight's TotalsShares (packages/logs enginecheck.ts), as far as measure reads them. */
export interface Shares {
  readonly error: number;
  readonly matched: number;
  readonly replayOnly: number;
  readonly logOnly: number;
  /** The one-sided landings by kind (TotalsShares.kinds, where the commit's code has them): never their operators or keys. */
  readonly kinds?: readonly ShareKind[];
}
/** One kind of one-sided landings' share of a fight's logged total (packages/logs onesided.ts KindShare, as measure reads it). */
export interface ShareKind {
  readonly context: string;
  readonly nature: string;
  readonly skill: string;
  readonly replay: number;
  readonly log: number;
}
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
  if (typeof engine.allAssumptions !== "function") throw new Error("--assume: this commit's engine has no assumption registry (packages/engine/src/assumptions.ts)");
  const known = engine.allAssumptions(data) as { id: string; readings: Record<string, string> }[];
  for (const [id, r] of Object.entries(under.assume)) if (!known.some((a) => a.id === id && r in a.readings)) throw new Error(`--assume ${id}=${r}: no such reading (${known.map((a) => a.id).join(", ")})`);
}

/** The replay's decision lines by kind (MeasureAnswer.decisions), or undefined where the commit's code lacks them. */
function decisionsOf(fx: any, replay: any): Record<string, number> | undefined {
  if (typeof logs.replayDecisions !== "function" || !replay?.replay) return undefined;
  const out: Record<string, number> = {};
  for (const d of logs.replayDecisions(data, replay.replay, fx) as { kind: string }[]) out[d.kind] = (out[d.kind] ?? 0) + 1;
  return out;
}

function entryOf(fx: any, withHits = false): { entry: Record<string, Record<string, number | null>>; perHit: PerHit; hits?: HitRow[]; holds?: HoldUnit[]; shares?: Shares; decisions?: Record<string, number> } {
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
  const shares = sharesOf(fx, own, replay, byHit, verdicts);
  const decisions = decisionsOf(fx, replay);
  const threw = codeErrors(((replay?.replay?.failed ?? []) as { error?: unknown }[]).map((f) => String(f.error ?? "")));
  const extra = { ...(shares ? { shares } : {}), ...(decisions ? { decisions } : {}), ...(threw.length ? { threw } : {}) };
  if (!withHits) return { entry: { ...counts, totals }, perHit, ...extra };
  // The primary reading's modifiers at each landing, where the commit's code has the calls (round 3 on).
  const modsOf = modifiersAt(fx, replay);
  const landingOf = landingsAt(fx, replay);
  // The verdicts are in fx.hits' order (checkLog maps over them).
  const hits = (verdicts as any[]).map((v): HitRow => {
    const p = byHit.get(v.hit)?.primary;
    const mods = modsOf(v.hit);
    const landing = landingOf(v.hit);
    const [t, op, event, verdict, ratio] = [v.hit.t, v.hit.operator, v.hit.event, v.kind === "match" ? v.class : v.kind, typeof p === "number" && p > 0 ? v.hit.value / p : null];
    if (landing !== null) return [t, op, event, verdict, ratio, mods ?? undefined, landing];
    return mods ? [t, op, event, verdict, ratio, mods] : [t, op, event, verdict, ratio];
  });
  const holds = holdUnits(replay.replay?.hiddenHolds);
  return { entry: { ...counts, totals }, perHit, hits, ...(holds ? { holds } : {}), ...extra };
}

/** The placed holds' units (views.ts holdsView's unit lines: the clocks' earliest, latest and midpoint at each 0.512 s of hold). */
function holdUnits(h: any): HoldUnit[] | undefined {
  if (!h || !Array.isArray(h.times) || !h.times.length) return undefined;
  const reaches = (P: readonly number[], m: number) => {
    const i = P.findIndex((x) => x >= m - 1e-6);
    if (i <= 0) return h.times[0] as number;
    const [t0, t1, p0, p1] = [h.times[i - 1], h.times[i], P[i - 1] as number, P[i] as number];
    return p1 === p0 ? t1 : t0 + ((m - p0) / (p1 - p0)) * (t1 - t0);
  };
  // The bounds pinning each unit, as holdsView's --verbose (the node before the one the earliest reaches it at; the one the latest does).
  const pins = (node: number, side: "early" | "late"): string[] | undefined => {
    if (typeof logs.holdPins !== "function" || node < 0 || !Array.isArray(h.earlyFrom)) return undefined;
    const p = logs.holdPins(h, node, side);
    return [...(p.total ? ["the least total"] : []), ...p.bounds.map((b: any) => String(b.tag))];
  };
  const out: HoldUnit[] = [];
  for (let m = 256; m < h.total; m += 512) {
    const [i, j] = [(h.early as number[]).findIndex((x) => x >= m - 1e-6), (h.late as number[]).findIndex((x) => x >= m - 1e-6)];
    const [earlyBy, lateBy] = [pins(i - 1, "early"), pins(j, "late")];
    out.push({ mid: reaches(h.mid, m), early: reaches(h.early, m), late: reaches(h.late, m), ...(earlyBy ? { earlyBy } : {}), ...(lateBy ? { lateBy } : {}) });
  }
  return out;
}

/**
 * A fight's Shares: snapshotEntry's where the commit has them, else from its engine report's parts (fightTotals'
 * TotalPart, 2026-11-23 on; the same sums as enginecheck.ts totalsShares), so a --base before them has a side too.
 */
function sharesOf(fx: any, own: any, replay: any, byHit: any, verdicts: any): Shares | undefined {
  const pick = (x: any): Shares => ({
    error: x.error, matched: x.matched, replayOnly: x.replayOnly, logOnly: x.logOnly,
    ...(Array.isArray(x.kinds) ? { kinds: (x.kinds as any[]).map((k): ShareKind => ({ context: k.context, nature: k.nature, skill: k.skill, replay: k.replay, log: k.log })) } : {}),
  });
  if (own?.shares) return pick(own.shares);
  const t = logs.engineReport(data, fx, replay, byHit, verdicts).totals;
  if (!t?.parts) return undefined;
  const L = t.logged.damage as number;
  let matched = 0;
  let replayOnly = 0;
  const counted = new Set<any>();
  for (const p of t.parts as any[]) {
    if (p.logged) {
      matched += p.damage - (counted.has(p.logged) ? 0 : p.logged.value);
      counted.add(p.logged);
    } else replayOnly += p.damage;
  }
  const logOnly = -(fx.hits as any[]).filter((h) => !counted.has(h)).reduce((a, h) => a + h.value, 0);
  const pct = (x: number) => (L === 0 ? 0 : (100 * x) / L);
  return pick({ error: pct(t.simulated.damage - L), matched: pct(matched), replayOnly: pct(replayOnly), logOnly: pct(logOnly) });
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

/**
 * Each logged hit's landing in the replay as HitRow's seventh part (`<frame> <skill> <hit>`, or `NOLAND <reason>[: <the
 * dropping step>]`), or null where the commit's code lacks the calls (decisionsview.ts landingsOf, droppedLanding).
 */
function landingsAt(fx: any, replay: any): (hit: any) => string | null {
  const r = replay?.replay;
  if (typeof logs.landingsOf !== "function" || !r || typeof r.droppedLanding !== "function") return () => null;
  const { byLanding, missing } = logs.landingsOf(r, fx) as { byLanding: Map<any, any>; missing: Map<any, string> };
  const of = new Map<any, string>();
  for (const [l, h] of byLanding) of.set(h, `${l.frame} ${l.skillId} ${l.hitId}`);
  return (hit) => {
    const at = of.get(hit);
    if (at !== undefined) return at;
    const why = missing.get(hit);
    if (why === undefined) return null;
    const drop = r.droppedLanding(hit) as string | null;
    return `NOLAND ${why}${drop ? `: ${drop}` : ""}`;
  };
}

/** Whether a log lists effects but none with `since` and `source` (MeasureAnswer `untimed`). */
function untimed(fx: any): boolean {
  const effects = (fx.hits as any[]).flatMap((h) => [...(h.effects ?? []), ...(h.boundaryEffects ?? [])]);
  return effects.length > 0 && !effects.some((e) => e.since !== undefined && e.source !== undefined);
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
const sha = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex");

/**
 * scripts/identity.ts (round 22, round 21's own report point 1): a move's identity check without the snapshots. Per
 * part of the default replay's record: the placement (placeHits' casts and each hit's cast, slot and frame), the casts
 * made, the tail cuts, the landings (frame, operator, skill, hit, ref, exact damage, target), the status record, the
 * applied slow-downs, the hidden holds and what failed. A part the commit's code lacks hashes as "absent".
 */
function identityOf(fx: any): Record<string, string> {
  const p = logs.placeHits(data, fx);
  const { replay } = logs.logBuffReplay(data, fx, p);
  const part = (f: () => unknown) => {
    try {
      const v = f();
      return v === undefined ? "absent" : sha(v);
    } catch (e) {
      return `threw ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`;
    }
  };
  return {
    placement: placementOf(fx).placement,
    made: part(() => (replay.made as any[] | undefined)?.map((m) => [m.cast?.operator, m.cast?.skillId, m.cast?.start, m.skillId ?? m.made ?? null, m.frame ?? null])),
    cuts: part(() => (replay.tailCuts as any[] | undefined)?.map((c) => [c.cast?.operator, c.cast?.skillId, c.cast?.start, c.frame])),
    hits: part(() => (replay.hits as any[]).map((h) => [h.frame, h.operator, h.skillId, h.hitId, h.ref ?? null, h.exact, h.target ?? null])),
    statuses: part(() => replay.reactions),
    stops: part(() => replay.appliedStops),
    holds: part(() => replay.hiddenHolds?.holds),
    failed: part(() => (replay.failed as any[] | undefined)?.map((f) => String(f.error))),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

parentPort?.on("message", (job: MeasureJob) => {
  const start = performance.now();
  if (job.what === "data") {
    parentPort?.postMessage({ key: job.key, identity: { data: sha(data) }, seconds: (performance.now() - start) / 1000 });
    return;
  }
  try {
    const fx = logs.readLogFixture(join(job.fixtures ?? join(tree, "fixtures"), job.key));
    const seconds = () => (performance.now() - start) / 1000;
    if (job.what === "negative") parentPort?.postMessage({ key: job.key, negative: negativeOf(fx, job.factors ?? [0.97, 1.03]), seconds: seconds() });
    else if (job.what === "identity") parentPort?.postMessage({ key: job.key, identity: identityOf(fx), seconds: seconds() });
    else parentPort?.postMessage(job.what === "entry" ? { key: job.key, ...entryOf(fx, job.hits === true), ...(untimed(fx) ? { untimed: true } : {}), seconds: seconds() } : { key: job.key, ...placementOf(fx, job.hits === true), seconds: seconds() });
  } catch (e) {
    parentPort?.postMessage({ key: job.key, error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) });
  }
});
parentPort?.postMessage({ ready: true });
