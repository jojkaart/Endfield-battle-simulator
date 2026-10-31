// Verified log fixtures (fixtures/zmdlogs-*.json): the check must verify each (docs/design.md, "What a log check
// verifies": no mismatch, no unvalued hit, a plain or assumed match for every operator with a kit), and its verdict
// counts mustn't fall behind their snapshot (tests/snapshots/log-verdicts.json, a regression baseline, not values
// with provenance: principle 11): per operator no fewer plain, plain + assumed or total matches, no more log-listing
// fallbacks. A deliberate change: `npm run snapshots:update`, and the snapshot's diff in the commit.
//
// Pending fixtures (fixtures/pending/) and the negative control run in `npm run test:logs` (tests/slow/).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadGameData, sourceCommit, SOURCES } from "@efsim/data";
import { checkLog, engineHits, engineReport, logBuffReplay, readLogFixture, simulateLog, verdictCounts, verificationProblems, type EngineHits, type HitVerdict, type LogBuffReplay } from "@efsim/cli";
import { changes, entry, logFixtures, regressions, ROOT, totalsChanges, totalsOf, type FixtureCounts } from "./logverdicts.ts";
import { Snapshot, UPDATE_HINT, UPDATING } from "./snapshot.ts";

const data = loadGameData();
const files = logFixtures("");
const snapshot = new Snapshot<FixtureCounts>("log-verdicts.json", true);
afterAll(() => snapshot.write((key) => existsSync(join(ROOT, "fixtures", key))));

it("has a verdict snapshot for every verified fixture and none for a fixture that isn't one", () => {
  if (UPDATING) return;
  expect(Object.keys(snapshot.stored).filter((k) => !files.includes(k)), `stale entries (${UPDATE_HINT})`).toEqual([]);
  expect(files.filter((f) => !(f in snapshot.stored)), `fixtures without an entry (${UPDATE_HINT})`).toEqual([]);
});

/**
 * The largest error of a verified fixture's total damage, simulated (the replay of the logged casts through the engine:
 * engineReport) against the log's, in % (2026-10-25: dbae −43.9%, bdf2 −28.0%, 0eef −27.1%, b7b3 +23.1%, 40d9 −12.9%,
 * 4e5e −12.5%; journal; 2026-10-31: 0eef −10.2%, the rest within ±4.3%). A bound to tighten as the leads the report
 * lists are fixed; each fixture's error is also in the snapshot and mustn't grow.
 */
const MAX_DAMAGE_ERROR = 12;

/**
 * The plain matches (no assumption) whose hit the simulation of the logged casts doesn't reproduce: its landing's damage
 * through the simulation's own damage path (simulateLog: the timeline's damageOptions at the landing, with only the
 * crit, effects no kit models, the enemy's HP and what the replay can't judge from the log) more than ±1 from the log,
 * or no landing. Written 2026-10-25 against the round-two review's Stagger bug, which the check missed because it
 * computed each hit through its own options, not the simulation's: then 291 of 396 plain matches failed it.
 */
function unreproduced(fx: ReturnType<typeof readLogFixture>, verdicts: readonly HitVerdict[], replay: LogBuffReplay, byHit: EngineHits): string[] {
  const simulated = new Map(simulateLog(data, fx, undefined, replay, byHit).map((s) => [s.hit, s]));
  const out: string[] = [];
  for (const v of verdicts) {
    if (v.kind !== "match" || v.class !== "plain") continue;
    const s = simulated.get(v.hit);
    const actual = v.hit.uncapped ?? v.hit.value;
    const where = `${v.hit.operator} t=${v.hit.t} ${v.hit.event}: logged ${actual}, plain match ${v.predicted}`;
    if (!s || typeof s.simulated !== "number") {
      out.push(`${where}, no landing in the simulation (${s && typeof s.simulated !== "number" ? s.simulated.unknown : "not simulated"})`);
      continue;
    }
    if (Math.abs(s.simulated - actual) > 1) out.push(`${where}, simulated ${s.simulated} (×${(actual / s.simulated).toFixed(4)})`);
  }
  return out;
}

describe.each(files)("%s", (file) => {
  const fx = readLogFixture(join(ROOT, "fixtures", file));
  let cached: { replay: LogBuffReplay; byHit: EngineHits; verdicts: HitVerdict[] } | undefined;
  const checked = () => {
    if (cached) return cached;
    const replay = logBuffReplay(data, fx);
    const byHit = engineHits(data, fx, replay);
    return (cached = { replay, byHit, verdicts: checkLog(data, fx, { replay, engineHits: byHit }) });
  };
  const verdictsOf = () => checked().verdicts;

  it("reproduces each plain match through the simulation's damage path (the replay's landing, as simulate computes it)", () => {
    const { replay, byHit, verdicts } = checked();
    const missed = unreproduced(fx, verdicts, replay, byHit);
    expect(missed, `${missed.length} plain match(es) the simulation doesn't reproduce`).toEqual([]);
  });

  it("was verified against the current data commits", () => {
    expect(fx.provenance.verifiedAgainst).toEqual(Object.fromEntries(SOURCES.map((s) => [s, sourceCommit(s)])));
  });

  it("is verified, and its verdict counts don't fall behind the snapshot", () => {
    const verdicts = verdictsOf();
    expect(verificationProblems(data, fx, verdicts)).toEqual([]);
    const { replay, byHit } = checked();
    const totals = engineReport(data, fx, replay, byHit, verdicts).errors;
    expect(Math.abs(totals["damage"] ?? Infinity), `total damage error ${totals["damage"]}%`).toBeLessThanOrEqual(MAX_DAMAGE_ERROR);
    const now = verdictCounts(fx, verdicts);
    const stored = snapshot.record(file, entry(now, totals));
    if (UPDATING || stored === undefined) return;
    expect(regressions(now, stored), `verdict counts fell behind the snapshot (${UPDATE_HINT}); all changes: ${changes(now, stored).join("; ")}`).toEqual([]);
    // The total damage's error mustn't grow (the other totals show in the snapshot's diff).
    const was = totalsOf(stored)["damage"];
    if (was !== undefined && was !== null) expect(Math.abs(totals["damage"] ?? Infinity), `total damage error ${was}% → ${totals["damage"]}% (${UPDATE_HINT})`).toBeLessThanOrEqual(Math.abs(was) + 0.1);
    const gained = [...changes(now, stored), ...totalsChanges(totals, totalsOf(stored))];
    if (gained.length) console.info(`${file}: counts or totals moved from the snapshot (update it to keep the gain): ${gained.join("; ")}`);
  });
});
