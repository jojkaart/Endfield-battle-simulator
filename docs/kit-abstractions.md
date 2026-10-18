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
| Inflictions | 5 of 7 | Enabled `SpellInfliction` (`inflictionType` 0 Heat, 1 Electric, 2 Cryo, 3 Nature) next to the DamageAction |
| Final Strike | done | mask bit 2097152 (already read by the loader) |

**Genuinely hand-written** (the data hides it in game code): combo trigger conditions
(CharGrowthTable "COMBO TRIGGER" text), and which branch of an IfElse a
situation takes (modes, "on a Solidified target", "with an arrow").

**So:** `kit-draft` should emit frames, energy, blocks, factors, event keys,
kinds, buff skeletons with their BuffData values, forced reactions and the
skill descriptions, and the loader should take frames, locks and energy from
the data whenever a kit doesn't override them. A kit then holds only the
hand-written parts plus verified overrides.

### Compiled now (batch 1, D1)

`compileSkill` ([packages/data/src/skillCompile.ts](../packages/data/src/skillCompile.ts))
reads a skill's SkillData file and follows what it reaches: LaunchProjectile
(on hit, reach, finish, launch; on block when that's its only route),
SpawnAbilityEntity, CreateBuff (the buff's timeline, trigger interval, start
and finish events) and helper CastSkills. Per damage landing it gives the
frame from the skill's start (spawn and launch frames added), the event key
(the file holding the DamageAction), detached, the scale as keys × a
SimpleCalcBB factor, the decorate mask (kind, Final Strike). Next to the
landings: SpellInfliction, forced reactions (ForceSpellStatusAction, or the
shared `buff_common_<el>_<el>_<status>_triggered` buff a skill creates),
bursts, FinishBuffAdvanced on an infliction tag (consumption, partial
included); ObtainCostAction energy and SP with their frames; RefrainObtainUsp
blocks (in the skill or a buff, with the buff's duration); the
`buff_common_obtain_ultimate_sp` frame. Jumps, casts and branches it can't
decide are reported, not interpreted. Timing values come from the skill's
level table when given (file defaults can be placeholders).

`efsim kit-draft <operator>` (v2) turns it into a kit skeleton in the current
format (it validates against the schema): hits with frames, count, events,
factor, applies, energy, sp, detached, finalStrike; `teamEnergyFrame`,
`energyBlockSeconds`; notes for branches, jumps and event-driven hits. The
loader doesn't use it yet: kits still hand-write these, and loader defaults
from the compiler are the next step.

`packages/data/test/skillCompile.test.ts` compares the seven batch-1 kits with
it; every disagreement is listed there with its data evidence (kit errors
such as Laevatain's combo frame and Liino's follow-up frame, and compiler
limits: buffs a skill creates on the target, jumps, event handlers, which run
once at their buff's start so their frames are lower bounds).

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

## 3. What in the approach caused the one-offs

The kits were written by six parallel agents, one per operator, twice.
Several of the problems above come from that setup, not from the game:

- **Agents couldn't touch the engine**, so each worked around a missing
  primitive inside its kit and described the need in its own words: four
  one-arrow stacks instead of a counter (Typhoeus), a final hit split into
  three summed entries as a lower bound (Si), the non-Solidified combo
  dropped (Estella), an energy block measured from the wrong frame (Liino).
  The same mechanism then came back as three differently named requests.
- **Primitives were added reactively, one per report, named after the first
  operator that needed them** (`scaleIf`, `whileBuff`, `when`,
  `teamTriggers`, `comboTriggers`), instead of being designed per family once
  two reports overlapped.
- **Slicing by operator, not by mechanism.** Each agent re-derived the same
  SkillData facts by hand (frames, `usp` grants, `SimpleCalcBB` factors,
  `RefrainObtainUsp` blocks) for its operator; nobody saw that all seven
  kits needed the same extraction, which is a compiler's job.
- **Briefs passed on unverified facts.** Earlier reports' claims went into
  the next brief and were wrong three times: Arcane's two combo triggers
  swapped, Liino's Amp elements (Electric and Nature, not Cryo), Liino's
  energy-block frame. One agent's stacking claim (priority key = exclusive)
  was contradicted by a log only after it reached the engine.
- **Verification ran on the wrong code.** In worktrees the CLI and tests
  resolved the main checkout's packages and found no data, so part of the
  first round's "checks" weren't of the agent's own kit (now
  `scripts/setup-worktree.sh`).
- **Shared files edited in parallel** (the kits test's known-gap list) caused
  merge conflicts every round.

**How to work next time:**

1. Compile first: run `kit-draft` (v2) so frames, energy, blocks, factors,
   event keys and buff values come from the data, not from an agent.
2. Slice by mechanism when a mechanism is new: one pass over *all* kits for
   "energy grants" or "skill states" designs one primitive with every case
   in view; per-operator passes then only fill in the hand-written parts.
3. Let a kit agent propose engine changes as code on its branch, behind the
   families in section 2, instead of working around them in data; the
   review merges or rejects them.
4. Briefs carry only facts with a source (file and key, or log and time);
   anything taken from an earlier report is marked as a claim to check.
5. Agents in worktrees `source scripts/setup-worktree.sh` before any check,
   and report the check output, not a summary of it.
6. Per-kit data that tests need (known gaps) lives in the kit file, not in a
   shared test file.

## 4. Order of work

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

## Repeating the review

Owner's rule (2026-10-18): repeat this review every time an operator kit is
added or substantially changed (also in CLAUDE.md). Checklist:

1. `efsim kit-census`: which kit features each kit uses, and the fields
   kits still hand-write that section 1 says the data has. A new kit using a
   field no other kit uses, or hand-writing what the loader could compile,
   is a finding.
2. Read the new kit's report (its "engine changes needed"): map each request
   onto an existing family in section 2. Only a request that fits none is a
   new primitive, and then it gets a family of its own here.
3. Look for the same mechanism written two ways across kits (e.g. a state
   buff in one kit, stacks in another, for the same game structure) and
   unify it.
4. Update this document's tables and the roadmap with what was found and
   what changed.
