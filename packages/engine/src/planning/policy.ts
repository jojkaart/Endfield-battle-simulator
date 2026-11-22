// Rule-based rotations (docs/design/rules.md "Rule-based rotations"; the owner, 2026-11-16): a short opener and an ordered
// list of rules "when cue X is visible, do Y", played by a simulated player with a reaction delay on the same
// timeline the search and `simulate` use (init / advance / startsNow / apply). The driver never decides anything a
// player couldn't: rules read only what the game's UI shows (POLICY_CUE_RANKS), and the actions are button presses
// (an operator's battle skill, combo or ultimate, resolved to the skill the button casts then; the controlled
// operator's dive). The default action is the controlled operator's basic attack.

import { EngineError, FPS, hitsMoments, NO_DAMAGE, scaleMoments, diveOf, nextBasics, activeAt, advance, apply, buttonSkill, buttonSkills, canStartAt, createContext, earliestStart, exclusiveUntil, init, isStaggered, kitSkill, maxEnergy, maxPoise, memoised, needsWindow, nextChangeAfter, skillAvailable, skillCosts, skillSpGain, spAt, startsNow, windowKey, windowOpen, type GameData, type ArtsElement, type PhysicalStatus, type ReactionStatus, type DamageMoments, type RotationAction, type TimelineContext, type TimelineScenario, type TimelineState } from "../core.ts";

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
  /**
   * Only if the button shows this skill (its kit label, e.g. "Battle skill" rather than Liino's "End Stance"): when the
   * button shows another of its skills, the press is skipped (a rule's first press: the rule doesn't fire; a later
   * press: given up at once). The player planned that skill and doesn't press a button that changed under them.
   */
  readonly shows?: string;
}

export const POLICY_CASTS: readonly PolicyStep["cast"][] = ["battle", "combo", "ultimate", "dive", "basic", "finisher"];

/**
 * What a rule reads, all shown by the game's UI (the owner's ranking, 2026-11-16, POLICY_CUE_RANKS); `all` / `any` /
 * `not` combine them (a combination costs the sum of its parts).
 */
export type PolicyCue =
  /** Rank 1: the operator's combo skill is lit (off cooldown, its window open, available). */
  | { readonly combo: string }
  /** Rank 2: a stack the HUD shows (visibleStacks: Typhoeus's Hunting Arrows and Signs). */
  | { readonly stacks: { readonly operator: string; readonly stack: string; readonly atLeast?: number; readonly below?: number } }
  /** Rank 2: team SP (the bar's three segments of 100: "battle skills ready"). */
  | { readonly sp: { readonly atLeast?: number; readonly below?: number } }
  /** Rank 3: an Arts infliction on the enemy (any element, or one), with at least / below so many stacks. */
  | { readonly infliction: { readonly element?: string; readonly atLeast?: number; readonly below?: number } }
  /** Rank 3: a reaction or physical status on the enemy (solidification, corrosion, combustion, electrification; lift, knockdown, crush, breach). */
  | { readonly status: string }
  /** Rank 3: the enemy's Vulnerable stacks. */
  | { readonly vulnerable: { readonly atLeast?: number; readonly below?: number } }
  /**
   * Rank 3: a status on the enemy at a level (0 when it isn't on): a reaction's level is the infliction stacks it
   * consumed (1–4: Corrosion's strength, Electrification's), Breach's and Crush's the Vulnerable stacks; the player saw
   * the stacks go in and the status's icon shows it. "Corrosion at full strength" is `{ status: "corrosion", atLeast: 4 }`.
   * 2026-11-22.
   */
  | { readonly statusLevel: { readonly status: string; readonly atLeast?: number; readonly below?: number } }
  /** Rank 3: the enemy is Staggered (its bar shows it). */
  | { readonly staggered: boolean }
  /** Rank 3: how full the enemy's Stagger bar is, in percent (100 while it is Staggered). */
  | { readonly stagger: { readonly atLeast?: number; readonly below?: number } }
  /** Rank 3: an operator's state the game shows on the character or its skill button (visibleBuffs: Typhoeus hovering, …). */
  | { readonly buff: { readonly operator: string; readonly buff: string } }
  /** Rank 4: the operator's ultimate is ready (energy full, off cooldown, available). */
  | { readonly ultimate: string }
  /**
   * Rank 4: how many of the team's ultimates are ready at once (each as the `ultimate` cue reads it), the icons in the
   * same corner: "two or more ultimates lit" (a full-energy start, energy piling up). 2026-11-22.
   */
  | { readonly ultimates: { readonly atLeast?: number; readonly below?: number } }
  /**
   * Rank 5: how full an operator's ultimate gauge is, in percent of its ultimate's cost (its icon fills as energy comes;
   * 100 when full, whether or not the ultimate can be cast): reading a partial gauge takes practice. 2026-11-22.
   */
  | { readonly energy: { readonly operator: string; readonly atLeast?: number; readonly below?: number } }
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
  /** The rule set it belongs to (RuleList.sets): it is read only while that set's condition holds. None: always read. */
  readonly set?: string;
}

/**
 * A conditional rule set (docs/design/rules.md "Rule sets", the owner 2026-11-22: "sets of rules that are conditionally
 * active", e.g. one while Corrosion is up at full strength and one while it isn't): its rules (those naming it in
 * `set`) are read only while `when` holds, a cue of the same language the player watches. Its condition counts once in
 * the list's learnability, however many rules it has.
 */
export interface RuleSet {
  readonly name: string;
  readonly when: PolicyCue;
  readonly note?: string;
}

export interface RuleList {
  readonly description?: string;
  /** A few presses at the fight's start, each as soon as it can start, before any rule is read. */
  readonly opener: readonly PolicyStep[];
  /**
   * Ordered: at each moment the first rule whose cue the player has seen (after the reaction delay) and whose first
   * press can start fires. A rule of a set (PolicyRule.set) is in this one order too, read only while its set is active:
   * one priority list with lines that apply only in a phase.
   */
  readonly rules: readonly PolicyRule[];
  /** The conditional rule sets its rules may name (none: every rule is always read; a list without sets is the always-active set alone). */
  readonly sets?: readonly RuleSet[];
  /**
   * What the controlled operator does when no rule fires: its basic attacks (default) or dives (jump attacks, each once
   * the current skill is past its exclusive frames).
   */
  readonly filler?: "basic" | "dive";
}

/**
 * The owner's ranking of cues, easiest first (2026-11-16; docs/design/rules.md "Rule-based rotations"): 1 a combo lighting
 * up, 2 Typhoeus's arrows and Signs, SP, 3 the enemy's inflictions and statuses, 4 an ultimate ready (corner of the
 * screen), 5 counting Final Strikes, 6 a combo's cooldown, 7 a timer in the head.
 */
export const POLICY_CUE_RANKS = { combo: 1, stacks: 2, sp: 2, infliction: 3, status: 3, vulnerable: 3, staggered: 3, stagger: 3, buff: 3, statusLevel: 3, ultimate: 4, ultimates: 4, energy: 5, finalStrikes: 5, comboCooldown: 6, since: 7 } as const;

/** What a cue of each rank costs to learn and watch: the rank itself up to 3, steeper after; a timer counts heavily (owner: "avoid, or count heavily against"). */
export const POLICY_RANK_COST: Readonly<Record<number, number>> = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 6, 6: 7, 7: 20 };

/**
 * The stacks of an operator's kit the game's HUD shows (StackDef.visible: Typhoeus's Hunting Arrows and Signs, "very
 * easy", the owner 2026-11-16), in kit order; rules may read no others.
 */
export function visibleStacks(data: GameData, operator: string): readonly string[] {
  return (data.kits.operators[operator]?.stacks ?? []).filter((x) => x.visible !== undefined).map((x) => x.id);
}

/**
 * The buffs of an operator's kit a player sees without reading buff icons (KitBuff.visible, each with how it shows:
 * Typhoeus hovering, Laevatain's Twilight, Liino's stances, Si's Artful Intent and Inksoul), in kit order; rules may
 * read no others.
 */
export function visibleBuffs(data: GameData, operator: string): readonly string[] {
  return (data.kits.operators[operator]?.buffs ?? []).filter((x) => x.visible !== undefined).map((x) => x.id);
}

/** Every visible stack and buff of a team, by operator (for error messages). */
function visibleList(data: GameData, team: readonly string[], of: (data: GameData, op: string) => readonly string[]): string {
  return JSON.stringify(Object.fromEntries(team.flatMap((op) => (of(data, op).length ? [[op, of(data, op)]] : []))));
}

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
  // Each set's condition counts once (the player watches it as the phase, not per rule), when a rule uses the set.
  const used = new Set(list.rules.flatMap((r) => (r.set === undefined ? [] : [r.set])));
  const costs = [...list.rules.map((r) => cueCost(r.when)), ...(list.sets ?? []).filter((x) => used.has(x.name)).map((x) => cueCost(x.when))];
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
  const base = `${data.operators[s.operator]?.name ?? s.operator}'s ${CAST_NAMES[s.cast]}`;
  return s.shows === undefined ? base : `${base} (only if it shows ${s.shows})`;
}

function buffWords(data: GameData, b: { readonly operator: string; readonly buff: string }, on: boolean): string {
  const v = data.kits.operators[b.operator]?.buffs.find((x) => x.id === b.buff)?.visible;
  return `${data.operators[b.operator]?.name ?? b.operator} ${v ? (on ? v.on : v.off) : on ? `has ${b.buff} up` : `hasn't ${b.buff} up`}`;
}

/** A cue as the player would say it ("Arcane's combo lights up"). */
export function describeCue(data: GameData, cue: PolicyCue): string {
  const name = (op: string) => data.operators[op]?.name ?? op;
  if ("all" in cue) return cue.all.map((c) => describeCue(data, c)).join(" and ");
  if ("any" in cue) return cue.any.map((c) => describeCue(data, c)).join(" or ");
  if ("not" in cue) {
    if ("buff" in cue.not) return buffWords(data, cue.not.buff, false);
    if ("staggered" in cue.not) return describeCue(data, { staggered: !cue.not.staggered });
    if ("statusLevel" in cue.not && cue.not.statusLevel.below === undefined && cue.not.statusLevel.atLeast !== undefined) return describeCue(data, { statusLevel: { status: cue.not.statusLevel.status, below: cue.not.statusLevel.atLeast } });
    if ("status" in cue.not) return `the enemy hasn't ${cue.not.status[0]?.toUpperCase()}${cue.not.status.slice(1)}`;
    return `not (${describeCue(data, cue.not)})`;
  }
  if ("combo" in cue) return `${name(cue.combo)}'s combo lights up`;
  if ("ultimate" in cue) return `${name(cue.ultimate)}'s ultimate is ready`;
  if ("ultimates" in cue) {
    const r = cue.ultimates;
    if (r.below === undefined) return `${r.atLeast} or more ultimates are ready`;
    if (r.atLeast === undefined) return r.below === 1 ? "no ultimate is ready" : `fewer than ${r.below} ultimates are ready`;
    return `${rangeWords(r)} ultimates are ready`;
  }
  if ("energy" in cue) return `${name(cue.energy.operator)}'s ultimate gauge is ${rangeWords(cue.energy)}% full`;
  if ("comboCooldown" in cue) return `${name(cue.comboCooldown)}'s combo is off cooldown`;
  if ("stacks" in cue) return `${name(cue.stacks.operator)}'s ${data.kits.operators[cue.stacks.operator]?.stacks?.find((s) => s.id === cue.stacks.stack)?.label ?? cue.stacks.stack}: ${rangeWords(cue.stacks)}`;
  if ("sp" in cue) return `SP ${rangeWords(cue.sp)}`;
  if ("infliction" in cue) {
    const el = cue.infliction.element === undefined ? "an Arts" : `a ${ELEMENT_NAMES[ELEMENTS[cue.infliction.element] as ArtsElement]}`;
    return cue.infliction.atLeast === undefined && cue.infliction.below === undefined ? `the enemy has ${el} infliction` : `the enemy has ${el} infliction, ${rangeWords(cue.infliction)} stacks`;
  }
  if ("status" in cue) return `the enemy has ${cue.status[0]?.toUpperCase()}${cue.status.slice(1)}`;
  if ("statusLevel" in cue) {
    const n = `${cue.statusLevel.status[0]?.toUpperCase()}${cue.statusLevel.status.slice(1)}`;
    const r = cue.statusLevel;
    if (r.atLeast !== undefined && r.below === undefined) return r.atLeast <= 1 ? `the enemy has ${n}` : `the enemy has ${n} at level ${r.atLeast} or more`;
    if (r.atLeast === undefined && r.below !== undefined) return r.below <= 1 ? `the enemy hasn't ${n}` : `the enemy hasn't ${n} at level ${r.below} or more`;
    return `the enemy has ${n} at level ${rangeWords(r)}`;
  }
  if ("vulnerable" in cue) return `the enemy's Vulnerable stacks ${rangeWords(cue.vulnerable)}`;
  if ("staggered" in cue) return cue.staggered ? "the enemy is Staggered" : "the enemy isn't Staggered";
  if ("stagger" in cue) return `the enemy's Stagger bar is ${rangeWords(cue.stagger)}% full`;
  if ("buff" in cue) return buffWords(data, cue.buff, true);
  if ("finalStrikes" in cue) return `${cue.finalStrikes.atLeast} Final Strike${cue.finalStrikes.atLeast === 1 ? "" : "s"} since this rule last fired`;
  if ("since" in cue) return `${cue.since.atLeast} s since ${name(cue.since.operator)}'s last ${CAST_NAMES[cue.since.cast]}`;
  return JSON.stringify(cue);
}

/** A rule as the player would say it ("When Arcane's combo lights up: Estella's battle skill, then Arcane's combo"); a rule of a set says its set's condition first. */
export function describeRule(data: GameData, r: PolicyRule, sets?: readonly RuleSet[]): string {
  const when = describeCue(data, r.when);
  const set = r.set === undefined ? undefined : sets?.find((x) => x.name === r.set);
  const phase = r.set === undefined ? "" : `[${r.set}${set ? `: while ${describeCue(data, set.when)}` : ""}] `;
  return `${phase}When ${when}: ${stepsOf(r).map((s) => describeStep(data, s)).join(", then ")}`;
}

/**
 * The list as the driver reads it: each rule of a set with its set's condition joined to its cue (all of both), in the
 * list's order, the sets dropped. A flat list is itself. Rule i of the result is rule i of the list.
 */
export function effectiveRules(list: RuleList): RuleList {
  if (!list.sets?.length && !list.rules.some((r) => r.set !== undefined)) return list;
  const cond = new Map((list.sets ?? []).map((x) => [x.name, x.when]));
  const { sets: _s, ...rest } = list;
  return {
    ...rest,
    rules: list.rules.map(({ set, ...r }) => {
      if (set === undefined) return r;
      const c = cond.get(set);
      if (c === undefined) throw new EngineError(`a rule names the set ${set}, which the list doesn't define`);
      return { ...r, when: { all: [c, ...("all" in r.when ? r.when.all : [r.when])] } };
    }),
  };
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
    const operator = opId(s.operator, where);
    if (s.shows !== undefined) {
      const kinds: Record<string, string> = { battle: "battle", combo: "combo", ultimate: "ultimate" };
      const labels = (data.kits.operators[operator]?.skills ?? []).filter((k) => k.kind === kinds[s.cast] && !k.followUpOnly).map((k) => k.label ?? k.skillId);
      if (!labels.includes(s.shows)) throw new EngineError(`${where}: ${operator}'s ${s.cast} button never shows "${s.shows}" (it shows: ${labels.join(", ") || "nothing"})`);
      return { operator, cast: s.cast, shows: s.shows };
    }
    return { operator, cast: s.cast };
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
    if ("ultimates" in c) {
      range(c.ultimates, where);
      for (const v of [c.ultimates.atLeast, c.ultimates.below]) if (v !== undefined && !(Number.isInteger(v) && v >= 0 && v <= team.length + 1)) throw new EngineError(`${where}: a count of ultimates is a whole number from 0 to ${team.length + 1}`);
      return c;
    }
    if ("energy" in c) {
      const op = opId(c.energy.operator, where);
      range(c.energy, where);
      for (const v of [c.energy.atLeast, c.energy.below]) if (v !== undefined && !(v >= 0 && v <= 101)) throw new EngineError(`${where}: an ultimate gauge is 0 to 100 (%)`);
      return { energy: { ...c.energy, operator: op } };
    }
    if ("comboCooldown" in c) return { comboCooldown: opId(c.comboCooldown, where) };
    if ("stacks" in c) {
      const op = opId(c.stacks.operator, where);
      if (!visibleStacks(data, op).includes(c.stacks.stack)) throw new EngineError(`${where}: ${op}'s ${c.stacks.stack} isn't a stack the HUD shows (shown: ${visibleList(data, team, visibleStacks)})`);
      range(c.stacks, where);
      return { stacks: { ...c.stacks, operator: op } };
    }
    if ("sp" in c) return range(c.sp, where), c;
    if ("vulnerable" in c) return range(c.vulnerable, where), c;
    if ("statusLevel" in c) {
      if (![...REACTIONS, ...PHYSICALS].includes(c.statusLevel.status as ReactionStatus)) throw new EngineError(`${where}: unknown status ${c.statusLevel.status} (${[...REACTIONS, ...PHYSICALS].join(", ")})`);
      range(c.statusLevel, where);
      return c;
    }
    if ("infliction" in c) {
      if (c.infliction.element !== undefined && !(c.infliction.element in ELEMENTS)) throw new EngineError(`${where}: unknown element ${c.infliction.element} (heat, electric, cryo, nature)`);
      return c;
    }
    if ("status" in c) {
      if (![...REACTIONS, ...PHYSICALS].includes(c.status as ReactionStatus)) throw new EngineError(`${where}: unknown status ${c.status} (${[...REACTIONS, ...PHYSICALS].join(", ")})`);
      return c;
    }
    if ("staggered" in c) return c;
    if ("stagger" in c) {
      range(c.stagger, where);
      for (const v of [c.stagger.atLeast, c.stagger.below]) if (v !== undefined && !(v >= 0 && v <= 100)) throw new EngineError(`${where}: the Stagger bar is 0 to 100 (%)`);
      return c;
    }
    if ("buff" in c) {
      const op = opId(c.buff.operator, where);
      if (!visibleBuffs(data, op).includes(c.buff.buff)) throw new EngineError(`${where}: ${op}'s ${c.buff.buff} isn't a state the game shows without buff icons (shown: ${visibleList(data, team, visibleBuffs)})`);
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
  const names = new Set<string>();
  const sets = (list.sets ?? []).map((x, i) => {
    if (!x.name || names.has(x.name)) throw new EngineError(`sets[${i}]: each set has a name of its own (${x.name || "none"})`);
    names.add(x.name);
    return { name: x.name, when: cue(x.when, `sets[${i}].when`), ...(x.note !== undefined ? { note: x.note } : {}) };
  });
  return {
    ...(list.description !== undefined ? { description: list.description } : {}),
    ...(list.filler !== undefined ? { filler: list.filler } : {}),
    opener: list.opener.map((s, i) => step(s, `opener[${i}]`)),
    rules: list.rules.map((r, i) => {
      const steps = stepsOf(r);
      if (steps.length < 1 || steps.length > 3) throw new EngineError(`rules[${i}]: do has 1 to 3 presses, not ${steps.length}`);
      if (r.set !== undefined && !names.has(r.set)) throw new EngineError(`rules[${i}]: set ${r.set} isn't one of the list's sets (${[...names].join(", ") || "none"})`);
      return { when: cue(r.when, `rules[${i}].when`), do: steps.map((s, j) => step(s, `rules[${i}].do[${j}]`)), ...(r.note !== undefined ? { note: r.note } : {}), ...(r.set !== undefined ? { set: r.set } : {}) };
    }),
    ...(sets.length ? { sets } : {}),
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
  /** Watches the run frame by frame (the rules' diagnosis: policydiag.ts); never changes it. */
  readonly observer?: PolicyObserver;
  /** A press of the opener or of a rule's sequence that can't start within this many seconds is given up (default 6). */
  readonly waitSeconds?: number;
  /** Judge the basic attack's options at every frame visited instead of from their earliest start (a check of that shortcut; slower). */
  readonly judgeEveryFrame?: boolean;
  /**
   * `events` (default): the driver visits only the frames where something it reads can change (playRules' nextWake);
   * `frames`: every frame, the reference the event stepping is checked against (the same run; slower).
   */
  readonly stepping?: "events" | "frames";
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
  /** For each press of `rotation`, the list's step that made it (null: the filler) and its rule (null: the opener or the filler). */
  readonly presses: readonly { readonly step: PolicyStep | null; readonly rule: number | null }[];
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

/**
 * Watches a rule run; never changes it. Each hook is optional: `frame` sees every frame visited (the diagnosis:
 * policydiag.ts), `check` every start check the driver makes and its answer (why a press started where it did, or
 * didn't: a disagreement between the shortcut and the reference shows without instrumenting the engine), `press`
 * every press made.
 */
export interface PolicyObserver {
  readonly frame?: (view: PolicyFrameView) => void;
  readonly check?: (check: PolicyStartCheck) => void;
  readonly press?: (action: RotationAction, frame: number, step: PolicyStep | null, rule: number | null) => void;
}

/** One start check of the rule driver (PolicyObserver.check). */
export interface PolicyStartCheck {
  readonly action: RotationAction;
  readonly frame: number;
  /** startsNow on the read state; canStartAt from the last press (the `frames` stepping); earliestStart for a basic attack's option. */
  readonly how: "startsNow" | "canStartAt" | "earliestStart";
  /** startsNow / canStartAt: whether it can start at `frame`; earliestStart: the earliest frame, or "error". */
  readonly result: boolean | number | "error";
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
 * (seed, the rule's key, k) only. (Stratified draws across seeds, a Latin hypercube per rule onset, were measured on
 * the owner's team, 2026-11-16: no clear drop in the spread of a 5-seed mean or of a difference, so not kept.)
 */
export function policyDelay(seed: number, key: number, k: number): number {
  return keyedUniform(seed, key, k);
}

/** Checks a step against the team: the controlled operator's own inputs, and an operator with that button in its kit. */
function checkStep(ctx: TimelineContext, step: PolicyStep, controlled: string): void {
  const own = step.cast === "dive" || step.cast === "basic" || step.cast === "finisher";
  if (own && step.operator !== controlled) throw new EngineError(`a ${step.cast} is the controlled operator's (${controlled}), not ${step.operator}'s`);
  if (step.cast === "dive" && diveOf(ctx.data, step.operator) === undefined) throw new EngineError(`${step.operator} has no dive in its kit`);
  if (step.cast === "finisher" && finishers(ctx, step.operator).length === 0) throw new EngineError(`${step.operator} has no finisher in its kit`);
  if ((step.cast === "battle" || step.cast === "combo" || step.cast === "ultimate") && buttonSkills(ctx, step.operator, step.cast).length === 0) throw new EngineError(`${step.operator} has no ${step.cast} skill`);
}

/** An operator's finishers (basic attacks of skillSpecification 8: the attack input on a Staggered enemy). */
function finishers(ctx: TimelineContext, operator: string): readonly string[] {
  return (ctx.kits.get(operator)?.skills ?? []).filter((s) => s.kind === "basic" && ctx.data.skills[s.skillId]?.timing?.specification === 8).map((s) => s.skillId);
}

/** The controlled operator's Final Strikes: its basic-chain steps that give SP (the chain's last, `atb`). */
function finalStrikes(ctx: TimelineContext, operator: string): ReadonlySet<string> {
  return new Set((ctx.kits.get(operator)?.skills ?? []).filter((s) => s.kind === "basic" && ctx.data.skills[s.skillId]?.timing?.specification === 1 && skillSpGain(ctx, operator, s.skillId) > 0).map((s) => s.skillId));
}

interface CueEnv {
  readonly ctx: TimelineContext;
  readonly st: TimelineState;
  readonly frame: number;
  /** The controlled operator's Final Strikes since the rule last fired. */
  readonly strikes: number;
  readonly lastPress: ReadonlyMap<string, number>;
}

const inRange = (x: number, r: { readonly atLeast?: number; readonly below?: number }) => (r.atLeast === undefined || x >= r.atLeast) && (r.below === undefined || x < r.below);

/** The operator's combo button is lit: the skill it shows (buttonSkill) is off cooldown and, `needWindow`, its window open. */
function comboLit(env: CueEnv, op: string, needWindow: boolean): boolean {
  const { ctx, st, frame } = env;
  const id = buttonSkill(ctx, st, op, "combo", frame);
  if (id === null || (st.readyAt[id] ?? 0) > frame) return false;
  return !needWindow || !needsWindow(ctx, op, kitSkill(ctx, op, id)) || windowOpen(st, op, windowKey(ctx, op, id), frame);
}

/** The operator's ultimate is ready: the skill its button shows off cooldown, its energy full (the `ultimate` cue). */
function ultimateReady(env: CueEnv, op: string): boolean {
  const { ctx, st, frame } = env;
  const id = buttonSkill(ctx, st, op, "ultimate", frame);
  if (id === null || (st.readyAt[id] ?? 0) > frame) return false;
  const cost = skillCosts(ctx, op, id, frame).energyCost;
  return (st.energy[op] ?? 0) >= Math.min(cost, maxEnergy(ctx, op)) - 1e-9;
}

function cueHolds(env: CueEnv, cue: PolicyCue): boolean {
  const { ctx, st, frame } = env;
  if ("all" in cue) return cue.all.every((c) => cueHolds(env, c));
  if ("any" in cue) return cue.any.some((c) => cueHolds(env, c));
  if ("not" in cue) return !cueHolds(env, cue.not);
  if ("combo" in cue) return comboLit(env, cue.combo, true);
  if ("comboCooldown" in cue) return comboLit(env, cue.comboCooldown, false);
  if ("ultimate" in cue) return ultimateReady(env, cue.ultimate);
  if ("ultimates" in cue) return inRange(ctx.scenario.team.filter((b) => ultimateReady(env, b.operator)).length, cue.ultimates);
  if ("energy" in cue) {
    const max = maxEnergy(ctx, cue.energy.operator);
    // Percent of the gauge, snapped to a hundredth of a percent (energy comes in fractions: no 49.99999 at a half).
    const full = max > 0 ? Math.round((10000 * (st.energy[cue.energy.operator] ?? 0)) / max) / 100 : 0;
    return inRange(full, cue.energy);
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
  if ("statusLevel" in cue) {
    const x = cue.statusLevel.status;
    const on = [...st.enemy.statuses, ...st.enemy.physical].find((y) => y.status === x && y.expiresAt > frame);
    return inRange(on ? on.level : 0, cue.statusLevel);
  }
  if ("staggered" in cue) return isStaggered(st, frame) === cue.staggered;
  if ("stagger" in cue) {
    const max = maxPoise(ctx);
    const full = isStaggered(st, frame) || max <= 0 ? 100 : (100 * (max - st.stagger.poise)) / max;
    return inRange(full, cue.stagger);
  }
  if ("buff" in cue) return st.buffs.some((b) => b.id === cue.buff.buff && b.owner === cue.buff.operator && b.cast === undefined && activeAt(b, frame));
  if ("finalStrikes" in cue) return env.strikes >= cue.finalStrikes.atLeast;
  if ("since" in cue) {
    const last = env.lastPress.get(`${cue.since.operator}:${cue.since.cast}`);
    return last === undefined || frame - last >= cue.since.atLeast * FPS;
  }
  throw new EngineError(`unknown cue ${JSON.stringify(cue)}`);
}

/** Every SP level a list's cues compare with, and every `since` timer (operator:cast → seconds): what changes a cue with time alone. */
function cueClocks(list: RuleList): { readonly sp: readonly number[]; readonly since: readonly { readonly key: string; readonly frames: number }[] } {
  const sp = new Set<number>();
  const since: { key: string; frames: number }[] = [];
  const walk = (c: PolicyCue): void => {
    if ("all" in c) return c.all.forEach(walk);
    if ("any" in c) return c.any.forEach(walk);
    if ("not" in c) return walk(c.not);
    if ("sp" in c) for (const v of [c.sp.atLeast, c.sp.below]) if (v !== undefined) sp.add(v);
    if ("since" in c) since.push({ key: `${c.since.operator}:${c.since.cast}`, frames: c.since.atLeast * FPS });
  };
  for (const r of list.rules) walk(r.when);
  return { sp: [...sp], since };
}

/**
 * Plays a rule list (resolved: resolveRuleList) on the scenario's team over its whole fight (scenario.durationFrames;
 * its rotation is ignored). At each frame, on the state after the last press advanced to it:
 *
 * 1. The opener's presses, in order, each at the first frame it can start (canStartAt; no reaction delay: the player
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
 * A press of a button casts the skill the button shows then (buttonSkill), or nothing. Several presses may start at one
 * frame. Everything goes through `apply`, so the recorded rotation (absolute frames) replays with `simulate` to the same
 * hits. The driver visits only the frames where something can change (stepping `events`, the default; module comment
 * at nextWake); `frames` visits every frame and gives the same run (tests/policy.test.ts).
 */
export function playRules(data: GameData, scenario: Omit<TimelineScenario, "rotation">, given: RuleList, options: PolicyOptions = {}): PolicyRun {
  // A rule of a set is read with its set's condition (effectiveRules); rule i is still the list's rule i.
  const list = effectiveRules(given);
  const ctx = memoised(createContext(data, { ...scenario, rotation: [] }));
  const reaction = Math.round((options.reactionSeconds ?? POLICY_REACTION_SECONDS) * FPS);
  const jitter = options.jitter ?? POLICY_JITTER;
  const wait = Math.round((options.waitSeconds ?? POLICY_WAIT_SECONDS) * FPS);
  if (!(reaction >= 0) || !(jitter >= 0 && jitter <= 1) || !(wait > 0)) throw new EngineError("reaction delay ≥ 0, jitter 0–1, wait > 0");
  const seed = options.seed ?? scenario.options.seed ?? 1;
  const delayKeys = ruleDelayKeys(list);
  const onsets = list.rules.map(() => 0);
  const drawDelay = (i: number) => {
    const k = onsets[i] as number;
    onsets[i] = k + 1;
    return reaction === 0 ? 0 : Math.max(0, Math.round(reaction * (1 + jitter * (2 * policyDelay(seed, delayKeys[i] as number, k) - 1))));
  };
  const end = scenario.durationFrames;
  const exact = options.judgeEveryFrame === true;
  const everyFrame = options.stepping === "frames";
  const observer = options.observer;

  // The state right after the last press, and the state the driver reads at the current frame: that one advanced to
  // the frame (right after a press, at the press's frame, the same). Every press is applied to the first with its frame,
  // as `simulate` replays the recorded rotation, and may start only where canStartAt allows, which is what apply then
  // does (earliestStart judges an `at` on the state then). The event stepping advances the read state from the frame it
  // last visited (the same state: advance runs what's due in order, and SP doesn't depend on the steps: spAt) and asks
  // startsNow on it; the `frames` stepping, the reference, advances from the last press at every frame and asks
  // canStartAt.
  let pressed = init(ctx);
  let st = pressed;
  const stateAt = (f: number): TimelineState => {
    if (everyFrame) return f === pressed.frame ? pressed : advance(ctx, pressed, f);
    return f === st.frame ? st : advance(ctx, st, f);
  };
  const controlled = st.controlled;
  // Every press a list names is checked up front (an operator without that button fails loudly, not when first read).
  for (const s of [...list.opener, ...list.rules.flatMap(stepsOf)]) checkStep(ctx, s, controlled);
  const strikeSkills = finalStrikes(ctx, controlled);
  const clocks = cueClocks(list);

  const rotation: RotationAction[] = [];
  const presses: { step: PolicyStep | null; rule: number | null }[] = [];
  const fired = list.rules.map(() => 0);
  const givenUp: { frame: number; step: PolicyStep; rule: number | null }[] = [];
  const onset: (number | null)[] = list.rules.map(() => null);
  const readyAt: number[] = list.rules.map(() => 0);
  const strikesSince: number[] = list.rules.map(() => 0);
  const lastPress = new Map<string, number>();
  // Presses queued: the opener's, then a fired rule's later ones; each with the frame it started waiting.
  let queue: { step: PolicyStep; rule: number | null; since: number }[] = list.opener.map((step) => ({ step, rule: null, since: 0 }));
  let openerEnd = list.opener.length === 0 ? 0 : -1;

  const checkHook = observer?.check;
  const canPress = (a: RotationAction): boolean => {
    const ok = everyFrame ? canStartAt(ctx, pressed, a, st.frame) : startsNow(ctx, st, a);
    if (checkHook) checkHook({ action: a, frame: st.frame, how: everyFrame ? "canStartAt" : "startsNow", result: ok });
    return ok;
  };
  const press = (action: RotationAction, frame: number, step: PolicyStep | null, rule: number | null) => {
    observer?.press?.(action, frame, step, rule);
    st = apply(ctx, pressed, { ...action, at: frame });
    pressed = st;
    basicCache = null;
    rotation.push({ ...action, at: frame });
    presses.push({ step, rule });
    if (action.operator === controlled && strikeSkills.has(action.skill)) for (let i = 0; i < strikesSince.length; i++) strikesSince[i] = (strikesSince[i] as number) + 1;
  };
  const labelOf = (op: string, skill: string) => ctx.kits.get(op)?.skills.find((k) => k.skillId === skill)?.label ?? skill;
  /** The press of a step that can start now, null, or "skip" (its button shows another skill than `shows`). */
  const startable = (s: PolicyStep): RotationAction | null | "skip" => {
    // A dive (a jump) only once the current skill is past its exclusive frames, as the search dives: the timeline lets a
    // jump cut anything, which the game doesn't check.
    if (s.cast === "dive") {
      if (exclusiveUntil(ctx, st, s.operator) > st.frame) return null;
      const a = { operator: s.operator, skill: diveOf(ctx.data, s.operator) as string };
      return canPress(a) ? a : null;
    }
    if (s.cast === "basic") return basicAttack(st.frame);
    if (s.cast === "finisher") {
      if (!isStaggered(st, st.frame) || st.stagger.finisherUsed) return null;
      for (const skill of finishers(ctx, s.operator)) if (canPress({ operator: s.operator, skill })) return { operator: s.operator, skill };
      return null;
    }
    // The skill the button shows now; with `shows`, only that one (the player doesn't press a button that changed).
    const skill = buttonSkill(ctx, st, s.operator, s.cast, st.frame);
    if (skill === null) return null;
    if (s.shows !== undefined && labelOf(s.operator, skill) !== s.shows) return "skip";
    const a = { operator: s.operator, skill };
    return canPress(a) ? a : null;
  };
  // The basic attack's options and, per option, the earliest frame it can start (earliestStart from the state then: a
  // lower bound while nothing is pressed, so the frames before it needn't be judged), or "error" (judged at each frame
  // the driver visits). Judging every option at every frame was most of a run's time.
  let basicCache: { key: string; earliest: Map<string, number | "error"> } | null = null;
  const isFinisher = (skill: string) => ctx.data.skills[skill]?.timing?.specification === 8;
  const basicOptions = (): string[] => {
    const options = nextBasics(ctx.data, st, controlled);
    // A finisher first (the input on a Staggered enemy), then the chain's step, then the chain's heads (nextBasics' order).
    options.sort((x, y) => Number(isFinisher(y)) - Number(isFinisher(x)));
    const key = options.join(",");
    if (!basicCache || basicCache.key !== key) basicCache = { key, earliest: new Map() };
    return options;
  };
  const basicAttack = (frame: number): RotationAction | null => {
    if (st.controlled !== controlled) return null;
    const options = basicOptions();
    const cache = basicCache as NonNullable<typeof basicCache>;
    for (const skill of options) {
      // A finisher only on a Staggered enemy whose finisher is unused (judged directly: the Stagger starts with a hit).
      if (isFinisher(skill) && (!isStaggered(st, frame) || st.stagger.finisherUsed)) continue;
      const a = { operator: controlled, skill };
      if (exact || isFinisher(skill)) {
        if (canPress(a)) return a;
        continue;
      }
      let e = cache.earliest.get(skill);
      if (e === undefined) {
        // Not available now (Typhoeus's aerial attacks on the ground): judged again at the next frame visited, cheaply.
        if (!skillAvailable(ctx, st, controlled, skill, frame)) continue;
        const r = earliestStart(ctx, st, a);
        cache.earliest.set(skill, (e = "error" in r ? "error" : r.frame));
        if (checkHook) checkHook({ action: a, frame, how: "earliestStart", result: e });
      }
      // Can't start from here as things stand (its error may pass later as events happen): judged at each frame visited.
      if (e === "error") {
        if (canPress(a)) return a;
        continue;
      }
      if (frame < e) continue;
      if (canPress(a)) return a;
      cache.earliest.delete(skill);
    }
    return null;
  };
  const record = (s: PolicyStep, frame: number) => lastPress.set(`${s.operator}:${s.cast}`, frame);

  // The next frame anything the driver reads can change, after `frame` (its presses made): the frame-by-frame driver
  // would do the same at every frame in between. The state changes only as something scheduled comes due (hits,
  // actions, the enemy's, teammates' own attacks, buffs' ticks and ends: nextEventAfter; one at this frame a press
  // scheduled runs at the next). Between those, what the cues and the start checks (startsNow's gates) read changes
  // with time alone, at times the state holds: buffs' starts and ends, the enemy's states' ends, Stagger's end,
  // cooldowns, combo and chain windows, the current actions' frames (end, exclusive frame, windows, channels), a detached
  // hit's launch, SP reaching a level a cue or a skill's cost names; and the driver's own clocks: a rule's reaction
  // delay, the queue's wait, a `since` timer. Visiting a frame early is harmless; missing one would change the run, which
  // the `frames` stepping checks (tests/policy.test.ts).
  const nextWake = (frame: number): number => {
    let w = nextChangeAfter(ctx, st, frame, end, clocks.sp);
    const mark = (g: number | undefined) => {
      if (g !== undefined && g > frame && g < w) w = g;
    };
    for (const c of clocks.since) {
      const last = lastPress.get(c.key);
      if (last !== undefined) mark(Math.ceil(last + c.frames));
    }
    for (let i = 0; i < list.rules.length; i++) if (onset[i] !== null) mark(readyAt[i]);
    if (queue.length > 0) mark((queue[0] as (typeof queue)[number]).since + wait);
    return w;
  };
  const observe = (f: number) => {
    if (!observer?.frame) return;
    const view = f === st.frame ? st : stateAt(f);
    observer.frame({
      ctx,
      st: view,
      frame: f,
      list,
      cueHolds: (cue) => cueHolds({ ctx, st: view, frame: f, strikes: Infinity, lastPress }, cue),
      ruleState: (i) => (onset[i] === null ? "off" : f < (readyAt[i] as number) ? "waiting" : "seen"),
      queued: queue.length > 0,
    });
  };

  for (let frame = 0; frame <= end; ) {
    st = stateAt(frame);
    // What the player sees now: each rule's cue, its onset and the delay to it (watched during the opener too).
    for (let i = 0; i < list.rules.length; i++) {
      const env: CueEnv = { ctx, st, frame, strikes: strikesSince[i] as number, lastPress };
      if (cueHolds(env, (list.rules[i] as PolicyRule).when)) {
        if (onset[i] === null) {
          onset[i] = frame;
          readyAt[i] = frame + drawDelay(i);
        }
      } else onset[i] = null;
    }
    // A press changes what the cues read: they are read again at the next frame (as the frame-by-frame driver does).
    let pressedNow = false;
    for (let n = 0; n < 8; n++) {
      let action: RotationAction | null = null;
      let by: { step: PolicyStep | null; rule: number | null } = { step: null, rule: null };
      // The queue's head: pressed when it can start, given up after waiting too long; the next one waits from then.
      while (queue.length > 0 && action === null) {
        const head = queue[0] as (typeof queue)[number];
        const next = startable(head.step);
        action = next === "skip" ? null : next;
        if (action) {
          record(head.step, frame);
          by = { step: head.step, rule: head.rule };
        } else if (next === "skip" || frame - head.since >= wait) givenUp.push({ frame, step: head.step, rule: head.rule });
        else break;
        queue = queue.slice(1).map((q, i) => (i === 0 ? { ...q, since: Math.max(q.since, frame) } : q));
      }
      if (openerEnd < 0 && queue.every((q) => q.rule !== null)) openerEnd = frame;
      if (action === null && queue.length === 0) {
        for (let i = 0; i < list.rules.length && action === null; i++) {
          if (onset[i] === null || frame < (readyAt[i] as number)) continue;
          const rule = list.rules[i] as PolicyRule;
          const [first, ...rest] = stepsOf(rule);
          const next = startable(first as PolicyStep);
          action = next === "skip" ? null : next;
          if (action) {
            record(first as PolicyStep, frame);
            by = { step: first as PolicyStep, rule: i };
            fired[i] = (fired[i] as number) + 1;
            onset[i] = frame;
            readyAt[i] = frame + 1 + drawDelay(i);
            strikesSince[i] = 0;
            queue = rest.map((step) => ({ step, rule: i, since: frame }));
          }
        }
      }
      if (action === null) {
        const fill = list.filler === "dive" ? startable({ operator: controlled, cast: "dive" }) : basicAttack(frame);
        action = fill === "skip" ? null : fill;
      }
      if (!action) break;
      press(action, frame, by.step, by.rule);
      pressedNow = true;
    }
    observe(frame);
    if (frame === end) break;
    const next = everyFrame || pressedNow ? frame + 1 : nextWake(frame);
    for (let g = frame + 1; g < next; g++) observe(g);
    frame = next;
  }

  const perOperator: Record<string, number> = Object.fromEntries(scenario.team.map((b) => [b.operator, 0]));
  const byMinute: number[] = Array.from({ length: Math.max(1, Math.ceil(end / (60 * FPS))) }, () => 0);
  // The fight's end: what's due by its last frame has landed (the frame-by-frame driver's last state).
  st = stateAt(end);
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
  return { total, perOperator, byMinute, first60, openerEnd: from, sustainedDps: end > from ? after / seconds : 0, fired, givenUp, rotation, presses, durationFrames: end, sustainedMoments };
}
