// ZMDLogs → log fixture conversion on a synthetic battle.
import { describe, expect, it } from "vitest";
import { enemiesHit, zmdlogsToFixture, type BuildLookups } from "../src/zmdlogs.ts";

const OP = "chr_0021_whiten";
const BOSS = "eny_0051_rodin";

const buff = (key: string, onEnemy: boolean, zone: string, rate: number, element: string | null = null) => ({
  laneType: "buff",
  eventKey: `${key}::1`,
  sourceCharacterKey: "chr_0003_endminf",
  targetCharacterKey: onEnemy ? BOSS : OP,
  targetEnemyKey: onEnemy ? BOSS : null,
  tsMsFromStart: 0,
  actualStartMsFromStart: 0,
  actualEndMsFromStart: 10_000,
  effects: [{ zone, element, rate }],
  dynamicEffects: [],
});

const detail = {
  battle: { id: "btl_upload_test", bossKey: BOSS, parserVersion: "v59", battleStartAt: "2026-10-18T00:00:00Z" },
  timelineEvents: [
    buff("buff_ally_side", false, "vuln_taken", 0.2, "physical"),
    buff("buff_ally_atk", false, "atk", 0.1),
    buff("buff_enemy_side", true, "vuln_taken", 0.15, "physical"),
    {
      laneType: "skill",
      eventKey: "chr_0021_whiten_attack1",
      sourceCharacterKey: OP,
      targetCharacterKey: BOSS,
      targetEnemyKey: BOSS,
      tsMsFromStart: 5000,
      value: 1000,
      damageElement: "physical",
      hitContext: { critical: { status: "verified", isCritical: false } },
    },
  ],
};

const exported = {
  roster: [
    {
      characterKey: OP,
      characterLevel: 90,
      characterPotential: 5,
      skills: ["basic", "battle", "combo", "ultimate"].map((g) => ({ skillKey: g, level: 12 })),
      weapon: { weaponTemplate: "wpn_x", skills: ["a", "b", "c"].map((k) => ({ skillKey: k, level: 9 })) },
      equips: [],
    },
  ],
};

const lookups: BuildLookups = {
  skillGroup: (_op, id) => id,
  weaponSkills: () => ["a", "b", "c"],
};

describe("zmdlogsToFixture", () => {
  const fx = zmdlogsToFixture("btl_upload_test", detail, exported, lookups, 90);

  it("keeps the attacker's own buffs and the enemy's debuffs on a hit", () => {
    const [hit] = fx.hits;
    expect(hit?.effects.map((e) => [e.buff, e.zone, e.value])).toEqual([
      ["buff_ally_atk", "atk", 0.1],
      ["buff_enemy_side", "damageTaken", 0.15],
    ]);
  });

  it("drops damage-taken zones on an operator: they're about damage the operator takes", () => {
    expect(fx.hits[0]?.effects.some((e) => e.buff === "buff_ally_side")).toBe(false);
  });
});

describe("multi-target battles", () => {
  const ADD = "eny_0117_klhound_klbearsummon";
  // Hits name their target in targetCharacterKey only; targetEnemyKey is empty, as in the logs.
  const hitOn = (target: string, t: number) => ({
    laneType: "skill",
    eventKey: "chr_0021_whiten_attack1",
    sourceCharacterKey: OP,
    targetCharacterKey: target,
    targetEnemyKey: null,
    tsMsFromStart: t,
    value: 1000,
    damageElement: "physical",
    hitContext: { critical: { status: "verified", isCritical: false } },
  });
  const multi = { ...detail, timelineEvents: [...detail.timelineEvents.slice(0, 3), hitOn(BOSS, 5000), hitOn(ADD, 6000)] };

  it("finds the enemies hit, and none beside the boss in a single-target fight", () => {
    expect(enemiesHit(multi)).toEqual([BOSS, ADD].sort());
    expect(enemiesHit(detail)).toEqual([BOSS]);
  });

  it("names each hit's target and gives it only that enemy's debuffs", () => {
    const fx = zmdlogsToFixture("btl_upload_test", multi, exported, lookups, 90);
    expect(fx.hits.map((h) => h.target)).toEqual([BOSS, ADD]);
    expect(fx.hits.map((h) => h.effects.map((e) => e.buff))).toEqual([["buff_ally_atk", "buff_enemy_side"], ["buff_ally_atk"]]);
    expect(zmdlogsToFixture("btl_upload_test", detail, exported, lookups, 90).hits[0]).not.toHaveProperty("target");
  });
});
