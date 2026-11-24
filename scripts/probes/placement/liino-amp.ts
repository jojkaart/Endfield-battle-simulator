// Placement leads (2026-11-24): Liino's ultimate events against her stop and Cosmovoice's listed start. Run from the
// repository root: node scripts/probes/placement/liino-amp.ts (reads fixtures/, fixtures/pending, fixtures/multi-target).
// For each Liino ultimate in the logs: the log's cast events, the gap with no hits before the first projectiles,
// the Amp's (spellenhance) and Cosmovoice ATK's listed since, and the first projectiles.
import { readFileSync, readdirSync } from "node:fs";

const dirs = ["fixtures", "fixtures/pending", "fixtures/multi-target"];
const files = dirs.flatMap((d) => readdirSync(d).filter((f) => f.startsWith("zmdlogs-") && f.endsWith(".json")).map((f) => `${d}/${f}`));
const L = "chr_0035_liino";
for (const f of files) {
  const fx = JSON.parse(readFileSync(f, "utf8"));
  if (!fx.team.some((b: { operator: string }) => b.operator === L)) continue;
  const hits = [...fx.hits].sort((a: { t: number }, b: { t: number }) => a.t - b.t);
  const firsts: number[] = [];
  for (const h of hits) if (h.operator === L && /ultimate_skill_projhit$/.test(h.event) && (firsts.length === 0 || h.t - (firsts.at(-1) as number) > 15000)) firsts.push(h.t);
  for (const p of firsts) {
    const ev = (fx.casts ?? []).filter((c: { operator: string; skill: string; t: number }) => c.operator === L && c.skill.includes("ultimate") && c.t >= p - 6000 && c.t <= p + 4000).map((c: { t: number }) => c.t);
    const sinces = new Set<string>();
    for (const h of hits) {
      if (h.t < p - 6000 || h.t > p + 3000) continue;
      for (const e of h.effects ?? []) if (/liino_(spellenhance|atkup)/.test(e.buff) && e.since !== undefined && e.since > p - 8000) sinces.add(`${e.buff.replace("buff_chr_0035_liino_", "")}@${e.since}`);
    }
    // gaps over 1.2 s between consecutive hits (any operator) in [p-6, p]
    const win = hits.filter((h: { t: number }) => h.t >= p - 6000 && h.t <= p);
    const gaps: string[] = [];
    for (let i = 1; i < win.length; i++) if (win[i].t - win[i - 1].t > 1200) gaps.push(`${win[i - 1].t}-${win[i].t}`);
    process.stdout.write(`${f.replace(/.*zmdlogs-/, "").slice(0, 4)} proj ${p} events ${ev.join(",")} gaps ${gaps.join(" ")} since ${[...sinces].join(" ")}\n`);
  }
}
