// scripts/runstate.ts `--where` (round 24, round 23's own report point 2: a status check over several runs was a tail
// per log and a git call each): a run's output file read back, its EFSIM-DONE line and its last lines.
import { describe, expect, it } from "vitest";
import { tailOf, where } from "../scripts/runstate.ts";

describe("runstate --where", () => {
  it("tails a run's output without its progress lines, its EFSIM-DONE line apart", () => {
    const text = ["measure: queued", "[1/3] a.json 2.0 s", "[2/3] a hold-out log", "No log's verdicts moved.", "measure: done", "EFSIM-DONE measure pass", ""].join("\n");
    expect(tailOf(text, 2)).toEqual({ last: ["No log's verdicts moved.", "measure: done"], done: "EFSIM-DONE measure pass" });
    expect(tailOf("still going\n[4/9] x").done).toBeNull();
  });

  it("says the branch, the commits beyond main, the uncommitted paths, the runs and the other worktrees", () => {
    const lines = where();
    expect(lines[0]).toMatch(/ at [0-9a-f]{9}: \d+ commit\(s\) beyond main/);
    expect(lines.some((l) => /^uncommitted: /.test(l))).toBe(true);
    expect(lines.some((l) => l === "runs (scratch/runs/):")).toBe(true);
    expect(lines.at(-1)).toMatch(/^other worktrees: /);
  });
});
