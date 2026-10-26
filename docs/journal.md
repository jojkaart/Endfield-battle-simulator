# Journal

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first. Keep entries short; details belong in the docs they produced.
Older entries (2026-10-21 and earlier): [journal-archive.md](journal-archive.md).

## 2026-10-26: accuracy plan A1, casts the log placement merged

The owner on teammates: they basic-attack on their own, slower than the
controlled operator, not during e.g. Liino's stance and ultimate (plan
B0). Then A1 (accuracy-plan.md "Progress"): four placement and replay
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
earlier: B1 next after A.

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
