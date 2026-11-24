// The log check's kit-buff replay (tests/buffreplay.test.ts), part 2: Typhoeus's shots that hit nothing, her hover
// through her shots, and Corrosion from the replay's landings (bdf2). A separate file so the default suite's workers
// balance.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { activeAt, advance, createContext, FPS, init, replayCast, type Build, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { type LogHit } from "@efsim/logs";
import { checkLog, logBuffReplay, readLogFixture, type HitVerdict } from "@efsim/cli";

const data = loadGameData();
const target = { enemy: "eny_0051_rodin", level: 90 };

describe("Typhoeus's shots that hit nothing (2026-11-15)", () => {
  const T = "chr_0034_typhoea";
  const typhoeus = JSON.parse(readFileSync(new URL("../examples/typhoeus-p5.json", import.meta.url), "utf8")) as Build;

  it("replayCast `missed`: no hit lands, but the Hunting Arrow is used at the cast and the shot counts and keeps her hover", () => {
    const ctx = createContext(data, { team: [typhoeus], target, durationFrames: 20 * FPS, rotation: [], options: { crit: "never" }, controlled: T });
    const hovering = (st: TimelineState) => st.buffs.some((b) => b.id === "hovering" && b.owner === T && activeAt(b, st.frame));
    let st = replayCast(ctx, init(ctx), T, `${T}_normal_skill_floating_start`, 0);
    st = advance(ctx, st, 40);
    const before = st.stacks[T] as Record<string, number>;
    st = replayCast(ctx, st, T, `${T}_floating_attack1`, 40, { missed: true });
    st = advance(ctx, st, 90);
    // floating_attack1 timeline action 33, frame 1: FinishBuffAdvanced of arrow_num (1 layer) before the projectile
    // launches, so a shot that hits nothing still uses its arrow; the Sign and team energy come from the projectile's
    // hit (floating_attack1_01_projhit), so none.
    expect(st.hits.filter((h) => h.skillId === `${T}_floating_attack1`)).toEqual([]);
    expect(st.stacks[T]?.arrows).toBe((before.arrows as number) - 1);
    expect(st.stacks[T]?.signs).toBe(before.signs);
    expect(st.stacks[T]?.abatk).toBe(1);
    // Her idle restarts from the shot (its loop at frame 22, floating_end 27 frames on, the landing 8 after: frame 97), so
    // at frame 90 she still hovers, where the battle skill's own idle (loop at 37: frame 72) would have ended it.
    expect(hovering(st)).toBe(true);
    expect(hovering(advance(ctx, st, 98))).toBe(false);
  });

  it("9090afbacec9: her hover lasts from her shot at 57615 ms to her logged shot at 60630 ms across Arcane's ultimate stop, so the combo is the hovering one", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-9090afbacec9.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    // Her shot at 57615 ms, then no hit by anyone until 60630 ms: Arcane's ultimate stop (59.03–60.70 s), played before
    // Liino's in turn (logcasts.ts inTurn, 2026-11-25), holds her idle hover (1.9 s after a shot). Before, with Arcane's
    // stop over Liino's, the replay added a shot that hit nothing at 58733 ms to keep the hover.
    expect(r.missed).toEqual([]);
    const at = (t: number, event: string) => fx.hits.find((h) => h.operator === T && h.t === t && h.event === `${T}_${event}`) as LogHit;
    const combo = at(63748, "combo_01_projhit");
    const l = r.landing(combo);
    expect("unknown" in l ? l.unknown : l.skillId).toBe(`${T}_combo_skillfloating`);
    // Hovering ATK (P1) on her hits after the combo, as the log lists it.
    for (const h of [combo, at(64503, "floating_attack1_01_projhit"), at(65785, "floating_attack1_01_projhit")]) expect(r.instances(h, "buff_chr_0034_typhoea_potential_atkup")).toBe(1);
  });

  it("dbaee23b801d: her battle skill from its event (0.85 s, before Li Zhiyan's ultimate stop); the first shot that hit nothing is looked for past the stop", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-dbaee23b801d.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    // The state at the battle skill's action's end (1.7 s) gave a first shot inside the stop, which no shot can be.
    expect(r.missed.map((m) => [m.skillId, Math.round(m.start / 100) / 10])).toEqual([
      [`${T}_floating_attack1`, 3.8],
      [`${T}_floating_attack3`, 6.6],
    ]);
  });

  it("1cd1657bc305: her combo pressed at 34.70 s inside her hover, its arrows after Liino's ultimate stop, is the hovering one", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-1cd1657bc305.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const combo = fx.hits.find((h) => h.operator === T && h.event === `${T}_combo_01_projhit` && h.t > 39000) as LogHit;
    const l = r.landing(combo);
    expect("unknown" in l ? l.unknown : l.skillId).toBe(`${T}_combo_skillfloating`);
    const later = fx.hits.find((h) => h.operator === T && h.event === `${T}_floating_attack1_01_projhit` && h.t > 40000) as LogHit;
    expect(r.instances(later, "buff_chr_0034_typhoea_potential_atkup")).toBe(1);
  });

  it("fc63a2001251: none where the log shows a shot in the gap (a cast the placement started elsewhere)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-fc63a2001251.json", import.meta.url).pathname);
    expect(logBuffReplay(data, fx).replay.missed).toEqual([]);
  });
});

describe("bdf223db8e49: Typhoeus's hover through her shots and her hovering combo", () => {
  it("keeps the hover when a logged shot cuts the loop the previous one started, and casts the combo the slot holds", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-bdf223db8e49.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx);
    // The combo at ~11 s: logged as the shared combo keys, replayed as the hovering combo (it keeps the hover and its P1 ATK).
    const combo = fx.hits.find((h) => h.event === "chr_0034_typhoea_combo_01_projhit") as LogHit;
    const l = r.replay.landing(combo);
    expect("unknown" in l ? l.unknown : l.skillId).toBe("chr_0034_typhoea_combo_skillfloating");
    expect(r.replay.instances(combo, "buff_chr_0034_typhoea_potential_atkup")).toBe(1);
    const v = checkLog(data, fx, { replay: r }).filter((x) => x.hit.operator === "chr_0034_typhoea" && x.kind === "match");
    expect(v.filter((x) => x.kind === "match" && x.class === "plain").length).toBeGreaterThanOrEqual(44);
  });
});

describe("bdf223db8e49: Corrosion from the replay's landings", () => {
  it("reads hits under Corrosion at the engine's level and shred where the replay landed them (levels tried only elsewhere)", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-bdf223db8e49.json", import.meta.url).pathname);
    const under = checkLog(data, fx).filter((v) => v.hit.unquantified.some((u) => u.buff.startsWith("buff_common_natural")));
    const matched = under.filter((v): v is Extract<HitVerdict, { kind: "match" }> => v.kind === "match");
    const tried = matched.filter((v) => v.assumptions.some((a) => a.kind === "corrosion"));
    expect(matched.length).toBeGreaterThan(60);
    expect(tried.length).toBeLessThanOrEqual(3);
    expect(tried.every((v) => v.assumed.some((a) => a.includes("the replay can't say")))).toBe(true);
  });
});

describe("A buff created inside a running stop is held by its rest (engine assumption buff-in-stop, 2026-11-18)", () => {
  it("d9e59d0fb737: her Hail of Arrows window, created inside Gilberta's and Arcane's stops, is open for her 5th rain at 13.62 s", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-d9e59d0fb737.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const w = r.kitWindows("chr_0034_typhoea:hail_window", "chr_0034_typhoea")[0];
    expect(w?.end ?? 0).toBeGreaterThan(14000);
    const sub2 = fx.hits.filter((h) => h.event === "chr_0034_typhoea_ultimate_skill_arrowrain_sub2");
    expect(sub2.length).toBe(6);
    expect(sub2.every((h) => !("unknown" in r.landing(h)))).toBe(true);
  });
});

describe("Liino in the replay: volleys from the log, End Stance before a battle skill in Cosmovoice (2026-11-18)", () => {
  const L = "chr_0035_liino";

  it("9090: each logged volley is replayed (its tick taken from the log: the game's clock runs slower than the replay's)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-9090afbacec9.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx);
    const volleys = fx.hits.filter((h) => h.operator === L && h.event === "chr_0035_liino_normal_skill_projhit_hit");
    expect(volleys).toHaveLength(60);
    const landed = volleys.filter((h) => !("unknown" in r.replay.landing(h)));
    // All but the first volley's two after Arcane's combo stop at 2.5 s (the replay's lands 4 before it).
    expect(landed.length).toBeGreaterThanOrEqual(58);
  });

  it("4360: Cosmovoice's Amp leaves the team where the log stops listing it (62.1 s), before the battle skill at 63.6 s, not at its own end", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-4360447193ac.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx);
    const w = r.replay.kitWindows(`${L}:cosmovoice_amp`, "chr_0004_pelica").find((x) => x.start > 50000 && x.start < 60000);
    expect(w?.end).toBeGreaterThan(62100);
    expect(w?.end).toBeLessThanOrEqual(62757);
  });
});
