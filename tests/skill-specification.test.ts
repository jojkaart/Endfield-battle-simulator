// Every kit skill's compiled skillSpecification against its kit kind (round 23, the break-combo report point 1:
// Akekuri's ultimate carried 0 in its file, so the engine gave it a plain skill's interrupt priority and no ultimate
// stop; an hour of tracing two INSIDE lines found it). The compiler reads an ultimate's 0 as 5 (packages/data
// skillData.ts); any other disagreement is listed here with why, or fails.
import { describe, expect, it } from "vitest";
import { loadGameData, loadKits } from "@efsim/data";

/** The specifications each kit kind may carry: a basic attack 1, a plunge 6 or a finisher 8; the others their own. */
const KIND_SPECS: Readonly<Record<string, readonly number[]>> = { basic: [1, 6, 8], battle: [3], combo: [4], ultimate: [5] };

/** Kit skills whose specification isn't their kind's, and why that is right. */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  chr_0030_zhuangfy_ultimate_skill_end: "the Empyrean's end: a kit basic (its input) whose file is the ultimate's (5): its end stops time as an ultimate",
};

describe("skillSpecification against the kit kind", () => {
  it("agrees for every operator's kit skill, but the listed exceptions", () => {
    const data = loadGameData();
    const kits = loadKits(data);
    const off: string[] = [];
    for (const kit of Object.values(kits.operators)) {
      for (const s of kit.skills) {
        const spec = data.skills[s.skillId]?.timing?.specification;
        if (spec === undefined || (KIND_SPECS[s.kind] ?? []).includes(spec) || s.skillId in EXCEPTIONS) continue;
        off.push(`${s.skillId} (${s.kind}): skillSpecification ${spec}`);
      }
    }
    expect(off, "a kit skill whose specification isn't its kind's (timeline/rules.ts priorityOf reads it): fix the kit or the compiler, or list it in EXCEPTIONS with why").toEqual([]);
  });

  it("lists only exceptions that still disagree", () => {
    const data = loadGameData();
    const kits = loadKits(data);
    const kinds = new Map(Object.values(kits.operators).flatMap((k) => k.skills.map((s) => [s.skillId, s.kind] as const)));
    for (const id of Object.keys(EXCEPTIONS)) {
      const spec = data.skills[id]?.timing?.specification;
      expect(spec !== undefined && !(KIND_SPECS[kinds.get(id) ?? ""] ?? []).includes(spec), id).toBe(true);
    }
  });
});
