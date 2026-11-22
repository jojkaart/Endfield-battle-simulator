# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 109 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-22: Gilberta's Vulnerable count, Zhuang Fangyi's Empyrean entity keys

**Goal:** two accuracy leads: the replay's Vulnerable count one or two low at Gilberta's ultimate (4360, 489c, 9847,
d572; her Susceptibility is 0.30 × (1 + 0.1 × stacks)), and Zhuang Fangyi's `attack1_ult_2_abilityrange`, a logged key
no kit hit named (32 unplaced groups), with her d774 Sunderblade lead.

**Zhuang Fangyi (data):** Empyrean attacks 1 and 2 each spawn four entities `attack1_ult_1..4_abilityrange`, cylinders
at their own offsets; each hits only without the 0.4 s marker the one that hit leaves, so one hit per attack, logged
under whichever entity held the target (_1, _2, _3 all in the logs). Both kit hits name the four keys. The two attacks
then share every key; the placement told them apart by kit order only (attack 2's hits read ×1.4), so `choose` now
picks, for steps alike in every key, the one whose window of the latest cast lies nearest, past a skill that keeps the
chain (her Empyrean battle skill). A first, general version moved Ardelia's, Typhoeus's and Rossi's casts in five
logs: restricted to steps alike in every key. **The Sunderblade lead was a misreading:** d774's battle skill at 97.24 s
has all 8 strikes, the last 3 and the final after her ultimate's stop (her ultimate is logged at its end, 102.17 s;
4d60 157.42 s the same). Her strikes come from a buff on her, so her own stop holds them: a skill hit can now be on the
world's clock (`KitHit.world`, as trigger hits could); her Empyrean strikes (an entity's) keep their pace through her
own combo slow-down in 4bfc and stay on hers.

**Gilberta:** in 489c and d572 the replay landed Rossi's combo 3 twice: the late path's hit (the kit's jump 0 → 212
without the ring) and the logged perfect hit pinned 14 frames later; the late one consumed the infliction the perfect
one's Lift and extra Vulnerable need (+1 where the game gave +2). The replay now drops a jump that would skip a pinned
landing of a hit only the skipped part has (not Pogranichnik's combo, whose slashes land on both paths: a first version
cost c4f3 17 plain hits), with its path; that also ends Rossi's attack 4 landing its controlled and uncontrolled hits
both (2fd9, 99fb). Then 9a80's perfect hit lost its consumption to Gilberta's ultimate landing in the same frame first
(by operator id): pinned landings of a frame now land in the log's order (`loggedMs`). The four ultimates read 4 as
listed; 18 of the 21 listed ultimates agree. **Open:** 4360 and 9847 (tower bosses), where the stacks outlive 20 s by
0.4–1.6 s of world time (open-problems.md, with what's ruled out).

**Numbers (scoreboard):** development plain 52.0 → 52.1%, mismatch 18.2%, damage error 12.6 → 12.4%; earlier pending
plain 48.9 → 50.2%, damage error 8.3 → 8.6%; hold-out plain 67.3 → 67.5%, mismatch 6.7%, damage error 12.1 → 12.2%;
verified 4e5e −1.7 → −3.8%. d572 plain 655 → 788. The totals that fall (4e5e, 4a64, 2fd9, 99fb, 489c, 0c14) lose
phantom "replay only" hits of Rossi's (late, hit_ai) that the log doesn't have; d774 and c6d8 rise as her Empyrean hits
now land (d774's ×1.39 strikes from 97.87 s not looked into).

**Also:** census's rerun line prints `--window=a,b` (a negative window failed as printed).

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

## 2026-11-18: Arcane's and Akekuri's in-game tests from the logs

**Goal:** decide from the logs the in-game tests on Arcane and Akekuri (the owner's team and Typhoeus's): 31, 51, 7,
30, 4, 57, 62 (the "Logs first" rule; the claims of docs/in-game-tests-retriage-01-40.md and -41-75.md checked, not
taken).

**Decided** (each in its own section of docs/in-game-tests.md, "Decided by the logs (2026-11-18)"):
- **31** (finishers in the array): a finisher alone is a Cluster Strike, four lasers about 0.4 s after its first hit
  (00ae, 4d60, a7a7, 2b01, c516). The engine already had it (`cluster_strike_finisher`): the re-triage's "the engine
  only has the Final Strike trigger" was stale; the replay lands all 20 lasers. A finisher and a Final Strike together
  are one strike (b6aa 46.6 s, four lasers).
- **51** (a hit's own effect on that hit): Solemn Phalanx (3 plain exact; 8915's on its stage factor) and Starry Beach
  (11 plain exact) count on the hit that creates them. New: Solemn Phalanx's INT Arts DMG is also on the Corrosion the
  same infliction forms (a7a7 3.86 s exactly (1.399 + 0.44) / 1.399; 8915 twice at 0.32), Hot Work's (from the
  Corrosion) isn't.
- **7** (INT Arcane ×2?): no; 00ae and a7a7 fit, 8915's ×1.85 is all its stage (238 of her 278 hits in the stage's
  windows within 1% of its factor, as Si's and Wulfgard's). The Amp lasts the array, Gloompurge relists it, and the
  second ultimate's cast replaces it with its own, gone by her next basic attack (00ae, 8915): the engine kept it up
  to 10 s more.
- **30** (her Susceptibility's length): 10 s from the hit (tight windows 10.4–11.8 s; none 20 s); the −1 to +3 s
  differences are timer holds (tests 37, 110).
- **4** (the Corrosion ramp): the engine's ramp; 1,156 of 1,897 non-crit hits under a plain-formula Corrosion within
  0.3 points of its shred, alternatives at most 281; 743 of 936 with raised caps / forced scales / carried shreds.
- **57** (Akekuri's Link): ×1.30, five plain exact Laevatain battle-skill hits in 458b.
- **62, Akekuri's part**: each layer restarts the shared timer (458b: 11 plain exact basics at 167–173 s with all five
  layers); Chen's, Yvonne's and Ember's parts stay open.

**Engine changes** (both kept: no log worse without explanation, hold-out not worse):
1. Before-damage triggers on the infliction (`inflictionApplied`: the game's abilityEvent 126, sent before it resolves
   the infliction into a reaction) run ahead of those on the reaction, so a Corrosion's (or Combustion's) own hit sees
   what they give (timeline/landing.ts). Only Solemn Phalanx (INT) changes a wearer's own Corrosion hit in practice.
2. Arcane's kit: `int_amp_ult2`, the second ultimate's own Amp (ends Gloompurge's at the cast; ended by her next basic
   attack, at most the skill's 287 frames). A first try with `endsWithCast` cut it before the ultimate's own hit in
   a7a7 (a battle skill placed inside the cast) and made a7a7 and a hold-out worse; a7a7 also shows her battle skill
   right after keeping it, so only a basic attack ends it.

**Scoreboard** (docs/accuracy.md from `npm run snapshots:update`, against 9fa151b): development
plain 49.5 → 49.6%, mismatch 19.3 → 19.2%, mean |damage error| 13.0 → 13.1% (00ae's total: its post-ultimate hits
moved from −40% to −15% each, unquantified, under a total already below the log); hold-out unchanged in the
aggregates (1 log better, none worse); 8915 plain 101 → 113, a7a7 352 → 353; Arcane's row plain 60.9 → 61.1%.

**Teams:** both play Arcane in WILL, where neither change acts (Solemn Phalanx's INT trigger and the second
ultimate's Amp need Intellect ≥ Will): the example snapshots didn't move.

**Left:** 8915 after its stage (×0.986 at 92–103 s, ×0.81–1.21 steps at 104–112 s); whether a combo or battle skill
ends the second ultimate's Amp; the 0.05 s by which Akekuri's P1 outlives the replay's end in 458b; her own finisher's
8 SP (no log records SP).
