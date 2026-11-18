// Arcane in INT mode against her logs (in-game tests 51 and 7, decided by the logs 2026-11-18): Solemn Phalanx's INT
// Arts DMG on the Corrosion her battle skill's infliction forms, and her second ultimate's own Amp, gone by her next
// basic attack.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, readLogFixture, type HitVerdict } from "@efsim/logs";

const data = loadGameData();
const A = "chr_0032_lizhiyan";
const verdicts = (id: string) => checkLog(data, readLogFixture(new URL(`../fixtures/pending/zmdlogs-${id}.json`, import.meta.url).pathname));
const at = (vs: readonly HitVerdict[], t: number, event: string) => vs.filter((v) => v.hit.operator === A && v.hit.t === t && v.hit.event === event);
const predicted = (v: HitVerdict) => ("predicted" in v ? (typeof v.predicted === "number" ? v.predicted : v.predicted[0]) : undefined);

describe("a7a7a40c97ed (INT, Solemn Phalanx at +0.44)", () => {
  const vs = verdicts("a7a7a40c97ed");
  it("her Corrosion's own hit at 3859 ms has the INT Arts DMG her battle skill's infliction creates: plain exact (it was ×0.76 without)", () => {
    const [v] = at(vs, 3859, "buff_common_natural_triggered");
    expect(v?.kind).toBe("match");
    expect(v && "class" in v ? v.class : null).toBe("plain");
  });
  it("her second ultimate's hit at 56208 ms and her battle skill right after (56338 ms) keep the ultimate's own Amp", () => {
    for (const [t, event] of [[56208, `${A}_ultimate_skill2`], [56338, `${A}_normal_skill_abilityrange2`]] as const) {
      const [v] = at(vs, t, event);
      expect(v && "class" in v ? v.class : null).toBe("plain");
    }
  });
});

describe("891566c224f8 (INT; its stage factor ends at 86.8 s)", () => {
  const vs = verdicts("891566c224f8");
  it("her basic attacks after the second ultimate (99400 ms) lack the Gloompurge Amp: within 2% of the log (×0.84 with it)", () => {
    const hits = at(vs, 99400, `${A}_attack1`);
    expect(hits.length).toBeGreaterThan(0);
    for (const v of hits) expect(Math.abs((predicted(v) ?? 0) / v.hit.value - 1)).toBeLessThan(0.02);
  });
});
