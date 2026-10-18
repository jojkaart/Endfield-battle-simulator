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
| Talos Wiki | Text CC BY-SA 4.0 (`siteinfo` rightsinfo, Copyrights page). robots.txt disallows `/api.php` for all agents, asks for responsible automated traffic, `Content-Signal: use=reference, ai-train=no`. | Cite with a link; don't copy text or Lua modules (share-alike). Only a few targeted API lookups, descriptive user agent, no crawling. |
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
| Human-readable data cross-check | Talos Wiki | EndfieldHub, end.wiki, Icy Veins |
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
  damage page was last edited ~231 days ago, so parts may be stale.
- **Data origin:** not stated, but matches the tables exactly.
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
| [BWIKI](https://wiki.biligame.com/zmd/) (CN) | Skill tables Lv1–9 + 专1–3. Front page once said data was incomplete. No content licence; all rights reserved (verified 2026-10-18). |
| [Huiji wiki](https://endfield.huijiwiki.com/wiki/伤害), [GameKee](https://www.gamekee.com/zmd/691878.html) (CN) | Damage formula from community testing; agrees with the Talos Wiki. Some labelling errors. |
| end.canmoe.com | The CEP planner ([cmyyx/cep](https://github.com/cmyyx/cep), AGPL-3.0). Datamine-style IDs and full level tables. Extra cross-check. |
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

From the Talos Wiki, with EndfieldHub, Huiji, GameKee and the 666bj
documentation agreeing. Constants marked † are also confirmed in the raw
`BattleConst` table.

```
DMG = ATK × BaseMult × MultiplierGroup × Crit × Amp × Stagger × Finisher × Link
      × Weaken × Susceptibility × IncreasedDMGTaken × DMGReduction × Protection
      × DEF × RES × Multiplicative
```

- **ATK** = `((OperatorATK + WeaponATK) × (1 + ATK%) + flat) × (1 + 0.005 × MainAttr + 0.002 × SecondaryAttr)` †.
  Attributes may be fractional; calculations use exact values.
- **MultiplierGroup** = 1 + sum of DMG bonuses (element, skill type,
  vs staggered…).
- **Crit:** base 5% rate, +50% damage. DoT can't crit.
- **DEF:** `100 / (DEF + 100)` for DEF ≥ 0 †; `2 − 0.99^(−DEF)` below 0. All
  enemies have 100 DEF (×0.5).
- **RES:** `(100 − EnemyRES + IgnoreRES + CorrosionShred) / 100`; grades map
  to 0 / 0.2 / 0.5 / 0.8 / 1 †.
- **Stagger:** ×1.3 while staggered. **Finisher:** ×1 / 1.25 / 1.5 / 1.75 by
  enemy tier.
- **Link:** battle skill +30/45/60/75%, ultimate +20/30/40/50% by stack count.
- **Reactions and statuses:** Arts Burst 160%; Arts Reaction 80% + 80% per
  infliction stack; Lift/Knockdown 120%; Crush 150% + 150% per Vulnerable
  stack; Combustion DoT 12% + 12% per level; Shatter 240–600%.
- **Level coefficient** (operator level, reactions only): arts
  `1 + (Lv−1)/196`, physical statuses `1 + (Lv−1)/392`.
- **Arts Intensity:** ×(1 + AI/100) on reactions, bursts and physical
  statuses.

### Open questions

1. **Breach:** Talos Wiki says +12–24% Physical DMG taken; EndfieldHub says it
   makes DEF negative. Biggest disagreement.
2. **Corrosion vs Arts Intensity** scaling (a "soft cap 300%" is claimed).
3. **Grouping of stagger** with other multipliers. Doesn't change the arithmetic
   shown above, but matters for which buffs stack additively.
4. **Rounding rules.** A Japanese article
   (note.com/at67275, "Decimals and Rounding in Damage Calculation") may cover
   this; unread. One repo notes ±0.1% rounding differences.
5. **Frame rate** of skill timelines: Endaxis uses 30 FPS; one End-DPScope
   scenario mentions 60 fps.

These can be settled from the raw SkillData/BuffData, or by in-game tests.

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
- **Per battle:** each hit's actual damage and the multiplier zones applied;
  from parser v57 (~2026-09-25) also crit flag, crit rate, crit damage and
  uncapped damage; full loadouts (levels, potentials, weapon refinement,
  skill levels, gear with stats); boss; cast timeline. Per-hit values sum
  exactly to the total.
- **Access:** public read-only export API (`GET /api/v1/battles/{id}/export`,
  60 requests/min), intended for external tools.
- **Caveats:** real fights include movement, damage caps and multi-part bosses;
  enemy stats must come from the datamine; older uploads lack crit flags.
  Logs are made with a packet-capture client, which may conflict with the
  game's terms; reading the public API is lower risk. Player names and IDs
  should be dropped.
- **Verdict:** the best source of ground truth found. Ideal for per-hit
  validation once single hits are right.

Example battles: `btl_upload_960a800ae840` (3,375,148 over ~75 s),
`btl_upload_9e9fe2ffaf34` (9,725,405 over ~69 s),
`btl_upload_f239236b857f` (4,939,659 over ~131 s). All include Laevatain.

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
