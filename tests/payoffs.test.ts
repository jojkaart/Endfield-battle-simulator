// Payoffs and chains (docs/design.md "Payoffs and chains"), and the search's pruning by them ("Pruning the search"):
// the table is the engine's probes (what a step produces, what it deals at most under the team's setups), the
// dominance rule is exact, the bound holds on the states of found rotations.
import { describe, expect, it } from "vitest";
import {
  FPS,
  advance,
  apply,
  committedDamage,
  createContext,
  dominatesState,
  earliestStart,
  init,
  memoised,
  payoffs,
  remainingBound,
  searchRotation,
  stateKeyer,
  upperBound,
  type RotationAction,
  type TimelineScenario,
} from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "../packages/cli/src/simulate.ts";

const data = loadGameData();
const open = (name: string, seconds?: number): Omit<TimelineScenario, "rotation"> => {
  const { rotation: _r, ...rest } = readScenario(new URL(`../examples/${name}.scenario.json`, import.meta.url).pathname);
  return seconds ? { ...rest, durationFrames: seconds * FPS } : rest;
};
const solo = open("laevatain-solo");
const LAEV = "chr_0016_laevat";

describe("payoffs: the table from engine probes", () => {
  const report = payoffs(data, solo);

  it("lists every castable step and the controlled operator's chain", () => {
    const ids = report.steps.map((s) => s.id);
    expect(ids).toContain(`${LAEV}:chain`);
    expect(ids).toContain(`${LAEV}:chr_0016_laevat_ultimate_skill`);
    expect(ids).toContain(`${LAEV}:chr_0016_laevat_normal_skill_during_ult`);
  });

  it("finds what a skill needs first: Laevatain's Twilight battle skill after her ultimate", () => {
    const e = report.effects.find((x) => x.step === `${LAEV}:chr_0016_laevat_normal_skill_during_ult` && x.situation === "none");
    expect(e?.prefix).toEqual([`${LAEV}:chr_0016_laevat_ultimate_skill`]);
    // Her ultimate's probe: Twilight, a state the plain battle skill and the enhanced attacks are gated by.
    const ult = report.effects.find((x) => x.step === `${LAEV}:chr_0016_laevat_ultimate_skill` && x.situation === "none");
    expect(ult?.buffs.map((b) => b.id)).toContain("twilight");
    expect(ult?.pieces.some((p) => p.kind === "buff" && p.buff.id === "twilight")).toBe(true);
  });

  it("ceilings: the bundle that raises a payoff, with the conflicts the engine knows", () => {
    const chain = report.ceilings.find((c) => c.step === `${LAEV}:chain`);
    // Under Twilight the chain is her enhanced attacks: worth far more than the plain chain.
    expect(chain?.bundle.map((b) => b.key)).toContain(`buff ${LAEV}:twilight`);
    expect(chain?.best).toBeGreaterThan(3 * (chain?.bare ?? 0));
    // Her combo hits only an enemy with Combustion (or Corrosion): the bundle has it, made by her battle skill at full Melting Flame.
    const combo = report.ceilings.find((c) => c.step === `${LAEV}:chr_0016_laevat_combo_skill`);
    expect(combo?.bare).toBe(0);
    expect(combo?.bundle[0]?.key).toMatch(/^status combustion/);
    expect(combo?.bundle[0]?.achievers.some((a) => a.step.endsWith("normal_skill") && a.situation === "own stacks full")).toBe(true);
    // Twilight shuts her plain battle skill: it's left out of that ceiling.
    expect(report.ceilings.find((c) => c.step === `${LAEV}:chr_0016_laevat_normal_skill`)?.against).toContain(`buff ${LAEV}:twilight`);
    for (const c of report.ceilings) expect(c.best).toBeGreaterThanOrEqual(c.bare - 1e-6);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(payoffs(data, solo))).toBe(JSON.stringify(report));
  });
});

describe("pruning the search: dominance", () => {
  const ctx = memoised(createContext(data, { ...solo, rotation: [] }));
  const s0 = init(ctx);

  it("a state with more SP is the same but for amounts, dominates, and keeps every continuation legal and as strong", () => {
    const richer = { ...s0, sp: s0.sp + 40 };
    const poorer = { ...s0, sp: s0.sp - 60 };
    const amounts = stateKeyer(ctx, false, true);
    expect(amounts(richer)).toBe(amounts(poorer));
    expect(stateKeyer(ctx)(richer)).not.toBe(stateKeyer(ctx)(poorer));
    expect(dominatesState(richer, committedDamage(ctx, richer), poorer, committedDamage(ctx, poorer))).toBe(true);
    expect(dominatesState(poorer, committedDamage(ctx, poorer), richer, committedDamage(ctx, richer))).toBe(false);
    // The poorer state's continuations (a found rotation, as recorded) play from the richer one at the same frames.
    const found = searchRotation(data, solo, { beamWidth: 4, runs: 0 }).rotation;
    let a = richer;
    let b = poorer;
    for (const recorded of found) {
      const e = earliestStart(ctx, b, recorded);
      if ("error" in e) break;
      // At the frame it starts from the poorer state: the richer one may start it then too (or sooner).
      const step = { ...recorded, at: e.frame };
      const ea = earliestStart(ctx, a, step);
      expect("error" in ea ? ea.error : ea.frame).toBe(e.frame);
      b = apply(ctx, b, step);
      a = apply(ctx, a, step);
      expect(a.frame).toBe(b.frame);
      expect(committedDamage(ctx, a)).toBeGreaterThanOrEqual(committedDamage(ctx, b) - 1e-6);
      expect(amounts(a)).toBe(amounts(b));
      expect(dominatesState(a, committedDamage(ctx, a), b, committedDamage(ctx, b))).toBe(true);
    }
  });

  it("more returned SP (spent first, no energy) doesn't dominate", () => {
    const returned = { ...s0, spReturned: 50 };
    expect(dominatesState(returned, committedDamage(ctx, returned), s0, committedDamage(ctx, s0))).toBe(false);
  });

  it("with dominance the search finds at least as much at the same width, the same when nothing is dominated", () => {
    for (const [sc, beam] of [[solo, 12], [open("si-laevatain", 10), 6]] as const) {
      const before = searchRotation(data, sc, { beamWidth: beam, runs: 0 });
      const after = searchRotation(data, sc, { beamWidth: beam, runs: 0, dominance: true });
      expect(after.score).toBeGreaterThanOrEqual(before.score - 1e-6);
      if (after.counts.dominated === 0) expect(after.rotation).toEqual(before.rotation);
    }
  });
});

describe("pruning the search: the bound", () => {
  const sc = open("laevatain-solo", 15);
  const ub = upperBound(payoffs(data, sc, { chains: false }));

  it("holds on every state of found rotations (committed + bound ≥ the final damage the rotation reaches from there)", () => {
    expect(ub.unbounded).toBeUndefined();
    const ctx = memoised(createContext(data, { ...sc, rotation: [] }));
    const wide = searchRotation(data, sc, { beamWidth: 48, runs: 0 });
    for (const r of [wide, searchRotation(data, sc, { beamWidth: 6, runs: 0 })]) {
      let s = init(ctx);
      const check = (st: typeof s) => expect(committedDamage(ctx, st) + remainingBound(ub, ctx, st)).toBeGreaterThanOrEqual(r.score - 1e-6);
      check(s);
      for (const step of r.rotation as RotationAction[]) {
        s = apply(ctx, s, step);
        if (s.frame < sc.durationFrames) check(s);
      }
    }
    expect(remainingBound(ub, ctx, advance(ctx, init(ctx), sc.durationFrames))).toBe(0);
  });

  it("with the bound the search finds at least as much at the same width and never cuts its guide's line", () => {
    for (const beam of [6, 12]) {
      const before = searchRotation(data, sc, { beamWidth: beam, runs: 0 });
      const after = searchRotation(data, sc, { beamWidth: beam, runs: 0, bound: ub });
      expect(after.score).toBeGreaterThanOrEqual(before.score - 1e-6);
      expect(after.counts.boundMisses).toBe(0);
      if (after.counts.bounded === 0) expect(after.rotation).toEqual(before.rotation);
    }
  });
});
