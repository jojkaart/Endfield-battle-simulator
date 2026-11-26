# What ends Arcane's Doubles Susceptibility (2026-11-26)

Task: find what ends Arcane's combo Susceptibility before Si's combo final in e82d and 6339, check it on every Arcane
log, implement and measure (branch worktree-agent-a398015d0b6e84aab). Outcome: 6339's ends are the slug's purges
(engine assumption `logged-purges`), e82d's stays open.

## 1. No view says "which of the enemy's debuffs ended at this moment, and which went on"

- **What happened:** the decisive fact (6339's and 7b54's Doubles ends were every team debuff on the slug ending at
  once) took three scratch scripts: a per-run survey (`buffLanes` plus `worldMs` per run), a two-moment listing diff
  (scratch/listdiff.ts: entries listed at t1 and not at t2), and a detector over every log for moments where several
  enemy-side runs end together. `zmdlogs lanes` gives one buff's runs; `zmdlogs raw` gives lanes with no grouping by
  end. The previous round had the same question ("what ends it?") and stopped at "a stage rule in 6339?" for want of
  this view.
- **Cause:** the views are per buff (lanes, clock, trace-buff); none is per moment across buffs.
- **Suggestion:** `efsim zmdlogs ends <fixture> [--at <s>] [--side enemy|team]`: for each logged moment (or one), the
  runs whose last listing it is, grouped by holder side and source, with the runs listed on across it; with `--at`
  the listing diff of that moment against the next. loggedPurges (holdinputs.ts) is one rule over the same table.
- **Files:** packages/logs/src/query.ts (beside buffLanes), packages/cli/src/commands/zmdlogs.ts,
  docs/design/data.md ("Questions and the command that answers them").
- **Why it helps:** "did this buff end alone or with everything else?" is the first question for every early end (a
  stage phase, a second life, a kit's own rule) and is now three scripts.

## 2. `gamedata tree` doesn't show which instance a re-application keeps

- **What happened:** e82d hinges on what a second Imprisonment does to the first (seal: maxStackCnt 1, no
  stackingType; its Susceptibility: stackingType 2, maxStackCnt 1, childOf the seal). The tree prints the raw numbers;
  docs/game-data-format.md lists stackingType's 13 values as "order to verify". I read the seal, seal_total, seal2,
  seal_listener, seal_again, abilityentity_end, precheck and the passive (about 30 minutes) without being able to say
  whether the new or the old instance survives.
- **Cause:** stackingType's meanings are unverified and not shown inline; no table records the logs that would decide
  each value.
- **Suggestion:** have `gamedata tree` print `stackingSettings` with the engine's current reading of the type (and
  "unverified" where it is), and keep in docs/game-data-format.md a per-type list of the kits and logs that decided
  it (Jade Vessel's type 11, the WILL lines' type 1, type 8's shared timer).
- **Files:** packages/cli/src/gamedata.ts (ENUMS), docs/game-data-format.md.
- **Why it helps:** a buff's re-application rule is a frequent unknown (Doubles, Jade Vessel, Yinglung's Edge); each
  agent re-derives it from scattered kit notes.

## 3. A log's batching makes "listed 87 ms after X" undecidable, and the docs say so only in passing

- **What happened:** e82d's last inside listing is 87 ms after the second touch, its boundary 191 ms after; whether
  the touch ended it hangs on that. The rule ("the log's ms are batched, so under ~0.2 s isn't evidence") is a note in
  `zmdlogs worldtime`'s output and docs/design/data.md, not something the lanes or survey tell me per run.
- **Cause:** the batching grain isn't measured per log or per stretch (Si's combo slashes come 87–104 ms apart).
- **Suggestion:** `zmdlogs lanes` prints, beside a run's end, the log's moment spacing there (the gap to the moments
  before and after), so an end within one grain of an event is flagged as such.
- **Files:** packages/logs/src/query.ts (lanesView).
- **Why it helps:** stops agents building on sub-grain timing, or dismissing a cause that sits inside one grain.

## What worked well

- `zmdlogs hits --reading log`: the log's reading at 0.0% against the replay's −28.7% on every hit after 11.27 s
  made the purge obvious and gave the test for it.
- `measure --base … --at HEAD` in about three minutes, three times: the 3aa6 false positive showed up as the one
  worse earlier-pending log and fixed the rule.
- The `held` hook in buffreplay.ts (heldTicks, heldToLoggedEnds): a log-read rule slots in as one function.

## Outcome (round 16)

- 1 (No view says "which of the enemy's debuffs ended at this moment, and which went on"): done (b80f668): `efsim
  zmdlogs ends <fixture> [--at s] [--side enemy|team] [--min n]` (packages/logs/src/endsview.ts listedRuns,
  momentEnds): per logged moment the runs ending together (a debuff's affixes once) and how many of the side go on,
  "(all)" for a purge's shape and PURGE where loggedPurges reads one; `--at` one moment's END / ON / START runs with
  each end's next unlisted moment and the cast events within its grain. tests/ends-view.test.ts on 6339's two purges
  and e82d's 8.93 s end.
- 2 (`gamedata tree` doesn't show which instance a re-application keeps): done (117d16e): `ENUMS.stackingType` prints
  the engine's reading beside each type ("unverified" with Endaxis' label where nothing decides it), and
  docs/game-data-format.md "stackingType readings" names what decided each (b7b3, 9555, test 62, the inflictions,
  Jade Vessel) and the open question of e82d's second touch. Which instance a second application keeps is still
  undecided (one log).
- 3 (A log's batching makes "listed 87 ms after X" undecidable, and the docs say so only in passing): done (b80f668):
  `zmdlogs lanes` prints the moment spacing at each run's last listing and the cast events within it ("no order
  against the end"); `zmdlogs ends` prints it per moment; docs/design/data.md's batching line names both.
