// scripts/cli-ab.ts outputDiff: two outputs of one efsim command (another commit's code and this tree's), the lines
// only one side has, and with a key the lines that changed paired up (zmdlogs holds --verbose: a bound by its tag).
import { describe, expect, it } from "vitest";
import { HOLDS_KEY, outputDiff, placementDiff, placementLogs, withRoot } from "../scripts/cli-ab.ts";

describe("outputDiff", () => {
  it("lists lines only at the ref (-) and only here (+), a repeated line as often as it differs", () => {
    expect(outputDiff("a\nb\nb\nc", "a\nb\nd")).toEqual(["+ d", "- b", "- c"]);
    expect(outputDiff("a", "a", { all: true })).toEqual(["  a"]);
  });
  it("pairs a changed line with its key (~), holds' bounds by their tag", () => {
    const was = ["zmdlogs-ab12: 0.5 s of hidden holds placed", "  bound: run x 0→9 ms over 8: P(9.00) − P(0.00) in [0.5, ∞] s; placed 0.50", "  dropped: tick y (asks 1.00 s)"].join("\n");
    const now = ["zmdlogs-ab12: 0.7 s of hidden holds placed", "  bound: run x 0→9 ms over 8: P(9.00) − P(0.00) in [0.5, ∞] s; placed 0.70", "  bound: status z: P(2.00) − P(1.00) in [0.1, ∞] s; placed 0.20"].join("\n");
    const d = outputDiff(was, now, { key: new RegExp(HOLDS_KEY) });
    expect(d[0]).toBe("~ zmdlogs-ab12:");
    expect(d).toContain("~ bound: run x 0→9 ms over 8");
    expect(d).toContain("+   bound: status z: P(2.00) − P(1.00) in [0.1, ∞] s; placed 0.20");
    expect(d.at(-1)).toBe("-   dropped: tick y (asks 1.00 s)");
  });
});

describe("withRoot (round 15: hits --json's records differed by the other worktree's path alone)", () => {
  it("reads the other side's worktree root as this checkout's", () => {
    const other = '{"fixture":"/repo/scratch/at/abc123def/fixtures/pending/zmdlogs-0c14.json","t":1}';
    expect(withRoot(other, "/repo/scratch/at/abc123def", "/repo")).toBe('{"fixture":"/repo/fixtures/pending/zmdlogs-0c14.json","t":1}');
    expect(withRoot("x", "/repo", "/repo")).toBe("x");
  });
});

describe("cli-ab --placement (round 17, the Zhuang Fangyi and Liino report point 2)", () => {
  const log = (id: string, lines: readonly string[]) => [`zmdlogs-${id}: placement (logcasts.ts placeHits); times in s`, ...lines].join("\n");
  const cast = (t: string, skill: string, rule: string) => `   ${t}  CAST   Zhuang Fangyi ${skill} (basic) key attack2_abilityrange  [${rule}: x, of attack2, attack4]`;
  const hit = (t: string, to: string) => `   ${t}  HIT    Zhuang Fangyi attack2_abilityrange 4899 → ${to} #0 frame 15`;

  it("splits an output into its logs by their headers", () => {
    expect([...placementLogs(`${log("ab12", ["a"])}\n${log("cd34", ["b", ""])}\n`).keys()]).toEqual(["zmdlogs-ab12", "zmdlogs-cd34"]);
  });

  it("counts the casts and hits that differ per log, per rule (this tree's ← the ref's) and per operator, a moved cast once", () => {
    const was = [log("ab12", [cast("2.40", "attack2", "anchor"), hit("2.50", "attack2@2.40"), cast("5.00", "attack3", "first")]), log("cd34", ["same"])].join("\n");
    const now = [log("ab12", [cast("2.44", "attack4", "window"), hit("2.50", "attack4@2.44"), cast("5.10", "attack3", "first")]), log("cd34", ["same"])].join("\n");
    const out = placementDiff(was, now, { summary: true });
    expect(out[0]).toBe("Logs whose placement differs (1 of 2):");
    expect(out).toContain("  ab12  3 cast(s), 1 HIT line(s) differ");
    // attack3 moved 5.00 → 5.10: one cast, its rule on both sides; attack2 gone and attack4 new: two.
    expect(out).toContain("     1  first ← first (same skill)");
    expect(out).toContain("     1  window ← new");
    expect(out).toContain("     1  gone ← anchor");
    expect(out.some((l) => /^ {2}Zhuang Fangyi +3 casts +1 hits$/.test(l))).toBe(true);
    expect(placementDiff(was, was)).toEqual(["the placement of every log (2) is the same"]);
  });
});
