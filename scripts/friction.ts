// The paperwork of an improvement round (docs/friction/README.md), which round 5 did with scratch Python:
//
//   node scripts/friction.ts outcomes <report.md…> [--round <n>] [--backlog <new backlog.md>]
//     an "Outcome (round n)" skeleton per report: a line per `## N. title` heading ("- N (title): "), to fill in
//     and append to the report before it moves to docs/friction-done/; with --backlog, each point a **From:** line of
//     that backlog names ("<report's file> point(s) n") comes filled in: "carried (<backlog> point k)" (round 10's
//     own report point 2: outcomes written before the backlog was numbered needed a second pass). Write the new
//     backlog first, then the outcomes.
//     A **From:** entry with a parenthesis after its number ("<file> point 2 (its count)": only that part carried)
//     comes filled in as "done but its count (carried: <backlog> point k)" (round 16's own report point 2).
//   node scripts/friction.ts carry <backlog.md> <n,…> [--start <k>] [--label "<this backlog's name>"]
//                                  [--lists [--park <n,…>] [--drop <words>]…]
//     the backlog's points n,… renumbered from k (default 1), each `**From:**` line extended with where it was
//     carried from ("<label> point n"; default the backlog's file name), printed for the next backlog. With --lists
//     also its "Parked" section, the points --park names added at its top as one-line entries (title, where the full
//     text is), and its "Needs an accuracy or search task" list without the entries that carry a "Closed by" line or
//     whose first line holds a --drop text (round 16's own report point 1: both were copied by hand); the round adds
//     its new entries to them. A "Declined" section (round 20: suggestions declined for good, with why) is carried as
//     it is, between the two. --unpark <words> (repeatable) drops the parked entry whose line holds the words (a
//     paragraph left with no entry goes with it) and prints its full text, from the backlog file its paragraph names,
//     on stderr, for the new backlog's point or accuracy entry (round 20, round 19's own report point 2: a point a
//     new report brought back was removed by hand).
//   node scripts/friction.ts check <report.md…>
//     the numbered points without a `**Files:**` line (a backlog's: `**Needs:**`), which the lead splits a round by
//     (round 13's own report point 1); exit 1 when any. tests/friction.test.ts runs it over docs/friction/.
//
// All print to stdout and write nothing.

import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A report's numbered points: `## N. title` headings and the text up to the next heading. */
export interface Point {
  readonly n: number;
  readonly title: string;
  /** The section's lines after its heading, trailing blank lines dropped. */
  readonly body: readonly string[];
}

export function points(text: string): Point[] {
  const out: { n: number; title: string; body: string[] }[] = [];
  let cur: { n: number; title: string; body: string[] } | null = null;
  for (const line of text.split("\n")) {
    const m = /^## (\d+)\. (.+)$/.exec(line);
    if (m) {
      cur = { n: Number(m[1]), title: (m[2] as string).trim(), body: [] };
      out.push(cur);
    } else if (/^## /.test(line)) cur = null;
    else cur?.body.push(line);
  }
  return out.map((p) => {
    const body = [...p.body];
    while (body.length && (body.at(-1) as string).trim() === "") body.pop();
    return { ...p, body };
  });
}

/** A backlog point that carries a report's point: its number, and the part carried when the From entry names one. */
export interface Carried {
  readonly k: number;
  /** The parenthesis after the report point's number ("point 2 (its count)"): only that part was carried. */
  readonly part?: string;
}

/**
 * Which of a backlog's points carry which points of a report: per report point number, the backlog points whose
 * **From:** paragraph names the report's file with that number ("2026-11-24-stats-candidates.md point 5", "…md
 * points 1 (the parts export) and 3": point 1's parts export, and point 3).
 */
/**
 * The names a From line may give a report by: its file name, and for a backlog the label `carry --label` writes for it
 * ("backlog after round 17", the README's form; round 19, round 18's own report point 2: round 17's backlog's own
 * carried point came out blank because only the file name was matched).
 */
export function reportNames(report: string): string[] {
  const file = basename(report);
  const m = /backlog-after-round-(\d+)\.md$/.exec(file);
  return m ? [file, `backlog after round ${m[1]}`] : [file];
}

export function carriedFrom(backlog: string, report: string): Map<number, Carried[]> {
  const out = new Map<number, Carried[]>();
  const names = reportNames(report);
  for (const p of points(backlog)) {
    const from = p.body.findIndex((l) => /^- \*\*From:\*\* /.test(l));
    if (from < 0) continue;
    let text = p.body[from] as string;
    for (let i = from + 1; i < p.body.length && /^ {2}\S/.test(p.body[i] as string); i++) text += ` ${(p.body[i] as string).trim()}`;
    for (const part of text.split(";")) {
      const name = names.find((x) => part.includes(x));
      if (name === undefined) continue;
      const at = part.indexOf(name);
      // "<file> point n", or "<file>, point n" as `carry --label "<name>,"` (the README's form) writes it (round 15:
      // the carried point's outcome came out blank).
      const m = /^,?\s+points?\s+(.*)$/s.exec(part.slice(at + name.length));
      if (!m) continue;
      // A number with its parenthesis (the part carried), or a parenthesis alone (skipped, its numbers too).
      for (const x of (m[1] as string).matchAll(/(\d+)(?:\s*\(([^)]*)\))?|\([^)]*\)/g)) {
        if (x[1] === undefined) continue;
        const n = Number(x[1]);
        out.set(n, [...(out.get(n) ?? []), x[2] !== undefined ? { k: p.n, part: x[2].trim() } : { k: p.n }]);
      }
    }
  }
  return out;
}

export function outcomeSkeleton(text: string, round: number, backlog?: { readonly name: string; readonly carried: ReadonlyMap<number, readonly Carried[]> }): string {
  const ps = points(text);
  const lines = ps.map((p) => {
    const cs = backlog?.carried.get(p.n) ?? [];
    const whole = cs.filter((c) => c.part === undefined).map((c) => c.k);
    const parts = [
      ...(whole.length ? [`carried (${backlog?.name} point${whole.length > 1 ? "s" : ""} ${whole.join(", ")})`] : []),
      ...cs.flatMap((c) => (c.part !== undefined ? [`done but ${c.part} (carried: ${backlog?.name} point ${c.k})`] : [])),
    ];
    return `- ${p.n} (${p.title.replace(/\.$/, "")}): ${parts.join("; ")}`;
  });
  return [`## Outcome (round ${round})`, "", ...(lines.length ? lines : ["- (no numbered points)"])].join("\n");
}

/** A `## ` section's lines after its heading, up to the next `## ` heading (trailing blank lines dropped), or null. */
function section(text: string, heading: RegExp): string[] | null {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /^## /.test(l) && heading.test(l));
  if (at < 0) return null;
  const end = lines.findIndex((l, i) => i > at && /^## /.test(l));
  const body = lines.slice(at + 1, end < 0 ? undefined : end);
  while (body.length && (body.at(-1) as string).trim() === "") body.pop();
  return body;
}

/** A list's entries: each `- ` line at the margin with its indented continuation lines; the other lines as they are. */
function entries(body: readonly string[]): { readonly lines: readonly string[]; readonly entry: boolean }[] {
  const out: { lines: string[]; entry: boolean }[] = [];
  for (const l of body) {
    if (/^- /.test(l)) out.push({ lines: [l], entry: true });
    else if (/^ {2}\S/.test(l) && out.at(-1)?.entry) (out.at(-1) as { lines: string[] }).lines.push(l);
    else out.push({ lines: [l], entry: false });
  }
  return out;
}

export const PARKED = /^## Parked\b/;
export const ACCURACY_LIST = /^## Needs an accuracy or search task/;
/**
 * A backlog's "Declined" section: suggestions a round declined for good (round 20: the moved hold-outs' casts by kind
 * and shift, declined for blindness by the lead), carried into every next backlog as it is (carryLists), so a later
 * round doesn't rebuild one.
 */
export const DECLINED = /^## Declined\b/;

/**
 * The backlog's lists for the next one (carry --lists): its Parked section with `park`'s points added at the top as
 * one-line entries ("- n. title", under a line naming where their full text is), and its accuracy list without the
 * entries that carry a "Closed by" line or whose first line holds a `drop` text. Throws for a --drop text no entry has.
 */
export function carryLists(text: string, file: string, park: readonly number[] = [], drop: readonly string[] = [], unpark: readonly string[] = []): string {
  const out: string[] = [];
  const ps = points(text);
  const parked = section(text, PARKED) ?? [];
  while (parked.length && (parked[0] as string).trim() === "") parked.shift();
  const intro = parked.findIndex((l, i) => i > 0 && l.trim() === "" && (parked[i - 1] as string).trim() !== "");
  const head = intro < 0 ? parked : parked.slice(0, intro);
  const rest = withoutParked(intro < 0 ? [] : parked.slice(intro), unpark);
  const parkedNow = park.map((n) => {
    const p = ps.find((x) => x.n === n);
    if (!p) throw new Error(`--park ${n}: no point ${n} (the file has ${ps.map((x) => x.n).join(", ")})`);
    return `- ${n}. ${p.title.replace(/\.$/, "")}.`;
  });
  out.push("## Parked", "", ...(head.length ? head : ["A new report that hits one brings it back with its full text from there."]));
  if (parkedNow.length) out.push("", `Point${park.length > 1 ? "s" : ""} ${park.join(", ")} of ${file} (full text there under the same number), carried twice without a new report:`, "", ...parkedNow);
  out.push(...rest, "");
  const declined = section(text, DECLINED);
  if (declined) out.push(text.split("\n").find((l) => DECLINED.test(l)) as string, ...declined, "");
  const list = section(text, ACCURACY_LIST);
  if (list) {
    const used = new Set<string>();
    const kept = entries(list).filter((e) => {
      if (!e.entry) return true;
      if (e.lines.some((l) => /Closed by/.test(l))) return false;
      const hit = drop.find((d) => (e.lines[0] as string).includes(d));
      if (hit !== undefined) used.add(hit);
      return hit === undefined;
    });
    const unused = drop.filter((d) => !used.has(d));
    if (unused.length) throw new Error(`--drop: no accuracy-list entry's first line holds ${unused.map((d) => `"${d}"`).join(", ")}`);
    const heading = text.split("\n").find((l) => ACCURACY_LIST.test(l)) as string;
    // Blank lines the dropped entries left in a row collapse into one.
    const lines = kept.flatMap((e) => e.lines).filter((l, i, a) => !(i > 0 && l.trim() === "" && (a[i - 1] as string).trim() === ""));
    out.push(heading, ...lines, "");
  }
  return out.join("\n");
}

/** A parked entry --unpark brought back: its line, the backlog file its paragraph names and the point's number there. */
export interface Unparked {
  readonly line: string;
  readonly file: string | null;
  readonly n: number | null;
}

/** The paragraphs of a Parked section's lines (split at blank lines), each with its entries. */
function paragraphs(lines: readonly string[]): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (l.trim() === "") {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * The parked entries --unpark's words name (each must name exactly one), with the backlog file the paragraph before
 * them names ("… of docs/friction-done/<file> …", "full text in docs/friction-done/<file> …") and their number.
 */
export function unparked(text: string, unpark: readonly string[]): Unparked[] {
  const ps = paragraphs(section(text, PARKED) ?? []);
  return unpark.map((words) => {
    const found: Unparked[] = [];
    let file: string | null = null;
    for (const p of ps) {
      const named = /docs\/friction-done\/[\w.-]+\.md/.exec(p.join(" "));
      const list = entries(p);
      if (!list.some((e) => e.entry)) {
        file = named ? named[0] : file;
        continue;
      }
      for (const e of list) {
        if (!e.entry || !e.lines.join(" ").includes(words)) continue;
        const n = /^- (\d+)/.exec(e.lines[0] as string);
        found.push({ line: e.lines.join(" "), file, n: n ? Number(n[1]) : null });
      }
    }
    if (found.length !== 1) throw new Error(`--unpark "${words}": ${found.length} parked entries hold it (one wanted)`);
    return found[0] as Unparked;
  });
}

/** The Parked section's later paragraphs without the entries --unpark names, and without an intro left with none. */
function withoutParked(rest: readonly string[], unpark: readonly string[]): string[] {
  if (!unpark.length) return [...rest];
  const out: string[] = [];
  const ps = paragraphs(rest);
  const isList = (p: readonly string[]) => entries(p).some((e) => e.entry);
  const left = ps.map((p) => (isList(p) ? entries(p).filter((e) => !(e.entry && unpark.some((w) => e.lines.join(" ").includes(w)))).flatMap((e) => e.lines) : [...p]));
  ps.forEach((p, i) => {
    const l = left[i] as string[];
    if (!l.length) return;
    // An intro whose list after it lost every entry goes too.
    const next = ps[i + 1];
    if (!isList(p) && next !== undefined && isList(next) && !(left[i + 1] as string[]).length) return;
    out.push("", ...l);
  });
  return out;
}

/** An unparked point's full text from its backlog file (its `## n.` section), or a note why there is none. */
export function unparkedText(u: Unparked, read: (file: string) => string): string {
  if (u.file === null || u.n === null) return `${u.line}\n(no backlog file or number named: copy its text by hand)\n`;
  const p = points(read(u.file)).find((x) => x.n === u.n);
  if (!p) return `${u.line}\n(${u.file} has no point ${u.n})\n`;
  return [`From ${u.file} point ${u.n}:`, "", `## ${p.n}. ${p.title}`, ...p.body, ""].join("\n");
}

export function carry(text: string, wanted: readonly number[], start: number, label: string): string {
  const ps = points(text);
  const out: string[] = [];
  wanted.forEach((n, i) => {
    const p = ps.find((x) => x.n === n);
    if (!p) throw new Error(`no point ${n} (the file has ${ps.map((x) => x.n).join(", ")})`);
    // The From paragraph is its line and the indented lines after it (wrapped): extend its last line (round 7: the first
    // line of a wrapped one got the addition in its middle).
    const body = [...p.body];
    const from = body.findIndex((l) => /^- \*\*From:\*\* /.test(l));
    if (from < 0) body.push(`- **From:** ${label} point ${n}.`);
    else {
      let last = from;
      while (last + 1 < body.length && /^ {2}\S/.test(body[last + 1] as string)) last++;
      body[last] = `${(body[last] as string).replace(/\.?\s*$/, "")}; ${label} point ${n}.`;
    }
    out.push(`## ${start + i}. ${p.title}`, ...body, "");
  });
  return out.join("\n");
}

/** The numbered points of a report with no `- **Files:**` line (nor a backlog's `- **Needs:**`): their numbers. */
export function missingFiles(text: string): number[] {
  return points(text).filter((p) => !p.body.some((l) => /^- \*\*(Files|Needs):\*\* \S/.test(l))).map((p) => p.n);
}

function main(argv: readonly string[]): number {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { round: { type: "string" }, start: { type: "string" }, label: { type: "string" }, backlog: { type: "string" }, lists: { type: "boolean" }, park: { type: "string" }, drop: { type: "string", multiple: true }, unpark: { type: "string", multiple: true } },
  });
  const [cmd, ...rest] = positionals;
  if (cmd === "outcomes" && rest.length) {
    const round = Number(values.round ?? NaN);
    const backlog = values.backlog !== undefined ? readFileSync(values.backlog, "utf8") : undefined;
    for (const f of rest) {
      const carried = backlog !== undefined ? { name: basename(values.backlog as string), carried: carriedFrom(backlog, f) } : undefined;
      process.stdout.write(`${f}:\n\n${outcomeSkeleton(readFileSync(f, "utf8"), Number.isFinite(round) ? round : 0, carried)}\n\n`);
    }
    return 0;
  }
  if (cmd === "carry" && rest.length === 2) {
    const [file, list] = rest as [string, string];
    // "none": only the lists (every point closed or parked).
    const wanted = list === "none" ? [] : list.split(",").map(Number);
    if (wanted.some((n) => !Number.isInteger(n))) throw new Error("carry takes point numbers: 3,5,12");
    const text = readFileSync(file, "utf8");
    process.stdout.write(carry(text, wanted, Number(values.start ?? 1), values.label ?? basename(file)));
    if (values.lists) {
      const park = values.park !== undefined ? values.park.split(",").map(Number) : [];
      if (park.some((n) => !Number.isInteger(n))) throw new Error("--park takes point numbers: 1,4");
      const unpark = values.unpark ?? [];
      const back = unparked(text, unpark);
      process.stdout.write(`\n${carryLists(text, `docs/friction-done/${basename(file)}`, park, values.drop ?? [], unpark)}`);
      for (const u of back) process.stderr.write(`\nUnparked (for the new backlog's point or accuracy entry):\n${unparkedText(u, (f) => readFileSync(resolve(ROOT, f), "utf8"))}`);
    } else if (values.park !== undefined || values.drop || values.unpark) throw new Error("--park, --drop and --unpark go with --lists");
    return 0;
  }
  if (cmd === "check" && rest.length) {
    let bad = 0;
    for (const f of rest) {
      const missing = missingFiles(readFileSync(f, "utf8"));
      if (missing.length) bad++;
      process.stdout.write(`${f}: ${missing.length ? `point(s) ${missing.join(", ")} without a **Files:** line (the files its suggestion touches: docs/friction/README.md)` : "every point names its files"}\n`);
    }
    return bad ? 1 : 0;
  }
  process.stderr.write("usage: node scripts/friction.ts outcomes <report.md…> [--round n] [--backlog <new backlog.md>] | carry <backlog.md> <n,…> [--start k] [--label text] [--lists [--park n,…] [--drop text]… [--unpark text]…] | check <report.md…>\n");
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`friction: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  }
}
