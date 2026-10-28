// Teammates' own basic attacks (accuracy plan B0; engine timeline/teammates.ts).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, simulate, TEAMMATE_PAUSE_FRAMES, type Build, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const read = (f: string) => JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url), "utf8")) as Build;
const laevatain = read("laevatain-forgeborn.json");
const gilberta = read("gilberta-usp02.json");
const liino = read("liino-heal-usp.json");
const L = laevatain.operator;
const G = gilberta.operator;

const scenario = (team: Build[], rotation: RotationAction[], teammateAttacks = true): TimelineScenario => ({
  team,
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 30 * 20,
  rotation,
  options: { crit: "never", teammateAttacks },
  controlled: team[0]?.operator as string,
});
const run = (sc: TimelineScenario, until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of sc.rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const own = (s: TimelineState, op: string) => s.casts.filter((c) => c.operator === op && c.teammate);

describe("teammates' own basic attacks", () => {
  it("off by default in the engine: a teammate without a rotation does nothing", () => {
    expect(own(run(scenario([laevatain, gilberta], [], false)), G)).toEqual([]);
  });

  it("a teammate runs its chain at the chain's windows, then pauses after the Final Strike", () => {
    const s = run(scenario([laevatain, gilberta], []));
    const casts = own(s, G);
    const steps = casts.map((c) => c.skill.replace(`${G}_`, ""));
    expect(steps.slice(0, 4)).toEqual(["attack1", "attack2", "attack3", "attack4"]);
    // Each step from the previous one's window, before its exclusive end; the next chain after the pause.
    const head = casts.findIndex((c, i) => i > 0 && c.skill === `${G}_attack1`);
    expect(head).toBeGreaterThan(0);
    const gap = (casts[head]?.frame ?? 0) - (casts[head - 1]?.frame ?? 0);
    expect(gap).toBeGreaterThanOrEqual(TEAMMATE_PAUSE_FRAMES);
    // The controlled operator never attacks on its own.
    expect(own(s, L)).toEqual([]);
  });

  it("its Final Strike deals no Stagger and gives no SP (both the controlled operator's only)", () => {
    const s = run(scenario([laevatain, gilberta], []));
    expect(s.stagger.poise).toBe(280);
    const solo = run(scenario([laevatain], []));
    expect(s.sp).toBeCloseTo(solo.sp, 6);
    expect(s.hits.some((h) => h.operator === G)).toBe(true);
  });

  it("its own skill cuts its attack at once, and its chain starts again after that skill", () => {
    const at = 20;
    const s = run(scenario([laevatain, gilberta], [{ operator: G, skill: `${G}_normal_skill`, at }]));
    const cast = s.casts.find((c) => c.operator === G && c.skill === `${G}_normal_skill`);
    expect(cast?.frame).toBe(at);
    expect(own(s, G).some((c) => c.frame > at)).toBe(true);
  });

  it("a swap hands the attacks over: the operator left attacks on its own, the new one doesn't", () => {
    const s = run(scenario([laevatain, gilberta], [{ operator: G, skill: "swap", at: 60 }]));
    expect(own(s, L).length).toBeGreaterThan(0);
    expect(Math.min(...own(s, L).map((c) => c.frame))).toBeGreaterThanOrEqual(60);
    expect(own(s, G).every((c) => c.frame < 60)).toBe(true);
  });

  it("Liino's Vocalist Stance (her battle skill's action) holds her own attacks, not her teammates'", () => {
    const N = liino.operator;
    const s = run(scenario([laevatain, liino, gilberta], [{ operator: N, skill: `${N}_normal_skill`, at: 0 }]));
    const stance = s.buffs.find((b) => b.id === "vocalist_stance" && b.owner === N);
    const end = stance?.expiresAt ?? s.frame;
    // (Her own attack at frame 0, the frame of her battle skill's cast, which cuts it at once.)
    expect(own(s, N).filter((c) => c.frame > 0 && c.frame < end)).toEqual([]);
    expect(end).toBeGreaterThan(120);
    expect(own(s, G).some((c) => c.frame < end)).toBe(true);
  });

  it("simulate counts the teammate's hits in its damage", () => {
    const on = simulate(data, scenario([laevatain, gilberta], []));
    const off = simulate(data, scenario([laevatain, gilberta], [], false));
    expect(on.perOperator[G] ?? 0).toBeGreaterThan(0);
    expect(off.perOperator[G] ?? 0).toBe(0);
  });
});
