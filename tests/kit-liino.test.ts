// Liino's kit (chr_0035_liino): what the data says her stances leave behind, on the example scenario's builds
// (examples/liino-laevatain.scenario.json).
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const LI = "chr_0035_liino";
const LA = "chr_0016_laevat";
const example = readScenario(new URL("../examples/liino-laevatain.scenario.json", import.meta.url).pathname);
const scenario: TimelineScenario = { ...example, controlled: LA, options: { ...example.options, teammateAttacks: false } };
/** `at` in seconds. */
const act = (op: string, skill: string, at: number): RotationAction => ({ operator: op, skill: `${op}_${skill}`, at: Math.round(at * 30) });
const run = (rotation: readonly RotationAction[], until: number): TimelineState => {
  const ctx = createContext(data, scenario);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, Math.max(s.frame, until));
};
const from = (h: LandedHit | undefined, text: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(text));

describe("Liino: Vocalist Stance's team ATK lingers after it ends", () => {
  const LINGER = "Vocalist Stance's team ATK after it ends";
  const STANCE = "Vocalist Stance (battle skill): team ATK";
  const attacks = (s: TimelineState) => s.hits.filter((h) => h.operator === LA && h.skillId === `${LA}_attack1`);

  it("for finish_duration (5 s) after End Stance (buff_chr_0035_liino_atkup_finishtime)", () => {
    // Battle skill at 0, End Stance at 4 s, Laevatain's attack 1 at 6, 8.5 and 10 s (each lands a few frames later).
    const s = run([act(LI, "normal_skill", 0), act(LI, "normal_skill_end", 4), act(LA, "attack1", 6), act(LA, "attack1", 8.5), act(LA, "attack1", 10)], 12 * 30);
    expect(attacks(s).map((h) => [Math.round(h.frame / 30), from(h, LINGER).length, from(h, STANCE).length])).toEqual([[6, 1, 0], [9, 1, 0], [10, 0, 0]]);
  });

  it("doesn't add to a new stance's ATK (one stacking key, liino_atk_up)", () => {
    const s = run([act(LI, "normal_skill", 0), act(LI, "normal_skill_end", 4), act(LI, "normal_skill", 7.5), act(LA, "attack1", 8.5)], 10 * 30);
    expect(s.casts.filter((c) => c.skill === `${LI}_normal_skill`).length).toBe(2);
    const hit = attacks(s)[0];
    expect(from(hit, LINGER).length + from(hit, STANCE).length).toBe(1);
  });
});
