// Loads the hand-written kits (packages/data/kits) and checks them against
// the game data: every skill, level group and blackboard key must exist.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { ELEMENTS, type Condition, type Element, type Kits, type OperatorKit, type SkillData, type SkillType, type Zone } from "@efsim/engine";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KITS = join(ROOT, "packages/data/kits");

interface RawCondition {
  id: string;
  label: string;
  source: { kind: "talent"; index: number; buffId: string; key: string; scale?: number } | { kind: "weaponSkill"; skill: number; key: string; scale?: number };
  effect: { kind: "attr"; attr: number } | { kind: "zone"; zone: Zone; element?: Element; skillType?: SkillType };
}

interface RawKit {
  operator: string;
  element?: Element;
  skills: {
    skillId: string;
    label: string;
    damageType: "basic" | "battle" | "combo" | "ultimate";
    durationFrames?: number;
    hits: { id: string; label?: string; scale: string[]; count?: number; element?: Element; events?: string[]; frames?: number[] }[];
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
    source: c.source.kind === "talent" ? { ...c.source, scale: c.source.scale ?? 1 } : { ...c.source, scale: c.source.scale ?? 1 },
    effect: c.effect,
  };
}

export interface KitData {
  readonly skills: Readonly<Record<string, SkillData>>;
  readonly operators: Readonly<Record<string, { skillGroups: Readonly<Record<string, string>> }>>;
  readonly weapons: Readonly<Record<string, unknown>>;
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
    const skills = kit.skills.map((s) => {
      const where = `kits/operators/${file}: ${s.skillId}`;
      const skill = data.skills[s.skillId];
      if (!skill) throw new Error(`${where}: unknown skill`);
      if (op.skillGroups[s.skillId] === undefined) throw new Error(`${where}: not one of ${kit.operator}'s skills`);
      const ids = new Set<string>();
      return {
        skillId: s.skillId,
        label: s.label,
        ...(s.durationFrames !== undefined ? { durationFrames: s.durationFrames } : {}),
        hits: s.hits.map((h) => {
          if (ids.has(h.id)) throw new Error(`${where}: duplicate hit ${h.id}`);
          ids.add(h.id);
          for (const key of h.scale) checkKey(skill, key, `${where} hit ${h.id}`);
          const element = h.element ?? kit.element;
          if (!element || !ELEMENTS.includes(element)) throw new Error(`${where} hit ${h.id}: no element`);
          const events = h.events ?? (s.hits.length === 1 ? [s.skillId] : []);
          if (h.frames && h.frames.length !== (h.count ?? 1)) throw new Error(`${where} hit ${h.id}: ${h.frames.length} frames for count ${h.count ?? 1}`);
          return {
            id: h.id, label: h.label ?? s.label, scale: h.scale, count: h.count ?? 1, damageType: s.damageType, element, events,
            ...(h.frames ? { frames: h.frames } : {}),
          };
        }),
      };
    });
    operators[kit.operator] = {
      operator: kit.operator,
      skills,
      conditions: (kit.conditions ?? []).map((c) => condition(kit.operator, c)),
    };
  }

  const rawWeapons = readJson(join(KITS, "weapons.json"));
  if (!v.weapons(rawWeapons)) throw new Error(`kits/weapons.json: ${v.ajv.errorsText(v.weapons.errors)}`);
  const weapons: Record<string, Condition[]> = {};
  for (const [id, w] of Object.entries((rawWeapons as RawWeaponKits).weapons)) {
    if (!data.weapons[id]) throw new Error(`kits/weapons.json: unknown weapon ${id}`);
    weapons[id] = w.conditions.map((c) => condition(id, c));
  }
  return { operators, weapons };
}
