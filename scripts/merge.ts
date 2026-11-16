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
// Usage: node scripts/merge.ts <branch> [--snapshots]     (from the checkout that merges)

import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
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

export function mergeBranch(root: string, branch: string, opts: { readonly snapshots?: boolean; readonly log?: (line: string) => void } = {}): MergeResult {
  const log = opts.log ?? ((l: string) => process.stdout.write(l + "\n"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const journal = (...args: string[]) => execFileSync("node", ["scripts/journal.ts", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const journalStale = () => spawnSync("node", ["scripts/journal.ts", "--check"], { cwd: root }).status !== 0;

  const m = spawnSync("git", ["merge", "--no-ff", "--no-edit", branch], { cwd: root, encoding: "utf8" });
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
    log(`merge: resolve by hand, then commit: ${c.left.join(", ")}`);
    return { merged: false, committed: false, rebuiltJournal, snapshots: c.snapshots, left: c.left };
  }
  if (c.snapshots.length && !opts.snapshots) {
    log(`merge: took our side of ${c.snapshots.join(", ")}: run npm run snapshots:update, git add them, then commit (or rerun with --snapshots)`);
    return { merged: false, committed: false, rebuiltJournal, snapshots: c.snapshots, left: [] };
  }
  git("commit", "-q", "--no-edit");
  log(`merge: committed the merge of ${branch}`);
  return { merged: true, committed: true, rebuiltJournal, snapshots: c.snapshots, left: [] };
}

function main(argv: readonly string[]): number {
  const branch = argv.find((a) => !a.startsWith("--"));
  if (!branch) throw new Error("usage: node scripts/merge.ts <branch> [--snapshots]");
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const r = mergeBranch(root, branch, { snapshots: argv.includes("--snapshots") });
  return r.committed ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`merge: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  }
}
