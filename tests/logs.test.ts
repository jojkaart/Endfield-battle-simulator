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
import { checkLog, readLogFixture, simulateLog, verdictCounts, verificationProblems, type HitVerdict } from "@efsim/cli";
import { changes, logFixtures, regressions, ROOT, type FixtureCounts } from "./logverdicts.ts";
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
 * Plain matches the simulation doesn't reproduce on 2026-10-25, when this test was written (journal: the round-two
 * review's Stagger bug, which the check missed because it computed each hit through its own options, not the
 * simulation's). A baseline that only shrinks, to 0: each fix lowers it.
 */
const UNREPRODUCED_TODAY: Readonly<Record<string, number>> = {
  "zmdlogs-0eef2474a26f.json": 26,
  "zmdlogs-40d9a3c1da37.json": 10,
  "zmdlogs-4e5e1390085e.json": 109,
  "zmdlogs-b7b3762d5da8.json": 14,
  "zmdlogs-bdf223db8e49.json": 105,
  "zmdlogs-dbaee23b801d.json": 27,
};

/**
 * The plain matches (no assumption) whose hit the simulation of the logged casts doesn't reproduce: its landing's damage
 * through the simulation's own damage path (simulateLog: the timeline's damageOptions at the landing, with only crits,
 * the enemy's HP and effects no kit models from the log) more than ±1 from the log, another crit, or no landing.
 */
function unreproduced(fx: ReturnType<typeof readLogFixture>, verdicts: readonly HitVerdict[]): string[] {
  const simulated = new Map(simulateLog(data, fx).map((s) => [s.hit, s]));
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
    const crit = s.landing?.loggedCrit ?? null;
    if (Math.abs(s.simulated - actual) > 1 || crit !== v.hit.crit) out.push(`${where}, simulated ${s.simulated} (×${(actual / s.simulated).toFixed(4)})${crit !== v.hit.crit ? `, crit ${crit} (logged ${v.hit.crit})` : ""}`);
  }
  return out;
}

describe.each(files)("%s", (file) => {
  const fx = readLogFixture(join(ROOT, "fixtures", file));
  let cached: HitVerdict[] | undefined;
  const verdictsOf = () => (cached ??= checkLog(data, fx));

  it("reproduces each plain match through the simulation's damage path (the replay's landing, as simulate computes it)", () => {
    const missed = unreproduced(fx, verdictsOf());
    const allowed = UNREPRODUCED_TODAY[file] ?? 0;
    if (missed.length) console.info(`${file}: ${missed.length} plain match(es) the simulation doesn't reproduce (baseline ${allowed}):\n  ${missed.join("\n  ")}`);
    expect(missed.length, `${missed.length} plain match(es) the simulation doesn't reproduce:\n${missed.join("\n")}`).toBeLessThanOrEqual(allowed);
  });

  it("was verified against the current data commits", () => {
    expect(fx.provenance.verifiedAgainst).toEqual(Object.fromEntries(SOURCES.map((s) => [s, sourceCommit(s)])));
  });

  it("is verified, and its verdict counts don't fall behind the snapshot", () => {
    const verdicts = verdictsOf();
    expect(verificationProblems(data, fx, verdicts)).toEqual([]);
    const now = verdictCounts(fx, verdicts);
    const stored = snapshot.record(file, now);
    if (UPDATING || stored === undefined) return;
    expect(regressions(now, stored), `verdict counts fell behind the snapshot (${UPDATE_HINT}); all changes: ${changes(now, stored).join("; ")}`).toEqual([]);
    const gained = changes(now, stored);
    if (gained.length) console.info(`${file}: counts moved past the snapshot (update it to keep the gain): ${gained.join("; ")}`);
  });
});
