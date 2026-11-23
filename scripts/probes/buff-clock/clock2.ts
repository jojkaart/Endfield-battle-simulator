// Probe (scripts/probes/README.md): buff-clock round (2026-11-22): one hidden clock per fight or partition, from scratch/bc/rows.jsonl (lanes.ts); superseded by packages/logs holds.ts for the replay, kept for the partition test.
// Promoted from that round's scratch/bc/clock2.ts unchanged but for this header; run it from the repository root.
// One hidden clock per log (or per partition)? Hidden holds P(t) (ms the placed stops don't explain), nondecreasing
// with slope ≤ 1. Each lane of a buff with a data duration D (canonical seconds) gives
//   P(lo) − P(since) ≥ world(since, lo) − D − tol   and   P(hi) − P(since) ≤ world(since, hi) − D + tol;
// with --ticks each consecutive pair of an enemy 1 s tick series also |P(b) − P(a) − (world(a, b) − 1000)| ≤ tickTol.
// Difference constraints (Bellman-Ford); the lane in a negative cycle with the largest |excess| is dropped until
// feasible. node scratch/bc/clock2.ts <global|owner|holder|side|lane> [tol ms] [--ticks] [--log id] [--verbose]
import { readFileSync } from "node:fs";
import { loadGameData } from "@efsim/data";
import { castTimeStops, devFixtures, placeHits, worldMs } from "@efsim/logs";

type Row = { log: string; buff: string; kit: string; holder: string; source: string; since: number; lo: number; hi: number | null; exact: string; refreshed: boolean; D: number; worldLo: number; worldHi: number | null };
const rows: Row[] = readFileSync("scratch/bc/rows.jsonl", "utf8").trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Row);
const args = process.argv.slice(2);
const partition = args[0] ?? "global";
const tol = Number(args[1] ?? 200);
const withTicks = args.includes("--ticks");
const only = args.includes("--log") ? args[args.indexOf("--log") + 1] : undefined;
const verbose = args.includes("--verbose");
const CANON = [5, 6, 8, 9, 10, 12, 15, 20, 25, 30, 40, 60];
const TICK_TOL = 150;

type C = { a: number; b: number; min: number; max: number; tag: string; ex: number };
const partKey = (r: Row) => (partition === "lane" ? `${r.buff}|${r.holder}|${r.since}` : partition === "global" ? "all" : partition === "holder" ? r.holder : partition === "owner" ? r.source : r.holder === "enemy" ? "enemy" : "team");

function solve(cs: C[]): C[] | null {
  const times = [...new Set(cs.flatMap((c) => [c.a, c.b]))].sort((x, y) => x - y);
  const idx = new Map(times.map((t, i) => [t, i]));
  const edges: { u: number; v: number; w: number; c?: C }[] = [];
  for (let i = 0; i + 1 < times.length; i++) {
    edges.push({ u: i + 1, v: i, w: 0 });
    edges.push({ u: i, v: i + 1, w: (times[i + 1] as number) - (times[i] as number) });
  }
  for (const c of cs) {
    const [a, b] = [idx.get(c.a) as number, idx.get(c.b) as number];
    edges.push({ u: a, v: b, w: c.max, c });
    edges.push({ u: b, v: a, w: -c.min, c });
  }
  const n = times.length;
  const dist = new Array<number>(n).fill(0);
  const pred = new Array<number>(n).fill(-1);
  let last = -1;
  for (let it = 0; it <= n; it++) {
    last = -1;
    for (const [k, e] of edges.entries()) if ((dist[e.u] as number) + e.w < (dist[e.v] as number) - 1e-6) {
      dist[e.v] = (dist[e.u] as number) + e.w;
      pred[e.v] = k;
      last = e.v;
    }
    if (last === -1) return null;
  }
  let v = last;
  for (let i = 0; i < n; i++) v = (edges[pred[v] as number] as { u: number }).u;
  const cyc: C[] = [];
  const start = v;
  do {
    const e = edges[pred[v] as number] as (typeof edges)[number];
    if (e.c && !cyc.includes(e.c)) cyc.push(e.c);
    v = e.u;
  } while (v !== start);
  return cyc;
}

const data = loadGameData();
const fixtures = new Map(devFixtures({ dirs: ["verified", "pending", "multi"] }).map((d) => [d.short, d.fx]));
const TICK = /^(buff_chr_0028_wulfa_normal_bleed|buff_common_burning_status)$/;
let total = 0, dropped = 0, ticksTotal = 0, ticksDropped = 0;
const logs = [...new Set(rows.map((r) => r.log))].filter((l) => !only || l === only);
for (const log of logs) {
  const seen = new Set<string>();
  const lanes: C[] = [];
  const parts = new Map<string, C[]>();
  for (const r of rows.filter((x) => x.log === log)) {
    if (r.refreshed || r.hi === null || r.worldHi === null) continue;
    const D = CANON.find((c) => Math.abs(c - r.D) < 0.15);
    if (D === undefined) continue;
    const exLo = r.worldLo - D, exHi = r.worldHi - D;
    if (exHi < -1 || exLo > 8) continue; // cut short or refreshed unseen
    const k = `${partKey(r)}|${r.buff}|${r.source}|${r.since}|${r.lo}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const tag = `${r.buff} ${r.holder.slice(4, 14)} since ${(r.since / 1000).toFixed(2)} end ${(r.lo / 1000).toFixed(2)}–${(r.hi / 1000).toFixed(2)} excess ${exLo.toFixed(2)}..${exHi.toFixed(2)}`;
    // Upper bound at hi, lower at lo (two constraints on different nodes: encode as two C's).
    const cs: C[] = [
      { a: r.since, b: r.hi, min: -Infinity, max: exHi * 1000 + tol, tag, ex: exHi },
      { a: r.since, b: r.lo, min: exLo * 1000 - tol, max: Infinity, tag, ex: exLo },
    ];
    lanes.push(...cs);
    parts.set(partKey(r), [...(parts.get(partKey(r)) ?? []), ...cs]);
  }
  if (args.includes("--shuffle")) {
    // A null test: each lane's excess bracket moved to another lane of the log (seeded), positions kept.
    let seed = 12345 + log.charCodeAt(0) * 7 + log.charCodeAt(1);
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pairsOf: [C, C][] = [];
    for (let i = 0; i + 1 < lanes.length; i += 2) pairsOf.push([lanes[i] as C, lanes[i + 1] as C]);
    const ex = pairsOf.map(([u, l]) => ({ u: u.max, l: l.min, eu: u.ex, el: l.ex }));
    for (let i = ex.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [ex[i], ex[j]] = [ex[j]!, ex[i]!];
    }
    pairsOf.forEach(([u, l], i) => {
      u.max = ex[i]!.u;
      u.ex = ex[i]!.eu;
      l.min = ex[i]!.l;
      l.ex = ex[i]!.el;
    });
  }
  const ticks: C[] = [];
  const fx = fixtures.get(log);
  if (withTicks && fx && fx.hits.some((h) => TICK.test(h.event))) {
    const stops = castTimeStops(data, placeHits(data, fx).casts);
    const by = new Map<string, number[]>();
    for (const h of fx.hits) if (TICK.test(h.event)) by.set(`${h.operator}|${h.event}|${h.target ?? ""}`, [...(by.get(`${h.operator}|${h.event}|${h.target ?? ""}`) ?? []), h.t]);
    for (const ts0 of by.values()) {
      const ts = [...new Set(ts0)].sort((a, b) => a - b);
      for (let i = 1; i < ts.length; i++) {
        const [a, b] = [ts[i - 1] as number, ts[i] as number];
        if (b - a > 2600 || b - a < 500) continue;
        const h = worldMs(a, b, stops) - 1000;
        ticks.push({ a, b, min: h - TICK_TOL, max: h + TICK_TOL, tag: `tick ${(a / 1000).toFixed(2)}→${(b / 1000).toFixed(2)} hidden ${(h / 1000).toFixed(2)}`, ex: h / 1000 });
      }
    }
  }
  // Ticks are the enemy's: they join the global partition and the enemy side's.
  const groups = partition === "global" ? [[...lanes, ...ticks]] : [...parts].map(([k, cs]) => (k === "enemy" || k === "all" ? [...cs, ...ticks] : cs));
  if (partition !== "global" && ![...parts.keys()].includes("enemy") && ticks.length) groups.push(ticks);
  let logDropped = 0;
  for (let cs of groups) {
    total += new Set(cs.filter((c) => !c.tag.startsWith("tick")).map((c) => c.tag)).size;
    ticksTotal += cs.filter((c) => c.tag.startsWith("tick")).length;
    for (;;) {
      const cyc = solve(cs);
      if (!cyc) break;
      const worst = [...cyc].sort((x, y) => Math.abs(y.ex) - Math.abs(x.ex))[0] as C;
      cs = cs.filter((c) => c.tag !== worst.tag);
      if (worst.tag.startsWith("tick")) ticksDropped++;
      else {
        dropped++;
        logDropped++;
      }
      if (verbose) process.stdout.write(`  ${log} dropped ${worst.tag}\n`);
    }
  }
  if (verbose) process.stdout.write(`${log}: dropped ${logDropped}\n`);
}
process.stdout.write(`partition ${partition}, tol ${tol} ms${withTicks ? ", with tick pairs" : ""}: ${total} lanes, ${dropped} dropped; tick pairs ${ticksTotal}, ${ticksDropped} dropped\n`);
