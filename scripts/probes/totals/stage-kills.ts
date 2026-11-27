// Each development fight's logged total as a multiple of the data's Max HP (2026-11-27, exposed totals): its nearest
// two-decimal multiple and the distance, whether its last hit is capped, lastLifeKilled. Every capped single-life kill
// sits within 1.3e-5 of its total from such a multiple (enginecheck.ts stageScaledKill's grid); 207f (×5.7600) and 5082
// (×7.6000) are kills without an uncapped last hit.
import { loadGameData } from "@efsim/data";
import { Attr } from "@efsim/engine";
import { devFixtures, lastLifeKilled } from "@efsim/logs";

const data = loadGameData();
for (const { short, fx } of devFixtures()) {
  const hp = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp];
  if (!hp) continue;
  const total = fx.hits.reduce((a, h) => a + h.value, 0);
  const last = Math.max(...fx.hits.map((h) => h.t));
  const capped = fx.hits.some((h) => h.t === last && h.uncapped !== undefined && h.uncapped > h.value);
  const r = total / hp;
  const grid = Math.round(r * 100) / 100;
  const off = (total - grid * hp);
  process.stdout.write(`${short} ${fx.enemy.id.padEnd(32)} ×${r.toFixed(5)} grid ${grid.toFixed(2)} off ${off.toFixed(0).padStart(7)} (${((off / hp) * 1e5).toFixed(2)}e-5 hp; hits ${fx.hits.length}) capped ${capped} lastLife ${lastLifeKilled(data, fx)}\n`);
}
