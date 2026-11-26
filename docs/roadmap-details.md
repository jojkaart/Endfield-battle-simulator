# Roadmap details

The detail behind [roadmap.md](roadmap.md)'s next steps, one section per
step, and the longer-term list. Keep the roadmap itself to about one
screen: a step's leads, numbers and open questions go here; done work goes
to the [journal](journal.md) and the docs it produced. Moved here from the
roadmap on 2026-11-16 unchanged; the dates are when each item was last
updated.

## Rule-based rotations

**Rule-based rotations (2026-11-16, phases 1 and 2 done: design/rules.md
"Rule-based rotations", `efsim rules`, `efsim diagnose`, `efsim gear
--rules`, examples/*.rules.json, each team page's "Rules" and "Gear"):**
what's left for the owner is gear they'd have to farm: the owner's
team's (Estella's Grizzled Edge loadout, Si's LYNX Slab loadout,
Akekuri's Fiber Gloves: +8.0% ± 0.9 together, played by the rules of
2026-11-16; the gear ascent on the new lists is next); Arcane in INT
mode for Typhoeus's team is decided, rules against rules: −1.91% ± 0.60
on 64 fresh seeds, not worth the Hot Work loadout
(docs/teams/typhoeus-arcane-liino-perlica.md "Gear played by the rules");
timeline-moving stats (Ultimate
Gain Efficiency, mode-flipping attributes) are noisy even on common
seeds (±1–2% a line at 4 seeds, ±0.6–1.3% at 16): a cheaper estimate of
their worth (energy held / wasted against the ultimate's value per
cast, or many short fights) would let the ascent decide those without
16–24 seeds; the ascent is path-dependent where gains are within the
noise (a first run took Akekuri's change, a second Si's): a joint check
of the top changes on fresh seeds; the diagnosis report as a reason
list for the rules' gap to the timeline (which presses come late, which
windows are missed); the rule search re-run on the new gear (a first
60-list search: see the journal); Typhoeus's team is the furthest from
its timeline (hover upkeep and SP sharing are hard to say as cues);
in-game test 108 (the Finisher input) decides the filler's assumption
(the tap decided by the logs; 2026-11-18 also no Finisher under an
enhanced attack, Typhoeus's hover included, from the Talos Wiki and the
logs; the dive part still the game's).
The guided rule search (`efsim rules --guided`, 2026-11-16: ideal
combos per window, losses per missing multiplier, directed edits:
`shows`, holds for a window's visible cue, chains) now makes the moves
found by hand; its limit is the noise (a paired difference's standard
error 0.5–1.2% at 32 seeds, most structured edits gain 0–2%). Next
there: cheaper variance (more, shorter fights; or a control variate
from the ideal-combo losses: a run's achievement explains much of its
DPS spread), the ideal combos with uptimes and cooldowns (Stagger on
every hit can't happen), inflictions a hit consumes and SP for
empowered skills as multipliers (they sit in a hit's scale, not its
modifiers). Done 2026-11-22 (design/rules.md "The objective across
starts", "Rule sets", "The search decides"): every list scored by the
mean of the two starts per seed; cues for what tells the starts apart
(ultimates ready at once, an ultimate's gauge) and for setups (a
status's level); conditional rule sets with Corrosion setups, set moves
and a split of an edit by a start cue; the three teams re-searched, the
open questions decided by the search (Estella's ultimate on Stagger: no;
Ink Melt's rule 7 with `shows`: no; the Twilight hold: kept), the
examples changed (the owner's +1.1% with a Corrosion setup, Ink Melt
+3.2%, Typhoeus's +8.6%, fresh seeds). Next there: a cheaper screening
(shorter fights or a control variate: a search is 1,300–3,300 runs of
300 s on both starts), a rules check inside the search (it caught a
setup press ending Akekuri's ultimate after the search; setups now keep
the list's own guards), and the split move judged on more teams.
Whether Initial Stroke is worth pressing no longer hangs on Si's talent
Haste: the logs and the owner (2026-11-17) agree it doesn't speed up
attacks, so it's movement only (test 109 kept, lower priority, in case
it shortens cooldowns); re-measure Initial Stroke's worth without it. The Arts Intensity effects behind
Estella's Grizzled Edge advice are log-verified (2026-11-16,
combat-mechanics §3.7); left from that review: Pogranichnik's Breach
strength one Fervent Morale layer off in 12 of 21 instances
(open-problems "Arts Intensity").

## Typhoeus, Arcane, Liino, Perlica

**Typhoeus, Arcane, Liino, Perlica (2026-11-15, done: 5.76 / 4.99M,
docs/teams/typhoeus-arcane-liino-perlica.md):** its zero-energy search
is the least converged of the three teams (+27% at beam 48 alone): a
beam 96 run, or the search seeded with the found rotations; casts
across others' time stops are placed from their cast events since
2026-11-18 (open-problems.md, Typhoeus's hover); left: Typhoeus's 4th
shot anchored to her 5th's cast (fc63), 9c6e as a multi-target fixture;
Liino's volleys done 2026-11-18 (a 10 s timer: the data's reaction
check is disabled; 9090's Liino −10.4 → +2.5%), and 4360's Perlica run
(an unlogged End Stance out of Cosmovoice, now inferred); Perlica's
combo hits and 9090's −9.6% done 2026-11-22 (Pulser Labs' and Wild
Wanderer's Electrification buffs act on the hit that applies it: 9090's
Perlica −9.4 → −2.7%, the rest crit luck), fc63's ATK fitted as a build
override (attribute nodes 2, weapon level 86; one input alone fits none);
Liino's stances cast before a log starts and her Cosmovoice beats on their
own clock done 2026-11-22 (open-problems.md "Liino's Cosmovoice beats");
left: 9847's team-wide ×0.975 / ×1.3–1.5 runs (Bigents), 4d60's combos
×1.08 (Liino's stance ATK listed, not replayed), a reaction
Electrification with Wild Wanderer (in-game test 68's open half), the
replay's stops around some beats (Perlica's ultimate in 4d60 at 92.8 s),
Cosmovoice ending before its logged finale (9090, 8915, 4bfc), a pinned
beat ordered after another's hit at its frame (9847 60.77 s); gear
chosen jointly with the rotation (a search per candidate set, not a
replay).

## Gear

**Gear (2026-11-15, `efsim gear` done for all three teams):** the
search is chaotic: a small build change sends the beam to other
rotations (the owner's team with Estella's +0.7% loadout: −15% / −9% by
the search that reproduces the examples), so searches can't confirm
gear gains of a few percent: a search seeded with the current rotation
(its moves as the guide's first line) would make "re-search with the
new gear" meaningful; then the owner's team with Si on the logs' LYNX
Slab loadout (4–5% better on every rotation found for it, but none of
those reaches the owner's 3.99M rotation, which needs her Rift Trekker
Gloves' Ultimate Gain). Owner told about Estella's logs loadout (Type 50
Yinglung Heavy Armor, Gloves T1, Radar + LYNX Slab) +0.6–0.7%.

## Planning from the payoffs, after phase 3

**First (2026-11-15):** after phase 3 (journal 2026-11-15, design/search.md
"Payoffs and chains": macros are `efsim search`'s default, skeletons and
the setup value opt-in): make macros cheaper (the macros played at every
node: 145 ms a state against 57 on Ink Melt; from zero energy they lose
at equal run time), the setup value without its overvaluing of held
pieces (worse on both teams; its extra-share variant `--setup share`
unmeasured at 60 s), skeletons that aren't greedy (a schedule over the
fight with slack, the merges' setups placed by their leads), macros in
the loop's rounds; search the owner's opener and loop again with Arcane in WILL mode
(docs/teams/rotations/ are still the INT build's, with Estella in slot 1); simulate Ink Melt (EndfieldHub's top team)
next to the owner's team under the same assumptions; the buff timing
report's leads (`efsim zmdlogs timing`, done 2026-11-15; open-problems
"Buff timing leads": Yvonne's MI Security on unlogged crits in 5082,
Si's hitless ultimate in 9c0b, Hot Work on Combustion ticks); the loop's long openers and a 2-round loop; in-game tests 106
(Yinglung's Edge: now only the boss Si's phase pause and Final Stroke; the logs decided the rest, 2026-11-22/23) and
107 (Si's Amp across ultimates); Si's strokes read from the log since 2026-11-23 (Initial Stroke at her first press,
Final Stroke only from a burst credited to it: Edge 61 / 68 exact); left: what her later presses are, why Artful Intent
without Initial Stroke lasts to a press, a battle skill re-made where a burst's record restarts (0c14 157.4 s), and
Laevatain's Twilight battle skill the replay makes twice across a stop (db87; decided by the replay's state at the
press, not statically).

## Misprediction statistics (2026-11-24)

[analysis/2026-11-24-misprediction-stats.md](analysis/2026-11-24-misprediction-stats.md): the ranked candidates with
their shares and next checks (open-problems "Misprediction statistics"); the tables are rebuilt in a minute
(`node scripts/probes/stats/build.ts`) and every table comes from `python3 -I scripts/probes/stats/analyze.py`, so a
later round can measure what its fixes moved by class. In order: the ×1.5 band's rest (Alesh's ultimate by
`poise.origin`, the Liino ultimate windows in 1cd1 / 1d91 / 9c6e), the one-buff list (20.4% of the error, the
hold-outs' 34.0%: Si's ultimate Amp in 9c0b, Gilberta's weapon Arts DMG, Arcane's Susceptibility layers and Will burst
buff), the Endministrator's and Chen Qianyu's "ready" weapon buffs on ultimates (2.8%), `zmdlogs fit-build` for Liino
in 7910 and af7b, the drift against the placed holds' running total. A view promoting the explanation classes
(`zmdlogs explain --all`?) if a second round asks the same question.

**Worked 2026-11-24** (the analysis's follow-up section; journal
[2026-11-24-02](journal/2026-11-24-02-misprediction-candidates-logged-as-buffs-the-enemy-s-hp.md)): the "ready" buffs
were a double count (`loggedAs` on the attached buffs; Yvonne's P5 too); Alesh's ×1.5 and Chen's d4fb factor were the
enemy's HP the replay didn't have (engine assumption `enemy-hp`: a kill's total in lives; test 69 decided); Ardelia's
were placements (basic steps sharing a key); Si's Amp in 9c0b a pre-log ultimate; Liino's 7910 / af7b factors aren't
builds. Left, in order: Liino's ultimate Amp starting late against her stop (1cd1 36–39.7 s, af7b 57–60.8 s: the
replay's stop of her ultimate covers teammates' logged hits), 7e19's Chen ×1.15 (a build element of hers?), the rest of
the one-buff list (Arcane's weapon Arts DMG Taken and Will burst buff, Zhuang Fangyi's weapon ultimate buff, Gilberta's
weapon Arts DMG, Typhoeus's Hovering ATK), the drift.

**The kit buff leads, 2026-11-24** (journal
[2026-11-24-03](journal/2026-11-24-03-kit-buff-leads-zhuang-fangyi-s-empyrean-end-the-rest-not-kit.md); open-problems
"The kit buff leads"; per buff `python3 -I scripts/probes/stats/onebuff.py <regex>`): Zhuang Fangyi's Lone Barge buff
was the Empyrean's end logged as an ultimate event (fixed in the kit); the others aren't kit values. Next, in order:
(1) 4d60's unlogged holds, 3.6–6.1 s around 98–143 s (`zmdlogs holds 4d60`: the bounds dropped; the replay's Stagger
window 114.30–133.37 s takes no holds, the enemy is away 117.22–124.45 s); (2) the hold placement's stop list for a
cast event the replay reads as a buff's tick (castassembly.ts replayedCastStops: the Empyrean end's phantom 78 frames;
friction report 2026-11-24-kit-buff-leads point 2); (3) Arcane's bursts: replay-only after her WILL touch and
ultimate (the enemy's infliction then, in-game test 33) and the 1 s burst delay across her own ultimate's stop (b7b3
4.95 → 10.34 s); (4) Gilberta's weapon in 4a64 (two ultimates' overlapping stops: in turn?); (5) Zhuang Fangyi's d774
104.18 s Empyrean battle skill (3 hits, no final).

**The placement leads, 2026-11-24** (journal
[2026-11-24-04](journal/2026-11-24-04-placement-leads-ultimates-from-their-cast-events-chen-s-stew.md); open-problems
"Misprediction statistics"): Liino's ultimate windows were her travelling projectiles placing the cast late (logcasts.ts
eventStopStart: from the cast event at an edge of the stop, where the frame's stop covers a teammate's hit); 7e19's
Chen her food; Swordmancer's and Mi Fu's P3 cooldowns on the world's clock (engine assumption `trigger-cooldowns`,
`world` not the default: it takes every trigger, and four kit tests' fights and two hold-outs move);
(2) above done (the hold placement; query.ts replayTimeStops, the views', still counts the tick). Next: (1) a kit field
for a travelling landing (the compiler from LaunchProjectile / projectile entities) to replace the
event-and-contradiction rule; (2) 7e19's Ember finisher, its second hit with the Staggered parts after the log's
Stagger ended; (3) a kit trigger field for the cooldown's clock (`cooldownClock`, from the data's AddGlobalCDTimer; Swordmancer, Mi
Fu's P3), then `trigger-cooldowns` per trigger, smoke and team-ab;
(4) 0c14's −4.9%: Rossi's ultimate stabs (−2.5%, crits unlogged), Si's log-only inkmove (−1.5%), the
Endministrator's Crush ×2.2.

**The cooldown-clock round, 2026-11-24** (journal
[2026-11-24-06](journal/2026-11-24-06-cooldown-clocks-from-the-data-arcane-s-burst-held-by-her-own.md); open-problems "Misprediction statistics"): (1)–(3)
above done. (1) KitHit.travels (the compiler, from LaunchProjectile) reproduces the event rule for every projectile
ultimate but not for the ability entities it takes (Tangtang's stare in b7b3), so the rule keeps its check for them;
(2) every finisher hit deals as on a Staggered enemy (`finisher-stagger` `cast`: 7e19 −4.9 → −1.1%); (3)
KitTrigger.cooldownClock from the data's CD timers, cooldown buffs and timed markers (`trigger-cooldowns` `kit`; the two
hold-outs' worse totals are Swordmancer's dropped replay-only procs); and Arcane's bursts: her own ultimate's stop holds
her burst (`burst-stops` `all`: b7b3, 89 → 94 of her 130 within 150 ms). Next: (a) ability entities that fly to the
target (Tangtang's, Arclight's) as a field of their own, then the event rule without its check; (b) 9a80's 35.05 s
burst (0.44 s of world time later than every stop held allows); fc63's Nature state before her ultimate's stack
(Typhoeus's consumption); (c) 4bfc 179.51 s: the log says Empyrean's end (Arclight's chain unbroken through the stop
the replay makes, Zhuang Fangyi's _ult forms to 179.17 s, plain after), the replay's empyrean buff ended before it;
(d) 7e19's ×1.096 (Pogranichnik's team ATK layers as `values`).

**The remaining leads, 2026-11-25** (journal
[2026-11-25-01](journal/2026-11-25-01-the-remaining-leads-the-empyrean-s-end-on-its-frame.md); open-problems "Misprediction
statistics"): (c) done: the Empyrean ended on its logged event's own frame (holdinputs.ts endedWithTick), not early;
ExtendBuffAction as a pause ruled out. (b) fc63 40.80 s: Gilberta's and Perlica's ultimates played in turn
(logcasts.ts inTurn, 12 of 27 overlapping pairs with a quiet stretch of the first's stop length); fc63 85.13 s: the
touch's element after a Corrosion opener (Nature, the applied one: assumption `window-reaction`, default `consumed`);
9a80 35.05 s and 79cc 24.23 s open (Imprisonment's enemy slow-down ruled out). (a) no field: the data has no movement
for the two ability entities, and marking them `travels` moves no log. (d) not Pogranichnik's layers (teammates fit
with two under the same listing); Ember's own. d4fb 97.05 s open. Next: 489c's hold placement after the in-turn move
(plain 591 → 488, its Corrosion readings), the 15 pairs left (three-stop chains), d774's away window as the test of a
boss-phase pause of the operators' timers (4d60), test 33's reaction case.

**Holds and placement, 2026-11-25** (journal: the holds-and-placement entry of 2026-11-25; open-problems "Ultimates
pressed together"): 489c's loss after the in-turn move was the Corrosion's end held by Si's freeze, not the in-turn
stop (the ramp agrees with it) nor the ramp bounds: no Arts reaction status is held by a freeze (`freeze-ramp`
`statuses`: development plain 68.1 → 69.0%, 489c 488 → 632; db87 one worse, its Stagger-time Combustion ticks). A third
placement pass oscillates (2-cycles, plain −0.3 points: docs/tried/); the 14 overlapping pairs: six with logged hits in
the in-turn stop, five of 2–4 frames, three the extensions resolve and the logs refuse (docs/tried/). Next: a burst's
world-time delay from its infliction as a hold bound (9a80 35.05 s: a dodge-sized hold at 29.66–30.00 s, where the
log is quiet), db87's slow Combustion ticks in a Stagger (50.7–53.8 s, ~0.6 s), d4fb 97.05 s (2.18 s short; not the
Stagger), a placement pass that moves a cast only where the quiet stretches favour it.

**Damage factors, 2026-11-26** (journal
[2026-11-26-01](journal/2026-11-26-01-damage-factors-catcher-s-weapon-the-crush-s-stacks-from-si-s.md); open-problems
"Misprediction statistics", The damage factors): the Crush's formula is right on every logged Crush; both misses were
Vulnerable stacks from Rossi's perfect combo (a Lift and one more stack per consumed infliction): 2fd9's fixed in round
4, 0c14's from Si's battle-skill press in the away stretch (the replay makes it; the game's lands nothing) and her
next, hitless one that Jade Vessel's listing proves. 04d4's Catcher fitted (weapon level 3, fit-build no longer throws
on a DEF food): plain 185 → 376. Ember's ×1.096: the check's loggedEntries dropped her talent's listed ATK as one of
Thermite Cutter's layers, and the listing hides her talent's layers (stackingType 10). Three diffs held back for the
lead (docs/tried/2026-11-26-*): the loggedEntries fix (hold-out plain 79.0 → 80.4%, none worse), the 0c14 presses
(hard-coded: 0c14 plain 172 → 293) and a fight's-last-frame rule (mixed). Next: those three as general rules in the
replay and the check (an enemy-absent state for the away stretches; a hitless press inferred from a buff only it
gives; an unjudged layered buff read at 1 … maxStacks), Snowshine's ×0.9624 (her attribute bonus 3.325 → 3.200: a gear
line, a weapon skill level or the node subset), Rossi's unlanded bleed ticks and combo_3's over-hold (the holds' and
the clock's).

**The enemy's clock, 2026-11-26** (journal: the enemy's-clock entry of 2026-11-26; open-problems "The enemy's
clock"): db87's Stagger-time delay is the combos': across a combo's stop every clock runs late (the enemy's tick
chains 0.17–0.24 × the combo-held time, an operator's cast across a teammate's combo 0.33 ×, bursts 0.40 ×, buff runs
0.45 ×; across an ultimate's stop on time; scripts/probes/combo-hold/). Ruled out: Arcane's Imprisonment (test 37's
Arcane part decided), a Stagger, a longer ComboSkill curve (flat: verified 78.0 → 73.0%; docs/tried/), a burst bound
(placed holds don't hold bursts), a pause of the operators' timers while the enemy is away (Xiranflow's layers on
time in 4d60 and d774). `stagger-holds` `combos` registered off (development +0.2 points, 0eef worse). Next: whether
the combos' excess is a fixed delay per stop edge, and a stop reading that holds the operators' clocks (bursts,
landings) without moving the statuses; d4fb 97.05 s (2.18 s short, the combos give 0.6–0.8 s); 4d60's Perlica weapon
and Will burst runs (a refresh the replay misses); not reached: freezes on Electrification / Solidification, the
quiet-stretch placement pass.

**Away and presses, 2026-11-26** (journal: the away-and-presses entry of 2026-11-26; open-problems "The damage
factors" and "The enemy's clock"): the damage-factors round's hard-coded fixes as general rules. The replay's enemy
is away in the away stretches (engine assumption `enemy-away` `absent`, the default: TimelineScenario.enemyAway): a hit
there applies nothing to the enemy, the operators' own buffs from it still come (d774's and 9c6e's Liino stances). A
press the log shows no hit of is made when its cast event is logged and the next hit lists a new run of a buff only it
gives (`hitless-presses` `inferred`: 0c14's Si, 891566c224f8's Liino); 0c14 plain 172 → 293. The enemy leaves with a
stretch's last logged hit (the totals leave out the unmatched landings of its frame), and a fight of several lives
ends in a kill when its last life dealt one Max HP (4a64 +2.9 → +0.7%). The check reads a layered unjudged buff
listed once at each count to its maximum (7e19, 04d4, 99fb). A fixed delay per stop edge can't give both the enemy's
ticks (57 ms a combo) and the operators' casts (140 ms). Next: where the operators' extra hold sits in a combo (its end
against its start, casts.ts --rows by where the stop falls), 0c14's Rossi (58 replay-only landings, 0.30M), 207f's
last slash2 (no kill the log shows), a9d7's Slashing Edge refresh from Chen's ultimate final inside its stretch (a hit
that landed, or a hold), Alesh's eventless 0c14 combo.

**Combo hold and replay, 2026-11-26** (journal: the combo-hold-and-replay entry of 2026-11-26; open-problems "The
damage factors", "The enemy's clock", "0c14"): 0c14's Rossi replay-only landings were one battle skill's tail the log
doesn't have (no Lift, wolves or bleed after its two charge hits) and, from the Vulnerable stack it didn't add, her
next battle skill's follow-up: engine assumption `unlogged-tails` `cut` (the default; replayrun.ts tailCuts,
ReplayCastOptions.endsAt), guarded by the operator's other logged hits, the listing's new runs, the away stretches
and the fight's end; 0c14 plain 293 → 336, its total +2.7 → −3.2% (its matched Rossi ×0.943, Si ×0.964). a9d7's
Slashing Edge past Chen's unlogged ultimate final is a hidden hold, not a landing (the away edge unchanged). The
operators' combo excess sits inside the stop's first half (landings before its start on time, right after its end
already late at full density: scripts/probes/combo-hold/edges.ts); a uniform extra hold on the operators
(`combo-operator-hold`) measured worse. The ComboSkill curve is a reading (`combo-curve`); `zmdlogs casts --choices`
and `placement --choices` show the placement's rules. Next: 0c14's Rossi and Si under-prediction, an operators-only
curve, Snowshine's ×0.9624 (level, potential and weapon skill levels ruled out), Alesh's eventless combo, 207f.

**0c14 and the operator curve (2026-11-26, [journal](journal/2026-11-26-06-0c14-and-the-operator-curve-a-teammate-s-attack-on-its-own.md)):**
half of 0c14's Rossi deficit was the totals counting crit-unknown hits at expected crits where their values show the
crit (engine assumption `totals-crits` `read`, enginecheck.ts critFromValue); Rossi's attack 4 as a teammate takes
the kit's not-controlled path (drivers.ts controlPathLandings; 2fd9, 99fb, 0c14). The rest of 0c14 is
Alesh's: her 12.5 s Rare Fin combo the log shows only by its buffs, and her 59.56 s combo's Rare Fin path; and a
Stagger at its breaking hit (80.48 s). The operators' own combo curve (`combo-operator-hold` `plateau-0.5/0.6/0.7`,
`flat`) measured worse on the verified logs in every shape: stopped. The 16 tail cuts over the development logs
(scripts/probes/tails/cuts.ts) are none against the log; 9c6e's was the placement's two-enemy split (a rule taking a
landing at its cast's previous one's ms as a second enemy's fixed it and broke 40d9's Si, whose combo slashes the log
batches at one ms: dropped), de6a's hit_3 falls in a 2.3 s gap with no hit by anyone. Next: a chance jump's path from the values (Alesh's Rare Fin: 0c14, 4e36,
a9d7), a combo made from the listing, Snowshine's ×0.9846 after her node 5.

**Bursts and cooldowns (2026-11-26, [journal](journal/2026-11-26-08-bursts-and-cooldowns-4d60-s-runs-a-whole-game-pause-in-a.md)):**
4d60's Perlica weapon and Will burst runs weren't a missed refresh: a whole-game pause (117.22–124.45 s, no hit by
anyone) inside a Stagger, where the hold placement allowed none (engine assumption `pause-holds` `away`: 696 → 806
plain). The replay's Stagger window record started a log-held Stagger 10 s early (d4fb), fixed. d4fb's 97.05 s miss
is a Lift that breaks the bar (one case, not built); Snowshine's offset and test 33's reaction case can't be decided
from the logs. Next: whole-game pauses outside a Stagger (9c0b's 7.5 s after Laevatain's ultimate: does the placement
already take it?), the world-time view without tick-read stops (query.ts replayTimeStops), Alesh's combo paths.

**Alesh's Rare Fin (2026-11-26, [journal](journal/2026-11-26-09-alesh-s-rare-fin-chance-paths-and-a-cast-from-the-listing.md)):**
a chance jump's path read from the listing (her P3, which only the Rare Fin slam gives, listed from exactly the
slam's ms: castassembly.ts listedPaths, drivers.ts replayCast `chanceJumps`), and a cast the log shows only by a buff
one of its hits alone gives (engine assumption `listed-casts` `inferred`: 0c14's 12.0 s combo). 0c14 plain 338 → 493,
−1.3 → −0.3%; 4e36 281 → 368; hold-out plain 80.8 → 81.0%. P3 stays the log's (judged by the replay, a hold-out log
lost 47 plain: docs/tried/). Next: 0c14's 80.48 s Stagger at its breaking hit (four combo cases, more evidence
first), a path the listing can't decide read from the hits' values (ad7f still rolls), one model of a fight's lives.

## Engine accuracy

**Fight totals (2026-11-23, [journal](journal/2026-11-23-10-fight-totals-the-enemy-away-the-endministrator-s-shatters.md)):**
the large total errors were landings on one side only, not matched scale: replay landings while the enemy is away
(engine assumption `enemy-away`, read by the totals only), the Endministrator's crystal shatters placed as ultimates
and her male kit's keys, Hard 27's giver-less Electrification. Left, by share (open-problems "Fight totals"): a9d7's
matched −19.6% (a fight-wide factor), 2fd9's Mi Fu Crush ×1.90, 3f78's Rossi ultimate with one stab fewer logged (its
slashes in the wrong slots: placement by value), 9c6e's two targets, fc63's Typhoeus burst keys, 4360's kill not
detected (capped last hit, data HP not the total), then matched scale in d9e5, e82d, 1cd1, 7910, db87.

**Fight totals, round 2 (2026-11-23, [journal](journal/2026-11-23-11-fight-totals-2-an-all-fights-view-kills-from-capped-hits.md)):**
`efsim zmdlogs totals --all` and measure's per-group shares (the hold-outs: 12 of 13 one-sided). Done: a9d7 and d9e5
were missing foods, five more logs a node count or weapon level (fixture `buildOverrides`, fit-build); a capped last
hit is a kill; an ultimate's fewer landings by time (3f78); Typhoeus's off-field 5th-shot key and burst joins (fc63 and
six more). Next: (1) an offsets screen (per log and operator, the median logged ÷ primary and its tightness) as a
command and a slow test, so a missing food never waits for a totals round; (2) what the hold-outs' replay-only and
log-only landings are by kind (measure: counts per landing kind, no log named); (3) 2fd9's Crush stack count; (4)
fc63's Hunting Arrows after the hovering ultimate and the 5th shot's burst's Hovering ATK; (5) Chen's readings (d4fb,
a9d7), e82d's Si combo listing.

**Fight totals, round 3 (2026-11-23, [journal](journal/2026-11-23-12-fight-totals-3-the-one-sided-landings-by-kind-sunderblade.md)):**
the one-sided landings by kind (packages/logs onesided.ts; `zmdlogs totals <fx> --kinds`, `totals --all --kinds`,
measure's "One-sided landings by kind", the hold-outs' means by kind only). Done: Zhuang Fangyi's Sunderblade variants
pinned in turn (3aa6), a trigger's alternative paths as one landing (Si's Artful Intent bursts: hold-out 9.1 → 8.2%),
a detached series at its own pace (fc63's Barrage Array: +6.8 → +3.3%). Next: (1) slots by value as well as time
within a cast (9a80's Si combo final on a slash 6.6%, 7910, a27b: scratch/misslot.ts in the journal); (2) Zhuang
Fangyi's Sunderblade gains (4d60: 6 and 8 where the log shows 8 and 9); (3) the hold-outs' log-only physical status
hits (2.45%, 2.08% of it a status the replay deals nowhere within 5 s: a physical status it never makes); (4) cast tails (1.9% /
2.3%: basic attacks cut by inputs the log lacks); (5) Rossi's Seething Blood extras; (6) Typhoeus's 5th-shot Hovering
ATK (her own clock: the end varies 0.52–0.71 s); then round 2's (1), (3), (5).

**Fight totals, round 4 (2026-11-24, [journal](journal/2026-11-23-13-fight-totals-4-whose-shatter-snowshine-s-counter-rossi-s.md)):**
done: a Shatter at a stack joining a running Vulnerable is its starter's (04d4's Ember), Snowshine's counter jump from
its logged bash (04d4, 2fd9 −15.6 → −3.6%), a pinned landing's crit only its own hit's and valueCrits over listed
effects (Rossi's extras). Next: (1) measure's hold-out physical misses split by status kind (2.08%, unmoved: no
development mechanism); (2) Zhuang Fangyi's Empyrean free path (4d60: 6 blades, the log 8, earlier counts right);
(3) Rossi's bleed ending at her slash2 (3 replay-only extras); (4) slots by value; (5) same-ms order where a stop
doesn't batch (docs/tried/2026-11-24-same-ms-cast-order.diff); then round 3's (4), (6).

**Tests 18, 19, 101, 104 from the logs (2026-11-16,
[journal](journal/2026-11-17-01-tests-18-19-101-104-from-the-logs-bosses-freeze-haste-isn-t.md)):** bosses freeze by default, control immunity per enemy
(Chiliarch, the enemy Si; packages/data/src/enemyFacts.ts); cooldowns run
through others' ultimate stops (settled); Haste doesn't speed attacks (the
engine no longer plays hasted casts faster); teammates' pause 6.5 s. Left:
Laevatain's Twilight runs past its model (open-problems; since
2026-11-18 her own stop holds it, engine assumption `buff-in-stop`, and it
is still 0.1–4.6 s longer; 2026-11-22: not Twilight's own, her Forgeborn
buff from the same ultimate runs as far past the replay, so the next step
is the buff clock over every log: each listed buff's natural end against
the replay's, against dodges' SP and hit-free gaps; kit assumption
`laevatain-twilight-clock` for what rides on it; done 2026-11-22, below); re-search the five Si example
timelines with the full beams (after Haste's change they hold the old
timeline repaired or a single-beam search: lower bounds);
per-operator and per-fight teammate pace (the logs' R² 0.41 each) if a
favourite's numbers lean on teammates' attacks; why an immune enemy holds
the freezer's own debuffs (test 37).

**The buff clock (2026-11-22, open-problems "The buff clock"):** every
team's listed buffs run a median 0.5 s past their duration in world time,
on one hidden clock per fight that the enemy's tick timers share (152 runs
of 1,378 conflict with it, 341 with the excesses shuffled); its holds are
about a perfect dodge's 0.512 s each and never come while the enemy is
Staggered (tick pairs: 34 of 378 outside, 1 of 92 inside); the damage
sides with the listing (802 hits against 92). The replay keeps a listed
buff on to the log's end (engine assumption `hidden-holds`, `log`:
plain 55.7 → 57.5% but for the hold-outs, unchanged). **Placed
(2026-11-23):** the holds estimated once per fight from every clock the
log shows (the replay's buff expiries against the log's runs, the enemy's
tick series; the least total, midway between its earliest and latest
placement; packages/logs holds.ts, `efsim zmdlogs holds`) and held on the
world's clock for every timer, then the log's ends (default `placed`):
development plain 59.9 → 62.8%, mismatch 16.4 → 15.6%, hold-outs 69.6 →
69.9%. 108.6 s of holds in 5,899 s of fights, a quarter of the 0.512 s
units placed within 1 s. Read as dodges they cover 87 of the 1,766 SP the
replay lacks (not the gap); no sign of the dodger's own 0.315 s clock on
its buffs (pairs: ratio 1.12). **More clocks (2026-11-23):** the enemy's
listed statuses' runs and Corrosion's ramp steps (read from the hits'
damage, `efsim zmdlogs ramp`), and the engine's ramp standing still inside
a stop: d774's strikes and db87's ramp fixed (numbers in the journal).
Rossi's Wolven Blood has no clock of its own: its misfits are its 16th
layer's crit (no logged crit): fixed 2026-11-23 (layerCrits: n layers listed
from a moment are n crits; 0.98 right with the flags hidden, the base rate
with the listing moved). Instance buffs' runs are clocks too where the log
shows them apart (4360's tower-boss Vulnerable stacks fixed; 9847 left: a
Vulnerable-count clock from Gilberta's listed Susceptibility, a holds.ts
bound). **The ramp's over-holds (2026-11-23):** four causes, not one combo
rule: freezes (the ramp runs on: `freeze-ramp`), Arcane's combo reset at
its frame 9 (a RESETto1 dilation in the combo priority: `combo-reset`,
every stop list cut the same way), the application's logged ms (a
battle-skill hit before a stop logged at its end: a7a7), Rossi's combo_3
(two dilations). The reset's reach (2026-11-23): a combo pressed inside
Arcane's first 9 frames ends at her frame 9 too (`combo-reset` `reaches`;
9555's Imprisonment burst on time, 7910 +15 plain). Next: test 111;
castStart from a battle skill's event when its hit falls just before a
stop; Rossi's combo_3 (489c's bleed ticks at 52.18 s ask 0.19 s less hold
across it, as 3f78 and 4a64 do); 489c's hold at 54.2–55.7 s, asked by the
bleed ticks and the ramp alike, dropped because a unit at 49.4–53.0 s and
it exceed the ramp's cap; Rossi's bleed ticks the replay lands off the
log's (489c 46.60 s for 47.13 s, 52.18 s none: her final 1.1 s late);
pauses and overlapping ultimates' stops (489c), which a dodge can't be;
simulations already dodge with `--dodge`, and the owner's dodge rate
would decide how much rides on it.

**Stagger windows (2026-11-17, accuracy plan B1 follow-up):** the replay
follows the log's Stagger listing (the damage confirms it). The game's
windows run longer than the engine's own (median 3.5 s past its end).
**Decided by the logs (2026-11-18, test 110):** about 2 s past
PoiseRecTime and the stops, a recovery the engine now adds (engine
assumption `stagger-recovery`); the teams moved −0.5 / −1.5 / −1.0% (full
energy), within the noise. Left: the ±1.4 s spread, bigents' 11–14 s
(open-problems.md "The replay's Stagger windows").

**Engine accuracy first** (the owner, 2026-10-26: above the search's
scoring): [accuracy-plan.md](accuracy-plan.md). Phase A, B1 (Stagger)
and B0 (teammates' own basic attacks; the pause set to 6.5 s from the
logs' attack share, in-game test 101, 2026-11-16) are done, and B3 / B5 / B7 as far as the data and logs go; B2
(SP stop: 0.5 s since 2026-11-12, regen through time stops; test 102
pins it) and B4 (Solidification) wait on in-game tests 102 and 71; the
SP the replay still lacks (open-problems "Team SP": teammates' unlanded
basic attacks, Purrchena's blocks; Liino's beats done 2026-11-13, 1d91's
extra heal left);
next the screened logs' leads ([open-problems.md](open-problems.md):
what each has ruled out and what still stands; Rossi's ultimate ×1.081 in 2fd9 (9a80's fits since before 2026-11-22), Mi Fu ×1.11 in Hard
27 (done 2026-11-23: the enemy's resistance 11, from a second player's log, 207f; Ember's and Snowshine's weapon levels
fitted), the food logs' openers (3f78, 4a64: the replay holds Corrosion's ramp 0.2–0.3 s too long across Gilberta's,
Si's and Arcane's combos; next the same opener elsewhere), Si's combo −22.6% in 40d9 (unmasked), db87's Arcane ATK, the
eny_0134 logs' food in de6a (0c14's: Kunst Tube on all but Alesh, 2026-11-18); Yvonne −23% in 5082 and
Ardelia's sheep ×1.407 in 791, both unmasked 2026-11-14), diagnosed in parallel (small
models first, the owner's call 2026-11-11); then the favourites' kit
leads (B8: the build offsets the log check
reports without an explanation (04d4's Snowshine ×0.96,
92b4's Liino ×1.031), and those it can't see (flat ATK buffs spread the
ratio: 4e36 / c3c7's Ardelia, set by hand; now `efsim zmdlogs fit-build`, still
to be bounded by the weapon's logged skill levels), 458b's Combustion ticks (Zhuang Fangyi's Sunderblade count in d774:
explained 2026-11-22, her ultimate's stop holds the strikes); Si's build in 9555 (found
2026-11-18: no attribute nodes, a fixture buildOverride; 0c14's Si and
f978's Ardelia too); logged presses with no damage of their own while the enemy is
there: Zhuang Fangyi's, Arcane's combo and Si's in 4bfc, 3aa6, 0c14),
3aa6's Stagger at 145.6 s (the replay has none), Xaihi's ultimate Amp in
b6aa 0.57 s after its logged cast (elsewhere 1.9–2.5 s), bdf2's Si combo
finisher ×1.456 (no stack count fits), 7e19's Crush landings unmatched (Endministrator
+46%),
bosses' own phases the logs show (Rhodagn's refill, test 100; the Abyss
boss's ×0.1 until its Stagger in c6d8), then B6 (Si's battle-skill entity and Arcane's and
Pogranichnik's ultimates ignore others' time stops: small), B9, B10.

## The tool's purpose: the favourites' rotations

**The tool's purpose: team rotations for the owner's favourites**
(Typhoeus, Arcane, Si, Gilberta, Liino, Estella, Laevatain, Rossi
(the owner, 2026-11-08); 6-stars P0,
4- and 5-stars P5 unless the owner's account says otherwise; no swaps by
default, the owner's call 2026-10-25). The search's beams still disagree
by 4–14%: a score closer to the final damage (a cheap rollout, or a value
for what a state holds), then searches of the favourites' teams and a
report of the best rotations found. Ask the owner for their roster.
Damage distributions are in (design/damage.md "Damage distributions"); next
there: the mean of crit-triggered teams from one deterministic battle
with those buffs at their expected state (so the search ranks by it
and stays one battle), then `--percentile` from the distribution.

## Log check leads

**Log check leads** (design/data.md "The log check's rule"; the report names
them, largest first): Stagger the log has that no logged hit explains
(4e5e: 68 over 53.2–55.4 s in three steps, two not whole numbers:
Solidification or Shatter?), Rossi's Wolven Blood max-stack bonus and combo Crit DMG lasting
0.5–2.5 s longer or shorter than the replay's (2026-11-22: her bleed keeps only ATK, its first
tick lacks its DMG Taken, its ticks follow the log's clock, her ultimate's crits come from
the logged Seething Blood extras: open-problems "Rossi: her bleed"), Typhoeus's hover through
her combo, Arcane's Solemn Phalanx WILL buffs, Camille's weapon ATK the
log stops listing, the replay's inflictions against the log's reactions
(one enemy replay instead of reactioncheck.ts's own; reaction levels
already come from the log where it shows them, and 4a64's Xaihi
battle-skill casts without logged hits still add inflictions), statuses and
landings the replay misses (Arcane's Final Strike in b6aa, 9555's casts);
458b's ×1.3 on Laevatain's `normal_skill_during_ult`; then tighten the
totals' bound (45%). The fallbacks in verified fixtures (~300) are the
work queue; a build fitter with structured `buildOverrides` instead of
hand fits in notes (done 2026-11-18: `efsim zmdlogs fit-build`; next: the
weapon level bounded by its logged skill levels from
WeaponBreakThroughTemplateTable, the older hand fits moved into
`buildOverrides`, weapon skill levels and artifice as candidates); the negative control on the unscaled replay; d9e5
(now a fight-wide ×1.12–1.20 on every operator from 4.4 s, not Arcane's);
whether mostly-assumed matches (Rossi in 4e5e) hold hit by hit.

**Arcane's mismatches as one group (2026-11-18,
[open-problems](open-problems.md#arcanes-mismatches-as-one-group-2026-11-18)):**
908 → 866 (her lasers on the world's clock; buffs a chance path's hit
applies left to the log). Imprisonment's end and the INT lasers done
(2026-11-22: the seal's tick at duration − 0.5 s casts the explosion,
freezes don't hold it, the replay takes the logged end and the lasers'
logged start). Left there: the seal's own ±0.5 s where nothing holds it
(4d60 short, 1d91 / af7b long), seal_again's 0–1.1 s delay before the
lasers, e989's combo pressed before her own ultimate; the rest is teammates'
buffs (Liino's Medicant in 1d91, Camille's talent ATK in db87, Ardelia's
Susceptibility in af7b), Stagger and placement (db87's Laevatain ultimate
stop, fc63's shot count). In-game tests 4, 7, 30, 31, 51, 57 and
Akekuri's part of 62 decided by the logs (2026-11-18): the Corrosion
ramp, her talent-1 Susceptibility's 10 s, the finisher's Cluster Strike and
Akekuri's Link and P1 timer were already the engine's; two fixes
(Solemn Phalanx's INT Arts DMG on the Corrosion its infliction forms; her
second ultimate's own Amp, gone by her next basic attack). Left in 8915
after its stage: ×0.986 at 92–103 s and ×0.81–1.21 steps at 104–112 s.

## Kit values from the data

**Kit values from the data** (design/data.md "Kits and the game data"): fill
launch frames, applications and bonuses; SP of hitless skills as cast
triggers; the Typhoeus arrowrain `dataOverride` that hides dbae's
verified hits; Mi Fu's per-fixture factor (2fd9 / 99fb / de6a).

## Engine

**Engine:** slow-downs don't shift what's created between their cast and
their start (`shiftClock`'s caller in clock.ts); buffs' expiry and ticks
as scheduled items; `Modifier` with an attacker / defender side instead
of `SNAPSHOT_ZONES`; Solidification durations (in-game test 71);
Corrosion's time dilation and carry-over (test 4).

## Food

**Food:** a search over foods per operator; the importer setting a food
the log lists; in-game test 98 (DEF +x%'s formula item 1).

## Process

**Process:** a generated table of which mechanics are verified against
real data and which only against the engine's own reading (the in-game
tests' queue is at the top of in-game-tests.md: keep it current); shared
test helpers. Still open from setup: a `Result` schema,
`NOTICE` when MIT code is first copied.

## Later

- Interactive search: drivers on the engine's stepping API that generate
  the action list on the fly, with a battle policy / evaluator exploring the
  tree of choices ([design.md](design/timeline.md#stepping-api)).
- **Account import** from the SKPORT capture extension
  ([player-data.md](player-data.md)), only once the system is verified and
  can find useful new team rotations (owner's call, 2026-10-18). Until then,
  fixtures use published, fully specified setups.
- Team-composition search with constraints (must-include / always-exclude
  operators, available weapons and gear).
- Web interface for browsing and comparing results.
- Rust implementation of the engine, validated against the same fixtures.
- **Patch update routine:** bump data submodule pins, re-run the data
  cross-check, review every fixture whose result changed (balance change vs
  bug), and record it in the journal. Document once the first update is done.
