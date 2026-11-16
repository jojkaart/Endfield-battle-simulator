// A local search over rule lists (docs/design.md "Rule-based rotations", the rule search): from a hand-written list,
// small edits (add, remove or reorder a rule, change a cue or a threshold, add or drop a condition, toggle a battle
// skill that pre-empts a combo, change the opener or the filler), each scored by the sustained DPS the driver plays
// at the default reaction delay over a few seeds. Every list scored is kept; the result is the Pareto front of DPS
// against learnability (Learnability.complexity), for the owner to choose from, and the best by DPS less a small
// penalty per complexity point. A search heuristic, never part of a battle's result.

import { EngineError } from "./errors.ts";
import type { GameData } from "./model.ts";
import { learnability, playRules, POLICY_VISIBLE_BUFFS, POLICY_VISIBLE_STACKS, resolveRuleList, stepsOf, type Learnability, type PolicyCue, type PolicyOptions, type PolicyRule, type PolicyStep, type RuleList } from "./policy.ts";
import type { TimelineScenario } from "./timeline.ts";

export interface RuleSearchOptions {
  /** Lists scored at most (default 150). */
  readonly iterations?: number;
  /** Reaction-delay seeds each list is played with (1…k; default 2). */
  readonly seeds?: number;
  readonly reactionSeconds?: number;
  /** The searched fight's length (default the scenario's). */
  readonly durationFrames?: number;
  /** Seed of the edits' draws (default 1). */
  readonly seed?: number;
  /** The best list's score: DPS × (1 − penalty × complexity) (default 0.002: 0.2% a point). */
  readonly penalty?: number;
  /** Rules a list may have at most (default 12). */
  readonly maxRules?: number;
  /** Called after each list scored. */
  readonly progress?: (done: number, best: RuleScore) => void;
}

export const RULE_SEARCH_PENALTY = 0.002;

export interface RuleScore {
  readonly list: RuleList;
  /** Mean sustained DPS over the seeds (PolicyRun.sustainedDps). */
  readonly dps: number;
  readonly learn: Learnability;
  /** dps × (1 − penalty × complexity). */
  readonly score: number;
}

export interface RuleSearchResult {
  readonly start: RuleScore;
  /** The best by `score`. */
  readonly best: RuleScore;
  /** Lists no other beats on both DPS and complexity, by complexity. */
  readonly pareto: readonly RuleScore[];
  readonly evaluated: number;
}

/** The lists among `all` that no other has at least the DPS of with no more complexity (one beating it on one), by complexity. */
export function paretoFront(all: readonly RuleScore[]): RuleScore[] {
  const front = all.filter((x) => !all.some((y) => y !== x && y.dps >= x.dps && y.learn.complexity <= x.learn.complexity && (y.dps > x.dps || y.learn.complexity < x.learn.complexity)));
  // One per (complexity, DPS): equal lists scored the same keep the first.
  const seen = new Set<string>();
  return front.filter((x) => !seen.has(`${x.learn.complexity}:${x.dps}`) && (seen.add(`${x.learn.complexity}:${x.dps}`), true)).sort((a, b) => a.learn.complexity - b.learn.complexity);
}

/** A small seeded generator (mulberry32) for the edits. */
function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The cues and presses edits draw from, for a team (each operator's buttons; cues the UI shows; no timers). */
export interface Pool {
  readonly team: readonly string[];
  readonly controlled: string;
  readonly cues: readonly PolicyCue[];
  readonly steps: readonly PolicyStep[];
}

export function rulePool(data: GameData, team: readonly string[], controlled: string): Pool {
  const has = (op: string, kind: string) => (data.kits.operators[op]?.skills ?? []).some((s) => s.kind === kind && !s.followUpOnly);
  const cues: PolicyCue[] = [];
  const steps: PolicyStep[] = [];
  for (const op of team) {
    if (has(op, "combo")) cues.push({ combo: op }, { comboCooldown: op });
    if (has(op, "ultimate")) cues.push({ ultimate: op });
    for (const stack of POLICY_VISIBLE_STACKS[op] ?? []) {
      const max = data.kits.operators[op]?.stacks?.find((s) => s.id === stack)?.max ?? 1;
      for (const n of new Set([1, Math.ceil(max / 2), max])) cues.push({ stacks: { operator: op, stack, atLeast: n } });
    }
    for (const buff of POLICY_VISIBLE_BUFFS[op] ?? []) cues.push({ buff: { operator: op, buff } }, { not: { buff: { operator: op, buff } } });
    for (const cast of ["battle", "combo", "ultimate"] as const) if (has(op, cast)) steps.push({ operator: op, cast });
  }
  if (data.operators[controlled]?.dive?.end !== undefined) steps.push({ operator: controlled, cast: "dive" });
  steps.push({ operator: controlled, cast: "basic" });
  if ((data.kits.operators[controlled]?.skills ?? []).some((s) => s.kind === "basic" && data.skills[s.skillId]?.timing?.specification === 8)) steps.push({ operator: controlled, cast: "finisher" });
  for (const n of [100, 200, 300]) cues.push({ sp: { atLeast: n } });
  cues.push({ sp: { below: 100 } });
  for (const element of ["heat", "electric", "cryo", "nature"]) cues.push({ infliction: { element } });
  cues.push({ infliction: {} }, { not: { infliction: {} } });
  for (const status of ["solidification", "corrosion", "combustion", "electrification", "lift", "knockdown", "crush", "breach"]) cues.push({ status });
  cues.push({ vulnerable: { atLeast: 1 } }, { staggered: true }, { staggered: false }, { finalStrikes: { atLeast: 1 } }, { finalStrikes: { atLeast: 2 } });
  for (const n of [50, 70, 85]) cues.push({ stagger: { atLeast: n } });
  cues.push({ stagger: { below: 50 } });
  return { team, controlled, cues, steps };
}

const pick = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)] as T;

/** A new rule: mostly the natural ones (a lit combo cast, a ready ultimate cast, a lit combo pre-empted by a battle skill), else a random cue → a random press. */
function newRule(rng: () => number, pool: Pool): PolicyRule {
  const r = rng();
  if (r < 0.25) {
    const s = pick(rng, pool.steps.filter((x) => x.cast === "combo"));
    return { when: { combo: s.operator }, do: [s] };
  }
  if (r < 0.4) {
    const s = pick(rng, pool.steps.filter((x) => x.cast === "ultimate"));
    return { when: { ultimate: s.operator }, do: [s] };
  }
  if (r < 0.6) {
    const c = pick(rng, pool.steps.filter((x) => x.cast === "combo"));
    const b = pick(rng, pool.steps.filter((x) => x.cast === "battle"));
    return { when: { combo: c.operator }, do: [b, c] };
  }
  return { when: pick(rng, pool.cues), do: [pick(rng, pool.steps)] };
}

/** A threshold moved one step (SP by 50, stacks by 1), or null when the cue has none. */
function tweak(rng: () => number, c: PolicyCue): PolicyCue | null {
  const step = (x: number, by: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x + (rng() < 0.5 ? -by : by)));
  if ("sp" in c) return { sp: { ...(c.sp.atLeast !== undefined ? { atLeast: step(c.sp.atLeast, 50, 0, 300) } : {}), ...(c.sp.below !== undefined ? { below: step(c.sp.below, 50, 50, 300) } : {}) } };
  if ("stagger" in c) return { stagger: { ...(c.stagger.atLeast !== undefined ? { atLeast: step(c.stagger.atLeast, 10, 0, 100) } : {}), ...(c.stagger.below !== undefined ? { below: step(c.stagger.below, 10, 10, 100) } : {}) } };
  if ("stacks" in c) return { stacks: { ...c.stacks, ...(c.stacks.atLeast !== undefined ? { atLeast: step(c.stacks.atLeast, 1, 0, 8) } : {}), ...(c.stacks.below !== undefined ? { below: step(c.stacks.below, 1, 1, 9) } : {}) } };
  if ("finalStrikes" in c) return { finalStrikes: { atLeast: step(c.finalStrikes.atLeast, 1, 1, 4) } };
  if ("vulnerable" in c) return { vulnerable: { atLeast: step(c.vulnerable.atLeast ?? 1, 1, 1, 4) } };
  if ("not" in c) {
    const t = tweak(rng, c.not);
    return t ? { not: t } : null;
  }
  if ("all" in c) {
    const i = Math.floor(rng() * c.all.length);
    const t = tweak(rng, c.all[i] as PolicyCue);
    return t ? { all: c.all.map((x, j) => (j === i ? t : x)) } : null;
  }
  return null;
}

/** One random edit of a list (it may not be valid for the team: resolveRuleList judges). */
export function editRuleList(rng: () => number, pool: Pool, list: RuleList, maxRules: number): RuleList {
  const rules = [...list.rules];
  const at = () => Math.floor(rng() * rules.length);
  const kind = Math.floor(rng() * 11);
  switch (kind) {
    case 0:
      if (rules.length < maxRules) rules.splice(Math.floor(rng() * (rules.length + 1)), 0, newRule(rng, pool));
      break;
    case 1:
      if (rules.length > 1) rules.splice(at(), 1);
      break;
    case 2: {
      if (rules.length < 2) break;
      const i = Math.floor(rng() * (rules.length - 1));
      [rules[i], rules[i + 1]] = [rules[i + 1] as PolicyRule, rules[i] as PolicyRule];
      break;
    }
    case 3: {
      const i = at();
      if (rules[i]) rules[i] = { ...rules[i], when: pick(rng, pool.cues) };
      break;
    }
    case 4: {
      // Add a condition, or drop one.
      const i = at();
      const r = rules[i];
      if (!r) break;
      if ("all" in r.when && r.when.all.length > 1 && rng() < 0.5) {
        const j = Math.floor(rng() * r.when.all.length);
        const rest = r.when.all.filter((_, k) => k !== j);
        rules[i] = { ...r, when: rest.length === 1 ? (rest[0] as PolicyCue) : { all: rest } };
      } else rules[i] = { ...r, when: { all: [...("all" in r.when ? r.when.all : [r.when]), pick(rng, pool.cues)] } };
      break;
    }
    case 5: {
      const i = at();
      const r = rules[i];
      const t = r ? tweak(rng, r.when) : null;
      if (r && t) rules[i] = { ...r, when: t };
      break;
    }
    case 6: {
      // A battle skill that pre-empts a combo: add one, drop it, or change whose.
      const i = at();
      const r = rules[i];
      if (!r) break;
      const steps = stepsOf(r);
      const last = steps[steps.length - 1] as PolicyStep;
      const battles = pool.steps.filter((x) => x.cast === "battle");
      if (steps.length === 1) rules[i] = { ...r, do: [pick(rng, battles), last] };
      else if (rng() < 0.5) rules[i] = { ...r, do: [last] };
      else rules[i] = { ...r, do: [pick(rng, battles), ...steps.slice(1)] };
      break;
    }
    case 7: {
      // Another press for the rule's first.
      const i = at();
      const r = rules[i];
      if (r) rules[i] = { ...r, do: [pick(rng, pool.steps), ...stepsOf(r).slice(1)] };
      break;
    }
    case 8: {
      const i = at();
      const r = rules[i];
      if (r) rules[i] = { ...r, when: "not" in r.when ? r.when.not : { not: r.when } };
      break;
    }
    case 9: {
      const opener = [...list.opener];
      const x = rng();
      if (x < 0.4 && opener.length < 4) opener.splice(Math.floor(rng() * (opener.length + 1)), 0, pick(rng, pool.steps));
      else if (x < 0.7 && opener.length > 0) opener.splice(Math.floor(rng() * opener.length), 1);
      else if (opener.length > 0) opener[Math.floor(rng() * opener.length)] = pick(rng, pool.steps);
      return { ...list, opener, rules };
    }
    default:
      return { ...list, rules, filler: list.filler === "dive" ? "basic" : "dive" };
  }
  return { ...list, rules };
}

/** Local search over rule lists from `start` (docs/design.md "Rule-based rotations"). */
export function searchRules(data: GameData, scenario: Omit<TimelineScenario, "rotation">, start: RuleList, options: RuleSearchOptions = {}): RuleSearchResult {
  const team = scenario.team.map((b) => b.operator);
  const controlled = scenario.controlled ?? (team[0] as string);
  const pool = rulePool(data, team, controlled);
  const seeds = options.seeds ?? 2;
  const penalty = options.penalty ?? RULE_SEARCH_PENALTY;
  const maxRules = options.maxRules ?? 12;
  const iterations = options.iterations ?? 150;
  const rng = stream(options.seed ?? 1);
  const fight = { ...scenario, durationFrames: options.durationFrames ?? scenario.durationFrames };
  const play: PolicyOptions = { ...(options.reactionSeconds !== undefined ? { reactionSeconds: options.reactionSeconds } : {}) };
  const archive = new Map<string, RuleScore | null>();
  const score = (raw: RuleList): RuleScore | null => {
    let list: RuleList;
    try {
      list = resolveRuleList(data, team, raw);
    } catch (e) {
      if (e instanceof EngineError) return null;
      throw e;
    }
    const key = JSON.stringify(list);
    if (archive.has(key)) return archive.get(key) ?? null;
    let s: RuleScore | null = null;
    try {
      let sum = 0;
      for (let i = 1; i <= seeds; i++) sum += playRules(data, fight, list, { ...play, seed: i }).sustainedDps;
      const learn = learnability(list);
      const dps = sum / seeds;
      s = { list, dps, learn, score: dps * (1 - penalty * learn.complexity) };
    } catch (e) {
      // A list the team can't play (a press it has no button for) is no candidate.
      if (!(e instanceof EngineError)) throw e;
    }
    archive.set(key, s);
    return s;
  };
  const first = score(start);
  if (!first) throw new EngineError("the starting rule list can't be played by this team");
  let best = first;
  let evaluated = 1;
  options.progress?.(evaluated, best);
  for (let attempt = 0; evaluated < iterations && attempt < iterations * 20; attempt++) {
    const scored = [...archive.values()].filter((x): x is RuleScore => x !== null);
    const front = paretoFront(scored);
    // From the best mostly, else from anywhere on the front.
    const parent = rng() < 0.6 ? best : pick(rng, front);
    let child = editRuleList(rng, pool, parent.list, maxRules);
    if (rng() < 0.3) child = editRuleList(rng, pool, child, maxRules);
    const before = archive.size;
    const s = score(child);
    if (archive.size === before) continue;
    evaluated++;
    if (s && s.score > best.score) best = s;
    options.progress?.(evaluated, best);
  }
  const scored = [...archive.values()].filter((x): x is RuleScore => x !== null);
  return { start: first, best, pareto: paretoFront(scored), evaluated };
}
