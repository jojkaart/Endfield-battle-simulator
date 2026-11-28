// efsim assumptions: every open assumption `--assume <id>=<reading>` takes (rules, gear, diagnose, zmdlogs check and
// replay, scripts/measure.ts): the kits' (OperatorKit.assumptions) and the engine's own (packages/engine/src
// assumptions.ts, the simulation's; replay-assumptions.ts, the log replay's), each with its question, readings,
// default and the in-game test it waits on (round-4 friction: an agent wrote a scratch script around allAssumptions
// to find the ids), and the engine's evidence from docs/design/assumptions.md (round 19: the evidence out of the
// engine's source, which the game-data cache keys on).

import { readFileSync } from "node:fs";
import { allAssumptions, REPLAY_ASSUMPTIONS, type GameData } from "@efsim/engine";
import { command } from "../command.ts";

/** docs/design/assumptions.md: the evidence of the engine's readings. */
export const ASSUMPTION_NOTES = new URL("../../../../docs/design/assumptions.md", import.meta.url);

/** One assumption's evidence (assumptionNotes): its question's, and each reading's that has some. */
export interface AssumptionNote {
  readonly question?: string;
  readonly readings: ReadonlyMap<string, string>;
}

/**
 * The evidence of the engine's readings by assumption id, from docs/design/assumptions.md's form: a `## <id>` heading,
 * a paragraph of the question's evidence, then an item per reading (a dash, the reading in backticks, a colon, the
 * evidence; continuation lines indented). The text before the first heading is the doc's own.
 */
export function assumptionNotes(text: string = readFileSync(ASSUMPTION_NOTES, "utf8")): ReadonlyMap<string, AssumptionNote> {
  const out = new Map<string, AssumptionNote>();
  for (const section of text.split(/^## /m).slice(1)) {
    const [head, ...body] = section.split("\n");
    const id = (head ?? "").trim();
    const question: string[] = [];
    const readings = new Map<string, string>();
    let item: string | undefined;
    for (const line of body) {
      const m = /^- `([^`]+)`: (.*)$/.exec(line);
      if (m) {
        item = m[1] as string;
        readings.set(item, m[2] as string);
      } else if (item !== undefined && line.startsWith("  ") && line.trim()) readings.set(item, `${readings.get(item)} ${line.trim()}`);
      else if (line.trim()) {
        if (item !== undefined) throw new Error(`${ASSUMPTION_NOTES.pathname}: ## ${id}: a line after its readings that isn't one: ${line} (one item per reading, "- \`<reading>\`: …", continuation lines indented two spaces: the form at the top of the file)`);
        question.push(line.trim());
      }
    }
    if (out.has(id)) throw new Error(`${ASSUMPTION_NOTES.pathname}: ## ${id} twice`);
    out.set(id, { ...(question.length ? { question: question.join(" ") } : {}), readings });
  }
  return out;
}

/** The text of `efsim assumptions` (`filter`: only ids, operators or questions matching it). */
export function assumptionsList(data: GameData, filter?: RegExp): string {
  const notes = assumptionNotes();
  const replay = new Set(REPLAY_ASSUMPTIONS.map((a) => a.id));
  const all = allAssumptions(data).filter((a) => !filter || filter.test(a.id) || filter.test(a.question) || filter.test(a.operator ?? "engine") || filter.test(data.operators[a.operator ?? ""]?.name ?? ""));
  const owner = (a: { id: string; operator?: string }) =>
    a.operator ? `${data.operators[a.operator]?.name ?? a.operator}'s kit (${a.operator})` : replay.has(a.id) ? "the log replay (engine replay-assumptions.ts)" : "the engine (assumptions.ts)";
  const lines = all.flatMap((a) => {
    const note = a.operator ? undefined : notes.get(a.id);
    return [
      `${a.id}  (${owner(a)}${a.test ? `; waits on ${a.test}` : ""})`,
      `  ${a.question}`,
      ...(note?.question ? [`      ${note.question}`] : []),
      ...Object.entries(a.readings).flatMap(([r, what]) => [`  ${r === a.default ? "*" : " "} ${r}: ${what}`, ...(note?.readings.has(r) ? [`      ${note.readings.get(r)}`] : [])]),
    ];
  });
  return [`${all.length} open assumption(s)${filter ? ` matching /${filter.source}/` : ""}; * marks the default reading, an indented line the evidence (docs/design/assumptions.md). Another reading: --assume <id>=<reading> (repeatable).`, "", ...lines].join("\n");
}

export default command({
  name: "assumptions",
  usage: `  efsim assumptions [<regex>]             Every open assumption --assume takes (the kits' and the engine's): id, whose,
                                          the in-game test it waits on, the question, its readings (* the default),
                                          the engine's evidence (docs/design/assumptions.md); only those whose id,
                                          question or operator matches the regex
`,
  options: {},
  run: (ctx) => {
    if (ctx.args.length > 1) throw new Error("efsim assumptions takes at most one regex");
    return assumptionsList(ctx.data(), ctx.args[0] !== undefined ? new RegExp(ctx.args[0], "i") : undefined);
  },
});
