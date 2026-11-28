// `efsim gamedata enemy <enemy id | fixture>`: an enemy's tables and its stages' text in one view (round 19, the slug
// report point 1: Hard 33's "slug" was read as one enemy with phases for weeks; its stage's description says "They are
// legion", and the logged totals were eight slugs' Max HP, but no command printed a stage's text). The EnemyTable row
// (template, attribute template, AI template, born buffs, modifiers), the compiled enemy at the fight's level (Max HP,
// ATK, DEF, resistances, rank, Stagger nodes), every DungeonTable stage naming it or its template with its English
// name, description and feature text (I18nTextTable_EN), and the BuffData / SkillData files that name either id.
// Given a fixture: its level, and the logged total ÷ Max HP (several targets, lives or a stage's scaling).

import { readTable } from "@efsim/data";
import { Attr, type GameData } from "@efsim/engine";
import { missingEnemyFacts, readDevFixture } from "@efsim/logs";
import { filesNamed, whoMentions } from "./gamedata.ts";

/** EnemyTemplateDisplayInfoTable's displayType, as 555me's DisplayEnemyTypeTable names it (EnemyData.rank). */
const RANKS: Readonly<Record<number, string>> = { 0: "Common", 1: "Elite", 2: "Boss", 3: "Advanced", 4: "Alpha" };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A text reference's English text (I18nTextTable_EN), its markup tags left out; "" for none. */
function textOf(i18n: Readonly<Record<string, unknown>>, ref: unknown): string {
  if (!isObj(ref)) return "";
  const inline = typeof ref["text"] === "string" ? ref["text"] : "";
  const t = inline || (ref["id"] !== 0 && ref["id"] !== undefined ? String(i18n[String(ref["id"])] ?? "") : "");
  return t.replace(/<@[^>]*>|<\/>/g, "").trim();
}

/** The lines of `gamedata enemy`. */
export function enemyView(data: GameData, arg: string): string {
  const fx = arg.startsWith("eny_") ? undefined : readDevFixture(arg);
  const id = fx ? fx.enemy.id : arg;
  const table = readTable("rmxlinux", "EnemyTable") as Record<string, unknown>;
  const row = table[id];
  const e = data.enemies[id];
  if (!isObj(row) && !e) throw new Error(`${id}: no EnemyTable row and no compiled enemy of that id (efsim find --enemies)`);
  const template = isObj(row) && typeof row["templateId"] === "string" ? row["templateId"] : id;
  const out: string[] = [`${id}${e ? ` (${e.name})` : ""}${fx ? `, the enemy of ${arg} at level ${fx.enemy.level}` : ""}`];
  if (isObj(row)) {
    const list = (v: unknown) => (Array.isArray(v) && v.length ? JSON.stringify(v) : "none");
    out.push(`  EnemyTable: template ${row["templateId"]}, attributes ${row["attrTemplateId"]}, AI ${row["aiTemplateId"] || "none"}, born buffs ${list(row["bornBuffs"])}, attribute modifiers ${list(row["attrModifiers"])}`);
  } else out.push("  EnemyTable: no row (a compiled enemy only)");
  if (e) {
    const levels = fx ? [fx.enemy.level] : [1, 60, 80, 90].filter((l) => l <= e.levels.length);
    for (const l of levels) {
      const a = e.levels[l - 1] ?? {};
      out.push(`  level ${l}: Max HP ${a[Attr.MaxHp] ?? "?"}, ATK ${a[Attr.Atk] ?? "?"}, DEF ${a[Attr.Def] ?? "?"}`);
    }
    out.push(`  resistances ${Object.entries(e.resistance).map(([k, v]) => `${k} ${v}`).join(", ")}; rank ${e.rank !== undefined ? `${e.rank} (${RANKS[e.rank] ?? "?"})` : "unknown"}; Stagger nodes ${e.staggerNodes.length ? e.staggerNodes.join(", ") : "none"}${e.superArmor ? `; super armor ${e.superArmor.initial} (Staggered ${e.superArmor.staggered})` : ""}${e.controlImmune ? "; ignores freezes" : ""}`);
  }
  // Round 22 (the Estella-Akekuri report point 2): what kits or the engine read that the data lacks, said at once.
  const missing = missingEnemyFacts(data, id);
  if (missing.length) out.push(`  missing in the data: ${missing.join("; ")}`);
  if (fx && e) {
    const max = e.levels[fx.enemy.level - 1]?.[Attr.MaxHp];
    const total = fx.hits.reduce((s, h) => s + h.value, 0);
    if (max) out.push(`  the log's total: ${Math.round(total)} = ${(total / max).toFixed(3)} × Max HP${fx.severalTargets ? " (the fixture is marked severalTargets)" : ""}: a whole number over 1 is several targets, lives or a stage's scaling (the stage text below says which)`);
  }
  const i18n = readTable("rmxlinux", "I18nTextTable_EN") as Record<string, unknown>;
  const stages = Object.entries(readTable("rmxlinux", "DungeonTable") as Record<string, unknown>).filter(([, s]) => isObj(s) && Array.isArray(s["enemyIds"]) && (s["enemyIds"] as unknown[]).some((x) => x === id || x === template));
  out.push(`  ${stages.length} stage(s) naming ${id}${template !== id ? ` or its template ${template}` : ""} (DungeonTable):`);
  for (const [sid, s] of stages as [string, Record<string, unknown>][]) {
    const ids = s["enemyIds"] as unknown[];
    const levels = Array.isArray(s["enemyLevels"]) ? (s["enemyLevels"] as unknown[]) : [];
    const at = ids.map((x, i) => (x === id || x === template ? levels[i] : undefined)).filter((x) => x !== undefined);
    out.push(`    ${sid} "${textOf(i18n, s["dungeonName"])}" (level ${at.join(", ") || "?"}; ${ids.length} enemy id(s) listed: ${ids.join(", ")})`);
    for (const [label, key] of [["description", "dungeonDesc"], ["level", "dungeonLevelDesc"], ["features", "featureDesc"]] as const) {
      const t = textOf(i18n, s[key]);
      if (t) out.push(...t.split("\n").filter((x) => x.trim()).map((x, i) => `      ${i === 0 ? `${label}: ` : "  "}${x.trim()}`));
    }
  }
  for (const x of template !== id ? [id, template] : [id]) {
    const files = [...new Set(whoMentions(x).map((m) => `${m.folder}/${m.file}`))];
    out.push(`  ${files.length} BuffData / SkillData file(s) naming ${x}${files.length ? `: ${files.slice(0, 12).join(", ")}${files.length > 12 ? `, … (gamedata who ${x})` : ""}` : ""}`);
  }
  // The common files made for it carry its short name in theirs (buff_common_mini_poise_break_slwood, the numshield files).
  const short = /^eny_\d+_([a-z0-9]+)/.exec(template)?.[1];
  if (short) {
    const named = filesNamed(short);
    out.push(`  ${named.length} file(s) with "${short}" in their name${named.length ? `: ${named.slice(0, 12).join(", ")}${named.length > 12 ? ", …" : ""}` : ""}`);
  }
  return out.join("\n");
}
