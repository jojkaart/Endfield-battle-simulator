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

A2 done (2026-10-26). Si's second battle-skill press, logged as her
battle skill, is Initial Stroke, and Final Stroke's press isn't logged at
all; the burst after Artful Intent's end is. So: a logged cast of a skill
whose damage the log shows elsewhere is kept as a slot cast, made as the
skill of its kind the slot holds then (Initial Stroke) only when it leads
to a cast inferred from the log (castsFromBuffEnds: a logged hit of a
trigger on a buff's end, the kit ending that buff on a skill's cast,
the replay's buff lasting past the logged end by itself: Final Stroke).
Liino's logged press during her stance in 0eef leads to nothing the log
shows and stays skipped (as End Stance it would drop the stance's ATK
the log keeps). A Fixed DMG landing of a logged hit the log capped at
the enemy's remaining HP is capped in the totals too. 0eef −26.0 →
−11.8%, bdf2 −9.1 → +0.5%, b6aa −30.3 → −20.5%, c3c7 −12.4 → −5.1%, e82d
−59.6 → −51.8%, 40d9 → 0 (a kill). Not done: `casts` for the 8 Si
fixtures without them (a re-import with `--detail`).

A5 reclassified (2026-10-26): the male Endministrator (`chr_0002_endminm`,
d4fb) isn't the female's events under another name. All 13 of his skill
files differ from hers in timing and actions (his attack 1 ends at frame
120, hers at 179; his power attack differs in 2,473 lines), so mapping
the events would place his hits on her timeline. He needs a kit variant
(her kit's structure, his SkillData) and the importer needs to tell the
genders apart (it reads the virtual ID as her): a kit item now (B8).

A6 done (2026-10-26), but not as planned: e82d's missing Amp was Si's
own (her ultimate's, 0.432 Cryo / Heat), not a hitless cast's. Arcane's
ultimate at 5455 ms inside Si's from 5096 ms: the engine held Si's
delayed Amp (her cast's frame 62) through Arcane's stop while her
logged slashes (frame 63 on) land on time, unheld. Shifting cast starts
by other operators' stops instead (the placement) made b7b3 and dbae
worse (plain 38 → 13, 23 → 4): wrong. The engine's rule now: an
ultimate's time stop doesn't hold an operator whose own ultimate's time
stop covers those frames (Si's stop's ignoreTargets name the "dazhao"
group; an interim from one log, in-game test 18). e82d −51.8 → −32.7%,
c3c7 −5.1 → +0.1%, 9555 plain 110 → 124; 458b plain 300 → 294.
Examples with overlapping ultimates move: camille-gilberta +13.0%,
si-laevatain-liino-gilberta +5.2%, gilberta-gravity-field +4.2%,
antal-focus +2.2%. Xaihi's own ultimate Amp (a hitless cast whose Amp
shares the affix names with Si's) is still not inferred: e82d's 0.607
Cryo / Nature entries.

A7 done: d9e5 is marked excluded in fixtures/pending/README.md.

Done when the verified fixtures' totals are within a few percent once
matched-hit errors are taken out, so the matched hits' error is the
engine's.

## Phase B: engine fixes the data or the logs can settle

Ranked by breadth (every fight first), then the owner's favourites.

| # | mechanic | now | what the data / logs say | impact |
|---|---|---|---|---|
| B0 | **Teammates' own basic attacks** (done 2026-10-28: the replay since B1, `simulate` and the search below) | only the controlled operator basic-attacks (timing.ts:297) | the owner: they do, slower than the controlled operator, and some skills stop it for their own operator only (Liino's Vocalist Stance and ultimate stop Liino's basic attacks, not the others'; the stance deals its damage through the skill instead; the owner, 2026-10-26). To settle from the logs: each operator's pace when not controlled (the gaps between its basic chains in fights where another is controlled), which chain steps it uses, whether its Final Strikes count; from the data: the main-character-only flags (`onlyEnableForMainChar` on 48 basic-attack files, `onlyExecuteWhenSourceIsMainChar` on 125) say which effects an uncontrolled attack doesn't get, and what blocks an operator's own (Liino's stance and ultimate: find the tag or action) | every team: ~2% per teammate plus what their hits trigger |
| B1 | **Stagger** (done 2026-10-26, below) | the bar only falls (packages/engine/src/timeline/resources.ts:211–240); the 50% node is only an event | logs: the engine's first Stagger comes at 0.25–0.96× the game's time (4e5e 23 s vs 67 s; bdf2 Staggered where the game never was); windows ~10 s vs the log's 7–19 s; 1,447 hits Staggered only in the engine (×0.77), 1,329 only in the log. Data: RecoverPoiseAction (`buff_common_recoverpoise`, `enemy_patrolregen`), ModifyResilienceDecreaseFactor; the node's buff (`buff_common_mini_poise_break`, 2.5 s, an interrupt and 0.5 s slow) | every fight: ×1.3 for ~10 s per window; per-fight totals −10% to +30% |
| B2 | **SP recovery after spending** | 8/s, paused 1.5 s after spending (rules.ts:14, from older Endaxis notes) | the game's native skill settings (Endaxis's extraction, revision 1.5.3) have `atbRecoverInterval: 0.5`, which Endaxis's simulator reads as the pause; Zero Sanity: 7.69/s, no pause | every SP-bound team: rossi-gilberta +7.8% with 0.5 s; whether 0.5 is the pause or a tick interval needs a check (a log with SP, or an in-game test) |
| B3 | **Corrosion** (carry-over done 2026-10-28, below) | ramp in whole seconds from application, paused only by a full stop; no carry-over on reapplication (reactions.ts:79–87) | data: the wrapper copies the existing Corrosion's `def_decrease` (carry-over); the settings' initial shred by level (−3.6 / −4.8 / −6 / −7.2) and 15 s; logs need ~4.5 points at 6.5 s where the model gives ≥ 11.9 | Arcane, Gilberta, Typhoeus, Ardelia: likely 5–10% too high while Corrosion is up |
| B4 | **Solidification duration** | 5.75–8.75 s (status.ts:82) | the native settings: 6 / 7 / 8 / 9 s (settles in-game test 71) | Estella teams, +0.25 s each |
| B5 | **Combustion duration** (checked 2026-10-28: 10 s stays, below) | 10 s / 10 ticks (status.ts:79) | `buff_common_burning_status` has 11 s (lifeType 1); count ticks in Heat logs | Laevatain and Heat teams |
| B6 | **Hits that ignore others' time stops** | pending hits shift with every time stop (clock.ts:40) | SetIgnoreGlobalTimeScaleAction on Si's battle-skill entities and Arcane's and Pogranichnik's ultimates | Si + Laevatain (Laevatain's ultimate stops time) |
| B7 | **A reaction's own damage hit** (Corrosion's done 2026-10-28, below) | not modelled (reactions.ts:105–111) | `buff_common_{fire,pulse,cryst}_triggered` carry a DamageAction (PrimaryAttrCalculation, atkScale 50); the logs' unexplained ×1.42 on one-element reaction keys (batch 1 L2) | about a third of Arcane's logged damage in 0eef |
| B8 | **Kit fixes the logs show** | — | Typhoeus's `hovering_atk` (P1 ATK) ends at her combo in the engine but lasts in the log (91 hits, ×1.10); her arrowrain `events` mark hides dbae's verified hit; Liino's ATK buff windows offset (389 hits ×1.087 the other way 207); Rossi's ultimate ×2.8–3.3 (Wolven Blood layers); Last Rite's perfusion on only in the engine on 76 hits (×0.77) | per operator, up to −43% (Rossi) |
| B9 | **Crit-triggered effects under expected crits** | never fire (`simulate`'s default); the search switches to rolled crits | an expected-value model (each trigger at its crit rate), or `simulate` defaulting to rolled crits with many runs | Rossi about −30%, crit-trigger weapons |
| B10 | **Hit-stop** | not modelled (281 files, 33 operators) | log chain timings: Camille and Si match the engine, Arcane ~4% slower, Rossi 15–20% slower; the curves exist (Endaxis's catalogue, read only) | timing; settle per operator from the logs' chain timings before modelling |
| B11 | Smaller | `NOT_MODELLED` text still lists Link and finisher as ×1 (damage.ts:83; both are modelled); a skill's SP arrives at its first hit; hitless skills' SP; perfect-dodge SP 7 vs 7.5 (test 52) | — | small |

B1 done (2026-10-26), with B0's half in the replay. From all 29 logs'
`poiseDamage` (now each fixture hit's `poise`, `efsim zmdlogs refresh`):
- **Stagger per hit is right.** The engine's bar follows the log's hit
  for hit wherever the replay has the right controlled operator (4e5e
  to 28.8 s and from 42 s on; Lift's 10 × (1 + AI/200) included). The
  reactions' poise in the log is the triggering hit's, credited twice
  (the bar drops once).
- **The bar doesn't recover on its own.** No rise between hits in 29
  fights, even over gaps of 10–38 s (in-game test 99 answered). It
  refills at a Stagger's end, and in jumps straight to full that are the
  enemy's own: a second life (3aa6, c3c7, d774 at HP 0 → 100%), and
  Rhodagn at 29.5 / 33.2 / 37–45 s in three of five fights, not at a
  fixed HP (two fights passed 70% without it). The engine gains an enemy
  action `recover` (refillPoise), and the replay takes these jumps from
  the log (loggedRecoveries). What sets off Rhodagn's is test 100.
- **Stagger lasts PoiseRecTime** (attribute 21 × 31) **plus the time
  stops**: the logged windows (real time) are the enemy's 9–11 s plus
  the ultimates' and combos' stops inside them, plus 0.3–2.3 s (median
  ~1.1 s) nothing explains yet (hit-stop, B10?). Short windows are the
  fight's end, or a recovery cutting them.
- **Teammates' Final Strikes deal no Stagger** (onlyEnableForMainChar):
  one operator per fight has Stagger on its basic hits. The replay made
  every basic attacker controlled, so teammates' attacks (B0) Staggered
  and took the controlled path. Now the controlled operator comes from
  the log (controlledFromLog: basic hits with Stagger; the swap at the
  start of the next one's run of basic casts), and the others' basic
  casts replay as their own (`replayCast` `teammate`).
- Along the way: the refresh added the logged casts to 23 fixtures (A's
  "casts missing" leftover), and a logged cast placed inside its
  operator's own cantCastSkill channel no longer cuts the running cast
  (Xaihi's ultimate Amp: A6's leftover).

Measured (totals error, plain matches) from before the refresh:
abfd −34.6 → −6.5% (31 → 270), e82d −32.7 → −9.1% (3 → 18), 458b
−15.2 → −1.7% (294 → 442), 99fb −42.5 → −26.4%, a7a7 −33.4 → −19.4%
(0 → 137), 9555 −20.9 → −15.5% (124 → 179), c6d8 −19.5 → −9.1%, b6aa
−20.5 → −5.6%, 012a −13.6 → −2.3%, dbae −20.6 → +5.7%; plain d572
551 → 637, 4bfc 121 → 198, 4e5e 189 → 228, 40d9 23 → 51, bdf2 79 → 104.
Some totals moved away from 0 as the replay stopped Staggering where the
game didn't (that had offset other deficits): 4e5e −0.7 → −5.2%, bdf2
+0.5 → −2.7%, 40d9 0 → −1.9%, c3c7 +0.1 → +7.9%, 4e36 +17.2 → +21.5%.
dbae moved to pending: Xaihi's hits need Arcane's
Nature burst at 10341 ms, which the reaction replay doesn't make (B8).
Left: 4e5e's bar 24 lower than the engine's from 53.2 s (unattributed
Stagger at Estella's projectile and a Cryo-on-Heat reaction), which
costs Rossi's killing blow its Stagger.

B0 done (2026-10-28). Measured in 28 logs (the replay's teammate casts,
from the controlled operator the log's Stagger names): a teammate runs
its chain at the chain's windows (step intervals 0.82× the steps'
exclusive time), its runs end in a pause (235; median 3.5 s, quartiles
2.1–6.8 s) or at its own battle skill or combo (246); it spends a median
39% of its free time attacking (64 operator-fights; the controlled
operator 60–80%). The engine (`teammates.ts`, scenario `teammateAttacks`,
default on in scenario files, off in the engine API for tests and the
log replay): each operator that isn't controlled runs its chain whenever
its own action is over (exclusive time and own hits), the next step at
its window, a 3.5 s pause after a full chain; its own casts cut it at
once; a swap (or a skill that takes control) hands the attacks over;
same-frame attacks go by operator ID (team order doesn't matter).
Liino's stance holds hers (her battle skill's action), not the others'.
Their Final Strikes deal no Stagger and they get no controlled-only SP
(both from the data). Examples: akekuri-laevatain +66.1%,
endministrator-crystals +43.5%, fluorite-gilberta +37.5%, antal-focus
+37.4%, pogranichnik-chen +37.3%, ember-guard +34.2%, wulfgard-fluorite
+29.9%, gilberta-gravity-field +26.2%, alesh-estella +25.9%, xaihi-si
+24.4%, perlica-estella +19.9%, camille-gilberta +13.4%, lastrite-si
+10.5%, si-laevatain +8.5%, si-laevatain-liino-gilberta +7.6%,
typhoeus-gilberta +5.5%; solo examples and liino-laevatain unchanged;
rossi-gilberta's one seed −18.7% (its rolled crits share one stream; the
mean of 50 seeds +2.3%). Largest where the controlled operator is a
support and a damage dealer is a teammate: the support's idle waits now
hold the teammate's chains. In-game test 101 checks the pace. The search
takes ~1.5× as long (si-laevatain, beam 24: 20 → 30 s) and finds +4.4%
there.

B3, B5, B7 (2026-10-28):
- **B3 Corrosion.** The logs don't show it too strong. Against the
  simulation of the logged casts, hits under Corrosion are 1.00–1.10× the
  engine's where the same operator's hits outside are 1.00 (Arcane in
  bdf2 1.000 under and outside; Typhoeus 1.065–1.096 under: hers, not the
  shred's). What the data shows and the engine lacked: a Corrosion
  applied while one is on starts from the running one's shred (the
  wrapper's GetTargetBuffBBAdvanced of `def_decrease`; the new one keeps
  the stronger of that and its own start, ramps to its own cap, clamped
  from its first tick): `corrosionShred` `carried`. a7a7 −19.4 → −8.8%,
  plain 137 → 315; nothing else moves.
- **B5 Combustion.** `buff_common_burning_status` says 11 s, but the
  logs count 10 ticks per Combustion run to its end (0c14, d572), as
  the engine does now, and 11 s (with the last tick before the end) makes
  the replay's ticks worse: 458b 60 → 53, 012a 13 → 11 (logged 58, 13).
  A Heat reaction inside the extra second meets the running Combustion,
  which the game must handle otherwise. Kept at 10 s.
- **B7 Corrosion's own hit.** The log's one-element key
  `buff_common_natural_triggered` (all 10 logged) is Corrosion's initial
  hit: the Nature wrappers create it (with the damage) before the status
  buff. So it doesn't see its own Corrosion's shred. With that, 0eef,
  bdf2, d572 and a7a7's first match plainly (were ×0.91–0.94, or not
  checked), b6aa's at level 3 (the replay's 2), 4e5e's assumed; 04d4's
  Purrchena one and an a7a7 one (×1.003, with a Corrosion running) don't.
  Examples: camille-gilberta −0.22%, si-laevatain-liino-gilberta −0.03%.
  The other elements' reactions name their damage key by both elements
  and need nothing.

B8, Typhoeus's hover (2026-10-28). Her ×1.07–1.10 under Corrosion was
her P1 hover ATK (`hovering_atk`), not Corrosion: the replay's hover
ended early. Two replay faults: (1) a logged cast after which the
previous one's logged hits go on (`keepPrevious`) kept everything the
running cast had to come, including the follow-up casts on its timeline
(the loop shot 2 starts lands her at its frame 27 unless shot 3 cuts it):
now it keeps all but those (`castSkill` "uncast"); (2) both her combos
share their log keys, so the placement cast the grounded one, which ends
the hover: the replay now casts a slot's variant its kit says is
`available` then (`skillAvailable`). bdf2 −2.9 → +0.5%, plain 105 →
123 (Typhoeus 27 → 45), 92b4 −3.1 → 0% (plain 5 → 25), 7e19 plain 50 →
64, 0eef −12.0 → −10.1%; 0c14 −5.5 → −7.6%. d9e5's total −28.9 → −1.9%,
but its hits still mismatch (Typhoeus +7.7%, the others −12 to −16%):
still excluded (A7). Examples don't move (replay only).

B8, Zhuang Fangyi's ultimate (2026-10-28). Her battle-skill presses during
her ultimate are logged as `normal_skill`; the slot then holds
`normal_skill_ult`, and the placement had merged two of five presses'
hits into the casts before them (1.05 M of her ult battle skill unlanded
in 3aa6). A slot press is now made as the variant its kit says is
available when the log shows that variant's own keys within 3 s after it
(`ReplayedCast.shows`; a logged consequence, as A2's rule asks: Liino's
End Stance has none). 3aa6 −40.7 → −23.8%, 4bfc −37.4 → −31.4%, c6d8
−9.1 → +7.9% (Zhuang −20.3 → −1.2%; Perlica +144% and Arcane +116% there
were hidden by it: their hits are 0.33–0.40× the engine, her ultimate's
0.100× exactly: a damage reduction on eny_0090_wgabyss the log doesn't
list, to look into). Zhuang's own values in her ultimate still mismatch
(normal_skill_ult ×1.02–1.55, buff_sword_triggerd 887 k unlanded in 3aa6,
attack1_ult_2 not in her kit).

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

1. **100** what makes Rhodagn's Stagger bar snap back to full (B1; 99
   is answered by the logs: the bar doesn't recover on its own).
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

A1–A7, B1, B0, B3 (carry-over), B5 (checked) and B7 (Corrosion) done
(2026-10-26 / 28). B2 and B4 wait on in-game tests 102 and 71. Next B8
per favourite, B6, B9, B10; ask C now; D as
the owner plays; E alongside when a change touches it. Every step reports
the verified fixtures' totals and matched-hit error before and after.
