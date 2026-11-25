// What one replay records for the views (packages/logs/src/replayrecord.ts, improvement round 8): a kit window's chain
// (the instance an application replaced), enemy-status traces keyed by applier, the slow-downs the timeline applied
// against the log tools' stop list, the crit each landing took and its source, and the simulated total's parts.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { formatRecord, hitRecords, holdsView, logBuffReplay, readLogFixture, replayTimeStops, replayView, stopsAgainstList, stopsView, totalsView, type AppliedStop } from "@efsim/logs";
import { ROOT } from "./logverdicts.ts";

const data = loadGameData();
const b7b3 = readLogFixture(join(ROOT, "fixtures/zmdlogs-b7b3762d5da8.json"));

describe("the replay's record", () => {
  it("chains a kit window to the instance its application replaced (a refresh in the replay)", () => {
    // b7b3: Arcane's Imprisonment from 4.83 s, refreshed by her combo at 7.03 s.
    const { replay } = logBuffReplay(data, b7b3);
    const w = replay.kitWindows("chr_0032_lizhiyan:imprisonment", "chr_0032_lizhiyan").find((x) => x.replaces !== undefined);
    expect(w?.start).toBeCloseTo(7033, -1);
    expect(w?.replaces).toBeCloseTo(4833, -1);
    expect(w?.appliedAt).toBe(Math.round(((w?.start ?? 0) * 30) / 1000));
    expect(replayView(data, b7b3, { buffs: ["chr_0032_lizhiyan:imprisonment"], to: 8000 })).toMatch(/BUFF {3}chr_0032_lizhiyan:imprisonment at Arcane 7\.03–\S+ .*\(refreshes the one from 4\.83: the log keeps a refreshed run's since\)/);
  });

  it("traces an enemy status by applier, a moved application read as a hold, without changing the replay", () => {
    const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-4d60e7fe92c2.json"));
    const plain = logBuffReplay(data, fx).replay;
    const traced = logBuffReplay(data, fx, undefined, { trace: ["status:electrification"] }).replay;
    expect(traced.hits.map((h) => h.damage)).toEqual(plain.hits.map((h) => h.damage));
    // Perlica's Electrification from 4.67 s, held by Zhuang Fangyi's combo slow-down at 10.00 s: its application moves.
    const held = traced.statusTraces.find((x) => x.status === "electrification" && x.operator === "chr_0004_pelica" && x.from !== null && x.to !== null && x.to.appliedAt !== x.from.appliedAt);
    expect(held?.step).toMatch(/^cast /);
    const text = replayView(data, fx, { trace: ["status:electrification"], from: 4000, to: 11000 });
    expect(text).toMatch(/TRACE {2}status:electrification by Perlica: none → level 1 applied \d+\.\d\d expiry \d+\.\d\d at cast /);
    expect(text).toMatch(/\(application moved \+\d+ frames: a hold, not a reapplication\)/);
    expect(text).toMatch(/LANE {3}status:electrification by Perlica: the log's run since 4\.67, listed to \d+\.\d\d/);
  });

  it("records the slow-downs the timeline applied, which pair with the log tools' stop list", () => {
    const { replay } = logBuffReplay(data, b7b3);
    expect(replay.appliedStops.length).toBeGreaterThan(0);
    const { pairs, unapplied } = stopsAgainstList(replay.appliedStops, replayTimeStops(data, b7b3));
    expect(unapplied).toEqual([]);
    expect(pairs.every((p) => p.listed !== null && p.listed.scales.length === p.applied.scales.length)).toBe(true);
    expect(replayView(data, b7b3, { stops: true })).toMatch(/STOP {3}the timeline's ultimate stop of \S+ .*: as listed/);
    // `zmdlogs stops`: the same lines over several logs, a count per kind; with differ, only the differing ones.
    const all = stopsView(data, [{ short: "b7b3", fx: b7b3 }]);
    expect(all).toMatch(/^b7b3:$/m);
    expect(all).toMatch(new RegExp(`Over 1 logs: as listed ${pairs.length}, covered 0, length 0, timeline only 0, list only 0$`));
    expect(stopsView(data, [{ short: "b7b3", fx: b7b3 }], { differ: true })).not.toMatch(/^b7b3:$/m);
  });

  it("pairs two slow-downs of one cast at one frame by their lengths (Rossi's combo_3)", () => {
    const applied: AppliedStop[] = [
      { start: 100, scales: Array(12).fill(0.01), operator: "a", ultimate: false, priority: 2 },
      { start: 100, scales: Array(19).fill(0.01), operator: "a", ultimate: false, priority: 1 },
    ];
    const listed = [
      { start: 100, scales: Array(19).fill(0.01), operator: "a", skillId: "s", priority: 1 },
      { start: 100, scales: Array(12).fill(0.01), operator: "a", skillId: "s", priority: 2 },
      { start: 300, scales: Array(5).fill(0), operator: "a", skillId: "t" },
    ];
    const { pairs, unapplied } = stopsAgainstList(applied, listed);
    expect(pairs.map((p) => p.listed?.scales.length)).toEqual([12, 19]);
    expect(unapplied.map((l) => l.skillId)).toEqual(["t"]);
  });

  it("gives each landing's crit and its source, and the zones in a text line", () => {
    const records = hitRecords(data, b7b3);
    const landed = records.filter((r) => r.landing);
    expect(landed.length).toBeGreaterThan(0);
    expect(records.filter((r) => r.crit !== null).every((r) => r.critSource === "log")).toBe(true);
    expect(landed.filter((r) => r.crit !== null && r.kind === "skill").every((r) => r.replayCrit === r.crit)).toBe(true);
    expect(formatRecord(landed[0] as (typeof landed)[number], false, "primary", true)).toMatch(/ {2}zones atk \d+(\.\d+)?, scale .*; crit (yes|no|-) \((log|shown|layers|values|none)\); modifiers /);
  });

  it("splits the simulated total into matched, replay-only and log-only parts", () => {
    const text = totalsView(data, b7b3);
    expect(text).toMatch(/ {2}team: [\d,]+ vs [\d,]+ \([+-]\d+\.\d%\)/);
    expect(text).toMatch(/ {2}Arcane: [\d,]+ vs [\d,]+ \([+-]\d+\.\d%\): matched [\d,]+ vs [\d,]+ \([+-]\d+\.\d%, \d+ landing\(s\)\); simulated \+ replay only [\d,]+ \(\d+ landing\(s\)\)/);
  });

  it("places the holds without the stop of a cast event read as a buff's tick (4d60: the Empyrean's end at 106.47 s)", () => {
    // Zhuang Fangyi's ultimate_skill event 30–35 s after her ultimate is her Empyrean's end (ticksLoggedAs), no cast:
    // with its 78 frames in the stop list, Arcane's Solemn Phalanx run 38.27 → 130.49 s allowed 2.6 s less hold.
    const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-4d60e7fe92c2.json"));
    const text = holdsView(data, fx, { verbose: true });
    const bound = /bound: run buff_wpn_funnel_0016_will_dmg\|chr_0032_lizhiyan on enemy 38267→\S+ ms over \d+: P\(130\.49\) − P\(38\.27\) in \[−∞, ([\d.]+)\] s/.exec(text);
    expect(Number(bound?.[1])).toBeGreaterThan(53);
  });

  it("says why an instance wasn't kept to the log's end (holds --why, the log-end side)", () => {
    // 5082: Xaihi's weapon team ATK is an instance buff: never taken to the log's end (round 8: it fell out silently).
    const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-5082ceaffad1.json"));
    const text = holdsView(data, fx, { why: /Xaihi:wpn_funnel_0010\.atk/ });
    expect(text).toMatch(/^the log's end \(heldToLoggedEnds, in the check's replay\)/m);
    expect(text).toMatch(/^ {2}Xaihi:wpn_funnel_0010\.atk from 27\.37: not taken: an instance buff/m);
  });

  it("traces a kit trigger's firings and its ready frame's shifts, without changing the replay (--trace-trigger)", () => {
    // de6a: Chen Qianyu's Swordmancer (a CD timer, on the world's clock) fires at 8.30 s, ready 15 s later, then held
    // by the casts' stops and the placed hidden holds (backlog after round 11 point 11).
    const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-de6a94e9cf6b.json"));
    const plain = logBuffReplay(data, fx).replay;
    const traced = logBuffReplay(data, fx, undefined, { trace: ["trigger:chr_0005_chen:suit_phy01.proc"] }).replay;
    expect(traced.hits.map((h) => h.damage)).toEqual(plain.hits.map((h) => h.damage));
    const mine = traced.triggerTraces.filter((x) => x.key === "chr_0005_chen:suit_phy01.proc");
    const first = mine[0];
    expect(first?.from).toBeNull();
    expect(first && first.to.readyAt - first.frame).toBe(15 * 30);
    expect(mine.some((x) => x.from !== null && x.from.count === x.to.count && x.to.readyAt > x.from.readyAt && x.step.startsWith("cast "))).toBe(true);
    const text = replayView(data, fx, { trace: ["trigger:suit_phy01.proc"], from: 8000, to: 23000 });
    expect(text).toMatch(/TRACE {2}trigger Chen Qianyu:suit_phy01\.proc: fired \(firing 1\), ready again at 23\.30 s \(on the world's clock\)/);
    expect(text).toMatch(/TRACE {2}trigger Chen Qianyu:suit_phy01\.proc: ready \S+ s → \S+ s \(\+\d+ frames: held on the world's clock\) at a placed hidden hold of 1 frame\(s\) \(\d+ steps, to /);
  });
});
