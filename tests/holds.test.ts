// The hidden holds placed from a fight's clocks (packages/logs holds.ts; engine assumption hidden-holds, reading
// `placed`): the least total hold the bounds allow, its earliest and latest placement, a conflicting bound dropped,
// none inside a span where nothing holds (the enemy Staggered), and the world holds a frame at a time.
import { describe, expect, it } from "vitest";
import { holdWorld, FPS, rampElapsed, statusModifiers, type TimelineState } from "@efsim/engine";
import { breakHoldStarts, breakStops, comboHoldSpans, gapsWithin, holdPins, notAClock, notAClockWords, pausedBound, placeHolds, rampBounds, refreshedIn, statusBounds, statusLanes, tickBounds, withoutGaps, type ClockWhy, type HoldBound, type RampStep } from "@efsim/logs";

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

  it("lets the holds rise inside a still span only at a slow span's rate (stagger-holds `combos`: a combo's stop)", () => {
    // A run asking 0.3 s over 6–12 s, all Staggered: with no slow span the bound can't be met and is dropped; a combo's
    // stop at 8–9 s at rate 0.5 allows 0.5 s there, so the 0.3 s sits inside it.
    const ask = run(6000, 12000, 300, 400);
    expect(placeHolds([ask], { end: 12000, still: [[5000, 12000]] }).total).toBe(0);
    const p = placeHolds([ask], { end: 12000, still: [[5000, 12000]], slow: [{ a: 8000, b: 9000, rate: 0.5 }] });
    expect(p.total).toBeCloseTo(300, 6);
    expect(p.dropped).toEqual([]);
    for (const h of p.holds) {
      expect(h.frame).toBeGreaterThanOrEqual(Math.floor((8000 * FPS) / 1000));
      expect(h.frame).toBeLessThan(Math.ceil((9000 * FPS) / 1000));
    }
    // A slow span outside every still span changes nothing (P already rises at real time there).
    expect(placeHolds([run(0, 4000, 200, 300)], { end: 5000, slow: [{ a: 1000, b: 1100, rate: 0.1 }] }).total).toBeCloseTo(200, 6);
  });

  it("withoutGaps: an away stretch cut out of a still span lets the holds rise there (pause-holds `away`)", () => {
    // A Stagger 5–20 s with a hitless stretch 8–14 s in it (4d60's whole-game pause): the run asking 5 s over 6–18 s
    // fits only in the stretch.
    const still = withoutGaps([[5000, 20000]], [{ from: 8000, to: 14000 }, { from: 30000, to: 40000 }]);
    expect(still).toEqual([[5000, 8000], [14000, 20000]]);
    expect(withoutGaps([[5000, 20000]], [{ from: 2000, to: 6000 }])).toEqual([[6000, 20000]]);
    expect(withoutGaps([[5000, 20000]], [{ from: 4000, to: 21000 }])).toEqual([]);
    const ask = run(6000, 18000, 5000, 5500);
    expect(placeHolds([ask], { end: 20000, still: [[5000, 20000]] }).total).toBe(0);
    const p = placeHolds([ask], { end: 20000, still });
    expect(p.total).toBeCloseTo(5000, 6);
    for (const h of p.holds) {
      expect(h.frame).toBeGreaterThanOrEqual(Math.floor((8000 * FPS) / 1000));
      expect(h.frame).toBeLessThan(Math.ceil((14000 * FPS) / 1000));
    }
  });

  it("comboHoldSpans: a combo stop's span at `share` of its own hold per ms, other stops none", () => {
    const stops = [
      { start: 30, scales: [0.01, 0.01, 0.01], operator: "a", skillId: "x", kind: "combo" as const },
      { start: 90, scales: [0, 0], operator: "b", skillId: "y", kind: "ultimate" as const },
    ];
    const spans = comboHoldSpans(stops, 0.5);
    expect(spans).toHaveLength(1);
    expect(spans[0]?.a).toBeCloseTo(1000, 6);
    expect(spans[0]?.b).toBeCloseTo(1100, 6);
    expect(spans[0]?.rate).toBeCloseTo(0.495, 6);
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
    const bounds = tickBounds({ hits: [1000, 2000, 3500, 4500].map(hit) } as never, [], undefined);
    const p = placeHolds(bounds, { end: 5000 });
    expect(p.total).toBeGreaterThan(300);
    expect(p.total).toBeLessThan(400);
    for (const h of p.holds) expect(h.frame).toBeGreaterThanOrEqual(Math.floor((2000 * FPS) / 1000));
  });

  it("breakHoldStarts: a break's hold from its ms, or (break-hold-place `moments`) ending at the next moment where that comes sooner", () => {
    const hit = (t: number, bar?: number) => ({ t, event: "e", operator: "x", effects: [], boundaryEffects: [], ...(bar !== undefined ? { poise: { dealt: 10, bar } } : {}) });
    const f = (ms: number) => Math.round((ms * FPS) / 1000);
    // 14 frames (467 ms): the moment after the 10 s break comes 600 ms later, after the 20 s one 105 ms later (9090afbacec9
    // 128.92 s), the moment before it 600 ms earlier: that hold ends at 20.105 s.
    const fx = { hits: [hit(9900, 5), hit(10000, 0), hit(10600), hit(19000, 8), hit(19400), hit(20000, 0), hit(20105)] } as never;
    const moments = { "break-hold-place": "moments" };
    expect(breakHoldStarts(fx, 14, moments)).toEqual([{ at: f(10000), from: f(10000) }, { at: f(20000), from: f(20105 - (14 * 1000) / FPS) }]);
    // The default is `moments`.
    expect(breakHoldStarts(fx, 14, undefined)).toEqual(breakHoldStarts(fx, 14, moments));
    // The moment before bounds it, 134 ms after it (the landings logged there; 9090's 128.50 s volleys): a hold of 30
    // frames there starts at 19.534 s.
    expect(breakHoldStarts(fx, 30, moments)[1]).toEqual({ at: f(20000), from: f(19400 + 134) });
    // With no hold (`none`), every hold at its ms.
    expect(breakHoldStarts(fx, 0, moments).every((b) => b.from === b.at)).toBe(true);
    // `ms`: every hold at its break's ms, the tick bounds' stops (breakStops) too; none without a hold.
    const ms = { "break-hold-place": "ms" };
    expect(breakHoldStarts(fx, 14, ms).every((b) => b.from === b.at)).toBe(true);
    expect(breakStops(fx, [], { "break-hold": "14f", ...ms }).map((s) => s.start)).toEqual([f(10000), f(20000)]);
    expect(breakStops(fx, [], { "break-hold": "none" })).toEqual([]);
    // The stops follow break-hold-place as the replay does (round 19: tickBounds took the defaults under a variant).
    expect(breakStops(fx, [], { "break-hold": "14f", ...moments }).map((s) => s.start)).toEqual([f(10000), f(20105 - (14 * 1000) / FPS)]);
    // A break inside a combo's slow-down (engine assumption break-hold-combo, as timeline/clock.ts breakHold): the stop
    // as it is (`lowest`), long enough to take its frames beyond the combo's (`added`, the default), or none.
    const combo = { start: f(10000) - 5, scales: new Array<number>(20).fill(0.5), operator: "y", skillId: "c", kind: "combo" as const };
    const at10 = (assume: Record<string, string>) => breakStops(fx, [combo], { ...ms, ...assume }).filter((s) => s.start === f(10000));
    expect(at10({ "break-hold-combo": "lowest" }).map((s) => s.scales.length)).toEqual([14]);
    // Over the combo's 15 frames left at 0.5 the stop takes 7.5 frames more, then 6.5 more past its end: 22 frames.
    expect(at10({}).map((s) => s.scales.length)).toEqual([22]);
    expect(at10({ "break-hold-combo": "none" })).toEqual([]);
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

  // pause-holds `paused`: 4d60e7fe92c2's Electrification from 21.37 s, the replay's out at 30.73 s, listed to 37.00 s
  // across the away stretch 27.38–37.00 s (a whole-game pause): 6.3 s asked of a 9.4 s life, over its share.
  const away = { hits: [hit(21370, 21370, true), hit(27380, 21370), hit(37000, 21370), hit(37500, null)] } as never;
  const paused = [{ status: "electrification", operator: "p", start: 641, end: 922, expired: true }];
  const gap = [{ from: 27380, to: 37000 }];

  it("past its share, no bound; with the away stretch inside its run (pause-holds `paused`), a bound laid in the stretch", () => {
    expect(statusBounds(paused, statusLanes(away), [], new Set(), 0.4)).toEqual([]);
    const b = statusBounds(paused, statusLanes(away), [], new Set(), 0.4, undefined, gap);
    const min = b.find((x) => Number.isFinite(x.min));
    expect([min?.a, min?.b, Math.round((min?.min ?? 0) / 100)]).toEqual([27380, 37000, 62]);
    // The least total then sits in the stretch, not wherever it may.
    const p = placeHolds(b, { end: 40000 });
    expect(p.early[p.times.indexOf(27380)]).toBeCloseTo(0, 6);
    expect(p.late[p.times.indexOf(37000)]).toBeCloseTo(p.total, 6);
  });

  it("within its share, the bound as without the stretch", () => {
    expect(statusBounds(inst, statusLanes(fx), [], new Set(), 0.4, undefined, [{ from: 5000, to: 9000 }])).toEqual(statusBounds(inst, statusLanes(fx), [], new Set(), 0.4));
  });
});

describe("pausedBound", () => {
  it("lays a bound asking past its cap inside the gaps within it, and leaves one within its cap as it is", () => {
    expect(pausedBound(run(0, 20000, 8000), 6000, [{ from: 5000, to: 14000 }, { from: 30000, to: 40000 }])).toMatchObject({ a: 5000, b: 14000, min: 8000 });
    expect(pausedBound(run(0, 20000, 5000), 6000, [{ from: 5000, to: 14000 }])).toEqual(run(0, 20000, 5000));
    expect(pausedBound(run(0, 20000, 8000), 6000, [{ from: 25000, to: 30000 }])).toEqual(run(0, 20000, 8000));
    expect(gapsWithin(0, 20000, [{ from: 5000, to: 14000 }, { from: 18000, to: 30000 }])).toBe(11000);
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
    // A layered buff's layers are clocks only on their own timers, stackingType 11 (Thermite Cutter's team ATK).
    expect(notAClock({ id: "b", label: "b", target: "self", maxStacks: 2 } as never)).toBe("maxStacks");
    expect(notAClock({ id: "b", label: "b", target: "team", maxStacks: 2, gameBuff: "buff_wpn_sword_0012_atk_up" } as never)).toBeNull();
    expect(notAClock({ id: "b", label: "b", target: "self", maxStacks: 2, gameBuff: "buff_equipsuit_combo_cd01_spellup" } as never)).toBe("maxStacks");
    // Round 24 (the overlap-clock report point 2): the `--why` words name the stacking type judged.
    expect(notAClockWords({ id: "b", label: "b", target: "self", maxStacks: 2, gameBuff: "buff_equipsuit_combo_cd01_spellup" } as never, "maxStacks")).toBe("`maxStacks` (layered; its game buff buff_equipsuit_combo_cd01_spellup is BuffData stackingType 2: only stackingType 11, layers on their own timers the log lists apart, is a clock)");
    expect(notAClockWords({ id: "b", label: "b", target: "self", link: true } as never, "link")).toBe("`link`");
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
