// The compiled GameData, cached on disk. Building it reads and compiles the game tables, SkillData and kits (~10 s);
// every CLI call, test worker and rules worker paid that. The cache is a v8-serialised copy, keyed by a hash of
// everything the build reads, so it is either the build's exact result or a miss:
//   - the data sources' commits, and the size and time of each table file and of rmxlinux's Json/ folders (a sparse
//     fetch that adds files changes a folder's time);
//   - the contents of the kit files, the schemas, packages/data/tables.json, the data package's sources, and the
//     engine modules those sources import at run time (engineSources: not the planning code, which edits often);
//   - CACHE_FORMAT and the V8 version (the serialisation format).
// Any error reading it means a full build. Writes go to a temporary file renamed into place, so parallel test and
// rules workers never see half a file. EFSIM_NO_CACHE=1 turns it off; `efsim cache clear` empties it. It lives in the
// main checkout's node_modules/.cache/efsim (git-ignored; EFSIM_CACHE_DIR overrides), shared by its worktrees.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { deserialize, serialize } from "node:v8";
import { threadId } from "node:worker_threads";
import type { GameData } from "@efsim/engine";
import { mainCheckoutOf, REPO_ROOT } from "./checkout.ts";
import { sourceCommit, sourceDir, SOURCES, TABLES, tablesDir } from "./sources.ts";

/** Bump when the cache entry's layout changes. */
export const CACHE_FORMAT = 1;

/** Entries kept (most recently used first); each is ~5 MB. */
const KEEP = 12;

const ENTRY = /^gamedata-[0-9a-f]+\.v8$/;

export function cacheDir(): string {
  return process.env["EFSIM_CACHE_DIR"] || join(mainCheckoutOf(REPO_ROOT) ?? REPO_ROOT, "node_modules", ".cache", "efsim");
}

export function cacheDisabled(): boolean {
  const v = process.env["EFSIM_NO_CACHE"];
  return v !== undefined && v !== "" && v !== "0";
}

function filesUnder(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f))
    .sort();
}

/** Import statements that bring in types only: they don't run, so the modules they name aren't run-time inputs. */
const TYPE_ONLY = /^\s*(?:import|export)\s+type\s[^;]*?from\s*["'][^"']+["']/gm;
const RELATIVE_TS = /["'](\.\.?\/[^"']+?\.ts)["']/g;
const NAMED_ENGINE_IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']@efsim\/engine["']/g;
const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * The engine source files the data package's code runs: the modules that export the names it imports from
 * @efsim/engine, and every module those import (type-only imports left out). The whole engine when an import or an
 * export can't be traced, so a miss here can only make the cache rebuild more often, never go stale.
 */
export function engineSources(root: string = REPO_ROOT): { files: string[]; traced: boolean } {
  const engine = join(root, "packages", "engine", "src");
  const whole = { files: filesUnder(engine, ".ts"), traced: false };
  const names = new Set<string>();
  for (const file of filesUnder(join(root, "packages", "data", "src"), ".ts")) {
    const text = readFileSync(file, "utf8");
    const mentions = text.split(/["']@efsim\/engine["']/).length - 1;
    const imports = [...text.matchAll(NAMED_ENGINE_IMPORT)];
    if (imports.length !== mentions) return whole;
    for (const [, typeOnly, list] of imports) {
      if (typeOnly) continue;
      for (const item of (list ?? "").split(",")) {
        const name = item.trim();
        if (!name || name.startsWith("type ")) continue;
        names.add((name.split(/\s+as\s+/)[0] as string).trim());
      }
    }
  }
  const index = readFileSync(join(engine, "index.ts"), "utf8");
  const lines = index.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"));
  const modules: string[] = [];
  for (const line of lines) {
    const m = /^export \* from "(\.\/[^"]+\.ts)";$/.exec(line);
    if (!m) return whole;
    modules.push(resolve(engine, m[1] as string));
  }
  const texts = new Map(modules.map((f) => [f, readFileSync(f, "utf8")]));
  const queue: string[] = [];
  for (const name of names) {
    const n = name.replace(ESCAPE, "\\$&");
    const declared = new RegExp(`export\\s+(?:declare\\s+)?(?:async\\s+)?(?:function\\*?|const|let|var|class|abstract\\s+class|enum|const\\s+enum)\\s+${n}\\b|export\\s*\\{[^}]*\\b${n}\\b[^}]*\\}`);
    const home = modules.find((f) => declared.test(texts.get(f) as string));
    if (!home) return whole;
    queue.push(home);
  }
  const seen = new Set<string>();
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) return whole;
    const text = readFileSync(file, "utf8").replace(TYPE_ONLY, "");
    for (const [, spec] of text.matchAll(RELATIVE_TS)) {
      const target = resolve(dirname(file), spec as string);
      if (!relative(engine, target).startsWith("..")) queue.push(target);
    }
  }
  return { files: [...seen].sort(), traced: true };
}

export interface CacheKeyOptions {
  /** The checkout whose sources and kits are hashed (default: this one). */
  readonly root?: string;
  /** The kits folder (default: <root>/packages/data/kits). */
  readonly kitsDir?: string;
}

/** The cache key: a hash of everything the build reads (see the top of this file). Throws if the data isn't there. */
export function gameDataCacheKey(options: CacheKeyOptions = {}): string {
  const root = options.root ?? REPO_ROOT;
  const kitsDir = options.kitsDir ?? join(root, "packages", "data", "kits");
  const h = createHash("sha256");
  const add = (...parts: (string | number)[]) => {
    for (const p of parts) h.update(`${p}\0`);
  };
  add("efsim-gamedata", CACHE_FORMAT, process.versions.v8);
  for (const source of SOURCES) {
    add("source", source, sourceCommit(source));
    const tables = tablesDir(source);
    for (const table of TABLES) {
      const file = join(tables, `${table}.json`);
      if (!existsSync(file)) add(table, "missing");
      else {
        const s = statSync(file);
        add(table, s.size, s.mtimeMs);
      }
    }
    const json = join(sourceDir(source), "Json");
    if (existsSync(json)) for (const d of readdirSync(json).sort()) add("Json", d, statSync(join(json, d)).mtimeMs);
  }
  const hashFile = (label: string, file: string) => {
    add(label);
    h.update(readFileSync(file));
    add("");
  };
  for (const file of filesUnder(kitsDir, ".json")) hashFile(`kit:${relative(kitsDir, file)}`, file);
  const sources = [
    join(root, "packages", "data", "tables.json"),
    ...filesUnder(join(root, "schemas"), ".json"),
    ...filesUnder(join(root, "packages", "data", "src"), ".ts"),
    ...engineSources(root).files,
  ];
  for (const file of sources) hashFile(relative(root, file), file);
  return h.digest("hex").slice(0, 40);
}

const entryFile = (dir: string, key: string) => join(dir, `gamedata-${key}.v8`);

/** The cached GameData for `key`, or undefined (missing, unreadable, another format or key). */
export function readGameDataCache(key: string, dir: string = cacheDir()): GameData | undefined {
  const file = entryFile(dir, key);
  try {
    const entry = deserialize(readFileSync(file)) as { format?: unknown; key?: unknown; data?: unknown };
    if (entry.format !== CACHE_FORMAT || entry.key !== key || typeof entry.data !== "object" || entry.data === null) return undefined;
    try {
      const now = new Date();
      utimesSync(file, now, now); // for pruning: most recently used first
    } catch {
      // another process pruned it meanwhile: the data is read already
    }
    return entry.data as GameData;
  } catch {
    return undefined;
  }
}

/** Writes the entry atomically (temporary file, then rename) and prunes old entries. Failures only warn. */
export function writeGameDataCache(key: string, data: GameData, dir: string = cacheDir()): void {
  const file = entryFile(dir, key);
  const tmp = `${file}.${process.pid}-${threadId}.tmp`;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(tmp, serialize({ format: CACHE_FORMAT, key, data }));
    renameSync(tmp, file);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      // nothing written
    }
    process.emitWarning(`efsim: couldn't write the game-data cache in ${dir}: ${(e as Error).message}`);
    return;
  }
  prune(dir);
}

/** Keeps the KEEP most recently used entries, and drops temporary files a killed writer left (older than an hour). */
function prune(dir: string): void {
  try {
    const files = readdirSync(dir)
      .filter((f) => f.startsWith("gamedata-"))
      .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }));
    const entries = files.filter(({ f }) => ENTRY.test(f)).sort((a, b) => b.t - a.t);
    const newest = entries[0]?.t ?? 0;
    const stale = files.filter(({ f, t }) => f.endsWith(".tmp") && t < newest - 3_600_000);
    for (const { f } of [...entries.slice(KEEP), ...stale]) unlinkSync(join(dir, f));
  } catch {
    // another process is pruning too
  }
}

/** Removes every cache entry (and leftover temporary files); returns how many files went. */
export function clearGameDataCache(dir: string = cacheDir()): number {
  if (!existsSync(dir)) return 0;
  let removed = 0;
  for (const f of readdirSync(dir)) {
    if (!f.startsWith("gamedata-")) continue;
    try {
      unlinkSync(join(dir, f));
      removed++;
    } catch {
      // gone already
    }
  }
  return removed;
}

/** The cache's entries, most recently used first. */
export function listGameDataCache(dir: string = cacheDir()): { file: string; bytes: number; used: Date }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => ENTRY.test(f))
    .map((f) => {
      const s = statSync(join(dir, f));
      return { file: join(dir, f), bytes: s.size, used: s.mtime };
    })
    .sort((a, b) => b.used.getTime() - a.used.getTime());
}

/** `build()`'s result through the cache: read when the key's entry is there, else built and written. */
export function loadCachedGameData(build: () => GameData): GameData {
  if (cacheDisabled()) return build();
  let key: string;
  try {
    key = gameDataCacheKey();
  } catch {
    return build(); // e.g. no data: the build's own error says what's missing
  }
  const hit = readGameDataCache(key);
  if (hit) return hit;
  const data = build();
  writeGameDataCache(key, data);
  return data;
}
