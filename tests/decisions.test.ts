// The replay's decisions as records and views (improvement round 14): BuffReplay.made, `zmdlogs decisions`
// (decisionsview.ts: the decisions two readings differ in), the EVENT line's fate from the replay's own record, `zmdlogs
// hits --against` (hitexport.ts recordChanges), `totals --by crit` (enginecheck.ts TotalsCrit).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { withCurveReading } from "@efsim/engine";
import { decisionsDiff, linkGains, logBuffReplay, readLogFixture, recordChanges, replayDecisions, replayView, totalsView, withOperatorsOnly, type DecisionLine, type HitRecord } from "@efsim/logs";
import { ROOT } from "./logverdicts.ts";

const data = loadGameData();

describe("the replay's decisions", () => {
  const d = (t: number, kind: DecisionLine["kind"], text: string): DecisionLine => ({ t, kind, operator: "op", text });

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

  it("489c's Rossi sequence 2 at 18.77 s: the late path's jump dropped for the perfect landing the log shows (JUMPDROP)", () => {
    const fx = readLogFixture(join(ROOT, "fixtures/pending/zmdlogs-489c0be3e162.json"));
    const drops = replayDecisions(data, logBuffReplay(data, fx).replay).filter((x) => x.kind === "JUMPDROP" && x.t < 20000);
    expect(drops.map((x) => x.text)).toEqual([expect.stringMatching(/^Rossi combo_3_skill \(made at 18\.77\): its jump 0 → 212 dropped, the logged landing\(s\) perfect@19\.73/)]);
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
    expect(text).toMatch(/ {6}expected +\d+ /);
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
