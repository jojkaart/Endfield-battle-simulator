import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "tests/**/*.test.ts"],
    // The slow log checks (pending fixtures' verdict snapshots, the negative control) run in `npm run test:logs`
    // (vitest.logs.config.ts), which `npm run check` includes.
    exclude: [...configDefaults.exclude, "tests/slow/**"],
    // Loading the full game tables takes ~15 s: the files of a worker share one load (no per-file module isolation),
    // and the setup file freezes it so no test can change what later files see.
    isolate: false,
    setupFiles: ["tests/setup-shared-data.ts"],
    testTimeout: 60_000,
  },
});
