// Rule-based rotations (engine policy.ts, policysearch.ts; docs/design.md "Rule-based rotations"): the driver's
// semantics (opener, priority, reaction delay, pairs, cue reading), its rotation replaying with `simulate`, the
// learnability numbers, the rule search, and the example rule lists against their teams.
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import {
  advance,
  apply,
  buttonShows,
  buttonSkill,
  buttonSkills,
  createContext,
  cueCost,
  describeRule,
  earliestStart,
  init,
  learnability,
  playRules,
  SKILL_BUTTONS,
  visibleBuffs,
  visibleStacks,
  resolveRuleList,
  searchRules,
  simulate,
  type PolicyRule,
  type PolicyRun,
  type RotationAction,
  type RuleList,
  type TimelineScenario,
} from "@efsim/engine";
import { readScenario } from "@efsim/cli";
import { readRuleList } from "../packages/cli/src/rules.ts";

const data = loadGameData();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const owner = readScenario(join(ROOT, "examples/estella-si-akekuri-arcane.scenario.json"));
const AKEKURI = "chr_0019_karin";
const SI = "chr_0036_jsspsi";
const ESTELLA = "chr_0021_whiten";
const ARCANE = "chr_0032_lizhiyan";
const team = owner.team.map((b) => b.operator);
/** The owner's team over 20 s (its rotation isn't used). */
const fight = (seconds = 20, over: Partial<TimelineScenario> = {}): TimelineScenario => ({ ...owner, durationFrames: seconds * 30, rotation: [], ...over });
const list = (raw: RuleList) => resolveRuleList(data, team, raw);
const isBasic = (a: RotationAction) => data.kits.operators[a.operator]?.skills.find((s) => s.skillId === a.skill)?.kind === "basic";
const presses = (r: PolicyRun) => r.rotation.filter((a) => !isBasic(a));
const kindOf = (a: RotationAction) => data.kits.operators[a.operator]?.skills.find((s) => s.skillId === a.skill)?.kind;
const press = (op: string, kind: string) => (a: RotationAction) => a.operator === op && kindOf(a) === kind;
const must = <T,>(x: T | undefined): T => {
  if (x === undefined) throw new Error("expected a value");
  return x;
};
const at = (a: RotationAction | undefined): number => must(must(a).at);

describe("rule lists: format and learnability", () => {
  it("resolves operators by name and refuses what the UI doesn't show or the team lacks", () => {
    const l = list({ opener: [{ operator: "Si", cast: "battle" }], rules: [{ when: { combo: "arcane" }, do: { operator: "Estella", cast: "combo" } }] });
    expect(l.opener[0]?.operator).toBe(SI);
    expect(l.rules[0]?.when).toEqual({ combo: ARCANE });
    expect(() => list({ opener: [], rules: [{ when: { combo: "Laevatain" }, do: { operator: "Si", cast: "combo" } }] })).toThrow(/isn't an operator of the team/);
    expect(() => list({ opener: [], rules: [{ when: { stacks: { operator: "Arcane", stack: "cluster_strikes", atLeast: 1 } }, do: { operator: "Si", cast: "combo" } }] })).toThrow(/HUD/);
    expect(() => list({ opener: [], rules: [{ when: { buff: { operator: "Arcane", buff: "gloompurge_arcana" } }, do: { operator: "Si", cast: "combo" } }] })).toThrow(/buff icons/);
    expect(() => list({ opener: [], rules: [{ when: { combo: "Si" }, do: [] }] })).toThrow(/1 to 3/);
    // A dive, basic attack or finisher is the controlled operator's.
    expect(() => playRules(data, fight(), list({ opener: [{ operator: "Si", cast: "dive" }], rules: [] }))).toThrow(/controlled operator/);
  });

  it("costs cues by the owner's ranking and sums a list's complexity", () => {
    expect(cueCost({ combo: SI })).toEqual({ cost: 1, rank: 1 });
    expect(cueCost({ sp: { atLeast: 100 } })).toEqual({ cost: 2, rank: 2 });
    expect(cueCost({ status: "solidification" })).toEqual({ cost: 3, rank: 3 });
    expect(cueCost({ ultimate: SI })).toEqual({ cost: 5, rank: 4 });
    expect(cueCost({ finalStrikes: { atLeast: 2 } })).toEqual({ cost: 6, rank: 5 });
    expect(cueCost({ comboCooldown: SI })).toEqual({ cost: 7, rank: 6 });
    expect(cueCost({ since: { operator: SI, cast: "battle", atLeast: 10 } })).toEqual({ cost: 20, rank: 7 });
    expect(cueCost({ all: [{ combo: SI }, { not: { sp: { atLeast: 100 } } }] })).toEqual({ cost: 3, rank: 2 });
    const l = list({
      opener: [{ operator: "Si", cast: "battle" }],
      rules: [
        { when: { ultimate: "Si" }, do: { operator: "Si", cast: "ultimate" } },
        { when: { combo: "Arcane" }, do: [{ operator: "Estella", cast: "battle" }, { operator: "Arcane", cast: "combo" }] },
      ],
    });
    expect(learnability(l)).toEqual({ openerSteps: 1, rules: 2, ruleSteps: 3, cueCost: 6, hardestRank: 4, complexity: 10 });
    expect(describeRule(data, l.rules[1] as PolicyRule)).toBe("When Arcane's combo lights up: Estella's battle skill, then Arcane's combo");
  });
});

describe("the rule driver", () => {
  it("plays the opener first, in order, each press as soon as it can start; no rule before it's over", () => {
    const r = playRules(data, fight(), list({ opener: [{ operator: "Si", cast: "battle" }, { operator: "Estella", cast: "battle" }], rules: [{ when: { sp: { atLeast: 0 } }, do: { operator: "Akekuri", cast: "battle" } }] }), { reactionSeconds: 0 });
    const p = presses(r);
    expect(press(SI, "battle")(must(p[0]))).toBe(true);
    expect(press(ESTELLA, "battle")(must(p[1]))).toBe(true);
    expect(r.openerEnd).toBe(at(p[1]));
    const firstRule = p.find(press(AKEKURI, "battle"));
    expect(firstRule).toBeDefined();
    expect(at(firstRule)).toBeGreaterThanOrEqual(r.openerEnd);
    expect(r.fired[0]).toBeGreaterThan(0);
  });

  it("waits its reaction delay after a cue's onset (seeded jitter; 0: at once)", () => {
    const rules = list({ opener: [], rules: [{ when: { ultimate: "Akekuri" }, do: { operator: "Akekuri", cast: "ultimate" } }] });
    const first = (o: Parameters<typeof playRules>[3]) => presses(playRules(data, fight(5), rules, o)).find(press(AKEKURI, "ultimate"))?.at as number;
    const bot = first({ reactionSeconds: 0 });
    expect(bot).toBe(0);
    expect(first({ reactionSeconds: 0.3, jitter: 0 })).toBe(bot + 9);
    expect(first({ reactionSeconds: 1, jitter: 0 })).toBe(bot + 30);
    const jittered = first({ reactionSeconds: 0.3, seed: 7 });
    expect(jittered).toBeGreaterThanOrEqual(bot + 4);
    expect(jittered).toBeLessThanOrEqual(bot + 14);
    expect(first({ reactionSeconds: 0.3, seed: 7 })).toBe(jittered);
  });

  it("fires the first rule whose cue holds; one whose press can't start doesn't block the next", () => {
    const a = { when: { sp: { atLeast: 100 } }, do: { operator: "Si", cast: "battle" as const } };
    const b = { when: { sp: { atLeast: 100 } }, do: { operator: "Akekuri", cast: "battle" as const } };
    expect(press(SI, "battle")(presses(playRules(data, fight(3), list({ opener: [], rules: [a, b] }), { reactionSeconds: 0 }))[0] as RotationAction)).toBe(true);
    expect(press(AKEKURI, "battle")(presses(playRules(data, fight(3), list({ opener: [], rules: [b, a] }), { reactionSeconds: 0 }))[0] as RotationAction)).toBe(true);
    // From zero energy Si's ultimate can't start: its rule (cue: SP ≥ 0, always) is passed over.
    const blocked = { when: { sp: { atLeast: 0 } }, do: { operator: "Si", cast: "ultimate" as const } };
    const r = playRules(data, fight(3, { startEnergy: {} }), list({ opener: [], rules: [blocked, b] }), { reactionSeconds: 0 });
    expect(presses(r)[0]).toMatchObject({ operator: AKEKURI, at: 0 });
    expect(r.fired[0]).toBe(0);
  });

  it("plays a rule's pair in order: the later press as soon as it can start, no other rule in between", () => {
    const r = playRules(
      data,
      fight(),
      list({
        opener: [],
        rules: [
          { when: { sp: { atLeast: 100 } }, do: [{ operator: "Si", cast: "battle" }, { operator: "Arcane", cast: "combo" }] },
          { when: { sp: { atLeast: 100 } }, do: { operator: "Akekuri", cast: "battle" } },
        ],
      }),
      { reactionSeconds: 0 },
    );
    const p = presses(r);
    expect(press(SI, "battle")(must(p[0]))).toBe(true);
    expect(press(ARCANE, "combo")(must(p[1]))).toBe(true);
    expect(at(p[1])).toBeGreaterThan(at(p[0]));
    // The combo starts at the earliest frame it could, from the state after everything pressed before it.
    const ctx = createContext(data, fight());
    let st = init(ctx);
    const i = r.rotation.indexOf(must(p[1]));
    for (const a of r.rotation.slice(0, i)) st = apply(ctx, st, a);
    expect(earliestStart(ctx, st, { operator: ARCANE, skill: must(p[1]).skill })).toEqual({ frame: at(p[1]) });
  });

  it("reads a combo lighting up: the bot casts it at the first frame it can", () => {
    const r = playRules(data, fight(), list({ opener: [{ operator: "Si", cast: "battle" }], rules: [{ when: { combo: "Arcane" }, do: { operator: "Arcane", cast: "combo" } }] }), { reactionSeconds: 0 });
    const combo = r.rotation.find(press(ARCANE, "combo"));
    expect(combo).toBeDefined();
    const ctx = createContext(data, fight());
    let st = init(ctx);
    for (const a of r.rotation.slice(0, r.rotation.indexOf(must(combo)))) st = apply(ctx, st, a);
    expect(earliestStart(ctx, st, { operator: ARCANE, skill: must(combo).skill })).toEqual({ frame: at(combo) });
  });

  it("counts the controlled operator's Final Strikes since a rule last fired", () => {
    const r = playRules(data, fight(), list({ opener: [], rules: [{ when: { finalStrikes: { atLeast: 1 } }, do: { operator: "Akekuri", cast: "battle" } }] }), { reactionSeconds: 0 });
    const strikes = r.rotation.filter((a) => a.skill === `${ESTELLA}_attack4`);
    const casts = r.rotation.filter(press(AKEKURI, "battle"));
    expect(casts.length).toBeGreaterThan(0);
    // Each cast after a Final Strike since the one before.
    let last = -1;
    for (const c of casts) {
      expect(strikes.some((s) => at(s) > last && at(s) <= at(c))).toBe(true);
      last = at(c);
    }
  });

  it("records a rotation that `simulate` replays to the same hits; judging every frame changes nothing", () => {
    const sc = fight(30, { options: { ...owner.options, crit: "rolled", seed: 3 } });
    const l = readRuleList(join(ROOT, "examples/estella-si-akekuri-arcane.rules.json"));
    const r = playRules(data, sc, list(l), { seed: 2 });
    const replay = simulate(data, { ...sc, rotation: r.rotation });
    expect(replay.total).toBe(r.total);
    const exact = playRules(data, sc, list(l), { seed: 2, judgeEveryFrame: true });
    expect(exact.rotation).toEqual(r.rotation);
    expect(r.byMinute.reduce((a, b) => a + b, 0)).toBeCloseTo(r.total, 3);
  });
});

describe("the rule driver with hovers and dives (Typhoeus)", () => {
  it("presses only where the replay starts them (earliestStart from the last press, with the frame as `at`)", () => {
    const sc = readScenario(join(ROOT, "examples/typhoeus-arcane-liino-perlica.scenario.json"));
    const grounded = { not: { buff: { operator: "Typhoeus", buff: "hovering" } } };
    const l = resolveRuleList(data, sc.team.map((b) => b.operator), {
      opener: [{ operator: "Typhoeus", cast: "battle" }],
      rules: [
        { when: { combo: "Typhoeus" }, do: { operator: "Typhoeus", cast: "combo" } },
        { when: { combo: "Perlica" }, do: { operator: "Perlica", cast: "combo" } },
        { when: grounded, do: { operator: "Typhoeus", cast: "battle" } },
        { when: grounded, do: { operator: "Typhoeus", cast: "dive" } },
      ],
    });
    const fight60 = { ...sc, durationFrames: 60 * 30 };
    const r = playRules(data, fight60, l, { seed: 1 });
    expect(r.rotation.some((a) => a.skill === "chr_0034_typhoea_plunging_attack_end")).toBe(true);
    expect(r.rotation.some((a) => a.skill.startsWith("chr_0034_typhoea_floating_attack"))).toBe(true);
    const ctx = createContext(data, { ...fight60, rotation: r.rotation });
    let st = init(ctx);
    for (const a of r.rotation) {
      expect(earliestStart(ctx, st, a)).toEqual({ frame: a.at });
      st = apply(ctx, st, a);
    }
    expect(simulate(data, { ...fight60, rotation: r.rotation }).total).toBe(r.total);
  });
});

describe("the rule search", () => {
  it("scores edits of the start, keeps a Pareto front, and is deterministic", () => {
    const start = list({ opener: [], rules: [{ when: { combo: "Si" }, do: { operator: "Si", cast: "combo" } }, { when: { sp: { atLeast: 100 } }, do: { operator: "Si", cast: "battle" } }] });
    const sc = fight(15);
    const a = searchRules(data, sc, start, { iterations: 4, seeds: 1, seed: 5 });
    expect(a.evaluated).toBeLessThanOrEqual(4);
    expect(a.best.score).toBeGreaterThanOrEqual(a.start.score);
    expect(a.pareto.length).toBeGreaterThan(0);
    for (const x of a.pareto) expect(a.pareto.some((y) => y !== x && y.dps >= x.dps && y.learn.complexity <= x.learn.complexity && (y.dps > x.dps || y.learn.complexity < x.learn.complexity))).toBe(false);
    const b = searchRules(data, sc, start, { iterations: 4, seeds: 1, seed: 5 });
    expect(b.pareto.map((x) => JSON.stringify(x.list))).toEqual(a.pareto.map((x) => JSON.stringify(x.list)));
  });
});

describe("a press that names what its button shows", () => {
  const sc = readScenario(join(ROOT, "examples/typhoeus-arcane-liino-perlica.scenario.json"));
  const ops = sc.team.map((b) => b.operator);
  const LIINO = "chr_0035_liino";
  const notInStance = { all: [{ not: { buff: { operator: "Liino", buff: "vocalist_stance" } } }, { not: { buff: { operator: "Liino", buff: "cosmovoice_amp" } } }] };
  const run = (shows: boolean) =>
    playRules(data, { ...sc, durationFrames: 40 * 30 }, resolveRuleList(data, ops, {
      opener: [{ operator: "Liino", cast: "battle" }],
      rules: [
        { when: { ultimate: "Liino" }, do: { operator: "Liino", cast: "ultimate" } },
        { when: { not: { buff: { operator: "Liino", buff: "vocalist_stance" } } }, do: [{ operator: "Arcane", cast: "battle" }, shows ? { operator: "Liino", cast: "battle", shows: "Battle skill" } : { operator: "Liino", cast: "battle" }] },
      ],
    }), { seed: 1 });
  it("without it, a queued press of Liino's battle-skill button can land on End Stance (the button changed under it)", () => {
    expect(run(false).rotation.some((a) => a.operator === LIINO && a.skill === "chr_0035_liino_normal_skill_end")).toBe(true);
  });
  it("with it, the press is given up instead, never End Stance", () => {
    const r = run(true);
    expect(r.rotation.some((a) => a.operator === LIINO && a.skill === "chr_0035_liino_normal_skill_end")).toBe(false);
    expect(r.givenUp.some((g) => g.step.operator === LIINO && g.step.shows === "Battle skill")).toBe(true);
  });
  it("a label the button never shows is refused; the cue for her ultimate's stance resolves and reads in words", () => {
    expect(() => resolveRuleList(data, ops, { opener: [], rules: [{ when: { combo: "Liino" }, do: { operator: "Liino", cast: "battle", shows: "Nope" } }] })).toThrow(/never shows/);
    const l = resolveRuleList(data, ops, { opener: [], rules: [{ when: notInStance, do: { operator: "Liino", cast: "battle", shows: "Battle skill" } }] });
    expect(describeRule(data, l.rules[0] as PolicyRule)).toBe("When Liino isn't in Vocalist Stance and Liino isn't in Cosmovoice: Liino's battle skill (only if it shows Battle skill)");
  });
});

describe("the Stagger bar cue", () => {
  it("reads how full the bar is (100 while Staggered), resolves, and reads in words", () => {
    const l = list({ opener: [], rules: [{ when: { stagger: { atLeast: 70 } }, do: { operator: "Si", cast: "battle" } }] });
    expect(describeRule(data, l.rules[0] as PolicyRule)).toBe("When the enemy's Stagger bar is at least 70% full: Si's battle skill");
    expect(() => list({ opener: [], rules: [{ when: { stagger: { atLeast: 120 } }, do: { operator: "Si", cast: "battle" } }] })).toThrow(/0 to 100/);
    expect(cueCost({ stagger: { atLeast: 70 } })).toEqual({ cost: 3, rank: 3 });
    // A rule that fires only near the Stagger presses later than the same rule without the condition.
    const at = (when: PolicyRule["when"]) => playRules(data, fight(60), list({ opener: [], rules: [{ when, do: { operator: "Arcane", cast: "battle" } }] }), { reactionSeconds: 0 }).rotation.find((a) => a.operator === ARCANE)?.at ?? Infinity;
    expect(at({ stagger: { atLeast: 1 } })).toBeGreaterThan(at({ sp: { atLeast: 0 } }));
  });
});

describe("example rule lists", () => {
  const files = readdirSync(join(ROOT, "examples")).filter((f) => f.endsWith(".rules.json"));
  it("there are some", () => expect(files.length).toBeGreaterThan(0));
  it.each(files)("%s validates and resolves against its team", (f) => {
    const sc = readScenario(join(ROOT, "examples", f.replace(/\.rules\.json$/, ".scenario.json")));
    const l = resolveRuleList(data, sc.team.map((b) => b.operator), readRuleList(join(ROOT, "examples", f)));
    expect(l.rules.length).toBeGreaterThan(0);
    const r = playRules(data, { ...sc, durationFrames: 10 * 30 }, l);
    expect(r.total).toBeGreaterThan(0);
  });
});

// --- Phase 2 of the architecture review (2026-11-16): the button model, one start check, event stepping, run checks ---

const EXAMPLE_TEAMS = ["estella-si-akekuri-arcane", "ink-melt", "typhoeus-arcane-liino-perlica"] as const;
const example = (t: string, zero = false) => {
  const sc = readScenario(join(ROOT, "examples", `${t}${zero ? "-zero" : ""}.scenario.json`));
  return { sc, list: resolveRuleList(data, sc.team.map((b) => b.operator), readRuleList(join(ROOT, "examples", `${t}.rules.json`))) };
};

describe("the skill buttons (engine buttons.ts)", () => {
  it.each(EXAMPLE_TEAMS)("%s: at every frame of a rules run, each button shows at most one skill", (t) => {
    const { sc, list: l } = example(t);
    const ambiguous = new Set<string>();
    playRules(data, { ...sc, durationFrames: 60 * 30 }, l, {
      seed: 1,
      observer: {
        frame: (v) => {
          for (const b of sc.team) for (const k of SKILL_BUTTONS) {
            const shows = buttonShows(v.ctx, v.st, b.operator, k, v.frame);
            if (shows.length > 1) ambiguous.add(`${b.operator} ${k}: ${shows.join(", ")}`);
          }
        },
      },
    });
    expect([...ambiguous]).toEqual([]);
  });
  it("a button casts what its kit's conditions say: Si's battle button is Artful Intent, then Initial Stroke while it's up", () => {
    const ctx = createContext(data, fight(20));
    let st = init(ctx);
    expect(buttonSkill(ctx, st, SI, "battle", 0)).toBe("chr_0036_jsspsi_normal_skill");
    st = apply(ctx, st, { operator: SI, skill: "chr_0036_jsspsi_normal_skill" });
    const later = advance(ctx, st, st.frame + 60);
    expect(buttonSkill(ctx, later, SI, "battle", later.frame)).toBe("chr_0036_jsspsi_normal_skill_1");
    expect(buttonSkills(ctx, SI, "battle").map((s) => s.label)).toEqual(["Battle skill (Artful Intent)", "Initial Stroke", "Final Stroke"]);
  });
});

describe("visible states come from the kits", () => {
  it("a kit buff or stack marked visible is a cue, in its kit's words; others are refused", () => {
    const { sc } = example("typhoeus-arcane-liino-perlica");
    const ops = sc.team.map((b) => b.operator);
    expect(visibleBuffs(data, "chr_0034_typhoea")).toEqual(["hovering"]);
    expect(visibleStacks(data, "chr_0034_typhoea")).toEqual(["signs", "arrows"]);
    expect(visibleBuffs(data, "chr_0035_liino")).toEqual(["vocalist_stance", "cosmovoice_amp"]);
    const l = resolveRuleList(data, ops, { opener: [], rules: [{ when: { not: { buff: { operator: "Typhoeus", buff: "hovering" } } }, do: { operator: "Typhoeus", cast: "battle" } }] });
    expect(describeRule(data, l.rules[0] as PolicyRule)).toBe("When Typhoeus is on the ground: Typhoeus's battle skill");
    expect(() => resolveRuleList(data, ops, { opener: [], rules: [{ when: { buff: { operator: "Typhoeus", buff: "hovering_atk" } }, do: { operator: "Typhoeus", cast: "battle" } }] })).toThrow(/isn't a state the game shows/);
    expect(() => resolveRuleList(data, ops, { opener: [], rules: [{ when: { stacks: { operator: "Typhoeus", stack: "abatk", atLeast: 1 } }, do: { operator: "Typhoeus", cast: "battle" } }] })).toThrow(/isn't a stack the HUD shows/);
  });
});
