// The safe development-log lister (`efsim zmdlogs list`, packages/cli/src/logs.ts listLogs) and the hold-out guard.
import { describe, expect, it } from "vitest";
import { listLogs, logFixtureFiles, readLogSplit, refuseHoldout } from "../packages/cli/src/logs.ts";

describe("the development-log lister", () => {
  it("lists every development log and never a hold-out", () => {
    const { holdout } = readLogSplit();
    const logs = listLogs();
    expect(logs.length).toBe(logFixtureFiles().length);
    expect(logs.some((l) => holdout.has(l.id))).toBe(false);
    expect(logs.every((l) => !l.file.startsWith("fixtures/holdout"))).toBe(true);
  });

  it("keeps only logs with every operator asked for, by id or by name", () => {
    const names = (op: string) => ({ chr_0036_jsspsi: "Si", chr_0032_lizhiyan: "Arcane" })[op];
    const withSi = listLogs({ withOperators: ["chr_0036_jsspsi"] });
    expect(withSi.length).toBeGreaterThan(0);
    expect(withSi.every((l) => l.team.some((t) => t.operator === "chr_0036_jsspsi"))).toBe(true);
    const both = listLogs({ withOperators: ["si", "ARCANE"], names });
    expect(both.length).toBeGreaterThan(0);
    expect(both.length).toBeLessThanOrEqual(withSi.length);
    expect(both.every((l) => l.team.some((t) => t.operator === "chr_0032_lizhiyan"))).toBe(true);
  });

  it("lists one directory when asked", () => {
    const verified = listLogs({ dirs: ["verified"] });
    expect(verified.length).toBeGreaterThan(0);
    expect(verified.every((l) => l.dir === "verified" && /^fixtures\/zmdlogs-/.test(l.file))).toBe(true);
  });
});

describe("the hold-out guard", () => {
  it("refuses a hold-out's id, whole or as a battle-id prefix, and lets a development log through", () => {
    const [h] = readLogSplit().holdout;
    const [d] = readLogSplit().development;
    expect(() => refuseHoldout(h as string)).toThrow(/hold-out/);
    expect(() => refuseHoldout((h as string).slice("zmdlogs-".length))).toThrow(/hold-out/);
    expect(() => refuseHoldout(d as string)).not.toThrow();
  });
});
