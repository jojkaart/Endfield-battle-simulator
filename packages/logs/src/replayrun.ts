// One run of the replay (buffreplay.ts replayKitBuffs runs it, up to a few times): replayOnce steps the assembled
// casts (castassembly.ts) through the engine's timeline, making each (makeCast: which skill a logged cast is,
// replayedSkill, inferredPress, castFlag) and the casts the log needs that hit nothing (missedCasts), recording as it
// goes (replayrecord.ts; landingWatch for the pinned landings that left without landing); tailCuts reads a run for
// the casts the log ends early; loggedEnemyHp the enemy's HP the run's scenario takes. Split from buffreplay.ts
// (improvement round 14).

import {
  activeAt, advance, allActions, damageOptions, breakHold, breakHoldFrames, readingOf, holdWorld, ownHitsLanded, earliestStart, exclusiveUntil, Attr, setPoise, holdStagger, isStaggered, buffModifiers, createContext, refillPoise, skillAvailable, staggerFrames, FPS, init, replayCast, replayWindowCount,
  type ActiveBuff, type GameData, type LandedHit, type Modifier, type SkillType, type TimelineContext, type TimelineScenario, type TimelineState,
} from "@efsim/engine";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { awayWindows, enemyAwaySpans, killGaps, lastLifeKilled, stageScaledKill } from "./enginecheck.ts";
import { buttonVariants, loggedFrames, type Placement } from "./logcasts.ts";
import { replaySteps, stepWords, type LoggedStagger, type ReplayStep } from "./replaysteps.ts";
import { replayRecorder, type ReplayRecord } from "./replayrecord.ts";
import type { ReplayOptions } from "./buffreplay.ts";
import { type ReplayedCast, frameOf } from "./castassembly.ts";
import { endedWithTick, loggedTick } from "./holdinputs.ts";
import { breakHoldStarts } from "./holds.ts";

/** A logged cast the replay made against its kit (BuffReplay.castFlags). */
export interface CastFlag {
  readonly cast: ReplayedCast;
  /** The skill it was made as. */
  readonly skillId: string;
  /** Its frame in the replay. */
  readonly frame: number;
  /**
   * "forced": its kit says the skill isn't available then (KitSkill.available: a stance holds the slot), and no variant
   * is; "inside": the operator's running action can't be cut yet (its exclusive frames: the gates alone, earliestStart
   * with `at`), so the cast ended it early; "cuts": a legal interrupt that cancels hits of the running cast still due
   * (timing.ts ownHitsLanded), not against the kit but worth seeing (round 8: "inside" used to count these too).
   */
  readonly kind: "forced" | "inside" | "cuts";
  readonly why: string;
}

/** A cast that hit nothing the replay added (BuffReplay.missed). */
export interface MissedCast {
  readonly operator: string;
  readonly skillId: string;
  /** Its start, in ms. */
  readonly start: number;
  /** The logged cast that needs it: its placed skill and start (ms). */
  readonly need: { readonly skillId: string; readonly start: number };
}

/** The kit buffs a cast consumed (ActiveBuff with `cast`: they act on its hits only): their IDs (an ID per instance) and their modifiers on the caster's hits (buffModifiers). */
export interface ConsumedBuffs {
  readonly buffs: readonly string[];
  readonly modifiers: readonly Modifier[];
}

/**
 * The enemy's HP over the fight from the logged damage (TimelineScenario.enemyHp), in steps of 1% of its HP, under the
 * engine assumption enemy-hp. `max-hp`: only when the logged damage is the data's Max HP. `kill` (the default): also
 * a fight that ends in a kill (its last logged hit capped at the enemy's remaining HP, or its total a stage-scaled Max
 * HP: stageScaledKill), whose logged total is the
 * enemy's HP, the stage's scaling of Max HP included (tower015 ×7.6, tower016 ×5.5), split into lives of about Max HP
 * where the enemy went away (ENEMY_AWAY_MS) as the damage reached a multiple of Max HP (Si, eny_0134_jsspsi: two
 * lives, the 20–24 s away stretch starting at 1.000–1.074 × Max HP dealt in all eight development fights, the excess
 * over 2 × Max HP all in the first life). Each life's HP is the damage dealt in it. Chen Qianyu's P1 and Alesh's P5
 * read it (enemyHpBelow).
 */
export function loggedEnemyHp(data: GameData, fx: LogFixture, reading: string): TimelineScenario["enemyHp"] {
  const max = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp];
  if (!max || fx.hits.length === 0) return undefined;
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const total = hits.reduce((s, h) => s + h.value, 0);
  const last = (hits.at(-1) as LogHit).t;
  const capped = hits.some((h) => h.t === last && h.uncapped !== undefined && h.uncapped > h.value);
  if (Math.abs(total / max - 1) > 1e-3 && (reading !== "kill" || !(capped || lastLifeKilled(data, fx) || stageScaledKill(data, fx)))) return undefined;
  // Each life's first dealt damage (as a sum of the hits before it): an away stretch that starts once the damage has
  // reached j × Max HP, within the fight's excess over its whole lives (under 10% of Max HP).
  const lives = Math.floor(total / max + 1e-3);
  const excess = total - lives * max;
  const starts = [0];
  if (reading === "kill" && lives >= 2 && excess < 0.1 * max) {
    let dealt = 0;
    let i = 0;
    for (const w of awayWindows(fx)) {
      while (i < hits.length && (hits[i] as LogHit).t <= w.from) dealt += (hits[i++] as LogHit).value;
      const j = starts.length;
      if (j < lives && dealt >= j * max - 1e-3 * max && dealt <= j * max + excess + 5e-3 * max) starts.push(dealt);
    }
  }
  const out: { from: number; fraction: number }[] = [];
  let dealt = 0;
  let life = 0;
  let step = 100;
  for (const h of hits) {
    const next = starts[life + 1];
    if (next !== undefined && dealt >= next) {
      life++;
      step = 100;
      out.push({ from: Math.round((h.t * FPS) / 1000), fraction: 1 });
    }
    dealt += h.value;
    const from = starts[life] as number;
    const pool = (starts[life + 1] ?? total) - from;
    const fraction = Math.max(0, 1 - (dealt - from) / pool);
    if (Math.floor(fraction * 100) < step) {
      step = Math.floor(fraction * 100);
      out.push({ from: Math.round((h.t * FPS) / 1000) + 1, fraction });
    }
  }
  return out;
}

/**
 * Casts the log shows only by a buff's end: a logged hit of a trigger on the end of one of its operator's buffs
 * (`buffEnded`), where the kit ends that buff on a cast of a skill (a trigger on the cast with an `endBuff` of it), and no
 * cast of that skill is replayed from its delay plus LOGGED_CAST_MS before the end. Then a cast of the skill at the end
 * less the trigger's delay, made only if the buff is still active then (else its expiry explains the end). Si's Final
 * Stroke: its press isn't in the log's cast events, the Inksoul's burst after Artful Intent's end is (0eef2474a26f at
 * 10030 ms; accuracy plan A2).
 */
/** How much longer than a logged buff end the replay's buff must last for an inferred cast to be what ended it (castsFromBuffEnds). */
const EXPIRY_MARGIN_FRAMES = 6;

/**
 * The state at the log's start with a cast made before it (ReplayedCast.beforeLog): the cast made at frame 0 of a
 * timeline of its own and run as long as it ran before the log, then what it left of its operator's moved back that
 * much onto `st` (the buffs it made, what it still has to do, its action and cooldowns, its operator's stacks). Its hits
 * until then, the enemy, SP and energy stay `st`'s: the log shows none of them. So are the hits it launched before the
 * log and still on their way: the fight hadn't begun (a7a7a40c97ed: Liino's stance from about -2.2 s, its volley timer
 * from -0.7 s; the volley that tick launched, due at 0.1–0.4 s, isn't in the log, which has its first at 12.58 s, the
 * timer's next tick; a volley launches only while the squad is in a fight).
 */
function withCastBeforeLog(ctx: TimelineContext, st: TimelineState, c: ReplayedCast): TimelineState {
  const n = -frameOf(c.start);
  if (n <= 0) return st;
  const ran = advance(ctx, replayCast(ctx, st, c.operator, c.skillId, 0, {}), n);
  const back = (f: number) => f - n;
  const buffs = ran.buffs.map((b) => (st.buffs.includes(b) ? b : {
    ...b,
    appliedAt: back(b.appliedAt),
    expiresAt: back(b.expiresAt),
    ...(b.nextTick !== undefined ? { nextTick: back(b.nextTick) } : {}),
    ...(b.whileCasting ? { whileCasting: { ...b.whileCasting, until: back(b.whileCasting.until) } } : {}),
  }));
  const scheduled = [...st.scheduled, ...ran.scheduled.filter((x) => !st.scheduled.includes(x) && x.kind !== "hit").map((x) => ({ ...x, frame: back(x.frame), ...(x.launchAt !== undefined ? { launchAt: back(x.launchAt) } : {}) }))];
  const acting = ran.acting[c.operator];
  const moved = (a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, a[k] === v ? v : back(v)]));
  return {
    ...st,
    buffs,
    scheduled,
    casts: [...st.casts, ...ran.casts.slice(st.casts.length).map((x) => ({ ...x, frame: back(x.frame) }))],
    ...(acting ? { acting: { ...st.acting, [c.operator]: { ...acting, frame: back(acting.frame), ...(acting.skips ? { skips: acting.skips.map((k) => ({ ...k, at: back(k.at) })) } : {}) } } } : {}),
    readyAt: moved(st.readyAt, ran.readyAt),
    triggerState: Object.fromEntries(Object.entries(ran.triggerState).map(([k, v]) => [k, st.triggerState[k] === v ? v : { ...v, readyAt: back(v.readyAt) }])),
    stacks: { ...st.stacks, ...(ran.stacks[c.operator] ? { [c.operator]: ran.stacks[c.operator] as Readonly<Record<string, number>> } : {}) },
  };
}

/** How soon before a logged cast its operator's own follow-up cast of a skill with the cast's key is that cast (frames). */
const FOLLOW_UP_FRAMES = 10;

/**
 * The state without the follow-up casts its operators' timelines would make (a trigger's delayed `cast`) up to `until`
 * where a logged cast of the same operator, of a skill with its key, comes within FOLLOW_UP_FRAMES after: the logged cast
 * is that follow-up, a little later (dbaee23b801d: Typhoeus's off-field shot chain at its kit's 22 frames, the log's
 * next shot 2 frames on: the replay made both).
 */
function withoutFollowUps(ctx: TimelineContext, st: TimelineState, casts: readonly ReplayedCast[], until: number): TimelineState {
  const castsKey = (owner: string, trigger: string, key: string) => {
    const kit = ctx.kits.get(owner);
    const hasKey = (skill: string) => (kit?.skills.find((k) => k.skillId === skill)?.hits ?? []).some((h) => h.events.includes(key));
    return (kit?.triggers ?? []).some((t) => t.id === trigger && allActions(t.do).some((a) => a.kind === "cast" && hasKey(a.skill)));
  };
  const replaced = (x: TimelineState["scheduled"][number]) =>
    x.kind === "action" && x.frame <= until &&
    casts.some((c) => !c.slot && c.landings.length > 0 && c.operator === x.owner && frameOf(c.start) >= x.frame && frameOf(c.start) < x.frame + FOLLOW_UP_FRAMES && castsKey(x.owner, x.trigger, c.key));
  return st.scheduled.some(replaced) ? { ...st, scheduled: st.scheduled.filter((x) => !replaced(x)) } : st;
}

/**
 * An `expires` step: the operator's active instance of its buff (whileBuff) set to expire at the frame, when it would
 * outlast the logged end by more than EXPIRY_MARGIN_FRAMES (else its own expiry is the end); the next advance ends it.
 */
function expiredAt(st: TimelineState, c: ReplayedCast, f: number): TimelineState {
  const w = c.whileBuff;
  if (!w) return st;
  const end = Math.round((w.endsAt * FPS) / 1000) + EXPIRY_MARGIN_FRAMES;
  const hit = (b: ActiveBuff) => b.id === w.buff && b.owner === c.operator && activeAt(b, f) && b.expiresAt > end;
  return st.buffs.some(hit) ? { ...st, buffs: st.buffs.map((b) => (hit(b) ? { ...b, expiresAt: f } : b)) } : st;
}

/**
 * The skill the replay casts for a logged cast, or null to skip it. A basic attack: its placed skill when it can start at
 * its frame, else the step the operator's chain points to (TimelineState.chainNext and its alternatives), or any basic
 * attack of the operator, that has the cast's key and can (Typhoeus's hover attacks 1–4 log one key, and which comes
 * next is her kit's state: the placement takes the first, the engine knows the step). A slot cast (ReplayedCast.slot):
 * skipped when its skill can start, else the operator's skill of its kind that can (Si's Initial or Final Stroke for a
 * logged battle skill under Artful Intent; accuracy plan A2), else skipped. A skip says why (`why`: BuffReplay.skipped,
 * the replay's SKIP lines; backlog after round 11 point 3: 9c0b's Si ultimate at 7.02 s took a debug print to read
 * "needs 68 ultimate energy").
 */
function replayedSkill(ctx: TimelineContext, st: TimelineState, c: ReplayedCast, f: number): { readonly skill: string | null; readonly why?: string } {
  const at = (frame: number) => `${((frame * 1000) / FPS / 1000).toFixed(2)} s`;
  /** Why `skill` doesn't start by the cast's frame (earliestStart's error, or its earliest frame), or null when it does. */
  const lateBy = (skill: string): string | null => {
    const r = earliestStart(ctx, st, { operator: c.operator, skill });
    if ("error" in r) return r.error;
    return r.frame <= f + 1 ? null : `${skill} can start only at ${at(r.frame)}, ${r.frame - f} frame(s) after the logged press`;
  };
  const startsBy = (skill: string) => lateBy(skill) === null;
  const skip = (why: string) => ({ skill: null, why });
  const made = (skill: string | null) => ({ skill });
  const kit = ctx.kits.get(c.operator);
  const w = c.whileBuff;
  if (w && !st.buffs.some((b) => (b.id === w.buff || (w.or ?? []).includes(b.id)) && b.owner === c.operator && activeAt(b, f) && b.expiresAt > Math.round((w.endsAt * FPS) / 1000) + EXPIRY_MARGIN_FRAMES)) return skip(`its buff ${[w.buff, ...(w.or ?? [])].join(" / ")} isn't on past the log's end of it then (ReplayedCast.whileBuff)`);
  if (c.slot) {
    // Which skill the slot holds, not whether it can start this frame (Si presses during her combo in 0eef): available at all
    // by its kit's state then (earliestStart alone waits for that state: 3f78ceb15bc3's press at 19708 ms, in her
    // ultimate, read as her battle skill after Artful Intent's end, so Initial Stroke wasn't made and the Inksoul's burst
    // at 22689 ms took the mark's branch).
    const available = (skill: string) => skillAvailable(ctx, st, c.operator, skill, f) && !("error" in earliestStart(ctx, st, { operator: c.operator, skill }));
    /** Why `skill` isn't available (its kit's state, or earliestStart's error). */
    const unavailable = (skill: string) => {
      if (!skillAvailable(ctx, st, c.operator, skill, f)) return `${skill} isn't available by its kit's state then`;
      const r = earliestStart(ctx, st, { operator: c.operator, skill });
      return "error" in r ? r.error : `${skill} is available`;
    };
    // The variant pulling a buff (pullingPresses): made as it while the slot holds it.
    if (c.as) return available(c.as) ? made(c.as) : skip(`a press pulling a buff, as the variant ${c.as}: ${unavailable(c.as)}`);
    // A press the log shows as a variant by its own keys: the variant the kit says the slot holds then.
    if (!c.leadsTo && c.shows?.length) {
      if (skillAvailable(ctx, st, c.operator, c.skillId, f)) return skip(`the log shows it as ${c.shows.join(" / ")} by its keys, but the slot holds ${c.skillId} itself then`);
      const v = c.shows.find((s) => skillAvailable(ctx, st, c.operator, s, f));
      return v ? made(v) : skip(`the log shows it as ${c.shows.join(" / ")} by its keys; the slot holds none of them then (nor ${c.skillId})`);
    }
    // A press whose hits had no one to land on (`unseen`) is its own skill while the slot holds it (d774d0ce7bd3: Liino's
    // battle skill at 49863 ms, with no enemy from 30.6 to 54.6 s; its stance's ATK is on the team from then to 115.9 s).
    // Else a press the log shows nothing of isn't made: the slot held a variant (her stance's presses every ~3 s, under
    // which the stance and its volleys go on), or the press did nothing (dbaee23b801d: Arcane's at 2706 ms, while
    // Typhoeus's hits land).
    // An ultimate pressed before the log's first hit is the ultimate whatever the replay's energy says: the energy the
    // team starts with isn't in the log (9c0bb09daff2's Si at 7.02 s, the first hit at 13.27 s, needed 68 with 0 in the
    // replay; the log lists her ultimate's Amp on the team from 13.27 to 21.4 s). Later presses keep the energy check
    // (every unseen ultimate made: 1cd1657bc305 −7.2 → −19.5%, Typhoeus's shots at 41.3 s lost).
    if (!c.leadsTo) {
      if (!c.unseen) return skip("a press the log shows nothing of (no hit of its own): the slot held a variant, or the press did nothing");
      if (!skillAvailable(ctx, st, c.operator, c.skillId, f)) {
        // The button's other variant where the kit's state holds it (buttonVariants: Zhuang Fangyi's battle skill in her
        // Empyrean, 3aa6ab93bad4 125.65 s, logged as normal_skill; its Sunderblade comes without a hit).
        const own = kit?.skills.find((k) => k.skillId === c.skillId);
        const v = own && kit ? kit.skills.find((k) => k.skillId !== c.skillId && !k.followUpOnly && buttonVariants(kit, own, k) && skillAvailable(ctx, st, c.operator, k.skillId, f)) : undefined;
        if (v === undefined) return skip(`a press whose hits had no one to land on: ${c.skillId} isn't available by its kit's state then`);
        const late = lateBy(v.skillId);
        return late === null ? made(v.skillId) : skip(`a press whose hits had no one to land on, as the variant ${v.skillId}: ${late}`);
      }
      if (c.beforeHits === true && c.kind === "ultimate") return made(c.skillId);
      const late = lateBy(c.skillId);
      return late === null ? made(c.skillId) : skip(`a press whose hits had no one to land on: ${late}`);
    }
    // A step before the inferred cast, never that cast again (the inferred one is timed by the log's buff end:
    // e9896c8d02be's press at 67244 ms, under the Inksoul, isn't the Final Stroke whose burst comes at 69192 ms).
    if (available(c.skillId)) return skip(`a step before the inferred ${c.leadsTo}: the slot holds ${c.skillId} itself then, made as the inferred cast`);
    const other = kit?.skills.find((k) => k.skillId !== c.skillId && k.skillId !== c.leadsTo && k.kind === c.kind && !k.followUpOnly && available(k.skillId))?.skillId;
    return other !== undefined ? made(other) : skip(`a step before the inferred ${c.leadsTo}: no other ${c.kind} skill of the operator is available then`);
  }
  // A skill of a slot that holds one of two variants with the same keys (Typhoeus's combo while hovering, her hovering
  // combo otherwise): the one its kit says is available then.
  if (c.kind !== "basic") {
    if (skillAvailable(ctx, st, c.operator, c.skillId, f)) return made(c.skillId);
    const keys = new Set((kit?.skills.find((k) => k.skillId === c.skillId)?.hits ?? []).flatMap((h) => h.events));
    const variant = kit?.skills.find((k) => k.skillId !== c.skillId && k.kind === c.kind && !k.followUpOnly && k.hits.some((h) => h.events.some((e) => keys.has(e))) && skillAvailable(ctx, st, c.operator, k.skillId, f));
    return made(variant?.skillId ?? c.skillId);
  }
  if (startsBy(c.skillId)) return made(c.skillId);
  const hasKey = (skill: string) => (kit?.skills.find((k) => k.skillId === skill)?.hits ?? []).some((h) => h.events.includes(c.key));
  // The chain's next steps first, then any basic attack of the operator with the key (steps gated by the kit's own
  // state, Typhoeus's ABATK attempts: her hover attacks aren't a chain of windows).
  const chain = st.chainNext[c.operator];
  const steps = [...(chain ? [chain, ...(chain.alternatives ?? [])].filter((x) => x.until >= f).map((x) => x.skill) : []), ...(kit?.skills.filter((k) => k.kind === "basic").map((k) => k.skillId) ?? [])];
  for (const skill of steps) if (skill !== c.skillId && hasKey(skill) && startsBy(skill)) return made(skill);
  // None can start by the logged frame by the kit's timing (the log's casts come a few frames sooner than its windows:
  // 9090afbacec9's shots at 91455 and 92002 ms, 16 frames apart, where shot 2's window for shot 3 opens at 18): the one
  // the kit's state allows then (its `available`: the attempt index), not the placed one, whose index is the placement's
  // guess (the placed shot 1 there made the next logged shot the 5th, which ended her hover before the logged 5th).
  if (!skillAvailable(ctx, st, c.operator, c.skillId, f)) for (const skill of steps) if (skill !== c.skillId && hasKey(skill) && skillAvailable(ctx, st, c.operator, skill, f)) return made(skill);
  return made(c.skillId);
}

/** How soon after a hitless press's landing the log's next hit must come for its listing to show what the press gave (ms; inferredPress). */
const INFERRED_PRESS_MS = 1500;

/** What inferredPress reads of the fight: its hits in time order and the kit buffs standing for the decided game buffs. */
interface PressEvidence {
  readonly hits: readonly LogHit[];
  readonly kitIds: readonly { readonly g: string; readonly owner: string; readonly id: string }[];
}

/**
 * A slot press the log shows no hit of (replayedSkill's skip), made after all when the log shows what only its hit
 * gives (2026-11-26): pending/zmdlogs-0c14fb3ce77d.json, Si's battle skill pressed at 153.99 s, its hit unlogged, yet
 * Jade Vessel's enemy_vul (from her battle skill's Immobilization alone) starts a new run on the next logged hit,
 * 155.79 s, and her Artful Intent ends at the log's 181.00 s. Made only when all of these hold, so it never makes a
 * press the log doesn't support: the log has the press's own cast event (a slot press, not `unseen`: the enemy was there,
 * not one the kit or the slot reads as another skill); its skill can start then; the first logged hit after its
 * landing comes within INFERRED_PRESS_MS; that hit lists a run of a decided game buff that starts after the hit before
 * the landing; and the replay with the press has an instance of its kit buff applied between the press and that hit,
 * the replay without it none. Null: not made so.
 */
function inferredPress(ctx: TimelineContext, st: TimelineState, c: ReplayedCast, f: number, ev: PressEvidence): { readonly skill: string; readonly why: string } | null {
  if (!c.slot || c.leadsTo || c.unseen || c.as || c.shows?.length || c.missed) return null;
  const skill = ctx.kits.get(c.operator)?.skills.find((k) => k.skillId === c.skillId);
  const first = Math.min(...(skill?.hits ?? []).flatMap((h) => loggedFrames(h) ?? []));
  if (!skill || !Number.isFinite(first) || !skillAvailable(ctx, st, c.operator, c.skillId, f)) return null;
  const r = earliestStart(ctx, st, { operator: c.operator, skill: c.skillId });
  if ("error" in r || r.frame > f + 1) return null;
  const landsAt = ((f + first) * 1000) / FPS;
  const next = ev.hits.find((h) => h.t >= landsAt);
  if (!next || next.t - landsAt > INFERRED_PRESS_MS) return null;
  const before = ev.hits.filter((h) => h.t < landsAt).at(-1);
  const listedBefore = new Set(before ? [...before.effects, ...before.boundaryEffects].map((e) => `${e.buff}|${e.since ?? ""}`) : []);
  const fresh = new Set([...next.effects, ...next.boundaryEffects].filter((e) => !listedBefore.has(`${e.buff}|${e.since ?? ""}`) && (e.since === undefined || e.since > (before?.t ?? -Infinity))).map((e) => e.buff));
  const candidates = ev.kitIds.filter((k) => fresh.has(k.g));
  if (!candidates.length) return null;
  const to = frameOf(next.t);
  const withIt = advance(ctx, replayCast(ctx, st, c.operator, c.skillId, f, { keepPrevious: true }), to);
  const without = advance(ctx, st, to);
  const gave = (x: TimelineState, k: { owner: string; id: string }) => x.buffs.some((b) => b.owner === k.owner && b.id === k.id && b.appliedAt >= f && b.appliedAt <= to);
  const shown = candidates.find((k) => gave(withIt, k) && !gave(without, k));
  return shown ? { skill: c.skillId, why: `a press the log shows no hit of, made: the log's next hit after its landing (${(next.t / 1000).toFixed(2)} s) starts a run of ${shown.g}, which only this press gives (${shown.owner}:${shown.id})` } : null;
}

/**
 * The step a cast that hit nothing is (ReplayedCast.missed): the operator's next basic-attack step the kit allows at the
 * frame by its state and timing (the chain's next steps first, then any of its basic attacks in kit order; not a
 * finisher or a dive, which aren't the attack input's repeats), only while it's the controlled operator (holding the
 * attack input). Null: none.
 */
function missedStep(ctx: TimelineContext, st: TimelineState, operator: string, f: number): string | null {
  if (st.controlled !== operator) return null;
  const chain = st.chainNext[operator];
  const basic = attackSteps(ctx, operator);
  const steps = [...(chain ? [chain, ...(chain.alternatives ?? [])].filter((x) => x.until >= f).map((x) => x.skill) : []), ...basic].filter((x) => basic.includes(x));
  for (const skill of steps) {
    if (!skillAvailable(ctx, st, operator, skill, f)) continue;
    const r = earliestStart(ctx, st, { operator, skill });
    if (!("error" in r) && r.frame <= f + 1) return skill;
  }
  return null;
}

/** How far (ms) around a cast's unlogged tail a logged hit of its operator with one of its skill's events keeps it whole, and a logged hit of anyone after its first landing shows the enemy there (tailCuts). */
const TAIL_NEAR_MS = 1500;
/**
 * How far inside a kill gap (enginecheck.ts killGaps) the replay's enemy is away: a landing logged with the kill or
 * with the next hit may come a few frames off its logged ms in the replay (the log flushes about every 100 ms:
 * pending/zmdlogs-9c6e97486a9d.json 55.20 s, Arcane's combo boom at the kill, 0.12 s before the next logged hit).
 */
const KILL_EDGE_MS = 150;

/** How many frames after one of a tail's landings a buff run it started may begin (tailCuts: a trigger on the landing). */
const TAIL_EFFECT_FRAMES = 1;
/** The most casts tailCuts ends in one fight, one replay each. */
export const TAIL_CUT_ROUNDS = 8;

/**
 * A cast with an unlogged tail that tailCuts kept whole, and the guard that kept it (round 18, the replay-only report
 * point 3: d774's 103.28 s battle skill had every condition of a cut but one, found by a stderr print in the guard):
 * TAILKEPT lines. `frame` is the tail's first landing.
 */
export interface TailKept {
  readonly cast: ReplayedCast;
  readonly frame: number;
  readonly why: string;
}

/**
 * The casts a replay played past what the log shows (engine assumption unlogged-tails `cut`, `cut-all`): a made cast
 * whose own landings after its last logged one stand for no logged hit, with no logged hit of its operator carrying one
 * of the skill's events within TAIL_NEAR_MS of them that no cast holds (the placement may have put the tail's hits
 * elsewhere), the first of them outside the away stretches and a logged hit of anyone within TAIL_NEAR_MS after it (the
 * enemy there, the log recording). The log records every landing that lands, so the cast ended between: right after its
 * last logged landing, at that landing's frame (ReplayCastOptions.endsAt). pending/zmdlogs-0c14fb3ce77d.json: Rossi's battle skill at
 * 35.40 s, its two charge hits logged, then neither her Lift at frame 35 nor the wolves and their bleed.
 */
export function tailCuts(run: ReplayRun, fx: LogFixture, placement: Placement, reading: string, kept?: TailKept[]): Map<ReplayedCast, number> {
  const out = new Map<ReplayedCast, number>();
  if (reading !== "cut" && reading !== "cut-all") return out;
  const kinds: ReadonlySet<SkillType> = new Set<SkillType>(reading === "cut-all" ? ["basic", "battle", "combo", "ultimate"] : ["battle", "combo", "ultimate"]);
  const heldBy = new Map(run.made.flatMap((m) => m.c.landings.map((l) => [l.ref, m.c] as const)));
  const away = awayWindows(fx);
  const ms = (f: number) => (f * 1000) / FPS;
  const last = Math.max(0, ...fx.hits.map((h) => h.t));
  for (const m of run.made) {
    const c = m.c;
    if (c.cutAt !== undefined || c.missed || c.slot || c.inferred || c.listed || c.expires || c.beforeLog || c.kind === null || !kinds.has(c.kind) || c.landings.length === 0) continue;
    // Every logged landing of the cast landed as its own (not a cast made as another variant, whose path the log's keys don't follow).
    const refs = new Set(c.landings.map((l) => l.ref));
    const lastLogged = Math.max(...c.landings.map((l) => l.frame));
    const tail = run.st.hits.filter((h) => h.cast === m.index && h.ref === undefined && h.frame > lastLogged).sort((a, b) => a.frame - b.frame);
    const first = tail[0];
    const keep = (why: string) => {
      if (first) kept?.push({ cast: c, frame: first.frame, why });
    };
    if (run.st.hits.filter((h) => h.ref !== undefined && refs.has(h.ref) && h.cast === m.index).length !== refs.size) {
      keep("a logged landing of it landed as another cast's or not at all (a cast made as another variant: the log's keys don't follow its path)");
      continue;
    }
    if (!first) continue;
    const from = ms(first.frame);
    // Not at the fight's end (the kill drops what comes after it), nor in an away stretch (nothing lands there).
    if (from > last - TAIL_NEAR_MS) {
      keep(`its tail starts within ${TAIL_NEAR_MS / 1000} s of the log's last hit (the kill drops what comes after it)`);
      continue;
    }
    const awayAt = away.find((w) => from > w.from && from < w.to);
    if (awayAt) {
      keep(`its tail starts in an away stretch (${(awayAt.from / 1000).toFixed(2)}–${(awayAt.to / 1000).toFixed(2)} s: nothing lands there)`);
      continue;
    }
    if (!fx.hits.some((h) => h.t >= from && h.t <= from + TAIL_NEAR_MS)) {
      keep(`no logged hit of anyone within ${TAIL_NEAR_MS / 1000} s after its tail's first landing (the log doesn't show the enemy there)`);
      continue;
    }
    // A logged hit of the operator's casts (not a status's or a trigger's) that no other cast holds: this cast's, placed
    // elsewhere or matched freely (a follow-up's, a tick's), so the log shows more of it.
    const shown = fx.hits.find((h, i) => {
      if (h.operator !== c.operator || h.t <= ms(lastLogged) || h.t > from + TAIL_NEAR_MS) return false;
      const by = heldBy.get(String(i));
      if (by && by !== c) return false;
      return (placement.hits.get(h)?.cast.kind ?? null) !== null;
    });
    if (shown) {
      keep(`a logged hit of its operator's casts no other cast holds, ${shown.event} at ${(shown.t / 1000).toFixed(2)} s, may be its tail's (placed elsewhere or matched freely)`);
      continue;
    }
    // A new run of a decided game buff the replay starts from the cut to the tail's end that the log lists then and not
    // before: the tail's effects came, so its landings did, unlogged (db87's Camille ultimate at 7.61 s: her gear set's
    // DMG and her weapon's ATK and Heat DMG on Laevatain from 13.42 s, after hits the log doesn't have). Only a run that
    // starts at one of the tail's landings (within TAIL_EFFECT_FRAMES after it): another cast's buff in that time says
    // nothing of the tail (d774d0ce7bd3: Zhuang Fangyi's battle skill at 103.28 s, three strikes logged; a gear set's
    // team ATK from Arcane's ultimate hit at 107.07 s, two frames before a tail strike, kept six strikes and a 152k final
    // the log doesn't have).
    const end = (tail.at(-1) as LandedHit).frame + 1;
    const atTail = (f: number) => tail.some((h) => f >= h.frame && f <= h.frame + TAIL_EFFECT_FRAMES);
    const listed = (g: string, a: number, b: number) => fx.hits.some((h) => h.t >= a && h.t <= b && h.effects.some((e) => e.buff === g));
    let effect: { buff: string; start: number } | undefined;
    for (const [key, list] of run.instances) {
      const g = key.split("|", 1)[0] as string;
      const x = list.find((x) => x.start > lastLogged && x.start <= end && atTail(x.start) && listed(g, ms(x.start), ms(x.start) + TAIL_NEAR_MS) && !listed(g, ms(lastLogged) - TAIL_NEAR_MS, ms(lastLogged)));
      if (x) {
        effect = { buff: g, start: x.start };
        break;
      }
    }
    // At its last logged landing's own frame: an end runs after that frame's hits (schedule.ts IN_FRAME), so a tail landing
    // the frame after is cut too (c83c75d02a85: Si's combo final at 56.73 s, a frame after her last logged slash, 5.0% of
    // the fight, landed past a cut at lastLogged + 1).
    if (!effect) out.set(c, lastLogged);
    else keep(`a new run of ${effect.buff} starts at its tail's landing (${(ms(effect.start) / 1000).toFixed(2)} s) that the log lists then and not before: the tail's effects came, so its landings did`);
  }
  return out;
}

/** An operator's basic attacks the attack input repeats: not a finisher (skillSpecification 8) or a dive (6), nor a follow-up. */
function attackSteps(ctx: TimelineContext, operator: string): string[] {
  return (ctx.kits.get(operator)?.skills ?? []).filter((k) => k.kind === "basic" && !k.followUpOnly && ![6, 8].includes(ctx.data.skills[k.skillId]?.timing?.specification ?? 0)).map((k) => k.skillId);
}

/**
 * Whether the kit allows none of a logged basic attack's skills (its placed one and the operator's others with its key)
 * at its frame in the replay (the state there): its `available` isn't met (Typhoeus's floating shots need her hover and
 * their attempt index). Only a cast the log shows by its own hits.
 */
function unmet(ctx: TimelineContext, st: TimelineState, c: ReplayedCast, f: number): boolean {
  if (c.missed || c.slot || c.kind !== "basic" || c.landings.length === 0) return false;
  const kit = ctx.kits.get(c.operator);
  const skills = [c.skillId, ...(kit?.skills ?? []).filter((k) => k.kind === "basic" && k.hits.some((h) => h.events.includes(c.key))).map((k) => k.skillId)];
  return skills.every((s) => !skillAvailable(ctx, st, c.operator, s, f));
}

/** The most casts that hit nothing added before one logged cast (Typhoeus's hover takes at most 4 shots before the 5th, which ends it). */
const MISSED_MAX = 4;

/** How many times missedCasts looks again for a shot's first frame from a later state (a stop held the earlier one). */
const FIRST_TRIES = 3;

/** The most logged casts the replay adds casts that hit nothing before (missedCasts), per fight. */
export const MISSED_ROUNDS = 12;

/** One replay's casts as made and its steps, for missedCasts. */
interface MissedSearch {
  readonly ctx: TimelineContext;
  readonly made: readonly { readonly c: ReplayedCast; readonly f: number; readonly post: TimelineState }[];
  readonly steps: readonly { readonly frame: number; readonly cast: ReplayedCast | null }[];
}

/**
 * Casts that hit nothing (ReplayedCast.missed), which no log shows (ZMDLogs lists hits; a shot that hits nothing leaves no
 * entry: the owner, who plays Typhoeus, 2026-11-15: holding attack while she hovers, she keeps shooting when the shots
 * hit nothing), added before a logged cast the kit allows none of its skills for (unmet): the fewest of the operator's
 * basic-attack steps (missedStep) after its previous cast that make the kit allow it, each at the earliest frame that
 * still does, the latest first; none when no number up to MISSED_MAX does (9090afbacec9: Typhoeus's shot at 57615 ms,
 * no hit by anyone from 57.9 to 60.6 s, a shot at 60630 ms that needs her hover, which idles out 1.9 s after a shot). Each
 * candidate is judged by making the casts from the previous one's state to the need's frame (`make`: the replay's own
 * cast making, the others' casts in between included).
 */
export function missedCasts(r: MissedSearch, need: { c: ReplayedCast; f: number }, make: (st: TimelineState, c: ReplayedCast, f: number) => { st: TimelineState; skillId: string | null }, hold: (st: TimelineState, frame: number) => TimelineState, hits: readonly Pick<LogHit, "t" | "operator" | "event">[]): ReplayedCast[] {
  const { ctx } = r;
  const op = need.c.operator;
  const prev = r.made.filter((m) => m.c.operator === op && m.f < need.f).at(-1);
  if (!prev) return [];
  const [i, j] = [r.steps.findIndex((s) => s.cast === prev.c), r.steps.findIndex((s) => s.cast === need.c)];
  if (i < 0 || j < 0) return [];
  const between = r.steps.slice(i + 1, j).flatMap((s) => (s.cast ? [{ frame: s.frame, cast: s.cast }] : []));
  const shot = (t: number): ReplayedCast => {
    const start = (t * 1000) / FPS;
    return { operator: op, key: "", group: "", skillId: need.c.skillId, kind: "basic", start, lastHit: start, keepPrevious: prev.c.lastHit > start, landings: [], missed: { skill: need.c.skillId, at: need.c.start } };
  };
  /** The casts from the previous one's state with these shots, to `until`: the skills the shots were made as (null: not every shot was), and the state then. */
  const tried = new Map<string, { skills: string[] | null; st: TimelineState }>();
  const trial = (times: readonly number[], until: number): { skills: string[] | null; st: TimelineState } => {
    const key = `${times.join(",")}|${until}`;
    const known = tried.get(key);
    if (known) return known;
    const r = trialOf(times, until);
    tried.set(key, r);
    return r;
  };
  const trialOf = (times: readonly number[], until: number): { skills: string[] | null; st: TimelineState } => {
    const events = [...between.filter((x) => x.frame <= until).map((x) => ({ ...x, missed: false })), ...times.filter((t) => t <= until).map((t) => ({ frame: t, cast: shot(t), missed: true }))].sort((a, b) => a.frame - b.frame || Number(a.missed) - Number(b.missed));
    let st = prev.post;
    const skills: string[] = [];
    for (const e of events) {
      st = hold(st, Math.max(e.frame, st.frame));
      try {
        const m = make(st, e.cast, Math.max(e.frame, st.frame));
        if (e.missed && m.skillId === null) return { skills: null, st };
        if (e.missed) skills.push(m.skillId as string);
        st = m.st;
      } catch (err) {
        if (e.missed) return { skills: null, st };
        if (!(err instanceof Error)) throw err;
      }
    }
    return { skills, st: advance(ctx, hold(st, Math.max(until, st.frame)), Math.max(until, st.frame)) };
  };
  const ok = (times: readonly number[]) => {
    const t = trial(times, need.f);
    return t.skills !== null && !unmet(ctx, t.st, need.c, need.f);
  };
  /** The skill a shot at `t` after `times` is made as, or null. */
  const madeAs = (times: readonly number[], t: number) => trial([...times, t], t).skills?.at(-1) ?? null;
  /**
   * The first frame after `times` a shot can start (the earliest start from the state after them, of a step the kit
   * allows), and its step. Where none can start there, again from the state there: a time stop cast in between holds
   * the earliest start the state before it gave (dbaee23b801d: Typhoeus's battle skill at 0.85 s, then Li Zhiyan's
   * ultimate stop from 0.93 to 2.50 s; her first shot can't start at 1.7 s, the end of her battle skill's action).
   */
  const first = (times: readonly number[]): { t: number; skill: string } | null => {
    let from = (times.at(-1) ?? prev.f) + 1;
    for (let tries = 0; tries < FIRST_TRIES && from < need.f; tries++) {
      const st = trial(times, from).st;
      const at = from;
      const starts = attackSteps(ctx, op).flatMap((skill) => {
        if (!skillAvailable(ctx, st, op, skill, at)) return [];
        const e = earliestStart(ctx, st, { operator: op, skill });
        return "error" in e || e.frame >= need.f ? [] : [e.frame];
      });
      const sorted = [...new Set(starts)].sort((a, b) => a - b);
      for (const t of sorted) {
        const skill = madeAs(times, t);
        if (skill !== null) return { t, skill };
      }
      if (sorted.length === 0) return null;
      from = Math.max(from, (sorted[0] as number) + 1);
    }
    return null;
  };
  /**
   * The last frame before the need a shot after `times` can start as the same step as at its first (the operator's state
   * ends it: Typhoeus's hover, after which the attack input is her grounded attack 1).
   */
  const last = (times: readonly number[], from: { t: number; skill: string }): number => {
    const same = (t: number) => madeAs(times, t) === from.skill;
    let [lo, hi] = [from.t, need.f - 1];
    if (same(hi)) return hi;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (same(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  // Only where the log shows no hit of the need's key from the first frame another attack could start: one there is a cast
  // the placement put elsewhere, not one that hit nothing (fc63a2001251: the shot at 95138 ms, whose cast the placement
  // started at 93999 ms from the burst before it).
  const opening = first([]);
  if (!opening || hits.some((h) => h.operator === op && h.event === need.c.key && frameOf(h.t) >= opening.t && frameOf(h.t) < need.f)) return [];
  // The fewest: each shot as late as it can be (the longest reach), until the need is met.
  const times: number[] = [];
  for (let k = 1; k <= MISSED_MAX; k++) {
    const a = k === 1 ? opening : first(times);
    if (a === null) return [];
    times.push(last(times, a));
    if (!ok(times)) continue;
    // The earliest that still meet it: the latest shot first, each as early as it can be with the later ones where they are.
    for (let n = times.length - 1; n >= 0; n--) {
      let [lo, hi] = [first(times.slice(0, n))?.t ?? (times[n] as number), times[n] as number];
      const at = (t: number) => times.map((x, m) => (m === n ? t : x));
      if (ok(at(lo))) hi = lo;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (ok(at(mid))) hi = mid;
        else lo = mid;
      }
      times[n] = hi;
    }
    return times.map(shot);
  }
  return [];
}

/** Whether a logged cast made as `skillId` at `f` goes against the kit (BuffReplay.castFlags), the state advanced to `f`. */
function castFlag(ctx: TimelineContext, st: TimelineState, c: ReplayedCast, skillId: string, f: number): CastFlag | undefined {
  if (c.missed || c.slot || c.kind === "basic") return undefined;
  if (!skillAvailable(ctx, st, c.operator, skillId, f)) {
    const own = [...new Set(st.buffs.filter((b) => b.owner === c.operator && activeAt(b, f)).map((b) => b.id))];
    return { cast: c, skillId, frame: f, kind: "forced", why: `its kit makes it unavailable then (the operator's own buffs: ${own.join(", ") || "none"})` };
  }
  const cur = st.acting[c.operator];
  if (!cur || cur.auto || cur.skill === skillId) return undefined;
  const sec = (frame: number) => ((frame * 1000) / FPS / 1000).toFixed(2);
  // The gates alone (`at`: an interrupt doesn't wait for the running cast's hits): its uncuttable frames.
  if (exclusiveUntil(ctx, st, c.operator) > f + 1) {
    const r = earliestStart(ctx, st, { operator: c.operator, skill: skillId, at: f });
    if (!("error" in r) && r.frame > f + 1) return { cast: c, skillId, frame: f, kind: "inside", why: `${r.frame - f} frame(s) before ${cur.skill} lets it start (its uncuttable frames: the kit allows it from ${sec(r.frame)} s)` };
  }
  // A legal interrupt that cancels hits of the running cast still due (round 8: the flag counted these as uncuttable).
  const landed = ownHitsLanded(st, c.operator);
  if (landed <= f + 1) return undefined;
  const index = cur.cast ?? st.casts.findLastIndex((x) => x.operator === c.operator);
  const pending = st.scheduled.filter((x) => x.kind === "hit" && x.cast?.operator === c.operator && x.cast.index === index && x.frame > f).length;
  return { cast: c, skillId, frame: f, kind: "cuts", why: `cuts ${pending} pending hit(s) of ${cur.skill} (its own hits due until ${sec(landed)} s): an interrupt the kit allows` };
}

/**
 * Replays a logged fight's casts through the timeline (see the file
 * comment). Casts of skills only their own skill casts (KitSkill.followUpOnly)
 * are left to the engine; crits are never rolled (crit-triggered buffs are
 * left to the log: `undecided`). The state is read at every logged hit and
 * REPLAY_EDGE_MS either side of it.
 */
/** A logged cast as one replay made it (replayOnce): its frame, skill, the states either side, and what it found. */
type Made = { c: ReplayedCast; f: number; skillId: string; pre: TimelineState; post: TimelineState; index: number; link: number; windowCount: number | null; consumed: ConsumedBuffs; inferred?: string; dropped?: readonly JumpDrop[]; keptSkipped?: readonly JumpDrop[] };

/**
 * A kit jump of a replayed cast that its logged landings contradicted, which the engine dropped (drivers.ts replayCast
 * `dropped`): the jump (its frame, from and to on the cast's timeline) and the pinned landings in the part it would have
 * skipped. JUMPDROP lines (`zmdlogs replay`, `zmdlogs decisions`).
 */
export interface JumpDrop {
  readonly frame: number;
  readonly from: number;
  readonly to: number;
  readonly landings: readonly { readonly hitId: string; readonly frame: number }[];
}
/** A logged cast the kit allows none of its skills for at its frame in the replay (missedCasts), and the state before it. */
type Need = { c: ReplayedCast; f: number };

/**
 * One cast made at `f` (the state not yet advanced to it): the state after it, the skill it was made as (null: none,
 * a tick or a press the slot doesn't make), the state before it and the combo window count it found.
 */
export function makeCast(ctx: TimelineContext, st0: TimelineState, c: ReplayedCast, f: number, list: readonly ReplayedCast[], ev?: PressEvidence) {
  let st = advance(ctx, withoutFollowUps(ctx, st0, list, f), f);
  const windowCount = c.kind === "combo" ? replayWindowCount(ctx, st, c.operator, c.skillId, f) : null;
  const pre = st;
  const tick = c.missed ? null : loggedTick(ctx, st, c, f);
  if (tick) return { st: tick, skillId: null, pre, windowCount, why: "a tick of a kit buff (KitBuff.ticksLoggedAs): the buff's tick moved to the event" };
  if (!c.missed && endedWithTick(ctx, st0, c, f)) return { st, skillId: null, pre, windowCount, why: "a tick of a kit buff (KitBuff.ticksLoggedAs) that ended on this very frame: its last tick" };
  if (c.expires) return { st: expiredAt(st, c, f), skillId: null, pre, windowCount, why: "not a cast: the log's end of its buff (ReplayedCast.expires)" };
  let chosen: { readonly skill: string | null; readonly why?: string } = c.missed ? { skill: missedStep(ctx, st, c.operator, f), why: "no basic-attack step the kit allows then (a cast that hits nothing)" } : replayedSkill(ctx, st, c, f);
  // A hitless press the log's listing shows (engine assumption hitless-presses `inferred`).
  const inferred = chosen.skill === null && ev ? inferredPress(ctx, st, c, f, ev) : null;
  if (inferred) chosen = inferred;
  const skillId = chosen.skill;
  if (skillId === null) return { st, skillId, pre, windowCount, ...(chosen.why !== undefined ? { why: chosen.why } : {}) };
  const flag = castFlag(ctx, st, c, skillId, f);
  // A slot cast the log shows only by its press (Si's Initial Stroke during her combo) keeps the running cast's hits.
  const dropped: JumpDrop[] = [];
  const keptSkipped: JumpDrop[] = [];
  st = replayCast(ctx, st, c.operator, skillId, f, { keepPrevious: c.keepPrevious || c.slot === true, landings: c.landings, ...(c.teammate ? { teammate: true } : {}), ...(c.missed ? { missed: true } : {}), ...(c.cutAt !== undefined ? { endsAt: c.cutAt } : {}), ...(c.chanceJumps ? { chanceJumps: c.chanceJumps } : {}), ...(c.kitJumps ? { kitJumps: c.kitJumps } : {}), dropped: (j, landings) => dropped.push({ ...j, landings }), keptSkipped: (j, landings) => keptSkipped.push({ ...j, landings }) });
  // A cast made from the listing alone (castsFromHitBuffs): recorded as an inferred one, its landings dealt nothing.
  const why = inferred?.why ?? (c.listed ? `a cast the log shows only by a buff its hit alone gives, made (listed-casts inferred): ${c.listed.buff} listed from ${(c.listed.since / 1000).toFixed(2)} s` : undefined);
  return { st, skillId, pre, windowCount, ...(flag ? { flag } : {}), ...(why !== undefined ? { inferred: why } : {}), ...(dropped.length ? { dropped } : {}), ...(keptSkipped.length ? { keptSkipped } : {}) };
}

/** What every replay of a fight (replayOnce) reads that its passes share: the fight, the options, the log's Stagger steps and crits. */
export interface ReplayInput {
  readonly data: GameData;
  readonly fx: LogFixture;
  readonly opts: ReplayOptions;
  /** Who the log shows controlled first (controlledFromLog), else null. */
  readonly control: { readonly first: string } | null;
  /** The kit buffs standing for the decided game buffs (`g` the game buff). */
  readonly kitIds: readonly { readonly g: string; readonly owner: string; readonly id: string }[];
  readonly team: readonly string[];
  /** REPLAY_EDGE_MS in frames. */
  readonly edge: number;
  /** The frames the state is read at: every logged hit's and REPLAY_EDGE_MS either side. */
  readonly sampleFrames: readonly number[];
  /** The crits the log leaves out that the replay takes as logged, by hit index (shownCrits, layerCrits, valueCrits). */
  readonly crits: ReadonlyMap<number, boolean>;
  readonly stagger: LoggedStagger;
  /** The logged hits in time order. */
  readonly hitsInOrder: readonly LogHit[];
}

/**
 * One pass of the replay: the landings whose crit no one gives land as `crit` says, its casts, the hidden holds placed
 * (holds.ts), and what follows the log before each step (`held`: heldTicks, heldToLoggedEnds).
 */
interface ReplayPass {
  readonly crit: "never" | "always";
  readonly casts: readonly ReplayedCast[];
  readonly worldHolds: readonly { readonly frame: number; readonly frames: number }[];
  readonly held: (st: TimelineState, frame: number) => TimelineState;
}

/**
 * A replay run's state at a frame: its latest step at or before it, advanced (pure). The one handle on "the replay's
 * state at another frame" (round 19, the slug report point 3: the status pairing re-wrote it beside the facts' check);
 * BuffReplay.stateAt gives it to views.
 */
export function runStateAt(run: Pick<ReplayRun, "ctx" | "checkpoints">, frame: number): TimelineState {
  let cp = run.checkpoints[0] as TimelineState;
  for (const x of run.checkpoints) if (x.frame <= frame) cp = x;
  return cp.frame === frame ? cp : advance(run.ctx, cp, frame);
}

/** The timeline's damage options for `operator` at a frame of a replay run (damageOptions at runStateAt): its modifiers with their sources, Stagger, the situation. */
export function runOptionsAt(run: Pick<ReplayRun, "ctx" | "checkpoints">, operator: string, frame: number): ReturnType<typeof damageOptions> {
  const st = runStateAt(run, frame);
  return damageOptions(run.ctx, st, operator, st.enemy, frame);
}

/** One replay's run: its record (replayrecord.ts), the casts as made, the states after each step, and what went wrong. */
export interface ReplayRun extends ReplayRecord {
  readonly ctx: TimelineContext;
  readonly st: TimelineState;
  readonly brokenAt: number | null;
  readonly made: readonly Made[];
  readonly needs: readonly Need[];
  readonly steps: readonly ReplayStep[];
  /** The state after each step, for the facts' check at REPLAY_EDGE_MS either side of a cast (stateAt). */
  readonly checkpoints: readonly TimelineState[];
  readonly castErrors: readonly { readonly cast: ReplayedCast; readonly error: string }[];
  readonly flags: readonly CastFlag[];
  /**
   * Where the log's Stagger outlasted the engine's own (loggedStaggerSteps): the frame the engine's would have ended
   * (null: the engine had none running), and where the log's calm hit cut one the engine's still had running.
   */
  readonly staggerHolds: readonly { readonly frame: number; readonly engineUntil: number | null }[];
  readonly staggerCuts: readonly { readonly frame: number; readonly engineUntil: number }[];
  /** The logged casts it didn't make, and why (makeCast). */
  readonly skipped: readonly SkippedCast[];
  /** Why a logged hit's pinned landing never landed, by its ref (landingWatch). */
  readonly dropped: ReadonlyMap<string, string>;
}

/**
 * One replay of the logged casts. Landings whose crit the log gives crit as it says (TimelineScenario.loggedCrits);
 * the others as `crit` says: never for the replay the check reads, always for the bound on the buffs a trigger on crits
 * is behind (critDependent: where the two disagree, the replay doesn't decide them).
 */
export function replayOnce(input: ReplayInput, pass: ReplayPass): ReplayRun {
  const { data, fx, opts, control, sampleFrames } = input;
  const { crit, casts: list, held } = pass;
  // Where the log's Stagger outlasted the engine's own (loggedStaggerSteps): the frame the engine's would have ended
  // (null: the engine had none running) and the frame the hold reached; the until a hold last set, to tell them apart.
  const staggerHolds: { frame: number; engineUntil: number | null }[] = [];
  const staggerCuts: { frame: number; engineUntil: number }[] = [];
  const cut = () => {
    if (isStaggered(st, st.frame) && st.stagger.until !== heldUntil) staggerCuts.push({ frame: st.frame, engineUntil: st.stagger.until as number });
  };
  let heldUntil: number | null = null;
  let brokenAt: number | null = null;
  const firstBasic = control ? { operator: control.first } : list.find((c) => c.kind === "basic");
  const enemyHp = loggedEnemyHp(data, fx, readingOf(opts.assume, "enemy-hp"));
  // Engine assumption kill-gaps: with `absent`, from KILL_EDGE_MS after a logged kill to KILL_EDGE_MS before the next logged hit too.
  const killReading = readingOf(opts.assume, "kill-gaps");
  const [killStart, killEnd] = killReading === "tight" ? [1000 / FPS, 1000 / FPS] : [KILL_EDGE_MS, KILL_EDGE_MS];
  const killed = killReading === "absent" || killReading === "tight" ? killGaps(fx) : [];
  const enemyAway = [
    ...enemyAwaySpans(fx, readingOf(opts.assume, "enemy-away")),
    ...killed.flatMap((w) => {
      const [from, to] = [Math.round(((w.from + killStart) * FPS) / 1000), Math.round(((w.to - killEnd) * FPS) / 1000)];
      return to >= from ? [{ from, to }] : [];
    }),
  ];
  const breaks = breakHoldStarts(fx, breakHoldFrames(opts.assume), opts.assume);
  const scenario: TimelineScenario = {
    team: fx.team,
    target: { enemy: fx.enemy.id, level: fx.enemy.level },
    durationFrames: (sampleFrames.at(-1) ?? 0) + 1,
    rotation: [],
    options: { crit, ...(opts.assume && Object.keys(opts.assume).length ? { assume: opts.assume } : {}) },
    ...(firstBasic ? { controlled: firstBasic.operator } : {}),
    ...(enemyHp?.length ? { enemyHp } : {}),
    ...(enemyAway.length ? { enemyAway } : {}),
    // Each with its logged hit's index: a pinned landing (replayCast landings `ref`) takes its own hit's crit.
    // Crits the log leaves out but a trigger on crits shows by its logged hits (shownCrits), by the layers it adds
    // (layerCrits) or the hits' values show (valueCrits) count as logged.
    loggedCrits: fx.hits.flatMap((h, i) => {
      const crit = h.crit ?? input.crits.get(i) ?? null;
      return crit === null ? [] : [{ operator: h.operator, event: h.event, frame: frameOf(h.t), crit, ref: String(i) }];
    }),
    ...(opts.loggedModifiers ? { loggedModifiers: fx.hits.flatMap((h) => {
      const modifiers = (opts.loggedModifiers as NonNullable<ReplayOptions["loggedModifiers"]>)(h);
      return modifiers.length ? [{ operator: h.operator, event: h.event, frame: frameOf(h.t), modifiers }] : [];
    }) } : {}),
    ...(opts.reactionLevels?.length ? { loggedReactionLevels: opts.reactionLevels } : {}),
    // The breaks the log shows: only they hold every clock (engine assumption break-hold), at their own frame; those the
    // log stamped inside their hold are held by a step of their own, from where the hold began (breakHoldStarts).
    loggedBreaks: breaks.filter((b) => b.from === b.at).map((b) => b.at),
  };
  const ctx = createContext(data, scenario);
  // Engine assumption hitless-presses: with `inferred`, a press the log shows no hit of is made where its listing shows what only it gives.
  const pressEvidence: PressEvidence | undefined = readingOf(opts.assume, "hitless-presses") === "inferred" ? { hits: input.hitsInOrder, kitIds: input.kitIds } : undefined;
  let st: TimelineState = init(ctx);
  for (const c of list) if (c.beforeLog) st = withCastBeforeLog(ctx, st, c);
  const rec = replayRecorder({ kitIds: input.kitIds, team: input.team, trace: opts.trace ?? [], staggerFrames: () => staggerFrames(ctx), edge: input.edge });
  const steps = replaySteps(input.stagger, pass.worldHolds, list, sampleFrames, breaks.filter((b) => b.from !== b.at).map((b) => b.from));
  const checkpoints: TimelineState[] = [st];
  const made: Made[] = [];
  const needs: Need[] = [];
  const castErrors: { cast: ReplayedCast; error: string }[] = [];
  const flags: CastFlag[] = [];
  const skipped: SkippedCast[] = [];
  const landings = landingWatch(ctx);
  let prevStep: ReplayStep | null = null;
  for (const s of steps) {
    // The state after the step before this one: its changes are that step's.
    if (prevStep) rec.step(st, stepWords(prevStep));
    prevStep = s;
    const before = st;
    st = held(st, Math.max(s.frame, st.frame));
    if (checkpoints.at(-1) !== st) checkpoints.push(st);
    if (s.cast) {
      const c = s.cast;
      try {
        const f = Math.max(s.frame, st.frame);
        const r = makeCast(ctx, st, c, f, list, pressEvidence);
        if (crit === "never" && unmet(ctx, r.pre, c, f)) needs.push({ c, f });
        if ("flag" in r && r.flag) flags.push(r.flag);
        st = r.st;
        landings.after(before, st, s, r.skillId, "why" in r ? r.why : undefined);
        if (r.skillId === null) {
          if (!c.missed) skipped.push({ cast: c, frame: f, why: ("why" in r ? r.why : undefined) ?? "not made" });
          continue;
        }
        const skillId = r.skillId;
        const index = st.casts.findLastIndex((x) => x.frame === f && x.operator === c.operator && x.skill === skillId);
        const carried = st.buffs.filter((b) => b.cast === index && b.id !== "link");
        const consumed: ConsumedBuffs = { buffs: carried.map((b) => b.id).sort(), modifiers: buffModifiers(carried, c.operator, f, index) };
        made.push({ c, f, skillId, pre: r.pre, post: st, index, link: st.casts[index]?.link ?? 0, windowCount: r.windowCount, consumed, ...("inferred" in r && r.inferred ? { inferred: r.inferred } : {}), ...("dropped" in r && r.dropped ? { dropped: r.dropped } : {}), ...("keptSkipped" in r && r.keptSkipped ? { keptSkipped: r.keptSkipped } : {}) });
      } catch (e) {
        castErrors.push({ cast: c, error: e instanceof Error ? e.message : String(e) });
      }
      continue;
    }
    try {
      st = advance(ctx, withoutFollowUps(ctx, st, list, Math.max(s.frame, st.frame)), Math.max(s.frame, st.frame));
      landings.after(before, st, s);
      if (s.recover) {
        st = refillPoise(ctx, st);
        continue;
      }
      if (s.hold !== undefined) {
        st = holdWorld(st, st.frame, s.hold);
        continue;
      }
      if (s.breakHold) {
        st = breakHold(ctx, st, st.frame, true);
        continue;
      }
      if (s.bar !== undefined) {
        if (s.calm === true) cut();
        st = setPoise(ctx, st, s.bar, s.calm === true);
        continue;
      }
      if (s.through !== undefined) {
        const running = isStaggered(st, st.frame);
        const until = st.stagger.until;
        if ((!running || (until as number) < s.through) && until !== heldUntil) staggerHolds.push({ frame: st.frame, engineUntil: running ? until : null });
        st = holdStagger(st, st.frame, s.through);
        if (st.stagger.until !== until) heldUntil = st.stagger.until;
        continue;
      }
      if (s.endBar !== undefined) {
        cut();
        if (isStaggered(st, st.frame)) st = setPoise(ctx, st, s.endBar ?? Infinity, true);
        continue;
      }
    } catch (e) {
      // The timeline can't go on (a hit it can't land from what the replay knows): it decides nothing from here.
      brokenAt = s.frame;
      castErrors.push({ cast: list.filter((c) => frameOf(c.start) <= s.frame).at(-1) as ReplayedCast, error: `the replay stops at ${Math.round((s.frame * 1000) / FPS)} ms: ${e instanceof Error ? e.message : String(e)}` });
      break;
    }
    rec.sample(st, s.frame);
  }
  if (prevStep) rec.step(st, stepWords(prevStep));
  const record = rec.finish(brokenAt);
  if (checkpoints.at(-1) !== st) checkpoints.push(st);
  return { ...record, ctx, st, brokenAt, made, needs, steps, checkpoints, castErrors, flags, staggerHolds, staggerCuts, skipped, dropped: landings.dropped };
}

/** A logged cast the replay didn't make (BuffReplay.skipped): its frame and why (makeCast: a tick, the slot's variant, its energy, …). */
export interface SkippedCast {
  readonly cast: ReplayedCast;
  readonly frame: number;
  readonly why: string;
}

/**
 * What became of each logged hit's pinned landing (replayCast `landings`, by its ref: the hit's index) that left the
 * schedule without landing (backlog after round 11 point 3: Snowshine's bashes vanished, the cast's end at frame 106
 * dropping the one pinned at 125, found by a scratch script): watched after every step from the schedule before and
 * after it, so no engine change: the step that dropped it and the likeliest cause (another alternative of its branch,
 * its kit hit's `if` at its frame, the operator's next cast, the end of its cast's action, a jump of its cast), or why
 * it was never pinned (its cast skipped, made as another skill, or no such landing on the cast's path).
 */
function landingWatch(ctx: TimelineContext) {
  type Sched = TimelineState["scheduled"][number];
  const dropped = new Map<string, string>();
  const landed = new Set<string>();
  let seen = 0;
  let live = new Map<string, Sched>();
  const sec = (f: number) => `${((f * 1000) / FPS / 1000).toFixed(2)} s`;
  const cause = (prev: TimelineState, x: Sched, s: ReplayStep, now: TimelineState, made: string | null | undefined): string => {
    const op = x.cast?.operator;
    const index = x.cast?.index;
    const where = `${sec(x.frame)} (pinned)`;
    if (x.kind === "hit" && x.branch !== undefined) return `another alternative of its landing (branch ${x.branch}) landed in its place by ${sec(now.frame)}: the first in kit order whose \`if\` holds lands (timeline/landing.ts)`;
    if (x.kind === "hit" && x.frame <= now.frame) {
      const def = (op !== undefined ? ctx.kits.get(op)?.skills.find((k) => k.skillId === x.skillId)?.hits.find((h) => h.id === x.hitId) : undefined);
      if (def?.if !== undefined) return `its kit hit's \`if\` didn't hold at its frame ${sec(x.frame)} (KitHit.if ${JSON.stringify(def.if).slice(0, 120)}): it didn't land`;
      if (def?.poiseOnly) return `a poise-only kit hit (KitHit.poiseOnly): its Stagger, no damage landing`;
    }
    if (s.cast && made && s.cast.operator === op) return `cut by ${op}'s next cast ${made} at ${sec(now.frame)}, before its landing at ${where} (casting.ts endCurrentSkill)`;
    const ofCast = (y: Sched) => y.kind === "jump" && y.cast.operator === op && y.cast.index === index && y.frame <= now.frame;
    const end = prev.scheduled.find((y) => ofCast(y) && y.kind === "jump" && y.end === true && y.frame < x.frame);
    if (end) return `the end of its cast's action at ${sec(end.frame)} (SkillTiming.ends, a kit trigger's jump past it not taken), before its landing at ${where}`;
    const jump = prev.scheduled.find((y) => ofCast(y) && y.kind === "jump" && y.end !== true);
    if (jump && jump.kind === "jump") return `a jump of its cast at ${sec(jump.frame)} (frames ${jump.from}–${jump.to} skipped), before its landing at ${where}`;
    return `dropped by ${stepWords(s)} (from ${sec(prev.frame)} to ${sec(now.frame)}), before its landing at ${where}`;
  };
  return {
    dropped: dropped as ReadonlyMap<string, string>,
    /** After a step (`made`/`why`: a cast step's skill, or null and why it wasn't made). */
    after(prev: TimelineState, now: TimelineState, s: ReplayStep, made?: string | null, why?: string): void {
      for (; seen < now.hits.length; seen++) {
        const r = now.hits[seen]?.ref;
        if (r !== undefined) landed.add(r);
      }
      if (seen > now.hits.length) seen = now.hits.length;
      const next = new Map<string, Sched>();
      for (const x of now.scheduled) if (x.kind === "hit" && x.ref !== undefined) next.set(x.ref, x);
      for (const [ref, x] of live) if (!next.has(ref) && !landed.has(ref) && !dropped.has(ref)) dropped.set(ref, cause(prev, x, s, now, made));
      // A cast's landings never pinned: its cast skipped, made as another skill, or no such landing on its path.
      if (s.cast) {
        for (const l of s.cast.landings) {
          if (next.has(l.ref) || landed.has(l.ref) || live.has(l.ref) || dropped.has(l.ref)) continue;
          dropped.set(l.ref, made === null ? `its cast wasn't made: ${why ?? "skipped"}` : made !== undefined && made !== s.cast.skillId ? `its cast was made as ${made}, which has no ${l.hitId} landing ${l.nth + 1}` : `never pinned: ${s.cast.skillId}'s ${l.hitId} has no landing ${l.nth + 1} on the path the cast took`);
        }
      }
      live = next;
    },
  };
}
