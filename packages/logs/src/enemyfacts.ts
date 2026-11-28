// The enemy facts kits and the engine read that the data may lack (round 22, the Estella-Akekuri report point 2). A
// leaf module (engine types only): the check's head (logcheck.ts), the screen (screen.ts), the importer's message and
// `efsim gamedata enemy` all say them.

import type { GameData } from "@efsim/engine";

/**
 * What the data lacks of an enemy that kits or the engine read (8f32's replay stopped at 44.8 s on Rossi's `enemyRank`
 * condition, which read as 37 unrelated log-listing fallbacks): not in the data at all; no rank
 * (EnemyTemplateDisplayInfoTable: a kit's `enemyRank` can't be decided, the replay stops there); no Stagger nodes; no
 * super armor (`enemySuperArmor`); no name of its own (name = id: often a variant with no display entry). Empty:
 * nothing known missing.
 */
export function missingEnemyFacts(data: Pick<GameData, "enemies">, id: string): string[] {
  const e = data.enemies[id];
  if (!e) return [`${id} isn't in the data (an enemy table the pinned data lacks: towers 21–24 in 2026-11)`];
  return [
    ...(e.rank === undefined ? ["no rank (no display entry: a kit's enemyRank condition can't be decided, and the replay stops there)"] : []),
    ...(e.staggerNodes.length === 0 ? ["no Stagger nodes (poiseKnotPctList empty: none, or not in the data)"] : []),
    ...(e.superArmor === undefined ? ["no super armor (enemySuperArmor can't be decided)"] : []),
    ...(e.name === e.id || e.name === "" ? ["no name of its own (name = id: a variant without a display entry)"] : []),
  ];
}
