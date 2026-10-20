// What a kit hit's values read that a static check can't know (batch 4 L4,
// L6): the infliction stacks the hit consumed (`consumed`,
// `consumedAtLeast`), the operator's own stacks (`stackCount`, `stack`), and
// the enemy's infliction or Vulnerable stacks (`enemyInflictionStacks`,
// `enemyInfliction`, `enemyVulnerableStacks`, `enemyVulnerable`) inside its
// values. `zmdlogs check` tries each over its range, as it tries `eventCount`
// 1-4; `calc` shows the hit at a stated count. An assumption is written into
// the hit (a value becomes the number, a condition true or false), so
// conditions it doesn't name stay unknown and are judged as before.

import type { ArtsElement, KitHit, Predicate, ValueExpr } from "@efsim/engine";

/** What a hit's values read that only a fight knows. */
export interface ValueReads {
  readonly consumed: boolean;
  readonly stacks: readonly string[];
  readonly elements: readonly ArtsElement[];
  readonly vulnerable: boolean;
}

/** One assumption about those: each field left out stays unknown. `infliction` null: the enemy has none. */
export interface ValueAssumption {
  readonly consumed?: number;
  readonly stacks?: Readonly<Record<string, number>>;
  readonly infliction?: { readonly element: ArtsElement; readonly stacks: number } | null;
  readonly vulnerable?: number;
}

const TRUE: Predicate = { all: [] };
const FALSE: Predicate = { any: [] };

function valueParts(v: ValueExpr): readonly ValueExpr[] {
  if (typeof v !== "object") return [];
  if ("sum" in v) return v.sum;
  if ("product" in v) return v.product;
  if ("min" in v) return v.min;
  if ("max" in v) return v.max;
  if ("floor" in v) return [v.floor];
  if ("div" in v) return v.div;
  if ("if" in v) return [v.then, ...(v.else !== undefined ? [v.else] : [])];
  return [];
}

/** The values a hit's damage reads (not its count or applications). */
function hitValues(hit: KitHit): ValueExpr[] {
  return [...(hit.scaleValue !== undefined ? [hit.scaleValue] : []), ...(hit.extraScale ?? []).map((x) => x.value), ...(hit.base !== undefined ? [hit.base] : []), ...(hit.fixedDamage !== undefined ? [hit.fixedDamage] : [])];
}

/** What the hit's damage values read (conditions inside them included), in first-seen order. */
export function valueReads(hit: KitHit): ValueReads {
  let consumed = false;
  let vulnerable = false;
  const stacks = new Set<string>();
  const elements = new Set<ArtsElement>();
  const pred = (p: Predicate): void => {
    if ("all" in p) return p.all.forEach(pred);
    if ("any" in p) return p.any.forEach(pred);
    if ("not" in p) return pred(p.not);
    if ("consumedAtLeast" in p) consumed = true;
    else if ("stack" in p) stacks.add(p.stack);
    else if ("enemyInfliction" in p) elements.add(p.enemyInfliction);
    else if ("enemyVulnerable" in p) vulnerable = true;
  };
  const value = (v: ValueExpr): void => {
    if (typeof v !== "object") return;
    if ("consumed" in v) consumed = true;
    else if ("stackCount" in v) stacks.add(v.stackCount);
    else if ("enemyInflictionStacks" in v) elements.add(v.enemyInflictionStacks);
    else if ("enemyVulnerableStacks" in v) vulnerable = true;
    if ("if" in v) pred(v.if);
    valueParts(v).forEach(value);
  };
  hitValues(hit).forEach(value);
  return { consumed, stacks: [...stacks], elements: [...elements], vulnerable };
}

export function readsAnything(r: ValueReads): boolean {
  return r.consumed || r.vulnerable || r.stacks.length > 0 || r.elements.length > 0;
}

function predicate(p: Predicate, a: ValueAssumption): Predicate {
  const known = (b: boolean) => (b ? TRUE : FALSE);
  if ("all" in p) return { all: p.all.map((x) => predicate(x, a)) };
  if ("any" in p) return { any: p.any.map((x) => predicate(x, a)) };
  if ("not" in p) return { not: predicate(p.not, a) };
  if ("consumedAtLeast" in p && a.consumed !== undefined) return known(a.consumed >= p.consumedAtLeast);
  if ("stack" in p && a.stacks?.[p.stack] !== undefined) {
    const n = a.stacks[p.stack] as number;
    return known((p.atLeast === undefined || n >= p.atLeast) && (p.below === undefined || n < p.below));
  }
  if ("enemyInfliction" in p && a.infliction !== undefined) return known(a.infliction !== null && a.infliction.element === p.enemyInfliction && a.infliction.stacks >= (p.minStacks ?? 1));
  if ("enemyVulnerable" in p && a.vulnerable !== undefined) return known(a.vulnerable >= p.enemyVulnerable);
  return p;
}

function value(v: ValueExpr, a: ValueAssumption): ValueExpr {
  if (typeof v !== "object") return v;
  if ("consumed" in v && a.consumed !== undefined) return a.consumed;
  if ("stackCount" in v && a.stacks?.[v.stackCount] !== undefined) return a.stacks[v.stackCount] as number;
  if ("enemyInflictionStacks" in v && a.infliction !== undefined) return a.infliction !== null && a.infliction.element === v.enemyInflictionStacks ? a.infliction.stacks : 0;
  if ("enemyVulnerableStacks" in v && a.vulnerable !== undefined) return a.vulnerable;
  if ("sum" in v) return { sum: v.sum.map((x) => value(x, a)) };
  if ("product" in v) return { product: v.product.map((x) => value(x, a)) };
  if ("min" in v) return { min: v.min.map((x) => value(x, a)) };
  if ("max" in v) return { max: v.max.map((x) => value(x, a)) };
  if ("floor" in v) return { floor: value(v.floor, a) };
  if ("div" in v) return { div: [value(v.div[0], a), value(v.div[1], a)] };
  if ("if" in v) return { if: predicate(v.if, a), then: value(v.then, a), ...(v.else !== undefined ? { else: value(v.else, a) } : {}) };
  return v;
}

/**
 * The hit under an assumption: its damage values with what it fixes written
 * in; with `conditions` also its own `if` and its extra scales' conditions
 * (a log check, where the hit happening and its value must agree), else only
 * the values (`calc`, which shows every hit whatever its conditions).
 */
export function assumeValues(hit: KitHit, a: ValueAssumption, conditions: boolean): KitHit {
  const p = (x: Predicate) => (conditions ? predicate(x, a) : x);
  return {
    ...hit,
    ...(hit.scaleValue !== undefined ? { scaleValue: value(hit.scaleValue, a) } : {}),
    ...(hit.base !== undefined ? { base: value(hit.base, a) } : {}),
    ...(hit.fixedDamage !== undefined ? { fixedDamage: value(hit.fixedDamage, a) } : {}),
    ...(hit.extraScale ? { extraScale: hit.extraScale.map((x) => ({ value: value(x.value, a), if: p(x.if) })) } : {}),
    ...(hit.if ? { if: p(hit.if) } : {}),
  };
}

/** Infliction stacks, Vulnerable stacks and consumed stacks run 0-4. */
const STACKS = [0, 1, 2, 3, 4];

/**
 * Every assumption over what the hit's values read, with a label each: the
 * product of consumed 0-4, each own stack 0 to its maximum, the enemy without
 * an infliction or with each named element at 1-4, Vulnerable 0-4. Empty when
 * the values read none of these.
 */
export function valueAssumptions(r: ValueReads, stackMax: (id: string) => number): { readonly assumption: ValueAssumption; readonly label: string }[] {
  if (!readsAnything(r)) return [];
  let out: { assumption: ValueAssumption; labels: string[] }[] = [{ assumption: {}, labels: [] }];
  const expand = <T>(options: readonly T[], add: (a: ValueAssumption, o: T) => ValueAssumption, label: (o: T) => string) => {
    out = out.flatMap((x) => options.map((o) => ({ assumption: add(x.assumption, o), labels: [...x.labels, label(o)] })));
  };
  if (r.consumed) expand(STACKS, (a, n) => ({ ...a, consumed: n }), (n) => `consumed ${n}`);
  for (const id of r.stacks) {
    const max = Math.max(0, Math.round(stackMax(id)));
    expand(Array.from({ length: max + 1 }, (_, i) => i), (a, n) => ({ ...a, stacks: { ...a.stacks, [id]: n } }), (n) => `stack ${id} ${n}`);
  }
  if (r.elements.length) {
    const options = [null, ...r.elements.flatMap((element) => STACKS.slice(1).map((stacks) => ({ element, stacks })))];
    expand(options, (a, o) => ({ ...a, infliction: o }), (o) => (o ? `enemy ${o.element} ×${o.stacks}` : "enemy without infliction"));
  }
  if (r.vulnerable) expand(STACKS, (a, n) => ({ ...a, vulnerable: n }), (n) => `enemy Vulnerable ${n}`);
  return out.map((x) => ({ assumption: x.assumption, label: x.labels.join(", ") }));
}

/** The stated counts `calc` shows such a hit at: 1 of each (an infliction of the first element the values name). */
export function statedCounts(r: ValueReads): ValueAssumption {
  return {
    ...(r.consumed ? { consumed: 1 } : {}),
    ...(r.stacks.length ? { stacks: Object.fromEntries(r.stacks.map((id) => [id, 1])) } : {}),
    ...(r.elements[0] ? { infliction: { element: r.elements[0], stacks: 1 } } : {}),
    ...(r.vulnerable ? { vulnerable: 1 } : {}),
  };
}
