// Which code made a report: the commit and whether the tree had uncommitted changes, for the head of long runs'
// output (gear --rules, diagnose: results that took minutes are only comparable when they say what made them; phase 2
// is to print it there).

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** "code at 1a2b3c4" or "code at 1a2b3c4 with uncommitted changes" ("code at an unknown commit" outside git). */
export function codeProvenance(root: string = ROOT): string {
  try {
    const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    // Tracked files only: scratch/ and other ignored or untracked files don't make the code dirty.
    const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() !== "";
    return `code at ${commit}${dirty ? " with uncommitted changes" : ""}`;
  } catch {
    return "code at an unknown commit";
  }
}
