// `efsim zmdlogs followups` (packages/logs/src/followupsview.ts; round 19, the Camille report point 1): a kit
// trigger's own landings against the events that fired them (LandedHit.fired, a replayed fight's record) and the logged
// hits they stand for. d4fb69b036fe: Pogranichnik's harasses after his combo's slashes (the data's frame 18 on the
// world's clock: about 0.6 s, as logged) and after a physical status, and his Decisive Assault.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { createContext, advance, init, type TimelineScenario } from "@efsim/engine";
import { devFixtures, followUps, followUpsView } from "@efsim/logs";

const data = loadGameData();
const POG = "chr_0029_pograni";

describe("zmdlogs followups (d4fb's Pogranichnik)", () => {
  const d = devFixtures({ ids: ["d4fb"] });
  const fx = (d[0] as (typeof d)[number]).fx;
  const { landings, logOnly } = followUps(data, fx, POG);

  it("gives each triggered landing its firing event, its delay after it and the logged hit it stands for", () => {
    const combo = landings.filter((x) => x.trigger === "oath_harass_combo");
    expect(combo.length).toBeGreaterThan(2);
    for (const x of combo) {
      expect(x.event).toBe(`hit ${POG} ${POG}_combo_skill`);
      expect(x.t - x.firedAt).toBeGreaterThan(500);
      expect(x.t - x.firedAt).toBeLessThan(800);
    }
    const paired = combo.filter((x) => x.logged && x.loggedEvent !== null);
    expect(paired.length).toBeGreaterThan(0);
    // The log's own delay after the slash's logged hit, beside the replay's.
    for (const x of paired) expect(Math.abs((x.logged?.t ?? 0) - (x.loggedEvent ?? 0) - (x.t - x.firedAt))).toBeLessThan(150);
    expect(landings.some((x) => x.event.startsWith("status "))).toBe(true);
  });

  it("names a logged follow-up no landing stands for, with the nearest replay-only landing of its kit hit", () => {
    expect(logOnly.map((x) => [x.hitId, Math.round(x.hit.t / 10) * 10, x.nearest?.trigger])).toContainEqual(["decisive_assault", 89820, "oath_final_combo"]);
    const view = followUpsView(data, d, POG, { trigger: /harass/ });
    expect(view).toMatch(/^ {2}oath_harass_combo: \d+ landing\(s\), \d+ paired, \d+ replay only; delay \+0\.6\d s/m);
    expect(view).not.toMatch(/oath_final/);
  });

  it("is a replay's record only: a simulation's triggered landings carry no firing", () => {
    const sc: TimelineScenario = { team: fx.team, target: { enemy: fx.enemy.id, level: fx.enemy.level }, durationFrames: 30 * 20, rotation: [], options: { crit: "never" }, controlled: POG };
    const ctx = createContext(data, sc);
    expect(advance(ctx, init(ctx), sc.durationFrames).hits.some((h) => h.fired !== undefined)).toBe(false);
  });
});
