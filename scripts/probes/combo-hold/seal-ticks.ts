// Probe (scripts/probes/README.md): the enemy-clock round (2026-11-26), docs/open-problems.md "The enemy's clock".
// node scripts/probes/combo-hold/seal-ticks.ts (SHIFT=-3000 for the control windows); writes nothing.
// Per Arcane Imprisonment (seal start = touch − 4 frames): the enemy tick chains running across it, from the last tick
// before (seal − 0.3 s) to the first after (seal + 1.1 s): their world time (placed stops out) less the periods. The
// seal's curve over 1 s would lose about 0.42 s there; no hold, 0. Controls: the same window shifted 3 s earlier.
import { loadGameData } from "@efsim/data";
import { castTimeStops, devFixtures, placeHits, worldMs } from "@efsim/logs";

const data = loadGameData();
const TICK = /^(buff_chr_0028_wulfa_normal_bleed|buff_common_burning_status)$/;
const STAG = "buff_common_poise_break_damage_taken_scale";
const TOUCH = "buff_chr_0032_lizhiyan_combo_skill_seal_total";
const shift = Number(process.env.SHIFT ?? 0);
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"] })) {
  if (!fx.hits.some((h) => TICK.test(h.event))) continue;
  const seals = [...new Set(fx.hits.filter((h) => h.event === TOUCH).map((h) => h.t - 133 + shift))].sort((x, y) => x - y);
  if (!seals.length) continue;
  const stops = castTimeStops(data, placeHits(data, fx).casts);
  const st = [...new Set(fx.hits.filter((h) => [...h.effects, ...h.boundaryEffects].some((e) => e.buff === STAG)).map((h) => h.t))].sort((a, b) => a - b);
  const stagAt = (t: number) => st.some((x) => Math.abs(x - t) < 800);
  const by = new Map<string, number[]>();
  for (const h of fx.hits) if (TICK.test(h.event)) by.set(`${h.operator}|${h.event}`, [...(by.get(`${h.operator}|${h.event}`) ?? []), h.t]);
  for (const s of seals) {
    for (const [k, ts0] of by) {
      const ts = [...new Set(ts0)].sort((a, b) => a - b);
      const before = ts.filter((t) => t <= s - 300).at(-1);
      const after = ts.find((t) => t >= s + 1100);
      if (before === undefined || after === undefined) continue;
      const chain = ts.filter((t) => t >= before && t <= after);
      if (chain.some((t, i) => i > 0 && t - (chain[i - 1] as number) > 2600)) continue;
      if (after - before > 4500) continue;
      const n = chain.length - 1;
      const r = worldMs(before, after, stops) - n * 1000;
      const pairs = chain.slice(1).map((t, i) => (worldMs(chain[i] as number, t, stops) - 1000).toFixed(0)).join(" ");
      process.stdout.write(`${short} seal ${(s / 1000).toFixed(2)} ${k.split("|")[1]?.replace(/^buff_/, "")} ${(before / 1000).toFixed(2)}⇒${(after / 1000).toFixed(2)} (${n}) residual ${r.toFixed(0)} ms [${pairs}]${stagAt(s) ? " STAGGERED" : ""}\n`);
    }
  }
}
