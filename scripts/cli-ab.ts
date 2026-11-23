// The same efsim command at another commit's code and at this tree's, and what differs between the two outputs
// (friction round 7: "which bound moved this log" took two at-commit runs and a hand diff per question, four measure
// rounds in one task; round 5's parked point 8, "no harness for same CLI output"). The other commit runs in its own
// worktree under scratch/at/ (scripts/at-commit.ts: its own packages linked), this tree from here.
//
// Usage:
//   node scripts/cli-ab.ts <ref> [--key <regex>] [--all] -- <efsim args…>
//   node scripts/cli-ab.ts <ref> --holds <fixture>    zmdlogs holds <fixture> --verbose, keyed by unit, bound and
//                                                     dropped bound: the bounds added and removed, each unit's and
//                                                     each bound's placement before and after
//
// Lines only at <ref> print as "- ", only here as "+ ". With --key, a line's key is its first match of the regex (its
// first capture group when it has one): lines of the same key on both sides that differ print once as "~ " with the
// text at <ref> and here ("was … / now …"). Identical outputs print one line saying so. --all prints the lines the two
// share too ("  "). It exits 0 either way (1 when a side fails), so a script can read the difference.

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { atCommit } from "./at-commit.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** zmdlogs holds --verbose's lines by what they are: the header, a unit by its middle, a kept bound by its tag, a dropped one. */
export const HOLDS_KEY = String.raw`^(zmdlogs-[0-9a-f]+: |  unit [0-9.]+ s|  bound: .+?(?=: P\()|  dropped: .+?(?= \(asks))`;

/** The difference of two outputs as printed (see the file comment): `-`, `+`, `~` lines in this side's order, then the rest of the other's. */
export function outputDiff(was: string, now: string, opts: { readonly key?: RegExp; readonly all?: boolean } = {}): string[] {
  const [a, b] = [was.split("\n"), now.split("\n")];
  const keyOf = (l: string) => {
    if (!opts.key) return null;
    const m = opts.key.exec(l);
    return m ? (m[1] ?? m[0]) : null;
  };
  // Lines as multisets: a repeated line is shared as often as both sides have it.
  const left = new Map<string, number>();
  for (const l of a) left.set(l, (left.get(l) ?? 0) + 1);
  const shared = b.map((l) => {
    const n = left.get(l) ?? 0;
    if (n > 0) left.set(l, n - 1);
    return n > 0;
  });
  // The lines only `was` has, in its order (by index), queued by key for pairing.
  const onlyA: number[] = [];
  for (const [i, l] of a.entries()) {
    const n = left.get(l) ?? 0;
    if (n > 0) {
      left.set(l, n - 1);
      onlyA.push(i);
    }
  }
  const byKey = new Map<string, number[]>();
  for (const i of onlyA) {
    const k = keyOf(a[i] as string);
    if (k !== null) byKey.set(k, [...(byKey.get(k) ?? []), i]);
  }
  const paired = new Set<number>();
  const out: string[] = [];
  for (const [i, l] of b.entries()) {
    if (shared[i]) {
      if (opts.all) out.push(`  ${l}`);
      continue;
    }
    const k = keyOf(l);
    const j = k !== null ? byKey.get(k)?.shift() : undefined;
    if (j === undefined) out.push(`+ ${l}`);
    else {
      paired.add(j);
      out.push(`~ ${(k as string).trim()}`, `    was: ${(a[j] as string).trim()}`, `    now: ${l.trim()}`);
    }
  }
  for (const i of onlyA) if (!paired.has(i)) out.push(`- ${a[i] as string}`);
  return out;
}

function main(argv: string[]): number {
  const dash = argv.indexOf("--");
  const own = dash >= 0 ? argv.slice(0, dash) : argv;
  let efsim = dash >= 0 ? argv.slice(dash + 1) : [];
  const ref = own[0];
  const opt = (name: string) => {
    const i = own.indexOf(name);
    return i >= 0 ? own[i + 1] : undefined;
  };
  let key = opt("--key");
  const holds = opt("--holds");
  if (holds !== undefined) {
    efsim = ["zmdlogs", "holds", holds, "--verbose"];
    key ??= HOLDS_KEY;
  }
  if (!ref || ref.startsWith("--") || efsim.length === 0) {
    process.stderr.write("usage: node scripts/cli-ab.ts <ref> [--key <regex>] [--all] -- <efsim args…> | <ref> --holds <fixture>\n");
    return 2;
  }
  const short = spawnSync("git", ["rev-parse", "--short=9", "--verify", `${ref}^{commit}`], { cwd: ROOT, encoding: "utf8" });
  if (short.status !== 0) throw new Error(`cli-ab: no commit ${ref}`);
  const tree = join(ROOT, "scratch", "at", short.stdout.trim());
  atCommit(ref, tree);
  const run = (root: string) => {
    const r = spawnSync(process.execPath, [join(root, "packages/cli/src/main.ts"), ...efsim], { cwd: root, encoding: "utf8", maxBuffer: 256 << 20 });
    if (r.status !== 0) throw new Error(`cli-ab: efsim ${efsim.join(" ")} failed at ${root === ROOT ? "this tree" : ref}: ${(r.stderr || r.stdout).trim().split("\n").slice(-5).join("\n")}`);
    return r.stdout.replace(/\n$/, "");
  };
  const [was, now] = [run(tree), run(ROOT)];
  const say = (l: string) => process.stdout.write(l + "\n");
  say(`cli-ab: efsim ${efsim.join(" ")}: ${ref} (${short.stdout.trim()}, -) against this tree (+)${key ? `, lines paired by /${key}/ (~)` : ""}`);
  if (was === now) {
    say("the outputs are identical");
    return 0;
  }
  for (const l of outputDiff(was, now, { ...(key ? { key: new RegExp(key) } : {}), all: own.includes("--all") })) say(l);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  }
}
