// zmdlogs away (packages/logs/src/awayview.ts; round 17, the away-statuses report point 1): per away stretch, the hold
// placement's clocks listed on both sides of it, the hold placed inside it, each operator's basic step across it and
// a verdict, on the logs that decided engine assumption pause-holds.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { awayStretches, awayView, devFixtures } from "@efsim/logs";

const data = loadGameData();

describe("zmdlogs away", () => {
  it("reads 4d60's 27.38–37.00 s stretch as a pause: every clock across it asks most of its length, 8.4 s held there, Arcane's string goes on", () => {
    const [d] = devFixtures({ ids: ["4d60"] });
    const [first, second] = awayStretches(data, (d as { fx: Parameters<typeof awayStretches>[1] }).fx);
    expect([first?.from, first?.to]).toEqual([27376, 36998]);
    expect(first?.verdict).toBe("pause");
    expect(first?.clocks.length).toBeGreaterThanOrEqual(5);
    expect(first?.held).toBeGreaterThan(8000);
    expect(first?.basics.find((b) => b.operator === "chr_0032_lizhiyan")).toMatchObject({ before: { event: "chr_0032_lizhiyan_attack2" }, after: { event: "chr_0032_lizhiyan_attack3" } });
    expect(second?.verdict).toBe("pause");
  });

  it("reads a Si phase as no clock and nothing held, and counts the verdicts", () => {
    const text = awayView(data, devFixtures({ ids: ["d774"] }));
    expect(text).toMatch(/^d774 eny_0134_jsspsi away 30\.63–54\.59 \(23\.96 s\): no clock; held inside it 0\.00 s$/m);
    expect(text.split("\n").at(-1)).toBe("2 away stretch(es) in 1 log(s): 2 no clock");
  });
});
