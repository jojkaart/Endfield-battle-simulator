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

describe("Liino: Cosmovoice starts at her ultimate's frame 77", () => {
  const amp = (s: TimelineState) => s.buffs.find((b) => b.owner === LI && b.id === "cosmovoice_amp");

  it("on its own: at frame 77, the end of its time stop (buff_chr_0035_liino_ultskill_music_tag)", () => {
    expect(amp(run([act(LI, "ultimate_skill", 0)], 100))?.appliedAt).toBe(77);
  });

  it("with another ultimate's time stop starting inside hers and running on past it: still at 77 (dbaee23b801d: Xaihi's ultimate at 7606 ms, Cosmovoice at 8258 ms)", () => {
    // Laevatain's ultimate 1.5 s into Liino's: her stop holds Liino only from Liino's own stop's end, after what's due then.
    const s = run([act(LI, "ultimate_skill", 0), act(LA, "ultimate_skill", 1.5)], 200);
    expect(s.casts.filter((c) => c.skill === `${LA}_ultimate_skill`)).toHaveLength(1);
    expect(amp(s)?.appliedAt).toBe(77);
  });
});

describe("Liino: Vocalist Stance's volley is a 10 s timer, not a reaction's (in-game test 26)", () => {
  // buff spelllnfliction_extraattack: triggerInterval atk_trigger (10 s), first tick at once (frame 45); its tick's
  // reaction check (CheckBuffIdInContext spelllnfliction_hit) has isEnable false. No teammate attacks: no reaction.
  it("fires at the battle skill's frame 45 and every 10 s after, with no reaction in the fight", () => {
    const s = run([act(LI, "normal_skill", 0)], 34 * 30);
    expect(s.reactions).toHaveLength(0);
    const volleys = s.hits.filter((h) => h.operator === LI && h.hitId === "volley");
    const firsts = volleys.filter((h, i) => i % 6 === 0).map((h) => h.frame);
    expect(volleys).toHaveLength(24);
    expect(firsts).toEqual([45 + 24, 345 + 24, 645 + 24, 945 + 24]);
  });
});

describe("Liino: Cosmovoice's beats are its song's ticks (buff ultskill_music_damage)", () => {
  // Ticks every ultmusic_trigger (1.5 s) from frame 77, first at once; ten (the logs': 4bfc6f3e84b8, 4d60e7fe92c2,
  // 984748cfa662), none at Cosmovoice's end (527); the finale at the ultimate's frame 508.
  // The first beat is the ultimate's own (trigger ult_song at frame 77, first_beat), the rest the song buff's ticks.
  const of = (s: TimelineState, ...hitIds: string[]) => s.hits.filter((h) => h.operator === LI && hitIds.includes(h.hitId)).map((h) => h.frame);

  it("ten beats 45 frames apart from frame 77, then the finale at 508", () => {
    const s = run([act(LI, "ultimate_skill", 0)], 20 * 30);
    expect(of(s, "first_beat")).toEqual([77]);
    expect(of(s, "first_beat", "beats")).toEqual([77, 122, 167, 212, 257, 302, 347, 392, 437, 482]);
    expect(of(s, "finale")).toEqual([508]);
  });

  it("End Stance ends them: no beat after it, no finale", () => {
    const s = run([act(LI, "ultimate_skill", 0), act(LI, "normal_skill_end", 8)], 20 * 30);
    expect(of(s, "first_beat", "beats")).toEqual([77, 122, 167, 212]);
    expect(of(s, "finale")).toEqual([]);
  });
});
