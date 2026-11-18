// `efsim search --loop` as the CLI prints it (loopCommand: 45–60 s each alone, 2026-11-16): moved here from
// tests/search-loop.test.ts, where they set the default suite's wall time and ran into its timeout under load. The
// searches they print are checked there; here, that the text says what the search found. `npm run test:logs` runs them.
// The --sync one is in search-loop-cli-sync.test.ts, so the two (~2.5 min each) run in parallel.
import { describe, expect, it } from "vitest";
import { FPS, searchLoop } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { loopCommand, readScenario } from "../../packages/cli/src/simulate.ts";

const data = loadGameData();
// Under the data's Stagger length (engine assumption stagger-recovery=none): with the 2 s recovery (test 110,
// 2026-11-18) Laevatain alone settles into no exact loop within 12 rounds at beam 6 (her Stagger cycle no longer lines
// up with her ultimate's), and these tests are about the loop machinery, not the Stagger.
const read = readScenario(new URL("../../examples/laevatain-solo.scenario.json", import.meta.url).pathname);
const example = { ...read, options: { ...read.options, assume: { "stagger-recovery": "none" } } };
const { rotation: _r, ...open } = example;
const options = { beamWidth: 6, plays: 5 };

describe("opener and loop", () => {
  it("efsim search --loop prints the rounds, the loop and the total that simulate replays (the same again: deterministic)", () => {
    const r = searchLoop(data, open, options);
    const text = loopCommand(data, example, { beam: 6, loops: 5 });
    expect(text).toMatch(/Each round runs from Laevatain's ultimate/);
    expect(text).toMatch(/Loop: rounds \d+–\d+ play the same actions at the same times/);
    expect(text).toContain(`Opener and 5 plays of the loop: ${Math.round(r.total).toLocaleString("en-US")} damage in ${(r.frames / FPS).toFixed(1)} s`);
  });
});
