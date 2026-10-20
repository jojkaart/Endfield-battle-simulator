// Batch-4 shared features, triggers and conditions (docs/kit-batches/batch-4.md,
// "Merged gaps"): T1 buff-category triggers by element, recipient and
// receiving side (and the game's tags), T2 heals the owner receives, T3
// crit-triggered effects as random outcomes, C1 castLink, C2 operatorBuff,
// C3 decoration filters on buff modifiers and Stagger efficiency from buffs,
// C4 currentAction and beside casts, E1 enemySuperArmor, E2 enemyRank. Each
// shown with a small hand-made change to Laevatain's kit (and a teammate's).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  advance, apply, buffReach, computeStats, createContext, critTriggers, eventMatches, evalContext, FPS, init, randomOutcomes, searchCritMode, searchRotation, test as judge,
  type BattleEvent, type Build, type GameData, type KitBuff, type KitHit, type KitSkill, type KitTrigger, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState,
} from "@efsim/engine";
import { buffTagFilter, loadGameData, triggerOn, withCategories } from "@efsim/data";
import { formatSimulation } from "../packages/cli/src/simulate.ts";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const mate = JSON.parse(readFileSync(new URL("../examples/endministrator-p5.json", import.meta.url), "utf8")) as Build;
const L = "chr_0016_laevat_";
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const mateKit = data.kits.operators[mate.operator] as OperatorKit;
const ARTS = ["fire", "pulse", "cryst", "natural"] as const;
const act = (skill: string, at?: number): RotationAction => ({ operator: op, skill: L + skill, ...(at !== undefined ? { at } : {}) });
const chain = ["attack1", "attack2", "attack3", "attack4", "attack5"].map((s) => act(s));
const counters = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id, label: id, max: 999 }));
const scenario = (rotation: RotationAction[], extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  team: [build],
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 30 * 60,
  rotation,
  options: { crit: "never" },
  ...extra,
});
/** Laevatain's kit (and optionally the Endministrator's) with counting stacks a–g and extra buffs, triggers and skills. */
const withKit = (k: { buffs?: KitBuff[]; triggers?: KitTrigger[]; skills?: KitSkill[] }, m: { triggers?: KitTrigger[] } = {}): GameData => ({
  ...data,
  kits: {
    ...data.kits,
    operators: {
      ...data.kits.operators,
      [op]: { ...kit, stacks: [...kit.stacks, ...counters], buffs: [...kit.buffs, ...(k.buffs ?? [])], triggers: [...kit.triggers, ...(k.triggers ?? [])], skills: k.skills ?? kit.skills },
      [mate.operator]: { ...mateKit, stacks: [...mateKit.stacks, ...counters], triggers: [...mateKit.triggers, ...(m.triggers ?? [])] },
    },
  },
});
const count = (id: string, on: KitTrigger["on"], stack: string, by: KitTrigger["by"] = "self", extra: Partial<KitTrigger> = {}): KitTrigger => ({ id, on, by, ...extra, do: [{ kind: "gain", gains: [{ stack, amount: 1 }] }] });
const onCast = (id: string, skill: string, ...buffs: string[]): KitTrigger => ({ id, on: { event: "cast", skills: [L + skill] }, by: "self", do: buffs.map((buff) => ({ kind: "buff" as const, buff })) });
const run = (g: GameData, sc: TimelineScenario, frames = 30 * 10): TimelineState => {
  const ctx = createContext(g, sc);
  let s = init(ctx);
  for (const a of sc.rotation) s = apply(ctx, s, a);
  return advance(ctx, s, frames);
};
const n = (s: TimelineState, stack: string, operator = op) => s.stacks[operator]?.[stack] ?? 0;
const buff = (id: string, target: KitBuff["target"], modifiers: KitBuff["modifiers"], extra: Partial<KitBuff> = {}): KitBuff => ({ id, label: id, target, duration: 20, modifiers, ...extra });
const attack1Hit = (kit.skills.find((s) => s.skillId === L + "attack1") as KitSkill).hits[0] as KitHit;

describe("T1: buff-category triggers by element, recipient and receiving side", () => {
  const buffs = [
    buff("sPhys", "enemy", [{ zone: "susceptibility", value: 0.1, elements: ["physical"] }]),
    buff("sFire", "enemy", [{ zone: "susceptibility", value: 0.1, elements: ["fire"] }]),
    buff("sAll", "enemy", [{ zone: "susceptibility", value: 0.1 }]),
    buff("ampArts", "self", [{ zone: "amp", value: 0.1, elements: [...ARTS] }]),
    buff("ampTeam", "team", [{ zone: "amp", value: 0.1, elements: ["fire"] }]),
    // An EnhancedAction-style raise of an active Amp: not gaining one.
    buff("ampRaise", "self", [{ zone: "amp", value: 0.05 }], { categories: [] }),
    // A category its modifiers don't say: every element.
    buff("tagged", "self", [], { categories: ["amp"] }),
  ];
  const apply5 = [onCast("p1", "attack1", "sPhys"), onCast("p2", "attack2", "sFire"), onCast("p3", "attack3", "sAll"), onCast("p4", "attack4", "ampArts"), onCast("p5", "attack5", "ampTeam", "ampRaise", "tagged")];
  const own = [
    count("physSusc", { event: "buffApplied", categories: ["susceptibility"], elements: ["physical"] }, "a"),
    count("fireSusc", { event: "buffApplied", categories: ["susceptibility"], elements: ["fire"] }, "b"),
    count("allArtsSusc", { event: "buffApplied", categories: ["susceptibility"], allElements: [...ARTS] }, "c"),
    count("artsAmp", { event: "buffApplied", categories: ["amp"], allElements: [...ARTS] }, "d"),
    count("pulseAmp", { event: "buffApplied", categories: ["amp"], elements: ["pulse"] }, "e"),
    count("ampToOthers", { event: "buffApplied", categories: ["amp"], toOthers: true }, "f"),
    count("anyAmp", { event: "buffApplied", categories: ["amp"] }, "g"),
  ];
  const mates = [
    count("gainsAmp", { event: "buffApplied", categories: ["amp"], received: true }, "a", "anyone"),
    count("gainsSusc", { event: "buffApplied", categories: ["susceptibility"], received: true }, "b", "anyone"),
    count("teammateAmp", { event: "buffApplied", categories: ["amp"] }, "c", "teammate"),
  ];
  const s = run(withKit({ buffs, triggers: [...apply5, ...own] }, { triggers: mates }), { ...scenario(chain), team: [build, mate] });

  it("elements: a listed category reaching one of them, an all-element one counting; allElements: every one of them", () => {
    expect([n(s, "a"), n(s, "b"), n(s, "c")]).toEqual([2, 2, 1]);
    // The all-Arts Amp and the all-element "tagged" one; the Heat-only team Amp reaches neither every Arts element nor Electric.
    expect([n(s, "d"), n(s, "e")]).toEqual([2, 2]);
  });

  it("toOthers: only the team Amp reaches someone else; categories [] isn't an Amp; a category given counts", () => {
    expect(n(s, "f")).toBe(1);
    expect(n(s, "g")).toBe(3);
  });

  it("received: the teammate gains the team Amp (not Laevatain's own, nor the enemy's debuffs); `by` still judges the applier", () => {
    expect(n(s, "a", mate.operator)).toBe(1);
    expect(n(s, "b", mate.operator)).toBe(0);
    expect(n(s, "c", mate.operator)).toBe(3);
  });

  it("the event carries the elements per category and the recipients", () => {
    expect(buffReach(buffs[3] as KitBuff)).toEqual({ amp: [...ARTS] });
    expect(buffReach(buff("w", "enemy", [{ attr: 62, value: 0.1 }, { attr: 70, value: 0.1 }]))).toEqual({ weakness: ["physical", "fire", "pulse", "cryst", "natural", "ether"], susceptibility: ["physical"] });
    const e: BattleEvent = { type: "buffApplied", frame: 0, operator: op, buff: "x", categories: ["amp"], reach: { amp: ["fire"] }, recipients: [op, mate.operator] };
    expect(eventMatches({ event: "buffApplied", categories: ["amp"], received: true }, e, mate.operator, {})).toBe(true);
    expect(eventMatches({ event: "buffApplied", categories: ["amp"], elements: ["cryst"] }, e, op, {})).toBe(false);
  });

  it("the game's tags map onto the filters (the loader's `tags`)", () => {
    expect(buffTagFilter([1066759270])).toEqual({ categories: ["susceptibility"], elements: ["physical"] });
    expect(buffTagFilter([1427729990])).toEqual({ categories: ["susceptibility"], elements: [...ARTS] });
    expect(buffTagFilter([486772476])).toEqual({ categories: ["amp"], allElements: [...ARTS] });
    // Junction Point: the four elemental Susceptibility tags.
    expect(buffTagFilter([458037917, 1425735059, -1640994543, -575106878])).toEqual({ categories: ["susceptibility"], elements: ["fire", "cryst", "pulse", "natural"] });
    // Eternal Xiranite's four category tags.
    expect(buffTagFilter([-1957150384, 2029588776])).toEqual({ categories: ["protection", "weakness"] });
    expect(() => buffTagFilter([1066759270, -1920931676])).toThrow(/one category filter/);
    expect(() => buffTagFilter([-1748167886])).toThrow(/no category filter/);
    expect(triggerOn({ event: "buffApplied", tags: [458037917], fromKinds: ["battle"], toOthers: true }, "test")).toEqual({ event: "buffApplied", categories: ["susceptibility"], elements: ["fire"], fromKinds: ["battle"], toOthers: true });
  });

  it("the loader makes a kit buff whose game buff has the shield tag a shield; written categories must agree", () => {
    const shield = buff("s", "self", [], { gameBuff: "buff_chr_0009_azrila_ultimateshield" });
    expect(withCategories("test", shield).categories).toEqual(["shield"]);
    expect(() => withCategories("test", { ...shield, categories: [] })).toThrow(/shield tag/);
    expect(withCategories("test", buff("t", "self", [{ zone: "amp", value: 0.1 }], { gameBuff: "buff_common_affixes_enhance_spell" })).categories).toBeUndefined();
    // Catcher's combo shield, from its game buff.
    expect(data.kits.operators["chr_0020_meurs"]?.buffs.find((b) => b.id === "combo_shield")?.categories).toEqual(["shield"]);
  });
});

describe("T2: heals the owner receives", () => {
  it("toOwner counts heals of the trigger's owner from any healer", () => {
    const healTeam: KitTrigger = { id: "healTeam", on: { event: "cast", skills: [L + "attack1"] }, by: "self", do: [{ kind: "heal", target: "team" }] };
    const healSelf: KitTrigger = { id: "healSelf", on: { event: "cast", skills: [L + "attack2"] }, by: "self", do: [{ kind: "heal", target: "self" }] };
    const received = (stack: string) => count(`got_${stack}`, { event: "heal", toOwner: true }, stack, "anyone");
    const s = run(withKit({ triggers: [healTeam, healSelf, received("a")] }, { triggers: [received("a")] }), { ...scenario(chain.slice(0, 2)), team: [build, mate] });
    expect(n(s, "a")).toBe(2);
    expect(n(s, "a", mate.operator)).toBe(1);
  });
});

describe("T3: crit-triggered effects are random outcomes", () => {
  const critT = count("critT", { event: "hit", crit: true }, "a");
  const g = withKit({ triggers: [critT] });
  const sc = (crit: TimelineScenario["options"]["crit"]) => ({ ...scenario(chain), options: { crit } });

  it("randomOutcomes lists them unless crits are never or always; with expected the search rolls crits", () => {
    expect(critTriggers(g, sc("expected"))).toEqual(["Laevatain: critT"]);
    expect(randomOutcomes(g, sc("expected"))).toEqual(["crit-triggered effects (Laevatain: critT): ranked with rolled crits"]);
    expect(randomOutcomes(g, sc("rolled"))).toEqual(["rolled crits", "crit-triggered effects (Laevatain: critT)"]);
    expect(randomOutcomes(g, sc("never"))).toEqual([]);
    expect(searchCritMode(g, sc("expected"))).toBe("rolled");
    expect(searchCritMode(data, sc("expected"))).toBe("expected");
    expect(searchCritMode(g, sc("always"))).toBe("always");
  });

  it("simulate with expected crits warns that they never fire", () => {
    const text = formatSimulation(g, sc("expected"), false);
    expect(text).toMatch(/Warning: crit-triggered effects never fire with expected crits \(Laevatain: critT\)/);
    expect(text).not.toMatch(/Note: random outcomes/);
    expect(n(run(g, sc("expected")), "a")).toBe(0);
    expect(n(run(g, sc("always")), "a")).toBeGreaterThan(0);
  });

  it("search plays such a scenario over seeded battles with rolled crits", () => {
    const { rotation: _r, ...rest } = { ...sc("expected"), durationFrames: 2 * FPS };
    const r = searchRotation(g, rest, { beamWidth: 2, maxExpansions: 40, runs: 0 });
    expect(r.crit).toBe("rolled");
    expect(r.seeds).toHaveLength(4);
  });
});

describe("C1: castLink", () => {
  const linkHit = (id: string, atLeast?: number): KitHit => ({ ...attack1Hit, id, frames: [22], if: { castLink: atLeast === undefined ? {} : { atLeast } } });
  const skills = kit.skills.map((s) => (s.skillId === L + "normal_skill" ? { ...s, hits: [...s.hits, linkHit("one"), linkHit("three", 3)] } : s));
  const give: KitTrigger = { id: "give", on: { event: "cast", skills: [L + "attack1"] }, by: "self", do: [{ kind: "link", count: 2 }] };

  it("a hit of a cast that used Link stacks: at least one by default, or atLeast", () => {
    const s = run(withKit({ skills, triggers: [give] }), scenario([act("attack1"), act("normal_skill")]));
    expect(s.hits.filter((h) => h.hitId === "one")).toHaveLength(1);
    expect(s.hits.some((h) => h.hitId === "three")).toBe(false);
    expect(s.casts.find((c) => c.skill === L + "normal_skill")?.link).toBe(2);
    const none = run(withKit({ skills }), scenario([act("attack1"), act("normal_skill")]));
    expect(none.hits.some((h) => h.hitId === "one")).toBe(false);
  });

  it("is false for a triggered hit of no cast", () => {
    const shot: KitTrigger = { id: "shot", on: { event: "cast", skills: [L + "normal_skill"] }, by: "self", skill: L + "attack1", do: [{ kind: "hits", hits: [{ ...attack1Hit, id: "shot", damageType: "none", frames: [3], if: { castLink: {} } }] }] };
    const s = run(withKit({ triggers: [give, shot] }), scenario([act("attack1"), act("normal_skill")]));
    expect(s.hits.some((h) => h.hitId === "shot")).toBe(false);
  });
});

describe("C2: operatorBuff", () => {
  const shield = buff("shield", "self", [], { categories: ["shield"], gameBuff: "buff_chr_0009_azrila_ultimateshield" });
  const guard = buff("guard", "team", [{ attr: 63, value: 0.1 }]);

  it("a buff from anyone reaching the operator of a category, or standing for a game buff", () => {
    const check: KitTrigger = {
      id: "check", on: { event: "cast", skills: [L + "attack2"] }, by: "self",
      do: [
        { kind: "gain", gains: [{ stack: "a", amount: 1 }], if: { operatorBuff: { categories: ["shield"] } } },
        { kind: "gain", gains: [{ stack: "b", amount: 1 }], if: { operatorBuff: "buff_chr_0009_azrila_ultimateshield" } },
        { kind: "gain", gains: [{ stack: "c", amount: 1 }], if: { operatorBuff: { categories: ["protection", "amp"] } } },
      ],
    };
    const s = run(withKit({ buffs: [shield], triggers: [onCast("put", "attack1", "shield"), check] }), scenario(chain.slice(0, 2)));
    expect([n(s, "a"), n(s, "b"), n(s, "c")]).toEqual([1, 1, 0]);
  });

  it("as eventOperator: an attacked operator with Protection from a teammate (Former Finery)", () => {
    const protectedHit = count("protectedHit", { event: "attacked" }, "a", "anyone", { if: { eventOperator: { operatorBuff: { categories: ["protection"] } } } });
    const sc = { ...scenario([act("attack1")]), team: [build, mate], enemyActions: [{ kind: "attack" as const, at: [3, 60] }] };
    const s = run(withKit({ buffs: [guard], triggers: [onCast("put", "attack1", "guard")] }, { triggers: [protectedHit] }), sc);
    // Both attacks come while the 20 s guard is up (applied at the cast, frame 0).
    expect(n(s, "a", mate.operator)).toBe(2);
    expect(n(run(withKit({}, { triggers: [protectedHit] }), sc), "a", mate.operator)).toBe(0);
  });
});

describe("C3: decorations on buff modifiers; Stagger efficiency from buffs", () => {
  const attack5 = (g: GameData) => run(g, scenario(chain)).hits.filter((h) => h.skillId === L + "attack5");
  const base = attack5(data);

  it("a damage bonus only on Final Strikes reaches attack5's Final Strike only", () => {
    const fs = buff("fs", "self", [{ zone: "damageBonus", value: 1, decorations: ["finalStrike"] }]);
    const hits = attack5(withKit({ buffs: [fs], triggers: [onCast("put", "attack1", "fs")] }));
    const by = (list: typeof base, id: string) => list.find((h) => h.hitId === id)?.exact ?? Number.NaN;
    expect(by(hits, "hit")).toBeCloseTo(by(base, "hit"), 6);
    // The damage-bonus zone 1 + Σ gains 1.
    const zone = base.find((h) => h.hitId === "hit_2")?.zones.damageBonus ?? Number.NaN;
    expect(by(hits, "hit_2") / by(base, "hit_2")).toBeCloseTo((zone + 1) / zone, 6);
  });

  it("Stagger efficiency (26) from a buff adds to the panel's for landings its filters let through", () => {
    const panel = computeStats(data, build).attrs[26]?.total ?? data.attributeDefaults[26] ?? 1;
    const dealt = (g: GameData) => {
      const s = run(g, scenario(chain));
      return s.stagger.poise;
    };
    const max = run(data, scenario([])).stagger.poise;
    const plain = max - dealt(data);
    expect(plain).toBeGreaterThan(0);
    const onFs = buff("fsPoise", "self", [{ attr: 26, value: 0.5, decorations: ["finalStrike"] }]);
    const onFinisher = buff("finPoise", "self", [{ attr: 26, value: 0.5, decorations: ["finisher"] }]);
    expect(max - dealt(withKit({ buffs: [onFs], triggers: [onCast("put", "attack1", "fsPoise")] }))).toBeCloseTo((plain * (panel + 0.5)) / panel, 6);
    expect(max - dealt(withKit({ buffs: [onFinisher], triggers: [onCast("put", "attack1", "finPoise")] }))).toBeCloseTo(plain, 6);
  });

  it("dive: the loader reads bit 1024; hit triggers and modifiers can ask for it", () => {
    expect(kit.skills.find((s) => s.skillId === L + "plunging_attack_end")?.hits[0]?.dive).toBe(true);
    expect(kit.skills.find((s) => s.skillId === L + "attack5")?.hits.some((h) => h.dive)).toBe(false);
    const e: BattleEvent = { type: "hit", frame: 0, operator: op, skillId: L + "plunging_attack_end", kind: "basic", element: "fire", finalStrike: false, finisher: false, controlled: true, dive: true };
    expect(eventMatches({ event: "hit", decorations: ["dive"] }, e, op, {})).toBe(true);
    expect(eventMatches({ event: "hit", decorations: ["finalStrike"] }, { ...e, dive: false }, op, {})).toBe(false);
  });
});

describe("C4: currentAction and casts beside the current action", () => {
  const skills = kit.skills.map((s) => (s.skillId === L + "normal_skill" ? { ...s, beside: { currentAction: { kinds: ["basic" as const], beforeExclusive: true as const } } } : s));
  const triggers = [count("beside", { event: "cast", kinds: ["battle"], beside: true }, "a"), count("replaces", { event: "cast", kinds: ["battle"], beside: false }, "b")];
  const g = withKit({ skills, triggers });

  it("before a basic attack's exclusive frame the battle skill runs beside it: attack1's hit still lands, the cast says beside", () => {
    const s = run(g, scenario([act("attack1"), act("normal_skill", 3)]));
    expect(s.hits.some((h) => h.skillId === L + "attack1")).toBe(true);
    expect([n(s, "a"), n(s, "b")]).toEqual([1, 0]);
  });

  it("past it, it replaces the action as usual", () => {
    const s = run(g, scenario([act("attack1"), act("normal_skill", 20)]));
    expect([n(s, "a"), n(s, "b")]).toEqual([0, 1]);
  });

  it("the predicate: the running action's kind, its exclusive frame; null once it's over", () => {
    const ec = (currentAction: { kind: "basic" | "battle" | "none"; beforeExclusive: boolean } | null) => evalContext(data, build, computeStats(data, build), "", { currentAction });
    expect(judge({ currentAction: { kinds: ["basic"] } }, ec({ kind: "basic", beforeExclusive: false }))).toBe(true);
    expect(judge({ currentAction: { kinds: ["basic"], beforeExclusive: true } }, ec({ kind: "basic", beforeExclusive: false }))).toBe(false);
    expect(judge({ currentAction: { kinds: ["battle"] } }, ec({ kind: "basic", beforeExclusive: true }))).toBe(false);
    expect(judge({ currentAction: { kinds: ["basic"] } }, ec(null))).toBe(false);
    expect(judge({ currentAction: { kinds: ["basic"] } }, evalContext(data, build, computeStats(data, build), ""))).toBeUndefined();
  });
});

describe("E1, E2: the enemy's super armor and rank", () => {
  it("are read from the tables (Rhodagn: 30 super armor, 30 while Staggered; displayType 2, Boss)", () => {
    expect(data.enemies["eny_0051_rodin"]?.superArmor).toEqual({ initial: 30, staggered: 30 });
    expect(data.enemies["eny_0051_rodin"]?.rank).toBe(2);
    expect(data.enemies["eny_0099_slimeml2"]?.superArmor).toEqual({ initial: 5, staggered: 0 });
    expect(data.enemies["eny_0099_slimeml2"]?.rank).toBe(0);
  });

  it("enemySuperArmor and enemyRank judge the scenario's enemy", () => {
    const t: KitTrigger = {
      id: "start", on: { event: "fightStart" }, by: "self",
      do: [
        { kind: "gain", gains: [{ stack: "a", amount: 1 }], if: { enemySuperArmor: { atLeast: 30 } } },
        { kind: "gain", gains: [{ stack: "b", amount: 1 }], if: { enemySuperArmor: { below: 30 } } },
        { kind: "gain", gains: [{ stack: "c", amount: 1 }], if: { enemyRank: [2] } },
        { kind: "gain", gains: [{ stack: "d", amount: 1 }], if: { enemyRank: [0, 1] } },
      ],
    };
    const s = run(withKit({ triggers: [t] }), scenario([]), 1);
    expect([n(s, "a"), n(s, "b"), n(s, "c"), n(s, "d")]).toEqual([1, 0, 1, 0]);
  });

  it("while Staggered the Staggered value counts", () => {
    const ec = (staggered: number) => evalContext(data, build, computeStats(data, build), "", { enemySuperArmor: staggered });
    expect(judge({ enemySuperArmor: { atLeast: 20 } }, ec(0))).toBe(false);
    expect(judge({ enemySuperArmor: { below: 10 } }, ec(0))).toBe(true);
    // Brutal Pincerbeast: 5 → 0 once its stagger bar is gone (attack1 with 300 stagger).
    const skills = kit.skills.map((s) => (s.skillId === L + "attack1" ? { ...s, hits: s.hits.map((h) => ({ ...h, poise: 300 })) } : s));
    const t: KitTrigger = { id: "late", on: { event: "cast", skills: [L + "attack2"] }, by: "self", do: [{ kind: "gain", gains: [{ stack: "a", amount: 1 }], if: { enemySuperArmor: { below: 5 } } }] };
    const t0: KitTrigger = { id: "early", on: { event: "cast", skills: [L + "attack1"] }, by: "self", do: [{ kind: "gain", gains: [{ stack: "b", amount: 1 }], if: { enemySuperArmor: { atLeast: 5 } } }] };
    const s = run(withKit({ skills, triggers: [t, t0] }), { ...scenario(chain.slice(0, 2)), target: { enemy: "eny_0099_slimeml2", level: 1 } }, 60);
    expect([n(s, "a"), n(s, "b")]).toEqual([1, 1]);
  });
});

describe("kit schema: the batch-4 trigger and condition fields", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(JSON.parse(readFileSync(new URL("../schemas/kit.schema.json", import.meta.url), "utf8")) as object);
  const validate = ajv.getSchema("https://github.com/jojkaart/Endfield-battle-simulator/schemas/kit.schema.json");
  const kitWith = (o: object) => ({ operator: "x", sources: ["test"], skills: [{ skillId: "s", label: "s", damageType: "basic", hits: [{ id: "h", scale: [], dive: true, if: { castLink: { atLeast: 2 } } }] }], ...o });

  it("accepts the new filters, predicates and buff fields", () => {
    const triggers = [
      { id: "t1", on: { event: "buffApplied", categories: ["amp", "shield"], elements: ["pulse"], allElements: ["fire"], toOthers: true, received: true }, by: "anyone", do: [{ kind: "openCombo" }] },
      { id: "t2", on: { event: "buffApplied", tags: [1066759270], fromKinds: ["battle"] }, by: "self", do: [{ kind: "openCombo" }] },
      { id: "t3", on: { event: "heal", toOwner: true }, by: "anyone", if: { all: [{ operatorBuff: { categories: ["shield"] } }, { operatorBuff: "buff_x" }, { enemySuperArmor: { atLeast: 30 } }, { enemyRank: [0, 1] }] }, do: [{ kind: "openCombo" }] },
      { id: "t4", on: { event: "cast", beside: true }, by: "self", if: { currentAction: { kinds: ["basic"], beforeExclusive: true } }, do: [{ kind: "openCombo" }] },
      { id: "t5", on: { event: "hit", decorations: ["dive"] }, by: "self", do: [{ kind: "openCombo" }] },
    ];
    const buffs = [{ id: "b", label: "b", target: "self", categories: [], modifiers: [{ attr: 26, value: 0.3, decorations: ["finalStrike"] }] }];
    expect(validate?.(kitWith({ triggers, buffs })), JSON.stringify(validate?.errors)).toBe(true);
    expect(validate?.(kitWith({ triggers: [{ id: "t", on: { event: "buffApplied", tags: [1], categories: ["amp"] }, by: "self", do: [{ kind: "openCombo" }] }] }))).toBe(false);
    expect(validate?.(kitWith({ triggers: [{ id: "t", on: { event: "fightStart" }, by: "self", if: { enemySuperArmor: {} }, do: [{ kind: "openCombo" }] }] }))).toBe(false);
  });
});
