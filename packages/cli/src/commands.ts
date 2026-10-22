// The CLI's commands as functions returning text, so they can be tested
// without spawning a process.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  Attr,
  attrName,
  availableConditions,
  computeHit,
  computeStats,
  EngineError,
  hitAvailable,
  NOT_MODELLED,
  Slot,
  type Build,
  type DamageOptions,
  type DamageTarget,
  type FoodData,
  type GameData,
  type HitDamage,
  type StatPanel,
  kitBuffModifiers,
} from "@efsim/engine";
import { num, pct, signedPct, table } from "./format.ts";
import { assumeValues, readsAnything, statedCounts, valueReads } from "./hitvalues.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function readBuild(file: string): Build {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(JSON.parse(readFileSync(join(ROOT, "schemas/build.schema.json"), "utf8")) as object);
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!validate(raw)) throw new Error(`${file}: ${ajv.errorsText(validate.errors)}`);
  return raw as Build;
}

export function find(data: GameData, query: string): string {
  const q = query.toLowerCase();
  const rows: string[][] = [];
  const add = (kind: string, id: string, name: string, extra = "") => {
    if (kind === q || id.toLowerCase().includes(q) || name.toLowerCase().includes(q)) rows.push([kind, id, name, extra]);
  };
  for (const o of Object.values(data.operators)) add("operator", o.id, o.name, data.kits.operators[o.id] ? "kit: yes" : "kit: not yet");
  for (const w of Object.values(data.weapons)) add("weapon", w.id, w.name, `${w.rarity}★`);
  for (const g of Object.values(data.gear)) add("gear", g.id, g.name, g.setId ? `set ${data.gearSets[g.setId]?.name ?? g.setId}` : "");
  for (const s of Object.values(data.gearSets)) add("gear set", s.id, s.name, `${s.piecesRequired} pieces`);
  for (const e of Object.values(data.enemies)) add("enemy", e.id, e.name);
  for (const f of Object.values(data.foods ?? {})) add("food", f.id, f.name, foodEffects(f));
  if (rows.length === 0) return `Nothing matches "${query}".`;
  return table(["type", "id", "name", ""], rows);
}

export function template(data: GameData, operator: string, weapon?: string): string {
  const op = data.operators[operator];
  if (!op) throw new Error(`unknown operator ${operator} (try: efsim find <name>)`);
  if (weapon !== undefined && !data.weapons[weapon]) throw new Error(`unknown weapon ${weapon}`);
  const build: Build = {
    operator,
    level: 90,
    promotion: 4,
    potential: 0,
    skillLevels: { basic: 12, battle: 12, combo: 12, ultimate: 12 },
    weapon: weapon === undefined ? null : { id: weapon, level: 90, skillLevels: [9, 9, 9] },
    gear: [],
  };
  return JSON.stringify(build, null, 2);
}

const PANEL_ATTRS = [
  Attr.MaxHp, Attr.Def, Attr.Str, Attr.Agi, Attr.Wisd, Attr.Will,
  Attr.CriticalRate, Attr.CriticalDamageIncrease, Attr.PhysicalAndSpellInflictionEnhance, Attr.UltimateSpGainScalar,
  Attr.NormalAttackDamageIncrease, Attr.NormalSkillDamageIncrease, Attr.ComboSkillDamageIncrease, Attr.UltimateSkillDamageIncrease,
  Attr.PhysicalDamageIncrease, Attr.FireDamageIncrease, Attr.PulseDamageIncrease, Attr.CrystDamageIncrease, Attr.NaturalDamageIncrease, Attr.EtherDamageIncrease,
];
const RATIO_ATTRS = new Set<number>([
  Attr.CriticalRate, Attr.CriticalDamageIncrease, Attr.UltimateSpGainScalar,
  Attr.NormalAttackDamageIncrease, Attr.NormalSkillDamageIncrease, Attr.ComboSkillDamageIncrease, Attr.UltimateSkillDamageIncrease,
  Attr.PhysicalDamageIncrease, Attr.FireDamageIncrease, Attr.PulseDamageIncrease, Attr.CrystDamageIncrease, Attr.NaturalDamageIncrease, Attr.EtherDamageIncrease,
]);

function showStat(attr: number, v: number): string {
  return RATIO_ATTRS.has(attr) ? pct(v) : num(v);
}

/** A food's stat lines in words: attribute and value per formula slot (modifiers of one buff with the same slot and value share a line). */
export function foodEffects(food: FoodData): string {
  const parts: string[] = [];
  for (const b of food.buffs) {
    const groups = new Map<string, { slot: number; value: number; attrs: number[] }>();
    for (const m of b.modifiers) {
      const k = `${m.slot}|${m.value}`;
      const g = groups.get(k) ?? { slot: m.slot, value: m.value, attrs: [] };
      g.attrs.push(m.attr);
      groups.set(k, g);
    }
    for (const g of groups.values()) {
      const names = g.attrs.map(attrName).join(", ");
      const first = g.attrs[0] as number;
      const amount =
        g.slot === Slot.Percent ? `+${pct(g.value)}`
        : g.slot === Slot.Flat ? `+${num(g.value)} flat`
        : g.slot === Slot.Multiply ? `×${num(g.value, 4)}`
        : g.slot === Slot.Add || g.slot === Slot.AddUnverified ? `${g.value < 0 ? "" : "+"}${showStat(first, g.value)}`
        : `${num(g.value, 4)} in formula item ${g.slot} (not counted: its formula isn't known)`;
      parts.push(`${names} ${amount}`);
    }
  }
  return parts.join("; ");
}

export function formatPanel(data: GameData, panel: StatPanel, verbose: boolean): string {
  const op = data.operators[panel.operator];
  const a = panel.atk;
  const out: string[] = [];
  out.push(`${op?.name ?? panel.operator}`);
  out.push(
    `ATK ${num(Math.floor(a.total), 0)} (exact ${num(a.total, 3)}) = [(${a.operatorBase} operator + ${a.weaponBase} weapon) × (1 + ${pct(a.percent)}) + ${num(a.flat)} flat]` +
      ` × ${num(a.attributeBonus, 4)} (${attrName(panel.mainAttr)} ${a.mainAttribute}, ${attrName(panel.subAttr)} ${a.secondaryAttribute})`,
  );
  if (panel.food) {
    const food = data.foods?.[panel.food.id];
    out.push(`Food: ${panel.food.name} (${panel.food.id}), the fight's first ${num(panel.food.duration)} s${food ? `: ${foodEffects(food)}` : ""}`);
  }
  // ATK per attribute point (attributes 76–79) is part of the attribute bonus: each its own line, with its sources.
  if (a.perPoint.length) {
    const rest = a.attributeBonus - a.perPoint.reduce((s, p) => s + p.bonus, 0);
    out.push(`  attribute bonus ${num(a.attributeBonus, 4)} = ${num(rest, 4)} (1 + ${attrName(panel.mainAttr)} ${a.mainAttribute} × ${num(data.constants.atkRateOfMain, 4)} + ${attrName(panel.subAttr)} ${a.secondaryAttribute} × ${num(data.constants.atkRateOfSub, 4)})`);
    for (const p of a.perPoint) {
      const sources = (panel.attrs[p.factorAttr]?.contributions ?? []).map((c) => `${c.source} ${num(c.value, 4)}`).join("; ");
      out.push(`    + ${num(p.bonus, 4)} = ${attrName(p.factorAttr)} (${p.factorAttr}) ${num(p.factor, 4)} × ${attrName(p.attr)} ${p.points}${sources ? ` [${sources}]` : ""}`);
    }
  }
  const rows: string[][] = [];
  for (const attr of PANEL_ATTRS) {
    const line = panel.attrs[attr];
    const total = line?.total ?? data.attributeDefaults[attr] ?? 0;
    if (!line && total === 0) continue;
    if (line && line.contributions.length === 0 && total === 0) continue;
    const sources = line ? [...line.contributions.map((c) => `${c.source} ${showStat(attr, c.value)}`), ...(line.unmodelled ?? []).map((c) => `${c.source} ${num(c.value, 4)} in formula item ${c.slot}, not counted`)] : [];
    rows.push([attrName(attr), showStat(attr, total), line ? showStat(attr, line.base) : "", verbose ? sources.join("; ") : `${sources.length} source${sources.length === 1 ? "" : "s"}`]);
  }
  out.push("", table(["stat", "total", "base", verbose ? "contributions" : "modifiers"], rows, ["l", "r", "r", "l"]));
  if (panel.warnings.length) out.push("", ...panel.warnings.map((w) => `WARNING: ${w}`));
  const unknown = Object.values(panel.attrs).filter((l) => l.unmodelled?.length);
  if (unknown.length) {
    out.push("", ...unknown.map((l) => `NOTE: ${l.name} leaves out ${l.unmodelled?.map((c) => `${c.source} (formula item ${c.slot})`).join(", ")}: that formula isn't known yet, so a kit value that reads ${l.name} is an error`));
  }
  if (panel.notApplied.length) {
    out.push("", "Not in this panel (conditional effects; see --condition):");
    for (const n of panel.notApplied) out.push(`  - ${n}`);
  }
  return out.join("\n");
}

function hitRows(hits: readonly HitDamage[]): string[][] {
  return hits.map((h) => [
    h.skillId.replace(/^chr_\d+_[a-z]+_/, ""),
    h.label,
    h.count > 1 ? `×${h.count}` : "",
    h.scaleParts.map((s) => `${s.key} ${num(s.value, 3)}`).join(" × "),
    num(h.damage, 0),
  ]);
}

export interface CalcOptions extends DamageOptions {
  readonly target: DamageTarget;
  readonly verbose: boolean;
  /** Kit buffs (own or equipment) to count as active, with layers. */
  readonly buffs?: readonly { readonly buff: string; readonly layers: number }[];
}

/** Hits that read the count of the event behind them (ValueExpr eventCount: Si's combo final hit, the stacks its trigger consumed) are shown at the smallest count. */
function withEventCount<T extends DamageOptions>(options: T): T {
  return { ...options, situation: { eventCount: 1, ...(options.situation ?? {}) } };
}
const EVENT_COUNT_NOTE = "  (hits that depend on the count of the event behind them, e.g. infliction stacks a combo's trigger consumed, are shown at a count of 1)";
function readsEventCount(data: GameData, build: Build): boolean {
  return (data.kits.operators[build.operator]?.skills ?? []).some((s) => JSON.stringify(s.hits).includes('"eventCount"'));
}

const STATED_NOTE = "  (hits whose values read the infliction stacks they consume, the operator's own stacks or the enemy's stacks are shown at 1 of each)";
function readsStated(data: GameData, build: Build): boolean {
  return (data.kits.operators[build.operator]?.skills ?? []).some((s) => s.hits.some((h) => readsAnything(valueReads(h))));
}

/**
 * Every hit of the operator's kit, as computeKit gives them (conditions the
 * options don't decide count as met), a hit whose values read what only a
 * fight knows (consumed stacks, own stacks, the enemy's stacks: hitvalues.ts)
 * at the stated counts instead of failing.
 */
function kitHits(data: GameData, build: Build, panel: StatPanel, target: DamageTarget, options: DamageOptions): HitDamage[] {
  const kit = data.kits.operators[build.operator];
  if (!kit) throw new EngineError(`no kit for ${build.operator} yet`);
  const opts = { assumeUnknown: true, ...options };
  return kit.skills.flatMap((s) =>
    // A poise-only landing (KitHit.poiseOnly) deals no damage (as damage.ts kitHits).
    s.hits.filter((h) => !h.poiseOnly && hitAvailable(data, build, panel, s.skillId, h, opts.situation)).map((h) => {
      const r = valueReads(h);
      return computeHit(data, build, panel, target, s, readsAnything(r) ? assumeValues(h, statedCounts(r), false) : h, opts);
    }),
  );
}

export function calc(data: GameData, build: Build, options: CalcOptions): string {
  const panel = computeStats(data, build);
  const out = [formatPanel(data, panel, options.verbose)];
  const enemy = data.enemies[options.target.enemy];
  const conditions = availableConditions(data, build);
  out.push(
    "",
    `Damage per hit vs ${enemy?.name ?? options.target.enemy} Lv${options.target.level}, crit: ${options.crit}${options.staggered ? ", staggered" : ""}` +
      (options.conditions.length ? `, conditions: ${options.conditions.join(", ")}` : "") +
      (options.buffs?.length ? `, buffs: ${options.buffs.map((b) => (b.layers > 1 ? `${b.buff} ×${b.layers}` : b.buff)).join(", ")}` : ""),
  );
  if (!data.kits.operators[build.operator]) {
    out.push("  No kit for this operator yet, so no hit damage (stats above are complete).");
  } else {
    const buffMods = (options.buffs ?? []).flatMap((b) => kitBuffModifiers(data, build, panel, b.buff, b.layers));
    const hits = kitHits(data, build, panel, options.target, { ...withEventCount(options), modifiers: [...(options.modifiers ?? []), ...buffMods] });
    out.push(table(["skill", "hit", "count", "multiplier", "damage"], hitRows(hits), ["l", "l", "l", "l", "r"]));
    if (readsEventCount(data, build)) out.push(EVENT_COUNT_NOTE);
    if (readsStated(data, build)) out.push(STATED_NOTE);
    if (options.verbose) {
      const z = hits[0]?.zones;
      if (z) out.push("", `Zones of the first hit: ${Object.entries(z).map(([k, v]) => `${k} ${num(v, 4)}`).join(", ")}`);
    }
  }
  if (conditions.length) {
    out.push("", "Conditions available (--condition <id>):");
    for (const c of conditions) out.push(`  ${options.conditions.includes(c.id) ? "[on] " : "[off]"} ${c.id}: ${c.label}`);
  }
  out.push("", `Not modelled yet (×1): ${NOT_MODELLED.join(", ")}.`);
  return out.join("\n");
}

export function compare(data: GameData, a: Build, b: Build, options: CalcOptions, labels: readonly [string, string]): string {
  if (a.operator !== b.operator) throw new Error("compare needs two builds of the same operator");
  const pa = computeStats(data, a);
  const pb = computeStats(data, b);
  const out: string[] = [`${data.operators[a.operator]?.name ?? a.operator}: ${labels[0]} (A) vs ${labels[1]} (B)`, ""];
  const statRows: string[][] = [["ATK", num(Math.floor(pa.atk.total), 0), num(Math.floor(pb.atk.total), 0), signedPct(pb.atk.total / pa.atk.total - 1)]];
  for (const attr of PANEL_ATTRS) {
    const va = pa.attrs[attr]?.total ?? data.attributeDefaults[attr] ?? 0;
    const vb = pb.attrs[attr]?.total ?? data.attributeDefaults[attr] ?? 0;
    if (va === vb) continue;
    statRows.push([attrName(attr), showStat(attr, va), showStat(attr, vb), RATIO_ATTRS.has(attr) ? `${((vb - va) * 100).toFixed(1)} pts` : signedPct(va === 0 ? 0 : vb / va - 1)]);
  }
  out.push(table(["stat", "A", "B", "B vs A"], statRows, ["l", "r", "r", "r"]));
  if (data.kits.operators[a.operator]) {
    const ha = kitHits(data, a, pa, options.target, withEventCount(options));
    const hb = kitHits(data, b, pb, options.target, withEventCount(options));
    const rows = ha.map((h, i) => {
      const other = hb[i] as HitDamage;
      return [h.skillId.replace(/^chr_\d+_[a-z]+_/, ""), h.label, num(h.damage, 0), num(other.damage, 0), signedPct(other.exact / h.exact - 1)];
    });
    out.push("", `Damage per hit (crit: ${options.crit}${options.conditions.length ? `, conditions: ${options.conditions.join(", ")}` : ""})`);
    out.push(table(["skill", "hit", "A", "B", "B vs A"], rows, ["l", "l", "r", "r", "r"]));
  }
  // Conditional effects aren't in either side's numbers, so a weapon or set that relies on them looks worse than it is.
  const onlyIn = (x: StatPanel, y: StatPanel) => x.notApplied.filter((n) => !y.notApplied.includes(n));
  const [na, nb] = [onlyIn(pa, pb), onlyIn(pb, pa)];
  if (na.length || nb.length) {
    out.push("", "Conditional effects not included in these numbers:");
    for (const n of na) out.push(`  A: ${n}`);
    for (const n of nb) out.push(`  B: ${n}`);
  }
  return out.join("\n");
}
