// Compares normalised records from the two sources. Both decode the same
// game files but write numbers differently: rmxlinux spells out float32
// values in full (1.7799999713897705), 555me prints the shortest decimal
// (1.78). Those are the same table value. Some fields aren't float32 at all
// (BattleConst.enemyOHKCoefficient 22924.36914), so the rule can't simply
// round everything to float32.

export interface Difference {
  readonly path: string;
  readonly a: unknown;
  readonly b: unknown;
}

/** Same value as written, or the same float32 where one side is exactly float32. */
export function sameNumber(a: number, b: number): boolean {
  if (a === b) return true;
  const fa = Math.fround(a);
  const fb = Math.fround(b);
  return fa === fb && (fa === a || fb === b);
}

export function compare(a: unknown, b: unknown, path = "", out: Difference[] = []): Difference[] {
  if (typeof a === "number" && typeof b === "number") {
    if (!sameNumber(a, b)) out.push({ path, a, b });
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push({ path: `${path}.length`, a: a.length, b: b.length });
    for (let i = 0; i < Math.min(a.length, b.length); i++) compare(a[i], b[i], `${path}[${i}]`, out);
  } else if (isRecord(a) && isRecord(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const k of keys) {
      if (!(k in a)) out.push({ path: `${path}.${k}`, a: undefined, b: b[k] });
      else if (!(k in b)) out.push({ path: `${path}.${k}`, a: a[k], b: undefined });
      else compare(a[k], b[k], `${path}.${k}`, out);
    }
  } else if (a !== b) {
    out.push({ path, a, b });
  }
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
