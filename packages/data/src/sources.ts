// Where the game tables live: the git submodules under data/.

import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonExact } from "./json.ts";

export type SourceName = "rmxlinux" | "555me";

export const SOURCES: readonly SourceName[] = ["rmxlinux", "555me"];

/** The primary source; the other is the cross-check (docs/data-sources.md). */
export const PRIMARY: SourceName = "rmxlinux";

const SOURCE_DIRS: Record<SourceName, { repo: string; tables: string }> = {
  rmxlinux: { repo: "rmxlinux-EndfieldData", tables: "TableCfg" },
  "555me": { repo: "555me-beyondGameData", tables: "tableCfg" },
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The data/ directory. Override with EFSIM_DATA_DIR. */
export function dataDir(): string {
  return process.env["EFSIM_DATA_DIR"] ?? join(REPO_ROOT, "data");
}

export function sourceDir(source: SourceName): string {
  const dir = join(dataDir(), SOURCE_DIRS[source].repo);
  if (!existsSync(join(dir, SOURCE_DIRS[source].tables))) {
    throw new Error(
      `${source} data not found at ${dir}. Run: git submodule update --init data/${SOURCE_DIRS[source].repo}`,
    );
  }
  return dir;
}

/**
 * Tables the data layer may read. Kept in packages/data/tables.json so the
 * sparse data fetch (scripts/fetch-data.sh) and the loader can't drift apart.
 */
export const TABLES: readonly string[] = (
  JSON.parse(readFileSync(join(REPO_ROOT, "packages/data/tables.json"), "utf8")) as { tables: string[] }
).tables;

export function readTable(source: SourceName, table: string): unknown {
  if (!TABLES.includes(table)) {
    throw new Error(`table ${table} isn't listed in packages/data/tables.json; add it there so it gets fetched`);
  }
  const file = join(sourceDir(source), SOURCE_DIRS[source].tables, `${table}.json`);
  return parseJsonExact(readFileSync(file, "utf8"));
}

/** The commit a source's checkout is at, for provenance. */
export function sourceCommit(source: SourceName): string {
  const dir = sourceDir(source);
  let gitDir = join(dir, ".git");
  if (statSync(gitDir).isFile()) {
    const pointer = readFileSync(gitDir, "utf8").trim().replace(/^gitdir:\s*/, "");
    gitDir = resolve(dir, pointer);
  }
  const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
  if (/^[0-9a-f]{40}$/.test(head)) return head;
  const ref = head.replace(/^ref:\s*/, "");
  const refFile = join(gitDir, ref);
  if (existsSync(refFile)) return readFileSync(refFile, "utf8").trim();
  const packed = readFileSync(join(gitDir, "packed-refs"), "utf8");
  const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`));
  if (!line) throw new Error(`can't resolve ${ref} in ${gitDir}`);
  return line.split(" ")[0] as string;
}
