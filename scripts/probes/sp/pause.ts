// Probe (scripts/probes/README.md): team-SP round (2026-11-28): SP constants no reading registers, as variants in one
// process (the engine's SP object, rules.ts, mutated before each replay: the pause after a spend in frames, the start):
// per variant the development logs whose logged casts the replay can't afford with its own SP, then a row per short
// log. 2026-11-28 after Purrchena's fix: the 0.5 s pause 15 logs / 706 SP, 0.2 s 10 / 527, none 8 / 428, a start of
// 300 5 / 323, both 4 / 181.
//
//   node scripts/probes/sp/pause.ts [short id...]      (writes nothing; minutes: five replays of every log)
import { loadGameData } from "@efsim/data";
import { SP } from "@efsim/engine";
import { devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const ids = process.argv.slice(2);
const sp = SP as unknown as { start: number; pauseAfterSpendFrames: number; perSecond: number; max: number };
const variants: { name: string; start: number; pause: number }[] = [
  { name: "base 200/15", start: 200, pause: 15 },
  { name: "pause 6", start: 200, pause: 6 },
  { name: "pause 0", start: 200, pause: 0 },
  { name: "start 300", start: 300, pause: 15 },
  { name: "start 300 pause 0", start: 300, pause: 0 },
];
const fxs = devFixtures({ dirs: ["verified", "pending"], ...(ids.length ? { ids } : {}) });
const rows = new Map<string, Map<string, number>>();
for (const v of variants) {
  sp.start = v.start;
  sp.pauseAfterSpendFrames = v.pause;
  let [logs, total, casts] = [0, 0, 0];
  for (const { short, fx } of fxs) {
    const r = logBuffReplay(data, fx).replay;
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
process.stdout.write("EFSIM-DONE spvariants pass\n");
