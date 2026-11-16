// Rule-list runs for efsim diagnose and efsim gear --rules (docs/design.md "Rule-based rotations"): one run is
// playRules (with its diagnosis when asked) on a scenario whose team may wear probe pieces (synthetic gear with one
// stat line: the marginal values); many runs go to worker threads, each loading the game data once.

import { execFileSync } from "node:child_process";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { diagnoseRules, guideRules, playRules, type DamageMoments, type GameData, type GearData, type GuideRun, type PolicyDiagnosis, type PolicyOptions, type PolicyRun, type RuleList, type TimelineScenario } from "@efsim/engine";

export interface RulesJob {
  readonly scenario: Omit<TimelineScenario, "rotation">;
  readonly list: RuleList;
  readonly options: Omit<PolicyOptions, "observer">;
  /** Synthetic gear pieces the team may wear (probes), added to the game data for this run. */
  readonly probes?: Readonly<Record<string, GearData>>;
  readonly diagnose?: boolean;
  /** The guided search's analysis of the run (engine policyguide.ts guideRules). */
  readonly guide?: boolean;
  /** The run's details for a report (RulesResult.detail). */
  readonly detail?: boolean;
}

export interface RulesResult {
  readonly sustainedDps: number;
  /** The whole fight's damage, and the first 60 s's. */
  readonly total: number;
  readonly first60: number;
  readonly moments: DamageMoments;
  readonly perOperator: Readonly<Record<string, number>>;
  readonly fired: readonly number[];
  readonly diagnosis?: PolicyDiagnosis;
  readonly guide?: GuideRun;
  /** The run's details for a report (RulesJob.detail). */
  readonly detail?: Pick<PolicyRun, "byMinute" | "givenUp" | "openerEnd" | "durationFrames">;
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
  const of = (run: PolicyRun): RulesResult => ({
    sustainedDps: run.sustainedDps,
    total: run.total,
    first60: run.first60,
    moments: run.sustainedMoments,
    perOperator: run.perOperator,
    fired: run.fired,
    ...(job.detail ? { detail: { byMinute: run.byMinute, givenUp: run.givenUp, openerEnd: run.openerEnd, durationFrames: run.durationFrames } } : {}),
  });
  if (job.diagnose) {
    const { run, diagnosis } = diagnoseRules(d, job.scenario, job.list, job.options);
    return { ...of(run), diagnosis };
  }
  if (job.guide) {
    const { run, guide } = guideRules(d, job.scenario, job.list, job.options);
    return { ...of(run), guide };
  }
  return of(playRules(d, job.scenario, job.list, job.options));
}

/** Worker threads for rule runs (default: the machine's cores less one, at least 1; 1: every run here, no threads). */
export function defaultWorkers(): number {
  return Math.max(1, availableParallelism() - 1);
}

/**
 * Runs the jobs, in order of the results; with `workers` > 1 on the command's pool of that many threads (commandPool:
 * started once, each thread loading the game data once).
 */
export async function runRulesJobs(data: GameData, jobs: readonly RulesJob[], workers = 1, progress?: (done: number, of: number) => void): Promise<RulesResult[]> {
  if (workers <= 1 || jobs.length <= 1) {
    const out: RulesResult[] = [];
    jobs.forEach((j, i) => {
      out.push(runRulesJob(data, j));
      progress?.(i + 1, jobs.length);
    });
    return out;
  }
  return commandPool(data, workers).run(jobs, progress);
}

let shared: RulesPool | null = null;
let sharedData: GameData | null = null;

/**
 * The command's worker pool (one per command, whatever runs rules: efsim rules, diagnose, gear --rules, the guided
 * search): started on first use with `workers` threads, each loading the game data once, and kept for the command's
 * later batches. Its threads hold the process only while a batch runs, so a command ends without closing it. A later
 * call asking for another size gets the same pool.
 */
export function commandPool(data: GameData, workers = defaultWorkers()): RulesPool {
  if (!shared || sharedData !== data) {
    shared = openRulesPool(data, workers);
    sharedData = data;
  }
  return shared;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * The code a run used, for the head of a long command's output (gear on rules, diagnose, the guided search, rules): the
 * commit and whether the engine, CLI, data code or kits had uncommitted changes then.
 */
export function codeStamp(): string {
  try {
    const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "--", "packages", "schemas"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() !== "";
    return `code ${head}${dirty ? " with uncommitted changes" : ""}`;
  } catch {
    return "code: unknown (no git)";
  }
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
  // Idle threads don't keep the process alive (a command ends without closing its pool); a batch holds them.
  for (const w of threads) w.unref();
  let busy = false;
  // Each batch's job IDs carry its number: a worker still busy with a failed batch's job answers it later, ignored.
  let batches = 0;
  const run = (jobs: readonly RulesJob[], progress?: (done: number, of: number) => void): Promise<RulesResult[]> => {
    if (busy) return Promise.reject(new Error("the pool runs one batch at a time"));
    const out: RulesResult[] = new Array(jobs.length);
    if (jobs.length === 0) return Promise.resolve(out);
    busy = true;
    for (const w of threads) w.ref();
    const batch = ++batches;
    return new Promise<RulesResult[]>((resolve, reject) => {
      let next = 0;
      let done = 0;
      let failed = false;
      const cleanup = () => {
        for (const w of threads) w.removeAllListeners("message").removeAllListeners("error").unref();
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
  return {
    workers,
    run,
    close: async () => {
      if (shared?.run === run) shared = null;
      await Promise.all(threads.map((w) => w.terminate()));
    },
  };
}
