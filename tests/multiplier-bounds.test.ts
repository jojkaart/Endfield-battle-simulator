// A consumed-scaled kit hit's multiplier bounds (packages/logs logcasts.ts multiplierBounds; round 23, the
// placement-cases report point 3: 8f32 36.11 s, Rossi's combo 2 hit_2 placed as a combo 3 perfect strike, where no
// value rule could tell the two apart because the perfect strike's multiplier is atk_scale_s + damage_add × consumed).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { computeStats, effectiveKit } from "@efsim/engine";
import { multiplierBounds, nominalScale, readLogFixture } from "@efsim/logs";

const data = loadGameData();
const fx = readLogFixture(join(import.meta.dirname, "../fixtures/pending/zmdlogs-8f3215963333.json"));

describe("multiplierBounds", () => {
  it("bounds Rossi's consumed-scaled combo 3 hits by consumed 0 and 4, and leaves plain hits to nominalScale", () => {
    const build = fx.team.find((b) => b.operator === "chr_0028_wulfa");
    expect(build).toBeDefined();
    if (!build) return;
    const panel = computeStats(data, build);
    const kit = effectiveKit(data, build);
    const combo3 = kit?.skills.find((s) => s.skillId === "chr_0028_wulfa_combo_3_skill");
    const consumed = (combo3?.hits ?? []).filter((h) => JSON.stringify(h.scaleValue ?? null).includes("consumed"));
    expect(consumed.length).toBeGreaterThan(0);
    for (const h of consumed) {
      const b = multiplierBounds(data, build, panel, "chr_0028_wulfa_combo_3_skill", h);
      expect(b).not.toBeNull();
      const [lo, hi] = b as readonly [number, number];
      expect(lo).toBeGreaterThan(0);
      expect(hi).toBeGreaterThan(lo);
      expect(nominalScale(data, build, panel, "chr_0028_wulfa_combo_3_skill", h)).toBeNull();
    }
    // A plain hit has its one multiplier, no bounds.
    const plain = (kit?.skills ?? []).flatMap((s) => s.hits.map((h) => ({ s, h }))).find(({ s, h }) => nominalScale(data, build, panel, s.skillId, h) !== null);
    expect(plain && multiplierBounds(data, build, panel, plain.s.skillId, plain.h)).toBeNull();
  });
});
