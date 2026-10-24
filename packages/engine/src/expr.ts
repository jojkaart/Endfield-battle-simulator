// The kit format's two shared building blocks (docs/kit-abstractions.md):
// a Predicate says when something happens, a ValueExpr says how much. Every
// kit field that needs a condition or a number uses these, so a new
// situation is a new case here, not a new field on hits, buffs or triggers.

import type { AttrType, Element, SkillType } from "./attributes.ts";
import type { Build } from "./build.ts";
import type { BuffCategory } from "./events.ts";
import type { GameData } from "./model.ts";
import type { ArtsElement } from "./reactions.ts";
import type { Modifier, Zone } from "./effects.ts";
import type { EnemyStatus, PhysicalStatus, ReactionStatus } from "./status.ts";
import { lineValue, type StatPanel } from "./stats.ts";

export type Predicate =
  | { readonly all: readonly Predicate[] }
  | { readonly any: readonly Predicate[] }
  | { readonly not: Predicate }
  /** One of the operator's panel attributes is at least another (Arcane: Intellect ≥ Will is INT mode). */
  | { readonly attrAtLeast: readonly [AttrType, AttrType] }
  | { readonly potentialAtLeast: number }
  /** The build's talent (0-based, as in Build.talents) is at least this level: a talent's effects need it learned. */
  | { readonly talentAtLeast: readonly [number, number] }
  /** The team member in a slot (0 = first) has this element (Si's battle skill). */
  | { readonly teamSlotElement: { readonly slot: number; readonly element: Element } }
  /** The enemy has this infliction, with at least `minStacks` (default 1). */
  | { readonly enemyInfliction: ArtsElement; readonly minStacks?: number }
  /** The enemy has this reaction status (Estella's combo on a Solidified target)… */
  | { readonly enemyStatus: ReactionStatus }
  /** …or physical status (Lifted, Breached, …). */
  | { readonly enemyPhysical: PhysicalStatus }
  /** The enemy has at least this many Vulnerable stacks. */
  | { readonly enemyVulnerable: number }
  /** The enemy is Staggered. */
  | { readonly enemyStaggered: true }
  /** The enemy's HP is below this fraction of its Max HP (CheckHp isRatio; the scenario says the enemy's HP: TimelineScenario.enemyHp). */
  | { readonly enemyHpBelow: ValueExpr }
  /** The enemy has this control status (Immobilization, …). */
  | { readonly enemyControl: string }
  /** The operator's own stack is at least / below a count. */
  | { readonly stack: string; readonly atLeast?: number; readonly below?: number }
  /** One of the operator's own kit buffs is active. */
  | { readonly buffActive: string }
  /**
   * One of the operator's own kit buffs has at least / fewer than this many active layers (a plain buff: 1 or 0); the
   * thresholds are values, so a kit can name the data's key (Zhuang Fangyi's `free_sword_limit`).
   */
  | { readonly buffLayers: string; readonly atLeast?: ValueExpr; readonly below?: ValueExpr }
  /** The hit itself consumed at least this many infliction stacks (default 1). */
  | { readonly consumedAtLeast: number }
  /** The operator is the controlled one (Typhoeus's 5th aerial shot is a Final Strike only then). */
  | { readonly controlled: true }
  /** The enemy has a buff from anyone with a modifier in this zone that reaches this element (an all-element one counts). */
  | { readonly enemyModifier: { readonly zone: Zone; readonly element?: Element } }
  /** A buff from anyone that stands for this BuffData buff is on the enemy (Grizzled Edge: Originium Crystals). */
  | { readonly enemyBuff: string }
  /** A buff from anyone that reaches the operator has a modifier in this zone ("an Amped teammate"): the twin of `enemyModifier`. */
  | { readonly operatorModifier: { readonly zone: Zone; readonly element?: Element } }
  /** The operator's element is one of these. */
  | { readonly operatorElement: readonly Element[] }
  /** The operator's profession (CharacterTable `profession`) is one of these. */
  | { readonly operatorProfession: readonly number[] }
  /** The operator is the effect's owner (false for a teammate a team buff reaches). */
  | { readonly isOwner: true }
  /** The operator has the effect owner's element. */
  | { readonly sameElementAsOwner: true }
  /**
   * A buff from anyone that reaches the operator is of one of these categories (BuffCategory: Amp, Susceptibility,
   * Weakness, Protection, Shield), or stands for this BuffData buff: the twin of `enemyBuff` and of `operatorModifier`.
   */
  | { readonly operatorBuff: { readonly categories: readonly BuffCategory[] } | string }
  /**
   * The hit's own cast used at least `atLeast` (default 1) Link stacks (false for a hit not of a cast: a trigger's;
   * a detached entity hit judges its cast's).
   */
  | { readonly castLink: { readonly atLeast?: number } }
  /**
   * The operator's current action (still running) is a skill of one of these kinds, before its exclusive frame with
   * `beforeExclusive` (CheckSkillType checkTargetCurSkill, mustBeforeExclusiveTime): for KitSkill.beside.
   */
  | { readonly currentAction: { readonly kinds: readonly SkillType[]; readonly beforeExclusive?: true } }
  /** The enemy's super armor is at least / below this (CheckSuperArmor; EnemyData.superArmor, its Staggered value while Staggered). */
  | { readonly enemySuperArmor: { readonly atLeast?: number; readonly below?: number } }
  /** The enemy's rank is one of these (EnemyData.rank: EnemyTemplateDisplayInfoTable displayType, 0 Common … 4 Alpha). */
  | { readonly enemyRank: readonly number[] }
  /** Judged for the operator who caused the event a trigger reacts to (e.g. a teammate's battle skill: its caster's element). */
  | { readonly eventOperator: Predicate };

/**
 * A number from the game data. A number is a literal; a string is a skill
 * value of the skill in context (at the build's level, after potentials).
 */
export type ValueExpr =
  | number
  | string
  | { readonly key: string; readonly skill?: string }
  | { readonly sum: readonly ValueExpr[] }
  | { readonly product: readonly ValueExpr[] }
  | { readonly min: readonly ValueExpr[] }
  | { readonly max: readonly ValueExpr[] }
  /** One of the operator's panel attributes (e.g. Will 42). */
  | { readonly attr: AttrType }
  /** Infliction stacks consumed by this hit (or by the event that triggered it). */
  | { readonly consumed: true }
  /**
   * The count of the event behind this: for a trigger, its event's stacks
   * (inflicted, consumed; a reaction's level; 1 otherwise); for a combo's
   * hits and buffs, the count of the event that opened its window (Si's
   * finisher n).
   */
  | { readonly eventCount: true }
  /** Seconds the ended buff of a `buffEnded` event had left (0 when it ran out): an extension that follows a pause cut short. */
  | { readonly eventRemaining: true }
  /** The damage a recording buff of a `buffEnded` event recorded (KitBuff.records): Si's Artful Intent. */
  | { readonly eventRecorded: true }
  /** A value of a talent's attached buff or skill at the build's talent level (0-based talent, as in Build.talents); 0 while not learned. */
  | { readonly talent: number; readonly key: string }
  /** Targets the hit (or the triggering hit) reached: 1 until fights have several enemies. */
  | { readonly targetsHit: true }
  /** The operator's own stack count (e.g. the room left: max − count). */
  | { readonly stackCount: string }
  /** The active layers of one of the operator's own kit buffs (a plain buff: 1 or 0): Avywenna's Thunderlances on the field. */
  | { readonly buffLayers: string }
  /** The enemy's Vulnerable stacks (Gilberta's Arts Susceptibility per stack). */
  | { readonly enemyVulnerableStacks: true }
  /** The enemy's infliction stacks of this element (0 when it has none, or another element's): the twin of `enemyVulnerableStacks`. */
  | { readonly enemyInflictionStacks: ArtsElement }
  | { readonly if: Predicate; readonly then: ValueExpr; readonly else?: ValueExpr }
  /** Rounded down (the data's "per full 10 points": `{floor: {product: [{attr: 42}, 0.1]}}`). */
  | { readonly floor: ValueExpr }
  /** The first divided by the second (1 / rate). */
  | { readonly div: readonly [ValueExpr, ValueExpr] };

/** An operator's attribute: its panel's, plus what active buffs add (a line with a part of unknown formula is refused: stats.ts lineValue). */
function attrValue(c: EvalContext, attr: AttrType): number {
  const line = c.panel.attrs[attr];
  return (line ? lineValue(line, c.panel.operator) : (c.data.attributeDefaults[attr] ?? 0)) + (c.attrBonus?.(attr) ?? 0);
}

/** A build's level of an operator's talent (0-based, in talent order): Build.talents, else the highest. */
export function talentLevel(data: GameData, build: Build, i: number): number {
  const op = data.operators[build.operator];
  const index = [...new Set(op?.talentNodes.map((n) => n.index) ?? [])].sort((a, b) => a - b)[i];
  if (index === undefined) return 0;
  return build.talents?.[i] ?? Math.max(...(op?.talentNodes ?? []).filter((n) => n.index === index).map((n) => n.level));
}

/** The buff or skill a talent attaches at the build's level of it, or null while it isn't learned. */
export function talentSource(data: GameData, build: Build, i: number): string | null {
  const level = talentLevel(data, build, i);
  if (level === 0) return null;
  const op = data.operators[build.operator];
  const index = [...new Set(op?.talentNodes.map((n) => n.index) ?? [])].sort((a, b) => a - b)[i];
  const node = op?.talentNodes.find((n) => n.index === index && n.level === level);
  const e = node?.effects.find((x) => x.kind === "buff" || x.kind === "skill");
  return e?.kind === "buff" ? e.buffId : e?.kind === "skill" ? e.skillId : null;
}

/** What a predicate or value is evaluated against. Fields left out are unknown. */
export interface EvalContext {
  readonly data: GameData;
  readonly build: Build;
  readonly panel: StatPanel;
  /** The skill whose values a plain key names. */
  readonly skillId: string;
  readonly team?: readonly Build[];
  readonly enemy?: EnemyStatus;
  readonly stacks?: Readonly<Record<string, number>>;
  readonly buffActive?: (id: string) => boolean;
  /** Active layers of one of the operator's own kit buffs (as `buffActive` sees them). */
  readonly buffLayers?: (id: string) => number;
  readonly consumed?: number;
  /** ValueExpr `eventCount`. */
  readonly eventCount?: number;
  /** ValueExpr `eventRemaining`, in seconds. */
  readonly eventRemaining?: number;
  /** ValueExpr `eventRecorded`. */
  readonly eventRecorded?: number;
  /** What active buffs add to an attribute of the operator (read by `attr` values and `attrAtLeast`); none when absent. */
  readonly attrBonus?: (attr: AttrType) => number;
  /** The controlled operator. */
  readonly controlled?: string;
  /** Whether the enemy is Staggered. */
  readonly staggered?: boolean;
  /** The enemy's HP as a fraction of its Max HP (the scenario's). */
  readonly enemyHp?: number;
  /** Modifiers of the buffs on the enemy, from anyone. */
  readonly enemyModifiers?: readonly Modifier[];
  /** BuffData IDs of the buffs from anyone on the enemy. */
  readonly enemyGameBuffs?: ReadonlySet<string>;
  /** Modifiers of the buffs from anyone that reach the operator. */
  readonly operatorModifiers?: readonly Modifier[];
  /** The buffs from anyone that reach the operator: their categories and the BuffData buffs they stand for. */
  readonly operatorBuffs?: readonly { readonly categories: readonly BuffCategory[]; readonly gameBuff?: string }[];
  /** Link stacks the hit's (or the event's) cast used; 0 for one of no cast. */
  readonly castLink?: number;
  /** The operator's running action (null: none): its kind (`none` for one that isn't a kit skill) and whether it's before its exclusive frame. */
  readonly currentAction?: { readonly kind: SkillType | "none"; readonly beforeExclusive: boolean } | null;
  /** The enemy's super armor now (EnemyData.superArmor). */
  readonly enemySuperArmor?: number;
  /** The enemy's rank (EnemyData.rank). */
  readonly enemyRank?: number;
  /** Whose effect is judged, when `build` is someone else (a team buff's recipient); default: `build`'s operator. */
  readonly owner?: string;
  /** The context of the operator who caused the event a trigger reacts to. */
  readonly eventOperator?: EvalContext;
  /** Skill values (injected to keep this module free of the damage code). */
  readonly skillValue: (skillId: string, key: string) => number;
}

/** True, false, or undefined when the context doesn't know (the log checker then tries both). */
export function test(p: Predicate, c: EvalContext): boolean | undefined {
  if ("all" in p) return and3(p.all.map((x) => test(x, c)));
  if ("any" in p) {
    const v = p.any.map((x) => test(x, c));
    return v.includes(true) ? true : v.includes(undefined) ? undefined : false;
  }
  if ("not" in p) {
    const v = test(p.not, c);
    return v === undefined ? undefined : !v;
  }
  if ("attrAtLeast" in p) {
    const [a, b] = p.attrAtLeast;
    return attrValue(c, a) >= attrValue(c, b);
  }
  if ("potentialAtLeast" in p) return c.build.potential >= p.potentialAtLeast;
  if ("talentAtLeast" in p) return talentLevel(c.data, c.build, p.talentAtLeast[0]) >= p.talentAtLeast[1];
  if ("teamSlotElement" in p) {
    if (!c.team) return undefined;
    const member = c.team[p.teamSlotElement.slot];
    return member !== undefined && c.data.operators[member.operator]?.element === p.teamSlotElement.element;
  }
  if ("enemyInfliction" in p) {
    if (!c.enemy) return undefined;
    const i = c.enemy.infliction;
    return i !== null && i.element === p.enemyInfliction && i.stacks >= (p.minStacks ?? 1);
  }
  if ("enemyStatus" in p) return c.enemy ? c.enemy.statuses.some((s) => s.status === p.enemyStatus) : undefined;
  if ("enemyPhysical" in p) return c.enemy ? c.enemy.physical.some((s) => s.status === p.enemyPhysical) : undefined;
  if ("enemyStaggered" in p) return c.staggered;
  if ("enemyHpBelow" in p) return c.enemyHp === undefined ? undefined : c.enemyHp < evaluate(p.enemyHpBelow, c);
  if ("enemyControl" in p) return c.enemy ? c.enemy.controls.some((x) => x.status === p.enemyControl) : undefined;
  if ("enemyVulnerable" in p) return c.enemy ? (c.enemy.vulnerable?.stacks ?? 0) >= p.enemyVulnerable : undefined;
  if ("stack" in p) {
    if (!c.stacks) return undefined;
    const n = c.stacks[p.stack] ?? 0;
    return (p.atLeast === undefined || n >= p.atLeast) && (p.below === undefined || n < p.below);
  }
  if ("buffActive" in p) return c.buffActive ? c.buffActive(p.buffActive) : undefined;
  if ("buffLayers" in p) {
    if (!c.buffLayers) return undefined;
    const n = c.buffLayers(p.buffLayers);
    return (p.atLeast === undefined || n >= evaluate(p.atLeast, c)) && (p.below === undefined || n < evaluate(p.below, c));
  }
  if ("consumedAtLeast" in p) return c.consumed === undefined ? undefined : c.consumed >= p.consumedAtLeast;
  if ("controlled" in p) return c.controlled === undefined ? undefined : c.controlled === c.build.operator;
  if ("enemyBuff" in p) return c.enemyGameBuffs ? c.enemyGameBuffs.has(p.enemyBuff) : undefined;
  if ("operatorModifier" in p) {
    if (!c.operatorModifiers) return undefined;
    const { zone, element } = p.operatorModifier;
    return c.operatorModifiers.some((m) => m.zone === zone && (element === undefined || m.element === undefined || m.element === element));
  }
  if ("enemyModifier" in p) {
    if (!c.enemyModifiers) return undefined;
    const { zone, element } = p.enemyModifier;
    return c.enemyModifiers.some((m) => m.zone === zone && (element === undefined || m.element === undefined || m.element === element));
  }
  if ("operatorBuff" in p) {
    if (!c.operatorBuffs) return undefined;
    const want = p.operatorBuff;
    return c.operatorBuffs.some((b) => (typeof want === "string" ? b.gameBuff === want : b.categories.some((x) => want.categories.includes(x))));
  }
  if ("castLink" in p) return c.castLink === undefined ? undefined : c.castLink >= (p.castLink.atLeast ?? 1);
  if ("currentAction" in p) {
    if (c.currentAction === undefined) return undefined;
    const cur = c.currentAction;
    return cur !== null && (p.currentAction.kinds as readonly string[]).includes(cur.kind) && (!p.currentAction.beforeExclusive || cur.beforeExclusive);
  }
  if ("enemySuperArmor" in p) {
    if (c.enemySuperArmor === undefined) return undefined;
    const n = c.enemySuperArmor;
    return (p.enemySuperArmor.atLeast === undefined || n >= p.enemySuperArmor.atLeast) && (p.enemySuperArmor.below === undefined || n < p.enemySuperArmor.below);
  }
  if ("enemyRank" in p) return c.enemyRank === undefined ? undefined : p.enemyRank.includes(c.enemyRank);
  if ("operatorElement" in p) return p.operatorElement.includes(c.data.operators[c.build.operator]?.element as Element);
  if ("operatorProfession" in p) return p.operatorProfession.includes(c.data.operators[c.build.operator]?.profession ?? Number.NaN);
  if ("isOwner" in p) return (c.owner ?? c.build.operator) === c.build.operator;
  if ("sameElementAsOwner" in p) return c.data.operators[c.build.operator]?.element === c.data.operators[c.owner ?? c.build.operator]?.element;
  return c.eventOperator ? test(p.eventOperator, c.eventOperator) : undefined;
}

function and3(v: readonly (boolean | undefined)[]): boolean | undefined {
  return v.includes(false) ? false : v.includes(undefined) ? undefined : true;
}

/** A value; throws when it depends on something the context doesn't know. */
export function evaluate(v: ValueExpr, c: EvalContext): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return c.skillValue(c.skillId, v);
  if ("talent" in v) {
    const source = talentSource(c.data, c.build, v.talent);
    return source === null ? 0 : c.skillValue(source, v.key);
  }
  if ("key" in v) return c.skillValue(v.skill ?? c.skillId, v.key);
  if ("sum" in v) return v.sum.reduce((s: number, x) => s + evaluate(x, c), 0);
  if ("product" in v) return v.product.reduce((s: number, x) => s * evaluate(x, c), 1);
  if ("min" in v) return Math.min(...v.min.map((x) => evaluate(x, c)));
  if ("max" in v) return Math.max(...v.max.map((x) => evaluate(x, c)));
  if ("attr" in v) return attrValue(c, v.attr);
  if ("floor" in v) return Math.floor(evaluate(v.floor, c) + 1e-9);
  if ("div" in v) {
    const d = evaluate(v.div[1], c);
    if (d === 0) throw new Error("value divides by 0");
    return evaluate(v.div[0], c) / d;
  }
  if ("consumed" in v) {
    if (c.consumed === undefined) throw new Error("value needs the consumed infliction stacks, which aren't known here");
    return c.consumed;
  }
  if ("eventRecorded" in v) {
    if (c.eventRecorded === undefined) throw new Error("value needs the damage a buff recorded, which only a buffEnded trigger on a recording buff has");
    return c.eventRecorded;
  }
  if ("eventRemaining" in v) {
    if (c.eventRemaining === undefined) throw new Error("value needs the time left of an ended buff, which only a buffEnded trigger has");
    return c.eventRemaining;
  }
  if ("eventCount" in v) {
    if (c.eventCount === undefined) throw new Error("value needs the count of the event behind it, which isn't known here");
    return c.eventCount;
  }
  if ("targetsHit" in v) return 1;
  if ("enemyVulnerableStacks" in v) {
    if (!c.enemy) throw new Error("value needs the enemy's Vulnerable stacks, which aren't known here");
    return c.enemy.vulnerable?.stacks ?? 0;
  }
  if ("enemyInflictionStacks" in v) {
    if (!c.enemy) throw new Error("value needs the enemy's infliction stacks, which aren't known here");
    const i = c.enemy.infliction;
    return i !== null && i.element === v.enemyInflictionStacks ? i.stacks : 0;
  }
  if ("stackCount" in v) {
    if (!c.stacks) throw new Error(`value needs stack ${v.stackCount}, which isn't known here`);
    return c.stacks[v.stackCount] ?? 0;
  }
  if ("buffLayers" in v) {
    if (!c.buffLayers) throw new Error(`value needs the layers of buff ${v.buffLayers}, which aren't known here`);
    return c.buffLayers(v.buffLayers);
  }
  const t = test(v.if, c);
  if (t === undefined) throw new Error("value depends on a condition that isn't known here");
  return t ? evaluate(v.then, c) : v.else === undefined ? 0 : evaluate(v.else, c);
}

/**
 * The value keys an expression reads, with their skill (default: `skillId`); a talent value reads its key from each
 * source the talent attaches at some level (`talentSources`; none known: an error), or, with "skipTalents", from none
 * (a reader that wants only the skill keys).
 */
export function valueKeys(v: ValueExpr, skillId: string, talentSources?: ((talent: number) => readonly string[]) | "skipTalents"): { skill: string; key: string }[] {
  if (typeof v === "number") return [];
  if (typeof v === "string") return [{ skill: skillId, key: v }];
  if ("talent" in v) {
    if (talentSources === "skipTalents") return [];
    const sources = talentSources?.(v.talent) ?? [];
    if (sources.length === 0) throw new Error(`no talent ${v.talent} to read ${v.key} from`);
    return sources.map((skill) => ({ skill, key: v.key }));
  }
  if ("key" in v) return [{ skill: v.skill ?? skillId, key: v.key }];
  const parts = "sum" in v ? v.sum : "product" in v ? v.product : "min" in v ? v.min : "max" in v ? v.max : "if" in v ? [v.then, ...(v.else !== undefined ? [v.else] : [])] : "floor" in v ? [v.floor] : "div" in v ? v.div : [];
  return parts.flatMap((x) => valueKeys(x, skillId, talentSources));
}

/** Own stacks and buffs a predicate names, for the loader to check. */
export function predicateRefs(p: Predicate): { stacks: string[]; buffs: string[] } {
  if ("all" in p || "any" in p) {
    const list = "all" in p ? p.all : p.any;
    const parts = list.map(predicateRefs);
    return { stacks: parts.flatMap((x) => x.stacks), buffs: parts.flatMap((x) => x.buffs) };
  }
  if ("not" in p) return predicateRefs(p.not);
  // An eventOperator predicate names the event operator's stacks and buffs, not the kit's own.
  if ("stack" in p) return { stacks: [p.stack], buffs: [] };
  if ("buffActive" in p) return { stacks: [], buffs: [p.buffActive] };
  if ("buffLayers" in p) {
    const refs = predicateValues(p).map(valueRefs);
    return { stacks: refs.flatMap((x) => x.stacks), buffs: [p.buffLayers, ...refs.flatMap((x) => x.buffs)] };
  }
  if ("enemyHpBelow" in p) return valueRefs(p.enemyHpBelow);
  return { stacks: [], buffs: [] };
}

/** The values a predicate compares with (its own and its parts', not an eventOperator's), for the loader to check their keys. */
export function predicateValues(p: Predicate): ValueExpr[] {
  if ("all" in p || "any" in p) return ("all" in p ? p.all : p.any).flatMap(predicateValues);
  if ("not" in p) return predicateValues(p.not);
  if ("buffLayers" in p) return [...(p.atLeast !== undefined ? [p.atLeast] : []), ...(p.below !== undefined ? [p.below] : [])];
  if ("enemyHpBelow" in p) return [p.enemyHpBelow];
  return [];
}

/** Own stacks and buffs a value names (its own and its conditions'), for the loader to check. */
export function valueRefs(v: ValueExpr): { stacks: string[]; buffs: string[] } {
  if (typeof v === "number" || typeof v === "string") return { stacks: [], buffs: [] };
  if ("stackCount" in v) return { stacks: [v.stackCount], buffs: [] };
  if ("buffLayers" in v) return { stacks: [], buffs: [v.buffLayers] };
  const parts = "sum" in v ? v.sum : "product" in v ? v.product : "min" in v ? v.min : "max" in v ? v.max : "if" in v ? [v.then, ...(v.else !== undefined ? [v.else] : [])] : "floor" in v ? [v.floor] : "div" in v ? v.div : [];
  const refs = [...parts.map(valueRefs), ...("if" in v ? [predicateRefs(v.if)] : [])];
  return { stacks: refs.flatMap((x) => x.stacks), buffs: refs.flatMap((x) => x.buffs) };
}
