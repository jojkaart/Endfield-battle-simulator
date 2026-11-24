# Backlog after improvement round 10 (2026-11-24)

Task: the points of the reports round 10 read (docs/friction-done/2026-11-24-round-10.md lists them) that round 10
didn't do. Each point is complete on its own; the originals are in docs/friction-done/ with an "Outcome (round 10)"
section. Round 9's backlog points 2 (a kit form naming the engine's hold) and 3 (the twins test) are parked after
their second carry; the parked list and the accuracy list follow.

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. A slow-down's identity through the stop lists and the replay's record

- **What happened:** pairing the timeline's applied slow-downs with the log tools' stop lists by start frame and
  caster gave 52 length differences that went into a commit message (95cf3f6) before the view showed 0c14's Rossi
  combo_3 with "12 frames: the list has 19" beside "19 frames: as listed": her two frame-0 dilations had collided on
  one key (round 8). The replay's record merged two slow-downs of one start and priority the same way (stop-lists
  report point 2: Purrchena's shielded combo printed "the list has 20 frames" for an 18-frame one).
- **Since round 9:** the compiler gives each compiled slow-down its dilation's index in the skill file
  (SkillTiming.slowdowns `n`, packages/data/src/skillData.ts; SkillDilation `n`), and `gamedata dilations` matches
  by it. Nothing downstream carries it yet.
- **Since round 10:** round 9's own report (point 3) hit it again: TimeStop lives in logcasts.ts, AppliedStop in
  replayrecord.ts and their pairing in views.ts, so the change spans the placement's modules. First step, a move
  only: a packages/logs/src/stops.ts with TimeStop, AppliedStop, stopsAgainstList and the identity key, imported by
  the three (behaviour-preserving: `zmdlogs stops --all --differ` and `replay --stops` identical by
  `node scripts/cli-ab.ts <base> -- …`), when no accuracy agent holds logcasts.ts or replayrecord.ts.
- **Suggestion:** carry `n` (and the skill) into TimeStop (packages/logs/src/logcasts.ts skillStops: `...d` or `n:
  d.n`), TimelineState.slowdowns (engine timeline/clock.ts slowDown's push: `n: d.n`, keep it out of search.ts's
  state key if one reads slowdowns) and AppliedStop (replayrecord.ts, keyed by the state's slow-down object or by
  (start, caster, n) in place of start|caster|priority|kind); then pair by (start, caster, n) first in views.ts
  stopsAgainstList. `zmdlogs stops --all --differ` before and after: the counts must stay (or explain each change);
  at round 9's end over the 61 development and verified logs: as listed 1380, covered 36 (14 logs), length 0,
  timeline only 1 (3f78: Rossi's 12-frame slow-down at 50.13 s), list only 0.
- **Why it helps:** the next comparison of the stop lists (the accuracy list's "the lists from the timeline")
  pairs exactly, and a count that goes into a commit is right the first time.
- **From:** docs/friction-done/2026-11-23-round-8-friction.md point 2; docs/friction-done/2026-11-23-stop-lists.md
  point 2; docs/friction-done/2026-11-23-backlog-after-round-9.md point 1.

## 2. A logged hit placed in the wrong slot is invisible in the totals' parts

- **What happened:** Mi Fu's attack 3 in a27b: the logged hit_2 (5,896) was matched to `hit`'s second landing
  (predicted 2,905), so the totals showed a matched −2,991 and a replay-only hit_2 +5,896, a "cast tail" in the kinds
  although nothing is missing. Finding it took the replay view and the kit's frames side by side; 9a80's Si combo
  final (6.6% of the fight) is the same. The one-sided classification can't see it, because one side is matched.
- **Cause:** TotalPart (enginecheck.ts) keeps the operator, skill, hit and frame but not the landing's cast, so
  "matched to a different hit of the same cast than its value says" needs a scratch script that re-derives the
  landings from the parts by key and frame.
- **Suggestion:** carry the landing's cast index in TotalPart (fightTotals, enginecheck.ts), flag a matched part whose
  logged value fits another landing of its cast within 5% while its own prediction is off by more than 15% (`slot?`
  in `zmdlogs totals --kinds`), and export the parts like the one-sided landings (`zmdlogs totals --all --json
  --parts`, cached beside them: reports.ts FightTotals, round 10).
- **Why it helps:** the next placement fix (slots by value) starts from a count instead of a hunt.
- **From:** docs/friction-done/2026-11-23-one-sided.md points 1 (the parts export) and 3.

## 3. One measure that splits a batch's effect by change

- **What happened:** four changes went into one measure; 12 logs moved, some worse. Finding which change moved 4bfc
  took three more measures and a wrong claim written into timeline.md; only `--at <base> --patch <all but one>` showed
  the same-ms order was the culprit (physical-statuses report). Round 10 refuses the first misstep (a `--patch` the
  tree already has, without `--at`), not the cost.
- **Suggestion:** `npm run measure -- --split [--base <ref>]`: one patch per changed file (or per `--group a,b`)
  against the base, each measured as `--at <base> --patch <that diff>` in one queued job (the logs that moved in the
  whole run only, so it costs about one measure per group on those), each line "this group alone: which logs moved,
  better / worse".
- **Why it helps:** the first measure of a batch names the change behind each moved log, so nothing gets written down
  about the wrong one.
- **From:** docs/friction-done/2026-11-24-physical-statuses.md point 1.

## 4. A landing dropped by its own cast's end or a jump leaves no trace in the replay

- **What happened:** Snowshine's bashes vanished silently: the replay printed no NOLAND reason beyond "a landing the
  replay didn't land", no FAILED, no CUTS. That the cast's end at frame 106 dropped a pinned landing at 125 took a
  scratch script, the SkillData timing by hand and the kit JSON for the `attacked` trigger's jump. Round 10's `efsim
  kit` now prints the ends and the triggers' jumps ("paths:"), but the replay still says nothing.
- **Suggestion:** record in the replay when a pinned landing is cancelled (an end, a jump, a cut: the engine's timeline
  drops it) with its cause, and give `zmdlogs replay` a DROPPED line and the one-sided kinds that cause as the
  log-only hit's context. An engine timeline change (record only: smoke, the identity check of team-ab).
- **Why it helps:** "a landing the replay didn't land" is the largest log-only kind in the development logs (1.4%);
  each would name its cause.
- **From:** docs/friction-done/2026-11-24-physical-statuses.md point 2.

## 5. Per-hit counterfactuals: which single disagreement, taken the log's way, makes a hit fit

- **What happened:** the misprediction analysis needed, per off hit, the reading with one listing difference taken
  the log's way, the crit flipped and each boundary kit buff on or off. scripts/probes/stats/build.ts copies
  hitRecords' composition (placeHits, logBuffReplay, engineHits, checkLog, engineReport, readingBasis, landingDamage)
  and re-derives the edge toggles' modifier swap to get them: four builds, about an hour.
- **Cause:** the check computes these alternatives internally (readingBasis groups) but exports only the one that
  matched.
- **Suggestion:** a `counterfactuals` field on HitRecord (hitexport.ts): for each LogDifference the reading with that
  group as the log lists it, plus crit flipped and Stagger toggled; and `zmdlogs explain <fx…|--all>` printing each
  off hit's first explanation (one difference / listing / boundary / fight-operator factor / class) with the per-class
  shares, which measure could also give for the hold-outs (aggregates only). HitRecord.graded (round 10) is the pair
  each counterfactual is judged against.
- **Why it helps:** the analysis's largest class (20.4% of the error, the hold-outs' 34%) is exactly "one difference
  the log's way fits"; build.ts shrinks to feature extraction.
- **From:** docs/friction-done/2026-11-24-misprediction-stats.md point 1.

## 6. A kit field override's errors come one rule at a time

- **What happened:** adding a logged key to Zhuang Fangyi's `combo_skill_ult` hit took four tries: "no frames, and the
  data's landings aren't one branch path", then (frames written) "events differ from the compiled SkillData", then
  (frames and events in dataOverride) "frames marked as differing but agrees". Only frames written plus
  `dataOverride.events` passes.
- **Cause:** the compiler's checks (packages/data/src) run one at a time and each message names only its own rule.
- **Suggestion:** when a kit hit's `events` differ from the data, one message: "write `frames` (the data can't place a
  landing for a key of another skill), and mark `events` in dataOverride".
- **Why it helps:** variant keys shared with a base skill are the likeliest next kit edits.
- **From:** docs/friction-done/2026-11-24-misprediction-stats.md point 4.

## 7. analyze.py's feature tables take 6 minutes

- **What happened:** scripts/probes/stats/analyze.py's fight bootstrap (300 resamples) and within-fight shuffles
  (20 × 2) for 50 rows run in pandas loops; the analysis was run section by section while iterating.
- **Suggestion:** vectorize the bootstrap (fight-level sums once, resample the sums); keep the section argument.
- **Why it helps:** re-running the analysis after fixes takes a minute.
- **From:** docs/friction-done/2026-11-24-misprediction-stats.md point 5.

## Parked

A new report that hits one brings it back with its full text from there.

Round 9's points (full text in docs/friction-done/2026-11-23-backlog-after-round-9.md under the same number):

- 2. A kit value written as "the data's length minus what the engine holds" (an extendBuff `pauseFrames` form:
  engine timing, smoke, team-ab).
- 3. No test that a hit's replay-only and log-only twins don't come back (cheaper since round 10: a count of the
  `twin like` / `twin other` contexts in snapshotEntry's `oneSided`, in the pending suite; its bound is an accuracy
  agent's).


Round 8's point (full text in docs/friction-done/2026-11-23-backlog-after-round-8.md under the same number):

- 1. A layered or consumed buff's layers, per hit and per cast, log against replay (`logReading` as an object,
  `zmdlogs consumed`, `zmdlogs layers`; `hits --zones` covers part of it since round 8).

Round 7's points (full text in docs/friction-done/2026-11-23-backlog-after-round-7.md under the same number):

- 2. `zmdlogs clock`'s remainders: `--on/--off` cast brackets, `--all` in place of scripts/probes/buff-clock/lanes.ts,
  the owner's trigger hit after the end with its origin.
- 5. Probes have no "still runs" check (none rotted).
- 7 (the rest). `zmdlogs statuses <fixture>`: the replay's status events with the logged status hits interleaved.

Round 6's points 1–10, 12 and 14 (full text in docs/friction-done/2026-11-23-backlog-after-round-6.md under the same
number):

- 1. groups: off under both readings or only under the replay's (split by logError, FORCED casts as a cause).
- 2. No interval selectors in census (`stagger:`, `control:<op>`, `--inside`).
- 3. A ticking buff's ticks and holds: logged against replayed (`zmdlogs ticks`, `--trace-buff` nextTick).
- 4. A cast's two variants both landing raises no flag (CastFlag "both-variants").
- 5. One skill's hits across logs with their zones (`hits --operator --event --zones`).
- 6. `differences` blames the applying hit for a buff it creates ("created by this hit").
- 7. A no-landing reason that hides an unlogged crit.
- 8. Open rule questions go stale as the engine moves (`examples/<team>.questions.json`).
- 9. Who inflicts what, as a team table (`kit-census --team`).
- 10. A buff's holds past its modelled end need a kit edit (`--buff-duration`; `measure --patch` covers measuring).
- 12. `zmdlogs instances` and the replay's casts disagree silently (`instances --replay`).
- 14. smoke and snapshots read the tree when their turn comes.

Round 5's points (full text in docs/friction-done/2026-11-22-backlog-after-round-5.md under the same number):

- 1. Game-data file reads scattered; table files keyed by size and time (one dataFiles.ts module, exact cache key).
- 2. Status-event landings record no `facts` (`statusFacts` on LandedHit).
- 3. Status and Stagger modifiers identified by their `source` text (`Modifier.status`).
- 4. Test files carry copies of the same helpers (move onto tests/helpers/, drop @efsim/cli's re-export).
- 5. SP kept path-independent by a snap (an SP anchor, only when a shortcut needs it).
- 6. Fixed-length search times not documented (a table in docs/design/search.md).
- 7. Prose citations of doc sections and source paths not checked (extend scripts/check-links.ts).
- 9. Status log keys only in a doc table (`STATUS_LOG_KEYS`; a lane's `since` semantics).
- 10. The importer has no test of its own (on tests/helpers/zmdlogs.ts `syntheticDetail`).
- 11. No shared measure of teammates' attack share (`zmdlogs pace`).
- 13. The cast table's gaps and units (`SkillInstance` world gaps and cooldowns, branded ms / frames).
- 14. The weapon breakthrough table isn't loaded (needs the lead: tables.json, fetch-data in the main checkout).
- 15. A generic "in her ultimate" rules cue (`{ "inUltimate": op }`; team-ab).
- 16. Kit tests pin absolute expiries (`expectLasts`).
- 17. Loop tests depend on engine readings they don't test (pin `options.assume`).
- 18. Test texts in step with the kits (a kit-census warning).
- 19. Kit notes may rest on disabled actions (`efsim gamedata dilations` lists the switched-off dilations).
- 20. Who wears what; an operator's event keys (`zmdlogs list --weapon/--gear`, `census --by-key`).
- 21. `--assumptions` doesn't run the engine's readings (cli/assume.ts `alternatives()`).

## Needs an accuracy or search task (not friction work)

- **The build-offset screen's open lead** (round 9, `efsim zmdlogs offsets --all`; packages/logs/src/buildoffsets.ts
  OFFSETS_EXPLAINED): Snowshine in 04d4, ×0.962 on 77% of her 193 counted hits; `zmdlogs fit-build 04d4 --operator
  chr_0014_aurora`'s best needs two inputs (weapon level 51 and a food, 91 of 207 fit): undecided. And Purrchena in
  99fb (level 1 in the export, ×2.47): fit-build doesn't vary an operator's level (a buildfit.ts candidate set: the
  operator's level, its promotion following). A fitted override moves the verdicts: measure, snapshots:update; drop
  the OFFSETS_EXPLAINED entry with it.
- **The log tools' stop lists from the timeline's applied slow-downs** (docs/friction-done/2026-11-23-remaining-leads.md
  point 3): BuffReplay.appliedStops has them; replayedCastStops could read the first run's, so a cast cut early or a
  kit trigger's jump shows. Purrchena's part was closed (worktree-agent-a432f82c25a7b4d6b, 95917d1); `zmdlogs stops
  --all --differ` (round 9) gives what is left in a few minutes: one slow-down (3f78, Rossi at 50.13 s, timeline
  only), so the lists and the timeline now agree but for it. Moves the placement: measure.
- **Ramp readings anchored on the application's logged ms** (docs/friction-done/2026-11-23-ramp-slowdowns.md point 2):
  where the applying hit landed before a stop and was logged at its end (a7a7 3.86 s, 489c 49.31 s) every reading of
  the instance looks over-held. Pair bounds between consecutive readings of one instance (scripts/probes/corrosion/
  ramp-pairs.ts) and a softer application bound. Moves the placement: measure, the negative control.
- **`launch` delays the next cast, `beside` casts included** (docs/friction-done/2026-11-22-liino-beats.md point 4):
  exempting `beside` casts from timing.ts `ownHitsLanded` changes engine timing; smoke and team-ab.
- **Which skill a logged press is** (docs/friction-done/2026-11-22-yinglung-edge.md point 4): mark a press and a nearby
  placed variant as alternatives of one slot in withLoggedCasts and let makeCast drop the one the state rules out
  (db87's double Twilight battle skill; 04d4's Purrchena counter must stay); measure moves.
- **A cheaper guided rule search** (docs/friction-done/2026-11-22-rule-objective.md point 3): a screening stage on
  shorter fights or a control variate, and resumable guided searches.

Done since round 8's list: the combo reset's reach and pinned expiries (worktree-agent-a432f82c25a7b4d6b, 95917d1 and
5db22a6).
- **Zhuang Fangyi's two extra Sunderblades in 4d60** (physical-statuses report point 3): not Empyrean's free-path or
  Electrification branches: their succeed branches only play an effect (`efsim gamedata tree
  chr_0030_zhuangfy_normal_skill_ult --path '.actionGroupData.timelineActions[14]._sequenceActionData.actionData[1]'`,
  round 10). Still open; the next look is elsewhere in the skill's data.

## What worked well

Each report named the episode its fix would have shortened (Snowshine's end at 106, the Empyrean branches, the
ignored `--from`, d774's pinned total, a fresh worktree's 171 s), so each change was checked on that episode at once;
and `jq` over the new JSON lines answers the follow-up questions without a script.

## Outcome (round 11)

- 1 (A slow-down's identity through the stop lists and the replay's record): carried
  (2026-11-24-backlog-after-round-11.md point 1): logcasts.ts and replayrecord.ts were the accuracy agent's; the stop
  lists' counts after round 11's tick filter are in it.
- 2 (A logged hit placed in the wrong slot is invisible in the totals' parts): carried
  (2026-11-24-backlog-after-round-11.md point 2): not reached this round (fightTotals is in enginecheck.ts beside the
  check's readings).
- 3 (One measure that splits a batch's effect by change): done (48f6676, b7f6e6f): `npm run measure -- --split
  files [--group a,b]` (each changed file's diff alone on --base, default HEAD) or `--split commits --base <ref>`
  (each first-parent commit against the one before), each part measured on the logs the whole change moved, the
  logs no part moved alone named. Tried on the placement leads' range: 1cd1 and af7b by 00876b1, 4d60 by the merge
  that brought the Empyrean's end in, three logs × six steps in 2 minutes.
- 4 (A landing dropped by its own cast's end or a jump leaves no trace in the replay): carried
  (2026-11-24-backlog-after-round-11.md point 3), with stats-candidates point 3 (a skipped press's reason): both the
  replay's record.
- 5 (Per-hit counterfactuals: which single disagreement, taken the log's way, makes a hit fit): partly done
  (7d1497b): HitRecord.counterfactuals (hitexport.ts hitCounterfactuals), build.ts calls it; the `zmdlogs explain`
  view and the hold-outs' shares carried (2026-11-24-backlog-after-round-11.md point 4).
- 6 (A kit field override's errors come one rule at a time): carried (2026-11-24-backlog-after-round-11.md point 5):
  packages/data/src was the accuracy agent's.
- 7 (analyze.py's feature tables take 6 minutes): done (98c3683): the bootstrap over per-fight sums and the
  within-fight shuffles as one lexsort each, in numpy: features 5 min 44 s → 17 s, the whole analysis 67 s (the
  first row's interval identical; later rows' within a point, the shuffles' draws differ).
