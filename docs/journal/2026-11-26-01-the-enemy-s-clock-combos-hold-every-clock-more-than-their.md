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
