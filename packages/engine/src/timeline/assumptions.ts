// The engine's own open readings: rules the engine applies to every kit that an in-game test or the logs decided
// only in part, registered like the kits' assumptions (OperatorKit.assumptions) so they switch the same way:
// TimelineOptions.assume (`--assume <id>=<reading>` in rules, gear, diagnose, `zmdlogs check`, scripts/measure.ts),
// each reading's code next to the rule's. The default is the reading the engine stands by; switching one is an
// experiment, not an edit (the round-3 friction reports: boss freezes, the teammates' pause and freeze rules were
// decided one way with no switch back).
//
// Each entry's ID must be unique across the engine's and the kits' assumptions (tests/engine-assumptions.test.ts checks it).

import { EngineError } from "../errors.ts";
import type { KitAssumption } from "../model.ts";
import type { TimelineScenario } from "./state.ts";

/** An engine reading: like a kit's (id, the in-game test that decides it, question, default, readings), with no operator. */
export type EngineAssumption = KitAssumption;

export const ENGINE_ASSUMPTIONS: readonly EngineAssumption[] = [
  {
    id: "control-immunity",
    test: "104",
    question: "Which enemies ignore a freezing control status's freeze (Si's Immobilization, Tangtang's OLDEN STARE)? An immune enemy's clock runs on; only the freezing operator's own debuffs on it are held (timeline/clock.ts controlImmune, actions.ts runTriggers).",
    default: "listed",
    readings: {
      listed: "the enemies packages/data/src/enemyFacts.ts lists from the logs; every other enemy freezes, bosses too (the owner, test 104, 2026-11-16)",
      bosses: "every Boss (rank 2) is immune, every other enemy freezes (the engine until 2026-11-16)",
      none: "every enemy freezes",
      all: "no enemy freezes: only the freezing operator's own debuffs are held",
    },
  },
  {
    id: "buff-in-stop",
    test: "18",
    question: "Is a buff created while a time stop or slow-down runs held by the rest of it, as the buffs already running are (timeline/clock.ts heldFromNow, actions.ts addBuff)?",
    default: "held",
    readings: {
      held: "held: its timer starts when the world's clock runs again (Laevatain's Twilight, created at her ultimate's frame 0, lasts 15 s after her own stop: every closed Twilight window in the logs ends later than 15 s from the press allows; Typhoeus's Hail of Arrows window created inside Gilberta's and Arcane's stops, d9e59d0fb737) (2026-11-18)",
      ultimates: "held by the rest of a running ultimate's time stop, not by a combo's slow-down (measured 2026-11-18 against held: development plain 50.0 → 49.8%, hold-out 66.1 → 65.9%, 11 development logs worse, 3 better)",
      runs: "runs: its timer starts at once; only a stop that begins later holds it (the engine until 2026-11-18)",
    },
  },
  {
    id: "status-in-stop",
    test: "18",
    question: "Is an enemy status (Corrosion, Electrification, Combustion, Solidification) applied while a time stop or slow-down runs held by the rest of it, as a buff created then is (buff-in-stop; timeline/clock.ts holdNewStatuses)?",
    default: "held",
    readings: {
      held: "held: its timer and ramp start when the world's clock runs again, as buff-in-stop's `held` for buffs: one world clock (2026-11-23, measured against runs with Liino's combo placed from its stop's end: development plain 60.0 → 60.1%, hold-out 70.0 → 70.1% (5 better, 0 worse); 9090afbacec9 +9 plain (Perlica's Electrification applied inside Liino's combo slow-down, listed to 16 s), fc63a2001251 +4, 3f78ceb15bc3 −2)",
      runs: "runs: its timer and ramp start at once; only a stop that begins later holds it (the engine until 2026-11-23)",
    },
  },
  {
    id: "combo-reset",
    question: "Does a global dilation back to scale 1 (TimeDilationAction, curve RESETto1: Arcane's combo at its frame 9) end the running slow-downs of its priority, its own and a teammate's combo slow-down (timeline/clock.ts cutAtResets, resetSlowdowns)? The game keeps one dilation per priority tag (the reset would do nothing under the lowest-scale rule).",
    default: "reaches",
    readings: {
      reaches: "it ends them, and one of its priority that starts before it (a teammate's combo pressed inside her first 9 frames) ends there too, not holding her, as the log tools' stop lists cut it (withResets): 9555de54bb3d at 31.73 s (Xaihi's 27-frame combo slow-down 7 frames after Arcane's start), her Imprisonment burst 1.46 s after her cast as with no teammate's combo (81.53 s: 1.48 s; held 1.84 s), and the hits after it with her Susceptibility and Gear set bonus as logged; 791020039384 at 4.90 s (Ardelia's), 1d9198480e75 at 50.30 s (Typhoeus's: Liino's volleys on time, 0.5 s early held) (2026-11-23, measured: development 5 better, 3 worse, plain 65.7 → 65.8%; hold-outs 1 better, 1 worse)",
      resets: "it ends the slow-downs running when the resetting cast starts: Arcane's combo holds the world 9 frames, and a combo slow-down running at her frame 9 ends there (Corrosion's ramp in 3f78ceb15bc3's and 4a64e58e75ad's openers, Gilberta's, Si's and Arcane's combos: the lowest-scale rule holds 0.93 s and 0.91 s where the steps allow 0.73 s and 0.75 s; with the reset 0.72 s and 0.74 s); one starting after her cast but before her frame 9 runs whole (the engine 2026-11-23, before `reaches`)",
      none: "it does nothing: every slow-down runs its length, the lowest scale counting where they overlap (the engine until 2026-11-23)",
    },
  },
  {
    id: "freeze-ramp",
    test: "104",
    question: "Does a freeze (a control status that stops the enemy's clock: Si's Immobilization, Tangtang's stare) hold the enemy's Arts reaction statuses (Corrosion's ramp and end, Combustion's ticks and end, Electrification, Solidification), as it holds the operators' debuffs on it (timeline/actions.ts runTriggers)?",
    default: "statuses",
    readings: {
      statuses: "none of them is held, ramp, ticks or end (clock.ts statusesRunOn): Corrosion's ramp runs on (reading `runs`' logs) and its end too, zmdlogs-489c0be3e162's from 13.13 s gone by 49.22 s where Si's Immobilization at 43.6 s held the replay's to 49.47 s, the Vulnerable run, the ramp, Rossi's bleed and the Combustion ticks there asking about 1 s of hidden hold the held end left no room for (plain 488 → 632); Combustion's ticks run on, f978430a083a's at 57.80 and 58.80 s across Si's Immobilization at 57.6 s (2026-11-25). Against, weakly: db8711232de9's Corrosion still acts at 55.31 s, 0.58 s past this reading's end, in a Stagger whose Combustion ticks come every ~1.5 s (an enemy-clock delay the placement can't place there). Electrification and Solidification: no log decides them",
      runs: "Corrosion's ramp runs on through it, its end and the other statuses held (the engine until 2026-11-25): the log's ramp steps across Si's Immobilization in f978430a083a at 57.6 s allow at most 0.51 s of hold in its 1.5 s, a7a7a40c97ed at 18.1 s 0.68 s, Tangtang's in 791020039384 at 47.8 s about 0.7 s of 4 s (2026-11-23)",
      held: "held with the enemy's clock (the engine until 2026-11-23)",
    },
  },
  {
    id: "combustion-snapshot",
    question: "When does a Combustion take the attacker side its ticks deal with (DamageAction takeAtkSnapshot: ATK, DMG bonus, Amp; status.ts ActiveStatus.snapshot)? The enemy's side is read at each tick either way (timeline/advance.ts, the statusTick step).",
    default: "last-tick",
    readings: {
      "last-tick": "at its application, then again at each tick for the next one: a tick deals with its owner's side as it was at the tick before (pending/zmdlogs-458b03609665.json, Wulfgard's Combustions: 85.70 s ×1.3 only, though Akekuri's ATK came at 84.37 s, then 86.69 s with it; 230.62 s with Akekuri's potential ATK the tick before lists, gone from its own listing; 232.58 s without) (2026-11-23)",
      application: "at its application only (retaken after the triggers on its own reaction: c7790d76a4f0), the engine until 2026-11-23",
    },
  },
  {
    id: "battle-sub-skills",
    test: "29",
    question: "Does a battle-type sub-skill's cast (SkillData normalSkillSubType 1: Si's Initial and Final Stroke, Liino's End Stance, Camille's, Mi Fu's and Purrchena's follow-ups) count as a battle-skill cast for triggers that listen by skill type (CheckSkillType [2]: Type 50 Yinglung's Edge, talents on a battle-skill cast)? Link isn't part of it.",
    default: "count",
    readings: {
      count: "it counts: the data's skill type is battle (the engine until 2026-11-18)",
      "main-only": "only the battle skill itself counts (normalSkillSubTypeFilter 0 read as the main skill only)",
    },
  },
  {
    id: "teammate-pause",
    test: "101",
    question: "How long does a teammate (an operator not controlled) pause after a full basic-attack chain (timeline/teammates.ts)?",
    default: "6.5s",
    readings: {
      "6.5s": "6.5 s: the share of free time the logs show teammates attacking (test 101, 2026-11-16)",
      "3.5s": "3.5 s: the median of the logs' gaps over 1.5 s alone (the calibration of 2026-10-28)",
    },
  },
  {
    id: "stagger-recovery",
    test: "110",
    question: "How long does a Stagger last past the enemy's PoiseRecTime (attribute 21 × 31) and the time stops in it (timeline/resources.ts staggerFrames)?",
    default: "2s",
    readings: {
      none: "no longer: PoiseRecTime on the enemy's clock (the data)",
      "2s": "2 s more on the enemy's clock, a recovery the data doesn't give (the logs' median past PoiseRecTime and the stops, 2026-11-18)",
    },
  },
  {
    id: "combo-window-count",
    test: "10",
    question: "When several events open (or refresh) a combo window, which count does the combo read (ValueExpr eventCount; Si's final hit: the infliction stacks consumed): the highest or the latest (timeline/actions.ts openCombo)?",
    default: "highest",
    readings: {
      highest: "the highest count of the events that opened it (Si's description: \"highest stacks\")",
      latest: "the latest event's count",
    },
  },
  {
    id: "hidden-holds",
    test: "111",
    question: "What holds the operators' buffs and the enemy's timers past their modelled end in some windows (docs/open-problems.md \"The buff clock\")? The logs show unlogged world holds on one clock per fight, of about a perfect dodge's 0.512 s (enemy tick series, never while the enemy is Staggered), and longer pauses. The log check's replay can't see them; this decides whether it places them from the log's clocks (packages/logs holds.ts) and takes a decided buff's end from the log's listing where that runs later (holdinputs.ts heldToLoggedEnds). Simulations place dodges themselves (--dodge) and don't read it.",
    default: "placed",
    readings: {
      placed: "the fight's hidden holds placed once from every clock the log shows (its buffs' runs against the replay's own expiries, the enemy's tick series; none while Staggered; the least total hold, midway between its earliest and latest placement: packages/logs holds.ts placeHolds) and held on the world's clock for every timer (timeline/clock.ts holdWorld: buffs, the enemy's statuses and debuffs, combo windows; not cooldowns, which the perfect dodge's slow-down doesn't hold, nor the operators' own timing, which is the log's), then `log` on top; measured against log 2026-11-23: development plain 59.9 → 62.6%, mismatch 16.4 → 15.6%, hold-outs 69.6 → 69.9%",
      log: "a buff the log lists past the replay's expiry (a single run from its application, not refreshed, no hit of a holder past the expiry without it) runs on to its last listed hit, up to 40% of its life (HIDDEN_HOLD_SHARE); measured against none 2026-11-22: all but the hold-outs plain 55.7 → 57.5%, mean |damage error| 8.3 → 8.1%; the hold-outs unchanged",
      holds: "the placed holds alone, without `log` (what the holds do by themselves)",
      none: "the replay's own expiry: holds only by the casts it places (the replay until 2026-11-22)",
    },
  },
  {
    id: "stagger-holds",
    question: "May the hidden holds (hidden-holds `placed`) rise while the enemy is Staggered? No dodge is possible then (a Staggered enemy doesn't attack), but the enemy's tick chains inside the log's Stagger come late by about a fifth of what the combos' stops hold where a combo falls (3.43 s over 15.36 s held, 87 pairs), on time where none does (30 pairs, 0.02 s): a combo slow-down holds more than its stop list says (docs/open-problems.md \"The enemy's clock\"). Read only by the log check's replay (packages/logs holds.ts comboHoldSpans).",
    default: "none",
    readings: {
      none: "no hold while the replay's Stagger lasts (the placement until 2026-11-26)",
      combos: "inside the Stagger, holds only within a combo's stop, up to half its own hold (Σ 1 − scale) there",
      "combos-full": "the same, up to its whole own hold",
    },
  },
  {
    id: "pause-holds",
    question: "May the hidden holds (hidden-holds `placed`) rise in an away stretch (no logged hit by anyone for ENEMY_AWAY_MS or more) that a Stagger covers? A Staggered enemy doesn't attack, so no dodge holds the world there (stagger-holds); but a whole-game pause the log's clock runs through holds every timer, the Stagger's own included. Read only by the log check's replay (packages/logs holds.ts withoutGaps).",
    default: "away",
    readings: {
      none: "no: the Stagger is still from its start to its end (the placement until 2026-11-26)",
      away: "yes: each away stretch is cut out of the Stagger's still span, and the clocks place what they ask there. pending/zmdlogs-4d60e7fe92c2.json (eny_0120_klbear_tower015) 117.22–124.45 s, inside the log's Stagger 115.75–133.34 s: its Stagger lasts 7 s longer than the engine's, and Perlica's Wild Wanderer team buff, Arcane's two Solemn Phalanx debuffs on the enemy, Perlica's Qingbo layer and Liino's beats all run 5.5–7 s past their ends across it; 5.4 s placed there, 13 clocks spanning it, earliest and latest within 0.4 s. Measured 2026-11-26 against `none`: development plain 69.0 → 69.6% (4d60 696 → 806, −4.1 → −1.5%), no other log moved, hold-outs unchanged",
    },
  },
  {
    id: "enemy-away",
    question: "Is the enemy there in a stretch of the fight where the log has no hit at all for 6 s or more (ENEMY_AWAY_MS)? Read only by the log check (packages/logs enginecheck.ts fightTotals, enemyAwaySpans: the replay's TimelineScenario.enemyAway), not by simulations: a stage's boss phase isn't the team's to model.",
    default: "absent",
    readings: {
      away: "no: the enemy is out of reach (a boss phase), and the replay's landings there that stand for no logged hit, more than 0.3 s inside it, aren't counted in the simulated total, as a fixture's hand-written `absent` landings aren't. The logs' gaps fall apart at 6 s (development logs 2026-11-23: 18 of 4–6 s, then 1 of 6–7 s and 30 of 7–46 s, in 8 fights against Si (eny_0134_jsspsi, 19 gaps: about 20–24 s, then 13–14 s, a phase each fight) and 4 against eny_0125_fdcentur (7), eny_0128_babyents_hdg031 (3) and eny_0120_klbear_tower015 (2)), and the team still presses there (pending/zmdlogs-d774d0ce7bd3.json 30.6–54.6 s: Liino's ultimate and battle skills, Arcane's combo; Zhuang Fangyi's Empyrean strikes and finale, 0.78M, land there in the replay alone) (2026-11-23)",
      counted: "yes: every replay landing up to the log's last hit counts (the totals until 2026-11-23)",
      absent: "no, and the replay's enemy isn't there either (TimelineScenario.enemyAway, timeline/landing.ts landHit): a hit landing from the frame after the stretch's last logged hit to the frame before the next lands on nothing (no damage, application, Stagger, enemy-side buff or hit event); an Arts Burst still lands (its effects come: 4a64's Nature burst at 29.30 s, 0.15 s into its stretch, gave Arcane's weapon debuff the log lists from 51.31 s; held back, 4a64 lost 6 plain), only its damage left out of the totals; what it gives its own team still comes (d774's Liino: her battle skill at 49.86 s, the enemy away 30.6–54.6 s, puts her stance's ATK on the team, as the log lists it after; 9c6e's three the same). The log records every hit that lands, so the totals leave out every landing no logged hit stands for from the stretch's last logged hit's frame (the enemy leaves with it: 4a64's Rossi slash2 at 29.15 s, Si's first life's end, has no Seething Blood extra at its ms, every other slash2 has one) to its next. 0c14's Si (pressed at 139.68 s in the stretch 134.97–152.91 s): no Artful Intent, Cryo or Jade Vessel run in the game, none in the replay now. Measured 2026-11-26 against `away`: hold-out mean |damage error| 8.4 → 7.5%, development 4a64 better (+2.9 → +1.6%), d774 +7.1 → +4.7% (Zhuang Fangyi's strikes 0.2–0.3 s into its stretches, unlogged); a9d7 −1.8 → −2.2% (Chen's ultimate final at 159.33 s, 0.74 s into its stretch, no longer refreshes her Slashing Edge, which the log lists to 169.40 s: a hidden hold, decided 2026-11-26 from the log: the ~0.4M final isn't logged where every other final of hers is, and a landing that refreshes the edge deals damage, docs/open-problems.md \"The damage factors\"), 9c6e −13.1 → −13.2%",
      "absent-edge": "as `absent`, the replay's enemy away only from 0.3 s inside the stretch's ends, as the totals leave landings out. Measured 2026-11-26 against `away`: hold-out 8.4 → 7.5% as `absent`, development unchanged, d774's strikes 0.23 and 0.27 s into its stretches counted (replay-only, 0.14M)",
    },
  },
  {
    id: "hitless-presses",
    question: "Is a logged press of a skill whose hits the log shows elsewhere, but none of its own this time, made (the enemy there, not an away stretch's `unseen` press)? The press may have done nothing (a variant the slot held, a press the game dropped), or landed without its damage being logged. Read only by the log check's replay (packages/logs replayrun.ts inferredPress).",
    default: "inferred",
    readings: {
      skipped: "never: the slot held a variant, or the press did nothing (the replay until 2026-11-26)",
      inferred: "made when the log lists, on its first hit after the press's landing (within 1.5 s), a run of a decided game buff starting there that the replay gives with the press and not without it: pending/zmdlogs-0c14fb3ce77d.json, Si's battle skill at 153.99 s (Jade Vessel's enemy_vul from 155.79 s, which only her battle skill's Immobilization gives; her Artful Intent then ending at the log's 181.00 s), and 891566c224f8's Liino at 111.23 s (her stance's ATK listed from 111.65 s, the fight's last 0.3 s). Only with the log's own cast event (Alesh's 0c14 combo at about 12.5 s has none: not made). The press's own landings stand for no damage (the log would show it): the totals leave them out. Measured 2026-11-26 with enemy-away `absent` against `skipped`: 0c14 plain 172 → 293 (Jade Vessel on 160 hits, Rossi's 165.49 s Lift, the Endministrator's Crush at 4 stacks), hold-out plain 80.3 → 80.6% (one log +12 plain, its hits closer, its total further: 7.5 → 8.4% the hold-out mean; as 0c14's −3.4 → +2.7%, the readings that now fit raise the total onto what the replay over-predicts elsewhere: 0c14's Rossi, 58 replay-only landings, 0.30M)",
    },
  },
  {
    id: "listed-casts",
    question: "Is a cast the log shows neither by a hit nor by a cast event, only by a buff one of its hits alone gives (a run of it starting where no replayed cast could have landed that hit), made? The game may have landed the cast's hits without the log recording them, or the buff came from something no kit models. Read only by the log check's replay (packages/logs castassembly.ts castsFromHitBuffs).",
    default: "inferred",
    readings: {
      none: "never: a cast is made only from its logged hits or cast event (the replay until 2026-11-26)",
      inferred: "made, timed so that hit lands at the run's `since` (on the path that has it: a chance jump's taken), when exactly one kit hit of the team applies the buff (no trigger or other hit), no cast of its skill starts from 2.5 s before to the run, and its operator has no logged hit from the cast's start to the hit; its own landings stand for no damage (the totals leave them out). pending/zmdlogs-0c14fb3ce77d.json: Alesh's combo at about 12.0 s, its Rare Fin slam's P3 team ATK listed from 13.25 s and its hook's natural SP the second Thermite Cutter layer from 12.71 s, with no hit or cast event of it",
    },
  },
  {
    id: "combo-curve",
    question: "What is the ComboSkill time-dilation curve every combo's global slow-down follows (TimeDilationAction useCurveKey ComboSkill: an asset the game data names but doesn't hold)? The compiler samples the guess (packages/data skillData.ts slowdownOf) and keeps the curve's name on the timing; a reading resamples it for the timeline (createContext) and the log tools' stop lists (timeline/curves.ts withCurveReading). Simulations read it too.",
    default: "guess",
    readings: {
      guess: "0.01 for 40% of its duration, then a linear ramp to 1 at 93% (since batch 1; the logs' Corrosion ramps, buff ends and landings fit it)",
      flat: "0.01 for its whole duration (measured 2026-11-26 as a patch, docs/tried/2026-11-26-combo-curve-flat.diff: verified plain 78.0 → 73.0%, development 69.0 → 68.0%, hold-out 79.0 → 76.7%)",
      middle: "0.01 to 70% of its duration, then a linear ramp to 1 (the same diff: verified 75.6%, development 68.6%, hold-out 77.8%)",
    },
  },
  {
    id: "combo-operator-hold",
    question: "Does a combo's slow-down hold the operators (their casts' hits on the way, delayed actions, the Arts Bursts on their clocks) longer than its scales say, while the world's clock (buffs, the enemy's statuses) follows them? Across a combo's stop an operator's own cast runs late by about 140 ms (4.2 frames) a combo, the enemy's ticks by 57 ms (1.7 frames), bursts 181 ms (docs/open-problems.md \"The enemy's clock\"); the operators' excess sits in the stop's first half, not after its end nor before its start (scripts/probes/combo-hold/edges.ts). Simulations read it too (timeline/clock.ts slowDown).",
    default: "none",
    readings: {
      none: "as its scales say (the engine until 2026-11-26)",
      "3f": "3 frames more on every operator it holds at all (measured 2026-11-26 against `none`: verified plain 78.0 → 77.4%, development 69.0%, hold-out 80.6 → 80.5%, earlier pending 67.3 → 66.4%)",
      "4f": "4 frames more (verified 77.1%, development 69.0%, hold-out 80.5%, earlier 66.4%: 9a80 +4, 9c0b +3 and c6d8 +13 plain against 4bfc −92 and 3aa6 −33)",
      "6f": "6 frames more (verified 76.4%, development 68.9%, hold-out 80.4%, earlier 66.3%)",
      "plateau-0.6": "the operators held by their own curve, 0.01 to 60% of the combo's slow-down, then a linear ramp to 1 at 93% (the world keeps combo-curve's: 0.01 to 40%); about 2.4 frames more on a 24-frame combo, in proportion to its length",
      "plateau-0.7": "the same to 70% (about 4 frames more on a 24-frame combo)",
      "plateau-0.5": "the same to 50% (about 1.2 frames more on a 24-frame combo)",
      flat: "the operators held at 0.01 for the whole combo slow-down (the world's curve unchanged)",
    },
  },
  {
    id: "unlogged-tails",
    question: "Did a cast whose landings after its last logged one are none of them in the log, the enemy there and the log recording, end there (a dodge, a swap, a hit on its operator: inputs no log records), or did those landings land unlogged? The logs record every landing that lands (enemy-away). Read only by the log check's replay (packages/logs replayrun.ts tailCuts: ReplayCastOptions.endsAt).",
    default: "cut",
    readings: {
      kept: "the cast plays its whole path (the replay until 2026-11-26)",
      cut: "a battle skill, combo or ultimate ends the frame after its last logged landing (each of its logged landings its own, not a variant's) when the log has no hit of its operator's casts that another cast doesn't hold from there to 1.5 s after its first later landing, that landing is outside the away stretches and the fight's last 1.5 s with a logged hit of anyone within 1.5 s after it, and no decided game buff the replay starts in the tail is listed as a new run within 1.5 s (the earliest such cast first, the replay made again after each): pending/zmdlogs-0c14fb3ce77d.json, Rossi's battle skill at 35.40 s (its two charge hits logged, no Lift at frame 35, no wolves, no bleed: the Vulnerable stack the Lift would add isn't there at 53.57 s, where the log has her Lift's hit but neither its Lift status nor the follow-up; with it the Endministrator's combo the Lift set off and its Essence Disintegration ATK go, and 43.5–60.2 s read plain). Measured 2026-11-26 against `kept`: 0c14 plain 293 → 336 (its total +2.7 → −3.2%: its hits that now fit were over-predicted with what the tail gave, its Rossi and Si under-predicted elsewhere), development plain and verified unchanged (9c6e −13.2 → −13.5%, Liino's combo hit2 at 48.73 s out of an under-predicted total), earlier pending 67.3 → 67.7%, hold-out plain unchanged, mean |damage error| 8.4 → 8.3% (1 better, 2 worse, totals only). Without the listing check and the fight's-end rule the first cut lost db87 15 plain (Camille's ultimate, whose gear-set and weapon buffs the log lists after its unlogged hits) and 2fd9's killing Crush",
      "cut-all": "as `cut`, basic attacks too (measured 2026-11-26 against `kept`: plain as `cut`; mean |damage error| development 7.0 → 6.9%, hold-out 8.4 → 8.3%, earlier 4.0 → 4.0%, 8 development logs' totals closer, 6 further)",
    },
  },
  {
    id: "totals-crits",
    question: "How does a fight's total count a matched hit whose crit the log doesn't give and whose value neither of its readings (crit, non-crit) gives exactly? Read only by the log check's totals (packages/logs enginecheck.ts engineReadings, critFromValue), not by simulations.",
    default: "read",
    readings: {
      expected: "at expected crits (the totals until 2026-11-26; accuracy plan A3: counted as non-crits they ran low)",
      read: "at the reading its value is within ×1.08 of while the other isn't (a crit's factor is ×1.5 or more, so the value says which), else at expected crits: pending/zmdlogs-0c14fb3ce77d.json, Rossi's first ultimate (25.2–27.7 s), ×1.032 below the log on every stab (Alesh's weapon layer the replay lacks), 17 of its 28 crit-unknown landings crits by their values (18.5 expected), its two finals among them (326,856 and 108,952, counted at expected crits as 250,328 and 83,443). Measured 2026-11-26 against `expected`: mean |damage error| verified 2.0 → 1.5%, development 7.0 → 6.9%, earlier pending 3.9 → 3.6% (0c14 −2.8 → −1.3%, b6aa −5.5 → −2.3%, 99fb −1.9 → −0.3%), hold-out unchanged; plain counts unchanged (a totals rule only)",
    },
  },
  {
    id: "enemy-hp",
    question: "What is the enemy's HP over a logged fight, for the hits whose damage depends on it (enemyHpBelow: Chen Qianyu's P1 Shadowless, Alesh's P5 ultimate)? Read only by the log check's replay (packages/logs replayrun.ts loggedEnemyHp), not by simulations: a simulation's scenario says the HP (TimelineScenario.enemyHp).",
    default: "kill",
    readings: {
      kill: "a fight that ends in a kill (its last logged hit capped) has the logged total as its HP, the stage's scaling of Max HP included, in lives of about Max HP split where the enemy went away as the damage reached a multiple of it (Si, eny_0134_jsspsi: two lives); a fight whose total is the data's Max HP as under max-hp. Development logs 2026-11-24: Chen's hits in d4fb below half the logged total ×1.16 the reading without Shadowless (89 hits), above it ×1.00 (79); Alesh's ultimate ×1.5 exactly where a life's HP was below half in a9d7 (6 of 6), ad7f, 4e36 (2 of 2 each), 0c14 (2 of 3); a27b (the data's Max HP) fits Shadowless on below half and off above, both sides (in-game test 69)",
      "max-hp": "only a fight whose logged total is the data's Max HP (one enemy, one life) has an HP; any other none, and a condition on it never holds (the replay until 2026-11-24)",
    },
  },
  {
    id: "trigger-cooldowns",
    question: "Which clock does a kit trigger's cooldown run on: the world's, held by time stops, slow-downs and the replay's placed hidden holds as buffs are, or raw time as a skill's cooldown (timeline/clock.ts shiftTriggerCooldowns)? The kit compiler says per trigger from the game's mechanism (KitTrigger.cooldownClock; packages/data kits.ts cooldownClockOf): a CD timer (AddGlobalCDTimer) or a `…_cd` buff the world's, a timed marker (CreateTimedMarker) raw. A timed marker's clock isn't decided by a log: with `world` for every trigger no development log moves beyond what the CD timers move.",
    default: "kit",
    readings: {
      kit: "each trigger's own clock (KitTrigger.cooldownClock; 2026-11-24): the world's for Swordmancer, Mi Fu's P3 shield ATK, Laevatain's Final Strike absorb, Antal's talent heal and the gear and weapons whose data has a CD timer or a cooldown buff (suit_spellburst, wpn_claym_0004, _0006, _0007); raw for the timed markers (Glorious Memory's 0.5 s layers, Xaihi's crystal, Sundering Steel's marker and 19 more) and the 8 cooldowns the data doesn't show. Measured against `raw`: the same logs move as under `world` (earlier pending 04d4, 2fd9 plain 246 → 250, d4fb, de6a better; fc63's totals; two hold-outs' totals worse, both from Swordmancer: replay-only 4.9 → 4.8%, log-only unchanged, so the procs it drops are ones the game didn't deal)",
      raw: "raw time for every trigger, as skill cooldowns (the engine until 2026-11-24)",
      world: "the world's clock for every trigger: every slow-down after the trigger fired, and the log replay's placed hidden holds, push its ready frame back by the frames they hold the world. Swordmancer's 15 s (suit_phy01, AddGlobalCDTimer): every wearer's Physical status with no logged proc came under 15 s of the world's time after the last proc (de6a 51.79 and 137.84 s at 15.01 and 14.98 s, 18.8 and 20.5 s of log time; d4fb 53.98, 126.13 s; fc63 59.11 s; d4fb 97.05 s at 16.67 s the one exception), every proc past it (17.8 s and more): scripts/probes/cooldowns/physuit.ts; Mi Fu's P3 ATK in 2fd9 (69.1–70.1 s, 3 mismatches plain). Measured 2026-11-24 against raw: development unchanged but fc63's totals, earlier pending 4 better (04d4, 2fd9 plain 246 → 250, d4fb, de6a +1.0 → −0.4%), hold-outs 2 worse by their totals (aggregates unchanged)",
    },
  },
  {
    id: "burst-stops",
    question: "Which time stops and slow-downs hold an Arts Burst's delay (the 1 s after its infliction: timeline/clock.ts operatorClockDue, slowDown)?",
    default: "all",
    readings: {
      others: "every one but its own operator's, as her clock (the engine until 2026-11-24): Arcane's WILL touch at 4.95 s in zmdlogs-b7b3762d5da8 bursts in the replay at 5.97 s inside her own ultimate's stop (5.60–7.17 s); the game's burst is at 10.34 s",
      all: "every one, her own ultimate's stop too (2026-11-24): a burst on its way when her ultimate's stop begins, or due inside it, comes that much later. b7b3's burst then comes after Arcane's and Tangtang's stops, at 10.34 s as logged; over Arcane's 130 logged bursts in the development logs, within 150 ms of the replay's 89 → 94, with none near 23 → 20, replay-only 24 → 21 (scripts/probes/bursts/arcane-bursts.ts); Perlica's and Xaihi's one each better, no operator's worse. Measured against `others`: verified b7b3 plain 44 → 47; development 489c, 984748, 9c0b, c779 better, 79cc one plain fewer (its 24.23 s burst: Ardelia's combo, placed from its travelling projectile 0.8 s late, holds it); hold-outs 2 better (plain +2), 1 other (a status kind's share), none worse; earlier pending b6aa better, 012a 0.6 → 0.7%, c3c7 closer per hit",
      ultimates: "the ultimates' time stops only, her own too; no combo slow-down. Measured 2026-11-24 against `others`: hold-outs 4 worse, 1 better; development 6 better, 4 worse (e82d plain 21 → 11, c6d8 112 → 104, dbae): combo slow-downs do hold bursts",
    },
  },
  {
    id: "window-reaction",
    question: "Which element does an `element: \"window\"` application (Arcane's WILL combo touch, in-game test 33) take when the event that opened the window was an Arts reaction: the infliction the reaction consumed, or the element it applied?",
    default: "consumed",
    readings: {
      consumed: "the consumed infliction (round 6, 2026-11-12; round 5 ruled the applied element out on b74c, a multi-target log: Nature onto Cryst, then a Cryst burst)",
      applied: "the reaction's own element (2026-11-25): pending/zmdlogs-fc63a2001251, the touch at 81.47 s after Arcane's Nature onto Perlica's Pulse (Corrosion, 80.40 s): Typhoeus's power shot at 84.13 s consumed a Nature stack (its burst ×1.303 the replay's, enchence_burst_damage_rate 1.3) and Arcane's array burst on nothing. Measured: fc63 plain 511 → 549, mismatch 179 → 97, but 9a80 plain 227 → 217 and fc63's total 3.4 → 5.3%",
    },
  },
  {
    id: "finisher-stagger",
    question: "Does a finisher's hit that lands after the Stagger's end still deal with the Stagger's parts (its multiplier, DamageToBrokenUnitIncrease and the modifiers of Staggered enemies; timeline/landing.ts), as the Stagger a finisher needs to be cast?",
    default: "cast",
    readings: {
      cast: "every finisher hit deals as on a Staggered enemy (2026-11-24): pending/zmdlogs-7e19489ae503, Ember's finisher hit_2 at 33.15 s, after Chen's ultimate stop, ×1.564 the unstaggered reading, which is ×1.43 (her first hit's Staggered parts: the multiplier 0.3 and DamageToBrokenUnitIncrease 0.27) × the ×1.096 her first hit at 30.86 s has; the log lists no poise_break buff on it (its Stagger ended at 30.86 s) and Chen's ultimate hit at the same ms is plain unstaggered. The one finisher in the development logs with a hit after its Stagger's end: the other 38 multi-hit finishers' hits all list the Stagger",
      hit: "each hit as the enemy is at its landing (the engine until 2026-11-24)",
    },
  },
  {
    id: "finisher-ultimate",
    question: "Does a finisher's disable-cast buff (buff_common_power_attack_disable_cast_skill, the finisher's frames 0 to its last hit or past it) hold the operator's ultimate, as it holds her battle skill and combo (timeline/timing.ts afterCantCast)? The buff's tags include battle-skill (-1486085048, buff_common_disable_normal_skill's) and dash (-1601691447, buff_common_disable_dash's) and one no other buff has (-496376350); Typhoeus's hover, which allows her combo and ultimate, carries the other two.",
    default: "cuts",
    readings: {
      cuts: "it doesn't: an ultimate pressed inside it starts at once and cuts the finisher, whose hits still to come never land (every logged ultimate inside one: pending/zmdlogs-458b03609665.json, Laevatain's at 156.27 s, 20 frames before frame 42, and 223.17 s, 3 frames before, no hit_2 logged either time; pending/zmdlogs-d5720d9ceb94.json, Rossi's at 121.89 s, placed from its own hits, 17 frames into her finisher, whose window runs to 65: neither the frame-15 hit nor hit_2 logged) (2026-11-23)",
      held: "it holds every cast, the ultimate too (the engine until 2026-11-23)",
    },
  },
  {
    id: "stagger-freeze",
    test: "110",
    question: "Does a freezing control status (Si's Immobilization, Tangtang's OLDEN STARE, Rossi's ultimate) hold a running Stagger's end (timeline/actions.ts runTriggers)?",
    default: "held",
    readings: {
      held: "held: the Stagger runs on the enemy's clock, which the freeze stops",
      runs: "runs on: the freeze holds the enemy's other timers, not its Stagger",
    },
  },
];

/** The reading of an engine assumption a scenario runs under: its options' `assume`, else the default. */
export function engineReading(scenario: Pick<TimelineScenario, "options">, id: string): string {
  const a = ENGINE_ASSUMPTIONS.find((x) => x.id === id);
  if (!a) throw new EngineError(`no engine assumption ${id}`);
  return scenario.options.assume?.[id] ?? a.default;
}
