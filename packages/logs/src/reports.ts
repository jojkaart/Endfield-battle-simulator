// What the `efsim zmdlogs` commands compute and print, so the CLI's command (packages/cli/src/commands/zmdlogs.ts) only
// checks its arguments and calls these: the log check's report, the per-hit export, the buff timing report over a
// selection of logs, the scale reports, and the diagnosis views (views.ts: casts, replay, stagger, differences, groups).

import { basename, join } from "node:path";
import type { GameData } from "@efsim/engine";
import { fixtureTiming, formatTimingReport } from "./bufftiming.ts";
import { exportHits, exportHitsParallel, formatRecord, type HitRecord } from "./hitexport.ts";
import { checkLog, engineHits, engineReport, findScales, formatLogCheck, formatSimulatedLog, impliedScales, logBuffReplay, simulateLog } from "./logcheck.ts";
import { REPO_ROOT } from "@efsim/data";
import { listLogs, LOG_DIRS, logFixtureFiles, readLogFixture, readLogSplit, refuseHoldoutFile } from "./logs.ts";
import { castsView, differencesReport, groupsReport, replayView, staggerRuns, staggerSummary, staggerView, type ViewFilter } from "./views.ts";
import type { LogFixture } from "./zmdlogs.ts";
import { fitBuild, type BuildCandidate } from "./buildfit.ts";

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
export function checkReport(data: GameData, fx: LogFixture, opts: { readonly logBuffs: boolean; readonly simulate: boolean; readonly assume?: Readonly<Record<string, string>> }): string {
  const under = opts.assume && Object.keys(opts.assume).length ? { assume: opts.assume } : {};
  if (opts.simulate) return formatSimulatedLog(data, fx, simulateLog(data, fx, undefined, logBuffReplay(data, fx, undefined, under)));
  const replay = opts.logBuffs ? null : logBuffReplay(data, fx, undefined, under);
  const byHit = replay ? engineHits(data, fx, replay) : undefined;
  const verdicts = checkLog(data, fx, replay ? { replay, ...(byHit ? { engineHits: byHit } : {}) } : { buffs: "log" });
  return formatLogCheck(data, fx, verdicts, replay ?? undefined, replay && byHit ? engineReport(data, fx, replay, byHit, verdicts) : undefined);
}

/**
 * `efsim zmdlogs hits`: the per-hit records of the named logs (never a hold-out), or of every verified and pending
 * development log; on worker threads when `workers` (--workers, default 1) > 1 (each loads the game data itself, so `data` isn't called).
 */
export async function hitsReport(data: () => GameData, named: readonly string[], opts: { readonly workers: string | undefined; readonly kind?: string; readonly operators: readonly string[]; readonly json: boolean; readonly progress: (line: string) => void }): Promise<string> {
  const filter = { ...(opts.kind !== undefined ? { kind: opts.kind } : {}), operators: opts.operators, progress: opts.progress };
  return (await collectRecords(data, named, opts.workers, filter)).map((r) => formatRecord(r, opts.json)).join("\n");
}

/** The hit records of the named logs (never a hold-out), or of every verified and pending development log, on `workers` threads. */
async function collectRecords(data: () => GameData, named: readonly string[], workersOpt: string | undefined, filter: { readonly kind?: string; readonly operators?: readonly string[]; readonly progress?: (line: string) => void }): Promise<HitRecord[]> {
  for (const f of named) refuseHoldoutFile(f);
  const files = named.length ? [...named] : logFixtureFiles(REPO_ROOT, [LOG_DIRS.verified, LOG_DIRS.pending]);
  const workers = workersOpt === undefined ? 1 : Number(workersOpt);
  if (!(Number.isInteger(workers) && workers >= 1)) throw new Error("--workers must be a whole number ≥ 1");
  const records: HitRecord[] = [];
  const out = (r: HitRecord) => records.push(r);
  if (workers > 1) await exportHitsParallel(files, workers, out, filter);
  else exportHits(data(), files, readLogFixture, out, filter);
  return records;
}

const fixtureLabel = (f: string) => basename(f).replace(/\.json$/, "");

/** `efsim zmdlogs casts`: the placement view of one log. */
export function castsReport(data: GameData, fx: LogFixture, filter: ViewFilter): string {
  return castsView(data, fx, filter);
}

/** `efsim zmdlogs replay`: the replay view of one log, with the named kit buffs' windows. */
export function replayReport(data: GameData, fx: LogFixture, filter: ViewFilter & { readonly buffs?: readonly string[]; readonly assume?: Readonly<Record<string, string>> }): string {
  return replayView(data, fx, filter);
}

/** `efsim zmdlogs stagger`: the Stagger runs of the named logs (or of every verified and pending development log), and a summary over them. */
export function staggerReport(data: GameData, named: readonly string[], progress?: (line: string) => void): string {
  for (const f of named) refuseHoldoutFile(f);
  const files = named.length ? [...named] : logFixtureFiles(REPO_ROOT, [LOG_DIRS.verified, LOG_DIRS.pending]);
  const out: string[] = [];
  const runs = files.flatMap((f) => {
    progress?.(`stagger ${fixtureLabel(f)}`);
    const fx = readLogFixture(f);
    out.push(staggerView(data, fx));
    return staggerRuns(data, fx);
  });
  if (files.length > 1) out.push("", staggerSummary(runs));
  return out.join("\n");
}

/** `efsim zmdlogs differences`: where the log's listing and the replay disagree, grouped, with the damage's ratio per group. */
export async function differencesCliReport(data: () => GameData, named: readonly string[], opts: { readonly workers: string | undefined; readonly operators: readonly string[]; readonly what?: string; readonly hits: boolean; readonly progress: (line: string) => void }): Promise<string> {
  const records = await collectRecords(data, named, opts.workers, { operators: opts.operators, progress: opts.progress });
  return differencesReport(records, { ...(opts.what !== undefined ? { what: new RegExp(opts.what) } : {}), hits: opts.hits, fixtureLabel });
}

/** `efsim zmdlogs groups --operator <op>`: an operator's mismatches grouped (the named logs, or every development log with it). */
export async function groupsCliReport(data: () => GameData, operator: string, named: readonly string[], opts: { readonly workers: string | undefined; readonly verbose: boolean; readonly progress: (line: string) => void }): Promise<string> {
  const id = operatorNamed(data(), operator);
  const files = named.length ? named : listLogs({ dirs: ["verified", "pending"], withOperators: [id] }).map((l) => join(REPO_ROOT, l.file));
  const records = await collectRecords(data, files, opts.workers, { progress: opts.progress });
  return groupsReport(records, id, { verbose: opts.verbose, fixtureLabel });
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

/** The operator id an --operator names: an id, its name or part of the id. */
export function operatorNamed(data: GameData, operator: string): string {
  const id = data.operators[operator] ? operator : Object.keys(data.operators).find((op) => data.operators[op]?.name?.toLowerCase() === operator.toLowerCase() || op.includes(operator));
  if (!id) throw new Error(`--operator ${operator}: no such operator (an id, its name or part of the id)`);
  return id;
}

/** `efsim zmdlogs fit-build`: an operator's attribute nodes, weapon level and food fitted to its clean hits (buildfit.ts). */
export function fitBuildReport(data: GameData, fx: LogFixture, operator: string, opts: { readonly top?: number; readonly foods?: boolean } = {}): string {
  const id = operatorNamed(data, operator);
  const fit = fitBuild(data, fx, id, opts);
  const line = (c: BuildCandidate) => `  ${String(c.fits).padStart(4)} of ${fit.landed} fit (${c.cleanFits} of ${fit.clean} clean)  median ×${c.median.toFixed(4)}  ${c.label}${Object.keys(c.set).length ? `  set ${JSON.stringify(c.set)}` : ""}`;
  const overrides = fx.buildOverrides?.filter((o) => o.operator === id) ?? [];
  return [
    `${fx.id} ${data.operators[id]?.name ?? id}: ${fit.landed} landed kit hits, ${fit.clean} clean (the log and the replay agree on their modifiers); fits within ±1 of the primary reading`,
    ...(overrides.length ? [`  (the build as read: the fixture's overrides ${overrides.map((o) => JSON.stringify(o.set)).join(", ")} applied)`] : []),
    line(fit.exported),
    "best:",
    ...fit.best.map(line),
  ].join("\n");
}
