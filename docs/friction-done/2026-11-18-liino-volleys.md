# Liino's volleys and Perlica's runs (2026-11-18)

Task: find what fires Liino's volleys (9090: 10 logged, 1 replayed) and fix her kit, check 1d91's volley doubling,
and diagnose Perlica's ×1.3/×1.5 runs and fc63's ×0.934 on Typhoeus's team. Worktree branch based on 1e1e7a8.

## 1. `gamedata tree` hid disabled actions

- **What happened:** the volley buff's tick (buff_chr_0035_liino_normalskill_spelllnfliction_extraattack,
  buffEvent 1) printed `[0] CheckBuffIdInContext` with its buffIdList and nothing else, read like a live
  condition ("the volley needs a reaction mark"). The kit and in-game test 26 had been built on that reading
  since batch 1. I only found the truth by dumping the raw JSON with Python: `"isEnable": false`. The enabled
  actions printed `isEnable true`; the disabled one printed nothing, because `dataTree`'s `isDefault` treats
  `false` as a default and drops it.
- **Cause:** packages/cli/src/gamedata.ts left out false-valued fields uniformly, so an action's most important
  flag disappeared exactly when it mattered. There are hundreds of disabled actions in operator files (207
  TimeDilationAction, 106 FindTargetAction, 40 CreateBuffAction, 14 ObtainCostAction, 10 SpellInfliction, … in
  buff_chr_* / chr_* files), so other hand-read kit claims may rest on dead actions too.
- **Suggestion:** done in this branch (`DISABLED (isEnable false)` on the action's line; tests/gamedata.test.ts).
  Next: a one-off audit of the kit-batch reports and kit `sources`/`note` texts against disabled actions (a
  script: for each action a kit note names by type and file, check its isEnable), and a line in
  docs/game-data-format.md that `isEnable false` means the action never runs.
- **Why it helps:** a months-old misreading (test 26 queued for the owner, a wrong kit trigger) came from one
  hidden boolean. Cost: none; the tree gets one word on a few lines.

## 2. No view of a trigger's logged events over time

- **What happened:** to see whether volleys followed reactions or a clock I wrote three scratch scripts
  (volley groups per log with casts and stops, intervals in world time against the stops between, offsets from
  logged beats). Each needed `placeHits`, `castTimeStops`, `worldMs`, grouping hits by gap: about an hour, most of
  it plumbing. The decisive numbers (10.0–11.7 s apart in world time, 37 of 100 volleys with a battle-skill event
  at the same ms) came from these, not from any existing view.
- **Cause:** `zmdlogs casts | replay | groups` are per log and per hit; nothing lists one key's logged groups
  across all logs with world-time gaps.
- **Suggestion:** `efsim zmdlogs cadence --operator <op> --key <event> [fixtures…]`: per log, the key's hit groups
  (a gap > 1 s starts one), each group's time, hit count and values, the world-time gap from the previous group
  (logcasts `worldMs` over `castTimeStops`), the stops between by operator/kind, and the operator's nearest cast
  events; a summary of gaps (min / median / max).
- **Why it helps:** "is this a timer, a cooldown or event-driven?" is a recurring kit question (beats, volleys,
  bleed ticks, Typhoeus's shots); one command answers it for every log.

## 3. The replay forces a logged cast the kit forbids, silently

- **What happened:** in 4360 the replay made Liino's battle skill inside Cosmovoice (where the kit makes it
  unavailable: End Stance holds the slot), kept Cosmovoice's Amp on the team, and reported nothing. Perlica's
  ×0.62–0.70 run looked like her kit for two rounds of diagnosis (open-problems: "her talent 1, a buff
  window"). I found it only by reading the log's buff listing hit by hit.
- **Cause:** buffreplay `replayedSkill` returns `c.skillId` for a non-basic cast whose skill isn't available and
  has no available variant, and `replayCast` makes it anyway; there's no record that the kit's state was
  overridden.
- **Suggestion:** list such casts in the check's report and in `zmdlogs replay` (`FORCED  Liino normal_skill:
  unavailable (cosmovoice_amp active)`), and count them in `zmdlogs groups` as a cause beside "no landing". The
  `exitPresses` inference added here covers the exit-skill case only.
- **Why it helps:** a forced cast means the replay's state is wrong from there on; seeing it would have pointed
  at the cause in minutes, and it flags other kits' missing transitions.

## 4. The worktree's command guard refuses ordinary shapes unpredictably

- **What happened:** `git log …; grep …` in one call, a `for` loop around `grep` over log files, and a
  `sed -i … ; node …` pair were refused as "too complex to verify" (even with no `git` in the second case); each
  refusal cost a retry. A heredoc Python edit passed once and was refused later.
- **Cause:** the guard judges the whole command text; CLAUDE.md lists the accepted shapes, but which mixtures
  trip it isn't predictable.
- **Suggestion:** a small set of repo scripts for the common mixed steps (`node scripts/commit.ts -m file
  -- paths`, `node scripts/grep-logs.ts <pattern> <files…>`), and in CLAUDE.md the rule as "one tool per call;
  file edits with Write/Edit or a scratch .py run with one command".
- **Why it helps:** fewer wasted calls; the cost is minor but frequent.

## 5. Team-number A/B needs four queued runs and manual bookkeeping

- **What happened:** the brief's team check (full and zero energy, base and new) meant `at-commit` plus four
  `with-lock` jobs, queued behind other agents' premerges and snapshots (about 25 min of waiting), then
  grepping four logs and typing the table by hand.
- **Cause:** `efsim rules` has `--compare <rules.json>` but no compare across code versions; measure has `--base`.
- **Suggestion:** `node scripts/team-ab.ts <scenario> <rules> --base <ref> [--zero <scenario>]`: one lock
  ticket, both codes, both scenarios, printing the table (sustained DPS, bot, 0.6 s, 60 s timeline, shares).
- **Why it helps:** every kit change brief asks for this table; one job instead of four and no transcription
  errors.

## What worked well

- `npm run measure` (a minute for every log, per-log directions) made each idea cheap to try and to reject; the
  "worse" lines pointed straight at what to explain (it showed that my generic tick pinning also moved Rossi's
  logs, so I made it opt-in).
- `zmdlogs groups --operator` immediately separated Perlica's team-wide runs from her own.
- `zmdlogs hits --json` (zones, modifiers, listed, differences per hit) answered the 1d91 doubling and the fc63
  ATK fit with a few lines of Python.
- `scripts/at-commit.ts` and `with-lock` made the base-versus-new team runs safe alongside other agents.

## Outcome (round 4)

2026-11-18, improvement round 4 (docs/friction-done/2026-11-18-round-4.md); what's left is in docs/friction/2026-11-18-backlog-after-round-4.md.

1. The fix was in that branch; done now (3cd4610): docs/game-data-format.md says `isEnable false` means the action
   never runs, and "Common misreadings" repeats it. The audit of kit notes against disabled actions: round-4 backlog.
2. Done (ec22f1c): `efsim zmdlogs cadence --operator <op> --event <re> [fixture…]`: per log the key's hit groups, the
   world-time gap from the last (time stops taken out), the stops between (counted by operator and skill), the nearest
   cast event, and the gaps' spread.
3. Done (0a846c6): BuffReplay.castFlags; `zmdlogs replay` prints FORCED (its kit makes it unavailable, with the
   operator's own buffs) and INSIDE (started before the running action lets it) lines and counts them in its header.
   Counting them in `zmdlogs groups`: round-4 backlog.
4. Done (e8131c1): CLAUDE.md's rule as "one tool per call; inline programs and batch edits as scratch files".
   Repo scripts for mixed steps (commit, grep-logs): not done; `zmdlogs census` covers the grep-the-logs case.
5. Done (2b82e56): `node scripts/team-ab.ts --base <ref>`: an identity check, then (only if a team's fight changed)
   the 32-seed runs at both codes in one locked job and the table.
