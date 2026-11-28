// The log replay's team SP as a record and lines (round 23, the team-SP report points 1 and 3): TimelineState.spGained
// (each grant's operator and source), `zmdlogs replay`'s TOPUP and `--sp` lines (packages/logs spview.ts), the
// snapshots' describing `sp short` keys and measure's summary of them.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { logBuffReplay, readLogFixture, replayView, spGrants, spShortKeys, SP_SHORT_KEYS } from "@efsim/logs";
import { SP_SHORT, type Snapshots } from "../scripts/accuracy.ts";
import { spShortLines } from "../scripts/measure.ts";

const ROOT = join(import.meta.dirname, "..");
const data = loadGameData();

describe("the SP keys and measure's lines", () => {
  it("are the same keys in the snapshots' writer and the scoreboard's reader, present only where a cast was short", () => {
    expect(SP_SHORT).toEqual(SP_SHORT_KEYS);
    expect(spShortKeys([])).toEqual({});
    expect(spShortKeys([{ sp: 0.2 }])).toEqual({});
    expect(spShortKeys([{ sp: 18.2 }, { sp: 73.9 }])).toEqual({ "sp short": 92, "sp short casts": 2 });
  });

  it("sums the shortfall per group, names the development logs that moved and only counts the hold-outs", () => {
    const split = { development: new Set(["zmdlogs-aaaa11112222", "zmdlogs-bbbb11112222"]), holdout: new Set(["zmdlogs-cccc11112222"]) };
    const t = (sp?: number) => ({ totals: { damage: 0, ...(sp ? { "sp short": sp, "sp short casts": 1 } : {}) } });
    const s = (a?: number, b?: number, c?: number): Snapshots => ({ verified: {}, split, pending: { "pending/zmdlogs-aaaa11112222.json": t(a), "pending/zmdlogs-bbbb11112222.json": t(b), "holdout/zmdlogs-cccc11112222.json": t(c) } });
    const keys = ["pending/zmdlogs-aaaa11112222.json", "pending/zmdlogs-bbbb11112222.json", "holdout/zmdlogs-cccc11112222.json"];
    const lines = spShortLines(s(100, undefined, 50), s(40, 10, 20), keys, split);
    expect(lines[1]).toBe("  development: 1 log(s), 1 cast(s), 100 SP → 2 log(s), 2 cast(s), 50 SP; moved: aaaa 100 → 40, bbbb 0 → 10");
    expect(lines[2]).toBe("  holdout: 1 log(s), 1 cast(s), 50 SP → 1 log(s), 1 cast(s), 20 SP");
    expect(lines.join("\n")).not.toContain("cccc");
    expect(spShortLines(s(), s(), keys, split)).toEqual([]);
  });
});

describe("spGrants", () => {
  it("is the change of spGained per operator and source", () => {
    expect(spGrants({ spGained: { a: { "hit x h": 5 } } }, { spGained: { a: { "hit x h": 12, dodge: 7.5 }, b: { "kit:t": 3 } } })).toEqual([
      { operator: "a", source: "dodge", sp: 7.5 },
      { operator: "a", source: "hit x h", sp: 7 },
      { operator: "b", source: "kit:t", sp: 3 },
    ]);
  });
});

describe("zmdlogs replay: TOPUP and --sp (79cc's opening)", () => {
  const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-79cc42ff7a18.json"));
  it("names the casts the replay's SP couldn't pay and where its SP came from", () => {
    const { replay } = logBuffReplay(data, fx);
    const gained = replay.stateAt(Math.max(...replay.hits.map((h) => h.frame)))?.spGained ?? {};
    // Arcane's Final Strikes grant SP in the opening; the statistic keys them by hit.
    expect(Object.keys(gained).length).toBeGreaterThan(0);
    const text = replayView(data, fx, { to: 12000, sp: true });
    expect(text).toMatch(/TOPUP {2}\S+ normal_skill: the replay's SP was [\d.]+ short of its cost/);
    expect(text).toMatch(/SP {5}\+17\.0 from Arcane hit attack5/);
    expect(text).toMatch(/SP {5}−100\.0 \S+ normal_skill: the team's SP/);
  });
});
