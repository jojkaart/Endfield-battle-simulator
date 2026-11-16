// efsim rules: play a rule-based rotation (engine policy.ts) over a long fight and report its sustained DPS, spread,
// robustness to the reaction delay, which rules fired and how learnable it is; --search improves it (policysearch.ts).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  FPS,
  POLICY_CUE_RANKS,
  POLICY_JITTER,
  POLICY_REACTION_SECONDS,
  RULE_SEARCH_PENALTY,
  critTriggers,
  cueCost,
  describeRule,
  distributionCritMode,
  describeStep,
  learnability,
  playRules,
  policyDistribution,
  resolveRuleList,
  searchRules,
  simulate,
  type GameData,
  type Learnability,
  type PolicyRun,
  type RuleList,
  type RuleScore,
  type SustainedDistribution,
  type TimelineScenario,
} from "@efsim/engine";
import { num, pct, signedPct, table } from "./format.ts";

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
  readonly progress?: (line: string) => void;
}

export const RULES_SECONDS = 300;

interface Evaluation {
  readonly list: RuleList;
  readonly learn: Learnability;
  /** Seed 1 at the default delay, expected crits: fired counts, per minute, the reference comparison. */
  readonly run: PolicyRun;
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

function evaluate(data: GameData, scenario: TimelineScenario, list: RuleList, reaction: number, seeds: number): Evaluation {
  const crit = distributionCritMode(data, scenario);
  const triggers = crit === "distribution" ? critTriggers(data, scenario) : [];
  const runs = Array.from({ length: seeds }, (_, i) => playRules(data, { ...scenario, options: { ...scenario.options, crit, seed: i + 1 } }, list, { reactionSeconds: reaction, seed: i + 1 }));
  const bot = playRules(data, scenario, list, { reactionSeconds: 0 }).sustainedDps;
  const slow = mean(Array.from({ length: seeds }, (_, i) => playRules(data, scenario, list, { reactionSeconds: reaction * 2, seed: i + 1 }).sustainedDps));
  const dps = runs.map((r) => r.sustainedDps);
  return {
    list,
    learn: learnability(list),
    run: runs[0] as PolicyRun,
    dps,
    distribution: policyDistribution(runs.map((r) => r.sustainedMoments)),
    ...(triggers.length ? { critNote: `crit-triggered effects (${triggers.join(", ")}): the crits they read are rolled, seeded with the delay's seed` } : {}),
    robust: { bot, normal: mean(dps), slow },
    first60: runs.map((r) => r.first60),
    totals: runs.map((r) => r.total),
  };
}

const n0 = (x: number) => num(Math.round(x), 0);
const RANK_WORDS: Readonly<Record<number, string>> = { 0: "none", 1: "a combo lighting up", 2: "SP or Typhoeus's arrows / Signs", 3: "the enemy's statuses or an operator's visible state", 4: "an ultimate ready", 5: "counting Final Strikes", 6: "a combo's cooldown", 7: "a timer in the head" };

/** The list in the player's words: opener, numbered rules (with their cue cost), filler. */
export function describeRuleList(data: GameData, list: RuleList, fired?: readonly number[]): string[] {
  const lines = [`Opener: ${list.opener.length ? list.opener.map((s) => describeStep(data, s)).join(", then ") : "none"}`];
  list.rules.forEach((r, i) => {
    const c = cueCost(r.when);
    lines.push(`  ${i + 1}. ${describeRule(data, r)}  [cue cost ${c.cost}${fired ? `; fired ${fired[i]}×` : ""}]`);
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
  lines.push(`Sustained DPS after the opener (expected crits, ${seeds} seed${seeds === 1 ? "" : "s"} of the reaction delay): ${n0(mean(e.dps))} (sd ${n0(sd(e.dps))}, ${n0(Math.min(...e.dps))}–${n0(Math.max(...e.dps))})`);
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

/** `efsim rules <scenario> <rules.json>`: the list's report; with `search`, the rule search's Pareto front and best list too. */
export function rulesCommand(data: GameData, scenario: TimelineScenario, rawList: RuleList, file: string, options: RulesOptions = {}): string {
  const seconds = options.seconds ?? RULES_SECONDS;
  const reaction = options.reactionSeconds ?? POLICY_REACTION_SECONDS;
  const seeds = options.seeds ?? 5;
  const team = scenario.team.map((b) => b.operator);
  const list = resolveRuleList(data, team, rawList);
  const fight: TimelineScenario = { ...scenario, durationFrames: Math.round(seconds * FPS), rotation: [] };
  const reference = scenario.rotation.length > 0 ? { total: simulate(data, scenario).total, seconds: scenario.durationFrames / FPS } : null;
  const controlled = scenario.controlled ?? (team[0] as string);
  const lines = [
    `Rules ${file}: ${team.map((op) => data.operators[op]?.name ?? op).join(", ")}; ${data.operators[controlled]?.name ?? controlled} controlled; ${seconds} s fight; reaction ${reaction} s ± ${POLICY_JITTER * 100}%; cue ranks ${JSON.stringify(POLICY_CUE_RANKS)}`,
    "",
  ];
  const start = evaluate(data, fight, list, reaction, seeds);
  lines.push(...formatEvaluation(data, start, reaction, reference));
  if (!options.search) return lines.join("\n");

  const searchSeconds = options.searchSeconds ?? 180;
  const t0 = performance.now();
  const result = searchRules(data, { ...fight, durationFrames: Math.round(searchSeconds * FPS) }, list, {
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
  const full = front.map((s) => ({ s, e: evaluate(data, fight, s.list, reaction, seeds) }));
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
