// Merging a branch (the lead merging a sub-agent's work): `git merge`, then the generated files are regenerated
// instead of merged by hand (CLAUDE.md "Journal and roadmap", "Correctness").
//
// - docs/journal.md and docs/journal/README.md (built from the entry files): rebuilt with scripts/journal.ts, after
//   adopting entries the branch wrote the old way (at the top of docs/journal.md).
// - tests/snapshots/*.json and docs/accuracy.md: one side is taken (ours); they must be regenerated from the merged
//   code with `npm run snapshots:update` (minutes), which this runs with --snapshots, and otherwise says.
// - Any other conflict is left for you; the merge is then not committed.
// A clean merge whose built journal is stale gets the rebuild as its own commit.
//
// Branches that each pass premerge can still break each other (round 5: one branch's 30-frame tick hold reached the
// other's newly hit-shown bleed ticks; only a hand-run `vitest related` caught it). So after the merges, the tests
// related to the code both sides changed run (`npx vitest related --run`, under the test lock): the source files
// either side changed inside a package (packages/<name>/) both sides changed, and any file both changed. --no-test
// prints the command instead.
//
// Several branches in one go (a batch: `npm run merge -- a b c`): merged in order, stopping at the first that needs a
// hand resolution; snapshot conflicts take our side and are committed, to be regenerated once at the end
// (--snapshots runs `npm run snapshots:update` then and commits it; otherwise the last line says to), and the related
// tests run once over every pair's shared code. No running snapshots job has to be stopped to add a branch.
//
// Usage: node scripts/merge.ts <branch>… [--snapshots] [--no-test]     (from the checkout that merges)

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const JOURNAL = ["docs/journal.md", "docs/journal/README.md"];
const isSnapshot = (f: string) => /^tests\/snapshots\/[^/]+\.json$/.test(f) || f === "docs/accuracy.md";

export interface MergeResult {
  readonly merged: boolean;
  readonly committed: boolean;
  readonly rebuiltJournal: boolean;
  /** Snapshot files taken from our side, to regenerate. */
  readonly snapshots: readonly string[];
  /** Conflicts left to resolve by hand. */
  readonly left: readonly string[];
}

/** What to do with the conflicted files: rebuild the journal, take our snapshots, leave the rest. */
export function classify(conflicted: readonly string[]): { journal: string[]; snapshots: string[]; left: string[] } {
  return {
    journal: conflicted.filter((f) => JOURNAL.includes(f)),
    snapshots: conflicted.filter(isSnapshot),
    left: conflicted.filter((f) => !JOURNAL.includes(f) && !isSnapshot(f)),
  };
}

/** The package directory of a path (packages/<name>/), or undefined. */
const packageOf = (f: string) => /^packages\/[^/]+\//.exec(f)?.[0];

/**
 * The files whose related tests a merge must run: the source files (.ts) either side changed inside a package both
 * sides changed, and every .ts file both sides changed (scripts, tests). Sorted, without duplicates.
 */
export function sharedCode(ours: readonly string[], theirs: readonly string[]): string[] {
  const pkgs = (fs: readonly string[]) => new Set(fs.map(packageOf).filter((p): p is string => p !== undefined));
  const [a, b] = [pkgs(ours), pkgs(theirs)];
  const both = new Set([...a].filter((p) => b.has(p)));
  const theirSet = new Set(theirs);
  const out = new Set<string>();
  for (const f of [...ours, ...theirs]) {
    if (!f.endsWith(".ts")) continue;
    const p = packageOf(f);
    if ((p !== undefined && both.has(p)) || (ours.includes(f) && theirSet.has(f))) out.add(f);
  }
  return [...out].sort();
}

/** Paths to print: a hold-out fixture's never by name (CLAUDE.md, hold-out logs), only as a count. */
export function shownPaths(paths: readonly string[]): string[] {
  const hidden = paths.filter((p) => p.startsWith("fixtures/holdout/"));
  return [...paths.filter((p) => !p.startsWith("fixtures/holdout/")), ...(hidden.length ? [`${hidden.length} file(s) under fixtures/holdout/ (not named)`] : [])];
}

/** The files each side changed since the merge base of HEAD and the branch (before merging it). */
export function sides(root: string, branch: string): { ours: string[]; theirs: string[] } {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const base = git("merge-base", "HEAD", branch);
  const files = (to: string) => git("diff", "--name-only", base, to).split("\n").filter(Boolean);
  return { ours: files("HEAD"), theirs: files(branch) };
}

export function mergeBranch(root: string, branch: string, opts: { readonly snapshots?: boolean; readonly log?: (line: string) => void; readonly snapshotsLater?: boolean } = {}): MergeResult {
  const log = opts.log ?? ((l: string) => process.stdout.write(l + "\n"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const journal = (...args: string[]) => execFileSync("node", ["scripts/journal.ts", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const journalStale = () => spawnSync("node", ["scripts/journal.ts", "--check"], { cwd: root }).status !== 0;

  // --no-stat: a merge's diffstat names every file, hold-out fixtures included (round 8; CLAUDE.md, hold-out logs).
  const m = spawnSync("git", ["merge", "--no-ff", "--no-edit", "--no-stat", branch], { cwd: root, encoding: "utf8" });
  if (m.status === 0) {
    log(`merge: merged ${branch} cleanly`);
    if (!journalStale()) return { merged: true, committed: true, rebuiltJournal: false, snapshots: [], left: [] };
    journal();
    git("add", ...JOURNAL);
    git("commit", "-q", "-m", `Merge ${branch}: rebuild the journal (npm run journal)`);
    log("merge: the built journal was stale; rebuilt and committed");
    return { merged: true, committed: true, rebuiltJournal: true, snapshots: [], left: [] };
  }
  const conflicted = git("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
  if (!conflicted.length) throw new Error(`git merge ${branch} failed without conflicts:\n${m.stderr || m.stdout}`);
  const c = classify(conflicted);
  let rebuiltJournal = false;
  if (c.journal.length) {
    git("checkout", "--ours", "--", ...c.journal);
    // Entries the branch wrote the old way (a top entry in its docs/journal.md) become entry files first.
    journal("adopt", "--from", "MERGE_HEAD");
    git("add", ...JOURNAL, "docs/journal");
    rebuiltJournal = true;
    log("merge: rebuilt the journal from the entry files of both sides");
  }
  if (c.snapshots.length) {
    git("checkout", "--ours", "--", ...c.snapshots);
    if (opts.snapshots) {
      log("merge: regenerating the snapshots from the merged code (npm run snapshots:update, minutes)");
      const s = spawnSync("npm", ["run", "snapshots:update"], { cwd: root, stdio: "inherit" });
      if (s.status !== 0) throw new Error("npm run snapshots:update failed: the merge is left uncommitted");
    }
    git("add", ...c.snapshots);
  }
  if (c.left.length) {
    log(`merge: resolve by hand, then commit: ${shownPaths(c.left).join(", ")}`);
    return { merged: false, committed: false, rebuiltJournal, snapshots: c.snapshots, left: c.left };
  }
  if (c.snapshots.length && !opts.snapshots && !opts.snapshotsLater) {
    log(`merge: took our side of ${c.snapshots.join(", ")}: run npm run snapshots:update, git add them, then commit (or rerun with --snapshots)`);
    return { merged: false, committed: false, rebuiltJournal, snapshots: c.snapshots, left: [] };
  }
  if (c.snapshots.length && opts.snapshotsLater) log(`merge: took our side of ${c.snapshots.join(", ")} (stale until the batch's snapshots:update)`);
  git("commit", "-q", "--no-edit");
  log(`merge: committed the merge of ${branch}`);
  return { merged: true, committed: true, rebuiltJournal, snapshots: c.snapshots, left: [] };
}

/** The related tests of the shared code, under the test lock; or only the command, with `run` false. */
function relatedTests(root: string, files: readonly string[], run: boolean, log: (l: string) => void): boolean {
  const present = files.filter((f) => existsSync(join(root, f)));
  if (!present.length) {
    log("merge: no source file in code both sides changed: no related tests to run");
    return true;
  }
  const command = ["npx", "vitest", "related", "--run", ...present];
  log(`merge: code both sides changed (${present.length} file(s): ${present.join(", ")}); its related tests: ${command.join(" ")}`);
  if (!run) {
    log("merge: --no-test: run that before pushing");
    return true;
  }
  const r = spawnSync("node", ["scripts/testlock.ts", "--kind", "tests", "--who", "merge", "--", ...command], { cwd: root, stdio: "inherit" });
  log(r.status === 0 ? "merge: the related tests passed" : "merge: the related tests FAILED on the merged code: the branches break each other; fix before pushing");
  return r.status === 0;
}

function main(argv: readonly string[]): number {
  const branches = argv.filter((a) => !a.startsWith("--"));
  const unknown = argv.filter((a) => a.startsWith("--") && !["--snapshots", "--no-test"].includes(a));
  if (!branches.length || unknown.length) throw new Error("usage: node scripts/merge.ts <branch>… [--snapshots] [--no-test]");
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const log = (l: string) => process.stdout.write(l + "\n");
  const regenerate = argv.includes("--snapshots");
  const batch = branches.length > 1;
  const shared = new Set<string>();
  const stale = new Set<string>();
  for (const branch of branches) {
    const { ours, theirs } = sides(root, branch);
    for (const f of sharedCode(ours, theirs)) shared.add(f);
    const r = mergeBranch(root, branch, batch ? { snapshotsLater: true, log } : { snapshots: regenerate, log });
    for (const f of r.snapshots) stale.add(f);
    if (!r.committed) {
      if (batch) log(`merge: stopped at ${branch}; not merged yet: ${branches.slice(branches.indexOf(branch) + 1).join(", ") || "none"}`);
      return 1;
    }
  }
  if (batch && stale.size) {
    if (regenerate) {
      log("merge: regenerating the snapshots once for the batch (npm run snapshots:update, minutes)");
      const s = spawnSync("npm", ["run", "snapshots:update"], { cwd: root, stdio: "inherit" });
      if (s.status !== 0) throw new Error("npm run snapshots:update failed: the merges are committed, the snapshots stale");
      execFileSync("git", ["add", "tests/snapshots", "docs/accuracy.md"], { cwd: root });
      execFileSync("git", ["commit", "-q", "-m", `Snapshots and scoreboard for the merged batch (${branches.join(", ")})`], { cwd: root });
      log("merge: committed the batch's snapshots");
    } else log(`merge: the batch's snapshots are stale (${[...stale].join(", ")}): npm run snapshots:update once, then commit them`);
  }
  return relatedTests(root, [...shared].sort(), !argv.includes("--no-test"), log) ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`merge: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  }
}
