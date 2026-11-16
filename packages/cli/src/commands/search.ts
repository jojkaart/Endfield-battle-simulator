// efsim search: a rotation for the scenario's team (one fight, or an opener and a loop).

import { command } from "../command.ts";
import { loopCommand, readScenario, searchCommand } from "../simulate.ts";
import { BATTLE_OPTIONS, withBattleOptions, withDuration } from "./shared.ts";

/** --setup's mode. */
function setupMode(v: string): "score" | "share" {
  if (v !== "score" && v !== "share") throw new Error(`--setup must be score or share`);
  return v;
}

export default command({
  name: "search",
  usage: `  efsim search <scenario.json>            Find a rotation for the scenario's team (its rotation is ignored)
                [--beam n] [--out file]   Beam width w (default 24): runs w/2, w and 2w, keeps the best and
                                          shows how far apart they are; save the rotation as a scenario
                [--single]                Only beam w (a third of the time, no spread)
                [--loop] [--loops n]      An opener and a loop instead of one fight: rounds from a cast of the
                                          slowest ultimate to its next, each the best closing plan at beam w
                                          or the last replayed, until one plays 3 more times exactly
                                          (--out saves the opener and n plays of the loop, default 4)
                [--rounds n]              With --loop: rounds searched at most (default 12)
                [--sync]                  With --loop: rounds from a moment every ultimate is ready to the
                                          next, each cast at least once (fast ones held for the slowest)
                [--prune]                 Drop dominated states and, by branch and bound on the payoff table's
                                          ceilings (efsim payoffs), states that can't beat the best so far
                [--no-macros]             Without the payoff table's chains (efsim payoffs) as one choice each
                                          where their first step is one (default: with them, in an extra
                                          half-beam share; finds more, takes 1.6–3.8× as long)
                [--skeletons]             Guide every width by three skeletons: the payoff table's chains and
                                          their merges scheduled greedily by value per second (extra beam share)
                [--setup score|share]     Count what the pieces a state holds are worth to payoffs it can still
                                          cast (the payoff table's ceilings): in the score, or only in the
                                          ranking of an extra half-beam share
                [--swaps]                 Let the rotation swap the controlled operator (default: never; the
                                          scenario's controlled operator does every basic attack and dive)
                [--seeds k]               With random outcomes: battles each candidate is ranked over (default 4)
                [--percentile p]          Rank by that percentile (0–100) of them instead of the mean
                [--runs n]                Battles for the found rotation's distribution (default 50; 0: none)
                [--seed n] [--dodge p] [--attack-every s]  As for simulate
`,
  options: {
    ...BATTLE_OPTIONS,
    duration: { type: "string" },
    beam: { type: "string", default: "24" },
    out: { type: "string" },
    single: { type: "boolean", default: false },
    loop: { type: "boolean", default: false },
    loops: { type: "string" },
    rounds: { type: "string" },
    sync: { type: "boolean", default: false },
    prune: { type: "boolean", default: false },
    macros: { type: "boolean", default: true },
    skeletons: { type: "boolean", default: false },
    setup: { type: "string" },
    swaps: { type: "boolean", default: false },
    seeds: { type: "string" },
    percentile: { type: "string" },
    runs: { type: "string" },
    verbose: { type: "boolean", default: false },
  },
  run: (ctx) => {
    ctx.need(1);
    const { values } = ctx;
    const seeds = values.seeds === undefined ? undefined : Number(values.seeds);
    if (seeds !== undefined && !(Number.isInteger(seeds) && seeds >= 1)) throw new Error(`--seeds must be a whole number ≥ 1`);
    const percentile = values.percentile === undefined ? undefined : Number(values.percentile);
    if (percentile !== undefined && !(percentile >= 0 && percentile <= 100)) throw new Error(`--percentile must be 0–100`);
    const runs = values.runs === undefined ? undefined : Number(values.runs);
    if (runs !== undefined && !(Number.isInteger(runs) && runs >= 0)) throw new Error(`--runs must be a whole number ≥ 0`);
    const beam = Number(values.beam);
    if (!(Number.isInteger(beam) && beam >= 1)) throw new Error(`--beam must be a whole number ≥ 1`);
    const scenario = withDuration(values, withBattleOptions(values, readScenario(ctx.args[0] as string)));
    if (values.loop) {
      const loops = values.loops === undefined ? undefined : Number(values.loops);
      if (loops !== undefined && !(Number.isInteger(loops) && loops >= 1)) throw new Error(`--loops must be a whole number ≥ 1`);
      const rounds = values.rounds === undefined ? undefined : Number(values.rounds);
      if (rounds !== undefined && !(Number.isInteger(rounds) && rounds >= 4)) throw new Error(`--rounds must be a whole number ≥ 4`);
      return loopCommand(ctx.data(), scenario, { beam, swaps: values.swaps, sync: values.sync, ...(values.out ? { out: values.out } : {}), ...(loops !== undefined ? { loops } : {}), ...(rounds !== undefined ? { rounds } : {}), progress: (line) => process.stderr.write(line + "\n") });
    }
    return searchCommand(ctx.data(), scenario, {
      beam,
      single: values.single,
      swaps: values.swaps,
      ...(values.out ? { out: values.out } : {}),
      ...(seeds !== undefined ? { seeds } : {}),
      ...(percentile !== undefined ? { percentile } : {}),
      ...(runs !== undefined ? { runs } : {}),
      verbose: values.verbose,
      prune: values.prune,
      macros: values.macros,
      skeletons: values.skeletons,
      ...(values.setup !== undefined ? { setup: setupMode(values.setup) } : {}),
    });
  },
});
