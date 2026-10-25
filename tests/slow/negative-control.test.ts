// Negative control for the log check: every verified fixture with each logged value scaled ×0.97 and ×1.03 must
// give (close to) no matches. A reading that still fits a scaled hit fits by chance: the check tries many readings per
// hit (docs/design.md, "What a log check verifies"), and this bounds how often that makes a match. The counts and
// the readings behind each chance match are printed. In `npm run test:logs`.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LogFixture } from "@efsim/data";
import { loadGameData } from "@efsim/data";
import { checkLog, readLogFixture } from "@efsim/cli";
import { logFixtures, ROOT } from "../logverdicts.ts";

const data = loadGameData();
const FACTORS = [0.97, 1.03];

/**
 * Chance matches allowed per fixture and factor: this share of its judged hits (at least 1). Measured 2026-10-24
 * (journal): 40d9 0 / 0, 4e5e 11 / 0 of 345, b7b3 0 / 0, bdf2 3 / 5 of 166 (×0.97 / ×1.03), from free counts the replay
 * now reads instead (MI Security's layers on Rossi's attack 4 in 4e5e; Corrosion levels in bdf2). 2026-10-25, with the
 * replay's facts (journal): 40d9 0 / 0, 4e5e 2 / 0, b7b3 0 / 0, bdf2 0 / 0: the bound tightened from 4% to 1%.
 */
const MAX_CHANCE_SHARE = 0.01;

/** The fixture with every logged damage value (and uncapped value) scaled by `k`, rounded as the log rounds. */
function scaled(fx: LogFixture, k: number): LogFixture {
  return { ...fx, hits: fx.hits.map((h) => ({ ...h, value: Math.round(h.value * k), ...(h.uncapped !== undefined ? { uncapped: Math.round(h.uncapped * k) } : {}) })) };
}

describe.each(logFixtures(""))("%s", (file) => {
  const fx = readLogFixture(join(ROOT, "fixtures", file));
  it.each(FACTORS)("×%s gives (close to) no matches", (k) => {
    const verdicts = checkLog(data, scaled(fx, k));
    const judged = verdicts.filter((v) => v.kind !== "uncovered" && !(v.kind === "unquantified" && v.reason !== "corrosion")).length;
    const matches = verdicts.flatMap((v) => (v.kind === "match" ? [v] : []));
    const lines = matches.map((m) => `  ${m.hit.operator} t=${m.hit.t} ${m.hit.event} [${m.class}, ${m.readings.matching} of ${m.readings.tried} readings]: ${m.assumed.join(", ") || "no assumption"}`);
    console.info(`negative control ${file} ×${k}: ${matches.length} chance match(es) of ${judged} judged hits${lines.length ? `\n${lines.join("\n")}` : ""}`);
    expect(matches.length, lines.join("\n")).toBeLessThanOrEqual(Math.max(1, Math.ceil(judged * MAX_CHANCE_SHARE)));
  });
});
