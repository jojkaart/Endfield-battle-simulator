// The placement's twins in a fight against several targets (logcasts.ts placeWith's `batch` and `later` rules,
// targets.ts batchTargets): a batch of one key's alike hits at one ms is `targets` hits per landing, so Si's combo
// slashes logged on several slugs take one slot per landing, not one per slug (7b54 15.60 s).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { batchTargets, devFixtures, oneTargetByValue, placeHits, type BatchHit, type LogFixture } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;
const SI = "chr_0036_jsspsi";

const n = (value: number): BatchHit => ({ value, crit: false });
const c = (value: number): BatchHit => ({ value, crit: true });
const u = (value: number): BatchHit => ({ value, crit: null });

describe("targets.ts oneTargetByValue", () => {
  it("takes one value, or a crit the crit factor above a non-crit, as one target's", () => {
    expect(oneTargetByValue(n(6040), n(6040), 1.5)).toBe(true);
    expect(oneTargetByValue(n(6040), n(6569), 1.5)).toBe(false);
    expect(oneTargetByValue(n(6040), c(9060), 1.5)).toBe(true);
    expect(oneTargetByValue(c(6040), n(9060), 1.5)).toBe(false);
    expect(oneTargetByValue(u(8168), n(5445), 1.5)).toBe(true);
    expect(oneTargetByValue(u(6511), c(8168), 1.5)).toBe(false);
  });
});

describe("targets.ts batchTargets", () => {
  it("reads 7b54's batches: 2 slugs at 15.60 s, 3 at 47.18 s", () => {
    expect(batchTargets([n(6040), n(6569), n(6040), c(9853), n(6040), n(6569), n(6040), n(6569)], 1.5, 8)).toEqual({ targets: 2, by: "values" });
    expect(batchTargets([n(5445), u(6511), n(5445), c(8168), u(6511), n(5445), n(5445), u(6511)], 1.5, 8)).toEqual({ targets: 3, by: "values" });
  });

  it("holds an earlier batch's count where it fits, and reads a landing-long batch alone as one target", () => {
    expect(batchTargets([n(5445), u(8168)], 1.5, 8, 3)).toEqual({ targets: 2, by: "before" });
    expect(batchTargets([n(6040), n(6569), n(6040)], 1.5, 8, 2)).toEqual({ targets: 2, by: "before" });
    // 9c6e 76.36 s: Ardelia's attack 3, 224 then 259 (a debuff between), then 259 and its crit: one target each time.
    expect(batchTargets([n(224), n(259)], 1.5, 2).targets).toBe(1);
    expect(batchTargets([n(259), c(389)], 1.5, 2).targets).toBe(1);
    // One target's two landings at one ms (7b54 31.89 s: Si's combo on one slug).
    expect(batchTargets([n(5051), n(5051)], 1.5, 8)).toEqual({ targets: 1, by: "one" });
  });
});

describe("logcasts.ts placeWith: twins on several targets", () => {
  const fx = fixture("7b54");
  const placement = placeHits(data, fx);
  const combos = placement.casts.filter((x) => x.operator === SI && x.kind === "combo").map((x) => Math.round(x.start));

  it("places each of Si's combos in 7b54 as one cast: its slashes' twins on other slugs share their slots", () => {
    // Three logged combo events (15.18, 31.89, 47.18 s): three casts, no second combo opened by the slugs' twins.
    expect(combos.length).toBe(3);
    const first = [...placement.hits].filter(([h, p]) => h.operator === SI && p.cast.kind === "combo" && h.t >= 15_000 && h.t < 17_000);
    // 21 slashes on two or three slugs at ten slots, and three finals (two slugs at 16.36 s, a third 125 ms later) at the final's.
    expect(new Set(first.map(([, p]) => p.cast)).size).toBe(1);
    expect(new Set(first.filter(([h]) => h.t < 16_300).map(([, p]) => p.index))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    expect(first.filter(([h]) => h.t >= 16_300).map(([, p]) => [p.index, p.twin?.rule ?? null])).toEqual([
      [10, null],
      [10, "used"],
      [10, "later"],
    ]);
    expect(first.filter(([, p]) => p.twin?.rule === "batch").every(([, p]) => (p.twin?.targets ?? 0) >= 2)).toBe(true);
  });

  it("leaves the placement of a fight read as one target alone", () => {
    const one = placeHits(data, fx, { "several-targets": "one" });
    expect([...one.hits.values()].some((p) => p.twin?.rule === "batch" || p.twin?.rule === "later")).toBe(false);
  });
});

