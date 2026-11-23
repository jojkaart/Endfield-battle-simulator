// `zmdlogs clock` (packages/logs/src/clockview.ts): a kit buff's own clock in the replay against the log's run.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { clockView, devFixtures, kitBuffClock } from "@efsim/logs";

const data = loadGameData();
const AMP = "chr_0036_jsspsi:ultimate_amp";

describe("a kit buff's clock (zmdlogs clock)", () => {
  const logs = devFixtures({ ids: ["c779"] });
  const fx = (logs[0] as (typeof logs)[number]).fx;

  it("gives each instance its first and own expiry, how it ended, and the log's run", () => {
    const [row] = kitBuffClock(data, fx, AMP);
    expect(row).toBeDefined();
    const r = row as NonNullable<typeof row>;
    // Si's Amp lasts 12 s from its cast; the replay's own clock holds it by the stops after.
    expect(((r.first as number) - r.start) / 1000).toBeCloseTo(12, 1);
    expect(r.own as number).toBeGreaterThanOrEqual(r.first as number);
    expect(r.ended.how).toBe("ran out");
    expect(r.ended.at).toBeCloseTo(r.own as number, 0);
    expect(r.lane?.lastListed).toBeGreaterThan(r.own as number);
    expect(r.late?.real).toBeCloseTo((r.lane?.lastListed as number) - (r.own as number), 6);
    expect(r.check).not.toBeNull();
  });

  it("prints a row per instance and refuses a kit buff the team lacks", () => {
    expect(clockView(data, logs, AMP)).toMatch(/c779: 1 instance\(s\)\n\s+16\.\d\d {2}first .* own .* ended .* ran out; check .*; log since/);
    expect(() => kitBuffClock(data, fx, "chr_0036_jsspsi:no_such_buff")).toThrow(/no kit buff/);
  });
});
