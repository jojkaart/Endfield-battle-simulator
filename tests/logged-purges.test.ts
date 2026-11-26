// Engine assumption logged-purges (packages/logs holdinputs.ts loggedPurges, purgedByLog): where the log shows the
// enemy shedding all of the team's debuffs at once (Hard 33's slug at its phase changes), the log check's replay ends
// the enemy-side kit buffs there.
import { describe, expect, it } from "vitest";
import { FPS } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { loggedPurges } from "@efsim/logs";
import { logBuffReplay, readLogFixture } from "@efsim/cli";

const data = loadGameData();
const slug = readLogFixture(new URL("../fixtures/pending/zmdlogs-63398339803e.json", import.meta.url).pathname);
const rhodagn = readLogFixture(new URL("../fixtures/pending/zmdlogs-e82d45c46040.json", import.meta.url).pathname);
const ms = (f: number) => (f * 1000) / FPS;

describe("logged purges", () => {
  it("are read where none of the team's debuffs on the enemy listed at a moment is listed again (6339: the slug's 10.35 and 29.38 s)", () => {
    expect(loggedPurges(slug).map((f) => Math.round(ms(f)))).toEqual([10367, 29400]);
  });

  it("aren't read where one operator's debuff alone ends (e82d: Arcane's Doubles Susceptibility before Si's combo final, her other debuffs listed on)", () => {
    expect(loggedPurges(rhodagn)).toEqual([]);
  });

  it("end the enemy-side kit buffs there: Arcane's Doubles Susceptibility from 6.25 s ends after the last hit listing it (10.35 s), not at its own end (logged-purges none)", () => {
    const end = (assume?: Record<string, string>) => logBuffReplay(data, slug, assume ? { assume } : {}).replay.kitWindows("chr_0032_lizhiyan:doubles_susceptibility", "chr_0032_lizhiyan").find((w) => w.start < 7000)?.end;
    expect(end() ?? 0).toBeGreaterThan(10349);
    expect(end() ?? Infinity).toBeLessThanOrEqual(10400);
    expect(end({ "logged-purges": "none" }) ?? 0).toBeGreaterThan(10800);
  });
});
