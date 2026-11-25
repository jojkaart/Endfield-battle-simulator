// The log check's kit-buff replay (tests/buffreplay.test.ts), part 3: on 4e5e1390085e, where the log stops listing
// Camille's weapon buffs; simulateLog; casts the log shows only indirectly; reaction levels and Arcane's combo touch.
// A separate file so the default suite's workers balance.
import { describe, expect, it } from "vitest";
import { effectiveKit, FPS, type OperatorKit } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { layerCrits, shownCrits, type LogEffect, type LogFixture, type LogHit } from "@efsim/logs";
import { castsFromTriggerHits, checkLog, LOG_LISTING, logBuffReplay, loggedLaneEnds, readLogFixture, replayedCasts, simulateLog } from "@efsim/cli";
import { placeHits } from "../packages/logs/src/logcasts.ts";

const data = loadGameData();

describe("4e5e1390085e: Camille's weapon buffs after the log stops listing them", () => {
  const fx = readLogFixture(new URL("../fixtures/zmdlogs-4e5e1390085e.json", import.meta.url).pathname);
  const r = logBuffReplay(data, fx);

  it("gives Rossi's MI Security layers (on her logged crits) where the log lists one, and counts layers that push each other out", () => {
    const at = (t: number) => fx.hits.find((x) => x.t === t && x.operator === "chr_0028_wulfa" && x.event === "chr_0028_wulfa_attack4") as LogHit;
    // 15015 ms: five layers on one timer (the oldest pushed out by each new one: an instance ends at the newest layer's start).
    expect(r.replay.instances(at(15015), "buff_equipsuit_critsuitatk_01")).toBe(5);
    expect(r.replayed.layersAt.get(at(15015))?.get("buff_equipsuit_critsuitatk_01")).toBe(5);
    const v = checkLog(data, fx, { replay: r }).find((x) => x.hit === at(15015));
    expect(v?.kind === "match" && v.assumed.some((a) => a.includes("critsuitatk"))).toBe(false);
  });

  it("has both on to the end by Camille's casts, and reports the log's gaps", () => {
    const late = fx.hits.filter((x) => x.t > 66000);
    expect(late.every((x) => r.replay.instances(x, "buff_wpn_lance_0015_atkup") !== 0 && r.replay.instances(x, "buff_wpn_lance_0015_dmgup") !== 0)).toBe(true);
    const gaps = r.runs.filter((x) => x.on === "replay" && x.buff.startsWith("buff_wpn_lance_0015_") && x.operator === "chr_0028_wulfa");
    expect(gaps.find((x) => x.buff === "buff_wpn_lance_0015_atkup")?.from).toBeGreaterThan(49418);
    expect(gaps.find((x) => x.buff === "buff_wpn_lance_0015_dmgup")?.from).toBeGreaterThanOrEqual(65597);
  });

  it("matches Rossi's hits under them without a hand annotation (every one, accuracy plan A1 and B1)", () => {
    const rossi = checkLog(data, fx, { replay: r }).filter((v) => v.hit.operator === "chr_0028_wulfa");
    expect(rossi.filter((v) => v.kind === "match").length).toBe(162);
    // His finisher at 69142 ms lies in the log's last Stagger (66.6 s), which the replay's own bar missed by 24 (the
    // log's bar drops 36 at 53177 ms, of which only Estella's projectile's 12 is logged): since 2026-11-11 the replay
    // follows the log's bar at its hits with Stagger (loggedPoiseBars), and it matches.
    expect(rossi.filter((v) => v.kind !== "match").map((v) => [v.hit.t, v.kind])).toEqual([]);
    // …by the replay's buffs, not the log's listing, in the fallback's readings (the engine's own fall back where its
    // Wolven Blood layers or Stagger differ from the log's: the report's leads).
    const listing = checkLog(data, fx, { replay: r, engine: false }).filter((v) => v.hit.operator === "chr_0028_wulfa");
    expect(listing.filter((v) => v.kind === "match" && v.hit.t > 65500 && v.assumed.some((a) => a.startsWith(LOG_LISTING)))).toEqual([]);
  });

  it("says why each landing it didn't land and each cast it didn't make (backlog after round 11 point 3)", () => {
    const dropped = fx.hits.filter((h) => {
      const l = r.replay.landing(h);
      return "unknown" in l && l.unknown === "a landing the replay didn't land";
    });
    expect(dropped.length).toBeGreaterThan(0);
    for (const h of dropped) expect(r.replay.droppedLanding(h)).toMatch(/\S/);
    // A landed hit has no drop reason.
    const landedHit = fx.hits.find((h) => !("unknown" in r.replay.landing(h)));
    expect(landedHit && r.replay.droppedLanding(landedHit)).toBeNull();
    for (const x of r.replay.skipped) expect(x.why).not.toBe("not made");
  });
});

describe("d774d0ce7bd3: a skipped press names its reason", () => {
  it("skips Liino's ultimates pressed while no enemy is there for want of ultimate energy, by earliestStart's own words", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-d774d0ce7bd3.json", import.meta.url).pathname);
    const skips = logBuffReplay(data, fx).replay.skipped.filter((x) => x.cast.skillId === "chr_0035_liino_ultimate_skill");
    const energy = skips.filter((x) => /^a press whose hits had no one to land on: chr_0035_liino_ultimate_skill needs 160 ultimate energy/.test(x.why));
    expect(energy.map((x) => Math.round(x.cast.start / 1000))).toEqual(expect.arrayContaining([31, 126]));
  });
});

describe("simulateLog: the logged casts simulated, each hit against its landing (the end point, a diagnostic)", () => {
  it("lands 4e5e's hits with the engine's buffs and the log's crits; Gilberta's and Estella's mostly within ±1", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-4e5e1390085e.json", import.meta.url).pathname);
    const sim = simulateLog(data, fx);
    const within = (op: string) => sim.filter((x) => x.hit.operator === op && typeof x.simulated === "number" && Math.abs(x.simulated - (x.hit.uncapped ?? x.hit.value)) <= 1).length;
    expect(within("chr_0013_aglina")).toBeGreaterThanOrEqual(40);
    expect(within("chr_0021_whiten")).toBeGreaterThanOrEqual(15);
    expect(sim.filter((x) => typeof x.simulated === "number").length).toBeGreaterThan(300);
  });

  it("gives a pinned landing its own logged hit's crit, also where hits of its event crit and not at one frame (4e5e: Rossi)", () => {
    // Until 2026-10-25 a landing took the crit of the logged hits of its event within a frame, none where they differed:
    // 10 pinned landings (Rossi's, Gilberta's, Camille's) had no crit though their own hit has one, and crit-triggered buffs (Wolven Blood) missed them.
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-4e5e1390085e.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx);
    const missing = r.replay.hits.filter((h) => h.ref !== undefined && h.loggedCrit === null && fx.hits[Number(h.ref)]?.crit !== null);
    expect(missing.map((h) => `${h.operator} ${h.skillId}:${h.hitId} @${h.frame}`)).toEqual([]);
    const wrong = r.replay.hits.filter((h) => h.ref !== undefined && typeof h.loggedCrit === "boolean" && fx.hits[Number(h.ref)]?.crit !== null && h.loggedCrit !== fx.hits[Number(h.ref)]?.crit);
    expect(wrong).toEqual([]);
    // Where the log gives no crit, only crits the replay infers (shownCrits, layerCrits, valueCrits), never a non-crit.
    expect(r.replay.hits.some((h) => h.ref !== undefined && h.loggedCrit === false && fx.hits[Number(h.ref)]?.crit === null)).toBe(false);
  });
});

describe("b6aa15281db4: a battle skill the log shows only by a trigger that needs its buff", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-b6aa15281db4.json", import.meta.url).pathname);

  it("casts Last Rite's battle skill (run beside her basic attack, no timeline) before the Final Strike her Mirage at 6141 ms needs it for", () => {
    const kits = fx.team.map((b) => effectiveKit(data, b) as OperatorKit);
    const base = replayedCasts(placeHits(data, fx), fx);
    const added = castsFromTriggerHits(data, fx, kits, base).filter((c) => !base.some((b) => b.operator === c.operator && b.skillId === c.skillId && b.start === c.start));
    expect(added.map((c) => [c.skillId, Math.round(c.start)])).toEqual([["chr_0026_lastrite_normal_skill", Math.round(6141 - (24 * 1000) / FPS)]]);
    // Its Mirage adds the third Cryo stack: Arcane's Nature at 11432 ms makes level 3 Corrosion, as the log's ×1.25 shred says.
    const corrosion = logBuffReplay(data, fx).replay.reactions.find((x) => x.kind === "reaction" && x.status === "corrosion");
    expect(corrosion && "level" in corrosion ? corrosion.level : null).toBe(3);
  });
});

describe("a7a7a40c97ed: a cast inferred from a buff's end and the cast after it", () => {
  it("keeps the inferred Final Stroke's Artful Intent end through Si's attack 2 0.3 s later: the killing burst at 56469 ms lands", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-a7a7a40c97ed.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const bursts = r.hits.filter((h) => h.operator === "chr_0036_jsspsi" && h.hitId === "burst_inksoul").map((h) => Math.round((h.frame * 1000) / FPS));
    expect(bursts.some((t) => Math.abs(t - 56469) < 50)).toBe(true);
  });
});

describe("a press that leads to an inferred cast: the slot's variant by its kit's state, not the inferred skill again", () => {
  const S = "chr_0036_jsspsi";
  const burstAt = (file: string, t: number) => {
    const fx = readLogFixture(new URL(`../fixtures/pending/zmdlogs-${file}.json`, import.meta.url).pathname);
    const h = fx.hits.find((x) => x.operator === S && x.event === `${S}_normal_skill_inkmove_2` && x.t === t) as LogHit;
    const l = logBuffReplay(data, fx).replay.landing(h);
    return "unknown" in l ? null : { hitId: l.hitId, ms: Math.round((l.frame * 1000) / FPS) };
  };

  it("3f78: Si's press at 19708 ms, in her ultimate, is Initial Stroke (not her battle skill after Artful Intent's end): the Inksoul's burst at 22689 ms lands", () => {
    const l = burstAt("3f78ceb15bc3", 22689);
    expect(l?.hitId).toBe("burst_inksoul");
    expect(Math.abs((l?.ms ?? 0) - 22689)).toBeLessThan(50);
  });

  it("e989: her press at 67244 ms under the Inksoul isn't the Final Stroke the log's burst at 69192 ms is inferred from", () => {
    const l = burstAt("e9896c8d02be", 69192);
    expect(l?.hitId).toBe("burst_inksoul");
    expect(Math.abs((l?.ms ?? 0) - 69192)).toBeLessThan(50);
  });
});

describe("Si's strokes from the log (c83c): Initial Stroke at the first press, no Final Stroke where the burst is the Inksoul's own", () => {
  const S = "chr_0036_jsspsi";
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-c83c75d02a85.json", import.meta.url).pathname);
  const r = logBuffReplay(data, fx).replay;

  it("lands the Inksoul's bursts credited to the Inksoul itself (poise.origin normal_skill_inkmove_2) at their logged times, as Artful Intent's expiry", () => {
    for (const t of [23541, 57256, 87885]) {
      const h = fx.hits.find((x) => x.operator === S && x.event === `${S}_normal_skill_inkmove_2` && Math.abs(x.t - t) < 5) as LogHit;
      expect(h.poise?.origin).toBe(`${S}_normal_skill_inkmove_2`);
      const l = r.landing(h);
      expect("unknown" in l ? null : l.hitId).toBe("burst_inksoul");
      expect(Math.abs(("unknown" in l ? 0 : (l.frame * 1000) / FPS) - h.t)).toBeLessThan(250);
    }
  });

  it("counts the first press after her battle skill (Initial Stroke) for Type 50 Yinglung's Edge, not her later presses nor an inferred Final Stroke: the combos' implied layers", () => {
    const layers = (from: number) => {
      const h = fx.hits.find((x) => x.operator === S && x.event === `${S}_combo_skill_abilityrange` && x.t >= from) as LogHit;
      const l = r.landing(h);
      return "unknown" in l ? null : Math.round(l.modifiers.filter((m) => m.kitBuff?.id === "suit_atk02.edge").reduce((s, m) => s + m.value, 0) / 0.2);
    };
    // 55.6 s: one layer (before: two, a press at 51.8 s made Initial Stroke); 82.8 s: three (Initial Stroke at 68.6 s);
    // 98.4 s: two (before: three, a Final Stroke inferred from the Inksoul's own burst at 87.9 s).
    expect([layers(55000), layers(82700), layers(98300)]).toEqual([1, 3, 2]);
  });
});

describe("a hitless ultimate's logged cast at its time stop's end", () => {
  it("starts its stop's length earlier when nobody hits during it and another's hit lands at the event (b6aa: Xaihi at 31027 ms, her Amp on Last Rite's combo at 32034 ms)", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-b6aa15281db4.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const combo = fx.hits.find((h) => h.t === 32034 && h.operator === "chr_0026_lastrite" && h.value === 268211) as LogHit;
    const l = r.landing(combo);
    expect("unknown" in l ? [] : l.modifiers.filter((m) => m.source.includes("Stack Overflow"))).toHaveLength(1);
  });

  it("starts its stop's length earlier when another's hit comes soon after the event (c83c: Laevatain at 44548 ms, the team resuming 125 ms later)", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-c83c75d02a85.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const twilight = r.kitWindows("chr_0016_laevat:twilight", "chr_0016_laevat")[0];
    expect(Math.abs((twilight?.start ?? 0) - 42500)).toBeLessThan(100);
  });

  it("stays at the event without such a hit (e82d: Xaihi at 3896 ms; her Amp not yet on Arcane's ultimate at 7022 ms)", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-e82d45c46040.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const hit = fx.hits.find((h) => h.t === 7022 && h.operator === "chr_0032_lizhiyan") as LogHit;
    const l = r.landing(hit);
    expect("unknown" in l ? [] : l.modifiers.filter((m) => m.source.includes("Stack Overflow"))).toHaveLength(0);
  });
});

describe("kit buffs the replay can't judge, where the log records none of their operator's buffs", () => {
  it("are the engine's: 1d91 never lists Liino's buffs, so her lance's ATK layers (on her heals' targets) stay in; 1cd1 lists them", () => {
    const key = "chr_0035_liino:wpn_lance_0014.atk";
    const unjudged = (f: string) => logBuffReplay(data, readLogFixture(new URL(`../fixtures/pending/zmdlogs-${f}.json`, import.meta.url).pathname)).replay.unjudgedKitBuffs.has(key);
    expect(unjudged("1d9198480e75")).toBe(false);
    expect(unjudged("1cd1657bc305")).toBe(true);
  });

  it("include a buff only a chance path's hit applies: ad7f, Alesh's P3 ATK after a Rare Fin the replay rolled; Arcane's hits under it match", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-ad7f5ee2c91c.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx);
    expect(r.replay.unjudgedKitBuffs.get("chr_0024_deepfin:p3_atk")).toMatch(/rare_fin: a chance/);
    const arcane = checkLog(data, fx, { replay: r }).filter((v) => v.hit.operator === "chr_0032_lizhiyan" && v.hit.t >= 14798 && v.hit.t <= 22984);
    expect(arcane.length).toBeGreaterThanOrEqual(30);
    expect(arcane.every((v) => v.kind === "match")).toBe(true);
  });
});

describe("an operator in its own ultimate's time stop isn't held by another's slow-down", () => {
  it("9a80: Si's combo slow-down inside Rossi's ultimate stop doesn't delay its crit buff (frame 58): her first stabs have it", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-9a8097fcf351.json", import.meta.url).pathname);
    const W = "chr_0028_wulfa";
    const stabs = logBuffReplay(data, fx).replay.hits.filter((h) => h.operator === W && h.skillId === `${W}_ultimate_skill` && h.hitId === "stab");
    expect(stabs[0]?.frame).toBe(1055);
    expect(stabs.every((h) => h.modifiers.some((m) => m.source.includes("Razorclaw Ambuscade: Crit DMG")))).toBe(true);
  });
});

describe("an arts reaction's level as the log shows it, where the replay's enemy holds other stacks (2026-11-11)", () => {
  const A = "chr_0032_lizhiyan";
  const near = (frame: number, t: number) => Math.abs((frame * 1000) / FPS - t) <= 34;
  /** A fixture's replay: its reaction of `status` near `t` ms (the level), and the Corrosion levels its landings in the 10 s after see. */
  const replayAt = (f: string, status: string, t: number) => {
    const fx = readLogFixture(new URL(`../fixtures/pending/zmdlogs-${f}.json`, import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const reaction = r.reactions.find((e) => e.kind === "reaction" && e.status === status && near(e.frame, t));
    const after = r.hits.filter((h) => h.frame > (t * FPS) / 1000 + 1 && h.frame < ((t + 10000) * FPS) / 1000);
    const shreds = new Set(after.flatMap((h) => h.modifiers.filter((m) => m.source.startsWith("Corrosion level ")).map((m) => m.source)));
    return { level: reaction?.kind === "reaction" ? reaction.level : null, shreds: [...shreds], fx, r };
  };

  it("4a64: Arcane's Corrosion at 52982 ms is level 1, as its logged hit (16537) says (the replay's Cryst stack from Xaihi's battle skill at 33.3 s, a cast the log shows no hit of, made it 2)", () => {
    const { level, shreds, fx, r } = replayAt("4a64e58e75ad", "corrosion", 52982);
    expect(level).toBe(1);
    expect(shreds).toEqual(["Corrosion level 1"]);
    const hit = fx.hits.find((h) => h.t === 52982 && h.operator === A && h.event === "buff_common_natural_triggered") as LogHit;
    const l = r.statusLanding(hit);
    expect("unknown" in l ? null : l.inputs?.kind === "status" ? l.inputs.reaction.stacks : null).toBe(1);
  });

  it("3f78: Arcane's Corrosion at 46994 ms is level 2 (its hit fits level 2, or level 1 with a set buff the replay isn't sure of; the logged hits' inflictions say 2)", () => {
    // Logged at 46994 ms, the end of a stop it landed just before (LoggedCast.beforeStop): the replay's at 46167 ms.
    const { level, shreds } = replayAt("3f78ceb15bc3", "corrosion", 46167);
    expect(level).toBe(2);
    expect(shreds).toEqual(["Corrosion level 2"]);
  });

  it("keeps the replay's own level where the log's doesn't decide (489c: Rossi's Combustion at 96773 ms fits level 3, or level 1 with a crit; the inflictions say 1)", () => {
    expect(replayAt("489c0be3e162", "combustion", 96773).level).toBe(1);
  });
});

// What a hit's reaction triggers before its damage (whole log checks): tests/slow/log-cases.test.ts.

describe("Arcane's WILL combo touch: the element of what opened her window (element \"window\", in-game test 33)", () => {
  const A = "chr_0032_lizhiyan";
  const replayOf = (f: string) => {
    const fx = readLogFixture(new URL(`../fixtures/${f}.json`, import.meta.url).pathname);
    return { fx, r: logBuffReplay(data, fx).replay };
  };
  const logged = (fx: LogFixture, t: number, operator: string, event: string) => fx.hits.find((h) => h.t === t && h.operator === operator && h.event === event) as LogHit;
  const frameOf = (l: { frame: number } | { unknown: string }) => {
    if ("unknown" in l) throw new Error(l.unknown);
    return l.frame;
  };

  it("9a80: with no infliction on the enemy at the touch (2167 ms), it applies the Cryst its window's Corrosion consumed, which Rossi's Lift at 7807 ms consumes", () => {
    const { fx, r } = replayOf("pending/zmdlogs-9a8097fcf351");
    const touch = frameOf(r.landing(logged(fx, 2167, A, "buff_chr_0032_lizhiyan_combo_skill_seal_total")));
    // What opened the window: the Corrosion before the touch, Nature onto Cryst.
    const opener = r.reactions.filter((x) => x.kind === "reaction" && x.frame <= touch).at(-1);
    expect(opener?.kind === "reaction" ? [opener.status, opener.consumed] : null).toEqual(["corrosion", "cryst"]);
    const lift = frameOf(r.statusLanding(logged(fx, 7807, "chr_0028_wulfa", "buff_physical_airborne")));
    const consumed = r.reactions.filter((x) => x.kind === "consumed" && x.operator === "chr_0028_wulfa" && x.frame === lift);
    expect(consumed.map((x) => (x.kind === "consumed" ? [x.element, x.stacks] : null))).toEqual([["cryst", 1]]);
  });

  it("0eef: with the enemy's infliction the opener's (Si's Cryo at the ms of her combo, landing after its cast), it's that one: the Cryst burst at 3729 ms", () => {
    const { fx, r } = replayOf("zmdlogs-0eef2474a26f");
    const burst = r.statusLanding(logged(fx, 3729, A, "buff_common_cryst_cryst_triggered"));
    expect("unknown" in burst ? burst.unknown : burst.element).toBe("cryst");
  });
});

describe("a7a7a40c97ed: Liino's battle-skill events in Vocalist Stance are its beats", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-a7a7a40c97ed.json", import.meta.url).pathname);
  const r = logBuffReplay(data, fx).replay;
  const L = "chr_0035_liino";
  it("casts none of them: the stance began before the log (its ATK listed since -1776 ms), so no projectiles from 2205 ms to 35353 ms, and no volley before the log's first at 12.58 s", () => {
    const own = r.hits.filter((h) => h.operator === L && h.skillId === `${L}_normal_skill`).map((h) => ({ s: (h.frame * 1000) / FPS, hit: h.hitId }));
    expect(own.filter((h) => h.hit !== "volley" && h.s < 36000)).toEqual([]);
    expect(Math.min(...own.filter((h) => h.hit === "volley").map((h) => h.s))).toBeGreaterThan(12000);
  });
  it("takes Arcane's press at 37415 ms for the battle skill placed at 40523 ms (351 ms later in the world's time): no Corrosion before her ultimate's at 40865 ms", () => {
    const corrosions = r.reactions.filter((x) => x.kind === "reaction" && x.status === "corrosion" && x.frame >= 38 * FPS && x.frame <= 43 * FPS).map((x) => (x.frame * 1000) / FPS);
    expect(corrosions.length).toBeGreaterThan(0);
    expect(Math.min(...corrosions)).toBeGreaterThan(40800);
  });
});

describe("489c0be3e162: Rossi's ultimate crits the log leaves out, and her bleed's ticks (2026-11-22)", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-489c0be3e162.json", import.meta.url).pathname);
  const r = logBuffReplay(data, fx);
  const rossi = (event: string, from: number, to: number) => fx.hits.filter((h) => h.operator === "chr_0028_wulfa" && h.event === event && h.t >= from && h.t <= to);

  it("lands the Seething Blood extras her crit stabs fire: the log gives the stabs no crit, but logs each extra at its stab's ms (shownCrits)", () => {
    const stabs = rossi("chr_0028_wulfa_ultimate_skill", 94000, 96200);
    expect(stabs.every((h) => h.crit === null)).toBe(true);
    const extras = rossi("buff_chr_0028_wulfa_normal_bleed_crit_extra_damage", 94000, 96200);
    expect(extras.length).toBeGreaterThan(20);
    expect(extras.every((h) => !("unknown" in r.replay.landing(h)))).toBe(true);
  });

  it("counts as crits the crit-less hits where Wolven Blood's listed layers show them (layerCrits): her final before 57 s, not at 59.5 s", () => {
    const kits = fx.team.flatMap((b) => effectiveKit(data, b) ?? []);
    const placement = placeHits(data, fx);
    const crits = layerCrits(kits, fx, placement, shownCrits(kits, fx, placement));
    // 55610 ms: a power attack with no crit flag, listed with a layer from its ms and the max-stack final.
    const power = fx.hits.findIndex((h) => h.t === 55610 && h.event === "chr_0028_wulfa_power_attack");
    expect(fx.hits[power]?.crit).toBeNull();
    expect(crits.get(power)).toBe(true);
    const finals = r.replay.kitWindows("chr_0028_wulfa:wpn_sword_0022.final", "chr_0028_wulfa").map((w) => w.start);
    // The log's final from 55.61 s; the replay's from 56.73 s, two layers short from two bleed ticks it lands off the
    // log's (47.13 s at 46.60 s, before the first final's end clears the layers; 52.18 s none): not crits.
    expect(finals.some((s) => s > 55000 && s < 57000)).toBe(true);
  });

  it("reads her logged crits back from the layers when every flag is hidden, and not from the listing moved at random (negative control)", () => {
    const kits = fx.team.flatMap((b) => effectiveKit(data, b) ?? []);
    const rossiHit = (h: LogHit) => h.operator === "chr_0028_wulfa";
    const precision = (moved: (since: number) => number) => {
      const move = (e: LogEffect) => (e.since !== undefined && e.buff === "buff_wpn_sword_0022_layer" ? { ...e, since: moved(e.since) } : e);
      const hidden: LogFixture = { ...fx, hits: fx.hits.map((h) => (rossiHit(h) ? { ...h, crit: null, effects: h.effects.map(move), boundaryEffects: h.boundaryEffects.map(move) } : h)) };
      const placement = placeHits(data, hidden);
      const inferred = [...layerCrits(kits, hidden, placement, shownCrits(kits, hidden, placement)).keys()].map((i) => fx.hits[i]?.crit).filter((c) => c !== null);
      return { n: inferred.length, right: inferred.filter((c) => c === true).length / inferred.length };
    };
    const flagged = fx.hits.filter((h) => rossiHit(h) && h.crit !== null);
    const base = flagged.filter((h) => h.crit === true).length / flagged.length;
    // As measured 2026-11-23: 152 of 156 right (0.97) against a base rate of 0.64.
    const own = precision((s) => s);
    expect(own.n).toBeGreaterThan(100);
    expect(own.right).toBeGreaterThan(0.95);
    // Each listed start moved to another of her hits' moments (a fixed shuffle): no better than the base rate.
    const moments = [...new Set(fx.hits.filter(rossiHit).map((h) => h.t))].sort((a, b) => a - b);
    const shuffled = precision((s) => moments[(moments.indexOf(s) * 7919 + 13) % moments.length] ?? s);
    expect(shuffled.right).toBeLessThan(base + 0.1);
  });

  it("takes each bleed tick from its logged one (KitBuff.ticksShownByHits): the replay's clock runs 0.3–0.6 s off the log's within one application", () => {
    // Unpinned, the replay ticked 368 ms after the first two and had none within 0.5 s of the third.
    for (const t of [30565, 31564, 41667]) {
      const tick = rossi("buff_chr_0028_wulfa_normal_bleed", t, t)[0] as LogHit;
      const landing = r.replay.landing(tick);
      expect("unknown" in landing ? null : Math.abs((landing.frame * 1000) / FPS - t)).toBeLessThan(40);
    }
  });
});

describe("b6aa15281db4: a buff the log lists past the replay's expiry (engine assumption hidden-holds)", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-b6aa15281db4.json", import.meta.url).pathname);
  const placement = placeHits(data, fx);
  const end = (reading: string) => logBuffReplay(data, fx, placement, { assume: { "hidden-holds": reading } }).replay.kitWindows("chr_0011_seraph:cryo_fragility", "chr_0036_jsspsi").find((w) => Math.abs(w.start - 28200) < 100)?.end;

  it("runs on to its last listed hit (43.78 s), not past the first hit without it (43.88 s), held by the stops between (log)", () => {
    // The run from 28.21 s: listed to 43.78 s on four operators' hits, the next hit without it at 43.88 s; the replay's own
    // expiry 39.67 s (39.77 s before Arcane's combo at 37.27 s held the world only to its reset, 9 frames: engine
    // assumption combo-reset). Kept a step at a time, Last Rite's ultimate stop at 40.9 s doesn't hold it past the log's end.
    const log = end("log") as number;
    expect(log).toBeGreaterThan(43780);
    expect(log).toBeLessThan(43880);
    expect(Math.abs((end("none") as number) - 39667)).toBeLessThan(40);
  });

  it("places the fight's hidden holds outside the Stagger, and keeps the log's end on top of them (placed)", () => {
    const r = logBuffReplay(data, fx, placement, { assume: { "hidden-holds": "placed" } }).replay;
    const h = r.hiddenHolds;
    expect(h?.total).toBeGreaterThan(500);
    expect(h?.holds.filter((x) => r.staggerSpans.some((s) => x.frame >= s.start && x.frame < s.end))).toEqual([]);
    // Held to the stops past its expiry in world time (holds.ts bounds), the placed holds don't carry it past the log's end.
    const placed = end("placed") as number;
    expect(placed).toBeGreaterThan(43780);
    expect(placed).toBeLessThan(43880);
    // The holds alone hold it past the replay's own expiry.
    expect(end("holds") as number).toBeGreaterThan(40000);
  });
});

describe("4360447193ac: Gilberta's Vulnerable stacks past 20 s on a tower boss (2026-11-23)", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-4360447193ac.json", import.meta.url).pathname);

  it("takes runs listed side by side as two instances, not a refresh (loggedLaneEnds)", () => {
    const runs = loggedLaneEnds(fx).runs.get("buff_wpn_funnel_0008_magic_damage_taken_up|chr_0004_pelica") ?? [];
    // Perlica's Arts DMG Taken from 92.24 s is listed beside the one from 104.92 s until 108.27 s.
    expect(runs.find((r) => r.since === 92241)?.refreshed).toBe(false);
  });

  it("reads her 116.0 s ultimate's Susceptibility as listed (0.39, 3 stacks): the hold Perlica's run places keeps the stacks", () => {
    // Perlica's run from 92.24 s, 0.74 s late, places a hold that keeps the 90.87 s stacks to the 113.40 s Lift.
    // Avywenna's ultimate at 117.98 s under it was a mismatch at 0.33.
    const v = checkLog(data, fx).find((x) => x.hit.t === 117977 && x.hit.event === "chr_0012_avywen_ultimate_skill");
    expect(v?.kind === "match" ? v.class : v?.kind).toBe("plain");
  });
});

describe("5082ceaffad1: an instance buff's run with no reapplication inside it is a clock, however late (2026-11-23)", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-5082ceaffad1.json", import.meta.url).pathname);

  it("holds Xaihi's weapon team ATK from 27.37 s (her last instance) to Arcane's 50.51 s hits, as the log lists it", () => {
    // Listed on Arcane and Yvonne to 51.1 s, 1.67 s of world time past the replay's expiry (49.43 s): over
    // INSTANCE_LATE_MS, but nothing reapplies it inside the run, so no refresh in place explains it (buffreplay.ts
    // runBounds). Arcane's laser and attack 2 there were ×1.18.
    const v = checkLog(data, fx).filter((x) => x.hit.t === 50506 && x.hit.operator === "chr_0032_lizhiyan");
    expect(v.length).toBe(2);
    expect(v.map((x) => (x.kind === "match" ? x.class : x.kind))).toEqual(["plain", "plain"]);
  });
});
