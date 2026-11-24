// Every logged Shatter in the development logs: the operator the log credits, the physical statuses and hits at its ms,
// the controlled operator then, and the replay's Shatter near it. Fight totals round 4 (2026-11-24). Run:
// node scripts/probes/physical/shatters.ts [ids…] (stdout; a tally of the credit patterns at the end).
import { loadGameData } from "@efsim/data";
import { FPS, parseReactionEvent } from "@efsim/engine";
import { controlSpans, devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const ids = process.argv.slice(2);
const name = (op: string) => data.operators[op]?.name ?? op;
const ms = (f: number) => (f * 1000) / FPS;
const tally = new Map<string, number>();
for (const { short, fx } of devFixtures(ids.length ? { ids } : {})) {
  const sh = fx.hits.filter((h) => h.event === "buff_common_cryst_triggered_physical_break");
  if (!sh.length) continue;
  const spans = controlSpans(data, fx);
  const replay = logBuffReplay(data, fx).replay;
  process.stdout.write(`\n== ${short} (${fx.team.map((b) => name(b.operator)).join(", ")})\n`);
  for (const h of sh) {
    const at = fx.hits.filter((x) => Math.abs(x.t - h.t) <= 20 && x !== h);
    const phys = at.filter((x) => parseReactionEvent(x.event)?.element === "physical");
    const ctl = spans.find((s) => s.from <= h.t && (s.to === null || h.t < s.to))?.operator;
    const rs = replay.hits.filter((l) => l.skillId === "reaction:shatter" && Math.abs(ms(l.frame) - h.t) <= 500);
    const physOps = [...new Set(phys.map((x) => x.operator))];
    const rule = physOps.length === 0 ? "no phys" : physOps.length === 1 ? (physOps[0] === h.operator ? "phys=own" : "phys=other") : physOps.includes(h.operator) ? `multi incl own` : "multi other";
    const key = `${rule}; controlled ${ctl === h.operator ? "=own" : ctl ? "other" : "?"}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
    process.stdout.write(`${(h.t / 1000).toFixed(3)} ${name(h.operator).padEnd(12)} ${String(h.value).padStart(6)} ctl ${ctl ? name(ctl) : "?"}; phys: ${phys.map((x) => `${name(x.operator)} ${parseReactionEvent(x.event)?.kind}`).join(", ") || "-"}; others: ${at.filter((x) => !phys.includes(x)).map((x) => `${name(x.operator)} ${x.event.replace(/^chr_\d+_\w+?_/, "")}`).join(", ")}; replay: ${rs.map((l) => `${name(l.operator)} ${(ms(l.frame) / 1000).toFixed(3)} ${Math.round(l.exact)}`).join(", ") || "none"}  [${key}]\n`);
  }
}
process.stdout.write("\n");
for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1])) process.stdout.write(`${n}  ${k}\n`);
