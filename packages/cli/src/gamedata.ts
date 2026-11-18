// `efsim gamedata`: reading the raw BuffData and SkillData files (data/rmxlinux-EndfieldData/Json/) without scratch
// tools. `tree <id>`: a file as a compact event → action → condition tree, presentation and default values left out,
// value fields read as "key k (default v)", known enum numbers named (docs/game-data-format.md "Known enum values").
// `who <id>`: every file that names a buff or skill id, with the JSON path and the action around it (who creates,
// finishes or checks a buff).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonExact, sourceDir } from "@efsim/data";

export type DataFolder = "BuffData" | "SkillData";

function folder(f: DataFolder): string {
  return join(sourceDir("rmxlinux"), "Json", f);
}

/** The file of a buff or skill id: BuffData if there is one, else SkillData. */
export function dataFile(id: string): { folder: DataFolder; file: string } {
  for (const f of ["BuffData", "SkillData"] as const) {
    const file = join(folder(f), `${id}.json`);
    if (existsSync(file)) return { folder: f, file };
  }
  throw new Error(`${id}: no BuffData or SkillData file of that name (in ${join(sourceDir("rmxlinux"), "Json")})`);
}

/**
 * Enum readings the tree names, from docs/game-data-format.md "Known enum values" (keep the two in step). Inferred
 * readings are marked "?" there and here.
 */
export const ENUMS: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  // docs/game-data-format.md "abilityEvent numbers": collected from the kits' notes (round 3); "?" from one file only.
  abilityEvent: {
    1: "owner's HP reaches 0",
    6: "entering battle",
    8: "owner defeated?",
    9: "a buff added to the holder",
    12: "takes damage?",
    13: "deals damage (a landing)",
    30: "casts a skill",
    40: "applies Knock Down?",
    43: "takes Critical DMG",
    44: "scores a critical hit",
    45: "receives a heal",
    50: "heals someone",
    55: "an enemy Lifted?",
    59: "suffers a physical status",
    64: "an operator takes damage?",
    101: "takes damage (is hit)",
    102: "applies a buff",
    122: "an infliction on the holder?",
    126: "applies an Arts Infliction",
    127: "applies an Arts Burst",
    141: "an enemy's charge interrupted?",
    142: "obtains SP",
    143: "a skill cast, cost paid?",
    150: "leaving battle",
    205: "a buff added to the aura holder?",
    206: "applies a buff (before output)",
    208: "removes / consumes a buff",
    209: "a buff layer of the holder ends?",
    222: "a kill?",
    262: "an ability entity finished",
    302: "deals damage (before output)",
    401: "applies a physical status",
  },
  buffEvent: { 0: "on start", 1: "on tick", 2: "on finish", 5: "while enabled", 6: "on stack change?", 7: "on stack added?" },
  compare: { 0: "<", 1: "<=", 2: ">", 3: ">=", 4: "==" },
  costType: { 0: "ultimate energy", 1: "SP" },
  inflictionType: { 0: "Heat", 1: "Electric", 2: "Cryo", 3: "Nature" },
  lifeType: { 0: "timed", 1: "until finished?" },
};

/** Action types that only present (animation, sound, camera, effects): left out of the tree. */
const PRESENTATION = /^(PlayAnimation|Effect|PlaySound|Camera\w*|CustomRootMotion|CharWeapon\w*|VoiceTrigger|EnemyHurtAnim|RayCastEffect|ShowHideActor|SetAnimatorParam|\w*RootMotion\w*|\w*Rotat\w*|PlayVfx\w*|\w*Vfx\w*|\w*Audio\w*|\w*Wwise\w*|HitFreeze\w*|ScreenEffect\w*|ShakeCamera\w*)(Action)?$/;
/** Keys that only present or are bookkeeping. */
const SKIP_KEY = /^(iconConfig|serverActionIndex|priorityLevel|priorityOffset|_comment|editorData|vfx\w*|audio\w*|sound\w*|_spritePath)$/i;

export interface TreeNode {
  readonly label: string;
  readonly children: readonly TreeNode[];
}

/** "Beyond.Gameplay.Core.SpeedupAction+Data, Gameplay.Beyond" → "SpeedupAction". */
export function shortType(t: string): string {
  return (t.split(",")[0] ?? t).split(".").pop()?.split("+")[0] ?? t;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A value field ({useBlackboardKey, blackboardKey, value}) as text, or null when `v` isn't one. */
function valueField(v: Record<string, unknown>): string | null {
  if (!("useBlackboardKey" in v) || !("value" in v)) return null;
  const extra = Object.keys(v).filter((k) => !["useBlackboardKey", "blackboardKey", "value"].includes(k));
  if (extra.length) return null;
  const key = typeof v["blackboardKey"] === "string" ? v["blackboardKey"] : "";
  return v["useBlackboardKey"] ? `key ${key} (default ${String(v["value"])})` : String(v["value"]);
}

function isDefault(v: unknown): boolean {
  if (v === false || v === 0 || v === "" || v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (isObj(v)) {
    if (Object.keys(v).length === 0) return true;
    if ("useBlackboardKey" in v && !v["useBlackboardKey"] && (v["value"] === 0 || v["value"] === -1)) return true;
  }
  return false;
}

function scalar(key: string, v: unknown): string {
  if (typeof v === "number" && ENUMS[key]?.[v] !== undefined) return `${key} ${v} (${ENUMS[key][v]})`;
  return `${key} ${typeof v === "string" ? v : JSON.stringify(v)}`;
}

/** The compact tree of a parsed data file (or any part of one). */
export function dataTree(v: unknown, label = ""): TreeNode {
  if (Array.isArray(v)) {
    const kids = v.flatMap((x, i) => (isDefault(x) ? [] : [dataTree(x, `[${i}]`)])).filter((n) => !(n.label.endsWith("(presentation)") && n.children.length === 0));
    return collapse({ label, children: kids }, true);
  }
  if (!isObj(v)) return { label: label ? scalar(label, v) : String(v), children: [] };
  const type = typeof v["$type"] === "string" ? shortType(v["$type"]) : null;
  if (type && PRESENTATION.test(type)) return { label: `${label} ${type} (presentation)`.trim(), children: [] };
  const inline: string[] = [];
  const children: TreeNode[] = [];
  for (const [k, x] of Object.entries(v)) {
    // Enum fields and frames are shown even at 0 (buffEvent 0 is "on start").
    if (k === "$type" || SKIP_KEY.test(k) || (isDefault(x) && !((k in ENUMS || k === "_startFrame") && typeof x === "number"))) continue;
    if (isObj(x)) {
      const f = valueField(x);
      if (f !== null) {
        inline.push(`${k}: ${f}`);
        continue;
      }
    }
    if (!isObj(x) && !Array.isArray(x)) {
      inline.push(scalar(k, x));
      continue;
    }
    const sub = dataTree(x, k);
    if (sub.children.length || sub.label !== k) children.push(sub);
  }
  const head = [label, type, inline.join(", ")].filter(Boolean).join("  ");
  // Presentation-only entries of an array vanish.
  return collapse({ label: head, children: children.filter((c) => !c.label.endsWith("(presentation)")) }, !type && !inline.length);
}

/** A bare key or index with one child joins it on one line (`actions › [0] › actionData`). */
function collapse(n: TreeNode, bare: boolean): TreeNode {
  const only = n.children[0];
  return bare && n.children.length === 1 && only ? { label: `${n.label} › ${only.label}`, children: only.children } : n;
}

/** The tree as indented lines; with `grep`, only the lines that match and their ancestors; `depth` levels at most. */
export function renderTree(node: TreeNode, opts: { readonly grep?: RegExp; readonly depth?: number } = {}): string {
  const out: string[] = [];
  const keep = (n: TreeNode): boolean => !opts.grep || opts.grep.test(n.label) || n.children.some(keep);
  const walk = (n: TreeNode, d: number) => {
    if (!keep(n)) return;
    out.push(`${"  ".repeat(d)}${n.label}`);
    if (opts.depth !== undefined && d >= opts.depth) return;
    // Under a matching line, its whole subtree; else only the matching branches.
    for (const c of n.children) (opts.grep && opts.grep.test(n.label) ? walkAll : walk)(c, d + 1);
  };
  const walkAll = (n: TreeNode, d: number) => {
    out.push(`${"  ".repeat(d)}${n.label}`);
    if (opts.depth !== undefined && d >= opts.depth) return;
    for (const c of n.children) walkAll(c, d + 1);
  };
  walk(node, 0);
  return out.join("\n");
}

/** `efsim gamedata tree <id>`. */
export function gamedataTree(id: string, opts: { readonly grep?: string; readonly depth?: number } = {}): string {
  const { folder: f, file } = dataFile(id);
  const tree = dataTree(parseJsonExact(readFileSync(file, "utf8")), `${id} (${f})`);
  return renderTree(tree, { ...(opts.grep !== undefined ? { grep: new RegExp(opts.grep) } : {}), ...(opts.depth !== undefined ? { depth: opts.depth } : {}) });
}

export interface Mention {
  readonly folder: DataFolder;
  readonly file: string;
  /** The JSON path of the string equal to the id. */
  readonly path: string;
  /** The innermost action around it ($type, short) and the buff event or frame it sits under. */
  readonly action: string | null;
  readonly context: string | null;
}

/** Every place a BuffData or SkillData file names `id` (a string value equal to it), but the file's own `id`. */
export function whoMentions(id: string): Mention[] {
  const needle = JSON.stringify(id);
  const out: Mention[] = [];
  for (const f of ["BuffData", "SkillData"] as const) {
    const dir = folder(f);
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".json")) continue;
      const text = readFileSync(join(dir, name), "utf8");
      if (!text.includes(needle)) continue;
      const file = name.replace(/\.json$/, "");
      const visit = (v: unknown, path: string, action: string | null, context: string | null) => {
        if (v === id) {
          if (!(file === id && (path === ".id" || path === ".skillId"))) out.push({ folder: f, file, path, action, context });
          return;
        }
        if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${path}[${i}]`, action, context));
        else if (isObj(v)) {
          const a = typeof v["$type"] === "string" ? shortType(v["$type"]) : action;
          const c =
            typeof v["buffEvent"] === "number"
              ? `buffEvent ${v["buffEvent"]}${ENUMS["buffEvent"]?.[v["buffEvent"]] ? ` (${ENUMS["buffEvent"][v["buffEvent"]]})` : ""}`
              : typeof v["_startFrame"] === "number"
                ? `frame ${v["_startFrame"]}`
                : context;
          for (const [k, x] of Object.entries(v)) visit(x, `${path}.${k}`, a, c);
        }
      };
      visit(parseJsonExact(text), "", null, null);
    }
  }
  return out;
}

/** `efsim gamedata who <id>`. */
export function formatMentions(id: string, ms: readonly Mention[]): string {
  if (!ms.length) return `${id}: no BuffData or SkillData file names it`;
  return [`${id}: named in ${new Set(ms.map((m) => m.file)).size} file(s), ${ms.length} place(s):`, ...ms.map((m) => `  ${m.folder}/${m.file}  ${m.action ?? "-"}${m.context ? `  [${m.context}]` : ""}  ${m.path}`)].join("\n");
}

export interface Found {
  readonly folder: DataFolder;
  readonly file: string;
  readonly path: string;
  /** Its own scalar and value fields (selectors and nested actions left out), as the tree shows them. */
  readonly fields: Readonly<Record<string, string>>;
  /** The buff event, ability event or frame it sits under. */
  readonly context: string | null;
}

/**
 * Every action (any object with a `$type`) of a type in the BuffData / SkillData files: `type` matches the short type
 * ("HitStop" or "HitStopAction", a regex), `file` the file name, `enabled` keeps only those not switched off
 * (isEnable false). For questions like "who applies a slow to the enemy" without a walker per agent.
 */
export function findActions(opts: { readonly type: string; readonly file?: string; readonly folder?: DataFolder; readonly enabled?: boolean }): Found[] {
  const type = new RegExp(`^(${opts.type})(Action)?$`);
  const fileRe = opts.file ? new RegExp(opts.file) : null;
  const out: Found[] = [];
  for (const f of opts.folder ? [opts.folder] : (["BuffData", "SkillData"] as const)) {
    const dir = folder(f);
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".json") || (fileRe && !fileRe.test(name))) continue;
      const file = name.replace(/\.json$/, "");
      const visit = (v: unknown, path: string, context: string | null) => {
        if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${path}[${i}]`, context));
        if (!isObj(v)) return;
        const c =
          typeof v["buffEvent"] === "number"
            ? `buffEvent ${v["buffEvent"]}${ENUMS["buffEvent"]?.[v["buffEvent"]] ? ` (${ENUMS["buffEvent"][v["buffEvent"]]})` : ""}`
            : typeof v["abilityEvent"] === "number"
              ? `abilityEvent ${v["abilityEvent"]}${ENUMS["abilityEvent"]?.[v["abilityEvent"]] ? ` (${ENUMS["abilityEvent"][v["abilityEvent"]]})` : ""}`
              : typeof v["_startFrame"] === "number"
                ? `frame ${v["_startFrame"]}`
                : context;
        const t = typeof v["$type"] === "string" ? shortType(v["$type"]) : null;
        if (t && type.test(t) && !(opts.enabled && v["isEnable"] === false)) {
          const fields: Record<string, string> = {};
          for (const [k, x] of Object.entries(v)) {
            if (k === "$type" || SKIP_KEY.test(k)) continue;
            if (isObj(x)) {
              const val = valueField(x);
              if (val !== null) fields[k] = val;
            } else if (!Array.isArray(x)) fields[k] = scalar(k, x);
          }
          out.push({ folder: f, file, path, fields, context: c });
        }
        for (const [k, x] of Object.entries(v)) visit(x, `${path}.${k}`, c);
      };
      visit(parseJsonExact(readFileSync(join(dir, name), "utf8")), "", null);
    }
  }
  return out;
}

/** `efsim gamedata find`: one line per action found (its fields, or only `fields`), or with `count` the counts of a field's values. */
export function formatFound(found: readonly Found[], opts: { readonly fields?: readonly string[]; readonly count?: string } = {}): string {
  if (opts.count) {
    const n = new Map<string, number>();
    for (const x of found) {
      const k = x.fields[opts.count] ?? "(absent)";
      n.set(k, (n.get(k) ?? 0) + 1);
    }
    return [`${found.length} action(s) in ${new Set(found.map((x) => x.file)).size} file(s), by ${opts.count}:`, ...[...n].sort((a, b) => b[1] - a[1]).map(([k, c]) => `  ${String(c).padStart(6)}  ${k}`)].join("\n");
  }
  const lines = found.map((x) => {
    const fs = Object.entries(x.fields).filter(([k]) => !opts.fields?.length || opts.fields.includes(k));
    return `  ${x.folder}/${x.file}${x.context ? `  [${x.context}]` : ""}  ${fs.map(([, v]) => v).join(", ")}  ${x.path}`;
  });
  return [`${found.length} action(s) in ${new Set(found.map((x) => x.file)).size} file(s):`, ...lines].join("\n");
}
