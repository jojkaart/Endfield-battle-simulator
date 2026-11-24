// Lives of an enemy (2026-11-24, the misprediction candidates): for each of an operator's hits of a key (default Alesh's
// ultimate), the logged damage dealt so far as a multiple of the data's Max HP (its fraction within a life), the fight's
// total and the operator's potential. `node scripts/probes/stats/lives.ts [operator] [key part]`.
import { loadGameData } from "@efsim/data";
import { devFixtures } from "@efsim/logs";
import { Attr } from "@efsim/engine";

const data = loadGameData();
const op = process.argv[2] ?? "chr_0024_deepfin";
const key = process.argv[3] ?? "ultimate_skill";
for (const { short, fx } of devFixtures({ withOperators: [op] })) {
  const max = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp] ?? NaN;
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const total = hits.reduce((s, h) => s + h.value, 0);
  process.stdout.write(`${short} ${fx.enemy.id} L${fx.enemy.level} maxHp ${max} total ${total} (${(total / max).toFixed(3)} × max)\n`);
  let dealt = 0;
  for (const h of hits) {
    dealt += h.value;
    if (h.operator === op && h.event.includes(key)) {
      const pot = fx.team.find((m) => m.operator === op)?.potential;
      process.stdout.write(`  t ${h.t} value ${h.value} crit ${h.crit} dealt ${(dealt / max).toFixed(3)} × max (mod 1: ${((dealt / max) % 1).toFixed(3)}) P${pot}\n`);
    }
  }
}
