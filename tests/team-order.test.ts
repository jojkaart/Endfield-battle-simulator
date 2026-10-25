// Whether a fight's result depends on the order its team is listed in (docs/design.md "Order within a frame"). It
// does where the game reads team positions (a kit's `teamSlotElement` predicate, a cooldown change for the member in
// a slot: Si reads Team Position 01), so those examples are only checked to name a slot; every other example must
// give the same hits under every order of its team (the controlled operator kept), with expected and rolled crits.
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createContext, simulate, type TimelineScenario } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "../packages/cli/src/simulate.ts";

const data = loadGameData();
const dir = new URL("../examples/", import.meta.url).pathname;
const examples = readdirSync(dir).filter((f) => f.endsWith(".scenario.json")).sort().map((f) => [f, readScenario(dir + f)] as const).filter(([, s]) => s.team.length > 1);

const orders = <T,>(xs: readonly T[]): T[][] => (xs.length <= 1 ? [[...xs]] : xs.flatMap((x, i) => orders([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));

/** Whether any kit (with what its operator wears) of the team reads a team position. */
function readsSlots(s: TimelineScenario): boolean {
  return [...createContext(data, s).kits.values()].some((k) => /"teamSlotElement"|"who":\{"slot"/.test(JSON.stringify(k)));
}

/** A result as text: the hits in a canonical order (frame, operator, hit), each with its exact damage; the total. */
function outcome(s: TimelineScenario): string {
  const r = simulate(data, s);
  const hits = r.hits.map((h) => `${h.frame} ${h.operator} ${h.skillId}:${h.hitId} ${h.exact}`).sort();
  return `${hits.join("\n")}\ncasts ${r.casts.map((c) => `${c.frame} ${c.skill}`).join(",")}`;
}

describe("team order", () => {
  it("is read by the examples' kits only through team positions (Si)", () => {
    expect(examples.filter(([, s]) => readsSlots(s)).map(([f]) => f)).toEqual(["lastrite-si.scenario.json", "si-laevatain-liino-gilberta.scenario.json", "si-laevatain.scenario.json", "xaihi-si.scenario.json"]);
  });

  it.each(examples.filter(([, s]) => !readsSlots(s)))("%s gives the same hits under every order of its team", (_f, s) => {
    const controlled = s.controlled ?? (s.team[0] as TimelineScenario["team"][number]).operator;
    for (const crit of ["expected", "rolled"] as const) {
      const as = (team: TimelineScenario["team"]) => outcome({ ...s, team, controlled, options: { ...s.options, crit, seed: 7 } });
      const base = as(s.team);
      for (const team of orders(s.team).slice(1)) expect(as(team), `${crit}: ${team.map((b) => b.operator).join(", ")}`).toBe(base);
    }
  });
});
