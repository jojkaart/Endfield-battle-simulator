// efsim rules: a rule-based rotation played by a simulated player (and its local or guided search).

import { command } from "../command.ts";
import { parseAssume, underAssume, zeroCompanion } from "../assume.ts";
import { formatGuided, guidedSearch, writeGuided } from "../guided.ts";
import { readRuleList, rulesCommand } from "../rules.ts";
import { readScenario } from "../simulate.ts";
import { BATTLE_OPTIONS, opt, wholeAtLeast, withBattleOptions } from "./shared.ts";

export default command({
  name: "rules",
  usage: `  efsim rules <scenario.json> <rules.json> A rule-based rotation (opener, then "when cue X is visible, do Y";
                                          schemas/rules.schema.json) played by a simulated player with a
                                          reaction delay over a long fight: sustained DPS after the opener,
                                          its spread over seeds, robustness to the delay, rules fired,
                                          learnability; the scenario's own rotation as the 60 s reference
                [--duration s]            Fight length (default 300)
                [--reaction s]            Reaction delay (default 0.3, jittered ±50%, seeded; 0: a bot)
                [--seeds k]               Delay seeds (default 5)
                [--first-seed n]          The first of them (default 1; 1001: fresh seeds, for numbers to write down)
                [--search] [--out file]   Local search over rule lists from this one: the Pareto front of DPS
                                          against complexity, the best (less --penalty a complexity point,
                                          default 0.002) saved to --out
                [--iterations n]          Lists scored (default 150)
                [--search-seconds s]      Searched fights' length (default 180)
                [--search-seeds k]        Seeds per list in the search (default 2)
                [--front n]               Front lists scored again over the whole fight (default 8)
                [--compare <rules.json>]  Another list against this one: the paired gain ± standard error on seeds
                                          1–k and on fresh seeds 1001… (--fresh n, default 32; 0: none)
                [--assume <id>=<reading>] Run under another reading of a kit's open assumption (repeatable; e.g.
                                          si-haste-every-end=every-end, in-game test 109; the kits register them)
                [--assumptions]           Also under each other reading of the team's kits' open assumptions: the
                                          list's DPS and whether --compare's verdict holds or flips there
                [--workers n]             Worker threads (default: cores less one; 1: none)
                [--guided] [--out file]   The payoff-guided search instead: each damage window's ideal combo (every
                                          multiplier the team puts on it, on every hit) and what each missing one
                                          costs; edits aimed at the biggest losses (hold the giver for the window's
                                          visible cue, chain the presses, start the window when the multiplier is up,
                                          save SP, "shows", spare SP; a few random moves), screened on common seeds,
                                          the best played on more, one kept a round when its gain clears twice its
                                          standard error; achievement before / after; the final list to --out
                [--rounds n] [--edits n] [--random n]  Rounds at most (default 6), directed edits a round
                                          (default 28), random ones added (default 4)
                [--screen-seeds k] [--confirm-seeds k] [--extend n]  Seeds each edit is screened on (default 6),
                                          the best n (default 4) are played on (default 32)
                [--max-seeds k]           Seeds a close call (1.2 to 2 standard errors) is taken to (default 64)
                [--also <scenario.json>]  A second start of the fight: the best edits are played on it too, and one is
                                          kept only if it isn't worse there (by more than one standard error);
                                          default: the zero-energy companion (<team>-zero.scenario.json) if there is
                                          one. --assume, --assumptions (the final check under each other reading) and
                                          --out (written as rounds keep lists, then the final one) as above
                [--check-seeds k] [--workers n]  The final list against the start on k fresh seeds (default the
                                          confirm seeds; 0: none); worker threads (default: cores less one)
`,
  options: {
    ...BATTLE_OPTIONS,
    duration: { type: "string" },
    reaction: { type: "string" },
    seeds: { type: "string" },
    "first-seed": { type: "string" },
    search: { type: "boolean", default: false },
    out: { type: "string" },
    iterations: { type: "string" },
    "search-seconds": { type: "string" },
    "search-seeds": { type: "string" },
    penalty: { type: "string" },
    front: { type: "string" },
    compare: { type: "string" },
    fresh: { type: "string" },
    assume: { type: "string", multiple: true, default: [] },
    assumptions: { type: "boolean", default: false },
    workers: { type: "string" },
    guided: { type: "boolean", default: false },
    rounds: { type: "string" },
    edits: { type: "string" },
    random: { type: "string" },
    "screen-seeds": { type: "string" },
    "confirm-seeds": { type: "string" },
    extend: { type: "string" },
    "max-seeds": { type: "string" },
    also: { type: "string" },
    "check-seeds": { type: "string" },
  },
  run: async (ctx) => {
    ctx.need(2);
    const { values, args, data } = ctx;
    const positive = (v: string | undefined, name: string, whole = false) => {
      if (v === undefined) return undefined;
      const x = Number(v);
      if (!(x > 0) || (whole && !Number.isInteger(x))) throw new Error(`--${name} must be a ${whole ? "whole " : ""}number > 0`);
      return x;
    };
    const reaction = values.reaction === undefined ? undefined : Number(values.reaction);
    if (reaction !== undefined && !(reaction >= 0)) throw new Error("--reaction must be a number of seconds ≥ 0");
    const penalty = values.penalty === undefined ? undefined : Number(values.penalty);
    if (penalty !== undefined && !(penalty >= 0)) throw new Error("--penalty must be ≥ 0");
    if (values.guided) {
      const count = wholeAtLeast;
      const scenario = underAssume(withBattleOptions(values, readScenario(args[0] as string)), parseAssume(data(), values.assume));
      const team = scenario.team.map((b) => b.operator);
      const also = values.also ?? zeroCompanion(args[0] as string);
      const g = await guidedSearch(data(), scenario, readRuleList(args[1] as string), {
        ...opt("seconds", positive(values.duration, "duration")),
        ...opt("reaction", reaction),
        ...opt("screenSeeds", count(values["screen-seeds"], "screen-seeds", 2)),
        ...opt("confirmSeeds", count(values["confirm-seeds"], "confirm-seeds", 2)),
        ...opt("checkSeeds", count(values["check-seeds"], "check-seeds", 0)),
        ...opt("maxSeeds", count(values["max-seeds"], "max-seeds", 2)),
        ...(also ? { also: { scenario: underAssume(withBattleOptions(values, readScenario(also)), parseAssume(data(), values.assume)), label: also } } : {}),
        assumptions: values.assumptions,
        ...(values.out ? { out: values.out } : {}),
        ...opt("extend", count(values.extend, "extend", 1)),
        ...opt("rounds", count(values.rounds, "rounds", 1)),
        ...opt("candidates", count(values.edits, "edits", 1)),
        ...opt("random", count(values.random, "random", 0)),
        ...opt("penalty", penalty),
        ...opt("workers", count(values.workers, "workers", 1)),
        progress: (line) => process.stderr.write(line + "\n"),
      });
      let text = formatGuided(data(), g, `Guided rule search: ${team.map((op) => data().operators[op]?.name ?? op).join(", ")}`, args[1] as string);
      if (values.out) {
        writeGuided(g, values.out, args[1] as string);
        text += `\n\nWrote ${values.out} (the final list).`;
      }
      return text;
    }
    return rulesCommand(data(), underAssume(withBattleOptions(values, readScenario(args[0] as string)), parseAssume(data(), values.assume)), readRuleList(args[1] as string), args[1] as string, {
      ...opt("seconds", positive(values.duration, "duration")),
      ...opt("reactionSeconds", reaction),
      ...opt("seeds", positive(values.seeds, "seeds", true)),
      search: values.search,
      ...opt("iterations", positive(values.iterations, "iterations", true)),
      ...opt("searchSeconds", positive(values["search-seconds"], "search-seconds")),
      ...opt("searchSeeds", positive(values["search-seeds"], "search-seeds", true)),
      ...opt("penalty", penalty),
      ...opt("front", positive(values.front, "front", true)),
      ...(values.out ? { out: values.out } : {}),
      ...(values.compare ? { compare: { list: readRuleList(values.compare), file: values.compare } } : {}),
      ...(values.fresh !== undefined ? { fresh: Number(values.fresh) } : {}),
      ...opt("firstSeed", positive(values["first-seed"], "first-seed", true)),
      ...opt("workers", positive(values.workers, "workers", true)),
      assumptions: values.assumptions,
      progress: (line) => process.stderr.write(line + "\n"),
    });
  },
});
