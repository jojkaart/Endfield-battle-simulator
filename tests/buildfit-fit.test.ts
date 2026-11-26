// `efsim zmdlogs fit-build` (packages/logs/src/buildfit.ts): an operator's attribute nodes, weapon level and food
// fitted to its logged hits. Its two fits of 2026-11-18 are found again from the exported builds (the fixtures' overrides
// taken off): 9555de54bb3d's Si without attribute nodes, f978430a083a's Ardelia with her weapon at level 60; and
// 04d401ad257e's Catcher with his weapon at level 3 (2026-11-26).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { buildChanges, fitBuild, readLogFixtureRaw } from "@efsim/logs";
import { ROOT } from "./logverdicts.ts";

const data = loadGameData();
const exported = (id: string) => {
  const fx = readLogFixtureRaw(join(ROOT, `fixtures/pending/zmdlogs-${id}.json`));
  const { buildOverrides: _overrides, ...rest } = fx;
  void _overrides;
  return rest;
};

describe("the build fitter", () => {
  it("finds 9555de54bb3d's Si without attribute nodes (no exported hit fits)", () => {
    const fit = fitBuild(data, exported("9555de54bb3d"), "chr_0036_jsspsi", { foods: false });
    expect(fit.exported.fits).toBe(0);
    expect(fit.best[0]?.set).toEqual({ attributeNodes: 0 });
    expect(fit.best[0]?.cleanFits).toBe(fit.clean);
  });

  it("finds f978430a083a's Ardelia with her weapon at level 60", () => {
    const fit = fitBuild(data, exported("f978430a083a"), "chr_0025_ardelia", { foods: false });
    expect(fit.exported.fits).toBe(0);
    expect(fit.best[0]?.set).toEqual({ weapon: { level: 60 } });
    expect(fit.best[0]?.cleanFits).toBe(fit.clean);
    expect(fit.best[0]?.fits).toBeGreaterThan(100);
  });

  it("finds 04d401ad257e's Catcher with his weapon at level 3, foods tried (a DEF food can't be scored on his DEF hits)", () => {
    // His P1 hits scale with DEF; Superhot Slug Gratin's DEF % sits in an unknown formula slot (StatLine.unmodelled),
    // which threw out of the whole fit before 2026-11-26.
    const fit = fitBuild(data, exported("04d401ad257e"), "chr_0020_meurs");
    expect(fit.exported.fits).toBe(0);
    expect(fit.best[0]?.set).toEqual({ weapon: { level: 3 } });
    expect(fit.best[0]?.cleanFits).toBeGreaterThanOrEqual(150);
  });

  it("counts the wider space's single changes and pairs that give an offset (--pairs; round 16): 04d4's Snowshine ×0.9624", () => {
    // The bursts-and-cooldowns round's probe (scripts/probes/stats/snowshine-builds.ts, on top of two nodes: 46 pairs):
    // from the build as read, no single change and many pairs, so the logs don't decide it.
    const base = exported("04d401ad257e").team.find((b) => b.operator === "chr_0014_aurora");
    const c = buildChanges(data, base as NonNullable<typeof base>, 0.9624);
    expect(c.singles).toEqual([]);
    expect(c.pairs.length).toBeGreaterThan(10);
    for (const p of c.pairs) expect(Math.abs(p.ratio - 0.9624)).toBeLessThanOrEqual(0.001);
    expect(c.pairs.some((p) => /^weapon level \d+ \+ gear \d /.test(p.what))).toBe(true);
  });
});
