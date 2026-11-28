// efsim kit-census: kit features per operator.

import { unloggedAttachedBuffs } from "@efsim/data";
import type { GameData } from "@efsim/engine";
import { buffFile } from "@efsim/logs";
import { command } from "../command.ts";
import { formatCensus, kitCensus } from "../census.ts";
import { buffCreators, type Creators } from "../gamedata.ts";

/**
 * From the compiled kits: the triggers' cooldowns by the game's mechanism behind each (KitTrigger.cooldownFrom and
 * cooldownClock; cooldown-clock report point 3), and the kit buffs that likely need a loggedAs (kits.ts
 * unloggedAttachedBuffs; backlog after round 11 point 9), and those whose game buff only disabled actions create
 * (deadKitBuffs).
 */
export function compiledCensus(data: GameData, creators: ReadonlyMap<string, Creators> = buffCreators()): string {
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
  // Before the dead kit buffs, which stay the last section (CLAUDE.md "Operator kits" names it so).
  out.push(...layeredLines(data));
  const dead = deadKitBuffs(data, creators);
  out.push(dead.length ? "Kit buffs whose game buff only disabled actions create (isEnable false: a dead effect in the kit?):" : "Kit buffs whose game buff only disabled actions create: none");
  for (const d of dead) out.push(`  ${d.kit} ${d.buff} (game buff ${d.gameBuff}): created only in ${d.disabled.join(", ")}`);
  return out.join("\n");
}

/**
 * The layered kit buffs (maxStacks) by their game buff's BuffData stackingType (round 24, the overlap-clock report
 * point 2: which of them could be a clock of the hidden holds took a scratch script over data.kits): only stackingType
 * 11 (layers on their own timers, listed apart) is one (packages/logs holds.ts notAClock).
 */
export function layeredLines(data: GameData): string[] {
  const by = new Map<string, string[]>();
  for (const [kit, k] of [...Object.entries(data.kits.operators), ...Object.entries(data.kits.equipment)]) {
    for (const b of k.buffs) {
      if (b.maxStacks === undefined) continue;
      const type = b.gameBuff ? buffFile(b.gameBuff)?.stacking?.type : undefined;
      const key = b.gameBuff ? `stackingType ${type ?? "unknown"}` : "no game buff";
      by.set(key, [...(by.get(key) ?? []), `${kit}:${b.id}`]);
    }
  }
  return ["Layered kit buffs (maxStacks) by their game buff's BuffData stackingType (a clock of the hidden holds only at 11: holds.ts notAClock):", ...[...by].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([k, xs]) => `  ${String(xs.length).padStart(3)}  ${k}: ${xs.sort().join(", ")}`)];
}

/**
 * The kit buffs (operators' and equipment's) whose game buff the data creates only in disabled actions (buffCreators:
 * some create action names it, none of them enabled): a kit modelling an effect the game switched off (round 17, the
 * Zhuang Fangyi and Liino report point 4). A game buff no create action names (made by a skill itself, a trigger's
 * own buff) isn't judged.
 */
export function deadKitBuffs(data: GameData, creators: ReadonlyMap<string, Creators>): { readonly kit: string; readonly buff: string; readonly gameBuff: string; readonly disabled: readonly string[] }[] {
  const kits = [...Object.entries(data.kits.operators), ...Object.entries(data.kits.equipment)];
  return kits.flatMap(([kit, k]) =>
    k.buffs.flatMap((b) => {
      const c = b.gameBuff !== undefined ? creators.get(b.gameBuff) : undefined;
      return c && c.enabled === 0 && c.disabled.length ? [{ kit, buff: b.id, gameBuff: b.gameBuff as string, disabled: c.disabled }] : [];
    }),
  );
}

export default command({
  name: "kit-census",
  usage: `  efsim kit-census                        Kit features per operator, for the review after each new kit; then the
                                          triggers' cooldowns by clock and game mechanism, the kit buffs that
                                          likely need a loggedAs (a cast-attached buff with the modifier), the
                                          layered kit buffs by their game buff's stackingType (a clock of the
                                          hidden holds only at 11), and those whose game buff only disabled
                                          actions create (a dead effect)
`,
  options: {},
  run: (ctx) => `${formatCensus(kitCensus())}\n\n${compiledCensus(ctx.data())}`,
});
