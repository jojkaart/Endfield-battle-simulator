// A worker thread of `efsim zmdlogs hits --workers n` (hitexport.ts exportHitsParallel): loads the game data once,
// then turns each fixture it's sent into hit records.

import { parentPort } from "node:worker_threads";
import { loadGameData } from "@efsim/data";
import { filterRecords, hitRecords } from "./hitexport.ts";
import { readLogFixture } from "./logs.ts";

const data = loadGameData();
parentPort?.on("message", (m: { file: string; kind?: string; operators?: string[] }) => {
  try {
    parentPort?.postMessage({ file: m.file, records: filterRecords(hitRecords(data, readLogFixture(m.file), m.file), { ...(m.kind !== undefined ? { kind: m.kind } : {}), ...(m.operators ? { operators: m.operators } : {}) }) });
  } catch (e) {
    parentPort?.postMessage({ file: m.file, error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) });
  }
});
