// Fetches only the game tables the data layer reads (packages/data/tables.json) from the data/ submodules, at the
// commits this repository pins: a sparse, shallow, blob-filtered checkout of each. Used by CI and the cloud session
// start hook (scripts/session-start.ts). A full submodule checkout (git submodule update --init data/…) works too and
// is left alone when it has every file. Round 10 ported it from scripts/fetch-data.sh.
//
// Usage: node scripts/fetch-data.ts               fetch what is missing (a line per submodule)
//        node scripts/fetch-data.ts --dry-run     say what it would do, change nothing
//        node scripts/fetch-data.ts --cache-key   one line `key=data-<pins>-<inputs>` for CI's cache (>> $GITHUB_OUTPUT):
//                                                 the submodules' pinned commits, tables.json and this script

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TABLES = join(ROOT, "packages", "data", "tables.json");

/** The submodules and where their tables are: the TableCfg folder, and the folder of the per-file JSON (rmxlinux only). */
export const SUBMODULES: readonly { readonly path: string; readonly tableDir: string; readonly jsonDir?: string }[] = [
  { path: "data/rmxlinux-EndfieldData", tableDir: "TableCfg", jsonDir: "Json" },
  { path: "data/555me-beyondGameData", tableDir: "tableCfg" },
];

interface TablesJson {
  readonly tables: readonly string[];
  /** Folder → file globs (`*` only) under the JSON folder. */
  readonly json: Readonly<Record<string, readonly string[]>>;
}

/** The sparse-checkout patterns of a submodule: each table, and each JSON glob (paths from the submodule's root). */
export function patternsOf(t: TablesJson, tableDir: string, jsonDir?: string): { readonly files: string[]; readonly globs: string[] } {
  return {
    files: t.tables.map((name) => `/${tableDir}/${name}.json`),
    globs: jsonDir ? Object.entries(t.json).flatMap(([d, gs]) => gs.map((g) => `/${jsonDir}/${d}/${g}.json`)) : [],
  };
}

/** Whether a glob (`/dir/…/name*.json`, `*` in the last part only) matches a file under `base`. */
export function globMatches(base: string, glob: string): boolean {
  const dir = join(base, dirname(glob));
  if (!existsSync(dir)) return false;
  const last = glob.slice(glob.lastIndexOf("/") + 1);
  const re = new RegExp(`^${last.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
  return readdirSync(dir).some((f) => re.test(f));
}

function git(args: readonly string[], cwd = ROOT, allowFail = false): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0 && !allowFail) throw new Error(`git ${args.join(" ")} (in ${cwd}): ${(r.stderr ?? "").trim()}`);
  return r.status === 0 ? r.stdout.trim() : "";
}

/** The commit a checkout pins a submodule at. */
const pinned = (path: string, root: string) => git(["ls-tree", "HEAD", path], root).split(/\s+/)[2] ?? "";

/** Brings one submodule's tables to its pinned commit; a line saying what it did (or would do, with dryRun). */
export function fetchSubmodule(sub: (typeof SUBMODULES)[number], t: TablesJson, dryRun = false, root = ROOT): string {
  const dir = join(root, sub.path);
  const url = git(["config", "-f", ".gitmodules", `submodule.${sub.path}.url`], root);
  const sha = pinned(sub.path, root);
  const { files, globs } = patternsOf(t, sub.tableDir, sub.jsonDir);
  if (existsSync(join(dir, ".git")) && git(["rev-parse", "HEAD"], dir, true) === sha) {
    const missing = files.filter((p) => !existsSync(join(dir, p))).length + globs.filter((g) => !globMatches(dir, g)).length;
    if (!missing) return `${sub.path}: up to date at ${sha}`;
    if (git(["config", "core.sparseCheckout"], dir, true) === "true") {
      if (!dryRun) git(["sparse-checkout", "set", "--no-cone", ...files, ...globs], dir);
      return `${sub.path}: sparse paths ${dryRun ? "would be " : ""}updated (${missing} missing)`;
    }
  }
  const line = `${sub.path}: ${dryRun ? "would fetch" : "fetching"} ${files.length} tables and ${globs.length} file patterns at ${sha}`;
  if (dryRun) return line;
  process.stdout.write(line + "\n");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  git(["init", "-q"], dir);
  git(["remote", "add", "origin", url], dir);
  git(["sparse-checkout", "set", "--no-cone", ...files, ...globs], dir);
  git(["fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", sha], dir);
  git(["checkout", "-q", "FETCH_HEAD"], dir);
  return `${sub.path}: fetched`;
}

/** CI's cache key: the pinned commits of data/, then tables.json and this script (16 hex digits each). */
export function cacheKey(): string {
  const h = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
  return `key=data-${h(git(["ls-tree", "HEAD", "data/"]) + "\n")}-${h(readFileSync(TABLES, "utf8") + readFileSync(fileURLToPath(import.meta.url), "utf8"))}`;
}

export function main(argv: readonly string[]): number {
  if (argv.includes("--cache-key")) {
    process.stdout.write(cacheKey() + "\n");
    return 0;
  }
  const unknown = argv.filter((a) => a !== "--dry-run");
  if (unknown.length) {
    process.stderr.write("usage: node scripts/fetch-data.ts [--dry-run | --cache-key]\n");
    return 2;
  }
  const t = JSON.parse(readFileSync(TABLES, "utf8")) as TablesJson;
  for (const sub of SUBMODULES) process.stdout.write(fetchSubmodule(sub, t, argv.includes("--dry-run")) + "\n");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
