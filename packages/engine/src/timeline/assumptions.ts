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
    id: "teammate-pause",
    test: "101",
    question: "How long does a teammate (an operator not controlled) pause after a full basic-attack chain (timeline/teammates.ts)?",
    default: "6.5s",
    readings: {
      "6.5s": "6.5 s: the share of free time the logs show teammates attacking (test 101, 2026-11-16)",
      "3.5s": "3.5 s: the median of the logs' gaps over 1.5 s alone (the calibration of 2026-10-28)",
    },
  },
];

/** The reading of an engine assumption a scenario runs under: its options' `assume`, else the default. */
export function engineReading(scenario: Pick<TimelineScenario, "options">, id: string): string {
  const a = ENGINE_ASSUMPTIONS.find((x) => x.id === id);
  if (!a) throw new EngineError(`no engine assumption ${id}`);
  return scenario.options.assume?.[id] ?? a.default;
}
