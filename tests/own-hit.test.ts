// What a status event's own hit sees of the status it applies (status.ts OWN_HIT_SEES, combat-mechanics §3.8): one
// test per row, on synthetic enemy states before and after the event.
import { describe, expect, it } from "vitest";
import { NO_STATUS, OWN_HIT_SEES, ownHitEnemy, ownHitRow, type ActivePhysical, type ActiveStatus, type EnemyStatus, type StatusEvent } from "@efsim/engine";

const status = (s: ActiveStatus["status"], level: number, appliedAt: number): ActiveStatus => ({ status: s, level, appliedAt, expiresAt: appliedAt + 600, operator: "a", artsIntensity: 0 });
const physical = (s: ActivePhysical["status"], level: number, appliedAt: number): ActivePhysical => ({ status: s, level, appliedAt, expiresAt: appliedAt + 600, operator: "a", artsIntensity: 0 });
const reaction = (s: "corrosion" | "electrification" | "combustion" | "solidification", initialHit = true): StatusEvent => ({ kind: "reaction", frame: 100, operator: "a", status: s, element: "natural", level: 2, consumed: "pulse", initialHit });

describe("a status event's own hit (OWN_HIT_SEES)", () => {
  it("has a row for each status that changes damage, each SETTLED or ASSUMED with its evidence", () => {
    expect(Object.keys(OWN_HIT_SEES).sort()).toEqual(["breach", "corrosion", "electrification"]);
    for (const r of Object.values(OWN_HIT_SEES)) expect(r.evidence.length).toBeGreaterThan(10);
  });

  it("corrosion (SETTLED): sees the Corrosion that was on the enemy, not its own", () => {
    expect(OWN_HIT_SEES.corrosion).toMatchObject({ sees: "prior", tag: "SETTLED" });
    const prior: EnemyStatus = { ...NO_STATUS, statuses: [status("corrosion", 1, 0)] };
    const after: EnemyStatus = { ...NO_STATUS, statuses: [status("corrosion", 2, 100), status("electrification", 1, 50)] };
    const seen = ownHitEnemy(reaction("corrosion"), after, prior);
    expect(seen.statuses.find((s) => s.status === "corrosion")).toMatchObject({ level: 1, appliedAt: 0 });
    expect(seen.statuses.some((s) => s.status === "electrification")).toBe(true);
    // None before: it sees no Corrosion at all.
    expect(ownHitEnemy(reaction("corrosion"), after, NO_STATUS).statuses.some((s) => s.status === "corrosion")).toBe(false);
  });

  it("breach (SETTLED): sees no Breach, neither its own nor the one it replaces", () => {
    expect(OWN_HIT_SEES.breach).toMatchObject({ sees: "none", tag: "SETTLED" });
    const prior: EnemyStatus = { ...NO_STATUS, physical: [physical("breach", 1, 0)] };
    const after: EnemyStatus = { ...NO_STATUS, physical: [physical("breach", 3, 100), physical("lift", 1, 90)] };
    const e: StatusEvent = { kind: "physical", frame: 100, operator: "a", status: "breach", level: 3, forced: false };
    const seen = ownHitEnemy(e, after, prior);
    expect(seen.physical.map((p) => p.status)).toEqual(["lift"]);
    expect(ownHitEnemy(e, after).physical.map((p) => p.status)).toEqual(["lift"]);
  });

  it("electrification (ASSUMED, one hit): sees the Electrification that was on the enemy, not its own", () => {
    expect(OWN_HIT_SEES.electrification).toMatchObject({ sees: "prior", tag: "ASSUMED" });
    const after: EnemyStatus = { ...NO_STATUS, statuses: [status("electrification", 2, 100), status("corrosion", 1, 50)] };
    const seen = ownHitEnemy(reaction("electrification"), after, NO_STATUS);
    expect(seen.statuses.some((s) => s.status === "electrification")).toBe(false);
    expect(seen.statuses.some((s) => s.status === "corrosion")).toBe(true);
  });

  it("leaves every other event's enemy as it is after the event", () => {
    const after: EnemyStatus = { ...NO_STATUS, statuses: [status("corrosion", 2, 100)], physical: [physical("breach", 2, 100)] };
    for (const e of [reaction("combustion"), reaction("solidification"), reaction("corrosion", false), { kind: "burst", frame: 100, operator: "a", element: "fire" } as StatusEvent, { kind: "physical", frame: 100, operator: "a", status: "crush", level: 2, forced: false } as StatusEvent]) {
      expect(ownHitRow(e)).toBeNull();
      expect(ownHitEnemy(e, after, NO_STATUS)).toBe(after);
    }
  });
});
