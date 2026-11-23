// Test helpers (not a test file): synthetic ZMDLogs battle details (/api/battles/<id> responses) for the importer's
// and the refresh's tests, with no network and no player data.

import type { Build } from "@efsim/engine";
import type { LogHit } from "../../packages/logs/src/zmdlogs.ts";

/** A buff lane of a synthetic detail. */
export interface DetailBuff {
  readonly key: string;
  readonly from: string;
  /** The operator it's on; absent for a buff on the enemy. */
  readonly on?: string;
  readonly start: number;
  readonly end: number;
  readonly effects: readonly { readonly zone: string; readonly rate: number; readonly element?: string }[];
  /** How many effects the log lists without a value (dynamicEffects: the hits get an unquantified entry); none by default. */
  readonly dynamic?: number;
}

/** A damage event (value > 0) or a cast (value null) of a synthetic detail. */
export interface DetailEvent {
  readonly t: number;
  readonly from: string;
  readonly key: string;
  readonly value: number | null;
  readonly element?: string;
  /** Stagger dealt, the bar after it, and the skill it's credited to. */
  readonly poise?: { readonly dealt: number; readonly bar: number; readonly origin?: string };
}

/** A synthetic battle detail against one enemy (`boss`), as ZMDLogs' /api/battles/<id> has it. */
export function syntheticDetail(battleId: string, boss: string, buffs: readonly DetailBuff[], events: readonly DetailEvent[], parserVersion = "raw-log-parser-test"): unknown {
  return {
    battle: { id: battleId, bossKey: boss, parserVersion, battleStartAt: "2026-01-01T00:00:00Z", clearFlag: false },
    timelineEvents: [
      ...buffs.map((b) => ({
        laneType: "buff",
        eventKey: `${b.key}::1`,
        sourceCharacterKey: b.from,
        targetCharacterKey: b.on ?? boss,
        targetEnemyKey: b.on === undefined ? boss : null,
        actualStartMsFromStart: b.start,
        actualEndMsFromStart: b.end,
        effects: b.effects.map((f) => ({ zone: f.zone, rate: f.rate, element: f.element ?? null })),
        dynamicEffects: Array.from({ length: b.dynamic ?? 0 }, () => ({ zone: "atk", rate: null })),
      })),
      ...events.map((e) => ({
        laneType: "skill",
        eventKey: e.key,
        sourceCharacterKey: e.from,
        targetCharacterKey: boss,
        targetEnemyKey: null,
        tsMsFromStart: e.t,
        value: e.value,
        damageElement: e.element ?? null,
        hitContext: { critical: { status: "verified", isCritical: false } },
        poiseDamage: e.poise ? { type: "PoiseDamage", value: -e.poise.dealt, current_value: e.poise.bar, orig_source: e.poise.origin ?? null } : null,
      })),
    ],
  };
}

/** A schema-valid build of `operator` (the numbers don't matter to the importer's tests). */
export function plainBuild(operator: string): Build {
  return {
    operator,
    level: 90,
    promotion: 4,
    potential: 0,
    skillLevels: { basic: 12, battle: 12, combo: 12, ultimate: 12 },
    weapon: { id: "wpn_sword_0006", level: 90, skillLevels: [9, 9, 9] },
    gear: [],
  };
}

/** A hit as an older import wrote it: no effect sources or starts, no Stagger origin (and no Stagger when `poise` is false). */
export function oldHit(h: LogHit, poise: boolean): LogHit {
  const strip = (e: LogHit["effects"][number]) => ({ buff: e.buff, zone: e.zone, element: e.element, value: e.value });
  const { poise: p, ...rest } = h;
  return { ...rest, effects: h.effects.map(strip), boundaryEffects: h.boundaryEffects.map(strip), ...(p && poise ? { poise: { dealt: p.dealt, bar: p.bar } } : {}) };
}
