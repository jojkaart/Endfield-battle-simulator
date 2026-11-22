// `efsim zmdlogs hits` (packages/logs/src/hitexport.ts): one record per logged hit, with the same verdicts and primary
// readings as the log check, and the reading's parts that analyses across logs need.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, engineHits, logBuffReplay, readLogFixture, verdictCounts } from "@efsim/cli";
import { filterRecords, formatRecord, hitRecords } from "../packages/logs/src/hitexport.ts";
import { devFixtures, readDevFixture, resolveFixture, shortId } from "../packages/logs/src/logs.ts";
import { ROOT } from "./logverdicts.ts";

const data = loadGameData();
const file = "fixtures/zmdlogs-0eef2474a26f.json";
const fx = readLogFixture(join(ROOT, file));
const records = hitRecords(data, fx, file);

describe("per-hit records of the log check", () => {
  it("has one record per logged hit, with the check's verdict classes and primary readings", () => {
    expect(records).toHaveLength(fx.hits.length);
    const replay = logBuffReplay(data, fx);
    const byHit = engineHits(data, fx, replay);
    const counts = verdictCounts(fx, checkLog(data, fx, { replay, engineHits: byHit }));
    const mine: Record<string, Record<string, number>> = {};
    for (const r of records) (mine[r.operator] ??= {})[r.class] = (mine[r.operator]?.[r.class] ?? 0) + 1;
    for (const [op, c] of Object.entries(counts)) for (const [k, n] of Object.entries(c)) if (n) expect(mine[op]?.[k], `${op} ${k}`).toBe(n);
    fx.hits.forEach((h, i) => {
      const p = byHit.get(h)?.primary;
      if (p !== null && p !== undefined) expect(records[i]?.predicted).toBe(p);
    });
  });

  it("gives the reading the verdict rests on beside the primary (verdictReading, verdictError)", () => {
    for (const r of records) {
      if (r.verdict === "match") expect(Math.abs(r.value - (r.verdictReading as number)), `${r.t} ${r.event}`).toBeLessThanOrEqual(1);
      if (r.verdict === "uncovered") expect(r.verdictReading).toBeNull();
      if (r.verdictReading) expect(r.verdictError).toBeCloseTo(r.value / r.verdictReading - 1, 9);
    }
  });

  it("gives a plain match's reading with its scale parts, zones and modifier sources, a status hit's reaction, a kit hit's enemy statuses", () => {
    const plain = records.find((r) => r.class === "plain" && r.landing);
    expect(plain?.landing?.scaleParts.length).toBeGreaterThan(0);
    expect(plain?.landing?.zones.atk).toBeGreaterThan(0);
    expect(plain?.landing?.modifiers.some((m) => m.source.startsWith("stat panel"))).toBe(true);
    expect(Math.round(plain?.landing?.exact ?? 0)).toBe(plain?.predicted);
    const status = records.find((r) => r.kind !== "skill" && r.landing);
    expect(status?.landing?.reaction).toBeDefined();
    const kit = records.find((r) => r.kind === "skill" && r.landing?.enemy?.length);
    expect(kit?.landing?.enemy?.[0]).toMatchObject({ level: expect.any(Number), operator: expect.any(String), artsIntensity: expect.any(Number) });
    const s = kit?.landing?.enemy?.[0];
    expect(s?.appliedAtMs).toBeCloseTo(((s?.appliedAt ?? 0) * 1000) / 30, 6);
  });

  it("gives the log's listing beside the engine's side, and where they disagree", () => {
    fx.hits.forEach((h, i) => expect(records[i]?.listed.length).toBe(new Set(h.effects.map((e) => e.buff)).size));
    const differing = records.filter((r) => r.differences?.length);
    expect(differing.length).toBeGreaterThan(0);
    expect(differing.every((r) => r.kind === "skill" && r.landing && r.differences?.every((d) => ["engine", "log", "values"].includes(d.kind)))).toBe(true);
  });

  it("filters by kind and operator, and prints JSON lines or a row", () => {
    expect(filterRecords(records, { kind: "skill" }).every((r) => r.kind === "skill")).toBe(true);
    const op = records[0]?.operator as string;
    expect(filterRecords(records, { operators: [op] }).every((r) => r.operator === op)).toBe(true);
    const r = records[0] as (typeof records)[number];
    expect(JSON.parse(formatRecord(r, true))).toEqual(JSON.parse(JSON.stringify(r)));
    expect(formatRecord(r, false)).toContain(`logged ${r.value}`);
  });

  it("gives the log's reading: the kit buffs as the log lists them, the same as the primary where the two agree", () => {
    const agree = records.filter((r) => r.landing && !r.differences?.length && r.logReading !== undefined && r.logReading !== null);
    expect(agree.length).toBeGreaterThan(0);
    expect(agree.filter((r) => r.logReading === r.predicted).length / agree.length).toBeGreaterThan(0.95);
    const differing = records.filter((r) => r.differences?.some((d) => d.kind !== "values") && r.logReading);
    expect(differing.some((r) => r.logReading !== r.predicted)).toBe(true);
    for (const r of records) if (r.logReading) expect(r.logError).toBeCloseTo(r.value / r.logReading - 1, 9);
    const r = records.find((x) => x.logReading) as (typeof records)[number];
    expect(formatRecord(r, false, "log")).toContain(`log reading ${r.logReading}`);
  });

  it("filters by the logged event key", () => {
    const ev = records[0]?.event as string;
    const kept = filterRecords(records, { event: new RegExp(`^${ev}$`) });
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.every((x) => x.event === ev)).toBe(true);
  });

  it("refuses a hold-out fixture", () => {
    expect(() => readDevFixture(join(ROOT, "fixtures/holdout/zmdlogs-anything.json"))).toThrow(/hold-out/);
  });
});

describe("fixture arguments", () => {
  it("takes a path, or a log's id or the start of it among the development logs", () => {
    expect(resolveFixture(join(ROOT, file))).toBe(join(ROOT, file));
    expect(resolveFixture("0eef")).toBe(join(ROOT, file));
    expect(resolveFixture("zmdlogs-0eef2474")).toBe(join(ROOT, file));
    expect(readDevFixture("0eef").id).toBe(fx.id);
    expect(shortId(fx.id)).toBe("0eef");
    expect(() => resolveFixture("0e")).toThrow(/four characters/);
    expect(() => resolveFixture("zzzz")).toThrow(/no development log/);
  });

  it("loads the development logs for a scan, never a hold-out", () => {
    const all = devFixtures();
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((d) => !d.file.includes("/holdout/") && (d.dir === "verified" || d.dir === "pending"))).toBe(true);
    expect(all.find((d) => d.short === "0eef")?.fx.id).toBe(fx.id);
    const op = fx.team[0]?.operator as string;
    expect(devFixtures({ withOperators: [op] }).every((d) => d.fx.team.some((b) => b.operator === op))).toBe(true);
    expect(devFixtures({ ids: ["0eef"] }).map((d) => d.id)).toEqual([fx.id]);
  });
});
