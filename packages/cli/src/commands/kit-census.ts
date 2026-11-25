// efsim kit-census: kit features per operator.

import { unloggedAttachedBuffs } from "@efsim/data";
import type { GameData } from "@efsim/engine";
import { command } from "../command.ts";
import { formatCensus, kitCensus } from "../census.ts";

/**
 * From the compiled kits: the triggers' cooldowns by the game's mechanism behind each (KitTrigger.cooldownFrom and
 * cooldownClock; cooldown-clock report point 3), and the kit buffs that likely need a loggedAs (kits.ts
 * unloggedAttachedBuffs; backlog after round 11 point 9).
 */
export function compiledCensus(data: GameData): string {
  const kits = [...Object.values(data.kits.operators), ...Object.values(data.kits.equipment)];
  const counts = new Map<string, number>();
  for (const k of kits) {
    for (const t of k.triggers) {
      if (t.cooldown === undefined) continue;
      const kinds = [...new Set((t.cooldownFrom ?? []).map((x) => x.kind))].sort().join("+");
      const key = `${t.cooldownClock === "world" ? "world" : "raw"}: ${kinds || (t.cooldownClock === "world" ? "the kit's own (no mechanism in the data)" : "no mechanism in the data")}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const out = ["Trigger cooldowns by clock and the game's mechanism (globalCd: AddGlobalCDTimer; cdBuff: a _cd buff; marker: CreateTimedMarker):", ...[...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${String(n).padStart(3)}  ${k}`)];
  const missing = unloggedAttachedBuffs(data.kits);
  out.push(missing.length ? "Kit buffs that likely need a loggedAs (their game buff has no modifier; a source attaches one that has):" : "Kit buffs that likely need a loggedAs: none");
  for (const m of missing) out.push(`  ${m.kit} ${m.buff} (game buff ${m.gameBuff}): ${m.attached.join(", ")}`);
  return out.join("\n");
}

export default command({
  name: "kit-census",
  usage: `  efsim kit-census                        Kit features per operator, for the review after each new kit; then the
                                          triggers' cooldowns by clock and game mechanism, and the kit buffs that
                                          likely need a loggedAs (a cast-attached buff with the modifier)
`,
  options: {},
  run: (ctx) => `${formatCensus(kitCensus())}\n\n${compiledCensus(ctx.data())}`,
});
