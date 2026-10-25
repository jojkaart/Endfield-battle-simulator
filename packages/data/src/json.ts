// JSON parsing that keeps 64-bit integers exact. The game tables hold int64
// text and entity IDs (e.g. -941115005296393099) that a plain JSON.parse
// silently rounds. Integers outside the safe range become decimal strings,
// taken from the source text.

interface ReviverContext {
  source?: string;
}

/**
 * Text that may hold a number outside the safe integer range: a run of 16 or
 * more digits that isn't a fraction's (not after a digit or a point), or a
 * positive exponent. Text without one parses the same without the reviver,
 * which is several times slower (most SkillData files have none).
 */
const MAYBE_UNSAFE = /(?<![\d.])\d{16}|\d[eE]\+?\d/;

export function parseJsonExact(text: string): unknown {
  if (!MAYBE_UNSAFE.test(text)) return JSON.parse(text);
  return JSON.parse(text, function (this: unknown, _key: string, value: unknown, context?: ReviverContext) {
    if (typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value)) {
      const source = context?.source;
      if (source === undefined) {
        throw new Error("JSON source text access is unavailable; Node 22 or newer is required");
      }
      return source;
    }
    return value;
  } as (key: string, value: unknown) => unknown);
}
