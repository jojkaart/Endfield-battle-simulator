# Ink Melt (Laevatain, Si, Wulfgard, Ardelia)

EndfieldHub's top-rated team (2026-11-05 list: 53,914 single-target team
DPS in their model), simulated under exactly the assumptions of the owner's
team ([estella-si-akekuri-arcane.md](estella-si-akekuri-arcane.md)):
Rhodagn Lv90, 60 s, expected crits, with full ultimate energy at the start
and from zero. Examples:
[ink-melt.scenario.json](../../examples/ink-melt.scenario.json),
[ink-melt-zero.scenario.json](../../examples/ink-melt-zero.scenario.json).

## Builds

All P0, level 90, skills 12, signature weapons at level 90 with skills
[9, 9, 4], full artifice; gear from `efsim gear` (below; base versions):

| Slot | Operator | Weapon | Gear |
|---|---|---|---|
| 1 | Laevatain | Forgeborn Scathe | Hot Work Exo-Rig, Gauntlets, Pyrometer; LYNX Slab |
| 2 | Si | Jade Vessel | Type 50 Yinglung Soft Armor, Gloves, Beacon; LYNX Slab |
| 3 | Wulfgard | Rational Farewell | Hot Work Exoskeleton, Power Bank ×2; Bonekrusha Wristband (until 2026-11-15: Hot Work Gloves) |
| 4 | Ardelia | Dreams of the Starry Beach | Hot Work Exo-Rig, Hands PPE, Insulation Slab; LYNX Slab |

Laevatain in slot 1 turns Si's infliction to Heat and gives Laevatain her
combo cooldown cut. Si's ultimate gives the team Cryo and Heat Amp
whatever her battle skill does.

## Gear played by the rules (2026-11-16; the example keeps its gear)

`efsim diagnose` and `efsim gear --rules` (docs/design/rules.md "Diagnosis,
marginal values, gear on rules"): the rule list below played over 300 s
on common seeds (8, more for noisy gains).

**What's inefficient:**

- Wulfgard's ultimate is the bottleneck: one Ultimate Gain Efficiency
  line on him is worth +6.6% ± 1.5 (16 seeds), five times his best damage
  line (main attribute +26.9%: +1.3%). His ultimate's buffs drive
  Laevatain, who deals 62% of the damage.
- Laevatain's own efficiency is worth less than nothing (−3.1% ± 1.1):
  her ultimate would come sooner but at worse moments for this list; her
  best lines are main attribute (+10.5% for +26.9%), Heat DMG (+6.7%) and
  DMG to Staggered (+5.8%). Si's efficiency likewise (−3.4% ± 1.1).
- Ardelia's ultimate is never cast (the list leaves it out on purpose:
  the search found it worth nothing), so her energy all overflows; it
  costs nothing but means her Ultimate Gain lines are dead weight.
- Wulfgard's combo is lit but unused 51 s of 300 (17%), Laevatain's 27 s.
- Team SP never reaches the cap.

**What to change:** Wulfgard's Bonekrusha Wristband → LYNX Gloves (an
Ultimate Gain Efficiency line for his Wristband's damage lines): his
ultimates go from 0.80 to 1.00 a minute, Laevatain's energy wasted at a
full bar from 8.8% to 5.4%. **+3.9% ± 1.0** on 24 fresh seeds (66,418 →
69,007; +2.1% ± 2.5 on 8 others, +7.3% ± 2.4 in the ascent, which is
biased up by choosing the best of many). Nothing else beyond the noise
(Si, Laevatain and Ardelia keep the logs' most common loadouts). The
rule-played gain is for a long fight; the example's 60 s timeline,
replayed with the LYNX Gloves, is 1.5% lower (4,661,951 against
4,732,088: it was searched with the Wristband, and full energy at the
start makes Wulfgard's efficiency worth less), so the example keeps the
Wristband. The earlier timeline-based choice (Hot Work Gloves →
Bonekrusha Wristband, +0.9%) is the opposite trade for the opposite
reason. 1,000 runs, 18 min on 3 workers.

## Gear from the logs and guide sites (2026-11-15)

The gear above was a template assumption (each operator's most common
loadout overall). `efsim gear` (docs/design/gear.md "Gear from the logs"), as
for the Typhoeus team: per operator the loadouts seen at least twice in
the log fixtures (hold-outs left out), counted by how many of the team's
other three the log has, and guide-site loadouts (EndfieldHub, looked up
by hand, facts only): the operator pages for
[Laevatain](https://endfieldhub.org/characters/laevatain),
[Si](https://endfieldhub.org/characters/si) (with a build for this very
team), [Wulfgard](https://endfieldhub.org/characters/wulfgard) (Laevatain
teams, by potential) and [Ardelia](https://endfieldhub.org/characters/ardelia),
the [Si build guide](https://endfieldhub.org/blog/best-si-build-arknights-endfield)
and the per-operator variants of [Best Gear Sets by
Operator](https://endfieldhub.org/database/gear-sets) (not tied to a
team); the [Si teams post](https://endfieldhub.org/blog/si-best-teams-arknights-endfield)
lists this team but no gear for it. Each scored by replaying the team's
example rotation with only that operator's gear swapped (pieces at full
artifice), coordinate ascent until nothing changes. Tables: the last
pass, full energy / from zero, against the chosen loadout.

Laevatain:

| Loadout | Source | Logs (0/1/2/3 teammates) | Full energy | From zero |
|---|---|---|---|---|
| **Hot Work Exo-Rig, Gauntlets, Pyrometer; LYNX Slab** (the logs' most common) | logs; EndfieldHub Laevatain (single target / boss) | 9 (1/4/4/0) | 4,732,088 | 4,642,409 |
| Hot Work Exoskeleton, Gauntlets, Pyrometer; LYNX Slab | EndfieldHub Laevatain (3+ enemies, with Gilberta) | | −5.3% | −5.1% |
| Hot Work Exo-Rig, Gauntlets, Pyrometer; Type 50 Yinglung Knife T1 | EndfieldHub gear sets (V1) | | −6.1% | −6.0% |
| Redeemer Armor; Hot Work Gauntlets, Pyrometer ×2 | logs; EndfieldHub Laevatain (2+ enemies) | 6 (1/3/2/0) | −7.2% | −7.2% |
| Tide Fall Light Armor; Hot Work Gauntlets, Pyrometer ×2 | logs | 2 (0/0/2/0) | −7.5% | −7.6% |
| Tide Fall Light Armor, Deepsink Gloves, Turbid Cutting Torch; Eternal Xiranite Rangefinder | EndfieldHub gear sets (V3) | | −11.3% | −15.0% |
| Redeemer Armor, Seal ×2; Eternal Xiranite Gloves | EndfieldHub Laevatain (full AoE) | | −23.2% | −23.2% |

Si:

| Loadout | Source | Logs | Full energy | From zero |
|---|---|---|---|---|
| **Type 50 Yinglung Soft Armor, Gloves, Beacon; LYNX Slab** (the logs' most common) | logs | 15 (7/5/3/0) | 4,732,088 | 4,642,409 |
| Type 50 Yinglung Soft Armor, Gloves, Beacon ×2 | logs | 3 (2/1/0/0) | −0.8% | −1.1% |
| Type 50 Yinglung Soft Armor, Beacon ×2; Eternal Xiranite Channeling Gloves (the same lines as Yinglung's Gloves) | EndfieldHub Si page and build guide (a teammate on Eternal Xiranite) | | −0.8% | −1.1% |
| Type 50 Yinglung Soft Armor, Beacon ×2; Rift Trekker Gloves | logs | 4 (2/0/2/0) | −2.5% | −2.9% |
| Type 50 Yinglung Soft Armor, Gloves, Beacon; Redeemer Seal | logs | 11 (7/2/2/0) | −2.8% | −3.3% |
| Eternal Xiranite MOD Armor, Channeling Gloves, Rangefinder ×2 | EndfieldHub Si page (no teammate on Eternal Xiranite) | | −3.2% | −3.6% |
| AIC Fieldwork Plate, Hands, Ember; Eternal Xiranite Power Core | EndfieldHub Si page (**this team**: Ultimate Gain) | | −10.4% | −11.4% |

Wulfgard (P0 here; few logs):

| Loadout | Source | Logs | Full energy | From zero |
|---|---|---|---|---|
| **Hot Work Exoskeleton, Power Bank ×2; Bonekrusha Wristband** | EndfieldHub Wulfgard (Laevatain teams, P0) | | 4,732,088 | 4,642,409 |
| Hot Work Exoskeleton, Gloves, Power Bank ×2 (the logs' most common; the example's until now) | logs | 2 (0/1/1/0) | −0.9% | −0.9% |
| Hot Work Exoskeleton, Gloves, Power Bank; Eternal Xiranite Heavy Slab | EndfieldHub gear sets (V2) | | −1.7% | −1.5% |
| Hot Work Exoskeleton, Pyrometer ×2; MI Security Gloves | logs | 2 (0/2/0/0) | −2.6% | −2.9% |
| Qingbo Heavy Armor, Gauntlets, Bamboo Cutter; Æthertech Watch | EndfieldHub gear sets (V1) | | −2.6% | −2.0% |
| Type 50 Yinglung Heavy Armor T1; LYNX Gloves; Æthertech Watch ×2 | EndfieldHub Wulfgard (Laevatain teams, P5 with OBJ) | | −4.0% | −3.2% |
| Type 50 Yinglung Heavy Armor T1; LYNX Gloves; Æthertech Watch; Eternal Xiranite Power Core | EndfieldHub Wulfgard (Laevatain teams, P5) | | −4.6% | −3.4% |

Ardelia:

| Loadout | Source | Logs | Full energy | From zero |
|---|---|---|---|---|
| **Hot Work Exo-Rig, Hands PPE, Insulation Slab; LYNX Slab** (the logs' most common) | logs | 2 (2/0/0/0) | 4,732,088 | 4,642,409 |
| Hot Work Exo-Rig, Gauntlets T1, Insulation Slab; Turbid Cutting Torch T1 | EndfieldHub gear sets (V3) | | −0.1% | −0.1% |
| Eternal Xiranite Armor, Gloves T1, Power Core T1; Hot Work Power Cartridge | EndfieldHub Ardelia (P4) | | −2.3% | −2.0% |
| Eternal Xiranite Armor, Gloves T1, Auxiliary Arm; Hot Work Power Cartridge | EndfieldHub Ardelia (more Arts Intensity) | | −2.3% | −2.0% |
| Eternal Xiranite Armor, Wraps, Auxiliary Arm; Hot Work Power Cartridge | EndfieldHub gear sets (V1) | | −2.3% | −2.1% |
| Eternal Xiranite Armor, Gloves T1, Power Core T1, Auxiliary Arm | EndfieldHub Ardelia (generic) | | −2.5% | −2.6% |
| Bonekrusha Poncho T1; Eternal Xiranite Gloves T1, Auxiliary Arm ×2 | EndfieldHub Ardelia (full energy) | | −2.9% | −3.2% |
| LYNX Cuirass, Gauntlets, Slab; Eternal Xiranite Power Core T1 | EndfieldHub gear sets (V2) | | −3.8% | −4.7% |
| Qingbo Light Armor; Catastrophe Gloves, Filter ×2 | logs | 2 (0/0/2/0) | −25.9% (without 15 steps) | −4.2% |
| Catastrophe Heavy Armor T1, Gauze Cartridge T1, Filter; Hot Work Gloves | logs | 2 (2/0/0/0) | −26.6% (without 15 steps) | −5.2% |

- **The sites against the logs:** for Laevatain the site's single-target
  pick is the logs' most common and wins; its multi-target ones lose
  5–23%. For Si the site's build for this team (AIC Fieldwork, for
  Ultimate Gain) loses 10–11% on a replay, and its general pick (Yinglung
  with Channeling Gloves) 0.8–1.1% against the logs' LYNX Slab variant.
  For Wulfgard the site's P0 pick for Laevatain teams (a Bonekrusha
  Wristband for Hot Work Gloves) beats the logs' Hot Work ×4 by 0.9%
  with both energies: the only change. For Ardelia the logs' Hot Work +
  LYNX Slab beats every site pick (Eternal Xiranite ones by 2–3%).
- Replays favour the gear the rotation was searched with: a loadout whose
  worth is earlier ultimates (Si's AIC Fieldwork, Ultimate Gain) can't show
  it on a fixed rotation, so its −10% is a lower bound.
- "Without 15 steps": the rotation couldn't be played with that loadout
  (Stagger and combo windows move), so it's the replay without the steps
  it couldn't play: a loose lower bound.

## Results (2026-11-15; lower bounds)

| | Ink Melt | The owner's team |
|---|---|---|
| Full energy, 60 s | **4,732,088** (78,868 DPS; 4,689,365 with Hot Work Gloves on Wulfgard) | 3,990,122 (66,502 DPS) |
| From zero, 60 s | **4,642,409** (77,373 DPS; 4,601,305 before) | 3,263,818 (54,427 DPS) |

- Both from `efsim search` with macros (phase 3, 2026-11-15: the payoff
  table's chains as one choice each; design/search.md "Payoffs and chains"), as
  is the owner's team's with full energy (from zero: with skeletons).
- With the new gear (Wulfgard's Bonekrusha Wristband) the same rotations
  replayed: the examples' totals above. Searched again with it (guided
  beams 12 / 24 / 48, both energies, every mode the team was searched
  in), nothing found more:

  | Mode | Full energy | From zero |
  |---|---|---|
  | macros (default) | 4,523,613 / 4,661,815 / 4,661,815 (5.6 ks) | 1,870,788 / 4,362,875 / **4,642,409** (3.8 ks; the example's rotation again) |
  | `--no-macros --skeletons` | 3,546,866 / 3,553,619 / 4,383,228 (2.6 ks) | 2,281,692 / 3,778,592 / 3,949,362 (1.9 ks) |
  | `--no-macros` | 3,546,866 / 3,553,619 / 4,383,228 (1.5 ks) | 1,829,207 / 3,025,595 / 3,949,362 (1.0 ks) |

  (Wall times with four to six searches and another session's log checks
  sharing four cores.) With full energy the replay of the old rotation
  (4,732,088) beats every search with the new gear by 1.5%: the search
  is chaotic for this team, a small change in the team moves it to
  other rotations.
- Shares, full energy: Laevatain 57.6%, Si 25.8%, Wulfgard 9.7%, Ardelia
  6.9%. From zero: Laevatain 55.4%, Si 29.1%, Ardelia 7.9%, Wulfgard 7.6%.
- Ultimates, full energy: Si, Ardelia, Wulfgard at 0 s, Laevatain at
  0.13 s and again at 48.6 s. From zero: Laevatain and Si at 45.5 s;
  Wulfgard's and Ardelia's don't come within 60 s.
- Crit spread: full energy sd 51,794 (1.1%), 5–95% ≈ 4.66–4.83M; zero sd
  51,036 (1.1%), 5–95% ≈ 4.57–4.74M.
- **The search is far from converged for this team.** With the old gear, full energy: beams
  12/24/48 gave 4.48 / 4.62 / 4.69M with macros, 3.50 / 3.50 / 4.41M
  without (an unguided 24/48/96 run without them found only 3.53M);
  zero: 1.82 / 4.32 / 4.60M with macros, 1.80 / 2.99 / 3.84M without
  (24/48/96: 1.80 / 3.81 / 3.89M). Both teams' numbers are lower bounds,
  Ink Melt's looser.

### Rules: what to play (2026-11-16)

A rotation to learn rather than a timeline (docs/design/rules.md "Rule-based
rotations"; [examples/ink-melt.rules.json](../../examples/ink-melt.rules.json),
`efsim rules`). Laevatain controlled, no swaps. Start with **Si's battle
skill, then Laevatain's battle skill**; then at every moment do the first
of these that applies:

1. When Laevatain's ultimate is ready: Laevatain's ultimate.
2. When Wulfgard's ultimate is ready: Wulfgard's ultimate.
3. When Si's ultimate is ready and Laevatain is in Twilight (or her
   ultimate is ready): Si's ultimate.
4. When Laevatain's combo lights up: Si's battle skill, then Laevatain's
   combo.
5. When Si's combo lights up: Si's combo.
6. When Wulfgard's combo lights up: Ardelia's battle skill, then
   Wulfgard's combo.
7. When Ardelia's combo lights up: Si's battle skill, then Ardelia's
   combo.
8. When Laevatain is in Twilight: Laevatain's battle skill.
9. When the SP bar is at 150 (one and a half battle skills): Laevatain's
   battle skill.

Otherwise Laevatain's basic attacks. Ardelia's ultimate isn't cast.
Learnability: 2 opener presses, 9 rules (12 presses), cue cost 32,
complexity 46; the hardest cues are the three "ultimate ready" ones
(rank 4).

| Simulated player, 0.3 s reaction ± 50%, 32 fresh seeds (1001–1032; the fixed driver, 2026-11-16) | Full energy | From zero |
|---|---|---|
| Sustained DPS over 300 s (sd over seeds) | **59,140** (3,554) | **54,421** (1,930) |
| As a bot (0 s) / at 0.6 s | 70,347 / 66,655 | 66,705 / 60,522 |
| First 60 s against the 60 s timeline (the examples) | 3,454,357 against 4,732,088 (−27.0%) | 2,506,673 against 4,642,409 (−46.0%) |
| 300 s total against a fixed 300 s search (beam 6, full energy, 36 min) | 20,900,414 against 16,406,168 (**+27.4%**) | |

**The engine changes of 2026-11-18 (in-game tests 110 and 108 from the logs; same seeds):** a Stagger lasts about 2 s past its data: 63,347 → 62,424 / 56,123 → 57,486 (−1.5% / +2.4%, within the noise); Laevatain no longer Finishers during Twilight (the logs: 7 Staggers with her Twilight chain, no Finisher), which the rules had her do: → **59,140 / 54,421** (−5.3% / −5.3%). As a bot / at 0.6 s now 57,300 / 58,479 (full energy).

**The engine changes of 2026-11-16 (in-game tests 104, 19, 101 from the logs; same seeds 1001–1032):** bosses
freeze 69,668 → 69,698 / 61,716 → 62,331; Haste no longer speeds casts
→ 61,255 / 57,302 (−12.1% / −8.1%: Laevatain's Twilight chain lost Si's
Haste, which the logs say never sped it: her steps under it 1.009× as far
apart); teammates' pause 6.5 s → **63,347 / 56,123** (+3.4% / −2.1%). The
other rows are from before; the 60 s timelines no longer play: the
full-energy one repaired (3,953,129, 8 steps dropped; a beam-24 search
found 3,798,722), the zero-energy one re-searched at beam 24 (2,838,088):
lower bounds until a full re-search. As a bot / at 0.6 s now 65,484 /
62,233. (Test 18's alternative then, her own stop holding Twilight: 61,928.)

**Twilight held by her own stop (2026-11-18, in-game tests 18 and 21 from the logs; same seeds
1001–1032, on top of the numbers above):** a buff created inside a running time stop is now held by
the rest of it (engine assumption `buff-in-stop`;
[journal](../journal/2026-11-18-03-typhoeus-s-and-laevatain-s-in-game-tests-from-the-logs-buffs.md)), so
Twilight and show_weapon last 2 s longer after her ultimate. Sustained DPS 59,140 → **59,662** (+0.9%;
sd 3,591) at full energy, 54,421 → **59,097** (+8.6%; sd 1,672) from zero; as a bot / at 0.6 s 51,962 /
59,616 (full energy). A longer Twilight is more enhanced attacks, but it also blocks her energy and
starts her ultimate's cooldown later, which costs a full start more than a zero one. The 60 s timeline
repaired (Laevatain's steps in the extra 2 s as their Twilight forms): 3,990,549 → **3,414,967**; its
second ultimate (48.6 s) no longer fits in 60 s, a lower bound until a re-search. `--assume
buff-in-stop=runs` gives the earlier reading.

**Twilight's remaining excess in the logs (2026-11-22):** not Twilight's own (her Forgeborn buff from the
same ultimate runs as far past the replay: open-problems "Laevatain's Twilight runs longer than its
model"), so the kit keeps the data's length and the numbers above stand. What rides on it: kit
assumption `laevatain-twilight-clock=forgeborn` (Twilight and show_weapon 1.8 s longer) gives 61,930
(**+3.80% ± 1.30**, paired seeds, full energy; `efsim rules … --assumptions`).

The 10-seed numbers of 2026-11-16 before the driver's fixes (seeds 1–10) are superseded by these (design/rules.md "Rule-based rotations": a stale SP check delayed SP-gated presses).

**Re-tuned for the fixed driver? No change found (2026-11-16).** The fix
made this list +5.0% ± 1.0 at full energy and −2.4% ± 1.2 from zero (32
fresh seeds, paired against the old driver): Si's and Ardelia's
SP-gated presses now come when the SP is there, which helps a full start
and spends SP sooner from zero. To win back the zero start:
- the guided search with the zero-energy start judged as well (38 edits,
  2 rounds, 4 min) kept nothing: every directed edit lost at full energy
  on the screening seeds, the best by −1.1% (rule 9 with `shows`);
- the guided search led by the zero start, judged on full energy too (40
  edits, 7 min): its best, Si's ultimate waiting for Combustion, gained
  +1.17% ± 1.16 from zero (noise) and lost −6.6% ± 1.3 at full energy;
- a short rule search (60 lists, 180 s fights, 3 seeds): its best only
  dropped the opener and played 68,388 against the list's 72,249 on the
  same 10 seeds.

The list stays as it is.

**Si's ultimate waits for Twilight (2026-11-16).** The owner asked about
a one-off surge around 80 s in the rules' damage graph. In that window
Laevatain's Twilight battle skill hit for 78–96k instead of 32k: Si's
ultimate's Heat Amp (×1.36), a Stagger (×1.3) and Wulfgard's and
Ardelia's debuffs had lined up on Twilight by chance; the other Twilights
got one of them or none. The damage itself is the model working (the
multipliers are each log-checked); the list just had no rule lining them
up, and the rule search never tries a condition on another operator's
state. Holding Si's ultimate for Twilight: 68,609 against 65,922 (+4.1%,
same seeds); also holding Wulfgard's adds nothing (68,723) and makes
0.6 s reactions cost 14%; holding Laevatain's ultimate for a Stagger
loses (60,142); saving SP for Twilight battle skills changes nothing
(65,909) or loses (61,860). The previous list: 65,922 / 61,962.

**The guided search (2026-11-16; `efsim rules --guided`, design/rules.md "The
guided rule search").** Its ideal combos: Laevatain's Twilight attacks
are the biggest window (14,377 DPS of 67,357, always in Twilight), at 55%
of their ideal; they miss Stagger (on 29% of their damage: −3,052 DPS if
on all) and Si's Amp (on 74% with the Twilight hold: −1,363); Si's
combos miss her own Amp (on 38%: −1,619). The team gets 53% of its
windows' ideal combos. On the example, 38 edits over two rounds (12 min)
kept nothing. Checked further by hand:

- **Rule 7 with "only if Si's button shows her battle skill"** (so
  Ardelia's combo waits while Artful Intent is up, as the owner's team's
  rule 9 does for Si): +1.52% ± 1.42 on the search's seeds 1–32, but
  +3.93% ± 0.77 and +2.54% ± 0.86 on 64 fresh seeds each, and from zero
  energy −3.27% ± 1.26 (32 seeds): a full-energy option, not taken (from
  zero the skipped combos' energy is missed early). From the list before
  the Twilight hold the search found it and kept it (+3.10% ± 1.02).
- **The Twilight hold (rule 3) measures about nothing**: the example
  against the list without it on 64 fresh seeds, −0.11% ± 0.71; the
  +4.1% above was measured on 10 seeds, within their noise. Kept (it
  costs nothing), but it isn't the gain it looked like.
- Holding Si's ultimate for her combo, Ardelia's battle skill for
  Twilight or Combustion, Laevatain's ultimate for a Stagger: all lose
  (−2% to −20%).

- **Found by the rule search**, from a hand-written list (ultimates when
  ready, every combo when it lights up, Laevatain's battle skill in
  Twilight and from 100 SP, Si's from 200): 51,674 → 66,058 (old delay draws; +28%, well
  beyond the seeds' spread), two runs (150 lists, then 200 from the
  first's best) and rules that never fired removed. What it found:
  pre-empt Laevatain's and Ardelia's combos with Si's battle skill (Si's
  Heat infliction before the combos' hits, and her strokes after),
  Wulfgard's with Ardelia's, keep 150 SP before Laevatain's own battle
  skill, and leave Ardelia's ultimate out.
- **The gap to the 60 s timeline** is large (−25% / −46%): the timeline
  plans Laevatain's Melting Flame and empowered battle skill, Si's
  strokes and the ultimates to the frame within 60 s, which no visible
  cue says (Melting Flame isn't among the cues the owner listed); from
  zero the rules spend SP as it comes and build energy slowly. Over a
  long fight the fixed 300 s search is the sustained reference, and the
  rules beat it by 21% (row above): a beam of 6 can't plan 300 s well.

## Kit checks behind these numbers (2026-11-15)

- Wulfgard: kit and weapons fit the logs once the export's missing build
  values are set (weapon levels, nodes).
- Ardelia: kit fits; her large log errors were the replay (one ultimate
  placed as several casts) and two fixtures' builds. Her ultimate applies
  no Susceptibility.
- Si: the combo's consumed buffs now act on hits that land late; her Amp
  values and windows fit the damage; Heat inflictions with Laevatain in
  slot 1 match.
- Combustion: the snapshot now includes the buffs its application
  creates, and its own hit takes the new ATK but not the new DMG bonuses
  (exact in c7790).
- Open (docs/open-problems.md): Combustion re-snapshots mid-run (458b,
  db87), Laevatain's Hot Work ending 2–5 s early in 79cc / f879 (buff
  timing report), Laevatain ×1.3 under her sword buff in db87.

## EndfieldHub's numbers are not comparable

Their 53,914 is a spreadsheet model: a fixed 60 s rotation (1 ultimate, 3
battle skills, combos on cooldown, 3 basic chains each), no enemy DEF or
resistance (our Rhodagn's 100 DEF halves every hit), no gear, support
buffs assumed aligned with the carry's ultimate, no animation time.
Their ranking and ours agree that Ink Melt is strong; the absolute numbers
don't compare.
