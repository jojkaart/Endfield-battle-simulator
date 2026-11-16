// What-if options of the CLI: --kit <file> (withKitFiles: a kit file in place of the operator's own, loaded and
// checked as the loader does) and --duration on simulate and search.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadGameData, withKitFiles } from "@efsim/data";
import { ROOT } from "./logverdicts.ts";

const data = loadGameData();
const dir = mkdtempSync(join(tmpdir(), "efsim-kit-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const kitFile = join(ROOT, "packages/data/kits/operators/chr_0004_pelica.json");
const cli = (...args: string[]) => execFileSync("node", [join(ROOT, "packages/cli/src/main.ts"), ...args], { encoding: "utf8", stdio: "pipe" });
const total = (out: string) => Number(/Total ([\d,]+) damage/.exec(out)?.[1]?.replaceAll(",", ""));

describe("--kit", () => {
  it("replaces one operator's kit by a file of any name, loaded as the loader loads it", () => {
    const copy = join(dir, "perlica-what-if.json");
    writeFileSync(copy, readFileSync(kitFile, "utf8"));
    const d = withKitFiles(data, [copy]);
    expect(d.kits.operators["chr_0004_pelica"]).not.toBe(data.kits.operators["chr_0004_pelica"]);
    expect(d.kits.operators["chr_0004_pelica"]).toEqual(data.kits.operators["chr_0004_pelica"]);
    expect(d.kits.operators["chr_0016_laevat"]).toBe(data.kits.operators["chr_0016_laevat"]);
    expect(withKitFiles(data, [])).toBe(data);
  });

  it("refuses a file that isn't an operator kit, or one the schema rejects", () => {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, '{"skills": []}');
    expect(() => withKitFiles(data, [bad])).toThrow(/not an operator kit/);
    const invalid = join(dir, "invalid.json");
    writeFileSync(invalid, JSON.stringify({ ...JSON.parse(readFileSync(kitFile, "utf8")), notAField: 1 }));
    expect(() => withKitFiles(data, [invalid])).toThrow(/chr_0004_pelica/);
  });

  it("is refused by commands whose worker threads would load the real kits", () => {
    expect(() => cli("diagnose", "a.json", "b.json", "--kit", kitFile)).toThrow(/worker threads/);
  });
});

describe("--duration", () => {
  it("shortens a simulation's fight", () => {
    const scenario = join(ROOT, "examples/perlica-estella.scenario.json");
    const whole = total(cli("simulate", scenario));
    const short = total(cli("simulate", scenario, "--duration", "8"));
    expect(short).toBeGreaterThan(0);
    expect(short).toBeLessThan(whole);
    expect(() => cli("simulate", scenario, "--duration", "0")).toThrow(/--duration must be/);
  });
});
