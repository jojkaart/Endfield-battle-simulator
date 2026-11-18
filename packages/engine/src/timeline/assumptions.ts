// The engine's own open readings: rules the engine applies to every kit that an in-game test or the logs decided
// only in part, registered like the kits' assumptions (OperatorKit.assumptions) so they switch the same way:
// TimelineOptions.assume (`--assume <id>=<reading>` in rules, gear, diagnose, `zmdlogs check`, scripts/measure.ts),
// each reading's code next to the rule's. The default is the reading the engine stands by; switching one is an
// experiment, not an edit (the round-3 friction reports: boss freezes, the teammates' pause and freeze rules were
// decided one way with no switch back).
//
// Each entry's ID must be unique across the engine's and the kits' assumptions (tests/engine-assumptions.test.ts checks it).

import { EngineError } from "../errors.ts";
import type { KitAssumption } from "../model.ts";
import type { TimelineScenario } from "./state.ts";

/** An engine reading: like a kit's (id, the in-game test that decides it, question, default, readings), with no operator. */
export type EngineAssumption = KitAssumption;

export const ENGINE_ASSUMPTIONS: readonly EngineAssumption[] = [
  {
    id: "control-immunity",
    test: "104",
    question: "Which enemies ignore a freezing control status's freeze (Si's Immobilization, Tangtang's OLDEN STARE)? An immune enemy's clock runs on; only the freezing operator's own debuffs on it are held (timeline/clock.ts controlImmune, actions.ts runTriggers).",
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
      held: "held: its timer starts when the world's clock runs again (Laevatain's Twilight, created at her ultimate's frame 0, lasts 15 s after her own stop: every closed Twilight window in the logs ends later than 15 s from the press allows; Typhoeus's Hail of Arrows window created inside Gilberta's and Arcane's stops, d9e59d0fb737) (2026-11-18)",
      ultimates: "held by the rest of a running ultimate's time stop, not by a combo's slow-down (measured 2026-11-18 against held: development plain 50.0 → 49.8%, hold-out 66.1 → 65.9%, 11 development logs worse, 3 better)",
      runs: "runs: its timer starts at once; only a stop that begins later holds it (the engine until 2026-11-18)",
    },
  },
  {
    id: "battle-sub-skills",
    test: "29",
    question: "Does a battle-type sub-skill's cast (SkillData normalSkillSubType 1: Si's Initial and Final Stroke, Liino's End Stance, Camille's, Mi Fu's and Purrchena's follow-ups) count as a battle-skill cast for triggers that listen by skill type (CheckSkillType [2]: Type 50 Yinglung's Edge, talents on a battle-skill cast)? Link isn't part of it.",
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

/** The reading of an engine assumption a scenario runs under: its options' `assume`, else the default. */
export function engineReading(scenario: Pick<TimelineScenario, "options">, id: string): string {
  const a = ENGINE_ASSUMPTIONS.find((x) => x.id === id);
  if (!a) throw new EngineError(`no engine assumption ${id}`);
  return scenario.options.assume?.[id] ?? a.default;
}
