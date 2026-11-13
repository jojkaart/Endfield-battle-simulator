# Journal

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first. Keep entries short; details belong in the docs they produced.
Older entries (2026-10-21 and earlier): [journal-archive.md](journal-archive.md).

## 2026-11-13: Liino's beats replayed as beats

Goal: replay Liino's battle-skill events in Vocalist Stance as the
stance's beats (the owner), and find why skipping them had cost her
teammates' matches. The data: her volley window is two clips of the
battle skill's own action (frames 45–1691), created once per cast; the
beats create nothing of it, so the kit's window was right. The teammates'
loss was Arcane's: in a7a7 her press at 37415 ms is the battle skill
placed at 40523 ms (351 ms later in the world's time), but the 2.5 s match
ran on the log's time; Liino's recasts had drained the SP, so the extra
press couldn't start and the bug stayed hidden. Done: a kit buff's
`ticksLoggedAs` (schema, loader check; the engine doesn't read it), and
the replay reads such an event while the buff is on as a tick at the
event (bdf2/0eef/d774/4bfc list one weapon heal layer per event); a
logged cast matches a placed one in the world's time (also removes e82d's
extra Arcane touch). Liino's damage error 1d91 +113 → +2%, 1cd1 +96 →
+27%, a7a7 +58 → +2%, 8318 +230 → −7%; Team SP shortfall (15 development
logs) 39 casts / 1673 SP → 21 / 1038. Development plain 36.1 → 35.8%:
1d91 alone (−22 plain; its damage wants a heal more than the beats give,
open-problems). Mean |damage error| 22.1 → 21.7%.

## 2026-11-13: Damage distributions, Ardelia's random sheep count

Goal (the owner's design, the lead's brief): a result is a distribution.
Done: `moments.ts` (five additive fields per outcome: min, mean, max, var,
m3; crit hits, sums, mixtures, compound sums, hypergeometric thinning,
battles combined by the law of total cumulance, Cornish–Fisher 5 / 95%);
`HitDamage.critSpread` and `TimelineResult.moments` (one battle, mean =
its total to the double); `distribution.ts` `simulateDistribution` (K = 8
seeded battles, `--battles k`, only with dodges, chances or crit triggers;
crit mode `distribution` rolls just the hits a crit trigger could fire
on); `KitHit.landedCount` (schema, loader, Ardelia's sheep: 21 counted
casts); `efsim simulate` prints mean ± sd, the 5–95% range and bounds.
Mid-task change (the owner via the lead): min / max are two deterministic
battles, crits never with the fewest landings and always with the most
(assumes crit-triggered effects only raise damage). Totals: only
ardelia-corrosion moved (152,724 → 114,744: sheep × 6.1 / 11); Yvonne's
mean over 8 battles is 476,299 against the one expected battle's 403,505
(her gear's crit trigger never fires there). Monte Carlo (400 rolled
runs) agrees: design.md "Damage distributions". Left: the search still
ranks crit teams over rolled battles and its `--percentile` is the seeds'
nearest rank; the lead's follow-up (crit-triggered buffs at their
expected state, one battle); sheep Stagger at its expected value and hit
events on every planned landing; Rossi's never-crit bound is 268,669
against a mean of 1.17 M (her kit lives on crits: a loose bound).

## 2026-11-13 (night): nine sub-agents, three merges, one proposal

The owner asked for every pending item to run in parallel overnight and
be integrated as it finished. Merged into main, each after `npm run
check` on the merged tree:
- **Damage distributions** (opus): five additive fields (min, mean, max,
  variance, third moment) per hit and per fight; min and max from no-crit
  / all-crit battles; crit-triggered hits rolled in K battles; Ardelia's
  sheep from 23 counted casts (example 152,724 → 114,744). Monte Carlo
  (400 runs) agrees on three teams.
- **Liino's beats in the log check** (opus): her in-stance events are
  beats (no cast, no SP); logged casts matched on world time (this was the
  bug that made skipping them hurt her teammates). Hold-out mismatch 6.2 →
  5.9%, mean |damage error| 17.7 → 16.8%; development 22.1 → 21.7%
  (plain 36.1 → 35.8%, all 1d91: one heal short, open).
- **Freezes** (sonnet diagnosis, opus implementation): on a control-immune
  enemy (a Boss) a freeze holds the freezer's own debuffs (Si's Artful
  Intent fits to ~10 ms); on others, as before, everyone's. The broader
  rule (only the freezer's, everywhere) was measured and rejected (b6aa,
  489c). Aggregates unchanged.
Decided by the logs: tests 72, 17 (Wulfgard), 63, 79, 89, 30, 20 (with 83
and 104 in part). Not an engine error after all: Liino's weapon layers
(the log over-lists; damage fits 4; corrects the lead's earlier reading).
Ruled out: teammates' Final Strike SP as the SP gap (the data gates only
five operators; Tangtang's kit gate is a CheckMainCharacterCondition
branch). Waiting on the owner: Laevatain's test-20 change (local branch
laevatain-data-reading, up to date with main: development mismatch 19.8 →
19.6%, hold-out 5.9 → 5.6%; her examples 1–4% lower). New leads: Arcane's
WILL combo 12.2 s in 0206 against 18 s (test 13, raised); OBJ Razorhorn
17–19 s against 15 s; db87's ×1.3 under Laevatain's sword buff; 1cd1's
team-wide step at 24 s.

## 2026-11-13: Liino's beats, the log triage, Ardelia's sheep

The owner's points first: Liino's logged "presses" in Vocalist Stance are
her stance's beats (every 3 s, music_trigger); her combo doesn't end the
stance; Ardelia's sheep fly at random and she's a support. Diagnoses
(haiku, then sonnet): Cosmovoice's missing buffs after her ultimate are
mostly the log's listing (the damage has them in a7a7, c6d8; 1d91 and
d9e5 standing offsets); 1cd1 alone lacks ATK, and 0eef's early end is
unexplained (Liino down or off the field?). An opus triage of the 98 open
in-game tests ([in-game-tests-log-triage.md](in-game-tests-log-triage.md)):
48 decidable from our logs, 12 with more logs, 24 in part, 14 game only;
six look already decided, four look like engine errors (Liino's weapon
layers up to 11 against a cap of 4: confirmed in 1cd1's listing and
damage). Ardelia: 56 exports and 18 details fetched from ZMDLogs (her
profile, 3.5 s apart; IDs in scratch), 23 ultimates counted: mean 6.1
sheep hits below P3, 8.6 from P3, against the engine's 11 and 14.

## 2026-11-12: Team SP: a 0.5 s pause, regen through time stops

Goal (the owner: "go ahead with the SP gains audit"): why the log check's
replay can't afford casts the logs made (web review row 2). A sonnet probe
counted shortfalls over 38 logs under variants: regen held by others' time
stops and slow-downs (old rule K2) was the largest single loss (about
1400 SP); Liino's presses in Vocalist Stance about 900 (test 103);
Purrchena's block refund about 240; SP for logged-poise basics nothing;
teammates' Final Strikes giving SP a big lead. Done: SP regen and its
pause run on raw time, as cooldowns do (clock.ts, resources.ts;
`spStops` gone), the pause 1.5 → 0.5 s (666bj's in-game test). Checked
here with a top-up probe on the 17 development logs: 13 short / 2921 SP
before, 9 / 1193 after. Development plain 42.4%, hold-out mean |damage
error| 18.5%; db87 −8.1 → −5.9% (Si −10 → −1). The width-8 solo search
now finds 1,148,636 (the old 1,161,309 rotation is still legal and
unchanged: the beam keeps other states). Left: the gains above, then the
pause's length (test 102).

## 2026-11-12: Kit review against a mechanics reference

Goal (the owner): a combat mechanics reference, then every operator's kit
checked against it (flags only), then each flag judged. Done:
[combat-mechanics.md](combat-mechanics.md) (905 lines, each rule tagged
SETTLED / DATA / ASSUMED / OPEN with its source); 33 review files in
[kit-review/](kit-review/README.md): 68 flags, 22 more found while judging.
Real: Laevatain's two battle-skill multipliers, where the data and game-1.6
logs disagree with Zero Sanity's older in-game values (left for the owner,
test 20); one fixture input (04d4's Catcher weapon). Most flags were the
small model reading the raw kit JSON instead of the loaded kit, or unused
data fields: the method found the places, the judging pass did the work.
Several stale "no log has …" notes; Arcane's talent-1 second effect
ignored by the engine (an in-game timing decides).

## 2026-11-12: Arcane's WILL touch takes her window's element

Goal: open problem "Arcane's WILL combo touch" (in-game test 33). The
diagnosis held: with no infliction on the enemy at the touch, a later
consumer still consumes one (9a80's Rossi Lift at 7807 ms). Done: a new
application element `"window"` (model.ts, schema): the timeline state
keeps what each combo-window trigger last saw and when (comboTrigger,
recorded even while the cooldown keeps the window shut); a combo hit reads
the latest since its cast began, else the window's opener at the cast,
else (a window the replay never saw open) the enemy's current element
(landing.ts windowSourceAt). Arcane's touch uses it; `"enemy"` and
`"event"` are unchanged. 9a80 −30.7 → −23.6%, 3f78 plain 34 → 41, 489c,
4a64, e82d closer; fixtures/ and hold-out counts unchanged. Dead ends:
the opener at the cast only (0eef −19.9%: the replay casts the combo
before Si's same-ms Cryo, the old dead end); every event the trigger saw
(1cd1 worse, one hold-out log much worse). Open: e82d's extra replay
touch; first opener against latest (test 33's new form).

## 2026-11-11 (late): reaction levels from the log

Goal: 4a64's Corrosion at 52982 ms (replay level 2, the log's 1) and
3f78's at 46994 ms (replay 1, the log's 2). Verified: the replay's enemy
had other Cryst stacks (4a64: a Xaihi battle-skill hit at 33.8 s the log
never shows; 3f78: at 45458 ms Arcane's ultimate landed before Xaihi's
Cryst). Done: the buff replay is made again with the levels the log
shows (logcheck.ts loggedReactionLevels; TimelineScenario
loggedReactionLevels): by the reaction hit's damage, ties by the
reaction check. Decision: the damage alone doesn't decide 3f78 (level 1
with a set buff fits too) nor 489c's Combustion (level 3, or 1 with a
crit), hence the reaction check as tie-breaker, and the replay's own
where neither decides. 4a64 plain 68 → 114, 3f78 mismatches 8 → 5; the
hold-out plain +5, mean |damage| 18.4 → 18.7% (one log −8.3 → −10.1%).
Not done: the replay's inflictions themselves (casts whose hits the log
doesn't show) aren't checked against the log; that is the real fix.

## 2026-11-11 (later): Si's press before an inferred Final Stroke

Goal: 3f78's Inksoul burst at 22689 ms had no landing (the lead in the
accuracy plan, item 10). The diagnosis (a hitless press dropped) was
half right: the press does `leadsTo` the Final Stroke inferred from the
burst, but replayedSkill judged availability by earliestStart, which
waits out Artful Intent, so it read her battle skill and skipped Initial
Stroke. Now judged at the press, and never as the inferred skill itself
(else e989's 67244 ms press is an early Final Stroke). Bursts now land
in 3f78, 40d9 (the kill: Si's total −2.3 → −17.9%, the old early
burst's uncapped damage had hidden her combo's −22.6%), 6339 and 9555;
458b plain −2; no hold-out log moved. Not done: a rule from a variant's
consequence keys (inkmove_2 for Initial Stroke) wasn't needed here.

## 2026-11-11 (night): Round 3 from the register

Goal: the register's next checks, one small-model agent each, both lists
asked for. Found: e989's Si 0 attribute nodes (the weapon-level
alternative ruled out by trying both), 0c14's Alesh a level-60 weapon and
Rossi a food, db87's Arcane a level-80 weapon, and a bias in the totals
(unlogged crits counted at expected rates even when the value says crit:
hold-out mean damage error 20.3 → 18.4%). Ruled out: Corrosion for
Rossi's ultimate residual in 9a80 (the replay's level fits exactly); the
Liino "volley" doubling being merged projectiles. New leads: Gilberta's
Vulnerable stacks (3 against 4), Hard 27's enemy acting like resistance
11, the Corrosion-family buff on Cryst being a DEF decrease the engine
models as a resistance shred (in every log that has it).

## 2026-11-11 (evening): A register of what isn't ruled out

The owner: the reports said what each problem isn't; what still could be
was kept only as one "best hypothesis" or not at all. New
[open-problems.md](open-problems.md): per problem, what the logs show,
what's ruled out with its evidence, every candidate still standing, the
next check. Diagnosis briefs now ask for both lists. One candidate found
while writing it: e989's Si ×0.940 fits 0 attribute nodes (×0.9400) and
a level-80 weapon (×0.9370) alike.

## 2026-11-11 (later): Diagnosis in parallel

Goal (the owner): diagnose the development logs with several sub-agents
at once, small models first, a larger one for what they can't; fixes
made and verified here. Eleven reports in one round; what held up:
Lift's Stagger (above), the totals dropping a kill that landed 65 ms
late (a27b), Liino's lance layers taken from a log that lists none of
her buffs (1d91: plain 33 → 251), food the eny_0134 logs never list
(e989 fits Jakub's Legacy exactly: plain 0 → 179), Mi Fu's World
Splitter as Crush DMG (in-game test 91 answered, ×3.22 → exact), and an
operator's own ultimate stop not held by a combo's slow-down (Rossi's
crit buff in 9a80). Development plain 25.5 → 37.9%, hold-out 49.3 →
49.7%; the hold-out's mean damage error rose 19.7 → 20.3% with the last
change (fewer frames lost). Dead ends: Hard 33's slug (its number
shield goes with debuffs the engine keeps: an unmodelled boss phase),
Jade Vessel (the log lists it; it isn't the cause). Agents' first
explanations were often wrong (e989 "not constant", Rossi "placement");
the arithmetic in their reports was mostly right.

## 2026-11-11: The replay's Stagger bar follows the log

Goal: the screened development logs, largest problems first. e989 is low
for every operator by a constant per operator; nothing found yet (gear,
listed buffs, stage tags all match). Hard 33: its slug refills its own
Stagger bar, so the replay Staggered it where the game never did. The
replay now sets its bar to the log's before each hit with Stagger and
ends Staggers of its own the log doesn't have: plain +207 over all logs,
hold-out 47.7 → 49.3% plain. It exposed a double count: the engine's
Stagger from a hit and from the Lift or reaction it causes (one event in
game; 4e5e's total +6.2% now). Lead for B1, settled the same day: the
logs list one event for a hit and its Lift (155 of 156), so Lift and
Knock Down lost their formula Stagger (4e5e −1.7%). Diagnosis now runs
in parallel sub-agents (the owner's call): small models diagnose, the
fixes are verified here. Their reports: Rossi's ultimate ×2.6–3.2 low
(9a80, 489c); bossrush04 (3f78) ×1.2 on Corrosion-routed hits and two
unlanded Si Fixed DMG hits; Hard 33's Jade Vessel bonus applied where
the game doesn't; Liino's battle skill replayed in full where the logs
show no projectile; e989's ratios aren't constant after all.

## 2026-11-08 / 09: New logs chosen by rule, with a hold-out

Goal (the owner): pick logs whose builds need no guessing, rather than
fit inputs to logs. Agreed rules in the accuracy plan ("Choosing logs").
Screened 80 loadouts (export endpoint, 3 s apart) from the favourites'
profile lists: level 90 everywhere, parser v59, single-target stages,
favourites spread (Rossi added to them). 17 single-target logs imported;
9 turned out multi-target (not visible before import); Tower 1 refused
(a stage buff's zone). A third of the 17 is a hold-out, drawn by fixed
seed before any check was read: measured only, never debugged. Decoded
along the way: `weaponRefine` = weapon potential + 1, and the logged
unique-skill level includes it, so the engine was already right there.

## 2026-11-01: Build inputs the export doesn't give

Goal: Liino's 100 mismatches in d774, all ×0.937. Not her kit or stats
(her Amp confirms her Will, the raw log her gear): her weapon was level
80, which the importer can't know (it assumes 90; skill level 9 needs
only the last breakthrough, at 80). A scan for operators with one factor
on most hits found Akekuri (weapon 80) and Si (2 attribute nodes) in 458b,
and Purrchena (weapon 84) in 04d4. The check now reports such offsets
with the inputs that explain them (`buildOffsets`), and those fixtures
carry the inputs with notes. 458b plain 445 → 895, mismatches 560 → 27;
d774 +45 plain; 04d4 0 → 160. Unexplained offsets are listed as leads.
458b's remaining mismatches are Combustion ticks: they answer in-game
test 77 (two ticks of one burn ×1.3 apart, Stagger only, despite new ATK
buffs: the ATK snapshot holds), and show a step up after a later Heat hit
(a refreshed snapshot?), a lead.
Then (2026-11-03) the offset search tries a lower weapon level and fewer
attribute nodes together when neither alone fits: 4bfc's Arclight is
both (plain 400 → 558). Dead end: the builds with a duplicate accessory
(9555's Si, 04d4's Snowshine) fit neither with nor without it.

## 2026-10-30/31: A kill's span on both sides; bosses and freezes

Goal: the owner's point that when a log stops counting at the kill, both
totals should stop there. They didn't: the replay stopped at the enemy's
HP, 1 s before b7b3's kill, so Arcane's last second counted for the log
only (her −43%). Both now sum to the log's kill, and when the replay
reaches the HP is its own "time to kill" row. The cap had hidden an
overshoot: b7b3 +25.2%, 7e19 +15.4%. In b7b3 it was the placement:
Tangtang's dive spouts (fired by Arcane's plunging attack) share her
battle skill's key and were placed as an extra battle skill. A trigger
fired by decorated hits (a dive) now anchors on those logged hits
(`firedAt`): b7b3 +15.5%, nothing else moves. Last Rite's third
ultimate slash isn't in b7b3's log (+42% for her); the owner: assume the
log lacks it. Its HP bookkeeping agrees the log can't show it (the hits
sum to Rhodagn's HP exactly, the killing blow capped), so it didn't hit
him. Fixtures now take a hand-written `absent` list the totals leave out:
b7b3 +1.8%. Left: Arcane's Cryo burst times, 7e19's Crush matching.
Then (2026-10-31) the verified totals' bound went 45 → 12% (worst now
0eef −10.2%), and Arcane's Cryo bursts: the replay froze Rhodagn for
Tangtang's stare, holding them 7 s; the log has them due by the time
stops alone. The data skips freezes on control-immune enemies without a
table of which; Bosses (rank 2) are now assumed immune (b7b3 Arcane
+13.7 → −0.3%, c3c7 +7.9 → +4.7%). Dead end: bursts on the world clock
by the burst buff's `useTimeDilationDt` (false for every common buff,
Artful Intent too, which a freeze does stretch). In-game test 104 asks.
Then dbae's Arcane −33%: Cosmovoice was on Liino's first projectile
landing (pinned to its logged time) instead of her frame 77, and a time
stop starting inside her own shifted that frame's action by 1.2 s. Now a
frame-77 trigger, and the hold starts after what's due at the own stop's
end. Side effect caught by bdf2 and 0eef: the buff-lane inference read
Vocalist Stance's ATK (same game buff, from a hit) as ultimates. dbae
−2.2% (Arcane −19%), a7a7 −0.7%. bdf2's Si −11% is one combo finisher
×1.456 with no count that fits: a lead.
Then dbae's last Arcane gap, her burst: made inside Xaihi's ultimate
stop, it wasn't held by the stop's rest. Three rules tried: the enemy's
clock through every slow-down (0eef worse: Arcane's own combo held her
burst), ultimate stops only (dbae's still early), its operator's clock
(held by others' stops and slow-downs, not its own). The last fits both:
dbae Arcane −19 → 0%.
b6aa's Last Rite combo lacked Xaihi's Amp: her logged ultimate cast is
her stop's end. Such a hitless ultimate now starts earlier when the log
is quiet for the stop's length and another's hit lands at the event
(without that last check e82d's Xaihi moved wrongly). b6aa plain 217 →
236, c3c7 96 → 113, 4bfc +10. Dead end: Liino's volley trigger in bdf2
(no reaction before the 3.2 s volley; ~4k damage, left).

## 2026-10-29: Liino's team ATK through the logs' presses

Goal: B8's Liino lead. The largest gap was d774: her stance's team ATK
on in the log from 54.6 to 115.9 s, off in the replay. The enemy is gone
from 30.6 s (no hits), so her battle skill at 49863 ms hit no one, and the
replay skipped the press as an unshown variant. Such a press (`unseen`:
no hit by anyone within 1 s of its first landing) is now cast when the
slot holds it: d774 plain 33 → 147, c6d8 0 → 29. The data also has the
stance's ATK lingering 5 s after it ends (`atkup_finishtime`, kit
`vocalist_linger`); c6d8's log suggests ~1.7 s after an End Stance, so
test 28 now asks. The presses every ~3 s in every Liino log are the
stance's soundwave heals, not casts (her stance and volleys go on).
Dead end: casting every available press (458b, c3c7, dbae worse; it even
re-cast Liino's ultimate from the "ultimate" presses during Cosmovoice).
Then Typhoeus's off-field chain: the replay made the chain's next shot
and the logged one 2 frames later; a logged cast now takes the place of
a follow-up cast due within 10 frames before it (dbae +9.9 → −4.2%).
Then 012a's early Stagger: Arcane's Cluster Strike lasers had 20 Stagger
each in the kit (a misread literal; no logged laser has any), and
Camille's combo was placed as three casts around a misplaced attack 3.
Stagger starts now come within 1–4 s of the logs; plain 012a 138 → 226.
Some totals fell (b6aa −15.3%): the false Stagger's ×1.3 had hidden
deficits, which are leads now.
b6aa's next: every hit under its Corrosion implied ×1.25 the engine's
shred, level 3 against the replay's 2. The missing Cryo stack was Last
Rite's Mirage, needing a battle skill the log never shows (cast beside her
basic attack). The replay now infers such a cast from the trigger hit
(`castsFromTriggerHits`, beside-capable skills only: unrestricted it
invented an ultimate and a combo). b6aa −8.4%, plain 62 → 216; 9555
−17.4 → +5.7%. Then 9555's Si: two usp02 wearers' team DMG stacked in the
replay; one-layer stackingType 2 buffs on others are one group now
(9555 +2.3%). Then Zhuang Fangyi's strikes: the kit was right, the
placement wasn't (her strike variants' finals sat between strikes): slots
follow the largest variant, and a logged press starts a new cast. 3aa6
−10.6%, 4bfc −12.9% (plain 206 → 311, 209 → 406). Dead end: bounding
joins by slot frames (split her plain battle skill and Last Rite's combo).
Not engine leads: 3aa6's Stagger compare (the poise print fired in
speculative states too), Si's build in 9555.
Liino's +124% in d774: one ultimate placed as three casts from its keys;
an ultimate's casts now merge within its duration (d774 Liino +29%,
4bfc Liino −5.7%). Anchored triggers (Liino's song beats) can move their
cast earlier (4e5e −2.8%). Zhuang's Sunderblade counts differ from the
log both ways (they hang on the Electrification replay): not a quick fix.
Si −27% in 0eef is one crit, not an error. a7a7's Si: the next cast cut
an inferred Final Stroke before its Artful Intent end; it keeps it now
(a7a7 −2.2%). Dead end: skipping Liino's in-stance presses when the
slot doesn't hold her battle skill (her +61% → +1%, the team worse):
in-game test 103 asks what they are.

## 2026-10-28: Typhoeus's burst on the enemy's clock; dbae verifies again

Goal: Arcane's Nature burst at 10341 ms in dbae (B8), which held back
Xaihi's verification. It wasn't Arcane's kit. Typhoeus's Power Shot burst
waits 0.35 s on the enemy's clock (the data: the arrow's hit consumes the
stack and creates the burst buff, whose `triggerInterval` runs from
then; time stops hold it). The kit landed the burst with the arrow, so the
placement made bursts 1–2.5 s late into shot casts of their own. One of
those used up the stack her touch needed. New `KitHit.enemyDelay`
(effects at the landing, damage on the enemy's clock), the placement
joins a delayed landing to its shot across time stops, and two replay
faults went with it (a delayed landing kept the cut cast's hover end;
same-skill casts within 1 s shared a lookup). dbae back in fixtures/
(Typhoeus plain 1 → 18, Xaihi 0 → 6), bdf2 +0.1%, 92b4 plain 29. In-game
test 47 is answered by the data; test 33's first half by the logs (the
bursts credited to Arcane after her touch are its own, 1 s plus stops).
Dead end: her touch's element as the window's trigger
(`element: "event"`) made 0eef −23.8%: the combo is cast at the same ms
as Si's Cryo hit that opens it, and the replay casts first. Kept the
enemy's current element (test 33's second half decides).
New lead: 012a's replay breaks the Stagger bar 17 s before the log does.

## 2026-10-28: accuracy plan B2–B7 from the data and the logs

B2 (SP pause): neither the logs (no SP in them) nor the data say; in-game
test 102 measures the stop as B − A of two timings. B3: the logs don't
show Corrosion too strong (the plan's guess); the data's carry-over on
reapplication was missing (a7a7 −19.4 → −8.8%, plain 137 → 315). B4:
Solidification's length isn't in our data or the logs (test 71). B5: the
data's 11 s Combustion made the replay's ticks worse (458b 60 → 53 against
58 logged): kept 10 s, with the numbers in the code. B7: the one-element
key `buff_common_natural_triggered` is Corrosion's own hit, made before
its status (so without its own shred): the "×1.42" of batch 1 L2 is gone
(the engine moved since); 0eef, bdf2, d572, a7a7 match it plainly.
Dead end: a 10 s / 11 s A/B with a half-reverted sed gave a wrong reading
(one of the two tick conditions stayed): compare from snapshots.
Then B8 for Typhoeus: her hover ended early in the replay (keepPrevious
kept the cut loop's landing; her combo placed as the grounded variant):
bdf2 plain 105 → 123, 92b4 → 0%. Keeping only hits on keepPrevious was
tried first and lost real delayed buffs (Liino and Si −11–13% in bdf2):
only follow-up casts are dropped now.
Zhuang Fangyi: battle-skill presses during her ultimate become her ult
battle skill when its own keys follow (3aa6 −40.7 → −23.8%). c6d8 then
shows a ×10 damage reduction on its boss the log doesn't list (Arcane's
ultimate 0.100× exactly): next lead there.

## 2026-10-28: accuracy plan B0, teammates' own basic attacks

Goal: B0's second half, in `simulate` and the search. Measured first from
28 logs, with the replay's teammate casts: teammates step through their
chains at the windows' pace, their runs end in a pause (median 3.5 s,
quartiles 2.1–6.8 s) or at their own skills, and they attack a median 39%
of their free time (the controlled operator 60–80%; the owner: "not quite
at the pace"). Engine: `timeline/teammates.ts`, a scheduled `auto` per
teammate (chain at its windows, 3.5 s pause after a full chain, held by
its own action and hits, cut at once by its own casts: actionGate,
ownHitsLanded, afterCantCast and exclusiveUntil treat an `auto` action as
none); a swap or a control-taking skill hands it over; same-frame ones go
by operator ID (team-order test). On in scenario files (`teammateAttacks`,
default true), off in the engine API (tests, the log replay). Cast table
marks them "(own)". Examples rise where a support is controlled and a
damage dealer is a teammate (akekuri-laevatain +66%, antal-focus +37%);
solos unchanged; rossi-gilberta's seed −18.7% is the shared crit stream
(mean of 50 seeds +2.3%). Four kit tests set it off (their frame-exact
checks of the examples' rotations); Tangtang's counted all casts.
Search ~1.5× slower. In-game test 101 asks for the pace.

## 2026-10-26: accuracy plan B1 (Stagger), and who the log shows controlled

Goal: the plan's B1, the engine's largest known error. Downloaded the 29
battle details again (scratch only, 3 s apart) for their `poiseDamage`
per hit (the bar after each hit), now kept in fixtures as `LogHit.poise`
(`efsim zmdlogs refresh` replaces `zmdlogs casts`; it also added the
logged casts to 23 fixtures). Findings (accuracy-plan.md "B1 done"): the
kits' Stagger per hit is right; the bar never recovers on its own
(in-game test 99 answered); a window is PoiseRecTime plus time stops plus
~1 s; bosses refill the bar themselves (second lives; Rhodagn in three
of five fights at 29.5–45 s, not at a fixed HP: test 100 asks the owner).
The real bug was the replay's: it made every basic attacker controlled,
but teammates attack on their own (B0) and their Final Strikes deal no
Stagger (the log: one operator per fight has Stagger on basic hits). Now
the controlled operator comes from those hits and the others' basic casts
replay as theirs (`replayCast` `teammate`); the replay takes the log's
recoveries (an enemy action `recover` the engine now has, refillPoise).
Also: a logged cast inside its operator's own cantCastSkill channel keeps
the running cast (Xaihi's ultimate Amp in dbae, A6's leftover).
Plain matches up nearly everywhere (abfd 31 → 270, 458b 294 → 442, a7a7
0 → 137); totals abfd −34.6 → −6.5%, e82d −32.7 → −9.1%, 458b −15.2 →
−1.7%. A few totals moved away from 0 (4e5e −0.7 → −5.2%, c3c7 +0.1 →
+7.9%): the false Staggers had offset other deficits. dbae is pending
again (Xaihi's hits need Arcane's Nature burst, which the reaction replay
doesn't make). Dead end: a 70%-HP phase rule for Rhodagn (40d9 and e82d
pass 70% without a refill). Left: B0 in `simulate` and the search
(teammates' pace, now measurable), 4e5e's 24 unattributed Stagger at
53.2 s.

## 2026-10-26: accuracy plan A1, casts the log placement merged

The owner on teammates: they basic-attack on their own, slower than the
controlled operator, not during e.g. Liino's stance and ultimate (plan
B0); and later: "Liino's skill only blocks it for Liino herself. The
other operators do keep attacking and even Liino's stance is doing damage
to enemies, but through the skill instead." Then A1 (accuracy-plan.md
"Progress"): four placement and replay
fixes, not one: a cast with all its known landings of a key logged takes
no more; stack requirements are alternatives at one frame; casts placed
from the same key aren't merged as one cast; shared-key chain steps by
the windows, and in the replay by the engine's state (Typhoeus's hover
attacks are gated by her ABATK stack, not windows: placing them by
windows alone didn't help, removing the window rule lost Rossi's gains in
4e5e / d572 / 2fd9 / 99fb, so both stay). Typhoeus's arrowrain key back.
92b4 −34.8 → −3.1%, bdf2 −28 → −9.3%, dbae −43.9 → −20.6%, 4e5e −12.5 →
−6.5%; Rossi's 4e5e hits all match now (the killing blow too). Some plain
matches drop where the extra landings bring the replay's (wrong) Stagger
earlier: B1 next after A. A3 (unknown crits at expected crits in the
totals) and A4 (a kill caps the replay's damage at the enemy's HP; the
"last hit" error is then the time to kill: b7b3 −10.5%, 7e19 −6.6%): 4e5e
now −0.7%. A2: Si's Initial Stroke from her logged press (a "slot" cast,
only when it leads to a cast the log implies), Final Stroke inferred from
the burst after Artful Intent's end (castsFromBuffEnds; not when the
buff's own expiry explains it); a first version substituted Liino's
logged press during her stance as End Stance and dropped the stance's ATK
(0eef Si plain 9 → 1): substitutions now need a logged consequence. 0eef
−26 → −11.8%, bdf2 → +0.5%, b6aa → −20.5%, c3c7 → −5.1%.
A5 is a kit item: the male Endministrator's skill files all differ from
the female's (timing and actions). A6: e82d's missing Amp was Si's own,
held by the engine through Arcane's ultimate cast inside Si's; shifting
cast starts in the placement instead was wrong (b7b3 plain 38 → 13),
reverted. The engine no longer holds an operator during another
ultimate's stop while its own ultimate's stop runs (interim, one log;
in-game test 18 has the check): e82d −51.8 → −32.7%, c3c7 → +0.1%;
examples with overlapping ultimates +2–13% (camille-gilberta +13.0%).

## 2026-10-26: what isn't simulated accurately (three audits, a plan)

The owner put engine accuracy above the search's scoring and asked for a
comprehensive analysis. Three read-only audits (logs, kits vs data,
engine mechanics) → docs/accuracy-plan.md. Main finding: most of today's
log totals error (−12% to −61%) is the log tooling's (casts merged under
1 s, Si's Final Stroke not replayed, unknown crits read as non-crits,
damage past the kill, a missed event prefix, hitless casts' Amp); the
matched hits alone are −2.6% to −19% in the verified fixtures. The
engine's largest known error is Stagger (the bar never recovers: wrong
windows in 22 of 29 logs). Checked by hand: `CAST_SLACK_MS` 1000; the bar
only falls; the native settings' Solidification 6–9 s and
`atbRecoverInterval` 0.5 (the engine pauses SP 1.5 s). Asked the owner
whether teammates basic-attack on their own: "Yes, the non-controlled
operators do basic attacks on the enemies, though not quite at the pace
the controlled operator does and certain skills, like liino's stance and
ultimate prevent that." Now plan item B0.

## 2026-10-26: stack groups ranked by the data's priority key

The owner asked how "the strongest instance" was decided when two buffs
in a stack group each win at something; it was the sum of the effect
values (a crit rate added to a DMG bonus, attribute points outweighing
both), an engine guess. The owner: "Even if it's latent today, we should
consider this a bug and fix it." The game ranks by one value, the game
buff's stacking priority key (BuffData `priorityKey`). Now
`KitBuff.priority` (`from`):
- `effect` (23 buffs): one of the game buff's attribute modifiers reads
  the key, so the rank is that effect's value at creation (the kit
  modifier standing for it; ATK is zone `atk`);
- `key` (15): the key's value in the applying skill, else the game buff's
  own (as for the instance limit, B2; Tangtang's Haste: per applying
  skill, since only some have `ratio_speed`);
- `kit` (6: Last Rite's Hypothermia, Tangtang's two Waterspout
  Susceptibilities, Si's talent Haste, Grizzled Edge ×2): a parent buff
  fills the key at creation (e.g. `priority` ← `phy_dmg_up_final`, the
  same value as the effect's `phy_dmg_up`); the kit states it, each with a
  note.
tests/kits-priority.test.ts scans every CreateBuffAction in the fetched
data: a key filled from another value, or read from nowhere (no applier
has it, the buff's own is 0), must be `effect` or `kit`. Without it a
first version silently ranked Grizzled Edge's instances at 0 (the latest
acted): mifu-dapan −4.6%, which the test then caught. The instance limit's
"weakest goes" uses the same rank. Ties: the latest acts. Groups without a
priority key (wpn_pistol_0011, wpn_sword_0020): the latest acts, an
interim. No example or log result moved; 28 kit digests did (the field).

## 2026-10-25: the 4-operator example without swaps

`efsim search --beam 12` without swaps (the default since the owner's
call): beams 6 / 12 / 24 → 2,434,451 / 2,650,070 / 2,691,389 (spread 9.5%,
77 s in all; with swaps it took ~5 min). The example's rotation is now
that one (41 actions, no swaps; Si controlled does every basic attack):
2,691,389 against the swapping rotation's 3,464,381 (snapshot updated;
design.md's table). Laevatain 70% of the damage, Si 20%.
In-game tests: a queue of the ten that decide the most (top of
in-game-tests.md), each with a one-line reply.

## 2026-10-25: CLI checks first; a pre-merge script (review round two, 7)

`efsim` loads the game data on first use, after its arguments and input
files are checked: a typo now fails in ~0.3 s instead of after the load.
`scripts/premerge.sh [base]`: refuses a dirty tree, a worktree without
its own packages linked, and a branch that changes code, kits or examples
without a journal entry; then `npm run check` (CLAUDE.md points to it).
Docs: entries before the review (2026-10-21 and earlier) moved to
docs/journal-archive.md; the roadmap keeps only what's next (64 lines from
144).

## 2026-10-25: formulas from the data (review round two, 6)

- **Burst and reaction DMG (35–38, 56–59):** no equippable source writes
  them (the gear sets behind buff_equipsuit_fireup_01 and kin aren't in
  EquipSuitTable; 56–59 are only read by the reaction buffs'
  StoreAttributeValue). The panel now refuses a nonzero one
  (`UNMODELLED_DAMAGE_ATTRS`) instead of dropping it; a test walks the
  data for any (with ATK and Crit Rate as its control).
- **Level coefficient:** read from the panel's attributes 49 (arts) and 25
  (physical) instead of a formula; all 3,605 CharacterTable rows equal
  1 + (Lv − 1) / 196 and / 392, so no number moved.
- **Resistance:** the table has it three ways (fields, attributes 94–99,
  scalars 80–85 = 1 − points / 100). Points now come from 94–99 (ether
  from the data, was 0 by hand); the loader refuses fields or scalars that
  disagree. One exception: eny_0125_fdcentur's scalars are 1 at 20 points;
  c3c7's 55 plain Si matches at × 0.8 say the points count.
- **Limits:** AttributeMetaTable's min / max loaded (`attributeLimits`,
  `clampAttr`): panel totals and the timeline's Haste (was 0.1–1.3 by
  hand), combo-cooldown rate and Stagger efficiency with buffs. Crit Rate
  has no limit in the table; its 0–1 stays a probability rule.
- **Silent defaults:** a missing enemy DEF is an error (every level row
  has one); a modifier's `when` the situation can't decide is an error by
  default, as for `KitHit.if` (it found one path: Arts Intensity for
  statuses judged modifiers without any situation, so a conditional one was
  dropped; it now gets the frame's); the compiler reads a crit-rate
  processor only in the Add slot (formulaItem 5; anything else is noted);
  a kit modifier of zone `atk` (ATK%) requires its game buff's ATK in
  formulaItem 6. No result moved.
- **Stacking:** a stack group's strongest instance acts whole
  (`acting` in buffs.ts; ties: the latest), not the strongest value per
  modifier, which could mix two instances. Every group's buffs have the
  same modifiers today, so nothing moved.
- **Arts Intensity for status strength** is read for no element or kind;
  the loader now refuses a filtered Arts Intensity modifier (none exists)
  instead of the context losing it.
- **One damage path each:** a status event's scale (a Combustion tick's
  damageScale, a Crush multiplier) is a scale part inside
  `computeReaction`, not a multiply and re-round after it; the finisher
  multiplier is one `finisherModifier` for the timeline and the log check
  (the check's copy fell back to ×1 silently). Left from 6's formulas:
  `Modifier` sides (today `SNAPSHOT_ZONES` stands for the attacker side).

## 2026-10-25: Last Rite's battle skill acts once per cast

The owner: "It just makes more sense that the battle skill can only be
activated once." The kit's `mirage` now ends the perfusion for the whole
team (`endBuff` without `to`; per-subject cooldown dropped): the first
controlled Final Strike of any holder brings the one Mirage pair. Before,
each member's perfusion acted once, as the data's `_tag` on the holder
reads (batch-4 B6). b6aa's log agrees with the new rule (one pair after
Arcane's and Si's Final Strikes). In-game test 83 marked decided.
Test failing first (Si's Final Strike, then Last Rite's own: one pair).
`lastrite-si` relied on the old rule (Last Rite's own Final Strike after
Si's used her perfusion): −14% (823,680 → 706,977; one pair, one Cryo
stack, one burst fewer, the combo 0.7 s later on 3 stacks). It now casts
the battle skill beside her first chain's attack 2 as well (SP allows),
which gives back exactly 823,680 (24 casts). Pending logs: the simulated
totals of b6aa and c3c7 move ≤0.8 points (fewer Final Strikes with P1's
+20%); the engine's Mirage counts there didn't move (replay gaps, open).

## 2026-10-25: the search doesn't swap by default

The owner: "For now, I don't intend to do operator swaps during battles, so
the default search should not use them either." `SearchOptions.swaps`
(default false) and `efsim search --swaps`: without it the controlled
operator does every basic attack and dive, teammates cast their skills.
The duo pin at beam 6 is 259,112.742 without swaps (269,470.931 with, both
pinned). In-game tests 15 and 97 only matter for `--swaps` now. Examples
(fixed rotations) are unchanged; si-laevatain-liino-gilberta's rotation,
found with swaps, still swaps.

## 2026-10-25: rotation search: what it finds and how far to trust it (review round two)

**Goal:** the round-two search findings: skills hidden by swaps, dead
deadlines in the state key, pruning by macro state, the beam spread,
`resourceWeight`, the silent expansion cap, a full team never searched.

**Done** (design.md "Rotation search"):
- Bug (failing-first test): a swap could nearly always start at the
  state's frame, so `legalActions` dropped every skill that could start a
  few frames later. Swaps are now asides like the dive: choices when
  legal, not counted for what's soonest. 4 of si-laevatain's 14 decision
  states have their soonest action later than the state's frame (Si's
  combo at 190 from 181). Cost: more states judged in full (2.3 → 3.9 ms
  a state on si-laevatain).
- `stateKey(ctx, state)`: past deadlines and casts nothing refers to drop
  out, cast indices count from the end; each field's reads checked (all
  "later than now" comparisons, but a follow-up combo's window count,
  which castSkill reads unchecked: those windows stay). Tests: added dead
  deadlines give the same key and future; 40 pairs a small beam merges
  play on the same. Merges: si-laevatain beam 24 1,533 → 1,701 of ~9,000
  compared, laevatain-solo 76 → 176 (few).
- Pruning keeps one state per family (the same but for who's controlled
  and the buff order) before the rest: in a team the swapped variants of
  one state, all with one score, filled the beam (the 4-operator example:
  12 of 12 nodes at 671,349 when the better rotation was dropped).
- `searchBeams`; `efsim search --beam w` runs w/2, w, 2w, keeps the best,
  prints each and the spread (`--single`: w alone); `capped` and a
  warning when `maxExpansions` cut it; `counts` (compared, merged,
  family, pruned).
- `resourceWeight` / `resourceValues` and `--resource-weight` removed.
- examples/si-laevatain-liino-gilberta.scenario.json: Si, Laevatain (both
  P0), Liino, Gilberta, all ultimates charged, 20 s, the rotation the
  search found (3,701,403). tests/slow/search-beams.test.ts: ratchets.

**Numbers** (single widths 12 / 24 / 48): si-laevatain 2,142,022 /
2,147,903 / 2,064,639 (16: 2,051,398) → 2,094,656 / 2,156,233 / 2,185,220;
laevatain-solo 1,165,844 / 1,194,306 / 1,196,307 → 1,165,844 / 1,165,844 /
1,196,307 (the key's extra merges changed which states the beam kept);
liino-laevatain (after the swap fix) 1,510,467 / 1,514,664 / 1,526,692 →
1,510,467 / 1,402,446 / 1,511,305; the 4-operator example at 6 / 12 (/ 24)
3,016,009 / 1,557,958 (Laevatain never cast her ultimate) → 3,554,349 /
3,701,403 / 3,173,136. Pins: laevatain-solo at beam 8 the same total, 524 →
523 states; the duo at beam 6 264,949 → 247,209 (swap fix) → 269,471
(families; by chance the old key's total). Examples: none moved; one
added.

**Decisions and why:**
- Families, not macro-state caps: capping per (controlled, SP band,
  ultimates ready, combos ready) or per ultimates cast, with or without a
  reserve, moved results both ways (solo 1,165,844 → 1,006,745 at beam
  12, the team still 1,576,033 at 6); families fixed the team's collapse
  and changed nothing for one operator.
- `resourceWeight` removed rather than replaced: at weight 1 it hoards,
  at 0.1–0.3 it helped si-laevatain at beam 12 without families but
  lowered every result with them (liino 1,510,467 → 1,436,660, the team
  3,554,349 → 3,316,409), and its one-cast prices can't value an ultimate
  that enables (Laevatain's ≈ 0). A cheap rollout per node costs about a
  legalActions per step: ten times the search.
- Three widths by default: the spread is the honest answer to "how far to
  trust it", and the best of three is a better answer; `--single` for a
  third of the time.

**Dead ends:** macro-state diversity and resource weights (above).

**Left:** the ranking (damage so far) is what still makes widths
disagree: the beam of 24 drops liino-laevatain's better rotation at frame
198, 13% behind for now; Si's Initial Stroke and Laevatain's ultimate pay
off later. A 4-operator state costs ~26 ms (landing hits: the damage
path and trigger scans, other agents' area). Team rotations swap between
two operators' basic attacks and dive in the air: in-game tests 15 and 97.

## 2026-10-25: the log check runs through the engine (and the bugs it showed)

**Goal:** fix the blind spot pinpointed below, and the owner's rule
for the check: "if our engine can simulate something, the log [check]
should run that and compare the result with what the log says"; also
"always look at the percentage error in damage output and other relevant
totals". Then the bugs it exposes and round two's smaller engine bugs.

**Done** (one commit each; design.md, "The log check's rule"):
- Stagger counts once: `staggerModifier` (multiplicative, from
  BuffData buff_common_poise_break_damage_taken_scale's ProdCalcZone
  processor, `GameData.constants.staggerDamageTaken`) is the pipeline's
  one representation; the Stagger zone and STAGGER_DAMAGE_TAKEN are gone.
- The check reads each hit through the engine's damage path at its
  landing (`LandedHit.inputs`, `landingDamage`, enginecheck.ts); from
  the log only the crit, buffs no kit defines, the hitter's food, the
  enemy's HP, and what the replay can't judge. Kit buffs map to the
  names a log uses (`gameBuff`, `KitBuff.loggedAs`, and the affix buffs
  their files create: `RawBuffFile.affixes`), so nothing counts twice;
  the log's entries verify the engine's modifiers (the report's "engine
  against the log's listing"). The old readings are the labelled
  fallback, their Stagger the pipeline's own (Staggered-only modifiers
  apply). Totals simulated against the log's (damage per operator and
  kind, hits, status hits, hits under Stagger, last hit, crit share) are
  in the report, the verdict snapshots and the pending README.
- A pinned landing takes its own logged hit's crit (`loggedCrits` ref).
- Round two: a combo waits for anything that opens its window
  (`nextEventAfter`: enemy actions, bursts, ticks too) and startFrom
  judges all its gates again until the start settles; `enemyFrozenUntil`
  moves with time stops; ending a buff for one member rebases
  cooldowns; a cast spends the SP at its own frame; the perfect dodge's
  SP goes through `gainSp`.

**Numbers** (verified fixtures; all six still verify): plain 396 → 372,
assumed 303 → 76, fallback 49 → 300 ("plain" now means the engine's own
reading, so the ratchet's baseline was reset on purpose; per-cause
counts in the commit a778098). The engine's state fits where the old
readings assumed: b7b3 Tangtang plain 2 → 21, Last Rite 0 → 4; 0eef Si
5 → 9; 4e5e Rossi 38 → 55, Estella 21 → 28. Where it doesn't, the report
names why: Rossi's Wolven Blood layers, the replay Staggered where the
log isn't (4e5e 23–34 s, bdf2 19–24 s), Typhoeus's hover ended by her
combo, Arcane's WILL buffs, Camille's weapon ATK, a Corrosion the log
never lists (40d9), statuses and landings the replay doesn't make.
Totals (simulated / logged − 1): 0eef −27.1%, 40d9 −12.9%, 4e5e −12.5%,
b7b3 +23.1%, bdf2 −28.0%, dbae −43.9% (bound 45%). Pending (20): plain
1947 → 1334, fallback 1100 → 2736, mismatch 6004 → 5759. Negative
control: 4e5e 3 of 345 at ×0.97 (was 2), others 0. Examples and search
pins: unchanged (no example staggers its enemy, which is itself worth
a look).

**Decisions and why:**
- Kit buffs the replay can't judge (chance, enemy actions, heals of the
  controlled operator) take the log's entries in the primary reading:
  outcomes the engine can't produce, like crits.
- A disagreement on something the engine models (Stagger, Corrosion,
  layers) is a lead, not an assumption: such hits fall back, labelled,
  rather than match "assumed"; only what the replay's own timing leaves
  open (500 ms edges, unlogged crits) is tried as an assumption.
- The affix mapping is data (VulnerableAction / EnhancedAction subType
  → element, checked against the actions that name their child buff);
  `loggedAs` only for names the data doesn't link (Liino's `_owner`).
- `engine: false` keeps the fallback's readings testable on their own.

**Dead ends:** a constant-ratio search for the remaining fallbacks by
repricing zones (ATK's formula made it unreliable); the replay's
`loggedModifiers` path (the check now adds the log-only effects itself,
for status hits too).

**Left:** the leads above (roadmap 3); the enemy's side of conditions is
still tried both ways; poise per hit isn't in the fixtures (the API has
`poiseDamage`); reaction levels from the log are tried; 458b's
Laevatain ×1.3 stays unexplained; totals' error 12–44%.

## 2026-10-25: why the log check missed the Stagger bug (pinpointed)

**Goal:** the owner: "it seems we've got a bug in how the log check
operates, since it missed the error. Let's pinpoint and fix that bug too."
The error (round-two review, 5): a Staggered enemy took ×1.69 in
simulations (`damageOptions` passes `staggered: true`, the ×1.3 Stagger
zone in damage.ts, and adds the multiplicative 0.3 "Staggered" as well),
since 2026-10-18 (f7fb100, batch 1 P2).

**Cause (confirmed):** the check never ran the simulation's damage path.
`checkLog` calls `computeHit` with options of its own for every reading:
`staggered: false` and the log's listed zone values (the ×1.3 came from
the log's `buff_common_poise_break_damage_taken_scale` entry), its own
finisher modifier, Link modifier, Corrosion on the log's clock, its own
situation; the replay (buffreplay.ts) only told it which kit buffs were
on. So the simulation's `damageOptions` (where the ×1.69 was) was never
compared with a log, and a fault anywhere in it was invisible. Evidence:
`zmdlogs check --simulate`, which does compute each hit at the replay's
landing through the simulation's path, disagreed even on plain matches
(b7b3 Si t=4862: plain match 4886, simulation 5631; Tangtang 0 of 45;
median logged / simulated 0.58–0.90 on the verified fixtures), but no
test asserted it: of 396 plain matches in the six verified fixtures, the
simulation reproduced 105 (the new test in tests/logs.test.ts, below).
The example snapshot didn't help either: it pins whatever the engine
computes (a regression baseline), so the ×1.69 was in it from the start,
and tests/timeline.test.ts only checked that a "Staggered" modifier
exists, not the hit's total factor.

**Where the check duplicates the engine** (instead of calling it at the
landing): (1) Stagger: `staggered: false` + the log's ×1.3, so
Staggered-only modifiers (attribute 61, 8 gear lines) never apply; (2)
kit buffs' values: the log's entries (`replayedHits` keeps them, or copies
another hit's), never the kit's modifiers; on/off only from the replay;
(3) the finisher (`finisherModifier` / `isFinisher` vs landing.ts); (4)
Link (`linkModifier` vs casting.ts); (5) Corrosion on the log's clock and
`corrosionCapScale` (vs status.ts and `statusTweaks`); (6) Arts Intensity
of reactions from the panel and the log's entries (vs `artsIntensity` at
the frame); (7) Combustion's snapshot from the log's reaction hit
(`combustionSource` vs `ActiveStatus.snapshot`); (8) stacking:
`countedInstances` / `kitStackCaps` / `layerVariants` (vs `withBuff` and
stack groups); (9) decorate masks and skill types from BuffData
(`reaches`, `buffSkillType` vs the kits' `onlyKinds` / `skillType`); (10)
the situation the hit's conditions and values read (the check's own
`{team, …facts}` vs `situationAt` at the landing); (11) kit buffs valued
outside the timeline (`unloggedOwnBuffs`, `unloggedEnemyAuras`,
`unquantifiedFromKit`, `unloggedCastBuffs`: `kitBuffModifiers` with no
situation, layers tried); (12) the kit hit (`findHits` + `hitAvailable`
vs the timeline's branch and `if`); (13) event counts and fight values
tried (`eventCounts`, `valueAssumptions`); (14) food (`withoutOwnFood`,
`teamPanels`).

**The first test that would have caught it** (tests/logs.test.ts,
"reproduces each plain match through the simulation's damage path"):
every plain match in a verified fixture must be reproduced (±1, same
crit) by its landing in `simulateLog`. On the current code it fails in
all six (0eef 26, 40d9 10, 4e5e 109, b7b3 14, bdf2 105, dbae 27 of 396):
kit buffs logged under another game buff and counted twice (the
`buff_common_affixes_*` Susceptibility and Amp of Li Zhiyan, Si, Camille
and Liino; `_owner` and potential variants: ~170), Stagger twice (~60,
with the replay's Stagger also on where the log has none), kit buffs the
engine has on and the log off or the reverse (heal- and chance-triggered
ones the replay can't judge, edges: ~60), logged crits not fed to
landings a trigger made (~10), Link where the replay can't say, 13 with
no landing.

## 2026-10-25: logs of the owner's team (Si, Last Rite, Arcane, Xaihi)

**Goal:** the owner asked about Xaihi's weapons and rotation in their
team, then for logs of that team. **Done:** three ZMDLogs battles found
by intersecting the four operators' character profiles, imported to
`fixtures/pending/` (b6aa15281db4, 9555de54bb3d, c3c735dbb022) with
first check results and notes (pending README). **Finding:** in b6aa
the player swaps, and one Last Rite battle skill gives one Mirage pair,
not one per member as her kit's `mirage` has it (G4, in-game test 83).
Kit unchanged. **Coordination:** the session rewriting the log check
owns `tests/snapshots/` and merges this branch into main after its
rewrite, regenerating the verdict snapshots (so `npm run test:logs`
fails on this branch until then), and reports what its engine-first
check says about the Mirages before anyone changes the kit. Two more
candidate battles (34aae9073643, 4b2245b45146) returned 504 and can
wait.

## 2026-10-25: kit conditions and `--condition` removed

**Goal:** the owner's "yeah, remove it": no kit defined `conditions` since
kit buffs and `--buff <id>[:layers]` replaced them. **Done:** the
`Condition` type, the kits' `conditions`, `DamageOptions.conditions` and
its helpers, the scenario option, the schemas' fields and the CLI option
(32 files, −506 / +180 lines). No number moved; the loaded-kits snapshot
was regenerated because every kit carried an empty `conditions` (the kits
are otherwise byte-identical). `activeConditions` (talent and potential
modes) is a different thing and stays. Also the owner's call on
same-frame hits of two operators: too rare to matter, no in-game test.

## 2026-10-25: the timeline's structure (review 3.3)

**Goal:** restructure the timeline engine without changing a number:
split timeline.ts, one list for everything scheduled, one documented
order within a frame, and see whether results depend on team order.

**Done** (one commit per step; design.md "Engine modules", "Order within
a frame"):
- timeline.ts (2,963 lines) is a façade over thirteen modules in
  `timeline/` (state, rules, context, schedule, clock, resources, timing,
  situation, actions, landing, casting, advance, drivers; 101–399 lines
  each), moved whole by a script with imports from the type checker;
  `@efsim/engine`'s exports are unchanged.
- `TimelineState.scheduled` replaces pending, pendingActions,
  pendingEnergy, pendingJumps, pendingBursts and enemyActions: a header
  (frame, clock: world / enemy / operator, cast `{operator, index}`,
  detached, launchAt, pinned) and a payload by kind. Shifting a clock,
  ending a cast and a jump are one pass each (`shiftClock`, `cancelCast`,
  `jumpCast`, by `castBound`). One haste helper (`hasteFrames`) for the
  seven places that mapped skill frames to real ones.
- advanceFrom's ten scans and `first(...)` lists are one table
  (`IN_FRAME`) and one comparator (`dueBefore`: frame, step, operator ID
  for two hits, order scheduled); `nextDue` / `runScheduled`.
- `tests/team-order.test.ts`: every example under every order of its team
  gives the same hits; `tests/schedule.test.ts`: the order and the passes.
- Leftovers of 2026-10-24: the WeakMap caches are on the context
  (`ownWindows`, `committedMemo`); buffreplay.ts uses `activeAt`.

**Numbers:** identical everywhere (every example plain, dodging every 4 s
and with rolled crits, at full precision; both searches; the kits
snapshot; verified log verdicts exactly; pending ones and the negative
control) but one order: akekuri-laevatain's Laevatain battle-skill `dot`
and `empowered_extra` at frame 972 swap back to kit order (the old
takeJump rebuilt the whole hit list with every detached hit not launched
yet at its end, whichever cast jumped); same damage, total moves 1e-10,
examples.json digest updated. Speed unchanged within the machine's noise
(alternating runs, best of 3: simulating every example 392 → 412 ms,
search laevatain-solo 3.71 → 3.69 s, si-laevatain 10.7 → 10.7 s).

**Decisions and why:**
- The order within a frame is the one the scans encoded: they were
  consistent (hits, then afterHits actions, then jumps), only written
  differently. Hits of different operators at one frame stay by operator
  ID rather than scheduling order: it keeps hits apart from team order;
  scheduling order would move si-laevatain only (order; with rolled
  crits, which hit draws which roll). The game's order isn't known.
- The search key projects the scheduled list per kind, in order, so it
  merges exactly the states it did (interleaving of kinds doesn't matter:
  each kind has its own step); kind and clock are derived, left out.
- A burst's event no longer carries its frame (the item's is the frame
  a shift moves).
- Team order: the game reads team positions (Si's Team Position 01:
  si-laevatain with Laevatain listed first can't cast Si's combo, her
  battle skill inflicts Heat); otherwise only triggers on one event run in
  team order (their actions and `chance` draws), which no example depends
  on. Kept, and documented; what the game does there is unknown.

**Dead ends:** an order-preserving jump pass alone changed akekuri's
order; the step-2 commit kept the old order on purpose (legacyJumpOrder)
so that the order change sits in the commit that explains it.

**Left:** what's created between a slow-down's cast and its start, or
during it, still isn't shifted (now one place to do it); buffs' ends and
ticks could be scheduled items on the world's clock; whether the game
runs simultaneous hits by anything we can model.

## 2026-10-25: the log check reads facts from the replay (review 3.2)

**Goal:** have `zmdlogs check` take what the kit-buff replay already knows
instead of trying alternatives (review 3.2), a family at a time, each
held to the verified ratchet and the negative control.

**Done** (one commit per family; design.md, "What the replay decides"):
- Infrastructure: the replay always runs; it records per cast
  (`castFacts`) and per logged landing (`landing`: `LandedHit` with
  `LandingFacts`, engine, replay only) what it knows, and marks a fact
  unknown where its own timing could change it (REPLAY_EDGE_MS).
- Link from the cast (predictedLink, linkGrants, LINK_MS gone); cast-
  consumed buffs; combo event counts; own stacks, own buff layers and the
  landed kit hit; Corrosion (the engine's shred at the landing); the log's
  crits fed to the replay (`loggedCrits`), so crit-triggered buffs are
  decided where a second replay (unlogged crits all critting) agrees;
  layers of buffs listed once at the replay's count; trigger landings
  matched to the log within NEAR_FRAMES; heals of the controlled operator
  left to the log; casts without damage from the detail's cast events
  (`LogFixture.casts`, `zmdlogs casts`; added to 40d9, 4e5e, 0eef) and
  from buff lanes (`castsFromBuffLanes`); `zmdlogs check --simulate`, the
  end point as a diagnostic.
- Bugs found on the way: a phantom cast from a late kit frame (placement:
  a key's first landing now joins the cast it can belong to; a later cast
  of the operator ends an earlier one's landings to come); pinned landings
  dropped or moved by their skill's jumps (Rossi's wolves); layered buffs
  undercounted (a pushed-out layer ended at the wrong layer's start).
- 0eef and dbae verify again: back in fixtures/ (pending README).

**Numbers** (four verified fixtures 40d9, 4e5e, b7b3, bdf2): readings
108,913 → 33,007 (per judged hit 166 → 50; 4e5e 91,895 → 25,936, median
6 → 3, max 8,640 → 2,400), check time 13.7 s → 5.2 s; across the six now
verified, plain matches 160 → 396, assumed 398 → 303, fallback 114 → 49.
Negative control (×0.97 / ×1.03): 4e5e 11/0 → 2/0, bdf2 3/5 → 0/0, dbae
1/0 → 0/0, 0eef 0/7 → 0/0, 40d9 and b7b3 0/0: the bound is 1% (was 4%).
Pending (20): 260 s → 99 s, readings per hit 210 → 81, plain 1,169 →
1,808, fallback 1,584 → 1,384, mismatch 5,726 → 5,770 (the losses are
disagreements the replay now shows: pending README). `npm run test:logs`
239 s → about 105 s.

**Decisions and why:**
- A fact the replay's timing could change is unknown, as for the buffs it
  decides; there the old alternatives are tried, labelled "(the replay
  can't say: why)". Strict facts are what tightens the negative control:
  a relaxed second stage would give its chance matches back.
- The enemy's side of a landing (inflictions, Vulnerable, consumed stacks)
  isn't taken from the replay: its inflictions aren't checked against the
  log (Typhoeus's Nature bursts in 0eef / dbae consume an infliction the
  replay doesn't have). The landed kit hit is first, the placement's
  others tried (a perfect combo is the player's timing).
- Placed casts keep the placement's start: the log's cast event can come
  before the skill acts (0eef Liino's battle skill at 760 ms, its buffs at
  1314 ms); moving starts to it lost a Liino match. Only casts the hits
  can't show are added.
- 2026-10-24's dead end (Arcane's Corrosion cap losing Si's matches) was
  the cap on the log's time; on the replay's own ramp it fits (bdf2 hits
  within Corrosion's range 93 → 26).

**Dead ends:** the landed kit hit as the only one (4e5e Rossi's perfect
combo, b7b3 Tangtang's dive spouts placed as her battle skill's) and the
enemy's side from the landing (dbae Typhoeus's bursts) lost matches;
moving placed casts to the log's cast events (above); NEAR_FRAMES 2
missed 0eef's volley (logged at 4187 ms, landed 4433–4733).

**Left:** the enemy's side and reaction levels from the replay
(reactioncheck.ts still runs its own enemy replay); the end point matches
a third of 4e5e's hits (kit buffs named after other game buffs than the
log's count twice there); the kit notes of Liino, Typhoeus, Si's weapon,
Yinglung, Spellburst and funnel_0019 still name `fixtures/pending/` for
0eef and dbae (kit JSON, left to the data-layer work); Si's Yinglung's
Edge one layer short (b7b3 first combo, abfd; in-game test 29), the
Endministrator's Grand Vision on her shatter, Chen's Glorious Memory
count (d4fb).

## 2026-10-25: kit values from the data (review 3.1)

**Goal:** kits take what the game data has from the data; a hand-written
value that differs must say why (review 2026-10-22, 3.1).

**Done** (one commit per step; design.md "Kits and the game data"):
- Safety net: `tests/kits.test.ts` snapshots every loaded kit (canonical
  JSON digests; `EFSIM_KITS_DUMP` writes them to diff).
- One matcher and one compile in packages/data (`kitMatch.ts`:
  `compileOperatorSkill` with kit-draft's options, cached; `matchSkill`
  from the test's `kitDisagreements`); kit-draft's output is unchanged.
- The loader fills what a kit leaves out where the landings agree:
  frames (a hit's landings must be one branch path of its own), count,
  events, factor, element, poise, poiseControlledOnly, detached, energy,
  SP (where the data places all of a skill's grants), team energy, energy
  blocks. `efsim kit-trim [--write]` removed 1,404 values equal to these
  (events 393, frames 330, poise 166, count 113, sp 106, factor 85,
  detached 53, element 53, poiseControlledOnly 39, energy 30, teamEnergy
  24, spBeforeDamage 11, energyBlockSeconds 1; 57 KB), each only where
  the file loads exactly as before (generated commits).
- A written value that differs is a load error unless marked
  (`dataOverride: {field: "reason"}` on the hit, trigger, buff or skill);
  a mark where nothing differs is one too. The 178 KNOWN entries moved into
  the kits with their comments as reasons; the comparison now also covers
  SP and its timing, launch, detached, a skill's cast triggers (hits,
  energy, SP, applications at the delay), equipment's triggered hits and
  buff durations against the CreateBuff. 209 marks in all.
- Load-time references: event keys name data files, `gameBuffs` BuffData
  files, application keys skill values (`scaleKey` only on Breach);
  isFinalStrike reads BuffData too and fails on a missing file.
- `skillTypes.ts` lists all 338 node types of the fetched SkillData and
  BuffData (interpreted, an undecided condition, or uninterpreted with
  why); `skillTypes.test.ts` fails on a new one.
- Load time 16.3 s → 11.0 s: parseJsonExact skips its reviver when no
  number can be unsafe (6× faster parsing), which more than pays for
  compiling every kit skill (3 s).

**What the comparison found, fixed in the kits** (no example total or
verified verdict moved): 24 SP grants the data gives only while controlled
were ungated, 11 lacked spBeforeDamage; Laevatain's Twilight and
Purrchena's shield named a skill key their buff doesn't use (same values).

**Numbers that moved:** only the pending fixtures with Mi Fu, when her
(and Da Pan's) hits got their event keys from the data (kept `[]` and
marked until then): 2fd9 / 99fb / de6a, Mi Fu's 79 / 64 / 76 uncovered
hits are now mismatches (one unquantified each in 99fb and de6a; Chen
in de6a fallback 2 → assumed 2); d572, Mi Fu plain 2 → 18, assumed
0 → 102, mismatch 4 → 21, and with her casts in the buff replay Rossi
assumed 201 → 444 (fallback 254 → 11), Camille plain and assumed 121 →
115 (fallback 9 → 21), Gilberta plain 138 → 140. d572 fits her kit;
the other three are off by a per-fixture factor (roadmap 3).

**Decisions and why:** the loaded-kits snapshot, not the files, is what
the trim keeps identical (one field at a time, all of a hit's first). A
cast trigger with a random choice isn't matched (its options are the
data's branches of one landing). SP is filled only where the data places
every grant, else the engine's first-hit `atb` stays (Last Rite's
battle skill, hitless skills, grants on branches). Buff durations are
compared, not filled: a kit buff without one lasts until ended. The
`conditions` plumbing stays (owner's decision pending).

**Left:** fill launch, applications and bonuses from the data; SP for
hitless skills as cast triggers; the 5 hits still writing `events:
[skillId]` (their landings span files); a parse cache for the build
(the compiler re-reads shared files); Mi Fu's per-fixture factor.

## 2026-10-24: engine review fixes (time stops, search key, loud failures)

**Goal:** fix the bugs the 2026-10-22 review of packages/engine/src found
and make its silent failures loud (principle 7).

**Done** (one commit each, a failing test first for each bug):
- Q3: a teammate's time stop now delays a frozen operator's pending team
  energy with its hits; delayed actions shift by their cast's operator
  (as they're cancelled; same as the owner for every kit today).
- Q2: SP stops are intervals (`spStops`): regen runs until a slow-down
  starts. Before, the regen between the state's frame and the start was
  lost (a slow-down frames into its cast: Camille's second combo, 34
  frames; one cast by a trigger inside an advance), and a later spend
  erased a stop's pause. Only SP after casts moves: camille-gilberta +9.07
  from 421, alesh-estella −8.53 from 96 (Estella's battle skill inside
  Alesh's 77-frame stop no longer erases it); no total, no fixture.
- R5: `stateKey` is exhaustive by construction (`KeyRules` records). The
  old key merged states differing in, among others, a pending hit's
  `controlledAtCast`: the pinned duo search moves 269,470.931 →
  264,948.959 (685 → 680 states); the solo one is unchanged.
- Q1, Q5, Q7, Q4: only EngineError makes an action illegal; status-event
  damage is an exhaustive switch; the combo-rate cooldown loop reports
  when it doesn't settle; the enemy, attribute defaults, burst delays and
  (when dodging) perfect-dodge settings are checked in `createContext`.
- R4: `advance`'s memo lives on the search's context (`memoised`).
- Q6: `activeAt` and one `buffEndedEvent(s)` builder; the six builders'
  disagreements (recorded, remaining of consumed layers) change nothing
  in today's data.

**Decisions and why:** raw cast indices stay in the search key (they were
already there through `acting` and per-cast trigger keys); SP and energy
keep their 0.1 rounding (floating-point noise). The combo-rate loop
returns an error like the SP and input loops rather than throwing.

**Left:** what's created between a slow-down's cast and its start, or
during it (buffs, a spend's pause, a frozen teammate's cast during a
stop), isn't shifted; the module-level WeakMap caches (`committed`,
`ownWindowCache`) could move to the context too; buffreplay.ts still
writes out its own active test (left to the log-checker work).

## 2026-10-24: a safety net for numbers, a stricter log check

**Goal:** a review (2026-10-22) found that nothing pinned the examples'
results (a change moved `antal-focus` unnoticed), that the log test passed
on "no mismatch" alone while hits drifted to weaker verdicts, that any
hit under any unquantified buff counted as "unmodelled" (d9e5: 0 of 98
matched, passing), that matches said nothing about how many readings
were tried, and that catch-alls turned real errors into "doesn't apply".

**Done:**
- Snapshots (`tests/snapshots/`, a regression baseline, not values with
  provenance): every example scenario (total, counts, damage per
  operator, a hit digest whole and per 10 s; a failure lists the hits
  from the first window that moved); verdict counts per operator of
  every log fixture, verified ones as a ratchet, pending ones exactly.
  `npm run snapshots:update` writes them.
- `checkLog` tries every reading: per match `readings` (tried, matching),
  `assumptions` as data, a `class` (plain, assumed, log-listing
  fallback). New verdict `unvalued` (a buff the log lists without a value
  that no kit values); `unquantified` has a `reason`, and Corrosion
  excuses a hit only when the least and most shred it can give bracket
  the damage. `verificationProblems` is what "verified" means
  (design.md, "What a log check verifies"); `zmdlogs check` prints it,
  the plain / assumed / fallback counts and a strength line with flags.
- Catch-alls: the engine has `NeedsSituation` (expr.ts values that need
  a fight's state; not an EngineError, as before) and `HitRuledOut`
  (computeHit's "doesn't happen", still an EngineError);
  `readingDoesNotApply` is all logcheck.ts and reactioncheck.ts catch.
  That exposed one real error: Lifeng's `p5_timer` (ticks every 0 frames
  below P5) applied by `unloggedOwnBuffs`, which crashed d4fb and de6a;
  buffs without modifiers are skipped now (they can't change a hit).
- The replay's "fit" counts hits under unvalued or unmodelled effects as
  "neither" (0eef: "neither 10" where it said 0).
- `npm run test:logs` (tests/slow/, in `npm run check`): the pending
  fixtures in two shards and the negative control; `npm test` keeps the
  verified fixtures and the examples.

**Verdict changes (before → after):** d9e59d0fb737 Typhoeus mismatch
0 → 42 (unmodelled 48 → 6), Arcane 0 → 13 (16 → 3), Gilberta 0 → 8 (9 → 1),
all from the Corrosion bracket: every hit after Arcane's ultimate is
×1.7–2.0 the prediction. Pending 04d401ad257e Catcher mismatch 243 → 252
(unmodelled 9 → 0), Purrchena 241 → 242 (9 → 8); 4e3651100056 Ardelia
123 → 130 (7 → 0). d4fb69b036fe and de6a94e9cf6b crashed after the
catch-alls went and check as before with the p5_timer fix. No other
count moved: the unvalued rule changed nothing today (every unquantified
buff in the fixtures is Corrosion), nor did trying every reading.
Verification moved d9e59d0fb737 (mismatches), dbaee23b801d (Liino and
Xaihi only fallback matches) and 0eef2474a26f (Arcane only fallback)
to fixtures/pending/ (README); 40d9, 4e5e, b7b3 and bdf2 verify.

**Negative control** (×0.97 / ×1.03, chance matches of judged hits): 40d9
0 / 0 of 56, 4e5e 11 / 0 of 345, b7b3 0 / 0 of 84, bdf2 3 / 5 of 166; the
moved ones 0eef 0 / 7 of 65, d9e5 0 / 2 of 96, dbae 1 / 0 of 77. The 4e5e
ones are all Wulfgard's attack 4 (about 1,200 damage, so ±1 is 0.08%) with
`buff_equipsuit_critsuitatk_01 ×4 layers` where the true reading is ×5:
one layer is a 3% step; bdf2's and 0eef's are Corrosion levels. The test
allows 4% of judged hits, not the hoped-for "close to none".

**Decisions and why:**
- Fallback matches don't verify an operator alone: the owner wants the
  engine, not the log, to decide buffs; a fallback shows the damage
  formula with the log's buffs.
- Corrosion's bracket instead of dropping the excuse: its ramp doesn't
  fit every log (time stops, talents), but a hit below the damage with no
  shred or above the most it can shred can't be Corrosion's doing.
- The pending snapshot is exact (any move is looked at), the verified one
  a ratchet (gains pass, with a note to update).
- `unvalued` is its own kind, not a mismatch: the prediction lacks a
  buff, which isn't the kits' error; it still fails a verified fixture.

**Dead ends:** applying Arcane's Corrosion cap raise (talent 2's
`capScale`, which the timeline applies) to the check's Corrosion levels
lost Si's two matches in bdf2 (assumed 2 → 0, her only non-fallback
ones): left out, a lead (roadmap 5).

**Timings** (4 CPUs, other work running, `--maxWorkers=2`): `npm test`
562 s (61 files, 82% of it loading the game data per file), of which the
examples' snapshot about 8 s and the four verified log fixtures about
35 s of checks; `npm run test:logs` 239 s (the 22 pending fixtures in two
shards, about 3 min; the negative control about 1 min, 4e5e's two runs
most of it).

## 2026-10-22: food buffs as a build option

**Goal:** the owner's "simulations, searches and the log checker should
count food buffs" (roadmap item 4).

**Done:** UseItemTable fetched (both sources agree); a checked loader
(`packages/data/src/foods.ts`): the 36 items whose buffs persist on one
operator, each buff's attribute modifiers at the item's values, names from
ItemTable. `Build.food` (schema: one item ID, which is the game's one-food
rule: all share one stacking key). The food's lines are stat-panel lines
(`food <name> (<buff>)`), so `efsim calc`, simulations, searches and the
log checker all see them; `efsim find food` lists them. 7e19's and e82d's
stew is now the builds' `food` (set by hand, notes say so) instead of
hand-added atk effects: still 34/34 and 21/22, and every check and
reaction output is unchanged, as are all example totals.

**Decisions and why:**
- Panel lines, not timeline buffs: a food's buffs are attribute modifiers
  like gear's, in the same formula slots (the stew's 180 is flat ATK, slot
  7, which no buff zone has), and kit values that read attributes see them.
  The duration is kept: the timeline switches to the panel without the food
  at its end (`panelAt`, every panel read now takes its frame), the checker
  by hit time.
- DEF +x% (8 foods, two of them strong crit foods) is formula item 1,
  unknown: kept out of DEF and refused where DEF is read (kit values,
  Catcher's P1 strike), instead of refusing the foods (in-game test 98).
- Defensive lines (DMG taken ×, heal bonuses) load as panel lines nothing
  reads; items used for an instant effect (heals, ultimate energy) aren't
  foods and a build naming one gets the reason.
- A logged food buff that is the hitter's food is dropped from the hit
  (`withoutOwnFood`), so 40d9 and b7b3 (which log percentage foods) check
  the same with or without the food set; those fixtures leave it unset.

**Left:** a search over foods; the importer could set a food the log lists.

## 2026-10-22: the log check takes kit buffs from their triggers

**Goal:** the owner's "our engine should not rely on the log data for
activating buffs. It should activate them based on the events that should
trigger them" — for `zmdlogs check`, which predicted each hit from the
buffs the log lists (4e5e: Camille's Lustrous Carmine buffs drop out of
the log at 49 and 65.5 s; a hand note stood in).

**Done:** a kit-buff replay (`packages/cli/src/buffreplay.ts`, engine
`replayCast`): the placed casts are cast on the timeline at their logged
frames, without a rotation's checks; their logged landings land at the
logged frames (`pinned`: later time stops don't move them again), a cast
keeps its predecessor's hits when the log shows them after it started,
a combo without an open window gets one (count 1); crits are off, the
enemy's HP follows the logged damage. Instances of kit buffs standing for
a game buff the log lists are read at every logged hit. Away from its own
changes (±0.5 s, and ±10% of an expiring instance's life) the replay
decides: off removes the log's entries, on adds them where the log is
silent (values from the log's nearest listing), both on keeps the log's
entries and counts. Buffs applied on crits, chances or enemy actions stay
as logged. The report lists the disagreements (on/off, counts) and which
reading the damage fits. `--log-buffs` gives the old check. A fight's
last hit with an uncapped value above its own (the killing blow's overkill
estimate) counts as unjudgeable. 4e5e: the atkup hand note removed; Rossi
161/162 (the last, the killing blow), Gilberta 58/59 (a hand note for the
Corrosion her explosion starts at 68873 ms, which the old note hid).

**Decision and why:** the replay's reading comes first; where it fits no
reading of the hit, the log's listing is tried and the match is labelled
"the log's buff listing (replay: …)". Making the replay final broke most
fixtures (40d9 Laevatain 17 → 6, dbae Typhoeus 42 → 2, abfd 190 → 32 …):
the replay doesn't see casts without logged damage (Laevatain's ultimate
in 40d9, so `buff_wpn_sword_0006_valid` never starts; in abfd
`buff_wpn_funnel_0010_atk_up`, on the wielder's skill heals, and
`buff_equipsuit_usp_02_AddAttack` never start), and some kit triggers fire
where the log and the damage say no (`buff_chr_0035_liino_atkup` on Liino
herself, `buff_wpn_sword_0012_atk_up` instance counts, the enemy's
`buff_common_affixes_vulnerable_physical` in d4fb / d572 / de6a).
With the fallback no fixture loses a match; the labels and the per-run
"fit" counts show where the replay is still wrong.

**Findings (leads):** log gaps the damage confirms: Lustrous Carmine ATK
in 4e5e and 012ae (Arcane 69 → 155/155, Camille 81 → 122), Liino's ATK
on teammates. Time stops: the logs extend buffs by about 1.1 s across
Estella's 1.8 s ultimate stop and by about 1 s without any (4e5e), the
engine by the stop in full (in-game test 18's question). Bloodfount layer
counts in 4e5e (a heal Camille receives at 56–61 s the replay misses).
