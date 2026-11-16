// Single cases of the log check that need a whole log checked (25–50 s each alone, 2026-11-16): moved here from the
// default suite (tests/buffreplay.test.ts, tests/batch4-logs2.test.ts, tests/batch4-values.test.ts), where they set the
// suite's wall time and ran near the timeout under load. `npm run test:logs` runs them.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, readLogFixture } from "@efsim/cli";

const data = loadGameData();
const fixtureFile = (path: string) => readLogFixture(new URL(`../../fixtures/${path}`, import.meta.url).pathname);

// From tests/buffreplay.test.ts.
describe("what a hit's reaction triggers before its damage", () => {
  // One test per fixture: each is a whole log check (about half a minute alone).
  for (const [f, times] of [["3f78ceb15bc3", [1334, 46994]], ["4a64e58e75ad", [4517]]] as const) {
    it(`Hot Work's Nature DMG, made by a Corrosion, counts on the hit that forms it, not on the Corrosion's own hit (${f.slice(0, 4)} at ${times.join(" and ")} ms)`, () => {
      const A = "chr_0032_lizhiyan";
      const fx = fixtureFile(`pending/zmdlogs-${f}.json`);
      const at = checkLog(data, fx).filter((v) => v.hit.operator === A && (times as readonly number[]).includes(v.hit.t));
      expect(at.length).toBe(2 * times.length);
      expect(at.every((v) => v.kind === "match" && v.class === "plain")).toBe(true);
    });
  }
});

// From tests/batch4-logs2.test.ts.
describe("unquantified buffs valued from the kit buff that stands for them", () => {
  it("4e5e: Lustrous Carmine's ATK (once hand-annotated as unquantified), valued from Camille's weapon kit, matches all 85 of her hits", () => {
    // The fixture no longer lists it after 49418 ms (the kit-buff replay keeps it on: tests/buffreplay.test.ts); written back in as
    // the old annotation had it, the kit values it.
    const fx = fixtureFile("zmdlogs-4e5e1390085e.json");
    const unq = { buff: "buff_wpn_lance_0015_atkup", since: 49418, source: "chr_0033_camille" };
    const annotated = { ...fx, hits: fx.hits.map((h) => (h.t >= 49418 ? { ...h, unquantified: [...h.unquantified, unq] } : h)) };
    const v = checkLog(data, annotated, { buffs: "log" }).filter((x) => x.hit.operator === "chr_0033_camille");
    expect(v.filter((x) => x.kind === "match")).toHaveLength(85);
    expect(v.some((x) => x.kind === "match" && x.assumed.includes("unquantified buff_wpn_lance_0015_atkup from kit wpn_lance_0015.atk"))).toBe(true);
  });
});

// From tests/batch4-values.test.ts.
describe("V2: periodic damage keeps its applier's attacker side (takeAtkSnapshot)", () => {
  it("zmdlogs check: 4e5e's three Combustion ticks match with Camille's DMG bonuses at the reaction (Lustrous Carmine's ATK applied)", () => {
    const fx = fixtureFile("zmdlogs-4e5e1390085e.json");
    // Lustrous Carmine's ATK +9.6% acts on every hit from 49418 ms, where the log stops listing it (the kit-buff replay keeps it on).
    const atk = { buff: "buff_wpn_lance_0015_atkup", zone: "atk" as const, element: null, value: 0.096 };
    const quantified = { ...fx, hits: fx.hits.map((h) => (h.t >= 49418 && !h.effects.some((e) => e.buff === atk.buff) ? { ...h, effects: [...h.effects, atk] } : h)) };
    const ticks = checkLog(data, quantified, { buffs: "log" }).filter((v) => v.hit.event === "buff_common_burning_status");
    expect(ticks.map((v) => [v.hit.t, v.kind])).toEqual([[66004, "match"], [67447, "match"], [68449, "match"]]);
  });
});
