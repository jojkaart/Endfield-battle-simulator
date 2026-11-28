// The replay's decisions as records and views (improvement round 14): BuffReplay.made, `zmdlogs decisions`
// (decisionsview.ts: the decisions two readings differ in), the EVENT line's fate from the replay's own record, `zmdlogs
// hits --against` (hitexport.ts recordChanges), `totals --by crit` (enginecheck.ts TotalsCrit).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { withCurveReading } from "@efsim/engine";
import type { LandedHit } from "@efsim/engine";
import { decisionsDiff, laneEnds, lanePairs, linkGains, logBuffReplay, readLogFixture, recordChanges, replayDecisions, replayView, totalsView, withOperatorsOnly, type DecisionLine, type HitRecord, type LogHit } from "@efsim/logs";
import { ROOT } from "./logverdicts.ts";
import { fakeReplay } from "./helpers/replay.ts";
import { registryChecks } from "../scripts/lint-changed.ts";
import { logHitOf, syntheticFixture } from "./helpers/synthetic.ts";

const data = loadGameData();

describe("the replay's decisions", () => {
  const d = (t: number, kind: DecisionLine["kind"], text: string): DecisionLine => ({ t, kind, operator: "op", text });

  // Round 22: lint:changed runs the fakeReplay tests below (and the typecheck) when BuffReplay's home or the helper
  // changes; their names must stay what its check selects.
  it("are the fakeReplay tests lint:changed runs for a change to BuffReplay or the helper", () => {
    const [c] = registryChecks(["tests/helpers/replay.ts"]);
    expect(c).toMatchObject({ test: "tests/decisions.test.ts", typecheck: true });
    for (const name of ["says when a cast kept a jump with pinned landings in the part it skips: both paths land (BOTHPATHS; round 16)", "counts a batched ms landed out of the bars' order as a BATCH decision, given the fixture (backlog after round 16 point 3)"]) expect(new RegExp(c?.names ?? "^$").test(name)).toBe(true);
  });

  it("decisionsDiff keeps only what one side decided, each repeat counted", () => {
    const a = [d(1000, "SKIP", "x"), d(2000, "TAILCUT", "y"), d(2000, "TAILCUT", "y")];
    const b = [d(1000, "SKIP", "x"), d(2000, "TAILCUT", "y"), d(3000, "INFER", "z")];
    expect(decisionsDiff(a, b).map((x) => `${x.side}${x.d.t}${x.d.kind}`)).toEqual(["-2000TAILCUT", "+3000INFER"]);
    expect(decisionsDiff(a, a)).toEqual([]);
  });

  it("8915's Liino press at 111.23 s: made from the listing (INFER), and its EVENT line says so instead of a tick", () => {
    const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-891566c224f8.json"));
    const { replay } = logBuffReplay(data, fx);
    const made = replay.made.filter((m) => m.inferred !== undefined && Math.abs(m.cast.start - 111230) < 200);
    expect(made.map((m) => m.cast.operator)).toEqual(["chr_0035_liino"]);
    expect(replayDecisions(data, replay).filter((x) => x.kind === "INFER").map((x) => Math.round(x.t / 100))).toContain(1112);
    const text = replayView(data, fx, { from: 111000, to: 111400 });
    expect(text).toMatch(/111\.23 {2}EVENT {2}Liino normal_skill .*but the replay made the press from the listing/);
    expect(text).toMatch(/111\.23 {2}INFER {2}Liino normal_skill/);
  });

  it("says when a cast was made before the replay's own cooldown had it ready, and by how much (COOLDOWN; round 24)", () => {
    // The wording on a synthetic record (the combo-windows report point 5: a view's words not pinned on a live lead).
    const cast = { operator: "op_a", skillId: "op_a_combo_skill", start: 19300, kind: "combo" as const, landings: [] };
    const replay = fakeReplay({ made: [{ cast, frame: 579, skillId: cast.skillId, index: 7, early: { readyAt: 604, last: { frame: 64, cooldownFrames: 540 } } }, { cast: { ...cast, start: 40000 }, frame: 1200, skillId: cast.skillId, index: 9, early: { readyAt: 1210, last: { frame: 600, cooldownFrames: 540 } } }] });
    const lines = replayDecisions(data, replay).filter((x) => x.kind === "COOLDOWN");
    expect(lines.map((x) => x.text)).toEqual([
      expect.stringMatching(/combo_skill \(made at 19\.30\): 0\.83 s before the replay's cooldown had it ready at 20\.13 \(its last cast at 2\.13 set 18\.00 s; made all the same/),
      expect.stringMatching(/\(made at 40\.00\): 0\.33 s before .* ready at 40\.33 \(its last cast at 20\.00 set 18\.00 s, readyAt \+2\.33 s from it since/),
    ]);
    expect(lines.map((x) => x.detail)).toEqual(["combo", "combo"]);
  });

  it("489c's Rossi sequence 2 at 18.77 s: the late path's jump dropped for the perfect landing the log shows (JUMPDROP)", () => {
    const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-489c0be3e162.json"));
    const drops = replayDecisions(data, logBuffReplay(data, fx).replay).filter((x) => x.kind === "JUMPDROP" && x.t < 20000);
    expect(drops.map((x) => x.text)).toEqual([expect.stringMatching(/^Rossi combo_3_skill \(made at 18\.77\): its jump 0 → 212 dropped, the logged landing\(s\) perfect@19\.73/)]);
  });

  it("says when a cast kept a jump with pinned landings in the part it skips: both paths land (BOTHPATHS; round 16)", () => {
    // The slots-and-paths report's case before its fix: Pogranichnik's combo, its 3-stack path's jump 0 → 200 kept, the
    // slashes pinned at the 4-stack path's frames landing too (none in the development logs since: a guard).
    const cast = { operator: "op_p", skillId: "op_p_combo_skill", start: 47200, landings: [] };
    const replay = fakeReplay({ made: [{ cast, frame: 1416, skillId: cast.skillId, index: 3, keptSkipped: [{ frame: 1416, from: 0, to: 200, landings: [{ hitId: "slash", frame: 1439 }, { hitId: "slash", frame: 1453 }] }] }] });
    const lines = replayDecisions(data, replay).filter((x) => x.kind === "BOTHPATHS");
    expect(lines.map((x) => x.text)).toEqual([expect.stringMatching(/combo_skill \(made at 47\.20\): its jump 0 → 200 kept, yet the pinned landing\(s\) slash@47\.97, slash@48\.43 are in the part it skips and land too/)]);
    expect(lanePairs([1000, 5000, 20000], [1200, 4000, 9000])).toEqual([
      { logged: 1000, replay: 1200 },
      { logged: 5000, replay: 4000 },
      { logged: null, replay: 9000 },
      { logged: 20000, replay: null },
    ]);
    // Round 19 (the Camille report point 4): each pair's ends, the replay's chain followed through refreshes the log
    // keeps in one run, stopped at one where the log starts its next run; a pair whose ends differ says how.
    const runs = [
      { since: 1000, firstListed: 1000, lastListed: 5000, nextUnlisted: 5500 },
      { since: 8000, firstListed: 8000, lastListed: 9000, nextUnlisted: 9400 },
    ];
    const windows = [{ start: 1000, end: 3000, expired: false }, { start: 3000, end: 8000, expired: false, replaces: 1000 }, { start: 8000, end: 9200, expired: true, replaces: 3000 }];
    expect(laneEnds({ logged: 1000, replay: 1000 }, runs, windows)).toEqual({ log: { last: 5000, unlisted: 5500 }, replay: { end: 8000, why: "refreshed where the log starts its next run" }, differ: expect.stringMatching(/keeps it 2\.50 s past the log's next hit without it/) as unknown as string });
    expect(laneEnds({ logged: 8000, replay: 8000 }, runs, windows)).toEqual({ log: { last: 9000, unlisted: 9400 }, replay: { end: 9200, why: "ran out" } });
    expect(laneEnds({ logged: null, replay: 1000 }, runs, [{ start: 1000, end: 2000, expired: true }])?.differ).toBeUndefined();
  });

  it("counts a batched ms landed out of the bars' order as a BATCH decision, given the fixture (backlog after round 16 point 3)", () => {
    // c4f3 7.05 s's shape: A's combo leaves the bar at 264, B's ultimate at 234, A's Lift at 224; the replay lands A's two first.
    const hit = (op: string, event: string, bar: number): LogHit => logHitOf(op, 7049, event, 100, { poise: { dealt: 10, bar, origin: event } });
    const [a1, b1, a2] = [hit("op_a", "op_a_combo", 264), hit("op_b", "op_b_ult", 234), hit("op_a", "op_a_lift", 224)];
    const fx = syntheticFixture([a1, b1, a2], [], { enemy: "e", level: 1 });
    const land = (n: number) => ({ frame: 211, n }) as unknown as LandedHit;
    const [l1, l2, l3] = [land(1), land(2), land(3)];
    const of = new Map<LogHit, LandedHit>([[a1, l1], [b1, l2], [a2, l3]]);
    const replay = fakeReplay({ hits: [l1, l3, l2], landing: (h: LogHit) => of.get(h) ?? { unknown: "none" } });
    const batch = replayDecisions(data, replay, fx).filter((x) => x.kind === "BATCH");
    expect(batch.map((x) => [x.t, x.operator, x.text])).toEqual([[7049, "op_a", "the replay landed op_a op_a_combo, op_a op_a_lift, op_b op_b_ult; the log's bars give op_a op_a_combo, op_b op_b_ult, op_a op_a_lift"]]);
    // Without the fixture (zmdlogs replay prints its own BATCH lines), none.
    expect(replayDecisions(data, replay).some((x) => x.kind === "BATCH")).toBe(false);
    // A member the fake doesn't hold throws rather than reading as empty.
    expect(() => replay.reactions).toThrow(/not faked/);
  });

  it("says where each Link stack came from and which cast took it (LINK; round 15, totals-off report point 1: db87)", () => {
    expect(linkGains({ link: [100, 600] }, { link: [600, 950, 950] })).toEqual([{ frame: 950 - 450, n: 2 }]);
    expect(linkGains({ link: [600] }, { link: [] })).toEqual([]);
    const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-db8711232de9.json"));
    const lines = replayDecisions(data, logBuffReplay(data, fx).replay).filter((x) => x.kind === "LINK");
    // Twilight's battle skill during her ultimate at 27.13 s takes Camille's combo's stack.
    expect(lines.map((x) => x.text)).toContain("Laevatain normal_skill_during_ult (made at 27.13) took 1 Link stack(s)");
    expect(lines.some((x) => /^\+1 Link stack\(s\) for the team at 2\d\.\d\d, in the step of /.test(x.text))).toBe(true);
  });
});

describe("hits --against and --operator", () => {
  const rec = (t: number, cls: string, predicted: number | null, mods: string[] = []): HitRecord =>
    ({ fixture: "fixtures/pending/zmdlogs-aaaa.json", t, operator: "op", event: "e", kind: "skill", value: 100, crit: false, verdict: "match", class: cls, predicted, error: predicted ? 100 / predicted - 1 : null, listed: [], landing: { modifiers: mods.map((m) => ({ source: m, zone: "atk", value: 0.1 })) } }) as unknown as HitRecord;

  it("recordChanges lists the hits whose class or primary reading moved, with the modifiers only one side has", () => {
    const out = recordChanges([rec(1, "plain", 100), rec(2, "plain", 100, ["a"])], [rec(1, "plain", 100), rec(2, "mismatch", 90, ["b"])]);
    expect(out).toEqual(["zmdlogs-aaaa  t=2  op  e  logged 100: plain 100 (0.0%) → mismatch 90 (11.1%); modifiers +b:atk 0.1, -a:atk 0.1", "1 hit(s) changed: plain → mismatch 1"]);
  });

  it("withOperatorsOnly reads only the logs whose team has the operator", () => {
    const files = ["fixtures/pending/zmdlogs-0c14fb3ce77d.json", "fixtures/pending/zmdlogs-891566c224f8.json"].map((f) => join(ROOT, f));
    expect(withOperatorsOnly(files, ["chr_0035_liino"]).map((f) => f.slice(-17))).toEqual(["891566c224f8.json"]);
    expect(withOperatorsOnly(files, undefined)).toEqual(files);
  });
});

describe("totals --by crit", () => {
  it("0c14: every matched landing in one of the four kinds, the known and exact ones the log's or the value's", () => {
    const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-0c14fb3ce77d.json"));
    const text = totalsView(data, fx, { byCrit: true, operators: ["chr_0028_wulfa"] });
    expect(text).toMatch(/Rossi: matched [\d,]+ vs [\d,]+/);
    expect(text).toMatch(/ {6}exact +\d+ {2}([\d,]+) vs \1 \(\+0\.0%/);
    // The kinds' landings add up to the matched ones (since break-hold, 2026-11-27, none of Rossi's is `expected`).
    const matched = Number(/Rossi: matched [\d,]+ vs [\d,]+ \([^,]+, (\d+) landing/.exec(text)?.[1]);
    const kinds = [...text.matchAll(/ {6}(?:known|exact|read|expected) +(\d+) /g)].reduce((t, m) => t + Number(m[1]), 0);
    expect(kinds).toBe(matched);
  });
});

describe("logBuffReplay's options (round 14)", () => {
  const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-0c14fb3ce77d.json"));

  it("refuses a combo-curve reading on data not under it (the placement and the replay would read two curves)", () => {
    expect(() => logBuffReplay(data, fx, { assume: { "combo-curve": "flat" } })).toThrow(/game data is under another of its readings/);
    expect(() => logBuffReplay(withCurveReading(data, { "combo-curve": "flat" }), fx)).toThrow(/combo-curve \(the default\)/);
  });

  it("refuses its options given twice (as the third argument and the fourth)", () => {
    expect(() => logBuffReplay(data, fx, { assume: {} }, { assume: {} })).toThrow(/options given twice/);
  });
});
