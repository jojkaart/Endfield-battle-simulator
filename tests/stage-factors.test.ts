// A stage's damage factor (LogFixture.stageFactors; packages/logs enginecheck.ts stageModifiers): c6d8's stage
// (indie_hard011_s) scales every hit from 15.75 to 75.59 s by ×0.1, which no table the project reads has and no listed
// buff marks; the fixture's window puts it into every reading and the fight's totals.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, hitRecords, stageFight, stageModifiers, stageNote } from "@efsim/logs";
import { readLogFixture } from "@efsim/cli";

const data = loadGameData();
const c6d8 = readLogFixture(new URL("../fixtures/pending/zmdlogs-c6d80590f5ea.json", import.meta.url).pathname);

describe("stage factors", () => {
  it("are a multiplicative modifier from a window's first ms up to its end, none outside", () => {
    const fx = { stageFactors: [{ from: 1000, to: 2000, factor: 0.2, why: "" }] };
    expect(stageModifiers(fx, 999)).toEqual([]);
    expect(stageModifiers(fx, 1000)).toEqual([{ zone: "multiplicative", value: -0.8, source: "stage factor ×0.2" }]);
    expect(stageModifiers(fx, 1999)[0]?.value).toBeCloseTo(-0.8);
    expect(stageModifiers(fx, 2000)).toEqual([]);
    expect(stageModifiers({}, 1500)).toEqual([]);
  });

  it("let the check judge the rest of a stage window's hits (c6d8 ×0.1: most of them plain, none plain without it)", () => {
    const inside = (fx: typeof c6d8) => hitRecords(data, fx).filter((r) => r.t >= 15750 && r.t < 76585);
    const withIt = inside(c6d8);
    const without = inside({ ...c6d8, stageFactors: [] });
    const plain = (rs: typeof withIt) => rs.filter((r) => r.class === "plain").length;
    expect(withIt.length).toBeGreaterThan(400);
    expect(plain(withIt)).toBeGreaterThan(0.75 * withIt.length);
    expect(plain(without)).toBeLessThan(0.05 * without.length);
  });
});

describe("a stage factor in the views and the scoreboard (round 17)", () => {
  it("prints a replay landing's damage as the check reads it there (the Arcane stage-factors report point 3)", () => {
    expect(stageNote(c6d8, 67014, 20000)).toBe(" (×0.1 stage: 6701)");
    expect(stageNote(c6d8, 67014, 10000)).toBe("");
  });

  it("tells a stage fight by its stageFactors, a stage status or its enemy (the snapshots' `stage` key)", () => {
    expect(stageFight(c6d8)).toMatch(/stageFactors/);
    const by = (id: string) => stageFight((devFixtures({ ids: [id] })[0] as { fx: typeof c6d8 }).fx);
    expect(by("207f")).toMatch(/stage status/);
    expect(by("6339")).toMatch(/shield and phase/);
    expect(by("4d60")).toBeNull();
  });
});
