// The enemy's HP at an operator's hits (2026-11-24, the misprediction candidates; docs/open-problems.md "Misprediction
// statistics"): per logged hit, the HP left as 1 − the logged damage before it ÷ the fight's logged total (POOL=<k>
// for k × the data's Max HP instead), whether a game buff is listed, and logged ÷ the primary reading from
// scratch/stats/hits.jsonl (build.ts). `node scripts/probes/stats/hpside.ts chr_0005_chen chen_potential_1 d4fb c4f3 >
// scratch/x.txt`, then `python3 -I scripts/probes/stats/hpside.py < scratch/x.txt` (counts by fight, HP side and ratio).
import { loadGameData } from "@efsim/data";
import { devFixtures } from "@efsim/logs";
import { Attr } from "@efsim/engine";
import { readFileSync } from "node:fs";

const data = loadGameData();
const [op, buff, ...ids] = process.argv.slice(2) as [string, string, ...string[]];
const rows = new Map<string, { value: number; predicted: number | null; cls: string; cf: { what: string; kind: string; reading: number }[] }>();
for (const line of readFileSync("scratch/stats/hits.jsonl", "utf8").split("\n")) {
  if (!line.includes(op)) continue;
  const d = JSON.parse(line);
  if (d.operator === op) rows.set(`${d.fx} ${d.t} ${d.event} ${d.value}`, d);
}
for (const { short, fx } of devFixtures({ ids })) {
  const max = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp] ?? NaN;
  const total = fx.hits.reduce((s, h) => s + h.value, 0);
  const pool = Number(process.env.POOL ?? "0") > 0 ? Number(process.env.POOL) * max : total;
  let dealt = 0;
  for (const h of [...fx.hits].sort((a, b) => a.t - b.t)) {
    const before = dealt;
    dealt += h.value;
    if (h.operator !== op) continue;
    const listed = [...h.effects, ...h.boundaryEffects].some((e) => e.buff.includes(buff));
    const r = rows.get(`${short} ${h.t} ${h.event} ${h.value}`);
    const p = r?.predicted ?? null;
    const fitP = p !== null && Math.abs(h.value - p) <= Math.max(1.5, 0.001 * h.value);
    process.stdout.write(`${short} ${(h.t / 1000).toFixed(1)} ${h.event.replace(op + "_", "")} hpLeft ${(1 - before / pool).toFixed(3)} listed ${listed ? "Y" : "-"} r ${p ? (h.value / p).toFixed(3) : "?"} ${fitP ? "fitsP" : ""} ${r?.cls ?? ""}\n`);
  }
}
