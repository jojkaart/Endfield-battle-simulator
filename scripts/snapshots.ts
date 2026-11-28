// Regenerates every generated baseline from the current code: the snapshots (tests/snapshots/*.json: examples, kits,
// verified and pending log verdicts) and the accuracy scoreboard made from them (docs/accuracy.md). `npm run
// snapshots:update` runs it (round 10 ported it from scripts/snapshots.sh). To measure a change without rewriting
// anything, use scripts/measure.ts (npm run measure).
//
// Deterministic: each snapshot is emptied first, so what's written depends only on the code, the kits and the
// fixtures, not on the file's content before. A merge conflict in one of these files is therefore resolved by taking
// either side (or leaving the conflict markers: the file is emptied anyway) and running this; never by hand. A failed
// or killed run puts the files back as they were.
//
// At the end: the files' diff stat, and the scoreboard's change and each log's direction (better / worse by the fit
// measure) against a git ref (HEAD by default; mid-merge, HEAD is the branch merged into); then the other test files
// that read a changed log's fixture (a feature test pinning one log's total: misprediction-stats report point 6, a
// second premerge for a one-line bound), whose failure makes the run "fail" with the snapshots kept; then one line
// `EFSIM-DONE snapshots pass` (or `fail`, `killed`) to wait for. Its run state is in scratch/runs/snapshots.json (node
// scripts/runstate.ts).
//
// The whole run holds the test lock once (scripts/testlock.ts, kind "tests": a queue with a heartbeat line while
// waiting), so parallel worktrees' suites queue instead of timing out; EFSIM_NO_TEST_LOCK=1 skips it.
//
// It reads the working tree, so the tree must stay as queued (round 21, backlog after round 20 point 2): the code's key
// (codeKey: HEAD, the tracked changes and the untracked files, its own outputs left out) is taken at queue time and
// checked when the lock comes, every 20 s while the suites run (a step is stopped at the first change: round 23) and
// at the end; a tree edited meanwhile fails the run, its files put back, with the paths that changed. Edit docs only
// while it waits, or commit and run it from a worktree of its own.
//
// Usage: node scripts/snapshots.ts [--costs] [ref]     (several minutes: the pending logs' checks run in full)
//   --costs   also rewrite tests/slow/pending-costs.json (the pending logs' check times that balance the test:logs
//             shards): machine- and load-dependent, so only when rebalancing, on a quiet machine

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addedKeysOnly, changedLogs, readSnapshots, snapshotsAt } from "./accuracy.ts";
import { doneJob, type Runner } from "./done-line.ts";
import { runLockedAsync, testLockFile } from "./testlock.ts";
import { printHelp } from "./usage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOTS = join(ROOT, "tests", "snapshots");
const SCOREBOARD = join(ROOT, "docs", "accuracy.md");
/** The suites this run regenerates the snapshots with: the knock-on tests leave them out. */
const SUITES = ["tests/examples.test.ts", "tests/logs.test.ts", "tests/kits.test.ts"];

/** vitest's reporters: the default one, and a line per finished file when the output isn't a terminal (a background run). */
const reporters = () => ["--reporter=default", ...(process.stdout.isTTY ? [] : ["--reporter=./scripts/vitest-progress.ts"])];

/** The default suite's test files (tests/*.test.ts and below, tests/slow/ and the regenerating suites left out). */
function defaultTestFiles(dir = join(ROOT, "tests")): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!["slow", "snapshots", "helpers"].includes(e.name)) out.push(...defaultTestFiles(p));
    } else if (e.name.endsWith(".test.ts") && !SUITES.includes(relative(ROOT, p))) out.push(relative(ROOT, p));
  }
  return out.sort();
}

/** The test files that name a changed log's fixture (its 12-hex id): the tests a moved total can break outside the snapshots. */
export function testsNaming(logs: readonly string[], files: readonly { readonly path: string; readonly text: string }[]): string[] {
  const ids = [...new Set(logs.map((k) => /([0-9a-f]{12})\.json$/.exec(k)?.[1]).filter((x): x is string => !!x))];
  if (!ids.length) return [];
  return files.filter((f) => ids.some((id) => f.text.includes(id))).map((f) => f.path);
}

/** The paths this run writes itself, left out of codeKey. */
const OWN_OUTPUTS = ["tests/snapshots", "docs/accuracy.md", "tests/slow/pending-costs.json"];

/**
 * The key of the code a run reads (round 21): HEAD's commit, the tracked changes against it and the untracked files'
 * contents, the run's own outputs (OWN_OUTPUTS) and docs (*.md) left out; with the paths it covers, to name what moved.
 */
export function codeKey(root = ROOT): { readonly key: string; readonly paths: ReadonlyMap<string, string> } {
  const git = (...args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 << 20 }).stdout ?? "";
  const skip = (p: string) => OWN_OUTPUTS.some((o) => p === o || p.startsWith(`${o}/`)) || p.endsWith(".md");
  const paths = new Map<string, string>();
  const hash = (s: string) => createHash("sha1").update(s).digest("hex");
  for (const p of git("diff", "HEAD", "--name-only").split("\n").filter((x) => x && !skip(x))) paths.set(p, hash(git("diff", "HEAD", "--binary", "--", p)));
  for (const p of git("ls-files", "--others", "--exclude-standard").split("\n").filter((x) => x && !skip(x))) paths.set(p, existsSync(join(root, p)) ? hash(readFileSync(join(root, p), "latin1")) : "gone");
  const head = git("rev-parse", "HEAD").trim();
  return { key: hash([head, ...[...paths].sort().map(([p, h]) => `${p} ${h}`)].join("\n")), paths: new Map([["HEAD", head], ...paths]) };
}

/** The paths whose code differs between two codeKey results (HEAD among them), sorted. */
export function codeMoved(a: ReturnType<typeof codeKey>, b: ReturnType<typeof codeKey>): string[] {
  return [...new Set([...a.paths.keys(), ...b.paths.keys()])].filter((p) => a.paths.get(p) !== b.paths.get(p)).sort();
}

/** How often the run checks the code against the tree as queued while its suites run (ms). */
const WATCH_MS = 20_000;

/** The queued code's key, passed to the run under the lock (EFSIM_SNAPSHOTS_CODE). */
const QUEUED_ENV = "EFSIM_SNAPSHOTS_CODE";

async function regenerate(costs: boolean, ref: string, run: Runner, onKill: (f: () => void) => void): Promise<number> {
  // The code as queued (codeKey): checked now and after the suites (a tree edited during the wait or the run).
  const queued = process.env[QUEUED_ENV] ? (JSON.parse(process.env[QUEUED_ENV]) as { key: string; paths: [string, string][] }) : null;
  const queuedKey = queued ? { key: queued.key, paths: new Map(queued.paths) } : codeKey();
  const unmoved = (when: string): boolean => {
    const now = codeKey();
    if (now.key === queuedKey.key) return true;
    process.stderr.write(`snapshots: the code changed ${when} (${codeMoved(queuedKey, now).join(", ")}): the run would mix two trees. Commit or set the edits aside, then run it again (docs may change meanwhile)\n`);
    return false;
  };
  if (!unmoved("since the run was queued")) return 1;
  // Kept to put back if a run fails (a failed test may record nothing: the files would be left empty).
  const backup = mkdtempSync(join(tmpdir(), "efsim-snapshots-"));
  const snapshotFiles = readdirSync(SNAPSHOTS).filter((f) => f.endsWith(".json"));
  for (const f of snapshotFiles) copyFileSync(join(SNAPSHOTS, f), join(backup, f));
  if (existsSync(SCOREBOARD)) copyFileSync(SCOREBOARD, join(backup, "accuracy.md"));
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    process.stderr.write("snapshots: a run failed; the files are as they were\n");
    for (const f of snapshotFiles) copyFileSync(join(backup, f), join(SNAPSHOTS, f));
    if (existsSync(join(backup, "accuracy.md"))) copyFileSync(join(backup, "accuracy.md"), SCOREBOARD);
    rmSync(backup, { recursive: true, force: true });
  };
  onKill(restore);

  for (const f of snapshotFiles) {
    rmSync(join(SNAPSHOTS, `${f}.lock`), { force: true });
    writeFileSync(join(SNAPSHOTS, f), "{}\n");
  }
  const report = join(backup, "pending-report.json");
  const update = { ...process.env, EFSIM_UPDATE_SNAPSHOTS: "1" };
  const steps: { command: string[]; env?: NodeJS.ProcessEnv }[] = [
    { command: ["npx", "vitest", "run", ...reporters(), ...SUITES], env: update },
    // With --costs: the pending logs' check times, for balancing the shards (scripts/pending-costs.ts).
    { command: ["npx", "vitest", "run", "--config", "vitest.logs.config.ts", ...reporters(), ...(costs ? ["--reporter=json", `--outputFile.json=${report}`] : []), "tests/slow/logs-pending"], env: update },
    { command: ["node", "scripts/accuracy.ts", "--write"] },
    ...(costs ? [{ command: ["node", "scripts/pending-costs.ts", report] }] : []),
  ];
  // The code watched while the suites run (round 23, round 22's own report point 1: an edit during the run failed it
  // only at its end, ten minutes on): every WATCH_MS, and a step stopped at the first change.
  const abort = new AbortController();
  let movedWhile: string[] | null = null;
  const watch = setInterval(() => {
    const now = codeKey();
    if (now.key === queuedKey.key || movedWhile) return;
    movedWhile = codeMoved(queuedKey, now);
    process.stderr.write(`snapshots: the code changed while the suites ran (${movedWhile.join(", ")}): stopping now, the files put back. Commit or set the edits aside, then run it again (docs may change meanwhile)\n`);
    abort.abort();
  }, WATCH_MS);
  try {
    for (const s of steps) {
      if (movedWhile || (await run(s.command, { ...(s.env ? { env: s.env } : {}), signal: abort.signal })) !== 0) {
        restore();
        return 1;
      }
    }
  } finally {
    clearInterval(watch);
  }
  if (!unmoved("while the suites ran")) {
    restore();
    return 1;
  }
  restored = true; // kept from here on
  rmSync(backup, { recursive: true, force: true });

  process.stdout.write(`\nsnapshots: regenerated. Changes against ${ref}:\n`);
  await run(["git", "--no-pager", "diff", "--stat", ref, "--", "tests/snapshots", "docs/accuracy.md", "tests/slow/pending-costs.json"]);
  await run(["node", "scripts/accuracy.ts", "--compare", ref]);

  const [before, after] = [snapshotsAt(ref), readSnapshots()];
  // Entries that only gained totals keys (a describing key: round 16's `share operator <id>`), no value moved.
  const added = addedKeysOnly(before, after);
  if (added.logs) process.stdout.write(`snapshots: keys added only in ${added.logs} log(s), no existing value moved there: ${[...added.kinds].map(([k, n]) => `${k} ×${n}`).join(", ")}\n`);
  const changed = changedLogs(before, after);
  const knockOns = testsNaming(
    changed,
    defaultTestFiles().map((path) => ({ path, text: readFileSync(join(ROOT, path), "utf8") })),
  );
  if (!knockOns.length) {
    process.stdout.write(`snapshots: no other test file reads ${changed.length ? `the ${changed.length} changed log(s)' fixtures` : "a changed log's fixture (none changed)"}\n`);
    return 0;
  }
  process.stdout.write(`\nsnapshots: the other tests that read a changed log's fixture (${knockOns.map((f) => basename(f)).join(", ")}):\n`);
  if ((await run(["npx", "vitest", "run", ...reporters(), ...knockOns])) !== 0) {
    process.stderr.write("snapshots: the snapshots are written (kept), but a test reading a changed log's fixture failed (above): fix it, or its bound, before premerge\n");
    return 1;
  }
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const costs = argv[0] === "--costs";
  const rest = costs ? argv.slice(1) : argv;
  if (rest.length > 1 || rest.some((a) => a.startsWith("-"))) {
    process.stderr.write("usage: node scripts/snapshots.ts [--costs] [ref]\n");
    return 2;
  }
  const ref = rest[0] ?? "HEAD";
  if (spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: ROOT }).status !== 0) {
    process.stderr.write(`snapshots: no commit ${ref}\n`);
    return 2;
  }
  // The whole run under the lock, once: this script again, with EFSIM_TEST_LOCK_HELD=1 (testLockFile is then undefined).
  if (testLockFile()) {
    const k = codeKey();
    process.env[QUEUED_ENV] = JSON.stringify({ key: k.key, paths: [...k.paths] });
    process.stderr.write(`snapshots: the code is checked against the tree as queued (${k.paths.size - 1} changed or untracked file(s) on HEAD ${(k.paths.get("HEAD") ?? "").slice(0, 9)}): don't edit code while it waits or runs (docs may change)\n`);
    return runLockedAsync([process.execPath, fileURLToPath(import.meta.url), ...argv], { kind: "tests", who: "snapshots", done: "snapshots", label: "snapshots" });
  }
  return doneJob("snapshots", `against ${ref}`, (run, onKill) => regenerate(costs, ref, run, onKill));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2), import.meta.url)) process.exit(0);
  void main(process.argv.slice(2)).then((c) => (process.exitCode = c));
}
