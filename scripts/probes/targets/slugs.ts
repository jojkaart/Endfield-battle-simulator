// Hard 33's Woodcraft Slugs, 2026-11-27 (the slug round; fixture field severalTargets of 6339 and 7b54): per
// development log against eny_0129_slwood_hdg033, the logged total in Max HP (the data's, level 90: 110,060), each
// kill (a hit capped at the HP left, `uncapped` above its value) with the damage logged up to and including its ms in
// slugs of 1.2 Max HP, the kills at one ms (two targets killed by one hit: one enemy can't die twice), and the pairs of
// hits of one event key at one ms whose values differ (one hit on two targets with different debuffs). 2026-11-27:
// 6339 total 9.600 Max HP (8 slugs of 1.2), eight kills at 1.00 (10.35 s), 3.00 (11.31 s: two at one ms from one
// uncapped 121,248), 4.46, 5.00, 6.00, 7.00 and 8.00 slugs; 7b54 total 9.600, seven kills at 2.07 (16.36 s: two at one
// ms), 3.03, 4.01, 6.57 and 8.00 (48.06 s: two at one ms), one slug's death without a capped hit; one event key at one
// ms with differing values 5 times in 6339, 17 in 7b54 (Si's combo slashes 6040 / 6569 / 9853 at 15.60 s: one slash on
// slugs with different debuffs). The stage's text (I18nTextTable_EN, indie_hard033's
// dungeonDesc): "They are legion", each slug restores its shield stacks by burrowing, one random slug loses them for
// good and its death unshields another. The data's number shield (buff_common_eny_numshield) adds −9999 in the product
// zone: a shielded slug's hits deal 0 and aren't logged.
//
//   node scripts/probes/targets/slugs.ts
//
// Development logs only (devFixtures). Writes nothing.
import { loadGameData } from "@efsim/data";
import { Attr } from "@efsim/engine";
import { devFixtures } from "@efsim/logs";

const SLUG = "eny_0129_slwood_hdg033";
/** A slug's HP in the data's Max HP (the fights' totals: 9.6 Max HP = 8 × 1.2). */
const SLUG_HP = 1.2;
const data = loadGameData();

for (const { short, fx } of devFixtures({})) {
  if (fx.enemy.id !== SLUG) continue;
  const max = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp] ?? NaN;
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const total = hits.reduce((s, h) => s + h.value, 0);
  const upTo = (t: number) => hits.filter((h) => h.t <= t).reduce((s, h) => s + h.value, 0);
  const caps = hits.filter((h) => h.uncapped !== undefined && h.uncapped !== null && h.uncapped > h.value);
  const capMs = [...new Set(caps.map((h) => h.t))];
  const kills = capMs.map((t) => {
    const n = caps.filter((h) => h.t === t).length;
    return `${(t / 1000).toFixed(2)} s ${(upTo(t) / (SLUG_HP * max)).toFixed(2)}${n > 1 ? ` (${n} at one ms)` : ""}`;
  });
  const byKey = new Map<string, number[]>();
  for (const h of hits) byKey.set(`${h.t}|${h.operator}|${h.event}`, [...(byKey.get(`${h.t}|${h.operator}|${h.event}`) ?? []), h.value]);
  const differing = [...byKey.entries()].filter(([, v]) => new Set(v).size > 1);
  process.stdout.write(
    `${short}: total ${total} = ${(total / max).toFixed(3)} Max HP (${max}) = ${(total / (SLUG_HP * max)).toFixed(2)} slugs of ${SLUG_HP}; kills: ${kills.join(", ")}\n` +
      `  one event key at one ms with differing values: ${differing.length} (${differing.slice(0, 6).map(([k, v]) => `${(Number(k.split("|")[0]) / 1000).toFixed(2)} s ${(k.split("|")[2] as string).replace(/^chr_\d+_[a-z]+_/, "")} ${[...new Set(v)].join(" / ")}`).join("; ")}${differing.length > 6 ? "; …" : ""})\n`,
  );
}
