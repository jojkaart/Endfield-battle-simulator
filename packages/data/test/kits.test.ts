// The hand-written kits against the game's own skill files.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData, loadOperatorKitFile, sourceDir } from "../src/index.ts";

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
      // Helpers her trap buffs cast (batch 4 S6), with normal_skill's values: inkmove_2's Fixed DMG burst is the kit's Inksoul
      // trigger hit (it names the file), inkhurt_front deals no damage.
      chr_0036_jsspsi: ["chr_0036_jsspsi_normal_skill_inkhurt_front", "chr_0036_jsspsi_normal_skill_inkmove_2"],
    };
    expect(missing.sort()).toEqual(knownGaps[kit.operator] ?? []);
  });
});

describe("references checked as a kit loads", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "../kits/operators");
  type Raw = { skills: { skillId: string; hits: Record<string, unknown>[] }[]; triggers: { id: string; on: Record<string, unknown> }[] };
  const raw = (op: string) => JSON.parse(readFileSync(join(dir, `${op}.json`), "utf8")) as Raw;
  const hit = (k: Raw, skillId: string, id: string) => k.skills.find((s) => s.skillId === skillId)?.hits.find((h) => h["id"] === id) as Record<string, unknown>;

  it("a log event key names a fetched SkillData or BuffData file", () => {
    const k = raw("chr_0016_laevat");
    hit(k, "chr_0016_laevat_attack4", "hit")["events"] = ["chr_0016_laevat_attack4_no_such_file"];
    expect(() => loadOperatorKitFile(data, "chr_0016_laevat.json", k)).toThrow(/event chr_0016_laevat_attack4_no_such_file is no fetched SkillData or BuffData file/);
  });

  it("an application's keys are the skill's values; scaleKey only on Breach", () => {
    const k = raw("chr_0016_laevat");
    const extra = hit(k, "chr_0016_laevat_normal_skill", "empowered_extra");
    extra["applies"] = [{ kind: "forcedReaction", status: "combustion", durationKey: "no_such_key", scaleKey: "extra_scaling" }];
    expect(() => loadOperatorKitFile(data, "chr_0016_laevat.json", k)).toThrow(/forcedReaction durationKey: chr_0016_laevat_normal_skill has no value no_such_key/);
    extra["applies"] = [{ kind: "physicalStatus", status: "lift", scaleKey: "extra_scaling" }];
    expect(() => loadOperatorKitFile(data, "chr_0016_laevat.json", k)).toThrow(/a lift has no strength for scaleKey/);
  });

  it("a trigger's game buffs are fetched BuffData files", () => {
    const k = raw("chr_0024_deepfin");
    const t = k.triggers.find((x) => x.on["gameBuffs"] !== undefined) as { on: Record<string, unknown> };
    t.on["gameBuffs"] = ["buff_no_such_buff"];
    expect(() => loadOperatorKitFile(data, "chr_0024_deepfin.json", k)).toThrow(/buff_no_such_buff is no fetched BuffData file/);
  });
});
