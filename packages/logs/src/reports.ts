// What the `efsim zmdlogs` commands compute and print, so the CLI's command (packages/cli/src/commands/zmdlogs.ts) only
// checks its arguments and calls these: the log check's report, the per-hit export, the buff timing report over a
// selection of logs, the scale reports, and the diagnosis views (views.ts: casts, replay, stagger, differences, groups).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { GameData } from "@efsim/engine";
import { fixtureTiming, formatTimingReport } from "./bufftiming.ts";
import { exportHits, exportHitsParallel, filterRecords, formatRecord, type HitRecord } from "./hitexport.ts";
import { checkLog, engineHits, engineReport, findScales, formatLogCheck, formatSimulatedLog, impliedScales, logBuffReplay, simulateLog } from "./logcheck.ts";
import { gameDataCacheKey, REPO_ROOT } from "@efsim/data";
import { isMultiTarget, listLogs, LOG_DIRS, logFixtureFiles, readLogFixture, readLogSplit, resolveFixture, resolveFixtures } from "./logs.ts";
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
  if (named.length) return { files: named.map((f) => resolveFixture(f, root)), skipped: 0 };
  const wanted = split.development;
  const files = wanted.filter((f) => !holdout.has(idOf(f))).map((f) => join(root, "fixtures/pending", `${f.startsWith("zmdlogs-") ? f : `zmdlogs-${f}`}.json`));
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

/** Which logs a records command reads: the named (paths or ids), those in a --fixtures-from file, or with `all` every verified and pending development log. */
export interface LogSelection {
  readonly named: readonly string[];
  readonly fixturesFrom?: string;
  readonly all?: boolean;
}

/** The files of a selection (never a hold-out); throws when it names none and `all` isn't set (the whole set takes many minutes the first time). */
export function selectedFiles(sel: LogSelection, command: string): string[] {
  const named = resolveFixtures(sel.named, sel.fixturesFrom);
  if (named.length && sel.all) throw new Error(`zmdlogs ${command}: fixtures or --all, not both`);
  if (named.length) return named;
  if (!sel.all) throw new Error(`zmdlogs ${command}: name fixtures (paths or ids such as 0c14; --fixtures-from <file>), or --all for every verified and pending development log (the first run checks each log: minutes per log on one worker; later runs read scratch/hits-cache/)`);
  return logFixtureFiles(REPO_ROOT, [LOG_DIRS.verified, LOG_DIRS.pending]);
}

/** The records' filter of the records commands: reaction kind, operators, the logged event key. */
export interface RecordFilter {
  readonly kind?: string;
  readonly operators?: readonly string[];
  readonly event?: RegExp;
}

/**
 * `efsim zmdlogs hits`: the per-hit records of the selected logs (never a hold-out); on worker threads when `workers`
 * (--workers, default 1) > 1 (each loads the game data itself, so `data` isn't called); from the per-fixture cache when
 * the code and the fixture are unchanged (hitsCacheKey). `reading` "log": the text lines also give the log's reading.
 */
export async function hitsReport(data: () => GameData, sel: LogSelection, opts: RecordFilter & { readonly workers: string | undefined; readonly json: boolean; readonly reading?: "primary" | "log"; readonly zones?: boolean; readonly cache?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly progress: (line: string) => void }): Promise<string> {
  // Another reading than the defaults: not from the cache (keyed by code and fixture only), nor into it.
  const assume = opts.assume ?? {};
  const under = Object.keys(assume).length > 0;
  const records = await collectRecords(data, selectedFiles(sel, "hits"), opts.workers, opts, opts.progress, (opts.cache ?? true) && !under, assume);
  return records.map((r) => formatRecord(r, opts.json, opts.reading, opts.zones === true)).join("\n");
}

/**
 * The key of the per-fixture hit-record cache's code: the game data's cache key (data, kits, the engine core it runs)
 * and every source file of the engine and the log package. Computed once per process.
 */
let codeKey: string | undefined;
export function hitsCodeKey(): string {
  if (codeKey) return codeKey;
  const h = createHash("sha256").update(gameDataCacheKey());
  for (const dir of ["packages/engine/src", "packages/logs/src"]) {
    const root = join(REPO_ROOT, dir);
    for (const f of (readdirSync(root, { recursive: true, encoding: "utf8" }) as string[]).filter((x) => x.endsWith(".ts")).sort()) h.update(f).update(readFileSync(join(root, f)));
  }
  return (codeKey = h.digest("hex").slice(0, 16));
}

const HITS_CACHE = "scratch/hits-cache";
/** Code versions whose cached records are kept (the newest by use). */
const HITS_CACHE_KEEP = 3;

function hitsCacheFile(file: string): string {
  const fixtureHash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
  return join(REPO_ROOT, HITS_CACHE, hitsCodeKey(), `${basename(file, ".json")}-${fixtureHash}.json`);
}

function readHitsCache(file: string): HitRecord[] | undefined {
  const c = hitsCacheFile(file);
  if (!existsSync(c)) return undefined;
  try {
    return (JSON.parse(readFileSync(c, "utf8")) as HitRecord[]).map((r) => ({ ...r, fixture: file }));
  } catch {
    return undefined;
  }
}

function writeHitsCache(file: string, records: readonly HitRecord[]): void {
  const c = hitsCacheFile(file);
  const dir = join(REPO_ROOT, HITS_CACHE);
  mkdirSync(join(dir, hitsCodeKey()), { recursive: true });
  writeFileSync(c, JSON.stringify(records));
  const versions = readdirSync(dir).map((d) => ({ d, t: statSync(join(dir, d)).mtimeMs })).sort((a, b) => b.t - a.t);
  for (const v of versions.slice(HITS_CACHE_KEEP)) rmSync(join(dir, v.d), { recursive: true, force: true });
}

/**
 * The hit records of some development logs (never a hold-out), filtered: from the per-fixture cache
 * (scratch/hits-cache/<code key>/, hitsCodeKey) where the code and the fixture are unchanged, the rest checked on
 * `workers` threads and cached (`cache` false: neither read nor written).
 */
async function collectRecords(data: () => GameData, files: readonly string[], workersOpt: string | undefined, filter: RecordFilter, progress?: (line: string) => void, cache = true, assume: Readonly<Record<string, string>> = {}): Promise<HitRecord[]> {
  const workers = workersOpt === undefined ? 1 : Number(workersOpt);
  if (!(Number.isInteger(workers) && workers >= 1)) throw new Error("--workers must be a whole number ≥ 1");
  const byFile = new Map<string, HitRecord[]>();
  const todo: string[] = [];
  for (const f of files) {
    if (isMultiTarget(f)) progress?.(`${basename(f)}: a multi-target log: the log check doesn't run these (the engine is single-target), so its verdicts mean nothing`);
    const cached = cache ? readHitsCache(f) : undefined;
    if (cached) byFile.set(f, cached);
    else todo.push(f);
  }
  if (cache && files.length > 1) progress?.(`hits: ${files.length - todo.length} of ${files.length} logs from the cache (${HITS_CACHE}), ${todo.length} to check`);
  if (todo.length) {
    const got = new Map<string, HitRecord[]>(todo.map((f) => [f, []]));
    const out = (r: HitRecord) => got.get(r.fixture)?.push(r);
    if (workers > 1) await exportHitsParallel(todo, workers, out, { ...(progress ? { progress } : {}), assume });
    else exportHits(data(), todo, readLogFixture, out, { ...(progress ? { progress } : {}), assume });
    for (const [f, rs] of got) {
      byFile.set(f, rs);
      if (cache) writeHitsCache(f, rs);
    }
  }
  return files.flatMap((f) => filterRecords(byFile.get(f) ?? [], filter));
}

const fixtureLabel = (f: string) => basename(f).replace(/\.json$/, "");

/** `efsim zmdlogs casts`: the placement view of one log. */
export function castsReport(data: GameData, fx: LogFixture, filter: ViewFilter): string {
  return castsView(data, fx, filter);
}

/** `efsim zmdlogs replay`: the replay view of one log, with the named kit buffs' windows. */
export function replayReport(data: GameData, fx: LogFixture, filter: ViewFilter & { readonly buffs?: readonly string[]; readonly trace?: readonly string[]; readonly assume?: Readonly<Record<string, string>>; readonly stops?: boolean }): string {
  return replayView(data, fx, filter);
}

/** `efsim zmdlogs stagger`: the Stagger runs of the named logs (or of every verified and pending development log), and a summary over them. */
export function staggerReport(data: GameData, named: readonly string[], progress?: (line: string) => void): string {
  const files = named.length ? resolveFixtures(named) : logFixtureFiles(REPO_ROOT, [LOG_DIRS.verified, LOG_DIRS.pending]);
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
export async function differencesCliReport(data: () => GameData, sel: LogSelection, opts: RecordFilter & { readonly workers: string | undefined; readonly what?: string; readonly hits: boolean; readonly cache?: boolean; readonly progress: (line: string) => void }): Promise<string> {
  const records = await collectRecords(data, selectedFiles(sel, "differences"), opts.workers, opts, opts.progress, opts.cache ?? true);
  return differencesReport(records, { ...(opts.what !== undefined ? { what: new RegExp(opts.what) } : {}), hits: opts.hits, fixtureLabel });
}

/** `efsim zmdlogs groups --operator <op>`: an operator's mismatches grouped (the named logs, or every development log with it). */
export async function groupsCliReport(data: () => GameData, operator: string, sel: LogSelection, opts: { readonly workers: string | undefined; readonly verbose: boolean; readonly cache?: boolean; readonly progress: (line: string) => void }): Promise<string> {
  const id = operatorNamed(data(), operator);
  const named = resolveFixtures(sel.named, sel.fixturesFrom);
  const files = named.length ? named : listLogs({ dirs: ["verified", "pending"], withOperators: [id] }).map((l) => join(REPO_ROOT, l.file));
  const records = await collectRecords(data, files, opts.workers, {}, opts.progress, opts.cache ?? true);
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
