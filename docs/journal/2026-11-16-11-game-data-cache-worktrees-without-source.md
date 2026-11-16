## 2026-11-16: Game-data cache; worktrees without `source`

Architecture review items 1 and 7. **Cache:** `loadGameData` keeps a
v8-serialised GameData in the main checkout's `node_modules/.cache/efsim`
(packages/data cache.ts; design.md "Data layer"). The key hashes the
sources' commits and table stats, the kits, schemas, tables.json, the
data package's sources and the engine modules it runs (traced from its
imports: 11 of 43 files, not the planning code, so policy edits keep the
cache; an untraceable import falls back to the whole engine). Atomic
writes, any read error rebuilds, `EFSIM_NO_CACHE=1`, `efsim cache [clear]`.
Tests: a cached load and the worker's shared data equal a fresh build
(a tampered entry fails it), kit/loader/engine/schema edits change the
key. Measured under load 11–15 (no cache → cache): `efsim find` 12.5 →
1.1 s, `simulate` 17.7 → 1.5 s, one test worker 16.5 → 2.7 s, `efsim
rules` (Ink Melt, 300 s × 5 seeds) 55 → 47 s (the rest is the rule run).
v8 rather than JSON: it keeps shared objects shared, `undefined` and
NaN; deserialising takes ~0.1 s. Comparing `v8.serialize` bytes of a
fresh and a read copy is no equality test (string representations
differ), so the test uses `isDeepStrictEqual`. **Worktrees:**
`node scripts/setup-worktree.ts` links node_modules/@efsim (the .sh only
calls it); the vitest configs run it and alias `@efsim/*` to the
checkout's own packages; tsconfig `paths` does the same for tsc; the
data loader reads the main checkout's data/ when the worktree's is
empty; the CLI exits with a clear message when an @efsim package
resolves outside its checkout. Limit: when the other checkout lacks an
export the CLI imports, Node fails at link time (a SyntaxError naming
the export) before the check runs; loud, but less clear.
