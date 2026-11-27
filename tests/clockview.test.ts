// `zmdlogs clock` (packages/logs/src/clockview.ts): a kit buff's own clock in the replay against the log's run.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { CHECK_PAIR_MS, clockView, devFixtures, kitBuffCandidates, kitBuffClock, kitBuffKey, laneOfInstance, pairInstances, type BuffLane } from "@efsim/logs";

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

  it("pairs the check's instances with the own clock's by the nearest start, not the same frame (round 15: c4f3's 68.50 s against 72.30 s)", () => {
    const at = (start: number) => ({ start, first: null, own: null, ended: { at: null, how: "fight's end" } });
    const [a, b, c] = [at(68500), at(110970), at(153700)];
    const [x, y] = [at(72300), at(120770)];
    const { paired, unpaired } = pairInstances([a, b, c], [x, y]);
    expect(paired).toEqual([x, null, null]);
    expect(unpaired).toEqual([y]);
    expect(CHECK_PAIR_MS).toBe(5000);
  });
});

describe("pairing an instance with the log's run by value (round 16, arcane-will report point 2)", () => {
  it("pairs e82d's first Doubles Susceptibility with its own 0.1794 run, not Arcane's talent run under the same name", () => {
    const [e82d] = devFixtures({ ids: ["e82d"] });
    const rows = kitBuffClock(data, (e82d as NonNullable<typeof e82d>).fx, "chr_0032_lizhiyan:doubles_susceptibility");
    const first = rows.find((r) => Math.abs(r.start - 6900) < 100);
    expect(first?.values?.some((v) => Math.abs(v - 0.179399) < 1e-5)).toBe(true);
    // The refreshed run from 3.98 s (listed across the instance's start), not the talent's 0.197 run from 7.02 s.
    expect(first?.lane).toMatchObject({ since: 3983, byValue: true });
    expect(clockView(data, [e82d as NonNullable<typeof e82d>], "chr_0032_lizhiyan:doubles_susceptibility")).toMatch(/log since 3\.98, listed to 8\.56, next unlisted 8\.65 \(value 0\.179399, the instance's\)/);
  });

  it("keeps the rule by since where no value matches or none was traced", () => {
    const lane = (since: number, value: number, last: number): BuffLane => ({ buff: "b", source: "x", since, firstListed: since, lastListed: last, nextUnlisted: null, listedHits: 1, boundaryOnly: false, values: [value], hitters: ["x"] });
    const [a, b] = [lane(1000, 0.2, 5000), lane(3000, 0.1, 6000)];
    expect(laneOfInstance([a, b], 3000, Infinity, [0.2])).toEqual({ lane: a, byValue: true });
    expect(laneOfInstance([a, b], 3000, Infinity, [0.5])).toEqual({ lane: b, byValue: false });
    expect(laneOfInstance([a, b], 3000, Infinity)).toEqual({ lane: b, byValue: null });
  });
});

describe("kit buff keys by an owner's name (round 17, the away-statuses report point 2)", () => {
  it("reads the owner as an operator's name, an equipment buff's as its wearer's, and leaves ids and trace kinds", () => {
    expect(kitBuffKey(data, "Zhuang Fangyi:suit_expend_spell01.spell_dmg")).toBe("chr_0030_zhuangfy:suit_expend_spell01.spell_dmg");
    expect(kitBuffKey(data, "Arcane:wpn_funnel_0016.will_susc@Liino")).toBe("chr_0032_lizhiyan:wpn_funnel_0016.will_susc@Liino");
    expect(kitBuffKey(data, "chr_0030_zhuangfy:x")).toBe("chr_0030_zhuangfy:x");
    expect(kitBuffKey(data, "status:electrification")).toBe("status:electrification");
    expect(kitBuffKey(data, "suit_expend_spell01:spell_dmg")).toBe("suit_expend_spell01:spell_dmg");
  });

  it("names the team's keys with the id or its prefix in a refusal", () => {
    const names = { defs: new Map([["chr_0030_zhuangfy:suit_expend_spell01.spell_dmg", {}], ["chr_0032_lizhiyan:ultimate", {}]]) } as unknown as Parameters<typeof kitBuffCandidates>[0];
    expect(kitBuffCandidates(names, "suit_expend_spell01:spell_dmg")).toEqual(["chr_0030_zhuangfy:suit_expend_spell01.spell_dmg"]);
    expect(kitBuffCandidates(names, "Arcane:suit_expend_spell01.spell_dmg")).toEqual(["chr_0030_zhuangfy:suit_expend_spell01.spell_dmg"]);
    expect(kitBuffCandidates(names, "x:nothing")).toEqual([]);
  });
});
