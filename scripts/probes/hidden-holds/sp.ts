// Probe (scripts/probes/README.md): hidden-holds round (2026-11-23): the placed holds read as perfect dodges against the Team SP the replay lacks.
// Promoted from that round's scratch/hh/sp.ts unchanged but for this header; run it from the repository root.
// Team SP: do the placed holds, read as perfect dodges (7 SP each, a 0.512 s world hold each by the data), cover the
// SP the replay lacks at logged casts (BuffReplay.spTopUps)? A ledger: each dodge's SP at its time is credit for the
// casts after it (overflow at the cap ignored: an upper bound on what they cover).
import { loadGameData } from "@efsim/data";
import { SP } from "@efsim/engine";
import { devFixtures, logBuffReplay, placeHits } from "@efsim/logs";

const data = loadGameData();
const pd = data.constants.perfectDodge!;
const dodgeFrames = pd.slowdown.reduce((t, x) => t + (1 - x), 0);
const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
let [lackAll, coveredAll, dodgesAll, shortLogs, shortAfter, castsShort] = [0, 0, 0, 0, 0, 0];
process.stdout.write(`SP max ${SP.max}, a dodge ${pd.sp} SP and ${(dodgeFrames / 30).toFixed(3)} s\n`);
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"], ...(ids.length ? { ids } : {}) })) {
  const r = logBuffReplay(data, fx, placeHits(data, fx), { assume: { "hidden-holds": "placed" } }).replay;
  const holds = r.hiddenHolds?.holds ?? [];
  // Dodges: each dodgeFrames of hold, at the frame its cumulative hold reaches it.
  const dodges: number[] = [];
  let acc = 0;
  for (const h of holds) {
    acc += h.frames;
    while (acc >= (dodges.length + 1) * dodgeFrames) dodges.push(h.frame);
  }
  const lack = r.spTopUps.reduce((t, x) => t + x.sp, 0);
  let credit = 0;
  let covered = 0;
  let left = 0;
  let di = 0;
  for (const x of [...r.spTopUps].sort((a, b) => a.frame - b.frame)) {
    while (di < dodges.length && (dodges[di] as number) <= x.frame) {
      credit += pd.sp;
      di++;
    }
    const c = Math.min(credit, x.sp);
    credit -= c;
    covered += c;
    if (x.sp - c > 0.5) left++;
  }
  lackAll += lack;
  coveredAll += covered;
  dodgesAll += dodges.length;
  if (lack > 0.5) shortLogs++;
  if (lack - covered > 0.5) shortAfter++;
  castsShort += r.spTopUps.length;
  process.stdout.write(`${short}: ${r.spTopUps.length} casts short ${lack.toFixed(0)} SP; holds ${(acc / 30).toFixed(2)} s = ${dodges.length} dodges = ${dodges.length * pd.sp} SP; covered ${covered.toFixed(0)}, left ${(lack - covered).toFixed(0)} at ${left} casts${process.argv.includes("--verbose") ? `: ${r.spTopUps.map((x) => `${(x.frame / 30).toFixed(1)} s ${x.operator.slice(4, 12)} ${x.sp.toFixed(0)}`).join(", ")}` : ""}\n`);
}
process.stdout.write(`all: ${shortLogs} logs short, ${castsShort} casts, ${lackAll.toFixed(0)} SP; ${dodgesAll} dodges (${dodgesAll * pd.sp} SP) cover ${coveredAll.toFixed(0)}; ${shortAfter} logs still short, ${(lackAll - coveredAll).toFixed(0)} SP\n`);
