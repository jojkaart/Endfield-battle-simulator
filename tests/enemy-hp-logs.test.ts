// The enemy's HP in the log check's replay (buffreplay.ts loggedEnemyHp, engine assumption enemy-hp): a kill's logged
// total, in lives split where the enemy went away (misprediction statistics, 2026-11-24). Alesh's P5 ultimate reads
// it: ×1.5 (atk_up) while the enemy's HP is below half. Also the fight's start: an ultimate pressed before the log's
// first hit (replayedSkill, ReplayedCast.beforeHits).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, logBuffReplay, readLogFixture } from "@efsim/cli";
import type { LogHit } from "@efsim/logs";

const data = loadGameData();
const ALESH = "chr_0024_deepfin";

describe("a9d7fcb089c5: Alesh's ultimate against Si's two lives", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-a9d7fcb089c5.json", import.meta.url).pathname);
  const ults = fx.hits.filter((h) => h.operator === ALESH && h.event === ALESH + "_ultimate_skill");
  const unassumed = (reading: string) => {
    const v = checkLog(data, fx, { replay: logBuffReplay(data, fx, undefined, { assume: { "enemy-hp": reading } }) });
    return ults.filter((h: LogHit) => {
      const x = v.find((y) => y.hit === h);
      return x?.kind === "match" && x.assumed.length === 0;
    }).map((h) => h.t);
  };

  it("matches all eight, the four ×1.5 ones where a life's HP was below half (55.2, 95.6 s in the first, 209.4, 243.9 s in the second)", () => {
    expect(ults.length).toBe(8);
    expect(unassumed("kill")).toEqual(ults.map((h) => h.t));
  });

  it("misses the four ×1.5 ones with only the data's Max HP as an HP (max-hp, the replay until 2026-11-24)", () => {
    expect(unassumed("max-hp")).toEqual([8374, 35538, 145238, 173901]);
  });
});

describe("9c0bb09daff2: Si's ultimate pressed before the log's first hit", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-9c0bb09daff2.json", import.meta.url).pathname);
  it("is made whatever the replay's energy (68 needed, 0 held at 7.02 s): its Amp is on the team when the hits begin at 13.27 s", () => {
    const r = logBuffReplay(data, fx);
    const amp = r.replay.kitWindows("chr_0036_jsspsi:ultimate_amp", "chr_0016_laevat");
    expect(amp.some((w) => w.start <= 13267 && w.end >= 19886)).toBe(true);
  });
});
