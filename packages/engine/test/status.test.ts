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
  reactionBase,
  levelCoefficientOf,
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

describe("arts state: applications kits need (batch 1, A1–A5)", () => {
  const nature2 = applyToEnemy(applyToEnemy(NO_STATUS, { kind: "infliction", element: "natural" }, 0, "a", 0).state, { kind: "infliction", element: "natural" }, 1, "a", 0).state;
  // Nature onto 2 Heat stacks: Corrosion level 2.
  const heat2 = applyToEnemy(applyToEnemy(NO_STATUS, { kind: "infliction", element: "fire" }, 0, "a", 0).state, { kind: "infliction", element: "fire" }, 1, "a", 0).state;

  it("an infliction of the enemy's element stacks on what it has, and does nothing on a clean enemy", () => {
    expect(applyToEnemy(NO_STATUS, { kind: "infliction", element: "enemy" }, 0, "a", 0)).toEqual({ state: NO_STATUS, events: [] });
    const r = applyToEnemy(nature2, { kind: "infliction", element: "enemy" }, 2, "b", 0);
    expect(r.state.infliction).toMatchObject({ element: "natural", stacks: 3 });
    expect(r.events.map((e) => e.kind)).toEqual(["inflicted", "burst"]);
  });

  it("consuming a number of stacks leaves the rest with its timer", () => {
    const r = applyToEnemy(nature2, { kind: "consumeInfliction", stacks: 1 }, 5, "a", 0);
    expect(r.state.infliction).toEqual({ ...nature2.infliction, stacks: 1 });
    expect(r.events).toEqual([{ kind: "consumed", frame: 5, operator: "a", element: "natural", stacks: 1 }]);
    expect(applyToEnemy(nature2, { kind: "consumeInfliction", stacks: 9 }, 5, "a", 0).state.infliction).toBeNull();
  });

  it("a status can be consumed, with an event", () => {
    const corroded = applyToEnemy(heat2, { kind: "infliction", element: "natural" }, 3, "a", 0).state;
    expect(corroded.statuses.map((x) => x.status)).toEqual(["corrosion"]);
    const r = applyToEnemy(corroded, { kind: "consumeStatus", statuses: ["corrosion"] }, 10, "b", 0);
    expect(r.state.statuses).toEqual([]);
    expect(r.events).toEqual([{ kind: "statusConsumed", frame: 10, operator: "b", status: "corrosion", level: 2 }]);
    expect(applyToEnemy(corroded, { kind: "consumeStatus", statuses: ["solidification"] }, 10, "b", 0).events).toEqual([]);
  });

  it("an applier's tweaks lengthen its statuses and raise Corrosion's cap", () => {
    const plain = applyToEnemy(heat2, { kind: "infliction", element: "natural" }, 3, "a", 0).state.statuses[0];
    const tweaked = applyToEnemy(heat2, { kind: "infliction", element: "natural" }, 3, "a", 0, undefined, { corrosion: { extraFrames: 300, capScale: 1.3 } }).state;
    expect(tweaked.statuses[0]?.expiresAt).toBe((plain?.expiresAt ?? NaN) + 300);
    // Long after it's applied, the shred sits at the raised cap: 16 × 1.3 at level 2 (AI 0), 20 s in.
    expect(statusModifiers(tweaked, 3 + 30 * 20)[0]?.value).toBeCloseTo(16 * 1.3, 9);
    expect(corrosionShred(2, 60_000, 0, 1.3)).toBeCloseTo(20.8, 9);
  });
});

describe("physical state (Vulnerable, Lift, Knock Down, Crush, Breach, Shatter)", () => {
  const phys = (s: EnemyStatus, status: "lift" | "knockdown" | "crush" | "breach", frame: number, forced = false) => applyToEnemy(s, { kind: "physicalStatus", status, forced }, frame, "a", 0);

  it("without Vulnerable, a status only adds a stack, unless it's a forced Lift", () => {
    const r = phys(NO_STATUS, "crush", 0);
    expect(r.events).toEqual([{ kind: "vulnerable", frame: 0, operator: "a", stacks: 1, before: 0 }]);
    expect(r.state.vulnerable).toEqual({ stacks: 1, expiresAt: 600 });
    const f = phys(NO_STATUS, "lift", 0, true);
    expect(f.events.map((e) => e.kind)).toEqual(["vulnerable", "physical"]);
    expect(f.state.physical.map((x) => x.status)).toEqual(["lift"]);
  });

  it("Lift adds a stack and keeps them; Crush and Breach consume all, at that level", () => {
    let s = phys(NO_STATUS, "lift", 0).state;
    s = phys(s, "lift", 30).state;
    expect(s.vulnerable?.stacks).toBe(2);
    s = phys(s, "knockdown", 60).state;
    expect(s.vulnerable?.stacks).toBe(3);
    const crush = phys(s, "crush", 90);
    expect(crush.state.vulnerable).toBeNull();
    expect(crush.events).toEqual([{ kind: "physical", frame: 90, operator: "a", status: "crush", level: 3, forced: false }]);
    const breach = phys(s, "breach", 90);
    expect(breach.state.physical.find((x) => x.status === "breach")).toMatchObject({ level: 3, expiresAt: 90 + 24 * 30 });
    // Breach: Physical DMG taken +20% at level III (AI 0).
    expect(statusModifiers(breach.state, 100).find((m) => m.source === "Breach level 3")).toMatchObject({ zone: "damageTaken", element: "physical", value: 0.2 });
  });

  it("Vulnerable caps at 4 and refreshes to 20 s", () => {
    let s = NO_STATUS;
    for (let i = 0; i < 6; i++) s = applyToEnemy(s, { kind: "vulnerable" }, i * 30, "a", 0).state;
    expect(s.vulnerable).toEqual({ stacks: 4, expiresAt: 5 * 30 + 600 });
  });

  it("a physical status or a new Vulnerable stack shatters a Solidified enemy, after the status's own hit", () => {
    const solid = applyToEnemy(NO_STATUS, { kind: "forcedReaction", status: "solidification", level: 2 }, 2, "a", 0).state;
    const lift = phys(solid, "lift", 10, true);
    expect(lift.events.map((e) => e.kind)).toEqual(["vulnerable", "physical", "shatter"]);
    expect(lift.events.at(-1)).toMatchObject({ kind: "shatter", level: 2 });
    expect(lift.state.statuses.some((x) => x.status === "solidification")).toBe(false);
    const stack = applyToEnemy(solid, { kind: "vulnerable" }, 10, "b", 0);
    expect(stack.events.map((e) => e.kind)).toEqual(["vulnerable", "shatter"]);
  });

  it("their hits' multipliers and log keys", () => {
    expect([reactionBase("lift", 1), reactionBase("crush", 4), reactionBase("breach", 1), reactionBase("shatter", 2)]).toEqual([1.2, 7.5, 1, 3.6]);
    expect(levelCoefficientOf("lift", 90)).toBeCloseTo(1 + 89 / 392, 12);
    expect(levelCoefficientOf("shatter", 90)).toBeCloseTo(1 + 89 / 196, 12);
    expect(statusEventKey({ kind: "physical", frame: 0, operator: "a", status: "lift", level: 1, forced: true })).toBe("buff_physical_airborne");
    expect(statusEventKey({ kind: "shatter", frame: 0, operator: "a", level: 1 })).toBe("buff_common_cryst_triggered_physical_break");
  });
});
