# Open problems

One entry per accuracy problem not yet explained: what the logs show, what
is **ruled out** (with the evidence), what is **still possible** (every
candidate not yet tested or not yet excluded, however unlikely), and the
**next check**. A problem leaves this file only when its cause is found,
or when it's settled as out of scope (with the reason). Diagnosis reports
(the agents', and our own) update it: each names what it ruled out *and*
what it left standing; a candidate goes from "still possible" to "ruled
out" only with evidence. The accuracy plan says what was done; this file
says what isn't known.

A stated cause cites the check that showed it (a command, a script, a
count); without one it goes under "still possible" (round 3: a guess
written as a finding sent a Stagger diagnosis the wrong way). The first
steps of a diagnosis, before hunting a mechanism: `efsim zmdlogs groups
--operator <op>` (the operator's mismatches split into team-wide, no
landing and own, by skill and by what the log and the replay disagree on)
and `efsim zmdlogs differences` (does the damage side with the log's
listing or with the replay, per thing they disagree on); then `zmdlogs
casts`, `replay`, `stagger` for the fight itself, and `npm run measure`
for each idea (docs/design/tests.md "Measuring a change"). An operator off
by one factor on most hits: `efsim zmdlogs fit-build <fixture> --operator
<op>` first (attribute nodes, weapon level, food), so a build offset
doesn't hide a kit error; its fit goes into the fixture's
`buildOverrides`.

Started 2026-11-11 (the owner: keeping a record of what hasn't been ruled
out is necessary, not only of what has). Hold-out logs aren't debugged, so
none appear here.

## Arts Intensity: what the logs settle and what they leave (2026-11-16)

The owner asked whether the engine's Arts Intensity handling is right (it
carries the Grizzled Edge and Arts Intensity gear advice for Estella).
Every status hit of the 79 development logs (1,424 hits; hold-outs
skipped) was compared with the engine's reading at its landing, with the
source operator's AI from the engine's scale part. Details:
combat-mechanics §3.7.

**Ruled out:**
- A wrong damage coefficient: exact matches at AI 0–287 for bursts (179
  hits) and reaction hits (58), 0–182 for Combustion ticks (182), 0–163
  for Lift (81), 31–209 for Breach (11), 119–180 for Crush (9), 0 and 98.7
  for Shatter (11, Estella); logged ÷ predicted shows no slope against AI
  (within ±0.01 per 100 AI for bursts, reactions, ticks and Lift; ±0.03
  for Shatter). The stat hint has one `{Damage}` value for every kind.
- A wrong strength curve: Electrification exact at AI 0–287.4 (47 of 53
  instances), Breach at 31–209 (9 of 21; the rest below), 2,110 plain
  matches under Corrosion from appliers with AI > 0 (up to 287.4).
- The wrong owner: 81 reactions and bursts whose consumed infliction came
  from an operator with a different AI fit the trigger's AI exactly;
  Shatter takes the shattering operator's AI (a9d7: Estella's Shatters of
  Deepfin's Solidification sit at her Lift's ratio, not ×1.70).
- A missing scaled effect: the stat hint lists only damage, strength and
  Lift / Knock Down Stagger; durations aren't on it.

**Found and fixed:** Breach's own hit saw its own new DMG Taken (×1.29–1.44
too high; no Breach hit had a plain match). Now it sees no Breach: plain
0 → 7, assumed 0 → 4, fallback 17 → 6 (combat-mechanics §4).

**Checked with the logged givers (2026-11-16):** since the refresh every
development fixture's effects but 40d9's and 4e5e's carry their giver
(`source`). Of 3,505 kit hits listing an Electrification where the
replay has one, the log's giver is the replay's applier in 3,497; the 8 others
are all 3aa6 (log Perlica 7, Zhuang Fangyi 1, the replay Arclight).
At an agreeing giver each (level, AI) the replay has gives one logged
strength, but for its level III at AI 0: 0.16 (3aa6, d774) and 0.24
(3aa6) besides 0.20, so the replay's level differs there: probably
§3.7's 6 instances off the curve (levels or appliers). The replay has no
Electrification at 237 hits that list one (4d60 96, 9090 41, 4bfc 37, fc63 26,
00ae 16, others ≤ 7). Breach can't be checked this way: the hit export's
enemy facts list reaction statuses, not physical ones (scratch check,
`hitRecords` landing.enemy).

**Still possible:**
- Pogranichnik's Breach strength: 12 of 21 logged instances carry his AI
  ± one Fervent Morale layer (+8) against the replay's (c4f3, a9d7, de6a,
  10df, d4fb). In c4f3 the battle skill's own SP layer counts for the
  strength (71150: hit lists 2 layers, strength 3) though not for the
  hit's listing; elsewhere the replay has a layer the log doesn't. A layer
  timing (talent bank, expiry) rather than the curve. Next check: the
  strength read after the battle skill's `beforeDamage` SP trigger, against
  each instance.
- Shatter's coefficient itself is checked at two AIs only (0 and 98.7);
  it shares the `{Damage}` value with the kinds checked to 287.
- Lift / Knock Down Stagger × (1 + AI/200): the logs show no Stagger of
  their own (4e5e 12219's one exception open), so nothing to scale.
- Ember's status hits in 04d4 are ×1.0226 at AI 0 and 12 alike (Knock
  Down and Shatter): AI-independent, the ×1.023 her other hits there have
  too (accuracy plan: Ember low in every log, uniformly per build).
- Multi-target logs (10df, 8273) and a9d7's fight-wide factor leave their
  Breach hits as mismatches.

## Buff timing leads (the buff timing report, 2026-11-15)

**Shows:** `efsim zmdlogs timing` (docs/design/data.md, "The buff timing
report") over the 27 development logs: of 4,487 fallback and mismatch
hits, 1,209 fit one kit buff toggled (at stake 1.80M), 148 only a pair,
3,130 none (19.66M: most misfits aren't timing). Hints, not fixes ("Fits
need a mechanism"). The top runs, by damage at stake (|logged − engine|):

1. **Yvonne's MI Security ATK** (suit_criti01.atk), 5082: absent in the
   engine 45.1–48.7 s (19 hits, 418k; its nearest instance 7 s away), and
   ending 3.1–3.7 s early at 38.1 s (5 hits 41.2–41.8 s, 88k); the log
   lists it at all 24, none against. *Mechanism candidate:* its trigger is
   on Yvonne's crits, and her combo and ultimate hits from 41.2 s have no
   crit flag in the log; the replay counts those as non-crits, so the set
   never re-stacks. Plausibly part of 5082's Yvonne −23% (journal
   2026-11-15).
2. **Si's ultimate Amp**, 9c0b: absent in the engine 13.8–25.4 s on all
   four operators (47 hits, 402k; listed at 47/47; nearest instance
   46.6 s away). *Mechanism candidate:* the log's hitless Si ultimate at
   7.0 s (a cast event): the replay doesn't make it, or its Amp doesn't
   land; Arcane's ultimate lasers at 21 s are ×1.200 low.
3. **Typhoeus's Barrage Array** (Nature Burst DMG Taken), 1d91 and 9c6e:
   "starts early" (7 hits, 80k) and "ends late" (4 hits, 36k) on the same
   windows (1d91 9.8–16.2 s and 51.5–57.5 s): the hits fit without it
   across the engine's whole window, the log lists it at none. No
   mechanism near (its source is the combo's first arrow). **Closed
   2026-11-15: the log check's, not the engine's.** The kit buff had no
   `gameBuff`, so the check counted the logged
   buff_chr_0034_typhoea_combo_enemy_debuff as a log-only buff on top of
   the kit's (Typhoeus's bursts ×1.07 over the log), and toggling the
   kit's off "fitted". The replay's own landings of her bursts under it,
   with it, match the log exactly (1d91 11 of 15, among them the
   11.4–14.4 s hits above; bdf2 4 of 5; fc63 14 of 30; 00ae 7 of 13); the
   log lists it there (the "lists it at 0" above counted the kit's name).
   With the `gameBuff`, 1d91's listed bursts go from 11 mismatches to 12
   plain. Left: 1d91 at 55.5 and 56.7 s fit without it exactly (the log
   stops listing it ~2 s before the engine's end: the boss leaving the
   6 m area?).
4. **Laevatain's Forgeborn Scathe basic DMG** (wpn_sword_0006.valid), 9c0b:
   absent in the engine 32.0–34.8 s (5 hits, 71k), listed at 5/5. NO
   MECHANISM: its trigger is her ultimate cast, and none is within 20 s
   before.
5. **Gilberta's Arts Susceptibility**, 489c, 4360, 9847: 42 hits fit the
   log's values, not the engine's (59k): a value, not timing. No mechanism.
6. **Liino's Vocalist Stance ATK**, af7b: absent in the engine 1.5–53.8 s
   (245 hits, 56k, listed at all); the candidate is her logged hitless
   battle skill at 1.6 s, which the replay doesn't make (af7b's placement,
   "Buffs through stops" below). Ambiguous: vocalist_linger and
   cosmovoice_atk fit the same hits (same values).
7. **Laevatain's Hot Work Heat DMG** (suit_fire_natr01.heat), 79cc and f879:
   ends 2.2–4.8 s early (6 hits, 46k), and absent in f879 107.5–108.6 s (3
   hits, 20k), listed at all. *Mechanism candidate:* its trigger is on
   Combustion (reaction), and her Combustion ticks come at 100.0 and
   106.5 s in the windows: a tick (or a re-application) may refresh it in
   the game, the kit's trigger only the application.
8. **Estella's Physical Susceptibility** (combo), c4f3: ends 2.6–2.7 s early
   at 34.3 s (2 hits, 26k). *Mechanism candidate:* Gilberta's ultimate
   stop starts at 34.5 s and Pogranichnik's combo slow-down ends at 34.4 s,
   at the engine's end: a hold (B11) of another length.
9. **Gilberta's Delivery Guaranteed Arts DMG** (wpn_funnel_0011), 4a64: ends
   2.9–4.4 s early at 23.9 s (14 hits, 23k, listed at all). Three ultimate
   stops (Si, Rossi, Gilberta) run 24.5–26.6 s, 0.6 s after the engine's
   end: a hold candidate if its end really falls inside them (outside the
   report's ±0.5 s, so marked NO MECHANISM).
10. **Liino's Medicant ATK** (wpn_lance_0014.atk), 1d91: "starts early" by
    0–3 s in 11 runs (78 hits, 20k), "ends late" in 8 (44 hits, 12k): each
    engine start is at one of her logged hitless battle-skill events (the
    stance's beats, `ticksLoggedAs`). *Mechanism candidate:* the heal that
    triggers it lands after the beat (its projectile), not at it. The log
    lists none of it (1d91 doesn't list Liino's buffs), so only the damage
    says so.

Also: Si's Amp carried past its end by Combustion's snapshot (db87, c83c,
6 hits; "Ink Melt logs" below); Arcane's Imposing Champion Arts DMG Taken
ending 2.6–3.6 s late in 9c6e (7 hits, 20k, no mechanism); Camille's
Vesperwings Susceptibility absent by the damage in e989 69.2–70.9 s (5
hits, 18k) with the engine's instance 61.7–89.3 s.

**Ruled out:** none of these yet (the report only reads).
**Still possible:** chance fits where two buffs' values fit alike (the
report lists them as "also fits"), and on small hits (±1 above 0.05%:
"coarse"); a run that fits "starts early" and "ends late" on one window
is one buff absent across it (3 above), not two shifts.
**Next check:** 1 (replay the unknown crits' bound), 2 (why the replay
skips the logged ultimate), 7 (whether Hot Work refreshes on ticks).

## Rossi's ultimate ×1.090 (9a80) and ×1.081 (2fd9)

**Shows:** every ultimate hit low by one factor, crits and non-crits alike
(9a80: 16058 logged vs 14727, crits 46567 vs 42708). Matches in 4e5e,
489c, 4a64.

**Ruled out:** the kit's per-hit scale and hit count (SkillData and
SkillPatchTable; 27 per cast, as logged); the crit zone (the crit ratio is
exactly the engine's ×2.9); her potential 5 (4a64, P5, matches); the ult's
crit buff timing (fixed: the slow-down rule); the blackboard's
`atk_scale_crit_fire` (not the ultimate's); seven foods (the six ATK foods
and the stew).

Also ruled out (2026-11-11, round 3): Corrosion in 9a80. The replay's
level 1 (shred 19.31) fits: physical hits at 25.4, 29.2, 31.6 and 32.5 s
match exactly, where a level-2 ramp would be ≥24.8 by 29.2 s; no level or
ramp gives the ×1.09 on fire. Rossi's ×1.33 after 24.97 s is crit-only
(crit zone 1.5 in the replay, 2.0 in the log; non-crits match).

**Still possible:**
- Gilberta's susceptibility (found: buff_common_affixes_vulnerable_spell,
  rate 0.30 × (1 + 0.10 × n), n the enemy's Vulnerable stacks): the
  engine's n is 3 at her ultimate (landing frame 975), the log's 0.42
  means 4 (×1.022 of the ×1.09; ×1.067 remains). Round 4: the 4th stack is
  Rossi's Lift; two misses, either enough: (a) her combo is placed at
  frame 948 where the log implies ~946, so its Lift (frame 977) lands
  after Gilberta's ultimate; (b) at 7.807 s the log has a Lift and her
  combo consumed 1 infliction (48646 / 30023), the replay none (no enemy
  Arts Infliction from 2.04 to 9.46 s: Arcane's touch was element "enemy",
  a no-op without one; fixed 2026-11-12, the touch applies the Cryst her
  window's Corrosion consumed and the replay's Lift consumes 1 there). Her 32.489 s combo hit is the perfect-timing
  variant, consumed 2 in the log, 1 in the replay. Ruled out: the perfect
  hit's own Vulnerable rule (perfect and late predict the same there);
  a stack expiry (none before 34.9 s; the "3 then 2" at 31.60 s is a stale
  snapshot of Gilberta's combo's pre-state).
- Rossi's crit DMG at 22–25 s (found: buff_chr_0028_wulfa_combo_criticalrate,
  combo_3, crit_damage_increase_rate 0.5, 15 s): the replay's ends at
  21.8–22.1 s, the log's zone is still 2.0 at 22.13–24.97 s and 1.5 at
  25.37 s: the game's window ~3 s longer. Ruled out: other Crit DMG
  sources (no food, gear set or weapon line gives it; the ultimate's crit
  buff is 5 s). Round 4: the replay makes it once, at the cast (6.840 s),
  15 s raw, to 21.84 s; the world clock's stops to 22 s add ~0.8 s (two
  of ~0.42 s), all to 25 s ~1.7 s. Also ruled out: a full 15 s refresh
  from combo_3's second CreateBuff (frames 212–215, 13.90 s: it would run
  to ~28.9 s); stops alone; hit-stops as world pauses and a longer combo
  slow-down curve (d572's window matches the replay to 0.12 s with as
  dense hits); Si's ultimate placement (placed at 27.1 s from its hits,
  logged at 25.47 s, 0.5 s after her combo: the press during the combo,
  the ultimate starting at the combo's end; its first hit at 29.20 s is
  the kit's offset from 27.1 s; either way after 25 s). Still possible: a
  stop or freeze only 9a80 has between 6.8 and 25 s; a refresh at frame 212 with another
  timer; the qte_ring state at the cast (frame 0 jumps to 212 without it);
  the evidence itself (22.13 s is unquantified, 24.97 s matches without
  the buff, so the window's end is weaker than ×2.0 suggests). 2fd9 and
  489c lean the same way (0.4–1 s past the replay), noisily.

**Next check:** the enemy's inflictions at 2–9.5 s in 9a80 (the source
of the 7.8 s one); the reaction-level fix (round 4) may change the
consumed counts; every stop and freeze in 9a80 from 6.8 to 25 s against
d572's (where the window matches).

## Arcane's WILL combo touch: which element (in-game test 33)

**Found (round 6, 2026-11-12, implemented):** the touch applies the
element of what opened her window (`element: "window"`: the latest event
her combo trigger saw since the cast began, else the window's opener at
the cast; for a reaction, the infliction it consumed; for a window the
replay didn't see open, the enemy's current one). 9a80 plain 157 → 160,
mismatches 95 → 88, −30.7 → −23.6%; 3f78 plain 34 → 41; 489c, 4a64, e82d
closer; fixtures/ and the hold-out counts unchanged (hold-out mean
|damage| a little lower). Dead ends: the opener at the cast only
(`element: "event"`): 0eef −19.9%, the replay casts her combo before
Si's Cryo hit at the same ms; every event the trigger saw, before the
cast too: 1cd1 10 → 13.9% (a Nature 1.6 s before a cast the replay's
cooldown kept shut) and a hold-out log much worse.

**Shows (before):** the kit took the enemy's current infliction's
element; with none, nothing. The data switches on `EntityBB_consumed_type`.

**Ruled out (round 5, 94 touches in 30 logs):** "nothing when the enemy
has none": in 21 such touches a later consumer (Rossi's combo, whose Lift
needs a consumed infliction) consumes one, at 1.5–1.7× the replay's
consumed-0 value (9a80 7807; 3f78 8763, 50552; 4a64 9904, 57555; 489c
19734; 4f7e 8566, 86309); a fixed Heat (the switch's 0): b74c's next
burst is Cryst; the opener's *applied* element where it was a reaction
(b74c: Nature onto Cryst, then a Cryst burst). No touch has a current
element other than the opener's.

**Still possible:** the enemy's last infliction before the opener
consumed it (indistinguishable from the consumed element); the window's
first opener instead of the latest (no log tells them apart: every touch
with a current infliction has the latest's element); events while the
cooldown keeps the window shut counting before the cast too (only 1cd1,
where the replay's cooldown may be wrong); b74c's Cryst coming from Si's
combo or ultimate instead (the kit says they apply none). Not fixed with
it: e82d's replay landed a third touch the log hasn't (226 frames), which
applied Cryst (Arcane's own total +8 → +47%; gone since 2026-11-13: the
logged combo at 3896 ms is the one placed at 7033 ms, matched in the
world's time across the time stops between, Arcane −2.5%); the multi-target logs
move both ways (b74c +23 → +34%, c516 +131 → +159%, 4f7e −2.7 → +3.4%:
their replay already over-predicts).

**Next check:** in-game test 33 (latest opener against first, and the
consumed element).

## Arcane's mismatches as one group (2026-11-18)

**Shows:** Arcane had 908 mismatches of 5,575 hits in the logs the
scoreboard counts (all but the hold-outs), 866 after the two fixes below.
Grouped (scratch: `zmdlogs hits --json` over every log, each Arcane
mismatch against teammates' mismatches within 1.5 s at the same ratio
±1.5%, and the engine's modifiers against the log's listing per hit):

- **Stage logs** (8915 323, c6d8 200, 7b54 28, 6339 6: 557) and the
  fight-wide factor of **d9e5** (15: every operator ×1.12–1.20 from 4.4 s,
  Arcane ×1.116–1.134, Liino ×1.20; the old ×1.7–2.0 is gone): not hers.
- **Team-wide** (another operator's mismatch at the same ratio within
  1.5 s): 143 outside the stage logs (fc63 43, 1d91 26, 9c6e 26, 4d60 23,
  a7a7 9, 7910 9): Stagger windows (×1.3 runs: 1d91 70–72 s, 4d60 80 s),
  Typhoeus's shot count in fc63 (placement), Corrosion levels in 9c6e.
- **Teammates' buffs on her basic-attack strings** (only she attacks then,
  so no teammate shares the ratio), ~110: **ad7f 30** (Alesh's P3 team ATK
  after a Rare Fin the replay rolled; fixed: below), **1d91 ~50** (×0.965,
  ×0.929, ×0.983, ×0.894 steps: the replay's modifiers identical on plain
  and mismatched hits 0.2 s apart, i.e. an ATK layer ending in the game
  earlier; 1d91 doesn't list Liino's buffs: her Medicant layers, "Buff
  timing leads" 10; ×1.208 / ×1.254 at 70–72 s are that times Stagger's
  ×1.3), **af7b 16** (×1.131 at 61.8–63.4 s with Typhoeus and Ardelia
  fallbacks at the same ratio: Ardelia's Susceptibility after 60 s, "Teammates'
  enemy debuffs"), **db87 9** (Camille's talent-1 ATK, listed, absent in the
  engine: ×1.093 on Arcane, ×1.038 on Si), b6aa 9 (×0.98), 5082 2, f978 2.
- **Her lasers without a landing** (70 of 238 logged had none; 29
  mismatches): (a) a second Cluster Strike inside her own Gloompurge
  Arcana stop (players cast it as the strike makes it castable): fixed,
  below; (b) a second strike the replay never makes because an earlier
  final strike made two (fc63 47 s: Typhoeus's 4th shot replayed as her
  5th, "Typhoeus, Arcane, Liino, Perlica"; 9090 51–53 s); (c) a first
  strike the replay lands 2 s early because a teammate's ultimate stop is
  missing in the placement (db87 16.4 s: Laevatain's attack 5, lasers
  logged at 18.98 s after her ultimate, whose stop the placement lacks;
  9c0b 21 s): cast placement across stops, not her kit.
- **INT early-end lasers** (a7a7 23.0–23.5 s and 49.4–50.0 s, landed
  0.4 s and 1.1 s early): explained and pinned 2026-11-22 (below, Fixed
  4). Left: why `seal_again`'s frame 41 comes 0.2–1.1 s later than the
  hit + 41 frames + the world's holds (a7a7 3.86 s: +0.18 s, 20.54 s:
  +1.0 s, 41.19 s: its start logged at 42.13 s, 0.94 s after the hit;
  8915 6.79 s +1.1 s, 31.01 s +1.1 s; 00ae 79.05 s +0.48 s with no stop
  between; 00ae 7.41 s and d9e5 +0.0): not in the data decoded so far
  (the clones' skill `combo_skill_abilityentity_seal`, exclusive to its
  frame 150, would hold it 2–4 s, too long).
- **The combo's explosion and Imprisonment's natural end**: decoded and
  fixed 2026-11-22 (below, Fixed 4). Left: the seal's tick, where nothing
  between holds it, comes 5.4–6.6 s after the touch against 6.0 s (WILL;
  the ends: `efsim zmdlogs census --select 'event:combo_skill_seal_total'
  --operator chr_0032_lizhiyan --near 'cast:combo_skill$' --near-operator
  chr_0032_lizhiyan --window 5000,9500 --list`; the world's time from the
  touch − 4 frames to each end under every placed stop, logcasts.ts
  worldMs: median 6057 ms over 85 natural ends, 16 within ±150 ms of
  6133): 4d60 −0.55 s at 38.4 and
  57.1 s (its Susceptibility lane ends with it, ~6.1 s after its `since`:
  the whole seal ran short), 1d91 / af7b / fc63 +0.3–0.45 s. Ruled out:
  potentials and skill levels (`duration_will` 6, `duration` 4 at every
  level, no potential touches them), abilityEvents 8 / 1403 / 1601 (they
  cast the end but don't shorten the seal, whose child lane ends 0.5 s
  later), the touch's lag behind the seal (since → touch 80–210 ms
  everywhere). Still possible: hit-stops or the enemy's own time scale
  reaching the seal's timer in a way `useTimeDilationDt: false` doesn't
  say; the replay takes the logged end as a fact meanwhile. e9896c8d02be
  at 62.4 s: the combo pressed before her own ultimate (cast event
  62.06 s, Susceptibility since 62.41 s), placed after its stop at
  63.58 s; the logged end at 69.07 s is 6.66 s after the seal (her own
  stop didn't hold the tick) while its Susceptibility is listed to 70.93 s
  (held): with the end moved to the log's, its hits at 70.0–70.9 s turn
  log-listing fallbacks (Arcane, Si: plain 252 → 246).
- Small: 9c6e 51–52.5 s ×0.729 (its second target), cryst bursts without
  a landing (489c, 9a80), 1cd1's touch at 38 s (placement).

**Fixed (2026-11-18):**
1. Her lasers run on the world's clock (the "hits" action's `world`): the
   Cluster Strike lasers and the INT early end's are buff timelines
   (`buff_…_inaura_laser1/2`, `seal_finisher_wisd`), which the game runs on
   the world's time, so her own ultimate's stop holds them. a7a7 Arcane
   mismatches 28 → 19 (the lasers at 55.99–56.47 s now land within 4
   frames), 79cc, c779 +1 plain; scoreboard rows unchanged.
2. A buff only a chance path's hit applies is one the replay can't judge
   (buffreplay.ts `chancePathBuff`): ad7f Arcane 34 → 1 mismatches, Si 80
   → 100 plain, 4e36 plain 117 → 239. Development plain 47.3 → 47.7%,
   mismatch 19.8 → 19.6%; hold-out plain 62.1 → 63.3%, mismatch 7.6 →
   7.7%, mean |damage error| 13.5 → 13.4%.
3. (Tests 51 and 7, 2026-11-18.) Her Corrosion's own hit has Solemn
   Phalanx's INT Arts DMG, which the same infliction creates (abilityEvent
   126 comes before the game resolves the infliction into a reaction; Hot
   Work, on the reaction, stays off it): before-damage triggers on the
   infliction now run ahead of those on the reaction (timeline/landing.ts).
   a7a7 3.86 s and 8915 6.79 / 31.01 / 85.61 s now plain or exactly on the
   stage factor. And her second ultimate's Amp: the cast replaces
   Gloompurge Arcana's Amp with its own, gone by her next basic attack
   (00ae, 8915; was up to 10 s more), kit `int_amp_ult2`. 8915's basics at
   99–104 s ×0.84 → ×0.986 (the residue left).

**Fixed (2026-11-22, Imprisonment's end and the INT lasers):**
4. The seal's natural end isn't its end: the combo sets `trigger_time` =
   duration_final − 0.5 (SimpleCalcBB), and the seal's one tick
   (`triggerInterval trigger_time`, `waitFirstTriggerInterval`,
   `maxTriggerCnt 1`, buffEvent 1) casts `abilityentity_end`, whose
   explosion lands 14 frames later, 0.03 s before the seal and its child
   Susceptibility end. The kit cast it at the seal's end, 0.5 s late
   (kit `imprisonment` `every`, trigger `explosion` on its `buffTick`).
   Where nothing holds it the logged end is 6.0 s after the touch (b6aa
   5972 / 5961 ms, 1d91 5987 ms, 012a 5965 ms), and the Susceptibility's
   logged lane ends 0.5 s after it (4d60, b6aa, 1d91, af7b, fc63).
   abilityEvents 8 / 1403 / 1601 cast the same end when the holder goes
   (docs/game-data-format.md): none mid-fight. The replay takes the logged
   end as a timing fact (`ticksLoggedAs` on the seal, `endFollowsTick`,
   `childOf` for the Susceptibility): its explosions land within 0.1 s of
   the log's in 67 of 77 (was 10), within 0.02 s of the end event + 0.467
   in 82 of 83. Freezes don't hold the seal (`runsThroughFreeze`: b6aa
   19.56 s with Si's freeze inside ends on time, ad7f 3.91 s 0.37 s late
   where the replay had 2.4 s). INT: seal2 (the early end's window) ends
   with the tick (`early_end_window`); a battle-skill hit in the seal's
   last 0.5 s after the tick still casts `seal_again` (seal_listener lasts
   as long as the seal): its 12 s Susceptibility (`post_susceptibility_late`;
   8915 109.94 s, listed to the fight's end) and no lasers (the clones go
   at the end's frame 44). The early end's lasers wait on their own timer
   (`laser_wait`, 41 frames, `ticksLoggedAs`): the log's combo event 0–4
   frames before the first laser is the lasers' start (a7a7 5.41, 22.93,
   48.89 s; 8915 9.24, 33.44 s; 00ae, d9e5); a combo's own event is one
   within 1.5 s of it (buffreplay.ts COMBO_EVENT_MS, for skills a buff's
   ticks are logged under), and a due tick waits up to 1 s for one
   (TICK_HOLD_FRAMES). a7a7's lasers at 5.4 and 23.0 s land within 0.06 s
   (were 0.2 and 0.4 s off); at 48.9 s they start at the logged start, the
   log's batches at 49.37–50.01 s (one ms shared with every hit then) can't
   say more (were 1.1 s early). Scoreboard: development plain 52.0 → 52.7%,
   hold-out 67.3 → 68.7% (mismatch 6.7%, mean |damage error| 12.1 →
   11.9%); Arcane's mismatches 863 → 854.

The 8915 share of the stage logs (323) is the stage's own factor on her
hits (test 7: 238 of her 278 hits in its windows within 1% of it, as
Si's and Wulfgard's); after the stage, a ×0.986 on her hits at 92–103 s
and ×0.81–0.84 / ×1.10–1.21 steps at 104–112 s remain (not looked at).

**Ruled out:** her own buffs' timing as a group (`zmdlogs timing`: her
only patterns are funnel_0008 in 9c6e, 7 hits, and int_amp in 8915, a
stage log); her kit values on the matched hits (her plain matches cover
every skill); a freeze holding only the freezer's own debuffs on every
enemy (the experiment, 2026-11-18: 489c plain 367 → 353, b6aa 238 → 220,
7910 −17.6 → −20.5%, hold-out plain 63.3 → 62.9%; ad7f's Imprisonment is
the one case against).

**Still possible:** Imprisonment ended early by the events its buff
listens to (BuffData `buff_…_combo_skill_seal`: abilityEvent 8, 1403 and
1601 cast the explosion before the timer; undecoded), which would explain
4d60's 1 s; Imprisonment (and so the Doubles Susceptibility) not held by
freezes while other debuffs are (ad7f only); the INT lasers' batches being
the log's timestamps rather than the game's timing.

**Next check:** decode abilityEvent 8 / 1403 / 1601 (which event ends
Imprisonment early); then take Imprisonment's end from the log's
natural-end cast in the replay, as the reaction levels are; Alesh's own
×0.85 on every hit in ad7f (his build).

## Hard 27: every physical hit ×1.1125 low (2fd9, 99fb)

(Ember is chr_0009_azrila; this entry called her Azrila before 2026-11-12.)

**Shows:** Mi Fu's and Rossi's physical hits from the first one, with no
buffs listed (Mi Fu's attack 3 at 5143 ms: every zone ×1); Mi Fu's World
Splitter residual is the same factor; Ember ×1.044. One player, one
enemy (eny_0124_kltdcap_hdg027), Mi Fu P5 in both.

**Ruled out:** Mi Fu's kit (World Splitter exact in a27b, d5720); seven
foods; defense (×1.1125 needs DEF ≈ 79.8; 80 gives 1.1111); the level
(DEF 100 at every level); other variants of the template (all share it and
its born buffs; no other log hits it with physical or fire); a modifier in
the stage's DungeonTable entry (indie_hard027_s: paramList null); Ember's
×1.044 as an element resistance (no value fits).

**Found:** the enemy (EnemyTable alias of eny_0124_kltdcap, no attribute
modifiers) has physical resistance 20 (zone 0.8) in the data; the hits
need 0.89, resistance 11. Rossi's fire hits (8, weak) are ×0.890, as if
fire were 11 too (the data: 0).

Round 4, other Hard stages: no Hard-stage pattern. Hard 15
(eny_0058_agdisk_hdg015, data resistances 12): fire fits 12 exactly (233
of 234 hits), physical fits no single value and is one operator per log
(Akekuri in 012a, Alesh in 4e36), and its hits are low, not high; R = 11
gives 0 matches there. hdg005 (eny_0033_lbhunt, physical 0): no value
fits; Estella's hits with few effects match at 0. Control: Tower 15
(klbear, physical 20) peaks sharply at 20 (132 of 132 plain in 458b).

Round 5, Ember: not the source. Her kit, potentials (P3 in both),
talents, weapon (wpn_claym_0006) and gear give no team Physical DMG or
susceptibility; the factor starts at 5.1 s (Mi Fu) and 6.0 s (Rossi),
her first hit at 10.3 s; with her in 7e19 the physical hits are 1.0000.
Mi Fu's and Rossi's ratio is 1.1125–1.1130 whatever their other zones.

**Still possible:**
- An enemy-side physical term of eny_0124_kltdcap_hdg027 only (no other
  log has physical hits on it; 1d91's tower016 variant has none).
- Per-log operator factors on Hard 15 and hdg005 (Akekuri's, Alesh's,
  Estella's buffs), untested.
- Ember's own ×1.044: her ATK ~6% high in the engine (×0.9386 after the
  ×1.1125); P2's attributes (+3.8% ATK) don't fit. Aurora ×0.655
  (whatever the zones); Purrchena is level 1 in 99fb (a build input).
- A Hard 27 resistance setting outside the tables we read, or an enemy
  buff giving it (no longer favoured).
- Ember: 1.044 = 1.1125 × 0.9388, her ATK inputs ~6% high (a weapon
  level, nodes) on top of the same term.
- An unlisted team debuff (Physical Susceptibility) or a build input
  common to this player's operators (gear, food: 29 not scanned).
- The two factors (physical ×1.11, all-element ×1.044) being one term in
  different zones.

**Next check:** a log with physical hits on this enemy from another
player; Aurora's and Ember's builds.

## Hard 33's slug: debuffs the engine keeps don't act (7b54, 6339)

**Shows:** hits low by the engine's damage-taken and susceptibility
entries, which the log lists but the damage ignores (Jade Vessel's 0.12,
Arcane's 0.096 stacks, the affixes), in windows (7b54 12–20 s; 6339 from
10.5 s); a Laevatain power-attack hit_2 missing (6339; the pair is in
0206 and 3440); Combustion ticks the log doesn't have.

**Ruled out:** the slug's template (DEF 100, resistances 0, no born
buffs, no attribute modifiers); a damage-scaling shield (the number shield
zeroes whole hits); Stagger (the bar isn't empty when the buffs stop
acting); an additive damage-taken reduction (1 + 0.12 − r doesn't fit;
1 + 0.096k does).

Round 5, the slug's data (from extracted BuffData): the number shield
(numshield_hdg033: 1, set to 3 on a signal buff, one less per qualifying
hit) blocks hits through buff_common_eny_numshield (−9999 in the product
zone: a blocked hit deals 0); at 0, numshield_zero ends the shield buffs
by id. Its two FinishBuffAdvanced end numshield_destory (on itself) and
the stage's poison on the team. Every finish names buffs by id; no tag
query. Jade Vessel's enemyvul and Arcane's funnel stacks carry no tags.
Neither log has a zero-value hit or lists a shield or Stagger buff. In
6339 Jade Vessel's entry drops out of the hits' lists at 10913 ms (last
at 10349); in 7b54 it's listed to 35.5 s.

**Ruled out:** the shield (or its end) ending the debuffs, by id or by
tag; Stagger at 10.5 s (6339: bar 22 → 45, rising) or at 12 s (7b54).

**Still possible:**
- Jade Vessel's replacement by priority key (stacking type 11,
  `dmg_taken_up`, max 1) keeping another instance than the engine's.
- The hits' effects lists being sparse in these logs (entries vanish and
  return), so "listed but not acting" reads presence wrongly.
- Shield-blocked hits hidden in a gap (6339: none from 11.3 to 14.6 s).
- A Stagger in 7b54 from ~19–20 s (bar 7 at 19.0 s, no sample to 29.5 s).
- buff_common_mini_poise_break_slwood and numshield_destory carrying an
  effect (the latter unread; the former an interrupt with 4 s
  immobilization, read in round 1).
- Hits zeroed by the shield explaining 6339's missing hit_2 and
  Combustion.

**Next check:** none planned: such logs are to be avoided. If one is
needed, the priority-key replacement of Jade Vessel's buff.

## Liino's battle-skill presses during Vocalist Stance (every Liino log)

**Shows:** a press every 3–4 s, no hits; the stance and its volleys go on.
Replayed as presses: 1d91 +113%, 1cd1 +96%, a7a7 +59% for Liino.

**Ruled out:** replaying them as full battle skills (60 projectiles the
log hasn't); players pressing every 3–4 s (the owner, who plays her,
2026-11-13: a press in the stance is rare); a beat re-opening or
refreshing her volley window (the data: spelllnfliction_check and
_extraattack are clips of the battle skill's own action, frames 45–1691,
created once per cast; the beats, normalskill_music_damage's soundwave
launches, and normalskill_music_tag create neither; extraattack's 10 s
interval is per instance, so only a real cast restarts it); the teammates'
losses when the events were skipped (a7a7 322 → 261 plain) being Liino's:
the recasts drained the team's SP, so Arcane's press at 37415 ms, 3.1 s
before the battle skill placed from its hits at 40523 ms (351 ms later in
the world's time, across two ultimates' stops), couldn't start and wasn't
made; skipped, the SP was there and it was made as a second cast, landing
a Corrosion at 39.4 s the log hasn't. A logged cast now matches a placed
one within 2.5 s of the world's time (worldMs), which also removes e82d's
extra Arcane touch.

**Done (2026-11-13):** they are the stance's beats (the owner): the kit's
vocalist_stance has `ticksLoggedAs` its battle skill, and the replay reads
such an event while its own stance is on as a beat: no cast, no SP; the
beat comes at the event (a tick due within half an interval is held to
it or brought to it; the next comes 3 s on), since bdf2, 0eef, d774 and
4bfc list one more layer of her weapon's heal ATK on teammates after each
event. Liino's damage error: 1d91 +113 → +2%, 1cd1 +96 → +27%, a7a7 +58 →
+2%, 8318 +230 → −7%, 4bfe +121 → +7%, 7910 +31 → −7%; teammates
unchanged but 1d91 (Typhoeus 162 → 152 plain, Arcane 63 → 51, Ardelia
3 → 4).

**Still possible:** 1d91's damage wants one more heal than the beats give:
Arcane's hits fit 2 weapon layers at 5940 ms (a heal near 5.9 s, before
the event at 6255) and 3 from 6797 to 10024 ms (another after it); 1d91
lists none of Liino's buffs, so only the damage tells; the recast reading
gave both (its own tick, then the recast's). A heal at the cast besides
the first beat (the data's unused normal_skill_projhit_health heals the
team) would fit 1d91 but not bdf2's or 0eef's listing (one layer after
the cast). A real End Stance press in a stance is read as a beat (rare,
the owner).

**Next check:** in-game test 103 (a) only (End Stance); 1d91's extra heal
if another log without Liino's buffs listed shows it.

## Liino's stance ATK ends early in 0eef and 1cd1 (the 5 s linger)

**Shows:** the team ATK of Vocalist Stance leaves teammates' hits long
before the stance's 60 s, with no End Stance in the log (no log has one):
0eef at 8739 ms (cast ~760 ms; beats at 760 and 4187 only, her combo at
7570), and the next teammates' hits are ×0.934 of the engine's (it keeps
the stance, or its 5 s linger); 1cd1 at 34388 ms (last beat 34285; her
ultimate events at 37948 and 41265), and from +4.6 s on Typhoeus ×0.917
and Arcane ×0.839 of the engine's, with no Liino ATK listed.

**Ruled out:** players cancelling and recasting the stance for its ATK
(the owner's point, 2026-11-13: no log has an End Stance; the logged
"presses" are beats). The data's linger (`finish_duration` 5 s) doesn't
add to a new stance's ATK, so there's nothing to gain from it.

**Ruled out (also):** her combo ending the stance (its description: it
doesn't cancel the stance, the owner 2026-11-13; the kit resumes it).

**Found (haiku, 2026-11-13):** 1cd1's stance ends at her ultimate (cast
37948 ms, its projectiles 38725–39580 are real damage; the ultimate leaves
no linger), so the ATK going at 37974 fits. But Cosmovoice's ATK and Amp
never show on anyone (no beats either; dbae logs them, same parser), and
teammates' hits are a steady ×0.917 / ×0.838, as without them. Both
endings come in the fight's last seconds: 0eef ends at 10030 ms (ATK gone
1.3 s before), 1cd1 at 42702 ms (4.7 s after). The ATK auras are team-wide
(AuraAction auraType 1, no radius; only her talent's shelter has 5.5–6 m),
so distance isn't it.

**Found (sonnet + check, 2026-11-13):** no end-of-fight effect (last-5 s
mismatch rate 34%, as elsewhere). The real pattern: Cosmovoice's buffs
(team ATK buff_chr_0035_liino_atkup; Amp logged as
buff_common_affixes_enhance_natural / _pulse) are on teammates' hits after
her ultimate in 4bfe, 7b4e, 4bfc, d774, dbae and on none in 1cd1, 1d91,
a7a7, c6d8, d9e5 (19–80 teammates' hits each in the 2.6–15 s after). Not
Vocalist being on at the cast (4bfc: on before, buffs after; 1cd1, a7a7:
on before, none after). The engine gives them in every log.

**Found (sonnet, 2026-11-13): mostly the log's listing.** In a7a7 and
c6d8 teammates' hits after the ultimate match the engine plainly with
Cosmovoice's buffs (a7a7 Arcane 27/29, c6d8 Zhuang Fangyi 20/24): the
damage has them, the listing drops them (and Vocalist's ATK with them at
the cast). 1d91: a standing offset before and after (Arcane ×0.894 /
×0.929), not a loss at the ultimate. d9e5 (the one log of parser v58):
teammates ×1.14 before and after. Only **1cd1** lacks something in the
damage: ×0.917 / ×0.838 from 39036 ms, with Cosmovoice's Amp seemingly in
it (with Amp 7839, without 5217, logged 7187), so about the ATK, though
Arcane's ×0.838 is below what +0.16 ATK alone explains (≥ 0.862).

**Ruled out (also):** her ultimate cut short (she casts only its own
events after it in all 10 logs); who's controlled; potential, skill
levels, weapon, enemy; the beats. The engine stays as it is for a7a7,
c6d8, 1d91.

**Still possible:** for 1cd1 (P5, fight ends 4.7 s later): a real loss of
the ATK (or part of the Amp); its weapon layers (up to 11 on Typhoeus,
see the next entry) changing at the ultimate; for 0eef: Liino down or off
the field (HP and swaps aren't logged); the log dropping Liino's buffs
from the listing when her ultimate replaces Vocalist (a7a7, c6d8, 1cd1,
1d91); whether the 5 s linger
exists (0eef: if End Stance-like, the ATK went at once, against it; no
other log has teammates' hits in the 5 s after a stance's end); why the
engine still has Liino ATK in 1cd1 after 39 s.

**Next check:** 1cd1 together with the weapon-layer entry below (its
Typhoeus carries 11 layers just before); 0eef none planned.

## Liino's weapon: more than 4 layers listed on one teammate (test 25)

**Shows:** buff_wpn_lance_0014_damageup listed up to 11–13 times on one
hit (1cd1's Typhoeus 3–11, a7a7's Arcane up to 10).

**Settled (haiku + check, 2026-11-13): the damage fits the cap of 4,
the listing over-counts.** 18 Liino logs, ~4,500 teammates' hits where the
engine has 4 layers: those listed with 8–12 still match the engine
exactly at the same rate as those listed with 0–4 (e.g. listed 9: 118 of
238; listed 3: 360 of 691); 11 real layers would put them ~20% higher.
Log/engine ratios peak at 1.00, no peak at more layers. The cap is per
recipient, shared by every heal source (per-source caps would show steps
past 4; none). Rises come within 4 s of her heals, expiry 20 s after
(median 19.9 s). The listing errs the other way too: 1d91 lists none and
fits 4; Ardelia lists 1 in 1cd1 and fits 4. (On 2026-11-13 the lead read
1cd1's fallback matches as support for 11 layers: wrong, a coincidence of
the log's other listed buffs.) Other stackingType-11 buffs (wpn_sword_0012,
cap 2) are listed up to 12 times too: a log habit.

**Ruled out:** the listed count in the damage; the buff's own default cap
(2); a cap of 4 per heal source.

**Still possible (not the weapon):** 1cd1's team-wide step at 24.0–24.6 s
(×0.936 → ×0.820 for Ardelia, Arcane, Typhoeus alike) and Typhoeus ×0.820
→ ×0.917 at 39.0 s; the engine giving Typhoeus's ultimate hits no layers
(37974, 41265 ms); c6d8's engine values ×10 off on every hit.

**1d91's Ardelia (2026-11-18): her layers come slower than the engine's.**
118 of her 130 hits mismatch, all with the engine's Liino stance ATK and
4 Medicant layers (the log lists none of Liino's buffs there). Her first
hit (6.0 s, 1 layer) is exact; the ATK% her later hits need with every
other zone the engine's (scratch: logged ÷ reading × the reading's ATK
÷ her panel's): +0.156 to 18 s (stance + 1 layer: the same 5287 at 12.0 and
16.6 s, while the engine goes to 3 and 4 layers), +0.100 at 23–32 s (stance
only: the layer ran out at 20 s), +0.212, +0.268 at 35–49 s, +0.324 (4
layers) from 51 s. Typhoeus fits 4 from 10 s and Arcane from 17 s (both
had more than the engine before), Arcane fewer again at 53–70 s
(×0.965 → ×0.893). So the heals reach the three at different times.

**Ruled out (1d91's Ardelia):** her build (the hit at 6.0 s is exact; the
pattern follows the layers, not a factor).

**Still possible (1d91's Ardelia):** the stance's heal being the
soundwave projectile's area (normal_skill_soundwave_projhit, an AOE
HealAction): teammates out of its reach get no heal and no layer (not
modelled: positions); a heal on a teammate at full HP giving none.

**Next check:** 1cd1's step at 24 s (sonnet); the log check's fallback
should not trust stackingType-11 listings' counts; whether other logs
without Liino's buffs listed show a teammate's layers lagging like
1d91's Ardelia.

## Ardelia's Wooly Party: a random hit count (test 96)

**Shows:** 7 sheep hits in 4e36 and 3 in c3c7 (her only ultimates that
hit in our logs), against the engine's 11 below P3 (14 from P3), which
assumed the 0.3 s per-enemy cap is always reached (until 2026-11-13).

**Done (2026-11-13):** the count below is now the kit's (`landedCount` on
the sheep hit; docs/design/damage.md "Damage distributions"): expected crits deal
each planned landing's damage and Stagger × E[N] / L (6.1 / 11, 8.6 / 14),
the distribution counts a cast's sheep as a random sum, rolled crits draw
the count (stream `landed`) and land that many at random. The example went
from 152,724 to 114,744 (the mean; standard deviation 17,650; 5–95%
≈ 83,975–142,039). Log replays land the sheep the log shows and drop
the cast's other planned landings (2026-11-14, below). Left: the Stagger
at E[N] / L is an expected value of a
threshold effect (Stagger nodes), and every planned landing still fires a
hit event at expected crits (a trigger on her ultimate's hits, from gear or
a teammate, would fire 11 / 14 times, not N).

**Ruled out:** a fixed count: the sheep fly at random, not aimed (the
owner, 2026-11-13), so the count varies cast to cast.

**Counted (2026-11-13):** 21 ultimates in 18 more ZMDLogs battles
(screened from her profile, not imported; IDs in the session's scratch
folder) and our 2 logs, sheep hits on the main target per cast:
- below P3 (engine 11): 2, 3, 3, 4, 5, 6, 6, 7, 7, 8, 8, 8, 9, 9: mean
  6.1, median 6.5, never 10 or 11 (×0.55 of the engine);
- from P3 (engine 14): 4, 8, 8, 9, 10, 10, 11: mean 8.6 (×0.61).
One more cast (Hard 32, several enemies, potential not exported) hit
nothing. Hits on one enemy are 0.2–0.45 s apart (the 0.3 s cap, roughly),
spread over 2–6 s; towers 15/16 (large bosses) and smaller enemies alike.

**Still possible:** enemy size mattering (too few casts per enemy to
tell); the counts being a small sample (14 and 7 casts).

**Impact:** small. She's a support (the owner): teams run her for her
effects on others, not her own damage. What it can move: the search
valuing her ultimate's damage too high and timing it for that rather than
for her support.

**Next check:** more Ardelia ultimates (logs to import, or the owner's
counts); low priority.

**Her own damage in the log replays (opus, 2026-11-14):** a sonnet
diagnosis found her per-log errors (5082 +204%, af7b +158%, 4e36 +199%,
c3c7 +70%, 9c6e +57%) to be the log check's, not the engine's. Verified
and fixed, three log-check problems and one fixture problem:
- *One ultimate placed as several casts.* The sheep fly at random, so
  they miss their slots' frames; a cast placed from them was superseded by
  any later cast of hers (her combo's misplaced bomb in 5082, an attack 3
  in af7b), and distinctCasts didn't merge casts from one key: 3 casts in
  5082, 4 in af7b, 14 sheep each. Now an ultimate isn't cast again within
  its action (logcasts.ts `sameUltimate`, and distinctCasts merges an
  ultimate's casts from one key).
- *Her combo's bomb split from its projectile across time stops* (5082:
  6.4 s apart across Yvonne's ultimate and her own; 9c6e: two bombs at one
  time, the second at half, another enemy's). Now joinable and choose's
  window count world time, every stop but the cast's own; the placement
  also takes the stops of logged cast events nothing placed is near
  (Yvonne's hitless ultimate). Fixed on the way: 0c14 and 489c Wulfgard's
  combo 2 ticks across a stop (an extra combo each; 489c's combo 3 perfect
  hit is placed as combo 3 again: choose takes the latest cast whose
  windows list the step), 9a80 −23.6 → −17.3%.
- *Every planned sheep landed in the replay* (11 / 14 per cast, the log
  2–11). Now replayCast drops a landedCount hit's planned landings the log
  doesn't show.
- *Build inputs* (fixtures): 4e36's weapon at level 1 with no attribute
  node (her buff-free combo projectile ×0.4075; 128 of 130 hits match,
  none before), c3c7's at 60 with none (143 of 164 non-crit hits exact;
  its logged skill level 7 needs the third breakthrough, at 60, which
  rules out 56 with 2 nodes).
Ardelia's error: 5082 −8.4%, af7b −5.3%, 9c6e +9.8%, 4e36 +0.6%, c3c7
+4.8%, 791 −13.7 → −27.4%, 1cd1 and 1d91 unchanged. Some fights' totals
fall where her extra landings had hidden others' shortfalls: 5082 +6.8 →
−21.5% (Yvonne −4.2 → −22.9%: the extra combo and ultimates had covered
her), 791 −11.3 → −18.4%.

**Ruled out:** Ardelia's second "ultimate" event ~3 s after the first
(5082 +3065 ms, 4e36 +3073, c3c7 +2934, af7b +3417, 9c6e and 791 a third
~3.1 s later) as another cast: no sheep group of its own follows, and the
log repeats ultimate events while one lasts (Liino's every ~3.5 s of
Cosmovoice, 2026-11-12). Not chosen: dropping placed casts without a
logged cast event (fixtures without `casts` can't, and Si's Final Stroke
is never logged).

**Still possible:**
- 791: all 8 of her mismatches are sheep at ×1.407 the engine's reading
  (176,418 logged): a missing multiplier on her ultimate there (its cast
  is placed from the first sheep, 59235 ms, the log's ultimate events are
  at 55120 / 59235 / 62299 ms: an earlier cast whose sheep all missed, or
  buffs timed to the cast), or a debuff.
- Her ultimate's cast placed ~0.4–1.4 s late (2700 ms before the first
  logged sheep, which flies first): its time stop and buffs land late for
  others' hits.
- The build-offset report (`buildOffsets`) missing such cases: ATK buffs
  with flat parts move an operator's ratio from hit to hit (4e36: ×0.34 /
  0.46 / 0.53 at the assumed build), so no 75% sit within ±0.003 of one
  ratio. A robust search would replay each candidate build (~0.7 s each)
  and count exact readings; and the logged weapon skill levels bound the
  weapon's breakthrough, so its level (WeaponBreakThroughTemplateTable's
  skillLevelBounds, not in the loaded data yet). Not done.
- 4e36's remaining 79 log-listing matches: Alesh's weapon ATK layers
  (wpn_sword_0012_atk_up) differ between the replay and the log
  (instances log 1 / replay 2 at 12–19 s), and his potential-3 ATK.

## db87: ×1.3 on Laevatain's hits under her sword buff

**Shows:** the 8 Laevatain hits carrying buff_wpn_sword_0006_valid
(listed 1.2) are ×1.30 of the engine's in both readings of her battle
skill (test 20); her two hits without it match exactly; e989 lists the
buff at 2.1 and fits exactly.

**Ruled out:** her battle skill's multipliers (both readings carry it).

**Still possible:** the buff's value or stacks in db87 (listed 1.2 against
what the engine applies), another buff on the same hits, db87's build.

**Next check:** the sword buff's value and stacks in db87 against e989.

## Ink Melt logs (round five): Combustion ticks, a stage factor, Si's late combo buffs

**Shows (sonnet diagnosis, 2026-11-15):** Wulfgard's kit and weapons fit
(implied scales exact); the four new development logs' "0 plain" were
build offsets the export omits (fixed in the fixtures: c83c Si's Jade
Vessel third skill 9 and 0 nodes, c7790 and 8915 Wulfgard weapon 81,
f879 Wulfgard weapon 80, f978 Si 1 node, 8915 Liino weapon 80). Left:
- **Combustion ticks: fixed (2026-11-15).** c7790's Wulfgard ticks
  ×2.2223 = 1.448 × 2.2962/1.4962: the snapshot was taken before the
  `beforeDamage` triggers on the Combustion's own reaction (Hot Work +0.5,
  Scorching Fangs +0.3, Rational Farewell ATK +0.448). Now retaken after
  them (combat-mechanics §3.3); the log check reads the application hit's
  boundary buffs that its ticks list. The reaction's own hit takes the new
  ATK but not the new Heat DMG (7 of 7 hits in c7790 and 4e36; one where
  Hot Work was still active from his ultimate, 22472, keeps it):
  combat-mechanics §3.2. c7790 Wulfgard 6 → 0 mismatches, 56 → 63 plain,
  simulated total +5.9% → +2.2%. Left of the tick problems (none worse):
  - f879: 4 ticks at 71–83 s ×0.83–0.95 (was 10, ×0.83–1.14) and the
    Heat burst at 105.5 s ×0.84.
  - 458b: the re-snapshot pattern (×1.28 / ×1.18 at 88–94 s after a Heat
    infliction on a burning enemy), Wulfgard's ticks at 162–164 s ×1.91
    and 227–234 s ×1.49–1.62 (were ×2.33 and ×1.82–1.97).
  - db87: ×1.4353 ticks at 37.5, 47.4, 49.3 s and ×0.7353 at 50.7–53.7 s
    (the ratio's inverse: as if the snapshots of two Combustions were
    swapped), unchanged.
  - 4e36 (not a development log): Wulfgard's first Combustion's ticks
    ×1.1315 (were ×1.84), at 65.5 s ×1.36.
  - c7790: the engine ticks 10 times in 22.5–32.1 s where the log has 7
    (and 3 against 2 at 63.7 s); the log's ticks there are 1.5–2.6 s
    apart.
- **8915's stage** (indie_hard018_s, the Skydrummer's shields that each
  reaction or physical status removes): every operator's hits ×0.5 to
  37.7 s, ×0.05 at 38.5–39.4 s, ×0.2 at 41.0–85.9 s, ×1 from 86.8 s;
  nothing in the log's buffs marks it. Not modelled; the log is mostly
  not checkable until it is. It is all of Arcane's ×1.85 there (in-game
  test 7, 2026-11-18: 238 of her 278 hits in the windows within 1% of the
  factor).
- **c83c Si's combo from ~55 s: now only the Yinglung stack count
  (2026-11-18).** The +21% is gone (consumed buffs end at their cast's
  last hit, 2026-11-14): her combos at 55.6, 82.8 and 98.4 s are ×0.9494,
  ×1.0528, ×0.9518 = exactly one Edge layer (0.2 of DMG 3.95 / 3.79 /
  4.15) fewer, more, fewer than the engine's 2, 2, 3 (scratch edge fit on
  `zmdlogs hits --json`; Jade Vessel's 0.7 and the P2 ATK the engine has
  fit). Her first combo (9.5 s) wants one more too (engine 2). Which casts
  count: "Type 50 Yinglung's Edge" below.
- **f978 Ardelia: found (2026-11-18).** Her weapon at level 60 (the third
  breakthrough's cap; c3c7's is at 60 too): `efsim zmdlogs fit-build`
  fits 107 of 139 hits, all 55 clean ones (0 as exported); the earlier
  "no pair fits exactly" read the ATK ratio alone (×0.81663 against
  ×0.8167, inside the hits' rounding). Fixture `buildOverrides`; f978
  plain 258 → 365, mismatches 139 → 2.
- **f879**: Wulfgard's late hits (104–126 s) ×1.06–1.10 with many
  Camille talent-1 stacks listed; Laevatain −8.3% (−9.1% before the
  Combustion snapshot fix) not diagnosed.

**Ruled out:** Wulfgard's kit (scales, frames, extra shot, talent,
potential), his weapons pistol_0004 and 0009, enemy level/DEF, food and a
fight-wide factor for c83c, c7790, f879, f978. For the ticks left: the
buffs a Combustion's own application creates (in the snapshot now).

**Still possible (ticks left):** a snapshot retaken when Heat lands on a
burning enemy (458b ×1.28, f879); which Combustion a logged tick belongs
to where two overlap (db87's swapped ratios); ticks the log drops or the
engine adds under time stops (c7790's 7 against 10).

**Check improvement:** the build-offset line only reads hits with
`crit === false`; Si's hits there have crit null, so no offset was
reported. Weapon skill levels could be inferred from logged weapon-buff
values (c83c's 0.21). Done in part (2026-11-18): `efsim zmdlogs
fit-build` scores attribute nodes, weapon level and food on every landed
kit hit (crit null tried both ways) by the recomputed reading, foods' DMG
lines too; its fits go into a fixture's `buildOverrides` with the counts
(docs/design/data.md, the log check's rule). Left: the weapon level's
bound from its logged skill levels (WeaponBreakThroughTemplateTable isn't
loaded), weapon skill levels and gear artifice as candidates.

## Akekuri in 012a: Thermite Cutter's team ATK too early, and ×0.89 left

**Shows (haiku, 2026-11-14):** the engine gives wpn_sword_0012.team_atk
(+0.08) from ~14 s to 31 s; the log lists it from 31.08 s (her combo) and
the teammates' damage fits without it before (Laevatain 41 log-listing
fits against 2, Camille 59 against 1, Arcane 24 against 2). Without it her
16–22 s hits go from ×0.851 to ×0.893, like 37–60 s (×0.892): a constant
×0.89 is left on her 35 physical hits.

**Ruled out (for the ×0.89):** weapon level (skill 9 needs 80+), nodes,
potential, gear, Thermite skill 3, her skill levels (1/1/1/9 right), food.

**Still possible:** her weapon's skill 2 at 4 instead of the exported 9
(fits late, less early); the enemy's physical resistance (data 12, ~21
would fit; Tower 15's 20 fits 458b); Thermite's trigger rule (when its
team ATK starts).

**Fixed (sonnet diagnosis, 2026-11-14):** teammates' Link gives no
Thermite layer (Camille's combo in 012a, Lifeng's in 82735 and d4fb); the
kit's Link trigger now counts only Link the wielder grants (`fromSelf`).
012a plain: Laevatain 53 → 90, Arcane 116 → 142, Camille 58 → 117; d4fb:
Chen 30 → 42, Pogranichnik 93 → 129. Test 94 decided. The constant ×0.89
on Akekuri's own physical hits stays open.

**Next check:** Akekuri's ×0.89 (weapon skill 2, the enemy's physical
resistance).

## Type 50 Yinglung's Edge: how many stacks a combo gets (Estella, Si)

**Shows (sonnet, 2026-11-14):** the log never lists the buff; rescaling
each wearer's combo hits to 0–3 stacks (fit within 0.4%) over 34 logs:
about 25 combo groups fit the engine's count, about 12 don't, both ways.
Estella's ad7f 38169 and a27b 63630 fit 0 stacks (engine 3 and 1); Si
over-counted in 3f78 47327, 4a64 54283, db87 41669, 7b54 15595, a7a7
22503 (fits 1–2, engine 3) and under-counted in e989 7387 / 9408, 489c
14288, 4f7e 4590 (fits 3, engine 2). Data: a team aura adds a layer to
the wearer on a battle-skill cast (stackingType 2, no duration); the
wearer's combo turns them into a one-cast +0.2 × stacks and clears them;
cap 3 (SkillPatch; the owner agrees: up to three).

**Ruled out:** another cap (fits reach 3 often); "any wearer's combo
clears everyone's" (ad7f: Estella fits 3 after Si's combo); expiry alone
(ad7f: Si fits 3 with a 6.2 s old cast, Estella 0 on the same casts).

**Still possible:** which battle-skill casts count (the replay infers
casts from hits; Laevatain's during-ultimate and Si's strokes, test 29);
an expiry (3f78: only the casts in the last 3.5 s count, once); Estella's
combo bound to its own cast id, or landing inside another cast.

**Si's strokes as a switch (2026-11-18):** the engine assumption
`battle-sub-skills` (timeline/assumptions.ts; skills of SkillData
normalSkillSubType 1, which the data's CheckSkillType gives
`normalSkillSubTypeFilter` 0 everywhere, so the data doesn't say) reads
`main-only` as "a sub-skill's cast isn't seen by triggers by skill type".
`npm run measure -- --assume battle-sub-skills=main-only` (on the build
overrides of the same day): c83c mismatches 31 → 22, 9555 11 → 1, 0c14
plain 123 → 133, 489c 124 → 117 mismatches; 9a80 +1 mismatch, a27b and
c7790 a few plain fewer; the hold-out row plain 65.0 → 64.8%, mismatch
7.4 → 7.6%. Mixed, so the default stays `count`. Per combo it fits neither
reading: c83c's fitted layers 3, 3, 1, 3, 2 (engine 2, 3, 2, 2, 3); her
battle-button events come every 3.2–3.6 s (26 in 99 s, most with no hit
and while she attacks), so most of them aren't strokes the replay can
place; in the window before 55.6 s (Laevatain's battle skill and four
such events) only one layer counts, before 82.8 s three (Si's battle
skill, Laevatain's and the events). 0c14 (82.2 s one fewer, 122.5 s one
more), 9555 (39.7 and 92.8 s one fewer) alike.

**Still possible (added):** what Si's periodic battle-button events are
(like Liino's stance beats, `ticksLoggedAs`?) and whether some are presses
that count; a layer lost or kept across her own ultimate (c83c's 55.6 s
combo right after it at 54.4 s fits 1).

**The events and her basic attack (test 16, 2026-11-18; counted over
every development log with Si, multi-target
included):** 282 of her 370 battle-skill cast events have no battle-skill
hit (`normal_skill_abilityrange_1`) within 1.5 s; a real cast's hit comes
400–650 ms after its event (73 casts). Her Final Strike lands 0–0.98 s
after 28 of the hitless events (none with a battle-skill hit after it),
so whatever they are, they don't end her basic attack: no timeline that
replaces the current action starts. *Ruled out:* that they're battle
skills interrupting the attack (no hit follows); that they're all
strokes (most have no stroke hit: `inkmark_projhit` or `inkmove_2` follow
only 8 of the 28, within 2.5 s). *Still possible:* presses the game switches to a buff
(SkillData `switchToBuffConfig` with `asSkillCast`: her Final Stroke's
has the buff xianjing_inkboom, as Last Rite's beside cast) or a periodic
internal cast (`canDummyCast` is set on all three of her battle skills).

**Next check:** in-game test 106 (the buff's stack count on screen; its
(d) is the strokes question).

## Estella's Razorhorn ATK: on the Shattering hit; Lifts get about half

**Fixed 2026-11-14 (sonnet diagnosis):** wpn_lance_0013's atk_up (+0.336)
is on the Shatter and the combo hits at that moment (a27b 14630 / 44993 /
63630 ms ×1.2446 / ×1.292 / ×1.245, ad7f 12173 ×1.215 = the engine's
without it + 0.336 ATK); its triggers are beforeDamage now. Estella
a27b −9.5 → +2.7% (plain 11 → 16), ad7f −8.3 → +5.0% (18 → 21).

**Still open:** her Lifts at that moment fit half the buff (+0.168: ad7f
×1.105, a27b ×1.124 / 1.136 / 1.124), the full buff overshoots; why (the
Lift's formula, its timing) is open. ad7f 38169's combo fits one Yinglung
stack where the engine has three. Her other weapon in c4f3 (wpn_lance_0004,
ATK +0.42 on the first Vulnerable) triggers at other times than the log
(8.9–23.4 s listed, engine none; from 81 s the reverse). a9d7: all four
operators ×1.15–1.33 low from the first hit (a stage factor).

## OBJ Razorhorn's ATK lasts longer than its 15 s

**Shows:** wpn_lance_0013's atk_up (Estella's weapon) still listed 17.2 s
after its Shatter in a27b (44993 → 62229) and 18.7 s in 69e7 (13030 →
31681), against the data's 15 s at L9; the check says "log lists it,
replay isn't sure".

**Ruled out:** nothing yet.

**Still possible:** a refresh by a later Shatter or other trigger; the
duration read wrong; the listing lagging (stackingType habits, cf. Liino's
weapon).

**Next check:** each listing's start and the Shatters between (small model).

## Freezes on bosses: Si's Immobilization holds her Artful Intent (tests 104, 37)

**Shows (sonnet, 2026-11-13):** Si's Artful Intent ends (the Inksoul
burst: an exact expiry marker) fit only when her Immobilization freezes
the boss: abfd (Rhodagn) residuals 318 / −7 / 174 ms frozen against 1318 /
393 / 1174 immune; c3c7 (Chiliarch) 0 / 4 / 15 against 0 / 971 / 949;
0c14 (eny_0134) 1 / 5 against 834 / 39. Non-bosses fit frozen, as the
engine has. Jade Vessel's 30 s in abfd and c3c7 fits being stretched by
her freeze too. The engine makes every Boss (rank 2) control-immune
(clock.ts controlImmune, from b7b3's Cryo bursts during Tangtang's stare).

**Tried (2026-11-13, reverted):** no Boss immune. Development plain 36.1 →
35.4%, mean |damage error| 22.1 → 21.9%, hold-out unchanged; 4a64 (the
same boss as 0c14) loses Arcane 64 → 32 plain and Si 37 → 25: the whole
enemy clock frozen stretches timers the log says weren't.

**Ruled out:** "bosses ignore freezes" as a property of the enemy (Si
freezes Rhodagn in abfd, while b7b3's Tangtang stare on Rhodagn doesn't
hold Arcane's bursts); freezing the boss's whole clock (4a64).

**Still possible:** the freeze holds some timers and not others (Si's own
Artful Intent and Jade Vessel yes; Arcane's statuses, Corrosion, her
bursts?); Tangtang's stare differing from Si's Immobilization; the control
-immune tag 188749032 (only in Tangtang's and Si's buff files, no enemy
carries it in the data).

**Found (sonnet, 2026-11-13):** in the engine only the enemy-target buffs
matter (statuses, Corrosion, inflictions, Vulnerable, Stagger, enemy
actions: freezing them or not changes no verdict). On 4a64, freezing only
Si's own enemy debuffs (Artful Intent, her weapon's enemy_vul) keeps every
match (Si 37, Arcane 64 plain); freezing Arcane's (will_burst with another
of hers) costs the 64 → 32. The log agrees: her weapon's will_atk is listed
51313–54731 ms only, the frozen engine keeps it to 56.9 s. Si's Artful
Intent ends fit with only it frozen (abfd −318 / +7 / −174; c3c7 0 / −4 /
−15 ms).

**Proposed rule:** a freeze holds the freezing operator's own debuffs on
the enemy (and the enemy's own statuses, which no verdict tells apart),
not other operators' debuffs; bosses not immune.

**Measured (opus, 2026-11-13):** as proposed (no Boss immune, only the
freezer's debuffs held everywhere): development plain 36.1 → 35.9%,
mismatch 19.3 → 19.4%, mean |damage error| 22.1 → 22.3%; hold-out 44.1 →
44.4%, 6.2%, 17.7 → 17.6%. The loss is all on non-bosses, where others'
debuffs held fit better: b6aa (eny_0120 tower) Si 89 → 77 plain (Xaihi's
cryo_fragility under Si's freeze at 37.9–39.4 s, then "as the log lists
it"), 489c (eny_0127) Arcane 132 → 123 and Rossi 125 → 131 mismatches
(Arcane's will_burst under Rossi's freeze at 45.4–46.7 s), 791 (Tangtang's
stare) damage −8.9 → −11.7%. On bosses others' debuffs held is worse: 4a64
Arcane 64 → 32, Si 37 → 25 plain; c3c7 Si 86 → 82. abfd and 0c14 don't tell.

**Implemented:** bosses stay control-immune by default (their clock and
others' debuffs run on), but a freeze holds the freezing operator's own
debuffs on any enemy (actions.ts runTriggers; TimelineState.enemyFrozenBy
counts each operator's overlapping freezes once); non-bosses freeze whole,
as before. Against the branch base: development and hold-out unchanged at
one decimal (36.1 / 19.3 / 22.1%; 44.1 / 6.2 / 17.7%); 0c14 Endministrator
32 → 34 plain, damage +8.7 → +7.9%; abfd −4.5 → −4.4%; b7b3 (Tangtang's
stare on Rhodagn, the old evidence for immunity) unchanged: Arts Bursts run
on their operator's clock now, so it no longer tells.

**Ruled out (this round):** "a freeze holds only the freezer's debuffs" on
every enemy (b6aa, 489c, 791); every debuff held on a boss (4a64, c3c7).

**Still possible:** the boss/non-boss split being something else (the
control-immune tag on some enemies only; the debuff kinds: Arcane's weapon
buff against her kit's); whether a boss's own clock (its statuses,
Corrosion) stops, which no verdict tells apart; Tangtang's stare on a boss
holding her own debuffs (b7b3 doesn't tell).

**Next check:** in-game test 104 (does a boss visibly freeze?) and 37.

**Changed (2026-11-16, test 104 answered by the owner: most bosses freeze,
a few rare ones don't):** an enemy freezes unless it's listed as
control-immune (packages/data/src/enemyFacts.ts), the freezer's own
debuffs held on a listed one as before. Each boss with a freezer in the
logs, checked frozen against immune (Si's own debuffs held under both, so
her Artful Intent ends don't tell them apart):
- Rhodagn (40d9, b7b3, abfd, c7790, e82d): every verdict the same; frozen
  (the default). b7b3: one Tangtang assumed match becomes a fallback.
- Chiliarch (c3c7): frozen holds Ardelia's Arts Susceptibility past where
  the log's hits fit without it (48.3–54.5 s): Ardelia 139 → 122 plain, Si
  120 → 110 (assumed or fallback, no new mismatch). Listed immune.
- The enemy Si, eny_0134 (4a64, 3f78, 0c14, e989): 4a64 frozen holds
  Arcane's will_atk past its logged end (54.7 s; 56.9 s frozen): Arcane 64
  → 32 plain, Si 37 → 25; 3f78 leans frozen (Si 20 → 23); 0c14, e989 don't
  tell. Listed immune.
Scoreboard unchanged in every group (no hold-out moved).

**Still possible (now):** Chiliarch and eny_0134 being frozen after all,
with something else holding teammates' debuffs less than a freeze would
(their evidence is one log each, 4a64 against 3f78 for eny_0134); the tag
being a buff the enemy carries only at times (the data checks the enemy's
buffs for tag 188749032 at each freeze, CheckBuffStackNumAdvanced, so a
boss could be immune in some phases only: 4a64's freezes at 51–53 s
against 3f78's); why an immune enemy still holds the freezer's own debuffs
(no data mechanism found: Artful Intent and Arcane's will_atk have the same
time-dilation flags).

## Laevatain's Twilight runs longer than its model (tests 17, 18, 21)

**Shows (2026-11-18, replacing the 2026-11-16 brackets):** the 22 Twilight windows of
the 18 Laevatain logs, each bracketed by her last enhanced cast and her first plain cast
after it (the placed casts, `efsim zmdlogs casts`), against the replay's Twilight
(`efsim zmdlogs replay <log> --kit-buff chr_0016_laevat:twilight`), its holds counted
with the kit's duration set long so that an early end doesn't drop the later holds
(scripts in scratch/: twilight2.ts, dneed.ts, holds.ts). The base duration from the press
each closed window needs on top of the holds the engine counts (her battle skills'
pauses, her combos' 1.9 s and slow-downs, others' stops): 458b 80.3 s 17.6–19.6 s,
458b 156.3 s 18.8–19.4, f879 45.4 s 17.1–18.2, f879 97.8 s 18.9–19.6, c83c 42.5 s 20.1–21.6,
e49e 55.2 s 17.6–18.6 (its first combo, logged at 54.86 s, is before the ultimate),
0206 41.7 s 19.2–19.7 (two targets); 9c0b 2.9 s 21.5–23.0 (no hit by anyone for the
first 10 s: left out). The engine since 2026-11-18: 17.03 s (15 s after her own stop,
engine assumption `buff-in-stop`).

**Ruled out:**
- Twilight running through her own stop (15 s from the press, the kit's default until
  2026-11-18): every closed window needs at least 17.1 s.
- Her ultimate placed at its cast event (the stop's end) instead of its press: fixed
  (buffreplay.ts `loggedCastStart`, another's hit within 0.5 s after the event); in 6
  windows that had moved the window 2 s later.
- The battle skill's pause at its full 115 frames (no jump skips): f879 45.4 s, 458b
  156.3 s, 0206 and e49e would end after the first plain cast (and test 17's timings
  say the jumps skip).
- A constant on top of 17.03 s, or show_weapon's 16 s as Twilight's length: f879 45.4 s
  allows at most +1.2 s, f879 97.8 s and 0206 need at least +1.8 s, c83c +3.1 s.

**Still possible:** her combo's hold being other than 1.9 s (the residual falls with the
number of her combos in the window: 1 combo 1.8–4.6 s, 2 combos 0.1–2.7 s; but it
doesn't fit a single value either); others' stops held longer than their
UltimateTimeAction frames (the casts' animations); placement error in the brackets
(±0.3 s) and in others' stops (c83c's three ultimates); a hold the engine doesn't model
(hit-stop, T10).

**Next check:** her combo's ChannelingAction ticks (0.1 s, frames 0–57) against the
combo's own slow-down: do they run on her clock or the world's (a combo pressed inside
another's stop)?

## Arcane's Array Arcana on a knife edge (0206, b6aa): closed 2026-11-13

**Shows:** 0206's Arcane (Intellect 472.44, Will 473.50) had a 12.15 s
combo gap, INT's 12 s, with WILL's Susceptibility.

**Settled:** 0206 is from game 1.5 (2026-10-04, parser v57), the only
pre-1.6 log of hers; the owner copied its exact loadout in game 1.6:
Intellect 472, Will 473, WILL mode, combo cooldown 18 s. Every game-1.6
WILL gap is 16.9 s or more. The engine (1.6) is right. Possibly a 1.5
bug fixed in 1.6 (the owner). The game does
decide her mode in two places (the skill condition table's lizhiyan_wisd
for the talent's cut and the skill set; her passive buff's CompareDeckAttr
for her skills' branches), but nothing now shows them disagreeing; the
stat-panel warning added for it was removed.

**Still possible (low priority):** a whole-parts tie (b6aa: 431.44 /
431.50) splitting if one check floors; 3f78's and e989's gaps ~1 s under
18 s (no cut source in the data).

## Buffs a cast consumes ended at its planned last hit: closed 2026-11-14

**Shows:** Si's combo final lost Jade Vessel's next-combo DMG and
Yinglung's Edge when it landed after the frame planned at the cast: 0eef
(10 frames late, 179,405 against 379,860 logged), bdf2 (1 frame, ×1.456),
9a80 (her combo stretched by her ultimate: 20 mismatches).

**Settled:** a consumed buff (and Link) acts on every hit of its cast
however late it lands; it ends the frame after the cast's last own hit has
landed (casting.ts settleCastBuffs). The game's attached buff checks the
cast's ID (buff_equipsuit_attrisuitup_02: CheckSkillCastId, 20 s). bdf2's
final is now exact (287,297); 9a80 Si 20 → 14 mismatches; 0eef's final
266,134 (the rest: its unlogged crit and Liino's stance ATK, "Liino's
stance ATK ends early"). Free simulation too: another's stop inside the
caster's own combo slow-down holds its hits more than the world.

**Still possible:** the game's `finishWithNextSkillIfNotInherited` ending
such a buff at the caster's next skill: 9a80's combo hits keep it across
her ultimate (cast during the combo), so not for every next skill.

## Buffs through stops: the log lists them longer than the damage says (Si's Amp, Ardelia's; 2026-11-14)

**Shows (two sonnet diagnoses):** the log lists Si's ultimate Amp 0.5–2.5 s
past the engine's end: db87 to 48.7–49.0 s (engine 45.7–46.6), 458b
(ult 76514) to (96.7, 97.4] s (engine (95.6, 96.3]), 458b (ult 152238)
(173.4, 174.1] (engine (173.2, 173.4]), 489c (ult 87091) past 108.6 s
(engine (107.3, 108.0]). Ardelia in af7b: her weapon's Arts DMG Taken
listed to 63.5 s (engine 56.9), her Susceptibility to 72.1 s (engine
~69.9); 791: her funnel_0016 ATK listed to 62.9 s (engine 59.4).

**Found (opus):** where the damage decides, it fits the engine's end, not
the listing: db87 Arcane's 7 hits 47.3–48.8 s and Camille's 3 hits
46.6–48.7 s fit without the Amp the log lists; 458b Wulfgard's 11 listed
hits fit the engine 3, the log 0; 489c (ult 24447) Rossi's 15 hits
42.6–58.7 s, where the engine has it and the log doesn't, fit the engine
6, the log 0; af7b's Susceptibility 70.5–72.1 s fits the engine 12–15,
the log 0–2. The hold itself is right in db87: the Amp's hits put its end
between 45.7 and 46.6 s (Camille's ultimate hits at 44.7–45.6 s with it,
at 46.6 s without; unheld it would end at 41.5 s), and the engine's 151
frames of stops put it at 46.5 s. So team buffs are held by others'
stops as the engine has it (B11), measured by damage in one log.

**Ruled out:** a longer hold for team buffs (the damage); per-operator
clocks for Si's Amp (the "Amp on Laevatain to 53.7 s" were her Combustion
ticks, which keep the attacker side from their application; Si's and
Laevatain's listings end at the same 49027 ms boundary);
`useTimeDilationDt` as what tells buffs apart (false in 1436 of 1450
BuffData files, Si's atk_buff_2 and funnel_0016's ATK alike); and in db87
not even every slow-down holding for its whole length reaches the listing
(47.2 s against 48.7).

**Still possible:** af7b's Arts DMG Taken at 59.6–63.4 s fits the log
(Liino 19 of 21 hits, Typhoeus 11 of 13), but the replay lacks Liino's
logged ultimates at 59.9 and 64.5 s and makes Ardelia's ultimate four
times (57.6–60.2 s), so its stops aren't the game's: recheck after the
cast placement is fixed (logcasts.ts). 791's ATK at 59.2–62.7 s fits
neither (0 / 0 / 10), and every Susceptibility she applies refreshes it
(funnel_0016 int_susceptibility), so its listed end may be a refresh.
Whether a combo slow-down holds buffs by its lost frames (engine) or its
whole length: under a second each, no log separates it. Why the log lists
a buff 0.5–2.5 s after it stopped acting: unknown (a ZMDLogs lag?). The
enemy clock: db87's Combustion ticks are 1024–1025 ms apart with nothing
between, and 90–180 ms further apart than the modelled holds across each
stop (a clock ~2.5% slow against the log's, or holds a little longer).

**Next check:** in-game test 107 (Si's Amp across three ultimates); af7b
after the placement fix.

## Liino's volley doubles in 1d91: closed 2026-11-18

**Shows:** 442 at 1990 ms, 886 (2.007×) at 13713 ms, later 985, 1152.
**Cause: the team's buffs, not the volley.** Once the replay lands the
volleys (the next entry), 1d91's 886s match the engine plainly: from its
second volley on the volley carries Ardelia's Arts Susceptibility (0.28)
and Tidal Murmurs' Arts DMG Taken (0.16), Arcane's WILL Susceptibility
(0.096) and the usp02 set's DMG (0.16), ×1.28 × 1.352 × 1.16 = 2.007 the
first's (`efsim zmdlogs hits --json` on 1d91, t=13713: plain, predicted
886). 1d91 lists none of Liino's buffs and no teammate's on her, which is
why the log looked unbuffed. 4360 (419 → 785) and 9090 (388 → 567) are
the same: the first volley comes before the teammates' debuffs.
**Left:** the first volley (1990 ms) still lands nowhere: the log's first
battle-skill event of Liino is at that very ms (the volley's own event,
next entry), so her stance was cast before the log began, and the replay
makes a stance at 1.99 s instead (its projectiles and first volley land
as the replay's own); 7910 (1898 ms) and 4d60 (1354 ms) start the same
way. The volley at 51.0 s is ×1.11 the engine's (985 against 886), 62.2
and 64.0 s (1152 = 886 × 1.3) are under the log's Stagger, split in two
by a stop.

## Liino's volleys: a 10 s timer, reaction or not (in-game test 26 from the data and the logs, 2026-11-18)

**Shows:** 9090 logged 10 volleys, the replay 1 (the kit's reading B of
test 26: an Arts Reaction while her listener is up, then 10 s of
cooldown); no reaction hit is logged in the 2 s before the one at 15.2 s,
and its first comes 1.9 s after her cast, before any reaction.
**Cause (the data):** buff spelllnfliction_extraattack (the battle skill's
frame 45) ticks every hit_tigger = atk_trigger (10 s), the first at once
(waitFirstTriggerInterval false), and each tick launches the volley at a
marked enemy within 20 m; the tick's first condition, CheckBuffIdInContext
spelllnfliction_hit (the 2 s mark an Arts Reaction leaves), has
`isEnable false`. `efsim gamedata tree` left disabled actions out as
defaults, so the condition read as live; it now prints `DISABLED`.
**The logs agree:** 103 volleys in 24 Liino logs, 10.0–11.7 s of world
time apart (time stops taken out; `scratch` count over all Liino logs,
logcasts `worldMs`), also with no stop between (1d91 11.29, 4bfe 10.70,
8915 11.67, a7a7 10.02, c6d8 10.70 s); a stance's first comes 1.6–2.4 s
after its first projectile (the kit: 1.9 s), with no reaction needed.
**Fixed:** the kit's volley_window ticks every atk_trigger from frame 45
and fires the volley (kit-liino test). The game's clock for it runs
slower than the replay's world time (mean gap ~10.5 s; her beats drift the
same way, "Liino's battle-skill presses" above), so the replay takes each
tick from its logged volley (`KitBuff.ticksShownByHits`, buffreplay
`loggedTickLandings`): held to one up to 5 s later, brought forward to one
up to 5 s sooner. 9090: Liino's volleys 60 logged, 58 replayed (the first
volley's last two lie after Arcane's combo stop at 2.5 s), her totals
−10.4 → +2.5%.
**Ruled out:** the volley waiting for a beat (but for the 37 at 0 ms,
below, the volleys' offsets from the last logged beat spread evenly over
0.1–3 s); a cooldown from a reaction (9090's first volley comes before any
reaction, and its 15.2 s one has none in the 2 s before).
**Found, not acted on:** 37 of the 100 volleys have a Liino battle-skill
cast event at their first hit's very ms (the beats and the volley tick on
unrelated clocks, so these events are the volley's). Reading them as
neither presses nor beats changed nothing but 1d91 and 7910, both worse
(their first event is then no stance at all: plain 280 → 249, 202 → 177,
measure 2026-11-18), so the replay still reads them as beats (or, before
any stance, as the stance's cast).
**Still possible:** the game's slower clock: hit-stop or a time scale on
Liino herself (useTimeDilationDt false on the buff), or stops longer than
the engine's; the data's listener end at frame 1691 (54.9 s; the kit ends
it with the stance at 60 s, which no tick falls between).
**Next check:** none for the volley. Rossi's bleed ticks (an `every 1`
enemy buff) took the same pinning in a trial: 489c mismatch 124 → 111,
d572, 2fd9, 99fb better, 0c14 +0.3, 4a64 −0.1 points of damage error
(measure 2026-11-18); not kept here (outside this task), a lead for
Rossi's kit.

## Liino's Cosmovoice beats: logged at other moments than the replay's (2026-11-18)

**Shows:** of her ultimate's 572 checked hits (in-game test 6, decided:
the values hold, 332 plain, dbae 25 of 25), 21 are beats or finales the
replay lands nowhere, beside beats it lands where the log has none: 4d60
82.6–99.9 s (logged 1.35–1.38 s apart, the replay 1.5 s: 86.69, 89.86,
91.22, 98.19 s and the finale at 99.87 s unlanded), 7910 59.0–62.1 s (the
replay's beat at 55.70 s falls before the stop of 55.1–58.5 s the log's
beats skip), 9090 (finale logged 79.82 s, the replay's 79.03 s; no beat
logged 68.5–75.8 s), 8915, 9847 one each. Cosmovoice's Amp is listed on
teammates' hits up to the logged finale where the replay's has ended
(8915 104.65–105.88 s, 9090 79.71–79.82 s: `zmdlogs differences --what
cosmovoice_amp`, 35 log-only hits, 5 mismatches).
**Cause: not known.** Logged gaps between consecutive beats (scratch over
the 16 single-target Liino logs, gaps under 1.9 s): 1.17–1.89 s, most
1.35–1.55; 4d60 a steady 1.36, c6d8 1.52, 9847 1.44–1.55. Not every beat
is logged (gaps of 3–7 s with no stop that long, e.g. d774's second
Cosmovoice: 2 beats).
**Fixed: ten beats, not nine.** The three Cosmovoices logged with every
beat (4bfc 55.3 s, 4d60 82.6 s, 9847 53.5 s; scratch count over every
Liino log) have ten each and none has eleven; the kit ended the beats'
buff with its creating clip (77–477: 9). Now it ticks at 482 too and ends
at its 15 s duration (527) without a tick there (measure 2026-11-18:
development plain 51.4 → 51.5%, 4d60, 9847, 9c6e better; 8915 worse, its
stage factor; d774 worse, its replay-only beats; hold-out 2 better, 0
worse). The finale is logged at 3 × a beat (4d60 13043 / 4348, 9090 7294
/ 2431), as the kit.
**Ruled out:** the values (test 6); the beats' damage where they land
(plain or team-wide); nine beats.
**Still possible:** the beats on a clock of their own, as her volleys'
(which runs ~5% slower, "Liino's volleys" above), here sometimes faster
(4d60 a steady 1.36 s, which would also fit ten ticks inside the 477
clip); other operators' stops placed differently from the game's (7910,
4bfc 152–155 s); beats that miss an enemy out of reach going unlogged.
**Next check:** pinning
the beats to their logged landings as the volley ticks are
(`ticksShownByHits` needs the beats as a ticking buff, not fixed frames),
then the finale from the last pinned beat.

## Si's Artful Intent bursts that fit no reading (6 of 40)

**Shows (2026-11-14, recordedburst.ts):** the log check values each burst
as the build's ink_damage_rate × every logged hit from Si's battle-skill
hit to the record's end (docs/design/data.md, "What a log check verifies").
34 of 40 single-target bursts in non-hold-out logs fit within the per-hit
rounding (most within ±3: 489c 38772 ms 446279 vs 446281, 9555 53088 ms,
db87 45457 ms, e82d 11111 ms, c3c7 100082 ms; abfd's three at rate 0.11,
battle skill 10; 0c14's first two at 0.17, P1 with battle skill 9 — the
diagnosis's "abfd ×0.84" and "0c14 P1" misfits were the skill level).
489c 5961 ms has no battle-skill hit before it (unquantified). Misfits:

- 0c14 181424 ms ×0.288: the window from the battle-skill hit at
  108670 ms is 73 s long; Si's battle skill is cast every ~3 s from
  116 s with no logged hit.
- 458b 85571 ms ×1.065: the log has no hit at all in the 3.2 s before the
  burst (a gap in the log?).
- 458b 131439 ms ×0.98 and a7a7 34593 ms ×0.986: a cut 1.2–1.7 s before
  the burst comes closest (458b ±12 against ±9.5 allowed); a combo cast
  (458b, 479 ms before) may stretch the projectile's 14 frames.
- 6339 19914 ms ×0.66 (logged twice): the slug (eny_0129_slwood_hdg033)
  caps hits mid-fight (11308 ms: 117149 and 98788 both "uncapped
  121248"), as if its HP came in phases; a window from ~11.1 s would fit.
- 9a80 38099 ms ×0.9998: the sum is 1115 too high (one reading), with
  rows the log lists two or three times at 35280–35767 ms.

**Ruled out:** the rate (the engine's ink_damage_rate fits 34 bursts at
P0–P5 and battle skill 9–12); a fixed end lag (fits stop 294–393 ms
before the burst in 3f78 61538 ms, 681–869 ms in 458b 23727 ms); only
Si's hits, or no status hits (every exact fit counts all of them).

**Still possible:** for 0c14, a battle-skill hit the log doesn't have
(resetting the record: SkillData normal_skill sets EntityBB_ink_damage to
0 at frame 0); for 6339, the slug's phase change resetting or splitting
the record (BuffData xianjing_inkhurteffect event 1, hp_zero, adds
kill_damage × rate); time dilation stretching the burst's delay past 1 s;
duplicate log rows.

**Next check:** 6339 and 7b54 (the same slug) with a window from each
phase change.

## 0c14: Si, and Rossi's later windows

Found (2026-11-11): Alesh's weapon at level 60 (her buff-free hits
×0.807 exactly), Rossi's food (Kunst Tube; early hits exact).

**Found (2026-11-18): Si's build is two inputs, food and nodes.** Her
hits with the log's listing in place of the replay's (scratch
recomputation on `zmdlogs hits --json`) are ×1.1543 where she has no DMG
from others and ×1.1322 under Alesh's set DMG (+0.16), whatever the ATK
buffs: a ratio that depends on her DMG bonus is an additive DMG, and only
+0.247 with ATK ×0.962 fits both. +0.2465 is Kunst Tube (all-element DMG),
the food Rossi's and the Endministrator's hits fit; ×0.962 is two
attribute nodes of four (nodes 5 and 7 need trust 300, as in 40d9).
`efsim zmdlogs fit-build`: 46 of 191 hits within ±1, all 25 clean ones
(0 as exported); the next best fits 26. Fixture `buildOverrides`; 0c14
mismatches 212 → 23, plain 77 → 123 (the fight's total +7.5 → +8.5%: Si's
hits were the low ones under Rossi's and Alesh's highs). The earlier "a
food alone" was right: it takes both.

**Found (2026-11-18): the step ×1.0965 at 13.25 s** is Alesh's P3 team
ATK (+0.15, buff_chr_0024_deepfin_potential_3, listed since 13254),
which only her combo's Rare Fin slam gives; with her weapon's team ATK
listed since 12707 (Thermite Cutter on natural SP, which her combo's hook
grants) it says Alesh cast a combo at ~12.5 s whose hits the log hasn't
(her combo window opened by the Endministrator's Crystals shattered at
11.2 s). The replay makes no cast there (no logged hit or cast event), so
it lacks the team ATK until Alesh's ultimate (18.4 s) and the P3 ATK until
her next combo (60.6 s): Si's combo hits from 13.25 s and Si's ultimate's
carry them (log-listing fallbacks now).

**Ruled out:** a food alone for Si (residual 0.91–1.15 with the best);
a weapon level or nodes for Rossi (they only lower ATK; she is predicted
low); for Si either alone (two inputs, above).

**Still possible:** Rossi at 22–40, 62–82, 150–195 s: Wolven Blood layer
and max-stack timing (the log lists two entries per layer), Si's ultimate
window, the Endministrator's ATK buff and Razor Clawmark timing (the
engine has Razor Clawmark's 0.12 at 52–60 s, the log doesn't). Si: her
combos' Yinglung's Edge count (82.2 s one layer fewer, 122.5 s one more,
167.1 s one more and Jade Vessel's next-combo bonus the engine hasn't: "Type 50 Yinglung's
Edge"). Alesh: ×1.146 at 26 s (the log lists her ATK buff twice, the
engine once), ×1.38–1.44 at 59–60 s, her ultimates ×1.34 and ×1.90.
For the replay: a cast inferred from a buff only it gives (a logged
effect whose `since` no replayed cast explains, like
castsFromBuffEnds for ends): not built; Alesh's combo here is its first
case.

**Next check:** Rossi's Wolven Blood layers against the log's listing,
window by window.

## 3f78 and 4a64: −36.5% after food

**Shows:** most hits carry buff_common_natural_cryst_triggered; the check
routes them to Corrosion and finds "no level that fits".

**Found (round 4, a sonnet pass correcting round 3's):** the buff *is*
the engine's Corrosion (Nature onto Cryst): its modifiers are on
attributes 94–98, resistance points for Physical, Nature, Cryst, Pulse
and Fire (`def_decrease` is only the blackboard key; its values come from
the wrapper's ReadSkillSettingData "腐蚀每跳减抗"). With the right level
the engine's curve fits exactly: 4a64's first Corrosion (4517 ms, level
1) gives 1.000 ± 1 on Si's, Arcane's and Gilberta's hits at every shred
step from 7.8 to 23.2. The misfits are the replay's level: 4a64's second
Corrosion (52982 ms) is level 1 in the reaction check, level 2 in the
check's replay (hits ×0.95–0.97; at level 1 they fit); 3f78's second
(46994 ms) the other way round.

**Found (2026-11-11, the level fix):** the replay's enemy held other Cryst
stacks than the game's. 4a64 at 52982 ms: level 2 in the replay from a
Cryst stack of Xaihi's battle skill cast at 33.3 s, whose hit the log
never shows; level 1 by the logged reaction hit (16537) and the reaction
check. 3f78 at 46994 ms: level 1 in the replay (at 45458 ms Arcane's
ultimate lands before Xaihi's Cryst, so its "enemy's element"
infliction adds nothing); level 2 in the reaction check (the hit fits 2,
or 1 with a set buff the replay isn't sure of). The replay now takes the
level the log shows (docs/design/data.md, "The log check's rule"): 4a64 plain
68 → 114, unquantified 193 → 131, mismatches 3 → 1; 3f78 plain 30 → 32,
assumed 6 → 25, unquantified 208 → 179, mismatches 8 → 5. Totals: 4a64
−36.5 → −38.7%, 3f78 −36.5 → −35.0% (less shred in 4a64; the
under-prediction is elsewhere).

**Ruled out:** a DEF decrease (round 3's reading: attributes 94–98 aren't
DEF, and a full −15% gives at most ×1.081); a different status from the
engine's Corrosion; the food running out (300 s); the second windows'
Corrosion levels (the log's now).

**Still possible:**
- The replay's inflictions themselves (casts whose hits the log doesn't
  show, same-frame order across operators) still differ from the game's;
  only the reaction levels are taken from the log.
- 3f78's second window, ×1.079 (54–61.6 s): found (round 5): one Will
  ATK instance (funnel_0016 will_atk, made by Arcane's bursts, ~24 s)
  the replay lacks on all 101 hits: its only Arcane burst is at ~20.7 s;
  the log's second, buff_common_cryst_cryst_triggered at 47230 ms
  (credited to her), isn't replayed; its source perhaps her touch's
  element (entry above). The ×1.158 hits: an extra 0.192 that isn't Will
  (candidates: log-only entries in Rossi's window, wpn_sword_0022.final
  0.384, wpn_funnel_0005.atk_up 0.224, suit_usp02.team_dmg 0.16).
  Elsewhere the Will buffs' counts agree (0eef, bdf2, dbae, 4a64, e82d;
  b7b3 has 63 hits with a will_atk the log doesn't list; d9e5 12 the
  other way).
- The first windows (4a64 6.3–18.8 s, 3f78 3–15 s) are still "no level
  fits" in the check (nearest ×1.012–1.014, ×0.987 at 15–17 s in 4a64),
  though their level (1) is the replay's and the round-4 hand fit is
  1.000: the check's reading differs from that fit somewhere.
- ×1.5 on hits at a reaction's own millisecond: found and fixed (round
  5): Hot Work's Nature DMG on the hit that forms the Corrosion. 4a64 at
  52982 ms is ×1.39, not 1.5: open.
- Rossi's combo_2 ×0.94 in 3f78's second window.
- Si's ultimate and Fixed DMG, Rossi's and Si's ultimate hits (×1.4 to
  ×36): not Corrosion. Si's Inksoul burst (Fixed DMG from the fight's hit
  sum) isn't computable; Rossi's Seething Blood extras after null-crit
  stabs need the stab's crit.

**Next check:** the Will buffs' instances in 3f78; the hits at
reactions' own milliseconds; why the first windows' hits miss in the check.

## The slow-down rule's reach (2026-11-11)

**Shows:** "an operator in its own ultimate's stop isn't held by another's
slow-down" fixed 9a80's crit buff and raised plain matches (hold-out +4),
but some totals rose (hold-out mean |damage error| 19.7 → 20.3% at the
time, before the crit fix).

**Evidence so far (round 3):** in 1cd1 and 0c14 every overlap starts
inside the stop (Liino's 77-frame stop with Arcane's and Typhoeus's
slow-downs; the Endministrator's 44-frame stops with Rossi's). 0c14 at
80.5 s: Rossi's airborne (log 34792: old rule 24079, new 31303) and
combo_2 (log 113417: old 78495, new 102043) move toward the log; the
Endministrator's frozen buff (log 26783: old 32873, new 42734) moves
away. 1cd1: Liino's ultimate projectiles fit neither (log 1391: old 1128,
new 1696; her stance buffs may be the cause).

**Ruled out:** the old rule as the only fit (Rossi's 80.5 s hits favour
the new one); "only the ultimate's own action and hits" alone (it reverts
those hits and worsens the ultimate-kind total, −2.0 → −15.6%), though
not excluded as part of the answer.

**Still possible:** (a) every scheduled item of the operator (as now);
(b) only its ultimate's own action and hits (the Endministrator's total
fits it: +24% against +44%); (c) only slow-downs that start inside the
stop: no log separates it from (a) yet; a mix (the Endministrator's
frozen buff on another clock than her hits).

**Next check:** a log where a slow-down starts before an ultimate's stop
and runs into it; the Endministrator's frozen buff's clock in her kit.

## Laevatain's battle-skill multipliers: data and logs against Zero Sanity

**Shows (kit review 2026-11-12, Laevatain F3, F4):** the kit follows Zero
Sanity's in-game table (game ~1.1): the empowered extra hit × extra_scaling,
Twilight's enhanced battle-skill hits 1 and 2 × ratio. The data (1.6) has
× ratio on the extra hit and none on hits 1 and 2; with the data's reading
e989 (P5, game 1.6) goes from 6 mismatches to 0, its extra hit logged at
0.8 of the kit's (1.2 / 1.5).

**Ruled out:** nothing yet.

**Still possible:** a game change since 1.1 (the data and logs are 1.6);
a log or import effect in e989; a P1–P2 difference (db87, P1, still ×1.30
on the Twilight hits with either reading).

**Next check:** in-game test 20; the owner's decision on whether game-1.6
logs outrank Zero Sanity's older in-game values.

## Fight-wide factors in older imports (kit review)

- Da Pan's only log (multi-target 10df): ×1.25 on half his hits and on
  Pogranichnik's in the same fight.
- 04d4: Catcher's weapon fits level ~1 (×1.0265 left), Ember ×1.0226 (as
  in 146d); Ember ×1.0444 in Hard 27's pair, none in 7e19.
- c3c7: Xaihi's hits all ×0.337.

**Still possible:** build inputs the export doesn't give (weapon levels,
nodes, food), stage effects. **Next check:** none planned (not screened
logs).

## Team SP: the replay's SP runs short (web review row 2)

**Shows:** with the engine's own SP, the log check's replay can't afford
casts the log made: at first in 28 of 40 logs at the 1.5 s regen pause
(most 2–12 SP short), 22 at 0.5 s, 14 with no pause (1d91 at 4833 ms: 46
SP before a 100 cast). replayCast raises SP silently, so verdicts don't
show it. Since 2026-11-12 the engine pauses 0.5 s and regenerates through
others' time stops and slow-downs: of the 17 development logs, 9 are still
short at some cast, 1193 SP in all (before: 13 logs, 2921 SP). Since
2026-11-13 Liino's beats cost nothing and a logged cast matches a placed
one in the world's time: of the 15 development logs, 8 short at 21 casts,
1038 SP (before: 10 logs, 39 casts, 1673 SP, 116 of it Liino's); in the
Liino logs, Liino's top-ups are gone (a7a7 153 → 0 SP, 8318 111 → 0, 4bfe
126 → 0: teammates' presses no longer starved by her recasts).

**Ruled out:** a 1.5 s pause after every spend (old rule K1). Regen held
during others' time stops and slow-downs (old rule K2: about 1400 SP of the
shortfall, 7 logs). SP for basic-attack hits on which the log shows poise
(the replay's controlled operator already matches the log's).

**Ruled out (2026-11-13, sonnet + check):** teammates' Final Strike SP as
the main gap. In the data most operators' Final Strike SP has no
controlled gate (atbOnlyMainChar false, no branch), and the engine already
grants it to teammates; only Laevatain, Ardelia, Zhuang Fangyi, Antal and
Tangtang gate it (Tangtang's attack5_projhit: the ObtainCostAction inside
an IfElse on CheckMainCharacterCondition, so the kits' `if controlled`
are right though the flag says false). Granting all of it anyway: 10 → 7
of 15 development logs short, 1808 → 1287 SP (counted at each replayed
cast).

**Ruled out (2026-11-13):** Liino's "presses" in Vocalist Stance: her
stance's beats (the owner), replayed as such, no SP.

**Still possible:** teammates' basic attacks the replay doesn't land
(their Final Strikes' SP; the earlier probe granted SP at every logged
Final Strike); Purrchena's block refund (+20 at her counter, about 240
SP, more if repeated blocks count); teammates' Final Strikes give SP too
(alone 1497 SP at 0.5 s; with the others only db87 and 04d4 stay short);
other hitless presses free (Si, Laevatain in db87: dubious); SP at the
start above 200 (0eef short at 3.2 s); a pause shorter than 0.5 s (bdf2 at
3817 ms fails any pause above ~0.2 s with the old regen); a replay
artefact (db87 at 10117 ms charges 200 SP for one press).

**Next check:** teammates' basic attacks the replay doesn't land; then
the pause (test 102).

## Solidification as a freeze (web review row 4)

**Shows:** the data's buff_common_do_frozen stops the enemy's clock
(TimeDilation 0), behind CheckSuperArmor (20, compareType 1); the engine
has no freeze for Solidification (rule A37).

**Ruled out:** a freeze on 4e36's enemy (super armor 30: Combustion ticks
on time through it).

**Still possible:** a freeze on enemies under the gate (super armor 0:
agmelee2, lbhunt); the dilation holding only animation (T10 open).

**Next check:** CheckSuperArmor's compareType direction (other buffs using
it); a log with a Solidified enemy of super armor 0. Also seen: 4f7e at
40603 ms, the engine's Solidification consumed Nature where the log's
was Heat.

## Teammates' enemy debuffs "×4" (7b54, 6339, 4e36, c3c7): 2026-11-14

**Shows (two sonnet diagnoses):** Arcane's Solemn Phalanx will_susc /
will_burst ×4 and her Doubles Susceptibility ×2 (7b54, 6339), Ardelia's
weapon and Arts Susceptibility ×4 (4e36: 143 Si hits at 0.82), Xaihi's
crystal Amp ×4 (c3c7: 86 Si hits at 1/1.18), read as instances the engine
counts where the logs show one.

**Cause found (one of them):** none of these is several instances. The
engine and the log list an elemental modifier once per element (an Arts
Susceptibility or Amp: four; Doubles: Nature and Cryo). The engine applies
one acting instance of each (stackingType 1 with a priority key and
maxStackCnt 0 keeps every instance, only the strongest acts: B6; the logs
list each instance, up to 4, and the damage fits one). The 0.82 in 4e36
(and ×0.838 / 0.850 in c3c7) was the log check, not the engine: Ardelia's
Susceptibilities are child buffs (buff_chr_0025_ardelia_affixes_vulnerable_
spell_child, _physic_child) that the log lists under the common affix
(buff_common_affixes_vulnerable_spell / _physical); the check didn't know
the name, took the log's entries for buffs no kit defines and added them
to the engine's own (1.28 / 1.56 = 0.821). Fixed: the affix of the action
that creates a child buff is one of its logged names (affixesAsChild).
4e36 Si plain 6 → 51, c3c7 Si 86 → 120, 5082 and 1cd1 likewise.

**Ruled out:** several acting instances of funnel_0016, funnel_0013,
funnel_0010, funnel_0008 (the hits listing them ×2–4 match the engine's
one exactly: B6); the engine counting a stack group's instances in the
damage (buffModifiers takes one per group).

**Still possible (separate problems):**
- 7b54 / 6339: the "Hard 33's slug" entry above (7b54 18999 ms: 722 /
  (1.312 × 1.1105) = 496, the log's value, with Jade Vessel's, both
  funnel_0016 debuffs and Doubles not acting).
- c3c7 56.7–80.1 s: the engine gives Si Xaihi's crystal Amp (0.18) that
  the log doesn't list and the damage doesn't show (×0.847, 46 hits): the
  treatment's at-Max-HP condition (HP isn't simulated) or its timing.
- af7b 60–72 s: the log lists Ardelia's Arts Susceptibility (0.28) and the
  damage fits it, 12 s past the engine's (battle skills at 10.5 and
  30.1 s, 30 s each); her ultimate (56.8 s; the event at 60.2 s is its
  repeat, 2026-11-14) creates none in the data. The old double count
  happened to match those 30 hits.
- Hits where the log lists a funnel_0016 or funnel_0008 debuff and the
  engine has none (012a 0 of 35 exact, 3f78, 489c, 9c6e, 7910, d774):
  trigger timing, not stacking.

**Next check:** af7b's Ardelia Susceptibility after 60 s (an unlogged
battle skill?), then c3c7's crystal Amp window.

## Typhoeus, Arcane, Liino, Perlica: what the team's logs leave open (2026-11-15)

From the kit check before simulating the team
([teams/typhoeus-arcane-liino-perlica.md](teams/typhoeus-arcane-liino-perlica.md)).

- **Typhoeus's hover outlasts her logged shots** (narrowed 2026-11-15:
  9090 and dbae explained; 1cd1 and fc63 are placement errors, not missed
  shots). Shows: the log lists Hovering ATK (P1) on hits where the replay's
  hover had idled out (floating_loop, then floating_end) after her last
  logged shot. Ruled out: the loop's data; an idle hover longer than the
  data (in-game test 42). Explained: shots that hit nothing (the owner:
  holding attack, she keeps shooting; ZMDLogs lists only hits). The replay
  now adds them where a logged shot needs them (buffreplay.ts
  `missedCasts`, listed in the check's report as assumed): 9090 one at
  58.7 s (no hit by anyone 57.9–60.6 s; her shot at 60.6 s is then the
  3rd, her combo at 62.6 s the hovering one, the 29 hits 63.7–68.0 s
  replay with Hovering ATK: plain 331 → 346); dbae at 3.8 and 6.6 s
  (plain 22 → 33; the second may be Liino's ultimate stop holding the
  hover instead: her ultimate's placement at 5.7 s is unsure). Also a
  replay bug, not a missed shot: 9090 at 93.9 s, shots 16 frames apart
  against the kit's 18-frame window made the replay keep the placed
  index (shot 1 again), so a logged 4th was replayed as a 5th and ended
  the hover; the step is now the one her attempt index allows.
  **Still open:**
  - Closed 2026-11-18: 1cd1 at 37.5 s, 9090's combo, dbae's battle skill
    (casts placed too late across other operators' time stops). Root: a
    cast's start was its first landing less the landing's frame, with no
    regard for the stops between, so a cast pressed before a teammate's
    ultimate started up to 3 s late (1cd1: combo pressed 34.70 s, its arrows
    at 39.04 s, placed 37.87 s, after the hover had ended). Now (logcasts.ts
    `castStart`, `heldStart`) the start is counted back in the world's time
    when the log's cast event of the skill is nearer that held start than
    the plain one, and not before the event: 1cd1 35.30 s (Typhoeus plain
    42 → 65, mismatches 27 → 4), 9090 60.63 s (after her shot at 60.60 s),
    dbae 0.85 s (its two missed shots kept: `missedCasts` looks for a first
    shot past a stop that holds it). An event of the slot's skill counts
    (the log names her battle skill normal_skill, her hovering ultimate
    ultimate_skill; this also stops `unplacedCastStops` from adding a second
    stop for her ultimate from its event). Ruled out: counting every cast
    back across every stop (development plain 47.3 → 45.9%, verified 71.0 →
    64.9%: a stop placed a little off moves a cast pressed as it ended to
    before it, dbae's Li Zhiyan combo); a combo held by others' combos (bdf2:
    Jsspsi's combo at its event 10.46 s held Corrosion's ramp 0.4 s too
    long; combos pressed together take their turns); events logged at the
    same ms as another operator's time-stopping cast's event (pressed during
    its stop, logged at its end: 5082 at 33.71 s, e82d at 3.90 s, a7a7 at
    45.59 s). Still possible: casts without a cast event (basic attacks,
    older imports) keep the plain start; ultimates' own events come at their
    stop's end, so an ultimate held by another's stop is rarely moved; two
    ultimates whose stops hold each other in the first placement (fc63's
    Aglina and Pelica at 41.6 s, no events) stay where they are.
  - fc63 at 46.8 s (4 hits): no shot is missing (39.94 s and 44.43–45.66 s
    are shots 1–4, 46.82 s the 5th). The replay has one too many: the
    burst at 43.58 s (39.94 s's, held by the stops before everyone's hits
    resume at 43.58 s) became a shot of its own, so 45.66 s was replayed
    as the 5th. Joining an orphan burst to the latest shot (tried) fixes
    the count but moves its Nature consumption to the shot's frame (the
    stops don't hold it in the replay): Typhoeus's totals there −11%, and
    in 9090 −8.5%; not kept. Also tried: a landing can't join a cast
    whose delayed landing was logged before it (fixes fc63 92–98 s, where
    bursts opened casts the next shots joined), but distinctCasts then
    merges the 4th shot (placed as floating_attack5 by its off-field key)
    with the 5th (bdf2 −11%, 00ae −7%): not kept. Root: the 5th shot's
    off-field key is the other shots' key, so the placement anchors a 4th
    shot to the 5th's cast.
  - 9c6e: two targets in a single-target fixture (two hits per shot, and
    of Li Zhiyan's and Liino's skills). Since 2026-11-18 a landing logged
    at its cast's last landing's time, all of the cast's landings logged,
    is the same landing on another enemy (PlacedHit.sameAs: same cast,
    slot and replay landing), not a second cast: Typhoeus's totals +61.9 →
    −9.8% (the log's plain 114 → 148, mismatches 121 → 130; hers 58 → 67:
    the second enemy's hits read against the first's landing). The totals simulate one enemy (Li Zhiyan +17.3 → −34%). The
    honest fix is importing it as a multi-target fixture. The same rule
    merges same-instant duplicate basic attacks elsewhere (af7b, b6aa,
    00ae, 79cc: totals ±0.2 points).
  - fc63 96.5–98.2 s (10 hits, fit neither), 9090 51.5 s (a delayed burst
    after the 5th shot's hover end), 00ae 30.0 s, 9c6e 52.5 s: not touched
    by the 2026-11-18 placement fix (no stop between those casts and their
    landings; fc63 92–98 s: bursts logged before their shots' projectiles
    still open casts, as before).
- **Typhoeus's smaller misfits seen deciding tests 9, 43, 46 (2026-11-18).** 1cd1
  40.12 s: her burst logged ×1.300 the replay's, whose arrow (39.69 s) consumed no Nature
  Infliction in the replay: an infliction the replay lacks (whose: not checked). d9e5
  11.73 s: the rain of her shot at 10.88 s lands as three ticks at one ms, 0.46 s after
  the replay's (11.07–11.27 s), as if held by her own combo (slow-down 11.17–12.00 s),
  which the engine doesn't let hold her own entities (T7). Both single instances; not
  pursued.
- **9090 (the whole team): Liino −15.0%, Perlica −13.0% in the totals**
  (the simulation of the logged casts). **Narrowed (2026-11-17):** the
  replay follows the log's Stagger: Liino −15.0 → −10.4%, Perlica −13.0 →
  −10.7%, the fight −5.4 → −2.1%. **Liino closed (2026-11-18):** her
  volleys are a 10 s timer (entry "Liino's volleys" above): 58 of 60
  volley hits replayed, Liino −10.4 → +2.5%, her plain 100 → 148.
  Perlica's −9.6% is left: her 130 hits all match (101 plain), so it's
  hits the replay doesn't land or lands differently, not their values.
- **Perlica in fc63: every hit ×0.934** from the first (4.8 s), before
  any reaction or buff. Her ATK from 30 unbuffed hits is 3,570.8–3,571.5
  against the engine's 3,822.0 (×0.9343), the same on every skill kind
  (basic level 6, battle 6, combo 10, ultimate 9), so it's ATK, not a
  skill level. Ruled out: her weapon at level 80 (its skills allow
  80–90), 2 or 3 attribute nodes, talents at 1 (each tried: worse); the
  enemy (eny_0120 tower015, where 9090, 4bfc and 00ae fit her); **the
  export's empty artifice lists read as 0** (2026-11-18: missing artifice
  only lowers the engine's stats, and the log is the lower; 4360 has the
  same three Pulser Labs pieces at [0, 0, 0] and fits); **the weapon's
  level and skill levels** (not in the log, assumed the highest: a
  search over weapon level 60–90 and skills 1–9 at her logged level 90
  comes no nearer than 3,568.9 and 3,573.9, scratch/fc63atk.ts); her
  hand piece's variant (usp02 hand_01–_04: 4,023–4,139) and its
  artifice. Still possible: an ATK% of 22.6% instead of 31.2% or 54 less
  Wisd from a source the export misreads (the nearest single inputs:
  weapon skill 2 at 7, ×0.939; skill 1 at 5–6, ×0.930 / ×0.946), her
  operator level (the log's 90; at 80 ×0.933). Not a kit lead (her
  other logs fit).
- **Perlica's misfits elsewhere** (4360, 9847, 4bfc, 3aa6, d774) come in
  runs of ×1.3–1.5 (or their inverse) on basic attacks and ultimates.
  **Ruled out (2026-11-17): the Stagger windows.** **Ruled out
  (2026-11-18): her talent 1 (DMG vs Staggered).** Where the engine gives
  it (CheckPoiseValue = 0: Staggered), 9090's 26 and 4bfc's 22 of her
  hits match plainly; 9847's misfits under it sit beside plain matches
  with the same modifiers (64107, 65735 plain; 65313, 66539 ×0.972–0.973),
  and they're **team-wide**: Gilberta, Avywenna and Liino are ×0.972–0.979
  at 65–74 s and 139–142 s, ×1.40–1.50 at 80.9–81.9 s and ×1.29 at 138 s
  too (zmdlogs hits on 9847; groups: 22 of 26 team-wide). So 9847's runs
  are the enemy's or the fight's (Bigents, tower019, whose Stagger windows
  run 18–20 s: "The replay's Stagger windows" below), not Perlica's kit.
  **Found and fixed (2026-11-18): 4360's ×0.62–0.70 run (62.8–73.5 s) was
  Liino's Cosmovoice.** The log lists its Amp and ATK on the team to
  62.10 s, not from 62.76 s, with no finale, then her battle skill at
  63.57 s (projectiles 64.41 s): she pressed End Stance (unlogged: no log
  has an End Stance event) and recast Vocalist. The kit can't cast her
  battle skill while End Stance holds the slot (the ultimate's
  ChangeSkillAction, frames 77–527), but the replay made it anyway inside
  Cosmovoice and kept the Amp. Now the replay infers the exit press after
  the last listing (buffreplay `exitPresses`, made only while the stance
  is on and would last past then): 4360 Perlica plain 104 → 111,
  mismatches 16 → 12, Liino's totals +29 → +5.7%; 9847 the same at 73.1 s
  (its Amp unlisted from 74.44 s, battle skill 75.84 s). 4d60's inferred
  End Stance (Amp unlisted after 98 s, battle skill 101.7 s) is wrong in
  kind, its finale is logged at 99.87 s (the stance ran out), but right in
  effect: the replay's Cosmovoice, 1.5 s behind the log's beats, was
  still on at the battle skill (4d60 mismatch +1, damage −0.4 points).
  Still possible: 4360's 74.6–75.3 s (×1.58–1.72, not Staggered, 3 hits),
  63.3 s (×1.54 now), 59.5 / 61.5 s (×0.97 under talent 1); 3aa6 ×1.16 /
  ×1.60 under talent 1 (2 hits); d774 ×1.29 / ×1.71 (3). Next: 4360's
  74.6 s (what the log lists there that the engine lacks).

## The replay's Stagger windows: the game's last longer than the engine's (2026-11-17)

**Shows:** over the development logs the replay's Stagger ended 0.4–12 s
before the log's (median 3.5 s, 34 windows that ended before the fight
did; the engine's own end, from the replay's holds: BuffReplay
`staggerHolds`), then broke the bar again at the next logged Stagger hit
(the log lists them at bar 0 with Stagger dealt) and ran a full new
window past the log's end. Starts mostly agree (a frame or so); a few
come seconds early or late where the replay's own hits break a bar the
log's don't, or miss the breaking hit (d4fb 92.4 against 97.0 s, c6d8,
a9d7 197 s). Bigents (tower019) windows run 18–20 s of world time
against its 8 s (489c, 9847, 9c0b).
**Settled: the log's listing is right.** Where the two disagreed, the
597 hits the log lists as Staggered and the replay didn't were ×1.30
(median) the replay's reading, the 214 the other way ×0.77. And no
logged hit falls between a hit that breaks the bar and the first that
lists Stagger (77–2676 ms later, median ~0.65 s). So the replay now
follows the listing (buffreplay.ts `loggedStaggerSteps`, engine
`holdStagger`), as it follows the bar: Staggered through each listed
moment to the next listed one, not Staggered at a moment that lists none
(unless a hit there breaks the bar).
**Ruled out as what lengthens the game's:** a ZMDLogs listing lag (the
damage, above); Stagger dealt while Staggered (no relation to the
excess; and the Talos Wiki's Stagger article, 2026-11-18: "While
staggered, Enemies can't receive more stagger", as the engine has it:
resources.ts `dealPoise` deals nothing while `isStaggered`, the 2 s
recovery included; in-game test 108); target hit-stop (HitStopAction affectType 1/2: per-window sums
3–14 s, no relation); Finishers, Lifts and Knock Downs in the window
(none); the modelled stops (no relation, if anything windows with more
of them run short less); the Slow status (SlowAction: Gilberta's
`move_speed_scalar` 0.8, Typhoeus's combo `persistent_slow` 0.6, movement).
**Still possible:** the Stagger lasting longer than PoiseRecTime (a
recovery animation, an AI state; bigents' far longer); enemy-side slows
the engine doesn't model holding its clock (Arcane's combo SealAction, a
0.2–1.0 time-scale curve over 5 s; Rossi's `ult_stopenemy_elite`,
Tangtang's and Aurora's enemy TimeDilationActions); time stops the data
gives no curve for. Windows with Typhoeus (2.5–5.5 s) and Liino run
long, but so do some with neither. The cost of not knowing is small for
the teams: the engine's Stagger 3.5 s longer moves the three simulated
teams' sustained DPS −1.2% (the owner's), +0.7% (Ink Melt), −0.2%
(Typhoeus's), 32 fresh seeds, within the noise.
**Also left:** hits at the breaking hit's own ms the log lists without
Stagger while the engine counts them (~20 over all logs; their damage is
mixed: ×0.77 and ×1.0), so whether a Stagger starts the frame after
the break is open. And 4e5e's unattributed Stagger (accuracy plan B1's
lead): from 53.2 to 55.4 s the bar falls 68 more than the logged hits
deal, in three steps: 24 at 53.177 s (with Estella's battle skill and
its Cryo-on-Heat reaction, 12 listed), 29.92 at 54.882 s (her combo and
Shatter, 12 listed), 14.04 at 55.403 s (Gilberta's combo, 5 listed);
after that every step matches. The non-whole steps suggest a scaled or
time-based amount (Solidification or Shatter?), not a hit. The replay
takes the bar from the log, so only the engine's own sums miss it.
**Found (test 110 from the logs, 2026-11-18):** the Stagger itself lasts
about 2 s longer. Over 30 windows bracketed within 3 s (bigents, 4d60's
paused one and three the replay broke seconds early aside) the log's end
is a median 2.3 s after the engine's own end (quartiles 1.4–3.9); with 2 s
more on the enemy's clock, a median 0.1 s off, 12 short and 13 long (rms
3.15 → 1.40 s; `staggerRuns(data, fx, { assume })`, the engine's own end
also where the log's calm hit cut it: `BuffReplay.staggerCuts`). The
engine adds it (engine assumption `stagger-recovery`, `2s`): a recovery
after PoiseRecTime that still counts as Staggered. Also ruled out now:
hits extending it (Staggers outlast hitless gaps of 1.8–7 s past the
data's end and end 0.1 s after a hit), the hit rate (r −0.01), Finishers
(r 0.24). A fit: 1.8 s + 1.18 × the ultimates' stops + 0.79 × the combos'.
**Still open:** the spread around the 2 s (sd ~1.4 s, every enemy; the same
scatter as Gilberta's Susceptibility ends, below); whether a freeze holds
it (`stagger-freeze`: rms 1.40 held, 1.42 not); bigents (tower019) 11–14 s
more in 489c, 9847, 9c0b (its own recovery?); 4d60 at 117.2–124.5 s, a
7.2 s gap with no hit from anyone and Akekuri's chain going on after it (a
whole-game pause the log's clock runs through: anything timed across it is
off by 7 s).
**Next check:** a per-enemy recovery for bigents if a team fights it; the
spread against the enemy's actions (not logged).

## Gilberta's Susceptibility: the engine's Vulnerable count (test 12, 2026-11-18)

**Shows:** the listed value is `rate × (1 + 0.1 × Vulnerable stacks)` (0.30–
0.42 at P0/P1); where the engine's differs (4360 0.33 / 0.39, 489c and d572
0.39 / 0.42, 9847 0.30 / 0.36: one or two stacks low when the ultimate
lands), the damage follows the log's value (86 hits against 24). Her
windows' ends scatter −1 to +2 s around the engine's 5 s plus stops (16
bracketed windows, median +0.4 s), the late listed hits' damage with them.
**Still possible:** the engine's Vulnerable stacks short (a Lift or Knock
Down it misses, a stack's expiry), or the data's count reading something
else (every physical status); the end scatter shares a cause with the
Stagger's (above).
**Next check:** the four logs' Vulnerable stacks before her ultimate,
replay against the listed Physical Susceptibility.

## Smaller, not yet diagnosed

- db87 after the ultimate-placement fix (2026-11-18): Laevatain's ultimate now
  starts at 16.60 s (its event at 18.62 s, the last hit 2.19 s before it, the team
  resuming 0.36 s after, her first enhanced cast at 19.01 s, which the old start
  at 18.62 s put inside her 73-frame cast). Plain 152 → 114: Arcane's level-4
  Corrosion shreds 20.9 instead of 17.6 Heat RES at 20.1 s (Camille's hits ×0.973
  low from 19 s), because her stop now overlaps Camille's combo slow-down
  (16.70–17.20 s) and holds the ramp 0.5 s less. **Still possible:** overlapping
  stops holding a Corrosion ramp for their sum (the engine takes the lowest scale,
  T3); Camille's combo placed 0.5 s early; the old placement's fit a coincidence of
  two errors. **Next check:** other Corrosion ramps across an ultimate stop that
  overlaps a combo slow-down.
- d774's totals (2026-11-18): Zhuang Fangyi's ultimate at 102.17 s now starts
  2.6 s before its event (the same placement rule); her simulated total +11.3 →
  +15.4%, no verdict moved. Not looked into.
- Zhuang Fangyi's `attack1_ult_2_abilityrange` (seen 2026-11-18 while
  checking test 108): 32 hit groups in 5 logs (`efsim zmdlogs census
  --select 'event:attack1_ult_2_abilityrange'`: 3aa6 10, 4bfc 10, 4d60 7,
  d774 4, c6d8 1) under a key no kit hit names, so the placement doesn't
  place them (replay NOLAND, e.g. 4bfc 150.07, 179.17 s). **Still
  possible:** her Empyrean attack 2 (the kit gives attack2_ult the key
  `attack1_ult_1_abilityrange`), or a second hit of attack1_ult. **Next
  check:** `efsim gamedata tree chr_0030_zhuangfy_attack2_ult` for the
  entity it spawns, and the logged key order within an Empyrean chain.

- Si's talent Haste after a burst without an Inksoul (2026-11-16): the
  data (only xianjing_linkline's finish and xianjing_inkboom create
  talent1_speedup; xianjing_inkhurteffect's end doesn't) and the kit give
  none. **Ruled out:** a log check: ZMDLogs records no Haste (no speed-up
  buff in four raw details with 2 Final Stroke, 4 Inksoul-expiry and 3
  no-Inksoul ends), and fixtures keep only buffs with damage effects.
  **Shows (2026-11-16, refreshed fixtures):** `poise.origin` tells the
  path of each Artful Intent burst that dealt Stagger: of the 79 bursts
  in the development logs (multi-target included), 39 are credited to
  Final Stroke (`normal_skill_2`), 33 to an Inksoul expiry
  (`normal_skill_inkmove_2`); 7 deal no Stagger (40d9, 3f78, a7a7, db87,
  e82d, 064b, 4f7e: one each), so their path isn't recorded.
  **Still possible:** the game acting otherwise than its data reads (no
  sign of it). It flips the owner's team's rule comparison (Initial
  Stroke right away +3.0% now, −3.0% with Haste on every burst).
  **Next check:** in-game test 109.

- Laevatain's enhanced battle skill (`normal_skill_during_ult`): ×0.833
  in e989, ×1.083 in db87; its `ratio` key has no value in the data
  (in-game test 20).
- Arcane's talent 1, paramType 4 (−6 on the INT combo) ignored by the
  engine: a second cooldown cut would make INT combos twice as frequent
  (kit review N1; an in-game timing decides).
- 4e5e at 12219 ms: Estella's Lift lists Stagger 10 apart from her
  ultimate's 24, the one exception of 156 to the shared-event rule.
- 1d91: Typhoeus's natural-triggered hits get Barrage Array's +0.10 in the
  engine, which the damage doesn't show (seen before the lance fix: recheck).
- From the roadmap: Snowshine ×0.96
  (04d4), Liino ×1.031 (92b4) offsets; Zhuang Fangyi's Sunderblade count
  (d774); 3aa6's Stagger at 145.6 s; Xaihi's Amp timing (b6aa); Last
  Rite's weapon buff (b6aa); Ember low by one factor. (bdf2's Si combo
  finisher ×1.456: closed 2026-11-14, see "Buffs a cast consumes".)
- b7b3: Tangtang's waterspouts from 15927 ms are ×1.13 the log's in the
  replay (11060 logged against 12495), as before 2026-11-14; it runs the
  replay's total over and the time to kill 1.2% early (test bound 1.5%).
- f879: the placement gives Laevatain's battle skill at 87.1 s the burn
  ticks and explosion logged at 94.7–96.1 s (another cast's): they keep
  its Link since 2026-11-14 (10 mismatches ×1.3). A placement fix
  (logcasts.ts), not an engine one.
- db87: Laevatain's Combustion ticks from 49.3 s lack Si's Amp in the log
  (12325 against 16762 at 47.4 s); the engine keeps the Amp its snapshot
  took at the forced Combustion at 45.7 s. A Combustion re-applied at
  48.6 s (her combo) taking a new snapshot would fit; not checked.
