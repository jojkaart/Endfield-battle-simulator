// Probe (scripts/probes/README.md): the enemy-clock round (2026-11-26), docs/open-problems.md "The enemy's clock".
// node scripts/probes/combo-hold/tick-chains.ts [--rows]; reads the development logs, writes nothing.
// Enemy tick chains: residual against the number of combo stops inside and their held time (two regressors, no
// intercept), and per combo operator (chains with one combo only). Is the extra hold a constant per combo or a share?
import { loadGameData } from "@efsim/data";
import { castTimeStops, devFixtures, loggedStaggerSpans, placeHits, worldMs } from "@efsim/logs";

const data = loadGameData();
const TICK = /^(buff_chr_0028_wulfa_normal_bleed|buff_common_burning_status)$/;
type Row = { r: number; n: number; count: number; held: number; ops: string[]; stag: boolean; maxPair: number; tag: string };
const rows: Row[] = [];
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"] })) {
  if (!fx.hits.some((h) => TICK.test(h.event))) continue;
  const stops = castTimeStops(data, placeHits(data, fx).casts);
  // The log's Stagger spans (round 13: the shared helper, query.ts loggedStaggerSpans; `efsim zmdlogs clocks` is this
  // probe's view over every clock).
  const spans = loggedStaggerSpans(fx);
  const stagOf = (t: number) => spans.findIndex((x) => x.from <= t && t <= x.to);
  const by = new Map<string, number[]>();
  for (const h of fx.hits) if (TICK.test(h.event)) by.set(`${h.operator}|${h.event}|${h.target ?? ""}`, [...(by.get(`${h.operator}|${h.event}|${h.target ?? ""}`) ?? []), h.t]);
  for (const ts0 of by.values()) {
    const ts = [...new Set(ts0)].sort((a, b) => a - b);
    const chains: number[][] = [];
    for (const t of ts) {
      const c = chains.at(-1);
      const prev = c?.at(-1);
      if (c && prev !== undefined && t - prev >= 500 && t - prev <= 2600 && stagOf(t) === stagOf(prev)) c.push(t);
      else chains.push([t]);
    }
    for (const c of chains) {
      if (c.length < 2) continue;
      const [a, b] = [c[0] as number, c.at(-1) as number];
      const fa = Math.round((a * 30) / 1000), fb = Math.round((b * 30) / 1000);
      if (stops.some((s) => s.kind === "ultimate" && s.start < fb && s.start + s.scales.length > fa)) continue;
      // Combo stops wholly inside the chain (a stop over its first or last tick splits its time with the outside).
      const combos = stops.filter((s) => s.kind === "combo" && s.start >= fa && s.start + s.scales.length <= fb);
      const partial = stops.some((s) => s.kind === "combo" && s.start < fb && s.start + s.scales.length > fa && !combos.includes(s));
      if (partial) continue;
      const r = worldMs(a, b, stops) - (c.length - 1) * 1000;
      const held = b - a - worldMs(a, b, combos);
      const maxPair = Math.max(...c.slice(1).map((t, i) => worldMs(c[i] as number, t, stops) - 1000));
      rows.push({ r, n: c.length - 1, count: combos.length, held, ops: combos.map((s) => s.operator.split("_")[2] as string), stag: stagOf(a) >= 0, maxPair, tag: `${short} ${(a / 1000).toFixed(2)}⇒${(b / 1000).toFixed(2)}` });
    }
  }
}
function fit2(sel: Row[], label: string) {
  const sxx = sel.reduce((s, r) => s + r.count * r.count, 0), syy = sel.reduce((s, r) => s + r.held * r.held, 0), sxy = sel.reduce((s, r) => s + r.count * r.held, 0);
  const sxr = sel.reduce((s, r) => s + r.count * r.r, 0), syr = sel.reduce((s, r) => s + r.held * r.r, 0);
  const det = sxx * syy - sxy * sxy;
  const a = (sxr * syy - syr * sxy) / det, b = (syr * sxx - sxr * sxy) / det;
  const one = (sxr / sxx).toFixed(0), share = (syr / syy).toFixed(3);
  process.stdout.write(`${label}: ${sel.length} chains (${sel.filter((r) => r.count > 0).length} with combos, ${sel.reduce((s, r) => s + r.count, 0)} combos); both: ${a.toFixed(0)} ms per combo + ${b.toFixed(3)} × held; alone: ${one} ms per combo, or ${share} × held\n`);
}
const clean = rows.filter((r) => r.stag || r.maxPair < 300);
fit2(rows.filter((r) => r.stag), "Staggered");
fit2(rows.filter((r) => !r.stag && r.maxPair < 300), "free (no pair ≥ 0.3 s)");
fit2(clean, "both");
const byOp = new Map<string, number[]>();
for (const r of clean.filter((x) => x.count === 1)) byOp.set(r.ops[0] as string, [...(byOp.get(r.ops[0] as string) ?? []), r.r]);
for (const [op, rs] of byOp) process.stdout.write(`  one ${op} combo: ${rs.length} chains, residuals ${rs.map((x) => x.toFixed(0)).join(" ")}\n`);
const none = clean.filter((r) => r.count === 0);
process.stdout.write(`  no combo: ${none.length} chains, ${none.reduce((s, r) => s + r.n, 0)} pairs, residual total ${none.reduce((s, r) => s + r.r, 0).toFixed(0)} ms\n`);
if (process.argv.includes("--rows")) for (const r of clean.filter((x) => x.count > 0)) process.stdout.write(`${r.tag} r ${r.r.toFixed(0)} combos ${r.ops.join(",")} held ${r.held.toFixed(0)}${r.stag ? " STAGGERED" : ""}\n`);
