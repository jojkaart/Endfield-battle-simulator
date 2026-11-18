# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 102 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-18: Liino's and Perlica's in-game tests from the logs

**Goal:** decide from the logs the open in-game tests on Liino and Perlica (Typhoeus's team) under the owner's
"Logs first" rule, and fix the engine where the logs show it wrong.

**Decided** (each in its own section of docs/in-game-tests.md): **26** Liino's volley, a plain 10 s timer (the last
entry's data and logs); **6** Liino's ultimate, the values hold (572 checked hits, 332 plain, dbae 25 of 25; the
mismatches are 7910's Tangtang weapon value, 8915's stage factor, team-wide runs in 9847 and 4d60); **67** no Knock
Down after Perlica's finisher (three finishers, while Knock Downs are logged elsewhere: 42 hits in 4 logs).
**Partly:** **25** (4 layers per teammate; left: a heal at full HP), **27** (her combo opens in Cosmovoice: d774's
Cosmovoice variant, plain; left: energy, acting after it), **68** (Wild Wanderer from her combo's forced
Electrification: 21 of 21 starts in 4 logs; the reaction half and P3's layers per reaction are in no log).
**Not decidable from these logs** (each section names the log that would decide it): **66** (no Perlica combo lands
on a stronger Electrification: 3aa6's three near-cases were consumed by Zhuang Fangyi's battle skill first), **93**
(no Camille with Liino; her talent 2 is listed after all, as `talent1_atkup`, starting only at her own combo heals,
with no other battle/combo/ultimate heal on her in any log), **28** (none of it logged).

**Engine change:** Liino's Cosmovoice has ten beats, not nine. The three Cosmovoices logged with every beat (4bfc,
4d60, 9847) have ten each, never eleven; the kit had ended the beats' buff with its 77–477 creating clip. Now it ticks
at 482 too and ends at its 15 s duration. Scoreboard (docs/accuracy.md): development plain 51.4 → 51.5% (mismatch 18.2%, error
12.9% unchanged), verified and hold-out rows unchanged (66.0%, 7.2%, 12.4%); logs better 3 (4d60, 9847, 9c6e), worse
1 (8915: its stage factor, every prediction already too high), and d774 among the earlier pending (its replay
already lands beats where the log has none); hold-out 2 better, 0 worse. Liino's row: plain 55.9 → 56.0%, mismatch
18.9 → 18.8%, mean |damage error| 17.7 → 18.2% (the extra beat where the replay's beats are already off: d774,
8915). Team (32 seeds): 52,529 →
52,563 / 49,185 → 49,206; the 60 s timeline 5,649,021 → 5,654,191 (from zero unchanged).

**Corrections to the re-triage** (model output): test 27's five "combos in Cosmovoice" were counted after repeats of
the ultimate's cast event, all after the stance had ended; test 93's "no talent-2 buff listed" missed it under its
data name; test 66's verdict stands, but for a reason it didn't give.

**Left:** the beats' timing (logged 1.35–1.55 s apart, other operators' stops; open-problems.md "Liino's Cosmovoice
beats", next: pinning them to their logged landings as the volleys are); Perlica's combo hits ×1.15–1.40 above the
engine in fc63, 3aa6, 4d60, 4360, 9847 (seen, not followed).

## 2026-11-18: Si's misfit logs and Ardelia's build: build overrides and fit-build

**Goal:** the misfits of Si (0c14, 9555, c83c) and Ardelia (f978, 1d91): build offsets or kit rules, and build
offsets fitted from the hits instead of by hand (the roadmap's "build fitter with structured buildOverrides").

**Done:**
- **Build overrides and a fitter.** A fixture's `buildOverrides` sets fields over the exported `team` when it is
  read (`readLogFixture`; `readLogFixtureRaw` and `zmdlogs refresh` keep the file as written), each with its
  evidence. `efsim zmdlogs fit-build <fixture> --operator <op>` (packages/logs/src/buildfit.ts) scores every
  attribute-node count, weapon level and food by the operator's landed kit hits within ±1 of the primary reading
  recomputed with the candidate's panel (clean hits counted apart), so foods' DMG lines and crit-null hits count.
  docs/design/data.md, the log check's rule.
- **Fits** (open-problems): 0c14 Si = Kunst Tube (her teammates' food) and two attribute nodes: her ratio was
  ×1.1543 without Alesh's +0.16 DMG and ×1.1322 with it, which only an additive DMG (+0.247) with ATK ×0.962 fits;
  46 of 191 hits, 25 of 25 clean. 9555 Si = no attribute node (×0.9397). f978 Ardelia = weapon at level 60 (the
  earlier "no pair fits" read the ATK ratio, inside the hits' rounding): 107 of 139, all 55 clean.
- **0c14's step ×1.0965 at 13.25 s:** Alesh's P3 ATK and Thermite Cutter's team ATK, listed from a combo whose hits
  the log hasn't; the replay can't cast it (left: a cast inferred from a buff only it gives).
- **c83c's late combos:** now one Yinglung's Edge layer off each way (the +21% went with the consumed-buff fix).
  The engine assumption `battle-sub-skills` (main-only: sub-skills unseen by skill-type triggers) measured mixed
  (c83c 31 → 22 and 9555 11 → 1 mismatches, the hold-out row 7.4 → 7.6%), so it stays a switch; Si's
  battle-button events every 3.2–3.6 s (most hitless) are the open part (test 106).
- **1d91's Ardelia:** not a build: Liino's Medicant layers reach her later than the engine's every-beat heal
  (1 layer to 18 s, none at 23–32 s, 2–4 after), Typhoeus and Arcane at other times: the soundwave's area is the
  candidate (positions, not modelled).

**Scoreboard** (`npm run snapshots:update`, docs/accuracy.md): development plain 49.5 → 50.2%, mismatch
19.3 → 18.4%; earlier pending plain 47.2 → 47.8%, mismatch 26.1 → 23.9%; all but the hold-outs mismatch
21.5 → 20.1%, mean |damage error| 10.1 → 10.0%; hold-out unchanged; 1 log better, 2 mixed (0c14, f978: plain up,
mismatches down, their simulated totals +1.0 and −0.2 points), none worse. Si's mismatches 18.6 → 10.0%,
Ardelia's 22.2 → 12.9%. Example and kit snapshots unchanged.

**Decisions:** the fits are overrides, not edits of `team`, so a later fitter (weapon levels bounded by their
logged skill levels: WeaponBreakThroughTemplateTable isn't loaded yet) can redo them; the older hand fits stay in
`team` with notes (not migrated). No kit default changed, so the team numbers don't move.

**Dead ends:** a food alone or a node count alone for 0c14's Si (it takes both); replaying the food search through
the whole check per candidate (minutes per log; the fitter recomputes the primary reading instead, seconds).

## 2026-11-18: Liino's volley is a timer; Perlica's runs aren't her kit

**Goal:** two leads on Typhoeus's team: Liino's volleys (9090: 10 logged, 1 replayed) with 1d91's doubling, and
Perlica's ×1.3/×1.5 runs (4360, 9847, …) and fc63's ×0.934.

**Liino's volley.** Her volley buff (spelllnfliction_extraattack) ticks every 10 s from the battle skill's frame 45,
first at once, and its tick's reaction check has `isEnable false`: a plain timer, not test 26's reading B (a reaction,
then 10 s). `efsim gamedata tree` left disabled actions out as defaults, which is how the dead condition read as live
for months; it now prints `DISABLED`. The logs agree (103 volleys, 10.0–11.7 s of world time apart, also with no stop
between). The kit's volley_window ticks; since the game's clock for it runs ~5% slower than the replay's world time
(as her beats' does), the replay takes each tick from its logged volley (`KitBuff.ticksShownByHits`). 1d91's "doubling"
was the team's buffs (Ardelia's Susceptibility and Arts DMG Taken, Arcane's WILL, usp02): its 886s now match plainly.
In-game test 26 is answered by the data and the logs (told to the lead; in-game-tests.md is another agent's).

**Perlica.** Not her kit. Talent 1 fits where the engine gives it; 9847's runs are team-wide (Gilberta, Avywenna,
Liino at the same ratios: Bigents' fight). 4360's ×0.62–0.70 run was Liino's Cosmovoice kept on past an End Stance the
log doesn't record: the kit can't cast her battle skill in Cosmovoice, the replay made it anyway. The replay now infers
the exit press after the log's last listing of the stance's buffs (`exitPresses`). fc63's ×0.934 is her ATK (3,571
from 30 hits, against 3,822); no weapon level or skill level at her logged level 90 gives it, and the "artifice read as
0" candidate is ruled out by direction.

**Scoreboard** (docs/accuracy.md): verified plain 71.0 → 72.8%; development plain 49.5 → 50.8%, mismatch 19.3 →
19.0%, mean |damage error| 13.0 → 12.9%; hold-out plain 65.0 → 66.0%, mismatch 7.4 → 7.2%, error 12.5 → 12.4%. Logs
better 12, worse 1 (891: its Liino volleys are ×0.1 the engine's, like c6d8's every hit, so landing more of them adds
to an existing overshoot), mixed 4. Team (32 seeds): 52,374 → 52,529 / 48,973 → 49,185.

**Dead ends:** reading Liino's battle-skill events at a volley's first-hit ms (37 of 100 volleys have one) as the
volley's own, not beats: only 1d91 and 7910 moved, both worse (their stance was cast before the log). Pinning every
ticking buff to its logged hits also fixed Rossi's bleed (489c mismatch 124 → 111) but is outside this task: opt-in
for Liino only, a lead for Rossi's kit.

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
