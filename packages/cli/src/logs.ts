// Reading and writing log fixtures.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { GameData } from "@efsim/engine";
import { enemiesHit, fetchBattle, sourceCommit, SOURCES, zmdlogsCasts, zmdlogsPoise, zmdlogsToFixture, type LogFixture } from "@efsim/data";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schema = (name: string) => JSON.parse(readFileSync(join(ROOT, "schemas", name), "utf8")) as object;
  ajv.addSchema(schema("build.schema.json"));
  return { ajv, validate: ajv.compile(schema("log-fixture.schema.json")) };
}

/**
 * Where the log fixtures live, under the repository root: the verified logs, the pending ones (not verified yet) and
 * the multi-target ones (not checked: the engine is single-target). Hold-out logs live apart, in HOLDOUT_DIR: they're
 * only ever measured in aggregate, never opened, listed or debugged (docs/accuracy-plan.md, "Choosing logs"). Nothing
 * that lists logs for development reads that directory, so a glob over these never touches a hold-out.
 */
export const LOG_DIRS = { verified: "fixtures", pending: "fixtures/pending", multi: "fixtures/multi-target" } as const;
export type LogDir = keyof typeof LOG_DIRS;
export const HOLDOUT_DIR = "fixtures/holdout";
/** The split of the logs imported since 2026-11-14 into development and hold-out ids. Read by code, never by eye. */
export const SPLIT_FILE = `${HOLDOUT_DIR}/holdout.json`;

/** The split's two id lists (zmdlogs-…); empty when there is no split file. */
export function readLogSplit(root: string = ROOT): { readonly development: readonly string[]; readonly holdout: ReadonlySet<string> } {
  const file = join(root, SPLIT_FILE);
  if (!existsSync(file)) return { development: [], holdout: new Set() };
  const s = JSON.parse(readFileSync(file, "utf8")) as { development: string[]; holdout: string[] };
  return { development: s.development, holdout: new Set(s.holdout) };
}

/** Throws when `id` (a battle id, or a fixture id zmdlogs-…, whole or a prefix of 6+ characters) is a hold-out log's. */
export function refuseHoldout(id: string, root: string = ROOT): void {
  const key = id.startsWith("zmdlogs-") ? id : `zmdlogs-${id}`;
  const short = key.slice(0, "zmdlogs-".length + 12);
  if (short.length < "zmdlogs-".length + 6) return;
  if ([...readLogSplit(root).holdout].some((h) => h === short || h.startsWith(short))) {
    throw new Error(`${id} is a hold-out log: it's only measured in aggregate, never opened (docs/accuracy-plan.md, "Choosing logs")`);
  }
}

/** Throws when a fixture path is in HOLDOUT_DIR or names a hold-out log (refuseHoldout). */
export function refuseHoldoutFile(file: string, root: string = ROOT): void {
  if (resolve(file).startsWith(resolve(root, HOLDOUT_DIR) + "/")) throw new Error(`${file}: ${HOLDOUT_DIR} holds the hold-out logs: they're only measured in aggregate, never opened`);
  refuseHoldout(basename(file).replace(/\.json$/, ""), root);
}

/** A development log fixture (readLogFixture), refusing a hold-out (the CLI's `zmdlogs check` and the like). */
export function readDevFixture(file: string): LogFixture {
  refuseHoldoutFile(file);
  return readLogFixture(file);
}

/**
 * Every development log fixture under `dirs` (zmdlogs-*.json, one level deep), as absolute paths, sorted. Never a
 * hold-out: HOLDOUT_DIR is refused, and a file whose id the split lists as a hold-out is left out wherever it is.
 */
export function logFixtureFiles(root: string = ROOT, dirs: readonly string[] = Object.values(LOG_DIRS)): string[] {
  if (dirs.some((d) => resolve(root, d) === resolve(root, HOLDOUT_DIR))) throw new Error(`${HOLDOUT_DIR} holds the hold-out logs: they're never listed`);
  const { holdout } = readLogSplit(root);
  return dirs.flatMap((d) => {
    let names: string[];
    try {
      names = readdirSync(join(root, d));
    } catch {
      return [];
    }
    return names
      .filter((f) => /^zmdlogs-.*\.json$/.test(f) && !holdout.has(basename(f, ".json")))
      .sort()
      .map((f) => join(root, d, f));
  });
}

/** One development log, as `efsim zmdlogs list` shows it. */
export interface LogSummary {
  readonly id: string;
  /** The path relative to the repository root. */
  readonly file: string;
  readonly dir: LogDir;
  readonly enemy: string;
  readonly team: readonly { readonly operator: string; readonly potential: number | undefined; readonly weapon: string | undefined }[];
  readonly hits: number;
  readonly casts: number;
  /** The last logged hit's time, s (the log's t is in ms). */
  readonly seconds: number;
}

/**
 * The development logs (never a hold-out: logFixtureFiles), optionally only those whose team has every operator of
 * `withOperators` (an id, or text found in the operator's name by `names`, case-insensitive).
 */
export function listLogs(opts: { readonly root?: string; readonly dirs?: readonly LogDir[]; readonly withOperators?: readonly string[]; readonly names?: (operator: string) => string | undefined } = {}): LogSummary[] {
  const root = opts.root ?? ROOT;
  const out: LogSummary[] = [];
  for (const dir of opts.dirs ?? (Object.keys(LOG_DIRS) as LogDir[])) {
    for (const file of logFixtureFiles(root, [LOG_DIRS[dir]])) {
      const fx = JSON.parse(readFileSync(file, "utf8")) as LogFixture;
      const ops = fx.team.map((b) => b.operator);
      const has = (w: string) => ops.some((op) => op === w || (opts.names?.(op) ?? "").toLowerCase().includes(w.toLowerCase()));
      if (opts.withOperators && !opts.withOperators.every(has)) continue;
      out.push({
        id: fx.id,
        file: relative(root, file),
        dir,
        enemy: `${fx.enemy.id} L${fx.enemy.level}`,
        team: fx.team.map((b) => ({ operator: b.operator, potential: b.potential, weapon: b.weapon?.id })),
        hits: fx.hits.length,
        casts: fx.casts?.length ?? 0,
        seconds: fx.hits.reduce((m, h) => Math.max(m, h.t), 0) / 1000,
      });
    }
  }
  return out;
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
export async function importBattle(data: GameData, battleId: string, enemyLevel?: number, notes: readonly string[] = [], detailFile?: string, keepDetail?: (detail: unknown) => void): Promise<string> {
  refuseHoldout(battleId);
  const { detail, exported } = await fetchBattle(battleId, detailFile === undefined ? undefined : (JSON.parse(readFileSync(detailFile, "utf8")) as unknown));
  // The raw detail, kept where the caller says (the CLI: the git-ignored cache, zmdraw.ts), for questions a fixture can't answer.
  keepDetail?.(detail);
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
        // The level is from the stage, not assumed.
        ...fx.provenance.notes.filter((n) => !(fromStage && n === `Enemy level ${level} is assumed, not logged.`)),
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

/**
 * Adds what a battle's detail records that older imports of it lack, from an already downloaded /api/battles/<id>
 * response (no network), with a provenance note: the casts without damage (zmdlogsCasts, 2026-10-25) and each hit's
 * Stagger (LogHit.poise, zmdlogsPoise, 2026-10-26; with the skill it's credited to since 2026-11-16). Returns how many casts and Stagger-dealing hits it has.
 */
export function refreshFixture(file: string, detailFile: string, keepDetail?: (detail: unknown) => void): { casts: number; poise: number } {
  const fx = readLogFixture(file);
  const detail: unknown = JSON.parse(readFileSync(detailFile, "utf8"));
  const id = (detail as { battle?: { id?: string } }).battle?.id;
  if (id !== fx.provenance.battleId) throw new Error(`${detailFile} is battle ${String(id)}, not ${fx.provenance.battleId}`);
  keepDetail?.(detail);
  const casts = zmdlogsCasts(detail, fx.team.map((b) => b.operator));
  const poise = zmdlogsPoise(detail, fx.hits);
  const hits = fx.hits.map((h, i) => {
    const { poise: _, ...rest } = h;
    const p = poise[i];
    return p ? { ...rest, poise: p } : rest;
  });
  const added = [
    ...(fx.casts ? [] : ["Casts (the detail's skill events without damage) added from the same battle detail (efsim zmdlogs refresh)."]),
    ...(fx.hits.some((h) => h.poise) ? [] : ["Each hit's Stagger (poise) added 2026-10-26 from the same battle detail (efsim zmdlogs refresh)."]),
    ...(fx.hits.some((h) => h.poise?.origin) || !poise.some((p) => p?.origin) ? [] : ["The skill each Stagger is credited to (poise.origin) added from the same battle detail (efsim zmdlogs refresh)."]),
  ];
  const notes = [...fx.provenance.notes, ...added.filter((n) => !fx.provenance.notes.includes(n))];
  const out: LogFixture = { ...fx, provenance: { ...fx.provenance, notes }, hits, casts };
  const { ajv, validate } = validator();
  if (!validate(out)) throw new Error(`refreshed fixture is invalid: ${ajv.errorsText(validate.errors)}`);
  writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
  return { casts: casts.length, poise: poise.filter(Boolean).length };
}
