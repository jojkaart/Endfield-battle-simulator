// What a reading of a logged hit takes for granted that the log doesn't say: the types both the log check (logcheck.ts)
// and the engine's readings (enginecheck.ts) use. Their own module, so enginecheck needn't import logcheck (which
// imports it): the two were an import cycle.

/** What a reading of a logged hit takes for granted that the log doesn't say. */
export type AssumptionKind =
  /** The log couldn't tell whether the hit crit. */
  | "crit"
  | "noCrit"
  /** Which buffs starting or ending at the hit applied (boundarySubsets). */
  | "boundary"
  /** Corrosion's level (the log lists Corrosion without a value), where the replay's landing has none (corrosionAt). */
  | "corrosion"
  /** A status hit's stacks. */
  | "stacks"
  /** Which of several kit hits the logged event is. */
  | "kitHit"
  /** A hit's situational parts (KitHit.if, extraScale) taken as met. */
  | "situational"
  /** The count of the event behind a value (eventCounts), where the replay saw no window. */
  | "eventCount"
  /** What a value reads that only a fight knows (hitvalues.ts), where the replay's landing doesn't say. */
  | "value"
  /** Buffs the hit's cast consumes, which the log doesn't list, where the replay can't say (castBuffVariants). */
  | "unloggedCastBuff"
  /** The hitter's own kit buffs, or their crit parts, which the log doesn't list (unloggedOwnBuffs). */
  | "unloggedOwnBuff"
  /** Link stacks on the cast, where the replay can't say (linkVariants). */
  | "link"
  /** An enemy-side team aura the log doesn't list (unloggedEnemyAuras). */
  | "enemyAura"
  /** Layers of a layered buff the log lists once (layerVariants). */
  | "layers"
  /** An unquantified buff valued from a kit (unquantifiedFromKit). */
  | "unquantifiedFromKit"
  /** The replay's Stagger starting or ending near the hit, read the other way (enginecheck.ts). */
  | "stagger"
  /** The log's own buff listing where the engine's reading fits nothing (LOG_LISTING): the fallback. */
  | "logListing"
  /** When a recording buff's record stopped before its burst, which the log doesn't say (recordedburst.ts). */
  | "recordEnd";

export interface Assumption {
  readonly kind: AssumptionKind;
  /** How the report names it. */
  readonly label: string;
  /** The buffs (or the kit hit) it is about, if any. */
  readonly buffs?: readonly string[];
  /** Its count (a level, layers, stacks, an event count, Link stacks), if any. */
  readonly n?: number;
}
