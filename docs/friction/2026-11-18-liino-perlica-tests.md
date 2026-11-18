# Liino's and Perlica's in-game tests from the logs (2026-11-18)

Task: decide from the logs the open in-game tests on Liino and Perlica (6, 25–28, 66–68, 93), fix the engine where the
logs showed it wrong (Liino's tenth Cosmovoice beat), measure, update snapshots and the team page. Branch: the
worktree agent-af1cb1b7111306310, base 6cddc31.

## 1. A measure killed by its own queue wait

- **What happened:** `timeout 600 npm run -s measure -- --with chr_0035_liino > scratch/x.log` sat in the test
  lock's queue behind two premerges and a `rules` job for the whole 10 minutes; `timeout` killed it before it ran.
  The log held only "waiting N min for the test lock" lines and no `EFSIM-DONE`, so a Monitor on it would have waited
  forever. Rerun in the background without the wrapper: 5 min queue, 40 s of work. About 15 minutes lost.
- **Cause:** the lock's wait counts against any timeout around the command, and nothing tells an agent how long the
  queue is before it starts. A killed waiter leaves no end marker.
- **Suggestion:** (a) measure (and with-lock) print the queue on start with an estimate ("3 ahead: 2 premerges ~15
  min each, 1 job"); (b) on SIGTERM/SIGINT write `EFSIM-DONE <job> killed` to stdout before exiting, so a Monitor
  ends; (c) CLAUDE.md's long-run paragraph says "never wrap measure, premerge, snapshots or with-lock in `timeout`:
  run them in the Bash tool's background mode with its own limit".
- **Why it helps:** agents stop losing whole queue waits and stop waiting on logs that will never end. Small
  change in scripts/testlock.ts and the CLAUDE.md line.

## 2. Combos and ultimates aren't where a script first looks in a fixture

- **What happened:** to check test 27 (a Liino combo inside Cosmovoice) I searched `fx.casts` for combo casts and
  found none in any log: combos are only in `hits` (4360's Liino casts are 30 `normal_skill` and 2
  `ultimate_skill`, no combo). Her Cosmovoice combo is logged under a buff name
  (`buff_chr_0035_liino_comboskill_ultskill_hit`), and the log repeats an ultimate's cast event every ~3.5 s while it
  lasts, so "N s after an ultimate cast" is measured from a repeat unless the events are grouped. The re-triage file
  had made exactly that mistake (its "five combos in Cosmovoice" were all after the stance had ended). Three
  script rewrites.
- **Cause:** the raw fixture's `casts` are the log's cast events, which miss some skills and repeat others; the
  placement (`efsim zmdlogs casts`) knows the real instances, but a scratch script reading the fixture doesn't, and
  docs/design/data.md's "What the log records" doesn't list these habits in one place.
- **Suggestion:** export from @efsim/logs a `loggedSkillInstances(fx, operator?)`: one entry per real cast (combos
  from their hits, an ultimate's repeated events grouped, buff-named variants such as the Cosmovoice combo mapped to
  their skill), with its first-hit and last-hit times; mention it in scripts/scratch-template.ts. Add a short list of
  the log's cast-event habits (no combo events; ultimate events repeated while it lasts; End Stance never logged;
  beats logged as battle-skill events) to docs/design/data.md.
- **Why it helps:** most diagnosis scripts start with "the casts of X"; one shared, tested answer removes a class of
  silent miscounts (the re-triage's included).

## 3. Game buff ids don't say which talent they are

- **What happened:** the re-triage said Camille's talent 2 is never listed; it is, as
  `buff_chr_0033_camille_talent1_atkup` (the data counts talents from 0, and the buff is named for "atkup" although it
  is Heat DMG). I found it only by reading her kit's `gameBuff` fields. Without that, test 93's evidence (56 listed
  starts, all at her own combo heal) would have been missed.
- **Cause:** nothing maps a listed game buff to the kit buff and its label; `efsim gamedata tree` goes from data to
  data, not from a log's listing to the kit.
- **Suggestion:** `efsim zmdlogs buffs <fixture|--operator op>`: every listed buff id with its source, count, values
  and the kit buff whose `gameBuff` it is (id and label), "no kit buff" otherwise. A note in docs/design/data.md that
  the data's talent and potential indices start at 0.
- **Why it helps:** one command answers "is X listed?" correctly, instead of a grep for the wrong name.

## 4. `efsim` isn't on the PATH in a worktree

- **What happened:** the first `efsim zmdlogs list` failed with `sh: 1: efsim: Permission denied`; CLAUDE.md and every
  doc write `efsim …`. It works as `npm run -s efsim -- …` (found in package.json).
- **Cause:** the docs assume a linked bin; setup-worktree links the packages but not a bin.
- **Suggestion:** one line in CLAUDE.md ("in a worktree: `npm run -s efsim -- <args>`"), or have setup-worktree.ts
  print that form at its end.
- **Why it helps:** saves a failed call and a search at the start of every session. Trivial.

## 5. Re-triage claims needed recounting, with no record of how they were counted

- **What happened:** of the claims I used from docs/in-game-tests-retriage-*.md, three were wrong in a way that
  changed the write-up (27's five combos, 93's missing buff, 66's reason: the near-cases were consumed by Zhuang
  Fangyi first, not just "had ended"). Each took a fresh script to find, since the files don't say what was counted
  or how.
- **Cause:** the re-triage scripts lived in scratch/ and are gone; the files keep only the results.
- **Suggestion:** a re-triage (or any census written into docs) names, per claim, the selection it counted (event or
  buff ids, the window, the logs), in a line; better, a reusable `efsim zmdlogs census --event <regex> --buff
  <regex> --near <ms>` for the common "X within Y ms of Z" count, so the claim cites a command anyone can rerun.
- **Why it helps:** checking a claim becomes one command instead of a new script, and wrong selections show.

## 6. Beats as fixed frames can't follow the log's ticks

- **What happened:** Liino's Cosmovoice beats are written as fixed-frame hits of a trigger (`ult_song`), while her
  stance's volleys are a ticking buff, so `KitBuff.ticksShownByHits` (which fixed the volleys' drift) can't be used
  for the beats. I left the beats' timing open (open-problems.md "Liino's Cosmovoice beats").
- **Cause:** the kit format has two ways to write a periodic hit; only the ticking-buff one gets replay pinning.
- **Suggestion:** either let `ticksShownByHits` apply to a trigger's evenly spaced `frames` (pin each to its logged
  landing), or rewrite periodic beats as ticking buffs where the data has a `triggerInterval`; a kit lint could flag
  evenly spaced frames that come from a buff tick.
- **Why it helps:** one replay mechanism for every periodic hit; not costly this session, a known next step.

## What worked well

- `npm run measure -- --with <op>` (40 s once it ran) and `snapshots:update` printing the same better/worse lists:
  the decision to keep the tenth beat took one run.
- `efsim zmdlogs replay` (LAND / NOLAND / replay only) showed the missing tenth beat and the time-stop mismatches
  directly; `zmdlogs groups --operator --verbose` sorted the ultimate's mismatches into team-wide and own in one call.
- `node scripts/at-commit.ts HEAD` for the before/after team numbers; `efsim rules --seeds 32` ran in under a minute.
- The kits' long `note` fields (data ids, frames, the logs they were checked on) made the beat count's origin
  (the 77–477 clip) quick to find.
