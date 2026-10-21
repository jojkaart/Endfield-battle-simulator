# Data sources: evaluation

Researched 2026-10-18. Game state then: patch 1.6 ("Sanctuary of Ink", live
2026-10-15, new operator Si).

This document lists candidate sources for game data, the damage formula and
reference results, evaluates each, and recommends a set. Decisions taken are
recorded [at the end](#decisions).

## How this was checked

- **GitHub repositories were inspected directly.** They were cloned, their
  file trees and history read, and the same tables compared value by value
  between repos. Nothing from them was executed.
- **Websites could not be opened** from the research environment: its network
  policy blocked them. What is said about wikis, web tools and their licences
  comes from search-engine extracts. Claims not confirmed that way are marked
  **(unverified)**.
- Numbers that agree exactly across several independent extracts are treated
  as reliable.
- **Second pass (2026-10-18), with web access:** licences and terms were read
  at the source; findings are marked **(verified)** with the date.
  Reachability per host: [network-allowlist.md](network-allowlist.md).

### Licences and terms in short

The project reads these sources to check numbers and cites them; it doesn't
copy their text, tables or code. Bare game numbers are facts from the client;
the licences cover each site's own content. Not legal advice.

| Source | Terms (verified 2026-10-18) | What it means for us |
|---|---|---|
| Talos Wiki | Text CC BY-SA 4.0 (`siteinfo` rightsinfo, Copyrights page). robots.txt disallows `/api.php` for all agents, asks for responsible automated traffic, `Content-Signal: use=reference, ai-train=no`. | Cite with a link; don't copy text or Lua modules (share-alike). **Owner's decision (2026-10-18):** API use by Claude and sub-agents is fine for lookups as needed, without undue load; no scripted mass downloads. Descriptive user agent. |
| EndfieldHub | ToS (2026-01-25): own content "may be freely shared with attribution"; no scraping beyond "reasonable use". `/webmcp/` JSON asks to cite `canonical_url`. `/api/artificing-gears.json` is CC BY 4.0. | Read occasionally, cite `canonical_url`. **Not independent:** it credits the Talos Wiki, Prydwen, Game8 and others as its sources. |
| ZMDLogs | No terms, privacy or robots pages. Site code MIT ([endfield-suite-open](https://github.com/medps16000/endfield-suite-open)); battle data has no licence. Uploader nicknames are public by design. | Cite battle IDs; don't commit whole payloads; drop names and IDs. |
| BWIKI | No content licence set (`rightsinfo` empty); footer "BILIBILI ALL RIGHTS RESERVED". | Read and cite only. |
| GameKee | No licence found. Formula article credits Bilibili users 吃我无痕 and 卡诺kan0. | Read and cite, crediting the authors. |
| end.canmoe.com | The CEP planner, source [cmyyx/cep](https://github.com/cmyyx/cep), **AGPL-3.0**. | Compare only; don't copy code or data. |
| arknightsendfield.gg | "© 2025", no terms page; robots allows all. Run figures come from Datafield. | Cite. |
| Endaxis (end-axis.com) | No licence anywhere. | Compare outputs only (unchanged). |
| Zero Sanity | MIT, © 2026 Mitchell Ma. | Reuse with attribution (unchanged). |

Still unread (hosts not on the allowlist): wiki.gg network ToS, Bilibili user
agreement, note.com terms, GameKee user agreement, and the publisher's
(Gryphline/Hypergryph) fan-content policy and stance on datamined data.

## Summary

| Need | Recommended source | Cross-check with |
|---|---|---|
| Skill multipliers, cooldowns, costs, weapon/gear/enemy stats, constants | [rmxlinux/EndfieldData](#rmxlinuxendfielddata) | [555me/beyondGameData](#555mebeyondgamedata) (verified identical) |
| Skill hit timing, buff logic | rmxlinux/EndfieldData (`Json/SkillData`, `Json/BuffData`) | none available (only one source has it) |
| Per-patch regression data | 555me/beyondGameData (one commit per game resource version) | Sudsier/EndfieldTable (lags) |
| Damage formula | [Endfield Talos Wiki](#endfield-talos-wiki-endfieldwikigg) + [666bj documentation](#666bj-base-damage-documentation) | EndfieldHub guides, Chinese community wikis |
| Human-readable data cross-check | Talos Wiki (derived from the tables; tooltip values) | EndfieldHub (light spot checks; not independent) |
| Reference results (MVP fixtures) | [Zero Sanity Laevatain hit table](#zero-sanity-simulations) (in-game verified) | [ZMDLogs](#zmdlogs) battle logs (real in-game per-hit data) |
| Full-rotation cross-simulator check | [End-DPScope / Endaxis timelines](#endaxis-and-end-dpscope) | (computed, not ground truth) |

The key point: **the game's own data tables are publicly available and
complete enough to drive a simulator.** Wikis are useful as a second opinion
and for formula documentation, but they appear to derive from the same tables.
Real ground truth for the formula has to come from **in-game measurements**,
for which ZMDLogs is the richest source found.

## 1. Raw game data (datamines)

All of these decode the same encrypted client tables. Comparing them catches
extraction and conversion bugs, and stale snapshots, but **cannot catch errors
in the source itself**. None of them see server-side values or hotfix code
patches, so some in-game checking is always needed.

### What the tables contain

The combat data lives in the game's `TableCfg/` tables:

- **`SkillPatchTable`**: 547 skills, 12 levels each (9 for two cooldown
  skills). Per level: a `blackboard` of named values (`atk_scale`, `poise`,
  `usp`, `duration`, …), `coolDown`, `costType` (0 = ultimate energy, 1 = SP)
  and `costValue`. Covers operator skills, weapon skills (`wpn_*`) and gear
  set effects (`passive_equipsuit_*`). Example:
  ```
  chr_0004_pelica_normal_skill  L1: costType 1, cost 100, {atk_scale: 1.78, poise: 10} … L12: {atk_scale: 4.0}
  passive_equipsuit_agi_01: {agi_up: 50, hp_ratio: 0.8, phy_dmg_up: 0.2}
  ```
- **Enemies**: `EnemyAttributeTemplateTable` (HP/ATK/DEF for levels 1–100,
  per-element resistances, stagger HP), `EnemyDamageTakenLevelTable`
  (resistance grades S–D → 0 / 0.2 / 0.5 / 0.8 / 1).
- **Constants**: `BattleConst` (`atkRateOfMain` 0.005, `atkRateOfSub` 0.002,
  `efficiencyOfDEF` 0.01, `commonResistanceMaxValue` 90, `maxUltimateSp` 100…).
- **Operators**: `CharacterTable`, `CharGrowthTable`,
  `CharacterPotentialTable`, `PotentialTalentEffectTable`.
- **Weapons**: `WeaponBasicTable`, `WeaponUpgradeTemplateTable`,
  `WeaponTalentTemplateTable`.
- **Gear**: `EquipTable`, `EquipSuitTable`, `GemTable`.
- **Text**: `I18nTextTable_<lang>` (14 languages).

Outside the tables, `Json/SkillData/*.json` holds skill timelines (hit frames,
which buffs a skill applies) and `Json/BuffData/*.json` holds buff logic
(stacking, modifiers). `TableCfg/BuffTable.json` itself is empty.

Things that make them harder to use:
- Attribute types are numeric IDs whose names live in game code, not data.
  Most can be recovered from other tables.
- SkillData/BuffData are polymorphic C# action graphs; interpreting them is
  real work.
- Floats are raw float32 expansions (`4.449999809265137`); text IDs are int64
  and need int64-safe parsing in JavaScript.

### rmxlinux/EndfieldData

<https://github.com/rmxlinux/EndfieldData>

- **Has:** all 772 tables, i18n for 14 languages, and the only public copy of
  `Json/SkillData` (2,928 files) and `Json/BuffData` (3,396 files).
- **Freshness:** 44 commits, 2026-02-08 → 2026-10-15 ("Update 1.6"). Updated
  by hand every 1–3 weeks. SkillData/BuffData only since 2026-09-08.
- **Versioning:** commits only, no tags or version labels.
- **Format:** raw JSON keyed by internal IDs; text via i18n tables.
- **Risks:** single maintainer; ~100k files (use a sparse checkout of
  `TableCfg/` and `Json/SkillData`, `Json/BuffData`); no licence.
- **Verdict:** best primary source. It is the only one with buff and timing
  logic.

### 555me/beyondGameData

<https://github.com/555me/beyondGameData>

- **Has:** 774 tables (same set). No SkillData/BuffData.
- **Freshness:** 63 commits, launch (2026-02-12) → 2026-10-17 (1.6.4).
  Updates within about a day of each patch.
- **Versioning:** every commit message is the game's resource version ID
  (e.g. `11123848` = 1.6.4). Combined with
  [4n3u/EndfieldResourceData](https://github.com/4n3u/EndfieldResourceData),
  which maps IDs to client versions, this gives clean per-patch snapshots.
- **Format:** text resolved inline (`{"cn": …, "en": …}`), sorted for clean
  diffs. Quirk: whole numbers stored as strings (`"coolDown": "10"`), so types
  must be coerced.
- **Risks:** single maintainer; no licence.
- **Verdict:** best secondary source and best for per-patch regression tests.

**rmxlinux vs 555me, verified:** all 37,320 SkillPatchTable values identical;
enemy, character, equipment, weapon and potential tables (~590k values,
including English text) identical. The two use different extraction tools,
so they're partly independent.

### Others

| Repo | Verdict |
|---|---|
| [Sudsier/EndfieldTable](https://github.com/Sudsier/EndfieldTable) (`archive` branch) | Clean folder per version, CN, from 1.4. Matches rmxlinux at 1.5, but hasn't picked up 1.6. Main branch ships binaries; never run them. Possible third check. |
| [3aKHP/EndFieldGameData](https://github.com/3aKHP/EndFieldGameData) | Only 10 tables, no skills or weapons, stale (June). Unsuitable. |
| [Variante/endfield_research_kit](https://github.com/Variante/endfield_research_kit) | Windows tool that decodes an installed client yourself; ships no data. MIT. A truly independent extraction path, and documents how tables join. Heavy to run. |
| [Moonfair/EndFieldBuildSim](https://github.com/Moonfair/EndFieldBuildSim) | Factory/crafting only. Not relevant. |
| Pre-release repos (UPON-2021, Hengle, swordgrass, lsy-404) | Closed-beta data. Don't use. |

**Region:** CN and global appear to share one table build (resource version
IDs match), but this hasn't been checked file by file.

## 2. Wikis and web databases

All of the reliable ones agreed exactly on every value spot-checked, which is
consistent with them deriving from the client tables.

### Endfield Talos Wiki (endfield.wiki.gg)

<https://endfield.wiki.gg>

- **Coverage:** operators (skill tables for ranks 1–12, potentials), weapons
  (base ATK at six levels, passives), gear and sets, enemies (HP by level,
  DEF, resistance per element, stagger), a page per reaction and status. Has
  Si (1.6).
- **Formula:** the most complete documentation found
  ([Damage calculation](https://endfield.wiki.gg/wiki/Damage_calculation),
  [Attribute](https://endfield.wiki.gg/wiki/Attribute)). One extract said the
  damage page was last edited ~231 days ago; in fact it was edited 20 times
  between 2026-03-26 and 2026-10-12 (verified). The Attribute page was last
  edited 2026-03-04.
- **Data origin:** not stated, but matches the tables exactly (verified
  2026-10-18 for Perlica, Laevatain and Si skills, Forgeborn Scathe ATK,
  Rhodagn HP/ATK/DEF). So it's derived from them and adds little independent
  information; its formula pages are its real value.
- **Where data lives:** template parameters in each page's wikitext
  (`{{Combat skill|…}}`, `{{Operator data|…}}`, `{{Weapon data|…}}`,
  `{{Enemy data|…}}`), six stat levels (1/20/40/60/80/90) and skill ranks
  1–12 as whole percentages. Cargo is queryable (`action=cargoquery`;
  Operators, Abilities, Weapons, Enemies, Gears, GearSets, GearStats) but
  holds metadata and gear stats, no skill multipliers or enemy curves. Lua
  modules are mostly helpers (`Module:Weapon skill/data` is a real table).
- **Tooltip values, not per-hit values:** for multi-hit skills the wiki shows
  the tooltip number (`display_atk_scale`), e.g. Si's combo 333–750% vs
  per-hit keys 0.178–0.4 and 1.556–3.5. Use raw keys; the wiki only checks
  displayed numbers. Some rows have entry errors (Laevatain battle-skill SP
  cost row has 24 values).
- **Machine-readable:** MediaWiki `api.php` works (verified 2026-10-18), but
  robots.txt disallows it for automated agents; see
  [Licences and terms](#licences-and-terms-in-short). Pages are behind a
  Cloudflare check. Use a descriptive user agent: `Mozilla/5.0` is blocked.
- **Licence:** text CC BY-SA 4.0. **(verified 2026-10-18)**
- **Verdict:** primary formula reference and best human-readable cross-check.

### EndfieldHub (endfieldhub.org)

<https://endfieldhub.org>

- **Coverage:** 32–33 operators, 82 weapons (updated 2026-10-15), gear,
  guides for damage formula, reactions and stagger.
- **Data origin:** says it is pulled from the client tables; promises updates
  within 48 hours of a patch.
- **Machine-readable:** static JSON under `/webmcp/`
  (e.g. `/webmcp/find_operator.json`); the site says any script may read it.
  Operator data there was dated 2026-08-09, i.e. before 1.6.
  **(verified 2026-10-18)** Terms: see
  [Licences and terms](#licences-and-terms-in-short).
- **What's in the JSON** (verified): `find_operator` (profiles, no stats),
  `find_enemy` (59 enemies with HP, ATK, resistances as multipliers, stagger;
  dated 2026-02-19), `find_gear` (278 pieces, 2026-10-15),
  `get_weapon_tier_list` (base ATK, no 1.6 weapons). **No skill
  multipliers** in any JSON; spot-checked values match the raw tables.
- **Not independent:** its `llms-full.txt` credits the Talos Wiki, Prydwen,
  Game8, Mobalytics and datafield.cc, so agreement with the Talos Wiki
  doesn't confirm a value.
- **Quality problems:** inconsistent operator counts between pages; a blog post
  gives attribute coefficients 10× too high; its damage guide says Breach
  produces negative DEF, which contradicts the Talos Wiki. Its "71K team DPS"
  tier-list figure doesn't publish gear or rotation.
- **Verdict:** usable secondary data source; treat its guides with care.

### Others

| Source | Verdict |
|---|---|
| ~~end.wiki~~ | Was described as datamine-driven, multilingual, with internal IDs. Domain no longer resolves (2026-10-18). |
| [Icy Veins](https://www.icy-veins.com/arknights-endfield/) | Skill tables at rank 12, weapons, gear. Matched the Talos Wiki exactly. HTML only, proprietary. Spot checks only. |
| [BWIKI](https://wiki.biligame.com/zmd/) (CN) | Skill tables Lv1–9 + 专1–3, numbers only in rendered HTML. No page for Si (behind on 1.6). Rate-limits automated requests. No content licence; all rights reserved (verified 2026-10-18). |
| [Huiji wiki](https://endfield.huijiwiki.com/wiki/伤害), [GameKee](https://www.gamekee.com/zmd/691878.html) (CN) | Damage formula from community testing; agrees with the Talos Wiki. Some labelling errors. |
| end.canmoe.com | The CEP planner ([cmyyx/cep](https://github.com/cmyyx/cep), AGPL-3.0). Display strings in page payloads, no API, no Si (behind on 1.6). Not useful. |
| Prydwen, Game8, GameWith, Fandom | Agree on spot checks. HTML only, proprietary. |
| **GamerGuides, Fextralife** | **Stale closed-beta numbers** (e.g. Forgeborn Scathe 545 ATK at Lv90 instead of 510). Don't use. |
| endfield.gg, talos2codex.com, arknightsendfield.wiki, Dexerto, qieyou.com | Stale, borrowed from mainline Arknights, or contradict everything else. Don't use. |

### Spot-check results

| Value | Result |
|---|---|
| Laevatain battle skill, rank 12 | 140% explosion, 14% DoT per sequence, 770% extra attack. Talos Wiki, Icy Veins, EndfieldHub agree. |
| Perlica battle skill, rank 1 / 12 | 178% / 400%. Talos Wiki, Icy Veins, endfieldbuilds, canmoe agree, **and matches the raw table** (`atk_scale` 1.78 / 4.0). |
| Forgeborn Scathe base ATK at Lv90 | 510. Seven sources agree; GamerGuides (545) and Fextralife are wrong. |
| Hot Work set effect | +50% Heat/Nature DMG for 10s (Talos Wiki, Icy Veins); GamerGuides says +60% for 8s (beta). |

**Trap:** skill levels are labelled two ways: "Rank 1–12" and
"Lv1–9 + M1–M3 / 专1–3". They mean the same thing.

## 3. Damage formula

### Consensus

From the Talos Wiki, with GameKee, Huiji and the 666bj documentation agreeing.
Updated 2026-10-18 against the game's own BuffData and the Talos Wiki as of
revision 64660 (2026-10-12). † = also in the raw `BattleConst` table;
‡ = confirmed from `Json/BuffData` (rmxlinux, game 1.6).

```
DMG = ATK × BaseMult × DMGBonus × Crit × Amp × Stagger × Finisher × Link
      × Weakness × Susceptibility × IncreasedDMGTaken × DMGReduction × Protection
      × DEF × RES × Multiplicative
```

**How the game groups modifiers ‡.** Every damage modifier in BuffData names a
side (attacker / defender) and a zone: `NormalCalcZone` modifiers add
together within their side; `ProdCalcZone` modifiers each multiply
separately (rarer zones: `EnergyTypeCalcZone`, `RaceCalcZone`,
`ComboCalcZone`). Amp, Susceptibility, Weakness and Protection are separate
stats (attribute types 64–69, 70–75, 62, 63), not zones.

- **ATK** = `((OperatorATK + WeaponATK) × (1 + ATK%) + flat) × (1 + 0.005 × MainAttr + 0.002 × SecondaryAttr)` †.
  Attributes have hidden decimals in the tables (e.g. 177.985). Whether the
  attribute is floored before the bonus is disputed; see
  [rounding](#rounding).
- **DMGBonus** (attacker `NormalCalcZone` ‡) = 1 + sum of element, skill-type,
  "vs Staggered" and weapon/talent "DMG +x%" bonuses.
- **IncreasedDMGTaken** (defender `NormalCalcZone` ‡) = 1 + sum of Breach,
  Electrification, the Endministrator talent and weapon "target takes DMG
  +x%" effects.
- **Stagger:** ×1.3 while staggered, its own multiplier (defender
  `ProdCalcZone`, `buff_common_poise_break_damage_taken_scale`) ‡. So "DMG
  Bonus vs Staggered" adds into DMGBonus, while being staggered multiplies.
- **Multiplicative:** `ProdCalcZone` bonuses, e.g. Fluorite's 30% ‡.
- **Crit:** base 5% rate, +50% damage. DoT can't crit, though some skills
  described as DoT can (Talos, 2026).
- **DEF:** `100 / (DEF + 100)` for DEF ≥ 0 †. All enemies have 100 DEF (×0.5).
  Negative DEF is "currently not achievable" (Talos); no buff lowers DEF
  below 0 ‡.
- **RES:** `(100 − EnemyRES + IgnoreRES + CorrosionShred) / 100`; grades map
  to 0 / 0.2 / 0.5 / 0.8 / 1 †. Can exceed ×1 (Talos rewrite, 2026).
- **Finisher:** ×1 / 1.25 / 1.5 / 1.75 by enemy tier.
- **Link:** battle skill +30/45/60/75%, ultimate +20/30/40/50% by stack count.
  In the data (rmxlinux BuffData): `buff_common_affixes_combo_trigger`
  stacks on the team, left only by a ComboAction (SkillData: Lifeng's
  combo, Camille's combos) or a buff that counts as one (Akekuri's
  talent; Thermite Cutter only reacts to Link its wielder gains, its
  sk_wpn_sword_0012 handler checks for the trigger buff), not by every combo (corrected
  2026-10-20, batch 4 B1: ordinary combos leave no Link in five logs); casting a battle
  skill or ultimate (skill types 2, 7) reads the stack count, looks up
  `imbue_scale` under the skill-setting key 连击增伤 (not in the fetched
  tables) and creates `buff_common_affixes_skillimbue_atk`: a `ComboCalcZone`
  addition for that cast's hits only (`CheckSkillCastId`; masks 256 / 512),
  ×1.5 for battle-skill hits. Verified: Gilberta's ultimate in
  btl_upload_40d9a3c1da37 is exactly ×1.2000 with one stack from Camille's
  combo (ZMDLogs logs the trigger with zero duration and no value).
- **Susceptibility** has an effect multiplier (Last Rite's talent);
  **Weakness** (formerly "Weaken") stacks multiplicatively; **Protection**
  can go negative (Purrchena). (Talos, 2026)
- **Reactions and statuses:** Arts Burst 160%; Arts Reaction 80% + 80% per
  infliction stack; Lift/Knockdown 120%; Crush 150% + 150% per Vulnerable
  stack (300–750%); Breach hit 50% + 50% per Vulnerable stack (100–250%,
  lasts 12–30 s); Combustion DoT 12% + 12% per level; Shatter 120% + 120%
  per level (240–600%); Industrial Explosive 1250 + 1.2 × ATK.
- **Level coefficient** (operator level, reactions only): arts
  `1 + (Lv−1)/196` (Shatter uses this one too), physical statuses
  `1 + (Lv−1)/392`. Enemies have no level multiplier.
- **Breach** ‡ (`buff_physical_do_fracture`): no DEF change; adds
  +12 / 16 / 20 / 24% (levels I–IV) to the target's IncreasedDMGTaken for
  Physical damage. Its BuffData value key is the misleading
  `physical_res_down`. Beta values were 11–20%; changed at release
  (Talos revision 43077, 2026-03-22).
- **Corrosion** ‡: lowers resistance of all five elements (Physical
  included; extended at launch) by an initial 3.6 / 4.8 / 6 / 7.2 points,
  +0.84 / 1.12 / 1.4 / 1.68 per second, up to 12 / 16 / 20 / 24.
- **Electrification** (checked against logs): Arts DMG Taken +12 / 16 / 20 / 24% (levels I–IV)
  × (1 + 2·AI/(AI+300)), lasting 12 / 18 / 24 / 30 s (Talos). Verified on
  ZMDLogs `vuln_taken` rates: Perlica's reaction Electrification
  (`buff_common_pulse_cryst_triggered`, btl_upload_e82d45c46040) 0.39571 =
  0.20 × 1.97855 at her panel AI 287.4 (level III); Liino's forced one
  (`buff_common_pulse_pulse_conduct_triggered_do`, d9e59d0fb737) 0.12 at AI
  0 (level I). Open: Perlica's forced one (btl_upload_b6082588d600) is
  0.272665 = 0.1596 × 1.70843 at AI 164.55, i.e. level I × 1.33, probably a
  talent or potential of hers; the reaction one is logged for element
  "all", the forced one for the four arts elements (the engine applies it to
  arts only, per Talos).
- **Arts Intensity (AI)** has three curves:
  - reaction, burst and physical status damage: ×(1 + AI/100);
  - Breach, Electrification and Corrosion effect strength:
    ×(1 + 2·AI/(AI+300)), approaching ×3 (the "soft cap 300%": a ceiling of
    3× the base, not a cap at 300 AI); ×1.5 at 100 AI, ×2 at 300;
  - Lift / Knock Down stagger: ×(1 + AI/200).
- **Constants:** `BattleConst` is identical in 555me and rmxlinux 1.6; no
  formula constant changed since March. Talos edits since then are listed in
  the journal (2026-10-18).

**Physical state** (research 2026-10-18: BuffData, the in-game tutorial
text in `I18nTextTable_EN`, the Talos Wiki pages Physical Status rev 65612,
Vulnerability 65556, Lift 65560, Breach 65564, Stagger 64620, and Endaxis's
runtime, read not copied; engine `status.ts`):
- **Vulnerable** (`buff_physical_no_guard`): max 4 stacks, 20 s, each new
  stack refreshes it (stacking type 8). Gained only from physical-status
  actions and skills that create it directly; plain physical hits don't.
- A physical-status action on an enemy without Vulnerable only adds one
  stack, unless forced (`forceAirborne`, `forceKnockDown`; Crush and Breach
  have no force flag).
- **Lift / Knock Down** (`buff_physical_airborne` 3 s, `_knockdown`): +1
  Vulnerable, not consumed; a 120% hit (masks 32768 / 65536); poise
  10 × (1 + AI/200); a 2 s interrupt.
- **Crush** (`buff_physical_do_crushed`): consumes all n stacks; 3 / 4.5 /
  6 / 7.5 × the action's `damageMultiplier` (mask 16384); no poise.
- **Breach** (`buff_physical_do_fracture`): consumes all n stacks; hit 1 /
  1.5 / 2 / 2.5 (mask 1073741824); Physical DMG taken +12–24% for 12 / 18
  / 24 / 30 s; a new Breach replaces the old one (stacking key `fracture`).
- **Shatter** (`buff_common_cryst_triggered_physical_break`, mask
  134217728): any physical status, or any new Vulnerable stack, on a
  Solidified enemy consumes Solidification for 2.4 / 3.6 / 4.8 / 6 by its
  level, after the status's own hit; Vulnerable is unaffected.
- **Stagger** (EnemyAttributeTemplateTable `levelIndependentAttributes`):
  stagger HP is attribute 20 (Rhodagn 280), the Staggered time attribute
  21 × 31 (10 s), the finisher multiplier attribute 27 (1–1.75), the
  finisher SP `breakingAttackedAtbObtain` (25–100), stagger nodes
  `poiseKnotPctList`. A hit's stagger = its value × the attacker's
  attribute 26 × the enemy's 24; Final Strikes' only when their operator is
  controlled (`onlyEnableForMainChar`). At 0 the enemy is Staggered: ×1.3
  damage taken (`buff_common_poise_break_damage_taken_scale`, its own
  multiplier), no more stagger, one finisher allowed; then the bar refills.
- Zero Sanity's notes (Lift consumes Vulnerable; Crush / Breach need none)
  describe the Beta I rules, changed since.
- Verified: Estella's Lift hits in `zmdlogs-4e5e1390085e` match exactly.

**Simulator caveats:** Zero Sanity uses beta Breach values (11–20%) and no
AI scaling for Breach/Electrification
(`src/controller/timeline/eventsQueryService.ts:34-36`), and rounds ATK to
0.1 (`src/model/calculation/damageFormulas.ts:700`), which no other source
supports. EndfieldHub's damage guide contradicts itself on Breach (§9
fragility vs §10 negative DEF); its negative-DEF claim is wrong.

### Ultimate energy and combo windows

From the game data and both reference simulators (Endaxis's generated
native skill settings, Zero Sanity's constants), which agree unless noted:

- **Max energy = the ultimate's cost** (`SkillPatchTable` costType 0, same
  at every level): Laevatain 300, Gilberta 90, Estella 70, Arcane 100,
  Typhoeus 200, Liino 160, Si 80. Potentials cut it through
  `skillParamModifier` paramType 1 (×0.85 at P4 for most; Estella ×0.9 at
  P2). No passive regeneration; the ultimate uses all of it.
- **Battle skills:** every team member gains 0.065 energy per *natural* SP
  spent (6.5 per 100 SP); SP returned by skills is spent first and gives
  none (`buff_common_obtain_ultimate_sp`; the per-SP rate is from the
  native settings, not in our dump).
- **Fixed grants:** `ObtainCostAction` costType 0 with a blackboard key
  (combo skills mostly `usp` 10; Laevatain's combo 25/30/35 for 1/2/3
  enemies, her empowered battle skill `extra_usp` 100). Scaled by Ultimate
  Gain Efficiency (attribute 44, default 1) unless the action says not to.
- **Blocks:** some ultimates stop their caster's gain (`RefrainObtainUsp`):
  Laevatain 16 s from the cast (Zero Sanity: 15 s after the animation).
- **Combo windows:** open 6 s after the trigger (`comboSkillPendingInterval`
  6), per operator; triggers while the combo is on cooldown are ignored;
  casting closes the window. Trigger conditions are the CharGrowthTable
  "COMBO TRIGGER" texts. Cooldowns come from `SkillPatchTable`, and
  potentials change some through `skillParamModifier` paramType 2.

### Rounding

From note.com/at67275, "ダメージ計算に関わる小数と端数処理" (2026-03-09,
updated 03-15, game ≤1.1, in-game measurements):

- Calculations use raw values; only final damage is rounded, "probably"
  half-up.
- Exception: attributes appear to be rounded before the attribute ATK bonus
  (it moves in 0.5% / 0.2% steps); one Lv60 Catcher case breaks this.
- Display only: whole-number stats truncated, percentages rounded half-up.
  The game's Lua display code floors (`LuaScripts/Common/Utils/AttributeUtils.lua`).
- Hidden decimals are real: weapon substats follow 1 : 0.8 : 0.6 for
  large / medium / small (large element DMG = 5.555% at rank 1, table
  `0.0555555559694767`); gear artificing ×1.1 / 1.2 / 1.3; gear AI 49.68
  shows as 49. Table floats are single precision.

Sources disagree on attributes: the Talos Attribute page uses exact values;
666bj, EndfieldHub, Zero Sanity and Endaxis floor the effective attribute.
**Plan:** exact table values, floor effective attributes before the ATK
bonus, round final damage half-up, each rounding step behind one switch so
fixtures can decide.

### Frame rate

**30 FPS** ‡: all 626 animation actions in `chr_*` SkillData files convert at
exactly 30 frames per second (e.g. `chr_0004_pelica_attack1`: 166 frames for
5.5333 s). Zero Sanity's parser and Endaxis use 30; End-DPScope's "60 fps"
comes from an old Endaxis export format.

### Open questions

Each with the in-game test that would settle it:

1. **AI scaling of Breach / Electrification** (data says yes, untested): apply
   Breach IV from an operator with 150 AI, hit with a 0-AI operator; the model
   predicts +40% damage taken, not +24%.
2. **Corrosion ramp timing:** Corrosion I from a 0-AI and a 300-AI operator;
   read Nature damage at 0, 5 and 15 s.
3. ~~**Final damage rounding**~~ *Settled 2026-10-18:* nearest whole number.
   Zero Sanity's in-game hits show 1572.75 → 1573, 3253.97 → 3254,
   1952.38 → 1952 (fixtures/zero-sanity-laevatain-p5.json). Only exact .5
   (half-up vs half-even) is untested.
4. ~~**Attribute flooring**~~ *Settled 2026-10-18:* the ATK bonus uses whole
   attributes. In-game effective ATK 5871 needs it (exact attributes give
   5878); End-DPScope's research notes state it.
5. **Burst / reaction DMG bonuses** (attribute types 35–38, 49, 56–59): Endaxis
   treats them as a separate multiplicative group; Talos and 666bj don't
   mention them. Compare a Combustion hit with a "+Arts Reaction DMG" source,
   a "+Heat DMG" source, and both.
6. ~~**How Link is stored** in the data.~~ *Found 2026-10-18:* see Link
   above. Still open: the per-stack values (连击增伤) and whether they scale
   with anything; cast an ultimate after 1, 2 and 3 teammates' combo skills.
7. **Order of operations**, which only matters for single-precision rounding.

### 666bj base damage documentation

A Chinese community reference (终末地数据机制导论 by 666bj,
[NGA thread](https://ngabbs.com/read.php?tid=46094556); English translation by
sten, 2026-04-03) that several simulators cite, with in-game verified worked
examples. Bundled in the Zero Sanity and End-DPScope repos.

## 4. Reference results and existing simulators

These are what the MVP should reproduce.

### ZMDLogs

zmdlogs.com, source MIT:
[medps16000/endfield-suite-open](https://github.com/medps16000/endfield-suite-open)
(site and Windows client). [deepdarkssj/ZMDLogs](https://github.com/deepdarkssj/ZMDLogs)
is a different project with the same name: a local overlay that stores
nothing on a server. API documented in
[Statrue/astrbot_plugin_zmdlog](https://github.com/Statrue/astrbot_plugin_zmdlog)
(UPSTREAM.md).

- **What it is:** a community battle-log site (like FFLogs). A capture client
  records real fights.
- **Per battle:** each hit's actual damage; from parser v57 (~2026-09-25)
  also crit flag, crit rate, crit damage and uncapped damage; full loadouts
  (levels, potentials, weapon refinement, skill levels, gear with stats);
  boss; cast timeline. Per-hit values sum exactly to the total (verified on
  15 battles). Parser v58 from 2026-10-05, **v59 from 2026-10-15 (1.6)**.
- **Access** (verified 2026-10-18):
  - `GET /api/v1/battles/{id}/export` (documented for external tools,
    60 requests/min per IP per a third-party note): schema v1, **loadout and
    cast timeline only, no per-hit damage**.
  - `GET /api/battles/{id}` (the site's own call, may change without
    notice): `timelineEvents` with per-hit `value`, element, `poiseDamage`,
    `hitContext.critical` (`isCritical`, `critRate`, `critDamageBonus`,
    `uncappedDamage`, `damageCap`). Multiplier zones are not on hits but on
    buff events: `effects[{zone, element, rate, …}]` with zones `dmg_inc`,
    `vuln_taken`, `fragile`, `atk`, `res`, `prod_vuln_taken` (mapping to our
    zones inferred, not documented). No stat panel (`initialBaseline.attrs`
    empty), so stats must be computed from the loadout.
  - No battle list or search. Find candidates through boards:
    `GET /api/home/hot-bosses` → `GET /api/bosses/{slug}/rankings` (each
    account's fastest run only) or
    `GET /api/characters/{charId}/profile?range=all`.
- **Caveats:** real fights include movement, damage caps and multi-part bosses;
  enemy stats must come from the datamine; older uploads lack crit flags.
  Logs are made with a packet-capture client, which may conflict with the
  game's terms; reading the public API is lower risk. Player names and IDs
  should be dropped.
- **Verdict:** the best source of ground truth found. Ideal for per-hit
  validation once single hits are right.

Example battles (totals verified): `btl_upload_960a800ae840` (3,375,148,
~75 s, 2 targets), `btl_upload_9e9fe2ffaf34` (9,725,405, ~69 s, 3 targets),
`btl_upload_f239236b857f` (4,939,659, ~131 s, single target). All include
Laevatain.

**Fixture candidates** (single target, parser v57+):

| Battle | Target | Parser, date | Length / hits | Notes |
|---|---|---|---|---|
| `btl_upload_40d9a3c1da37` | Rhodagn rush, `eny_0051_rodin` Lv90 | v59, 2026-10-16 (1.6) | 19 s / 57 (13 Laevatain) | Same enemy as the Zero Sanity fixture; Laevatain P5, Forgeborn Scathe R6, skills L12; ultimate-enhanced hits, burning, 2 reactions; two identical `ult_attack4` hits. But Laevatain only 50% of damage, Si 46%; ultimate cast before the timer; 8 hits lack crit data. **First choice for single-hit arithmetic.** |
| `btl_upload_f239236b857f` | `eny_0125_fdcentur` | v57, 2026-09-28 (1.5) | 130 s / 532 | Laevatain 87%, all hits crit-verified, full kit. Buff-heavy; needs data pinned to 1.5. **Full-kit fixture once buffs are modelled.** |
| `btl_upload_7e19489ae503` | Rhodagn rush | v58, 2026-10-12 | 36 s / 105 | All hits crit-verified, no Si; top dealer is the Endministrator (34%). |

Rhodagn-rush kills total 2,292,898–2,292,917 against Lv90 HP 2,292,909 (last
hit capped), a hint about per-hit rounding.

### Zero Sanity Simulations

<https://www.endfieldsimulations.dev/>, source
[mitchell-ma/zero-sanity-timeline](https://github.com/mitchell-ma/zero-sanity-timeline)
(TypeScript, **MIT**).

- **Models:** a full timeline: SP, ultimate energy, combo windows, link,
  infliction and reactions, physical statuses, stagger, susceptibility, amp,
  crit modes, finisher.
- **Coverage:** 26 operators; repo not updated since 2026-05-10 (no Si,
  Typhoeus, Mifu…). Data hand-written from a wiki.
- **Tests with in-game verified expected values** for Laevatain (Lv90, P5,
  all skills L12, Forgeborn Scathe Lv90, Tide Fall Light Armor, Hot Work
  Gauntlets, 2× Redeemer Seal, vs Rhodagn, non-crit): effective ATK ≈5871,
  plus per-hit damage for basic attacks, battle skill ticks, combo, ultimate
  enhanced attacks and combustion DoT. A second, smaller case covers
  Zhuang Fangyi's stat panel.
- **Caveat:** values are from ~March 2026 and may predate balance changes.
- **Verdict:** best first MVP target. It's fully specified, in-game verified
  and freely licensed.

### Endaxis and End-DPScope

- **[Endaxis](https://github.com/Lieyuan621/Endaxis)** (end-axis.com):
  frame-accurate simulator built from the native tables including
  SkillData/BuffData. 34 operators, current patch, very active, the Chinese
  community standard. **No licence: compare outputs only, don't copy code.**
  One unverified forum report says it's ~10% off real recordings, mainly
  from shatter/freeze ordering.
- **[End-DPScope](https://github.com/Lex1slt/End-DPScope)** (MIT for its own
  code): wraps the Endaxis engine and ships fully specified scenario files
  with logged totals. Standard scenario: Last Rite, Tangtang, Arcane, Xaihi vs
  `eny_0082_hsbear` Lv90, 120 s → **3,700,482**, with three single-change
  variants (armour swap → 2,532,224; weapon swap → 2,601,532; basic attack
  L1 → 3,625,967).
- **Verdict:** good full-rotation cross-check, but it's another simulator's
  output, not ground truth. Use a loose tolerance.

### Others

| Tool | Verdict |
|---|---|
| EndfieldHub calculator / tier list | Closed; "71K team DPS" claim lacks gear and rotation. Not usable as a fixture. |
| EndSync, efsim.app, Essence Solver, ENDFIELD SIM (JP) | Closed source; no published reproducible numbers found. |
| [arknightsendfield.gg](https://arknightsendfield.gg/character/typhoeus-build/) "Datafield runs" | In-game totals (e.g. Typhoeus/Perlica/Liino/Arcane, 66 s, 7,089,179; verified 2026-10-18, figures credited to Datafield) but only partly specified. |
| [Taksumii/Arknights-Endfield-DPS-Calc](https://github.com/Taksumii/Arknights-Endfield-DPS-Calc) | Single-hit, January, outdated level coefficient. Low value. |
| lakeofsky347/endfield_modeling, xinwenli/EndfieldDamageSimulator, wxhwwla/calc-framework (AGPL) | Smaller projects; useful for comparing approaches only. |

## Recommendation

1. **Primary game data:** rmxlinux/EndfieldData, pinned to commit SHAs.
2. **Secondary / regression data:** 555me/beyondGameData. Automated cross-check
   of the table layer against the primary on every data update.
3. **Formula reference:** Talos Wiki + 666bj documentation, with the open
   questions above resolved from SkillData/BuffData or in-game tests.
4. **Human-readable spot checks:** Talos Wiki and EndfieldHub.
5. **MVP fixtures, in order:**
   1. Zero Sanity Laevatain hit table and stat-panel tests (single hits and
      stat aggregation). Re-check against current-patch data first.
   2. One short single-target ZMDLogs battle, matched hit by hit.
   3. The End-DPScope standard scenario and its variants, as a loose
      full-rotation cross-check.

## Decisions

Decided 2026-10-18:

1. **Sources:** the recommendation above is adopted.
2. **Storage:** data repositories are linked as git submodules under
   [`data/`](../data/README.md). This pins exact upstream commits without
   republishing the data, and local clones still hold full copies.
3. **Existing simulators** are a starting point, linked as submodules under
   [`reference/`](../reference/README.md): Zero Sanity (MIT), Endaxis (no
   licence: read and compare only, don't copy code) and End-DPScope (MIT for
   its own code).
4. **ZMDLogs:** using already-published logs through its public API is fine.
5. **Network access:** the cloud environment's allowlist and each host's
   usefulness are tracked in [network-allowlist.md](network-allowlist.md).
   end.wiki no longer resolves in DNS (2026-10-18).
