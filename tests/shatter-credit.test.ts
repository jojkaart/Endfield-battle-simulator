// Whose Shatter (status.ts addVulnerable, 2026-11-24): a Vulnerable stack joining a running Vulnerable shatters as the
// operator's who started it (buff_physical_no_guard's on-stack handler takes the buff's source; 04d401ad257e: Catcher's
// Knock Downs on Ember's Vulnerable logged as Ember's Shatters); a first stack, a Crush or a Breach as the applier's.
import { describe, expect, it } from "vitest";
import { applyToEnemy, NO_STATUS, type EnemyStatus, type StatusEvent } from "@efsim/engine";

const ember = "chr_0009_azrila";
const catcher = "chr_0020_meurs";
const snow = "chr_0014_aurora";
const solidified = (s: EnemyStatus) => applyToEnemy(s, { kind: "forcedReaction", status: "solidification" }, 10, snow, 0).state;
const shatterBy = (events: readonly StatusEvent[]) => events.find((e) => e.kind === "shatter")?.operator;

describe("Shatter credit", () => {
  it("a first Vulnerable stack shatters as its applier's", () => {
    const r = applyToEnemy(solidified(NO_STATUS), { kind: "physicalStatus", status: "knockdown" }, 20, catcher, 0);
    expect(shatterBy(r.events)).toBe(catcher);
  });

  it("a Knock Down on another's Vulnerable shatters as the Vulnerable's starter's", () => {
    const vulnerable = applyToEnemy(NO_STATUS, { kind: "vulnerable" }, 0, ember, 0).state;
    const r = applyToEnemy(solidified(vulnerable), { kind: "physicalStatus", status: "knockdown" }, 20, catcher, 0);
    expect(r.events.some((e) => e.kind === "physical" && e.operator === catcher)).toBe(true);
    expect(shatterBy(r.events)).toBe(ember);
    expect(r.state.vulnerable?.by).toBe(ember);
  });

  it("a direct stack on another's Vulnerable too; a Crush as its applier's", () => {
    const vulnerable = applyToEnemy(NO_STATUS, { kind: "vulnerable" }, 0, ember, 0).state;
    expect(shatterBy(applyToEnemy(solidified(vulnerable), { kind: "vulnerable" }, 20, catcher, 0).events)).toBe(ember);
    expect(shatterBy(applyToEnemy(solidified(vulnerable), { kind: "physicalStatus", status: "crush" }, 20, catcher, 0).events)).toBe(catcher);
  });
});
