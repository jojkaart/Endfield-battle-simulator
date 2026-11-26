// A kit stack's value traced through the replay (`zmdlogs replay --trace-stack owner:stack`, BuffReplay.stackTraces;
// round 16, the batched-landings report point 3): d4fb's 86.67 s Fervent Morale, Pogranichnik's bank crossing its
// threshold, which an earlier round read off trigger firings and buff lengths.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay, replayView } from "@efsim/logs";

const data = loadGameData();
const P = "chr_0029_pograni";

describe("a kit stack's value in the replay (--trace-stack)", () => {
  const [d] = devFixtures({ ids: ["d4fb"] });
  const fx = (d as NonNullable<typeof d>).fx;

  it("records each change of the bank with the step that made it, and prints it as a TRACE line", () => {
    const { replay } = logBuffReplay(data, fx, undefined, { trace: [`stack:${P}:sp_banked`] });
    const changes = replay.stackTraces.filter((x) => x.frame >= 85 * 30 && x.frame <= 88 * 30);
    expect(changes.length).toBeGreaterThan(1);
    for (const x of changes) {
      expect(x.operator).toBe(P);
      expect(x.from).not.toBe(x.to);
    }
    // Each step's value is the next one's start.
    for (const [i, x] of changes.entries()) if (i > 0) expect(x.from).toBe(changes[i - 1]?.to);
    expect(replayView(data, fx, { from: 85000, to: 88000, trace: [`stack:${P}:sp_banked`] })).toMatch(/TRACE {2}stack Pogranichnik:sp_banked \d+ → \d+ at /);
  });
});
