// Reading and writing log fixtures.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { GameData } from "@efsim/engine";
import { enemiesHit, fetchBattle, sourceCommit, SOURCES, zmdlogsToFixture, type LogFixture } from "@efsim/data";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schema = (name: string) => JSON.parse(readFileSync(join(ROOT, "schemas", name), "utf8")) as object;
  ajv.addSchema(schema("build.schema.json"));
  return { ajv, validate: ajv.compile(schema("log-fixture.schema.json")) };
}

export function readLogFixture(file: string): LogFixture {
  const { ajv, validate } = validator();
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!validate(raw)) throw new Error(`${file}: ${ajv.errorsText(validate.errors)}`);
  return raw as LogFixture;
}

/**
 * The enemies' level from the fight's stage (DungeonTable, by the log's dungeonContextId): the boss's own entry, or
 * the one level all its enemies share. Undefined when the stage isn't known or doesn't decide it.
 */
function stageEnemyLevel(data: GameData, detail: unknown): { level: number; stage: string } | undefined {
  const battle = (detail as { battle?: { bossKey?: string; dungeonContextId?: string } }).battle;
  const stage = battle?.dungeonContextId;
  const enemies = stage ? data.stages?.[stage] : undefined;
  if (!stage || !enemies?.length) return undefined;
  const own = enemies.find((e) => e.id === battle?.bossKey);
  if (own) return { level: own.level, stage };
  const levels = new Set(enemies.map((e) => e.level));
  return levels.size === 1 ? { level: [...levels][0] as number, stage } : undefined;
}

/** The enemy level whose HP equals the logged total damage, for a full clear of a single-target fight. */
function inferEnemyLevel(data: GameData, detail: unknown): number {
  const battle = (detail as { battle?: { bossKey?: string; totalDamage?: number; clearFlag?: boolean } }).battle;
  const enemy = battle?.bossKey ? data.enemies[battle.bossKey] : undefined;
  if (!enemy || !battle?.clearFlag || typeof battle.totalDamage !== "number") {
    throw new Error("can't infer the enemy level (not a clear, or unknown boss); pass --enemy-level");
  }
  const total = battle.totalDamage;
  const matches = enemy.levels.map((l, i) => ({ level: i + 1, hp: l[1] ?? 0 })).filter((x) => Math.abs(x.hp - total) <= x.hp * 1e-4);
  if (matches.length !== 1) throw new Error(`total damage ${total} doesn't match exactly one level's HP of ${enemy.id}; pass --enemy-level`);
  return (matches[0] as { level: number }).level;
}

/**
 * Imports a battle as a log fixture. The enemy level comes from --enemy-level, the stage (DungeonTable), or the total
 * damage on a single-target clear. A fight against several enemies goes to fixtures/multi-target/ with each hit's
 * target (90 assumed when the stage doesn't say).
 */
export async function importBattle(data: GameData, battleId: string, enemyLevel?: number, notes: readonly string[] = [], detailFile?: string): Promise<string> {
  const { detail, exported } = await fetchBattle(battleId, detailFile === undefined ? undefined : (JSON.parse(readFileSync(detailFile, "utf8")) as unknown));
  const enemies = enemiesHit(detail);
  const multi = enemies.length > 1;
  const fromStage = enemyLevel === undefined ? stageEnemyLevel(data, detail) : undefined;
  const level = enemyLevel ?? fromStage?.level ?? (multi ? 90 : inferEnemyLevel(data, detail));
  const fx = zmdlogsToFixture(
    battleId,
    detail,
    exported,
    {
      skillGroup: (op, skill) => data.operators[op]?.skillGroups[skill],
      weaponSkills: (w) => data.weapons[w]?.skills,
    },
    level,
  );
  const withCommits: LogFixture = {
    ...fx,
    provenance: {
      ...fx.provenance,
      verifiedAgainst: Object.fromEntries(SOURCES.map((s) => [s, sourceCommit(s)])),
      notes: [
        ...fx.provenance.notes,
        ...(fromStage ? [`Enemy level ${fromStage.level} from the stage's DungeonTable entry (${fromStage.stage}).`] : []),
        ...(multi ? [`Multi-target: hits landed on ${enemies.join(", ")}; each hit names its target (enemies of one type aren't told apart). The engine doesn't model several targets yet, so the log check doesn't run this fixture.`] : []),
        ...notes,
      ],
    },
  };
  const { ajv, validate } = validator();
  if (!validate(withCommits)) throw new Error(`generated fixture is invalid: ${ajv.errorsText(validate.errors)}`);
  const file = join(ROOT, "fixtures", ...(multi ? ["multi-target"] : []), `${fx.id}.json`);
  writeFileSync(file, JSON.stringify(withCommits, null, 1) + "\n");
  return file;
}
