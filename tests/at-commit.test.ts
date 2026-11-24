// scripts/at-commit.ts --run (misprediction-stats report point 3): a script of this checkout run against another
// commit's tree, copied to the same path there and put back after.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runInTree } from "../scripts/at-commit.ts";

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
