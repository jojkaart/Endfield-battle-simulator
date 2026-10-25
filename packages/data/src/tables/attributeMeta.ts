// AttributeMetaTable: each attribute type's default value (e.g. crit DMG 0.5,
// ultimate gain efficiency 1.0).

import { DataError } from "../errors.ts";
import { bool, get, int, num } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";
import { records } from "./common.ts";

export function normalizeAttributeDefaults(raw: unknown, source: SourceName): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [key, r, c] of records(raw, { source, path: "AttributeMetaTable" })) {
    const type = get(r, "attributeType", c, int);
    if (String(type) !== key) throw new DataError(source, c.path, `attributeType ${type} under key ${key}`);
    out[type] = get(r, "defaultValue", c, num);
  }
  return out;
}

/** Each attribute type's limits where the table sets them (hasMinValue / hasMaxValue): Haste 0.1–1.3, most others at least 0. */
export function normalizeAttributeLimits(raw: unknown, source: SourceName): Record<number, { min?: number; max?: number }> {
  const out: Record<number, { min?: number; max?: number }> = {};
  for (const [, r, c] of records(raw, { source, path: "AttributeMetaTable" })) {
    const type = get(r, "attributeType", c, int);
    const min = get(r, "hasMinValue", c, bool) ? get(r, "minValue", c, num) : undefined;
    const max = get(r, "hasMaxValue", c, bool) ? get(r, "maxValue", c, num) : undefined;
    if (min !== undefined && max !== undefined && min > max) throw new DataError(source, c.path, `minValue ${min} above maxValue ${max}`);
    if (min !== undefined || max !== undefined) out[type] = { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
  }
  return out;
}

export function loadAttributeLimits(source: SourceName): Record<number, { min?: number; max?: number }> {
  return normalizeAttributeLimits(readTable(source, "AttributeMetaTable"), source);
}

export function loadAttributeDefaults(source: SourceName): Record<number, number> {
  return normalizeAttributeDefaults(readTable(source, "AttributeMetaTable"), source);
}
