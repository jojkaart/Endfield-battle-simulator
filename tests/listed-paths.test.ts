// Casts and paths the log shows only through their listed buffs (2026-11-26, Alesh's Rare Fin combos):
// - a chance jump the log decides (engine drivers.ts replayCast `chanceJumps`): not rolled, its landings on its path's hits;
// - the replay's chance paths from the listing (castassembly.ts listedPaths): her P3 team ATK, which only the Rare Fin
//   slam gives, listed from exactly that slam's ms (0c14 60.13 s), the other combos on the normal path;
// - a cast made from the listing alone (castsFromHitBuffs, engine assumption listed-casts `inferred`): 0c14's combo at
//   about 12.0 s, no hit or cast event of it, its P3 listed from 13.25 s and its hook's natural SP the second Thermite
//   Cutter layer from 12.71 s.
import { describe, expect, it } from "vitest";
import { advance, createContext, init, replayCast, type TimelineScenario } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";
import { checkLog, devFixtures, engineHits, engineReport, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const A = "chr_0024_deepfin";
const COMBO = `${A}_combo_skill`;
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx;

describe("a chance jump the log decides (replayCast chanceJumps)", () => {
  const example = readScenario(new URL("../examples/alesh-estella.scenario.json", import.meta.url).pathname);
  const sc: TimelineScenario = { ...example, team: example.team.filter((b) => b.operator === A), startEnergy: {}, options: { ...example.options, crit: "never" } };
  const combo = (taken: boolean, seed: number, landings: { hitId: string; nth: number; frame: number }[] = []) => {
    const ctx = createContext(data, { ...sc, options: { ...sc.options, seed } });
    const st = advance(ctx, replayCast(ctx, init(ctx), A, COMBO, 30, { chanceJumps: { rare_fin: taken }, landings }), 10 * 30);
    return st.hits.filter((h) => h.operator === A).map((h) => [h.hitId, h.frame - 30]);
  };
  it("takes the Rare Fin path when the log says so, whatever the battle's seed: hook_ex and slam_ex at 22 and 38 from the cast", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) expect(combo(true, seed)).toEqual([["hook_ex", 22], ["slam_ex", 38]]);
  });
  it("the normal path when it says not, whatever the seed", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) expect(combo(false, seed)).toEqual([["hook", 22], ["slam", 38]]);
  });
  it("its logged landings go to the path's hits (the same keys at the same frames from the cast's start)", () => {
    const pinned = [{ hitId: "hook", nth: 0, frame: 30 + 23 }, { hitId: "slam", nth: 0, frame: 30 + 39 }];
    expect(combo(true, 1, pinned)).toEqual([["hook_ex", 23], ["slam_ex", 39]]);
    expect(combo(false, 1, pinned)).toEqual([["hook", 23], ["slam", 39]]);
  });
});

describe("Alesh's combo paths and cast from the listing (0c14)", () => {
  const fx = fixture("0c14");
  const r = logBuffReplay(data, fx);
  const landedAs = (t: number) => {
    const h = fx.hits.find((x) => x.operator === A && x.event === COMBO && x.t === t);
    const l = h ? r.replay.landing(h) : undefined;
    return l && !("unknown" in l) ? l.hitId : undefined;
  };
  it("lands the 59.56 s combo on the Rare Fin path (P3 listed from its slam's 60.13 s) and the 199.03 s one on the normal path", () => {
    expect([landedAs(59560), landedAs(60129)]).toEqual(["hook_ex", "slam_ex"]);
    expect([landedAs(199033), landedAs(199464)]).toEqual(["hook", "slam"]);
    expect(r.replay.unjudgedKitBuffs.has(`${A}:p3_atk`)).toBe(false);
  });
  it("makes the 12.0 s combo the log shows only by its P3 and Thermite layer; its landings count for nothing in the totals", () => {
    const made = r.replay.made.find((m) => m.cast.listed !== undefined);
    expect(made?.cast.operator).toBe(A);
    expect(made?.frame).toBeGreaterThan(11.2 * 30);
    expect(made?.frame).toBeLessThan(12.5 * 30);
    const byHit = engineHits(data, fx, r);
    const totals = engineReport(data, fx, r, byHit, checkLog(data, fx, { replay: r, engineHits: byHit })).totals;
    expect(totals.parts.some((p) => p.logged === undefined && p.operator === A && p.frame < 14 * 30 && p.damage > 0)).toBe(false);
  });
  it("puts the second Thermite Cutter layer on the team from 12.7 s: Si's combo hits at 13.3–14.2 s match", () => {
    const si = checkLog(data, fx, { replay: r }).filter((v) => v.hit.operator === "chr_0036_jsspsi" && v.hit.t >= 13300 && v.hit.t <= 14200);
    expect(si.length).toBeGreaterThanOrEqual(5);
    expect(si.every((v) => v.kind === "match")).toBe(true);
  });
  it("isn't made under listed-casts `none`", () => {
    expect(logBuffReplay(data, fx, undefined, { assume: { "listed-casts": "none" } }).replay.made.some((m) => m.cast.listed !== undefined)).toBe(false);
  });
});
