// `efsim search --loop` as the CLI prints it (loopCommand: 45–60 s each alone, 2026-11-16): moved here from
// tests/search-loop.test.ts, where they set the default suite's wall time and ran into its timeout under load. The
// searches they print are checked there; here, that the text says what the search found. `npm run test:logs` runs them.
import { describe, expect, it } from "vitest";
import { FPS, searchLoop } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { loopCommand, readScenario } from "../../packages/cli/src/simulate.ts";

const data = loadGameData();
const example = readScenario(new URL("../../examples/laevatain-solo.scenario.json", import.meta.url).pathname);
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

describe("synchronized burst rounds (--sync)", () => {
  it("efsim search --loop --sync says how rounds are cut and what holding cost", () => {
    const r = searchLoop(data, open, { ...options, sync: true });
    const text = loopCommand(data, example, { beam: 6, loops: 5, sync: true });
    expect(text).toMatch(/Each round runs from a moment every ultimate is ready \(Laevatain\)/);
    expect(text).toMatch(/Ultimate energy lost at full bars while held, a play \(\+ lost otherwise to full bars\): Laevatain \d+/);
    expect(text).toContain(`${Math.round(r.total).toLocaleString("en-US")} damage in ${(r.frames / FPS).toFixed(1)} s`);
  });
});
