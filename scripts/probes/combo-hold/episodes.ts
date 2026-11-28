// Probe (scripts/probes/README.md): the combo-hold round (2026-11-28), docs/open-problems.md "The enemy's clock".
// node scripts/probes/combo-hold/episodes.ts [--rows]; reads the development logs, writes nothing.
// An operator's own cast across a teammate's combo stops only (casts.ts's rows, no other stop between): the residual
// (world time between its first and last landings outside every stop, the other operators' stops out, less their kit
// frames) by how many combos and episodes (runs of overlapping stops) lie between, by the one combo's hold, by who was
// controlled (the log's controlled-only Stagger on basic hits, castassembly.ts controlSwaps' evidence) and by cast kind.
// A share of the hold doubles across two combos pressed together; a constant per episode doesn't.
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { castTimeStops, devFixtures, placeHits, worldMs } from "@efsim/logs";

const data = loadGameData();
const msOf = (f: number) => (f * 1000) / FPS;
type Pt = { r: number; combo: number; ctl: string; kind: string; tag: string; nCombos: number; eps: number };
const pts: Pt[] = [];
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"] })) {
  const placement = placeHits(data, fx);
  const stops = castTimeStops(data, placement.casts);
  const shown = [...placement.hits]
    .filter(([h, p]) => h.poise !== undefined && p.cast.kind === "basic" && p.hits.some((k) => k.poise !== undefined && k.poiseControlledOnly))
    .map(([h]) => ({ t: h.t, op: h.operator }))
    .sort((a, b) => a.t - b.t);
  // The controlled operator at t: the same one shown before and after it, within 15 s.
  const controlledAt = (t: number): string | null => {
    const prev = shown.filter((x) => x.t <= t).at(-1);
    const next = shown.find((x) => x.t > t);
    return prev && next && prev.op === next.op && next.t - prev.t < 15000 ? prev.op : null;
  };
  const byCast = new Map<object, { t: number; frame: number }[]>();
  for (const [h, p] of placement.hits) {
    if (p.frame === undefined || p.cast.kind === null) continue;
    byCast.set(p.cast, [...(byCast.get(p.cast) ?? []), { t: h.t, frame: p.frame }]);
  }
  for (const [c0, list] of byCast) {
    const c = c0 as (typeof placement.casts)[number];
    const others = stops.filter((s) => s.operator !== c.operator);
    const inStop = (t: number) => {
      const f = Math.round((t * FPS) / 1000);
      return others.some((s) => f >= s.start - 2 && f < s.start + s.scales.length + 2);
    };
    const ok = [...list].filter((x) => !inStop(x.t)).sort((a, b) => a.t - b.t);
    if (ok.length < 2) continue;
    const [a, b] = [ok[0] as { t: number; frame: number }, ok.at(-1) as { t: number; frame: number }];
    if (b.frame <= a.frame || b.t - a.t > 6000) continue;
    const [fa, fb] = [Math.round((a.t * FPS) / 1000), Math.round((b.t * FPS) / 1000)];
    const between = others.filter((s) => s.start < fb && s.start + s.scales.length > fa);
    const cs = between.filter((s) => s.kind === "combo");
    if (cs.length === 0 || cs.length < between.length) continue;
    const r = worldMs(a.t, b.t, others) - msOf(b.frame - a.frame);
    let eps = 0;
    let lastEnd = -Infinity;
    for (const s of [...cs].sort((x, y) => x.start - y.start)) {
      if (s.start > lastEnd + 2) eps++;
      lastEnd = Math.max(lastEnd, s.start + s.scales.length);
    }
    const ctlNow = controlledAt(a.t);
    const ctl = ctlNow === null ? "unknown" : ctlNow === c.operator ? "controlled" : "teammate";
    const tag = `${short} ${(a.t / 1000).toFixed(2)}→${(b.t / 1000).toFixed(2)} ${c.operator.split("_")[2]} ${c.skillId.replace(/^chr_\d+_[a-z]+_/, "")} [${cs.map((s) => s.operator.split("_")[2]).join(",")}]`;
    pts.push({ r, combo: b.t - a.t - worldMs(a.t, b.t, cs), ctl, kind: c.kind ?? "?", nCombos: cs.length, eps, tag });
  }
}
const med = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? NaN;
const show = (label: string, sel: Pt[]) => {
  const t = sel.filter((p) => Math.abs(p.r) < 400);
  const sr = t.reduce((s, p) => s + p.r, 0);
  const sh = t.reduce((s, p) => s + p.combo, 0);
  const ne = t.reduce((s, p) => s + p.eps, 0);
  process.stdout.write(`${label.padEnd(34)} n ${String(sel.length).padStart(4)}  residual median ${med(sel.map((p) => p.r)).toFixed(0).padStart(5)} ms  held median ${med(sel.map((p) => p.combo)).toFixed(0).padStart(4)} ms  (|r| < 0.4 s) Σ residual ÷ Σ held ${(sr / sh).toFixed(2)}, per episode ${(sr / ne).toFixed(0)} ms\n`);
};
show("every cast across combos only", pts);
show("1 combo", pts.filter((p) => p.nCombos === 1));
show("2+ combos, 1 episode", pts.filter((p) => p.nCombos >= 2 && p.eps === 1));
show("2+ episodes", pts.filter((p) => p.eps >= 2));
for (const [lo, hi] of [[0, 300], [300, 420], [420, 560], [560, 2000]] as const) show(`1 combo, held ${lo}–${hi} ms`, pts.filter((p) => p.nCombos === 1 && p.combo >= lo && p.combo < hi));
for (const k of ["controlled", "teammate", "unknown"]) show(`cast by the ${k} operator`, pts.filter((p) => p.ctl === k));
for (const k of ["basic", "battle", "combo", "ultimate"]) show(`${k} casts`, pts.filter((p) => p.kind === k));
if (process.argv.includes("--rows")) for (const p of pts) process.stdout.write(`${p.tag} ${p.kind} ${p.ctl}: residual ${p.r.toFixed(0)} ms, combo-held ${p.combo.toFixed(0)} ms, ${p.eps} episode(s)\n`);
