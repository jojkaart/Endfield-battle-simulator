// ZMDLogs battle logs → log fixtures (fixtures/zmdlogs-*.json). A fixture
// keeps only extracted numbers: each operator's build in our format, and
// each damage hit with the buff effects the log says were active. No player
// names or account IDs (docs/data-sources.md#licences-and-terms-in-short).

import type { Build, Element, Zone } from "@efsim/engine";
import { ELEMENTS } from "@efsim/engine";

/** ZMDLogs zone names → our zones (verified on btl_upload_40d9a3c1da37, see effects.ts). */
export const ZMDLOGS_ZONES: Readonly<Record<string, Zone>> = {
  atk: "atk",
  dmg_inc: "damageBonus",
  amp: "amp",
  fragile: "susceptibility",
  vuln_taken: "damageTaken",
  prod_vuln_taken: "multiplicative",
  res: "ignoreResistance",
  arts_strength: "artsIntensity",
};

/**
 * Zones that act on the target's side. A buff on an operator with one of
 * these is about damage the operator takes (e.g. Endministrator's talent,
 * `vuln_taken` on allies), so it doesn't change the operator's hits.
 */
const TARGET_SIDE_ZONES: ReadonlySet<Zone> = new Set(["susceptibility", "damageTaken", "multiplicative"]);

export interface LogEffect {
  readonly buff: string;
  readonly zone: Zone;
  readonly element: Element | null;
  readonly value: number;
}

export interface LogHit {
  readonly t: number;
  readonly operator: string;
  /** The enemy hit, in a fight against several (multi-target fixtures only; the log can't tell apart enemies of one type). */
  readonly target?: string;
  readonly event: string;
  readonly value: number;
  /** Damage before the target's damage cap, when the cap cut it. */
  readonly uncapped?: number;
  /** Crit flag; null when the log couldn't tell. */
  readonly crit: boolean | null;
  readonly element: Element | null;
  /** Buff effects on the attacker or the target active at this hit. */
  readonly effects: readonly LogEffect[];
  /** Buffs that start or end exactly at this hit; the log can't say whether they applied. */
  readonly boundaryEffects: readonly LogEffect[];
  /**
   * Active buffs whose effect the log can't quantify (it lists their zones
   * without values, e.g. Corrosion's ramping resistance shred). Hits under
   * these only match once the engine models the buff.
   */
  readonly unquantified: readonly { readonly buff: string; readonly since: number; readonly source: string }[];
  /**
   * The Stagger the hit dealt, as the log has it (poiseDamage): `dealt` (positive) and the enemy's Stagger bar
   * after it. Absent on hits that dealt none, and in fixtures imported before 2026-10-26 (zmdlogsPoise).
   */
  readonly poise?: { readonly dealt: number; readonly bar: number };
}

export interface LogFixture {
  readonly $schema?: string;
  readonly id: string;
  readonly description: string;
  readonly provenance: {
    readonly source: string;
    readonly url: string;
    readonly battleId: string;
    readonly parserVersion: string;
    readonly inGame: true;
    readonly measured: string;
    readonly verifiedAgainst: Record<string, string>;
    readonly notes: readonly string[];
  };
  readonly enemy: { readonly id: string; readonly level: number };
  readonly team: readonly Build[];
  readonly hits: readonly LogHit[];
  /** Skill events the log records without damage: casts' starts as the log has them (zmdlogsCasts). Absent in fixtures imported before 2026-10-25. */
  readonly casts?: readonly LogCast[];
}

/** A skill event without damage in a ZMDLogs detail: an operator's cast of a skill, at its start (ms). */
export interface LogCast {
  readonly t: number;
  readonly operator: string;
  readonly skill: string;
}

/**
 * The casts a battle detail records as skill events without a damage value (laneType "skill", value null), by the
 * team's operators: e.g. btl_upload_40d9a3c1da37's Laevatain ultimate at 3041 ms, whose damage comes as other keys.
 */
export function zmdlogsCasts(detail: unknown, team: readonly string[]): LogCast[] {
  const events = a(o(detail, "detail")["timelineEvents"], "timelineEvents").map((e) => o(e, "event"));
  return events
    .filter((e) => e["laneType"] === "skill" && e["value"] === null)
    .map((e) => {
      const source = s(e["sourceCharacterKey"], "sourceCharacterKey");
      return { t: n(e["tsMsFromStart"], "tsMsFromStart"), operator: source === ENDMIN_VIRTUAL ? ENDMIN : source, skill: s(e["eventKey"], "eventKey") };
    })
    .filter((c) => team.includes(c.operator))
    .sort((x, y) => x.t - y.t);
}

/** A damage event's logged Stagger (LogHit.poise), if it dealt any. */
function poiseOf(e: Json): LogHit["poise"] {
  const p = e["poiseDamage"];
  if (p === null || p === undefined) return undefined;
  const q = o(p, "poiseDamage");
  const dealt = -n(q["value"], "poiseDamage.value");
  return dealt > 0 ? { dealt, bar: n(q["current_value"], "poiseDamage.current_value") } : undefined;
}

/** A detail's damage events (positive value), in its order: one fixture hit each (zmdlogsToFixture). */
function damageEvents(detail: unknown): Json[] {
  return a(o(detail, "detail")["timelineEvents"], "timelineEvents").map((e) => o(e, "event")).filter((e) => typeof e["value"] === "number" && e["value"] > 0);
}

/**
 * The logged Stagger of each of a fixture's hits (LogHit.poise), from the battle detail it was imported from: the
 * hits are the detail's damage events in order, which this checks (time, event and damage).
 */
export function zmdlogsPoise(detail: unknown, hits: readonly Pick<LogHit, "t" | "event" | "value">[]): LogHit["poise"][] {
  const events = damageEvents(detail);
  if (events.length !== hits.length) throw new Error(`ZMDLogs: the detail has ${events.length} damage events, the fixture ${hits.length} hits`);
  return events.map((e, i) => {
    const h = hits[i] as Pick<LogHit, "t" | "event" | "value">;
    if (e["tsMsFromStart"] !== h.t || e["eventKey"] !== h.event || e["value"] !== h.value) throw new Error(`ZMDLogs: hit ${i} (${h.t} ms ${h.event} ${h.value}) isn't the detail's damage event ${String(e["tsMsFromStart"])} ms ${String(e["eventKey"])} ${String(e["value"])}`);
    return poiseOf(e);
  });
}

const UA = "EndfieldBattleSimulator/0.1 (https://github.com/jojkaart/Endfield-battle-simulator)";

/** Fetches a battle's detail (unless given) and export. Waits between requests (the API allows 60 per minute). */
export async function fetchBattle(battleId: string, detail?: unknown): Promise<{ detail: unknown; exported: unknown }> {
  if (!/^btl_[a-z0-9_]+$/.test(battleId)) throw new Error(`not a battle ID: ${battleId}`);
  const get = async (url: string) => {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return (await res.json()) as unknown;
  };
  if (detail === undefined) {
    detail = await get(`https://zmdlogs.com/api/battles/${battleId}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  const exported = await get(`https://zmdlogs.com/api/v1/battles/${battleId}/export`);
  return { detail, exported };
}

type Json = Record<string, unknown>;
const o = (v: unknown, what: string): Json => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`ZMDLogs: ${what} isn't an object`);
  return v as Json;
};
const a = (v: unknown, what: string): unknown[] => {
  if (!Array.isArray(v)) throw new Error(`ZMDLogs: ${what} isn't an array`);
  return v;
};
const n = (v: unknown, what: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`ZMDLogs: ${what} isn't a number`);
  return v;
};
const s = (v: unknown, what: string): string => {
  if (typeof v !== "string") throw new Error(`ZMDLogs: ${what} isn't a string`);
  return v;
};

function element(v: unknown): Element | null {
  if (v === null || v === undefined || v === "all") return null;
  const e = s(v, "element");
  if (!(ELEMENTS as readonly string[]).includes(e)) throw new Error(`ZMDLogs: unknown element ${e}`);
  return e as Element;
}

/** Promotion stage implied by a level: the log doesn't record it, so the highest one possible is assumed. */
function promotionFor(level: number): number {
  return level > 80 ? 4 : level > 60 ? 3 : level > 40 ? 2 : level > 20 ? 1 : 0;
}

export interface BuildLookups {
  /** Skill group (basic/battle/combo/ultimate) of an operator's skill. */
  skillGroup(operator: string, skillId: string): string | undefined;
  /** The weapon's three skill IDs in table order. */
  weaponSkills(weapon: string): readonly string[] | undefined;
}

/** The game's virtual Endministrator (GlobalConst endminVirtualCharId): both genders share stats and the kit's ID. */
const ENDMIN_VIRTUAL = "chr_9000_endmin";
const ENDMIN = "chr_0003_endminf";

function rosterBuild(entry: unknown, lookups: BuildLookups, notes: string[]): Build {
  const r = o(entry, "roster entry");
  const key = s(r["characterKey"], "characterKey");
  const operator = key === ENDMIN_VIRTUAL ? ENDMIN : key;
  if (operator !== key) notes.push(`The roster names the Endministrator ${ENDMIN_VIRTUAL} (the game's virtual ID); read as ${ENDMIN}.`);
  const level = n(r["characterLevel"], "characterLevel");
  const skills = a(r["skills"], "skills").map((x) => o(x, "skill"));
  if (skills.length === 0 && operator === ENDMIN) notes.push(`The roster lists no skill levels for ${operator}; 12 assumed for each.`);
  const groupLevel = (g: string) => {
    if (skills.length === 0 && operator === ENDMIN) return 12;
    const levels = skills.filter((x) => lookups.skillGroup(operator, s(x["skillKey"], "skillKey")) === g).map((x) => n(x["level"], "skill level"));
    if (levels.length === 0) throw new Error(`ZMDLogs: ${operator} has no ${g} skill level`);
    return Math.max(...levels);
  };
  const w = o(r["weapon"], "weapon");
  const weaponId = s(w["weaponTemplate"], "weaponTemplate");
  const order = lookups.weaponSkills(weaponId);
  if (!order) throw new Error(`ZMDLogs: unknown weapon ${weaponId}`);
  const wSkills = a(w["skills"], "weapon skills").map((x) => o(x, "weapon skill"));
  const skillLevels = order.map((id) => {
    const found = wSkills.find((x) => x["skillKey"] === id);
    if (!found) throw new Error(`ZMDLogs: ${weaponId} skill ${id} missing`);
    return n(found["level"], "weapon skill level");
  });
  return {
    operator,
    level,
    promotion: promotionFor(level),
    potential: n(r["characterPotential"], "characterPotential"),
    skillLevels: { basic: groupLevel("basic"), battle: groupLevel("battle"), combo: groupLevel("combo"), ultimate: groupLevel("ultimate") },
    // Weapon level isn't in the export; skill levels at 9 need a fully broken-through weapon.
    weapon: { id: weaponId, level: 90, skillLevels: skillLevels as [number, number, number] },
    gear: a(r["equips"], "equips").map((x) => {
      const e = o(x, "equip");
      const enhance = a(e["enhanceLevels"], "enhanceLevels").map((y) => o(y, "enhance"));
      const levelOf = (i: number) => {
        const found = enhance.find((y) => y["index"] === i);
        return found ? n(found["level"], "enhance level") : 0;
      };
      return { id: s(e["itemId"], "itemId"), artifice: [levelOf(1), levelOf(2), levelOf(3)] as [number, number, number] };
    }),
  };
}

/** The enemy IDs a battle's damage hits landed on (one in a single-target fight). */
export function enemiesHit(detail: unknown): string[] {
  const events = a(o(detail, "detail")["timelineEvents"], "timelineEvents").map((e) => o(e, "event"));
  const ids = events
    .filter((e) => typeof e["value"] === "number" && e["value"] > 0 && typeof e["targetCharacterKey"] === "string" && e["targetCharacterKey"].startsWith("eny_"))
    .map((e) => e["targetCharacterKey"] as string);
  return [...new Set(ids)].sort();
}

export function zmdlogsToFixture(battleId: string, detail: unknown, exported: unknown, lookups: BuildLookups, enemyLevel: number): LogFixture {
  const d = o(detail, "detail");
  const battle = o(d["battle"], "battle");
  if (battle["id"] !== battleId) throw new Error(`ZMDLogs: detail is for ${String(battle["id"])}, not ${battleId}`);
  const ex = o(exported, "export");
  const rosterNotes: string[] = [];
  const team = a(ex["roster"], "roster").map((r) => rosterBuild(r, lookups, rosterNotes));
  const boss = s(battle["bossKey"], "bossKey");
  const enemies = enemiesHit(detail);

  const events = a(d["timelineEvents"], "timelineEvents").map((e) => o(e, "event"));
  const buffs = events.filter((e) => e["laneType"] === "buff");
  const effectsOf = (b: Json): LogEffect[] =>
    a(b["effects"], "effects").flatMap((x) => {
      const f = o(x, "effect");
      const zone = ZMDLOGS_ZONES[s(f["zone"], "zone")];
      if (!zone) throw new Error(`ZMDLogs: unknown zone ${String(f["zone"])} on ${String(b["eventKey"])}`);
      if (b["targetEnemyKey"] == null && TARGET_SIDE_ZONES.has(zone)) return [];
      return [{ buff: s(b["eventKey"], "eventKey").replace(/::.*$/, ""), zone, element: element(f["element"]), value: n(f["rate"], "rate") }];
    });

  const hits: LogHit[] = [];
  for (const e of damageEvents(detail)) {
    if (typeof e["value"] !== "number") continue;
    const poise = poiseOf(e);
    const t = n(e["tsMsFromStart"], "tsMsFromStart");
    const source = s(e["sourceCharacterKey"], "sourceCharacterKey");
    const operator = source === ENDMIN_VIRTUAL ? ENDMIN : source;
    // Hits name their target in targetCharacterKey (targetEnemyKey is often empty); in a single-target fight it's the boss.
    const target = enemies.length > 1 ? s(e["targetCharacterKey"], "targetCharacterKey") : typeof e["targetEnemyKey"] === "string" ? e["targetEnemyKey"] : boss;
    const relevant = buffs.filter((b) => b["targetCharacterKey"] === source || (b["targetEnemyKey"] !== null && b["targetEnemyKey"] === target));
    const start = (b: Json) => n(b["actualStartMsFromStart"], "actualStartMsFromStart");
    const end = (b: Json) => n(b["actualEndMsFromStart"], "actualEndMsFromStart");
    const inside = relevant.filter((b) => start(b) < t && t < end(b));
    const boundary = relevant.filter((b) => (start(b) === t || end(b) === t) && start(b) <= t && t <= end(b));
    const crit = o(o(e["hitContext"] ?? {}, "hitContext")["critical"] ?? {}, "critical");
    const verified = crit["status"] === "verified";
    const uncapped = verified && typeof crit["uncappedDamage"] === "number" && crit["uncappedDamage"] !== e["value"] ? crit["uncappedDamage"] : undefined;
    hits.push({
      t,
      operator,
      ...(enemies.length > 1 ? { target } : {}),
      event: s(e["eventKey"], "eventKey"),
      value: e["value"],
      ...(uncapped !== undefined ? { uncapped } : {}),
      crit: verified ? crit["isCritical"] === true : null,
      element: element(e["damageElement"]),
      effects: inside.flatMap(effectsOf),
      boundaryEffects: boundary.flatMap(effectsOf),
      unquantified: [...inside, ...boundary]
        .filter((b) => Array.isArray(b["dynamicEffects"]) && (b["dynamicEffects"] as unknown[]).length > 0)
        .map((b) => ({ buff: s(b["eventKey"], "eventKey").replace(/::.*$/, ""), since: start(b), source: ((k) => (k === ENDMIN_VIRTUAL ? ENDMIN : k))(s(b["sourceCharacterKey"], "sourceCharacterKey")) })),
      ...(poise ? { poise } : {}),
    });
  }

  return {
    $schema: "../schemas/log-fixture.schema.json",
    id: `zmdlogs-${battleId.replace(/^btl_upload_/, "")}`,
    description: `ZMDLogs battle ${battleId} vs ${boss}: ${team.map((b) => b.operator).join(", ")}; per-hit damage with the logged buff effects.`,
    provenance: {
      source: "ZMDLogs (zmdlogs.com) battle log, captured in game by its client",
      url: `https://zmdlogs.com/battles/${battleId}`,
      battleId,
      parserVersion: s(battle["parserVersion"], "parserVersion"),
      inGame: true,
      measured: s(battle["battleStartAt"], "battleStartAt"),
      verifiedAgainst: {},
      notes: [
        "Promotion, weapon level and talent levels aren't in the log; the highest possible for the logged levels is assumed.",
        `Enemy level ${enemyLevel} is assumed, not logged.`,
        ...rosterNotes,
      ],
    },
    enemy: { id: boss, level: enemyLevel },
    team,
    hits,
    casts: zmdlogsCasts(detail, team.map((b) => b.operator)),
  };
}
