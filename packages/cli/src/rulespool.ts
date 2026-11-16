// Rule-list runs for efsim diagnose and efsim gear --rules (docs/design.md "Rule-based rotations"): one run is
// playRules (with its diagnosis when asked) on a scenario whose team may wear probe pieces (synthetic gear with one
// stat line: the marginal values); many runs go to worker threads, each loading the game data once.

import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { diagnoseRules, guideRules, playRules, type DamageMoments, type GameData, type GearData, type GuideRun, type PolicyDiagnosis, type PolicyOptions, type RuleList, type TimelineScenario } from "@efsim/engine";

export interface RulesJob {
  readonly scenario: Omit<TimelineScenario, "rotation">;
  readonly list: RuleList;
  readonly options: Omit<PolicyOptions, "observer">;
  /** Synthetic gear pieces the team may wear (probes), added to the game data for this run. */
  readonly probes?: Readonly<Record<string, GearData>>;
  readonly diagnose?: boolean;
  /** The guided search's analysis of the run (engine policyguide.ts guideRules). */
  readonly guide?: boolean;
}

export interface RulesResult {
  readonly sustainedDps: number;
  readonly moments: DamageMoments;
  readonly perOperator: Readonly<Record<string, number>>;
  readonly fired: readonly number[];
  readonly diagnosis?: PolicyDiagnosis;
  readonly guide?: GuideRun;
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
  if (job.guide) {
    const { run, guide } = guideRules(d, job.scenario, job.list, job.options);
    return { sustainedDps: run.sustainedDps, moments: run.sustainedMoments, perOperator: run.perOperator, fired: run.fired, guide };
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

/** Worker threads kept alive across batches of runs (each loads the game data once): the guided search's many small batches. */
export interface RulesPool {
  readonly workers: number;
  readonly run: (jobs: readonly RulesJob[], progress?: (done: number, of: number) => void) => Promise<RulesResult[]>;
  readonly close: () => Promise<void>;
}

/** A pool of `workers` threads (1: every run here, no threads). One batch at a time. */
export function openRulesPool(data: GameData, workers = defaultWorkers()): RulesPool {
  if (workers <= 1) return { workers: 1, run: (jobs, progress) => runRulesJobs(data, jobs, 1, progress), close: () => Promise.resolve() };
  const threads = Array.from({ length: workers }, () => new Worker(new URL("./rulesworker.ts", import.meta.url)));
  let busy = false;
  // Each batch's job IDs carry its number: a worker still busy with a failed batch's job answers it later, ignored.
  let batches = 0;
  const run = (jobs: readonly RulesJob[], progress?: (done: number, of: number) => void): Promise<RulesResult[]> => {
    if (busy) return Promise.reject(new Error("the pool runs one batch at a time"));
    const out: RulesResult[] = new Array(jobs.length);
    if (jobs.length === 0) return Promise.resolve(out);
    busy = true;
    const batch = ++batches;
    return new Promise<RulesResult[]>((resolve, reject) => {
      let next = 0;
      let done = 0;
      let failed = false;
      const cleanup = () => {
        for (const w of threads) w.removeAllListeners("message").removeAllListeners("error");
        busy = false;
      };
      const feed = (w: Worker) => {
        if (next >= jobs.length) return;
        const id = next++;
        w.postMessage({ id: batch * 1_000_000 + id, job: jobs[id] });
      };
      for (const w of threads) {
        w.on("message", (m: { id: number; result?: RulesResult; error?: string }) => {
          if (failed || Math.floor(m.id / 1_000_000) !== batch) return;
          if (m.error !== undefined) {
            failed = true;
            cleanup();
            reject(new Error(m.error));
            return;
          }
          out[m.id % 1_000_000] = m.result as RulesResult;
          done++;
          progress?.(done, jobs.length);
          if (done === jobs.length) {
            cleanup();
            resolve(out);
          } else feed(w);
        });
        w.on("error", (e) => {
          if (failed) return;
          failed = true;
          cleanup();
          reject(e);
        });
        feed(w);
      }
    });
  };
  return { workers, run, close: async () => void (await Promise.all(threads.map((w) => w.terminate()))) };
}
