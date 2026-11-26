// Bursts and cooldowns round (2026-11-26): each Swordmancer (suit_phy01) wearer's logged physical status hit with the
// cooldown clear (17 s of log time or more since the last proc, or none yet): proc or not, its origin, and the enemy's
// physical-side listing at it and at the hit before (Vulnerable, Fracture, Stagger). Run: node scripts/probes/cooldowns/lifts.ts
import { devFixtures } from "@efsim/logs";

for (const { short, fx } of devFixtures({})) {
  const wearers = fx.team.filter((b) => (b.gear ?? []).filter((g) => String((g as { id?: string }).id ?? g).includes("suit_phy01")).length >= 3).map((b) => b.operator);
  for (const op of wearers) {
    const mine = fx.hits.filter((h) => h.operator === op).sort((a, b) => a.t - b.t);
    const procs = mine.filter((h) => h.event === "buff_equipsuit_physuit_01").map((h) => h.t);
    const seen = new Set<number>();
    for (const h of mine) {
      if (!/^buff_physical_/.test(h.event) || seen.has(h.t)) continue;
      seen.add(h.t);
      const proc = procs.some((p) => Math.abs(p - h.t) <= 50);
      const last = procs.filter((p) => p < h.t - 50).at(-1);
      const since = last === undefined ? Infinity : (h.t - last) / 1000;
      if (since < 17 && !proc) continue;
      const phys = (x: typeof h) => [...x.effects, ...x.boundaryEffects].map((e) => `${e.buff}${(e as { stacks?: number }).stacks ? "x" + (e as { stacks?: number }).stacks : ""}`).filter((b) => /physical|vulner|poise_break|airborne|knock|lift/i.test(b));
      const before = fx.hits.filter((x) => x.t < h.t - 30).sort((a, b) => a.t - b.t).at(-1);
      // The hit that breaks the Stagger bar: it leaves the bar at 0, the last bar shown before it above 0.
      const shownBefore = fx.hits.filter((x) => x.t < h.t && x.poise).sort((a, b) => a.t - b.t).at(-1);
      const breaking = h.poise?.bar === 0 && (shownBefore?.poise?.bar ?? 0) > 0 ? " BREAKING" : "";
      process.stdout.write(`${short} ${op.slice(9)} ${(h.t / 1000).toFixed(2)} ${proc ? "PROC" : "none"}${breaking} since ${since.toFixed(1)} ${h.event} ${h.poise?.origin?.slice(9) ?? ""} at:[${phys(h).join(" ")}] before(${before ? (before.t / 1000).toFixed(2) : "-"}):[${before ? phys(before).join(" ") : ""}]\n`);
    }
  }
}
