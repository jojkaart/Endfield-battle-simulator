// Checks a log fixture: predicts every logged hit that a kit covers from the
// stored build and the logged buff effects, and compares with the real damage.

import {
  attrModifier,
  computeHit,
  computeReaction,
  effectiveKit,
  hitAvailable,
  kitHitEntries,
  type Build,
  computeStats,
  corrosionModifier,
  parseReactionEvent,
  roundDamage,
  skillValue,
  type GameData,
  type KitHit,
  type KitSkill,
  type Modifier,
  type ReactionKind,
  type SkillType,
  type StatPanel,
} from "@efsim/engine";
import { isBuffFileListed, readBuffFile, type LogEffect, type LogFixture, type LogHit, type RawBuffFile } from "@efsim/data";

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

/** What kind of damage a hit is, for buffs limited to some kinds (BuffData decorate masks). */
export type HitCategory = SkillType | "none" | ReactionKind;

/**
 * Decorate-mask bits whose meaning is established: the skill types (from
 * SkillData DamageActions: basic attacks 128, battle skill 256, ultimate
 * 512, combo 8192) and Arts Burst (33554432: Typhoeus's combo debuff only
 * raises bursts, btl_upload_dbaee23b801d).
 */
const MASK_BITS: Readonly<Record<string, number>> = { basic: 128, battle: 256, ultimate: 512, combo: 8192, burst: 33554432 };
const KNOWN_MASK = Object.values(MASK_BITS).reduce((a, b) => a | b, 0);

const buffCache = new Map<string, RawBuffFile | null>();
function buffFile(buffId: string): RawBuffFile | null {
  if (!buffCache.has(buffId)) buffCache.set(buffId, isBuffFileListed(buffId) ? readBuffFile(buffId) : null);
  return buffCache.get(buffId) ?? null;
}

/** Whether a buff's damage modifiers reach this kind of hit. Masks with unknown bits or other check types aren't filtered. */
function reaches(buffId: string, category: HitCategory | null): boolean {
  const m = buffFile(buffId)?.damageMask;
  if (!m || m.checkType !== 2 || (m.mask & ~KNOWN_MASK) !== 0 || category === null) return true;
  return ((MASK_BITS[category] ?? 0) & m.mask) !== 0;
}

/**
 * Logged instances as the game counts them: a priority-keyed buff
 * (stackingType 1, "effects of the same name don't stack") counts only its
 * strongest instance, and a buff with a literal maximum stack count counts at
 * most that many.
 */
function countedInstances(effects: readonly LogEffect[]): LogEffect[] {
  const groups = new Map<string, LogEffect[]>();
  for (const e of effects) {
    const k = `${e.buff}|${e.zone}|${e.element}`;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const out: LogEffect[] = [];
  for (const g of groups.values()) {
    const stacking = buffFile((g[0] as LogEffect).buff)?.stacking;
    const sorted = [...g].sort((a, b) => b.value - a.value);
    const limit = stacking?.type === 1 ? 1 : (stacking?.maxStacks ?? sorted.length);
    out.push(...sorted.slice(0, limit));
  }
  return out;
}

export function logModifiers(effects: readonly LogEffect[], category: HitCategory | null = null): Modifier[] {
  return countedInstances(effects.filter((e) => reaches(e.buff, category))).map((e) => {
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

/** Every kit hit a logged event key could be (a key can stand for several hits, e.g. two hits of one attack). */
function findHits(data: GameData, build: Build, event: string): [{ skillId: string }, KitHit][] {
  return kitHitEntries(effectiveKit(data, build)).filter((e) => e.hit.events.includes(event)).map((e) => [{ skillId: e.skillId }, e.hit]);
}

/** Above this many boundary buffs, only none or all are tried. */
const MAX_BOUNDARY_SUBSET = 4;

/** Subsets of the buffs starting or ending at the hit (grouped by buff, since a buff's effects go together). */
export function boundarySubsets(effects: readonly LogEffect[]): { effects: LogEffect[]; label: string | null }[] {
  const buffs = [...new Set(effects.map((e) => e.buff))];
  if (buffs.length === 0) return [{ effects: [], label: null }];
  const pick = (chosen: string[]) => ({
    effects: effects.filter((e) => chosen.includes(e.buff)),
    label: chosen.length === 0 ? null : chosen.length === buffs.length ? "boundary buffs applied" : `boundary buffs applied: ${chosen.join(", ")}`,
  });
  if (buffs.length > MAX_BOUNDARY_SUBSET) return [pick([]), pick(buffs)];
  return Array.from({ length: 1 << buffs.length }, (_, mask) => pick(buffs.filter((_, i) => mask & (1 << i))));
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
  /** Logged effects taken as active; they become modifiers per hit category (logModifiers). */
  readonly effects: readonly LogEffect[];
  /** Modelled extras, e.g. Corrosion. */
  readonly extra: readonly Modifier[];
  readonly crit: boolean;
  readonly stacks: number;
}

/** Every combination of what the log leaves open for a hit. */
function candidates(hit: LogHit, panels: ReadonlyMap<string, { panel: StatPanel }>, stackOptions: readonly number[]): Candidate[] {
  const out: Candidate[] = [];
  const corrosion = hit.unquantified.find((u) => isCorrosionBuff(u.buff));
  const corrosionLevels = corrosion ? [1, 2, 3, 4] : [0];
  for (const boundary of boundarySubsets(hit.boundaryEffects)) {
    const effects = [...hit.effects, ...boundary.effects];
    for (const level of corrosionLevels) {
      const extra: Modifier[] = [];
      const assumed: string[] = boundary.label ? [boundary.label] : [];
      if (corrosion && level > 0) {
        const applierAi = panels.get(corrosion.source)?.panel.attrs[87]?.total ?? 0;
        extra.push(corrosionModifier(level, hit.t - corrosion.since, applierAi));
        assumed.push(`Corrosion level ${level}`);
      }
      for (const crit of hit.crit === null ? [false, true] : [hit.crit]) {
        for (const stacks of stackOptions) {
          out.push({
            assumed: [...assumed, ...(hit.crit === null ? [crit ? "crit" : "no crit"] : []), ...(stackOptions.length > 1 ? [`${stacks} stack(s)`] : [])],
            effects,
            extra,
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
    const found = reaction || !member ? [] : findHits(data, member.build, hit.event);
    if (!member || (found.length === 0 && !reaction)) return { kind: "uncovered", hit };
    const actual = hit.uncapped ?? hit.value;
    const stackOptions = reaction && reaction.kind !== "burst" ? [1, 2, 3, 4] : [1];
    const predicted: number[] = [];
    for (const c of candidates(hit, panels, stackOptions)) {
      const options = (category: HitCategory) => ({
        crit: c.crit ? ("always" as const) : ("never" as const), staggered: false, conditions: [], modifiers: [...logModifiers(c.effects, category), ...c.extra],
      });
      const results = reaction
        ? [{ label: null, r: computeReaction(data, member.build, member.panel, target, { ...reaction, stacks: c.stacks }, options(reaction.kind)) }]
        : found
            .filter(([s, h]) => hitAvailable(data, member.build, member.panel, s.skillId, h, { team: fx.team }))
            .flatMap(([s, h]) =>
              // A hit whose conditions or extra scale depend on what the log doesn't record (inflictions, stacks): try both outcomes.
              (h.extraScale?.length || h.if ? [false, true] : [false]).flatMap((assume) => {
                try {
                  const r = computeHit(data, member.build, member.panel, target, s, h, { ...options(h.reaction?.kind ?? h.damageType), situation: { team: fx.team }, assumeUnknown: assume });
                  return [{ label: [found.length > 1 ? `kit hit ${h.id}` : null, assume ? "situational parts assumed" : null].filter((x) => x).join(", ") || null, r }];
                } catch {
                  return []; // the hit doesn't happen under this assumption
                }
              }),
            );
      for (const { label, r } of results) {
        const p = roundDamage(r.exact);
        if (Math.abs(p - actual) <= 1) return { kind: "match", hit, predicted: p, assumed: label ? [...c.assumed, label] : c.assumed };
        predicted.push(p);
      }
    }
    // Corrosion's ramp doesn't fit every log yet (time dilation may pause its ticks; talents change its cap and
    // duration): a hit under Corrosion that matches no level counts as under an unmodelled effect, not a mismatch.
    if (hit.unquantified.length > 0) return { kind: "unquantified", hit, predicted: predicted[0] ?? 0 };
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
  const skill: KitSkill = { skillId: anySkill, label: "", kind: "basic", hits: [] };
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
          modifiers: logModifiers(h.effects, type),
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
          const unit = computeHit(data, build, panel, target, { skillId: values[0]?.skillId ?? "" }, kitHit, {
            crit: c.crit ? "always" : "never", staggered: false, conditions: [], modifiers: [...logModifiers(c.effects, damageType), ...c.extra],
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
