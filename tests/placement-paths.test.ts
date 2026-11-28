// The placement rules of 2026-11-28's third round (docs/open-problems.md "The placement cases of 2026-11-28"): a
// landing kept on its cast by value against the other group's multiplier bounds (logcasts.ts keptByValue), a cast's
// slots cut to its first landing's path (pathSlots), a hitless ultimate's unplaced event stop where its event reads
// (unplacedCastStops, ultimateEventRead). Each on the log that showed it.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay, passStops, placeHits, placementPasses, type LogFixture } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;
const frameOf = (ms: number) => Math.round((ms * 30) / 1000);

describe("a landing kept on its cast by its value (keptByValue)", () => {
  // 8f32 36.11 s: Rossi's combo 2 hit_2 (12,877, hit 1's value at 35.51 s: both ×0.60), 0.23 s past its frame after an
  // attack 3 placed at 35.38 s, was opened as a combo 3 perfect strike (×3.45–11.73: multiplierBounds), its Lift 2.4 s
  // before the log's, ahead of the Endministrator's 38.39 s combo crystals.
  const R = "chr_0028_wulfa";
  it("stays its combo 2's hit_2, and the combo 3 perfect strike at 38.50 s opens the combo 3 (8f32 36.11 s)", () => {
    const fx = fixture("8f32");
    const p = placeHits(data, fx);
    const hit2 = fx.hits.find((h) => h.t === 36111 && h.event === `${R}_combo_2_skill`);
    const placed = p.hits.get(hit2 as (typeof fx.hits)[number]);
    expect(placed?.cast.skillId).toBe(`${R}_combo_2_skill`);
    expect(placed?.frame).toBe(24);
    expect(placed?.joined?.value).toBe(true);
    const perfect = fx.hits.find((h) => h.t === 38497 && h.event === `${R}_combo_2_skill`);
    const p3 = p.hits.get(perfect as (typeof fx.hits)[number]);
    expect(p3?.cast.skillId).toBe(`${R}_combo_3_skill`);
    expect(p3?.index).toBe(0);
  });

  it("the replay makes the Endministrator's 38.50 s crystal shatter", () => {
    const { replay } = logBuffReplay(data, fixture("8f32"));
    expect(replay.hits.some((h) => h.operator === "chr_0003_endminf" && h.hitId === "shatter" && Math.abs(h.frame - frameOf(38497)) <= 1)).toBe(true);
  });
});

describe("a cast's slots cut to its first landing's path (pathSlots)", () => {
  // 8f32 10.02 / 10.59 s: Alesh's combo (hook and slam at 22 and 38, or the Rare Fin's hook_ex and slam_ex at 77 and 93
  // past the jump 10 → 65) had joined her 1.29 s combo, 7.4 s late, as its Rare Fin slots.
  it("places those two hits as a combo of their own, on its hook and slam (8f32 10.02 s)", () => {
    const fx = fixture("8f32");
    const A = "chr_0024_deepfin";
    const p = placeHits(data, fx);
    const hits = [...p.hits].filter(([h]) => h.operator === A && h.event === `${A}_combo_skill` && h.t >= 9_900 && h.t < 10_700);
    expect(hits.length).toBe(2);
    expect(new Set(hits.map(([, x]) => x.cast)).size).toBe(1);
    expect(hits.map(([, x]) => x.frame)).toEqual([22, 38]);
    expect(Math.abs((hits[0] as [unknown, { cast: { start: number } }])[1].cast.start - 9_290)).toBeLessThan(50);
  });
});

describe("a hitless ultimate's unplaced event stop where its event reads (unplacedCastStops)", () => {
  // 458b 84.37 s: Akekuri's ultimate, its event at its stop's end (castassembly.ts ultimateEventRead: the team's next
  // hits fall inside the stop a start there would make), made at 82.53 s; the placement's own stop list had it from
  // the event.
  it("starts Akekuri's ultimate stop at 82.53 s, not at its 84.37 s event (458b)", () => {
    const fx = fixture("458b");
    const stops = passStops(data, fx, placementPasses(data, fx).first).filter((s) => s.skillId === "chr_0019_karin_ultimate_skill" && s.start > frameOf(80_000) && s.start < frameOf(86_000));
    expect(stops.length).toBe(1);
    expect(Math.abs((stops[0] as { start: number }).start - frameOf(82_530))).toBeLessThanOrEqual(1);
  });
});
