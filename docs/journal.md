# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 100 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-18: Typhoeus's and Laevatain's in-game tests from the logs; buffs created in a stop are held

**Goal:** decide from the logs in-game tests 9, 43, 46 (Typhoeus) and 17, 21, 22 (Laevatain's
Twilight and Scorching Heart), checking the re-triage's claims (docs/in-game-tests-retriage-*.md).

**Decided** (each in its test's section of docs/in-game-tests.md):
- 9: the ×1.3 on her Power Shot's burst after a consumed Nature Infliction fits (41 plain matches
  with it, none at ×1/1.3; the misses are other causes).
- 43, partly: the re-triage misread the engine. Her controlled 5th shot is a Power Shot with a
  burst and no arrow used (data and kit); every logged 5th is the controlled one
  (`floating_attack5_01_projhit`) and is followed by its burst. No log has an off-field 5th: that
  half stays for the game.
- 46: one rain per shot, at most five, the 5th empowered (7 ultimates; the re-triage's 13 counted
  the log's repeated `ultimate_skill` events). d9e5's 5th rain needed the window held by two
  teammates' stops that were already running when it began.
- 17 (Laevatain's variant): the jumps skip: explosion to extra hit 0.97–1.17 s (no skip: 2.7 s),
  battle skill to next attack 1.2–1.4 s (3.8 s).
- 22: `since` is the latest (re)application (it moves at every re-creation, f879 92.49 s 12 s into
  an instance); in 25 empowered casts at 4 Melting Flame it never moves at the capped gain: no
  restart, as the engine has.
- 21 and 18's Twilight part, partly: every closed Twilight window outlasts 15 s from the press plus
  the engine's holds by 2.1–6.6 s, so her own stop holds Twilight; with that it's still 0.1–4.6 s
  short in all 7, and no single extra term fits (open-problems). No log has a combo cutting her
  enhanced battle skill short.

**Engine and replay changes:**
- Engine assumption `buff-in-stop` (default `held`; timeline/clock.ts `heldFromNow`, actions.ts
  `addBuff`): a buff created while a time stop or slow-down runs is held by the rest of it, as the
  running buffs were when it began (the same rule as an Arts Burst's clock, T14). It replaces the
  kit assumption `laevatain-twilight-own-stop` (removed with its trigger).
- `loggedCastStart` (buffreplay.ts): another's hit within 0.5 s after an ultimate's cast event, not
  only at it, says the event is the stop's end (Laevatain's ultimate in 17 of 22 windows, was 11).
- `efsim zmdlogs replay --assume <id>=<reading>`.

**Scoreboard** (`npm run snapshots:update`): development plain 49.5 → 50.0%, mismatch 19.3 → 19.3%, mean
|damage error| 13.0 → 12.7% (18 better, 3 worse, 2 mixed); hold-out plain 65.0 → 66.1%, mismatch 7.4 → 6.9%,
damage 12.5 → 12.1% (7 better, 2 worse); earlier pending plain 47.2 → 47.4%, damage 8.2 → 8.4%; verified
unchanged. Worse: db87 (plain 152 → 114: the placement fix makes Laevatain's stop overlap Camille's combo
slow-down, so Arcane's Corrosion ramp is held 0.5 s less; open-problems), d774 (totals +11.6 → +16.7%, Zhuang
Fangyi's ultimate 2.6 s earlier, no verdict moved), 1d91 (two of Ardelia's assumed matches), and 0.1-point totals
(4360, 0c14, c3c7), b6aa one plain hit.

**Examples:** the Ink Melt and Si-Laevatain-Liino-Gilberta timelines repaired (Laevatain's steps in Twilight's
extra 2 s as its forms): Ink Melt's 60 s 3,953,129 → 3,402,966 (−13.9%: its second ultimate no longer fits, as
show_weapon blocks her energy and starts her cooldown 2 s later); Si-Laevatain-Liino-Gilberta +2.7%; Typhoeus's
team's 60 s +0.75%.

**Dead ends:** see open-problems "Laevatain's Twilight runs longer than its model" (a constant,
show_weapon's 16 s, the full 115-frame pause, a smaller combo hold). Two small Typhoeus misfits
noted there (1cd1 40.12 s, d9e5 11.73 s).

## 2026-11-18: Improvement round 3: measuring, views, a fair lock, engine readings

**Goal:** the third friction round (docs/friction/README.md): seven open reports (the round-2 backlog and
friction, the fixture refresh, tests from logs, Arcane's mismatches, cast placement, Stagger windows), ranked by the
time they cost accuracy work, behaviour-preserving. Summary: docs/friction-done/2026-11-18-round-3.md.

**Done** (a commit each):
- `npm run measure` (scripts/measure.ts): the log checks on worker threads into scratch/, the scoreboard change and
  each log's direction printed, nothing tracked written. All 73 logs in 64 s on a quiet machine, against 5-10 min for
  `snapshots:update`; `--with`, `--logs`, `--changed placement`, `--at <ref>`, `--base <ref>`, `--assume`.
- The test lock is a queue (arrival order, premerge and test suites ahead of jobs that arrived up to 20 min before,
  no starvation), with a heartbeat, `with-lock --status`, a batch-script warning; snapshots.sh holds it once;
  `EFSIM-DONE <job> pass|fail` lines; run states in scratch/runs/ (`node scripts/runstate.ts`);
  `snapshots:update -- --costs` alone rewrites pending-costs.json; `scripts/verify-at.ts` verifies a commit while
  editing goes on.
- `efsim zmdlogs casts | replay | stagger | differences | groups`, built from the agents' scratch prototypes;
  `zmdlogs hits --json` gains `listed`, `differences`, physical statuses and `appliedAtMs`.
- Engine assumptions (timeline/assumptions.ts): `control-immunity` (listed / bosses / none / all) and
  `teammate-pause` (6.5s / 3.5s) switch with `--assume`, in `zmdlogs check` and `measure` too (c3c7 under
  `control-immunity=none` gives test 104's Si 120 → 110 plain again).
- The inert Haste speed plumbing (hasteFrames, Acting.speed) removed.
- `efsim gamedata find <type>`; abilityEvent numbers tabled (docs/game-data-format.md) and named by `gamedata tree`.
- Docs: data.md "What the replay takes from the log" and "What the log records" (cast events by kind, hidden casts,
  status keys, ms vs frames); tests.md "Measuring a change"; open-problems' header (a cause cites its check; first
  steps `zmdlogs groups` / `differences`); `.ignore` and counter titles keep hold-outs off screen; CLAUDE.md.

**Behaviour:** `npm run snapshots:update` at 0bb1a1a left every snapshot and docs/accuracy.md as they were ("No log's
verdicts moved", no file changed); `npm run measure` agreed byte for byte; the default suite passed at 2d96fc3
(after the Haste removal) through verify-at. Scoreboard unchanged.

**Decisions:** measure compares against committed snapshots by default (they are HEAD's measurement), and keeps
unmeasured logs at the reference's entry on both sides, so a selection shows only its own moves. The lock's priority
is a fixed head start rather than a count of passes, so it needs no shared mutable state. Haste got no engine reading:
its alternative had no code left worth keeping; the evidence moved to castSkill's comment. `--assumptions` still runs
only the kits' alternatives (backlog point 14).

**Left:** docs/friction/2026-11-18-backlog-after-round-3.md (17 points: the round-2 code-quality items, a CLI / A/B
harness, citation checks, a status-key table in code, example repair, the teammate-pace measure, a cast table, …).

## 2026-11-18: The replay follows the log's Stagger windows

Goal: why the replay's Stagger windows don't line up with the logs'
(Perlica's ×1.3–1.5 runs, 9090's 145 against 208 hits under Stagger,
the snapshots' "staggered hits" errors), and a general fix.

Found: the starts mostly agree; the replay's windows end early, 0.4–12 s
before the log's last Staggered hit (median 3.5 s over 34 windows), and
then the next logged Stagger hit (listed at bar 0 with Stagger dealt)
broke the replay's bar again for a full new window past the log's end.
The damage sides with the log: 597 hits it lists as Staggered and the
replay didn't are ×1.30 (median) the replay's reading, 214 the other way
×0.77. No logged hit falls between a breaking hit and the first one that
lists Stagger.

Done: the replay follows the listing as it follows the bar
(buffreplay.ts `loggedStaggerSteps`; engine `holdStagger`): Staggered
through each listed moment to the next listed one, not Staggered at a
moment that lists none unless a hit there breaks the bar; a log with
bars and buff lists but no Stagger anywhere never Staggers (7b54's slug).
The replay's window tracking keeps one window through a stop that moves
its end (it split them), and `BuffReplay.staggerSpans` / `staggerHolds`
say where the windows were and where the engine's own Stagger would
have ended. Scoreboard (`npm run snapshots:update`): development plain
47.3 → 48.5%, mismatch 19.8 → 19.6%, mean |damage error| 15.8 → 14.9%
(16 better, 1 worse: f978 −3.5 → −3.7%); hold-out plain 62.1 → 63.6%,
mismatch 7.6 → 7.5%, 13.5 → 13.1% (6 better, 1 worse, 2 mixed); earlier
pending plain 45.1 → 45.9%. 9090: Liino −15.0 → −10.4%, Perlica −13.0
→ −10.7%, the fight −5.4 → −2.1%. Damage totals moved away from 0 in
458b (2.2 → 3.2%), c6d8 (32.9 → 36%), 4360 (8.1 → 8.4%): their plain
matches rose, so the added ×1.3 hits are right and the excess is
elsewhere.

Decisions: follow the log rather than lengthen the engine's Stagger, as
nothing found explains the extra length (the engine stays on the data's
PoiseRecTime plus stops and freezes); the teams don't move (52,369 /
53,781 / 63,347 rerun, unchanged). A flat +3.5 s on the engine's Stagger,
tried as a sensitivity: −1.2% (the owner's team), +0.7% (Ink Melt),
−0.2% (Typhoeus's), within the noise. In-game test 110 times a Stagger.

Dead ends (open-problems.md "The replay's Stagger windows"): a ZMDLogs
listing lag, Stagger dealt while Staggered, target hit-stop sums,
Finishers, Lifts, the modelled stops, the Slow status (movement). Left:
Liino's volleys (10 logged, 1 replayed in 9090: her kit's trigger
reading), Perlica's runs (her mismatches stay where log and replay agree
on Stagger: her kit), 4e5e's unattributed Stagger (68 over 53.2–55.4 s,
two steps not whole numbers), whether a Stagger starts the frame after
the breaking hit (~20 hits, mixed damage).

## 2026-11-18: Cast starts across other operators' time stops

**Goal:** the log check placed casts too late where a teammate's time stop
fell between a cast's press and its first landing (Typhoeus in 1cd1, 9090,
dbae: her combo or battle skill up to 3 s late, so the replay cast it after
her hover ended); fix it generally (docs/open-problems.md, "Typhoeus,
Arcane, Liino, Perlica").

**Root cause:** logcasts.ts started each new cast at its first landing less
the landing's kit frame, ignoring the stops between (which hold the cast's
frames while the log's clock runs on).

**Done (packages/logs):**
- `heldStart`: the landing's frames counted back in the world's time (a
  stop's frames at its scale). `castStart` uses it only when the log's cast
  event of the skill is nearer the held start than the plain one, and never
  before that event; a combo isn't held by other combos' dilations; events
  logged at the same ms as another operator's time-stopping cast's event
  don't count (pressed during its stop, logged at its end).
- `castEventOf`: a cast event of a skill the kit doesn't have names the
  slot's skill (Typhoeus's normal_skill → normal_skill_floating_start,
  ultimate_skill → ultimate_skillfloating); `unplacedCastStops` uses it, so
  her ultimate's stop is no longer added twice.
- `missedCasts` (buffreplay.ts) looks again for a missed shot's first frame
  past a stop that holds it (dbae's battle skill, now before Li Zhiyan's
  ultimate, kept its two missed shots).
- A landing logged at its cast's last landing's time, all landings logged,
  is the same landing on another enemy (`PlacedHit.sameAs`, sharing the
  replay's landing), not a second cast (9c6e, a two-target log).
- Tests: tests/logcasts-stops.test.ts, two in tests/buffreplay-typhoeus.test.ts.

**Scoreboard** (`npm run snapshots:update`): development plain 47.3 →
48.0%, mismatch 19.8 → 19.7%, mean |damage error| 15.8 → 14.0%; hold-out
plain 62.1 → 62.2%, mismatch 7.6 → 7.4%, damage 13.5 → 13.0%; verified
unchanged. 1cd1 plain 138 → 161 (mismatches 28 → 5), 9090 818 → 834, 4d60
328 → 336, 9c6e totals +52.5 → −11.1% (mismatches 121 → 130: the second
enemy's hits against the first's landing). Worse only in totals by 0.1
point (af7b, b6aa: same-instant duplicate attacks merged); 458b mixed
(Jsspsi's ultimate from its event at 152.2 s, damage 2.2 → 4.9%).

**Dead ends:** counting every cast back across every stop (development
plain 47.3 → 45.9%, verified 71.0 → 64.9%): stops placed a little off (an
ultimate's stop from its event, which the log has at the stop's end) moved
casts pressed as a stop ended to before it. Combos across other combos'
dilations: bdf2's Corrosion ramp fits only the plain start.

**Left:** fc63's 4th shot anchored to her 5th's cast and its bursts logged
before their shots (no events there to place from); two ultimates whose
first-pass stops hold each other (fc63 41.6 s); 9c6e as a multi-target
fixture.

## 2026-11-18: Arcane's mismatches as one group: lasers on the world's clock, chance-path buffs

**Goal:** Arcane was the most-mismatched operator (908 of 5,575 hits in
the logs the scoreboard counts); look at her misses together, find the
shared causes, fix what's general.

**Done:** grouped every Arcane mismatch (scratch scripts over `zmdlogs
hits --json`: each against teammates' mismatches at the same ratio within
1.5 s, and the engine's modifiers against the log's listing). The groups,
causes and what's left are in docs/open-problems.md ("Arcane's mismatches
as one group"). In short: 557 are the stage logs, 15 d9e5's fight-wide
factor (now ×1.12–1.20 on everyone, not ×1.7–2.0), ~143 team-wide
(Stagger, placement, Corrosion levels), ~110 teammates' buffs on her
basic-attack strings (Alesh, Liino, Ardelia, Camille), the rest her lasers
and her combo's explosion. Two fixes:

- **Her lasers on the world's clock.** The Cluster Strike lasers and the
  INT early end's lasers are buff timelines (`buff_…_inaura_laser1/2`,
  `seal_finisher_wisd`); the game runs buffs on the world's time, so her
  own ultimate stop holds them, which it doesn't hold on her own clock.
  Players cast Gloompurge Arcana as soon as the second strike makes it
  castable, so that strike's lasers fell in her own stop (a7a7: logged at
  55.99–56.47 s, the replay had 54.3–54.9 s). The "hits" trigger action
  has `world` now (engine, loader, schema; tests/world-clock-hits.test.ts).
  a7a7 Arcane mismatches 28 → 19; scoreboard rows unchanged.
- **Buffs only a chance path's hit applies are the log's to say.** The
  replay rolls Alesh's Rare Fin itself; in ad7f it rolled one his logged
  slam doesn't fit, and his P3 team ATK stood on 10 s of hits the log
  lists it on none of. buffreplay.ts `chancePathBuff` makes such a buff
  unjudged. ad7f Arcane 34 → 1 mismatches, Si 80 → 100 plain; 4e36 plain
  117 → 239.

Scoreboard (the tool's output, both commits): development plain 47.3% →
47.7%, mismatch 19.8% → 19.6%, mean |damage error| 15.8% → 15.7% (5
better, 0 worse); hold-out plain 62.1% → 63.3%, mismatch 7.6% → 7.7%,
mean |damage error| 13.5% → 13.4% (3 better, 1 worse); earlier pending
plain 45.1% → 46.2% (0c14 mixed: Si's log-listing fallbacks 7 → 1 in a
log where 190 of his 194 hits fit no reading). Arcane 908 → 866
mismatches, plain 3,277 → 3,328.

Teams (`efsim rules`, 32 fresh seeds 1001–1032): the owner's team 53,781
→ 53,780 / 52,740 → 52,744 (from zero); Typhoeus's 52,369 → 52,374 /
48,967 → 48,973: no movement (the team pages keep their numbers).

**Dead end:** a freeze holding only the freezer's own debuffs on every
enemy (ad7f's Imprisonment ends 2.5 s late in the replay because Si's
Immobilization holds it): 489c, b6aa, 7910 worse, hold-out plain 63.3 →
62.9%. Rejected, as the freeze code's evidence said.

**Left (open-problems):** Imprisonment's end, which the log records as a
combo cast before each explosion: the replay's is a median 0.3 s late
(4d60 1 s on every window); the seal buff's abilityEvent 8 / 1403 / 1601
end it early and aren't decoded. a7a7's INT lasers 0.4–1.1 s early. For
the parallel agents: db87's first strike (Laevatain's ultimate stop
missing from the placement), fc63's second (Typhoeus's shot count), and
the ×1.3 runs of 1d91 70–72 s and 4d60 80 s (Stagger). Alesh is ×0.85 on
every hit in ad7f (his build), untouched.

## 2026-11-17: Haste is movement speed; the owner's team drops Initial Stroke

**Goal:** settle what Si's talent Haste does after the logs found it doesn't
speed up attacks (docs/journal/2026-11-17-01-tests-18-19-101-104-from-the-logs-bosses-freeze-haste-isn-t.md),
and whether the owner's team should still press Initial Stroke.

**Done:**
- The owner (2026-11-17) has never noticed Haste in play and would notice
  faster attacks. The game's own glossary entry for Haste (I18nTextTable_EN,
  the `ba.speedup` term) reads "Temporarily raises the movement speed of a
  target … Effects of the same type can stack until hitting the speed cap";
  Slow is its opposite ("movement speed reduction"). So Haste is movement
  speed, which the simulator doesn't model: settled by the data's text, the
  logs (test 19) and the owner.
- In-game test 109 (does the Haste need Initial Stroke) moved to the bottom
  of the queue: it matters only if Haste shortened cooldowns, which nothing
  suggests.
- The owner's team's rule 9 now presses only Si's battle skill (no Initial
  Stroke). `efsim rules … --compare` against the old list: +1.37% ± 0.58 on
  64 fresh seeds at full energy, +0.66% ± 0.52 from zero (noise), one press
  fewer. On seeds 1001–1032: 53,781 (sd 1,194) / 52,740 (sd 1,539), against
  52,382 / 52,716 with Initial Stroke (docs/teams/estella-si-akekuri-arcane.md).

**Left:** the `hasteFrames` plumbing in the engine is now inert (a cleanup
for a later round). No other rule list in examples/ presses Initial Stroke.

## 2026-11-17: Tests 18, 19, 101, 104 from the logs: bosses freeze, Haste isn't attack speed, teammates' pause

Goal: the owner can't record tests 18, 19, 101 by hand and answered 104
from play (most bosses freeze, a few rare ones don't); decide what the
logs can (development logs only).

**104.** Bosses freeze by default now; control immunity is per enemy, in
a table with the log evidence (packages/data/src/enemyFacts.ts, read into
EnemyData.controlImmune: the data has the tag on no enemy, so it's a data
fact from the logs, not an engine rule). Each boss with a freezer, checked
frozen against immune: Rhodagn's five logs don't move (he freezes),
Chiliarch (c3c7: Ardelia's Susceptibility held too long) and the enemy Si
(4a64: Arcane's WILL debuff held too long; 3f78 leans the other way) are
listed immune. Under both readings Si's own debuffs are held, so her
Artful Intent ends (the 2026-11-13 evidence) don't tell them apart. Not
per fixture: fixtures are being refreshed in parallel, and immunity is the
enemy's. Scoreboard unchanged in every group.

**18.** Cooldowns run through others' ultimate stops: settled (58 combo
pairs come back between the cooldown and the cooldown plus the stops,
e.g. Typhoeus 17.1 s apart, cooldown 17 s, 4.9 s of stops in 9c6e).
Estella's Physical Susceptibility held by her own stop fits c4f3 (5 of
6). Laevatain's Twilight isn't decided (her logged Twilight ends run
2.5–7 s past the simple model): registered as kit assumption
`laevatain-twilight-own-stop` (reading `held`, +2.03 s).

**19.** Haste doesn't speed up attacks: basic-attack steps in the 5 s
after Si's Inksoul ends (30%) are 0.995× as far apart as elsewhere (95%
0.95–1.02; sped up, 0.77). The engine no longer plays hasted casts faster
(clock.ts actionSpeed is 1). It broke the five Si example timelines,
which had been searched with hasted casts: each now has the better of
the old timeline repaired (the gear ascent's repaired replay: steps
moved later or dropped) and a fresh single-beam search, a lower bound
(owner's 3.99M → 3.47M repaired, from zero 3.26M → 2.29M searched; Ink
Melt 4.75M → 3.95M repaired, from zero 4.72M → 2.84M searched, beam 48 no better; Si, Laevatain,
Liino, Gilberta 3.08M → 2.60M searched). A full re-search (beams
12/24/48, skeletons) is left: hours of CPU.

**101.** Not one timer: two thirds of full chains run straight on, the
rest wait a heavy-tailed pause (median 3.7 s); the share of free time a
teammate attacks depends on the fight and the operator (R² 0.41 each),
not on Stagger or the parser. Measured the same way, the engine's
teammates attacked 0.59–0.66 of their free time against the logs' 0.43
(median per operator-fight): the old 3.5 s was the median of the gaps
over 1.5 s alone. Pause now 6.5 s (0.41–0.45). The log replay plays the
logged casts, so only the examples and the rule numbers see it.

Rule numbers (32 fresh seeds, sustained DPS, full / from zero; docs/teams):
the owner's team 56,493 / 56,055 → bosses freeze 56,716 / 56,141 → no
Haste speed 55,278 / 55,598 → pause **52,382 / 52,716**; Ink Melt 69,668
/ 61,716 → 69,698 / 62,331 → 61,255 / 57,302 → **63,347 / 56,123**;
Typhoeus's team (no freezer, no Haste) 54,607 / 51,076 → pause **52,369
/ 48,967**. All three fight Rhodagn, now frozen by Si's battle skill.
Scoreboard (docs/accuracy.md): bosses freezing moves no group; Haste
without cast speed: development plain 47.2 → 47.3% (79cc +26 plain, 458b
+4, 791 −3 plain but damage −18.4 → −17.6%, a7a7 −2), mismatch 19.8% and
mean |damage error| 15.8% unchanged; hold-out 62.1 / 7.6 / 13.5%
unchanged. The pause doesn't reach the log replay (it plays the logged
casts).

Dead end: the old 3.5 s's "40% of free time" didn't reproduce with the
same measure on the engine. A scratch measure had a units bug (time stops
in frames compared with ms), harmless since both sides had it.

## 2026-11-16: Older development fixtures refreshed from fresh battle details

Goal (the lead; backlog after round 2, point 3): give the 79 development
fixtures imported before 2026-11-16 what newer imports keep, from a
one-off fetch of their raw details the owner approved.

Done:
- `efsim zmdlogs refresh <fixture>` reads the cached detail when
  `--detail` is omitted, else fetches it once (`refreshFromDetail`,
  zmdraw.ts). `refreshFixture` now rebuilds the hits as an import would
  (`zmdlogsHits`, factored out of `zmdlogsToFixture`) and adds every
  field the fixture lacks: casts, poise, poise.origin and, new, effects'
  and boundaryEffects' `source` / `since`, one provenance note per kind.
  The rebuilt hits must equal the fixture's but for those fields, and
  logged casts the detail's; otherwise `RefreshMismatch` and nothing is
  written. Tests on synthetic details (tests/zmdrefresh.test.ts,
  tests/helpers/zmdlogs.ts).
- Import against refresh, compared: everything an import records from
  the detail is now covered. Not refreshed, as they come from elsewhere
  or feed the computation: the team (the export, a second request), the
  enemy level (stage or total damage; where the stage names the boss,
  its level is every fixture's), the import's notes, `verifiedAgainst`.
- The fetch: 79 details, one request each, 3.5 s apart, all found, no
  parser version changed. 77 fixtures refreshed (6 multi-target ones also
  got casts and Stagger); every other field is as it was (checked against
  HEAD), and no string other than game keys and the notes was added.
- `npm run snapshots:update`: no snapshot and no scoreboard number moved
  (the fields are record-only).

Skipped: 40d9 and 4e5e (verified). Each detail now lacks a zero-length
buff lane at one hit that the fixture lists as unquantified (40d9's lane
is still there, with its dynamic effects emptied; 4e5e's is gone).
Damage and hit counts match, but the brief said not to overwrite a
detail that differs. ZMDLogs can change a stored detail
(data-sources.md).

What the new fields answered (open-problems.md): Electrification's
logged giver is the replay's applier at 3,497 of 3,505 kit hits (the 8
others in 3aa6), and the level readings that differ are in 3aa6 and
d774. Breach can't be checked from the hit export (it lists no physical
statuses). Of 79 Artful Intent bursts, 39 are credited to Final Stroke
and 33 to an Inksoul expiry; 7 deal no Stagger and record no path.

## 2026-11-16: Improvement round 2: package boundaries, CLI commands, design.md split

Goal (the lead): the larger restructures of the architecture review
(12–14) and the open friction points, behaviour-preserving throughout.
Summary: docs/friction-done/2026-11-16-round-2.md.

Done, one commit (or two) per item, in order:
- **Quick wins:** `npm run lint:changed`; premerge skips the suites when
  typecheck or lint fails; the game-data cache keys only on what the
  build runs and says why it rebuilds; `framesOf` / `withSeconds`;
  `node scripts/with-lock.ts`, `scripts/at-commit.ts`, a per-file
  progress reporter for background vitest runs; one snapshot writer and
  `scripts/snapshot-keys.ts`; status tests on `toMatchObject`;
  `PolicyObserver.check` / `.press`; pending shards balanced by measured
  time (longest shard 79 → 54 s of check time).
- **CLI:** one module per command (`packages/cli/src/commands/`); the
  usage text is byte for byte the old one.
- **Engine:** `core.ts` (`@efsim/engine/core`) and `planning/`, with
  lint-enforced boundaries; the data package imports only the core.
- **Logs:** `packages/logs` (`@efsim/logs`), the logcheck ⇄ enginecheck
  cycle broken; `efsim zmdlogs` is a thin wrapper.
- **Docs:** design.md is the principles and an index; the sections are in
  docs/design/; `npm run links` (and a test) checks relative links.

Checks: after every item `npm test` passed and 42–48 CLI invocations gave
the same output as 1de265e (scratch/at/, `scripts/at-commit.ts`), apart
from timings and the provenance line. `npm run snapshots:update` after
item 4 left every snapshot and docs/accuracy.md byte for byte as they
were: the scoreboard didn't move.

Decisions: the planning code moved into a folder (a visible boundary,
simple lint globs) while the core stayed where it was, so tests' deep
imports into timeline/* still work; `@efsim/cli` re-exports `@efsim/logs`
so older imports work; setup-worktree now also links a new workspace
package in the main checkout (packages/logs), so main runs after the
merge without `npm install`. Not done (carried to
docs/friction/2026-11-16-backlog-after-round-2.md): one module for data
file reads, facts on status landings, a structured status on modifiers,
the test-helper moves, the SP anchor, search-time tables.

## 2026-11-16: Rule numbers refreshed for the fixed driver; Ink Melt re-tuning finds nothing

Goal (the lead): after the rule driver's fixes (one start check, event
stepping), refresh the documented rule numbers, and win back Ink Melt's
−2.4% from zero if a change holds up.

Done:
- `efsim rules --first-seed n` (default 1): the report on fresh seeds.
  The three team pages' "Rules" tables, design.md's results table and the
  example lists' descriptions now give 32 fresh seeds (1001–1032), full
  energy and from zero. The old 10-seed numbers are marked superseded in
  one line. The owner's team: 56,493 / 56,055; Ink Melt: 69,668 / 61,716;
  Typhoeus's: 54,607 / 51,076. Against the fixed 300 s search: +21.1%,
  +27.4%, −3.2%.
- The owner's page: Initial Stroke's +4% was the old driver's. Now
  leaving it out is noise under the data's reading and +2.8% ± 0.6 under
  test 109's alternative (`--assumptions`), so test 109 decides it.
- Ink Melt: neither guided search kept an edit: the default one, judged
  on the zero start too, and one led by the zero start. Nor did a short
  random search. From zero the best edit was noise (+1.2% ± 1.2) and lost
  6.6% at full energy. The example list stays (team page).

Also: the friction report of phase 2
(docs/friction/2026-11-16-phase-2-friction.md).
