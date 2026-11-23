// `efsim kit <operator>` (packages/cli/src/commands/kit.ts): the compiled kit with each skill's timing and hits' frames.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { landingFrames } from "@efsim/logs";
import { kitView } from "../packages/cli/src/commands/kit.ts";
import { assumptionsList } from "../packages/cli/src/commands/assumptions.ts";

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

describe("efsim kit: skill groups and applications", () => {
  it("marks an enhanced basic attack by its skill group and lists each hit's applications", () => {
    const text = kitView(data, "Laevatain", /ult_attack[13]$/);
    expect(text).toContain("chr_0016_laevat_ult_attack1 (basic; skill group ultimate: an enhanced basic attack)");
    expect(text).toMatch(/applies infliction fire/);
  });
});

describe("efsim kit: what the compiler made of each time dilation", () => {
  it("shows Arcane's combo reset, its priority, and the layer-1 dilation it drops", () => {
    const text = kitView(data, "Arcane", /_combo_skill$/);
    expect(text).toMatch(/time dilations: .*frame 9 dilation layer 0 \(RESETto1\) priority -?\d+: reset/);
    expect(text).toMatch(/layer 1 \(own curve\) priority -?\d+: dropped: layer 1/);
  });
});

describe("efsim assumptions", () => {
  it("lists every open assumption with its readings and default, filtered by a regex", () => {
    const all = assumptionsList(data);
    expect(all).toMatch(/^\d+ open assumption\(s\)/);
    expect(all).toMatch(/^control-immunity {2}\(the engine \(timeline\/assumptions\.ts\); waits on \d+\)$/m);
    expect(all).toMatch(/^ {2}\* \S+: /m);
    const one = assumptionsList(data, /^buff-in-stop$/);
    expect(one).toMatch(/^1 open assumption/);
  });
});
