// `efsim gamedata`: reading the raw BuffData and SkillData files (data/rmxlinux-EndfieldData/Json/) without scratch
// tools. `tree <id>`: a file as a compact event → action → condition tree, presentation and default values left out,
// value fields read as "key k (default v)", known enum numbers named (docs/game-data-format.md "Known enum values").
// `who <id>`: every file that names a buff or skill id, with the JSON path and the action around it (who creates,
// finishes or checks a buff).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dilationCurve, parseJsonExact, sourceDir } from "@efsim/data";

export type DataFolder = "BuffData" | "SkillData";

/**
 * The world frames a slow-down holds (Σ(1 − scale) over its frames), and what several of one skill hold together at the
 * lowest scale where they overlap (timeline/clock.ts slowDown counts them so): sizes a hypothesis about slow-downs
 * before anyone builds it (round 8: Rossi's combo_3 dilations, 19 and 12 frames long, hold 1.5–2.2 frames apart, not 7).
 */
export function heldFrames(slowdowns: readonly { readonly from: number; readonly scales: readonly number[] }[]): { readonly each: number[]; readonly together: number } {
  const each = slowdowns.map((d) => d.scales.reduce((a, v) => a + (1 - v), 0));
  const lowest = new Map<number, number>();
  for (const d of slowdowns) d.scales.forEach((v, k) => lowest.set(d.from + k, Math.min(lowest.get(d.from + k) ?? 1, v)));
  return { each, together: [...lowest.values()].reduce((a, v) => a + (1 - v), 0) };
}

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
    1401: "the holder removed from the field?",
    1402: "the owner's spawned entities to go?",
    1403: "the holder removed from the field?",
    1601: "the holder handed over (transferred source)?",
  },
  buffEvent: { 0: "on start", 1: "on tick", 2: "on finish", 5: "while enabled", 6: "on stack change?", 7: "on stack added?" },
  compare: { 0: "<", 1: "<=", 2: ">", 3: ">=", 4: "==" },
  costType: { 0: "ultimate energy", 1: "SP" },
  inflictionType: { 0: "Heat", 1: "Electric", 2: "Cryo", 3: "Nature" },
  lifeType: { 0: "timed", 1: "until finished?" },
  // docs/game-data-format.md "stackingType readings" (round 16, arcane-doubles-end report point 2): the engine's reading
  // of each type (packages/data kits.ts LAYERED_TYPES, SHARED_TIMER_TYPES, groupsInstances, oneLayerOnHolder) with the
  // kit or log that decided it there; "unverified" where none has, Endaxis' described label after it.
  stackingType: {
    0: "instances add up; a priority key alone doesn't rank them: b7b3",
    1: "only the strongest instance acts: a stack group, by its priority key where it has one",
    2: "layers, each its own timer; a literal max 1 on others: one layer whoever applies: 9555",
    3: "unverified (enhance?)",
    4: "one instance, refreshed",
    5: "unverified (extend?)",
    6: "unverified (modify?)",
    7: "not layers, reading unverified (unique?)",
    8: "layers on one timer each new layer refreshes: in-game test 62",
    9: "not layers, reading unverified (overwrite duration?)",
    10: "layers on one shared timer: the inflictions, 7e19's Ember",
    11: "layers, each its own timer; a priority key, one instance: a stack group: Jade Vessel",
    12: "unverified (timed growing enhance?)",
  },
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
    const all = v.flatMap((x, i) => (isDefault(x) ? [] : [dataTree(x, `[${i}]`)]));
    const presentation = all.filter((n) => n.label.endsWith("(presentation)") && n.children.length === 0);
    const kids = all.filter((n) => !presentation.includes(n));
    // A list of nothing but presentation (an IfElse branch that only plays an effect) is said to be one, not left out
    // as if the branch weren't there (physical-statuses report point 3: Empyrean's free-path branches looked cut).
    if (!kids.length && presentation.length) return { label: `${label ? `${label} › ` : ""}(presentation only, left out: ${countTypes(presentation)})`, children: [] };
    return collapse({ label, children: kids }, true);
  }
  if (!isObj(v)) return { label: label ? scalar(label, v) : String(v), children: [] };
  const type = typeof v["$type"] === "string" ? shortType(v["$type"]) : null;
  if (type && PRESENTATION.test(type)) return { label: `${label} ${type} (presentation)`.trim(), children: [] };
  const inline: string[] = [];
  const children: TreeNode[] = [];
  // A disabled action (isEnable false) does nothing in the game: said first, not left out as a default (Liino's volley
  // looked reaction-gated for months because its CheckBuffIdInContext's isEnable false wasn't shown).
  if (type && v["isEnable"] === false) inline.push("DISABLED (isEnable false)");
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

/** The types of presentation nodes ("[0] EffectAction (presentation)"), counted: "EffectAction ×2, PlaySound". */
function countTypes(nodes: readonly TreeNode[]): string {
  const n = new Map<string, number>();
  for (const x of nodes) {
    const t = x.label.split(" ").at(-2) ?? "?";
    n.set(t, (n.get(t) ?? 0) + 1);
  }
  return [...n].map(([t, k]) => (k > 1 ? `${t} ×${k}` : t)).join(", ");
}

/** A JSON path as `who` prints it (`.a.b[3].c`) as its steps; throws on anything else. */
export function parseJsonPath(path: string): (string | number)[] {
  const steps: (string | number)[] = [];
  const re = /\.([^.[\]]+)|\[(\d+)\]/y;
  let at = 0;
  while (at < path.length) {
    re.lastIndex = at;
    const m = re.exec(path);
    if (!m) throw new Error(`--path ${path}: not a JSON path like .actionGroupData.timelineActions[9] (as \`gamedata who\` prints them), at "${path.slice(at)}"`);
    steps.push(m[1] !== undefined ? m[1] : Number(m[2]));
    at = re.lastIndex;
  }
  return steps;
}

/** The part of a parsed file at a path; throws naming the first step that isn't there. */
export function atJsonPath(v: unknown, path: string): unknown {
  let cur = v;
  let done = "";
  for (const s of parseJsonPath(path)) {
    const next = typeof s === "number" ? (Array.isArray(cur) ? cur[s] : undefined) : isObj(cur) ? cur[s] : undefined;
    if (next === undefined) throw new Error(`--path ${path}: nothing at ${typeof s === "number" ? `[${s}]` : `.${s}`} after "${done || "(the file)"}"`);
    cur = next;
    done += typeof s === "number" ? `[${s}]` : `.${s}`;
  }
  return cur;
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

/**
 * `efsim gamedata curve <id> [--path p] [--frame n…]`: each TimeDilationAction (any layer) of a BuffData or SkillData
 * file, its curve as the compiler reads it (packages/data dilationCurve: its own keys, Hermite, or a named curve), its
 * mean scale over its length and the owner's time it lets pass, and for each `frame` of the owner's timeline counted
 * from the action's start, the real frame it comes at (the curve's local time reaching it, then 1 a frame after).
 * Round 23 (the placement-cases report point 5: the Decisive Assault's curve took scripts/probes/entities/
 * harass-slowdown.ts with the keys copied by hand). `path` (as `who` and `tree --path` print it) picks one.
 */
export function curveView(id: string, opts: { readonly path?: string; readonly frames?: readonly number[] } = {}): string {
  const { folder: f, file } = dataFile(id);
  const parsed = parseJsonExact(readFileSync(file, "utf8"));
  const found: { path: string; o: Record<string, unknown>; from: number | null; interval: number }[] = [];
  const visit = (v: unknown, path: string, from: number | null, interval: number) => {
    if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${path}[${i}]`, from, interval));
    if (!isObj(v)) return;
    // A timeline action's frames (SkillData _startFrame / _endFrame): what finishByAction cuts a dilation to.
    const start = typeof v["_startFrame"] === "number" ? v["_startFrame"] : null;
    const [f0, iv] = start !== null ? [start, typeof v["_endFrame"] === "number" ? v["_endFrame"] - start : Infinity] : [from, interval];
    if (typeof v["$type"] === "string" && v["$type"].includes("TimeDilationAction")) found.push({ path, o: v, from: f0, interval: iv });
    for (const [k, x] of Object.entries(v)) visit(x, `${path}.${k}`, f0, iv);
  };
  visit(parsed, "", null, Infinity);
  const picked = opts.path !== undefined ? found.filter((x) => x.path === opts.path || x.path.startsWith(`${opts.path}.`) || x.path.startsWith(`${opts.path}[`)) : found;
  if (!picked.length) return `${id} (${f}): ${found.length ? `no TimeDilationAction at ${opts.path} (they are at ${found.map((x) => x.path).join(", ")})` : "no TimeDilationAction"}`;
  const out = [`${id} (${f}): ${picked.length} TimeDilationAction(s); scale by the curve's normalised time, sampled mid-frame as the compiler samples a global one (skillData.ts slowdownOf)`];
  for (const x of picked) {
    const c = dilationCurve(x.o, x.interval);
    const layer = typeof x.o["layer"] === "number" ? `layer ${x.o["layer"]}` : "no layer";
    const head = `${x.path}: ${layer}${x.from !== null ? `, at the timeline's frame ${x.from}` : ""}${x.o["isEnable"] === false ? ", switched off (isEnable false)" : ""}`;
    if (!c) {
      out.push(`${head}: no length or an unknown curve (${x.o["useCurveKey"] === true ? `named ${String(x.o["curveKey"])}` : "no keys"})`);
      continue;
    }
    const scales = Array.from({ length: c.frames }, (_, k) => Math.max(0, Math.min(1, c.at((k + 0.5) / c.frames))));
    const local = scales.reduce((a, v) => a + v, 0);
    out.push(`${head}: ${c.source}, ${c.frames} frames (${(c.frames / 30).toFixed(2)} s); mean scale ${(local / c.frames).toFixed(4)}: the owner's time runs ${local.toFixed(2)} frames of the ${c.frames} (holds ${(c.frames - local).toFixed(2)})`);
    out.push(`  scale at t = ${[0, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1].map((t) => `${t}: ${Math.max(0, Math.min(1, c.at(t))).toFixed(3)}`).join(", ")}`);
    for (const target of opts.frames ?? []) {
      // The real frame at which the owner's local time reaches `target` frames: through the curve's frames, then 1 a frame.
      let acc = 0;
      let real: number | null = null;
      for (let k = 0; k < scales.length; k++) {
        const s = scales[k] as number;
        if (acc + s >= target) {
          real = k + (s > 0 ? (target - acc) / s : 0);
          break;
        }
        acc += s;
      }
      real ??= scales.length + (target - acc);
      out.push(`  the owner's frame ${target} comes at real frame ${real.toFixed(2)} (+${(real - target).toFixed(2)} frames)`);
    }
  }
  return out.join("\n");
}

/** `efsim gamedata tree <id>`. */
export function gamedataTree(id: string, opts: { readonly grep?: string; readonly depth?: number; readonly path?: string } = {}): string {
  if (!["BuffData", "SkillData"].some((d) => existsSync(join(folder(d as DataFolder), `${id}.json`)))) return noFileView(id);
  const { folder: f, file } = dataFile(id);
  const parsed = parseJsonExact(readFileSync(file, "utf8"));
  const tree = opts.path !== undefined ? dataTree(atJsonPath(parsed, opts.path), `${id} (${f}) ${opts.path}`) : dataTree(parsed, `${id} (${f})`);
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

/** How a buff id is created in the data: its create actions (CreateBuffAction, CreateBuffAttachingSkill, …), enabled and disabled (isEnable false). */
export interface Creators {
  readonly enabled: number;
  readonly disabled: readonly string[];
}

/**
 * Every buff id a create action of BuffData or SkillData names (its `buffId`s, at any depth under it), with how many of
 * those actions are enabled and the files of the disabled ones: one pass over the files (kit-census's dead-effect check;
 * round 17, the Zhuang Fangyi and Liino report point 4: Liino's 5 s linger was in her kit, its CreateBuffAction
 * `isEnable false` in buff_chr_0035_liino_normalskill_buff_atkup).
 */
export function buffCreators(): Map<string, Creators> {
  const acc = new Map<string, { enabled: number; disabled: string[] }>();
  for (const f of ["BuffData", "SkillData"] as const) {
    const dir = folder(f);
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".json")) continue;
      const text = readFileSync(join(dir, name), "utf8");
      if (!text.includes("CreateBuff")) continue;
      const file = name.replace(/\.json$/, "");
      const ids = (v: unknown, out: Set<string>) => {
        if (Array.isArray(v)) for (const x of v) ids(x, out);
        else if (isObj(v)) for (const [k, x] of Object.entries(v)) if (k === "buffId" && typeof x === "string" && x !== "") out.add(x);
        else ids(x, out);
      };
      const visit = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(visit);
        else if (isObj(v)) {
          if (typeof v["$type"] === "string" && v["$type"].includes("CreateBuff")) {
            const made = new Set<string>();
            ids(v, made);
            for (const id of made) {
              const a = acc.get(id) ?? { enabled: 0, disabled: [] };
              if (v["isEnable"] === false) a.disabled.push(`${f}/${file}`);
              else a.enabled++;
              acc.set(id, a);
            }
          }
          for (const x of Object.values(v)) visit(x);
        }
      };
      visit(parseJsonExact(text));
    }
  }
  return acc;
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
  /**
   * Why it does nothing in the game, where it doesn't: its own isEnable false ("itself"), or a disabled action above it
   * (its short type: "IfElseAction", round 21, the target-statuses report point 3: Arcane's spell_vulnerable CreateBuffAction
   * read as enabled under a disabled IfElseAction). Absent: it runs.
   */
  readonly disabledBy?: string;
}

/** The context an object of a data file gives what sits under it (its buff event, ability event or frame), else the parent's. */
function contextOf(v: Record<string, unknown>, context: string | null): string | null {
  return typeof v["buffEvent"] === "number"
    ? `buffEvent ${v["buffEvent"]}${ENUMS["buffEvent"]?.[v["buffEvent"]] ? ` (${ENUMS["buffEvent"][v["buffEvent"]]})` : ""}`
    : typeof v["abilityEvent"] === "number"
      ? `abilityEvent ${v["abilityEvent"]}${ENUMS["abilityEvent"]?.[v["abilityEvent"]] ? ` (${ENUMS["abilityEvent"][v["abilityEvent"]]})` : ""}`
      : typeof v["_startFrame"] === "number"
        ? `frame ${v["_startFrame"]}`
        : context;
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
      // `off`: the disabled action above (its short type), which switches off everything under it.
      const visit = (v: unknown, path: string, context: string | null, off: string | null) => {
        if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${path}[${i}]`, context, off));
        if (!isObj(v)) return;
        const c = contextOf(v, context);
        const t = typeof v["$type"] === "string" ? shortType(v["$type"]) : null;
        const disabledBy = off ?? (t && v["isEnable"] === false ? "itself" : null);
        if (t && type.test(t) && !(opts.enabled && disabledBy)) out.push({ folder: f, file, path, fields: ownFields(v), context: c, ...(disabledBy ? { disabledBy } : {}) });
        const below = off ?? (t && v["isEnable"] === false ? t : null);
        for (const [k, x] of Object.entries(v)) visit(x, `${path}.${k}`, c, below);
      };
      visit(parseJsonExact(readFileSync(join(dir, name), "utf8")), "", null, null);
    }
  }
  return out;
}

/** The BuffData and SkillData files whose name contains `part` (an enemy's short name: `slwood`), as folder/file. */
export function filesNamed(part: string): string[] {
  return (["BuffData", "SkillData"] as const).flatMap((f) =>
    readdirSync(folder(f))
      .filter((n) => n.endsWith(".json") && n.includes(part))
      .sort()
      .map((n) => `${f}/${n.replace(/\.json$/, "")}`),
  );
}

/** An action's own scalar and value fields (selectors and nested actions left out), as the tree shows them. */
function ownFields(v: Record<string, unknown>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === "$type" || SKIP_KEY.test(k)) continue;
    if (isObj(x)) {
      const val = valueField(x);
      if (val !== null) fields[k] = val;
    } else if (!Array.isArray(x)) fields[k] = scalar(k, x);
  }
  return fields;
}

/**
 * What `gamedata tree` prints for an id with no BuffData or SkillData file of its own (round 19, the Camille report
 * point 5: `tree abilityentity_chr_0033_camille_normal_skill` said only "no file"): an ability entity's definition
 * (life, duration, passives) isn't in the export, so the actions that name it (SpawnAbilityEntity: its skill, the
 * blackboard it's handed, its duration key), with their own fields, and the skill each spawn runs (its file, and how
 * many files name that skill) say what it does.
 */
export function noFileView(id: string): string {
  const entity = id.startsWith("abilityentity_");
  const head = `${id}: no BuffData or SkillData file of that name${entity ? " (an ability entity: its own definition, life, duration and passives, isn't in the export; the actions that spawn it and the skill it runs say what it does)" : ""}`;
  const ms = whoMentions(id);
  if (!ms.length) return `${head}; no file names it either (in ${join(sourceDir("rmxlinux"), "Json")})`;
  const files = new Map<string, unknown>();
  const lines: string[] = [];
  const skills = new Set<string>();
  for (const m of ms) {
    const key = `${m.folder}/${m.file}`;
    if (!files.has(key)) files.set(key, parseJsonExact(readFileSync(join(folder(m.folder), `${m.file}.json`), "utf8")));
    const parent = m.path.replace(/(\.[^.[\]]+|\[\d+\])$/, "");
    const action = atJsonPath(files.get(key), parent);
    const fields = isObj(action) ? ownFields(action) : {};
    if (isObj(action) && typeof action["abilityEntitySkillId"] === "string" && action["abilityEntitySkillId"]) skills.add(action["abilityEntitySkillId"]);
    lines.push(`  ${key}  ${m.action ?? "-"}${m.context ? `  [${m.context}]` : ""}  ${Object.values(fields).join(", ")}  ${parent}`);
  }
  const skillLines = [...skills].map((s) => {
    const own = ["BuffData", "SkillData"].some((f) => existsSync(join(folder(f as DataFolder), `${s}.json`)));
    const named = new Set(whoMentions(s).map((x) => `${x.folder}/${x.file}`));
    return `  its skill ${s}: ${own ? `a file of its own (gamedata tree ${s})` : "no file of its own"}; named in ${named.size} file(s)${named.size ? ` (gamedata who ${s})` : ""}`;
  });
  return [`${head}. Named in ${files.size} file(s), ${ms.length} place(s), each action with its own fields:`, ...lines, ...skillLines].join("\n");
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
    // Switched off by a parent (its own isEnable false shows among its fields).
    const off = x.disabledBy && x.disabledBy !== "itself" ? `  DISABLED (by a disabled ${x.disabledBy} above it)` : "";
    return `  ${x.folder}/${x.file}${x.context ? `  [${x.context}]` : ""}${off}  ${fs.map(([, v]) => v).join(", ")}  ${x.path}`;
  });
  return [`${found.length} action(s) in ${new Set(found.map((x) => x.file)).size} file(s):`, ...lines].join("\n");
}

/** One handler of an event in a data file (eventHandlers): where, and the action types under it that run and that don't. */
export interface EventHandler {
  readonly folder: DataFolder;
  readonly file: string;
  readonly path: string;
  /** The short types of the actions under it that run, and of those switched off (themselves or by a parent), with counts. */
  readonly enabled: ReadonlyMap<string, number>;
  readonly disabled: ReadonlyMap<string, number>;
}

/**
 * `efsim gamedata handlers <abilityEvent|buffEvent> <n>`: every object of the BuffData / SkillData files whose
 * `abilityEvent` (or `buffEvent`) is n, with the action types under it that run and those switched off (round 21, the
 * target-statuses report point 3: the listeners on a target's death, abilityEvent 1, took 21 `find` runs, one per action
 * type, and read a disabled handler as live).
 */
export function eventHandlers(kind: "abilityEvent" | "buffEvent", n: number, opts: { readonly file?: string; readonly folder?: DataFolder } = {}): EventHandler[] {
  const fileRe = opts.file ? new RegExp(opts.file) : null;
  const out: EventHandler[] = [];
  for (const f of opts.folder ? [opts.folder] : (["BuffData", "SkillData"] as const)) {
    const dir = folder(f);
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".json") || (fileRe && !fileRe.test(name))) continue;
      const file = name.replace(/\.json$/, "");
      const actions = (v: unknown, off: boolean, en: Map<string, number>, dis: Map<string, number>) => {
        if (Array.isArray(v)) return v.forEach((x) => actions(x, off, en, dis));
        if (!isObj(v)) return;
        const t = typeof v["$type"] === "string" ? shortType(v["$type"]) : null;
        const isOff = off || (t !== null && v["isEnable"] === false);
        if (t) (isOff ? dis : en).set(t, ((isOff ? dis : en).get(t) ?? 0) + 1);
        for (const x of Object.values(v)) actions(x, isOff, en, dis);
      };
      const visit = (v: unknown, path: string) => {
        if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${path}[${i}]`));
        if (!isObj(v)) return;
        if (v[kind] === n) {
          const [en, dis] = [new Map<string, number>(), new Map<string, number>()];
          for (const [k, x] of Object.entries(v)) if (k !== kind) actions(x, v["isEnable"] === false, en, dis);
          out.push({ folder: f, file, path, enabled: en, disabled: dis });
          return;
        }
        for (const [k, x] of Object.entries(v)) visit(x, `${path}.${k}`);
      };
      visit(parseJsonExact(readFileSync(join(dir, name), "utf8")), "");
    }
  }
  return out;
}

/** eventHandlers as lines: per handler its enabled action types (×count), its switched-off ones, "all disabled" where nothing runs. */
export function formatHandlers(kind: string, n: number, hs: readonly EventHandler[]): string {
  const name = ENUMS[kind]?.[n];
  const words = (m: ReadonlyMap<string, number>) => [...m].map(([t, c]) => (c > 1 ? `${t} ×${c}` : t)).join(", ");
  const dead = hs.filter((h) => h.enabled.size === 0 && h.disabled.size > 0).length;
  const lines = hs.map((h) => `  ${h.folder}/${h.file}  ${h.enabled.size ? `runs: ${words(h.enabled)}` : h.disabled.size ? "ALL DISABLED" : "no actions"}${h.disabled.size ? `; switched off: ${words(h.disabled)}` : ""}  ${h.path}`);
  return [`${hs.length} handler(s) of ${kind} ${n}${name ? ` (${name})` : ""} in ${new Set(hs.map((h) => h.file)).size} file(s)${dead ? `, ${dead} with nothing that runs` : ""}:`, ...lines].join("\n");
}
