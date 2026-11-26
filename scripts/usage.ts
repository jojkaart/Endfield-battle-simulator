// A script's --help from its header comment (damage-factors report point 2: `npm run measure -- --help` queued 5 min
// for the test lock, then failed with "Unknown option '--help'"; the help was the file's header all along). The locked
// scripts (measure, snapshots, premerge, team-ab, verify-at) print it for --help / -h and check their options before
// they queue, so a typo or a help request costs a second.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Whether the arguments ask for help. */
export const wantsHelp = (argv: readonly string[]) => argv.includes("--help") || argv.includes("-h");

/**
 * The usage part of a script's leading comment block: from its first line holding "Usage:" to the block's end (the whole
 * block when none does), without the comment markers. `file`: a path or an import.meta.url.
 */
export function headerUsage(file: string): string {
  const path = file.startsWith("file:") ? fileURLToPath(file) : file;
  const header: string[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.startsWith("//")) {
      if (header.length) break;
      continue;
    }
    header.push(line.replace(/^\/\/ ?/, ""));
  }
  const at = header.findIndex((l) => l.includes("Usage:"));
  return (at >= 0 ? header.slice(at) : header).join("\n").trimEnd();
}

/** For a script's entry: with --help / -h, print the usage and say so (the caller exits 0). */
export function printHelp(argv: readonly string[], file: string): boolean {
  if (!wantsHelp(argv)) return false;
  process.stdout.write(headerUsage(file) + "\n");
  return true;
}
