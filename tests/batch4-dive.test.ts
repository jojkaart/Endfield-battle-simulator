// Dives (batch-1 S10; owner, 2026-10-21): a rotation's dive is the controlled operator's jump, its fall
// (plunging_attack_start) and its landing (plunging_attack_end), with the timing of the native movement settings
// (constants.ts DIVE_MOTION). Shown with Laevatain's kit, and small hand-made changes to it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  advance,
  apply,
  createContext,
  DIVE_MOTION,
  diveFrames,
  earliestStart,
  init,
  JUMP,
  legalActions,
  searchRotation,
  simulate,
  type Build,
  type GameData,
  type KitHit,
  type KitSkill,
  type KitTrigger,
  type OperatorKit,
  type RotationAction,
  type TimelineScenario,
  type TimelineState,
} from "@efsim/engine";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const si = JSON.parse(readFileSync(new URL("../examples/si-jade-vessel.json", import.meta.url), "utf8")) as Build;
const L = "chr_0016_laevat_";
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const END = L + "plunging_attack_end";
const START = L + "plunging_attack_start";
const act = (skill: string, at?: number, operator = op): RotationAction => ({ operator, skill: skill.startsWith("chr_") ? skill : L + skill, ...(at !== undefined ? { at } : {}) });
const dive = (at?: number): RotationAction => act(END, at);
const scenario = (rotation: RotationAction[], extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  team: [build],
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 30 * 20,
  rotation,
  options: { crit: "never" },
  ...extra,
});
const endTiming = data.skills[END]?.timing;
const RISE = 2;
const FALL = 20;

/** Laevatain's kit with extra triggers, stacks a–b and (optionally) a kit entry for her dive's start. */
function withKit(c: { readonly triggers?: readonly KitTrigger[]; readonly start?: Partial<KitSkill> } = {}): GameData {
  const start: KitSkill[] = c.start ? [{ skillId: START, label: "Dive: fall", kind: "basic", hits: [], ...c.start }] : [];
  return {
    ...data,
    kits: {
      ...data.kits,
      operators: {
        ...data.kits.operators,
        [op]: { ...kit, stacks: [...kit.stacks, { id: "a", label: "a", max: 99 }, { id: "b", label: "b", max: 99 }], triggers: [...kit.triggers, ...(c.triggers ?? [])], skills: [...kit.skills, ...start] },
      },
    },
  };
}
const run = (g: GameData, sc: TimelineScenario): TimelineState => {
  const ctx = createContext(g, sc);
  let s = init(ctx);
  for (const a of sc.rotation) s = apply(ctx, s, a);
  return advance(ctx, s, sc.durationFrames);
};
const castsOf = (s: TimelineState) => s.casts.map((c) => [c.skill.replace(L, ""), c.frame]);

describe("dive timing from the native movement settings", () => {
  it("the plunge starts 2 frames after the jump (0.6 m up at 30 FPS) and lands 20 later (0.633 s hover, 1 frame down)", () => {
    expect(diveFrames()).toEqual({ rise: RISE, fall: FALL });
    // Higher before the plunge may start: more frames up, and more down (60 m/s: 2 m a frame, 1 m in the first).
    expect(diveFrames({ ...DIVE_MOTION, minHeight: 2 })).toEqual({ rise: 8, fall: 19 + 2 });
    // A hover of exactly 19 frames' time still takes 19.
    expect(diveFrames({ ...DIVE_MOTION, startSeconds: 19 / 30 }).fall).toBe(20);
    expect(() => diveFrames({ ...DIVE_MOTION, minHeight: 3 })).toThrow(/reachable/);
  });

  it("the data pairs each operator's dive: the landing from its skill group, the fall from its file, in the same group", () => {
    expect(data.operators[op]?.dive).toEqual({ start: START, end: END });
    expect(data.operators[op]?.skillGroups[START]).toBe("basic");
    // The fall has no SkillPatchTable row: its file's values at every level.
    const s = data.skills[START];
    expect(s?.levels.length).toBe(data.skills[END]?.levels.length);
    expect(s?.levels.every((l) => Object.keys(l.blackboard).length === 0)).toBe(true);
    expect(s?.defaults["atk_scale"]).toBe(0.25);
    expect(s?.timing?.specification).toBe(6);
    // Every operator with a kit has one.
    for (const id of Object.keys(data.kits.operators)) expect(data.operators[id]?.dive?.end, id).toMatch(/_plunging_attack_end$/);
  });
});

describe("a dive in a rotation", () => {
  it("is a jump, then the landing 22 frames later; its hit is a dive's (decorations: dive)", () => {
    const g = withKit({ triggers: [{ id: "dove", on: { event: "hit", decorations: ["dive"] }, by: "self", do: [{ kind: "gain", gains: [{ stack: "a", amount: 1 }] }] }] });
    const s = run(g, scenario([dive()]));
    expect(castsOf(s)).toEqual([[JUMP, 0], ["plunging_attack_end", RISE + FALL]]);
    const hit = s.hits.find((h) => h.skillId === END);
    expect(hit?.frame).toBe(RISE + FALL + (kit.skills.find((x) => x.skillId === END)?.hits[0]?.frames?.[0] ?? NaN));
    expect(s.stacks[op]?.a).toBe(1);
    // A basic attack is no dive.
    expect(run(g, scenario([act("attack1")])).stacks[op]?.a ?? 0).toBe(0);
  });

  it("with the fall in the kit: the fall's own hits after the jump, then the landing", () => {
    const landing = kit.skills.find((x) => x.skillId === END)?.hits[0] as KitHit;
    const g = withKit({ start: { hits: [{ ...landing, id: "fall", frames: [3], dive: false }] } });
    const s = run(g, scenario([dive()]));
    expect(castsOf(s)).toEqual([[JUMP, 0], ["plunging_attack_start", RISE], ["plunging_attack_end", RISE + FALL]]);
    expect(s.hits.find((h) => h.skillId === START)?.frame).toBe(RISE + 3);
    // Its value is the file's atk_scale (0.25), the landing's the level table's.
    const land = s.hits.find((h) => h.skillId === END);
    const fall = s.hits.find((h) => h.skillId === START);
    expect(land && fall ? fall.exact / land.exact : NaN).toBeCloseTo(0.25 / (data.skills[END]?.levels[build.skillLevels.basic - 1]?.blackboard["atk_scale"] ?? NaN), 6);
  });

  it("the jump interrupts the current skill (a plunging attack may), after its own hits unless timed", () => {
    const after = run(data, scenario([act("attack1"), dive()]));
    const a1 = after.hits.find((h) => h.skillId === L + "attack1");
    const jump = after.casts.find((c) => c.skill === JUMP);
    expect(jump?.frame).toBe(a1?.frame);
    // At frame 1, before attack1's hit: the hit is cancelled.
    const cut = run(data, scenario([act("attack1"), dive(1)]));
    expect(cut.casts.find((c) => c.skill === JUMP)?.frame).toBe(1);
    expect(cut.hits.some((h) => h.skillId === L + "attack1")).toBe(false);
  });

  it("in the air the operator starts nothing; after the landing its skills wait as for any plunging skill", () => {
    const g = withKit({ start: { hits: [] } });
    const ctx = createContext(g, scenario([]));
    const s = apply(ctx, init(ctx), dive());
    const land = RISE + FALL;
    // Even timed mid-air, a battle skill waits for the landing's exclusive frames (nothing outranks a plunging skill).
    expect(earliestStart(ctx, s, act("normal_skill", 5))).toEqual({ frame: land + (endTiming?.exclusiveFrames ?? NaN) });
    // So does another dive: the jump, from the landing's exclusive frames.
    expect(earliestStart(ctx, s, dive(5))).toEqual({ frame: land + (endTiming?.exclusiveFrames ?? NaN) });
    expect(castsOf(run(g, scenario([dive(), dive()]))).filter(([k]) => k === JUMP).map(([, f]) => f)).toEqual([0, land + (endTiming?.exclusiveFrames ?? NaN)]);
  });

  it("only the controlled operator dives; a rotation names the landing, not the fall", () => {
    const ctx = createContext(withKit({ start: { hits: [] } }), scenario([], { team: [build, si] }));
    const s0 = init(ctx);
    expect(earliestStart(ctx, s0, act(START))).toEqual({ error: expect.stringMatching(/dive's fall/) });
    expect(earliestStart(ctx, s0, act("chr_0036_jsspsi_plunging_attack_end", undefined, si.operator))).toEqual({ error: expect.stringMatching(/controlled/) });
    const swapped = apply(ctx, s0, { operator: si.operator, skill: "swap" });
    expect(earliestStart(ctx, swapped, act("chr_0036_jsspsi_plunging_attack_end", undefined, si.operator))).toEqual({ frame: 0 });
  });

  it("a swap in the air doesn't stop the dive (assumed): it lands", () => {
    const s = run(data, scenario([dive(), { operator: si.operator, skill: "swap", at: 5 }], { team: [build, si] }));
    expect(s.controlled).toBe(si.operator);
    expect(s.hits.some((h) => h.skillId === END)).toBe(true);
  });

  it("no dodge in the air (assumed); on the ground after the landing, as ever", () => {
    const sc = (at: number) => scenario([dive()], { enemyActions: [{ kind: "attack", at: [at] }], options: { crit: "never", dodge: { chance: 1 } } });
    const air = run(data, sc(10));
    expect(air.casts.some((c) => c.skill === "dodge")).toBe(false);
    expect(air.hits.some((h) => h.skillId === END)).toBe(true);
    expect(run(data, sc(RISE + FALL + 5)).casts.some((c) => c.skill === "dodge")).toBe(true);
  });

  it("the hand-written examples' totals don't change (no dives in them)", () => {
    const example = JSON.parse(readFileSync(new URL("../examples/laevatain-solo.scenario.json", import.meta.url), "utf8")) as { rotation: RotationAction[] };
    expect(example.rotation.some((a) => a.skill.includes("plunging"))).toBe(false);
    // A rotation without dives casts no jump.
    expect(simulate(data, scenario([act("attack1"), act("attack2")])).casts.some((c) => c.skill === JUMP)).toBe(false);
  });
});

describe("search and dives", () => {
  it("the controlled operator's dive is a choice; another's isn't", () => {
    const ctx = createContext(data, scenario([], { team: [build, si] }));
    const choices = legalActions(ctx, init(ctx)).map((c) => c.action.skill);
    expect(choices).toContain(END);
    expect(choices).not.toContain("chr_0036_jsspsi_plunging_attack_end");
  });

  it("a found rotation may dive, and replays to the same total", () => {
    // In a 1 s fight a dive (Laevatain's lands 1.8 × ATK at frame 23) beats anything else.
    const sc = scenario([], { durationFrames: 30 });
    const r = searchRotation(data, sc, { beamWidth: 4 });
    expect(r.rotation.map((a) => a.skill)).toEqual([END]);
    expect(simulate(data, { ...sc, rotation: r.rotation }).total).toBeCloseTo(r.result.total, 6);
  });

  it("the search dives only from outside a basic-attack chain, and doesn't cancel a skill with the jump", () => {
    const ctx = createContext(data, scenario([]));
    const s = apply(ctx, init(ctx), act("attack1"));
    // attack1's chain points at attack2: no dive among the choices.
    expect(legalActions(ctx, s).map((c) => c.action.skill)).not.toContain(END);
    // After a battle skill (no chain), the dive is a choice from the skill's exclusive frame on, though the timeline lets the jump come sooner.
    const b = apply(ctx, init(ctx), act("normal_skill"));
    const timed = earliestStart(ctx, b, dive());
    const choice = legalActions(ctx, b).find((c) => c.action.skill === END);
    const cast = b.casts.at(-1)?.frame ?? NaN;
    expect(choice?.frame).toBeGreaterThanOrEqual(cast + Math.min(data.skills[L + "normal_skill"]?.timing?.exclusiveFrames ?? NaN, ...(data.skills[L + "normal_skill"]?.timing?.interruptibleFrom ?? [])));
    expect("frame" in timed ? timed.frame : NaN).toBeLessThanOrEqual(choice?.frame ?? NaN);
  });
});
