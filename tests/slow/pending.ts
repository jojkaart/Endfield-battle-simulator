// Pending log fixtures (fixtures/pending/, and the hold-outs in fixtures/holdout/): not verified yet (fixtures/pending/README.md says why), so their
// check only pins its current state: per operator, every verdict count equals the snapshot
// (tests/snapshots/log-verdicts-pending.json, a regression baseline, not values with provenance: docs/design.md
// principle 11). Any change, better or worse, is to be looked at and the snapshot updated with it
// (`npm run snapshots:update`; the diff goes in the commit). In `npm run test:logs`, in four shards
// (logs-pending-*.test.ts) that run in parallel: all of them take minutes.
//
// So that improvements and regressions look different, each moved log's failure says its direction by the fit
// measure (scripts/accuracy.ts `direction`: plain matches, mismatches, |total damage error|), and each shard ends
// with a summary line per group (development, hold-out, earlier): how many logs got better or worse. Hold-out logs
// only ever count in the summary's numbers. The scoreboard (docs/accuracy.md) shows the aggregate change.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, engineHits, engineReport, logBuffReplay, readLogFixture, verdictCounts } from "@efsim/cli";
import { changes, entry, logFixtures, ROOT, shard, totalsChanges, totalsOf, type FixtureCounts } from "../logverdicts.ts";
import { Snapshot, UPDATE_HINT, UPDATING } from "../snapshot.ts";
import { direction, fitChange, GROUPS, groupOf, readSplit, type Direction, type Entry, type Group } from "../../scripts/accuracy.ts";

export const PENDING_SHARDS = 4;

export function pendingSuite(index: number): void {
  const data = loadGameData();
  // The hold-out logs (fixtures/holdout/) are checked here too, but only ever counted in aggregate (their group).
  const all = [...logFixtures("pending"), ...logFixtures("holdout")].sort();
  const files = shard(all, PENDING_SHARDS, index);
  const snapshot = new Snapshot<FixtureCounts>("log-verdicts-pending.json", true);
  const split = readSplit();
  const moved = new Map<Group, Direction[]>();
  afterAll(() => {
    snapshot.write((key) => existsSync(join(ROOT, "fixtures", key)));
    const summary = GROUPS.flatMap((g) => {
      const ds = moved.get(g);
      if (!ds?.length) return [];
      const n = (d: Direction) => ds.filter((x) => x === d).length;
      return [`${g} ${n("better")} better, ${n("worse")} worse, ${n("mixed")} mixed, ${n("other")} other, ${n("same")} unchanged`];
    });
    // Written past vitest's console capture (which hides a passing file's output), so every run shows it.
    process.stdout.write(`pending logs against the snapshot (shard ${index + 1} of ${PENDING_SHARDS}, by plain matches, mismatches and |total damage error|): ${summary.join("; ") || "no stored entry to compare with"}\n`);
  });

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
      const current = entry(now, totals);
      const stored = snapshot.record(file, current);
      if (stored === undefined) return;
      const group = groupOf(file, split);
      const d = direction(stored as unknown as Entry, current as unknown as Entry);
      moved.set(group, [...(moved.get(group) ?? []), d]);
      if (UPDATING) return;
      const how = group === "holdout" ? d : `${d}${d === "same" ? "" : `: ${fitChange(stored as unknown as Entry, current as unknown as Entry)}`}`;
      expect([...changes(now, stored), ...totalsChanges(totals, totalsOf(stored))], `verdict counts or totals moved from the snapshot (by the fit measure ${how}; ${UPDATE_HINT})`).toEqual([]);
    });
  });
}
