// Probe (scripts/probes/README.md): team-SP round (2026-11-28): the open SP readings (engine assumptions sp-regen,
// sp-start) as variants of the log replay: per variant the development logs whose logged casts the replay can't
// afford with its own SP (BuffReplay.spTopUps), the casts and the SP, then per short log a row of the variants.
//
//   node scripts/probes/sp/readings.ts [short id...]      (writes nothing; minutes: four replays of every log)
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const ids = process.argv.slice(2);
const variants: { name: string; assume: Record<string, string> }[] = [
  { name: "pause", assume: { "sp-regen": "pause" } },
  { name: "ticks", assume: { "sp-regen": "ticks" } },
  { name: "pause+full", assume: { "sp-regen": "pause", "sp-start": "full" } },
  { name: "ticks+full", assume: { "sp-regen": "ticks", "sp-start": "full" } },
];
const fxs = devFixtures({ dirs: ["verified", "pending"], ...(ids.length ? { ids } : {}) });
const rows = new Map<string, Map<string, number>>();
for (const v of variants) {
  let [logs, total, casts] = [0, 0, 0];
  for (const { short, fx } of fxs) {
    const r = logBuffReplay(data, fx, { assume: v.assume }).replay;
    const lack = r.spTopUps.reduce((t, x) => t + x.sp, 0);
    if (lack > 0.5) logs++;
    total += lack;
    casts += r.spTopUps.length;
    if (lack > 0.5) {
      const m = rows.get(short) ?? new Map<string, number>();
      m.set(v.name, lack);
      rows.set(short, m);
    }
  }
  process.stdout.write(`${v.name}: ${logs} logs short, ${casts} casts, ${total.toFixed(0)} SP\n`);
}
for (const [short, m] of rows) process.stdout.write(`  ${short}: ${variants.map((v) => `${v.name} ${(m.get(v.name) ?? 0).toFixed(0)}`).join(" | ")}\n`);
process.stdout.write("EFSIM-DONE spvariants2 pass\n");
