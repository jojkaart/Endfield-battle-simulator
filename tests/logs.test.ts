// Log fixtures: every logged hit a kit covers must reproduce exactly.
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData, sourceCommit, SOURCES } from "@efsim/data";
import { checkLog, readLogFixture } from "@efsim/cli";

const dir = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "fixtures");
const data = loadGameData();
const files = readdirSync(dir).filter((f) => f.startsWith("zmdlogs-") && f.endsWith(".json")).sort();

describe.each(files)("%s", (file) => {
  const fx = readLogFixture(join(dir, file));

  it("was verified against the current data commits", () => {
    expect(fx.provenance.verifiedAgainst).toEqual(Object.fromEntries(SOURCES.map((s) => [s, sourceCommit(s)])));
  });

  it("every covered hit matches the log (±1)", () => {
    const verdicts = checkLog(data, fx);
    const mismatches = verdicts
      .filter((v) => v.kind === "mismatch")
      .map((v) => `${v.hit.operator} t=${v.hit.t} ${v.hit.event} logged ${v.hit.uncapped ?? v.hit.value}${v.kind === "mismatch" ? ` predicted ${v.predicted.join("/")}` : ""}`);
    expect(mismatches).toEqual([]);
    // Operators with a kit must have at least one hit verified in each fixture they're in.
    for (const b of fx.team) {
      if (!data.kits.operators[b.operator]) continue;
      const mine = verdicts.filter((v) => v.hit.operator === b.operator);
      if (mine.some((v) => v.kind !== "uncovered" && v.kind !== "unquantified")) expect(mine.some((v) => v.kind === "match")).toBe(true);
    }
  });
});
