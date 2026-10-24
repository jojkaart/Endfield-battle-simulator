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
import { checkLog, readLogFixture, verdictCounts, verificationProblems } from "@efsim/cli";
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

describe.each(files)("%s", (file) => {
  const fx = readLogFixture(join(ROOT, "fixtures", file));

  it("was verified against the current data commits", () => {
    expect(fx.provenance.verifiedAgainst).toEqual(Object.fromEntries(SOURCES.map((s) => [s, sourceCommit(s)])));
  });

  it("is verified, and its verdict counts don't fall behind the snapshot", () => {
    const verdicts = checkLog(data, fx);
    expect(verificationProblems(data, fx, verdicts)).toEqual([]);
    const now = verdictCounts(fx, verdicts);
    const stored = snapshot.record(file, now);
    if (UPDATING || stored === undefined) return;
    expect(regressions(now, stored), `verdict counts fell behind the snapshot (${UPDATE_HINT}); all changes: ${changes(now, stored).join("; ")}`).toEqual([]);
    const gained = changes(now, stored);
    if (gained.length) console.info(`${file}: counts moved past the snapshot (update it to keep the gain): ${gained.join("; ")}`);
  });
});
