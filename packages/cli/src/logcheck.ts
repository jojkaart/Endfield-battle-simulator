// Checks a log fixture: predicts every logged hit that a kit covers from the
// stored build and the logged buff effects, and compares with the real damage.

import { attrModifier, computeHit, computeStats, roundDamage, type GameData, type KitHit, type KitSkill, type Modifier, type SkillType } from "@efsim/engine";
import { isBuffFileListed, readBuffFile, type LogEffect, type LogFixture, type LogHit } from "@efsim/data";

export type HitVerdict =
  | { readonly kind: "match"; readonly hit: LogHit; readonly predicted: number; readonly usedBoundary: boolean; readonly crit: boolean }
  | { readonly kind: "mismatch"; readonly hit: LogHit; readonly predicted: readonly number[]; readonly ratio: number }
  | { readonly kind: "uncovered"; readonly hit: LogHit };

const skillTypeCache = new Map<string, SkillType | null>();

/**
 * Logged effects say zone and element but not skill type. A buff's own
 * attribute modifiers do (attribute 17 = basic attack DMG), so the filter
 * comes from its BuffData file when there is one.
 */
function buffSkillType(buffId: string): SkillType | null {
  const cached = skillTypeCache.get(buffId);
  if (cached !== undefined) return cached;
  let result: SkillType | null = null;
  if (isBuffFileListed(buffId)) {
    const types = new Set(
      (readBuffFile(buffId)?.attributeModifiers ?? []).map((m) => attrModifier(m.attr, 0, "")?.skillType).filter((t) => t !== undefined),
    );
    if (types.size === 1) result = [...types][0] as SkillType;
  }
  skillTypeCache.set(buffId, result);
  return result;
}

export function logModifiers(effects: readonly LogEffect[]): Modifier[] {
  return effects.map((e) => {
    const skillType = buffSkillType(e.buff);
    return {
      zone: e.zone,
      value: e.value,
      ...(e.element ? { element: e.element } : {}),
      ...(skillType ? { skillType } : {}),
      source: `log buff ${e.buff}`,
    };
  });
}

function findHit(data: GameData, operator: string, event: string): [KitSkill, KitHit] | null {
  for (const s of data.kits.operators[operator]?.skills ?? []) {
    for (const h of s.hits) if (h.events.includes(event)) return [s, h];
  }
  return null;
}

export function checkLog(data: GameData, fx: LogFixture): HitVerdict[] {
  const panels = new Map(fx.team.map((b) => [b.operator, { build: b, panel: computeStats(data, b) }]));
  return fx.hits.map((hit): HitVerdict => {
    const found = findHit(data, hit.operator, hit.event);
    const member = panels.get(hit.operator);
    if (!found || !member) return { kind: "uncovered", hit };
    const [skill, kitHit] = found;
    const actual = hit.uncapped ?? hit.value;
    const crits = hit.crit === null ? [false, true] : [hit.crit];
    const predicted: number[] = [];
    for (const usedBoundary of hit.boundaryEffects.length ? [false, true] : [false]) {
      const modifiers = logModifiers(usedBoundary ? [...hit.effects, ...hit.boundaryEffects] : hit.effects);
      for (const crit of crits) {
        const p = roundDamage(
          computeHit(data, member.build, member.panel, { enemy: fx.enemy.id, level: fx.enemy.level }, skill, kitHit, {
            crit: crit ? "always" : "never",
            staggered: false,
            conditions: [],
            modifiers,
          }).exact,
        );
        if (Math.abs(p - actual) <= 1) return { kind: "match", hit, predicted: p, usedBoundary, crit };
        predicted.push(p);
      }
    }
    return { kind: "mismatch", hit, predicted, ratio: actual / (predicted[0] ?? 1) };
  });
}

export function formatLogCheck(data: GameData, fx: LogFixture, verdicts: readonly HitVerdict[]): string {
  const out: string[] = [`${fx.id}: ${fx.provenance.url}`];
  for (const build of fx.team) {
    const mine = verdicts.filter((v) => v.hit.operator === build.operator);
    const count = (k: HitVerdict["kind"]) => mine.filter((v) => v.kind === k).length;
    const name = data.operators[build.operator]?.name ?? build.operator;
    const damage = mine.reduce((s, v) => s + v.hit.value, 0);
    const covered = mine.filter((v) => v.kind !== "uncovered").reduce((s, v) => s + v.hit.value, 0);
    out.push(
      "",
      `${name} (${build.operator}): ${mine.length} hits, ${count("match")} match, ${count("mismatch")} mismatch, ${count("uncovered")} not covered by a kit` +
        ` (${damage ? Math.round((covered / damage) * 100) : 0}% of its damage covered)`,
    );
    for (const v of mine.filter((x) => x.kind === "mismatch")) {
      if (v.kind !== "mismatch") continue;
      out.push(`  MISMATCH t=${v.hit.t} ${v.hit.event}: logged ${v.hit.uncapped ?? v.hit.value}, predicted ${v.predicted.join(" / ")} (ratio ${v.ratio.toFixed(4)})`);
    }
    const uncovered = new Map<string, number>();
    for (const v of mine) if (v.kind === "uncovered") uncovered.set(v.hit.event, (uncovered.get(v.hit.event) ?? 0) + 1);
    for (const [event, k] of [...uncovered].sort()) out.push(`  not covered: ${event} ×${k}`);
  }
  return out.join("\n");
}
