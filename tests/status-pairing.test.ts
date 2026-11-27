// The logged status hits paired with the replay's status landings (statuspairs.ts pairStatusLandings; engine assumption
// status-pairing): one assignment per operator, kind and element, a landing up to STATUS_WIDE_FRAMES away only where its
// value fits; and the fixture field marking a fight against several enemies under one id (severalTargets).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay, type LogFixture, type LogHit } from "@efsim/logs";
import type { LandedHit } from "@efsim/engine";
import { pairStatusLandings, STATUS_NEAR_FRAMES, STATUS_WIDE_FRAMES, type StatusQuery } from "../packages/logs/src/statuspairs.ts";
import { snapshotEntry, SEVERAL_TARGETS_KEY } from "../packages/logs/src/snapshotentry.ts";
import { groupOf, withSeveralTargets } from "../scripts/accuracy.ts";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;

/** A logged hit and a landing reduced to what the pairing reads. */
const hit = (t: number, value: number): LogHit => ({ t, operator: "a", event: "e", value, crit: null, element: null, effects: [], boundaryEffects: [], unquantified: [] }) as unknown as LogHit;
const landing = (frame: number, damage: number): LandedHit => ({ frame, damage, operator: "a", skillId: "reaction:burst", element: "cryst" }) as unknown as LandedHit;
const query = (h: LogHit): StatusQuery => ({ hit: h, frame: Math.round((h.t * 30) / 1000), key: "k" });
const opts = (reading: "assignment" | "nearest") => ({ reading, keyOf: () => "k", fits: (h: LogHit, x: LandedHit) => Math.abs(h.value / x.damage - 1) <= 0.01 });

describe("pairStatusLandings", () => {
  // c779's shape: logged 9.68 and 10.08 s, the replay's 9.27 (another value) and 10.03 s.
  const [a, b] = [hit(9680, 9049), hit(10080, 9049)];
  const [x, y] = [landing(278, 8387), landing(301, 9049)];

  it("nearest in time order pairs crosswise and leaves one of each unpaired", () => {
    const got = pairStatusLandings([query(a), query(b)], [x, y], opts("nearest"));
    expect(got.get(a)).toBe(y);
    expect(got.has(b)).toBe(false);
  });

  it("the assignment pairs both: the most pairs, then the closest", () => {
    const got = pairStatusLandings([query(a), query(b)], [x, y], opts("assignment"));
    expect(got.get(a)).toBe(x);
    expect(got.get(b)).toBe(y);
  });

  it("a landing beyond the near window pairs only where its value fits", () => {
    const late = hit(20000, 5771);
    const f = Math.round((20000 * 30) / 1000) - (STATUS_NEAR_FRAMES + 4);
    expect(pairStatusLandings([query(late)], [landing(f, 5771)], opts("assignment")).has(late)).toBe(true);
    expect(pairStatusLandings([query(late)], [landing(f, 7000)], opts("assignment")).has(late)).toBe(false);
    expect(pairStatusLandings([query(late)], [landing(f - STATUS_WIDE_FRAMES, 5771)], opts("assignment")).has(late)).toBe(false);
  });

  it("prefers a landing whose value fits over a nearer one whose value doesn't", () => {
    const h = hit(30000, 5771);
    const f = Math.round((30000 * 30) / 1000);
    const [near, fit] = [landing(f + 2, 9000), landing(f - 20, 5771)];
    expect(pairStatusLandings([query(h)], [near, fit], opts("assignment")).get(h)).toBe(fit);
  });
});

describe("c779's Arcane bursts at 9.27–10.08 s", () => {
  // The logged 9.68 s burst took the replay's 10.03 s under `nearest`, so the replay's 9.27 s and the logged 10.08 s
  // stayed one-sided; the assignment pairs 9.68 s with 9.27 s and 10.08 s with 10.03 s.
  const fx = fixture("c779");
  const burstAt = (t: number) => fx.hits.find((h) => h.t === t) as LogHit;
  it("pairs each logged burst with a landing of its own", () => {
    const { replay } = logBuffReplay(data, fx);
    const [early, late] = [replay.statusLanding(burstAt(9680)), replay.statusLanding(burstAt(10084))];
    expect("frame" in early && early.frame).toBe(278);
    expect("frame" in late && late.frame).toBe(301);
    const { replay: old } = logBuffReplay(data, fx, { assume: { "status-pairing": "nearest" } });
    expect("unknown" in old.statusLanding(burstAt(10084))).toBe(true);
  });
});

describe("several targets under one enemy id (severalTargets)", () => {
  it("9c6e carries it, and its snapshot entry the key that puts it in its own scoreboard group", () => {
    const fx = fixture("9c6e");
    expect(fx.severalTargets?.why).toMatch(/twice within a frame/);
    const totals = snapshotEntry(data, fx).totals as Record<string, unknown>;
    expect(totals[SEVERAL_TARGETS_KEY]).toBe(1);
    const key = "pending/zmdlogs-9c6e97486a9d.json";
    const split = withSeveralTargets({ development: new Set(["zmdlogs-9c6e97486a9d"]), holdout: new Set() }, { [key]: { totals: { [SEVERAL_TARGETS_KEY]: 1 } } });
    expect(groupOf(key, split)).toBe("targets");
    expect(groupOf(key, { ...split, severalTargets: new Set() })).toBe("development");
  });
});
