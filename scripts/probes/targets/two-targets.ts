// Several targets under one enemy id, 2026-11-27 (status pairing round; fixture field severalTargets): per development
// log, one operator's status event (an Arts Burst, a reaction, a Combustion tick) logged twice within a frame (one
// enemy can't burst twice at once: two targets the same status reached), and its kills (hits capped at the HP left,
// `uncapped` above the value, before the fight's last hit). 2026-11-27: 9c6e 9 twins (79.85 s: two Nature bursts of
// Typhoeus's at one ms, 143,320 and 33,858, both capped from one uncapped 412,733) and 8 kills; the slug's 6339 and
// 7b54 kills only (lives and phases of one enemy, "Hard 33's slug"); db87 one twin (14.01 s, 24,377 / 36,565: a crit and
// a plain one of one burst at one ms; Hard 19's bigents, whose template has a second entity in the Hard 32 multi-target
// logs), b7b3 one (10.91 s, 15,274 twice); no other log either.
//
//   node scripts/probes/targets/two-targets.ts
//
// Development logs only (devFixtures). Writes nothing.
import { parseReactionEvent } from "@efsim/engine";
import { devFixtures } from "@efsim/logs";

/** A status event as the log names it (a status's event may carry its operator's suffix: buff_common_natural_natural_triggered_typhoea). */
const isStatus = (event: string) => parseReactionEvent(event) !== null || parseReactionEvent(event.replace(/_[a-z]+$/, "")) !== null;
const FRAME_MS = 34;

for (const { short, fx } of devFixtures({})) {
  const st = fx.hits.filter((h) => isStatus(h.event)).sort((a, b) => a.t - b.t);
  const twins: string[] = [];
  for (let i = 0; i + 1 < st.length; i++) {
    const [a, b] = [st[i], st[i + 1]];
    if (!a || !b) continue;
    if (a.operator === b.operator && a.event === b.event && b.t - a.t <= FRAME_MS) twins.push(`${(a.t / 1000).toFixed(2)}${b.t !== a.t ? ` +${b.t - a.t} ms` : ""} ${a.event.replace("buff_common_", "")} ${a.value} / ${b.value}`);
  }
  const last = Math.max(...fx.hits.map((h) => h.t));
  const kills = fx.hits.filter((h) => h.uncapped !== undefined && h.uncapped > h.value && h.t < last).map((h) => (h.t / 1000).toFixed(2));
  if (twins.length || kills.length) process.stdout.write(`${short} (${fx.enemy.id}${fx.severalTargets ? ", severalTargets" : ""}): status twins ${twins.length}${twins.length ? ` (${twins.join("; ")})` : ""}; kills ${kills.length}${kills.length ? ` (${kills.join(" ")} s)` : ""}\n`);
}
