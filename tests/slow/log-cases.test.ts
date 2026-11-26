// Single cases of the log check that need a whole log checked (25–50 s each alone, 2026-11-16): moved here from the
// default suite (tests/buffreplay.test.ts, tests/batch4-logs2.test.ts, tests/batch4-values.test.ts), where they set the
// suite's wall time and ran near the timeout under load. `npm run test:logs` runs them.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, readLogFixture } from "@efsim/cli";
import { loggedCastFates, replayView } from "@efsim/logs";

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

// Kit buff leads (2026-11-24): the Empyrean's end is logged under her ultimate's key.
describe("Zhuang Fangyi: the Empyrean's end logged as an ultimate_skill cast event", () => {
  it("4bfc: the events at 92.68 and 179.51 s are the Empyrean's end, not casts; her hits after 92.68 s match without Lone Barge's ultimate buff", () => {
    const Z = "chr_0030_zhuangfy";
    const fx = fixtureFile("pending/zmdlogs-4bfc6f3e84b8.json");
    // Both events are the Empyrean's tick by their key (loggedCastFates), and the replay reads both so: at 179.51 s its
    // Empyrean ends on the event's own frame (the advance to it has ticked and ended it: holdinputs.ts endedWithTick;
    // before 2026-11-25 the replay made a real ultimate there, a 78-frame stop).
    const fates = loggedCastFates(data, fx).filter((e) => e.operator === Z && e.fate === "tick").map((e) => (e.t / 1000).toFixed(2));
    for (const t of ["92.68", "179.51"]) expect(fates).toContain(t);
    const view = replayView(data, fx, { operators: [Z] });
    expect(view).toContain("92.68  EVENT  Zhuang Fangyi ultimate_skill (the log's cast event): a tick of empyrean");
    expect(view).toContain("179.51  EVENT  Zhuang Fangyi ultimate_skill (the log's cast event): a tick of empyrean");
    // The frame boundary in frames (remaining-leads report point 4): the instance ended on the event's own frame.
    expect(view).toMatch(/179\.51 {2}EVENT .*that ended on this very frame: its last tick \(its last instance 144\.37–179\.50 ended at frame 5385, the event's frame 5385\)/);
    // Her first ultimate's Lone Barge buff is listed to 91.62 s; the next hits list none (the log has no second run until 144.37 s).
    const after = checkLog(data, fx).filter((v) => v.hit.operator === Z && v.hit.t >= 92900 && v.hit.t <= 119300 && /normal_skill_ult|sword_triggerd/.test(v.hit.event));
    // 27 hits, plain but one (110.37 s, a Sunderblade strike off for another reason); with the buff they read ×0.849.
    expect(after.length).toBe(27);
    expect(after.filter((v) => v.kind === "match" && v.class === "plain").length).toBeGreaterThanOrEqual(26);
  });
});

// The cooldown-clock round (2026-11-24): engine assumption finisher-stagger.
describe("a finisher's hits after the Stagger's end", () => {
  it("7e19: Ember's finisher hit_2 at 33.15 s, after the log's Stagger ended, deals with the Staggered parts: both hits off only by her talent's unlisted layers", () => {
    const E = "chr_0009_azrila";
    const v = checkLog(data, fixtureFile("pending/zmdlogs-7e19489ae503.json")).filter((x) => x.hit.operator === E && x.hit.event === `${E}_power_attack`);
    expect(v.map((x) => x.hit.t)).toEqual([30861, 33152]);
    // Since the check counts her listed Pay the Ferric Price (2026-11-26, loggedEntries by its own game buff), what's left
    // is one and two more of its +0.09 ATK layers, which the log lists as one entry (open-problems, 7e19 Ember): ×1.046
    // and ×1.096. Without the Staggered parts hit_2 read ×1.564. Since 2026-11-26 (away and presses) the check reads a
    // layered unjudged buff listed once at each count to its maximum: hit 1 fits at 2 layers; hit_2's ×1.096 stays, the
    // log listing no run of it then (its lane 24.85–31.85 s, the layer that refreshed it past that unlisted).
    const [first, second] = v;
    expect(first?.kind === "match" && first.assumptions.some((a) => a.kind === "layers" && a.n === 2)).toBe(true);
    expect(second?.kind === "mismatch" ? second.ratio : NaN).toBeCloseTo(1.096, 2);
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
