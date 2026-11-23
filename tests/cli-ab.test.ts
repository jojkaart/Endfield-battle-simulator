// scripts/cli-ab.ts outputDiff: two outputs of one efsim command (another commit's code and this tree's), the lines
// only one side has, and with a key the lines that changed paired up (zmdlogs holds --verbose: a bound by its tag).
import { describe, expect, it } from "vitest";
import { HOLDS_KEY, outputDiff } from "../scripts/cli-ab.ts";

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
