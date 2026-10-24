// efsim kit-trim: removes from the operator kit files the hand-written values
// the loader would fill in from the compiled SkillData anyway (kitMatch.ts,
// kits.ts withDataFacts): a value goes only when the kit loads exactly as
// before without it (every operator the file holds, compared as canonical
// JSON), so nothing the engine gets changes. The files keep their formatting
// (jsonEdit.ts). Run it after writing or changing a kit.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOperatorKitFile, type KitData } from "@efsim/data";
import { applyEdits, canonicalJson, parseSpans, prop, removePropertyEdit, type JsonNode } from "./jsonEdit.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KITS = join(ROOT, "packages/data/kits/operators");

/** Hit fields the loader can fill in, in the order they're tried (frames first: with them gone, the data's landings decide the rest). */
export const TRIMMED_HIT_FIELDS = ["frames", "count", "events", "factor", "element", "poise", "poiseControlledOnly", "detached", "energy"] as const;
/** Skill fields the loader can fill in. */
export const TRIMMED_SKILL_FIELDS = ["teamEnergy", "energyBlockSeconds"] as const;

export interface TrimResult {
  readonly file: string;
  /** What went: `skillId/hitId field` or `skillId field`. */
  readonly removed: readonly string[];
  readonly bytesBefore: number;
  readonly bytesAfter: number;
}

type Path = { readonly skill: number; readonly hit?: number; readonly field: string };

function nodeAt(root: JsonNode, p: Omit<Path, "field">): JsonNode {
  const skills = prop(root, "skills");
  const skill = skills?.kind === "array" ? skills.items[p.skill] : undefined;
  if (!skill) throw new Error(`no skill ${p.skill}`);
  if (p.hit === undefined) return skill;
  const hits = prop(skill, "hits");
  const hit = hits?.kind === "array" ? hits.items[p.hit] : undefined;
  if (!hit) throw new Error(`no hit ${p.hit} in skill ${p.skill}`);
  return hit;
}

/** The text without the given fields (removed one at a time, the text parsed again after each). */
function without(text: string, paths: readonly Path[]): string {
  let out = text;
  for (const p of paths) out = applyEdits(out, [removePropertyEdit(nodeAt(parseSpans(out), p), p.field)]);
  return out;
}

/** Trims one kit file's text; the loaded kits it gives must stay as they are. */
export function trimKitText(data: KitData, file: string, text: string): { text: string; removed: string[] } {
  const load = (t: string) => canonicalJson(loadOperatorKitFile(data, file, JSON.parse(t)));
  const want = load(text);
  const raw = JSON.parse(text) as { skills: { skillId: string; hits: Record<string, unknown>[] }[] & Record<string, unknown>[] };
  let kept = text;
  const removed: string[] = [];
  const tryRemove = (paths: Path[]): boolean => {
    if (!paths.length) return false;
    let next: string;
    try {
      next = without(kept, paths);
      if (load(next) !== want) return false;
    } catch {
      // Without it the kit doesn't load (e.g. the data's landings for the hit aren't unique): it stays.
      return false;
    }
    kept = next;
    return true;
  };
  raw.skills.forEach((s, si) => {
    const skill = s as unknown as Record<string, unknown>;
    for (const field of TRIMMED_SKILL_FIELDS) if (skill[field] !== undefined && tryRemove([{ skill: si, field }])) removed.push(`${s.skillId} ${field}`);
    s.hits.forEach((h, hi) => {
      const fields = TRIMMED_HIT_FIELDS.filter((f) => h[f] !== undefined);
      // All at once first (the usual case), else one by one.
      if (tryRemove(fields.map((field) => ({ skill: si, hit: hi, field })))) {
        removed.push(...fields.map((f) => `${s.skillId}/${String(h["id"])} ${f}`));
        return;
      }
      for (const field of fields) if (tryRemove([{ skill: si, hit: hi, field }])) removed.push(`${s.skillId}/${String(h["id"])} ${field}`);
    });
  });
  return { text: kept, removed };
}

/** Trims every operator kit under `dir`; with `write`, saves the files. */
export function kitTrim(data: KitData, write: boolean, dir: string = KITS): TrimResult[] {
  const out: TrimResult[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const path = join(dir, file);
    const text = readFileSync(path, "utf8");
    const r = trimKitText(data, file, text);
    if (write && r.text !== text) writeFileSync(path, r.text);
    out.push({ file, removed: r.removed, bytesBefore: Buffer.byteLength(text), bytesAfter: Buffer.byteLength(r.text) });
  }
  return out;
}

export function formatTrim(results: readonly TrimResult[], written: boolean): string {
  const lines = results.filter((r) => r.removed.length).map((r) => `${r.file}: ${r.removed.length} value(s), ${r.bytesBefore - r.bytesAfter} bytes`);
  const byField = new Map<string, number>();
  for (const r of results) for (const x of r.removed) byField.set(x.split(" ").pop() as string, (byField.get(x.split(" ").pop() as string) ?? 0) + 1);
  const total = results.reduce((n, r) => n + r.removed.length, 0);
  const bytes = results.reduce((n, r) => n + r.bytesBefore - r.bytesAfter, 0);
  return [
    ...lines,
    `${total} value(s) the data gives anyway, ${bytes} bytes (${[...byField].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(", ") || "none"})${written ? ": removed" : "; --write removes them"}`,
  ].join("\n");
}
