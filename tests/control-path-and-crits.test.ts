// Two readings of the 0c14 round (2026-11-26):
// - a teammate's attack on its kit's not-controlled path (engine drivers.ts controlPathLandings): Rossi's attack 4
//   jumps 0 → 189 to hit_ai (× 0.5 a hit, the controlled path × 0.2) when she isn't controlled, as the log shows at
//   0c14's 154.09 s (Si controlled) and 2fd9's 8.71 s (Mi Fu); with her controlled (0c14's 44.39 s), the controlled
//   path (d572's 9.89 s stays hit_ai: the placement put 7 landings in one cast of 5 hits, so they aren't moved);
// - a crit-unknown hit's crit read from its value in the totals (engine assumption totals-crits `read`): 0c14's Rossi
//   ultimate stab at 25.45 s, 8,790, her crit reading ×0.993, counted at it, not at expected crits (its final at
//   27.74 s, the round's case at ×1.032, reads exactly since Alesh's 12.0 s combo from the listing:
//   listed-paths.test.ts).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, devFixtures, engineHits, engineReport, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const ROSSI = "chr_0028_wulfa";
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx;

describe("a teammate's attack 4 on its not-controlled path", () => {
  const landed = (id: string, t: number) => {
    const fx = fixture(id);
    const { replay } = logBuffReplay(data, fx);
    const h = fx.hits.find((x) => x.operator === ROSSI && x.event === `${ROSSI}_attack4` && x.t === t);
    const l = h ? replay.landing(h) : undefined;
    return l && !("unknown" in l) ? l.hitId : undefined;
  };
  it("lands hit_ai where the log shows someone else controlled", () => {
    expect(landed("0c14", 154094)).toBe("hit_ai");
    expect(landed("2fd9", 8711)).toBe("hit_ai");
  });
  it("lands the controlled path's hit where the log shows her controlled", () => {
    expect(landed("0c14", 44392)).toBe("hit");
  });
});

describe("totals-crits", () => {
  const fx = fixture("0c14");
  const final = (assume: Record<string, string>) => {
    const replay = logBuffReplay(data, fx, undefined, { assume });
    const byHit = engineHits(data, fx, replay);
    const t = engineReport(data, fx, replay, byHit, checkLog(data, fx, { replay, engineHits: byHit })).totals;
    return t.parts.find((p) => p.logged?.operator === ROSSI && p.logged.t === 25446 && p.logged.value === 8790)?.damage;
  };
  it("counts a crit-unknown hit at the crit its value shows under `read`, at expected crits under `expected`", () => {
    const read = final({}) as number;
    const expected = final({ "totals-crits": "expected" }) as number;
    expect(Math.abs(read / 8790 - 1)).toBeLessThan(0.02);
    expect(expected).toBeLessThan(0.85 * 8790);
  });
});

