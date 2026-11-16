// Rule-based rotations (docs/design.md "Rule-based rotations"; the owner, 2026-11-16): a short opener and an ordered
// list of rules "when cue X is visible, do Y", played by a simulated player with a reaction delay on the same
// timeline the search and `simulate` use (init / advance / startsNow / apply). The driver never decides anything a
// player couldn't: rules read only what the game's UI shows (POLICY_CUE_RANKS), and the actions are button presses
// (an operator's battle skill, combo or ultimate, resolved to the skill the button casts then; the controlled
// operator's dive). The default action is the controlled operator's basic attack.

import { EngineError } from "./errors.ts";
import type { GameData } from "./model.ts";
import type { ArtsElement } from "./reactions.ts";
import type { PhysicalStatus, ReactionStatus } from "./status.ts";
import { FPS } from "./units.ts";
import { hitsMoments, NO_DAMAGE, scaleMoments, type DamageMoments } from "./moments.ts";
import { diveOf, nextBasics } from "./search.ts";
import { activeAt } from "./buffs.ts";
import { advance, apply, createContext, earliestStart, exclusiveUntil, init, memoised, startsNow, type RotationAction, type TimelineContext, type TimelineScenario, type TimelineState } from "./timeline.ts";
import { isStaggered, maxEnergy, skillSpGain, spAt } from "./timeline/resources.ts";
import { kitSkill, skillCosts } from "./timeline/context.ts";
import { needsWindow, skillAvailable, windowKey, windowOpen } from "./timeline/timing.ts";

// --- The format ----------------------------------------------------------------

/**
 * A button press: an operator's battle skill, combo or ultimate, or the controlled operator's dive (a jump, then the
 * plunge), basic attack (whatever the input is then: the chain's step, an aerial attack while hovering, a finisher on a
 * Staggered enemy) or finisher (only on a Staggered enemy whose finisher is unused).
 */
export interface PolicyStep {
  /** Operator ID or name (as the game shows it), from the scenario's team. */
  readonly operator: string;
  readonly cast: "battle" | "combo" | "ultimate" | "dive" | "basic" | "finisher";
}

export const POLICY_CASTS: readonly PolicyStep["cast"][] = ["battle", "combo", "ultimate", "dive", "basic", "finisher"];

/**
 * What a rule reads, all shown by the game's UI (the owner's ranking, 2026-11-16, POLICY_CUE_RANKS); `all` / `any` /
 * `not` combine them (a combination costs the sum of its parts).
 */
export type PolicyCue =
  /** Rank 1: the operator's combo skill is lit (off cooldown, its window open, available). */
  | { readonly combo: string }
  /** Rank 2: a stack the HUD shows (POLICY_VISIBLE_STACKS: Typhoeus's Hunting Arrows and Signs). */
  | { readonly stacks: { readonly operator: string; readonly stack: string; readonly atLeast?: number; readonly below?: number } }
  /** Rank 2: team SP (the bar's three segments of 100: "battle skills ready"). */
  | { readonly sp: { readonly atLeast?: number; readonly below?: number } }
  /** Rank 3: an Arts infliction on the enemy (any element, or one), with at least / below so many stacks. */
  | { readonly infliction: { readonly element?: string; readonly atLeast?: number; readonly below?: number } }
  /** Rank 3: a reaction or physical status on the enemy (solidification, corrosion, combustion, electrification; lift, knockdown, crush, breach). */
  | { readonly status: string }
  /** Rank 3: the enemy's Vulnerable stacks. */
  | { readonly vulnerable: { readonly atLeast?: number; readonly below?: number } }
  /** Rank 3: the enemy is Staggered (its bar shows it). */
  | { readonly staggered: boolean }
  /** Rank 3: an operator's state the game shows on the character or its skill button (POLICY_VISIBLE_BUFFS: Typhoeus hovering, …). */
  | { readonly buff: { readonly operator: string; readonly buff: string } }
  /** Rank 4: the operator's ultimate is ready (energy full, off cooldown, available). */
  | { readonly ultimate: string }
  /** Rank 5: the controlled operator's Final Strikes since this rule last fired (or since the fight started). */
  | { readonly finalStrikes: { readonly atLeast: number } }
  /** Rank 6: the operator's combo is off cooldown (lit or not). */
  | { readonly comboCooldown: string }
  /** Rank 7: seconds since the operator last pressed that button (a timer in the player's head; never pressed: true). */
  | { readonly since: { readonly operator: string; readonly cast: PolicyStep["cast"]; readonly atLeast: number } }
  | { readonly all: readonly PolicyCue[] }
  | { readonly any: readonly PolicyCue[] }
  | { readonly not: PolicyCue };

export interface PolicyRule {
  readonly when: PolicyCue;
  /** One press, or a short sequence (at most 3) played in order, each as soon as it can start ("battle skill A, then combo B"). */
  readonly do: PolicyStep | readonly PolicyStep[];
  /** What the rule is for, in the player's words (shown in reports). */
  readonly note?: string;
}

export interface RuleList {
  readonly description?: string;
  /** A few presses at the fight's start, each as soon as it can start, before any rule is read. */
  readonly opener: readonly PolicyStep[];
  /** Ordered: at each moment the first rule whose cue the player has seen (after the reaction delay) and whose first press can start fires. */
  readonly rules: readonly PolicyRule[];
  /**
   * What the controlled operator does when no rule fires: its basic attacks (default) or dives (jump attacks, each once
   * the current skill is past its exclusive frames).
   */
  readonly filler?: "basic" | "dive";
}

/**
 * The owner's ranking of cues, easiest first (2026-11-16; docs/design.md "Rule-based rotations"): 1 a combo lighting
 * up, 2 Typhoeus's arrows and Signs, SP, 3 the enemy's inflictions and statuses, 4 an ultimate ready (corner of the
 * screen), 5 counting Final Strikes, 6 a combo's cooldown, 7 a timer in the head.
 */
export const POLICY_CUE_RANKS = { combo: 1, stacks: 2, sp: 2, infliction: 3, status: 3, vulnerable: 3, staggered: 3, buff: 3, ultimate: 4, finalStrikes: 5, comboCooldown: 6, since: 7 } as const;

/** What a cue of each rank costs to learn and watch: the rank itself up to 3, steeper after; a timer counts heavily (owner: "avoid, or count heavily against"). */
export const POLICY_RANK_COST: Readonly<Record<number, number>> = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 6, 6: 7, 7: 20 };

/** Kit stacks the game's HUD shows (owner, 2026-11-16: Typhoeus's Hunting Arrows and Signs, "very easy"); others are refused. */
export const POLICY_VISIBLE_STACKS: Readonly<Record<string, readonly string[]>> = { chr_0034_typhoea: ["signs", "arrows"] };

/**
 * Kit buffs a player sees without reading buff icons, each for a reason (others are refused): Typhoeus `hovering` (she
 * is in the air), Laevatain `twilight` (her ultimate's form; the battle-skill button changes), Liino `vocalist_stance`
 * (the battle-skill button becomes End Stance), Si `artful_intent` / `inksoul` (the battle-skill button becomes
 * Initial / Final Stroke).
 */
export const POLICY_VISIBLE_BUFFS: Readonly<Record<string, readonly string[]>> = {
  chr_0034_typhoea: ["hovering"],
  chr_0016_laevat: ["twilight"],
  chr_0035_liino: ["vocalist_stance"],
  chr_0036_jsspsi: ["artful_intent", "inksoul"],
};

/** The game's element names (as the UI shows them) for the engine's. */
const ELEMENTS: Readonly<Record<string, ArtsElement>> = { heat: "fire", fire: "fire", electric: "pulse", pulse: "pulse", cryo: "cryst", cryst: "cryst", nature: "natural", natural: "natural" };
const REACTIONS: readonly ReactionStatus[] = ["combustion", "electrification", "solidification", "corrosion"];
const PHYSICALS: readonly PhysicalStatus[] = ["lift", "knockdown", "crush", "breach"];

// --- Learnability --------------------------------------------------------------

/** A cue's cost (POLICY_RANK_COST of each part, summed) and its hardest part's rank. */
export function cueCost(cue: PolicyCue): { readonly cost: number; readonly rank: number } {
  if ("all" in cue || "any" in cue) {
    const parts = ("all" in cue ? cue.all : cue.any).map(cueCost);
    return { cost: parts.reduce((a, p) => a + p.cost, 0), rank: Math.max(0, ...parts.map((p) => p.rank)) };
  }
  if ("not" in cue) return cueCost(cue.not);
  const kind = Object.keys(cue)[0] as keyof typeof POLICY_CUE_RANKS;
  const rank = POLICY_CUE_RANKS[kind];
  return { cost: POLICY_RANK_COST[rank] as number, rank };
}

export interface Learnability {
  readonly openerSteps: number;
  readonly rules: number;
  /** Presses in the rules' actions (a pair counts 2). */
  readonly ruleSteps: number;
  /** The rules' cue costs, summed. */
  readonly cueCost: number;
  /** The hardest cue's rank (1–7; 0 without rules). */
  readonly hardestRank: number;
  /** One number to compare lists by: opener steps + rules' presses + cue costs. */
  readonly complexity: number;
}

export function learnability(list: RuleList): Learnability {
  const costs = list.rules.map((r) => cueCost(r.when));
  const ruleSteps = list.rules.reduce((a, r) => a + stepsOf(r).length, 0);
  const cue = costs.reduce((a, c) => a + c.cost, 0);
  return { openerSteps: list.opener.length, rules: list.rules.length, ruleSteps, cueCost: cue, hardestRank: Math.max(0, ...costs.map((c) => c.rank)), complexity: list.opener.length + ruleSteps + cue };
}

export const stepsOf = (r: PolicyRule): readonly PolicyStep[] => (Array.isArray(r.do) ? (r.do as readonly PolicyStep[]) : [r.do as PolicyStep]);

// --- In the player's words ---------------------------------------------------------

const ELEMENT_NAMES: Readonly<Record<ArtsElement, string>> = { fire: "Heat", pulse: "Electric", cryst: "Cryo", natural: "Nature" };
const CAST_NAMES: Readonly<Record<PolicyStep["cast"], string>> = { battle: "battle skill", combo: "combo", ultimate: "ultimate", dive: "dive (jump attack)", basic: "basic attack", finisher: "finisher" };

function rangeWords(r: { readonly atLeast?: number; readonly below?: number }): string {
  if (r.atLeast !== undefined && r.below !== undefined) return `${r.atLeast} to ${r.below - 1}`;
  return r.atLeast !== undefined ? `at least ${r.atLeast}` : `below ${r.below}`;
}

/** A step as the player would say it ("Estella's battle skill"). */
export function describeStep(data: GameData, s: PolicyStep): string {
  return `${data.operators[s.operator]?.name ?? s.operator}'s ${CAST_NAMES[s.cast]}`;
}

/** The visible states (POLICY_VISIBLE_BUFFS) in words: [while it's on, while it's off]. */
const BUFF_WORDS: Readonly<Record<string, readonly [string, string]>> = {
  hovering: ["is hovering", "is on the ground"],
  twilight: ["is in Twilight", "isn't in Twilight"],
  vocalist_stance: ["is in Vocalist Stance", "isn't in Vocalist Stance"],
  artful_intent: ["has Artful Intent up", "hasn't Artful Intent up"],
  inksoul: ["has Inksoul up", "hasn't Inksoul up"],
};

function buffWords(data: GameData, b: { readonly operator: string; readonly buff: string }, on: boolean): string {
  const w = BUFF_WORDS[b.buff] ?? [`has ${b.buff} up`, `hasn't ${b.buff} up`];
  return `${data.operators[b.operator]?.name ?? b.operator} ${on ? w[0] : w[1]}`;
}

/** A cue as the player would say it ("Arcane's combo lights up"). */
export function describeCue(data: GameData, cue: PolicyCue): string {
  const name = (op: string) => data.operators[op]?.name ?? op;
  if ("all" in cue) return cue.all.map((c) => describeCue(data, c)).join(" and ");
  if ("any" in cue) return cue.any.map((c) => describeCue(data, c)).join(" or ");
  if ("not" in cue) {
    if ("buff" in cue.not) return buffWords(data, cue.not.buff, false);
    if ("staggered" in cue.not) return describeCue(data, { staggered: !cue.not.staggered });
    return `not (${describeCue(data, cue.not)})`;
  }
  if ("combo" in cue) return `${name(cue.combo)}'s combo lights up`;
  if ("ultimate" in cue) return `${name(cue.ultimate)}'s ultimate is ready`;
  if ("comboCooldown" in cue) return `${name(cue.comboCooldown)}'s combo is off cooldown`;
  if ("stacks" in cue) return `${name(cue.stacks.operator)}'s ${data.kits.operators[cue.stacks.operator]?.stacks?.find((s) => s.id === cue.stacks.stack)?.label ?? cue.stacks.stack}: ${rangeWords(cue.stacks)}`;
  if ("sp" in cue) return `SP ${rangeWords(cue.sp)}`;
  if ("infliction" in cue) {
    const el = cue.infliction.element === undefined ? "an Arts" : `a ${ELEMENT_NAMES[ELEMENTS[cue.infliction.element] as ArtsElement]}`;
    return cue.infliction.atLeast === undefined && cue.infliction.below === undefined ? `the enemy has ${el} infliction` : `the enemy has ${el} infliction, ${rangeWords(cue.infliction)} stacks`;
  }
  if ("status" in cue) return `the enemy has ${cue.status[0]?.toUpperCase()}${cue.status.slice(1)}`;
  if ("vulnerable" in cue) return `the enemy's Vulnerable stacks ${rangeWords(cue.vulnerable)}`;
  if ("staggered" in cue) return cue.staggered ? "the enemy is Staggered" : "the enemy isn't Staggered";
  if ("buff" in cue) return buffWords(data, cue.buff, true);
  if ("finalStrikes" in cue) return `${cue.finalStrikes.atLeast} Final Strike${cue.finalStrikes.atLeast === 1 ? "" : "s"} since this rule last fired`;
  if ("since" in cue) return `${cue.since.atLeast} s since ${name(cue.since.operator)}'s last ${CAST_NAMES[cue.since.cast]}`;
  return JSON.stringify(cue);
}

/** A rule as the player would say it ("When Arcane's combo lights up: Estella's battle skill, then Arcane's combo"). */
export function describeRule(data: GameData, r: PolicyRule): string {
  const when = describeCue(data, r.when);
  return `When ${when}: ${stepsOf(r).map((s) => describeStep(data, s)).join(", then ")}`;
}

// --- Checking a list against a team ----------------------------------------------

/** The list with every operator as its ID, checked against the team (unknown operators, hidden stacks, bad elements and statuses, empty actions are errors). */
export function resolveRuleList(data: GameData, team: readonly string[], list: RuleList): RuleList {
  const opId = (x: string, where: string): string => {
    if (team.includes(x)) return x;
    const byName = team.filter((op) => data.operators[op]?.name.toLowerCase() === x.toLowerCase());
    if (byName.length === 1) return byName[0] as string;
    throw new EngineError(`${where}: ${x} isn't an operator of the team (${team.map((op) => `${data.operators[op]?.name ?? op} = ${op}`).join(", ")})`);
  };
  const step = (s: PolicyStep, where: string): PolicyStep => {
    if (!POLICY_CASTS.includes(s.cast)) throw new EngineError(`${where}: cast must be one of ${POLICY_CASTS.join(", ")}, not ${String(s.cast)}`);
    return { operator: opId(s.operator, where), cast: s.cast };
  };
  const range = (r: { readonly atLeast?: number; readonly below?: number }, where: string) => {
    if (r.atLeast === undefined && r.below === undefined) throw new EngineError(`${where}: give atLeast and/or below`);
  };
  const cue = (c: PolicyCue, where: string): PolicyCue => {
    const keys = Object.keys(c);
    if (keys.length !== 1) throw new EngineError(`${where}: a cue has exactly one kind, not ${keys.join(", ") || "none"}`);
    if ("all" in c) return { all: c.all.map((x, i) => cue(x, `${where}.all[${i}]`)) };
    if ("any" in c) return { any: c.any.map((x, i) => cue(x, `${where}.any[${i}]`)) };
    if ("not" in c) return { not: cue(c.not, `${where}.not`) };
    if ("combo" in c) return { combo: opId(c.combo, where) };
    if ("ultimate" in c) return { ultimate: opId(c.ultimate, where) };
    if ("comboCooldown" in c) return { comboCooldown: opId(c.comboCooldown, where) };
    if ("stacks" in c) {
      const op = opId(c.stacks.operator, where);
      if (!(POLICY_VISIBLE_STACKS[op] ?? []).includes(c.stacks.stack)) throw new EngineError(`${where}: ${op}'s ${c.stacks.stack} isn't a stack the HUD shows (shown: ${JSON.stringify(POLICY_VISIBLE_STACKS)})`);
      range(c.stacks, where);
      return { stacks: { ...c.stacks, operator: op } };
    }
    if ("sp" in c) return range(c.sp, where), c;
    if ("vulnerable" in c) return range(c.vulnerable, where), c;
    if ("infliction" in c) {
      if (c.infliction.element !== undefined && !(c.infliction.element in ELEMENTS)) throw new EngineError(`${where}: unknown element ${c.infliction.element} (heat, electric, cryo, nature)`);
      return c;
    }
    if ("status" in c) {
      if (![...REACTIONS, ...PHYSICALS].includes(c.status as ReactionStatus)) throw new EngineError(`${where}: unknown status ${c.status} (${[...REACTIONS, ...PHYSICALS].join(", ")})`);
      return c;
    }
    if ("staggered" in c) return c;
    if ("buff" in c) {
      const op = opId(c.buff.operator, where);
      if (!(POLICY_VISIBLE_BUFFS[op] ?? []).includes(c.buff.buff)) throw new EngineError(`${where}: ${op}'s ${c.buff.buff} isn't a state the game shows without buff icons (shown: ${JSON.stringify(POLICY_VISIBLE_BUFFS)})`);
      return { buff: { operator: op, buff: c.buff.buff } };
    }
    if ("finalStrikes" in c) {
      if (!(c.finalStrikes.atLeast >= 1)) throw new EngineError(`${where}: finalStrikes.atLeast must be ≥ 1`);
      return c;
    }
    if ("since" in c) return { since: { ...c.since, operator: opId(c.since.operator, where) } };
    throw new EngineError(`${where}: unknown cue ${keys[0]}`);
  };
  if (list.filler !== undefined && list.filler !== "basic" && list.filler !== "dive") throw new EngineError(`filler must be basic or dive, not ${String(list.filler)}`);
  return {
    ...(list.description !== undefined ? { description: list.description } : {}),
    ...(list.filler !== undefined ? { filler: list.filler } : {}),
    opener: list.opener.map((s, i) => step(s, `opener[${i}]`)),
    rules: list.rules.map((r, i) => {
      const steps = stepsOf(r);
      if (steps.length < 1 || steps.length > 3) throw new EngineError(`rules[${i}]: do has 1 to 3 presses, not ${steps.length}`);
      return { when: cue(r.when, `rules[${i}].when`), do: steps.map((s, j) => step(s, `rules[${i}].do[${j}]`)), ...(r.note !== undefined ? { note: r.note } : {}) };
    }),
  };
}

// --- The driver ----------------------------------------------------------------

export interface PolicyOptions {
  /** The player's reaction delay to a cue, in seconds (default 0.3; 0: a bot). */
  readonly reactionSeconds?: number;
  /** Each delay is drawn uniformly within ± this fraction of it (default 0.5). */
  readonly jitter?: number;
  /**
   * Seed of the delays' draws (default the scenario's seed, else 1). Common random numbers: the delay of a rule's k-th
   * cue onset depends only on (seed, the rule, k), the rule known by its cue and presses (policyDelay), so two runs that
   * differ a little (gear, another rule) draw the same delays wherever their cues' onsets line up.
   */
  readonly seed?: number;
  /**
   * Stratified draws over a set of seeds (Latin hypercube per rule onset): with `samples` n, seeds 1…n each draw a
   * delay from their own n-th of the delay's range, the n-ths shuffled per (rule, onset) by `base`. Off by default.
   */
  readonly stratify?: { readonly samples: number; readonly base?: number };
  /** Watches the run frame by frame (the rules' diagnosis: policydiag.ts); never changes it. */
  readonly observer?: PolicyObserver;
  /** A press of the opener or of a rule's sequence that can't start within this many seconds is given up (default 6). */
  readonly waitSeconds?: number;
  /** Judge the basic attack's options at every frame instead of from their earliest start (a check of that shortcut; slower). */
  readonly judgeEveryFrame?: boolean;
}

export const POLICY_REACTION_SECONDS = 0.3;
export const POLICY_JITTER = 0.5;
export const POLICY_WAIT_SECONDS = 6;

export interface PolicyRun {
  /** Damage of every hit landed within the fight. */
  readonly total: number;
  readonly perOperator: Readonly<Record<string, number>>;
  /** Damage landed in each minute of the fight (the last may be partial). */
  readonly byMinute: readonly number[];
  /** Damage landed in the first 60 s (comparable with a 60 s timeline's total under the same start). */
  readonly first60: number;
  /** Frame the opener's last press started (or was given up). */
  readonly openerEnd: number;
  /** Damage per second of hits landed after the opener, to the fight's end. */
  readonly sustainedDps: number;
  /** Times each rule fired (by index). */
  readonly fired: readonly number[];
  /** Presses given up (opener or a rule's later presses) because they couldn't start in time. */
  readonly givenUp: readonly { readonly frame: number; readonly step: PolicyStep; readonly rule: number | null }[];
  /** Everything pressed, as a rotation with absolute frames: `simulate` replays it to the same hits. */
  readonly rotation: readonly RotationAction[];
  readonly durationFrames: number;
  /**
   * Sustained DPS as a distribution over what's random in this run and changes nothing later (each hit's crit:
   * moments.ts hitsMoments of the hits after the opener, over the seconds): its mean is `sustainedDps`. The spread from
   * the reaction delays is across runs (policyDistribution).
   */
  readonly sustainedMoments: DamageMoments;
}

/** What an observer sees at the end of each frame (after that frame's presses). */
export interface PolicyFrameView {
  readonly ctx: TimelineContext;
  readonly st: TimelineState;
  readonly frame: number;
  readonly list: RuleList;
  /** Whether a cue holds now (a Final Strikes count as reached: the observer has no rule to count since). */
  readonly cueHolds: (cue: PolicyCue) => boolean;
  /** Rule i's cue: `off` (doesn't hold), `waiting` (holds, within its reaction delay), `seen` (holds, delay over). */
  readonly ruleState: (i: number) => "off" | "waiting" | "seen";
  /** A press of the opener or of a fired rule's sequence is still waiting to start. */
  readonly queued: boolean;
}

export interface PolicyObserver {
  readonly frame: (view: PolicyFrameView) => void;
}

/** mulberry32's output function on one 32-bit state: a uniform value in [0, 1). */
function mix32(a: number): number {
  let t = (a + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** FNV-1a of a string (a rule's identity for its delays). */
function hashText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** A uniform value in [0, 1) that depends only on its integer parts (each folded in turn). */
function keyedUniform(...parts: readonly number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h = (Math.imul(h ^ (p >>> 0), 0x85ebca6b) + 0x27d4eb2f) >>> 0;
    h = Math.floor(mix32(h) * 4294967296) >>> 0;
  }
  return mix32(h);
}

/** The identity of each rule for its delays: its cue and presses, and among identical rules its place among them. */
export function ruleDelayKeys(list: RuleList): number[] {
  const seen = new Map<string, number>();
  return list.rules.map((r) => {
    const text = JSON.stringify([r.when, stepsOf(r)]);
    const n = seen.get(text) ?? 0;
    seen.set(text, n + 1);
    return hashText(`${text}#${n}`);
  });
}

/**
 * The uniform draw (0–1) behind the delay of a rule's k-th cue onset (k from 0): common random numbers, a function of
 * (seed, the rule's key, k) only. Stratified (PolicyOptions.stratify, n samples, seed s in 1…n): stratum π(s − 1) of n,
 * π a shuffle of 0…n − 1 drawn from (base, key, k), plus a uniform offset within it.
 */
export function policyDelay(seed: number, key: number, k: number, stratify?: PolicyOptions["stratify"]): number {
  if (!stratify) return keyedUniform(seed, key, k);
  const n = stratify.samples;
  const index = (((seed - 1) % n) + n) % n;
  const base = stratify.base ?? 0;
  // Fisher–Yates on 0…n − 1 with draws keyed by (base, key, k, step): the same shuffle for every seed of the set.
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(keyedUniform(0x5eed, base, key, k, i) * (i + 1));
    [perm[i], perm[j]] = [perm[j] as number, perm[i] as number];
  }
  return ((perm[index] as number) + keyedUniform(0x0ff5e7, base, key, k, index)) / n;
}

/** The skills a button of an operator can cast (the button casts whichever is available then; follow-ups never). */
function buttonSkills(ctx: TimelineContext, step: PolicyStep, controlled: string): readonly string[] {
  const own = step.cast === "dive" || step.cast === "basic" || step.cast === "finisher";
  if (own && step.operator !== controlled) throw new EngineError(`a ${step.cast} is the controlled operator's (${controlled}), not ${step.operator}'s`);
  if (step.cast === "dive") {
    const d = diveOf(ctx.data, step.operator);
    if (d === undefined) throw new EngineError(`${step.operator} has no dive in its kit`);
    return [d];
  }
  // The basic-attack input: whatever it is then (playRules' basicAttack).
  if (step.cast === "basic") return [];
  if (step.cast === "finisher") {
    const f = (ctx.kits.get(step.operator)?.skills ?? []).filter((s) => s.kind === "basic" && ctx.data.skills[s.skillId]?.timing?.specification === 8).map((s) => s.skillId);
    if (f.length === 0) throw new EngineError(`${step.operator} has no finisher in its kit`);
    return f;
  }
  const out = (ctx.kits.get(step.operator)?.skills ?? []).filter((s) => s.kind === step.cast && !s.followUpOnly).map((s) => s.skillId);
  if (out.length === 0) throw new EngineError(`${step.operator} has no ${step.cast} skill`);
  return out;
}

/** The controlled operator's Final Strikes: its basic-chain steps that give SP (the chain's last, `atb`). */
function finalStrikes(ctx: TimelineContext, operator: string): ReadonlySet<string> {
  return new Set((ctx.kits.get(operator)?.skills ?? []).filter((s) => s.kind === "basic" && ctx.data.skills[s.skillId]?.timing?.specification === 1 && skillSpGain(ctx, operator, s.skillId) > 0).map((s) => s.skillId));
}

interface CueEnv {
  readonly ctx: TimelineContext;
  readonly st: TimelineState;
  readonly frame: number;
  readonly buttons: (step: PolicyStep) => readonly string[];
  /** The controlled operator's Final Strikes since the rule last fired. */
  readonly strikes: number;
  readonly lastPress: ReadonlyMap<string, number>;
}

const inRange = (x: number, r: { readonly atLeast?: number; readonly below?: number }) => (r.atLeast === undefined || x >= r.atLeast) && (r.below === undefined || x < r.below);

function comboLit(env: CueEnv, op: string, needWindow: boolean): boolean {
  const { ctx, st, frame } = env;
  return env.buttons({ operator: op, cast: "combo" }).some((id) => {
    if ((st.readyAt[id] ?? 0) > frame) return false;
    const skill = kitSkill(ctx, op, id);
    if (needWindow && needsWindow(ctx, op, skill) && !windowOpen(st, op, windowKey(ctx, op, id), frame)) return false;
    return skillAvailable(ctx, st, op, id, frame);
  });
}

function cueHolds(env: CueEnv, cue: PolicyCue): boolean {
  const { ctx, st, frame } = env;
  if ("all" in cue) return cue.all.every((c) => cueHolds(env, c));
  if ("any" in cue) return cue.any.some((c) => cueHolds(env, c));
  if ("not" in cue) return !cueHolds(env, cue.not);
  if ("combo" in cue) return comboLit(env, cue.combo, true);
  if ("comboCooldown" in cue) return comboLit(env, cue.comboCooldown, false);
  if ("ultimate" in cue) {
    const op = cue.ultimate;
    return env.buttons({ operator: op, cast: "ultimate" }).some((id) => {
      if ((st.readyAt[id] ?? 0) > frame) return false;
      const cost = skillCosts(ctx, op, id, frame).energyCost;
      return (st.energy[op] ?? 0) >= Math.min(cost, maxEnergy(ctx, op)) - 1e-9 && skillAvailable(ctx, st, op, id, frame);
    });
  }
  if ("stacks" in cue) return inRange(st.stacks[cue.stacks.operator]?.[cue.stacks.stack] ?? 0, cue.stacks);
  if ("sp" in cue) return inRange(spAt(st, frame), cue.sp);
  if ("infliction" in cue) {
    const inf = st.enemy.infliction;
    const want = cue.infliction.element === undefined ? undefined : ELEMENTS[cue.infliction.element];
    const stacks = inf && inf.expiresAt > frame && (want === undefined || inf.element === want) ? inf.stacks : 0;
    return cue.infliction.atLeast === undefined && cue.infliction.below === undefined ? stacks > 0 : inRange(stacks, cue.infliction);
  }
  if ("status" in cue) {
    const s = cue.status;
    return st.enemy.statuses.some((x) => x.status === s && x.expiresAt > frame) || st.enemy.physical.some((x) => x.status === s && x.expiresAt > frame);
  }
  if ("vulnerable" in cue) return inRange(st.enemy.vulnerable && st.enemy.vulnerable.expiresAt > frame ? st.enemy.vulnerable.stacks : 0, cue.vulnerable);
  if ("staggered" in cue) return isStaggered(st, frame) === cue.staggered;
  if ("buff" in cue) return st.buffs.some((b) => b.id === cue.buff.buff && b.owner === cue.buff.operator && b.cast === undefined && activeAt(b, frame));
  if ("finalStrikes" in cue) return env.strikes >= cue.finalStrikes.atLeast;
  if ("since" in cue) {
    const last = env.lastPress.get(`${cue.since.operator}:${cue.since.cast}`);
    return last === undefined || frame - last >= cue.since.atLeast * FPS;
  }
  throw new EngineError(`unknown cue ${JSON.stringify(cue)}`);
}

/**
 * Plays a rule list (resolved: resolveRuleList) on the scenario's team over its whole fight (scenario.durationFrames;
 * its rotation is ignored). Frame by frame, the state advanced to the frame:
 *
 * 1. The opener's presses, in order, each at the first frame it can start (startsNow; no reaction delay: the player
 *    planned them), the controlled operator's basic attacks in between; a press that can't start within `waitSeconds`
 *    is given up. No rule is read before the opener is over.
 * 2. Then the rules, in order: a rule may fire once its cue has held for its reaction delay (drawn at the cue's onset,
 *    jittered, seeded) and its first press can start now; its later presses then play as the opener's do (each as soon
 *    as it can start, waiting for a combo's window, up to `waitSeconds`), no other rule meanwhile. A rule that fired
 *    sees its own cue afresh (a new delay) before it fires again. A rule whose cue holds but whose press can't start
 *    yet doesn't block the next ones.
 * 3. Else the controlled operator's basic attack (a finisher when the enemy is Staggered; the input's own mapping, e.g.
 *    Typhoeus's aerial attacks while she hovers), as soon as it can start.
 *
 * Several presses may start at one frame. Everything goes through `apply`, so the recorded rotation (absolute frames)
 * replays with `simulate` to the same hits.
 */
export function playRules(data: GameData, scenario: Omit<TimelineScenario, "rotation">, list: RuleList, options: PolicyOptions = {}): PolicyRun {
  const ctx = memoised(createContext(data, { ...scenario, rotation: [] }));
  const reaction = Math.round((options.reactionSeconds ?? POLICY_REACTION_SECONDS) * FPS);
  const jitter = options.jitter ?? POLICY_JITTER;
  const wait = Math.round((options.waitSeconds ?? POLICY_WAIT_SECONDS) * FPS);
  if (!(reaction >= 0) || !(jitter >= 0 && jitter <= 1) || !(wait > 0)) throw new EngineError("reaction delay ≥ 0, jitter 0–1, wait > 0");
  const seed = options.seed ?? scenario.options.seed ?? 1;
  if (options.stratify && !(Number.isInteger(options.stratify.samples) && options.stratify.samples >= 1)) throw new EngineError("stratify.samples must be a whole number ≥ 1");
  const delayKeys = ruleDelayKeys(list);
  const onsets = list.rules.map(() => 0);
  const drawDelay = (i: number) => {
    const k = onsets[i] as number;
    onsets[i] = k + 1;
    return reaction === 0 ? 0 : Math.max(0, Math.round(reaction * (1 + jitter * (2 * policyDelay(seed, delayKeys[i] as number, k, options.stratify) - 1))));
  };
  const end = scenario.durationFrames;
  const exact = options.judgeEveryFrame === true;
  const observer = options.observer;

  let st = init(ctx);
  const controlled = st.controlled;
  const buttonCache = new Map<string, readonly string[]>();
  const buttons = (s: PolicyStep) => {
    const key = `${s.operator}:${s.cast}`;
    let b = buttonCache.get(key);
    if (!b) buttonCache.set(key, (b = buttonSkills(ctx, s, controlled)));
    return b;
  };
  // Every press a list names is checked up front (an operator without that button fails loudly, not when first read).
  for (const s of [...list.opener, ...list.rules.flatMap(stepsOf)]) buttons(s);
  const strikeSkills = finalStrikes(ctx, controlled);

  const rotation: RotationAction[] = [];
  const fired = list.rules.map(() => 0);
  const givenUp: { frame: number; step: PolicyStep; rule: number | null }[] = [];
  const onset: (number | null)[] = list.rules.map(() => null);
  const readyAt: number[] = list.rules.map(() => 0);
  const strikesSince: number[] = list.rules.map(() => 0);
  const lastPress = new Map<string, number>();
  // Presses queued: the opener's, then a fired rule's later ones; each with the frame it started waiting.
  let queue: { step: PolicyStep; rule: number | null; since: number }[] = list.opener.map((step) => ({ step, rule: null, since: 0 }));
  let openerEnd = list.opener.length === 0 ? 0 : -1;

  // The state right after the last press. A press is applied to it (with its frame), as `simulate` replays the recorded
  // rotation, and may start only where earliestStart from it agrees: startsNow on the state advanced frame by frame can
  // allow a frame that earliestStart from the last press doesn't (a dive's landing replacing its jump; Typhoeus's
  // battle skill 48 frames sooner), and the replay would then cast it later.
  let pressed = st;
  const canPress = (a: RotationAction): boolean => {
    if (!startsNow(ctx, st, a)) return false;
    const e = earliestStart(ctx, pressed, { ...a, at: st.frame });
    return "frame" in e && e.frame === st.frame;
  };
  const press = (action: RotationAction, frame: number) => {
    st = apply(ctx, pressed, { ...action, at: frame });
    pressed = st;
    basicCache = null;
    rotation.push({ ...action, at: frame });
    if (action.operator === controlled && strikeSkills.has(action.skill)) for (let i = 0; i < strikesSince.length; i++) strikesSince[i] = (strikesSince[i] as number) + 1;
  };
  /** The press of a button that can start now (the first of its skills that can), or null. */
  const startable = (s: PolicyStep): RotationAction | null => {
    // A dive (a jump) only once the current skill is past its exclusive frames, as the search dives: the timeline lets a
    // jump cut anything, which the game doesn't check.
    if (s.cast === "dive" && exclusiveUntil(ctx, st, s.operator) > st.frame) return null;
    if (s.cast === "basic") return basicAttack(st.frame);
    if (s.cast === "finisher" && (!isStaggered(st, st.frame) || st.stagger.finisherUsed)) return null;
    for (const skill of buttons(s)) {
      const a = { operator: s.operator, skill };
      if (canPress(a)) return a;
    }
    return null;
  };
  // The basic attack's options and, per option, the earliest frame it can start (earliestStart from the state after the
  // last press: exact while nothing is pressed, so the frames before it needn't be judged), or "error" (then judged at
  // every frame). Judging every option at every frame was most of a run's time.
  let basicCache: { key: string; earliest: Map<string, number | "error"> } | null = null;
  const isFinisher = (skill: string) => ctx.data.skills[skill]?.timing?.specification === 8;
  const basicAttack = (frame: number): RotationAction | null => {
    if (st.controlled !== controlled) return null;
    const options = nextBasics(ctx.data, st, controlled);
    // A finisher first (the input on a Staggered enemy), then the chain's step, then the chain's heads (nextBasics' order).
    options.sort((x, y) => Number(isFinisher(y)) - Number(isFinisher(x)));
    const key = options.join(",");
    if (!basicCache || basicCache.key !== key) basicCache = { key, earliest: new Map() };
    for (const skill of options) {
      // A finisher only on a Staggered enemy whose finisher is unused (judged directly: the Stagger starts with a hit).
      if (isFinisher(skill) && (!isStaggered(st, frame) || st.stagger.finisherUsed)) continue;
      const a = { operator: controlled, skill };
      if (exact || isFinisher(skill)) {
        if (canPress(a)) return a;
        continue;
      }
      let e = basicCache.earliest.get(skill);
      if (e === undefined) {
        // Not available now (Typhoeus's aerial attacks on the ground): judged again at the next frame, cheaply.
        if (!skillAvailable(ctx, st, controlled, skill, frame)) continue;
        const r = earliestStart(ctx, st, a);
        basicCache.earliest.set(skill, (e = "error" in r ? "error" : r.frame));
      }
      // Can't start from here as things stand (its error may pass later as events happen): judged at every frame.
      if (e === "error") {
        if (canPress(a)) return a;
        continue;
      }
      if (frame < e) continue;
      if (canPress(a)) return a;
      basicCache.earliest.delete(skill);
    }
    return null;
  };
  const record = (s: PolicyStep, frame: number) => lastPress.set(`${s.operator}:${s.cast}`, frame);

  for (let frame = 0; frame <= end; frame++) {
    st = advance(ctx, st, frame);
    // What the player sees now: each rule's cue, its onset and the delay to it (watched during the opener too).
    for (let i = 0; i < list.rules.length; i++) {
      const env: CueEnv = { ctx, st, frame, buttons, strikes: strikesSince[i] as number, lastPress };
      if (cueHolds(env, (list.rules[i] as PolicyRule).when)) {
        if (onset[i] === null) {
          onset[i] = frame;
          readyAt[i] = frame + drawDelay(i);
        }
      } else onset[i] = null;
    }
    for (let n = 0; n < 8; n++) {
      let action: RotationAction | null = null;
      // The queue's head: pressed when it can start, given up after waiting too long; the next one waits from then.
      while (queue.length > 0 && action === null) {
        const head = queue[0] as (typeof queue)[number];
        action = startable(head.step);
        if (action) record(head.step, frame);
        else if (frame - head.since >= wait) givenUp.push({ frame, step: head.step, rule: head.rule });
        else break;
        queue = queue.slice(1).map((q, i) => (i === 0 ? { ...q, since: Math.max(q.since, frame) } : q));
      }
      if (openerEnd < 0 && queue.every((q) => q.rule !== null)) openerEnd = frame;
      if (action === null && queue.length === 0) {
        for (let i = 0; i < list.rules.length && action === null; i++) {
          if (onset[i] === null || frame < (readyAt[i] as number)) continue;
          const rule = list.rules[i] as PolicyRule;
          const [first, ...rest] = stepsOf(rule);
          action = startable(first as PolicyStep);
          if (action) {
            record(first as PolicyStep, frame);
            fired[i] = (fired[i] as number) + 1;
            onset[i] = frame;
            readyAt[i] = frame + 1 + drawDelay(i);
            strikesSince[i] = 0;
            queue = rest.map((step) => ({ step, rule: i, since: frame }));
          }
        }
      }
      action ??= list.filler === "dive" ? startable({ operator: controlled, cast: "dive" }) : basicAttack(frame);
      if (!action) break;
      press(action, frame);
    }
    if (observer) {
      const f = frame;
      observer.frame({
        ctx,
        st,
        frame: f,
        list,
        cueHolds: (cue) => cueHolds({ ctx, st, frame: f, buttons, strikes: Infinity, lastPress }, cue),
        ruleState: (i) => (onset[i] === null ? "off" : f < (readyAt[i] as number) ? "waiting" : "seen"),
        queued: queue.length > 0,
      });
    }
  }

  const perOperator: Record<string, number> = Object.fromEntries(scenario.team.map((b) => [b.operator, 0]));
  const byMinute: number[] = Array.from({ length: Math.max(1, Math.ceil(end / (60 * FPS))) }, () => 0);
  let total = 0;
  let first60 = 0;
  let after = 0;
  const from = Math.max(0, openerEnd);
  for (const h of st.hits) {
    total += h.exact;
    perOperator[h.operator] = (perOperator[h.operator] ?? 0) + h.exact;
    const m = Math.min(byMinute.length - 1, Math.floor(h.frame / (60 * FPS)));
    byMinute[m] = (byMinute[m] as number) + h.exact;
    if (h.frame <= 60 * FPS) first60 += h.exact;
    if (h.frame > from) after += h.exact;
  }
  const seconds = (end - from) / FPS;
  const sustainedMoments = end > from ? scaleMoments(hitsMoments(st.hits.filter((h) => h.frame > from)), 1 / seconds) : NO_DAMAGE;
  return { total, perOperator, byMinute, first60, openerEnd: from, sustainedDps: end > from ? after / seconds : 0, fired, givenUp, rotation, durationFrames: end, sustainedMoments };
}
