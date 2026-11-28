// `efsim zmdlogs screen` (round 22, the Estella-Akekuri report point 1): docs/accuracy-plan.md "Choosing logs" as checks
// on a candidate battle's detail, before `zmdlogs import`: parser v59 or later, every operator level 90 with a kit, one
// main target, the stage in DungeonTable and the enemy in the data with the facts kits read (rank, Stagger nodes, super
// armor), the fight's length and clear; a hold-out or an existing development fixture is said as yes / no only, and
// the uploader's account only as a count of the cached development details it uploaded (never its id or name). Every
// import round wrote these as scratch scripts (2026-11-08, 11-13, 11-28: five of them for 14 candidates).
//
// The output stays on the terminal: a candidate's battle id is the caller's own input, no account name or id is ever
// printed, and nothing is written but the raw cache (zmdraw.ts) a fetch fills. A hold-out is refused before its detail
// is read or fetched.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { GameData } from "@efsim/engine";
import { enemiesHit } from "./zmdlogs.ts";
import { missingEnemyFacts } from "./enemyfacts.ts";
import { logFixtureFiles, refuseHoldout } from "./logs.ts";

/** One rule's verdict on a candidate (ok null: can't say from what was read). */
export interface ScreenCheck {
  readonly rule: string;
  readonly ok: boolean | null;
  readonly text: string;
  /** Required by "Choosing logs" (else preferred). */
  readonly required: boolean;
  /** Information only (the builds): no verdict. */
  readonly info?: true;
}

/** A candidate's screen: usable (every required rule passes), not usable (which), or not read (a hold-out, no detail). */
export interface ScreenRow {
  readonly battleId: string;
  readonly verdict: "usable" | "not usable" | "hold-out (refused, not read)" | "no detail";
  readonly checks: readonly ScreenCheck[];
}

/** The parser version "Choosing logs" requires (the 1.6 tables). */
export const SCREEN_MIN_PARSER = 59;
/** The fight lengths "Choosing logs" prefers (s). */
export const SCREEN_LENGTH_S = [30, 150] as const;
/** At most this many development logs per account (preferred). */
export const SCREEN_PER_ACCOUNT = 2;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : {});

/** The uploader (battle.uploaderUserId) of a detail, for counting only. */
const uploaderOf = (detail: unknown): string | null => {
  const u = obj(obj(detail)["battle"])["uploaderUserId"];
  return typeof u === "string" || typeof u === "number" ? String(u) : null;
};

/**
 * The cached details of development fixtures per uploader (opaque keys and battle ids, for counting only; zmdraw.ts's
 * cache: import and refresh fill it, so a development log never imported here isn't counted). `dir`: the raw cache.
 */
export function developmentUploads(dir: string, root?: string): Map<string, ReadonlySet<string>> {
  const dev = new Set(logFixtureFiles(root).map((f) => basename(f).replace(/\.json$/, "")));
  const out = new Map<string, Set<string>>();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const m = /^btl_upload_([a-z0-9]+)\.json$/.exec(name);
    if (!m || !dev.has(`zmdlogs-${m[1]}`)) continue;
    const u = readUploader(join(dir, name));
    if (u !== null) out.set(u, new Set([...(out.get(u) ?? []), `btl_upload_${m[1]}`]));
  }
  return out;
}

/** A cached detail's uploader, or null (unreadable, or none). */
function readUploader(file: string): string | null {
  try {
    return uploaderOf(JSON.parse(readFileSync(file, "utf8")) as unknown);
  } catch {
    return null;
  }
}

/** The enemy ids a detail's damage hits landed on (zmdlogs.ts enemiesHit), none where it can't read them. */
function enemiesOf(detail: unknown): string[] {
  try {
    return enemiesHit(detail);
  } catch {
    return [];
  }
}

/** The development fixture a battle already is (its dir and file name), or null. */
export function existingFixture(battleId: string, root?: string): string | null {
  const id = `zmdlogs-${battleId.replace(/^btl_upload_/, "")}`;
  return logFixtureFiles(root).find((f) => basename(f) === `${id}.json`) ?? null;
}

/** Whether a battle is a hold-out's (refuseHoldout), without saying more. */
export function isHoldout(battleId: string, root?: string): boolean {
  try {
    refuseHoldout(battleId.replace(/^btl_upload_/, ""), root);
    return false;
  } catch {
    return true;
  }
}

/** The rules' checks on one candidate's detail. `uploads`: developmentUploads; `fixture`: existingFixture. */
export function screenDetail(data: GameData, battleId: string, detail: unknown, ctx: { readonly uploads?: ReadonlyMap<string, ReadonlySet<string>>; readonly fixture?: string | null } = {}): ScreenRow {
  const battle = obj(obj(detail)["battle"]);
  const checks: ScreenCheck[] = [];
  const add = (rule: string, ok: boolean | null, text: string, required = true, info = false) => checks.push({ rule, ok, text, required, ...(info ? { info: true as const } : {}) });
  if (battle["id"] !== undefined && battle["id"] !== battleId) add("detail", false, `the detail is another battle's (${String(battle["id"])})`);
  const parser = typeof battle["parserVersion"] === "string" ? battle["parserVersion"] : null;
  const pv = parser ? Number(/v(\d+)/.exec(parser)?.[1]) : NaN;
  add("parser", Number.isFinite(pv) ? pv >= SCREEN_MIN_PARSER : null, parser ? `${parser} (v${SCREEN_MIN_PARSER} or later: the 1.6 tables)` : "no parser version");
  const roster = Array.isArray(battle["roster"]) ? (battle["roster"] as unknown[]).map(obj) : [];
  if (!roster.length) add("team", null, "no roster in the detail (the export has it: zmdlogs import reads both)");
  const ops = roster.map((r) => ({ op: String(r["characterKey"] ?? "?"), level: typeof r["characterLevel"] === "number" ? r["characterLevel"] : null, potential: r["characterPotential"], weapon: obj(r["weapon"]) }));
  const name = (op: string) => data.operators[op]?.name ?? op;
  if (ops.length) {
    const low = ops.filter((o) => o.level !== 90);
    add("levels", low.some((o) => o.level === null) ? null : low.length === 0, low.length ? `not level 90: ${low.map((o) => `${name(o.op)} ${o.level ?? "?"}`).join(", ")}` : "every operator level 90");
    const noKit = ops.filter((o) => !data.kits.operators[o.op]);
    add("kits", noKit.length === 0, noKit.length ? `no kit: ${noKit.map((o) => name(o.op)).join(", ")}` : "a kit for every operator");
    const weaponText = ops.map((o) => {
      const skills = Array.isArray(o.weapon["skills"]) ? (o.weapon["skills"] as unknown[]).map((x) => obj(x)["level"]) : [];
      const w = typeof o.weapon["weaponTemplate"] === "string" ? o.weapon["weaponTemplate"] : "?";
      const kit = data.kits.equipment[w] ? "" : " (no kit)";
      return `${name(o.op)} P${String(o.potential ?? "?")} ${w}${kit} [${skills.join(", ")}]`;
    });
    add("builds", null, weaponText.join("; "), false, true);
    const weaponNoKit = ops.filter((o) => typeof o.weapon["weaponTemplate"] === "string" && !data.kits.equipment[o.weapon["weaponTemplate"]]);
    if (weaponNoKit.length) add("weapons", false, `a weapon without a kit: ${weaponNoKit.map((o) => `${name(o.op)}'s ${String(o.weapon["weaponTemplate"])}`).join(", ")}`, false);
  }
  const targets = enemiesOf(detail);
  add("targets", targets.length ? targets.length === 1 : null, targets.length === 1 ? "one enemy id (several enemies under one id, as Hard 33's slugs, show only in the hits: severalTargets)" : targets.length ? `${targets.length} enemy ids hit (a multi-target fight: fixtures/multi-target/)` : "no damage event names a target");
  const stage = typeof battle["dungeonContextId"] === "string" ? battle["dungeonContextId"] : null;
  const stageKnown = stage !== null && (data.stages?.[stage]?.length ?? 0) > 0;
  add("stage", stage === null ? null : stageKnown, stage === null ? "no stage in the detail (the level from the total damage on a clear)" : stageKnown ? `${stage} in DungeonTable` : `${stage} isn't in the pinned DungeonTable (its enemies' levels and variants aren't known)`);
  const boss = typeof battle["bossKey"] === "string" ? battle["bossKey"] : null;
  const missing = boss ? missingEnemyFacts(data, boss) : ["no boss in the detail"];
  add("enemy", boss !== null && data.enemies[boss] !== undefined, boss === null ? "no boss in the detail" : missing.length ? `${boss}: ${missing.join("; ")}` : `${boss}: in the data, with rank, Stagger nodes and super armor`);
  const ms = typeof battle["durationMs"] === "number" ? battle["durationMs"] : null;
  add("length", ms === null ? null : ms >= SCREEN_LENGTH_S[0] * 1000 && ms <= SCREEN_LENGTH_S[1] * 1000, ms === null ? "no length" : `${(ms / 1000).toFixed(1)} s (${SCREEN_LENGTH_S[0]}–${SCREEN_LENGTH_S[1]} s)`, false);
  add("clear", battle["clearFlag"] === true, battle["clearFlag"] === true ? "a clear" : "not a clear (the enemy's level from the stage only)", false);
  const u = uploaderOf(detail);
  if (ctx.uploads) {
    // Its other development logs: itself left out where it is one.
    const n = u !== null ? [...(ctx.uploads.get(u) ?? [])].filter((b) => b !== battleId).length : null;
    add("account", n === null ? null : n < SCREEN_PER_ACCOUNT, n === null ? "no uploader in the detail" : `its account has ${n} other cached development log(s) (at most ${SCREEN_PER_ACCOUNT} per account)`, false);
  }
  if (ctx.fixture !== undefined) add("fixture", ctx.fixture === null, ctx.fixture === null ? "not a fixture yet" : `already a development fixture (${basename(ctx.fixture)})`);
  const failed = checks.filter((c) => c.required && c.ok === false);
  return { battleId, verdict: failed.length ? "not usable" : "usable", checks };
}

/** A screen row as text lines: the verdict, then each rule (✓ passes, ✗ fails, ? can't say; "preferred" for the soft ones). */
export function screenLines(r: ScreenRow): string[] {
  const mark = (c: ScreenCheck) => (c.info ? " - " : c.ok === true ? "ok " : c.ok === false ? "NO " : " ? ");
  return [`${r.battleId}: ${r.verdict}`, ...r.checks.map((c) => `  ${mark(c)} ${c.rule.padEnd(8)} ${c.text}${c.required || c.info ? "" : " (preferred)"}`)];
}
