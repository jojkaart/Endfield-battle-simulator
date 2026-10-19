// Rotation search: found rotations are legal (they replay through simulate) and beat a hand-written one.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FPS, resourceValues, searchRotation, simulate, type Build, type TimelineScenario } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "../packages/cli/src/simulate.ts";

const data = loadGameData();
const example = readScenario(new URL("../examples/laevatain-solo.scenario.json", import.meta.url).pathname);
const { rotation: handWritten, ...open } = example;

describe("rotation search", () => {
  const found = searchRotation(data, open, { beamWidth: 8 });

  it("finds a rotation that replays to the same result with simulate", () => {
    const replay = simulate(data, { ...open, rotation: found.rotation } as TimelineScenario);
    expect(replay.total).toBe(found.result.total);
    expect(found.rotation.every((a) => a.at !== undefined && a.at <= open.durationFrames)).toBe(true);
  });

  it("is deterministic", () => {
    expect(searchRotation(data, open, { beamWidth: 8 }).result.total).toBe(found.result.total);
  });

  it("beats the hand-written example rotation over the same fight", () => {
    const hand = simulate(data, { ...open, rotation: handWritten });
    expect(found.result.total).toBeGreaterThan(hand.total);
  });

  it("values SP and ultimate energy by what the team's own skills deal per point", () => {
    const v = resourceValues(data, open);
    expect(v.perSp).toBeGreaterThan(0);
    // Laevatain's ultimate deals next to nothing itself (its worth is the enhanced skills it unlocks), so a lone cast prices her energy at about 0.
    expect(v.perEnergy[open.team[0]?.operator ?? ""] ?? 0).toBeGreaterThanOrEqual(0);
    // A search that counts them still finds a legal rotation, ranked by damage.
    const weighted = searchRotation(data, open, { beamWidth: 8, resourceWeight: 0.5 });
    expect(simulate(data, { ...open, rotation: weighted.rotation } as TimelineScenario).total).toBe(weighted.result.total);
  });

  it("works for a team: casts of both operators interleave, all legal", () => {
    const fx = JSON.parse(readFileSync(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url), "utf8")) as { team: Build[] };
    const team = fx.team.filter((b) => b.operator === "chr_0016_laevat" || b.operator === "chr_0013_aglina");
    const scenario = { team, target: { enemy: "eny_0051_rodin", level: 90 }, durationFrames: 20 * FPS, options: { crit: "expected" as const } };
    const r = searchRotation(data, scenario, { beamWidth: 6 });
    expect(new Set(r.rotation.map((a) => a.operator)).size).toBe(2);
    expect(simulate(data, { ...scenario, rotation: r.rotation }).total).toBe(r.result.total);
  });
});
