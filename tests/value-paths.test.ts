// A cast's path through the kit's jumps on its state (2026-11-26, Pogranichnik's combo: frame 0 to 200, 400 or 600 by
// the Vulnerable stacks his trigger consumed):
// - its logged landings go onto the path the cast took (engine paths.ts takenPathLandings): the placement gives the
//   slashes the 4-stack path's frames by kit order, and the replay landed them there besides the jumped-to path's own;
// - the path the landings' values show where they decide (castassembly.ts valuePaths, replayCast kitJumps): the 4-stack
//   path's third slash is 2.97, the 3-stack path's 1.49.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { hitLandingFrames, takenPathLandings } from "@efsim/engine";
import { checkLog, devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const P = "chr_0029_pograni";
const COMBO = `${P}_combo_skill`;
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx;

describe("a taken jump's path (takenPathLandings)", () => {
  const hits = [
    { id: "hit", frames: [23, 223, 423], events: ["k"] },
    { id: "hit_3", frames: [61], events: ["k"] },
    { id: "hit_4", frames: [261], events: ["k"] },
  ] as unknown as Parameters<typeof takenPathLandings>[0]["hits"];
  it("moves a landing in the skipped part to the same hit's landing past the jump, or its twin with the keys there", () => {
    const moved = takenPathLandings({ hits }, [{ at: 0, to: 200 }], [{ hitId: "hit", nth: 0, frame: 1 }, { hitId: "hit_3", nth: 0, frame: 2 }]);
    expect(moved.map((l) => [l.hitId, l.nth])).toEqual([["hit", 1], ["hit_4", 0]]);
    expect(takenPathLandings({ hits }, [], [{ hitId: "hit_3", nth: 0, frame: 2 }])[0]?.hitId).toBe("hit_3");
  });
  it("counts a hit's landings past its frames", () => {
    expect(hitLandingFrames({ frames: [3, 5], count: 4, framesEvery: 2 })).toEqual([3, 5, 7, 9]);
  });
});

describe("Pogranichnik's combo paths in the replay", () => {
  const landedAs = (id: string) => {
    const fx = fixture(id);
    const r = logBuffReplay(data, fx);
    return (t: number) => {
      const h = fx.hits.find((x) => x.operator === P && x.event === COMBO && x.t === t);
      const l = h ? r.replay.landing(h) : undefined;
      return l && !("unknown" in l) ? l.hitId : undefined;
    };
  };
  it("lands a 3-stack combo's slashes on its own path, once (a9d7 48.9 s: the third ×1.36 the first, the 3-stack path's hit_4)", () => {
    const at = landedAs("a9d7");
    const fx = fixture("a9d7");
    const slashes = fx.hits.filter((h) => h.operator === P && h.event === COMBO && h.t > 48800 && h.t < 51500).map((h) => h.t);
    expect(slashes.map(at)).toEqual(["hit", "hit_2", "hit_4"]);
  });
  it("takes the 4-stack path its values show where the replay consumed three stacks (c4f3 13.7 s: ×3.13, hit_3); his first Fervent Morale at the 34.04 s Breach, as the log lists it", () => {
    const fx = fixture("c4f3");
    const r = logBuffReplay(data, fx);
    const h = fx.hits.find((x) => x.operator === P && x.event === COMBO && x.t === 15968);
    const l = h ? r.replay.landing(h) : undefined;
    expect(l && !("unknown" in l) ? l.hitId : undefined).toBe("hit_3");
    const first = r.replay.kitWindows(`${P}:fervent_morale`, P)[0];
    expect(first?.start).toBeGreaterThan(33900);
    expect(first?.start).toBeLessThan(34100);
  });
  it("a Breach takes its applier's Arts Intensity after its hit's before-damage triggers: the 34.04 s Breach with the Fervent Morale layer its battle skill's SP made (c4f3: the hits under it plain)", () => {
    const fx = fixture("c4f3");
    const r = logBuffReplay(data, fx);
    const v = checkLog(data, fx, { replay: r }).filter((x) => x.hit.operator === P && x.hit.t >= 34000 && x.hit.t <= 39300);
    expect(v.length).toBeGreaterThanOrEqual(4);
    expect(v.every((x) => x.kind === "match")).toBe(true);
  });
});
