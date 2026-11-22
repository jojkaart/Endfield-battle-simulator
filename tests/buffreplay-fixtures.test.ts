// The log check's kit-buff replay (tests/buffreplay.test.ts), part 3: on 4e5e1390085e, where the log stops listing
// Camille's weapon buffs; simulateLog; casts the log shows only indirectly; reaction levels and Arcane's combo touch.
// A separate file so the default suite's workers balance.
import { describe, expect, it } from "vitest";
import { effectiveKit, FPS, type OperatorKit } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { type LogFixture, type LogHit } from "@efsim/logs";
import { castsFromTriggerHits, checkLog, LOG_LISTING, logBuffReplay, readLogFixture, replayedCasts, simulateLog } from "@efsim/cli";
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
    const wrong = r.replay.hits.filter((h) => h.ref !== undefined && typeof h.loggedCrit === "boolean" && h.loggedCrit !== fx.hits[Number(h.ref)]?.crit);
    expect(wrong).toEqual([]);
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
    const { level, shreds } = replayAt("3f78ceb15bc3", "corrosion", 46994);
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
  it("casts only the stance's first event: no projectiles from the nine beats after it (5405 ms to 35353 ms)", () => {
    const own = r.hits.filter((h) => h.operator === L && h.skillId === `${L}_normal_skill` && h.hitId !== "volley").map((h) => (h.frame * 1000) / FPS);
    expect(own.length).toBeGreaterThan(0);
    expect(Math.max(...own)).toBeLessThan(5000);
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

  it("takes each bleed tick from its logged one (KitBuff.ticksShownByHits): the replay's clock runs 0.3–0.6 s off the log's within one application", () => {
    // Unpinned, the replay ticked 368 ms after the first two and had none within 0.5 s of the third.
    for (const t of [30565, 31564, 41667]) {
      const tick = rossi("buff_chr_0028_wulfa_normal_bleed", t, t)[0] as LogHit;
      const landing = r.replay.landing(tick);
      expect("unknown" in landing ? null : Math.abs((landing.frame * 1000) / FPS - t)).toBeLessThan(40);
    }
  });
});
