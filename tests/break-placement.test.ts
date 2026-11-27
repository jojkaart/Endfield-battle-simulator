// The casts placed across a logged Stagger break (docs/open-problems.md "The hold at a Stagger break", 2026-11-27,
// round 3): a new cast's start under engine assumption break-held-starts (logcasts.ts heldBreaks, castStart), and the
// hold's place from the log's moments (break-hold-place `moments`, the default: holds.ts breakHoldStarts).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, placeHits, type LogFixture } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;
const TY = "chr_0034_typhoea";
const ZF = "chr_0030_zhuangfy";

describe("a cast running through a logged break (break-held-starts)", () => {
  // fc63 101.11 s: Arcane's ultimate breaks while Typhoeus's combo (its event at 98.42 s) is held by her ultimate stop;
  // its arrows at 101.87 s at frame 35. Unheld, placed from 99.03 s; held by the break too, 14 frames earlier.
  const combo = (assume?: Record<string, string>) => placeHits(data, fixture("fc63"), assume).casts.find((c) => c.operator === TY && c.skillId === `${TY}_combo_skill` && c.start > 98000 && c.start < 99500);
  it("is placed from its landing alone by default (fc63 99.03 s)", () => {
    expect(combo()?.start).toBeCloseTo(99033, -1);
  });
  it("starts the break's hold earlier under `held` (fc63 98.57 s, after its event at 98.42 s)", () => {
    const held = combo({ "break-held-starts": "held" })?.start as number;
    expect(held).toBeGreaterThan(98420);
    expect(held).toBeCloseTo(99033 - (14 * 1000) / 30, -1);
  });
});

describe("the hold's place from the log's moments (break-hold-place `moments`)", () => {
  // 3aa6 145.63 s: Zhuang Fangyi's combo breaks, the next moment 0.11 s later; the hold ends at that moment, so her
  // breaking hit is stamped inside it and her combo (frame 24) started 14 − 3 frames before its logged hit says.
  it("holds 3aa6's 145.63 s break from 145.27 s, and her combo then starts at 144.47 s under `held`", () => {
    const zf = placeHits(data, fixture("3aa6"), { "break-held-starts": "held" }).casts.find((c) => c.operator === ZF && c.skillId === `${ZF}_combo_skill` && c.start > 144000 && c.start < 145000);
    expect(zf?.start).toBeCloseTo(144467, -2);
  });
});
