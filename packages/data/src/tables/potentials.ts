// CharacterPotentialTable (which effect each potential level unlocks) and
// PotentialTalentEffectTable (the effects, shared with talents).

import { DataError } from "../errors.ts";
import { arr, at, get, int, num, obj, str, type Ctx } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";
import { attrModifier, blackboard, records, type RawAttrModifier } from "./common.ts";

export type RawEffect =
  | { kind: "attr"; modifier: RawAttrModifier }
  | { kind: "skillValue"; skillId: string; key: string; op: "add" | "multiply" | "set"; value: number }
  | { kind: "buff"; buffId: string; blackboard: Record<string, number> }
  | { kind: "skillParam"; skillId: string; param: "cost" | "cooldown"; op: "add" | "multiply" | "set"; value: number }
  | { kind: "other"; modifyType: number };

// modifyType: 1 attach skill, 2 change a skill parameter (skillParamModifier),
// 3 change a skill value, 4 attribute, 5 attach buff. 1 isn't read yet.
const MODIFY_SKILL_PARAM = 2;
const MODIFY_SKILL_VALUE = 3;

// skillParamModifier.paramType: 1 cost (P4 ultimates ×0.85, matching the
// reference simulators), 2 cooldown (Liino P3 combo −1, Gilberta P5 combo −2).
// 4 (Arcane's talent, combo −6) is unknown and left as "other".
const SKILL_PARAMS: Record<number, "cost" | "cooldown"> = { 1: "cost", 2: "cooldown" };
const MODIFY_ATTRIBUTE = 4;
const MODIFY_ATTACH_BUFF = 5;

// skillBbModifier.modifyType. Inferred from values (P1 SP +20, P3 duration
// ×1.5, P1 ratio 1.2) and confirmed for "set" by Zero Sanity's in-game hits.
const VALUE_OPS: Record<number, "add" | "multiply" | "set"> = { 1: "add", 2: "multiply", 3: "set" };

function effect(raw: unknown, ctx: Ctx): RawEffect {
  const d = obj(raw, ctx);
  const type = get(d, "modifyType", ctx, int);
  if (type === MODIFY_ATTRIBUTE) return { kind: "attr", modifier: attrModifier(d["attrModifier"], at(ctx, "attrModifier")) };
  if (type === MODIFY_SKILL_VALUE) {
    const c = at(ctx, "skillBbModifier");
    const m = obj(d["skillBbModifier"], c);
    const opType = get(m, "modifyType", c, int);
    const op = VALUE_OPS[opType];
    if (!op) throw new DataError(ctx.source, c.path, `unknown skill value modifyType ${opType}`);
    if (get(m, "stringValue", c, str) !== "") throw new DataError(ctx.source, c.path, "string skill values aren't supported");
    return { kind: "skillValue", skillId: get(m, "skillId", c, str), key: get(m, "bbKey", c, str), op, value: get(m, "floatValue", c, num) };
  }
  if (type === MODIFY_SKILL_PARAM) {
    const c = at(ctx, "skillParamModifier");
    const m = obj(d["skillParamModifier"], c);
    const param = SKILL_PARAMS[get(m, "paramType", c, int)];
    const op = VALUE_OPS[get(m, "modifyType", c, int)];
    if (param && op) return { kind: "skillParam", skillId: get(m, "skillId", c, str), param, op, value: get(m, "paramValue", c, num) };
  }
  if (type === MODIFY_ATTACH_BUFF) {
    const c = at(ctx, "attachBuff");
    const b = obj(d["attachBuff"], c);
    return { kind: "buff", buffId: get(b, "buffId", c, str), blackboard: blackboard(b["blackboard"], at(c, "blackboard")) };
  }
  return { kind: "other", modifyType: type };
}

export function normalizeEffects(raw: unknown, source: SourceName): Record<string, RawEffect[]> {
  const out: Record<string, RawEffect[]> = {};
  for (const [id, record, c] of records(raw, { source, path: "PotentialTalentEffectTable" })) {
    out[id] = get(record, "dataList", c, arr).map((e, i) => effect(e, at(at(c, "dataList"), i)));
  }
  return out;
}

/** Operator → effect ID per potential level (index 0 = P1). */
export function normalizePotentials(raw: unknown, source: SourceName): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [charId, record, c] of records(raw, { source, path: "CharacterPotentialTable" })) {
    const bundle = get(record, "potentialUnlockBundle", c, arr).map((p, i) => {
      const pc = at(at(c, "potentialUnlockBundle"), i);
      const po = obj(p, pc);
      return { level: get(po, "level", pc, int), effectId: get(po, "potentialEffectId", pc, str) };
    });
    bundle.forEach((p, i) => {
      if (p.level !== i + 1) throw new DataError(source, c.path, `potential levels out of order at index ${i}`);
    });
    out[charId] = bundle.map((p) => p.effectId);
  }
  return out;
}

export function loadEffects(source: SourceName): Record<string, RawEffect[]> {
  return normalizeEffects(readTable(source, "PotentialTalentEffectTable"), source);
}

export function loadPotentials(source: SourceName): Record<string, string[]> {
  return normalizePotentials(readTable(source, "CharacterPotentialTable"), source);
}
