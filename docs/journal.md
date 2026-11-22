# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 114 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-22: Yinglung's Edge stack counts: hypotheses against 68 combos

**Goal:** the owner's brief: list deterministic causes for the Type 50 Yinglung's Edge count diverging from the
logs (about a third of combos, both ways), score each against every wearer combo in the development logs, iterate
on the misfits, implement a winner.

**Done:** the set's data (`gamedata tree` on its four buffs: an aura's detector on every member, a layer to the
wearer on that member's battle-skill cast, cap 3, no duration, the wearer's combo takes all). Per combo the layers
the damage implies (both readings' DMG-bonus gap in 0.2 units; Jade Vessel's 0.3–0.7 separates as it isn't a
multiple of 0.2): 68 Si and Bounda combos decided, the rest left out with named non-Edge causes. Thirteen first
hypotheses and two new ones scored (open-problems.md "Type 50 Yinglung's Edge", the table): the engine 52 exact /
4 first-combo lower bound / 12 wrong; every logged cast 58 / 0 / 10; without Si's hitless presses 55 / 4 / 9;
expiries, own-only, teammates-only, ultimates, any wearer's combo clearing, first-hit timing all worse. The
misfits suggested two new causes: **N2** Si's first press after her battle skill counts (Initial Stroke under
Artful Intent) and her other periodic presses don't; **N1** layers are lost over a pause with no hit (3f78 and 4a64
after ~20 s, 7b54 after 5.9 s; abfd keeps them over 4.9 s): together 64 / 1 / 3.

**Replay fix (buffreplay.ts):** a Final Stroke inferred from the mark's own burst (the kit's no-Inksoul branch,
where Final Stroke can't be cast) is now an expiry (an `expires` step, no cast): 0c14 81.7 and 489c 107.6 3 → 2;
the engine 54 / 4 / 10. Scoreboard (`npm run snapshots:update`): verified and hold-out unchanged, development plain
52.0%, earlier pending 48.9 → 49.0% plain; 489c mismatches 120 → 113, 0c14 plain 123 → 133; no log worse. Tried and reverted: making Laevatain's Twilight battle skill once where the replay makes it
twice (the `normal_skill` event and the placed `normal_skill_during_ult`, db87 41.2 3 → 2, plain 114 → 126): the
same static rule broke Purrchena's battle skill and counter (04d4); the replay's state has to decide.

**Decisions:** N1 and N2 not built into the engine: N1 needs "leaving battle", which the log doesn't record and the
simulator's fights don't have (test 106 (e) asks the owner); N2 in the replay means making every press under
Artful Intent the stroke the slot holds, and the replay's Artful Intent outlasts the game's (its Inksoul-burst
Final Strokes 2–3 s after the last press fit the expiry better), so it waits on that. Estella's five single-hit
combos don't decide anything (her Razorhorn ATK was fitted on the same hits).

**Left:** c779's moved layer, 0c14 166.7 (two layers and Jade Vessel short); the replay's stroke reading (Final
Stroke only with a press just before the burst; Initial Stroke at the first press). In-game test 106 now asks only
(e) a pause / leaving combat and (d) whether Final Stroke gives a stack.

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

## 2026-11-22: Rossi's bleed keeps only ATK; its ticks on the log's clock; her ultimate's crits

**Goal:** Rossi's mismatches (594 in her 9 development logs, second after Arcane), her bleed first: does its tick
clock drift as Liino's volleys did, and pin it or fix the kit; then Wolven Blood, Seething Blood, her ultimate.

**Done (open-problems "Rossi: her bleed, her ultimate's crits and what remains"):**
- The bleed's `takeAtkSnapshot` keeps ATK only (effects.ts `ATK_SNAPSHOT_ZONES`): d572's ticks follow Wolven Blood's
  layers, Camille's set DMG and the combo's Crit DMG tick by tick, not Camille's weapon ATK. Combustion keeps its
  whole-side snapshot (its own evidence).
- A tick at its buff's application doesn't see that buff's modifiers (PendingHit `firstTickOf`): every bleed's first
  tick lacks its +12% DMG Taken in every log.
- The bleed's ticks are pinned to the logged ones (`ticksShownByHits`, as Liino's volleys): the replay's ticks step
  0.3–0.6 s against the log's at other casts' placed stops, with no kit timer that fits; the bleed runs through her
  own combo slow-down in both.
- The replay counts crits the log leaves out where a trigger on crits logs its hits at that ms (buffreplay.ts
  `shownCrits`): every log gives her ultimate stabs no crit but logs the Seething Blood extra of each crit stab, so the
  extras and their Wolven Blood layers now land.

**Numbers (scoreboard):** all but the hold-outs plain 51.3 → 51.8%, mismatch 19.9 → 19.6%, mean |damage error|
9.9 → 8.3%, within 5% 28 → 31; development mismatch 18.2 → 17.7%, |damage| 12.6 → 10.1%; hold-out plain 67.3%,
mismatch 6.7% unchanged, |damage| 12.1 → 11.7% (1 better, 0 worse); Rossi plain 23.4 → 30.2%, |damage| 17.9 →
3.9%. 4e5e, 3f78, 489c, 4a64, 9a80, 2fd9, 99fb, d572 better; 0c14 mixed (total +8.5 → +10.4%, it over-predicts
already; per-hit closer). Rossi's own mismatches 594 → 497 (`zmdlogs groups --operator Rossi`).

**Decisions:** pinning over a kit timer for the ticks, because the steps follow where the replay places others' stops
(which it can't know better); the snapshot and first-tick rules are engine facts, so simulations get them too.
`ticksShownByHits` is unchanged (Liino's use is the same).

**Left open:** Hard 27 (2fd9, 99fb: 402 of the 497); Wolven Blood's max-stack bonus and the combo's Crit DMG lasting
up to ~2.5 s longer or shorter in world time than the replay's (tables in the entry); Corrosion's ramp under 489c's
ultimates; 0c14's crit-less ultimate without a bleed (no extras to show its crits; the log's layer counts would).
9a80's ultimate ×1.09 already fitted at the base.

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
