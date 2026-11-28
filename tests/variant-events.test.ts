// A logged cast event of a skill the log never shows a hit of, beside a placed cast of its button's other variant
// (packages/logs logcasts.ts buttonVariants, castassembly.ts variantCastOf): the variant's own event.
// pending/zmdlogs-db8711232de9.json: Laevatain's four battle-skill presses in Twilight are logged as normal_skill and
// are normal_skill_during_ult, placed from their hits; made as casts of their own too, each forced a normal_skill whose
// explosion and ticks the log never shows, and took the Link stack Camille's combo gave, which every logged
// during-ult hit carries (×1.3). Purrchena's battle skill, which makes her counter ready, isn't a variant of it.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { secondsOf } from "@efsim/engine";
import { devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx;
const LAEV = "chr_0016_laevat";

describe("a cast event logged as its button's other variant", () => {
  const { replay } = logBuffReplay(data, fixture("db87"));
  it("makes db87's Twilight presses only as normal_skill_during_ult", () => {
    const made = replay.made.filter((m) => m.cast.operator === LAEV && m.skillId.startsWith(`${LAEV}_normal_skill`));
    expect(made.map((m) => m.skillId)).toEqual(Array(4).fill(`${LAEV}_normal_skill_during_ult`));
  });

  it("gives each Twilight battle skill the Link stack, the 27.13 s one pressed before Si's ultimate", () => {
    const hits = replay.hits.filter((h) => h.operator === LAEV && h.skillId === `${LAEV}_normal_skill_during_ult`);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.filter((h) => !(h.modifiers ?? []).some((m) => m.source === "Link (1)"))).toEqual([]);
    const si = replay.hits.filter((h) => h.operator === "chr_0036_jsspsi" && h.skillId === "chr_0036_jsspsi_ultimate_skill");
    expect(si.filter((h) => (h.modifiers ?? []).some((m) => String(m.source).startsWith("Link")))).toEqual([]);
  });

  // Purrchena's counter is her battle skill's follow-up variant: every press of the button is logged as normal_skill.
  // A counter whose headbutt (frame 9) lands 0.27–0.29 s after an event is that event's; a hitless event while her
  // kit holds the counter is a press that found nothing (the enemy away). Team SP 2026-11-28: 621 SP short before.
  const PURR = "chr_0038_purrche";
  const r04 = logBuffReplay(data, fixture("04d4")).replay;
  it("keeps Purrchena's logged battle-skill presses (04d4): her counter follows them", () => {
    expect(r04.made.filter((m) => m.skillId === `${PURR}_normal_skill`).length).toBeGreaterThan(0);
  });

  it("takes a counter placed at its event for the event, and skips hitless presses while the counter is readied (04d4)", () => {
    const at = (s: number) => (m: { frame: number }) => Math.abs(secondsOf(m.frame) - s) < 0.1;
    // The counter at 269.81 s, placed from its 270.10 s headbutt: one cast, not a battle skill beside it.
    expect(r04.made.filter((m) => m.cast.operator === PURR && at(269.81)(m)).map((m) => m.skillId)).toEqual([`${PURR}_normal_skill_counter`]);
    // The presses in the 381.6–420.2 s away stretch: battle skills at 392.10, 403.18 and 415.68 s, the others skipped.
    const skipped = r04.skipped.filter((x) => x.cast.operator === PURR && x.cast.skillId === `${PURR}_normal_skill`).map((x) => Math.round(secondsOf(x.frame) * 10) / 10);
    expect(skipped).toEqual(expect.arrayContaining([264.3, 395.8, 400.3, 407.5]));
    expect(r04.spTopUps.filter((x) => x.operator === PURR)).toEqual([]);
  });
});
