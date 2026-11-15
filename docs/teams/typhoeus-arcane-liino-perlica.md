# Typhoeus, Arcane (WILL), Liino, Perlica (2026-11-15)

The owner asked for this team next to the other two, under the same
conditions: Rhodagn Lv90, 60 s, expected crits, with full ultimate energy at
the start and from zero. Examples:
[typhoeus-arcane-liino-perlica.scenario.json](../../examples/typhoeus-arcane-liino-perlica.scenario.json),
[typhoeus-arcane-liino-perlica-zero.scenario.json](../../examples/typhoeus-arcane-liino-perlica-zero.scenario.json).

## Builds

The owner gave no builds. Ink Melt's assumptions: level 90, skills 12,
weapons at level 90, full artifice; 6-stars P0 with their signature weapon
at [9, 9, 4]. Perlica is a 5-star with no 6-star signature: P5 (the
roadmap's rule for 4- and 5-stars, the template's default, and every log
of her) with the weapon she runs in this team's logs, Stanza of
Memorials (5-star), fully refined [9, 9, 9]. Arcane is the owner's build
from the owner's team (WILL mode: Intellect 472.44 / Will 473.50, both
accessories' Intellect line at 0). Gear: `efsim gear` (below).

| Operator | Weapon | Gear |
|---|---|---|
| Typhoeus | Umbra of Frigid Eventide | Deep Rampart Armor, Gauntlets, Comms; Qingbo Bamboo Cutter |
| Arcane | Type 42: Solemn Phalanx | Eternal Xiranite Light Armor, Wraps, Auxiliary Arm ×2 (the owner's) |
| Liino | Bedazzling Night Debut | LYNX Gauntlets T1, LYNX Slab ×2; Eternal Xiranite Light Armor |
| Perlica (P5) | Stanza of Memorials | Pulser Labs Disruptor Suit, Gloves, Probe; Hot Work Power Cartridge |

**Team order** doesn't matter: no kit of this team (nor its gear or
weapons) reads team slots (only Si's does), so tests/team-order.test.ts
checks every order gives the same hits.

**Controlled operator: Typhoeus.** The payoff table's basic-chain
ceilings: Typhoeus 537,961 (her aerial basic attacks while hovering,
which only the controlled operator gets: the hovering combo slot is made
only for her controlled), Perlica 48,512, Liino 40,297, Arcane 34,720.
Her Final Strikes also open Perlica's combo (the controlled operator's
Final Strike).

## Gear from the logs and guide sites

`efsim gear` (docs/design.md "Gear from the logs"): per operator the
loadouts seen at least twice in the log fixtures (hold-outs left out),
counted by how many of the team's other three the log has; the loadouts
of the screened ZMDLogs exports not imported (counts in brackets: with
0/1/2/3 teammates); and guide-site loadouts (EndfieldHub, looked up by
hand, facts only): [Typhoeus build guide](https://endfieldhub.org/blog/typhoeus-build-guide-weapons-gear-teams-endfield)
(single and multi-target), [Typhoeus best teams](https://endfieldhub.org/blog/typhoeus-best-teams-who-to-pair-endfield)
(Perlica's and Liino's in Typhoeus teams with Arcane), [Liino, Zhuang
Fangyi, Arcane & Perlica team guide](https://endfieldhub.org/blog/liino-zhuang-arcane-perlica-team).
Each scored by replaying the team's rotation with only that operator's
gear swapped; coordinate ascent until nothing changes; run on the
beam-12 rotations of both start energies, then again on the rotations
searched with the chosen gear (tables below: the last, full energy /
from zero, against the chosen loadout).

Typhoeus (logs: 19 battles with her, 11 with the Deep Rampart ×4 loadout):

| Loadout | Source | Logs (0/1/2/3 teammates) | Full energy | From zero |
|---|---|---|---|---|
| **Deep Rampart Armor, Gauntlets, Comms; Qingbo Bamboo Cutter** | EndfieldHub build guide (multi-target) | | 5,472,033 | 3,932,836 (−0.0%) |
| Deep Rampart Armor, Gauntlets, Comms; LYNX Slab | logs | 7 (0/0/7/0) | −0.1% | 3,932,887 |
| Deep Rampart Armor, Gauntlets, Comms ×2 (the logs' most common, with the team too) | logs; exports 2 (0/0/0/2) | 8 (0/0/6/2) | −2.0% | −2.1% |
| Bonekrusha Poncho T1; Deep Rampart Gauntlets, Comms ×2 | EndfieldHub build guide (single target) | | −6.8% | −6.5% |

Liino (29 battles):

| Loadout | Source | Logs | Full energy | From zero |
|---|---|---|---|---|
| **LYNX Gauntlets T1, Slab ×2; Eternal Xiranite Light Armor** (the logs' most common, with the team too) | logs; EndfieldHub best teams (Typhoeus, Arcane, Ardelia, Liino); exports 1 | 5 (1/1/3/0) | 5,472,033 | 3,932,887 |
| Eternal Xiranite Light Armor, Hands, Bracing Slab T1; LYNX Slab | logs | 2 (0/1/0/1) | −2.7% | −2.2% |
| Eternal Xiranite Light Armor, Hands, Auxiliary Arm; LYNX Slab | logs | 3 (0/1/1/1) | −2.7% | −2.3% |
| Eternal Xiranite Light Armor, Auxiliary Arm; LYNX Gauntlets T1, Slab | EndfieldHub best teams (faster-rotation variant) | | −3.4% | −2.5% |
| LYNX Cuirass T1, Gauntlets T1, Slab; Eternal Xiranite Auxiliary Arm | logs | 2 (0/0/2/0) | −4.1% | −2.9% |
| Eternal Xiranite Light Armor, Bracing Slab T1 ×2; LYNX Gauntlets T1 | logs | 2 (0/0/2/0) | −6.0% | −4.6% |
| LYNX Gauntlets T1, Aegis Injector ×2; Rift Trekker Light Armor | EndfieldHub (Liino, Zhuang Fangyi, Arcane, Perlica) | | −6.0% | −15.1% (searched) |
| Catastrophe Heavy Armor T1, Gloves, Filter; LYNX Slab | logs | 2 (0/0/2/0) | −11.6% (searched) | −16.9% (searched) |

Perlica (23 battles; few with this team):

| Loadout | Source | Logs | Full energy | From zero |
|---|---|---|---|---|
| **Pulser Labs Disruptor Suit, Gloves, Probe; Hot Work Power Cartridge** | EndfieldHub (Liino, Zhuang Fangyi, Arcane, Perlica) | | 5,472,033 | 3,932,887 |
| Pulser Labs Disruptor Suit, Calibrator ×2; Hot Work Gloves (the logs' most common with the whole team) | exports 2 (0/0/0/2), logs 1 (0/0/1/0) | | −1.5% | −1.8% |
| Pulser Labs Disruptor Suit, Calibrator ×2; Qingbo Gloves | logs; exports 1 | 2 (0/2/0/0) | −1.7% | −1.6% |
| Pulser Labs Disruptor Suit, Calibrator ×2; Eternal Xiranite Gloves T1 | EndfieldHub best teams (Typhoeus, Arcane, Gilberta, Perlica); exports 1 | | −1.7% | −1.6% |
| Qingbo Light Armor, Cask ×2; Hot Work Gloves | exports 1 (0/0/1/0) | | −5.0% | −5.0% |
| Qingbo Light Armor, Gloves, Cask; Pulser Labs Calibrator | exports 1 (1/0/0/0) | | −5.3% | −5.1% |

Overall (all her logs and ZMDLogs' profile counts) Perlica's most common
pieces are Qingbo's (combo cooldown); with this team players run Pulser
Labs, and Qingbo loses 5% here.

- **The sites against the logs:** for Typhoeus the guide's multi-target
  build (a Qingbo Bamboo Cutter as the fourth piece) beats the logs' most
  common Deep Rampart ×4 by 2.0% and ties the logs' Deep Rampart + LYNX
  Slab; its single-target build (Bonekrusha Poncho, for Ultimate Gain)
  loses 6.5–6.8%. For Perlica the team guide's Pulser Labs + Hot Work
  Power Cartridge beats the logs' choices by 1.5–1.8%. For Liino the
  site's pick for a Typhoeus team is the logs' most common and wins; the
  Rift Trekker healer build loses 6–15%.
- **Arcane** is kept on the owner's build. With full artifice, the logs'
  Tide Surge and Hot Work Exo-Rig loadouts would flip her to INT (Intellect
  812.80 / Will 362.50); every Eternal Xiranite alternative stays WILL.
- Scores: replays of a rotation searched with other gear (a lower bound
  for a loadout it doesn't suit); "searched": the rotation couldn't be
  played with it, so a beam-12 search against the chosen loadout's own.
  A first version compared a beam-6 search with a replay directly, and
  that search noise (two beam-6 searches of one team 50% apart) picked
  Rift Trekker for Liino from zero; beam-12 searches of both Liino
  loadouts settle it: 3,932,836 against 3,447,964 from zero, 5,472,033
  against 5,234,292 with full energy.

## Results (2026-11-15; lower bounds)

| | Full energy | From zero |
|---|---|---|
| Total (60 s) | **5,757,797** (96,933 DPS to the last hit at 59.4 s) | **4,989,348** (83,156 DPS) |
| Found by | `--no-macros` (and `--no-macros --skeletons`: the same rotation), beam 48 | macros (the default), beam 48 |
| Shares | Typhoeus 74.7%, Perlica 12.4%, Arcane 8.0%, Liino 4.9% | Typhoeus 76.1%, Perlica 12.3%, Liino 6.7%, Arcane 5.0% |
| Ultimates | Arcane, Liino 0.0 s; Perlica 1.8 s; Typhoeus 8.7 s; Arcane's second 16.3 s; Perlica 50.3 s; Arcane 54.1 s | Arcane 25.2 s; Arcane's second 42.3 s; Perlica and Liino 48.7 s; Typhoeus's (200 energy) doesn't come |
| Crit spread | sd 83,231 (1.4%), 5–95% ≈ 5.64–5.91M | sd 85,321 (1.7%), 5–95% ≈ 4.87–5.15M |

Every search mode, beams 12 / 24 / 48 (guided; the best kept):

| Mode | Full energy | From zero |
|---|---|---|
| macros (default) | 5,472,033 / 5,670,329 / 5,741,752 (7.0 ks) | 3,932,836 / 3,932,836 / 4,989,348 (4.8 ks) |
| `--no-macros --skeletons` | 5,205,516 / 5,261,618 / **5,757,797** (6.1 ks) | 3,932,836 / 3,932,836 / 4,204,562 (3.8 ks) |
| `--no-macros` | 5,205,516 / 5,261,618 / **5,757,797** (3.5 ks) | 3,932,836 / 3,932,836 / 3,932,836 (2.2 ks) |

(Wall times with three runs sharing four cores; the macros' and
skeletons' payoff table took 6.9–9.6 min of each.) **The search is far
from converged for this team**: from zero, macros found +26.9% at beam 48
over a total every other width and mode stopped at; with full energy the
widths spread 4.7–9.6%. Both totals are lower bounds, the zero one the
loosest. The skeletons' guides (3.2M, 1.9M) were far below the beams'
results and changed nothing.

Perlica at P0 with Stanza at [9, 9, 4] (the brief's "all P0"): her P2
ultimate cost cut is gone, so the rotations can't be replayed; a
`--no-macros --single --beam 12` search each gives 4,770,798 with full
energy and 3,194,605 from zero, against 5,205,516 and 3,932,836 at P5 by
the same search (−8.4% and −18.8%).

Typhoeus's share is the hover: her aerial basic attacks and their forced
Nature Bursts (Power Shots), under Liino's Cosmovoice Amp and weapon ATK,
Arcane's Susceptibility and WILL debuffs, Electrification (Perlica's combo,
Liino's ultimate) and Perlica's Stanza ATK. The logs' teams agree in kind:
in 9090 (this team, 165 s against Tower 15's boss) Typhoeus dealt 82% of
the damage.

## Payoffs and chains

`efsim payoffs` on the full-energy scenario with the chosen gear (16
steps, 15 chains). The ceilings say where the damage is: **Typhoeus's
basic chain while hovering**, 19,658 bare → 534,057 under the best bundle
(the hover from her battle skill or ultimate +417,865, Liino's Cosmovoice
Amp +179,087, Liino's weapon ATK +150,414, Electrification, her weapon's
Arts Intensity, Arcane's buffs and Perlica's Stanza ATK); then Perlica's
ultimate (31,150 → 193,897), Liino's ultimate (94,663 → 177,521),
Typhoeus's ultimate (14,454 → 92,774) and Perlica's battle skill
(10,869 → 67,658).

Chains, by damage per second of their span (merged: with setups and
fillers):

| Chain | Damage | Span | Merged |
|---|---|---|---|
| Perlica battle skill → Arcane battle skill → Arcane ultimate → Arcane combo | 194,887 | 2.4 s | 758,559 (Liino's ultimate +123,597 as a setup; Typhoeus's basic chain as filler +277,803) |
| Arcane battle skill → Arcane combo → Perlica battle skill | 104,692 | 1.7 s | 641,232 |
| Arcane battle skill → Arcane ultimate → Arcane combo → Perlica battle skill | 157,195 | 2.6 s | 775,991 |
| Arcane battle skill → Arcane ultimate → Arcane combo | 56,729 | 2.4 s | 882,555 (Perlica's battle skill as a setup +135,919, Perlica's ultimate as filler +241,797) |

The chains are the Nature side (Perlica's Electric battle skill, then
Arcane's Nature infliction, her combo's Nature Burst opening her own
window); Typhoeus's big payoff isn't a chain but a state (her hover), and
the Electrification window is Liino's ultimate or Perlica's combo (opened
by Typhoeus's Final Strike). The payoff table sees no Typhoeus combo from
the start: it needs 8 Signs (Nature Bursts) first.

## Kit checks behind these numbers (2026-11-15)

Before any search, as for Ink Melt: every log of these operators (fixtures/,
pending/, multi-target aside), `efsim zmdlogs check` and `efsim zmdlogs
timing`. Coverage of the four together was thin (one hold-out and one
multi-target log had all four), so five ZMDLogs logs with three or four of
them were imported (screened from 15 exports of Perlica's profile; one,
890b, drawn into the hold-out set); 9090 has the whole team.

- **Typhoeus's Barrage Array (fixed in the log check):** the kit buff had
  no `gameBuff`, so the check counted the logged debuff on top of the
  kit's: her bursts under it read ×1.07 over the log, and the buff timing
  report's top pattern ("starts early / ends late", 14 + 7 hits in five
  logs) was that double count. Mechanism: the data's aura
  (combo_persistentdamage's AuraAction creates exactly
  buff_chr_0034_typhoea_combo_enemy_debuff). The engine's own landings
  under it were right all along (1d91 11 of 15 bursts exact, bdf2 4 of 5,
  fc63 14 of 30, 00ae 7 of 13), so the team's numbers don't move; the
  check's do (below).
- **Whole-team log 9090:** hit by hit, Typhoeus 457 of 457 match, Perlica
  130 of 130, Arcane 371 of 372, Liino 171 of 172; the simulation of the
  logged casts is −2.3% in all (Typhoeus −2.7%, Arcane −4.5%, Liino −15%,
  Perlica −13%; the replay has 145 hits under Stagger where the log has
  208, and Perlica's talent and finisher need Stagger).
- **Perlica:** every hit kind is now in logs; her misfits come in runs of
  ×1.3–1.5 (or their inverse) where the replay's Stagger windows differ
  from the log's; fc63's ×0.934 on every hit is a build offset the export
  doesn't explain. No kit change.
- **Liino and Arcane (WILL):** no new lead in these logs; Arcane's WILL
  kit was checked for the owner's team (2026-11-12 to 11-15).
- **Hints without a mechanism** (docs/open-problems.md "Typhoeus, Arcane,
  Liino, Perlica"): Typhoeus's hover outlasting her logged shots (9090,
  1cd1: in-game test 42 decides), Liino −15% and Perlica −13% in 9090's
  totals, Perlica's fc63 offset.

Log check for these operators (development logs; hold-outs measured only;
mean |damage error| is each operator's total in the simulation of the
logged casts, d9e5 left out):

| Operator | Before (old logs) | After the fix (old logs) | New logs, first check → after | Hold-out before → after |
|---|---|---|---|---|
| Typhoeus | plain 39.5%, mismatch 20.1%, 9.7% | 42.3%, 19.1%, 10.1% | 63.9%, 8.0%, 3.6% → 65.9%, 8.0%, 4.0% | 70.6%, 3.5%, 3.9% → 75.5%, 1.4%, 3.1% |
| Liino | 30.8%, 26.7%, 18.0% | unchanged | 40.8%, 7.0%, 12.2% | 46.5%, 9.0%, 4.9% (+890b: 45.8%, 5.7%, 4.4%) |
| Perlica | 62.4%, 18.3%, 26.3% | unchanged | 46.8%, 35.9%, 6.9% | 62.1%, 10.3%, 5.9% (+890b: 65.2%, 12.5%, 5.8%) |
| Arcane | 58.3%, 19.0%, 15.1% | 58.3%, 19.0%, 15.2% | 59.2%, 6.7%, 3.8% → 59.4%, 6.7%, 3.9% | 67.9%, 4.2%, 4.2% → 68.0%, 4.0%, 4.3% |

Typhoeus's mean error rises a little: the double count had inflated her
simulated totals (bdf2 +5.0 → +0.2%, 92b4 +2.7 → +0.1%) and hidden
shortfalls (1cd1 −9.1 → −13.8%, af7b −4.1 → −8.0%, dbae −2.0 → −5.7%).

## Compared with the other two teams

| | Typhoeus, Arcane, Liino, Perlica | Ink Melt | The owner's team |
|---|---|---|---|
| Full energy, 60 s | **5,757,797** (96,933 DPS) | 4,689,365 (78,156 DPS) | 3,990,122 (66,502 DPS) |
| From zero, 60 s | **4,989,348** (83,156 DPS) | 4,601,305 (76,688 DPS) | 3,263,818 (54,427 DPS) |
| Carry's share (full) | Typhoeus 74.7% | Laevatain 58.1% | Estella 43.3% |
| Search spread of the kept run (full / zero) | 9.6% / 21.2% | 4.5% / 60.4% | 16.0% / 26.0% |

All three under the same assumptions (Rhodagn Lv90, 60 s, expected
crits; Ink Melt's and this team's builds from the logs; the owner's
team the owner's), all lower bounds. This team leads by 23% with full
energy and 8% from zero. Caveats: the search's spread is largest here;
Typhoeus's hover is the one mechanic all of it leans on, and the logs
show her hover lasting longer than the engine lets it (in-game test 42:
if the game's idle hover is longer, this team gains; the engine's rule
is the data's); Perlica is P5 where the other teams' 6-stars are P0.
