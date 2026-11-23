// scripts/measure.ts: the log checks measured into scratch/ and compared, nothing tracked written. The full run is
// checked by hand (it takes a minute: "The log verdict snapshots would stay as they are (byte for byte)" on a clean
// tree); here, the selection and the overlay of measured entries on the reference snapshots.
import { describe, expect, it } from "vitest";
import { compare, type Snapshots } from "../scripts/accuracy.ts";
import { hitChanges, mixedPerHit, modifierChange, movedCasts, negativeControl, overlay, selectLogs } from "../scripts/measure.ts";

const keys = ["zmdlogs-aaaa11112222.json", "pending/zmdlogs-bbbb11112222.json", "pending/zmdlogs-bbbc11112222.json", "holdout/zmdlogs-cccc11112222.json"];
const holdouts = new Set(["zmdlogs-cccc11112222"]);

describe("measure's log selection", () => {
  it("takes ids or unique parts of them", () => {
    expect(selectLogs(keys, ["aaaa"], holdouts)).toEqual(["zmdlogs-aaaa11112222.json"]);
    expect(selectLogs(keys, ["zmdlogs-bbbb11112222"], holdouts)).toEqual(["pending/zmdlogs-bbbb11112222.json"]);
  });

  it("refuses an ambiguous part, an unknown log and anything naming a hold-out", () => {
    expect(() => selectLogs(keys, ["bbb"], holdouts)).toThrow(/2 logs match/);
    expect(() => selectLogs(keys, ["dddd"], holdouts)).toThrow(/no development or verified log/);
    expect(() => selectLogs(keys, ["cccc"], holdouts)).toThrow(/hold-out/);
  });
});

describe("measure's overlay", () => {
  const entry = (plain: number, mismatch: number) => ({ a: { plain, mismatch }, totals: { damage: 1 } });
  const base: Snapshots = {
    verified: { "zmdlogs-aaaa11112222.json": entry(10, 0) },
    pending: { "pending/zmdlogs-bbbb11112222.json": entry(5, 5), "holdout/zmdlogs-cccc11112222.json": entry(3, 3) },
    split: { development: new Set(["zmdlogs-bbbb11112222"]), holdout: holdouts },
  };

  it("puts measured entries in place of the reference's and leaves the rest", () => {
    const after = overlay(base, new Map([["pending/zmdlogs-bbbb11112222.json", entry(8, 2)]]));
    expect(after.pending["pending/zmdlogs-bbbb11112222.json"]).toEqual(entry(8, 2));
    expect(after.pending["holdout/zmdlogs-cccc11112222.json"]).toEqual(entry(3, 3));
    expect(after.verified).toEqual(base.verified);
    expect(compare(base, after).join("\n")).toMatch(/better: pending\/zmdlogs-bbbb11112222\.json \(plain 5 → 8, mismatch 5 → 2\)/);
  });

  it("counts a hold-out's move without naming it", () => {
    const after = overlay(base, new Map([["holdout/zmdlogs-cccc11112222.json", entry(4, 2)]]));
    const text = compare(base, after).join("\n");
    expect(text).toMatch(/Hold-out.*1 better/);
    expect(text).not.toMatch(/cccc/);
  });
  it("gives the mixed logs' mean per-hit error before and after, hold-outs only counted", () => {
    const key = "pending/zmdlogs-bbbb11112222.json";
    const hold = "holdout/zmdlogs-cccc11112222.json";
    const lines = mixedPerHit([key, hold], new Map([[key, { n: 10, meanAbs: 0.4 }], [hold, { n: 5, meanAbs: 0.1 }]]), new Map([[key, { n: 10, meanAbs: 0.15 }], [hold, { n: 5, meanAbs: 0.2 }]]));
    expect(lines[1]).toBe(`  ${key}: 40.00% → 15.00% over 10 hits (closer)`);
    expect(lines[2]).toBe("  hold-out: 0 closer, 1 further, 0 the same");
    expect(lines.join("\n")).not.toMatch(/cccc/);
    expect(mixedPerHit([], new Map(), new Map())).toEqual([]);
  });
});

describe("measure --hits", () => {
  it("lists the hits whose verdict changed, counted by change, a few examples each", () => {
    const before = new Map([["pending/zmdlogs-a.json", [[1000, "op", "attack1", "plain", 1] as const, [2500, "op", "skill", "mismatch", 1.2] as const, [3000, "op", "skill", "mismatch", 1.3] as const]]]);
    const after = new Map([["pending/zmdlogs-a.json", [[1000, "op", "attack1", "plain", 1] as const, [2500, "op", "skill", "plain", 1] as const, [3000, "op", "skill", "assumed", 1] as const]]]);
    const { summary, full } = hitChanges(["pending/zmdlogs-a.json"], before, after, 1);
    expect(summary[1]).toBe("  pending/zmdlogs-a.json: 2 hits: mismatch → plain 1, mismatch → assumed 1");
    expect(summary).toContain("    2.50 s op skill: mismatch ×1.200 → plain ×1.000");
    expect(full).toHaveLength(3);
    expect(hitChanges([], before, after).summary).toEqual(["Hits whose verdict changed (--hits; development logs whose entry moved): none (no development log's entry moved)"]);
  });
});

describe("measure --hits: the modifiers that moved at a hit", () => {
  it("names the kit buffs gone, new and changed in value", () => {
    expect(modifierChange(["a:x dmg 0.3", "b:y atk 0.1"], ["b:y atk 0.2", "c:z dmg 0.1"])).toBe(" [modifiers: −a:x dmg 0.3; +c:z dmg 0.1; b:y atk 0.1 → 0.2]");
    expect(modifierChange(["a:x dmg 0.3"], ["a:x dmg 0.3"])).toBe("");
    expect(modifierChange(undefined, ["a:x dmg 0.3"])).toBe("");
  });
});

describe("measure's negative control", () => {
  it("flags a verified log's chance matches over 1% of its judged hits (at least 1), as test:logs would fail", () => {
    const lines = negativeControl(new Map([
      ["zmdlogs-a.json", [{ factor: 0.97, matches: 1, judged: 50 }, { factor: 1.03, matches: 0, judged: 50 }]],
      ["zmdlogs-b.json", [{ factor: 0.97, matches: 34, judged: 167 }, { factor: 1.03, matches: 2, judged: 167 }]],
    ]));
    expect(lines[0]).toMatch(/over the bound: zmdlogs-b\.json ×0\.97$/);
    expect(lines[1]).toBe("  zmdlogs-a.json: ×0.97 1, ×1.03 0 of 50 judged (bound 1)");
    expect(lines[2]).toBe("  zmdlogs-b.json: ×0.97 34 !, ×1.03 2 of 167 judged (bound 2)");
  });
});

describe("measure --changed placement", () => {
  it("names the casts placed only before and only now", () => {
    const lines = movedCasts(["a.json", "b.json"], new Map([["a.json", ["1.00 s op skill", "2.00 s op combo"]], ["b.json", ["1.00 s op skill"]]]), new Map([["a.json", ["1.00 s op skill", "2.10 s op combo"]], ["b.json", ["1.00 s op skill"]]]));
    expect(lines).toEqual(["  a.json: 1 cast(s) only before, 1 only now", "    - 2.00 s op combo", "    + 2.10 s op combo", "  b.json: the same casts; some hits moved between them"]);
  });
});
