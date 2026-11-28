// A burst's application (StatusEvent burstApplied, StatusOn burst `applied`; the combo-windows task, 2026-11-28):
// Typhoeus's talent Sign comes when the Nature burst's buff is added to the enemy, one triggerInterval before its
// damage (passitive_enemy_listennaturalspellbrust: abilityEvent 9 on the Nature-burst tag): at her Power Shot's
// arrow, not its burst 10 enemy frames later; at a teammate's infliction, not its burst 1 s later. 0eef 6.77 s: her
// floating combo pressed between a shot's arrow (6.13 s) and its burst (7.57 s).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, createContext, FPS, init, replayCast, type Build, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { logBuffReplay, readLogFixture } from "@efsim/cli";

const data = loadGameData();
const target = { enemy: "eny_0051_rodin", level: 90 };
const T = "chr_0034_typhoea";
const typhoeus = JSON.parse(readFileSync(new URL("../examples/typhoeus-p5.json", import.meta.url), "utf8")) as Build;

describe("a burst's application (burstApplied)", () => {
  const ctx = createContext(data, { team: [typhoeus], target, durationFrames: 20 * FPS, rotation: [], options: { crit: "never" }, controlled: T });
  const signs = (st: TimelineState) => st.stacks[T]?.signs ?? 0;

  it("Typhoeus's Power Shot gives its burst's Sign at the arrow's landing, before the burst's damage", () => {
    let st = replayCast(ctx, init(ctx), T, `${T}_normal_skill_floating_start`, 0);
    st = advance(ctx, st, 40);
    const before = signs(st);
    st = replayCast(ctx, st, T, `${T}_floating_attack1`, 40);
    const arrow = 40 + 1;
    // Just after the arrow lands: the Sign is there, the burst's damage not yet (enemyDelay 10).
    const atArrow = advance(ctx, st, arrow + 1);
    expect(atArrow.hits.some((h) => h.skillId === `${T}_floating_attack1` && h.hitId === "power_shot")).toBe(true);
    expect(atArrow.hits.some((h) => h.hitId === "burst")).toBe(false);
    expect(signs(atArrow)).toBe(Math.min(8, before + 1));
    // The burst's damage brings no second Sign.
    const after = advance(ctx, st, arrow + 20);
    expect(after.hits.some((h) => h.hitId === "burst")).toBe(true);
    expect(signs(after)).toBe(signs(atArrow));
  });

  it("0eef's floating combo at 6.77 s, pressed between a shot's arrow and its burst, is no longer inside a shut window", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-0eef2474a26f.json", import.meta.url).pathname);
    const flags = logBuffReplay(data, fx).replay.castFlags.filter((x) => x.kind === "inside" && x.cast.operator === T);
    expect(flags).toEqual([]);
  });

  it("a combo window shut at the press in words: its trigger the cooldown kept shut, a start inside its own slow-down (8f32 82.90 s)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-8f3215963333.json", import.meta.url).pathname);
    const why = logBuffReplay(data, fx).replay.castFlags.filter((x) => x.kind === "inside" && x.cast.operator === "chr_0028_wulfa").map((x) => x.why);
    expect(why).toContainEqual(expect.stringMatching(/its combo window, shut until then: last cast at frame \d+; a trigger at frame \d+ \(cryst infliction\) the cooldown kept shut \(ready at frame \d+\); that is 13 frame\(s\) into its own slow-down \(19 frames\)/));
  });

  it("the burst's own record is unchanged: a `burst` reaction at its damage, no record of the application", () => {
    let st = replayCast(ctx, init(ctx), T, `${T}_normal_skill_floating_start`, 0);
    st = advance(ctx, replayCast(ctx, advance(ctx, st, 40), T, `${T}_floating_attack1`, 40), 80);
    expect(st.reactions.some((r) => (r as { kind: string }).kind === "burstApplied")).toBe(false);
  });
});
