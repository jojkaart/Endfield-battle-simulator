// The buff timing report (packages/logs/src/bufftiming.ts, `efsim zmdlogs timing`): a diagnostic, never scored. A
// synthetic log whose numbers the engine computes itself has a team ATK buff act ~3 s longer than the kit's 10 s; the
// report recovers the shifted end from the damage alone, and reading it changes no verdict.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeHit, computeStats, roundDamage, type Build, type GameData, type KitBuff, type KitHit, type KitSkill, type KitTrigger, type Modifier, type OperatorKit } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { type LogEffect, type LogFixture, type LogHit } from "@efsim/logs";
import { checkLog, readLogFixture, verdictCount } from "@efsim/cli";
import { fixtureTiming, formatTimingReport, placeToggle, timingSummaries } from "../packages/logs/src/bufftiming.ts";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const panel = computeStats(data, build);
const target = { enemy: "eny_0051_rodin", level: 90 };
const BATTLE = "chr_0016_laevat_normal_skill";
const BASIC = "chr_0016_laevat_attack1";
const GAME_BUFF = "buff_test_atk";

const hit = (id: string, events: string[], extra: Partial<KitHit> = {}): KitHit => ({ id, label: id, scale: ["atk_scale"], count: 1, events, damageType: "battle", element: "fire", frames: [0], ...extra });
const h = hit("h", ["k"]);
const b = hit("b", ["b"], { damageType: "basic" });
// Team ATK +10% for 10 s on each battle-skill cast, standing for a game buff the log lists.
const buff: KitBuff = { id: "t_atk", label: "test ATK", target: "team", gameBuff: GAME_BUFF, duration: 10, modifiers: [{ zone: "atk", value: 0.1 }] };
const onCast: KitTrigger = { id: "t_on_cast", on: { event: "cast", skills: [BATTLE] }, by: "self", do: [{ kind: "buff", buff: "t_atk" }] };
const g: GameData = {
  ...data,
  kits: {
    ...data.kits,
    operators: { ...data.kits.operators, [op]: { ...kit, skills: [{ skillId: BATTLE, label: "battle", kind: "battle", hits: [h] } as KitSkill, { skillId: BASIC, label: "basic", kind: "basic", hits: [b] } as KitSkill], buffs: [...kit.buffs, buff], triggers: [...kit.triggers, onCast] } },
  },
};
const dmg = (skillId: string, x: KitHit, modifiers: Modifier[]) => roundDamage(computeHit(g, build, panel, target, { skillId }, x, { crit: "never", staggered: false, modifiers }).exact);
const plus10: Modifier[] = [{ zone: "atk", value: 0.1, source: "test" }];
const logHit = (t: number, value: number, extra: Partial<LogHit> = {}): LogHit => ({ t, operator: op, event: "b", value, crit: false, element: "fire", effects: [], boundaryEffects: [], unquantified: [], ...extra });
const fixture = (hits: LogHit[]): LogFixture => ({
  id: "synthetic",
  description: "synthetic log",
  provenance: { source: "test", url: "test", battleId: "test", parserVersion: "test", inGame: true, measured: "test", verifiedAgainst: {}, notes: [] },
  enemy: { id: target.enemy, level: target.level },
  team: [build],
  hits,
});
const atk: LogEffect = { buff: GAME_BUFF, zone: "atk", element: null, value: 0.1 };
const KEY = `${op}:t_atk`;

describe("the buff timing report", () => {
  const buffed = dmg(BASIC, b, plus10);
  const plain = dmg(BASIC, b, []);
  // The battle skill at 1 s starts the buff (the engine: to 11 s); the game's lasted ~3 s longer: the basic attacks at 13,
  // 13.5 and 14 s carry it, farther from the engine's end than the check's boundary toggles reach (0.5 s + 10% of 10 s).
  const shifted = [logHit(13000, buffed), logHit(13500, buffed), logHit(14000, buffed)];
  const base = [logHit(1000, dmg(BATTLE, h, plus10), { event: "k", boundaryEffects: [atk] }), logHit(5000, buffed, { effects: [atk] })];
  const fx = fixture([...base, ...shifted, logHit(20000, plain)]);

  it("recovers a buff's end shifted past the check's 500 ms toggles, as one pattern with its offsets", () => {
    expect(buffed).toBeGreaterThan(plain + 10);
    const before = checkLog(g, fx).map(verdictCount);
    expect(before).toEqual(["plain", "plain", "mismatch", "mismatch", "mismatch", "plain"]);
    const r = fixtureTiming(g, fx);
    expect(r.hits.map((x) => x.hit.t)).toEqual([13000, 13500, 14000]);
    for (const x of r.hits) {
      const best = x.fits[0]?.toggles[0];
      expect(best?.kitBuff).toBe(KEY);
      expect(best?.direction).toBe("endsLater");
      expect(best?.edgeMs).toBeCloseTo(11000, -2);
      expect(x.fits[0]?.predicted).toBe(buffed);
    }
    expect(r.hits.map((x) => Math.round((x.fits[0]?.toggles[0]?.offsetMs ?? 0) / 100) / 10)).toEqual([2, 2.5, 3]);
    expect(r.patterns).toHaveLength(1);
    const p = r.patterns[0];
    expect(p?.kitBuff).toBe(KEY);
    expect(p?.hits).toHaveLength(3);
    expect(p?.against).toBe(0);
    expect(p?.stake).toBe(3 * (buffed - plain));
    // The kit's trigger behind it is listed, with the cast that fires it (the window reaches back from its end only 2 s,
    // so the cast at 1 s isn't in it: no mechanism near).
    expect(p?.mechanism.kit.some((k) => k.startsWith("trigger t_on_cast applies it, on cast"))).toBe(true);
    const text = formatTimingReport(g, [r]);
    expect(text).toContain("test ATK: fits if it ended 2.0 s later (the engine ends it at 11.0 s)");
    expect(text).toContain("engine ends it early: 3 hits in 1 run(s)");
    // Reading it changes no verdict.
    expect(r.verdicts.map(verdictCount)).toEqual(before);
    expect(checkLog(g, fx).map(verdictCount)).toEqual(before);
  });

  it("counts plain matches in a pattern's span that the same change would break as against it", () => {
    // A hit at 12.6 s without the buff (a plain match: the engine ended it at 11 s) contradicts an end after 14 s.
    const fx2 = fixture([...base, logHit(12600, plain), ...shifted, logHit(20000, plain)]);
    const r = fixtureTiming(g, fx2);
    expect(r.patterns[0]?.against).toBe(1);
    expect(timingSummaries([r])[0]?.against).toBe(1);
  });

  it("places a toggle against the engine's windows: ends, starts, missing, extra", () => {
    const w = [{ start: 1000, end: 11000, expired: true }];
    const on = { kitBuff: KEY, how: "engine" as const, before: 0, after: 1 };
    const off = { kitBuff: KEY, how: "off" as const, before: 1, after: 0 };
    expect(placeToggle(w, 13000, on, "x")).toMatchObject({ direction: "endsLater", offsetMs: 2000, edgeMs: 11000 });
    expect(placeToggle(w, 500, on, "x")).toMatchObject({ direction: "startsEarlier", offsetMs: 500, edgeMs: 1000 });
    expect(placeToggle(w, 30000, on, "x")).toMatchObject({ direction: "missing", offsetMs: null });
    expect(placeToggle(w, 10000, off, "x")).toMatchObject({ direction: "endsEarlier", offsetMs: 1000, edgeMs: 11000 });
    expect(placeToggle(w, 2500, off, "x")).toMatchObject({ direction: "startsLater", offsetMs: 1500, edgeMs: 1000 });
    expect(placeToggle([{ start: 0, end: 60000, expired: true }], 30000, off, "x")).toMatchObject({ direction: "extra" });
    expect(placeToggle([], 30000, off, "x")).toMatchObject({ direction: "carried" });
    expect(placeToggle(w, 5000, on, "x")).toMatchObject({ direction: "inactive" });
  });

  it("changes no verdict of a real log", () => {
    const real = readLogFixture(new URL("../fixtures/zmdlogs-4e5e1390085e.json", import.meta.url).pathname);
    const before = checkLog(data, real).map(verdictCount);
    const r = fixtureTiming(data, real);
    expect(r.verdicts.map(verdictCount)).toEqual(before);
    expect(r.hits.every((x) => x.verdict === "fallback" || x.verdict === "mismatch")).toBe(true);
  });
});
