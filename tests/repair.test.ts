// `efsim repair` (packages/cli/src/commands/repair.ts) and gear.ts repairRotation: a timeline that stops playing after
// a timing change, fixed by moving or dropping the steps that can't start, the file rewritten with only its rotation
// changed.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { EngineError, simulate } from "@efsim/engine";
import { readScenario } from "@efsim/cli";
import { repairScenario, withRotation } from "../packages/cli/src/commands/repair.ts";
import { repairRotation } from "../packages/cli/src/gear.ts";
import { ROOT } from "./logverdicts.ts";

const data = loadGameData();
const example = join(ROOT, "examples/akekuri-laevatain.scenario.json");

describe("efsim repair", () => {
  it("leaves a timeline that plays as it is", () => {
    expect(repairScenario(data, example)).toMatch(/plays as it is/);
  });

  it("moves or drops a step that can't start, and writes the file with only its rotation changed", () => {
    const dir = mkdtempSync(join(tmpdir(), "efsim-repair-"));
    const text = readFileSync(example, "utf8");
    type Doc = { rotation: { operator: string; skill: string; at?: number }[] } & Record<string, unknown>;
    // A second ultimate right after the first: no energy for it there.
    const broken = text.replace(/("rotation": \[\n(\s*)\{[^\n]*\},)/, `$1\n$2{ "operator": "chr_0019_karin", "skill": "chr_0019_karin_ultimate_skill", "at": 1 },`);
    expect(broken).not.toBe(text);
    const file = join(dir, "broken.scenario.json");
    // The team files are relative to the scenario: point them at examples/.
    writeFileSync(file, broken.replace(/"([a-z-]+\.json)"/g, (_m, f: string) => JSON.stringify(join(ROOT, "examples", f))));
    expect(() => simulate(data, readScenario(file))).toThrow(EngineError);
    const fixed = repairRotation(data, readScenario(file), { variants: true });
    expect(fixed.moved.length + fixed.dropped.length).toBeGreaterThan(0);
    expect(fixed.over).toBe(false);
    const out = join(dir, "fixed.scenario.json");
    const report = repairScenario(data, file, out);
    expect(report).toMatch(/repaired: \d+ step\(s\) moved, \d+ dropped/);
    expect(report).toMatch(/Wrote .* it plays/);
    const written = JSON.parse(readFileSync(out, "utf8")) as Doc;
    const original = JSON.parse(readFileSync(file, "utf8")) as Doc;
    // Only the rotation changed.
    expect({ ...written, rotation: [] }).toEqual({ ...original, rotation: [] });
    expect(written.rotation).toHaveLength(fixed.rotation.length);
    // The other steps keep their own text.
    expect(readFileSync(out, "utf8")).toContain(`{ "operator": "chr_0016_laevat", "skill": "chr_0016_laevat_normal_skill", "at": 2.5 }`);
    expect(simulate(data, readScenario(out)).total).toBeGreaterThan(0);
    expect(withRotation(readFileSync(file, "utf8"), readScenario(file), fixed)).toBe(readFileSync(out, "utf8"));
  });
});
