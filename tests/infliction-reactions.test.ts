// `inflictionApplied` with `reactions`: an infliction that forms a reaction at once still counts as applied
// (abilityEvent 126 fires before the game resolves it; owner's call 2026-10-22), a forced reaction (a skill that
// applies the status directly, no infliction) doesn't.
import { describe, expect, it } from "vitest";
import { eventMatches, type BattleEvent, type StatusEvent } from "@efsim/engine";

const op = "chr_0033_camille";
const status = (event: StatusEvent): BattleEvent => ({ type: "status", frame: 10, operator: op, event, fromKind: "battle" });
const formed = status({ kind: "reaction", frame: 10, operator: op, status: "combustion", element: "fire", level: 1, consumed: "natural", initialHit: true });
const forced = status({ kind: "reaction", frame: 10, operator: op, status: "combustion", element: "fire", level: 1, consumed: null, initialHit: false });
const inflicted = status({ kind: "inflicted", frame: 10, operator: op, element: "fire", stacks: 1 });

describe("inflictionApplied and reactions", () => {
  it("counts an infliction that forms a reaction only with `reactions`", () => {
    expect(eventMatches({ event: "inflictionApplied", elements: ["fire"] }, formed, op, {})).toBe(false);
    expect(eventMatches({ event: "inflictionApplied", elements: ["fire"], reactions: true }, formed, op, {})).toBe(true);
    expect(eventMatches({ event: "inflictionApplied", elements: ["cryst"], reactions: true }, formed, op, {})).toBe(false);
  });

  it("never counts a forced reaction: no infliction was applied", () => {
    expect(eventMatches({ event: "inflictionApplied", elements: ["fire"], reactions: true }, forced, op, {})).toBe(false);
  });

  it("a reaction leaves no stacks, so it doesn't meet a minimum above 1", () => {
    expect(eventMatches({ event: "inflictionApplied", minStacks: 2, reactions: true }, formed, op, {})).toBe(false);
    expect(eventMatches({ event: "inflictionApplied", reactions: true }, inflicted, op, {})).toBe(true);
  });
});
