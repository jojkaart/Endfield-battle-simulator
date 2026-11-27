// A hit's listing against its neighbours' (packages/logs/src/listingview.ts, `zmdlogs hits --same-listing`, `hits
// --listed`; round 16, arcane-will report point 1): the nearest hits with the very same listing and their verdicts, so
// "the log lists X n times" is checked against the hit next door before it becomes a lead.
import { describe, expect, it } from "vitest";
import { listedEntryWords, listingKey, sameListingLines, valueSplit, type HitRecord, type LogEffect } from "@efsim/logs";
import { logHitOf, syntheticFixture } from "./helpers/synthetic.ts";

const effect = (buff: string, value: number, since = 1000): LogEffect => ({ buff, zone: "susceptibility", element: null, value, source: "op_a", since });
const record = (t: number, cls: HitRecord["class"], value: number): HitRecord => ({ fixture: "synthetic", t, operator: "op_a", event: "combo", kind: "skill", value, crit: false, verdict: cls === "mismatch" ? "mismatch" : "match", class: cls, predicted: value, error: 0, listed: [] }) as HitRecord;

describe("the same listing next door", () => {
  const five = [effect("line", 0.1), effect("line", 0.1), effect("line", 0.1), effect("line", 0.1), effect("line", 0.1)];
  const hits = [
    logHitOf("op_a", 1000, "combo", 10, { effects: five }),
    logHitOf("op_a", 1100, "combo", 11, { effects: [effect("line", 0.1)] }),
    logHitOf("op_a", 1200, "combo", 12, { effects: five, boundaryEffects: [effect("gone", 0.2)] }),
    logHitOf("op_a", 1300, "combo", 13, { effects: five }),
  ];
  const fx = syntheticFixture(hits, [], { enemy: "e", level: 1 });
  const records = [record(1000, "plain", 10), record(1100, "plain", 11), record(1200, "mismatch", 12), record(1300, "plain", 13)];

  it("keys a listing by its effects' buff, source and value, not by their order or the boundary", () => {
    expect(listingKey(hits[0] as (typeof hits)[number])).toBe(listingKey(hits[2] as (typeof hits)[number]));
    expect(listingKey(hits[0] as (typeof hits)[number])).not.toBe(listingKey(hits[1] as (typeof hits)[number]));
  });

  it("gives the hit at a moment and its neighbours with the same listing, with verdicts and a count", () => {
    const text = sameListingLines(records, fx, 1190).join("\n");
    expect(text).toMatch(/AT {6}1\.20 {2}op_a {2}combo {2}mismatch .* boundary: gone/);
    expect(text).toMatch(/SAME {4}1\.00 .* plain/);
    expect(text).toMatch(/SAME {4}1\.30 .* plain/);
    expect(text).not.toMatch(/SAME {4}1\.10/);
    expect(text).toMatch(/2 other hit\(s\) of the fight with this listing: plain 2/);
  });

  // Round 20 (round 19's backlog point 2): 7b54's Laevatain attack 1, one listing, 1,927 and 1,608: two targets.
  it("flags a hit of the same key and listing at a value the listing can't give (VALUE)", () => {
    expect(valueSplit({ value: 1927, crit: false }, { value: 1608, crit: false })).toBeCloseTo(1608 / 1927, 6);
    expect(valueSplit({ value: 1927, crit: false }, { value: 1928, crit: false })).toBeNull();
    expect(valueSplit({ value: 1000, crit: null }, { value: 1400, crit: false })).toBeNull();
    expect(valueSplit({ value: 1000, crit: null }, { value: 1600, crit: false })).toBeCloseTo(1.6, 6);
    const two = [logHitOf("op_a", 1000, "combo", 1927, { effects: five }), logHitOf("op_a", 2000, "combo", 1608, { effects: five })].map((h) => ({ ...h, crit: false }));
    const text = sameListingLines([{ ...record(1000, "plain", 1927) }, { ...record(2000, "plain", 1608) }], syntheticFixture(two, [], { enemy: "e", level: 1 }), 1000).join("\n");
    expect(text).toMatch(/^\S+: the hit\(s\) at 1\.00 s .*\. VALUE: 1 hit\(s\) of the same key and listing at another value/);
    expect(text).toMatch(/SAME {4}2\.00 .* \[VALUE ×0\.834 the AT hit's: one key, one listing\]/);
  });

  it("prints a hit's matching entries with source, since and value (--listed)", () => {
    expect(listedEntryWords(hits[2] as (typeof hits)[number], /gone|line/)).toEqual([...Array(5).fill("line from op_a @1.00 = 0.1"), "gone from op_a @1.00 = 0.2 (boundary)"]);
  });
});
