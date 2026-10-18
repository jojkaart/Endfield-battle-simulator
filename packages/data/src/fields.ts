// Strict readers for raw table values. Each takes the path of the value for
// error messages, and knows each source's quirks: 555me writes many whole
// numbers as strings ("coolDown": "10"); rmxlinux writes real numbers.

import { DataError } from "./errors.ts";
import type { SourceName } from "./sources.ts";

export interface Ctx {
  readonly source: SourceName;
  readonly path: string;
}

export function at(ctx: Ctx, key: string | number): Ctx {
  return { source: ctx.source, path: typeof key === "number" ? `${ctx.path}[${key}]` : `${ctx.path}.${key}` };
}

function fail(ctx: Ctx, message: string): never {
  throw new DataError(ctx.source, ctx.path, message);
}

export function obj(value: unknown, ctx: Ctx): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(ctx, "expected an object");
  return value as Record<string, unknown>;
}

export function field(record: Record<string, unknown>, key: string, ctx: Ctx): [unknown, Ctx] {
  if (!(key in record)) fail(ctx, `missing field "${key}"`);
  return [record[key], at(ctx, key)];
}

export function arr(value: unknown, ctx: Ctx): unknown[] {
  if (!Array.isArray(value)) fail(ctx, "expected an array");
  return value;
}

const NUMERIC_STRING = /^-?(0|[1-9]\d*)(\.\d+)?(e[+-]?\d+)?$/i;

export function num(value: unknown, ctx: Ctx): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (ctx.source === "555me" && typeof value === "string" && NUMERIC_STRING.test(value)) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fail(ctx, `expected a number, got ${JSON.stringify(value)}`);
}

export function int(value: unknown, ctx: Ctx): number {
  const n = num(value, ctx);
  if (!Number.isSafeInteger(n)) fail(ctx, `expected a whole number, got ${n}`);
  return n;
}

export function str(value: unknown, ctx: Ctx): string {
  if (typeof value !== "string") fail(ctx, `expected a string, got ${JSON.stringify(value)}`);
  return value;
}

/** Reads `record[key]` with one of the readers above. */
export function get<T>(record: Record<string, unknown>, key: string, ctx: Ctx, read: (v: unknown, c: Ctx) => T): T {
  const [value, c] = field(record, key, ctx);
  return read(value, c);
}
