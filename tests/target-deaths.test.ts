// A target's death in a fight against several targets under one id (replay assumption target-deaths; packages/logs
// targets.ts targetDeaths, engine targetDies' TargetDeathOptions): a death at each logged kill, Laevatain absorbing the
// dead target's Heat (buff_chr_0016_laevat_passive_enemy, abilityEvent 1: kit trigger death_absorb), Camille's move only
// where the log shows its landing, and the dead target's statuses ending with it (6339's Vesperwings moves put Heat on
// a fresh slug: no burst).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { advance, createContext, effectiveKit, init, replayCast, targetDies, type OperatorKit, type TimelineScenario } from "@efsim/engine";
import { devFixtures, logBuffReplay, targetDeaths, type LogFixture } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;
const LAEVATAIN = "chr_0016_laevat";
const CAMILLE = "chr_0033_camille";
const kitsOf = (fx: LogFixture): OperatorKit[] => fx.team.flatMap((b) => {
  const k = effectiveKit(data, b);
  return k ? [k] : [];
});

describe("engine targetDies' options", () => {
  const fx = fixture("6339");
  const sc: TimelineScenario = { team: fx.team.filter((b) => b.operator === CAMILLE || b.operator === LAEVATAIN), target: { enemy: fx.enemy.id, level: fx.enemy.level }, durationFrames: 900, rotation: [], options: { crit: "never" } };
  const ctx = createContext(data, sc);
  // Camille's battle skill: Heat on the enemy and her Vesperwings (the move's listener).
  const cast = advance(ctx, replayCast(ctx, init(ctx), CAMILLE, `${CAMILLE}_normal_skill`, 0), 60);
  const heat = (st: typeof cast) => (st.enemy.infliction?.element === "fire" ? st.enemy.infliction.stacks : 0);
  const flame = (st: typeof cast) => st.stacks[LAEVATAIN]?.melting_flame ?? 0;

  it("Laevatain absorbs the dead target's Heat as Melting Flame", () => {
    expect(heat(cast)).toBeGreaterThan(0);
    const st = advance(ctx, targetDies(ctx, cast, 300, [], { except: new Set([`${CAMILLE}:vesperwings_move`, `${CAMILLE}:vesperwings_move_cast`]) }), 310);
    expect(flame(st)).toBe(flame(cast) + heat(cast));
    expect(heat(st)).toBe(0);
    expect(st.hits.some((h) => h.hitId === "move")).toBe(false);
  });

  it("ends the dead target's statuses after its triggers (the move's Heat on the next, fresh)", () => {
    const kept = advance(ctx, targetDies(ctx, cast, 300), 310);
    const ended = advance(ctx, targetDies(ctx, cast, 300, [], { endsStatuses: true }), 310);
    // The move's Heat 3 frames after the death: on the replay's enemy as the only stack once the dead one's are gone.
    expect(ended.hits.filter((h) => h.hitId === "move")).toHaveLength(1);
    expect(heat(ended)).toBe(1);
    expect(kept.reactions.filter((r) => r.kind === "consumed").length).toBe(ended.reactions.filter((r) => r.kind === "consumed").length);
  });
});

describe("targets.ts targetDeaths (6339)", () => {
  const fx = fixture("6339");
  const kits = kitsOf(fx);
  it("`kills` (the default) makes one at each logged kill before the last, Camille's triggers only at her logged moves; `moves` the moves' only", () => {
    expect(targetDeaths(fx, kits, { "target-deaths": "moves" }).every((d) => d.moves.length > 0 && d.except.size === 0 && !d.endsStatuses)).toBe(true);
    const kills = targetDeaths(fx, kits, {});
    // Kills at 10.35, 11.31 (two at one ms: one death), 20.37, 24.02, 29.26, 31.62 (35.70 is the log's last), and the
    // 19.68 s move after no kill.
    expect(kills.map((d) => Math.round((d.frame * 1000) / 30 / 10) / 100)).toEqual([10.33, 11.3, 19.6, 20.37, 24.03, 29.27, 31.63]);
    for (const d of kills) expect(d.except.has(`${CAMILLE}:vesperwings_move`)).toBe(d.moves.length === 0);
    expect(kills.some((d) => d.endsStatuses)).toBe(false);
    expect(targetDeaths(fx, kits, { "target-deaths": "statuses" }).every((d) => d.endsStatuses)).toBe(true);
  });

  it("no replay-only Heat burst after Camille's moves: Laevatain absorbed the dead slug's Heat at its death", () => {
    const bursts = (assume: Record<string, string>) => {
      const r = logBuffReplay(data, fx, { assume });
      return (r.replay.stateAt(1100)?.reactions ?? []).filter((x) => x.kind === "burst" && x.operator === CAMILLE).length;
    };
    expect(bursts({})).toBe(0);
    expect(bursts({ "target-deaths": "moves" })).toBe(0);
    expect(bursts({ "target-deaths": "statuses" })).toBe(0);
  });
});
