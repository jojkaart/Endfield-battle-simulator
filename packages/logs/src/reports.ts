// What the `efsim zmdlogs` commands compute and print, so the CLI's command (packages/cli/src/commands/zmdlogs.ts) only
// checks its arguments and calls these: the log check's report, the per-hit export, the buff timing report over a
// selection of logs, the scale reports, and the diagnosis views (views.ts: casts, replay, stagger, differences, groups).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { GameData } from "@efsim/engine";
import { fixtureTiming, formatTimingReport } from "./bufftiming.ts";
import { exportHits, exportHitsParallel, filterRecords, formatRecord, type HitRecord } from "./hitexport.ts";
import { checkLog, engineHits, engineReport, findScales, formatLogCheck, formatSimulatedLog, impliedScales, logBuffReplay, offsetExplanations, simulateLog } from "./logcheck.ts";
import { gameDataCacheKey, mainCheckoutOf, REPO_ROOT } from "@efsim/data";
import { isMultiTarget, listLogs, LOG_DIRS, logFixtureFiles, readLogFixture, readLogSplit, resolveFixture, resolveFixtures, shortId } from "./logs.ts";
import { castsView, differencesReport, groupsReport, replayView, staggerRuns, staggerSummary, staggerView, totalsAllView, totalsKindsView, type TotalsGroup, type ViewFilter } from "./views.ts";
import type { TotalsShares } from "./enginecheck.ts";
import type { OneSided } from "./onesided.ts";
import { snapshotEntry } from "./snapshotentry.ts";
import type { LogFixture } from "./zmdlogs.ts";
import { fitBuild, type BuildCandidate } from "./buildfit.ts";
import { isOffsetCandidate, offsetHitsOfRecords, offsetsView, screenOffsets } from "./buildoffsets.ts";
import { loggedAsLines, loggedAsPairs } from "./loggedas.ts";

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

/** The records' filter of the records commands: reaction kind, operators, the logged event key, a window of log time (ms). */
export interface RecordFilter {
  readonly kind?: string;
  readonly operators?: readonly string[];
  readonly event?: RegExp;
  readonly from?: number;
  readonly to?: number;
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

function hitsCacheFile(file: string, root: string = REPO_ROOT): string {
  const fixtureHash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
  return join(root, HITS_CACHE, hitsCodeKey(), `${basename(file, ".json")}-${fixtureHash}.json`);
}

/**
 * Where a cache entry may be read: this checkout's, then the main checkout's and its other agents' worktrees'
 * (.claude/worktrees/*), whose entries are as good when the code key is the same (it hashes the game data's key and
 * every engine and log source file, so equal keys mean equal code): a new worktree's first `--all` view reads what
 * another checkout at the same code computed instead of recomputing every log (round 9 friction point 4: 171 s).
 * Written only to this checkout's.
 */
export function cacheReadPaths(own: string, root: string = REPO_ROOT): string[] {
  const main = mainCheckoutOf(root) ?? root;
  const rel = own.slice(root.length);
  const trees = join(main, ".claude", "worktrees");
  const others = [main, ...(existsSync(trees) ? readdirSync(trees).map((d) => join(trees, d)) : [])].filter((r) => resolve(r) !== resolve(root));
  return [own, ...others.map((r) => join(r, rel))];
}

function readCached<T>(own: string): T | undefined {
  for (const c of cacheReadPaths(own)) {
    if (!existsSync(c)) continue;
    try {
      return JSON.parse(readFileSync(c, "utf8")) as T;
    } catch {
      // being written, or damaged: the next place, else recompute
    }
  }
  return undefined;
}

function readHitsCache(file: string): HitRecord[] | undefined {
  return readCached<HitRecord[]>(hitsCacheFile(file))?.map((r) => ({ ...r, fixture: file }));
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
  // The likely-loggedAs pairs from the same records (loggedas.ts: a kit buff and an unmapped listed buff with one effect).
  const byFixture = new Map<string, HitRecord[]>();
  for (const r of records) byFixture.set(r.fixture, [...(byFixture.get(r.fixture) ?? []), r]);
  const pairs = [...byFixture].map(([file, rs]) => {
    const fx = readLogFixture(file);
    const mods = new Map(rs.map((r) => [`${r.t}|${r.operator}|${r.event}|${r.value}`, r.landing?.modifiers ?? []]));
    return {
      label: fixtureLabel(file),
      pairs: loggedAsPairs(data(), fx, (h) => {
        const ms = mods.get(`${h.t}|${h.operator}|${h.event}|${h.value}`);
        return ms ? { modifiers: ms.map((m) => ({ zone: m.zone, ...(m.element !== undefined ? { element: m.element } : {}), value: m.value, ...(m.kitBuff ? { kitBuff: { owner: m.kitBuff.slice(0, m.kitBuff.indexOf(":")), id: m.kitBuff.slice(m.kitBuff.indexOf(":") + 1) } } : {}) })) } : null;
      }),
    };
  });
  return [differencesReport(records, { ...(opts.what !== undefined ? { what: new RegExp(opts.what) } : {}), hits: opts.hits, fixtureLabel }), "", ...loggedAsLines(pairs)].join("\n");
}

/** `efsim zmdlogs groups --operator <op>`: an operator's mismatches grouped (the named logs, or every development log with it). */
export async function groupsCliReport(data: () => GameData, operator: string, sel: LogSelection, opts: { readonly workers: string | undefined; readonly verbose: boolean; readonly cache?: boolean; readonly progress: (line: string) => void }): Promise<string> {
  const id = operatorNamed(data(), operator);
  const named = resolveFixtures(sel.named, sel.fixturesFrom);
  const files = named.length ? named : listLogs({ dirs: ["verified", "pending"], withOperators: [id] }).map((l) => join(REPO_ROOT, l.file));
  const records = await collectRecords(data, files, opts.workers, {}, opts.progress, opts.cache ?? true);
  return groupsReport(records, id, { verbose: opts.verbose, fixtureLabel });
}

/**
 * `efsim zmdlogs totals --all` (or named fixtures with several): every selected development log's totals split by where
 * the error lives (TotalsShares), on `workers` threads (hitsworker.ts), from the per-fixture cache where the code and
 * the fixture are unchanged (as the hit records; not under another reading). Never a hold-out: their aggregates come
 * from measure.
 */
export async function totalsAllReport(data: () => GameData, sel: LogSelection, opts: { readonly workers: string | undefined; readonly operators?: readonly string[]; readonly top?: number; readonly cache?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly kinds?: boolean; readonly json?: boolean; readonly progress?: (line: string) => void }): Promise<string> {
  const files = selectedFiles(sel, "totals");
  const workers = opts.workers === undefined ? 1 : Number(opts.workers);
  if (!(Number.isInteger(workers) && workers >= 1)) throw new Error("--workers must be a whole number ≥ 1");
  const assume = opts.assume ?? {};
  const cache = (opts.cache ?? true) && !Object.keys(assume).length;
  const shares = new Map<string, FightTotals>();
  const todo: string[] = [];
  for (const f of files) {
    const c = cache ? readSharesCache(f) : undefined;
    if (c) shares.set(f, c);
    else todo.push(f);
  }
  if (files.length > 1) opts.progress?.(`totals: ${files.length - todo.length} of ${files.length} logs from the cache (${HITS_CACHE}), ${todo.length} to check`);
  const got = (f: string, s: FightTotals) => {
    shares.set(f, s);
    if (cache) writeSharesCache(f, s);
  };
  if (workers > 1 && todo.length > 1) await sharesParallel(todo, workers, got, assume, opts.progress);
  else
    for (const f of todo) {
      opts.progress?.(`totals ${fixtureLabel(f)}`);
      const e = snapshotEntry(data(), readLogFixture(f), Object.keys(assume).length ? { assume } : {});
      got(f, { shares: e.shares, oneSided: e.oneSided });
    }
  const split = readLogSplit(REPO_ROOT);
  const dev = new Set(split.development.map((d) => d.replace(/^zmdlogs-/, "")));
  const groupOf = (f: string): TotalsGroup => (isMultiTarget(f) ? "multi" : !resolve(f).startsWith(resolve(REPO_ROOT, LOG_DIRS.pending) + "/") ? "verified" : dev.has(fixtureLabel(f).replace(/^zmdlogs-/, "")) ? "development" : "earlier");
  if (opts.json) return oneSidedJson(files.map((f) => ({ fight: shortId(fixtureLabel(f)), group: groupOf(f), oneSided: (shares.get(f) as FightTotals).oneSided })), opts.operators);
  const rows = files.map((f) => ({ short: shortId(fixtureLabel(f)), group: groupOf(f), shares: (shares.get(f) as FightTotals).shares }));
  if (opts.kinds) return totalsKindsView(data(), rows, { ...(opts.operators ? { operators: opts.operators } : {}), ...(opts.top !== undefined ? { top: opts.top } : {}) });
  return totalsAllView(data(), rows, { ...(opts.operators ? { operators: opts.operators } : {}), ...(opts.top !== undefined ? { top: opts.top } : {}) });
}

/**
 * `efsim zmdlogs offsets [fixture…|--all]`: the build-offset screen (buildoffsets.ts) over the selected development
 * logs' hit records (from the per-fixture cache where the code and the fixture are unchanged, else checked on
 * `workers` threads). Multi-target logs are left out (their verdicts mean nothing); never a hold-out.
 */
export async function offsetsReport(data: () => GameData, sel: LogSelection, opts: { readonly workers: string | undefined; readonly operators?: readonly string[]; readonly top?: number; readonly cache?: boolean; readonly progress?: (line: string) => void }): Promise<string> {
  const files = selectedFiles(sel, "offsets").filter((f) => !isMultiTarget(f));
  const records = await collectRecords(data, files, opts.workers, {}, opts.progress, opts.cache ?? true);
  const byFile = new Map<string, HitRecord[]>();
  for (const r of records) byFile.set(r.fixture, [...(byFile.get(r.fixture) ?? []), r]);
  const rows = files.flatMap((f) => {
    const fx = readLogFixture(f);
    return screenOffsets(offsetHitsOfRecords(byFile.get(f) ?? [])).map((offset) => {
      // A candidate's ATK explanation, as the check's report gives it (one place: logcheck.ts offsetExplanations).
      const build = isOffsetCandidate(offset) ? fx.team.find((b) => b.operator === offset.operator) : undefined;
      const fits = build ? offsetExplanations(data(), build, offset.median) : [];
      return { short: shortId(fixtureLabel(f)), fx, offset, ...(fits.length ? { fits } : {}) };
    });
  });
  return offsetsView(data(), rows, { ...(opts.operators ? { operators: opts.operators } : {}), ...(opts.top !== undefined ? { top: opts.top } : {}) });
}

/** A fight's totals as `zmdlogs totals --all` caches them: the shares and the one-sided landings. */
interface FightTotals {
  readonly shares: TotalsShares;
  readonly oneSided: readonly OneSided[];
}

/**
 * `zmdlogs totals --all --json`: every one-sided landing of the selected fights, a JSON line each with its fight
 * (short id) and group, from the cache like the shares (one-sided report point 1: each new ranking question re-ran
 * every replay in a scratch script; now `jq` over this), largest |damage| first within a fight.
 */
export function oneSidedJson(fights: readonly { readonly fight: string; readonly group: TotalsGroup; readonly oneSided: readonly OneSided[] }[], operators?: readonly string[]): string {
  return fights
    .flatMap((f) => [...f.oneSided].filter((o) => !operators?.length || operators.includes(o.operator)).sort((a, b) => Math.abs(b.damage) - Math.abs(a.damage)).map((o) => JSON.stringify({ fight: f.fight, group: f.group, ...o })))
    .join("\n");
}

function sharesCacheFile(file: string): string {
  return hitsCacheFile(file).replace(/\.json$/, ".totals.json");
}

function readSharesCache(file: string): FightTotals | undefined {
  return readCached<FightTotals>(sharesCacheFile(file));
}

function writeSharesCache(file: string, s: FightTotals): void {
  mkdirSync(dirname(sharesCacheFile(file)), { recursive: true });
  writeFileSync(sharesCacheFile(file), JSON.stringify(s));
}

/** The shares of `files` on `workers` threads of hitsworker.ts, each answer to `got`. */
async function sharesParallel(files: readonly string[], workers: number, got: (file: string, s: FightTotals) => void, assume: Readonly<Record<string, string>>, progress?: (line: string) => void): Promise<void> {
  const { Worker } = await import("node:worker_threads");
  const queue = [...files];
  const one = () =>
    new Promise<void>((done, reject) => {
      const w = new Worker(new URL("./hitsworker.ts", import.meta.url));
      const next = () => {
        const file = queue.shift();
        if (file === undefined) {
          void w.terminate().then(() => done());
          return;
        }
        progress?.(`totals ${fixtureLabel(file)}`);
        w.postMessage({ file, shares: true, ...(Object.keys(assume).length ? { assume: { ...assume } } : {}) });
      };
      w.on("message", (m: { file: string; shares?: TotalsShares; oneSided?: OneSided[]; error?: string }) => {
        if (m.error !== undefined || !m.shares || !m.oneSided) {
          void w.terminate();
          reject(new Error(`${m.file}: ${m.error ?? "no shares"}`));
          return;
        }
        got(m.file, { shares: m.shares, oneSided: m.oneSided });
        next();
      });
      w.on("error", reject);
      next();
    });
  await Promise.all(Array.from({ length: Math.max(1, Math.min(workers, files.length)) }, one));
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
