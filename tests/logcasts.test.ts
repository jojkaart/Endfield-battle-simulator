// How logged hits are grouped into casts (packages/logs/src/logcasts.ts), on real logs: the accuracy plan's A1
// (docs/accuracy-plan.md), where casts of one key less than CAST_SLACK_MS apart were merged.

import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { type LogHit } from "@efsim/logs";
import { readLogFixture } from "@efsim/cli";
import { distinctCasts, placeHits } from "../packages/logs/src/logcasts.ts";

const data = loadGameData();
const T = "chr_0034_typhoea";

describe("cast placement (accuracy plan A1)", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-92b450306768.json", import.meta.url).pathname);
  const placement = placeHits(data, fx);
  const shots = fx.hits.filter((h) => h.operator === T && h.event === `${T}_floating_attack1_01_projhit`).sort((a, b) => a.t - b.t);

  it("a cast whose known landings are all logged doesn't take another landing of the key: Typhoeus's hover shots, 0.6 s apart, are casts of their own", () => {
    const [a, b] = shots;
    expect((b as LogHit).t - (a as LogHit).t).toBeLessThan(1000);
    const cast = (h: LogHit | undefined) => placement.hits.get(h as LogHit)?.cast;
    expect(cast(b)).not.toBe(cast(a));
    // Her power and plain shots (a stack requirement each) are alternatives: one landing slot, each shot index 0.
    expect(shots.slice(0, 4).map((h) => placement.hits.get(h)?.index)).toEqual([0, 0, 0, 0]);
  });

  it("casts of one skill placed from the same key stay two casts in the replay's list, however close", () => {
    const starts = distinctCasts(placement).filter((c) => c.operator === T && c.skillId === `${T}_floating_attack1`).map((c) => Math.round(c.start));
    expect(starts.slice(0, 4)).toEqual([4240, 4849, 5557, 6166]);
  });

  it("Typhoeus's arrowrain is placed (its log key from the data; the mark that kept it off is gone): her ultimate is replayed", () => {
    const dbae = readLogFixture(new URL("../fixtures/zmdlogs-dbaee23b801d.json", import.meta.url).pathname);
    const rain = dbae.hits.find((h) => h.event === `${T}_ultimate_skill_arrowrain`);
    expect(placeHits(data, dbae).hits.get(rain as LogHit)?.cast.skillId).toBe(`${T}_ultimate_skillfloating`);
  });

  it("a landing at its next slot's own frame stays in its cast, though another cast seems to start between (Camille's combo in 012a)", async () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-012ae1c80ae6.json", import.meta.url).pathname);
    const C = "chr_0033_camille";
    const p = placeHits(data, fx);
    // One combo: its hits at frames 19 / 27 / 47, logged at 33910 / 34117 / 34798 ms around an attack 3 placed at 33552 ms.
    const combo = fx.hits.filter((h) => h.operator === C && h.event === `${C}_combo_skill` && h.t > 33000 && h.t < 35000);
    expect(combo.map((h) => h.t)).toEqual([33910, 34117, 34798]);
    expect(new Set(combo.map((h) => p.hits.get(h)?.cast)).size).toBe(1);
    expect(combo.map((h) => p.hits.get(h)?.index)).toEqual([0, 1, 2]);
    // Its one poised hit (hit_3) is the only Stagger the replay deals there, and the bar breaks near the log's 53.4 s, not
    // at 35.9 s (with Arcane's Cluster Strike lasers' 20 each and three combos it did).
    const { logBuffReplay } = await import("@efsim/cli");
    const first = logBuffReplay(data, fx).replay.staggers[0] as number;
    expect((first * 1000) / 30).toBeGreaterThan(45000);
  });
});

describe("the replay casts the basic-attack step the engine's state allows (accuracy plan A1)", () => {
  it("Typhoeus's second hover shot in 92b4, placed as attack 1 (one key for attacks 1–4), is replayed as attack 2 (her ABATK attempts)", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-92b450306768.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const steps = r.hits.filter((h) => h.operator === T && h.skillId.startsWith(`${T}_floating_attack`) && h.hitId.endsWith("_shot")).map((h) => h.skillId.slice(-1));
    expect(steps.slice(0, 3)).toEqual(["1", "2", "3"]);
  });
});

describe("the fight's totals (accuracy plan A3, A4)", () => {
  it("a kill: both totals end at the log's kill, the replay's past the enemy's HP; its time to kill is when it reached the HP (b7b3: Rhodagn dies at the log's time in the replay, within 1.5%, its absent slash left out; ~0.4 s sooner while unlogged crits counted at expected rates)", async () => {
    const { engineHits, engineReport, logBuffReplay } = await import("../packages/logs/src/logcheck.ts");
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-b7b3762d5da8.json", import.meta.url).pathname);
    const replay = logBuffReplay(data, fx);
    const report = engineReport(data, fx, replay, engineHits(data, fx, replay));
    expect(report.totals.simulated.damage).toBeGreaterThan(report.totals.logged.damage);
    expect(Math.abs(report.totals.simulated.lastHitMs - report.totals.logged.lastHitMs)).toBeLessThan(100);
    // −1.2% since 2026-11-14 (+0.1% before): Tangtang's last waterspout at 17055 ms, pinned past her battle skill's planned
    // last hit, keeps Bonekrushing's next-battle-skill DMG, as her equal logged spout at 16783 ms says it has; the replay's
    // ×1.13 on her spouts from 15927 ms (the log's 11060 against 12495) is another, open error that runs the total over.
    expect(Math.abs(report.errors["time to kill"] ?? NaN)).toBeLessThan(1.5);
  });

  it("a logged hit's landing counts even past the log's end, and the killing hit is capped at the log's value (a27b: Mi Fu's Crush 65 ms late, 161,507 of 332,879)", async () => {
    const { engineHits, engineReport, logBuffReplay } = await import("../packages/logs/src/logcheck.ts");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-a27bc3527682.json", import.meta.url).pathname);
    const replay = logBuffReplay(data, fx);
    const report = engineReport(data, fx, replay, engineHits(data, fx, replay));
    const kill = fx.hits.find((h) => h.t === 68068 && h.event === "buff_physical_do_crushed");
    expect(kill?.value).toBe(161507);
    expect(replay.replay.hits.some((l) => l.operator === "chr_0031_mifu" && (l.frame * 1000) / 30 > 68068 + 30)).toBe(true);
    // Left out, Mi Fu's total was −24.7%; counted uncapped, the fight's would be over the enemy's HP.
    const share = (report.totals.simulated.perOperator["chr_0031_mifu"] ?? 0) / (report.totals.logged.perOperator["chr_0031_mifu"] ?? 1) - 1;
    expect(share).toBeGreaterThan(-0.15);
    // Within 3.5% of the log's (the enemy's HP): since Razorhorn's ATK comes before the Shatter (2026-11-14) Estella's Lifts
    // here get the whole buff where the log shows about half (open-problems), +2.2%; since the hidden holds are placed
    // (2026-11-23, hidden-holds `placed`), their 0.5 s between 58.8 and 63.2 s (two runs of Gilberta's set buff) keeps
    // Mi Fu's Amaranthine Cleave on her 66.84 s Power Attack, which the log has without it: +3.2%.
    expect(report.totals.simulated.damage).toBeLessThan(report.totals.logged.damage * 1.035);
  });

  it("a hit whose crit the log doesn't give counts as the reading its value equals, crit or not (40d9: Si's killing combo finish, 599,622 = ×1.5 the non-crit 399,748)", async () => {
    const { engineHits, engineReport, logBuffReplay } = await import("../packages/logs/src/logcheck.ts");
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url).pathname);
    const replay = logBuffReplay(data, fx);
    const report = engineReport(data, fx, replay, engineHits(data, fx, replay));
    const si = (x: typeof report.totals.logged) => x.perOperator["chr_0036_jsspsi"] ?? NaN;
    expect(si(report.totals.simulated) / si(report.totals.logged)).toBeCloseTo(1, 3);
  });

  it("a landing the fixture marks absent from the log is left out of the replay's totals (b7b3: Last Rite's third ultimate slash)", async () => {
    const { engineHits, engineReport, logBuffReplay } = await import("../packages/logs/src/logcheck.ts");
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-b7b3762d5da8.json", import.meta.url).pathname);
    const replay = logBuffReplay(data, fx);
    const LR = "chr_0026_lastrite";
    expect(replay.replay.hits.some((h) => h.operator === LR && h.hitId === "slash_3")).toBe(true);
    const report = engineReport(data, fx, replay, engineHits(data, fx, replay));
    expect(report.totals.absent).toEqual({ leftOut: 1, unmatched: [] });
    expect(Math.abs(report.errors[`operator ${LR}`] as number)).toBeLessThan(10);
  });

  it("landings no logged hit stands for inside a stretch of 6 s without any logged hit aren't counted (enemy-away `away`; d774: Si's phases at 30.6–54.6 and 124.5–137.8 s, Zhuang Fangyi's strikes there), and are under `counted`", async () => {
    const { engineHits, engineReport, logBuffReplay } = await import("../packages/logs/src/logcheck.ts");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-d774d0ce7bd3.json", import.meta.url).pathname);
    const report = (assume: Record<string, string>) => {
      const replay = logBuffReplay(data, fx, undefined, { assume });
      return engineReport(data, fx, replay, engineHits(data, fx, replay)).totals;
    };
    const away = report({ "enemy-away": "away" });
    expect(away.away.windows.map((w) => [w.from, w.to])).toEqual([[30626, 54588], [124499, 137779]]);
    expect(away.away.leftOut).toBeGreaterThan(20);
    // +7.2% since the Empyrean combo's key (2026-11-24): its hits read ×1.5 low before, which hid Zhuang Fangyi's
    // replay-only Empyrean strikes (the open Sunderblade count); under `counted` it's over +20%.
    expect(Math.abs(away.simulated.damage / away.logged.damage - 1)).toBeLessThan(0.08);
    // Under `absent` (the default since 2026-11-26) the replay's enemy is away too: those landings never happen, and
    // her strikes 0.23 and 0.27 s into the stretches (0.14M, unlogged) are gone with them: +4.7%.
    const absent = report({});
    expect(absent.away.windows).toEqual(away.away.windows);
    expect(absent.simulated.damage).toBeLessThan(away.simulated.damage);
    expect(Math.abs(absent.simulated.damage / absent.logged.damage - 1)).toBeLessThan(0.06);
    const counted = report({ "enemy-away": "counted" });
    expect(counted.away).toEqual({ windows: [], leftOut: 0 });
    expect(counted.simulated.damage / counted.logged.damage - 1).toBeGreaterThan(0.2);
  });

  it("a fight whose last hit is capped ends in a kill whatever the data's HP: no replay-only landing at the killing frame counts (4360: tower016's HP is the data's ×5.5; Avywenna's four returning lances in the killing batch were +6.5%); the shares add up to the error", async () => {
    const { engineHits, engineReport, logBuffReplay } = await import("../packages/logs/src/logcheck.ts");
    const { totalsShares } = await import("../packages/logs/src/enginecheck.ts");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-4360447193ac.json", import.meta.url).pathname);
    const replay = logBuffReplay(data, fx);
    const t = engineReport(data, fx, replay, engineHits(data, fx, replay)).totals;
    expect(t.logged.killMs).toBe(119235);
    const A = "chr_0012_avywen";
    expect(t.parts.filter((p) => p.operator === A && !p.logged)).toHaveLength(0);
    expect(Math.abs(t.simulated.damage / t.logged.damage - 1)).toBeLessThan(0.02);
    const s = totalsShares(fx.hits, t);
    expect(s.matched + s.replayOnly + s.logOnly).toBeCloseTo(s.error, 6);
  });

  it("an ultimate with fewer logged landings than slots places them by their time (3f78: Rossi's at 18.98 s, a stab short; her two slashes in the slashes' slots, frames 122 and 131)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-3f78ceb15bc3.json", import.meta.url).pathname);
    const p = placeHits(data, fx);
    const slash = (v: number) => p.hits.get(fx.hits.find((h) => h.event === "chr_0028_wulfa_ultimate_skill" && h.value === v) as LogHit)?.frame;
    expect([slash(245394), slash(736182)]).toEqual([122, 131]);
  });

  it("a cast's landings fewer than its slots take the slots their values fit, the first slot free (9c0b: Camille's Hunter Pursuit at 13.37 s is hits 2–4, ×5.3 the last, its cast 0.43 s earlier; db87: her ultimate's two logged hits are hit_2 and hit_3; a27b: Mi Fu's attack 3 hit_2)", () => {
    const pursuit = readLogFixture(new URL("../fixtures/pending/zmdlogs-9c0bb09daff2.json", import.meta.url).pathname);
    const p = placeHits(data, pursuit);
    const at = (fx: typeof pursuit, pl: typeof p, t: number, key: string) => pl.hits.get(fx.hits.find((h) => h.t === t && h.event === key) as LogHit);
    const hp = "chr_0033_camille_combo_skill_2";
    expect([13371, 13850, 14568].map((t) => at(pursuit, p, t, hp)?.frame)).toEqual([33, 49, 70]);
    expect(at(pursuit, p, 13371, hp)?.cast.start).toBeCloseTo(13371 - (33 * 1000) / 30, 0);
    const db = readLogFixture(new URL("../fixtures/pending/zmdlogs-db8711232de9.json", import.meta.url).pathname);
    const q = placeHits(data, db);
    expect([10108, 10651].map((t) => at(db, q, t, "chr_0033_camille_ultimate_skill")?.frame)).toEqual([104, 120]);
    const mifu = readLogFixture(new URL("../fixtures/pending/zmdlogs-a27bc3527682.json", import.meta.url).pathname);
    expect(at(mifu, placeHits(data, mifu), 60839, "chr_0031_mifu_attack3")?.frame).toBe(30);
  });

  it("a landing at its cast's last landing's ms whose value is that landing's, not the next slot's, is the same landing on a second enemy (9c6e: Liino's combo hit 1 at 47.72 s on both, 6368 and 6035; her 48.49 s hit 2 the same cast's)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-9c6e97486a9d.json", import.meta.url).pathname);
    const p = placeHits(data, fx);
    const key = "chr_0035_liino_combo_skill";
    const at = (t: number, v: number) => p.hits.get(fx.hits.find((h) => h.t === t && h.event === key && h.value === v) as LogHit);
    expect(at(47720, 6035)?.sameAs).toBeDefined();
    expect(at(47720, 6035)?.frame).toBe(9);
    expect(at(48489, 10743)?.frame).toBe(33);
    expect(at(48489, 10743)?.cast).toBe(at(47720, 6368)?.cast);
  });

  it("Typhoeus's shots: an off-field hit isn't placed while the log shows her controlled, and a burst's cast isn't joined by the next shot's arrow (fc63 88–93 s: her 4th shot was placed as the 5th, every burst a shot early)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-fc63a2001251.json", import.meta.url).pathname);
    const p = placeHits(data, fx);
    const at = (t: number, key: string) => p.hits.get(fx.hits.find((h) => h.operator === T && h.t === t && h.event.endsWith(key)) as LogHit);
    expect(at(89238, "floating_attack1_01_projhit")?.cast.skillId).toBe(`${T}_floating_attack1`);
    const burst = at(92871, "natural_triggered_typhoea");
    expect(burst?.cast.skillId).toBe(`${T}_floating_attack5`);
    expect(burst?.cast).toBe(at(90525, "floating_attack5_01_projhit")?.cast);
    // A shot's arrow and its burst 0.32 s later are one cast.
    expect(at(88029, "floating_attack1_01_projhit")?.cast).toBe(at(88351, "natural_triggered_typhoea")?.cast);
  });

  it("an Originium Crystals shatter at a teammate's Lift is the crystals' trigger, not an ultimate (0c14: seven shatters at Rossi's Lifts, two logged ultimates)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-0c14fb3ce77d.json", import.meta.url).pathname);
    const ults = distinctCasts(placeHits(data, fx)).filter((c) => c.skillId === "chr_0003_endminf_ultimate_skill");
    expect(ults.map((c) => Math.round(c.start / 1000))).toEqual([21, 170]);
  });

  it("an enemy status the log lists with no giver is the stage's and read from the log (Hard 27's Electrification, 207f: Rossi's ultimate stabs ×1.18 without it)", async () => {
    const { checkLog, verdictCount } = await import("../packages/logs/src/logcheck.ts");
    const { logOnly, teamBuffNames } = await import("../packages/logs/src/enginecheck.ts");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-207fff414d82.json", import.meta.url).pathname);
    const stab = fx.hits.find((h) => h.t === 41240 && h.event === "chr_0028_wulfa_ultimate_skill") as LogHit;
    expect(logOnly(data, fx, teamBuffNames(data, fx), stab).effects.map((e) => e.buff)).toContain("buff_common_pulse_pulse_conduct_triggered_do");
    const v = checkLog(data, fx).find((x) => x.hit === stab);
    expect(v && verdictCount(v)).toBe("plain");
    // Arts DMG Taken only (CheckDamageTypeMask 92): Rossi's physical attacks under it read plain without its +0.24.
    const physical = fx.hits.find((h) => h.t === 25235 && h.event === "chr_0028_wulfa_attack1") as LogHit;
    const conduct = logOnly(data, fx, teamBuffNames(data, fx), physical).effects.filter((e) => e.buff === "buff_common_pulse_pulse_conduct_triggered_do");
    expect(conduct.map((e) => e.element).sort()).toEqual(["cryst", "fire", "natural", "pulse"]);
    const pv = checkLog(data, fx).find((x) => x.hit === physical);
    expect(pv && verdictCount(pv)).toBe("plain");
  });

  it("a fight whose total is a stage-scaled Max HP ends in a kill though its last hit carries no uncapped value (207f ×5.76, 5082 ×7.60)", async () => {
    const { stageScaledKill } = await import("../packages/logs/src/enginecheck.ts");
    const { engineHits, engineReport, logBuffReplay } = await import("../packages/logs/src/logcheck.ts");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-207fff414d82.json", import.meta.url).pathname);
    expect(stageScaledKill(data, fx)).toBe(true);
    expect(stageScaledKill(data, readLogFixture(new URL("../fixtures/pending/zmdlogs-5082ceaffad1.json", import.meta.url).pathname))).toBe(true);
    // A total off a multiple by more than the hits' rounding isn't (d774: ×2.00877, the boss Si's lives).
    expect(stageScaledKill(data, readLogFixture(new URL("../fixtures/pending/zmdlogs-d774d0ce7bd3.json", import.meta.url).pathname))).toBe(false);
    // The killing ultimate final counts at the HP that was left (1,134,403), not its predicted 1,218,124.
    const replay = logBuffReplay(data, fx);
    const t = engineReport(data, fx, replay, engineHits(data, fx, replay)).totals;
    const final = t.parts.find((p) => p.logged?.t === 42848 && p.logged.event === "chr_0028_wulfa_ultimate_skill");
    expect(final?.damage).toBe(1134403);
    expect(t.logged.killMs).toBe(42848);
    // How the kill was found, as `zmdlogs totals` prints it beside the total ÷ Max HP (round 17, the exposed-totals report point 2).
    expect(t.kill).toEqual({ kind: "stage-scaled", maxHp: 825447 });
  });
});

describe("Si's strokes and Artful Intent's burst (accuracy plan A2)", () => {
  it("0eef: the logged press under Artful Intent is Initial Stroke, Final Stroke is inferred from the burst after the buff's end, and the burst lands at its logged time", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-0eef2474a26f.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const si = "chr_0036_jsspsi";
    const burst = r.hits.find((h) => h.operator === si && h.hitId === "burst_inksoul");
    expect(Math.abs(((burst?.frame ?? 0) * 1000) / 30 - 10030)).toBeLessThan(50);
    // Liino's logged battle skill during her Vocalist Stance (4187 ms) leads to nothing the log shows: not cast as End
    // Stance, so the stance's ATK stays on Si's combo at 8026 ms.
    const hit = fx.hits.find((h) => h.operator === si && h.t === 8026);
    const l = r.landing(hit as LogHit);
    expect("unknown" in l ? [] : l.modifiers.map((m) => m.source).filter((x) => x.includes("Vocalist Stance"))).toHaveLength(1);
  });
});

describe("variants by a stack range (Zhuang Fangyi's strike_N / final_N by Sunderblade count)", () => {
  it("slots follow the variant with the most landings, and a logged press starts a new cast", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-3aa6ab93bad4.json", import.meta.url).pathname);
    const Z = "chr_0030_zhuangfy";
    const p = placeHits(data, fx);
    // One cast's seven strikes (32.9–34.0 s, 0.2 s apart): one cast, slots 0–6 in order (final_1 at frame 32 had taken the second).
    const strikes = fx.hits.filter((h) => h.operator === Z && h.event === `${Z}_normal_skill_ult_abilityrange` && h.t >= 32900 && h.t <= 34035);
    expect(strikes).toHaveLength(7);
    expect(new Set(strikes.map((h) => p.hits.get(h)?.cast)).size).toBe(1);
    expect(strikes.map((h) => p.hits.get(h)?.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("her Empyrean attacks 1 and 2, alike in every key (attack1_ult_1..4_abilityrange), are told apart by attack 1's windows, past her Empyrean battle skill (it keeps the chain)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-d774d0ce7bd3.json", import.meta.url).pathname);
    const Z = "chr_0030_zhuangfy";
    const p = placeHits(data, fx);
    const step = (t: number) => p.hits.get(fx.hits.find((h) => h.operator === Z && h.t === t) as LogHit)?.cast.skillId.replace(`${Z}_`, "");
    // 17231 / 17896 ms: attack 1, then attack 2 in its window from frame 22 (the log's damage ×1.4 the first's); 24821 /
    // 26504 ms: the same with her Empyrean battle skill cast between (25.08 s).
    expect([17231, 17896, 24821, 26504].map(step)).toEqual(["attack1_ult", "attack2_ult", "attack1_ult", "attack2_ult"]);
    // The entities' keys beyond the first are placed (attack1_ult_2 / _3_abilityrange: 32 groups unplaced before).
    expect(fx.hits.filter((h) => h.operator === Z && /attack1_ult_[2-4]_abilityrange$/.test(h.event)).every((h) => p.hits.has(h))).toBe(true);
  });
});

describe("an ultimate placed from several keys", () => {
  it("is one cast within its own duration (Liino's at 116.5 s in d774: beats, projectiles and side projectiles 2 s apart)", async () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-d774d0ce7bd3.json", import.meta.url).pathname);
    const L = "chr_0035_liino";
    const ults = distinctCasts(placeHits(data, fx)).filter((c) => c.operator === L && c.skillId === `${L}_ultimate_skill`);
    expect(ults.filter((c) => c.start > 110000 && c.start < 125000)).toHaveLength(1);
    // So the replay lands one bomb per logged one.
    const { logBuffReplay } = await import("@efsim/cli");
    const bombs = logBuffReplay(data, fx).replay.hits.filter((h) => h.operator === L && h.hitId === "bomb");
    expect(bombs).toHaveLength(fx.hits.filter((h) => h.operator === L && h.event === `${L}_ultimate_skill_projhit_damage_02`).length);
  });

  it("is one cast placed from one key whose landings miss their slots' frames, across the operator's other casts (Ardelia's sheep in 5082 and af7b); the replay lands the sheep the log shows (a random landed count)", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const A = "chr_0025_ardelia";
    for (const [file, n] of [["5082ceaffad1", 10], ["af7b7f865906", 5]] as const) {
      const fx = readLogFixture(new URL(`../fixtures/pending/zmdlogs-${file}.json`, import.meta.url).pathname);
      const p = placeHits(data, fx);
      const sheep = fx.hits.filter((h) => h.operator === A && h.event === `${A}_ultimate_skill_sheep_projhit`);
      expect(sheep).toHaveLength(n);
      // The sheep fly at random: 5082's land 0.2-0.9 s apart over 4 s, around her combo's bomb (5082) or attack 3 (af7b).
      expect(new Set(sheep.map((h) => p.hits.get(h)?.cast)).size).toBe(1);
      expect(sheep.map((h) => p.hits.get(h)?.index)).toEqual([...Array(n).keys()]);
      expect(distinctCasts(p).filter((c) => c.operator === A && c.kind === "ultimate")).toHaveLength(1);
      // Of the 14 (P5, 5082) or 11 (P2, af7b) planned, not the others (KitHit.landedCount).
      expect(logBuffReplay(data, fx).replay.hits.filter((h) => h.operator === A && h.skillId === `${A}_ultimate_skill`)).toHaveLength(n);
    }
  });

  it("placed from one key and overflowing its slots, is still one cast within its duration (Liino's projectiles in 9c6e at 71.8-74.2 s)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-9c6e97486a9d.json", import.meta.url).pathname);
    const L = "chr_0035_liino";
    const ults = distinctCasts(placeHits(data, fx)).filter((c) => c.operator === L && c.kind === "ultimate");
    expect(ults).toHaveLength(1);
  });
});
