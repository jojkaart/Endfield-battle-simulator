// Placement paths (2026-11-28): what each placement pass placed and which stops the next pass read. Run:
// node scripts/probes/placement/pass-stops.ts <fixture> <from s> <to s> [<operator id>]
// Per pass (logcasts.ts placementPasses: first, second, placed), the casts in the window (one operator's, or every
// one's) and their distinct casts (distinctCasts, with the merge that pass has), then the stops the second pass read
// (passStops of the first). The casts view's STOP lines are the replay's, so a rule reading pass 1's stops (byTime,
// castStart, joinable) can't be checked there: 9c6e 78.88 s, Liino's ultimate placed again in pass 1 at 76.31 s,
// its stop 76.30–78.87 s read by pass 2 (fixed by passStops' ultimate merge).
import { loadGameData } from "@efsim/data";
import { devFixtures, distinctCasts, passStops, placementPasses } from "@efsim/logs";
import { FPS } from "@efsim/engine";

if (process.argv.includes("--help") || process.argv.includes("-h") || process.argv.length < 5) {
  process.stdout.write("Usage: node scripts/probes/placement/pass-stops.ts <fixture> <from s> <to s> [<operator id>]\n");
  process.exit(process.argv.length < 5 && !process.argv.includes("--help") && !process.argv.includes("-h") ? 1 : 0);
}
const data = loadGameData();
const [id, from, to, op] = [process.argv[2] as string, Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
const s = (ms: number) => (ms / 1000).toFixed(2);
const inWindow = (ms: number) => ms >= from * 1000 && ms <= to * 1000;
for (const { short, fx } of devFixtures({ ids: [id] })) {
  const passes = placementPasses(data, fx);
  for (const [name, p] of Object.entries(passes)) {
    for (const c of p.casts) if ((!op || c.operator === op) && inWindow(c.start)) process.stdout.write(`${short} ${name} CAST ${c.operator} ${c.group} ${s(c.start)} key ${c.key}${c.fromEvent ? " fromEvent" : ""}\n`);
    for (const c of distinctCasts(p)) if ((!op || c.operator === op) && inWindow(c.start)) process.stdout.write(`${short} ${name} DISTINCT ${c.operator} ${c.skillId} ${s(c.start)}\n`);
  }
  for (const x of passStops(data, fx, passes.first)) {
    const [a, b] = [(x.start * 1000) / FPS, ((x.start + x.scales.length) * 1000) / FPS];
    if (b < from * 1000 || a > to * 1000 || (op && x.operator !== op)) continue;
    process.stdout.write(`${short} pass-2 STOP ${x.operator} ${x.skillId} ${s(a)}–${s(b)} lowest ${Math.min(...x.scales).toFixed(2)}\n`);
  }
}
