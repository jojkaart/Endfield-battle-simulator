// Round 6 (2026-11-26, what ends Arcane's Doubles Susceptibility): Arcane's combo touches less than 7 s of log time
// apart in every log dir (multi-target too), with her Doubles runs around: a second touch while her seal lasts (only
// e82d at 7.02 / 8.73 s so far). `node scripts/probes/kits/arcane-second-touch.ts`, one line per pair on stdout.
import { buffLanes, devFixtures } from "@efsim/logs";

const ARC = "chr_0032_lizhiyan";
for (const { short, dir, fx } of devFixtures({ dirs: ["verified", "pending", "multi"], withOperators: [ARC] })) {
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const touches = [...new Set(hits.filter((h) => h.operator === ARC && /seal_total/.test(h.event)).map((h) => h.t))];
  const ultTimes = new Set(hits.filter((h) => h.operator === ARC && /ultimate_skill/.test(h.event)).map((h) => h.t));
  const lanes = buffLanes(fx, /vulnerable_natural/).filter((l) => l.source === ARC && l.since !== null && !ultTimes.has(l.since));
  const combos = (fx.casts ?? []).filter((c) => c.operator === ARC && /combo/.test(c.skill)).map((c) => c.t);
  for (let i = 1; i < touches.length; i++) {
    const a = touches[i - 1] as number;
    const b = touches[i] as number;
    if (b - a > 7000 || b - a < 400) continue;
    const ev = combos.filter((t) => t > a - 1000 && t <= b + 2000).map((t) => (t / 1000).toFixed(2));
    const around = lanes.filter((l) => (l.since as number) >= a - 1500 && (l.since as number) <= b + 300).map((l) => `[since ${((l.since as number) / 1000).toFixed(2)} last ${(l.lastListed / 1000).toFixed(2)} next ${l.nextUnlisted === null ? "end" : (l.nextUnlisted / 1000).toFixed(2)}]`);
    process.stdout.write(`${short} (${dir}) touches ${(a / 1000).toFixed(2)} → ${(b / 1000).toFixed(2)}; combo events ${ev.join(",")}: ${around.join(" ")}\n`);
  }
}
