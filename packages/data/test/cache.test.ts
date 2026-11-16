// The on-disk game-data cache (cache.ts): a hit is exactly a fresh build, and the key moves with every input.
import { spawnSync } from "node:child_process";
import { cpSync,mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import type { GameData } from "@efsim/engine";
import {
  buildGameData,
  clearGameDataCache,
  engineSources,
  gameDataCacheKey,
  listGameDataCache,
  loadCachedGameData,
  loadGameData,
  mainCheckoutOf,
  readGameDataCache,
  REPO_ROOT,
  writeGameDataCache,
} from "@efsim/data";

const temp = (name: string) => mkdtempSync(join(tmpdir(), `efsim-${name}-`));

/** The first path where two values differ, for the failure message (isDeepStrictEqual decides). */
function firstDifference(a: unknown, b: unknown, path = "$"): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return `${path}: ${String(a)} vs ${String(b)}`;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return `${path}: different prototypes`;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length || ka.some((k) => !Object.hasOwn(b, k))) return `${path}: keys ${ka.join(",")} vs ${kb.join(",")}`;
  for (const k of ka) {
    const d = firstDifference((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}
const difference = (a: unknown, b: unknown) => (isDeepStrictEqual(a, b) ? null : (firstDifference(a, b) ?? "differs"));

function withEnv<T>(env: Record<string, string | undefined>, f: () => T): T {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  const set = (vars: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) Reflect.deleteProperty(process.env, k);
      else process.env[k] = v;
    }
  };
  set(env);
  try {
    return f();
  } finally {
    set(saved);
  }
}

describe("game-data cache", () => {
  it("a cached load is exactly a fresh build", () => {
    const fresh = buildGameData();
    const dir = temp("cache");
    const key = gameDataCacheKey();
    writeGameDataCache(key, fresh, dir);
    const read = readGameDataCache(key, dir);
    expect(read).toBeDefined();
    expect(difference(read, fresh)).toBeNull();
    // What this worker's tests run on (the shared cache's entry, unless EFSIM_NO_CACHE) is the fresh build too: a
    // stale entry, from a key that missed an input, shows here.
    expect(difference(loadGameData(), fresh)).toBeNull();
    const shared = readGameDataCache(key);
    if (shared) expect(difference(shared, fresh)).toBeNull();
  }, 180_000);

  it("a kit edit, a new kit file, or an edit of the loader, the engine code it runs, a schema or tables.json changes the key", () => {
    const root = temp("key");
    for (const p of ["packages/data/kits", "packages/data/src", "packages/engine/src", "schemas", "packages/data/tables.json"]) cpSync(join(REPO_ROOT, p), join(root, p), { recursive: true });
    const key = () => gameDataCacheKey({ root });
    const base = key();
    // The key is the inputs' contents (and the data's commits), not where they are.
    expect(base).toBe(gameDataCacheKey());

    const cache = temp("cache");
    writeGameDataCache(base, { marker: 1 } as unknown as GameData, cache);
    expect(readGameDataCache(base, cache)).toEqual({ marker: 1 });

    const edit = (rel: string, f: (text: string) => string) => {
      const file = join(root, rel);
      const before = readFileSync(file, "utf8");
      writeFileSync(file, f(before));
      const changed = key();
      writeFileSync(file, before);
      expect(key()).toBe(base);
      return changed;
    };
    const kitDir = join(root, "packages/data/kits/operators");
    const kit = `packages/data/kits/operators/${readdirSync(kitDir).filter((f) => f.endsWith(".json")).sort()[0]}`;
    const editedKit = edit(kit, (t) => JSON.stringify({ ...JSON.parse(t), note: "edited" }, null, 2));
    expect(editedKit).not.toBe(base);
    // An edited kit's key has no entry: the next load builds.
    expect(readGameDataCache(editedKit, cache)).toBeUndefined();

    for (const rel of ["packages/data/src/foods.ts", "packages/engine/src/attributes.ts", "schemas/kit.schema.json", "packages/data/tables.json"]) {
      expect(edit(rel, (t) => `${t}\n`), rel).not.toBe(base);
    }
    // The planning code isn't a build input: editing it keeps the cache. (If the data package comes to import it, this
    // flips, and engineSources' trace says so.)
    expect(edit("packages/engine/src/policy.ts", (t) => `${t}\n`)).toBe(base);

    mkdirSync(join(root, "packages/data/kits/equipment"), { recursive: true });
    writeFileSync(join(root, "packages/data/kits/equipment/zz-new.json"), "{}\n");
    expect(key()).not.toBe(base);
  });

  it("writes on a miss, reads on a hit, rebuilds on a corrupt or truncated entry; EFSIM_NO_CACHE skips it", () => {
    const dir = temp("cache");
    let builds = 0;
    const build = () => ({ marker: ++builds }) as unknown as GameData;
    withEnv({ EFSIM_CACHE_DIR: dir, EFSIM_NO_CACHE: undefined }, () => {
      expect(loadCachedGameData(build)).toEqual({ marker: 1 });
      expect(loadCachedGameData(build)).toEqual({ marker: 1 });
      expect(builds).toBe(1);
      const [entry] = listGameDataCache(dir);
      expect(entry && basename(entry.file)).toBe(`gamedata-${gameDataCacheKey()}.v8`);
      const file = (entry as { file: string }).file;

      writeFileSync(file, "not a cache entry");
      expect(loadCachedGameData(build)).toEqual({ marker: 2 });
      const bytes = readFileSync(file);
      writeFileSync(file, bytes.subarray(0, bytes.length - 3));
      expect(loadCachedGameData(build)).toEqual({ marker: 3 });
      expect(loadCachedGameData(build)).toEqual({ marker: 3 });
      expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);

      expect(clearGameDataCache(dir)).toBe(1);
      withEnv({ EFSIM_NO_CACHE: "1" }, () => {
        expect(loadCachedGameData(build)).toEqual({ marker: 4 });
        expect(listGameDataCache(dir)).toEqual([]);
      });
    });
  });

  it("efsim cache shows the entries and the current key; efsim cache clear empties it", () => {
    const dir = temp("cache");
    const key = gameDataCacheKey();
    writeGameDataCache(key, { marker: 1 } as unknown as GameData, dir);
    const efsim = (...args: string[]) => {
      const r = spawnSync(process.execPath, [join(REPO_ROOT, "packages/cli/src/main.ts"), ...args], { encoding: "utf8", env: { ...process.env, EFSIM_CACHE_DIR: dir } });
      expect(r.stderr).toBe("");
      expect(r.status).toBe(0);
      return r.stdout;
    };
    expect(efsim("cache")).toContain(`key: ${key} (cached)`);
    expect(efsim("cache", "clear")).toContain("Removed 1 file");
    expect(efsim("cache")).toContain("(not cached");
  });

  it("traces the engine modules the data package runs", () => {
    const { files, traced } = engineSources();
    expect(traced).toBe(true);
    const names = files.map((f) => basename(f));
    expect(names).toContain("attributes.ts");
    expect(names).not.toContain("policy.ts");
  });
});

describe("checkouts", () => {
  it("finds a linked worktree's main checkout through its .git file and commondir", () => {
    const root = temp("git");
    const main = join(root, "main");
    const admin = join(main, ".git", "worktrees", "w");
    mkdirSync(admin, { recursive: true });
    writeFileSync(join(admin, "commondir"), "../..\n");
    const worktree = join(main, ".claude", "worktrees", "w");
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(worktree, ".git"), `gitdir: ${admin}\n`);
    expect(mainCheckoutOf(worktree)).toBe(main);
    expect(mainCheckoutOf(main)).toBeNull();
    expect(mainCheckoutOf(join(root, "nowhere"))).toBeNull();
  });
});
