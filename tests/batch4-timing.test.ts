// Engine timing after batch 4's kits (docs/kit-abstractions.md, "Review after
// batch 4's kits", item 2 "Timing"): a ticking buff's tick on its end frame,
// delayed trigger actions after a frame's hits (`afterHits`), a buff
// modifier's `if` judged after the hit's own beforeDamage buffs, buffs that
// end at a skill frame (`untilFrame`), and windows that list a button skill
// opening for the skill the button casts. Each shown with a small hand-made
// change to Laevatain's kit.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  advance, apply, createContext, init,
  type Build, type GameData, type KitBuff, type KitHit, type KitSkill, type KitTrigger, type LandedHit, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState,
} from "@efsim/engine";
import { loadGameData, readSkillFile } from "@efsim/data";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const L = "chr_0016_laevat_";
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const act = (skill: string, at?: number): RotationAction => ({ operator: op, skill: L + skill, ...(at !== undefined ? { at } : {}) });
const counters = ["a", "b"].map((id) => ({ id, label: id, max: 999 }));
const scenario = (rotation: RotationAction[]): TimelineScenario => ({
  team: [build],
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 30 * 60,
  rotation,
  options: { crit: "never" },
});
/** Laevatain's kit with counting stacks a and b, extra buffs and triggers, and some skills' hits changed. */
const withKit = (k: { buffs?: KitBuff[]; triggers?: KitTrigger[]; hits?: Record<string, (h: KitHit) => KitHit> }): GameData => ({
  ...data,
  kits: {
    ...data.kits,
    operators: {
      ...data.kits.operators,
      [op]: {
        ...kit,
        stacks: [...kit.stacks, ...counters],
        buffs: [...kit.buffs, ...(k.buffs ?? [])],
        triggers: [...kit.triggers, ...(k.triggers ?? [])],
        skills: kit.skills.map((s): KitSkill => {
          const f = k.hits?.[s.skillId.replace(L, "")];
          return f ? { ...s, hits: s.hits.map(f) } : s;
        }),
      },
    },
  },
});
const run = (g: GameData, rotation: RotationAction[], frames = 30 * 10): TimelineState => {
  const sc = scenario(rotation);
  const ctx = createContext(g, sc);
  let s = init(ctx);
  for (const a of sc.rotation) s = apply(ctx, s, a);
  return advance(ctx, s, frames);
};
const n = (s: TimelineState, stack: string) => s.stacks[op]?.[stack] ?? 0;
const buff = (id: string, modifiers: KitBuff["modifiers"], extra: Partial<KitBuff> = {}): KitBuff => ({ id, label: id, target: "self", duration: 5, modifiers, ...extra });
const count = (id: string, on: KitTrigger["on"], stack: string): KitTrigger => ({ id, on, by: "self", do: [{ kind: "gain", gains: [{ stack, amount: 1 }] }] });
const onCast = (id: string, skill: string, extra: Partial<KitTrigger>, ...actions: KitTrigger["do"]): KitTrigger => ({ id, on: { event: "cast", skills: [L + skill] }, by: "self", ...extra, do: actions });
const hitsOf = (s: TimelineState, skill: string): LandedHit[] => s.hits.filter((h) => h.operator === op && h.skillId === L + skill);
const from = (h: LandedHit | undefined, source: string) => (h?.modifiers ?? []).filter((m) => m.source.endsWith(` ${source}`));
const castFrame = (s: TimelineState, skill: string) => s.casts.find((c) => c.skill === L + skill)?.frame ?? NaN;

describe("a ticking buff ticks on its end frame, then ends", () => {
  const pulse = (tickOnApply: boolean) => buff("pulse", [], { duration: 3, every: 1, ...(tickOnApply ? { tickOnApply: true } : {}) });
  const triggers = [
    onCast("give", "attack1", {}, { kind: "buff", buff: "pulse" }),
    count("tick", { event: "buffTick", buff: "pulse" }, "a"),
    count("end", { event: "buffEnded", buff: "pulse" }, "b"),
  ];

  it("3 s every 1 s from the application: 4 ticks (0, 1, 2, 3 s), the last on the end frame; 3 a second after it", () => {
    expect(n(run(withKit({ buffs: [pulse(true)], triggers }), [act("attack1")]), "a")).toBe(4);
    expect(n(run(withKit({ buffs: [pulse(false)], triggers }), [act("attack1")]), "a")).toBe(3);
  });

  it("it ends once, after that tick: the end frame's tick runs while the buff is still listed, gone at the next frame", () => {
    const g = withKit({ buffs: [pulse(true)], triggers });
    const c = castFrame(run(g, [act("attack1")], 1), "attack1");
    const atEnd = run(g, [act("attack1")], c + 90);
    expect([n(atEnd, "a"), n(atEnd, "b")]).toEqual([4, 1]);
    expect(atEnd.buffs.some((b) => b.id === "pulse")).toBe(false);
    const before = run(g, [act("attack1")], c + 89);
    expect([n(before, "a"), n(before, "b")]).toEqual([3, 0]);
  });
});

describe("afterHits: a delayed action at a hit's frame runs after the hit", () => {
  // attack1's hit lands at frame 6; the delayed buff at 6 acts on it, or (afterHits) only on the next hits.
  const boost = buff("boost", [{ zone: "damageBonus", value: 0.5 }], { duration: 20 });
  const give = (extra: Partial<KitTrigger>) => withKit({ buffs: [boost], triggers: [onCast("give", "attack1", { delay: 6, ...extra }, { kind: "buff", buff: "boost" })] });

  it("by default before the frame's hits; with afterHits after them (and before the next frame's)", () => {
    const plain = run(give({}), [act("attack1"), act("attack2")]);
    expect(from(hitsOf(plain, "attack1")[0], "boost")).toHaveLength(1);
    const late = run(give({ afterHits: true }), [act("attack1"), act("attack2")]);
    expect(hitsOf(late, "attack1")[0]?.frame).toBe(castFrame(late, "attack1") + 6);
    expect(from(hitsOf(late, "attack1")[0], "boost")).toHaveLength(0);
    expect(late.buffs.find((b) => b.id === "boost")?.appliedAt).toBe(castFrame(late, "attack1") + 6);
    expect(from(hitsOf(late, "attack2")[0], "boost")).toHaveLength(1);
  });
});

describe("a buff modifier's `if` is judged after the hit's own beforeDamage buffs", () => {
  // Each layer: +0.1; +0.5 more per layer from 2 layers. attack1's hit adds the 1st layer before its damage, attack2's first the 2nd.
  const lay = buff("lay", [{ zone: "damageBonus", value: 0.1 }, { zone: "damageBonus", value: 0.5, if: { buffLayers: "lay", atLeast: 2 } }], { maxStacks: 3 });
  const g = withKit({ buffs: [lay], hits: { attack1: (h) => ({ ...h, buffs: [{ buff: "lay", beforeDamage: true }] }), attack2: (h) => ({ ...h, buffs: [{ buff: "lay", beforeDamage: true }] }) } });

  it("the hit that adds the 2nd layer has both layers' +0.5 (the modifiers it adds count, and so does their condition)", () => {
    const s = run(g, [act("attack1"), act("attack2")]);
    const values = (h: LandedHit | undefined) => from(h, "lay").map((m) => m.value).sort();
    expect(values(hitsOf(s, "attack1")[0])).toEqual([0.1]);
    expect(values(hitsOf(s, "attack2")[0])).toEqual([0.1, 0.1, 0.5, 0.5]);
  });
});

describe("untilFrame: a buff that ends at a skill frame of the current cast", () => {
  const clip: KitBuff = { id: "clip", label: "clip", target: "self", endsWithCast: true, modifiers: [] };
  const open = buff("open", []);

  it("from a cast trigger: it ends at that frame of the cast", () => {
    const g = withKit({ buffs: [clip], triggers: [onCast("give", "attack1", {}, { kind: "buff", buff: "clip", untilFrame: 10 })] });
    const s = run(g, [act("attack1")], 5);
    const b = s.buffs.find((x) => x.id === "clip");
    expect([(b?.appliedAt ?? NaN) - castFrame(s, "attack1"), (b?.expiresAt ?? NaN) - castFrame(s, "attack1")]).toEqual([0, 10]);
    expect(run(g, [act("attack1")], castFrame(s, "attack1") + 10).buffs.some((x) => x.id === "clip")).toBe(false);
  });

  it("or when the cast ends sooner (the next skill starts); a buff without endsWithCast is tied to the cast too", () => {
    const g = withKit({ buffs: [open], triggers: [onCast("give", "attack1", {}, { kind: "buff", buff: "open", untilFrame: 60 })] });
    const s = run(g, [act("attack1"), act("attack2")], 40);
    expect(s.buffs.some((x) => x.id === "open")).toBe(false);
    // attack2 starts at attack1's exclusive frame (16) or its chain window: before 60.
    expect(castFrame(s, "attack2") - castFrame(s, "attack1")).toBeLessThan(60);
    const alone = run(g, [act("attack1")], 40);
    expect((alone.buffs.find((x) => x.id === "open")?.expiresAt ?? NaN) - castFrame(alone, "attack1")).toBe(60);
  });

  it("on a hit's buffs: from the hit to that frame of its cast; not applied past it", () => {
    const g = withKit({ buffs: [open], hits: { attack1: (h) => ({ ...h, buffs: [{ buff: "open", untilFrame: 12 }] }) } });
    const s = run(g, [act("attack1")], 8);
    const b = s.buffs.find((x) => x.id === "open");
    expect([(b?.appliedAt ?? NaN) - castFrame(s, "attack1"), (b?.expiresAt ?? NaN) - castFrame(s, "attack1")]).toEqual([6, 12]);
    const past = withKit({ buffs: [open], hits: { attack1: (h) => ({ ...h, buffs: [{ buff: "open", untilFrame: 5 }] }) } });
    expect(run(past, [act("attack1")], 8).buffs.some((x) => x.id === "open")).toBe(false);
  });
});

describe("windows that list a button skill open for the skill the button casts (switchToBuffConfig)", () => {
  it("Camille's combo and ultimate windows list normal_skill_2 in the data; loaded, they list combo_skill_2 too", () => {
    const C = "chr_0033_camille_";
    expect(readSkillFile(`${C}normal_skill_2`)?.switchCasts).toEqual([`${C}combo_skill_2`]);
    for (const [skill, from] of [["ultimate_skill", 125], ["combo_skill", 51]] as const) {
      const raw = readSkillFile(C + skill)?.timing.windows.find((w) => w.from === from);
      expect(raw?.skills).toContain(`${C}normal_skill_2`);
      expect(raw?.skills).not.toContain(`${C}combo_skill_2`);
      expect(data.skills[C + skill]?.timing?.windows.find((w) => w.from === from)?.skills).toContain(`${C}combo_skill_2`);
    }
    // A skill without switchToBuffConfig casts nothing instead.
    expect(readSkillFile(`${L}attack1`)?.switchCasts).toEqual([]);
  });
});
