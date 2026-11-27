// The Liino round, 2026-11-27 (in-game test 25, overheals): per development log with Liino, the casts before the
// fight's first logged hit and each teammate's Medicant entries (buff_wpn_lance_0014_damageup) whose `since` is before
// it: heals made before anybody has been hit, the team at full HP. 2026-11-27: 1cd1, 9c6e, 9847, c6d8, 8318, 4bfe have
// layers from such heals (and teammates a heal misses there: 1cd1's Ardelia, 4bfe's Arcane).
//
//   node scripts/probes/kits/liino-opening-layers.ts
//
// Reads fixtures/, fixtures/pending/ and fixtures/multi-target/ (never fixtures/holdout/).

import { readFileSync, readdirSync } from "node:fs";

type Fx = { team: { operator: string }[]; hits: { t: number; operator: string; effects: { buff: string; since: number }[] }[]; casts: { t: number; operator: string; skill: string }[] };
for (const dir of ["fixtures", "fixtures/pending", "fixtures/multi-target"]) {
  for (const f of readdirSync(dir)) {
    if (!f.startsWith("zmdlogs-") || !f.endsWith(".json")) continue;
    const fx = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Fx;
    if (!fx.team.some((m) => m.operator === "chr_0035_liino")) continue;
    const first = Math.min(...fx.hits.map((h) => h.t));
    const pre = fx.casts.filter((c) => c.t < first).map((c) => `${c.operator.slice(9)} ${c.skill.replace(/^chr_\d+_\w+?_/, "")}@${(c.t / 1000).toFixed(2)}`);
    const byOp = new Map<string, Set<number>>();
    for (const h of fx.hits) for (const e of h.effects) {
      if (e.buff !== "buff_wpn_lance_0014_damageup" || e.since >= first) continue;
      const s = byOp.get(h.operator) ?? new Set<number>();
      s.add(e.since);
      byOp.set(h.operator, s);
    }
    console.log(`${f.slice(8, 12)} first hit ${(first / 1000).toFixed(2)} s; casts before: ${pre.join(", ") || "none"}`);
    for (const [op, s] of byOp) console.log(`    ${op.slice(9)}: layers since ${[...s].sort((a, b) => a - b).map((x) => (x / 1000).toFixed(2)).join(" ")}`);
  }
}
