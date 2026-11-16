// A worker thread for rule runs (rulespool.ts): loads the game data once, then plays each job it's sent.

import { parentPort } from "node:worker_threads";
import { loadGameData } from "@efsim/data";
import { runRulesJob, type RulesJob } from "./rulespool.ts";

const data = loadGameData();
parentPort?.on("message", (m: { id: number; job: RulesJob }) => {
  try {
    parentPort?.postMessage({ id: m.id, result: runRulesJob(data, m.job) });
  } catch (e) {
    parentPort?.postMessage({ id: m.id, error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) });
  }
});
