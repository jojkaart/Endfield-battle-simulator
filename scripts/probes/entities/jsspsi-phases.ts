// Round "Camille's Vesperwings, Pogranichnik's harasses" (2026-11-27): TARGET_LOSS_LEAD_MS's 0.2–3.6 s (buffreplay.ts).
// Run: node scripts/probes/entities/jsspsi-phases.ts [shares, default 0.5,0.85] (Max HP 2,934,923 at level 90 hard-coded).
// eny_0134_jsspsi fights: when the cumulative logged damage crosses a share of twice the data's Max HP, and the next away start.
import { awayWindows, devFixtures } from "@efsim/logs";

const pool = 2 * 2934923;
const shares = (process.argv[2] ?? "0.5,0.85").split(",").map(Number);
for (const { short, fx } of devFixtures()) {
  if (fx.enemy.id !== "eny_0134_jsspsi") continue;
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const away = awayWindows(fx);
  for (const share of shares) {
    let sum = 0;
    const at = hits.find((h) => (sum += h.value) >= share * pool);
    if (!at) continue;
    const next = away.find((w) => w.from >= at.t);
    process.stdout.write(`${short} ${share}: crossed at ${(at.t / 1000).toFixed(2)} by ${at.event.replace(/^(buff_)?chr_\d+_/, "")} ${at.value}; next away from ${next ? (next.from / 1000).toFixed(2) : "-"} (${next ? ((next.from - at.t) / 1000).toFixed(2) : "-"} s later)\n`);
  }
}
