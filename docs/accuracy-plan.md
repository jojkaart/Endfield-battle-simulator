# Accuracy plan (2026-10-26)

The owner: "I'd put engine accuracy higher than the search feature
scoring. So, let's do a comprehensive analysis of what is currently not
being simulated accurately and put together a plan for tackling those."

Three read-only audits on 2026-10-26 (HEAD 55ee542): the battle logs (all
29 single-target fixtures through `zmdlogs check`'s path, each fight's
totals error split into unlanded logged hits, unmatched replay landings
and the error on matched hits), the kits against the game data (the 209
`dataOverride` marks, the compiler's notes, kit interims, the batch docs'
open gaps), and the engine's mechanics (interims in the code and docs,
SkillData / BuffData action types the engine ignores, in-game tests).
Their raw tables are not committed; what's below is what they found,
checked where noted.

## What the logs say, in one paragraph

Today's totals errors (−12% to −61% per fight) are mostly **the log
tooling's**, not the engine's: in 5 of the 6 verified fixtures the logged
hits the replay never lands and the replay's own unmatched landings make
most of the error, and the matched hits alone are −2.6% to −19% (0eef
about 0 once unknown crits are read as expected). So the first job is to
make the measuring stick trustworthy; then the engine's own errors, led
by Stagger (wrong windows in 22 of 29 fights), can be measured and fixed.

## Phase A: make the log check measure the engine (tooling, from logs alone)

| # | problem | evidence | fix |
|---|---|---|---|
| A1 | Casts closer than `CAST_SLACK_MS` (1 s, packages/cli/src/logcasts.ts:17) merge into one: Typhoeus's hover shots (0.6 s apart, one event name) and Zhuang Fangyi's empowered battle skill lose every second cast | unlanded 34% of 92b4, 51% of dbae, 22% of bdf2, 20% of d9e5, 21–29% of 3aa6 / 4bfc / c6d8 / d774 | place repeated casts by their landings' count per cast (shot index), not a time gap |
| A2 | Si's second battle-skill press (Final Stroke, logged under the same ID) isn't replayed, so Artful Intent's burst (Fixed DMG) never lands where the log has it | 19 hits in 12 fixtures; 0eef −16%, e82d −12%, b6aa a 971k hit | map a second press during Artful Intent to Final Stroke; add `casts` to the 8 Si fixtures without them |
| A3 | A hit whose crit the log doesn't give counts as a non-crit (packages/cli/src/enginecheck.ts:193), in the totals too | e82d −31%, 0c14 −24%, 99fb −16%, 0eef −11% | expected crit for unknown, or the crit the ratio implies |
| A4 | The replay deals damage past the kill (`fightTotals` has no HP cap) | b7b3 +25% after Rhodagn's 2.29M HP | stop at the enemy's HP / the log's last hit |
| A5 | The Endministrator logged under `chr_0002_endminm_*` events | d4fb 286 hits unplaced (18%); the replay's own ultimates +11–18% in d4fb, 7e19, 0c14 | map the event prefix like the operator ID |
| A6 | Casts without damage (Xaihi's ultimate) aren't inferred, so their Amp is missing | e82d all 20 Si combo / ultimate hits ×2.04 (−47%); 90 hits ×1.73 in abfd / b6aa / 9555; 26 Typhoeus hits in dbae | infer a hitless cast from its buff's lane (as `castsFromBuffLanes` does for others) |
| A7 | d9e5 predates the 1.6 tables | its leads changed shape after the 1.6 data | exclude it from leads |

**Progress.** A1 done (2026-10-26). It was four things, not a time gap
alone: a cast whose landings of a key are all known and all logged takes
no more (logcasts.ts `exactSlots`); hits with a stack requirement are
alternatives at one frame like `if` and `branch` (Typhoeus's power and
plain shots were two slots); `distinctCasts` merged casts of one skill
placed from the same key; and basic-attack steps sharing a key are
chosen as the step after the latest cast (the windows; Rossi's chain) or,
in the replay, the step the engine's state allows (`chainStepFor`;
Typhoeus's hover attacks gated by her ABATK attempts). Typhoeus's
arrowrain key is restored (A7 retires the mark). Totals errors: 92b4
−34.8 → −3.1%, bdf2 −28.0 → −9.3%, dbae −43.9 → −20.6%, 4e5e −12.5 →
−6.5%, d572 −44.1 → −34.0% (plain 367 → 551), 99fb −62.3 → −50.0%, 2fd9
−52.3 → −42.3%, 0c14 −24.0 → −17.4%, abfd −46.4 → −42.0%. Some plain
matches drop where more landed hits make the replay's Stagger come even
earlier (3aa6's staggered-hit error +183% → +456%; bdf2 Si 19 → 12):
B1's bug showing through. Left in Typhoeus: a hover shot the replay
lands 0.7 s late, and her hover ending early in 92b4 (kit state, B8).

A3 and A4 done (2026-10-26): a hit whose crit the log doesn't give counts
at expected crits in the totals (the readings still try both): 4e5e −6.5
→ −0.7%, d572 −34.0 → −25.5%, abfd −42.3 → −34.7%, 0c14 −17.4 → −9.3%,
99fb −50.0 → −42.5%; e82d barely moves (its gap is A6's Amp). A fight
that ends in a kill (the log's total is the enemy's HP) stops the
replay's damage at that HP, so the totals' "last hit" is the time to
kill: b7b3 +23.1% damage → 0, the replay kills 10.5% sooner; 7e19 +48.1%
→ 0, 6.6% sooner (the engine's damage too high there).

Done when the verified fixtures' totals are within a few percent once
matched-hit errors are taken out, so the matched hits' error is the
engine's.

## Phase B: engine fixes the data or the logs can settle

Ranked by breadth (every fight first), then the owner's favourites.

| # | mechanic | now | what the data / logs say | impact |
|---|---|---|---|---|
| B0 | **Teammates' own basic attacks** | only the controlled operator basic-attacks (timing.ts:297) | the owner: they do, slower than the controlled operator, and some skills stop it (Liino's Vocalist Stance and ultimate). To settle from the logs: each operator's pace when not controlled (the gaps between its basic chains in fights where another is controlled), which chain steps it uses, whether its Final Strikes count; from the data: the main-character-only flags (`onlyEnableForMainChar` on 48 basic-attack files, `onlyExecuteWhenSourceIsMainChar` on 125) say which effects an uncontrolled attack doesn't get, and what blocks it (Liino's stance and ultimate: find the tag or action) | every team: ~2% per teammate plus what their hits trigger |
| B1 | **Stagger** | the bar only falls (packages/engine/src/timeline/resources.ts:211–240); the 50% node is only an event | logs: the engine's first Stagger comes at 0.25–0.96× the game's time (4e5e 23 s vs 67 s; bdf2 Staggered where the game never was); windows ~10 s vs the log's 7–19 s; 1,447 hits Staggered only in the engine (×0.77), 1,329 only in the log. Data: RecoverPoiseAction (`buff_common_recoverpoise`, `enemy_patrolregen`), ModifyResilienceDecreaseFactor; the node's buff (`buff_common_mini_poise_break`, 2.5 s, an interrupt and 0.5 s slow) | every fight: ×1.3 for ~10 s per window; per-fight totals −10% to +30% |
| B2 | **SP recovery after spending** | 8/s, paused 1.5 s after spending (rules.ts:14, from older Endaxis notes) | the game's native skill settings (Endaxis's extraction, revision 1.5.3) have `atbRecoverInterval: 0.5`, which Endaxis's simulator reads as the pause; Zero Sanity: 7.69/s, no pause | every SP-bound team: rossi-gilberta +7.8% with 0.5 s; whether 0.5 is the pause or a tick interval needs a check (a log with SP, or an in-game test) |
| B3 | **Corrosion** | ramp in whole seconds from application, paused only by a full stop; no carry-over on reapplication (reactions.ts:79–87) | data: the wrapper copies the existing Corrosion's `def_decrease` (carry-over); the settings' initial shred by level (−3.6 / −4.8 / −6 / −7.2) and 15 s; logs need ~4.5 points at 6.5 s where the model gives ≥ 11.9 | Arcane, Gilberta, Typhoeus, Ardelia: likely 5–10% too high while Corrosion is up |
| B4 | **Solidification duration** | 5.75–8.75 s (status.ts:82) | the native settings: 6 / 7 / 8 / 9 s (settles in-game test 71) | Estella teams, +0.25 s each |
| B5 | **Combustion duration** | 10 s / 10 ticks (status.ts:79) | `buff_common_burning_status` has 11 s (lifeType 1); count ticks in Heat logs | Laevatain and Heat teams |
| B6 | **Hits that ignore others' time stops** | pending hits shift with every time stop (clock.ts:40) | SetIgnoreGlobalTimeScaleAction on Si's battle-skill entities and Arcane's and Pogranichnik's ultimates | Si + Laevatain (Laevatain's ultimate stops time) |
| B7 | **A reaction's own damage hit** | not modelled (reactions.ts:105–111) | `buff_common_{fire,pulse,cryst}_triggered` carry a DamageAction (PrimaryAttrCalculation, atkScale 50); the logs' unexplained ×1.42 on one-element reaction keys (batch 1 L2) | about a third of Arcane's logged damage in 0eef |
| B8 | **Kit fixes the logs show** | — | Typhoeus's `hovering_atk` (P1 ATK) ends at her combo in the engine but lasts in the log (91 hits, ×1.10); her arrowrain `events` mark hides dbae's verified hit; Liino's ATK buff windows offset (389 hits ×1.087 the other way 207); Rossi's ultimate ×2.8–3.3 (Wolven Blood layers); Last Rite's perfusion on only in the engine on 76 hits (×0.77) | per operator, up to −43% (Rossi) |
| B9 | **Crit-triggered effects under expected crits** | never fire (`simulate`'s default); the search switches to rolled crits | an expected-value model (each trigger at its crit rate), or `simulate` defaulting to rolled crits with many runs | Rossi about −30%, crit-trigger weapons |
| B10 | **Hit-stop** | not modelled (281 files, 33 operators) | log chain timings: Camille and Si match the engine, Arcane ~4% slower, Rossi 15–20% slower; the curves exist (Endaxis's catalogue, read only) | timing; settle per operator from the logs' chain timings before modelling |
| B11 | Smaller | `NOT_MODELLED` text still lists Link and finisher as ×1 (damage.ts:83; both are modelled); a skill's SP arrives at its first hit; hitless skills' SP; perfect-dodge SP 7 vs 7.5 (test 52) | — | small |

## Phase C: questions for the owner (they decide what to model)

- **Do teammates act on their own?** Answered (the owner, 2026-10-26):
  "Yes, the non-controlled operators do basic attacks on the enemies,
  though not quite at the pace the controlled operator does and certain
  skills, like liino's stance and ultimate prevent that." So the engine
  is missing every teammate's basic attacks (in 4e5e, 23 of 42 seconds have
  basic hits from two or more operators; about 1.5–2.3% of a fight per
  teammate, plus their triggers, inflictions and Final Strikes). Now item
  B0 below.
- **Dodging and enemy attacks by default:** the default scenario has none.

## Phase D: in-game tests (re-ranked by what they decide)

1. **99** Stagger bar without hits (B1).
2. **New: SP recovery** — cast battle skills from empty SP and time 3–4
   casts: with a 1.5 s pause each costs about 1 s more than with 0.5 s (B2).
3. **18** what a time stop freezes (cooldowns, the caster's buffs, SP):
   every ultimate; Laevatain's Twilight, Estella's Susceptibility.
4. **54** dash cancels (every operator).
5. **51** an effect acting on the hit that creates it: 13 kits, Arcane's
   Solemn Phalanx, Hot Work; 10–25% on those hits.
6. **38** two Arts Susceptibility sources (Gilberta, Estella).
7. **35 / 60 / 64** combo windows (reaction-opened, a trigger during the
   cooldown, Vulnerable on Vulnerable): one combo more or fewer per event.
8. **21** Twilight held through combos (+1.9 s each: Laevatain's biggest
   state, at P0).
9. **19** Haste's scope (Si), **29** sub-skills as battle skills (Si,
   Liino, Typhoeus), **17** jumps inside Laevatain's battle skill (1.7–2.5 s
   each).
10. **4 / 37** Corrosion under slow-downs, Imprisonment (B3).

## Phase E: structural (no number moves, but safer)

`Modifier` with an attacker / defender side instead of `SNAPSHOT_ZONES`
(and in-game test 77's ATK part); buff expiry and ticks as scheduled
items; slow-downs shifting what's created between their cast and start;
the compiler's leftovers (145 `dataOverride` marks are compiler limits,
96 of them Zhuang Fangyi's Thunder Strikes: no number moves, but a patch
wouldn't be caught there).

## Settled or excluded

Negative resistance uncapped (the data's 94–99 have no minimum): right.
Laevatain's battle-skill scales follow a third-party table against the
data (test 20): P1+ only, nothing at the owner's P0. HitStop aside, the
ignored action types that touch damage are hand-written in kits or have
an engine rule. d9e5 is excluded (pre-1.6).

## Order of work

A1–A7 first (each re-measures the verified fixtures), then B0 (teammates' basic attacks: measured from the logs once A places casts right) and B1 (Stagger:
re-import the logs with `poiseDamage` per hit, compare windows), B2–B5
(settings and data), B7, B8 per favourite, B6, B9, B10; ask C now; D as
the owner plays; E alongside when a change touches it. Every step reports
the verified fixtures' totals and matched-hit error before and after.
