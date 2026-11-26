// Where a lead's causes have lived before, for the lead splitting parallel work by files (round 13, the damage-factors
// report point 1: of five damage factors, the causes of four sat in files the brief had given another agent, so three
// fixes went back as held-back diffs). For each term (a fixture id such as 0c14, an operator's name, a mechanism word:
// Crush, Corrosion, in-turn), the code files changed by the commits whose message names it, most often first: a cheap
// prior for "which files will this question need", before the brief names any.
//
// Usage: node scripts/lead-files.ts <term>… [--ref <ref>] [--commits n] [--top n]
//   --ref      the history searched (default main)
//   --commits  how many commits back (default 400)
//   --top      files shown per term (default 12)
// Each file is marked when another worktree's branch has changed it since main (scripts/runstate.ts --touching): a
// split that gives that file to someone else needs a held-back diff or a later merge (docs/tried/README.md, "held
// back"). Only code files are counted (packages/, scripts/, tests/ but not tests/snapshots/); docs, fixtures and the
// generated files are left out, hold-out paths never named.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { touching } from "./runstate.ts";
import { printHelp } from "./usage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A file counts as code: packages, scripts and tests, not the snapshots or fixtures. */
export const isCode = (f: string) => /^(packages|scripts|tests)\//.test(f) && !f.startsWith("tests/snapshots/") && !f.includes("fixtures/");

/**
 * Per term, the code files of the commits (`log`: commit → message and files) whose message names it (case aside),
 * with how many such commits changed each, most first.
 */
export function leadFiles(log: readonly { readonly commit: string; readonly message: string; readonly files: readonly string[] }[], terms: readonly string[]): Map<string, { commits: number; files: [string, number][] }> {
  const out = new Map<string, { commits: number; files: [string, number][] }>();
  for (const term of terms) {
    const t = term.toLowerCase();
    const mine = log.filter((c) => c.message.toLowerCase().includes(t));
    const count = new Map<string, number>();
    for (const c of mine) for (const f of new Set(c.files.filter(isCode))) count.set(f, (count.get(f) ?? 0) + 1);
    out.set(term, { commits: mine.length, files: [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) });
  }
  return out;
}

/** The last `n` commits of `ref`: hash, whole message, files changed (hold-out paths never listed: the pathspec excludes them). */
function history(ref: string, n: number): { commit: string; message: string; files: string[] }[] {
  const r = spawnSync("git", ["log", ref, `-n${n}`, "--name-only", "--format=%x00%h%x01%B%x01", "--", ".", ":!fixtures/holdout"], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 << 20 });
  if (r.status !== 0) throw new Error(`git log ${ref}: ${r.stderr.trim()}`);
  return r.stdout
    .split("\0")
    .filter((x) => x.trim())
    .map((x) => {
      const [commit, message, rest] = x.split("\x01") as [string, string, string];
      return { commit: commit.trim(), message, files: (rest ?? "").split("\n").map((l) => l.trim()).filter(Boolean) };
    });
}

function main(argv: string[]): number {
  if (printHelp(argv, import.meta.url)) return 0;
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { ref: { type: "string", default: "main" }, commits: { type: "string", default: "400" }, top: { type: "string", default: "12" } } });
  if (!positionals.length) {
    process.stderr.write("usage: node scripts/lead-files.ts <term>… [--ref <ref>] [--commits n] [--top n] (--help)\n");
    return 2;
  }
  const busy = new Set(touching("main").filter((l) => l.startsWith("  ")).map((l) => l.trim().replace(/ \(uncommitted\)$/, "")));
  const found = leadFiles(history(values.ref, Number(values.commits)), positionals);
  for (const [term, { commits, files }] of found) {
    process.stdout.write(`${term}: ${commits} commit(s) of the last ${values.commits} on ${values.ref} name it; their code files:\n`);
    for (const [f, n] of files.slice(0, Number(values.top))) process.stdout.write(`  ${String(n).padStart(3)}  ${f}${busy.has(f) ? "  (changed by another worktree's branch now)" : ""}\n`);
    if (files.length > Number(values.top)) process.stdout.write(`  … ${files.length - Number(values.top)} more\n`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
