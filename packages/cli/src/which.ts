// `efsim zmdlogs which "<question words>"` (round 22, round 21's own report point 2: two reports asked for views that
// existed, `hits --against` since round 13, and finding each took the CLI's usage and the sources): the question's
// words against docs/design/data.md's "Questions and the command that answers them" table and `efsim zmdlogs`' usage
// entries, ranked by the words they share (a word's weight by how rare it is among the entries), the best few shown.
// Since round 24 (round 23's own report point 1: two reports asked for what measure --hits and edit.ts already did) also
// every scripts/*.ts header's usage (its --help text): one entry per script and one per option line.
// Before suggesting a view in a friction report: `zmdlogs which` (docs/friction/README.md's request).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "@efsim/data";

/** One searchable entry: where it is from, the question or usage text, and the command. */
export interface WhichEntry {
  readonly from: "data.md" | "usage" | "script";
  readonly question: string;
  readonly command: string;
}

const STOP = new Set("a all also an and any are as at be by can do does each every for from has how if in into is it its no not of on one only or per than that the their them then there they this to two what when where which who why with without".split(" "));

/** A word's stem: a plural's ending and -ing / -ed off (so "stops" meets "stop", "applies" "apply", "fired" "fire"). */
const stem = (w: string) => {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -1);
  return w;
};

/** The words of a text, lower case, stemmed, without the commonest ones. */
export function whichWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w)).map(stem).filter((w) => w.length > 1);
}

/** docs/design/data.md's question table rows (`| Question | Command |`). */
export function dataQuestions(text: string): WhichEntry[] {
  const at = text.indexOf("**Questions and the command that answers them**");
  if (at < 0) return [];
  const out: WhichEntry[] = [];
  for (const line of text.slice(at).split("\n").slice(1)) {
    if (!line.startsWith("|")) {
      if (out.length) break;
      continue;
    }
    const cells = line.split(/(?<!\\)\|/).map((c) => c.trim());
    const [q, c] = [cells[1] ?? "", cells.slice(2, -1).join(" | ")];
    if (!q || q === "Question" || /^-+$/.test(q)) continue;
    out.push({ from: "data.md", question: q.replace(/\\\|/g, "|"), command: c.replace(/\\\|/g, "|") });
  }
  return out;
}

/**
 * The usage's entries: each `efsim zmdlogs <sub> …` line with its description, and each `[--option]` line under it
 * with its own (the command then the subcommand's with the option), so a question about one option finds its line.
 */
export function usageEntries(usage: string): WhichEntry[] {
  const out: { command: string; lines: string[] }[] = [];
  let main = "";
  for (const line of usage.split("\n")) {
    const m = /^\s{2}(efsim zmdlogs \S+(?: \S+)*?)\s{2,}(.*)$/.exec(line) ?? /^\s{2}(efsim zmdlogs .+)$/.exec(line);
    const opt = /^\s{3,}(\[--[^\]]*\](?: \[--[^\]]*\])*)\s+(.*)$/.exec(line) ?? /^\s{3,}(\[--.*\])\s*$/.exec(line);
    if (m) {
      main = (m[1] as string).trim();
      out.push({ command: main, lines: [m[2] ?? ""] });
    } else if (/^\s{2}efsim /.test(line) || /^\S/.test(line)) main = "";
    else if (opt && main) out.push({ command: `${main} ${opt[1] as string}`, lines: [opt[2] ?? ""] });
    else if (main && /^\s+\S/.test(line)) out.at(-1)?.lines.push(line.trim());
  }
  return out.map((e) => ({ from: "usage" as const, question: e.lines.join(" ").replace(/\s+/g, " ").trim(), command: e.command }));
}

/**
 * A script's header usage (scripts/usage.ts headerUsage: the comment lines from "Usage:" on) as entries: the script
 * itself with the text before its first option line (at most SCRIPT_HEAD_LINES lines: a whole header would share a word
 * with every question), and each option line (`--name …` at the start of a line, two spaces or more before its
 * description) with its description and the lines indented under it, as `node scripts/<file> --name …`.
 */
export function scriptEntries(file: string, header: string): WhichEntry[] {
  const command = `node scripts/${file}`;
  const lines = header.split("\n");
  const firstOption = lines.findIndex((l) => /^\s*--[a-z]/.test(l));
  const head = lines.slice(0, Math.min(firstOption < 0 ? lines.length : firstOption, SCRIPT_HEAD_LINES)).join(" ").replace(/^Usage:\s*/, "");
  const out: { command: string; lines: string[]; indent: number }[] = [{ command, lines: [head], indent: -1 }];
  for (const line of header.split("\n")) {
    const opt = /^(\s*)(--[a-z][\w-]*(?:[ =][^\s].*?)?)\s{2,}(\S.*)$/.exec(line);
    if (opt) {
      out.push({ command: `${command} ${(opt[2] as string).trim()}`, lines: [opt[3] as string], indent: (opt[1] as string).length });
      continue;
    }
    const last = out.at(-1);
    const indent = /^\s*/.exec(line)?.[0].length ?? 0;
    if (last && last.indent >= 0 && line.trim() && indent > last.indent && !line.trim().startsWith("--")) last.lines.push(line.trim());
    else if (last && last.indent >= 0) last.indent = Infinity;
  }
  return out.map((e) => ({ from: "script" as const, question: e.lines.join(" ").replace(/\s+/g, " ").trim(), command: e.command }));
}

/** At most how many lines of a script's header, before its first option, its own entry takes (scriptEntries). */
const SCRIPT_HEAD_LINES = 6;

/** Every scripts/*.ts file's header usage as entries (scriptEntries). */
export function allScriptEntries(root = REPO_ROOT): WhichEntry[] {
  const dir = join(root, "scripts");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .sort()
    .flatMap((f) => {
      const header = headerOf(readFileSync(join(dir, f), "utf8"));
      return header ? scriptEntries(f, header) : [];
    });
}

/** A file's leading comment block from its "Usage:" line on (all of it without one), as scripts/usage.ts headerUsage reads it. */
function headerOf(text: string): string {
  const header: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("//")) {
      if (header.length) break;
      continue;
    }
    header.push(line.replace(/^\/\/ ?/, ""));
  }
  const at = header.findIndex((l) => l.includes("Usage:"));
  return (at >= 0 ? header.slice(at) : header).join("\n").trimEnd();
}

/** The entries ranked by the question's words they share, each word weighted by its rarity (log of entries ÷ those with it). */
export function rankWhich(question: string, entries: readonly WhichEntry[], top = 6): { readonly entry: WhichEntry; readonly score: number; readonly words: readonly string[] }[] {
  const asked = [...new Set(whichWords(question))];
  const bags = entries.map((e) => new Set(whichWords(`${e.question} ${e.command}`)));
  const weight = (w: string) => Math.log((entries.length + 1) / (1 + bags.filter((b) => b.has(w)).length));
  return entries
    .map((entry, i) => {
      const words = asked.filter((w) => (bags[i] as Set<string>).has(w));
      return { entry, score: words.reduce((n, w) => n + weight(w), 0), words };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

/** The view: the best entries, each its question (shortened) and its command, with the words it matched. */
export function whichView(question: string, usage: string, opts: { readonly top?: number; readonly dataMd?: string; readonly scripts?: readonly WhichEntry[] } = {}): string {
  const text = opts.dataMd ?? readFileSync(join(REPO_ROOT, "docs/design/data.md"), "utf8");
  const ranked = rankWhich(question, [...dataQuestions(text), ...usageEntries(usage), ...(opts.scripts ?? allScriptEntries())], opts.top ?? 6);
  const cut = (x: string, n: number) => (x.length > n ? `${x.slice(0, n - 1)}…` : x);
  if (!ranked.length) return `No entry shares a word with "${question}" (docs/design/data.md "Questions and the command that answers them", efsim zmdlogs --help, the scripts' --help): say the question in the views' words (a buff, a clock, a hold, a tail, a target), or it isn't built yet.`;
  return [
    `The entries closest to "${question}" (docs/design/data.md's question table, efsim zmdlogs' usage and scripts/*.ts --help; by the words shared, rarer words weigh more):`,
    ...ranked.map((r) => `  ${r.entry.from === "data.md" ? cut(r.entry.command, 140) : r.entry.command}\n      ${cut(r.entry.question, 200)}  [${r.words.join(", ")}]`),
  ].join("\n");
}
