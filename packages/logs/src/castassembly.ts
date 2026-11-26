// The casts the replay makes (buffreplay.ts replayKitBuffs), assembled from the placement (logcasts.ts):
// replayedCasts (the placed casts with their pinned landings), the logged cast events (withLoggedCasts,
// loggedCastStart), and the passes that add the casts the log implies (castsFromBuffEnds, pullingPresses,
// exitPresses, castsFromBuffLanes, castsFromTriggerHits, castsBeforeLog), in assembleCasts; who the log shows
// controlled (controlledFromLog, controlSwaps), each logged cast event's fate (loggedCastFates) and the stops the
// replay's casts hold (replayedCastStops). Split from buffreplay.ts (improvement round 14).

import { allActions, applyBuff, chanceJumpsOf, computeStats, ENGINE_ASSUMPTIONS, kitHitEntries, readingDoesNotApply, triggerSkillId, effectiveKit, FPS, type GameData, type KitBuff, type KitHit, type KitTrigger, type OperatorKit, type SkillType } from "@efsim/engine";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { loggedNames } from "./enginecheck.ts";
import { buttonVariants, castFrames, excludes, neededBuffs, castTimeStops, distinctCasts, loggedFrames, mergeMs, placeHits, skillStops, withResets, worldMs, type LoggedCast, type Placement, type TimeStop } from "./logcasts.ts";

/** The game buffs the log lists with values somewhere (effects or boundary effects). */
export function listedWithValues(fx: LogFixture): Set<string> {
  return new Set(fx.hits.flatMap((h) => [...h.effects, ...h.boundaryEffects].map((e) => e.buff)));
}

export const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);

/** A logged cast as the replay casts it. */
export interface ReplayedCast extends LoggedCast {
  /** Its last logged hit, in ms. */
  readonly lastHit: number;
  /** The operator's cast before it keeps its hits to come: the log has them landing after this one started (replayCast keepPrevious). */
  readonly keepPrevious: boolean;
  /** Its landings at their logged frames (replayCast landings): each logged hit of the cast whose kit landing the placement knows. */
  readonly landings: readonly { readonly hitId: string; readonly nth: number; readonly frame: number; readonly ref: string; readonly ms: number }[];
  /**
   * A logged cast event of a skill whose damage the log shows elsewhere, kept only for the slot it stands for: the replay
   * makes it only when the skill can't start there and another of the operator's skills of its kind can (replayedSkill:
   * Si's second battle-skill press under Artful Intent is logged as her battle skill, and is Initial Stroke). Only one
   * that `leadsTo` an inferred cast (castsFromBuffEnds) or is the variant pulling a buff (`as`: pullingPresses) is made
   * so: a press is shown as another skill only where the log shows what that skill leads to (Liino's battle skill at
   * 4187 ms in 0eef2474a26f, during her Vocalist Stance, would be End Stance, but the log keeps the stance's ATK on her
   * team after it).
   */
  readonly slot?: true;
  /** The skill of the inferred cast the press leads to: the press is made as another variant, a step before it. */
  readonly leadsTo?: string;
  /** The variant the press is made as while the slot holds it (pullingPresses: Si's first press after her battle skill is Initial Stroke). */
  readonly as?: string;
  /**
   * A slot cast's variants (skills of its kind, not cast near it) whose own keys the log shows within SLOT_SHOWS_MS
   * after the press: the press is the one of them its kit says the slot holds then (3aa6ab93bad4: Zhuang Fangyi's
   * battle-skill presses during her ultimate, logged as normal_skill, are normal_skill_ult, whose keys follow each).
   */
  readonly shows?: readonly string[];
  /** A slot cast whose first landing would come where the log has no hit by anyone within QUIET_MS (no enemy to hit). */
  readonly unseen?: true;
  /** An unseen slot press before the log's first hit (no hit of anyone yet): an ultimate then skips the energy check. */
  readonly beforeHits?: true;
  /**
   * A slot press the log shows no hit of that a first replay made as its skill by the log's listing (inferredPress,
   * engine assumption hitless-presses `inferred`): pullingPresses counts it as a landed cast of its skill.
   */
  readonly inferred?: true;
  /**
   * No cast: the logged end of `whileBuff`'s buff is its expiry, which the replay's clock has later (castsFromBuffEnds:
   * the logged hit's trigger branch rules out the cast that ends it). Made by ending the buff then (it expires at the
   * frame), with no cast event (no battle-skill cast for a trigger by skill type).
   */
  readonly expires?: true;
  /**
   * Inferred from a logged hit of a trigger on this buff's end (castsFromBuffEnds), at `endsAt` ms: cast only while the
   * buff is active and would last past that end by itself (else its expiry is the end: bdf223db8e49's burst at 24321 ms
   * is Artful Intent's own expiry, its mark projectile, not Final Stroke's).
   */
  readonly whileBuff?: { readonly buff: string; readonly endsAt: number; /** Or any of these (exitPresses: the buffs the exit ends). */ readonly or?: readonly string[] };
  /** A basic attack of an operator the log shows isn't controlled then: its own attack beside the controlled one's (controlledFromLog). */
  readonly teammate?: true;
  /**
   * A cast that hit nothing, which the log can't show (missedCasts): added only before a logged cast of its operator that
   * the kit allows only with it, `skill` at `at` ms. Its skill is the step the kit allows at its frame (missedStep).
   */
  readonly missed?: { readonly skill: string; readonly at: number };
  /**
   * A cast before the log began (castsBeforeLog; `start` < 0): none of its hits are in the log, what it left running is
   * (its stance, its ticking buffs). The replay starts with it already made (withCastBeforeLog), not as a step.
   */
  readonly beforeLog?: true;
  /** The frame it ends at, its later landings none of them logged (tailCuts, engine assumption unlogged-tails `cut`). */
  readonly cutAt?: number;
  /**
   * The outcome of its chance jumps the log's listing shows (by trigger id; replayCast chanceJumps): listedPaths, or
   * the path of a cast made from the listing (castsFromHitBuffs).
   */
  readonly chanceJumps?: Readonly<Record<string, boolean>>;
  /**
   * A cast the log shows only by a buff one of its hits alone gives (castsFromHitBuffs, engine assumption listed-casts
   * `inferred`): the game buff and the `since` (ms) of the run it starts. Its own landings stand for no damage the log
   * shows (the totals leave them out, as an inferred press's).
   */
  readonly listed?: { readonly buff: string; readonly since: number };
}

/** How close (ms) a listed run's `since` is to a landing for that landing to have started it (listedPaths, castsFromHitBuffs): a frame. */
const LISTED_SINCE_MS = 1000 / FPS + 1;
/** How long after a landing the log's hits must list a buff it gives for the listing to say it didn't (listedPaths; ms): 0c14's 122.85 s slam, the last hit for 1.7 s. */
const LISTED_AFTER_MS = 3000;

/** The game buffs a kit hit's own buffs stand for (BuffApplication: their kit buffs' logged names). */
function hitGameBuffs(kit: OperatorKit, hit: KitHit): string[] {
  return (hit.buffs ?? []).flatMap((b) => {
    const def = kit.buffs.find((d) => d.id === b.buff);
    return def ? loggedNames(def) : [];
  });
}

/** Whether kit hit `b` is `a` on a chance jump's path: the same keys, its frames `by` (the jump's length) later. */
function sameFromStart(a: KitHit, b: KitHit, by: number): boolean {
  const fa = a.frames ?? [];
  const fb = b.frames ?? [];
  return fa.length > 0 && fa.length === fb.length && fa.every((f, i) => fb[i] === f + by) && a.events.length === b.events.length && a.events.every((e) => b.events.includes(e));
}

/**
 * The hits of a skill's chance jumps' paths (chanceJumpsOf) and their buffs' game buffs: for each chance jump, the kit
 * hits past its target that apply a buff the log can list, each with the hit it stands for on the path not jumped (the
 * same keys in the part the jump skips: Alesh's slam_ex for slam), if any.
 */
function chancePathHits(kit: OperatorKit, skillId: string): { readonly trigger: string; readonly at: number; readonly to: number; readonly hit: KitHit; readonly other: KitHit | undefined; readonly buffs: readonly string[] }[] {
  const skill = kit.skills.find((s) => s.skillId === skillId);
  if (!skill) return [];
  const frames = (h: KitHit) => h.frames ?? [];
  return chanceJumpsOf(kit.triggers, skillId).flatMap((c) =>
    skill.hits.flatMap((hit) => {
      const buffs = hitGameBuffs(kit, hit);
      if (!buffs.length || !frames(hit).length || !frames(hit).every((f) => f >= c.to)) return [];
      const other = skill.hits.find((x) => x !== hit && sameFromStart(x, hit, c.to - c.at));
      return [{ ...c, hit, other, buffs }];
    }),
  );
}

/**
 * The chance jumps of the replay's casts that the log's listing decides (ReplayedCast.chanceJumps): a jump whose path
 * has a hit applying a buff the log lists (chancePathHits) was taken where a run of that buff starts at the hit's logged
 * landing (its `since` within a frame of it), and not where the log lists the buff somewhere in the fight but none of
 * its hits in LISTED_AFTER_MS after the landing does. A run already going there keeps its `since` when refreshed, so
 * it says which by its end: listed until at least the buff's duration after the landing, refreshed (taken); its last
 * listing sooner than that, with hits after it that don't list it, not (4e36's 42.96 s slam: the run since 32.92 s ends
 * at 47.3–47.6 s, a refresh would last to 53 s; its hits ×1.14 the normal path's, not ×1.6); else undecided (rolled).
 * Alesh's Rare Fin (2026-11-26): her P3 team ATK, which only the Rare Fin's slam gives, is listed from exactly the
 * slam's logged ms in every development log (0c14 60.13 s, 4e36 20.33 and 32.92 s, a9d7 12.52, 39.82 and 61.52 s),
 * where the hits' values are ×1.5–1.6 the normal path's; the replay had rolled the path (0c14 199.57 s: a Rare Fin
 * hook the log hasn't), and the placement matches either path's hits by their frames, the same from the cast's start.
 */
export function listedPaths(data: GameData, kits: readonly OperatorKit[], fx: Pick<LogFixture, "hits" | "team">, casts: readonly ReplayedCast[]): ReplayedCast[] {
  const listedAnywhere = new Set(fx.hits.flatMap((h) => [...h.effects, ...h.boundaryEffects].map((e) => e.buff)));
  return casts.map((c) => {
    if (c.chanceJumps || c.landings.length === 0) return c;
    const kit = kits.find((k) => k.operator === c.operator);
    const build = fx.team.find((b) => b.operator === c.operator);
    const paths = kit && build ? chancePathHits(kit, c.skillId) : [];
    const out: Record<string, boolean> = {};
    for (const p of paths) {
      if (out[p.trigger] !== undefined || !kit || !build) continue;
      // The hit's logged landing, else where another logged landing of the cast puts it (its frame from the cast's
      // start on either path: a9d7's 98.88 s hook, its slam unlogged).
      const fromStart = (h: KitHit | undefined) => {
        const f = h?.frames?.length === 1 ? (h.frames[0] as number) : undefined;
        return f === undefined ? undefined : f >= p.to ? f - (p.to - p.at) : f;
      };
      const own = c.landings.find((l) => l.hitId === p.hit.id || l.hitId === p.other?.id);
      const skill = kit.skills.find((s) => s.skillId === c.skillId);
      const near = own ? null : c.landings.find((l) => fromStart(skill?.hits.find((h) => h.id === l.hitId)) !== undefined);
      const nearFrame = near ? fromStart(skill?.hits.find((h) => h.id === near.hitId)) : undefined;
      const names = p.buffs.filter((g) => listedAnywhere.has(g));
      const m = own ? own.ms : near && nearFrame !== undefined ? near.ms + (((fromStart(p.hit) as number) - nearFrame) * 1000) / FPS : undefined;
      if (m === undefined || !names.length) continue;
      const listings = fx.hits.flatMap((h) => [...h.effects, ...h.boundaryEffects].filter((e) => names.includes(e.buff)).map((e) => ({ t: h.t, since: e.since })));
      const after = listings.filter((e) => e.t > m && e.t <= m + LISTED_AFTER_MS);
      if (listings.some((e) => e.since !== undefined && Math.abs(e.since - m) <= LISTED_SINCE_MS)) out[p.trigger] = true;
      else if (!after.length && fx.hits.some((h) => h.t > m && h.t <= m + LISTED_AFTER_MS)) out[p.trigger] = false;
      else {
        // A run going on: by its end against the buff's duration from the landing.
        const ms = hitBuffMs(data, build, kit, p.hit, c.skillId);
        const since = after[0]?.since;
        if (ms === null || since === undefined) continue;
        const last = Math.max(...listings.filter((e) => e.since === since).map((e) => e.t));
        if (last >= m + ms) out[p.trigger] = true;
        else if (fx.hits.some((h) => h.t > last && h.t < m + ms && !listings.some((e) => e.t === h.t))) out[p.trigger] = false;
      }
    }
    return Object.keys(out).length ? { ...c, chanceJumps: out } : c;
  });
}

/** The shortest duration (ms) of a kit hit's own buffs with game buffs, or null (none, or one that needs a fight). */
function hitBuffMs(data: GameData, build: LogFixture["team"][number], kit: OperatorKit, hit: KitHit, skillId: string): number | null {
  let out: number | null = null;
  for (const b of hit.buffs ?? []) {
    const def = kit.buffs.find((d) => d.id === b.buff);
    if (!def?.gameBuff) continue;
    try {
      const a = applyBuff(data, build, computeStats(data, build), skillId, def, 0);
      if (a && Number.isFinite(a.expiresAt)) out = Math.min(out ?? Infinity, (a.expiresAt * 1000) / FPS);
    } catch (e) {
      if (!readingDoesNotApply(e)) throw e;
    }
  }
  return out;
}

/**
 * Casts the log shows only by a buff one of their hits alone gives (engine assumption listed-casts `inferred`): a game
 * buff the log lists that exactly one kit hit of the team applies (no trigger, no other hit), whose run starts (its
 * `since`) where no replayed cast of that hit's skill could have landed it, gets a cast of the skill timed so the hit
 * lands at the run's start (its kit frame on the path that has it: a chance jump's path is then the cast's,
 * ReplayedCast.chanceJumps), when the operator has no logged hit from the cast's start to the hit and it starts within
 * the fight. pending/zmdlogs-0c14fb3ce77d.json (2026-11-26): Alesh's P3 team ATK, which only her combo's Rare Fin slam
 * gives, listed from 13.25 s with no hit or cast event of her combo near; the Rare Fin hook's natural SP then gives the
 * second Thermite Cutter layer the log lists from 12.71 s (16 frames before: hook_ex 77, slam_ex 93), and her combo
 * window was open (the Endministrator's Originium Crystals consumed at 11.23 s).
 */
export function castsFromHitBuffs(kits: readonly OperatorKit[], fx: Pick<LogFixture, "hits">, casts: readonly ReplayedCast[]): ReplayedCast[] {
  const givers = new Map<string, { kit: OperatorKit; skillId: string; hit: KitHit }[]>();
  const byTrigger = new Set<string>();
  for (const kit of kits) {
    for (const e of kitHitEntries(kit)) for (const g of hitGameBuffs(kit, e.hit)) givers.set(g, [...(givers.get(g) ?? []), { kit, skillId: e.skillId, hit: e.hit }]);
    for (const t of kit.triggers) for (const a of allActions(t.do)) {
      const def = a.kind === "buff" ? kit.buffs.find((b) => b.id === a.buff) : undefined;
      if (def) for (const g of loggedNames(def)) byTrigger.add(g);
    }
  }
  const added: ReplayedCast[] = [];
  for (const [g, list] of givers) {
    const giver = list[0];
    if (list.length !== 1 || !giver || byTrigger.has(g)) continue;
    const { kit, skillId, hit } = giver;
    const skill = kit.skills.find((s) => s.skillId === skillId);
    const kitFrame = hit.frames?.[0];
    if (!skill || skill.followUpOnly || kitFrame === undefined || (hit.frames?.length ?? 0) !== 1) continue;
    // Its frame from the cast's start on the path that has it (a chance jump skips to it).
    const path = chancePathHits(kit, skillId).find((p) => p.hit === hit);
    const frame = path ? kitFrame - (path.to - path.at) : kitFrame;
    const sinces = [...new Set(fx.hits.flatMap((h) => [...h.effects, ...h.boundaryEffects].flatMap((e) => (e.buff === g && e.since !== undefined ? [e.since] : []))))].sort((a, b) => a - b);
    for (const since of sinces) {
      const start = Math.round(since - (frame * 1000) / FPS);
      if (start < 0) continue;
      // A cast of the skill that could have landed it: one starting from the logged cast window before the run to it.
      if ([...casts, ...added].some((c) => c.operator === kit.operator && c.skillId === skillId && c.start <= since + LISTED_SINCE_MS && c.start >= start - LOGGED_CAST_MS)) continue;
      // The operator busy with another cast then (a logged hit of its own between the cast's start and the hit).
      if (fx.hits.some((h) => h.operator === kit.operator && h.t >= start && h.t <= since)) continue;
      // The hit at the run's start, and the path's hits before it at their kit frames before that (the cast's own clock
      // ran as its kit says between them: 0c14's Thermite and P3 `since`s 16 frames apart, as hook_ex 77 and slam_ex 93,
      // inside Si's combo stop), pinned: they stand for no logged hit (`listed:` refs match none).
      const before = path ? skill.hits.filter((h) => h.frames?.length === 1 && (h.frames[0] as number) >= path.to && (h.frames[0] as number) <= kitFrame) : [hit];
      const landings = before.map((h, i) => ({ hitId: h.id, nth: 0, frame: frameOf(since) - (kitFrame - (h.frames?.[0] as number)), ref: `listed:${i}`, ms: since - ((kitFrame - (h.frames?.[0] as number)) * 1000) / FPS }));
      added.push({ operator: kit.operator, key: skillId, group: skillId, skillId, kind: skill.kind, start, lastHit: start, keepPrevious: false, landings, listed: { buff: g, since }, ...(path ? { chanceJumps: { [path.trigger]: true } } : {}) });
    }
  }
  return added.length ? ordered([...casts, ...added]) : [...casts];
}

/** How far from a placed cast's start a logged cast event of its skill may be to be that cast (ms). */
export const LOGGED_CAST_MS = 2500;
/** A combo's own cast event comes at most this long of the world's time before its placed start or after its last landing (ms; withLoggedCasts). */
const COMBO_EVENT_MS = 1500;
/** How far after a combo's last landing its own cast event may be, in the world's time (ms; loggedCastMatcher). */
const COMBO_EVENT_AFTER_MS = 1000;

/**
 * The replay's casts with the casts the log records without damage (LogFixture.casts) that it lacks: a logged cast of
 * a kit skill whose damage the log never shows for its operator, with no placed cast of the skill within LOGGED_CAST_MS
 * (40d9a3c1da37: Laevatain's ultimate at 3041 ms, whose damage comes as her enhanced attacks). A skill whose hits the
 * log shows elsewhere isn't added where it doesn't (it may be a variant the kit models otherwise: 0eef2474a26f, Liino's
 * battle skill at 4187 ms, whose only damage is her talent's volley); a placed cast keeps its start (the log's cast
 * event can come before the skill acts: Liino's battle skill at 760 ms, its buffs at 1314 ms). Follow-up-only skills
 * are left to the engine.
 */
/** How soon after a slot press the log must show a variant's own keys for the press to be that variant (ms; withLoggedCasts). */
const SLOT_SHOWS_MS = 3000;

/** How far from a slot press's first landing the log has no hit by anyone for the press to be `unseen` (ms). */
const QUIET_MS = 1000;

/**
 * Where a logged cast of a skill without logged hits of its own starts: an ultimate's cast event can come at its time
 * stop's end (b6aa15281db4: Xaihi's at 31027 ms, after 1.8 s without a hit by anyone; her Amp, at frame 58, is on hits
 * from 31592 ms). When no hit by anyone falls in the stop's length before the event, one falls at it, and no other
 * cast's stop covers half of it (dbaee23b801d: Xaihi's at 7606 ms inside Liino's stop, her Amp not yet on 8501 ms), it
 * started that early.
 */
function loggedCastStart(data: GameData | undefined, lc: { t: number; operator: string; skill: string }, kind: SkillType, hits: readonly LogHit[], stops: readonly TimeStop[]): number {
  if (!data || kind !== "ultimate") return lc.t;
  const stop = data.skills[lc.skill]?.timing?.slowdowns.find((d) => d.from === 0 && Math.min(...d.scales) === 0);
  if (!stop) return lc.t;
  const length = (stop.scales.length * 1000) / FPS;
  const [from, to] = [lc.t - length, lc.t];
  if (hits.some((h) => h.t > from + EDGE_MS && h.t < to - EDGE_MS)) return lc.t;
  // What waited out a time stop lands as it ends: another's hit at the event's own time (b6aa15281db4: Arcane's attack
  // 2 at 31027 ms) says the stop ended there (not the caster's own: d774d0ce7bd3, Zhuang Fangyi's sword at her ultimate),
  // and so does another's hit soon after it (RESUME_MS), which a stop starting at the event would have held: Laevatain's
  // ultimate, logged at its stop's end in every log (the last hit before it 2.0–2.9 s earlier, her stop 2.03 s), the team
  // resuming 83–356 ms after it in 012ae1c80ae6, c83c75d02a85, db8711232de9, e9896c8d02be, f8793bc8aea2, 2b013866dfa3.
  // Without one (e82d45c46040: Xaihi's at 3896 ms after 2315 ms, her Amp not yet on Arcane's hit at 7022 ms) the event is
  // the cast.
  if (!hits.some((h) => h.operator !== lc.operator && h.t >= lc.t - FLUSH_MS && h.t <= lc.t + RESUME_MS)) return lc.t;
  const covering = stops.filter((x) => {
    if (x.operator === lc.operator) return false;
    const [a, b] = [(x.start * 1000) / FPS, ((x.start + x.scales.length) * 1000) / FPS];
    return Math.min(b, to) - Math.max(a, from) >= length / 2;
  });
  if (covering.length === 0) return Math.round(from);
  // Logged at the very end of the stop that covers it (within EDGE_MS), it waited for that stop's end to be logged, as a
  // press during a stop is: it was pressed inside that stop and ran beside it, its own stop overlapping (4d60e7fe92c2:
  // Zhuang Fangyi's at 157421 ms, Liino's stop ending at 157.47 s; her Empyrean basic attacks land from 158379 ms and
  // Liino's song beats at 158.66 and 160.03 s, which a stop of 2.6 s from the event would have held). It starts a frame
  // after the covering stop does, so that one's caster runs on to its own stop's end (clock.ts slowDown).
  const atEnd = covering.find((x) => Math.abs(((x.start + x.scales.length) * 1000) / FPS - lc.t) <= EDGE_MS);
  return atEnd ? Math.max(Math.round(from), Math.round(((atEnd.start + 1) * 1000) / FPS)) : lc.t;
}

/** How close to a window's edges a logged hit may be and still not count as inside it (ms; loggedCastStart). */
const EDGE_MS = 100;
/** How close to a cast event a logged hit is at it (ms; loggedCastStart). */
const FLUSH_MS = 15;
/** How soon after an ultimate's cast event another's hit says the team resumed from its stop (ms; loggedCastStart). */
const RESUME_MS = 500;

/**
 * Whether a placed cast `c` is the logged cast event `lc` of `skill` (withLoggedCasts; loggedCastFates shows the
 * result per event).
 */
function loggedCastMatcher(kits: readonly OperatorKit[], stops: readonly TimeStop[]): (c: ReplayedCast, lc: { t: number; operator: string }, skill: string) => boolean {
  // A placed cast is the logged one within LOGGED_CAST_MS of the world's time: the log's times run on through time stops
  // (a7a7a40c97ed: Arcane's battle skill pressed at 37415 ms, placed from its hits at 40523 ms, 351 ms later across
  // Wulfgard's and her own ultimates' stops).
  // A combo's own event is within COMBO_EVENT_MS of the world's time before its start or COMBO_EVENT_AFTER_MS after its
  // last landing (it lags frame 0 by 0.3–0.7 s; e82d45c46040: Arcane's press at 3896 ms, her combo placed at 6.52 s after two ultimates'
  // stops): one further off is an entity's CastSkill logged under its id, though within LOGGED_CAST_MS of its start
  // (a7a7a40c97ed: Arcane's INT lasers' events at 42128 and 48886 ms, 2.4 s of the world's time after her combo's touch
  // at 37.08 s and before the one at 51.5 s; with Liino's combo stop placed from its end, 2026-11-23, the one at 42128 ms
  // is 1.35 s of the world's time after the touch: after the last landing the window is COMBO_EVENT_AFTER_MS, the
  // event's lag behind frame 0 (0.3–0.7 s) less the touch's frame 15, with the log's batching).
  // Only for a skill a buff's ticks are logged under (KitBuff.ticksLoggedAs): elsewhere such events stay with the cast.
  const ticked = new Set(kits.flatMap((k) => k.buffs.flatMap((d) => (d.ticksLoggedAs !== undefined ? [`${k.operator}|${d.ticksLoggedAs}`] : []))));
  return (c, lc, skill) =>
    c.operator === lc.operator && c.skillId === skill && worldMs(Math.min(c.start, lc.t), Math.max(c.start, lc.t), stops) <= LOGGED_CAST_MS &&
    !(c.kind === "combo" && ticked.has(`${c.operator}|${skill}`) && (worldMs(Math.min(lc.t, c.start), c.start, stops) > COMBO_EVENT_MS || worldMs(c.lastHit, Math.max(lc.t, c.lastHit), stops) > COMBO_EVENT_AFTER_MS));
}

/**
 * A placed cast that a logged cast event of another skill stands for: the event's skill shows no hit anywhere in the log
 * (`shownElsewhere` false), and a cast of its button's other variant (logcasts.ts buttonVariants) by the same operator,
 * placed from its hits, is near it (loggedCastMatcher) with no cast event of its own skill near. The game logs the
 * button's skill while the kit casts the variant (db8711232de9: Laevatain's four battle-skill presses in Twilight, logged
 * as normal_skill, are normal_skill_during_ult, placed from their hits 0.0–1.9 s later; made also as a cast of their
 * own, each forced a normal_skill whose explosion and Combustion ticks the log never shows, 3.6% of the fight, and took
 * the Link stack Camille's combo gave, which the logged during-ult hits carry: ×1.3 on all eleven).
 */
function variantCastOf(casts: readonly ReplayedCast[], fx: Pick<LogFixture, "casts">, kit: OperatorKit | undefined, skill: OperatorKit["skills"][number], lc: { t: number; operator: string }, near: ReturnType<typeof loggedCastMatcher>): ReplayedCast | undefined {
  return casts.find((c) => {
    const variant = kit?.skills.find((k) => k.skillId === c.skillId);
    return (
      c.operator === lc.operator && variant !== undefined && c.skillId !== skill.skillId && kit !== undefined && buttonVariants(kit, skill, variant) && !c.slot && c.landings.length > 0 && near(c, lc, c.skillId) &&
      !(fx.casts ?? []).some((o) => o.operator === lc.operator && o.skill === c.skillId && near(c, o, c.skillId))
    );
  });
}

export function withLoggedCasts(casts: readonly ReplayedCast[], fx: Pick<LogFixture, "casts" | "hits">, kits: readonly OperatorKit[], data?: GameData, stops: readonly TimeStop[] = []): ReplayedCast[] {
  if (!fx.casts?.length) return [...casts];
  const logged = new Set(fx.hits.map((h) => `${h.operator}|${h.event}`));
  const added: ReplayedCast[] = [];
  const near = loggedCastMatcher(kits, stops);
  for (const lc of fx.casts) {
    const skill = kits.find((k) => k.operator === lc.operator)?.skills.find((x) => x.skillId === lc.skill);
    if (!skill || skill.followUpOnly) continue;
    if (casts.some((c) => near(c, lc, lc.skill))) continue;
    const shownElsewhere = skill.hits.some((h) => h.events.some((e) => logged.has(`${lc.operator}|${e}`)));
    if (!shownElsewhere && variantCastOf(casts, fx, kits.find((k) => k.operator === lc.operator), skill, lc, near)) continue;
    const own = new Set(skill.hits.flatMap((h) => h.events));
    const kit = kits.find((k) => k.operator === lc.operator);
    const shows = shownElsewhere
      ? (kit?.skills ?? [])
          .filter((k) => k.skillId !== lc.skill && k.kind === skill.kind && !k.followUpOnly && !casts.some((c) => near(c, lc, k.skillId)))
          .filter((k) => k.hits.some((h) => h.events.some((e) => !own.has(e) && fx.hits.some((x) => x.operator === lc.operator && x.event === e && x.t >= lc.t && x.t <= lc.t + SLOT_SHOWS_MS))))
          .map((k) => k.skillId)
      : [];
    const landsAt = lc.t + (Math.min(...skill.hits.flatMap((h) => loggedFrames(h) ?? [])) * 1000) / FPS;
    const unseen = shownElsewhere && Number.isFinite(landsAt) && !fx.hits.some((h) => Math.abs(h.t - landsAt) <= QUIET_MS);
    const beforeHits = unseen && fx.hits.every((h) => h.t > lc.t);
    const start = shownElsewhere ? lc.t : loggedCastStart(data, lc, skill.kind, fx.hits, stops);
    added.push({ operator: lc.operator, key: lc.skill, group: lc.skill, skillId: lc.skill, kind: skill.kind, start, lastHit: start, keepPrevious: false, landings: [], ...(shownElsewhere ? { slot: true as const } : {}), ...(shows.length ? { shows } : {}), ...(unseen ? { unseen: true as const } : {}), ...(beforeHits ? { beforeHits: true as const } : {}) });
  }
  return added.length ? ordered([...casts, ...added]) : [...casts];
}

/** Casts in time order, each keeping its operator's previous cast's hits when the log shows them after it started. */
function ordered(casts: readonly ReplayedCast[]): ReplayedCast[] {
  const previous = new Map<string, ReplayedCast>();
  return [...casts].sort((x, y) => x.start - y.start).map((c) => {
    const prev = previous.get(c.operator);
    const r = { ...c, keepPrevious: prev !== undefined && prev.lastHit > c.start };
    previous.set(c.operator, r);
    return r;
  });
}

export function castsFromBuffEnds(kits: readonly OperatorKit[], placement: Placement, casts: readonly ReplayedCast[]): ReplayedCast[] {
  const added: ReplayedCast[] = [];
  const leads = new Map<number, string>();
  for (const pc of placement.casts) {
    if (!pc.group.startsWith("trigger:")) continue;
    const kit = kits.find((k) => k.operator === pc.operator);
    const t = kit?.triggers.find((x) => `trigger:${x.id}` === pc.group);
    if (!kit || !t || t.on.event !== "buffEnded" || !("buff" in t.on)) continue;
    const buff = t.on.buff;
    // The trigger's actions the logged hits come from: their conditions say which state the buff ended in.
    const ids = new Set([...placement.hits].flatMap(([h, p]) => (p.cast === pc ? p.hits.filter((k) => k.events.length === 0 || k.events.includes(h.event)).map((k) => k.id) : [])));
    const branches = allActions(t.do).filter((a) => a.kind === "hits" && a.hits.some((k) => ids.has(k.id)));
    // The skill the logged hits' Stagger is credited to (LogHit.poise.origin: the cast whose id the hit's skill inherits).
    const origins = new Set([...placement.hits].flatMap(([h, p]) => (p.cast === pc && h.poise?.origin ? [h.poise.origin] : [])));
    for (const e of kit.triggers) {
      if (e.on.event !== "cast" || !e.on.skills?.length || !allActions(e.do).some((a) => a.kind === "endBuff" && a.buff === buff)) continue;
      const skillId = e.on.skills[0] as string;
      const skill = kit.skills.find((x) => x.skillId === skillId);
      if (!skill) continue;
      // A skill castable only with a buff can't have ended it where the logged hits come from the branch without that
      // buff: its expiry did, which the replay's clock has later (Si's Final Stroke needs the Inksoul; the mark's own
      // burst, inkmark_projhit, is Artful Intent's end without one: 0c14fb3ce77d at 66.37 s, 489c0be3e162 at 100.2 s,
      // each made a Final Stroke against its kit and a Yinglung's Edge layer the combo's damage doesn't have;
      // bdf223db8e49 at 24.32 s). The buff ends at the logged end, with no cast.
      // So is a skill the logged hits aren't credited to, where the log says whose they are (LogHit.poise.origin): Si's
      // Final Stroke casts the Inksoul's return inheriting its own cast (origin normal_skill_2, 0eef2474a26f at 10030 ms);
      // the Inksoul returning by itself at Artful Intent's expiry has its own (normal_skill_inkmove_2: c83c75d02a85 at
      // 23.54, 57.26 and 87.89 s, 9555de54bb3d at 53.09 and 85.56 s, each 2–3 s after her last press, where a Final
      // Stroke inferred from the burst gave a Type 50 Yinglung's Edge layer the combo's damage doesn't have).
      if ((branches.length && branches.every((a) => excludes(a.if, skill.available))) || (origins.size > 0 && !origins.has(skillId))) {
        added.push({ operator: pc.operator, key: skillId, group: skillId, skillId, kind: skill.kind, start: pc.start, lastHit: pc.start, keepPrevious: false, landings: [], whileBuff: { buff, endsAt: pc.start }, expires: true });
        break;
      }
      const start = pc.start - ((e.delay ?? 0) * 1000) / FPS;
      if ([...casts, ...added].some((c) => c.operator === pc.operator && e.on.event === "cast" && (e.on.skills ?? []).includes(c.skillId) && c.start <= pc.start && c.start >= start - LOGGED_CAST_MS)) continue;
      added.push({ operator: pc.operator, key: skillId, group: skillId, skillId, kind: skill.kind, start, lastHit: start, keepPrevious: false, landings: [], whileBuff: { buff, endsAt: pc.start } });
      // A slot press of its kind shortly before it is the step that leads to it (Si's Initial Stroke before Final Stroke).
      for (const [i, c] of casts.entries()) {
        if (c.slot && c.operator === pc.operator && c.kind === skill.kind && c.start <= start && c.start >= start - 2 * LOGGED_CAST_MS && !leads.has(i)) leads.set(i, skillId);
      }
      break;
    }
  }
  // In time order, without recomputing the others' keepPrevious: an inferred cast the replay may skip isn't anyone's
  // previous cast (it keeps the running cast's hits itself).
  if (!added.length) return [...casts];
  const all = [...casts.map((c, i) => (leads.has(i) ? { ...c, leadsTo: leads.get(i) as string } : c)), ...added.map((c) => ({ ...c, keepPrevious: true }))].sort((x, y) => x.start - y.start);
  // The operator's next cast before the logged end keeps what the inferred cast has to come (a7a7a40c97ed: Si's attack 2
  // 0.3 s after the Final Stroke that ends her Artful Intent at 56469 ms, its burst the killing hit).
  return all.map((c, i) => {
    const prev = all.slice(0, i).reverse().find((x) => x.operator === c.operator);
    return prev && added.some((a) => a.operator === prev.operator && a.start === prev.start && a.skillId === prev.skillId) && prev.whileBuff && c.start < (prev.whileBuff.endsAt as number) ? { ...c, keepPrevious: true } : c;
  });
}

/**
 * Slot presses that are the variant pulling a buff: a skill castable only while one buff is on and another off (its
 * `available`: all of A, not B) whose cast gives B (a trigger on its cast with a `buff` of it): Si's Initial Stroke,
 * castable under Artful Intent before the Inksoul, which it pulls. The first slot press of its kind after each landed
 * cast whose hits apply A (her battle skill's hit), before the next, is made as that variant (ReplayedCast.as), unless
 * the log shows A ending on a branch without B (the mark's own burst, inkmark_projhit: no Initial Stroke; its one press,
 * 20–34 s after the battle skill, ends Artful Intent and gives no Type 50 Yinglung's Edge layer: 0c14fb3ce77d 81.7,
 * 4e3651100056 37.4). The logs make the first press after her battle skill Initial Stroke: the Inksoul's bursts at
 * Artful Intent's end (inkmove_2) need it, and Type 50 Yinglung's Edge counts it (c83c75d02a85 35.8 and 82.3 s,
 * 0c14fb3ce77d 122.1, e9896c8d02be 53.0; open-problems "Type 50 Yinglung's Edge"). Her later presses under Artful
 * Intent (every ~3.3 s) leave nothing in the log: no hit, no end, her basic chain goes on (in-game test 16), no layer:
 * not made (replayedSkill), as before.
 */
export function pullingPresses(kits: readonly OperatorKit[], placement: Placement, casts: readonly ReplayedCast[]): ReplayedCast[] {
  const marks = new Map<number, string>();
  for (const kit of kits) {
    for (const v of kit.skills) {
      const all = v.available && "all" in v.available ? v.available.all : [];
      const on = all.flatMap((p) => ("buffActive" in p ? [p.buffActive] : []));
      const off = all.flatMap((p) => ("not" in p && "buffActive" in p.not ? [p.not.buffActive] : []));
      const pulled = kit.triggers.filter((t) => t.on.event === "cast" && (t.on.skills ?? []).includes(v.skillId)).flatMap((t) => allActions(t.do).flatMap((a) => (a.kind === "buff" && off.includes(a.buff) ? [a.buff] : [])));
      const [a] = on;
      if (on.length !== 1 || a === undefined || pulled.length === 0) continue;
      const appliers = new Set(kit.skills.filter((s) => s.hits.some((h) => (h.buffs ?? []).some((b) => b.buff === a))).map((s) => s.skillId));
      // A's logged ends on a branch without the pulled buff: a trigger on A's end whose logged hits come only from such branches.
      const noPull: number[] = [];
      for (const pc of placement.casts) {
        const t = kit.triggers.find((x) => pc.operator === kit.operator && `trigger:${x.id}` === pc.group);
        if (!t || t.on.event !== "buffEnded" || !("buff" in t.on) || t.on.buff !== a) continue;
        const ids = new Set([...placement.hits].flatMap(([h, p]) => (p.cast === pc ? p.hits.filter((k) => k.events.length === 0 || k.events.includes(h.event)).map((k) => k.id) : [])));
        const branches = allActions(t.do).filter((x) => x.kind === "hits" && x.hits.some((k) => ids.has(k.id)));
        if (branches.length && branches.every((x) => x.if !== undefined && "not" in x.if && neededBuffs(x.if.not).some((b) => pulled.includes(b)))) noPull.push(pc.start);
      }
      const own = casts.flatMap((c, i) => (c.operator === kit.operator ? [{ c, i }] : []));
      const starts = own.filter(({ c }) => appliers.has(c.skillId) && (c.landings.length > 0 || c.inferred === true));
      for (const [k, { c }] of starts.entries()) {
        const next = starts[k + 1]?.c;
        if (noPull.some((t) => t > c.lastHit && t <= (next?.lastHit ?? Infinity))) continue;
        const press = own.find(({ c: x }) => x.slot && x.kind === v.kind && x.start > c.lastHit && x.start < (next?.start ?? Infinity));
        if (press && !marks.has(press.i)) marks.set(press.i, v.skillId);
      }
    }
  }
  return marks.size ? casts.map((c, i) => (marks.has(i) ? { ...c, as: marks.get(i) as string } : c)) : [...casts];
}

/**
 * Exit presses the log doesn't record: a logged cast (with landings) of a skill castable only outside a state (its
 * `available` is `not` P), where the operator's skill of its kind castable only inside it (`available` P: the slot's
 * variant then) ends a buff of that state (a trigger on its cast with an `endBuff`). The game can't cast the logged skill
 * while the variant holds the slot, so the variant was pressed first: an inferred cast of it after the last logged hit
 * that lists that buff's game buffs (loggedNames) before the logged cast (no later than a frame before it), made only while the buff is on and would last past then by itself (whileBuff). Liino's End Stance before a battle
 * skill during Cosmovoice: 4360447193ac lists Cosmovoice's Amp to 62.10 s, not from 62.76 s, and her battle skill's
 * projectiles land from 64.41 s, with no finale (End Stance skips it); 984748cfa662 to 73.13 s, the battle skill's at
 * 75.84 s. The replay made the battle skill inside Cosmovoice and kept its Amp and ATK on everyone (Perlica's hits there
 * ×0.62–0.70 the replay's).
 */
export function exitPresses(kits: readonly OperatorKit[], fx: Pick<LogFixture, "hits">, casts: readonly ReplayedCast[]): ReplayedCast[] {
  const added: ReplayedCast[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  for (const c of casts) {
    if (c.landings.length === 0 || c.kind === null || c.slot) continue;
    const kit = kits.find((k) => k.operator === c.operator);
    const skill = kit?.skills.find((s) => s.skillId === c.skillId);
    const avail = skill?.available;
    if (!kit || !avail || !("not" in avail)) continue;
    const exit = kit.skills.find((s) => s.skillId !== c.skillId && s.kind === c.kind && same(s.available, avail.not));
    if (!exit) continue;
    const ended = kit.triggers.filter((t) => t.on.event === "cast" && (t.on.skills ?? []).includes(exit.skillId)).flatMap((t) => allActions(t.do).flatMap((a) => (a.kind === "endBuff" ? [a.buff] : [])));
    // The last logged hit before the cast that lists one of the ended buffs' game buffs.
    const names = new Set(ended.flatMap((id) => {
      const def = kit.buffs.find((b) => b.id === id);
      return def ? loggedNames(def) : [];
    }));
    const last = fx.hits.filter((h) => h.t < c.start && h.effects.some((e) => names.has(e.buff))).at(-1);
    const [first, ...rest] = ended;
    if (!last || first === undefined) continue;
    const start = Math.min(last.t + 1000 / FPS, c.start - 1000 / FPS);
    if (casts.some((d) => d.operator === c.operator && d.skillId === exit.skillId && d.start >= last.t && d.start <= c.start)) continue;
    added.push({ operator: c.operator, key: exit.skillId, group: exit.skillId, skillId: exit.skillId, kind: exit.kind, start, lastHit: start, keepPrevious: false, landings: [], whileBuff: { buff: first, endsAt: start, or: rest } });
  }
  if (!added.length) return [...casts];
  return [...casts, ...added].sort((x, y) => x.start - y.start);
}

/**
 * Casts the log shows only by a buff they apply (its buff lanes: the hits listing it): a game buff the log lists with
 * values that one trigger of the team applies, on the owner's casts of skills whose damage the log never shows for it
 * (dbaee23b801d: Xaihi's ultimate, no damage, applies her weapon's team ATK, buff_wpn_funnel_0005_atk_up). Each run of
 * the buff's listings (gaps no longer than its duration) without a cast of such a skill within its duration before
 * gets one, its trigger's delay and a frame before the run's first listing (its start is no later; within
 * REPLAY_EDGE_MS of it, the replay doesn't decide the buff). Returns the casts with those added.
 */
export function castsFromBuffLanes(data: GameData, fx: LogFixture, kits: readonly OperatorKit[], casts: readonly ReplayedCast[]): ReplayedCast[] {
  const logged = new Set(fx.hits.map((h) => `${h.operator}|${h.event}`));
  const listed = listedWithValues(fx);
  const appliers = new Map<string, { kit: OperatorKit; t: KitTrigger; def: KitBuff }[]>();
  for (const kit of kits) {
    for (const t of kit.triggers) {
      for (const a of allActions(t.do)) {
        const def = a.kind === "buff" ? kit.buffs.find((b) => b.id === a.buff) : undefined;
        if (def?.gameBuff && listed.has(def.gameBuff)) appliers.set(def.gameBuff, [...(appliers.get(def.gameBuff) ?? []), { kit, t, def }]);
      }
    }
  }
  // A game buff a skill's hit applies too isn't one trigger's (bdf223db8e49: Liino's Vocalist Stance ATK by her battle
  // skill's hit and Cosmovoice's by her ultimate's frame-77 trigger share buff_chr_0035_liino_atkup; the stance's
  // listings made an ultimate at 0 ms).
  for (const kit of kits) for (const e of kitHitEntries(kit)) for (const b of e.hit.buffs ?? []) {
    const def = kit.buffs.find((x) => x.id === b.buff);
    if (def?.gameBuff) appliers.delete(def.gameBuff);
  }
  const added: ReplayedCast[] = [];
  for (const [g, list] of appliers) {
    if (list.length !== 1) continue;
    const { kit, t, def } = list[0] as { kit: OperatorKit; t: KitTrigger; def: KitBuff };
    if (t.on.event !== "cast" || t.by !== "self" || (!t.on.skills?.length && !t.on.kinds?.length)) continue;
    const on = t.on;
    const skill = kit.skills.find((s) => (on.skills?.includes(s.skillId) || on.kinds?.includes(s.kind)) && !s.followUpOnly && !s.hits.some((h) => h.events.some((e) => logged.has(`${kit.operator}|${e}`))));
    const build = fx.team.find((b) => b.operator === kit.operator);
    if (!skill || !build) continue;
    let ms: number;
    try {
      const b = applyBuff(data, build, computeStats(data, build), triggerSkillId(kit.operator, t), def, 0);
      if (!b || !Number.isFinite(b.expiresAt)) continue;
      ms = (b.expiresAt * 1000) / FPS;
    } catch (e) {
      if (!readingDoesNotApply(e)) throw e;
      continue; // its duration needs a fight
    }
    const times = [...new Set(fx.hits.filter((h) => h.effects.some((e) => e.buff === g)).map((h) => h.t))].sort((a, b) => a - b);
    const starts = times.filter((x, i) => i === 0 || x - (times[i - 1] as number) > ms);
    const delayMs = ((t.delay ?? 0) * 1000) / FPS;
    for (const first of starts) {
      const at = first - delayMs - 1000 / FPS;
      const near = (c: ReplayedCast) => c.operator === kit.operator && c.skillId === skill.skillId && c.start <= first && c.start >= first - ms;
      if ([...casts, ...added].some(near)) continue;
      added.push({ operator: kit.operator, key: skill.skillId, group: skill.skillId, skillId: skill.skillId, kind: skill.kind, start: Math.max(0, at), lastHit: Math.max(0, at), keepPrevious: false, landings: [] });
    }
  }
  return added.length ? ordered([...casts, ...added]) : [...casts];
}

/**
 * Casts the log shows only by a trigger's hits that need a buff from them: a kit trigger with hits whose condition reads
 * a buff (`buffActive`, or `operatorBuff` of a game buff) that one cast trigger of the team applies, on its owner's casts
 * of one skill. Each logged landing of the trigger's hits with no cast of that skill replayed within the buff's duration
 * before gets one (only for a skill that can run beside its operator's action), INFERRED_LEAD_FRAMES before the event that fired the trigger (the landing less its frame; the log's
 * milliseconds round to either frame). b6aa15281db4: Last
 * Rite's Mirage at 6141 ms (her perfusion's, on a Final Strike) with no battle skill in the log: cast inside her own
 * basic attack, it plays no timeline. Returns the casts with those added.
 */
/** How many frames before the event that fired a trigger an inferred cast comes (castsFromTriggerHits). */
const INFERRED_LEAD_FRAMES = 3;

export function castsFromTriggerHits(data: GameData, fx: LogFixture, kits: readonly OperatorKit[], casts: readonly ReplayedCast[]): ReplayedCast[] {
  const added: ReplayedCast[] = [];
  const reads = (p: unknown, out: { kit?: string; game?: string }[] = []): { kit?: string; game?: string }[] => {
    if (Array.isArray(p)) for (const x of p) reads(x, out);
    else if (p && typeof p === "object") {
      for (const [k, v] of Object.entries(p)) {
        if (k === "buffActive" && typeof v === "string") out.push({ kit: v });
        else if (k === "operatorBuff" && typeof v === "string") out.push({ game: v });
        else reads(v, out);
      }
    }
    return out;
  };
  for (const kit of kits) {
    for (const t of kit.triggers) {
      const hits = allActions(t.do).flatMap((a) => (a.kind === "hits" ? a.hits : []));
      if (!hits.length || !t.if) continue;
      for (const need of reads(t.if)) {
        // The buff and the one cast trigger of the team that applies it.
        const appliers = kits.flatMap((k) => k.triggers.flatMap((x) => allActions(x.do).flatMap((a) => {
          const def = a.kind === "buff" ? k.buffs.find((b) => b.id === a.buff) : undefined;
          const match = def && (need.kit ? k === kit && def.id === need.kit : def.gameBuff === need.game);
          const on = x.on;
          return match && on.event === "cast" && x.by === "self" && on.skills?.length ? [{ k, x, def, skills: on.skills }] : [];
        })));
        const skills = new Set(appliers.flatMap((a) => a.skills));
        if (skills.size !== 1) continue;
        const { k, x, def } = appliers[0] as (typeof appliers)[number];
        const skill = k.skills.find((sk) => sk.skillId === [...skills][0] && !sk.followUpOnly);
        const build = fx.team.find((b) => b.operator === k.operator);
        if (!skill || !build) continue;
        // Only a skill that can run beside its operator's action (KitSkill.beside: switchToBuffConfig, no timeline of its
        // own), the casts a log can lack: elsewhere a trigger landing later than the buff's reading lasts is the reading's
        // limit, not a missed cast (b7b3762d5da8: Tangtang's ultimate; a7a7a40c97ed: Arcane's combo; d9e59d0fb737, whose
        // kit leaves Typhoeus's ultimate key off).
        if (!skill.beside) continue;
        let ms: number;
        try {
          const b = applyBuff(data, build, computeStats(data, build), triggerSkillId(k.operator, x), def, 0);
          if (!b || !Number.isFinite(b.expiresAt)) continue;
          ms = (b.expiresAt * 1000) / FPS;
        } catch (e) {
          if (!readingDoesNotApply(e)) throw e;
          continue;
        }
        for (const h of hits) {
          const frame = Math.min(...(h.frames ?? [0]));
          for (const lh of fx.hits.filter((y) => y.operator === kit.operator && h.events.includes(y.event)).sort((a, b) => a.t - b.t)) {
            const at = Math.max(0, lh.t - ((frame + INFERRED_LEAD_FRAMES) * 1000) / FPS);
            const near = (c: ReplayedCast) => c.operator === k.operator && c.skillId === skill.skillId && c.start <= lh.t && c.start >= lh.t - ms;
            if ([...casts, ...added].some(near)) continue;
            added.push({ operator: k.operator, key: skill.skillId, group: skill.skillId, skillId: skill.skillId, kind: skill.kind, start: at, lastHit: at, keepPrevious: false, landings: [] });
          }
        }
      }
    }
  }
  return added.length ? ordered([...casts, ...added]) : [...casts];
}

/** How far apart two basic casts of one operator may be (ms, the first's last hit to the next's start) to be one run of its attacks. */
const RUN_GAP_MS = 1500;

/**
 * Who the log shows controlled, and the basic casts of the others (`teammate`: teammates attack on their own, slower;
 * the owner, 2026-10-26). Every basic-attack hit with Stagger is controlled-only (a Final Strike's: KitHit
 * poiseControlledOnly), so a logged one with Stagger (LogHit.poise) names the controlled operator then; teammates'
 * Final Strikes deal none (4e5e1390085e: Camille's attack 5 at 14516 ms, Gilberta's attack 4 at 13314 ms, while
 * Rossi's at 8.6, 16.2 and 23.4 s each deal 18). Between two such hits of different operators the swap is at the
 * start of the second one's run of basic casts (RUN_GAP_MS apart) that ends with it. Null when no hit names anyone (the
 * replay then makes each basic cast's operator the controlled one, as before).
 */
export function controlledFromLog(placement: Placement, casts: readonly ReplayedCast[]): { readonly first: string; readonly casts: ReplayedCast[] } | null {
  const c = controlSwaps(placement, casts);
  if (!c) return null;
  const controlledAt = (t: number) => c.swaps.filter((x) => x.at <= t).at(-1)?.operator ?? c.first;
  return { first: c.first, casts: casts.map((x) => (x.kind === "basic" && x.operator !== controlledAt(x.start) ? { ...x, teammate: true as const } : x)) };
}

/**
 * The evidence of controlledFromLog: the first operator the log shows controlled (and the hit that shows it), and each
 * swap (at the start of the new operator's run of basic casts ending with the hit that shows it). Null when no hit
 * names anyone. Also read by `zmdlogs control` (query.ts controlSpans).
 */
export function controlSwaps(placement: Placement, casts: readonly ReplayedCast[]): { readonly first: string; readonly firstEvidence: { readonly t: number; readonly event: string }; readonly swaps: readonly { readonly at: number; readonly operator: string; readonly evidence: { readonly t: number; readonly event: string } }[] } | null {
  const ofCast = (c: LoggedCast) => casts.find((d) => d.operator === c.operator && d.skillId === c.skillId && Math.abs(d.start - c.start) <= mergeMs(placement, c.skillId));
  const shown = [...placement.hits]
    .filter(([h, p]) => h.poise !== undefined && p.cast.kind === "basic" && p.hits.some((k) => k.poise !== undefined && k.poiseControlledOnly))
    .flatMap(([h, p]) => {
      const cast = ofCast(p.cast);
      return cast ? [{ t: h.t, operator: h.operator, cast, event: h.event }] : [];
    })
    .sort((a, b) => a.t - b.t);
  const first = shown[0];
  if (!first) return null;
  const swaps: { at: number; operator: string; evidence: { t: number; event: string } }[] = [];
  for (const [i, e] of shown.entries()) {
    const prev = shown[i - 1];
    if (!prev || prev.operator === e.operator) continue;
    const own = casts.filter((c) => c.operator === e.operator && c.kind === "basic" && c.start > prev.t && c.start <= e.cast.start).sort((a, b) => b.start - a.start);
    let start = e.cast;
    for (const c of own) if (c !== start && start.start - c.lastHit <= RUN_GAP_MS) start = c;
    swaps.push({ at: start.start, operator: e.operator, evidence: { t: e.t, event: e.event } });
  }
  return { first: first.operator, firstEvidence: { t: first.t, event: first.event }, swaps };
}

/** What the replay made of one of the log's cast events (loggedCastFates; `zmdlogs replay`'s EVENT lines). */
export interface LoggedCastFate {
  readonly t: number;
  readonly operator: string;
  readonly skill: string;
  /**
   * "placed": a placed cast's own event (`cast`: its start and the world time between, ms); "tick": a tick of a buff
   * (KitBuff.ticksLoggedAs) or "press" / "cast": added as a cast of its own (a slot press when the skill's hits show
   * elsewhere); "follow-up": a follow-up-only skill, left to the engine; "unknown": no kit skill of that id.
   */
  readonly fate: "placed" | "tick" | "press" | "cast" | "follow-up" | "unknown";
  readonly cast?: { readonly start: number; readonly world: number };
  /** "placed" as a cast of another skill of its kind, the variant the kit casts in its place (variantCastOf). */
  readonly variant?: string;
  readonly buff?: string;
}

/**
 * Each of the log's cast events with what the replay's cast assembly made of it (withLoggedCasts' choice, the same
 * matcher): a placed cast's own, a buff's tick, a press or cast of its own, or nothing. Round 5: Arcane's INT lasers'
 * events were silently taken as her combo's (2.4 s of world time away), found only with a debug print.
 */
export function loggedCastFates(data: GameData, fx: LogFixture, placement: Placement = placeHits(data, fx)): LoggedCastFate[] {
  const kits = fx.team.flatMap((b) => {
    const k = effectiveKit(data, b);
    return k ? [k] : [];
  });
  const followUps = new Set(kits.flatMap((k) => k.skills.filter((x) => x.followUpOnly).map((x) => `${k.operator}|${x.skillId}`)));
  const placed = replayedCasts(placement, fx).filter((c) => !followUps.has(`${c.operator}|${c.skillId}`));
  const stops = castTimeStops(data, placement.casts, castFrames(placement));
  const near = loggedCastMatcher(kits, stops);
  return (fx.casts ?? []).map((lc): LoggedCastFate => {
    const base = { t: lc.t, operator: lc.operator, skill: lc.skill };
    const kit = kits.find((k) => k.operator === lc.operator);
    const skill = kit?.skills.find((x) => x.skillId === lc.skill);
    if (!skill) return { ...base, fate: "unknown" };
    if (skill.followUpOnly) return { ...base, fate: "follow-up" };
    const c = placed.find((x) => near(x, lc, lc.skill));
    if (c) return { ...base, fate: "placed", cast: { start: c.start, world: Math.max(0, worldMs(Math.min(c.start, lc.t), Math.max(c.start, lc.t), stops)) } };
    const tick = kit?.buffs.find((d) => d.ticksLoggedAs === lc.skill);
    if (tick) return { ...base, fate: "tick", buff: tick.id };
    const shownElsewhere = skill.hits.some((h) => h.events.some((e) => fx.hits.some((x) => x.operator === lc.operator && x.event === e)));
    const variant = shownElsewhere ? undefined : variantCastOf(placed, fx, kit, skill, lc, near);
    if (variant) return { ...base, fate: "placed", cast: { start: variant.start, world: Math.max(0, worldMs(Math.min(variant.start, lc.t), Math.max(variant.start, lc.t), stops)) }, variant: variant.skillId };
    return { ...base, fate: shownElsewhere ? "press" : "cast" };
  });
}

/**
 * The time stops of casts the replay makes (a slot press only when made as a variant, `as`), each with whether the
 * placement has the cast from its hits (`placed`: false for one from its cast event or inferred, such as an ultimate
 * placed at its logged stop's end: db8711232de9's Laevatain at 16.60 s, which castTimeStops of the placed casts lacks).
 */
export function replayedCastStops(data: GameData, casts: readonly ReplayedCast[]): (TimeStop & { readonly placed: boolean })[] {
  return withResets(
    casts.flatMap((c) => {
      if (c.slot && c.as === undefined) return [];
      const skillId = c.as ?? c.skillId;
      // The kit frames of its landings (their hit and nth), which show the path it took (skillStops).
      const hits = data.kits.operators[c.operator]?.skills.find((s) => s.skillId === skillId)?.hits ?? [];
      const landed = c.landings.flatMap((l) => {
        const f = hits.find((h) => h.id === l.hitId)?.frames?.[l.nth];
        return f === undefined ? [] : [f];
      });
      const { stops, resets } = skillStops(data, skillId, Math.round((c.start * FPS) / 1000), { operator: c.operator, skillId, kind: c.kind }, landed);
      return [{ stops: stops.map((s) => ({ ...s, placed: c.landings.length > 0 && !c.listed })), resets }];
    }),
  );
}

/** A time stop of a cast the replay makes, and whether the placement has that cast from its hits. */
export interface ReplayTimeStop extends TimeStop {
  /** False for a cast the replay makes without placed hits: from a cast event (an ultimate at its stop: withLoggedCasts), or inferred. */
  readonly placed: boolean;
  /** A hitless cast event of a skill a kit buff of its operator ticks as (KitBuff.ticksLoggedAs), listed without a replay to say whether it was made (replayStops). */
  readonly tickRead?: true;
}

/** The skills a kit buff of their operator ticks as (KitBuff.ticksLoggedAs), as `operator|skillId`. */
export function tickSkills(kits: readonly OperatorKit[]): Set<string> {
  return new Set(kits.flatMap((k) => k.buffs.flatMap((d) => (d.ticksLoggedAs !== undefined ? [`${k.operator}|${d.ticksLoggedAs}`] : []))));
}

/** A cast's key for "the replay made it": its operator, skill and start (a made-cast record's `c` / `cast`). */
export const madeKey = (c: Pick<ReplayedCast, "operator" | "skillId" | "start">) => `${c.operator}|${c.skillId}|${c.start}`;

/**
 * The replay's stops: the one list of them, which the hidden-hold placement (buffreplay.ts replayKitBuffs) and the
 * world-time views (query.ts replayTimeStops) both read (bursts-and-cooldowns report point 1: the views counted a
 * hitless event the replay read as a buff's tick, Zhuang Fangyi's Empyrean end in 4d60e7fe92c2 at 106.47 s, as a
 * 78-frame stop the placement left out, and a ruling-out rested on the 2.6 s). With `made` (the casts a replay made:
 * BuffReplay.made, a run's made), a hitless cast of a skill a kit buff ticks as (KitBuff.ticksLoggedAs) that the replay
 * didn't make is that buff's tick, never a stop: it is left out before the resets cut the list, and `ticks` names it.
 * Without, it stays, its stops marked `tickRead` (a view without the replay says so).
 */
export function replayStops(data: GameData, kits: readonly OperatorKit[], casts: readonly ReplayedCast[], made?: readonly Pick<ReplayedCast, "operator" | "skillId" | "start">[]): { readonly stops: ReplayTimeStop[]; readonly ticks: readonly ReplayedCast[] } {
  const ticksAs = tickSkills(kits);
  if (!made) return { stops: replayedCastStops(data, casts).map((st) => (!st.placed && ticksAs.has(`${st.operator}|${st.skillId}`) ? { ...st, tickRead: true as const } : st)), ticks: [] };
  const done = new Set(made.map(madeKey));
  const ticked = (c: ReplayedCast) => c.landings.length === 0 && ticksAs.has(`${c.operator}|${c.skillId}`) && !done.has(madeKey(c));
  return { stops: replayedCastStops(data, casts.filter((c) => !ticked(c))), ticks: casts.filter(ticked) };
}

/**
 * The casts the replay makes, before control and the casts that hit nothing: the placed casts (not follow-up-only
 * skills), the log's hitless cast events it lacks (withLoggedCasts), and the casts inferred from buff lanes, trigger
 * hits, buff ends and exits (castsFromBuffLanes, castsFromTriggerHits, castsFromBuffEnds, exitPresses), and the presses
 * that pull a buff (pullingPresses).
 */
export function assembleCasts(data: GameData, fx: LogFixture, placement: Placement, kits: readonly OperatorKit[], assume: Readonly<Record<string, string>> = {}): ReplayedCast[] {
  if (kits.length === 0) return [];
  const followUps = new Set(kits.flatMap((k) => k.skills.filter((s) => s.followUpOnly).map((s) => `${k.operator}|${s.skillId}`)));
  // Engine assumption listed-casts: with `inferred`, the casts the log shows only by a buff one of their hits alone gives.
  const listedCasts = (assume["listed-casts"] ?? ENGINE_ASSUMPTIONS.find((a) => a.id === "listed-casts")?.default) === "inferred";
  const paths = listedPaths(data, kits, fx, castsBeforeLog(kits, fx, placement, exitPresses(kits, fx, pullingPresses(kits, placement, castsFromBuffEnds(kits, placement, castsFromTriggerHits(data, fx, kits, castsFromBuffLanes(data, fx, kits, withLoggedCasts(replayedCasts(placement, fx).filter((c) => !followUps.has(`${c.operator}|${c.skillId}`)), fx, kits, data, castTimeStops(data, placement.casts, castFrames(placement))))))))));
  return listedCasts ? castsFromHitBuffs(kits, fx, paths) : paths;
}

/**
 * Casts made before the log began: a buff a cast opens (a trigger on the cast's skill, `delay` frames on, with a `buff`
 * action) whose ticks the log shows by their hits (KitBuff.ticksShownByHits), its first shown tick before any cast of
 * that skill with landings could have opened it. The skill was cast before the log: at the earliest listing of a game
 * buff its hits apply (its `since`, less that hit's frame) when the log lists one from before its start, else at the
 * first shown tick less the trigger's delay (and an interval more without KitBuff.tickOnApply); no later than its last
 * hit's frame before the log (the log has none of them). Not where a cast of the skill (its hits placed, or a logged
 * cast event that isn't the tick's own, at its first hit's ms) could have opened it (c6d80590f5ea: Liino's battle skill
 * logged at 2020 ms, its stance ATK listed from 2497 ms, its projectiles hitting nothing). Liino's Vocalist Stance: 4d60e7fe92c2 lists her stance ATK
 * since -811 ms and its first volley lands at 1354 ms, 791020039384 since -576 ms (1898 ms), 1d9198480e75 lists none
 * of her buffs (1990 ms); the replay made the stance at the volley's cast event instead (the volley's own: an event at
 * its first hit's ms), so its first volley landed nowhere and the stance's projectiles and volley came as its own.
 */
export function castsBeforeLog(kits: readonly OperatorKit[], fx: Pick<LogFixture, "hits">, placement: Placement, casts: readonly ReplayedCast[]): ReplayedCast[] {
  const added: ReplayedCast[] = [];
  for (const kit of kits) {
    for (const def of kit.buffs) {
      if (!def.ticksShownByHits || def.every === undefined) continue;
      const opener = kit.triggers.find((t) => t.on.event === "cast" && t.by === "self" && t.on.skills?.length === 1 && allActions(t.do).some((a) => a.kind === "buff" && a.buff === def.id));
      const ticks = kit.triggers.filter((t) => t.on.event === "buffTick" && "buff" in t.on && t.on.buff === def.id).map((t) => `trigger:${t.id}`);
      const skillId = opener && "skills" in opener.on ? opener.on.skills?.[0] : undefined;
      const skill = kit.skills.find((x) => x.skillId === skillId);
      if (!opener || !skill || ticks.length === 0) continue;
      // Its hits' buffs listed from before the log (`since` < 0): the earliest, less the hit's frame.
      const fromListing = skill.hits.flatMap((h) => (h.buffs ?? []).flatMap((b) => {
        const d = kit.buffs.find((x) => x.id === b.buff);
        const names = new Set(d ? loggedNames(d) : []);
        const frame = Math.min(...(loggedFrames(h) ?? [0]));
        return fx.hits.flatMap((x) => x.effects.flatMap((e) => (names.has(e.buff) && e.since !== undefined && e.since < 0 ? [e.since - (frame * 1000) / FPS] : [])));
      }));
      const lastHit = Math.max(0, ...skill.hits.flatMap((h) => loggedFrames(h) ?? []));
      const before = -((lastHit + 1) * 1000) / FPS;
      let start: number;
      if (fromListing.length) {
        // Not when a cast with hits in the log made it (9090afbacec9: Liino's projectiles at 275 ms, her stance ATK listed
        // since -185 ms).
        start = Math.min(...fromListing, before);
        if (casts.some((c) => c.operator === kit.operator && c.skillId === skill.skillId && c.landings.length > 0 && c.start <= start + LOGGED_CAST_MS)) continue;
      } else {
        const first = placement.casts.filter((c) => c.operator === kit.operator && ticks.includes(c.group)).sort((x, y) => x.start - y.start)[0];
        if (first === undefined || (!def.tickOnApply && typeof def.every !== "number")) continue;
        const shown = first.start;
        // The tick's own landing: a cast event at its first logged hit's ms is the tick's (Liino's volley), not a cast.
        const landsAt = Math.min(...[...placement.hits].filter(([, p]) => p.cast === first).map(([h]) => h.t));
        const delayMs = ((opener.delay ?? 0) * 1000) / FPS;
        // Any cast of the skill that could have opened it (a logged event or placed hits) up to its first shown tick.
        if (casts.some((c) => c.operator === kit.operator && c.skillId === skill.skillId && c.start <= shown - delayMs + LOGGED_CAST_MS && Math.abs(c.start - landsAt) > 1000 / FPS)) continue;
        start = Math.min(shown - delayMs - (def.tickOnApply ? 0 : (def.every as number) * 1000), before);
      }
      added.push({ operator: kit.operator, key: skill.skillId, group: skill.skillId, skillId: skill.skillId, kind: skill.kind, start: Math.round(start), lastHit: Math.round(start), keepPrevious: false, landings: [], beforeLog: true });
    }
  }
  return added.length ? [...added, ...casts] : [...casts];
}

/** How close (ms) to a cast's batched landings' ms (LoggedCast.beforeStop) a logged hit of it is one of them. */
const BATCHED_MS = 50;

/**
 * Where a logged hit landed when the log batched it with an operator's cast's landings at another cast's stop's end
 * (LoggedCast.beforeStop): at that cast's first landing (what the hit set off, its reaction or a trigger's hit, landed
 * with it), else null.
 */
export function batchedFrame(casts: readonly ReplayedCast[], h: Pick<LogHit, "t" | "operator">): number | null {
  const c = casts.find((x) => x.operator === h.operator && x.beforeStop !== undefined && Math.abs(h.t - x.beforeStop) <= BATCHED_MS && x.landings.length > 0);
  return c ? Math.min(...c.landings.map((l) => l.frame)) : null;
}

/**
 * The logged casts (distinctCasts) as the replay casts them, in time order,
 * each with its logged landings: the timeline lands the cast's hits the log
 * shows at their logged frames (the log's time has other casts' time stops
 * and hit-stop in it), the others at their kit frames. `unpinned`, when given, gets why a placed hit has no pinned
 * landing (by its ref), for BuffReplay.droppedLanding.
 */
export function replayedCasts(placement: Placement, fx?: Pick<LogFixture, "hits">, unpinned?: Map<string, string>): ReplayedCast[] {
  const casts = distinctCasts(placement);
  // A landing's reference: its logged hit's index in the fixture (replayCast `ref`: its LandedHit carries it).
  const hitIndex = new Map((fx?.hits ?? [...placement.hits.keys()]).map((h, i) => [h, i]));
  // Its own cast, else the one it merged into (distinctCasts: the same skill placed from another key, within mergeMs).
  const ofCast = (c: LoggedCast): LoggedCast | undefined => (casts.includes(c) ? c : casts.find((d) => d.operator === c.operator && d.skillId === c.skillId && Math.abs(d.start - c.start) <= mergeMs(placement, c.skillId)));
  const last = new Map<LoggedCast, number>();
  const landings = new Map<LoggedCast, { hitId: string; nth: number; frame: number; ref: string; ms: number }[]>();
  const used = new Map<string, Set<number>>();
  for (const [h, p] of [...placement.hits].sort((a, b) => a[0].t - b[0].t)) {
    const d = ofCast(p.cast);
    if (!d) {
      unpinned?.set(String(hitIndex.get(h)), `no pinned landing: its placed cast (${p.cast.skillId} from ${(p.cast.start / 1000).toFixed(2)} s) isn't one the replay casts (distinctCasts)`);
      continue;
    }
    // A delayed hit's damage (KitHit.enemyDelay) lands whatever comes after its cast: it doesn't show the cast going on.
    if (!p.hits.every((k) => k.enemyDelay !== undefined)) last.set(d, Math.max(last.get(d) ?? -Infinity, h.t));
    if (p.frame === undefined || p.cast.skillId !== d.skillId) continue;
    for (const k of p.hits) {
      const frames = loggedFrames(k) ?? [];
      // The n-th landing of the kit hit at the slot's frame not taken yet (several landings may share a frame).
      const key = `${d.operator}|${d.start}|${k.id}`;
      const taken = used.get(key) ?? new Set<number>();
      // Another variant's hit at its own frame for the slot's turn (Slot.at: Zhuang Fangyi's strike_8 against strike_9's slots).
      const frame = p.at?.get(k) ?? p.frame;
      const nth = frames.findIndex((f, i) => f === frame && !taken.has(i));
      if (nth < 0) {
        unpinned?.set(String(hitIndex.get(h)), `no pinned landing: its slot's frame ${frame} is no landing of ${k.id} left (its frames ${frames.join(",") || "none"}${taken.size ? `, ${taken.size} taken by earlier hits of the cast` : ""})`);
        continue;
      }
      taken.add(nth);
      used.set(key, taken);
      // Batched at another cast's stop's end, it landed at its kit frame before the stop (LoggedCast.beforeStop).
      const at = d.beforeStop !== undefined && Math.abs(h.t - d.beforeStop) <= BATCHED_MS ? frameOf(d.start) + p.frame : frameOf(h.t);
      landings.set(d, [...(landings.get(d) ?? []), { hitId: k.id, nth, frame: at, ref: String(hitIndex.get(h)), ms: h.t }]);
    }
  }
  const out: ReplayedCast[] = [];
  const previous = new Map<string, ReplayedCast>();
  for (const c of casts) {
    const prev = previous.get(c.operator);
    const r: ReplayedCast = { ...c, lastHit: last.get(c) ?? c.start, keepPrevious: prev !== undefined && prev.lastHit > c.start, landings: landings.get(c) ?? [] };
    previous.set(c.operator, r);
    out.push(r);
  }
  return out;
}
