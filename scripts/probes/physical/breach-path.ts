// Pogranichnik's combo path (it jumps by the Vulnerable stacks the Breach or Crush before it consumed: no jump 4,
// 0 → 200 three, 400 two, 600 one; the path its slashes' values decide, castassembly.ts valuePaths) against the stacks
// the replay's last Breach or Crush within 5 s before it consumed. The order of a stop's batched landings (2026-11-26):
// at cbe7d5b c4f3 13.67 s alone DIFFERS (path 4, the replay's Breach 3), fixed by the batch order at 7.05 s. Run:
// node scripts/probes/physical/breach-path.ts (stdout).
import { loadGameData } from "@efsim/data";
import { secondsOf } from "@efsim/engine";
import { devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const op = "chr_0029_pograni";
for (const { short, fx } of devFixtures({ withOperators: [op] })) {
  const rep = logBuffReplay(data, fx).replay;
  for (const m of rep.made) {
    if (m.cast.operator !== op || !/combo/.test(m.skillId)) continue;
    const kj = m.cast.kitJumps;
    const taken = kj?.find((k) => k.taken);
    const pathStacks = kj ? (taken ? 4 - taken.to / 200 : 4) : null;
    const physical = rep.reactions.flatMap((r) => (r.kind === "physical" && (r.status === "breach" || r.status === "crush") && r.frame <= m.frame && r.frame >= m.frame - 150 ? [r] : []));
    const last = physical.at(-1);
    const vul = rep.reactions.flatMap((r) => (r.kind === "vulnerable" && r.frame <= (last?.frame ?? m.frame) && r.frame >= (last?.frame ?? m.frame) - 300 ? [r] : [])).at(-1);
    const flag = last && pathStacks !== null && last.level !== pathStacks ? "  DIFFERS" : "";
    const replayed = last ? `${last.status} by ${last.operator.replace(/^chr_\d+_/, "")} at ${secondsOf(last.frame).toFixed(2)} s level ${last.level}` : "no Breach/Crush in 5 s";
    process.stdout.write(`${short} combo at ${secondsOf(m.frame).toFixed(2)} s: path ${pathStacks ?? "?"} stacks; replay ${replayed}${vul ? ` (Vulnerable ${vul.stacks} before)` : ""}${flag}\n`);
  }
}
