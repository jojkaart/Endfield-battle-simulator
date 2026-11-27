// Round "Camille's Vesperwings, Pogranichnik's harasses" (2026-11-27): the evidence of the kit's harass frame 18.
// Run: node scripts/probes/entities/harass-slowdown.ts (no inputs; prints the mean scale and the late frames).
// The harass entity's own slow-down (TimeDilationAction layer 1, 0.4 s, its timeScaleCurve keys): the entity's local
// time against real time, and when its frame-9 (and frame-25) action comes.
interface Key { t: number; v: number; inT: number; outT: number; mode: number; inW?: number; outW?: number }
const keys: Key[] = [
  { t: 0, v: 0.30000001192092896, inT: -11.516738891601562, outT: -11.516738891601562, mode: 2, outW: 0.3180464208126068 },
  { t: 0.0549403615295887, v: 0.04303966090083122, inT: 0.11563371866941452, outT: 0.11563371866941452, mode: 1, inW: 0.3333333432674408, outW: 0.6580061912536621 },
  { t: 1, v: 1, inT: 4.710066318511963, outT: 4.710066318511963, mode: 1, inW: 0.24074770510196686 },
];
const outW = (k: Key) => (k.mode === 2 || k.mode === 3 ? (k.outW ?? 1 / 3) : 1 / 3);
const inW = (k: Key) => (k.mode === 1 || k.mode === 3 ? (k.inW ?? 1 / 3) : 1 / 3);
function value(t: number): number {
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (t > b.t) continue;
    const dt = b.t - a.t;
    const x = [a.t, a.t + outW(a) * dt, b.t - inW(b) * dt, b.t];
    const y = [a.v, a.v + a.outT * outW(a) * dt, b.v - b.inT * inW(b) * dt, b.v];
    const bez = (p: number[], u: number) => (1 - u) ** 3 * p[0]! + 3 * (1 - u) ** 2 * u * p[1]! + 3 * (1 - u) * u ** 2 * p[2]! + u ** 3 * p[3]!;
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 60; k++) {
      const m = (lo + hi) / 2;
      if (bez(x, m) < t) lo = m;
      else hi = m;
    }
    return bez(y, (lo + hi) / 2);
  }
  return 1;
}
const duration = 0.4;
const steps = 4000;
let local = 0;
const at: number[] = [];
const targets = [9 / 30, 25 / 30];
for (let i = 0; i < steps; i++) {
  const s = value((i + 0.5) / steps);
  local += (s * duration) / steps;
}
process.stdout.write(`mean scale ${(local / duration).toFixed(4)}; local time after the 0.4 s: ${local.toFixed(4)} s\n`);
for (const target of targets) {
  const real = target <= local ? NaN : duration + (target - local);
  process.stdout.write(`local ${target.toFixed(4)} s (frame ${Math.round(target * 30)}) comes at real ${real.toFixed(4)} s = frame ${(real * 30).toFixed(2)} (+${((real - target) * 30).toFixed(2)} frames)\n`);
}
for (const t of [0, 0.02, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1]) process.stdout.write(`  scale(${t}) = ${value(t).toFixed(4)}\n`);
