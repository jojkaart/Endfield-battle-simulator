#!/usr/bin/env node
// efsim: Endfield battle simulator command line.

import { readdirSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGameData } from "@efsim/data";
import type { CritMode, TimelineScenario } from "@efsim/engine";
import { calc, compare, find, readBuild, template, type CalcOptions } from "./commands.ts";
import { kitDraft } from "./kitdraft.ts";
import { formatRuns, formatSimulation, loopCommand, readScenario, searchCommand } from "./simulate.ts";
import { checkLog, engineHits, engineReport, findScales, formatLogCheck, formatSimulatedLog, impliedScales, logBuffReplay, simulateLog } from "./logcheck.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
import { importBattle, readLogFixture, refreshFixture } from "./logs.ts";
import { checkReactions, formatReactionCheck } from "./reactioncheck.ts";
import { formatCensus, kitCensus } from "./census.ts";
import { formatTrim, kitTrim } from "./kittrim.ts";
import { knifeEdge, type EdgePool } from "./edge.ts";
import { fixtureTiming, formatTimingReport } from "./bufftiming.ts";
import { formatPayoffs, runPayoffs } from "./payoffs.ts";

const USAGE = `Usage:
  efsim find <text>                       Look up operator, weapon, gear and enemy IDs by name
  efsim template <operator> [--weapon id] Print a build file to start from
  efsim calc <build.json> [options]       Stat panel and damage per hit
  efsim compare <a.json> <b.json> [opts]  Two builds of one operator side by side
  efsim edge <build.json> <pool.json>     Loadouts from owned weapons and gear that put a mode's two attributes
                                          on a knife edge (Arcane's INT / WILL; pool: {weapons?, gear}; --top n)
  efsim simulate <scenario.json>          Run a team rotation on the timeline (--verbose: every hit); with
                                          expected crits also the total's distribution (mean, standard
                                          deviation, 5–95%, bounds)
                [--seed n]                Seed of the battle's rolls (scenario crit "rolled")
                [--battles k]             Seeded battles for the distribution when random outcomes change
                                          what follows (crit-triggered effects, dodges, chances; default 8)
                [--runs n]                n battles with rolled crits: the spread of the damage
                [--attack-every s]        The enemy attacks the controlled operator every s seconds
                [--dodge p]               Dash at every enemy attack, perfect with chance p (0–1)
  efsim search <scenario.json>            Find a rotation for the scenario's team (its rotation is ignored)
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
                [--swaps]                 Let the rotation swap the controlled operator (default: never; the
                                          scenario's controlled operator does every basic attack and dive)
                [--seeds k]               With random outcomes: battles each candidate is ranked over (default 4)
                [--percentile p]          Rank by that percentile (0–100) of them instead of the mean
                [--runs n]                Battles for the found rotation's distribution (default 50; 0: none)
                [--seed n] [--dodge p] [--attack-every s]  As for simulate
  efsim payoffs <scenario.json>           The team's payoff table (engine probes): what each step produces and
                                          which combo windows it opens, each damaging step's ceiling under the
                                          best bundle of what the team achieves (and who achieves each piece),
                                          and chains in which each step opens or sets up the next; with a
                                          rotation, how close its casts came to their ceilings
                [--top n] [--json]        Rows printed per table (default 15; data is never cut); everything as JSON
                [--depth n]               Longest chain (default 6)
  efsim zmdlogs import <battle id>        Turn a ZMDLogs battle into fixtures/zmdlogs-<id>.json
                                          (fixtures/multi-target/ when it hit several enemies)
                [--enemy-level n]         (default: the stage's, else inferred from total damage on a clear)
                [--detail file]           Use an already downloaded /api/battles/<id> response
                [--note text]             Extra provenance note (repeatable)
  efsim zmdlogs check <fixture.json>      Predict every logged hit and compare (kit buffs from the
                                          replay of the logged casts; where it and the log disagree;
                                          whether it verifies the fixture, matches per operator as
                                          plain / assumed / log-listing fallback, and their strength)
                [--log-buffs]             Kit buffs as the log lists them instead (the check before 2026-10-22)
                [--simulate]              Simulate the logged casts instead and compare each hit with its landing
                                          (crits, enemy HP and effects no kit models from the log)
  efsim zmdlogs timing [fixture…]         Buff timing report (a diagnostic, never scored): which kit buff's
                                          window, shifted, fits the hits the check doesn't (fallback, mismatch),
                                          as patterns across logs with mechanism candidates (default: every
                                          development log; hold-out logs are skipped)
                [--assumed]               Assumed matches too
                [--singles]               No pairs of toggles
                [--top n] [--verbose]     Patterns shown (default 20); every run, and each hit's best fit
  efsim zmdlogs reactions <fixture.json>  Replay the kits' inflictions; compare bursts and reactions
  efsim zmdlogs refresh <fixture.json> --detail <file>
                                          Add what a downloaded battle detail records that an older
                                          import lacks: casts without damage, each hit's Stagger
  efsim zmdlogs scales <fixture> <op>     Multiplier each logged hit of an operator implies
  efsim zmdlogs find-scales <fixture> <op> Skill values (keys) that explain each logged event
  efsim kit-draft <operator>              Draft a kit from SkillData (to verify against logs)
  efsim kit-census                        Kit features per operator, for the review after each new kit
  efsim kit-trim [--write]                Kit values the loader takes from the data anyway (--write removes them)

Options for calc and compare:
  --enemy <id>        Target (default eny_0051_rodin, Rhodagn)
  --level <n>         Enemy level (default 90)
  --crit <mode>       never | always | expected (default expected)
  --staggered         Target is staggered
  --buff <id>[:<n>]   Count a kit buff (own or equipment) as active, with n layers (repeatable; calc)
  --verbose           Every stat contribution and the zones of a hit
`;

/**
 * The logs the buff timing report reads: those named (paths, or ids under fixtures/pending/), else every development
 * log of fixtures/pending/holdout.json. Hold-out logs are never read (only counted as skipped): they're measured, never
 * debugged (docs/accuracy-plan.md, "Choosing logs").
 */
function timingFixtures(named: readonly string[]): { files: string[]; skipped: number } {
  const split = JSON.parse(readFileSync(join(ROOT, "fixtures/pending/holdout.json"), "utf8")) as { development: string[]; holdout: string[] };
  const holdout = new Set(split.holdout);
  const idOf = (f: string) => basename(f).replace(/\.json$/, "");
  const wanted = named.length ? named : split.development;
  const files = wanted.filter((f) => !holdout.has(idOf(f))).map((f) => (f.endsWith(".json") ? f : join(ROOT, "fixtures/pending", `${f.startsWith("zmdlogs-") ? f : `zmdlogs-${f}`}.json`)));
  return { files, skipped: wanted.length - files.length };
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      enemy: { type: "string", default: "eny_0051_rodin" },
      level: { type: "string", default: "90" },
      crit: { type: "string", default: "expected" },
      staggered: { type: "boolean", default: false },
      buff: { type: "string", multiple: true, default: [] },
      weapon: { type: "string" },
      "enemy-level": { type: "string" },
      detail: { type: "string" },
      note: { type: "string", multiple: true, default: [] },
      verbose: { type: "boolean", default: false },
      "log-buffs": { type: "boolean", default: false },
      simulate: { type: "boolean", default: false },
      beam: { type: "string", default: "24" },
      top: { type: "string" },
      single: { type: "boolean", default: false },
      swaps: { type: "boolean", default: false },
      loop: { type: "boolean", default: false },
      loops: { type: "string" },
      rounds: { type: "string" },
      sync: { type: "boolean", default: false },
      seed: { type: "string" },
      runs: { type: "string" },
      seeds: { type: "string" },
      battles: { type: "string" },
      percentile: { type: "string" },
      dodge: { type: "string" },
      "attack-every": { type: "string" },
      out: { type: "string" },
      write: { type: "boolean", default: false },
      assumed: { type: "boolean", default: false },
      singles: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      prune: { type: "boolean", default: false },
      depth: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, ...args] = positionals;
  if (values.help || !command) {
    process.stdout.write(USAGE);
    return command || values.help ? 0 : 1;
  }
  const crit = values.crit as CritMode;
  if (!["never", "always", "expected"].includes(crit)) throw new Error(`--crit must be never, always or expected`);
  const level = Number(values.level);
  if (!Number.isInteger(level) || level < 1) throw new Error(`--level must be a whole number`);
  const options: CalcOptions = {
    target: { enemy: values.enemy, level },
    crit,
    staggered: values.staggered,
    buffs: values.buff.map((b) => {
      const [buff, n] = b.split(":");
      const layers = n === undefined ? 1 : Number(n);
      if (!buff || !Number.isInteger(layers) || layers < 1) throw new Error(`--buff takes <id> or <id>:<layers>`);
      return { buff, layers };
    }),
    verbose: values.verbose,
  };

  const need = (n: number) => {
    if (args.length !== n) throw new Error(`${command} takes ${n} argument${n === 1 ? "" : "s"}\n\n${USAGE}`);
  };
  /** The scenario with --seed, --dodge and --attack-every applied (simulate and search). */
  const withBattleOptions = (scenario: TimelineScenario): TimelineScenario => {
    const seed = values.seed === undefined ? undefined : Number(values.seed);
    if (seed !== undefined && !(Number.isInteger(seed) && seed >= 0)) throw new Error(`--seed must be a whole number ≥ 0`);
    const chance = values.dodge === undefined ? undefined : Number(values.dodge);
    if (chance !== undefined && !(chance >= 0 && chance <= 1)) throw new Error(`--dodge must be a chance from 0 to 1`);
    const every = values["attack-every"] === undefined ? undefined : Number(values["attack-every"]);
    if (every !== undefined && !(every > 0)) throw new Error(`--attack-every must be a positive number of seconds`);
    return {
      ...scenario,
      options: { ...scenario.options, ...(seed !== undefined ? { seed } : {}), ...(chance !== undefined ? { dodge: { chance } } : {}) },
      ...(every !== undefined ? { enemyActions: [...(scenario.enemyActions ?? []), { kind: "attack" as const, every: every * 30 }] } : {}),
    };
  };
  // Loaded on first use, after the arguments and input files are checked (a mistake is reported without the load's wait).
  let loaded: ReturnType<typeof loadGameData> | undefined;
  const data = () => (loaded ??= loadGameData());
  let text: string;
  switch (command) {
    case "find":
      need(1);
      text = find(data(), args[0] as string);
      break;
    case "template":
      need(1);
      text = template(data(), args[0] as string, values.weapon);
      break;
    case "calc":
      need(1);
      {
        const build = readBuild(args[0] as string);
        text = calc(data(), build, options);
      }
      break;
    case "zmdlogs": {
      const [sub, arg, op] = args;
      if (sub === "timing") {
        const start = performance.now();
        const sel = timingFixtures(args.slice(1));
        const reports = sel.files.map((f) => {
          process.stderr.write(`timing ${basename(f)}\n`);
          return fixtureTiming(data(), readLogFixture(f), { assumed: values.assumed, pairs: !values.singles });
        });
        text = formatTimingReport(data(), reports, { verbose: values.verbose, skipped: sel.skipped, seconds: (performance.now() - start) / 1000, ...(values.top !== undefined ? { top: Number(values.top) } : {}) });
        break;
      }
      if ((sub === "scales" || sub === "find-scales") && arg && op) {
        const fx = readLogFixture(arg);
        if (sub === "scales") {
          const lines: string[] = [];
          for (const r of impliedScales(data(), fx, op)) {
            const s = r.bySkillType;
            lines.push(`${r.event} t=${r.t}${r.unquantified.length ? ` [${r.unquantified.join(",")}]` : ""} crit=${r.crit} value=${r.value}` +
              ` basic=${s.basic.toFixed(4)} battle=${s.battle.toFixed(4)} combo=${s.combo.toFixed(4)} ultimate=${s.ultimate.toFixed(4)}`);
          }
          text = lines.join("\n");
        } else {
          const lines: string[] = [];
          for (const m of findScales(data(), fx, op)) {
            lines.push(`${m.event} (${m.hits} hits)`);
            for (const x of m.matches) lines.push(`   ${x.agree}/${m.hits}  ${x.skillId} ${x.keys.join(" * ")} ${x.damageType}${x.corrosion ? ` corrosion L${x.corrosion}` : ""}`);
          }
          text = lines.join("\n");
        }
        break;
      }
      if (args.length !== 2 || !arg || (sub !== "import" && sub !== "check" && sub !== "reactions" && sub !== "refresh")) throw new Error(`zmdlogs takes import <battle id>, check <file>, reactions <file>, refresh <file> --detail <file>, scales <file> <op> or find-scales <file> <op>\n\n${USAGE}`);
      if (sub === "refresh") {
        if (!values.detail) throw new Error("zmdlogs refresh needs --detail <file> (an already downloaded /api/battles/<id> response)");
        const r = refreshFixture(arg, values.detail);
        text = `${arg}: ${r.casts} cast(s), ${r.poise} hit(s) with Stagger`;
      } else if (sub === "reactions") {
        const fx = readLogFixture(arg);
        text = formatReactionCheck(checkReactions(data(), fx));
      } else if (sub === "check") {
        const fx = readLogFixture(arg);
        if (values.simulate) {
          text = formatSimulatedLog(data(), fx, simulateLog(data(), fx));
          break;
        }
        const replay = values["log-buffs"] ? null : logBuffReplay(data(), fx);
        const byHit = replay ? engineHits(data(), fx, replay) : undefined;
        const verdicts = checkLog(data(), fx, replay ? { replay, ...(byHit ? { engineHits: byHit } : {}) } : { buffs: "log" });
        text = formatLogCheck(data(), fx, verdicts, replay ?? undefined, replay && byHit ? engineReport(data(), fx, replay, byHit, verdicts) : undefined);
      } else {
        const file = await importBattle(data(), arg, values["enemy-level"] === undefined ? undefined : Number(values["enemy-level"]), values.note, values.detail);
        text = `wrote ${file}`;
      }
      break;
    }
    case "simulate":
      need(1);
      {
        const seeded = withBattleOptions(readScenario(args[0] as string));
        const runs = values.runs === undefined ? undefined : Number(values.runs);
        if (runs !== undefined && !(Number.isInteger(runs) && runs >= 1)) throw new Error(`--runs must be a whole number ≥ 1`);
        const battles = values.battles === undefined ? undefined : Number(values.battles);
        if (battles !== undefined && !(Number.isInteger(battles) && battles >= 1)) throw new Error(`--battles must be a whole number ≥ 1`);
        text = runs === undefined ? formatSimulation(data(), seeded, values.verbose, battles) : formatRuns(data(), seeded, runs);
      }
      break;
    case "search":
      need(1);
      {
        const seeds = values.seeds === undefined ? undefined : Number(values.seeds);
        if (seeds !== undefined && !(Number.isInteger(seeds) && seeds >= 1)) throw new Error(`--seeds must be a whole number ≥ 1`);
        const percentile = values.percentile === undefined ? undefined : Number(values.percentile);
        if (percentile !== undefined && !(percentile >= 0 && percentile <= 100)) throw new Error(`--percentile must be 0–100`);
        const runs = values.runs === undefined ? undefined : Number(values.runs);
        if (runs !== undefined && !(Number.isInteger(runs) && runs >= 0)) throw new Error(`--runs must be a whole number ≥ 0`);
        const beam = Number(values.beam);
        if (!(Number.isInteger(beam) && beam >= 1)) throw new Error(`--beam must be a whole number ≥ 1`);
        const scenario = withBattleOptions(readScenario(args[0] as string));
        if (values.loop) {
          const loops = values.loops === undefined ? undefined : Number(values.loops);
          if (loops !== undefined && !(Number.isInteger(loops) && loops >= 1)) throw new Error(`--loops must be a whole number ≥ 1`);
          const rounds = values.rounds === undefined ? undefined : Number(values.rounds);
          if (rounds !== undefined && !(Number.isInteger(rounds) && rounds >= 4)) throw new Error(`--rounds must be a whole number ≥ 4`);
          text = loopCommand(data(), scenario, { beam, swaps: values.swaps, sync: values.sync, ...(values.out ? { out: values.out } : {}), ...(loops !== undefined ? { loops } : {}), ...(rounds !== undefined ? { rounds } : {}), progress: (line) => process.stderr.write(line + "\n") });
          break;
        }
        text = searchCommand(data(), scenario, {
          beam,
          single: values.single,
          swaps: values.swaps,
          ...(values.out ? { out: values.out } : {}),
          ...(seeds !== undefined ? { seeds } : {}),
          ...(percentile !== undefined ? { percentile } : {}),
          ...(runs !== undefined ? { runs } : {}),
          verbose: values.verbose,
          prune: values.prune,
        });
      }
      break;
    case "payoffs":
      need(1);
      {
        const depth = values.depth === undefined ? undefined : Number(values.depth);
        if (depth !== undefined && !(Number.isInteger(depth) && depth >= 2)) throw new Error(`--depth must be a whole number ≥ 2`);
        const run = runPayoffs(data(), readScenario(args[0] as string), depth !== undefined ? { depth } : {});
        text = values.json ? JSON.stringify(run, (_k, v: unknown) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v), 2) : formatPayoffs(data(), run, values.top === undefined ? 15 : Number(values.top));
      }
      break;
    case "kit-census":
      text = formatCensus(kitCensus());
      break;
    case "kit-trim":
      text = formatTrim(kitTrim(data(), values.write), values.write);
      break;
    case "kit-draft": {
      need(1);
      const op = args[0] as string;
      const logged = new Map<string, number>();
      for (const f of readdirSync(join(ROOT, "fixtures")).filter((x) => x.startsWith("zmdlogs-"))) {
        for (const h of readLogFixture(join(ROOT, "fixtures", f)).hits) if (h.operator === op) logged.set(h.event, (logged.get(h.event) ?? 0) + 1);
      }
      text = kitDraft(data(), op, logged);
      break;
    }
    case "compare":
      need(2);
      {
        const builds = [readBuild(args[0] as string), readBuild(args[1] as string)] as const;
        text = compare(data(), builds[0], builds[1], options, [basename(args[0] as string), basename(args[1] as string)]);
      }
      break;
    case "edge":
      need(2);
      {
        const build = readBuild(args[0] as string);
        const pool = JSON.parse(readFileSync(args[1] as string, "utf8")) as EdgePool;
        if (!Array.isArray(pool.gear)) throw new Error(`${args[1]}: a pool has "gear": [{ "id", "artifice" }] (and optional "weapons")`);
        text = knifeEdge(data(), build, pool, values.top === undefined ? 5 : Number(values.top));
      }
      break;
    default:
      throw new Error(`unknown command ${command}\n\n${USAGE}`);
  }
  process.stdout.write(text + "\n");
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`efsim: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
