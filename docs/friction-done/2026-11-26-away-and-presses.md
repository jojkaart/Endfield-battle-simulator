# Away and presses: general rules for the damage-factors round's hard-coded fixes (2026-11-26)

Task: build as general rules what the damage-factors round could only hard-code (the enemy away in the replay, a
hitless press inferred from the listing, Rossi's slash2 extras at a life's end, an unjudged layered buff's layers),
then look at a per-edge delay for the combos' extra hold; branch of worktree agent-affd6aab04c25771c, base 07ceac2.

## 1. Kill and life detection live in two places, each with its own test

- **What happened:** 4a64 ends in a kill its last hit doesn't show (no `uncapped` on Rossi's slash2), and its first
  life ends at the 29.15 s away stretch. The totals' kill (enginecheck.ts fightTotals: the data's HP or a capped last
  hit) and the replay's enemy HP (buffreplay.ts loggedEnemyHp: lives split at away stretches, `capped` required) each
  decide "a kill" and "a life's end" with their own code. I added `lastLifeKilled` and had to patch both callers; the
  life starts are still computed only inside loggedEnemyHp, so the totals can't ask "is this stretch a life's end".
- **Cause:** no single model of the fight's lives (where each ends, whether the last is a kill); each consumer
  re-derives it from the hits.
- **Suggestion:** one function in packages/logs (e.g. `fightLives(data, fx)` in enginecheck.ts beside awayWindows):
  `{ lives: [{ from, to, hp, killed, endsAt: awayWindow | "fight end" }] }`, read by loggedEnemyHp, fightTotals (kill,
  killFrame, the leaving frame) and onesided.ts's `away` flag; one test per fixture shape (Si's two lives, a tower's
  ×7.6, a capped kill, 4a64's uncapped one).
- **Why it helps:** the next kill or phase rule is one edit, and the views can show the lives the check assumes.

## 2. The replay view describes an inferred press as a skipped tick

- **What happened:** `zmdlogs replay 8915 --from 110 --to 112` printed `111.23 EVENT Liino normal_skill … a tick of
  vocalist_stance (KitBuff.ticksLoggedAs): the buff's tick moved to the event` while the replay had in fact made the
  press (its six projectiles land as replay-only at 111.63–111.77 s). I found which press was inferred only with a
  scratch script reading `BuffReplay.inferred`. The EVENT line's fate comes from the views' own matching, not from the
  replay's `made`/`skipped` records; views.ts was the other agent's file this round, so I left it.
- **Cause:** the EVENT line re-derives a cast event's fate instead of reading what the replay recorded.
- **Suggestion:** views.ts's EVENT line takes the fate from BuffReplay (made as X, skipped why, `inferred` why), and a
  new `INFER` tag (or the reason after `made`) for BuffReplay.inferred entries.
- **Why it helps:** a press the replay infers or skips is visible where agents look first; no script per question.

## 3. A recorded burst's start is the latest logged applier, however long ago

- **What happened:** after 0c14's 153.99 s press was inferred, Si's total jumped by 0.18M of "shifts". The cause:
  recordedburst.ts `recordedBurst` takes the latest logged battle-skill hit before the burst as the record's start;
  the inferred press has no logged hit, so the 181.42 s burst's record was read from 108.67 s, 73 s of every hit. Only
  the per-operator shifts showed it; no verdict or message did.
- **Cause:** the window's start isn't bounded by anything the buff knows (its duration), and an "unknown" start was
  never considered.
- **Suggestion (done in this branch):** the start must be within twice the buff's life of the burst, else the burst is
  unread. Further: `zmdlogs bursts` (burstsview.ts) could print each recorded burst's window length so a 70 s record
  stands out.
- **Why it helps:** a silent, large totals error becomes an explicit "unknown".

## 4. Names an option accepts differ between commands

- **What happened:** `zmdlogs replay … --operator Chen` failed ("no such operator (an id, its name or part of the
  id)"); Chen's name is "Chen Qianyu", so "Chen" is neither the name nor part of the id (chr_0005_chen is, but the
  match is on the id's part, the name only whole). Cost a retry and a `find --operators` look.
- **Suggestion:** `--operator` accepts a unique prefix of the display name too (operatorId in @efsim/data).
- **Why it helps:** docs and briefs name operators by their short names (Chen, Zhuang).

## 5. A scratch script mis-called logBuffReplay without a type error

- **What happened:** `logBuffReplay(data, fx, { assume })` passed the options as the placement (the third parameter);
  scratch/ isn't typechecked, and the call ran, ignoring the assume. Then `replay.inferred` was undefined because
  logBuffReplay returns `{ replay, replayed, runs }` (LogBuffReplay), not the BuffReplay.
- **Suggestion:** an options object for logBuffReplay (`{ placement?, assume?, trace? }`), and the scratch template's
  example using it with an assume; or `npx tsc --noEmit scratch/x.ts` mentioned in the template.
- **Why it helps:** the commonest scratch call can't be made wrong silently.

## What worked well

- `measure --variant` with several readings in one run, each also against the plain tree: it separated `absent` from
  `absent-edge` and from `inferred` in one 7-minute run, hold-out aggregates included, and showed that the two
  readings' hold-out moves cancel.
- The held-back diffs' headers said exactly what a general rule needed (both conditions for the inferred press), and
  the hard-coded measurement (0c14 plain 172 → 293) was a target the general rule reproduced exactly.
- `zmdlogs replay --kit-buff` and `zmdlogs lanes --buff` answered the Chen and Liino questions in one call each.

## Outcome (round 14)

- 1 (Kill and life detection live in two places, each with its own test): not done, moved to the backlog's accuracy list (2026-11-26-backlog-after-round-14.md, "One model of a fight's lives"): the two rules differ (lastLifeKilled: a whole number of Max HPs to 10% over at a stretch; loggedEnemyHp: −0.1% to the excess +0.5% over j × Max HP, two lives or more), so one function picks one and moves verdicts
- 2 (The replay view describes an inferred press as a skipped tick): done (ef86905): BuffReplay.made, the EVENT line's fate from the replay's own records (made, as what, inferred, skipped, failed) and INFER / MADE lines; 8915 111.23 s now reads "the replay made the press from the listing" (tests/decisions.test.ts)
- 3 (A recorded burst's start is the latest logged applier, however long ago): done in the away branch (the start within twice the buff's life); the further suggestion (each recorded burst's window length in `zmdlogs bursts`) not done: bursts lists the Arts Bursts, not Si's recorded bursts, and the bound turns the 70 s case into an explicit unknown
- 4 (Names an option accepts differ between commands): done (7d612b5): operatorId takes a unique word start of the name after the exact name ("Chen" for Chen Qianyu, though Purrchena contains it); every `--operator` goes through it (operatorNamed), refusing an ambiguous part instead of taking the first
- 5 (A scratch script mis-called logBuffReplay without a type error): done (7d612b5): logBuffReplay takes `{ placement?, assume?, trace? }` as its third argument (the positional form kept for measure-worker's older commits), and `node scripts/typecheck-scratch.ts scratch/x.ts` typechecks a scratch script with the repository's options (the template names both)
