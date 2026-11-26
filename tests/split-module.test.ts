// scripts/split-module.ts (round 15, round 14's own report point 1): a module split by top-level statement, its
// importers and citations following each name, checked as a move by AST.
import { describe, expect, it } from "vitest";
import { rewriteCitations, rewriteImporter, splitPlan, statementTexts } from "../scripts/split-module.ts";

const SOURCE = [
  "// The replay.",
  "",
  'import { FPS } from "@efsim/engine";',
  'import type { LogHit } from "./zmdlogs.ts";',
  "",
  "const msOf = (f: number) => (f * 1000) / FPS;",
  "",
  "/** A crit. */",
  "export interface Crit {",
  "  readonly hit: LogHit;",
  "}",
  "",
  "export function shownCrits(hits: readonly LogHit[]): Crit[] {",
  "  return hits.map((hit) => ({ hit, t: msOf(1) }));",
  "}",
  "",
  "export function replay(hits: readonly LogHit[]): number {",
  "  return shownCrits(hits).length;",
  "}",
  "",
].join("\n");

describe("split-module", () => {
  const plan = splitPlan("buffreplay.ts", SOURCE, { "replaycrits.ts": ["Crit", "shownCrits"] });

  it("moves the statements, imports the siblings' names they read, and exports a name another file reads", () => {
    const crits = plan.texts.get("replaycrits.ts") as string;
    const main = plan.texts.get("buffreplay.ts") as string;
    expect(crits).toContain('import { FPS } from "@efsim/engine";');
    expect(crits).toContain('import { msOf } from "./buffreplay.ts";');
    expect(crits).toMatch(/\/\*\* A crit\. \*\/\nexport interface Crit/);
    expect(main).toMatch(/^\/\/ The replay\.\n/);
    expect(main).toContain('import { shownCrits } from "./replaycrits.ts";');
    expect(main).toContain("export const msOf");
    expect(plan.exportsAdded).toEqual(["msOf"]);
    // A move: the same statements, export aside.
    expect(statementTexts(plan.texts)).toEqual(statementTexts([["buffreplay.ts", SOURCE]]));
    expect(() => splitPlan("buffreplay.ts", SOURCE, { "x.ts": ["nothing"] })).toThrow(/declares no top-level nothing/);
  });

  it("rewrites an importer by where each name went, and an index's export * gains the new file", () => {
    const importer = 'import { replay, shownCrits, type Crit } from "./buffreplay.ts";\nimport type { Crit as C } from "../src/buffreplay.ts";\n';
    expect(rewriteImporter("/r/src/views.ts", importer, "/r/src/buffreplay.ts", plan.home, ["replaycrits.ts"])).toBe(
      'import { replay } from "./buffreplay.ts";\nimport { shownCrits, type Crit } from "./replaycrits.ts";\nimport type { Crit as C } from "./replaycrits.ts";\n',
    );
    expect(rewriteImporter("/r/src/index.ts", 'export * from "./buffreplay.ts";\n', "/r/src/buffreplay.ts", plan.home, ["replaycrits.ts"])).toBe('export * from "./buffreplay.ts";\nexport * from "./replaycrits.ts";\n');
    expect(rewriteImporter("/r/src/other.ts", 'import { replay } from "./buffreplay.ts";\n', "/r/src/buffreplay.ts", plan.home, ["replaycrits.ts"])).toBe('import { replay } from "./buffreplay.ts";\n');
  });

  it("rewrites the citations of a moved name", () => {
    expect(rewriteCitations("buffreplay.ts shownCrits and buffreplay.ts `Crit`, buffreplay.ts replay", "buffreplay.ts", plan.home)).toBe("replaycrits.ts shownCrits and replaycrits.ts `Crit`, buffreplay.ts replay");
  });
});
