// Probe (scripts/probes/README.md): team-SP round (2026-11-28): the placed basic-attack casts with SP (their skill's
// `atb` above 0: Final Strikes) none of whose logged hits the replay landed, their SP as credit for the shortfall
// after them (a ledger, the cap ignored: an upper bound), and a count of the candidates and of those with some hit
// unlanded. 2026-11-28, the 15 short development logs: none unlanded, nothing covered (teammates' unlanded Final
// Strikes ruled out as the gap).
//
//   node scripts/probes/sp/unlanded.ts [short id...] [--verbose]      (writes nothing)
import { loadGameData } from "@efsim/data";
import { framesOf, secondsOf } from "@efsim/engine";
import { devFixtures, logBuffReplay, placeHits } from "@efsim/logs";

const data = loadGameData();
const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const atbOf = (skillId: string) => {
  const s = data.skills[skillId];
  const lv = s?.levels?.[s.levels.length - 1];
  return Number(lv?.blackboard?.["atb"] ?? s?.defaults?.["atb"] ?? 0);
};
let [lackAll, coveredAll] = [0, 0]; let cands = 0; let partial = 0;
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"], ...(ids.length ? { ids } : {}) })) {
  const placement = placeHits(data, fx);
  const r = logBuffReplay(data, fx, { placement }).replay;
  const lack = r.spTopUps.reduce((t, x) => t + x.sp, 0);
  if (lack < 0.5) continue;
  // Placed basic casts with SP whose logged hits the replay landed none of.
  const credits: { frame: number; sp: number; what: string }[] = [];
  for (const c of placement.casts) {
    if (c.kind !== "basic") continue;
    const sp = atbOf(c.skillId);
    if (sp <= 0) continue;
    const hits = [...placement.hits].filter(([, p]) => p.cast === c).map(([h]) => h);
    if (!hits.length) continue;
    const landed = hits.some((h) => !("unknown" in r.landing(h))); cands++; if (hits.some((h) => "unknown" in r.landing(h))) partial++;
    if (landed) continue;
    const t = Math.min(...hits.map((h) => h.t));
    const why = r.landing(hits[0]!);
    credits.push({ frame: framesOf(t / 1000), sp, what: `${secondsOf(framesOf(t / 1000)).toFixed(2)} ${data.operators[c.operator]?.name} ${c.skillId.replace(/^chr_\d+_[a-z]+_/, "")} ${sp} (${"unknown" in why ? why.unknown.slice(0, 90) : ""})` });
  }
  credits.sort((a, b) => a.frame - b.frame);
  let credit = 0;
  let covered = 0;
  let ci = 0;
  for (const x of [...r.spTopUps].sort((a, b) => a.frame - b.frame)) {
    while (ci < credits.length && credits[ci]!.frame <= x.frame) credit += credits[ci++]!.sp;
    const c = Math.min(credit, x.sp);
    credit -= c;
    covered += c;
  }
  lackAll += lack;
  coveredAll += covered;
  process.stdout.write(`${short}: short ${lack.toFixed(0)}; unlanded SP casts ${credits.length} (${credits.reduce((t, x) => t + x.sp, 0)} SP), cover ${covered.toFixed(0)}\n`);
  if (process.argv.includes("--verbose")) for (const c of credits) process.stdout.write(`    ${c.what}\n`);
}
process.stdout.write(`candidates ${cands}, some hit unlanded ${partial}\n`); process.stdout.write(`all: short ${lackAll.toFixed(0)}, covered ${coveredAll.toFixed(0)}\nEFSIM-DONE spunlanded pass\n`);
