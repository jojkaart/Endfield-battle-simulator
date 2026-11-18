# Backlog after improvement round 3 (2026-11-18)

Task: the points of the seven reports round 3 read (docs/friction-done/2026-11-16-backlog-after-round-2.md,
-round-2-friction.md, 2026-11-17-fixture-refresh.md, -tests-from-logs.md, 2026-11-18-arcane-mismatches.md,
-cast-placement.md, -stagger-windows.md) that round 3 (docs/friction-done/2026-11-18-round-3.md) didn't do. Each
point is complete on its own; the originals are in docs/friction-done/ with an "Outcome (round 3)" section.

## 1. Game-data file reads are scattered, so table files are keyed by size and time

- **What happened:** the compiled game-data cache (packages/data/src/cache.ts) is keyed by a hash of its inputs. The
  code part is exact (`dataSources`, traced from gameData.ts; the engine's core through core.ts), but the data files
  are keyed by proxies: each source's commit, each table file's size and time, each rmxlinux `Json/` folder's time.
  An in-place edit of one SkillData file that leaves its folder's time unchanged goes unnoticed. The files are read
  at about 40 call sites in eight modules (sources.ts `readTable`, skillData.ts, buffData.ts, skillCompile.ts,
  skillGraph.ts, kits.ts, foods.ts, some `readdirSync`), each building its own path.
- **Cause:** the data package has no single place where it touches the data directory.
- **Suggestion:** one module, `packages/data/src/dataFiles.ts` (`readDataJson(source, relPath)`, `dataFileExists`,
  `listDataDir`), building every path under `sourceDir` and recording what it touched; the cache entry stores the
  recorded paths with sizes and times and checks them on read (`data-file:` labels in `gameDataCacheInputs`, so
  `rebuildReason` names the file). An ESLint `no-restricted-imports` of `node:fs` in packages/data/src (but that
  module, cache.ts and kits.ts) keeps it so.
- **Why it helps:** an exact key instead of proxies. Cost: a mechanical refactor; the cache's "cached equals fresh"
  test checks it.

## 2. Status-event landings record no `facts`

- **What happened:** `zmdlogs hits --json` gives kit hits the enemy's statuses (`landing.enemy`, now with physical
  ones), but status landings (reactions, bursts, Combustion ticks, Lift, Shatter) have no `facts`: landing.ts
  `eventDamage` builds its landing without them.
- **Cause:** `LandingFacts` is shaped for kit hits (stacks, consumed, castLink, buffLayers).
- **Suggestion:** a `StatusLandingFacts` (`enemy`, `staggered`, `enemyHp`) recorded in `eventDamage` under
  `ctx.loggedCrits`, as a separate `statusFacts` field on `LandedHit` (a union would make buffreplay.ts' "free
  landings" filter `h.ref === undefined && h.facts` see status landings). Run `npm run measure` before and after:
  nothing may move.
- **Why it helps:** "which statuses were on the enemy when this burst landed" becomes one field. Cost: small.

## 3. Status and Stagger modifiers are identified by their `source` text

- **What happened:** the guided rule analysis keys multipliers by regexes over strings like `"Corrosion level 1"`.
- **Cause:** `Modifier` (packages/engine/src/effects.ts) has `kitBuff` for kit buffs, nothing for statuses and Stagger.
- **Suggestion:** an optional `status?: "corrosion" | "electrification" | "breach" | "stagger" | …` on `Modifier`, set
  where status.ts `statusModifiers` and the Stagger modifier are made. Audit first the log check's comparisons of
  engine and log modifiers (logcheck.ts `signature`, enginecheck.ts `loggedEntries`, logeffects.ts): a field on one
  side only could change verdicts. `npm run measure` before and after.
- **Why it helps:** analyses stop parsing display strings.

## 4. Test files still carry copies of the same helpers

- **What happened:** tests/helpers/synthetic.ts and buffs.ts exist, but buffreplay.test.ts, batch4-*.test.ts and
  others define their own `withKit`, `hit`, `logHit`, `fixture`, and the search tests their `expectSameFuture`. Many
  import log functions through `@efsim/cli`, which re-exports `@efsim/logs` only for compatibility.
- **Suggestion:** move each family onto tests/helpers/ (add `tests/helpers/search.ts`), one file per commit, then
  `npm run prune-unused -- <file>`; point log imports at `@efsim/logs` and drop the re-export from
  packages/cli/src/index.ts once nothing uses it.
- **Why it helps:** a split becomes one import line; helpers stop drifting. Cost: an hour of careful moves.

## 5. SP is a value at the state's frame, kept path-independent by a snap

- **What happened:** SP differed by float noise between advancing frame by frame and at once; `spAt` snaps
  regenerated SP to its 1/15 grid, which makes the two paths agree.
- **Suggestion:** only when a new shortcut (memoised advance, a port) needs exact path independence without the snap:
  an anchor (`sp` and its frame) that only grants, spends and the cap change. The examples' and rule runs' snapshots
  must not move.
- **Why it helps:** equality by construction. Cost: touches every SP read and write.

## 6. Fixed-length search times aren't documented

- **What happened:** sustained 300 s search references took 34–86 min per team (beam 6, `--single --no-macros`),
  found only by running them.
- **Suggestion:** a table in docs/design/search.md (team × length × beam → minutes, CPU seconds, load), measured with
  `node scripts/with-lock.ts npm run bench -- …` and `efsim search --duration`.
- **Why it helps:** agents can plan or skip long references. Cost: one long measuring session.

## 7. Prose citations of doc sections and source paths aren't checked

- **What happened:** code comments, schemas and docs cite `docs/design/x.md "Section"` and `packages/…/*.ts` as free
  text (131 files when design.md was split; round 2 wrote a four-pass rewrite script). scripts/check-links.ts checks
  only Markdown links. Round 3's docs cite sections by quoted name too ("What the log records", "Measuring a
  change").
- **Suggestion:** extend scripts/check-links.ts (run by tests/doc-links.test.ts) to code comments and JSON strings:
  every `docs/….md` mention names an existing file, every `docs/….md "Quoted"` a heading or bold label in it, every
  `packages/…/*.ts` mention an existing file. Prefer anchors in new citations.
- **Why it helps:** the next move or split is a red test listing what to fix.

## 8. No harness for "same CLI output" or a generic A/B of a command

- **What happened:** round 2 wrote a 48-invocation CLI comparison against an older commit by hand (with
  normalisations for timings, the provenance line and paths); the cast-placement round swapped source files to diff
  placed casts before and after. `npm run measure --base` now covers verdicts, nothing covers other output.
- **Suggestion:** `scripts/ab.ts [--ref <ref>] -- <command…>`: runs the command in the working tree and in the
  at-commit tree of the ref (scripts/at-commit.ts, reused), normalises timings (`\d+(\.\d+)? s`), the "code at
  <hash>" line and absolute paths, and prints a diff; `scripts/cli-compare.ts <ref>` on top with an invocation list
  in a JSON file beside it (every command, usage errors, bad options).
- **Why it helps:** refactors prove "same behaviour" and diagnoses diff before/after in one command.

## 9. Status log keys only in a doc table; a buff lane's start unexplained

- **What happened:** docs/design/data.md "What the log records" now lists each status's event key and debuff-lane
  key, but code that pairs logged effects with engine statuses still has them only where a check needed them
  (`PHYSICAL_KEYS`, `PHYSICAL_EVENT_KINDS`, `isCorrosionBuff`, `ENGINE_STATUS_BUFF`). Against the replay's
  Electrification `appliedAt`, a lane's `since` agrees within 300 ms for only 1,212 of 3,705 hits: first application
  or latest refresh is unknown.
- **Suggestion:** `STATUS_LOG_KEYS: Record<status, { event?: string; debuff?: string }>` in packages/logs
  (logeffects.ts), built on the engine's tables, used by the export and analyses; then measure `since` against the
  replay's first application and latest refresh per status with `zmdlogs hits --json` (`appliedAtMs`) and record the
  answer in data.md.
- **Why it helps:** debuff-strength-vs-applier analyses start from a table and a known lane semantics.

## 10. The importer has no test of its own

- **What happened:** `zmdlogsToFixture` was checked only through real fixtures; the refresh round wrote
  tests/helpers/zmdlogs.ts (`syntheticDetail`) and hit an element name its types didn't catch (`nature` for
  `natural`).
- **Suggestion:** type the helper's `element` fields as the engine's `Element`; a short importer test on
  `syntheticDetail` (zones mapped, target-side zones dropped on operators, boundary effects, unquantified).
- **Why it helps:** the next importer change starts from a failing test.

## 11. An engine timing change breaks example timelines, with no repair command

- **What happened:** removing Haste's cast speed made five Si examples unplayable; the agent copied gear.ts' private
  repaired replay into a scratch script and wrote frames where the scenario file wants seconds (one more snapshot
  cycle).
- **Suggestion:** `efsim repair <scenario.json> [--write]`, exporting gear.ts' repaired replay (moves and drops
  reported) and writing through `search --out`'s serializer; tests/examples.test.ts names it on an EngineError; each
  example records the search that made it in a machine-readable field.
- **Why it helps:** a timing change becomes a one-command fix without unit mistakes.

## 12. No shared measure of teammates' attack share

- **What happened:** test 101 needed the same measure written twice (over logs and over engine runs); an older
  calibration had compared two different measures.
- **Suggestion:** a module in `@efsim/logs` (or `efsim zmdlogs pace`) computing per operator-fight the share of free
  time attacking and the gap distribution from casts {operator, kind, start, lastHit, teammate}, fed from the log
  placement and from a `TimelineResult`; a test pinning one example's share within the logs' quartiles. The pause is
  now the engine reading `teammate-pause`, so the measure can compare readings.
- **Why it helps:** engine-only behaviours become checkable against the logs.

## 13. No cast-table helper; units only in comments

- **What happened:** per-cast analyses reassembled `placeHits` → `distinctCasts` → `castTimeStops` → `worldMs` plus
  kit cooldowns each time; hitless logged casts live only in `fx.casts`; `TimeStop.start` is a frame while casts are
  in ms (now said in its comment and in data.md). `zmdlogs casts` prints the view, not a structure.
- **Suggestion:** `logCastTable(data, fx)` in packages/logs returning every cast (placed and hitless logged ones) with
  operator, skill, kind, start and last hit (ms), teammate flag, world-time gaps to the operator's previous cast and
  its kit cooldown; branded `Ms` / `Frames` types on the log package's time fields.
- **Why it helps:** most cast questions become a 20-line script without unit bugs.

## 14. `--assumptions` doesn't run the engine's readings

- **What happened:** round 3 registered control-immunity and teammate-pause as engine assumptions (packages/engine/
  src/timeline/assumptions.ts); `--assume` takes them, but cli/assume.ts `alternatives()` (the robustness check of
  `rules`, `gear`, `diagnose --assumptions`) lists only the kits'.
- **Suggestion:** add the engine's readings to `alternatives()` where they apply (control-immunity when a kit has a
  freezing control status, teammate-pause when teammateAttacks is on), and list both kinds in `efsim rules --help`.
  The default run's numbers don't move; `--assumptions` runs a few more checks.
- **Why it helps:** conclusions get checked against the engine's open readings too.

## 15. Logged hidden casts aren't used as timing facts

- **What happened:** Arcane's combo appears in the log again about 6.5 s after each real one: the CastSkill of
  `combo_skill_abilityentity_end` at Imprisonment's natural end (docs/design/data.md "What the log records"). The
  placement and `withLoggedCasts` treat it as a press, which fails on cooldown.
- **Suggestion:** a kit field (`loggedAs`-style, on the entity's end) naming such events, read by the placement as a
  marker, not a press; the replay could then end Imprisonment there (as it takes reaction levels from the log).
- **Why it helps:** a nuisance becomes evidence for a buff's real end (4d60's short windows are open).

## 16. No CLI view of a skill's timing

- **What happened:** the cast-placement round wrote scratch/timing.ts for a skill's slow-downs, duration, kit hit
  frames and enemyDelay.
- **Suggestion:** `efsim kit <operator> --skill <id>` (or a `zmdlogs casts --timing` section) printing those from
  `data.skills[id].timing` and the effective kit.
- **Why it helps:** placement diagnoses start with it.

## 17. The replay's step list and its ordering live inside buffreplay.ts

- **What happened:** the Stagger round replaced the step sort's hand-ordered booleans with an explicit rank inside
  the 1,700-line buffreplay.ts; docs/design/data.md now lists what the replay takes from the log.
- **Suggestion:** move the step list (casts, logged bars, Stagger steps, recoveries) and its rank into
  `packages/logs/src/replaysteps.ts` with the rank defined once; `npm run measure` must say nothing moved.
- **Why it helps:** the next follow-the-log change (or its reverse) touches one small module.

## What worked well

The reports' points were specific enough to implement from the text alone; the prototypes left in old worktrees'
scratch/ folders (stagger-*.ts, place.ts, landings.ts, arcane-groups.py) were the specification of the new views.

## Outcome (round 4)

2026-11-18, improvement round 4 (docs/friction-done/2026-11-18-round-4.md); what's left is in docs/friction/2026-11-18-backlog-after-round-4.md.

- 11 (repair): done (70dc452): `efsim repair`, gear.ts repairRotation, the examples test names it.
- 16 (a skill's timing): done (f749798): `efsim kit <operator> --skill <re>`.
- 13 (cast table): partly (ec22f1c): `loggedSkillInstances` (every cast, placed or hitless, with its hits and events);
  the world-time gaps and cooldowns per cast and branded Ms/Frames types stay in the round-4 backlog.
- 15 (Imprisonment's logged end): partly (ec22f1c): `zmdlogs instances` marks such events; using them as timing
  facts stays in the backlog.
- The rest (1–10, 12, 14, 17) carried over unchanged to the round-4 backlog.
