// `zmdlogs stack <owner:stack>` (packages/logs/src/stackview.ts, round 18, the log-only report point 3): a kit stack's
// value at each cast the replay made, from the replay's stack trace. Structural, on 1d91's Typhoeus and her Signs: each
// row's value after is its value before carried through the changes it lists.
import { describe, expect, it } from "vitest";
import { loadGameData, operatorId } from "@efsim/data";
import { devFixtures, stackAtCasts, stackView } from "@efsim/logs";

const data = loadGameData();
const logs = devFixtures({ ids: ["1d91"] });
const fx = (logs[0] as (typeof logs)[number]).fx;
const T = operatorId(data, "Typhoeus");

describe("a kit stack's value at each cast (stackAtCasts)", () => {
  const rows = stackAtCasts(data, fx, T, "signs", { skill: /combo/ });
  it("gives a row per matching cast, each after its value before carried through the changes it lists", () => {
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.some((r) => r.operator === T && (r.before ?? 0) > 0)).toBe(true);
    for (const r of rows) {
      const last = r.changes.at(-1);
      if (last) expect(last).toMatch(new RegExp(`→ ${r.after ?? "unset"} at `));
      else expect(r.after).toBe(r.before);
    }
  });
  it("prints a line per cast and a count per skill and value before", () => {
    const text = stackView(data, logs, T, "signs", { skill: /combo/ });
    expect(text).toMatch(/^Typhoeus:signs at each cast the replay made/);
    expect(text).toMatch(/Typhoeus combo_skill\w*( \(placed as \w+\))?: \d+ → \d+/);
    expect(text).toMatch(/Over 1 log\(s\) with Typhoeus: casts by skill and the value before them:/);
  });
});
