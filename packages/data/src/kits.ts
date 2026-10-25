// Loads the hand-written kits (packages/data/kits) and checks them against
// the game data: every skill, level group and blackboard key must exist.
// Operator kits (kits/operators) hold skills, stacks, buffs and triggers;
// equipment kits (kits/equipment: weapons and gear sets) hold stacks, buffs,
// and triggers that act for whoever wears them.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { damageSites, operatorSkillFiles } from "./skillGraph.ts";
import { compileEquipmentSkill, compileOperatorSkill, dataEnergyBlockSeconds, dataTeamEnergy, hitFacts, kitEnergyBlock, matchSkill, spPlaced, type CompileData, type CastAction, type DataField, type Disagreement, type HitFacts } from "./kitMatch.ts";
import type { CompiledSkill, CompiledValue } from "./skillCompile.ts";
import { isSkillFileListed, skillFilePath } from "./skillData.ts";
import { buffFilePath, isBuffFileListed, readBuffFile, skillAttachedEffects, type RawBuffFile } from "./buffData.ts";
import { buffTagFilter, SHIELD_TAG } from "./buffTags.ts";
import { Attr, attrFeedsZone, buffAttrHasEffect, buffReach, type BuffCategory, type TriggerOn, type KitBuffModifier, ELEMENTS, predicateRefs, predicateValues, valueRefs, allActions, STATUS_EVENTS, triggerSkillId, type KitHit, type Effect, valueKeys, type BuffApplication, type KitTrigger, type TriggerAction, type KitBuff, type Predicate, type ValueExpr, type KitApplication, type StatusTweak, type StackDef, type StackRequirement, type Element, type EquipmentKit, type Kits, type OperatorKit, type SkillData, type SkillType, type Zone } from "@efsim/engine";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KITS = join(ROOT, "packages/data/kits");

interface RawHit {
  id: string; label?: string; scale: string[]; count?: ValueExpr; framesEvery?: number; element?: Element; events?: string[]; frames?: number[];
  applies?: KitApplication[]; requires?: StackRequirement; gains?: { stack: string; amount?: ValueExpr; if?: Predicate }[];
  bonuses?: { zone: Zone; key: string }[];
  zoneScale?: { zone: Zone; value: ValueExpr }[];
  atkSnapshot?: boolean;
  finalStrike?: boolean;
  dive?: boolean;
  factor?: number;
  reaction?: { kind: "burst" | "reaction"; element: "fire" | "pulse" | "cryst" | "natural"; level?: number };
  extraScale?: { value: ValueExpr; if: Predicate }[];
  scaleValue?: ValueExpr;
  fixedDamage?: ValueExpr;
  base?: ValueExpr;
  spKind?: "natural" | "returned";
  spBeforeDamage?: true;
  if?: Predicate;
  branch?: string;
  buffs?: BuffApplication[];
  energy?: ValueExpr;
  sp?: ValueExpr;
  heals?: "self" | "controlled" | "team";
  detached?: boolean;
  launch?: number;
  poise?: ValueExpr;
  poiseControlledOnly?: boolean;
  /** Which skill-type bonus applies (`none`: no skill type): required on triggered hits; on a skill's hit, an override of the skill's. */
  damageType?: SkillType | "none";
  poiseOnly?: true;
  /** Fields where the kit's value (or its leaving one out) differs from the compiled data's on purpose, each with the reason (kitMatch.ts). */
  dataOverride?: Partial<Record<DataField, string>>;
}

type RawAction =
  | Exclude<TriggerAction, { kind: "hits" } | { kind: "choose" }>
  | { kind: "hits"; hits: RawHit[]; if?: Predicate; now?: boolean }
  | { kind: "choose"; options: { weight: ValueExpr; do: RawAction[] }[]; if?: Predicate };

/**
 * A trigger's event as kits write it: also `buffApplied` by the game's buff tags (`tags`, any of them), which the
 * loader turns into its category filter (buffTags.ts buffTagFilter).
 */
export type RawOn = TriggerOn | { event: "buffApplied"; tags: number[]; fromKinds?: (SkillType | "none")[]; toOthers?: boolean; received?: boolean };

type RawTrigger = Omit<KitTrigger, "do" | "on"> & { note?: string; on: RawOn; do: RawAction[]; dataOverride?: Partial<Record<"energy" | "sp" | "apply", string>> };

/** A trigger's event with buff tags turned into their category filter. */
export function triggerOn(on: RawOn, where: string): TriggerOn {
  if (!("tags" in on)) return on;
  const { tags, ...rest } = on;
  try {
    return { ...rest, ...buffTagFilter(tags) };
  } catch (e) {
    throw new Error(`${where}: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
}

/** A list of raw actions with those inside its choose options (an option's after its choose). */
const flatActions = (list: readonly RawAction[]): RawAction[] => list.flatMap((a) => (a.kind === "choose" ? [a, ...a.options.flatMap((o) => flatActions(o.do))] : [a]));

interface RawKit {
  operator: string;
  /** The same kit under other operator IDs (the Endministrator's two): skill IDs and log keys renamed. */
  variants?: { operator: string; skills?: Record<string, string> }[];
  element?: Element;
  stacks?: StackDef[];
  buffs?: RawBuff[];
  triggers?: RawTrigger[];
  statusTweaks?: (StatusTweak & { note?: string })[];
  activeConditions?: Record<string, Predicate>;
  skills: {
    skillId: string;
    label: string;
    damageType: "basic" | "battle" | "combo" | "ultimate";
    energyBlockSeconds?: number;
    jumps?: { at: number; to?: number; if: Predicate }[];
    teamEnergy?: { frame: number; ratio: number; if?: Predicate; detached?: boolean }[];
    available?: Predicate;
    followUpOnly?: boolean;
    takesControl?: boolean;
    beside?: Predicate;
    cooldownGroup?: string;
    chainStep?: boolean;
    windows?: { from: number; skills?: string[]; if?: Predicate }[];
    comboWindow?: false;
    noDodge?: [number, number];
    /** Where the skill differs from the compiled data on purpose (teamEnergy, energyBlockSeconds, applies@<frame>, lands <file>), each with the reason. */
    dataOverride?: Record<string, string>;
    hits: RawHit[];
  }[];
}

interface RawEquipmentKit {
  equipment: string;
  sources: string[];
  stacks?: StackDef[];
  buffs?: RawBuff[];
  triggers?: RawTrigger[];
}

type RawBuff = KitBuff & { note?: string; dataOverride?: { duration?: string } };

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schema = (name: string) => JSON.parse(readFileSync(join(ROOT, "schemas", name), "utf8")) as object;
  ajv.addSchema(schema("kit.schema.json"));
  return {
    ajv,
    kit: ajv.getSchema("https://github.com/jojkaart/Endfield-battle-simulator/schemas/kit.schema.json"),
    equipment: ajv.compile(schema("equipment-kit.schema.json")),
  };
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

export interface KitData extends CompileData {
  readonly skills: Readonly<Record<string, SkillData>>;
  readonly operators: Readonly<Record<string, { skillGroups: Readonly<Record<string, string>>; talentNodes?: readonly { index: number; level: number; effects: readonly Effect[] }[]; potentials?: readonly (readonly Effect[])[] }>>;
  readonly weapons: Readonly<Record<string, { readonly skills: readonly string[] }>>;
  readonly gearSets: Readonly<Record<string, { readonly skillId: string }>>;
}

/** SkillData decorate-mask bit of a Final Strike (the last hit of a basic attack chain; Laevatain's attack5, Gilberta's attack4 projectile). */
const FINAL_STRIKE_BIT = 2097152;

/**
 * Whether a kit hit is a Final Strike: one of the SkillData files its log
 * events name (or, for a skill's only hit entry without events, the skill's
 * file and its projectile files) has a damage unit with the Final Strike bit.
 */
function isFinalStrike(skillId: string, events: readonly string[], hitEntries: number, bit = FINAL_STRIKE_BIT): boolean {
  const files = events.length ? events : hitEntries === 1 ? operatorSkillFiles(skillId.replace(/^(chr_\d+_[a-z]+)_.*$/, "$1")).filter((f) => f === skillId || f.startsWith(`${skillId}_`)) : [];
  return files.some((f) => damageSites(f).some((d) => (Math.floor(d.decorateMask / bit) & 1) === 1));
}

/** Whether a log event key names a fetched SkillData or BuffData file (the file holding the damage). */
function isDataFile(id: string): boolean {
  return (isSkillFileListed(id) && existsSync(skillFilePath(id))) || (isBuffFileListed(id) && existsSync(buffFilePath(id)));
}

/** SkillData decorate-mask bit of a dive attack's landing (the plunging attacks' masks are 1152: 1024 + the basic attack's 128). */
const DIVE_BIT = 1024;

/** Whether a kit hit is a dive attack's landing: as isFinalStrike, by the dive bit. */
const isDive = (skillId: string, events: readonly string[], hitEntries: number): boolean => isFinalStrike(skillId, events, hitEntries, DIVE_BIT);

/** Checks that a blackboard key has a value at every level (or a SkillData default). */
function checkKey(skill: SkillData, key: string, where: string) {
  for (const l of skill.levels) {
    if (l.blackboard[key] === undefined && skill.defaults[key] === undefined) {
      throw new Error(`${where}: ${skill.id} has no value ${key} at level ${l.level}${skill.fileLoaded ? "" : " (its SkillData file isn't fetched)"}`);
    }
  }
}

const gameBuffCache = new Map<string, RawBuffFile>();

/** The BuffData file a kit buff stands for (KitBuff.gameBuff); an error when it isn't fetched or doesn't exist. */
function gameBuffFile(file: string, buffId: string, gameBuff: string): RawBuffFile {
  const cached = gameBuffCache.get(gameBuff);
  if (cached) return cached;
  if (!isBuffFileListed(gameBuff)) throw new Error(`${file}: buff ${buffId}: ${gameBuff} isn't covered by tables.json json.BuffData`);
  const raw = readBuffFile(gameBuff);
  if (!raw) throw new Error(`${file}: buff ${buffId}: no BuffData file ${gameBuff}`);
  gameBuffCache.set(gameBuff, raw);
  return raw;
}

/**
 * A kit-buff attribute modifier with `percent` from its game buff: the
 * game buff's modifier of that attribute (as written, not a main or
 * secondary attribute) in formulaItem 6 is a percentage of the panel line.
 * Attributes feeding a zone are ratios the zone adds as they are, whatever
 * their slot. A kit's own `percent` must agree with the data.
 */
function withPercent(file: string, buffId: string, raw: RawBuffFile, m: KitBuffModifier): KitBuffModifier {
  // Zone `atk` is ATK% (it joins the panel's ATK% before the attribute bonus): the game buff's ATK must be in formulaItem 6.
  if (m.zone === "atk") {
    const atkSlots = new Set(raw.attributeModifiers.filter((x) => x.attr === Attr.Atk).map((x) => x.slot));
    if ([...atkSlots].some((s) => s !== 6)) throw new Error(`${file}: buff ${buffId}: zone atk is ATK%, but ${raw.id} changes ATK in formulaItem ${[...atkSlots].join(", ")}`);
  }
  if (m.attr === undefined || attrFeedsZone(m.attr)) return m;
  const slots = new Set(raw.attributeModifiers.filter((x) => x.attr === m.attr && x.target === 0).map((x) => x.slot));
  if (slots.size === 0) return m;
  if (slots.size > 1) throw new Error(`${file}: buff ${buffId}: ${raw.id} changes attribute ${m.attr} in several formula slots (${[...slots].join(", ")})`);
  const percent = slots.has(6);
  if (m.percent !== undefined && m.percent !== percent) throw new Error(`${file}: buff ${buffId}: ${raw.id} has attribute ${m.attr} in formulaItem ${[...slots].join("")}, so percent is ${percent}`);
  const { percent: _p, ...rest } = m;
  return percent ? { ...rest, percent: true } : rest;
}

/**
 * How many instances a kit buff keeps (KitBuff.instances) by its game buff:
 * stackingType 1 with a priority key keeps maxStackCnt (0: no limit), or
 * the value of its maxStackCntKey. That key is the applying skill's (the
 * CreateBuffAction assigns it); when the applying skills don't have it
 * (`applyingSkillHasKey` false), the buff's own blackboard value
 * (Tangtang's spellvulnerable: cntmax 1), and a key in neither reads 0, no
 * limit (Navigator's and Wedge's `max_stack`, Dreams of the Starry Beach's;
 * their literal maxStackCnt is 0 too). Undefined for other game buffs.
 */
function gameBuffInstances(file: string, b: Pick<KitBuff, "id" | "maxStacks">, raw: RawBuffFile, applyingSkillHasKey?: boolean): ValueExpr | undefined {
  const s = raw.stacking;
  if (s.type !== 1 || s.priorityKey === null) return undefined;
  if (s.negatePriority) throw new Error(`${file}: buff ${b.id}: ${raw.id} keeps its weakest instance (negatePriority), which isn't supported`);
  if (b.maxStacks !== undefined) throw new Error(`${file}: buff ${b.id}: ${raw.id} keeps instances by priority (stackingType 1, priority key ${s.priorityKey}): drop maxStacks`);
  if (s.maxStacksKey === null) return s.maxStackCnt;
  return applyingSkillHasKey === false ? (raw.blackboard[s.maxStacksKey] ?? 0) : s.maxStacksKey;
}

/**
 * BuffData stacking types whose instances are layers (KitBuff.maxStacks):
 * 2 and 11 each with its own timer, 8 and 10 on one shared timer
 * (SHARED_TIMER_TYPES). Others (4: refreshed; 1: the strongest; 7, 9, 0)
 * aren't layers.
 */
const LAYERED_TYPES: ReadonlySet<number> = new Set([2, 11, 8, 10]);

/**
 * A layered game buff's cap (KitBuff.maxStacks) as far as the data alone
 * says it: its literal maxStackCnt without a maxStackCntKey (Suffering's
 * End: 4), or with one the applying skills don't have
 * (`applyingSkillHasKey` false), the buff's own blackboard value (Camille's
 * talent 2: max_stack 5 over the literal 3). Undefined when the applying
 * skill's value sets it (kits name that key), for no limit (0), a cap of 1
 * (a plain buff) and buffs that aren't layers.
 */
function gameBuffLayers(raw: RawBuffFile, applyingSkillHasKey?: boolean): number | undefined {
  const s = raw.stacking;
  if (!LAYERED_TYPES.has(s.type) || (s.type === 11 && s.priorityKey !== null && s.maxStacksKey === null && s.maxStackCnt === 1)) return undefined;
  const cap = s.maxStacksKey === null ? s.maxStackCnt : applyingSkillHasKey === false ? raw.blackboard[s.maxStacksKey] : undefined;
  return cap !== undefined && cap > 1 ? cap : undefined;
}

/** Whether the skills applying a kit buff matter for its cap: the game buff's maxStackCntKey sets its instances or its layers (the kit names no cap). */
function capKey(b: Pick<KitBuff, "maxStacks">, raw: RawBuffFile): string | null {
  const s = raw.stacking;
  if (s.maxStacksKey === null) return null;
  if (s.type === 1 && s.priorityKey !== null) return s.maxStacksKey;
  return LAYERED_TYPES.has(s.type) && b.maxStacks === undefined ? s.maxStacksKey : null;
}

/**
 * A kit buff with what the game buff it stands for (KitBuff.gameBuff) says.
 * Stacking: type 1 is one strongest instance per group (its stackingKey,
 * else its file), and with a priority key a reapplication keeps instances
 * (`instances`: maxStackCnt, 0 no limit, or the applying skill's
 * maxStackCntKey); type 11 with a priority key and one instance is a group
 * too, so two wielders' copies don't add (layered type 11 stays per owner);
 * types 8 and 10: layers on one refreshed timer (SHARED_TIMER_TYPES). An attribute modifier the game
 * buff has in formulaItem 6 is a percentage (`percent`). A layered one's
 * cap (`maxStacks`) is the data's when it says one (gameBuffLayers); a
 * kit's literal cap must agree with it.
 * `applyingSkillHasKey`: whether the skills that apply it have its
 * maxStackCntKey (gameBuffInstances, gameBuffLayers; default: assumed).
 */
export function withGameBuff(file: string, b0: KitBuff, applyingSkillHasKey?: boolean): KitBuff {
  const { gameBuff } = b0;
  if (!gameBuff) return b0;
  const raw = gameBuffFile(file, b0.id, gameBuff);
  // The basic-attack input it maps (a ComboCacheAction in its buffEvent 5); a kit's own must agree with the data.
  if (b0.basicAttack !== undefined && b0.basicAttack !== raw.basicAttack) throw new Error(`${file}: buff ${b0.id}: ${raw.id} maps the basic-attack input to ${raw.basicAttack ?? "nothing"}, not ${b0.basicAttack}`);
  const b = raw.basicAttack !== null ? { ...b0, basicAttack: raw.basicAttack } : b0;
  const modifiers = b.modifiers.map((m) => withPercent(file, b.id, raw, m));
  const s = raw.stacking;
  const instances = gameBuffInstances(file, b, raw, applyingSkillHasKey);
  if (s.type === 1) return { ...b, modifiers, stackGroup: s.key ?? gameBuff, ...(instances !== undefined ? { instances } : {}) };
  if (s.type === 11 && s.priorityKey !== null && s.maxStacksKey === null && s.maxStackCnt === 1) return { ...b, modifiers, stackGroup: s.key ?? gameBuff };
  const cap = gameBuffLayers(raw, applyingSkillHasKey);
  if (cap !== undefined && typeof b.maxStacks === "number" && b.maxStacks !== cap) throw new Error(`${file}: buff ${b.id}: ${raw.id} keeps ${cap} layers (stackingType ${s.type}${s.maxStacksKey === null ? ", its literal maxStackCnt" : `, its own ${s.maxStacksKey}`}), not ${b.maxStacks}`);
  const maxStacks = b.maxStacks ?? cap;
  const layered = maxStacks !== undefined ? { ...b, maxStacks } : b;
  return SHARED_TIMER_TYPES.has(s.type) && maxStacks !== undefined && b.sharedTimer === undefined ? { ...layered, modifiers, sharedTimer: true } : { ...layered, modifiers };
}

/**
 * A kit buff's categories with what its game buff says: one whose game buff
 * has the shield tag (applyTags −1757502026) is a shield, in addition to what
 * its modifiers make it (buffReach). Kit-written categories must agree with
 * the tag.
 */
export function withCategories(file: string, b: KitBuff): KitBuff {
  // The buffs a log lists it under (KitBuff.loggedAs) are fetched BuffData files, and say something gameBuff doesn't.
  for (const id of b.loggedAs ?? []) {
    if (id === b.gameBuff) throw new Error(`${file}: buff ${b.id}: loggedAs repeats its gameBuff ${id}`);
    gameBuffFile(file, b.id, id);
  }
  const shield = b.gameBuff ? gameBuffFile(file, b.id, b.gameBuff).applyTags.includes(SHIELD_TAG) : undefined;
  if (b.categories) {
    if (shield !== undefined && shield !== b.categories.includes("shield")) throw new Error(`${file}: buff ${b.id}: ${b.gameBuff} ${shield ? "has" : "hasn't"} the shield tag (${SHIELD_TAG}), so its categories ${shield ? "include" : "don't include"} shield`);
    return b;
  }
  return shield ? { ...b, categories: [...(Object.keys(buffReach(b)) as BuffCategory[]), "shield"] } : b;
}

/**
 * BuffData stackingTypes whose layers share one timer each new layer
 * refreshes (KitBuff.sharedTimer). 8: batch-3 B3 (in-game test 62). 10: the
 * inflictions' type (buff_common_enemy_spell_*_attached, maxStackCnt 4),
 * which the engine already runs on one refreshed timer (status.ts); Ember's
 * talent 2 (buff_chr_0009_azrila_talent_2_buff, max 3) is listed once in
 * fixtures/pending/zmdlogs-7e19489ae503.json though applied twice (batch 4
 * B3; test 62's Ember variant settles it).
 */
const SHARED_TIMER_TYPES: ReadonlySet<number> = new Set([8, 10]);

/** What one kit's values, stacks and buffs may name. */
interface KitScope {
  /** Prefix of error messages (the kit file). */
  readonly file: string;
  /** The operator or equipment ID; a trigger without a `skill` names its values after it. */
  readonly owner: string;
  readonly element?: Element;
  readonly stackIds: ReadonlySet<string>;
  readonly buffDefs: ReadonlyMap<string, KitBuff>;
  /** Whether a skill ID is one of the owner's skills (cast filters name them). */
  readonly isSkill: (id: string) => boolean;
  /** Whether a skill ID is a combo-kind skill of the owner's kit cast with the combo window (`openCombo` `skills` name them); none for equipment. */
  readonly isComboSkill?: (id: string) => boolean;
  /** Whether a skill or source ID is one the kit can read values from. */
  readonly isSource: (id: string) => boolean;
  /** Throws unless the source has the key (at every level, for skills). */
  readonly checkSourceKey: (id: string, key: string, where: string) => void;
  /** The buffs and skills a talent (0-based) attaches at its levels, for `{talent, key}` values; none for equipment. */
  readonly talentSources?: (talent: number) => readonly string[];
  /** SkillData files whose CreateBuffAttachingSkill effects make a consumed buff act while its cast runs (an equipment's skills; consumedScope). */
  readonly castBuffSkills?: readonly string[];
}

/**
 * What a consumed kit buff acts on by default (KitBuff.consumedScope): while
 * the consuming cast runs when the game attaches the cast's effect buff to
 * the cast (CreateBuffAttachingSkill of a buff with an attribute modifier,
 * or a damage modifier that doesn't check the cast ID) in the kit buff's
 * game buff or the equipment's skills (Cohesive Traction, Aspirant, Grand
 * Vision, Glorious Memory, Yvonne's talent 1); else the cast's own hits.
 */
function defaultConsumedScope(b: KitBuff, skills: readonly string[]): KitBuff["consumedScope"] {
  const attached = [...(b.gameBuff ? skillAttachedEffects("BuffData", b.gameBuff) : []), ...skills.flatMap((id) => skillAttachedEffects("SkillData", id))].filter((x) => x !== b.gameBuff);
  return attached.length ? "whileCasting" : undefined;
}

/** Checks and normalises the parts operator and equipment kits share: values, predicates, buffs, hits, triggers. */
function kitChecker(scope: KitScope) {
  const { stackIds, buffDefs } = scope;
  /** Per buff whose instances or layers a maxStackCntKey sets: whether each skill applying it has the key (B2: else the buff's own value). */
  const instanceKeySites = new Map<string, boolean[]>();
  const hasKey = (skillId: string, key: string): boolean => {
    if (!scope.isSource(skillId)) return false;
    try {
      scope.checkSourceKey(skillId, key, "");
      return true;
    } catch {
      return false;
    }
  };
  /** Every key a value names must exist in one of the kit's sources (a plain key names `skillId`). */
  const checkValue = (v: ValueExpr, skillId: string, where: string) => {
    let keys;
    try {
      keys = valueKeys(v, skillId, scope.talentSources);
    } catch (e) {
      throw new Error(`${where}: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
    for (const { skill: sid, key } of keys) {
      if (!scope.isSource(sid)) throw new Error(`${where}: ${sid} isn't one of ${scope.owner}'s value sources`);
      scope.checkSourceKey(sid, key, where);
    }
    // The own stacks and buffs it reads (stackCount, buffLayers, and its conditions').
    const refs = valueRefs(v);
    for (const id of refs.stacks) if (!stackIds.has(id)) throw new Error(`${where}: unknown stack ${id}`);
    for (const id of refs.buffs) if (!buffDefs.has(id)) throw new Error(`${where}: unknown buff ${id}`);
  };
  /** Every own stack and buff a predicate names must exist in the kit; with the skill it's judged for, the keys of the values it compares with too. */
  const checkPredicate = (p: Predicate, where: string, skillId?: string) => {
    const refs = predicateRefs(p);
    for (const id of refs.stacks) if (!stackIds.has(id)) throw new Error(`${where}: unknown stack ${id}`);
    for (const id of refs.buffs) if (!buffDefs.has(id)) throw new Error(`${where}: unknown buff ${id}`);
    if (skillId !== undefined) for (const v of predicateValues(p)) checkValue(v, skillId, where);
  };
  /** A forced reaction's level and extra seconds are values of the applying skill. */
  const checkApplicationValues = (a: KitApplication, skillId: string, where: string) => {
    // Keys naming the applying skill's values, checked here rather than when the hit lands.
    for (const k of ["durationKey", "scaleKey", "multiplierKey"] as const) {
      const key = (a as Partial<Record<typeof k, string>>)[k];
      if (key !== undefined) checkValue(key, skillId, `${where} ${a.kind} ${k}`);
    }
    // Only Breach has a strength for scaleKey to scale (status.ts), or the window's status when it's one.
    if (a.kind === "physicalStatus" && a.scaleKey !== undefined && a.status !== "breach" && a.status !== "event") throw new Error(`${where}: a ${a.status} has no strength for scaleKey ${a.scaleKey} to scale (only Breach's DMG Taken)`);
    if (a.kind !== "forcedReaction") return;
    if (a.level !== undefined) checkValue(a.level, skillId, `${where} forcedReaction level`);
    if (a.extraSeconds !== undefined) checkValue(a.extraSeconds, skillId, `${where} forcedReaction extraSeconds`);
  };
  const checkBuff = (b: KitBuff, skillId: string, where: string) => {
    for (const v of [b.duration, b.maxStacks, b.every, b.records?.rate, ...b.modifiers.map((m) => m.value)]) if (v !== undefined) checkValue(v, skillId, `${where}: buff ${b.id}`);
    if (b.records && b.target !== "enemy") throw new Error(`${where}: buff ${b.id}: only an enemy buff records the damage its target takes`);
    if (b.link && b.target !== "team") throw new Error(`${where}: buff ${b.id}: a Link stack is a team buff`);
    for (const m of b.modifiers) if ((m.zone === undefined) === (m.attr === undefined)) throw new Error(`${where}: buff ${b.id}: each modifier has a zone or an attribute`);
    for (const m of b.modifiers) if (m.attr !== undefined && !buffAttrHasEffect(m.attr)) throw new Error(`${where}: buff ${b.id}: attribute ${m.attr} feeds no damage zone and nothing reads it (ATK is the atk zone)`);
    for (const m of b.modifiers) if (m.percent && (m.attr === undefined || attrFeedsZone(m.attr))) throw new Error(`${where}: buff ${b.id}: a percentage is of an attribute read where the game reads it (DEF, Strength, …), not of a zone`);
    // Decorations filter what's judged per landing: a zone, an attribute feeding one, or Stagger efficiency (26).
    for (const m of b.modifiers) if (m.decorations && m.attr !== undefined && !attrFeedsZone(m.attr) && m.attr !== Attr.PoiseDamageOutputScalar) throw new Error(`${where}: buff ${b.id}: decorations filter landings: a zone, an attribute feeding one, or Stagger efficiency (26), not attribute ${m.attr}`);
    for (const m of b.modifiers) if (m.attr === Attr.PoiseDamageOutputScalar && m.percent) throw new Error(`${where}: buff ${b.id}: Stagger efficiency (26) is a ratio added to the panel's, not a percentage`);
    // Instances or layers kept by the applying skill's value (maxStackCntKey): whether this applier has the key (normalizeBuffs decides).
    const key = b.gameBuff ? capKey(b, gameBuffFile(scope.file, b.id, b.gameBuff)) : null;
    if (key !== null) instanceKeySites.set(b.id, [...(instanceKeySites.get(b.id) ?? []), hasKey(skillId, key)]);
    if (b.recipients && b.target !== "team") throw new Error(`${where}: buff ${b.id}: only team buffs have recipients`);
    // Recipient filters judge the recipient; its own stacks and buffs aren't the kit's, so they aren't checked here.
  };
  /**
   * Checks and fills in a list of hits: a skill's (its damage type, Final
   * Strike from the data) or a trigger's (each hit names its damage type).
   * `skillId` is where plain value keys come from.
   */
  const normalizeHits = (
    hits: readonly RawHit[],
    src: { skillId: string; label: string; damageType?: SkillType; checkScale: (key: string, where: string) => void; defaultEvent?: string; finalStrike?: (h: RawHit, events: string[]) => boolean; dive?: (h: RawHit, events: string[]) => boolean; buffTick?: boolean },
    where: string,
  ): KitHit[] => {
    const ids = new Set<string>();
    // Alternatives pair up landing by landing: a branch's hits land equally often.
    const branches = new Map<string, string>();
    for (const h of hits) {
      if (!h.branch) continue;
      const n = branches.get(h.branch);
      const count = JSON.stringify(h.count ?? h.frames?.length ?? 1);
      if (n !== undefined && n !== count) throw new Error(`${where} hit ${h.id}: the hits of branch ${h.branch} land a different number of times`);
      branches.set(h.branch, count);
    }
    return hits.map((h) => {
      if (src.damageType && h.damageType === src.damageType) throw new Error(`${where} hit ${h.id}: damageType ${h.damageType} is the skill's own (leave it out)`);
      if (h.poiseOnly) {
        if (h.poise === undefined || h.scale.length) throw new Error(`${where} hit ${h.id}: a poise-only landing has a poise and an empty scale`);
        const extra = (["scaleValue", "extraScale", "factor", "reaction", "fixedDamage", "base", "bonuses", "applies", "gains", "buffs", "energy", "sp", "spKind", "heals", "requires", "finalStrike"] as const).filter((k) => h[k] !== undefined);
        if (extra.length) throw new Error(`${where} hit ${h.id}: a poise-only landing deals only its poise (drop ${extra.join(", ")})`);
      }
      if (!src.damageType && !h.damageType) throw new Error(`${where} hit ${h.id}: a triggered hit needs a damageType`);
      if (ids.has(h.id)) throw new Error(`${where}: duplicate hit ${h.id}`);
      ids.add(h.id);
      for (const key of [...h.scale, ...(h.bonuses ?? []).map((b) => b.key)]) src.checkScale(key, `${where} hit ${h.id}`);
      for (const x of h.extraScale ?? []) {
        checkValue(x.value, src.skillId, `${where} hit ${h.id} extraScale`);
        checkPredicate(x.if, `${where} hit ${h.id} extraScale`);
      }
      if (h.scaleValue !== undefined) checkValue(h.scaleValue, src.skillId, `${where} hit ${h.id} scaleValue`);
      if (h.base !== undefined) checkValue(h.base, src.skillId, `${where} hit ${h.id} base`);
      for (const z of h.zoneScale ?? []) checkValue(z.value, src.skillId, `${where} hit ${h.id} zoneScale`);
      if (h.zoneScale && new Set(h.zoneScale.map((z) => z.zone)).size !== h.zoneScale.length) throw new Error(`${where} hit ${h.id}: zoneScale names a zone twice`);
      // The snapshot is the ticking buff's (taken when it was applied): only a buffTick trigger's hits have one.
      if (h.atkSnapshot && !src.buffTick) throw new Error(`${where} hit ${h.id}: atkSnapshot is for the hits of a buffTick trigger (the ticking buff keeps the snapshot)`);
      if (h.fixedDamage !== undefined) {
        checkValue(h.fixedDamage, src.skillId, `${where} hit ${h.id} fixedDamage`);
        if (h.scale.length || h.scaleValue !== undefined || h.extraScale || h.factor !== undefined || h.reaction || h.bonuses || h.zoneScale || h.atkSnapshot) throw new Error(`${where} hit ${h.id}: a Fixed DMG hit has no scale, factor, reaction, bonuses, zoneScale or atkSnapshot`);
      }
      if (h.if) checkPredicate(h.if, `${where} hit ${h.id}`, src.skillId);
      for (const x of [...(h.applies ?? []), ...(h.buffs ?? []), ...(h.gains ?? [])]) if (x.if) checkPredicate(x.if, `${where} hit ${h.id}`, src.skillId);
      for (const a of h.applies ?? []) checkApplicationValues(a, src.skillId, `${where} hit ${h.id}`);
      for (const g of h.gains ?? []) if (g.amount !== undefined) checkValue(g.amount, src.skillId, `${where} hit ${h.id} gains`);
      const element = h.element ?? scope.element;
      if (!element || !ELEMENTS.includes(element)) throw new Error(`${where} hit ${h.id}: no element`);
      const events = h.events ?? (src.defaultEvent && hits.length === 1 ? [src.defaultEvent] : []);
      for (const e of events) if (!isDataFile(e)) throw new Error(`${where} hit ${h.id}: event ${e} is no fetched SkillData or BuffData file (a log event key is the file holding the damage)`);
      if (!src.damageType && h.requires) throw new Error(`${where} hit ${h.id}: triggered hits can't require stacks (use the trigger's if)`);
      const consume = h.requires?.consume;
      if (consume !== undefined && typeof consume !== "boolean") checkValue(consume, src.skillId, `${where} hit ${h.id} requires.consume`);
      if (h.requires && h.requires.atLeast === undefined && h.requires.below === undefined) throw new Error(`${where} hit ${h.id}: requires needs atLeast or below`);
      for (const id of [h.requires?.stack, ...(h.gains ?? []).map((g) => g.stack)]) {
        if (id !== undefined && !stackIds.has(id)) throw new Error(`${where} hit ${h.id}: unknown stack ${id} (the kit's stacks: ${[...stackIds].join(", ") || "none"})`);
      }
      if (h.energy !== undefined) checkValue(h.energy, src.skillId, `${where} hit ${h.id} energy`);
      if (h.sp !== undefined) checkValue(h.sp, src.skillId, `${where} hit ${h.id} sp`);
      if (h.spBeforeDamage && h.sp === undefined) throw new Error(`${where} hit ${h.id}: spBeforeDamage needs the hit's sp`);
      if (h.poise !== undefined) checkValue(h.poise, src.skillId, `${where} hit ${h.id} poise`);
      for (const a of h.buffs ?? []) {
        const b = buffDefs.get(a.buff);
        if (!b) throw new Error(`${where} hit ${h.id}: unknown buff ${a.buff}`);
        checkBuff(b, src.skillId, `${where} hit ${h.id}`);
        if (a.duration !== undefined) checkValue(a.duration, src.skillId, `${where} hit ${h.id} buff ${a.buff} duration`);
        if (a.untilFrame !== undefined && !(Number.isInteger(a.untilFrame) && a.untilFrame > 0)) throw new Error(`${where} hit ${h.id}: buff ${a.buff} untilFrame must be a skill frame > 0`);
      }
      // A count that's a value is judged at the cast: its frames are the first landings', the rest repeat the last (framesEvery apart). Default: one per frame.
      const count = h.count ?? h.frames?.length ?? 1;
      if (typeof count === "number") {
        if (h.frames && h.frames.length !== count) throw new Error(`${where} hit ${h.id}: ${h.frames.length} frames for count ${JSON.stringify(count)}`);
        if (h.framesEvery !== undefined) throw new Error(`${where} hit ${h.id}: framesEvery is for a count that's a value`);
      } else checkValue(h.count as ValueExpr, src.skillId, `${where} hit ${h.id} count`);
      return {
        id: h.id, label: h.label ?? src.label, scale: h.scale, count, damageType: h.damageType ?? src.damageType ?? "none", element, events,
        ...(h.frames ? { frames: h.frames } : {}),
        ...(h.framesEvery !== undefined ? { framesEvery: h.framesEvery } : {}),
        ...(h.applies ? { applies: h.applies } : {}),
        ...(h.requires ? { requires: h.requires } : {}),
        ...(h.bonuses ? { bonuses: h.bonuses } : {}),
        ...(h.zoneScale ? { zoneScale: h.zoneScale } : {}),
        ...(h.atkSnapshot ? { atkSnapshot: true } : {}),
        ...(h.factor !== undefined ? { factor: h.factor } : {}),
        ...(h.reaction ? { reaction: h.reaction } : {}),
        ...(h.extraScale ? { extraScale: h.extraScale } : {}),
        ...(h.scaleValue !== undefined ? { scaleValue: h.scaleValue } : {}),
        ...(h.fixedDamage !== undefined ? { fixedDamage: h.fixedDamage } : {}),
        ...(h.base !== undefined ? { base: h.base } : {}),
        ...(h.buffs ? { buffs: h.buffs } : {}),
        ...(h.energy ? { energy: h.energy } : {}),
        ...(h.sp !== undefined ? { sp: h.sp } : {}),
        ...(h.spKind !== undefined ? { spKind: h.spKind } : {}),
        ...(h.spBeforeDamage ? { spBeforeDamage: true as const } : {}),
        ...(h.poise !== undefined ? { poise: h.poise } : {}),
        ...(h.poiseControlledOnly ? { poiseControlledOnly: true } : {}),
        ...(h.poiseOnly ? { poiseOnly: true as const } : {}),
        ...(h.heals ? { heals: h.heals } : {}),
        // A hit dealt from another SkillData file (a projectile or ability entity) is on its way and survives an interrupt.
        ...((h.detached ?? (h.launch !== undefined || (src.defaultEvent !== undefined && events.length > 0 && !events.includes(src.defaultEvent)))) ? { detached: true } : {}),
        ...(h.launch !== undefined ? { launch: h.launch } : {}),
        ...(h.if ? { if: h.if } : {}),
        ...(h.branch ? { branch: h.branch } : {}),
        ...((h.finalStrike ?? src.finalStrike?.(h, events) ?? false) ? { finalStrike: true } : {}),
        ...((h.dive ?? src.dive?.(h, events) ?? false) ? { dive: true } : {}),
        ...(h.gains ? { gains: h.gains.map((g) => ({ stack: g.stack, amount: (g.amount as ValueExpr | undefined) ?? 1, ...(g.if ? { if: g.if } : {}) })) } : {}),
      };
    });
  };
  const triggerIds = new Set<string>();
  const checkTrigger = (raw: Omit<RawTrigger, "note">): KitTrigger => {
    const where = `${scope.file}: trigger ${raw.id}`;
    const t = { ...raw, on: triggerOn(raw.on, where) };
    if (triggerIds.has(t.id)) throw new Error(`${where}: duplicate trigger ID`);
    triggerIds.add(t.id);
    const skillId = triggerSkillId(scope.owner, t);
    if (t.skill && !scope.isSource(t.skill)) throw new Error(`${where}: ${t.skill} isn't one of ${scope.owner}'s value sources`);
    if (t.on.event === "cast") for (const id of t.on.skills ?? []) if (!scope.isSkill(id)) throw new Error(`${where}: ${id} isn't a skill of ${scope.owner}`);
    if (t.on.event === "stackAtLeast" && !stackIds.has(t.on.stack)) throw new Error(`${where}: unknown stack ${t.on.stack}`);
    if ((t.on.event === "buffApplied" || t.on.event === "buffEnded" || t.on.event === "buffTick") && "buff" in t.on && !buffDefs.has(t.on.buff)) throw new Error(`${where}: unknown buff ${t.on.buff}`);
    if (t.on.event === "buffApplied" && "categories" in t.on && "buff" in t.on) throw new Error(`${where}: a buffApplied trigger names a buff or categories, not both`);
    if ("gameBuffs" in t.on) for (const id of t.on.gameBuffs) if (!isBuffFileListed(id) || !existsSync(buffFilePath(id))) throw new Error(`${where}: ${id} is no fetched BuffData file`);
    if (t.beforeDamage && !(STATUS_EVENTS as readonly string[]).includes(t.on.event)) throw new Error(`${where}: only status-event triggers can act before their hit's damage`);
    if (t.maxPerCast !== undefined && !(t.maxPerCast >= 1)) throw new Error(`${where}: maxPerCast must be at least 1`);
    if (t.detached && !(t.delay && t.on.event === "cast")) throw new Error(`${where}: only a delayed cast trigger can be detached from its cast`);
    if (t.awaited && !(t.delay && t.on.event === "cast" && !t.detached)) throw new Error(`${where}: only a delayed cast trigger that belongs to its cast can be awaited`);
    if (t.afterHits && !t.delay) throw new Error(`${where}: afterHits orders delayed actions (it needs a delay)`);
    if (t.launch !== undefined && !(t.detached && t.delay && Number.isInteger(t.launch) && t.launch >= 0 && t.launch <= t.delay)) throw new Error(`${where}: a launch frame needs a detached delayed cast trigger, at or before its delay`);
    if (t.if) checkPredicate(t.if, where, skillId);
    if (t.cooldown !== undefined) checkValue(t.cooldown, skillId, `${where} cooldown`);
    if (t.chance !== undefined) checkValue(t.chance, skillId, `${where} chance`);
    for (const a of flatActions(t.do)) {
      if (a.if) checkPredicate(a.if, where, skillId);
      switch (a.kind) {
        case "gain":
          for (const g of a.gains) {
            if (!stackIds.has(g.stack)) throw new Error(`${where}: gains unknown stack ${g.stack}`);
            if (g.if) checkPredicate(g.if, where, skillId);
            if ((g.amount as ValueExpr | undefined) !== undefined) checkValue(g.amount, skillId, `${where} gains`);
          }
          break;
        case "energy":
        case "sp":
          checkValue(a.value, skillId, `${where} ${a.kind}`);
          break;
        case "buff":
        case "endBuff": {
          const b = buffDefs.get(a.buff);
          if (!b) throw new Error(`${where}: unknown buff ${a.buff}`);
          if (a.kind === "buff") checkBuff(b, skillId, where);
          if (a.to && b.target !== "team") throw new Error(`${where}: buff ${a.buff} ${a.kind === "buff" ? "goes to" : "ends for"} the event's subject, so it must target the team`);
          if (a.kind === "endBuff" && a.to && a.layers !== undefined) throw new Error(`${where}: endBuff for the event's subject ends its use of every instance, not layers`);
          if (a.kind === "buff" && a.layers !== undefined) checkValue(a.layers, skillId, `${where} buff layers`);
          if (a.kind === "buff" && a.duration !== undefined) checkValue(a.duration, skillId, `${where} buff duration`);
          if (a.kind === "buff" && a.untilFrame !== undefined && !(Number.isInteger(a.untilFrame) && a.untilFrame > 0)) throw new Error(`${where}: buff ${a.buff} untilFrame must be a skill frame > 0`);
          break;
        }
        case "extendBuff":
          if (!buffDefs.has(a.buff)) throw new Error(`${where}: unknown buff ${a.buff}`);
          checkValue(a.seconds, skillId, `${where} extendBuff`);
          break;
        case "heal":
        case "clearEnergy":
        case "cancelHits":
        case "endAction":
          break;
        case "cast":
          if (!scope.isSkill(a.skill)) throw new Error(`${where}: ${a.skill} isn't one of ${scope.owner}'s skills`);
          break;
        case "jump":
          if (!scope.isSkill(a.skill)) throw new Error(`${where}: ${a.skill} isn't one of ${scope.owner}'s skills`);
          if (!(a.from < a.until && a.from < a.to)) throw new Error(`${where}: a jump moves forward from inside [from, until)`);
          break;
        case "cooldown": {
          const given = (["seconds", "fraction", "set", "setFraction"] as const).filter((k) => k in a);
          if (given.length !== 1) throw new Error(`${where}: a cooldown change has one of seconds, fraction, set or setFraction`);
          checkValue("seconds" in a ? a.seconds : "fraction" in a ? a.fraction : "set" in a ? a.set : a.setFraction, skillId, `${where} cooldown change`);
          break;
        }
        case "apply":
          for (const x of a.applies) {
            if (x.if) checkPredicate(x.if, where, skillId);
            if (x.afterDamage) throw new Error(`${where}: afterDamage is for a hit's applications (a trigger's apply action has no damage of its own)`);
            checkApplicationValues(x, skillId, where);
          }
          break;
        case "choose":
          // Its options' actions come after it in flatActions.
          if (a.options.length < 2) throw new Error(`${where}: a choose action has at least two options`);
          for (const o of a.options) checkValue(o.weight, skillId, `${where} choose weight`);
          break;
        case "link":
          if (a.count !== undefined) checkValue(a.count, skillId, `${where} link count`);
          if (a.seconds !== undefined) checkValue(a.seconds, skillId, `${where} link seconds`);
          break;
        case "openCombo":
          if (a.skills && a.skills.length === 0) throw new Error(`${where}: openCombo: skills names at least one skill`);
          for (const id of a.skills ?? []) if (!scope.isComboSkill?.(id)) throw new Error(`${where}: openCombo: ${id} isn't a combo skill of ${scope.owner}'s kit cast with the combo window`);
          if (a.whileBuff !== undefined) {
            const b = buffDefs.get(a.whileBuff);
            if (!b) throw new Error(`${where}: openCombo: unknown buff ${a.whileBuff}`);
            if (b.target === "enemy") throw new Error(`${where}: openCombo: the window lasts while one of the owner's own buffs is active, not an enemy debuff (${a.whileBuff})`);
          }
          if (a.seconds !== undefined) checkValue(a.seconds, skillId, `${where} openCombo seconds`);
          break;
        case "hits":
          break;
      }
    }
    const normalize = (list: readonly RawAction[]): TriggerAction[] =>
      list.map((a) =>
        a.kind === "gain" ? { ...a, gains: a.gains.map((g) => ({ stack: g.stack, amount: (g.amount as ValueExpr | undefined) ?? 1, ...(g.if ? { if: g.if } : {}) })) }
        : a.kind === "hits" ? { ...(a.if ? { if: a.if } : {}), ...(a.now ? { now: true } : {}), kind: "hits", hits: normalizeHits(a.hits, { skillId, label: t.id, checkScale: (key, w) => checkValue(key, skillId, w), buffTick: t.on.event === "buffTick" }, where) }
        : a.kind === "choose" ? { ...a, options: a.options.map((o) => ({ weight: o.weight, do: normalize(o.do) })) }
        : a,
      );
    return { ...t, do: normalize(t.do) };
  };
  /** The kit's buffs with their game buffs' rules; after every hit and trigger is checked (which skills apply each buff). */
  const normalizeBuffs = (buffs: readonly RawBuff[]): KitBuff[] =>
    buffs.map(({ note: _note, dataOverride: _d, ...b }) => {
      const sites = instanceKeySites.get(b.id);
      if (sites && sites.some((x) => x) && sites.some((x) => !x)) throw new Error(`${scope.file}: buff ${b.id}: some skills applying it have its game buff's maxStackCntKey and some don't`);
      if (b.consumedScope && !b.consumedBy) throw new Error(`${scope.file}: buff ${b.id}: consumedScope is for a buff a cast consumes (consumedBy)`);
      const consumedScope = b.consumedBy && b.consumedScope === undefined ? defaultConsumedScope(b, scope.castBuffSkills ?? []) : undefined;
      return withCategories(scope.file, withGameBuff(scope.file, consumedScope ? { ...b, consumedScope } : b, sites ? sites.every((x) => x) : undefined));
    });
  /** A kit's triggers, checked, with the triggers their actions name (cancelHits) among them. */
  const checkTriggers = (list: readonly Omit<RawTrigger, "note">[]): KitTrigger[] => {
    const out = list.map(checkTrigger);
    const ids = new Set(out.map((t) => t.id));
    for (const t of out) for (const a of allActions(t.do)) if (a.kind === "cancelHits" && !ids.has(a.trigger)) throw new Error(`${scope.file}: trigger ${t.id}: cancelHits names no trigger of this kit (${a.trigger})`);
    return out;
  };
  return { checkValue, checkPredicate, checkBuff, normalizeHits, checkTrigger, checkTriggers, normalizeBuffs, isSource: scope.isSource };
}

/**
 * Whether a basic attack is a chain step (attack2…, or attack4_1 beside
 * attack4): an earlier basic attack of the same chain lists it in a cancel
 * window. The last step lists the first (attack5 → attack1); that's the
 * chain looping, not a step.
 */
function isChainStep(data: KitData, kit: RawKit, skillId: string): boolean {
  const own = kit.skills.find((s) => s.skillId === skillId);
  // attack4_1: step 4, alternative 1 (comes after attack4).
  const order = (id: string) => {
    const m = /^(.*?)(\d+)(?:_(\d+))?$/.exec(id);
    return m ? { prefix: m[1] as string, n: Number(m[2]) + Number(m[3] ?? 0) / 100 } : null;
  };
  const me = order(skillId);
  if (!own || own.damageType !== "basic" || !me) return false;
  return kit.skills.some((y) => {
    const o = order(y.skillId);
    const t = data.skills[y.skillId]?.timing;
    return y.damageType === "basic" && o?.prefix === me.prefix && o.n < me.n && !!t && t.windows.some((w) => w.skills.includes(skillId));
  });
}

type RawSkill = RawKit["skills"][number];

/**
 * The cast triggers that belong to a skill's timeline: on its cast alone,
 * with its values (`skill`), without a random choice. Their hits land at the
 * delay plus their frames; their energy, SP and applications happen at the
 * delay. Only top-level actions count (not an action's alternatives).
 */
function castTriggers(skillId: string, triggers: readonly KitTrigger[]): KitTrigger[] {
  // One with a random choice (Purrchena's prezzies) has alternatives the data has as branches of one landing: left out.
  return triggers.filter((t) => t.on.event === "cast" && t.on.skills?.length === 1 && t.on.skills[0] === skillId && t.skill === skillId && !t.do.some((a) => a.kind === "choose"));
}

/**
 * A skill's (and its cast triggers') differences from the compiled data:
 * each must be marked in the kit (dataOverride, with the reason), and each
 * mark must be of a difference. Errors, or `options.disagreements`.
 */
function checkSkillData(compiled: CompiledSkill, s: RawSkill, hits: readonly KitHit[], teamEnergy: RawSkill["teamEnergy"], energyBlockSeconds: number | undefined, triggers: readonly KitTrigger[], kit: RawKit, where: string, options: KitLoadOptions): void {
  const own = castTriggers(s.skillId, triggers);
  const rawTriggers = new Map((kit.triggers ?? []).map((t) => [t.id, t]));
  const rawTriggerHit = (tid: string, hid: string): RawHit | undefined => {
    const list = (acts: readonly RawAction[]): RawHit[] => acts.flatMap((a) => (a.kind === "hits" ? a.hits : a.kind === "choose" ? a.options.flatMap((o) => list(o.do)) : []));
    return list(rawTriggers.get(tid)?.do ?? []).find((h) => h.id === hid);
  };
  // Top-level actions only: a choose action's options are alternatives the data has as branches.
  const triggerHits = own.flatMap((t) => t.do.flatMap((a) => (a.kind === "hits" ? a.hits.map((h) => ({ ...h, id: `${t.id}/${h.id}`, ...(h.frames ? { frames: h.frames.map((f) => f + (t.delay ?? 0)) } : {}) })) : [])));
  const actions: CastAction[] = own.flatMap((t) =>
    t.do.flatMap((a): CastAction[] =>
      a.kind === "energy" || a.kind === "sp" ? [{ trigger: t.id, frame: t.delay ?? 0, kind: a.kind, value: a.value }] : a.kind === "apply" ? [{ trigger: t.id, frame: t.delay ?? 0, kind: "apply", applies: a.applies }] : [],
    ),
  );
  const m = matchSkill(compiled, { skillId: s.skillId, hits, ...(teamEnergy ? { teamEnergy } : {}), ...(energyBlockSeconds !== undefined ? { energyBlockSeconds } : {}) }, kitEnergyBlock({ skillId: s.skillId, ...(energyBlockSeconds !== undefined ? { energyBlockSeconds } : {}) }, kit.triggers ?? [], kit.buffs ?? []), { triggerHits, actions });
  const byId = new Map(s.hits.map((h) => [h.id, h]));
  const hitOf = (id: string) => (id.includes("/") ? rawTriggerHit(id.slice(0, id.indexOf("/")), id.slice(id.indexOf("/") + 1)) : byId.get(id));
  const reason = (d: Disagreement) => (d.trigger !== undefined ? rawTriggers.get(d.trigger)?.dataOverride?.[d.field as "energy" | "sp" | "apply"] : d.hit !== undefined ? hitOf(d.hit)?.dataOverride?.[d.field as DataField] : s.dataOverride?.[d.field]);
  const found = new Set(m.disagreements.map((d) => `${d.trigger ?? ""}|${d.hit ?? ""}|${d.field}`));
  const stale = (text: string) => `${text}: marked as differing from the data (dataOverride), but it agrees`;
  const problems = [
    ...m.disagreements.filter((d) => reason(d) === undefined).map((d) => ({ ...d, stale: false })),
    ...Object.keys(s.dataOverride ?? {}).filter((f) => !found.has(`||${f}`)).map((field) => ({ field, text: stale(`${s.skillId} ${field}`), stale: true })),
    ...[...s.hits.map((h) => ({ id: h.id, h })), ...triggerHits.map((x) => ({ id: x.id, h: hitOf(x.id) }))].flatMap(({ id, h }) => Object.keys(h?.dataOverride ?? {}).filter((f) => !found.has(`|${id}|${f}`)).map((field) => ({ hit: id, field, text: stale(`${s.skillId}/${id} ${field}`), stale: true }))),
    ...own.flatMap((t) => Object.keys(rawTriggers.get(t.id)?.dataOverride ?? {}).filter((f) => !found.has(`${t.id}||${f}`)).map((field) => ({ trigger: t.id, field, text: stale(`${s.skillId} trigger ${t.id} ${field}`), stale: true }))),
  ];
  if (options.disagreements) for (const d of problems) options.disagreements({ ...d, skillId: s.skillId });
  else if (problems.length) throw new Error(`${where}: differs from the compiled SkillData (fix the kit, or mark the field in dataOverride with the reason):\n  ${problems.map((d) => d.text).join("\n  ")}`);
}

/** A buff duration as the comparison reads it: a key of a skill, a literal number of seconds, until ended, or null when it can't be said. */
type DurationRef = { readonly key: string; readonly skill: string } | { readonly seconds: number } | "untilEnded" | null;

const durationText = (d: DurationRef) => (d === null ? "?" : d === "untilEnded" ? "until ended" : "seconds" in d ? `${d.seconds} s` : `${d.key} of ${d.skill}`);

/** A kit duration (an application's, else its buff's) for the skill applying it: a key names that skill's value; talent keys and expressions can't be compared. */
function kitDuration(v: ValueExpr | undefined, skillId: string): DurationRef {
  if (v === undefined) return "untilEnded";
  if (typeof v === "number") return { seconds: v };
  if (typeof v === "string") return { key: v, skill: skillId };
  if (v && typeof v === "object" && "key" in v && "skill" in v && typeof v.key === "string" && typeof v.skill === "string" && Object.keys(v).length === 2) return { key: v.key, skill: v.skill };
  return null;
}

/** The data's duration of a buff a skill creates: a key the CreateBuff assigns from the skill, the buff file's own value (a literal), 9999 or less than 0 until ended; null when it's runtime state or an expression. */
function dataDuration(d: CompiledValue | null, buffFile: string): DurationRef {
  if (!d || d.expr || d.value === null) return null;
  if (d.value < 0 || d.value >= 9999) return "untilEnded";
  if (d.keys.length === 0) return { seconds: Math.round(d.value * 1e6) / 1e6 };
  if (d.keys.length !== 1 || d.factor !== 1 || d.dynamic) return null;
  const origin = d.origins[0] as string;
  return origin === buffFile ? { seconds: Math.round(d.value * 1e6) / 1e6 } : { key: d.keys[0] as string, skill: origin };
}

/**
 * The durations of the kit buffs standing for a game buff (`gameBuff`)
 * against the data's CreateBuff of it, where a skill's hit or own cast
 * trigger applies it and the skill's compiled data creates it: each
 * difference marked on the buff (dataOverride.duration, with the reason),
 * each mark a difference. Errors, or `options.disagreements`.
 */
function checkBuffDurations(data: KitData, kit: RawKit, skills: readonly { skillId: string; hits: readonly KitHit[] }[], triggers: readonly KitTrigger[], where: string, options: KitLoadOptions): void {
  const raws = new Map((kit.buffs ?? []).map((b) => [b.id, b]));
  const apps: { skill: string; buff: string; duration: ValueExpr | undefined; at: string }[] = [];
  for (const s of skills) for (const h of s.hits) for (const a of h.buffs ?? []) apps.push({ skill: s.skillId, buff: a.buff, duration: a.duration ?? raws.get(a.buff)?.duration, at: `${s.skillId}/${h.id}` });
  for (const s of skills) for (const t of castTriggers(s.skillId, triggers)) for (const a of t.do) if (a.kind === "buff") apps.push({ skill: s.skillId, buff: a.buff, duration: a.duration ?? raws.get(a.buff)?.duration, at: `${s.skillId} trigger ${t.id}` });
  const found = new Map<string, string>();
  for (const a of apps) {
    const b = raws.get(a.buff);
    if (!b?.gameBuff) continue;
    const c = compileOperatorSkill(data, kit.operator, a.skill);
    const made = (c?.buffs ?? []).filter((x) => x.buff === b.gameBuff).map((x) => dataDuration(x.duration, b.gameBuff as string)).filter((x) => x !== null);
    const mine = kitDuration(a.duration, a.skill);
    if (!made.length || mine === null) continue;
    if (!made.some((x) => JSON.stringify(x) === JSON.stringify(mine)) && !found.has(b.id)) found.set(b.id, `${a.at}: buff ${b.id} (${b.gameBuff}) duration: kit ${durationText(mine)}, data ${[...new Set(made.map(durationText))].join(" | ")}`);
  }
  const problems = [
    ...[...found].filter(([id]) => raws.get(id)?.dataOverride?.duration === undefined).map(([, text]) => ({ text, stale: false })),
    ...[...raws.values()].filter((b) => b.dataOverride?.duration !== undefined && !found.has(b.id)).map((b) => ({ text: `buff ${b.id} duration: marked as differing from the data (dataOverride), but it agrees or isn't compared`, stale: true })),
  ];
  if (options.disagreements) for (const d of problems) options.disagreements({ field: "duration", text: d.text, stale: d.stale, skillId: "" });
  else if (problems.length) throw new Error(`${where}: buff durations differ from the compiled SkillData (fix the kit, or mark the buff's dataOverride.duration with the reason):\n  ${problems.map((d) => d.text).join("\n  ")}`);
}

/**
 * An equipment kit's triggered hits against the compiled skill they take
 * their values from (`skill`), where it has landings in the files they're
 * logged under (a weapon skill's ability-event handler); each difference
 * marked in the hit's dataOverride, each mark a difference.
 */
function checkEquipmentData(data: KitData, kit: RawEquipmentKit, triggers: readonly KitTrigger[], where: string): void {
  const raws = new Map((kit.triggers ?? []).map((t) => [t.id, t]));
  for (const t of triggers) {
    const hits = t.do.flatMap((a) => (a.kind === "hits" ? a.hits : []));
    const c = t.skill && hits.length ? compileEquipmentSkill(data, t.skill) : null;
    if (!c) continue;
    const files = new Set(c.landings.map((l) => l.file));
    const compared = hits.filter((h) => h.events.some((e) => files.has(e)));
    const rawHits = (raws.get(t.id)?.do ?? []).flatMap((a) => (a.kind === "hits" ? a.hits : []));
    const m = matchSkill(c, { skillId: t.skill as string, hits: compared }, null, { hitsOnly: true });
    const found = new Set(m.disagreements.map((d) => `${d.hit ?? ""} ${d.field}`));
    const problems = [
      ...m.disagreements.filter((d) => rawHits.find((h) => h.id === d.hit)?.dataOverride?.[d.field as DataField] === undefined).map((d) => d.text),
      ...rawHits.flatMap((h) => Object.keys(h.dataOverride ?? {}).filter((f) => !found.has(`${h.id} ${f}`)).map((f) => `${t.id}/${h.id} ${f}: marked as differing from the data (dataOverride), but it agrees`)),
    ];
    if (problems.length) throw new Error(`${where}: trigger ${t.id} differs from the compiled SkillData of ${t.skill} (fix the kit, or mark the field in dataOverride with the reason):\n  ${problems.join("\n  ")}`);
  }
}

/**
 * A skill hit with the fields it leaves out taken from what the data says of
 * its landings (hitFacts): frames, events, factor, element (when it isn't the
 * kit's), stagger and whether only while controlled, detached, energy.
 */
function withDataFacts(h: RawHit, all: HitFacts, kitElement: Element | undefined): RawHit {
  const f = Object.fromEntries(Object.entries(all).filter(([k]) => h.dataOverride?.[k as DataField] === undefined)) as HitFacts;
  const poise = h.poise ?? (f.poise !== undefined && f.poise !== null ? (f.poise as ValueExpr) : undefined);
  return {
    ...h,
    ...(h.frames === undefined && f.frames ? { frames: [...f.frames] } : {}),
    ...(h.events === undefined && f.events ? { events: [...f.events] } : {}),
    ...(h.factor === undefined && f.factor !== undefined && f.factor !== 1 ? { factor: f.factor } : {}),
    ...(h.element === undefined && f.element !== undefined && f.element !== kitElement ? { element: f.element } : {}),
    ...(h.poise === undefined && poise !== undefined ? { poise } : {}),
    ...(h.poiseControlledOnly === undefined && poise !== undefined && f.poiseControlledOnly ? { poiseControlledOnly: true } : {}),
    ...(h.detached === undefined && f.detached !== undefined ? { detached: f.detached } : {}),
    ...(h.energy === undefined && f.energy !== undefined && f.energy !== null ? { energy: f.energy as ValueExpr } : {}),
    ...(h.sp === undefined && f.sp !== undefined && f.sp !== null ? { sp: f.sp as ValueExpr, ...(h.spBeforeDamage === undefined && f.spBeforeDamage ? { spBeforeDamage: true as const } : {}) } : {}),
  };
}

function idsOf(file: string, what: string, items: readonly { id: string }[]): Set<string> {
  const ids = new Set(items.map((x) => x.id));
  if (ids.size !== items.length) throw new Error(`${file}: duplicate ${what} ID`);
  return ids;
}

/** How to load a kit file. */
export interface KitLoadOptions {
  /**
   * Receives each difference from the compiled data that the kit doesn't
   * mark (and each mark where nothing differs, `stale`) instead of an error
   * (for tools that write the marks).
   */
  readonly disagreements?: (d: Disagreement & { readonly skillId: string; readonly stale: boolean }) => void;
}

function loadOperatorKit(data: KitData, file: string, kit: RawKit, options: KitLoadOptions = {}): OperatorKit {
  const where0 = `kits/operators/${file}`;
  if (file !== `${kit.operator}.json`) throw new Error(`${where0}: file name must be ${kit.operator}.json`);
  const op = data.operators[kit.operator];
  if (!op) throw new Error(`${where0}: unknown operator ${kit.operator}`);
  /** Values talents and potentials attach (skill or buff ID → keys at some level), for kits to read. */
  const attached = new Map<string, Set<string>>();
  for (const e of [...(op.talentNodes ?? []).flatMap((n) => n.effects), ...(op.potentials ?? []).flat()]) {
    if (e.kind !== "skill" && e.kind !== "buff") continue;
    const id = e.kind === "skill" ? e.skillId : e.buffId;
    attached.set(id, new Set([...(attached.get(id) ?? []), ...Object.keys(e.blackboard)]));
  }
  const ownSkill = (id: string) => data.skills[id] !== undefined && op.skillGroups[id] !== undefined;
  const c = kitChecker({
    file: where0,
    owner: kit.operator,
    ...(kit.element ? { element: kit.element } : {}),
    stackIds: idsOf(where0, "stack", kit.stacks ?? []),
    buffDefs: new Map((kit.buffs ?? []).map((b) => [b.id, b])),
    isSkill: ownSkill,
    isComboSkill: (id) => kit.skills.some((x) => x.skillId === id && x.damageType === "combo" && x.comboWindow !== false),
    isSource: (id) => attached.has(id) || ownSkill(id),
    talentSources: (i) => {
      const index = [...new Set((op.talentNodes ?? []).map((n) => n.index))].sort((a, b) => a - b)[i];
      return [...new Set((op.talentNodes ?? []).filter((n) => n.index === index).flatMap((n) => n.effects.flatMap((e) => (e.kind === "buff" ? [e.buffId] : e.kind === "skill" ? [e.skillId] : []))))];
    },
    checkSourceKey: (id, key, where) => {
      const keys = attached.get(id);
      if (keys) {
        if (!keys.has(key)) throw new Error(`${where}: ${id} (attached by a talent or potential) has no value ${key}`);
      } else checkKey(data.skills[id] as SkillData, key, where);
    },
  });
  idsOf(where0, "buff", kit.buffs ?? []);
  const dataChecks: ((triggers: readonly KitTrigger[]) => void)[] = [];
  const skills = kit.skills.map((s) => {
    const where = `${where0}: ${s.skillId}`;
    const skill = data.skills[s.skillId];
    if (!skill) throw new Error(`${where}: unknown skill`);
    if (op.skillGroups[s.skillId] === undefined) throw new Error(`${where}: not one of ${kit.operator}'s skills`);
    if (s.available) c.checkPredicate(s.available, `${where} available`);
    for (const part of s.teamEnergy ?? []) if (part.if) c.checkPredicate(part.if, `${where} teamEnergy`);
    // Parts may add up to more than the whole when jumps make them exclusive (Arclight's battle skill: frame 24 on one path, 136 on the other).
    if (s.beside) c.checkPredicate(s.beside, `${where} beside`);
    for (const j of s.jumps ?? []) {
      const matching = (skill.timing?.jumps ?? []).filter((x) => x.conditional && x.at === j.at && (j.to === undefined || x.to === j.to));
      if (matching.length === 0) throw new Error(`${where}: jumps: the skill has no conditional jump at frame ${j.at}${j.to !== undefined ? ` to ${j.to}` : ""} (its jumps: ${(skill.timing?.jumps ?? []).map((x) => `${x.at}→${x.to}${x.conditional ? "?" : ""}`).join(", ") || "none"})`);
      if (matching.length > 1) throw new Error(`${where}: jumps: several conditional jumps at frame ${j.at}; say which with \`to\` (${matching.map((x) => x.to).join(", ")})`);
      c.checkPredicate(j.if, `${where} jump at ${j.at}`);
    }
    // A conditional window (under a TogglableAction or an IfElse branch) is open when the kit says: by its frame, and its skills to tell two apart.
    const conditional = (skill.timing?.windows ?? []).filter((x) => x.conditional);
    const sameSkills = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
    for (const w of s.windows ?? []) {
      if (!conditional.some((x) => x.from === w.from && (w.skills === undefined || sameSkills(w.skills, x.skills)))) {
        throw new Error(`${where}: windows: the skill has no conditional window from frame ${w.from}${w.skills ? ` for ${w.skills.join(", ")}` : ""} (its conditional windows: ${conditional.map((x) => `${x.from}–${x.to} ${x.skills.join("+")}`).join(", ") || "none"})`);
      }
      if (w.if) c.checkPredicate(w.if, `${where} window from ${w.from}`);
    }
    if (s.comboWindow === false && s.damageType !== "combo") throw new Error(`${where}: comboWindow: false is for a combo-kind skill`);
    const hitSource = { skillId: s.skillId, damageType: s.damageType, label: s.label, checkScale: (key: string, w: string) => checkKey(skill, key, w), defaultEvent: s.skillId, finalStrike: (_h: RawHit, events: string[]) => isFinalStrike(s.skillId, events, s.hits.length), dive: (_h: RawHit, events: string[]) => isDive(s.skillId, events, s.hits.length) };
    // What the kit leaves out, from the compiled SkillData where its landings say it (kitMatch.ts).
    const compiled = compileOperatorSkill(data, kit.operator, s.skillId);
    let rawHits = s.hits;
    let teamEnergy = s.teamEnergy;
    let energyBlockSeconds = s.energyBlockSeconds;
    if (compiled) {
      const first = c.normalizeHits(s.hits, hitSource, where);
      const m = matchSkill(compiled, { skillId: s.skillId, hits: first, ...(s.teamEnergy ? { teamEnergy: s.teamEnergy } : {}), ...(s.energyBlockSeconds !== undefined ? { energyBlockSeconds: s.energyBlockSeconds } : {}) }, kitEnergyBlock(s, kit.triggers ?? [], kit.buffs ?? []));
      // SP from the data only where it says all of the skill's (else, unless the kit names SP, the engine's first-hit atb stays).
      const spFromData = s.hits.some((h) => h.sp !== undefined) || spPlaced(m.folded, m.hits);
      rawHits = s.hits.map((h) => {
        const f = h.poiseOnly || h.reaction ? {} : hitFacts(m.folded, m.hits.get(h.id));
        const { sp: _sp, spBeforeDamage: _b, ...noSp } = f;
        // An SP key without a value at every level of the skill (Antal's finisher's atb) isn't one to fill in.
        const spKnown = (() => {
          try {
            if (f.sp !== undefined && f.sp !== null) c.checkValue(f.sp as ValueExpr, s.skillId, where);
            return true;
          } catch {
            return false;
          }
        })();
        return withDataFacts(h, spFromData && spKnown ? f : noSp, kit.element);
      });
      // The skill's team energy and energy block, when it leaves them out (and gives no energy-blocking buff of its own).
      if (s.teamEnergy === undefined && s.dataOverride?.["teamEnergy"] === undefined) {
        const parts = dataTeamEnergy(m.folded);
        if (parts.length && !(parts.length === 1 && parts[0]?.frame === 0 && parts[0].ratio === 1 && !parts[0].detached)) teamEnergy = parts.map((p) => ({ frame: p.frame, ratio: p.ratio, ...(p.detached ? { detached: true } : {}) }));
      }
      const block = dataEnergyBlockSeconds(m.folded);
      if (s.energyBlockSeconds === undefined && s.dataOverride?.["energyBlockSeconds"] === undefined && block !== null && kitEnergyBlock(s, kit.triggers ?? [], kit.buffs ?? []) === null) energyBlockSeconds = block;
    }
    if (s.noDodge && !(s.noDodge[0] >= 0 && s.noDodge[0] < s.noDodge[1])) throw new Error(`${where}: noDodge is a range [from, until) of skill frames`);
    // A skill hit lands at frames: its own, or the data's when its landings are one branch path no other hit takes landings of.
    for (const h of rawHits) if (!h.frames) throw new Error(`${where} hit ${h.id}: no frames, and the data's landings for it ${compiled ? "aren't one branch path of its own (write its frames)" : "aren't known (no SkillData file)"}`);
    const hits = c.normalizeHits(rawHits, hitSource, where);
    // What still differs from the data must be marked, with the reason (dataOverride): checked once the triggers are (a cast trigger's hits and actions are the skill's).
    if (compiled) dataChecks.push((triggers) => checkSkillData(compiled, s, hits, teamEnergy, energyBlockSeconds, triggers, kit, where, options));
    return {
      skillId: s.skillId,
      label: s.label,
      kind: s.damageType,
      ...(energyBlockSeconds !== undefined ? { energyBlockSeconds } : {}),
      ...(s.jumps ? { jumps: s.jumps } : {}),
      ...(teamEnergy !== undefined ? { teamEnergy } : {}),
      ...(s.available ? { available: s.available } : {}),
      ...(s.followUpOnly ? { followUpOnly: true } : {}),
      ...(s.takesControl ? { takesControl: true } : {}),
      ...(s.beside ? { beside: s.beside } : {}),
      ...(s.cooldownGroup ? { cooldownGroup: s.cooldownGroup } : {}),
      ...((s.chainStep ?? isChainStep(data, kit, s.skillId)) ? { chainStep: true } : {}),
      ...(s.windows ? { windows: s.windows } : {}),
      ...(s.comboWindow === false ? { comboWindow: false as const } : {}),
      ...(s.noDodge ? { noDodge: s.noDodge } : {}),
      hits,
    };
  });
  // Triggers first: normalizeBuffs reads which skills apply each buff.
  const triggers = c.checkTriggers((kit.triggers ?? []).map(({ note: _note, dataOverride: _d, ...t }) => t));
  for (const check of dataChecks) check(triggers);
  checkBuffDurations(data, kit, skills, triggers, where0, options);
  const buffs = c.normalizeBuffs(kit.buffs ?? []);
  // A buff that maps the basic-attack input maps it to one of the kit's basic attacks.
  for (const b of buffs) {
    if (b.basicAttack === undefined) continue;
    if (b.target === "enemy") throw new Error(`${where0}: buff ${b.id}: an enemy debuff can't map its owner's basic-attack input`);
    if (!kit.skills.some((x) => x.skillId === b.basicAttack && x.damageType === "basic")) throw new Error(`${where0}: buff ${b.id}: maps the basic-attack input to ${b.basicAttack}, which isn't a basic attack of the kit`);
  }
  return {
    operator: kit.operator,
    stacks: (kit.stacks ?? []).map((x) => {
      if (x.initial !== undefined) c.checkValue(x.initial, "", `${where0}: stack ${x.id} initial`);
      return { id: x.id, label: x.label, max: x.max, ...(x.initial !== undefined ? { initial: x.initial } : {}) };
    }),
    ...(kit.activeConditions ? { activeConditions: kit.activeConditions } : {}),
    triggers,
    buffs,
    ...(kit.statusTweaks
      ? {
          statusTweaks: kit.statusTweaks.map(({ note: _note, ...t }) => {
            if (t.skill && !c.isSource(t.skill)) throw new Error(`${where0}: status tweak: ${t.skill} isn't one of ${kit.operator}'s value sources`);
            for (const v of [t.extraSeconds, t.capScale]) if (v !== undefined) c.checkValue(v, t.skill ?? "", `${where0}: status tweak ${t.status}`);
            return t;
          }),
        }
      : {}),
    skills,
  };
}

/**
 * A weapon's or gear set's kit. Its stack, buff and trigger IDs start with
 * `<equipment ID>.`, so they can't clash with the wearer's own; its values
 * come from its own skills (a weapon's skills, a gear set's set skill).
 */
function loadEquipmentKit(data: KitData, file: string, kit: RawEquipmentKit): EquipmentKit {
  const where0 = `kits/equipment/${file}`;
  const id = kit.equipment;
  if (file !== `${id}.json`) throw new Error(`${where0}: file name must be ${id}.json`);
  const weapon = data.weapons[id];
  const set = data.gearSets[id];
  if (!weapon && !set) throw new Error(`${where0}: ${id} is neither a weapon nor a gear set`);
  const skills = new Set(weapon ? weapon.skills : [(set as { skillId: string }).skillId]);
  for (const [what, items] of [["stack", kit.stacks ?? []], ["buff", kit.buffs ?? []], ["trigger", kit.triggers ?? []]] as const) {
    for (const x of items) if (!x.id.startsWith(`${id}.`)) throw new Error(`${where0}: ${what} ${x.id} must start with "${id}."`);
  }
  const c = kitChecker({
    file: where0,
    owner: id,
    stackIds: idsOf(where0, "stack", kit.stacks ?? []),
    buffDefs: new Map((kit.buffs ?? []).map((b) => [b.id, b])),
    // Equipment acts for any wearer, so its cast filters can only be by kind.
    isSkill: () => false,
    castBuffSkills: [...skills],
    isSource: (sid) => skills.has(sid) && data.skills[sid] !== undefined,
    checkSourceKey: (sid, key, where) => checkKey(data.skills[sid] as SkillData, key, where),
  });
  idsOf(where0, "buff", kit.buffs ?? []);
  // Triggers first: normalizeBuffs reads which skills apply each buff.
  const triggers = c.checkTriggers((kit.triggers ?? []).map(({ note: _note, ...t }) => t));
  const buffs = c.normalizeBuffs(kit.buffs ?? []);
  for (const b of buffs) if (b.basicAttack !== undefined) throw new Error(`${where0}: buff ${b.id}: equipment can't map its wearer's basic-attack input (${b.basicAttack})`);
  checkEquipmentData(data, kit, triggers, where0);
  return {
    id,
    stacks: (kit.stacks ?? []).map((x) => {
      if (x.initial !== undefined) c.checkValue(x.initial, "", `${where0}: stack ${x.id} initial`);
      return { id: x.id, label: x.label, max: x.max, ...(x.initial !== undefined ? { initial: x.initial } : {}) };
    }),
    triggers,
    buffs,
  };
}

/**
 * A kit under another operator ID: every string naming the operator's skills
 * or log keys (`<operator>_…`) is renamed to the other ID's, after the
 * explicit `skills` renames; game-buff IDs (`buff_…`, shared by both) stay.
 */
function variantOf(kit: RawKit, variant: { operator: string; skills?: Record<string, string> }): RawKit {
  const from = `${kit.operator}_`;
  const to = `${variant.operator}_`;
  const rename = (x: unknown): unknown => {
    if (typeof x === "string") return variant.skills?.[x] ?? (x.startsWith(from) ? to + x.slice(from.length) : x);
    if (Array.isArray(x)) return x.map(rename);
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === "note" || k === "label" ? v : rename(v)]));
    return x;
  };
  const { variants: _variants, ...rest } = kit;
  return { ...(rename(rest) as RawKit), operator: variant.operator };
}

/**
 * Weapons without a kit of their own that wear another weapon's: the one
 * (first by ID) with the same skill list (WeaponBasicTable weaponSkillList,
 * which holds weaponPotentialSkill too), e.g. a skin such as
 * wpn_sword_0021_ink. Variant → the weapon whose kit it uses.
 */
export function weaponVariants(weapons: KitData["weapons"], kitted: ReadonlySet<string>): Map<string, string> {
  const out = new Map<string, string>();
  const key = (id: string) => JSON.stringify(weapons[id]?.skills ?? []);
  const sources = [...kitted].filter((id) => weapons[id] && (weapons[id]?.skills.length ?? 0) > 0).sort();
  for (const id of Object.keys(weapons).sort()) {
    if (kitted.has(id)) continue;
    const src = sources.find((s) => key(s) === key(id));
    if (src) out.set(id, src);
  }
  return out;
}

/** An equipment kit under another equipment ID: its own IDs (`<id>.…`) renamed. */
function equipmentVariantOf(kit: RawEquipmentKit, id: string): RawEquipmentKit {
  const from = `${kit.equipment}.`;
  const rename = (x: unknown): unknown => {
    if (typeof x === "string") return x.startsWith(from) ? `${id}.${x.slice(from.length)}` : x;
    if (Array.isArray(x)) return x.map(rename);
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === "note" || k === "label" ? v : rename(v)]));
    return x;
  };
  return { ...(rename(kit) as RawEquipmentKit), equipment: id, sources: [...kit.sources, `Variant of ${kit.equipment} (same weapon skills): its kit, renamed.`] };
}

let validatorCache: ReturnType<typeof validator> | undefined;

/**
 * One operator kit file's contents (`raw`, as parsed), checked against the
 * schema and loaded: the kit, and its variants after it.
 */
export function loadOperatorKitFile(data: KitData, file: string, raw: unknown, options: KitLoadOptions = {}): OperatorKit[] {
  const v = (validatorCache ??= validator());
  if (!v.kit) throw new Error("kit schema not registered");
  if (!v.kit(raw)) throw new Error(`kits/operators/${file}: ${v.ajv.errorsText(v.kit.errors)}`);
  const kit = raw as RawKit;
  return [loadOperatorKit(data, file, kit, options), ...(kit.variants ?? []).map((variant) => loadOperatorKit(data, `${variant.operator}.json`, variantOf(kit, variant), options))];
}

/** Loads the kits under `dir` (default packages/data/kits: its operators/ and equipment/ folders). */
export function loadKits(data: KitData, dir: string = KITS): Kits {
  const v = (validatorCache ??= validator());
  const operators: Record<string, OperatorKit> = {};
  const odir = join(dir, "operators");
  for (const file of existsSync(odir) ? readdirSync(odir).filter((f) => f.endsWith(".json")).sort() : []) {
    const [kit, ...variants] = loadOperatorKitFile(data, file, readJson(join(odir, file))) as [OperatorKit, ...OperatorKit[]];
    operators[kit.operator] = kit;
    for (const other of variants) {
      if (operators[other.operator]) throw new Error(`kits/operators/${file}: ${other.operator} has a kit of its own too`);
      operators[other.operator] = other;
    }
  }
  const equipment: Record<string, EquipmentKit> = {};
  const raws = new Map<string, RawEquipmentKit>();
  const edir = join(dir, "equipment");
  for (const file of existsSync(edir) ? readdirSync(edir).filter((f) => f.endsWith(".json")).sort() : []) {
    const raw = readJson(join(edir, file));
    if (!v.equipment(raw)) throw new Error(`kits/equipment/${file}: ${v.ajv.errorsText(v.equipment.errors)}`);
    const kit = loadEquipmentKit(data, file, raw as RawEquipmentKit);
    equipment[kit.id] = kit;
    raws.set(kit.id, raw as RawEquipmentKit);
  }
  for (const [id, src] of weaponVariants(data.weapons, new Set(raws.keys()))) equipment[id] = loadEquipmentKit(data, `${id}.json`, equipmentVariantOf(raws.get(src) as RawEquipmentKit, id));
  return { operators, equipment };
}
