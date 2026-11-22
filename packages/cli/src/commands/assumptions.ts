// efsim assumptions: every open assumption `--assume <id>=<reading>` takes (rules, gear, diagnose, zmdlogs check and
// replay, scripts/measure.ts): the kits' (OperatorKit.assumptions) and the engine's own (timeline/assumptions.ts), each
// with its question, readings, default and the in-game test it waits on (round-4 friction: an agent wrote a scratch
// script around allAssumptions to find the ids).

import { allAssumptions, type GameData } from "@efsim/engine";
import { command } from "../command.ts";

/** The text of `efsim assumptions` (`filter`: only ids, operators or questions matching it). */
export function assumptionsList(data: GameData, filter?: RegExp): string {
  const all = allAssumptions(data).filter((a) => !filter || filter.test(a.id) || filter.test(a.question) || filter.test(a.operator ?? "engine") || filter.test(data.operators[a.operator ?? ""]?.name ?? ""));
  const owner = (op: string | undefined) => (op ? `${data.operators[op]?.name ?? op}'s kit (${op})` : "the engine (timeline/assumptions.ts)");
  const lines = all.flatMap((a) => [
    `${a.id}  (${owner(a.operator)}${a.test ? `; waits on ${a.test}` : ""})`,
    `  ${a.question}`,
    ...Object.entries(a.readings).map(([r, what]) => `  ${r === a.default ? "*" : " "} ${r}: ${what}`),
  ]);
  return [`${all.length} open assumption(s)${filter ? ` matching /${filter.source}/` : ""}; * marks the default reading. Another reading: --assume <id>=<reading> (repeatable).`, "", ...lines].join("\n");
}

export default command({
  name: "assumptions",
  usage: `  efsim assumptions [<regex>]             Every open assumption --assume takes (the kits' and the engine's): id, whose,
                                          the in-game test it waits on, the question, its readings (* the default);
                                          only those whose id, question or operator matches the regex
`,
  options: {},
  run: (ctx) => {
    if (ctx.args.length > 1) throw new Error("efsim assumptions takes at most one regex");
    return assumptionsList(ctx.data(), ctx.args[0] !== undefined ? new RegExp(ctx.args[0], "i") : undefined);
  },
});
