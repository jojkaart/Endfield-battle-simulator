// Rotation search (tests/search.test.ts), part 2: the search merges only states with the same future (stateKey). A
// separate file so the default suite's workers balance.
import { describe, expect, it } from "vitest";
import {
  advance,
  apply,
  committedDamage,
  createContext,
  init,
  legalActions,
  memoised,
  stateKey,
  stateKeyer,
  type RotationAction,
  type TimelineContext,
  type TimelineState,
} from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "../packages/cli/src/simulate.ts";

const data = loadGameData();
const example = readScenario(new URL("../examples/laevatain-solo.scenario.json", import.meta.url).pathname);
const { rotation: handWritten } = example;

describe("rotation search", () => {
  it("merges only states that are equal in everything that comes next (stateKey)", () => {
    const ctx = createContext(data, { ...example, rotation: [] });
    const s = advance(ctx, apply(ctx, init(ctx), handWritten[0] as RotationAction), 30);
    const buff = { id: "test", owner: s.controlled, target: "self" as const, appliedAt: 0, expiresAt: 300, modifiers: [] };
    const differ = (a: TimelineState, b: TimelineState) => expect(stateKey(ctx, a)).not.toBe(stateKey(ctx, b));
    // What the key sampled by hand before left these out: a buff's layers and when they were applied, the enemy's stagger
    // and freeze, a pending hit's snapshot, a delayed action's event.
    differ({ ...s, buffs: [buff] }, { ...s, buffs: [buff, buff] });
    differ({ ...s, buffs: [buff] }, { ...s, buffs: [{ ...buff, appliedAt: 10 }] });
    differ(s, { ...s, stagger: { ...s.stagger, poise: s.stagger.poise - 1 } });
    differ(s, { ...s, enemyFrozenUntil: 99 });
    const hit = { kind: "hit" as const, frame: 99, clock: { operator: s.controlled }, operator: s.controlled, skillId: "x", hitId: "y", sp: 0 };
    differ({ ...s, scheduled: [hit] }, { ...s, scheduled: [{ ...hit, snapshot: [{ zone: "atk" as const, value: 0.1, source: "test" }] }] });
    // The order a path built a record in doesn't matter; Infinity isn't null.
    expect(stateKey(ctx, { ...s, readyAt: { a: 100, b: 200 } })).toBe(stateKey(ctx, { ...s, readyAt: { b: 200, a: 100 } }));
    const { id, ...rest } = buff;
    expect(stateKey(ctx, { ...s, buffs: [buff] })).toBe(stateKey(ctx, { ...s, buffs: [{ ...rest, id }] }));
    differ({ ...s, buffs: [{ ...buff, expiresAt: Infinity }] }, { ...s, buffs: [{ ...buff, expiresAt: Number.NaN }] });
  });

  it("leaves out deadlines already past: states that differ only in them have one key and the same future", () => {
    const si = readScenario(new URL("../examples/si-laevatain.scenario.json", import.meta.url).pathname);
    const ctx = memoised(createContext(data, { ...si, rotation: [] }));
    let s = init(ctx);
    for (const a of si.rotation.slice(0, 7)) s = apply(ctx, s, a);
    const f = s.frame;
    const [si0, lae] = si.team.map((b) => b.operator) as [string, string];
    const uncounted = ctx.kits.get(si0)?.triggers.find((t) => t.maxCount === undefined && (s.triggerState[`${si0}:${t.id}`]?.readyAt ?? 0) <= f)?.id;
    expect(uncounted).toBeDefined();
    // Each read only as "later than the frame now" (search.ts KeyEnv): any value at or before the frame is none.
    const dead: TimelineState = {
      ...s,
      readyAt: { ...s.readyAt, [`${lae}_combo_skill`]: Math.min(s.readyAt[`${lae}_combo_skill`] ?? 0, f - 3), unknown_skill: f },
      energyBlockedUntil: { ...s.energyBlockedUntil, [si0]: Math.min(s.energyBlockedUntil[si0] ?? 0, f - 1) },
      spPausedUntil: s.spPausedUntil > f ? s.spPausedUntil : f - 2,
      // A trigger without a count limit, ready again: when it last fired and how often aren't read.
      triggerState: { ...s.triggerState, [`${si0}:${uncounted}`]: { readyAt: f - 1, count: 9 } },
      link: [...s.link, f - 10],
      enemyFrozenUntil: s.enemyFrozenUntil > f ? s.enemyFrozenUntil : f - 4,
      stagger: s.stagger.until === null ? { ...s.stagger, finisherUsed: !s.stagger.finisherUsed } : s.stagger,
      slowdowns: [...s.slowdowns, { start: f - 40, scales: [0, 0, 0], exempt: si0 }],
      comboWindow: { ...s.comboWindow, ...(s.comboWindow[lae] && s.comboWindow[lae].until >= f ? {} : { [lae]: { from: f - 60, until: f - 1, count: 2 } }) },
      chainNext: { ...s.chainNext, ...(s.chainNext[si0] && s.chainNext[si0].until >= f ? {} : { [si0]: { skill: `${si0}_attack2`, from: f - 20, until: f - 1 } }) },
    };
    expect(stateKey(ctx, dead)).toBe(stateKey(ctx, s));
    expect(stateKey(ctx, dead)).not.toBe(stateKey(ctx, { ...dead, link: [...s.link, f + 10] }));
    expectSameFuture(ctx, s, dead, 40);
  });

  it("merges states with the same future only (pairs a small beam meets, followed for the rest of the fight)", () => {
    let pairs = 0;
    for (const name of ["si-laevatain", "laevatain-solo"]) {
      const sc = readScenario(new URL(`../examples/${name}.scenario.json`, import.meta.url).pathname);
      const ctx = memoised(createContext(data, { ...sc, rotation: [] }));
      const key = stateKeyer(ctx);
      // What the key compared before (2026-10-24: every field in full, cast indices as they are) tells pairs only the new key merges.
      const raw = (x: TimelineState) => JSON.stringify({ ...x, hits: [], reactions: [] });
      // A beam by depth (choices made), not by time: paths of one length that meet.
      let frontier = [init(ctx)];
      for (let depth = 0; depth < 40 && frontier.length; depth++) {
        const byKey = new Map<string, TimelineState>();
        for (const x of frontier) {
          for (const c of legalActions(ctx, x)) {
            const child = apply(ctx, x, { ...c.action, at: c.frame });
            const k = key(child);
            const seen = byKey.get(k);
            if (!seen) byKey.set(k, child);
            else if (raw(seen) !== raw(child) && pairs < 40) {
              pairs++;
              expectSameFuture(ctx, seen, child, 40);
            }
          }
        }
        frontier = [...byKey.values()].sort((x, y) => committedDamage(ctx, y) - committedDamage(ctx, x)).slice(0, 16);
      }
    }
    expect(pairs).toBeGreaterThan(10);
  });
});

/** Two states play on the same: the same choices (actions and frames), the same damage to come and keys, whichever choices are taken. */
function expectSameFuture(ctx: TimelineContext, a0: TimelineState, b0: TimelineState, steps: number): void {
  const key = stateKeyer(ctx);
  let a = a0;
  let b = b0;
  for (let i = 0; i < steps; i++) {
    const ca = legalActions(ctx, a);
    expect(legalActions(ctx, b)).toEqual(ca);
    const c = ca[(i * 7) % Math.max(1, ca.length)];
    if (!c) break;
    const step = { ...c.action, at: c.frame };
    const a1 = apply(ctx, a, step);
    const b1 = apply(ctx, b, step);
    const gain = (x: TimelineState, y: TimelineState) => committedDamage(ctx, y) - committedDamage(ctx, x);
    expect(gain(b, b1)).toBeCloseTo(gain(a, a1), 6);
    expect(key(b1)).toBe(key(a1));
    a = a1;
    b = b1;
  }
}
