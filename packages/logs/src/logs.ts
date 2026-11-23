// Reading and writing log fixtures.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Build, GameData } from "@efsim/engine";
import { loadGameData, operatorId, sourceCommit, SOURCES } from "@efsim/data";
import { enemiesHit, fetchBattle, zmdlogsCasts, zmdlogsHits, zmdlogsToFixture, type BuildOverride, type LogEffect, type LogFixture, type LogHit } from "./zmdlogs.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

let compiled: { ajv: Ajv2020; validate: ReturnType<Ajv2020["compile"]> } | undefined;

/** The fixture schema's validator, compiled once per process (a scan over every log read each file through it). */
function validator() {
  if (compiled) return compiled;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schema = (name: string) => JSON.parse(readFileSync(join(ROOT, "schemas", name), "utf8")) as object;
  ajv.addSchema(schema("build.schema.json"));
  compiled = { ajv, validate: ajv.compile(schema("log-fixture.schema.json")) };
  return compiled;
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

/** A development log fixture (readLogFixture) from a path or an id (resolveFixture), refusing a hold-out (the CLI's `zmdlogs check` and the like). */
export function readDevFixture(fileOrId: string): LogFixture {
  return readLogFixture(resolveFixture(fileOrId));
}

/** A fixture id's short form, as the docs cite logs: the first four characters of the battle id ("0c14"). */
export function shortId(id: string): string {
  return id.replace(/^zmdlogs-/, "").slice(0, 4);
}

/**
 * A development log's fixture file from what a command was given: a path (anything with a "/" or ending in .json),
 * refused when it's a hold-out's (refuseHoldoutFile); else an id, whole or a unique start of it (zmdlogs- optional,
 * 4+ characters: "0c14", "zmdlogs-0c14fb3c"), among the development logs only (logFixtureFiles: verified, pending,
 * multi-target; never a hold-out).
 */
export function resolveFixture(arg: string, root: string = ROOT): string {
  if (arg.includes("/") || arg.endsWith(".json")) {
    refuseHoldoutFile(arg, root);
    return arg;
  }
  const id = arg.replace(/^zmdlogs-/, "");
  if (id.length < 4) throw new Error(`${arg}: give at least four characters of a log's id (efsim zmdlogs list)`);
  const hits = logFixtureFiles(root).filter((f) => basename(f, ".json").startsWith(`zmdlogs-${id}`));
  if (hits.length === 1) return hits[0] as string;
  if (!hits.length) throw new Error(`${arg}: no development log's id starts with it (efsim zmdlogs list)`);
  throw new Error(`${arg}: ${hits.length} development logs' ids start with it (${hits.map((f) => basename(f, ".json")).join(", ")}): give more of it`);
}

/**
 * The files a command's fixture arguments name (each a path or an id: resolveFixture), plus those listed one per line
 * in `fromFile` (--fixtures-from; "#" starts a comment); never a hold-out.
 */
export function resolveFixtures(named: readonly string[], fromFile?: string, root: string = ROOT): string[] {
  const listed = fromFile === undefined ? [] : readFileSync(fromFile, "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
  return [...named, ...listed].map((a) => resolveFixture(a, root));
}

/** Whether a fixture file is a multi-target log (fixtures/multi-target/: the log check doesn't run it, the engine being single-target). */
export function isMultiTarget(file: string, root: string = ROOT): boolean {
  return resolve(file).startsWith(resolve(root, LOG_DIRS.multi) + "/");
}

/** One development log for a scan over the logs (devFixtures): its file, id, short id, directory and fixture. */
export interface DevFixture {
  readonly file: string;
  readonly id: string;
  readonly short: string;
  readonly dir: LogDir;
  readonly fx: LogFixture;
}

/**
 * The development logs as fixtures, for scratch scripts and scans (never a hold-out: logFixtureFiles): by default the
 * verified and pending ones (the checked logs), `dirs` to choose (multi: the multi-target ones), `ids` to name some
 * (resolveFixture), `withOperators` only those whose team has every one of them (operator ids, or names: "Arcane",
 * resolved by @efsim/data operatorId, which refuses an unknown or ambiguous one).
 */
export function devFixtures(opts: { readonly dirs?: readonly LogDir[]; readonly ids?: readonly string[]; readonly withOperators?: readonly string[]; readonly root?: string } = {}): DevFixture[] {
  const root = opts.root ?? ROOT;
  const dirs = opts.dirs ?? (["verified", "pending"] as const);
  const files = opts.ids?.length ? opts.ids.map((a) => resolveFixture(a, root)) : dirs.flatMap((d) => logFixtureFiles(root, [LOG_DIRS[d]]));
  const withOperators = opts.withOperators?.map((op) => (/^chr_\d+_/.test(op) ? op : operatorId(loadGameData(), op)));
  const dirOf = (f: string): LogDir => (isMultiTarget(f, root) ? "multi" : resolve(dirname(f)) === resolve(root, LOG_DIRS.pending) ? "pending" : "verified");
  return files.flatMap((file) => {
    const fx = readLogFixture(file);
    if (withOperators?.length && !withOperators.every((op) => fx.team.some((b) => b.operator === op))) return [];
    return [{ file, id: fx.id, short: shortId(fx.id), dir: dirOf(file), fx }];
  });
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
  return withBuildOverrides(readLogFixtureRaw(file));
}

/** A fixture as written: `team` as exported, its buildOverrides not applied (for tools that rewrite the file). */
export function readLogFixtureRaw(file: string): LogFixture {
  const { ajv, validate } = validator();
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!validate(raw)) throw new Error(`${file}: ${ajv.errorsText(validate.errors)}`);
  return raw as LogFixture;
}

/** A build with overrides set over it (LogFixture.buildOverrides): `weapon`'s fields over the build's weapon. */
export function overrideBuild(b: Build, set: BuildOverride["set"]): Build {
  const { weapon, ...rest } = set;
  if (weapon && !b.weapon) throw new Error(`${b.operator}: a weapon override, but the build has no weapon`);
  return { ...b, ...rest, ...(weapon && b.weapon ? { weapon: { ...b.weapon, ...weapon } } : {}) };
}

/** The fixture with its buildOverrides set over `team` (each operator's in order); unchanged without any. */
export function withBuildOverrides(fx: LogFixture): LogFixture {
  const overrides = fx.buildOverrides;
  if (!overrides?.length) return fx;
  for (const o of overrides) if (!fx.team.some((b) => b.operator === o.operator)) throw new Error(`${fx.id}: a build override for ${o.operator}, who isn't in the team`);
  const team = fx.team.map((b) => overrides.filter((o) => o.operator === b.operator).reduce((acc, o) => overrideBuild(acc, o.set), b));
  return { ...fx, team };
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
 * The fields a refresh adds to a fixture that lacks them (refreshFixture), each with its provenance note: one note per
 * kind. Record-only: the log check reads none of them for a verdict.
 */
const REFRESH_NOTES = {
  casts: "Casts (the detail's skill events without damage) added from the same battle detail (efsim zmdlogs refresh).",
  poise: "Each hit's Stagger (poise) added from the same battle detail (efsim zmdlogs refresh).",
  "poise.origin": "The skill each Stagger is credited to (poise.origin) added from the same battle detail (efsim zmdlogs refresh).",
  source: "Each buff effect's giver (effects' and boundaryEffects' source) added from the same battle detail (efsim zmdlogs refresh).",
  since: "Each buff effect's start (effects' and boundaryEffects' since) added from the same battle detail (efsim zmdlogs refresh).",
} as const;
export type RefreshedField = keyof typeof REFRESH_NOTES;

/** A refresh refused: the detail isn't what the fixture was imported from (or the importer reads it differently now). */
export class RefreshMismatch extends Error {}

export interface RefreshResult {
  readonly casts: number;
  /** Hits that dealt Stagger. */
  readonly poise: number;
  /** The kinds of field the fixture lacked and now has. */
  readonly added: readonly RefreshedField[];
  /** The detail's parserVersion when it isn't the fixture's (ZMDLogs re-parsed the upload; the hits still matched). */
  readonly parserVersion?: string;
}

type EffectLike = { readonly source?: string; readonly since?: number };
const effectsOfHit = (h: LogHit): readonly EffectLike[] => [...h.effects, ...h.boundaryEffects];

/** A hit without the fields in `drop` (a fixture lacks them, so they aren't compared), for the refresh's comparison. */
function comparable(h: LogHit, drop: ReadonlySet<RefreshedField>): unknown {
  const effect = (e: LogEffect): LogEffect => {
    const { source, since, ...rest } = e;
    return { ...rest, ...(source !== undefined && !drop.has("source") ? { source } : {}), ...(since !== undefined && !drop.has("since") ? { since } : {}) };
  };
  const { poise, ...rest } = h;
  const kept = drop.has("poise") || !poise ? undefined : drop.has("poise.origin") ? { dealt: poise.dealt, bar: poise.bar } : poise;
  return { ...rest, effects: h.effects.map(effect), boundaryEffects: h.boundaryEffects.map(effect), ...(kept ? { poise: kept } : {}) };
}

/**
 * Adds what a battle's detail records that an older import of it lacks, from the /api/battles/<id> response (no
 * network here: the CLI reads it from --detail or the raw cache, zmdraw.ts), with one provenance note per added kind
 * (REFRESH_NOTES): the casts without damage (zmdlogsCasts, 2026-10-25), each hit's Stagger (LogHit.poise, 2026-10-26)
 * and the skill it's credited to (poise.origin), each buff effect's giver and start (LogEffect.source / since,
 * 2026-11-16). The hits are rebuilt as an import would (zmdlogsHits) and must equal the fixture's but for the fields
 * it lacks, and logged casts it has must equal the detail's: otherwise it throws RefreshMismatch and writes nothing.
 * The team (from the export, a second request), the enemy level and the notes an import writes aren't touched.
 */
export function refreshFixture(file: string, detail: unknown, keepDetail?: (detail: unknown) => void): RefreshResult {
  const fx = readLogFixtureRaw(file);
  const battle = (detail as { battle?: { id?: string; parserVersion?: string } }).battle;
  if (battle?.id !== fx.provenance.battleId) throw new Error(`the detail is battle ${String(battle?.id)}, not ${fx.provenance.battleId}`);
  keepDetail?.(detail);
  const fresh = zmdlogsHits(detail);
  const total = (hs: readonly LogHit[]) => hs.reduce((s, h) => s + h.value, 0);
  if (fresh.length !== fx.hits.length) {
    throw new RefreshMismatch(`the detail has ${fresh.length} damage events (total ${total(fresh)}), the fixture ${fx.hits.length} hits (total ${total(fx.hits)})`);
  }
  const has = (f: RefreshedField, hs: readonly LogHit[]): boolean => {
    if (f === "source" || f === "since") return hs.some((h) => effectsOfHit(h).some((e) => e[f] !== undefined));
    if (f === "poise") return hs.some((h) => h.poise);
    if (f === "poise.origin") return hs.some((h) => h.poise?.origin);
    return false;
  };
  const hitFields = ["poise", "poise.origin", "source", "since"] as const;
  const lacking = new Set<RefreshedField>(hitFields.filter((f) => !has(f, fx.hits)));
  const differing = new Map<string, number>();
  const examples: string[] = [];
  fx.hits.forEach((h, i) => {
    const a = comparable(h, lacking) as Record<string, unknown>;
    const b = comparable(fresh[i] as LogHit, lacking) as Record<string, unknown>;
    if (isDeepStrictEqual(a, b)) return;
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !isDeepStrictEqual(a[k], b[k]));
    for (const k of keys) differing.set(k, (differing.get(k) ?? 0) + 1);
    if (examples.length < 3) examples.push(`hit ${i} (${h.t} ms ${h.event}): ${keys.join(", ")}`);
  });
  if (differing.size > 0) {
    throw new RefreshMismatch(`the detail's hits differ from the fixture's: ${[...differing].map(([k, n]) => `${k} on ${n} hit(s)`).join(", ")}; e.g. ${examples.join("; ")}`);
  }
  const casts = zmdlogsCasts(detail, fx.team.map((b) => b.operator));
  if (fx.casts && !isDeepStrictEqual(fx.casts, casts)) throw new RefreshMismatch(`the detail has ${casts.length} casts, the fixture ${fx.casts.length}, or they differ`);
  const added: RefreshedField[] = [...(fx.casts ? [] : (["casts"] as const)), ...[...lacking].filter((f) => has(f, fresh))];
  const notes = [...fx.provenance.notes, ...added.map((f) => REFRESH_NOTES[f]).filter((n) => !fx.provenance.notes.includes(n))];
  const out: LogFixture = { ...fx, provenance: { ...fx.provenance, notes }, hits: fresh, casts };
  const { ajv, validate } = validator();
  if (!validate(out)) throw new Error(`refreshed fixture is invalid: ${ajv.errorsText(validate.errors)}`);
  writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
  return {
    casts: casts.length,
    poise: fresh.filter((h) => h.poise).length,
    added,
    ...(battle.parserVersion !== undefined && battle.parserVersion !== fx.provenance.parserVersion ? { parserVersion: battle.parserVersion } : {}),
  };
}

