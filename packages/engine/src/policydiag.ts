// What a rule list leaves on the table (docs/design.md "Rule-based rotations", diagnosis; the owner, 2026-11-16: find
// inefficiencies in how a team plays, then gear that fixes them). A rules run watched frame by frame (playRules'
// observer: it never changes the run) and its final state read: per operator ultimate energy gained (by source),
// spent, wasted at the cap and held at the end; time with the ultimate ready but not cast, and why; combos lit but
// unused; team SP at the cap; the uptime of what drives the main damage dealer (other operators' buffs on its hits,
// the enemy's statuses) and how much of its damage, and of its ultimate's, they cover; damage shares. Plus the
// distribution of sustained DPS over reaction-delay seeds and crits (policyDistribution).

import { attrTotal, kitSkill, panelAt } from "./timeline/context.ts";
import { advance, apply, buttonSkill, createContext, init, memoised, simulate, type RotationAction } from "./timeline.ts";
import { Attr } from "./attributes.ts";
import { activeAt, reaches } from "./buffs.ts";
import { EngineError } from "./errors.ts";
import type { GameData, OperatorKit } from "./model.ts";
import { allActions } from "./events.ts";
import { type DamageMoments, Z_95 } from "./moments.ts";
import { playRules, stepsOf, type PolicyFrameView, type PolicyOptions, type PolicyRun, type RuleList } from "./policy.ts";
import { SP } from "./timeline/rules.ts";
import { isStaggered, maxEnergy, spAt } from "./timeline/resources.ts";
import type { TimelineScenario, TimelineState } from "./timeline/state.ts";
import { FPS } from "./units.ts";

/** Seconds an operator's ultimate was ready but not cast, by why. */
export interface UltimateHeld {
  /** A rule that presses it saw its cue but was within its reaction delay. */
  readonly reaction: number;
  /** A rule that presses it had seen its cue, but another press came first or it couldn't start yet (priority, a skill still acting, a sequence playing). */
  readonly priority: number;
  /** The list has a rule that presses it, but that rule's cue didn't hold (held on purpose by its condition, or a later press of a sequence). */
  readonly condition: number;
  /** No rule of the list presses it. */
  readonly noRule: number;
}

export interface OperatorDiagnosis {
  readonly operator: string;
  /** Damage over the whole fight, and its share of the team's. */
  readonly damage: number;
  readonly share: number;
  /**
   * Ultimate energy: at the start, gained (after efficiency; by source: `sp` the team's natural SP spent, `hits` its
   * own hits, `kit:<trigger>` kit grants), spent, wasted at the cap, at the end. start + gained = spent + wasted + end.
   * `efficiency`: its Ultimate Gain Efficiency at the start (panel; buffs aside). `cost`: its ultimate's.
   */
  readonly energy: { readonly start: number; readonly gained: number; readonly bySource: Readonly<Record<string, number>>; readonly spent: number; readonly wasted: number; readonly end: number; readonly efficiency: number; readonly cost: number };
  /** Its ultimate (null without one): casts, per minute, seconds ready but not cast and why. */
  readonly ultimate: { readonly casts: number; readonly perMinute: number; readonly heldSeconds: number; readonly held: UltimateHeld } | null;
  /** Its combo (null without one): casts, per minute, seconds lit (window open, off cooldown) but not cast. */
  readonly combo: { readonly casts: number; readonly perMinute: number; readonly litSeconds: number } | null;
  /** Battle skills cast, per minute. */
  readonly battlePerMinute: number;
  /** Its damage by element, by kind of skill (basic, battle, combo, ultimate; `other`: statuses, reactions) and dealt while the enemy was Staggered. */
  readonly byElement: Readonly<Record<string, number>>;
  readonly byKind: Readonly<Record<string, number>>;
  readonly whileStaggered: number;
}

/** Another operator's buff on the main damage dealer's hits. */
export interface EffectDiagnosis {
  readonly owner: string;
  readonly id: string;
  readonly label: string;
  /** Fraction of the fight it was active on the main damage dealer. */
  readonly uptime: number;
  /** Fraction of the main damage dealer's damage whose hits it applied to. */
  readonly onMain: number;
  /** … of its ultimate's damage. */
  readonly onMainUltimate: number;
}

/** An enemy state (Vulnerable, an infliction, a status, Staggered). */
export interface EnemyDiagnosis {
  readonly label: string;
  readonly uptime: number;
  /** Fraction of the main damage dealer's damage landed while it held. */
  readonly onMain: number;
  readonly onMainUltimate: number;
}

export interface PolicyDiagnosis {
  readonly seconds: number;
  readonly operators: readonly OperatorDiagnosis[];
  /** Team SP: seconds at the cap (300), SP lost to it by regeneration and by grants. */
  readonly sp: { readonly atCapSeconds: number; readonly wastedRegen: number; readonly wastedGrants: number };
  /** The operator with the most damage. */
  readonly main: string;
  /** Other operators' buffs on its hits, most of its damage covered first. */
  readonly effects: readonly EffectDiagnosis[];
  readonly enemy: readonly EnemyDiagnosis[];
  /** The main damage dealer's ultimate casts. */
  readonly mainUltimates: number;
}

const ELEMENT_NAMES: Readonly<Record<string, string>> = { fire: "Heat", pulse: "Electric", cryst: "Cryo", natural: "Nature" };
const cap = (s: string) => `${s[0]?.toUpperCase() ?? ""}${s.slice(1)}`;

/** The enemy states a frame shows (labels). */
function enemyStates(st: TimelineState, frame: number): string[] {
  const out: string[] = [];
  const e = st.enemy;
  if (e.vulnerable && e.vulnerable.expiresAt > frame && e.vulnerable.stacks > 0) out.push("Vulnerable");
  if (e.infliction && e.infliction.expiresAt > frame && e.infliction.stacks > 0) out.push(`${ELEMENT_NAMES[e.infliction.element] ?? e.infliction.element} infliction`);
  for (const s of e.statuses) if (s.expiresAt > frame) out.push(cap(s.status));
  for (const s of e.physical) if (s.expiresAt > frame) out.push(cap(s.status));
  if (isStaggered(st, frame)) out.push("Staggered");
  return out;
}

/**
 * Plays the list once (playRules with these options) and diagnoses it. The run is the same as without the diagnosis.
 */
export function diagnoseRules(data: GameData, scenario: Omit<TimelineScenario, "rotation">, list: RuleList, options: PolicyOptions = {}): { readonly run: PolicyRun; readonly diagnosis: PolicyDiagnosis } {
  const team = scenario.team.map((b) => b.operator);
  const end = scenario.durationFrames;
  const frames = end + 1;
  const ultRules = new Map(team.map((op) => [op, list.rules.flatMap((r, i) => (stepsOf(r).some((s) => s.operator === op && s.cast === "ultimate") ? [{ i, first: stepsOf(r)[0]?.operator === op && stepsOf(r)[0]?.cast === "ultimate" }] : []))]));
  const held = new Map(team.map((op) => [op, { reaction: 0, priority: 0, condition: 0, noRule: 0 }]));
  const lit = new Map(team.map((op) => [op, 0]));
  const has = (op: string, kind: string) => (data.kits.operators[op]?.skills ?? []).some((s) => s.kind === kind && !s.followUpOnly);
  let atCap = 0;
  let wastedRegen = 0;
  // Per frame: buffs active (owner:id → frames, with whom they reach) and enemy states (label → frames).
  const buffFrames = new Map<string, { frames: Uint8Array; reached: Set<string> }>();
  const enemyFrames = new Map<string, Uint8Array>();
  let last: PolicyFrameView | null = null;
  const frame = (v: PolicyFrameView) => {
    last = v;
    const f = v.frame;
    for (const op of team) {
      if (has(op, "ultimate") && v.cueHolds({ ultimate: op })) {
        const h = held.get(op) as { reaction: number; priority: number; condition: number; noRule: number };
        const rules = ultRules.get(op) ?? [];
        const states = rules.map((r) => (r.first ? v.ruleState(r.i) : "off"));
        if (rules.length === 0) h.noRule++;
        else if (states.includes("seen")) h.priority++;
        else if (states.includes("waiting")) h.reaction++;
        else h.condition++;
      }
      if (has(op, "combo") && v.cueHolds({ combo: op })) lit.set(op, (lit.get(op) as number) + 1);
    }
    if (spAt(v.st, f) >= SP.max - 1e-9) {
      atCap++;
      if (f >= v.st.spPausedUntil) wastedRegen += SP.perSecond / FPS;
    }
    for (const b of v.st.buffs) {
      if (b.cast !== undefined || (b.modifiers.length === 0 && !b.attrs?.length) || !activeAt(b, f)) continue;
      const key = `${b.owner}:${b.id}`;
      let e = buffFrames.get(key);
      if (!e) buffFrames.set(key, (e = { frames: new Uint8Array(frames), reached: new Set() }));
      e.frames[f] = 1;
      for (const op of team) if (reaches(b, op)) e.reached.add(op);
    }
    for (const label of enemyStates(v.st, f)) {
      let e = enemyFrames.get(label);
      if (!e) enemyFrames.set(label, (e = new Uint8Array(frames)));
      e[f] = 1;
    }
  };
  const run = playRules(data, scenario, list, { ...options, observer: { frame } });
  const view = last as PolicyFrameView | null;
  if (!view) throw new EngineError("the run watched no frame");
  const { ctx, st } = view;
  const seconds = end / FPS;
  const minutes = seconds / 60;
  const kindOf = (op: string, skill: string) => {
    try {
      return kitSkill(ctx, op, skill).kind;
    } catch {
      return undefined;
    }
  };
  const casts = (op: string, kind: string) => st.casts.filter((c) => c.operator === op && !c.teammate && kindOf(op, c.skill) === kind).length;
  const totalDamage = Object.values(run.perOperator).reduce((a, b) => a + b, 0);
  const staggered = enemyFrames.get("Staggered");
  const split = new Map(team.map((op) => [op, { byElement: {} as Record<string, number>, byKind: {} as Record<string, number>, whileStaggered: 0 }]));
  for (const h of st.hits) {
    const e = split.get(h.operator);
    if (!e) continue;
    e.byElement[h.element] = (e.byElement[h.element] ?? 0) + h.exact;
    const kind = kindOf(h.operator, h.skillId) ?? "other";
    e.byKind[kind] = (e.byKind[kind] ?? 0) + h.exact;
    if (staggered?.[Math.min(end, Math.max(0, h.frame))]) e.whileStaggered += h.exact;
  }
  const operators: OperatorDiagnosis[] = team.map((op) => {
    const bySource = st.energyGained[op] ?? {};
    const gained = Object.values(bySource).reduce((a, b) => a + b, 0);
    const startEnergy = (() => {
      const v = scenario.startEnergy?.[op] ?? 0;
      return v === "full" ? maxEnergy(ctx, op) : Math.min(v, maxEnergy(ctx, op));
    })();
    const h = held.get(op) as UltimateHeld;
    const ultCasts = casts(op, "ultimate");
    const comboCasts = casts(op, "combo");
    return {
      operator: op,
      damage: run.perOperator[op] ?? 0,
      share: totalDamage > 0 ? (run.perOperator[op] ?? 0) / totalDamage : 0,
      energy: {
        start: startEnergy,
        gained,
        bySource,
        spent: st.energySpent[op] ?? 0,
        wasted: st.energyOverflow[op] ?? 0,
        end: st.energy[op] ?? 0,
        efficiency: attrTotal(ctx, panelAt(ctx, op, 0), Attr.UltimateSpGainScalar),
        cost: maxEnergy(ctx, op),
      },
      ultimate: has(op, "ultimate")
        ? { casts: ultCasts, perMinute: ultCasts / minutes, heldSeconds: (h.reaction + h.priority + h.condition + h.noRule) / FPS, held: { reaction: h.reaction / FPS, priority: h.priority / FPS, condition: h.condition / FPS, noRule: h.noRule / FPS } }
        : null,
      combo: has(op, "combo") ? { casts: comboCasts, perMinute: comboCasts / minutes, litSeconds: (lit.get(op) as number) / FPS } : null,
      battlePerMinute: casts(op, "battle") / minutes,
      ...(split.get(op) as { byElement: Record<string, number>; byKind: Record<string, number>; whileStaggered: number }),
    };
  });
  const main = [...operators].sort((a, b) => b.damage - a.damage)[0]?.operator as string;
  const mainHits = st.hits.filter((h) => h.operator === main);
  const mainTotal = mainHits.reduce((a, h) => a + h.exact, 0);
  const isUlt = (skill: string) => kindOf(main, skill) === "ultimate";
  const mainUltTotal = mainHits.filter((h) => isUlt(h.skillId)).reduce((a, h) => a + h.exact, 0);
  const on = new Map<string, { all: number; ult: number }>();
  for (const h of mainHits) {
    const keys = new Set(h.modifiers.filter((m) => m.kitBuff && m.kitBuff.owner !== main).map((m) => `${m.kitBuff?.owner}:${m.kitBuff?.id}`));
    for (const k of keys) {
      const e = on.get(k) ?? { all: 0, ult: 0 };
      e.all += h.exact;
      if (isUlt(h.skillId)) e.ult += h.exact;
      on.set(k, e);
    }
  }
  const frac = (x: number, of: number) => (of > 0 ? x / of : 0);
  const count = (a: Uint8Array) => a.reduce((s, x) => s + x, 0);
  const effects: EffectDiagnosis[] = [...on].map(([key, e]) => {
    const [owner, id] = key.split(":") as [string, string];
    const fr = buffFrames.get(key);
    return {
      owner,
      id,
      label: ctx.kits.get(owner)?.buffs.find((b) => b.id === id)?.label ?? id,
      uptime: fr && fr.reached.has(main) ? count(fr.frames) / frames : 0,
      onMain: frac(e.all, mainTotal),
      onMainUltimate: frac(e.ult, mainUltTotal),
    };
  }).sort((a, b) => b.onMain - a.onMain);
  const enemy: EnemyDiagnosis[] = [...enemyFrames].map(([label, fr]) => {
    let all = 0;
    let ult = 0;
    for (const h of mainHits) if (fr[Math.min(end, Math.max(0, h.frame))]) {
      all += h.exact;
      if (isUlt(h.skillId)) ult += h.exact;
    }
    return { label, uptime: count(fr) / frames, onMain: frac(all, mainTotal), onMainUltimate: frac(ult, mainUltTotal) };
  }).sort((a, b) => b.onMain - a.onMain);
  return {
    run,
    diagnosis: { seconds, operators, sp: { atCapSeconds: atCap / FPS, wastedRegen, wastedGrants: st.spOverflow }, main, effects, enemy, mainUltimates: casts(main, "ultimate") },
  };
}

const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Several runs' diagnoses averaged (the same team and list; seeds differ): numbers averaged, effects and states by key (absent: 0); the main damage dealer the most common. */
export function averageDiagnoses(list: readonly PolicyDiagnosis[]): PolicyDiagnosis {
  const first = list[0];
  if (!first) throw new EngineError("no diagnoses to average");
  const mainCount = new Map<string, number>();
  for (const d of list) mainCount.set(d.main, (mainCount.get(d.main) ?? 0) + 1);
  const main = [...mainCount].sort((a, b) => b[1] - a[1])[0]?.[0] as string;
  const sameMain = list.filter((d) => d.main === main);
  const operators = first.operators.map((o0, j) => {
    const os = list.map((d) => d.operators[j] as OperatorDiagnosis);
    const m = (f: (o: OperatorDiagnosis) => number) => avg(os.map(f));
    const sources = [...new Set(os.flatMap((o) => Object.keys(o.energy.bySource)))];
    return {
      operator: o0.operator,
      damage: m((o) => o.damage),
      share: m((o) => o.share),
      energy: {
        start: m((o) => o.energy.start),
        gained: m((o) => o.energy.gained),
        bySource: Object.fromEntries(sources.map((s) => [s, m((o) => o.energy.bySource[s] ?? 0)])),
        spent: m((o) => o.energy.spent),
        wasted: m((o) => o.energy.wasted),
        end: m((o) => o.energy.end),
        efficiency: m((o) => o.energy.efficiency),
        cost: o0.energy.cost,
      },
      ultimate: o0.ultimate
        ? {
            casts: m((o) => o.ultimate?.casts ?? 0),
            perMinute: m((o) => o.ultimate?.perMinute ?? 0),
            heldSeconds: m((o) => o.ultimate?.heldSeconds ?? 0),
            held: { reaction: m((o) => o.ultimate?.held.reaction ?? 0), priority: m((o) => o.ultimate?.held.priority ?? 0), condition: m((o) => o.ultimate?.held.condition ?? 0), noRule: m((o) => o.ultimate?.held.noRule ?? 0) },
          }
        : null,
      combo: o0.combo ? { casts: m((o) => o.combo?.casts ?? 0), perMinute: m((o) => o.combo?.perMinute ?? 0), litSeconds: m((o) => o.combo?.litSeconds ?? 0) } : null,
      battlePerMinute: m((o) => o.battlePerMinute),
      byElement: Object.fromEntries([...new Set(os.flatMap((o) => Object.keys(o.byElement)))].map((k) => [k, m((o) => o.byElement[k] ?? 0)])),
      byKind: Object.fromEntries([...new Set(os.flatMap((o) => Object.keys(o.byKind)))].map((k) => [k, m((o) => o.byKind[k] ?? 0)])),
      whileStaggered: m((o) => o.whileStaggered),
    };
  });
  const effectKeys = [...new Map(sameMain.flatMap((d) => d.effects.map((e) => [`${e.owner}:${e.id}`, e] as const))).values()];
  const effects = effectKeys.map((e0) => {
    const es = sameMain.map((d) => d.effects.find((e) => e.owner === e0.owner && e.id === e0.id));
    return { ...e0, uptime: avg(es.map((e) => e?.uptime ?? 0)), onMain: avg(es.map((e) => e?.onMain ?? 0)), onMainUltimate: avg(es.map((e) => e?.onMainUltimate ?? 0)) };
  }).sort((a, b) => b.onMain - a.onMain);
  const labels = [...new Set(sameMain.flatMap((d) => d.enemy.map((e) => e.label)))];
  const enemy = labels.map((label) => {
    const es = sameMain.map((d) => d.enemy.find((e) => e.label === label));
    return { label, uptime: avg(es.map((e) => e?.uptime ?? 0)), onMain: avg(es.map((e) => e?.onMain ?? 0)), onMainUltimate: avg(es.map((e) => e?.onMainUltimate ?? 0)) };
  }).sort((a, b) => b.onMain - a.onMain);
  return {
    seconds: first.seconds,
    operators,
    sp: { atCapSeconds: avg(list.map((d) => d.sp.atCapSeconds)), wastedRegen: avg(list.map((d) => d.sp.wastedRegen)), wastedGrants: avg(list.map((d) => d.sp.wastedGrants)) },
    main,
    effects,
    enemy,
    mainUltimates: avg(sameMain.map((d) => d.mainUltimates)),
  };
}

// --- Sustained DPS as a distribution over reaction delays and crits ------------------------------------

export interface SustainedDistribution {
  readonly mean: number;
  readonly sd: number;
  /** The spread from the reaction delays alone (sd of the runs' means) and from crits alone (√ of the runs' mean crit variance): sd² = delays² + crits² (law of total variance). */
  readonly sdDelays: number;
  readonly sdCrits: number;
  /** 5th and 95th percentiles of the mixture of each run's normal approximation. */
  readonly p5: number;
  readonly p95: number;
  readonly runs: number;
}

/** Φ, the standard normal CDF (Abramowitz–Stegun 7.1.26, error under 1.5e-7). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/**
 * Runs' sustained DPS distributions (PolicyRun.sustainedMoments: crits within a run) combined over the runs, each run
 * (a reaction-delay seed) equally likely: mean of means, variance E[σ²] + Var[μ] (law of total variance), and the
 * percentiles of the mixture of normals N(μᵢ, σᵢ²) by bisection.
 */
export function policyDistribution(runs: readonly DamageMoments[]): SustainedDistribution {
  const n = runs.length;
  if (n === 0) throw new EngineError("no runs");
  const mean = avg(runs.map((r) => r.mean));
  const delayVar = avg(runs.map((r) => (r.mean - mean) ** 2));
  const critVar = avg(runs.map((r) => Math.max(0, r.var)));
  const cdf = (x: number) => avg(runs.map((r) => {
    const sd = Math.sqrt(Math.max(0, r.var));
    return sd > 0 ? normalCdf((x - r.mean) / sd) : x >= r.mean ? 1 : 0;
  }));
  const spread = Math.sqrt(delayVar + critVar);
  const quantile = (p: number) => {
    let lo = Math.min(...runs.map((r) => r.mean)) - 10 * spread - 1;
    let hi = Math.max(...runs.map((r) => r.mean)) + 10 * spread + 1;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (cdf(mid) < p) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const p = normalCdf(-Z_95);
  return { mean, sd: spread, sdDelays: Math.sqrt(delayVar), sdCrits: Math.sqrt(critVar), p5: quantile(p), p95: quantile(1 - p), runs: n };
}

// --- Checks on a rules run (the architecture review's rule-run invariants, 2026-11-16) --------------------------------

/** What a rules run did that its list shouldn't make a player do, and whether `simulate` replays it. */
export interface RuleRunChecks {
  /** Presses of a battle, combo or ultimate button that cast another skill than the button showed then, or than the step's `shows`. */
  readonly wrongSkill: readonly { readonly frame: number; readonly operator: string; readonly skill: string; readonly shown: string | null; readonly shows?: string }[];
  /**
   * Presses of an operator's battle or combo button that ended a state its own ultimate gave it (a buff of its own from
   * the ultimate's cast) sooner than it would have ended without the press (Liino's End Stance in Cosmovoice: the class
   * of the bug the owner found on the damage graph, 2026-11-16).
   */
  readonly cutsOwnUltimate: readonly { readonly frame: number; readonly operator: string; readonly skill: string; readonly buff: string }[];
  /** `simulate` of the recorded rotation lands the same hits (count and total) as the run. */
  readonly replays: boolean;
}

/** How long after a press its effect on the presser's ultimate state is looked for. */
const CUT_HORIZON_FRAMES = 2 * FPS;

/**
 * Checks a rules run (playRules on this scenario and list): every press of a skill button cast what the button showed
 * (buttonSkill, judged on the replayed state at the press) and, with `shows`, that; no press of an operator's battle or
 * combo button cut a state of its own ultimate short (compared with the same rotation without that press, over the
 * next 2 s); `simulate` replays the rotation to the same hits.
 */
export function checkRuleRun(data: GameData, scenario: Omit<TimelineScenario, "rotation">, run: PolicyRun): RuleRunChecks {
  const fight: TimelineScenario = { ...scenario, rotation: run.rotation };
  const ctx = memoised(createContext(data, fight));
  const kindOf = (op: string, skill: string) => ctx.kits.get(op)?.skills.find((s) => s.skillId === skill)?.kind;
  const labelOf = (op: string, skill: string) => ctx.kits.get(op)?.skills.find((s) => s.skillId === skill)?.label ?? skill;
  const states: TimelineState[] = [];
  let st = init(ctx);
  const wrongSkill: RuleRunChecks["wrongSkill"][number][] = [];
  run.rotation.forEach((a, i) => {
    states.push(st);
    const at = a.at as number;
    const step = run.presses[i]?.step ?? null;
    const kind = kindOf(a.operator, a.skill);
    if (step && (step.cast === "battle" || step.cast === "combo" || step.cast === "ultimate")) {
      const shown = buttonSkill(ctx, at > st.frame ? advance(ctx, st, at) : st, a.operator, step.cast, at);
      if (shown !== a.skill || kind !== step.cast || (step.shows !== undefined && labelOf(a.operator, a.skill) !== step.shows)) {
        wrongSkill.push({ frame: at, operator: a.operator, skill: a.skill, shown, ...(step.shows !== undefined ? { shows: step.shows } : {}) });
      }
    }
    st = apply(ctx, st, a);
  });
  const end = advance(ctx, st, scenario.durationFrames);
  const replay = simulate(data, fight);
  const replays = replay.hits.length === end.hits.length && replay.total === run.total;
  // The presser's own ultimate state: its buffs applied since its last ultimate cast, within that cast's duration.
  const cutsOwnUltimate: RuleRunChecks["cutsOwnUltimate"][number][] = [];
  const replayTo = (from: TimelineState, skip: number, until: number): TimelineState => {
    let s = from;
    for (let j = skip + 1; j < run.rotation.length && (run.rotation[j]?.at as number) <= until; j++) {
      try {
        s = apply(ctx, s, run.rotation[j] as RotationAction);
      } catch (e) {
        if (!(e instanceof EngineError)) throw e;
        break;
      }
    }
    return advance(ctx, s, Math.max(s.frame, until));
  };
  run.rotation.forEach((a, i) => {
    const kind = kindOf(a.operator, a.skill);
    if (kind !== "battle" && kind !== "combo") return;
    const at = a.at as number;
    const before = advance(ctx, states[i] as TimelineState, at);
    const ult = before.casts.findLast((c) => c.operator === a.operator && kindOf(a.operator, c.skill) === "ultimate");
    if (!ult) return;
    const given = ultimateBuffs(ctx.kits.get(a.operator), ult.skill);
    const own = before.buffs.filter((b) => b.owner === a.operator && given.has(b.id) && b.cast === undefined && activeAt(b, at) && b.appliedAt >= ult.frame);
    if (own.length === 0) return;
    const h = Math.min(scenario.durationFrames, at + CUT_HORIZON_FRAMES);
    const withPress = replayTo(apply(ctx, states[i] as TimelineState, a), i, h);
    const without = replayTo(states[i] as TimelineState, i, h);
    const on = (s: TimelineState, id: string) => s.buffs.some((b) => b.id === id && b.owner === a.operator && b.cast === undefined && activeAt(b, h));
    for (const id of new Set(own.map((b) => b.id))) if (on(without, id) && !on(withPress, id)) cutsOwnUltimate.push({ frame: at, operator: a.operator, skill: a.skill, buff: id });
  });
  return { wrongSkill, cutsOwnUltimate, replays };
}

/**
 * The buffs an ultimate gives its own operator's side (self or team): those its hits apply, and those its kit's
 * triggers on its cast give (Liino's Cosmovoice, Laevatain's Twilight). Not enemy debuffs, Link stacks or what equipment gives.
 */
function ultimateBuffs(kit: OperatorKit | undefined, skill: string): ReadonlySet<string> {
  const out = new Set<string>();
  if (!kit) return out;
  for (const h of kit.skills.find((s) => s.skillId === skill)?.hits ?? []) for (const b of h.buffs ?? []) out.add(b.buff);
  for (const t of kit.triggers) {
    if (t.on.event !== "cast" || !(t.on.skills ?? []).includes(skill)) continue;
    for (const x of allActions(t.do)) if (x.kind === "buff") out.add(x.buff);
  }
  // A Link stack is there to be used by the next battle skill (Akekuri's Zone Link): using it isn't cutting it short.
  for (const id of [...out]) if (kit.buffs.find((b) => b.id === id)?.target === "enemy" || kit.buffs.find((b) => b.id === id)?.link) out.delete(id);
  return out;
}
