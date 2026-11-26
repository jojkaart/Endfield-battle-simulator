// Round "0c14 and the operator curve" (2026-11-26): the totals' matched parts of one fight and operator, predicted vs
// logged, summed per window and crit kind (crit, nocrit, crit?: unknown) and how each was read (exact, critOnly, the
// totals-crits reading or expected crits, primary); --rows each landing.
//   node scripts/probes/totals/parts.ts <fixture id> <operator name> [window s] [--rows] [--assume id=r]
import { loadGameData, operatorId } from "@efsim/data";
import { checkLog, devFixtures, engineHits, engineReport, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const [id, name] = process.argv.slice(2);
const step = Number(process.argv[4] ?? 10);
const rows = process.argv.includes("--rows");
const assume: Record<string, string> = {};
for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === "--assume") {
  const [k, v] = process.argv[i + 1]!.split("=");
  assume[k!] = v!;
}
const op = operatorId(data, name!);
const { fx } = devFixtures({ ids: [id!] })[0]!;
const replay = Object.keys(assume).length ? logBuffReplay(data, fx, undefined, { assume }) : logBuffReplay(data, fx);
const byHit = engineHits(data, fx, replay);
const t = engineReport(data, fx, replay, byHit, checkLog(data, fx, { replay, engineHits: byHit })).totals;
const win = new Map<string, { l: number; p: number; n: number }>();
for (const p of t.parts) {
  if (p.operator !== op || !p.logged) continue;
  const h = p.logged;
  const r = byHit.get(h);
  const kind = h.crit === null ? "crit?" : h.crit ? "crit" : "nocrit";
  const exact = r && r.primary !== null ? (r.primary === h.value ? "exact" : r.expected !== undefined && r.expected === h.value ? "critOnly" : r.expected !== undefined ? "expected" : "primary") : "none";
  if (rows) process.stdout.write(`${(h.t / 1000).toFixed(2)} ${h.event} ${h.value} pred=${Math.round(p.damage)} ratio=${(p.damage / h.value).toFixed(3)} ${kind} ${exact} primary=${r?.primary}\n`);
  const k = `${String(Math.floor(h.t / 1000 / step) * step).padStart(4)} ${kind.padEnd(6)} ${exact}`;
  const e = win.get(k) ?? { l: 0, p: 0, n: 0 };
  e.l += h.value;
  e.p += p.damage;
  e.n++;
  win.set(k, e);
}
for (const [k, e] of [...win].sort()) process.stdout.write(`${k.padEnd(28)} n=${String(e.n).padStart(3)} logged=${String(Math.round(e.l)).padStart(8)} pred=${String(Math.round(e.p)).padStart(8)} diff=${String(Math.round(e.p - e.l)).padStart(8)} ratio=${(e.p / e.l).toFixed(3)}\n`);
