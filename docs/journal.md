# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 180 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-27: Several targets read per target

**Goal:** the scoreboard's worst row, the three fights against several targets under one id (6339, 7b54: Hard 33's
eight slugs; 9c6e: Hard 31's two Wanderers), on main at 0366a35 beside an agent on casts across a Stagger break: the
per-target state the log check needs, built for the replay, and what stays one-sided.

**Done:**
- **Design** (docs/design/data.md "Several targets"): the simulation keeps one enemy; the check holds the targets. A
  probe first (scratch, not kept): of 7b54's 204 hits with a landing, 65 fit their primary reading and 115 fit with
  some of its enemy-side units left out, and the trial assignment's targets held their states over later hits
  (Camille's 26.98–29.36 s hits all without Jade Vessel).
- **packages/logs targets.ts** `assignTargets`, read through enginecheck.ts `fightTargets` (engine assumption
  `several-targets`, default `targets`): each logged hit on a target (two hits one landing stands for at one ms on
  two; else the alive target its value fits, the one hit last first, a new one only when none fits; a capped hit kills
  its own); each target's units (enemy kit buffs, Corrosion / Electrification / Breach) as the replay's instances: one
  it got kept to its expiry, one it was read without never later, an open one decided by the first hit that only one
  choice fits. `readingBasis` drops the units a hit's target lacks; `killPurges` none (a kill ends its own target's:
  buffreplay.ts's one line, committed alone); the replay's enemy stays through a kill gap with targets left
  (fixture fields `severalTargets.atOnce`, `fromStart`; schema), whose landings the totals leave out; the totals count
  a landing once more for each twin on another target whose value fits it.
- tests/several-targets.test.ts; tests/slug-targets.test.ts under `one`; the evidence in docs/design/assumptions.md.

**Scoreboard** (`npm run snapshots:update`): the several-targets row plain 54.1 → 68.5%, mismatch 27.6 → 15.4%, mean
|damage error| 20.0 → 16.1%; 6339 better (plain 108 → 115, −19.7 → −10.3%), 9c6e better (244 → 314, mismatch 94 →
33, −24.5 → −11.3%), 7b54 mixed (65 → 99, mismatch 116 → 83, +15.7 → +26.8%: its replay-only landings read with the
one enemy's debuffs, which no kill purges now). Development, earlier pending, verified and hold-outs unchanged (no
other log is marked); no simulation reads it: no team-ab.

**Decisions:** the values decide a hit's target, as they decide a crit the log leaves out: the log has no target per
hit and lists every target's debuffs under the one id; the persistence (an instance kept, one missed never had
later) is what makes it evidence rather than a fit per hit. The totals' copies are gated on the twin's fit: ungated
the row's mean was 26.3% (7b54 +61.3%: Si's combo finals the placement paired with slashes, once per slug), as one
target 20.9%. Kill gaps kept: 6339 gets Camille's Vesperwings at 14.09 s as the log lists, and her weapon's Heat DMG,
which it doesn't (a shielded slug takes no infliction): measured `targets-gaps-away` (one plain, 2.3 points of total
the other way), kept for the log's listing.

**Left** (docs/open-problems.md "Hard 33's Woodcraft Slugs"): the placement's twins (7b54's Si combos: logcasts.ts,
the other agent's; friction report point 1), statuses' levels, bursts and Stagger per target (9c6e's second
Wanderer's bursts), a shielded slug's landing (0 damage, no infliction, buffs applied), Camille's uncovered battle
skill hits in 6339.

## 2026-11-27: Friction round 19: one reader of a reading, the follow-ups view, an enemy's stage text

Goal: improvement round 19 over five reports and round 18's backlog (summary:
docs/friction-done/2026-11-27-round-19.md; what's left: docs/friction/2026-11-27-backlog-after-round-19.md).

Done: the engine's assumption registry moved out of timeline/ (packages/engine/src/assumptions.ts, the log replay's
own readings in replay-assumptions.ts), one sentence per reading with the evidence in docs/design/assumptions.md
(outside the game-data cache's key); every reader through `readingOf` with the run's readings, holds.ts tickBounds
among them (it took break-hold's and break-hold-place's defaults under a variant); a trace test that fails a reader
handed no readings. `zmdlogs followups` (a trigger's landings against the events that fired them, from a replay-only
record `LandedHit.fired`), `replay --against-lanes` with each pair's ends, `holds --steps`, `[pinned]` LAND lines,
`gamedata enemy` (Hard 33's "They are legion" in one command) and an ability entity's tree, `instancesWhy`,
`stateAt` / `optionsAt`, the hold-outs' key test in one helper with a blindness test over every printer of
accuracy.ts and measure.ts, friction.ts by a backlog's label, lead-files `--split`.

Decisions: the replay-only readings stay registered in the engine (its context checks every `--assume` id) but in a
file of their own; the evidence went to a Markdown doc the CLI parses rather than JSON, so it reads as a doc. The
readers' run check gives every assumption explicitly at its default, so the run is the default one and every default
path is traced. The recorded Stagger start (a new report brought round 16's parked point back) moves the holds: the
accuracy list, not this round.

Checks: `npm run snapshots:update`: no log's verdicts moved, nothing changed; team-ab identical at both engine
changes (the move, and the replay-only firing record).

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

## 2026-11-27: Camille's Vesperwings at an away stretch, Pogranichnik's harasses

**Goal:** two leads from docs/open-problems.md: e989's Camille Firefang Weakness (fire Susceptibility 0.12) the replay
kept on 69.19–89.32 s, and Pogranichnik's harasses 0.2–2 s off in his five logs.

**Camille.** The debuff is a child of the hovering Vesperwings entity (autoFinishByAction); the entity checks its
target every 0.5 s (buff_chr_0033_camille_normal_skill_bat_checktarget: FindTargetAction, CheckEntityNum,
FinishOwnerAction unless retargeting) and finishes without one. Every other Camille run ends at a refresh, a kill or
the fight's end; only e989 has an away stretch, and it lists the debuff to 19.67 s (the first stretch's start: no purge
is read there, the stretch being longer than PURGE_GAP_MS) and to 69.19 s, 1.74 s before the stretch 70.93–84.83 s, at
a check's boundary (61.69 s + 15 × 0.5 s). Si's boss leaves as the damage reaches about 50% and 85% of twice its Max HP
(scripts/probes/entities/jsspsi-phases.ts), the second time 0.2–3.6 s after the share is dealt, still hit meanwhile.
Built: KitBuff.targetCheck (`every`, `assumption`), read only by the log check's replay (buffreplay.ts targetLosses,
lostTargets, composed into `held` after the purges), behind Camille's kit assumption `vesperwings-target-loss`:
`kept` (as before), `away` (the first check after the stretch's last logged hit), `listed` (the check at the debuff's
last listing within TARGET_LOSS_LEAD_MS, 4 s, before the stretch; default). Measured: `listed` e989 plain 260 → 267,
|damage error| 0.5 → 0.1%, its 86.65 s Heat burst paired; `away` mixed (264, 0.8%); one hold-out better under both
(mean |damage error| 6.4 → 5.8%). Why a kit assumption: the engine registry is in timeline/, the parallel agent's
folder (friction report point 2).

**Pogranichnik.** The harass entity slows itself at each path's frames 0–3 (TimeDilationAction layer 1, 0.4 s, an
inline curve 0.30 → 0.043 → 1: mean scale 0.23, scripts/probes/entities/harass-slowdown.ts), so its frame-9 hit comes
9.24 frames late; as an entity's timeline it is on the world's clock, which his own combo's slow-down holds (d4fb's
Breach at 86.67 s, its harass at 87.97 s across his combo from 87.20 s). Kit: frames [18], `world`. Over his five logs
(scripts/probes/entities/harass-deltas.ts) median |Δ| 299 → 88 ms, one-sided 37 → 21; frame 17 measured worse (119 ms);
the teleport takes no time (ruled out). d4fb's 87.97 / 88.55 s harasses now pair right. The Decisive Assault stays at
frame 25: every logged one comes 0.21–0.44 s after its event, which nothing in the data gives (frame 8 fits all but
two; not built: open-problems "The placement cases the one-sided rounds left").

**Numbers** (snapshots:update, docs/accuracy.md): development plain 84.2 → 84.3%, |damage error| 1.3%; hold-out plain
82.5%, mismatch 5.3 → 5.1%, mean |damage error| 6.4 → 5.8%; earlier pending plain 82.2 → 82.3%. Better: e989, c4f3,
7e19, d4fb, de6a and one hold-out; mixed: a9d7 (plain 332 → 336, damage −1.7 → −1.8%, per-hit error closer); worse:
none. Team fights unchanged (team-ab identity at e2e6f3f: no team example has either operator); the
pogranichnik-chen example snapshot moves with the harass frames.

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
