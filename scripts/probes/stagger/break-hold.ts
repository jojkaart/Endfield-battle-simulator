// The hold at a Stagger break (2026-11-27, engine assumption break-hold): per logged break (a bar-0 hit after a bar
// above 0), how late every clock spanning it runs under the replay's placed stops: each placed cast's landings after it
// against the last one before (kit frames; `*` the breaker's casts), "at the break's ms" the landings at its own ms, and
// the enemy's tick series (holds.ts HOLD_SERIES). Rows 0.6 s or more past a break: 0.41–0.61 s late but two (median
// 0.54 s), the breaker's own casts too; NODES=1 the same at the Stagger Nodes' crossings (no hold: median +3 ms).
//   node scripts/probes/stagger/break-hold.ts [ms after the break, default 1500] [fixture id]
// The probe ran on the code before break-hold: under it the hold is in the engine, not the replay's stop list here.
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { devFixtures, placeHits, replayTimeStops, worldMs, HOLD_SERIES, operatorLabel } from "@efsim/logs";

const data = loadGameData();
const msOf = (f: number) => (f * 1000) / FPS;
const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);
const AFTER_MS = Number(process.argv[2] ?? 1500);
const only = process.argv[3];
const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]! : NaN);
const rows: { role: string; res: number; dt: number; log: string }[] = [];
const ticks: { res: number; log: string }[] = [];
for (const { short, fx } of devFixtures(only ? { ids: [only] } : {})) {
  if (fx.hits.some((h: any) => h.target)) continue;
  const placement = placeHits(data, fx);
  const stops = replayTimeStops(data, fx, placement);
  const ph = fx.hits.filter((h) => h.poise).sort((a, b) => a.t - b.t);
  const breaks: { t: number; op: string; ev: string; dealt: number }[] = [];
  let prevBar = 100;
  for (const h of ph) {
    const p = h.poise as any;
    if (p.bar === 0 && p.dealt > 0 && prevBar > 0) breaks.push({ t: h.t, op: h.operator, ev: h.event, dealt: p.dealt });
    prevBar = p.bar;
  }
  if (process.env.NODES) {
    breaks.length = 0;
    const nodes: number[] = (data.enemies as any)[fx.enemy.id]?.staggerNodes ?? [];
    const max = Math.max(...ph.map((h: any) => h.poise.bar + h.poise.dealt));
    let prev = max;
    for (const h of ph) {
      const p = h.poise as any;
      for (const n of nodes) if (prev > n * max && p.bar <= n * max && p.bar > 0) breaks.push({ t: h.t, op: h.operator, ev: h.event, dealt: p.dealt });
      prev = p.bar === 0 ? max : p.bar;
    }
  }
  for (const b of breaks) {
    const parts: string[] = [];
    const fb = frameOf(b.t);
    const inStopNow = stops.filter((st) => st.start <= fb + 2 && st.start + st.scales.length >= fb - 2 && st.scales.some((x) => x < 1)).map((st) => `${operatorLabel(data, st.operator)} ${st.kind}`);
    const byCast = new Map<any, { t: number; frame: number }[]>();
    for (const [h, p] of placement.hits) if (p.frame !== undefined && p.cast.kind !== null) byCast.set(p.cast, [...(byCast.get(p.cast) ?? []), { t: h.t, frame: p.frame }]);
    for (const [c, list] of byCast) {
      const others = stops.filter((st) => st.operator !== c.operator);
      const inStop = (t: number) => others.some((st) => frameOf(t) >= st.start - 2 && frameOf(t) < st.start + st.scales.length + 2);
      const ok = list.filter((x) => !inStop(x.t)).sort((x, y) => x.t - y.t);
      const before = ok.filter((x) => x.t <= b.t && x.t >= b.t - 2500);
      const after = ok.filter((x) => x.t > b.t && x.t <= b.t + AFTER_MS);
      const last = before.at(-1);
      const next = after[0];
      // At the break's own ms against the last landing strictly before it.
      const strictly = before.filter((x) => x.t < b.t - 30).at(-1);
      const atBreak = before.filter((x) => x.t >= b.t - 30);
      if (strictly && atBreak.length && atBreak[0]!.frame > strictly.frame) {
        const r0 = worldMs(strictly.t, atBreak[0]!.t, others) - msOf(atBreak[0]!.frame - strictly.frame);
        parts.push(`  (at the break's ms: ${operatorLabel(data, c.operator)} ${(strictly.t / 1000).toFixed(2)}→${(atBreak[0]!.t / 1000).toFixed(2)} ${r0 >= 0 ? "+" : ""}${r0.toFixed(0)})`);
      }
      if (!last || !next || next.frame <= last.frame) continue;
      // Does a stop straddle?
      const fa = frameOf(last.t), fz = frameOf(next.t);
      const straddle = others.some((st) => st.scales.some((x) => x < 1) && st.start < fz && st.start + st.scales.length > fa && (st.start < fa || st.start + st.scales.length > fz));
      if (straddle) continue;
      const res = worldMs(last.t, next.t, others) - msOf(next.frame - last.frame);
      const role = c.operator === b.op ? "breaker" : "other";
      rows.push({ role, res, dt: next.t - b.t, log: short });
      const more = after.filter((x) => x.frame > last.frame).map((x) => `${(x.t - b.t).toFixed(0)}:${(worldMs(last.t, x.t, others) - msOf(x.frame - last.frame)).toFixed(0)}`);
      parts.push(`${role === "breaker" ? "*" : ""}${operatorLabel(data, c.operator)} ${c.skillId.replace(/^chr_\d+_[a-z0-9]+_/, "")} ${(last.t / 1000).toFixed(2)}→${(next.t / 1000).toFixed(2)} ${res >= 0 ? "+" : ""}${res.toFixed(0)}  [dt:res ${more.join(" ")}] pre ${(b.t - last.t).toFixed(0)}`);
    }
    // Ticks
    const series = new Map<string, number[]>();
    for (const h of fx.hits) if (HOLD_SERIES[h.event]) series.set(`${h.event}|${h.operator}`, [...(series.get(`${h.event}|${h.operator}`) ?? []), h.t]);
    for (const [k, ts] of series) {
      const { period } = HOLD_SERIES[k.split("|")[0]!]!;
      const u = [...new Set(ts)].sort((x, y) => x - y);
      const i = u.findIndex((t) => t > b.t);
      if (i <= 0) continue;
      const [p, n] = [u[i - 1]!, u[i]!];
      if (n - p > period + 1500 || n - p < 0.5 * period) continue;
      const fa = frameOf(p), fz = frameOf(n);
      const straddle = stops.some((st) => st.scales.some((x) => x < 1) && st.start < fz && st.start + st.scales.length > fa && (st.start < fa || st.start + st.scales.length > fz));
      if (straddle) continue;
      const res = worldMs(p, n, stops) - period;
      ticks.push({ res, log: short });
      parts.push(`tick ${k.split("|")[0]!.replace(/^buff_/, "").slice(0, 18)} ${(p / 1000).toFixed(2)}→${(n / 1000).toFixed(2)} ${res >= 0 ? "+" : ""}${res.toFixed(0)}`);
    }
    process.stdout.write(`${short} ${(b.t / 1000).toFixed(2)} by ${operatorLabel(data, b.op)} ${b.ev.replace(/^(chr_\d+_[a-z0-9]+_|buff_)/, "")} [${inStopNow.join(", ")}]\n    ${parts.join("\n    ")}\n`);
  }
}
for (const role of ["breaker", "other"]) {
  const r = rows.filter((x) => x.role === role).map((x) => x.res);
  process.stdout.write(`${role}: n=${r.length} median ${med(r).toFixed(0)} ms; within 0.25–0.8 s: ${r.filter((x) => x > 250 && x < 800).length}; |r|<150: ${r.filter((x) => Math.abs(x) < 150).length}\n`);
}
process.stdout.write(`ticks: n=${ticks.length} median ${med(ticks.map((x) => x.res)).toFixed(0)}\n`);
