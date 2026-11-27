// The views' shared labels (round 17, round 16's own report point 4: endsview.ts needed operatorLabel from query.ts,
// and query.ts the new view's helpers, so they moved into query.ts to dodge an import cycle; each view re-declared the
// seconds format and the short skill id). A leaf module: it imports no other module of the package.

import type { GameData } from "@efsim/engine";

/** An operator's label: its English name, else its id without the chr_NNNN_ prefix. */
export function operatorLabel(data: Pick<GameData, "operators">, op: string): string {
  return data.operators[op]?.name ?? op.replace(/^chr_\d+_/, "");
}

/** A skill id without its operator's chr_NNNN_name_ prefix ("chr_0016_laevat_attack1" → "attack1"). */
export const shortSkill = (id: string) => id.replace(/^chr_\d+_[a-z0-9]+_/, "");

/** A logged time (ms) as seconds to two decimals, the views' time format ("12.34"). */
export const secondsText = (ms: number) => (ms / 1000).toFixed(2);
