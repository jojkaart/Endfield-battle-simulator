// The engine assumptions only the log check reads: its replay (packages/logs replayrun.ts, buffreplay.ts, holds.ts,
// castassembly.ts), its totals and readings (enginecheck.ts), never the timeline. Registered with the simulation's
// (assumptions.ts ENGINE_ASSUMPTIONS) so `--assume` and measure's `--variant` take them, the engine's context accepts
// them, and `efsim assumptions` lists them; kept in a file of their own, outside timeline/, so a lead adding a log
// rule's reading touches no timing code (round 19, the Camille report point 2). A reader takes the replay's readings
// through readingOf (assumptions.ts), never a default of its own (tests/assumption-readers.test.ts). The evidence of
// each reading: docs/design/assumptions.md.

import type { EngineAssumption } from "./assumptions.ts";

/** The log replay's and the log check's own readings (none of them read by a simulation). */
export const REPLAY_ASSUMPTIONS: readonly EngineAssumption[] = [
  {
    id: "break-hold-place",
    question: "Where does the hold at a logged Stagger break (break-hold) start against the breaking hit's logged ms?",
    default: "moments",
    readings: {
      moments: "from the log's moments: no logged moment falls inside a hold, so where the next comes sooner after the break's ms than the hold lasts, the hold ends at it, starting no sooner than 134 ms after the moment before (the landings logged there, the replay's clock a few frames late; 9090afbacec9 128.50 s)",
      ms: "at the breaking hit's logged ms (the replay's default until 2026-11-27; most breaking hits are logged at their hold's start)",
    },
  },
  {
    id: "break-held-starts",
    question: "Does a new cast's start, placed from its first landing, read the holds at the logged Stagger breaks it ran through?",
    default: "unheld",
    readings: {
      unheld: "no: its start is its landing less the frame and the other casts' stops; the replay then holds it at the break again (fc63a2001251 102.33 s: the battle skill inside Typhoeus's combo's uncuttable frames)",
      held: "yes: a break between the start the landing gives and the landing (not inside another operator's combo slow-down) moves it that many frames earlier (fc63's combo to 98.57 s, its event at 98.42 s; one hold-out −6 plain, no decision moved)",
    },
  },
  {
    id: "hidden-holds",
    test: "111",
    question: "What holds the operators' buffs and the enemy's timers past their modelled end in some windows (docs/open-problems.md \"The buff clock\")?",
    default: "placed",
    readings: {
      placed: "the fight's hidden holds placed once from every clock the log shows (its buffs' runs against the replay's own expiries, the enemy's tick series; none while Staggered; the least total hold, midway between its earliest and latest placement: packages/logs holds.ts placeHolds) and held on the world's clock for every timer",
      log: "a buff the log lists past the replay's expiry (a single run from its application, not refreshed, no hit of a holder past the expiry without it) runs on to its last listed hit, up to 40% of its life",
      holds: "the placed holds alone, without `log` (what the holds do by themselves)",
      none: "the replay's own expiry: holds only by the casts it places (the replay until 2026-11-22)",
    },
  },
  {
    id: "stagger-holds",
    question: "May the hidden holds (hidden-holds `placed`) rise while the enemy is Staggered?",
    default: "none",
    readings: {
      none: "no hold while the replay's Stagger lasts (the placement until 2026-11-26)",
      combos: "inside the Stagger, holds only within a combo's stop, up to half its own hold (Σ 1 − scale) there",
      "combos-full": "the same, up to its whole own hold",
    },
  },
  {
    id: "pause-holds",
    question: "May the hidden holds (hidden-holds `placed`) rise in an away stretch (no logged hit by anyone for ENEMY_AWAY_MS or more) that a Stagger covers, and by more than HIDDEN_HOLD_SHARE of a clock's life?",
    default: "paused",
    readings: {
      none: "no: the Stagger is still from its start to its end (the placement until 2026-11-26)",
      away: "yes: each away stretch is cut out of the Stagger's still span, and the clocks place what they ask there",
      paused: "as `away`, and a clock's run across an away stretch may ask the stretch's length on top of HIDDEN_HOLD_SHARE of its life",
    },
  },
  {
    id: "enemy-away",
    question: "Is the enemy there in a stretch of the fight where the log has no hit at all for 6 s or more (ENEMY_AWAY_MS)?",
    default: "absent",
    readings: {
      away: "no: the enemy is out of reach",
      counted: "yes: every replay landing up to the log's last hit counts (the totals until 2026-11-23)",
      absent: "no, and the replay's enemy isn't there either",
      "absent-edge": "as `absent`, the replay's enemy away only from 0.3 s inside the stretch's ends, as the totals leave landings out",
    },
  },
  {
    id: "kill-gaps",
    question: "Is the enemy there between a logged kill (a hit capped at the HP left: the log's `uncapped` above its value, before the fight's last hit) and the next logged hit, however short that stretch?",
    default: "absent",
    readings: {
      there: "yes: only the enemy-away stretches hold the replay's enemy away (the replay until 2026-11-27)",
      tight: "as `absent`, from the frame after the kill's ms to the frame before the next logged hit",
      absent: "no: from 0.15 s after the kill's ms to 0.15 s before the next logged hit (enginecheck.ts KILL_EDGE_MS: a landing logged at either may come a few frames off it in the replay) the replay's enemy is away, as in an enemy-away stretch under `absent`",
    },
  },
  {
    id: "status-pairing",
    question: "Which of the replay's status landings (Arts Bursts, reactions, Combustion ticks, physical statuses) stands for a logged status hit?",
    default: "check",
    readings: {
      nearest: "per logged hit in time order, its operator's free landing of its kind and element nearest it within 16 frames",
      assignment: "per operator, kind and element, one assignment over the fight",
      check: "as `assignment`, and a landing's value also fits where the check's primary reading of the pair fits",
    },
  },
  {
    id: "logged-purges",
    question: "Does the enemy shed the team's debuffs at once where the log shows them all gone together (a stage's phase change), or where one of several targets under one id dies?",
    default: "log-kills",
    readings: {
      none: "no: each debuff runs to its own end (the replay until 2026-11-26)",
      log: "yes: at a logged moment after which none of the team's runs on the enemy listed there is listed again",
      "log-kills": "as `log`, and in a fight against several targets under one id (the fixture's severalTargets) read as one target (several-targets `one`) also at each logged kill",
    },
  },
  {
    id: "several-targets",
    question: "How does the log check read a fight against several targets under one id (the fixture's severalTargets)?",
    default: "targets",
    readings: {
      one: "as one target: every target's debuffs on the replay's one enemy, a kill sheds them all (logged-purges `log-kills`), a kill gap holds the enemy away (the check until 2026-11-27)",
      targets: "per target (packages/logs targets.ts): each logged hit on a target (a landing's twins on others, else the alive target its value fits), each its own debuffs and kill; the replay's enemy keeps the debuffs at kills and stays in a kill gap with targets left; a landing counts once per target whose hit fits",
      "targets-once": "as `targets`, but the totals count a landing once, as for one target (its logged hits on other targets log-only)",
      "targets-gaps-away": "as `targets`, but a kill gap holds the replay's enemy away whatever targets are left",
      "targets-ungated": "as `targets`, but a landing counts once per target its logged hits are on, whether or not the hit's value fits its target's state",
    },
  },
  {
    id: "target-deaths",
    question: "What does the replay of a fight read per target (several-targets `targets`) make at a target's logged kill?",
    default: "kills",
    readings: {
      moves: "a death only where a kit's targetDeath trigger's hit is logged (Camille's Vesperwings moving on: packages/logs targets.ts deathMoves; the replay until 2026-11-27)",
      kills: "a death at each logged kill before the log's last ms too, its targetDeath triggers running (Laevatain absorbing the dead target's Heat as Melting Flame); an operator whose trigger lands a hit makes it only where the log shows its landing; the replay's enemy keeps its statuses",
      statuses: "as `kills`, and the dead target's statuses (the replay's enemy's infliction, reactions, physical statuses, Vulnerable; the bursts due on it) end with it, after its triggers (6339's 29.26 s Laevatain combo then finds no Combustion on its slug: −5 points)",
    },
  },
  {
    id: "target-statuses",
    question: "Does the replay of a fight read per target keep the enemy's statuses per target?",
    default: "per-target",
    readings: {
      one: "no: one enemy holds every target's infliction, reactions and physical statuses (the replay until 2026-11-27)",
      "per-target": "yes: a second replay with each logged landing on the targets the first one's assignment put its hits on, the others' statuses kept apart, a death ending its own target's; Stagger and debuffs one",
    },
  },
  {
    id: "hitless-presses",
    question: "Is a logged press of a skill whose hits the log shows elsewhere, but none of its own this time, made (the enemy there, not an away stretch's `unseen` press)?",
    default: "inferred",
    readings: {
      skipped: "never: the slot held a variant, or the press did nothing (the replay until 2026-11-26)",
      inferred: "made when the log lists, on its first hit after the press's landing",
    },
  },
  {
    id: "listed-casts",
    question: "Is a cast the log shows neither by a hit nor by a cast event, only by a buff one of its hits alone gives (a run of it starting where no replayed cast could have landed that hit), made?",
    default: "inferred",
    readings: {
      none: "never: a cast is made only from its logged hits or cast event (the replay until 2026-11-26)",
      inferred: "made, timed so that hit lands at the run's `since`",
    },
  },
  {
    id: "unlogged-tails",
    question: "Did a cast whose landings after its last logged one are none of them in the log, the enemy there and the log recording, end there (a dodge, a swap, a hit on its operator: inputs no log records), or did those landings land unlogged?",
    default: "cut-all",
    readings: {
      kept: "the cast plays its whole path (the replay until 2026-11-26)",
      cut: "a battle skill, combo or ultimate ends the frame after its last logged landing, under its guards (no logged hit or status for its tail, outside the away stretches and the fight's last 0.5 s, no new run of a buff its tail gives, the replay with it cut losing no logged hit's landing: the evidence's first paragraph)",
      "cut-all": "as `cut`, basic attacks too: a basic attack's later hits are cut by the same inputs no log records, and more often",
    },
  },
  {
    id: "totals-crits",
    question: "How does a fight's total count a matched hit whose crit the log doesn't give and whose value neither of its readings (crit, non-crit) gives exactly?",
    default: "read",
    readings: {
      expected: "at expected crits (the totals until 2026-11-26; accuracy plan A3: counted as non-crits they ran low)",
      read: "at the reading its value is within ×1.08 of while the other isn't",
    },
  },
  {
    id: "check-crits",
    question: "Which crit does the log check's primary reading of a hit whose crit the log doesn't give take: the crit the replay read from the log (packages/logs replaycrits.ts: a crit trigger's own logged hits, the layers it adds, the hits' values; BuffReplay.critSource), or none?",
    default: "replay",
    readings: {
      replay: "the replay's crit where it read one from the log",
      none: "no crit, the crit reading labelled `crit` (the check until 2026-11-26)",
    },
  },
  {
    id: "enemy-hp",
    question: "What is the enemy's HP over a logged fight, for the hits whose damage depends on it (enemyHpBelow: Chen Qianyu's P1 Shadowless, Alesh's P5 ultimate)?",
    default: "kill",
    readings: {
      kill: "a fight that ends in a kill (its last logged hit capped) has the logged total as its HP, the stage's scaling of Max HP included, in lives of about Max HP split where the enemy went away as the damage reached a multiple of it",
      "max-hp": "only a fight whose logged total is the data's Max HP (one enemy, one life) has an HP",
    },
  },
];
