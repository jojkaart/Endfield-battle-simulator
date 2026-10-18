// AttributeMetaTable: each attribute type's default value (e.g. crit DMG 0.5,
// ultimate gain efficiency 1.0).

import { DataError } from "../errors.ts";
import { get, int, num } from "../fields.ts";
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

export function loadAttributeDefaults(source: SourceName): Record<number, number> {
  return normalizeAttributeDefaults(readTable(source, "AttributeMetaTable"), source);
}
