# Rule-based rotations

Part of the [design](../design.md): Rule lists played by a simulated player: the driver, the button model, the diagnosis, gear on rules, the guided search and the assumption switches.

`efsim rules <scenario.json> <rules.json>` (engine `playRules`, policy.ts;
the search `searchRules`, policysearch.ts; CLI rules.ts; 2026-11-16).
**Why** (the owner, who plays daily): a rotation is only useful if a
person can learn and play it. The search's fixed frame timelines are
hard: timers in your head are hard, and a loop that's a little different
each time is too complex to learn; guide sites' rotations often last over
a minute and must be restartable. The easiest rotation to learn: a couple
of skills that get things started, then reacting to combo skills lighting
up, either casting the combo at once or pre-empting it with an extra
battle skill first. So a rotation here is a **short opener plus a
priority list of rules "when cue X is visible, do Y"**, played by a
simulated player with a reaction delay and measured by sustained DPS over
a long fight. Rules adapt by themselves when gear changes timing (no
repair needed), which later makes gear comparison cheap.

**Cues, ranked by the owner (2026-11-16), easiest first:**

1. A combo skill lighting up (by far the easiest).
2. Typhoeus's Hunting Arrows and Signs (very easy); SP and how many
   battle skills are ready (easy).
3. Inflictions and vulnerabilities on the enemy (relatively easy, shown
   on the enemy).
4. An ultimate being ready (harder: it's in the corner of the screen).
5. Counting Final Strikes (takes practice, doable).
6. A combo skill's cooldown status (visible, but the owner isn't used to
   looking at it).
7. Anything needing a timer in your head (hardest; avoid, or count
   heavily against).

Rules may read only what the game's UI shows: the list above, plus a few
operator states without buff icons, each for a reason, ranked with 3:
Typhoeus hovering (she's in the air), Laevatain's Twilight (her ultimate's
form; the battle-skill button changes), Liino's Vocalist Stance and
Cosmovoice (the button becomes End Stance), Si's Artful Intent and Inksoul
(the button becomes Initial / Final Stroke); and the stacks the HUD shows,
Typhoeus's arrows and Signs. They are **kit data** (2026-11-16): a kit
buff with `visible: { on, off, why }` (the words after the operator's name
while it's on and off, and how the game shows it) or a kit stack with
`visible: { why }` (schemas/kit.schema.json), so a new operator's stance
needs no engine edit (`visibleBuffs`, `visibleStacks`, policy.ts). Any
other stack or buff in a rule is refused.

**The format** (schemas/rules.schema.json; examples/*.rules.json, one per
team next to its scenario):

```json
{
  "opener": [{ "operator": "Si", "cast": "battle" }],
  "rules": [
    { "when": { "combo": "Arcane" }, "do": [{ "operator": "Estella", "cast": "battle" }, { "operator": "Arcane", "cast": "combo" }] },
    { "when": { "all": [{ "sp": { "atLeast": 100 } }, { "not": { "status": "solidification" } }] }, "do": { "operator": "Si", "cast": "battle" } }
  ],
  "filler": "basic"
}
```

- *Presses* (`cast`): an operator's `battle`, `combo` or `ultimate`
  button, resolved to the skill the button casts then (Si's battle skill
  is Artful Intent, then Initial and Final Stroke; Arcane's ultimate is
  her array, then sequence 2; Liino's battle skill ends her stance while
  she's in it). **The button model** (engine timeline/buttons.ts,
  2026-11-16): a button's skills are its kind's kit skills that aren't
  follow-ups (the game's skill slot: CharGrowthTable's groups plus what a
  ChangeSkillAction switches the slot to); it shows those whose kit
  `available` holds then, and a combo on a window of its own (Rossi's
  sequence 2) only while that window is open (`buttonShows`). The kits make
  these exclusive: at every frame of the three example rule runs each
  button shows at most one skill (tests/policy.test.ts). Where they overlap
  (no example team: Camille's Hunter Pursuit has a condition, Heartstake
  Thorn none) `buttonSkill` takes the replacement (an own window, then a
  condition, then kit order). A press casts the skill its button shows, or
  nothing: not "the first startable skill of that kind" as before, which
  could land on a skill the button didn't show. `shows` is a check of that
  skill's label; the controlled operator's `dive`, `basic` (whatever the
  attack input is then) or `finisher`. Operators by ID or by the name the
  game shows. **No swaps** (as the search's default): the scenario's
  controlled operator does every basic attack, dive and finisher.
- *Cues* (`when`): `combo` (lit: off cooldown, its window open,
  available; rank 1), `stacks` and `sp` (2), `infliction`, `status`
  (reaction and physical statuses), `vulnerable`, `staggered`, `buff` (3),
  `ultimate` (4), `finalStrikes` (the controlled operator's since the rule
  last fired; 5), `comboCooldown` (6), `since` (seconds since an
  operator's last press of a button: a timer; 7), and `all` / `any` /
  `not`.
- *Rules* are ordered; `do` is one press or a short sequence (at most 3:
  "battle skill A, then combo B"). *Opener*: a few presses played first.
  *Filler*: what the controlled operator does when no rule fires, its
  basic attacks (default) or dives.

**The driver** (`playRules`): on the timeline (init / advance / apply, as
the search and `simulate` use: no fork of the damage model), at each
frame it visits, on the state after the last press advanced to the frame:

1. The opener's presses in order, each at the first frame it can start
   (no reaction delay: planned), basic attacks in between; a press that
   can't start within `waitSeconds` (6 s) is given up. No rule fires
   before the opener is over.
2. Then the first rule whose cue the player has seen for its **reaction
   delay** and whose first press can start now. The delay is drawn when a
   cue appears (onset): 0.3 s by default (`--reaction`; 0: a bot),
   uniform within ±50% (seeded; common random numbers, below). A rule that fired sees
   its own cue afresh (a new delay) before firing again. A rule whose
   cue holds but whose press can't start yet doesn't block the rules
   after it. A rule's later presses play as the opener's (each as soon
   as it can start, a combo waiting for its window, up to 6 s), and no
   other rule fires meanwhile.
3. Else the filler: the controlled operator's basic attack as soon as it
   can start (a finisher first when the enemy is Staggered, as the game's
   attack input does: no delay; not while the input is an enhanced basic
   attack, in-game test 108), or its dive.

A dive starts only once the current skill is past its exclusive frames,
as the search dives. Several presses may start at one frame.

**One "can this start now"** (2026-11-16): `canStartAt(ctx, state, action,
frame)` (timeline/drivers.ts) is startsNow on the state advanced to the
frame, and the driver asks only that. Every press is applied to the state
after the last press with the frame as `at`, as `simulate` replays the
recorded rotation, and **earliestStart judges an `at` on the state then**
(advanced to it), so the replay starts each press at exactly its frame.
Before, earliestStart judged an `at` on the earlier state: it read SP
without what hits granted on the way, and the driver had to ask both it
and startsNow (they disagreed for Typhoeus's battle skill after a dive,
48 frames). On seed 1 of the three example lists the old pair disagreed
on 39, 269 and 681 frames, every one of them SP granted between the last
press and the frame (the dive-landing case too: the landing's hit grants
SP); now none. A property test checks, at sampled frames between the
presses of the examples' own rotations and of rule runs, that startsNow
on the advanced state implies earliestStart's `at` start there, and that
the converse fails only by the current skill's own hits (a press without a
time waits for them; one with a time may cut them). SP is also read the
same however a state was advanced: regenerated SP on its grid (2/15 SP a
frame, so fifteenths) is snapped to it (`spAt`), where adding 4/15 frame by
frame gave 99.99999999999997 at a level of 100, a battle skill a frame
late. This moved two example scenarios' snapshots (akekuri-laevatain,
wulfgard-fluorite: ties at an SP level).

**Event stepping** (2026-11-16): the driver visits only the frames where
something it reads can change, which the frame-by-frame driver would see
too: the frame after a press (the cues are read again); anything
scheduled coming due (hits, actions, the enemy's, teammates' own attacks,
buffs' ticks and ends); what the cues and startsNow's gates read changing
with time alone (buffs' starts and ends, the enemy's states' ends,
Stagger's end, cooldowns, combo and chain windows, the current actions'
frames, a detached hit's launch, SP reaching a level a cue or a skill's
cost names, from the frame before); a rule's reaction delay ending; the
queue's wait; a `since` timer (`nextWake`). `stepping: "frames"` visits
every frame from the last press (the reference); tests/policy.test.ts
checks the two give the same rotation on the three example lists (seeds
1–3 full energy, 4 from zero, 90 s). It visits about a third of the
frames. Speed (300 s, one thread, the same machine and load; the old
driver against the new): the owner's team 1.59 → 0.92 s a run, Ink Melt
1.85 → 1.54 s, Typhoeus's 1.90 → 1.64 s; replaying the rotation
(`simulate`, the floor) takes 0.4–0.6 s. With an observer (the
diagnosis, the guided search) every frame is still shown to it, so those
runs gain less: 1.60 → 1.32, 2.40 → 1.66, 2.35 → 2.04 s (diagnosis) and
1.49 → 1.33, 2.30 → 1.79, 2.29 → 2.37 s (guided analysis). `efsim rules
--seeds 10` (the old one in-process): 30 / 43 / 38 s → 20 / 30 / 35 s on
one worker, 11 / 15 / 16 s on three (it plays through the command's pool
now). Most of the rest is the basic
attack's earliest start after each press (earliestStart, which advances a
copy of the state) and the presses themselves. The basic attack's options
are judged from their earliest start after the last press (`judgeEveryFrame`
checks that shortcut).

**Checks on a run** (`checkRuleRun`, policydiag.ts; the architecture
review's invariants): every press of a skill button cast what the button
showed then (and `shows`, if given); no press of an operator's battle or
combo button ended a state its own ultimate gave it (the buffs its hits
and its cast's triggers give its side, Link stacks aside) sooner than
without that press, compared over the next 2 s (Liino's End Stance in
Cosmovoice: the class of the bug found on the damage graph); `simulate`
replays the rotation to the same hits. tests/policy.test.ts runs the three
example lists (2 seeds full energy, 1 from zero, 120 s) and expects none
of the first two, and a constructed End Stance list to be caught.

**Learnability** (`learnability`): opener presses, rules, the rules'
presses and their **cue cost**: each cue part costs by its rank (1, 2, 3,
then 5, 6, 7 for ranks 4–6, and 20 for a timer), a combination the sum of
its parts; `complexity` = opener presses + rule presses + cue costs, the
one number the search trades DPS against. The report gives each rule's
cost and the hardest rank used.

**Common random numbers** (2026-11-16): the delay of rule i's k-th cue
onset (a rule firing counts as an onset: it sees its cue afresh) is a
function of (seed, the rule, k) only (`policyDelay`), the rule known by
its cue and presses (`ruleDelayKeys`; among identical rules, by its place
among them), not by its index or the order other rules drew in. So two
runs of a list with a little different gear, or two lists that differ in
one rule, see the same delays wherever their cues' onsets line up, and a
difference measured on common seeds is mostly the change's. Measured on
the owner's team (300 s, 10 seeds; sample sd of the per-seed
difference): Estella's gear swapped for the logs' loadout, 64 with common
seeds against 4,006 with independent ones (the old shared stream already
gave 76 here: the gear didn't change the order of draws); two rules
swapped (Akekuri's combo rule above Si's), 1,097 against 3,174 (the old
stream: 3,836, its draw order changed). Every list in the rule search is
scored on the same seeds 1…k. Antithetic delays (seeds 2k and 2k + 1
drawing u and 1 − u) were tried on 2026-11-16 too: on the owner's
team (its list against the same with its first two rules swapped, seeds
2000–2127) the paired difference's standard error was 0.17% antithetic
against 0.14% plain at 128 seeds (0.29% against 0.17% at 64), and no
better on Ink Melt: dropped (a chaotic response isn't monotone in the
draws, so u and 1 − u don't cancel). Stratified draws (a Latin hypercube per
(rule, onset) over the seeds) were tried and dropped: over 20 replicates
of 5 seeds the sd of the mean was 1,029 plain against 997 stratified for
one list, 1,238 against 828 for another, and 467 against 597 for their
difference: no clear gain (a chaotic response isn't additive in the
draws).

**Crits as a distribution** (2026-11-16): crits don't change the
timeline (but crit-triggered effects, below), so each run's sustained
DPS is a distribution over its hits' crits, from each hit's chance
(`PolicyRun.sustainedMoments`, moments.ts as for `efsim simulate`); the
runs (seeds) combine by the law of total variance (`policyDistribution`):
mean of means, variance E[σ²] + Var[μ], and the 5th / 95th percentiles of
the mixture of each run's normal approximation. The report splits the sd
into the reaction delays' (sd of the runs' means) and the crits' (√ of
their mean variance). With a crit-triggered effect in the team
(`critTriggers`) the battle plays crit mode `distribution` (the crits it
reads rolled, seeded with the delay's seed) and says so. This replaces
the rolled-crit runs. On the three teams the crits' sd is 350–380 DPS,
the delays' 550–2,900: the delays dominate.

**The report**: sustained DPS after the opener over a long fight (300 s
default, `--duration`), mean and spread over 5 reaction-delay seeds with
expected crits, and the distribution over delays and crits; the whole fight's total, damage per minute, the first 60 s
(comparable with a 60 s timeline under the same start); **robustness**:
sustained DPS as a bot (delay 0), at the default delay and at twice it;
which rules fired how often; presses given up; shares; and the
scenario's own rotation simulated as the reference.

**The rule search** (`efsim rules … --search`, `searchRules`): local
search from the given list. Edits: add a rule (mostly the natural ones:
a lit combo cast, a ready ultimate cast, a lit combo pre-empted by a
battle skill; else a random cue and press), remove one, swap two
neighbours, change a cue, add or drop a condition (`all`), negate a cue,
move a threshold (SP by 50, stacks by 1), add, drop or change a
pre-empting battle skill, change a rule's first press, change the
opener, toggle the filler; cues from what the team's UI shows, no
timers. Each list is played at the default delay over 2 seeds in a 180 s
fight (`--search-seconds`, `--search-seeds`), scored by mean sustained
DPS; every list scored is kept. A parent is the best so far (DPS less
0.2% a complexity point, `--penalty`) 60% of the time, else a list from
the Pareto front of DPS against complexity; one or two edits a child.
The report: the front (up to 8 lists, `--front`) scored again over the
whole fight, each in plain words, and the best of them by the penalised
score in full; `--out` saves it. 150 lists (the default) take 5–6 min
per team (three teams at once on four cores); 200 lists at 3 seeds and
240 s, 16–20 min.

**Noise.** The fight is chaotic for the driver too: a different
reaction-delay draw moves where Stagger windows, combo triggers and
ultimates fall, and a list's sustained DPS has a standard deviation of
1–5% over seeds (the owner's team 1,402 of 57,096 at 10 seeds). That is
as much as most single edits gain, so at 2–3 seeds the search often
kept a lucky list (before common random numbers: on the owner's team
every "gain" it found vanished at 10 seeds; with them a difference's
noise is a third, but a list's own level still moves). Judge a list at
10 seeds (`--seeds 10`) before taking it; the
bot (delay 0, one run) is one sample of the same noise, sometimes below
the 0.3 s player. Gains that held: Ink Melt +28%, Typhoeus's team +16%.

**How many seeds** (measured 2026-11-16, seeds 2000–2127, 300 s, 0.3 s,
full energy): the standard error of a paired relative difference between
two lists on common seeds, and in brackets the smallest gain it can show
(twice that). A list's own sustained DPS has an sd of 2.5–4.6% a seed
(the owner's 2.9%, Ink Melt 4.4%, Typhoeus's 2.8%), so unpaired
comparisons are hopeless; paired ones depend on how far the edit moves the
timeline:

| Edit (its gain at 128 seeds) | 10 seeds | 32 | 64 | 128 |
|---|---|---|---|---|
| Typhoeus's list without its last rule (+0.98%), a typical small edit | 1.20% (2.4%) | 0.77% (1.5%) | 0.52% (1.0%) | 0.36% (0.7%) |
| The owner's list, first two rules swapped (−0.06%) | 0.34% (0.7%) | 0.32% (0.6%) | 0.17% (0.3%) | 0.14% (0.3%) |
| The owner's list without its last rule (−19.0%) | 0.80% | 0.46% | 0.38% | 0.26% |
| Ink Melt's list without its last rule (−46.2%) | 1.05% | 0.72% | 0.58% | 0.39% |

Swapping the first two rules changes nothing on Ink Melt's and Typhoeus's
lists (their first rules rarely compete; standard error ≈ 0). The
differences are heavy-tailed (the owner's swap: the same standard error
at 10 and 32 seeds), so the first rows are the guide: a gain under 1.5%
needs 64 seeds or more, under 1% 128, and 10 seeds tell only gains over
2.5%. The guided search's 32 confirm seeds match this (0.5–1.2% there).

A comparison of two lists is `efsim rules <scenario> <a.rules.json>
--compare <b.rules.json>`: the paired gain ± standard error on seeds 1–k
and on fresh seeds 1001… (`--fresh`, default 32), where a list found or
judged on seeds 1–k isn't biased up. A gain written in the docs should
come from fresh seeds.

**Results** (sustained DPS over 300 s, 0.3 s delay, 32 fresh seeds
1001–1032, common random numbers, the fixed driver (one start check and
event stepping, 2026-11-16); the 10-seed numbers before the fixes are
superseded; each team page's "Rules" has the list in plain words):

| Team | Full energy (sd) | From zero (sd) | First 60 s against the 60 s timeline (full / zero) | 300 s total against a fixed 300 s search (beam 6) | Complexity |
|---|---|---|---|---|---|
| The owner's (hand-written; Artful Intent runs its 20 s, 2026-11-16) | 56,493 (1,913) | 56,055 (1,309) | −10.5% / −6.8% | +21.1% | 44 |
| Ink Melt (searched, then the Twilight hold) | 69,668 (2,657) | 61,716 (2,408) | −27.0% / −46.0% | +27.4% | 46 |
| Typhoeus, Arcane, Liino, Perlica (searched; Perlica's gear of 2026-11-16) | 54,607 (1,566) | 51,076 (1,602) | −26.8% / −43.1% | −3.2% | 50 |

The 60 s timeline is the upper reference for a 60 s window, not
sustained DPS; the fixed 300 s search (the scenario at 300 s, full
energy, beam 6, no macros: 34 min for the owner's team) is the sustained
one. The opener-and-loop searches (`--loop --sync`) take hours per team
(44 min to 5 h in their measurements) and weren't run again; their old
loops for the owner's team (INT build, other team order) aren't
comparable.

### Diagnosis, marginal values, gear on rules (phase 2, 2026-11-16)

The owner: find the inefficiencies in how a team plays, then the gear
that fixes them (too much Ultimate Gain Efficiency on a main damage
dealer whose ultimate comes faster than the supports' it needs is a gear
line that could have been damage).

**`efsim diagnose <scenario> <rules.json>`** (CLI diagnose.ts; engine
policydiag.ts `diagnoseRules`, a frame-by-frame observer of `playRules`
that never changes the run). A separate command rather than a section of
`efsim rules`: it plays ~300 runs for the marginal values (workers), and
`efsim gear --rules` reuses it whole. Over 5 seeds (`--seeds`), averaged:

- per operator: damage share; ultimate energy gained (after efficiency,
  before the cap; by source: SP spent, own hits, each kit trigger),
  spent, wasted at the cap and held at the end (start + gained = spent +
  wasted + end; engine statistics `energyGained`, `energySpent`,
  `energyOverflow`, read by nothing in the fight); ultimates per minute
  and seconds ready but not cast, by why: within a rule's reaction delay,
  behind other presses (the rule's cue was seen: another rule came first,
  a skill still acting, a sequence playing), held by the rule's condition
  (the list presses it, but that rule's cue didn't hold), or no rule for
  it; combos per minute and seconds lit but unused; battle skills per
  minute; damage by element, kind and while Staggered;
- team SP: seconds at the cap, SP lost to it by regeneration and by
  grants (`spOverflow`);
- the main damage dealer (most damage): other operators' buffs on its
  hits (from each hit's modifiers: the share of its damage, and of its
  ultimate's, each applied to; uptime on it) and the enemy's states
  (Vulnerable, inflictions, statuses, Staggered: uptime, share of its
  damage and ultimate damage landed under them);
- sustained DPS as a distribution (mean, sd split delays / crits, 5–95%).

**Marginal values**: per operator, the team's sustained DPS with one
gear-line-sized step more of each stat gear offers, paired on common
seeds (4, `--marginal-seeds`, 16 for noisy ones) with the diagnosis' runs: (probe − base) /
base, ± the per-seed differences' sd / √n. The steps are the game's T4
gear lines at full artifice (each kind's median size: main attribute
+71, secondary +48, other attributes +55 / +75, main attribute +26.9%,
secondary +23%, Crit Rate +13.5%, Ultimate Gain Efficiency +26.7%, Arts
Intensity +45, element DMG +24.9–29.9%, Battle Skill DMG +44.8%, Combo /
Ultimate DMG +35.9%, Basic Attack DMG +29.9%, DMG to Staggered +53.8%;
healing, HP and damage-taken lines left out), worn as a fifth synthetic
piece (`probe:<attr>:<slot>:<target>`) so the panel goes through the
same stat code, plus reference steps for what only sets and weapons give
(ATK +10%, flat ATK +20, Crit DMG +10%). An element's, skill kind's or
Staggered bonus is measured only for an operator with such damage. A
value is "noise" within two standard errors or under 0.1%. Damage-only
steps don't move the timeline, so on common seeds they're exact to
±0.1%; steps that move it (Ultimate Gain Efficiency, an attribute that
flips a mode) don't line up with the base's events and stay at ±1–2% at
4 seeds: those with a standard error over 0.25% get 16 seeds
(`DiagnoseOptions.marginalMaxSeeds`; ±0.6–1.3% then). Findings in
plain words follow from these: an ultimate held or energy wasted while
its efficiency is worth ~0; an ultimate energy bottleneck (efficiency
worth something); no rule for an ultimate; combos lit but unused; SP at
the cap; the main damage dealer's ultimate landing outside a support's
buff; each operator's best line.

**`efsim gear <scenario> --rules <rules.json>`** (CLI gearrules.ts):
loadouts scored by sustained DPS from playing the list (8 seeds by
default here, common random numbers, 300 s), coordinate ascent across
operators as `efsim gear` does, a change taken only when its paired gain
is over twice its standard error. Candidates per operator: the logs' and
a candidates file's (`gearCandidates`), plus two kinds from the
marginal values: **swaps** (one piece for another T4 piece of the same
part that keeps every active set, ranked by the lines' predicted worth,
linear in their sizes, the best 4 a pass) and **set builds** (each set's
best three or four pieces by the lines' worth, the rest the best piece
of any set; all screened by play on 2 seeds, the best 2 per operator
kept: a set's effect is in no marginal value). A gain whose standard error is over 0.25%
(a change of timing) gets 16 seeds before it's taken. The chosen gear is
checked against the start on 8 fresh seeds (1001…), since the ascent's
best-of-many gain is biased up (Ink Melt: +7.3% in the ascent, +2.1% and
+3.9% on fresh seeds). A loadout that flips a mode decided by two
attributes (Arcane's Intellect / Will) is flagged. Then the diagnosis
again with the chosen gear, what changed per operator, and which findings
went away or came; `--out` writes the scenario with the chosen gear (the
timeline rotation kept, which a loadout that moves ultimates may not
play: `efsim rules` then reports no reference).

Results (2026-11-16, each team page's "Gear"): the owner's team +8.0% ±
0.9 on fresh seeds with three changes (Estella's Grizzled Edge loadout,
the one the owner's example describes: her efficiency worth ~0, Arts
Intensity +5% a line; Si's logs' LYNX Slab loadout; Akekuri's Fiber
Gloves: more efficiency for a bottleneck support), examples kept; Ink
Melt +3.9% ± 1.0 (Wulfgard's efficiency, a bottleneck) but −1.5% on the
60 s timeline, example kept; Typhoeus's team +0.9% (Perlica, damage only,
example changed) and +5.9% for Arcane in INT mode (the owner's call). A
60-list rule search on the owner's new gear found no better list. Runs go to worker
threads (rulespool.ts; each loads the game data once). Since 2026-11-16 a
command has one pool (`commandPool`: started on first use, kept for all
its batches; idle threads don't hold the process), `efsim rules` uses it
too (`--workers`), and each long command's output starts with the commit
it ran on and whether the code had uncommitted changes (`codeProvenance`).
`gear --rules` takes a change only if it isn't worse on the team's
zero-energy start (`examples/<team>-zero.scenario.json`, by default when
it exists; `--also` overrides) by more than one standard error, and
reports the chosen gear on fresh seeds from there too.

### The guided rule search (2026-11-16)

The owner: "Our rule search needs a similar approach as the one that
worked for precisely timed workflows: we put together ideal combos and
seek to change the rules in directions that can get closer to achieving
the optimal damage output." The random rule search (above) never found
the edits found by hand the same day (Si's ultimate held for
Laevatain's Twilight; Si's battle skill only when her button shows it;
Liino's stance rule with `shows` and a Cosmovoice cue): each is one
structured change aimed at one missed multiplier or one changing button,
and a random walk over cues and presses rarely makes it.
`efsim rules <scenario> <rules> --guided` (engine policyguide.ts, CLI
guided.ts; a flag of `rules` because it takes the same inputs and gives
a list, as `--search` does):

1. **Ideal combos** (`guideRules`, an observer of `playRules` that never
   changes the run, then the run's hits). A **window** is an operator's
   skill family (its skills without the step number: Laevatain's Twilight
   attacks 1–4 are one window, Typhoeus's hover shots 1–5 one; a reaction
   kind one) with at least 2% of the team's damage, its **occurrences**
   its hits in clusters (a gap over 3 s starts the next). A
   **multiplier** is what a modifier on a window's hit comes from: a kit
   buff (`owner:id`, which covers team buffs, Amps, debuffs,
   Susceptibility and DMG Taken, weapon and set effects), Stagger's ×1.3,
   a reaction or physical status (Corrosion, Electrification, Breach);
   not the stat panel, a finisher's or Link's. Its **giver** is the press
   that created the buff: its owner's latest cast at or before it, by
   kind (Si's Amp ← Si's ultimate). The window's **ideal combo** is every
   multiplier the team puts on that window at least once, on every hit
   (Stagger always); a missing multiplier's **loss** is what the hits
   without it would gain with it: its modifiers as they were on a hit of
   the same kind (the same hit ID, else any of the family) added and the
   zones recomputed from the hit's modifiers (`withModifiers`: damage
   bonus, Amp, Susceptibility, DMG Taken as 1 + Σ, the multiplicative
   zone as a product, ignored resistance into the resistance zone, the
   crit zone at its expected value, ATK % into ATK with the panel's base;
   attribute points and Arts Intensity are left as they were, ×1). All of
   a window's missing ones at once give its ideal; actual / (actual +
   ideal gain) is its **achievement**. Fixed damage (Si's recorded burst)
   takes no modifiers and is skipped. An upper bound, not a plan:
   multipliers' uptimes and cooldowns aren't checked (Stagger on every
   hit can't happen).
2. **Measured over a long fight**: the same seeds as the candidates
   (common random numbers), per (window, multiplier): its presence (the
   share of the window's damage it was on), its factor when on, the DPS
   lost without it, its giver; per window the **visible cues** at each
   occurrence's start (the frame before its cast) against how often each
   holds over the fight (its lift): Laevatain's Twilight attacks come with
   "Laevatain is in Twilight" (100% of their starts, 34% of the fight).
   Team SP at the cap too.
3. **Directed edits** (`guidedEdits`) for the biggest losses (six
   (window, multiplier) pairs a round), each a player can follow by a
   visible cue (the owner's ranking):
   - *hold the giver*: the rules pressing the multiplier's giver wait for
     the window's cue (held at ≥ 60% of its starts and 1.3× as often as
     over the fight; no SP level), alone or "or the window operator's
     ultimate is ready";
   - *chain*: "when both ultimates are ready: the giver's, then the
     window's" as a new first rule, alone and with the giver held;
   - *start the window when the multiplier is up*: the rule that starts
     the window (its own button; for basic attacks under a visible state,
     the press that gives the state: Laevatain's ultimate for Twilight,
     Typhoeus's battle skill for her hover) waits for the multiplier's
     visible cue: Stagger (Staggered, the bar at 70%), a status, a
     visible operator state (Liino's Cosmovoice), else the giver's
     ultimate being ready;
   - *save SP* for an SP-gated window: other operators' battle skills
     wait while its visible state holds;
   - *`shows`* on each press of a button that changes;
   - *spare SP* (SP at the cap over 3% of the fight): a last rule spends
     200 SP on a battle skill;
   - *move up* the giver's rule; and four of the random search's moves as
     a complement.
   The giver of a window's own operator counts only for its ultimate on a
   window its ultimate doesn't start (Si's Amp on her combos).
4. **Judged by play** (`judgeEdit`): every candidate on seeds 1–6
   (300 s), the best four by that gain on 1–32, close calls (over 1.2
   standard errors, not 2) on 1–64 with the base; kept when the paired
   gain is over twice its standard error and 0.2%, and positive on the
   seeds after the screening six alone (picking the best screened edit
   biases those six up); among several, the best by gain less 0.2% a
   complexity point (the others are reported as Pareto alternatives).
   Then the analysis again on the kept list's runs, and the next round,
   until nothing clears the bar (a round that keeps nothing is followed
   by one aimed at 14 losses, with pairs of the best screened edits that
   change different rules merged); finally the start and final lists on
   32 fresh seeds (1001…). With `--also <scenario>` (the team's
   zero-energy start, added after the results below) the edits played on
   the confirm seeds are played there too, and one is kept only if it
   isn't worse there by more than one standard error. Since 2026-11-16
   the zero-energy companion (`examples/<team>-zero.scenario.json`) is
   the default second start when it exists, and with `--out` the list
   kept so far is written after each round that keeps one (a long run's
   partial result).

The report: the ideal combos (each window's DPS, its ideal's gain,
achievement, the multipliers it misses most with presence, factor, loss
and giver, and the cues it comes with), each round's edits with their
gains on 6 / 32 / 64 seeds, the fresh seeds' gain, complexity and
hardest cue; the kept edits; the path of kept lists (DPS against
complexity); achievement per window before and after; the final list in
the player's words (`--out` saves it).

**Results** (2026-11-16, full energy, 300 s, 3 workers on 4 cores; each
team page's "Rules"):

| Team | Achieved (start) | Biggest misses (window: multiplier, DPS if on every hit) | Edits / rounds / time | Kept | On fresh seeds | From zero |
|---|---|---|---|---|---|---|
| Ink Melt, the list before the Twilight hold | 50% | Twilight attacks: Si's Amp −3,704, Stagger −3,100 | 42 / 2 / 7 min | Si's battle skill before Ardelia's combo only when her button shows it, +3.10% ± 1.02 | +2.18% ± 0.87 | |
| Ink Melt, the example | 53% | Twilight attacks: Stagger −3,052, Si's Amp −1,363 | 38 / 2 / 12 min | none (the same `shows` edit +1.52% ± 1.42 on seeds 1–32) | the `shows` edit by hand: +3.93% ± 0.77 (1001–1064), +2.54% ± 0.86 (2001–2064) | −3.27% ± 1.26 |
| The owner's | 71% | Si's combo: Si's Amp −2,433, Stagger −2,107 | 70 / 4 / 20 min | Estella's ultimate only while Staggered, +1.70% ± 0.80 | +1.20% ± 0.66 | −0.94% ± 0.47 |
| Typhoeus's | 39% | hover shots: Liino's Cosmovoice Amp −13,411, Stagger −8,059 | 65 / 3 / 25 min | Arcane's ultimate only while Typhoeus hovers (or her ultimate is ready), +1.40% ± 0.52 | +0.57% ± 0.79 | +0.11% ± 0.51 |

No example changed. The two full-energy gains beyond noise (the
owner's team's Estella-on-Stagger, Ink Melt's `shows` on Si's battle
skill before Ardelia's combo, which skips that combo while Artful
Intent is up) both lose from zero energy, and Typhoeus's doesn't hold
on fresh seeds; hence `--also <zero scenario>` (below). From the list
before it, the search put the hand-found Twilight hold among its best
screened edits (+4.35% on seeds 1–6), but on 32 seeds it is +1.49% ±
0.87, and on 64 fresh seeds (1001–1064) the example with it against the
list without it is −0.11% ± 0.71: the +4.1% measured by hand on 10
seeds was those seeds. The Ink Melt example misses its `shows` edit on
seeds 1–32 (+1.52% ± 1.42), which 128 fresh seeds put at +2.5–3.9%: a
false negative of the 32-seed bar.
**The bar is the noise**: a paired difference's standard error is
0.5–1.2% at 32 seeds (the fight is chaotic: a held ultimate moves every
later event), so gains under ~1.5% can't be told from noise without 64
seeds or more, and most single structured edits gain 0–2%. The screening
seeds' gains shrink by half or more on the confirm seeds (the best of
20–30 noisy screens). What the search does give: the ideal combos and
their misses explain where damage is lost, the candidates are the moves
a player would think of, and the dead ends are measured (holding a
window's own trigger for a multiplier loses 7–57% on every team; holding
Liino's ultimate for Typhoeus's hover, the obvious move for the biggest
miss of all, gains nothing).

### Assumption switches (2026-11-16)

The architecture review's item 10: a recommendation is only as good as
the open readings under it (the Initial Stroke advice was +3% under the
data's reading of Si's Haste and −3% under in-game test 109's
alternative). A kit registers such a reading as data: `assumptions: [{
id, test, question, default, readings }]` on the kit, and a trigger with
`reading: { assumption, reading }` exists only under that reading
(schemas/kit.schema.json; the loader checks both). The scenario's
`options.assume` chooses readings (`createContext` keeps the triggers of
the chosen ones, each assumption's default otherwise). The first one is
Si's `si-haste-every-end` (test 109): `data` (the default: the Haste only
on the Inksoul's path) or `every-end` (Artful Intent ending with no
Inksoul gives it too: trigger `artful_intent_haste`). Laevatain's
`laevatain-twilight-clock` (test 21, 2026-11-22): `model` (the default:
the data's 15 s after her stop plus the holds the engine counts) or
`forgeborn` (1.8 s more, trigger `twilight_clock_excess`: the logs'
window-clock excess, which her other buffs show too; a sensitivity, not a
mechanism).

`efsim rules`, `diagnose`, `gear --rules` and the guided search take
`--assume <id>=<reading>` (run under it) and `--assumptions`: for each
other reading of an assumption the team's kits register, `rules` gives
the list's DPS against the reading in use and whether `--compare`'s
verdict holds, flips or is unclear there (a verdict: a gain or a loss
beyond twice the standard error, else noise; it holds when the same,
flips when opposite); `diagnose` gives the DPS and the findings that go
away or come; `gear --rules` and the guided search check the chosen gear
or final list against the start under it on the fresh seeds. A new open
reading needs only kit data. Measured (2026-11-16, the owner's team,
`efsim rules … --compare <the list with rule 9 pressing Si's battle skill
once, no Initial Stroke> --seeds 10 --fresh 32 --assumptions`): dropping
Initial Stroke is +0.35% ± 0.83 on the fresh seeds under the data's
reading (noise; the +3% of the hand-made comparison before the driver's
fixes no longer holds) and +2.84% ± 0.62 under test 109's alternative
(a gain), so the verdict is "unclear" there: test 109 decides it. The
whole command took 160 s on one worker under load.
