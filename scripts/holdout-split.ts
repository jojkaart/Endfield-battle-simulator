// Registers a log in the hold-out split's `development` list (fixtures/holdout/holdout.json) without anyone seeing
// the file: agents never open, list or grep fixtures/holdout/ (CLAUDE.md "Hold-out logs"), but a new development log
// counts as "earlier pending" on the scoreboard until that list has it. The script edits the list's text in place
// (the hold-out list and everything outside the development array stay byte for byte), checks the result by parsing
// it, and prints only the id it added and the development list's length; never a hold-out entry, never the file.
//
// Usage: node scripts/holdout-split.ts add-development <fixture…>
//          a fixture under fixtures/pending/ (path, file name or id: zmdlogs-207fff414d82, 207fff414d82); then
//          `npm run snapshots:update` moves the log from "earlier pending" to "development" on the scoreboard
//        node scripts/holdout-split.ts group <fixture…>
//          for logs under fixtures/pending/: "development" or "earlier pending" (nothing about the hold-outs)
//
// A log that is in the hold-out list is refused without saying anything more. Choosing which logs of a batch become
// hold-outs is not this script's: docs/accuracy-plan.md "Choosing logs" (the lead draws them before reading checks).
// Never `git diff` / `git show` holdout.json: its diff hunk may show hold-out ids beside the new line (the script warns
// when the file's layout would put one on a changed line).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { printHelp } from "./usage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPLIT = "fixtures/holdout/holdout.json";

export interface AddResult {
  /** The file's new text (the same text when the id was there already). */
  readonly text: string;
  readonly added: boolean;
  /** The development list's length after the change. */
  readonly development: number;
  /** Whether a line the change touches also holds a hold-out id (then a diff of the file would show it). */
  readonly holdoutOnChangedLine: boolean;
}

/** A fixture argument as its id (zmdlogs-…), checked to be a log under fixtures/pending/ of `root`. */
export function pendingId(arg: string, root: string = ROOT): string {
  const name = basename(arg).replace(/\.json$/, "");
  const id = name.startsWith("zmdlogs-") ? name : `zmdlogs-${name}`;
  if (!/^zmdlogs-[0-9a-z]+$/.test(id)) throw new Error(`${arg}: not a log id (zmdlogs-<hex>)`);
  if (/(^|\/)holdout\//.test(arg)) throw new Error(`${arg}: a hold-out path; only fixtures/pending/ logs are registered`);
  if (!existsSync(join(root, "fixtures/pending", `${id}.json`))) throw new Error(`${arg}: no fixtures/pending/${id}.json`);
  return id;
}

interface Split {
  readonly development: readonly string[];
  readonly holdout: readonly string[];
}

function parseSplit(text: string): Split {
  const s = JSON.parse(text) as Partial<Split>;
  const strings = (x: unknown) => Array.isArray(x) && x.every((v) => typeof v === "string");
  if (!strings(s.development) || !strings(s.holdout)) throw new Error("holdout.json: expected { development: string[], holdout: string[] }");
  return s as Split;
}

/**
 * The split file's text with `id` added to its development list: in sorted position when the list is sorted, else
 * at its end, in the list's own separator. Only the development array's text changes; the result is parsed and
 * compared (the development list gains exactly `id`, the hold-out list is unchanged) before it's returned.
 */
export function addDevelopment(text: string, id: string): AddResult {
  const before = parseSplit(text);
  if (before.holdout.includes(id)) throw new Error(`${id} is in the hold-out list: not registered (and nothing more is said about that list)`);
  if (before.development.includes(id)) return { text, added: false, development: before.development.length, holdoutOnChangedLine: false };
  const key = /"development"\s*:\s*\[/.exec(text);
  if (!key) throw new Error("holdout.json: no development array");
  const open = key.index + key[0].length;
  const close = text.indexOf("]", open);
  if (close < 0) throw new Error("holdout.json: the development array isn't closed");
  const body = text.slice(open, close);
  const items = [...body.matchAll(/"(?:[^"\\]|\\.)*"/g)].map((m) => ({ start: open + (m.index as number), end: open + (m.index as number) + m[0].length, value: JSON.parse(m[0]) as string }));
  const quoted = JSON.stringify(id);
  let next: string;
  if (!items.length) {
    next = text.slice(0, open) + quoted + text.slice(open);
  } else {
    const first = items[0] as (typeof items)[number];
    const sep = items.length > 1 ? text.slice(first.end, (items[1] as (typeof items)[number]).start) : ", ";
    const sorted = items.every((it, i) => i === 0 || (items[i - 1] as (typeof items)[number]).value <= it.value);
    const after = sorted ? items.find((it) => it.value > id) : undefined;
    if (after) next = text.slice(0, after.start) + quoted + sep + text.slice(after.start);
    else {
      const last = items[items.length - 1] as (typeof items)[number];
      next = text.slice(0, last.end) + sep + quoted + text.slice(last.end);
    }
  }
  const now = parseSplit(next);
  const expected = [...before.development, id].sort();
  if (JSON.stringify([...now.development].sort()) !== JSON.stringify(expected) || JSON.stringify(now.holdout) !== JSON.stringify(before.holdout)) {
    throw new Error("holdout.json: the edit didn't add exactly the one development entry; nothing written");
  }
  // The changed lines: those of the new text that the old text lacks (a line-level diff without showing either).
  const oldLines = new Set(text.split("\n"));
  const changed = next.split("\n").filter((l) => !oldLines.has(l));
  const holdoutOnChangedLine = changed.some((l) => before.holdout.some((h) => l.includes(h)));
  return { text: next, added: true, development: now.development.length, holdoutOnChangedLine };
}

/** A pending log's scoreboard group from the split: "development" or "earlier pending" (a hold-out id is refused). */
export function groupOfPending(text: string, id: string): "development" | "earlier pending" {
  const s = parseSplit(text);
  if (s.holdout.includes(id)) throw new Error(`${id} is in the hold-out list`);
  return s.development.includes(id) ? "development" : "earlier pending";
}

function main(argv: readonly string[]): number {
  const [command, ...args] = argv;
  if ((command !== "add-development" && command !== "group") || !args.length) {
    process.stderr.write("usage: node scripts/holdout-split.ts add-development|group <fixture…>\n");
    return 2;
  }
  const file = join(ROOT, SPLIT);
  let text = readFileSync(file, "utf8");
  for (const arg of args) {
    const id = pendingId(arg);
    if (command === "group") {
      process.stdout.write(`${id}: ${groupOfPending(text, id)}\n`);
      continue;
    }
    const r = addDevelopment(text, id);
    text = r.text;
    process.stdout.write(r.added ? `holdout-split: added ${id} to the development list (${r.development} development logs now); the hold-out list unchanged\n` : `holdout-split: ${id} is in the development list already\n`);
    if (r.holdoutOnChangedLine) process.stdout.write("holdout-split: the file keeps hold-out ids on a changed line: never git diff or git show it\n");
  }
  if (command === "add-development") {
    writeFileSync(file, text);
    process.stdout.write("holdout-split: next `npm run snapshots:update` (the log moves from earlier pending to development)\n");
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`holdout-split: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  }
}
