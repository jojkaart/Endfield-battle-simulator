// `efsim edge` (packages/cli/src/edge.ts): loadouts that put Arcane's Intellect and Will on a knife edge.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import type { Build } from "@efsim/engine";
import { knifeEdge } from "../packages/cli/src/edge.ts";

const data = loadGameData();
const fx = JSON.parse(readFileSync(new URL("../fixtures/multi-target/zmdlogs-0206142f9134.json", import.meta.url), "utf8")) as { team: Build[] };
const arcane = fx.team.find((b) => b.operator === "chr_0032_lizhiyan") as Build;

describe("knife-edge loadouts (in-game test 105)", () => {
  it("lists 0206's own loadout (472.44 against 473.50) among the WILL controls, and finds a split when a pool allows it", () => {
    const own = knifeEdge(data, arcane, { gear: arcane.gear });
    expect(own).toContain("Intellect 472.44 (472), Will 473.50 (473)");
    // Her pieces at other artifice levels: Intellect and Will move by whole points, their fractions stay .44 / .50.
    const variants: Build["gear"] = arcane.gear.flatMap((g) => ([[0, 0, 0], [3, 3, 3], [0, 3, 3], [3, 0, 3]] as const).map((artifice) => ({ ...g, artifice: [...artifice] as unknown as typeof g.artifice })).concat([g]));
    const out = knifeEdge(data, arcane, { gear: variants }, 3);
    expect(out).toMatch(/Split candidates[^\n]*\n {2}(none in this pool|Intellect \d+\.44 \((\d+)\), Will \d+\.50 \(\2\))/);
  });
  it("refuses an operator without a two-attribute mode", () => {
    const laev = JSON.parse(readFileSync(new URL("../fixtures/zero-sanity-laevatain-p5.json", import.meta.url), "utf8")) as { build: Build };
    expect(() => knifeEdge(data, laev.build, { gear: laev.build.gear })).toThrow(/no mode decided by two attributes/);
  });
});
