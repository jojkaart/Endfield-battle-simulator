import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { calc, compare, find, readBuild, template, type CalcOptions } from "../src/index.ts";
import { boundarySubsets, logModifiers, teamStackCaps } from "../src/logcheck.ts";
import type { StatPanel } from "@efsim/engine";
import { formatCensus, kitCensus } from "../src/census.ts";

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
    // Forgeborn's after-ultimate buff is a triggered kit buff now (no condition): --buff counts it.
    const buffed = calc(data, forgeborn, { ...options, buffs: [{ buff: "wpn_sword_0006.valid", layers: 1 }] });
    expect(buffed).toMatch(/Enhanced basic attack 1 \(Twilight\) .* 20,304/);
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

describe("log check: boundary buffs", () => {
  const e = (buff: string, zone: "atk" | "damageBonus") => ({ buff, zone, element: null, value: 0.1 });
  it("tries every subset of the buffs at the hit's instant, keeping each buff's effects together", () => {
    const subsets = boundarySubsets([e("a", "atk"), e("a", "damageBonus"), e("b", "atk")]);
    expect(subsets.map((s) => s.effects.map((x) => x.buff).join(""))).toEqual(["", "aa", "b", "aab"]);
    expect(subsets.map((s) => s.label)).toEqual([null, "boundary buffs applied: a", "boundary buffs applied: b", "boundary buffs applied"]);
  });
  it("falls back to none or all above six buffs", () => {
    expect(boundarySubsets(["a", "b", "c", "d", "e", "f"].map((b) => e(b, "atk")))).toHaveLength(64);
    expect(boundarySubsets(["a", "b", "c", "d", "e", "f", "g"].map((b) => e(b, "atk")))).toHaveLength(2);
  });
  it("also counts a buff listed twice with the same effects once (an instance ending as its refresh starts)", () => {
    const subsets = boundarySubsets([e("a", "atk"), e("a", "atk")]);
    expect(subsets.map((s) => [s.effects.length, s.label])).toEqual([
      [0, null],
      [2, "boundary buffs applied"],
      [1, "boundary buffs applied (refreshed instances once)"],
    ]);
  });
});

describe("calc with a count-dependent hit", () => {
  it("shows Si's combo final hit at one consumed stack (+1 at P5)", () => {
    const text = calc(data, readBuild(join(ROOT, "examples/si-jade-vessel.json")), options);
    expect(text).toMatch(/Combo final hit\s+value 6\.325/);
    expect(text).toContain("shown at a count of 1");
  });
});

describe("kit census", () => {
  it("counts each kit's hand-written features, flagging what the data has", () => {
    const census = kitCensus();
    expect(census.get("chr_0016_laevat")?.get("kit.stacks")).toBe(1);
    expect(census.get("chr_0013_aglina")?.get("applies.infliction")).toBeGreaterThan(0);
    expect(formatCensus(census)).toMatch(/hit\.frames \*/);
  });
});

describe("log check: stack caps the applying skill sets", () => {
  it("finds the cap in the team's sources and counts at most that many instances", () => {
    const panel = { sources: { passive_equipsuit_spellburst01: { max_stack: 3 } } } as unknown as StatPanel;
    const caps = teamStackCaps([panel]);
    expect(caps("buff_equipsuit_spellburst_01_physpellup", "max_stack")).toBe(3);
    expect(caps("buff_wpn_lance_0014_damageup", "max_stack")).toBeNull();
    const e = { buff: "buff_equipsuit_spellburst_01_physpellup", zone: "artsIntensity", element: null, value: 16 };
    const four = [e, e, e, e] as unknown as Parameters<typeof logModifiers>[0];
    expect(logModifiers(four, null, caps).length).toBe(3);
    expect(logModifiers(four).length).toBe(4);
  });
});
