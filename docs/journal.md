# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 148 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

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

## 2026-11-24: Placement leads: ultimates from their cast events, Chen's stew, trigger cooldowns on the world's clock

**Goal:** the misprediction rounds' placement and timing leads: Liino's ultimate windows (1cd1, af7b; 1d91, 9c6e),
7e19's Chen ×1.15 and Ember −21.5%, what 0c14 / 4e36 / de6a have left, then the one-sided landings' largest kinds.

**Done** (open-problems "Misprediction statistics"; roadmap-details "The placement leads"):
- **Liino's windows were her travelling projectiles.** Pyrotechnics (frame 76, `detached`) land 0.1–0.8 s of the
  world's time after their frame, so the cast placed from them came late: its stop over teammates' logged hits, its
  Amp (frame 77) after hits the log has under it. An ultimate's cast event sits at an edge of its stop, the end for
  most operators (scripts/probes/placement/ult-events.ts: Si 26 of 35, Liino 13 of 21, Laevatain 11 of 16). logcasts.ts
  eventStopStart: an ultimate whose first landing is on its way (detached, or Ardelia's sheep's random count) and whose
  frame-placed stop covers a teammate's logged hit starts from such an event (1cd1 −7.5 → −3.5%, af7b, 1d91, 9c6e,
  5082, 7910's Ardelia, 3aa6's Arclight).
- **7e19's Chen: Ginseng Meat Stew** (buildOverrides; fit-build 17 of 19), after ruling out P1 (×1.15 from 99.9% HP in
  a Max-HP fight; P1 would be ×1.185) and listing differences; the Endministrator has the same stew by hand. Ember's
  −21.5% is her finisher's second hit with the Staggered parts after the log's Stagger ended: open.
- **Swordmancer's cooldown is on the world's clock** (engine assumption `trigger-cooldowns`, reading `world`; the
  default stays `raw`): its replay-only procs are the largest "no cast" kind (scripts/probes/cooldowns/physuit.ts:
  every miss under 15 s of world time, every proc past it); Mi Fu's P3 in 2fd9 too. `world` for every trigger moved
  four kit tests' fights (Glorious Memory's 0.5 s layers, Xaihi's crystal, Sundering Steel, chen-solo) and two
  hold-outs' totals for the worse: not every trigger cooldown is a CD timer. Next a kit field for the clock.
- **The hold placement** leaves out cast events the replay read as ticks (the kit-buff round's Empyrean end in 4d60).

**Scoreboard** (`npm run snapshots:update`, against main at ca5b566): development plain 67.7 → 67.8%, matched 83.8 →
83.9%, mismatch 11.6 → 11.5%, mean |damage error| 7.0 → 6.9%, within 5% 25 → 26; hold-out plain 78.4 → 78.5%,
mismatch 5.9%, mean |damage error| 8.5% (1 better, 1 worse by one plain hit now assumed, 1 other); earlier pending
plain 64.4 → 64.6%, mismatch 14.1 → 13.9%, 4.4 → 4.3%, within 5% 18 → 19; all but the hold-outs 5.5 → 5.4%. Better:
1cd1 −7.5 → −3.5%, af7b plain 588 → 599, 5082 +2.3 → −0.1%, 8915, 7e19 plain 66 → 85 (−6.6 → −4.9%); mixed, per hit
closer: 1d91, 9c6e; worse: 7910 (−5.8 → −6.1%: Corrosion readings ±2% as the placed holds moved with Ardelia's stop,
whose press at 55.12 s the log shows), 9090 (Perlica's Electrification 0.1 s short at 64.40 s), 3aa6 (one plain).
Teams (team-ab against c6f1874): every team's fight the same.

**Decisions:** the event rule only where the frame's stop contradicts the log (Si's ability-entity slashes placed well
from their frames: b6aa's ready-buff order says the event there was the press), at least 150 ms earlier, a first song
beat within that keeping its start (d9e5: a frame's move shifted Corrosion's ramp); the cooldown clock left at `raw`
(smoke failed under `world`: kit tests encode other triggers' raw cooldowns).

**Dead ends:** the event rule for every detached ultimate (Si's moved 1.6–2.1 s in 4a64 and b6aa, worse); P1 on
Chen's own HP (d4fb switches at 0.499 of the enemy's).

## 2026-11-24: Kit buff leads: Zhuang Fangyi's Empyrean end, the rest not kit values

**Goal:** the misprediction analysis's largest one-buff leads (its "one kit buff the replay has wrong, the listing
right" class, ~20% of the off error): Arcane's weapon, Will burst and Susceptibility buffs, Gilberta's weapon, Zhuang
Fangyi's weapon and Sunderblades, Typhoeus's Hovering ATK, then the list; fix or rule out each, double counts first.

**Done** (open-problems "Misprediction statistics", "The kit buff leads"; tables rebuilt with build.ts at c6f1874,
per buff the new scripts/probes/stats/onebuff.py; no double count among them, doublecount.py's pairs unchanged):
- **Fixed: Zhuang Fangyi's Lone Barge ultimate buff (1.0%).** The log's `ultimate_skill` events 30–35 s after an
  ultimate's are the Empyrean's end (ult_end casts ultimate_skill_end): no time stop follows, her next hits are her
  plain forms, Lone Barge's buff isn't listed after them (4 of 4; the 9 real casts list it;
  scripts/probes/kits/zhuangfy-empyrean-end.ts). The replay made each a press (a 78-frame stop, the buff 25 s more).
  The empyrean buff now ticks once at its end, logged as the ultimate (`every`, `ticksLoggedAs`, `endFollowsTick`: no
  code change). Test: tests/slow/log-cases.test.ts (4bfc).
- **Ruled out as kit leads:** Arcane's Susceptibility layers (one e82d hit read two ways is 88% of it); "Arcane's weapon
  Arts DMG Taken" (Detonation Unit, 96% of it 9c6e's second target); Arcane's Will burst buff (it starts at her logged
  burst in 90 of 91 runs, scripts/probes/kits/arcane-will-burst.ts: its error is her bursts', replay-only after her
  touch or ultimate or seconds early across stops); Gilberta's weapon (4a64's instance lasts 16.5 s of world time where
  two ultimates' stops overlap 1.5 s in the placement); Typhoeus's Hovering ATK (the 5th shot's burst, and a floating
  start pressed inside her combo's frames 0.14–0.18 s before the replay's, scripts/probes/kits/typhoeus-press.ts);
  Xaihi's Crystal Amp (Max HP, not simulated); Laevatain's Scorching Heart (a Melting Flame refresh the replay lacks).

**Scoreboard** (`npm run snapshots:update`): development plain 67.8 → 67.7%, mismatch 11.5 → 11.6%, mean |damage
error| 7.0%; hold-out plain 78.3 → 78.4%, 5.9%, 8.5% (1 better); earlier pending plain 64.2 → 64.4%, mismatch 14.2 →
14.1%, 4.4%; all but the hold-outs 5.5%. 4bfc mixed, per hit closer (plain 795 → 819, mismatch 29 → 15, total 0.3 →
−0.8%); **4d60 worse** (plain 707 → 696, −1.8 → −4.1%): the phantom stop held Arcane's Solemn Phalanx runs, Perlica's
weapon and a Sunderblade 2.6 s that the game holds 3.6–6.1 s by something unlogged around 98–143 s (those hold bounds
dropped). Teams (team-ab against c6f1874): every team's fight the same (no team has Zhuang Fangyi).

**Decisions:** kept the Empyrean fix with 4d60 worse: the mechanism is decided by the log (no stop, plain forms, no
buff after the event, 4 of 4), and 4d60's loss is an unexplained hold the phantom stop happened to cover. The hold
placement still counts the phantom stop (buffreplay.ts replayedCastStops, the other agent's file): in the friction
report, not changed.

**Left:** 4d60's 3.6–6.1 s of unlogged holds (its Stagger window takes none); Arcane's bursts (test 33's element, the
burst's clock across her own ultimate's stop); Zhuang Fangyi's d774 104.18 s Empyrean battle skill (3 logged hits, no
final, the replay 8 and the final).

## 2026-11-24: Misprediction candidates: logged-as buffs, the enemy's HP, Ardelia's chain

**Goal:** work through the misprediction analysis's candidates (docs/analysis/2026-11-24-misprediction-stats.md): the
weapon "ready" buffs, the rest of the ×1.5 band, the fight-wide factors below the offsets screen, then the one-buff
list's largest; root cause and fix, or ruled out with why.

**Done** (the analysis's follow-up section; open-problems "Misprediction statistics"):
- **The "ready" buffs were a double count.** The consuming cast's hits list the attached buff with the modifier
  (`_valid`), not the kit buff's modifier-less gameBuff (`_exist`): the check added both (59 hits in 0c14, 7e19, d4fb,
  a27b). `loggedAs` on Grand Vision's and Glorious Memory's buffs, Aspirant's, Cohesive Traction's, and Yvonne's ultimate
  states (P5 child, 5082's 72 hits; found by scripts/probes/stats/doublecount.py).
- **The enemy's HP from a kill's total, in lives** (engine assumption `enemy-hp`, buffreplay.ts loggedEnemyHp): the
  replay had an HP only when the total was the data's Max HP. Chen Qianyu's P1 below half (d4fb ×1.16 below, ×1.00
  above; in-game test 69 decided from a27b) and Alesh's P5 ultimate (×1.5 below half: a9d7 6 of 6 over Si's two lives).
- **Ardelia's ×1.5 basic attacks were placements:** attacks 1 and 2 share a key; after attack 3 and a combo the
  placement took an older attack 1's window (logcasts.ts choose: the latest basic cast says the step).
- **Si's Amp in 9c0b:** her ultimate pressed before the log's first hit, skipped for energy the log can't show; made now.
- **Ruled out:** Liino's 7910 / af7b factors as builds (fit-build fits her clean hits as exported; the screen is right).

**Scoreboard** (`npm run snapshots:update`): development plain 67.1 → 67.8%, matched 83.5 → 83.9%, mismatch 11.6 →
11.5%, mean |damage error| 7.2 → 7.0%; hold-out plain 77.6 → 78.3%, mismatch 6.2 → 5.9%, mean |damage error| 8.0 →
8.5% (2 better, 4 mixed, per hit closer; the total that moved most came with the "ready" fix, which exposed an
under-prediction the double count hid, as in 7e19); earlier pending plain 63.7 → 64.2%, 4.5 → 4.4%; all but the
hold-outs 5.7 → 5.5%. Better: d4fb +9.6 → +0.5% (plain 465 → 516), 9c0b −4.9 → +3.0% (367 → 410), a9d7 −5.0 →
−1.8%, c4f3 −5.0 → −3.1% (214 → 242), 5082, a27b. Totals worse with per-hit closer: 7e19 +2.0 → −6.6% (the
Endministrator +21.9 → +2.3% exposed Ember's −21.5% and Chen's ×1.15), 0c14 −3.5 → −4.9%, 4e36 and de6a (matched
closer, replay-only landings left). Teams (team-ab against a4f6ddb): every team's fight the same (the log check's changes only).

**Decisions:** the HP rule behind an assumption (the stage pools are a kill's total, not seen in any data file); lives
only where an away stretch starts at a multiple of Max HP (Si's eight fights all show it). The pre-log ultimate rule
only before the first hit: every unseen ultimate made regardless made 1cd1 −19.5% (docs/tried/).

**Left:** Liino's ultimate Amp starts later in the replay than in the game (1cd1, af7b: the replay's stop of her
ultimate covers teammates' logged hits); 7e19's Chen ×1.15; the one-buff list's rest.
