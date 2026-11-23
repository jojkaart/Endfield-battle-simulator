// @efsim/data operatorId: display names to ids for scripts (round 6: a check ran on Gilberta's id meant for Arcane's).
import { describe, expect, it } from "vitest";
import { loadGameData, operatorId } from "@efsim/data";
import { devFixtures } from "@efsim/logs";

const data = loadGameData();

describe("operatorId", () => {
  it("takes an id, a display name in any case, or a unique part", () => {
    expect(operatorId(data, "chr_0032_lizhiyan")).toBe("chr_0032_lizhiyan");
    expect(operatorId(data, "Arcane")).toBe("chr_0032_lizhiyan");
    expect(operatorId(data, "gilberta")).toBe("chr_0013_aglina");
    expect(operatorId(data, "lizhiyan")).toBe("chr_0032_lizhiyan");
  });

  it("refuses an unknown or ambiguous name, naming the candidates", () => {
    expect(() => operatorId(data, "nobody-called-this")).toThrow(/no operator/);
    expect(() => operatorId(data, "Endministrator")).toThrow(/names 2 operators: .*chr_0002_endminm/);
  });

  it("lets devFixtures take names", () => {
    const byName = devFixtures({ ids: ["0eef", "4e5e"], withOperators: ["Arcane"] }).map((d) => d.id);
    const byId = devFixtures({ ids: ["0eef", "4e5e"], withOperators: ["chr_0032_lizhiyan"] }).map((d) => d.id);
    expect(byName).toEqual(byId);
  });
});
