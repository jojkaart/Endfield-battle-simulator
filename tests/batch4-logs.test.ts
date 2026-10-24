// Batch-4 shared features, log tooling (docs/kit-batches/batch-4.md "Merged
// gaps" L1-L6): the reaction replay's landing order and time stops, layer
// caps through the kits, what the log never lists (own crit parts, omitted
// buffs, Link), and hit values that read consumed stacks, own stacks or the
// enemy's stacks. Each shown with a small hand-made change to Laevatain's
// kit and a synthetic log whose numbers the engine computes itself.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  computeHit,
  computeStats,
  evalContext,
  evaluate,
  linkValue,
  NO_STATUS,
  roundDamage,
  type Build,
  type GameData,
  type KitBuff,
  type KitHit,
  type KitSkill,
  type KitTrigger,
  type Modifier,
  type OperatorKit,
} from "@efsim/engine";
import { loadGameData, type LogFixture, type LogHit } from "@efsim/data";
import { calc, checkLog, kitStackCaps, layerVariants, linkVariants, logBuffReplay, readLogFixture, teamStackCaps, type CalcOptions, type HitVerdict } from "@efsim/cli";
import { assumeValues, statedCounts, valueAssumptions, valueReads } from "../packages/cli/src/hitvalues.ts";
import { placeHits, type LoggedCast } from "../packages/cli/src/logcasts.ts";
import { checkReactions, enemyClockDue } from "../packages/cli/src/reactioncheck.ts";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const panel = computeStats(data, build);
const target = { enemy: "eny_0051_rodin", level: 90 };
const BATTLE = "chr_0016_laevat_normal_skill";
const COMBO = "chr_0016_laevat_combo_skill";

/** Laevatain's kit with these skills (in place of hers) and extra stacks, buffs and triggers. */
const withKit = (k: { skills: KitSkill[]; stacks?: OperatorKit["stacks"]; buffs?: KitBuff[]; triggers?: KitTrigger[] }): GameData => ({
  ...data,
  kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, skills: k.skills, stacks: [...kit.stacks, ...(k.stacks ?? [])], buffs: [...kit.buffs, ...(k.buffs ?? [])], triggers: [...kit.triggers, ...(k.triggers ?? [])] } } },
});
const hit = (id: string, events: string[], extra: Partial<KitHit> = {}): KitHit => ({ id, label: id, scale: ["atk_scale"], count: 1, events, damageType: "battle", element: "fire", ...extra });
const battle = (hits: KitHit[]): KitSkill => ({ skillId: BATTLE, label: "battle", kind: "battle", hits });
const logHit = (t: number, event: string, value: number, extra: Partial<LogHit> = {}): LogHit => ({ t, operator: op, event, value, crit: false, element: "fire", effects: [], boundaryEffects: [], unquantified: [], ...extra });
const fixture = (hits: LogHit[], team: Build[] = [build]): LogFixture => ({
  id: "synthetic",
  description: "synthetic log",
  provenance: { source: "test", url: "test", battleId: "test", parserVersion: "test", inGame: true, measured: "test", verifiedAgainst: {}, notes: [] },
  enemy: { id: target.enemy, level: target.level },
  team,
  hits,
});
/** The engine's own number for a hit (no crit unless asked). */
const damage = (g: GameData, h: KitHit, modifiers: Modifier[] = [], crit = false) =>
  roundDamage(computeHit(g, build, panel, target, { skillId: BATTLE }, h, { crit: crit ? "always" : "never", staggered: false, conditions: [], modifiers }).exact);
const assumed = (v: HitVerdict | undefined) => (v?.kind === "match" ? v.assumed : [v?.kind ?? "none"]);

describe("L4 and L6: hit values that read what only a fight knows", () => {
  const consumedHit = hit("c", ["k"], { scale: [], scaleValue: { product: ["atk_scale", { sum: [1, { consumed: true }] }] } });

  it("lists what a hit's values read and tries each over its range", () => {
    const r = valueReads(hit("x", ["k"], { scaleValue: { sum: [{ stackCount: "s" }, { if: { enemyInfliction: "cryst", minStacks: 2 }, then: { enemyVulnerableStacks: true } }, { consumed: true }] } }));
    expect(r).toEqual({ consumed: true, stacks: ["s"], elements: ["cryst"], vulnerable: true });
    // consumed 0-4 × stack 0-2 × (no infliction or Cryo 1-4) × Vulnerable 0-4
    expect(valueAssumptions(r, () => 2)).toHaveLength(5 * 3 * 5 * 5);
    expect(valueAssumptions(valueReads(hit("y", ["k"])), () => 2)).toEqual([]);
  });

  it("writes an assumption into the hit: values, and with conditions its if too", () => {
    const h = hit("x", ["k"], { if: { consumedAtLeast: 2 }, scaleValue: { if: { stack: "s", atLeast: 2 }, then: { consumed: true }, else: 0 } });
    const a = assumeValues(h, { consumed: 3, stacks: { s: 2 } }, true);
    expect(a.scaleValue).toEqual({ if: { all: [] }, then: 3, else: 0 });
    expect(a.if).toEqual({ all: [] });
    expect(assumeValues(h, { consumed: 1 }, true).if).toEqual({ any: [] });
    // calc leaves the hit's own conditions alone
    expect(assumeValues(h, { consumed: 1 }, false).if).toEqual({ consumedAtLeast: 2 });
    expect(statedCounts(valueReads(h))).toEqual({ consumed: 1, stacks: { s: 1 } });
  });

  it("zmdlogs check finds the consumed count a hit's value needs (Rossi's sequence 2)", () => {
    const g = withKit({ skills: [battle([consumedHit])] });
    const v = checkLog(g, fixture([logHit(1000, "k", damage(g, assumeValues(consumedHit, { consumed: 2 }, true)))]))[0];
    expect(assumed(v)).toContain("consumed 2");
  });

  it("zmdlogs check tries an own stack over its range (Zhuang Fangyi's conduct_cnt)", () => {
    const h = hit("s", ["k"], { scale: [], scaleValue: { product: ["atk_scale", { sum: [1, { stackCount: "conduct" }] }] } });
    const g = withKit({ skills: [battle([h])], stacks: [{ id: "conduct", label: "conduct", max: 4 }] });
    const v = checkLog(g, fixture([logHit(1000, "k", damage(g, assumeValues(h, { stacks: { conduct: 3 } }, true)))]))[0];
    expect(assumed(v)).toContain("stack conduct 3");
  });

  it("enemyInflictionStacks reads the enemy's stacks of one element", () => {
    const c = (infliction: { element: "cryst" | "fire"; stacks: number } | null) => evalContext(data, build, panel, BATTLE, { enemy: { ...NO_STATUS, infliction: infliction && { ...infliction, expiresAt: 999 } } });
    expect(evaluate({ enemyInflictionStacks: "cryst" }, c({ element: "cryst", stacks: 3 }))).toBe(3);
    expect(evaluate({ enemyInflictionStacks: "cryst" }, c({ element: "fire", stacks: 3 }))).toBe(0);
    expect(evaluate({ enemyInflictionStacks: "cryst" }, c(null))).toBe(0);
    expect(() => evaluate({ enemyInflictionStacks: "cryst" }, evalContext(data, build, panel, BATTLE))).toThrow(/infliction stacks/);
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    ajv.addSchema(JSON.parse(readFileSync(new URL("../schemas/kit.schema.json", import.meta.url), "utf8")) as object, "kit");
    const valid = ajv.compile({ $ref: "kit#/$defs/valueExpr" });
    expect(valid({ product: ["atk_scale3", { enemyInflictionStacks: "cryst" }] })).toBe(true);
    expect(valid({ enemyInflictionStacks: "physical" })).toBe(false);
  });

  it("zmdlogs check judges enemy-state conditions inside a value, and enemyInflictionStacks, on hypotheses (Last Rite's combo bonus as one hit)", () => {
    const perStack = { sum: [1, 2, 3, 4].map((k) => ({ if: { enemyInfliction: "cryst" as const, minStacks: k }, then: 1 })) };
    const ifs = hit("ifs", ["k1"], { scale: [], scaleValue: { product: ["atk_scale", perStack] } });
    const stacks = hit("stacks", ["k2"], { scale: [], scaleValue: { product: ["atk_scale", { enemyInflictionStacks: "cryst" }] } });
    const g = withKit({ skills: [battle([ifs, stacks])] });
    const at = (h: KitHit, n: number) => damage(g, assumeValues(h, { infliction: { element: "cryst", stacks: n } }, true));
    expect(at(ifs, 3)).toBe(at(stacks, 3));
    const v = checkLog(g, fixture([logHit(1000, "k1", at(ifs, 3)), logHit(5000, "k2", at(stacks, 2))]));
    expect(assumed(v[0])).toContain("enemy cryst ×3");
    expect(assumed(v[1])).toContain("enemy cryst ×2");
  });

  it("calc shows such a hit at a stated count instead of failing", () => {
    const g = withKit({ skills: [battle([consumedHit, hit("plain", ["k2"])])] });
    const options: CalcOptions = { target, crit: "never", staggered: false, conditions: [], verbose: false };
    const text = calc(g, build, options);
    expect(text).toContain("shown at 1 of each");
    expect(text).toMatch(/value [\d.]+/);
    expect(calc(withKit({ skills: [battle([hit("plain", ["k2"])])] }), build, options)).not.toContain("shown at 1 of each");
  });
});

describe("L2: a layered buff's cap through the kit buff that stands for it", () => {
  const mi = ["item_equip_t4_suit_criti01_body_01", "item_equip_t4_suit_criti01_edc_01", "item_equip_t4_suit_criti01_edc_01"].map((id): Build["gear"][number] => ({ id, artifice: [3, 3, 3] }));
  const wearer: Build = { ...build, gear: [...mi, build.gear[3] as Build["gear"][number]] };

  it("finds MI Security's 5 layers through suit_criti01's kit buff, which the ID prefix misses", () => {
    const p = computeStats(data, wearer);
    expect(teamStackCaps([p])("buff_equipsuit_critsuitatk_01", "max_stack")).toBeNull();
    expect(kitStackCaps(data, new Map([[op, { build: wearer, panel: p }]]))("buff_equipsuit_critsuitatk_01", "max_stack")).toBe(5);
  });

  it("falls back to the literal maxStackCnt when no skill in the team sets the cap (Æthertech's damage buff: 4)", () => {
    const e = { buff: "buff_equipsuit_poisedmg_01_damagebuff", zone: "damageBonus" as const, element: null, value: 0.08 };
    const h = { ...logHit(0, "x", 1), effects: [e] };
    expect(layerVariants(h).map((v) => v.label)).toEqual([null, ...[2, 3, 4].map((n) => `buff_equipsuit_poisedmg_01_damagebuff ×${n} layers`)]);
  });
});

describe("L3: what the log never lists", () => {
  const onCast = (id: string, skill: string, action: KitTrigger["do"][number]): KitTrigger => ({ id, on: { event: "cast", skills: [skill] }, by: "self", do: [action] });

  it("tries an own buff's crit part (ZMDLogs lists no crit entries), and all of an own buff the log never names", () => {
    const crit: KitBuff = { id: "t_crit", label: "crit", target: "self", gameBuff: "buff_listed", duration: 10, modifiers: [{ zone: "critDamage", value: 0.5 }, { zone: "atk", value: 0.1 }] };
    const hidden: KitBuff = { id: "t_hidden", label: "hidden", target: "self", gameBuff: "buff_never_logged", duration: 10, modifiers: [{ zone: "damageBonus", value: 0.3 }] };
    const h = hit("h", ["k"]);
    const g = withKit({ skills: [battle([h])], buffs: [crit, hidden], triggers: [onCast("t1", BATTLE, { kind: "buff", buff: "t_crit" }), onCast("t2", BATTLE, { kind: "buff", buff: "t_hidden" })] });
    const listed = { buff: "buff_listed", zone: "atk" as const, element: null, value: 0.1 };
    const critHit = logHit(1000, "k", damage(g, h, [{ zone: "atk", value: 0.1, source: "log" }, { zone: "critDamage", value: 0.5, source: "kit" }], true), { crit: true, effects: [listed] });
    const hiddenHit = logHit(5000, "k", damage(g, h, [{ zone: "damageBonus", value: 0.3, source: "kit" }]));
    const v = checkLog(g, fixture([critHit, hiddenHit]));
    expect(assumed(v[0])).toContain("unlogged own t_crit crit part");
    expect(assumed(v[1])).toContain("unlogged own t_hidden");
  });

  it("takes Link from the replay of the logged casts (the stacks each cast used), tries 1-4 only where the replay can't say", () => {
    const comboHit = hit("c", ["combo_key"], { damageType: "combo", frames: [30] });
    const battleHit = hit("b", ["battle_key"], { frames: [15] });
    const g = withKit({ skills: [{ skillId: COMBO, label: "combo", kind: "combo", hits: [comboHit] }, battle([battleHit])], triggers: [onCast("t_link", COMBO, { kind: "link" })] });
    const linked = damage(g, battleHit, [{ zone: "multiplicative", value: linkValue("battle", 1), source: "Link" }]);
    // The combo at 2000 ms (cast at 1000) leaves a stack; the battle skill at 4000 uses it; the one at 7000 has none.
    const fx = fixture([logHit(2000, "combo_key", 1, { element: null }), logHit(4000, "battle_key", linked), logHit(7000, "battle_key", damage(g, battleHit))]);
    const placement = placeHits(g, fx);
    const cast = (t: number) => placement.hits.get(fx.hits.find((x) => x.t === t) as LogHit)?.cast;
    expect(cast(2000)?.start).toBeCloseTo(1000, 6);
    const r = logBuffReplay(g, fx, placement);
    const link = (t: number) => {
      const f = r.replay.castFacts(cast(t) as LoggedCast);
      return "unknown" in f ? f : f.link;
    };
    expect([link(4000), link(7000)]).toEqual([{ value: 1 }, { value: 0 }]);
    const v = checkLog(g, fx, { replay: r });
    // The replay's Link is a fact, not an assumption: both battle-skill hits match plainly.
    expect(v.slice(1).map((x) => (x.kind === "match" ? x.class : x.kind))).toEqual(["plain", "plain"]);
    // Without the replay (the log's listing alone), Link is tried, labelled with why.
    expect(assumed(checkLog(g, fx, { buffs: "log" })[1])).toContain("Link 1 (the replay can't say: no replay)");
    expect(linkVariants("ultimate", { unknown: "x" }).map((x) => x.label)).toEqual([null, ...[1, 2, 3, 4].map((n) => `Link ${n} (the replay can't say: x)`)]);
    expect(linkVariants("ultimate", { value: 2 }).map((x) => [x.label, x.modifiers.length])).toEqual([[null, 1]]);
    expect(linkVariants("combo", { value: 2 })).toHaveLength(1);
  });

  it("leaves Link undecided where another cast that uses Link comes within REPLAY_EDGE_MS (40d9: Gilberta's and Si's ultimates, 86 ms apart)", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url).pathname);
    const v = checkLog(data, fx).filter((x) => x.hit.t === 12951 && x.hit.operator === "chr_0013_aglina");
    expect(v.map(assumed)).toEqual([["Link 1 (the replay can't say: Link stacks change within 500 ms of the cast)"]]);
    // One hit out of the log: no casts to replay, the log's listing alone.
    const one = checkLog(data, { ...fx, hits: fx.hits.filter((h) => h.t === 12951 && h.operator === "chr_0013_aglina") }, { buffs: "log" });
    expect(one.map(assumed)).toEqual([["Link 1 (the replay can't say: no replay)"]]);
  });
});

describe("L1: the n-th logged landing of a key in a cast is the n-th kit landing", () => {
  // Kit order puts the lifting hit first, but it lands second (frame 20).
  const lift = hit("lift", ["k"], { frames: [20], applies: [{ kind: "physicalStatus", status: "lift", forced: true }] });
  const first = hit("first", ["k"], { frames: [10] });
  const g = withKit({ skills: [battle([lift, first])] });
  const fx = fixture([logHit(1000, "k", 1), logHit(1333, "k", 1), logHit(1333, "buff_physical_airborne", 1, { element: "physical" }), logHit(9000, "k", 1), logHit(9333, "k", 1), logHit(9333, "buff_physical_airborne", 1, { element: "physical" })]);

  it("maps landings by frame order, a new cast after a gap longer than the landings' span", () => {
    const placement = placeHits(g, fx);
    const placed = fx.hits.filter((h) => h.event === "k").map((h) => placement.hits.get(h));
    expect(placed.map((p) => [p?.index, p?.hits[0]?.id])).toEqual([[0, "first"], [1, "lift"], [0, "first"], [1, "lift"]]);
    expect(placed[0]?.cast.start).toBeCloseTo(1000 - (10 * 1000) / 30, 6);
    expect(placed[2]?.cast).not.toBe(placed[0]?.cast);
  });

  it("replays the second landing's Lift at its own time", () => {
    const c = checkReactions(g, fx);
    expect(c.matched.map((m) => [m.t, m.loggedT])).toEqual([[1333, 1333], [9333, 9333]]);
    expect(c.unpredicted).toEqual([]);
  });

  it("puts a key's late first landing in the cast of the same skill it can belong to, not a cast its kit frame alone implies", () => {
    // A landing at kit frame 300 (10 s; jumps make it sooner in the game) logged 2 s after the skill's first one:
    // the same cast (4e5e1390085e: Rossi's wolves, 3.8 s after her battle skill, kit frame 230).
    const wolf = hit("wolf", ["w"], { frames: [300] });
    const g2 = withKit({ skills: [battle([first, wolf])] });
    const fx2 = fixture([logHit(1000, "k", 1), logHit(3000, "w", 1), logHit(30000, "w", 1)]);
    const placement = placeHits(g2, fx2);
    const [a, b, c] = fx2.hits.map((h) => placement.hits.get(h)?.cast);
    expect(b).toBe(a);
    // Too late for any cast's kit frame (plus CAST_SLACK_MS): a cast of its own.
    expect(c).not.toBe(a);
    expect(c?.start).toBeCloseTo(30000 - 10000, 6);
  });
});

describe("L5: pending bursts held through the logged casts' time stops", () => {
  it("counts the enemy's clock at the lowest scale over each frame", () => {
    const stop = { start: 30, scales: Array.from({ length: 47 }, () => 0), operator: op, skillId: "x" };
    expect(enemyClockDue(500, 30, [])).toBeCloseTo(1500, 6);
    // From frame 15: 15 frames to the stop, 47 stopped, 15 after.
    expect(enemyClockDue(500, 30, [stop])).toBeCloseTo(500 + ((15 + 47 + 15) * 1000) / 30, 6);
    expect(enemyClockDue(500, 30, [{ ...stop, scales: stop.scales.map(() => 0.5) }])).toBeCloseTo(500 + ((15 + 30) * 1000) / 30, 6);
  });

  it("matches b7b3's Cryo burst held by Arcane's ultimate (4953 ms → logged 10340)", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-b7b3762d5da8.json", import.meta.url).pathname);
    const c = checkReactions(data, fx);
    const held = c.matched.find((m) => m.t === 4953);
    expect(held?.loggedT).toBe(10340);
    expect(held?.due).toBeGreaterThan(7400);
    // Nothing is unlogged: Tangtang's battle skill's last ticks (17055 ms) stay in their cast once others' time stops are
    // taken out of the time between its landings (tests/batch4-logs2.test.ts).
    expect(c.unlogged).toEqual([]);
  });
});
