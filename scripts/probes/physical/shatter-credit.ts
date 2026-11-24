// Hypothesis: a Shatter at a Vulnerable stack added to an existing Vulnerable instance is credited to the instance's
// creator (buff_physical_no_guard's on-stack-added handler, source = the instance's), when the instance was created by a
// plain Vulnerable application (skip_handle_cryst_break 0); a physical status's own handler credits its applier.
// Fight totals round 4 (2026-11-24), written before status.ts took the rule (instance starter's, whatever made it): on
// the current code the replay's credit is the rule's already. Run: node scripts/probes/physical/shatter-credit.ts [ids…]
// From the replay's status events: each replay Shatter, the credit under the hypothesis, and the log's credit near it.
import { loadGameData } from "@efsim/data";
import { FPS, type ReactionRecord } from "@efsim/engine";
import { devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const ids = process.argv.slice(2);
const name = (op: string) => data.operators[op]?.name ?? op;
const ms = (f: number) => (f * 1000) / FPS;
const tally = new Map<string, number>();
for (const { short, fx } of devFixtures(ids.length ? { ids } : {})) {
  const logged = fx.hits.filter((h) => h.event === "buff_common_cryst_triggered_physical_break");
  if (!logged.length) continue;
  const ev: readonly ReactionRecord[] = logBuffReplay(data, fx).replay.reactions;
  process.stdout.write(`\n== ${short}\n`);
  let inst: { creator: string; handles: boolean; expires: number } | null = null;
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i] as ReactionRecord;
    if (inst && e.frame >= inst.expires) inst = null;
    if (e.kind === "vulnerable") {
      const next = ev[i + 1];
      const lifting = next?.kind === "physical" && next.frame === e.frame && next.operator === e.operator;
      const prior = inst;
      if (!inst || e.before === 0) inst = { creator: e.operator, handles: !lifting, expires: e.frame + 20 * FPS };
      else inst.expires = Math.max(inst.expires, e.frame + 20 * FPS);
      // The Shatter this event makes, if any (the plain path: right after; the lifting path: after the physical event).
      const sh = ev.slice(i + 1, i + 3).find((x) => x.kind === "shatter" && x.frame === e.frame);
      if (!sh) continue;
      let credit: string;
      if (prior && e.before > 0) credit = prior.handles ? prior.creator : lifting ? e.operator : "(none: skipped)";
      else credit = e.operator;
      const log = logged.filter((h) => Math.abs(h.t - ms(e.frame)) <= 150);
      const lo = log.map((h) => name(h.operator)).join("+") || "-";
      const verdict = log.length === 0 ? "no log" : log.some((h) => h.operator === credit) ? (credit === sh.operator ? "same" : "FIXED") : log.some((h) => h.operator === sh.operator) ? "BROKEN" : "both wrong";
      tally.set(verdict, (tally.get(verdict) ?? 0) + 1);
      process.stdout.write(`${(ms(e.frame) / 1000).toFixed(3)} replay ${name(sh.operator).padEnd(12)} hyp ${name(credit).padEnd(12)} log ${lo.padEnd(12)} (${lifting ? "lift/kd" : "plain"} by ${name(e.operator)}, before ${e.before}, instance ${prior ? `${name(prior.creator)} ${prior.handles ? "plain" : "status"}` : "-"})  ${verdict}\n`);
    }
    if (e.kind === "physical" && (e.status === "crush" || e.status === "breach")) inst = null;
  }
}
process.stdout.write("\n");
for (const [k, n] of tally) process.stdout.write(`${n} ${k}\n`);
