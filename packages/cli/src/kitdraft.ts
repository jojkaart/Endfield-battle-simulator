// efsim kit-draft: a starting kit for an operator from their SkillData files,
// plus which of its event keys appear in the log fixtures.

import type { GameData } from "@efsim/engine";
import { damageSites, operatorSkillFiles, parentSkill } from "@efsim/data";

export function kitDraft(data: GameData, operator: string, loggedEvents: ReadonlyMap<string, number>): string {
  const op = data.operators[operator];
  if (!op) throw new Error(`unknown operator ${operator}`);
  const skillIds = Object.keys(op.skillGroups);
  const bySkill = new Map<string, { file: string; key: string | null; literal: number; count: number; mask: number; within: string }[]>();
  const orphans: string[] = [];
  for (const file of operatorSkillFiles(operator)) {
    const sites = damageSites(file);
    if (sites.length === 0) continue;
    const parent = parentSkill(file, skillIds);
    if (!parent) {
      orphans.push(`${file} (${sites.length} damage actions)`);
      continue;
    }
    const list = bySkill.get(parent) ?? [];
    for (const s of sites) {
      const within = s.within.filter((w) => !["SequenceActionData", "ActionData"].includes(w)).join(">");
      const same = list.find((x) => x.file === file && x.key === s.scaleKey && x.mask === s.decorateMask);
      if (same) same.count++;
      else list.push({ file, key: s.scaleKey, literal: s.scaleLiteral, count: 1, mask: s.decorateMask, within });
    }
    bySkill.set(parent, list);
  }
  const typeOf = (id: string) => op.skillGroups[id] ?? "basic";
  const kit = {
    $schema: "../../../../schemas/kit.schema.json",
    operator,
    sources: [`Draft from rmxlinux Json/SkillData ${operator}_* by efsim kit-draft; verify every hit against a log fixture.`],
    element: op.element,
    skills: [...bySkill].sort().map(([skillId, sites]) => ({
      skillId,
      label: skillId.replace(`${operator}_`, ""),
      damageType: typeOf(skillId),
      hits: sites.map((s, i) => ({
        id: `${s.file.replace(`${skillId}`, "").replace(/^_/, "") || "hit"}${sites.filter((x) => x.file === s.file).length > 1 ? `_${i}` : ""}`,
        scale: [s.key ?? `LITERAL_${s.literal}`],
        events: [s.file],
        note: `${s.count} damage action(s) in ${s.file}, mask ${s.mask}${s.within ? `, within ${s.within}` : ""}; logged ${loggedEvents.get(s.file) ?? 0}×`,
      })),
    })),
  };
  const lines = [JSON.stringify(kit, null, 2)];
  const covered = new Set([...bySkill.values()].flat().map((s) => s.file));
  const notInDraft = [...loggedEvents].filter(([e]) => !covered.has(e));
  if (orphans.length || notInDraft.length) {
    lines.push("", "// Damage files without a parent skill:", ...orphans.map((o) => `//   ${o}`));
    lines.push("// Logged event keys not in the draft:", ...notInDraft.map(([e, n]) => `//   ${e} ×${n}`));
  }
  return lines.join("\n");
}
