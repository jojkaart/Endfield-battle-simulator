// Batch-4 shared features, group "skills and timing" (docs/kit-batches/batch-4.md, Merged gaps): S1 a combo opening its own
// next sequence, S2 a cooldown set to a fraction, S3 search trying a short timing window, S4 a combo cooldown's recovery
// rate, S5 SP cost from buffs, S6 helpers cast from BuffData, S7 a combo cast without the combo window, S8 chain steps from
// the input mapping and buffs that map the basic attack, S9 conditional and jumped windows, S11 several MarkCanInterrupt,
// S12 noDodge. Each shown with a small hand-made change to Laevatain's kit or timings.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";
import { advance, apply, createContext, earliestStart, init, legalActions, simulate, SP, type Build, type GameData, type KitBuff, type KitSkill, type KitTrigger, type OperatorKit, type RotationAction, type SkillTiming, type SkillType, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { castHelpers, loadGameData, withGameBuff } from "@efsim/data";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const L = "chr_0016_laevat_";
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const act = (skill: string, at?: number): RotationAction => ({ operator: op, skill: skill.startsWith("chr_") ? skill : L + skill, ...(at !== undefined ? { at } : {}) });
const scenario = (rotation: RotationAction[], extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  team: [build],
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 30 * 60,
  rotation,
  options: { crit: "never" },
  ...extra,
});
const timing = (id: string) => data.skills[L + id]?.timing as SkillTiming;
const kitSkill = (id: string) => kit.skills.find((s) => s.skillId === L + id) as KitSkill;

interface Change {
  readonly buffs?: readonly KitBuff[];
  readonly triggers?: readonly KitTrigger[];
  /** Kit triggers to leave out (by ID). */
  readonly drop?: readonly string[];
  /** Changes to kit skills (by ID without the operator prefix). */
  readonly skills?: Readonly<Record<string, Partial<KitSkill>>>;
  /** New kit skills: copies of a skill's data and kit entry under a new ID and level group. */
  readonly copies?: Readonly<Record<string, { readonly of: string; readonly group: SkillType; readonly kit?: Partial<KitSkill> }>>;
  /** Timing changes (by skill ID without the prefix). */
  readonly timings?: Readonly<Record<string, Partial<SkillTiming>>>;
}

/** Laevatain's data with a kit change: counting stacks a–e, extra buffs and triggers, skill and timing edits, copied skills. */
function withKit(c: Change): GameData {
  const laev = data.operators[op] as GameData["operators"][string];
  const skills: Record<string, GameData["skills"][string]> = { ...data.skills };
  for (const [id, t] of Object.entries(c.timings ?? {})) skills[L + id] = { ...(data.skills[L + id] as GameData["skills"][string]), timing: { ...timing(id), ...t } };
  const groups: Record<string, SkillType> = { ...laev.skillGroups };
  const extra: KitSkill[] = [];
  for (const [id, x] of Object.entries(c.copies ?? {})) {
    skills[L + id] = { ...(skills[L + x.of] as GameData["skills"][string]), id: L + id };
    groups[L + id] = x.group;
    extra.push({ ...kitSkill(x.of), skillId: L + id, label: id, ...x.kit });
  }
  return {
    ...data,
    skills,
    operators: { ...data.operators, [op]: { ...laev, skillGroups: groups } },
    kits: {
      ...data.kits,
      operators: {
        ...data.kits.operators,
        [op]: {
          ...kit,
          stacks: [...kit.stacks, ...["a", "b", "c", "d", "e"].map((id) => ({ id, label: id, max: 999 }))],
          buffs: [...kit.buffs, ...(c.buffs ?? [])],
          triggers: [...kit.triggers.filter((t) => !c.drop?.includes(t.id)), ...(c.triggers ?? [])],
          skills: [...kit.skills.map((s) => ({ ...s, ...c.skills?.[s.skillId.slice(L.length)] })), ...extra],
        },
      },
    },
  };
}

const self = (id: string, seconds?: number, extra: Partial<KitBuff> = {}): KitBuff => ({ id, label: id, target: "self", ...(seconds !== undefined ? { duration: seconds } : {}), modifiers: [], ...extra });
const onCast = (id: string, skill: string, d: KitTrigger["do"], extra: Partial<KitTrigger> = {}): KitTrigger => ({ id, on: { event: "cast", skills: [L + skill] }, by: "self", ...extra, do: d });
const count = (id: string, on: KitTrigger["on"], stack: string): KitTrigger => ({ id, on, by: "self", do: [{ kind: "gain", gains: [{ stack, amount: 1 }] }] });
/** A general combo window on each attack1 cast (instead of her Combustion / Corrosion trigger). */
const openOnAttack1 = onCast("open1", "attack1", [{ kind: "openCombo" }]);
const states = (g: GameData, sc: TimelineScenario) => {
  const ctx = createContext(g, sc);
  let s = init(ctx);
  const after: TimelineState[] = [];
  for (const a of sc.rotation) after.push((s = apply(ctx, s, a)));
  return { ctx, s, after };
};
const castAt = (s: TimelineState, skill: string) => s.casts.find((c) => c.skill === L + skill)?.frame ?? NaN;
const COMBO_CD = 270;

describe("S1: a combo opening its own next sequence (openCombo skills, whileBuff, seconds)", () => {
  // combo_skill_2: a second combo with combo_skill's data; combo_skill opens its window 37 frames in, while seq2 lasts.
  const sequence = (seconds: number, extra: Change = {}): GameData =>
    withKit({
      ...extra,
      drop: ["combo_window"],
      copies: { combo_skill_2: { of: "combo_skill", group: "combo" }, ...extra.copies },
      buffs: [self("seq2", seconds), ...(extra.buffs ?? [])],
      triggers: [openOnAttack1, onCast("seq", "combo_skill", [{ kind: "openCombo", skills: [L + "combo_skill_2"], whileBuff: "seq2" }, { kind: "buff", buff: "seq2" }], { delay: 37 }), ...(extra.triggers ?? [])],
    });
  const rotation = [act("attack1"), act("combo_skill"), act("combo_skill_2")];

  it("the owner's own combo opens a window of its own for the named skill, which a recorded step waits for", () => {
    const { s } = states(sequence(6), scenario(rotation));
    const c = castAt(s, "combo_skill");
    expect(castAt(s, "combo_skill_2")).toBeGreaterThanOrEqual(c + 37);
    // The named skill doesn't use the operator's window, and its own is used up.
    expect(s.comboWindow[`${op}>${L}combo_skill_2`]).toBeUndefined();
  });

  it("the regular window doesn't serve it, nor does a combo-opened regular window open", () => {
    const g = withKit({ drop: ["combo_window"], copies: { combo_skill_2: { of: "combo_skill", group: "combo" } }, buffs: [self("seq2", 6)], triggers: [openOnAttack1, onCast("seq", "combo_skill", [{ kind: "openCombo" }], { delay: 37 })] });
    expect(() => states(g, scenario(rotation))).toThrow(/combo trigger hasn't happened/);
  });

  it("whileBuff: the window closes when the buff ends; extending the buff extends it; a later instance doesn't reopen it", () => {
    // 0.5 s: the window closes 15 frames after it opens, before combo_skill's lock ends at 57.
    expect(() => states(sequence(0.5), scenario(rotation))).toThrow(/combo trigger hasn't happened/);
    const extended = sequence(0.5, { triggers: [onCast("pause", "combo_skill", [{ kind: "extendBuff", buff: "seq2", seconds: 1 }], { delay: 40 })] });
    expect(castAt(states(extended, scenario(rotation)).s, "combo_skill_2")).toBeGreaterThan(0);
    const again = sequence(0.5, { triggers: [onCast("again", "combo_skill", [{ kind: "buff", buff: "seq2" }], { delay: 55 })] });
    expect(() => states(again, scenario(rotation))).toThrow(/combo trigger hasn't happened/);
  });

  it("seconds: the window's own length", () => {
    const g = (seconds: number) =>
      withKit({ drop: ["combo_window"], copies: { combo_skill_2: { of: "combo_skill", group: "combo" } }, triggers: [openOnAttack1, onCast("seq", "combo_skill", [{ kind: "openCombo", skills: [L + "combo_skill_2"], seconds }], { delay: 37 })] });
    expect(() => states(g(0.5), scenario(rotation))).toThrow(/combo trigger hasn't happened/);
    expect(castAt(states(g(2), scenario(rotation)).s, "combo_skill_2")).toBeGreaterThan(0);
  });

  it("not while every named skill is on cooldown", () => {
    const g = sequence(6, { copies: { combo_skill_2: { of: "combo_skill", group: "combo", kit: { cooldownGroup: "both" } } }, skills: { combo_skill: { cooldownGroup: "both" } } });
    expect(() => states(g, scenario(rotation))).toThrow(/combo trigger hasn't happened/);
  });
});

describe("S2: a cooldown set to a fraction of the full one (setFraction)", () => {
  const g = withKit({ drop: ["combo_window"], triggers: [openOnAttack1, onCast("set", "attack2", [{ kind: "cooldown", who: "self", skills: "combo", setFraction: 0.5 }])] });
  it("starts that fraction of the skill's full cooldown at once, running or not", () => {
    const idle = states(g, scenario([act("attack1"), act("attack2")])).s;
    expect(idle.readyAt[L + "combo_skill"]).toBe(castAt(idle, "attack2") + COMBO_CD / 2);
    const running = states(g, scenario([act("attack1"), act("combo_skill"), act("attack2")])).s;
    expect(running.readyAt[L + "combo_skill"]).toBe(castAt(running, "attack2") + COMBO_CD / 2);
  });
});

describe("S4: a combo cooldown's recovery rate (attribute 93) over time", () => {
  // rate: attribute 93 + 4 (rate 5) for 2 s from attack2's cast; ended early by attack3's. No combo trigger: the combo needs no window.
  const rate = self("rate", 2, { modifiers: [{ attr: 93, value: 4 }] });
  const g = (end: boolean) =>
    withKit({ drop: ["combo_window"], buffs: [rate], triggers: [onCast("fast", "attack2", [{ kind: "buff", buff: "rate" }]), ...(end ? [onCast("stop", "attack3", [{ kind: "endBuff", buff: "rate" }])] : [])] });

  it("runs the remaining cooldown at the rate while the buff is active, keeping the progress made before", () => {
    const { s, after } = states(g(false), scenario([act("attack1"), act("combo_skill"), act("attack2")]));
    const c = castAt(s, "combo_skill");
    const f2 = castAt(s, "attack2");
    expect(after[1]?.readyAt[L + "combo_skill"]).toBe(c + COMBO_CD);
    const left = COMBO_CD - (f2 - c);
    // At 5 frames per frame the rest takes a fifth (within the buff's 60 frames), exactly: ready from the next whole frame.
    expect(left).toBeLessThan(5 * 60);
    expect(s.readyAt[L + "combo_skill"]).toBeCloseTo(f2 + left / 5, 9);
  });

  it("an early end keeps the progress and runs the rest at rate 1; a recorded combo starts then", () => {
    const sc = scenario([act("attack1"), act("combo_skill"), act("attack2"), act("attack3"), act("attack1")]);
    const { ctx, s } = states(g(true), sc);
    const c = castAt(s, "combo_skill");
    const f2 = castAt(s, "attack2");
    const f3 = s.casts.filter((x) => x.skill === L + "attack3")[0]?.frame ?? NaN;
    const ready = f3 + (COMBO_CD - (f2 - c) - 5 * (f3 - f2));
    expect(s.readyAt[L + "combo_skill"]).toBe(ready);
    expect(earliestStart(ctx, s, act("combo_skill"))).toEqual({ frame: Math.max(ready, s.frame) });
  });

  it("the loader takes a game buff's formulaItem 6 as a percentage (Zhuang Fangyi's Empyrean: 1 + 4 × 1 = 5)", () => {
    const b = withGameBuff("t", { id: "x", label: "x", target: "self", gameBuff: "buff_chr_0030_zhuangfy_ult_base", modifiers: [{ attr: 93, value: 4 }] });
    expect(b.modifiers[0]?.percent).toBe(true);
  });
});

describe("S5: SP cost from buffs (attribute 45)", () => {
  const free = (value: number) => withKit({ buffs: [self("free", undefined, { modifiers: [{ attr: 45, value }] })], triggers: [onCast("give", "attack1", [{ kind: "buff", buff: "free" }]), onCast("use", "normal_skill", [{ kind: "endBuff", buff: "free" }])] });
  const rotation = [act("attack1"), act("normal_skill"), act("normal_skill"), act("normal_skill")];

  it("the cast costs its cost plus the buffs' attribute 45, at least 0, and spends only that (no team energy for what it didn't spend)", () => {
    const plain = simulate(free(0), scenario(rotation));
    const freed = simulate(free(-100), scenario(rotation));
    const [p1, f1] = [plain.casts[1], freed.casts[1]];
    expect(f1?.frame).toBe(p1?.frame);
    expect((f1?.spAfter ?? 0) - (p1?.spAfter ?? 0)).toBeCloseTo(100, 6);
    // Team energy comes for the natural SP spent (at frame 22 of each cast): 200 SP against 300.
    const energy = (g: GameData) => {
      const { ctx, s } = states(g, scenario(rotation));
      return advance(ctx, s, s.frame + 60).energy[op] ?? 0;
    };
    expect(energy(free(-100)) / energy(free(0))).toBeCloseTo(2 / 3, 6);
    // Below 0 it's free, not a gain.
    expect(simulate(free(-150), scenario(rotation)).casts[1]?.spAfter).toBeCloseTo(f1?.spAfter ?? NaN, 6);
  });

  it("the action gate waits for the cost as it is at the start: the third cast doesn't wait for SP", () => {
    const plain = simulate(free(0), scenario(rotation));
    const freed = simulate(free(-100), scenario(rotation));
    expect((plain.casts[3]?.frame ?? 0) - (freed.casts[3]?.frame ?? 0)).toBeGreaterThan(Math.floor((100 * 30) / SP.perSecond) - 60);
  });
});

describe("S6: helpers cast from the operator's BuffData (castHelpers)", () => {
  it("Zhuang Fangyi's ultimate_skill_end, cast when her Empyrean state ends, is in the ultimate group with its timing", () => {
    expect(castHelpers({ chr_0030_zhuangfy_ultimate_skill: "ultimate" }).get("chr_0030_zhuangfy_ultimate_skill_end")).toBe("chr_0030_zhuangfy_ultimate_skill");
    expect(data.operators["chr_0030_zhuangfy"]?.skillGroups["chr_0030_zhuangfy_ultimate_skill_end"]).toBe("ultimate");
    expect(data.skills["chr_0030_zhuangfy_ultimate_skill_end"]?.timing?.exclusiveFrames).toBe(20);
  });
});

describe("S7: a combo-kind skill cast without the combo window (comboWindow: false)", () => {
  const g = withKit({
    drop: ["combo_window"],
    copies: { combo_skill_2: { of: "combo_skill", group: "combo", kit: { comboWindow: false } } },
    triggers: [openOnAttack1, onCast("linked", "attack1", [{ kind: "link" }]), count("combos", { event: "cast", kinds: ["combo"], followUp: false }, "a")],
  });

  it("is castable without a window, as a combo cast by the player, and leaves the window, Link and the regular combo's cooldown alone", () => {
    expect(castAt(states(g, scenario([act("combo_skill_2")])).s, "combo_skill_2")).toBe(0);
    const { s } = states(g, scenario([act("attack1"), act("combo_skill_2")]));
    expect(s.stacks[op]?.a).toBe(1);
    expect(s.comboWindow[op]).toBeDefined();
    expect(s.link.length).toBe(1);
    expect(s.readyAt[L + "combo_skill"]).toBeUndefined();
    expect(s.readyAt[L + "combo_skill_2"]).toBe(castAt(s, "combo_skill_2") + COMBO_CD);
  });

  it("an openCombo doesn't look at its cooldown: the regular combo on cooldown keeps the window shut", () => {
    const { s } = states(g, scenario([act("attack1"), act("combo_skill"), act("attack1")]));
    expect(s.comboWindow[op]).toBeUndefined();
  });
});

describe("S8: chain steps from the input mapping; buffs that map the basic attack", () => {
  it("the loader reads ComboCacheAction mappings: Yvonne's attack1 maps attack2 though a window lists attack5", () => {
    const t = data.skills["chr_0017_yvonne_attack1"]?.timing;
    expect(t?.inputMap).toEqual(["chr_0017_yvonne_attack2"]);
    expect(t?.windows.some((w) => w.skills.includes("chr_0017_yvonne_attack5"))).toBe(true);
  });

  it("a window listing a step the input map doesn't map makes no chain step", () => {
    const windows = [...timing("attack1").windows, { from: 0, to: 33, skills: [L + "attack5"] }];
    const mapped = states(withKit({ timings: { attack1: { windows } } }), scenario([act("attack1")])).s;
    expect(mapped.chainNext[op]?.skill).toBe(L + "attack2");
    expect(mapped.chainNext[op]?.alternatives).toBeUndefined();
    const unmapped = states(withKit({ timings: { attack1: { windows, inputMap: [L + "attack2", L + "attack5"] } } }), scenario([act("attack1")])).s;
    expect(unmapped.chainNext[op]?.alternatives?.map((c) => c.skill)).toEqual([L + "attack5"]);
  });

  it("while a buff maps the input, only its skill starts, as a chain head; the others don't", () => {
    const g = withKit({ buffs: [self("fs", 2, { basicAttack: L + "attack5" })], triggers: [onCast("map", "attack1", [{ kind: "buff", buff: "fs" }])] });
    const { ctx, s } = states(g, scenario([act("attack1")]));
    expect(earliestStart(ctx, s, act("attack2"))).toHaveProperty("error");
    expect(earliestStart(ctx, s, act("attack1"))).toHaveProperty("error");
    // attack5 isn't where the chain points: it starts once attack1's exclusive frames are over (attack2's window doesn't defer it).
    expect(earliestStart(ctx, s, act("attack5"))).toEqual({ frame: castAt(s, "attack1") + timing("attack1").exclusiveFrames });
    expect(legalActions(ctx, s).some((c) => c.action.skill === L + "attack5")).toBe(true);
    // After the buff, the chain is as before.
    const later = advance(ctx, s, 90);
    expect(earliestStart(ctx, later, act("attack5"))).toHaveProperty("error");
    expect(earliestStart(ctx, later, act("attack1"))).not.toHaveProperty("error");
  });

  it("the loader takes the mapping from the game buff's buffEvent 5 (Yvonne's talent-1 buff → attack5) and checks a written one", () => {
    const b = { id: "x", label: "x", target: "self" as const, modifiers: [], gameBuff: "buff_chr_0017_yvonne_talent_1_valid" };
    expect(withGameBuff("t", b).basicAttack).toBe("chr_0017_yvonne_attack5");
    expect(() => withGameBuff("t", { ...b, basicAttack: "chr_0017_yvonne_attack1" })).toThrow(/maps the basic-attack input/);
  });
});

describe("S9: conditional windows; windows a jump skipped stay closed", () => {
  // normal_skill with its own jumps gone: exclusive to 117, one window for itself.
  const second = (g: GameData, w: SkillTiming["windows"], extra: Partial<SkillTiming> = {}, pre: RotationAction[] = []) => {
    const g2 = { ...g, skills: { ...g.skills, [L + "normal_skill"]: { ...(g.skills[L + "normal_skill"] as GameData["skills"][string]), timing: { ...timing("normal_skill"), jumps: [], windows: w, ...extra } } } };
    const { ctx, s } = states(g2, scenario([...pre, act("normal_skill")]));
    const c = castAt(s, "normal_skill");
    const r = earliestStart(ctx, s, act("normal_skill", c + 1));
    return ("frame" in r ? r.frame : NaN) - c;
  };
  const conditional = [{ from: 40, to: 60, skills: [L + "normal_skill"], conditional: true }];

  it("the loader marks a window under a TogglableAction or an IfElse branch (Yvonne's attack4 → attack5 at 0–24)", () => {
    const w = data.skills["chr_0017_yvonne_attack4"]?.timing?.windows ?? [];
    expect(w.find((x) => x.from === 0)?.conditional).toBe(true);
    expect(w.find((x) => x.from === 24)?.conditional).toBeUndefined();
  });

  it("a conditional window is open only when the kit lists it and its `if` held at the cast", () => {
    const listed = (p?: KitSkill["windows"]) => withKit({ buffs: [self("x", 10)], triggers: [onCast("x", "attack1", [{ kind: "buff", buff: "x" }])], skills: { normal_skill: { ...(p ? { windows: p } : {}) } } });
    expect(second(listed(), conditional)).toBe(117);
    expect(second(listed([{ from: 40, if: { buffActive: "x" } }]), conditional)).toBe(117);
    expect(second(listed([{ from: 40, if: { buffActive: "x" } }]), conditional, {}, [act("attack1")])).toBe(40);
    expect(second(listed([{ from: 40 }]), conditional)).toBe(40);
  });

  it("a window wholly inside a jumped segment stays closed; one straddling the jump's target opens there", () => {
    const jump = { jumps: [{ at: 10, to: 60, conditional: false }] };
    // Closed: the lock ends at skill frame 117, 50 frames sooner for the jump.
    expect(second(data, [{ from: 20, to: 40, skills: [L + "normal_skill"] }], jump)).toBe(117 - 50);
    expect(second(data, [{ from: 50, to: 80, skills: [L + "normal_skill"] }], jump)).toBe(10);
  });

  it("Typhoeus's kit lists his conditional windows open (his chain as before)", () => {
    const t = data.kits.operators["chr_0034_typhoea"]?.skills.find((s) => s.skillId === "chr_0034_typhoea_floating_attack1");
    expect(t?.windows?.map((w) => w.from)).toEqual([18, 63, 93, 123, 153]);
  });
});

describe("S11: several MarkCanInterrupt on one timeline", () => {
  it("the loader keeps them all (Pogranichnik's combo: one per path)", () => {
    expect(data.skills["chr_0029_pograni_combo_skill"]?.timing?.interruptibleFrom).toEqual([80, 280, 450]);
  });

  it("the gate uses the first one no taken jump skipped", () => {
    const g = (marks: number[]) => ({ ...data, skills: { ...data.skills, [L + "normal_skill"]: { ...(data.skills[L + "normal_skill"] as GameData["skills"][string]), timing: { ...timing("normal_skill"), jumps: [{ at: 10, to: 60, conditional: false }], windows: [], interruptibleFrom: marks } } } });
    const next = (marks: number[]) => {
      const { ctx, s } = states(g(marks), scenario([act("normal_skill")]));
      const r = earliestStart(ctx, s, act("normal_skill", 1));
      return "frame" in r ? r.frame : NaN;
    };
    // 20 is skipped (10 → 60): 70 is played at real frame 20. With only the skipped one, the lock's end (117 − 50).
    expect(next([20, 70])).toBe(20);
    expect(next([20])).toBe(67);
  });
});

describe("S12: no dodge in a skill's guard frames (noDodge)", () => {
  const g = (noDodge?: readonly [number, number]) => withKit({ skills: { normal_skill: noDodge ? { noDodge } : {} }, triggers: [count("hit", { event: "attacked" }, "a"), count("dodged", { event: "perfectDodge" }, "b")] });
  // The empowered battle skill (its jump 30 → 80 taken): an attack at 20, on the playhead's frame 20; its extra hit lands at 54.
  const sc = scenario([act("normal_skill")], { startStacks: { [op]: { melting_flame: 4 } }, enemyActions: [{ kind: "attack", at: [20] }], options: { crit: "never", dodge: { chance: 1 } } });
  const run = (noDodge?: readonly [number, number]) => {
    const { ctx, s } = states(g(noDodge), sc);
    return advance(ctx, s, 200);
  };

  it("an attack in the range lands (its triggers fire) and the skill goes on; outside it, the dash", () => {
    const guarded = run([0, 25]);
    expect(guarded.stacks[op]).toMatchObject({ a: 1 });
    expect(guarded.stacks[op]?.b ?? 0).toBe(0);
    expect(guarded.hits.some((h) => h.hitId === "empowered_extra")).toBe(true);
    for (const outside of [undefined, [0, 20] as const]) {
      const s = run(outside);
      expect(s.stacks[op]?.b).toBe(1);
      expect(s.hits.some((h) => h.hitId === "empowered_extra")).toBe(false);
    }
  });
});

describe("S3: search tries a short timing window too", () => {
  // ring: 12 frames from attack1's frame 40; the battle skill's jump at 30 is taken unless the ring is on.
  const g = withKit({
    buffs: [self("ring", 0.4)],
    triggers: [onCast("ring", "attack1", [{ kind: "buff", buff: "ring" }], { delay: 40 })],
    skills: { normal_skill: { jumps: [{ at: 30, if: { not: { buffActive: "ring" } } }] } },
  });

  it("offers the step at its earliest frame and at the ring's start, which play differently", () => {
    const { ctx, s } = states(g, scenario([act("attack1")]));
    const a1 = castAt(s, "attack1");
    const first = earliestStart(ctx, s, act("normal_skill"));
    const frames = legalActions(ctx, s).filter((c) => c.action.skill === L + "normal_skill").map((c) => c.frame);
    expect(frames).toEqual(["frame" in first ? first.frame : NaN, a1 + 40]);
    const skips = (at: number) => apply(ctx, s, act("normal_skill", at)).scheduled.some((j) => j.kind === "jump" && j.from === 30);
    expect(skips(frames[0] as number)).toBe(true);
    expect(skips(a1 + 40)).toBe(false);
  });

  it("nothing extra when no pending trigger applies what the step reads", () => {
    const { ctx, s } = states(withKit({ skills: { normal_skill: { jumps: [{ at: 30, if: { not: { buffActive: "pause_ult" } } }] } } }), scenario([act("attack1")]));
    expect(legalActions(ctx, s).filter((c) => c.action.skill === L + "normal_skill").length).toBe(1);
  });
});

describe("kit schema: the batch-4 skills and timing fields", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(JSON.parse(readFileSync(new URL("../schemas/kit.schema.json", import.meta.url), "utf8")) as object);
  const validate = ajv.getSchema("https://github.com/jojkaart/Endfield-battle-simulator/schemas/kit.schema.json");
  const kitWith = (skill: object, triggers: object[] = [], buffs: object[] = []) => ({ operator: "x", sources: ["test"], buffs, triggers, skills: [{ skillId: "s", label: "s", damageType: "combo", hits: [], ...skill }] });

  it("accepts openCombo skills / seconds / whileBuff, setFraction, windows, comboWindow false, noDodge and basicAttack", () => {
    const triggers = [
      { id: "t1", on: { event: "cast", skills: ["s"] }, by: "self", delay: 37, do: [{ kind: "openCombo", skills: ["s2"], whileBuff: "b", seconds: 6 }, { kind: "cooldown", who: "self", skills: "combo", setFraction: 1 }] },
    ];
    const ok = kitWith({ windows: [{ from: 0, if: { buffActive: "b" } }, { from: 24, skills: ["s2"] }], comboWindow: false, noDodge: [0, 38] }, triggers, [{ id: "b", label: "b", target: "self", modifiers: [], basicAttack: "s3" }]);
    expect(validate?.(ok), JSON.stringify(validate?.errors)).toBe(true);
    expect(validate?.(kitWith({ comboWindow: true }))).toBe(false);
    expect(validate?.(kitWith({ noDodge: [3] }))).toBe(false);
  });
});
