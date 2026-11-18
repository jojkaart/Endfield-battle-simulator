// scripts/measure.ts: the log checks measured into scratch/ and compared, nothing tracked written. The full run is
// checked by hand (it takes a minute: "The log verdict snapshots would stay as they are (byte for byte)" on a clean
// tree); here, the selection and the overlay of measured entries on the reference snapshots.
import { describe, expect, it } from "vitest";
import { compare, type Snapshots } from "../scripts/accuracy.ts";
import { overlay, selectLogs } from "../scripts/measure.ts";

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
});
