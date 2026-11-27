// `zmdlogs holds <fixture> --steps <from>-<to>` (views.ts holdsSteps; round 19, backlog after round 18 point 3): the
// hidden holds' per-frame steps in a window beside the applied slow-downs and the log's breaks. 5082ceaffad1 around
// Yvonne's Stagger break at 44.43 s: 1-frame steps either side of the break's 14-frame hold.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, holdsSteps } from "@efsim/logs";

const data = loadGameData();

describe("zmdlogs holds --steps (5082's break)", () => {
  it("lists each hold step with the hold so far, the break and its stop, in time order", () => {
    const fx = (devFixtures({ ids: ["5082"] })[0] as { fx: Parameters<typeof holdsSteps>[1] }).fx;
    const text = holdsSteps(data, fx, 43000, 46000);
    expect(text).toMatch(/^zmdlogs-5082ceaffad1: the hidden holds' steps 43\.00–46\.00 s/);
    expect(text).toMatch(/^ +\d+\.\d\d {2}HOLD {2}frame \d+: 1 frame\(s\), 1 in the window, \d+ from the start$/m);
    expect(text).toMatch(/^ +44\.43 {2}BREAK /m);
    expect(text).toMatch(/^ +44\.43 {2}STOP {2}.* 14 frame\(s\) to 44\.90, holds 14\.0 world frame\(s\)$/m);
    const times = [...text.matchAll(/^ +(\d+\.\d\d) {2}/gm)].map((m) => Number(m[1]));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
