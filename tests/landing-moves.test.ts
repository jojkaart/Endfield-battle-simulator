// How a logged hit's replay landing moved between two replays (packages/logs landingmoves.ts): measure --hits'
// `landings:` lines and `zmdlogs hits --against`'s (round 23, the combo-hold report point 1).
import { describe, expect, it } from "vitest";
import { landingMoveCounts, landingMoves, recordChanges, type HitRecord } from "@efsim/logs";
import { hitChanges } from "../scripts/measure.ts";

describe("landingMoves", () => {
  it("tells a lost landing (with its reason), a gained one and a shift onto another logged hit's landing", () => {
    const before = ["30 combo hit_1", "60 combo hit_2", "NOLAND a landing the replay didn't land", "90 combo hit_3", undefined];
    const after = ["30 combo hit_1", "NOLAND a landing the replay didn't land: KitHit.if {\"stack\":\"strike_n\"} didn't hold", "90 combo hit_3", "120 combo hit_4", "NOLAND x"];
    const moves = landingMoves(before, after);
    expect(moves.map((m) => [m.index, m.kind])).toEqual([
      [1, "lost its landing: a landing the replay didn't land: KitHit.if {…} didn't hold"],
      [2, "gained a landing"],
      [3, "paired with another landing"],
    ]);
    // The hit at index 2 took index 3's landing: a shift.
    expect(moves[1]?.words).toBe("gained a landing: combo hit_3 at 3.00 s (before: a landing the replay didn't land)");
    const shift = landingMoves(["30 a h1", "60 a h2"], ["60 a h2", "90 a h3"]);
    expect(shift[0]?.kind).toBe("took another logged hit's landing (a shift)");
    expect(shift[0]?.words).toBe("took the landing logged hit #2 had (a h2 at 2.00 s; its own was a h1 at 1.00 s)");
    expect(landingMoveCounts(moves)).toBe("gained a landing 1; lost its landing: a landing the replay didn't land: KitHit.if {…} didn't hold 1; paired with another landing 1");
  });
});

describe("measure --hits with the landings", () => {
  it("counts the landings that moved per log and names a changed hit's move", () => {
    const before = new Map([["pending/zmdlogs-a.json", [[1000, "op", "e", "plain", 1, undefined, "30 s h1"] as const, [2000, "op", "e", "plain", 1, undefined, "60 s h2"] as const]]]);
    const after = new Map([["pending/zmdlogs-a.json", [[1000, "op", "e", "plain", 1, undefined, "60 s h2"] as const, [2000, "op", "e", "mismatch", null, undefined, "NOLAND a landing the replay didn't land"] as const]]]);
    const { summary, full } = hitChanges(["pending/zmdlogs-a.json"], before, after);
    expect(summary).toContain("    landings: lost its landing: a landing the replay didn't land 1; took another logged hit's landing (a shift) 1");
    expect(summary.some((l) => l.includes("2.00 s op e: plain ×1.000 → mismatch - [lost its landing (s h2 at 2.00 s): a landing the replay didn't land]"))).toBe(true);
    expect(full).toContain("  landings moved under the same verdict:");
  });
});

describe("hits --against with the landings", () => {
  const rec = (t: number, cls: string, landing: { frame: number; hitId: string } | null, dropped?: string): HitRecord =>
    ({ fixture: "fixtures/pending/zmdlogs-aaaa.json", t, operator: "op", event: "e", kind: "skill", value: 100, crit: false, verdict: "match", class: cls, predicted: landing ? 100 : null, error: landing ? 0 : null, listed: [], ...(landing ? { landing: { frame: landing.frame, skillId: "s", hitId: landing.hitId, modifiers: [] } } : { unknown: "a landing the replay didn't land", ...(dropped ? { dropped } : {}) }) }) as unknown as HitRecord;

  it("names the NOLAND step a lost landing came from, and a shift under the same class", () => {
    const out = recordChanges([rec(1, "plain", { frame: 30, hitId: "h1" }), rec(2, "plain", { frame: 60, hitId: "h2" })], [rec(1, "plain", { frame: 60, hitId: "h2" }), rec(2, "uncovered", null, "KitHit.if {\"a\":1} didn't hold")]);
    expect(out[0]).toBe("zmdlogs-aaaa  t=1  op  e  logged 100: plain (the same) [took the landing logged hit #2 had (s h2 at 2.00 s; its own was s h1 at 1.00 s)]");
    expect(out[1]).toContain("[lost its landing (s h2 at 2.00 s): a landing the replay didn't land: KitHit.if {…} didn't hold]");
    expect(out).toContain("1 hit(s) changed: plain → uncovered 1");
    expect(out.at(-1)).toBe("zmdlogs-aaaa: landings lost its landing: a landing the replay didn't land: KitHit.if {…} didn't hold 1; took another logged hit's landing (a shift) 1");
  });
});
