import { defineConfig } from "vitest/config";

// `npm run test:logs`: the log checks too slow for the default `npm test` (several minutes): every pending
// fixture's verdict snapshot, and the negative control on the verified fixtures; the rotation search's
// beam-width ratchets (tests/slow/search-beams.test.ts); and single tests of tens of seconds moved out of the
// default suite (tests/slow/log-cases.test.ts, search-loop-cli.test.ts). `npm run check` runs it.
export default defineConfig({
  test: {
    include: ["tests/slow/**/*.test.ts"],
    // Each check is one long synchronous run: more workers than CPUs to spare only slow each other down (3 of 4).
    maxWorkers: 3,
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
  },
});
