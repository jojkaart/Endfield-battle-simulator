# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 177 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-27: The break's open points: the hold's place, combos, the Stagger end

**Goal:** the open points of the hold at a Stagger break (docs/open-problems.md "The hold at a Stagger break"): where
the hold sits against the breaking hit's logged ms, breaks inside a combo's slow-down, a `stagger-recovery` refit,
and the two hold-outs whose ~30 hits went plain → assumed.

**Done:**
- **The hold's place** (scripts/probes/stagger/break-place.ts): of the 22 breaks a clock reads, 16 are late after the
  ms only; 9090 128.92 s before it only, c4f3 33.58 s and 5082 44.43 s on both sides. The log stamps a breaking hit at
  its hold's start, inside it or at its end. No logged moment falls inside a hold, so the next moment bounds it:
  engine assumption `break-hold-place`, reading `moments` (holds.ts breakHoldStarts, a replay step that holds from
  the hold's start: replaysteps.ts, clock.ts breakHold `placed`), registered with the default `ms`.
- **Combos:** the hold applies inside a combo's slow-down, unscaled (a7a7 48.14 s, f879 57.12 s, c83c 55.83 s:
  +458–501 ms after the ms); the three with hits 0.13–0.25 s after are the stamped-inside case.
- **The Stagger end:** scripts/probes/stagger/stagger-end-fit.ts over `zmdlogs stagger`'s 38 bracketed runs: the
  engine's own end +0.32 s past the bracket's middle at the median; −0.3 s centres it, the mean |error| 2.74 → 2.72 s.
- Two placement diffs measured and kept in docs/tried (logcasts.ts is another agent's file): the pass-2 stops with the
  breaks' holds (hold-outs unchanged), and a cast's start held back by them without a cast event (development 3
  better, hold-outs 2 worse, plain −12).

**Scoreboard:** unchanged (the defaults are the old behaviour; `npm run measure` with `moments` as the default:
development plain 84.2% either way, 4d60 +2, 9090 −2, d4fb −1; hold-outs unchanged).

**Decisions:** `moments` not the default: flat on every group, and in 9090 it holds Liino's two volleys due at
128.57–128.60 s (logged at 128.50 s, the replay's clock 0.07–0.10 s late there) past their landing
(tests/buffreplay-typhoeus.test.ts). `stagger-recovery` stays `2s`: the shift that centres the median is within its
error. No simulated fight moved (the new reading is the replay's only), so no team-ab.

**Ruled out for the hold-outs:** the hold's start as the moments place it; the placement's stops with the breaks'
holds; the held cast starts made them worse. Under `break-hold=none` they lose one INSIDE decision: an action the hold
lengthens past the next press (as 3aa6's breaker logged inside its hold, fc63's combo across a break) is the lead.

## 2026-11-27: The hold at a Stagger break; Rossi's bleed through her freeze

**Goal:** two leads of the placement-cases round (docs/open-problems.md): the clocks that run late across a logged
Stagger break (round 18's `zmdlogs clocks` rows, 5082's Yvonne +0.51 s), and 99fb's bleed ticks after Rossi's
ultimate placed as battle-skill hits.

**Done** (docs/open-problems.md "The hold at a Stagger break"):
- **A break holds every clock** (engine assumption `break-hold`, default `14f`; timeline/clock.ts breakHold, called
  at dealPoise's `staggered` in landing.ts): 14 frames at scale 0 for the world, the enemy and every operator, the
  breaker too, not inside an ultimate's stop. The evidence (scripts/probes/stagger/break-hold.ts): the clocks 0.6 s or
  more past a break run 0.41–0.61 s late but two (26 rows, every operator and enemy, enemy ticks too, median 0.54 s);
  none at the 86 Stagger Node crossings, whose buff (buff_common_mini_poise_break) has a 0.5 s layer-1 dilation. The
  data's enablePoiseBreakTimeDilation is true on every damage unit and has no length. 14f: the Node buff's curve holds
  0.46 s, and 12f–18f match alike while 16f/18f put c83c's total 5 points off (a tail cut's threshold).
- The replay: its tick bounds take the logged breaks as stops (holds.ts loggedBreaks, breakStops), so the hidden
  holds don't place the hold again; it holds only at the breaks the log shows (TimelineScenario.loggedBreaks, ±4
  frames: 6339, d4fb, f978 and 0c14 break the replay's own bar where the log has none). 5082's Yvonne keeps her chain
  at 45.06 s. Dropped after the split: the replay's Stagger window recorded from the break, not 14 frames later
  (docs/tried/2026-11-27-break-window-start.diff; the hold-outs 2 better without it).
- **Rossi's bleed runs through her ultimate's freeze** (kit `runsThroughFreeze` on Razor Clawmark): the replay held it
  +93 frames at the freeze (frames 57–150 of her ultimate on an Elite), and the log's ticks run a second apart there in
  every Elite log (99fb, 2fd9, 207f). Nothing ended the bleed: the "ended" one was held, so its logged ticks had no
  replayed landing and the placement took them for a battle skill's.

**Scoreboard** (`npm run snapshots:update` at the final commit, against f96757f): development plain 83.9 → 84.2%,
mismatch 4.8 → 4.7%, mean |damage error| 1.2 → 1.3%; earlier pending plain 81.9 → 82.2%; verified unchanged;
hold-outs plain 82.9 → 82.5%, mismatch 5.4 → 5.3%, |damage error| 6.3 → 6.4% (2 logs, about 30 hits plain → assumed:
still matched, under every hold length). The split (open-problems' table): the hold itself carries the hold-outs'
loss; the gate, the tick stops and the Stagger end don't; Rossi's bleed alone moves no hold-out aggregate (development
plain +0.1, and its fights' totals 207f 0.4 → 1.1%, 99fb −0.1 → 0.5%: more of the logged ticks land).

**Team numbers** (`node scripts/team-ab.ts --base a6c425f`, 32 seeds): the owner's team (estella-si-akekuri-arcane)
sustained DPS −0.89% (full energy, sd 2.9%) and −0.90% (zero); Typhoeus's team −0.60% / −0.36%: every break now costs
the team 0.47 s, within one sd.

**Decisions:** an engine stop, not a replay-only hold: the evidence is every operator's and the enemy's, so the
simulation has it too. `stagger-recovery` stays `2s` (with the hold the engine's own Stagger runs short in 18 of 71
logged runs, quartiles 0.43 / 0.84 / 1.62 s, against 20, 0.60 / 1.53 / 3.32 s; a refit is a next check).

**Open:** where the hold sits against the breaking hit's logged ms (9090, c4f3, 3aa6: the late clocks before it);
breaks inside a combo's slow-down; the hold-outs' 30 hits.

## 2026-11-27: Hard 33's eight slugs; status pairs read by the check

**Goal:** two leads on main at a6c425f: Hard 33's slug (7b54 +40.4%, the largest development error; 6339 −12.6%), its
mechanics from the game data and the logs; the status pairs whose replay value a buff's edge put off (1d91, 7b54,
a7a7, e989, 7910, abfd), beside an agent on holds and Rossi's bleed (its files untouched).

**Found:**
- **The slug is eight slugs** (docs/open-problems.md "Hard 33's Woodcraft Slugs"; scripts/probes/targets/slugs.ts):
  both totals are 9.600 Max HP (eight of 1.2), the kills fall at whole slugs of damage (6339: 1.00, 3.00 with two at
  one ms, 4.46, 5.00, 6.00, 7.00, 8.00), one key at one ms at several values (7b54 17 times), and the stage's own text
  says "They are legion" (one slug unshielded at a time, its death unshielding another). The data's number shield
  zeroes a shielded slug's hits (−9999 in the product zone): no log has a zero hit. ZMDLogs lists every slug's debuffs
  under the one id (7b54's attack 1 at 5.27 / 10.99 s: one listing, ×1.198 apart = Jade Vessel × Camille's 0.07), so
  "debuffs that don't act", the partial purges and the non-round factors were other slugs' debuffs, and the purges
  kills. The slugs' own buffs and AI aren't in the data.
- **The status pairs, case by case:** 1d91 (the game's burst after Arcane's combo touch, its listing has Doubles) and
  7910 (held by Arcane's own ultimate stop at +0 ms) on the other side of a buff's edge; abfd held 2.55 s (76 frames);
  a7a7 not an edge: Liino's Medicant ×4, an unjudged kit buff the burst's listing lacks; e989 not an edge: the replay
  keeps Camille's Firefang Weakness 69.19–89.32 s (open); 7b54 the slugs.

**Done:**
- 6339 and 7b54 marked `severalTargets` with that evidence (their own row with 9c6e: a reclassification).
- **`logged-purges` `log-kills`** (default; enginecheck.ts killPurges): in a several-targets fight the replay's enemy
  sheds the team's debuffs at each logged kill.
- **`status-pairing` `check`** (default): a pair fits too by the check's primary reading of it (enginecheck.ts
  primaryParts, now shared with readingBasis), with the landing's modifiers or the replay's at the logged hit's frame,
  and a pair that fits only there is read there by the check (BuffReplay.statusInputs); STATUS_WIDE_FRAMES 60 → 90.
- tests/slug-targets.test.ts, tests/status-pairing-check.test.ts; damageOptions exported from the engine's barrel.

**Scoreboard** (`npm run snapshots:update` against a6c425f): development (29 fights) plain 82.7 → 83.9%, mismatch 5.8 →
4.8%, mean |damage error| 2.9 → 1.2%, |matched| 2.16 → 1.35%, replay-only 2.83 → 1.12%, log-only 1.60 → 0.57%; of it the
reclassification alone (measure's plain tree) plain 83.8%, 4.8%, 1.2%, the readings +0.1 plain. Hold-out plain 82.7 →
82.9%, mismatch 5.4%, |damage error| 6.3%, replay-only 2.69 → 2.62%, log-only 4.79 → 4.70%: 3 better, 1 mixed (plain +3,
its total moved), none worse. Earlier pending plain 81.8 → 81.9%; verified 78.4 → 78.5% (b7b3). Several targets (3
fights) 48.1% plain / 20.6% for 9c6e alone → 54.1% / 20.0%. Better: 1d91, 4360, 7910, 79cc, 8915, 9847, 9c0b, c83c, e989,
012a, 9555, a7a7, b6aa, c6d8, d774, e82d, b7b3, 7b54 (plain 1 → 65, +40.4 → +15.7%); mixed (plain up, a total 0.1–0.3
points further): c779, f978, 3aa6, abfd, c3c7, 9c6e (plain 200 → 244, −20.6 → −24.5%: the second target's log-only no
longer cancelled); worse: af7b (total 0.7 → 0.8%, a burst now paired at a slightly other value), 6339 (plain 114 → 108,
−12.6 → −19.7%: the slug after its 20.37 s kill had Camille's Susceptibility). No simulation reads either assumption
(log check only): no team-ab.

**Decisions:** a fixture mark and a kill purge, not a shield model: which slug a hit lands on is in no log, and the
listing can't say a slug's debuffs; a kill is the one moment the log says the target changed. `check` reads a pair at
the logged frame only where the landing's own frame doesn't fit and the logged one does (the assumed → plain bursts of
b7b3, c779, c6d8: Arcane's WILL burst line a frame off): the log's time is the burst's.

**Left:** e989's Camille Firefang Weakness (replay-only run 69–89 s); per-target state for several-targets fights;
the slugs' replay-only landings (hits on shielded slugs).

## 2026-11-27: Improvement round 18: records of rules that decline, one run for several answers

**Goal:** the five open friction reports and round 17's backlog (docs/friction-done/2026-11-27-round-18.md), on main
at 5cf680e, every file this round's; no number to move.

**Done:**
- **Rules that decline leave a record:** TAILKEPT decisions (replayrun.ts tailCuts' kept tails and their guard),
  PlacedHit.joined (the rule that joined a landing to its cast and its times: `zmdlogs casts --choices` prints the
  joins over 1 s late, 399 HIT lines over the development logs, 204 `to come`), REALIGN lines (Placement.realign), the
  one-sided `kill` flag and `zmdlogs away`'s logged kills.
- **One run, several answers:** `measure --set <file>:<CONST>=<value>` and as a `--variant` entry (its own patched
  worktree; two STATUS_WIDE_FRAMES values in one run), `measure --split hunks` (`split:<name>` markers), `node
  scripts/accuracy.ts --compare <ref> --regroup` (against 107766a it gives the status-pairing journal's scratch numbers:
  development plain 81.5 → 82.4% by the 9c6e mark alone, log-only 3.13 → 2.02%), the shares' groups in --compare.
- **Blind-safe hold-out traces:** the moved hold-outs' replay decisions by kind, net per direction, and per split part
  how many of the whole change's moved hold-outs it moves the same way.
- **Structured output:** `totals --all --json`'s `share`, `logged`, `fightError`, `stage`, `severalTargets`,
  `totals --skip`; `zmdlogs casts --json` (castsRecords), compared by field in `cli-ab --placement`.
- **Across logs:** `zmdlogs stack <owner:stack> [--at-cast]`, the bursts header's pairing rule and twin bursts,
  clocks' Stagger-break rows (cast clocks with a break inside run +186 ms at the median, 40 rows, against +10 ms in
  4,785 without: docs/open-problems.md's Yvonne paragraph); bash-guard refuses a stale `git commit -F` message.

**Checked:** `npm run snapshots:update` at the final code: "No log's verdicts moved", the snapshot files and
docs/accuracy.md byte for byte the same; `node scripts/cli-ab.ts 5cf680e --placement`: every log's placement the
same; no engine file touched (no team-ab); premerge at the final commit.

**Decisions:** no stable label per hold-out (replay-only report point 1): with `--with <operator>` choosing which
hold-outs a measure runs, a label that persists would tell which hold-outs have which operator; the per-part counts
answer "is it this part's hold-out" within one run. The casts' skill kind beside the hold-outs' decision counts isn't
printed either (a split per mechanism class, docs/design/tests.md's "never" list). The assumptions' evidence text
stays in the engine's source this round: comments alone don't cover it and a string-blind digest could miss a real
change (backlog point 2).

**Found on the way:** measure's splitLines named a hold-out moved by the whole change and by no part, and splitParts
counted every hold-out as moved (allLogs keys a hold-out under pending/; the code tested the key): fixed, with a test.

**Left:** docs/friction/2026-11-27-backlog-after-round-18.md: the per-layer clock (carried), an assumption's
evidence text out of the engine's source, `holds --steps`; the accuracy list gained a hold at a Stagger break.

## 2026-11-27: Status landings paired by value; two-target fights marked

**Goal:** the status landings' pairing (BuffReplay.statusLanding: a logged Arts Burst, Combustion tick or other
status hit took the nearest replay landing within 16 frames, in time order) as a value-based assignment, so a burst a
stop held 0.55–0.85 s late still pairs with its own landing (the log-only round's lead, c779's crossed pair); 9c6e's
two targets marked so they stop weighing on the development means; beside an agent on placement cases (its files
untouched here).

**Done:**
- **One assignment per operator, kind and element** (packages/logs/src/statuspairs.ts pairStatusLandings, engine
  assumption `status-pairing`, default `assignment`; `nearest` the old pairing): over stretches without a gap of more
  than 60 frames, the pairing with the most pairs (a Hungarian method, each logged hit with a "none" column), then the
  least frames apart, a landing whose value doesn't fit counting 60 frames more; a landing 16–60 frames away only
  where its value fits within 1% (statusValueFits: the landing's damage again from its inputs under the log's crit
  flag, times the fixture's stage factor, against the uncapped logged value). c779: logged 9.68 s now takes the
  replay's 9.27 s and 10.08 s the 10.03 s (was 9.68 → 10.03, both others one-sided). `zmdlogs bursts --all`: one-sided
  bursts 31 log-only / 40 replay-only → 19 / 28 at 30 frames, and four more pairs at 60 (c3c7 22.32, c83c 32.31, 79cc
  24.23, 3aa6 12.31 s: 1.5–2.1 s late, equal values).
- **9c6e marked `severalTargets`** (fixture field with its evidence, schema, LogFixture; snapshotentry.ts emits the
  describing key `several targets`; scripts/accuracy.ts withSeveralTargets puts such a pending log in a row of its
  own; measure.ts's overlay keeps the mark). The evidence (scripts/probes/targets/two-targets.ts): Typhoeus's Nature
  burst logged twice within a frame nine times (79.85 s: 143,320 and 33,858 at one ms, both capped from one uncapped
  412,733) and eight kills with hits going on to 95.6 s. No other development log has the shape: the slug's kills
  (6339, 7b54) are one enemy's lives and phases; b7b3 10.91, c4f3 7.05 and db87 14.01 s have one status twin each and
  no kill.
- tests/status-pairing.test.ts (the assignment on c779's shape and on the log, the value-gated window, the mark's
  group); docs/design/data.md, fixtures/multi-target/README.md, docs/tried/2026-11-27-status-value-fit-10.diff.

**Scoreboard** (`npm run snapshots:update`, against main at 107766a). The reclassification alone (main's snapshots
with 9c6e in its own row, scratch only): development plain 81.5 → 82.4%, mismatch 6.3 → 5.9%, mean |damage error|
3.4 → 2.9%, 32 → 31 fights; its log-only share 3.13 → 2.02%, replay-only 3.61 → 3.33% (not an accuracy gain). The
pairing on top: development plain 82.4 → 82.5%, replay-only 3.33 → 3.15%, log-only 2.02 → 1.84%, |matched| 2.28%
unchanged, one-sided fights 21; hold-out plain 82.6 → 82.7%, replay-only 2.9 → 2.7%, log-only 5.0 → 4.8%, |matched|
2.0% unchanged, one-sided 11 → 10; earlier pending plain 81.6 → 81.7%, 1.1 → 1.0% / 0.9 → 0.8%; verified plain 78.2 →
78.4% (40d9 +1). As the scoreboard has it: development 82.5%, 5.9%, 2.9%; the new row 1 fight, 48.1% plain, 20.6%.
Better: 489c, 79cc, 9c0b, af7b, c779, c83c, db87, f978, 0c14, 3aa6, 458b, 9555, d572, 40d9, four hold-outs; mixed:
7910, f879, c3c7 (plain +1 to +4, mismatch down, their totals 0.1–0.2 points further: a status hit now paired whose
landing's value differs slightly from the one-sided pair's), none worse. No simulation reads the pairing (log check
only): no team-ab.

**Decisions:** a field the scoreboard reads, not a move to fixtures/multi-target/: the check runs 9c6e usefully as one
target (200 plain, the kill gaps' tests), its snapshot stays pinned and no key or test path moves. The 60-frame window
over 30: measured with --patch, 7 logs and 2 hold-outs better, none worse. The value fit at 1%: the replay's value is
the replay's own, so a burst landed before a buff the game's had is off by that buff, and 10% was mixed (the ticks of
one Combustion share a value and traded places): docs/tried/2026-11-27-status-value-fit-10.diff.

**Left:** pairs whose replay value a buff's edge puts off (1d91 50.47 / 51.02 s ×1.095, 7b54 46.70 s, a7a7 39.27 s,
e989 86.65 s, 7910 28.27 s, abfd 100.93 s): the fit judged by the check's reading of the pair; 9c6e's second target
itself (the engine has one); the slug's unlogged hits (lead 3, not reached).

## 2026-11-27: Placement cases: entity landings by their span, presses in away stretches, used-up casts by value

**Goal:** the placement and cast-assembly cases the two one-sided rounds left (docs/open-problems.md "Log-only
landings", "Replay-only landings"): f879 95.10 s, 5082 45.06 s, 3aa6 125.65 s, Pogranichnik's harasses, 99fb's bleed
ticks, Arcane's INT lasers, 9a80 34.94 s; beside an agent on status pairing (buffreplay.ts theirs).

**Done** (docs/open-problems.md "The placement cases the one-sided rounds left"; tests/placement-cases.test.ts):
- **An ability entity's landings are due within the slots' span** (logcasts.ts onEntityClock): a key's next landing
  joined the open cast while it had slots to come within the skill's whole duration (9.4 s for Laevatain's battle
  skill). An entity's landings (`launch`; no flight, buff timeline, enemy delay or random count; not a buff's key) come
  at their own frames whatever the cast does. f879: the 94.71 s Magma Fragment explosion had been the 87.12 s cast's
  first tick (that cast's ticks unlogged; their radius, 2.5 against the explosion's 3, is one possible reason), so the 95.94 s empowered hit made a
  battle skill at 92.48 s, before her final strike's Heat absorption at 92.49 s; now one cast at 93.98 s with 4 Melting
  Flame, and the 162,889 lands. Also 6339 31.62 s, Zhuang Fangyi's attack 2 / 4 ranges in 3aa6 and 4bfc. Rossi's
  combo afterhits (a buff's timeline, 9a80 29.20 s) are left out: measured first without that, 9a80 lost 64 plain.
- **A slot press whose first landing is due in an away stretch is `unseen`** (castassembly.ts, awayWindows), **made as
  the button's variant the kit holds** (replayrun.ts replayedSkill): 3aa6 125.65 s, Zhuang Fangyi's Empyrean battle
  skill 0.08 s after the last hit before a 14 s gap; its Sunderblade is the 145.74 s cast's ninth, the 148.68 s final
  of 9 lands.
- **A second landing at a used-up cast's last ms isn't the same landing on a second enemy when both are non-crits in
  the ratio of slot 0's multiplier to its slot's** (logcasts.ts nextByValue): 9a80 34.94 s, Si's final (349,888) and
  her next combo's first slash (28,396); the 36.10 s final now on its slot. First by the values' ratio alone: 9c6e (two
  targets under one id, their values ×1.3+ apart by their own debuffs) lost 36 plain while its total went −20.6 →
  −0.9%, the second target's landings made as casts of their own: the wrong mechanism.
- A press made in an away stretch takes what a cast takes: 7b54's Si at 24.81 s (21.06–26.98 s without a hit, the
  slug) is made as Initial Stroke and takes the team's Link stack her 29.00 s cast had (7b54 +40.3 → +40.4%).

**Scoreboard** (`npm run snapshots:update` after merging main at 14d422c, the status-pairing round; `measure --base
14d422c` for this branch alone): development (31 fights, 9c6e now its own row) plain 82.5 → 82.7%, mismatch 5.9 →
5.8%, mean |damage error| 2.9%, as other kit hit 81 → 78, |matched| 2.3 → 2.2%, replay-only 3.1 → 2.8%, log-only 1.8 →
1.6%; earlier pending plain 81.7 → 81.8%, log-only 0.8 → 0.6%, as other kit hit 58 → 50; hold-out, verified and the
several-targets row unchanged. Better: f879 (plain 797 → 826, mismatch 12 → 3, per hit 1.85 → 0.61%; total +0.1 →
+1.6%: the missing 162,889 had cancelled over-predictions), 6339 (−14.1 → −12.6%), 9a80 (277 → 279), 3aa6 (415 →
418), 4bfc (856 → 861). Worse: 7b54 +40.3 → +40.4% (below). Log tools only: no simulation reads them, no team-ab.

**Decisions:** the entity rule as "no toCome" rather than a new bound: the slots' span plus CAST_SLACK_MS is the bound
the pass already has for every other landing. The away test beside the ±1 s quiet test, not instead of it.

**Dead ends:** the replay's JUMPDROP leaving out landings launched before the jump (engine drivers.ts; f879's ticks
dropped her empowered jump): no development log moved, one hold-out −23 plain, dropped
(docs/tried/2026-11-27-jump-launched-landings.diff). Yvonne's chain window held by the hidden holds: they sit spread
over 1.5 s mostly before her cast (3 of 15 frames), not built.

**Left:** 5082's Yvonne (her timeline held ~0.5 s at her combo's Stagger break, 44.43 s; a break dilation the data
names, enablePoiseBreakTimeDilation, with no length), Arcane's INT lasers (the log's batched ms), Pogranichnik's
harasses (the entity's own 0.4 s slow-downs and teleport, not modelled), 99fb's bleed after Rossi's ultimate (the
statuses' side).

## 2026-11-27: Replay-only landings: kill gaps, basic tails, tails kept by another cast's buff, finals by value

**Goal:** the replay-only side of the fight totals (docs/accuracy.md "Where the total's error lives": development 4.5%,
hold-outs 4.0% of a fight's logged total): landings the replay makes that the log never shows, sorted by kind, operator
and skill over every development and earlier-pending log, the recurring causes fixed by mechanisms from the data or
the logs. Known leads: 207f's Rossi attack-4 tail, d774's Zhuang Fangyi battle skill at 103.28 s, 4bfc.

**Done** (docs/open-problems.md "Replay-only landings"):
- **A logged kill's gap** (engine assumption `kill-gaps`, default `absent`; enginecheck.ts killGaps, replayrun.ts): a
  hit capped at the HP left before the fight's last hit is a kill (a life, a phase, one of several targets), and until
  the next logged hit the replay's enemy is away, 0.15 s inside both ends (KILL_EDGE_MS). 9c6e 63.34–67.64 s
  (Typhoeus's 160k burst), the slug's caps in 6339.
- **Basic attacks' tails cut** (`unlogged-tails` `cut-all`, the new default): 207f's Rossi attack 4 hit_ai (two of
  five logged, twice).
- **A tail is kept only by a buff run its own landings start** (tailCuts): d774's battle skill at 103.28 s had been
  kept by a gear set's team ATK from Arcane's ultimate hit 2 frames before a tail strike.
- **Si's combo final placed by value** (logcasts.ts nominalScales: the multipliers of a value expression over event
  counts 1–4): 6339's logged final at 11.31 s now on the final's slot.
- **Typhoeus's burst across stops the pass misplaced** (logcasts.ts joinDelayed, stackedHeldMs): fc63 43.58 / 87.81 s
  no longer open shots the log doesn't have (also the log-only round's fc63 87.87 s case).
- tests/replay-only.test.ts (five tests).

**Scoreboard** (`npm run snapshots:update` after merging main at 5637d06; `measure --base 5637d06` for this branch
alone): development plain 81.5% (unchanged), mismatch 6.3%, mean |damage error| 3.2 → 3.4%, replay-only 4.5 → 3.6%;
hold-out plain 82.6%, mismatch 5.5 → 5.4%, mean |damage error| 7.1 → 6.3%, replay-only 4.0 → 2.9%; earlier pending
plain 81.5 → 81.6%, 1.6 → 1.3%; verified unchanged but 4e5e −2.9 → −3.0%. Better: d774 (plain 392 → 409, +5.8 →
−0.6%), fc63 (513 → 523, 3.6 → 3.2%), 207f (+1.6 → +0.4%), 7b54, 012a, and 15 development logs closer in total. Worse:
9c6e (−13.9 → −20.6%, plain 202 → 200: its two capped kill bursts at 79.85 s, whose readings mean nothing, plain →
assumed) and 6339 (−8.0 → −14.1%, plain 112 → 114, per hit 30.4 → 21.5%): both under-predicted fights whose log-only
side (−38%, −26%) the removed landings had cancelled; 5082, db87, 9090, 4360, a9d7, 9847 by 0.1–0.5 points (unlogged
basic tails gone from under-predicted fights); 4a64 −2 plain (two logged attack-4 hits that had matched the cut tail's
landings 0.30 s later). No simulation reads any of it (log check only): no team-ab.

**Decisions:** the kill gap's 0.15 s edges because without them one hold-out lost 13 plain (logged landings a few
frames off the next logged ms) for a better total (`tight`, 5.4%); `cut-all` because a basic attack is cut by the same
unlogged inputs a skill is, and the measure (14 closer, 6 further, all six under-predicted) is the earlier one's with
the totals since read right. The final's value range kept though its total effect is negative in 6339 and one hold-out:
the per-hit error and the verdicts improve, the total had been right by a replay-only final cancelling a second copy.

**Dead ends:** a value of unknown crit fitting a slot up to ×3 above it (9a80's final at 36.10 s): +1 plain, one
hold-out's total 0.5 points of the mean worse, docs/tried/2026-11-27-unknown-crit-slots.diff; logged gaps of 2.5–6 s as
away (no rule from length alone: 21 of 119 have replay-only landings, mostly small).

**Left:** the slug's unlogged hits (6339's hit_2 at 21.60 s, 7b54's Laevatain combo and overlapping Si combos: a shield
no log lists), 9c6e's second target, 9a80's final; the log-only round's placement cases f879 95.10, 5082 45.06, 3aa6
125.65 s, Pogranichnik's harasses, 99fb's bleed ticks, Arcane's INT lasers (not reached).

## 2026-11-27: Log-only landings: Typhoeus's Signs, Zhuang Fangyi's Sunderblades

**Goal:** the log-only side of the fight totals (development 3.2% of a fight's logged total, hold-outs 5.1%): the
landings the log shows that the replay never makes, sorted by kind, operator and skill, fixed by mechanisms; beside
an agent on the replay-only side (placement and cast-assembly files theirs).

**Found** (docs/open-problems.md "Log-only landings"): two thirds of the development log-only mean is 9c6e (−37.8%,
two targets under one enemy id) and 6339 (−25.6%, the slug); the other 54 fights −1.0% each, spread. By cause: a
counted resource one short (fixed below); bursts and Combustion ticks 0.55–0.85 s later in the game than in the
replay, held there by a stop starting 0–300 ms after the replay's burst about half the time, both ways at the same
offsets (scripts/probes/bursts/burst-before-stop.ts: 13 held, 16 not, 11 unclear): the replay's precision, no rule;
placement and cast-assembly choices (fc63 87.87 s, f879 95.10 s, 5082 45.06 s, 9a80 34.94 s, 3aa6 125.65 s,
Pogranichnik's harasses, 99fb's bleed ticks); Arcane's INT lasers started from the logged combo event (8915, 00ae,
a7a7). The hold-outs' largest log-only kind is physical statuses the replay never deals (2.08%); every development
one but 5 of 335 has a landing, so it is not reachable from these logs.

**Done:**
- **Typhoeus's burst Signs by source** (kit assumption `typhoeus-sign-cooldown`, default `by-source`):
  passitive_enemy_listennaturalspellbrust makes arrow_energy_buffer_1 or _3 by a tag only her files use, two identical
  buffers each with its own 0.2 s adding cooldown. 1d91: Arcane's burst at 11.79 s and hers at 11.90 s both give a
  Sign, so her 28.68 s combo has the 8 it needs (7 under `shared`, the old kit), four Hunting Arrows, and the 4th shot
  at 39.72 s is a Power Shot with its 40.03 s burst, as logged. Every other Typhoeus log has 8 Signs at each combo under
  both readings, but dbae (7, its fight-start Signs), fc63 101.87 s (a burst placed 0.48 s early) and 9c6e.
- **Zhuang Fangyi's 3 s Sunderblade floor** (trigger bs_floor; engine `extendBuff` `atLeast`): both battle skills'
  frames 0–3 set every Sunderblade with less than 3 s left to 3 s (SetAbilityEntityDuration, batch-4 G6). d774 68.21 s:
  the 29.57 s blade, 1.15 s left at the 64.72 s cast, strikes in the next one: 7 strikes and the 97,192 final, exact.
- tests/kit-zhuangfy.test.ts, tests/buffreplay-typhoeus.test.ts; tests/logcasts.test.ts's d774 bound under `away`
  8 → 9% (the three hits now landed).

**Scoreboard** (`npm run snapshots:update`): development plain 81.4 → 81.5%, mismatch 6.3%, mean |damage error| 3.1 →
3.2%, one-sided fights 25 → 24, log-only 3.2%; earlier pending plain 81.4 → 81.5%, mismatch 7.6 → 7.5%, 1.6%, within 5%
22 → 21; verified and hold-out unchanged. Mixed: 1d91 (plain 352 → 354, mismatch 194 → 193, per hit 3.97 → 3.86%,
total +0.3 → +2.6%) and d774 (388 → 392, 13 → 10, per hit 2.98 → 2.78%, +4.9 → +5.8%): in both the log-only hits had
cancelled over-predictions elsewhere (d774's 103.28 s Empyrean cast, open). Typhoeus's row: median |damage error|
1.4 → 0.8%; Zhuang Fangyi's plain 86.7 → 87.0%, mismatch 3.7 → 3.4%.
team-ab against 896bb86: Estella, Si, Akekuri, Arcane unchanged (both energies); Typhoeus's team sustained full −0.38%,
zero +0.44% (within one sd), its zero bot −4.0%.
**The bot's −4.0% is the Sign reading's, and a correct consequence** (`efsim rules … --seeds 1 --assume
typhoeus-sign-cooldown=shared` gives the base's 58,952 exactly; no Zhuang Fangyi in the team, so not the floor): the bot
(reaction 0) is one deterministic 300 s run. Its presses are identical to 137.17 s; there Arcane's Nature burst at
136.43 s and Typhoeus's at 136.57 s both give a Sign, her 8th one shot sooner, so her combo window opens and rule 3
casts the combo at 137.17 s instead of after her 3rd shot at 137.43 s (one shot fewer, Perlica's ultimate 0.26 s
sooner). The run then drifts: damage is the same to 120 s, −3.7% in 120–180 s, unchanged 180–240 s, −14% in 240–300 s,
where Liino's ultimate at 276.97 s no longer comes before the fight's end (Liino −21%, Typhoeus −3.6%). The same pair
at 75.87 / 76.00 s changes nothing (her Signs were already at 8). The bot choosing differently there is the mechanism
(the rule list casts the combo as soon as it opens); the −4% is one path's fight-end luck, not the reading's value: the
32-seed means move +0.44 / −0.38%, within one sd (scratch/bot.ts, not kept: a single-run trace).

**Decisions:** `by-source` the default: the one log that decides between the readings decides for it, and nothing in
the data says the tag is the enemy's. The floor as a kit trigger on the cast at frame 0, the data's own clip.

**Left / not done:** the status landings' pairing (nearest in time order, 16 frames) as an assignment by value
(buffreplay.ts, neither agent's file this round); Arcane's INT lasers' start; the placement cases above (the other
agent's).

## 2026-11-27: Improvement round 17: numbers that move, questions across logs, one cause per line

**Goal:** improvement round 17 over the five open friction reports (Arcane's stage factors, round 16's own, away
statuses, exposed totals, Zhuang Fangyi and Liino) and round 16's backlog; every file the round's
(docs/friction-done/2026-11-27-round-17.md has the details).

**Done:**
- **Numbers that move:** two describing snapshot keys, `other-hit operator <id>` (hits matched only as their event's
  other kit hit: the class that hid Zhuang Fangyi's attack 4) and `stage` (enginecheck.ts stageFight); the
  scoreboard's by-operator table names each operator ("chr_0032_lizhiyan (Arcane)"), with "As other kit hit" (per
  group too: development 100, hold-outs 19) and "Without stage fights"; `zmdlogs groups` prints the count and casts
  first, and mismatches inside a fight-wide factor stretch apart.
- **Across logs:** `node scripts/cli-ab.ts <ref> --placement` (every log's CAST/HIT lines that differ, by rule and
  operator, 12 s); `efsim zmdlogs away` (31 stretches: 2 pause, 11 runs on, 4 mixed, 14 no clock); BATCH in `zmdlogs
  decisions` (20 in 10 logs); `zmdlogs offsets --all` ends with the factor stretches no fixture holds (14 in 8 logs).
- **One cause, one line:** `totals`' total ÷ Max HP and kill kind; `hits --against-hit`; stageNote in `replay` and
  `bursts`; the CAST line's `[paths: …]`; holds' WIDE units; `--kit-buff` by an owner's name; kit-census's dead kit
  buffs; groups' log-only buffs.
- **Paperwork and helpers:** `friction.ts carry --lists [--park] [--drop]` (this backlog made with it), "done but
  <part>" outcomes, tests/helpers/replay.ts fakeReplay, packages/logs/src/labels.ts; tests/logcasts.test.ts split (56 s
  → 29 + 33 s).

**Checks:** `npm run snapshots:update`: "No log's verdicts moved", "keys added only in 45 log(s) … other-hit operator
<id> ×58, stage ×8"; docs/accuracy.md's old columns identical row by row. team-ab against 44a72be (an engine reading's
description changed): unchanged.

**Decisions:** the names come from the game data's cache (the snapshots stay the scoreboard's only numbers);
`isDescribingKey` holds every kind that isn't a verdict, and a hold-out's moved key is printed by kind (a lone `share
operator` key named its id before). The away probe is deleted, the view cited in its place; the stage probe stays
(the docs cite its numbers). The verdict of an away stretch is "pause" when most clocks ask half its length, "runs on"
when every one asks under a quarter.

**Left** (docs/friction/2026-11-27-backlog-after-round-17.md): a layered buff's per-layer clock; the recorded Stagger
start parked; on the accuracy list the element mask of log-only buffs and the 14 factor stretches (7b54's slug first).
CLAUDE.md lines for the lead in the round's summary.

## 2026-11-27: Exposed totals: stage Electrification, kills, Rossi's combo 3

**Goal:** the fight totals that rose once the attack-4 round read hits right (207f +5.5%, 3aa6, d774, 9847, a9d7),
split by operator and landing kind and fixed by mechanisms; 3f78's Rossi combo 3 at 50.55 s, made inside combo 2's
uncuttable frames (docs/journal/2026-11-27-01-zhuang-fangyi-s-attack-4-and-liino-s-silent-stance-ends.md).

**Done:**
- **Hard 27's stage Electrification is Arts DMG Taken only** (enginecheck.ts logOnly, stageElements): the log lists it
  without an element and the check added it to every hit; buff_common_pulse_pulse_conduct_triggered_do reaches
  CheckDamageTypeMask 92 (Arts), physical only with `if_contain_physicdamage` = 1, which nothing in the data sets. 207f's
  physical hits 21–36 s (Rossi's attacks, combos, bleeds, Gilberta's set) read ×0.847 = 1.33 ÷ 1.57 with it, plain now.
- **A kill from a stage-scaled total** (enginecheck.ts stageScaledKill): 207f's logged total is 5.7600 × the data's Max
  HP, its last hit without an `uncapped` value; every capped single-life kill in the development logs sits within 1.3e-5
  of a two-decimal multiple (scripts/probes/totals/stage-kills.ts), 5082 (×7.6000) is the other uncapped one. The totals cap
  the killing hits (Rossi's ultimate final: 1,134,403, predicted 1,218,124), loggedEnemyHp reads the HP, and the check
  leaves a killing hit unjudged where it reads above its value (logcheck.ts killingBlows `capOnly`).
- **Rossi's combo 3 on its jumped path** (logcasts.ts jumpedFirst): placed by its perfect hit (frame 29) it started at
  49.59 s, 13 frames before combo 2's window (frame 37); its late hit (227, 15 after the jump 0 → 212) puts it at
  50.05 s, where the perfect-timing ring (combo 2's frame 52) isn't on yet, so the kit's own condition jumps. No INSIDE,
  no JUMPDROP, no extra Vulnerable: Gilberta's 58.90 s ultimate Susceptibility 0.39, the log's. The rule takes the
  twin's slot only where the skipped path's start is before the operator's previous cast lets the skill start.
- tests/logcasts.test.ts (three tests).

**Scoreboard** (`npm run snapshots:update` after merging main at 0b68614, the away stretches; `measure --base 0b68614`
for this branch alone): development plain 81.0 → 81.4%, mismatch 6.4 → 6.3%, mean |damage error| 3.3 → 3.1%, within 5%
27 → 28; hold-out unchanged (82.6%, 5.5%, 7.1%); earlier pending unchanged (81.4%, 7.6%, 1.6%;
abfd mismatch 2 → 1). Better: 207f (plain 269 → 308, mismatch 16 → 3, +5.5 → +1.6%), 3f78 (plain 114 → 151, 0.9 →
0.2%); 5082 adds a time to kill. No log worse. Rossi's row: plain 74.2 → 76.6%, mismatch 5.1 → 4.6%, mean |damage
error| 1.8 → 1.3%. No engine or kit rule changed (log tools only): no team-ab.

**Decisions:** the stage kill by the total, not a list of stage factors: the factors differ per stage and per version
(hdg027 ×5.28 in 2fd9 / 99fb, ×5.76 in 207f), the grid is what they share. The combo-3 rule asks the kit's windows,
not the Stagger: every logged combo-3 hit has Stagger 5 (poise_f), perfect ones too.

**Dead ends:** the Stagger value as the path's evidence (above); d774's +4.9% (Zhuang Fangyi's first Empyrean battle
skill at 103.28 s: 3 strikes, no final, in the log; neither blades, an attack's cut nor half a life's HP explain it:
docs/open-problems.md "The totals that rose once hits read right").

**Left:** d774 103.28 s; 3f78's team-wide ×1.017 after 50.55 s (Corrosion's ramp late in the replay: the enemy's
clock); a9d7's Chen −3.0% (spread, Pogranichnik's team buffs on her combo); 207f's Rossi attack 4 hit_ai tail (+1.3%).
