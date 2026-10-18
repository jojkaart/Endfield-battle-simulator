# Laevatain (chr_0016_laevat): gap report, batch 1

Weapons: Forgeborn Scathe (wpn_sword_0006), Umbral Torch (wpn_sword_0010).
Gear sets: none assigned; set effects that would matter are noted at the end
of the mechanics table.

Sources: rmxlinux `Json/SkillData/chr_0016_laevat_*`, `Json/BuffData/buff_chr_0016_laevat_*`
(game 1.6), `TableCfg` CharGrowthTable, CharacterPotentialTable,
PotentialTalentEffectTable, SkillPatchTable, WeaponBasicTable, EquipSuitTable,
I18nTextTable_EN. Engine and format as of `3a54dd8`. Scratch scripts:
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch1/scratch-chr_0016_laevat/`
(`dump.py` / `tl.py` print a SkillData or BuffData file with presentation stripped).

Frame numbers are 30 FPS **timeline** frames of the file unless I say "real".
Claims from the current kit (`packages/data/kits/operators/chr_0016_laevat.json`)
were re-checked; where the data disagrees, it's said in the row.

## Data files and what their actions do

Only files that the operator's skills or talents reach (dungeon `dung_*`,
`chrdung_*`, `indie_phantom_*`, `train_*` and VFX-only buffs left out).
Presentation actions (animation, camera, sound, VFX, root motion) are left
out of every list.

| File | Action types that matter | Affects |
|---|---|---|
| attack1–3 | DamageAction (mask 128), ObtainCostAction (SP `atb` × 0.5 coefficient, main char only), AllowNextSkillAction, ComboCacheAction, SetSuperArmorAction | damage, SP, chain order, lock |
| attack4 | DamageAction (frame 6), LaunchProjectile ×2 (12, 19 → attack_5_projhit), AllowNextSkillAction (22) | damage, timing (projectile travel) |
| attack5 | ChannelingAction ×2: DamageAction mask 128 (23), mask **2097280** = Final Strike + poise (26); ObtainCostAction `atb` 20 on the FS hit, main char only | damage, Final Strike, stagger, SP |
| attack_5_projhit | DamageAction (atk_scale of the launching skill) | damage |
| normal_skill | CheckBuffStackNumAdvanced (MF ≥ 4 at frame 3) → has_max_energy; **JumpToAction** (30→80 if empowered; 37→215; 214→231); SpawnAbilityEntity (4); at 104: ModifyDynamicBlackboard `atk_scale_3 ×= ratio`, **FinishBuffAction** (all Melting Flame), Channeling: CreateBuff burning_triggered (`duration`, `extra_scaling`), DamageAction atk_scale_3 (mask 4352), ObtainCostAction SP `atb` (first target), ObtainCostAction energy `extra_usp`; FinishOwnerAction on the entity (105) | damage, stacks, arts state, energy, SP, timing |
| normal_skill_abilityentity | DamageAction atk_scale (18, mask 4352) + InterruptAction (2 s); 10 × DamageAction atk_scale_2 (25…62, mask 256); first hit that lands: CreateBuff energy (MF +1) and buff_common_obtain_ultimate_sp | damage, stacks, team energy |
| normal_skill_during_ult | Channeling hit 1 (13, atk_scale) and hit 2 (23, atk_scale_2), mask 4352, no ratio; MF +1 on hit 1; CreateBuff **pause_ult** (0–115); JumpToAction (24→75 if empowered; 39→196; 195→270); at 98: `atk_scale_3 ×= ratio`, FinishBuff all MF, burning_triggered, DamageAction, SP `atb`; AllowNextSkillAction (33–75) | damage, stacks, arts state, Twilight timer, SP, timing |
| combo_skill | CreateBuff combo_skill_start per target (index → triggerInterval 0.7/0.65/… s), combo_skill_hit_self; LaunchProjectile (indicator, no damage); **TimeDilationAction** 0.6 s; during Twilight: Channeling every 0.1 s re-creates show_weapon / ult_end with duration 0.1 | damage timing, stacks, Twilight timer, time |
| combo_skill_projhit, normal_skill_projhit | DamageAction on `atk_scale` of the projhit file (0); not launched by any skill | none (kit-draft picks them up as LITERAL_0 hits) |
| ultimate_skill | **no DamageAction**; CreateBuff show_weapon (0), damage_immune; UltimateTimeAction (0–61); TimeDilationAction RESETto1; FinishBuff of the previous ult's buffs | state, energy block, time |
| ult_attack1–4 | ModifyDynamicBlackboard `atk_scale ×= ratio`; DamageAction mask 128; ult_attack3: **enabled** SpellInfliction; ult_attack4 2nd channel: mask 2097280 (Final Strike) + poise, SP `atb` 22 | damage, infliction, Final Strike, SP |
| power_attack (finisher) | DamageAction with BreakingAttackCalculation (0.2 / 0.8 of atk_scale 9.0), mask 132; GainBreakingAttackAtb | damage (needs stagger), SP |
| plunging_attack_end, dash_attack | DamageAction (mask 1152; 131200 ×2), ObtainCostAction SP | damage, SP |
| buff …_energy (Melting Flame) | stacking type 3, max = `max_stack` (4), lifeType 1 (no expiry); on stack change (event 6) Switch count == 4 → energy_icon_5 → ignore_fire_resist | stacks, trigger |
| buff …_ignore_fire_resist | InstantModifyAttribute attr 98 (Heat RES), attacker side, value `ignore_fire_resist`, duration `ignore_fire_resist_duration` (20 s) | damage |
| buff …_passive | AuraAction: passive_teammate on characters, passive_enemy on enemies | trigger setup |
| buff …_passive_teammate | on damage dealt (abilityEvent 302): CheckDamageDecorateMask 2097156 (any of Final Strike / Finisher), source is the controlled operator, MF < 4, not on cooldown → CreateBuff passive_teammate_cd (1 s); per Heat stack: if MF < 4, FinishBuffAdvanced 1 layer (absorbed) + MF +1 | arts state, stacks, trigger |
| buff …_passive_enemy | on death (abilityEvent 1): absorb the enemy's Heat for MF | stacks (kills only) |
| buff …_combo_skill_start / _hit / _usp / _hit_self | delayed DamageAction (mask 12288) + InterruptAction; usp Switch 25 / 5 / 5 per enemy; MF +1 at its frame 21–24 | damage, energy, stacks |
| buff …_combo_skill_debuff | attr 5 (Heat RES) down; both CreateBuffActions that would apply it are disabled | none |
| buff …_show_weapon | 16 s; on start RefrainObtainUsp; PauseBuffTime while pause_ult; on end SetSkillCdAtOnce (ult cooldown 10 s); creates ring_start_asset and ult_end | energy block, cooldown, state |
| buff …_ult_end | 15 s (the Twilight timer); PauseBuffTime while pause_ult; on end finishes ring_start_asset | state duration |
| buff …_ring_start_asset | ChangeSkillAction normal_skill → normal_skill_during_ult; SwitchModeAction "ult" (enhanced basic attacks); lifeType 1 (ends with ult_end) | skill state |
| buff …_potential_5 | on kill (abilityEvent 222) during Twilight: extend ult_end / show_weapon by `extend_duration` up to `max_duration` | state (kills only) |
| buff …_talent_2_0 / _2_1 | CheckHp, ShelterAction, HealAction, global CD | survivability only |
| sk_wpn_sword_0006 | cardAttributeModifier attr 51 (Heat DMG); on cast (abilityEvent 143) of skill type 7 (ultimate) → buff_wpn_sword_0006_valid (attr 17, 20 s, stacking type 4); toggleBuffs buff_wpn_lance_0003 on CheckCurHpRatio with no `hp_ratio` key (copy leftover) | stats, triggered buff |
| sk_wpn_sword_0010 | cardAttributeModifier attr 2 (ATK%); buff_wpn_sword_0010 → aura buff_wpn_sword_0010_inaura on enemies: when a buff tagged Combustion (-1110095722) or Corrosion (-421286163) is added to the enemy (abilityEvent 205), at most every 0.1 s (CreateTimedMarker) → buff_wpn_sword_0010_valid on the wielder (attr 51 + 54, stacking type 2, max `max_stack`) | stats, triggered buff |

## Mechanics

Status: `supported` / `gap` / `data` / `unique?` / `unknown`.

| # | Mechanic (source) | Status | How it's expressed / what's missing |
|---|---|---|---|
| 1 | Basic attack 1–5: hits, scales, frames 6; 6,13; 9; 6,12,19; 23,26 (SkillData DamageAction / LaunchProjectile frames) | supported | `skills[].hits` with `frames` (hand-written; matches the data) |
| 2 | Attack 4 hits 2–3 are projectiles (LaunchProjectile 12, 19) | unknown | launch frame used; travel time isn't in the data |
| 3 | Final Strike is only attack5's 2nd landing (frame 26, mask 2097280; frame 23 is 128) | data | kit has one entry `count 2`; the loader flags every landing of the entry as Final Strike (`isFinalStrike` per entry). Splitting the entry with `finalStrike` fixes it by hand |
| 4 | SP from basic attacks (`atb` 20 on attack5's FS landing, only as controlled operator; ult_attack4 22) | supported | `atb` added at the skill's first landing (3–4 frames early) |
| 5 | "As the controlled operator, Final Strike also deals {poise} Stagger" (CharGrowthTable NormalAttack desc; poise units) | gap | physical state: stagger not modelled |
| 6 | Finisher (power_attack: BreakingAttackCalculation 0.2 + 0.8 × atk_scale 9.0, mask 132, SP via GainBreakingAttackAtb) | gap | needs a Staggered enemy; not in the kit |
| 7 | Dive attack (plunging_attack_end, atk_scale 1.8) and dash attack (2 hits, atk_scale 0.66) | supported | expressible as plain hits; not in the kit (little use against one stationary enemy) |
| 8 | Chain order: attackN only follows attackN−1 inside its AllowNextSkillAction / ComboCacheAction window, else the chain restarts (attack1–5; ult_attack1–4) | gap | skills (states): a recorded rotation can cast any step at any time (e.g. attack5 for Final Strikes); only search follows chains |
| 9 | Battle skill: Magma Fragment explosion (entity frame 18 + spawn 4 = 22, atk_scale) and 10 burn ticks (atk_scale_2, 29…66) | supported | kit hits `explosion`, `dot` |
| 10 | MF +1 on the cast's first hit that lands (entity: explosion, or the first tick when `hit_count` is 0) — kit claim "once per cast, on the first hit" | supported | `gains` on `explosion` (claim confirmed) |
| 11 | Team ultimate energy from natural SP (buff_common_obtain_ultimate_sp → ObtainUspInNormalSkill on the first hit) | supported | engine grants it at the cast instead of the first hit |
| 12 | Empowered branch when MF ≥ 4 at frame 3 (normal_skill CheckBuffStackNumAdvanced → has_max_energy; same in during_ult) | supported | `requires {melting_flame ≥ 4}` checked at the cast |
| 13 | All Melting Flame consumed **at the extra hit** (FinishBuffAction finishAll, timeline 104 / 98), after the cast's own +1 → 0 left | gap | engine zeroes the stack at the cast, then the explosion / hit 1 gain leaves 1 |
| 14 | Normal extra hit = atk_scale_3 × `ratio` (normal_skill frame 104 ModifyDynamicBlackboard op 2; P1 sets ratio 1.2) | unknown | kit uses `[atk_scale_3, extra_scaling]` (P3 ×1.5), matching Zero Sanity's 57552 (= 7.7 × 1.5). Data: ×ratio, and `extra_scaling` only feeds the Combustion (burning_triggered `burning_atk_scale ×= extra_scaling`). Kit claim "P3's extra_scaling only to the normal extra hit" is contradicted by the data |
| 15 | Forced temporary Combustion (buff_common_fire_fire_burning_triggered, level I via `count` 1, `duration` 5 s, tick × `extra_scaling`; P3 duration ×1.5, extra_scaling 1.5) | supported | `forcedReaction` with `durationKey`, `scaleKey` |
| 16 | Normal extra hit restores ultimate energy `extra_usp` (100) once | supported | `energy: extra_usp` |
| 17 | P1 "scoring a hit returns 20 SP": the ObtainCostAction (costType 1, `atb`) sits inside the extra hit only (both battle skills) | gap | engine returns the skill's `atb` on the first landing of **every** cast (`skillSpGain`), so at P1+ every non-empowered cast returns 20 SP too |
| 18 | Branch jumps: normal 30→80 (empowered) or 37→215; during ult 24→75 (empowered) or 39→196, 195→270. The extra hit is at real ≈54 (normal) / ≈47 (ult), not 104 / 98; branch lengths differ (normal ≈104 vs ≈232 real frames); the Magma Fragment is removed at timeline 105 (real ≈55 in the empowered branch, cutting ticks 54–62) | gap / unknown | kit frames are timeline frames; one lock (`exclusiveFrame` 117 / cancel 33) for both branches. Whether JumpToAction skips time needs a test (FinishOwnerAction at 105 only does anything if it does) |
| 19 | Explosion InterruptAction (immobilize 2 s); extra hit BlowOffAction | unknown | no damage effect; matters only to equipment that triggers on Immobilization (whether InterruptAction counts is unknown) |
| 20 | During-ult hits 1–2 (13, 23; atk_scale 3.3, atk_scale_2 3.7) with **no** ratio in the data | unknown | kit multiplies by `ratio` (matches Zero Sanity's 19732 / 22124 = ×1.2 at P5, which Scorching Heart's +20 RES ignore also explains) |
| 21 | During-ult MF +1 on hit 1 | supported | `gains` on `hit1` |
| 22 | During-ult extra hit (atk_scale_3 × ratio, forced Combustion; no energy) | supported | kit `extra`; timing as row 18 |
| 23 | Twilight paused during the enhanced battle skill (pause_ult 0–115 → PauseBuffTime on ult_end and show_weapon); "does not shorten the duration" (UltimateSkill desc) | gap | buff lifecycle: buffs have a fixed expiry |
| 24 | Skill swap during Twilight (ChangeSkillAction normal → during_ult; SwitchModeAction "ult") | supported | `availableWhile` / `unavailableWhile: twilight` |
| 25 | Combo trigger: "When an enemy suffers Combustion or Corrosion" (CharGrowthTable) | supported | `comboTriggers` reaction combustion / corrosion (forced ones included) |
| 26 | Combo damages only enemies with Combustion or Corrosion ("Fire erupts beneath the feet of any enemy with…") | supported | expressible as hit `if: any [enemyStatus…]`; the kit lacks it |
| 27 | Combo damage is dealt by buff combo_skill_hit, created by combo_skill_start (created at frame 20, triggerInterval 0.7 s, waits first) → real ≈ frame 41; kit says 20 | data | compiler gap: hit frames through CreateBuff → buff trigger interval → buff timeline; log key probably the buff's file name (no log has her combo) |
| 28 | Combo MF +1 (combo_skill_hit_self, its frame 21–24 → ≈ 41) | supported | `gains` (timing as row 27) |
| 29 | Combo energy 25 / +5 / +5 per enemy (combo_skill_usp `usp_1..3`) | supported | `energy: usp_1_display` (25; one enemy) |
| 30 | Combo during Twilight extends ult_end and show_weapon by 0.1 s every 0.1 s for 57 frames (stacking type 5 re-creation) | gap | buff lifecycle (same as 23) |
| 31 | Combo time dilation (TimeDilationAction, 0.6 s, curve ComboSkill, caster and controlled excluded) | gap | timing: time dilation |
| 32 | Combo Heat RES debuff (combo_skill_debuff) | supported | disabled in the data; nothing to model |
| 33 | Ultimate cost 300 (P4 ×0.85), combo cooldown 9 s, battle skill 100 SP | supported | SkillPatchTable + potentials |
| 34 | **Ultimate cast deals no damage**: ultimate_skill has no DamageAction and spawns nothing (SkillPatchTable `atk_scale` 6.08 is unused); desc mentions no damage | gap | skills (hitless skills): schema needs ≥ 1 hit, so the kit's ultimate has a 6.08 × ATK hit at frame 0 that carries the Twilight buff (kit note "Not yet checked") |
| 35 | Twilight lasts 15 s from frame 0 (show_weapon at frame 0 creates ult_end 15 s) — kit claim "counted from the ultimate's hit (assumed)" | supported | kit buff `twilight` 15 s (claim confirmed: same frame) |
| 36 | No ultimate energy while show_weapon (16 s) is on (RefrainObtainUsp), paused with Twilight | supported / gap | `energyBlockSeconds: 16` fixed; pausing is row 23 |
| 37 | Ultimate cooldown 10 s starts when show_weapon ends (SetSkillCdAtOnce on its end event), not at the cast | gap | skills (cooldowns); engine counts it from the cast. Rarely binding (energy is blocked 16 s) |
| 38 | Ultimate makes her the controlled operator (desc; TeleportAction when not main char) | gap | skills (states): needs an explicit swap, which waits for the current operator's action |
| 39 | UltimateTimeAction 0–61 (world pause during the cast animation, presumably) | gap | timing: time dilation |
| 40 | Enhanced basic attacks 1–4: atk_scale × `ratio` (P5 1.2), frames 12; 10,21; 9; 22,26, mask 128 (basic) | supported | verified: zmdlogs-40d9a3c1da37, 17/17 hits |
| 41 | Enhanced attack 3 applies Heat (enabled SpellInfliction; desc "BATK sequence 3 also applies Heat Infliction") | data | kit `applies` by hand; the data has it (compiler should read enabled SpellInfliction) |
| 42 | Enhanced attack 4's 2nd landing is a Final Strike (mask 2097280) | data | as row 3 (one `count 2` entry) |
| 43 | P5: each kill during Twilight extends it 1 s (max 7 s) (buff …_potential_5, abilityEvent 222) | gap | needs kills; one enemy that doesn't die: no effect |
| 44 | Talent 1 absorption: the controlled operator's Final Strike **or Finisher** absorbs Heat for MF (passive_teammate mask 2097156; I18n talent_1_x) | supported / gap | `teamTriggers` on finalStrike; Finisher part is row 6 |
| 45 | Absorbs only while MF < 4, one Heat stack per MF gained; the rest stays on the enemy (per-stack check then FinishBuffAdvanced 1 layer) | gap | arts state: `consumeInfliction` removes all stacks; triggers: `teamTriggers` have no `if` |
| 46 | Absorption has a 1 s internal cooldown (passive_teammate_cd) | gap | triggers: no cooldown |
| 47 | Absorbs from enemies defeated nearby (passive_enemy, on death) | gap | needs kills; no effect on one enemy |
| 48 | Scorching Heart: when MF **reaches 4**, her DMG ignores 10 / 15 / 20 Heat RES for 20 s (energy → energy_icon_5 → ignore_fire_resist; talent blackboard `ignore_fire_resist`, `ignore_fire_resist_duration`) | gap | kit has it as an always-on condition; needs a trigger on reaching a stack count and a buff valued from the talent's attached-buff blackboard |
| 49 | Melting Flame: max `max_stack` 4, no expiry (lifeType 1) | supported | `stacks: melting_flame, max 4` |
| 50 | Talent 2 Re-Ignition (HP < 40%: 90% Protection, 5% heal per second, 120 s CD) | gap | no HP model; no damage effect |
| 51 | Attribute nodes Intellect +10/+15/+15/+20; P2 Intellect +20, Basic Attack DMG +15% | supported | stat panel (Zero Sanity panel matches) |
| 52 | P1 ratio 1.2 and `atb` +20, P3 duration ×1.5 and extra_scaling 1.5, P4 cost ×0.85, P5 ult_attack ratio 1.2 | supported | potential skill-value changes; where they act: rows 14, 17, 20 |
| W1 | Forgeborn Scathe: Intellect +156, ATK +39%, Heat DMG +44.8% (lvl 9; sk_wpn_sword_0006 cardAttributeModifier attr 51) | supported | stat panel |
| W2 | Forgeborn: when the wielder casts an ultimate (abilityEvent 143, skill type 7), Basic Attack DMG +210% (attr 17) for 20 s; same name doesn't stack (stacking type 4) | gap | weapon kit only has an always-on condition `after_ultimate`; needs a wielder trigger on casting an ultimate that applies a timed self buff |
| W3 | Umbral Torch: Intellect +156, Heat DMG +43.3%, ATK +19.6% | supported | stat panel |
| W4 | Umbral Torch: whenever Combustion or Corrosion is applied to an enemy (by anyone), wielder gains Heat and Nature DMG +22.4% for 20 s, max 2 stacks with separate durations, at most once per 0.1 s | gap | not expressible: no equipment triggers, no buff stacks with independent durations, no trigger cooldown |
| G1 | Hot Work 3-piece (suit_fire_natr01; 1 piece in both fixtures): Arts Intensity +30 (attr 87, permanent); after the wearer applies Combustion, Heat DMG +50% for 10 s; Corrosion → Nature DMG +50% 10 s; no stacking (abilityEvent 102 + Combustion / Corrosion tag) | supported / gap | permanent part via set skill; triggered part needs the same wielder trigger as W2 (her forced Combustion counts: burning_triggered carries the Combustion tag) |
| G2 | Tide Surge 3-piece (suit_burst01; 1 piece in the Zero Sanity fixture): Skill DMG +20%; after the wearer applies ≥ 2 Arts Infliction stacks, Arts DMG +35% for 15 s | supported / gap | permanent part supported; trigger as W2 |

## Gaps

**1. Hitless skills (ultimate with no damage).**
- family: skills (hitless skills).
- feature: a kit skill may have no hits (`hits` minItems 0) and still apply kit buffs, energy blocks and state at given frames: `skill.buffs: [{buff, frame}]`. Twilight is applied at frame 0 of the cast.
- evidence: `chr_0016_laevat_ultimate_skill` has no DamageAction, LaunchProjectile or SpawnAbilityEntity; its buffs (show_weapon, ult_end, ring_start_asset) deal no damage. zmdlogs-40d9a3c1da37 has no `chr_0016_laevat_ultimate_skill` event although her enhanced attacks start at 6657 ms (the cast was before, inside the log; first logged hit 5493 ms). Shared: Seraph, Karin and Antal ultimates also have no DamageAction (and kit-abstractions lists Si's strokes, Liino's End Stance).
- impact: a phantom 6.08 × ATK ultimate-type hit (skill 12) per ultimate, roughly 4–5% of a Twilight window's damage with Forgeborn, more without.

**2. Pausing and extending a buff's remaining time.**
- family: buff lifecycle.
- feature: a kit buff's timer stops while a condition holds (`pausedWhile: Predicate`, e.g. a state the casting skill creates for frames [0, 115) of normal_skill_during_ult), and a skill can extend an active buff (`extends: {buff, seconds}` per tick, or a hit-applied "add duration" for stacking type 5). The energy block must follow the same buff (block = while show_weapon is active), not a fixed `energyBlockSeconds`.
- evidence: buff_chr_0016_laevat_ult_end and _show_weapon `abilityEventAction` 9 / 203 → PauseBuffTime when buff_chr_0016_laevat_pause_ult is present; normal_skill_during_ult creates pause_ult 0–115; combo_skill Channeling (0–57, every 0.1 s) re-creates show_weapon and ult_end with duration 0.1 (stacking type 5). UltimateSkill desc: "does not shorten the duration of the ultimate, Twilight." Shared: PauseBuffTime also in Wulfa, Mifu, Purrche files.
- impact: Twilight (her highest-damage state: enhanced attacks, ×1.2 `ratio` at P5, plus Forgeborn's +210%) too short by ≈1.3–2.1 s per enhanced battle skill (real time, if jumps skip time; up to 3.8 s if not) and ≈1.9 s per combo; with two battle skills and a combo per Twilight, 30–50% of the window. The energy block ends too early by the same amount.

**3. Stack consumption at a hit, not at the cast.**
- family: buff lifecycle (Melting Flame is a stack buff; FinishBuffAction).
- feature: `requires.consume` should zero the stack when the requiring hit lands (its frame), after earlier hits of the same cast have added to it; the check that picks the branch stays at the cast (frame 3 in the data).
- evidence: normal_skill frame 104 and normal_skill_during_ult frame 98: `FinishBuffAction buff_chr_0016_laevat_energy finishAll`; the explosion (real 22) and during-ult hit 1 (13) add MF before that.
- impact: after every empowered cast the engine keeps 1 Melting Flame that the game doesn't, so the next empowered cast (7.7 × ATK extra hit, forced Combustion, 100 energy) comes one MF source early: up to one extra empowered cast every 3–4 battle skills in MF-limited rotations.

**4. SP returned by a specific hit.**
- family: data compilation (with a kit override).
- feature: a hit's SP return (`sp: ValueExpr`, like `energy`) where the SkillData ObtainCostAction costType 1 sits, granted only if that hit happens; the skill-level "`atb` on the first landing" default only for skills whose ObtainCostAction is on their first hit.
- evidence: normal_skill / normal_skill_during_ult: ObtainCostAction costType 1 `BB:atb` inside the extra hit's channel (gated by `second_hit == 1`); P1 adds `atb` +20 to both skills (PotentialTalentEffectTable chr_0016_laevat_potential_1); engine `skillSpGain` in timeline.ts applies `atb` to the first pending hit of every cast.
- impact: at P1+, 20 SP returned on every non-empowered battle skill (about 3 of 4 casts): about 15% more SP than the game, so too many battle skills.

**5. Branch-dependent timing (JumpToAction).**
- family: timing (and data compilation).
- feature: compile hit frames per branch: after a jump from frame a to b, a timeline frame f ≥ b lands at real a + (f − b); the skill's lock, cancel window and lifetime of spawned entities (FinishOwnerAction) per branch; the kit picks the branch with the hit's `requires` / `if`. Needs the jump semantics confirmed first.
- evidence: normal_skill JumpToAction 30→80 (if has_max_energy), 37→215, 214→231; normal_skill_during_ult 24→75 (if has_max_energy), 39→196, 195→270; FinishOwnerAction on "ball" (the Magma Fragment) at 105. Shared: JumpToAction in 20 operators' SkillData (Typhoeus 4 files, Liino 3, Purrche 5, …).
- impact: if jumps skip time, her extra hit and forced Combustion land ≈1.7 s (50 frames) earlier than the kit says, the non-empowered battle skill is shorter and the empowered one longer than the single lock assumes, and the empowered cast loses 3 of 10 burn ticks (≈0.4 × ATK). Changes buff windows and rotation timing; damage per hit unchanged.

**6. Partial absorption bounded by the receiver's room, with a condition and cooldown.**
- family: arts state (consumption) and triggers.
- feature: `consumeInfliction` takes `maxStacks: ValueExpr` (here: the owner's room in `melting_flame`, max − current), removes only that many stacks and leaves the rest with its timer; team triggers get `if: Predicate` (judged for the trigger's owner: `stack melting_flame below 4`) and `cooldownSeconds` (1).
- evidence: buff_chr_0016_laevat_passive_teammate abilityEvent 302: CheckBuffStackNumAdvanced energy < max_stack before the action and before each per-stack FinishBuffAdvanced (finishLayerCnt 1, isAbsorbed); passive_teammate_cd 1 s. Kit-abstractions lists partial consumption (`FinishBuffAdvanced finishLayerCnt`) as shared.
- impact: at 4 MF (or with more Heat than room) the engine strips all Heat from the enemy, so teammates' Heat bursts and Combustion / Corrosion reactions that should still happen (and Laevatain's combo trigger) go missing; MF counts themselves are already right.

**7. Trigger on a stack reaching a count; values from a talent's attached buff.**
- family: triggers and values.
- feature: trigger `on: {stackReached: melting_flame, atLeast: 4}` → apply a kit buff on self; ValueExpr source `{talentBuff: index, key}` (the talent node's attachBuff blackboard at the build's talent level) for its value (`ignore_fire_resist` × −1) and duration (`ignore_fire_resist_duration`).
- evidence: buff_chr_0016_laevat_energy buffEvent 6 → Switch on count == max_stack → buff_chr_0016_laevat_energy_icon_5 → buff_chr_0016_laevat_ignore_fire_resist (attr 98, duration `ignore_fire_resist_duration` 20 s); talent text "After reaching {max_stack:0} stacks, DMG dealt by Laevatain ignores … Heat Resistance … for {ignore_fire_resist_duration:0}s." Kit-abstractions "values from talents' attached skills" (Arcane, Gilberta) is the same value source.
- impact: today it's a manual always-on condition: with it on, every Heat hit outside the 20 s window is ×1.2 too high against a 0-RES enemy; with it off, the empowered extra hits (always in the window) and early Twilight hits are too low.

**8. Equipment triggers (wielder-relative) that apply timed buffs.**
- family: triggers (and buff lifecycle for the stacking).
- feature: weapon and gear-set kits get the same `triggers` / `buffs` as operator kits, relative to the wielder: `on` the wielder casting a skill type (ultimate), the wielder applying a status to an enemy (Combustion / Corrosion / ≥ N infliction stacks), or any status being applied to an enemy by anyone; `do`: apply a self buff valued from the equipment skill's blackboard at its level (zone and filters from its BuffData attributes: attr 17 → basic-attack damage bonus, 51 / 54 → Heat / Nature damage bonus); stacking per BuffData: refresh without stacking (types 2 / 4) or independent instances up to `max_stack`; trigger cooldown (0.1 s).
- evidence: sk_wpn_sword_0006 passiveEventActions abilityEvent 143 + CheckSkillType [7] → buff_wpn_sword_0006_valid (20 s, stacking type 4); sk_wpn_sword_0010 → buff_wpn_sword_0010_inaura abilityEvent 205 + Combustion / Corrosion tags + CreateTimedMarker 0.1 s → buff_wpn_sword_0010_valid (stacking type 2, max_stack 2, "Duration of each stack is counted separately"); passive_equipsuit_fninflict_01 → buff_equipsuit_fninflict_01 abilityEvent 102 + tag → firedamageadd (10 s). Skill type 7 = ultimate confirmed by sk_wpn_funnel_0005 / sk_wpn_claym_0018 descriptions.
- impact: Forgeborn's +210% basic attack DMG (the largest single bonus in her kit) is all-or-nothing: on for a whole fight it overstates every plain basic attack outside the 20 s window (and Twilight tails beyond 20 s once gap 2 is fixed); off, it halves Twilight damage. Umbral Torch's 22.4–44.8% Heat bonus and Hot Work's 50% can't be simulated at all.

**9. Buff instances with independent durations.**
- family: buff lifecycle.
- feature: a kit buff with `maxStacks` (from BuffData `maxStackCnt` / `max_stack`) where each application is its own instance with its own expiry and the modifiers count once per live instance (today `withBuff` replaces the previous instance).
- evidence: buff_wpn_sword_0010_valid (stacking type 2, useMaxStackCntKey); Umbral Torch description "Duration of each stack is counted separately".
- impact: Umbral Torch's second stack (+22.4%) is lost or never expires.

**10. Final Strike per landing.**
- family: data compilation.
- feature: compile the decorate mask per landing (DamageAction instance), so a kit entry with `count > 1` flags only the landings with bit 2097152; or the compiler splits such entries.
- evidence: attack5 frames 23 (mask 128) and 26 (2097280); ult_attack4 frames 22 (128) and 26 (2097280); `isFinalStrike` in packages/data/src/kits.ts works per entry.
- impact: her absorption runs at the first landing (3–4 frames early) and twice per attack (harmless now; with gap 6's cooldown the second is blocked anyway). Wrong for anyone who reacts to Final Strike counts.

**11. Hits dealt by buffs (combo).**
- family: data compilation.
- feature: follow CreateBuffAction → the buff's `triggerInterval` / `waitFirstTriggerInterval` → the buff's timeline DamageAction, to place the hit (and its stack gain) at creation frame + interval; take the event key from the buff's file.
- evidence: combo_skill frame 20 creates buff_chr_0016_laevat_combo_skill_start (trigger 0.7 s for the first enemy) → buff_chr_0016_laevat_combo_skill_hit DamageAction; combo_skill_hit_self MF at its frame 21–24.
- impact: combo damage and its MF land ≈21 frames (0.7 s) early; affects which buffs it sees and when the next empowered cast is possible.

**12. Stagger, Finisher, and Finisher-triggered absorption.**
- family: physical state.
- feature: poise damage per hit (`poise` units, "controlled operator only"), a stagger meter and Staggered state, the finisher skill (BreakingAttackCalculation split, `GainBreakingAttackAtb`), and Finisher as a trigger event (mask bit 4) for her absorption.
- evidence: attack5 / ult_attack4 poise units (`onlyEnableForMainChar`); power_attack; passive_teammate mask 2097156; talent text "Final Strike or Finisher".
- impact: no finisher damage (atk_scale 9.0 at skill 12) or its absorption; stagger-window damage bonus not simulated. Already known to be unsupported (brief).

**13. Time dilation.**
- family: timing.
- feature: combo TimeDilationAction (0.6 s, curve ComboSkill, caster and controlled operator excluded) and UltimateTimeAction (0–61) slowing or pausing the enemy's (and status) clock.
- evidence: chr_0016_laevat_combo_skill frame 0–15; chr_0016_laevat_ultimate_skill frame 0–61.
- impact: Combustion ticks, infliction and buff timers run on during the ultimate's 2 s animation and the combo's slow-down; small per cast. Known unsupported.

**14. Basic attack chain legality.**
- family: skills (states).
- feature: a basic step is castable only as the next step inside the previous step's AllowNextSkillAction / ComboCacheAction window (else attack1); `apply` should refuse out-of-order steps.
- evidence: attack1–5, ult_attack1–4 AllowNextSkillAction `allowedSkillIdList`.
- impact: recorded rotations can repeat attack5 (Final Strikes, absorption) illegally; search is unaffected.

**15. Ultimate takes control; cooldown from a buff's end.**
- family: skills (states, cooldowns).
- feature: a skill flag `takesControl` (the caster becomes controlled at the cast); a cooldown that starts when a named buff ends (`cooldownFrom: {buffEnds: …}`).
- evidence: UltimateSkill desc "becomes the controlled operator"; ultimate_skill TeleportAction when not main char; buff_chr_0016_laevat_show_weapon end event → SetSkillCdAtOnce ultimate 10 s.
- impact: an explicit swap is needed after an off-field ultimate (it waits for the current action, a few frames to ~1 s late); the ultimate's cooldown is 16 s too short, rarely binding.

**16. Kills and HP (deferred candidates).**
- family: *new* (multi-enemy / survivability: no existing family covers kills or HP).
- feature: enemy defeat events (P5 Twilight extension, absorption from defeated enemies) and an HP model (talent 2).
- evidence: buff_chr_0016_laevat_potential_5 abilityEvent 222; buff_chr_0016_laevat_passive_enemy abilityEvent 1; talent_2_0 CheckHp / ShelterAction.
- impact: none against one enemy that doesn't die; propose deferring.

Unknowns (need a test or more logs, not engine work yet): rows 2 (projectile travel), 14 / 20 (`ratio` vs `extra_scaling` on the battle skill hits), 18 (jump semantics), 19 (InterruptAction = Immobilization?), and the log question below.

## Verification

- **fixtures/zero-sanity-laevatain-p5.json** (P5, skills 12, Forgeborn 9/9/9): stat panel (incl. Forgeborn and potentials), per-hit damage of basic attacks, battle skill explosion and ticks, empowered extra (57552), combo (26908), enhanced attacks with Forgeborn's buff, during-ult hits. It is the only source for rows 14 / 20, and it disagrees with SkillData on row 14 (data: ×ratio 1.2 → 46,040; Zero Sanity: ×1.5). Values only, no timing.
- **fixtures/zmdlogs-40d9a3c1da37.json** (P5, Forgeborn 9/9/9): 17/17 Laevatain hits match (enhanced attacks with ratio 1.2, a Heat burst, a Combustion reaction from enhanced attack 3 on Nature at 14441 ms, burning ticks). buff_wpn_sword_0006_valid is logged on every hit 6657–18684 ms (consistent with a 20 s window from an earlier cast). It has no battle skill, combo, Final Strike or ultimate-cast event, so MF, absorption, gaps 2–5 and 11 can't be checked from it. `efsim zmdlogs reactions` leaves a Heat burst credited to Laevatain at 7550 ms unexplained (no hit of hers then; her SpellInflictions in ult_attack4 are disabled): either another operator's Heat over hers is credited to the infliction's owner (an arts-state attribution question for status.ts), or a source is missing; Camille's kit has no inflictions yet, so this can't be settled from this log.
- No other fixture has Laevatain.

Simple in-game tests (training dummy, no crit numbers):
1. **Extra hit multiplier** (rows 14, 20): cast the battle skill with 4 MF; compare the extra hit with the explosion of the same cast. Ratio 5.5 (skill 12) × 1.0 at P0, × 1.2 at P1–P2 if the data is right, × 1.5 at P3+ if Zero Sanity is right. During Twilight, compare enhanced battle skill hit 1 with the Scorching Heart icon absent: ×1.2 over 3.3 × the explosion unit means `ratio` applies (kit), ×1.0 means it doesn't (data).
2. **MF after an empowered cast** (gap 3): with 4 MF, cast the battle skill once; the MF counter afterwards reads 0 (data) or 1 (engine).
3. **Twilight length** (gap 2): time the Twilight HP-bar timer from the ultimate to its end with no battle skills, then with two enhanced battle skills and one combo during it.
4. **Battle skill timing** (gap 5): on video, frames from the cast to the extra hit (≈54 real frames = jumps skip time; ≈104 = they don't), and how soon the next action can start after an empowered and a plain cast.
5. **Partial absorption** (gap 6): with 3 MF and 3 Heat stacks on the dummy, land a Final Strike: MF 4 and 2 Heat stacks left (data) vs none left (engine).
6. **Scorching Heart window** (gap 7): the icon appears on reaching 4 MF and lasts 20 s.
7. **P1 SP return** (gap 4, owner needs P1): SP after a plain battle skill vs an empowered one.
8. **Ultimate damage** (gap 1): does a damage number appear when the ultimate is cast (expected: none)?

## Re-analysis (pass 2, 2026-10-18)

Against the engine and kit format at `b33e2e7` (batch-1 "Progress": T1–T3,
C1–C2, B1–B6, V1–V5, S1–S7, A1–A5, P1–P2, Ti1 part, Ti4, L1, D1 compiler),
`efsim kit-draft chr_0016_laevat` (v2) and the D1 `KNOWN` list in
`packages/data/test/skillCompile.test.ts`. Data re-checked in rmxlinux
SkillData / BuffData (game 1.6) and the loader's tables (level 12 values
below unless said). Earlier claims re-checked; corrections are marked
**(corrected)**.

### 1. First-round rows and gaps against the current engine

| First-round row (gap) | Now supported? | How (fields), or what's still missing |
|---|---|---|
| 2 Attack 4 hits 2–3 are projectiles | yes (timing unknown) | kit-draft: separate entry `chr_0016_laevat_attack_5_projhit` (frames 12, 19, `events: [chr_0016_laevat_attack_5_projhit]`, `detached: true`). Travel time isn't in the data (Ti2 open, no data): launch frame stays a lower bound |
| 3, 42 Final Strike only on the 2nd landing (gap 10) | yes | split entries, as kit-draft does: attack5 `hit` (23, `finalStrike: false`) + `hit_2` (26, `finalStrike: true`); ult_attack4 `hit` (22) + `hit_2` (26). KNOWN lists both as kit errors |
| 4 SP at the skill's first landing | yes | hit `sp` (replaces the skill's `atb` default): attack5 `hit_2` and ult_attack4 `hit_2` `sp: {if: {controlled: true}, then: "atb", else: 0}` (CheckMainCharacterCondition; `controlled` for a hit is judged at its cast). attack1–4, ult_attack1–3 have `atb` 0 at every level: no SP |
| 5 Final Strike poise (gap 12) | yes (data) | P2: hit `poise` + `poiseControlledOnly`. The compiler skips damage units of `damageAttributeType` 1, so the kit hand-writes them: list in the kit plan (attack5 `poise` 18, ult_attack4 `poise` 24, battle-skill hits `poise` / `poise_extra` 10) |
| 6 Finisher (gap 12) | yes (data) | P2: `skillSpecification` 8 gates it on a Staggered enemy, once per stagger, ×attr 27, finisher SP. kit-draft emits `power_attack` hits at 5 and 42 with plain `atk_scale`; the BreakingAttackCalculation `multiplier` (0.2 / 0.8) isn't compiled: hand-write `factor` |
| 7 Dive, dash | yes | plunging_attack_end is in kit-draft (1.8, frame 1); dash_attack isn't a skill group (not castable in a rotation): leave out |
| 8 Chain order (gap 14) | yes | S3/S5: chain steps from the data's AllowNextSkillAction windows (attack1→…→5, ult_attack1→…→4, each window also lists attack1) |
| 11 Team energy at the first hit | yes | `teamEnergyFrame` 22 (normal_skill) and 13 (during_ult), from kit-draft (KNOWN lists the kit's missing value) |
| 13 MF consumed at the extra hit (gap 3) | yes | B5: `requires: {stack: "melting_flame", atLeast: 4, consume: true, consumeAt: "hit"}` on the extra hit; the explosion's / hit 1's +1 lands before it, so 0 are left |
| 14 Normal extra hit: `ratio` or `extra_scaling` | unknown | both writable. Data (re-checked): frame 104 `ModifyDynamicBlackboard atk_scale_3 ×= ratio`; `extra_scaling` only goes to `burning_triggered` (assignItems). Kit keeps Zero Sanity's `extra_scaling` until in-game test A |
| 17 P1 SP only on the extra hit (gap 4) | yes | extra hit `sp: "atb"` on both battle skills (ObtainCostAction costType 1 inside the extra hit's channel, `second_hit == 1`); with a hit naming `sp`, the skill's default first-hit SP is off. `atb` is 0 below P1 |
| 18 Branch jumps (gap 5) | **no** | Ti3 still open: kit-draft reports the jumps "not followed", and the engine reads every SkillData timing (windows, `exclusiveFrame`, `durationFrame`, channels) as real frames. Hits can be placed per branch by hand (`requires` at/below 4 picks the branch), but the lock, cancel windows and pause length can't depend on the branch. Gap R1 |
| 19 InterruptAction / BlowOffAction | unknown (no consumer) | not a control status (no tag; Jade Vessel listens to Si's own hitstop buff). No equipment in batch 1 reacts to it; leave out |
| 20 During-ult hits 1–2 and `ratio` | unknown | data (re-checked): no ratio on them (only `atk_scale_3 ×= ratio` at 98), and P1 sets `ratio` 1.2 on during_ult too. Kit keeps ×ratio (Zero Sanity) until test A |
| 23 Twilight paused by the enhanced battle skill (gap 2) | yes, partly | `extendBuff` at the cast (kit trigger `twilight_paused_by_battle_skill`, +115 frames). Missing: (a) the length per branch (R1; 39 or 64 real frames if jumps skip time), (b) the pause ends early when the skill is cut short (`pause_ult` has `autoFinishByAction`, `finishWithNextSkillIfNotInherited`): a combo or second battle skill inside 33–75 keeps the whole +3.83 s. Gap R3 |
| 26 Combo hits only enemies with Combustion / Corrosion | yes | hit `if: {any: [{enemyStatus: "combustion"}, {enemyStatus: "corrosion"}]}` |
| 27 Combo hit dealt by a buff, ≈21 frames late (gap 11) | yes | kit-draft: frame 41, `events: [buff_chr_0016_laevat_combo_skill_hit]`, `detached: true` (CreateBuff@20 + 0.7 s trigger interval) |
| 30 Combo holds Twilight (gap 2) | yes (semantics unknown) | `extendBuff` +1.9 s on combo casts (kit trigger `twilight_paused_by_combo`; no-op outside Twilight, like the data's `ult_end ≥ 1` check). Rests on stacking type 5 = "add duration" (claim): test C |
| 31 Combo time dilation (gap 13) | yes | Ti1 reads it from SkillData (`TimeDilationAction` layer 0, curve `ComboSkill`, 0.6 s). **(corrected)** `ignoreTargets` are the caster (targetSource 4) and her own spawned entities, not "the controlled operator"; the engine exempts the caster |
| 34 Ultimate has no damage (gap 1) | yes | S1: `hits: []` (kit-draft); Twilight from a cast trigger at frame 0 |
| 36 Energy block follows show_weapon | yes | kit buff `show_weapon` (16 s, `blocksEnergy: true`), extended by the same pause triggers as Twilight; drop `energyBlockSeconds` |
| 37 Ultimate cooldown from show_weapon's end (gap 15) | yes (workaround) | the `cooldown` action only changes a running cooldown, so add at the cast: ultimate cast trigger `{kind: "cooldown", who: "self", skills: "ultimate", seconds: 16}` (10 s from SkillPatchTable + 16 = show_weapon's end + 10) and the same `seconds` as each pause extension. Exact except the ultimate's own 61-frame time stop (buffs shift, cooldowns don't: ≤ 2 s, and only if test 18 says so) |
| 38 Ultimate takes control (gap 15) | yes | S7: `takesControl: true` |
| 39 UltimateTimeAction 0–61 (gap 13) | yes | Ti1, from SkillData (61 frames of scale 0) |
| 41 Enhanced attack 3 inflicts Heat | yes | kit-draft compiles the enabled SpellInfliction (same frame as the damage, 9) |
| 43, 47, 50 Kills and HP (gap 16) | deferred | owner decision (batch-1 "Owner decisions"): N1 comes with multi-enemy support. No effect on one enemy |
| 44 Absorption on Finisher | **no** | the `hit` event filters on `kinds`, `elements`, `finalStrike` only; nothing tells a finisher hit (decorate bit 4, `skillSpecification` 8) from a basic attack. Gap R2 |
| 45 Partial absorption with `if` (gap 6) | yes | A2 + C1: `if: {stack: "melting_flame", below: 4}` on the trigger; `consumeInfliction` `stacks: {sum: [4, {product: [-1, {stackCount: "melting_flame"}]}]}`; gain `{consumed: true}` |
| 46 Absorption 1 s cooldown (gap 6) | yes | trigger `cooldown: 1` (set only when the trigger fires, as passive_teammate_cd is created only after the MF < 4 check) |
| 48 Scorching Heart on reaching 4 MF (gap 7) | yes | trigger `on: {event: "stackAtLeast", stack: "melting_flame", atLeast: 4}`, `skill: "buff_chr_0016_laevat_passive"` (talent buff source, V1); kit buff with `ignoreResistance` fire `{product: [-1, "ignore_fire_resist"]}` for `ignore_fire_resist_duration`. Note: `stackAtLeast` fires on every stack event at ≥ 4, including a capped gain that changes nothing (the empowered cast's own explosion / hit 1); the data's Switch runs on a stack change (buffEvent 6). Guard with `if: {not: {buffActive: …}}`, else the window restarts at the consuming cast; whether a capped gain fires buffEvent 6 is test F |
| W2 Forgeborn +210% basic for 20 s on the wielder's ultimate (gap 8) | yes | equipment kit trigger `on: {event: "cast", kinds: ["ultimate"]}`, `by: "self"`, buff attr 17 (CheckSkillType [7] = ultimate) |
| W4 Umbral Torch layers (gaps 8, 9) | yes | equipment trigger `on: {event: "reaction", statuses: ["combustion", "corrosion"]}`, `by: "anyone"` (inaura on every enemy, abilityEvent 205, any applier, forced ones carry the tag), `cooldown: 0.1` (CreateTimedMarker on the wielder), buff `maxStacks: "max_stack"` (stacking type 2, separate durations) |
| G1 Hot Work 3-piece | yes | gear-set kit `suit_fire_natr01`: `reaction` combustion / corrosion `by: "self"` → attr 51 / 54 buffs (stacking type 2, max 1: refresh). Not active in her builds (1 piece) |
| G2 Tide Surge 3-piece | yes | gear-set kit `suit_burst01`: `inflictionApplied` `minStacks: 2` `by: "self"` (abilityEvent 102 + infliction tag + target stacks ≥ `stack_cond` 2) → attrs 51–54 + `spell_dmg_up`. Not active in her builds (1 piece); not a batch-1 set |
| Static checks of the new buffs | **no** | the per-hit fixture (fixtures/zero-sanity-laevatain-p5.json, tests/damage.test.ts) switches on `wpn_sword_0006.after_ultimate` and `chr_0016_laevat.scorching_heart` as conditions; once both are triggered buffs, a static hit can't name them. Gap R5 |
| Data the kit still hand-writes | data | kit-draft omits poise, BreakingAttackCalculation factors, own-stack gains (CreateBuff `buff_chr_0016_laevat_energy`: explosion, during-ult hit 1, `combo_skill_hit_self`), the forced Combustion's `durationKey` / `scaleKey` (the assignItems), the entity's end (FinishOwnerAction "ball" at 105). Gap R4 |
| Log: Heat burst at 7550 ms credited to her | unknown | `efsim zmdlogs reactions` still: predicted Combustion at 6657 ms (ult_attack3's Heat on Si's Cryo) not logged; Heat bursts at 7550 (hers) and 7663 (Camille's) unexpected. ult_attack3's SpellInfliction is at its damage frame, so no hidden later infliction of hers; Camille's kit has no inflictions, so the replay stays incomplete. Not a Laevatain gap |

Rows the first round already had as `supported` (1, 9, 10, 12, 15, 16, 21,
22, 24, 25, 28, 29, 32, 33, 35, 40, 49, 51, 52, W1, W3) stay supported;
24's `availableWhile` is now `available: {buffActive: "twilight"}`.

### 2. Remaining gaps

None is unique: each is in another operator's data (checked against
[kit-unique.md](../../kit-unique.md), which is empty).

**R1. Branch timing (JumpToAction).**
- family: timing (Ti3) and data compilation.
- feature: a skill's timeline played per branch: for each `JumpToAction`
  (frame a → b, with its condition), timeline frames f ≥ b map to real
  a + (f − b). The branch is chosen at the cast from the jump conditions; a
  kit sketch: `"branches": [{"if": {"stack": "melting_flame", "atLeast": 4},
  "jumps": [[30, 80], [214, 231]]}, {"jumps": [[37, 215]]}]` (normal_skill),
  `[{"if": …, "jumps": [[24, 75], [195, 270]]}, {"jumps": [[39, 196]]}]`
  (during_ult). The engine maps everything through it: hit frames, cast-trigger
  `delay`s, AllowNextSkillAction windows, `exclusiveFrame`, `durationFrame`,
  channels, timeline-range buffs (`pause_ult` 0–115); an action range the
  cursor jumps past ends at the jump. The compiler follows jumps per branch
  and drops detached entity hits after a FinishOwnerAction on the entity
  (normal_skill frame 105 ends the Magma Fragment).
- evidence: normal_skill JumpToAction 30→80 (if `has_max_energy`, set at
  frame 3 when MF ≥ 4), 37→215, 214→231; FinishOwnerAction `ball` 105;
  `exclusiveFrame` 117, `durationFrame` 282. normal_skill_during_ult 24→75
  (if `has_max_energy`), 39→196, 195→270; `exclusiveFrame` 115, window
  33–75, `pause_ult` 0–115, `durationFrame` 271. kit-draft notes "not
  followed". Shared: JumpToAction in 20 operators' SkillData (Typhoeus,
  Liino, Arcane's seal_again among batch 1; Purrchena in batch 2).
- impact (if jumps skip time, test B): the empowered extra hit and forced
  Combustion land at real 54 (normal) / 47 (during ult) instead of 104 / 98
  (≈1.7 s late now); the plain battle skill locks her 37 frames, not 117
  (2.7 s too long now), the empowered one 67; the enhanced battle skill locks
  and pauses Twilight 39 (plain) / 64 (empowered) frames, not 115, so each
  costs 1.7–2.5 s of rotation time and Twilight is held as much too long;
  the empowered cast loses burn ticks at 58, 62, 66 (3 × 0.14 ATK). Damage
  per hit unchanged; DPS and every buff window after a battle skill move.
  Until it exists, the kit can place the hits per branch by hand (kit plan)
  but not the lock.

**R2. Finisher as a hit filter.**
- family: triggers.
- feature: `on: {event: "hit", finisher: true}` (and `false`): the hit is a
  finisher (decorate-mask bit 4 on the landing; equivalently its skill's
  `skillSpecification` 8). Her absorption is "Final Strike **or**
  Finisher" with one 1 s cooldown, and two triggers can't share a cooldown,
  so the filter must be an any-of in one trigger: e.g. `on: {event: "hit",
  decorations: ["finalStrike", "finisher"]}` (any of the listed bits), with
  `finalStrike: true` kept as shorthand.
- evidence: buff_chr_0016_laevat_passive_teammate abilityEvent 302,
  CheckDamageDecorateMask `mask` 2097156 (Final Strike | Finisher); talent
  text "Final Strike or Finisher"; power_attack mask 132 (128 basic + 4).
  Shared: Arcane's Cluster Strike (buff_chr_0032_lizhiyan_ultimate_skill_inaura,
  mask 4 and 2097152; her report row 30), Avywenna's talent listener
  (buff_chr_0012_avywen_talent_0_listener, mask 4; batch 2).
- impact: no Heat absorption from any operator's finisher: up to 4 MF per
  stagger lost (one empowered battle skill, 7.7 × ATK, forced Combustion,
  100 energy, per stagger window where the team has Heat on the enemy).

**R3. A pause that ends with the skill that pauses.**
- family: buff lifecycle (B2's remainder).
- feature: either `pausedWhile: Predicate` on a kit buff (its timer stops
  while it holds; `pause_ult` becomes a kit buff applied by a cast trigger,
  ended by `endBuff` on the owner's next cast), or the smaller value
  `{buffRemaining: "<buff>"}` (seconds left) so a trigger on the owner's next
  cast can `extendBuff` Twilight and show_weapon by its negative and end the
  pause buff.
- evidence: normal_skill_during_ult CreateBuff `pause_ult` 0–115 with
  `autoFinishByAction`, `finishWithNextSkillIfNotInherited`;
  buff_chr_0016_laevat_ult_end / _show_weapon PauseBuffTime while it
  exists. Shared: PauseBuffTime in Wulfgard's, Mifu's and Purrchena's files
  (first-round gap 2).
- impact: when a combo, ultimate or second battle skill (window 33–75)
  cuts the enhanced battle skill short, Twilight and the energy block keep
  the full extension: up to ≈3 s (≈1 s if R1's skip semantics hold) per
  such cut. Hand-written rotations that wait for the skill's hits lose
  ≤ 0.6 s.

**R4. Compiler leftovers for her kit.**
- family: data compilation (D1).
- feature: kit-draft and later loader defaults should also emit: poise per
  landing (damage units with `damageAttributeType` 1: DefiniteValueCalculation
  `value` key, `onlyEnableForMainChar` → `poiseControlledOnly`; the
  dash attack's `valueScale` 0.5 with `applyScale`); BreakingAttackCalculation
  `multiplier` as `factor`; own-stack gains and finishes (CreateBuff /
  FinishBuffAction of a buff that is a kit stack, here
  `buff_chr_0016_laevat_energy`: `gains`, `requires.consume`,
  `consumeAt: "hit"`); the forced reaction's assigned `duration` /
  `extra_scaling` as `durationKey` / `scaleKey`; the combo's energy under
  the skill's own key (`usp_1_display`, the buff's `usp_1` isn't a skill key).
- evidence: kit-draft output for chr_0016_laevat (none of these present);
  `skillCompile.ts` damage() skips `damageAttributeType !== 0` and notes
  non-ATK calculations only; KNOWN entry for the combo's energy key.
- impact: none on numbers once the kit hand-writes them (the plan below
  does); every hand-written value is one more thing to keep right.

**R5. Triggered buffs in static per-hit checks.**
- family: log tooling (fixtures and `calc`).
- feature: per-hit fixtures and `efsim calc` name kit buffs (operator and
  equipment, with a layer count) as active, e.g. fixture
  `"buffs": ["wpn_sword_0006.valid", "chr_0016_laevat.scorching_heart"]`,
  resolved through the same buff definitions the timeline uses
  (`DamageOptions.modifiers` already carries such modifiers).
- evidence: fixtures/zero-sanity-laevatain-p5.json entries with
  `conditions: ["wpn_sword_0006.after_ultimate"]` (4 hits) and
  `chr_0016_laevat.scorching_heart`; `schemas/fixture.schema.json` has only
  `conditions`; tests/damage.test.ts. Shared: every kit whose legacy
  conditions become triggered buffs (Jade Vessel's `enemy_vulnerable` /
  `combo_after_battle_skill`, …).
- impact: no numeric effect on simulations; without it the kits phase must
  either keep duplicate legacy conditions (double-counting if a scenario
  switches one on while its trigger fires) or lose the in-game check of
  Forgeborn (+210%) and Scorching Heart.

Deferred by the owner, not counted: kills and HP (first-round gap 16 → N1).

### 3. Kit plan

Values are level-12 / weapon-level-9 data; frames are timeline frames as the
data has them (R1: a "real" alternative is given where jumps matter; use it
only once test B says jumps skip time). Every hit lists `events` (log key).

**Stacks.** `melting_flame`, max 4 (talent buff `max_stack` 4; BuffData
buff_chr_0016_laevat_energy stacking type 3, lifeType 1: no expiry).

**Buffs** (operator kit):
- `twilight`: self, `duration: "duration"` (ultimate 15 s), no modifiers,
  `gameBuff: buff_chr_0016_laevat_ult_end`.
- `show_weapon`: self, `duration: 16` (BuffData default; created at the
  ultimate's frame 0), `blocksEnergy: true`, `gameBuff:
  buff_chr_0016_laevat_show_weapon`.
- `scorching_heart`: self, `duration: "ignore_fire_resist_duration"` (20),
  modifiers `[{zone: "ignoreResistance", elements: ["fire"], value:
  {product: [-1, "ignore_fire_resist"]}}]` (−10 / −15 / −20 by talent level),
  `gameBuff: buff_chr_0016_laevat_ignore_fire_resist`. Replaces the
  `scorching_heart` condition (keep that only until R5).

**Triggers** (operator kit):
1. `ultimate_state`: `on: {event: "cast", skills: ["chr_0016_laevat_ultimate_skill"]}`,
   `by: "self"`, `skill: "chr_0016_laevat_ultimate_skill"`, do: `buff
   twilight`, `buff show_weapon`, `{kind: "cooldown", who: "self", skills:
   "ultimate", seconds: 16}` (row 37).
2. `twilight_paused_by_battle_skill`: `on: cast` of
   `chr_0016_laevat_normal_skill_during_ult`, do: `extendBuff twilight` and
   `extendBuff show_weapon` by 115/30 s, `cooldown` ultimate +115/30 s.
   With R1's skip semantics: two triggers, `if: {stack: "melting_flame",
   atLeast: 4}` → 64/30 s, `if: {stack: "melting_flame", below: 4}` → 39/30
   s (the trigger's `if` sees MF before `consumeAt: "hit"` uses it).
3. `twilight_paused_by_combo`: `on: {event: "cast", kinds: ["combo"]}`,
   `if: {buffActive: "twilight"}`, do: `extendBuff` twilight / show_weapon
   1.9 s, `cooldown` ultimate +1.9 s (combo_skill ChannelingAction 0–57
   every 0.1 s).
4. `final_strike_absorb`: `on: {event: "hit", finalStrike: true}`, `by:
   "controlled"`, `if: {stack: "melting_flame", below: 4}`, `cooldown: 1`,
   do: `apply consumeInfliction {elements: ["fire"], stacks: {sum: [4,
   {product: [-1, {stackCount: "melting_flame"}]}]}}`, `gain melting_flame
   {consumed: true}` (passive_teammate). Finisher half after R2.
5. `combo_window`: `on: {event: "reaction", statuses: ["combustion",
   "corrosion"]}`, `by: "anyone"`, do: `openCombo` (unchanged).
6. `scorching_heart`: `on: {event: "stackAtLeast", stack: "melting_flame",
   atLeast: 4}`, `skill: "buff_chr_0016_laevat_passive"`, `if: {not:
   {buffActive: "scorching_heart"}}`, do: `buff scorching_heart`
   (energy → energy_icon_5 → ignore_fire_resist). Drop the `if` if test F
   shows capped gains refresh it.

**Skills** (from kit-draft v2, corrections in bold):
- attack1 `hit` 6; attack2 `hit` ×2 at 6, 13; attack3 `hit` 9; attack4
  `hit` 6 + `chr_0016_laevat_attack_5_projhit` ×2 at 12, 19 (detached); all
  `atk_scale`, `available: {not: {buffActive: "twilight"}}`, no SP (`atb` 0).
- attack5: `hit` 23 (`finalStrike: false`); **`hit_2` 26 (`finalStrike:
  true`, `sp: {if: {controlled: true}, then: "atb", else: 0}` (20),
  `poise: "poise"` (18), `poiseControlledOnly: true`)**.
- normal_skill (`teamEnergyFrame: 22`, available outside Twilight):
  - `explosion` 22, `atk_scale` (1.4), events
    `chr_0016_laevat_normal_skill_abilityentity`, detached, `gains:
    [{stack: "melting_flame"}]`, **`poise: "poise"`** (10).
  - `dot` ×10 at 29, 33, 37, 41, 45, 49, 54, 58, 62, 66, `atk_scale_2`
    (0.14), same event key, detached. With R1's skip semantics, split off
    58, 62, 66 with `requires: {stack: "melting_flame", below: 4}` (the
    entity ends at real 55 in the empowered branch).
  - `extra` 104 (real 54 if jumps skip), events `chr_0016_laevat_normal_skill`,
    scale `["atk_scale_3", "extra_scaling"]` (Zero Sanity; data: `"ratio"`,
    test A), **`requires: {stack: "melting_flame", atLeast: 4, consume:
    true, consumeAt: "hit"}`**, `applies: [{kind: "forcedReaction", status:
    "combustion", durationKey: "duration", scaleKey: "extra_scaling"}]`,
    `energy: "extra_usp"` (100), **`sp: "atb"`** (P1 +20), **`poise:
    "poise_extra"`** (10).
- normal_skill_during_ult (`teamEnergyFrame: 13`, `available: {buffActive:
  "twilight"}`): `hit1` 13 `["atk_scale", "ratio"]` (3.3; data: no ratio,
  test A) with `gains`, `poise: "poise"`; `hit2` 23 `["atk_scale_2",
  "ratio"]` (3.7), `poise`; `extra` 98 (real 47) `["atk_scale_3", "ratio"]`
  (9.0), requires / forced Combustion as above, **`sp: "atb"`**, `poise`,
  no energy.
- combo_skill: **`hit` 41**, events **`buff_chr_0016_laevat_combo_skill_hit`**,
  detached, `atk_scale` (5.4), `energy: "usp_1_display"` (25, one enemy),
  `gains: [{stack: "melting_flame"}]` (combo_skill_hit_self, ≈41),
  **`poise: "poise"`** (10), **`if: {any: [{enemyStatus: "combustion"},
  {enemyStatus: "corrosion"}]}`**. Cooldown 9 s from SkillPatchTable.
- ultimate_skill: **`hits: []`**, **`takesControl: true`**, no
  `energyBlockSeconds` (show_weapon blocks), cost 300 (P4 ×0.85).
- ult_attack1 12, ult_attack2 ×2 at 10, 21, ult_attack3 9 (`applies
  infliction fire`), ult_attack4 `hit` 22 + **`hit_2` 26 (`finalStrike:
  true`, `sp` as attack5 (22), `poise` 24, `poiseControlledOnly`)**; all
  `["atk_scale", "ratio"]` (P5 ratio 1.2), `available: {buffActive:
  "twilight"}`.
- **power_attack** (finisher, both states): `hit` 5 `atk_scale` (9.0)
  `factor: 0.2`, `hit_2` 42 `factor: 0.8`, events
  `chr_0016_laevat_power_attack`, damage type basic (mask 132 has bit 128);
  the engine adds the enemy's finisher multiplier and SP.
- plunging_attack_end (optional): `hit` 1, `atk_scale` 1.8.

**Equipment kits.**
- `wpn_sword_0006.json` (Forgeborn Scathe): buff `wpn_sword_0006.valid`
  (self, `duration: "duration"` 20, modifiers `[{attr: 17, value:
  "normal_atk_up"}]` 2.1, `gameBuff: buff_wpn_sword_0006_valid`; stacking
  type 4: a recast refreshes); trigger `wpn_sword_0006.on_ultimate` `on:
  {event: "cast", kinds: ["ultimate"]}`, `by: "self"`, `skill:
  "sk_wpn_sword_0006"`, do `buff`. Heat DMG +44.8% stays on the stat panel.
  The `after_ultimate` condition goes once R5 exists (the example scenarios
  don't switch it on; the Zero Sanity fixture does).
- `wpn_sword_0010.json` (Umbral Torch, new): buff `wpn_sword_0010.valid`
  (self, `duration: "duration"` 20, `maxStacks: "max_stack"` 2, modifiers
  `[{attr: 51, value: "dmg_up"}, {attr: 54, value: "dmg_up"}]` 0.224,
  `gameBuff: buff_wpn_sword_0010_valid`); trigger `on: {event: "reaction",
  statuses: ["combustion", "corrosion"]}`, `by: "anyone"`, `cooldown: 0.1`,
  `skill: "sk_wpn_sword_0010"`, do `buff`. ATK +19.6% stays on the panel.
- `suit_fire_natr01.json` (Hot Work; written for the batch, inactive in her
  builds): AI +`phy_spell_up` on the panel; triggers `reaction` combustion
  / corrosion `by: "self"` → buffs attr 51 `fire_dmg_up` (0.5) for
  `duration` (10 s), attr 54 `nature_dmg_up` (0.5) for `duration2` (10 s)
  (SkillPatchTable; the BuffData defaults 0.2 / 8 s aren't the set's).
- `suit_burst01.json` (Tide Surge; inactive, not a batch-1 set): skill DMG
  `skill_dmg_up` on the panel; trigger `inflictionApplied` `minStacks: 2`,
  `by: "self"` → buff attrs 51–54 `spell_dmg_up` (0.35) for `duration`
  (15 s; BuffData default 10 s).

**Checks after writing it.** `zero-sanity-laevatain-p5.json` per hit (with
R5, or the legacy conditions kept); `zmdlogs-40d9a3c1da37.json` (17/17 must
stay; the `buff_wpn_sword_0006_valid` window is logged); the four example
scenarios with her (laevatain-solo, liino-laevatain, si-laevatain,
gilberta-gravity-field): totals change by design (Scorching Heart window,
MF consumption at the hit, combo at 41, show_weapon block), say by how much
in the journal; the KNOWN entries for chr_0016_laevat should all disappear
except the `ratio` / `extra_scaling` ones (test A); attack4's go once
the kit takes kit-draft's projectile entry.

### 4. In-game tests for what's still unknown

New ones for docs/in-game-tests.md (training dummy; first round's 1–8
renumbered by what's still open):
- **A. Battle-skill multipliers** (rows 14, 20): with 4 MF, compare the
  extra hit with the same cast's explosion: 5.5× (skill 12) at P0, ×1.2 at
  P1–P2 if the data is right, ×1.5 at P3+ if Zero Sanity is. In Twilight,
  enhanced hit 1 vs the explosion's unit with the Scorching Heart icon off:
  ×1.2 at P1+ means `ratio` applies (kit), ×1.0 means it doesn't (data).
- **B. Jump semantics** (R1): on video at 30 FPS, cast → empowered extra
  hit: ≈54 frames (jumps skip time) or ≈104 (they don't); plain battle
  skill → next action: ≈1.2 s or ≈3.9 s. Extends ready test 17 (in
  Twilight: first enhanced attack 1.3 s / 2.1 s after a plain / empowered
  enhanced battle skill if jumps skip time, 3.8 s if not).
- **C. Twilight length** (rows 23, 30, R3): Twilight's timer with no battle
  skills, then with one combo, then with an enhanced battle skill cancelled
  by the combo at once.
- **D. Partial absorption** (row 45): 3 MF, 3 Heat stacks, one Final
  Strike: 4 MF and 2 Heat left (data). Optional confirmation.
- **E. Finisher absorption** (R2): a finisher by any operator on a
  Staggered dummy with Heat on it absorbs Heat for MF.
- **F. Scorching Heart refresh** (row 48): reach 4 MF, wait 15 s, cast the
  empowered battle skill: does the icon's 20 s restart (capped gain refreshes)?
- **G. Her own buffs under her slow-downs** (rows 31, 39): does Twilight's
  timer stop during her ultimate's 2 s animation and her combo's 0.6 s
  slow-down? (Ti1 freezes every buff, the caster's included; the data
  exempts the caster.) Complements ready test 18.
- **H. P1 SP** (row 17, needs P1): SP after a plain vs an empowered battle
  skill (0 vs 20 expected).
- Projectile travel of attack 4 (row 2) only on video, low priority.
