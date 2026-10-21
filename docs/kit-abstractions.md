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
| Lock (`durationFrames`) | removed (2026-10-19) | SkillData `exclusiveFrame` / windows / channels: the engine reads them; the kit field was dead and is gone |
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

**Since batch 3 (D2–D4, 2026-10-20)** the compiler also reads, per landing,
its element (damageType 0 Physical, 2 Heat, 3 Electric, 4 Cryo, 6 Nature),
its DamageAction's poise unit (DefiniteValueCalculation, × valueScale with
applyScale; onlyEnableForMainChar → controlled only; a key that is 0 is no
stagger), BreakingAttackCalculation's `multiplier` into the factor, and its
damage unit's processors as bonuses (InstantModifyAttribute attribute 9 →
critRate; DamageScaleProcessor on the attacker's side, NormalCalcZone →
damageBonus, ProdCalcZone → multiplicative). Next to the landings: physical
statuses (AirborneAction Lift, KnockDownAction Knock Down, CrushAction Crush
with its damageMultiplier, FractureAction Breach; forceAirborne /
forceKnockDown → forced; deadOption 2, which batch-2 and batch-3 reports read
as a dying target's launch, is only noted), Vulnerable stacks
(`buff_physical_no_guard`), and a created status buff's assigned keys
(duration, extra_scaling, …). It expands ExecuteIntervalAction ticks and
follows an AuraAction's buffInput buffs (their ticks and applications;
actionInAura runs at the aura's start), reports every buff it creates with
its target (self, the enemy, the hit target, the team, an aura) and what the
buff does, and labels each undecided condition with the choice site it
belongs to (the sides of one IfElse or Switch exclude each other) and, where
it can, a kit predicate: `controlled`, a stack check on a buff a talent or
potential attaches (`talentAtLeast` / `potentialAtLeast`), and a comparison
of a key only one talent or the potentials set (Wulfgard's `talent2 > 0`).

kit-draft turns those into `element` (when it isn't the operator's),
`poise` / `poiseControlledOnly`, `factor`, `bonuses`, `applies` (physical
statuses with `forced` / `multiplierKey`, `vulnerable`, forced reactions
with `durationKey` / `scaleKey` and a level), `if` on hits, applications and
grants (`{if, then}`) when every condition on the way can be said, and
`branch` for the alternatives of one site when each side is one hit landing
equally often (other alternatives keep their notes). What has no landing
(energy, applications, a hitless skill's SP or SP from another key than the
skill's `atb`) becomes a cast trigger at its frame (`delay`, `detached`),
the same grant on both sides of one condition merged. Skill notes list the
created buffs and the compiler's own notes. Still open: jumps (D1),
conditions it can't say (distance, tags, chance), ModifyDynamicBlackboard
on a scale (Chen's P5), Switch-chosen SP (Alesh), a buff's infliction on
another branch than its landing (Avywenna's lance check), talents' own
buffs and triggers, recalled entities as stacks.

`packages/data/test/skillCompile.test.ts` compares the kits (batches 1 and 2) with
it, now also each hit's element, stagger and physical statuses; every
disagreement is listed there with its data evidence (kit errors such as
Laevatain's combo frame and Liino's follow-up frame, Arcane's missing
Final Strike stagger and finisher stagger the data doesn't have, and
compiler limits: buffs a skill creates on the target, jumps, event handlers,
which run once at their buff's start so their frames are lower bounds). The
23 finisher-factor entries went with BreakingAttackCalculation.

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

### Review after batch 1's kits (2026-10-19)

1. **Census.** Still hand-written although the data has them: hit frames
   (all seven kits), log event keys (all), energy grants (all), literal
   factors (finishers in five kits: the compiler doesn't read
   BreakingAttackCalculation's `multiplier`), energy blocks (Arcane), team
   energy frames (all seven; the compiler finds most). Loader defaults from
   the compiler (D1 follow-up) remain the way to remove them. The kit skill
   field `durationFrames` was dead (the engine reads lock times from
   SkillData) and is removed from the format, the loader and two kits.
   Features used by one kit only are each that operator's mechanism
   (`branch`, `scaleValue`, `beside`, `cancelHits`, `endAction`,
   `extendBuff`, `clearEnergy`, …) or a filter only one kit needs yet;
   none duplicates another field.
2. **Requests from the kit agents**, each in an existing family:
   chain steps only continue a chain (skills/timing); delayed actions and
   energy grants before later ticks and expiries (timing); a hit's `if`
   judged only as it lands (conditions); cast-consumed buffs act only on
   the consuming cast (buff lifecycle); stack events name the stacks that
   changed (triggers); a burst hit's own burst before its damage
   (triggers, `beforeDamage`); team energy tied to its cast and a `beside`
   cast not waiting (skills). All done. Left open, small: a detached hit
   dropped if its cast is cut before its entity exists (Laevatain: frames
   0–3 of her battle skill), the action gate read before the state is
   advanced (Liino: 5 frames at a stance's end), `calc` on values that
   read an event count.
3. **One mechanism written two ways**, now unified:
   - Laevatain's Scorching Heart gate (a marker buff set at 4 Melting Flame
     and a trigger ending it) and `stackAtLeast` did the same once stack
     events say what changed: the marker pair is gone.
   - "Cast only by its own skill" was written as a never-true `available`
     (`{not: {potentialAtLeast: 0}}`) in Typhoeus's and Liino's kits: now
     `followUpOnly` on the skill.


### Review after batch 2's kits (2026-10-19)

1. **Census** (12 kits). Still hand-written although the data has it, in
   every kit: hit frames, log event keys, energy grants, finisher factors
   (now ten kits: the compiler still doesn't read BreakingAttackCalculation's
   `multiplier`). Loader defaults from the compiler (D3) remain the way to
   remove them. New fields each used by one kit so far are mechanisms other
   operators share in data: `skill.jumps` (Laevatain; Catcher's jumps are
   unconditional and read from SkillData), `trigger.do.jump` (Catcher;
   Snowshine's battle skill has the same listener), `trigger.on.enemyCharge`
   (Catcher), `trigger.on.staggerNode` and `trigger.on.sp` (Akekuri;
   Frontiers too). `trigger.on.attacked` is already shared by three kits.
2. **Requests from the kit agents**, each in an existing family:
   - Triggers: a trigger that fires with a chance (BuffData `Probablity`:
     Antal's and Fluorite's talent 2, `buff_equipsuit_magicinfdb_01/_02`,
     Laevatain's combo knock-back), rolled on its own seeded stream like
     crits and dodges; a buff a trigger applies takes its values from the
     situation at the event, as its `if` does (Endministrator, Grizzled
     Edge; extends T5).
   - Resources (V3): the `sp` event says whether the SP is natural or a
     refund, with a `natural` filter (Akekuri's P1, Frontiers).
   - Skills: a team-energy part that outlives its cast (`detached`, like a
     hit's: Fluorite's explosion at frame 99, the skill cancellable from 34).
   - Physical state / timing: a physical status's own damage where the game
     deals it (Lift, Knock Down, Crush before their ignite handler, Breach
     after; Endministrator, 12–17% on her Crush).
   - Log tooling, not the engine: the finisher multiplier in `zmdlogs
     check`; `zmdlogs reactions` dropping applications whose condition reads
     the enemy's state; trying enemy-side team auras (Endministrator's
     talent 2, her crystals) with and without, as cast-consumed buffs are.
   - Done at the merge: attributes 62/63 allowed on kit buffs (buff
     categories read them; Catcher's Protection and Weakness), and the
     action gate looking again after an action changes (Catcher's counter
     ends at 194).
3. **One mechanism written two ways:** Antal's and Fluorite's talent 2 are
   the same "when hit, with a chance" structure, written as "always" (Antal)
   and as an expected-value buff (Fluorite) until triggers get a chance;
   both move to `chance` then. Layered buffs on a shared timer replaced a
   counter stack plus expiry trigger in Akekuri's P1, Æthertech and MI
   Security (MI Security keeps a counter only for its 5-layer check, exact
   since all layers share one timer).

### Review after batch 3's kits (2026-10-20)

1. **Census** (22 operator kits). Still hand-written although the data has
   it, in every kit: hit frames, log event keys, energy grants and
   finisher factors. kit-draft now compiles all four (D2–D4), but kits copy
   them: loader defaults from the compiler remain the way to remove them.
   Features one operator kit uses so far are shared mechanisms by design:
   `trigger.do.choose` (Purrchena; any weighted Probablity),
   `trigger.on.perfectDodge` (Purrchena; E1). `applies.consumeStatus`
   with `afterDamage` is now used by two kits (Wulfgard, Arclight), and
   `hit.launch` by four.
2. **Requests from the kit agents**, each in an existing family:
   - Conditions: `enemyHpBelow` takes a value (done at the merge: Chen's
     `hp_remain`, Alesh's `hp_tar`); a stack compared with a value
     (Arclight's talent thresholds are literals behind `potentialAtLeast`;
     open).
   - Skills / timing, done at the merge: a step without `at` waits for
     nothing past a first end on the cast's timeline (Snowshine's bash,
     reached only through her counter's jump) or that a due jump will skip
     (Wulfgard's frame-141 shot); `earliestStart` treats a kit with
     trigger `cast` actions as one whose action may end sooner
     (Purrchena's blocks). Open: S3's residue (a slow-down starting on a
     jump's own frame; one after an end made by a kit `cast`), and the
     dodge policy recognising a counter written as a `cast` (Purrchena's
     blocks) and not only as a `jump`.
   - Search: `randomOutcomes` counts `choose` actions (done).
   - Loader: Final Strike is decided per file, not per hit (Alesh's
     second attack-5 hit needs `finalStrike: false`); a hit whose `sp`
     names a key without an `spKinds` entry should warn (Alesh's ultimate
     SP is keyed `atb_up`). Both open.
   - Compiler (D3 / D4, open): ForceSpellStatusAction `consumedType` as a
     consumption (Arclight), CheckHp → `enemyHpBelow` (Alesh), SP chosen
     by a Switch (Alesh), ModifyDynamicBlackboard on a hit's scale
     (Chen), a check on a status's start event (Avywenna), talents'
     attached buffs (Da Pan, Wulfgard).
   - Engine-wide questions, recorded, not changed: global slow-downs hold
     every buff's timer, the caster's own included (Xaihi, Avywenna,
     Purrchena; the data pauses some of Purrchena's buffs explicitly,
     which suggests her own aren't held); finisher SP comes at the
     finisher's first hit, not at GainBreakingAttackAtb's frame (Chen,
     small). The `burst` event 1 s after its infliction (Wulfgard asked)
     follows the data: TriggerSpellBurstEventAction is in the burst
     buff's first tick.
3. **One mechanism written two ways:** MI Security's 5-layer check now
   reads the ATK buff's own layers (`buffLayers`), so its counter stack
   and reset are gone (done); Avywenna's lances are buff layers counted
   with `buffLayers` and `count`, not counter stacks. Frontiers and
   Akekuri's P1 could use `sourceTypes: [3]` for "SP from a skill", but
   that isn't an exact swap (grants of type 0 or 1 inside skills), so
   they stay on `kinds` until a log decides.

### Review after batch 4's kits (2026-10-21)

1. **Census** (33 operator kits). Still hand-written although the data has
   it, in every kit: hit frames, log event keys, energy grants and finisher
   factors (kit-draft compiles them; loader defaults from the compiler
   remain the way to remove them). Features one operator kit uses so far
   are each a shared mechanism with one user in the data: `hit.zoneScale`
   (Last Rite; only her data has a target-side zone scale),
   `skill.comboWindow` (Camille's Hunter Pursuit), `trigger.do.choose`
   (Purrchena), `hit.damageType` on a skill hit (Mi Fu's World Splitter).
   `skill.noDodge` was Ember's only; Purrchena's blocks now use it too
   (done at the review), and Catcher's P5 reads any shield on her through
   `operatorBuff` (done).
2. **Requests from the kit agents**, each in an existing family (open
   unless marked):
   - Timing: a ticking buff skips its tick on its end frame (`nextBuffTick`);
     4e5e has Rossi's bleed ticking 26 times over 25 s (her kit lasts one
     frame longer as an interim); delayed trigger actions run before hits
     landing on the same frame (Yvonne's end-strike finish written a frame
     late); a modifier's `if` is judged before the hit's own
     `beforeDamage` buffs while their modifiers count (Yvonne's 10th
     layer, under 0.2%); buffs tied to an animation clip shorter than the
     cast (`autoFinishByAction` on a clip) have no kit field (Ember's
     talent-1 Protection; written with delayed `endBuff`); windows that list
     a button skill don't open for the skill the button casts (Camille's
     Hunter Pursuit, 8–12 frames late); a beside cast still schedules its
     timeline's items (Last Rite filters hers with `beside: false`).
   - Values (done): a buff's main attributes (39–42, flat or a percentage
     of the panel line) reach ATK through the `attribute` zone, with the
     panel's floored attribute bonus (`stats.ts atkAttributeBonus`):
     Mountain Bearer is ×1.174 ATK per buff on Lifeng, and `lifeng-solo`
     went from 391,096 to 514,161. `buffLayers` thresholds are values, so
     they can name data keys (Zhuang Fangyi's `free_sword_limit`).
   - Buffs (done): stack caps of stackingTypes 2, 8, 10 and 11 come from
     the buff's literal `maxStackCnt`, or its own value of the
     `maxStackCntKey` when the applying skills lack it; a kit's number must
     match. Suffering's End's and Camille's hand-written caps are gone.
   - Triggers (done): `linkGained` event (`by` judges who gains Link);
     Thermite Cutter's Link half uses it. Solemn Phalanx reads Arts
     Susceptibility by its tag (1427729990), like Junction Point.
   - Display (done): `efsim calc` breaks the attribute bonus down under
     the ATK line, attributes 76–79 included.
   - Log tooling (done): unquantified annotated buffs valued from kits,
     repeated boundary buffs tried 1..n, cast placement under time stops,
     the compiler test matching poise-only hits.
   - Compiler (D3 / D4 / D7–D10 leftovers): ComboAction → `link`, CheckHp
     → `enemyHpBelow`, ModifyDynamicBlackboard chains, Switch-chosen SP,
     entity counts as stacks, EntityBB keys, once-per-cast inflictions,
     calculated SP keys (Pogranichnik's `calc_atb_n`), heals gated by the
     data's conditions.
3. **One mechanism written two ways:** Junction Point and Solemn Phalanx
   (both on tags now). Link sources are one action now (`link`), and the kits that
   gave Link by the old every-combo rule needed nothing.
