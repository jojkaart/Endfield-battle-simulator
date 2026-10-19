// Kits as a fight uses them: an operator's own kit together with the kits of
// what it wears (effectiveKit), every hit a kit can land, and, for log
// replays, what a logged hit does to the enemy besides damage: its
// own kit entry's effects, and every team member's hit triggers that react
// to it with applications or gains (e.g. Laevatain's talent: the controlled
// operator's Final Strikes absorb Heat Infliction for her Melting Flame).
// The timeline runs triggers itself (timeline.ts runTriggers); this is the
// part of them a replay of logged hits can use.

import type { SkillType } from "./attributes.ts";
import { causeMatches, eventMatches, triggerSkillId, type BattleEvent } from "./events.ts";
import type { Build } from "./build.ts";
import type { GameData, KitApplication, KitHit, OperatorKit, StackGain } from "./model.ts";
import { wornEquipment, type StatPanel } from "./stats.ts";
import { applyBuff, buffModifiers } from "./buffs.ts";
import type { Modifier } from "./effects.ts";
import { EngineError } from "./errors.ts";

export interface HitEffect {
  /** Whose stacks the gains go to. */
  readonly owner: string;
  readonly applies: readonly KitApplication[];
  readonly gains: readonly StackGain[];
  /** The hit's own entry (its skill values resolve forced-reaction keys), or a team member's trigger. */
  readonly own: boolean;
}

/**
 * In order: the hit's own effects, then each team member's hit triggers
 * (team order). Triggers' `if`, cooldowns and count limits aren't judged
 * (a replay has no situation to judge them in). Only the controlled operator
 * does basic attacks, so a basic hit counts as the controlled operator's.
 */
export function hitEffects(teamKits: readonly OperatorKit[], hitter: string, hit: KitHit, skillId = "", kind: SkillType | "none" = hit.damageType, finisher = false): HitEffect[] {
  const out: HitEffect[] = [];
  if (hit.applies?.length || hit.gains?.length) out.push({ owner: hitter, applies: hit.applies ?? [], gains: hit.gains ?? [], own: true });
  const e: BattleEvent = { type: "hit", frame: 0, operator: hitter, skillId, kind, element: hit.element, finalStrike: hit.finalStrike === true, finisher, controlled: kind === "basic" };
  for (const kit of teamKits) {
    const member = kit.operator;
    for (const t of kit.triggers) {
      if (!eventMatches(t.on, e, member, {}) || !causeMatches(t.by, e, member, t.on)) continue;
      const applies = t.do.flatMap((a) => (a.kind === "apply" ? a.applies : []));
      const gains = t.do.flatMap((a) => (a.kind === "gain" ? a.gains : []));
      if (applies.length || gains.length) out.push({ owner: member, applies, gains, own: false });
    }
  }
  return out;
}

/** Every hit a kit can land, with the skill its values come from: its skills' hits, then its triggers' hits. */
export function kitHitEntries(kit: OperatorKit | undefined): { readonly skillId: string; readonly hit: KitHit }[] {
  if (!kit) return [];
  return [
    ...kit.skills.flatMap((s) => s.hits.map((hit) => ({ skillId: s.skillId, hit }))),
    ...kit.triggers.flatMap((t) => t.do.flatMap((a) => (a.kind === "hits" ? a.hits.map((hit) => ({ skillId: triggerSkillId(kit.operator, t), hit })) : []))),
  ];
}

/**
 * An operator's kit with what it wears added: the weapon's and active gear
 * sets' stacks, buffs and triggers act as the operator's own (conditions: availableConditions)
 * (their IDs are prefixed, so they can't clash). Undefined without a kit.
 */
export function effectiveKit(data: GameData, build: Build): OperatorKit | undefined {
  const own = data.kits.operators[build.operator];
  if (!own) return undefined;
  const worn = wornEquipment(data, build).flatMap((id) => data.kits.equipment[id] ?? []);
  if (worn.length === 0) return own;
  return {
    ...own,
    stacks: [...own.stacks, ...worn.flatMap((k) => k.stacks)],
    buffs: [...own.buffs, ...worn.flatMap((k) => k.buffs)],
    triggers: [...own.triggers, ...worn.flatMap((k) => k.triggers)],
  };
}

/**
 * The modifiers one of a build's kit buffs (its own or what it wears) gives
 * the build's hits with `layers` layers, as if applied at frame 0: for
 * static per-hit checks (fixtures, `efsim calc`). Its values come from the
 * skill that applies it in the kit (a hit's skill or a trigger's source).
 */
export function kitBuffModifiers(data: GameData, build: Build, panel: StatPanel, buffId: string, layers = 1): Modifier[] {
  const kit = effectiveKit(data, build);
  const def = kit?.buffs.find((b) => b.id === buffId);
  if (!kit || !def) throw new EngineError(`${build.operator} has no kit buff ${buffId}${kit ? ` (its buffs: ${kit.buffs.map((b) => b.id).join(", ")})` : ""}`);
  const source =
    kit.skills.find((s) => s.hits.some((h) => h.buffs?.some((a) => a.buff === buffId)))?.skillId ??
    kit.triggers.filter((t) => t.do.some((a) => a.kind === "buff" && a.buff === buffId)).map((t) => triggerSkillId(kit.operator, t))[0];
  if (!source) throw new EngineError(`nothing in ${build.operator}'s kit applies ${buffId}`);
  const b = applyBuff(data, build, panel, source, def, 0);
  if (!b) return [];
  const n = Math.min(layers, b.maxLayers ?? 1);
  // A buff a cast consumes counts as consumed by the hit's cast.
  const cast = b.consumedBy ? { cast: 0 } : {};
  return buffModifiers(Array.from({ length: n }, (_, i) => ({ ...b, appliedAt: -i, ...cast })), build.operator, 0, b.consumedBy ? 0 : undefined);
}
