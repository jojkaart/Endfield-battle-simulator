// Probe (scripts/probes/README.md): the combo-hold round (2026-11-26), docs/open-problems.md "The enemy's clock".
// node scripts/probes/combo-hold/edges.ts [--op=<id part>] [--rows]; KIND=ultimate for ultimates' stops; reads the
// development logs, writes nothing.
// Where in a combo's stop the operators' extra hold sits: (1) the density of the other operators' logged landings by
// frame offset from each isolated combo stop's listed start and end (an extra frozen window shows as a dearth of
// landings: just before the start if the hold begins early, just after the end if the clocks resume late; but combos
// open on events, so the density before a start is biased by what opened the window); (2) within one placed cast,
// the residual of a landing against the cast's first landing before the stop: just before the stop's listed start
// (late if the hold begins early), inside it by its share of the stop, and after its listed end by how far.
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { castTimeStops, devFixtures, placeHits, worldMs } from "@efsim/logs";

const data = loadGameData();
const msOf = (f: number) => (f * 1000) / FPS;
const fr = (t: number) => Math.round((t * FPS) / 1000);
const W = 20;
const dens = { start: new Map<number, number>(), end: new Map<number, number>() };
let stopsUsed = 0;
type Pt = { r: number; delta: number; held: number; tag: string; side: "after" | "before" };
const pts: Pt[] = [];
const inside: { r: number; pos: number; scale: number }[] = [];
const ops = process.argv.find((a) => a.startsWith("--op="))?.slice(5);
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"] })) {
  const placement = placeHits(data, fx);
  const stops = castTimeStops(data, placement.casts);
  // Isolated combo stops: no other stop within 1 s of them.
  const combos = stops.filter((s) => s.kind === (process.env.KIND ?? "combo") && (!ops || s.operator.includes(ops)) && !stops.some((o) => o !== s && o.start < s.start + s.scales.length + 30 && o.start + o.scales.length > s.start - 30));
  stopsUsed += combos.length;
  const landings = [...placement.hits].filter(([, p]) => p.frame !== undefined && p.cast.kind !== null).map(([h, p]) => ({ h, p }));
  for (const s of combos) {
    const end = s.start + s.scales.length;
    for (const { h } of landings) {
      if (h.operator === s.operator) continue;
      const f = fr(h.t);
      if (f >= s.start - W && f < s.start + W) dens.start.set(f - s.start, (dens.start.get(f - s.start) ?? 0) + 1);
      if (f >= end - W && f < end + W) dens.end.set(f - end, (dens.end.get(f - end) ?? 0) + 1);
    }
  }
  const byCast = new Map<object, { t: number; frame: number }[]>();
  for (const { h, p } of landings) byCast.set(p.cast, [...(byCast.get(p.cast) ?? []), { t: h.t, frame: p.frame as number }]);
  for (const [c0, list0] of byCast) {
    const c = c0 as (typeof placement.casts)[number];
    const others = stops.filter((s) => s.operator !== c.operator);
    const list = [...list0].sort((a, b) => a.t - b.t);
    const a = list[0];
    if (!a) continue;
    const inStop = (t: number) => others.some((s) => fr(t) >= s.start && fr(t) < s.start + s.scales.length);
    if (inStop(a.t)) continue;
    for (const b of list.slice(1)) {
      if (b.frame <= a.frame || b.t - a.t > 6000) continue;
      if (inStop(b.t)) {
        const s = combos.find((x) => x.operator !== c.operator && fr(b.t) >= x.start && fr(b.t) < x.start + x.scales.length && x.start > fr(a.t));
        if (s && others.filter((x) => x.start < fr(b.t) && x.start + x.scales.length > fr(a.t)).length === 1) {
          const r = worldMs(a.t, b.t, others) - msOf(b.frame - a.frame);
          inside.push({ r, pos: (fr(b.t) - s.start) / s.scales.length, scale: s.scales[fr(b.t) - s.start] as number });
        }
        continue;
      }
      const between = others.filter((s) => s.start < fr(b.t) && s.start + s.scales.length > fr(a.t));
      const r = worldMs(a.t, b.t, others) - msOf(b.frame - a.frame);
      if (between.length === 0) {
        // A control, or a landing just before a combo's listed start.
        const next = combos.find((s) => s.operator !== c.operator && s.start >= fr(b.t) && s.start - fr(b.t) <= 15);
        if (next) pts.push({ r, delta: msOf(next.start - fr(b.t)), held: 0, side: "before", tag: `${short} ${(b.t / 1000).toFixed(2)} ${c.skillId}` });
        continue;
      }
      if (between.length !== 1 || !combos.includes(between[0] as (typeof combos)[number])) continue;
      const s = between[0] as (typeof combos)[number];
      const held = b.t - a.t - worldMs(a.t, b.t, [s]);
      pts.push({ r, delta: b.t - msOf(s.start + s.scales.length), held, side: "after", tag: `${short} ${(a.t / 1000).toFixed(2)}→${(b.t / 1000).toFixed(2)} ${c.skillId.replace(/^chr_\d+_/, "")} [${s.operator.split("_")[2]}:${s.scales.length}f]` });
    }
  }
}
const row = (m: Map<number, number>) => Array.from({ length: 2 * W }, (_, i) => i - W).map((k) => `${k}:${m.get(k) ?? 0}`).join(" ");
process.stdout.write(`isolated combo stops: ${stopsUsed}\nother operators' landings by frame from the listed start:\n${row(dens.start)}\nfrom the listed end:\n${row(dens.end)}\n`);
const med = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? NaN;
for (const [lo, hi] of [[-Infinity, 0], [0, 100], [100, 200], [200, 400], [400, 800], [800, 6000]] as const) {
  const sel = pts.filter((p) => p.side === "after" && p.delta >= lo && p.delta < hi);
  process.stdout.write(`after the end by ${lo}–${hi} ms: ${sel.length} landings, residual median ${med(sel.map((p) => p.r)).toFixed(0)} ms, held median ${med(sel.map((p) => p.held)).toFixed(0)}\n`);
}
for (const [lo, hi] of [[0, 100], [100, 200], [200, 300], [300, 500]] as const) {
  const sel = pts.filter((p) => p.side === "before" && p.delta >= lo && p.delta < hi);
  process.stdout.write(`before the start by ${lo}–${hi} ms: ${sel.length} landings, residual median ${med(sel.map((p) => p.r)).toFixed(0)} ms\n`);
}
for (let lo = 0; lo < 1; lo += 0.1) {
  const sel = inside.filter((p) => p.pos >= lo && p.pos < lo + 0.1);
  if (sel.length) process.stdout.write(`inside the stop at ${lo.toFixed(1)}–${(lo + 0.1).toFixed(1)} of it: ${sel.length} landings, residual median ${med(sel.map((p) => p.r)).toFixed(0)} ms, listed scale median ${med(sel.map((p) => p.scale)).toFixed(2)}\n`);
}
if (process.argv.includes("--rows")) for (const p of pts.sort((x, y) => x.delta - y.delta)) process.stdout.write(`${p.side} ${p.delta.toFixed(0)} r ${p.r.toFixed(0)} held ${p.held.toFixed(0)} ${p.tag}\n`);
