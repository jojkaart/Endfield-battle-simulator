// A batched ms's order in the views (round 16, the batched-landings report point 2): the bar each logged hit leaves on
// `zmdlogs replay` / `casts` lines of a batch, and a BATCH line where the replay's landings came in another order than
// the bars give (packages/logs/src/views.ts batchDisagreements).
import { describe, expect, it } from "vitest";
import type { LandedHit } from "@efsim/engine";
import { batchDisagreements, type LogHit } from "@efsim/logs";
import { logHitOf, syntheticFixture } from "./helpers/synthetic.ts";

describe("a batched ms's order against the replay's", () => {
  // Three Stagger events at one ms from two casts: A's leaves 274 → 264, B's 254 → 234, A's second 234 → 224.
  const hit = (op: string, event: string, bar: number, dealt: number, origin: string): LogHit => logHitOf(op, 7049, event, 100, { poise: { dealt, bar, origin } });
  const [a1, b1, a2] = [hit("op_a", "combo", 264, 10, "a_combo"), hit("op_b", "ult", 234, 20, "b_ult"), hit("op_a", "lift", 224, 10, "a_combo")];
  const fx = syntheticFixture([a1, b1, a2], [], { enemy: "e", level: 1 });
  const landing = (n: number) => ({ frame: 211, n }) as unknown as LandedHit;
  const [l1, l2, l3] = [landing(1), landing(2), landing(3)];

  it("flags a batch whose replay landings came out of the bars' order, and gives both orders", () => {
    const off = batchDisagreements(fx, [l1, l3, l2], new Map([[l1, a1], [l2, b1], [l3, a2]]));
    expect(off).toHaveLength(1);
    expect(off[0]?.replay).toEqual([a1, a2, b1]);
    expect(off[0]?.bars).toEqual([a1, b1, a2]);
  });

  it("says nothing where the replay followed the bars", () => {
    expect(batchDisagreements(fx, [l1, l2, l3], new Map([[l1, a1], [l2, b1], [l3, a2]]))).toEqual([]);
  });
});
