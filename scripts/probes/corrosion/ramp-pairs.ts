// Corrosion's ramp readings bound the world's held time H(t) since an application: L(t) ≤ H(t) ≤ U(t) (L from a step
// not yet reached, U from a step reached). With hidden holds P ≥ 0 nondecreasing on top of the model's Hm, a model is
// feasible iff for every t1 ≤ t2, Hm(t2) − Hm(t1) ≤ U(t2) − L(t1) (+ tolerance): the readings' pairs cap the model's
// hold between them, whatever the application's logged time (the pair's difference doesn't use it). Per instance and
// rule, the worst pair, its excess and the stops between, and the least hidden hold the readings ask on top. Rules: H0
// the replay's stops at the lowest scale (replayTimeStops: since 2026-11-23 cut at Arcane's combo reset); H1 those cut
// at the reset again (a no-op now; before, the reset's test). Ramp-slowdowns round (2026-11-23).
// Run: [TOL=150] [OTHER=none] [INSIDE=drop] node scripts/probes/corrosion/ramp-pairs.ts [ids…] [--since] [--verbose]
//   TOL: ms per side (the log's batched ms: 150); OTHER=none drops the replay's own non-stop holds (a freeze's);
//   INSIDE=drop leaves out readings inside a stop; --since adds the application itself (L = U = 0) as a reading.
import { FPS } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { corrosionRamp, devFixtures, logBuffReplay, placeHits, replayTimeStops, type ReplayTimeStop } from "@efsim/logs";

const data = loadGameData();
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const withSince = args.includes("--since");
const ids = args.filter((a) => !a.startsWith("--"));
const RESET_SKILL = "chr_0032_lizhiyan_combo_skill";
const TOL = Number(process.env.TOL ?? 70);
const msOf = (f: number) => (f * 1000) / FPS;
const nm = (s: ReplayTimeStop) => `${data.operators[s.operator]?.name ?? s.operator}:${s.skillId.replace(/^chr_\d+_[a-z0-9]+_/, "")}${s.placed ? "" : "*"}@${(msOf(s.start) / 1000).toFixed(2)}`;

type Rule = (stops: readonly ReplayTimeStop[]) => (f: number) => number;
const lowest: Rule = (stops) => (f) => {
  let m = 1;
  for (const s of stops) if (f >= s.start && f < s.start + s.scales.length) m = Math.min(m, s.scales[f - s.start] as number);
  return m;
};
const withReset: Rule = (stops) => {
  const resets = stops.filter((s) => s.skillId === RESET_SKILL).map((s) => s.start + 9);
  const cut = stops.map((s) => {
    let e = s.start + s.scales.length;
    if (s.kind !== "ultimate") for (const r of resets) if (s.start <= r && e > r) e = r;
    return { ...s, scales: s.scales.slice(0, e - s.start) };
  });
  return lowest(cut);
};
const RULES: Record<string, Rule> = { H0: lowest, H1: withReset };

const total: Record<string, { n: number; excess: number; need: number }> = Object.fromEntries(Object.keys(RULES).map((r) => [r, { n: 0, excess: 0, need: 0 }]));
let instances = 0;
for (const { short, fx } of devFixtures(ids.length ? { ids } : {})) {
  const placement = placeHits(data, fx);
  const { replay } = logBuffReplay(data, fx, placement);
  const steps = corrosionRamp(data, fx, placement, replay);
  if (!steps.length) continue;
  const stops = replayTimeStops(data, fx, placement);
  for (const since of new Set(steps.map((x) => x.since))) {
    instances++;
    const list = steps.filter((x) => x.since === since).sort((x, y) => x.hit.t - y.hit.t);
    const a = Math.round((since * FPS) / 1000);
    const h0rate = lowest(stops);
    const cum = (rate: (f: number) => number, b: number) => {
      let h = 0;
      for (let f = a; f < b; f++) h += 1 - rate(f);
      return msOf(h);
    };
    const keep = process.env.INSIDE === "drop" ? list.filter((x) => h0rate(Math.round((x.hit.t * FPS) / 1000)) >= 1 && h0rate(Math.round((x.hit.t * FPS) / 1000) - 3) >= 1) : list;
    const pts = keep.map((x) => {
      const real = x.hit.t - since;
      const b = Math.round((x.hit.t * FPS) / 1000);
      const other = real - x.world - cum(h0rate, b);
      return { t: x.hit.t, b, U: real - x.low * 1000, L: x.capped ? -Infinity : real - (x.high + 1) * 1000, other };
    });
    if (withSince) pts.unshift({ t: since, b: a, U: 0, L: 0, other: 0 });
    const out: string[] = [];
    const needs: string[] = [];
    for (const [r, rule] of Object.entries(RULES)) {
      const rate = rule(stops);
      const hm = pts.map((p) => cum(rate, p.b) + (process.env.OTHER === "none" ? 0 : p.other));
      // The least hidden hold the readings ask on top of the model (running max of L − Hm, from the application).
      let need = 0;
      for (let i = 0; i < pts.length; i++) need = Math.max(need, pts[i]!.L - hm[i]! - TOL);
      total[r]!.need += need;
      needs.push(`${r} ${need.toFixed(0)}`);
      let worst = { ex: 0, i: -1, j: -1 };
      for (let i = 0; i < pts.length; i++) {
        if (pts[i]!.L === -Infinity) continue;
        for (let j = i; j < pts.length; j++) {
          const ex = hm[j]! - hm[i]! - (pts[j]!.U - pts[i]!.L) - 2 * TOL;
          if (ex > worst.ex) worst = { ex, i, j };
        }
      }
      if (worst.ex > 0) {
        total[r]!.n++;
        total[r]!.excess += worst.ex;
        const [p, q] = [pts[worst.i]!, pts[worst.j]!];
        const between = stops.filter((s) => s.start + s.scales.length > p.b && s.start < q.b);
        out.push(`  ${r}: excess ${worst.ex.toFixed(0)} ms between ${(p.t / 1000).toFixed(2)} and ${(q.t / 1000).toFixed(2)} (allowed ${(q.U - p.L + 2 * TOL).toFixed(0)}, model ${(hm[worst.j]! - hm[worst.i]!).toFixed(0)}, other ${(q.other - p.other).toFixed(0)}): ${between.map(nm).join(", ")}`);
      }
    }
    if (out.length || verbose) process.stdout.write(`${short.slice(0, 4)} since ${(since / 1000).toFixed(2)} (${list.length} readings; hidden asked ${needs.join(", ")})\n${out.join("\n")}${out.length ? "\n" : ""}`);
  }
}
process.stdout.write(`${instances} instances: ${Object.entries(total).map(([r, t]) => `${r} infeasible ${t.n} (excess ${(t.excess / 1000).toFixed(2)} s, hidden asked ${(t.need / 1000).toFixed(2)} s)`).join(" | ")}\nEFSIM-DONE pairs pass\n`);
