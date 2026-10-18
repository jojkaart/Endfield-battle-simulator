import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "tests/**/*.test.ts"],
    // Loading the full game tables takes a few seconds.
    testTimeout: 60_000,
  },
});
