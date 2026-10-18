# Kit abstractions: what the six favourites' kits share

A review (2026-10-18) of the seven kits (Laevatain plus the six favourites,
written by parallel agents) and the twelve kit reports, before adding more
operators. Two questions: what do kits hand-write that the game data already
says, and which engine requests are the same mechanism asked for in
different words? The answers set the shape of the kit format and of
`efsim kit-draft`, so that a new operator is mostly compiled from data and
only its genuinely hand-written parts (what the descriptions say) are left.

## 1. Hand-written, but the data has it

Feature counts per kit (hits or skills using it) from the current files:

| What | Kits writing it by hand | Where the data has it |
|---|---|---|
| Hit frames | 7 of 7 (108 entries) | DamageAction frame on the skill timeline + the spawn frame of the projectile / ability entity that deals it |
| Lock (`durationFrames`) | 6 of 7 | SkillData `exclusiveFrame` / first AllowNextSkillAction (the engine already reads it; the kit copy is redundant) |
| Ultimate energy grants | 7 of 7 | `ObtainCostAction` costType 0, its key and frame (`usp`, `extra_usp`, `usp_recover`) |
| Energy blocks | 3 of 7 | `RefrainObtainUsp` in a buff the skill creates, and that buff's duration |
| Literal factors | 1 (16 hits; others need them too) | `SimpleCalcBBAction` ×/÷ on the scale before the DamageAction |
| Buff values and durations | 7 of 7 | BuffData `attributeModifier` / `damageModifier` (zone, key, element, mask) and `duration` |
| Log event keys | 7 of 7 | The SkillData file that holds the DamageAction is the key |
| Action kind | (from `damageType`) | Decorate-mask bits: 128 basic, 256 battle, 512 ultimate, 8192 combo |
| Forced reactions and their level | 2 | `ForceSpellStatusAction` (status, `count` → level) |
| Partial consumption | 1 | `FinishBuffAdvanced finishLayerCnt` on an infliction tag |
| Final Strike | done | mask bit 2097152 (already read by the loader) |

**Genuinely hand-written** (the data hides it in game code or disabled
stubs): which hits inflict which element (skill descriptions; the
`SpellInfliction` actions are `isEnable: false`), combo trigger conditions
(CharGrowthTable "COMBO TRIGGER" text), and which branch of an IfElse a
situation takes (modes, "on a Solidified target", "with an arrow").

**So:** `kit-draft` should emit frames, energy, blocks, factors, event keys,
kinds, buff skeletons with their BuffData values, forced reactions and the
skill descriptions, and the loader should take frames, locks and energy from
the data whenever a kit doesn't override them. A kit then holds only the
hand-written parts plus verified overrides.

## 2. One mechanism each, not one field per request

The requests below came from different agents in different words. Each
family becomes one primitive.

### Conditions

Asked for: an enemy status present (Estella's combo on a Solidified
target), an enemy infliction present (Typhoeus's burst ×1.3, today
`scaleIf`), a stack below / at least a count (Typhoeus's shot with or without
an arrow, today `requires`), an attribute comparison (Arcane's modes, today
`when`), the element of team slot 1 (Si's battle skill), "this hit consumed
an infliction" (Typhoeus's energy), a buff active (Liino's stance, today
`whileBuff`), the potential (Gilberta P2, Estella P1).

**One `Condition` type**, evaluated where the thing happens, usable on a
hit (it exists or not; replaces `when` and `requires`), on a scale term
(replaces `scaleIf`), on an energy grant, a stack gain, a buff application,
and on triggers. Alternatives are just two hits with opposite conditions.

### Values

Asked for: sums (`duration` + `rate_plus`, `duration_pre` + `duration`),
products of keys (Gilberta P2), a count from the event (Si's finisher
`atk_scale2 + n × atk_scale2_1`, n = stacks consumed by the trigger; P2 ATK
per stack), gains as a value (Typhoeus's arrows = `arrow_num_given`), values
from talents' attached skills (Arcane talents, Gilberta talent 1).

**One `ValueExpr`**: a sum of terms, each a product of factors: a skill key
(any of the operator's skills or talent skills), a literal, a panel
attribute, an event count (stacks consumed, trigger stacks), a capped
sub-expression. Scale, energy, durations, buff values and gains all use it.

### Triggers

Asked for: Laevatain's absorption on any Final Strike (today
`teamTriggers`), combo windows (today `comboTriggers`), Liino's volley on a
teammate's infliction with a cooldown, Typhoeus's Sign on any Nature burst,
Estella P5's energy on any Solidification, Arcane's Cluster Strike on Final
Strikes while her array is up (max 2), Si's talent cutting a combo
cooldown, Liino's combo on a reaction being consumed.

**One `trigger` list per kit**: `on` an event (the status events, Final
Strike, a hit landing, a buff ending) with a `Condition`, `by` self /
teammate / anyone, optional cooldown and count limit, and `do`: hits to
land, applications, gains, energy, buffs to apply or end, a combo window to
open, a cooldown change. Combo windows become one kind of trigger action.

### Buff lifecycle

Asked for: ending a buff early (Typhoeus's 5th shot ends hovering, Liino's
End Stance), one buff replacing another (Liino's two stances share
`liino_atk_up`), buffs on attributes such as Ultimate Gain Efficiency
(Gilberta's talent), skipping a buff whose duration is 0 (below a
potential), skills with no hits (Si's strokes, End Stance), one cooldown
shared by two skills (Typhoeus's two combos).

**Buffs** get `stackingKey` (from BuffData; same key = replace, keep
strongest), attribute modifiers, and `ends` on hits, triggers and skills;
skills may have no hits and may name a shared `cooldownGroup`.

### Arts state

Asked for: consume N stacks, inflict "the enemy's current element" (Arcane
WILL), a burst event from a reaction-type hit (so others' triggers see
Typhoeus's bursts), Corrosion changed by the applier's talents (cap ×,
duration +), time dilation pausing ticks. These extend `status.ts`; no new
concept.

## 3. Order of work

1. `Condition` and `ValueExpr`, replacing `when`, `requires`, `scaleIf` and
   `ValueSpec` (kits migrated mechanically).
2. One `triggers` list, replacing `comboTriggers` and `teamTriggers`.
3. Buff lifecycle (stacking keys, ends, attribute buffs, hitless skills,
   cooldown groups).
4. `kit-draft` v2 and loader defaults from data (section 1), checked by
   regenerating the seven kits and diffing against the verified values.
5. Arts-state extensions.

Each step keeps `npm run check` green and the verified log matches
unchanged; the kits' behaviour may only change where a report showed it
wrong.
