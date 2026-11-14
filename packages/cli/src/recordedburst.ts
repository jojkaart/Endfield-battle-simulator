// A recording buff's burst (Si's Artful Intent, KitBuff.records) valued from the logged hits it recorded: the burst is
// Fixed DMG of `rate` × the damage of every hit on the target while the buff lasted, which no single logged hit
// gives, but the log's own hits in the buff's window do (docs/design.md, "What a log check verifies").

import { effectiveKit, evalContext, evaluate, kitHitEntries, roundDamage, type Build, type GameData, type KitBuff, type KitHit, type StatPanel } from "@efsim/engine";
import type { LogFixture, LogHit } from "@efsim/data";

/**
 * How long before its burst a record may have stopped, in ms. The log doesn't have the record's end: Final Stroke
 * ends Artful Intent at its frame 12 and the Inksoul's burst lands 13 frames later (20 at distance 2), the mark
 * projectile 14 frames after an expiry, and logged times fall on a ~110 ms grid. Fitted windows (2026-11-14, 34
 * bursts of 17 single-target logs) stop between 294–393 ms (zmdlogs-3f78ceb15bc3 61538 ms) and 681–869 ms
 * (zmdlogs-458b03609665 23727 ms) before the burst.
 */
export const RECORD_END_LAG_MS = 1000;

/** One reading of a recorded burst: the record stopping after the hits logged up to `last` (ms). */
export interface RecordedBurstReading {
  /** The last logged time the record counts (ms); the hits logged after it, before the burst, it doesn't. */
  readonly last: number;
  /** The burst's time minus `last` (ms). */
  readonly lag: number;
  /** The hits logged at the start's ms but before it, when it leaves them out (how many). */
  readonly withoutEarly?: number;
  /** How many logged hits it counts. */
  readonly counted: number;
  /** Their damage (each hit's uncapped value where the log has one). */
  readonly recorded: number;
  /** rate × recorded, rounded. */
  readonly predicted: number;
  /** How far from the log a match may be: ±1, and ±0.5 × rate for each counted hit (each logged value is rounded). */
  readonly tolerance: number;
}

export type RecordedBurst =
  | {
      /** The logged hit that applied the recording buff: the window's start (counted). */
      readonly start: LogHit;
      readonly rate: number;
      /** The recording buff (KitBuff.id). */
      readonly buff: string;
      /** Every reading, the latest end first. */
      readonly readings: readonly RecordedBurstReading[];
    }
  | { readonly unknown: string };

/** Whether a kit hit is a recording buff's burst: Fixed DMG of what the buff recorded (`{eventRecorded: true}`). */
export function isRecordedBurst(hit: KitHit): boolean {
  const v = hit.fixedDamage as unknown;
  return typeof v === "object" && v !== null && "eventRecorded" in v;
}

/** The logged events of every team member's Fixed DMG kit hits: the record doesn't count them (KitBuff.records). */
function fixedDamageEvents(data: GameData, fx: LogFixture): ReadonlySet<string> {
  return new Set(fx.team.flatMap((b) => kitHitEntries(effectiveKit(data, b)).filter((e) => e.hit.fixedDamage !== undefined).flatMap((e) => e.hit.events)));
}

/**
 * A logged burst of a recording buff valued from the log (Si's Artful Intent burst: zmdlogs-0eef2474a26f 10030 ms,
 * zmdlogs-40d9a3c1da37 18836 ms, …): `rate` (the recording buff's, for the hitter's build: ink_damage_rate 0.13, 0.20
 * from P1) × the sum of every logged hit on the target, by anyone (statuses, reactions and ticks included; Fixed
 * DMG not), from the logged hit that applied the buff (inclusive: the battle skill applies Artful Intent before its
 * damage; BuffData xianjing_inkhurteffect SaveDamageContext, reset to 0 at the battle skill's frame 0) to the
 * record's end. The end isn't in the log: each logged time up to RECORD_END_LAG_MS before the burst is a reading.
 * Unknown in a multi-target fixture (the log can't tell enemies of one type apart, and the total is kept on Si:
 * every target's record adds to it), or without a logged hit that applied the buff before the burst.
 */
export function recordedBurst(data: GameData, fx: LogFixture, member: { readonly build: Build; readonly panel: StatPanel }, burst: LogHit): RecordedBurst {
  if (fx.hits.some((h) => h.target !== undefined)) return { unknown: "a multi-target log: which hits each target's record took isn't known" };
  const kit = effectiveKit(data, member.build);
  if (!kit) return { unknown: "no kit" };
  const recording = kit.buffs.filter((b): b is KitBuff & { records: NonNullable<KitBuff["records"]> } => b.records !== undefined);
  if (recording.length !== 1) return { unknown: `${recording.length} recording buffs in the kit` };
  const buff = recording[0] as KitBuff & { records: NonNullable<KitBuff["records"]> };
  // The kit hits that apply it, and the latest of them logged at or before the burst: the window's start.
  const appliers = kitHitEntries(kit).filter((e) => e.hit.buffs?.some((a) => a.buff === buff.id));
  const events = new Set(appliers.flatMap((e) => e.hit.events));
  const start = fx.hits.filter((h) => h.operator === burst.operator && events.has(h.event) && h.t <= burst.t).at(-1);
  if (!start) return { unknown: `no logged hit applying ${buff.id} before the burst` };
  const skillId = (appliers.find((e) => e.hit.events.includes(start.event)) as { skillId: string }).skillId;
  const rate = evaluate(buff.records.rate, evalContext(data, member.build, member.panel, skillId, {}));
  const fixed = fixedDamageEvents(data, fx);
  const window = fx.hits.filter((h) => h.t >= start.t && h.t < burst.t && !fixed.has(h.event));
  // Hits logged at the start's ms but before it in the log: the log's order within a ms doesn't always say whether
  // they came first (zmdlogs-b6aa15281db4 32764 ms and zmdlogs-489c0be3e162 44123 ms fit without theirs,
  // zmdlogs-489c0be3e162 8673 ms only with them), so both are read.
  const startAt = fx.hits.indexOf(start);
  const early = new Set(fx.hits.filter((h, i) => h.t === start.t && i < startAt));
  // Each reading counts the hits logged up to one of the logged times within RECORD_END_LAG_MS of the burst (and the
  // latest before that range, when no hit falls in it): the latest end first.
  const times = [...new Set(window.map((h) => h.t))].sort((a, b) => b - a);
  const inRange = times.filter((t) => burst.t - t <= RECORD_END_LAG_MS);
  const before = times.find((t) => burst.t - t > RECORD_END_LAG_MS);
  const ends = before === undefined ? inRange : [...inRange, before];
  const readings = ends.flatMap((last) =>
    (early.size ? [false, true] : [false]).map((withoutEarly): RecordedBurstReading => {
      const counted = window.filter((h) => h.t <= last && !(withoutEarly && early.has(h)));
      const recorded = counted.reduce((s, h) => s + (h.uncapped ?? h.value), 0);
      return {
        last, lag: burst.t - last, ...(withoutEarly ? { withoutEarly: early.size } : {}), counted: counted.length, recorded,
        predicted: roundDamage(rate * recorded), tolerance: 1 + 0.5 * rate * counted.length,
      };
    }),
  );
  return { start, rate, buff: buff.id, readings };
}
