// A lead's status before a brief (scripts/lead-status.ts) and the ranking of what is still one-sided (zmdlogs totals
// --all --side: packages/logs reports.ts oneSidedRanking): round 23, the placement-cases report point 1.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { oneSidedRanking, type OneSided } from "@efsim/logs";
import { leadMentions, leadVerdict } from "../scripts/lead-status.ts";

describe("scripts/lead-status.ts", () => {
  const doc = [
    "# Open problems",
    "",
    "## The placement cases (2026-11-27)",
    "",
    "- Fixed: f879 95.10 s, the empowered battle skill — docs/journal/2026-11-27-05-x.md.",
    "- **Still possible:** 3aa6 125.65 s, the press made as its variant.",
    "",
    "## Log-only landings",
    "",
    "The causes: f879 95.10 s and 3aa6 125.65 s, both log-only; f879 95.94 s another.",
  ].join("\n");

  it("names each paragraph a lead's id and time appear in, fixed or open, and a stale pair as both", () => {
    const f879 = leadMentions(doc, "f879@95.10");
    expect(f879.map((m) => [m.section, m.fixed])).toEqual([
      ["The placement cases (2026-11-27)", true],
      ["Log-only landings", false],
    ]);
    expect(leadVerdict(f879)).toMatch(/^BOTH: 1 of 2/);
    expect(leadVerdict(leadMentions(doc, "3aa6:125.65"))).toMatch(/^open: 2 mention/);
    // 95.1 isn't 95.10's prefix match on 95.94.
    expect(leadMentions(doc, "f879@95.9")).toEqual([]);
    expect(leadVerdict(leadMentions(doc, "dead"))).toBe("not in docs/open-problems.md");
    expect(leadMentions(doc, "empowered battle").length).toBe(1);
  });

  it("reads \"not fixed\" and \"Still possible\" as open, and a fixed case with an open part as both (round 24)", () => {
    // The placement-paths report point 4: "**Diagnosed, not fixed: 8f32 38.50 s**" read as fixed, and a "Still
    // possible" clause inside a "Fixed:" bullet (9c6e 78.88 s) too.
    const text = [
      "## Placement",
      "",
      "**Diagnosed, not fixed: 8f32 38.50 s** (the Endministrator's shatter): Rossi's combo 2 hit_2 placed as a combo 3.",
      "",
      "- Fixed: 9c6e 78.88 s, the array's first tick pair. Still possible: the second pair stays two slots.",
      "- Fixed: 4e5e 28.73 s, no longer INSIDE.",
    ].join("\n");
    expect(leadMentions(text, "8f32@38.50").map((m) => m.state)).toEqual(["open"]);
    const both = leadMentions(text, "9c6e@78.88");
    expect(both.map((m) => [m.state, m.openPart])).toEqual([["both", "Still possible: the second pair stays two slots."]]);
    expect(leadVerdict(both)).toMatch(/^BOTH: 0 of 1 mention\(s\) say fixed, 1 say fixed with a part still open/);
    expect(leadVerdict(leadMentions(text, "4e5e@28.73"))).toMatch(/^fixed: every one of 1/);
  });
});

describe("zmdlogs totals --side", () => {
  it("ranks one side's landings by share across fights, several-target fights left out", () => {
    const data = loadGameData();
    const o = (side: "log" | "replay", t: number, damage: number): OneSided => ({ side, operator: "chr_0032_lizhiyan", t, damage, key: `k${t}`, skill: "combo", nature: "kit hit", context: "no landing: x" }) as unknown as OneSided;
    const text = oneSidedRanking(data, [
      { fight: "aaaa", logged: 1000, oneSided: [o("log", 1000, -20), o("replay", 2000, 50), o("log", 3000, -5)] },
      { fight: "bbbb", logged: 100, oneSided: [o("log", 4000, -3)] },
      { fight: "cccc", logged: 100, severalTargets: true, oneSided: [o("log", 5000, -90)] },
    ], "log", 2);
    const lines = text.split("\n");
    expect(lines[0]).toMatch(/\(2 of 3\):$/);
    expect(lines[1]).toBe("    3.00%  bbbb 4.00 s  Arcane  k4000  no landing: x");
    expect(lines[2]).toBe("    2.00%  aaaa 1.00 s  Arcane  k1000  no landing: x");
    expect(text).not.toContain("cccc");
  });
});
