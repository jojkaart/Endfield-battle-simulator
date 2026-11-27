// docs/tried/ by what its diffs touch (scripts/tried.ts; round 20, the Liino report point 2: a tail-cut diff tried the
// same day was derived again and its file overwritten by name).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTried, refreshTried, splitTried, touches, touchingText, TRIED_DIR, triedDiffs } from "../scripts/tried.ts";

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

// Round 21 (the tail-cut report point 2): a tried diff made again on the code as it is now, under the same header.
describe("tried.ts refresh", () => {
  it("re-applies a diff whose lines moved, keeps its header, and names a file whose hunk conflicts", () => {
    const dir = mkdtempSync(join(tmpdir(), "tried-refresh-"));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    try {
      git("init", "-q");
      git("config", "user.email", "t@example.invalid");
      git("config", "user.name", "t");
      mkdirSync(join(dir, "scratch"));
      writeFileSync(join(dir, ".gitignore"), "scratch/\n");
      const lines = Array.from({ length: 30 }, (_x, i) => `line ${i}`);
      writeFileSync(join(dir, "a.ts"), lines.join("\n") + "\n");
      git("add", ".");
      git("commit", "-q", "-m", "base");
      writeFileSync(join(dir, "a.ts"), lines.map((l, i) => (i === 20 ? "line 20 tried" : l)).join("\n") + "\n");
      writeFileSync(join(dir, "scratch/x.diff"), "A rule (2026-11-27): tried.\n\n" + git("diff"));
      git("checkout", "-q", "--", "a.ts");
      // The code moves on: two lines above the hunk.
      writeFileSync(join(dir, "a.ts"), ["new 1", "new 2", ...lines].join("\n") + "\n");
      git("commit", "-q", "-am", "moved");
      const r = refreshTried(join(dir, "scratch/x.diff"), "HEAD", dir);
      expect(r.conflicts).toEqual([]);
      expect(splitTried(r.text as string).header).toBe("A rule (2026-11-27): tried.\n\n");
      expect(r.text).toMatch(/@@ -20,7 \+20,7 @@/);
      // The hunk's own line changed on the ref: no refresh.
      writeFileSync(join(dir, "a.ts"), ["new 1", "new 2", ...lines.map((l, i) => (i === 20 ? "line 20 other" : l))].join("\n") + "\n");
      git("commit", "-q", "-am", "conflict");
      const c = refreshTried(join(dir, "scratch/x.diff"), "HEAD", dir);
      expect(c.text).toBeNull();
      expect(c.conflicts).toEqual(["a.ts"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
