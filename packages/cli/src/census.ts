// efsim kit-census: which kit features each operator kit uses, read from the
// kit files as written (not as loaded), for the pattern review that follows
// every new kit (docs/kit-abstractions.md#repeating-the-review).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { table } from "./format.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KITS = join(ROOT, "packages/data/kits/operators");

/**
 * Fields kits write by hand that the game data has (docs/kit-abstractions.md
 * section 1): the review's target is to compile these instead.
 */
export const DATA_DERIVABLE: ReadonlySet<string> = new Set([
  "hit.frames",
  "skill.durationFrames",
  "hit.energy",
  "skill.energyBlockSeconds",
  "hit.factor",
  "hit.events",
]);

type Json = Record<string, unknown>;

/** Feature → count of uses, per operator. */
export function kitCensus(dir: string = KITS): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const kit = JSON.parse(readFileSync(join(dir, file), "utf8")) as Json;
    const c = new Map<string, number>();
    const add = (k: string, n = 1) => c.set(k, (c.get(k) ?? 0) + n);
    for (const key of ["stacks", "buffs", "comboTriggers", "teamTriggers", "triggers", "conditions"]) {
      const v = kit[key];
      if (Array.isArray(v) && v.length) add(`kit.${key}`, v.length);
    }
    for (const s of (kit["skills"] as Json[] | undefined) ?? []) {
      for (const key of Object.keys(s)) if (!["skillId", "label", "damageType", "hits"].includes(key)) add(`skill.${key}`);
      for (const h of (s["hits"] as Json[] | undefined) ?? []) {
        for (const [key, v] of Object.entries(h)) {
          if (["id", "label", "scale"].includes(key)) continue;
          if (key === "applies" && Array.isArray(v)) for (const a of v as Json[]) add(`applies.${String(a["kind"])}`);
          else add(`hit.${key}`);
        }
      }
    }
    out.set(String(kit["operator"]), c);
  }
  return out;
}

export function formatCensus(census: Map<string, Map<string, number>>): string {
  const ops = [...census.keys()];
  const features = [...new Set([...census.values()].flatMap((c) => [...c.keys()]))].sort();
  const short = (op: string) => op.replace(/^chr_\d+_/, "");
  const rows = features.map((f) => [`${f}${DATA_DERIVABLE.has(f) ? " *" : ""}`, ...ops.map((op) => String(census.get(op)?.get(f) ?? ""))]);
  const usedOnce = features.filter((f) => ops.filter((op) => census.get(op)?.has(f)).length === 1);
  return [
    table(["feature", ...ops.map(short)], rows, ["l", ...ops.map(() => "r" as const)]),
    "",
    "* hand-written although the game data has it (docs/kit-abstractions.md section 1): compile it instead.",
    `Used by one kit only (check it isn't a one-off for a shared mechanism): ${usedOnce.join(", ") || "none"}`,
  ].join("\n");
}
