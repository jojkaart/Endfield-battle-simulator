// Every development log's log-only physical status hit (Lift, Knock Down, Crush, Breach, Shatter) the replay doesn't
// deal: the logged hits around it, the replay's landings around it and its enemy state there. Fight totals round 4
// (2026-11-24). Run: node scripts/probes/physical/physmiss.ts [ids…] (stdout).
import { loadGameData } from "@efsim/data";
import { FPS, parseReactionEvent } from "@efsim/engine";
import { checkLog, devFixtures, engineHits, engineReport, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const ids = process.argv.slice(2);
const name = (op: string) => data.operators[op]?.name ?? op;
const ms = (f: number) => (f * 1000) / FPS;
for (const { short, fx } of devFixtures(ids.length ? { ids } : {})) {
  const phys = fx.hits.filter((h) => parseReactionEvent(h.event)?.element === "physical");
  if (!phys.length) continue;
  const replay = logBuffReplay(data, fx);
  const byHit = engineHits(data, fx, replay);
  const t = engineReport(data, fx, replay, byHit, checkLog(data, fx, { replay, engineHits: byHit })).totals;
  const misses = t.oneSided.filter((x) => x.side === "log" && x.nature === "physical" && x.context.startsWith("no landing"));
  if (!misses.length) continue;
  process.stdout.write(`\n== ${short} (${fx.team.map((b) => name(b.operator)).join(", ")}): ${phys.length} logged physical status hits, ${misses.length} without a landing\n`);
  for (const m of misses) {
    process.stdout.write(`-- ${(m.t / 1000).toFixed(2)} s ${name(m.operator)} ${m.key} ${-m.damage} [${m.context}]\n`);
    for (const h of fx.hits.filter((h) => Math.abs(h.t - m.t) <= 400)) process.stdout.write(`   log    ${(h.t / 1000).toFixed(3)} ${name(h.operator).padEnd(14)} ${h.event} ${h.value}\n`);
    for (const l of replay.replay.hits.filter((l) => Math.abs(ms(l.frame) - m.t) <= 1500 && (l.skillId.startsWith("reaction:") || l.operator === m.operator))) {
      const e = l.facts?.enemy;
      const st = e ? `vuln ${e.vulnerable?.stacks ?? 0} statuses [${e.statuses.map((s) => `${s.status}${s.level}`).join(" ")}] phys [${e.physical.map((p) => p.status).join(" ")}] inf ${e.infliction ? `${e.infliction.element}${e.infliction.stacks}` : "-"}` : "";
      process.stdout.write(`   replay ${(ms(l.frame) / 1000).toFixed(3)} ${name(l.operator).padEnd(14)} ${l.skillId} ${l.hitId} ${Math.round(l.exact)}  ${st}\n`);
    }
  }
}
