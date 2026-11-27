// Round 2026-11-27 (away statuses): does the world run or stop in an away stretch (no logged hit for 6 s or more)?
// Per away stretch of every development log (or the ids given): the hold placement's clocks whose log run is listed on
// both sides of it (since before its start, last listed after its end), with the instance's replay expiry and the ask
// (world s past the expiry, holds.ts ClockWhy): a whole-game pause asks most of the stretch's length, a phase the world
// runs through about nothing. Then each operator's last basic step before it and first after (a pause keeps a string
// going: 4d60's Arcane attack 2 → attack 3). Run: node scripts/probes/away/away-clocks.ts [ids…] > scratch/away.txt
// (under the default readings; pass `--assume pause-holds=away` to see the asks the old reading dropped).
import { loadGameData } from "@efsim/data";
import { awayWindows, devFixtures, logBuffReplay, msOfFrame } from "@efsim/logs";

const data = loadGameData();
const args = process.argv.slice(2);
const at = args.indexOf("--assume");
const assume: Record<string, string> = {};
if (at >= 0) {
  const [id, r] = (args[at + 1] ?? "").split("=");
  if (id && r) assume[id] = r;
  args.splice(at, 2);
}
for (const { short, fx } of devFixtures(args.length ? { ids: args } : {})) {
  const ws = awayWindows(fx);
  if (ws.length === 0) continue;
  const { replay } = logBuffReplay(data, fx, { assume });
  for (const w of ws) {
    process.stdout.write(`${short} ${fx.enemy.id} away ${(w.from / 1000).toFixed(2)}–${(w.to / 1000).toFixed(2)} s (${((w.to - w.from) / 1000).toFixed(2)} s)\n`);
    const seen = new Set<string>();
    for (const c of replay.holdClocks ?? []) {
      if (!c.instance || !c.run || !(c.run.since < w.from && c.run.lastListed >= w.to)) continue;
      const k = `${c.clock}|${c.run.name}|${c.run.since}|${c.run.lastListed}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const [s, e] = [msOfFrame(c.instance.start), msOfFrame(c.instance.end)];
      const ask = c.ask !== undefined ? ` ask ${c.ask.toFixed(2)}` : "";
      process.stdout.write(`   ${c.clock} on ${c.holder} inst ${(s / 1000).toFixed(2)}–${(e / 1000).toFixed(2)} run ${c.run.name.replace(/^buff_/, "")} ${(c.run.since / 1000).toFixed(2)}–${(c.run.lastListed / 1000).toFixed(2)}${ask}: ${c.verdict.slice(0, 90)}\n`);
    }
    for (const op of [...new Set(fx.hits.map((h) => h.operator))]) {
      const basic = (h: (typeof fx.hits)[number]) => h.operator === op && /_attack\d/.test(h.event ?? "");
      const before = fx.hits.filter((h) => basic(h) && h.t <= w.from).sort((a, b) => b.t - a.t)[0];
      const after = fx.hits.filter((h) => basic(h) && h.t >= w.to).sort((a, b) => a.t - b.t)[0];
      if (before && after) process.stdout.write(`   basic ${data.operators[op]?.name ?? op}: ${before.event} ${(before.t / 1000).toFixed(2)} → ${after.event} ${(after.t / 1000).toFixed(2)}\n`);
    }
  }
}
