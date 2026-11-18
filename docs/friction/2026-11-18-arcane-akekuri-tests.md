# Arcane's and Akekuri's in-game tests from the logs (2026-11-18)

Task: decide in-game tests 31, 51, 7, 30, 4, 57 and 62 (Arcane, Akekuri) from the logs, fix the engine where the logs
show it wrong, measure, regenerate the snapshots, and report how the owner's team and Typhoeus's team move under
`efsim rules` (32 seeds, full energy and from zero). Branch: this worktree's, from 9fa151b.

## 1. Two hours of locked rules runs for team numbers that could not move

- **What happened:** the brief asks for `efsim rules … --seeds 32 --first-seed 1001` on both teams and their -zero
  companions whenever a kit changes. Each run takes about 25 min of CPU under `scripts/with-lock.ts`. Behind other
  agents' premerges and snapshot runs, each of the four waited 25 min or more for the lock. That was about two hours of
  wall time, the longest part of the session. All four results were within 0.01% of the team pages (53,780 / 52,744
  and 52,374 / 48,973), because both fixes act only on Arcane in INT mode and both teams play her in WILL. The
  example snapshots (`tests/snapshots/examples.json`), which `snapshots:update` had already regenerated, had not moved
  at all. That alone showed the teams' engine runs were unchanged.
- **Cause:** the rule "a kit changed → re-run the teams' rules" goes by which file changed, not by whether the change
  reaches the team's fight. No cheap check says "this team's timeline is byte-identical before and after".
- **Suggestion:** add a quick precheck to the rules step, either a `scripts/team-moved.ts <scenario>` or `efsim rules
  --unchanged-since <ref>`. It simulates the team's example scenario (and one seed of the rules list over 60 s) at
  `<ref>` and at HEAD, through `scripts/at-commit.ts`, and compares the hit lists. If they are identical, it prints
  "unchanged: no need for the 32-seed run" and the agent reports the page's numbers as unchanged. Mention it in
  CLAUDE.md next to the team-run instruction (or in the lead's brief template).
- **Why it helps:** most kit changes touch one mode or one operator. A one-minute identity check would replace about
  100 min of locked CPU per agent, and shorten the lock queue for everyone else. Risk: a 60 s identity check can miss
  a change that shows only late in a 300 s fight. Comparing one full 300 s seed instead still costs under a minute.

## 2. The replay places a cast inside another skill's uncuttable frames, and a kit fix tripped on it

- **What happened:** my first version of Arcane's second-ultimate Amp used `endsWithCast` (the data's
  autoFinishByAction). It made a7a7 and a hold-out worse (`npm run measure`: a7a7 plain 352 → 344, hold-out mean
  |damage error| 12.5 → 13.9%). The cause was the placement: `efsim zmdlogs casts` puts her battle skill at 55.67 s,
  42 frames into the ultimate cast at 54.27 s. The ultimate's kit note says it can't be cut before frame 63, so the
  battle skill ended the cast, and with it the Amp, before the ultimate's own hit at 56.21 s. Finding this took one
  extra measure cycle (about 15 min with the queue) plus reading the casts view.
- **Cause:** `placeHits` (packages/logs/src/logcasts.ts) places casts from their hits' frames and doesn't check the
  current skill's uncuttable window. `zmdlogs casts` doesn't flag such placements either, so a buff tied to a cast's
  life looks broken when the placement is what's wrong.
- **Suggestion:** have `zmdlogs casts` (and the replay's report) mark a cast placed inside another cast's
  can't-be-cut frames of the same operator, e.g. `CAST … (inside ultimate_skill2's uncuttable 0–63)`. A count could
  also go into the log check's summary.
- **Why it helps:** any kit buff with `endsWithCast` or `untilFrame` depends on cast boundaries. A visible flag points
  straight at the placement instead of at the kit. Risk: none for the engine; a few more report lines.

## 3. Listed buff ids that differ from the kit's `gameBuff`

- **What happened:** to read Arcane's INT Amp windows I filtered the fixtures' `effects` for her kit buff's `gameBuff`
  (`buff_chr_0032_lizhiyan_talent1_enhance`) and got nothing. The log lists the Amp as the generic
  `buff_common_affixes_enhance_spell` with `source` = Arcane. Her Susceptibility likewise appears as
  `buff_common_affixes_vulnerable_natural` / `_crystal`. This cost a script rerun and a grep over a fixture's buff
  ids.
- **Cause:** for some game buffs, ZMDLogs records the effect buff the game creates (a common affix), not the buff
  file the kit names. The mapping is known in the replay code (it compares listings with kit buffs) but isn't exposed.
- **Suggestion:** have `zmdlogs hits --json` give, per kit modifier, the listed key it is compared with (it already
  has `differences`; add the listed key that matched). Or add a `efsim zmdlogs listed <owner:kitBuff>` that prints
  the listed keys and sources the replay treats as that kit buff. Document the common-affix case in
  docs/design/data.md "What the log records".
- **Why it helps:** every "how long does buff X last in the log" question starts by finding X's listed key. Risk: none.

## 4. A "mixed" log in `measure` whose hits all moved closer

- **What happened:** `npm run measure` called 00ae "mixed: plain 553 → 554, damage −2.1 → −4%". Before I could keep
  the fix, I had to work out why: each of Arcane's hits after her second ultimate moved from −40% to −15%, but they
  are unquantified hits under a fight total that was already below the log, so the signed total drifted further down.
- **Cause:** the per-log direction uses the signed total damage error, which can't tell "hits got closer" from "hits
  got worse".
- **Suggestion:** next to the signed total, print the change in the log's mean |per-hit error| (over the hits the
  check compares, unquantified included). Call a log "mixed" only when the two disagree, and say which way each moved.
- **Why it helps:** the keep-or-drop rule ("no log worse without explanation") relies on this line. A clearer signal
  saves an investigation per mixed log. Risk: one more number per line.

## 5. Stale test text and re-triage claims

- **What happened:** test 31 says "the engine has only the Final Strike half", and the re-triage
  (docs/in-game-tests-retriage-01-40.md) says "the engine's Final Strike-only trigger loses them". But Arcane's kit
  has had `cluster_strike_finisher` (its note: "Test 31") since at least 2026-11-14, and the replay lands all 20
  lasers. Little was lost, because `zmdlogs replay` showed it at once. Still, a less careful agent could have written
  a duplicate trigger.
- **Cause:** when a kit gains a mechanism a test asks about, nothing prompts updating the test's text. The kit note
  cites the test, but the test doesn't cite the kit.
- **Suggestion:** a check in `npm run check` (or `efsim kit-census`) that lists the kit notes citing "test N" whose
  section in docs/in-game-tests.md doesn't name that kit's trigger or buff id. A warning, not a failure.
- **Why it helps:** test text stays in step with the engine, and triage agents stop reporting gaps that are already
  closed. Risk: noise from loose mentions; keep it a warning.

## What worked well

- `efsim zmdlogs replay <fixture> --from --to --kit-buff owner:id` answered most questions on sight: lasers against
  finishers, the array's and Amp's windows, P1 layers.
- `zmdlogs hits --json` with `landing.zones`, `modifiers` and `enemy` (with `appliedAtMs`) made the Corrosion-ramp fit
  a 60-line script over one dump of every log.
- `npm run measure` (about a minute, plus the lock wait) kept the try-and-measure loop short, and its per-log
  directions caught the bad first fix immediately.
- `efsim gamedata tree <id>` showed the second ultimate's CreateBuffAction flags and the Amp buff's stacking, which
  gave the fix its mechanism.
