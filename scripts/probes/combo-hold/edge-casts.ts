// Probe (scripts/probes/README.md): the away-and-presses round (2026-11-26), docs/open-problems.md "The enemy's clock".
// node scripts/probes/combo-hold/edge-casts.ts [--rows]; reads the development logs, writes nothing. casts.ts with,
// for casts across combos only, a constant per combo (a fixed delay at each stop's edges) fitted against a share of
// the combo-held time, their rms, and the residual by the one combo's held time.
// The operators' own clocks across another's combo: within one placed cast, its first and last logged landings (each
// outside every stop), the world time between them (the other operators' stops out) less their kit frames' distance,
// against the time other operators' combo stops hold between. If a combo holds the operators more than its stop list
// says, the residual rises with the combo-held time.
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { castTimeStops, devFixtures, placeHits, worldMs } from "@efsim/logs";

const data = loadGameData();
const msOf = (f: number) => (f * 1000) / FPS;
const pts: { r: number; combo: number; ult: number; span: number; count: number; tag: string }[] = [];
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"] })) {
  const placement = placeHits(data, fx);
  const stops = castTimeStops(data, placement.casts);
  const byCast = new Map<object, { t: number; frame: number }[]>();
  for (const [h, p] of placement.hits) {
    if (p.frame === undefined || p.cast.kind === null) continue;
    byCast.set(p.cast, [...(byCast.get(p.cast) ?? []), { t: h.t, frame: p.frame }]);
  }
  for (const [c0, list] of byCast) {
    const c = c0 as (typeof placement.casts)[number];
    const others = stops.filter((s) => s.operator !== c.operator);
    const inStop = (t: number) => { const f = Math.round((t * FPS) / 1000); return others.some((s) => f >= s.start - 2 && f < s.start + s.scales.length + 2); };
    const ok = [...list].filter((x) => !inStop(x.t)).sort((a, b) => a.t - b.t);
    if (ok.length < 2) continue;
    const [a, b] = [ok[0] as { t: number; frame: number }, ok.at(-1) as { t: number; frame: number }];
    if (b.frame <= a.frame || b.t - a.t > 6000) continue;
    const r = worldMs(a.t, b.t, others) - msOf(b.frame - a.frame);
    const held = (k: string) => b.t - a.t - worldMs(a.t, b.t, others.filter((s) => s.kind === k));
    const fa = Math.round((a.t * FPS) / 1000), fb = Math.round((b.t * FPS) / 1000);
    const by = others.filter((s) => s.kind === "combo" && s.start < fb && s.start + s.scales.length > fa).map((s) => `${s.operator.split("_")[2]}:${s.scales.length}f`).join(",");
    const count = others.filter((s) => s.kind === "combo" && s.start >= fa && s.start + s.scales.length <= fb).length;
    const partial = others.some((s) => s.kind === "combo" && s.start < fb && s.start + s.scales.length > fa) && count !== others.filter((s) => s.kind === "combo" && s.start < fb && s.start + s.scales.length > fa).length;
    if (partial) continue;
    pts.push({ r, combo: held("combo"), ult: held("ultimate"), span: b.t - a.t, count, tag: `${short} ${(a.t / 1000).toFixed(2)}→${(b.t / 1000).toFixed(2)} ${c.skillId.replace(/^chr_\d+_/, "")} [${by}]` });
  }
}
const med = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? NaN;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
for (const [label, sel] of [["no stop between", pts.filter((p) => p.combo === 0 && p.ult === 0)], ["combos only", pts.filter((p) => p.combo > 0 && p.ult === 0)], ["an ultimate", pts.filter((p) => p.ult > 0 && p.combo === 0)]] as const) {
  const trimmed = sel.filter((p) => Math.abs(p.r) < 400);
  const k = trimmed.reduce((s, p) => s + (p.combo + p.ult) * p.r, 0) / trimmed.reduce((s, p) => s + (p.combo + p.ult) ** 2, 0);
  process.stdout.write(`${label}: ${sel.length} casts (|r| < 0.4 s: ${trimmed.length}), residual median ${med(sel.map((p) => p.r)).toFixed(0)} ms, mean (trimmed) ${mean(trimmed.map((p) => p.r)).toFixed(0)}, held median ${med(sel.map((p) => p.combo + p.ult)).toFixed(0)} ms, r = ${k.toFixed(3)} × held (through 0, trimmed)\n`);
}
{
  // A constant per combo (a fixed delay at its stop's edges) against a share of its hold: fits through 0 and their errors.
  const sel = pts.filter((p) => p.combo > 0 && p.ult === 0 && Math.abs(p.r) < 400);
  const kc = sel.reduce((s, p) => s + p.count * p.r, 0) / sel.reduce((s, p) => s + p.count ** 2, 0);
  const kh = sel.reduce((s, p) => s + p.combo * p.r, 0) / sel.reduce((s, p) => s + p.combo ** 2, 0);
  const sse = (f: (p: (typeof sel)[number]) => number) => sel.reduce((s, p) => s + (p.r - f(p)) ** 2, 0);
  process.stdout.write(`combos only, ${sel.length} casts: per combo ${kc.toFixed(0)} ms (rms ${Math.sqrt(sse((p) => kc * p.count) / sel.length).toFixed(0)}), share ${kh.toFixed(3)} × held (rms ${Math.sqrt(sse((p) => kh * p.combo) / sel.length).toFixed(0)}), none (rms ${Math.sqrt(sse(() => 0) / sel.length).toFixed(0)})\n`);
  const byHeld = new Map<string, number[]>();
  for (const p of sel.filter((x) => x.count === 1)) { const k = `${Math.round(p.combo / 100) * 100}`; byHeld.set(k, [...(byHeld.get(k) ?? []), p.r]); }
  for (const [k, rs] of [...byHeld].sort((a, b) => +a[0] - +b[0])) process.stdout.write(`  one combo held ~${k} ms: ${rs.length} casts, residual median ${med(rs).toFixed(0)}\n`);
}
if (process.argv.includes("--rows")) for (const p of pts.filter((x) => x.combo > 0 && x.ult === 0)) process.stdout.write(`${p.tag} r ${p.r.toFixed(0)} combo ${p.combo.toFixed(0)}\n`);
