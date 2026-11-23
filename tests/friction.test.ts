// scripts/friction.ts: an improvement round's outcome skeletons and carried backlog points.
import { describe, expect, it } from "vitest";
import { carry, outcomeSkeleton, points } from "../scripts/friction.ts";

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
