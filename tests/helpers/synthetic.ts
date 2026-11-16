// Test helpers (not a test file): builders for synthetic kits and logs, shared by the log-replay tests so a file split
// in two is one import line, not copied helpers (docs/friction-done round 1).

import type { Build, GameData, KitBuff, KitHit, KitSkill, KitTrigger, OperatorKit } from "@efsim/engine";
import type { LogFixture, LogHit } from "@efsim/logs";

/** The game data with one operator's kit changed: its skills replaced (when given), buffs, stacks and triggers added. */
export function withOperatorKit(data: GameData, operator: string, k: { readonly skills?: KitSkill[]; readonly stacks?: OperatorKit["stacks"]; readonly buffs?: KitBuff[]; readonly triggers?: KitTrigger[] }): GameData {
  const kit = data.kits.operators[operator] as OperatorKit;
  return {
    ...data,
    kits: {
      ...data.kits,
      operators: {
        ...data.kits.operators,
        [operator]: { ...kit, skills: k.skills ?? kit.skills, stacks: [...kit.stacks, ...(k.stacks ?? [])], buffs: [...kit.buffs, ...(k.buffs ?? [])], triggers: [...kit.triggers, ...(k.triggers ?? [])] },
      },
    },
  };
}

/** A kit hit: one `atk_scale` battle hit of Heat, logged under `events`. */
export function kitHit(id: string, events: string[], extra: Partial<KitHit> = {}): KitHit {
  return { id, label: id, scale: ["atk_scale"], count: 1, events, damageType: "battle", element: "fire", ...extra };
}

/** A logged hit of `operator`: a non-crit Heat hit with no listed buffs. */
export function logHitOf(operator: string, t: number, event: string, value: number, extra: Partial<LogHit> = {}): LogHit {
  return { t, operator, event, value, crit: false, element: "fire", effects: [], boundaryEffects: [], unquantified: [], ...extra };
}

/** A synthetic log fixture of `team` against `target`. */
export function syntheticFixture(hits: LogHit[], team: Build[], target: { readonly enemy: string; readonly level: number }): LogFixture {
  return {
    id: "synthetic",
    description: "synthetic log",
    provenance: { source: "test", url: "test", battleId: "test", parserVersion: "test", inGame: true, measured: "test", verifiedAgainst: {}, notes: [] },
    enemy: { id: target.enemy, level: target.level },
    team,
    hits,
  };
}
