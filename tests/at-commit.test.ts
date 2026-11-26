// scripts/at-commit.ts --run (misprediction-stats report point 3): a script of this checkout run against another
// commit's tree, copied to the same path there and put back after.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { applyPatch, runInTree } from "../scripts/at-commit.ts";

const dir = mkdtempSync(join(tmpdir(), "efsim-at-commit-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("at-commit --run", () => {
  it("runs the script at its own path in the tree (its relative imports the tree's), then puts the tree's file back", () => {
    const root = join(dir, "here");
    const tree = join(dir, "tree");
    for (const d of [join(root, "scripts/probes"), join(tree, "scripts/probes"), join(root, "scratch"), join(tree, "lib")]) mkdirSync(d, { recursive: true });
    writeFileSync(join(tree, "lib/which.ts"), 'export const which = "the tree";\n');
    const probe = ['import { writeFileSync } from "node:fs";', 'import { which } from "../../lib/which.ts";', 'writeFileSync(new URL("../../out.txt", import.meta.url), `${which} ${process.argv.slice(2).join(" ")}`);', ""].join("\n");
    writeFileSync(join(root, "scripts/probes/p.ts"), probe);
    writeFileSync(join(tree, "scripts/probes/p.ts"), "// the tree's own version\n");
    expect(runInTree(tree, join(root, "scripts/probes/p.ts"), ["a", "b"], root)).toBe(0);
    expect(readFileSync(join(tree, "out.txt"), "utf8")).toBe("the tree a b");
    expect(readFileSync(join(tree, "scripts/probes/p.ts"), "utf8")).toBe("// the tree's own version\n");
    // A script the tree hasn't (scratch/) is removed again.
    writeFileSync(join(root, "scratch/s.ts"), "process.exit(3);\n");
    expect(runInTree(tree, join(root, "scratch/s.ts"), [], root)).toBe(3);
    expect(existsSync(join(tree, "scratch/s.ts"))).toBe(false);
    expect(() => runInTree(tree, join(dir, "elsewhere.ts"), [], root)).toThrow(/not a file of this checkout/);
  });
});

describe("at-commit --patch", () => {
  it("names the hunk that failed and the files the diff touches (round 12 friction point 1)", () => {
    const repo = join(dir, "repo");
    mkdirSync(join(repo, "src"), { recursive: true });
    const git = (...args: string[]) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: repo, encoding: "utf8" });
    git("init", "-q");
    writeFileSync(join(repo, "src/view.ts"), "one\ntwo\nthree\n");
    git("add", ".");
    git("commit", "-qm", "base");
    // A diff made against other text than the commit has at that place.
    const diff = join(dir, "view.diff");
    writeFileSync(diff, ["diff --git a/src/view.ts b/src/view.ts", "--- a/src/view.ts", "+++ b/src/view.ts", "@@ -1,3 +1,3 @@", " one", "-TWO", "+2", " three", ""].join("\n"));
    expect(() => applyPatch(diff, repo, "HEAD", "0123456789abcdef")).toThrow(/the hunk\(s\) at src\/view\.ts at line 1 failed.*The diff touches src\/view\.ts/s);
    expect(readFileSync(join(repo, "src/view.ts"), "utf8")).toBe("one\ntwo\nthree\n");
  });
});
