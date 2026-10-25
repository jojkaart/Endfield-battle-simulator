// The scheduled list (engine timeline/schedule.ts): the order of what's due at one frame (IN_FRAME, dueBefore), and
// the one pass each that shifts a clock, ends a cast and jumps on a cast's timeline for every kind of item.
import { describe, expect, it } from "vitest";
import { simulate } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "../packages/cli/src/simulate.ts";
import { cancelCast, dueBefore, IN_FRAME, jumpCast, shiftClock, stepOf, onOperator } from "../packages/engine/src/timeline/schedule.ts";
import type { BattleEvent } from "@efsim/engine";
import type { Scheduled } from "../packages/engine/src/timeline/state.ts";

const A = "op_a";
const B = "op_b";
const cast = (operator: string, index: number) => ({ operator, index });
const hit = (frame: number, operator: string, extra: Partial<Extract<Scheduled, { kind: "hit" }>> = {}): Scheduled => ({ kind: "hit", frame, clock: { operator }, operator, skillId: "s", hitId: "h", sp: 0, ...extra });
const event: BattleEvent = { type: "fightStart", frame: 0, operator: A };
const action = (frame: number, extra: Partial<Extract<Scheduled, { kind: "action" }>> = {}): Scheduled => ({ kind: "action", frame, clock: { operator: A }, owner: A, trigger: "t", event, origin: null, ...extra });
const energy = (frame: number, extra: Partial<Extract<Scheduled, { kind: "energy" }>> = {}): Scheduled => ({ kind: "energy", frame, clock: { operator: A }, cast: cast(A, 0), operator: B, amount: 1, ...extra });
const jump = (frame: number, index = 0): Scheduled => ({ kind: "jump", frame, clock: { operator: A }, cast: cast(A, index), operator: A, from: 10, to: 20 });
const burst = (frame: number): Scheduled => ({ kind: "burst", frame, clock: "enemy", event: { kind: "burst", operator: A, element: "fire" }, fromKind: "battle" });
const enemyAction = (frame: number): Scheduled => ({ kind: "enemyAction", frame, clock: "enemy", act: "attack", target: "controlled", element: "physical" });

/** The order a list's items run in (as advance picks them: the first by dueBefore, ties to the earlier in the list). */
function runOrder(list: readonly Scheduled[]): Scheduled[] {
  const left = [...list];
  const out: Scheduled[] = [];
  while (left.length) {
    let i = 0;
    left.forEach((x, j) => {
      if (dueBefore(x, left[i] as Scheduled)) i = j;
    });
    out.push(...left.splice(i, 1));
  }
  return out;
}

describe("the order within a frame", () => {
  it("runs the steps of a frame in the table's order, whatever order they were scheduled in", () => {
    const items = [jump(5), action(5, { afterHits: true }), hit(5, A), enemyAction(5), energy(5), action(5), burst(5)];
    const steps = runOrder(items).map(stepOf);
    expect(steps).toEqual(IN_FRAME.filter((s) => steps.includes(s)));
    expect(steps).toEqual(["burst", "action", "energy", "enemyAction", "hit", "afterHits", "jump"]);
  });

  it("runs an earlier frame first, whatever its step", () => {
    expect(runOrder([burst(6), jump(5)]).map((x) => x.frame)).toEqual([5, 6]);
  });

  it("orders hits at one frame by operator ID, the rest of one step by when they were scheduled", () => {
    const [b1, a1, a2] = [hit(5, B, { hitId: "b1" }), hit(5, A, { hitId: "a1" }), hit(5, A, { hitId: "a2" })];
    expect(runOrder([b1, a1, a2] as Scheduled[])).toEqual([a1, a2, b1]);
    const [x, y] = [action(5, { trigger: "x" }), action(5, { trigger: "y" })];
    expect(runOrder([y, x] as Scheduled[])).toEqual([y, x]);
  });
});

describe("one pass per change for every kind of item", () => {
  it("shifts what's on a clock after the start, with its launch, but not a pinned item", () => {
    const list = [hit(10, A, { detached: true, launchAt: 8 }), hit(10, A, { pinned: true }), hit(10, B), action(3), burst(10)];
    const out = shiftClock(list, (c) => onOperator(c, A), 5, 4);
    expect(out.map((x) => x.frame)).toEqual([14, 10, 10, 3, 10]);
    expect(out[0]?.launchAt).toBe(12);
    expect(shiftClock(list, (c) => c === "enemy", 5, 4).map((x) => x.frame)).toEqual([10, 10, 10, 3, 14]);
  });

  it("ends a cast: drops what it still had to do, keeps what's on its way and its launched detached items", () => {
    const own = { cast: cast(A, 0) };
    const list = [
      hit(12, A, own), // dropped
      hit(12, A, { ...own, detached: true }), // on its way from the start
      hit(12, A, { ...own, detached: true, launchAt: 9 }), // launched by frame 10
      hit(12, A, { ...own, detached: true, launchAt: 11 }), // not launched yet: dropped
      action(12, own), // dropped
      energy(12), // the same cast's: dropped
      energy(12, { detached: true }), // kept
      jump(10), // a jump of the cast goes even at the end's own frame
      hit(12, A, { cast: cast(A, 1) }), // another cast's
    ];
    const kept = cancelCast(list, A, 0, 10);
    expect(list.map((x) => kept.includes(x))).toEqual([false, true, true, false, false, false, true, false, true]);
  });

  it("jumps on a cast: drops what's bound to it in the skipped frames, pulls the rest in, leaves pinned and other casts' items", () => {
    const own = { cast: cast(A, 0) };
    const list = [
      hit(12, A, own), // skipped
      hit(30, A, own), // after: 10 sooner
      hit(12, A, { ...own, pinned: true }), // pinned: stays
      hit(40, A, { ...own, detached: true, launchAt: 15 }), // its launch is skipped: dropped
      hit(40, A, { ...own, detached: true, launchAt: 25 }), // launch after: both sooner
      hit(40, A, { ...own, detached: true }), // on its way from the start
      action(30, own),
      hit(30, B, { cast: cast(B, 0) }),
    ];
    const out = jumpCast(list, A, 0, 10, 10);
    expect(out.map((x) => [x.frame, x.launchAt])).toEqual([[20, undefined], [12, undefined], [30, 15], [40, undefined], [20, undefined], [30, undefined]]);
  });
});

describe("a cast's hits at one frame", () => {
  const data = loadGameData();
  it("land in kit order, whatever another cast's jumps did (akekuri-laevatain: Laevatain's battle skill at frame 972)", () => {
    // Before 2026-10-25 a jump on any cast rebuilt the hit list with every detached hit not launched yet at its end,
    // so Laevatain's Combustion `dot` (launched at frame 4) landed after `empowered_extra` at the same frame.
    const r = simulate(data, readScenario(new URL("../examples/akekuri-laevatain.scenario.json", import.meta.url).pathname));
    expect(r.hits.filter((h) => h.frame === 972 && h.skillId === "chr_0016_laevat_normal_skill").map((h) => h.hitId)).toEqual(["dot", "empowered_extra"]);
  });
});
