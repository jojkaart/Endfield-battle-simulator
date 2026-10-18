// The enemy arts state machine against the Talos Wiki rules (status.ts header).
import { describe, expect, it } from "vitest";
import {
  applyToEnemy,
  artsIntensityEffect,
  COMBUSTION_TICK_FRAMES,
  corrosionShred,
  expireStatus,
  INFLICTION_FRAMES,
  nextTick,
  NO_STATUS,
  statusEventKey,
  statusModifiers,
  tickStatus,
  type EnemyStatus,
  type HitApplication,
  type StatusEvent,
} from "../src/index.ts";

function run(apps: readonly [number, HitApplication][], start: EnemyStatus = NO_STATUS, ai = 0) {
  let s = start;
  const events: StatusEvent[] = [];
  for (const [frame, app] of apps) {
    const r = applyToEnemy(s, app, frame, "op", ai);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}

describe("inflictions", () => {
  it("the same element stacks to 4, bursts every time after the first, and resets the duration", () => {
    const apps = Array.from({ length: 6 }, (_, i): [number, HitApplication] => [i * 10, { kind: "infliction", element: "fire" }]);
    const { s, events } = run(apps);
    expect(s.infliction).toEqual({ element: "fire", stacks: 4, expiresAt: 50 + INFLICTION_FRAMES });
    expect(events.filter((e) => e.kind === "burst")).toHaveLength(5);
    expect(events.filter((e) => e.kind === "inflicted").map((e) => (e.kind === "inflicted" ? e.stacks : 0))).toEqual([1, 2, 3, 4, 4, 4]);
    expect(statusEventKey(events.find((e) => e.kind === "burst") as StatusEvent)).toBe("buff_common_fire_fire_triggered");
  });

  it("expires 20 s after the last application", () => {
    const { s } = run([[0, { kind: "infliction", element: "cryst" }]]);
    expect(expireStatus(s, INFLICTION_FRAMES - 1).infliction).not.toBeNull();
    expect(expireStatus(s, INFLICTION_FRAMES).infliction).toBeNull();
    // An expired infliction doesn't react: the next one starts fresh.
    const later = applyToEnemy(s, { kind: "infliction", element: "fire" }, INFLICTION_FRAMES, "op", 0);
    expect(later.events.map((e) => e.kind)).toEqual(["inflicted"]);
    expect(later.state.infliction?.element).toBe("fire");
  });

  it("a different element consumes the infliction and triggers the new element's reaction at level = stacks", () => {
    const { s, events } = run([
      [0, { kind: "infliction", element: "natural" }],
      [1, { kind: "infliction", element: "natural" }],
      [2, { kind: "infliction", element: "natural" }],
      [3, { kind: "infliction", element: "fire" }],
    ]);
    expect(s.infliction).toBeNull();
    const r = events.at(-1);
    expect(r).toEqual({ kind: "reaction", frame: 3, operator: "op", status: "combustion", element: "fire", level: 3, consumed: "natural", initialHit: true });
    expect(statusEventKey(r as StatusEvent)).toBe("buff_common_fire_natural_triggered");
    expect(s.statuses.map((x) => [x.status, x.level])).toEqual([["combustion", 3]]);
  });

  it("consuming removes the infliction and reports its stacks, only for the listed elements", () => {
    const base = run([[0, { kind: "infliction", element: "fire" }], [1, { kind: "infliction", element: "fire" }]]).s;
    expect(applyToEnemy(base, { kind: "consumeInfliction", elements: ["cryst"] }, 2, "op", 0).events).toEqual([]);
    const r = applyToEnemy(base, { kind: "consumeInfliction" }, 2, "op", 0);
    expect(r.state.infliction).toBeNull();
    expect(r.events).toEqual([{ kind: "consumed", frame: 2, operator: "op", element: "fire", stacks: 2 }]);
  });
});

describe("statuses", () => {
  it("a forced reaction is level I by default, consumes nothing and has no initial hit", () => {
    const { s, events: all } = run([[0, { kind: "infliction", element: "pulse" }], [5, { kind: "forcedReaction", status: "corrosion" }]]);
    const events = all.filter((e) => e.kind !== "inflicted");
    expect(s.infliction?.element).toBe("pulse");
    expect(events).toEqual([{ kind: "reaction", frame: 5, operator: "op", status: "corrosion", element: "natural", level: 1, consumed: null, initialHit: false }]);
    expect(statusEventKey(events[0] as StatusEvent)).toBeNull();
  });

  it("reapplying a status replaces it and resets its duration", () => {
    const { s } = run([[0, { kind: "forcedReaction", status: "corrosion", level: 4 }], [100, { kind: "forcedReaction", status: "corrosion", level: 1 }]]);
    expect(s.statuses).toHaveLength(1);
    expect(s.statuses[0]).toMatchObject({ level: 1, appliedAt: 100, expiresAt: 100 + 450 });
  });

  it("Corrosion shreds resistance for every element, ramping per whole second, scaled by the applier's Arts Intensity", () => {
    const { s } = run([[0, { kind: "forcedReaction", status: "corrosion", level: 2 }]], NO_STATUS, 100);
    const at = (f: number) => statusModifiers(s, f);
    expect(at(29)).toEqual([{ zone: "ignoreResistance", value: corrosionShred(2, 966.6666666666666, 100), source: "Corrosion level 2" }]);
    expect(at(29)[0]?.value).toBeCloseTo(4.8 * 1.5, 10);
    expect(at(30)[0]?.value).toBeCloseTo((4.8 + 1.12) * 1.5, 10);
    expect(at(30 * 14)[0]?.value).toBeCloseTo(16 * 1.5, 10);
    expect(at(450)).toEqual([]);
  });

  it("Electrification adds Arts DMG Taken (not Physical) by level, scaled by Arts Intensity, for 12–30 s", () => {
    const { s } = run([[0, { kind: "forcedReaction", status: "electrification", level: 3 }]], NO_STATUS, 200);
    const mods = statusModifiers(s, 10);
    expect(mods.map((m) => m.element)).toEqual(["fire", "pulse", "cryst", "natural"]);
    expect(mods.every((m) => m.zone === "damageTaken" && Math.abs(m.value - 0.2 * artsIntensityEffect(200)) < 1e-12)).toBe(true);
    expect(statusModifiers(s, 24 * 30 - 1)).toHaveLength(4);
    expect(statusModifiers(s, 24 * 30)).toEqual([]);
  });

  it("Combustion ticks once per second for 10 s, attributed to the operator that applied it", () => {
    const { s } = run([[7, { kind: "forcedReaction", status: "combustion", level: 2 }]]);
    expect(nextTick(s)).toBe(7 + COMBUSTION_TICK_FRAMES);
    const t = tickStatus(s, 10_000);
    expect(t.events.map((e) => e.frame)).toEqual(Array.from({ length: 10 }, (_, i) => 7 + 30 * (i + 1)));
    expect(t.events.every((e) => e.kind === "combustionTick" && e.level === 2 && e.operator === "op")).toBe(true);
    expect(nextTick(t.state)).toBeNull();
    // Ticks are emitted only once.
    expect(tickStatus(t.state, 10_000).events).toEqual([]);
  });
});
