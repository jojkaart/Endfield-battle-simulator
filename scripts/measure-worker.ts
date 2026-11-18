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
  readonly what: "entry" | "placement";
}
export type MeasureAnswer =
  | { readonly key: string; readonly entry: Record<string, Record<string, number | null>>; readonly seconds: number }
  | { readonly key: string; readonly placement: string; readonly seconds: number }
  | { readonly key: string; readonly error: string };

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

function entryOf(fx: any): Record<string, Record<string, number | null>> {
  const replay = under ? logs.logBuffReplay(data, fx, logs.placeHits(data, fx), under) : logs.logBuffReplay(data, fx);
  const byHit = logs.engineHits(data, fx, replay);
  const verdicts = logs.checkLog(data, fx, { replay, engineHits: byHit });
  const counts = logs.verdictCounts(fx, verdicts);
  const totals = logs.engineReport(data, fx, replay, byHit, verdicts).errors;
  return { ...counts, totals };
}

function placementOf(fx: any): string {
  const p = logs.placeHits(data, fx);
  const casts = logs.distinctCasts(p).map((c: any) => [c.operator, c.skillId, c.start]);
  const hits = fx.hits.map((h: any) => {
    const x = p.hits.get(h);
    return x ? [x.cast.start, x.cast.skillId, x.index, x.frame ?? null] : null;
  });
  return createHash("sha1").update(JSON.stringify([casts, hits])).digest("hex");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

parentPort?.on("message", (job: MeasureJob) => {
  const start = performance.now();
  try {
    const fx = logs.readLogFixture(join(tree, "fixtures", job.key));
    const seconds = () => (performance.now() - start) / 1000;
    parentPort?.postMessage(job.what === "entry" ? { key: job.key, entry: entryOf(fx), seconds: seconds() } : { key: job.key, placement: placementOf(fx), seconds: seconds() });
  } catch (e) {
    parentPort?.postMessage({ key: job.key, error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) });
  }
});
parentPort?.postMessage({ ready: true });
