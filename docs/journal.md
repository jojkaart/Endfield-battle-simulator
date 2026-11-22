# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 111 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-22: The rule search decides: an objective across starts, rule sets, setups

**Goal:** the owner: "The whole point of this simulator is to discover [the rules] for each team." Three rule
questions had been left as the owner's call because the guided search had no objective across the fight's two starts
(full energy, the zero-energy companion). Later the same day, also from the owner: conditionally active rule sets, so a
team with Arcane and a non-Nature inflicter can play a Corrosion setup phase.

**Done** (docs/design/rules.md "The objective across starts", "Rule sets", "The search decides"):
- **The objective:** every list played on both starts on the same seeds, each seed scored by the two starts' mean
  sustained DPS (`startsObjective`); the guided search's default (`--objective mean`; `first` the old veto), per-start
  gains in its report, `efsim rules --compare` the same. Chosen over one long fight from zero because both starts
  happen in play and a fight from zero never returns to four full bars.
- **Cues:** `ultimates` (how many ready at once, rank 4), `energy` (an ultimate's gauge, rank 5), `statusLevel` (a
  status at a level, rank 3: Corrosion at full strength is level 4). In guideCues, the rule search's pool and its
  threshold moves.
- **Rule sets:** `sets: [{ name, when }]` and a rule's `set`; one ordered list, a set rule read only while its
  condition holds (`effectiveRules`); the condition counts once in the learnability; flat lists unchanged.
- **Search moves:** reaction setup sets (`reactionSetupEdits`: the applier at 4 stacks of another element, else the
  inflicter, from spare SP or not, with the list's own guards), rules moved between sets (`setMoveEdits`), an edit
  split by a start cue into two sets (`splitEdit`, after a round that keeps nothing or a kept edit that disagrees
  between the starts), the rule search's `editSets`.
- **Searches** (with-lock, 15–49 min each): the owner's team kept a Corrosion setup set: +1.06% ± 0.33 on 64 fresh
  seeds with Akekuri's ultimate guard (+1.71% as found; Arcane's press alone +0.94%). Ink Melt: Laevatain's ultimate
  waits for Corrosion, Si's for Combustion and Twilight: +3.21% ± 0.73 (64). Typhoeus's: ultimates wait for the hover,
  Arcane's battle skill while the Stagger bar is below half: +8.62% ± 0.65 (32). Questions: Estella on Stagger no; Ink
  Melt's rule 7 `shows` no (a loss from both starts now); the Twilight hold kept (dropping it −2.3%). Arcane INT
  (Hot Work), each mode with its own searched list: −1.91% ± 0.60 (64): not worth farming. Examples changed; an INT variant in examples/variants/.

**Problems:** the 2026-11-16 numbers behind the questions had all moved (the engine changes since): measured per start
before designing anything. The owner's setup as found pressed Akekuri's battle skill inside her ultimate; the rules
check in the test suite caught it, the setup move now copies the list's guards. The first INT search hit the 2 h
background limit (queue wait included): rerun with 4 rounds from the new WILL list. `npx prettier` reformatted a file
(no config in the repository): rebuilt from `git show HEAD`. Friction: docs/friction/2026-11-22-rule-objective.md.

## 2026-11-22: Perlica's combo hits: Pulser Labs and Wild Wanderer before the hit's damage

**Goal:** Perlica's combo hits ×1.15–1.40 above the engine (fc63, 3aa6, 4d60, 4360, 9847), her −9.6% in 9090's
totals although every hit matched, and fc63's ×0.934 ATK (docs/open-problems.md, "Typhoeus, Arcane, Liino, Perlica").

**Found:** one cause for the first two. Where her combo hit had no other DMG bonus it was ×1.500 of the engine in every
Pulser Labs log (4360, 9090, 9847; fc63 ×1.401 = 1.5 × its ATK offset), elsewhere 1 + 0.5 over the hit's DMG sum; in the
Wild Wanderer logs (3aa6, d774) 1 + 0.192 / 0.224, the weapon's dmg_up at her skill-3 levels. Both triggers (Pulser Labs
abilityEvent 102, Wild Wanderer 206, the Electrification tag) ran after the applying hit's damage while P3's, on the same
event and tag, ran before it; her combo makes its forced Electrification before its DamageAction. Both are now
`beforeDamage`; 46 of her 59 combo hits are exactly the primary reading (14 before). 9090's −9.6% was those 7 combo hits,
matched only by the log-listing fallback: no hit is missing (130 of 130 landed; per skill attack1 20, attack2 34, attack3
51, attack4 16, combo 7, ultimate 2), Perlica −9.4 → −2.7%, the rest crit luck. ZMDLogs lists none of the three buffs on
the hit that creates them (a new "Common misreadings" line in docs/design/data.md).

**Follow-on:** e82d's Electrification reaction hit (the only one in the development logs) took the +0.5 too (Perlica
+14.8 → +64%); it fits P3's ATK without Pulser Labs' DMG and without its own Electrification. So a reaction's own hit
takes its triggers' ATK but not their DMG bonuses for Electrification as for Combustion (landing.ts `reactionHitSide`,
was `combustionHitSide`), and OWN_HIT_SEES has Electrification seeing the one before it (ASSUMED, one hit;
combat-mechanics §3.2, §3.8): e82d Perlica −3.4%. **fc63:** `zmdlogs fit-build` fits attribute nodes 2 (nodes 5 and 7
need favorability 300) with Stanza at level 86 (57 of 81 hits, 20 of 21 clean; 1 node at 89 is within 0.1%): kept as
the fixture's `buildOverrides`, the pair a fit, not a reading.

**Scoreboard (docs/accuracy.md):** development plain 52.0 → 52.5%, mismatch 18.2 → 17.9%, mean |damage error| 12.6%
unchanged; hold-out plain 67.3 → 67.4%, mismatch 6.7%, error 12.1 → 12.0% (2 better, 0 worse); earlier pending 48.9 →
49.0%, error 8.3 → 8.4%. Logs better: 4d60, 9090, fc63, 3aa6; mixed 4360, 9847, c6d8, d774 (each closer per hit;
4360's and c6d8's fights were already over-predicted by others), worse e82d (fight −8.5 → −8.8%: its reaction hit was
over-predicted, now right, the fight's shortfall is elsewhere). Perlica's row: plain 58.8 → 66.7%, mismatch 24.1 →
18.8%, mean |damage error| 18.5 → 19.2% (c6d8 +137.8 → +163.7%, a team-wide ×0.1 log; fc63 −0.5 → −6.1%, where the
ATK offset had hidden the missing combo bonus, now both right, the rest an unflagged ultimate crit and Stagger runs).

**Team (team-ab, seeds 1001–1032):** Typhoeus's team sustained DPS 52,949 → 53,173 (+0.42%) at full energy, 50,194
→ 50,417 (+0.44%) from zero; the 60 s timelines +0.30% / +0.29% (docs/teams/typhoeus-arcane-liino-perlica.md); Estella's
team unchanged.

**Dead ends:** none kept. Left: 4d60's combos ×1.08 (Liino's stance ATK listed, not replayed), a reaction
Electrification with Wild Wanderer (in-game test 68's open half), the Electrification reaction rule rests on one hit.

## 2026-11-22: Liino's Cosmovoice beats on their own clock; stances cast before the log

**Goal:** Liino on Typhoeus's team: her Cosmovoice beats logged 1.35–1.55 s apart against the kit's 1.5 s; her
stances cast before a log began (1d91, 7910, 4d60), whose first volley never landed; the volleys with a battle-skill
event at their first hit's ms.

**The beats' clock.** The data's beats are a buff's ticks (ultskill_music_damage, every ultmusic_trigger 1.5 s,
first at once, 15 s), the finale the ultimate's frame 508. In the logs the song's clock differs per log (4d60 a steady
1.36 s in both its Cosmovoices, c6d8 1.52 s, the volley timer likewise: 4d60 9.0–9.4 s) while the same logs keep the
ultimate's projectiles to ±15 ms of their frames, and the finale comes 14.3–14.75 s of world time after the first
beat (the kit 14.37 s): the song runs on a clock of its own, the finale on the ultimate's. So the kit's beats are now
kit buff cosmovoice_song's ticks (`noTickAtEnd`: ten, never eleven; its first beat the ultimate's own at frame 77 so
the placement still times the ultimate by it), `ticksShownByHits`: the replay takes each beat from its logged hit and
moves the song's end with them. The finale is the ultimate's own hit, pinned to its logged landing; End Stance skips
it through a marker (a launch frame would have held her combo beside the ultimate until 508). The placement gives a
trigger on casts one cast per anchor (every later beat had been an `ult_song` of its own). An ultimate logged at the
very end of another's stop that covers it was pressed inside it (4d60's Zhuang Fangyi at 157.42 s: her Empyrean
attacks from 158.38 s and Liino's beats at 158.66 s rule out a 2.6 s stop from the event).

**Stances before the log.** `castsBeforeLog` infers a cast before the log where the stance's buff is listed from
before it (4d60 since −811 ms, 7910 −576, a7a7 −1776, af7b −1444) or the first shown volley comes before any cast
could have opened it (1d91); `withCastBeforeLog` runs it on a timeline of its own and moves what it left onto the
replay's start, without its hits or the volley it launched before the fight. The 37 (now 30 of 104) events at a
volley's first hit are beats: each comes 2.5–6 s after her last event, the next 3 s on, and 10 of 25 carry a heal at
that ms like plain beats; reading them as no beat moved only 1d91 (+3 plain).

**Scoreboard** (docs/accuracy.md): development plain 52.0 → 56.1%, mismatch 18.2 → 17.4%, mean |damage error| 12.6 →
12.4%; hold-out plain 67.3 → 67.4%, mismatch 6.7 → 6.7%, error 12.1 → 12.1%; development logs 7 better, 0 worse, 3
mixed (4d60 plain 386 → 677, af7b 105 → 414, 1d91 280 → 328). Liino's error: 1d91 +14.8 → +11.6%, 7910 −7.9 →
−7.1%, a7a7 +7.5 → +0.2%. Simulations: the song, a buff, is held by Liino's own combo's slow-down where the ultimate's
frames weren't (liino-laevatain −0.05%; d774's beats agree).

**Dead ends:** adopting each log's shown interval as the clock for the next unshown tick (af7b's Liino +10.5 →
+2.9%, 9847's +10.2 → +15.6%, Liino logs' mean error 10.44 → 10.41): not kept. A `launch` on the finale: the
engine waits for a cast's own launches before any other cast of its operator, her combo beside the ultimate too.

**Left** (open-problems.md, "Liino's Cosmovoice beats"): the replay's stops around some beats (Perlica's ultimate in
4d60 at 92.8 s); Cosmovoice ending before its logged finale in the replay (9090, 8915, 4bfc: the finale ×0.64–0.70);
a pinned beat ordered after another's hit at its frame (9847 60.77 s); beats never logged (an enemy out of reach).

## 2026-11-18: The Finisher gated on every enhanced basic attack (test 108, the Talos Wiki)

**Goal:** the owner pointed to the Talos Wiki's "Stagger" article: the Finisher is the first basic attack on a
Staggered enemy "that aren't under any active enhancement effects (such as Laevatain's Twilight)", and a Staggered
enemy takes no more Stagger. The engine blocked the Finisher only in Laevatain's Twilight (her kit's `available`).
Generalise it with the game's own rule, check it against the logs.

**The game's mechanism (data):** nothing in SkillData or BuffData checks the Finisher. It sits in each operator's
NormalAttack skill group (CharGrowthTable type 0); the enhanced chains are basic attacks (skillSpecification 1) in
the battle skill's or ultimate's group, switched in by a buff's SwitchModeAction (`efsim gamedata find
SwitchModeAction`: modeId `ult` Laevatain, Yvonne; `UltMode` Zhuang Fangyi; `floating` Typhoeus) or ComboCacheAction
(Yvonne's ultimate end). Four kits have such attacks: Laevatain (Twilight), Yvonne (her ultimate), Zhuang Fangyi
(Empyrean), Typhoeus (hovering). None for Chen, Liino or Arcane (the brief's guesses); Wulfgard's, Gilberta's and the
Endministrator's mode buffs are created by nothing; Yvonne's barrage maps to `attack5`, a NormalAttack skill.

**The logs** (`efsim zmdlogs stagger`, which now prints each run's Finisher and enhanced basic hits; listing only):
23 Staggers with enhanced hits, none with a Finisher while the enhanced chain runs (Laevatain 11, 7 without a
Finisher; Typhoeus 7; Zhuang Fangyi 3; Yvonne 2); a Finisher and an enhanced hit of the same operator are never within
0.45 s (`zmdlogs census --select event:power_attack --near …`, test 108's section).

**Done:** timing.ts `enhancedBasic` (the attack input is a basic attack of another skill group whose kit condition
holds, or a buff maps the input to one) gates the Finisher in `gatesFrom`; Laevatain's kit gate removed; Zhuang
Fangyi's interim U6 ("castable in the Empyrean") reversed. "No Stagger while Staggered" was already the engine's
(resources.ts `dealPoise`, the 2 s recovery included). tests/finisher-gate.test.ts.

**Numbers:** scoreboard unchanged (`npm run measure`: no log's verdicts moved; the replay places the logged casts and
none of the 14 logged Finishers of these four falls in the replay's state). Teams (`node scripts/team-ab.ts --base 470dbf0`, 32 fresh seeds): the owner's and Ink Melt identical; Typhoeus's
52,261 → 52,949 (+1.3%) full energy, 49,309 → 50,194 (+1.8%) from zero (no Finisher mid-hover; bot unchanged).

**Decisions:** the rule reads CharGrowthTable's groups, not a list of buffs, so a new operator's state chain is gated
when its kit models it; a group-foreign basic attack without a kit condition doesn't count (it would block every
Finisher; tests check there is none). The gate refuses the Finisher rather than waiting for the state's end (as the
Stagger check does).

**Left:** Yvonne's barrage during a Stagger (no log), the dive part of test 108; Zhuang Fangyi's
`attack1_ult_2_abilityrange` key, which no kit hit names (32 hit groups, open-problems.md "Smaller").

## 2026-11-18: Improvement round 4: a query layer over the logs

**Goal:** the fourth friction round (docs/friction/README.md): twelve open reports (round 3's own, three re-triages,
seven test-deciding and diagnosis rounds) and round 3's backlog, ranked by what they cost accuracy work (diagnosing
log mismatches, deciding in-game tests from the logs), behaviour-preserving. Summary:
docs/friction-done/2026-11-18-round-4.md.

**Done** (a commit each):
- A query layer over the log itself (packages/logs/src/query.ts): `efsim zmdlogs instances` (each real cast:
  `loggedSkillInstances`, combos from hits, an ultimate's repeated events folded in, hitless events apart, Arcane's
  Imprisonment end marked), `census --select cast:|event:|buff:<re> [--near …]` (its output records the selection and
  a rerun line), `buffs` (listed id → kit buff), `lanes`, `control`, `cadence`; `devFixtures()`; `zmdlogs list --ids`.
- Every command takes a log's id (`0c14`) or path and operators by name; `zmdlogs hits` needs fixtures or `--all`,
  has `--event`, `--fixtures-from`, a per-fixture cache keyed by the code (12 s → 0.6 s on a second run) and the log's
  own reading per hit (`logReading`, `--reading log`: off under both readings is the build or a kit value).
- The replay flags casts made against the kit (FORCED: unavailable; INSIDE: before the running action lets it) and
  traces a kit buff's expiry step by step (`zmdlogs replay --trace-buff`). `efsim kit <operator>` prints the compiled
  kit with each hit's frames.
- Test lock: a short lane (measure beside long rule searches, never beside premerge or test suites), estimated waits,
  stderr heartbeats, `EFSIM-DONE <job> killed`, with-lock `--name`. The hold-outs' verdicts in their own snapshot file.
- `efsim repair` (gear.ts repairRotation exported), `npm run smoke` (90 s: what timing changes broke far away),
  `scripts/team-ab.ts` (an identity check of the team pages' fights before the 32-seed runs), measure's mixed logs with
  their mean per-hit error, `snapshotEntry` shared by the log suites and measure, each CLI command checking its own
  option values.
- Docs: data.md "Common misreadings", "Questions and the command that answers them", "A claim from the logs cites
  its selection"; data/README "Adding a table"; CLAUDE.md (smoke, team-ab, repair, the CLI in a worktree, batch
  edits, waiting for the job's own name).

**Decisions:** event repeats are folded into a cast only for ultimates (folding by skill duration also swallowed Si's
periodic events and Liino's stance presses, which are the question); the breakthrough table, the `inUltimate` cue
and Liino's beats as a ticking buff stay in the backlog (shared checkout state, team numbers, verdicts would move);
the short lane lets a measure run beside a long job (its verdicts don't depend on CPU load; timing runs take
`--exclusive`).

**Behaviour:** `npm run measure` byte for byte after each replay or check change; `npm run snapshots:update` at
3cd4610 changed no snapshot and not docs/accuracy.md ("No log's verdicts moved"); `node scripts/team-ab.ts --base
c83c9e5` found every team page's fight identical (each hit of the example timelines, a 300 s rules seed, full and zero
energy). Scoreboard unchanged.

**Problems:** the worktree guard refused heredocs and multi-line commands from about a third of the way in (the same
shapes had passed before); everything after went through scratch files, as CLAUDE.md says.

## 2026-11-18: Si's in-game tests from the logs: 14, 41, 92, 16, 15

**Goal:** decide from the logs the in-game tests on Si (14, 41, 92), the basic-attack cancel (16) and the swap
lock (15), checking the re-triage's claims (docs/in-game-tests-retriage-*.md), fixing the engine where it's wrong.

**Done** (each test's own section in docs/in-game-tests.md):
- **14 decided:** Si's battle skill inflicts Heat with a Heat operator first, Cryo otherwise, as the engine has:
  her 11 `fire_fire` and 9 `cryst_cryst` bursts (`checkReactions`) fall on that split, every predicted one with the
  engine's element, none against it.
- **41 decided:** Jade Vessel's next-combo bonus comes from her ultimate or her Immobilization, lasts 20 s (held by
  stops) and goes with the next combo, as the engine has: 37 final hits plain with it, 4 without; 6 ultimate-only
  combos plain with it; no non-plain final hit fits with it toggled.
- **92 decided, the re-triage reversed:** Long Heritage's team Arts DMG (`teamatk`, 0.112) starts with Si's Amp at all
  four of her ultimates (632c, 67d8), on every member: her Cryo Amp counts (checkType 1 reads its ID list), the
  engine's reading. The re-triage had read `teamspell` (0.168, the wielder's own Cryo DMG from her battle skill),
  which is hers alone by design. The kit notes say so.
- **16 partly:** the re-triage's Final Strikes "after her battle-skill cast" follow her hitless battle-button events
  (282 of 370 events have no battle-skill hit; test 106's open part), not battle skills; no real cast (73) has a
  basic hit of hers between its event and its hit. Whether a press drops an unlanded hit leaves no trace: still the
  owner's. Added to open-problems ("Type 50 Yinglung's Edge"): the events don't end her basic attack.
- **15 not decidable:** Gilberta is never the controlled operator in any development log (none of her 371
  Final-Strike hits deals Stagger, a controlled-only mark), so her 3.7 s lock never had anything to hold; the
  re-triage's "fresh chains" are the controlled operator's and teammates' own attacks.

**No engine change**, so the scoreboard and the team numbers don't move (snapshots:update: nothing changed).

**Decisions:** Si's Final Stroke has a `switchToBuffConfig` with `asSkillCast` and a buff (as Last Rite's beside cast),
so it may run beside her basic attack; left as a note in test 16, since no log tells a stroke from the hitless
events. Test 10 left to the queue agent.

**Dead ends:** a teammate's `attack1` as a swap marker (teammates attack on their own); the Jade Vessel enemy-debuff
lane's `since` as an Immobilization marker (whether it moves on a refresh is open: data.md).

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

**Teams** (`efsim rules`, 32 seeds from 1001, against `--assume buff-in-stop=runs` at the same code): Ink Melt
63,347 → 62,377 (−1.5%) at full energy, 56,123 → 59,917 (+6.8%) from zero (a longer Twilight, but her energy
blocked and her ultimate's cooldown started 2 s later); Typhoeus's team 52,374 → 52,641 (+0.5%) / 48,973 → 49,095
(+0.2%). Team pages updated.

**Tests:** kit tests whose buffs are created inside a stop or a combo's slow-down now expect the rest of it
(Akekuri, Ardelia, Lifeng, Mi Fu, Rossi, Wulfgard, Yvonne, Zhuang Fangyi, Laevatain); the search test re-pinned
(Laevatain alone +12.6%). The loop-search tests run Laevatain alone under `buff-in-stop=runs`: with the
longer Twilight she finds no loop in 12 rounds at beam 6 (a lead for the loop search). Holding by ultimates'
stops only (reading `ultimates`) measured worse than by every slow-down (development plain 50.0 → 49.8%,
hold-out 66.1 → 65.9%).

**Dead ends:** see open-problems "Laevatain's Twilight runs longer than its model" (a constant,
show_weapon's 16 s, the full 115-frame pause, a smaller combo hold). Two small Typhoeus misfits
noted there (1cd1 40.12 s, d9e5 11.73 s).

## 2026-11-18: The owner's in-game test queue from the logs: Stagger recovery, Laevatain's Finisher

**Goal:** the owner: "don't ask me to test things that are easier to determine from logs." Test 110 and every
test in the owner's queue (106, 108, 10, 97, 107, 8, 54, 100, 98, 12, 109) tried on the logs; the queue rebuilt
with only what no log can decide. (The other ready tests are being re-triaged by other agents.)

**Decided by the logs** (each test's section in docs/in-game-tests.md has the evidence):
- **110:** a Stagger lasts about 2 s past PoiseRecTime and the stops in it. 30 windows bracketed within 3 s: the
  log's end a median 2.3 s after the engine's own; with +2 s on the enemy's clock a median 0.1 s off, rms 3.15 →
  1.40 s, 12 short / 13 long (27 / 2 before). Hits don't extend it (Staggers outlast 1.8–7 s hitless gaps and end
  0.1 s after a hit); hit rate, Finishers, Stagger dealt don't explain it. Engine assumption `stagger-recovery`
  (`2s` default, `none`); `stagger-freeze` (held / runs: rms 1.40 / 1.42, undecided).
- **108 (the tap):** the next tap is the Finisher, except in Laevatain's Twilight: 7 Staggers with her Twilight
  chain (2–26 hits each), no Finisher; outside it she Finishers every time. Her kit gates the Finisher off in
  Twilight (the enhanced chain has no finisher in the data).
- **10** (final hit by stacks: 63 of 86 exact, n 1–5), **8** (ordinary combos give no Link: 714 skills after one,
  327 plain without it, 20 of 220 mismatches at ×1.2), **12** (the data's value formula; 5 s with ends scattered
  −1 to +2 s), **107** (buffs held for exactly the stops: the 2026-11-14 damage evidence), **98** (the stew),
  **100** (when: 0–9 s after Rhodagn's HP first falls below 70%, five of five long fights).

**Engine changes, measured:** scoreboard (`npm run snapshots:update`): development and verified unchanged, hold-out
plain 65.0% unchanged (one log mixed), earlier pending mean |damage error| 8.2 → 8.3% (d774: a Stagger the replay
breaks itself at 127.9 s, unlisted, now 2 s longer). The replay follows the log's listing, so the recovery shows in
the simulations, not the scoreboard. Team numbers, 32 fresh seeds (1001–1032), full energy / from zero: the owner's
53,780 → 53,514 / 52,744 → 52,972, → **52,937 / 52,850** with Akekuri's battle skill kept out of her ultimate (below); Typhoeus's 52,374 → 51,859 / 48,973 → 48,937; Ink Melt 63,347 → 62,424 / 56,123
→ 57,486 with the recovery, → **59,140 / 54,421** with the Finisher gate (−5.3% both: the rules had Laevatain
Finisher inside Twilight).

**Tooling:** `BuffReplay.staggerCuts` / `StaggerRun.engineCut` (the engine's own end where the log's calm hit came
first, which `staggerHolds` missed: those windows looked like exact fits), `staggerRuns(data, fx, { assume })`;
engine assumption `combo-window-count` (highest / latest) for test 10: no verdict moves under `latest` in 36 Si
logs, so no log has the case.

**premerge** then failed on tests the 2 s moves (the stagger timeline test, 9090's engine ends), on Laevatain-alone loop
searches (no exact loop in 12 rounds at beam 6 with the recovery: those tests now run under `stagger-recovery=none`,
as they test the loop machinery) and on the owner's team's rules check: Akekuri's battle skill pressed past her
ultimate's interrupt mark ends her ultimate state (seed 2). Her `zone_hold` is a visible state now and the SP ≥ 200
rule waits for it.

**Not decidable / left:** 106 (the buff isn't listed), 97 and 108's dive part (4 dive hits in 79 logs, none in a
row), 54 (dashes not logged), 109 (no Haste logged), 100's trigger, 98's milk: the new queue. Test 12's leftover is
an engine issue: its Vulnerable count at Gilberta's ultimate is one or two low in 4360, 489c, 9847, d572 (the damage
follows the listed value 86 to 24; open-problems). Also found: 4d60 has a 7.2 s whole-game pause (no hit from
anyone, a teammate's chain continuing after it), which the log's clock runs through; bigents' Staggers run 11–14 s
past the data.

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
