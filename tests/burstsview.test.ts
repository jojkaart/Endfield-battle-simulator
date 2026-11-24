// `zmdlogs bursts` (packages/logs/src/burstsview.ts): each Arts Burst, logged against replayed, with each side's likely
// cause (kit-buff leads report point 3, round 11). Structural: the rows cover every logged burst and every replayed one
// once, whatever the replay's accuracy is.
import { describe, expect, it } from "vitest";
import { loadGameData, operatorId } from "@efsim/data";
import { burstRows, burstsView, devFixtures, logBuffReplay } from "@efsim/logs";
import { parseReactionEvent } from "@efsim/engine";

const data = loadGameData();

describe("a fight's Arts Bursts (zmdlogs bursts)", () => {
  const logs = devFixtures({ ids: ["00ae"] });
  const fx = (logs[0] as (typeof logs)[number]).fx;
  const arcane = operatorId(data, "Arcane");

  it("gives every logged burst a row and every replayed burst one, the pairs the check's own", () => {
    const rows = burstRows(data, fx, { operators: [arcane] });
    const logged = fx.hits.filter((h) => h.operator === arcane && parseReactionEvent(h.event)?.kind === "burst");
    expect(rows.filter((r) => r.logged).length).toBe(logged.length);
    const { replay } = logBuffReplay(data, fx);
    const replayed = replay.hits.filter((l) => l.operator === arcane && l.skillId === "reaction:burst");
    expect(rows.filter((r) => r.replay).length).toBe(replayed.length);
    for (const r of rows) {
      expect(r.operator).toBe(arcane);
      if (r.logged && r.replay) expect(Math.abs(r.replay.t - r.logged.t)).toBeLessThan(4000);
      // A cause comes at least the burst delay of world time before (1 frame of slack).
      for (const c of [r.logged?.cause, r.replay?.cause]) if (c) expect(c.world).toBeGreaterThanOrEqual(1000 - 1000 / 30);
    }
  });

  it("prints a line per burst and the counts per operator", () => {
    const text = burstsView(data, logs, { operators: [arcane] });
    expect(text).toMatch(/^00ae:$/m);
    expect(text).toMatch(/^ +\d+\.\d\d {2}Arcane natural: (logged \d+, (replay|LOG ONLY)|REPLAY ONLY)/m);
    expect(text).toMatch(/^ {4}Arcane: \d+ logged, \d+ with a replay landing/m);
  });
});
