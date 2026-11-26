// `efsim zmdlogs boundaries` (packages/logs/src/boundaryview.ts, round 16, the arcane-will report point 3): at a hit
// where a kit buff's logged run starts or ends, whether the hit reads with it or without it, per kit buff and side.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { boundaryRows, boundaryView, type Counterfactual, type HitRecord, type LogEffect } from "@efsim/logs";
import { logHitOf, syntheticFixture } from "./helpers/synthetic.ts";
import { plainBuild } from "./helpers/zmdlogs.ts";

const data = loadGameData();
const SI = "chr_0036_jsspsi";
const KIT = `${SI}:combo_p2_atk`;

describe("a kit buff's boundary hits, with it or without it", () => {
  const effect = (since: number): LogEffect => ({ buff: "buff_chr_0036_jsspsi_combo_potential2", zone: "atk", element: null, value: 0.2, source: SI, since });
  // At 1.00 s the run starts (its since), at 5.00 s it ends (listed since 1.00 s).
  const hits = [logHitOf(SI, 1000, "combo", 120, { boundaryEffects: [effect(1000)] }), logHitOf(SI, 5000, "combo", 100, { boundaryEffects: [effect(1000)] }), logHitOf(SI, 6000, "combo", 100)];
  const fx = syntheticFixture(hits, [plainBuild(SI)], { enemy: "e", level: 1 });
  const record = (t: number, value: number, predicted: number, cfs: Counterfactual[]) => ({ fixture: "synthetic", t, operator: SI, event: "combo", kind: "skill", value, crit: false, verdict: "match", class: "plain", predicted, error: 0, listed: [], counterfactuals: cfs }) as unknown as HitRecord;
  const records = [
    // The start: the engine hadn't it; with the log's entries it fits.
    record(1000, 120, 100, [{ what: KIT, kind: "boundary on", engineHas: false, reading: 120 }]),
    // The end: the engine had it; the primary (with it) is off, without it fits.
    record(5000, 100, 120, [{ what: KIT, kind: "boundary on", engineHas: true, reading: 140 }, { what: KIT, kind: "boundary off", engineHas: true, reading: 100 }]),
    record(6000, 100, 100, []),
  ];

  it("tells a run's start from its end by the entry's since, and counts what fits", () => {
    const rows = boundaryRows(data, records, () => fx);
    expect(rows).toEqual([
      { kitBuff: KIT, side: "end", hits: 1, engineOn: 1, withIt: 0, withoutIt: 1, both: 0, neither: 0, logs: 1 },
      { kitBuff: KIT, side: "start", hits: 1, engineOn: 0, withIt: 1, withoutIt: 0, both: 0, neither: 0, logs: 1 },
    ]);
    const text = boundaryView(rows, 1);
    expect(text).toMatch(/^ {2}end {7}1 hits: with it {4}0, without {4}1/m);
    expect(text).toMatch(/^total start {5}1 hits: with it {4}1/m);
    expect(boundaryRows(data, records, () => fx, { kitBuff: /nothing/ })).toEqual([]);
  });
});
