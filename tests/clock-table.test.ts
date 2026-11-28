// docs/design/timeline.md "Which clock each hold holds", a cell per assertion (round 23, the backlog after round 22's
// point 2: each cell rested on one code path, tested where a kit needed it, not as a table). One synthetic state with
// an item on each clock (timeline/state.ts Clock: the world's, the enemy's, the caster's, a teammate's; an Arts Burst on
// the caster's clock), a buff on the world's clock, an enemy status, a skill cooldown and SP; each hold applied at frame
// 100 by the function that makes it (clock.ts slowDown: the caster's own combo slow-down, her own ultimate stop, a
// teammate's; holdWorld: a hidden hold; shiftEnemy: a freeze; breakHold: a Stagger break), and each item's due frame
// read after: later than 200 is "held".
import { describe, expect, it } from "vitest";
import type { SkillTiming, TimelineContext, TimelineState } from "@efsim/engine";
import { breakHold, holdWorld, shiftEnemy, slowDown } from "../packages/engine/src/timeline/clock.ts";

const ctx = { scenario: { options: { assume: {} }, team: [{ operator: "op" }, { operator: "mate" }] } } as unknown as TimelineContext;
const stop = (specification: number): SkillTiming => ({ durationFrames: 60, exclusiveFrames: 0, windows: [], channels: [], specification, keepsChain: true, slowdowns: [{ from: 0, scales: new Array<number>(30).fill(0) }], jumps: [], ends: [] });
const COMBO = stop(4);
const ULTIMATE = stop(5);

const item = (clock: unknown, owner: string, kind = "action") => ({ kind, frame: 200, clock, owner, trigger: `t-${JSON.stringify(clock)}`, event: { type: "none" }, origin: null, ...(kind === "burst" ? { event: { kind: "burst" }, fromKind: "none" } : {}) });
const state = (): TimelineState =>
  ({
    frame: 100, link: [], slowdowns: [], enemyFrozenUntil: 0, enemyFrozenBy: {}, energyBlockedUntil: {}, comboWindow: {}, stagger: { until: null }, acting: {}, chainNext: {}, triggerState: {},
    readyAt: { "op-skill": 250 }, sp: 50, spPausedUntil: 0,
    scheduled: [item("world", "op"), item("enemy", "op"), item({ operator: "op" }, "op"), item({ operator: "mate" }, "mate"), item({ operator: "op" }, "op", "burst")],
    buffs: [{ id: "b", owner: "op", appliedAt: 90, expiresAt: 200 }],
    enemy: { vulnerable: null, physical: [], controls: [], infliction: null, statuses: [{ status: "s", appliedAt: 90, expiresAt: 200, level: 1 }] },
  }) as unknown as TimelineState;

/** Whether each clock's item, the buff, the status, the cooldown and SP came later than they were due. */
function heldUnder(f: (st: TimelineState) => TimelineState): Record<string, boolean> {
  const st = f(state());
  const due = (pred: (x: TimelineState["scheduled"][number]) => boolean) => (st.scheduled.find(pred)?.frame ?? 200) > 200;
  const on = (who: string) => (x: TimelineState["scheduled"][number]) => x.kind === "action" && typeof x.clock === "object" && x.clock.operator === who;
  return {
    world: due((x) => x.kind === "action" && x.clock === "world"),
    enemy: due((x) => x.kind === "action" && x.clock === "enemy"),
    caster: due(on("op")),
    teammate: due(on("mate")),
    burst: due((x) => x.kind === "burst"),
    buff: (st.buffs[0]?.expiresAt ?? 200) > 200,
    status: (st.enemy.statuses[0]?.expiresAt ?? 200) > 200,
    cooldown: (st.readyAt["op-skill"] ?? 250) > 250,
    sp: st.sp !== 50,
  };
}

describe("which clock each hold holds (docs/design/timeline.md)", () => {
  it("the caster's own combo slow-down: the world's, the enemy's, the teammates'; not hers, her bursts, cooldowns or SP", () => {
    expect(heldUnder((st) => slowDown(ctx, st, "op", COMBO, 100, "combo"))).toEqual({ world: true, enemy: true, caster: false, teammate: true, burst: false, buff: true, status: true, cooldown: false, sp: false });
  });

  it("her own ultimate stop: the same, and her bursts (burst-stops `all`)", () => {
    expect(heldUnder((st) => slowDown(ctx, st, "op", ULTIMATE, 100, "ultimate"))).toEqual({ world: true, enemy: true, caster: false, teammate: true, burst: true, buff: true, status: true, cooldown: false, sp: false });
  });

  it("a teammate's stop or slow-down: her clock and her bursts too", () => {
    expect(heldUnder((st) => slowDown(ctx, st, "mate", COMBO, 100, "combo"))).toMatchObject({ world: true, enemy: true, caster: true, burst: true, cooldown: false, sp: false });
  });

  it("a hidden hold: the world's and the enemy's only", () => {
    expect(heldUnder((st) => holdWorld(st, 100, 10))).toEqual({ world: true, enemy: true, caster: false, teammate: false, burst: false, buff: true, status: true, cooldown: false, sp: false });
  });

  it("a freeze: the enemy's and its statuses only", () => {
    expect(heldUnder((st) => shiftEnemy(st, 100, 10))).toEqual({ world: false, enemy: true, caster: false, teammate: false, burst: false, buff: false, status: true, cooldown: false, sp: false });
  });

  it("a Stagger-break hold: every clock, the breaker's too, not cooldowns or SP", () => {
    expect(heldUnder((st) => breakHold(ctx, st, 100))).toEqual({ world: true, enemy: true, caster: true, teammate: true, burst: true, buff: true, status: true, cooldown: false, sp: false });
  });
});
