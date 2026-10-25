// Every enabled node type in the fetched SkillData and BuffData files is listed in src/skillTypes.ts: interpreted
// by the data layer, a condition the compiler leaves undecided, or walked without being interpreted (with why).
// A game patch that adds a type fails here, so a new action can't slip through the compiler's generic walk.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listedNodeTypes, nodeTypeName, parseJsonExact, sourceDir } from "../src/index.ts";

/** Each enabled node type under a node, with one file it's in. */
function types(node: unknown, file: string, out: Map<string, string>): void {
  if (Array.isArray(node)) {
    for (const n of node) types(n, file, out);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const o = node as Record<string, unknown>;
  if (typeof o["$type"] === "string" && o["isEnable"] !== false) {
    const t = nodeTypeName(o["$type"]);
    if (!out.has(t)) out.set(t, file);
  }
  for (const v of Object.values(o)) types(v, file, out);
}

describe("SkillData and BuffData node types", () => {
  const found = new Map<string, string>();
  for (const dir of ["SkillData", "BuffData"]) {
    const path = join(sourceDir("rmxlinux"), "Json", dir);
    for (const f of readdirSync(path).filter((x) => x.endsWith(".json"))) types(parseJsonExact(readFileSync(join(path, f), "utf8")), `${dir}/${f}`, found);
  }
  const listed = listedNodeTypes();

  it("are each listed in skillTypes.ts", () => {
    expect([...found].filter(([t]) => !listed.has(t)).map(([t, f]) => `${t} (e.g. ${f})`), "types to list in packages/data/src/skillTypes.ts (interpreted, an undecided condition, or uninterpreted with why)").toEqual([]);
  });

  it("are all in the data (no stale entries)", () => {
    expect([...listed.keys()].filter((t) => !found.has(t))).toEqual([]);
  });
});
