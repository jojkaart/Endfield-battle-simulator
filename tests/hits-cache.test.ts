// The hit records' cache (packages/logs/src/reports.ts): read from this checkout's scratch/hits-cache/, then from the
// main checkout's and other worktrees' at the same code key (round 9 friction point 4), written only here.

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mainCheckoutOf, REPO_ROOT } from "@efsim/data";
import { cacheReadPaths } from "../packages/logs/src/reports.ts";

describe("the hit records' cache", () => {
  it("reads this checkout's entry first, then the same path in the main checkout and its worktrees", () => {
    const own = join(REPO_ROOT, "scratch/hits-cache/abc/zmdlogs-x-123.json");
    const paths = cacheReadPaths(own);
    expect(paths[0]).toBe(own);
    expect(paths.slice(1).every((p) => p.endsWith("/scratch/hits-cache/abc/zmdlogs-x-123.json") && p !== own)).toBe(true);
    const main = mainCheckoutOf(REPO_ROOT);
    if (main) expect(paths).toContain(join(main, "scratch/hits-cache/abc/zmdlogs-x-123.json"));
  });
});
