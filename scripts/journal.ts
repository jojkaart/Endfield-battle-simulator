// The journal: one file per entry under docs/journal/, and two files built from them (CLAUDE.md "Journal and
// roadmap"): docs/journal.md (the last RECENT entries in full, the session-start reading) and docs/journal/README.md
// (an index of every entry). Parallel branches add different entry files, so they never edit the same entry; the two
// built files are rebuilt, never merged by hand.
//
// An entry file is docs/journal/YYYY-MM-DD-NN-slug.md: NN orders the entries of one date (higher is newer; a tie
// between parallel branches sorts by slug). Its first line is the entry's heading, `## YYYY-MM-DD…: Title`, exactly as
// in the old single-file journal; no other `#`/`##` heading follows. Links in it are relative to docs/journal/.
//
//   node scripts/journal.ts              rebuild docs/journal.md and docs/journal/README.md   (npm run journal)
//   node scripts/journal.ts --check      fail if either is out of date or an entry is malformed (npm run journal:check)
//   node scripts/journal.ts new "Title"  a new entry file for today, to fill in and rebuild  (npm run journal:new -- "Title")
//   node scripts/journal.ts adopt [file] [--from REV]
//       turns entries written the old way (`## YYYY-MM-DD: Title` blocks in a journal.md, conflict markers allowed)
//       into entry files: each dated entry whose heading no entry file has yet. Default input: docs/journal.md;
//       --from REV reads REV:docs/journal.md (e.g. MERGE_HEAD).                              (npm run journal:adopt)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** How many entries docs/journal.md shows in full. */
export const RECENT = 10;

export const ENTRY_FILE = /^(\d{4}-\d{2}-\d{2})-(\d{2,})-([a-z0-9][a-z0-9-]*)\.md$/;
const HEADING = /^## (\d{4}-\d{2}-\d{2})[^:\n]*: (.+)$/;
const PLACEHOLDER = "(Write the entry here";

export interface Entry {
  file: string;
  date: string;
  seq: number;
  heading: string;
  /** The file's text, trimmed, links relative to docs/journal/. */
  text: string;
}

/** Parses one entry file; throws with the file's name on anything malformed. */
export function parseEntry(file: string, raw: string): Entry {
  const m = ENTRY_FILE.exec(file);
  if (!m) throw new Error(`${file}: the name isn't YYYY-MM-DD-NN-slug.md`);
  const text = raw.replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");
  const heading = lines[0] ?? "";
  const h = HEADING.exec(heading);
  if (!h) throw new Error(`${file}: the first line isn't "## YYYY-MM-DD: Title"`);
  if (h[1] !== m[1]) throw new Error(`${file}: the heading's date ${h[1]} isn't the file name's ${m[1]}`);
  const extra = lines.slice(1).find((l) => /^##? /.test(l));
  if (extra !== undefined) throw new Error(`${file}: a second top-level heading ("${extra}"); use ### inside an entry`);
  if (text.includes(PLACEHOLDER)) throw new Error(`${file}: still has the template's placeholder`);
  return { file, date: m[1] as string, seq: Number(m[2]), heading, text };
}

/** Newest first: by date, then sequence number, then file name. */
export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.seq - a.seq || b.file.localeCompare(a.file),
  );
}

// Relative markdown link targets (not a URL, an anchor or an absolute path).
const LINK = /\]\((?![a-z][a-z0-9+.-]*:|#|\/)([^)\s]+)\)/gi;

/** A link written relative to docs/journal/, as seen from docs/. */
export function linksToDocs(text: string): string {
  return text.replace(LINK, (_, t: string) => `](${t.startsWith("../") ? t.slice(3) : `journal/${t}`})`);
}

/** A link written relative to docs/, as seen from docs/journal/. */
export function linksToEntries(text: string): string {
  return text.replace(LINK, (_, t: string) => `](${t.startsWith("journal/") ? t.slice(8) : `../${t}`})`);
}

const GENERATED = "<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->";

export function buildJournal(entries: Entry[]): string {
  const sorted = sortEntries(entries);
  const recent = sorted.slice(0, RECENT);
  const head = [
    "# Journal",
    "",
    GENERATED,
    "",
    "A concise record of each working session: what was attempted, decisions and",
    "their reasons, dead ends, and anything a future session should know. Newest",
    `entry first; this page shows the last ${RECENT}. All ${sorted.length} entries: [journal/README.md](journal/README.md).`,
    "Each entry is a file under docs/journal/; add one with",
    '`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").',
  ].join("\n");
  return [head, ...recent.map((e) => linksToDocs(e.text))].join("\n\n") + "\n";
}

export function buildIndex(entries: Entry[]): string {
  const sorted = sortEntries(entries);
  const out = [
    "# Journal entries",
    "",
    GENERATED,
    "",
    "Every journal entry, newest first; [../journal.md](../journal.md) shows the",
    `last ${RECENT} in full. One file per entry: \`YYYY-MM-DD-NN-slug.md\`, its first line`,
    'the heading `## YYYY-MM-DD: Title` (CLAUDE.md "Journal and roadmap").',
  ];
  let month = "";
  for (const e of sorted) {
    if (e.date.slice(0, 7) !== month) {
      month = e.date.slice(0, 7);
      out.push("", `## ${month}`, "");
    }
    out.push(`- [${e.heading.slice(3).replace(/[[\]]/g, "\\$&")}](${e.file})`);
  }
  return out.join("\n") + "\n";
}

export function slugOf(title: string): string {
  const s = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= 60) return s || "entry";
  const cut = s.slice(0, 61);
  return cut.slice(0, cut.lastIndexOf("-") > 20 ? cut.lastIndexOf("-") : 60).replace(/-+$/, "");
}

/** The file name for a new entry of `date`: the next sequence number after that date's entries. */
export function newFileName(date: string, title: string, existing: Entry[]): string {
  const seq = Math.max(0, ...existing.filter((e) => e.date === date).map((e) => e.seq)) + 1;
  return `${date}-${String(seq).padStart(2, "0")}-${slugOf(title)}.md`;
}

/**
 * The dated `## ` entries of a journal written the old way (links relative to docs/), oldest first. Conflict markers
 * are dropped, so a conflicted docs/journal.md can be read as it is. An entry runs to the next `#`/`##` heading.
 */
export function splitOldJournal(text: string): { heading: string; text: string }[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => !/^(<{7}|\|{7}|={7}|>{7})( |$)/.test(l));
  const out: { heading: string; text: string }[] = [];
  let cur: string[] | undefined;
  const flush = () => {
    if (cur) out.push({ heading: cur[0] as string, text: linksToEntries(cur.join("\n").trim()) });
    cur = undefined;
  };
  for (const l of lines) {
    if (/^##? /.test(l)) {
      flush();
      if (HEADING.test(l)) cur = [l];
    } else if (l.startsWith("<!-- Built by `npm run journal`")) {
      flush();
    } else cur?.push(l);
  }
  flush();
  return out.reverse();
}

/** Entry files to write for old-way entries whose heading no entry has; and those whose heading exists with other text. */
export function adoptPlan(
  old: { heading: string; text: string }[],
  existing: Entry[],
): { write: { file: string; text: string }[]; differ: string[] } {
  const byHeading = new Map(existing.map((e) => [e.heading, e]));
  const all = [...existing];
  const write: { file: string; text: string }[] = [];
  const differ: string[] = [];
  for (const o of old) {
    const have = byHeading.get(o.heading);
    if (have) {
      if (have.text !== o.text) differ.push(have.file);
      continue;
    }
    const h = HEADING.exec(o.heading) as RegExpExecArray;
    const file = newFileName(h[1] as string, h[2] as string, all);
    const entry = parseEntry(file, o.text);
    all.push(entry);
    byHeading.set(o.heading, entry);
    write.push({ file, text: o.text + "\n" });
  }
  return { write, differ };
}

// ---- CLI ----

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "docs", "journal");
const journalPath = join(root, "docs", "journal.md");
const indexPath = join(dir, "README.md");

function readEntries(): Entry[] {
  const errors: string[] = [];
  const entries: Entry[] = [];
  for (const f of readdirSync(dir).sort()) {
    if (f === "README.md") continue;
    try {
      entries.push(parseEntry(f, readFileSync(join(dir, f), "utf8")));
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  if (errors.length) throw new Error(`journal: malformed entries in docs/journal/:\n  ${errors.join("\n  ")}`);
  return entries;
}

function build(): void {
  const entries = readEntries();
  writeFileSync(journalPath, buildJournal(entries));
  writeFileSync(indexPath, buildIndex(entries));
  console.log(`journal: built docs/journal.md (${Math.min(RECENT, entries.length)} entries) and docs/journal/README.md (${entries.length})`);
}

function check(): void {
  const entries = readEntries();
  const stale = [
    [journalPath, buildJournal(entries)],
    [indexPath, buildIndex(entries)],
  ].filter(([p, want]) => !existsSync(p as string) || readFileSync(p as string, "utf8") !== want);
  if (stale.length) {
    const names = stale.map(([p]) => (p as string).slice(root.length + 1)).join(", ");
    const current = existsSync(journalPath) ? readFileSync(journalPath, "utf8") : "";
    const { write } = adoptPlan(splitOldJournal(current), entries);
    const fix = write.length
      ? `docs/journal.md has entries no file has (written the old way?): ${write.map((w) => w.file).join(", ")}; ` +
        "run: npm run journal:adopt"
      : "run: npm run journal";
    throw new Error(`journal: ${names} out of date with docs/journal/; ${fix}`);
  }
  console.log(`journal: up to date (${entries.length} entries)`);
}

function create(title: string): void {
  if (!title.trim()) throw new Error('journal: usage: npm run journal:new -- "Title"');
  const date = new Date().toISOString().slice(0, 10);
  const file = newFileName(date, title, readEntries());
  const text = [
    `## ${date}: ${title.trim()}`,
    "",
    `${PLACEHOLDER}: goal, what was done, decisions and why, dead ends or problems.`,
    "Short; details belong in the docs the work produced. Then: npm run journal.)",
    "",
  ].join("\n");
  writeFileSync(join(dir, file), text);
  console.log(`journal: wrote docs/journal/${file}; write the entry, then: npm run journal`);
}

function adopt(args: string[]): void {
  const i = args.indexOf("--from");
  let text: string;
  let source: string;
  if (i >= 0) {
    const rev = args[i + 1];
    if (!rev) throw new Error("journal: --from needs a revision (e.g. MERGE_HEAD)");
    source = `${rev}:docs/journal.md`;
    text = execFileSync("git", ["show", source], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
  } else {
    source = args[0] ?? journalPath;
    text = readFileSync(source, "utf8");
  }
  const { write, differ } = adoptPlan(splitOldJournal(text), readEntries());
  for (const w of write) {
    writeFileSync(join(dir, w.file), w.text);
    console.log(`journal: adopted docs/journal/${w.file}`);
  }
  if (!write.length) console.log(`journal: no new entries in ${source}`);
  for (const d of differ)
    console.warn(`journal: ${source} has docs/journal/${d}'s heading with other text: not changed; compare by hand`);
  build();
}

function main(argv: string[]): void {
  mkdirSync(dir, { recursive: true });
  const [cmd, ...rest] = argv;
  if (cmd === undefined || cmd === "build") build();
  else if (cmd === "--check" || cmd === "check") check();
  else if (cmd === "new") create(rest.join(" "));
  else if (cmd === "adopt") adopt(rest);
  else throw new Error(`journal: unknown command ${cmd} (build, --check, new "Title", adopt [file] [--from REV])`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
