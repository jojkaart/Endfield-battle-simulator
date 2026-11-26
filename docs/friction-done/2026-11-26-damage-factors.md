# Damage factors that don't fit (2026-11-26)

Task: find the root cause of each factor the misprediction statistics left (the Crush ×2.2 and ×1.90, 04d4's
Catcher and Snowshine, Ember's ×1.096 in 7e19, Rossi's leads, the cast tails) and fix it or rule it out, with
another accuracy agent holding packages/logs' replay, holds and check files. Branch: this worktree's, from c509b8f.

## 1. Most root causes sat in files the brief kept me out of

- **What happened:** of the five factors, the causes were: 0c14's Crush in buffreplay.ts (a press in an away stretch
  and a hitless press the listing proves), Ember's half in enginecheck.ts loggedEntries, Rossi's slash2 extras in
  enginecheck.ts fightTotals, the bleed ticks and combo_3's over-hold in holds.ts / timeline/. Only Catcher's build
  override was in my files. Each of the others became a hard-coded or generic patch measured with `--patch` and
  written up as a docs/tried diff "held back", three of them, for the lead to apply.
- **Cause:** the brief split files by package before the causes were known; "damage factors" sounds like kit and
  damage code, but a factor is where the replay's state differs at the hit, which is mostly the replay and the check.
- **Suggestion:** in an accuracy brief, split by question rather than by file where the cause is unknown, and give
  the agent the right to change any file another agent's branch hasn't touched (`node scripts/runstate.ts
  --touching` shows them), merging by the usual conflict rules; or say up front that check fixes go in as patches,
  and give docs/tried a "held back" section (I added one paragraph to its README).
- **Why it helps:** the pool fix in loggedEntries (hold-out plain 79.0 → 80.4%, none worse) is a two-line change
  that now waits for another merge round instead of being in the snapshots.

## 2. `npm run measure -- --help` queued for the lock and then failed

- **What happened:** I ran `npm run measure -- --help` to read its options; it snapshotted the tree, waited 5 min in
  the lock's queue behind another agent's run, then printed "Unknown option '--help'" and `EFSIM-DONE measure fail`.
  The help is the file's header comment, which I read afterwards.
- **Cause:** scripts/measure.ts parses its options only when its turn at the lock comes, and has no `--help`.
- **Suggestion:** parse and validate the arguments before queueing (and before the snapshot), and print the header's
  usage block for `--help` / `-h`; the same for snapshots, premerge, team-ab and verify-at.
- **Why it helps:** a typo or a help request costs a second, not a queue's wait (5 min here, more under load).

## 3. fit-build threw on an operator with a DEF-scaled hit and never fitted him

- **What happened:** `zmdlogs fit-build 04d4 --operator Catcher`, with or without `--no-foods`, stopped with "chr_0020_meurs's Def has a part whose formula isn't known (food Superhot Slug
  Gratin …)". The offsets screen had carried his ×0.47 as "explained: weapon level ~1, not fitted" since round 9.
- **Cause:** fitBuild's `score` caught a failing panel but not a reading that refuses an unmodelled line
  (lineValue); one candidate aborted the whole fit, and the message named a food the exported build doesn't have, so
  I first looked for it in the fixture. `--no-foods` failed the same way (not traced further: the fix below ended
  both).
- **Suggestion:** done here (a candidate with an unmodelled line is unscored; tests/buildfit-fit.test.ts). More
  generally, a command that tries many candidates should report the ones that failed and go on.
- **Why it helps:** the fit took 9 s once it ran; the entry had been "not fitted" for a week.

## 4. The log listing of a layered buff hides its layers, and nothing says so

- **What happened:** Ember's Pay the Ferric Price (stackingType 10, 3 layers) is listed as one entry of +0.09 on
  every hit, whatever its layers; 04d4's hits under it read ×1.023 / ×1.085 / ×1.147. I found it by tabulating
  ratios by hand with jq.
- **Cause:** the check reads an unjudged kit buff's state from the listing's entries; for a one-timer layered buff
  the parser (or the game's record) gives one entry. No view groups an operator's ratios by a listed buff's presence.
- **Suggestion:** `zmdlogs differences --what <buff>` (or `offsets`) could print the ratio clusters per listed buff
  ("×1.023 n=26, ×1.085 n=21, ×1.147 n=31"), so equal steps stand out; and docs/design/data.md's "Common misreadings"
  box should name it: a stackingType-10 buff is listed once.
- **Why it helps:** it took four jq passes to see steps the view could have printed.

## 5. The replay's "unseen" press rule and the away stretches are two separate ideas

- **What happened:** 0c14's error came from the replay making a press with no enemy in reach (`unseen`) whose effects
  were all on the enemy; the away stretches (enginecheck.ts awayWindows) are only known to the totals, not to the
  replay or the engine, so a hit in one lands on an enemy that isn't there.
- **Cause:** "the enemy away" is a totals assumption (`enemy-away`), not a replay state.
- **Suggestion:** give the replay the away windows as an enemy-absent state (hits in them apply nothing to the enemy),
  then the `unseen` rule can stay for self-side effects (Liino's stance in d774).
- **Why it helps:** one state instead of two rules that disagree; the 0c14 measure (plain 172 → 293) says how much
  rides on it.

## What worked well

- `zmdlogs replay --trace-buff status:vulnerable` and `status:infliction` answered "why 2 stacks" in two calls;
  the counterfactual readings in `hits --json` gave the 4-stack reading's exactness at once.
- `measure --at HEAD --patch` let me size three changes in files I couldn't edit without touching the tree, in
  parallel, with `--hits` naming the moved hits and their modifiers.
- scripts/edit.ts for the fixture and the multi-block doc edits: exact and all-or-nothing.

## Outcome (round 13)

- 1 (Most root causes sat in files the brief kept me out of): the lead's (noted in docs/friction-done/2026-11-26-round-13.md, "For the lead"); a tool for it (87ee6c5): `node scripts/lead-files.ts <fixture id|operator|word>…` lists the code files of the commits naming a lead, marked where another worktree's branch changed them (`0c14`: buffreplay.ts first, the file the cause was in); CLAUDE.md's lead paragraph names it, the split by question where the cause is unknown, and the held-back diff in docs/tried/
- 2 (`npm run measure -- --help` queued for the lock and then failed): done (b68f663): measure parses and checks its options, the readings against the registered assumptions too, before it queues; `--help` / `-h` prints the header's usage (scripts/usage.ts) for measure, snapshots, premerge, team-ab and verify-at; team-ab checks `--base` and the teams' files before its queue
- 3 (fit-build threw on an operator with a DEF-scaled hit and never fitted him): done in that round (an unmodelled line leaves a candidate unscored); fit-build takes `--assume` since round 13
- 4 (The log listing of a layered buff hides its layers, and nothing says so): done (56de13b, 87ee6c5): `zmdlogs differences --clusters` prints each group's ratio clusters (×1.023 n=…, ×1.085 n=…; with `--operator`, one operator's), and docs/design/data.md's "Common misreadings" names it: a layered buff of one timer is listed once
- 5 (The replay's "unseen" press rule and the away stretches are two separate ideas): the parallel accuracy agent's task this round (the away state and hitless presses in the replay); on the new backlog's accuracy list
