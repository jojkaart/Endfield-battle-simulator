// Probe (scripts/probes/README.md): buff-clock round (2026-11-22): enemy tick series' holds inside and outside the Stagger.
// Promoted from that round's scratch/bc/tickstag.ts unchanged but for this header; run it from the repository root.
// Hidden holds in enemy tick series against the enemy's Stagger: a Staggered enemy doesn't attack, so a perfect dodge
// (and its 0.512 s world slow-down) can't happen then. Free tick pairs (no placed stop between): residual over 1 s,
// whether the pair lies inside the log's Stagger (hits listing buff_common_poise_break_damage_taken_scale).
import { loadGameData } from "@efsim/data";
import { castTimeStops, devFixtures, loggedStaggerSpans, placeHits } from "@efsim/logs";

const data = loadGameData();
const TICK = /^(buff_chr_0028_wulfa_normal_bleed|buff_common_burning_status)$/;
const tally = { stag: { hold: 0, none: 0 }, free: { hold: 0, none: 0 } };
const holds: string[] = [];
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending", "multi"] })) {
  if (!fx.hits.some((h) => TICK.test(h.event))) continue;
  const stops = castTimeStops(data, placeHits(data, fx).casts);
  // Stagger intervals: runs of hits listing it, merged when under 1.5 s apart (query.ts loggedStaggerSpans, round 13).
  const spans = loggedStaggerSpans(fx);
  const inStag = (a: number, b: number) => spans.some((x) => x.from <= a && b <= x.to);
  const by = new Map<string, number[]>();
  for (const h of fx.hits) if (TICK.test(h.event)) by.set(`${h.operator}|${h.event}|${h.target ?? ""}`, [...(by.get(`${h.operator}|${h.event}|${h.target ?? ""}`) ?? []), h.t]);
  for (const ts0 of by.values()) {
    const ts = [...new Set(ts0)].sort((a, b) => a - b);
    for (let i = 1; i < ts.length; i++) {
      const [a, b] = [ts[i - 1] as number, ts[i] as number];
      if (b - a > 2600 || b - a < 500) continue;
      const fa = Math.round((a * 30) / 1000), fb = Math.round((b * 30) / 1000);
      if (stops.some((s) => s.start < fb && s.start + s.scales.length > fa)) continue;
      const r = b - a - 1000;
      const s = inStag(a, b) ? "stag" : "free";
      if (r >= 300) {
        tally[s].hold++;
        holds.push(`${short} ${(a / 1000).toFixed(2)}→${(b / 1000).toFixed(2)} +${r} ms ${s === "stag" ? "STAGGERED" : ""}`);
      } else if (Math.abs(r) <= 150) tally[s].none++;
    }
  }
}
process.stdout.write(`free tick pairs (no placed stop): in Stagger ${tally.stag.hold} with a hold ≥ 0.3 s, ${tally.stag.none} without; outside ${tally.free.hold} with, ${tally.free.none} without\n${holds.join("\n")}\n`);
