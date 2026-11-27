// Where the hold sits against a logged break's ms: per break, each clock's lateness up to the break's ms (pre: a
// landing at the break's ms against the clock's last one before), after it (post: the next landing against one at the
// break's ms) and across it (span: last before to next after, none at the ms); the gaps to the moments either side.
// Its stops are the log tools' (replayTimeStops), without the breaks' own holds, so a clock spanning a hold runs late.
// 2026-11-27 (the break's open points): of the 22 breaks a clock reads, 16 late after the ms only (pre −149 … +93 ms),
// 9090afbacec9 128.92 s late before it only (pre +320, post −15), c4f307cd039a 33.58 s and 5082ceaffad1 44.43 s on
// both sides (+381 / +124, +210 / +289), b6aa15281db4 45.68 s +412 before (Last Rite's own ultimate, a cast logged at
// its stop's end); the gaps (holds.ts breakHoldStarts): no logged moment falls inside a hold.
//   node scripts/probes/stagger/break-place.ts [fixture id]       STRADDLE=1: keep pairs across other casts' stops
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { devFixtures, placeHits, replayTimeStops, worldMs, HOLD_SERIES, operatorLabel, loggedBreaks } from "@efsim/logs";

const data = loadGameData();
const msOf = (f: number) => (f * 1000) / FPS;
const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);
const only = process.argv[2];
const straddleOk = !!process.env.STRADDLE;
const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]! : NaN);
const AT = 30;
const out: { log: string; t: number; gb: number; ga: number; pre: number[]; post: number[]; span: number[]; inStop: string; ev: string }[] = [];
for (const { short, fx } of devFixtures(only ? { ids: [only] } : {})) {
  if (fx.hits.some((h: any) => h.target)) continue;
  const placement = placeHits(data, fx);
  const stops = replayTimeStops(data, fx, placement);
  const moments = [...new Set(fx.hits.map((h) => h.t))].sort((a, b) => a - b);
  const byCast = new Map<any, { t: number; frame: number }[]>();
  for (const [h, p] of placement.hits) if (p.frame !== undefined && p.cast.kind !== null) byCast.set(p.cast, [...(byCast.get(p.cast) ?? []), { t: h.t, frame: p.frame }]);
  const series = new Map<string, number[]>();
  for (const h of fx.hits) if (HOLD_SERIES[h.event]) series.set(`${h.event}|${h.operator}`, [...(series.get(`${h.event}|${h.operator}`) ?? []), h.t]);
  for (const tb of loggedBreaks(fx)) {
    const i = moments.indexOf(tb);
    const gb = i > 0 ? tb - moments[i - 1]! : NaN, ga = i < moments.length - 1 ? moments[i + 1]! - tb : NaN;
    const fb = frameOf(tb);
    const inStop = stops.filter((st) => st.start <= fb + 2 && st.start + st.scales.length >= fb - 2 && st.scales.some((x) => x < 1)).map((st) => `${operatorLabel(data, st.operator)} ${st.kind}`).join(", ");
    const pre: number[] = [], post: number[] = [], span: number[] = [];
    const lines: string[] = [];
    for (const [c, list0] of byCast) {
      const others = stops.filter((st) => st.operator !== c.operator);
      const inOther = (t: number) => others.some((st) => st.scales.some((x) => x < 1) && frameOf(t) >= st.start - 2 && frameOf(t) < st.start + st.scales.length + 2);
      const list = list0.filter((x) => straddleOk || !inOther(x.t)).sort((x, y) => x.t - y.t || x.frame - y.frame);
      const ref = list.filter((x) => x.t < tb - AT && x.t >= tb - 2500).at(-1);
      const at = list.find((x) => Math.abs(x.t - tb) <= AT);
      const nxt = list.find((x) => x.t > tb + AT && x.t <= tb + 1500 && x.frame > (at ?? ref ?? { frame: -1 }).frame);
      const res = (x: { t: number; frame: number }, y: { t: number; frame: number }) => {
        if (y.frame <= x.frame) return null;
        if (!straddleOk) {
          const fa = frameOf(x.t), fz = frameOf(y.t);
          if (others.some((st) => st.scales.some((s) => s < 1) && st.start < fz && st.start + st.scales.length > fa)) return null;
        }
        return worldMs(x.t, y.t, others) - msOf(y.frame - x.frame);
      };
      const who = `${operatorLabel(data, c.operator)} ${c.skillId.replace(/^chr_\d+_[a-z0-9]+_/, "")}`;
      if (ref && at) {
        const r = res(ref, at);
        if (r !== null) (pre.push(r), lines.push(`pre  ${who} ${(ref.t / 1000).toFixed(2)}→${(at.t / 1000).toFixed(2)} ${r.toFixed(0)}`));
      }
      if (at && nxt) {
        const r = res(at, nxt);
        if (r !== null) (post.push(r), lines.push(`post ${who} ${(at.t / 1000).toFixed(2)}→${(nxt.t / 1000).toFixed(2)} ${r.toFixed(0)}`));
      }
      if (!at && ref && nxt) {
        const r = res(ref, nxt);
        if (r !== null) (span.push(r), lines.push(`span ${who} ${(ref.t / 1000).toFixed(2)}→${(nxt.t / 1000).toFixed(2)} ${r.toFixed(0)}`));
      }
    }
    for (const [k, ts] of series) {
      const { period } = HOLD_SERIES[k.split("|")[0]!]!;
      const u = [...new Set(ts)].sort((x, y) => x - y);
      const at = u.find((x) => Math.abs(x - tb) <= AT);
      const ref = u.filter((x) => x < tb - AT).at(-1);
      const nxt = u.find((x) => x > tb + AT);
      const ok = (a: number, b: number) => b - a >= 0.5 * period && b - a <= period + 1500 && (straddleOk || !stops.some((st) => st.scales.some((x) => x < 1) && st.start < frameOf(b) && st.start + st.scales.length > frameOf(a)));
      const name = `tick ${k.split("|")[0]!.replace(/^buff_/, "").slice(0, 22)}`;
      if (at !== undefined && ref !== undefined && ok(ref, at)) (pre.push(worldMs(ref, at, stops) - period), lines.push(`pre  ${name} ${(worldMs(ref, at, stops) - period).toFixed(0)}`));
      if (at !== undefined && nxt !== undefined && ok(at, nxt)) (post.push(worldMs(at, nxt, stops) - period), lines.push(`post ${name} ${(worldMs(at, nxt, stops) - period).toFixed(0)}`));
      if (at === undefined && ref !== undefined && nxt !== undefined && ok(ref, nxt)) (span.push(worldMs(ref, nxt, stops) - period), lines.push(`span ${name} ${(worldMs(ref, nxt, stops) - period).toFixed(0)}`));
    }
    const brk = fx.hits.find((h) => h.t === tb && h.poise?.bar === 0);
    const ev = brk ? `${operatorLabel(data, brk.operator)} ${brk.event.replace(/^(chr_\d+_[a-z0-9]+_|buff_)/, "")}` : "?";
    out.push({ log: short, t: tb, gb, ga, pre, post, span, inStop, ev });
    process.stdout.write(`${short} ${(tb / 1000).toFixed(2)} gaps ${gb}/${ga} pre ${med(pre).toFixed(0)} post ${med(post).toFixed(0)} span ${med(span).toFixed(0)} | ${ev} [${inStop}]\n${lines.map((l) => "    " + l + "\n").join("")}`);
  }
}
process.stdout.write("\nSUMMARY (pre: lateness up to the break's ms; post: after it; class by pre median: end > 250, start < 150)\n");
for (const o of out) {
  const p = med(o.pre), q = med(o.post), s = med(o.span);
  const cls = Number.isNaN(p) ? "-" : p > 250 ? "END" : p < 150 ? "start" : "mid";
  process.stdout.write(`${o.log} ${(o.t / 1000).toFixed(2).padStart(7)} ${cls.padEnd(5)} gaps ${String(o.gb).padStart(5)}/${String(o.ga).padStart(5)} pre ${String(Number.isNaN(p) ? "" : p.toFixed(0)).padStart(5)} post ${String(Number.isNaN(q) ? "" : q.toFixed(0)).padStart(5)} span ${String(Number.isNaN(s) ? "" : s.toFixed(0)).padStart(5)}  ${o.ev} [${o.inStop}]\n`);
}
