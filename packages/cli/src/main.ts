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
import { checkLog, formatLogCheck } from "./logcheck.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
import { importBattle, readLogFixture } from "./logs.ts";

const USAGE = `Usage:
  efsim find <text>                       Look up operator, weapon, gear and enemy IDs by name
  efsim template <operator> [--weapon id] Print a build file to start from
  efsim calc <build.json> [options]       Stat panel and damage per hit
  efsim compare <a.json> <b.json> [opts]  Two builds of one operator side by side
  efsim zmdlogs import <battle id>        Turn a ZMDLogs battle into fixtures/zmdlogs-<id>.json
                [--enemy-level n]         (default: inferred from total damage on a clear)
                [--note text]             Extra provenance note (repeatable)
  efsim zmdlogs check <fixture.json>      Predict every logged hit and compare
  efsim kit-draft <operator>              Draft a kit from SkillData (to verify against logs)

Options for calc and compare:
  --enemy <id>        Target (default eny_0051_rodin, Rhodagn)
  --level <n>         Enemy level (default 90)
  --crit <mode>       never | always | expected (default expected)
  --staggered         Target is staggered
  --condition <id>    Turn on a condition (repeatable; calc lists them)
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
      weapon: { type: "string" },
      "enemy-level": { type: "string" },
      note: { type: "string", multiple: true, default: [] },
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
    case "zmdlogs": {
      const [sub, arg] = args;
      if (args.length !== 2 || !arg || (sub !== "import" && sub !== "check")) throw new Error(`zmdlogs takes import <battle id> or check <file>\n\n${USAGE}`);
      if (sub === "check") {
        const fx = readLogFixture(arg);
        text = formatLogCheck(data, fx, checkLog(data, fx));
      } else {
        const file = await importBattle(data, arg, values["enemy-level"] === undefined ? undefined : Number(values["enemy-level"]), values.note);
        text = `wrote ${file}`;
      }
      break;
    }
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
