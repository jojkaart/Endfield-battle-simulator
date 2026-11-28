// The engine's own open readings: rules the engine applies to every kit that an in-game test or the logs decided
// only in part, registered like the kits' assumptions (OperatorKit.assumptions) so they switch the same way:
// TimelineOptions.assume (`--assume <id>=<reading>` in rules, gear, diagnose, `zmdlogs check`, scripts/measure.ts),
// each reading's code next to the rule's. The default is the reading the engine stands by; switching one is an
// experiment, not an edit (the round-3 friction reports: boss freezes, the teammates' pause and freeze rules were
// decided one way with no switch back).
//
// Two lists, one registry (ENGINE_ASSUMPTIONS): the simulation's readings here (read by the timeline), and the
// readings only the log check's replay and totals read (packages/logs) in replay-assumptions.ts, outside timeline/,
// so a lead adding a log rule's reading touches no timing file (round 19, the Camille report point 2). Each entry
// keeps its question and one sentence per reading; the evidence (measures, logs, dates) is in
// docs/design/assumptions.md, which `efsim assumptions` prints beside them and the game-data cache doesn't key on
// (backlog after round 18, point 2: a reading's prose changed in the source rebuilt the cache in every checkout).
//
// Every reader takes the run's readings: the timeline through engineReading (its scenario's options), any other code
// through readingOf (the readings it was given); tests/assumption-readers.test.ts traces the reads and fails one that
// took a default the run set (round 19: holds.ts tickBounds took break-hold's default under a measure's variant).
// Each entry's ID must be unique across the engine's and the kits' assumptions (tests/engine-assumptions.test.ts checks it).

import { EngineError } from "./errors.ts";
import type { KitAssumption } from "./model.ts";
import { REPLAY_ASSUMPTIONS } from "./replay-assumptions.ts";
import type { TimelineScenario } from "./timeline/state.ts";

/** An engine reading: like a kit's (id, the in-game test that decides it, question, default, readings), with no operator. */
export type EngineAssumption = KitAssumption;

/** Readings of open assumptions by id (TimelineOptions.assume; an id absent: its default). */
export type Readings = Readonly<Record<string, string>>;

/** The default reading of engine assumption break-hold (a constant, so a measure can set it: measure --variant <file>:BREAK_HOLD_READING=…). */
const BREAK_HOLD_READING = "14f";

/** The simulation's readings: read by the timeline (timeline/*.ts through engineReading). */
export const SIMULATION_ASSUMPTIONS: readonly EngineAssumption[] = [
  {
    id: "control-immunity",
    test: "104",
    question: "Which enemies ignore a freezing control status's freeze (Si's Immobilization, Tangtang's OLDEN STARE)?",
    default: "listed",
    readings: {
      listed: "the enemies packages/data/src/enemyFacts.ts lists from the logs; every other enemy freezes, bosses too (the owner, test 104, 2026-11-16)",
      bosses: "every Boss (rank 2) is immune, every other enemy freezes (the engine until 2026-11-16)",
      none: "every enemy freezes",
      all: "no enemy freezes: only the freezing operator's own debuffs are held",
    },
  },
  {
    id: "buff-in-stop",
    test: "18",
    question: "Is a buff created while a time stop or slow-down runs held by the rest of it, as the buffs already running are (timeline/clock.ts heldFromNow, actions.ts addBuff)?",
    default: "held",
    readings: {
      held: "held: its timer starts when the world's clock runs again",
      ultimates: "held by the rest of a running ultimate's time stop, not by a combo's slow-down",
      runs: "runs: its timer starts at once; only a stop that begins later holds it (the engine until 2026-11-18)",
    },
  },
  {
    id: "status-in-stop",
    test: "18",
    question: "Is an enemy status (Corrosion, Electrification, Combustion, Solidification) applied while a time stop or slow-down runs held by the rest of it, as a buff created then is (buff-in-stop; timeline/clock.ts holdNewStatuses)?",
    default: "held",
    readings: {
      held: "held: its timer and ramp start when the world's clock runs again, as buff-in-stop's `held` for buffs",
      runs: "runs: its timer and ramp start at once; only a stop that begins later holds it (the engine until 2026-11-23)",
    },
  },
  {
    id: "combo-reset",
    question: "Does a global dilation back to scale 1 (TimeDilationAction, curve RESETto1: Arcane's combo at its frame 9) end the running slow-downs of its priority, its own and a teammate's combo slow-down (timeline/clock.ts cutAtResets, resetSlowdowns)?",
    default: "reaches",
    readings: {
      reaches: "it ends them, and one of its priority that starts before it (a teammate's combo pressed inside her first 9 frames) ends there too, not holding her, as the log tools' stop lists cut it",
      resets: "it ends the slow-downs running when the resetting cast starts",
      none: "it does nothing: every slow-down runs its length, the lowest scale counting where they overlap (the engine until 2026-11-23)",
    },
  },
  {
    id: "freeze-ramp",
    test: "104",
    question: "Does a freeze (a control status that stops the enemy's clock: Si's Immobilization, Tangtang's stare) hold the enemy's Arts reaction statuses (Corrosion's ramp and end, Combustion's ticks and end, Electrification, Solidification), as it holds the operators' debuffs on it (timeline/actions.ts runTriggers)?",
    default: "statuses",
    readings: {
      statuses: "none of them is held, ramp, ticks or end",
      runs: "Corrosion's ramp runs on through it, its end and the other statuses held",
      held: "held with the enemy's clock (the engine until 2026-11-23)",
    },
  },
  {
    id: "combustion-snapshot",
    question: "When does a Combustion take the attacker side its ticks deal with (DamageAction takeAtkSnapshot: ATK, DMG bonus, Amp; status.ts ActiveStatus.snapshot)?",
    default: "last-tick",
    readings: {
      "last-tick": "at its application, then again at each tick for the next one",
      application: "at its application only (retaken after the triggers on its own reaction: c7790d76a4f0), the engine until 2026-11-23",
    },
  },
  {
    id: "battle-sub-skills",
    test: "29",
    question: "Does a battle-type sub-skill's cast (SkillData normalSkillSubType 1: Si's Initial and Final Stroke, Liino's End Stance, Camille's, Mi Fu's and Purrchena's follow-ups) count as a battle-skill cast for triggers that listen by skill type (CheckSkillType [2]: Type 50 Yinglung's Edge, talents on a battle-skill cast)?",
    default: "count",
    readings: {
      count: "it counts: the data's skill type is battle (the engine until 2026-11-18)",
      "main-only": "only the battle skill itself counts (normalSkillSubTypeFilter 0 read as the main skill only)",
    },
  },
  {
    id: "teammate-pause",
    test: "101",
    question: "How long does a teammate (an operator not controlled) pause after a full basic-attack chain (timeline/teammates.ts)?",
    default: "6.5s",
    readings: {
      "6.5s": "6.5 s: the share of free time the logs show teammates attacking (test 101, 2026-11-16)",
      "3.5s": "3.5 s: the median of the logs' gaps over 1.5 s alone (the calibration of 2026-10-28)",
    },
  },
  {
    id: "stagger-recovery",
    test: "110",
    question: "How long does a Stagger last past the enemy's PoiseRecTime (attribute 21 × 31) and the time stops in it (timeline/resources.ts staggerFrames)?",
    default: "2s",
    readings: {
      none: "no longer: PoiseRecTime on the enemy's clock (the data)",
      "2s": "2 s more on the enemy's clock, a recovery the data doesn't give (the logs' median past PoiseRecTime and the stops, 2026-11-18)",
    },
  },
  {
    id: "sp-regen",
    test: "102",
    question: "How does team SP regenerate around a spend (the native settings' atbRecoverInterval 0.5 s; 666bj's test: SP rises again 0.5 s after a battle skill; timeline/resources.ts spAt)?",
    default: "pause",
    readings: {
      ticks: "4 SP every 0.5 s (the interval as the regeneration's tick), its timer starting over at each spend: the first 4 SP come 0.5 s after it, so a spend costs no regeneration",
      pause: "continuously at 8 SP a second, paused for 0.5 s after each spend (the interval as a pause: 4 SP lost per spend; the engine since 2026-11-12)",
    },
  },
  {
    id: "sp-start",
    test: "102",
    question: "How much team SP does a fight start with (timeline/drivers.ts initialState)?",
    default: "200",
    readings: {
      "200": "200 of 300 (the native settings, as Endaxis's notes read them)",
      full: "300: full (the SP bar carried in full from before the fight, or a start the native settings don't give)",
    },
  },
  {
    id: "break-hold",
    question: "How long does a Stagger break hold every clock (timeline/clock.ts breakHold)?",
    default: BREAK_HOLD_READING,
    readings: {
      none: "no hold at a break (the engine until 2026-11-27)",
      "12f": "12 frames (0.4 s) at scale 0, every clock",
      "14f": "14 frames (0.47 s), as 12f (2026-11-27)",
      "16f": "16 frames (0.53 s), as 12f: the logs' median",
      "18f": "18 frames (0.6 s), as 12f; measured as 16f, hold-outs mismatch 5.4 → 5.6%",
      "16f-all": "16 frames, inside an ultimate's time stop too (measured: development plain 82.8%, otherwise as 16f)",
    },
  },
  {
    id: "break-hold-combo",
    question: "How does a Stagger break's hold combine with a combo's slow-down running at the break (timeline/clock.ts breakHold)?",
    default: "lowest",
    readings: {
      lowest: "as any two slow-downs: the lowest scale counts where they overlap, so inside a combo's plateau (0.01) the hold adds almost nothing for the operators the combo holds (2026-11-27)",
      added: "on top: every clock is held the hold's frames whatever runs, and the running slow-downs resume after it (their rest that many frames later)",
      none: "no hold at a break inside another slow-down than an ultimate's stop (a combo's slow-down or another break's hold)",
    },
  },
  {
    id: "combo-window-count",
    test: "10",
    question: "When several events open (or refresh) a combo window, which count does the combo read (ValueExpr eventCount; Si's final hit: the infliction stacks consumed): the highest or the latest (timeline/actions.ts openCombo)?",
    default: "highest",
    readings: {
      highest: "the highest count of the events that opened it (Si's description: \"highest stacks\")",
      latest: "the latest event's count",
    },
  },
  {
    id: "combo-curve",
    question: "What is the ComboSkill time-dilation curve every combo's global slow-down follows (TimeDilationAction useCurveKey ComboSkill: an asset the game data names but doesn't hold)?",
    default: "guess",
    readings: {
      guess: "0.01 for 40% of its duration, then a linear ramp to 1 at 93% (since batch 1; the logs' Corrosion ramps, buff ends and landings fit it)",
      flat: "0.01 for its whole duration (measured 2026-11-26 as a patch, docs/tried/2026-11-26-combo-curve-flat.diff: verified plain 78.0 → 73.0%, development 69.0 → 68.0%, hold-out 79.0 → 76.7%; 2026-11-28 code: verified 78.5 → 73.5%, development 84.2 → 82.9%, hold-out 82.5 → 80.0%)",
      middle: "0.01 to 70% of its duration, then a linear ramp to 1 (the same diff: verified 75.6%, development 68.6%, hold-out 77.8%; 2026-11-28 code: verified 78.5 → 76.1%, development 84.2 → 83.5%, hold-out 82.5 → 81.5%)",
    },
  },
  {
    id: "combo-operator-hold",
    question: "Does a combo's slow-down hold the operators (their casts' hits on the way, delayed actions, the Arts Bursts on their clocks) longer than its scales say, while the world's clock (buffs, the enemy's statuses) follows them?",
    default: "none",
    readings: {
      none: "as its scales say (the engine until 2026-11-26)",
      "3f": "3 frames more on every operator it holds at all",
      "4f": "4 frames more (verified 77.1%, development 69.0%, hold-out 80.5%, earlier 66.4%: 9a80 +4, 9c0b +3 and c6d8 +13 plain against 4bfc −92 and 3aa6 −33; 2026-11-28 code: verified 78.5 → 77.6%, earlier pending 84.6 → 83.4%, 4bfc −97, 3aa6 −40)",
      "6f": "6 frames more (verified 76.4%, development 68.9%, hold-out 80.4%, earlier 66.3%)",
      "4f-episode": "4 frames more once per episode, only at a slow-down that starts while none runs, so combos pressed together hold as one (2026-11-28: earlier pending 84.6 → 83.9%, the other rows unchanged)",
      "5f-episode": "the same, 5 frames (earlier pending 83.4%)",
      "6f-episode": "the same, 6 frames (earlier pending 83.4%)",
      "plateau-0.6": "the operators held by their own curve, 0.01 to 60% of the combo's slow-down, then a linear ramp to 1 at 93%",
      "plateau-0.7": "the same to 70% (about 4 frames more on a 24-frame combo)",
      "plateau-0.5": "the same to 50% (about 1.2 frames more on a 24-frame combo)",
      flat: "the operators held at 0.01 for the whole combo slow-down (the world's curve unchanged)",
    },
  },
  {
    id: "trigger-cooldowns",
    question: "Which clock does a kit trigger's cooldown run on: the world's, held by time stops, slow-downs and the replay's placed hidden holds as buffs are, or raw time as a skill's cooldown (timeline/clock.ts shiftTriggerCooldowns)?",
    default: "kit",
    readings: {
      kit: "each trigger's own clock (KitTrigger.cooldownClock; 2026-11-24)",
      raw: "raw time for every trigger, as skill cooldowns (the engine until 2026-11-24)",
      world: "the world's clock for every trigger",
    },
  },
  {
    id: "burst-stops",
    question: "Which time stops and slow-downs hold an Arts Burst's delay (the 1 s after its infliction: timeline/clock.ts operatorClockDue, slowDown)?",
    default: "all",
    readings: {
      others: "every one but its own operator's, as her clock",
      all: "every one, her own ultimate's stop too",
      ultimates: "the ultimates' time stops only, her own too",
    },
  },
  {
    id: "window-reaction",
    question: "Which element does an `element: \"window\"` application (Arcane's WILL combo touch, in-game test 33) take when the event that opened the window was an Arts reaction: the infliction the reaction consumed, or the element it applied?",
    default: "consumed",
    readings: {
      consumed: "the consumed infliction (round 6, 2026-11-12; round 5 ruled the applied element out on b74c, a multi-target log: Nature onto Cryst, then a Cryst burst)",
      applied: "the reaction's own element (2026-11-25)",
    },
  },
  {
    id: "finisher-stagger",
    question: "Does a finisher's hit that lands after the Stagger's end still deal with the Stagger's parts (its multiplier, DamageToBrokenUnitIncrease and the modifiers of Staggered enemies; timeline/landing.ts), as the Stagger a finisher needs to be cast?",
    default: "cast",
    readings: {
      cast: "every finisher hit deals as on a Staggered enemy",
      hit: "each hit as the enemy is at its landing (the engine until 2026-11-24)",
    },
  },
  {
    id: "finisher-ultimate",
    question: "Does a finisher's disable-cast buff (buff_common_power_attack_disable_cast_skill, the finisher's frames 0 to its last hit or past it) hold the operator's ultimate, as it holds her battle skill and combo (timeline/timing.ts afterCantCast)?",
    default: "cuts",
    readings: {
      cuts: "it doesn't: an ultimate pressed inside it starts at once and cuts the finisher, whose hits still to come never land",
      held: "it holds every cast, the ultimate too (the engine until 2026-11-23)",
    },
  },
  {
    id: "stagger-freeze",
    test: "110",
    question: "Does a freezing control status (Si's Immobilization, Tangtang's OLDEN STARE, Rossi's ultimate) hold a running Stagger's end (timeline/actions.ts runTriggers)?",
    default: "held",
    readings: {
      held: "held: the Stagger runs on the enemy's clock, which the freeze stops",
      runs: "runs on: the freeze holds the enemy's other timers, not its Stagger",
    },
  },
];

/** Every engine assumption: the simulation's, then the log replay's (replay-assumptions.ts). */
export const ENGINE_ASSUMPTIONS: readonly EngineAssumption[] = [...SIMULATION_ASSUMPTIONS, ...REPLAY_ASSUMPTIONS];

const BY_ID = new Map(ENGINE_ASSUMPTIONS.map((a) => [a.id, a]));

/** A read of an assumption (traceReadings): its id, the reading, and whether the run's readings gave it (false: the default). */
export interface ReadingRead {
  readonly id: string;
  readonly reading: string;
  readonly given: boolean;
}

let tracer: ((read: ReadingRead) => void) | undefined;

/**
 * Runs `run` with every assumption read (readingOf, engineReading) reported to `onRead`: a test's handle on which
 * readers took the run's readings (tests/assumption-readers.test.ts). Nests: the outer tracer is back afterwards.
 */
export function traceReadings<T>(onRead: (read: ReadingRead) => void, run: () => T): T {
  const outer = tracer;
  tracer = onRead;
  try {
    return run();
  } finally {
    tracer = outer;
  }
}

/**
 * The reading of assumption `id` under `assume`, else its default: an engine assumption's, or, with `known`, one of
 * those (a kit's: kitAssumptions). Every reader outside the timeline calls this with the readings its run was given,
 * never a default of its own; an unknown id is an error.
 */
export function readingOf(assume: Readings | undefined, id: string, known?: readonly KitAssumption[]): string {
  const a = known ? known.find((x) => x.id === id) : BY_ID.get(id);
  if (!a) throw new EngineError(`no ${known ? "" : "engine "}assumption ${id}`);
  const given = assume?.[id];
  tracer?.({ id, reading: given ?? a.default, given: given !== undefined });
  return given ?? a.default;
}

/** The reading of an engine assumption a scenario runs under: its options' `assume`, else the default. */
export function engineReading(scenario: Pick<TimelineScenario, "options">, id: string): string {
  return readingOf(scenario.options.assume, id);
}
