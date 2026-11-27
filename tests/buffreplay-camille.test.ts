// The log check's kit-buff replay (tests/buffreplay.test.ts), Camille's Vesperwings across an away stretch (kit
// assumption vesperwings-target-loss, buffreplay.ts targetLosses). A separate file so the default suite's workers
// balance.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { logBuffReplay, readLogFixture } from "@efsim/cli";

const data = loadGameData();
const C = "chr_0033_camille";

describe("Camille's Vesperwings end when the enemy leaves (2026-11-27)", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-e9896c8d02be.json", import.meta.url).pathname);
  // Her battle-skill hits at 3.54, 45.89, 61.69 and 89.32 s; away stretches 19.67–43.14 and 70.93–84.83 s. The log lists
  // the debuff (buff_common_affixes_vulnerable_fire 0.12) to 19.67 s and to 69.19 s, 1.74 s before the second stretch.
  const windows = (reading: string) =>
    logBuffReplay(data, fx, { assume: { "vesperwings-target-loss": reading } })
      .replay.kitWindows(`${C}:vesperwings`, C)
      .map((w) => [Math.round(w.start / 100) / 10, Math.round(w.end / 100) / 10]);

  it("`listed` (the default): at the entity's check at the debuff's last listing before each stretch, as the log", () => {
    // 19.67 s is the first stretch's start: the check after it, 20.03 s (every 0.5 s from 3.53 s); 69.19 s is a check
    // 7.5 s after the 61.69 s hit, the one the log's boundary listing shows.
    expect(windows("listed")).toEqual([[3.5, 20], [45.9, 61.7], [61.7, 69.2], [89.3, 151.3]]);
  });

  it("`away`: at the entity's first check after each stretch's last logged hit", () => {
    // The first window's end 0.17 s later than under `listed`: the hidden holds, placed from this reading's runs, differ.
    expect(windows("away")).toEqual([[3.5, 20.2], [45.9, 61.7], [61.7, 71.2], [89.3, 151.3]]);
  });

  it("`kept`: through both stretches, refreshed by her next battle skill", () => {
    expect(windows("kept")).toEqual([[3.5, 45.9], [45.9, 61.7], [61.7, 89.3], [89.3, 151.3]]);
  });
});
