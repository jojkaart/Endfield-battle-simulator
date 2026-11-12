# Combat mechanics reference

Reviewers use this document to check operator and equipment kits
(`packages/data/kits/operators/*.json`, `packages/data/kits/equipment/*.json`)
for anything that conflicts with how combat works. Each rule is a short
statement, followed by its source and a confidence tag:

- **SETTLED**: the logs or an in-game result settled it, or it was checked
  against the game data and the logs agree.
- **DATA**: read from the game data (SkillData, BuffData, TableCfg), not
  checked against logs.
- **ASSUMED**: the engine's choice, with no evidence for or against it yet.
- **OPEN**: contested. The entry in [open-problems.md](open-problems.md) or
  the in-game test is cited.

Sources are cited by file. "Accuracy plan" is [accuracy-plan.md](accuracy-plan.md),
"design" is [design.md](design.md), "data-sources" is [data-sources.md](data-sources.md#3-damage-formula),
and "test N" is [in-game-tests.md](in-game-tests.md). Log IDs such as 9a80,
4e5e and e82d are the ZMDLogs fixtures, short for `fixtures/**/zmdlogs-<id>…json`.
Kit vocabulary follows [schemas/kit.schema.json](../schemas/kit.schema.json).
Where the engine code and the docs disagree, the entry says so; those cases
are also collected [near the end](#where-the-code-and-the-docs-disagree).

## 1. Damage formula

### 1.1 Zones and how they combine

One hit's damage is:

```
ATK × scale × (1 + ΣdamageBonus) × crit × (1 + Σamp) × (1 + Σsusceptibility)
    × (1 + ΣdamageTaken) × Π(1 + multiplicative_i) × DEF × RES
```

The result is rounded to the nearest whole number (`packages/engine/src/damage.ts`
`computeDamage`, `effects.ts` `ZONES`).

- In BuffData, every damage modifier names a side (attacker or defender) and
  a zone. `NormalCalcZone` modifiers add within their side, and each
  `ProdCalcZone` modifier multiplies on its own. [DATA] (game-data-format,
  data-sources "How the game groups modifiers")
- **damageBonus** (ZMDLogs `dmg_inc`): one additive pool for element DMG,
  skill-type DMG (basic, battle, combo, ultimate), "DMG vs Staggered"
  (attribute 61) and the generic "DMG +x%" of weapons and talents.
  [SETTLED] (logs list them as one zone; effects.ts `ATTR_ZONES`)
- **amp** (attributes 64–69, per element): its own 1 + Σ. Two Cryo Amps
  from different operators add up. [SETTLED] (abfd, batch-3 "Log fixture
  corrections")
- **susceptibility** (ZMDLogs `fragile`, attributes 70–75): its own 1 + Σ.
  Instances of `buff_common_affixes_vulnerable_<element>` from two sources
  add up, even though the buff has a priority key. [SETTLED] (b7b3,
  `packages/data/src/buffData.ts`). Two different Arts Susceptibility
  sources (Gilberta with Estella, or Ardelia): [OPEN] (test 38).
- **damageTaken** (ZMDLogs `vuln_taken`): its own 1 + Σ. It holds Breach,
  Electrification, and the "target takes DMG +x%" effects of weapons and
  talents. [SETTLED] (Electrification's rates in e82d and d9e5)
- **multiplicative** (ZMDLogs `prod_vuln_taken`, ProdCalcZone): each source
  multiplies as × (1 + v). This zone holds Stagger (+0.3), the finisher
  multiplier (enemy attribute 27 − 1), Link, and effects such as
  Fluorite's 30%. [SETTLED] for Stagger, Link and the finisher (40d9's Link
  ×1.2000; data-sources)
- **atk**: buff ATK% joins the panel's ATK% before the attribute bonus is
  applied. It is not a separate multiplier. [SETTLED] (logs' `atk` zone;
  in-game test 77; damage.ts)
- **attribute**: buffs that add Strength, Agility, Intellect or Will raise
  ATK through the attribute bonus, as the stat panel would compute it.
  [DATA] (damage.ts `buffedAttributeBonus`)
- **ignoreResistance** (ZMDLogs `res`): adds resistance points back.
  Corrosion's shred is in this zone. [SETTLED] (4a64 Corrosion fit, round
  4)
- **Weakness** (attribute 62) and **Protection** (attribute 63) are fixed at
  ×1 in damage. The engine reads them only as buff categories for
  triggers. [ASSUMED] (effects.ts `READ_ATTRS`, damage.ts `NOT_MODELLED`).
  Per the Talos Wiki (data-sources), Weakness stacks multiplicatively and
  Protection can go negative; enemy damage isn't simulated.
- **Burst DMG and Arts-reaction DMG attributes** (35–38, 56–59) aren't
  modelled. A panel or kit buff that carries one is refused, never
  silently dropped. [ASSUMED] (effects.ts `UNMODELLED_DAMAGE_ATTRS`; data-sources
  open question 5). No equippable source in the current data writes them.

### 1.2 ATK

- ATK = ((operator base + weapon base) × (1 + ATK%) + flat ATK) × (1 +
  0.005 × main attribute + 0.002 × secondary attribute + Σ ATK-per-point
  factors). [SETTLED] (BattleConst `atkRateOfMain` / `atkRateOfSub`; the
  Laevatain panel matches)
- The attribute bonus uses whole attributes (floored); an in-game ATK of
  5871 needs this. [SETTLED] (data-sources "Rounding", open question 4)
- ATK-per-point attributes (76–79, for example Lifeng's talent 1) add
  factor × points to the bonus. [ASSUMED] (stats.ts: "not yet verified in
  game")
- Flat ATK (the stew's +180 ATK) goes in the flat slot. [SETTLED] (7e19,
  test 55)
- Panel totals are ((base + Σadd) × (1 + Σpercent) + Σflat) × Πmultiply,
  clamped to AttributeMetaTable limits. [DATA] (stats.ts `computeStats`)
- Hidden decimals are real: weapon substats follow 1 : 0.8 : 0.6, and gear
  artifice is ×1.1 / 1.2 / 1.3. [SETTLED] (data-sources "Rounding")

### 1.3 Scale

- A hit's multiplier is the product of its blackboard keys (`scale`) at the
  skill's level after potentials, times a literal `factor` (a SimpleCalcBB
  ×/÷ in the graph), times `scaleValue` and `extraScale` where the kit
  writes them. [DATA] (damage.ts `computeHit`; kit-abstractions §1)
- Blackboard values and castData inside a SkillData file are defaults.
  `SkillPatchTable` gives the real per-level values. Laevatain's file says
  cost 0, the table says 100 SP. [SETTLED] (game-data-format)
- `base` replaces ATK as what the multiplier multiplies (for example 300 +
  5 × DEF; MultiplyAttributeCalculation). Every other zone applies as
  usual. [DATA] (schema `hit.base`)
- **Fixed DMG** (SkillData damageType 8, `fixedDamage`): exactly the value.
  No ATK, zones, crit, DEF, RES or Stagger apply. [DATA] (damage.ts
  `fixedHit`)

### 1.4 Crit

- The base crit rate is 5% and the base crit DMG is +50%. With rate r and
  crit DMG d, a crit hit is × (1 + d); `expected` mode gives × (1 + r·d).
  The rate is clamped to [0, 1]. [SETTLED] (Rossi's ×2.9 crit ratio in
  9a80 is exactly the engine's)
- Combustion ticks can't crit. [SETTLED] (data-sources; ticks show one value
  in logs). The engine lets every other hit crit, bursts and reactions
  included. [ASSUMED] (damage.ts `computeReaction`; 489c's Combustion fits
  "level 3, or level 1 with a crit")
- Under `expected` crits, no hit counts as a crit for `on: {event: "hit",
  crit: true}` triggers, so crit-triggered effects never fire. This is an
  engine mode, not a kit error. [ASSUMED] (design "Crit modes"; accuracy
  plan B9)

### 1.5 DEF

- DEF factor = 100 / (DEF + 100) (BattleConst `efficiencyOfDEF`). Every
  enemy has 100 DEF at every level, which gives ×0.5. [SETTLED] (data-sources †;
  Hard 27 checked at every level)
- No buff lowers DEF below 0. The engine has 2 − 0.99^(−DEF) for negative
  DEF (Talos), but that case can't be reached. [DATA] (data-sources ‡)
- A food's "DEF +x%" uses formula item 1, whose formula isn't known. It is
  kept out of DEF, and readers of DEF refuse it. [OPEN] (test 98)

### 1.6 Resistance

- RES factor = (100 − enemy resistance points + Σ ignoreResistance) / 100.
  The points are enemy attributes 94–99 (physical, natural, cryst, pulse,
  fire, ether). [SETTLED] (Tower 15 klbear's physical 20 peaks sharply in
  458b; `packages/data/src/tables/enemies.ts`)
- There is no floor. Shredded resistance can go below 0, and the factor
  then exceeds ×1. [SETTLED] (accuracy plan "Settled or excluded")
- The scalar attributes 80–85 (1 − points / 100) are stale on
  `eny_0125_fdcentur`. The points count. [SETTLED] (c3c7)
- Hard 27's `eny_0124_kltdcap_hdg027` takes physical hits as if its
  resistance were 11, not the data's 20 (×1.1125). [OPEN] (open-problems
  "Hard 27"). Don't blame a kit for a ×1.11 on physical hits there.

### 1.7 Level coefficients

- Arts reactions, bursts and Shatter are scaled by attribute 49
  (IgniteDamageScalar) = 1 + (Lv − 1) / 196, which is 1.4541 at level 90.
  [SETTLED] (CharacterTable, all 3,605 rows; 40d9's bursts)
- Physical-status hits (Lift, Knock Down, Crush, Breach, and "Crush DMG"
  hits such as World Splitter) are scaled by attribute 25 = 1 + (Lv − 1) / 392,
  which is 1.2270 at level 90. [SETTLED] (test 91 answered)
- Direct skill hits have no level coefficient, and enemies have no level
  multiplier. [SETTLED] (data-sources)

### 1.8 Rounding and numerics

- Final damage rounds to the nearest whole number. Whether exact .5 rounds
  half-up or half-even is untested. [SETTLED] (Zero Sanity in-game hits;
  damage.ts `roundDamage`)
- Table floats are float32 expansions. The engine computes in doubles.
  [ASSUMED] (design "Numerics")

## 2. Skill types, damage types and decorations

### 2.1 Skills and their kinds

| Kind | Skill IDs | `skillSpecification` | Priority | Decorate bit |
|---|---|---|---|---|
| basic | `attack1…5`, `dash_attack`, `ult_attack*` variants | 1 | 1 | 128 |
| finisher (kind basic) | `power_attack` | 8 | 2 | kind basic; the engine adds the decoration "finisher" (4) from skillSpecification 8 |
| dive (kind basic) | `plunging_attack_start` / `_end` | 6 | always may interrupt | kind basic, plus 1024 (dive) |
| battle | `normal_skill*` | 3 | 2 | 256 |
| combo | `combo_skill*` | 4 | 5 | 8192 |
| ultimate | `ultimate_skill*` | 5 | 7 | 512 |
| perfect dodge | the dodge skill | 2 | — | — |

Sources: [DATA] for the decorate bits (`packages/data/src/skillCompile.ts`
`DECORATE_BITS`) and for skillSpecification. The priority numbers are
[ASSUMED]: they come from Endaxis's native-type table, described in design
"Skill timing". Note the naming: the glossary's "Final strike / heavy =
`power_attack`" is out of date. `power_attack` is the **finisher** (a hit
on a Staggered enemy, skillSpecification 8). A **Final Strike** is the
decorate bit 2097152 on a chain's last landing; only the second landing
of Laevatain's attack5 has it (batch-1 "Kit errors found").

### 2.2 Decorations and status bits

- Final Strike: 2097152. Dive: 1024. Finisher: 4 (the skill is
  skillSpecification 8). Crush DMG: 16384. Lift: 32768. Knock Down: 65536.
  Breach: 1073741824. Shatter: 134217728. [DATA] (effects.ts, data-sources
  "Physical state", schema `buffs[].modifiers[].decorations`)
- What counts as a basic, battle, combo or ultimate hit for bonuses and
  triggers comes from the hit's decorate-mask kind. `damageType` on a hit
  overrides it only where the mask lacks its skill's kind. A triggered hit
  must name its type, and `"none"` is a hit of no skill type (weapon and
  gear-set procs): no skill-type DMG applies to it. [DATA] (schema
  `hit.damageType`)
- Reactions, bursts, Combustion ticks, physical-status hits and hits marked
  `status` or `reaction` take **no skill-type bonus**. They do take
  element DMG of their element, Amp, Susceptibility and damageTaken.
  [SETTLED] (World Splitter has no Battle Skill DMG: test 91; Camille's
  Combustion takes Lustrous Carmine's Heat DMG: 4e5e, effects.ts
  `SNAPSHOT_ZONES`)
- A buff modifier with `onlyKinds` (bursts only, reactions only, and so
  on) or `decorations` (Final Strike only) is the game's
  CheckDamageDecorateMask condition. It must match the BuffData condition.
  [DATA]
- Whether sub-skills (Si's, Liino's, Typhoeus's, Mi Fu's) count as a battle
  skill for "on battle skill" effects: [OPEN] (test 29).

## 3. Arts: inflictions, bursts, reactions

### 3.1 Inflictions and bursts

- An enabled `SpellInfliction` next to a DamageAction inflicts: type 0
  Heat, 1 Electric, 2 Cryo, 3 Nature. 45 are enabled across the operator
  files; the 9 disabled ones are unused variants. A kit's `applies` must
  match the enabled ones. [DATA] (design "Arts state and stacks"; the loader
  checks applications against the data)
- An infliction lasts 20 s and holds at most 4 stacks. The same element
  again adds stacks, resets the 20 s and triggers an **Arts Burst**: 160%
  ATK of that element. [SETTLED] (Talos; 160% verified in 40d9)
- A burst lands 1 s after the infliction (`burstDelayFrames`: the
  triggerInterval of `buff_common_<e>_<e>_triggered`, 1.0 s) on its
  operator's clock: see §6.3. [SETTLED] (dbae, 0eef; Arcane's touch bursts
  1–1.5 s after the touch)
- Application elements in kits:
  - `"enemy"`: the element the enemy has now; nothing happens without one.
  - `"event"`: the element of the event behind it (a combo's window
    opener at the cast).
  - `"window"`: the latest element the owner's combo-window trigger saw
    since the cast began. Otherwise it is the window's opener, then the
    enemy's current element. For a reaction, it is the infliction the
    reaction consumed. [SETTLED] for Arcane's WILL touch (round 5: 9a80,
    3f78). Latest opener against first opener: [OPEN] (test 33).
- `consumeInfliction` absorbs stacks without a reaction (for example
  Laevatain's Final-Strike Heat absorption). `stacks` limits how many are
  taken; the rest keeps its timer. [DATA] (`FinishBuffAdvanced
  finishLayerCnt`)

### 3.2 Reactions

- A different element **consumes** the current infliction and triggers the
  reaction of the **new** element, at level = consumed stacks (1–4). The
  initial hit, of the new element, is 80% + 80% × level of ATK. The new
  element isn't left behind as an infliction. [SETTLED] (Talos; Heat +
  Nature at 1 stack = 160%, 40d9)
  - Heat → Combustion. Electric → Electrification. Cryo → Solidification.
    Nature → Corrosion.
  - Log key: `buff_common_<new>_<consumed>_triggered`. A burst's key is
    `buff_common_<e>_<e>_triggered`. [SETTLED]
- A **forced reaction** (`forcedReaction`; `ForceSpellStatusAction`, or the
  shared `buff_common_<el>_<el>_<status>_triggered`) consumes nothing,
  deals no initial hit and is level 1 unless the kit says otherwise
  (`level: {consumed: true}` takes the stacks a preceding
  `consumeInfliction` took). `durationKey`, `scaleKey` (`extra_scaling`)
  and `extraSeconds` come from the skill. [DATA] (kit-abstractions §1;
  status.ts)
- Reapplying a status replaces the old one and resets its duration.
  [ASSUMED] (Talos; status.ts `withStatus`). A forced Electrification on a
  stronger running one: [OPEN] (test 66).
- What a hit applies takes effect **before** its own damage. The hit that
  forms a Corrosion includes its shred: the logs show Gilberta's explosion
  and Arcane's battle skill with the Corrosion they trigger. Use
  `afterDamage` only where the data has the FinishBuff or consumption after
  the DamageAction. [SETTLED] (timeline rules.ts `TIMELINE_ASSUMPTIONS`;
  schema `application.afterDamage`)
- A reaction's own initial hit sees the buffs that `beforeDamage` triggers
  on it apply (Perlica's P3 on her Electrification's hit). [SETTLED] (e82d;
  design "Arts state")

### 3.3 Combustion (Heat)

- Initial hit 80% + 80% × level. Then a tick every second of
  12% + 12% × level of ATK (24% at level 1), 10 ticks over 10 s, the last
  as it ends. [SETTLED] (40d9; 0c14 and d572 count 10 ticks).
  `buff_common_burning_status` says 11 s, but 11 s fits the logs worse:
  the code keeps 10 s on purpose (status.ts `STATUS_FRAMES`; accuracy plan
  B5).
- The ticks **snapshot** the applier's attacker side at application: ATK,
  attribute bonus, DMG bonus, Amp and Arts Intensity (DamageAction
  `takeAtkSnapshot`). The defender side (Susceptibility, damageTaken,
  multiplicative including Stagger, resistance) is read at each tick.
  [SETTLED] (4e5e, 40d9 18684 ms, 458b; test 77 answered)
- 458b shows a tick ×1.28 after a Heat infliction lands on a burning enemy,
  as if the snapshot were taken anew. [OPEN] (accuracy plan "458b's
  Combustion ticks")
- Rossi's bleed uses the same snapshot flag. A `buffTick` trigger's hit
  takes it through `atkSnapshot`. [DATA]

### 3.4 Electrification (Electric)

- Arts DMG Taken (damageTaken zone) of +12 / 16 / 20 / 24% by level ×
  (1 + 2·AI / (AI + 300)), where AI is the applier's Arts Intensity at
  application. It lasts 12 / 18 / 24 / 30 s. [SETTLED] (e82d 0.39571 at AI
  287.4, level III; d9e5 0.12 at AI 0)
- The engine applies it to the four arts elements only. ZMDLogs lists the
  reaction Electrification for element "all" and the forced one for the
  four arts elements. [OPEN] (data-sources "Electrification"). Perlica's
  forced one is level I × 1.33, probably a talent or potential.

### 3.5 Corrosion (Nature)

- The shred is resistance points for **all** elements, Physical included,
  shown in the logs on attributes 94–98. By level, × (1 + 2·AI / (AI + 300))
  of the applier at application:
  - start 3.6 / 4.8 / 6 / 7.2;
  - +0.84 / 1.12 / 1.4 / 1.68 per full second;
  - cap 12 / 16 / 20 / 24.

  It lasts 15 s. [SETTLED] (4a64's first Corrosion fits 1.000 ± 1 at every
  shred step; `def_decrease` is only a key name, not DEF)
- A ramp in whole seconds is the engine's reading and fits the logs.
  Behaviour under slow-downs and freezes: [OPEN] (tests 4 and 37).
- **Carry-over:** a Corrosion applied while one is running starts from the
  running one's shred (the stronger of that and its own start). It then
  ramps to its own cap, which its first tick clamps to. [SETTLED] (the
  wrapper's GetTargetBuffBBAdvanced; a7a7 plain 137 → 315)
- **Its own initial hit** (log key `buff_common_natural_triggered`) is dealt
  by the Nature wrapper before the status exists. So that hit sees neither
  its own shred nor what the new status triggers. [SETTLED] (accuracy plan
  B7: all 10 logged)
- Hot Work's Nature DMG, made when a hit forms a Corrosion, counts on the
  forming hit but not on Corrosion's own hit. [SETTLED] (3f78, 4a64 ×1.5
  exactly; test 51, partly answered)
- `statusTweaks` (Arcane's talent: `capScale`, `extraSeconds`) changes the
  cap and the duration. A forced Corrosion's `extra_scaling` multiplies its
  start, its per-second gain and its cap. [DATA]

### 3.6 Solidification (Cryo) and Shatter

- The engine's durations are 5.75 / 6.75 / 7.75 / 8.75 s by level (Talos).
  The native settings say 6 / 7 / 8 / 9 s. [OPEN] (accuracy plan B4, test
  71; the code and the docs disagree)
- **Shatter:** a physical status, or any new Vulnerable stack, on a
  Solidified enemy consumes the Solidification. It deals 120% + 120% ×
  level (2.4–6) Physical, after the status's own hit, with the arts level
  coefficient; Vulnerable is unaffected. [DATA] (BuffData
  `buff_common_cryst_triggered_physical_break`; data-sources "Physical
  state")
- Whether a Shatter counts as consuming a reaction, for combo triggers:
  [OPEN] (test 63).

## 4. Physical statuses

- **Vulnerable** (`buff_physical_no_guard`) has at most 4 stacks and lasts
  20 s. It is stackingType 8, so each new stack refreshes one shared timer.
  Only physical-status actions and skills that create it directly add
  stacks; plain physical hits don't. [DATA] (BuffData; data-sources)
- A physical status on an enemy without Vulnerable only adds one stack,
  unless it's a forced Lift or Knock Down (`forceAirborne`,
  `forceKnockDown`; `physicalStatus.forced`). Crush and Breach have no force
  flag. [DATA]
- Whether adding Vulnerable at 4 stacks, or to an enemy that already has
  it, fires "Vulnerable" combo triggers: [OPEN] (test 64; schema `vulnerable`
  event: `rising`, `fromNone`).
- **Lift** (`buff_physical_airborne`, 3 s) and **Knock Down** (10 s): +1
  Vulnerable, which isn't consumed, and a 120% Physical hit. **They deal no
  Stagger of their own.** The log lists one Stagger event shared by the hit
  and its Lift (155 of 156 Lifts, 69 of 69 reactions). The data's `poise 10`
  and the old 10 × (1 + AI/200) formula are not used. [SETTLED]
  (accuracy plan "screened logs" item 3). The one exception, 4e5e at
  12219 ms: [OPEN].
- **Crush** (`buff_physical_do_crushed`, mask 16384) consumes all n stacks.
  Its hit is 150% + 150% × n (3 / 4.5 / 6 / 7.5) × the action's
  `damageMultiplier` (`multiplierKey`). [DATA]. A "Crush DMG" skill hit
  (`hit.status: "crush"`) takes Crush's level coefficient and Arts
  Intensity and no skill-type bonus. [SETTLED] (test 91)
- **Breach** (`buff_physical_do_fracture`) consumes all n stacks. Its hit is
  50% + 50% × n (1–2.5). It adds Physical damageTaken of +12 / 16 / 20 / 24%
  × the applier's AI effect × `extra_scaling` (`scaleKey`; the key is the
  misleading `physical_res_down`). A new Breach replaces the old one
  (stacking key `fracture`). [DATA]. Its AI scaling is untested [OPEN]
  (test 3). Its duration is 12 / 18 / 24 / 30 s by level in the engine
  (Talos), while the buff file's own default is 15 s [ASSUMED; the code and
  the data differ].
- Physical-status hits scale × (1 + AI/100) and use the physical level
  coefficient (§1.7). [SETTLED] for Crush (test 91) and Lift (4e5e)

## 5. Stagger

- **Bar.** Stagger HP is enemy attribute 20 (Rhodagn 280). Stagger Nodes
  are `poiseKnotPctList`, and passing a node is a `staggerNode` event. Its
  buff (`buff_common_mini_poise_break`, a 2.5 s interrupt) has no damage
  effect in the engine. [DATA]
- **Per hit:** Stagger = the hit's `poise` × the attacker's attribute 26
  (Stagger efficiency, buff filters included) × the enemy's attribute 24.
  It comes only from damage units of damageAttributeType 1. A unit without
  one deals none, so Arcane's lasers deal no Stagger. [SETTLED] (29 logs'
  bars match hit for hit; 012a)
- A hit and the Lift, Knock Down or reaction it causes are **one** Stagger
  event. The log credits a reaction the triggering hit's poise a second
  time, but the bar drops once. [SETTLED] (screened logs, item 3)
- **Final Strikes' Stagger counts only while their operator is
  controlled** (`onlyEnableForMainChar`; `poiseControlledOnly`).
  Teammates' Final Strikes deal none. [SETTLED] (one operator per fight has
  Stagger on its basic hits; accuracy plan B1)
- At 0 the enemy is **Staggered**: × 1.3 damage taken
  (`buff_common_poise_break_damage_taken_scale`, defender ProdCalcZone,
  `dmg_up` 0.3), its own multiplier. While Staggered it takes no more
  Stagger and allows one finisher. [SETTLED] (data; logs). "DMG vs
  Staggered" bonuses add into damageBonus instead (attribute 61,
  `staggeredOnly`).
- **Duration:** attribute 21 × attribute 31 (about 10 s) on the enemy's
  clock, so time stops extend it. The logged windows are 0.3–2.3 s longer
  (median about 1.1 s), which nothing explains yet. [SETTLED] for the base
  and the stops; [OPEN] for the extra (accuracy plan B1)
- **Recovery:** the bar never recovers on its own; it refills at a
  Stagger's end. Bosses jump straight to full with no Stagger before:
  second lives (3aa6, c3c7, d774), Rhodagn at 29.5–45 s in 3 of 5 fights
  (not tied to a fixed HP), and Hard 33's slug, which regains bar by
  itself. [SETTLED] (test 99 answered by the logs); what triggers
  Rhodagn's refill: [OPEN] (test 100)
- **Finisher** (`power_attack` on a Staggered enemy): × enemy attribute 27
  (1 / 1.25 / 1.5 / 1.75 by tier, multiplicative zone), plus the team's
  finisher SP `breakingAttackedAtbObtain` (25–100, natural). [DATA]. The
  finisher SP's atbSourceType is 0 [ASSUMED] (constants.ts).

## 6. Time

### 6.1 Frames

- Integer frames at **30 FPS**. All 626 animation actions in `chr_*`
  SkillData convert at exactly 30 fps. Cooldowns, buff durations and
  blackboard values are in seconds. [SETTLED] (data-sources "Frame rate")
- Projectile travel time isn't in the data. Kit hits use the launch frame,
  or a frame read from logs, cited. [DATA] (schema `hit.frames`)

### 6.2 Time stops and slow-downs

- An ultimate's `UltimateTimeAction` (a time stop) and a combo's
  global-layer `TimeDilationAction` (a slow-down, curve `ComboSkill`: 0.01
  for 40% of its duration, rising linearly to 1 at 93%) scale time for
  everyone but the caster. Where they overlap, the lowest scale counts.
  [DATA] for the actions and the curve; the linear ramp is [ASSUMED]
  (design "Time")
- **Held by others' stops and slow-downs:**
  - the world: enemy statuses, inflictions, DoT ticks, combo windows, SP
    regeneration, energy blocks, and **every buff** (the caster's own
    included);
  - other operators' hits on the way, delayed actions and current action.

  [ASSUMED] for buffs and SP (test 18). Rossi's crit-DMG window running
  about 3 s longer in the log than the replay: [OPEN] (open-problems
  "Rossi's ultimate").
- **Cooldowns run on raw time** through stops. [ASSUMED] (test 18)
- An operator whose **own ultimate stop** covers a frame isn't held there by
  another's stop or slow-down. It is held only from its own stop's end.
  [SETTLED] for e82d, dbae and 9a80. How far this reaches (every scheduled
  item, or only the ultimate's own hits; a slow-down that starts before the
  stop): [OPEN] (open-problems "The slow-down rule's reach")
- Hits that ignore others' time stops (`SetIgnoreGlobalTimeScaleAction` on
  Si's battle-skill entities and on Arcane's and Pogranichnik's ultimates)
  aren't modelled. [OPEN] (accuracy plan B6)
- **Hit-stop** (attacker pauses of 0.03–0.4 s on most basic attacks) and
  entity-layer dilation aren't modelled. In the logs, Rossi's chains are
  15–20% slower than the engine's and Arcane's about 4% slower; Camille's
  and Si's match. [OPEN] (accuracy plan B10). Don't "fix" a chain's frames
  to match one log's pace.

### 6.3 Whose clock

- **Arts Burst:** on its operator's clock. Others' stops and slow-downs
  hold it, including ones already running when it is made; its own
  operator's don't, and neither does a freeze. [SETTLED] (dbae's burst
  after Xaihi's stop; 0eef's inside Arcane's own combo)
- **Enemy-clock waits** (a buff on the enemy acting after its
  `triggerInterval`; `hit.enemyDelay`) are held by every time stop, the
  caster's own included. Typhoeus's Power Shot burst comes 0.35 s after
  the arrow (logs 0.26–0.46 s, and 1–2.5 s across a stop). [SETTLED]
  (accuracy plan B8)
- **Freezes** (a `control` with `freezes`: Si's Immobilization, Tangtang's
  OLDEN STARE) stop the enemy's own clock, unless it is control-immune (tag
  188749032, in no table). The engine takes every Boss (rank 2) as immune.
  [OPEN] (test 104; b7b3 and c3c7 fit it)
- **Perfect dodge:** the world is slowed by the data's curve (about 15
  frames lost) and the dodger is exempt. +7 SP and a `perfectDodge` event.
  It ends the current action, unless that is an ultimate before its
  exclusive frames. [DATA] (`buff_common_dash_behit_listener`). 7 or 7.5 SP:
  [OPEN] (test 52)

### 6.4 Haste

- Attribute 92 (`KeywordSpeedUpScalar`, default 1, within 0.1–1.3): the
  cast plays faster (its hits, windows and lock come sooner); cooldowns are
  unchanged. [ASSUMED] (test 19)

## 7. Casting and resources

### 7.1 Action gates

- Nothing is casting after `durationFrame`. An `AllowNextSkillAction`
  window lets the skills it lists start, even before `exclusiveFrame`. A
  skill of higher priority (§2.1) may start at any frame; others wait for
  `exclusiveFrame`. [DATA] for windows and frames; [ASSUMED] for the
  priorities (design "Skill timing")
- Starting a skill ends the current one. Its hits still to land are
  cancelled, except `detached` hits (a projectile or entity already on its
  way; `launch` marks the frame after which a hit is detached). The same
  goes for its delayed cast-trigger actions (unless `detached`) and for
  buffs with `endsWithCast` (CreateBuffAction `autoFinishByAction`).
  [DATA]
- During a `ChannelingCastingAction` with `cantCastSkill` (and a finisher's
  `buff_common_power_attack_disable_cast_skill` frames) the operator starts
  no skill. Whether ultimates are an exception: [OPEN] (test 15). With
  `cantSwitchPosition`, no swap is possible. [DATA]
- A swap costs no time and doesn't stop the controlled operator's action.
  [ASSUMED] (test 15). Ultimates with `takesControl` make the caster the
  controlled operator. [DATA]
- Whether a dash can cancel a skill at any moment: [OPEN] (test 54).
  `MarkCanInterrupt`: [OPEN] (test 61).

### 7.2 Basic-attack chains

- A chain step (attack2…) can start only while the chain points at it,
  that is, while an earlier step's window lists it. An attack input during
  that window *is* the step. [DATA]
- A skill with `dontInterruptCombo` keeps the chain for 1 s after its
  exclusive time; other skills clear it. [DATA] for the flag; the 1 s is
  [ASSUMED] (`CHAIN_CACHE_FRAMES`)
- **Teammates basic-attack on their own:** at the chain's windows (step
  intervals about 0.82× exclusive time), with a pause after a full chain
  (median 3.5 s, quartiles 2.1–6.8 s), about 39% of their free time. Their
  own skills cut it. [SETTLED] for the existence and the measured pace (28
  logs; accuracy plan B0); the fixed 3.5 s pause is [ASSUMED] (test 101).
  Some skills stop only their own operator's attacks (Liino's stance and
  ultimate). [SETTLED] (the owner)
- What only the controlled operator gets: Final Strikes' Stagger, and SP or
  effects marked `onlyExecuteWhenSourceIsMainChar` (125 files). Teammates'
  attacks get neither. [DATA]
- **Dives:** a jump by the controlled operator. The fall starts 2 frames
  after it and the landing 22 frames after the jump (0.73 s), from
  Endaxis-read movement values. [ASSUMED] (constants.ts `DIVE_MOTION`, test
  97)

### 7.3 SP

- Team SP: max 300, start 200, +8/s, regeneration paused 1.5 s after a
  spend. [ASSUMED]: the native settings say `atbRecoverInterval` 0.5, and
  Zero Sanity uses 7.69/s with no pause. [OPEN] (accuracy plan B2, test 102)
- **Natural** SP (regeneration, a finisher's SP, `atbGainMethod` 0) gives
  ultimate energy when spent. **Returned** SP (skills' `atb`, method 1) is
  spent first and gives none. [DATA] (resources.ts `gainSp`)
- A skill's `atb` (for example a Final Strike's 20) arrives at its first hit
  unless the kit names the hit (`hit.sp`). Its timing is [ASSUMED].
  `spBeforeDamage` marks an ObtainCostAction before the DamageAction in the
  same tick. [DATA]
- SP grants only while controlled are written as `{if: {controlled: true},
  then: v}`. [DATA]

### 7.4 Ultimate energy

- Max energy is the ultimate's cost (`SkillPatchTable` costType 0, the same
  at every level). `BattleConst.maxUltimateSp` (100) is not it. There is no
  passive gain, and the ultimate uses all of it. Potentials cut the cost
  through `skillParamModifier` paramType 1 (×0.85 at P4 for most). [DATA]
- Every team member gains 0.065 energy per natural SP spent on a battle
  skill, in parts at the frames of the skill's `buff_common_obtain_ultimate_sp`
  (`teamEnergy`). [ASSUMED] for the rate (native settings via the reference
  simulators); [DATA] for the frames
- Fixed grants: `ObtainCostAction` costType 0 with a key (`usp`, commonly 10
  on combos; `extra_usp`), × Ultimate Gain Efficiency (attribute 44) unless
  `ignoreUspGainScalar`. [DATA]
- `RefrainObtainUsp` blocks its owner's gain for the buff's duration
  (`energyBlockSeconds`, `blocksEnergy`). `useUspRecoverTag` grants
  (`ignoreBlock`) come through anyway. [DATA]

### 7.5 Cooldowns and combo windows

- Cooldowns come from `SkillPatchTable`. Potentials change some through
  paramType 2. A combo's cooldown runs at its operator's recovery rate
  (attribute 93). A `cooldownGroup` shares one cooldown. Cuts "by a
  percentage" (of the total, or of what's left): [OPEN] (test 36)
- **Combo windows** open on the kit's `openCombo` trigger (the CharGrowthTable
  "COMBO TRIGGER" text) for 6 s, per operator. The window is on the world
  clock, and casting the combo closes it. [ASSUMED] for the 6 s
  (`comboSkillPendingInterval`, native settings via the reference
  simulators)
- A trigger while every combo the window is for is on cooldown doesn't open
  it, though what it saw is recorded for `element: "window"`. [ASSUMED]
  (test 60)
- An operator's own combo doesn't open its own window, except a window of
  its own skills (`openCombo.skills`, its next sequence). The window keeps
  the largest event count of its openers (Si's finisher reads it). [DATA]
  for the sequence; the rest [ASSUMED]
- A kit without an `openCombo` trigger allows the combo whenever it's off
  cooldown. [ASSUMED] (TIMELINE_ASSUMPTIONS)
- Windows opened by a reaction: [OPEN] (test 35).

### 7.6 Link

- Link is a team stack (`buff_common_affixes_combo_trigger`, 15 s, up to 4
  used). It comes only from a `ComboAction` (Lifeng's and Camille's combos)
  or a buff that counts as one (Akekuri's talent). **Ordinary combos give
  none.** [SETTLED] (batch-4 B1: five logs). Kit vocabulary: trigger action
  `link`, buff `link: true`.
- The next battle skill or ultimate uses every stack. It gets +30 / 45 / 60 /
  75% (battle) or +20 / 30 / 40 / 50% (ultimate) by stack count, on that
  cast's hits only (ComboCalcZone; the engine puts it in the multiplicative
  zone, which gives the same number). [SETTLED] for one stack on an
  ultimate (40d9 ×1.2000); the per-stack values are [OPEN] (test 8)

## 8. Buffs

### 8.1 Stacking (BuffData `stackingSettings`)

- **Plain** (types 0, 4, 7, 9): a new instance from the same owner replaces
  the active one. [DATA] (`packages/data/src/kits.ts`)
- **Layers with their own timers** (types 2 and 11, `maxStacks` from
  `maxStackCnt` or its `maxStackCntKey`): each layer has its own duration;
  at the maximum a new layer replaces the oldest; modifiers add per layer.
  [DATA]
- **Layers on one shared timer** (types 8 and 10, `sharedTimer`): each new
  layer refreshes the timer. Vulnerable and inflictions work this way.
  [DATA]; for kit buffs [OPEN] (test 62: Chen, Akekuri, Ember)
- **Stack groups** (type 1, or type 11 with a priority key and one
  instance): instances from different owners don't add. Only the
  highest-`priority` instance acts, whole, ranked by the priority key's value
  at creation. Ties, and groups without a key, go to the latest. [DATA] (tests
  `kits-priority.test.ts` check every CreateBuffAction). `negatePriority`
  is refused.
- A priority key **alone** doesn't make a group: type 0 with a key from two
  sources adds up. [SETTLED] (b7b3)
- Type 2 with a literal single layer, on others (not self), is one instance
  whoever applies it. Two wearers of Eternal Xiranite give one +0.16.
  [SETTLED] (9555)
- `stackingKey` joins buffs of different files into one (Liino's two
  stances, `liino_atk_up`; all 36 food buffs). [DATA]
- The full meaning and order of BuffData's 13 stacking types isn't
  verified. [ASSUMED] (game-data-format, after Endaxis)
- Jade Vessel's `dmg_taken_up` (type 11, max 1), where the replacement by
  priority may keep another instance: [OPEN] (open-problems "Hard 33").

### 8.2 Duration, refresh, end

- A kit buff's duration must equal the data's CreateBuff of its game buff
  (a key of the applying skill, the buff file's literal, or until ended).
  Otherwise it carries `dataOverride: {duration: "reason"}`. No duration
  means until a trigger ends it or a cast consumes it; 0 means not applied
  (a potential below its level). [DATA] (design "Kits and the game data")
- Buffs run on the world clock: others' time stops lengthen them (§6.2).
  [ASSUMED]
- `extendBuff`, `endBuff` (all of a buff, or its oldest layers) and a buff's
  end are events (`buffEnded`, with `consumed` when an action ended it).
  [DATA]
- `endsWithCast`: the buff ends when its owner's current skill ends or the
  owner starts another. [DATA]
- When Liino's stance buff ends, it leaves a linger
  (`buff_chr_0035_liino_atkup_finishtime`, `finish_duration`) with the same
  ATK and stacking key. Such follow-on buffs come from `buffEventAction`.
  [SETTLED] (c6d8)

### 8.3 Targets and consumption

- `target`: `self`, `team` (with `recipients` predicates judged per member
  at application) or `enemy` (acts on every team member's hits on it).
  [DATA]
- `consumedBy`: the next cast of those kinds by someone it reaches consumes
  it. It then acts on that cast's hits only (`consumedScope: cast`), or on
  every hit of the caster until the cast ends (`whileCasting`: a buff
  attached to the cast, CreateBuffAttachingSkill). Examples: Link and Jade
  Vessel. [DATA]
- Values are fixed at application, at the applier's levels (ValueExprs).
  [DATA] (buffs.ts `applyBuff`)
- **Snapshotting:** only periodic damage with `takeAtkSnapshot`
  (Combustion, Rossi's bleed, `atkSnapshot` hits) keeps the attacker side
  from application. Every other hit reads the buffs active at its landing.
  [SETTLED] (test 77; effects.ts `SNAPSHOT_ZONES`)

### 8.4 Before or after the hit's damage

- By default the buffs a hit applies act from the **next** hit
  (`hit.buffs` after the damage). [DATA] (design "Buffs from skills")
- `beforeDamage` (a trigger on status events only, or `hit.buffs` with
  beforeDamage) lets a buff act on the hit that caused it. Use it only where
  the data creates the buff before the DamageAction. Order within one
  landing: the hit's inflictions, then `beforeDamage` triggers on what they
  caused, then the damage. [DATA] (design "Arts state")
- **Test 51's findings:**
  - Hot Work's Nature DMG counts on the Corrosion-forming hit (×1.5 exactly,
    three times), not on Corrosion's own hit. [SETTLED]
  - Solemn Phalanx (INT Arts DMG on the inflicting battle skill), Ancient
    Canal and Da Pan's talent layers on his combo's own hit, Dreams of the
    Starry Beach, Wulfgard's Scorching Fangs, Perlica's P3 with Pulser
    Labs, and Seeker of Dark Lung are put on the same hit because the data
    creates them first. [OPEN] (test 51; 10–25% on those hits)
- `spBeforeDamage`: the SP and what triggers on it come before the damage.
  [DATA]

### 8.5 Triggers

- Events (`on.event`):
  - `hit`, `cast`, `reaction`, `burst`, `inflictionApplied`,
    `inflictionConsumed`, `statusConsumed`;
  - `physicalStatus`, `vulnerable`, `shatter`, `control`, `staggered`,
    `staggerNode`;
  - `buffApplied`, `buffEnded`, `buffTick`, `stackAtLeast`;
  - `heal`, `sp`, `linkGained`, `attacked`, `enemyCharge`, `perfectDodge`,
    `fightStart`.

  Filters include `kinds`, `elements`, `skills`, `finalStrike`,
  `decorations`, `crit`, `fromKinds`, `minStacks`, `rising` and `fromNone`.
  (schema `triggers[].on`)
- `by`: `self`, `teammate`, `anyone` or `controlled`. Stack and own-buff
  events are always the owner's. [DATA]
- `if` is judged for the owner at the event. `delay` (frames) runs the
  actions later, each action's `if` when it runs. `afterHits` puts them
  after that frame's hits (a clip listed after the damage clip).
  `detached` and `launch` keep a cast trigger's actions when the cast is cut
  short. [DATA]
- `cooldown` (seconds; `cooldownPer` per subject), `maxCount` per fight,
  `maxPerCast`, and `chance` (BuffData `Probablity`, rolled after `if`; a
  miss starts no cooldown). These come from BuffData `triggerInterval`,
  `maxTriggerCnt` and `addingCooldown`. [DATA]
- Triggers of different operators on one event run in team order, and
  their actions see earlier ones' effects. [ASSUMED] (design "Team order").
  Ties within a frame follow the engine's documented order (design "Order
  within a frame"), not the game's. [ASSUMED]
- Heals are events without amounts. Operator HP isn't tracked: an effect
  that needs low HP never fires, and one that needs full HP always does
  (the owner, batch-3). [ASSUMED]

## 9. Equipment

- **Weapon skills:** three per weapon, each with its level. The weapon's
  breakthrough stage bounds its skill levels (WeaponBreakThroughTemplateTable:
  skill 1 or 2 at 9 needs stage 4, weapon level 80–90). [DATA]
- **Weapon potential** (duplicates) raises only the unique third skill,
  +1 per potential (WeaponTalentTemplateTable). ZMDLogs' `weaponRefine` is
  potential + 1, and the logged unique-skill level already includes it.
  [SETTLED] (screened loadouts, accuracy plan "Choosing logs")
- A weapon's permanent stat lines go into the panel. Its conditional parts
  (unique skills, `sk_`, `passive_`) are the equipment kit's
  (`packages/data/kits/equipment/<id>.json`, IDs prefixed `<id>.`, values
  from the equipment's own skills at the build's levels). [DATA]
- Equipment effects are **wielder-relative**: they act for whoever wears
  them and activate only if the wielder does what they need. They are never
  written for one operator. An operator can equip only weapons of its own
  `weaponType`. [DATA] (kit-process "Equipment is generic")
- **Gear lines:** each line's value comes from its artifice level (line 0
  is fixed). [DATA] (stats.ts)
- **Gear sets:** every set in `EquipSuitTable` needs 3 pieces (`equipCnt`
  3 for all 24 sets; there are no 2-piece effects in the data). Each piece
  counts, so two identical pieces count twice. [DATA]; duplicates [SETTLED]
  in d774 (Liino's Amp needs the duplicate's Will), [OPEN] in 9555 and
  04d4, where the duplicate fits neither one copy nor two.
- **Food:** one per operator, since all 36 food buffs share a stacking key.
  Its attribute lines are panel lines from the fight's start for 300 s.
  Instant battle items aren't foods. [DATA] (design "Food buffs")

## 10. Enemies

- Level: the stage's (DungeonTable `enemyLevels`). Stage variants
  (`eny_0120_klbear_tower015`) use an attribute template through EnemyTable,
  with `attrModifiers` (add, × (1 + v), or × v; stagger HP × 0 on
  unstaggerable variants). [DATA] (tables/enemies.ts)
- DEF is 100 at every level. Resistances are points per element (§1.6).
  [SETTLED]
- Ranks (EnemyTemplateDisplayInfoTable `displayType`): 0 Common, 1 Elite,
  2 Boss, 3 Advanced, 4 Alpha. Super armor is `initialSuperArmor`, plus
  `zeroPoiseSuperArmor` while Staggered. [DATA]
- Born buffs and enemy shields aren't modelled. Hard 27's template and its
  born buffs were checked and add no physical term. [ASSUMED], with Hard
  27 [OPEN]
- What the logs showed per boss:
  - **Rhodagn** (`eny_0051_rodin`, bar 280): the bar refills to full at
    29.5–45 s in 3 of 5 fights [OPEN, test 100]. Kill totals equal his HP
    (2,292,909 at level 90).
  - **Second lives** (3aa6, c3c7, d774): the bar refills at HP 0 → 100%.
    [SETTLED]
  - **`eny_0090_wgabyss`** (c6d8): every hit is ×0.1 from 15.8 s until its
    980-point bar breaks at 75.6 s. This is a 90% damage-reduction phase,
    listed neither in the log nor in its attributes. [SETTLED] in the log,
    not modelled.
  - **Hard 33's Woodcraft Slug:** its number shield
    (`buff_common_eny_numshield`, −9999 in the product zone) zeroes whole
    hits. Its bar regains Stagger by itself, and debuffs listed on its hits
    don't act in some windows. [OPEN]. Avoid these logs.
  - **`eny_0134_jsspsi`** (bar 400): Staggers 5 s late in 3aa6 [OPEN]. Its
    logs list no food (see §11).
  - **Hard 27** `eny_0124_kltdcap_hdg027`: physical ×1.1125 [OPEN]. Hard
    15: fire fits resistance 12. Tower 15 klbear: physical 20. [SETTLED]

## 11. Log quirks that aren't kit errors

- **Food the log doesn't list.** No `eny_0134` log lists food, but the hits
  fit one exactly: Bottled Duskberry Juice in 3f78 and 4a64, Jakub's Legacy
  in e989. 7e19's Endministrator is +180 flat ATK from the stew, and de6a
  and 0c14 fit foods too. A uniform per-operator factor is a build input
  first. [SETTLED] (accuracy plan item 7)
- **Build inputs the export omits:** weapon level (the importer assumes
  90; level 80 is ×0.937), attribute nodes, talents and promotion. Look for
  a constant factor per operator, such as ×0.807 (weapon 60) or ×0.9394 /
  ×0.8815 (80 and no nodes). The log check's `buildOffsets` reports them.
  [SETTLED]
- **Buffs a log doesn't list for an operator:** 1d91 never lists Liino's
  stance or lance layers, which are real. Effects lists can be sparse:
  entries vanish and return. [SETTLED] (1d91); sparse lists [OPEN] (Hard 33)
- **A buff listed once whatever its layers** (stackingType 8) or several
  times (a `max_stack` key). Link is logged with zero duration and no
  value. [SETTLED]
- **Fixed DMG** that a fight computes (Si's Inksoul burst from the fight's
  hit sum) can't be predicted from a kit. It is "unquantified", not a
  mismatch. [SETTLED]
- **The killing blow** is capped at the HP left (`uncappedDamage` gives the
  rest). A landing after the kill isn't in the log at all (b7b3's third
  Last Rite slash, `absent`). [SETTLED]
- **Parser versions:** crit flags, rate and crit DMG from v57; v59 =
  game 1.6. d9e5 predates 1.6 and is excluded. Some hits lack crit data.
  [SETTLED]
- **Cast events:** a hitless cast's logged time can be its time stop's end
  (b6aa's Xaihi), or come before its first effect (0eef's Liino). Every 3–4 s
  Liino has "presses" in her stance that launch nothing [OPEN, test 103].
  Liino's combo's second hit is logged only under Corrosion. [SETTLED]
- **Stagger in the log:** `poiseDamage` is on damage events only. A
  reaction is credited its trigger's poise, though the bar drops once. Some
  bar drops aren't attributed. The Stagger buff lane's `durationMs` is real
  time; the buff's own data lasts 0.1 s and is renewed. [SETTLED]
- **The Endministrator:** the log may name her `chr_9000_endmin`, without
  skill levels. The male `chr_0002_endminm` has different SkillData.
  Duplicate accessories in the export may be real or a second item.
  [SETTLED]
- Enemies leave reach: in d774 no hit lands from 30.6 to 54.6 s. Hits that
  miss the logged enemy are absent from the log. [SETTLED]

## Where the code and the docs disagree

- `damage.ts` `NOT_MODELLED` lists Link and finisher as ×1. Both are
  modelled in the timeline (casting.ts, landing.ts; accuracy plan B11).
- Solidification: the code has 5.75–8.75 s, the native settings say 6–9 s
  (B4, test 71).
- Combustion: the buff file says 11 s, the code 10 s. This is deliberate:
  the logs count 10 ticks (B5).
- Breach: the buff file's default is 15 s, the code 12–30 s by level (Talos;
  not log-checked).
- data-sources "Physical state" and its AI list still credit Lift and Knock
  Down with 10 × (1 + AI/200) Stagger. The engine and the logs give them
  none.
- The glossary calls `power_attack` the Final Strike. It is the finisher;
  Final Strike is the decorate bit (§2.1).
- Electrification: the reaction is logged for "all" elements, while the
  engine applies it to the arts elements only (§3.4).
- SP (rules.ts) says "not yet checked against a fixture". The native
  settings disagree on the pause (B2).

## How to use this when reviewing a kit

For each skill, and for each trigger of the operator, its weapons and gear
sets, compare:

1. **Hits against SkillData:** frames (30 fps from the skill's start;
   projectiles at their launch or a log-read frame), count and branches,
   `scale` keys and `factor` against the DamageAction and SimpleCalcBB
   (values from SkillPatchTable at level), `poise` only where a
   damageAttributeType 1 unit exists, `poiseControlledOnly` on Final
   Strikes, the `finalStrike` and `dive` bits, `detached` / `launch`,
   `enemyDelay`. Every difference carries `dataOverride` with a reason.
2. **Damage type:** the kind from the decorate mask (§2.1);
   `damageType: "none"` only for hits of no skill type; `status: "crush"`
   or `reaction` for hits the game computes as statuses.
3. **Applications:** inflictions only where an enabled `SpellInfliction`
   exists, with its element; `enemy` / `event` / `window` as the data's
   consumed-type switch says; forced reactions with their level,
   `durationKey` and `scaleKey`; `forced` physical statuses only where the
   data sets force*, `multiplierKey` for Crush; `afterDamage` only where
   the consumption follows the DamageAction.
4. **Triggers:** the event and filters match the description and BuffData
   (combo triggers quote the COMBO TRIGGER text); `by`; `cooldown`,
   `maxCount`, `maxPerCast` and `chance` from `triggerInterval`,
   `maxTriggerCnt` and `Probablity`; `delay` / `afterHits` from the clip
   order. Nothing relies on ordinary combos giving Link or on Lift giving
   Stagger.
5. **Buffs:** `gameBuff` names the file; the zone or attribute is the
   BuffData modifier's (ATK% is `atk`, not damageBonus; Susceptibility, Amp
   and damageTaken are separate); element, skillType, onlyKinds and
   decorations as its CheckDamageDecorateMask; the CreateBuff's duration
   (or `dataOverride`); stacking as §8.1 (`maxStacks`, `sharedTimer`,
   priority); target, recipients, `consumedBy`, `endsWithCast`.
6. **Before or after damage:** `beforeDamage` only where the data creates
   the buff before the DamageAction (§8.4); Corrosion's own hit never sees
   its status's effects.
7. **Snapshot:** periodic damage with `takeAtkSnapshot` uses `atkSnapshot`;
   nothing else snapshots.
8. **Potentials and talents:** changes through `skillParamModifier` or
   attached skills (cost paramType 1, cooldown 2); gates at the right level
   (duration 0 below it); `activeConditions` cite their meaning.
9. **Energy and SP:** `usp` grants and frames; `teamEnergy` at the
   `buff_common_obtain_ultimate_sp` frames; `energyBlockSeconds` from
   RefrainObtainUsp; `atb` on the right hit, natural or returned,
   controlled-only grants; the ultimate's cost after potentials.
10. **Timing:** `windows` and `jumps` as the data's branches;
    `cooldownGroup`, `takesControl`, `available`; combo windows opened by a
    trigger, never by the combo itself.
11. **Before blaming a kit for a log mismatch,** rule out §11's quirks, the
    OPEN items and build offsets.
