// What a CLI command is (one module per command under commands/, registered in commands/index.ts): its name, its
// lines of the usage text, the options it reads, and what it runs. cli.ts builds one `parseArgs` call from every
// command's options and the usage text from every command's lines, then dispatches. A new command or option touches
// only its own module, so parallel branches don't collide in one file (friction round 1).

import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import type { GameData } from "@efsim/engine";

type Config<O extends ParseArgsOptionsConfig> = { args: string[]; allowPositionals: true; allowNegative: true; options: O };

/** The parsed values of a command's options, typed from its declaration (the parse itself holds every command's). */
export type ValuesOf<O extends ParseArgsOptionsConfig> = ReturnType<typeof parseArgs<Config<O>>>["values"];

export interface CommandContext<V> {
  /** The command's name as typed. */
  readonly command: string;
  /** The positional arguments after the command's name. */
  readonly args: readonly string[];
  /** Every option's value (the command's own typed; the parse is shared, so others' defaults are there too). */
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
 * Every command's options merged for the one parse (cli.ts): option names are global, so a name two commands use must be
 * declared alike (type, multiple, default); its meaning and the check of its values are each command's (calc's --buff
 * is `<id>[:<layers>]`, zmdlogs' a regex). Taken names with a shape: see the commands' `options`; a clash throws here,
 * naming both commands.
 */
export function mergedOptions(commands: readonly Command[], global: ParseArgsOptionsConfig): ParseArgsOptionsConfig {
  const out: Record<string, ParseArgsOptionsConfig[string]> = { ...global };
  const owner = new Map<string, string>(Object.keys(global).map((k) => [k, "(global)"]));
  for (const c of commands) {
    for (const [name, def] of Object.entries(c.options)) {
      const seen = out[name];
      if (seen && JSON.stringify(seen) !== JSON.stringify(def)) throw new Error(`option --${name}: ${c.name} declares it unlike ${owner.get(name)} (${JSON.stringify(def)} vs ${JSON.stringify(seen)})`);
      out[name] = def;
      if (!owner.has(name)) owner.set(name, c.name);
    }
  }
  return out;
}

/**
 * The parsed values with a record of which options the command read. The parse is shared by every command, so an
 * option another command (or another zmdlogs view) declares is accepted anywhere and, where nothing reads it, did
 * nothing without a word (physical-statuses report point 5: `zmdlogs hits --from/--to` silently ignored); cli.ts warns
 * of each option given but never read (unreadOptions).
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
