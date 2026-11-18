# Estella, Si, Akekuri, Arcane (the owner's team, 2026-11-14)

The owner wants this team simulated as well as possible; it is the
current priority. Example: [examples/estella-si-akekuri-arcane.scenario.json](../../examples/estella-si-akekuri-arcane.scenario.json)
(the owner's builds, 2026-11-14: Estella P5, JET 9/9/5; Si P0, Jade Vessel
9/9/4; Akekuri P5, Thermite Cutter 9/9/5; Arcane P0, Solemn Phalanx 9/9/4;
the owner's gear pieces, base versions, weapons at 90 assumed). Artifice is
assumed full except Arcane's accessories' Intellect lines: the owner tunes
her to the most Intellect just below Will (2026-11-15), which with these
pieces is Intellect 472.44 against Will 473.50, WILL mode (the loadout the
owner copied in game: open-problems "Arcane's Array Arcana on a knife
edge"). Until 2026-11-15 the example assumed full artifice, which put her
INT 11 above WILL and played her INT (3,286,029 full energy, 3,008,031
from zero).
Akekuri is in slot 1 (the owner, 2026-11-15): Si's battle skill inflicts
Heat (the slot-1 operator's element) and Akekuri gets Si's combo cooldown
cut. Estella is the controlled operator. Until 2026-11-15 the examples put
Estella in slot 1, so Si's battle skill inflicted Cryo (3,922,576 full
energy, 3,397,119 from zero, partly from chains the owner's team can't
play).

## Results (2026-11-15; lower bounds)

- Against Rhodagn Lv90, 60 s, full ultimate energy at the start:
  **3,990,122** (66,502 DPS; Estella 43.3%, Si 42.1%, Arcane 7.9%,
  Akekuri 6.7%), from `efsim search --no-macros --skeletons` (beams
  12/24/48: 3.35 / 3.99 / 3.99M; with macros, the CLI's default, 3.44 /
  3.44 / 3,486,730). Ultimates: all four at 1.1 s, Arcane's second 15.0 s,
  Arcane 44.5 s, Estella 46.8 s, Si 49.2 s, Arcane's second 56.4 s.
  Crits: sd 51,683 (1.3%), 5–95% ≈ 3.92–4.09M.
- From zero ultimate energy (the harder fights;
  [examples/estella-si-akekuri-arcane-zero.scenario.json](../../examples/estella-si-akekuri-arcane-zero.scenario.json)):
  **3,263,818** (54,427 DPS; Si 47.6%, Estella 38.0%, Arcane 8.7%, Akekuri
  5.7%), also with skeletons (beams 2.42 / 2.69 / 3.26M, spread 26.0%;
  with macros 2.95 / 2.96 / 2,982,948). Ultimates: Arcane 27.7 s, Si and
  Arcane's second 37.0 s, Estella 53.9 s, Akekuri 55.8 s. Crits: sd 45,268
  (1.4%), 5–95% ≈ 3.21–3.36M.
- With this team order macros settle early (spreads 1.2% / 1.1%) below the
  skeletons' results: they don't win here as they did on Ink Melt.
- Complete rotations (opener and loop, `efsim search --loop --sync`,
  docs/design/search.md "Opener and loop", 2026-11-14) in [rotations/](rotations/)
  are still from the INT build and Estella in slot 1 (full energy: an
  84.9 s loop at 41,056 DPS after a 1,095.2 s opener; zero: 81.1 s at
  40,677 DPS after 255.7 s): to be searched again.

### Rules: what to play (2026-11-16)

A rotation to learn rather than a timeline (docs/design/rules.md "Rule-based
rotations"; [examples/estella-si-akekuri-arcane.rules.json](../../examples/estella-si-akekuri-arcane.rules.json),
`efsim rules`). Estella controlled, no swaps. Start with **Si's battle
skill**; then at every moment do the first of these that applies:

1. When Si's ultimate is ready: Si's ultimate.
2. When Estella's ultimate is ready: Estella's ultimate.
3. When Arcane's ultimate is ready: Arcane's ultimate (her second part
   too, when its button lights up).
4. When Akekuri's ultimate is ready: Akekuri's ultimate.
5. When Si's combo lights up: Si's combo.
6. When Estella's combo lights up: Estella's combo.
7. When Arcane's combo lights up: Arcane's combo, then Estella's battle
   skill.
8. When Akekuri's combo lights up: Akekuri's combo.
9. When Si's battle-skill button shows her battle skill (not Initial
   Stroke: Artful Intent isn't up) and SP is at least 115: Si's battle
   skill. Don't press Initial Stroke or Final Stroke: let Artful Intent
   run its 20 s and burst by itself.
10. When SP is at least 200: Akekuri's battle skill.

Otherwise Estella's basic attacks. Learnability: 1 opener press, 10 rules
(11 presses), cue cost 31, complexity 43; the hardest cues are the four
"ultimate ready" ones (rank 4).

**Why rule 9 changed (2026-11-16).** The first list pressed Si's battle
skill at every 100 SP, so it ran on through Initial and Final Stroke and
ended Artful Intent after 7–9 s, 35 times in 300 s. The owner pointed out
that ending it early wastes SP. In the simulator the record itself loses
little when ended early (Artful Intent records 8% of all damage the enemy
takes while it lasts, and the next one starts recording again soon after),
but each early end costs 115 SP. Letting it run and putting the spare SP
into Akekuri's battle skill plays 56,423 (sd 2,039) against 55,462
(sd 2,929), 10 seeds each (the old delay draws; the table below has
the numbers with common random numbers): as good or a little better, and calmer.
Letting it run while wasting the spare SP loses about 20% (44,092); spare
SP into Estella's battle skill (46,014) costs her combo's trigger, into
Arcane's (45,486) isn't worth it. Pressing Initial Stroke right away (for
the Inksoul's haste when it ends) was +4% over leaving it with the old
driver; with the fixed one, leaving it is +0.35% ± 0.83 on 32 fresh seeds
(noise) under the data's reading and +2.84% ± 0.62 under in-game test
109's alternative (`efsim rules … --compare … --assumptions`).
**Dropped (2026-11-17):** Haste is movement speed only (the game's
glossary: "Temporarily raises the movement speed of a target"; the logs,
in-game test 19; the owner has never noticed it in play), so Initial
Stroke buys nothing. Leaving it out: +1.37% ± 0.58 on 64 fresh seeds at
full energy, +0.66% ± 0.52 from zero (noise), and one press fewer.

| Simulated player, 0.3 s reaction ± 50%, 32 fresh seeds (1001–1032; the fixed driver, 2026-11-16) | Full energy | From zero |
|---|---|---|
| Sustained DPS over 300 s (sd over seeds) | **53,781** (1,194) | **52,740** (1,539) |
| As a bot (0 s) / at 0.6 s | 57,835 / 55,713 | 56,552 / 55,928 |
| First 60 s against the 60 s timeline (the examples) | 3,569,656 against 3,990,122 (−10.5%) | 3,042,921 against 3,263,818 (−6.8%) |
| 300 s total against a fixed 300 s search (beam 6, full energy) | 16,947,851 against 13,994,230 (**+21.1%**) | |

**Arcane's and Akekuri's tests from the logs (2026-11-18; in-game tests 4, 7, 30, 31, 51, 57, 62):** the Corrosion
ramp, her Susceptibility's 10 s, the finisher's Cluster Strike, Akekuri's ×1.30 Link and her P1 timer were already
the engine's; the two fixes (Solemn Phalanx's INT Arts DMG on the Corrosion its infliction forms, her second
ultimate's own Amp) need Intellect ≥ Will, and this Arcane plays WILL. The same seeds at 9384cb0: **53,780 /
52,744** (sd 1,193 / 1,541), within 0.01% of the row above, and the 60 s examples' snapshots didn't move.

**The engine changes of 2026-11-16 (in-game tests 104, 19, 101 from the logs; same seeds 1001–1032):** bosses
freeze (Rhodagn: Si's freezes hold every debuff) 56,493 → 56,716 / 56,055
→ 56,141; Haste no longer speeds casts → 55,278 / 55,598 (−2.5% / −1.0%);
teammates' pause 6.5 s instead of 3.5 s → **52,382 / 52,716** (−5.2% /
−5.2%; Akekuri, Si and Arcane basic-attack less, as the logs show);
without Initial Stroke (2026-11-17) → **53,781 / 52,740** (as a bot /
at 0.6 s 56,335 / 53,824, full energy). The
other rows are from before; the 60 s timelines were searched with hasted
casts and no longer play: the full-energy one is repaired (3,472,929,
2 steps later, 2 dropped), the zero-energy one re-searched at beam 24
(2,291,586): lower bounds until a full re-search. As a bot / at 0.6 s now
52,983 / 52,771 (full energy).

The 10-seed numbers of 2026-11-16 before the driver's fixes (seeds 1–10) are superseded by these (design/rules.md "Rule-based rotations": a stale SP check delayed SP-gated presses).

The earlier list (Si's battle skill at every 100 SP, ending Artful Intent
early) played 55,462 / 56,370 sustained and was better in the first 60 s
from zero (+4.2% against the timeline): ending Artful Intent early spends
SP sooner, and the extra battle skills' team energy brings the first
ultimates sooner. Over a long fight the two are level.

**The guided search (2026-11-16; `efsim rules --guided`, design/rules.md "The
guided rule search").** Its ideal combos: Si's combo is the biggest
window (11,393 DPS of 57,102, 2.5 a minute, always on Solidification)
at 62% of its ideal; it misses Si's own ultimate Amp (on 41% of its
damage, ×1.36: −2,433 DPS if on all), Stagger (on 38%: −2,107) and
Akekuri's ultimate ATK. Over the fight the team gets 71% of its windows'
ideal combos, the best of the three teams. 70 edits over four rounds
(20 min): one passed, **Estella's ultimate only while the enemy is
Staggered**: +1.70% ± 0.80 on seeds 1–32, +1.20% ± 0.66 on 32 fresh
seeds, but from zero energy −0.94% ± 0.47 (32 seeds): the example keeps
the list (a full-energy option: rule 2 "when Estella's ultimate is ready
and the enemy is Staggered", complexity 47). Holding Si's ultimate for
her combo or Solidification loses 2–5% (her Amp lasts long enough as
it is; waiting costs casts); every hold of a combo for a Stagger loses
7–12%; Si's battle skill with `shows` changes nothing here (+0.10% ±
0.45: rule 9 already reads Artful Intent).

- **The references:** the 60 s timeline is the upper reference for a
  60 s window (planned to the frame, every bar spent by 60 s); it isn't
  sustained DPS. For a long fight, the fixed 300 s search (`efsim search`
  of the scenario at 300 s, beam 6, no macros, 34 min) is the sustained
  reference, and the rules beat it by 19–21%: over 300 s the beam is too
  narrow to plan well, and the rules' simple reactions hold up. The
  opener-and-loop rotations in [rotations/](rotations/) (40.7–41.9k DPS)
  are from the INT build with Estella in slot 1: not comparable.
- **Robustness:** a bot does 2.5% better than a 0.3 s player, and 0.6 s
  costs no more: the fight is chaotic, so any change of timing moves where
  the Stagger windows and ultimates fall, ±4% between seeds.
- **The rule search** (two runs, 150 and 200 lists from the earlier list) found
  nothing better beyond the seeds' spread: its best lists played 54,880
  and 56,341 at 10 seeds (reordered ultimate and combo rules, a dive as
  the opener). Lighter lists on its Pareto front lose: without Si's
  ultimate rule (complexity 30) 51,137, without Si's and Estella's
  (complexity 25) 48,039 (5 seeds each).

## Gear (2026-11-16, played by the rules; the examples keep the owner's gear)

`efsim diagnose` and `efsim gear --rules` (docs/design/rules.md "Diagnosis,
marginal values, gear on rules"): the rule list above played over 300 s
on common seeds, so the rules adapt to each loadout (no repaired
rotation). Arcane kept (her Intellect is tuned just below her Will).

**What's inefficient now (the owner's gear, 8 seeds):**

- Estella's ultimate waits 5.5 s of the 300 (3.2 s behind other presses) and
  10% of her energy is lost at a full bar; her Ultimate Gain Efficiency
  isn't worth a gear line (+0.3% ± 0.8 a line, against +5.2% for Arts
  Intensity and +4.9% for Physical DMG). She is the operator the owner's
  example describes: the line is better spent on damage.
- Akekuri's and Arcane's ultimates are the bottleneck the other way: one
  Ultimate Gain Efficiency line is worth +2.9% ± 0.9 on Akekuri (more
  than any damage line on her) and +1.3% ± 0.6 on Arcane (as much as her
  best damage line). Si's efficiency is worth nothing either way (−0.3%
  ± 0.9).
- Arcane wastes 36% of her energy at a full bar (her cluster strikes
  overfill it), but her ultimate still counts: it's what keeps her
  Susceptibility on Si and Estella. More Intellect on her loses 7%
  (it flips her to INT mode).
- Team SP: almost never at the cap (0.6 s) with the current list. The
  same list without rule 10 (spare SP to Akekuri) sits at the cap 165 s
  of 300 and loses 2,358 SP: −19% (46,311). That was the cost of letting
  Artful Intent run without somewhere to put the SP.

**What to change** (each against the gear current then, paired on common
seeds; the whole set checked on fresh seeds):

| Change | Why | Gain |
|---|---|---|
| Estella: Type 50 Yinglung Light Armor → Heavy Armor, Æthertech Light Gloves → Grizzled Edge Gauntlets (Radar ×2 kept) | trades Battle / Combo / Ultimate DMG lines for Arts Intensity +45 and Physical DMG: what she's worth most per line | +3.7% ± 0.1 |
| Si: Rift Trekker Gloves + Beacon → Type 50 Yinglung Gloves + LYNX Slab (the logs' most common, 15 logs) | her Ultimate Gain Efficiency gloves aren't needed when the rules adapt (they were for the owner's 60 s timeline) | +3.6% ± 0.8 |
| Akekuri: Frontiers Blight RES Gloves → Frontiers Fiber Gloves T1 | Battle Skill DMG for Ultimate Gain Efficiency: her ultimate is a bottleneck | +1.7% ± 0.8 (24 fresh seeds) |
| All three | | **+8.0% ± 0.9** (24 fresh seeds: 56,243 → 60,755) |

Estella's Arts Intensity is 0 with the owner's gear; the +45 line scales
her Shatter, Solidification and Lift hits (23% of her damage in the 60 s
example), and those effects are checked against the logs (2026-11-16,
combat-mechanics §3.7: × (1 + AI/100), her own AI as the operator who
triggers them, exact up to AI 287).

Estella's change is damage-only, so its gain hardly moves between seeds;
Si's and Akekuri's change when ultimates come, so they need more seeds
(Akekuri's: +1.7% ± 1.4 at 16 seeds in the ascent, left out there as
within the noise; +1.7% ± 0.8 on 24 more). The earlier timeline-based
`efsim gear` found only Estella's logs loadout (+0.7%); played by the
rules it is −2.5% against the Grizzled Edge loadout (and +1.1% over the
owner's). The ascent's run: 1,154 runs, 20 min on 3 workers. With all
three changes the rule list stays: a 60-list rule search found nothing
better (its best 61,293 against the list's 61,480, 10 seeds).

## Gear recommendation (2026-11-15; the examples keep the owner's gear)

`efsim gear` (docs/design/gear.md "Gear from the logs") on both examples,
Arcane kept (`--keep`: her build is tuned to Intellect 472.44 just below
Will 473.50), Akekuri, Si and Estella varied: the loadouts seen at least
twice in the log fixtures and guide-site loadouts (EndfieldHub, looked up
by hand, facts only): the operator pages for
[Si](https://endfieldhub.org/characters/si) (and the [Si build
guide](https://endfieldhub.org/blog/best-si-build-arknights-endfield)),
[Akekuri](https://endfieldhub.org/characters/akekuri) and
[Estella](https://endfieldhub.org/characters/estella), and the
per-operator variants of [Best Gear Sets by
Operator](https://endfieldhub.org/database/gear-sets). None of them names
a build for this team (the Si teams post lists a Si, Estella team without
gear); Si's page says to take Type 50 Yinglung when a teammate holds
Eternal Xiranite (here Arcane). Each loadout is scored by replaying the
owner's rotation with only that operator's gear swapped, coordinate
ascent until nothing changes.

**Artifice:** the candidates are scored at full artifice; the owner's
Akekuri, Si and Estella pieces are in the examples at full artifice too
(their real artifice isn't recorded), so the tables compare gear choice
only. What artifice adds on top isn't measured here.

**The result: only Estella's gear would change, by 0.6–0.7%.** The
logs' Type 50 Yinglung Heavy Armor, Gloves T1, Radar + LYNX Slab on
Estella replays the owner's rotation at **4,019,037** (+0.7%) with full
energy and **3,283,829** (+0.6%) from zero. Every guide-site loadout
loses to the owner's, for all three. Tables (the last pass, with
Estella's new loadout; against the chosen one; "later / dropped": steps
of the owner's rotation that loadout couldn't play were started later or
dropped, a lower bound):

Akekuri (no log has her with two of the same loadout):

| Loadout | Source | Full energy | From zero |
|---|---|---|---|
| **Frontiers Protection Suit, Blight RES Gloves, Extra O2 Tube; Redeemer Seal** | the owner's | 4,019,037 | 3,283,829 |
| Frontiers Armor T3, Extra O2 Tube ×2; Eternal Xiranite Gloves | EndfieldHub Akekuri (short or multi-wave fights) | −0.4% | −8.1% (3 dropped) |
| Frontiers Protection Suit, Extra O2 Tube ×2; Eternal Xiranite Gloves | EndfieldHub Akekuri (middle option) | −0.7% | −8.3% (3 dropped) |
| Frontiers Protection Suit, Extra O2 Tube; Eternal Xiranite Gloves; Redeemer Seal | EndfieldHub Akekuri (main; no 3-piece set) | −7.9% | −6.1% |
| Frontiers Armor T1, Fiber Gloves T1, Comm; Type 50 Yinglung Radar T1 | EndfieldHub gear sets (V1) | −8.4% (2 later, 1 dropped) | −11.0% (3 dropped) |
| Type 50 Yinglung Heavy Armor T1, Gloves, Radar T1; Frontiers Comm | EndfieldHub gear sets (V2) | −12.9% (2 later, 2 dropped) | −13.5% (3 dropped) |
| Eternal Xiranite Overalls, Hands, Bracing Slab T1; Æthertech Stabilizer | EndfieldHub gear sets (V4) | −15.2% (2 later, 1 dropped) | −15.4% |

Si:

| Loadout | Source | Logs (0/1/2/3 teammates) | Full energy | From zero |
|---|---|---|---|---|
| **Type 50 Yinglung Soft Armor, Beacon ×2; Rift Trekker Gloves** | the owner's; logs | 4 (0/4/0/0) | 4,019,037 | 3,283,829 |
| Type 50 Yinglung Soft Armor, Gloves, Beacon; Redeemer Seal | logs | 11 (4/7/0/0) | −0.6% | −0.7% |
| Type 50 Yinglung Soft Armor, Gloves, Beacon; LYNX Slab (the logs' most common) | logs | 15 (2/11/2/0) | −5.9% (2 later, 5 dropped) | −16.2% (3 later, 2 dropped) |
| Type 50 Yinglung Soft Armor, Gloves, Beacon ×2 | logs | 3 (0/3/0/0) | −8.1% (2 later, 5 dropped) | −18.2% (3 later, 2 dropped) |
| Type 50 Yinglung Soft Armor, Beacon ×2; Eternal Xiranite Channeling Gloves (the same lines as Yinglung's Gloves) | EndfieldHub Si page and build guide | | −8.1% (2 later, 5 dropped) | −18.2% (3 later, 2 dropped) |
| AIC Fieldwork Plate, Hands, Ember; Eternal Xiranite Power Core | EndfieldHub Si page (Laevatain team) | | −12.0% | −15.4% |
| Eternal Xiranite MOD Armor, Channeling Gloves, Rangefinder ×2 | EndfieldHub Si page (no teammate on Eternal Xiranite) | | −13.9% (2 later, 5 dropped) | −25.0% (3 later, 2 dropped) |

Estella:

| Loadout | Source | Logs | Full energy | From zero |
|---|---|---|---|---|
| **Type 50 Yinglung Heavy Armor, Gloves T1, Radar; LYNX Slab** | logs | 2 (0/0/2/0) | 4,019,037 | 3,283,829 |
| Type 50 Yinglung Light Armor, Radar ×2; Æthertech Light Gloves | the owner's | | −0.7% | −0.6% |
| Swordmancer Fiber Armor, TAC Gloves, Micro Filter; Hot Work Power Cartridge | EndfieldHub gear sets (V2) | | −2.7% | −2.1% |
| Type 50 Yinglung Light Armor, Radar ×2; Swordmancer TAC Gauntlets | EndfieldHub Estella page (any team) | | −4.4% | −4.1% |
| Eternal Xiranite Armor, Wraps, Auxiliary Arm; Hot Work Power Cartridge | EndfieldHub gear sets (V1) | | −12.9% | −15.2% |
| Tide Fall Light Armor T1, Deepsink Gloves, Turbid Cutting Torch T1; Hot Work Power Cartridge | EndfieldHub gear sets (V3) | | −15.8% | −15.9% |
| Type 50 Yinglung Light Armor; Eternal Xiranite Gloves T1, Auxiliary Arm ×2 | EndfieldHub Estella page (Solidification teams) | | −17.7% | −16.6% |

**Searches with other gear** (`--no-macros --skeletons`, guided beams
12 / 24 / 48, as the owner's examples were found; the owner's gear run
again as the control and found the examples' rotations exactly):

| Loadouts | Full energy | From zero |
|---|---|---|
| The owner's | 3,353,446 / **3,990,122** / 3,990,122 | 2,416,632 / 2,692,055 / **3,263,818** |
| Estella on the logs' loadout | 3,332,619 / 3,336,389 / 3,394,287 | 2,701,839 / 2,701,839 / 2,979,077 |
| … and Si on the site's (Channeling Gloves, Beacon ×2) | 3,473,999 / 3,495,605 / 3,591,971 | 2,570,776 / 2,570,776 / 2,629,722 |
| … and Si on the logs' most common (Gloves, Beacon, LYNX Slab) | 3,599,060 / 3,599,060 / 3,686,748 | 2,505,458 / 2,875,337 / 2,875,337 |

Every rotation found replayed with every loadout set (full energy /
from zero; "–": Si's second ultimate lacks energy without the Rift
Trekker Gloves' Ultimate Gain):

| Rotation found with → | the owner's | Estella's | … + Si site's | … + Si logs' |
|---|---|---|---|---|
| the owner's gear | 3,990,122 / 3,263,818 | 3,360,158 / 2,943,962 | 3,488,715 / 2,541,142 | 3,463,218 / 2,707,945 |
| Estella on the logs' loadout | **4,019,037 / 3,283,829** | 3,394,287 / 2,979,077 | 3,507,300 / 2,573,251 | 3,506,418 / 2,739,264 |
| … + Si on the site's | – / – | – / – | 3,591,971 / 2,629,722 | 3,590,961 / 2,818,909 |
| … + Si on the logs' most common | – / – | – / – | 3,683,829 / 2,683,173 | 3,686,748 / 2,875,337 |

- **Estella:** the logs' loadout beats the owner's on every rotation
  (+0.5% to +1.3%): a real if small gain, though no search with it found
  the owner's rotation (−15% / −9% by the same search: the search is
  chaotic for this team, a small change in a build sends it elsewhere).
  The proof is the owner's rotation itself played with it.
- **Si:** on the owner's rotation her Rift Trekker Gloves win: their
  Ultimate Gain brings her second ultimate (49.2 s) on time, which the
  best rotation needs. On the rotations found with other gear, where her
  ultimates come later anyway, the logs' LYNX Slab loadout is 4.3–5.1%
  better than the owner's gloves and the site's pick 2.2–2.9% better;
  but no rotation found for them reaches the owner's (best 3,686,748 /
  2,875,337). Whether a rotation built for the LYNX Slab loadout can
  beat 3.99M is open (a wider search, or one seeded with the owner's
  rotation).
- **Akekuri:** the owner's Frontiers set wins; the site's Frontiers
  variants lose 0.4–0.7% with full energy and 8% from zero (three steps
  dropped: a lower bound).
- **The sites against the logs:** for Si the site's pick (Channeling
  Gloves for Yinglung's Gloves, the same stat lines) is below the logs'
  most common LYNX Slab variant on every rotation (−2.0% to −2.6%
  where both play); for Estella the logs' loadout beats every site pick
  (2.1–17.7%); Akekuri has no common log loadout.

## Payoffs and chains (2026-11-15)

`efsim payoffs` (docs/design/search.md "Payoffs and chains"), 122 chains. With
Akekuri in slot 1 every top chain is the owner's basic rotation: a Heat
battle skill (Si's or Akekuri's), Arcane's combo adding Heat, Estella's
battle skill (Cryo: Solidification) opening Si's and Estella's combos.
Best by damage: Si's battle skill → Arcane's combo → Estella's battle skill
→ Si's and Estella's combos, 358,305 in 2.4 s (874,844 merged with
ultimates as setups and fillers); from Akekuri's battle skill 311,663 in
2.5 s. Only in WILL mode: in INT mode Arcane's combo adds no infliction
and opens only on a Nature reaction or two stacks of another element.

## Where the damage comes from (sonnet, 2026-11-14; the INT build with Estella in slot 1)

Si 59.8%, Estella 25.6%, Arcane 9.5%, Akekuri 5.1%. Si's combo 25.6% and
her Inksoul burst (Artful Intent's end) 14.9%; Shatter 4.5%, Si's
Solidification hits 3.0%, Estella's plunging hits 4.3%, Lift 1.8%,
Arcane's bursts 1.7%. 40% of the damage falls inside one Corrosion window
(Arcane's, 2.67–17.67 s).

## What would move the total most

| # | Mechanic | Touches | Status | What verifies it |
|---|---|---|---|---|
| 1 | Si's Artful Intent, combo stack count | ~40% | logs fit Si +0.8% in ad7f; 14% mean over 21 logs | test 10; Si diagnosis (running) |
| 2 | Freezes on a boss holding Si's timers | ~15% | since 2026-11-13: a freeze on a boss holds the freezer's own debuffs (Artful Intent ends fit to ~10 ms) | test 104 |
| 3 | Corrosion's shred under freezes | up to 40% | A28–A35 settled; under freezes open | test 37 |
| 4 | Solidification's length, Shatter | ~10% | length [OPEN] | test 71 (needs Alesh), test 11 |
| 5 | Akekuri's Link and the team's SP | cast count | Link not in any log; SP not logged | test 57, test 102 |

## Logs with these operators

Si and Arcane together: 24 non-hold-out logs; ad7f (Arcane, Alesh, Si,
Estella, Tower 4) fits within ~1% for Arcane and Si. Estella: 6 logs
(engine low in the recent three: −8 / −12 / −24%, being diagnosed).
Akekuri: 3 (012a ×0.85–0.89 constant, being diagnosed; 458b fits; 5d1a
multi-target). No log has Estella with Akekuri; Akekuri's five logs with
Si fail the level-90 rule (she or Wulfgard at 80).

## Diagnoses (2026-11-14)

- **Si (sonnet, 21 logs):** her Artful Intent burst is exactly rate × the
  sum of every logged hit in its window (0.13 at P0, 0.20 from P1; within
  0.5% in ~24 of 38 windows) but the log check can't value it yet (42
  hits, ~13M): being implemented. Teammates' enemy debuffs counted ×4
  where the logs show one (Arcane's Solemn Phalanx will_susc / will_burst
  in 7b54 and 6339, Ardelia's weapon in 4e36, Xaihi's crystal Amp in
  c3c7): being fixed. Log-wide offsets in 0c14 and 9555 (known).
- **Arcane (sonnet):** most of her mismatches are multi-target logs (the
  engine has one enemy); a7a7's INT finisher lasers ×1.65 (INT only, not
  the owner's WILL build); the weapon-debuff timing above.
- **Estella, Akekuri (haiku):** her Physical Susceptibility value right
  (0.15), a later window missed in 4e5e; all 12 logged combos with a
  Shatter (test 11 unseen); Akekuri's Link and SP not in the logs; 012a
  ×0.85–0.89 constant (being checked). Estella low in the recent logs:
  being diagnosed.

## Fixes for this team (2026-11-14)

- Estella: OBJ Razorhorn's ATK on the Shattering hit (a27b, ad7f). The
  owner's Estella uses JET (wpn_lance_0011): checked on two Avywenna logs
  (7193, cfa6): values (0.336 at L9) and stacking right, buffs on the
  wielder only. Estella is Physical: JET's Arts DMG reaches only her battle
  skill's Cryo projectile (and maybe her Arts reaction hits); the rest is
  its attribute and ATK% lines. Same rotation, each fully upgraded: Valiant
  4,887,240 (+3.0%), Razorhorn 4,773,350 (+0.6%), JET 4,747,062 (a fair
  comparison re-searches the rotation per weapon). Thermite Cutter on
  Akekuri is worth ~+0.74M against the stand-in sword (team ATK).
- Akekuri: Thermite Cutter (hers) gains layers only from the wielder's
  own Link and SP, not a teammate's Link (012a, 82735, d4fb).
- Si: the log check values her Inksoul burst (34 of 40 fit).
- The log check no longer adds Ardelia's Susceptibilities twice (hold-out
  plain 44.4 → 61.5%).
