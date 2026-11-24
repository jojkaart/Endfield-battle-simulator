// Kit buff leads, 2026-11-24 (docs/open-problems.md "Misprediction statistics", Zhuang Fangyi's weapon ultimate buff):
// is each of Zhuang Fangyi's logged ultimate_skill cast events a cast, or the Empyrean's end (ult_base buffEvent 2 casts
// ultimate_skill_end, which the log records under the ultimate's key)? Per event: the seconds since her previous one,
// her logged hits in the 2.6 s (78 frames) an ultimate's time stop would hold, whether her next hits are her Empyrean
// forms (`_ult`) or her plain ones, and whether her first hit after it lists Lone Barge's ultimate buff.
//
//   node scripts/probes/kits/zhuangfy-empyrean-end.ts
//
// Development logs only (devFixtures). Prints one line per event.

import { loadGameData, operatorId } from "@efsim/data";
import { devFixtures } from "@efsim/logs";

const data = loadGameData();
const op = operatorId(data, "Zhuang Fangyi");
const ULT = `${op}_ultimate_skill`;
const STOP_MS = (78 * 1000) / 30;

for (const { short, fx } of devFixtures({ withOperators: [op] })) {
  const events = (fx.casts ?? []).filter((c) => c.operator === op && c.skill === ULT).map((c) => c.t);
  const mine = fx.hits.filter((h) => h.operator === op).sort((a, b) => a.t - b.t);
  let prev: number | undefined;
  for (const t of events) {
    const inStop = mine.filter((h) => h.t > t && h.t < t + STOP_MS).length;
    // Her next hits that are her own attacks or battle skills (not a Sunderblade strike or a reaction's), after the stop's frames.
    const next = mine.filter((h) => h.t > t + STOP_MS && /_(attack\d|normal_skill)/.test(h.event)).slice(0, 3);
    const forms = next.map((h) => (/_ult/.test(h.event) ? "ult" : "plain")).join(",") || "-";
    const first = mine.find((h) => h.t > t + 100);
    const lone = first ? [...first.effects, ...first.boundaryEffects].some((e) => e.buff === "buff_wpn_funnel_0015_ultimate") : undefined;
    const gap = prev === undefined ? "first" : `${((t - prev) / 1000).toFixed(1)} s after the previous`;
    process.stdout.write(
      `${short} ${(t / 1000).toFixed(2)} s (${gap}): ${inStop} hit(s) of hers in the next 2.6 s; next forms ${forms}; Lone Barge's ultimate buff on her next hit: ${lone === undefined ? "-" : lone ? "listed" : "not listed"}\n`,
    );
    prev = t;
  }
}
