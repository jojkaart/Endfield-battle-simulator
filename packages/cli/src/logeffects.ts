// What a battle log lists, as the damage pipeline's modifiers: the log's effects per hit kind (decorate masks, skill
// types from BuffData), counted as the game counts instances (stacking keys, caps), the team's panels and food. The
// log check (logcheck.ts) takes from these only what the engine doesn't model, and compares the rest with the engine.

import { allActions, applyBuff, attrModifier, computeStats, DEFAULT_STAT_OPTIONS, effectiveKit, foodOf, readingDoesNotApply, triggerSkillId, type Build, type GameData, type Modifier, type OperatorKit, type ReactionKind, type SkillType, type StatPanel } from "@efsim/engine";
import { isBuffFileListed, readBuffFile, type LogEffect, type LogFixture, type LogHit, type RawBuffFile } from "@efsim/data";

const skillTypeCache = new Map<string, SkillType | null>();

/**
 * Logged effects say zone and element but not skill type. A buff's own
 * attribute modifiers do (attribute 17 = basic attack DMG), so the filter
 * comes from its BuffData file when there is one.
 */
export function buffSkillType(buffId: string): SkillType | null {
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
export function buffFile(buffId: string): RawBuffFile | null {
  if (!buffCache.has(buffId)) buffCache.set(buffId, isBuffFileListed(buffId) ? readBuffFile(buffId) : null);
  return buffCache.get(buffId) ?? null;
}

/** Whether a buff's damage modifiers reach this kind of hit. Masks with unknown bits or other check types aren't filtered. */
export function maskReaches(buffId: string, category: HitCategory | null): boolean {
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

/** The skill that applies one of a kit's buffs (a hit's skill or a trigger's source), as kitBuffModifiers finds it. */
export function kitBuffSource(kit: OperatorKit, buffId: string): string | undefined {
  return (
    kit.skills.find((s) => s.hits.some((h) => h.buffs?.some((a) => a.buff === buffId)))?.skillId ??
    kit.triggers.filter((t) => allActions(t.do).some((a) => a.kind === "buff" && a.buff === buffId)).map((t) => triggerSkillId(kit.operator, t))[0]
  );
}

/**
 * Caps of layered buffs whose applying skill the ID prefix doesn't find
 * (batch 4 L2: buff_equipsuit_critsuitatk_01 comes from
 * passive_equipsuit_critsuit_01, buff_equipsuit_poisedmg_01_damagebuff from
 * passive_equipsuit_poisebreak_01): after the prefix rule (teamStackCaps,
 * whose answers stand), the kit buff that stands for the game buff
 * (KitBuff.gameBuff) in a team member's kit, what it wears included: its
 * maximum layers (or kept instances) valued from the skill that applies it
 * in the kit. Null when neither knows.
 */
export function kitStackCaps(data: GameData, panels: ReadonlyMap<string, { readonly build: Build; readonly panel: StatPanel }>): StackCap {
  const byPrefix = teamStackCaps([...panels.values()].map((m) => m.panel));
  const cache = new Map<string, number | null>();
  const fromKits = (buffId: string): number | null => {
    for (const { build, panel } of panels.values()) {
      const kit = effectiveKit(data, build);
      for (const def of kit?.buffs ?? []) {
        if (def.gameBuff !== buffId || !kit) continue;
        const source = kitBuffSource(kit, def.id);
        if (!source) continue;
        try {
          const b = applyBuff(data, build, panel, source, def, 0);
          const cap = b?.maxLayers ?? (b?.maxInstances ? b.maxInstances : undefined);
          if (cap !== undefined) return cap;
        } catch (e) {
          if (!readingDoesNotApply(e)) throw e; // its values need a fight
        }
      }
    }
    return null;
  };
  return (buffId, key) => {
    const prefix = byPrefix(buffId, key);
    if (prefix !== null) return prefix;
    if (!cache.has(buffId)) cache.set(buffId, fromKits(buffId));
    return cache.get(buffId) ?? null;
  };
}

export function countedInstances(effects: readonly LogEffect[], cap: StackCap = () => null): LogEffect[] {
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
  return countedInstances(effects.filter((e) => maskReaches(e.buff, category)), cap).map((e) => {
    const skillType = buffSkillType(e.buff);
    return {
      zone: e.zone,
      value: e.value,
      ...(e.element ? { element: e.element } : {}),
      ...(skillType ? { skillType } : {}),
      source: `log buff ${e.buff}`,
      gameBuff: e.buff,
    };
  });
}


/**
 * Corrosion's resistance shred, which the log lists without a value: from a
 * Nature burst (natural_natural_corrupt_do) or a Nature reaction onto another
 * infliction (natural_<element>_triggered; newer logs name the reaction
 * buff_common_natural_triggered, without the consumed element: reactioncheck.ts).
 * Both modify attributes 94–98.
 */
export function isCorrosionBuff(buff: string): boolean {
  return buff === "buff_common_natural_natural_corrupt_do" || /^buff_common_natural(_(fire|pulse|cryst))?_triggered$/.test(buff);
}

/**
 * Food buffs in a log check. Logs don't record a build's food (Build.food),
 * so a fixture's food is set by hand (with a provenance note). Its lines are
 * in the member's panel for its duration from the fight's start (the panel
 * without it afterwards: `at`); a food buff the log does list on a hit
 * (percentage foods: 40d9's Bottled Duskberry Juice, b7b3's Jakub's Legacy)
 * is dropped from the hit's effects when it is the hitter's food
 * (withoutOwnFood), so setting the food doesn't count it twice. Those two
 * fixtures leave food out: the log already lists it.
 */
export function teamPanels(data: GameData, fx: LogFixture): {
  readonly panels: ReadonlyMap<string, { readonly build: Build; readonly panel: StatPanel }>;
  /** A member's build and panel at a hit's time (ms). */
  readonly at: (operator: string, t: number) => { readonly build: Build; readonly panel: StatPanel } | undefined;
} {
  const panels = new Map(fx.team.map((b) => [b.operator, { build: b, panel: computeStats(data, b) }]));
  const ends = new Map(fx.team.flatMap((b) => {
    const food = foodOf(data, b);
    return food ? [[b.operator, { ms: food.duration * 1000, member: { build: b, panel: computeStats(data, b, { ...DEFAULT_STAT_OPTIONS, withoutFood: true }) } }] as const] : [];
  }));
  return {
    panels,
    at: (operator, t) => {
      const end = ends.get(operator);
      return end && t >= end.ms ? end.member : panels.get(operator);
    },
  };
}

/** A hit without the logged effects that are its hitter's food buffs, which the hitter's panel has (teamPanels). */
export function withoutOwnFood(data: GameData, fx: LogFixture, hit: LogHit): LogHit {
  const build = fx.team.find((b) => b.operator === hit.operator);
  const food = build ? foodOf(data, build) : null;
  if (!food || hit.t >= food.duration * 1000) return hit;
  const own = new Set(food.buffs.map((b) => b.buffId));
  const keep = (e: LogEffect) => !own.has(e.buff);
  if (hit.effects.every(keep) && hit.boundaryEffects.every(keep)) return hit;
  return { ...hit, effects: hit.effects.filter(keep), boundaryEffects: hit.boundaryEffects.filter(keep) };
}

/** Above this many boundary buffs (64 subsets), only none or all are tried. A burst that triggers its wearer's weapon and gear-set buffs has six (fixtures/pending/zmdlogs-dbaee23b801d.json t=8391). */
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

/** Above this many combinations of instance counts of repeated boundary buffs, only one buff at a time takes a count between none and all. */
const MAX_BOUNDARY_COUNTS = 64;

/**
 * Subsets of the buffs starting or ending at the hit (grouped by buff, since
 * a buff's effects go together). A buff listed twice with the same effects
 * may be one instance ending as its refresh starts (zmdlogs-b7b3762d5da8
 * t=5688: the Vulnerable susceptibilities), so each subset with such repeats
 * is also tried with them counted once.
 *
 * With `repeats`, instead the readings where a buff listed several times
 * (n instances: its most repeated zone and element) has 1 up to n - 1 of
 * them (its first k effects of each zone and element), in every
 * combination with the other buffs' counts (above MAX_BOUNDARY_COUNTS, one
 * buff at a time, the others none or all): several crits at one instant
 * start several layers, and each hit there sees a different count
 * (fixtures/zmdlogs-4e5e1390085e.json t=13314: three Lupine Scarlet
 * layers, two hits used two of them).
 * Readings that give effects an earlier one gave are left out.
 */
export function boundarySubsets(effects: readonly LogEffect[], repeats = false): { effects: LogEffect[]; label: string | null }[] {
  const buffs = [...new Set(effects.map((e) => e.buff))];
  if (buffs.length === 0) return repeats ? [] : [{ effects: [], label: null }];
  const pick = (chosen: string[]) => {
    const picked = effects.filter((e) => chosen.includes(e.buff));
    const label = chosen.length === 0 ? null : chosen.length === buffs.length ? "boundary buffs applied" : `boundary buffs applied: ${chosen.join(", ")}`;
    const once = collapseRepeats(picked);
    return once.length < picked.length ? [{ effects: picked, label }, { effects: once, label: `${label} (refreshed instances once)` }] : [{ effects: picked, label }];
  };
  const subsets = buffs.length > MAX_BOUNDARY_SUBSET ? [...pick([]), ...pick(buffs)] : Array.from({ length: 1 << buffs.length }, (_, mask) => pick(buffs.filter((_, i) => mask & (1 << i)))).flat();
  if (!repeats) return subsets;
  if (buffs.length > MAX_BOUNDARY_SUBSET) return [];
  const key = (e: LogEffect) => `${e.zone}|${e.element}`;
  const instances = buffs.map((b) => {
    const n = new Map<string, number>();
    for (const e of effects) if (e.buff === b) n.set(key(e), (n.get(key(e)) ?? 0) + 1);
    return Math.max(...n.values());
  });
  if (instances.every((n) => n <= 1)) return [];
  // Count vectors: each buff 0..n instances, at least one strictly between.
  let vectors: number[][] = [[]];
  for (const n of instances) vectors = vectors.flatMap((v) => Array.from({ length: n + 1 }, (_, k) => [...v, k]));
  const between = (v: number[]) => v.filter((k, i) => k > 0 && k < (instances[i] as number)).length;
  const total = instances.reduce((p, n) => p * (n + 1), 1);
  vectors = vectors.filter((v) => between(v) >= 1 && (total <= MAX_BOUNDARY_COUNTS || between(v) === 1));
  const sig = (es: readonly LogEffect[]) => JSON.stringify(es.map((e) => [e.buff, e.zone, e.element, e.value]).sort());
  const seen = new Set(subsets.map((s) => sig(s.effects)));
  const out: { effects: LogEffect[]; label: string | null }[] = [];
  for (const v of vectors) {
    const taken = new Map<string, number>();
    const picked = effects.filter((e) => {
      const i = buffs.indexOf(e.buff);
      const k = `${e.buff}|${key(e)}`;
      const n = taken.get(k) ?? 0;
      taken.set(k, n + 1);
      return n < (v[i] as number);
    });
    const s = sig(picked);
    if (seen.has(s)) continue;
    seen.add(s);
    const parts = buffs.flatMap((b, i) => ((v[i] as number) === 0 ? [] : (v[i] as number) === instances[i] ? [b] : [`${b} ×${v[i]} of ${instances[i]}`]));
    out.push({ effects: picked, label: `boundary buffs applied: ${parts.join(", ")}` });
  }
  return out;
}
