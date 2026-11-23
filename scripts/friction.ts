// The paperwork of an improvement round (docs/friction/README.md), which round 5 did with scratch Python:
//
//   node scripts/friction.ts outcomes <report.md…> [--round <n>]
//     an "Outcome (round n)" skeleton per report: a line per `## N. title` heading ("- N (title): "), to fill in
//     and append to the report before it moves to docs/friction-done/
//   node scripts/friction.ts carry <backlog.md> <n,…> [--start <k>] [--label "<this backlog's name>"]
//     the backlog's points n,… renumbered from k (default 1), each `**From:**` line extended with where it was
//     carried from ("<label> point n"; default the backlog's file name), printed for the next backlog
//
// Both print to stdout and write nothing.

import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

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

export function outcomeSkeleton(text: string, round: number): string {
  const ps = points(text);
  const lines = ps.map((p) => `- ${p.n} (${p.title.replace(/\.$/, "")}): `);
  return [`## Outcome (round ${round})`, "", ...(lines.length ? lines : ["- (no numbered points)"])].join("\n");
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

function main(argv: readonly string[]): number {
  const { values, positionals } = parseArgs({ args: [...argv], allowPositionals: true, options: { round: { type: "string" }, start: { type: "string" }, label: { type: "string" } } });
  const [cmd, ...rest] = positionals;
  if (cmd === "outcomes" && rest.length) {
    const round = Number(values.round ?? NaN);
    for (const f of rest) process.stdout.write(`${f}:\n\n${outcomeSkeleton(readFileSync(f, "utf8"), Number.isFinite(round) ? round : 0)}\n\n`);
    return 0;
  }
  if (cmd === "carry" && rest.length === 2) {
    const [file, list] = rest as [string, string];
    const wanted = list.split(",").map(Number);
    if (wanted.some((n) => !Number.isInteger(n))) throw new Error("carry takes point numbers: 3,5,12");
    process.stdout.write(carry(readFileSync(file, "utf8"), wanted, Number(values.start ?? 1), values.label ?? basename(file)));
    return 0;
  }
  process.stderr.write("usage: node scripts/friction.ts outcomes <report.md…> [--round n] | carry <backlog.md> <n,…> [--start k] [--label text]\n");
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
