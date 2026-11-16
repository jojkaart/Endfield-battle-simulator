// Runs an earlier commit's code beside the current one, for before/after measurements and for attributing a change
// to one fix: a detached git worktree of <ref> (under scratch/at/, git-ignored), its own @efsim packages linked
// (scripts/setup-worktree.ts's setupWorktree, so it runs its own code, not this checkout's), dependencies and the
// game data from the main checkout. Optionally a patch on top ("the old code with only this fix").
//
// Usage:
//   node scripts/at-commit.ts <ref> [--dir <dir>] [--patch <file>]   make (or reuse) it; prints the directory and how
//                                                                    to run its CLI
//   node scripts/at-commit.ts --remove <dir>                         remove it again (git worktree remove)
//
// The default directory is scratch/at/<the commit's short hash>. Then, e.g.:
//   npm run bench -- "node scratch/at/<hash>/packages/cli/src/main.ts simulate x.json" \
//                               "node packages/cli/src/main.ts simulate x.json"
// Its tests: run vitest from inside that directory (its own configs). A ref older than the main-checkout data fallback
// (2026-11-16) may need EFSIM_DATA_DIR=<main checkout>/data, printed here.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
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
  if (patch) git(["apply", "--whitespace=nowarn", resolve(patch)], dir);
  setupWorktree(dir);
  return commit;
}

function main(argv: string[]): number {
  if (argv[0] === "--remove") {
    const dir = argv[1];
    if (!dir) throw new Error("--remove takes the directory");
    git(["worktree", "remove", "--force", resolve(dir)]);
    process.stdout.write(`at-commit: removed ${dir}\n`);
    return 0;
  }
  const ref = argv[0];
  if (!ref || ref.startsWith("--")) {
    process.stderr.write("usage: node scripts/at-commit.ts <ref> [--dir <dir>] [--patch <file>] | --remove <dir>\n");
    return 2;
  }
  const opt = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const short = git(["rev-parse", "--short=9", "--verify", `${ref}^{commit}`]);
  const dir = resolve(opt("--dir") ?? join(ROOT, "scratch", "at", short));
  const commit = atCommit(ref, dir, opt("--patch"));
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
