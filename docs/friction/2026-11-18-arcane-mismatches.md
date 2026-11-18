# Arcane's mismatches as one group (2026-11-18)

Task: diagnose Arcane's 908 mismatched hits together (by skill, ratio, buffs the log and the replay disagree on,
time after her casts), find the shared causes and fix the general ones (branch
`worktree-agent-a726ed963adbe3e38`, base 7cea96e). Two fixes went in: her lasers on the world's clock, and buffs a
chance path's hit applies left to the log.

## 1. No tool says "is this mismatch mine or a teammate's / the fight's"

- **What happened:** the bulk of the work was sorting Arcane's 908 mismatches into causes. `efsim zmdlogs hits --json`
  gives each hit's engine modifiers, but not the log's listing beside them, and nothing groups hits. I wrote four
  scratch scripts (`scratch/arcane-groups.py`, `timeline.py`, `hit.py`, `arcane-nolanding.py`) that: (a) join each
  hit's engine modifiers to the fixture's `effects` and print engine-only / log-only buffs, (b) mark a mismatch
  "team-wide" when a teammate mismatches at the same ratio (±1.5%) within 1.5 s, (c) count hits with no replay
  landing per event. Only after that did it show that ~560 were stage logs, ~140 team-wide, ~110 teammates' buffs on
  her basic-attack strings (Alesh, Liino, Ardelia, Camille) and only ~100 her own. About two hours.
- **Cause:** the per-hit tools answer "what did the engine compute for this hit", not "which operator's kit is
  wrong". Joining engine modifiers to the log's listing needs the kit buff → game buff map, which the scripts had to
  rebuild by globbing `packages/data/kits/**/*.json`; my first version keyed it by kit buff id alone and silently
  mixed up `p3_atk` (Alesh) with Mi Fu's buff of the same id.
- **Suggestion:** an `efsim zmdlogs groups --operator <op>` report (packages/logs, reusing `checkLog` and the replay):
  per mismatch the ratio, engine-only and log-only game buffs (through each kit buff's `gameBuff`, keyed by
  `owner:id`), whether the replay has a landing, and whether a teammate mismatches at the same ratio nearby; then
  runs of equal ratio grouped, with the buff whose toggle explains the run named. Also add the log's listed
  game buffs to `zmdlogs hits --json` lines.
- **Why it helps:** "diagnose operator X's misses" is a recurring brief; this is the first hour of each, and the
  hand-made join is where mistakes creep in (the id collision above). Cost: one report module; the timing report
  (`zmdlogs timing`) already does half of it for single toggles.

## 2. The replay's landings, casts and stops aren't printable

- **What happened:** to see why a logged laser had no landing I needed the replay's own landings (frame, hit id,
  value) and the placed casts' time stops. Neither `check` nor `hits` prints them; I wrote `scratch/landings.ts`
  (`logBuffReplay(...).replay.hits`, cast through `unknown` because the type doesn't expose `skillId`/`hitId`
  plainly), `scratch/stops.ts` (`placeHits`, `distinctCasts`, `castTimeStops`) and `scratch/windows.ts`
  (`replay.kitWindows`). These found both fixes (the lasers landing 1.6 s before the log in a7a7; Alesh's `slam_ex`
  in ad7f) and the placement leads for the other agents (db87: no stop for Laevatain's ultimate).
- **Cause:** the replay is only visible through verdicts; its timeline (landings, casts as placed, stops,
  buff windows) has no CLI view.
- **Suggestion:** `efsim zmdlogs replay <fixture> [--from s --to s] [--operator op]`: one time-ordered listing of the
  replay's landings (skill, hit id, damage, the logged hit it's matched to or "unmatched"), placed casts, time stops
  and slow-downs, and kit buff windows, interleaved with the logged hits. Export `LandedHit`'s `skillId`/`hitId`
  types from @efsim/logs so scripts don't cast.
- **Why it helps:** "the replay landed it at the wrong time / not at all" is the most common root cause I saw
  (lasers, explosions, placement); one command replaces three scripts per agent.

## 3. Snapshot runs are the only way to measure, and they're long and fragile

- **What happened:** every hypothesis (two fixes, one rejected freeze experiment) needed `npm run snapshots:update`,
  ~5 min each when the lock was free, longer when another worktree held it (one run waited several minutes with no
  sign in its log beyond the npm banner). The container restart killed the freeze experiment's run mid-way; I had to
  check the snapshot files weren't left emptied (they weren't: the run hadn't reached them) and re-run it from
  scratch. To experiment without editing the engine permanently I put a temporary `process.env` switch in
  `packages/engine/src/timeline/actions.ts` and had to remember to revert it and the regenerated snapshots by hand.
- **Cause:** no way to measure a change on a subset (say the 40 logs with the operator) against the committed
  snapshots without rewriting them; no first-class switch for engine experiments (kit assumptions exist for kits,
  not for engine rules like the freeze hold); `snapshots.sh` prints nothing while it waits for the lock.
- **Suggestion:** (a) `scripts/accuracy.ts --measure [--with <op>]`: run the checks into a temp dir and print the
  scoreboard change and better/worse logs against the committed snapshots, writing nothing; (b) an engine-rule
  assumption switch like the kit assumptions (e.g. `freeze-holds: all | own`), selectable by env or scenario, so an
  experiment is a flag, not a code edit; (c) `snapshots.sh` prints "waiting for the test lock (held by …)" before
  `flock` blocks.
- **Why it helps:** faster, non-destructive measurement means more hypotheses tested per session, and a restart
  can't leave half-written snapshots; the switch keeps rejected experiments reproducible.

## 4. The log records hidden events as casts, undocumented

- **What happened:** Arcane's logged casts include a combo "cast" about 6.5 s after each real combo; it took
  comparing all 40 logs (`scratch/imprison.py`) to see it's the CastSkill of `abilityentity_end` at Imprisonment's
  natural end (an explosion follows ~0.45 s later), i.e. the log gives Imprisonment's end for free. The kit review
  had noted the INT twin (seal_again logged under the combo's id) only in passing.
- **Cause:** which logged "casts" are really entity CastSkills (not presses) isn't recorded anywhere central; the
  placement and `withLoggedCasts` treat them as presses (which then fail on cooldown).
- **Suggestion:** a table in docs/design/data.md (or the kit's own `loggedAs`-style field) of skills whose CastSkill
  the log records as a cast of another skill, with what each marks; let the replay use such a marker as a timing
  fact (as the reaction levels are taken from the log).
- **Why it helps:** saves the rediscovery and turns a nuisance (a failed press) into evidence (a buff's real end).

## 5. abilityEvent numbers aren't decoded

- **What happened:** Imprisonment's buff (`buff_chr_0032_lizhiyan_combo_skill_seal`) ends early on abilityEvent 8,
  1403 and 1601; `efsim gamedata tree` prints the numbers, and no doc or code names them, so I couldn't tell which
  events end it (the likeliest explanation of 4d60's 1 s short windows). Left open.
- **Cause:** docs/game-data-format.md names some enums but no abilityEvent table; each agent decodes the few it meets
  and the knowledge stays in kit notes.
- **Suggestion:** collect every abilityEvent number kits already decode (grep the kit `sources`/`note` texts for
  "abilityEvent N") into a table in docs/game-data-format.md, and have `gamedata tree` print the name next to the
  number when known.
- **Why it helps:** turns a dead end into a lookup; each decoded event helps every operator using it.

## What worked well

- `efsim zmdlogs list --with <operator id>`, `zmdlogs check` per log and `zmdlogs hits --json --workers 4` (the whole
  set in a minute) were the right starting points.
- `zmdlogs timing` quickly ruled out Arcane's own buff timing as a group.
- The scratch template and `@efsim/*` resolution from scratch/ made the ad-hoc scripts cheap; `with-lock` made the
  four `efsim rules` runs safe to start in parallel.
- `npm run snapshots:update`'s closing comparison (rows plus better/worse logs) made each fix's effect clear, and
  premerge's one-table summary was easy to read.
