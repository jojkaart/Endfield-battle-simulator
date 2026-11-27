// The enemy's statuses per target in a replay of several targets under one enemy id (replay assumption
// target-statuses `per-target`; engine TimelineScenario.landingTargets, timeline/targets.ts; packages/logs
// logcheck.ts logBuffReplay's second pass, enginecheck.ts replayTargets; docs/design/data.md "Statuses per target"):
// a landing lands on its target, a landing logged on several applies what it inflicts on each, a death ends its own
// target's statuses, and the views read the replay's record (DEATH lines, `zmdlogs statuses`).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { advance, createContext, effectiveKit, init, replayCast, targetDies, targetEnemy, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { deathDecisions, devFixtures, hitRecords, logBuffReplay, statusesView, targetMismatches, type LogFixture } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;
const CAMILLE = "chr_0033_camille";
const SKILL = `${CAMILLE}_normal_skill`;

describe("engine: statuses per target (TimelineScenario.landingTargets)", () => {
  const fx = fixture("6339");
  const team = fx.team.filter((b) => b.operator === CAMILLE);
  const base: TimelineScenario = { team, target: { enemy: fx.enemy.id, level: fx.enemy.level }, durationFrames: 900, rotation: [], options: { crit: "never" } };
  const kit = effectiveKit(data, team[0] as (typeof team)[number]);
  const event = kit?.skills.find((k) => k.skillId === SKILL)?.hits[0]?.events[0] as string;
  // Where Camille's battle skill's first hit lands with one enemy.
  const one = advance(createContext(data, base), replayCast(createContext(data, base), init(createContext(data, base)), CAMILLE, SKILL, 0), 60);
  const landing = one.hits.find((h) => h.operator === CAMILLE)?.frame as number;
  const heat = (st: TimelineState, t: number) => {
    const e = targetEnemy(st, t);
    return e.infliction?.element === "fire" ? e.infliction.stacks : 0;
  };
  const run = (targets: readonly number[]) => {
    const ctx = createContext(data, { ...base, landingTargets: [{ operator: CAMILLE, event, frame: landing, targets }] });
    return { ctx, st: advance(ctx, replayCast(ctx, init(ctx), CAMILLE, SKILL, 0), 60) };
  };

  it("one enemy without landingTargets: no per-target state", () => {
    expect(one.targets).toBeUndefined();
    expect(heat(one, 0)).toBeGreaterThan(0);
  });

  it("a landing on target 1 inflicts target 1 only, and makes it current", () => {
    const { st } = run([1]);
    expect(st.targets?.current).toBe(1);
    expect(heat(st, 1)).toBe(heat(one, 0));
    expect(heat(st, 0)).toBe(0);
    expect(st.hits.find((h) => h.frame === landing && h.operator === CAMILLE)?.target).toBe(1);
  });

  it("a landing logged on two targets inflicts both; its LandedHit records the other's statuses before", () => {
    const { st } = run([0, 1]);
    expect(st.targets?.current).toBe(0);
    expect(heat(st, 0)).toBeGreaterThan(0);
    expect(heat(st, 1)).toBe(heat(st, 0));
    const l = st.hits.find((h) => h.frame === landing && h.operator === CAMILLE);
    expect(l?.otherTargets?.map((x) => x.target)).toEqual([1]);
  });

  it("a death of one target ends its statuses only, the target hit last current again", () => {
    const { ctx, st } = run([0, 1]);
    const after = advance(ctx, targetDies(ctx, st, 300, [], { target: 1, except: new Set([`${CAMILLE}:vesperwings_move`, `${CAMILLE}:vesperwings_move_cast`]) }), 310);
    expect(after.targets?.current).toBe(0);
    expect(heat(after, 1)).toBe(0);
    expect(heat(after, 0)).toBe(heat(st, 0));
  });
});

describe("the second replay of a fight read per target (target-statuses `per-target`)", () => {
  const fx = fixture("9c6e");
  const per = logBuffReplay(data, fx).replay;
  const one = logBuffReplay(data, fx, { assume: { "target-statuses": "one" } }).replay;

  it("is made on the first one's assignment, its landings and status records carrying their targets", () => {
    expect(one.targets).toBeUndefined();
    expect(per.targets?.landings.some((l) => l.targets.length > 1)).toBe(true);
    expect(per.hits.every((h) => h.target !== undefined)).toBe(true);
    expect(per.reactions.every((r) => r.target !== undefined)).toBe(true);
    // Two Wanderers at once: status events on more than one target.
    expect(new Set(per.reactions.map((r) => r.target)).size).toBeGreaterThan(1);
  });

  it("each logged kill is its target's death (DEATH lines from the replay's record)", () => {
    const kills = fx.hits.filter((h) => h.uncapped !== undefined && h.uncapped !== null && h.uncapped > h.value && h.t < Math.max(...fx.hits.map((x) => x.t)));
    const lines = deathDecisions(data, per);
    expect(lines.length).toBe(new Set(kills.map((h) => per.targets?.kills.get(h))).size);
    expect(lines.every((l) => / dies, its statuses end/.test(l.text))).toBe(true);
  });

  it("`zmdlogs statuses` prints the record per target", () => {
    const text = statusesView(data, fx, { targets: [1] });
    const rows = text.split("\n").slice(1);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => /^\s+[\d.]+\s+T1\s/.test(r))).toBe(true);
  });
});

describe("DEATH lines: every death the replay made (6339), not only the moves", () => {
  it("lists the kills without a move too (10.35, 11.31 s)", () => {
    const fx = fixture("6339");
    const r = logBuffReplay(data, fx, { assume: { "target-statuses": "one" } }).replay;
    const lines = deathDecisions(data, r);
    expect(lines.map((l) => Math.round(l.t / 10) / 100)).toEqual([10.33, 11.3, 19.6, 20.37, 24.03, 29.27, 31.63]);
    expect(lines.filter((l) => /pinned at the logged hit/.test(l.text))).toHaveLength(5);
  });
});

// Round 21 (the statuses-per-target report point 2): the check's target ids against the replay's landings' targets
// (HitRecord.target `landing`, `≠ landing` in `zmdlogs hits`). 7b54 is on the backlog's accuracy list: its second
// assignment (SECOND_PASS_TARGETS `free`) numbers 147 of 210 hits' targets otherwise than their landings.
describe("the check's targets are the replay's landings' targets (hits --json target.landing)", () => {
  it("6339: every hit with both; 9c6e: all but one", () => {
    const one = targetMismatches(hitRecords(data, fixture("6339")));
    expect(one.both).toBeGreaterThan(100);
    expect(one.differ).toHaveLength(0);
    const two = targetMismatches(hitRecords(data, fixture("9c6e")));
    expect(two.both).toBeGreaterThan(300);
    expect(two.differ.length).toBeLessThanOrEqual(1);
  });
});

// Round 21 (the target-statuses report point 1): a stack's arrival, from the replay's states.
describe("`zmdlogs statuses --inflictions` (6339)", () => {
  it("prints each target's infliction change at a frame of kit landings, with them", () => {
    const text = statusesView(data, fixture("6339"), { from: 19000, to: 21000, inflictions: true });
    expect(text).toMatch(/19\.70 {2}T3 {2}infliction none → fire×1 {2}\(landings: Camille normal_skill /);
    expect(text).toMatch(/20\.37 {2}T3 {2}infliction fire×1 → none/);
  });
});
