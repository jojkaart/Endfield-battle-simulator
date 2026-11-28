// `zmdlogs casts --event-lags` (round 22, the barrage-array report point 3): a combo's logged event lags its placed
// start by its own slow-down (Typhoeus about 0.5 s of log time, about 0 of world time), a battle skill's is at it.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, eventLags, eventLagsView } from "@efsim/logs";

const data = loadGameData();
const typhoeus = "chr_0034_typhoea";

describe("the log's cast events against the placed starts", () => {
  const logs = devFixtures({ ids: ["fc63", "9c6e"] });
  const lags = eventLags(data, logs, { operators: [typhoeus] });

  it("a plain combo's event comes 0.3–0.7 s after its frame 0, about none of it world time", () => {
    const combos = lags.filter((l) => l.kind === "combo" && l.odd === null);
    expect(combos.length).toBeGreaterThan(2);
    for (const l of combos) expect(l.lag).toBeLessThan(700);
    expect(combos.filter((l) => l.lag >= 300).length).toBeGreaterThan(combos.length / 2);
    for (const l of combos.filter((x) => x.lag >= 300)) expect(Math.abs(l.worldLag)).toBeLessThan(200);
  });

  it("marks an event over 1 s before its cast's start (fc63 57.48 s: a press at 55.10 s), and counts it apart", () => {
    expect(lags.find((l) => l.log === "fc63" && Math.abs(l.start - 57480) < 50)?.odd).toBe("event before the start");
    expect(eventLagsView(data, logs, { operators: [typhoeus] })).toMatch(/Typhoeus combo +n= *\d+ \(plain +\d+\) {2}median \+0\.\d\d.*not counted: \d+ event before the start/);
  });
});
