// A lead's status in docs/open-problems.md before a brief names it (round 23, the placement-cases report point 1: a
// brief's lead, "the placement's log-only casts f879 95.10, 5082 45.06, 3aa6 125.65 s", had been fixed a day earlier,
// said in one section and still listed as open in another; 15 minutes went to finding that out).
//
// Usage: node scripts/lead-status.ts <lead>…
//   a lead: a fixture's short id and a time (`f879@95.10`, `f879:95.10`), a fixture alone (`f879`), or words
//   (`"Decisive Assault"`). Prints, per lead, every paragraph of docs/open-problems.md naming it, under its section,
//   each marked FIXED where the paragraph says the case was fixed or decided ("fixed", "Found and fixed", "Closed by",
//   "decided") and OPEN otherwise, then one verdict: open in every mention, fixed in every one, or both (a section
//   left stale: shrink it to one line naming the journal entry, as CLAUDE.md asks). Reads only that file.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { printHelp } from "./usage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OPEN_PROBLEMS = join(ROOT, "docs/open-problems.md");

/** Words that say a paragraph's case was fixed or decided. */
const FIXED = /\bfixed\b|\bFound and fixed\b|\bClosed by\b|\bdecided\b|\bno longer\b/i;

/** One paragraph naming a lead: its section heading, first line number and text. */
export interface LeadMention {
  readonly section: string;
  readonly line: number;
  readonly text: string;
  readonly fixed: boolean;
}

/** A lead's matcher: `f879@95.10` (the id, then the time as written, within the paragraph), `f879`, or words. */
export function leadMatcher(lead: string): (paragraph: string) => boolean {
  const m = /^([0-9a-f]{4,12})(?:[@:](\d+(?:\.\d+)?))?$/.exec(lead);
  if (!m) return (p) => p.toLowerCase().includes(lead.toLowerCase());
  const id = new RegExp(`\\b${m[1]}`);
  const time = m[2] !== undefined ? new RegExp(`(?<![\\d.])${(m[2] as string).replace(".", "\\.")}(?![\\d])`) : null;
  return (p) => id.test(p) && (!time || time.test(p));
}

/** Every paragraph of `text` (a Markdown file) a lead names, under its nearest heading. */
export function leadMentions(text: string, lead: string): LeadMention[] {
  const matches = leadMatcher(lead);
  const out: LeadMention[] = [];
  let section = "(before any heading)";
  let para: string[] = [];
  let start = 0;
  const flush = () => {
    const p = para.join(" ");
    if (p.trim() && matches(p)) out.push({ section, line: start, text: p.replace(/\s+/g, " ").trim(), fixed: FIXED.test(p) });
    para = [];
  };
  text.split("\n").forEach((l, i) => {
    if (/^#{1,6} /.test(l)) {
      flush();
      section = l.replace(/^#+ /, "");
      return;
    }
    // A list item starts a paragraph of its own.
    if (!l.trim() || /^\s*([-*]|\d+\.) /.test(l)) flush();
    if (l.trim()) {
      if (!para.length) start = i + 1;
      para.push(l);
    }
  });
  flush();
  return out;
}

/** The verdict over a lead's mentions. */
export function leadVerdict(mentions: readonly LeadMention[]): string {
  if (!mentions.length) return "not in docs/open-problems.md";
  const fixed = mentions.filter((m) => m.fixed).length;
  if (fixed === 0) return `open: ${mentions.length} mention(s), none says fixed`;
  if (fixed === mentions.length) return `fixed: every one of ${mentions.length} mention(s) says so (check the journal entry it names)`;
  return `BOTH: ${fixed} of ${mentions.length} mention(s) say fixed and ${mentions.length - fixed} don't: a stale section, or a case with an open part; read them before briefing`;
}

function main(argv: readonly string[]): number {
  if (!argv.length) {
    process.stderr.write("usage: node scripts/lead-status.ts <lead>…   (f879@95.10, f879, or words; the header has more)\n");
    return 2;
  }
  const text = readFileSync(OPEN_PROBLEMS, "utf8");
  for (const lead of argv) {
    const ms = leadMentions(text, lead);
    process.stdout.write(`${lead}: ${leadVerdict(ms)}\n`);
    for (const m of ms) process.stdout.write(`  ${m.fixed ? "FIXED" : "OPEN "} line ${m.line} (${m.section}): ${m.text.slice(0, 220)}${m.text.length > 220 ? "…" : ""}\n`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);
  process.exitCode = main(process.argv.slice(2));
}
