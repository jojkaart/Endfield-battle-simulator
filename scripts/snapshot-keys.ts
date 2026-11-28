// Renames keys of a snapshot file (tests/snapshots/*.json) without running the tests that produce it, in the exact
// layout the tests write (tests/snapshot.ts formatSnapshot), so a later `npm run snapshots:update` leaves it as it is.
// For file moves (fixtures between folders, renamed examples). Prints counts only, never an entry's values: a
// hold-out log's verdicts stay unseen (CLAUDE.md "Hold-out logs").
//
// Usage: node scripts/snapshot-keys.ts <file> --rename <from-regex> <to> [--dry-run]
//   e.g. node scripts/snapshot-keys.ts log-verdicts-pending.json --rename '^pending/(zmdlogs-123)' 'holdout/$1'
// <file>: a name under tests/snapshots/ or a path. <to> may use $1… (String.replace). A rename onto an existing key
// is refused.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { snapshotLayout, snapshotPath, writeSnapshotFile } from "../tests/snapshot.ts";
import { printHelp } from "./usage.ts";

export interface RenameResult {
  readonly entries: Record<string, unknown>;
  readonly renamed: number;
  readonly total: number;
}

/** The entries with every key matching `from` replaced by `to`; throws when two keys would collide. */
export function renameKeys(entries: Readonly<Record<string, unknown>>, from: RegExp, to: string): RenameResult {
  const out: Record<string, unknown> = {};
  let renamed = 0;
  for (const [k, v] of Object.entries(entries)) {
    const nk = from.test(k) ? k.replace(from, to) : k;
    if (nk !== k) renamed++;
    if (nk in out) throw new Error(`snapshot-keys: two entries would have the key ${nk}; nothing written`);
    out[nk] = v;
  }
  return { entries: out, renamed, total: Object.keys(entries).length };
}

function main(argv: string[]): number {
  const [name, flag, from, to] = argv;
  if (!name || flag !== "--rename" || from === undefined || to === undefined) {
    process.stderr.write("usage: node scripts/snapshot-keys.ts <file> --rename <from-regex> <to> [--dry-run]\n");
    return 2;
  }
  const file = snapshotPath(name);
  const text = readFileSync(file, "utf8");
  const compact = snapshotLayout(text);
  if (compact === undefined) throw new Error(`snapshot-keys: ${file} isn't in the layout the tests write (a hand edit or a conflict?): run npm run snapshots:update first`);
  const r = renameKeys(JSON.parse(text) as Record<string, unknown>, new RegExp(from), to);
  if (!argv.includes("--dry-run") && r.renamed) writeSnapshotFile(file, r.entries, compact);
  process.stdout.write(`snapshot-keys: ${r.renamed} of ${r.total} keys renamed${argv.includes("--dry-run") ? " (dry run: nothing written)" : ""} in ${file}\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);
  process.exitCode = main(process.argv.slice(2));
}
