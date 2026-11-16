// The payoff-guided rule search (engine policyguide.ts, cli guided.ts; docs/design.md "Rule-based rotations", the
// guided search): a hit's damage with a multiplier added or taken away, window and multiplier attribution on a small
// fight (who gives what, the factor when on, the loss when off), edits made from a loss (a hold rule, a chain), and
// the acceptance rule.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import {
  guidedEdits,
  guideRules,
  judgeEdit,
  mergeEdits,
  multiplierKey,
  pairedGain,
  playRules,
  resolveRuleList,
  stepsOf,
  summariseGuide,
  windowCues,
  withModifiers,
  type GuideSummary,
  type LandedHit,
  type Modifier,
  type RuleList,
  type TimelineScenario,
} from "@efsim/engine";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SI = "chr_0036_jsspsi";
const LAEVATAIN = "chr_0016_laevat";

/** A landed hit with these zones and modifiers (exact = the zones' product). */
function hit(mods: readonly Modifier[], zones: Partial<LandedHit["zones"]> = {}): LandedHit {
  const z = { atk: 1000, scale: 2, damageBonus: 1, crit: 1, amp: 1, susceptibility: 1, damageTaken: 1, multiplicative: 1, defense: 0.5, resistance: 1, ...zones };
  return { skillId: "s", hitId: "h", label: "", count: 1, element: "fire", scaleParts: [], zones: z, modifiers: mods, exact: Object.values(z).reduce((p, x) => p * x, 1), damage: 0, frame: 0, operator: "x" };
}

describe("a hit with a multiplier added or taken away", () => {
  it("recomputes the additive zones, the multiplicative zone and resistance from the hit's modifiers", () => {
    const heat: Modifier = { zone: "damageBonus", value: 0.5, source: "gear" };
    const h = hit([heat], { damageBonus: 1.5 });
    const amp: Modifier = { zone: "amp", value: 0.36, source: "x", kitBuff: { owner: SI, id: "ultimate_amp" } };
    expect(withModifiers(h, [amp], () => false) / h.exact).toBeCloseTo(1.36, 9);
    // Another damage bonus adds to the zone: (1.5 + 0.2) / 1.5.
    expect(withModifiers(h, [{ zone: "damageBonus", value: 0.2, source: "y" }], () => false) / h.exact).toBeCloseTo(1.7 / 1.5, 9);
    // An element filter the hit doesn't meet: nothing.
    expect(withModifiers(h, [{ zone: "amp", value: 0.36, source: "x", element: "cryst" }], () => false)).toBeCloseTo(h.exact, 9);
    // Stagger taken away: ÷1.3; resistance points added back: (80 + 20) / 80.
    const stag: Modifier = { zone: "multiplicative", value: 0.3, source: "Staggered" };
    const s = hit([stag], { multiplicative: 1.3, resistance: 0.8 });
    expect(withModifiers(s, [], (m) => multiplierKey(m) === "stagger") / s.exact).toBeCloseTo(1 / 1.3, 9);
    expect(withModifiers(s, [{ zone: "ignoreResistance", value: 20, source: "Corrosion level 1" }], () => false) / s.exact).toBeCloseTo(100 / 80, 9);
  });

  it("names the multipliers a rule can line up: kit buffs, Stagger, statuses; not the stat panel", () => {
    expect(multiplierKey({ zone: "amp", value: 0.36, source: "x", kitBuff: { owner: SI, id: "ultimate_amp" } })).toBe(`${SI}:ultimate_amp`);
    expect(multiplierKey({ zone: "multiplicative", value: 0.3, source: "Staggered" })).toBe("stagger");
    expect(multiplierKey({ zone: "ignoreResistance", value: 5, source: "Corrosion level 2" })).toBe("status:corrosion");
    expect(multiplierKey({ zone: "critRate", value: 0.05, source: "stat panel: CriticalRate" })).toBeNull();
    expect(multiplierKey({ zone: "multiplicative", value: 0.75, source: "Finisher" })).toBeNull();
  });
});

describe("windows and multipliers on a small fight", () => {
  const scenario = readScenario(join(ROOT, "examples/si-laevatain.scenario.json"));
  const team = scenario.team.map((b) => b.operator);
  const list = resolveRuleList(data, team, {
    opener: [{ operator: "Si", cast: "battle" }],
    rules: [
      { when: { ultimate: "Laevatain" }, do: { operator: "Laevatain", cast: "ultimate" } },
      { when: { ultimate: "Si" }, do: { operator: "Si", cast: "ultimate" } },
      { when: { combo: "Si" }, do: { operator: "Si", cast: "combo" } },
      { when: { combo: "Laevatain" }, do: { operator: "Laevatain", cast: "combo" } },
      { when: { sp: { atLeast: 100 } }, do: { operator: "Laevatain", cast: "battle" } },
    ],
  });
  const fight: Omit<TimelineScenario, "rotation"> = { ...scenario, controlled: LAEVATAIN, durationFrames: 120 * 30 };
  const { run, guide } = guideRules(data, fight, list, { reactionSeconds: 0 });

  it("doesn't change the run", () => {
    const plain = playRules(data, fight, list, { reactionSeconds: 0 });
    expect(run.rotation).toEqual(plain.rotation);
    expect(guide.total).toBeCloseTo(plain.total, 6);
  });

  it("finds who gives Si's Amp (her ultimate), its ×1.36 where it was on, and a loss where it wasn't", () => {
    expect(guide.multipliers[`${SI}:ultimate_amp`]?.givers[`${SI}:ultimate`]).toBeGreaterThan(0);
    const s = summariseGuide([guide]);
    const losses = s.losses.filter((l) => l.multiplier === `${SI}:ultimate_amp`);
    expect(losses.length).toBeGreaterThan(0);
    const on = losses.filter((l) => l.presence > 0);
    for (const l of on) expect(l.factor).toBeGreaterThan(1.3);
    expect(losses.some((l) => l.presence < 1 && l.lossDps > 0)).toBe(true);
    for (const l of losses) expect(l.giver).toBe(`${SI}:ultimate`);
    // Windows: Laevatain's Twilight attacks come with Twilight; achievement is a share; the ideal's gain is at least each single loss.
    const twilight = s.windows.find((w) => w.operator === LAEVATAIN && w.family.endsWith("ult_attack"));
    expect(twilight).toBeDefined();
    expect(windowCues(twilight as NonNullable<typeof twilight>)).toContainEqual({ buff: { operator: LAEVATAIN, buff: "twilight" } });
    for (const w of s.windows) {
      expect(w.achievement).toBeGreaterThan(0);
      expect(w.achievement).toBeLessThanOrEqual(1);
      for (const l of w.losses) expect(w.idealDps + 1e-6).toBeGreaterThanOrEqual(l.lossDps);
    }
  });
});

describe("edits from a loss", () => {
  // Ink Melt's case by hand: Laevatain's Twilight battle skill misses Si's Amp half the time; Si's ultimate fires when ready.
  const list: RuleList = {
    opener: [],
    rules: [
      { when: { ultimate: LAEVATAIN }, do: { operator: LAEVATAIN, cast: "ultimate" } },
      { when: { ultimate: SI }, do: { operator: SI, cast: "ultimate" } },
      { when: { buff: { operator: LAEVATAIN, buff: "twilight" } }, do: { operator: LAEVATAIN, cast: "battle" } },
    ],
  };
  const window = `${LAEVATAIN}|${LAEVATAIN}_normal_skill_during_ult`;
  const summary: GuideSummary = {
    runs: 1,
    seconds: 300,
    dps: 60000,
    totalDps: 60000,
    idealDps: 3000,
    achievement: 60000 / 63000,
    spAtCapShare: 0,
    windows: [
      {
        key: window,
        operator: LAEVATAIN,
        family: `${LAEVATAIN}_normal_skill_during_ult`,
        label: "Laevatain's Battle skill (Twilight)",
        kind: "battle",
        dps: 6000,
        perMinute: 1.5,
        idealDps: 3000,
        achievement: 0.67,
        losses: [{ window, multiplier: `${SI}:ultimate_amp`, label: "Si's Amp", owner: SI, presence: 0.5, factor: 1.36, lossDps: 1000, giver: `${SI}:ultimate` }],
        cues: [
          { cue: { buff: { operator: LAEVATAIN, buff: "twilight" } }, atStart: 1, base: 0.36, lift: 2.8 },
          { cue: { sp: { atLeast: 100 } }, atStart: 0.9, base: 0.25, lift: 3.6 },
        ],
      },
    ],
    losses: [],
    multipliers: { [`${SI}:ultimate_amp`]: { label: "Si's Amp", owner: SI, zones: ["amp"], givers: { [`${SI}:ultimate`]: 5 } } },
    visibleGivers: { [`${LAEVATAIN}:twilight`]: { [`${LAEVATAIN}:ultimate`]: 5 } },
    cueShare: [],
  };
  const s: GuideSummary = { ...summary, losses: summary.windows[0]?.losses ?? [] };
  const edits = guidedEdits(data, list, s);

  it("holds the giver's ultimate for the window's visible cue (alone, or with the window's ultimate ready)", () => {
    const holds = edits.filter((e) => e.kind === "hold-giver");
    const twilight = { buff: { operator: LAEVATAIN, buff: "twilight" } };
    expect(holds.map((e) => e.list.rules[1]?.when)).toContainEqual({ all: [{ ultimate: SI }, twilight] });
    expect(holds.map((e) => e.list.rules[1]?.when)).toContainEqual({ all: [{ ultimate: SI }, { any: [twilight, { ultimate: LAEVATAIN }] }] });
    // An SP level isn't a window's cue; the other rules are untouched.
    for (const e of holds) {
      expect(JSON.stringify(e.list.rules[1]?.when)).not.toContain("\"sp\"");
      expect(e.list.rules[0]).toEqual(list.rules[0]);
      expect(e.list.rules[2]).toEqual(list.rules[2]);
    }
    // Every edit resolves against the team.
    for (const e of edits) expect(() => resolveRuleList(data, [LAEVATAIN, SI, "chr_0006_wolfgd", "chr_0025_ardelia"], e.list)).not.toThrow();
  });

  it("chains the two ultimates as one rule, and starts nothing twice", () => {
    const chain = edits.find((e) => e.kind === "chain");
    expect(chain?.list.rules[0]?.when).toEqual({ all: [{ ultimate: SI }, { ultimate: LAEVATAIN }] });
    expect(stepsOf(chain?.list.rules[0] as NonNullable<RuleList["rules"][number]>)).toEqual([{ operator: SI, cast: "ultimate" }, { operator: LAEVATAIN, cast: "ultimate" }]);
    expect(new Set(edits.map((e) => JSON.stringify(e.list))).size).toBe(edits.length);
    // Not again once judged.
    const again = guidedEdits(data, list, s, { tried: new Set(edits.map((e) => JSON.stringify(e.list))) });
    expect(again).toHaveLength(0);
  });
});

describe("two edits together", () => {
  const base: RuleList = {
    opener: [],
    rules: [
      { when: { ultimate: SI }, do: { operator: SI, cast: "ultimate" } },
      { when: { combo: SI }, do: { operator: SI, cast: "combo" } },
      { when: { sp: { atLeast: 100 } }, do: { operator: SI, cast: "battle" } },
    ],
  };
  const hold: RuleList = { ...base, rules: base.rules.map((r, i) => (i === 0 ? { ...r, when: { all: [r.when, { staggered: true }] } } : r)) };
  const shows: RuleList = { ...base, rules: base.rules.map((r, i) => (i === 2 ? { ...r, do: { operator: SI, cast: "battle" as const, shows: "x" } } : r)) };
  it("merges in-place edits of different rules, and nothing else", () => {
    const m = mergeEdits(base, hold, shows);
    expect(m?.rules[0]).toEqual(hold.rules[0]);
    expect(m?.rules[1]).toEqual(base.rules[1]);
    expect(m?.rules[2]).toEqual(shows.rules[2]);
    expect(mergeEdits(base, hold, hold)).toBeNull();
    expect(mergeEdits(base, hold, { ...base, rules: [...base.rules, base.rules[0] as RuleList["rules"][number]] })).toBeNull();
  });
});

describe("the acceptance rule", () => {
  const base = [100, 102, 98, 101, 99, 100, 103, 97, 100, 101];
  it("keeps a gain beyond twice its standard error that holds on the fresh seeds", () => {
    const better = base.map((x, i) => x * 1.03 + (i % 2 ? 0.3 : -0.3));
    const j = judgeEdit(base, better, 4);
    expect(j.gain).toBeCloseTo(0.03, 2);
    expect(j.pass).toBe(true);
  });
  it("refuses noise, a gain under 0.2%, and a gain only on the screening seeds", () => {
    const noisy = base.map((x, i) => x + (i % 2 ? 3 : -2.6));
    expect(judgeEdit(base, noisy, 4).pass).toBe(false);
    const tiny = base.map((x) => x * 1.001);
    expect(judgeEdit(base, tiny, 4).pass).toBe(false);
    const lucky = base.map((x, i) => (i < 4 ? x * 1.2 : x * 0.999));
    const j = judgeEdit(base, lucky, 4);
    expect(j.freshGain).toBeLessThan(0);
    expect(j.pass).toBe(false);
    expect(pairedGain(base, base).gain).toBe(0);
  });
});
