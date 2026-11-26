// Round "0c14 and the operator curve" (2026-11-26): every unlogged-tails `cut` decision over the development logs:
// the cast, its cut frame, what the same replay under `kept` lands of that skill after the cut (hit ids, count,
// damage), and the log's own hits of the operator in the 3 s after it.  node scripts/probes/tails/cuts.ts [ids…]
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay } from "@efsim/logs";
import { FPS } from "@efsim/engine";

const data = loadGameData();
const ids = process.argv.slice(2);
const ms = (f: number) => (f * 1000) / FPS;
for (const { short, fx } of devFixtures(ids.length ? { ids } : {})) {
  let cut;
  try {
    cut = logBuffReplay(data, fx);
  } catch {
    continue;
  }
  const cuts = cut.replay.tailCuts;
  if (!cuts.length) continue;
  const kept = logBuffReplay(data, fx, undefined, { assume: { "unlogged-tails": "kept" } });
  const name = (op: string) => data.operators[op]?.name ?? op;
  for (const x of cuts) {
    const c = x.cast;
    const skill = c.as ?? c.skillId;
    const span = data.skills[skill]?.timing?.duration ?? 300;
    const dropped = kept.replay.hits.filter((h) => h.operator === c.operator && h.skillId === skill && h.ref === undefined && h.frame > x.frame && h.frame <= x.frame + span);
    const inCut = cut.replay.hits.filter((h) => h.operator === c.operator && h.skillId === skill && h.ref === undefined && h.frame > x.frame && h.frame <= x.frame + span);
    const ids = [...new Set(dropped.map((h) => h.hitId))].join(",");
    const dmg = dropped.reduce((a, h) => a + h.damage, 0) - inCut.reduce((a, h) => a + h.damage, 0);
    const from = ms(x.frame), to = from + 3000;
    const own = fx.hits.filter((h) => h.operator === c.operator && h.t > from && h.t <= to).map((h) => `${(h.t / 1000).toFixed(2)}:${h.event.replace(/^chr_\d+_\w+?_/, "")}`);
    process.stdout.write(`${short} ${name(c.operator)} ${skill.replace(/^chr_\d+_\w+?_/, "")} placed ${(c.start / 1000).toFixed(2)} cut ${(from / 1000).toFixed(2)}: dropped ${dropped.length - inCut.length} [${ids}] ${Math.round(dmg)}; own logged next 3 s: ${own.slice(0, 6).join(" ") || "none"}\n`);
  }
}
