// Runs an earlier commit's code beside the current one, for before/after measurements and for attributing a change
// to one fix: a detached git worktree of <ref> (under scratch/at/, git-ignored), its own @efsim packages linked
// (scripts/setup-worktree.ts's setupWorktree, so it runs its own code, not this checkout's), dependencies and the
// game data from the main checkout. Optionally a patch on top ("the old code with only this fix").
//
// Usage:
//   node scripts/at-commit.ts <ref> [--dir <dir>] [--patch <file>]   make (or reuse) it; prints the directory and how
//                                                                    to run its CLI
//   node scripts/at-commit.ts <ref> --run <script> [-- args…]        run a script of this checkout (a probe being
//                                                                    edited, a scratch script) against that commit's
//                                                                    code: copied to the same path in the tree, run
//                                                                    there (cwd the tree), then put back; only that
//                                                                    file is copied, its imports are the tree's
//                                                                    (misprediction-stats report point 3). Its exit
//                                                                    code is the script's
//   node scripts/at-commit.ts --remove <dir>                         remove it again (git worktree remove)
//
// The default directory is scratch/at/<the commit's short hash>. Then, e.g.:
//   npm run bench -- "node scratch/at/<hash>/packages/cli/src/main.ts simulate x.json" \
//                               "node packages/cli/src/main.ts simulate x.json"
// Its tests: run vitest from inside that directory (its own configs). A ref older than the main-checkout data fallback
// (2026-11-16) may need EFSIM_DATA_DIR=<main checkout>/data, printed here.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckoutOf } from "../packages/data/src/checkout.ts";
import { setupWorktree } from "./setup-worktree.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(args: readonly string[], cwd = ROOT): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim();
}

/** Makes (or reuses, when it is already at that commit) a worktree of `ref` in `dir`; returns the commit. */
export function atCommit(ref: string, dir: string, patch?: string): string {
  const commit = git(["rev-parse", "--verify", `${ref}^{commit}`]);
  if (existsSync(join(dir, ".git"))) {
    const head = git(["rev-parse", "HEAD"], dir);
    if (head !== commit) throw new Error(`${dir} exists at ${head.slice(0, 9)}, not ${commit.slice(0, 9)}: --remove it first or pass another --dir`);
    if (git(["status", "--porcelain"], dir) !== "" && !patch) throw new Error(`${dir} has local changes (an earlier --patch?): --remove it first`);
  } else {
    mkdirSync(dirname(dir), { recursive: true });
    git(["worktree", "add", "--detach", dir, commit]);
  }
  if (patch) applyPatch(patch, dir, ref, commit);
  setupWorktree(dir);
  return commit;
}

/**
 * `git apply` of a patch in a commit's worktree, with a message that names the hunks that failed and the files the diff
 * touches (round 12 friction point 1: a view's diff on an old commit fails where the view moved since; the old side only
 * needs the view's own files). git apply is all or nothing, so a failure leaves the tree as the commit has it.
 */
export function applyPatch(patch: string, dir: string, ref: string, commit: string): void {
  const r = spawnSync("git", ["apply", "--whitespace=nowarn", resolve(patch)], { cwd: dir, encoding: "utf8" });
  if (r.status === 0) return;
  const err = (r.stderr || r.stdout).trim();
  const hunks = [...err.matchAll(/patch failed: (\S+?):(\d+)/g)].map((m) => `${m[1]} at line ${m[2]}`);
  const missing = [...err.matchAll(/(\S+): No such file or directory|(\S+): does not exist in index/g)].map((m) => m[1] ?? m[2]);
  const files = [...new Set([...readFileSync(resolve(patch), "utf8").matchAll(/^\+\+\+ b\/(\S+)/gm)].map((m) => m[1] as string))];
  throw new Error(
    [
      `--patch ${patch} doesn't apply on ${ref} (${commit.slice(0, 9)})${hunks.length ? `: the hunk(s) at ${hunks.join(", ")} failed (that code changed since the diff's base)` : ""}${missing.length ? `; not in that commit: ${missing.join(", ")}` : ""}.`,
      `The diff touches ${files.join(", ") || "no file"}. A new view on old code needs only the view's files: git diff <its base> -- <the view files> > scratch/view.diff (where the view itself moved since, port it by hand); git's own words: ${err.split("\n").slice(0, 4).join(" / ")}`,
    ].join(" "),
  );
}

/**
 * A commit of the working tree as it is now (tracked changes and untracked files that aren't git-ignored), made with
 * a temporary index, so the real index, the files and the branch stay untouched; HEAD itself when nothing differs.
 * For a job that waits in the test lock's queue and should run the code of the moment it was queued (measure,
 * team-ab: round 5), not whatever is on disk when its turn comes.
 */
export function snapshotCommit(root = ROOT): { readonly commit: string; readonly head: string; readonly dirty: boolean } {
  const head = git(["rev-parse", "HEAD"], root);
  const dir = mkdtempSync(join(tmpdir(), "efsim-snapshot-"));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(dir, "index") };
    const run = (args: readonly string[]) => {
      const r = spawnSync("git", args, { cwd: root, encoding: "utf8", env, maxBuffer: 64 << 20 });
      if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${(r.stderr || r.stdout).trim()}`);
      return r.stdout.trim();
    };
    run(["read-tree", "HEAD"]);
    run(["add", "-A", "--", "."]);
    const tree = run(["write-tree"]);
    if (tree === git(["rev-parse", "HEAD^{tree}"], root)) return { commit: head, head, dirty: false };
    return { commit: run(["commit-tree", tree, "-p", head, "-m", "a snapshot of the working tree (scripts/at-commit.ts snapshotCommit)"]), head, dirty: true };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Runs a script of this checkout in an atCommit tree: copied to the same relative path there (so its relative imports
 * reach the tree's packages), run with the tree as cwd, then the tree's own file put back (or removed). The exit code.
 */
export function runInTree(dir: string, script: string, args: readonly string[], root = ROOT): number {
  const rel = relative(root, resolve(script));
  if (rel.startsWith("..")) throw new Error(`--run ${script}: not a file of this checkout`);
  const target = join(dir, rel);
  const before = existsSync(target) ? readFileSync(target) : undefined;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(script), target);
  try {
    return spawnSync(process.execPath, [target, ...args], { cwd: dir, stdio: "inherit" }).status ?? 1;
  } finally {
    if (before !== undefined) writeFileSync(target, before);
    else rmSync(target, { force: true });
  }
}

/** Removes a worktree made by atCommit (git worktree remove --force). */
export function removeAtCommit(dir: string): void {
  git(["worktree", "remove", "--force", resolve(dir)]);
}

function main(argv: string[]): number {
  if (argv[0] === "--remove") {
    const dir = argv[1];
    if (!dir) throw new Error("--remove takes the directory");
    removeAtCommit(dir);
    process.stdout.write(`at-commit: removed ${dir}\n`);
    return 0;
  }
  const ref = argv[0];
  if (!ref || ref.startsWith("--")) {
    process.stderr.write("usage: node scripts/at-commit.ts <ref> [--dir <dir>] [--patch <file>] [--run <script> [-- args…]] | --remove <dir>\n");
    return 2;
  }
  const opt = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const short = git(["rev-parse", "--short=9", "--verify", `${ref}^{commit}`]);
  const dir = resolve(opt("--dir") ?? join(ROOT, "scratch", "at", short));
  const commit = atCommit(ref, dir, opt("--patch"));
  const script = opt("--run");
  if (script !== undefined) {
    const sep = argv.indexOf("--");
    process.stderr.write(`at-commit: ${script} at ${ref} (${commit.slice(0, 9)}), in ${dir}\n`);
    return runInTree(dir, script, sep >= 0 ? argv.slice(sep + 1) : []);
  }
  const main = mainCheckoutOf(ROOT) ?? ROOT;
  const rel = relative(process.cwd(), dir) || ".";
  process.stdout.write(
    [
      `at-commit: ${ref} (${commit.slice(0, 9)}) in ${dir}${opt("--patch") ? `, with ${opt("--patch")} applied` : ""}`,
      `  its CLI:   node ${join(rel, "packages/cli/src/main.ts")} <command> …`,
      `  its tests: run npx vitest from ${dir}`,
      `  an older ref without the data fallback: EFSIM_DATA_DIR=${join(main, "data")}`,
      `  remove:    node scripts/at-commit.ts --remove ${rel}`,
    ].join("\n") + "\n",
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
