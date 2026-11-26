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

/** Who decides the fact an assumption kind is about, and what the check's primary reading takes (ASSUMPTION_FACTS). */
export interface AssumptionFact {
  /** The fact the log doesn't say. */
  readonly fact: string;
  /** Where the replay decides it (null: nothing in the replay or the placement does). */
  readonly replay: string | null;
  /** What the primary reading takes: the replay's decision, the log's listing, or nothing. */
  readonly primary: string;
  /** When the check tries the other readings, labelled with this kind. */
  readonly alternatives: string;
  /**
   * The text an alternative's label carries when the replay decides the fact but couldn't this time (its reason), so a
   * test can hold the check to "an alternative only where the replay didn't decide" (tests/assumption-facts.test.ts).
   * Absent where the label can't say (crit: the record's critSource does), or the replay doesn't decide the fact.
   */
  readonly undecided?: RegExp;
}

/**
 * Every assumption kind's fact, whether the replay decides it and whether the primary reading takes the replay's
 * decision (low-plain-low-mismatch report point 2: the replay read crits from the log, cross-validated at 0.90, and
 * the primary reading never asked, so 418 of Rossi's matches were "assumed: crit"; engine assumption check-crits since).
 * A Record over AssumptionKind, so a new kind can't be added without its row; docs/design/data.md "Each assumption
 * kind's fact" is its table (assumptionFactsTable; tests/assumption-facts.test.ts holds the two together). "Candidate"
 * marks a fact the replay decides that the check still tries both ways: where the next "assumed, but the replay knew"
 * is likeliest.
 */
export const ASSUMPTION_FACTS: Readonly<Record<AssumptionKind, AssumptionFact>> = {
  crit: { fact: "whether a hit the log gives no crit flag crit", replay: "replaycrits.ts shownCrits, layerCrits, valueCrits (BuffReplay.critSource)", primary: "the replay's read crit, else none (engine assumption check-crits `replay`)", alternatives: "a crit where the replay read none; both ways in the log-listing fallback's readings (logcheck.ts candidates: candidate, a fallback stays one)" },
  noCrit: { fact: "as crit", replay: "as crit", primary: "as crit", alternatives: "no crit where the replay read one", undecided: /the replay read a crit/ },
  boundary: { fact: "whether a buff starting or ending at the hit applied", replay: "its kit buffs (BuffReplay.kitBuffNearChange: unsure within 500 ms); none for log-only buffs", primary: "the replay's kit buffs; log-only buffs inside the hit", alternatives: "a kit buff changing near the hit as listed or off; the log-only boundary buffs' subsets", undecided: /isn't sure|boundary buffs/ },
  corrosion: { fact: "Corrosion's level where the log lists it without a value", replay: "its own Corrosion at the landing (ramp, cap)", primary: "the replay's level", alternatives: "levels 1–4 where the replay has none at the hit", undecided: /the replay has none|the replay can't say/ },
  stacks: { fact: "a reaction status hit's level", replay: "its arts state, replayed again with the levels the log shows (logcheck.ts loggedReactionLevels)", primary: "the replay's level", alternatives: "every other level of a non-burst reaction, even where the log decided it (candidate)" },
  kitHit: { fact: "which of the event's kit hits the logged hit is", replay: "the placement's landing on the path the replay took (logcasts.ts placeHits; engine paths.ts pathLandings)", primary: "the replay's landed hit", alternatives: "the event's other kit hits, always (a player's timing chooses some: Rossi's perfect combo); zmdlogs groups rows a cast matched only so", undecided: /the replay landed|the replay can't say/ },
  situational: { fact: "the enemy's side of a kit hit's condition (KitHit.if, extraScale)", replay: "its enemy state at the landing, not checked against the log's reactions", primary: "the replay's situation, its enemy side left open", alternatives: "taken as met and as not met (candidate: the replay's inflictions)", undecided: /isn't taken from the replay|the replay can't say|aren't checked|doesn't decide/ },
  eventCount: { fact: "a combo's window count behind a value", replay: "the window it opened (ReplayCastFacts.windowCount)", primary: "the replay's count", alternatives: "counts 1–4 where the replay can't say", undecided: /the replay can't say/ },
  value: { fact: "what a value reads that only a fight knows (hitvalues.ts: consumed stacks, the enemy's stacks)", replay: "the operator's side from the landing's facts; the enemy's side not taken", primary: "the landing's facts", alternatives: "over the value's range where the facts don't say (candidate: the enemy's side)", undecided: /isn't taken from the replay|the replay can't say/ },
  unloggedCastBuff: { fact: "buffs the hit's cast consumed that the log doesn't list", replay: "the buffs its cast consumed (ReplayCastFacts.consumed)", primary: "the replay's", alternatives: "0 up to the most layers where the replay can't say", undecided: /the replay can't say|consumed/ },
  unloggedOwnBuff: { fact: "the hitter's own kit buffs (or their crit parts) the log doesn't list", replay: null, primary: "none", alternatives: "with them (logcheck.ts unloggedOwnBuffs), the old check's reading" },
  link: { fact: "the Link stacks a battle skill or ultimate used", replay: "Cast.link (ReplayCastFacts.link)", primary: "the replay's", alternatives: "Link 0–4 where the replay can't say", undecided: /the replay can't say/ },
  enemyAura: { fact: "an enemy-side team aura the log doesn't list", replay: null, primary: "none", alternatives: "with it (logcheck.ts unloggedEnemyAuras)" },
  layers: { fact: "a layered buff's layers where the log lists it once", replay: "a kit buff it judges (its layers); none for one it can't judge", primary: "the replay's layers; one layer for an unjudged one", alternatives: "each count up to its maximum for an unjudged kit buff (enginecheck.ts unjudgedLayered) or a log-only one", undecided: /can't judge|layers/ },
  unquantifiedFromKit: { fact: "the value of a buff the log lists without one", replay: null, primary: "none", alternatives: "valued from the kit that names it (logcheck.ts unquantifiedFromKit)" },
  stagger: { fact: "whether the enemy was Staggered at the hit", replay: "its Stagger, held to the log's listing (loggedStaggerSteps, holdStagger)", primary: "the replay's", alternatives: "the other way where the replay's Stagger changes within 500 ms", undecided: /changes within/ },
  logListing: { fact: "every buff as the log lists it, where no engine reading fits", replay: null, primary: "the engine's reading (a fallback match is the log's)", alternatives: "the log's listing, the fallback (LOG_LISTING)" },
  recordEnd: { fact: "when a recording buff's record stopped before its burst", replay: "the recorded burst's record (recordedburst.ts)", primary: "the replay's record", alternatives: "the record's end shifted where the replay's burst value doesn't fit" },
};

/** docs/design/data.md's table of ASSUMPTION_FACTS (one row per kind), as the docs have it. */
export function assumptionFactsTable(): string {
  const cell = (s: string | null) => (s ?? "nothing").replace(/\|/g, "\\|");
  return [
    "| Kind | The fact | Decided by the replay | The primary reading takes | Alternatives tried |",
    "|---|---|---|---|---|",
    ...Object.entries(ASSUMPTION_FACTS).map(([k, f]) => `| \`${k}\` | ${cell(f.fact)} | ${cell(f.replay)} | ${cell(f.primary)} | ${cell(f.alternatives)} |`),
  ].join("\n");
}

export interface Assumption {
  readonly kind: AssumptionKind;
  /** How the report names it. */
  readonly label: string;
  /** The buffs (or the kit hit) it is about, if any. */
  readonly buffs?: readonly string[];
  /** Its count (a level, layers, stacks, an event count, Link stacks), if any. */
  readonly n?: number;
}
