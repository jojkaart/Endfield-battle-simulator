# Journal

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first. Keep entries short; details belong in the docs they produced.

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

## 2026-10-21: more ZMDLogs logs (operators without one, multi-target)

**Goal:** the owner's "look for more logs to cover more operators …
also grab some multi-target logs" (multi-target support itself later).

**Done:** character profiles on ZMDLogs (`/api/characters/{id}/profile`,
14 requests) listed battles for the 14 operators without a log; 22
picked (two per operator, newest first, different bosses), details and
exports fetched 3 s apart. 16 single-target fights went to
fixtures/pending/ (first check results in its README), 6 multi-target to
the new fixtures/multi-target/ (each hit names its `target`; not checked).
Every operator but Avywenna (no log since 1.6) is now in at least one.
Loader: EnemyTable aliases (stage variants use their attribute template,
with modifiers: types 0, 1 and 4, the last a reading) and DungeonTable
stage levels; the importer takes the level from the log's stage.
`--detail` reuses a downloaded battle.

**Findings:** the first checks are mixed: some operators match whole
fights (Laevatain 383/384, Liino 175/175, Pogranichnik 258/258, Arcane
186/186, Si 152/153), many are off by one constant factor (build values
the log doesn't record, or food), one fight is ×0.100 for everyone (an
enemy-side effect). Not investigated yet.

**Problems:** the site is slow (1–2 MB details); a first loader version
refused an unknown modifier type and broke data loading mid-import (no
requests were sent while it was broken).

## 2026-10-21: the Endministrator's +180 ATK is a food buff

**Goal:** explain the Endministrator's 0 of 34 matches in 7e19 (batch 2
K4/K7: every hit short by +180 flat ATK).

**Done:** the owner suggested potential first (their P4 came from the
story): no potential gives ATK, P0–P5 all miss, and her ultimate's ratio
equals her basic attacks', so the log's P3 holds. Then the owner
suggested a food buff: UseItemTable's Ginseng Meat Stew
(`item_corp3_animal_1`) gives one operator ATK +180 flat
(`buff_common_atk_buff_potion_2`, formulaItem 7) and Crit Rate +11.44%
for 300 s. Hand-noted on her hits in the fixture (as 180 / 819 in the
ATK% sum): 34 of 34 match. The logs list percentage food buffs (40d9's
Bottled Duskberry Juice, b7b3's Jakub's Legacy) but not this flat one.
The stew doesn't fit Chen in the same log (her hits go to ×0.84–0.88).
Trying every ATK and DMG food on each remaining mismatch: Si in e82d is
the stew too (her ×1.139; 0 → 21 of 22 match, hand-noted); no food fits
Chen, Ember or Perlica.

**Decision:** food isn't in builds or scenarios yet. All 36 combat foods
share one stacking key and target one operator for 300 s; several are
large (Crit Rate +25%, Physical DMG +33%, DMG +25%), so searches should
take them into account: roadmap item.

## 2026-10-21: batch 4 — the eleven 6-stars, Link, dives

**Goal:** the owner's "complete the rest of the operators": the eleven
6-stars without kits and the 41 weapons without one, through the full
process (analysis, merge, shared features, kits, review).

**Done:** eleven analysis agents (read-only, draft kits checked against
the logs in scratch copies), one merge agent (docs/kit-batches/batch-4.md:
E, T, C, V, B, S, A, D, L rows, owner decisions, weapon owners, test
proposals), five feature agents in worktrees (triggers and conditions;
values and buffs; skills and timing; data compilation; log tooling), one
dive agent (batch-1 S10: dives as rotation actions and in the search),
eleven kit agents, three follow-up agents (log checker; stats and loader;
engine timing), and two docs agents (in-game tests 77–96 and parts of
existing tests). All merged one at a time; 1622 tests. Logs: b7b3 matches
every hit of all four operators; 4e5e's reactions 18/0/0 and, with kit
values for its hand-noted buffs, Camille 85/85, Estella 41/41, Rossi
152/162; 7e19 Pogranichnik 29/29, Ember 14/21; abfd Yvonne 182/183; 40d9
Camille 6/6.

**Decisions and why:**
- Link only from the data's sources (ComboAction: Lifeng's and Camille's
  combos; Akekuri's talent). Two analysis agents found it independently;
  five logs show ordinary combos leave none. Example totals dropped 1–9%
  where a battle skill or ultimate followed a combo. In-game test 8
  confirms it. Thermite Cutter reacts to Link; it gives none
  (Pogranichnik's kit agent corrected my first reading).
- Owner (2026-10-21): dives in rotations; 6-stars default to P0 in
  searches. Jump physics aren't in the data: Endaxis's values, with
  in-game test 97 for the pace and what a jump may do.
- Combustion's ticks keep the applier's side from the reaction (4e5e's
  three ticks fit only that); the enemy's side is read per tick.
- Merges without a full check after each while twelve agents ran (4 CPUs,
  15 GB, out-of-memory kills and test timeouts): typecheck, lint and the
  affected test files per merge, a full check once the load dropped.

**Follow-ups after the review** (three agents, merged one at a time,
each compared against a clean copy):
- Log checker: unquantified hand-noted buffs valued from the kits; Rossi
  on 4e5e 152/162.
- Values and loader: a buff's main attributes reach ATK through the
  panel's floored attribute bonus (`lifeng-solo` 391,096 → 514,161:
  Mountain Bearer, ×1.17 ATK per buff); stack caps from the data;
  Solemn Phalanx on the Arts Susceptibility tag; `linkGained` for
  Thermite Cutter; `efsim calc` shows attributes 76–79.
- Engine timing: ticks on a buff's end frame (4e5e's 26 bleed ticks);
  `afterHits` for delayed actions (per trigger: Yvonne's and Mi Fu's
  files order the same-frame clips oppositely); modifier conditions after
  a hit's own buffs (`yvonne-fluorite` +544); `untilFrame` (Ember); a
  button skill's windows open for the skill it casts (`camille-gilberta`
  201,716 → 200,535: Hunter Pursuit 8 frames sooner, its first hit now
  lands before Gilberta's field).
- No log verdict moved in either of the last two.

**Problems:** machine load with 12 agents (an agent's `pkill` may have
hit others' runs; `npx tsx` runs were killed for memory, `node` directly
works); several agents' worktree setup scripts were refused (links made by
hand, as before); the compiler test's OPERATORS / KNOWN lists conflicted
at every kit merge (resolved by script).

## 2026-10-20: batch 3 — the ten kits, pattern review

**Goal:** batch 3's kits (the ten 5-stars with their 5-star weapons and
two gear sets), after the shared features below.

**Done:** ten kit agents in worktrees, one per operator, from one shared
brief (re-analysis of every gap against the engine first, then the kit,
tests, an example, the logs, a "Kit" section in the report). Merged one at
a time; the compiler test's OPERATORS / KNOWN lists conflicted at every
merge and were resolved by a script that keeps both sides. 963 tests.
Logs: Xaihi 82/82 hits with her fixtures' weapon levels fitted (85, 60);
abfd's reactions 5 matched / 3 unexpected (was 0 / 8). Pattern review:
`efsim kit-census` on 22 kits; MI Security's counter replaced by
`buffLayers`; `enemyHpBelow` takes a value; `randomOutcomes` counts
`choose`. Pending-log notes updated.

**Decisions and why:**
- Two kit agents each fixed `ownHitsLanded` for a different case
  (Snowshine: nothing past a first end; Wulfgard: nothing a due jump
  skips); both are general rules, so the merge keeps both.
- Snowshine's combo trigger ("HP below 60%") stays an interim (any
  attack on the controlled operator opens it), since operator HP isn't
  tracked (owner, 2026-10-20): in fights without enemy attacks her combo
  never comes, which fits "effects needing low HP don't fire".
- Chen's P1 follows the data (below half enemy HP), although the 7e19
  log lists it at full HP; in-game test 69 decides.

**Problems:** the machine's load with ten agents made the CLI process
tests time out at 60 s in several agents' runs (they pass alone and in
the merged run). Open engine-wide questions are listed in the review
(kit-abstractions.md): buffs held by global slow-downs, the dodge policy
and `cast` counters, S3's residue.

## 2026-10-20: batch 3 — shared features, search over distributions

**Goal:** implement batch 3's merged gaps
([batch-3.md](kit-batches/batch-3.md#merged-gaps)) with the owner's
decisions (enemy HP from the scenario; random results as distributions),
and finish batch 2's leftovers.

**Done:** N1 (enemy HP from the scenario, `enemyHpBelow`), A5 (Arts Bursts
land a second after their infliction, on the enemy's clock; the delay is
read from the burst buff's first tick), S2 for delayed trigger actions
(`KitTrigger.launch`), S4 (helper skills reached by CastSkill join the
operator's skills: Purrchena's shield loop and blocks). Four agents in
worktrees, merged one at a time with the full check, example totals and
log outputs after each: log tooling (batch 2 K6, batch 3 L1, L2), the
compiler leftovers (D2–D4: element, stagger, finisher factors, physical
statuses, branches, ticks, auras, gates), triggers and values (T1–T4, V2,
V3), buffs and statuses (V4, B1, B2, A1–A4, C1). The search ranks over K
seeded battles when a scenario has random outcomes, reports the found
rotation's spread, and is 2–8× faster (typhoeus-gilberta at beam 24: 290 s
→ 38 s) by memoising `advance` and judging most candidates by whether
they can start now. In-game tests 60–76 written. Arcane's kit: Final
Strike Stagger on attack 5, none on the finisher (its numbers were
hitEnvData, damage to scenery). 660 tests.

**Decisions and why:**
- The burst delay comes from BuffData (`triggerInterval` with
  `waitFirstTriggerInterval`), not a constant, so a data change follows.
- A search over random outcomes proposes each step from the scenario's
  own seed and replays it in the other battles at their own earliest
  frame (what `simulate` does with that seed); requiring one frame in all
  of them dropped nearly every child once dodges diverge.
- A helper skill takes the group and level values of the listed skill
  whose ID is its prefix (Purrchena's combo casts `normal_skill_loop_1`,
  a battle-skill helper).
- Kit interims the new features replace are left for each batch-3 kit
  (the agents listed them); no existing kit changed meaning.

**Problems:** the search branch was cut before S1/D1, so its pinned solo
total was stale (re-pinned: 1,176,753.682, the rotation replays exactly).
Two agents both created `tests/batch3-shared.test.ts`; one is now
`batch3-buffs.test.ts`. Agents still can't run `setup-worktree.sh` (tool
refusal) and link the packages by hand.

## 2026-10-19: batch 2 — kits, in-game tests by hand, search

**Goal:** batch 2's kits; make the in-game tests doable by hand (owner:
frame timings and exact SP can't be tested; the game shows an SP bar).

**Done:** five kit agents in worktrees (each re-checked its report's gaps
against the new engine first, then wrote the kit and its equipment) and one
agent reworking docs/in-game-tests.md; merged one at a time with the full
check, example totals and log verdicts after each (all unchanged; the
compiler test's OPERATORS/KNOWN lists conflicted at every merge, resolved by
keeping both). Fluorite's 56 logged hits match after fixing her fixture's
build from the log. At the merge: attributes 62/63 on kit buffs, the gate
looking again after a counter's jump. Pattern review done
(kit-abstractions.md). Search: optional resource weight (+4.6% on
si-laevatain at weight 1, no change for Laevatain alone), and found
rotations are now applied during the search exactly as recorded.

**Decisions and why:**
- In-game tests must be observable by eye or by a stopwatch (≥ ~2 s),
  with a relative comparison and predictions per hypothesis; otherwise
  "not testable by hand" with the impact noted (the doc's intro).
- Search applies each step with its `at`: a found rotation once failed to
  replay (Liino + Laevatain: a swap legal at 138 in the search, at 198 on
  replay); applying as recorded makes replay equal by construction.

**Problems:** a search over a 49 s two-operator fight (typhoeus-gilberta)
took over 10 minutes at beam 24: search speed for long team fights is
next to fix. One kit agent couldn't run `source scripts/setup-worktree.sh`
(tool refusal) and made the links by hand.

## 2026-10-19: batch 2 — shared features, rolled crits, enemy attacks

**Goal:** implement batch 2's merged gaps
([batch-2.md](kit-batches/batch-2.md#merged-gaps)), with the owner's
decisions on enemy attacks, crits and perfect dodges.

**Done:** group 1 (L1, B4, D4, S2, S4, V2, B2, D1, D2), group 2 (T1–T6,
C1, C2), group 3 (V1 hit base values, B1 Link buffs, B3 shared timers, S3
chain steps by timing, S5 team energy in parts, S6 the gate seeing an
action's end); E2: crit mode `rolled` with seeded streams, crit events
for triggers, `simulateRuns` / `efsim simulate --runs n` for the spread;
E1 part 1: the scenario's enemy attacks and charges as events on the
enemy's clock. Example totals and log verdicts unchanged throughout.

**Decisions and why:**
- `teamEnergy` parts replace `teamEnergyFrame` (one mechanism; kits
  migrated), with kit-draft reading each CreateBuff's `ratio`.
- S6 finds when an action ends by advancing and bisecting, only for kits
  that can end their own action: generic (any trigger path) and cheap.
- One random stream per source (`crit`, later dodges), seeded from the
  scenario's seed and the stream's name, so adding dodge rolls doesn't
  reshuffle crits. With `expected` crits no hit counts as a crit for
  triggers (design.md).
- Enemy actions run on the enemy's clock, so time stops delay them.

Later the same day: S1 (jumps skip time; conditional jumps by
`KitSkill.jumps`, event-driven ones by a trigger's `jump`;
InterruptCurSkillAction ends the action) and E1's dodges (`dodge:
{chance}`, perfect dodges from BuffData: SP, the world's slow-down, the
dodger's freeze). Laevatain's battle skill now locks her 37 frames;
laevatain-solo does the same damage in 22.4 s instead of 29.2 s.

- Jumps skip time because Catcher's data is inconsistent otherwise; test 17
  confirms on Laevatain. A buff bound to its cast counts the frames a jump
  took from it as time it had left, so Twilight gets back the skipped part
  of its pause.
- Dodges are automatic at each attack on the controlled operator (the
  owner's with/without/chance comparison), not rotation steps; the dash
  ends the current action, so a rotation recorded without dodges may
  become invalid (search plans around the attacks).

**Problems:** Ajv's strict mode refuses `anyOf: [{required: [at]}, …]`
in the scenario schema; dropped (an action with neither does nothing).
The dodge-research agent's `git show` calls fetched about 200 files from
GitHub into the data submodule (a blobless clone), and it briefly ran a
repo-wide `git grep HEAD`, which would fetch everything; stopped. Never
`git grep HEAD` there.

## 2026-10-19: batch 1 — kits

**Goal:** the batch-1 kits phase: re-analysis (pass 3), the seven kits with
their equipment, verification against the logs, the pattern review.

**Done:** pass 3 by seven agents (each plan loaded and run from a scratch
copy) found 11 small gaps, all implemented. Seven kit agents then wrote the
kits in parallel worktrees, one owner per equipment kit; I merged them one
at a time, re-running every check and log comparison after each. No log
mismatches anywhere; Typhoeus, Si and Estella now have 94–100% of their
logged damage checked (from 1–83%). Engine fixes the kit agents found are
in, and the pattern review removed a dead field (`durationFrames` on kit
skills), a marker-buff workaround (Laevatain) and a never-true predicate
hack (`followUpOnly`).

**Decisions and why:**
- Parallel kit agents in worktrees with explicit equipment ownership:
  shared equipment (Swordmancer, Eternal Xiranite, the heal set) gets one
  writer, so merges only conflict in test lists.
- Agents may not change engine code; they describe the change and use an
  interim in the kit, and the merge step makes it once for everyone.
- A fixture lists hits that happened, so the per-hit test assumes the
  situational parts it can't record.

**Problems:** merging squashed one branch (Arcane's) because I stashed
during a merge; the content is the same. The KNOWN list of compiler
disagreements is order-sensitive and conflicted at every merge. Two of
Estella's tests assumed unscaled energy until Gilberta's Messenger's Song
arrived.

## 2026-10-18: batch 1 — pass-2 gaps implemented

**Goal:** implement the gaps the seven pass-2 re-analyses left
([batch-1.md](kit-batches/batch-1.md#pass-2-remaining-gaps-merged-2026-10-18)).

**Done:** Link for every team; layers per recipient, per-subject
cooldowns, a fight-start event; trigger filters (skills, decorations,
finisher, the causing hit's kind, buff categories, heal kinds,
reaction hits, once per cast); before-damage status triggers; branches
for alternative hits; `scaleValue`, cooldown fractions, values of
unlearned talents as 0, `talentAtLeast`, `{talent, key}`; what ends with
a cast (delayed actions, `endsWithCast` buffs, `cancelHits`,
`endAction`); `cantCastSkill` channels; no dive attacks without jumps;
the time a buff had left and what a recording buff recorded; Fixed DMG
(Si's Artful Intent, unique); control-immune targets; event counts in
the log checker; kit buffs in fixtures and `calc --buff`. In-game tests
20–50 collected from the reports. Then a pass-3 re-analysis of the seven.

**Decisions and why:**
- Before-damage status triggers are opt-in (`beforeDamage`), not the
  default: the data orders actions per skill, and no current trigger
  needs the other order.
- Delayed cast-trigger actions belong to their cast (dropped when it's cut
  short) unless `detached`: SkillData timeline actions stop with their
  skill.
- A cooldown fraction is of the full cooldown, and ultimates don't get
  through `cantCastSkill` channels: assumptions, with in-game tests 36
  and 15.
- What can't be settled without the game (jumps, hit-stop, the WILL
  combo's element, …) is listed with its interim rule in
  [batch-1.md](kit-batches/batch-1.md#pass-2-whats-still-open) rather than
  guessed in code.

**Problems:** none that moved numbers: every change kept the example
totals and log verdicts identical until a kit uses it (checked against
the previous commit each time).

## 2026-10-18: batch 1 — values, skills, arts, physical state, time

**Goal:** the rest of batch 1's shared features, per family.

**Done:** values and resources (event counts, starting stacks, SP on hits,
energy-grant options, team energy at its data frame); skills (hitless
skills via delayed cast triggers, availability Predicates, cooldown groups,
control-taking casts, follow-up casts, energy-blocking buffs); when the
next action may start, from SkillData windows, `skillSpecification`
priorities and exclusive time, with interrupts cancelling hits still to
land and basic-attack chain steps from the data; stack requirements as
ranges with partial use; arts-state extensions (enemy-element infliction,
partial absorption, burst events, applier status tweaks, status
consumption); the log checker's skill-set stack caps; physical state
(Vulnerable, Lift, Knock Down, Crush, Breach, Shatter) and stagger with
finishers; control statuses that freeze the enemy's clock; ultimate time
stops and global slow-downs; haste.

**Decisions and why:**
- Research by sub-agents on Endaxis (read, not copied) for the skill-gate,
  time and physical rules; claims checked against our data and logs
  before use. Endaxis's "no windows, anything goes" is its own admitted
  bypass, so the engine doesn't follow it; its ignoring of
  `cantSwitchPosition` isn't followed either (the data is explicit).
- A recorded action without a time waits for the current skill's own
  hits; only an explicit time interrupts. Otherwise every priority
  interrupt would cut skills short in hand-written rotations.
- Slow-downs shift everything after their start by the frames they cost:
  exact for stops, simple, and keeps state plain.
- Haste and the time stop's effect on cooldowns are assumptions with
  in-game tests (18, 19); 15–17 check the skill gate.

**Problems:** the Laevatain example overran Twilight once enhanced attacks
waited for the data's exclusive time, until her kit got the Twilight
pause (report gap 2); Liino's example had a chain step the chain no longer
allows. One commit went out with a type error in a test (fixed in the
next).

**Results:** example totals moved only where timing changed (−1.6% to
+2.9%); log checks gained Estella's and Gilberta's physical-status hits
(coverage 52% → 83% and 67% → 79%) with no mismatches.

**Next:** merge the SkillData compiler (D1, in progress in a worktree),
use it for loader defaults, re-analyse the seven, write the kits.

## 2026-10-18: batch 1 — analysis, then triggers, conditions and buffs

**Goal:** the owner's kit process ([kit-process.md](kit-process.md)): analyse
all seven batch-1 operators first, then implement the missing features per
family, not per operator. Owner: implement every gap (nothing deferred);
any equipment on any operator; P5 default for 4- and 5-stars in batch 2.

**Done:**
- Analysis: seven gap reports and the merged table
  ([kit-batches/batch-1.md](kit-batches/batch-1.md)), whose "Progress"
  section lists what's implemented.
- Values from talent, potential, weapon and gear-set skills (V1) and
  mode-limited talent effects (C3).
- One event model (engine `events.ts`): hits, casts, status events, buffs
  applied / ended / ticking, stacks, heals. One `triggers` list per kit
  replaces `comboTriggers` and `teamTriggers` (combo windows are an
  `openCombo` action); actions apply, gain, energy, SP, buffs (apply,
  extend, end layers), cooldowns, heals and hits. Triggered hits name
  their damage type (`none` exists).
- Equipment kits (`kits/equipment/<id>.json`) for weapons and gear sets act
  for the wearer through `effectiveKit`.
- Predicates for who is controlled, enemy debuffs from anyone, element,
  profession, team-buff recipients and the event's operator; an `if` on
  every effect.
- Buffs: layers, next-cast consumption (Link), attribute modifiers (UGE),
  recipient filters, stacking keys, open-ended and 0 s buffs, ticks.

**Decisions and why:**
- Patterns, not fields: ending a buff on a skill or with its parent, or
  starting one when another ends, are triggers (`on: cast` / `buffEnded`),
  not new buff fields; pausing a buff is `extendBuff` by the pause.
- Equipment IDs are prefixed (`<equipment>.<id>`) instead of rewritten by
  the loader: unambiguous, and predicates need no renaming.
- A hit's `controlled` predicate uses who was controlled at its cast
  (Typhoeus's report), not at landing.

**Problems found:** operator elements came from the data capitalised
("Fire"), so `teamSlotElement` could never match; fixed. Every step was
checked against the session's starting commit: example totals, log-check
and reaction-replay verdicts on all fixtures are identical.

**Next:** values and resources (V2–V5), data compilation (D1), skills
(S1–S7), arts state (A1–A5), physical state and timing, log tooling; then
re-analysis of the seven and the kits.

## 2026-10-18: energy, combos, buffs, rotation search; kit abstractions

**Goal:** make the timeline able to play a real rotation for the
favourites, then (owner's request) review what the kits share before adding
operators.

**Done:**
- Timeline: timed kit buffs (self / team / enemy, values from skill data,
  limited by hit kind), ultimate energy (cost after potentials, 0.065 per
  natural SP to the team, kit grants, Ultimate Gain Efficiency, blocks),
  combo windows (6 s, kit triggers), skill states (`availableWhile`),
  action kinds separate from level groups, swaps that wait. Research by a
  sub-agent across the data and both reference simulators.
- `efsim search`: beam search on the stepping API, deduplicating equivalent
  states; found rotations replay exactly with `simulate` and beat the
  hand-written example.
- Second kit round for all six favourites (inflictions, buffs, combo
  triggers, energy, event keys); every example scenario runs.
- Review: `docs/kit-abstractions.md` (what kits hand-write that the data
  has; requests grouped into five families; what in the parallel
  per-operator approach caused one-off fields). Owner's rule: repeat it for
  every new kit (`efsim kit-census`, CLAUDE.md).
- Step 1 of the review: one `Predicate` and one `ValueExpr` (engine
  `expr.ts`) replace hit `when` → `if`, `scaleIf` → `extraScale`,
  `ValueSpec` → `ValueExpr`, combo triggers' `when` / `whileBuff` → `if`.
  Behaviour unchanged (all examples and log matches identical). That
  commit's message lost these field names to shell backtick expansion;
  this entry is the record.

**Decisions and why:**
- BuffData stackingType 1 is "only the strongest counts"; a priority key
  alone isn't (two `vulnerable_crystal` instances add up in b7b3). One
  agent's opposite claim was checked against a log before it was used.
- Worktrees resolved the main checkout's packages, so some agent checks ran
  the wrong kits: `scripts/setup-worktree.sh`, and CLAUDE.md says to use it.

**Open:** steps 2–5 of the review (one trigger list, buff lifecycle,
kit-draft v2 compiling frames / energy / factors / buffs from the data,
arts-state extensions); a resource-aware search evaluator.

## 2026-10-18: arts reactions on the timeline; six kits merged

**Goal:** the timeline should trigger inflictions and reactions itself, and
the six favourites' kits (written in parallel by sub-agents, each with its
own journal notes below) should be merged with the engine changes they
asked for.

**Done:**
- `engine/src/status.ts`: one state machine for inflictions, bursts,
  reactions, forced reactions and consumption (Talos Wiki rules); Corrosion
  and Electrification act on hits as Modifiers, Combustion ticks each second.
  Kits say what each hit `applies` (the data doesn't: SpellInfliction actions
  are disabled stubs), taken from skill descriptions.
- Operator `stacks` with `gains` / `requires` (Laevatain's Melting Flame:
  her empowered battle-skill hit now lands only at 4 stacks; before, the
  timeline always counted it). Forced reactions can take duration and damage
  scale from skill values. The timeline reproduces Zero Sanity's in-game
  forced Combustion tick (2608) and empowered hit (57552) exactly.
- Final Strikes come from SkillData (mask bit 2097152) and kits can declare
  team triggers (Laevatain's Heat absorption). `triggers.ts hitEffects` is
  shared by the timeline and `efsim zmdlogs reactions`, which replays a log
  and compares predicted with logged reactions: 40d9's Combustion at 14441
  ms is predicted exactly, with no false predictions.
- Electrification's strength matches two logged rates exactly.
- Checker, from the agents' reports: logged buffs counted as BuffData says
  (stackingType 1 once, literal max stacks, decorate-mask conditions), every
  kit hit of a shared key tried, boundary buffs tried in subsets; the
  importer drops damage-taken zones on operators; skill-value condition
  sources and per-hit bonuses. Two pending fixtures now pass.

**Decisions:**
- What a hit applies takes effect before its own damage (Gilberta's and
  Arcane's logs both show it).
- Hits under Corrosion that match no level count as "under unmodelled
  effects", not mismatches: three agents found the ramp too strong in some
  logs (Si's points to ticks pausing during time dilation). Non-Corrosion
  hits stay strict.
- `buff_common_<element>_triggered` (newer logs' reaction key) is still not
  parsed as a reaction: it fits in Arcane's report only with dedupe, which
  is now in, so it can be revisited.

**Open:** e82d45c46040 stays pending (three unexplained factors). Gilberta's
d9e59 needs Liino's zero-duration buffs imported. Link isn't modelled.

## 2026-10-18: Liino's kit

**Goal:** Liino's (chr_0035_liino) hit structure, verified against logs.

**Done:** kit with the battle skill (6 projectiles × `atk_scale`, verified
12/12 in `zmdlogs-0eef2474a26f` and the new `zmdlogs-bdf223db8e49`; the
follow-up volley 6 × `atk_scale_2`) and the combo (`atk_scale` at frame 9,
`atk_scale_2` at frame 33). The kit-coverage test now takes known gaps per
operator.

**Decisions:** the follow-up volley and the combo keep empty `events`: all
their logged hits but six are under Corrosion, which the engine's model
doesn't reproduce (see in-game test 4), and a covered mismatch would fail
the log test. Ultimate and basic attacks are left out (reasons in the
kit's sources).

**Problems:** two imports were wasted: `btl_upload_5d51a64dd089`'s enemy
(`eny_0090_wgabyss_hdg011`) isn't in the tables, and level inference fails
on stages with scaled HP. Liino's ultimate is only in a parser-v58 log that
misses her own buffs; in-game test 6 asks for a clean one.
## 2026-10-18: Arcane's kit

**Goal:** hit structure for Arcane (chr_0032_lizhiyan), verified against
ZMDLogs.

**Done:** kit `packages/data/kits/operators/chr_0032_lizhiyan.json` (basic
attacks, plunge, battle skill, combo skill and its "seal" buffs, both
ultimates); two Rhodagn logs imported to `fixtures/pending/` (not under the
log test yet, see problems).

**Findings:**
- Every damage unit, the seals included, is plain ATK × a combo-skill key
  passed by assignBlackboard: seal_total = atk_scale_touch, seal2 / seal
  listeners = atk_scale_boom, seal_finisher_wisd = 4 × atk_scale_laser1 +
  atk_scale_laser2. Nothing scales on Intellect directly; the mode (Intellect
  ≥ Will → INT) picks branches and Susceptibility amounts.
- Log buffs with stackingType 1 ("cannot stack", e.g. Solemn Phalanx's
  will_dmg / will_atk) appear once per refresh in ZMDLogs; counting each
  buff ID once makes all 13 Arcane hits of btl_upload_b7b3762d5da8 and 4 of 5
  of btl_upload_e82d45c46040 match ±1. The checker sums them today, so both
  logs fail; parked in `fixtures/pending/`.
- `buff_common_natural_triggered` is the Corrosion reaction's damage
  (0eef: 2 stacks, 18904 exact); its stacks equal the Corrosion level the
  same hit's battle skill then gets (level 2, also exact).
- Arcane's ultimate (INT) forces Corrosion level 1 (`count` 1, duration
  `duration2`); talent 2 hooks every Corrosion she applies: +duration_add s
  and max reduction × (1 + corrupt_rate).

**Problems:**
- `fixtures/zmdlogs-d9e59d0fb737.json` (2026-10-15 01:55 +08:00, parser v58,
  before 555me's 1.6 commit 371c743) is 1.7–2.2× the model for every Arcane,
  Gilberta and Typhoeus hit after Arcane's ultimate. Within it the INT hits
  agree with each other (same ×1.9617 residual), so the structure holds, but
  its event keys can't be in the kit without failing the log test. Likely
  game 1.5; needs a 1.6 INT log or in-game test 7.
- The kit can't pick a hit by Intellect ≥ Will, and one event key maps to
  one hit, so INT variants and the final INT laser carry no event keys.

## 2026-10-18: damage calculator

**Goal:** something usable: the stat panel and damage per hit of a build,
verified in game.

**Done:**
- Loaders and cross-checks for growth, potentials, weapons, weapon level
  curves, gear, gear sets, enemies and attribute defaults (all agree between
  the sources); English names; blackboard defaults and permanent stat
  effects (`cardAttributeModifier`) from skill files.
- Engine: attribute enum map, stat aggregation with contributions, damage
  zones, crit modes, conditions. Hand-written kits (hit structure only,
  schema-checked, keys cross-checked against SkillData) for Laevatain and
  Forgeborn Scathe's conditional buff.
- Fixture format (JSON Schemas) and the Zero Sanity Laevatain fixture: 10
  stat panel values and 25 hits, **all exact** from game 1.6 tables.
- `efsim` CLI: find, template, calc, compare. 105 tests.

**Findings / decisions:**
- Formula slots: 5 add, 6 percent, 7 flat, 8 multiply; final =
  ((base + add) × (1 + percent) + flat) × multiply. 5 and 6 verified in
  game; 7 and 8 from data patterns. Slot 0 appears once and is refused.
- ATK bonus uses whole attributes (settled); final damage rounds to nearest
  (settled). Laevatain's level table now runs to 99.
- Potentials change skill values by add / multiply / set; which hits a
  value like `ratio` multiplies is in SkillData's action graph, so kits
  encode it, verified by fixtures (P1's ratio applies to the enhanced
  battle skill, not the normal one).
- Skill levels follow CharGrowthTable's skill groups (enhanced basic
  attacks use the ultimate's level but the basic attack damage bonus).
- Some tables store doubles (potentials 0.15), others float32; values are
  kept as written.
- Code must be erasable TypeScript (`erasableSyntaxOnly`) so Node 22 runs
  it directly; no build step.

**Problems:**
- Projectile and ability-entity hits link to their parent skill only by
  file name; rmxlinux has no ProjectileData.
- Conditional effects aren't modelled generically yet, so weapon
  comparisons understate weapons whose strength is conditional; `compare`
  lists them.

## 2026-10-18: TypeScript project foundation

**Goal:** start roadmap step 3, the code base everything else builds on.

**Done:** npm workspaces (`packages/data`, `packages/engine`), TypeScript
5.9 strict, Vitest 5, ESLint 10 with rules enforcing engine independence
and no `Math.random` / `Date.now`; GitHub Actions CI; cloud session start
hook; `scripts/fetch-data.sh` (sparse fetch of only the listed tables at
the pinned commits: 4.5 s and 63 MB instead of minutes and 3.5 GB). Data
loader with strict, source-aware field readers, exact int64 parsing, and
normalisers for BattleConst, SkillPatchTable and CharacterTable;
cross-check of all three between rmxlinux and 555me passes; spot checks
against values verified on the web. Engine has only unit types so far
(frames at 30 FPS, seconds, ratios). 22 tests plus the extension's.

**Decisions:**
- The account importer waits until the system is verified and finds
  useful new rotations (owner).
- Number equality across sources: identical, or the same float32 with one
  side exactly float32 (555me prints shortest decimals, rmxlinux full
  float32; some fields are doubles).
- Packages export TypeScript sources directly; no build step until needed.
- TypeScript stays 5.9: typescript-eslint doesn't support 6.1+ yet.

**Problems:**
- Liino's `chr_0035_liino_normal_skill_combo` repeats the blackboard key
  `music_trigger` with the same value at every level; same-value repeats
  are accepted, conflicting ones fail.
- Vitest 3 pulled in tinypool with critical advisories; upgraded to 5.
- Root `"type": "module"` broke the extension's CommonJS tests; the
  extension folder has its own `package.json`.

## 2026-10-18: account data capture

- No official API for player data. SKPORT's unofficial API exposes roster,
  builds (artificing per gear substat) and inventory, but needs the login
  token; Gryphline warns against third-party logins. Findings:
  [player-data.md](player-data.md).
- Owner's idea, built: a Brave/Chrome extension
  ([tools/skport-capture](../tools/skport-capture/README.md)) that passively
  copies what SKPORT's own pages load and saves it to a file. No requests
  of its own, no headers or tokens. Unit tests plus an end-to-end test in
  Chromium against a fake SKPORT.
- Problem found: Chrome injects a content-script file only once per page,
  even across worlds, so the isolated relay can't share `core.js` with the
  page hook; validation moved to the background worker.
- Not yet tested against the real SKPORT pages; the owner's first capture
  will show which endpoints the pages actually call.

## 2026-10-18: design review with the owner

- Owner approved scheduled action lists for recorded rotations, and wants
  later an interactive system: battle simulation and a policy evaluator
  side by side, generating the action list on the fly and searching the
  tree of choices. Design now has a **stepping API** (init / advance to
  decision point / legal actions / apply / fork) with recorded rotations
  and search as drivers on top.
- Owner plays daily and may run simple in-game tests; started
  [in-game-tests.md](in-game-tests.md).
- Talos Wiki API: lookups as needed are fine, no scripted mass downloads;
  ask before any unavoidable mass download (now in CLAUDE.md).

## 2026-10-18: web verification and design draft

**Goal:** with web access, verify the research, then draft the design.

**Done:**
- Tested reachability of every host in the docs; the owner edited the
  allowlist accordingly. Record: [network-allowlist.md](network-allowlist.md)
  (purpose and usefulness per host, removal candidates).
- Four parallel sub-agents: licences/terms, data access (APIs), formula
  questions, reference-simulator architecture. Results merged into
  [data-sources.md](data-sources.md), [design.md](design.md) (with
  architectural principles), [game-data-format.md](game-data-format.md),
  [reference-simulators.md](reference-simulators.md) and a new
  [glossary.md](glossary.md).
- Key findings: the game's BuffData encodes damage modifier zones
  (additive `NormalCalcZone` vs multiplicative `ProdCalcZone`, attacker and
  defender side), which settles Breach (damage taken, not negative DEF) and
  stagger grouping; Corrosion/Breach/Electrification scale with a separate
  Arts Intensity curve; timelines are 30 FPS; SkillData's own blackboard and
  costs are defaults (overlay SkillPatchTable); ZMDLogs' per-hit data is in
  `/api/battles/{id}`, not `/export`; first fixture battle chosen.

**Decisions:**
- Rotations are programs scheduled at the earliest legal frame, not
  absolute timestamps; illegal actions are errors (all reference simulators
  only warn, which breaks search).
- Two-stage engine: cached build stage, then an integer-frame event queue;
  several clocks from day one (time-stop).
- SkillData/BuffData are compiled offline into summaries plus a small,
  tested, hand-written behaviour layer per operator; unknown types fail.
- Don't copy Zero Sanity's game-data JSON (partly sourced from Endaxis).

**Problems / dead ends:**
- Sub-agents can't write report files to the scratchpad; they return text.
- Talos Wiki: robots.txt disallows `/api.php` for automated agents. Two
  agents had sent ~60 targeted requests (≥1 s apart) before this was noticed;
  the owner then decided API lookups are fine as long as they cause no undue
  load: no scripted mass downloads. `Mozilla/5.0` user agent is blocked there; use a descriptive one.
- BWIKI rate-limits after a few requests; Huiji, Icy Veins, NGA block
  automated requests; end.wiki's domain no longer exists.
- In this session `555me-beyondGameData` was cloned with `--depth 1` (its
  history isn't needed yet); `fetch --unshallow` before per-patch work.

## 2026-10-18: project setup and data-source research

**Goal:** turn the empty repo into a plan and choose data sources.

**Requirements gathered from the owner** (now in [README](../README.md)):
- Search team compositions under constraints: must-include / always-exclude
  operator lists (often changed per search), available gear and especially
  weapons.
- MVP: keep it simple, reproduce results published on the web.
- Web interface for browsing results; the owner will usually ask Claude to run
  simulations.
- TypeScript prototype, Rust implementation later.
- Correctness is essential; tests must stay up to date and passing.
- Data from multiple sources so they can be cross-checked.

**Done:**
- Researched raw data repos, wikis/databases, and existing simulators with
  three parallel sub-agents; wrote up [data-sources.md](data-sources.md).
- Linked data repos and reference simulators as git submodules
  ([data/](../data/README.md), [reference/](../reference/README.md)).
- Added [CLAUDE.md](../CLAUDE.md) and [roadmap.md](roadmap.md).

**Decisions:**
- Primary data rmxlinux/EndfieldData, cross-check 555me/beyondGameData. The
  two were compared value by value and are identical, but both decode the same
  game files, so in-game numbers are still needed to validate the formula.
- Submodules rather than copying data: no republishing, but local clones keep
  full copies. The owner sees no problem using data others have published.
- Existing simulators are a starting point. Endaxis has no licence: read and
  compare only, never copy its code.
- Using ZMDLogs' published logs through its public API is fine.
- Branches: until the first useful version, work goes straight to `main`
  without asking; other branches only for parallel sub-agents. Afterwards a
  `dev` branch takes `main`'s role.

**Problems / dead ends:**
- The environment's network policy blocked every website except GitHub, so
  wiki, tool and licence findings came from search extracts and are marked
  *(unverified)*. The owner set up a new environment with those hosts allowed;
  the next session should verify them.
- `rmxlinux-EndfieldData` is ~2.3 GB checked out and takes ~1.5 min to fetch;
  it's marked `shallow` in `.gitmodules`. Submodules may not be initialised
  automatically in a new cloud session (`git submodule update --init`).

**Next:** see [roadmap.md](roadmap.md).
