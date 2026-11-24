# Misprediction statistics across the logs (2026-11-24)

The owner asked for one statistical pass over every log's mispredictions, instead of one log or one operator at a
time: which features concentrate the error, which ratios recur, and which candidate causes could each explain a large
share. Base: main at e5f22ef. One candidate turned out certain and is fixed (Zhuang Fangyi's Empyrean combo, commit
c9cf9a3); everything else is a lead, ranked below with its next check.

## Method

**Data.** `scripts/probes/stats/build.ts` replays every verified and pending development log once (the check's own
computations: placeHits, logBuffReplay, engineHits, checkLog, engineReport; never a hold-out) and writes, under
scratch/stats/: one row per logged hit (29,035: verdict class, the engine's primary reading, the log's reading, zones,
modifiers, the listing and its differences with the replay, the replay's crit and its source, Stagger on each side,
the placed cast's kind, start and slot, whether the hit sits inside an applied slow-down, near a placed hidden hold, a
cast made as a cut, the fight's end or an away stretch, the replay's Stagger changing near it, the ages of the listed
effects, the boundary effects, layers, enemy statuses, the fixture's parser version and import date), one row per
one-sided landing of the totals (1,987, onesided.ts), one per fight. For each difference between the log's listing
and the replay at a hit it also reads the hit with that one difference taken the log's way, with the logged crit
flipped, and with each team kit buff at the hit's boundary on or off ("counterfactuals"). About a minute on four
threads. `names.ts` and `buffprops.ts` add operator names and kit buff properties; `analyze.py` makes every table
below (`python3 -I scripts/probes/stats/analyze.py [section…]`), `bands.py` the ×1.5 split,
`holdout-aggregates.ts` the hold-out confirmation (aggregates only).

**Definitions.** P is the engine's primary reading (for a hit whose crit the log doesn't give, the nearer of P and
P × (1 + Crit DMG), so an unlogged crit isn't counted; a capped killing blow is graded on its uncapped value, as the
check grades it). A hit is **off** when |logged − P| > 1.5 (the plain match's ±1); its **error** is |logged − P|,
the damage it puts into the fight's matched share; r = logged ÷ P. Each off hit gets its first **explanation**, in
this order: one difference with the log taken the log's way fits (±max(1.5, 0.1%)); the log's whole listing of the
kit buffs fits (`logReading`); a boundary kit buff the other way fits; the hit lies on its operator's tight fight-wide
factor (median r of its non-crit kit hits, half within 0.3%, off ≥ 1%); else the check's class: an assumed match (an
alternative reading fits), a fallback (the listing with alternatives fits), Corrosion unquantified, or unexplained.

**Scope.** The four stage logs (7b54, 6339, 8915, c6d8: shields and phase factors, `OFFSETS_EXPLAINED`) are 23.4% of
all error and left out; 27,330 hits in 57 fights remain. Shares are of their off error (14.93M, 5.0% of the logged
damage) unless said otherwise.

**Statistics.** Feature tables give each value's share of the error and of off hits, a 95% interval from 300
resamples of whole fights (hits within a fight aren't independent), and a negative control: the same share with the
feature's values shuffled within each fight (20 shuffles). A share that survives the shuffle is the hits' doing; one
the shuffle reproduces is only which fights are bad. The off rate (share of a group's hits that are off) is reported
beside the error share because the error favours big hits (combos, ultimates, Staggered hits). A regression tree
(depth 4) and a lasso on min(|ln r|, 0.7) screen the features, fitted on one group of fights and tested on the other
(development + verified ↔ earlier pending), with features shuffled within fights as their control.

## Data summary

| Group | Hits | Off | Off error of logged damage |
|---|---|---|---|
| Development | 16,495 | 29.9% | 7.2% |
| Earlier pending | 11,736 | 32.8% | 5.7% |
| Verified | 804 | 20.9% | 2.2% |

Non-stage by class (share of the off error): mismatch 39.9%, assumed 26.7%, fallback 23.7%, unquantified 9.7%; plain
0%. The error is concentrated in a few fight-operators: of 216 with an off hit, the top 10 carry 40.4%, the top 20
61.4%, the top 50 87.6%.

## What the off hits are

| First explanation | Off hits | Share of off error | Fights | Operators |
|---|---|---|---|---|
| unexplained mismatch | 1,432 | 35.1% | 40 | 26 |
| listing + alternatives (fallback) | 1,891 | 15.3% | 42 | 24 |
| an alternative reading (assumed) | 254 | 14.9% | 41 | 24 |
| one kit buff the log's way: engine has it, log doesn't | 890 | 10.5% | 51 | 30 |
| Corrosion unquantified | 723 | 8.5% | 22 | 18 |
| one kit buff the log's way: log has it, engine doesn't | 620 | 6.3% | 44 | 24 |
| one kit buff the log's way: other values (layers) | 631 | 3.6% | 37 | 24 |
| a fight-operator factor (build offset) | 655 | 2.3% | 4 | 6 |
| a boundary kit buff the other way | 224 | 1.8% | 51 | 21 |
| the listing (several buffs) | 223 | 1.3% | 24 | 16 |
| Stagger the log's way | 22 | 0.3% | 14 | 11 |

So about a fifth of the error (20.4%) is one kit buff whose state the replay has wrong at the hit, and the log's own
listing says which; another 30.2% is matched only with an alternative reading or the listing with alternatives (the
replay's state uncertain or wrong there too); a third is unexplained. The assumed matches' alternatives are mostly
boundary buffs (90 hits), another kit hit of the event (84), a consumed buff count (64), Link (34); the fallbacks'
the listing with unlogged own buffs (545), boundary buffs (391), layers (160).

## Ranked candidates

| # | Candidate | Share of off error | Spans | Status |
|---|---|---|---|---|
| 1 | A variant hit logged under its base key (Zhuang Fangyi's Empyrean combo) | 4.3% (21 hits) | 4 fights, hold-outs too | **fixed** (c9cf9a3) |
| 2 | One kit buff's state at the hit wrong, the listing right | 20.4% | 51 fights, ~140 kit buffs | lead: no buff above 2.0% |
| 3 | Weapon "ready" buffs consumed by an ultimate, kept by the engine | 2.8% (25 hits) | 6 fights, 2 weapons | new lead |
| 4 | Corrosion's ramp (unquantified) | 8.5% | 22 fights | known ("The buff clock", Corrosion) |
| 5 | Fight-operator residuals in a few known problems | ~20% of the unexplained 35% | ≤ 4 fights each | known, mapped below |
| 6 | Moments of change: buffs starting or ending at the hit | marker only (1.8% explained) | 57 fights | new: a marker, not a cause |
| 7 | Error growing with time in the fight | weak | 34 of 57 fights | new: consistent with clock drift |
| 8 | The remaining ×1.5 band (Liino's ultimate windows, Alesh's ultimate, Ardelia) | 1.6% | 9 fights; 6.9% of the hold-outs' | new lead |
| 9 | Fight-wide factors not yet in the offsets screen | ~1% | 7910, af7b Liino | new fit-build candidates |

### 1. A variant hit logged under its base key: Zhuang Fangyi's Empyrean combo (fixed)

**Evidence.** The ratio clusters' ×1.500 peak (65 hits, 5.0% of the off error, 20 fights) is mostly one key: 21
`chr_0030_zhuangfy_combo_skill` hits at exactly ×1.500 (or ×1.10–1.91 where the Electrification count differs too),
every one flagged `forced` by the replay (the base combo isn't available under the Empyrean). `poise.origin` splits
them: all 22 hits whose Stagger the log credits to `combo_skill_ult` (3aa6, 4bfc, 4d60, c6d8, d774) are off, all 15
credited to `combo_skill` are on (two near). The kit's numbers say why: the base combo's atk_scale is 3.6, the
Empyrean combo's 5.4 = ×1.5; the log keys the Empyrean combo's damage as the base combo's, the kit gave its hit only
its own key, so the placement read it as the base combo. 4.3% of the non-stage off error, the largest single cause
found.

**Fix.** The Empyrean combo's hit carries the base key (packages/data/kits/operators/chr_0030_zhuangfy.json, frame
24 written). `npm run snapshots:update`: development 1 better (4d60 plain 704 → 707, damage −4.0 → −1.8%), hold-out 1
better (plain +3, mismatch −4; mean |damage error| 8.2 → 8.0%), earlier pending 2 better (3aa6 −1.6 → +0.1%, 4bfc
−1.7 → +0.3%) and 2 mixed, per hit closer: d774 +3.8 → +7.2% (the combos' ×1.5 under-prediction hid Zhuang Fangyi's
replay-only Empyrean strikes, 466k; matched +2.2%: the open Sunderblade count) and c6d8 41.5 → 44% (a stage log). No
team fight moved (team-ab: identity check, every team's fight the same).

**Lesson for the rest:** a variant that shares its base skill's logged key, under a state the kit already knows, shows
as exactly one scale ratio and a `forced` cast flag, and `poise.origin` names it. The hold-outs' ×1.5 band is still
6.9% of their off error after the fix (candidate 8).

### 2. One kit buff's state at the hit: the replay wrong, the listing right (20.4%)

**Evidence.** 2,141 off hits (28% of them) fit when one difference with the listing is taken the log's way: the engine
has a buff the log doesn't list (10.5%), the log lists one the engine doesn't have (6.3%), or both with other values
(layers, 3.6%). On the hold-outs the same class is the largest: 34.0% of their off error. It spans 51 fights and about
140 kit buffs; by kit buff the largest are Si's ultimate Amp listed where the replay has ended it (2.0%, 7 fights,
×1.43; 9c0b's 45 hits), the Endministrator's sword "ready" (1.8%, candidate 3), Arcane's Susceptibility layers (1.2%,
9 fights, ×1.08), Gilberta's weapon Arts DMG listed where the replay hasn't it (1.1%, 7 fights, ×1.16), Arcane's
weapon Arts DMG Taken kept by the engine (1.0%, 3 fights, ×0.80), Chen Qianyu's sword "ready" (0.9%), Yvonne's
ultimate state (0.8%, one fight), Zhuang Fangyi's weapon ultimate buff (0.8%), Arcane's Will burst buff (0.8%, 8
fights), Typhoeus's Hovering ATK (0.6%, 5 fights). By how the buff is applied: buffs a cast starts 6.5% (30 fights,
18 buffs), a kit hit's 2.1%, a burst's 2.0%; by origin the operators' own 10.2%, weapons 9.0%, gear sets 1.3%; by
target self 7.7%, team 7.0%, enemy 5.7%. Instance buffs 5.0%.

**Mechanism hypothesis.** Not one mechanism: the replay's windows (start, end, refresh) and layer counts of single
buffs. The cast-started buffs are the buff clock's (hidden holds, ends under stops) and the cast placement's.

**Ruled out:** that the log's listing is the side that's wrong for these hits (by construction they fit the log's
way); a crit-flag error (flipping the logged crit fits 32 of 7,565 off hits; hold-outs 6 of 624).

**Next check.** Per buff, the cheapest views already exist: `efsim zmdlogs differences --all --what <buff>` (does the
damage side with the log's listing or the replay, per run) and `zmdlogs replay <fx> --kit-buff <owner:id>`; start
with Si's ultimate Amp in 9c0b (2.0%), Gilberta's weapon Arts DMG (7 fights), Arcane's Susceptibility layers (9
fights). Not yet in open-problems as one list: added there.

### 3. Weapon "ready" buffs consumed by an ultimate, kept by the engine (2.8%)

**Evidence.** Among the one-buff fits, the buffs a cast consumes (`consumedBy`) are 2.8% of the off error from 25 hits
in 6 fights and 4 buffs, mostly two weapons' "ready" buffs on ultimates the engine reads with them and the log
without: the Endministrator's `wpn_sword_0021.ready` (7 hits, 3 fights, ×0.81) and Chen Qianyu's `wpn_sword_0017.ready`
(14 hits, 2 fights, ×0.86). Their hits are big (ultimates), so few hits carry a lot.

**Mechanism hypothesis.** The ready buff was consumed earlier (by another ultimate or skill the kit doesn't list among
`consumedBy`), or never stacked (its trigger, `vulnerable` / `buffApplied`, didn't fire in the game).

**Next check.** A data lookup: the two buffs' BuffData (`efsim gamedata tree <buff>`: which skill types consume them,
the trigger's condition), then `zmdlogs replay <fx> --kit-buff chr_0005_chen:wpn_sword_0017.ready` in d4fb. Chen's
readings are already an open problem ("Fight totals", d4fb): this may be part of it.

### 4. Corrosion's ramp (8.5%)

723 off hits under a listed Corrosion the check can only bracket (`unquantified`), 22 fights; the hold-outs' 2.7%.
Known: "The buff clock" (Corrosion's ramp as a clock) and the Corrosion probes; nothing new here but its size.

### 5. The unexplained third: known problems, by fight and operator

The unexplained mismatches (35.1%) sit in few fight-operators, nearly all already open: 7910 Tangtang 3.9% (×1.10
under her weapon's Arts DMG Taken listed with other values, 86 hits, and two ultimate hits ×10: open, "Fight totals"
7910); db87 Laevatain 3.1% (×1.30, "db87: ×1.3 on Laevatain's hits under her sword buff"); d4fb Chen Qianyu 2.5% and
Endministrator 1.0% (×0.85, ×0.77: Chen's readings, candidate 3); 9a80 Si 2.3% and Si's combos elsewhere (×0.85:
Yinglung's Edge, "Type 50 Yinglung's Edge"); 4d60 / 3aa6 / d774 Zhuang Fangyi 6.2% (the Empyrean combo, fixed, and
her Sunderblades); 9c6e Typhoeus 2.0% (two targets); fc63 Typhoeus 1.8% (×0.88, her bursts' Hovering ATK, "Typhoeus,
Arcane, Liino, Perlica"); 04d4 Ember 0.9% (×1.085 on his basic attacks; "Ember low by one factor" under "Smaller");
207f Rossi 0.8%. The ×1.3 band (6.1%, 20 fights) is
db87's for three quarters; without it 1.6% over 19 fights and 16 operators, no group.

### 6. Moments of change: buffs starting or ending at the hit (a marker)

**Evidence.** Hits whose log lists a boundary effect (a buff starting or ending exactly at the hit, 20.8% of hits) are
off at 42.8% against 24.2%, carry 51.3% of the error (interval 42.5–60.7%), and the association survives the
within-fight shuffle (shuffled 23.8%); it holds inside every skill kind without Stagger (basic 40.0% against 20.2%,
battle 43.8 / 19.6%, combo 38.5 / 21.5%, ultimate 52.5 / 31.9%) and on the hold-outs (29.9% against 9.0%). The
commonest boundary buffs: Rossi's and Chen's sword layers (`buff_wpn_sword_0022_layer`, 2,058 hits, 12.3% of the
error), the spellburst set, Stagger's own entry (155 hits, 63.9% off), Typhoeus's weapon, the forced Electrification.

**But it explains little by itself:** taking a boundary kit buff the other way (on or off) fits only 224 off hits, 1.8%
of the error (hold-outs 6.4%). The off boundary hits are unexplained mismatches for 41.2% of their error, fallbacks
20.5%, one buff the log's way 10.9%. So a boundary effect marks a moment when the state changes (a crit adding layers,
a Stagger starting, a cast's buffs landing), where the replay's state is wrong more often in general, not that the
boundary buff's own order is wrong.

**Next check.** None on its own; it says where to look first within a fight's mismatches (the check's edge toggles
already try kit buffs changing within 500 ms).

### 7. Error growing with time in the fight (weak)

Off rate by time: 12.5% in the first 10 s, 20% at 10–40 s, 32% at 40–90 s, 38% at 120–200 s; the last tenth of a
fight carries 31.3% of the error (11.5% of hits). Per fight, the second half's off rate is the higher in 34 fights and
the lower in 23 (sign test p = 0.18; hold-outs 8 against 3). The first 10 s' off hits are mostly one buff the log's
way (41.6%, against 27.8% later). Consistent with a clock that drifts (the hidden holds accumulate, cast placements
compound), but long fights are also the hard ones (04d4, a9d7, 0c14 are off everywhere), and per fight the trend is
not significant. **Next check:** within long fights only, off rate against the placed hidden holds' running total
(holds.ts) rather than time.

### 8. The remaining ×1.5 band (1.6%; 6.9% of the hold-outs')

After the Empyrean combo (`bands.py`): 16 hits in a team-wide window with Liino's ultimate projectiles at ×1.5 (1cd1,
1d91, 9c6e: Typhoeus, Ardelia, Liino; 0.8%), as Cosmovoice's Amp would give: the known "the replay's Cosmovoice has
already ended" (Liino's Cosmovoice beats), now seen on teammates too (9c6e is the two-target fight); Alesh's ultimate
at ×1.500 in 5 of its 15 logged hits (a9d7, ad7f; 0.3%), ×1.00 in 5, others ×0.97–1.64 (a variant or a chance the kit
doesn't give); Ardelia's basic attacks (7 hits in 4 fights). **Next check:** `poise.origin` and the data's branch for Alesh's ultimate (as for
the Empyrean combo); `zmdlogs replay 1cd1 --kit-buff chr_0035_liino:cosmovoice_amp` at 37.9–38.8 s.

### 9. Fight-wide factors the offsets screen doesn't flag

The tight fight-operator factors are 2.3% of the error, 04d4's known ones (Catcher ×0.47, Snowshine ×0.962) for most;
not yet accounted for: 7910 Liino ×1.143 and af7b Liino ×1.161 (54% within 0.3%, below the screen's 60%), and
`zmdlogs offsets` lists c83c Si ×0.891 (its log reading ×1.00: timing, not a build). **Next check:** `efsim zmdlogs
fit-build 7910 --operator Liino` (and af7b).

## One-sided landings

54 non-stage fights (9c6e, two targets, left out): mean |matched| 2.67%, replay-only 2.22%, log-only −1.46% of a
fight's logged total, gross one-sided 3.82% (net +0.79%). By kind, the gross: replay-only cast tails 21.3% (591
landings, 50 fights), log-only "a landing the replay didn't land" 19.4% (127, 30 fights), replay-only "no cast"
(triggers, bursts) 17.6%, twins (one landing on both sides, keyed or placed apart) 21.7%, cast gaps 6.3%; by nature
kit hits 50.5%, trigger hits 24.0%, bursts 16.4%, Combustion ticks 5.6%. Flags: inside a slow-down 19.0%, past the
operator's next cast 6.6%, the fight's end 4.5%, near a cut 3.4%, an away edge 2.9%. The top five fights carry 25.2%
(9a80, 4d60, d774, 7910, c83c), and by operator and key the largest are Si's combo final replay-only (5.6%, 2 fights),
Zhuang Fangyi's Sunderblade strikes log-only (4.2% + 3.3%) and replay-only (2.6%), Arcane's INT combo seal finisher
log-only (2.8%). A replay-only and a log-only landing of one operator 1.5–3 s apart with values within ×1.5 (twins past
onesided.ts's TWIN_MS) are 0.35% of a fight gross: the twin window isn't hiding a large class. Fight-level, the
one-sided share goes with bosses with phases (7.2% against 2.1%: the away stretches, already modelled), not with the
parser version, the import date (rank correlation 0.07), the fight's length (0.13) or any one team member. These
match the previous rounds' kinds ("Fight totals", rounds 3–4); no new kind stands out.

## What doesn't concentrate

- **Generic hit features don't predict the error across fights.** The tree fitted on one group explains R² 0.007 and
  0.039 of the other's |ln r| (each fight's own mean explains 0.12 in sample; the shuffled control −0.02 to −0.03).
  The lasso's coefficients stable across both folds are only the difference kinds (a listing difference raises the
  error, none lowers it), Zhuang Fangyi and Chen Qianyu. The error is in operator × mechanism pairs, not in hit kinds.
- **Crit flags:** flipping the logged crit fits 32 of 7,565 off hits (hold-outs 6 of 624): the log's flags are right.
  Hits whose crit the log doesn't give are 10.9% of hits and 18.4% of the error (off rate 33% against 27%), and their
  crits inferred from layers carry 4.0% at an off rate of 50%: a small lead inside candidate 2 (layered buffs), not a
  crit question.
- **Slow-downs, holds, cuts:** inside a slow-down off rate 33% against 28% (11.4% of the error); near a placed hidden
  hold 24% against 30% (lower); casts the replay flags as a legal cut (`cuts`) or inside uncuttable frames (`inside`)
  are 1.6% of hits and 5.2% of the error (off rate 40%), `forced` 4.2% (the Empyrean combos, candidate 1): real but
  small; the landing's frame against the logged time (|dt| ≥ 50 ms) no higher than the rest.
- **Time since the cast started:** off rate 25% in the first 0.5 s to 40% past 4 s, the tail being channels and
  ultimates; the shuffle keeps most of the error share.
- **Fight provenance:** parser version, import date, refreshed or not, the fight's length, the enemy (non-stage) and
  the stage: no association beyond the fights themselves (within-fight shuffles reproduce them).

## Hold-out confirmation (aggregates only)

`node scripts/probes/stats/holdout-aggregates.ts --holdout` (after the Empyrean fix; group totals only, two stage-like
fights left out by its median rule): off rate 12.4% (development 27.0% the same way); off error by first explanation:
one buff the log's way 34.0% (development 21.7%), unexplained 26.1% (35.6%), listing + alternatives 17.5% (14.1%),
alternative reading 11.5% (16.1%), boundary buff 6.4% (2.0%), Corrosion 2.7% (9.2%); crit flip fits 6 of 624;
boundary off rate 29.9% against 9.0% (41.2 / 23.4%); first 10 s 12.0% against 12.5% after (12.7 / 28.3%), second half
higher in 8 fights, lower in 3; the ×1.5 band 6.9% of their off error (1.6%), ×1.3 1.6% (6.6%). So candidate 2 is the
hold-outs' largest share too, candidate 6's marker holds, candidate 7 is weaker there, and the ×1.5 band (candidate 8)
is relatively larger in the hold-outs: the next hunt for a variant key should go through it.

## Next checks, in order

1. The ×1.5 band's remaining groups: Alesh's ultimate by `poise.origin` and its chance branch; Liino's ultimate windows
   in 1cd1, 1d91, 9c6e (Cosmovoice's Amp end).
2. The one-buff list (candidate 2) by size, each with `zmdlogs differences --what`: Si's ultimate Amp (9c0b), Gilberta's
   weapon Arts DMG, Arcane's Susceptibility layers and Will burst buff.
3. The two "ready" weapon buffs' consumption in the data (candidate 3), then Chen's d4fb ultimate.
4. `zmdlogs fit-build` for Liino in 7910 and af7b.
5. Drift: off rate against the placed holds' running total in long fights.
