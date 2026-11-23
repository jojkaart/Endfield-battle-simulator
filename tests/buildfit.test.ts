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

  it("set skill levels group by group, the others as exported", () => {
    const b = ardelia(raw);
    if (!b) throw new Error("no Ardelia");
    expect(overrideBuild(b, { skillLevels: { basic: 9 } }).skillLevels).toEqual({ ...b.skillLevels, basic: 9 });
  });
});

describe("the Endministrator's variant (logs.ts withEndminVariant)", () => {
  it("a log keyed with the male's skills is read as his (d4fb: every skill's hits under chr_0002_endminm_*; the female's kit landed none of them), the others as exported", () => {
    const file = join(ROOT, "fixtures/pending/zmdlogs-d4fb69b036fe.json");
    const raw = readLogFixtureRaw(file);
    expect(raw.team.map((b) => b.operator)).toContain("chr_0003_endminf");
    const fx = readLogFixture(file);
    expect(fx.team.map((b) => b.operator)).toEqual(raw.team.map((b) => (b.operator === "chr_0003_endminf" ? "chr_0002_endminm" : b.operator)));
    expect(fx.hits.some((h) => h.operator === "chr_0003_endminf" || h.effects.some((e) => e.source === "chr_0003_endminf"))).toBe(false);
    // Its override (basic level 9) applies to the variant.
    expect(fx.team.find((b) => b.operator === "chr_0002_endminm")?.skillLevels.basic).toBe(9);
    // The female's logs, whose combo alone is keyed chr_0002_endminm_combo_skill, stay hers (7e19).
    const f = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-7e19489ae503.json"));
    expect(f.team.map((b) => b.operator)).toContain("chr_0003_endminf");
  });
});
