// The hidden holds placed from a fight's clocks (packages/logs holds.ts; engine assumption hidden-holds, reading
// `placed`): the least total hold the bounds allow, its earliest and latest placement, a conflicting bound dropped,
// none inside a span where nothing holds (the enemy Staggered), and the world holds a frame at a time.
import { describe, expect, it } from "vitest";
import { holdWorld, FPS, rampElapsed, statusModifiers, type TimelineState } from "@efsim/engine";
import { holdPins, notAClock, placeHolds, rampBounds, refreshedIn, statusBounds, statusLanes, tickBounds, type ClockWhy, type HoldBound, type RampStep } from "@efsim/logs";

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
    // What it conflicted with: the cap (remaining-leads report point 1).
    expect(p.conflicts[0]?.map((b) => b.tag)).toEqual(["cap"]);
  });

  it("names the bounds that hold each node's earliest and latest placement (holdPins)", () => {
    // One 0.5 s hold inside 5–10 s: none yet at 5 s (the least total, less what the second run needs after it), at
    // least 0.5 s by 10 s (the first run's min).
    const p = placeHolds([run(0, 10000, 500, 700, "first"), run(5000, 15000, 500, 700, "second")], { end: 20000 });
    const at = (t: number) => p.times.indexOf(t);
    expect(holdPins(p, at(10000), "late").bounds.map((b) => b.tag)).toContain("first");
    const early = holdPins(p, at(5000), "early");
    expect(early.total || early.bounds.some((b) => b.tag === "second")).toBe(true);
    expect(holdPins(p, 0, "early")).toEqual({ bounds: [], total: false });
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
      // A CD timer on the world's clock (KitTrigger.cooldownClock), one on raw time, one on the world's already ready.
      triggerState: { "x:cd": { readyAt: 400, count: 1, world: true }, "x:marker": { readyAt: 110, count: 1 }, "x:done": { readyAt: 90, count: 2, world: true } },
    } as unknown as TimelineState;
    const held = holdWorld(st, 100, 15);
    expect(held.buffs.map((b) => b.expiresAt)).toEqual([315, 90]);
    expect(held.enemy.statuses[0]).toMatchObject({ expiresAt: 415, nextTickAt: 125, appliedAt: 65 });
    expect(held.comboWindow["a"]?.until).toBe(145);
    expect(held.sp).toBe(120);
    expect(Object.fromEntries(Object.entries(held.triggerState).map(([k, v]) => [k, v.readyAt]))).toEqual({ "x:cd": 415, "x:marker": 110, "x:done": 90 });
  });
});

describe("statusBounds", () => {
  const hit = (t: number, since: number | null, boundary = false) => ({
    t, operator: "x", event: "e", unquantified: [],
    effects: since !== null && !boundary ? [{ buff: "buff_common_pulse_pulse_conduct_triggered_do", zone: "damageTaken", value: 0.1, source: "p", since }] : [],
    boundaryEffects: since !== null && boundary ? [{ buff: "buff_common_pulse_pulse_conduct_triggered_do", zone: "damageTaken", value: 0.1, source: "p", since }] : [],
  });
  // Electrification from 1 s, the replay's ran out at 9 s (frame 270); the log lists it to 9.6 s, not at 9.8 s.
  const fx = { hits: [hit(1000, 1000, true), hit(5000, 1000), hit(9600, 1000), hit(9800, null)] } as never;
  const inst = [{ status: "electrification", operator: "p", start: 30, end: 270, expired: true }];

  it("bounds the holds by a listed status's run against the replay's expiry, both ways where no kit consumes it", () => {
    const b = statusBounds(inst, statusLanes(fx), [], new Set(), 0.4);
    expect(b.map((x) => [x.a, x.b, Math.round(x.min), Math.round(x.max)])).toEqual([[1000, 9600, 530, Infinity], [1000, 9800, -Infinity, 1000]]);
  });

  it("only from below for a status a kit consumes (its log end may be the consumption)", () => {
    const b = statusBounds(inst, statusLanes(fx), [], new Set(["electrification"]), 0.4);
    expect(b).toHaveLength(1);
    expect(b[0]?.max).toBe(Infinity);
  });

  it("says why each instance is a clock or not (zmdlogs holds --why), with the same bounds", () => {
    const why: ClockWhy[] = [];
    const others = [...inst, { status: "electrification", operator: "p", start: 400, end: 500, expired: false }, { status: "electrification", operator: "q", start: 30, end: 270, expired: true }];
    const b = statusBounds(others, statusLanes(fx), [], new Set(), 0.4, why);
    expect(b).toEqual(statusBounds(inst, statusLanes(fx), [], new Set(), 0.4));
    expect(why.map((w) => [w.holder, w.verdict.split(" ")[0]])).toEqual([["p", "bound:"], ["p", "didn't"], ["q", "the"]]);
    expect(why[0]?.run).toEqual({ name: "electrification", since: 1000, lastListed: 9600 });
  });
});

describe("the shared clock rules (holds.ts)", () => {
  it("refreshedIn: a run another starts inside and that isn't listed past it by over REFRESH_OVERLAP_MS", () => {
    const runs = [{ since: 0, lastListed: 5100 }, { since: 5000, lastListed: 9000 }, { since: 20000, lastListed: 30000 }, { since: 25000, lastListed: 28000 }];
    const same = () => true;
    expect(runs.map((r) => refreshedIn(r, runs, same))).toEqual([true, false, false, false]);
    expect(refreshedIn(runs[0] as (typeof runs)[number], runs, () => false)).toBe(false);
  });
  it("notAClock: the first kit field that makes a buff no clock, `every` only when asked", () => {
    const def = { id: "b", label: "b", target: "self", every: 30 } as never;
    expect(notAClock(def)).toBeNull();
    expect(notAClock(def, { every: true })).toBe("every");
    expect(notAClock({ id: "b", label: "b", target: "self", maxStacks: 0 } as never)).toBe("maxStacks");
  });
});

describe("rampBounds", () => {
  const step = (t: number, low: number, high: number, world: number, capped = false): RampStep =>
    ({ hit: { t } as never, since: 1000, source: "a", level: 1, replayStep: low, low, high, capped, reading: "primary", world });
  it("bounds P(hit) − P(since) by the world time the replay had less the log's steps", () => {
    // 3.4 s of the replay's world time, the log at step 2: the log's world time is 2–3 s, so 0.4–1.4 s of hidden hold.
    const [b] = rampBounds([step(4400, 2, 2, 3400)]);
    expect(b).toMatchObject({ a: 1000, b: 4400, kind: "ramp" });
    expect(b?.min).toBeCloseTo(400 - 70, 6);
    expect(b?.max).toBeCloseTo(1400 + 70, 6);
    // At the cap no bound from below.
    expect(rampBounds([step(9000, 10, 10, 9000, true)])[0]?.min).toBe(-Infinity);
  });
});

describe("Corrosion's ramp inside a stop", () => {
  it("stands at what it had reached until the stop ends, then runs on from there", () => {
    const corrosion = { status: "corrosion", level: 1, appliedAt: 0, expiresAt: 900, operator: "a", artsIntensity: 0 };
    const st = { frame: 60, link: [], scheduled: [], enemyFrozenUntil: 0, enemyFrozenBy: {}, energyBlockedUntil: {}, comboWindow: {}, stagger: { until: null }, buffs: [], triggerState: {},
      enemy: { vulnerable: null, physical: [], controls: [], infliction: null, statuses: [corrosion] } } as unknown as TimelineState;
    const held = holdWorld(st, 60, 45).enemy.statuses[0] as typeof corrosion;
    // 2 s in when 1.5 s of stop begins: 2 s through the stop, 2.5 s half a second after it.
    expect(rampElapsed(held, 60)).toBe(60);
    expect(rampElapsed(held, 100)).toBe(60);
    expect(rampElapsed(held, 120)).toBe(75);
    const shred = (f: number) => statusModifiers({ ...st.enemy, statuses: [held] } as never, f).find((m) => m.zone === "ignoreResistance")?.value;
    expect(shred(100)).toBeCloseTo(shred(60) as number, 9);
  });
});
