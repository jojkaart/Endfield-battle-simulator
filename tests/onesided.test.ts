// The fight totals' one-sided landings (packages/logs/src/onesided.ts: `zmdlogs totals --kinds`, measure's hold-out
// means by kind) and the placement and landing rules they led to (2026-11-23, one-sided round): Zhuang Fangyi's
// Sunderblade variants in turn, a trigger's alternative paths as one landing (Si's Artful Intent burst), a detached
// series at its own pace (Typhoeus's Barrage Array).

import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { engineHits, engineReport, kindsAggregate, kindShares, logBuffReplay, placeHits, readLogFixture, totalsKindsView, totalsShares, type LogFixture, type LogHit, type OneSided } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string): LogFixture => readLogFixture(new URL(`../fixtures/pending/zmdlogs-${id}.json`, import.meta.url).pathname);
const totalsOf = (fx: LogFixture) => {
  const replay = logBuffReplay(data, fx);
  return { replay, totals: engineReport(data, fx, replay, engineHits(data, fx, replay)).totals };
};

describe("one-sided landings by kind", () => {
  const item = (o: Partial<OneSided>): OneSided => ({ side: "replay", operator: "op", t: 0, damage: 10, key: "k", skill: "basic", nature: "kit hit", context: "cast tail", flags: [], ...o });

  it("sums a fight's one-sided landings by kind and by operator and key, as % of the logged total, with the flags' gross shares", () => {
    const { kinds, keys } = kindShares([item({ flags: ["stop"] }), item({ damage: 30 }), item({ side: "log", damage: -20, context: "twin like", nature: "burst", skill: "status", key: "e" })], 1000);
    expect(kinds).toEqual([
      { context: "cast tail", nature: "kit hit", skill: "basic", replay: 4, log: 0, n: 2, flagged: { stop: 1 } },
      { context: "twin like", nature: "burst", skill: "status", replay: 0, log: -2, n: 1, flagged: {} },
    ]);
    expect(keys.map((k) => [k.side, k.key, k.share])).toEqual([["replay", "k", 4], ["log", "e", -2]]);
  });

  it("averages kinds over fights (a fight without a kind counts as 0), largest gross first, with the fights it occurs in", () => {
    const a = kindShares([item({ damage: 40 })], 1000).kinds;
    const b = kindShares([item({ side: "log", damage: -10, context: "no cast" })], 1000).kinds;
    expect(kindsAggregate([a, b], (k) => k.context).map((k) => [k.kind, k.replay, k.log, k.fights])).toEqual([["cast tail", 2, 0, 1], ["no cast", 0, -0.5, 1]]);
  });

  it("renders the kinds per group and the keys over the development fights", () => {
    const shares = (items: OneSided[]) => ({ logged: 1000, error: 0, matched: 0, replayOnly: 0, logOnly: 0, awayLeftOut: 0, awaySeconds: 0, perOperator: [], ...kindShares(items, 1000) });
    const text = totalsKindsView(data, [
      { short: "aaaa", group: "development", shares: shares([item({ operator: "chr_0036_jsspsi", damage: 50 })]) },
      { short: "bbbb", group: "earlier", shares: shares([]) },
    ]);
    expect(text).toContain("development: 1 fight(s); by where they sit:");
    expect(text).toMatch(/5\.00% +\+5\.00% +\+0\.00% +net +\+5\.00% +1 fight\(s\) +cast tail/);
    expect(text).toMatch(/\+2\.50% +Si replay k \[cast tail\] ×1: aaaa \+5\.00%/);
  });

  it("classifies a real fight's one-sided landings, and their kinds add up to its replay-only and log-only shares (fc63)", () => {
    const fx = fixture("fc63a2001251");
    const { totals } = totalsOf(fx);
    const s = totalsShares(fx.hits, totals);
    const sum = (k: "replay" | "log") => s.kinds.reduce((a, x) => a + x[k], 0);
    expect(sum("replay")).toBeCloseTo(s.replayOnly, 6);
    expect(sum("log")).toBeCloseTo(s.logOnly, 6);
    expect(totals.oneSided.every((x) => x.context !== "?")).toBe(true);
  });
});

describe("the rules the kinds led to", () => {
  it("a variant's landings take the slots in turn: Zhuang Fangyi's 8-Sunderblade cast in 3aa6 lands its final on the logged final (87.52 s), not a strike", () => {
    const fx = fixture("3aa6ab93bad4");
    const replay = logBuffReplay(data, fx).replay;
    const final = fx.hits.find((h) => h.event === "buff_chr_0030_zhuangfy_sword_triggerd" && h.t > 87500 && h.t < 87600) as LogHit;
    const l = replay.landing(final);
    expect("unknown" in l ? l.unknown : l.hitId).toBe("final_8");
    expect(placeHits(data, fx).hits.get(final)?.at?.size).toBeGreaterThan(0);
  });

  it("a trigger's alternative paths are one landing: Si's Artful Intent burst logged through the Inksoul takes the replay's mark burst (c779 60.37 s), and a recorded burst looks further (4e36: the log's 0.9 s after the replay's)", () => {
    for (const [id, t] of [["c7790d76a4f0", 60366], ["4e3651100056", 36813]] as const) {
      const fx = fixture(id);
      const replay = logBuffReplay(data, fx).replay;
      const burst = fx.hits.find((h) => h.operator === "chr_0036_jsspsi" && h.t === t) as LogHit;
      const l = replay.landing(burst);
      expect("unknown" in l ? l.unknown : l.hitId).toMatch(/^burst_/);
    }
  });

  it("a detached series goes on at its own pace: Typhoeus's 18th Barrage Array tick at 94.26 s (fc63), after her ultimate's stop, is her 80.3 s combo's, not a combo of its own", () => {
    const fx = fixture("fc63a2001251");
    const p = placeHits(data, fx);
    const tick = fx.hits.find((h) => h.event === "chr_0034_typhoea_combo_persistentdamage" && h.t === 94263) as LogHit;
    const placed = p.hits.get(tick);
    expect(placed?.index).toBe(17);
    expect(Math.round((placed?.cast.start ?? 0) / 100)).toBe(803);
  });
});
