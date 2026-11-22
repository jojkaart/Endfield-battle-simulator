// The teams' numbers before and after a change, in one job: what every kit-change brief asks for (the team pages'
// `efsim rules --seeds 32 --first-seed 1001`, full energy and from zero, base and new code) and what agents ran as four
// to eight locked jobs and transcribed by hand (round-4 friction: two hours of locked runs for numbers that could not
// move, since the change didn't reach either team's fight).
//
// First an identity check (seconds): each team's example scenario simulated with every hit (`simulate --verbose`) and
// one 300 s seed of its rules list, at the base commit's code (scripts/at-commit.ts) and at the working tree's; when
// every output is the same (the provenance line aside), the teams' fights didn't change and the 32-seed runs are
// skipped ("unchanged": report the team pages' numbers). Otherwise (or with --force), the rules runs at both codes,
// and a table: sustained DPS (sd), as a bot, at 0.6 s, the scenario's 60 s timeline, the shares.
//
// Usage: node scripts/team-ab.ts --base <ref> [--team <name>]… [--seeds n] [--first-seed n] [--force]
//   --team   an examples/<name>.scenario.json with <name>-zero.scenario.json and <name>.rules.json beside it
//            (default: the team pages' estella-si-akekuri-arcane and typhoeus-arcane-liino-perlica)
//   --phase identity|seeds   (internal: the two locked halves below)
//
// Under the test lock (scripts/testlock.ts) in two halves (round 5, after an identity check of seconds waited 50 min
// behind rule searches): the identity check as a short job (the side lane, beside long jobs), then the 32-seed runs
// as a long job, only for the teams whose fight moved ("unchanged" rows for the others; --force: every team). The
// code is fixed when it is queued (scripts/at-commit.ts snapshotCommit: a commit of the working tree, run in its own
// worktree, removed after), so you can keep editing while it waits. Last line `EFSIM-DONE team-ab pass|fail|killed`.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { atCommit, removeAtCommit, snapshotCommit } from "./at-commit.ts";
import { runLockedAsync, testLockFile } from "./testlock.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const TEAMS = ["estella-si-akekuri-arcane", "typhoeus-arcane-liino-perlica"] as const;

/** A CLI output with what differs between two checkouts of the same behaviour taken out (the provenance's "code at …"). */
export function normalized(text: string): string {
  return text.replace(/code at [0-9a-f]+( with uncommitted changes)?/g, "code at …");
}

/** The numbers a rules run's output gives (null where a line is missing). */
export interface RulesNumbers {
  readonly sustained: number | null;
  readonly sd: number | null;
  readonly bot: number | null;
  readonly slow: number | null;
  readonly timeline60: number | null;
  readonly shares: string | null;
}

const n = (s: string | undefined) => (s === undefined ? null : Number(s.replace(/,/g, "")));

export function parseRules(text: string): RulesNumbers {
  const sus = /Sustained DPS after the opener[^:]*: ([\d,]+) \(sd ([\d,]+)/.exec(text);
  const rob = /delay 0 \(a bot\) ([\d,]+);.*0\.6 s ([\d,]+)/.exec(text);
  const ref = /scenario's own rotation on the timeline \(60 s\): [\d,]+ \(([\d,]+) DPS/.exec(text);
  const shares = /^Shares \(seed \d+\): (.*)$/m.exec(text);
  return { sustained: n(sus?.[1]), sd: n(sus?.[2]), bot: n(rob?.[1]), slow: n(rob?.[2]), timeline60: n(ref?.[1]), shares: shares?.[1] ?? null };
}

function cli(tree: string, args: readonly string[]): string {
  const r = spawnSync(process.execPath, [join(tree, "packages/cli/src/main.ts"), ...args], { cwd: tree, encoding: "utf8", maxBuffer: 256 << 20, env: { ...process.env, EFSIM_TEST_LOCK_HELD: "1" } });
  if (r.status !== 0) throw new Error(`efsim ${args.join(" ")} (in ${tree}): ${r.stderr.trim().split("\n").at(-1)}`);
  return r.stdout;
}

const fmt = (x: number | null) => (x === null ? "-" : Math.round(x).toLocaleString("en-US"));
const pct = (a: number | null, b: number | null) => (a && b !== null ? `${b >= a ? "+" : ""}${((b / a - 1) * 100).toFixed(2)}%` : "-");

interface Run {
  readonly team: string;
  readonly energy: "full" | "zero";
  readonly scenario: string;
  readonly rules: string;
}

type Values = ReturnType<typeof parse>;
const parse = (argv: string[]) =>
  parseArgs({
    args: argv,
    options: {
      base: { type: "string" },
      team: { type: "string", multiple: true, default: [] },
      seeds: { type: "string", default: "32" },
      "first-seed": { type: "string", default: "1001" },
      force: { type: "boolean", default: false },
      phase: { type: "string" },
      now: { type: "string" },
      moved: { type: "string" },
    },
  }).values;

const shortRef = (ref: string) => execFileSync("git", ["rev-parse", "--short=9", "--verify", `${ref}^{commit}`], { cwd: ROOT, encoding: "utf8" }).trim();

function runsOf(teams: readonly string[]): Run[] {
  const runs = teams.flatMap((t): Run[] => [
    { team: t, energy: "full", scenario: `examples/${t}.scenario.json`, rules: `examples/${t}.rules.json` },
    { team: t, energy: "zero", scenario: `examples/${t}-zero.scenario.json`, rules: `examples/${t}.rules.json` },
  ]);
  for (const r of runs) for (const f of [r.scenario, r.rules]) if (!existsSync(join(ROOT, f))) throw new Error(`${f}: no such file (--team <name>: examples/<name>.scenario.json, -zero.scenario.json and .rules.json)`);
  return runs;
}

/** The checkouts: the base commit's, and the code to compare (a snapshot commit's worktree with --now, else this tree). */
function trees(values: Values): { base: string; now: string; cleanup: () => void } {
  if (!values.base) throw new Error("team-ab takes --base <ref> (the code before the change)");
  const base = resolve(ROOT, "scratch/at", shortRef(values.base));
  atCommit(values.base, base);
  if (!values.now) return { base, now: ROOT, cleanup: () => {} };
  const now = resolve(ROOT, "scratch/at", `team-ab-${shortRef(values.now)}`);
  const own = !existsSync(now);
  atCommit(values.now, now);
  return { base, now, cleanup: () => own && removeAtCommit(now) };
}

/** The identity check: every hit of each scenario's timeline and one seed of its rules over 300 s; the runs that differ. */
export function identity(base: string, now: string, runs: readonly Run[], firstSeed: string): string[] {
  const moved: string[] = [];
  for (const r of runs) {
    const probes: [string, string[]][] = [
      ["simulate", ["simulate", r.scenario, "--verbose"]],
      ["one rules seed", ["rules", r.scenario, r.rules, "--seeds", "1", "--first-seed", firstSeed, "--workers", "1"]],
    ];
    for (const [what, args] of probes) {
      const [a, b] = [normalized(cli(base, args)), normalized(cli(now, args))];
      process.stderr.write(`team-ab: ${r.team} (${r.energy}) ${what}: ${a === b ? "the same" : "differs"}\n`);
      if (a !== b) moved.push(`${r.team} (${r.energy}) ${what}`);
    }
  }
  return moved;
}

/** The teams a moved list names (identity's entries start with the team). */
export const movedTeams = (moved: readonly string[], teams: readonly string[]) => teams.filter((t) => moved.some((m) => m.startsWith(`${t} (`)));

/** The table: the rules runs at both codes for the teams in `run`, an "unchanged" row for the others. */
function seedsTable(base: string, now: string, runs: readonly Run[], run: ReadonlySet<string>, values: Values): string {
  const rows: string[] = ["| Team | Energy | | Base (" + values.base + ") | Now | Change |", "|---|---|---|---|---|---|"];
  for (const r of runs) {
    if (!run.has(r.team)) {
      rows.push(`| ${r.team} | ${r.energy} | unchanged (its own fight is the same: the team page's numbers) | | | |`);
      continue;
    }
    const args = ["rules", r.scenario, r.rules, "--seeds", values.seeds, "--first-seed", values["first-seed"]];
    process.stderr.write(`team-ab: ${r.team} (${r.energy}): rules at ${values.base}…\n`);
    const a = parseRules(cli(base, args));
    process.stderr.write(`team-ab: ${r.team} (${r.energy}): rules now…\n`);
    const b = parseRules(cli(now, args));
    rows.push(`| ${r.team} | ${r.energy} | sustained DPS (sd) | ${fmt(a.sustained)} (${fmt(a.sd)}) | ${fmt(b.sustained)} (${fmt(b.sd)}) | ${pct(a.sustained, b.sustained)} |`);
    rows.push(`| | | as a bot / at 0.6 s | ${fmt(a.bot)} / ${fmt(a.slow)} | ${fmt(b.bot)} / ${fmt(b.slow)} | ${pct(a.bot, b.bot)} / ${pct(a.slow, b.slow)} |`);
    rows.push(`| | | the scenario's 60 s timeline | ${fmt(a.timeline60)} | ${fmt(b.timeline60)} | ${pct(a.timeline60, b.timeline60)} |`);
    rows.push(`| | | shares (seed ${values["first-seed"]}) | ${a.shares ?? "-"} | ${b.shares ?? "-"} | |`);
  }
  return rows.join("\n") + "\n";
}

const unchangedLine = (values: Values) =>
  `team-ab: unchanged: every team's own fight (each hit of its example timeline, and a 300 s seed of its rules list, full energy and from zero) is the same at ${values.base}'s code and here. The ${values.seeds}-seed runs would give the team pages' numbers: report those as unchanged (--force runs them anyway).\n`;

/** One phase, or both (no lock): the identity check, then the seeds for the moved teams. */
async function main(argv: string[]): Promise<number> {
  const values = parse(argv);
  const teams = values.team.length ? values.team : [...TEAMS];
  const runs = runsOf(teams);
  const t = trees(values);
  try {
    if (values.phase === "identity") {
      if (!values.moved) throw new Error("--phase identity takes --moved <file>");
      writeFileSync(values.moved, JSON.stringify(identity(t.base, t.now, runs, values["first-seed"])));
      return 0;
    }
    const moved = values.phase === "seeds" ? (JSON.parse(readFileSync(values.moved as string, "utf8")) as string[]) : identity(t.base, t.now, runs, values["first-seed"]);
    if (!moved.length && !values.force) {
      process.stdout.write(unchangedLine(values));
      return 0;
    }
    const run = new Set(values.force ? teams : movedTeams(moved, teams));
    process.stdout.write(moved.length ? `team-ab: changed: ${moved.join(", ")}; the ${values.seeds}-seed rules runs at both codes${values.force ? "" : " for those teams"}:\n` : `team-ab: unchanged, run anyway (--force):\n`);
    process.stdout.write(seedsTable(t.base, t.now, runs, run, values));
    return 0;
  } finally {
    t.cleanup();
  }
}

/** Under the lock: the code fixed now, the identity check as a short job, then (if needed) the seeds as a long one. */
async function locked(argv: string[]): Promise<number> {
  const values = parse(argv);
  const snap = snapshotCommit(ROOT);
  process.stderr.write(`team-ab: the code is fixed at queue time (${snap.dirty ? `a snapshot of the working tree, ${snap.commit.slice(0, 9)}` : `HEAD ${snap.head.slice(0, 9)}`}): keep editing while it waits\n`);
  const dir = mkdtempSync(join(tmpdir(), "efsim-team-ab-"));
  const moved = join(dir, "moved.json");
  const self = [process.execPath, fileURLToPath(import.meta.url), ...argv, "--now", snap.commit.slice(0, 12), "--moved", moved];
  try {
    const first = await runLockedAsync([...self, "--phase", "identity"], { kind: "short", who: "team-ab identity", done: "team-ab" });
    if (first !== 0) return first;
    const list = JSON.parse(readFileSync(moved, "utf8")) as string[];
    if (!list.length && !values.force) {
      process.stdout.write(unchangedLine(values));
      return 0;
    }
    return await runLockedAsync([...self, "--phase", "seeds"], { kind: "job", who: "team-ab seeds", done: "team-ab" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const fail = (e: unknown) => {
    process.stderr.write(`team-ab: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  };
  const inner = argv.includes("--phase");
  // The halves run inside the lock print no DONE line: the outer run prints one at the end.
  void (testLockFile() && !inner ? locked(argv) : main(argv)).then(
    (code) => code,
    fail,
  ).then((code) => {
    if (!inner) process.stdout.write(`EFSIM-DONE team-ab ${code === 0 ? "pass" : "fail"}\n`);
    process.exitCode = code;
  });
}
