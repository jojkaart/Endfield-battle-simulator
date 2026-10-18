#!/usr/bin/env node
// efsim: Endfield battle simulator command line.

import { parseArgs } from "node:util";
import { basename } from "node:path";
import { loadGameData } from "@efsim/data";
import type { CritMode } from "@efsim/engine";
import { calc, compare, find, readBuild, template, type CalcOptions } from "./commands.ts";

const USAGE = `Usage:
  efsim find <text>                       Look up operator, weapon, gear and enemy IDs by name
  efsim template <operator> [--weapon id] Print a build file to start from
  efsim calc <build.json> [options]       Stat panel and damage per hit
  efsim compare <a.json> <b.json> [opts]  Two builds of one operator side by side

Options for calc and compare:
  --enemy <id>        Target (default eny_0051_rodin, Rhodagn)
  --level <n>         Enemy level (default 90)
  --crit <mode>       never | always | expected (default expected)
  --staggered         Target is staggered
  --condition <id>    Turn on a condition (repeatable; calc lists them)
  --verbose           Every stat contribution and the zones of a hit
`;

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      enemy: { type: "string", default: "eny_0051_rodin" },
      level: { type: "string", default: "90" },
      crit: { type: "string", default: "expected" },
      staggered: { type: "boolean", default: false },
      condition: { type: "string", multiple: true, default: [] },
      weapon: { type: "string" },
      verbose: { type: "boolean", default: false },
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

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`efsim: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
