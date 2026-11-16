// What the `efsim zmdlogs` commands compute and print, so the CLI's command (packages/cli/src/commands/zmdlogs.ts) only
// checks its arguments and calls these: the log check's report, the per-hit export, the buff timing report over a
// selection of logs, and the scale reports.

import { basename, join } from "node:path";
import type { GameData } from "@efsim/engine";
import { fixtureTiming, formatTimingReport } from "./bufftiming.ts";
import { exportHits, exportHitsParallel, formatRecord, type HitRecord } from "./hitexport.ts";
import { checkLog, engineHits, engineReport, findScales, formatLogCheck, formatSimulatedLog, impliedScales, logBuffReplay, simulateLog } from "./logcheck.ts";
import { REPO_ROOT } from "@efsim/data";
import { LOG_DIRS, logFixtureFiles, readLogFixture, readLogSplit, refuseHoldoutFile } from "./logs.ts";
import type { LogFixture } from "./zmdlogs.ts";

/**
 * The logs the buff timing report reads: those named (paths, or ids under fixtures/pending/), else every development
 * log of the split (fixtures/holdout/holdout.json). Hold-out logs are never read (only counted as skipped): they're
 * measured, never debugged (docs/accuracy-plan.md, "Choosing logs").
 */
export function timingFixtures(named: readonly string[], root: string = REPO_ROOT): { files: string[]; skipped: number } {
  const split = readLogSplit(root);
  const holdout = split.holdout;
  const idOf = (f: string) => basename(f).replace(/\.json$/, "");
  const wanted = named.length ? named : split.development;
  const files = wanted.filter((f) => !holdout.has(idOf(f))).map((f) => (f.endsWith(".json") ? f : join(root, "fixtures/pending", `${f.startsWith("zmdlogs-") ? f : `zmdlogs-${f}`}.json`)));
  return { files, skipped: wanted.length - files.length };
}

/** `efsim zmdlogs timing`: the buff timing report over the named logs (or every development log). */
export function timingReport(data: () => GameData, named: readonly string[], opts: { readonly assumed: boolean; readonly singles: boolean; readonly verbose: boolean; readonly top?: number; readonly progress?: (line: string) => void }): string {
  const start = performance.now();
  const sel = timingFixtures(named);
  const reports = sel.files.map((f) => {
    opts.progress?.(`timing ${basename(f)}`);
    return fixtureTiming(data(), readLogFixture(f), { assumed: opts.assumed, pairs: !opts.singles });
  });
  return formatTimingReport(data(), reports, { verbose: opts.verbose, skipped: sel.skipped, seconds: (performance.now() - start) / 1000, ...(opts.top !== undefined ? { top: opts.top } : {}) });
}

/** `efsim zmdlogs check`: the log check's report (the engine's replay, or the log's buff listing, or a simulation). */
export function checkReport(data: GameData, fx: LogFixture, opts: { readonly logBuffs: boolean; readonly simulate: boolean }): string {
  if (opts.simulate) return formatSimulatedLog(data, fx, simulateLog(data, fx));
  const replay = opts.logBuffs ? null : logBuffReplay(data, fx);
  const byHit = replay ? engineHits(data, fx, replay) : undefined;
  const verdicts = checkLog(data, fx, replay ? { replay, ...(byHit ? { engineHits: byHit } : {}) } : { buffs: "log" });
  return formatLogCheck(data, fx, verdicts, replay ?? undefined, replay && byHit ? engineReport(data, fx, replay, byHit, verdicts) : undefined);
}

/**
 * `efsim zmdlogs hits`: the per-hit records of the named logs (never a hold-out), or of every verified and pending
 * development log; on worker threads when `workers` (--workers, default 1) > 1 (each loads the game data itself, so `data` isn't called).
 */
export async function hitsReport(data: () => GameData, named: readonly string[], opts: { readonly workers: string | undefined; readonly kind?: string; readonly operators: readonly string[]; readonly json: boolean; readonly progress: (line: string) => void }): Promise<string> {
  for (const f of named) refuseHoldoutFile(f);
  const files = named.length ? [...named] : logFixtureFiles(REPO_ROOT, [LOG_DIRS.verified, LOG_DIRS.pending]);
  const workers = opts.workers === undefined ? 1 : Number(opts.workers);
  if (!(Number.isInteger(workers) && workers >= 1)) throw new Error("--workers must be a whole number ≥ 1");
  const lines: string[] = [];
  const filter = { ...(opts.kind !== undefined ? { kind: opts.kind } : {}), operators: opts.operators, progress: opts.progress };
  const out = (r: HitRecord) => lines.push(formatRecord(r, opts.json));
  if (workers > 1) await exportHitsParallel(files, workers, out, filter);
  else exportHits(data(), files, readLogFixture, out, filter);
  return lines.join("\n");
}

/** `efsim zmdlogs scales`: the multiplier each logged hit of an operator implies, one line each. */
export function scalesReport(data: GameData, fx: LogFixture, operator: string): string {
  const lines: string[] = [];
  for (const r of impliedScales(data, fx, operator)) {
    const s = r.bySkillType;
    lines.push(`${r.event} t=${r.t}${r.unquantified.length ? ` [${r.unquantified.join(",")}]` : ""} crit=${r.crit} value=${r.value}` +
      ` basic=${s.basic.toFixed(4)} battle=${s.battle.toFixed(4)} combo=${s.combo.toFixed(4)} ultimate=${s.ultimate.toFixed(4)}`);
  }
  return lines.join("\n");
}

/** `efsim zmdlogs find-scales`: the skill values (keys) that explain each logged event of an operator. */
export function findScalesReport(data: GameData, fx: LogFixture, operator: string): string {
  const lines: string[] = [];
  for (const m of findScales(data, fx, operator)) {
    lines.push(`${m.event} (${m.hits} hits)`);
    for (const x of m.matches) lines.push(`   ${x.agree}/${m.hits}  ${x.skillId} ${x.keys.join(" * ")} ${x.damageType}${x.corrosion ? ` corrosion L${x.corrosion}` : ""}`);
  }
  return lines.join("\n");
}
