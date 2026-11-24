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
- **Friction rounds** ([friction/](friction/README.md)): rounds 1–10
  done (round 10, 2026-11-24: no shell programming left (premerge,
  snapshots, fetch-data, the session hook in TypeScript), `efsim kit`'s
  paths and triggers' actions, `gamedata tree --path`, unread options
  named, `zmdlogs totals --all --json`, caches shared across worktrees,
  HitRecord.graded, `at-commit --run`); the backlog
  ([2026-11-24-backlog-after-round-10.md](friction/2026-11-24-backlog-after-round-10.md),
  7 live points: the stop lists' identity, a slot flag, measure --split,
  the replay's DROPPED line, counterfactuals, the compiler's message,
  analyze.py) joins the next round once about five new reports have
  collected.
- **Rule-based rotations** (phases 1 and 2 done; 2026-11-22 the search
  decides its own questions: the objective across starts, rule sets,
  setups, new cues): for the owner only gear to farm (the owner's team's
  +8.0%; Arcane in INT mode is decided: −1.9% rules against rules, not worth
  the Hot Work loadout) and in-game tests 106, 108 (dives); next a cheaper
  variance for the guided search (most of a day's runs), the gear ascent
  on the new lists, a cheaper worth for timeline-moving stats.
- **Typhoeus's team:** the least converged search (beam 96, or seeded with
  the found rotations); fc63's 4th shot anchored to her 5th's cast;
  Liino's stance ATK missing at 4d60's combos; Cosmovoice ending before its
  logged finale (Perlica's combo hits and 9090's −9.6% done 2026-11-22:
  Pulser Labs and Wild Wanderer before the hit's damage; Liino's volleys
  done 2026-11-18, her beats and stances before a log 2026-11-22).
- **Gear:** a search seeded with the current rotation, so a re-search with
  new gear means something; then Si on the LYNX Slab loadout.
- **Planning after phase 3:** cheaper macros, a setup value that doesn't
  overvalue held pieces, skeletons that aren't greedy; the owner's opener
  and loop with Arcane in WILL; Ink Melt next to the owner's team.
- **Misprediction statistics** ([analysis/2026-11-24-misprediction-stats.md](analysis/2026-11-24-misprediction-stats.md),
  2026-11-24; Zhuang Fangyi's Empyrean combo key fixed, 4.3% of the error): next the ×1.5 band's rest (Alesh's
  ultimate, Liino's ultimate windows), the one-buff list by size (Si's Amp, Gilberta's and Arcane's weapon buffs), the
  "ready" weapon buffs' consumption, fit-build for Liino in 7910 / af7b.
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
