// Rule-list runs for efsim diagnose and efsim gear --rules (docs/design.md "Rule-based rotations"): one run is
// playRules (with its diagnosis when asked) on a scenario whose team may wear probe pieces (synthetic gear with one
// stat line: the marginal values); many runs go to worker threads, each loading the game data once.

import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { diagnoseRules, playRules, type DamageMoments, type GameData, type GearData, type PolicyDiagnosis, type PolicyOptions, type RuleList, type TimelineScenario } from "@efsim/engine";

export interface RulesJob {
  readonly scenario: Omit<TimelineScenario, "rotation">;
  readonly list: RuleList;
  readonly options: Omit<PolicyOptions, "observer">;
  /** Synthetic gear pieces the team may wear (probes), added to the game data for this run. */
  readonly probes?: Readonly<Record<string, GearData>>;
  readonly diagnose?: boolean;
}

export interface RulesResult {
  readonly sustainedDps: number;
  readonly moments: DamageMoments;
  readonly perOperator: Readonly<Record<string, number>>;
  readonly fired: readonly number[];
  readonly diagnosis?: PolicyDiagnosis;
}

const withProbes = new WeakMap<GameData, Map<string, GameData>>();

/** The game data with the probe pieces added (cached per probe set, so contexts built on it are reused). */
function dataWith(data: GameData, probes: Readonly<Record<string, GearData>> | undefined): GameData {
  if (!probes || Object.keys(probes).length === 0) return data;
  const key = JSON.stringify(probes);
  let m = withProbes.get(data);
  if (!m) withProbes.set(data, (m = new Map()));
  let d = m.get(key);
  if (!d) m.set(key, (d = { ...data, gear: { ...data.gear, ...probes } }));
  return d;
}

/** One run, here. */
export function runRulesJob(data: GameData, job: RulesJob): RulesResult {
  const d = dataWith(data, job.probes);
  if (job.diagnose) {
    const { run, diagnosis } = diagnoseRules(d, job.scenario, job.list, job.options);
    return { sustainedDps: run.sustainedDps, moments: run.sustainedMoments, perOperator: run.perOperator, fired: run.fired, diagnosis };
  }
  const run = playRules(d, job.scenario, job.list, job.options);
  return { sustainedDps: run.sustainedDps, moments: run.sustainedMoments, perOperator: run.perOperator, fired: run.fired };
}

/** Worker threads for rule runs (default: the machine's cores less one, at least 1; 1: every run here, no threads). */
export function defaultWorkers(): number {
  return Math.max(1, availableParallelism() - 1);
}

/**
 * Runs the jobs, in order of the results; with `workers` > 1 on that many threads (each loads the game data: ~15 s,
 * worth it from a few dozen runs on).
 */
export async function runRulesJobs(data: GameData, jobs: readonly RulesJob[], workers = 1, progress?: (done: number, of: number) => void): Promise<RulesResult[]> {
  const out: RulesResult[] = new Array(jobs.length);
  if (workers <= 1 || jobs.length <= 1) {
    jobs.forEach((j, i) => {
      out[i] = runRulesJob(data, j);
      progress?.(i + 1, jobs.length);
    });
    return out;
  }
  let next = 0;
  let done = 0;
  const n = Math.min(workers, jobs.length);
  await Promise.all(
    Array.from({ length: n }, () =>
      new Promise<void>((resolve, reject) => {
        const w = new Worker(new URL("./rulesworker.ts", import.meta.url));
        const feed = () => {
          if (next >= jobs.length) {
            void w.terminate().then(() => resolve());
            return;
          }
          const id = next++;
          w.postMessage({ id, job: jobs[id] });
        };
        w.on("message", (m: { id: number; result?: RulesResult; error?: string }) => {
          if (m.error !== undefined) {
            void w.terminate();
            reject(new Error(m.error));
            return;
          }
          out[m.id] = m.result as RulesResult;
          done++;
          progress?.(done, jobs.length);
          feed();
        });
        w.on("error", reject);
        feed();
      }),
    ),
  );
  return out;
}
