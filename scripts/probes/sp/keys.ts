// Probe (scripts/probes/README.md): team-SP round (2026-11-28): which SP keys the data grants (SkillData spKinds:
// ObtainCostAction costType 1, helpers included) that no kit hit or trigger reads (a skill with no hit `sp` gets its
// `atb` at its first hit): per operator and skill, the key, its value at the top level, and "(none: …)" for a key
// only a potential sets. 2026-11-28: none the logs' fights miss (Pogranichnik's P1 return needs two targets,
// Antal's P3 a kill, Purrchena's atb_return_2 a block and potential_5_atb P5; the Endministrators', Zhuang Fangyi's
// ultimate-variant and Typhoeus's hover returns are 0 in the table).
//
//   node scripts/probes/sp/keys.ts      (writes nothing)
import { loadGameData } from "@efsim/data";
import { allActions, valueKeys, type ValueExpr } from "@efsim/engine";

const data = loadGameData();
for (const [op, kit] of Object.entries(data.kits.operators)) {
  if (!kit) continue;
  const read = new Map<string, Set<string>>();
  const add = (skill: string, v: ValueExpr | undefined) => {
    if (v === undefined) return;
    for (const k of valueKeys(v, skill, "skipTalents")) (read.get(k.skill) ?? read.set(k.skill, new Set()).get(k.skill)!).add(k.key);
  };
  for (const s of kit.skills) {
    const hasSp = s.hits.some((h) => h.sp !== undefined);
    for (const h of s.hits) add(s.skillId, h.sp as ValueExpr | undefined);
    if (!hasSp) add(s.skillId, "atb");
  }
  for (const t of kit.triggers) {
    const skill = t.skill ?? "";
    for (const a of allActions(t.do)) {
      const x = a as unknown as { kind: string; value?: ValueExpr; hits?: { sp?: ValueExpr }[] };
      if (x.kind === "sp") add(skill, x.value);
      if (x.kind === "hits") for (const h of x.hits ?? []) add(skill, h.sp);
    }
  }
  for (const s of kit.skills) {
    const sk = data.skills[s.skillId];
    if (!sk) continue;
    const lv = sk.levels?.[sk.levels.length - 1];
    for (const key of Object.keys(sk.spKinds)) {
      if (read.get(s.skillId)?.has(key)) continue;
      const v = lv?.blackboard?.[key] ?? sk.defaults?.[key];
      process.stdout.write(`${data.operators[op]?.name ?? op} ${s.skillId} ${key}=${v ?? "(none: a potential's?)"} ${sk.spKinds[key]}\n`);
    }
  }
}
