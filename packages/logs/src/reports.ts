// What the `efsim zmdlogs` commands compute and print, so the CLI's command (packages/cli/src/commands/zmdlogs.ts) only
// checks its arguments and calls these: the log check's report, the per-hit export, the buff timing report over a
// selection of logs, the scale reports, and the diagnosis views (views.ts: casts, replay, stagger, differences, groups).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { effectiveKit, type GameData } from "@efsim/engine";
import { fixtureTiming, formatTimingReport } from "./bufftiming.ts";
import { exportHits, exportHitsParallel, filterRecords, formatRecord, layerLines, layerRows, recordChanges, targetDisagreements, zoneDifference, type HitRecord } from "./hitexport.ts";
import { checkLog, engineHits, engineReport, findScales, formatLogCheck, formatSimulatedLog, impliedScales, logBuffReplay, offsetExplanations, simulateLog } from "./logcheck.ts";
import { gameDataCacheKey, mainCheckoutOf, operatorId, REPO_ROOT } from "@efsim/data";
import { isMultiTarget, listLogs, LOG_DIRS, logFixtureFiles, readLogFixture, readLogSplit, resolveFixture, resolveFixtures, shortId } from "./logs.ts";
import { castsView, differencesReport, groupsReport, replayView, staggerRuns, staggerSummary, staggerView, totalsAllView, totalsKindsView, type ReplayViewFilter, type TotalsGroup, type ViewFilter } from "./views.ts";
import { stageFight, type TotalsShares } from "./enginecheck.ts";
import type { OneSided } from "./onesided.ts";
import { snapshotEntry } from "./snapshotentry.ts";
import type { LogFixture } from "./zmdlogs.ts";
import { BUILD_PAIR_TOLERANCE, buildChanges, fitBuild, type BuildCandidate } from "./buildfit.ts";
import { factorBoundLines, factorBounds, factorStretches, factorStretchLines, isOffsetCandidate, offsetHitsOfRecords, offsetsView, screenOffsets } from "./buildoffsets.ts";
import { loggedAsLines, loggedAsPairs } from "./loggedas.ts";
import { assumedView } from "./assumedview.ts";
import { hitOfRecord, listedEntryWords, sameListingLines } from "./listingview.ts";
import { boundaryRows, boundaryView } from "./boundaryview.ts";

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
export function timingReport(data: () => GameData, named: readonly string[], opts: { readonly assumed: boolean; readonly singles: boolean; readonly verbose: boolean; readonly top?: number; readonly assume?: Readonly<Record<string, string>>; readonly progress?: (line: string) => void }): string {
  const start = performance.now();
  const sel = timingFixtures(named);
  const reports = sel.files.map((f) => {
    opts.progress?.(`timing ${basename(f)}`);
    return fixtureTiming(data(), readLogFixture(f), { assumed: opts.assumed, pairs: !opts.singles, ...(opts.assume ? { assume: opts.assume } : {}) });
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
 * `sameListing` (ms, one fixture): the hit there and its nearest neighbours with the same listing (listingview.ts);
 * `listed`: only the hits listing a matching buff (effects or boundary), each text line with those entries' sources,
 * sinces and values (round 16, arcane-will report point 1).
 */
export async function hitsReport(data: () => GameData, sel: LogSelection, opts: RecordFilter & { readonly workers: string | undefined; readonly json: boolean; readonly reading?: "primary" | "log"; readonly zones?: boolean; readonly cache?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly against?: Readonly<Record<string, string>>; readonly sameListing?: number; readonly againstHit?: number; readonly listed?: RegExp; readonly layers?: string; readonly targets?: boolean; readonly progress: (line: string) => void }): Promise<string> {
  // Another reading than the defaults: not from the cache (keyed by code and fixture only), nor into it.
  const assume = opts.assume ?? {};
  const under = Object.keys(assume).length > 0;
  const files = withOperatorsOnly(selectedFiles(sel, "hits"), opts.operators, opts.progress);
  if (opts.sameListing !== undefined) {
    const [file] = files;
    if (files.length !== 1 || file === undefined) throw new Error("zmdlogs hits --same-listing <s> takes one fixture (--operator, --event, --kind pick the hit at that moment)");
    // Every hit of the fight is a neighbour: the filter picks the hit at the moment only.
    const all = await collectRecords(data, files, opts.workers, {}, opts.progress, (opts.cache ?? true) && !under, assume);
    const pick = (r: HitRecord) => filterRecords([r], { ...(opts.kind !== undefined ? { kind: opts.kind } : {}), ...(opts.operators ? { operators: opts.operators } : {}), ...(opts.event ? { event: opts.event } : {}) }).length > 0;
    return sameListingLines(all, readLogFixture(file), opts.sameListing, pick).join("\n");
  }
  if (opts.againstHit !== undefined) {
    const [file] = files;
    if (files.length !== 1 || file === undefined) throw new Error("zmdlogs hits --against-hit <s> takes one fixture (--operator, --event pick the reference hit at that moment and the hits shown)");
    const all = await collectRecords(data, files, opts.workers, {}, opts.progress, (opts.cache ?? true) && !under, assume);
    const shown = filterRecords(all, opts);
    const at = all.filter((r) => Math.abs(r.t - (opts.againstHit as number)) <= 1);
    const picked = at.length > 1 ? at.filter((r) => filterRecords([r], { ...(opts.operators ? { operators: opts.operators } : {}), ...(opts.event ? { event: opts.event } : {}) }).length) : at;
    if (picked.length !== 1) throw new Error(`zmdlogs hits --against-hit: ${picked.length ? `${picked.length} hits` : "no hit"} at ${(opts.againstHit / 1000).toFixed(3)} s${picked.length ? ` (${picked.map((r) => `${r.operator} ${r.event}`).join(", ")}): --operator / --event pick one` : ""}`);
    const ref = picked[0] as HitRecord;
    return [`${basename(file)}: each hit's zones, crit and modifiers as their difference from the hit at ${(ref.t / 1000).toFixed(3)} s (${ref.operator} ${ref.event}, ${ref.class}, logged ${ref.value}): this hit's vs the reference's`, ...shown.map((r) => `${formatRecord(r, false, opts.reading)}  vs ${(ref.t / 1000).toFixed(2)}: ${r === ref ? "(the reference)" : zoneDifference(r, ref)}`)].join("\n");
  }
  const records = await collectRecords(data, files, opts.workers, opts, opts.progress, (opts.cache ?? true) && !under, assume);
  // --against: the hits another reading (on top of --assume) changes, paired with these (recordChanges).
  if (opts.against && Object.keys(opts.against).length) {
    const other = await collectRecords(data, files, opts.workers, opts, opts.progress, false, { ...assume, ...opts.against });
    return recordChanges(records, other).join("\n");
  }
  // --layers: a kit buff's layers, the log's against the replay's and the value's (hitexport.ts layerRows).
  if (opts.layers) {
    // The kit buff's game buff (KitBuff.gameBuff) from the first selected fight whose team has its owner.
    const [owner, id] = opts.layers.split(":", 2) as [string, string];
    const builds = files.map((f) => readLogFixture(f).team.find((b) => b.operator === owner)).filter((b) => b !== undefined);
    const def = builds.length ? effectiveKit(data(), builds[0] as (typeof builds)[number])?.buffs.find((d) => d.id === id) : undefined;
    if (!def) throw new Error(`zmdlogs hits --layers ${opts.layers}: no kit buff ${id} of ${owner} in the selected fights' teams (owner:id, efsim kit <operator>)`);
    const gameBuff = def.gameBuff ?? null;
    return layerLines(layerRows(filterRecords(records, opts), opts.layers, gameBuff), opts.layers, gameBuff).join("\n");
  }
  // --targets: the hits whose check target, replay target and landing disagree, with each fight's replay count.
  if (opts.targets) {
    const out: string[] = [];
    for (const file of files) {
      const mine = filterRecords(records, opts).filter((r) => r.fixture === file || basename(r.fixture) === basename(file));
      const withTarget = mine.filter((r) => r.target);
      const off = targetDisagreements(mine);
      const replays = withTarget.find((r) => r.target?.replays !== undefined)?.target?.replays;
      out.push(`${basename(file).replace(/\.json$/, "")}: ${withTarget.length ? `${withTarget.length} hit(s) with a target, ${replays !== undefined ? `${replays} replay(s) made (logcheck.ts TARGET_REPLAYS: the first on one enemy, then one per assignment while the check's differs)` : "statuses not per target (one replay)"}; ${off.length} whose check target (T), the replay's (≠ replay: the assignment it was made on) and the landing's (≠ landing) disagree` : "not read per target (no hit has a target)"}`);
      out.push(...off.map((r) => `  ${formatRecord(r, false, opts.reading, opts.zones === true)}`));
    }
    return out.join("\n");
  }
  const listed = opts.listed;
  if (listed) {
    const hitOf = new Map<string, ReturnType<typeof hitOfRecord>>();
    const of = (r: HitRecord) => {
      let f = hitOf.get(r.fixture);
      if (!f) hitOf.set(r.fixture, (f = hitOfRecord(readLogFixture(r.fixture))));
      return f(r);
    };
    return records
      .flatMap((r) => {
        const h = of(r);
        const words = h ? listedEntryWords(h, listed) : [];
        if (!words.length) return [];
        return [opts.json ? formatRecord(r, true) : `${formatRecord(r, false, opts.reading, opts.zones === true)}  listed: ${words.join("; ")}`];
      })
      .join("\n");
  }
  return records.map((r) => formatRecord(r, opts.json, opts.reading, opts.zones === true)).join("\n");
}

/**
 * With `--operator`, only the logs whose team has one of them (0c14-and-operator-curve report point 3: `hits --all
 * --operator Rossi` after an engine edit computed all 74 logs to keep one operator's hits): a log without one has
 * none of its hits, so the records are the same. Reads each fixture's team (a second for every log).
 */
export function withOperatorsOnly(files: readonly string[], operators: readonly string[] | undefined, progress?: (line: string) => void): string[] {
  if (!operators?.length) return [...files];
  const kept = files.filter((f) => readLogFixture(f).team.some((b) => operators.includes(b.operator)));
  if (kept.length < files.length) progress?.(`hits: ${kept.length} of ${files.length} logs have ${operators.join(" or ")} in the team; only those are read`);
  return kept;
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

/** More logs to check than this: collectRecords says how long it will take. */
const UNCACHED_WARN = 8;
/** About how long a log's records take on one worker (s; the 0c14 round: `hits --all --json`, ~10 min for 74 logs). */
const SECONDS_PER_LOG = 8;

/**
 * The hit records of some development logs (never a hold-out), filtered: from the per-fixture cache
 * (scratch/hits-cache/<code key>/, hitsCodeKey) where the code and the fixture are unchanged, the rest checked on
 * `workers` threads and cached (`cache` false: neither read nor written).
 */
async function collectRecords(data: () => GameData, files: readonly string[], workersOpt: string | undefined, filter: RecordFilter, progress?: (line: string) => void, cacheAsked = true, assume: Readonly<Record<string, string>> = {}): Promise<HitRecord[]> {
  // The cache is keyed by code and fixture only: under other readings it's neither read nor written, decided here for
  // every records view (round 13's own report point 2: each caller had to remember it).
  const cache = cacheAsked && !Object.keys(assume).length;
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
  // Many logs to check: how long, so a foreground run is moved to the background before the Bash tool's 2-minute limit.
  if (todo.length > UNCACHED_WARN) progress?.(`hits: ${todo.length} logs to check, about ${Math.ceil((todo.length * SECONDS_PER_LOG) / workers / 60)} min on ${workers} worker(s): over a minute or two, run it in the background (an engine or log-tool edit recomputes every log)`);
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
export function castsReport(data: GameData, fx: LogFixture, filter: ViewFilter & { readonly rules?: boolean }): string {
  return castsView(data, fx, filter);
}

/** `efsim zmdlogs replay`: the replay view of one log, with the named kit buffs' windows. */
export function replayReport(data: GameData, fx: LogFixture, filter: ReplayViewFilter): string {
  return replayView(data, fx, filter);
}

/** `efsim zmdlogs stagger`: the Stagger runs of the named logs (or of every verified and pending development log), and a summary over them. */
export function staggerReport(data: GameData, named: readonly string[], progress?: (line: string) => void, assume: Readonly<Record<string, string>> = {}): string {
  const under = Object.keys(assume).length ? { assume } : {};
  const files = named.length ? resolveFixtures(named) : logFixtureFiles(REPO_ROOT, [LOG_DIRS.verified, LOG_DIRS.pending]);
  const out: string[] = [];
  const runs = files.flatMap((f) => {
    progress?.(`stagger ${fixtureLabel(f)}`);
    const fx = readLogFixture(f);
    out.push(staggerView(data, fx, under));
    return staggerRuns(data, fx, under);
  });
  if (files.length > 1) out.push("", staggerSummary(runs));
  return out.join("\n");
}

/** `efsim zmdlogs differences`: where the log's listing and the replay disagree, grouped, with the damage's ratio per group. */
export async function differencesCliReport(data: () => GameData, sel: LogSelection, opts: RecordFilter & { readonly workers: string | undefined; readonly what?: string; readonly hits: boolean; readonly clusters?: boolean; readonly cache?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly progress: (line: string) => void }): Promise<string> {
  const assume = opts.assume ?? {};
  const records = await collectRecords(data, withOperatorsOnly(selectedFiles(sel, "differences"), opts.operators, opts.progress), opts.workers, opts, opts.progress, (opts.cache ?? true) && !Object.keys(assume).length, assume);
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
  return [differencesReport(records, { ...(opts.what !== undefined ? { what: new RegExp(opts.what) } : {}), hits: opts.hits, clusters: opts.clusters === true, fixtureLabel }), "", ...loggedAsLines(pairs), ...unknownFactLines(records)].join("\n");
}

/**
 * The records' facts the replay doesn't know (HitRecord.unknownFacts: "enemy HP unknown"), per fixture and operator:
 * how many hits carry the label and how many of them aren't a plain match (backlog after round 11 point 7).
 */
function unknownFactLines(records: readonly HitRecord[]): string[] {
  const by = new Map<string, { n: number; off: number }>();
  for (const r of records) {
    for (const f of r.unknownFacts ?? []) {
      const k = `${fixtureLabel(r.fixture)} ${r.operator}: ${f.slice(0, f.indexOf(":") >= 0 ? f.indexOf(":") : f.length)}`;
      const x = by.get(k) ?? { n: 0, off: 0 };
      x.n++;
      if (r.class !== "plain") x.off++;
      by.set(k, x);
    }
  }
  if (!by.size) return [];
  return ["", "Facts the replay doesn't know that a kit reads (a label, not a reading: buffreplay.ts unknownFacts):", ...[...by].map(([k, x]) => `  ${k}: ${x.n} hits, ${x.off} not plain`)];
}

/** `efsim zmdlogs groups --operator <op>`: an operator's mismatches grouped (the named logs, or every development log with it). */
export async function groupsCliReport(data: () => GameData, operator: string, sel: LogSelection, opts: { readonly workers: string | undefined; readonly verbose: boolean; readonly cache?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly progress: (line: string) => void }): Promise<string> {
  const id = operatorNamed(data(), operator);
  const named = resolveFixtures(sel.named, sel.fixturesFrom);
  const files = named.length ? named : listLogs({ dirs: ["verified", "pending"], withOperators: [id] }).map((l) => join(REPO_ROOT, l.file));
  const assume = opts.assume ?? {};
  const records = await collectRecords(data, files, opts.workers, {}, opts.progress, (opts.cache ?? true) && !Object.keys(assume).length, assume);
  return groupsReport(records, id, { verbose: opts.verbose, fixtureLabel });
}

/**
 * `efsim zmdlogs assumed --operator <op> [fixture…|--all]`: what the operator's non-plain matches assume (assumedview.ts),
 * from the cached hit records (default: every verified and pending development log with the operator).
 */
export async function assumedCliReport(data: () => GameData, operator: string, sel: LogSelection, opts: { readonly workers: string | undefined; readonly kind?: string; readonly top?: number; readonly cache?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly progress: (line: string) => void }): Promise<string> {
  const id = operatorNamed(data(), operator);
  const named = resolveFixtures(sel.named, sel.fixturesFrom);
  const files = named.length ? named : listLogs({ dirs: ["verified", "pending"], withOperators: [id] }).map((l) => join(REPO_ROOT, l.file));
  const assume = opts.assume ?? {};
  const records = await collectRecords(data, files, opts.workers, { operators: [id] }, opts.progress, (opts.cache ?? true) && !Object.keys(assume).length, assume);
  return assumedView(records, id, { fixtureLabel, ...(opts.kind !== undefined ? { kind: opts.kind } : {}), ...(opts.top !== undefined ? { top: opts.top } : {}) });
}

/**
 * `efsim zmdlogs boundaries <fixture…|--all>`: per kit buff and side, whether its boundary hits read with it or without
 * it (boundaryview.ts), from the cached hit records (`--operator`: those operators' hits).
 */
export async function boundariesCliReport(data: () => GameData, sel: LogSelection, opts: RecordFilter & { readonly workers: string | undefined; readonly kitBuff?: RegExp; readonly cache?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly progress: (line: string) => void }): Promise<string> {
  const assume = opts.assume ?? {};
  const files = withOperatorsOnly(selectedFiles(sel, "boundaries"), opts.operators, opts.progress);
  const records = await collectRecords(data, files, opts.workers, opts, opts.progress, (opts.cache ?? true) && !Object.keys(assume).length, assume);
  return boundaryView(boundaryRows(data(), records, readLogFixture, opts.kitBuff ? { kitBuff: opts.kitBuff } : {}), files.length);
}

/**
 * `efsim zmdlogs totals --all` (or named fixtures with several): every selected development log's totals split by where
 * the error lives (TotalsShares), on `workers` threads (hitsworker.ts), from the per-fixture cache where the code and
 * the fixture are unchanged (as the hit records; not under another reading). Never a hold-out: their aggregates come
 * from measure.
 */
export async function totalsAllReport(data: () => GameData, sel: LogSelection, opts: { readonly workers: string | undefined; readonly operators?: readonly string[]; readonly top?: number; readonly cache?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly kinds?: boolean; readonly json?: boolean; readonly side?: "log" | "replay"; readonly skip?: readonly string[]; readonly progress?: (line: string) => void }): Promise<string> {
  const fights = selectedFiles(sel, "totals").map((f) => ({ file: f, ...fightMarks(readLogFixture(f)) }));
  const { kept, skipped } = skipFights(fights, opts.skip ?? []);
  if (skipped.length) opts.progress?.(`totals: ${skipped.length} fight(s) left out (--skip ${(opts.skip ?? []).join(",")}): ${skipped.map((x) => shortId(fixtureLabel(x.file))).join(", ")}`);
  const files = kept.map((x) => x.file);
  const marks = new Map(kept.map((x) => [x.file, x]));
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
  // A pending fight against several enemies under one id is its own group, as on the scoreboard (scripts/accuracy.ts
  // groupOf: the fixture's severalTargets; round 18, the status-pairing report point 4: the views and the scoreboard
  // grouped 9c6e apart).
  const groupOf = (f: string): TotalsGroup => (isMultiTarget(f) ? "multi" : !resolve(f).startsWith(resolve(REPO_ROOT, LOG_DIRS.pending) + "/") ? "verified" : marks.get(f)?.severalTargets ? "targets" : dev.has(fixtureLabel(f).replace(/^zmdlogs-/, "")) ? "development" : "earlier");
  if (opts.side)
    return oneSidedRanking(data(), files.map((f) => {
      const s = (shares.get(f) as FightTotals).shares;
      return { fight: shortId(fixtureLabel(f)), oneSided: (shares.get(f) as FightTotals).oneSided, ...(s.logged !== undefined ? { logged: s.logged } : {}), ...(marks.get(f)?.severalTargets ? { severalTargets: true } : {}) };
    }), opts.side, opts.top ?? 20, opts.operators);
  if (opts.json)
    return oneSidedJson(files.map((f) => {
      const s = (shares.get(f) as FightTotals).shares;
      const m = marks.get(f);
      return { fight: shortId(fixtureLabel(f)), group: groupOf(f), oneSided: (shares.get(f) as FightTotals).oneSided, fightError: s.error, ...(s.logged !== undefined ? { logged: s.logged } : {}), ...(m?.stage ? { stage: true } : {}), ...(m?.severalTargets ? { severalTargets: true } : {}) };
    }), opts.operators);
  const rows = files.map((f) => ({ short: shortId(fixtureLabel(f)), group: groupOf(f), shares: (shares.get(f) as FightTotals).shares }));
  if (opts.kinds) return totalsKindsView(data(), rows, { ...(opts.operators ? { operators: opts.operators } : {}), ...(opts.top !== undefined ? { top: opts.top } : {}) });
  return totalsAllView(data(), rows, { ...(opts.operators ? { operators: opts.operators } : {}), ...(opts.top !== undefined ? { top: opts.top } : {}) });
}

/**
 * `efsim zmdlogs offsets [fixture…|--all]`: the build-offset screen (buildoffsets.ts) over the selected development
 * logs' hit records (from the per-fixture cache where the code and the fixture are unchanged, else checked on
 * `workers` threads). Multi-target logs are left out (their verdicts mean nothing); never a hold-out.
 */
export async function offsetsReport(data: () => GameData, sel: LogSelection, opts: { readonly workers: string | undefined; readonly operators?: readonly string[]; readonly top?: number; readonly cache?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly bound?: boolean; readonly progress?: (line: string) => void }): Promise<string> {
  const files = selectedFiles(sel, "offsets").filter((f) => !isMultiTarget(f));
  const assume = opts.assume ?? {};
  const records = await collectRecords(data, files, opts.workers, {}, opts.progress, (opts.cache ?? true) && !Object.keys(assume).length, assume);
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
  // The fight-wide factors the fixtures don't hold yet (the Arcane stage-factors report point 2): every operator's hits.
  const stretches = files.map((f) => ({ short: shortId(fixtureLabel(f)), stretches: factorStretches(byFile.get(f) ?? []) }));
  // --bound (round 20, the build-fits report point 3): the factor interval that fits every clean hit within ±1.
  const bounds = opts.bound ? factorBoundLines(data(), files.map((f) => ({ short: shortId(fixtureLabel(f)), bounds: factorBounds(byFile.get(f) ?? []) })), opts.operators ? { operators: opts.operators } : {}) : [];
  return [offsetsView(data(), rows, { ...(opts.operators ? { operators: opts.operators } : {}), ...(opts.top !== undefined ? { top: opts.top } : {}) }), ...factorStretchLines(data(), stretches), ...bounds].join("\n");
}

/** A fight's totals as `zmdlogs totals --all` caches them: the shares and the one-sided landings. */
interface FightTotals {
  readonly shares: TotalsShares;
  readonly oneSided: readonly OneSided[];
}

/** What `zmdlogs totals --skip` reads of a fight: a stage fight (enginecheck.ts stageFight), several targets under one id. */
export function fightMarks(fx: LogFixture): { readonly stage: boolean; readonly severalTargets: boolean } {
  return { stage: stageFight(fx) !== null, severalTargets: fx.severalTargets !== undefined };
}

/**
 * `zmdlogs totals --skip <id|stage|several>,…`: the fights left in and out (round 18, the log-only report point 1: "the
 * same ranking without the two outliers" took two scratch scripts). An id is a fixture's short id or the start of it;
 * `stage` every stage fight, `several` every fight against several targets under one id. A word that names no fight
 * is refused (a typo would leave the ranking as it was, silently).
 */
export function skipFights<F extends { readonly file: string; readonly stage: boolean; readonly severalTargets: boolean }>(fights: readonly F[], skip: readonly string[]): { readonly kept: F[]; readonly skipped: F[] } {
  const words = skip.flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);
  const id = (f: F) => fixtureLabel(f.file).replace(/^zmdlogs-/, "");
  const hits = (w: string, f: F) => (w === "stage" ? f.stage : w === "several" ? f.severalTargets : id(f).startsWith(w.replace(/^zmdlogs-/, "")));
  for (const w of words) if (w !== "stage" && w !== "several" && !fights.some((f) => hits(w, f))) throw new Error(`--skip ${w}: no selected fight has that id (ids, or the words stage and several)`);
  const out = (f: F) => words.some((w) => hits(w, f));
  return { kept: fights.filter((f) => !out(f)), skipped: fights.filter(out) };
}

/**
 * `zmdlogs totals --all --json`: every one-sided landing of the selected fights, a JSON line each with its fight
 * (short id) and group, from the cache like the shares (one-sided report point 1: each new ranking question re-ran
 * every replay in a scratch script; now `jq` over this), largest |damage| first within a fight. Each line also has
 * its `share` of the fight's logged total (%, signed as `damage`: the scoreboard's unit), the fight's `logged` total
 * and `fightError` (%), and `stage` / `severalTargets` where they hold (round 18, the log-only and replay-only reports'
 * point 1 and 2: a ranking by share back-computed the logged total from the text table).
 */
export function oneSidedJson(fights: readonly { readonly fight: string; readonly group: TotalsGroup; readonly oneSided: readonly OneSided[]; readonly logged?: number; readonly fightError?: number; readonly stage?: boolean; readonly severalTargets?: boolean }[], operators?: readonly string[]): string {
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return fights
    .flatMap((f) => {
      const { oneSided, ...fight } = f;
      return [...oneSided]
        .filter((o) => !operators?.length || operators.includes(o.operator))
        .sort((a, b) => Math.abs(b.damage) - Math.abs(a.damage))
        .map((o) => JSON.stringify({ ...fight, ...o, ...(f.logged ? { share: r3((100 * o.damage) / f.logged) } : {}), ...(f.fightError !== undefined ? { fightError: r3(f.fightError) } : {}) }));
    })
    .join("\n");
}

/**
 * `zmdlogs totals --all --side log|replay [--top n]`: the largest one-sided landings of one side across the fights,
 * by their share of the fight's logged total, several-target fights left out (their own row): share, fight, time,
 * operator, key and where it sits (round 23, the placement-cases report point 1: "what is still log-only today" took a
 * `--json` run and a jq ranking).
 */
export function oneSidedRanking(data: GameData, fights: readonly { readonly fight: string; readonly oneSided: readonly OneSided[]; readonly logged?: number; readonly severalTargets?: boolean }[], side: "log" | "replay", top = 20, operators?: readonly string[]): string {
  const rows = fights
    .filter((f) => !f.severalTargets && f.logged)
    .flatMap((f) => f.oneSided.filter((o) => o.side === side && (!operators?.length || operators.includes(o.operator))).map((o) => ({ f, o, share: (100 * Math.abs(o.damage)) / (f.logged as number) })))
    .sort((a, b) => b.share - a.share);
  const label = (op: string) => data.operators[op]?.name ?? op;
  return [
    `The largest ${side}-only landings across ${fights.length} fight(s) (several-target fights left out), by share of the fight's logged total (${Math.min(top, rows.length)} of ${rows.length}):`,
    ...rows.slice(0, top).map(({ f, o, share }) => `  ${share.toFixed(2).padStart(6)}%  ${f.fight} ${(o.t / 1000).toFixed(2)} s  ${label(o.operator)}  ${o.key}  ${o.context}`),
  ].join("\n");
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

/**
 * The operator id an --operator names: an id, its name, or a unique part of the name or the id, in any case (@efsim/data
 * operatorId, as scripts and `zmdlogs list --with` take them; away-and-presses report point 4: "Chen" for Chen Qianyu
 * failed, the name matched only whole). An ambiguous part is refused with the operators it names.
 */
export function operatorNamed(data: GameData, operator: string): string {
  try {
    return operatorId(data, operator);
  } catch (e) {
    throw new Error(`--operator ${operator}: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
}

/** `efsim zmdlogs fit-build`: an operator's attribute nodes, weapon level and food fitted to its clean hits (buildfit.ts). */
export function fitBuildReport(data: GameData, fx: LogFixture, operator: string, opts: { readonly top?: number; readonly foods?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly pairs?: boolean } = {}): string {
  const id = operatorNamed(data, operator);
  const fit = fitBuild(data, fx, id, opts);
  const line = (c: BuildCandidate) => `  ${String(c.fits).padStart(4)} of ${fit.landed} fit (${c.cleanFits} of ${fit.clean} clean)  median ×${c.median.toFixed(4)}  ${c.inputs ? `[${c.inputs} input${c.inputs > 1 ? "s" : ""}] ` : ""}${c.label}${Object.keys(c.set).length ? `  set ${JSON.stringify(c.set)}` : ""}`;
  const overrides = fx.buildOverrides?.filter((o) => o.operator === id) ?? [];
  const pairLines = () => {
    const base = fx.team.find((b) => b.operator === id);
    const target = fit.exported.median;
    if (!base || !Number.isFinite(target)) return [];
    const c = buildChanges(data, base, target);
    const show = (xs: readonly { what: string; ratio: number }[]) => xs.slice(0, opts.top ?? 8).map((x) => `  ×${x.ratio.toFixed(4)}  ${x.what}`);
    return [
      `the wider space (buildChanges; ATK only, within ±${BUILD_PAIR_TOLERANCE} of the offset ×${target.toFixed(4)}): ${c.singles.length} of ${c.tried.singles} single changes and ${c.pairs.length} of ${c.tried.pairs} pairs give it (${new Set([...c.singles, ...c.pairs].map((x) => x.ratio.toFixed(6))).size} distinct ATK values: changes the panel's ATK doesn't tell apart count once there)${c.singles.length + c.pairs.length > 3 ? ": one constant, many explanations; the logs don't decide it alone" : ""}`,
      ...(c.singles.length ? ["singles:", ...show(c.singles)] : []),
      ...(c.pairs.length ? ["pairs:", ...show(c.pairs)] : []),
    ];
  };
  return [
    `${fx.id} ${data.operators[id]?.name ?? id}: ${fit.landed} landed kit hits, ${fit.clean} clean (the log and the replay agree on their modifiers); fits within ±1 of the primary reading`,
    ...(overrides.length ? [`  (the build as read: the fixture's overrides ${overrides.map((o) => JSON.stringify(o.set)).join(", ")} applied)`] : []),
    line(fit.exported),
    "best:",
    ...fit.best.map(line),
    ...(opts.pairs ? pairLines() : []),
  ].join("\n");
}
