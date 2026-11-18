// `efsim kit <operator>` (packages/cli/src/commands/kit.ts): the compiled kit with each skill's timing and hits' frames.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { landingFrames } from "@efsim/logs";
import { kitView } from "../packages/cli/src/commands/kit.ts";

const data = loadGameData();

describe("efsim kit", () => {
  it("prints an operator's skills by name with their timing and each hit's landing frames", () => {
    const text = kitView(data, "Si", /attack5$/);
    const kit = data.kits.operators["chr_0036_jsspsi"];
    const hit = kit?.skills.find((s) => s.skillId === "chr_0036_jsspsi_attack5")?.hits[0];
    expect(hit).toBeDefined();
    expect(text).toContain("chr_0036_jsspsi_attack5 (basic)");
    expect(text).toMatch(/duration \d+ frames \(\d+\.\d\d s\), uncuttable to frame \d+/);
    expect(text).toContain(`frames ${(landingFrames(hit as NonNullable<typeof hit>) ?? []).join(",")}`);
    expect(text).not.toMatch(/^Buffs:/m);
    expect(kitView(data, "chr_0036_jsspsi")).toMatch(/^Buffs:\n {2}\S+ "/m);
    expect(() => kitView(data, "nobody-at-all")).toThrow(/no such operator/);
  });
});
