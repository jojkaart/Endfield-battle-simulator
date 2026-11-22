# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 117 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-22: Improvement round 5: the lock's queue, premerge's done line, diagnosis views

Goal: improvement round 5 (docs/friction/README.md, step 2) over the eleven open reports (round 4's backlog and
report, the finisher gate, the eight 2026-11-22 accuracy branches) and the lead's own friction from merging their
batch. Summary and outcomes: docs/friction-done/2026-11-22-round-5.md; what's left:
docs/friction/2026-11-22-backlog-after-round-5.md.

Done:
- premerge's last line comes from scripts/done-line.sh: "pass" only from its own end, "killed" from a signal trap.
  The false pass was bash's: a shell killed by a signal runs its EXIT trap with `$?` of the last finished command
  (0). Long steps now run in the background and are waited for, so the trap runs at once (bash defers traps during a
  foreground command) and stops them; tests/done-line.test.ts.
- The test lock: fair shares between worktrees (a worktree's n-th waiting job counts as arriving n × 20 min later),
  the estimated wait plus run against the 2 h background limit on the first waiting line, a kill in the queue named
  on the DONE line. measure and team-ab fix their code at queue time with a snapshot commit of the working tree
  (temporary index, own worktree, removed after): agents keep editing while they wait. team-ab's identity check runs
  in the short lane, its 32 seeds only for the moved teams.
- `npm run merge -- <branch>…`: a batch with one snapshots run, then `vitest related` on the code both sides changed.
- Views: `zmdlogs worldtime`, `lanes --world`, `measure --hits` and moved casts under `--changed placement`, the
  replay's EVENT lines (`loggedCastFates`, the same matcher as withLoggedCasts), fallback matches in `groups`,
  `verdictReading` in `hits --json`, `efsim assumptions`, skill groups and applications in `efsim kit`.
- Docs: batched timestamps, how the placement picks among groups sharing a key, misreadings, limits; `.prettierignore`.

Decisions: no hard one-job-per-agent cap (fair shares get the same without idling the machine); no more jobs in the
side lane (timeouts and incomparable measurements; the snapshot makes the wait free instead); `hits --json` fields
added, not renamed (scripts read `predicted`); the hold-out snapshot file stays where it is (a grep exclusion instead
of moving a file three scripts and the snapshots glob name); a replay-only buff-duration option and the `beside`
exemption for `launch` are behaviour changes, left to accuracy tasks.

Checked: `npm run measure -- --hits` at the views commit, every log byte for byte; team-ab against HEAD unchanged.

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

## 2026-11-22: Twilight's excess is her buffs' clock, not Twilight's

**Goal:** why Laevatain's Twilight still lasts 0.1–4.6 s longer than modelled in the
closed windows (open-problems "Laevatain's Twilight runs longer than its model", in-game
tests 18 and 21), and fix it.

**Done:** every Twilight window of the 18 Laevatain logs bracketed again (last enhanced
cast, first plain cast, from `zmdlogs instances`), with the replay's holds counted from a
run with Twilight 45 s long (so holds after the modelled end count). Then each candidate
tested per window (open-problems has the table): a constant, show_weapon's 16 s, the
battle skill's full 115-frame pause, a combo hold other than 1.9 s, every 1- and
2-feature linear model over her combos, battle skills, others' ultimates and combos,
her hit-stops, a clock rate, others' stops longer than their UltimateTimeAction (bounded
by the hit-free gaps), the Stagger, P5's kill extension, refreshes by a combo or a
Scorching Heart start, a later start, an enhanced step after the end. None fits all
windows: c83c needs ≥3.1 s where f879 45.4 s allows ≤1.2 s. The game data has no
mechanism beyond the engine's (`gamedata who buff_chr_0016_laevat_ult_end`: her combo's
channel, potential_5 and show_weapon's start).

The decisive probe: Forgeborn Scathe's 20 s buff (`buff_wpn_sword_0006_valid`, listed on
her hits), created by the same ultimate and with none of Twilight's own pauses, runs past
the replay by about as much in the same windows (0.9–2.8 s in the closed ones, 3–8 s in
3440 and 9c0b). Twilight less Forgeborn contains 0 in five of nine windows and misses it by
0.09–0.43 s in four, both ways. So Twilight's model holds; what runs long is her buffs'
clock in those windows (Scorching Heart's natural ends outside Twilight too: 0.2–1.5 s in
8 of 9). Measured Twilight 17 s (+2) on every Laevatain log: no verdict moves at all, the
development and hold-out rows unchanged.

**Decision:** no kit change (a longer Twilight would put a world-clock effect into one
kit, and the accuracy doesn't ask for it). Registered kit assumption
`laevatain-twilight-clock` (test 21): `model` (default) or `forgeborn` (+1.8 s, Forgeborn's
median excess; trigger `twilight_clock_excess`), the switch for what rides on it: Ink Melt
59,662 → 61,930 (+3.80% ± 1.30, seeds 1001–1032, full energy, `efsim rules …
--assumptions`). Scoreboard unchanged (development 52.0% plain, hold-out 67.3%); team-ab
against 1ab4647 identical (the default is the old kit). Smoke: one failure, the timeline
test's list of her kit triggers (fixed). Docs: open-problems (table, ruled out, still possible),
in-game tests 18 and 21, design/rules.md's assumption list, roadmap.

**Left open:** what holds her buffs (and not cooldowns, test 18): perfect dodges' 0.6 s
world slow-down (the log records no dodges), pauses at a fight's start (9c0b: 10 s with no
hit, Forgeborn +6–7.8 s), hit-stops in part. Next: the buff clock over every log, each
listed buff's natural end against the replay's. Friction report
docs/friction/2026-11-22-twilight.md (a `--long` trace and a lane-end view would have
found the probe in minutes).

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

## 2026-11-22: Arcane's Imprisonment end and her INT lasers

**Goal:** Arcane's Imprisonment ended late in the replay against the log's natural-end "cast" (median +0.3 s, 4d60
+1 s, ad7f +2.5 s); the seal buff's abilityEvents 8 / 1403 / 1601 undecoded; a7a7's INT early-end lasers 0.4 and
1.1 s early. Details: docs/open-problems.md "Arcane's mismatches as one group", Fixed 4.

**Found (game data):**
- The natural end is the seal's one tick, not its end: the combo sets `trigger_time` = duration_final − 0.5
  (SimpleCalcBB), the seal ticks once at it (buffEvent 1) and casts `abilityentity_end` (explosion 14 frames later);
  the seal and its child Susceptibility end 0.5 s after. The logged end is 6.0 s after the touch where nothing holds
  it, and the Susceptibility's logged lane ends 0.5 s after it. The kit cast the explosion at the seal's end.
- abilityEvents 8 / 1403 / 1601 (seal, combo_skill_precheck) cast the same end when the holder goes (defeated,
  removed, handed over; with 1401 / 1402 in Wulfgard's and Arcane's files): none mid-fight.
- Si's freeze doesn't hold the seal (b6aa 19.56 s, ad7f 3.91 s).
- INT: seal2 (the early end's window) ends with the tick; a late hit in the seal's last 0.5 s still casts seal_again
  (its 12 s Susceptibility, no lasers: 8915 109.94 s). The log's combo event 0–4 frames before the first laser is the
  lasers' start (seal_finisher_wisd); seal_again's frame 41 comes 0–1.1 s later than the hit + 41 frames + holds
  (not decoded).

**Done:** kit `imprisonment` ticks (`every`), `explosion` on the tick, `early_end_window`, `laser_wait` +
`int_lasers`, `post_susceptibility_lasers` / `_late`; KitBuff `runsThroughFreeze` (engine clock.ts shiftDebuffs),
`endFollowsTick` and `childOf` (the replay moves the seal's and its Susceptibility's end with a logged tick); the
seal's and the lasers' ticks `ticksLoggedAs` the combo; buffreplay.ts: a due tick waits up to 1 s for a logged one
(TICK_HOLD_FRAMES), and for a ticked skill a combo's own event is one within 1.5 s of it (COMBO_EVENT_MS); docs
(game-data-format abilityEvents, data.md "Hidden casts", open-problems, roadmap).

**Decisions:** the replay takes the logged end as a timing fact where the game's (±0.5 s unexplained) can't be
known. COMBO_EVENT_MS for every combo was tried and made the hold-out's mismatch 6.7 → 6.9% and its damage error
12.1 → 12.3%: limited to skills a buff's ticks are logged under (Arcane's combo).

**Scoreboard** (docs/accuracy.md from `npm run snapshots:update`, against 1ab4647): development plain 52.0 → 52.7%,
mismatch 18.2 → 18.2%, mean |damage error| 12.6 → 12.4%; hold-out plain 67.3 → 68.7%, mismatch 6.7 → 6.7%, mean
|damage error| 12.1 → 11.9% (9 logs better, 0 worse, 1 mixed); Arcane's row plain 61.7 → 63.5%, mismatch 15.5 →
15.3% (863 → 854 hits outside the multi-target logs), mean |damage error| 14.2 → 14.3% (9c6e's Arcane total −33.9 →
−41.1%, below). Development 16 better, 2 worse (9c6e, e9896c8d02be: below), 5 mixed.

**Teams** (`node scripts/team-ab.ts --base 1ab4647`, 32 seeds): Estella, Si, Akekuri, Arcane 53,162 → 53,103 / 52,826 →
52,717 (full / zero); Typhoeus, Arcane, Liino, Perlica 52,949 → 52,955 / 50,194 → 50,177: within the noise (sd
1,300–1,900); a line on each team page.

**Left:** the seal's ±0.5 s where nothing holds it (4d60 short, 1d91 / af7b / fc63 long); seal_again's delay;
e9896c8d02be's combo pressed before her own ultimate (placed after its stop; its end not held by the stop while its
Susceptibility was): Arcane, Si plain 252 → 246; 9c6e's total −10.0 → −10.7% (its hits after the seal's logged end
lose the Susceptibility, closer each: 665 / 892 against 494 / 743 logged, was 785 / 1053).

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
