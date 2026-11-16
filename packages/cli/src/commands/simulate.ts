// efsim simulate: a team rotation on the timeline.

import { command } from "../command.ts";
import { formatRuns, formatSimulation, readScenario } from "../simulate.ts";
import { BATTLE_OPTIONS, withBattleOptions, withDuration } from "./shared.ts";

export default command({
  name: "simulate",
  usage: `  efsim simulate <scenario.json>          Run a team rotation on the timeline (--verbose: every hit); with
                                          expected crits also the total's distribution (mean, standard
                                          deviation, 5–95%, bounds)
                [--duration s]            Fight length instead of the scenario's (also for search)
                [--seed n]                Seed of the battle's rolls (scenario crit "rolled")
                [--battles k]             Seeded battles for the distribution when random outcomes change
                                          what follows (crit-triggered effects, dodges, chances; default 8)
                [--runs n]                n battles with rolled crits: the spread of the damage
                [--attack-every s]        The enemy attacks the controlled operator every s seconds
                [--dodge p]               Dash at every enemy attack, perfect with chance p (0–1)
`,
  options: { ...BATTLE_OPTIONS, duration: { type: "string" }, runs: { type: "string" }, battles: { type: "string" }, verbose: { type: "boolean", default: false } },
  run: (ctx) => {
    ctx.need(1);
    const { values } = ctx;
    const seeded = withDuration(values, withBattleOptions(values, readScenario(ctx.args[0] as string)));
    const runs = values.runs === undefined ? undefined : Number(values.runs);
    if (runs !== undefined && !(Number.isInteger(runs) && runs >= 1)) throw new Error(`--runs must be a whole number ≥ 1`);
    const battles = values.battles === undefined ? undefined : Number(values.battles);
    if (battles !== undefined && !(Number.isInteger(battles) && battles >= 1)) throw new Error(`--battles must be a whole number ≥ 1`);
    return runs === undefined ? formatSimulation(ctx.data(), seeded, values.verbose, battles) : formatRuns(ctx.data(), seeded, runs);
  },
});
