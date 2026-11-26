// What a CLI command is (one module per command under commands/, registered in commands/index.ts): its name, its
// lines of the usage text, the options it reads, and what it runs. cli.ts finds the command, parses the arguments with
// that command's options and the global ones (commandOptions), builds the usage text from every command's lines, then
// dispatches. A new command or option touches only its own module, so parallel branches don't collide in one file
// (friction round 1); option names are per command since round 14 (before, one parse held every command's, so a view's
// natural name, `--why`, was taken if another command declared it with another type).

import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import type { GameData } from "@efsim/engine";

type Config<O extends ParseArgsOptionsConfig> = { args: string[]; allowPositionals: true; allowNegative: true; options: O };

/** The parsed values of a command's options, typed from its declaration. */
export type ValuesOf<O extends ParseArgsOptionsConfig> = ReturnType<typeof parseArgs<Config<O>>>["values"];

export interface CommandContext<V> {
  /** The command's name as typed. */
  readonly command: string;
  /** The positional arguments after the command's name. */
  readonly args: readonly string[];
  /** Every option's value (the command's own, typed, and the global ones). */
  readonly values: V;
  /** The game data, loaded on first use (after the arguments are checked) with --kit applied. */
  readonly data: () => GameData;
  /** The whole usage text, for error messages that show it. */
  readonly usage: string;
  /** Throws "<command> takes n argument(s)" with the usage text unless there are exactly n positionals. */
  readonly need: (n: number) => void;
}

export interface Command {
  readonly name: string;
  /** The command's lines of the usage text (each ends with a newline), in the list of commands. */
  readonly usage: string;
  /** Sections after the list of commands (e.g. options shared by calc and compare); the same text is printed once. */
  readonly notes?: readonly string[];
  readonly options: ParseArgsOptionsConfig;
  readonly run: (ctx: CommandContext<Record<string, unknown>>) => string | Promise<string>;
}

/** A command, its `run` seeing its own options' values typed. */
export function command<const O extends ParseArgsOptionsConfig>(c: {
  readonly name: string;
  readonly usage: string;
  readonly notes?: readonly string[];
  readonly options: O;
  readonly run: (ctx: CommandContext<ValuesOf<O>>) => string | Promise<string>;
}): Command {
  return c as unknown as Command;
}

/**
 * One command's options for its parse (cli.ts): the global ones and its own. Names are per command (round 14; combo
 * hold report point 4: `--why` was a regex in `holds` and `--rules` a file in `gear`, so a view's boolean couldn't take
 * either while every command shared one parse); only a global name can't be redeclared otherwise (throws, naming it).
 */
export function commandOptions(c: Pick<Command, "name" | "options">, global: ParseArgsOptionsConfig): ParseArgsOptionsConfig {
  for (const [name, def] of Object.entries(c.options)) {
    const g = global[name];
    if (g && JSON.stringify(g) !== JSON.stringify(def)) throw new Error(`option --${name}: ${c.name} declares it unlike the global option (${JSON.stringify(def)} vs ${JSON.stringify(g)})`);
  }
  return { ...global, ...c.options };
}

/**
 * The command an argument list names: its first positional, the global options (whose values parse as theirs) aside.
 * A command's own options come after its name (`efsim zmdlogs replay 0c14 --from 10`), as every usage line writes them.
 */
export function commandName(argv: readonly string[], global: ParseArgsOptionsConfig): string | undefined {
  const { positionals } = parseArgs({ args: [...argv], allowPositionals: true, strict: false, options: global });
  return positionals[0];
}

/**
 * The parsed values with a record of which options the command read. A command's options are shared by its
 * subcommands (zmdlogs' views), so one a subcommand doesn't read is accepted and did nothing without a word
 * (physical-statuses report point 5: `zmdlogs hits --from/--to` silently ignored); cli.ts warns of each option given but
 * never read (unreadOptions).
 */
export function trackReads<V extends object>(values: V): { readonly values: V; readonly read: ReadonlySet<string> } {
  const read = new Set<string>();
  const proxy = new Proxy(values, {
    get(target, key, receiver) {
      if (typeof key === "string") read.add(key);
      return Reflect.get(target, key, receiver) as unknown;
    },
    ownKeys(target) {
      // A spread or Object.entries reads every option: count them all as read (no warning rather than a wrong one).
      for (const k of Reflect.ownKeys(target)) if (typeof k === "string") read.add(k);
      return Reflect.ownKeys(target);
    },
  });
  return { values: proxy, read };
}

/**
 * An option declared as `no-<x>` (zmdlogs `--no-cache`, `--no-foods`), which parseArgs' allowNegative reads as `<x>`
 * set false when no `<x>` is declared: the declared one set true, its token renamed (round 15: every `--no-cache` the
 * zmdlogs views took was dropped this way, the cache read all the same, and the unread-option warning named `--cache`).
 */
export function withDeclaredNegatives<V extends Record<string, unknown>>(values: V, tokens: { kind: string; name?: string; rawName?: string }[], options: ParseArgsOptionsConfig): V {
  const out: Record<string, unknown> = { ...values };
  for (const t of tokens) {
    if (t.kind !== "option" || t.name === undefined || t.rawName !== `--no-${t.name}`) continue;
    const declared = `no-${t.name}`;
    if (!(declared in options) || t.name in options || options[declared]?.type !== "boolean") continue;
    out[declared] = true;
    delete out[t.name];
    t.name = declared;
  }
  return out as V;
}

/** The options given on the command line (parseArgs tokens) that the command never read, global ones left out. */
export function unreadOptions(tokens: readonly { readonly kind: string; readonly name?: string }[], read: ReadonlySet<string>, global: ParseArgsOptionsConfig): string[] {
  const given = new Set(tokens.flatMap((t) => (t.kind === "option" && t.name !== undefined ? [t.name] : [])));
  return [...given].filter((n) => !read.has(n) && !(n in global));
}

/** The usage text: the commands' lines in registry order, the global notes, then each command's notes once. */
export function usageText(commands: readonly Command[], globalNotes: readonly string[]): string {
  const notes = [...new Set([...globalNotes, ...commands.flatMap((c) => c.notes ?? [])])];
  return `Usage:\n${commands.map((c) => c.usage).join("")}\n${notes.join("\n")}`;
}
