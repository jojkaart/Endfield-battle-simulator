// A combo's window opened inside its own slow-down (replayrun.ts openerAhead; the combo-windows lead, 2026-11-28):
// the opener logged inside the combo's own slow-down (the log's flush, at the combo's own first hit's ms in 8f32) opens
// the window the press takes, its count and source, and the landings stay at their logged frames.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { logBuffReplay, readLogFixture } from "@efsim/cli";

const data = loadGameData();
const fixture = (name: string) => readLogFixture(new URL(`../fixtures/${name}`, import.meta.url).pathname);
const frameOf = (s: number) => Math.round(s * FPS);

describe("a combo's window opened inside its own slow-down (openerAhead)", () => {
  it("8f32 82.90 s: Rossi's combo takes the window Estella's projectile opens 13 frames into it (Cryo infliction), no INSIDE", () => {
    const fx = fixture("pending/zmdlogs-8f3215963333.json");
    const { replay } = logBuffReplay(data, fx);
    const made = replay.made.find((m) => m.cast.operator === "chr_0028_wulfa" && m.cast.kind === "combo" && Math.abs(m.frame - frameOf(82.9)) <= 1);
    expect(made?.openers).toEqual([{ frame: expect.any(Number), count: 1, source: "cryst infliction" }]);
    expect(made?.openers?.[0]?.frame).toBeGreaterThan(made?.frame ?? Infinity);
    expect(replay.castFlags.filter((x) => x.kind === "inside" && x.cast.operator === "chr_0028_wulfa" && Math.abs(x.frame - frameOf(82.9)) <= 1)).toEqual([]);
    // The opener stays where the log has it: Estella's projectile at 83.34 s.
    const projectile = fx.hits.find((h) => h.t === 83341 && h.operator === "chr_0021_whiten");
    const landing = projectile ? replay.landing(projectile) : { unknown: "no logged hit" };
    expect("unknown" in landing ? landing.unknown : landing.frame).toBe(frameOf(83.341));
  });

  it("4e5e 28.73 s: Gilberta's combo, 2 frames before the opener, no longer INSIDE", () => {
    const { replay } = logBuffReplay(data, fixture("zmdlogs-4e5e1390085e.json"));
    expect(replay.castFlags.filter((x) => x.kind === "inside")).toEqual([]);
    expect(replay.made.find((m) => m.cast.operator === "chr_0013_aglina" && m.cast.kind === "combo" && Math.abs(m.frame - frameOf(28.73)) <= 1)?.openers?.length).toBe(1);
  });

  it("8056 112.70 s: Laevatain's combo, 17 frames before Wulfgard's ultimate's Combustion (its frame 45), takes its window", () => {
    const { replay } = logBuffReplay(data, fixture("pending/zmdlogs-805687f00250.json"));
    expect(replay.castFlags.filter((x) => x.kind === "inside" && x.cast.operator === "chr_0016_laevat")).toEqual([]);
    const made = replay.made.find((m) => m.cast.operator === "chr_0016_laevat" && m.cast.kind === "combo" && Math.abs(m.frame - frameOf(112.7)) <= 1);
    expect(made?.openers?.[0]?.frame).toBe(frameOf(113.27));
  });
});
