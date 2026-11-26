// Round 6 (2026-11-26, what ends Arcane's Doubles Susceptibility): every run of her combo Susceptibility (doubles) in
// the development logs: start, last listed, next unlisted, world length, and what sits at its end (Si's combo slashes
// and final, another Arcane combo, the seal's tick). `node scripts/probes/kits/arcane-doubles-runs.ts [id prefix]`,
// one line per run on stdout.
import { loadGameData } from "@efsim/data";
import { buffLanes, devFixtures, replayTimeStops, worldMs } from "@efsim/logs";

const data = loadGameData();
const ARC = "chr_0032_lizhiyan";
const SI = "chr_0036_jsspsi";
const only = process.argv[2];
for (const { short, fx } of devFixtures({ withOperators: [ARC] })) {
  if (only && !short.startsWith(only)) continue;
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const ultTimes = new Set(hits.filter((h) => h.operator === ARC && /ultimate_skill/.test(h.event)).map((h) => h.t));
  const lanes = buffLanes(fx, /vulnerable_natural/).filter((l) => l.source === ARC && l.since !== null && !ultTimes.has(l.since));
  if (!lanes.length) continue;
  let stops: ReturnType<typeof replayTimeStops> = [];
  try {
    stops = replayTimeStops(data, fx);
  } catch {
    stops = [];
  }
  const casts = (fx.casts ?? []).filter((c) => c.operator === ARC || c.operator === SI);
  for (const l of lanes) {
    const since = l.since as number;
    const end = l.nextUnlisted;
    const worldLast = worldMs(since, l.lastListed, stops);
    const worldNext = end === null ? null : worldMs(since, end, stops);
    const atLast = hits.filter((h) => h.t === l.lastListed).map((h) => `${h.operator.slice(9)}:${h.event.replace(/^chr_00\d+_[a-z]+_/, "").replace(/^buff_chr_00\d+_[a-z]+_/, "")}`);
    const atNext = end === null ? [] : hits.filter((h) => h.t === end).map((h) => `${h.operator.slice(9)}:${h.event.replace(/^chr_00\d+_[a-z]+_/, "").replace(/^buff_chr_00\d+_[a-z]+_/, "")}`);
    const evs = casts.filter((c) => c.t >= since - 600 && c.t <= (end ?? l.lastListed) + 50).map((c) => `${c.operator.slice(9)}:${c.skill.replace(/^chr_00\d+_[a-z]+_/, "")}@${(c.t / 1000).toFixed(2)}`);
    // Si's combo slashes inside the run and right after.
    const siCombo = hits.filter((h) => h.operator === SI && /combo_skill_abilityrange/.test(h.event) && h.t >= since - 2000 && h.t <= (end ?? l.lastListed) + 1500);
    const siFinal = siCombo.filter((h) => h.value > 3 * Math.min(...siCombo.map((x) => x.value)));
    process.stdout.write(
      `${short} since ${(since / 1000).toFixed(2)} last ${(l.lastListed / 1000).toFixed(2)}${l.boundaryOnly ? "B" : ""} next ${end === null ? "end" : (end / 1000).toFixed(2)} world ${(worldLast / 1000).toFixed(2)}/${worldNext === null ? "-" : (worldNext / 1000).toFixed(2)} val ${l.values.join(",")} | at last: ${[...new Set(atLast)].join(" ")} | at next: ${[...new Set(atNext)].join(" ")} | events ${evs.join(" ")} | Si combo ${siCombo.length ? `${(siCombo[0].t / 1000).toFixed(2)}–${(siCombo.at(-1)!.t / 1000).toFixed(2)} final ${siFinal.map((h) => (h.t / 1000).toFixed(2)).join(",")}` : "-"}\n`,
    );
  }
}
