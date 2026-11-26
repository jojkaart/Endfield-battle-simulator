// scripts/friction.ts: an improvement round's outcome skeletons and carried backlog points.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { carriedFrom, carry, missingFiles, outcomeSkeleton, points } from "../scripts/friction.ts";

const report = ["# A report (2026-11-23)", "", "Task: x.", "", "## 1. First thing.", "", "- **What happened:** a.", "- **From:** round 4.", "", "## 2. Second", "- **What happened:** b.", "", "## What worked well", "", "Fine."].join("\n");

describe("friction.ts", () => {
  it("reads the numbered points", () => {
    expect(points(report).map((p) => [p.n, p.title])).toEqual([
      [1, "First thing."],
      [2, "Second"],
    ]);
  });

  it("writes an outcome skeleton", () => {
    expect(outcomeSkeleton(report, 6)).toBe("## Outcome (round 6)\n\n- 1 (First thing): \n- 2 (Second): ");
  });

  it("carries points renumbered, their From lines extended", () => {
    const out = carry(report, [2, 1], 5, "round 5's backlog,");
    expect(out).toContain("## 5. Second\n- **What happened:** b.\n- **From:** round 5's backlog, point 2.");
    expect(out).toContain("## 6. First thing.\n\n- **What happened:** a.\n- **From:** round 4; round 5's backlog, point 1.");
    expect(() => carry(report, [3], 1, "x")).toThrow(/no point 3/);
  });

  it("extends a wrapped From paragraph at its end", () => {
    const wrapped = ["## 1. One", "- **From:** round 4's backlog, point 2; docs/friction-done/", "  x.md point 1.", "- **Why it helps:** y."].join("\n");
    expect(carry(wrapped, [1], 1, "round 6's backlog,")).toContain("- **From:** round 4's backlog, point 2; docs/friction-done/\n  x.md point 1; round 6's backlog, point 1.\n- **Why it helps:** y.");
  });
});

describe("friction.ts outcomes --backlog (round 10's own report point 2)", () => {
  it("fills in the points a new backlog's From lines carry", () => {
    const backlog = [
      "# Backlog",
      "## 1. A",
      "- **From:** docs/friction-done/2026-11-23-x.md point 4; docs/friction-done/",
      "  2026-11-24-the-report.md points 1 (the parts export, round 2) and 3.",
      "## 2. B",
      "- **From:** docs/friction-done/2026-11-24-the-report.md point 2.",
      "## 3. C",
      "- **From:** docs/friction-done/2026-11-24-other.md point 1.",
    ].join("\n");
    const carried = carriedFrom(backlog, "docs/friction/2026-11-24-the-report.md");
    expect([...carried].sort((a, b) => a[0] - b[0])).toEqual([[1, [1]], [2, [2]], [3, [1]]]);
    const r = ["## 1. One", "## 2. Two", "## 3. Three", "## 4. Four"].join("\n");
    expect(outcomeSkeleton(r, 11, { name: "backlog.md", carried })).toBe("## Outcome (round 11)\n\n- 1 (One): carried (backlog.md point 1)\n- 2 (Two): carried (backlog.md point 2)\n- 3 (Three): carried (backlog.md point 1)\n- 4 (Four): ");
  });
});

describe("the open friction reports name their files (round 14)", () => {
  it("missingFiles: a point without a **Files:** (or a backlog's **Needs:**) line", () => {
    expect(missingFiles(report)).toEqual([1, 2]);
    expect(missingFiles(["## 1. A", "- **Files:** scripts/x.ts.", "## 2. B", "- **Needs:** packages/logs.", "## 3. C", "- **Files:**"].join("\n"))).toEqual([3]);
  });

  it("every point of every report in docs/friction/ has one: the lead splits a round by them (round 13's report point 1)", () => {
    const dir = join(import.meta.dirname, "../docs/friction");
    const bad = readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .flatMap((f) => {
        const missing = missingFiles(readFileSync(join(dir, f), "utf8"));
        return missing.length ? [`${f}: point(s) ${missing.join(", ")}`] : [];
      });
    expect(bad, "add a **Files:** line to each point (the files its suggestion touches; docs/friction/README.md); node scripts/friction.ts check <file> lists them").toEqual([]);
  });
});
