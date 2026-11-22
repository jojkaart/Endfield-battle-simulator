// efsim rules: play a rule-based rotation (engine policy.ts) over a long fight and report its sustained DPS, spread,
// robustness to the reaction delay, which rules fired and how learnable it is; --search improves it (policysearch.ts).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  EngineError,
  FPS,
  withSeconds,
  POLICY_CUE_RANKS,
  POLICY_JITTER,
  POLICY_REACTION_SECONDS,
  RULE_SEARCH_PENALTY,
  critTriggers,
  cueCost,
  describeCue,
  describeRule,
  distributionCritMode,
  describeStep,
  learnability,
  policyDistribution,
  resolveRuleList,
  searchRules,
  simulate,
  startsObjective,
  type GameData,
  type Learnability,
  type PolicyRun,
  type RuleList,
  type RuleScore,
  type SustainedDistribution,
  type TimelineScenario,
} from "@efsim/engine";
import { num, pct, signedPct, table } from "./format.ts";
import { alternatives, gainText, holds, underAssume, verdict } from "./assume.ts";
import { paired } from "./diagnose.ts";
import { defaultWorkers, runRulesJobs, type RulesJob, type RulesResult } from "./rulespool.ts";
import { codeProvenance } from "./provenance.ts";

const verdictWords = (m: { readonly gain: number; readonly se: number }) => ({ gain: "a gain beyond twice its standard error", loss: "a loss beyond twice its standard error", noise: "within the noise" })[verdict(m)];
const describeLearn = (l: Learnability) => `complexity ${l.complexity}`;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** A rule list file, checked against schemas/rules.schema.json (operators still by ID or name: resolveRuleList). */
export function readRuleList(file: string): RuleList {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(JSON.parse(readFileSync(join(ROOT, "schemas", "rules.schema.json"), "utf8")) as object);
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!validate(raw)) throw new Error(`${file}: ${ajv.errorsText(validate.errors)}`);
  return raw as RuleList;
}

export interface RulesOptions {
  /** Fight length in seconds (default 300). */
  readonly seconds?: number;
  readonly reactionSeconds?: number;
  /** Reaction-delay seeds (1…k; default 5). */
  readonly seeds?: number;
  readonly search?: boolean;
  readonly iterations?: number;
  readonly searchSeconds?: number;
  readonly searchSeeds?: number;
  readonly penalty?: number;
  /** Lists of the search's Pareto front scored again over the whole fight (default 8). */
  readonly front?: number;
  readonly out?: string;
  /** Another list to compare with: the paired gain ± standard error on the usual seeds and on fresh ones. */
  readonly compare?: { readonly list: RuleList; readonly file: string };
  /** The first reaction-delay seed of the report (default 1; 1001: fresh seeds, never the ones a list was judged on). */
  readonly firstSeed?: number;
  /** Fresh seeds (1001…) of the comparison (default 32; 0: none). */
  readonly fresh?: number;
  /**
   * A second start of the fight (the team's zero-energy companion): the comparison is also played there, and its
   * verdict is the objective across starts (the mean of the two starts' sustained DPS per seed: docs/design/rules.md
   * "The objective across starts"), with each start's own gain beside it.
   */
  readonly also?: { readonly scenario: TimelineScenario; readonly label: string };
  /** Whether the result holds under each other reading of the team's kits' open assumptions (assume.ts). */
  readonly assumptions?: boolean;
  /** Worker threads (default: cores less one; 1: none). */
  readonly workers?: number;
  readonly progress?: (line: string) => void;
}

export const RULES_SECONDS = 300;
/** Fresh seeds of a comparison: 1001… (never the seeds a list was found or judged on). */
export const FRESH_SEED = 1001;

/** One run's numbers for the report (the first seed's: fired counts, per minute, given up, shares). */
interface EvalRun {
  readonly fired: readonly number[];
  readonly perOperator: Readonly<Record<string, number>>;
  readonly total: number;
  readonly byMinute: readonly number[];
  readonly givenUp: PolicyRun["givenUp"];
  readonly openerEnd: number;
  readonly durationFrames: number;
}

interface Evaluation {
  readonly list: RuleList;
  readonly learn: Learnability;
  /** The first reaction-delay seed (RulesOptions.firstSeed). */
  readonly firstSeed: number;
  /** Seed 1 at the default delay, expected crits: fired counts, per minute, the reference comparison. */
  readonly run: EvalRun;
  /** Sustained DPS per seed at the default delay (expected crits). */
  readonly dps: readonly number[];
  /**
   * Sustained DPS as a distribution over the seeds' delays and each hit's crit (policyDistribution: the runs' crit
   * spread from each hit's chance, combined by the law of total variance; with crit-triggered effects in the team the
   * crits they read are rolled, seeded with the delay's seed).
   */
  readonly distribution: SustainedDistribution;
  readonly critNote?: string;
  /** Mean sustained DPS at delay 0 (one run: no jitter), the default (dps) and twice it. */
  readonly robust: { readonly bot: number; readonly normal: number; readonly slow: number };
  readonly first60: readonly number[];
  readonly totals: readonly number[];
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: readonly number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
};

/** The list's runs on seeds first…first + n − 1 at the delay (the battle's crit mode as `efsim rules` plays it). */
function seedRuns(data: GameData, scenario: TimelineScenario, list: RuleList, reaction: number, seeds: number, first = 1, detailFirst = false): RulesJob[] {
  const crit = distributionCritMode(data, scenario);
  return Array.from({ length: seeds }, (_, i) => ({
    scenario: { ...scenario, options: { ...scenario.options, crit, seed: first + i } },
    list,
    options: { reactionSeconds: reaction, seed: first + i },
    ...(detailFirst && i === 0 ? { detail: true } : {}),
  }));
}

async function evaluate(data: GameData, scenario: TimelineScenario, list: RuleList, reaction: number, seeds: number, workers: number, firstSeed = 1): Promise<Evaluation> {
  const crit = distributionCritMode(data, scenario);
  const triggers = crit === "distribution" ? critTriggers(data, scenario) : [];
  const jobs: RulesJob[] = [
    ...seedRuns(data, scenario, list, reaction, seeds, firstSeed, true),
    { scenario, list, options: { reactionSeconds: 0 } },
    ...Array.from({ length: seeds }, (_, i): RulesJob => ({ scenario, list, options: { reactionSeconds: reaction * 2, seed: firstSeed + i } })),
  ];
  const res = await runRulesJobs(data, jobs, workers);
  const runs = res.slice(0, seeds);
  const first = runs[0] as RulesResult;
  const dps = runs.map((r) => r.sustainedDps);
  return {
    list,
    learn: learnability(list),
    firstSeed,
    run: { fired: first.fired, perOperator: first.perOperator, total: first.total, ...(first.detail as NonNullable<RulesResult["detail"]>) },
    dps,
    distribution: policyDistribution(runs.map((r) => r.moments)),
    ...(triggers.length ? { critNote: `crit-triggered effects (${triggers.join(", ")}): the crits they read are rolled, seeded with the delay's seed` } : {}),
    robust: { bot: (res[seeds] as RulesResult).sustainedDps, normal: mean(dps), slow: mean(res.slice(seeds + 1).map((r) => r.sustainedDps)) },
    first60: runs.map((r) => r.first60),
    totals: runs.map((r) => r.total),
  };
}

const n0 = (x: number) => num(Math.round(x), 0);
const RANK_WORDS: Readonly<Record<number, string>> = { 0: "none", 1: "a combo lighting up", 2: "SP or Typhoeus's arrows / Signs", 3: "the enemy's statuses or an operator's visible state", 4: "an ultimate ready (or how many are)", 5: "counting Final Strikes or reading an ultimate's gauge", 6: "a combo's cooldown", 7: "a timer in the head" };

/** The list in the player's words: opener, numbered rules (with their cue cost), filler. */
export function describeRuleList(data: GameData, list: RuleList, fired?: readonly number[]): string[] {
  const lines = [`Opener: ${list.opener.length ? list.opener.map((s) => describeStep(data, s)).join(", then ") : "none"}`];
  for (const s of list.sets ?? []) lines.push(`Set ${s.name}: its rules are read only while ${describeCue(data, s.when)} [cue cost ${cueCost(s.when).cost}, once]`);
  list.rules.forEach((r, i) => {
    const c = cueCost(r.when);
    lines.push(`  ${i + 1}. ${describeRule(data, r, list.sets)}  [cue cost ${c.cost}${fired ? `; fired ${fired[i]}×` : ""}]`);
  });
  lines.push(`Otherwise: ${list.filler === "dive" ? "dive (jump attacks)" : "basic attacks"} with the controlled operator.`);
  return lines;
}

function learnLine(l: Learnability): string {
  return `opener ${l.openerSteps} press${l.openerSteps === 1 ? "" : "es"}, ${l.rules} rules (${l.ruleSteps} presses), cue cost ${l.cueCost} (hardest: rank ${l.hardestRank}, ${RANK_WORDS[l.hardestRank]}), complexity ${l.complexity}`;
}

function formatEvaluation(data: GameData, e: Evaluation, reaction: number, reference: { total: number; seconds: number } | null): string[] {
  const seeds = e.dps.length;
  const lines: string[] = [];
  lines.push(`Learnability: ${learnLine(e.learn)}`);
  lines.push(...describeRuleList(data, e.list, e.run.fired));
  lines.push("");
  lines.push(`Sustained DPS after the opener (expected crits, ${seeds} seed${seeds === 1 ? "" : "s"} of the reaction delay${e.firstSeed === 1 ? "" : `, ${e.firstSeed}–${e.firstSeed + seeds - 1}`}): ${n0(mean(e.dps))} (sd ${n0(sd(e.dps))}, ${n0(Math.min(...e.dps))}–${n0(Math.max(...e.dps))})`);
  const d = e.distribution;
  lines.push(`  as a distribution over the delays and crits: sd ${n0(d.sd)} (reaction delays ${n0(d.sdDelays)}, crits ${n0(d.sdCrits)}), 5–95% ${n0(d.p5)}–${n0(d.p95)}${e.critNote ? ` (${e.critNote})` : ""}`);
  lines.push(`Whole fight (${e.run.durationFrames / FPS} s): ${n0(mean(e.totals))} (${n0(mean(e.totals) / (e.run.durationFrames / FPS))} DPS); opener over at ${(e.run.openerEnd / FPS).toFixed(1)} s`);
  lines.push(`Per minute (seed 1): ${e.run.byMinute.map((x) => n0(x)).join(" / ")}`);
  const r = e.robust;
  lines.push(`Robustness (sustained DPS): delay 0 (a bot) ${n0(r.bot)}; ${reaction} s ${n0(r.normal)} (${signedPct(r.normal / r.bot - 1)}); ${reaction * 2} s ${n0(r.slow)} (${signedPct(r.slow / r.bot - 1)})`);
  const g = e.run.givenUp[0];
  if (g) lines.push(`Given up (seed 1): ${e.run.givenUp.length} press${e.run.givenUp.length === 1 ? "" : "es"} that couldn't start within the wait (first at ${(g.frame / FPS).toFixed(1)} s: ${describeStep(data, g.step)})`);
  const shares = Object.entries(e.run.perOperator).sort((a, b) => b[1] - a[1]).map(([op, d]) => `${data.operators[op]?.name ?? op} ${pct(d / e.run.total)}`);
  lines.push(`Shares (seed 1): ${shares.join(", ")}`);
  if (reference) {
    const f60 = mean(e.first60);
    lines.push(`Reference: the scenario's own rotation on the timeline (${reference.seconds} s): ${n0(reference.total)} (${n0(reference.total / reference.seconds)} DPS over its ${reference.seconds} s); the rules' first 60 s: ${n0(f60)} (${signedPct(f60 / reference.total - 1)}${reference.seconds === 60 ? "" : ", different lengths"})`);
  }
  return lines;
}

/** `efsim rules <scenario> <rules.json>`: the list's report; with `compare`, the paired gain of another list; with `assumptions`, whether it holds under the kits' other readings; with `search`, the rule search's Pareto front and best list too. */
export async function rulesCommand(data: GameData, scenario: TimelineScenario, rawList: RuleList, file: string, options: RulesOptions = {}): Promise<string> {
  const seconds = options.seconds ?? RULES_SECONDS;
  const reaction = options.reactionSeconds ?? POLICY_REACTION_SECONDS;
  const seeds = options.seeds ?? 5;
  const workers = options.workers ?? defaultWorkers();
  const team = scenario.team.map((b) => b.operator);
  const list = resolveRuleList(data, team, rawList);
  const fight: TimelineScenario = { ...withSeconds(scenario, seconds), rotation: [] };
  // The scenario's own rotation as the reference, when it can be played (other gear may not play a timeline made for the old: Si without her Ultimate Gain gloves).
  let reference: { total: number; seconds: number } | null = null;
  let noReference = "";
  if (scenario.rotation.length > 0) {
    try {
      reference = { total: simulate(data, scenario).total, seconds: scenario.durationFrames / FPS };
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      noReference = `Reference: the scenario's own rotation can't be played with this team (${e.message}).`;
    }
  }
  const controlled = scenario.controlled ?? (team[0] as string);
  const assumed = Object.entries(scenario.options.assume ?? {});
  const lines = [
    `Rules ${file}: ${team.map((op) => data.operators[op]?.name ?? op).join(", ")}; ${data.operators[controlled]?.name ?? controlled} controlled; ${seconds} s fight; reaction ${reaction} s ± ${POLICY_JITTER * 100}%; cue ranks ${JSON.stringify(POLICY_CUE_RANKS)}; ${codeProvenance()}${assumed.length ? `; assuming ${assumed.map(([k, v]) => `${k}=${v}`).join(", ")}` : ""}`,
    "",
  ];
  const firstSeed = options.firstSeed ?? 1;
  const start = await evaluate(data, fight, list, reaction, seeds, workers, firstSeed);
  lines.push(...formatEvaluation(data, start, reaction, reference));
  if (noReference) lines.push(noReference);

  // Another list on common seeds: the usual ones and fresh ones (a list found or judged on seeds 1…k is biased up there).
  const fresh = options.fresh ?? 32;
  const dpsOf = async (l: RuleList, sc: TimelineScenario, n: number, first: number) => (await runRulesJobs(data, seedRuns(data, sc, l, reaction, n, first), workers)).map((r) => r.sustainedDps);
  let comparison: { usual: { gain: number; se: number }; fresh: { gain: number; se: number } | null } | null = null;
  let other: RuleList | null = null;
  if (options.compare) {
    other = resolveRuleList(data, team, options.compare.list);
    options.progress?.(`compare: ${options.compare.file} on seeds 1–${seeds}${fresh ? ` and ${FRESH_SEED}–${FRESH_SEED + fresh - 1}` : ""}`);
    const usualOther = await dpsOf(other, fight, seeds, 1);
    const usual0 = paired(start.dps, usualOther);
    const freshA = fresh > 0 ? await dpsOf(list, fight, fresh, FRESH_SEED) : [];
    const freshB = fresh > 0 ? await dpsOf(other, fight, fresh, FRESH_SEED) : [];
    const fresh0 = fresh > 0 ? paired(freshA, freshB) : null;
    // With a second start, the verdict is the objective across starts (the mean per seed), each start's gain beside it.
    let usual = usual0;
    let freshGain = fresh0;
    const second: string[] = [];
    if (options.also) {
      const alsoFight: TimelineScenario = { ...withSeconds(options.also.scenario, seconds), rotation: [] };
      options.progress?.(`compare: the same on ${options.also.label}`);
      const ua = await dpsOf(list, alsoFight, seeds, 1);
      const ub = await dpsOf(other, alsoFight, seeds, 1);
      usual = paired(startsObjective([start.dps, ua]), startsObjective([usualOther, ub]));
      second.push(`  by start, seeds 1–${seeds}: ${gainText(usual0)} on the given start, ${gainText(paired(ua, ub))} on ${options.also.label}`);
      if (fresh > 0) {
        const fa = await dpsOf(list, alsoFight, fresh, FRESH_SEED);
        const fb = await dpsOf(other, alsoFight, fresh, FRESH_SEED);
        freshGain = paired(startsObjective([freshA, fa]), startsObjective([freshB, fb]));
        second.push(`  by start, fresh seeds: ${gainText(fresh0 as { gain: number; se: number })} on the given start (${n0(mean(freshA))} → ${n0(mean(freshB))}), ${gainText(paired(fa, fb))} on ${options.also.label} (${n0(mean(fa))} → ${n0(mean(fb))})`);
      }
    }
    comparison = { usual, fresh: freshGain };
    lines.push("", `Compared with ${options.compare.file} (its sustained DPS against this list's, paired on common seeds${options.also ? `; the objective across starts: the mean of the given start and ${options.also.label} per seed` : ""}):`);
    lines.push(`  seeds 1–${seeds}: ${gainText(usual)} (${verdictWords(usual)})`);
    if (freshGain) lines.push(`  fresh seeds ${FRESH_SEED}–${FRESH_SEED + fresh - 1}: ${gainText(freshGain)} (${verdictWords(freshGain)})`);
    lines.push(...second);
    lines.push(`  ${describeLearn(start.learn)} → ${describeLearn(learnability(other))}`);
  }

  // Under the kits' other readings: this list's DPS against the default reading, and the comparison's verdict.
  if (options.assumptions) {
    const alts = alternatives(data, fight);
    lines.push("", alts.length ? "Under the kits' open assumptions (each other reading of an in-game test the team's kits register):" : "Under the kits' open assumptions: the team's kits register none.");
    const summary: string[] = [];
    for (const alt of alts) {
      options.progress?.(`assumption ${alt.id}=${alt.reading}`);
      const sc = underAssume(fight, alt.assume);
      const dps = await dpsOf(list, sc, seeds, 1);
      const delta = paired(start.dps, dps);
      let line = `  ${alt.label}: sustained DPS ${n0(mean(dps))} (${gainText(delta)} against the reading in use, seeds 1–${seeds})`;
      if (other && comparison) {
        const ref = comparison.fresh ?? comparison.usual;
        const n = comparison.fresh ? fresh : seeds;
        const first = comparison.fresh ? FRESH_SEED : 1;
        const g = paired(await dpsOf(list, sc, n, first), await dpsOf(other, sc, n, first));
        const h = holds(ref, g);
        line += `; the comparison there: ${gainText(g)} (in use: ${gainText(ref)}): ${h}`;
        summary.push(`${h === "unclear" ? "is unclear" : h} under ${alt.label}`);
      }
      lines.push(line);
    }
    if (summary.length) lines.push(`  In short: the comparison ${summary.join("; ")}.`);
  }
  if (!options.search) return lines.join("\n");

  const searchSeconds = options.searchSeconds ?? 180;
  const t0 = performance.now();
  const result = searchRules(data, withSeconds(fight, searchSeconds), list, {
    reactionSeconds: reaction,
    ...(options.iterations !== undefined ? { iterations: options.iterations } : {}),
    ...(options.searchSeeds !== undefined ? { seeds: options.searchSeeds } : {}),
    ...(options.penalty !== undefined ? { penalty: options.penalty } : {}),
    progress: (done, best) => {
      if (done % 10 === 0) options.progress?.(`  ${done} lists, best ${n0(best.dps)} DPS at complexity ${best.learn.complexity} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
    },
  });
  const searchTime = (performance.now() - t0) / 1000;
  // The front, scored again over the whole fight; the best by DPS less the penalty there.
  const frontSize = options.front ?? 8;
  const penalty = options.penalty ?? RULE_SEARCH_PENALTY;
  const front = thin(result.pareto, frontSize);
  const full: { s: RuleScore; e: Evaluation }[] = [];
  for (const s of front) full.push({ s, e: await evaluate(data, fight, s.list, reaction, seeds, workers) });
  const fullScore = (x: (typeof full)[number]) => mean(x.e.dps) * (1 - penalty * x.e.learn.complexity);
  const best = full.reduce((a, b) => (fullScore(b) > fullScore(a) ? b : a));
  lines.push("", `Rule search: ${result.evaluated} lists scored in ${searchTime.toFixed(0)} s (${searchSeconds} s fights, ${options.searchSeeds ?? 2} seeds); start ${n0(result.start.dps)} → best ${n0(result.best.dps)} DPS (complexity ${result.start.learn.complexity} → ${result.best.learn.complexity}).`);
  lines.push(`Pareto front (DPS against complexity; ${front.length} of ${result.pareto.length} lists, scored again over ${seconds} s with ${seeds} seeds):`);
  lines.push(
    table(
      ["#", "Complexity", "Rules", "Cue cost", "Hardest", `DPS (${searchSeconds} s)`, `DPS (${seconds} s)`, "Bot", `${reaction * 2} s`],
      full.map(({ s, e }, i) => [String(i + 1), String(e.learn.complexity), String(e.learn.rules), String(e.learn.cueCost), String(e.learn.hardestRank), n0(s.dps), n0(mean(e.dps)), n0(e.robust.bot), n0(e.robust.slow)]),
      ["r", "r", "r", "r", "r", "r", "r", "r", "r"],
    ),
  );
  full.forEach(({ e }, i) => {
    lines.push("", `#${i + 1}:`, ...describeRuleList(data, e.list, e.run.fired));
  });
  lines.push("", `Best (DPS less ${penalty * 100}% a complexity point, over ${seconds} s): #${full.indexOf(best) + 1}`, ...formatEvaluation(data, best.e, reaction, reference));
  if (options.out) {
    writeFileSync(options.out, JSON.stringify({ ...best.e.list, description: `Found by efsim rules --search from ${file} (${result.evaluated} lists): ${n0(mean(best.e.dps))} sustained DPS over ${seconds} s at a ${reaction} s reaction delay; complexity ${best.e.learn.complexity}.` }, null, 2) + "\n");
    lines.push("", `Wrote ${options.out} (the best list).`);
  }
  return lines.join("\n");
}

/** At most n lists of a front (by complexity), spread over it, always with its last (the highest DPS). */
function thin(front: readonly RuleScore[], n: number): RuleScore[] {
  if (front.length <= n) return [...front];
  return Array.from({ length: n }, (_, i) => front[Math.round((i * (front.length - 1)) / (n - 1))] as RuleScore);
}
