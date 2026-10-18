# Batch 1: Laevatain and the six favourites

Operators: Laevatain (chr_0016_laevat), Typhoeus (chr_0034_typhoea), Arcane
(chr_0032_lizhiyan), Si (chr_0036_jsspsi), Gilberta (chr_0013_aglina),
Liino (chr_0035_liino), Estella (chr_0021_whiten). Weapons: wpn_sword_0006,
wpn_sword_0010, wpn_funnel_0019, wpn_funnel_0016, wpn_claym_0018,
wpn_funnel_0011, wpn_funnel_0005, wpn_lance_0014, wpn_lance_0010. Gear
sets: suit_spellburst, suit_usp01, suit_usp02, suit_fire_natr01,
suit_atk02, suit_phy01, suit_heal01.

Phase: **analysis 1 done (2026-10-18)**; merge below; implementation next.
Reports: [batch-1/](batch-1/) (one per operator, written by parallel
read-only agents, format of [kit-process.md](../kit-process.md)).

| Operator | Mechanics | Supported | Gap | Data | Unknown | Unique? |
|---|---|---|---|---|---|---|
| Laevatain | 58 | 25 (+4 partly) | 21 | 4 | 4 | 0 |
| Typhoeus | 49 | 22 | 24 | 1 | 2 | 0 |
| Arcane | 54 | 27 | 24 | 0 | 3 | 0 |
| Si | 42 | 24 | 14 | 1 | 2 | 1 |
| Gilberta | 46 | 22 | 14 | 3 | 5 | 0 |
| Liino | 45 | 27 | 14 | 2 | 2 | 0 |
| Estella | 32 | 18 | 11 | 1 | 1 | 0 |

## Merged gaps

Report references are `operator Gn` (Laevatain's report numbers its gaps
1–16). "All" means every report raised it.

### Triggers (the largest family: one trigger list)

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| T1 | **One `triggers` list** on kits (operators, weapons, gear sets), replacing `comboTriggers` / `teamTriggers`. `on`: status applied (reaction, forced included; Solidification…), infliction applied / consumed, burst (also from reaction-type hits), Final Strike, Finisher, hit landed (filters: skill kind, element, physical status applied), skill cast (by kind), buff applied (by category: Susceptibility, Amp, …), buff ended, heal. `by`: self / teammate / anyone. `if` (Predicate), `cooldown`, `maxCount` (per battle or per buff), and actions below. | Estella G4 G7 G12; Liino G4 G5 G6; Si G5 G6 G14; Gilberta G4 G6; Arcane G5 G8 G10 G12; Typhoeus G12 G13 G15; Laevatain 7 8 9 W2 W4 | Largest damage gaps: Liino's weapon (ATK +9.8% ×4 on teammates), Laevatain's Forgeborn (+210% basic for 20 s, today always on), Estella's Valiant and set hits (17% of her damage), Typhoeus's Hail of Arrows and Signs from teammates' bursts, Arcane's Cluster Strike (her ultimate 2 is never castable) |
| T2 | **Trigger actions**: land hits (a hit list, frames from the trigger), apply / gain / energy / SP, apply or end buffs (targets: self, team, enemy, team except wielder, the event's subject such as the healed operator), change a cooldown (any operator's, e.g. slot 0's combo), open a combo window. | same as T1 | as T1 |
| T3 | **Weapon and gear-set kits** as full kits (triggers, buffs, values from their own skills), not only always-on conditions; gear sets aren't a kit source at all today. Generic and wielder-relative (owner's rule). | Si G16; Gilberta G4; Typhoeus G15; Laevatain W2 W4 G1 G2; Arcane G12 | every triggered equipment effect in the batch |

### Values and resources

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| V1 | Values from **talent, potential, weapon-skill and gear-set-skill blackboards** in ValueExpr (talents' attachSkill blackboards aren't loaded today). | Estella G6; Arcane G3; Gilberta G5; Laevatain 9 | talent and equipment values can't be written (Arcane's talents, Scorching Heart, Valiant) |
| V2 | **Event counts** in values: stacks consumed by the trigger (Si's combo finisher n), targets hit, the enemy's Vulnerability stacks. | Si G3; Gilberta G2 G5 | Si's finisher is a lower bound; Gilberta's Susceptibility at n = 0 |
| V3 | **Starting stacks** (`stacks[].initial` as a ValueExpr; a scenario override). | Typhoeus G14 | Typhoeus enters battle with Signs she can't have today |
| V4 | **SP as an effect** (hits and triggers return SP), and SP returned by a specific hit (not the skill's first). | Estella G5; Liino G6; Arcane G7; Laevatain 4 | SP economy wrong for talents and P1s |
| V5 | **Energy variants**: ignoring efficiency and blocks, a percent of max, clearing energy; team energy from a battle skill at its data frame, not the cast. | Arcane G9; Si G9; Gilberta G7 | Arcane's ultimate 2; timing of team energy |

### Conditions

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| C1 | **`if` per effect** (each apply, buff, energy, gain, SP), not only per hit. | Estella G3; Si G4; Arcane G11 | effects that apply only in a situation while the hit still lands |
| C2 | Predicates: **enemy has a modifier of a kind** (zone, element, from anyone); **the operator is controlled**; **caster's / recipient's element and profession** (for triggers and team buffs). | Estella G3; Typhoeus G8; Liino G6; Gilberta G3 | Estella's ultimate Lift; Typhoeus's 5th shot; Liino's talent 2; Gilberta's talent 1 |
| C3 | **`activeCondition`** on potential and talent effects (mode-limited), and skillParamModifier paramType 4. | Arcane G2 | Arcane WILL combo cooldown 12 s instead of 18 s; INT gets WILL's P1 Susceptibility |

### Buff lifecycle

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| B1 | **Ending buffs**: on a skill cast, a hit, another buff ending; buffs lasting as long as a parent; buffs starting when one ends. | Liino G1; Typhoeus G3; Arcane G6; Si G6 | Liino's stance ATK up to 40 s too long; Typhoeus's hover |
| B2 | **Pausing and extending** a buff's timer while a state holds. | Laevatain 2 | Twilight 1.3–2.1 s short per enhanced battle skill |
| B3 | **Layered buffs**: max stacks (ValueExpr), independent durations per layer, consume one layer. | Typhoeus G16; Laevatain W4; Liino G5 | Umbral Torch, Liino's weapon, Typhoeus's set |
| B4 | **Buffs scoped to the next cast** (consumed by the next cast of a kind, acting on that cast's hits): Link, Jade Vessel's combo bonus, Yinglung's Edge. | Si G15; Gilberta G12 | Link (every team), Si's weapon and set |
| B5 | **Stack consumption at the requiring hit** (not the cast); **consume N** of a stack; "stack below N" at cast. | Laevatain 3; Typhoeus G5 | Laevatain keeps a Melting Flame she shouldn't; Typhoeus's arrows faked as four stacks |
| B6 | Stack groups from BuffData **`stackingKey`**; **attribute modifiers** on buffs (Ultimate Gain Efficiency, team ATK with a recipient filter); timed Arts Intensity in status strength; skip a buff whose duration is 0. | Liino G9; Gilberta G3; Typhoeus G17; Si G4 | Liino's two stances; Gilberta's talent 1 |

### Arts state

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| A1 | Infliction of **the enemy's current element**. | Arcane G1 | Arcane WILL combo and ultimate |
| A2 | **Consume N** infliction stacks (or up to a stack's room). | Typhoeus G7; Laevatain 6 | Typhoeus's Signs; Laevatain's absorption |
| A3 | **Reaction-type hits emit their event** (burst), so triggers see them. | Typhoeus G6 | Typhoeus's talent, weapon, set and teammates' burst triggers |
| A4 | The applier's **talents change the statuses it applies** (Corrosion cap and duration). | Arcane G4 | Arcane's Corrosion ≥ 15.9 s in a log; part of the Corrosion drift |
| A5 | **"Status consumed"** event (a reaction status removed by a skill or by Shatter). | Liino G7; Estella G2 | Liino's combo trigger half |

### Skills

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| S1 | **Hitless skills** (apply buffs, states and energy blocks at frames; `hits` may be empty), and buffs at a frame without a hit. | Laevatain 1; Liino G2; Si G1 G10 | Laevatain's ultimate lands a phantom 6.08 × ATK hit today; Si's strokes, Liino's End Stance can't be cast |
| S2 | **Availability as a Predicate** (several states; mid-air, near a staggered enemy). | Liino G3; Estella G10; Typhoeus G2 | illegal battle skill during Liino's ultimate |
| S3 | **Cancel windows by next skill**: each window lists what may follow; action states that block casting or swapping. | Gilberta G8; Liino G8 | next basic attack 0.4–0.7 s too early (every operator) |
| S4 | **Cooldown groups** (two skills, one cooldown) and skills that set a cooldown. | Typhoeus G10; Liino G2 | Typhoeus's two combos; End Stance's 5 s |
| S5 | **Chains as attempt counters**, reset by other skills; chain order enforced in recorded rotations. | Typhoeus G4; Laevatain 11 | Typhoeus's aerial shots |
| S6 | **Skills that cast follow-ups off-field** (basic-kind actions without control). | Typhoeus G9 | Typhoeus's off-field battle skill and ultimate |
| S7 | The ultimate makes its caster the controlled operator; its cooldown starts when its state ends. | Laevatain 12 | Laevatain's ultimate cooldown and control |

### Physical state (owner decision)

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| P1 | **Physical statuses**: forced Lift (its damage `1.2 × ATK × (1 + (Lv−1)/392) × (1 + AI/100)`, verified on a log), Vulnerable stacks, Immobilization and other control statuses with tags, **Shatter** (a physical status on a Solidified enemy: `(1.2 + 1.2 × level) × ATK × …`, consumes Solidification), and the physical-status event triggers react to. | Estella G1 G2; Gilberta G1; Si G13 | **48% of Estella's damage** in her log (Shatter 18.8%, Lift 11.7%, Valiant 11.5%, set 5.8%); Gilberta's Lift adds 48–65% on top of each combo |
| P2 | **Stagger meter and Finisher** (poise damage, staggered state ×1.3, the finisher formula). | all | finishers (Typhoeus's 42k at P5) castable any time or never |

### Timing (owner decision for T-1)

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| Ti1 | **Time dilation, ultimate time stop, hit-stop**: what pauses during them (buffs, Corrosion ticks, windows). | all | buff windows and ticks off by seconds; part of the Corrosion drift |
| Ti2 | Projectile travel. | Gilberta G11; Liino G10; Typhoeus G11 | small timing offsets |
| Ti3 | JumpToAction branches (time skips inside a skill). | Laevatain 10 | Laevatain's extra hit ~50 frames early in real time; semantics need a test |
| Ti4 | Haste (attack-speed buffs on states ending). | Si G6 | Si's talent 2 |

### Data compilation

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| D1 | **kit-draft v2 and loader defaults** from SkillData: frames (incl. projectile and entity spawn), energy grants, factors, event keys, enabled **SpellInfliction** (inflictions), finisher factors, `EntityBB_` keys, hits dealt by buffs (Laevatain's combo, ~21 frames late today), Final Strike per landing. | Estella G11; Si G11; Gilberta G14; Laevatain 5 13; Typhoeus (data) | every kit hand-writes these |

### Log tooling

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| L1 | Event-key aliases (Valiant logged as `chr_0015_lifeng_ultimate_skill`), keys by branch, the one-element reaction key, stack caps passed by the applying skill. | Estella G13; Si G12; Arcane G15; Typhoeus G18 | hits that can't be checked |

### New

| ID | Feature | Needed by | Impact |
|---|---|---|---|
| N1 | Kills and HP (Laevatain's P5 on kills, absorption from defeated enemies, talent 2 below 40% HP). | Laevatain 15 16 | none against one enemy: **propose to defer** |
| N2 | **Damage record** (a debuff that records damage taken and deals a share as Fixed DMG when it ends). | Si G2 | **unique?**: no other operator in the batch; goes on [kit-unique.md](../kit-unique.md) if it stays unique after batch 2's analysis |

## Kit errors found (fix in the kits phase, no engine work)

- Laevatain: the ultimate has no damage (phantom 6.08 × ATK hit); `ratio` vs
  `extra_scaling` on the extra hit is an open question (Zero Sanity's in-game
  57552 = 7.7 × 1.5 fits the kit's reading, the data reading doesn't: in-game
  test); only the second landing of attack5 / ult_attack4 is a Final Strike.
- Gilberta: Arts Susceptibility should follow P2 (0.36 from P2; 0.30 below).
- Estella: both combo variants can be written now (`if` on enemyStatus);
  P1's +3 s susceptibility with `has_potential1 × rate_plus`.
- Liino: Cosmovoice's ATK can be added with a shared stack group.
- Arcane: WILL is `not attrAtLeast [41, 42]` (ties go to INT); durations as
  sums with `duration_pre`; P1's ×1.3 applies to `atk_scale_boom` and both
  lasers too.
- Typhoeus: plain-shot energy (`if consumedAtLeast`); gear-set cap 3.
- Si: the battle skill inflicts Heat with a Heat operator in slot 0 (data);
  P5's +1 isn't added in the data's formula.

## Owner decisions (2026-10-18)

"The simulator becomes useful when it's fully implemented": every gap is
implemented, physical statuses, stagger and time dilation included;
nothing is deferred. Order is free. N1 (kills and HP) has no effect against
one enemy, so it comes with multi-enemy support.

## Implementation order

1. Triggers T1–T3 with conditions C1–C2 and buff lifecycle B1, B3, B4, B6
   (one engine pass: they share the event model).
2. Values V1–V5, C3 and data compilation D1 (the loader).
3. Skills S1–S7.
4. Arts state A1–A5.
5. Physical state P1–P2, then timing Ti1–Ti4.
6. Log tooling L1.

Then re-analysis of all seven.

## Progress

- V1 (value sources) and C3 (mode-limited effects): done (2c6942a).
- T1, piece 1: the event model and one `triggers` list (engine
  `events.ts`), replacing `comboTriggers` and `teamTriggers`; events for
  hits, casts, status events, buffs applied and ended, stacks; actions
  openCombo, apply, gain, energy, sp, buff, endBuff, cooldown; trigger
  cooldowns and count limits. Kits migrated; all example totals unchanged.
- T2, triggered hits: a trigger's `hits` action, hits naming their damage
  type (`none` included); log checks find them by event key.
- T3, equipment kits: `kits/equipment/<id>.json` for weapons and gear sets
  (stacks, buffs, triggers, legacy conditions), added to the wearer's kit
  (`effectiveKit`); `weapons.json` moved there. No equipment triggers are
  written yet (kits phase).
- C1, C2: `if` on every effect (applications, buff applications, stack
  gains, trigger actions); predicates `controlled` (for a hit: at its
  cast), `enemyModifier`, `operatorElement`, `operatorProfession`,
  `isOwner`, `sameElementAsOwner`, `eventOperator`. Operator elements in the
  data are now lowercase kit elements (`teamSlotElement` never matched
  before) and operators carry their profession.
- B1, B3, B4, B6: buffs end by trigger (all or oldest layers; the end is an
  event), last until ended without a duration, are skipped at 0 s; layered
  buffs (`maxStacks`); next-cast buffs (`consumedBy`, acting on that cast's
  hits only); attribute modifiers (UGE read by energy gain); recipient
  filters; stack groups from BuffData `stackingKey` (also in the log
  checker); timed Arts Intensity in status strength. B2 (pausing a buff's
  timer) is still open.
- Heal events (hits' `heals`, a `heal` action; `on: heal` with
  `toOthers`), a buff for the event's subject only (`to: eventSubject`:
  the healed teammate), periodic buff ticks (`every`, a `buffTick` event),
  and `extendBuff` (B2: a state a skill pauses is extended by the pause).
  The triggers, conditions and buff-lifecycle families are done; the energy
  block following a buff (B2's second half) belongs to the skills family.
- V2–V5: `eventCount` (a trigger's event count; a combo's hits read the
  count of the event that opened its window) and `targetsHit` (1 until
  multi-enemy) in values; starting stacks (`stacks[].initial`, scenario
  `startStacks`); SP on hits (`sp`, replacing the skill's `atb` default);
  energy grants as a fraction of the maximum, past blocks or without
  efficiency, and `clearEnergy`; a skill's team energy at its data frame
  (`teamEnergyFrame`). The enemy's Vulnerability stacks in values (V2,
  Gilberta) come with physical statuses (P1).
- S1, S2, S4, S7 (part): skills may have no hits; a trigger can be
  narrowed to casts of given skills and delayed (`delay`), so a skill's
  effects at frames are its own delayed cast triggers; availability is a
  Predicate (`available`, replacing `availableWhile` / `unavailableWhile`,
  kits migrated); cooldown groups (`cooldownGroup`); `takesControl`; buffs
  that block energy gain while they last (`blocksEnergy`).
- S3, S5: when the next action may start (docs/design.md "Skill timing"):
  SkillData windows, channels, `skillSpecification` priorities, exclusive
  time; interrupts cancel hits still to land (detached ones excepted);
  basic-attack chain steps from the data; swaps blocked only by
  `cantSwitchPosition`. Typhoeus's aerial shots are an attempt counter, not
  a window chain (kit `chainStep: false`; their order goes in the kit as
  stacks). Laevatain's kit gains the Twilight pause (gap 2), so her example
  total is unchanged; Liino's example reorders one action the chain no
  longer allows; three examples change by up to 5% (same hits, different
  buff windows). In-game tests 15–17.
- S6: a `cast` trigger action: the owner casts one of its skills by itself
  (SkillData CastSkill), without control, cost or cooldown, ending its
  current skill: off-field follow-ups (Typhoeus's aerial shots) with a
  delayed cast trigger and `if: {not: {controlled: true}}`.
- B5: requirements are a range (`atLeast`, `below`) judged at the cast;
  `consume` is all or an amount (once per cast and stack); `consumeAt:
  "hit"` uses the stack up when the requiring hit lands; negative gains use
  stacks up, never below 0. With these, Typhoeus's four arrow slots become
  one counter and her aerial attempts a stack (kits phase).
- A1–A5: infliction of the enemy's current element (`element: "enemy"`);
  consuming N stacks (`stacks`, a value: e.g. the room left in a stack via
  the new `stackCount` value), the rest keeping its timer; burst-type hits
  emit their burst event (damage stays the hit's); applier status tweaks
  (`statusTweaks`: extra duration, Corrosion cap scale); `consumeStatus`
  with a `statusConsumed` event (Liino's combo trigger half). The schema
  now also lists the `eventCount` / `targetsHit` values the V2 commit
  added to the engine.
- L1: the log checker caps buffs whose maximum the applying skill sets
  (BuffData `useMaxStackCntKey`) from the team's sources (Typhoeus G18).
  Event-key aliases and keys by branch need no tooling: a kit hit's
  `events` lists every key it's logged under (Valiant's
  `chr_0015_lifeng_ultimate_skill` goes in its equipment kit). Open: the
  ×1.42 of reactions logged as `buff_common_<element>_triggered` (Arcane
  G15) is unexplained.
- Ti1 (part): global slow-downs from SkillData (ultimate time stops,
  global time dilation with inline or known named curves) shift the world
  and the other operators by the frames they cost; cooldowns run on.
  Gilberta's example −1.6%, Si's +2.9%, Typhoeus's +1.0% (Laevatain's, Arcane's,
  Estella's and Liino's unchanged). Not yet: entity-layer dilation,
  hit-stop, jumps (Ti3), haste (Ti4). In-game test 18.
- P1: the physical state (docs/data-sources.md "Physical state"):
  Vulnerable, Lift, Knock Down, Crush, Breach and Shatter as applications
  (`vulnerable`, `physicalStatus` with `forced`), their hits as status
  damage, events (`physicalStatus`, `vulnerable`, `shatter`), predicates
  (`enemyPhysical`, `enemyVulnerable`) and the `enemyVulnerableStacks`
  value (Gilberta's V2). The log checker now checks physical-status hits:
  Estella's coverage 52% → 83% and Gilberta's 67% → 79% of their damage,
  no mismatches (a kit-less operator's status hit counts as unmodelled).
  Control-status tags (Immobilization) and stagger (P2) next.
- P2: stagger (docs/data-sources.md "Physical state"): hits' `poise` (and
  `poiseControlledOnly` for Final Strikes), Lift / Knock Down stagger, the
  Staggered state (×1.3, "vs Staggered" bonuses, a `staggered` event and
  `enemyStaggered` predicate), finishers (skillSpecification 8) only on a
  Staggered enemy and once per stagger, with the enemy's finisher
  multiplier and SP. Stagger nodes (small staggers) have no damage effect
  and aren't modelled. Kits don't carry poise values yet (D1 compiles
  them).
