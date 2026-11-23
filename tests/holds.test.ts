// The hidden holds placed from a fight's clocks (packages/logs holds.ts; engine assumption hidden-holds, reading
// `placed`): the least total hold the bounds allow, its earliest and latest placement, a conflicting bound dropped,
// none inside a span where nothing holds (the enemy Staggered), and the world holds a frame at a time.
import { describe, expect, it } from "vitest";
import { holdWorld, FPS, type TimelineState } from "@efsim/engine";
import { placeHolds, tickBounds, type HoldBound } from "@efsim/logs";

const run = (a: number, b: number, min: number, max = Infinity, tag = `run ${a}→${b}`): HoldBound => ({ a, b, min, max, kind: "run", tag, ex: (Number.isFinite(min) ? min : max) / 1000 });

describe("placeHolds", () => {
  it("places the least total hold every bound allows, where the bounds overlap", () => {
    // Two buffs each 0.5 s late, their windows overlapping in 5–10 s: one hold of 0.5 s explains both.
    const p = placeHolds([run(0, 10000, 500, 700), run(5000, 15000, 500, 700)], { end: 20000 });
    expect(p.total).toBeCloseTo(500, 6);
    expect(p.dropped).toEqual([]);
    const P = (which: readonly number[], t: number) => which[p.times.indexOf(t)] as number;
    // Earliest or latest, it rises inside 5–10 s: before 5 s the second run wouldn't hold it, after 10 s the first.
    expect(P(p.early, 5000)).toBeCloseTo(0, 6);
    expect(P(p.late, 10000)).toBeCloseTo(500, 6);
    const frames = p.holds.reduce((t, h) => t + h.frames, 0);
    expect(frames).toBe(Math.round((500 * FPS) / 1000));
    for (const h of p.holds) expect(h.frame).toBeGreaterThanOrEqual(Math.floor((5000 * FPS) / 1000));
    for (const h of p.holds) expect(h.frame).toBeLessThan(Math.ceil((10000 * FPS) / 1000));
  });

  it("places none where nothing holds (`still`: the enemy Staggered), and none that a bound caps at zero", () => {
    const p = placeHolds([run(0, 10000, 500, 700), run(0, 4000, -Infinity, 0)], { end: 12000, still: [[6000, 12000]] });
    expect(p.total).toBeCloseTo(500, 6);
    for (const h of p.holds) {
      expect(h.frame).toBeGreaterThanOrEqual(Math.floor((4000 * FPS) / 1000));
      expect(h.frame).toBeLessThan(Math.ceil((6000 * FPS) / 1000));
    }
  });

  it("drops a bound that conflicts with the rest, the largest ask first", () => {
    // A 3 s ask inside a window another caps at 0.2 s: one has to go; the larger.
    const p = placeHolds([run(0, 10000, 3000, 3400, "big"), run(0, 12000, -Infinity, 200, "cap"), run(0, 12000, 100, 200, "small")], { end: 12000 });
    expect(p.dropped.map((b) => b.tag)).toEqual(["big"]);
    expect(p.total).toBeCloseTo(100, 6);
  });

  it("reads a tick series' chain: each pair, and each tick against the chain's first", () => {
    const hit = (t: number) => ({ t, event: "buff_common_burning_status", operator: "x", effects: [], boundaryEffects: [] });
    // Ticks at 1, 2, 3.5, 4.5 s: one hold of 0.5 s between the second and the third.
    const bounds = tickBounds({ hits: [1000, 2000, 3500, 4500].map(hit) } as never, []);
    const p = placeHolds(bounds, { end: 5000 });
    expect(p.total).toBeGreaterThan(300);
    expect(p.total).toBeLessThan(400);
    for (const h of p.holds) expect(h.frame).toBeGreaterThanOrEqual(Math.floor((2000 * FPS) / 1000));
  });
});

describe("holdWorld", () => {
  it("holds the world's timers (buffs, the enemy's statuses, combo windows) from its frame, not SP or what's due before", () => {
    const st = {
      frame: 100, sp: 120, link: [], scheduled: [], enemyFrozenUntil: 0, enemyFrozenBy: {}, energyBlockedUntil: {},
      comboWindow: { a: { from: 90, until: 130, count: 1 } },
      stagger: { until: null },
      enemy: { vulnerable: null, physical: [], controls: [], infliction: null, statuses: [{ appliedAt: 50, expiresAt: 400, nextTickAt: 110 }] },
      buffs: [{ id: "b", owner: "x", appliedAt: 0, expiresAt: 300 }, { id: "c", owner: "x", appliedAt: 0, expiresAt: 90 }],
    } as unknown as TimelineState;
    const held = holdWorld(st, 100, 15);
    expect(held.buffs.map((b) => b.expiresAt)).toEqual([315, 90]);
    expect(held.enemy.statuses[0]).toMatchObject({ expiresAt: 415, nextTickAt: 125, appliedAt: 65 });
    expect(held.comboWindow["a"]?.until).toBe(145);
    expect(held.sp).toBe(120);
  });
});
