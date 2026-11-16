// efsim payoffs: the team's payoff table and chains.

import { command } from "../command.ts";
import { formatPayoffs, runPayoffs } from "../payoffs.ts";
import { readScenario } from "../simulate.ts";

export default command({
  name: "payoffs",
  usage: `  efsim payoffs <scenario.json>           The team's payoff table (engine probes): what each step produces and
                                          which combo windows it opens, each damaging step's ceiling under the
                                          best bundle of what the team achieves (and who achieves each piece),
                                          and chains in which each step opens or sets up the next; with a
                                          rotation, how close its casts came to their ceilings
                [--top n] [--json]        Rows printed per table (default 15; data is never cut); everything as JSON
                [--depth n]               Longest chain (default 6)
`,
  options: { top: { type: "string" }, json: { type: "boolean", default: false }, depth: { type: "string" } },
  run: (ctx) => {
    ctx.need(1);
    const { values } = ctx;
    const depth = values.depth === undefined ? undefined : Number(values.depth);
    if (depth !== undefined && !(Number.isInteger(depth) && depth >= 2)) throw new Error(`--depth must be a whole number ≥ 2`);
    const run = runPayoffs(ctx.data(), readScenario(ctx.args[0] as string), depth !== undefined ? { depth } : {});
    return values.json ? JSON.stringify(run, (_k, v: unknown) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v), 2) : formatPayoffs(ctx.data(), run, values.top === undefined ? 15 : Number(values.top));
  },
});
