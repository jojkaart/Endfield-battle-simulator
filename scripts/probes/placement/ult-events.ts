// Placement leads (2026-11-24): is an ultimate's cast event logged at its press or at its stop's end? Run:
// node scripts/probes/placement/ult-events.ts (every development log; prints a line per event, then counts per operator).
// Per ultimate cast event (the first of a group) of a skill whose timing stops the world: where the event sits in the
// stretch without logged hits around it. press-like: the last hit just before, the next much later; end-like: the reverse.
// The rule is @efsim/logs castEventPlace since round 11 (`zmdlogs instances` and `replay`'s EVENT lines print it);
// "mid" here is its "inside" and "unclear" together.
import { loadGameData } from "@efsim/data";
import { castEventPlace, devFixtures } from "@efsim/logs";
import { FPS } from "@efsim/engine";

const data = loadGameData();
const rows: string[] = [];
const byOp = new Map<string, { press: number; end: number; mid: number }>();
for (const { short, fx } of devFixtures({})) {
  const hits = [...fx.hits].sort((a, b) => a.t - b.t).map((h) => h.t);
  const last = new Map<string, number>();
  for (const c of fx.casts ?? []) {
    const timing = data.skills[c.skill]?.timing;
    if (!timing || !c.skill.includes("ultimate")) continue;
    const p = castEventPlace(data, hits, c);
    if (!p) continue;
    const key = `${c.operator}|${c.skill}`;
    const prev = last.get(key);
    last.set(key, c.t);
    if (prev !== undefined && c.t - prev < (timing.durationFrames * 1000) / FPS) continue;
    const kind = p.place === "press" || p.place === "end" ? p.place : "mid";
    const op = data.operators[c.operator]?.name ?? c.operator;
    const s = byOp.get(op) ?? { press: 0, end: 0, mid: 0 };
    s[kind]++;
    byOp.set(op, s);
    const gap = (ms: number) => (Number.isFinite(ms) ? String(ms) : "1000000000");
    rows.push(`${short} ${op} ${c.skill.replace(/^chr_\d+_\w+?_/, "")} t=${c.t} stop=${p.stopMs.toFixed(0)} before=${gap(p.before)} after=${gap(p.after)} ${kind}`);
  }
}
process.stdout.write(rows.join("\n") + "\n");
for (const [op, s] of byOp) process.stdout.write(`${op}: press ${s.press} end ${s.end} mid ${s.mid}\n`);
