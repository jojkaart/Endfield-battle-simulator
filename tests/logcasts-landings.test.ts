// How logged hits are grouped into casts (packages/logs/src/logcasts.ts), on real logs: a cast's later landings across
// time stops, triggers' landings, an Arts Burst's delay and the build offsets (split from tests/logcasts.test.ts, round
// 17: 54–67 s together).

import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { type LogHit } from "@efsim/logs";
import type { Build } from "@efsim/engine";
import { readLogFixture } from "@efsim/cli";
import { distinctCasts, placeHits } from "../packages/logs/src/logcasts.ts";

const data = loadGameData();

describe("a later landing of a cast across time stops", () => {
  it("joins its cast: the log's time runs on through every stop, the operator's own ultimate's and a hitless one the log only names (Ardelia's combo bomb in 5082, 6.4 s after its projectile)", async () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-5082ceaffad1.json", import.meta.url).pathname);
    const A = "chr_0025_ardelia";
    const p = placeHits(data, fx);
    const at = (t: number, event: string) => p.hits.get(fx.hits.find((h) => h.operator === A && h.t === t && h.event === `${A}_${event}`) as LogHit)?.cast;
    // Between them Yvonne's ultimate (a logged cast without hits of its own, 38160 ms) and Ardelia's (41067 ms) stop time.
    expect(at(42441, "combo_skill_bomb")).toBe(at(36030, "combo_skill_projhit"));
    expect(distinctCasts(p).filter((c) => c.operator === A && c.kind === "combo")).toHaveLength(3);
    // Two bombs logged at one time (9c6e at 75097 ms, the second at half: another enemy's) make one combo, not two.
    const fx2 = readLogFixture(new URL("../fixtures/pending/zmdlogs-9c6e97486a9d.json", import.meta.url).pathname);
    const p2 = placeHits(data, fx2);
    const bombs = fx2.hits.filter((h) => h.operator === A && h.t === 75097);
    expect(bombs).toHaveLength(2);
    expect(new Set(bombs.map((h) => p2.hits.get(h)?.cast)).size).toBe(1);
    expect(distinctCasts(p2).filter((c) => c.operator === A && c.kind === "combo")).toHaveLength(4);
    // The replay lands one combo per logged one.
    const { logBuffReplay } = await import("@efsim/cli");
    expect(logBuffReplay(data, fx).replay.hits.filter((h) => h.operator === A && h.hitId === "bomb")).toHaveLength(3);
  });

  it("a key shared by a skill and its follow-up is the follow-up while a cast that lists it is still acting, in the world's time, though a basic attack came between (489c: Wulfgard's combo 3 perfect hit)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-489c0be3e162.json", import.meta.url).pathname);
    const W = "chr_0028_wulfa";
    const p = placeHits(data, fx);
    const cast = (t: number, event: string) => p.hits.get(fx.hits.find((h) => h.operator === W && h.t === t && h.event === event) as LogHit)?.cast;
    // Combo 2 at 104058 ms, its ticks at 106391 ms after Li Zhiyan's ultimate (106055 ms): one cast.
    expect(cast(106391, `buff_${W}_combo_2_damage`)).toBe(cast(104058, `${W}_combo_2_skill`));
    // Its follow-up's perfect hit at 107319 ms, logged under combo 2's key, after an attack 3 at 104058 ms.
    expect(cast(107319, `${W}_combo_2_skill`)?.skillId).toBe(`${W}_combo_3_skill`);
  });

  it("a first landing the perfect path would start inside the cast before is the jumped path's (3f78 50.55 s: Rossi's sequence 2 late, from 50.05 s, after sequence 1's window at its frame 37)", async () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-3f78ceb15bc3.json", import.meta.url).pathname);
    const W = "chr_0028_wulfa";
    const p = placeHits(data, fx);
    const placed = p.hits.get(fx.hits.find((h) => h.operator === W && h.t === 50552 && h.event === `${W}_combo_2_skill`) as LogHit);
    expect(placed?.cast.skillId).toBe(`${W}_combo_3_skill`);
    expect(placed?.hits.map((h) => h.id)).toEqual(["late"]);
    expect(Math.round(placed?.cast.start ?? 0)).toBe(50052);
    // The record of the paths it had (LoggedCast.paths; round 17, the exposed-totals report point 3): slot 0 at frame 29,
    // not allowed by sequence 1's window; the late hit at 227 on the jump 0 → 212, allowed.
    expect(placed?.cast.paths?.map((x) => [x.hitId, x.frame, x.jump, Math.round(x.start), x.allowed])).toEqual([["perfect", 29, null, 49585, false], ["late", 227, { at: 0, to: 212 }, 50052, true]]);
    // The replay takes the jump by the kit's own condition: no perfect hit, no extra Vulnerable, no cast inside sequence 1.
    const { logBuffReplay } = await import("@efsim/cli");
    const r = logBuffReplay(data, fx).replay;
    expect(r.hits.filter((h) => h.operator === W && h.skillId === `${W}_combo_3_skill` && Math.abs(h.frame - 1517) < 10).map((h) => h.hitId)).toEqual(["late"]);
    // Every other cast of hers keeps its perfect path (489c: 107.32 s).
    const fx2 = readLogFixture(new URL("../fixtures/pending/zmdlogs-489c0be3e162.json", import.meta.url).pathname);
    const p2 = placeHits(data, fx2);
    expect(p2.hits.get(fx2.hits.find((h) => h.operator === W && h.t === 107319 && h.event === `${W}_combo_2_skill`) as LogHit)?.hits.map((h) => h.id)).toEqual(["perfect"]);
  });

  it("a logged landing a jump would skip: the replay drops the jump and its path (d572: Rossi's sequence-2 perfect hit at 39.23 s, its Lift and extra Vulnerable, no late hit)", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-d5720d9ceb94.json", import.meta.url).pathname);
    const W = "chr_0028_wulfa";
    const r = logBuffReplay(data, fx).replay;
    const near = (f: number, t: number) => Math.abs((f * 1000) / 30 - t) < 100;
    // No late hit beside the perfect one (it landed 14 frames earlier, consuming the infliction the perfect one needs).
    expect(r.hits.filter((h) => h.operator === W && h.hitId === "late" && h.frame > 1140 && h.frame < 1190)).toHaveLength(0);
    // Its Lift at the logged airborne hit, and two Vulnerable stacks (the Lift's and the perfect hit's own): 1 → 3.
    expect(r.reactions.some((e) => e.kind === "physical" && e.operator === W && e.status === "lift" && near(e.frame, 39231))).toBe(true);
    const v = r.reactions.filter((e) => e.kind === "vulnerable" && e.operator === W && near(e.frame, 39231));
    expect(v.map((e) => (e.kind === "vulnerable" ? [e.before, e.stacks] : null))).toEqual([[1, 2], [2, 3]]);
  });

  it("pinned landings of one frame land in the log's order (9a80: Rossi's perfect hit at 32489 ms consumes the infliction before Gilberta's ultimate at 32511 ms, frame 975 both)", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-9a8097fcf351.json", import.meta.url).pathname);
    const W = "chr_0028_wulfa";
    const r = logBuffReplay(data, fx).replay;
    const logged = fx.hits.find((h) => h.operator === W && h.t === 32489 && h.event === `${W}_combo_2_skill`) as LogHit;
    const l = r.landing(logged);
    // Two stacks consumed, as logged (149554); Gilberta's hit first would leave it none (67979).
    expect("unknown" in l ? null : Math.round(l.damage)).toBe(logged.value);
  });

  it("pinned landings of one logged ms land in the order of the log's Stagger bars (c4f3 7049 ms: Estella's combo shatters before Chen Qianyu's combo, his ID lower)", async () => {
    const { batchOrder, logBuffReplay } = await import("@efsim/logs");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-c4f307cd039a.json", import.meta.url).pathname);
    const E = "chr_0021_whiten";
    const C = "chr_0005_chen";
    const hit = (op: string, event: string) => fx.hits.find((h) => h.t === 7049 && h.operator === op && h.event === event) as LogHit;
    const order = batchOrder(fx.hits);
    // Her combo 274 → 264, her ultimate 254 → 234, his combo and the Lifts 234 → 224.
    expect([order.get(hit(E, `${E}_combo_skill`)), order.get(hit(E, `${E}_ultimate_skill`)), order.get(hit(C, `${C}_combo_skill`))]).toEqual([0, 1, 2]);
    const r = logBuffReplay(data, fx).replay;
    // Her combo on the Solidified enemy (its own variant), the Shatter hers; his combo and her ultimate as logged.
    const combo = r.landing(hit(E, `${E}_combo_skill`));
    expect("unknown" in combo ? null : combo.hitId).toBe("solidified");
    expect(r.reactions.filter((e) => e.kind === "shatter" && e.frame === 211).map((e) => e.operator)).toEqual([E]);
    for (const h of [hit(C, `${C}_combo_skill`), hit(E, `${E}_ultimate_skill`)]) {
      const l = r.landing(h);
      expect("unknown" in l ? null : Math.round(l.damage)).toBe(h.value);
    }
  });
});

describe("a trigger's landing on a skill's cast", () => {
  it("moves the cast to where it puts it, when earlier than the skill's own keys (Liino's song beat in dbae)", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-dbaee23b801d.json", import.meta.url).pathname);
    const L = "chr_0035_liino";
    const ult = distinctCasts(placeHits(data, fx)).find((c) => c.operator === L && c.skillId === `${L}_ultimate_skill`);
    // Her first beat (trigger ult_song, frame 77) at 8258 ms; her projectiles (frame 76) at 8613 ms put it 0.4 s later.
    expect(Math.round(ult?.start ?? NaN)).toBe(Math.round(8258 - (77 * 1000) / 30));
  });
});

describe("a trigger fired by a decorated hit", () => {
  it("is placed from the logged hits that fire it (b7b3: Tangtang's dive spouts after Arcane's plunging attack, not a battle skill of her own)", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-b7b3762d5da8.json", import.meta.url).pathname);
    const TT = "chr_0027_tangtang";
    const p = placeHits(data, fx);
    // Arcane's dive at 15374 ms; the riot spouts (trigger olden_stare_dive, first at frame 18) from 15928 ms share the
    // battle skill's key (normal_skill_water_projhit).
    const spouts = fx.hits.filter((h) => h.operator === TT && h.event === `${TT}_normal_skill_water_projhit` && h.t > 15500);
    expect(spouts.length).toBeGreaterThan(5);
    expect(new Set(spouts.map((h) => p.hits.get(h)?.cast.group))).toEqual(new Set([`trigger:olden_stare_dive`]));
    expect(distinctCasts(p).filter((c) => c.operator === TT && c.skillId === `${TT}_normal_skill` && c.start > 13000)).toHaveLength(0);
  });
});

describe("an Arts Burst's delay (1 s) on its operator's clock", () => {
  it("waits out others' time stops and slow-downs, not its own operator's", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const at = (file: string, t: number) => {
      const fx = readLogFixture(new URL(file, import.meta.url).pathname);
      const r = logBuffReplay(data, fx).replay;
      const l = r.statusLanding(fx.hits.find((h) => h.t === t && h.operator === "chr_0032_lizhiyan") as LogHit);
      return "unknown" in l ? null : (l.frame * 1000) / 30;
    };
    // dbaee23b801d: Arcane's touch at 8501 ms, inside Xaihi's ultimate stop, then Typhoeus's combo: her Nature burst at
    // 10341 ms (unheld, at 9.5 s; held by the stop alone, 10.1 s, before the Amp and debuff the log has on it).
    expect(Math.abs((at("../fixtures/zmdlogs-dbaee23b801d.json", 10341) as number) - 10341)).toBeLessThan(200);
    // 0eef2474a26f: her touch at 2719 ms inside her own combo's slow-down: her Cryo burst 1 s later, at 3729 ms.
    expect(Math.abs((at("../fixtures/zmdlogs-0eef2474a26f.json", 3729) as number) - 3729)).toBeLessThan(100);
  });
});

describe("build offsets: one factor on all of an operator's hits (a build input the export doesn't give)", () => {
  it("names the weapon level or attribute nodes that give it (d774's Liino: weapon 80; 458b's Si: 2 nodes)", async () => {
    const { buildOffsets, engineHits, logBuffReplay } = await import("../packages/logs/src/logcheck.ts");
    const offsetOf = (file: string, operator: string, build: (b: Build) => Build) => {
      const fx = readLogFixture(new URL(file, import.meta.url).pathname);
      const asAssumed = { ...fx, team: fx.team.map((b) => (b.operator === operator ? build(b) : b)) };
      const replay = logBuffReplay(data, asAssumed);
      return buildOffsets(data, asAssumed, engineHits(data, asAssumed, replay)).find((o) => o.operator === operator);
    };
    // The fixtures as imported (weapon 90, every node): the offset and its explanation.
    const liino = offsetOf("../fixtures/pending/zmdlogs-d774d0ce7bd3.json", "chr_0035_liino", (b) => ({ ...b, weapon: { ...(b.weapon as NonNullable<Build["weapon"]>), level: 90 } }));
    expect(liino?.ratio).toBeCloseTo(0.937, 3);
    expect(liino?.explained).toContain("the weapon at level 80");
    const si = offsetOf("../fixtures/pending/zmdlogs-458b03609665.json", "chr_0036_jsspsi", ({ attributeNodes: _n, ...b }) => b);
    expect(si?.explained).toContain("2 attribute node(s)");
    // As corrected: none.
    expect(offsetOf("../fixtures/pending/zmdlogs-458b03609665.json", "chr_0036_jsspsi", (b) => b)).toBeUndefined();
  });

  it("isn't one factor where ATK buffs move the ratio from hit to hit: Ardelia's weapon in 4e36 (level 1, no node) and c3c7 (level 60, no node), set in the fixtures", async () => {
    const { engineHits, logBuffReplay } = await import("../packages/logs/src/logcheck.ts");
    const A = "chr_0025_ardelia";
    const exact = (file: string, build: (b: Build) => Build) => {
      const fx = readLogFixture(new URL(file, import.meta.url).pathname);
      const asAssumed = { ...fx, team: fx.team.map((b) => (b.operator === A ? build(b) : b)) };
      const byHit = engineHits(data, asAssumed, logBuffReplay(data, asAssumed));
      const hits = fx.hits.filter((h) => h.operator === A && h.crit === false);
      return hits.filter((h) => byHit.get(h)?.readings.some((r) => Math.abs(r.predicted - h.value) <= 1)).length / hits.length;
    };
    const assumed = ({ attributeNodes: _n, ...b }: Build) => ({ ...b, weapon: { ...(b.weapon as NonNullable<Build["weapon"]>), level: 90 } });
    // c3c7: none of her hits fits the assumed build (weapon 90, every node); 87% fit as set.
    expect(exact("../fixtures/pending/zmdlogs-c3c735dbb022.json", assumed)).toBe(0);
    expect(exact("../fixtures/pending/zmdlogs-c3c735dbb022.json", (b) => b)).toBeGreaterThan(0.85);
    // 4e36: none against 38% (the rest under Alesh's weapon ATK layers, which the replay has otherwise than the log).
    expect(exact("../fixtures/pending/zmdlogs-4e3651100056.json", assumed)).toBe(0);
    expect(exact("../fixtures/pending/zmdlogs-4e3651100056.json", (b) => b)).toBeGreaterThan(0.35);
  });
});
