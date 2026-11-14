// Si's Artful Intent burst valued from the logged hits it recorded (packages/cli/src/recordedburst.ts; docs/design.md
// "What a log check verifies"): ink_damage_rate × every logged hit on the target from the battle-skill hit
// (inclusive) to the record's end, which the log doesn't have (each logged time up to RECORD_END_LAG_MS before the
// burst is a reading). Synthetic logs with Si's build from zmdlogs-0eef2474a26f (P5, battle skill 12: rate 0.20),
// and that log's own burst.
import { describe, expect, it } from "vitest";
import { loadGameData, type LogFixture, type LogHit } from "@efsim/data";
import { checkLog, readLogFixture, RECORD_END_LAG_MS, recordedBurst } from "@efsim/cli";
import { computeStats, type Build } from "@efsim/engine";

const data = loadGameData();
const SI = "chr_0036_jsspsi";
const real = readLogFixture(new URL("../fixtures/zmdlogs-0eef2474a26f.json", import.meta.url).pathname);
const si = real.team.find((b) => b.operator === SI) as Build;
const START = `${SI}_normal_skill_abilityrange_1`;
const BURST = `${SI}_normal_skill_inkmove_2`;
const MARK = `${SI}_normal_skill_inkmark_projhit`;

const logHit = (t: number, event: string, value: number, extra: Partial<LogHit> = {}): LogHit => ({ t, operator: SI, event, value, crit: false, element: "cryst", effects: [], boundaryEffects: [], unquantified: [], ...extra });
const fixture = (hits: LogHit[], team: Build[] = [si]): LogFixture => ({
  id: "synthetic",
  description: "synthetic log",
  provenance: { source: "test", url: "test", battleId: "test", parserVersion: "test", inGame: true, measured: "test", verifiedAgainst: {}, notes: [] },
  enemy: real.enemy,
  team,
  hits,
});
const member = (b: Build = si) => ({ build: b, panel: computeStats(data, b) });

// A window: the battle-skill hit at 1000 ms, hits by anyone (a status tick too), a hit 400 ms before the burst, the burst at 10000 ms.
const windowHits = [
  logHit(500, `${SI}_attack1`, 7777), // before the window
  logHit(1000, START, 10000),
  logHit(4000, `${SI}_attack2`, 20000, { uncapped: 30000 }),
  logHit(6000, "buff_common_burning_status", 5000, { operator: "chr_0016_laevat" }),
  logHit(9600, `${SI}_attack3`, 1000),
];
const recorded = 10000 + 30000 + 5000; // to 6000 ms; 46000 with the 9600 ms hit

describe("recordedBurst: the window and its readings", () => {
  it("starts at the battle-skill hit (counted), counts everyone's hits (uncapped values), reads each end", () => {
    const b = recordedBurst(data, fixture([...windowHits, logHit(10000, BURST, 1)]), member(), logHit(10000, BURST, 1));
    if ("unknown" in b) throw new Error(b.unknown);
    expect(b.start.t).toBe(1000);
    expect(b.rate).toBeCloseTo(0.2, 6);
    expect(b.buff).toBe("artful_intent");
    // The 9600 ms hit (400 ms before) is in range; the next end (6000 ms, 4000 ms before) is the latest before it.
    expect(b.readings.map((r) => [r.last, r.lag, r.counted, r.recorded])).toEqual([[9600, 400, 4, recorded + 1000], [6000, 4000, 3, recorded]]);
    expect(b.readings[0]?.predicted).toBe(Math.round(b.rate * (recorded + 1000)));
    expect(b.readings[0]?.tolerance).toBeCloseTo(1 + 0.5 * b.rate * 4, 6);
    expect(RECORD_END_LAG_MS).toBe(1000);
  });

  it("leaves out earlier bursts (Fixed DMG isn't recorded), and reads hits logged at the start's ms before it both ways", () => {
    const hits = [logHit(1000, "chr_0016_laevat_attack1", 900, { operator: "chr_0016_laevat" }), ...windowHits.slice(1), logHit(5000, MARK, 99999), logHit(10000, BURST, 1)];
    const b = recordedBurst(data, fixture(hits), member(), hits.at(-1) as LogHit);
    if ("unknown" in b) throw new Error(b.unknown);
    expect(b.readings.map((r) => [r.last, r.withoutEarly ?? 0, r.recorded])).toEqual([
      [9600, 0, recorded + 1000 + 900], [9600, 1, recorded + 1000], [6000, 0, recorded + 900], [6000, 1, recorded],
    ]);
  });

  it("the rate is the build's: 0.13 at P0, 0.20 from P1 (battle skill 12), lower at a lower skill level", () => {
    const rate = (b: Build) => {
      const r = recordedBurst(data, fixture([...windowHits, logHit(10000, BURST, 1)], [b]), member(b), logHit(10000, BURST, 1));
      return "unknown" in r ? NaN : r.rate;
    };
    expect(rate({ ...si, potential: 0 })).toBeCloseTo(0.13, 6);
    expect(rate({ ...si, potential: 1 })).toBeCloseTo(0.2, 6);
    // zmdlogs-abfd4b7478ec (P0, battle skill 10) and -0c14fb3ce77d (P1, 9): their bursts fit 0.11 and 0.17.
    expect(rate({ ...si, potential: 0, skillLevels: { ...si.skillLevels, battle: 10 } })).toBeCloseTo(0.11, 6);
    expect(rate({ ...si, potential: 1, skillLevels: { ...si.skillLevels, battle: 9 } })).toBeCloseTo(0.17, 6);
  });

  it("unknown without a logged battle-skill hit before the burst, and in a multi-target log", () => {
    expect(recordedBurst(data, fixture([logHit(10000, BURST, 1)]), member(), logHit(10000, BURST, 1))).toHaveProperty("unknown");
    const multi = windowHits.map((h) => ({ ...h, target: "eny_a" }));
    expect(recordedBurst(data, fixture([...multi, logHit(10000, BURST, 1, { target: "eny_a" })]), member(), logHit(10000, BURST, 1, { target: "eny_a" }))).toHaveProperty("unknown");
  });
});

describe("the log check judges the burst", () => {
  const verdict = (value: number, extra: Partial<LogHit> = {}, after: LogHit[] = []) => {
    const burst = logHit(10000, BURST, value, extra);
    const v = checkLog(data, fixture([...windowHits, burst, ...after]), { buffs: "log" });
    return v.find((x) => x.hit === burst);
  };

  it("a match is assumed: the record's end, as data", () => {
    const v = verdict(Math.round(0.2 * recorded));
    expect(v).toMatchObject({ kind: "match", class: "assumed", predicted: Math.round(0.2 * recorded), readings: { tried: 2, matching: 1 } });
    if (v?.kind !== "match") return;
    expect(v.assumptions).toEqual([expect.objectContaining({ kind: "recordEnd", n: 4000, buffs: ["artful_intent"] })]);
    expect(v.assumed[0]).toContain("ending 4000 ms before its burst");
  });

  it("within ±1 and ±0.5 × rate per counted hit (the logged values are rounded); outside, a mismatch with the readings' values", () => {
    expect(verdict(Math.round(0.2 * recorded) + 1)).toMatchObject({ kind: "match" }); // 3 hits: ±1.3
    expect(verdict(Math.round(0.2 * recorded) + 2)).toMatchObject({ kind: "mismatch" });
    const v = verdict(Math.round(0.2 * recorded) + 50);
    expect(v).toMatchObject({ kind: "mismatch", predicted: [Math.round(0.2 * recorded), Math.round(0.2 * (recorded + 1000))], readings: { tried: 2, matching: 0 } });
  });

  it("the killing blow that fits no reading stays unquantified (its uncapped value is the log's estimate)", () => {
    expect(verdict(100, { uncapped: 99999 })).toMatchObject({ kind: "unquantified", reason: "killingBlow" });
    // One that fits is a match.
    expect(verdict(100, { uncapped: Math.round(0.2 * recorded) })).toMatchObject({ kind: "match", class: "assumed" });
  });

  it("without its window's start, Fixed DMG stays unquantified", () => {
    const burst = logHit(10000, BURST, 5);
    expect(checkLog(data, fixture([burst]), { buffs: "log" })[0]).toMatchObject({ kind: "unquantified", reason: "fixedDamage" });
  });

  it("zmdlogs-0eef2474a26f's burst at 10030 ms: the 55 hits from 2476 to 9331 ms × 0.20", () => {
    const burst = real.hits.find((h) => h.event === BURST) as LogHit;
    const b = recordedBurst(data, real, member(), burst);
    if ("unknown" in b) throw new Error(b.unknown);
    const fit = b.readings.find((r) => Math.abs(r.predicted - (burst.uncapped ?? burst.value)) <= r.tolerance);
    expect(fit).toMatchObject({ last: 9331, lag: 699, counted: 55, predicted: 301680 });
    expect(burst.value).toBe(301679);
  });
});
