// The accuracy scoreboard (docs/accuracy.md): the log checks' aggregate accuracy, computed from the log verdict
// snapshots (tests/snapshots/log-verdicts.json for the verified logs, log-verdicts-pending.json for the pending ones,
// log-verdicts-holdout.json for the hold-outs: a file of its own, so a diff of the pending one names none) and the
// hold-out split (fixtures/holdout/holdout.json). Generated, never edited: `npm run snapshots:update` rewrites
// it with the snapshots, and tests/accuracy.test.ts checks it matches them, so every change to a verdict shows its
// accuracy change in the scoreboard's diff.
//
// Hold-out logs are counted blind: only their group's aggregates appear (in the scoreboard and in --compare's
// direction counts), never a hold-out log's own numbers (docs/accuracy-plan.md, "Choosing logs"). What any hold-out
// output may say: docs/design/tests.md "What a hold-out output may say".
//
// Usage: node scripts/accuracy.ts [--write | --check | --compare <git ref> [--regroup]]
//   (none)      print the scoreboard
//   --write     write docs/accuracy.md
//   --check     exit 1 if docs/accuracy.md isn't what the snapshots give
//   --compare   the scoreboard's groups and each log's direction (better / worse by the fit measure) against the
//               snapshots at a git ref (e.g. HEAD, main), then the where-the-error-lives table's groups that moved
//   --regroup   with --compare: first the reference's entries in today's groups (this tree's split and marks: a log
//               marked severalTargets since, a log moved between groups), so the lines read "reclassification: a → b"
//               and "change: b → c" (round 18, the status-pairing report point 1: two scratch scripts for two
//               numbers the journal needed)
//
// No engine: the snapshots hold every number, so this takes a fraction of a second; the game data (its cache) gives
// the by-operator table's display names only (operatorNames; --compare reads none).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SCOREBOARD = "docs/accuracy.md";
const VERIFIED = "tests/snapshots/log-verdicts.json";
const PENDING = "tests/snapshots/log-verdicts-pending.json";
/** The hold-out logs' entries (keys holdout/…), apart from the pending ones since round 4; before, in PENDING. Never diffed by eye. */
const HOLDOUT = "tests/snapshots/log-verdicts-holdout.json";
const SPLIT = "fixtures/holdout/holdout.json";
/** Where the split was before the hold-out logs got their own directory (2026-11-16): read at older refs. */
const OLD_SPLIT = "fixtures/pending/holdout.json";
const TOTALS = "totals";
/** The totals keys of where the error lives (packages/logs snapshotentry.ts SHARE_KEYS): shown, never a verdict. */
const SHARES = { matched: "share matched", replayOnly: "share replay-only", logOnly: "share log-only" } as const;
const isShareKey = (k: string) => k.startsWith("share ");
/** The totals key of an operator's hits matched only as their event's other kit hit (packages/logs snapshotentry.ts otherHitKey). */
const OTHER_HIT = "other-hit operator ";
/** The totals key of a stage fight (snapshotentry.ts STAGE_KEY). */
const STAGE = "stage";
/** The totals key of a fight against several enemies under one id (snapshotentry.ts SEVERAL_TARGETS_KEY: the fixture's severalTargets). */
const SEVERAL = "several targets";
/**
 * A totals key that describes, never a verdict: the shares (where the error lives, an operator's share), an operator's
 * hits matched as another kit hit, a stage fight, several targets. `direction` leaves them out; a round may add one (docs/friction/README.md step 3).
 */
export const isDescribingKey = (k: string) => isShareKey(k) || k.startsWith(OTHER_HIT) || k === STAGE || k === SEVERAL;
/** An entry without the describing keys: what `direction` compares. */
const verdictPart = (e: Entry): Entry => (e[TOTALS] ? { ...e, [TOTALS]: Object.fromEntries(Object.entries(e[TOTALS]).filter(([k]) => !isDescribingKey(k))) } : e);

/** A log's snapshot entry: per operator its verdict counts, and under "totals" its totals' errors in %. */
export type Entry = Readonly<Record<string, Readonly<Record<string, number | null>>>>;
export type Entries = Readonly<Record<string, Entry>>;

export type Group = "verified" | "development" | "holdout" | "earlier" | "targets";
export const GROUPS: readonly Group[] = ["verified", "development", "holdout", "earlier", "targets"];
const GROUP_LABEL: Record<Group, string> = {
  verified: "Verified (fixtures/)",
  development: "Development (fixtures/pending, holdout.json `development`)",
  holdout: "Hold-out (fixtures/holdout, holdout.json `holdout`; aggregates only)",
  earlier: "Earlier pending (imported before the hold-out split)",
  targets: "Several targets under one enemy id (fixtures/pending, the fixture's `severalTargets`)",
};

export interface Split {
  readonly development: ReadonlySet<string>;
  readonly holdout: ReadonlySet<string>;
  /**
   * The pending logs against several enemies under one id (their entries' SEVERAL key, from the fixture's
   * severalTargets; withSeveralTargets): their own group, out of the development and earlier-pending means (a
   * reclassification, not an accuracy change: 9c6e, 2026-11-27).
   */
  readonly severalTargets?: ReadonlySet<string>;
}

/** The split with its severalTargets: the pending entries (keys pending/… or holdout/…) whose totals carry the SEVERAL key. */
export function withSeveralTargets(split: Split, pending: Entries): Split {
  return { ...split, severalTargets: new Set(Object.entries(pending).filter(([k, e]) => !k.startsWith("holdout/") && e[TOTALS]?.[SEVERAL]).map(([k]) => idOf(k))) };
}

/** The hold-out split, by log id (zmdlogs-…). */
export function readSplit(text = readFileSync(join(ROOT, SPLIT), "utf8")): Split {
  const s = JSON.parse(text) as { development: string[]; holdout: string[] };
  return { development: new Set(s.development), holdout: new Set(s.holdout) };
}

const idOf = (key: string) => (key.split("/").pop() as string).replace(/\.json$/, "");

/**
 * A log's key as allLogs gives it, the one form comparisons pair by: a hold-out's under pending/ (its key before
 * 2026-11-16, so an older ref's snapshots pair with today's). The snapshot files and measure's logKeys key it holdout/….
 */
export const pairKey = (key: string) => key.replace(/^holdout\//, "pending/");

/**
 * Whether a log's key, in either form (holdout/… from the snapshot files and logKeys, pending/… from allLogs and
 * pairKey), is a hold-out's: the one test the printing functions' blindness rests on (round 19, round 18's own report
 * point 1: measure's prefix test on allLogs' keys named a hold-out "moved by no part alone"). `split`: the snapshots'
 * own (Snapshots.split), so a test's synthetic hold-outs count.
 */
export function isHoldoutKey(key: string, split: Pick<Split, "holdout">): boolean {
  return key.startsWith("holdout/") || split.holdout.has(idOf(key));
}

/**
 * The group of a log's snapshot key (a path under fixtures/: "zmdlogs-….json", "pending/zmdlogs-….json" or
 * "holdout/zmdlogs-….json"; before 2026-11-16 the hold-outs were under pending/ too). With its entry, a describing key
 * there decides a group too (the SEVERAL key: `targets`), so a caller holding the entry needs no marked split (round
 * 18, the status-pairing report point 4: the group was decided in three places, each its own way); without one, the
 * split's marks (withSeveralTargets).
 */
export function groupOf(key: string, split: Split, entry?: Entry): Group {
  if (key.startsWith("holdout/")) return "holdout";
  if (!key.startsWith("pending/")) return "verified";
  const id = idOf(key);
  if (split.holdout.has(id)) return "holdout";
  if (entry?.[TOTALS]?.[SEVERAL] || split.severalTargets?.has(id)) return "targets";
  return split.development.has(id) ? "development" : "earlier";
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
 * other: the entry changed, but none of the three (e.g. assumed matches became fallbacks); same: no change at all
 * (the totals' share keys aside: where the error lives isn't a verdict, and their arrival in round 9 moved nothing).
 */
export function direction(was: Entry, now: Entry): Direction {
  if (JSON.stringify(verdictPart(was)) === JSON.stringify(verdictPart(now))) return "same";
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

/**
 * Which kinds of field of an entry moved (round 8's friction point 1: a hold-out's "other" said that something moved,
 * not what): the verdict classes summed over the operators (net change per class), the totals keys that moved (by
 * kind: `damage`, `kind <k>`, `operator <id>`, the rest by name) and operators come or gone. Categories and counts only.
 */
export interface FieldChange {
  /** Net change per verdict class over every operator, non-zero only. */
  readonly classes: ReadonlyMap<string, number>;
  /** The operators whose own counts moved (with a net of zero too: hits moved between classes). */
  readonly operatorsMoved: readonly string[];
  /** Totals keys whose value moved, grouped by kind ("damage", "kind", "operator", or the key itself). */
  readonly totals: ReadonlyMap<string, readonly string[]>;
  readonly operatorsNew: readonly string[];
  readonly operatorsGone: readonly string[];
}

// An operator's id never names the kind: a hold-out's moved keys are printed by kind (formatFieldChange, blind).
const totalsKind = (k: string) => (k.startsWith("operator ") ? "operator" : k.startsWith("kind ") ? "kind" : isShareKey(k) ? "share" : k.startsWith(OTHER_HIT) ? "other-hit" : k);

export function fieldChange(was: Entry, now: Entry): FieldChange {
  const classes = new Map<string, number>();
  const ops = new Set([...operators(was), ...operators(now)].map(([op]) => op));
  const moved: string[] = [];
  for (const op of ops) {
    const [a, b] = [was[op] ?? {}, now[op] ?? {}];
    let any = false;
    for (const c of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = (b[c] ?? 0) - (a[c] ?? 0);
      if (d) {
        classes.set(c, (classes.get(c) ?? 0) + d);
        any = true;
      }
    }
    if (any && was[op] && now[op]) moved.push(op);
  }
  for (const [c, d] of classes) if (!d) classes.delete(c);
  const totals = new Map<string, string[]>();
  const [ta, tb] = [was[TOTALS] ?? {}, now[TOTALS] ?? {}];
  for (const k of new Set([...Object.keys(ta), ...Object.keys(tb)])) if (ta[k] !== tb[k]) totals.set(totalsKind(k), [...(totals.get(totalsKind(k)) ?? []), k]);
  return {
    classes,
    operatorsMoved: moved,
    totals,
    operatorsNew: [...ops].filter((op) => op !== TOTALS && !was[op] && now[op]),
    operatorsGone: [...ops].filter((op) => op !== TOTALS && was[op] && !now[op]),
  };
}

/**
 * A FieldChange in words: "verdict classes assumed −2, fallback +2; totals: damage, kind 2, operator 1". With `blind`
 * (hold-outs) the totals' operator keys and the operators are counts, never ids.
 */
export function formatFieldChange(c: FieldChange, blind = false): string {
  const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);
  const parts: string[] = [];
  if (c.classes.size) parts.push(`verdict classes ${[...c.classes].map(([k, n]) => `${k} ${signed(n)}`).join(", ")}`);
  else if (c.operatorsMoved.length) parts.push(`verdict counts moved within ${blind ? `${c.operatorsMoved.length} operator(s)` : c.operatorsMoved.join(", ")} (net zero per class)`);
  // Blind, a key naming an operator is counted by its kind (a share's or an other-hit key alone named its id before round 17).
  const keysText = (kind: string, keys: readonly string[]) =>
    kind === "operator" && blind ? `operator keys ${keys.length}` : blind && keys.some((k) => /\bchr_/.test(k)) ? `${kind} ×${keys.length}` : keys.length > 1 && kind !== "operator" && kind !== "kind" ? `${kind} ×${keys.length}` : keys.join(", ");
  if (c.totals.size) parts.push(`totals ${[...c.totals].map(([kind, keys]) => keysText(kind, keys)).join(", ")}`);
  if (c.operatorsNew.length) parts.push(`operators new ${blind ? c.operatorsNew.length : c.operatorsNew.join(", ")}`);
  if (c.operatorsGone.length) parts.push(`operators gone ${blind ? c.operatorsGone.length : c.operatorsGone.join(", ")}`);
  return parts.join("; ");
}

/** FieldChanges summed over several entries (the moved hold-outs): classes added, totals keys counted by kind. */
export function sumFieldChanges(cs: readonly FieldChange[]): FieldChange {
  const classes = new Map<string, number>();
  const totals = new Map<string, string[]>();
  for (const c of cs) {
    for (const [k, n] of c.classes) classes.set(k, (classes.get(k) ?? 0) + n);
    for (const [kind, keys] of c.totals) totals.set(kind, [...(totals.get(kind) ?? []), ...keys]);
  }
  for (const [k, n] of classes) if (!n) classes.delete(k);
  return { classes, totals, operatorsMoved: cs.flatMap((c) => c.operatorsMoved), operatorsNew: cs.flatMap((c) => c.operatorsNew), operatorsGone: cs.flatMap((c) => c.operatorsGone) };
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
  /** Hits matched only as their event's other kit hit (the `other-hit operator <id>` keys): a placement on the wrong step hides there. */
  readonly otherHit: number;
}

/** A log's hits matched only as their event's other kit hit, per operator (the `other-hit operator <id>` keys). */
const otherHits = (e: Entry, op: string) => e[TOTALS]?.[`${OTHER_HIT}${op}`] ?? 0;
/** Whether a log is a stage fight (the `stage` key). */
const isStage = (e: Entry) => e[TOTALS]?.[STAGE] === 1;

function aggregate(entries: readonly Entry[]): Aggregate {
  let hits = 0;
  let plain = 0;
  let matched = 0;
  let mismatch = 0;
  let otherHit = 0;
  const errors: number[] = [];
  for (const e of entries) {
    for (const [op, c] of operators(e)) {
      hits += allHits(c);
      plain += sum(c, "plain");
      matched += sum(c, ...MATCHES);
      mismatch += sum(c, "mismatch");
      otherHit += otherHits(e, op);
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
    otherHit,
  };
}

export interface OperatorAggregate {
  readonly logs: number;
  readonly hits: number;
  readonly plain: number;
  readonly mismatch: number;
  readonly meanDamageError: number | null;
  /** The median |error| of its total damage over the fights with one. */
  readonly medianDamageError: number | null;
  /**
   * The |errors| weighted by its share of each fight's logged total (the `share operator <id>` key, round 16): what
   * its error weighs in the fights' totals, so a few small totals 20–60% off (Liino's 0eef on a 9 s fight) don't read
   * as a fight metric (null: no fight with both).
   */
  readonly weightedDamageError: number | null;
  /** Its mean share of a fight's logged total, in % (null: no share key). */
  readonly meanShare: number | null;
  /** Its hits matched only as their event's other kit hit (the `other-hit operator <id>` key). */
  readonly otherHit: number;
  /** The mean |error| over its fights that aren't stage fights (the `stage` key; null: none with an error). */
  readonly meanWithoutStage: number | null;
  /**
   * The fight whose |error| carries the most of the mean (its label, given to perOperator) and how many points of the
   * mean it is (|error| ÷ fights); null without labels or errors (round 20, the Liino report point 1: 0eef, a 10 s
   * fight, was 3.0 of her 8.5 points).
   */
  readonly largest: { readonly log: string; readonly points: number } | null;
  /**
   * The means over its fights of its own matched landings' |error| and of its one-sided landings (% of its own logged
   * total: the `share own … operator <id>` keys; null where no fight has them): a kit's error is matched, a log
   * check rule's one-sided.
   */
  readonly ownMatched: number | null;
  readonly ownOneSided: number | null;
}

/** The median of some numbers (null: none). */
const median = (xs: readonly number[]) => {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? (v[m] as number) : ((v[m - 1] as number) + (v[m] as number)) / 2;
};

/** The keys of an operator's own split (packages/logs snapshotentry.ts operatorOwnKeys). */
const ownKeys = (op: string) => ({ matched: `share own matched operator ${op}`, oneSided: `share own one-sided operator ${op}` });

/**
 * Per operator, over the given logs: its hits' verdicts and the |error| of its total damage (mean, median, by its share
 * of the fight), its own split, and with `labels` (one per entry) the fight carrying most of its mean.
 */
export function perOperator(entries: readonly Entry[], labels?: readonly string[]): Map<string, OperatorAggregate> {
  const acc = new Map<string, { logs: number; hits: number; plain: number; mismatch: number; otherHit: number; errors: number[]; unstaged: number[]; weighted: number; weights: number; shares: number[]; largest: { log: string; err: number } | null; matched: number[]; oneSided: number[] }>();
  for (const [i, e] of entries.entries()) {
    for (const [op, c] of operators(e)) {
      const a = acc.get(op) ?? { logs: 0, hits: 0, plain: 0, mismatch: 0, otherHit: 0, errors: [], unstaged: [], weighted: 0, weights: 0, shares: [], largest: null, matched: [], oneSided: [] };
      a.logs++;
      a.hits += allHits(c);
      a.plain += sum(c, "plain");
      a.mismatch += sum(c, "mismatch");
      a.otherHit += otherHits(e, op);
      const d = e[TOTALS]?.[`operator ${op}`];
      const share = e[TOTALS]?.[`share operator ${op}`];
      const own = { matched: e[TOTALS]?.[ownKeys(op).matched], oneSided: e[TOTALS]?.[ownKeys(op).oneSided] };
      if (own.matched !== undefined && own.matched !== null) a.matched.push(Math.abs(own.matched));
      if (own.oneSided !== undefined && own.oneSided !== null) a.oneSided.push(own.oneSided);
      const label = labels?.[i];
      if (d !== undefined && d !== null && label !== undefined && (a.largest === null || Math.abs(d) > a.largest.err)) a.largest = { log: label, err: Math.abs(d) };
      if (d !== undefined && d !== null) a.errors.push(Math.abs(d));
      if (d !== undefined && d !== null && !isStage(e)) a.unstaged.push(Math.abs(d));
      if (share !== undefined && share !== null) {
        a.shares.push(share);
        if (d !== undefined && d !== null) {
          a.weighted += share * Math.abs(d);
          a.weights += share;
        }
      }
      acc.set(op, a);
    }
  }
  return new Map(
    [...acc.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([op, a]) => [
        op,
        {
          logs: a.logs,
          hits: a.hits,
          plain: a.plain,
          mismatch: a.mismatch,
          meanDamageError: a.errors.length ? a.errors.reduce((s, x) => s + x, 0) / a.errors.length : null,
          medianDamageError: median(a.errors),
          weightedDamageError: a.weights > 0 ? a.weighted / a.weights : null,
          meanShare: a.shares.length ? a.shares.reduce((s, x) => s + x, 0) / a.shares.length : null,
          otherHit: a.otherHit,
          meanWithoutStage: a.unstaged.length ? a.unstaged.reduce((s, x) => s + x, 0) / a.unstaged.length : null,
          largest: a.largest && a.errors.length ? { log: a.largest.log, points: a.largest.err / a.errors.length } : null,
          ownMatched: a.matched.length ? a.matched.reduce((s, x) => s + x, 0) / a.matched.length : null,
          ownOneSided: a.oneSided.length ? a.oneSided.reduce((s, x) => s + x, 0) / a.oneSided.length : null,
        },
      ]),
  );
}

export interface Snapshots {
  readonly verified: Entries;
  /** The pending logs' entries and the hold-outs' (keys holdout/…: their own file, splitPending). */
  readonly pending: Entries;
  readonly split: Split;
}

export function readSnapshots(read: (path: string) => string | undefined = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : undefined)): Snapshots {
  const json = (p: string) => JSON.parse(read(p) ?? "{}") as Entries;
  const split = read(SPLIT) ?? read(OLD_SPLIT);
  const pending = { ...json(PENDING), ...json(HOLDOUT) };
  return { verified: json(VERIFIED), pending, split: withSeveralTargets(split ? readSplit(split) : { development: new Set(), holdout: new Set() }, pending) };
}

/** Snapshots.pending as its two files hold it: the pending logs' entries and the hold-outs' (keys holdout/…). */
export function splitPending(pending: Entries): { readonly pending: Entries; readonly holdout: Entries } {
  const of = (h: boolean) => Object.fromEntries(Object.entries(pending).filter(([k]) => k.startsWith("holdout/") === h));
  return { pending: of(false), holdout: of(true) };
}

/**
 * Every log's entry by its key (a path under fixtures/), with its group. A hold-out's key is given as under pending/,
 * where it was before 2026-11-16, so a comparison with an older ref matches the same log.
 */
export function allLogs(s: Snapshots): Map<string, { group: Group; entry: Entry }> {
  const out = new Map<string, { group: Group; entry: Entry }>();
  for (const [k, e] of Object.entries(s.verified)) out.set(k, { group: "verified", entry: e });
  for (const [k, e] of Object.entries(s.pending)) out.set(pairKey(k), { group: groupOf(k, s.split, e), entry: e });
  return out;
}

export function groupAggregates(s: Snapshots): Map<Group, Aggregate> {
  const logs = [...allLogs(s).values()];
  return new Map(GROUPS.map((g) => [g, aggregate(logs.filter((l) => l.group === g).map((l) => l.entry))]));
}

/** A group's totals by where the error lives: the mean shares over its fights that have them, and how many are one-sided. */
export interface SharesAggregate {
  readonly fights: number;
  readonly matched: number;
  readonly replayOnly: number;
  readonly logOnly: number;
  /** Fights whose replay-only and log-only shares together outweigh |matched| (measure's "one-sided"). */
  readonly oneSided: number;
}

export function sharesAggregate(entries: readonly Entry[]): SharesAggregate | null {
  const xs = entries.flatMap((e) => {
    const t = e[TOTALS];
    const [m, r, l] = [t?.[SHARES.matched], t?.[SHARES.replayOnly], t?.[SHARES.logOnly]];
    return typeof m === "number" && typeof r === "number" && typeof l === "number" ? [{ m, r, l }] : [];
  });
  if (!xs.length) return null;
  const mean = (f: (x: (typeof xs)[number]) => number) => xs.reduce((s, x) => s + f(x), 0) / xs.length;
  return { fights: xs.length, matched: mean((x) => Math.abs(x.m)), replayOnly: mean((x) => x.r), logOnly: mean((x) => -x.l), oneSided: xs.filter((x) => x.r - x.l > Math.abs(x.m)).length };
}

const pct = (n: number, of: number) => (of ? `${((100 * n) / of).toFixed(1)}%` : "-");
const err = (x: number | null) => (x === null ? "-" : `${x.toFixed(1)}%`);

/** Operator ids → display names, for the by-operator table (operatorNames). */
export type OperatorNames = ReadonlyMap<string, string>;

/**
 * The operators' display names from the game data (round 17, the Arcane stage-factors report point 1: a brief copied
 * "chr_0032_lizhiyan" from the table as Akekuri; it is Arcane). The snapshots stay the scoreboard's only numbers: the
 * names are labels.
 */
export async function operatorNames(): Promise<OperatorNames> {
  const { loadGameData } = await import("@efsim/data");
  return new Map(Object.values(loadGameData().operators).map((o) => [o.id, o.name]));
}

/** A by-operator row's label: the id and, where known, its display name ("chr_0032_lizhiyan (Arcane)"). */
export const operatorLabel = (op: string, names: OperatorNames) => (names.has(op) ? `${op} (${names.get(op)})` : op);

/** The scoreboard's text (docs/accuracy.md); `names` labels the by-operator table (operatorNames). */
export function render(s: Snapshots, names: OperatorNames = new Map()): string {
  const groups = groupAggregates(s);
  const shown = [...allLogs(s)].filter(([, l]) => l.group !== "holdout");
  const visible = shown.map(([, l]) => l.entry);
  // A development log's short id (its first four hex digits), as the views name it.
  const shortOf = (key: string) => /zmdlogs-([0-9a-f]{4})/.exec(key)?.[1] ?? key;
  const visibleLabels = shown.map(([k]) => shortOf(k));
  const all = aggregate(visible);
  const row = (label: string, a: Aggregate) =>
    `| ${label} | ${a.logs} | ${a.hits} | ${pct(a.plain, a.hits)} | ${pct(a.matched, a.hits)} | ${pct(a.mismatch, a.hits)} | ${err(a.meanDamageError)} | ${a.within5} | ${a.otherHit} |`;
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
    "- **As other kit hit:** matched hits whose reading took another kit hit of",
    "  their event (the log's key shared by both): a cast placed on the wrong",
    "  step or path matches so and moves no other column (`zmdlogs groups`",
    "  lists the casts).",
    "- **Mean |damage error|:** per fight, the logged casts simulated against the",
    "  log's total damage (`engineReport`), the absolute error averaged over",
    "  the fights. **Within 5%:** fights whose total is within ±5%.",
    "- **Hold-out logs** are only measured, never debugged: their row is the",
    "  honest accuracy, and only their aggregates appear here",
    "  (docs/accuracy-plan.md, \"Choosing logs\").",
    "",
    "## By group",
    "",
    "| Logs | Fights | Hits | Plain | Matched | Mismatch | Mean \\|damage error\\| | Within 5% | As other kit hit |",
    "|---|---|---|---|---|---|---|---|---|",
    ...GROUPS.map((g) => row(GROUP_LABEL[g], groups.get(g) as Aggregate)),
    row("All but the hold-outs", all),
    "",
    ...sharesTable(s),
    "## By operator (every log but the hold-outs)",
    "",
    "Each operator's |damage error| is its own total's (simulated ÷ logged − 1 over its own hits), not the fight's: the",
    "mean over its fights, the median, and the mean weighted by its share of each fight's logged total (the",
    "`share operator <id>` key), which a few small totals far off (a 9 s fight's +58%) don't dominate; **Share**: its",
    "mean share of a fight's logged total; **Without stage fights**: the mean over its fights without a stage-wide",
    "effect (the `stage` key: the fixture's stageFactors, a stage status, a stage enemy: packages/logs enginecheck.ts",
    "stageFight); **As other kit hit**: its hits matched only as their event's other kit hit; **Largest**: the fight",
    "carrying the most of the mean and the points of it that fight is; **Own matched / one-sided**: the means of its",
    "matched landings' |error| and of its one-sided landings (replay-only and log-only), each as % of its own logged",
    "total (the `share own … operator <id>` keys): a kit's error is matched, a log check rule's one-sided.",
    "",
    "| Operator | Fights | Hits | Plain | Mismatch | As other kit hit | Mean \\|damage error\\| | Median | Weighted by share | Without stage fights | Share | Largest | Own matched | Own one-sided |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...[...perOperator(visible, visibleLabels)].map(([op, a]) => `| ${operatorLabel(op, names)} | ${a.logs} | ${a.hits} | ${pct(a.plain, a.hits)} | ${pct(a.mismatch, a.hits)} | ${a.otherHit} | ${err(a.meanDamageError)} | ${err(a.medianDamageError)} | ${err(a.weightedDamageError)} | ${err(a.meanWithoutStage)} | ${a.meanShare === null ? "-" : `${a.meanShare.toFixed(1)}%`} | ${a.largest ? `${a.largest.log} ${a.largest.points.toFixed(1)}` : "-"} | ${err(a.ownMatched)} | ${err(a.ownOneSided)} |`),
    "",
  ];
  return lines.join("\n");
}

/**
 * The scoreboard's "where the error lives" table: per group the mean |matched|, replay-only and log-only shares of the
 * fights' logged totals and the one-sided fights (empty for snapshots from before the share keys).
 */
function sharesTable(s: Snapshots): string[] {
  const logs = [...allLogs(s).values()];
  const rows = GROUPS.flatMap((g) => {
    const a = sharesAggregate(logs.filter((l) => l.group === g).map((l) => l.entry));
    return a ? [`| ${GROUP_LABEL[g]} | ${a.fights} | ${a.matched.toFixed(1)}% | ${a.replayOnly.toFixed(1)}% | ${a.logOnly.toFixed(1)}% | ${a.oneSided} |`] : [];
  });
  if (!rows.length) return [];
  return [
    "## Where the total's error lives",
    "",
    "Each fight's simulated total against its logged one, split (`efsim zmdlogs totals --all`): the landings standing for",
    "logged hits (|matched|: predicted − logged), the landings no logged hit stands for (replay-only) and the logged hits",
    "without one (log-only), as means of % of each fight's logged total. One-sided: replay-only and log-only together",
    "over |matched|, so the error is in what lands, not in its scale.",
    "",
    "| Logs | Fights | \\|Matched\\| | Replay-only | Log-only | One-sided |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ];
}

/**
 * The where-the-error-lives table's change (sharesTable): per group whose aggregate moved, its fights, |matched|,
 * replay-only, log-only and one-sided before → after (round 18, the status-pairing report point 1: the journal's
 * shares came from a scratch re-implementation of sharesAggregate). Nothing where none moved.
 */
export function sharesCompare(before: Snapshots, after: Snapshots): string[] {
  const [a, b] = [allLogs(before), allLogs(after)];
  const of = (m: ReturnType<typeof allLogs>, g: Group) => sharesAggregate([...m.values()].filter((l) => l.group === g).map((l) => l.entry));
  const out: string[] = [];
  for (const g of GROUPS) {
    const [x, y] = [of(a, g), of(b, g)];
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    const f = (k: "matched" | "replayOnly" | "logOnly") => `${x ? x[k].toFixed(2) : "-"} → ${y ? y[k].toFixed(2) : "-"}%`;
    out.push(`  ${GROUP_LABEL[g]}: fights ${x?.fights ?? 0} → ${y?.fights ?? 0}, |matched| ${f("matched")}, replay-only ${f("replayOnly")}, log-only ${f("logOnly")}, one-sided ${x?.oneSided ?? 0} → ${y?.oneSided ?? 0}`);
  }
  return out.length ? ["Where the total's error lives (mean shares of the fights' logged totals, two decimals):", ...out] : [];
}

/**
 * The reference's entries in another split's groups (--compare --regroup): the hold-out split and the several-target
 * marks of `today`, so a comparison against them is the reclassification alone, and one from them the change alone.
 */
export function regrouped(reference: Snapshots, today: Snapshots): Snapshots {
  return { ...reference, split: today.split };
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
      `${GROUP_LABEL[g]}: ${same ? "unchanged" : `fights ${a.logs} → ${b.logs}, plain ${pct(a.plain, a.hits)} → ${pct(b.plain, b.hits)}, mismatch ${pct(a.mismatch, a.hits)} → ${pct(b.mismatch, b.hits)}, mean |damage error| ${err(a.meanDamageError)} → ${err(b.meanDamageError)}${a.otherHit !== b.otherHit ? `, as other kit hit ${a.otherHit} → ${b.otherHit}` : ""}`}`,
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
    // Hold-outs: what kind of field moved, per direction, summed (counts only). Not which operators the moved ones
    // have: that tells what the hold-outs contain (the lead, 2026-11-23).
    const blind = new Map<Direction, FieldChange[]>();
    for (const [k, l] of b) {
      if (l.group !== g) continue;
      const was = a.get(k);
      if (!was) {
        counts.new++;
        continue;
      }
      const d = direction(was.entry, l.entry);
      counts[d]++;
      if (d === "same") continue;
      if (g !== "holdout") named.push(`  ${d}: ${k} (${(d === "other" ? formatFieldChange(fieldChange(was.entry, l.entry)) : fitChange(was.entry, l.entry)) || "other counts"})`);
      else blind.set(d, [...(blind.get(d) ?? []), fieldChange(was.entry, l.entry)]);
    }
    for (const [k, l] of a) if (!b.has(k) && l.group === g) counts.gone++;
    const moved = counts.better + counts.worse + counts.mixed + counts.other + counts.new + counts.gone;
    if (!moved) continue;
    out.push(`${GROUP_LABEL[g]}: ${counts.better} better, ${counts.worse} worse, ${counts.mixed} mixed, ${counts.other} other, ${counts.same} unchanged${counts.new ? `, ${counts.new} new` : ""}${counts.gone ? `, ${counts.gone} gone` : ""}`);
    out.push(...named);
    for (const [d, cs] of blind) out.push(`  ${d} (${cs.length}, summed, counts only): ${formatFieldChange(sumFieldChanges(cs), true) || "other counts"}`);
  }
  if (!out.length) out.push("No log's verdicts moved.");
  return out;
}

/**
 * The logs, hold-outs left out, whose entry changed at all (shares included), or that are new: their keys (paths under
 * fixtures/). snapshots.ts runs the tests that read their fixtures (a feature test pinning one log's total).
 */
export function changedLogs(before: Snapshots, after: Snapshots): string[] {
  const a = allLogs(before);
  return [...allLogs(after)].filter(([k, l]) => l.group !== "holdout" && JSON.stringify(a.get(k)?.entry) !== JSON.stringify(l.entry) && !addsKeysOnly(a.get(k)?.entry, l.entry)).map(([k]) => k);
}

/**
 * Whether an entry only adds totals keys to the one before (every value `was` holds is `now`'s, no operator or verdict
 * class new): a key that describes (round 16: `share operator <id>`), no number moved. False without `was`.
 */
export function addsKeysOnly(was: Entry | undefined, now: Entry): boolean {
  if (!was) return false;
  if (Object.keys(now).some((k) => !(k in was))) return false;
  for (const [k, fields] of Object.entries(was)) {
    const n = now[k];
    if (!n) return false;
    if (Object.entries(fields).some(([f, v]) => n[f] !== v)) return false;
    if (k !== TOTALS && Object.keys(n).some((f) => !(f in fields))) return false;
  }
  return true;
}

/**
 * The totals keys the entries gained with no value moving (addsKeysOnly), by kind (an operator's id taken out, so a
 * hold-out names none): what `npm run snapshots:update` reports as "keys added only" (round 15's own report point 2: a
 * new describing key is tooling, not accuracy work, when nothing else moved).
 */
export function addedKeysOnly(before: Snapshots, after: Snapshots): { readonly logs: number; readonly kinds: ReadonlyMap<string, number> } {
  const a = allLogs(before);
  const kinds = new Map<string, number>();
  let logs = 0;
  for (const [k, l] of allLogs(after)) {
    const was = a.get(k)?.entry;
    if (!was || JSON.stringify(was) === JSON.stringify(l.entry) || !addsKeysOnly(was, l.entry)) continue;
    logs++;
    for (const f of Object.keys(l.entry[TOTALS] ?? {})) {
      if (f in (was[TOTALS] ?? {})) continue;
      const kind = f.replace(/ chr_\S+$/, " <id>");
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
  }
  return { logs, kinds };
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

async function main(argv: readonly string[]): Promise<number> {
  const now = readSnapshots();
  const text = render(now, argv[0] === "--compare" ? new Map() : await operatorNames());
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
    const ref = argv[1] !== undefined && !argv[1].startsWith("--") ? argv[1] : "HEAD";
    const then = snapshotsAt(ref);
    if (argv.includes("--regroup")) {
      const mid = regrouped(then, now);
      console.log(`Reclassification alone: the snapshots at ${ref}, in ${ref}'s groups → the same entries in this tree's groups (its hold-out split and several-target marks):`);
      for (const l of [...compare(then, mid), ...sharesCompare(then, mid)]) console.log(`  ${l}`);
      console.log(`The change alone: the snapshots at ${ref} in this tree's groups → this tree's snapshots:`);
      for (const l of [...compare(mid, now), ...sharesCompare(mid, now)]) console.log(`  ${l}`);
      return 0;
    }
    console.log(`Accuracy against ${ref} (the log verdict snapshots):`);
    for (const l of [...compare(then, now), ...sharesCompare(then, now)]) console.log(l);
    return 0;
  }
  process.stdout.write(text);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
