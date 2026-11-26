// A logged cast event of a skill the log never shows a hit of, beside a placed cast of its button's other variant
// (packages/logs logcasts.ts buttonVariants, castassembly.ts variantCastOf): the variant's own event.
// pending/zmdlogs-db8711232de9.json: Laevatain's four battle-skill presses in Twilight are logged as normal_skill and
// are normal_skill_during_ult, placed from their hits; made as casts of their own too, each forced a normal_skill whose
// explosion and ticks the log never shows, and took the Link stack Camille's combo gave, which every logged
// during-ult hit carries (×1.3). Purrchena's battle skill, which makes her counter ready, isn't a variant of it.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
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

  it("keeps Purrchena's logged battle-skill presses (04d4): her counter follows them", () => {
    const r = logBuffReplay(data, fixture("04d4")).replay;
    expect(r.made.filter((m) => m.skillId === "chr_0038_purrche_normal_skill").length).toBeGreaterThan(0);
  });
});
