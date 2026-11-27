// Landings the replay made that the log never shows (the replay-only side of the fight totals, docs/accuracy.md "Where
// the total's error lives"), and the rules that stop them: a logged kill's gap (engine assumption kill-gaps), a tail
// whose effects came from another cast (replayrun.ts tailCuts), a final whose value the placement couldn't place
// (logcasts.ts nominalScales), a burst whose arrow's cast the pass's stops hid
// (logcasts.ts joinDelayed). Each on the log that showed it.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, engineHits, engineReport, logBuffReplay, placeHits, type LogFixture, type LogHit } from "@efsim/logs";
import { killGaps } from "../packages/logs/src/enginecheck.ts";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;
const frameOf = (ms: number) => Math.round((ms * 30) / 1000);

describe("a logged kill's gap (kill-gaps `absent`)", () => {
  const fx = fixture("9c6e");
  const T = "chr_0034_typhoea";

  it("starts at a hit capped at the HP left, before the fight's last hit, and ends at the next logged hit", () => {
    const gaps = killGaps(fx);
    expect(gaps.some((g) => g.from === 63337 && g.to === 67635)).toBe(true);
    const last = Math.max(...fx.hits.map((h) => h.t));
    expect(gaps.every((g) => g.from < last)).toBe(true);
  });

  // 63.34 s: Typhoeus's shot capped at 8,037 of 17,127 (a target killed); nothing is logged until 67.64 s, where the
  // replay landed her Power Shot's burst (160k).
  it("lands none of Typhoeus's hits inside it; under `there` her burst comes back", () => {
    const inGap = (hits: readonly { operator: string; hitId: string; frame: number }[]) => hits.filter((h) => h.operator === T && h.frame >= frameOf(63337 + 150) && h.frame <= frameOf(67635 - 150)).map((h) => h.hitId);
    expect(inGap(logBuffReplay(data, fx).replay.hits)).toEqual([]);
    const there = logBuffReplay(data, fx, { assume: { "kill-gaps": "there" } });
    expect(inGap(there.replay.hits)).toContain("burst");
    // Round 18 (the replay-only report point 4): the totals' one-sided landings inside a kill gap carry the `kill` flag.
    const oneSided = engineReport(data, fx, there, engineHits(data, fx, there)).totals.oneSided;
    const flagged = oneSided.filter((o) => o.flags.includes("kill"));
    expect(flagged.some((o) => o.side === "replay" && o.operator === T && o.t > 63337 && o.t < 67635)).toBe(true);
    expect(flagged.every((o) => killGaps(fx).some((g) => o.t > g.from && o.t < g.to))).toBe(true);
  });
});

describe("an unlogged tail's effects (tailCuts)", () => {
  // d774: Zhuang Fangyi's Empyrean battle skill at 103.28 s, three strikes logged (104.18–104.50 s); a gear set's team
  // ATK that Arcane's ultimate hit started at 107.07 s, two frames before a tail strike, kept six strikes and a 152k final.
  it("a buff run another cast started in the tail's time doesn't keep the tail (d774's Zhuang Fangyi)", () => {
    const { replay } = logBuffReplay(data, fixture("d774"));
    const ZF = "chr_0030_zhuangfy";
    const cut = replay.tailCuts.find((x) => x.cast.operator === ZF && x.cast.skillId === `${ZF}_normal_skill_ult` && Math.abs(x.cast.start - 103282) < 50);
    expect(cut).toBeDefined();
    const tail = replay.hits.filter((h) => h.operator === ZF && h.skillId === `${ZF}_normal_skill_ult` && h.frame > frameOf(104600) && h.frame < frameOf(108000));
    expect(tail).toEqual([]);
  });
});

describe("slots by value", () => {
  const key = "chr_0036_jsspsi_combo_skill_abilityrange";
  // Si's combo final: atk_scale2 + count × atk_scale2_1, ×11–20 a slash, a value expression without one multiplier.
  it("a final whose multiplier reads its event's count takes the final's slot (6339 11.31 s, capped, 121,248 uncapped)", () => {
    const fx = fixture("6339");
    const p = placeHits(data, fx);
    const finals = fx.hits.filter((h) => h.t === 11308 && h.event === key).map((h) => p.hits.get(h)?.frame);
    expect(finals).toContain(49);
  });
});

describe("a delayed landing across stops the pass misplaced (joinDelayed)", () => {
  // fc63 43.58 s: Typhoeus's burst 3.6 s after her arrow at 39.94 s, held by Gilberta's and Perlica's ultimates; pass 1
  // placed Gilberta's at 41.60 s (from its hit alone), so pass 2's stops held it 1.8 s, not 3.4, and the burst made a
  // shot the log doesn't have.
  it("joins the latest cast without its landing when the stops between, laid end to end, hold it that long", () => {
    const fx = fixture("fc63");
    const p = placeHits(data, fx);
    const T = "chr_0034_typhoea";
    const at = (t: number, suffix: string) => p.hits.get(fx.hits.find((h) => h.operator === T && h.t === t && h.event.endsWith(suffix)) as LogHit);
    expect(at(43584, "natural_triggered_typhoea")?.cast).toBe(at(39936, "floating_attack1_01_projhit")?.cast);
    const onlyDelayed = p.casts.filter((c) => c.operator === T && [...p.hits].filter(([, x]) => x.cast === c).every(([, x]) => x.hits.some((k) => k.enemyDelay !== undefined)));
    expect(onlyDelayed).toEqual([]);
  });
});
