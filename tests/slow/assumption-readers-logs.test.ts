// The assumption readers' run check (tests/assumption-readers.test.ts) on two longer logs, 15–20 s each:
// 9090afbacec9 (Stagger breaks with moments inside their hold, hidden holds, tails) and 4d60e7fe92c2 (away stretches
// and a whole-game pause: pause-holds, enemy-away). A reader not handed the replay's `assume` fails here.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { defaultedReads } from "../helpers/readings.ts";

const data = loadGameData();

describe("assumption readers on longer logs", () => {
  for (const id of ["9090", "4d60"]) {
    it(`take the run's readings through a log's whole check (${id})`, () => {
      const { defaulted, reads } = defaultedReads(data, id);
      expect(reads).toBeGreaterThan(0);
      expect(defaulted, "read at their defaults though the run gave every reading: a reader not handed the run's `assume`").toEqual([]);
    }, 120_000);
  }
});
