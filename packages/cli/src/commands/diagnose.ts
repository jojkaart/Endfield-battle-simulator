// efsim diagnose: what a rule list leaves on the table, and marginal values.

import { command } from "../command.ts";
import { parseAssume, underAssume } from "../assume.ts";
import { diagnose, formatDiagnosis } from "../diagnose.ts";
import { readRuleList } from "../rules.ts";
import { readScenario } from "../simulate.ts";
import { opt, teamOperators, wholeAtLeast } from "./shared.ts";

export default command({
  name: "diagnose",
  usage: `  efsim diagnose <scenario.json> <rules.json>  What a rule list leaves on the table, averaged over reaction-delay
                                          seeds (common random numbers): per operator ultimate energy gained
                                          (by source), spent, wasted at the cap, time ready but not cast (and
                                          why), combos lit but unused, team SP at the cap, what drives the main
                                          damage dealer (other operators' effects and enemy states on its hits),
                                          damage shares, sustained DPS's spread (reaction delays vs crits);
                                          then marginal values: team sustained DPS for one gear-line-sized step
                                          of each stat gear offers on each operator; findings in plain words
                [--duration s] [--reaction s]  As for rules (default 300, 0.3)
                [--seeds k]               Seeds of the diagnosis (default 5)
                [--marginal-seeds k]      Seeds of each marginal value (default 4; 0: none)
                [--operator <op>]         Only this operator's marginal values (repeatable)
                [--workers n]             Worker threads (default: cores less one; 1: none)
                [--json]                  Everything as JSON
                [--assume <id>=<reading>] [--assumptions]  As for rules: the diagnosis under each other reading
`,
  options: {
    duration: { type: "string" },
    reaction: { type: "string" },
    seeds: { type: "string" },
    "marginal-seeds": { type: "string" },
    operator: { type: "string", multiple: true, default: [] },
    workers: { type: "string" },
    json: { type: "boolean", default: false },
    assume: { type: "string", multiple: true, default: [] },
    assumptions: { type: "boolean", default: false },
  },
  run: async (ctx) => {
    ctx.need(2);
    const { values, args, data } = ctx;
    const count = wholeAtLeast;
    const reaction = values.reaction === undefined ? undefined : Number(values.reaction);
    if (reaction !== undefined && !(reaction >= 0)) throw new Error("--reaction must be a number of seconds ≥ 0");
    const seconds = values.duration === undefined ? undefined : Number(values.duration);
    if (seconds !== undefined && !(seconds > 0)) throw new Error("--duration must be > 0");
    const scenario = underAssume(readScenario(args[0] as string), parseAssume(data(), values.assume));
    const team = scenario.team.map((b) => b.operator);
    const ops = teamOperators(values.operator, team, (op) => data().operators[op]?.name);
    const d = await diagnose(data(), scenario, readRuleList(args[1] as string), {
      ...opt("seconds", seconds),
      ...opt("reaction", reaction),
      ...opt("seeds", count(values.seeds, "seeds", 1)),
      ...opt("marginalSeeds", count(values["marginal-seeds"], "marginal-seeds", 0)),
      ...opt("workers", count(values.workers, "workers", 1)),
      ...(ops.length ? { operators: ops } : {}),
      assumptions: values.assumptions,
      progress: (line) => process.stderr.write(line + "\n"),
    });
    return values.json ? JSON.stringify(d, null, 2) : formatDiagnosis(data(), d, `Diagnosis of ${args[1]} on ${args[0]}: ${team.map((op) => data().operators[op]?.name ?? op).join(", ")}`);
  },
});
