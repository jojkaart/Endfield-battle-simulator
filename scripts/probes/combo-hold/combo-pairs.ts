// Round 2026-11-27 (away statuses, 8915's lead): do two combos pressed together hold the clocks less than their stop
// lists say? Combos of two operators pressed together (one combo's stop starting within GAP ms of another's end, or
// inside it) in every development log, and the clocks (logClocks tick and cast rows) spanning both and no other stop:
// their residual (world time less expected, ms; positive = the clock ran late in the game against the replay's stop
// list) against the rows across one combo alone. Run: node scripts/probes/combo-hold/combo-pairs.ts [GAP ms, default 300]
import { loadGameData } from "@efsim/data";
import { devFixtures, logClocks, placeHits, replayTimeStops, msOfFrame } from "@efsim/logs";

const data = loadGameData();
const GAP = Number(process.argv[2] ?? 300);
const pairRows: { log: string; what: string; residual: number; held: number; overlap: number }[] = [];
const singleRows: { residual: number; held: number }[] = [];
for (const { short, fx } of devFixtures()) {
  const placement = placeHits(data, fx);
  const stops = replayTimeStops(data, fx, placement).filter((s) => s.kind === "combo");
  const pairs: [number, number, string, number][] = [];
  const sorted = [...stops].sort((a, b) => a.start - b.start);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const [a, b] = [sorted[i]!, sorted[i + 1]!];
    const aEnd = msOfFrame(a.start + a.scales.length);
    const gap = msOfFrame(b.start) - aEnd;
    if (gap <= GAP && a.operator !== b.operator) pairs.push([msOfFrame(a.start), msOfFrame(b.start + b.scales.length), `${a.operator.slice(9)}@${(msOfFrame(a.start) / 1000).toFixed(2)}+${b.operator.slice(9)}@${(msOfFrame(b.start) / 1000).toFixed(2)}`, gap]);
  }
  const { rows } = logClocks(data, { short, fx });
  for (const r of rows) {
    const comboHeld = Object.entries(r.held).filter(([k]) => k === "combo").reduce((t, [, v]) => t + v, 0);
    if (comboHeld <= 0 || Object.keys(r.held).some((k) => k !== "combo")) continue;
    const pair = pairs.find(([a, b]) => r.a <= a && r.b >= b);
    const inside = stops.filter((s) => msOfFrame(s.start) < r.b && msOfFrame(s.start + s.scales.length) > r.a);
    if (pair && inside.length === 2) pairRows.push({ log: short, what: `${r.kind} ${r.what} ${(r.a / 1000).toFixed(2)}–${(r.b / 1000).toFixed(2)} ${pair[2]} gap ${pair[3].toFixed(0)}`, residual: r.residual, held: comboHeld, overlap: pair[3] });
    else if (!pair && inside.length === 1) singleRows.push({ residual: r.residual, held: comboHeld });
  }
}
const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor(s.length / 2)] as number) : NaN;
};
for (const r of pairRows) process.stdout.write(`${r.log} ${r.what}: residual ${r.residual.toFixed(0)} ms, combo-held ${r.held.toFixed(0)} ms\n`);
process.stdout.write(`pairs: ${pairRows.length} rows, residual median ${med(pairRows.map((r) => r.residual)).toFixed(0)} ms, Σres/Σheld ${(pairRows.reduce((t, r) => t + r.residual, 0) / pairRows.reduce((t, r) => t + r.held, 0)).toFixed(3)}\n`);
process.stdout.write(`singles: ${singleRows.length} rows, residual median ${med(singleRows.map((r) => r.residual)).toFixed(0)} ms, Σres/Σheld ${(singleRows.reduce((t, r) => t + r.residual, 0) / singleRows.reduce((t, r) => t + r.held, 0)).toFixed(3)}\n`);
