# Rotation search

Part of the [design](../design.md): The rotation search, the payoff table and chains, and pruning.

`efsim search` (engine `searchRotation`, `searchBeams`) is a beam search on
the stepping API. By default it never swaps (`SearchOptions.swaps`, CLI
`--swaps`; the owner, 2026-10-25: "I don't intend to do operator swaps
during battles"): the scenario's controlled operator does every basic
attack and dive the rotation makes, and the teammates cast their battle
skills, combos and ultimates; between those, the teammates basic-attack on
their own (scenario `teammateAttacks`, default on: `teammates.ts`, which
the search doesn't decide). At each decision point every legal action is tried
(`legalActions`: the actions that can start soonest, plus the controlled
operator's next basic attacks even if later, plus the *asides* whenever
legal: the swaps and the controlled operator's dive, which don't count for
what's soonest — a swap can nearly always start at the state's own frame
and a jump as soon as the current skill's exclusive frames end, so counted
they hid every skill that could start a few frames later: review round
two, 2026-10-25), each applied with `at` the frame it starts, so the found
rotation replays to exactly the searched states with `simulate`. Per
half-second bucket the best `beamWidth` nodes survive, ranked by committed
damage (hits landed plus everything already on its way: the state advanced
to the fight's end) plus what the state holds for later (below, *How the
beam ranks*); the result is the node with the most committed damage.

**Pruning** (`prune`): of equivalent states only the best is kept (below);
then the best of each *family* in score order, then, if there's room, the
best of the rest. A family is the states that are the same but for who's
controlled (now, and when each hit on its way was cast) and the order of
the buff list (`stateKeyer(ctx, true)`): a swap is free and takes no time,
so every state came in up to one variant per team member, all with one
score, and in a team they filled the beam (the 4-operator example at beam
12: at one bucket all 12 nodes scored 671,349, and the rotation the beam of
6 had found was dropped). A search policy, not an exact merge (the others
are a swap away). Capping nodes per coarser macro state (controlled
operator, SP band, ultimates ready, combos off cooldown; or ultimates cast
so far), with or without a reserve for the best of each, was tried and
dropped: it moved results both ways (laevatain-solo at beam 12: 1,165,844
→ 1,006,745; the 4-operator example still fell to 1,576,033 at beam 6).
`resourceWeight` (unspent SP and energy worth what one cast deals per
point) was removed for the same reason: it hoards (si-laevatain at weight
1: 468,743), and with families a weight of 0.2 lowered every result
measured (liino-laevatain 1,510,467 → 1,436,660 at beam 12, the 4-operator
example 3,554,349 → 3,316,409 at beam 6); its one-cast prices can't value
an ultimate whose worth is what it enables (Laevatain's). Its successor,
priced by probes and with casts in progress counted, is below.

**How the beam ranks** (2026-11-14; `resourcePrices`, `resourceValue`,
`SearchOptions.valueWeight`, default 0.5). Damage so far prunes the lines
that bank for later: from zero ultimate energy every line looks alike until
someone's ultimate is up. So a node's score is its committed damage plus
`valueWeight` × what it holds:

- *Ultimate energy and team SP* at a price per point found by **probes**,
  not tables: once per search, from the fight's start with every ultimate
  charged, each operator's ultimate and battle skill is cast, then the
  controlled operator basic-attacks for 10 s; a cast's worth is the damage
  committed by then minus that of the attacks alone. So a cast that pays
  off through later hits is priced by them (laevatain-solo: her ultimate
  282,014, her battle skill 4,128), and a kit change moves the prices with
  it. Energy is worth its operator's ultimate's worth over its cost; SP the
  mean over the team's battle skills of worth over SP cost (who gets the SP
  is a choice). The resources' worth falls linearly to 0 over the last 10 s
  of the fight (no time left to spend them).
- *Casts in progress*: what of a probed cast's worth is still to come at
  its age (the probe's curve, half-second steps). Without it a cast turned
  the energy's worth into nothing until its damage landed, and the beam
  hoarded: Laevatain held her ultimate to 19.6 s of 30 (630,476 at beam 12
  against 1,113,946), si-laevatain fell to 390,173. With it, casting is
  worth at least holding at every age the probe saw.

What it doesn't see: what builds up outside the resources (enemy debuffs,
inflictions, stacks that a later skill consumes). In the owner's team from
zero energy (30 s) the best rotation holds Estella's battle skill and combo
to 27 s for 263k where a cast at 22 s gets 131k; the value is about 20k
there, too little to keep that line in a wide beam. Probing costs 0.03–0.2 s
a search; the score about nothing per state (per-state times within the
machine's noise, 0.9–1.1×). Weights compared (single widths, best of
w/2 / w / 2w): 0 / 0.5 / 1 gave the owner's team (30 s, full energy)
1,560,514 / 1,586,388 / 1,598,596, from zero 979,020 / 1,068,442 /
1,016,787; si-laevatain 2,407,715 / 2,387,476 / 2,387,476; laevatain-solo
1,155,679 / 1,156,151 / 1,155,621; si-laevatain-liino-gilberta 3,190,240 /
3,185,817 / 3,170,975 (w 6 / 12 / 24); duo 263,699 at all. Each width alone
still moves both ways with it (si-laevatain-liino-gilberta at 24:
3,190,240 → 2,933,298 at 0.5): the value helps the owner's teams most and
is within ±1% elsewhere, so it's on at 0.5; `valueWeight: 0` is the ranking
before, bit for bit (the pinned totals in tests/search.test.ts).

**Equivalent states** (`stateKey(ctx, state)`) are equal in every field
that what comes next reads: each `TimelineState` field, and each field of
each kind of scheduled item and of a buff, is classified in a `KeyRules`
record (in the key, a projection of it, or a reason it isn't: landed hits
and the reaction record are the score and the log), so a new field doesn't
compile until someone decides; scheduled items are keyed per kind, in
order (the order within a kind is what ties go by); the key is a canonical
serialisation (sorted keys), with SP and energy rounded to 0.1
(floating-point noise between paths). Exact by construction, it leaves
out (`KeyEnv`, 2026-10-25):

- *Deadlines already past.* Everything after a state happens at its frame
  or later (advance only moves forward, an action starts no sooner than
  the state's frame, a slow-down shifts only what's after its start, which
  is no sooner either), so a deadline the engine reads only as "is it
  later than now" is none once it's at or before the frame: `readyAt`
  (read as `> frame` or max(frame, ⌈it⌉); cooldown changes skip ended
  ones), `energyBlockedUntil` (`> frame`, set anew), `spPausedUntil`
  (max(frame, it), raised with max), Link expiries (`> frame`),
  `enemyFrozenUntil` (max(event frame, it)), a stagger that's over (the bar
  counts as full, `finisherUsed` is read only while Staggered), slow-downs
  that have ended, chain steps whose window closed (a dead step that was
  next isn't promoted: `chainAfter` keeps only a live one), a buff's ended
  `whileCasting`, combo windows that closed — except those a follow-up
  combo of the team may cast into (`castSkill` reads a follow-up's window
  count without checking it's open) — and a trigger's cooldown once ready
  (its count only when it has a `maxCount`).
- *Cast indices* count from the end of the cast list (the engine only
  tells casts apart, looks one up and numbers the next by the list's
  length): in scheduled items' cast references, bursts' `fromCast`, a hit's
  `branch`, a delayed action's event, actions, buffs, per-cast trigger
  counts and each operator's last cast; a cast nothing refers to any more
  drops out (its Link, its per-cast trigger counts).

Tests: a state with dead deadlines added has the state's key and the same
future (the same choices, damage and keys for 40 steps); every pair of
different states a small beam merges (40 pairs) plays on the same.
Merges gained (beam 24, nodes compared → merged): si-laevatain 8,943 →
1,533 before, 9,190 → 1,701 after; laevatain-solo 3,463 → 76 before,
3,465 → 176 after. Few: paths that meet again mostly differ in what's to
come, not in what's past.

**How far to trust a result** (`searchBeams`). A beam search isn't
monotone in its width: what survives a bucket is ranked by a score of the
present, so a rotation that pays off later (Si's Initial Stroke deals nothing
itself; Laevatain's ultimate deals little, its enhanced attacks a lot) can
be dropped when a wider beam brings in more nodes that are ahead for now.
`efsim search --beam w` (default 24) therefore runs w/2, w and 2w, keeps
the best and prints each width's result and the spread, (best − worst) /
best; above 1% it says to treat the best as a lower bound. Since
2026-11-14 each width after the first is **guided** by the best rotation
found so far (`SearchHooks.guide`): its nodes keep a place in the beam
(the last, when the score alone would drop them; an equivalent state that's
kept takes it over), so the wider beam finds at least as much and the
spread is what the wider beams found on top (before, the owner's team gave
3,061,788 / 2,924,392 / 2,928,204 at 12 / 24 / 48: the wider beams lost
the narrow one's rotation). The owner's team (60 s, 2026-11-14), beams 12 /
24 / 48, before (single widths, damage so far) → after (guided, with the
value): full energy 3,061,788 / 2,924,392 / 2,928,204 (spread 4.5%) →
3,232,373 / 3,273,371 / 3,286,029 (1.6%; 47 / 44 / 50 ms a state, about
1.1× before); from zero energy 2,827,922 / 3,008,031 / 2,744,453 (8.8%;
40 / 40 / 45 ms a state) → 2,797,948 / 2,808,913 / 2,973,678 (5.9%; 42 /
41 / 42 ms): from zero the best of the three fell 1.1% (3,008,031 →
2,973,678; the value is small while the energies are low, *How the beam
ranks*), and the widths still disagree. Zero-energy fights are where the
ranking is weakest. `--single` runs
w alone. A search stopped by `maxExpansions` (200,000) says so (`capped`,
and a warning). Beam widths 12 / 24 / 48 (single widths; 2026-10-25):

| example | before | after |
|---|---|---|
| si-laevatain (20 s) | 2,142,022 / 2,147,903 / 2,064,639 (16: 2,051,398; spread 4.5%) | 2,094,656 / 2,156,233 / 2,185,220 (4.1%) |
| laevatain-solo (30 s) | 1,165,844 / 1,194,306 / 1,196,307 (2.5%) | 1,165,844 / 1,165,844 / 1,196,307 (2.5%) |
| liino-laevatain (30 s) | 1,510,467 / 1,514,664 / 1,526,692 (1.1%, swap fix only) | 1,510,467 / 1,402,446 / 1,511,305 (7.2%) |
| si-laevatain-liino-gilberta (20 s, beams 6 / 12 / 24) | 3,016,009 / 1,557,958 (swap fix and key) | 3,554,349 / 3,701,403 / 3,173,136 (14.3%) |
| the same without swaps (the default since 2026-10-25) | | 2,434,451 / 2,650,070 / 2,691,389 (9.5%; 9 / 23 / 45 s) |

So the gap left is the ranking, not the key or the choices: what the
beam needs is a score closer to the final damage (a rollout, or a value
for what a state holds: ready skills, a running ultimate, a set-up
sequence). The probed resource value (*How the beam ranks*) is the cheap
part of that; what builds up outside the resources is still unseen, and
the guided widths make sure a wider beam at least keeps what a narrower
one found. Ratchets
(tests/slow/search-beams.test.ts): the best of w/2, w, 2w at 2w within 1%
of that at w; one width alone, 2w within 2% of w (duo and si-laevatain's
first 10 s at w = 4).

**A full team** (si-laevatain-liino-gilberta, 20 s): beams 6 / 12 / 24
took 36 / 85 / 172 s (1,306 / 3,050 / 5,283 states, heap under 400 MB),
about 26 ms a state against 4 ms for si-laevatain. The time goes to
landing hits (`landHit` 40% of a profile at beam 4: the situation and
trigger scans per hit, the damage path, which grow with four kits and
their gear) inside advance (56%), for judging the choices (`earliestStart`
37%) and committed damage (17%); the key is 3%. Nothing cheap was left on
the search's side. With `--swaps`, its rotations lean on two assumptions: an operator's
basic attack goes on after a swap (two chains run at once, swapping
between their steps: in-game test 15) and a swap mid-fall keeps the
landing (test 97); the default search makes neither. The example's
rotation is the no-swap search's since 2026-10-25 (2,691,389; with swaps
3,464,381).

**Random outcomes** (owner, 2026-10-20: "the result becomes not a number,
but rather a random distribution and needs to be interpreted and tracked as
such"). A scenario has them (`randomOutcomes`) with rolled crits, a dodge
chance strictly between 0 and 1 and enemy attacks to dodge, or a kit
trigger (own or worn) with a `chance`. Then each beam node carries the
states of K seeded battles (`seeds`, default 4; `efsim search --seeds k`):
seeds `seed`, `seed` + 1, … from the scenario's seed. The first battle
(the scenario's own seed) proposes the legal actions and their frames;
every battle applies the same step with that `at`, which in the others
starts at their own earliest legal frame from there (after a perfect dodge
one battle may be ahead of another) — exactly what `simulate` does when it
replays the rotation with that seed, so replay stays exact per seed. A
child whose step isn't legal in some battle (no combo window there, not
enough energy) is dropped. Requiring the same start frame in every battle
was the alternative; it drops nearly every child once dodges have shifted
the battles apart. A node's score is the mean of its K battles' values, or
a percentile (`percentile`, nearest rank; `--percentile 25`) to prefer
rotations that hold up when the dice go badly. Without random outcomes
K = 1 and the search is the deterministic one, bit for bit.

The result keeps the single battle with the scenario's seed (`result`,
for inspection) and adds the found rotation's distribution
(`rotationSpread` over `runs` battles, default 50: mean, standard
deviation, min, 5th / 50th / 95th percentiles, max). Unlike `simulateRuns`
(`efsim simulate --runs`, which rolls crits), it keeps the scenario's own
options, crit mode included, so an expected-crit fight with dodges varies
by its dodges only. A battle in which the rotation can't be played (an
action's random outcome went otherwise) is counted as `illegal` and left
out of the figures. `efsim simulate` without `--runs` notes when the
scenario has random outcomes: its total is one battle of a distribution.
With expected crits it prints the total's distribution instead
([Damage distributions](damage.md#damage-distributions)), whose seeded battles
(crit `distribution`, `--battles k`) are the ones this paragraph's search
would rank by. The search itself is unchanged by that (2026-11-13): it
still ranks crit-triggered teams over rolled battles (`searchCritMode`)
and its `--percentile` is the seeds' nearest rank, not the distribution's
Cornish–Fisher estimate; the planned follow-up replaces the K battles by
one deterministic battle with crit-triggered buffs at their expected state.

**Speed** (profiled 2026-10-20). 75–85% of the search's time went to
judging candidate actions (`earliestStart`), and nearly all of that to
actions that couldn't be chosen anyway: errors and starts later than the
soonest. `earliestStart` replays the fight to find when the operator's
current action ends (a kit's `endAction`, jumps, dodges), a combo replays
to every pending hit looking for its window, and each replay starts from
the node's state again. Now, all exact (same rotations and totals):

- `memoised` (timeline/advance.ts): on the contexts the search makes, `advance`
  is memoised per state object and frame (the cache is the context's own
  `advanceMemo`, not module state). `advance` is a pure function and
  states are never changed in place, so a repeated call returns the first
  one's result; judging an operator's skills from one state shares the
  replays.
- `legalActions` judges the controlled operator's basic attacks and the
  asides first. When a basic attack can start at the state's own frame
  (most decision points), nothing starts sooner, so the other actions are
  choices only if they can start right then: `startsNow` (timeline/drivers.ts) judges that without
  how much later they could (`startFrom`'s frame is the state's own, and a
  combo that needs a window has one open).
- Of the others, `startsNow` is asked first; only when no action but an
  aside can start at the state's frame are they judged in full (more often
  since the swap fix: si-laevatain at beam 24 went from 2.3 to 3.9 ms a
  state).
- Follow-up skills (`followUpOnly`) aren't judged (never legal from a
  rotation); committed damage is cached per state (its advance to the end
  isn't kept by the memo).

Searches at beam 24, wall time without loading the data, before and after
run alternately on the same (shared, so noisy) machine, best of the runs;
found rotations and totals unchanged:

| example | before | after | total |
|---|---|---|---|
| laevatain-solo (30 s, one operator) | 5.7 s | 2.9 s | 1,182,147 |
| si-laevatain (20 s) | 10.9 s | 5.4 s | 1,916,642 |
| liino-laevatain (30 s) | 55.1 s | 21.4 s | 1,510,009 |
| typhoeus-gilberta (60 s) | 289.5 s | 38.3 s | 3,366,828 |

With random outcomes a search costs about K times as much per child
(each battle is applied and scored; only the first judges the choices):
si-laevatain with `--dodge 0.7 --attack-every 4` and K = 4 took 23 s.

**Opener and loop** (`searchLoop`, `efsim search --loop [--loops n] [--rounds n] [--sync]`;
owner, 2026-11-14: "complete rotations, not a fixed 60 s window", an
opener and then a loop that can be repeated for as long as the fight
lasts, its boundaries at the ultimates' casts). A **loop** is a round of
actions (from a cast of the boundary ultimate to its next) that plays
again *exactly* — the same actions at the same times from its start —
from where it ends, `repeats` (3) more times in a row; the rounds before
its first play are the **opener**. Everything replays with `simulate`
(one rotation, `at` absolute); `--out` saves the opener and n plays of
the loop (default 4; plays past those found are exact replays, checked).
Fights with random outcomes are refused (an exact replay in one battle
needn't hold in another).

*Boundary* (`slowestUltimate`, `ultimatePeriods`): the ultimate with the
longest recharge in the opener search's rotation (over the scenario's
fight, at least 60 s): cast twice or more, the mean time between casts;
cast once, the time from its cast to the horizon over the share of its
energy back by then. Fewest casts was the rule before: with full energy
every ultimate is cast at 0 and that picked one never cast again within
60 s (Akekuri's), or the fastest when only it was cast twice (Estella's).

*Closing rounds.* Round after round from where the last ended (its
boundary cast), the beam search (`SearchHooks.prefix`) runs over
`LOOP_MAX_FRAMES` (90 s) and 10 s more and returns every rotation that
reaches the boundary's next cast (`SearchHooks.stopAt`: such a child ends
there, isn't expanded, and comes back in `SearchResult.stops`). Plans are
compared by **`closingScore`**: damage landed per second, where what the
round takes from the resources it found is charged as the time their
regeneration needs to make it up — SP at 8 a second, each operator's
ultimate energy at its bar over its recharge (`energyRates`), the longest
of them, since they come back side by side — and × 0.85 if it leaves the
kit stacks different (Laevatain's Melting Flame decides whether her battle
skill is the empowered one). A surplus isn't credited: in a loop played
on, it caps and is lost. The round is one of:

1. *A new plan*: of the stops within 5% of the best score
   (`closingMargin`), the one with the best mean over **two plays** —
   itself, then itself again from where it ends (moved later as in 3) —
   trying one plan per set of skills at their frames, at most 8; none
   whose second play can be played: the best. A plan tuned to where it
   starts rarely survives its own end (laevatain-solo's best first rounds
   drain the SP the opener left: 101 → 60 → 17 → 6).
2. *The last round replayed exactly*: kept unless a new plan scores 2%
   better (`hysteresis`). Three replays in a row make the loop.
3. *The last round moved later* (`shifts`), when it can't be replayed
   exactly: an action that can't start at its frame starts as soon as it
   can — waiting up to 20 s for energy, SP or a combo window — and
   everything after it that much later; a basic attack whose chain step
   isn't there becomes the step that is; a finisher on an enemy not
   Staggered and a combo whose window doesn't open are dropped. A plan of
   its own, which may then replay exactly: what's late is mostly what's
   short, and casting it when it's ready resets it.

Tolerance (3%, `tolerance`): the plays' damage per second, reported
(`damageApart`, `agrees`), not a condition. The actions are the same in
every play, but the enemy's Stagger cycle needn't follow the loop's, so
the Staggered bonus falls in a different play each time; the loop's DPS
is over all its plays (5–8 in the measurements).

Measured (2026-11-14): laevatain-solo (full energy), beams 4 /
6 / 8: loops of 35.4 / 31.2 / 34.4 s at 36,214 / 37,215 / 36,939 DPS over
their plays (14.1% apart at beam 6: Stagger), after openers of 478.7 /
195.5 / 225.5 s (12 rounds or fewer; 30–50 s a run); opener and 8 plays at
beam 6: 15,733,256 in 445.4 s, 35,324 DPS, which `simulate` replays. For
comparison at beam 6: the fixed 60 s search 43,453 DPS and the 300 s one
36,764 (both with the start's full energy and 200 SP, which a loop can't
count on): the loop is at the long fight's sustained rate. The rounds are
chaotic: small changes move the fixed point (before the chain-step and
combo repairs in 3, beams 4–8 gave loops of 28,260–32,544 DPS or none; at
beam 6 one run found a 50.0 s loop at 32,544 that repeats to the damage,
0.0% apart, its Stagger in step).

The owner's team, beam 6, 12 rounds (52–55 min a run, 2.5–5 min a
round): **no loop**. From zero energy (boundary Estella's ultimate)
rounds of 41–86 s, opener and rounds 33,754,626 in 803.7 s, 42,001 DPS
(the fixed 300 s search: 41,024); with full energy (boundary Akekuri's,
back after 60–80 s) rounds of 63–86 s, 39,759,477 in 925.5 s, 42,962 DPS
(the fixed 300 s search: 44,503). No new plan within 5% of a round's best
played twice, and no round's plan replayed: on the second play an
ultimate lacks energy past the 20 s wait (Si's 80 with 22–56, Arcane's
100 with 0–95, Akekuri's 108 with 73) or Arcane's sequence 2 finds her
array (Gloompurge Arcana) gone. Why: the four ultimates don't recharge in
step — Estella's in about 40–45 s, Si's and Arcane's 45–50 s, Akekuri's
60–80 s — so a round of one boundary ultimate holds a non-whole number of
the others', and a plan that casts each once wastes energy while one that
casts one twice can't do it again; Arcane's ultimate is two casts tied by
her array, whose energy block shifts with it. A loop here likely needs
more than one round of the boundary (two of Akekuri's ≈ three of
Estella's), or a boundary where every ultimate is ready: the
synchronized burst rounds below close for both scenarios.

*Synchronized burst rounds* (`sync`, `efsim search --loop --sync`;
2026-11-14). The boundary is the moment **every** operator's ultimate is
ready, as players hold the fast ones for a burst window. An operator's
*lead* ultimates (`leadUltimates`) are those castable from a rotation,
costing energy, and available at the fight's start before any buff
(Arcane's Gloompurger Array; not her sequence 2, castable only during
Gloompurge Arcana). One is *ready* (`ultimatesUnready`) when it's off
cooldown, its energy is full and it's available (Arcane: neither the
array nor Gloompurge Arcana up), whether or not the operator is free to
act. A round starts after the step at such a moment and ends at the first
step after which every ultimate is ready again, each lead ultimate cast
in between (`SearchHooks.stopAt` gets the state after the step and the
rotation); the round's last action is that step, and the next round
starts after it. The opener runs from the fight's start to the first such
moment: none when every bar starts full; from zero energy the build-up,
the stop of the opener search with the most damage landed a second. The
closing machinery is the boundary mode's (exact replay, moved-later
replay, closingScore, two plays); energy is full at both ends of a round,
so closingScore charges only the SP a round takes. Rounds are looked for
up to `LOOP_SYNC_MAX_FRAMES` (120 s): every bar must refill after one
cast each, and the team's energy comes mostly from the SP it spends (from
zero energy, Si's 80 took 98 s).

*Each lead ultimate once a round, none in the opener*
(`SearchHooks.allow`: refused actions aren't choices and don't count for
what's soonest). Without it the beam, ranked by damage, casts each
ultimate the moment it's ready, and its lines rarely meet a moment every
one is: si-laevatain and the owner's team found no round end at all. With
it a fast ultimate is held at a full bar until the round ends; what that
costs is measured: `TimelineState.energyOverflow` counts energy granted
past a full bar (a statistic, not in the state key), and each repetition
reports it (`energyLost`), split into **held** (lost while the operator's
lead ultimate was ready, stepped action by action) and the rest (a grant
that crosses the cap; Arcane's sequence 2 grant on a bar not yet empty).

Measured, the owner's team (2026-11-14; rotations in
[docs/teams/rotations/](../teams/rotations/), each replayed by `simulate` to
the same total):

| | zero energy, beam 6 | zero energy, beam 8 | full energy, beam 6 |
|---|---|---|---|
| loop | **closes**, rounds 3–8 | **closes**, rounds 11–16 | **closes**, rounds 14–19 |
| loop length | 81.1 s | 84.3 s | 84.9 s |
| loop DPS over its 6 plays (apart) | 40,677 (1.3%) | 41,862 (0.0%) | 41,056 (0.3%) |
| opener (build-up, then rounds) | 255.7 s, 9,319,391 (78.7 s, 2,601,325) | 941.9 s, 37,062,742 (82.6 s) | 1,095.2 s, 42,612,457 (none) |
| opener and 6 plays | 29,120,948 in 742.5 s, 39,218 DPS | 58,244,871 in 1,447.9 s, 40,226 | 63,526,451 in 1,604.6 s, 39,590 |
| held at a full bar, a play | Estella 34 of 63, Arcane 30 of 100 | Estella 60, Arcane 112, Si 15 | Estella 63, Arcane 63, Akekuri 22 |
| run | 8 rounds, 44 min | 16 rounds, 5.1 h (3 jobs at once) | 19 rounds, 2.3 h |

For comparison, the boundary mode (no loop in 12 rounds): 42,001 DPS over
803.7 s from zero energy, 42,962 over 925.5 s with full energy; the fixed
300 s search 41,024 and 44,503 (with the start's energy and 200 SP, which
a loop's plays don't get). A fixed-length search of the same total length
(742.5 s from zero energy) wasn't measured: at beam 6 it ran out of the
default 2.2 GB heap, and with 9 GB hadn't finished after 65 min (stopped).
The loops run at 40.7–41.9k DPS, a little below the boundary mode's
rounds, which spend energy as it comes and don't repeat.

Every loop's length is set by the slowest bar (Si's 80, or Akekuri's
108): about 81–85 s. Estella's ultimate (back in about 40–45 s otherwise)
waits half to a whole bar at full, Arcane's a third to one; Arcane also
loses 150–170 a round to her sequence's grant, which holding doesn't
cause. Their direct hits are worth about 107–152k (Estella) and 138–182k
(Arcane's two parts) a cast, so what's held is worth at most about 3%
(zero energy, beam 6), 8% (full energy) and 10% (beam 8) of the loop's
damage — a ceiling for a two-round loop (the fast ultimates cast more
often between the slow ones' casts), which isn't built. The first rounds
change plans often (chaotic, as the boundary mode's: a new plan's score
swings with where the enemy's Stagger falls; one round's exact replay
fails by 1–3 frames, and its moved-later version loses to a new plan
that scores 2% better), so the opener is long when the loop is found
late (941.9 and 1,095.2 s).

`--sync` is not the default: it's the mode that closes for the owner's
team, but other teams' bars don't all refill in 120 s after one cast each
(si-laevatain: Laevatain's 255 at 102 after 100 s; xaihi-si: not every
bar full within 90 s from the start; akekuri-laevatain: no round within
90 s, before the limit was 120 s), and Laevatain alone loops lower than in
the boundary mode (53.3 s at 31,247 DPS against 31.2 s at 37,578, beam 6:
her combo's energy, granted at a full bar just before her ultimate, is
lost); perlica-estella (beam 4) found no loop in 12 rounds.

Rounds take 4–6 min each at beam 6 alone (12 min late in a run with three
jobs at once). Memory: every state carried every hit landed since the
fight's start, copied per node, so late rounds ran out of the default heap
(beam 8 at about 700 s, beam 6 at about 1,300 s, killed); a round's search
now leaves the prefix's landed hits out of its states
(`SearchHooks.hitsFrom`; their sum starts each node's damage, so the
search finds the same to the bit). The fixed-length search has no such
cut.

Tried and dropped (2026-11-14): cutting the fixed-length search's rotation
at two casts of an ultimate and replaying the segment — at its exact
frames (every cut failed: a chain step not reached, a combo window not
open, a finisher on an enemy not Staggered, the ultimate 25 frames late),
as a player would (the skills in order as soon as legal: the repetitions
drifted, 1188 → 1277 → 1500 frames), or with closing conditions as a
filter (the same energy, SP, stacks, cooldowns and chain step at the end:
no state of a beam of 12 met them; SP within 3 and the same stacks: none
of 420 stops of laevatain-solo's first round). Each repetition searched
afresh until three agree (the first `--loop`): they never did
(laevatain-solo, 6 repetitions of 29.9–47.5 s; the owner's team, 42–59
s). Exact replays of each round's best plan alone: laevatain-solo's
high-DPS plans all failed on their second play (the battle skill late for
SP, the combo's window not open, the ultimate's enhanced attacks out of
Twilight); only rounds that hold the ultimate past 49 s replayed (33,380
DPS, exactly periodic). A round's skills as a skeleton, the search
choosing the basic attacks in between: the next round couldn't complete
it (the SP for six battle skills wasn't there). Ultimate energy charged
at its probed price instead of as recharge time: the owner's team's
rounds kept casting ultimates on energy the opener left (Si's at 0 of a
round, short 72 of 80 on the second play).

## Payoffs and chains

`efsim payoffs <scenario>` (engine `payoffs`, payoffs.ts; owner, 2026-11-15:
plan from the payoffs, the buffs and debuffs that maximise each action and
the rotations that set them up; good teams' combos overlap). The forward
beam keeps the best N states per step, so setups that pay off 10–20 s later
look worse meanwhile and fall out (Ink Melt: beams 12/24/48 gave 3.50 /
3.50 / 4.41M). The payoff table is phase 1 of planning backward from the
payoffs; phase 2 prunes the forward search with it (below, *Pruning the
search*); phase 3 feeds the backward-built setups into the search (journal,
roadmap). Every number is the engine's: **probes** on the stepping API
(runStep, observe), never kit semantics re-derived by hand, so a kit change
moves the table with it. A planning aid, never part of a fight's result.

*Steps* (`planSteps`): each operator's battle skills, combos and ultimates
(not follow-ups), and the controlled operator's basic chain from the attack
input (its first available chain head, or what a buff maps the input to:
Laevatain's enhanced attacks in Twilight) to its Final Strike, taken as one
step. They're measured in a planning fight (`planContext`): the scenario's
team and enemy, every ultimate charged, no enemy actions.

*Probes* (`probeStep`, `observe`): a step cast at its earliest from a
state, against the same fight without it, watched for 20 s. Buffs, combo
windows, enemy statuses and pieces are sampled every 8 frames and compared
by **counts** (instances of each buff, openings of each window, enemy
events by what happened), not by frames: an ultimate's time stop moves
everything else in its fight later, so the same buff from something else
sits at another frame with it than without it (comparing by frames made
every ultimate "open" every window). What a probe records: damage (all
hits, its operator's own, reactions), its cast's first and last hit, the
buffs it created (owner, target, offset, duration, layers, stack group,
modifiers), enemy events (inflictions, reactions, consumptions, Shatter,
physical and control statuses), the windows it opened (whose, when), SP
and energy against the fight without it, its cost and busy frames, and
the **pieces** it achieves (below).

*Situations*: none; Staggered; each element the team inflicts at one
stack; Link when the team makes it; the step's operator's kit stacks at
their maximum (Laevatain's Melting Flame: plain data, so a trigger on
reaching it doesn't fire). A step that can't be cast from the start gets a
**prefix**: an opener whose probe opened its window, two steps from the
start (a reaction: an infliction, then another element), one or two of its
operator's own steps (Si's strokes after her battle skill), each allowed
to wait 20 s for availability; failing those, a combo is probed in a window
forced open (Akekuri's, opened by a Stagger) and a gated skill with the
buffs its `available` condition reads put on through the engine (`addBuff`:
Arcane's Gloompurge Arcana, which needs two Final Strikes inside her
array). Both are marked in the table and listed as unreachable.

*Pieces and ceilings.* A piece is what the team can have on when a payoff
lands: a buff instance as the engine created it (with modifiers, Link, an
input mapping, or a buff some skill's `available` reads: Twilight), a
reaction status (Corrosion, Solidification, Combustion…), a physical
status (Breach), Vulnerable stacks, Link stacks. Each damaging step's
**ceiling** is its `dealt` damage (its own kit hits plus the reaction hits
it adds) under every piece the team achieves (`withPieces`: re-timed to the
cast; statuses old enough to be at full strength, Corrosion's shred ramps),
in the best of the exclusive situations (no infliction, each element at 1
and 4 stacks, each with and without Stagger, each with and without its own
stacks full), with and without the gating buffs (Twilight shuts
Laevatain's plain battle skill). Conflicts the engine knows are left to it:
one infliction at a time (the situations), a stack group's strongest
acting (buffs.ts reads the instances), element, skill-type and Staggered
filters, build-fixed modes (Arcane's INT / WILL, Laevatain in slot 1:
the build). Pieces that lower the ceiling are left out one at a time
(`against`: a status the cast consumes, Twilight); each kept piece's
**worth** is what the ceiling loses without it. Each piece lists its
**achievers** (step, situation, cost) with the **lead**: how long before
the payoff's start the achiever may start for the piece to be on for all
its hits ([offset − first hit, offset + duration − last hit]).

*Window payoffs*: reaction statuses (their damage in the probe that formed
them, and who forms them) and recording buffs (Si's Artful Intent: rate and
window; the burst lands as the recording step's own hits, so the setup
efficiency marks it).

*Chains* (`findChains`): depth-first from the fight's start, each step cast
at its earliest in the engine after the ones before, kept when it's
**tied** to them: a combo cast within a window an earlier step of the
chain opened (`opens`), or a step that after them opens a window or causes
a reaction, consumption, Shatter, physical or control status (its own
operator's: a time stop reorders others' events) that it doesn't from the
fight's start (`sets up`, starting within 3 s). Each step once a chain;
chains of the same steps starting at the same frames are one (the order of
simultaneous casts). Every chain of two steps or more is kept (the owner:
rank is for display only, `--top` limits printing, never the data). For
each: damage (within 20 s of its last start, against the fight without it),
span (first start to the last moment one of its operators is busy with it),
SP and energy cost, damage per second of span and per SP. For the best ten
per second (`measure`): each step's **slack** (how much later it may start,
half seconds up to 6 s, with every later step still tied and the damage
within 1%), and a **merge**: setups cast before it (each other step, kept
when chain and setup deal more together than apart: synergy; greedy, up to
three) and **fillers** fitted into its idle time (each other step after
each chain step, kept when no chain step moves and the damage rises: an
idle operator, spare SP, a gap in a cooldown; up to three). Low-value steps
stay in the data: they matter when they fill resources that would go
unused (the owner, 2026-11-15).

*Setup efficiency* (`setupEfficiency`): a rotation's casts, each one's own
kit hits (its skill's hits until the operator's next cast of it) against
its ceiling's `bestCast`, and which chains it plays (each step at or after
the one before and within a combo window and 2 s of it, simultaneous casts
in any order).

What's exact and what isn't: probes, ties, chains' damage, slack and
merges are the engine's own numbers for the planning fight (full energy,
the fight's start, no enemy actions, teammates attacking on their own as
the scenario says). Ceilings are heuristic upper bounds: the best of the
situations and pieces probes found, not a proof. Known shortfalls, flagged
by efficiencies above 100%: payoffs that grow with what comes after them
(Si's burst records the team's damage in its window; Arcane's INT combo
explosion is set off by her battle skill), states no probe reaches (a
stackAtLeast buff, Link above what probes saw, reaction levels above what
one-stack situations give), and buffs whose value was fixed at another
applier's levels. JSON (`--json`): the whole report (steps, situations,
every probe, ceilings with bundles and achievers, chains with slack and
merges, the efficiency) for phase 3.

Measured (2026-11-15; full energy): the owner's team (examples/
estella-si-akekuri-arcane: 1,489 probes, 3.1 min; its WILL variant 1,799)
and Ink Melt (1,020 probes, 42 s); laevatain-solo 82 probes, 0.4 s. The
owner's chain — Akekuri's battle skill (Heat) → Arcane's combo (opens;
adds Heat) → Estella's battle skill (Cryo: Solidification of 2, sets up
both combo windows) → Estella's and Si's combos (opens) — is found,
315,557 in 2.5 s (124,562 a second; 3rd of 123 chains), merged with Si's,
Akekuri's and Arcane's ultimates as setups and Si's battle skill and
Estella's ultimate as fillers to 878,706. Best per second: the same with
Si's battle skill (Cryo) in Estella's place, 341,717 in 2.3 s (146,450 a
second). **But only with Arcane in WILL mode**: the example's builds (full
artifice assumed) put her INT just above WILL (484.4 against 473.5 at the
fight's start; the owner's in-game copy of a log's loadout was 472 / 473,
WILL), and in INT mode her combo adds no infliction and opens only on a
Nature reaction or two stacks, so the chain doesn't exist there
(tests/slow/payoffs-chains.test.ts checks a WILL variant, her accessories'
WILL version). The example's rotation (INT) reaches 40–77% of its big
casts' ceilings and plays none of the five-step chains (Arcane's battle
skill → combo 4 times). Settled the same day: the owner tunes her to the
most Intellect just below Will (472.44 / 473.50 with these pieces, WILL);
the examples and the test now use that build, and re-searched they gain
16.7% and 7.3% (3,835,505 and 3,226,208; the team page). Ink Melt's rotation: Laevatain's Twilight battle
skill 75%, Si's combos 96 / 88 / 63%, Laevatain's battle skills 59–77%;
one chain played twice (Si's battle skill → Wulfgard's combo); its best
chain (Si's battle skill → Laevatain's chain → Wulfgard's combo → Si's
combo, 236,234 in 4.4 s) merges with Laevatain's, Si's and Wulfgard's
ultimates as setups and Wulfgard's battle skill and Ardelia's ultimate as
fillers to 719,456.

*Phase 3: backward-built setups in the search* (2026-11-15). What phases 1
and 2 showed: the payoffs that matter come in short chains (2–5 s) tied by
combo windows and reactions, and their worth is mostly in what's around
them (the owner's chain alone 315,557; with three ultimates as setups and
two fillers 878,706); the forward beam drops these because a chain's first
steps deal little (Akekuri's battle skill 9,133). The bound is far too
loose to prune (below) and dominance fires a few times a search, so the
gain has to come from *what the beam can see*. Three parts and the share
of the beam they live in, each an option of the search (`efsim search`:
macros on by default, `--no-macros`; `--skeletons`; `--setup score|share`):

1. **Chains as macro actions** (macros.ts; `SearchOptions.macros`). The
   payoff table's chains (all of them: rank is for display) as a prefix
   tree of their steps (`macroTree`). At a node where a chain's first step
   is among the choices, `playMacros` plays the tree from the node's own
   state (so the probes run from arbitrary search states, not the planning
   fight's start): the first step at its choice's frame, each later one at
   its earliest (`runStep`; a combo tied by `opens` waits up to its 6 s
   window, which must have opened since the macro's first step, another
   step 3 s), and offers a child at every node where a found chain ends
   (two steps or more). Between steps of teammates the controlled operator
   basic-attacks while that doesn't move the next step's start (judged once
   for all of them: without it the controlled operator idled through every
   macro, and Ink Melt over 40 s fell from 3,120,118 to 2,399,719 at beam
   6). The child is the state after the last step, in that step's bucket:
   the beam ranks the state after the payoff. Its rotation is the plain
   actions, each with the frame it starts, which `simulate` replays
   (tests/planning.test.ts). Not in a loop's rounds (their `stopAt` needs
   every step). The macro hands back a copy of its last state: what the
   tree's deeper steps advanced it to is memoised on the state object, and
   a node holding it kept all of that alive (Ink Melt ran out of a 4.5 GB
   heap).
2. **The beam's extra share** (`prunePools`; `SearchOptions.extraBeam`,
   default half the width). Offered in the main beam, macro children
   crowded out the lines that set up later payoffs (Ink Melt over 40 s,
   beam 6: 2,399,719 against 3,120,118 before the fill). So a node whose
   rotation played a macro (or a skeleton's own action, or with
   `setupShare` any node the main share dropped) is kept in a share of its
   own, up to `extraBeam` more a layer; the main share is exactly the
   search without them (its nodes, its pruning, only the narrower width's
   guide keeping a place). With the same guide the search therefore finds
   at least as much at the same width; across `searchBeams`' widths the
   guide itself changes (the wider width is guided by what the narrower
   one found with the share), so that isn't guaranteed there (skeletons on
   Ink Melt, below). The share's children waiting in a later bucket are
   cut to the best 4 × its width once they're twice that (a macro lands up
   to seconds ahead; the main share's are never cut early).
3. **Skeletons as guides** (skeleton.ts; `searchBeams` `skeletons`,
   `SearchHooks.guides`, `incumbent`). Items: every chain and each
   measured chain merged with its setups (before) and fillers (after the
   chain step each follows). A skeleton is a greedy rollout from the
   fight's start: at each decision every choice the search would have and
   every item whose first step is one of them (played as a macro) is valued
   by what it adds to the state's worth (committed damage plus the
   resources at their probed prices × the value weight, so what a cast
   spends is charged at the resources' price) per second it takes (to its
   last step's start, plus half a second), and the best is played; the
   i-th skeleton takes the i-th best option at the start (3 by default).
   Played in the engine as it's built, each step as soon as it's legal
   (waiting for its window, SP or energy), a skeleton is already repaired:
   the loop's moved-later replay isn't needed. The guide becomes a list:
   each guide keeps a place in the beam (the last places, in the guides'
   order; one guide is exactly the old rule); where a skeleton's next
   action isn't among a node's choices it's added to them (a skeleton waits
   where the search's choices wouldn't); nodes that left the main share's
   guide to follow a skeleton are in the extra share. The best skeleton's
   damage is the bound's incumbent. The skeletons themselves are weak
   (greedy: 60–80% of the search's results); what they add is the extra
   share's lines along them.
4. **A setup-aware value** (setupvalue.ts; `SearchOptions.setup`,
   `setupWeight`, `setupShare`). From the ceilings: each damaging step's
   bundle pieces and their worth (what the ceiling loses without each). A
   state's score adds, for each piece it holds (a buff instance active, a
   reaction or physical status, Vulnerable or Link stacks; a lower level or
   fewer stacks in proportion), its worth to the best payoff that can still
   be cast before the piece ends (cooldown, SP with regeneration, energy,
   and its availability now), plus a combo's bare damage while its window
   is open and it's off cooldown; × the value weight, tapering over the
   last 10 s as the resources do. A piece counts once (the best payoff),
   and a buff of the payoff's own operator doesn't count (its own sequence,
   which the resource value prices through its casts in progress:
   Laevatain's Twilight for her enhanced attacks): summed over every ready
   payoff, the first version reached 357k at 2 s of Ink Melt's example
   rotation (the resources' 81k) and sent the beam into early ultimates.
   `setupShare`: the value ranks only the extra share.

Measured (2026-11-15; 60 s, guided beams 12 / 24 / 48 as `efsim search`
runs them; each cell the three widths' totals, then the run's seconds:
table (payoff probes, and skeletons) + the three widths; four such jobs at
a time on the 4-core machine, which other sessions shared, so times are
comparable within a row only roughly):

| example | without (as before) | macros (the default) | skeletons | setup value in the score |
|---|---|---|---|---|
| owner's team, full energy | 3.33M / 3.33M / 3,835,505; 1,722 s | **3,918,666 / 3,918,666 / 3,922,576**; 267 + 417 / 774 / 1,442 s | 3,527,197 / 3,616,937 / 3,725,740; 330 + 371 / 717 / 1,334 s | 3,215,303 / 3,242,469 / 3,309,886; 235 + 197 / 462 / 789 s |
| owner's team, zero energy | 2.50M / 2.53M / 3,226,208; 1,596 s | **2,502,659 / 2,581,516 / 3,394,218**; 281 + 350 / 662 / 1,081 s | 2,502,659 / 2,758,499 / 3,397,119; 272 + 277 / 506 / 836 s | 1,829,952 / 2,137,125 / 2,137,953; 223 + 180 / 361 / 589 s |
| Ink Melt, full energy | 3,496,392 / 3,504,192 / 4,411,886; 137 / 274 / 590 s | **4,479,156 / 4,620,703 / 4,689,365**; 11 + 522 / 998 / 2,313 s | 3,496,392 / 3,610,514 / 3,661,634; 32 + 208 / 472 / 908 s | 3,644,528 / 4,013,440 / 4,013,440; 13 + 147 / 349 / 605 s |
| Ink Melt, zero energy | 1,796,863 / 2,993,557 / 3,841,514; 100 / 262 / 529 s | **1,820,477 / 4,320,354 / 4,601,305**; 23 + 630 / 1,014 / 1,670 s | 2,540,005 / 3,729,608 / 3,909,985; 31 + 165 / 309 / 885 s | 3,001,627 / 3,001,627 / 3,160,093; 18 + 128 / 272 / 571 s |

The owner's team is Arcane in WILL mode (her accessories' Intellect
artifice at 0: Intellect 472.44, Will 473.50, the owner's build); its
"without" column is the plain `efsim search --beam 24` that searched its
example rotations (commit 30850ad, another job mix; the narrower widths'
totals as rounded there). Before the build
was corrected the same parts were measured on the INT build (full
artifice) and on a WILL variant (the accessories' WILL version), with the
same pattern: macros better at every width (INT full energy 3,286,029 →
3,430,236, from zero 2,973,678 → 3,010,131; the WILL variant 3,356,828 →
3,504,173), the setup value better on the WILL variant (3,697,570) and
worse from zero (2,903,988), skeletons best on the WILL variant
(3,755,026, playing the owner's chain with Si's battle skill twice).

**The owner's team order (2026-11-15, after the table).** The table's
owner's-team rows had Estella in slot 1, so Si's battle skill inflicted
Cryo; the owner's order puts Akekuri in slot 1 (Heat). Re-measured with
that order (same build, same widths, four jobs at a time): plain 3,135,336
/ 3,344,984 / 3,360,158 full energy and 2,313,225 / 2,319,339 / 2,604,968
from zero; macros 3,444,884 / 3,444,884 / 3,486,730 and 2,949,334 /
2,962,844 / 2,982,948; skeletons (without macros) **3,353,446 / 3,990,122
/ 3,990,122** and **2,416,632 / 2,692,055 / 3,263,818**, the examples'
rotations now. Macros still beat the plain search at every width, but
settle early (spreads 1.2% / 1.1%); skeletons win both energies here.

**Decisions.** Macros found more at every width on every example. At
equal run time they win with full energy (their w/2 alone, table
included, beats the search without them at 2w: 3.92M in 684 s against
3.84M in 1,722 s; 4.48M in 533 s against 4.41M in 1,001 s) but lose from
zero energy, where the search without them reaches its best only at 2w
and macros have by then finished w/2 and w (the owner's team 2.58M
against 3.23M; Ink Melt 1.82M against 3.84M). They are `efsim search`'s default
(`--no-macros` for the search before; the engine's `SearchOptions.macros`
stays opt-in, so the pinned tests and loops are unchanged). The cost is
1.6–3.8× the time a width (the extra half-beam of nodes, and the macros
played at each node: on Ink Melt 145 ms a state against 57). Skeletons
and the setup value stay opt-in: each made examples worse (skeletons both
full-energy fights, Ink Melt 3.66M against 4.41M and the owner's team
3.73M against 3.84M: the wider widths' guide changes with the share,
above; from zero they found the owner's team's best, 3,397,119; the setup value in the score Ink Melt both energies and the
owner's team both energies, from zero by a third: it still overvalues
holding a piece over casting). Macros and skeletons together did worse than macros alone on the
owner's team (3,675,264 / 3,766,856 / 3,771,274 with full energy,
2,502,659 / 2,525,620 / 3,228,589 from zero: one extra share split
between them). The setup value's share variant (`setupShare`) is
implemented and tested but wasn't measured at 60 s.

## Pruning the search

Two prunings on the beam search (`SearchOptions.dominance`, `.bound`;
`efsim search --prune` turns both on; off by default).

**Dominance** (`dominatesState`, stateKeyer `amounts`): of two states of a
layer with the same key but for SP, returned SP and ultimate energy, drop
one if the other has at least as much committed damage, SP and every
operator's energy and no more returned SP. Exact for the fight: nothing
reads SP or energy but the gates (enough SP, enough energy) and the energy
a spend gives (natural SP: cost less returned SP); every gain is a capped
sum (min(cap, x + g) keeps the order), SP events carry the nominal amount,
`clearEnergy` sets both to 0; so every rotation legal from the dominated
state is legal from the other at the same frames and deals the same from
there (tests/payoffs.test.ts plays a found rotation from a state with 100
SP more, at the poorer state's frames). Caveats: the search offers only
the soonest actions, so the richer state's choices can differ from the
poorer's (an SP-gated skill becomes the soonest); a state on the guide's
line is never dropped (the wider beam's guarantee); one battle only (no
random outcomes). It fires rarely: paths that differ in SP nearly always
differ in what's scheduled, cast or held too (none in laevatain-solo at
beam 24 or si-laevatain at 12; 0–5 states a beam below).

**Branch and bound** (`upperBound`, `remainingBound`, bound.ts): drop a
child whose committed damage plus a bound on what it can still add is
below the most committed damage found so far (a rotation that stops acting
deals exactly its committed damage, so that's reachable). The bound is an
LP relaxation: every step at most its ceiling per cast (the largest of
`dealt` and every hit's difference, bare or under the bundle), and only
casts that start before the fight's end less the step's first effect;
battle skills and chains hold their operator for their busy frames
(operators in parallel, a fractional knapsack each); combos and ultimates
count by cooldown only (they may cut into other actions); team SP is what
the state has plus 8 a second, each cast using its cost less the most SP
its probes gave back; a Lagrangian over SP (min over λ of λ × SP plus the
knapsacks at value − λ × net SP; any λ ≥ 0 bounds the relaxation); × (1 +
the highest recording rate, Si's Artful Intent). Admissible only as far as
the ceilings are (above): states on the guide's line are never cut, and
those under the bound while the guide's own damage would beat the best so
far are counted (`boundMisses`: none measured). Ultimate energy isn't
bounded, only cooldowns. Tests: committed + bound ≥ what the rotation
reaches from there at every state of beam 48's and beam 6's rotations
(laevatain-solo, 15 s); the search finds the same or more with it at the
same width.

**The bound is too loose to prune.** Along Ink Melt's example rotation it
is 2.7–3.8× the damage actually still to come (10.2M at the start against
3.7M; 2.1M at 49.3 s against 0.76M), while the states a layer keeps are
within a few percent of each other: it cuts only children in the last
seconds, 0.0–0.4% of them. Tightening it would need bounds the probes
can't give admissibly (ultimate energy from SP and grants, how often a
battle skill's ceiling bundle can really be on), so it stays as it is.

Measured (2026-11-15, 60 s, guided beams 12 / 24 / 48 as `efsim search`
runs them, two jobs at a time on the 4-core machine; score, states
expanded and seconds per beam, before → with dominance and the bound; the
bound's table is the payoff probes without chains; measured before the
bound counted only casts that start in time to do something, which lowers
it by up to 5% early in the fight and most in its last seconds):

| example | beam 12 | beam 24 | beam 48 | dominated / bounded (12, 24, 48) |
|---|---|---|---|---|
| owner's team, full energy | 3,232,373: 2,871 / 161 s → 2,871 / 163 s | 3,273,371: 5,749 / 322 s → 5,729 / 311 s | 3,286,029: 11,709 / 715 s → 11,663 / 690 s | 0, 2, 2 / 0, 18, 45 (table 155 s) |
| owner's team, zero energy | 2,797,948: 2,581 / 122 s → 2,578 / 126 s | 2,808,913: 5,203 / 252 s → 5,173 / 249 s | 2,973,678: 10,925 / 564 s → 10,921 / 488 s | 6, 12, 2 / 1, 14, 4 (table 147 s) |
| Ink Melt, full energy | 3,496,392: 2,391 / 136 s → 2,391 / 147 s | 3,504,192: 5,057 / 298 s → 5,052 / 296 s | 4,411,886: 10,438 / 661 s → 10,427 / 636 s | 0, 0, 5 / 0, 5, 11 (table 14 s) |
| Ink Melt, zero energy | 1,796,863: 2,086 / 96 s → 2,074 / 105 s | 2,993,557: 5,442 / 231 s → 5,418 / 259 s | 3,841,514: 9,693 / 524 s → 9,549 / 523 s | 0, 0, 0 / 15, 25, 42 (table 16 s) |

The found rotations and totals are the same with and without pruning at
every beam; the states saved (≤ 0.5%) are within the machine's timing
noise, and the bound's table costs 14–16 s (Ink Melt) to 155 s (the
owner's team) on top. Dominance and the bound stay off by default; what
the beam needs is to see setups, not to cut more (phase 3, above).
