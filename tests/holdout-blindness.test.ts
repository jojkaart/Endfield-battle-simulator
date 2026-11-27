// The hold-outs' blindness over every printing function of scripts/accuracy.ts and scripts/measure.ts (round 19, round
// 18's own report point 1): a hold-out has two key forms (holdout/… in the snapshot files and logKeys, pending/… from
// allLogs, pairKey), and measure's splitLines once named a hold-out moved by the whole change and by no part because
// its prefix test read allLogs' key. One helper decides (accuracy.ts isHoldoutKey), and this test runs every function
// that prints a log's key on synthetic snapshots whose hold-out moves (alone, beside a development log, new, gone) and
// fails if the hold-out's id appears anywhere in the output. Every exported function of the two modules is named
// below, as a printer this test runs or with why it prints no log of its own, so a new export must be classified.
import { describe, expect, it } from "vitest";
import * as accuracy from "../scripts/accuracy.ts";
import * as measure from "../scripts/measure.ts";
import type { Entry, Snapshots } from "../scripts/accuracy.ts";
import type { Shares } from "../scripts/measure-worker.ts";

const HOLD = "zmdlogs-feedfacecafe";
const DEV = "zmdlogs-0123456789ab";
const OTHER = "zmdlogs-abcdef012345";
const HK = `holdout/${HOLD}.json`;
const DK = `pending/${DEV}.json`;
const OK = `pending/${OTHER}.json`;

const e = (plain: number, mismatch = 1, shares: [number, number, number] = [1, 2, -3]): Entry => ({
  chr_0001_x: { plain, mismatch, assumed: 2 },
  totals: { damage: 100, "share matched": shares[0], "share replay-only": shares[1], "share log-only": shares[2] },
});
const split = { development: new Set([DEV, OTHER]), holdout: new Set([HOLD]) };
const snap = (pending: Record<string, Entry>): Snapshots => ({ verified: {}, pending, split });

const base = snap({ [DK]: e(10), [OK]: e(5), [HK]: e(20) });
const cases: { name: string; before: Snapshots; after: Snapshots }[] = [
  { name: "the hold-out moved alone", before: base, after: snap({ [DK]: e(10), [OK]: e(5), [HK]: e(25, 0, [2, 1, -1]) }) },
  { name: "the hold-out and a development log moved", before: base, after: snap({ [DK]: e(12), [OK]: e(5), [HK]: e(15, 4) }) },
  { name: "the hold-out new", before: snap({ [DK]: e(10), [OK]: e(5) }), after: base },
  { name: "the hold-out gone", before: base, after: snap({ [DK]: e(11, 1, [3, 4, -5]), [OK]: e(5) }) },
];

/** Every string inside a value (arrays, maps, objects). */
function texts(x: unknown): string[] {
  if (typeof x === "string") return [x];
  if (x instanceof Map) return [...x].flatMap(texts);
  if (x instanceof Set) return [...x].flatMap(texts);
  if (Array.isArray(x)) return x.flatMap(texts);
  if (x && typeof x === "object") return Object.entries(x).flatMap(([k, v]) => [k, ...texts(v)]);
  return [];
}

const shares = (s: Snapshots): Map<string, Shares> =>
  new Map(Object.entries(s.pending).map(([k, x]) => [k, { error: x["totals"]?.["damage"] ?? 0, matched: 1, replayOnly: 2, logOnly: -1, kinds: [{ context: "inside a cast", nature: "replay", skill: "battle", replay: 1, log: 0 }] } as Shares]));

/** The printers this test runs: each gives its lines for a case. */
const PRINTERS: Record<string, (c: { before: Snapshots; after: Snapshots }) => unknown> = {
  render: (c) => [accuracy.render(c.before), accuracy.render(c.after)],
  compare: (c) => [accuracy.compare(c.before, c.after), accuracy.compare(c.after, c.before)],
  directionSummary: (c) => accuracy.directionSummary(c.before, c.after),
  changedLogs: (c) => accuracy.changedLogs(c.before, c.after),
  sharesCompare: (c) => accuracy.sharesCompare(c.before, c.after),
  addedKeysOnly: (c) => accuracy.addedKeysOnly(c.before, c.after),
  regrouped: (c) => accuracy.compare(c.before, accuracy.regrouped(c.before, c.after)),
  splitLines: (c) => {
    const devOnly = snap({ ...c.before.pending, [DK]: c.after.pending[DK] ?? e(10) });
    return [
      measure.splitLines([{ label: "the whole", from: c.before, to: c.after }], c.before, c.after),
      // A part that moves only the development log: the hold-out is "moved by the whole change, by no part alone".
      measure.splitLines([{ label: "dev part", from: c.before, to: devOnly }, { label: "nothing", from: c.before, to: c.before }], c.before, c.after),
    ];
  },
  sharesLines: (c) => measure.sharesLines(shares(c.after), split, shares(c.before)),
  kindLines: (c) => measure.kindLines(shares(c.after), split, shares(c.before)),
  overlay: (c) => accuracy.compare(c.before, measure.overlay(c.before, new Map(Object.entries(c.after.pending)))),
};

/** Exported functions that print no log key, or print only the development keys their callers pass (filtered by isHoldoutKey). */
const NOT_PRINTERS: Record<string, string> = {
  withSeveralTargets: "a split", readSplit: "a split", groupOf: "a group", fitOf: "numbers", direction: "a direction",
  fitChange: "one entry's change, no key", fieldChange: "one entry's change", formatFieldChange: "one entry's change (`blind` for a hold-out)",
  sumFieldChanges: "numbers", perOperator: "by operator", readSnapshots: "reads", splitPending: "entries", allLogs: "entries",
  groupAggregates: "numbers", sharesAggregate: "numbers", operatorNames: "names", operatorLabel: "an operator", addsKeysOnly: "a boolean",
  snapshotsAt: "reads a ref", isDescribingKey: "a boolean", pairKey: "a key", isHoldoutKey: "the test itself",
  logKeys: "keys for the caller, which filters them", interactLines: "development keys from moved.json (MovedRecord.moved: the hold-outs as a count)",
  isHoldoutOmittedKey: "a boolean", withoutHoldoutOmitted: "a totals record", holdoutEntry: "an entry",
  selectLogs: "refuses a hold-out", measureOptions: "options", decisionLines: "kinds and counts, no key", isSetEntry: "a boolean",
  parseSet: "a constant", applySets: "a source", replacementDiff: "a diff", combinedPatch: "a diff", setsProblem: "a constant's problem",
  diffHunks: "a diff", hunkParts: "a diff", readingsProblem: "an assumption's problem", defaultReference: "a commit", referenceNote: "a commit",
  splitGroups: "files", exportedNames: "names", importedNames: "names", importLinks: "files", negativeControl: "the verified logs' counts",
  mixedPerHit: "the development logs its caller passes", movedCasts: "the development logs its caller passes", hitChanges: "the development logs its caller passes",
  holdChanges: "the development logs its caller passes", pinChange: "one unit", modifierChange: "one hit", patchProblem: "a patch's problem", pinRefs: "refs", crossHunkNames: "the parts its caller passes (the hold-out fixtures part left out)",
};

describe("the hold-outs' blindness over every printing function (accuracy.ts, measure.ts)", () => {
  it("names every exported function: a printer this test runs, or why it prints no log", () => {
    const fns = [...Object.entries(accuracy), ...Object.entries(measure)].filter(([, v]) => typeof v === "function").map(([k]) => k);
    const unclassified = fns.filter((k) => !(k in PRINTERS) && !(k in NOT_PRINTERS));
    expect(unclassified, "a new export of scripts/accuracy.ts or measure.ts: add it to PRINTERS (and run it) or NOT_PRINTERS (with why)").toEqual([]);
    expect([...Object.keys(PRINTERS), ...Object.keys(NOT_PRINTERS)].filter((k) => !fns.includes(k))).toEqual([]);
  });

  it("never prints the hold-out's id, in any case, and each printer prints in one at least", () => {
    for (const [name, run] of Object.entries(PRINTERS)) {
      let printed = 0;
      for (const c of cases) {
        const out = texts(run(c));
        printed += out.length;
        expect(out.filter((l) => l.includes(HOLD.slice(8, 16))), `${name}, ${c.name}`).toEqual([]);
      }
      expect(printed, `${name} printed nothing in any case: the cases don't test it`).toBeGreaterThan(0);
    }
  });

  it("a development log is named where it moved (the cases test the printers)", () => {
    const c = cases[1] as (typeof cases)[number];
    expect(accuracy.compare(c.before, c.after).join("\n")).toContain(DEV);
    expect(measure.splitLines([{ label: "p", from: c.before, to: c.after }], c.before, c.after).join("\n")).toMatch(/hold-out/);
  });

  it("isHoldoutKey takes both key forms; pairKey gives allLogs' form", () => {
    expect(accuracy.isHoldoutKey(HK, split)).toBe(true);
    expect(accuracy.isHoldoutKey(accuracy.pairKey(HK), split)).toBe(true);
    expect(accuracy.isHoldoutKey(DK, split)).toBe(false);
    expect([...accuracy.allLogs(base).keys()]).toContain(accuracy.pairKey(HK));
  });

  // Round 20 (the lead): a hold-out's entry carries no operator's own matched / one-sided split, which its moved keys'
  // summed kinds would print as a split of the hold-outs' change.
  it("a hold-out entry carries neither `share own matched operator` nor `share own one-sided operator` keys", () => {
    const own: Entry = { chr_0001_x: { plain: 1 }, totals: { damage: 1, "share operator chr_0001_x": 50, "share own matched operator chr_0001_x": 0.4, "share own one-sided operator chr_0001_x": 2 } };
    expect(Object.keys(accuracy.holdoutEntry(own).totals ?? {}).sort()).toEqual(["damage", "share operator chr_0001_x"]);
    expect(accuracy.withoutHoldoutOmitted({ a: 1, "share own matched operator x": 2 })).toEqual({ a: 1 });
    // The committed hold-out snapshot: counted, never printed.
    const stored = accuracy.readSnapshots();
    const holdouts = Object.entries(stored.pending).filter(([k]) => accuracy.isHoldoutKey(k, stored.split));
    expect(holdouts.length).toBeGreaterThan(0);
    const carrying = holdouts.filter(([, x]) => Object.keys(x.totals ?? {}).some((k) => k.startsWith("share own matched operator ") || k.startsWith("share own one-sided operator "))).length;
    expect(carrying, "hold-out entries carrying an operator's own split: npm run snapshots:update").toBe(0);
    const dev = Object.entries(stored.pending).filter(([k]) => !accuracy.isHoldoutKey(k, stored.split));
    expect(dev.some(([, x]) => Object.keys(x.totals ?? {}).some((k) => k.startsWith("share own one-sided operator ")))).toBe(true);
  });
});
