// A worker thread for rule runs (rulespool.ts): loads the game data once (with the command's --kit files), then plays
// each job it's sent.

import { parentPort, workerData } from "node:worker_threads";
import { loadGameData, withKitFiles } from "@efsim/data";
import { runRulesJob, type RulesJob } from "./rulespool.ts";

// With the command's --kit files (rulespool.ts setWorkerKitFiles), as the main thread's data has them.
const data = withKitFiles(loadGameData(), (workerData as { kitFiles?: readonly string[] } | undefined)?.kitFiles ?? []);
parentPort?.on("message", (m: { id: number; job: RulesJob }) => {
  try {
    parentPort?.postMessage({ id: m.id, result: runRulesJob(data, m.job) });
  } catch (e) {
    parentPort?.postMessage({ id: m.id, error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) });
  }
});
