// The tried-and-dropped diffs of docs/tried/ by what they touch (round 20, the Liino report point 2: a tail-cut diff
// tried hours earlier by another round was derived again, measured twice, and its file overwritten by name, because
// docs/tried/ could be searched only by file name or prose).
//
// Usage:
//   node scripts/tried.ts --touching <file>[:<function>] | <function> | <word>  (repeatable)
//     the diffs whose hunks touch that file (a path's tail is enough: replayrun.ts), that function (the hunk's
//     `@@ … function` context or a function its lines declare), or whose header names that word (a reading id, a
//     fixture, a rule's constant); each with its header's first line. Run it before measuring a rule change.
//   node scripts/tried.ts index
//     every diff, the files and functions its hunks touch, and its header's first line.
//   node scripts/tried.ts new <slug> -- <path…>
//     writes docs/tried/<today>-<slug>.diff from `git diff -- <path…>` (the working tree against the index), under a
//     header skeleton to fill in (what it does, the measure's lines, why it was dropped, what would make it work);
//     refuses a name that exists (the overwrite of round 19's tail-own-landing.diff) and an empty diff.
//   node scripts/tried.ts refresh <docs/tried/x.diff> [--at <ref>]
//     the diff made again on <ref>'s code (default HEAD): applied with `git apply -3` in a scratch worktree, the
//     result written back under the same header, or the files whose hunks conflict named and nothing written (round
//     21, the tail-cut report point 2: a tried diff's context goes stale as its function changes, and `measure
//     --patch` or `cli-ab --patch` then refuse it).
//
// tests/tried.test.ts checks that every diff there has a header before its first `diff --git` line (a `git diff >`
// over an existing file loses it) and a line in docs/tried/README.md.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { headerUsage } from "./usage.ts";
import { printHelp } from "./usage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const TRIED_DIR = join(ROOT, "docs/tried");

/** One diff's index entry: its file name, the header's text, and per touched file the functions its hunks touch. */
export interface TriedDiff {
  readonly name: string;
  readonly header: string;
  readonly files: ReadonlyMap<string, readonly string[]>;
}

/** A function name in a line: `function x(`, `const x = (` / `= async (`, a method `x(…) {`. */
function declared(line: string): string | null {
  const m = /\bfunction\s+([A-Za-z_$][\w$]*)/.exec(line) ?? /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/.exec(line) ?? /^\s*(?:export\s+)?(?:interface|type|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
  return m ? (m[1] as string) : null;
}

/** Parses a diff file: the text before its first `diff --git` line is the header. */
export function parseTried(name: string, text: string): TriedDiff {
  const lines = text.split("\n");
  const first = lines.findIndex((l) => l.startsWith("diff --git "));
  const header = (first < 0 ? lines : lines.slice(0, first)).join("\n").trim();
  const files = new Map<string, string[]>();
  let file: string | null = null;
  for (const l of first < 0 ? [] : lines.slice(first)) {
    const d = /^diff --git [ab]\/(\S+) [ab]\/(\S+)/.exec(l);
    if (d) {
      file = d[2] as string;
      if (!files.has(file)) files.set(file, []);
      continue;
    }
    if (file === null) continue;
    const fns = files.get(file) as string[];
    const add = (f: string | null) => {
      if (f && !fns.includes(f)) fns.push(f);
    };
    const h = /^@@ [^@]+ @@ ?(.*)$/.exec(l);
    if (h) add(declared(h[1] as string));
    else if (/^[ +-]/.test(l) && !/^(\+\+\+|---) /.test(l)) add(declared(l.slice(1)));
  }
  return { name, header, files };
}

export function triedDiffs(dir = TRIED_DIR): TriedDiff[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".diff"))
    .sort()
    .map((f) => parseTried(f, readFileSync(join(dir, f), "utf8")));
}

/** Whether a diff touches `<file>[:<function>]`, a function, or names a word in its header. */
export function touches(d: TriedDiff, query: string): string | null {
  const [file, fn] = query.includes(":") ? (query.split(":", 2) as [string, string]) : [query, undefined];
  const pathLike = /[/.]/.test(file);
  for (const [f, fns] of d.files) {
    if (pathLike && (f === file || f.endsWith(`/${file}`))) {
      if (fn === undefined) return f;
      if (fns.includes(fn)) return `${f}:${fn}`;
    }
    if (!pathLike && fns.includes(query)) return `${f}:${query}`;
  }
  if (fn === undefined && d.header.includes(query)) return "its header";
  return null;
}

const firstLine = (d: TriedDiff) => d.header.split("\n")[0] ?? "";

export function touchingText(diffs: readonly TriedDiff[], queries: readonly string[]): string {
  const out: string[] = [];
  for (const q of queries) {
    const hits = diffs.flatMap((d) => {
      const why = touches(d, q);
      return why ? [`  docs/tried/${d.name} (${why}): ${firstLine(d)}`] : [];
    });
    out.push(`${q}: ${hits.length ? `${hits.length} tried diff(s)` : "no tried diff touches it"}`, ...hits);
  }
  return out.join("\n");
}

export function indexText(diffs: readonly TriedDiff[]): string {
  return diffs.flatMap((d) => [`docs/tried/${d.name}: ${firstLine(d)}`, ...[...d.files].map(([f, fns]) => `  ${f}${fns.length ? `: ${fns.join(", ")}` : ""}`)]).join("\n");
}

/** The header skeleton `new` writes above the diff. */
export function headerSkeleton(slug: string, date: string): string {
  return [
    `${slug.replace(/-/g, " ")} (${date}): <one line: what it does>.`,
    "",
    "What it does: <the rule, the function, the reading>.",
    "",
    "Measured: <the summary's lines, development and hold-out>.",
    "",
    "Why dropped: <…>. What would make it work: <…>.",
    "",
    "",
  ].join("\n");
}

/** A tried diff's header (the text before its first `diff --git` line) and its diff. */
export function splitTried(text: string): { readonly header: string; readonly diff: string } {
  const i = text.search(/^diff --git /m);
  return i < 0 ? { header: text, diff: "" } : { header: text.slice(0, i), diff: text.slice(i) };
}

/**
 * A tried diff made again on a ref's code (tried.ts refresh): `git apply -3` in a detached worktree of the ref under
 * scratch/, then `git diff` there; the worktree removed after. `conflicts`: the files whose hunks don't merge (none
 * written then).
 */
export function refreshTried(file: string, ref = "HEAD", root = ROOT): { readonly text: string | null; readonly conflicts: readonly string[]; readonly note: string } {
  const { header, diff } = splitTried(readFileSync(file, "utf8"));
  if (!diff) throw new Error(`${file}: no diff after its header`);
  const dir = join(root, "scratch", `tried-refresh-${process.pid}`);
  const git = (args: readonly string[], cwd = root) => spawnSync("git", args, { cwd, encoding: "utf8", input: undefined });
  const add = git(["worktree", "add", "--detach", "--quiet", dir, ref]);
  if (add.status !== 0) throw new Error(`git worktree add ${ref}: ${add.stderr.trim()}`);
  try {
    const patch = join(dir, ".tried-refresh.diff");
    writeFileSync(patch, diff);
    let apply = git(["apply", "-3", "--whitespace=nowarn", patch], dir);
    const unmerged = git(["diff", "--name-only", "--diff-filter=U"], dir).stdout.split("\n").filter(Boolean);
    // Without the preimage's blobs (a diff of a working tree never committed), the hunks by one line of context.
    if (apply.status !== 0 && !unmerged.length) apply = git(["apply", "--index", "--recount", "-C1", "--whitespace=nowarn", patch], dir);
    if (apply.status !== 0 && !unmerged.length) return { text: null, conflicts: [], note: apply.stderr.trim().split("\n").slice(0, 2).join("; ") || "git apply failed" };
    if (unmerged.length) return { text: null, conflicts: unmerged, note: "hunks that don't merge: refresh them by hand" };
    // The applied change against the ref (git apply -3 stages what it merged), the patch file itself left out.
    const out = git(["diff", "HEAD", "--", ".", ":!.tried-refresh.diff"], dir).stdout;
    return { text: header + out, conflicts: [], note: out === diff ? "unchanged: it applies as it is" : "refreshed" };
  } finally {
    git(["worktree", "remove", "--force", dir]);
  }
}

function main(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h") || !argv.length) {
    process.stdout.write(`${headerUsage(import.meta.url)}\n`);
    return argv.length ? 0 : 2;
  }
  if (argv[0] === "index") {
    process.stdout.write(`${indexText(triedDiffs())}\n`);
    return 0;
  }
  if (argv[0] === "new") {
    const slug = argv[1];
    const sep = argv.indexOf("--");
    const paths = sep >= 0 ? argv.slice(sep + 1) : [];
    if (!slug || slug.startsWith("-") || !/^[a-z0-9-]+$/.test(slug) || !paths.length) throw new Error("usage: node scripts/tried.ts new <slug> -- <path…> (a slug of a-z, 0-9 and -)");
    const date = new Date().toISOString().slice(0, 10);
    const file = join(TRIED_DIR, `${date}-${slug}.diff`);
    if (existsSync(file)) throw new Error(`docs/tried/${date}-${slug}.diff exists (another round's?): pick another slug; never overwrite a tried diff`);
    const r = spawnSync("git", ["diff", "--", ...paths], { cwd: ROOT, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git diff failed: ${r.stderr}`);
    if (!r.stdout.trim()) throw new Error(`git diff -- ${paths.join(" ")} is empty: nothing to keep`);
    writeFileSync(file, headerSkeleton(slug, date) + r.stdout, { flag: "wx" });
    process.stdout.write(`wrote docs/tried/${date}-${slug}.diff: fill in its header, add its line to docs/tried/README.md, name it in its open-problems.md paragraph\n`);
    return 0;
  }
  if (argv[0] === "refresh") {
    const file = argv[1];
    const at = argv.indexOf("--at");
    if (!file || file.startsWith("-")) throw new Error("usage: node scripts/tried.ts refresh <docs/tried/x.diff> [--at <ref>]");
    const ref = at >= 0 ? (argv[at + 1] ?? "HEAD") : "HEAD";
    const r = refreshTried(resolve(file), ref);
    if (r.text === null) {
      process.stdout.write(`tried refresh: ${file} not written: ${r.note}${r.conflicts.length ? ` (${r.conflicts.join(", ")})` : ""}\n`);
      return 1;
    }
    writeFileSync(resolve(file), r.text);
    process.stdout.write(`tried refresh: ${file} ${r.note} on ${ref}\n`);
    return 0;
  }
  const queries: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--touching" && argv[i + 1] !== undefined) queries.push(argv[++i] as string);
    else throw new Error(`unknown argument ${argv[i]} (node scripts/tried.ts --help)`);
  }
  process.stdout.write(`${touchingText(triedDiffs(), queries)}\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`tried: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  }
}
