// Timed buffs and debuffs from skills (OperatorKit.buffs), as Modifiers
// with an expiry. One implementation for every operator's buffs (design
// principle 15): a kit says which zone, which values (from the game data)
// and for how long; this module resolves the values for the applier and
// says which buffs act on a hit.

import type { Build } from "./build.ts";
import { skillValue } from "./damage.ts";
import type { Modifier } from "./effects.ts";
import { EngineError } from "./errors.ts";
import type { GameData, KitBuff, ValueSpec } from "./model.ts";
import type { StatPanel } from "./stats.ts";
import { FPS } from "./units.ts";

export interface ActiveBuff {
  readonly id: string;
  readonly stackGroup?: string;
  readonly owner: string;
  readonly target: KitBuff["target"];
  readonly appliedAt: number;
  readonly expiresAt: number;
  readonly modifiers: readonly Modifier[];
}

/** A ValueSpec's number for the applier, with `skillId` as the default skill. */
export function resolveValue(data: GameData, build: Build, panel: StatPanel, skillId: string, v: ValueSpec): number {
  if ("literal" in v) return v.literal;
  const skill = v.skill ?? skillId;
  let x = skillValue(data, panel, build, skill, v.key) * (v.scale ?? 1);
  if (v.timesAttr !== undefined) x *= panel.attrs[v.timesAttr]?.total ?? 0;
  if (v.capKey !== undefined) x = Math.min(x, skillValue(data, panel, build, skill, v.capKey));
  return x;
}

/** A kit buff applied at a frame by an operator's hit of `skillId`: values and duration fixed at application. */
export function applyBuff(data: GameData, build: Build, panel: StatPanel, skillId: string, buff: KitBuff, frame: number): ActiveBuff {
  const seconds = resolveValue(data, build, panel, skillId, buff.duration);
  if (!(seconds > 0)) throw new EngineError(`${build.operator} buff ${buff.id}: duration ${seconds} s`);
  const source = `${build.operator} ${buff.label}`;
  const modifiers: Modifier[] = buff.modifiers.flatMap((m) => {
    const value = resolveValue(data, build, panel, skillId, m.value);
    const base = { zone: m.zone, value, source, ...(m.skillType ? { skillType: m.skillType } : {}), ...(m.onlyKinds ? { onlyKinds: m.onlyKinds } : {}) };
    return m.elements ? m.elements.map((element) => ({ ...base, element })) : [base];
  });
  return { id: buff.id, ...(buff.stackGroup ? { stackGroup: buff.stackGroup } : {}), owner: build.operator, target: buff.target, appliedAt: frame, expiresAt: frame + Math.round(seconds * FPS), modifiers };
}

/** Adds a buff, replacing an active instance of the same buff from the same owner. */
export function withBuff(buffs: readonly ActiveBuff[], b: ActiveBuff): ActiveBuff[] {
  return [...buffs.filter((x) => !(x.id === b.id && x.owner === b.owner)), b];
}

/** The modifiers active buffs give an operator's hits at a frame; a stack group counts only its strongest modifier of each kind. */
export function buffModifiers(buffs: readonly ActiveBuff[], operator: string, frame: number): Modifier[] {
  const out: Modifier[] = [];
  const strongest = new Map<string, Modifier>();
  for (const b of buffs) {
    if (!(b.expiresAt > frame && b.appliedAt <= frame && (b.target !== "self" || b.owner === operator))) continue;
    for (const m of b.modifiers) {
      if (!b.stackGroup) {
        out.push(m);
        continue;
      }
      const k = JSON.stringify([b.stackGroup, m.zone, m.element ?? null, m.skillType ?? null, m.onlyKinds ?? null]);
      const cur = strongest.get(k);
      if (!cur || m.value > cur.value) strongest.set(k, m);
    }
  }
  return [...out, ...strongest.values()];
}
