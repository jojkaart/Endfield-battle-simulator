// docs/tried/ by what its diffs touch (scripts/tried.ts; round 20, the Liino report point 2: a tail-cut diff tried the
// same day was derived again and its file overwritten by name).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTried, touches, touchingText, TRIED_DIR, triedDiffs } from "../scripts/tried.ts";

describe("scripts/tried.ts", () => {
  const diffs = triedDiffs();

  it("finds a diff by its file, its function and a word of its header", () => {
    const d = parseTried("x.diff", ["A rule (2026-11-27): tried, dropped; reading unlogged-tails.", "", "diff --git a/packages/logs/src/replayrun.ts b/packages/logs/src/replayrun.ts", "--- a/packages/logs/src/replayrun.ts", "+++ b/packages/logs/src/replayrun.ts", "@@ -416,11 +416,16 @@ export function tailCuts(run: ReplayRun, fx: LogFixture) {", "-    const x = 1;", "+    const ownLanding = (h: LogHit) => true;", ""].join("\n"));
    expect([...d.files]).toEqual([["packages/logs/src/replayrun.ts", ["tailCuts", "ownLanding"]]]);
    expect(touches(d, "replayrun.ts")).toBe("packages/logs/src/replayrun.ts");
    expect(touches(d, "replayrun.ts:tailCuts")).toBe("packages/logs/src/replayrun.ts:tailCuts");
    expect(touches(d, "tailCuts")).toBe("packages/logs/src/replayrun.ts:tailCuts");
    expect(touches(d, "replayrun.ts:placeWith")).toBeNull();
    expect(touches(d, "unlogged-tails")).toBe("its header");
    expect(touches(d, "logcasts.ts")).toBeNull();
  });

  it("names round 19's tail diff for tailCuts (the episode)", () => {
    expect(touchingText(diffs, ["replayrun.ts:tailCuts"])).toContain("docs/tried/2026-11-27-tail-own-landing.diff");
  });

  // A `git diff > docs/tried/<existing>.diff` loses the header; `node scripts/tried.ts new` refuses an existing name.
  it("every tried diff has a header before its first diff and a line in docs/tried/README.md", () => {
    const readme = readFileSync(join(TRIED_DIR, "README.md"), "utf8");
    const bad = diffs.flatMap((d) => [...(d.header.length < 40 ? [`${d.name}: no header (what it does, its measure, why dropped)`] : []), ...(d.files.size === 0 ? [`${d.name}: no diff`] : []), ...(readme.includes(`(${d.name})`) ? [] : [`${d.name}: not linked in docs/tried/README.md`])]);
    expect(bad, "write the header above the first `diff --git` line and link the file in docs/tried/README.md (node scripts/tried.ts new <slug> -- <paths> writes the skeleton)").toEqual([]);
  });
});
