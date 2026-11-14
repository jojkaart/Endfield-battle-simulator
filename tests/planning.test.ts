// Planning from the payoffs, phase 3 (docs/design.md "Payoffs and chains"): chains as macro actions in the beam
// search, skeletons as guides, a setup-aware value. A macro is a plain list of actions that replays through simulate;
// the beam's extra share leaves the rest of the beam as without it (never worse at the same width); the value is a
// plain function of the state.
import { describe, expect, it } from "vitest";
import {
  FPS,
  apply,
  committedDamage,
  createContext,
  init,
  legalActions,
  macroTree,
  memoised,
  payoffs,
  playMacros,
  searchRotation,
  setupTable,
  setupValue,
  simulate,
  skeletons,
  type MacroNode,
  type RotationAction,
  type TimelineScenario,
  type TimelineState,
} from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "../packages/cli/src/simulate.ts";

const data = loadGameData();
const open = (name: string, seconds: number): Omit<TimelineScenario, "rotation"> => {
  const { rotation: _r, ...rest } = readScenario(new URL(`../examples/${name}.scenario.json`, import.meta.url).pathname);
  return { ...rest, durationFrames: seconds * FPS };
};

describe("chains as macro actions", () => {
  const solo = open("laevatain-solo", 15);
  const report = payoffs(data, solo, { measure: 0 });
  const macros = macroTree(report.steps, report.chains);

  it("the chains' prefix tree: every chain's steps from a root, a chain's last step marked", () => {
    expect(report.chains.length).toBeGreaterThan(0);
    for (const c of report.chains) {
      let level: readonly MacroNode[] = macros;
      for (const [i, x] of c.steps.entries()) {
        const n = level.find((y) => y.step.id === x.step);
        expect(n).toBeDefined();
        expect(n?.opens).toBe(x.link === "opens");
        if (i === c.steps.length - 1) expect(n?.end).toBe(true);
        level = n?.next ?? [];
      }
    }
  });

  it("a macro played from a state is a list of actions that replays to the same state's damage", () => {
    const ctx = memoised(createContext(data, { ...solo, rotation: [] }));
    let s: TimelineState = init(ctx);
    const line: RotationAction[] = [];
    let played = 0;
    // Along the states of a plain line (the first choice each time), each macro offered there.
    for (let i = 0; i < 12 && played < 3; i++) {
      const choices = legalActions(ctx, s);
      for (const m of playMacros(ctx, s, macros, choices)) {
        played++;
        expect(m.actions.length).toBeGreaterThanOrEqual(2);
        expect(simulate(data, { ...solo, rotation: [...line, ...m.actions] }).total).toBe(committedDamage(ctx, m.state));
      }
      const c = choices[0];
      if (!c) break;
      s = apply(ctx, s, { ...c.action, at: c.frame });
      line.push({ ...c.action, at: c.frame });
    }
    expect(played).toBeGreaterThan(0);
  });

  it("the search with macros replays through simulate and finds at least as much at the same width", () => {
    const plain = searchRotation(data, solo, { beamWidth: 4, runs: 0 });
    const r = searchRotation(data, solo, { beamWidth: 4, runs: 0, macros });
    expect(r.counts.macros).toBeGreaterThan(0);
    expect(simulate(data, { ...solo, rotation: r.rotation }).total).toBe(r.result.total);
    expect(r.score).toBeGreaterThanOrEqual(plain.score);
  });
});

describe("skeletons as guides", () => {
  const sc = open("xaihi-si", 10);
  const report = payoffs(data, sc, { ceilings: false });
  const sk = skeletons(data, sc, report, { count: 3 });

  it("skeletons are legal rotations, best first", () => {
    expect(sk.length).toBe(3);
    for (const x of sk) expect(simulate(data, { ...sc, rotation: x.rotation }).total).toBeCloseTo(x.damage, 6);
    for (let i = 1; i < sk.length; i++) expect((sk[i] as (typeof sk)[number]).damage).toBeLessThanOrEqual((sk[i - 1] as (typeof sk)[number]).damage);
  });

  it("a guide list never does worse than the single-guide search at the same width, nor than any of its guides", () => {
    const narrow = searchRotation(data, sc, { beamWidth: 2, runs: 0 });
    const single = searchRotation(data, sc, { beamWidth: 4, runs: 0 }, { guide: narrow.rotation, guideScore: narrow.score });
    const list = searchRotation(data, sc, { beamWidth: 4, runs: 0 }, { guide: narrow.rotation, guideScore: narrow.score, guides: sk.map((x) => x.rotation) });
    expect(list.score).toBeGreaterThanOrEqual(single.score);
    for (const x of sk) expect(list.score).toBeGreaterThanOrEqual(x.damage - 1e-6);
    expect(simulate(data, { ...sc, rotation: list.rotation }).total).toBe(list.result.total);
  });
});

describe("the setup-aware value", () => {
  const sc = open("xaihi-si", 10);
  const report = payoffs(data, sc, { chains: false });
  const table = setupTable(report);

  it("is a plain function of the state: the same state, the same value, in any context of the scenario", () => {
    const a = memoised(createContext(data, { ...sc, rotation: [] }));
    const b = createContext(data, { ...sc, rotation: [] });
    let s = init(a);
    let nonzero = 0;
    for (let i = 0; i < 40; i++) {
      const c = legalActions(a, s)[0];
      if (!c) break;
      s = apply(a, s, { ...c.action, at: c.frame });
      const v = setupValue(a, table, s, 0.5);
      expect(setupValue(b, table, s, 0.5)).toBe(v);
      expect(setupValue(a, table, structuredClone(s), 0.5)).toBe(v);
      expect(setupValue(a, table, s, 1)).toBeCloseTo(2 * v, 9);
      if (v > 0) nonzero++;
    }
    expect(nonzero).toBeGreaterThan(0);
  });

  it("searches with it are deterministic and replay; in the extra share alone they find at least as much", () => {
    const one = searchRotation(data, sc, { beamWidth: 4, runs: 0, setup: table });
    const two = searchRotation(data, sc, { beamWidth: 4, runs: 0, setup: table });
    expect(two.rotation).toEqual(one.rotation);
    expect(simulate(data, { ...sc, rotation: one.rotation }).total).toBe(one.result.total);
    const plain = searchRotation(data, sc, { beamWidth: 4, runs: 0 });
    const share = searchRotation(data, sc, { beamWidth: 4, runs: 0, setup: table, setupShare: true });
    expect(share.score).toBeGreaterThanOrEqual(plain.score);
  });
});
