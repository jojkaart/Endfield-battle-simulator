// Reading and writing log fixtures.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { GameData } from "@efsim/engine";
import { fetchBattle, sourceCommit, SOURCES, zmdlogsToFixture, type LogFixture } from "@efsim/data";

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

export async function importBattle(data: GameData, battleId: string, enemyLevel?: number): Promise<string> {
  const { detail, exported } = await fetchBattle(battleId);
  const level = enemyLevel ?? inferEnemyLevel(data, detail);
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
    provenance: { ...fx.provenance, verifiedAgainst: Object.fromEntries(SOURCES.map((s) => [s, sourceCommit(s)])) },
  };
  const { ajv, validate } = validator();
  if (!validate(withCommits)) throw new Error(`generated fixture is invalid: ${ajv.errorsText(validate.errors)}`);
  const file = join(ROOT, "fixtures", `${fx.id}.json`);
  writeFileSync(file, JSON.stringify(withCommits, null, 1) + "\n");
  return file;
}
