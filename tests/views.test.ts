// The log check's diagnosis views (packages/logs/src/views.ts: `efsim zmdlogs casts | replay | stagger | differences |
// groups`): the placement and replay listed in time order, Stagger runs, and hit records grouped by cause.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { castsView, differencesReport, groupsReport, readLogFixture, replayView, staggerSummary, staggerView, type HitRecord, type StaggerRun } from "@efsim/logs";
import { ROOT } from "./logverdicts.ts";

const data = loadGameData();
const fx = readLogFixture(join(ROOT, "fixtures/zmdlogs-0eef2474a26f.json"));

describe("the placement and replay views", () => {
  it("lists hits with their placed casts, cast events and casts in time order, within the window", () => {
    const text = castsView(data, fx, { from: 3000, to: 6000 });
    const times = text.split("\n").slice(1).map((l) => Number(l.trim().split(/\s+/)[0]));
    expect(times.length).toBeGreaterThan(10);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.every((t) => t >= 3 && t <= 6)).toBe(true);
    expect(text).toMatch(/HIT {4}\S+ .* → .*@\d+\.\d\d #\d+ frame \d+/);
    expect(text).toMatch(/CAST {3}/);
    expect(text).toMatch(/EVENT {2}/);
  });

  it("marks each replay landing with the logged hit it stands for or as the replay's own", () => {
    const text = replayView(data, fx, { from: 3000, to: 5000 });
    expect(text).toMatch(/LAND .* = logged \S+ \d+ at \d+\.\d\d/);
    const op = fx.team[0]?.operator as string;
    const only = replayView(data, fx, { operators: [op] });
    expect(only.split("\n").slice(1).every((l) => l.includes(data.operators[op]?.name ?? op) || /STAGGER/.test(l))).toBe(true);
  });

  it("gives a log's Stagger runs and a summary", () => {
    expect(staggerView(data, fx)).toMatch(/logged Stagger run/);
    const runs: StaggerRun[] = [
      { start: 1000, last: 5000, next: 5200, replay: [{ start: 900, end: 4000 }], engineEnd: 4000, engineCut: null, dealt: 50 },
      { start: 9000, last: 12000, next: null, replay: [], engineEnd: "none", engineCut: null, dealt: 10 },
    ];
    expect(staggerSummary(runs)).toBe("2 logged Stagger runs: the engine's own ran short in 1 (shortfall quartiles 1.00 1.00 1.00 s), had none running in 0, and the replay had no window at all in 1");
  });
});

const record = (o: Partial<HitRecord> & Pick<HitRecord, "operator" | "t" | "value" | "predicted" | "class">): HitRecord => ({
  fixture: "fx1",
  event: "chr_0001_test_attack1",
  kind: "skill",
  crit: false,
  verdict: o.class === "mismatch" ? "mismatch" : "match",
  error: o.predicted ? o.value / o.predicted - 1 : null,
  listed: [],
  landing: { frame: 0, operator: o.operator, skillId: "s", hitId: "h", exact: o.predicted ?? 0, scaleParts: [], zones: {} as never, modifiers: [] },
  ...o,
});

describe("hit records grouped by cause", () => {
  const stagger = { what: "Stagger", kind: "log" as const, engine: [], log: ["buff_common_poise_break_damage_taken_scale"] };
  const records = [
    record({ operator: "a", t: 1000, value: 130, predicted: 100, class: "mismatch", differences: [stagger] }),
    record({ operator: "a", t: 2000, value: 131, predicted: 100, class: "mismatch", differences: [stagger] }),
    record({ operator: "a", t: 3000, value: 100, predicted: 100, class: "plain" }),
    record({ operator: "b", t: 3500, value: 120, predicted: 100, class: "mismatch" }),
    record({ operator: "a", t: 3600, value: 120, predicted: 100, class: "mismatch" }),
  ];

  it("groups the differences with the damage's ratio, hits without one as the baseline", () => {
    const text = differencesReport(records);
    expect(text).toMatch(/Stagger \| log only +2 hits +2 mismatches +ratio 1\.300 1\.300 1\.300/);
    expect(text).toMatch(/\(no difference\) +3 hits +2 mismatches/);
    expect(differencesReport(records, { what: /Link/ })).not.toMatch(/Stagger/);
  });

  it("sorts an operator's mismatches into team-wide and own, by event and by difference", () => {
    const text = groupsReport(records, "a");
    expect(text).toMatch(/^a: 4 hits in 1 logs, 3 mismatches: 1 team-wide .*, 0 without a landing, 2 own/);
    expect(text).toMatch(/2 {2}attack {2}median ratio 1\.300/);
    expect(text).toMatch(/2 {2}Stagger \(log only\) {2}median ratio 1\.300/);
  });
});
