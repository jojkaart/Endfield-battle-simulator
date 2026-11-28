// A replay's clock as time stops (round 22, the barrage-array report point 1): replayclock.ts turns the timeline's
// applied slow-downs and the hidden holds into the log tools' TimeStops (an operator's own left in on request, a hold
// added to any stop), holds.ts tickChains is the one chain rule, and `zmdlogs worldtime --series` reads both: fc63's
// Barrage Array across Typhoeus's own ultimate fits its period only with her stop out.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, heldWorldMs, holdsMs, logBuffReplay, placeHits, replayClockStops, seriesClockView, tickChains, worldClockLines, type BuffReplay, type LogFixture } from "@efsim/logs";

const data = loadGameData();
const stops: BuffReplay["appliedStops"] = [
  { start: 30, scales: new Array<number>(30).fill(0), operator: "chr_a", ultimate: true },
  { start: 90, scales: new Array<number>(15).fill(0.1), operator: null, ultimate: false },
];

describe("replayclock.ts", () => {
  it("turns applied slow-downs into TimeStops, an operator's own left in on request", () => {
    const all = replayClockStops({ appliedStops: stops });
    expect(all.map((s) => [s.start, s.operator, s.kind])).toEqual([[30, "chr_a", "ultimate"], [90, "", null]]);
    expect(replayClockStops({ appliedStops: stops }, { without: "chr_a" }).map((s) => s.start)).toEqual([90]);
  });

  it("adds a hidden hold to a stop running then (holdWorld shifts every world clock)", () => {
    const holds = [{ frame: 40, frames: 3 }, { frame: 200, frames: 6 }];
    expect(holdsMs(holds, 0, 4000)).toBe(100);
    const all = replayClockStops({ appliedStops: stops });
    // 0–4 s: 1 s at scale 0, 0.5 s at 0.1 (0.45 s held), and the 3-frame hold inside the first stop counted in full.
    expect(heldWorldMs(0, 4000, all)).toBeCloseTo(4000 - 1000 - 450, 6);
    expect(heldWorldMs(0, 4000, all, holds)).toBeCloseTo(4000 - 1000 - 450 - 100, 6);
  });
});

describe("holds.ts tickChains", () => {
  const hit = (t: number, event = "buff_common_burning_status") => ({ t, event, operator: "chr_a" }) as LogFixture["hits"][number];
  it("chains ticks a period apart, splits past the gap, and takes another series at a given period", () => {
    const fx = { hits: [hit(1000), hit(2000), hit(3010), hit(6000), hit(7000), hit(500, "x_tick"), hit(750, "x_tick")] };
    const [burn] = tickChains(fx);
    expect(burn?.chains).toEqual([[1000, 2000, 3010], [6000, 7000]]);
    expect(tickChains(fx, { gap: 2500 })[0]?.chains).toEqual([[1000, 2000, 3010, 6000, 7000]]);
    expect(tickChains(fx, { split: (a, b) => a < 2500 && b > 2500 })[0]?.chains).toEqual([[1000, 2000], [3010], [6000, 7000]]);
    expect(tickChains(fx, { periods: { x_tick: 250 } }).map((x) => [x.event, x.chains])).toEqual([["x_tick", [[500, 750]]]]);
  });
});

describe("zmdlogs worldtime with the replay's clock (fc63)", () => {
  const [d] = devFixtures({ ids: ["fc63"] });
  const fx = (d as NonNullable<typeof d>).fx;
  const placement = placeHits(data, fx);
  const { replay } = logBuffReplay(data, fx, placement);
  const typhoeus = "chr_0034_typhoea";

  it("--series: the array across her own ultimate fits its period with her stop out, not with it left in", () => {
    const text = seriesClockView(data, fx, replay, { event: /typhoea_combo_persistent/, gap: 3000 });
    const row = text.split("\n").find((l) => /^ +87\.\d\d–94\.\d\d +13 ticks/.test(l));
    expect(row).toBeDefined();
    const [w, own, held] = (/world ([\d.]+) \| ([\d.]+) \| ([\d.]+)/.exec(row as string) as RegExpExecArray).slice(1).map(Number) as [number, number, number];
    expect(own - w).toBeGreaterThan(1.5);
    expect(Math.abs(held - 4)).toBeLessThan(0.2);
    expect(() => seriesClockView(data, fx, replay, { event: /no_such_event/ })).toThrow(/no a tick series of holds\.ts HOLD_SERIES/);
  });

  it("--holds --without: a row per stop source, her own stop left in gives the log's span", () => {
    const lines = worldClockLines(data, 87900, 94300, [], replay, { without: typhoeus, holds: true });
    expect(lines[0]).toMatch(/every stop out \| Typhoeus's own left in \| every stop and the hidden holds out/);
    const applied = (lines[2] as string).split(": ")[1]?.split(" | ").map(Number) as number[];
    expect(applied[1]).toBeCloseTo(6.4, 1);
    expect((applied[0] as number) < (applied[1] as number) && (applied[2] as number) <= (applied[0] as number)).toBe(true);
  });
});
