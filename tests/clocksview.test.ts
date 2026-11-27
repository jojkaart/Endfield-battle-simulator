// Round 13's views: `zmdlogs clocks` (clocksview.ts: each clock of known pace against the stops inside it; the
// enemy-clock report point 1), the log's Stagger spans (query.ts loggedStaggerSpans), `zmdlogs holds --dropped`
// (views.ts droppedView, boundCover; the enemy-clock report point 3) and `differences --clusters` (views.ts
// ratioClusters; the damage-factors report point 4). Structural: what each row is, not the clocks' numbers.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { boundCover, devFixtures, pairCasts, droppedView, heldBy, logClocks, loggedStaggerSpans, ratioClusters, replayTimeStops, STAGGER_LISTED, worldMs, type LogHit } from "@efsim/logs";

const data = loadGameData();

const hit = (t: number, staggered: boolean, boundary = false): LogHit =>
  ({ t, operator: "op", event: "e", value: 1, crit: null, effects: staggered && !boundary ? [{ buff: STAGGER_LISTED, value: 0.3 }] : [], boundaryEffects: staggered && boundary ? [{ buff: STAGGER_LISTED, value: 0.3 }] : [] }) as unknown as LogHit;

describe("the log's Stagger spans", () => {
  it("merges the hits listing Stagger (or at their boundary) under 1.5 s apart, first to last listed", () => {
    const fx = { hits: [hit(100, true), hit(900, true, true), hit(2000, false), hit(2300, true), hit(5000, true), hit(6400, true)] };
    expect(loggedStaggerSpans(fx)).toEqual([
      { from: 100, to: 2300 },
      { from: 5000, to: 6400 },
    ]);
    expect(loggedStaggerSpans({ hits: [hit(0, false)] })).toEqual([]);
  });
});

describe("the clocks against the stops inside (zmdlogs clocks)", () => {
  const [log] = devFixtures({ ids: ["db87"] });
  const fx = log?.fx;

  it("gives each row its world time less its expected time, and the held time by the kinds of the stops inside", () => {
    if (!log || !fx) throw new Error("db87 is a development log");
    const { rows } = logClocks(data, log, { kinds: ["tick", "cast"] });
    const stops = replayTimeStops(data, fx);
    expect(rows.some((r) => r.kind === "tick")).toBe(true);
    expect(rows.some((r) => r.kind === "cast")).toBe(true);
    for (const r of rows.filter((x) => x.kind === "tick")) {
      // The enemy's clock: every stop counts.
      expect(r.residual).toBeCloseTo(worldMs(r.a, r.b, stops) - r.expected, 6);
      for (const v of Object.values(r.held)) expect(v).toBeGreaterThan(0);
      expect(heldBy(r)).toBe(Object.keys(r.held).length === 0 ? "no stop" : Object.keys(r.held).includes("ultimate") ? "an ultimate" : Object.keys(r.held).every((k) => k === "combo") ? "combos only" : "other stops only");
    }
    // The enemy-clock round's finding there: db87's tick chains across a combo run late.
    const combos = rows.filter((r) => r.kind === "tick" && heldBy(r) === "combos only");
    expect(combos.length).toBeGreaterThan(0);
    expect(combos.filter((r) => r.residual > 0).length).toBeGreaterThan(combos.length / 2);
  });
});

// Round 18 (the placement-cases report point 3): a clock whose span holds a logged Stagger break is marked; 5082's
// Yvonne, her ultimate's shots 0.47 s of kit frames apart logged 0.98 s apart across the break at 44.43 s.
describe("a Stagger break inside a clock (PaceRow.breaks)", () => {
  it("marks the rows a logged Stagger's start falls inside", () => {
    const log = (devFixtures({ ids: ["5082"] })[0] as { short: string; fx: Parameters<typeof logClocks>[1]["fx"] });
    const { rows } = logClocks(data, log, { kinds: ["cast"] });
    const spans = loggedStaggerSpans(log.fx);
    for (const r of rows) expect(r.breaks).toEqual(spans.map((x) => x.from).filter((t) => t > r.a && t < r.b));
    const yvonne = rows.find((r) => r.what.startsWith("Yvonne") && r.breaks.length);
    expect(yvonne?.residual).toBeGreaterThan(400);
  });
});

describe("the hold placement's dropped bounds (zmdlogs holds --dropped)", () => {
  it("says what covers a bound's span: the log's Stagger, the kinds of stops inside", () => {
    const stops = [
      { start: 30, scales: [0, 0, 0], kind: "combo" },
      { start: 90, scales: [0, 0.5], kind: "ultimate" },
      { start: 200, scales: [1, 1], kind: "battle" },
    ];
    expect(boundCover({ a: 500, b: 4000 }, [{ from: 0, to: 5000 }], stops)).toEqual({ stagger: "inside", stops: "ultimate+combo" });
    expect(boundCover({ a: 500, b: 2000 }, [{ from: 1500, to: 5000 }], stops)).toEqual({ stagger: "partly", stops: "combo" });
    // A stop at scale 1 throughout holds nothing.
    expect(boundCover({ a: 6000, b: 7000 }, [], stops)).toEqual({ stagger: "outside", stops: "no stop" });
  });

  it("groups one log's dropped bounds with the kept ones of their group", () => {
    const text = droppedView(data, devFixtures({ ids: ["db87"] }));
    expect(text).toMatch(/^The hold placement's dropped bounds over 1 logs: \d+ dropped/);
    for (const l of text.split("\n").slice(1)) expect(l).toMatch(/^ {2}(run|tick|status|ramp) +Stagger (inside|partly|outside) +\S+ +\d+ dropped in +1 logs, +\d+ kept; asks /);
  });
});

describe("a group's ratios in clusters (differences --clusters)", () => {
  it("splits sorted ratios where neighbours are more than 0.5% apart, each cluster at its median", () => {
    const steps = [1.023, 1.0232, 1.0228, 1.085, 1.0852, 1.147, 1.1468, 1.1471, 1.3];
    expect(ratioClusters(steps)).toEqual([
      { ratio: 1.023, n: 3 },
      { ratio: 1.085, n: 2 },
      { ratio: 1.147, n: 3 },
      { ratio: 1.3, n: 1 },
    ]);
  });
});
describe("two placements' casts paired (castpairs.ts; round 12 friction point 2)", () => {
  it("pairs the casts that stay first, so one cast gone among its neighbours reads as one gone, not each moved", () => {
    // 9a80's shape: five battle skills of one operator, the third gone in the other placement.
    const c = (start: number) => ({ operator: "rossi", skillId: "battle", start });
    const before = [c(1000), c(4000), c(7000), c(10000), c(13000)];
    const after = [c(1000), c(4000), c(10000), c(13020), c(21000)];
    const p = pairCasts(before, after);
    expect(p.kept.map(([a]) => a.start)).toEqual([1000, 4000, 10000, 13000]);
    expect(p.moved).toEqual([]);
    expect(p.gone.map((x) => x.start)).toEqual([7000]);
    expect(p.added.map((x) => x.start)).toEqual([21000]);
    // Within MOVED_MAX_MS a cast moved; another skill never pairs.
    const q = pairCasts([c(1000), { ...c(2000), skillId: "combo" }], [c(1800), { ...c(2000), skillId: "ult" }]);
    expect(q.moved.map(([a, b]) => [a.start, b.start])).toEqual([[1000, 1800]]);
    expect(q.gone.map((x) => x.skillId)).toEqual(["combo"]);
    expect(q.added.map((x) => x.skillId)).toEqual(["ult"]);
  });
});
