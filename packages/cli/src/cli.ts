// efsim: Endfield battle simulator command line. The entry is main.ts, which runs the checkout check (checkout.ts)
// before this module and its imports are linked. Each command is a module under commands/ (its usage lines, options
// and run; registered in commands/index.ts); this file parses the arguments once for all of them, prints the usage
// text and dispatches.

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadGameData, withKitFiles } from "@efsim/data";
import { mergedOptions, trackReads, unreadOptions, usageText, type CommandContext } from "./command.ts";
import { COMMANDS } from "./commands/index.ts";
import { GLOBAL_NOTES, GLOBAL_OPTIONS } from "./commands/shared.ts";
import { setWorkerKitFiles } from "./rulespool.ts";

const OPTIONS = mergedOptions(COMMANDS, GLOBAL_OPTIONS);
const USAGE = usageText(COMMANDS, GLOBAL_NOTES);

async function main(argv: string[]): Promise<number> {
  const { values, positionals, tokens } = parseArgs({ args: argv, allowPositionals: true, allowNegative: true, options: OPTIONS, tokens: true });
  const [command, ...args] = positionals;
  if (values["help"] || !command) {
    process.stdout.write(USAGE);
    return command || values["help"] ? 0 : 1;
  }
  // Each command checks its own options' values (calc and compare: calcOptions), so another command may give a name
  // calc uses (--buff) its own meaning (round 4); the names are shared by the one parse (command.ts mergedOptions).
  // Loaded on first use, after the arguments and input files are checked (a mistake is reported without the load's wait).
  // --kit: what-if kit files in place of the operators' own (withKitFiles); worker threads load them too.
  const kits = values["kit"] as string[];
  setWorkerKitFiles(kits.map((f) => resolve(f)));
  let loaded: ReturnType<typeof loadGameData> | undefined;
  const tracked = trackReads(values);
  const ctx: CommandContext<Record<string, unknown>> = {
    command,
    args,
    values: tracked.values,
    data: () => (loaded ??= withKitFiles(loadGameData(), kits)),
    usage: USAGE,
    need: (n) => {
      if (args.length !== n) throw new Error(`${command} takes ${n} argument${n === 1 ? "" : "s"}\n\n${USAGE}`);
    },
  };
  const cmd = COMMANDS.find((c) => c.name === command);
  if (!cmd) throw new Error(`unknown command ${command}\n\n${USAGE}`);
  const text = await cmd.run(ctx);
  process.stdout.write(text + "\n");
  // On stderr, after the output: stdout stays the command's own (JSON a pipe reads).
  const unread = unreadOptions(tokens, tracked.read, GLOBAL_OPTIONS);
  if (unread.length) process.stderr.write(`efsim: ${[command, ...args.slice(0, 1)].join(" ")} never read ${unread.map((n) => `--${n}`).join(", ")}: not an option of this command (another one's), so it did nothing; efsim --help lists each command's\n`);
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
