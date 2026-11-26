# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 151 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-26: Away and presses: the enemy away in the replay, hitless presses from the listing, layers

**Goal:** build as general rules what the damage-factors round hard-coded or held back: the enemy away from the fight
in the replay (0c14's Si press at 139.68 s), a press with no logged hit inferred from a buff only its hit gives (her
153.99 s press), Rossi's slash2 extras at a life's or fight's end, an untracked layered buff's layers (Ember, 7e19);
then whether a fixed delay per stop edge explains the combos' extra hold.

**Done** (open-problems "The damage factors", "The enemy's clock"):
- **The replay's enemy away** (engine assumption enemy-away `absent`, the new default; TimelineScenario.enemyAway,
  landing.ts): a hit from the frame after a stretch's last logged hit to the frame before the next applies nothing to
  the enemy (damage, applications, Stagger, enemy-side buffs, hit events); the operators' own buffs from it still come
  (d774's and 9c6e's Liino presses there put her stance's ATK on the team, as the log lists after). The totals leave out
  every unmatched landing from the stretch's first frame on (the enemy leaves with its last logged hit). An Arts Burst
  still lands: holding it back lost 4a64's Arcane weapon debuff the log lists (6 plain), so only its damage is left out.
- **Hitless presses** (`hitless-presses` `inferred`, the new default; buffreplay.ts inferredPress): made only with the
  log's own cast event, the enemy there, the next hit within 1.5 s listing a new run of a decided buff that the replay
  gives with the press and not without; the press after it is then the variant it pulls; its own landings aren't
  counted. Two presses across the logs: 0c14's Si (153.99 s) and 8915's Liino (111.23 s). Alesh's eventless 0c14 combo
  stays open. A recorded burst whose applier is unlogged is now unread (more than twice the buff's life away), not
  read over 73 s of hits.
- **Life ends and kills:** a fight of several lives ends in a kill when its last life dealt one Max HP (lastLifeKilled,
  read by the totals and enemy-hp `kill`). With the leaving frame it covers 4a64's both slash2s (+2.9 → +0.8%); 207f's
  stays (no kill the log shows). Both held-back diffs deleted (docs/tried/README.md).
- **Layers:** the check reads an unjudged kit buff on one timer (stackingType 8/10) listed once at each count to its
  maximum (enginecheck.ts unjudgedLayered): 7e19 mismatch 4 → 1, 04d4 616 → 614, 99fb 116 → 111; 7e19's 33.15 s
  ×1.096 is left (no listing then). Negative control holds.
- **Item 5:** one constant per combo fits as well as a share (probes combo-hold/edge-casts.ts, edge-ticks.ts), but
  57 ms a combo for the enemy's ticks against 140 ms for the operators' casts: one delay on the world's clock is ruled
  out. Next: where in the combo the operators' excess sits.

**Scoreboard** (`npm run snapshots:update`): development plain 69.0%, mismatch 11.4%, mean |damage error| 7.0%
(unchanged; 4a64 better; 891566, 9c6e, a9d7 slightly worse); hold-out plain 80.4 → 80.6%, mismatch 5.6%, mean |damage
error| 8.4% (1 better, 1 mixed: +12 plain, its total further); earlier pending plain 66.3 → 67.3%, mismatch 12.0 →
11.9%, mean |damage error| 4.1 → 4.0% (0c14 plain 172 → 293, −3.4 → +2.7%). team-ab: unchanged (simulations never set
enemyAway). Smoke passed.

**Decisions:** both readings default, with the others kept (`away`, `absent-edge`, `skipped`): `absent` against
`absent-edge` because the logs record every landing (d774's unlogged strikes 0.23 and 0.27 s into its stretches).
The hold-out mixed log's total getting further fits 0c14's pattern: the readings that now fit raise the total onto an
over-prediction elsewhere. a9d7's Chen (an ultimate final 0.74 s into a stretch no longer refreshing a buff the log
lists later) is reported, not fixed.

**Problems:** the replay view's EVENT line called the inferred Liino press a tick; kill and life detection live in two
places; a burst's unbounded record start was silent (friction report).

## 2026-11-26: Improvement round 13: clocks, dropped bounds, --assume everywhere, options before the queue

**Goal:** friction round 13 over the five open reports (round 12's backlog and own report, holds-and-placement,
damage factors, the enemy's clock), beside an accuracy agent holding the replay, placement, check, holds, engine and
compiler files. Write-up: docs/friction-done/2026-11-26-round-13.md.

**Done:**
- `efsim zmdlogs clocks` (clocksview.ts): tick chains, casts' landings and bursts against the stops inside, by stop
  kind and combo operator; the enemy-clock round's five probes in one run (combos 0.23–0.40 × their held time late,
  ultimates on time). `zmdlogs holds --dropped --all`: the dropped bounds by kind and cover (tick bounds in a Stagger
  with a combo: 47 dropped in 9 logs, 35 kept). `differences --clusters`. query.ts `loggedStaggerSpans` for views and
  probes.
- `--assume` on every view that replays (REPLAYING / NOT_REPLAYING in the CLI, a test over the usage).
- measure checks its options and readings before it queues; `--help` on measure, snapshots, premerge, team-ab,
  verify-at (scripts/usage.ts); `--variant --hits` lists a variant's own hits against the plain tree.
- castpairs.ts `pairCasts` (measure `--changed placement`'s moved casts); scripts/lead-files.ts for the lead's file
  split; at-commit's patch failures name the hunks; edit.ts's end block without `=======`; docs/design/tests.md "What a
  hold-out output may say"; the report format's **Files:** line.

**Decisions:** every point needing the replay, placement, compiler or engine went to the backlog (6 live points), not
done in halves outside them; round 12's backlog point 4 closed (the lead's decision), point 5 moved to the accuracy
list. Burst bounds closed: the enemy-clock round ruled them out.

**Scoreboard:** unchanged; `npm run snapshots:update`: "No log's verdicts moved", no snapshot file changed. No engine
change (no smoke, no team-ab).

**Problems:** finding which file each point needed took about twenty minutes of grep (hence the **Files:** line); a
type name clash across `export *` (ClockRow) at the first typecheck.

## 2026-11-26: The lead: the check's own-buff fix adopted, the two accuracy rounds merged

- **Goal:** merge the two parallel accuracy rounds of 2026-11-26 (damage factors; the enemy's clock) and apply what
  the damage-factors round held back because the check was the other agent's file.
- **Merged:** both rounds. The only conflicts were in docs/roadmap.md, docs/roadmap-details.md and docs/tried/README.md,
  where both sides added text; I combined them.
- **Adopted:** the check's loggedEntries now matches an unjudged kit buff's listed entry only against its own game
  buff's engine modifiers. Before, Ember's Pay the Ferric Price was dropped as one of Thermite Cutter's +0.09 layers in
  7e19. The held-back diff is deleted, as docs/tried/README.md says.
- **Scoreboard** (`npm run snapshots:update`):
  - hold-out plain 79.0 → 80.4%, mismatch 5.9 → 5.6%, mean |damage error| 8.5 → 8.4% (3 better, 0 worse);
  - development and verified unchanged;
  - earlier pending's mean |damage error| 4.2 → 4.1%, with 0c14 −4.9 → −3.4% and 7e19 better.
- **Still held back:** the 0c14 diff (Si's away press, hard-coded) and the life-end landings diff (mixed). Both need
  general rules in the replay: an enemy-absent away state, and a hitless press inferred from a buff only its hit gives.
  They are next steps, not adoptions.

## 2026-11-26: The enemy's clock: combos hold every clock more than their stops; no pause while the enemy is away

**Goal:** the holds-and-placement round's leads, in order: db87's enemy-clock delay in a Stagger (its Corrosion 0.58 s
past the replay's end, Combustion ticks 1.5 s apart), a burst's delay as a hold bound (9a80 35.05 s), 4d60's unlogged
holds (a boss-phase pause?), d4fb 97.05 s; if time, freezes on Electrification / Solidification and a placement pass
by quiet stretches.

**Done** (open-problems "The enemy's clock", new; the four leads' paragraphs):
- **Found: across a combo's stop every clock runs late** by a fifth to a half of what the stop list holds, across an
  ultimate's on time (scripts/probes/combo-hold/): the enemy's tick chains in a Stagger 3.43 s over 87 pairs with a
  combo against 0.02 s over 30 without; an operator's cast across a teammate's combo +263 ms median (112 casts);
  bursts +181 ms (45); buff runs 0.45 × the combo-held time. db87's four tick pairs each span one combo.
- **Ruled out:** Arcane's Imprisonment slowing the enemy's clock (SealAction's curve, over 1 s or its 6.6 s: the
  ticks after a seal are on time; in-game test 37's Arcane part decided from the logs); a Stagger or the enemy's
  actions (Staggered chains without combos run on their period); a longer ComboSkill curve (flat: verified 78.0 →
  73.0%, development 69.0 → 68.0%, hold-out 79.0 → 76.7%; a middle curve worse too; docs/tried/2026-11-26-combo-curve-flat.diff);
  a burst's delay as a hold bound (placed holds don't hold bursts: 012a, 458b, 489c, 7910 on time across 0.10–0.42 s
  of them); a pause of the operators' timers while the enemy is away (Xiranflow's 25 s layers on Zhuang Fangyi run on
  time across 4d60's and d774's away windows); for d4fb 97.05 s a cooldown shared by the set's two wearers and one
  restarted by every Physical status.
- **Registered, not the default:** engine assumption `stagger-holds` (`combos`: the hidden holds may rise inside a
  Stagger within a combo's stop, up to half its hold; holds.ts comboHoldSpans, placeHolds `slow`): development plain
  69.0 → 69.2%, hold-out 79.0 → 79.2%, verified 78.0 → 77.5% (0eef), db87 −6.0 → −5.9% only.

**Scoreboard:** no default changed, no verdict moved (`npm run snapshots:update`). No engine timing change (no smoke,
no team-ab).

**Decisions:** `stagger-holds` stays off with a verified log worse and db87 barely moved: the placement's least
total takes the Stagger's 0.44 s from holds placed earlier, and nothing bounds the unlisted Corrosion past the
replay's end. The burst bound wasn't built: its mechanism (dodges holding the operators' clocks) isn't what the bursts
show. Not reached: Electrification / Solidification across a freeze (no listed run across one found in a first look,
7910's Solidification unlisted), the quiet-stretch placement pass.

**Problems:** the ComboSkill curve's measures waited behind another worktree's measures in the lock's queue (about
10 min each); the probes' first cut (per tick pair) split a stop's time between neighbouring pairs, so only chain
sums with whole stops inside are evidence.

## 2026-11-26: Damage factors: Catcher's weapon, the Crush's stacks from Si's away press, Ember's listed layers

**Goal:** the damage factors the misprediction statistics left, largest first: the Crush ×2.2 (0c14) and ×1.90 (2fd9),
04d4's Catcher ×2.1 and Snowshine ×0.962, Ember's ×1.096 (7e19), Rossi's ultimate ×1.09 / ×1.08, bleed clock, slash2
extras and combo_3 over-hold, then the cast tails; another agent held the replay, holds and check files.

**Done** (open-problems "Misprediction statistics", The damage factors):
- **The Crush is right; its misses were Vulnerable stacks.** Every logged Crush reads exactly with the data's
  multiplier by stacks consumed. Rossi's perfect combo gives a Lift and one more stack per consumed infliction, so one
  infliction the replay lacks costs two stacks: 2fd9's (fixed by round 4's counter bash), and 0c14's at 182.30 s (2 →
  4: 172,059 exactly). 0c14's cause: Si's battle-skill press in the away stretch (139.68 s), made by the replay, landed
  nothing in the game, and her hitless 153.99 s press was her battle skill (Jade Vessel's Immobilization debuff listed
  from the next hit, her Artful Intent ending at the log's 181.00 s). Hard-coded as a measurement:
  docs/tried/2026-11-26-0c14-si-away-press.diff (0c14 plain 172 → 293, −4.9 → +1.2%); the rule is the replay's.
- **04d4's Catcher: weapon level 3** (fixture buildOverrides). fit-build threw on his DEF-scaled hits under a DEF food
  candidate; such a candidate is now unscored (buildfit.ts, tests/buildfit-fit.test.ts). 04d4 plain 185 → 376.
- **Ember's ×1.096:** the check's loggedEntries dropped her listed talent ATK (+0.09) as one of Thermite Cutter's
  layers (fix held back: docs/tried/2026-11-26-log-entries-own-buff.diff, hold-out plain 79.0 → 80.4%, 3 better, 0
  worse), and her talent's layers aren't listed (one entry at 1–3 layers: 04d4's steps ×1.023 / 1.085 / 1.147).
- **Rossi:** her ultimate's ×1.09 / ×1.08 fit now (closed); the slash2s without an extra are a fight's or a life's last
  hit (scripts/probes/rossi/slash2.py; the totals rule is mixed and too broad, docs/tried/2026-11-26-life-end-landings.diff);
  the bleed's unlanded ticks and combo_3's over-hold left to the holds' owner.
- Snowshine narrowed (her attribute bonus 3.325 → 3.200 exactly; no weapon level or node count reaches it); the cast
  tails' largest are stage, two-target and placement cases, no kit cause.

**Scoreboard** (`npm run snapshots:update`): verified unchanged; development plain 69.0%, mismatch 11.4%, mean |damage
error| 7.0% (unchanged); hold-out 79.0%, 5.9%, 8.5% (unchanged); earlier pending plain 64.7 → 66.3%, mismatch 13.9 →
12.0%, mean |damage error| 4.1 → 4.2% (04d4 mixed: per hit 17.9 → 6.5%, its total +2.1 → −3.0%, the over-prediction had
hidden the rest of its deficit). No kit or engine change: team-ab not needed.

**Decisions:** fixes in files another agent held were measured with `--patch` and kept as docs/tried diffs marked held
back (README paragraph), not applied; Catcher's level-3 weapon taken though the weapon's skill levels (3, 2, 3) can't be
checked against a breakthrough table the data sources lack.

**Problems:** `measure -- --help` queued 5 min for the lock before rejecting the option (friction report).

## 2026-11-25: Holds and placement: a freeze holds no Arts reaction status

**Goal:** round 12's accuracy leads: 489c's lost plain hits after ultimates played in turn (591 → 488), the 20
casts a third placement pass would move, the 14 overlapping ultimate pairs; if time, 9a80 / 79cc's bursts, 7e19's
×1.096, d4fb 97.05 s, the "enemy HP unknown" reading.

**Done** (open-problems "Ultimates pressed together", "Freezes on bosses", "Trigger cooldowns"):
- **489c: the Corrosion's end, held by Si's freeze** (e9ffcac). Neither the in-turn stop (the ramp's steps lag the
  replay's by a steady 0.31–0.41 s across both stops in turn) nor the ramp bounds: Si's Immobilization at 43.6 s held
  the replay's Corrosion's end 1.5 s, so its status bound allowed no hold while four clocks (the Vulnerable run, the
  ramp, the bleed and Combustion ticks) agree on about 1 s. Combustion's ticks run on through a freeze too (f978's at
  57.80 and 58.80 s). Engine assumption `freeze-ramp`, new default `statuses` (clock.ts statusesRunOn: none of the
  four reaction statuses held, the debuffs still are): 489c plain 488 → 632, mismatch 45 → 14.
- **A third placement pass: dropped** (docs/tried/2026-11-25-third-placement-pass.diff): 2-cycles (4a64's Rossi,
  7910's and 9090's Arcane swap back in a fourth pass), one more overlapping pair, development plain 68.1 → 67.8%.
- **The 14 overlapping pairs: the log decides each** (inTurnStart's checks): six have logged hits in the in-turn
  stop, five overlap 2–4 frames, three resolve with a 3-frame tolerance and a reach counting combo slow-downs, but
  d9e5 plain 86 → 50 and b6aa mixed (docs/tried/2026-11-25-in-turn-chains.diff). The pinned list is unchanged.
- d4fb 97.05 s: 2.18 s short, the Lift logged, a Stagger holding the cooldown ruled out (the 106.13 s proc). 9a80
  35.05 s: a quiet 29.66–30.00 s where a dodge-sized hold would carry the burst past two stops; bursts aren't hold
  clocks. Not reached: 79cc 24.23 s, 7e19's ×1.096, the "enemy HP unknown" reading (no development log has the label).
- `zmdlogs holds --assume`.

**Scoreboard** (`npm run snapshots:update`): verified 78.0% unchanged; development plain 68.1 → 69.0%, mismatch 11.6 →
11.4%, mean |damage error| 7.0%; hold-out plain 78.7 → 79.0%, mismatch 5.9%, 8.6 → 8.5% (1 better, 0 worse);
earlier pending plain 64.7%, 4.1% (b6aa better). Better: 489c, 9c0b, 8915, f978 (mixed: +4 plain, total 0.3 →
0.7%); **worse:** db87 (plain 209 → 208, total −4.5 → −6.0%: its Corrosion still acts 0.58 s past the new end, in a
Stagger whose Combustion ticks come every ~1.5 s). Teams (team-ab against 99806d9): estella-si-akekuri-arcane −0.15%
sustained (sd 1.6k), the rest the same.

**Decisions:** `statuses` over a Corrosion-only reading (the same on 489c and db87; f978's ticks need Combustion's
too); default switched with db87 worse, since its window has an enemy-clock delay the placement can't place in a
Stagger. The holds per stretch (backlog point 5) weren't needed: the conflict was one wrong bound, not the
placement's handling. The third pass and the in-turn extensions kept as tried diffs.

**Problems:** inTurnStart has no record of why it left a pair (a temporary stderr print answered it; friction
report); a debug print in inTurn also ran under settleCheck's third pass, mixing two passes' lines.

## 2026-11-25: Improvement round 12: decisions kept with their reasons

**Goal:** the four open friction reports (round 11's backlog of 13 points, round 11's own report, the cooldown-clock
and remaining-leads reports), with the replay, the kit compiler, the check's core and the engine free this round. No
verdict may move.

**Done** (docs/friction-done/2026-11-25-round-12.md; the backlog: docs/friction/2026-11-25-backlog-after-round-12.md):
- **The holds say why a unit sits where it does** (holds.ts holdPins, PlacedHolds.conflicts; `zmdlogs holds
  --verbose`; `cli-ab --patch <diff>` runs a new view on the old code). 489c across the in-turn commit in one run: the
  in-turn stop holds Li Zhiyan's Corrosion 2.07 s more, its status bound caps the holds at 0.19 s over 13.1–49.2 s, the
  ramp bounds there are dropped against it (open-problems).
- **The replay says why** it didn't land a pinned landing (landingWatch: branch, `if`, next cast, cast end, never
  pinned) and didn't make a logged cast (BuffReplay.skipped, earliestStart's own error); `--trace-trigger`; the EVENT
  line from the replay's decision, with the buff's end in frames; views' stops by the same decision.
- **The placement's passes named** (placementPasses; settleCheck: 21 casts a third pass would move; ultimateOverlaps:
  14 pairs, pinned; `zmdlogs placement`).
- **The data's facts kept**: KitTrigger.cooldownFrom (`efsim kit`, equipment kits by id, kit-census), one compiler
  message for a hit under another key, the likely-loggedAs screen from the data (none open), "enemy HP unknown"
  (unknownFacts).
- measure's moved.json and "Moved by an earlier measure too"; build.ts's built.json and partial/, load.py's fallback;
  `zmdlogs reactions`' inflictions; data/README's absent tables.

**Scoreboard** (`npm run snapshots:update`): "No log's verdicts moved"; only tests/snapshots/kits.json (27 digests,
cooldownFrom). No engine timing change (no smoke, no team-ab).

**Decisions:** no per-kit split of the hold-outs' aggregates: which kit's run moves a hold-out says what the hold-outs
contain, which round 9 keeps out; a split by mechanism class is put to the lead (backlog point 4). The drop reasons
watch the schedule from the replay (no engine change), and the verdicts' reason text stays as it was (the one-sided
kinds group by it). The loggedAs screen is a test and a kit-census section, not a loader warning (a load would print it
on every run). Round 11's backlog points 1, 2 and 4 parked (carried twice, no new report).

**Problems:** the first settleCheck paired a moved cast with its neighbour's start (9a80's Rossi battle skills): pair
the casts that stay first, then the moved ones.

## 2026-11-25: The remaining leads: the Empyrean's end on its frame, ultimates in turn, the touch after a reaction

**Goal:** the leads the 2026-11-24 rounds left: Zhuang Fangyi's Empyrean ending early (4bfc 179.51 s, d774 104.18 s,
4d60's holds), Typhoeus's fc63 infliction state, Arcane's last bursts (9a80, 79cc, c83c), travelling ability
entities, 7e19's ×1.096 and d4fb's Swordmancer exception, the marker clocks.

**Done** (open-problems "Misprediction statistics"; roadmap-details "The remaining leads"):
- **The Empyrean's end is a frame boundary** (669a62e): the replay's buff ended on the event's own frame (4bfc 179.50 s;
  d774's held 0.37 s to its event by heldTicks), so the advance ticked and ended it before loggedTick looked and the
  replay made a real ultimate. buffreplay.ts endedWithTick. ExtendBuffAction as a pause ruled out (4bfc's third
  Empyrean would run 47 s, the log's 26.65 s of world time). d774 104.18 s: not the clock; the team's hits thin out
  after the third strike, as where the enemy leaves at 30.63 s (positional).
- **Ultimates pressed together play their stops in turn** (4188729, logcasts.ts inTurn, a pass after the placement):
  of 27 overlapping pairs, 12 have a hitless stretch of the first stop's length before it (fc63, 00ae, 4a64, d774, …);
  fc63's 40.80 s burst was this (Gilberta's ultimate from 39.92 s, before Perlica's), not Typhoeus.
- **fc63 85.13 s: the touch's element after a reaction opener** (45da066): the game's enemy had Nature (Typhoeus's shot
  consumed it: its burst ×1.303), the replay Pulse (the Corrosion's consumed element). Engine assumption
  `window-reaction` (`consumed` default, `applied`): fc63 plain 511 → 549, mismatch 179 → 97, but 9a80 227 → 217 and
  fc63's total 3.4 → 5.3%; not the default; in-game test 33 updated.
- **Ruled out:** Imprisonment's enemy slow-down for the late bursts (45 of 50 touch-caused bursts on time); a `travels`
  field for Tangtang's stare and Arclight's dash (no movement in the data; marked, no log moves); Pogranichnik's
  layers for 7e19 (teammates fit with two under the same listing). Open: 9a80 35.05 s, 79cc 24.23 s (a frame around
  Arcane's reset), d4fb 97.05 s, 4d60's holds, the marker clocks (no log decides them; not reached).
- `--trace-buff status:infliction`; scripts/probes/placement/ult-overlap.ts.

**Scoreboard** (`npm run snapshots:update`): verified plain 78.2 → 78.0% (40d9 51 → 49: two hits assumed near the
moved stop); development plain 67.9 → 68.1%, mismatch 11.5 → 11.6%, mean |damage error| 7.0%; hold-out plain 78.5 →
78.7%, mismatch 5.9%, 8.5 → 8.6% (1 mixed, none worse); earlier pending plain 64.6 → 64.7%, 4.2 → 4.1%. Better: 00ae
607 → 687, 9090 995 → 1027, 1d91, 7910, c4f3, 4bfc, d774; **worse:** 489c plain 591 → 488 (its total −1.9 → −0.3%:
the hidden holds re-placed after the in-turn move, its Corrosion readings), 3f78's total −4.8 → −5.6%. Teams
(team-ab against eec0473): every team's fight the same.

**Decisions:** in-turn kept with 489c worse: the stop is where the log is quiet (Arcane's attack 4 split by it), and
the loss is the hold placement's response (friction report point 1); in-turn as a pass after the placement, not in
placeWith (inside it, 4360 and 9c6e cascaded); `window-reaction` registered, not switched, on one log each way.

**Problems:** the container restarted mid-round (nothing lost: committed before the long runs).

## 2026-11-24: Cooldown clocks from the data, Arcane's burst held by her own ultimate, every finisher hit Staggered

**Goal:** the kit-buff and placement rounds' four leads: a per-trigger cooldown clock, a kit field for travelling
landings, Arcane's bursts in the replay, Ember's finisher in 7e19.

**Done** (open-problems "Misprediction statistics"; roadmap-details "The cooldown-clock round"):
- **KitTrigger.cooldownClock from the data.** The game has CD timers (AddGlobalCDTimer, or a `…_cd` buff) and timed
  markers (CreateTimedMarker); the compiler (kits.ts cooldownClockOf, skillData.ts cooldownTimers) matches each
  trigger's cooldown key to them: CD timers world (Swordmancer, Mi Fu's P3, Antal's heal, three claymores,
  suit_spellburst; Laevatain's absorb written by hand), markers raw (Glorious Memory, Sundering Steel, Xaihi's crystal,
  19 more). `trigger-cooldowns` now `kit` / `raw` / `world`; world cooldowns move with every world shift (stops,
  resets, hidden holds) and a start inside a stop is held by its rest. The two hold-outs' worse totals are Swordmancer's
  (a measure with only it on the world's clock moves both): replay-only 4.9 → 4.8%, log-only unchanged, so its dropped
  procs were ones the game didn't deal. No development log decides a marker's clock.
- **Arcane's bursts: her own ultimate's stop holds them** (`burst-stops` `all`). b7b3's touch at 4.95 s burst in the
  replay at 5.97 s inside her stop; the log's at 10.34 s. Her 130 bursts: within 150 ms 89 → 94, none 23 → 20,
  replay-only 24 → 21 (scripts/probes/bursts/arcane-bursts.ts). The element at her touch (test 33) explains none of
  the leads' cases.
- **Every finisher hit deals as on a Staggered enemy** (`finisher-stagger` `cast`): 7e19's hit_2 after Chen's stop read
  ×1.564 = ×1.43 × ×1.096, Chen's hit at that ms unstaggered; the only such finisher in the logs. 7e19 −4.9 → −1.1%.
- **KitHit.travels** (the compiler, from LaunchProjectile) reproduces the event rule for every projectile ultimate,
  with or without its contradiction check, but not the ability entities it also takes (Tangtang's stare: b7b3 47 → 45
  plain from its frame), so the rule keeps its check for them and skips it for travelling landings (placements as
  before; the dropped variant in docs/tried/2026-11-24-travelling-landings-only.diff).
- 4bfc 179.51 s (the lead's question): Empyrean's end by the log (Arclight's chain unbroken), the replay's empyrean
  buff ended early; not fixed.

**Scoreboard** (`npm run snapshots:update`): verified plain 77.9 → 78.2% (b7b3 44 → 47); development plain 67.8 →
67.9%, mismatch 11.5%, mean |damage error| 6.9 → 7.0%; hold-out 78.5%, 5.9%, 8.5% (2 better, 2 worse by totals:
Swordmancer, 1 other); earlier pending plain 64.6%, mismatch 13.9%, 4.3 → 4.2%. Worse: 6339 37.5 → 40.8% (its
finisher's replay-only hit_2 now Staggered), 79cc one plain (Ardelia's combo placed late from its projectile holds a
burst), 012a 0.6 → 0.7% (a burst matched as assumed). Teams (team-ab against e3272c6): Estella–Si–Akekuri–Arcane full
+0.01% sustained (60 s timeline +0.08%), zero +0.02%; Typhoeus–Arcane–Liino–Perlica sustained unchanged, its full 60 s
timeline −0.51%.

**Decisions:** the clock from the game's mechanism, not per kit, the explicit field only where the trigger reaches no
source (refused where the data says it); `burst-stops` `ultimates` measured and kept as a reading (combo slow-downs do
hold bursts: e82d, c6d8, four hold-outs worse).

**Dead ends:** the travelling field alone as the event rule (above).

## 2026-11-24: Improvement round 11: measure --split, zmdlogs bursts, the views' stops without the replay's ticks

**Goal:** the owner's friction workflow, round 11: the five open reports (round 10's backlog and own report, the
misprediction candidates, the kit buff leads, the placement leads), tools only, beside an accuracy agent in the kit
compiler, kits, engine, placement, replay and check core; no verdict may move.

**Done** (docs/friction-done/2026-11-24-round-11.md has the list by cause; the backlog,
docs/friction/2026-11-24-backlog-after-round-11.md, the rest):
- `npm run measure -- --split files [--group a,b]` / `--split commits --base <ref>`: each part of a change measured on
  the logs the whole moved; the summary's reference line; `--variant` also against the plain tree. On the placement
  leads' range: 1cd1 and af7b by 00876b1, 4d60 by the merge that brought the Empyrean's end in.
- `efsim zmdlogs bursts` (each Arts Burst logged against replayed, each side's likely cause, the stops between).
- query.ts castEventPlace in `instances` and `replay`'s EVENT lines (at its press, at its stop's end, …; the log time
  beside the world time); docs/design/data.md's paragraph.
- replayTimeStops `tickRead`: with the replay, the views leave out a hitless event the replay read as a buff's tick,
  as the hold placement does (`zmdlogs stops --all --differ` list only 2 → 0, nothing else moved); the EVENT line
  says when the replay made a cast its key reads as a tick (3aa6).
- The likely-loggedAs screen (loggedas.ts: `zmdlogs differences`, the pending suite); HitRecord.counterfactuals (build.ts
  calls it); analyze.py in numpy (6+ min → 67 s), its buffs section's top-fight and top-hit shares, equipment names,
  NOT_KIT fights, `analyze.py buff`.
- `friction.ts outcomes --backlog`, edit.ts's marker messages, CLAUDE.md and docs/design/tests.md notes.

**Scoreboard:** unchanged (`npm run snapshots:update`: "No log's verdicts moved"); no engine or kit change, so no
team-ab.

**Decisions:** the views' tick filter takes the replay's applied stops rather than every hitless event of a tick skill:
the first version, without the replay, dropped 3aa6's seven real Zhuang Fangyi ultimates (cli-ab showed eleven new
"timeline only" lines); the exact list from the replay itself is buffreplay.ts's (backlog point 6). The bursts' causes
are a search (the replay records neither inflictions nor a burst's source): said in the view's header, the record in
the backlog (point 13).

**Problems:** the loggedAs screen finds no pair in the development logs now (the candidates' fixes took them), so its
test is on a real listing with a made-up kit modifier; the pending suite guards the rest.
