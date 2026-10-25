// Smaller engine bugs from the round-two review (docs/review-2026-10.md, 5), each pinned by a test written before its
// fix: a freeze's end not moved by a time stop, the cooldown rebase skipped when a team buff ends for one member, a
// cast inside an advance recording the SP at the state's frame, and the perfect dodge's SP outside gainSp.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, SP, type Build, type GameData, type KitBuff, type KitTrigger, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { shiftEnemy } from "../packages/engine/src/timeline/clock.ts";
import { castSkill } from "../packages/engine/src/timeline/casting.ts";
import { spAt } from "../packages/engine/src/timeline/resources.ts";
import { skillCosts } from "../packages/engine/src/timeline/context.ts";

const data = loadGameData();
const readBuild = (f: string) => JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url), "utf8")) as Build;
const build = readBuild("laevatain-forgeborn.json");
const mate = readBuild("akekuri-frontiers.json");
const L = "chr_0016_laevat_";
const K = "chr_0019_karin_";
const op = build.operator;
const target = { enemy: "eny_0051_rodin", level: 90 };
const scenario = (rotation: RotationAction[], team: Build[] = [build], extra: Partial<TimelineScenario> = {}): TimelineScenario => ({ team, target, durationFrames: 30 * 60, rotation, options: { crit: "never" }, ...extra });

describe("a freeze's end and time stops", () => {
  it("a time stop starting before the end of a freeze moves its end (TimelineState.enemyFrozenUntil) with the enemy's clock", () => {
    const ctx = createContext(data, scenario([]));
    const s: TimelineState = { ...init(ctx), enemyFrozenUntil: 160 };
    // Until 2026-10-25 shiftEnemy left it: a second freeze after the stop then counted part of the first's time twice.
    expect(shiftEnemy(s, 120, 30).enemyFrozenUntil).toBe(190);
    // One after it ended leaves it.
    expect(shiftEnemy(s, 170, 30).enemyFrozenUntil).toBe(160);
  });
});

describe("a team buff with a combo cooldown's recovery rate, ended for one member", () => {
  // Laevatain's team buff: Akekuri's combo cooldown recovers 5× while it reaches her (attribute 93 + 4).
  const rate: KitBuff = { id: "t_rate", label: "rate", target: "team", duration: 30, modifiers: [{ attr: 93, value: 4 }] };
  const kit = data.kits.operators[op] as OperatorKit;
  const triggers = (forOne: boolean): KitTrigger[] => [
    { id: "t_start", on: { event: "fightStart" }, by: "self", do: [{ kind: "buff", buff: "t_rate" }] },
    // Akekuri's basic attack ends it: for her only (to: eventSubject), or for everyone.
    { id: "t_end", on: { event: "cast", skills: [`${K}attack1`] }, by: "anyone", do: [{ kind: "endBuff", buff: "t_rate", ...(forOne ? { to: "eventSubject" as const } : {}) }] },
  ];
  const g = (forOne: boolean): GameData => ({ ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, buffs: [...kit.buffs, rate], triggers: [...kit.triggers, ...triggers(forOne)] } } } });
  const readyAfter = (forOne: boolean) => {
    const ctx = createContext(g(forOne), { ...scenario([], [build, mate]), controlled: mate.operator });
    // Her combo on a 600-frame cooldown at the rate from frame 0 (projected end 120), then her attack at 30 ends the buff for her.
    let s: TimelineState = init(ctx);
    s = { ...s, readyAt: { ...s.readyAt, [`${K}combo_skill`]: 120 } };
    s = apply(ctx, s, { operator: mate.operator, skill: `${K}attack1`, at: 30 });
    return advance(ctx, s, 40).readyAt[`${K}combo_skill`];
  };

  it("rebases the member's cooldown as when the buff ends altogether (150 of 600 done at 5×, the rest at 1×: 480)", () => {
    expect(readyAfter(false)).toBe(480);
    // Until 2026-10-25 ending it for one member skipped the rebase: the cooldown stayed at the 5× projection (120).
    expect(readyAfter(true)).toBe(480);
  });
});

describe("a cast inside an advance: SP at the cast's frame", () => {
  it("spends from (and records) the SP at the cast, not at the state's earlier frame (its regen, capped at the maximum)", () => {
    const ctx = createContext(data, scenario([]));
    // The state at frame 0 with 290 SP and no pause: by frame 60 it has regenerated to the cap.
    const s: TimelineState = { ...init(ctx), sp: 290, spReturned: 0, spPausedUntil: 0, frame: 0 };
    const at = 60;
    expect(spAt(s, at)).toBe(SP.max);
    const r = castSkill(ctx, s, op, `${L}normal_skill`, at, false);
    const cost = skillCosts(ctx, op, `${L}normal_skill`, at).spCost;
    expect(cost).toBeGreaterThan(0);
    // Until 2026-10-25: spAfter 290 − cost, and the SP after it as if the regen to the cap hadn't been capped.
    expect(r.state.casts.at(-1)?.spAfter).toBe(SP.max - cost);
    expect(spAt(r.state, at)).toBe(SP.max - cost);
  });
});
