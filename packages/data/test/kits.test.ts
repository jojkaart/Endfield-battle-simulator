// The hand-written kits against the game's own skill files.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData, sourceDir } from "../src/index.ts";

const data = loadGameData();
const skillDir = join(sourceDir("rmxlinux"), "Json", "SkillData");
const files = readdirSync(skillDir);

describe.each(Object.values(data.kits.operators))("kit $operator", (kit) => {
  it.each(kit.skills.flatMap((s) => s.hits.map((h) => ({ skill: s.skillId, hit: h.id, scale: h.scale }))))(
    "$skill / $hit: every blackboard key appears in the skill's SkillData files",
    ({ skill, scale }) => {
      // The skill's own file plus its projectile hits and ability entities (same name prefix).
      const own = files.filter((f) => f === `${skill}.json` || f.startsWith(`${skill}_`));
      expect(own.length).toBeGreaterThan(0);
      const text = own.map((f) => readFileSync(join(skillDir, f), "utf8")).join("\n");
      for (const key of scale) expect(text).toContain(`"${key}"`);
    },
  );

  it("covers the operator's damage skills", () => {
    const covered = new Set(kit.skills.map((s) => s.skillId));
    const groups = data.operators[kit.operator]?.skillGroups ?? {};
    // Skills in the operator's groups that have an attack multiplier but no kit entry.
    const missing = Object.keys(groups).filter((id) => !covered.has(id) && data.skills[id]?.levels[0]?.blackboard["atk_scale"] !== undefined);
    // Known gaps, kept explicit so new ones show up (reasons in each kit's sources).
    const knownGaps: Record<string, string[]> = {
      // Finisher: BreakingAttackCalculation, not ATK × key.
    };
    expect(missing.sort()).toEqual(knownGaps[kit.operator] ?? []);
  });
});
