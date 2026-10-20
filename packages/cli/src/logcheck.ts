// Checks a log fixture: predicts every logged hit that a kit covers from the
// stored build and the logged buff effects, and compares with the real damage.

import {
  Attr,
  attrModifier,
  computeHit,
  computeReaction,
  effectiveKit,
  hitAvailable,
  kitBuffModifiers,
  kitHitEntries,
  type Build,
  computeStats,
  corrosionModifier,
  parseReactionEvent,
  roundDamage,
  skillValue,
  FPS,
  SNAPSHOT_ZONES,
  STATUS_FRAMES,
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
/** A cap the applying skill sets (BuffData useMaxStackCntKey), when the checker can find that skill: null if not. */
export type StackCap = (buffId: string, key: string) => number | null;

/**
 * Caps from the team's sources: the skill that applies a buff is taken to be
 * the source whose ID, without its `sk_` / `passive_` prefix and
 * underscores, starts the buff's ID without `buff_` (passive_equipsuit_spellburst01
 * → buff_equipsuit_spellburst_01_physpellup; sk_wpn_lance_0014 →
 * buff_wpn_lance_0014_damageup).
 */
export function teamStackCaps(panels: readonly StatPanel[]): StackCap {
  const norm = (id: string) => id.replace(/^(sk_|passive_|buff_)/, "").replace(/_/g, "");
  return (buffId, key) => {
    const b = norm(buffId);
    for (const p of panels) for (const [id, bb] of Object.entries(p.sources)) if (b.startsWith(norm(id)) && bb[key] !== undefined) return bb[key] as number;
    return null;
  };
}

function countedInstances(effects: readonly LogEffect[], cap: StackCap = () => null): LogEffect[] {
  const groups = new Map<string, LogEffect[]>();
  for (const e of effects) {
    // Strongest-only buffs of different files with one stacking key are one buff (BuffData stackingKey).
    const st = buffFile(e.buff)?.stacking;
    const k = `${st?.type === 1 && st.key ? `key:${st.key}` : e.buff}|${e.zone}|${e.element}`;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const out: LogEffect[] = [];
  for (const g of groups.values()) {
    const stacking = buffFile((g[0] as LogEffect).buff)?.stacking;
    const sorted = [...g].sort((a, b) => b.value - a.value);
    const keyed = stacking?.maxStacksKey ? cap((g[0] as LogEffect).buff, stacking.maxStacksKey) : null;
    const limit = stacking?.type === 1 ? 1 : (stacking?.maxStacks ?? keyed ?? sorted.length);
    out.push(...sorted.slice(0, limit));
  }
  return out;
}

export function logModifiers(effects: readonly LogEffect[], category: HitCategory | null = null, cap?: StackCap): Modifier[] {
  return countedInstances(effects.filter((e) => reaches(e.buff, category)), cap).map((e) => {
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

/** Above this many boundary buffs (64 subsets), only none or all are tried. A burst that triggers its wearer's weapon and gear-set buffs has six (fixtures/zmdlogs-dbaee23b801d.json t=8391). */
const MAX_BOUNDARY_SUBSET = 6;

/** Effects with repeats of the same buff, zone, element and value kept once. */
function collapseRepeats(effects: readonly LogEffect[]): LogEffect[] {
  const seen = new Set<string>();
  return effects.filter((e) => {
    const k = `${e.buff}|${e.zone}|${e.element}|${e.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Subsets of the buffs starting or ending at the hit (grouped by buff, since
 * a buff's effects go together). A buff listed twice with the same effects
 * may be one instance ending as its refresh starts (zmdlogs-b7b3762d5da8
 * t=5688: the Vulnerable susceptibilities), so each subset with such repeats
 * is also tried with them counted once.
 */
export function boundarySubsets(effects: readonly LogEffect[]): { effects: LogEffect[]; label: string | null }[] {
  const buffs = [...new Set(effects.map((e) => e.buff))];
  if (buffs.length === 0) return [{ effects: [], label: null }];
  const pick = (chosen: string[]) => {
    const picked = effects.filter((e) => chosen.includes(e.buff));
    const label = chosen.length === 0 ? null : chosen.length === buffs.length ? "boundary buffs applied" : `boundary buffs applied: ${chosen.join(", ")}`;
    const once = collapseRepeats(picked);
    return once.length < picked.length ? [{ effects: picked, label }, { effects: once, label: `${label} (refreshed instances once)` }] : [{ effects: picked, label }];
  };
  if (buffs.length > MAX_BOUNDARY_SUBSET) return [...pick([]), ...pick(buffs)];
  return Array.from({ length: 1 << buffs.length }, (_, mask) => pick(buffs.filter((_, i) => mask & (1 << i)))).flat();
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

/**
 * ZMDLogs doesn't log the buffs a cast consumes and then carries on its own
 * hits (KitBuff.consumedBy: Jade Vessel's buff_wpn_claym_0018_normal_skill_comboimbue_atk,
 * Type 50 Yinglung's buff_equipsuit_atk_02_addcombodamage_buff), so for a
 * hit of a kind such buffs act on, every combination of them is tried: each
 * absent or with 1 up to its maximum layers. The first option is none.
 */
function unloggedCastBuffs(data: GameData, build: Build, panel: StatPanel, kind: SkillType | "none"): { label: string | null; modifiers: Modifier[] }[] {
  const defs = (effectiveKit(data, build)?.buffs ?? []).filter((b) => kind !== "none" && b.consumedBy?.includes(kind));
  let out: { label: string | null; modifiers: Modifier[] }[] = [{ label: null, modifiers: [] }];
  for (const def of defs) {
    const layers: { n: number; modifiers: Modifier[]; total: number }[] = [];
    for (let n = 1; n <= 8; n++) {
      const modifiers = kitBuffModifiers(data, build, panel, def.id, n);
      const total = modifiers.reduce((sum, m) => sum + m.value, 0);
      // Past its maximum, more layers change nothing.
      if (modifiers.length === 0 || (layers.length && total === (layers.at(-1) as { total: number }).total)) break;
      layers.push({ n, modifiers, total });
    }
    out = out.flatMap((o) => [o, ...layers.map((l) => ({ label: [o.label, `${def.id}${l.n > 1 ? ` ×${l.n}` : ""}`].filter((x) => x).join(", "), modifiers: [...o.modifiers, ...l.modifiers] }))]);
  }
  return out.map((o) => (o.label ? { ...o, label: `unlogged ${o.label}` } : o));
}

/** Whether a kit hit is a finisher's (SkillData skillSpecification 8), as the timeline judges it: a skill's own hit, not a trigger's. */
function isFinisher(data: GameData, build: Build, skillId: string, hit: KitHit): boolean {
  return data.skills[skillId]?.timing?.specification === 8 && (effectiveKit(data, build)?.skills ?? []).some((s) => s.skillId === skillId && s.hits.includes(hit));
}

/** The finisher multiplier (the enemy's BreakingAttackDamageTakenScalar, attribute 27) as the timeline applies it; ZMDLogs doesn't list it. */
function finisherModifier(data: GameData, enemy: string): Modifier {
  const attr = Attr.BreakingAttackDamageTakenScalar;
  const v = data.enemies[enemy]?.staticAttrs[attr] ?? data.attributeDefaults[attr] ?? 1;
  return { zone: "multiplicative", value: v - 1, source: "Finisher" };
}

/** An assumption about a whole hit the log leaves open: what it adds and how the report names it. */
export interface Variant {
  readonly label: string | null;
  readonly modifiers: readonly Modifier[];
  /** Layer counts of layered buffs the log lists once, by buff. */
  readonly layers: ReadonlyMap<string, number>;
}

const NO_VARIANT: Variant = { label: null, modifiers: [], layers: new Map() };

/** Every pair of a variant of each list, the first of each first. */
function combine(a: readonly Variant[], b: readonly Variant[]): Variant[] {
  return a.flatMap((x) =>
    b.map((y) => ({
      label: [x.label, y.label].filter((l) => l).join(", ") || null,
      modifiers: [...x.modifiers, ...y.modifiers],
      layers: new Map([...x.layers, ...y.layers]),
    })),
  );
}

/**
 * Enemy-side team auras a kit writes on an enemy buff, which ZMDLogs doesn't
 * list: a kit buff on the enemy whose game buff the log never names, with a
 * modifier whose value is a talent's. The Endministrator's talent 2
 * (buff_chr_0003_endminf_talent_0, an aura on the team: Physical DMG Taken
 * +dmg against enemies carrying her crystals) is written on her
 * `originium_crystals`; in 7e19489ae503 every hit on the sealed enemy is
 * ×1.2 of the prediction without it. The log doesn't say when the crystals
 * are on, so each is tried absent first, then present, as cast-consumed
 * buffs are.
 */
export function unloggedEnemyAuras(data: GameData, fx: LogFixture, panels: ReadonlyMap<string, { readonly build: Build; readonly panel: StatPanel }>): Variant[] {
  const listed = new Set(fx.hits.flatMap((h) => [...h.effects, ...h.boundaryEffects, ...h.unquantified].map((e) => e.buff)));
  let out: Variant[] = [NO_VARIANT];
  for (const { build, panel } of panels.values()) {
    for (const def of effectiveKit(data, build)?.buffs ?? []) {
      if (def.target !== "enemy" || (def.gameBuff !== undefined && listed.has(def.gameBuff))) continue;
      if (!def.modifiers.some((m) => typeof m.value === "object" && "talent" in m.value)) continue;
      let modifiers: Modifier[];
      try {
        modifiers = kitBuffModifiers(data, build, panel, def.id, 1);
      } catch {
        continue; // nothing in the kit applies it, or its values need a fight
      }
      if (modifiers.length > 0) out = combine(out, [NO_VARIANT, { label: `unlogged enemy buff ${def.id} (${build.operator})`, modifiers, layers: new Map() }]);
    }
  }
  return out;
}

/**
 * ZMDLogs lists a layered buff (BuffData stackingType 8, layers on one
 * timer) once, with one layer's value, however many layers it has: Chen's
 * buff_chr_0005_chen_talent_0_1 in 7e19489ae503 is one 0.08 entry while
 * her ultimate slashes rise a layer (+3.5%) each. Such a buff listed once
 * at a hit is tried at 1 up to its maximum layers (its literal maxStackCnt,
 * or the cap the applying skill sets), 1 first, as unlogged cast buffs are.
 */
export function layerVariants(hit: LogHit, cap: StackCap = () => null): Variant[] {
  const all = [...hit.effects, ...hit.boundaryEffects];
  const counts = new Map<string, number>();
  for (const e of all) counts.set(`${e.buff}|${e.zone}|${e.element}`, (counts.get(`${e.buff}|${e.zone}|${e.element}`) ?? 0) + 1);
  let out: Variant[] = [NO_VARIANT];
  for (const buff of new Set(all.map((e) => e.buff))) {
    const st = buffFile(buff)?.stacking;
    if (st?.type !== 8 || [...counts].some(([k, n]) => k.startsWith(`${buff}|`) && n !== 1)) continue;
    const max = st.maxStacks ?? (st.maxStacksKey ? cap(buff, st.maxStacksKey) : null);
    if (max === null || max <= 1) continue;
    const layers = Array.from({ length: max - 1 }, (_, i): Variant => ({ label: `${buff} ×${i + 2} layers`, modifiers: [], layers: new Map([[buff, i + 2]]) }));
    out = combine(out, [NO_VARIANT, ...layers]);
  }
  return out;
}

/** The hit with each listed-once layered buff's effects at the variant's layer count. */
function withLayers(hit: LogHit, layers: ReadonlyMap<string, number>): LogHit {
  if (layers.size === 0) return hit;
  const scale = (e: LogEffect): LogEffect => {
    const n = layers.get(e.buff);
    return n === undefined ? e : { ...e, value: e.value * n };
  };
  return { ...hit, effects: hit.effects.map(scale), boundaryEffects: hit.boundaryEffects.map(scale) };
}

/**
 * The logged hit a Combustion tick keeps its attacker side from (effects.ts
 * SNAPSHOT_ZONES): the latest Heat reaction's initial hit by the tick's
 * operator within a Combustion's duration before it, or null (a forced
 * Combustion has no initial hit: the tick's own effects are used).
 */
function combustionSource(fx: LogFixture, tick: LogHit): LogHit | null {
  const ms = ((STATUS_FRAMES.combustion[0] as number) / FPS) * 1000;
  let found: LogHit | null = null;
  for (const h of fx.hits) {
    const r = parseReactionEvent(h.event);
    if (h.operator === tick.operator && r?.kind === "reaction" && r.element === "fire" && h.t <= tick.t && tick.t - h.t <= ms && (!found || h.t >= found.t)) found = h;
  }
  return found;
}

export function checkLog(data: GameData, fx: LogFixture): HitVerdict[] {
  const panels = new Map(fx.team.map((b) => [b.operator, { build: b, panel: computeStats(data, b) }]));
  const target = { enemy: fx.enemy.id, level: fx.enemy.level };
  const caps = teamStackCaps([...panels.values()].map((m) => m.panel));
  const auras = unloggedEnemyAuras(data, fx, panels);
  const finisher = finisherModifier(data, fx.enemy.id);
  return fx.hits.map((hit): HitVerdict => {
    const member = panels.get(hit.operator);
    const reaction = parseReactionEvent(hit.event);
    const found = reaction || !member ? [] : findHits(data, member.build, hit.event);
    if (!member || (found.length === 0 && !reaction)) return { kind: "uncovered", hit };
    const actual = hit.uncapped ?? hit.value;
    const stackOptions = reaction && reaction.kind !== "burst" ? [1, 2, 3, 4] : [1];
    // A Combustion tick's attacker side is its application's (takeAtkSnapshot; fixtures/zmdlogs-4e5e1390085e.json 66004–68449 ms).
    const snapshotFrom = reaction?.kind === "combustionTick" ? combustionSource(fx, hit) : null;
    const predicted: number[] = [];
    // Whole-hit assumptions (enemy auras the log doesn't list, layers of a buff it lists once), the plain reading first:
    // a hit that matches without them keeps matching as before.
    for (const variant of combine(auras, layerVariants(hit, caps))) {
      for (const c of candidates(withLayers(hit, variant.layers), panels, stackOptions)) {
        const logged = (category: HitCategory) =>
          snapshotFrom
            ? [...logModifiers(c.effects, category, caps).filter((m) => !SNAPSHOT_ZONES.has(m.zone)), ...logModifiers(snapshotFrom.effects, category, caps).filter((m) => SNAPSHOT_ZONES.has(m.zone))]
            : logModifiers(c.effects, category, caps);
        const options = (category: HitCategory) => ({
          crit: c.crit ? ("always" as const) : ("never" as const), staggered: false, conditions: [], modifiers: [...logged(category), ...c.extra, ...variant.modifiers],
        });
        const results = reaction
          ? [{ label: null, r: computeReaction(data, member.build, member.panel, target, { ...reaction, stacks: c.stacks }, options(reaction.kind)) }]
          : found
              .filter(([s, h]) => hitAvailable(data, member.build, member.panel, s.skillId, h, { team: fx.team }))
              .flatMap(([s, h]) =>
                // A hit whose conditions or extra scale depend on what the log doesn't record (inflictions, stacks): try both outcomes;
                // one whose values read the count of the event behind it (Si's combo): try counts 1-4; buffs its cast would carry unlogged: try them.
                // A finisher takes the enemy's finisher multiplier, as in the timeline.
                unloggedCastBuffs(data, member.build, member.panel, h.damageType).flatMap((unlogged) =>
                  (h.extraScale?.length || h.if ? [false, true] : [false]).flatMap((assume) =>
                    (JSON.stringify(h).includes('"eventCount"') ? [1, 2, 3, 4] : [undefined]).flatMap((eventCount) => {
                      try {
                        const situation = { team: fx.team, ...(eventCount !== undefined ? { eventCount } : {}) };
                        const base = options(h.reaction?.kind ?? h.damageType);
                        const own = isFinisher(data, member.build, s.skillId, h) ? [finisher] : [];
                        const r = computeHit(data, member.build, member.panel, target, s, h, { ...base, modifiers: [...base.modifiers, ...unlogged.modifiers, ...own], situation, assumeUnknown: assume });
                        const label = [found.length > 1 ? `kit hit ${h.id}` : null, assume ? "situational parts assumed" : null, eventCount !== undefined ? `event count ${eventCount}` : null, unlogged.label].filter((x) => x).join(", ");
                        return [{ label: label || null, r }];
                      } catch {
                        return []; // the hit doesn't happen under this assumption
                      }
                    }),
                  ),
                ),
              );
        for (const { label, r } of results) {
          const p = roundDamage(r.exact);
          if (Math.abs(p - actual) <= 1) return { kind: "match", hit, predicted: p, assumed: [...c.assumed, ...[label, variant.label].filter((l) => l !== null)] };
          predicted.push(p);
        }
      }
    }
    // Corrosion's ramp doesn't fit every log yet (time dilation may pause its ticks; talents change its cap and
    // duration): a hit under Corrosion that matches no level counts as under an unmodelled effect, not a mismatch.
    if (hit.unquantified.length > 0) return { kind: "unquantified", hit, predicted: predicted[0] ?? 0 };
    // Fixed DMG that a fight computes (Si's recorded damage) can't be judged from one logged hit.
    if (found.some(([, h]) => h.fixedDamage !== undefined)) return { kind: "unquantified", hit, predicted: predicted[0] ?? 0 };
    // A status hit by an operator without a kit: its talents and potentials (which can change its statuses) aren't modelled.
    if (reaction && !data.kits.operators[hit.operator]) return { kind: "unquantified", hit, predicted: predicted[0] ?? 0 };
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
