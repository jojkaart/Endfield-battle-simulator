// The accuracy scoreboard (docs/accuracy.md): the log checks' aggregate accuracy, computed from the log verdict
// snapshots (tests/snapshots/log-verdicts.json for the verified logs, log-verdicts-pending.json for the pending ones)
// and the hold-out split (fixtures/holdout/holdout.json). Generated, never edited: `npm run snapshots:update` rewrites
// it with the snapshots, and tests/accuracy.test.ts checks it matches them, so every change to a verdict shows its
// accuracy change in the scoreboard's diff.
//
// Hold-out logs are counted blind: only their group's aggregates appear (in the scoreboard and in --compare's
// direction counts), never a hold-out log's own numbers (docs/accuracy-plan.md, "Choosing logs").
//
// Usage: node scripts/accuracy.ts [--write | --check | --compare <git ref>]
//   (none)      print the scoreboard
//   --write     write docs/accuracy.md
//   --check     exit 1 if docs/accuracy.md isn't what the snapshots give
//   --compare   the scoreboard's groups and each log's direction (better / worse by the fit measure) against the
//               snapshots at a git ref (e.g. HEAD, main)
//
// No game data and no engine: the snapshots hold everything, so this takes a fraction of a second.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SCOREBOARD = "docs/accuracy.md";
const VERIFIED = "tests/snapshots/log-verdicts.json";
const PENDING = "tests/snapshots/log-verdicts-pending.json";
const SPLIT = "fixtures/holdout/holdout.json";
/** Where the split was before the hold-out logs got their own directory (2026-11-16): read at older refs. */
const OLD_SPLIT = "fixtures/pending/holdout.json";
const TOTALS = "totals";

/** A log's snapshot entry: per operator its verdict counts, and under "totals" its totals' errors in %. */
export type Entry = Readonly<Record<string, Readonly<Record<string, number | null>>>>;
export type Entries = Readonly<Record<string, Entry>>;

export type Group = "verified" | "development" | "holdout" | "earlier";
export const GROUPS: readonly Group[] = ["verified", "development", "holdout", "earlier"];
const GROUP_LABEL: Record<Group, string> = {
  verified: "Verified (fixtures/)",
  development: "Development (fixtures/pending, holdout.json `development`)",
  holdout: "Hold-out (fixtures/holdout, holdout.json `holdout`; aggregates only)",
  earlier: "Earlier pending (imported before the hold-out split)",
};

export interface Split {
  readonly development: ReadonlySet<string>;
  readonly holdout: ReadonlySet<string>;
}

/** The hold-out split, by log id (zmdlogs-…). */
export function readSplit(text = readFileSync(join(ROOT, SPLIT), "utf8")): Split {
  const s = JSON.parse(text) as { development: string[]; holdout: string[] };
  return { development: new Set(s.development), holdout: new Set(s.holdout) };
}

const idOf = (key: string) => (key.split("/").pop() as string).replace(/\.json$/, "");

/**
 * The group of a log's snapshot key (a path under fixtures/: "zmdlogs-….json", "pending/zmdlogs-….json" or
 * "holdout/zmdlogs-….json"; before 2026-11-16 the hold-outs were under pending/ too).
 */
export function groupOf(key: string, split: Split): Group {
  if (key.startsWith("holdout/")) return "holdout";
  if (!key.startsWith("pending/")) return "verified";
  const id = idOf(key);
  return split.holdout.has(id) ? "holdout" : split.development.has(id) ? "development" : "earlier";
}

const operators = (e: Entry) => Object.entries(e).filter(([k]) => k !== TOTALS) as [string, Readonly<Record<string, number>>][];
const sum = (c: Readonly<Record<string, number>>, ...keys: string[]) => keys.reduce((s, k) => s + (c[k] ?? 0), 0);
const allHits = (c: Readonly<Record<string, number>>) => Object.values(c).reduce((s, v) => s + v, 0);
const MATCHES = ["plain", "assumed", "fallback"];

/** What the fit measure reads of a log: plain matches, mismatches, hits, and the total damage's error (%). */
export interface Fit {
  readonly plain: number;
  readonly mismatch: number;
  readonly hits: number;
  readonly damage: number | null;
}

export function fitOf(e: Entry): Fit {
  let plain = 0;
  let mismatch = 0;
  let hits = 0;
  for (const [, c] of operators(e)) {
    plain += sum(c, "plain");
    mismatch += sum(c, "mismatch");
    hits += allHits(c);
  }
  const d = e[TOTALS]?.["damage"];
  return { plain, mismatch, hits, damage: d === undefined || d === null ? null : d };
}

export type Direction = "better" | "worse" | "mixed" | "other" | "same";

/**
 * A log's direction against its snapshot entry, by the fit measure: more plain matches, fewer mismatches and a smaller
 * |total damage error| are each better. Better: at least one better and none worse; worse: the reverse; mixed: both;
 * other: the entry changed, but none of the three (e.g. assumed matches became fallbacks); same: no change at all.
 */
export function direction(was: Entry, now: Entry): Direction {
  if (JSON.stringify(was) === JSON.stringify(now)) return "same";
  const a = fitOf(was);
  const b = fitOf(now);
  const moves = [Math.sign(b.plain - a.plain), Math.sign(a.mismatch - b.mismatch)];
  if (a.damage !== null && b.damage !== null) moves.push(Math.sign(Math.abs(a.damage) - Math.abs(b.damage)));
  else if (a.damage !== b.damage) moves.push(b.damage === null ? -1 : 1);
  const up = moves.some((m) => m > 0);
  const down = moves.some((m) => m < 0);
  return up && down ? "mixed" : up ? "better" : down ? "worse" : "other";
}

/** A direction's short reason for a log that isn't a hold-out: what moved in the fit measure. */
export function fitChange(was: Entry, now: Entry): string {
  const a = fitOf(was);
  const b = fitOf(now);
  const parts: string[] = [];
  if (a.plain !== b.plain) parts.push(`plain ${a.plain} → ${b.plain}`);
  if (a.mismatch !== b.mismatch) parts.push(`mismatch ${a.mismatch} → ${b.mismatch}`);
  if (a.damage !== b.damage) parts.push(`damage ${a.damage ?? "-"} → ${b.damage ?? "-"}%`);
  return parts.join(", ");
}

export interface Aggregate {
  readonly logs: number;
  readonly hits: number;
  readonly plain: number;
  readonly matched: number;
  readonly mismatch: number;
  /** Mean |total damage error| over the logs with one, in %. */
  readonly meanDamageError: number | null;
  /** Logs whose |total damage error| is at most 5%. */
  readonly within5: number;
}

function aggregate(entries: readonly Entry[]): Aggregate {
  let hits = 0;
  let plain = 0;
  let matched = 0;
  let mismatch = 0;
  const errors: number[] = [];
  for (const e of entries) {
    for (const [, c] of operators(e)) {
      hits += allHits(c);
      plain += sum(c, "plain");
      matched += sum(c, ...MATCHES);
      mismatch += sum(c, "mismatch");
    }
    const d = e[TOTALS]?.["damage"];
    if (d !== undefined && d !== null) errors.push(Math.abs(d));
  }
  return {
    logs: entries.length,
    hits,
    plain,
    matched,
    mismatch,
    meanDamageError: errors.length ? errors.reduce((s, x) => s + x, 0) / errors.length : null,
    within5: errors.filter((x) => x <= 5).length,
  };
}

interface OperatorAggregate {
  readonly logs: number;
  readonly hits: number;
  readonly plain: number;
  readonly mismatch: number;
  readonly meanDamageError: number | null;
}

/** Per operator, over the given logs: its hits' verdicts and the mean |error| of its total damage. */
function perOperator(entries: readonly Entry[]): Map<string, OperatorAggregate> {
  const acc = new Map<string, { logs: number; hits: number; plain: number; mismatch: number; errors: number[] }>();
  for (const e of entries) {
    for (const [op, c] of operators(e)) {
      const a = acc.get(op) ?? { logs: 0, hits: 0, plain: 0, mismatch: 0, errors: [] };
      a.logs++;
      a.hits += allHits(c);
      a.plain += sum(c, "plain");
      a.mismatch += sum(c, "mismatch");
      const d = e[TOTALS]?.[`operator ${op}`];
      if (d !== undefined && d !== null) a.errors.push(Math.abs(d));
      acc.set(op, a);
    }
  }
  return new Map(
    [...acc.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([op, a]) => [op, { logs: a.logs, hits: a.hits, plain: a.plain, mismatch: a.mismatch, meanDamageError: a.errors.length ? a.errors.reduce((s, x) => s + x, 0) / a.errors.length : null }]),
  );
}

export interface Snapshots {
  readonly verified: Entries;
  readonly pending: Entries;
  readonly split: Split;
}

export function readSnapshots(read: (path: string) => string | undefined = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : undefined)): Snapshots {
  const json = (p: string) => JSON.parse(read(p) ?? "{}") as Entries;
  const split = read(SPLIT) ?? read(OLD_SPLIT);
  return { verified: json(VERIFIED), pending: json(PENDING), split: split ? readSplit(split) : { development: new Set(), holdout: new Set() } };
}

/**
 * Every log's entry by its key (a path under fixtures/), with its group. A hold-out's key is given as under pending/,
 * where it was before 2026-11-16, so a comparison with an older ref matches the same log.
 */
export function allLogs(s: Snapshots): Map<string, { group: Group; entry: Entry }> {
  const out = new Map<string, { group: Group; entry: Entry }>();
  for (const [k, e] of Object.entries(s.verified)) out.set(k, { group: "verified", entry: e });
  for (const [k, e] of Object.entries(s.pending)) out.set(k.replace(/^holdout\//, "pending/"), { group: groupOf(k, s.split), entry: e });
  return out;
}

export function groupAggregates(s: Snapshots): Map<Group, Aggregate> {
  const logs = [...allLogs(s).values()];
  return new Map(GROUPS.map((g) => [g, aggregate(logs.filter((l) => l.group === g).map((l) => l.entry))]));
}

const pct = (n: number, of: number) => (of ? `${((100 * n) / of).toFixed(1)}%` : "-");
const err = (x: number | null) => (x === null ? "-" : `${x.toFixed(1)}%`);

/** The scoreboard's text (docs/accuracy.md). */
export function render(s: Snapshots): string {
  const groups = groupAggregates(s);
  const visible = [...allLogs(s).values()].filter((l) => l.group !== "holdout").map((l) => l.entry);
  const all = aggregate(visible);
  const row = (label: string, a: Aggregate) =>
    `| ${label} | ${a.logs} | ${a.hits} | ${pct(a.plain, a.hits)} | ${pct(a.matched, a.hits)} | ${pct(a.mismatch, a.hits)} | ${err(a.meanDamageError)} | ${a.within5} |`;
  const lines = [
    "# Accuracy scoreboard",
    "",
    "<!-- Generated by scripts/accuracy.ts from tests/snapshots/log-verdicts*.json and fixtures/holdout/holdout.json. Don't edit: run `npm run snapshots:update` (or `npm run accuracy` after a snapshot change). -->",
    "",
    "The log checks' aggregate accuracy at this commit, from the log verdict",
    "snapshots. Generated (`npm run snapshots:update` rewrites it with the",
    "snapshots; tests/accuracy.test.ts checks it matches them), so a merge that",
    "moves a verdict shows its accuracy change in this file's diff.",
    "`node scripts/accuracy.ts --compare main` prints the change against another",
    "commit, and how many logs got better or worse.",
    "",
    "- **Plain, matched, mismatch:** shares of the logged hits whose verdict is a",
    "  plain match; any match (plain, assumed or log-listing fallback); a",
    "  mismatch (`efsim zmdlogs check`).",
    "- **Mean |damage error|:** per fight, the logged casts simulated against the",
    "  log's total damage (`engineReport`), the absolute error averaged over",
    "  the fights. **Within 5%:** fights whose total is within ±5%.",
    "- **Hold-out logs** are only measured, never debugged: their row is the",
    "  honest accuracy, and only their aggregates appear here",
    "  (docs/accuracy-plan.md, \"Choosing logs\").",
    "",
    "## By group",
    "",
    "| Logs | Fights | Hits | Plain | Matched | Mismatch | Mean \\|damage error\\| | Within 5% |",
    "|---|---|---|---|---|---|---|---|",
    ...GROUPS.map((g) => row(GROUP_LABEL[g], groups.get(g) as Aggregate)),
    row("All but the hold-outs", all),
    "",
    "## By operator (every log but the hold-outs)",
    "",
    "| Operator | Fights | Hits | Plain | Mismatch | Mean \\|damage error\\| |",
    "|---|---|---|---|---|---|",
    ...[...perOperator(visible)].map(([op, a]) => `| ${op} | ${a.logs} | ${a.hits} | ${pct(a.plain, a.hits)} | ${pct(a.mismatch, a.hits)} | ${err(a.meanDamageError)} |`),
    "",
  ];
  return lines.join("\n");
}

/** The comparison against older snapshots: each group's aggregates before → after, and the logs' directions. */
export function compare(before: Snapshots, after: Snapshots): string[] {
  const out: string[] = [];
  const ga = groupAggregates(before);
  const gb = groupAggregates(after);
  for (const g of GROUPS) {
    const a = ga.get(g) as Aggregate;
    const b = gb.get(g) as Aggregate;
    const same = JSON.stringify(a) === JSON.stringify(b);
    out.push(
      `${GROUP_LABEL[g]}: ${same ? "unchanged" : `fights ${a.logs} → ${b.logs}, plain ${pct(a.plain, a.hits)} → ${pct(b.plain, b.hits)}, mismatch ${pct(a.mismatch, a.hits)} → ${pct(b.mismatch, b.hits)}, mean |damage error| ${err(a.meanDamageError)} → ${err(b.meanDamageError)}`}`,
    );
  }
  out.push(...directionSummary(before, after));
  return out;
}

/**
 * How many logs of each group got better or worse by the fit measure (`direction`), and, for the logs that aren't
 * hold-outs, which. Logs new or gone are counted apart.
 */
export function directionSummary(before: Snapshots, after: Snapshots): string[] {
  const a = allLogs(before);
  const b = allLogs(after);
  const out: string[] = [];
  for (const g of GROUPS) {
    const counts: Record<Direction | "new" | "gone", number> = { better: 0, worse: 0, mixed: 0, other: 0, same: 0, new: 0, gone: 0 };
    const named: string[] = [];
    for (const [k, l] of b) {
      if (l.group !== g) continue;
      const was = a.get(k);
      if (!was) {
        counts.new++;
        continue;
      }
      const d = direction(was.entry, l.entry);
      counts[d]++;
      if (g !== "holdout" && d !== "same") named.push(`  ${d}: ${k} (${fitChange(was.entry, l.entry) || "other counts"})`);
    }
    for (const [k, l] of a) if (!b.has(k) && l.group === g) counts.gone++;
    const moved = counts.better + counts.worse + counts.mixed + counts.other + counts.new + counts.gone;
    if (!moved) continue;
    out.push(`${GROUP_LABEL[g]}: ${counts.better} better, ${counts.worse} worse, ${counts.mixed} mixed, ${counts.other} other, ${counts.same} unchanged${counts.new ? `, ${counts.new} new` : ""}${counts.gone ? `, ${counts.gone} gone` : ""}`);
    out.push(...named);
  }
  if (!out.length) out.push("No log's verdicts moved.");
  return out;
}

/** The snapshots as committed at a git ref. */
export function snapshotsAt(ref: string): Snapshots {
  return readSnapshots((p) => {
    try {
      return execFileSync("git", ["show", `${ref}:${p}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 });
    } catch {
      return undefined;
    }
  });
}

function main(argv: readonly string[]): number {
  const now = readSnapshots();
  const text = render(now);
  const file = join(ROOT, SCOREBOARD);
  if (argv[0] === "--write") {
    writeFileSync(file, text);
    console.log(`accuracy: wrote ${SCOREBOARD}`);
    return 0;
  }
  if (argv[0] === "--check") {
    const ok = existsSync(file) && readFileSync(file, "utf8") === text;
    if (!ok) console.error(`accuracy: ${SCOREBOARD} isn't what the snapshots give; run \`npm run accuracy\``);
    return ok ? 0 : 1;
  }
  if (argv[0] === "--compare") {
    const ref = argv[1] ?? "HEAD";
    console.log(`Accuracy against ${ref} (the log verdict snapshots):`);
    for (const l of compare(snapshotsAt(ref), now)) console.log(l);
    return 0;
  }
  process.stdout.write(text);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
