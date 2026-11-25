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
    question: "What holds the operators' buffs and the enemy's timers past their modelled end in some windows (docs/open-problems.md \"The buff clock\")? The logs show unlogged world holds on one clock per fight, of about a perfect dodge's 0.512 s (enemy tick series, never while the enemy is Staggered), and longer pauses. The log check's replay can't see them; this decides whether it places them from the log's clocks (packages/logs holds.ts) and takes a decided buff's end from the log's listing where that runs later (buffreplay.ts heldToLoggedEnds). Simulations place dodges themselves (--dodge) and don't read it.",
    default: "placed",
    readings: {
      placed: "the fight's hidden holds placed once from every clock the log shows (its buffs' runs against the replay's own expiries, the enemy's tick series; none while Staggered; the least total hold, midway between its earliest and latest placement: packages/logs holds.ts placeHolds) and held on the world's clock for every timer (timeline/clock.ts holdWorld: buffs, the enemy's statuses and debuffs, combo windows; not cooldowns, which the perfect dodge's slow-down doesn't hold, nor the operators' own timing, which is the log's), then `log` on top; measured against log 2026-11-23: development plain 59.9 → 62.6%, mismatch 16.4 → 15.6%, hold-outs 69.6 → 69.9%",
      log: "a buff the log lists past the replay's expiry (a single run from its application, not refreshed, no hit of a holder past the expiry without it) runs on to its last listed hit, up to 40% of its life (HIDDEN_HOLD_SHARE); measured against none 2026-11-22: all but the hold-outs plain 55.7 → 57.5%, mean |damage error| 8.3 → 8.1%; the hold-outs unchanged",
      holds: "the placed holds alone, without `log` (what the holds do by themselves)",
      none: "the replay's own expiry: holds only by the casts it places (the replay until 2026-11-22)",
    },
  },
  {
    id: "enemy-away",
    question: "Does the enemy take damage in a stretch of the fight where the log has no hit at all for 6 s or more (ENEMY_AWAY_MS)? Read only by the log check's totals (packages/logs enginecheck.ts fightTotals), not by simulations: a stage's boss phase isn't the team's to model.",
    default: "away",
    readings: {
      away: "no: the enemy is out of reach (a boss phase), and the replay's landings there that stand for no logged hit, more than 0.3 s inside it, aren't counted in the simulated total, as a fixture's hand-written `absent` landings aren't. The logs' gaps fall apart at 6 s (development logs 2026-11-23: 18 of 4–6 s, then 1 of 6–7 s and 30 of 7–46 s, in 8 fights against Si (eny_0134_jsspsi, 19 gaps: about 20–24 s, then 13–14 s, a phase each fight) and 4 against eny_0125_fdcentur (7), eny_0128_babyents_hdg031 (3) and eny_0120_klbear_tower015 (2)), and the team still presses there (pending/zmdlogs-d774d0ce7bd3.json 30.6–54.6 s: Liino's ultimate and battle skills, Arcane's combo; Zhuang Fangyi's Empyrean strikes and finale, 0.78M, land there in the replay alone) (2026-11-23)",
      counted: "yes: every replay landing up to the log's last hit counts (the totals until 2026-11-23)",
    },
  },
  {
    id: "enemy-hp",
    question: "What is the enemy's HP over a logged fight, for the hits whose damage depends on it (enemyHpBelow: Chen Qianyu's P1 Shadowless, Alesh's P5 ultimate)? Read only by the log check's replay (packages/logs buffreplay.ts loggedEnemyHp), not by simulations: a simulation's scenario says the HP (TimelineScenario.enemyHp).",
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
