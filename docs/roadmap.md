# Roadmap

Only what's next, about one screen. Each step's leads, numbers and open
questions: [roadmap-details.md](roadmap-details.md) (same order), which also
holds the longer-term list. What's done: the [journal](journal.md). Every
playable operator, weapon and gear set has a kit (batches 1–4,
[kit-process.md](kit-process.md)); the October review is done but for items
below ([review-2026-10.md](review-2026-10.md)).

## Next steps

- **Architecture review** ([architecture-review.md](architecture-review.md),
  2026-11-16): the quick wins 1–7 first; the button model, one start
  check, event stepping, run checks, visible states in kits and assumption
  switches (8, 9, 3, 4, 10) are done, and the package boundaries and
  the design.md split (12–14, friction round 2); next the accuracy scoreboard (11),
  more open readings registered as kit assumptions (tests 101, 102, 108),
  and a cheaper basic-attack start for the rule driver (now most of a run).
- **Friction rounds** ([friction/](friction/README.md)): rounds 1–19
  done (round 19, 2026-11-27: the assumption registry out of timeline/
  with its evidence in [design/assumptions.md](design/assumptions.md),
  every reader through `readingOf` and a trace test, `zmdlogs
  followups`, `--against-lanes` ends, `holds --steps`, `gamedata enemy`
  and an entity's tree, the hold-outs' key test and a blindness test
  over every printer); the backlog
  ([2026-11-27-backlog-after-round-19.md](friction/2026-11-27-backlog-after-round-19.md),
  2 points: clocks around a non-cast hold, the same-listing flag for two
  targets; on its accuracy list the element mask of log-only buffs, 14
  factor stretches and the recorded Stagger start) joins the next round
  once about five new reports have collected.
- **Rule-based rotations** (phases 1 and 2 done; 2026-11-22 the search
  decides its own questions: the objective across starts, rule sets,
  setups, new cues): for the owner only gear to farm (the owner's team's
  +8.0%; Arcane in INT mode is decided: −1.9% rules against rules, not worth
  the Hot Work loadout) and in-game tests 106, 108 (dives); next a cheaper
  variance for the guided search (most of a day's runs), the gear ascent
  on the new lists, a cheaper worth for timeline-moving stats.
- **Stagger breaks:** done 2026-11-27: every clock held 14 frames at a
  break (`break-hold`; owner's team −0.9%); the hold's start from the
  log's moments the default (`break-hold-place` `moments`, 4d60's
  INSIDE gone), a start held by the breaks it ran through a reading
  (`break-held-starts` `held`: fc63, 3aa6; one hold-out −6, not the
  default), the recovery stays 2 s; next the hold-outs' INSIDE, breaks
  inside a combo's slow-down, 458b 87.47 s.
- **Typhoeus's team:** the least converged search (beam 96, or seeded with
  the found rotations); fc63's 4th shot anchored to her 5th's cast; Liino's
  Medicant layers on Arcane in 1d91 (beats from 44.9 s give none); Zhuang
  Fangyi's Xiranflow layers held by stops the game doesn't hold them by (4d60
  69 s); done 2026-11-27: her attack 4 placement, Liino's linger (disabled in
  the data) and her unlogged End Stance from the beats (team −0.15%); 4d60's
  away stretch 27.4–37.0 s a whole-game pause (`pause-holds` `paused`: her
  Sunderblades and Liino's stance to its last beat, 822 → 987 plain).
- **Gear:** a search seeded with the current rotation, so a re-search with
  new gear means something; then Si on the LYNX Slab loadout.
- **Planning after phase 3:** cheaper macros, a setup value that doesn't
  overvalue held pieces, skeletons that aren't greedy; the owner's opener
  and loop with Arcane in WILL; Ink Melt next to the owner's team.
- **Misprediction statistics** ([analysis/2026-11-24-misprediction-stats.md](analysis/2026-11-24-misprediction-stats.md),
  2026-11-24; Zhuang Fangyi's Empyrean combo key fixed, 4.3% of the error; the candidates worked 2026-11-24: weapon
  buffs logged as their attached buff, the enemy's HP from a kill's total in lives, Ardelia's chain, Si's pre-log
  ultimate; the kit buff leads 2026-11-24: Zhuang Fangyi's Empyrean end logged as an ultimate event, fixed; Arcane's,
  Gilberta's, Typhoeus's leads are bursts, clocks and placements, not kit values; the placement leads 2026-11-24: an
  ultimate whose landing travels placed from its cast event at its stop's edge (Liino, Ardelia, Arclight), Chen's
  stew in 7e19, tick-read events out of the hold placement's stops; Swordmancer's cooldown is on the world's clock,
  assumption `trigger-cooldowns`; the cooldown-clock round 2026-11-24: each trigger's clock from the data
  (KitTrigger.cooldownClock: CD timers and cooldown buffs world, timed markers raw), an Arts Burst held by its own
  operator's ultimate stop (`burst-stops`), every finisher hit Staggered (`finisher-stagger`), KitHit.travels from
  LaunchProjectile in the placement's event rule; the remaining leads 2026-11-25: the Empyrean's end on its event's
  frame, ultimates pressed together placed in turn, the touch's element after a reaction as assumption
  `window-reaction`; holds and placement 2026-11-25: a freeze holds no Arts reaction status, `freeze-ramp`
  `statuses`, 489c 488 → 632 plain; a third placement pass and the in-turn chains tried and dropped; the damage factors
  2026-11-26: 04d4's Catcher at weapon level 3, the Crush's misses Rossi's stacks from an infliction the replay lacks
  (0c14: Si's away press), Ember's listed talent dropped by the check; three diffs held back for the lead; the enemy's
  clock 2026-11-26: across a combo's stop every clock runs late by a fifth to a half of its hold (db87's ticks, casts,
  bursts), not the curve (a flat ComboSkill curve measured worse), not Arcane's Imprisonment (test 37's Arcane part
  decided), no pause while the enemy is away, `stagger-holds` registered off; away and presses 2026-11-26: the replay's
  enemy away (`enemy-away` `absent`), a hitless press inferred from the listing (`hitless-presses` `inferred`), a
  life's end and a kill from the last life's damage, layered unjudged buffs at each count; the held-back diffs
  superseded; one per-edge delay ruled out for the combos; combo hold and replay 2026-11-26: a cast's unlogged tail
  ends it (`unlogged-tails` `cut`: 0c14's Rossi, plain 293 → 336), the operators' combo excess in the stop's first
  half (a uniform extra hold `combo-operator-hold` measured worse), the ComboSkill curve a reading (`combo-curve`),
  a9d7's edge a hidden hold; 0c14 and the operator curve 2026-11-26: the totals read a crit-unknown hit's crit from
  its value (`totals-crits` `read`: 0c14 −3.2 → −1.3%), a teammate's attack on its not-controlled path (Rossi's
  attack 4: 2fd9 +25 plain, 99fb +12); 9c6e's cut is the placement's two-enemy split (a rule for it broke 40d9); the operators'
  own combo curve measured worse in every shape; the tail cuts reviewed, none against the log; bursts and cooldowns
  2026-11-26: 4d60's Perlica and Will runs a whole-game pause inside a Stagger, `pause-holds` `away`, 696 → 806 plain;
  the replay's Stagger windows start where they began; d4fb 97.05 s a Lift that breaks the bar, one case, not built;
  Snowshine's ×0.9846 and test 33's reaction case undecidable by the logs; Alesh's Rare Fin 2026-11-26: chance paths
  from the listing, a cast from a hit's listed buff, `listed-casts`, 0c14 338 → 493 plain; low plain, low mismatch
  2026-11-26: the replay's read crits are the primary reading's, `check-crits`, a status's crit counts for triggers on
  crits, Rossi 51.9 → 73% plain; the fights outside ±5% 2026-11-26: a cast event logged as its button's other variant
  (db87's Link), tail cuts take detached hits (c83c, hold-out 8.4 → 7.4%), a carried Corrosion above its cap unclamped
  (7910 −6.1 → 0.0%); slots and paths by value 2026-11-26: a cast's slots by its landings' values (9c0b's Hunter
  Pursuit), Pogranichnik's combo path by its slashes' values and once (his bank's Fervent Morale on time), a Breach's
  Arts Intensity after its hit's before-damage triggers, a second enemy's landing by value (9c6e); the slug's purges
  read from the log 2026-11-26, `logged-purges`, 6339 plain 28 → 112; a stop's batched landings 2026-11-26: a logged
  ms's landings in its Stagger bars' order (c4f3's Estella, and with it the 13.07 s Breach's four stacks),
  Pogranichnik's Fervent Morale before the damage of the hit that makes it: development plain 74.3 → 76.2%, earlier
  73.0 → 77.7%): next e82d's Doubles Susceptibility ending after a second touch inside her seal (the only such log; a
  second one decides it), 7b54's partial purges, a hold bound from an end-boundary hit's value (c4f3's Wolven Blood),
  Pogranichnik's harasses' logged delays (0.6–1.3 s, d4fb 88.55 s), Estella's weapon ATK in c4f3's 7.05 s batch,
  7910's early rogue wave with no logged dive, other whole-game pauses outside a Stagger, 0c14's Stagger at its
  breaking hit; Arcane's mismatches 2026-11-26: a stage's round damage factor as the fixture's `stageFactors` (8915,
  c6d8; Arcane 697 → 233 mismatches): next 8915's Corrosion step and Hot Work end after two combos pressed together,
  fc63's Corrosion under `window-reaction`; away stretches 2026-11-27: a pause (4d60, both stretches: every clock held,
  the team's and the enemy's) or a phase (the other 29: every clock runs on), told by the clocks (`pause-holds`
  `paused`); 8915's early Corrosion step is at the log's grain, combos pressed together elsewhere run late as single
  ones; exposed totals 2026-11-27: a stage Electrification is Arts-only, a kill
  from a stage-scaled total (207f +5.5 → +1.6%), Rossi's combo 3 on its jumped path (3f78 plain 114 → 151): next d774's
  first Empyrean battle skill (3 strikes, no final, 103.28 s), 3f78's Corrosion ramp ×1.017, a9d7's Chen; log-only
  landings 2026-11-27: Typhoeus's burst Signs by source (`typhoeus-sign-cooldown`, 1d91), Zhuang Fangyi's 3 s
  Sunderblade floor (d774): next Arcane's INT lasers' start, the
  placement's log-only casts (f879 95.10, 5082 45.06, 3aa6 125.65 s); replay-only landings 2026-11-27: a logged
  kill's gap (`kill-gaps`), basic tails cut (`unlogged-tails` `cut-all`, 207f), a tail kept only by its own landings'
  buffs (d774 103.28 s fixed), Si's final placed by value, Typhoeus's bursts across misplaced stops (fc63): hold-out
  |damage error| 7.1 → 6.3%; next the slug's unlogged hits (shield?); status pairing 2026-11-27: one assignment by
  value and time (`status-pairing`, development one-sided 5.35 → 4.99%, matched unchanged), 9c6e marked
  `severalTargets` (its own row); next the pairs a buff's edge puts off in value, judged by the check's reading;
  placement cases 2026-11-27: an ability entity's landings due within the slots' span (f879's empowered battle skill),
  a press due in an away stretch made as its button's variant (3aa6), a used-up cast's second landing by the slots'
  multipliers (9a80's finals): next 5082's Yvonne held at a Stagger break (a break dilation?), Pogranichnik's harass
  entity's own slow-downs; the slugs and status pairs 2026-11-27: Hard 33's "slug" is eight slugs under one id
  (6339, 7b54 `severalTargets`, a reclassification), a kill purges in such a fight (`logged-purges` `log-kills`),
  status pairs fit by the check's reading, at the logged frame where only that fits (`status-pairing` `check`):
  several targets read per target 2026-11-27 (`several-targets` `targets`: each hit's target by its value, each
  target its own debuffs and kill; the row plain 54.1 → 68.5%, |damage error| 20.0 → 16.1%); the placement's twins
  on several targets 2026-11-27 (a batch's alike hits `targets` per landing: 7b54 +26.8 → −3.3%): next Camille's
  Vesperwings moving to the next slug (a kit hit and a pressless replay landing), statuses per target; Camille's Vesperwings and Pogranichnik's harasses 2026-11-27: her debuff
  ends at its entity's check when the enemy leaves (`vesperwings-target-loss` `listed`, e989 plain 260 → 267, one
  hold-out 6.4 → 5.8%), his harasses on the world's clock with their own slow-down (frame 18; d4fb, de6a, c4f3, 7e19
  better): next his Decisive Assault, logged 0.21–0.44 s after its event against the data's frame 25; the
  operators mostly mismatching 2026-11-27: build fits under the screen's 3% (04d4's Ember, Exemplar's skill 1 at 9;
  4e36's Alesh, 2 nodes) and a DEF percentage over the talent's points (Catcher): earlier pending plain 82.3 →
  84.4%: next Liino's Medicant layers on teammates (9847, listed to ×9), Snowshine's 04d4 build (undecided).
- **Engine accuracy** ([accuracy-plan.md](accuracy-plan.md); the owner,
  2026-10-26: above the search's scoring): B2 (SP stop; test 102 isn't
  testable by hand, the owner 2026-11-16) stays on its interim, B4 waits on
  test 71; tests 18, 19, 101, 104 done from the logs (2026-11-16: bosses
  freeze, Haste isn't attack speed, teammates' pause 6.5 s); tests 9, 17,
  22, 46 decided and 21, 43 partly from the logs (2026-11-18: buffs created
  in a stop are held; Twilight still 0.1–4.6 s longer than its model, 2026-11-22: as are her other buffs, a buff-clock question;
  the buff clock 2026-11-22: unlogged world holds, about a perfect dodge each, on one clock per fight;
  2026-11-23 the replay places them once from the log's clocks for every timer, `hidden-holds` `placed`:
  development plain 59.9 → 62.8%; they don't explain the SP shortfall; 2026-11-23 the enemy's statuses and
  Corrosion's ramp as clocks too, d774 and db87 fixed; Wolven Blood's unlogged crits from its listed layers
  2026-11-23, 489c 517 → 546; the ramp's over-holds 2026-11-23 (freezes run the ramp on; Arcane's combo resets the
  combo slow-down at its frame 9); crits from the hits' values, Combustion ticks with the tick before's side, landings
  batched at a stop's end 2026-11-23 (5082 −8.2 → +0.7%, a7a7 376 → 405); an ultimate cuts a finisher, late instance
  runs without a reapplication as clocks, the stop lists along a cast's path 2026-11-23 (458b 8.0 → 0.8%, 5082 +23,
  489c +10; Rossi's combo_3 dilations worth 2 frames, not built); next test 111, Rossi's bleed tick series across a
  reapplication (489c 52–60 s), a Corrosion end read from the hits as a bound (4d60 102.98 s), 6339's missing hit_2);
  Arcane's reset reaches a combo pressed inside her first 9 frames, Purrchena's combo paths end at her loop's cast
  2026-11-23 (7910 +15 plain, 9555 +9; 489c's bleed series isn't a reapplication: a hold-unit conflict under the
  ramp's cap, next); fight totals 2026-11-23 (the enemy away in Si's phases, the Endministrator's shatters and male
  kit, Hard 27's stage Electrification: development 8.7 → 8.1%, hold-out 10.2 → 9.1%, earlier 8.1 → 5.3%; round 2
  2026-11-23: `zmdlogs totals --all`, build offsets fitted in seven logs (a9d7's and d9e5's missing foods), kills from a
  capped last hit, an ultimate's slots by time, Typhoeus's 4th shot: development 8.1 → 7.3%, earlier 5.3 → 4.9%,
  hold-out 9.1%, one-sided; round 3 2026-11-23: the one-sided landings by kind (`zmdlogs totals --kinds`, measure's
  hold-out means by kind), Zhuang Fangyi's Sunderblade variants in turn, Si's burst paths one landing, Typhoeus's
  Barrage Array at its pace: hold-out 9.1 → 8.2%, development 7.3 → 7.2%, earlier 4.9 → 4.8%; round 4 2026-11-24:
  a Shatter at a later Vulnerable stack is its starter's, Snowshine's counter jump from its logged bash, Rossi's crits
  from her own hits only: earlier 4.8 → 4.3%, 2fd9 −15.6 → −3.6%, hold-out one-sided 10.5 → 9.8%; next the hold-outs'
  physical misses by status kind, Zhuang Fangyi's Empyrean free blades, Rossi's bleed end, slots by value); Arcane's misses grouped (2026-11-18: 908 → 866;
  Imprisonment's end and her INT lasers from the data and the log 2026-11-22); the replay follows the log's Stagger
  windows, and the engine adds a 2 s recovery (2026-11-18, test 110 from
  the logs; with tests 8, 10, 12, 107, 108's tap: the owner's queue holds
  only game-only tests now); Rossi's bleed and ultimate crits (2026-11-22:
  her bleed keeps only ATK, its ticks on the log's clock; her buffs' lengths
  are the buff clock's); Gilberta's Vulnerable count at her ultimate
  (2026-11-22: 489c / d572 fixed, Rossi's combo 3 landed twice; 4360 2026-11-23, an instance buff's run as a
  hold clock; left 9847, next her listed Susceptibility as a Vulnerable-count clock); Si's strokes from the log (2026-11-23: Initial Stroke at the first
  press, Final Stroke by the burst's origin; Yinglung's Edge 61 / 68, left the boss's phase pause, test 106); four
  smaller leads (2026-11-23: Hard 27's resistance 11 from a second player's log; Liino's combo placed from its stop's
  end; statuses created in a stop held; d774's ×1.39 and db87's ramp are the buff clock's hidden holds on enemy
  statuses); build offsets fitted, not hand-set (`zmdlogs
  fit-build`, fixture `buildOverrides`, 2026-11-18; next: weapon levels
  bounded by their skill levels, the old hand fits moved over); then the
  screened logs' leads
  ([open-problems.md](open-problems.md)), diagnosed in parallel; then B8,
  B6, B9, B10.
- **The tool's purpose:** rotations for the owner's favourites (Typhoeus,
  Arcane, Si, Gilberta, Liino, Estella, Laevatain, Rossi): a search score
  closer to the final damage, then searches and a report; ask the owner for
  their roster.
- **Standing lists** (details): log check leads, kit values from the data,
  engine, food, process.
