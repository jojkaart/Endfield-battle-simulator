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
[9, 9, 4], full artifice; gear is each operator's most common loadout in
the imported logs (base versions):

| Slot | Operator | Weapon | Gear |
|---|---|---|---|
| 1 | Laevatain | Forgeborn Scathe | Hot Work body, gloves, accessory; LYNX accessory |
| 2 | Si | Jade Vessel | Type 50 Yinglung armor, gloves, beacon; LYNX accessory |
| 3 | Wulfgard | Rational Farewell | Hot Work ×4 |
| 4 | Ardelia | Dreams of the Starry Beach | Hot Work body, gloves, accessory; LYNX accessory |

Laevatain in slot 1 turns Si's infliction to Heat and gives Laevatain her
combo cooldown cut. Si's ultimate gives the team Cryo and Heat Amp
whatever her battle skill does.

## Results (2026-11-15; lower bounds)

| | Ink Melt | The owner's team |
|---|---|---|
| Full energy, 60 s | 4,411,886 (73,531 DPS) | 3,286,029 (54,767 DPS) |
| From zero, 60 s | 3,892,412 (64,946 DPS) | 3,008,031 (50,134 DPS) |

- Shares, full energy: Laevatain 59.8%, Si 24.1%, Wulfgard 8.6%, Ardelia
  7.4%. From zero: Laevatain 51.9%, Si 31.9%, Ardelia 9.5%, Wulfgard 6.7%.
- Ultimates, full energy: Si, Ardelia, Wulfgard at 0 s, Laevatain at
  0.13 s and again at 49.3 s. From zero: Laevatain and Si at 49.4 s;
  Wulfgard's and Ardelia's don't come within 60 s.
- Crit spread: full energy sd 49,363 (1.1%), 5–95% ≈ 4.34–4.50M; zero sd
  46,587 (1.2%), 5–95% ≈ 3.83–3.98M.
- **The search is far from converged for this team.** Full energy: beams
  12/24/48 gave 3.50 / 3.50 / 4.41M (spread 20.8%), while an unguided
  24/48/96 run found only 3.53M; zero: 24/48/96 gave 1.80 / 3.81 /
  3.89M (53.6%), a guided 12/24/48 run 3.84M. The owner's team's
  spreads were 1.6% and 8.8%. Both teams' numbers are lower bounds, Ink
  Melt's looser.

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
