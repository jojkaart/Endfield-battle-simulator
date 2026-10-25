// The kit-buff replay of a logged fight (owner, 2026-10-22: "our engine
// should not rely on the log data for activating buffs. It should activate
// them based on the events that should trigger them."). The logged casts
// (logcasts.ts: operator, skill, start) are cast again in the engine's
// timeline at their logged frames, their logged landings at the logged
// frames (timeline.ts replayCast); their hits, the enemy's statuses, SP and
// the kits' triggers then run as in a simulation, and the instances of the
// kit buffs that stand for a game buff (KitBuff.gameBuff) are read off the
// timeline's state. The log check (logcheck.ts) takes their activity instead
// of the log's listing for the buffs the replay decides, and reports where
// the two disagree (leads: a log gap, or a kit trigger that's wrong).

import {
  activeAt, advance, allActions, applyBuff, Attr, buffModifiers, computeStats, createContext, kitHitEntries, readingDoesNotApply, triggerSkillId, effectiveKit, FPS, init, reaches, replayCast, replayWindowCount,
  type ActiveBuff, type GameData, type KitBuff, type KitTrigger, type LandedHit, type Modifier, type OperatorKit, type SkillType, type TimelineScenario, type TimelineState,
} from "@efsim/engine";
import { isBuffFileListed, readBuffFile, type LogEffect, type LogFixture, type LogHit } from "@efsim/data";
import { distinctCasts, landingFrames, type LoggedCast, type Placement } from "./logcasts.ts";

/**
 * How sure the replay is of when its buffs start and end. A start is a
 * logged landing's (or a trigger's on one), within REPLAY_EDGE_MS. An end by
 * expiry is less sure the longer the instance lasted: the timeline extends
 * buffs by every time stop in full and doesn't model hit-stop, and the logs
 * disagree with both (4e5e1390085e: Estella's Physical Susceptibility, 9 s,
 * lasts 10.1 s in the log across her ultimate's 1.8 s time stop and 10.0 s
 * without one; Gilberta's weapon buff, 15 s, 16.1 s and 16.15 s), so it gets
 * REPLAY_EXPIRY_SLACK of the instance's life on top. Within that of a change
 * in the replay's count the replay doesn't decide, and the log's listing
 * stands.
 */
export const REPLAY_EDGE_MS = 500;

/** How far (frames) a landing a trigger made may be from a logged hit it is taken for (its trigger's own timing drifts from the log's). */
const NEAR_FRAMES = 16;
export const REPLAY_EXPIRY_SLACK = 0.1;

/** Trigger events a log doesn't let the replay judge: the enemy's own actions. */
const UNJUDGED_EVENTS: ReadonlySet<string> = new Set(["attacked", "perfectDodge", "enemyCharge"]);

/**
 * Why the replay can't judge a trigger (it has no rolls or enemy actions), or null. Crits it has from the log
 * (TimelineScenario.loggedCrits); where a landing's crit isn't logged, the buffs crits apply are undecided for a while
 * (critTriggers, BuffReplay.instances).
 */
function unjudged(t: KitTrigger, kit: OperatorKit): string | null {
  if (UNJUDGED_EVENTS.has(t.on.event)) return `${t.id}: on ${t.on.event}`;
  if (t.chance !== undefined) return `${t.id}: a chance`;
  // Whom a heal reaches when it heals the controlled operator: the log doesn't record who's controlled (the replay takes
  // the last to make a basic attack; 0eef2474a26f: Liino's weapon buff on her heals' targets, Typhoeus and Si in the log,
  // Arcane in the replay).
  if (t.on.event === "heal" && (t.by !== "self" || healsControlled(kit))) return `${t.id}: on heals of the controlled operator, whom the log doesn't name`;
  return null;
}

/** Whether any of a kit's heals (its hits', its triggers') heals the controlled operator. */
function healsControlled(kit: OperatorKit): boolean {
  return kitHitEntries(kit).some((e) => e.hit.heals === "controlled") || kit.triggers.some((t) => allActions(t.do).some((a) => a.kind === "heal" && a.target === "controlled"));
}

/**
 * The triggers on crits behind one of a kit's buffs: those that apply it on a crit, and those behind a buff a trigger
 * that applies it listens to (to a depth of a few links). Whose hits each listens to (KitTrigger.by).
 */
function critTriggers(kit: OperatorKit, buffId: string, depth = 0): KitTrigger[] {
  if (depth > 4) return [];
  return kit.triggers.flatMap((t) => {
    if (!allActions(t.do).some((a) => a.kind === "buff" && a.buff === buffId)) return [];
    return [...(t.on.event === "hit" && t.on.crit !== undefined ? [t] : []), ...("buff" in t.on && t.on.buff !== buffId ? critTriggers(kit, t.on.buff, depth + 1) : [])];
  });
}

/**
 * Why the replay can't decide one of a kit's buffs, or null: a trigger that
 * applies it can't be judged, or listens to a buff that can't (to a depth of
 * a few such links).
 */
function undecidedBuff(kit: OperatorKit, buffId: string, depth = 0): string | null {
  if (depth > 4) return null;
  for (const t of kit.triggers) {
    if (!allActions(t.do).some((a) => a.kind === "buff" && a.buff === buffId)) continue;
    const own = unjudged(t, kit);
    if (own) return own;
    if ("buff" in t.on && t.on.buff !== buffId) {
      const via = undecidedBuff(kit, t.on.buff, depth + 1);
      if (via) return `${t.id} via ${via}`;
    }
  }
  return null;
}

export interface BuffReplay {
  /** Game buffs the replay decides, each with the team's kit buffs that stand for it (`operator:kit buff`). */
  readonly decided: ReadonlyMap<string, readonly string[]>;
  /** Game buffs a kit defines and the log lists that the replay can't decide, and why. */
  readonly undecided: ReadonlyMap<string, string>;
  /** Logged casts the engine couldn't cast (its error). */
  readonly failed: readonly { readonly cast: ReplayedCast; readonly error: string }[];
  /** Replayed instances of a decided game buff reaching a logged hit's operator (or on the enemy) at it; null near a change (REPLAY_EDGE_MS). */
  instances(hit: Pick<LogHit, "t" | "operator">, gameBuff: string): number | null;
  /** What the replay knows of a logged cast (placed: logcasts.ts), or why it knows nothing. */
  castFacts(cast: Pick<LoggedCast, "operator" | "skillId" | "start" | "kind">): ReplayCastFacts | { readonly unknown: string };
  /** A logged hit's landing in the replay (its damage, modifiers and LandingFacts), or why there is none. */
  landing(hit: LogHit): LandedHit | { readonly unknown: string };
}

/** A fact the replay knows, or why it doesn't (the log check then tries alternatives, labelled with the reason). */
export type Fact<T> = { readonly value: T } | { readonly unknown: string };

/** The kit buffs a cast consumed (ActiveBuff with `cast`: they act on its hits only): their IDs (an ID per instance) and their modifiers on the caster's hits (buffModifiers). */
export interface ConsumedBuffs {
  readonly buffs: readonly string[];
  readonly modifiers: readonly Modifier[];
}

/**
 * What the replay knows of one logged cast: facts the log doesn't list, which the log check reads instead of trying
 * alternatives. A fact the replay's own timing could change (a Link stack or a consumable buff starting, ending or
 * used by another cast within REPLAY_EDGE_MS of the cast, as for the kit buffs it decides) is unknown.
 */
export interface ReplayCastFacts {
  /** Its index in the replay's cast list. */
  readonly index: number;
  /** The Link stacks it used (Cast.link; 0: none). */
  readonly link: Fact<number>;
  /** A combo's window count as the replay had it open (unknown when the replay saw no window: replayCast opens one counting 1). */
  readonly windowCount: Fact<number>;
  /** The kit buffs it consumed (KitBuff.consumedBy: they act on its hits only). */
  readonly consumed: Fact<ConsumedBuffs>;
}

/** The facts of a trigger's hits: of no cast (timeline.ts: a trigger's `hits` action lands hits without one). */
const TRIGGERED: ReplayCastFacts = { index: -1, link: { value: 0 }, windowCount: { unknown: "a trigger's hits, of no cast" }, consumed: { value: { buffs: [], modifiers: [] } } };

/** The game buffs the log lists with values somewhere (effects or boundary effects). */
function listedWithValues(fx: LogFixture): Set<string> {
  return new Set(fx.hits.flatMap((h) => [...h.effects, ...h.boundaryEffects].map((e) => e.buff)));
}

/**
 * The enemy's HP over the fight from the logged damage (TimelineScenario.enemyHp), in steps of 1% of its Max HP; only
 * when the logged damage is its Max HP (a fight against several phases or enemies of the type doesn't say whose HP).
 */
function loggedEnemyHp(data: GameData, fx: LogFixture): TimelineScenario["enemyHp"] {
  const max = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp];
  if (!max || Math.abs(fx.hits.reduce((s, h) => s + h.value, 0) / max - 1) > 1e-3) return undefined;
  const out: { from: number; fraction: number }[] = [];
  let dealt = 0;
  let step = 100;
  for (const h of [...fx.hits].sort((a, b) => a.t - b.t)) {
    dealt += h.value;
    const fraction = Math.max(0, 1 - dealt / max);
    if (Math.floor(fraction * 100) < step) {
      step = Math.floor(fraction * 100);
      out.push({ from: Math.round((h.t * FPS) / 1000) + 1, fraction });
    }
  }
  return out;
}

const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);

/** A logged cast as the replay casts it. */
export interface ReplayedCast extends LoggedCast {
  /** Its last logged hit, in ms. */
  readonly lastHit: number;
  /** The operator's cast before it keeps its hits to come: the log has them landing after this one started (replayCast keepPrevious). */
  readonly keepPrevious: boolean;
  /** Its landings at their logged frames (replayCast landings): each logged hit of the cast whose kit landing the placement knows. */
  readonly landings: readonly { readonly hitId: string; readonly nth: number; readonly frame: number; readonly ref: string }[];
}

/** How far from a placed cast's start a logged cast event of its skill may be to be that cast (ms). */
export const LOGGED_CAST_MS = 2500;

/**
 * The replay's casts with the casts the log records without damage (LogFixture.casts) that it lacks: a logged cast of
 * a kit skill whose damage the log never shows for its operator, with no placed cast of the skill within LOGGED_CAST_MS
 * (40d9a3c1da37: Laevatain's ultimate at 3041 ms, whose damage comes as her enhanced attacks). A skill whose hits the
 * log shows elsewhere isn't added where it doesn't (it may be a variant the kit models otherwise: 0eef2474a26f, Liino's
 * battle skill at 4187 ms, whose only damage is her talent's volley); a placed cast keeps its start (the log's cast
 * event can come before the skill acts: Liino's battle skill at 760 ms, its buffs at 1314 ms). Follow-up-only skills
 * are left to the engine.
 */
export function withLoggedCasts(casts: readonly ReplayedCast[], fx: Pick<LogFixture, "casts" | "hits">, kits: readonly OperatorKit[]): ReplayedCast[] {
  if (!fx.casts?.length) return [...casts];
  const logged = new Set(fx.hits.map((h) => `${h.operator}|${h.event}`));
  const added: ReplayedCast[] = [];
  for (const lc of fx.casts) {
    const skill = kits.find((k) => k.operator === lc.operator)?.skills.find((x) => x.skillId === lc.skill);
    if (!skill || skill.followUpOnly || skill.hits.some((h) => h.events.some((e) => logged.has(`${lc.operator}|${e}`)))) continue;
    if (casts.some((c) => c.operator === lc.operator && c.skillId === lc.skill && Math.abs(c.start - lc.t) <= LOGGED_CAST_MS)) continue;
    added.push({ operator: lc.operator, key: lc.skill, group: lc.skill, skillId: lc.skill, kind: skill.kind, start: lc.t, lastHit: lc.t, keepPrevious: false, landings: [] });
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
 * The logged casts (distinctCasts) as the replay casts them, in time order,
 * each with its logged landings: the timeline lands the cast's hits the log
 * shows at their logged frames (the log's time has other casts' time stops
 * and hit-stop in it), the others at their kit frames.
 */
export function replayedCasts(placement: Placement, fx?: Pick<LogFixture, "hits">): ReplayedCast[] {
  const casts = distinctCasts(placement);
  // A landing's reference: its logged hit's index in the fixture (replayCast `ref`: its LandedHit carries it).
  const hitIndex = new Map((fx?.hits ?? [...placement.hits.keys()]).map((h, i) => [h, i]));
  const ofCast = (c: LoggedCast): LoggedCast | undefined => casts.find((d) => d.operator === c.operator && d.skillId === c.skillId && Math.abs(d.start - c.start) <= 1000);
  const last = new Map<LoggedCast, number>();
  const landings = new Map<LoggedCast, { hitId: string; nth: number; frame: number; ref: string }[]>();
  const used = new Map<string, Set<number>>();
  for (const [h, p] of [...placement.hits].sort((a, b) => a[0].t - b[0].t)) {
    const d = ofCast(p.cast);
    if (!d) continue;
    last.set(d, Math.max(last.get(d) ?? -Infinity, h.t));
    if (p.frame === undefined || p.cast.skillId !== d.skillId) continue;
    for (const k of p.hits) {
      const frames = landingFrames(k) ?? [];
      // The n-th landing of the kit hit at the slot's frame not taken yet (several landings may share a frame).
      const key = `${d.operator}|${d.start}|${k.id}`;
      const taken = used.get(key) ?? new Set<number>();
      const nth = frames.findIndex((f, i) => f === p.frame && !taken.has(i));
      if (nth < 0) continue;
      taken.add(nth);
      used.set(key, taken);
      landings.set(d, [...(landings.get(d) ?? []), { hitId: k.id, nth, frame: frameOf(h.t), ref: String(hitIndex.get(h)) }]);
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

/** One replayed instance of a kit buff reaching an operator, in frames; `expired`: it ran out (not ended or replaced early). */
interface Instance {
  readonly start: number;
  readonly end: number;
  readonly expired: boolean;
}

/** A change in a buff's replayed instances at an operator: when, by how many, and how sure (± frames). */
interface Change {
  readonly frame: number;
  readonly delta: number;
  readonly slack: number;
}

/**
 * Replays a logged fight's casts through the timeline (see the file
 * comment). Casts of skills only their own skill casts (KitSkill.followUpOnly)
 * are left to the engine; crits are never rolled (crit-triggered buffs are
 * left to the log: `undecided`). The state is read at every logged hit and
 * REPLAY_EDGE_MS either side of it.
 */
export function replayKitBuffs(data: GameData, fx: LogFixture, placement: Placement): BuffReplay {
  const listed = listedWithValues(fx);
  const kits = fx.team.flatMap((b) => {
    const k = effectiveKit(data, b);
    return k ? [k] : [];
  });
  const decided = new Map<string, string[]>();
  const undecided = new Map<string, string>();
  for (const kit of kits) {
    for (const def of kit.buffs) {
      if (!def.gameBuff || !listed.has(def.gameBuff) || def.consumedBy || def.link) continue;
      const why = undecidedBuff(kit, def.id);
      if (why) undecided.set(def.gameBuff, `${kit.operator} ${why}`);
      else decided.set(def.gameBuff, [...(decided.get(def.gameBuff) ?? []), `${kit.operator}:${def.id}`]);
    }
  }
  for (const g of undecided.keys()) decided.delete(g);
  const failed: { cast: ReplayedCast; error: string }[] = [];
  const edge = frameOf(REPLAY_EDGE_MS);
  const team = fx.team.map((b) => b.operator);
  // What the replay knows of each cast and logged landing (the log check reads them: castFacts, landing).
  const facts = new Map<ReplayedCast, ReplayCastFacts>();
  const failedCasts = new Set<ReplayedCast>();
  const landed = new Map<string, LandedHit>();
  const kitIds = [...decided].flatMap(([g, defs]) => defs.map((d) => ({ g, owner: d.split(":", 2)[0] as string, id: d.split(":", 2)[1] as string })));
  // Game buffs a trigger on crits is behind (critTriggers): where a landing's crit isn't logged, the replay bounds them.
  const critDependent = new Set(kitIds.filter(({ owner, id }) => critTriggers(kits.find((k) => k.operator === owner) as OperatorKit, id).length > 0).map((x) => x.g));
  const followUps = new Set(kits.flatMap((k) => k.skills.filter((s) => s.followUpOnly).map((s) => `${k.operator}|${s.skillId}`)));
  const casts: ReplayedCast[] = kits.length > 0 ? castsFromBuffLanes(data, fx, kits, withLoggedCasts(replayedCasts(placement, fx).filter((c) => !followUps.has(`${c.operator}|${c.skillId}`)), fx, kits)) : [];
  const sampleFrames = [...new Set(fx.hits.flatMap((h) => [frameOf(h.t) - edge, frameOf(h.t), frameOf(h.t) + edge]))].filter((f) => f >= 0).sort((a, b) => a - b);
  type Made = { c: ReplayedCast; f: number; pre: TimelineState; index: number; link: number; windowCount: number | null; consumed: ConsumedBuffs };
  /**
   * One replay of the logged casts. Landings whose crit the log gives crit as it says (TimelineScenario.loggedCrits);
   * the others as `crit` says: never for the replay the check reads, always for the bound on the buffs a trigger on crits
   * is behind (critDependent: where the two disagree, the replay doesn't decide them).
   */
  const run = (crit: "never" | "always") => {
    // Per game buff and operator: its instances (summed over the kit buffs standing for it: theirs don't overlap at one recipient).
    const instances = new Map<string, Instance[]>();
    let brokenAt: number | null = null;
    const firstBasic = casts.find((c) => c.kind === "basic");
    const enemyHp = loggedEnemyHp(data, fx);
    const scenario: TimelineScenario = {
      team: fx.team,
      target: { enemy: fx.enemy.id, level: fx.enemy.level },
      durationFrames: (sampleFrames.at(-1) ?? 0) + 1,
      rotation: [],
      options: { crit },
      ...(firstBasic ? { controlled: firstBasic.operator } : {}),
      ...(enemyHp?.length ? { enemyHp } : {}),
      loggedCrits: fx.hits.flatMap((h) => (h.crit === null ? [] : [{ operator: h.operator, event: h.event, frame: frameOf(h.t), crit: h.crit }])),
    };
    const ctx = createContext(data, scenario);
    let st: TimelineState = init(ctx);
    // The instances seen at the last sample, by identity (kit buff, owner, start, recipients, and which of several at one start).
    const open = new Map<string, { key: string; owner: string; id: string; start: number; expiresAt: number }>();
    const close = (key: string, start: number, end: number, expired: boolean) => instances.set(key, [...(instances.get(key) ?? []), { start, end, expired }]);
    const sample = (frame: number) => {
      const seen = new Map<string, { key: string; owner: string; id: string; start: number; expiresAt: number }>();
      for (const { g, owner, id } of kitIds) {
        const live = st.buffs.filter((b: ActiveBuff) => b.id === id && b.owner === owner && b.cast === undefined && b.appliedAt <= frame && b.expiresAt > frame);
        for (const op of team) {
          const counted = new Map<string, number>();
          for (const b of live) {
            if (!reaches(b, op)) continue;
            const base = `${g}|${op}#${owner}|${id}|${b.appliedAt}|${b.recipients?.join(",") ?? ""}`;
            const n = counted.get(base) ?? 0;
            counted.set(base, n + 1);
            seen.set(`${base}|${n}`, { key: `${g}|${op}`, owner, id, start: b.appliedAt, expiresAt: b.expiresAt });
          }
        }
      }
      for (const [k, rec] of open) {
        if (seen.has(k)) continue;
        // Gone: it ran out, or ended early (used up, or replaced by a new instance at its start: the replacement's start is its end).
        const expired = rec.expiresAt <= frame;
        const replacement = [...seen.values()].filter((x) => x.key === rec.key && x.owner === rec.owner && x.id === rec.id && x.start > rec.start && x.start <= frame).map((x) => x.start);
        close(rec.key, rec.start, expired ? rec.expiresAt : replacement.length ? Math.max(...replacement) : frame, expired);
      }
      open.clear();
      for (const [k, v] of seen) open.set(k, v);
    };
    // Casts and samples in frame order; a cast before a sample at its frame (its frame-0 hits land first).
    const steps = [
      ...casts.map((c) => ({ frame: Math.max(0, frameOf(c.start)), cast: c as ReplayedCast | null })),
      ...sampleFrames.map((frame) => ({ frame, cast: null as ReplayedCast | null })),
    ].sort((a, b) => a.frame - b.frame || (a.cast ? 0 : 1) - (b.cast ? 0 : 1));
    // The state after each step, for the facts' check at REPLAY_EDGE_MS either side of a cast (stateAt).
    const checkpoints: TimelineState[] = [st];
    const made: Made[] = [];
    const castErrors: { cast: ReplayedCast; error: string }[] = [];
    for (const s of steps) {
      if (checkpoints.at(-1) !== st) checkpoints.push(st);
      if (s.cast) {
        const c = s.cast;
        try {
          const f = Math.max(s.frame, st.frame);
          st = advance(ctx, st, f);
          const windowCount = c.kind === "combo" ? replayWindowCount(ctx, st, c.operator, c.skillId, f) : null;
          const pre = st;
          st = replayCast(ctx, st, c.operator, c.skillId, f, { keepPrevious: c.keepPrevious, landings: c.landings });
          const index = st.casts.findLastIndex((x) => x.frame === f && x.operator === c.operator && x.skill === c.skillId);
          const carried = st.buffs.filter((b) => b.cast === index && b.id !== "link");
          const consumed: ConsumedBuffs = { buffs: carried.map((b) => b.id).sort(), modifiers: buffModifiers(carried, c.operator, f, index) };
          made.push({ c, f, pre, index, link: st.casts[index]?.link ?? 0, windowCount, consumed });
        } catch (e) {
          castErrors.push({ cast: c, error: e instanceof Error ? e.message : String(e) });
        }
        continue;
      }
      try {
        st = advance(ctx, st, Math.max(s.frame, st.frame));
      } catch (e) {
        // The timeline can't go on (a hit it can't land from what the replay knows): it decides nothing from here.
        brokenAt = s.frame;
        castErrors.push({ cast: casts.filter((c) => frameOf(c.start) <= s.frame).at(-1) as ReplayedCast, error: `the replay stops at ${Math.round((s.frame * 1000) / FPS)} ms: ${e instanceof Error ? e.message : String(e)}` });
        break;
      }
      sample(s.frame);
    }
    for (const rec of open.values()) close(rec.key, rec.start, brokenAt ?? rec.expiresAt, brokenAt === null && Number.isFinite(rec.expiresAt));
    if (checkpoints.at(-1) !== st) checkpoints.push(st);
    return { ctx, st, instances, brokenAt, made, checkpoints, castErrors, changes: countChanges(instances, edge) };
  };
  const main = kits.length > 0 ? run("never") : null;
  // The bound for buffs a trigger on crits is behind: only needed where some landing's crit isn't logged.
  const bound = main && critDependent.size > 0 && main.st.hits.some((h) => h.loggedCrit === null) ? run("always") : null;
  const brokenAt = main ? (bound?.brokenAt !== null && bound?.brokenAt !== undefined ? Math.min(main.brokenAt ?? Infinity, bound.brokenAt) : main.brokenAt) : null;
  if (main) {
    const { ctx, st, made, checkpoints } = main;
    for (const e of main.castErrors) {
      failed.push(e);
      if (!e.error.startsWith("the replay stops")) failedCasts.add(e.cast);
    }
    for (const h of st.hits) if (h.ref !== undefined) landed.set(h.ref, h);
    // Landings a trigger made (not pinned): each logged hit without a pinned landing takes the nearest of its operator's
    // with its event, within NEAR_FRAMES, in time order (each landing once).
    const eventsOf = new Map(kits.flatMap((k) => kitHitEntries(k).map((e) => [`${k.operator}|${e.skillId}|${e.hit.id}`, e.hit.events] as const)));
    const free = st.hits.filter((h) => h.ref === undefined && h.facts);
    const taken = new Set<LandedHit>();
    for (const [i, h] of [...fx.hits.entries()].sort((a, b) => a[1].t - b[1].t)) {
      if (landed.has(String(i))) continue;
      const f = frameOf(h.t);
      let best: LandedHit | null = null;
      for (const x of free) {
        if (taken.has(x) || x.operator !== h.operator || Math.abs(x.frame - f) > NEAR_FRAMES || !eventsOf.get(`${x.operator}|${x.skillId}|${x.hitId}`)?.includes(h.event)) continue;
        if (!best || Math.abs(x.frame - f) < Math.abs(best.frame - f)) best = x;
      }
      if (best) {
        taken.add(best);
        landed.set(String(i), best);
      }
    }
    /** The replay's state at a frame: its latest step at or before it, advanced (pure). */
    const stateAt = (frame: number): TimelineState => {
      let cp = checkpoints[0] as TimelineState;
      for (const x of checkpoints) if (x.frame <= frame) cp = x;
      return cp.frame === frame ? cp : advance(ctx, cp, frame);
    };
    const linkLive = (x: TimelineState, op: string, frame: number) =>
      x.link.filter((e) => e > frame).length + x.buffs.filter((b) => b.link && b.cast === undefined && reaches(b, op) && activeAt(b, frame)).length;
    const consumable = (x: TimelineState, op: string, kind: SkillType | "none", frame: number) =>
      kind === "none" ? [] : x.buffs.filter((b) => b.cast === undefined && b.consumedBy?.includes(kind) && reaches(b, op) && activeAt(b, frame)).map((b) => b.id).sort();
    /** Whether a cast of this kind consumes a buff of the operator's (own or worn) without a duration (KitBuff.duration absent). */
    const preLogLayers = (op: string, kind: SkillType | "none") =>
      kind !== "none" && kits.some((k) => k.operator === op && k.buffs.some((b) => b.consumedBy?.includes(kind) && b.duration === undefined));
    for (const m of made) {
      const kind = m.c.kind ?? "none";
      const [a, b] = [Math.max(0, m.f - edge), m.f + edge];
      let link: Fact<number> = { value: m.link };
      let consumed: Fact<ConsumedBuffs> = { value: m.consumed };
      if (main.brokenAt !== null && b >= main.brokenAt) [link, consumed] = [{ unknown: "after the replay stopped" }, { unknown: "after the replay stopped" }];
      else {
        // What the cast found is the same REPLAY_EDGE_MS either side of it on the timeline without it (its own time
        // stop would hold back a teammate's delayed grant: 4e5e1390085e, Camille's Link 23 ms after Rossi's ultimate),
        // and no other cast that would use the same uses it meanwhile.
        const [before, after] = [stateAt(a), advance(ctx, m.pre, b)];
        const others = made.filter((o) => o !== m && Math.abs(o.f - m.f) <= edge);
        if (kind === "battle" || kind === "ultimate") {
          const live = [linkLive(before, m.c.operator, a), linkLive(m.pre, m.c.operator, m.f), linkLive(after, m.c.operator, b)].map((n) => Math.min(4, n));
          const rival = others.some((o) => o.c.kind === "battle" || o.c.kind === "ultimate");
          if (live.some((n) => n !== m.link) || (rival && m.link > 0)) link = { unknown: `Link stacks change within ${REPLAY_EDGE_MS} ms of the cast` };
        }
        const ids = JSON.stringify(m.consumed.buffs);
        const sameAround = [consumable(before, m.c.operator, kind, a), consumable(after, m.c.operator, kind, b)].every((x) => JSON.stringify(x) === ids);
        if (!sameAround || (m.consumed.buffs.length > 0 && others.some((o) => o.c.kind === m.c.kind))) consumed = { unknown: `buffs a cast consumes change within ${REPLAY_EDGE_MS} ms of it` };
        // Layers without a duration that the operator's first such cast consumes may come from casts before the log's start
        // (fixtures/zmdlogs-b7b3762d5da8.json: Si's first combo carries three Yinglung's Edge layers, the logged battle skills
        // before it two).
        else if (preLogLayers(m.c.operator, kind) && !made.some((o) => o.f < m.f && o.c.operator === m.c.operator && o.c.kind === m.c.kind)) {
          consumed = { unknown: "layers without a duration casts before the log may have built" };
        }
      }
      facts.set(m.c, { index: m.index, link, consumed, windowCount: m.windowCount !== null ? { value: m.windowCount } : { unknown: "a combo window the replay didn't see open" } });
    }
  }
  const hitIndex = new Map(fx.hits.map((h, i) => [h, i]));
  const broken = (ms: number) => brokenAt !== null && frameOf(ms) >= brokenAt - edge;
  const replayedCast = (c: Pick<LoggedCast, "operator" | "skillId" | "start">) => casts.find((d) => d.operator === c.operator && d.skillId === c.skillId && Math.abs(d.start - c.start) <= 1000);
  const castFacts = (c: Pick<LoggedCast, "operator" | "skillId" | "start" | "kind">): ReplayCastFacts | { unknown: string } => {
    if (kits.length === 0) return { unknown: "no kit to replay" };
    // A trigger's hits (a placed group of kind null) belong to no cast in the timeline: no Link, no consumed buffs.
    if (c.kind === null) return TRIGGERED;
    const d = replayedCast(c);
    if (!d) return { unknown: "a cast the replay doesn't make" };
    if (failedCasts.has(d)) return { unknown: "a cast the replay couldn't make" };
    if (broken(d.start)) return { unknown: "after the replay stopped" };
    return facts.get(d) ?? { unknown: "a cast the replay didn't reach" };
  };
  /** A run's instances of a game buff at an operator at a frame, or null near one of its changes. */
  const countIn = (r: NonNullable<typeof main>, key: string, f: number): number | null => {
    if ((r.changes.get(key) ?? []).some((c) => Math.abs(c.frame - f) <= c.slack)) return null;
    return (r.instances.get(key) ?? []).filter((i) => i.start <= f && f < i.end).length;
  };
  return {
    decided,
    undecided,
    failed,
    instances(hit, gameBuff) {
      if (!decided.has(gameBuff) || !main) return null;
      const f = frameOf(hit.t);
      if (brokenAt !== null && f >= brokenAt - edge) return null;
      const key = `${gameBuff}|${hit.operator}`;
      const n = countIn(main, key, f);
      // A buff a trigger on crits is behind: decided only where the landings whose crit the log doesn't give don't matter.
      if (n !== null && bound && critDependent.has(gameBuff) && countIn(bound, key, f) !== n) return null;
      return n;
    },
    castFacts,
    landing(hit) {
      const found = landed.get(String(hitIndex.get(hit)));
      if (found) return found;
      if (kits.length === 0) return { unknown: "no kit to replay" };
      if (broken(hit.t)) return { unknown: "after the replay stopped" };
      const p = placement.hits.get(hit);
      if (!p) return { unknown: "a hit the placement doesn't place" };
      const c = castFacts(p.cast);
      if ("unknown" in c) return c;
      if (p.frame === undefined) return { unknown: "a landing whose order the kit doesn't give" };
      return { unknown: "a landing the replay didn't land" };
    },
  };
}

/** The changes in each key's count: starts and ends at one frame net out (a refresh), each with its slack (REPLAY_EDGE_MS, and an expiry's share of its life). */
function countChanges(instances: ReadonlyMap<string, readonly Instance[]>, edge: number): Map<string, Change[]> {
  const changes = new Map<string, Change[]>();
  for (const [key, list] of instances) {
    const at = new Map<number, { delta: number; slack: number }>();
    const add = (frame: number, delta: number, slack: number) => {
      const cur = at.get(frame) ?? { delta: 0, slack: 0 };
      at.set(frame, { delta: cur.delta + delta, slack: Math.max(cur.slack, slack) });
    };
    for (const i of list) {
      add(i.start, 1, edge);
      if (Number.isFinite(i.end)) add(i.end, -1, edge + (i.expired ? Math.round(REPLAY_EXPIRY_SLACK * (i.end - i.start)) : 0));
    }
    changes.set(key, [...at].filter(([, c]) => c.delta !== 0).map(([frame, c]) => ({ frame, ...c })).sort((a, b) => a.frame - b.frame));
  }
  return changes;
}

/** Where the replay and the log disagree about a kit buff at a logged hit: one has it on and the other off, or both on with other instance counts. */
export interface BuffDisagreement {
  readonly buff: string;
  readonly operator: string;
  readonly t: number;
  /** Instances the log lists at the hit (inside it, not at its boundary; an unquantified listing counts as one). */
  readonly log: number;
  readonly replay: number;
}

const layeredCache = new Map<string, boolean>();
/** Whether ZMDLogs lists a buff once whatever its layers (BuffData stackingType 8: layers on one timer). */
export function listedOnce(buff: string): boolean {
  if (!layeredCache.has(buff)) layeredCache.set(buff, isBuffFileListed(buff) && readBuffFile(buff)?.stacking.type === 8);
  return layeredCache.get(buff) as boolean;
}

/** One instance's logged effects of a buff: per zone and element, the strongest value at that listing. */
function oneInstance(effects: readonly LogEffect[]): LogEffect[] {
  const best = new Map<string, LogEffect>();
  for (const e of effects) {
    const k = `${e.zone}|${e.element}`;
    const cur = best.get(k);
    if (!cur || e.value > cur.value) best.set(k, e);
  }
  return [...best.values()];
}

/** Instances of a buff a logged listing has: its most repeated zone and element. */
function listedInstances(effects: readonly LogEffect[]): number {
  const n = new Map<string, number>();
  for (const e of effects) n.set(`${e.zone}|${e.element}`, (n.get(`${e.zone}|${e.element}`) ?? 0) + 1);
  return Math.max(0, ...n.values());
}

/** A logged hit with some buffs' entries (each listed once) at a number of layers. */
export function atLayers(hit: LogHit, layers: ReadonlyMap<string, number>): LogHit {
  if (layers.size === 0) return hit;
  const scale = (e: LogEffect): LogEffect => {
    const n = layers.get(e.buff);
    return n === undefined ? e : { ...e, value: e.value * n };
  };
  return { ...hit, effects: hit.effects.map(scale), boundaryEffects: hit.boundaryEffects.map(scale) };
}

/** The logged hits as the replay decides their kit buffs (replayedHits), with the disagreements found. */
export interface ReplayedHits {
  /** Each logged hit with its decided buffs' effects as the replay has them; a hit the replay doesn't change is itself. */
  readonly hits: ReadonlyMap<LogHit, LogHit>;
  /** Per hit, the game buffs whose entries the replay set (added or took away). */
  readonly decidedAt: ReadonlyMap<LogHit, ReadonlySet<string>>;
  /** Per hit, the game buffs the replay judged there (it decides them: not near one of its changes). */
  readonly judgedAt: ReadonlyMap<LogHit, ReadonlySet<string>>;
  /**
   * Per hit, the layers the replay gives a buff the log lists once whatever its layers (stackingType 8) and both have
   * on: the hit's entries are at that many layers (in `hits`, and for the log's listing too: logcheck.ts).
   */
  readonly layersAt: ReadonlyMap<LogHit, ReadonlyMap<string, number>>;
  readonly disagreements: readonly BuffDisagreement[];
}

/**
 * Each logged hit with the replay's activity of its decided buffs in place of
 * the log's listing, where the replay is sure (BuffReplay.instances): a buff
 * the replay has off loses its entries (effects, boundary effects,
 * unquantified); one it has on that the log lists inside the hit keeps the
 * log's entries (their instances and values: the log's gaps are buffs it
 * stops listing, not miscounted layers; a different count is reported); one
 * it has on that the log doesn't list, or lists only at the hit's boundary
 * or without values, gets the replay's instances, with the values the log
 * gives the buff elsewhere (one instance's, from the nearest hit of the same
 * operator that lists it, else of anyone's; a buff the log lists once
 * whatever its layers, stackingType 8, as one entry at the layers' total).
 * Near a change, the log's listing stands.
 */
export function replayedHits(fx: LogFixture, replay: BuffReplay): ReplayedHits {
  const listings = new Map<string, { t: number; operator: string; effects: LogEffect[] }[]>();
  for (const h of fx.hits) {
    for (const buff of new Set([...h.effects, ...h.boundaryEffects].map((e) => e.buff))) {
      if (!replay.decided.has(buff)) continue;
      const inside = h.effects.filter((e) => e.buff === buff);
      const effects = inside.length ? inside : h.boundaryEffects.filter((e) => e.buff === buff);
      listings.set(buff, [...(listings.get(buff) ?? []), { t: h.t, operator: h.operator, effects }]);
    }
  }
  const template = (buff: string, hit: LogHit): LogEffect[] => {
    let best: { d: number; effects: LogEffect[] } | null = null;
    for (const l of listings.get(buff) ?? []) {
      // The same operator's listings first (a buff's values may differ by recipient), then the nearest in time.
      const d = Math.abs(l.t - hit.t) + (l.operator === hit.operator ? 0 : 1e9);
      if (!best || d < best.d) best = { d, effects: l.effects };
    }
    return best ? oneInstance(best.effects) : [];
  };
  const hits = new Map<LogHit, LogHit>();
  const decidedAt = new Map<LogHit, Set<string>>();
  const judgedAt = new Map<LogHit, Set<string>>();
  const layersAt = new Map<LogHit, Map<string, number>>();
  const disagreements: BuffDisagreement[] = [];
  for (const hit of fx.hits) {
    const judged = new Set<string>();
    const set = new Set<string>();
    const layers = new Map<string, number>();
    const added: LogEffect[] = [];
    for (const buff of replay.decided.keys()) {
      const n = replay.instances(hit, buff);
      if (n === null) continue;
      judged.add(buff);
      const inside = hit.effects.filter((e) => e.buff === buff);
      const atBoundary = hit.boundaryEffects.some((e) => e.buff === buff);
      const logged = inside.length ? listedInstances(inside) : hit.unquantified.some((u) => u.buff === buff) ? 1 : 0;
      // The log's boundary listing says nothing either way.
      if (!(inside.length === 0 && atBoundary && logged === 0)) {
        const count = !listedOnce(buff) && logged > 0 && n > 0 && logged !== n;
        if ((logged > 0) !== (n > 0) || count) disagreements.push({ buff, operator: hit.operator, t: hit.t, log: logged, replay: n });
      }
      // The log's entries stand; a buff the log lists once whatever its layers (stackingType 8) at the replay's layers.
      if (n > 0 && inside.length) {
        if (listedOnce(buff) && n > 1 && listedInstances(inside) === 1) layers.set(buff, n);
        continue;
      }
      if (n === 0 && !inside.length && !atBoundary && !hit.unquantified.some((u) => u.buff === buff)) continue; // nothing to change
      set.add(buff);
      if (n === 0) continue;
      const one = inside.length ? oneInstance(inside) : template(buff, hit);
      if (listedOnce(buff)) added.push(...one.map((e) => ({ ...e, value: e.value * n })));
      else for (let i = 0; i < n; i++) added.push(...one);
    }
    if (judged.size) judgedAt.set(hit, judged);
    if (layers.size) layersAt.set(hit, layers);
    const layered = atLayers(hit, layers);
    if (set.size === 0) {
      hits.set(hit, layered);
      continue;
    }
    decidedAt.set(hit, set);
    hits.set(hit, {
      ...layered,
      effects: [...layered.effects.filter((e) => !set.has(e.buff)), ...added],
      boundaryEffects: layered.boundaryEffects.filter((e) => !set.has(e.buff)),
      unquantified: layered.unquantified.filter((u) => !set.has(u.buff)),
    });
  }
  return { hits, decidedAt, judgedAt, layersAt, disagreements };
}

/** A run of disagreeing hits of one buff and operator, one way. */
export interface DisagreementRun {
  readonly buff: string;
  readonly operator: string;
  /** "replay": the replay has it on, the log doesn't list it; "log": the reverse; "count": both on, with other instance counts. */
  readonly on: "replay" | "log" | "count";
  readonly from: number;
  readonly to: number;
  readonly hits: number;
  /** For "count": the instance counts seen (log / replay). */
  readonly counts?: readonly string[];
}

/** Disagreements grouped into runs: consecutive judged hits of an operator that disagree the same way. */
export function disagreementRuns(fx: LogFixture, r: ReplayedHits): DisagreementRun[] {
  const byHit = new Map<LogHit, Map<string, BuffDisagreement>>();
  const hitOf = new Map<string, LogHit[]>();
  for (const h of fx.hits) hitOf.set(`${h.operator}|${h.t}`, [...(hitOf.get(`${h.operator}|${h.t}`) ?? []), h]);
  for (const d of r.disagreements) for (const h of hitOf.get(`${d.operator}|${d.t}`) ?? []) byHit.set(h, new Map([...(byHit.get(h) ?? []), [d.buff, d]]));
  const out: DisagreementRun[] = [];
  const sorted = [...fx.hits].sort((a, b) => a.t - b.t);
  const buffs = [...new Set(r.disagreements.map((d) => d.buff))].sort();
  for (const buff of buffs) {
    for (const operator of fx.team.map((b) => b.operator)) {
      let cur: { on: DisagreementRun["on"]; from: number; to: number; hits: number; counts: Set<string> } | null = null;
      const flush = () => {
        if (cur) out.push({ buff, operator, on: cur.on, from: cur.from, to: cur.to, hits: cur.hits, ...(cur.on === "count" ? { counts: [...cur.counts] } : {}) });
      };
      for (const h of sorted) {
        if (h.operator !== operator || !r.judgedAt.get(h)?.has(buff)) continue;
        const d = byHit.get(h)?.get(buff);
        const on: DisagreementRun["on"] | null = d ? (d.log > 0 && d.replay > 0 ? "count" : d.replay > 0 ? "replay" : "log") : null;
        if (cur && on === cur.on) {
          cur.to = h.t;
          cur.hits++;
          if (d) cur.counts.add(`${d.log}/${d.replay}`);
          continue;
        }
        flush();
        cur = on && d ? { on, from: h.t, to: h.t, hits: 1, counts: new Set([`${d.log}/${d.replay}`]) } : null;
      }
      flush();
    }
  }
  return out;
}
