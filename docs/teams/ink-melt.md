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

## Gear from the logs and guide sites (2026-11-15)

The gear above was a template assumption (each operator's most common
loadout overall). `efsim gear` (docs/design.md "Gear from the logs"), as
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
  table's chains as one choice each; design.md "Payoffs and chains"), as
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
