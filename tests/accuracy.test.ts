// The accuracy scoreboard (docs/accuracy.md, scripts/accuracy.ts): it says what the committed log verdict snapshots
// give, so a change to a verdict can't land without its accuracy change in the scoreboard's diff; and the fit measure
// that tells a better log from a worse one.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addedKeysOnly, addsKeysOnly, changedLogs, compare, direction, directionSummary, fieldChange, formatFieldChange, groupOf, operatorNames, perOperator, readSnapshots, readSplit, regrouped, render, ROOT, SCOREBOARD, sharesCompare, type Entry, type Snapshots } from "../scripts/accuracy.ts";

// Round 18 (the status-pairing report points 1 and 4): a reclassification apart from a code change, the shares' change
// per group, and a group read from the entry's describing key.
describe("accuracy --compare --regroup and the shares' change", () => {
  const e = (plain: number, shares: [number, number, number], several = false): Entry => ({ a: { plain, mismatch: 1 }, totals: { damage: 1, "share matched": shares[0], "share replay-only": shares[1], "share log-only": shares[2], ...(several ? { "several targets": 1 } : {}) } });
  const split = { development: new Set(["zmdlogs-aaaa", "zmdlogs-bbbb"]), holdout: new Set<string>() };
  const then: Snapshots = { verified: {}, pending: { "pending/zmdlogs-aaaa.json": e(10, [1, 2, -3]), "pending/zmdlogs-bbbb.json": e(5, [2, 10, -30]) }, split };
  const now: Snapshots = { verified: {}, pending: { "pending/zmdlogs-aaaa.json": e(11, [1, 2, -3]), "pending/zmdlogs-bbbb.json": e(5, [2, 10, -30], true) }, split: { ...split, severalTargets: new Set(["zmdlogs-bbbb"]) } };

  it("reads a group from the entry's describing key, without a marked split", () => {
    expect(groupOf("pending/zmdlogs-bbbb.json", split, now.pending["pending/zmdlogs-bbbb.json"])).toBe("targets");
    expect(groupOf("pending/zmdlogs-bbbb.json", split, then.pending["pending/zmdlogs-bbbb.json"])).toBe("development");
  });

  it("splits a comparison into the reclassification and the change", () => {
    const mid = regrouped(then, now);
    const re = compare(then, mid).join("\n");
    expect(re).toMatch(/^Development .*: fights 2 → 1, plain .*$/m);
    expect(re).toMatch(/No log's verdicts moved\./);
    const change = compare(mid, now).join("\n");
    expect(change).toMatch(/^Development .*: fights 1 → 1, plain 90\.9% → 91\.7%/m);
    expect(change).toMatch(/better: pending\/zmdlogs-aaaa\.json \(plain 10 → 11\)/);
    expect(sharesCompare(then, mid).join("\n")).toMatch(/Development .*: fights 2 → 1, \|matched\| 1\.50 → 1\.00%, replay-only 6\.00 → 2\.00%, log-only 16\.50 → 3\.00%/);
    expect(sharesCompare(mid, now)).toEqual([]);
  });
});

describe("accuracy scoreboard", () => {
  it("is what the log verdict snapshots give (after a snapshot change: npm run accuracy, or npm run snapshots:update)", async () => {
    expect(readFileSync(join(ROOT, SCOREBOARD), "utf8")).toBe(render(readSnapshots(), await operatorNames()));
  });

  it("puts every pending log in one group: development, hold-out, or imported before the split", () => {
    const split = readSplit();
    expect([...split.development].filter((id) => split.holdout.has(id))).toEqual([]);
    expect(groupOf("zmdlogs-x.json", split)).toBe("verified");
    const [d] = split.development;
    const [h] = split.holdout;
    expect(groupOf(`pending/${d}.json`, split)).toBe("development");
    expect(groupOf(`holdout/${h}.json`, split)).toBe("holdout");
    expect(groupOf(`pending/${h}.json`, split)).toBe("holdout");
    expect(groupOf("pending/zmdlogs-none.json", split)).toBe("earlier");
  });

  it("keeps the hold-out logs apart: fixtures/holdout/ holds exactly them, no other directory holds one (by file name only)", () => {
    const split = readSplit();
    const names = (d: string) => readdirSync(join(ROOT, d)).filter((f) => f.startsWith("zmdlogs-")).map((f) => f.replace(/\.json$/, ""));
    expect(names("fixtures/holdout").sort()).toEqual([...split.holdout].sort());
    for (const d of ["fixtures", "fixtures/pending", "fixtures/multi-target"]) expect(names(d).filter((id) => split.holdout.has(id)), d).toEqual([]);
  });
});

describe("the fit measure (direction)", () => {
  const counts = (plain: number, mismatch: number, assumed = 0) => ({ plain, assumed, fallback: 0, mismatch, unvalued: 0, unquantified: 0, uncovered: 0 });
  const log = (plain: number, mismatch: number, damage: number | null, assumed = 0): Entry => ({ op: counts(plain, mismatch, assumed), totals: { damage } });

  it("better: more plain matches, fewer mismatches or a smaller |total damage error|, and none of them worse", () => {
    expect(direction(log(10, 5, -8), log(12, 3, -8))).toBe("better");
    expect(direction(log(10, 5, -8), log(10, 5, 6))).toBe("better");
    expect(direction(log(10, 5, -8), log(10, 5, -8.1))).toBe("worse");
    expect(direction(log(10, 5, 2), log(9, 5, 1))).toBe("mixed");
    expect(direction(log(10, 5, 2, 1), log(10, 5, 2, 2))).toBe("other");
    expect(direction(log(10, 5, 2), log(10, 5, 2))).toBe("same");
    expect(direction(log(10, 5, 2), log(10, 5, null))).toBe("worse");
    // Where the error lives (the totals' share keys) isn't a verdict.
    const shared = (m: number): Entry => ({ op: counts(10, 5), totals: { damage: 2, "share matched": m, "share replay-only": 1, "share log-only": -1 } });
    expect(direction(log(10, 5, 2), shared(0.5))).toBe("same");
    expect(direction(shared(0.5), shared(0.7))).toBe("same");
  });

  it("shows each group's mean shares of where the total's error lives in the scoreboard, the hold-outs' as a group", () => {
    const split = { development: new Set(["zmdlogs-d"]), holdout: new Set(["zmdlogs-h"]) };
    const e = (m: number, r: number, l: number): Entry => ({ op: counts(1, 0), totals: { damage: m + r + l, "share matched": m, "share replay-only": r, "share log-only": l } });
    const text = render({ verified: {}, pending: { "pending/zmdlogs-d.json": e(-2, 5, -1), "holdout/zmdlogs-h.json": e(1, 0.5, 0) }, split });
    expect(text).toMatch(/^\| Development \(.*\) \| 1 \| 2\.0% \| 5\.0% \| 1\.0% \| 1 \|$/m);
    expect(text).toMatch(/^\| Hold-out \(.*\) \| 1 \| 1\.0% \| 0\.5% \| 0\.0% \| 0 \|$/m);
  });

  it("counts hold-out logs only by group, and names the others", () => {
    const split = { development: new Set(["zmdlogs-d"]), holdout: new Set(["zmdlogs-h"]) };
    const at = (d: number, h: number): Snapshots => ({ verified: {}, pending: { "pending/zmdlogs-d.json": log(d, 0, 1), "pending/zmdlogs-h.json": log(h, 0, 1) }, split });
    const lines = directionSummary(at(1, 1), at(2, 0));
    expect(lines.some((l) => l.includes("zmdlogs-d") && l.includes("better"))).toBe(true);
    expect(lines.some((l) => l.includes("zmdlogs-h"))).toBe(false);
    expect(lines.some((l) => l.startsWith("Hold-out") && l.includes("0 better, 1 worse"))).toBe(true);
    expect(directionSummary(at(1, 1), at(1, 1))).toEqual(["No log's verdicts moved."]);
    // A hold-out moved to fixtures/holdout/ is the same log as under pending/ at an older ref.
    const moved: Snapshots = { verified: {}, pending: { "pending/zmdlogs-d.json": log(1, 0, 1), "holdout/zmdlogs-h.json": log(1, 0, 1) }, split };
    expect(directionSummary(at(1, 1), moved)).toEqual(["No log's verdicts moved."]);
  });

  it("says what kind of field moved in an 'other' entry, a hold-out's as counts, without the log or its operators", () => {
    const split = { development: new Set(["zmdlogs-d"]), holdout: new Set(["zmdlogs-h"]) };
    const e = (assumed: number, fallback: number, kindBasic: number, opTotal: number): Entry => ({ chr_a: { plain: 5, assumed, fallback }, totals: { damage: 1, "kind basic": kindBasic, "operator chr_a": opTotal } });
    const at = (d: Entry, h: Entry): Snapshots => ({ verified: {}, pending: { "pending/zmdlogs-d.json": d, "pending/zmdlogs-h.json": h }, split });
    const lines = directionSummary(at(e(3, 0, 1, 1), e(3, 0, 1, 1)), at(e(1, 2, 1.1, 1), e(1, 2, 1, 1.2)));
    expect(lines).toContain("  other: pending/zmdlogs-d.json (verdict classes assumed −2, fallback +2; totals kind basic)");
    expect(lines).toContain("  other (1, summed, counts only): verdict classes assumed −2, fallback +2; totals operator keys 1");
    expect(lines.join("\n")).not.toMatch(/by operator/);
    expect(lines.join("\n")).not.toMatch(/zmdlogs-h/);
  });
});

describe("the by-operator table and describing keys (round 16, totals-off report point 2)", () => {
  const e = (err: number, share: number | undefined): Entry => ({ chr_a: { plain: 1 }, totals: { damage: 1, "operator chr_a": err, ...(share !== undefined ? { "share operator chr_a": share } : {}) } });

  it("gives each operator's mean, median and share-weighted |error| and its mean share", () => {
    const a = perOperator([e(60, 5), e(2, 40), e(-4, 55)]).get("chr_a");
    expect(a?.meanDamageError).toBeCloseTo(22, 6);
    expect(a?.medianDamageError).toBe(4);
    expect(a?.weightedDamageError).toBeCloseTo((5 * 60 + 40 * 2 + 55 * 4) / 100, 6);
    expect(a?.meanShare).toBeCloseTo(100 / 3, 6);
    expect(perOperator([e(3, undefined)]).get("chr_a")).toMatchObject({ weightedDamageError: null, meanShare: null });
  });

  // Round 20 (the Liino report point 1): which fight carries the mean, and the operator's own matched / one-sided split.
  it("names the fight carrying most of an operator's mean and its own matched and one-sided means", () => {
    const own = (err: number, matched: number, oneSided: number): Entry => ({ chr_a: { plain: 1 }, totals: { damage: 1, "operator chr_a": err, "share own matched operator chr_a": matched, "share own one-sided operator chr_a": oneSided } });
    const a = perOperator([own(57.8, 0.4, 58), own(-2, -1.5, 0.5), own(1, 0.2, 0.8)], ["0eef", "1cd1", "1d91"]).get("chr_a");
    expect(a?.largest?.log).toBe("0eef");
    expect(a?.largest?.points).toBeCloseTo(57.8 / 3, 6);
    expect(a?.ownMatched).toBeCloseTo((0.4 + 1.5 + 0.2) / 3, 6);
    expect(a?.ownOneSided).toBeCloseTo((58 + 0.5 + 0.8) / 3, 6);
    expect(perOperator([e(3, 5)]).get("chr_a")).toMatchObject({ largest: null, ownMatched: null, ownOneSided: null });
  });

  it("tells an entry that only gained totals keys from one whose values moved, naming kinds, never ids", () => {
    expect(addsKeysOnly(e(3, undefined), e(3, 20))).toBe(true);
    expect(addsKeysOnly(e(3, undefined), e(4, 20))).toBe(false);
    expect(addsKeysOnly(e(3, undefined), { ...e(3, 20), chr_a: { plain: 1, mismatch: 1 } })).toBe(false);
    expect(addsKeysOnly(undefined, e(3, 20))).toBe(false);
    const split = { development: new Set(["zmdlogs-d"]), holdout: new Set(["zmdlogs-h"]) };
    const at = (s: number | undefined): Snapshots => ({ verified: {}, pending: { "pending/zmdlogs-d.json": e(3, s), "holdout/zmdlogs-h.json": e(3, s) }, split });
    expect(addedKeysOnly(at(undefined), at(20))).toEqual({ logs: 2, kinds: new Map([["share operator <id>", 2]]) });
    expect(changedLogs(at(undefined), at(20))).toEqual([]);
    expect(directionSummary(at(undefined), at(20))).toEqual(["No log's verdicts moved."]);
  });
});

describe("the by-operator table's names, other-kit-hit counts and stage fights (round 17)", () => {
  const e = (err: number, extra: Record<string, number> = {}): Entry => ({ chr_a: { plain: 4, fallback: 2 }, totals: { damage: err, "operator chr_a": err, ...extra } });
  const split = { development: new Set(["zmdlogs-d", "zmdlogs-s"]), holdout: new Set(["zmdlogs-h"]) };

  it("labels an operator by its id and display name (the Arcane stage-factors report point 1: a brief named the wrong operator)", () => {
    const text = render({ verified: {}, pending: { "pending/zmdlogs-d.json": e(3) }, split }, new Map([["chr_a", "Ada"]]));
    expect(text).toMatch(/^\| chr_a \(Ada\) \| 1 \|/m);
    expect(render({ verified: {}, pending: { "pending/zmdlogs-d.json": e(3) }, split })).toMatch(/^\| chr_a \| 1 \|/m);
  });

  it("counts the hits matched as another kit hit per operator and group, and the mean without the stage fights", () => {
    const now: Snapshots = { verified: {}, pending: { "pending/zmdlogs-d.json": e(2, { "other-hit operator chr_a": 2 }), "pending/zmdlogs-s.json": e(30, { stage: 1 }) }, split };
    const a = perOperator(Object.values(now.pending)).get("chr_a");
    expect(a).toMatchObject({ otherHit: 2, meanDamageError: 16, meanWithoutStage: 2 });
    const was: Snapshots = { ...now, pending: { "pending/zmdlogs-d.json": e(2), "pending/zmdlogs-s.json": e(30) } };
    // Describing keys: no verdict moved, the entries only gained keys, and the group's count moved in the comparison.
    expect(directionSummary(was, now)).toEqual(["No log's verdicts moved."]);
    expect(addedKeysOnly(was, now)).toEqual({ logs: 2, kinds: new Map([["other-hit operator <id>", 1], ["stage", 1]]) });
    expect(compare(was, now).some((l) => l.startsWith("Development") && l.includes("as other kit hit 0 → 2"))).toBe(true);
  });

  it("names a hold-out's moved other-hit key by kind, never by its operator", () => {
    const c = fieldChange(e(2, { "other-hit operator chr_a": 1 }), e(2, { "other-hit operator chr_a": 3 }));
    expect(formatFieldChange(c, true)).toBe("totals other-hit ×1");
    expect(formatFieldChange(fieldChange(e(2, { "share operator chr_a": 1 }), e(2, { "share operator chr_a": 3 })), true)).toBe("totals share ×1");
  });
});
