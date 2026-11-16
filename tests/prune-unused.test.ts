// scripts/prune-unused.ts: a split test file's unused imports and helpers go, what's used stays.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pruneUnused } from "../scripts/prune-unused.ts";
import { ROOT } from "./logverdicts.ts";

// Inside the repository, so the tsconfig's paths and node_modules resolve as for a real test file.
const dir = mkdtempSync(join(ROOT, "scratch", "prune-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("prune-unused", () => {
  it("removes unused imports and top-level helpers, and keeps the rest", () => {
    const file = join(dir, "half.test.ts");
    writeFileSync(
      file,
      [
        'import { readFileSync, writeFileSync } from "node:fs";',
        'import { join } from "node:path";',
        'import { describe, expect, it } from "vitest";',
        "",
        "const helperForTheOtherHalf = (s: string) => join(s, 'x');",
        "const used = () => readFileSync;",
        "",
        'describe("x", () => {',
        '  it("y", () => {',
        "    expect(used()).toBeDefined();",
        "  });",
        "});",
        "",
      ].join("\n"),
    );
    expect(pruneUnused([file])).toBe(1);
    const out = readFileSync(file, "utf8");
    expect(out).not.toContain("helperForTheOtherHalf");
    expect(out).not.toContain("node:path");
    expect(out).not.toContain("writeFileSync");
    expect(out).toContain('import { readFileSync } from "node:fs";');
    expect(out).toContain('import { describe, expect, it } from "vitest";');
    expect(pruneUnused([file])).toBe(0);
  });
});
