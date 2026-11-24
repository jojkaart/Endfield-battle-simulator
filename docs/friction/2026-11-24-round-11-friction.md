# Improvement round 11 itself (2026-11-24)

Task: improvement round 11 over the five open friction reports, tools only, beside an accuracy agent in the kit
compiler, kits, engine, placement, replay and check core; the worktree branch of `agent-a49a8f285715a8c90`, on main
at e3272c6. Points already in docs/friction/2026-11-24-backlog-after-round-11.md (the replay's own stop list, point 6;
the bursts' recorded cause, point 13) aren't repeated.

## 1. The stats tables live in one worktree's scratch/, found by listing other worktrees

- **What happened:** analyze.py and its probes read scratch/stats/ (99 MB from scripts/probes/stats/build.ts, about an
  hour to build). This worktree had none, nor the main checkout; `ls -d .claude/worktrees/*/scratch/stats` found three
  copies of unknown age, and I copied the kit-buff leads' (built at c6f1874, per their journal entry) by hand.
- **Cause:** load.py reads `os.getcwd()/scratch/stats`; round 10 taught the hit records' cache to look in the main
  checkout's and every worktree's scratch/hits-cache/, but nothing does that for the stats tables, and nothing records
  at which code a table was built.
- **Suggestion:** build.ts writes `scratch/stats/built.json` (the commit, the code key, the logs); load.py (and
  analyze.py's `--tables <dir>`) falls back to the newest scratch/stats/ among the main checkout and the worktrees,
  printing which one and its commit on stderr.
- **Why it helps:** a stats question in a fresh worktree starts in a minute, not after an hour's build or a hunt, and
  the table's code is on record.

## 2. build.ts with one log overwrites the whole table

- **What happened:** to check that the moved counterfactuals give the same numbers, I ran `node
  scripts/probes/stats/build.ts 0eef`; it rewrote scratch/stats/hits.jsonl (and the others) with 0eef's rows only. I
  had made a backup first, so nothing was lost, but without it the copied table would have been gone.
- **Cause:** build.ts takes ids for a partial build but always writes the full tables' paths.
- **Suggestion:** with ids, write under `scratch/stats/partial/` (or refuse without `--out`), and say so on stderr.
- **Why it helps:** a quick check of one log can't destroy an hour's table.

## 3. The first tick filter for the views was wrong, and only a full cli-ab showed it

- **What happened:** the views' stop list had to leave out a hitless event the replay read as a buff's tick. My first
  version dropped every hitless event of a skill a kit buff ticks as; `node scripts/cli-ab.ts HEAD -- zmdlogs stops
  --all --differ` (about 4 minutes) showed eleven new "timeline only" lines: 3aa6's real Zhuang Fangyi ultimates, whose
  hits the placement doesn't place, were dropped too. The second version reads the replay's applied stops. About 15
  minutes, and the finding that the EVENT lines had the same error.
- **Cause:** "did the replay make this cast" lives in buffreplay.ts (`main.made`) and isn't exported, so a view guesses
  from the key; backlog point 6 is the fix.
- **Suggestion:** until then, a line in docs/design/data.md's "What the log records": a cast event under a tick skill's
  key may be a real cast (3aa6), so a view decides from the replay's applied stops, not the key (added in this
  round's last commit; before it, only query.ts's comment said so).
- **Why it helps:** the next view over cast events doesn't repeat the guess.

## 4. Two paths to a hit's modifiers: the snapshot check's and the hit records'

- **What happened:** the likely-loggedAs screen needed each hit's kit modifiers. The pending suite has the snapshot
  check's EngineHits (the replay's landing, no reading), `zmdlogs differences` has the hit records (the primary
  reading's modifiers, log buffs included); I wrote the screen on a neutral modifier shape so both could feed it, and
  they differ slightly (the reading keeps only judged kit buffs).
- **Cause:** snapshotEntry (snapshotentry.ts) and hitRecords (hitexport.ts) each compose the replay, engineHits and
  checkLog; only hitRecords computes readingBasis.
- **Suggestion:** snapshotEntry returns a lazy `bases(h)` (readingBasis per hit, memoised) and hitRecords builds on
  snapshotEntry, so a screen in the suite and a view over the records read the same reading.
- **Why it helps:** one composition, so a screen that passes in the suite is the view's answer too.

## What worked well

- `node scripts/friction.ts outcomes --backlog` (new this round) filled every carried outcome from the new backlog on
  its first use; writing the backlog first, as the README now says, took one pass.
- `node scripts/cli-ab.ts HEAD -- zmdlogs stops --all --differ` made "the views agree now" a two-line diff, and caught
  the wrong first version.
- `measure --split commits` tried on a past range (the placement leads') checked itself against a known answer.
- The bash guard's refusals (a heredoc, a multi-line inline script) each named the safe form; edit.ts's new end-block
  message fired on my own first edits file.
