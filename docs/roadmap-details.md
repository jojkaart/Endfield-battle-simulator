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
(Yinglung's Edge: now only a pause / leaving combat and Final Stroke; the logs decided the rest, 2026-11-22) and 107
(Si's Amp across ultimates); the replay's reading of Si's strokes (open-problems "Type 50 Yinglung's Edge": her first
press after her battle skill counts, Final Strokes only with a press just before the burst) and Laevatain's Twilight
battle skill the replay makes twice across a stop (db87; decided by the replay's state at the press, not statically).

## Engine accuracy

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
buff on to the log's end (engine assumption `hidden-holds`, default `log`:
plain 55.7 → 57.5% but for the hold-outs, unchanged). Next: in-game test
111 (counted perfect dodges during Si's Amp); then the holds placed once
for every timer from the shared clock (enemy statuses, unlisted buffs, the
dodges' SP for "Team SP"), and the dodger's own 0.315 s; simulations
already dodge with `--dodge`, and the owner's dodge rate would decide how
much rides on it.

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
