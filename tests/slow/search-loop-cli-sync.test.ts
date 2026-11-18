// `efsim search --loop --sync` as the CLI prints it (the plain loop: search-loop-cli.test.ts; apart so they run in
// parallel) (loopCommand: 45–60 s each alone, 2026-11-16): moved here from
// tests/search-loop.test.ts, where they set the default suite's wall time and ran into its timeout under load. The
// searches they print are checked there; here, that the text says what the search found. `npm run test:logs` runs them.
import { describe, expect, it } from "vitest";
import { FPS, searchLoop } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { loopCommand, readScenario } from "../../packages/cli/src/simulate.ts";

const data = loadGameData();
// Under the data's Stagger length and the buff rule before 2026-11-18 (engine assumptions stagger-recovery=none,
// buff-in-stop=runs): with the 2 s Stagger recovery (test 110) or Twilight held by her own stop (tests 18, 21),
// Laevatain alone settles into no exact loop within 12 rounds at beam 6; these tests are about the loop machinery.
const read = readScenario(new URL("../../examples/laevatain-solo.scenario.json", import.meta.url).pathname);
const example = { ...read, options: { ...read.options, assume: { "stagger-recovery": "none", "buff-in-stop": "runs" } } };
const { rotation: _r, ...open } = example;
const options = { beamWidth: 6, plays: 5 };

describe("synchronized burst rounds (--sync)", () => {
  it("efsim search --loop --sync says how rounds are cut and what holding cost", () => {
    const r = searchLoop(data, open, { ...options, sync: true });
    const text = loopCommand(data, example, { beam: 6, loops: 5, sync: true });
    expect(text).toMatch(/Each round runs from a moment every ultimate is ready \(Laevatain\)/);
    expect(text).toMatch(/Ultimate energy lost at full bars while held, a play \(\+ lost otherwise to full bars\): Laevatain \d+/);
    expect(text).toContain(`${Math.round(r.total).toLocaleString("en-US")} damage in ${(r.frames / FPS).toFixed(1)} s`);
  });
});
