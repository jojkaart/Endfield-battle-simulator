# Glossary

Game terms as used in this project, their naming variants, and the internal
IDs they appear under in the game tables. Add to it whenever a new term or
alias turns up.

## Naming variants

| Concept | Variants | Notes |
|---|---|---|
| Skill level | Rank 1–12 = Lv1–9 + M1–M3 = Lv1–9 + 专1–3 | Same 12 levels. Tables use `level` 1–12. |
| Operator internal IDs | `chr_NNNN_<code>` | Codes often differ from English names: `pelica` = Perlica, `laevat` = Laevatain, `lizhiyan` = Arcane, `typhoea` = Typhoeus, `jsspsi` = Si, `wulfa` = Rossi, `ikut` = Arclight, `azrila` = Ember, `seraph` = Xaihi, `aglina` = Gilberta, `aurora` = Snowshine, `karin` = Akekuri, `meurs` = Catcher, `whiten` = Estella, `bounda` = Fluorite, `deepfin` = Alesh, `wolfgd` = Wulfgard, `endminm` / `endminf` = Endministrator. Full list: `CharacterTable`. |
| Other IDs | `wpn_*` weapon (and weapon skill), `eny_*` enemy, `passive_equipsuit_*` gear set effect, `sk_*` other skills | |

## Skills

| Term | Table ID suffix | Meaning |
|---|---|---|
| Basic attack | `attack1`…`attack5`, `dash_attack`, `plunging_attack_end` | Attack chain; each segment has its own multiplier. |
| Final strike / heavy | `power_attack` | Last hit of a basic chain. *(check)* |
| Battle skill | `normal_skill` | Costs SP (`costType` 1). |
| Combo skill | `combo_skill` | Usable in a window opened by a trigger condition; has a cooldown. |
| Ultimate | `ultimate_skill` | Costs ultimate energy (`costType` 0). |
| Blackboard | `blackboard` | Named per-level values of a skill (`atk_scale`, `poise`, `usp`, `duration`, …). |

## Resources and combat

| Term | Meaning |
|---|---|
| SP | Team-shared skill points spent on battle skills. |
| Ultimate energy | Per-operator gauge (max `maxUltimateSp` = 100 in `BattleConst`) spent on the ultimate. |
| Stagger | Enemy gauge; when broken the enemy is staggered (×1.3 damage taken). |
| Finisher | Hit on a staggered enemy; multiplier by enemy tier. |
| Link | Bonus to battle skill / ultimate by stack count. |
| Infliction | Elemental stacks applied to an enemy; combining them triggers an arts reaction. |
| Arts reaction / Arts Burst | Damage from inflictions (e.g. Combustion DoT). |
| Physical statuses | Lift, Knockdown, Crush, Breach, Shatter. |
| Arts Intensity | Stat scaling reactions, bursts and physical statuses. |
| Susceptibility, Amp, Weaken, Protection | Separate multiplier zones; see [data-sources.md](data-sources.md#3-damage-formula). |
| Main / secondary attribute | STR, AGI, INT, WILL; each operator has one main and one secondary, scaling ATK by 0.5% and 0.2% per point. |
| Potential | Duplicate-based upgrades P0–P5 (`CharacterPotentialTable`). |
| Refinement | Weapon upgrade from duplicates. *(check name in tables)* |
