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
 * Fields the loader fills in from the compiled SkillData where a kit leaves
 * them out (kits.ts withDataFacts; docs/design.md, "Kits and the game
 * data"). One a kit still writes is one the data can't say alone (its
 * landings aren't one path of the hit's own) or a marked difference;
 * `efsim kit-trim` removes the rest.
 */
export const DATA_DERIVABLE: ReadonlySet<string> = new Set([
  "hit.frames",
  "hit.count",
  "hit.events",
  "hit.factor",
  "hit.element",
  "hit.poise",
  "hit.poiseControlledOnly",
  "hit.detached",
  "hit.energy",
  "hit.sp",
  "hit.spBeforeDamage",
  "skill.teamEnergy",
  "skill.energyBlockSeconds",
]);

/**
 * Fields kits still write by hand that the loader compares with the
 * compiled data (a difference is an error unless marked) but doesn't fill
 * in yet: the review's next target.
 */
export const DATA_COMPARED: ReadonlySet<string> = new Set(["hit.launch", "hit.finalStrike", "applies.infliction", "applies.forcedReaction", "applies.consumeInfliction", "applies.physicalStatus", "applies.vulnerable"]);

type Json = Record<string, unknown>;

/** Feature → count of uses, per operator. */
export function kitCensus(dir: string = KITS): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const kit = JSON.parse(readFileSync(join(dir, file), "utf8")) as Json;
    const c = new Map<string, number>();
    const add = (k: string, n = 1) => c.set(k, (c.get(k) ?? 0) + n);
    for (const key of ["stacks", "buffs", "triggers"]) {
      const v = kit[key];
      if (Array.isArray(v) && v.length) add(`kit.${key}`, v.length);
    }
    for (const t of (kit["triggers"] as Json[] | undefined) ?? []) {
      add(`trigger.on.${String((t["on"] as Json)["event"])}`);
      for (const a of (t["do"] as Json[] | undefined) ?? []) add(`trigger.do.${String(a["kind"])}`);
      for (const key of ["if", "cooldown", "maxCount", "skill"]) if (t[key] !== undefined) add(`trigger.${key}`);
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
  const rows = features.map((f) => [`${f}${DATA_DERIVABLE.has(f) ? " *" : DATA_COMPARED.has(f) ? " +" : ""}`, ...ops.map((op) => String(census.get(op)?.get(f) ?? ""))]);
  const usedOnce = features.filter((f) => ops.filter((op) => census.get(op)?.has(f)).length === 1);
  return [
    table(["feature", ...ops.map(short)], rows, ["l", ...ops.map(() => "r" as const)]),
    "",
    "* the loader takes it from the data where a kit leaves it out: a written one is where the data's landings can't say it alone, or a marked difference (efsim kit-trim removes the rest).",
    "+ hand-written, compared with the data as the kit loads (differences marked in dataOverride): the next to take from the data.",
    `Used by one kit only (check it isn't a one-off for a shared mechanism): ${usedOnce.join(", ") || "none"}`,
  ].join("\n");
}
