#!/usr/bin/env node
// efsim: Endfield battle simulator command line.

import { readdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGameData } from "@efsim/data";
import type { CritMode } from "@efsim/engine";
import { calc, compare, find, readBuild, template, type CalcOptions } from "./commands.ts";
import { kitDraft } from "./kitdraft.ts";
import { formatRuns, formatSimulation, readScenario, searchCommand } from "./simulate.ts";
import { checkLog, findScales, formatLogCheck, impliedScales } from "./logcheck.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
import { importBattle, readLogFixture } from "./logs.ts";
import { checkReactions, formatReactionCheck } from "./reactioncheck.ts";
import { formatCensus, kitCensus } from "./census.ts";

const USAGE = `Usage:
  efsim find <text>                       Look up operator, weapon, gear and enemy IDs by name
  efsim template <operator> [--weapon id] Print a build file to start from
  efsim calc <build.json> [options]       Stat panel and damage per hit
  efsim compare <a.json> <b.json> [opts]  Two builds of one operator side by side
  efsim simulate <scenario.json>          Run a team rotation on the timeline (--verbose: every hit)
                [--seed n]                Seed of the battle's rolls (scenario crit "rolled")
                [--runs n]                n battles with rolled crits: the spread of the damage
                [--attack-every s]        The enemy attacks the controlled operator every s seconds
                [--dodge p]               Dash at every enemy attack, perfect with chance p (0–1)
  efsim search <scenario.json>            Find a rotation for the scenario's team (its rotation is ignored)
                [--beam n] [--out file]   Beam width (default 24); save the rotation as a scenario
  efsim zmdlogs import <battle id>        Turn a ZMDLogs battle into fixtures/zmdlogs-<id>.json
                [--enemy-level n]         (default: inferred from total damage on a clear)
                [--note text]             Extra provenance note (repeatable)
  efsim zmdlogs check <fixture.json>      Predict every logged hit and compare
  efsim zmdlogs reactions <fixture.json>  Replay the kits' inflictions; compare bursts and reactions
  efsim zmdlogs scales <fixture> <op>     Multiplier each logged hit of an operator implies
  efsim zmdlogs find-scales <fixture> <op> Skill values (keys) that explain each logged event
  efsim kit-draft <operator>              Draft a kit from SkillData (to verify against logs)
  efsim kit-census                        Kit features per operator, for the review after each new kit

Options for calc and compare:
  --enemy <id>        Target (default eny_0051_rodin, Rhodagn)
  --level <n>         Enemy level (default 90)
  --crit <mode>       never | always | expected (default expected)
  --staggered         Target is staggered
  --condition <id>    Turn on a condition (repeatable; calc lists them)
  --buff <id>[:<n>]   Count a kit buff (own or equipment) as active, with n layers (repeatable; calc)
  --verbose           Every stat contribution and the zones of a hit
`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      enemy: { type: "string", default: "eny_0051_rodin" },
      level: { type: "string", default: "90" },
      crit: { type: "string", default: "expected" },
      staggered: { type: "boolean", default: false },
      condition: { type: "string", multiple: true, default: [] },
      buff: { type: "string", multiple: true, default: [] },
      weapon: { type: "string" },
      "enemy-level": { type: "string" },
      note: { type: "string", multiple: true, default: [] },
      verbose: { type: "boolean", default: false },
      beam: { type: "string", default: "24" },
      seed: { type: "string" },
      runs: { type: "string" },
      dodge: { type: "string" },
      "attack-every": { type: "string" },
      out: { type: "string" },
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
    conditions: values.condition,
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
  const data = loadGameData();
  let text: string;
  switch (command) {
    case "find":
      need(1);
      text = find(data, args[0] as string);
      break;
    case "template":
      need(1);
      text = template(data, args[0] as string, values.weapon);
      break;
    case "calc":
      need(1);
      text = calc(data, readBuild(args[0] as string), options);
      break;
    case "zmdlogs": {
      const [sub, arg, op] = args;
      if ((sub === "scales" || sub === "find-scales") && arg && op) {
        const fx = readLogFixture(arg);
        if (sub === "scales") {
          const lines: string[] = [];
          for (const r of impliedScales(data, fx, op)) {
            const s = r.bySkillType;
            lines.push(`${r.event} t=${r.t}${r.unquantified.length ? ` [${r.unquantified.join(",")}]` : ""} crit=${r.crit} value=${r.value}` +
              ` basic=${s.basic.toFixed(4)} battle=${s.battle.toFixed(4)} combo=${s.combo.toFixed(4)} ultimate=${s.ultimate.toFixed(4)}`);
          }
          text = lines.join("\n");
        } else {
          const lines: string[] = [];
          for (const m of findScales(data, fx, op)) {
            lines.push(`${m.event} (${m.hits} hits)`);
            for (const x of m.matches) lines.push(`   ${x.agree}/${m.hits}  ${x.skillId} ${x.keys.join(" * ")} ${x.damageType}${x.corrosion ? ` corrosion L${x.corrosion}` : ""}`);
          }
          text = lines.join("\n");
        }
        break;
      }
      if (args.length !== 2 || !arg || (sub !== "import" && sub !== "check" && sub !== "reactions")) throw new Error(`zmdlogs takes import <battle id>, check <file>, reactions <file>, scales <file> <op> or find-scales <file> <op>\n\n${USAGE}`);
      if (sub === "reactions") {
        text = formatReactionCheck(checkReactions(data, readLogFixture(arg)));
      } else if (sub === "check") {
        const fx = readLogFixture(arg);
        text = formatLogCheck(data, fx, checkLog(data, fx));
      } else {
        const file = await importBattle(data, arg, values["enemy-level"] === undefined ? undefined : Number(values["enemy-level"]), values.note);
        text = `wrote ${file}`;
      }
      break;
    }
    case "simulate":
      need(1);
      {
        const scenario = readScenario(args[0] as string);
        const seed = values.seed === undefined ? undefined : Number(values.seed);
        if (seed !== undefined && !(Number.isInteger(seed) && seed >= 0)) throw new Error(`--seed must be a whole number ≥ 0`);
        const chance = values.dodge === undefined ? undefined : Number(values.dodge);
        if (chance !== undefined && !(chance >= 0 && chance <= 1)) throw new Error(`--dodge must be a chance from 0 to 1`);
        const every = values["attack-every"] === undefined ? undefined : Number(values["attack-every"]);
        if (every !== undefined && !(every > 0)) throw new Error(`--attack-every must be a positive number of seconds`);
        const seeded = {
          ...scenario,
          options: { ...scenario.options, ...(seed !== undefined ? { seed } : {}), ...(chance !== undefined ? { dodge: { chance } } : {}) },
          ...(every !== undefined ? { enemyActions: [...(scenario.enemyActions ?? []), { kind: "attack" as const, every: every * 30 }] } : {}),
        };
        const runs = values.runs === undefined ? undefined : Number(values.runs);
        if (runs !== undefined && !(Number.isInteger(runs) && runs >= 1)) throw new Error(`--runs must be a whole number ≥ 1`);
        text = runs === undefined ? formatSimulation(data, seeded, values.verbose) : formatRuns(data, seeded, runs);
      }
      break;
    case "search":
      need(1);
      text = searchCommand(data, readScenario(args[0] as string), { beam: Number(values.beam), ...(values.out ? { out: values.out } : {}), verbose: values.verbose });
      break;
    case "kit-census":
      text = formatCensus(kitCensus());
      break;
    case "kit-draft": {
      need(1);
      const op = args[0] as string;
      const logged = new Map<string, number>();
      for (const f of readdirSync(join(ROOT, "fixtures")).filter((x) => x.startsWith("zmdlogs-"))) {
        for (const h of readLogFixture(join(ROOT, "fixtures", f)).hits) if (h.operator === op) logged.set(h.event, (logged.get(h.event) ?? 0) + 1);
      }
      text = kitDraft(data, op, logged);
      break;
    }
    case "compare":
      need(2);
      text = compare(data, readBuild(args[0] as string), readBuild(args[1] as string), options, [basename(args[0] as string), basename(args[1] as string)]);
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
