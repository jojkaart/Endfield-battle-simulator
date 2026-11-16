# Checking Arts Intensity against the logs (2026-11-16)

Task: decide from the logs and game data whether the engine's Arts
Intensity handling is right. That meant each effect's coefficient, whose
intensity a reaction uses, and whether Estella's Grizzled Edge gear advice
holds. It also meant fixing anything wrong. Branch
`worktree-agent-a02355212f106417b`, already merged into main.

## 1. Nothing in the log check gives per-hit numbers in machine-readable form

- **What happened:** the question was: for each status hit, what are the
  logged value, the engine's prediction, the source operator's Arts
  Intensity, and the verdict? `efsim zmdlogs check` prints per-operator
  verdict counts. It also prints "matched assuming" lists, single lines of
  several kilobytes (see the c4f3 output of `zmdlogs check`). These can't
  be filtered by event kind, and the operator's Arts Intensity at a hit
  isn't printed at all. I wrote a 120-line scratch script, `ai.ts`, that
  imports internals from four modules:
  - `logBuffReplay`, `engineHits`, `checkLog`, `hitPlace` from
    `packages/cli/src/logcheck.ts`;
  - `engineCheck`, `readingBasis` from `packages/cli/src/enginecheck.ts`;
  - `placeHits` from `logcasts.ts`;
  - `teamPanels` from `logeffects.ts`.

  It then recomputed each hit with `landingDamage(data, c.target,
  basis.primary.inputs, basis.primary.options)` to read the
  `"arts intensity"` scale part. Working out which function gives the
  primary reading and its inputs took about an hour of reading
  `enginecheck.ts`. Each fixture takes about 10 s, so a full run over the
  79 development logs takes about 13 minutes. I stopped the first full run
  halfway to add fields (statuses, Corrosion appliers), then reran it in
  three parallel chunks.
- **Cause:** the log check was built to produce verdicts and reports for
  humans. The data it computes per hit (prediction, scale parts, zones,
  modifiers, landing facts, verdict) has no export, and no command runs
  across all fixtures.
- **Suggestion:** add `efsim zmdlogs hits [fixture…] --json`. The default
  is every development log, with hold-outs skipped by
  `logFixtureFiles`. It writes one JSON line per logged hit:
  - fixture, t, operator, event, kind (`parseReactionEvent`), value, crit;
  - verdict and class;
  - the primary reading's exact value, `scaleParts`, `zones` and
    modifier sources;
  - the landing's `inputs.operator`;
  - for status hits, the enemy statuses from `landing.facts.enemy`, with
    their operator, level and `artsIntensity`.

  Add `--kind <reaction kind>` and `--workers n`, reusing the pool from
  `rulespool.ts`. Put the per-hit record builder in `enginecheck.ts` so
  the report and the export share it.
- **Why it helps:** questions like "does X trend with Y across all logs"
  (intensity, level, Stagger, a buff's value) become a one-line command
  plus a small analysis. Today each one costs an hour of plumbing and a
  13-minute run. The cost is one more output format to keep stable.

## 2. Who applied an infliction is not recorded anywhere

- **What happened:** to test whose intensity a reaction uses, I needed the
  operator whose infliction was consumed. `TimelineState.reactions` has
  the trigger's operator and the consumed element. `recordStatus` in
  `packages/engine/src/timeline/landing.ts` skips `inflicted` events
  (`if (e.kind === "inflicted") continue;`), and `Infliction` in
  `status.ts` has no operator. My first attempt read `inflicted` records
  and found none. I fell back to scanning the replay's kit-hit landings
  whose `inputs.hit.applies` include an infliction of that element. That
  is approximate, because it ignores `if` conditions.
- **Cause:** the enemy's arts state keeps only what damage needs, and an
  infliction's source has never mattered to damage.
- **Suggestion:** add `operators` (the appliers, in stack order) to
  `Infliction` in `status.ts`. Copy them into the `reaction` and `burst`
  `StatusEvent`s as `consumedFrom`. Alternatively, keep `inflicted`
  events in `reactions`, if the diagnosis and payoff code can ignore them.
- **Why it helps:** questions about reaction ownership, and kits keyed to
  "the operator who applied the infliction", can be answered directly and
  tested. The cost is a few bytes per state and an audit of
  `reactions` consumers if the events are kept.

## 3. Fixtures drop the source of debuff values

- **What happened:** Breach and Electrification values appear on every
  later hit as effects (`buff_physical_do_fracture`, damageTaken 0.274…).
  They have no `source` field, unlike the `unquantified` Corrosion entries,
  which have `source` and `since`. To compare a logged strength with the
  applier's Arts Intensity, I first inverted the formula to infer the
  intensity. That gave nonsense such as AI 912 wherever a skill scale
  applied. I then switched to the engine's `ActiveStatus.artsIntensity`
  from `landing.facts.enemy`, which works only where the replay has a
  landing.
- **Cause:** the ZMDLogs importer (`packages/data/src/zmdlogs.ts`) keeps
  `source` only for unquantified buffs.
- **Suggestion:** keep the raw buff event's source operator (and its start
  time) on every `LogEffect` the importer writes. Add an optional
  `source` to `schemas/log-fixture.schema.json`, and fill older fixtures
  with `efsim zmdlogs refresh` where a detail is downloaded.
- **Why it helps:** any "debuff strength against applier stats" check
  becomes direct, without depending on the replay. The cost is a schema
  change and a refresh pass.

## 4. The game data has no coefficients, and nothing says so

- **What happened:** to find each effect's coefficient, I walked every
  BuffData file for `ReadSkillSettingData`. Every reaction and status
  value (for example `碎甲物理伤害提高` for Breach strength, and
  durations) is read from a skill-setting table through
  `enhanceAttributeSource`. I then grepped both data submodules and the
  555me Lua scripts for that table and for the stat tooltip's formula. The
  table isn't in either extraction. The tooltip numbers come from C#
  (`CS.Beyond.Gameplay.PhysicalAndSpellInflictionEnhanceFormatData` in
  `CharInfoFullAttributeCtrl.lua`). About 45 minutes went into
  establishing a negative.
- **Cause:** `docs/game-data-format.md` mentions the Chinese
  skill-setting keys. It doesn't say which table holds them, that the
  table isn't extracted, or that every key carries
  `enhanceAttributeSource` regardless of whether the value scales. That
  last point means the field tells you nothing about scaling.
- **Suggestion:** add a short "What the data can't tell" section to
  `docs/game-data-format.md`. It should cover:
  - skill-setting values (the 21 keys and the files that read them,
    listed by a script under `tools/`);
  - attribute tooltip formulas (C#);
  - the fact that `enhanceAttributeSource` is present on every read;
  - the pointer to `AttributeShowConfigTable`'s hint text as the only
    data on which effects Arts Intensity touches.
- **Why it helps:** the next agent asking "what's the coefficient of X"
  goes straight to the logs. The cost is a few lines of docs.

## 5. Scratch scripts outside the worktree: imports and sandbox refusals

- **What happened:**
  - A scratch `.ts` in the scratchpad failed with `ERR_MODULE_NOT_FOUND:
    Cannot find package '@efsim/data'`. I had to switch to absolute
    `await import("<worktree>/packages/…")` paths.
  - Three Bash calls were refused as "too complex to verify that it stays
    inside the worktree": `cd` into the scratchpad plus a heredoc Python
    script, a Python heredoc reading fixtures, and a `cd` into a data
    submodule before `git`.
  - A one-liner globbing `fixtures/**/zmdlogs-*.json` was denied by the
    auto-mode classifier, correctly, because it didn't exclude hold-outs.

  Each cost a retry. I ended up writing every analysis to a file with the
  Write tool and running it by absolute path, and writing a
  `devfiles.py` helper that mirrors `logFixtureFiles`.
- **Cause:** package resolution is relative to the script's location. The
  only hold-out-safe fixture lister is `logFixtureFiles`, which lives in
  `packages/cli/src/gear.ts`, an unexpected home. No scratch template
  exists.
- **Suggestion:**
  - Move `logFixtureFiles` to `packages/cli/src/logs.ts` and export it
    from `@efsim/cli`.
  - Add `scripts/scratch-template.ts`, which imports the packages by path
    relative to the repo and lists development fixtures. Add a matching
    Python helper.
  - Note in CLAUDE.md "Worktrees and sub-agents": write scratch scripts
    with the Write tool and run them by absolute path, with no `cd` or
    heredocs.
- **Why it helps:** it removes the retry loop and makes the hold-out-safe
  path the default one. The cost is a small refactor.

## 6. An engine special case for Corrosion hid the same question for Breach

- **What happened:** the Breach bug was that its own hit saw its own new
  debuff. It sat next to an existing exception for Corrosion in
  `eventDamage` (`landing.ts`: Corrosion's own hit sees the prior
  Corrosion). The general rule "what a hit applies acts before its own
  damage" (combat-mechanics §3.2) was settled for Corrosion's forming hit.
  It was never checked for each status event's own damage. I found it
  only because Breach's intensity regression had an intercept of −0.14.
- **Cause:** whether a status event's own hit sees its status is decided
  per status in ad hoc branches. No test or doc row says what each status
  does.
- **Suggestion:** add a table to combat-mechanics §3–4: "status event's
  own hit sees its own status / the status it replaces", one row per
  reaction and physical status, tagged SETTLED / ASSUMED. Then turn the
  `eventDamage` branches into data keyed by status, with a test per row.
- **Why it helps:** the remaining ASSUMED rows (Electrification's
  initial hit; Shatter after a Breach) become visible checks instead of
  surprises. The cost is a small refactor of one function.

## What worked well

- `readingBasis` and `landingDamage` let a scratch script reproduce the
  log check's exact primary reading, with scale parts named
  (`"arts intensity"`). That made the coefficient readable per hit with
  no guessing.
- `LandedHit.facts.enemy` keeps each status's applier and `artsIntensity`.
  That made the strength check exact.
- The log check's ±1 matching rule is strong evidence: an exact match at
  a known intensity pins a coefficient far better than a regression.
- The slow log tests and the snapshot diffs (`npm run snapshots:update`)
  showed the fix's effect per fixture and operator at once.
- `docs/open-problems.md` and combat-mechanics' tags gave clear places
  to record what was ruled out.

## Outcome (round 1)

1. Per-hit export: **done.** `efsim zmdlogs hits [fixture…] [--kind] [--operator] [--json] [--workers n]` (packages/cli/src/hitexport.ts, hitsworker.ts): one record per logged hit from the check's own computations, with scale parts, zones, modifier sources, the landing's operator, kit hits' enemy statuses. Every development log (28,693 hits) in 94 s on 3 workers. Status events' own landings record no facts, so their enemy statuses come from the next kit hit's record.
2. Who applied an infliction: **done.** `Infliction.by` (one applier per stack) and `inflictionBy` on reaction and burst events (packages/engine/src/status.ts); the search's state key leaves it out; no number changed.
3. Debuff sources in fixtures: **done for new imports** (`LogEffect.source` / `since`, schema optional). Older fixtures are unchanged: their raw details aren't on disk, and fetching them all again would be a mass download. Moved to the backlog (fill them as details get cached).
4. What the data can't tell: **done.** docs/game-data-format.md "What the data can't tell" (skill-setting table not extracted, `enhanceAttributeSource` meaningless, tooltip formulas in C#, the stat hint as the only data). The listing of the 21 keys and their files: `efsim gamedata who <key>` finds every file that reads a key, so no separate script.
5. Scratch scripts: **done.** Git-ignored `scratch/` that resolves `@efsim/*`, `scripts/scratch-template.ts`, `logFixtureFiles` moved to packages/cli/src/logs.ts (exported), CLAUDE.md "Worktrees and sub-agents" command shapes. Python: `efsim zmdlogs list --json` instead of a mirror helper.
6. Status special cases: **done.** `OWN_HIT_SEES` table in status.ts (used by landing.ts eventDamage), combat-mechanics §3.8, one test per row (tests/own-hit.test.ts); behaviour unchanged.
