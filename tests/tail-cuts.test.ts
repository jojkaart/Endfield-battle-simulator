// The replay's unlogged tails (engine assumption unlogged-tails `cut`: packages/logs replayrun.ts tailCuts): a cast
// whose landings after its last logged one are none of them in the log, the enemy there, ends after it.
// pending/zmdlogs-0c14fb3ce77d.json: Rossi's battle skill at 35.40 s lands its two charge hits (35.94, 36.06 s) and
// then neither her Lift (frame 35) nor the wolves and their bleed; her 52.04 s battle skill, with no Vulnerable stack
// left, takes no follow-up (its Lift's hit logged at 53.55 s, no Lift status, no wolves), so it isn't cut.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const fx = (devFixtures({ ids: ["0c14"] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx;
const ROSSI = "chr_0028_wulfa";
const SKILL = `${ROSSI}_normal_skill`;

describe("unlogged tails (0c14's Rossi)", () => {
  const { replay } = logBuffReplay(data, fx);
  it("cuts her 35.40 s battle skill after its last logged landing, and only casts the rule names", () => {
    const rossi = replay.tailCuts.filter((x) => x.cast.operator === ROSSI);
    expect(rossi.map((x) => [x.cast.skillId, Math.round(x.cast.start / 10) * 10])).toEqual([[SKILL, 35400]]);
    const last = Math.max(...(rossi[0]?.cast.landings ?? []).map((l) => l.frame));
    expect(rossi[0]?.frame).toBe(last);
  });

  // c83c75d02a85: Si's combo final at 56.73 s comes a frame after her last logged slash (56.70 s); an end at the frame
  // after that slash ran after the frame's hits (schedule.ts IN_FRAME) and let the final land (374k, 5.0% of the fight).
  it("cuts a tail landing the frame after the last logged one (c83c's Si combo final)", () => {
    const c83c = (devFixtures({ ids: ["c83c"] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx;
    const r = logBuffReplay(data, c83c).replay;
    const finals = r.hits.filter((h) => h.operator === "chr_0036_jsspsi" && h.skillId === "chr_0036_jsspsi_combo_skill" && h.hitId === "final" && h.frame >= 1695 && h.frame <= 1710);
    expect(finals).toEqual([]);
  });

  // Round 18 (the replay-only report point 3): a guard that keeps a tail says so (TAILKEPT), as a cut does (TAILCUT).
  it("records the tails its guards kept, with the guard (TAILKEPT)", () => {
    const kept = replay.tailsKept.filter((x) => x.cast.operator === ROSSI);
    expect(kept.length).toBeGreaterThan(0);
    for (const k of kept) {
      expect(replay.tailCuts.some((c) => c.cast === k.cast)).toBe(false);
      expect(k.why).toMatch(/logged hit|away stretch|last hit|another cast's|new run of/);
    }
    // Under `kept` the cut's rule doesn't run: no guard to report.
    expect(logBuffReplay(data, fx, undefined, { assume: { "unlogged-tails": "kept" } }).replay.tailsKept).toEqual([]);
  });

  it("lands none of its Lift, wolves or bleed; under `kept` they come back", () => {
    const tail = (hits: typeof replay.hits) => hits.filter((h) => h.operator === ROSSI && h.skillId === SKILL && h.frame >= 1095 && h.frame <= 1120);
    expect(tail(replay.hits).map((h) => h.hitId)).toEqual([]);
    const kept = logBuffReplay(data, fx, undefined, { assume: { "unlogged-tails": "kept" } }).replay;
    expect(kept.tailCuts).toEqual([]);
    expect(new Set(tail(kept.hits).map((h) => h.hitId))).toEqual(new Set(["bleed", "lift", "wolf_1", "wolf_2", "wolf_3", "wolf_4"]));
  });
});
