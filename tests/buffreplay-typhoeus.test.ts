// The log check's kit-buff replay (tests/buffreplay.test.ts), part 2: Typhoeus's shots that hit nothing, her hover
// through her shots, and Corrosion from the replay's landings (bdf2). A separate file so the default suite's workers
// balance.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { activeAt, advance, createContext, FPS, init, replayCast, type Build, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { type LogHit } from "@efsim/logs";
import { checkLog, formatBuffReplay, logBuffReplay, readLogFixture, type HitVerdict } from "@efsim/cli";

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

  it("9090afbacec9: adds the one shot that keeps her hover to her logged shot at 60630 ms, so the combo is the hovering one", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-9090afbacec9.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    // Her shot at 57615 ms, then no hit by anyone until 60630 ms: one shot that hit nothing in between (the 2nd), at the
    // earliest frame from which her idle hover (1.9 s after a shot) still reaches the logged one.
    expect(r.missed.map((m) => ({ ...m, start: Math.round(m.start) }))).toEqual([{ operator: T, skillId: `${T}_floating_attack2`, start: 58733, need: { skillId: `${T}_floating_attack1`, start: expect.closeTo(60597, 0) } }]);
    const at = (t: number, event: string) => fx.hits.find((h) => h.operator === T && h.t === t && h.event === `${T}_${event}`) as LogHit;
    const combo = at(63748, "combo_01_projhit");
    const l = r.landing(combo);
    expect("unknown" in l ? l.unknown : l.skillId).toBe(`${T}_combo_skillfloating`);
    // Hovering ATK (P1) on her hits after the combo, as the log lists it.
    for (const h of [combo, at(64503, "floating_attack1_01_projhit"), at(65785, "floating_attack1_01_projhit")]) expect(r.instances(h, "buff_chr_0034_typhoea_potential_atkup")).toBe(1);
    expect(formatBuffReplay(data, logBuffReplay(data, fx)).join("\n")).toContain(`assumed: 1 cast(s) that hit nothing (no log shows one), added where a logged cast needs them:\n    Typhoeus ${T}_floating_attack2 at 58733 ms`);
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
