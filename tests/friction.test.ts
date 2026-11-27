// scripts/friction.ts: an improvement round's outcome skeletons and carried backlog points.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { carriedFrom, carry, carryLists, missingFiles, outcomeSkeleton, points } from "../scripts/friction.ts";

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
    expect([...carried].sort((a, b) => a[0] - b[0])).toEqual([[1, [{ k: 1, part: "the parts export, round 2" }]], [2, [{ k: 2 }]], [3, [{ k: 1 }]]]);
    const r = ["## 1. One", "## 2. Two", "## 3. Three", "## 4. Four"].join("\n");
    // A parenthesis after the number: only that part carried (round 16's own report point 2).
    expect(outcomeSkeleton(r, 11, { name: "backlog.md", carried })).toBe("## Outcome (round 11)\n\n- 1 (One): done but the parts export, round 2 (carried: backlog.md point 1)\n- 2 (Two): carried (backlog.md point 2)\n- 3 (Three): carried (backlog.md point 1)\n- 4 (Four): ");
    // carry --label "<name>," writes "<file>, point n" (round 15).
    expect([...carriedFrom("## 1. A\n- **From:** docs/friction-done/2026-11-26-backlog-after-round-14.md, point 1.", "docs/friction/2026-11-26-backlog-after-round-14.md")]).toEqual([[1, [{ k: 1 }]]]);
  });
});

describe("friction.ts carry --lists (round 16's own report point 1)", () => {
  const backlog = [
    "# Backlog",
    "## 1. Stagger starts",
    "- **Needs:** x.",
    "## 2. The stage flag",
    "- **Needs:** y.",
    "## Parked",
    "",
    "A new report that hits one brings it back with its full text from there.",
    "",
    "Round 9's points:",
    "",
    "- 2. A kit value.",
    "",
    "## Needs an accuracy or search task (not friction work)",
    "",
    "- **Holds per stretch** (round 12): one problem",
    "  over the fight.",
    "- **A batch's Lift** (round 16): the replay lands it.",
    "  Closed by x, abc: it was the bars.",
    "- **Arcane's bursts** (kit-buff leads): the table.",
    "",
    "## What worked well",
    "",
    "Fine.",
  ].join("\n");

  it("prints the Parked section with the parked points on top, and the accuracy list without the closed or dropped entries", () => {
    const out = carryLists(backlog, "docs/friction-done/b.md", [1], ["Arcane's bursts"]);
    expect(out).toContain("## Parked\n\nA new report that hits one brings it back with its full text from there.\n\nThis backlog's point 1 (full text in docs/friction-done/b.md under the same number), carried twice without a new report:\n\n- 1. Stagger starts.\n\nRound 9's points:\n\n- 2. A kit value.\n");
    expect(out).toContain("## Needs an accuracy or search task (not friction work)\n\n- **Holds per stretch** (round 12): one problem\n  over the fight.\n");
    expect(out).not.toMatch(/A batch's Lift|Arcane's bursts|What worked well/);
    expect(() => carryLists(backlog, "b.md", [], ["no such entry"])).toThrow(/no accuracy-list entry/);
    expect(() => carryLists(backlog, "b.md", [7])).toThrow(/no point 7/);
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
