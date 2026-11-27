// Pending log fixtures (fixtures/pending/, and the hold-outs in fixtures/holdout/): not verified yet (fixtures/pending/README.md says why), so their
// check only pins its current state: per operator, every verdict count equals the snapshot
// (tests/snapshots/log-verdicts-pending.json, and log-verdicts-holdout.json for the hold-outs, a file of its own so a
// diff of the pending one names none: a regression baseline, not values with provenance: docs/design.md
// principle 11). Any change, better or worse, is to be looked at and the snapshot updated with it
// (`npm run snapshots:update`; the diff goes in the commit). In `npm run test:logs`, in four shards
// (logs-pending-*.test.ts) that run in parallel: all of them take minutes.
//
// So that improvements and regressions look different, each moved log's failure says its direction by the fit
// measure (scripts/accuracy.ts `direction`: plain matches, mismatches, |total damage error|), and each shard ends
// with a summary line per group (development, hold-out, earlier): how many logs got better or worse. Hold-out logs
// only ever count in the summary's numbers, and their tests are titled by a counter ("hold-out log 7"), so no run's
// output names one (the snapshot keeps the file names). The scoreboard (docs/accuracy.md) shows the aggregate change.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { loggedAsPairs, offsetHits, readLogFixture, screenOffsets, snapshotEntry, unexplainedLoggedAs, unexplainedOffsets, type LoggedAsPair, type OperatorOffset } from "@efsim/logs";
import { changes, entry, logFixtures, ROOT, shard, totalsChanges, totalsOf, type FixtureCounts } from "../logverdicts.ts";
import { Snapshot, UPDATE_HINT, UPDATING } from "../snapshot.ts";
import { direction, fitChange, GROUPS, groupOf, readSplit, withoutHoldoutOmitted, type Direction, type Entry, type Group } from "../../scripts/accuracy.ts";

export const PENDING_SHARDS = 4;

/** A pending log's test title: its file, or for a hold-out a counter ("hold-out log 7", its place among the hold-outs). */
export function testTitle(file: string, holdouts: readonly string[] = logFixtures("holdout")): string {
  return file.startsWith("holdout/") ? `hold-out log ${holdouts.indexOf(file) + 1}` : file;
}

export function pendingSuite(index: number): void {
  const data = loadGameData();
  // The hold-out logs (fixtures/holdout/) are checked here too, but only ever counted in aggregate (their group).
  const all = [...logFixtures("pending"), ...logFixtures("holdout")].sort();
  const files = shard(all, PENDING_SHARDS, index);
  const pendingSnapshot = new Snapshot<FixtureCounts>("log-verdicts-pending.json", true);
  const holdoutSnapshot = new Snapshot<FixtureCounts>("log-verdicts-holdout.json", true);
  const snapshotOf = (file: string) => (file.startsWith("holdout/") ? holdoutSnapshot : pendingSnapshot);
  const storedAll: Readonly<Record<string, FixtureCounts>> = { ...pendingSnapshot.stored, ...holdoutSnapshot.stored };
  const split = readSplit();
  const moved = new Map<Group, Direction[]>();
  // The build-offset screen's candidates per development log, from the snapshot check's own computation (no second run).
  const offsets = new Map<string, OperatorOffset[]>();
  // The likely-loggedAs screen's pairs per development log (loggedas.ts), from the same landings (round 11).
  const loggedAs = new Map<string, LoggedAsPair[]>();
  afterAll(() => {
    pendingSnapshot.write((key) => !key.startsWith("holdout/") && existsSync(join(ROOT, "fixtures", key)));
    holdoutSnapshot.write((key) => key.startsWith("holdout/") && existsSync(join(ROOT, "fixtures", key)));
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
      // The hold-outs' file by counts only: its keys are never printed.
      expect(Object.keys(pendingSnapshot.stored).filter((k) => !all.includes(k) || k.startsWith("holdout/")), `stale entries (${UPDATE_HINT})`).toEqual([]);
      expect(Object.keys(holdoutSnapshot.stored).filter((k) => !all.includes(k) || !k.startsWith("holdout/")).length, `stale hold-out entries (${UPDATE_HINT})`).toBe(0);
      expect(all.filter((f) => !(f in storedAll)).map((f) => testTitle(f)), `fixtures without an entry (${UPDATE_HINT})`).toEqual([]);
    });
  }

  describe.each(files.map((f) => [testTitle(f), f] as const))("%s", (_title, file) => {
    it("checks as its snapshot says", () => {
      const fx = readLogFixture(join(ROOT, "fixtures", file));
      // Its verdict counts and its totals' errors (the simulation of the logged casts against the log), as measure computes them.
      const { counts: now, totals: computed, byHit, verdicts } = snapshotEntry(data, fx);
      // A hold-out's entry carries no operator's own split (scripts/accuracy.ts isHoldoutOmittedKey; round 20, the lead).
      const totals = file.startsWith("holdout/") ? withoutHoldoutOmitted(computed) : computed;
      if (!file.startsWith("holdout/")) {
        offsets.set(file, unexplainedOffsets(fx, screenOffsets(offsetHits(fx, byHit, verdicts))));
        loggedAs.set(file, unexplainedLoggedAs(loggedAsPairs(data, fx, (h) => {
          const l = byHit.get(h)?.landing;
          return l && !("unknown" in l) ? l : null;
        })));
      }
      const current = entry(now, totals);
      const stored = snapshotOf(file).record(file, current);
      if (stored === undefined) return;
      const group = groupOf(file, split);
      const d = direction(stored as unknown as Entry, current as unknown as Entry);
      moved.set(group, [...(moved.get(group) ?? []), d]);
      if (UPDATING) return;
      const how = group === "holdout" ? d : `${d}${d === "same" ? "" : `: ${fitChange(stored as unknown as Entry, current as unknown as Entry)}`}`;
      expect([...changes(now, stored), ...totalsChanges(totals, totalsOf(stored))], `verdict counts or totals moved from the snapshot (by the fit measure ${how}; ${UPDATE_HINT})`).toEqual([]);
    });

    // Development logs only: a hold-out is never debugged, so its offsets are never screened.
    it.skipIf(file.startsWith("holdout/"))("has no operator off by one factor all fight that nothing accounts for (the build-offset screen)", () => {
      const open = offsets.get(file);
      if (!open) return; // the check above failed before the screen ran: its failure says why
      expect(open.map((o) => `${o.operator} ×${o.median.toFixed(4)} over ${o.n} hits, ${(100 * o.tight).toFixed(0)}% within 1%`), "a build offset (efsim zmdlogs offsets): zmdlogs fit-build, then a buildOverrides entry, or an OFFSETS_EXPLAINED one (packages/logs/src/buildoffsets.ts)").toEqual([]);
    });

    it.skipIf(file.startsWith("holdout/"))("has no kit buff counted twice beside an unmapped listed buff of the same effect (the likely-loggedAs screen)", () => {
      const open = loggedAs.get(file);
      if (!open) return; // the check above failed before the screen ran
      expect(open.map((p) => `${p.kitBuff} ~ ${p.gameBuff}: ${p.hits} hit(s) from ${(p.first / 1000).toFixed(2)} s`), "a double count (efsim zmdlogs differences lists them): the kit buff's loggedAs, or a LOGGED_AS_EXPLAINED entry (packages/logs/src/loggedas.ts)").toEqual([]);
    });
  });
}
