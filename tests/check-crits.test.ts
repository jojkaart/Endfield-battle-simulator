// Engine assumption check-crits (2026-11-26, low plain low mismatch round): where the log leaves a hit's crit out, the
// check's primary reading takes the crit the replay read from the log (replaycrits.ts; BuffReplay.critSource), and
// the other crit reading is the assumption. d572's Rossi ultimate stab at 59.10 s (14,670, crit not logged; a Seething
// Blood extra at its ms shows the crit) is plain under `replay`, an assumed `crit` under `none`.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, devFixtures, engineHits, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const ROSSI = "chr_0028_wulfa";
const fx = (devFixtures({ ids: ["d572"] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx;

const verdictAt = (assume: Record<string, string>) => {
  const replay = logBuffReplay(data, fx, undefined, { assume });
  const verdicts = checkLog(data, fx, { replay, engineHits: engineHits(data, fx, replay) });
  const v = verdicts.find((x) => x.hit.operator === ROSSI && x.hit.t === 59104 && x.hit.event === `${ROSSI}_ultimate_skill` && x.hit.value === 14670);
  return { v, source: v ? replay.replay.critSource(v.hit) : undefined };
};

describe("check-crits", () => {
  it("reads the replay's crit as plain under `replay`", () => {
    const { v, source } = verdictAt({});
    expect(source).toBe("shown");
    expect(v?.kind === "match" ? v.class : v?.kind).toBe("plain");
  });
  it("assumes the crit under `none`", () => {
    const { v } = verdictAt({ "check-crits": "none" });
    expect(v?.kind === "match" ? [v.class, v.assumptions.map((a) => a.kind)] : v?.kind).toEqual(["assumed", ["crit"]]);
  });
});
