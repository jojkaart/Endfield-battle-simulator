// Shared report helpers: stat lines as the game shows them (engine labels.ts statLabel / attrLabel) and which code
// made a report (cli provenance.ts).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { Attr, attrLabel, Slot, statLabel, Target } from "@efsim/engine";
import { gearProbes } from "../packages/cli/src/diagnose.ts";
import { codeProvenance } from "../packages/cli/src/provenance.ts";

describe("stat labels", () => {
  it("names attributes in the game's words", () => {
    expect(attrLabel(Attr.Wisd)).toBe("Intellect");
    expect(attrLabel(Attr.UltimateSpGainScalar)).toBe("Ultimate Gain Efficiency");
    expect(attrLabel(Attr.PhysicalAndSpellInflictionEnhance)).toBe("Arts Intensity");
  });

  it("shows a line's target and size with its unit", () => {
    expect(statLabel(0, 5, Target.MainAttribute, 32)).toBe("main attribute +32");
    expect(statLabel(0, 6, Target.SecondaryAttribute, 0.1)).toBe("secondary attribute +10.0%");
    expect(statLabel(Attr.PhysicalAndSpellInflictionEnhance, Slot.Add, Target.AsWritten, 20)).toBe("Arts Intensity +20");
    expect(statLabel(Attr.CriticalRate, Slot.Add, Target.AsWritten, 0.05)).toBe("Crit Rate +5.0%");
    expect(statLabel(Attr.Wisd, Slot.Add, Target.AsWritten, 41)).toBe("Intellect +41");
  });

  it("gives the diagnosis' gear probes their labels", () => {
    for (const p of gearProbes(loadGameData()).filter((x) => !x.reference)) expect(statLabel(p.attr, p.slot, p.target, p.value)).toBe(p.label);
  });
});

describe("code provenance", () => {
  it("names the commit, and says when the tracked tree has changes", () => {
    expect(codeProvenance()).toMatch(/^code at [0-9a-f]{7,}( with uncommitted changes)?$/);
    expect(codeProvenance("/")).toBe("code at an unknown commit");
  });
});
