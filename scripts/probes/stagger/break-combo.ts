// The logged Stagger breaks inside another cast's slow-down (a combo's, or an ultimate's time stop): per break, the
// stops running at its ms (the replay's stop list, replayTimeStops), the break's frame in each and the scale there, the
// next logged moment, where the replay holds it (holds.ts breakStops: its start under break-hold-place, its length
// under break-hold-combo), and the clocks spanning it: each placed cast's landing pair across the break (kit frames)
// and the enemy's tick pairs (holds.ts HOLD_SERIES), their residual under the stop list without the break's hold
// (worldMs less what the pair should take; a full hold is about +467 ms, the combos' own per-episode excess about
// +160–240 ms on top where the pair spans a combo's first half).
// 2026-11-28 (the break-combo round): 18 breaks inside a combo's slow-down in the development logs; the clocks across
// a7a7a40c97ed 48.14 s, f879aea2 57.12 s (Wulfgard's grenade at its combo's frame 12) and c83c75d02a85 55.83 s (Si's
// own combo) show a full hold, f57452bc1f02 35.68 s (Chen Qianyu's Lift at her combo's frame 17) +238 ms across the
// whole combo, 458b03609665 85.57 s (with the held-back ultimate-event diff: Si's burst at Laevatain's combo's frame
// 14) the enemy's tick due inside the moments' hold and logged at its end.
//   node scripts/probes/stagger/break-combo.ts [fixture id]     ASSUME=break-hold-combo=added (the replay's hold)
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { devFixtures, placeHits, replayTimeStops, worldMs, HOLD_SERIES, operatorLabel, loggedBreaks, breakStops } from "@efsim/logs";

const data = loadGameData();
const msOf = (f: number) => (f * 1000) / FPS;
const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);
const only = process.argv[2];
const assume = process.env.ASSUME ? Object.fromEntries([process.env.ASSUME.split("=") as [string, string]]) : undefined;
const AT = 30;
const short = (s: string) => s.replace(/^(chr_\d+_[a-z0-9]+_|buff_)/, "");
for (const { short: log, fx } of devFixtures(only ? { ids: [only] } : {})) {
  if (fx.hits.some((h: any) => h.target)) continue;
  const placement = placeHits(data, fx, assume);
  const stops = replayTimeStops(data, fx, placement);
  const holds = breakStops(fx, stops, assume);
  const moments = [...new Set(fx.hits.map((h) => h.t))].sort((a, b) => a - b);
  const byCast = new Map<any, { t: number; frame: number }[]>();
  for (const [h, p] of placement.hits) if (p.frame !== undefined && p.cast.kind !== null) byCast.set(p.cast, [...(byCast.get(p.cast) ?? []), { t: h.t, frame: p.frame }]);
  const series = new Map<string, number[]>();
  for (const h of fx.hits) if (HOLD_SERIES[h.event]) series.set(`${h.event}|${h.operator}`, [...(series.get(`${h.event}|${h.operator}`) ?? []), h.t]);
  for (const tb of loggedBreaks(fx)) {
    const fb = frameOf(tb);
    const running = stops.filter((st) => (st.kind === "combo" || st.kind === "ultimate") && fb >= st.start && fb < st.start + st.scales.length);
    if (!running.length) continue;
    const next = moments.find((m) => m > tb);
    const brk = fx.hits.find((h) => h.t === tb && h.poise?.bar === 0);
    const hold = holds.find((b) => Math.abs(b.start - fb) <= 15);
    const where = running.map((st) => `${operatorLabel(data, st.operator)} ${st.kind} f${fb - st.start}/${st.scales.length} scale ${(st.scales[fb - st.start] as number).toFixed(2)}`).join("; ");
    const lines: string[] = [];
    for (const [c, list0] of byCast) {
      const others = stops.filter((st) => st.operator !== c.operator);
      const list = [...list0].sort((x, y) => x.t - y.t || x.frame - y.frame);
      const before = list.filter((x) => x.t < tb - AT && x.t >= tb - 2500).at(-1);
      const after = list.find((x) => x.t > tb + AT && x.t <= tb + 1500 && x.frame > (before?.frame ?? -1));
      if (!before || !after || after.frame <= before.frame) continue;
      const r = worldMs(before.t, after.t, others) - msOf(after.frame - before.frame);
      lines.push(`cast ${operatorLabel(data, c.operator)} ${short(c.skillId)} ${(before.t / 1000).toFixed(2)}→${(after.t / 1000).toFixed(2)} ${r.toFixed(0)}`);
    }
    for (const [k, ts] of series) {
      const { period } = HOLD_SERIES[k.split("|")[0]!]!;
      const u = [...new Set(ts)].sort((x, y) => x - y);
      const before = u.filter((x) => x < tb - AT).at(-1);
      const after = u.find((x) => x > tb - AT);
      if (before === undefined || after === undefined || after - before < 0.5 * period || after - before > period + 3000) continue;
      const r = worldMs(before, after, stops) - period;
      lines.push(`tick ${short(k.split("|")[0]!).slice(0, 24)} ${(before / 1000).toFixed(2)}→${(after / 1000).toFixed(2)} ${r.toFixed(0)}`);
    }
    process.stdout.write(
      `${log} ${(tb / 1000).toFixed(2)} by ${brk ? `${operatorLabel(data, brk.operator)} ${short(brk.event)}` : "?"} | ${where} | next +${next !== undefined ? next - tb : "-"} ms | replay hold ${hold ? `${(msOf(hold.start) / 1000).toFixed(2)} s, ${hold.scales.length}f` : "none"}\n${lines.map((l) => `    ${l}\n`).join("")}`,
    );
  }
}
