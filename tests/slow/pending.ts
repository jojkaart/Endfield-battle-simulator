// Pending log fixtures (fixtures/pending/): not verified yet (fixtures/pending/README.md says why), so their
// check only pins its current state: per operator, every verdict count equals the snapshot
// (tests/snapshots/log-verdicts-pending.json, a regression baseline, not values with provenance: docs/design.md
// principle 11). Any change, better or worse, is to be looked at and the snapshot updated with it
// (`npm run snapshots:update`; the diff goes in the commit). In `npm run test:logs`, in two shards
// (logs-pending-*.test.ts) that run in parallel: all of them take minutes.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, engineHits, engineReport, logBuffReplay, readLogFixture, verdictCounts } from "@efsim/cli";
import { changes, entry, logFixtures, ROOT, shard, totalsChanges, totalsOf, type FixtureCounts } from "../logverdicts.ts";
import { Snapshot, UPDATE_HINT, UPDATING } from "../snapshot.ts";

export const PENDING_SHARDS = 2;

export function pendingSuite(index: number): void {
  const data = loadGameData();
  const all = logFixtures("pending");
  const files = shard(all, PENDING_SHARDS, index);
  const snapshot = new Snapshot<FixtureCounts>("log-verdicts-pending.json", true);
  afterAll(() => snapshot.write((key) => existsSync(join(ROOT, "fixtures", key))));

  if (index === 0) {
    it("has a verdict snapshot for every pending fixture and none for a fixture that isn't one", () => {
      if (UPDATING) return;
      expect(Object.keys(snapshot.stored).filter((k) => !all.includes(k)), `stale entries (${UPDATE_HINT})`).toEqual([]);
      expect(all.filter((f) => !(f in snapshot.stored)), `fixtures without an entry (${UPDATE_HINT})`).toEqual([]);
    });
  }

  describe.each(files)("%s", (file) => {
    it("checks as its snapshot says", () => {
      const fx = readLogFixture(join(ROOT, "fixtures", file));
      const replay = logBuffReplay(data, fx);
      const byHit = engineHits(data, fx, replay);
      const verdicts = checkLog(data, fx, { replay, engineHits: byHit });
      const now = verdictCounts(fx, verdicts);
      // Its totals' errors too (the simulation of the logged casts against the log: engineReport).
      const totals = engineReport(data, fx, replay, byHit, verdicts).errors;
      const stored = snapshot.record(file, entry(now, totals));
      if (UPDATING || stored === undefined) return;
      expect([...changes(now, stored), ...totalsChanges(totals, totalsOf(stored))], `verdict counts or totals moved from the snapshot (${UPDATE_HINT})`).toEqual([]);
    });
  });
}
