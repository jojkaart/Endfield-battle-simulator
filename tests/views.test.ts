// The log check's diagnosis views (packages/logs/src/views.ts: `efsim zmdlogs casts | replay | stagger | differences |
// groups`): the placement and replay listed in time order, Stagger runs, and hit records grouped by cause.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { castsView, differencesReport, fallbackGroups, groupsReport, logBuffReplay, loggedCastFates, readLogFixture, replayView, staggerSummary, staggerView, type HitRecord, type StaggerRun } from "@efsim/logs";
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

  it("marks a hit credited to another skill (poise.origin) and a time many hits share (batched)", () => {
    // 0eef: Si's Inksoul burst at 10.03 s, credited to her battle skill 2.
    expect(castsView(data, fx, { from: 10000, to: 10100 })).toMatch(/HIT {4}Si normal_skill_inkmove_2 \d+ → .* \(origin normal_skill_2\)/);
    const t = [...new Set(fx.hits.map((h) => h.t))].find((x) => fx.hits.filter((h) => h.t === x).length > 3);
    if (t !== undefined) expect(castsView(data, fx, { from: t, to: t })).toMatch(/\[batched: \d+ hits at this ms\]/);
  });

  it("db87's casts view has the replay's stops, Laevatain's ultimate from its cast event marked", () => {
    const db87 = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-db8711232de9.json"));
    expect(castsView(data, db87, { from: 16000, to: 17000 })).toMatch(/STOP {3}Laevatain ultimate_skill 16\.\d\d–\d+\.\d\d s .*\[no placed hits/);
  });

  it("marks each replay landing with the logged hit it stands for or as the replay's own", () => {
    const text = replayView(data, fx, { from: 3000, to: 5000 });
    expect(text).toMatch(/LAND .* = logged \S+ \d+ at \d+\.\d\d/);
    const op = fx.team[0]?.operator as string;
    const only = replayView(data, fx, { operators: [op] });
    expect(only.split("\n").slice(1).every((l) => l.includes(data.operators[op]?.name ?? op) || /STAGGER/.test(l))).toBe(true);
  });

  it("says what the replay made of each of the log's cast events (EVENT lines)", () => {
    // a7a7: Arcane's INT lasers' events at 42.13 and 48.89 s are ticks of her Imprisonment, not her combo's own events.
    const pending = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-a7a7a40c97ed.json"));
    const fates = loggedCastFates(data, pending);
    expect(fates).toHaveLength(pending.casts?.length ?? 0);
    const laser = fates.find((e) => e.operator === "chr_0032_lizhiyan" && Math.abs(e.t - 42128) < 5);
    expect(laser).toMatchObject({ fate: "tick", buff: "imprisonment" });
    expect(fates.some((e) => e.fate === "placed" && e.cast !== undefined && e.cast.world >= 0)).toBe(true);
    expect(replayView(data, pending, { from: 42000, to: 42300 })).toMatch(/EVENT {2}Arcane combo_skill \(the log's cast event\): a tick of imprisonment/);
  });

  it("flags casts made against the kit and traces a kit buff's expiry step by step", () => {
    const pending = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-9c0bb09daff2.json"));
    // A cast its kit makes unavailable (9c0b: Camille's combo_skill_2 at 12.70 s; a7a7, used here before, has none since Si's strokes are read from the log, 2026-11-23).
    const { replay } = logBuffReplay(data, pending);
    expect(replay.castFlags.some((x) => x.kind === "forced")).toBe(true);
    // A legal interrupt that cancels the running cast's pending hits is CUTS, not INSIDE (round 8: INSIDE counted the
    // wait for the cast's own hits too; 9c0b's one INSIDE was such a cut).
    expect(replay.castFlags.some((x) => x.kind === "cuts")).toBe(true);
    expect(replay.castFlags.some((x) => x.kind === "inside")).toBe(false);
    expect(replayView(data, pending)).toMatch(/\d+ cast\(s\) FORCED .*\n[\s\S]*FORCED .* made against its kit: its kit makes it unavailable then/);
    expect(replayView(data, pending)).toMatch(/CUTS {3}\S+ \S+: cuts \d+ pending hit\(s\) of \S+ \(its own hits due until \d+\.\d\d s\): an interrupt the kit allows/);
    // 0eef: its INSIDE flags are casts inside uncuttable frames (the gates alone).
    expect(logBuffReplay(data, fx).replay.castFlags.filter((x) => x.kind === "inside").length).toBeGreaterThan(0);
    const laev = readLogFixture(join(ROOT, "fixtures/zmdlogs-40d9a3c1da37.json"));
    const text = replayView(data, laev, { trace: ["chr_0016_laevat:twilight"], to: 20000 });
    expect(text).toMatch(/TRACE {2}chr_0016_laevat:twilight from 3\.03: expiry none → \d+\.\d\d s at cast chr_0016_laevat_ultimate_skill/);
    expect(text).toMatch(/TRACE .* \(\+\d+ frames\) at /);
    // Tracing doesn't change the replay.
    const plain = logBuffReplay(data, laev).replay;
    const traced = logBuffReplay(data, laev, undefined, { trace: ["chr_0016_laevat:twilight"] }).replay;
    expect(traced.traces.length).toBeGreaterThan(0);
    expect(traced.hits.map((h) => h.damage)).toEqual(plain.hits.map((h) => h.damage));
  });

  it("gives a log's Stagger runs and a summary", () => {
    expect(staggerView(data, fx)).toMatch(/logged Stagger run/);
    // Each run's Finisher and enhanced basic attacks (test 108): f879's first Stagger has Twilight attacks and no
    // Finisher, its second the Finisher 0.46 s after the last of them.
    const f879 = staggerView(data, readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-f8793bc8aea2.json")));
    expect(f879).toMatch(/no Finisher, Laevatain's enhanced basic hits 9 \(58\.24–70\.06\)/);
    expect(f879).toMatch(/Finisher 126\.00 \(Laevatain\), Laevatain's enhanced basic hits 7 \(118\.81–125\.54\)/);
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
    expect(text).toContain("Matches only by the log's listing (fallback): none");
  });

  it("groups the fallback matches by skill event with their median logged ÷ primary", () => {
    const base = records[0] as HitRecord;
    const fb = [1.5, 1.5, 1.4].map((q, i): HitRecord => ({ ...base, operator: "p", event: "chr_0001_test_combo_skill", class: "fallback", verdict: "match", value: Math.round(1000 * q), predicted: 1000, t: i }));
    const lines = fallbackGroups(fb);
    expect(lines[0]).toMatch(/^Matches only by the log's listing .*3 by skill event/);
    expect(lines[1]).toMatch(/3 {2}combo_skill {2}median logged ÷ primary ×1\.500/);
  });
});
