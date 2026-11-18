# Si's misfit logs and Ardelia's build offsets (2026-11-18)

Task: diagnose and fix Si's misfits in 0c14, 9555 and c83c and Ardelia's in f978 and 1d91 (build inputs or kit rules),
and consider a structured build fitter. Branch `worktree-agent-a45480e450dce6470` (fit-build, `buildOverrides`, engine
assumption `battle-sub-skills`).

## 1. No tool recomputes a hit with the log's listing, so build offsets hid behind replay differences

- **What happened:** 0c14's Si had been written off as "no constant factor; a food alone leaves 0.91–1.15". The
  `zmdlogs hits --json` "predicted" value is the replay's primary reading, so every hit mixed the build error with
  the replay's buff differences (Alesh's team ATK, P3, the unlogged Yinglung and Jade Vessel layers). It took a
  hand-written scratch script (`scratch/logpredict.py`: ATK from the panel's base × (1 + panel ATK% + the log's ATK
  entries) × attribute bonus, DMG from the panel plus the log's entries) to see that her ratio was ×1.1543 without
  Alesh's +0.16 DMG and ×1.1322 with it, i.e. an additive DMG plus an ATK factor (Kunst Tube and two nodes). Before
  that, about an hour went to a food sweep through the whole check (below) and to reading zones by hand.
- **Cause:** the check reports the replay's reading and, separately, "differences"; there is no view of "what the
  log's own listing predicts" per hit, though the log check builds that reading internally (readingBasis's
  log-listing alternatives).
- **Suggestion:** add `--reading log` to `efsim zmdlogs hits` (or a `log` field in each JSON record): the hit
  recomputed with the log's listed effects in place of the replay's kit buffs (the check's log-listing fallback
  reading), plus its ratio. Summaries in `zmdlogs groups` could then split "off under both readings" (build or kit
  value) from "off only under the replay's" (timing).
- **Why it helps:** a build offset is then one ratio per DMG composition, visible in seconds; it would have shown
  0c14, 9555 and f978 at once. Cost: one more reading per hit in the export (cheap: no replay).

## 2. Trying build variants through checkLog is minutes per log

- **What happened:** the first food sweep (`scratch/variants.ts`: 37 foods × checkLog on 0c14) ran 1–2 min per
  variant under load, behind the shared lock; I stopped it after 11 variants with nothing usable (the replay
  differences dominated every count). `fit-build` now recomputes the primary reading with each candidate's panel
  (`landingDamage` with `inputs.build`/`panel` swapped), ~10 s for 16,000 candidates.
- **Cause:** the only public way to score a build was the full check (placement, replay, every reading).
- **Suggestion:** keep `buildfit.ts`'s approach as the pattern (one replay, then landingDamage per candidate), and
  note in docs/design/tests.md "Measuring a change" that build questions go to `zmdlogs fit-build`, not measure or
  checkLog loops. Extend it next with weapon skill levels, artifice and the breakthrough bound (3).
- **Why it helps:** build hypotheses become a seconds-long command instead of a background job.

## 3. The weapon breakthrough table isn't loadable, so weapon levels can't be bounded by the data

- **What happened:** f978's fit needed the weapon's breakthrough bounds (which skill levels a breakthrough allows).
  `WeaponBreakThroughTemplateTable` isn't in `packages/data/tables.json`, so it isn't checked out; I read it with
  `git show HEAD:TableCfg/...` inside the main checkout's submodule from a scratch shell script. Adding it properly
  would change the main checkout's sparse submodule (shared by every worktree), which a sub-agent shouldn't do.
- **Cause:** the table list is curated and fetched once into the shared main checkout; a worktree has no data of its
  own and no sanctioned way to add a table.
- **Suggestion:** the lead adds `WeaponBreakThroughTemplateTable` (and loads `skillLevelBounds` per breakthrough into
  `WeaponData`), then `fit-build` filters weapon levels by the logged skill levels. More generally: a documented
  procedure (data/README.md) for "a sub-agent needs a new table": ask the lead, or a script that extends the shared
  sparse checkout safely.
- **Why it helps:** removes hand checks from every weapon-level fit (c3c7, f978, Alesh's in 0c14) and a hacky
  read path.

## 4. The worktree guard refuses ordinary inline scripts

- **What happened:** several `python3 -c` one-liners with loops, a heredoc and a `sed` + `grep` chain were refused as
  "too complex to verify"; each cost a retry via the Write tool and a scratch file. CLAUDE.md warns about heredocs,
  but plain `python3 -c "for ..."` and multi-statement `&&` chains were refused too, unpredictably (similar ones
  passed earlier).
- **Cause:** the guard judges the whole command text; which shapes pass isn't stable.
- **Suggestion:** in CLAUDE.md's command-shapes list, say "any inline program (python -c, node -e, heredoc) goes into
  scratch/ via Write" as the rule, not only heredocs and multi-line python.
- **Why it helps:** fewer refused calls; small cost.

## 5. Si's battle-button events are undocumented

- **What happened:** c83c's Yinglung fits depend on which of Si's 26 "normal_skill" cast events in 99 s are real
  presses. They come every 3.2–3.6 s, mostly hitless and while she does basic attacks; the replay turns some into
  strokes (Yinglung layers at 51.77 and 85.13 s) and not others. Liino's equivalent (stance beats, `ticksLoggedAs`)
  is documented in open-problems; Si's isn't anywhere, and I spent a while finding out why some count.
- **Cause:** docs/design/data.md "What the log records" lists cast-event habits per skill kind but not these periodic
  events, and the replay's slot-press rule (`withLoggedCasts`) makes them casts silently.
- **Suggestion:** a line in "What the log records" for Si's periodic battle-button events (open: presses or ticks),
  and `zmdlogs casts` marking an EVENT the replay made into a cast versus one it skipped.
- **Why it helps:** the next agent on Si's combos or Yinglung (test 106) starts from the known gap.

## What worked well

- `npm run measure` (and `--assume`) answered "is this better" in about a minute per idea; the hold-out row in its
  summary stopped the `battle-sub-skills` default switch before it was committed.
- `efsim zmdlogs groups` pointed at the right logs immediately; `zmdlogs casts` / `replay --kit-buff` made the
  Yinglung windows and Alesh's missing combo visible.
- Engine assumptions (`timeline/assumptions.ts`) made an open reading a switch with a test in under an hour.
- `snapshots:update` and premerge ran unattended with clear `EFSIM-DONE` lines.

## Outcome (round 4)

2026-11-18, improvement round 4 (docs/friction-done/2026-11-18-round-4.md); what's left is in docs/friction/2026-11-18-backlog-after-round-4.md.

1. Done (4de8cb2): every hit record has `logReading` / `logError` (ReadingBasis.logReading: each team kit buff as the
   log lists it, the engine's statuses kept); `zmdlogs hits --reading log` prints it. Splitting `zmdlogs groups` into
   "off under both readings" and "off only under the replay's": round-4 backlog.
2. Done (f6259ef): data.md's question table sends build offsets to `hits --reading log`, then `zmdlogs fit-build`.
   Weapon skill levels and artifice in fit-build: round-4 backlog.
3. Partly (e8131c1): data/README.md "Adding a table" (ask the lead; read a table meanwhile with `git show` into
   scratch/; the lead adds it to tables.json and runs fetch-data.sh in the main checkout). The table itself isn't
   added: that changes the shared sparse checkout and needs the lead before a merge (round-4 backlog, with the steps).
4. Done (e8131c1): CLAUDE.md's command shapes: any inline program into scratch/ (the existing rule) and batch edits
   through `scratch/patch.py`.
5. Done (f6259ef, ec22f1c): Si's battle-button events in "Common misreadings"; `zmdlogs instances` lists them as
   "an event only". Marking in `zmdlogs casts` which events the replay made into casts: round-4 backlog.
