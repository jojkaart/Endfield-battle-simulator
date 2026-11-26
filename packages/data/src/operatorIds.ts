// Operator ids from what docs and people call them. Docs, journal entries and the owner name operators by display name
// (Arcane, Gilberta); kits, logs and scripts use ids whose second part is an internal name (chr_0032_lizhiyan,
// chr_0013_aglina). Round 6's hidden-holds agent ran a check on Gilberta's id for Arcane and found nothing: a lookup
// that refuses an ambiguous or unknown name prevents that. `efsim find --operators` prints the whole table.

import type { GameData } from "@efsim/engine/core";

/**
 * The operator id for `nameOrId`: an id as is; else the operator whose display name is it (case-insensitive); else the
 * one whose name has a word starting with it ("Chen" for Chen Qianyu, though Purrchena contains it: briefs name
 * operators by their short names); else the one operator whose name or id contains it. Throws for none or several
 * (naming the candidates).
 */
export function operatorId(data: Pick<GameData, "operators">, nameOrId: string): string {
  const ops = Object.values(data.operators);
  if (data.operators[nameOrId]) return nameOrId;
  const q = nameOrId.toLowerCase();
  const exact = ops.filter((o) => o.name.toLowerCase() === q);
  if (exact.length === 1) return (exact[0] as (typeof ops)[number]).id;
  const word = ops.filter((o) => o.name.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(q)));
  if (!exact.length && word.length === 1) return (word[0] as (typeof ops)[number]).id;
  const part = (exact.length ? exact : ops).filter((o) => o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
  if (part.length === 1) return (part[0] as (typeof ops)[number]).id;
  if (!part.length) throw new Error(`no operator is called or has an id with "${nameOrId}" (efsim find --operators lists them)`);
  throw new Error(`"${nameOrId}" names ${part.length} operators: ${part.map((o) => `${o.name} (${o.id})`).join(", ")}`);
}
