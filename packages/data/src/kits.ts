// Loads the hand-written kits (packages/data/kits) and checks them against
// the game data: every skill, level group and blackboard key must exist.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { damageSites, operatorSkillFiles } from "./skillGraph.ts";
import { isSkillFileListed, skillFilePath } from "./skillData.ts";
import { ELEMENTS, type AttrType, type BuffApplication, type ComboTrigger, type Condition, type KitBuff, type ValueSpec, type HitApplication, type StackDef, type StackRequirement, type Element, type Kits, type OperatorKit, type SkillData, type SkillType, type Zone } from "@efsim/engine";

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

interface RawKit {
  operator: string;
  element?: Element;
  stacks?: StackDef[];
  buffs?: (KitBuff & { note?: string })[];
  comboTriggers?: (ComboTrigger & { note?: string })[];
  teamTriggers?: { on: "finalStrike"; applies: HitApplication[]; gains?: { stack: string; amount?: number | "consumedInflictions" }[] }[];
  skills: {
    skillId: string;
    label: string;
    damageType: "basic" | "battle" | "combo" | "ultimate";
    durationFrames?: number;
    energyBlockSeconds?: number;
    availableWhile?: string;
    unavailableWhile?: string;
    hits: {
      id: string; label?: string; scale: string[]; count?: number; element?: Element; events?: string[]; frames?: number[];
      applies?: HitApplication[]; requires?: StackRequirement; gains?: { stack: string; amount?: number | "consumedInflictions" }[];
      bonuses?: { zone: Zone; key: string }[];
      finalStrike?: boolean;
      factor?: number;
      reaction?: { kind: "burst" | "reaction"; element: "fire" | "pulse" | "cryst" | "natural"; level?: number };
      scaleIf?: { key: string; enemyInfliction: "fire" | "pulse" | "cryst" | "natural" };
      when?: { attrAtLeast: [number, number] };
      buffs?: BuffApplication[];
      energy?: ValueSpec;
    }[];
  }[];
  conditions?: RawCondition[];
}

interface RawWeaponKits {
  weapons: Record<string, { conditions: RawCondition[] }>;
}

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schema = (name: string) => JSON.parse(readFileSync(join(ROOT, "schemas", name), "utf8")) as object;
  ajv.addSchema(schema("kit.schema.json"));
  return {
    ajv,
    kit: ajv.getSchema("https://github.com/jojkaart/Endfield-battle-simulator/schemas/kit.schema.json"),
    weapons: ajv.compile(schema("weapon-kits.schema.json")),
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
  readonly operators: Readonly<Record<string, { skillGroups: Readonly<Record<string, string>> }>>;
  readonly weapons: Readonly<Record<string, unknown>>;
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

export function loadKits(data: KitData): Kits {
  const v = validator();
  if (!v.kit) throw new Error("kit schema not registered");
  const operators: Record<string, OperatorKit> = {};
  const dir = join(KITS, "operators");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const raw = readJson(join(dir, file));
    if (!v.kit(raw)) throw new Error(`kits/operators/${file}: ${v.ajv.errorsText(v.kit.errors)}`);
    const kit = raw as RawKit;
    if (file !== `${kit.operator}.json`) throw new Error(`kits/operators/${file}: file name must be ${kit.operator}.json`);
    const op = data.operators[kit.operator];
    if (!op) throw new Error(`kits/operators/${file}: unknown operator ${kit.operator}`);
    const stackIds = new Set((kit.stacks ?? []).map((x) => x.id));
    const buffDefs = new Map((kit.buffs ?? []).map((b) => [b.id, b]));
    if (buffDefs.size !== (kit.buffs ?? []).length) throw new Error(`kits/operators/${file}: duplicate buff ID`);
    /** Checks a buff's value keys against the skill whose hit applies it (or the skill each value names). */
    const checkBuff = (b: KitBuff, skillId: string, where: string) => {
      const specs: ValueSpec[] = [b.duration, ...b.modifiers.map((m) => m.value)];
      for (const v of specs) {
        if ("literal" in v) continue;
        const sid = v.skill ?? skillId;
        const sk = data.skills[sid];
        if (!sk || op.skillGroups[sid] === undefined) throw new Error(`${where}: buff ${b.id} names ${sid}, not one of ${kit.operator}'s skills`);
        for (const key of [v.key, ...(v.capKey ? [v.capKey] : [])]) checkKey(sk, key, `${where}: buff ${b.id}`);
      }
    };
    const skills = kit.skills.map((s) => {
      const where = `kits/operators/${file}: ${s.skillId}`;
      const skill = data.skills[s.skillId];
      if (!skill) throw new Error(`${where}: unknown skill`);
      if (op.skillGroups[s.skillId] === undefined) throw new Error(`${where}: not one of ${kit.operator}'s skills`);
      for (const b of [s.availableWhile, s.unavailableWhile]) if (b && !buffDefs.has(b)) throw new Error(`${where}: unknown buff ${b}`);
      const ids = new Set<string>();
      return {
        skillId: s.skillId,
        label: s.label,
        kind: s.damageType,
        ...(s.durationFrames !== undefined ? { durationFrames: s.durationFrames } : {}),
        ...(s.energyBlockSeconds !== undefined ? { energyBlockSeconds: s.energyBlockSeconds } : {}),
        ...(s.availableWhile ? { availableWhile: s.availableWhile } : {}),
        ...(s.unavailableWhile ? { unavailableWhile: s.unavailableWhile } : {}),
        hits: s.hits.map((h) => {
          if (ids.has(h.id)) throw new Error(`${where}: duplicate hit ${h.id}`);
          ids.add(h.id);
          for (const key of [...h.scale, ...(h.bonuses ?? []).map((b) => b.key), ...(h.scaleIf ? [h.scaleIf.key] : [])]) checkKey(skill, key, `${where} hit ${h.id}`);
          const element = h.element ?? kit.element;
          if (!element || !ELEMENTS.includes(element)) throw new Error(`${where} hit ${h.id}: no element`);
          const events = h.events ?? (s.hits.length === 1 ? [s.skillId] : []);
          for (const id of [h.requires?.stack, ...(h.gains ?? []).map((g) => g.stack)]) {
            if (id !== undefined && !stackIds.has(id)) throw new Error(`${where} hit ${h.id}: unknown stack ${id} (the kit's stacks: ${[...stackIds].join(", ") || "none"})`);
          }
          if (h.energy && !("literal" in h.energy)) {
            const sid = h.energy.skill ?? s.skillId;
            const sk = data.skills[sid];
            if (!sk || op.skillGroups[sid] === undefined) throw new Error(`${where} hit ${h.id}: energy names ${sid}, not one of ${kit.operator}'s skills`);
            checkKey(sk, h.energy.key, `${where} hit ${h.id} energy`);
          }
          for (const a of h.buffs ?? []) {
            const b = buffDefs.get(a.buff);
            if (!b) throw new Error(`${where} hit ${h.id}: unknown buff ${a.buff}`);
            checkBuff(b, s.skillId, `${where} hit ${h.id}`);
          }
          if (h.frames && h.frames.length !== (h.count ?? 1)) throw new Error(`${where} hit ${h.id}: ${h.frames.length} frames for count ${h.count ?? 1}`);
          return {
            id: h.id, label: h.label ?? s.label, scale: h.scale, count: h.count ?? 1, damageType: s.damageType, element, events,
            ...(h.frames ? { frames: h.frames } : {}),
            ...(h.applies ? { applies: h.applies } : {}),
            ...(h.requires ? { requires: h.requires } : {}),
            ...(h.bonuses ? { bonuses: h.bonuses } : {}),
            ...(h.factor !== undefined ? { factor: h.factor } : {}),
            ...(h.reaction ? { reaction: h.reaction } : {}),
            ...(h.scaleIf ? { scaleIf: h.scaleIf } : {}),
            ...(h.buffs ? { buffs: h.buffs } : {}),
            ...(h.energy ? { energy: h.energy } : {}),
            ...(h.when ? { when: { attrAtLeast: h.when.attrAtLeast as [AttrType, AttrType] } } : {}),
            ...((h.finalStrike ?? isFinalStrike(s.skillId, events, s.hits.length)) ? { finalStrike: true } : {}),
            ...(h.gains ? { gains: h.gains.map((g) => ({ stack: g.stack, amount: g.amount ?? 1 })) } : {}),
          };
        }),
      };
    });
    operators[kit.operator] = {
      operator: kit.operator,
      stacks: (kit.stacks ?? []).map((x) => ({ id: x.id, label: x.label, max: x.max })),
      buffs: (kit.buffs ?? []).map(({ note: _note, ...b }) => b),
      ...(kit.comboTriggers
        ? {
            comboTriggers: kit.comboTriggers.map(({ note: _note, ...t }) => {
              if (t.whileBuff && !buffDefs.has(t.whileBuff)) throw new Error(`kits/operators/${file}: combo trigger needs unknown buff ${t.whileBuff}`);
              for (const c of t.any) if (c.on === "stackAtLeast" && !stackIds.has(c.stack)) throw new Error(`kits/operators/${file}: combo trigger needs unknown stack ${c.stack}`);
              return t;
            }),
          }
        : {}),
      teamTriggers: (kit.teamTriggers ?? []).map((t) => {
        for (const g of t.gains ?? []) if (!stackIds.has(g.stack)) throw new Error(`kits/operators/${file}: team trigger gains unknown stack ${g.stack}`);
        return { on: t.on, applies: t.applies, ...(t.gains ? { gains: t.gains.map((g) => ({ stack: g.stack, amount: g.amount ?? 1 })) } : {}) };
      }),
      skills,
      conditions: (kit.conditions ?? []).map((c) => {
        if (c.source.kind === "skill") {
          const where = `kits/operators/${file}: condition ${c.id}`;
          const skill = data.skills[c.source.skillId];
          if (!skill || op.skillGroups[c.source.skillId] === undefined) throw new Error(`${where}: ${c.source.skillId} isn't one of ${kit.operator}'s skills`);
          checkKey(skill, c.source.key, where);
        }
        return condition(kit.operator, c);
      }),
    };
  }

  const rawWeapons = readJson(join(KITS, "weapons.json"));
  if (!v.weapons(rawWeapons)) throw new Error(`kits/weapons.json: ${v.ajv.errorsText(v.weapons.errors)}`);
  const weapons: Record<string, Condition[]> = {};
  for (const [id, w] of Object.entries((rawWeapons as RawWeaponKits).weapons)) {
    if (!data.weapons[id]) throw new Error(`kits/weapons.json: unknown weapon ${id}`);
    weapons[id] = w.conditions.map((c) => {
      if (c.source.kind === "skill") throw new Error(`kits/weapons.json: ${id}.${c.id}: weapon conditions use weaponSkill sources`);
      return condition(id, c);
    });
  }
  return { operators, weapons };
}
