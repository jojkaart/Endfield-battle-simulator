import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { calc, compare, find, readBuild, template, type CalcOptions } from "../src/index.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const data = loadGameData();
const options: CalcOptions = { target: { enemy: "eny_0051_rodin", level: 90 }, crit: "never", staggered: false, conditions: [], verbose: false };
const forgeborn = readBuild(join(ROOT, "examples/laevatain-forgeborn.json"));

describe("cli commands", () => {
  it("find looks up IDs by name", () => {
    expect(find(data, "laevatain")).toContain("chr_0016_laevat");
    expect(find(data, "forgeborn")).toContain("wpn_sword_0006");
    expect(find(data, "zzzz-nothing")).toContain("Nothing matches");
  });

  it("template writes a valid build", () => {
    const build = JSON.parse(template(data, "chr_0016_laevat", "wpn_sword_0006")) as { weapon: { id: string } };
    expect(build.weapon.id).toBe("wpn_sword_0006");
    expect(() => template(data, "chr_nope")).toThrow(/unknown operator/);
  });

  it("calc shows the in-game verified numbers", () => {
    const text = calc(data, forgeborn, options);
    expect(text).toContain("ATK 5,871");
    expect(text).toMatch(/Basic attack 1 .* 1,952/);
    expect(text).toMatch(/Combo skill .* 26,908/);
    expect(text).toContain("wpn_sword_0006.after_ultimate");
  });

  it("compare of a build with itself shows no difference", () => {
    const text = compare(data, forgeborn, forgeborn, options, ["a", "b"]);
    expect(text).toContain("+0.00%");
    expect(text).not.toMatch(/[+-]\d*[1-9]\d*\.\d\d%/);
  });

  it("rejects invalid build files", () => {
    expect(() => readBuild(join(ROOT, "package.json"))).toThrow(/must have required property/);
  });
});

describe("cli process", () => {
  it("runs calc and exits 0", () => {
    const out = execFileSync("node", [join(ROOT, "packages/cli/src/main.ts"), "calc", join(ROOT, "examples/laevatain-forgeborn.json"), "--crit", "never"], { encoding: "utf8" });
    expect(out).toContain("1,952");
  });

  it("reports errors and exits 1", () => {
    expect(() => execFileSync("node", [join(ROOT, "packages/cli/src/main.ts"), "calc"], { encoding: "utf8", stdio: "pipe" })).toThrow(/calc takes 1 argument/);
  });
});
