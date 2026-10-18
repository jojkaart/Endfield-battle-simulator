// Checks a log fixture: predicts every logged hit that a kit covers from the
// stored build and the logged buff effects, and compares with the real damage.

import {
  attrModifier,
  computeHit,
  computeReaction,
  computeStats,
  corrosionModifier,
  parseReactionEvent,
  roundDamage,
  skillValue,
  type GameData,
  type KitHit,
  type KitSkill,
  type Modifier,
  type SkillType,
  type StatPanel,
} from "@efsim/engine";
import { isBuffFileListed, readBuffFile, type LogEffect, type LogFixture, type LogHit } from "@efsim/data";

export type HitVerdict =
  | { readonly kind: "match"; readonly hit: LogHit; readonly predicted: number; readonly assumed: readonly string[] }
  | { readonly kind: "mismatch"; readonly hit: LogHit; readonly predicted: readonly number[]; readonly ratio: number }
  | { readonly kind: "uncovered"; readonly hit: LogHit }
  /** A covered hit under an effect the log can't quantify and the engine doesn't model yet. */
  | { readonly kind: "unquantified"; readonly hit: LogHit; readonly predicted: number };

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

/**
 * Corrosion's resistance shred, which the log lists without a value: from a
 * Nature burst (natural_natural_corrupt_do) or a Nature reaction onto another
 * infliction (natural_<element>_triggered). Both modify attributes 94–98.
 */
export function isCorrosionBuff(buff: string): boolean {
  return buff === "buff_common_natural_natural_corrupt_do" || /^buff_common_natural_(fire|pulse|cryst)_triggered$/.test(buff);
}

interface Candidate {
  readonly assumed: readonly string[];
  readonly modifiers: readonly Modifier[];
  readonly crit: boolean;
  readonly stacks: number;
}

/** Every combination of what the log leaves open for a hit. */
function candidates(hit: LogHit, panels: ReadonlyMap<string, { panel: StatPanel }>, stackOptions: readonly number[]): Candidate[] {
  const out: Candidate[] = [];
  const corrosion = hit.unquantified.find((u) => isCorrosionBuff(u.buff));
  const corrosionLevels = corrosion ? [1, 2, 3, 4] : [0];
  for (const usedBoundary of hit.boundaryEffects.length ? [false, true] : [false]) {
    const base = logModifiers(usedBoundary ? [...hit.effects, ...hit.boundaryEffects] : hit.effects);
    for (const level of corrosionLevels) {
      const extra: Modifier[] = [];
      const assumed: string[] = usedBoundary ? ["boundary buffs applied"] : [];
      if (corrosion && level > 0) {
        const applierAi = panels.get(corrosion.source)?.panel.attrs[87]?.total ?? 0;
        extra.push(corrosionModifier(level, hit.t - corrosion.since, applierAi));
        assumed.push(`Corrosion level ${level}`);
      }
      for (const crit of hit.crit === null ? [false, true] : [hit.crit]) {
        for (const stacks of stackOptions) {
          out.push({
            assumed: [...assumed, ...(hit.crit === null ? [crit ? "crit" : "no crit"] : []), ...(stackOptions.length > 1 ? [`${stacks} stack(s)`] : [])],
            modifiers: [...base, ...extra],
            crit,
            stacks,
          });
        }
      }
    }
  }
  return out;
}

export function checkLog(data: GameData, fx: LogFixture): HitVerdict[] {
  const panels = new Map(fx.team.map((b) => [b.operator, { build: b, panel: computeStats(data, b) }]));
  const target = { enemy: fx.enemy.id, level: fx.enemy.level };
  return fx.hits.map((hit): HitVerdict => {
    const member = panels.get(hit.operator);
    const reaction = parseReactionEvent(hit.event);
    const found = reaction ? null : findHit(data, hit.operator, hit.event);
    if (!member || (!found && !reaction)) return { kind: "uncovered", hit };
    const actual = hit.uncapped ?? hit.value;
    const stackOptions = reaction && reaction.kind !== "burst" ? [1, 2, 3, 4] : [1];
    const predicted: number[] = [];
    for (const c of candidates(hit, panels, stackOptions)) {
      const options = { crit: c.crit ? ("always" as const) : ("never" as const), staggered: false, conditions: [], modifiers: c.modifiers };
      const result = reaction
        ? computeReaction(data, member.build, member.panel, target, { ...reaction, stacks: c.stacks }, options)
        : computeHit(data, member.build, member.panel, target, (found as [KitSkill, KitHit])[0], (found as [KitSkill, KitHit])[1], options);
      const p = roundDamage(result.exact);
      if (Math.abs(p - actual) <= 1) return { kind: "match", hit, predicted: p, assumed: c.assumed };
      predicted.push(p);
    }
    if (hit.unquantified.some((u) => !isCorrosionBuff(u.buff))) return { kind: "unquantified", hit, predicted: predicted[0] ?? 0 };
    return { kind: "mismatch", hit, predicted: [...new Set(predicted)].slice(0, 6), ratio: actual / (predicted[0] ?? 1) };
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
      `${name} (${build.operator}): ${mine.length} hits, ${count("match")} match, ${count("mismatch")} mismatch, ` +
        `${count("unquantified")} under unmodelled effects, ${count("uncovered")} not covered by a kit` +
        ` (${damage ? Math.round((covered / damage) * 100) : 0}% of its damage covered)`,
    );
    const assumptions = new Map<string, number>();
    for (const v of mine) if (v.kind === "match") for (const a of v.assumed) assumptions.set(a, (assumptions.get(a) ?? 0) + 1);
    if (assumptions.size) out.push(`  matched assuming: ${[...assumptions].map(([a, k]) => `${a} ×${k}`).join(", ")}`);
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

export interface ImpliedScale {
  readonly event: string;
  readonly unquantified: readonly string[];
  readonly t: number;
  readonly crit: boolean | null;
  readonly value: number;
  /** The multiplier this hit must have had, assuming each skill type's damage bonus. */
  readonly bySkillType: Readonly<Record<SkillType, number>>;
}

/**
 * For writing kits: the skill multiplier each logged hit of an operator
 * implies, given the build and the logged buffs (logged damage ÷ damage at
 * multiplier 1). Matching these to SkillPatchTable values tells which key a
 * projectile or ability entity uses.
 */
export function impliedScales(data: GameData, fx: LogFixture, operator: string): ImpliedScale[] {
  const build = fx.team.find((b) => b.operator === operator);
  if (!build) throw new Error(`${operator} isn't in ${fx.id}`);
  const panel = computeStats(data, build);
  const anySkill = Object.keys(data.operators[operator]?.skillGroups ?? {})[0];
  if (!anySkill) throw new Error(`${operator} has no skills`);
  const skill: KitSkill = { skillId: anySkill, label: "", hits: [] };
  return fx.hits
    .filter((h) => h.operator === operator && h.element !== null)
    .map((h) => {
      const bySkillType = {} as Record<SkillType, number>;
      for (const type of ["basic", "battle", "combo", "ultimate"] as const) {
        const hit: KitHit = { id: "x", label: "", scale: [], count: 1, events: [], damageType: type, element: h.element ?? "physical" };
        const unit = computeHit(data, build, panel, { enemy: fx.enemy.id, level: fx.enemy.level }, skill, hit, {
          crit: h.crit ? "always" : "never",
          staggered: false,
          conditions: [],
          modifiers: logModifiers(h.effects),
        }).exact;
        bySkillType[type] = (h.uncapped ?? h.value) / unit;
      }
      return { event: h.event, unquantified: h.unquantified.map((u) => u.buff), t: h.t, crit: h.crit, value: h.uncapped ?? h.value, bySkillType };
    });
}

export interface ScaleMatch {
  readonly event: string;
  readonly hits: number;
  readonly matches: readonly { readonly skillId: string; readonly keys: readonly string[]; readonly damageType: SkillType; readonly corrosion: number; readonly agree: number }[];
}

/**
 * For writing kits: which of the operator's skill values (one key, or a
 * product of two) explain each logged event's damage, per skill type and
 * Corrosion level. `agree` counts the event's hits that value reproduces
 * within ±1.
 */
export function findScales(data: GameData, fx: LogFixture, operator: string): ScaleMatch[] {
  const build = fx.team.find((b) => b.operator === operator);
  const op = data.operators[operator];
  if (!build || !op) throw new Error(`${operator} isn't in ${fx.id}`);
  const panel = computeStats(data, build);
  const panels = new Map(fx.team.map((b) => [b.operator, { panel: computeStats(data, b) }]));
  const target = { enemy: fx.enemy.id, level: fx.enemy.level };
  const values: { skillId: string; key: string; value: number }[] = [];
  for (const skillId of Object.keys(op.skillGroups)) {
    const skill = data.skills[skillId];
    if (!skill) continue;
    const level = skill.levels[build.skillLevels[op.skillGroups[skillId] as SkillType] - 1];
    for (const [key, value] of Object.entries({ ...skill.defaults, ...(level?.blackboard ?? {}) })) {
      if (value > 0 && value < 100) values.push({ skillId, key, value: skillValue(data, panel, build, skillId, key) });
    }
  }
  const byEvent = new Map<string, LogHit[]>();
  for (const h of fx.hits) if (h.operator === operator && h.element && !parseReactionEvent(h.event)) byEvent.set(h.event, [...(byEvent.get(h.event) ?? []), h]);
  const out: ScaleMatch[] = [];
  for (const [event, hits] of [...byEvent].sort()) {
    const tally = new Map<string, { skillId: string; keys: string[]; damageType: SkillType; corrosion: number; agree: number }>();
    for (const hit of hits) {
      for (const damageType of ["basic", "battle", "combo", "ultimate"] as const) {
        const kitHit: KitHit = { id: "x", label: "", scale: [], count: 1, events: [], damageType, element: hit.element ?? "physical" };
        for (const c of candidates(hit, panels, [1])) {
          const unit = computeHit(data, build, panel, target, { skillId: values[0]?.skillId ?? "", label: "", hits: [] }, kitHit, {
            crit: c.crit ? "always" : "never", staggered: false, conditions: [], modifiers: c.modifiers,
          }).exact;
          const need = (hit.uncapped ?? hit.value) / unit;
          const corrosion = Number(/Corrosion level (\d)/.exec(c.assumed.join(" "))?.[1] ?? 0);
          const consider = (skillId: string, keys: string[], v: number) => {
            if (Math.abs(Math.round(unit * v) - (hit.uncapped ?? hit.value)) > 1) return;
            const id = `${skillId}|${keys.join("*")}|${damageType}|${corrosion}`;
            const t = tally.get(id) ?? { skillId, keys, damageType, corrosion, agree: 0 };
            t.agree++;
            tally.set(id, t);
          };
          for (const a of values) {
            consider(a.skillId, [a.key], a.value);
            if (Math.abs(a.value - need) / need > 0.5) continue;
            for (const b of values) if (b.skillId === a.skillId && b.key !== a.key && b.key > a.key) consider(a.skillId, [a.key, b.key], a.value * b.value);
          }
        }
      }
    }
    out.push({ event, hits: hits.length, matches: [...tally.values()].sort((x, y) => y.agree - x.agree).slice(0, 8) });
  }
  return out;
}
