// `efsim gamedata tree / who` (packages/cli/src/gamedata.ts): the compact tree of a raw data file and the reverse
// index of who names a buff.
import { describe, expect, it } from "vitest";
import { dataTree, findActions, formatFound, gamedataTree, renderTree, shortType, whoMentions } from "../packages/cli/src/gamedata.ts";

describe("the data-file tree", () => {
  const file = {
    id: "buff_x",
    lifeType: 0,
    duration: { useBlackboardKey: true, blackboardKey: "duration", value: 3 },
    iconConfig: { _spritePath: "icon" },
    buffEventAction: [
      {
        buffEvent: 0,
        actions: [{ actionData: [
          { $type: "Beyond.Gameplay.Core.CreateBuffAction+Data, Gameplay.Beyond", buffs: [{ buffId: "buff_y" }], count: { useBlackboardKey: false, blackboardKey: {}, value: 1 } },
          { $type: "Beyond.Gameplay.Core.PlaySoundAction+Data, Gameplay.Beyond", sound: "x" },
          { $type: "Beyond.Gameplay.Core.CompareFloat+Data, Gameplay.Beyond", compare: 3, lhs: 1, isEnable: false },
        ] }],
      },
    ],
  };

  it("names types and enums, reads value fields, leaves out presentation and defaults", () => {
    expect(shortType("Beyond.Gameplay.Core.SpeedupAction+Data, Gameplay.Beyond")).toBe("SpeedupAction");
    const text = renderTree(dataTree(file, "buff_x"));
    expect(text).toContain("duration: key duration (default 3)");
    expect(text).toContain("lifeType 0 (timed)");
    expect(text).toContain("buffEvent 0 (on start)");
    expect(text).toContain("CreateBuffAction  count: 1");
    expect(text).toContain("buffId buff_y");
    expect(text).toContain("CompareFloat  compare 3 (>=), lhs 1");
    expect(text).not.toMatch(/PlaySound|iconConfig|isEnable false/);
  });

  it("keeps only matching lines and their ancestors with --grep", () => {
    const text = renderTree(dataTree(file, "buff_x"), { grep: /buff_y/ });
    expect(text.split("\n").at(-1)).toContain("buffId buff_y");
    expect(text).not.toContain("CompareFloat");
  });
});

describe("the game's files", () => {
  it("finds who creates Si's Haste (the two ink buffs) and prints its tree", () => {
    const ms = whoMentions("buff_chr_0036_jsspsi_talent1_speedup");
    expect(new Set(ms.map((m) => m.file))).toEqual(new Set(["buff_chr_0036_jsspsi_xianjing_inkboom", "buff_chr_0036_jsspsi_xianjing_linkline"]));
    expect(ms.every((m) => m.action === "CreateBuffAction")).toBe(true);
    expect(gamedataTree("buff_chr_0036_jsspsi_talent1_speedup")).toContain("SpeedupAction");
  });
});

describe("finding actions by type", () => {
  it("lists every action of a type with its fields and context, or counts a field's values", () => {
    const found = findActions({ type: "Speedup", file: "jsspsi" });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((x) => x.file.includes("jsspsi") && x.path.length > 0)).toBe(true);
    expect(formatFound(found)).toMatch(/^\d+ action\(s\) in \d+ file\(s\):\n {2}BuffData\/buff_chr_0036_jsspsi/);
    expect(formatFound(found, { count: "isEnable" })).toMatch(/by isEnable:/);
    expect(gamedataTree("buff_chr_0032_lizhiyan_combo_skill_seal")).toContain("abilityEvent 8 (owner defeated?)");
  });
});
