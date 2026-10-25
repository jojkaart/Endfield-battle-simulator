// Batch-4 log tooling follow-ups found by the kit agents: unquantified buffs
// valued from the kits, some of a repeated boundary buff's instances, and
// cast placement that takes other operators' time stops out. Shown with a
// small hand-made change to Laevatain's kit and a synthetic log whose
// numbers the engine computes itself, and on the fixtures that showed them.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeHit, computeStats, roundDamage, type Build, type GameData, type KitBuff, type KitHit, type KitSkill, type KitTrigger, type Modifier, type OperatorKit } from "@efsim/engine";
import { loadGameData, type LogEffect, type LogFixture, type LogHit } from "@efsim/data";
import { boundarySubsets, checkLog, readLogFixture, type HitVerdict } from "@efsim/cli";
import { placeHits, worldMs } from "../packages/cli/src/logcasts.ts";
import { checkReactions } from "../packages/cli/src/reactioncheck.ts";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const panel = computeStats(data, build);
const target = { enemy: "eny_0051_rodin", level: 90 };
const BATTLE = "chr_0016_laevat_normal_skill";

const withKit = (k: { skills: KitSkill[]; buffs?: KitBuff[]; triggers?: KitTrigger[] }): GameData => ({
  ...data,
  kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, skills: k.skills, buffs: [...kit.buffs, ...(k.buffs ?? [])], triggers: [...kit.triggers, ...(k.triggers ?? [])] } } },
});
const hit = (id: string, events: string[], extra: Partial<KitHit> = {}): KitHit => ({ id, label: id, scale: ["atk_scale"], count: 1, events, damageType: "battle", element: "fire", ...extra });
const battle = (hits: KitHit[]): KitSkill => ({ skillId: BATTLE, label: "battle", kind: "battle", hits });
const logHit = (t: number, event: string, value: number, extra: Partial<LogHit> = {}): LogHit => ({ t, operator: op, event, value, crit: false, element: "fire", effects: [], boundaryEffects: [], unquantified: [], ...extra });
const fixture = (hits: LogHit[]): LogFixture => ({
  id: "synthetic",
  description: "synthetic log",
  provenance: { source: "test", url: "test", battleId: "test", parserVersion: "test", inGame: true, measured: "test", verifiedAgainst: {}, notes: [] },
  enemy: { id: target.enemy, level: target.level },
  team: [build],
  hits,
});
const damage = (g: GameData, h: KitHit, modifiers: Modifier[] = []) =>
  roundDamage(computeHit(g, build, panel, target, { skillId: BATTLE }, h, { crit: "never", staggered: false, modifiers }).exact);
const assumed = (v: HitVerdict | undefined) => (v?.kind === "match" ? v.assumed : [v?.kind ?? "none"]);
const fixtureFile = (id: string) => readLogFixture(new URL(`../fixtures/zmdlogs-${id}.json`, import.meta.url).pathname);

describe("unquantified buffs valued from the kit buff that stands for them", () => {
  const h = hit("h", ["k"]);
  const layered: KitBuff = { id: "t_layers", label: "layers", target: "team", gameBuff: "buff_test_layers", duration: 10, maxStacks: 3, modifiers: [{ zone: "atk", value: 0.1 }] };
  const onCast: KitTrigger = { id: "t_apply", on: { event: "cast", skills: [BATTLE] }, by: "self", do: [{ kind: "buff", buff: "t_layers" }] };
  const g = withKit({ skills: [battle([h])], buffs: [layered], triggers: [onCast] });
  const unq = [{ buff: "buff_test_layers", since: 0, source: op }];
  const atk = (n: number): Modifier[] => [{ zone: "atk", value: 0.1 * n, source: "test" }];

  it("tries the kit buff's modifiers at the source's build, 1 up to its maximum layers, after the reading without it", () => {
    const fx = fixture([logHit(1000, "k", damage(g, h), { unquantified: unq }), logHit(2000, "k", damage(g, h, atk(2)), { unquantified: unq })]);
    const v = checkLog(g, fx);
    expect(assumed(v[0])).toEqual([]);
    expect(assumed(v[1])).toEqual(["unquantified buff_test_layers from kit t_layers ×2"]);
  });

  it("makes a hit no reading fits a mismatch when a kit values the buff or the hit lists it with values, and unvalued when no kit values it", () => {
    // Until 2026-10-24 all three were "unquantified" (under unmodelled effects), which a verified fixture allows.
    const v = checkLog(g, fixture([logHit(1000, "k", damage(g, h, atk(5)), { unquantified: unq })]));
    expect(v[0]?.kind).toBe("mismatch");
    const other = [{ buff: "buff_test_other", since: 0, source: op }];
    // (The log names buff_test_layers elsewhere: else the kit buff counts as one the log never lists, tried on every hit.)
    const unvalued = checkLog(g, fixture([logHit(1000, "k", damage(g, h, atk(1)), { unquantified: other }), logHit(2000, "k", damage(g, h), { unquantified: unq })]))[0];
    expect(unvalued?.kind).toBe("unvalued");
    expect(unvalued?.kind === "unvalued" && unvalued.buffs).toEqual(["buff_test_other"]);
    const listed: LogEffect = { buff: "buff_test_layers", zone: "damageBonus", element: null, value: 0.01 };
    expect(checkLog(g, fixture([logHit(1000, "k", damage(g, h, atk(1)), { unquantified: unq, effects: [listed] })]))[0]?.kind).toBe("mismatch");
  });

  it("4e5e: Lustrous Carmine's ATK (once hand-annotated as unquantified), valued from Camille's weapon kit, matches all 85 of her hits", () => {
    // The fixture no longer lists it after 49418 ms (the kit-buff replay keeps it on: tests/buffreplay.test.ts); written back in as
    // the old annotation had it, the kit values it.
    const fx = fixtureFile("4e5e1390085e");
    const unq = { buff: "buff_wpn_lance_0015_atkup", since: 49418, source: "chr_0033_camille" };
    const annotated = { ...fx, hits: fx.hits.map((h) => (h.t >= 49418 ? { ...h, unquantified: [...h.unquantified, unq] } : h)) };
    const v = checkLog(data, annotated, { buffs: "log" }).filter((x) => x.hit.operator === "chr_0033_camille");
    expect(v.filter((x) => x.kind === "match")).toHaveLength(85);
    expect(v.some((x) => x.kind === "match" && x.assumed.includes("unquantified buff_wpn_lance_0015_atkup from kit wpn_lance_0015.atk"))).toBe(true);
  });
});

describe("repeated boundary buffs: 1 up to all of their instances", () => {
  const e = (buff: string, zone: "atk" | "damageBonus", value = 0.1): LogEffect => ({ buff, zone, element: null, value });

  it("adds, after the none-or-all readings, each count strictly between, a buff's effects kept together", () => {
    const three = [e("a", "atk"), e("a", "damageBonus"), e("a", "atk"), e("a", "damageBonus"), e("a", "atk"), e("a", "damageBonus"), e("b", "atk", 0.2)];
    const plain = boundarySubsets(three);
    expect(plain.map((s) => s.label)).toEqual([null, "boundary buffs applied: a", "boundary buffs applied: a (refreshed instances once)", "boundary buffs applied: b", "boundary buffs applied", "boundary buffs applied (refreshed instances once)"]);
    // a ×1 (with or without b) is the refreshed-once reading already; a ×2 is new.
    const more = boundarySubsets(three, true);
    expect(more.map((s) => [s.label, s.effects.length])).toEqual([
      ["boundary buffs applied: a ×2 of 3", 4],
      ["boundary buffs applied: a ×2 of 3, b", 5],
    ]);
    expect(boundarySubsets([e("a", "atk"), e("b", "atk")], true)).toEqual([]);
    expect(boundarySubsets([], true)).toEqual([]);
  });

  it("matches a hit that used two of three layers starting at its instant", () => {
    const h = hit("h", ["k"]);
    const g = withKit({ skills: [battle([h])] });
    const layer = (): LogEffect => ({ buff: "buff_test_layer", zone: "damageBonus", element: "fire", value: 0.05 });
    const v = checkLog(g, fixture([logHit(1000, "k", damage(g, h, [{ zone: "damageBonus", element: "fire", value: 0.1, source: "test" }]), { boundaryEffects: [layer(), layer(), layer()] })]));
    expect(assumed(v[0])).toEqual(["boundary buffs applied: buff_test_layer ×2 of 3"]);
  });

  it("4e5e t=13314: all five of Rossi's hits under three new Lupine Scarlet layers match, without a hand annotation", () => {
    const fx = fixtureFile("4e5e1390085e");
    const at = fx.hits.filter((x) => x.t === 13314 && x.operator === "chr_0028_wulfa");
    expect(at.every((x) => x.unquantified.length === 0)).toBe(true);
    // The whole log: the replay takes the Link stack Rossi's battle skill carries from Camille's combo before.
    const v = checkLog(data, fx).filter((x) => at.includes(x.hit));
    expect(v.map((x) => x.kind)).toEqual(["match", "match", "match", "match", "match"]);
  });
});

describe("cast placement takes other operators' time stops out of the time between landings", () => {
  it("counts each frame at the lowest scale of the stops then", () => {
    const stop = { start: 30, scales: Array.from({ length: 30 }, () => 0), operator: op, skillId: "x" };
    expect(worldMs(0, 3000, [])).toBe(3000);
    expect(worldMs(0, 3000, [stop])).toBeCloseTo(2000, 6);
    expect(worldMs(0, 3000, [stop, { ...stop, start: 45, scales: stop.scales.map(() => 0.5) }])).toBeCloseTo(2000 - 250, 6);
    expect(worldMs(2500, 3000, [stop])).toBe(500);
  });

  it("b7b3: Tangtang's battle skill from 11.3 s keeps its last ticks (17055 ms) across Jsspsi's combo and Last Rite's ultimate", () => {
    const fx = fixtureFile("b7b3762d5da8");
    const placement = placeHits(data, fx);
    const key = "chr_0027_tangtang_normal_skill_water_projhit_1";
    const first = fx.hits.find((x) => x.event === key);
    const last = fx.hits.filter((x) => x.event === key && x.t === 17055);
    expect(last).toHaveLength(2);
    expect(last.map((x) => placement.hits.get(x)?.cast)).toEqual([placement.hits.get(first as LogHit)?.cast, placement.hits.get(first as LogHit)?.cast]);
    expect(last.map((x) => placement.hits.get(x)?.index)).toEqual([22, 23]);
    expect(checkReactions(data, fx).unlogged).toEqual([]);
  });
});
