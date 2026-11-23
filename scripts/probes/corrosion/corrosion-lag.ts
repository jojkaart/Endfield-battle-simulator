// Probe (scripts/probes/README.md): four smaller leads (2026-11-23): Corrosion's ramp read as resistance steps per hit; input `efsim zmdlogs hits --all --json > scratch/all-hits.jsonl`.
// Promoted from that round's scratch/corrosion-lag.ts unchanged but for this header; run it from the repository root.
// Corrosion ramps: per hit with the replay's Corrosion shred, the step the logged value implies (only the resistance
// zone moved), and the bounds that puts on the log's extra world hold (lag) against the replay's ramp. Per instance,
// the stops between its application and each hit: ultimate stops overlapping combo slow-downs (what rule T3's "sum"
// would add: the combo's held frames inside the ultimate's stop).
// Usage: node scratch/corrosion-lag.ts scratch/all-hits.jsonl [--log <id>]
import { readFileSync } from "node:fs";
import { loadGameData } from "@efsim/data";
import { artsIntensityEffect, FPS } from "@efsim/engine";
import { castTimeStops, placeHits, devFixtures, type TimeStop } from "@efsim/logs";

const file = process.argv[2] ?? "scratch/all-hits.jsonl";
const only = process.argv.includes("--log") ? process.argv[process.argv.indexOf("--log") + 1] : null;
const data = loadGameData();
const initial = [3.6, 4.8, 6, 7.2];
const perSecond = [0.84, 1.12, 1.4, 1.68];
const maxs = [12, 16, 20, 24];

interface Row { log: string; t: number; op: string; level: number; applied: number; ai: number; shred: number; implied: number; kR: number; kL: number | null; lo: number; hi: number; ratio: number }
const rows: Row[] = [];
for (const line of readFileSync(file, "utf8").split("\n")) {
  if (!line.startsWith("{")) continue;
  const d = JSON.parse(line);
  const L = d.landing;
  if (!L || !d.predicted || d.crit === null) continue;
  const log = String(d.fixture).split("zmdlogs-")[1]?.slice(0, 4) ?? "?";
  if (only && log !== only) continue;
  const mod = (L.modifiers ?? []).find((m: { source: string }) => /^Corrosion level/.test(m.source));
  const c = (L.enemy ?? []).find((e: { status: string }) => e.status === "corrosion");
  if (!mod || !c) continue;
  const res = L.zones.resistance as number;
  const ratio = d.value / d.predicted;
  const impliedZone = res * ratio;
  const implied = mod.value + (impliedZone - res) * 100;
  const k = artsIntensityEffect(c.artsIntensity);
  const i = c.level - 1;
  const s0 = initial[i]! * k;
  const ps = perSecond[i]! * k;
  const cap = maxs[i]! * k;
  const e = d.t - c.appliedAtMs;
  const kR = Math.floor(Math.max(0, e) / 1000);
  const expect = kR === 0 ? s0 : Math.min(cap, s0 + ps * kR);
  if (Math.abs(expect - mod.value) > 0.05) continue; // carried shred or a cap scale: skip
  // The log's step: the nearest step value within 0.25 points (else other zones differ).
  let kL: number | null = null;
  for (let j = 0; j <= 40; j++) {
    const v = j === 0 ? s0 : Math.min(cap, s0 + ps * j);
    if (Math.abs(v - implied) < 0.25) { kL = j; break; }
    if (v >= cap) break;
  }
  // At the cap, every later step reads the same: no bound from above.
  const atCap = kL !== null && s0 + ps * kL >= cap - 1e-9;
  const lo = kL === null ? NaN : e - (atCap ? Infinity : (kL + 1) * 1000);
  const hi = kL === null ? NaN : e - kL * 1000;
  rows.push({ log, t: d.t, op: String(c.operator).slice(9, 17), level: c.level, applied: c.appliedAtMs, ai: c.artsIntensity, shred: mod.value, implied, kR, kL, lo, hi, ratio });
}

// Stops per log (the placement's).
const stopsBy = new Map<string, TimeStop[]>();
for (const { short, fx } of devFixtures({})) {
  if (!rows.some((r) => r.log === short.slice(0, 4))) continue;
  stopsBy.set(short.slice(0, 4), castTimeStops(data, placeHits(data, fx).casts));
}
const msOf = (f: number) => (f * 1000) / FPS;

// Per instance: consecutive rows of a log with the same level and operator and an application within the last 20 s.
const byInst = new Map<string, Row[]>();
rows.sort((a, b) => a.log.localeCompare(b.log) || a.t - b.t);
let cur: { key: string; prev: Row } | null = null;
for (const r of rows) {
  if (!cur || cur.prev.log !== r.log || cur.prev.level !== r.level || cur.prev.op !== r.op || r.applied - cur.prev.applied > 3000 || r.applied < cur.prev.applied - 100) cur = { key: `${r.log}|${r.level}|${r.op}|${r.t}`, prev: r };
  cur.prev = r;
  byInst.set(cur.key, [...(byInst.get(cur.key) ?? []), r]);
}
for (const [key, list] of byInst) {
  list.sort((a, b) => a.t - b.t);
  const log = key.split("|")[0] as string;
  const stops = stopsBy.get(log) ?? [];
  const first = list[0] as Row;
  // Ultimate stops overlapping a combo slow-down between the first application seen and the last hit.
  const from = Math.round((Math.min(...list.map((r) => r.applied)) - 3000) * FPS / 1000);
  const to = Math.round(((list.at(-1) as Row).t * FPS) / 1000);
  const ult = stops.filter((s) => s.kind === "ultimate" && s.start < to && s.start + s.scales.length > from);
  const combos = stops.filter((s) => s.kind !== "ultimate" && s.start < to && s.start + s.scales.length > from);
  let sumExtra = 0;
  for (const c of combos) {
    for (let k = 0; k < c.scales.length; k++) {
      const f = c.start + k;
      const underUlt = ult.some((u) => f >= u.start && f < u.start + u.scales.length && (u.scales[f - u.start] as number) < 1);
      if (underUlt) sumExtra += 1 - (c.scales[k] as number);
    }
  }
  const valid = list.filter((r) => r.kL !== null);
  if (valid.length === 0) continue;
  const lo = Math.max(...valid.map((r) => r.lo));
  const hi = Math.min(...valid.map((r) => r.hi));
  const moved = valid.filter((r) => r.kL !== r.kR);
  process.stdout.write(`${key}: ${list.length} hits (${valid.length} read, ${moved.length} off the replay's step), applied ${first.applied} ms; log's extra hold ${Number.isFinite(lo) ? Math.round(lo) : "-inf"}..${Math.round(hi)} ms${lo > hi ? " (no single lag)" : ""}; sum-over-lowest under ultimate stops ${Math.round(msOf(sumExtra))} ms (${ult.map((u) => `${u.operator.slice(9, 17)}@${(msOf(u.start) / 1000).toFixed(2)}`).join(",")} / ${combos.map((c) => `${c.operator.slice(9, 17)}@${(msOf(c.start) / 1000).toFixed(2)}`).join(",")})\n`);
  if (process.argv.includes("--verbose")) for (const r of list) process.stdout.write(`    ${r.t} ${r.op} replay k ${r.kR} shred ${r.shred.toFixed(2)}, log k ${r.kL ?? "?"} (${r.implied.toFixed(2)}), ×${r.ratio.toFixed(4)}, lag ${Math.round(r.lo)}..${Math.round(r.hi)}\n`);
}
