// Stat panel expectations from the fixtures.
import { describe, expect, it } from "vitest";
import { computeStats, Attr, type StatPanel } from "@efsim/engine";
import { loadGameData, sourceCommit, SOURCES } from "@efsim/data";
import { loadFixtures } from "./fixtures.ts";

const data = loadGameData();
const fixtures = loadFixtures();

function statValue(panel: StatPanel, stat: string): number {
  if (stat.startsWith("atk.")) {
    const key = stat.slice(4) as keyof StatPanel["atk"];
    const v = panel.atk[key];
    if (typeof v !== "number") throw new Error(`unknown stat ${stat}`);
    return v;
  }
  const attr = (Attr as Record<string, number>)[stat];
  if (attr === undefined) throw new Error(`unknown stat ${stat}`);
  return panel.attrs[attr]?.total ?? 0;
}

describe.each(fixtures)("$file", ({ fixture }) => {
  it("was verified against the current data commits", () => {
    // A data update changes these; review the fixture, then update them (design principle 11).
    expect(fixture.provenance.verifiedAgainst).toEqual(Object.fromEntries(SOURCES.map((s) => [s, sourceCommit(s)])));
  });

  const stats = fixture.expected.stats ?? [];
  if (stats.length === 0) return;
  const panel = computeStats(data, fixture.build);
  it.each(stats)("$stat = $expected", ({ stat, expected, display, tolerance }) => {
    const actual = statValue(panel, stat);
    if (display === "floor") expect(Math.floor(actual)).toBe(expected);
    else if (tolerance !== undefined) expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
    else expect(actual).toBe(expected);
  });
});
