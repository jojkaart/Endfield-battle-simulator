// Probe (scripts/probes/README.md): team-SP round (2026-11-28): the SP the replay's own SP lacks at logged casts
// (BuffReplay.spTopUps: replayCast raises SP to the cost silently), per development log and per skill group of the
// short cast, with each short cast's time, operator, skill and SP. Before the round: 16 of 65 logs short, 41 casts,
// 1,327 SP (04d4 621 of it: Purrchena's counters made as battle skills).
//
//   node scripts/probes/sp/shortfall.ts [short id...] [--verbose] [--assume id=reading]...   (writes nothing)
//
// --verbose also lists the logs short of nothing; --assume replays under another reading of an open assumption.
import { loadGameData } from "@efsim/data";
import { secondsOf } from "@efsim/engine";
import { devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const args = process.argv.slice(2);
const assume: Record<string, string> = {};
for (let i = 0; i < args.length; i++) if (args[i] === "--assume") { const [k, v] = (args[++i] ?? "").split("="); if (k && v) assume[k] = v; }
const ids = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--assume");
const verbose = args.includes("--verbose");
let [logs, casts, sp, all] = [0, 0, 0, 0];
const byKind = new Map<string, { n: number; sp: number }>();
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"], ...(ids.length ? { ids } : {}) })) {
  all++;
  const r = logBuffReplay(data, fx, Object.keys(assume).length ? { assume } : {}).replay;
  const lack = r.spTopUps.reduce((t, x) => t + x.sp, 0);
  for (const x of r.spTopUps) {
    const g = data.operators[x.operator]?.skillGroups[x.skillId] ?? "?";
    const k = byKind.get(g) ?? { n: 0, sp: 0 };
    byKind.set(g, { n: k.n + 1, sp: k.sp + x.sp });
  }
  if (lack > 0.5) logs++;
  casts += r.spTopUps.length;
  sp += lack;
  if (lack > 0.5 || verbose) process.stdout.write(`${short}: ${r.spTopUps.length} casts short ${lack.toFixed(0)} SP: ${r.spTopUps.map((x) => `${secondsOf(x.frame).toFixed(2)} ${data.operators[x.operator]?.name ?? x.operator} ${x.skillId.replace(/^chr_\d+_/, "")} ${x.sp.toFixed(0)}`).join(", ")}\n`);
}
process.stdout.write(`all: ${logs} of ${all} logs short, ${casts} casts, ${sp.toFixed(0)} SP; by skill group ${JSON.stringify([...byKind].map(([k, v]) => [k, v.n, Math.round(v.sp)]))}\n`);
