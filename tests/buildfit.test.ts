// A log fixture's buildOverrides (packages/logs/src/logs.ts): set over the exported build when the fixture is read,
// the file keeping `team` as exported. The fitter itself (buildfit.ts, `efsim zmdlogs fit-build`) is in
// tests/buildfit-fit.test.ts (a replay of a whole log).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { overrideBuild, readLogFixture, readLogFixtureRaw, withBuildOverrides, type LogFixture } from "@efsim/logs";
import { ROOT } from "./logverdicts.ts";

describe("build overrides", () => {
  const raw = readLogFixtureRaw(join(ROOT, "fixtures/pending/zmdlogs-f978430a083a.json"));
  const ardelia = (fx: LogFixture) => fx.team.find((b) => b.operator === "chr_0025_ardelia");

  it("leave the file's team as exported and apply when the fixture is read", () => {
    expect(ardelia(raw)?.weapon?.level).toBe(90);
    const read = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-f978430a083a.json"));
    expect(ardelia(read)?.weapon).toEqual({ ...ardelia(raw)?.weapon, level: 60 });
    expect(read.team.filter((b) => b.operator !== "chr_0025_ardelia")).toEqual(raw.team.filter((b) => b.operator !== "chr_0025_ardelia"));
  });

  it("set only the fields they name; a weapon's fields over the build's weapon; in order", () => {
    const b = ardelia(raw);
    if (!b) throw new Error("no Ardelia");
    expect(overrideBuild(b, { attributeNodes: 2, food: "item_bottled_insec2_2" })).toEqual({ ...b, attributeNodes: 2, food: "item_bottled_insec2_2" });
    const twice = withBuildOverrides({ ...raw, buildOverrides: [{ operator: b.operator, set: { weapon: { level: 40 } }, why: "a" }, { operator: b.operator, set: { weapon: { level: 60 } }, why: "b" }] });
    expect(ardelia(twice)?.weapon?.level).toBe(60);
    expect(() => withBuildOverrides({ ...raw, buildOverrides: [{ operator: "chr_0016_laevat_x", set: { potential: 1 }, why: "c" }] })).toThrow(/isn't in the team/);
  });
});
