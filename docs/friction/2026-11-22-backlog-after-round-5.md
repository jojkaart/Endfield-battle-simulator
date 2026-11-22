# Backlog after improvement round 5 (2026-11-22)

Task: the points of the reports round 5 read (docs/friction-done/2026-11-22-round-5.md lists them) that round 5
didn't do, and round 4's backlog points still open. Each point is complete on its own; the originals are in
docs/friction-done/ with an "Outcome (round 5)" section. Points 1–20 are round 4's backlog unchanged (their "From"
names where they began); 21 on are round 5's, the first three of them remainders of round 4's points 12, 21 and 22.

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
- **From:** round 3's backlog, point 1 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 1.

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
- **From:** round 3's backlog, point 2 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 2.

## 3. Status and Stagger modifiers are identified by their `source` text
- **What happened:** the guided rule analysis keys multipliers by regexes over strings like `"Corrosion level 1"`.
- **Cause:** `Modifier` (packages/engine/src/effects.ts) has `kitBuff` for kit buffs, nothing for statuses and Stagger.
- **Suggestion:** an optional `status?: "corrosion" | "electrification" | "breach" | "stagger" | …` on `Modifier`, set
  where status.ts `statusModifiers` and the Stagger modifier are made. Audit first the log check's comparisons of
  engine and log modifiers (logcheck.ts `signature`, enginecheck.ts `loggedEntries`, logeffects.ts): a field on one
  side only could change verdicts. `npm run measure` before and after.
- **Why it helps:** analyses stop parsing display strings.
- **From:** round 3's backlog, point 3 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 3.

## 4. Test files still carry copies of the same helpers
- **What happened:** tests/helpers/synthetic.ts and buffs.ts exist, but buffreplay.test.ts, batch4-*.test.ts and
  others define their own `withKit`, `hit`, `logHit`, `fixture`, and the search tests their `expectSameFuture`. Many
  import log functions through `@efsim/cli`, which re-exports `@efsim/logs` only for compatibility.
- **Suggestion:** move each family onto tests/helpers/ (add `tests/helpers/search.ts`), one file per commit, then
  `npm run prune-unused -- <file>`; point log imports at `@efsim/logs` and drop the re-export from
  packages/cli/src/index.ts once nothing uses it.
- **Why it helps:** a split becomes one import line; helpers stop drifting. Cost: an hour of careful moves.
- **From:** round 3's backlog, point 4 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 4.

## 5. SP is a value at the state's frame, kept path-independent by a snap
- **What happened:** SP differed by float noise between advancing frame by frame and at once; `spAt` snaps
  regenerated SP to its 1/15 grid, which makes the two paths agree.
- **Suggestion:** only when a new shortcut (memoised advance, a port) needs exact path independence without the snap:
  an anchor (`sp` and its frame) that only grants, spends and the cap change. The examples' and rule runs' snapshots
  must not move.
- **Why it helps:** equality by construction. Cost: touches every SP read and write.
- **From:** round 3's backlog, point 5 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 5.

## 6. Fixed-length search times aren't documented
- **What happened:** sustained 300 s search references took 34–86 min per team (beam 6, `--single --no-macros`),
  found only by running them.
- **Suggestion:** a table in docs/design/search.md (team × length × beam → minutes, CPU seconds, load), measured with
  `node scripts/with-lock.ts npm run bench -- …` and `efsim search --duration`.
- **Why it helps:** agents can plan or skip long references. Cost: one long measuring session.
- **From:** round 3's backlog, point 6 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 6.

## 7. Prose citations of doc sections and source paths aren't checked
- **What happened:** code comments, schemas and docs cite `docs/design/x.md "Section"` and `packages/…/*.ts` as free
  text (131 files when design.md was split; round 2 wrote a four-pass rewrite script). scripts/check-links.ts checks
  only Markdown links. Round 3's docs cite sections by quoted name too ("What the log records", "Measuring a
  change").
- **Suggestion:** extend scripts/check-links.ts (run by tests/doc-links.test.ts) to code comments and JSON strings:
  every `docs/….md` mention names an existing file, every `docs/….md "Quoted"` a heading or bold label in it, every
  `packages/…/*.ts` mention an existing file. Prefer anchors in new citations.
- **Why it helps:** the next move or split is a red test listing what to fix.
- **From:** round 3's backlog, point 7 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 7.

## 8. No harness for "same CLI output" or a generic A/B of a command
- **What happened:** round 2 wrote a 48-invocation CLI comparison against an older commit by hand (with
  normalisations for timings, the provenance line and paths); the cast-placement round swapped source files to diff
  placed casts before and after. `npm run measure --base` now covers verdicts, nothing covers other output.
- **Suggestion:** `scripts/ab.ts [--ref <ref>] -- <command…>`: runs the command in the working tree and in the
  at-commit tree of the ref (scripts/at-commit.ts, reused), normalises timings (`\d+(\.\d+)? s`), the "code at
  <hash>" line and absolute paths, and prints a diff; `scripts/cli-compare.ts <ref>` on top with an invocation list
  in a JSON file beside it (every command, usage errors, bad options).
- **Why it helps:** refactors prove "same behaviour" and diagnoses diff before/after in one command.
- **From:** round 3's backlog, point 8 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 8.

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
- **From:** round 3's backlog, point 9 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 9.

## 10. The importer has no test of its own
- **What happened:** `zmdlogsToFixture` was checked only through real fixtures; the refresh round wrote
  tests/helpers/zmdlogs.ts (`syntheticDetail`) and hit an element name its types didn't catch (`nature` for
  `natural`).
- **Suggestion:** type the helper's `element` fields as the engine's `Element`; a short importer test on
  `syntheticDetail` (zones mapped, target-side zones dropped on operators, boundary effects, unquantified).
- **Why it helps:** the next importer change starts from a failing test.
- **From:** round 3's backlog, point 10 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 10.

## 11. No shared measure of teammates' attack share
- **What happened:** test 101 needed the same measure written twice (over logs and over engine runs); an older
  calibration had compared two different measures.
- **Suggestion:** a module in `@efsim/logs` (or `efsim zmdlogs pace`) computing per operator-fight the share of free
  time attacking and the gap distribution from casts {operator, kind, start, lastHit, teammate}, fed from the log
  placement and from a `TimelineResult`; a test pinning one example's share within the logs' quartiles. The pause is
  now the engine reading `teammate-pause`, so the measure can compare readings.
- **Why it helps:** engine-only behaviours become checkable against the logs.
- **From:** round 3's backlog, point 12 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 11.

## 12. The replay's step list and its ordering live inside buffreplay.ts
- **What happened:** the Stagger round replaced the step sort's hand-ordered booleans with an explicit rank inside
  the 1,700-line buffreplay.ts; docs/design/data.md now lists what the replay takes from the log.
- **Suggestion:** move the step list (casts, logged bars, Stagger steps, recoveries) and its rank into
  `packages/logs/src/replaysteps.ts` with the rank defined once; `npm run measure` must say nothing moved.
- **Why it helps:** the next follow-the-log change (or its reverse) touches one small module.
- **From:** round 3's backlog, point 17 (docs/friction-done/2026-11-18-backlog-after-round-3.md); round 4's backlog, point 13.

## 13. The cast table's gaps and units
- **What happened:** per-cast analyses reassembled `placeHits` → `distinctCasts` → `castTimeStops` → `worldMs` plus
  kit cooldowns each time; `TimeStop.start` is a frame while casts are in ms. Round 4 added `loggedSkillInstances`
  (packages/logs/src/query.ts: every real cast with its hits and cast events), which covers "the casts of X" but not
  the world-time gaps and cooldowns.
- **Suggestion:** extend `SkillInstance` with the world-time gap to the operator's previous cast of the skill
  (`worldMs` over `castTimeStops`) and its kit cooldown, and brand the log package's time fields (`Ms`, `Frames`).
- **Why it helps:** cooldown and pace questions become a filter; unit bugs fail typecheck.
- **From:** round 3's backlog, point 13; round 4's backlog, point 14.

## 14. The weapon breakthrough table isn't loaded
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
- **From:** docs/friction-done/2026-11-18-si-ardelia-build-fits.md, points 2–3; round 4's backlog, point 16.

## 15. A generic "in her ultimate" rules cue
- **What happened:** the owner's rules check flagged Akekuri's battle skill pressed during her own ultimate (it cuts
  it); the fix needed a cue "Akekuri isn't in her ultimate", which `resolveRuleList` allows only for a kit buff with a
  `visible` flag, so her kit's `zone_hold` got a guessed `visible` declaration.
- **Suggestion:** a cue `{ "inUltimate": "<operator>" }` in packages/engine/src/planning/policy.ts (beside
  `ultimate` and `combo`: type, description, resolution, evaluation from the cast to its duration's end, a rank in the
  cue table) and rules.schema.json; switch estella-si-akekuri-arcane.rules.json to it and drop the `visible` flag
  from chr_0019_karin.json `zone_hold`. Check with `node scripts/team-ab.ts --base <ref>`: the team's numbers may move
  where the two windows differ; the header's cue table changes in every rules output.
- **Why it helps:** rule lists avoid "cuts own ultimate" for every operator without kit edits or guessed visibility.
- **From:** docs/friction-done/2026-11-18-owner-queue-from-logs.md, point 3; round 4's backlog, point 17.

## 16. Kit tests pin absolute expiries
- **What happened:** buff-in-stop (a general timing rule) failed 20 tests in 13 files: kit tests asserting
  `expiresAt` as "data duration from the cast" (Akekuri, Ardelia, Lifeng, Mi Fu, Rossi, Wulfgard, Yvonne, Zhuang
  Fangyi, Laevatain) mixed the kit's value with the engine's clock rules. Round 4's `npm run smoke` finds them in 90 s,
  but each still needs a new number by hand.
- **Suggestion:** a helper in tests/helpers/ (`expectLasts(state, buff, seconds)`) that adds the engine's documented
  holds (`heldFromNow`) to a duration, and the kit tests moved onto it one file per commit.
- **Why it helps:** a clock-rule change moves the expected values with it, so only real kit regressions fail.
- **From:** docs/friction-done/2026-11-18-typhoeus-laevatain-tests.md, point 3; round 4's backlog, point 19.

## 17. Loop tests depend on engine readings they don't test
- **What happened:** adding 2 s to Stagger broke the Laevatain-alone loop searches (tests/search-loop.test.ts,
  tests/slow/search-loop-cli.test.ts: no exact loop in 12 rounds), which test the loop machinery, not Stagger.
- **Suggestion:** give the loop tests' scenarios `options.assume` pinned for the engine readings they don't test
  (done for `stagger-recovery`; add buff-in-stop, stagger-freeze), so a new reading's default doesn't move them.
- **Why it helps:** engine-rule changes stop breaking unrelated machinery tests.
- **From:** docs/friction-done/2026-11-18-owner-queue-from-logs.md, point 2; round 4's backlog, point 20.

## 18. Test texts in step with the kits
- **What happened:** test 31's text said "the engine has only the Final Strike half" months after Arcane's kit gained
  `cluster_strike_finisher` (its note: "Test 31"); a re-triage repeated it.
- **Suggestion:** a warning in `npm run check` (or `efsim kit-census`): kit notes citing "test N" whose section in
  docs/in-game-tests.md doesn't name that kit's trigger or buff id; and when a kit batch closes a question, the test is
  struck or linked in the same change.
- **Why it helps:** stale tests stop looking open. Risk: noise from loose mentions, so a warning only.
- **From:** docs/friction-done/2026-11-18-arcane-akekuri-tests.md, point 5; retriage-01-40.md, point 3; round 4's backlog, point 23.

## 19. Kit notes may rest on disabled actions
- **What happened:** Liino's volley trigger rested on a CheckBuffIdInContext that is `isEnable: false` (hidden by
  `gamedata tree` until 2026-11-18). There are hundreds of disabled actions in operator files.
- **Suggestion:** a one-off script: for each action a kit's `sources` / `note` names by type and file, check its
  `isEnable`; list the kit claims that rest on a disabled one for a kit batch to re-read.
- **Why it helps:** finds misreadings like the volleys' before they reach an in-game test.
- **From:** docs/friction-done/2026-11-18-liino-volleys.md, point 1; round 4's backlog, point 24.

## 20. Who wears what, and an operator's event keys
- **What happened:** re-triage agents needed "which logs have weapon or gear X, on whom" and "an operator's distinct
  event keys with counts and the kit skill each maps to", and wrote scripts for both. Round 4's `zmdlogs list --ids`
  prints weapon names per log and `efsim kit` the keys per kit hit, but neither is a query.
- **Suggestion:** `zmdlogs list --weapon <re> | --gear <re>` (log, operator, potential, skill levels), and `zmdlogs
  census --select event:<re> --by-key` (each key's count per log and the kit hit it maps to, findHits); optionally a
  generated docs table with a staleness check like the journal's.
- **Why it helps:** "LOGS IF" vs "LOGS" in a triage becomes a lookup.
- **From:** docs/friction-done/2026-11-18-retriage-41-75.md, points 1 and 4; retriage-76-109.md, point 2; round 4's backlog, point 25.

## 21. `--assumptions` doesn't run the engine's readings
- **What happened:** round 3 registered control-immunity, teammate-pause, buff-in-stop and others as engine
  assumptions (packages/engine/src/timeline/assumptions.ts); `--assume` takes them, and round 5's `efsim assumptions`
  lists them with their readings, but cli/assume.ts `alternatives()` (the robustness check of `rules`, `gear`,
  `diagnose --assumptions`) still runs only the kits'.
- **Suggestion:** add the engine's readings to `alternatives()` where they apply (control-immunity when a kit has a
  freezing control status, teammate-pause when teammateAttacks is on, buff-in-stop always), and say so in `efsim rules
  --help`. The default run's numbers don't move; `--assumptions` runs a few more checks.
- **Why it helps:** conclusions get checked against the engine's open readings too.
- **From:** round 4's backlog, point 12 (round 3's point 14).

## 22. Kit-buff windows: the log's lanes, the replay's window and the engine's own end, joined
- **What happened:** four reports asked for the same join in different words: round 4's backlog point 21 (the
  replay's window over each listed run with the engine's own end), Rossi (each lane's world-time length paired with
  the replay's window of a kit buff), Twilight (per lane with a natural end, the bracket [last listed, next unlisted
  hit] against the replay's expiry with the holds past it; and a state's bracket from the casts that show it on and
  off). Round 5 added `zmdlogs lanes --world` (each run's world-time length) and `zmdlogs worldtime`; the join itself
  is still a scratch script each time (scratch/final-win.ts, scratch/twl/fg.ts, both.ts, twilight2.ts).
- **Suggestion:** one view, `efsim zmdlogs windows <fixture…> --kit-buff owner:id [--listed <buff re>] [--on <cast
  re> --off <cast re>]`: per replay instance, the log's bracket (from the listed runs, or from the casts with
  --on/--off), the replay's window, the engine's own end (the expiry before any log-driven step, from the trace), the
  stop time inside, world-time lengths of both, "engine ended first" / "log ended first"; with several logs a summary
  of the excess; `--json` for fits.
- **Why it helps:** Twilight, Forgeborn, Rossi's Wolven Blood and crit DMG, Si's Amp, Liino's stance, Arcane's modes
  and in-game tests 12, 107, 110 reduce to that table.
- **From:** round 4's backlog, point 21; docs/friction-done/2026-11-22-rossi.md point 3; -twilight.md points 2 and
  3.

## 23. groups: off under both readings or only under the replay's
- **What happened:** `zmdlogs groups` sorts own mismatches by skill event and by difference, and since round 5 lists
  the fallback matches by event with their median ratio, but doesn't split mismatches into "off under both readings"
  (a build or kit value) and "off only under the replay's" (timing), and doesn't count the replay's FORCED casts as a
  cause; the check's per-operator line doesn't give the share of damage from fallback-matched hits (Perlica's 9090
  totals were −9.4% "although every hit matches").
- **Suggestion:** in views.ts `groupsReport`, split own mismatches by `logError` (within ±1 under the log's reading
  or not); count hits after a FORCED cast of the operator as their own cause; in the check's per-operator summary,
  the share of the totals from fallback matches.
- **Why it helps:** the cause of a mismatch group shows in the summary instead of a hit-by-hit read.
- **From:** round 4's backlog, point 22; docs/friction-done/2026-11-22-perlica.md point 1.

## 24. No interval selectors in census
- **What happened:** the finisher-gate agent's question was per Stagger (who is controlled, enhanced attacks in it, a
  Finisher before or after them); `zmdlogs census` selections are points (`buff:` items are a lane's start), so
  nothing can be an interval to look inside. Three scratch-script versions, each wrong in a new way, about an hour.
- **Suggestion:** in packages/logs/src/query.ts give `Item` an optional end; selectors `stagger:` (the log's Stagger
  runs, views.ts staggerRuns) and `control:<op>` (controlSpans); `buff:` items get their lane's end (`nextUnlisted`);
  `--inside <sel>` beside `--near` (items whose time falls inside an interval item of the other selection), with the
  rerun line.
- **Why it helps:** most in-game-test questions from the logs are "X during Y"; a rerunnable census line is what
  data.md "A claim from the logs cites its selection" asks for.
- **From:** docs/friction-done/2026-11-18-finisher-gate.md, point 1.

## 25. A ticking buff's ticks and holds: logged against replayed
- **What happened:** Rossi's bleed drift and Liino's Cosmovoice gap both needed each logged tick against the replay's
  and the holds behind a buff: Rossi wrote scratch/tick-offsets.ts (logged ticks of a buff's tick trigger against the
  replay's nearest tick, offsets, the steps over 80 ms with the stops between, the lane's world-time drift); Liino
  added temporary `process.stderr.write` lines to `heldTicks` and `addBuff` (Zhuang Fangyi's ultimate at the end of
  Liino's stop had extended Cosmovoice by its 78 frames). `zmdlogs cadence` groups by a 1 s gap (merging a 1 s tick
  train); `--trace-buff` records `expiresAt` changes only, not `nextTick`, and not the slow-downs a new buff was held
  by.
- **Suggestion:** (a) `efsim zmdlogs ticks <fixture> --buff owner:id`: each logged tick (the buff's tick trigger's
  hits, or its `ticksLoggedAs` events) with the nearest replayed tick, the offset, the stops between and the drift;
  (b) `--trace-buff` also traces `nextTick` changes and, at a buff's creation, the held frames and the slow-downs
  behind them (actions.ts `heldFromNow`: start, length, exempt operator).
- **Why it helps:** every periodic kit (bleeds, Combustion, Liino's beats and volleys, Arcane's seal) gets the same
  first check in one command; tick timing was the round's most common open cause.
- **From:** docs/friction-done/2026-11-22-rossi.md point 2; -liino-beats.md point 2.

## 26. The replay's enemy statuses have no view
- **What happened:** "how many Vulnerable stacks does the replay have when Gilberta's ultimate lands, and from which
  adds" had no command; two scratch scripts over `BuffReplay.reactions` beside the logged airborne / crush hits found
  the cause (Rossi's Lift 0.46 s before every logged airborne hit) in minutes, after ~30 min of reading kits.
- **Suggestion:** `efsim zmdlogs statuses <fixture> [--from --to] [--kind vulnerable|physical|reaction|infliction]`:
  the replay's status events (before → after stacks, operator) with the logged status hits (buff_physical_*, reaction
  keys) interleaved and their offset, as `replay`'s LAND lines.
- **Why it helps:** physical statuses, Vulnerable and inflictions drive many kit conditions (Gilberta, Mi Fu, Chen,
  Rossi, Da Pan).
- **From:** docs/friction-done/2026-11-22-gilberta-zhuang.md point 1.

## 27. A cast's two variants both landing raises no flag
- **What happened:** the replay landed Rossi's combo 3 "late" hit (the jumped path) and its pinned "perfect" hit for
  the same cast; `replay` showed it (`replay only` 14 frames before `= logged`) but nothing flagged it, and a 9a80
  diagnosis missed it for a week. The branch fixed the jump; the flag is open.
- **Suggestion:** a CastFlag kind "both-variants" in buffreplay.ts when hits of one cast that a jump separates both
  land, counted in `replay`'s header like FORCED / INSIDE. `npm run measure` must stay byte for byte (a flag only).
- **Why it helps:** the same pattern exists wherever a kit models variants by a jump (Rossi, Arclight, Typhoeus's
  hover).
- **From:** docs/friction-done/2026-11-22-gilberta-zhuang.md point 2.

## 28. One skill's hits across logs with their zones
- **What happened:** Perlica's combo comparison over ten logs needed scratch/pcombo*.py over `zmdlogs hits <log>
  --operator perlica --json` (one call per log; `--all` took over two minutes), printing ratio, crit, scale,
  damageBonus, damageTaken, the modifiers and the listed buffs; "the missing factor is additive in DMG" fell out of
  that table.
- **Suggestion:** `efsim zmdlogs hits --operator <op> --event <re> --zones` (from the hits cache, over the development
  logs by default with --operator): one line per hit with logged ÷ primary, crit, and each zone that isn't 1.
- **Why it helps:** a missing-modifier diagnosis becomes a minute's read.
- **From:** docs/friction-done/2026-11-22-perlica.md point 2.

## 29. `differences` blames the applying hit for a buff it creates
- **What happened:** `zmdlogs differences` said P3, Pulser Labs and Wild Wanderer were "engine only" on Perlica's
  combo hits, which suggested the engine had too much: the log lists a buff only from the hit after the one that
  creates it (now in data.md "Common misreadings").
- **Suggestion:** in `zmdlogs differences`, mark a difference on a hit that itself created the buff (its source's own
  trigger at that landing's frame) as "created by this hit (not listable)" rather than "engine only".
- **Why it helps:** removes a misleading lead from every kit whose beforeDamage triggers fire on the applying hit.
- **From:** docs/friction-done/2026-11-22-perlica.md point 3.

## 30. A no-landing reason that hides an unlogged crit
- **What happened:** Seething Blood extras during Rossi's ultimates had no landing because the log gives her ultimate
  stabs no crit at all; the replay's reason ("a landing whose order the kit doesn't give") didn't say the trigger
  needed a crit. The branch added the misreading line and shownCrits.
- **Suggestion:** where a trigger hit gets no landing and its trigger's crit condition failed only because the
  source hit's crit is unlogged (`crit: null`), say so in the no-landing reason.
- **Why it helps:** 116 of Rossi's mismatches came from this; other crit-triggered kits share the blind spot.
- **From:** docs/friction-done/2026-11-22-rossi.md point 4.

## 31. Open rule questions go stale as the engine moves
- **What happened:** the rule-objective brief's three questions came with numbers from 2026-11-16; at the base commit
  all had moved, two signs flipped (Estella on Stagger, Ink Melt's `shows` edit, the Twilight hold), and nothing said
  so.
- **Suggestion:** keep the open rule questions as data (`examples/<team>.questions.json`: base list, edited list,
  the claim, its commit) and give team-ab (or `rules --questions`) a pass that re-measures each on both starts and
  flags a verdict that changed sign or significance since its recorded commit.
- **Why it helps:** the owner's calls are re-checked before anyone spends hours on them.
- **From:** docs/friction-done/2026-11-22-rule-objective.md point 1.

## 32. Who inflicts what, as a team table
- **What happened:** Corrosion setups needed, per operator and button, the element its hits inflict; round 5's
  `efsim kit` lists each hit's applications, but a team-level table needs a script (policyguide.ts
  `buttonInflictions` exists).
- **Suggestion:** `efsim kit-census --team <a,b,c,d>` (or `efsim kit --team`): who inflicts which element with which
  button, forced reactions and consumes, from `buttonInflictions`.
- **Why it helps:** which reactions a team can form becomes one command.
- **From:** docs/friction-done/2026-11-22-rule-objective.md point 4.

## 33. A buff's holds past its modelled end need a kit edit
- **What happened:** to count the holds Twilight's longer game window collects, the agent set its kit duration to 45 s
  (refused by the kit check, then a too-short `dataOverride` reason), three edits of a tracked kit file restored by
  hand, and a measure waiting with the patched kit on disk.
- **Suggestion:** `zmdlogs replay --trace-buff owner:id --long` (or `--buff-duration owner:id=s`, replay-only) keeping
  the instance alive and printing cumulative held frames per step; `measure --kit-duration owner:id=s` for the same in
  measurements. Replay behaviour under an option: its own journal entry, default runs byte for byte.
- **Why it helps:** every "runs longer than its model" question starts with this count.
- **From:** docs/friction-done/2026-11-22-twilight.md point 1.

## 34. The log reading's parts and a consumed buff's layers per cast
- **What happened:** Yinglung's Edge layers per combo had to be decoded from damage: `zmdlogs hits --json` gives the
  log reading only as a rounded value, not its zones or the kit buffs it dropped (no logged name), so a script can't
  tell "the log reading lacks Edge" from "it lacks an ATK buff"; no per-cast aggregate exists. A third of the session.
- **Suggestion:** (a) `logReading` as an object in hitexport.ts (value, zones, modifiers, the kit buffs dropped);
  (b) `zmdlogs consumed <fixture…> --buff <kit buff>`: per cast that consumes it, the engine's layers (ReplayCastFacts
  consumed) and the layers each reading's median implies, with agreement and exactness, other consumed buffs (Jade
  Vessel) solved jointly.
- **Why it helps:** every "is the replay's count of X right" question (Edge, Jade Vessel, Lustrous Carmine,
  Bonekrusha) needs exactly this.
- **From:** docs/friction-done/2026-11-22-yinglung-edge.md point 1.

## 35. `zmdlogs instances` and the replay's casts disagree silently
- **What happened:** 9555's Last Rite battle skill is a replay cast (from her phantom's hits, filed under a trigger
  group) with no instance; db87's Laevatain battle skill is an event-only instance and a placed variant 1.9 s later,
  both made by the replay. Round 5's EVENT lines in `zmdlogs replay` say what the replay made of each cast event, but
  the instances view still has only the query layer's casts.
- **Suggestion:** `zmdlogs instances --replay`: each instance with the cast the replay makes for it, the replay-only
  casts (from a buff end, from trigger hits), and a flag on an event-only instance followed within LOGGED_CAST_MS of
  world time by a placed same-slot variant.
- **Why it helps:** a census over instances then counts what the engine counts.
- **From:** docs/friction-done/2026-11-22-yinglung-edge.md point 2.

## 36. A "batched" mark on log times
- **What happened:** the Arcane agent spent hours on ±0.5 s residuals before seeing that the log batches timestamps;
  round 5 documented it (data.md "Timestamps are batched"), but no view marks a hit at a ms many hits share.
- **Suggestion:** in `zmdlogs casts` and `replay`, a count after each HIT / LAND line's logged time when more than,
  say, three logged hits share that ms.
- **Why it helps:** a residual at a batched ms reads as such at once.
- **From:** docs/friction-done/2026-11-22-arcane-imprisonment.md point 1.

## 37. smoke and snapshots read the tree when their turn comes
- **What happened:** round 5 made measure and team-ab fix their code at queue time (a snapshot commit in its own
  worktree); `npm run smoke` and `npm run snapshots:update` still run the working tree's tests when the lock comes,
  so an agent can't edit while they wait. snapshots.sh's INT/TERM trap is deferred while vitest runs in the
  foreground (a kill of the shell alone waits for vitest to end; a group kill is fine).
- **Suggestion:** smoke: run vitest in a snapshot worktree (at-commit.ts `snapshotCommit` + `atCommit`, its own
  configs); snapshots.sh can't (it writes the tree's snapshot files) but can refuse to start on a tree that changed
  since it was queued. Run its vitest steps through the background-and-wait pattern of scripts/done-line.sh.
- **Why it helps:** every locked job's wait becomes free time.
- **From:** improvement round 5 (docs/friction-done/2026-11-22-round-5.md).

## Needs an accuracy or search task (not friction work)

- **`launch` delays the next cast, `beside` casts included** (docs/friction-done/2026-11-22-liino-beats.md point 4):
  exempting `beside` casts from timing.ts `ownHitsLanded` changes engine timing; smoke and team-ab.
- **Which skill a logged press is** (docs/friction-done/2026-11-22-yinglung-edge.md point 4): mark a press and a nearby
  placed variant as alternatives of one slot in withLoggedCasts and let makeCast drop the one the state rules out
  (db87's double Twilight battle skill; 04d4's Purrchena counter must stay); measure moves.
- **A cheaper guided rule search** (docs/friction-done/2026-11-22-rule-objective.md point 3): a screening stage on
  shorter fights or a control variate (roadmap "cheaper variance"), and resumable guided searches.

## What worked well

The round-5 reports named their scratch prototypes and functions; `npm run measure` (byte for byte in a minute) kept
the replay refactor safe.
