// A combo's window and cooldown as the replay's own record (round 24, the combo-windows report point 1 and the
// combo-openers report point 2): `zmdlogs replay --windows <operator>` (ReplayOptions.trace `window:<operator>`,
// replayrecord.ts WindowTrace, windowsview.ts windowLines) and the COOLDOWN record (replayrun.ts cooldownEarly,
// MadeCast.early).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { logBuffReplay, readLogFixture, windowLines } from "@efsim/logs";

const data = loadGameData();
const fixture = (name: string) => readLogFixture(new URL(`../fixtures/${name}`, import.meta.url).pathname);
const ARCANE = "chr_0032_lizhiyan";

describe("an operator's combo windows and cooldowns in the replay", () => {
  const fx = fixture("pending/zmdlogs-3f78ceb15bc3.json");
  const { replay } = logBuffReplay(data, fx, undefined, { trace: [`window:${ARCANE}`] });
  const lines = windowLines(data, replay, ARCANE, [`${ARCANE}_combo_skill`]).map((l) => l.text);

  it("3f78's first Arcane combo: the window a Cryst infliction opened, refreshed, used by the press at 2.13 s, the cooldown it set", () => {
    expect(lines.slice(0, 5)).toEqual([
      expect.stringMatching(/^WINDOW Arcane: opened at 0\.93 s \(count 1, cryst infliction, until 6\.93 s\), by cryst infliction/),
      expect.stringMatching(/^WINDOW Arcane: refreshed \(the one from 0\.93 s still open\) at 1\.33 s/),
      "WINDOW combo_skill ready at 20.13 s: its cast at 2.13 s set its cooldown (18.00 s)",
      "WINDOW Arcane: the window from 1.33 s used by combo_skill made at 2.13 s",
      "WINDOW combo_skill pressed at 2.13 s: its window open, count 1",
    ]);
  });

  it("3f78's Arcane combo at 19.30 s: the event the cooldown kept out, the press 0.83 s early (a live lead: fails when it is fixed)", () => {
    // docs/open-problems.md "Combo windows" (3f78 19.30 s): when a fix moves this cast, take another early one from
    // `zmdlogs decisions --all` (COOLDOWN lines) or scripts/probes/placement/combo-cooldowns.ts.
    expect(lines).toContain("WINDOW Arcane: an event at 19.17 s (natural infliction) kept shut by the cooldown (combo_skill ready at 20.13 s)");
    expect(lines).toContainEqual(expect.stringMatching(/^WINDOW combo_skill pressed at 19\.30 s: its window shut at the press .*; 0\.83 s before its cooldown \(COOLDOWN\)$/));
    const early = replay.made.filter((m) => m.early && m.cast.kind === "combo" && Math.abs(m.cast.start - 19300) < 300);
    expect(early.map((m) => [m.cast.operator, m.early ? m.early.readyAt - m.frame : null, m.early?.last])).toEqual([[ARCANE, 25, { frame: 64, cooldownFrames: 540 }]]);
  });
});
