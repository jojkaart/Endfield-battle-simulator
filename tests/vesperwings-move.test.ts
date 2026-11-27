// Camille's Vesperwings moving to the next target when its own dies (kit trigger vesperwings_move on the engine's
// `targetDeath` event, which only the log check's replay makes: engine targetDies; packages/logs targets.ts
// deathMoves and moveEvent). The data: listen_target_dead → reset_target (0.1 s) → projhit_sub → abilityrange on the
// next target: the battle skill's damage, Heat infliction and the debuff with the time it had left (keepEnd).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { advance, createContext, init, replayCast, targetDies, type TimelineScenario } from "@efsim/engine";
import { deathMoves, devFixtures, logBuffReplay, loggedCastFates, moveEvent, type LogFixture } from "@efsim/logs";
import { effectiveKit, type OperatorKit } from "@efsim/engine";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;
const CAMILLE = "chr_0033_camille";
const BATTLE = `${CAMILLE}_normal_skill`;
const kitsOf = (fx: LogFixture): OperatorKit[] => fx.team.flatMap((b) => {
  const k = effectiveKit(data, b);
  return k ? [k] : [];
});

describe("engine targetDies: Camille's Vesperwings move", () => {
  const fx = fixture("6339");
  const sc: TimelineScenario = { team: fx.team.filter((b) => b.operator === CAMILLE), target: { enemy: fx.enemy.id, level: fx.enemy.level }, durationFrames: 900, rotation: [], options: { crit: "never" } };
  const ctx = createContext(data, sc);
  const cast = advance(ctx, replayCast(ctx, init(ctx), CAMILLE, BATTLE, 0), 60);
  const debuff = (st: typeof cast) => st.buffs.filter((b) => b.owner === CAMILLE && b.id === "vesperwings");

  it("lands the move 3 frames after the death with Heat and a new debuff instance ending where the old one did", () => {
    const [before] = debuff(cast);
    expect(before).toBeDefined();
    const st = advance(ctx, targetDies(ctx, cast, 300), 310);
    const moves = st.hits.filter((h) => h.operator === CAMILLE && h.hitId === "move");
    expect(moves.map((h) => h.frame)).toEqual([303]);
    expect(moves[0]?.damage).toBe(st.hits.find((h) => h.hitId === "abilityrange_first")?.damage);
    const after = debuff(st);
    expect(after).toHaveLength(1);
    expect(after[0]?.appliedAt).toBe(303);
    expect(after[0]?.expiresAt).toBe(before?.expiresAt);
    const stacks = (f: number) => {
      const i = advance(ctx, targetDies(ctx, cast, 300), f).enemy.infliction;
      return i?.element === "fire" ? i.stacks : 0;
    };
    expect(stacks(303)).toBe(stacks(302) + 1);
  });

  it("pins the landing at a logged frame, and does nothing without the debuff", () => {
    const st = advance(ctx, targetDies(ctx, cast, 300, [{ trigger: "vesperwings_move", hitId: "move", frame: 312, ref: "7" }]), 320);
    expect(st.hits.filter((h) => h.hitId === "move").map((h) => [h.frame, h.ref])).toEqual([[312, "7"]]);
    const none = advance(ctx, targetDies(ctx, init(ctx), 30), 60);
    expect(none.hits.some((h) => h.hitId === "move")).toBe(false);
  });
});

describe("targets.ts deathMoves and moveEvent (6339, 7b54)", () => {
  it("reads each logged move, the kill before it, and the normal_skill events at four of them as no press", () => {
    const at = { "6339": [19684, 20596, 24555, 29672, 32158], "7b54": [16589] } as const;
    const kills = { "6339": [null, 20367, 24019, 29258, 31620], "7b54": [16360] } as const;
    const events = { "6339": [19684, 24555, 29672], "7b54": [16589] } as const;
    for (const id of ["6339", "7b54"] as const) {
      const fx = fixture(id);
      const moves = deathMoves(fx, kitsOf(fx));
      expect(moves.map((m) => m.hit.t)).toEqual(at[id]);
      expect(moves.map((m) => m.kill?.t ?? null)).toEqual(kills[id]);
      expect((fx.casts ?? []).filter((lc) => moveEvent(moves, lc)).map((lc) => lc.t)).toEqual(events[id]);
      expect(loggedCastFates(data, fx).filter((f) => f.fate === "move").map((f) => f.t)).toEqual(events[id]);
    }
  });

  it("lands every logged move pinned in the replay, and makes no battle skill at its event", () => {
    const fx = fixture("6339");
    const { replay } = logBuffReplay(data, fx);
    const moves = replay.hits.filter((h) => h.operator === CAMILLE && h.hitId === "move");
    expect(moves.map((h) => h.ref)).toEqual(deathMoves(fx, kitsOf(fx)).map((m) => String(fx.hits.indexOf(m.hit))));
    expect(replay.made.filter((m) => m.skillId === BATTLE).map((m) => m.cast.start)).toEqual([13632]);
  });
});
