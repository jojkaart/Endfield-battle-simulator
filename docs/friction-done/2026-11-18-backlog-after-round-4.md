# Backlog after improvement round 4 (2026-11-18)

Task: the points of the reports round 4 read (docs/friction-done/2026-11-18-round-4.md lists them) that round 4
didn't do, and round 3's backlog points still open. Each point is complete on its own; the originals are in
docs/friction-done/ with an "Outcome (round 4)" section.

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
- **From:** round 3's backlog, point 1 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

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
- **From:** round 3's backlog, point 2 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 3. Status and Stagger modifiers are identified by their `source` text
- **What happened:** the guided rule analysis keys multipliers by regexes over strings like `"Corrosion level 1"`.
- **Cause:** `Modifier` (packages/engine/src/effects.ts) has `kitBuff` for kit buffs, nothing for statuses and Stagger.
- **Suggestion:** an optional `status?: "corrosion" | "electrification" | "breach" | "stagger" | …` on `Modifier`, set
  where status.ts `statusModifiers` and the Stagger modifier are made. Audit first the log check's comparisons of
  engine and log modifiers (logcheck.ts `signature`, enginecheck.ts `loggedEntries`, logeffects.ts): a field on one
  side only could change verdicts. `npm run measure` before and after.
- **Why it helps:** analyses stop parsing display strings.
- **From:** round 3's backlog, point 3 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 4. Test files still carry copies of the same helpers
- **What happened:** tests/helpers/synthetic.ts and buffs.ts exist, but buffreplay.test.ts, batch4-*.test.ts and
  others define their own `withKit`, `hit`, `logHit`, `fixture`, and the search tests their `expectSameFuture`. Many
  import log functions through `@efsim/cli`, which re-exports `@efsim/logs` only for compatibility.
- **Suggestion:** move each family onto tests/helpers/ (add `tests/helpers/search.ts`), one file per commit, then
  `npm run prune-unused -- <file>`; point log imports at `@efsim/logs` and drop the re-export from
  packages/cli/src/index.ts once nothing uses it.
- **Why it helps:** a split becomes one import line; helpers stop drifting. Cost: an hour of careful moves.
- **From:** round 3's backlog, point 4 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 5. SP is a value at the state's frame, kept path-independent by a snap
- **What happened:** SP differed by float noise between advancing frame by frame and at once; `spAt` snaps
  regenerated SP to its 1/15 grid, which makes the two paths agree.
- **Suggestion:** only when a new shortcut (memoised advance, a port) needs exact path independence without the snap:
  an anchor (`sp` and its frame) that only grants, spends and the cap change. The examples' and rule runs' snapshots
  must not move.
- **Why it helps:** equality by construction. Cost: touches every SP read and write.
- **From:** round 3's backlog, point 5 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 6. Fixed-length search times aren't documented
- **What happened:** sustained 300 s search references took 34–86 min per team (beam 6, `--single --no-macros`),
  found only by running them.
- **Suggestion:** a table in docs/design/search.md (team × length × beam → minutes, CPU seconds, load), measured with
  `node scripts/with-lock.ts npm run bench -- …` and `efsim search --duration`.
- **Why it helps:** agents can plan or skip long references. Cost: one long measuring session.
- **From:** round 3's backlog, point 6 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 7. Prose citations of doc sections and source paths aren't checked
- **What happened:** code comments, schemas and docs cite `docs/design/x.md "Section"` and `packages/…/*.ts` as free
  text (131 files when design.md was split; round 2 wrote a four-pass rewrite script). scripts/check-links.ts checks
  only Markdown links. Round 3's docs cite sections by quoted name too ("What the log records", "Measuring a
  change").
- **Suggestion:** extend scripts/check-links.ts (run by tests/doc-links.test.ts) to code comments and JSON strings:
  every `docs/….md` mention names an existing file, every `docs/….md "Quoted"` a heading or bold label in it, every
  `packages/…/*.ts` mention an existing file. Prefer anchors in new citations.
- **Why it helps:** the next move or split is a red test listing what to fix.
- **From:** round 3's backlog, point 7 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 8. No harness for "same CLI output" or a generic A/B of a command
- **What happened:** round 2 wrote a 48-invocation CLI comparison against an older commit by hand (with
  normalisations for timings, the provenance line and paths); the cast-placement round swapped source files to diff
  placed casts before and after. `npm run measure --base` now covers verdicts, nothing covers other output.
- **Suggestion:** `scripts/ab.ts [--ref <ref>] -- <command…>`: runs the command in the working tree and in the
  at-commit tree of the ref (scripts/at-commit.ts, reused), normalises timings (`\d+(\.\d+)? s`), the "code at
  <hash>" line and absolute paths, and prints a diff; `scripts/cli-compare.ts <ref>` on top with an invocation list
  in a JSON file beside it (every command, usage errors, bad options).
- **Why it helps:** refactors prove "same behaviour" and diagnoses diff before/after in one command.
- **From:** round 3's backlog, point 8 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

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
- **From:** round 3's backlog, point 9 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 10. The importer has no test of its own
- **What happened:** `zmdlogsToFixture` was checked only through real fixtures; the refresh round wrote
  tests/helpers/zmdlogs.ts (`syntheticDetail`) and hit an element name its types didn't catch (`nature` for
  `natural`).
- **Suggestion:** type the helper's `element` fields as the engine's `Element`; a short importer test on
  `syntheticDetail` (zones mapped, target-side zones dropped on operators, boundary effects, unquantified).
- **Why it helps:** the next importer change starts from a failing test.
- **From:** round 3's backlog, point 10 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 11. No shared measure of teammates' attack share
- **What happened:** test 101 needed the same measure written twice (over logs and over engine runs); an older
  calibration had compared two different measures.
- **Suggestion:** a module in `@efsim/logs` (or `efsim zmdlogs pace`) computing per operator-fight the share of free
  time attacking and the gap distribution from casts {operator, kind, start, lastHit, teammate}, fed from the log
  placement and from a `TimelineResult`; a test pinning one example's share within the logs' quartiles. The pause is
  now the engine reading `teammate-pause`, so the measure can compare readings.
- **Why it helps:** engine-only behaviours become checkable against the logs.
- **From:** round 3's backlog, point 12 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 12. `--assumptions` doesn't run the engine's readings
- **What happened:** round 3 registered control-immunity and teammate-pause as engine assumptions (packages/engine/
  src/timeline/assumptions.ts); `--assume` takes them, but cli/assume.ts `alternatives()` (the robustness check of
  `rules`, `gear`, `diagnose --assumptions`) lists only the kits'.
- **Suggestion:** add the engine's readings to `alternatives()` where they apply (control-immunity when a kit has a
  freezing control status, teammate-pause when teammateAttacks is on), and list both kinds in `efsim rules --help`.
  The default run's numbers don't move; `--assumptions` runs a few more checks.
- **Why it helps:** conclusions get checked against the engine's open readings too.
- **From:** round 3's backlog, point 14 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 13. The replay's step list and its ordering live inside buffreplay.ts
- **What happened:** the Stagger round replaced the step sort's hand-ordered booleans with an explicit rank inside
  the 1,700-line buffreplay.ts; docs/design/data.md now lists what the replay takes from the log.
- **Suggestion:** move the step list (casts, logged bars, Stagger steps, recoveries) and its rank into
  `packages/logs/src/replaysteps.ts` with the rank defined once; `npm run measure` must say nothing moved.
- **Why it helps:** the next follow-the-log change (or its reverse) touches one small module.
- **From:** round 3's backlog, point 17 (docs/friction-done/2026-11-18-backlog-after-round-3.md).

## 14. The cast table's gaps and units
- **What happened:** per-cast analyses reassembled `placeHits` → `distinctCasts` → `castTimeStops` → `worldMs` plus
  kit cooldowns each time; `TimeStop.start` is a frame while casts are in ms. Round 4 added `loggedSkillInstances`
  (packages/logs/src/query.ts: every real cast with its hits and cast events), which covers "the casts of X" but not
  the world-time gaps and cooldowns.
- **Suggestion:** extend `SkillInstance` with the world-time gap to the operator's previous cast of the skill
  (`worldMs` over `castTimeStops`) and its kit cooldown, and brand the log package's time fields (`Ms`, `Frames`).
- **Why it helps:** cooldown and pace questions become a filter; unit bugs fail typecheck.
- **From:** round 3's backlog, point 13.

## 15. Logged hidden casts aren't used as timing facts
- **What happened:** Arcane's combo appears in the log again 6.5–8 s after each real one: the CastSkill of
  `combo_skill_abilityentity_end` at Imprisonment's natural end (docs/design/data.md "What the log records"). Round 4's
  `zmdlogs instances` marks these ("an entity's end logged as a cast"), but the placement and `withLoggedCasts` still
  treat them as presses (which then fail on cooldown).
- **Suggestion:** a kit field (`loggedAs`-style, on the entity's end) naming such events, read by the placement as a
  marker, not a press; the replay could then end Imprisonment there (as it takes reaction levels from the log).
  `npm run measure` will move: a deliberate change with its own journal entry.
- **Why it helps:** a nuisance becomes evidence for a buff's real end (4d60's short windows are open).
- **From:** round 3's backlog, point 15.

## 16. The weapon breakthrough table isn't loaded
- **What happened:** f978's build fit needed which weapon skill levels a breakthrough allows;
  `WeaponBreakThroughTemplateTable` isn't in packages/data/tables.json, so it isn't fetched, and an agent read it with
  `git show` from a scratch shell script. Round 4 wrote the procedure (data/README.md "Adding a table") but didn't add
  the table: it changes the main checkout's shared sparse data and needs the lead before a merge.
- **Suggestion:** the lead (or an agent the lead asks) adds `WeaponBreakThroughTemplateTable` to tables.json, runs
  `./scripts/fetch-data.sh` in the main checkout, loads the per-breakthrough skill-level bounds into `WeaponData`
  (packages/data/src/tables/weapons.ts), and has `zmdlogs fit-build` (packages/logs/src/buildfit.ts) try only weapon
  levels the logged skill levels allow, plus weapon skill levels and artifice as candidates. `npm run measure`: nothing
  moves (fit-build isn't in the check).
- **Why it helps:** weapon-level fits (c3c7, f978, Alesh in 0c14) stop needing hand checks.
- **From:** docs/friction-done/2026-11-18-si-ardelia-build-fits.md, points 2–3.

## 17. A generic "in her ultimate" rules cue
- **What happened:** the owner's rules check flagged Akekuri's battle skill pressed during her own ultimate (it cuts
  it); the fix needed a cue "Akekuri isn't in her ultimate", which `resolveRuleList` allows only for a kit buff with a
  `visible` flag, so her kit's `zone_hold` got a guessed `visible` declaration.
- **Suggestion:** a cue `{ "inUltimate": "<operator>" }` in packages/engine/src/planning/policy.ts (beside
  `ultimate` and `combo`: type, description, resolution, evaluation from the cast to its duration's end, a rank in the
  cue table) and rules.schema.json; switch estella-si-akekuri-arcane.rules.json to it and drop the `visible` flag
  from chr_0019_karin.json `zone_hold`. Check with `node scripts/team-ab.ts --base <ref>`: the team's numbers may move
  where the two windows differ; the header's cue table changes in every rules output.
- **Why it helps:** rule lists avoid "cuts own ultimate" for every operator without kit edits or guessed visibility.
- **From:** docs/friction-done/2026-11-18-owner-queue-from-logs.md, point 3.

## 18. Liino's beats as a ticking buff
- **What happened:** Liino's Cosmovoice beats are fixed-frame hits of a trigger (`ult_song`), while her stance's
  volleys are a ticking buff, so `KitBuff.ticksShownByHits` (which fixed the volleys' drift) can't pin the beats.
  The beats' timing is open (docs/open-problems.md "Liino's Cosmovoice beats").
- **Suggestion:** let `ticksShownByHits` apply to a trigger's evenly spaced `frames` (pin each to its logged landing),
  or rewrite periodic beats as a ticking buff where the data has a `triggerInterval`; a kit lint could flag evenly
  spaced frames that come from a buff tick. Moves verdicts: measure, snapshots, a journal entry.
- **Why it helps:** one replay mechanism for every periodic hit.
- **From:** docs/friction-done/2026-11-18-liino-perlica-tests.md, point 6.

## 19. Kit tests pin absolute expiries
- **What happened:** buff-in-stop (a general timing rule) failed 20 tests in 13 files: kit tests asserting
  `expiresAt` as "data duration from the cast" (Akekuri, Ardelia, Lifeng, Mi Fu, Rossi, Wulfgard, Yvonne, Zhuang
  Fangyi, Laevatain) mixed the kit's value with the engine's clock rules. Round 4's `npm run smoke` finds them in 90 s,
  but each still needs a new number by hand.
- **Suggestion:** a helper in tests/helpers/ (`expectLasts(state, buff, seconds)`) that adds the engine's documented
  holds (`heldFromNow`) to a duration, and the kit tests moved onto it one file per commit.
- **Why it helps:** a clock-rule change moves the expected values with it, so only real kit regressions fail.
- **From:** docs/friction-done/2026-11-18-typhoeus-laevatain-tests.md, point 3.

## 20. Loop tests depend on engine readings they don't test
- **What happened:** adding 2 s to Stagger broke the Laevatain-alone loop searches (tests/search-loop.test.ts,
  tests/slow/search-loop-cli.test.ts: no exact loop in 12 rounds), which test the loop machinery, not Stagger.
- **Suggestion:** give the loop tests' scenarios `options.assume` pinned for the engine readings they don't test
  (done for `stagger-recovery`; add buff-in-stop, stagger-freeze), so a new reading's default doesn't move them.
- **Why it helps:** engine-rule changes stop breaking unrelated machinery tests.
- **From:** docs/friction-done/2026-11-18-owner-queue-from-logs.md, point 2.

## 21. Kit-buff windows: the engine's own end, and the log's lanes beside them
- **What happened:** `zmdlogs stagger` gives the engine's own Stagger end in both directions (`engineEnd`,
  `engineCut`), but `zmdlogs replay --kit-buff` prints the replay's window, which can end at a log-driven point. Round
  4's `--trace-buff` shows each expiry change step by step, and `zmdlogs lanes` the log's runs, but nothing joins them.
- **Suggestion:** `efsim zmdlogs windows <fixture> --listed <buff re> --kit-buff owner:id`: one row per listed run
  (first, last, next unlisted hit) with the replay's window over it, the engine's own end (from the trace: the expiry
  before any log-driven step) and the stop time inside, "engine ended first" / "log ended first".
- **Why it helps:** tests 12, 107, 110 and the buff-timing open problems reduce to that table.
- **From:** docs/friction-done/2026-11-18-owner-queue-from-logs.md, points 1 and 4.

## 22. groups and casts don't show the replay's own doubts
- **What happened:** round 4 added the log's reading per hit (`logReading`) and the replay's FORCED / INSIDE casts,
  but `zmdlogs groups` still sorts mismatches by the primary reading alone, and `zmdlogs casts` doesn't say which of
  the log's cast events the replay made into casts (Si's battle-button events: some become strokes, some don't).
- **Suggestion:** in `groupsReport`, split own mismatches into "off under both readings" (build or kit value) and
  "off only under the replay's" (timing), and count the replay's forced casts as a cause; in `castsView`, mark each
  EVENT line with what the replay did with it (made as <skill>, skipped, a slot press).
- **Why it helps:** the cause of a mismatch group shows in the summary instead of a hit-by-hit read.
- **From:** docs/friction-done/2026-11-18-si-ardelia-build-fits.md, points 1 and 5; liino-volleys.md, point 3.

## 23. Test texts in step with the kits
- **What happened:** test 31's text said "the engine has only the Final Strike half" months after Arcane's kit gained
  `cluster_strike_finisher` (its note: "Test 31"); a re-triage repeated it.
- **Suggestion:** a warning in `npm run check` (or `efsim kit-census`): kit notes citing "test N" whose section in
  docs/in-game-tests.md doesn't name that kit's trigger or buff id; and when a kit batch closes a question, the test is
  struck or linked in the same change.
- **Why it helps:** stale tests stop looking open. Risk: noise from loose mentions, so a warning only.
- **From:** docs/friction-done/2026-11-18-arcane-akekuri-tests.md, point 5; retriage-01-40.md, point 3.

## 24. Kit notes may rest on disabled actions
- **What happened:** Liino's volley trigger rested on a CheckBuffIdInContext that is `isEnable: false` (hidden by
  `gamedata tree` until 2026-11-18). There are hundreds of disabled actions in operator files.
- **Suggestion:** a one-off script: for each action a kit's `sources` / `note` names by type and file, check its
  `isEnable`; list the kit claims that rest on a disabled one for a kit batch to re-read.
- **Why it helps:** finds misreadings like the volleys' before they reach an in-game test.
- **From:** docs/friction-done/2026-11-18-liino-volleys.md, point 1.

## 25. Who wears what, and an operator's event keys
- **What happened:** re-triage agents needed "which logs have weapon or gear X, on whom" and "an operator's distinct
  event keys with counts and the kit skill each maps to", and wrote scripts for both. Round 4's `zmdlogs list --ids`
  prints weapon names per log and `efsim kit` the keys per kit hit, but neither is a query.
- **Suggestion:** `zmdlogs list --weapon <re> | --gear <re>` (log, operator, potential, skill levels), and `zmdlogs
  census --select event:<re> --by-key` (each key's count per log and the kit hit it maps to, findHits); optionally a
  generated docs table with a staleness check like the journal's.
- **Why it helps:** "LOGS IF" vs "LOGS" in a triage becomes a lookup.
- **From:** docs/friction-done/2026-11-18-retriage-41-75.md, points 1 and 4; retriage-76-109.md, point 2.

## What worked well

The reports' episodes named the exact functions and files, so most fixes started from a working scratch prototype or
a precise reading of the code; `npm run measure` answering "byte for byte" in a minute made every refactor of the
replay and the check safe to land one at a time.

## Outcome (round 5)

2026-11-22, improvement round 5 (docs/friction-done/2026-11-22-round-5.md); what's left is in docs/friction/2026-11-22-backlog-after-round-5.md.

- 1 (game-data file reads), 2 (status landing facts), 3 (status modifiers by kind), 4 (test helpers), 5 (the SP anchor), 6 (search times), 7 (prose citations), 8 (an A/B harness for CLI output), 9 (status log keys), 10 (an importer test), 11 (a pace measure), 13 (the replay's step list), 14 (cast-table gaps and units), 16 (the breakthrough table: needs the lead), 17 (the `inUltimate` cue: moves team numbers), 19 (`expectLasts`), 20 (loop tests pinning readings), 23 (test texts in step with kits), 24 (kit notes on disabled actions), 25 (who wears what): not done, carried over to the round-5 backlog unchanged.
- 12 (`--assumptions` runs the engine's readings): not done; `efsim assumptions` now lists both kinds with their readings (c9247da), which is the listing half; running them in `alternatives()` is carried over to the round-5 backlog.
- 15 (Imprisonment's logged end as timing facts): done by the Arcane branch merged before this round (fbac1dd: `ticksLoggedAs`, `endFollowsTick`, COMBO_EVENT_MS); this round adds `zmdlogs replay`'s EVENT lines (cec2dd6), which show what the replay made of each such event.
- 18 (Liino's beats as a ticking buff): done by the Liino branch merged before this round (29cd4b6, feca370: her song's beats are `cosmovoice_beat` ticks pinned to the log); the placement rule it needed is now in docs/design/data.md ("One key, several groups", c9247da).
- 21 (kit-buff windows with the engine's own end and the log's lanes): partly: `zmdlogs lanes --world` gives each listed run's world-time length (cec2dd6); the joined `zmdlogs windows` view is carried over to the round-5 backlog (merged with the Twilight and Rossi reports' versions).
- 22 (groups and casts showing the replay's doubts): partly: `zmdlogs groups` ends with the fallback matches by skill event and their median logged ÷ primary, and `zmdlogs replay` marks each logged cast event with what the replay made of it (cec2dd6); splitting own mismatches by both readings is carried over to the round-5 backlog.
