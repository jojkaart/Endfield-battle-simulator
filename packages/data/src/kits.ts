// Loads the hand-written kits (packages/data/kits) and checks them against
// the game data: every skill, level group and blackboard key must exist.
// Operator kits (kits/operators) hold skills, stacks, buffs and triggers;
// equipment kits (kits/equipment: weapons and gear sets) hold stacks, buffs,
// triggers and conditions that act for whoever wears them.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { damageSites, operatorSkillFiles } from "./skillGraph.ts";
import { isSkillFileListed, skillFilePath } from "./skillData.ts";
import { isBuffFileListed, readBuffFile, type RawBuffFile } from "./buffData.ts";
import { attrFeedsZone, buffAttrHasEffect, type KitBuffModifier, ELEMENTS, predicateRefs, valueRefs, allActions, STATUS_EVENTS, triggerSkillId, type KitHit, type Effect, valueKeys, type BuffApplication, type Condition, type KitTrigger, type TriggerAction, type KitBuff, type Predicate, type ValueExpr, type KitApplication, type StatusTweak, type StackDef, type StackRequirement, type Element, type EquipmentKit, type Kits, type OperatorKit, type SkillData, type SkillType, type Zone } from "@efsim/engine";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KITS = join(ROOT, "packages/data/kits");

interface RawCondition {
  id: string;
  label: string;
  source:
    | { kind: "talent"; index: number; buffId: string; key: string; scale?: number }
    | { kind: "weaponSkill"; skill: number; key: string; scale?: number }
    | { kind: "skill"; skillId: string; key: string; scale?: number };
  effect: { kind: "attr"; attr: number } | { kind: "zone"; zone: Zone; element?: Element; skillType?: SkillType };
}

interface RawHit {
  id: string; label?: string; scale: string[]; count?: ValueExpr; framesEvery?: number; element?: Element; events?: string[]; frames?: number[];
  applies?: KitApplication[]; requires?: StackRequirement; gains?: { stack: string; amount?: ValueExpr; if?: Predicate }[];
  bonuses?: { zone: Zone; key: string }[];
  finalStrike?: boolean;
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
}

type RawAction =
  | Exclude<TriggerAction, { kind: "hits" } | { kind: "choose" }>
  | { kind: "hits"; hits: RawHit[]; if?: Predicate; now?: boolean }
  | { kind: "choose"; options: { weight: ValueExpr; do: RawAction[] }[]; if?: Predicate };

type RawTrigger = Omit<KitTrigger, "do"> & { note?: string; do: RawAction[] };

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
    hits: RawHit[];
  }[];
  conditions?: RawCondition[];
}

interface RawEquipmentKit {
  equipment: string;
  sources: string[];
  stacks?: StackDef[];
  buffs?: RawBuff[];
  triggers?: RawTrigger[];
  conditions?: RawCondition[];
}

type RawBuff = KitBuff & { note?: string };

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

function condition(owner: string, c: RawCondition): Condition {
  return {
    id: `${owner}.${c.id}`,
    label: c.label,
    source: { ...c.source, scale: c.source.scale ?? 1 },
    effect: c.effect,
  };
}

export interface KitData {
  readonly skills: Readonly<Record<string, SkillData>>;
  readonly operators: Readonly<Record<string, { skillGroups: Readonly<Record<string, string>>; talentNodes?: readonly { index: number; effects: readonly Effect[] }[]; potentials?: readonly (readonly Effect[])[] }>>;
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
function isFinalStrike(skillId: string, events: readonly string[], hitEntries: number): boolean {
  const files = events.length ? events : hitEntries === 1 ? operatorSkillFiles(skillId.replace(/^(chr_\d+_[a-z]+)_.*$/, "$1")).filter((f) => f === skillId || f.startsWith(`${skillId}_`)) : [];
  return files.some((f) => isSkillFileListed(f) && existsSync(skillFilePath(f)) && damageSites(f).some((d) => (Math.floor(d.decorateMask / FINAL_STRIKE_BIT) & 1) === 1));
}

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
 * the applying skill's maxStackCntKey. Undefined for other game buffs.
 */
function gameBuffInstances(file: string, b: Pick<KitBuff, "id" | "maxStacks">, raw: RawBuffFile): ValueExpr | undefined {
  const s = raw.stacking;
  if (s.type !== 1 || s.priorityKey === null) return undefined;
  if (s.negatePriority) throw new Error(`${file}: buff ${b.id}: ${raw.id} keeps its weakest instance (negatePriority), which isn't supported`);
  if (b.maxStacks !== undefined) throw new Error(`${file}: buff ${b.id}: ${raw.id} keeps instances by priority (stackingType 1, priority key ${s.priorityKey}): drop maxStacks`);
  return s.maxStacksKey ?? s.maxStackCnt;
}

/**
 * A kit buff with what the game buff it stands for (KitBuff.gameBuff) says.
 * Stacking: type 1 is one strongest instance per group (its stackingKey,
 * else its file), and with a priority key a reapplication keeps instances
 * (`instances`: maxStackCnt, 0 no limit, or the applying skill's
 * maxStackCntKey); type 11 with a priority key and one instance is a group
 * too, so two wielders' copies don't add (layered type 11 stays per owner);
 * type 8: layers on one refreshed timer. An attribute modifier the game
 * buff has in formulaItem 6 is a percentage (`percent`).
 */
export function withGameBuff(file: string, b: KitBuff): KitBuff {
  const { gameBuff } = b;
  if (!gameBuff) return b;
  const raw = gameBuffFile(file, b.id, gameBuff);
  const modifiers = b.modifiers.map((m) => withPercent(file, b.id, raw, m));
  const s = raw.stacking;
  const instances = gameBuffInstances(file, b, raw);
  if (s.type === 1) return { ...b, modifiers, stackGroup: s.key ?? gameBuff, ...(instances !== undefined ? { instances } : {}) };
  if (s.type === 11 && s.priorityKey !== null && s.maxStacksKey === null && s.maxStackCnt === 1) return { ...b, modifiers, stackGroup: s.key ?? gameBuff };
  return s.type === 8 && b.maxStacks !== undefined && b.sharedTimer === undefined ? { ...b, modifiers, sharedTimer: true } : { ...b, modifiers };
}

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
  /** Whether a skill or source ID is one the kit can read values from. */
  readonly isSource: (id: string) => boolean;
  /** Throws unless the source has the key (at every level, for skills). */
  readonly checkSourceKey: (id: string, key: string, where: string) => void;
  /** The buffs and skills a talent (0-based) attaches at its levels, for `{talent, key}` values; none for equipment. */
  readonly talentSources?: (talent: number) => readonly string[];
}

/** Checks and normalises the parts operator and equipment kits share: values, predicates, buffs, hits, triggers. */
function kitChecker(scope: KitScope) {
  const { stackIds, buffDefs } = scope;
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
  /** Every own stack and buff a predicate names must exist in the kit. */
  const checkPredicate = (p: Predicate, where: string) => {
    const refs = predicateRefs(p);
    for (const id of refs.stacks) if (!stackIds.has(id)) throw new Error(`${where}: unknown stack ${id}`);
    for (const id of refs.buffs) if (!buffDefs.has(id)) throw new Error(`${where}: unknown buff ${id}`);
  };
  /** A forced reaction's level and extra seconds are values of the applying skill. */
  const checkApplicationValues = (a: KitApplication, skillId: string, where: string) => {
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
    // Instances kept by the applying skill's value (maxStackCntKey): the key must be there.
    const instances = b.gameBuff ? gameBuffInstances(scope.file, b, gameBuffFile(scope.file, b.id, b.gameBuff)) : undefined;
    if (typeof instances === "string") checkValue(instances, skillId, `${where}: buff ${b.id} instances (maxStackCntKey)`);
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
    src: { skillId: string; label: string; damageType?: SkillType; checkScale: (key: string, where: string) => void; defaultEvent?: string; finalStrike?: (h: RawHit, events: string[]) => boolean },
    where: string,
  ): KitHit[] => {
    const ids = new Set<string>();
    // Alternatives pair up landing by landing: a branch's hits land equally often.
    const branches = new Map<string, string>();
    for (const h of hits) {
      if (!h.branch) continue;
      const n = branches.get(h.branch);
      const count = JSON.stringify(h.count ?? 1);
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
      if (h.fixedDamage !== undefined) {
        checkValue(h.fixedDamage, src.skillId, `${where} hit ${h.id} fixedDamage`);
        if (h.scale.length || h.scaleValue !== undefined || h.extraScale || h.factor !== undefined || h.reaction || h.bonuses) throw new Error(`${where} hit ${h.id}: a Fixed DMG hit has no scale, factor, reaction or bonuses`);
      }
      if (h.if) checkPredicate(h.if, `${where} hit ${h.id}`);
      for (const x of [...(h.applies ?? []), ...(h.buffs ?? []), ...(h.gains ?? [])]) if (x.if) checkPredicate(x.if, `${where} hit ${h.id}`);
      for (const a of h.applies ?? []) checkApplicationValues(a, src.skillId, `${where} hit ${h.id}`);
      for (const g of h.gains ?? []) if (g.amount !== undefined) checkValue(g.amount, src.skillId, `${where} hit ${h.id} gains`);
      const element = h.element ?? scope.element;
      if (!element || !ELEMENTS.includes(element)) throw new Error(`${where} hit ${h.id}: no element`);
      const events = h.events ?? (src.defaultEvent && hits.length === 1 ? [src.defaultEvent] : []);
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
      }
      // A count that's a value is judged at the cast: its frames are the first landings', the rest repeat the last (framesEvery apart).
      if (typeof (h.count ?? 1) === "number") {
        if (h.frames && h.frames.length !== (h.count ?? 1)) throw new Error(`${where} hit ${h.id}: ${h.frames.length} frames for count ${JSON.stringify(h.count ?? 1)}`);
        if (h.framesEvery !== undefined) throw new Error(`${where} hit ${h.id}: framesEvery is for a count that's a value`);
      } else checkValue(h.count as ValueExpr, src.skillId, `${where} hit ${h.id} count`);
      return {
        id: h.id, label: h.label ?? src.label, scale: h.scale, count: h.count ?? 1, damageType: h.damageType ?? src.damageType ?? "none", element, events,
        ...(h.frames ? { frames: h.frames } : {}),
        ...(h.framesEvery !== undefined ? { framesEvery: h.framesEvery } : {}),
        ...(h.applies ? { applies: h.applies } : {}),
        ...(h.requires ? { requires: h.requires } : {}),
        ...(h.bonuses ? { bonuses: h.bonuses } : {}),
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
        ...(h.gains ? { gains: h.gains.map((g) => ({ stack: g.stack, amount: (g.amount as ValueExpr | undefined) ?? 1, ...(g.if ? { if: g.if } : {}) })) } : {}),
      };
    });
  };
  const triggerIds = new Set<string>();
  const checkTrigger = (t: Omit<RawTrigger, "note">): KitTrigger => {
    const where = `${scope.file}: trigger ${t.id}`;
    if (triggerIds.has(t.id)) throw new Error(`${where}: duplicate trigger ID`);
    triggerIds.add(t.id);
    const skillId = triggerSkillId(scope.owner, t);
    if (t.skill && !scope.isSource(t.skill)) throw new Error(`${where}: ${t.skill} isn't one of ${scope.owner}'s value sources`);
    if (t.on.event === "cast") for (const id of t.on.skills ?? []) if (!scope.isSkill(id)) throw new Error(`${where}: ${id} isn't a skill of ${scope.owner}`);
    if (t.on.event === "stackAtLeast" && !stackIds.has(t.on.stack)) throw new Error(`${where}: unknown stack ${t.on.stack}`);
    if ((t.on.event === "buffApplied" || t.on.event === "buffEnded" || t.on.event === "buffTick") && "buff" in t.on && !buffDefs.has(t.on.buff)) throw new Error(`${where}: unknown buff ${t.on.buff}`);
    if (t.on.event === "buffApplied" && "categories" in t.on && "buff" in t.on) throw new Error(`${where}: a buffApplied trigger names a buff or categories, not both`);
    if (t.beforeDamage && !(STATUS_EVENTS as readonly string[]).includes(t.on.event)) throw new Error(`${where}: only status-event triggers can act before their hit's damage`);
    if (t.maxPerCast !== undefined && !(t.maxPerCast >= 1)) throw new Error(`${where}: maxPerCast must be at least 1`);
    if (t.detached && !(t.delay && t.on.event === "cast")) throw new Error(`${where}: only a delayed cast trigger can be detached from its cast`);
    if (t.awaited && !(t.delay && t.on.event === "cast" && !t.detached)) throw new Error(`${where}: only a delayed cast trigger that belongs to its cast can be awaited`);
    if (t.launch !== undefined && !(t.detached && t.delay && Number.isInteger(t.launch) && t.launch >= 0 && t.launch <= t.delay)) throw new Error(`${where}: a launch frame needs a detached delayed cast trigger, at or before its delay`);
    if (t.if) checkPredicate(t.if, where);
    if (t.cooldown !== undefined) checkValue(t.cooldown, skillId, `${where} cooldown`);
    if (t.chance !== undefined) checkValue(t.chance, skillId, `${where} chance`);
    for (const a of flatActions(t.do)) {
      if (a.if) checkPredicate(a.if, where);
      switch (a.kind) {
        case "gain":
          for (const g of a.gains) {
            if (!stackIds.has(g.stack)) throw new Error(`${where}: gains unknown stack ${g.stack}`);
            if (g.if) checkPredicate(g.if, where);
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
          if (a.kind === "buff" && a.to && b.target !== "team") throw new Error(`${where}: buff ${a.buff} goes to the event's subject, so it must target the team`);
          if (a.kind === "buff" && a.layers !== undefined) checkValue(a.layers, skillId, `${where} buff layers`);
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
          const given = (["seconds", "fraction", "set"] as const).filter((k) => k in a);
          if (given.length !== 1) throw new Error(`${where}: a cooldown change has one of seconds, fraction or set`);
          checkValue("seconds" in a ? a.seconds : "fraction" in a ? a.fraction : a.set, skillId, `${where} cooldown change`);
          break;
        }
        case "apply":
          for (const x of a.applies) {
            if (x.if) checkPredicate(x.if, where);
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
        case "hits":
          break;
      }
    }
    const normalize = (list: readonly RawAction[]): TriggerAction[] =>
      list.map((a) =>
        a.kind === "gain" ? { ...a, gains: a.gains.map((g) => ({ stack: g.stack, amount: (g.amount as ValueExpr | undefined) ?? 1, ...(g.if ? { if: g.if } : {}) })) }
        : a.kind === "hits" ? { ...(a.if ? { if: a.if } : {}), ...(a.now ? { now: true } : {}), kind: "hits", hits: normalizeHits(a.hits, { skillId, label: t.id, checkScale: (key, w) => checkValue(key, skillId, w) }, where) }
        : a.kind === "choose" ? { ...a, options: a.options.map((o) => ({ weight: o.weight, do: normalize(o.do) })) }
        : a,
      );
    return { ...t, do: normalize(t.do) };
  };
  const normalizeBuffs = (buffs: readonly RawBuff[]): KitBuff[] => buffs.map(({ note: _note, ...b }) => withGameBuff(scope.file, b));
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

function idsOf(file: string, what: string, items: readonly { id: string }[]): Set<string> {
  const ids = new Set(items.map((x) => x.id));
  if (ids.size !== items.length) throw new Error(`${file}: duplicate ${what} ID`);
  return ids;
}

function loadOperatorKit(data: KitData, file: string, kit: RawKit): OperatorKit {
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
    return {
      skillId: s.skillId,
      label: s.label,
      kind: s.damageType,
      ...(s.energyBlockSeconds !== undefined ? { energyBlockSeconds: s.energyBlockSeconds } : {}),
      ...(s.jumps ? { jumps: s.jumps } : {}),
      ...(s.teamEnergy !== undefined ? { teamEnergy: s.teamEnergy } : {}),
      ...(s.available ? { available: s.available } : {}),
      ...(s.followUpOnly ? { followUpOnly: true } : {}),
      ...(s.takesControl ? { takesControl: true } : {}),
      ...(s.beside ? { beside: s.beside } : {}),
      ...(s.cooldownGroup ? { cooldownGroup: s.cooldownGroup } : {}),
      ...((s.chainStep ?? isChainStep(data, kit, s.skillId)) ? { chainStep: true } : {}),
      hits: c.normalizeHits(s.hits, { skillId: s.skillId, damageType: s.damageType, label: s.label, checkScale: (key, w) => checkKey(skill, key, w), defaultEvent: s.skillId, finalStrike: (h, events) => isFinalStrike(s.skillId, events, s.hits.length) }, where),
    };
  });
  return {
    operator: kit.operator,
    stacks: (kit.stacks ?? []).map((x) => {
      if (x.initial !== undefined) c.checkValue(x.initial, "", `${where0}: stack ${x.id} initial`);
      return { id: x.id, label: x.label, max: x.max, ...(x.initial !== undefined ? { initial: x.initial } : {}) };
    }),
    ...(kit.activeConditions ? { activeConditions: kit.activeConditions } : {}),
    buffs: c.normalizeBuffs(kit.buffs ?? []),
    triggers: c.checkTriggers((kit.triggers ?? []).map(({ note: _note, ...t }) => t)),
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
    conditions: (kit.conditions ?? []).map((x) => {
      if (x.source.kind === "skill") {
        const where = `${where0}: condition ${x.id}`;
        const skill = data.skills[x.source.skillId];
        if (!skill || op.skillGroups[x.source.skillId] === undefined) throw new Error(`${where}: ${x.source.skillId} isn't one of ${kit.operator}'s skills`);
        checkKey(skill, x.source.key, where);
      }
      return condition(kit.operator, x);
    }),
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
    isSource: (sid) => skills.has(sid) && data.skills[sid] !== undefined,
    checkSourceKey: (sid, key, where) => checkKey(data.skills[sid] as SkillData, key, where),
  });
  idsOf(where0, "buff", kit.buffs ?? []);
  return {
    id,
    stacks: (kit.stacks ?? []).map((x) => {
      if (x.initial !== undefined) c.checkValue(x.initial, "", `${where0}: stack ${x.id} initial`);
      return { id: x.id, label: x.label, max: x.max, ...(x.initial !== undefined ? { initial: x.initial } : {}) };
    }),
    buffs: c.normalizeBuffs(kit.buffs ?? []),
    triggers: c.checkTriggers((kit.triggers ?? []).map(({ note: _note, ...t }) => t)),
    conditions: (kit.conditions ?? []).map((x) => {
      if (x.source.kind !== "weaponSkill" || !weapon) throw new Error(`${where0}: condition ${x.id}: equipment conditions use weaponSkill sources (weapons only)`);
      return condition(id, x);
    }),
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

/** Loads the kits under `dir` (default packages/data/kits: its operators/ and equipment/ folders). */
export function loadKits(data: KitData, dir: string = KITS): Kits {
  const v = validator();
  if (!v.kit) throw new Error("kit schema not registered");
  const operators: Record<string, OperatorKit> = {};
  const odir = join(dir, "operators");
  for (const file of existsSync(odir) ? readdirSync(odir).filter((f) => f.endsWith(".json")).sort() : []) {
    const raw = readJson(join(odir, file));
    if (!v.kit(raw)) throw new Error(`kits/operators/${file}: ${v.ajv.errorsText(v.kit.errors)}`);
    const kit = loadOperatorKit(data, file, raw as RawKit);
    operators[kit.operator] = kit;
    for (const variant of (raw as RawKit).variants ?? []) {
      const other = loadOperatorKit(data, `${variant.operator}.json`, variantOf(raw as RawKit, variant));
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
