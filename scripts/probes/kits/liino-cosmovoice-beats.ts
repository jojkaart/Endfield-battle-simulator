// The Liino round, 2026-11-27 (docs/open-problems.md "Liino's own damage error"): per Cosmovoice (one per logged bomb,
// ultimate_skill_projhit_damage_02) in every log with Liino: the beats logged (soundwave_projhit, of the kit's 10),
// the finale (soundwave_02_projhit), the seconds to the log's end, and the teammates' hits in the 13 s after with
// Cosmovoice's ATK / Amp or Medicant listed. 2026-11-27: the bomb and the Pyrotechnics in every Cosmovoice, the beats
// 0–10 (1cd1 and 1d91 none), the finale in 5 of 24.
//
//   node scripts/probes/kits/liino-cosmovoice-beats.ts
//
// Reads fixtures/, fixtures/pending/ and fixtures/multi-target/ (never fixtures/holdout/).

import { readFileSync, readdirSync } from "node:fs";

type Hit = { t: number; operator: string; event: string; value: number; effects: { buff: string; source: string }[] };
for (const dir of ["fixtures", "fixtures/pending", "fixtures/multi-target"]) {
  for (const f of readdirSync(dir)) {
    if (!f.startsWith("zmdlogs-") || !f.endsWith(".json")) continue;
    const fx = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as { team: { operator: string }[]; hits: Hit[] };
    if (!fx.team.some((m) => m.operator === "chr_0035_liino")) continue;
    const hits = fx.hits;
    const last = Math.max(...hits.map((h) => h.t));
    const mine = (re: RegExp) => hits.filter((h) => h.operator === "chr_0035_liino" && re.test(h.event));
    const beats = mine(/soundwave_projhit$/);
    const finales = mine(/soundwave_02_projhit$/);
    console.log(`${f.slice(8, 12)} (${dir}) log end ${(last / 1000).toFixed(1)} s`);
    for (const s of [...new Set(mine(/projhit_damage_02$/).map((h) => h.t))]) {
      const b = beats.filter((h) => h.t >= s - 3000 && h.t < s + 17000);
      const fi = finales.filter((h) => h.t >= s && h.t < s + 18000);
      const mates = hits.filter((h) => h.operator !== "chr_0035_liino" && h.t > s + 300 && h.t < s + 13000);
      const cosmo = mates.filter((h) => h.effects.some((e) => e.source === "chr_0035_liino" && /liino_atkup|spellenhance|enhance_natural|enhance_pulse/.test(e.buff))).length;
      const lance = mates.filter((h) => h.effects.some((e) => /lance_0014/.test(e.buff))).length;
      console.log(`   bomb ${(s / 1000).toFixed(2)}: beats ${b.length}${b.length ? ` (${b.map((h) => (h.t / 1000).toFixed(1)).join(" ")})` : ""}, finale ${fi.length}, ${((last - s) / 1000).toFixed(1)} s to the end; teammates' hits ${mates.length}, Cosmovoice listed ${cosmo}, Medicant listed ${lance}`);
    }
  }
}
