// A worker thread of `efsim zmdlogs hits --workers n` (hitexport.ts exportHitsParallel) and `zmdlogs totals --all`
// (reports.ts totalsAllReport): loads the game data once, then turns each fixture it's sent into hit records, or into
// its totals' shares and one-sided landings (`shares`).

import { parentPort } from "node:worker_threads";
import { loadGameData } from "@efsim/data";
import { filterRecords, hitRecords } from "./hitexport.ts";
import { readLogFixture } from "./logs.ts";
import { snapshotEntry } from "./snapshotentry.ts";

const data = loadGameData();
parentPort?.on("message", (m: { file: string; kind?: string; operators?: string[]; assume?: Record<string, string>; shares?: boolean }) => {
  try {
    if (m.shares) {
      const e = snapshotEntry(data, readLogFixture(m.file), m.assume ? { assume: m.assume } : {});
      parentPort?.postMessage({ file: m.file, shares: e.shares, oneSided: e.oneSided });
      return;
    }
    parentPort?.postMessage({ file: m.file, records: filterRecords(hitRecords(data, readLogFixture(m.file), m.file, m.assume ?? {}), { ...(m.kind !== undefined ? { kind: m.kind } : {}), ...(m.operators ? { operators: m.operators } : {}) }) });
  } catch (e) {
    parentPort?.postMessage({ file: m.file, error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) });
  }
});
