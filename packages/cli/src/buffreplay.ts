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
  advance, allActions, Attr, createContext, effectiveKit, FPS, init, reaches, replayCast,
  type ActiveBuff, type GameData, type KitTrigger, type OperatorKit, type TimelineScenario, type TimelineState,
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
export const REPLAY_EXPIRY_SLACK = 0.1;

/** Trigger events a log doesn't let the replay judge: the enemy's own actions. */
const UNJUDGED_EVENTS: ReadonlySet<string> = new Set(["attacked", "perfectDodge", "enemyCharge"]);

/** Why the replay can't judge a trigger (it has no crits, rolls, or enemy actions), or null. */
function unjudged(t: KitTrigger): string | null {
  if (UNJUDGED_EVENTS.has(t.on.event)) return `${t.id}: on ${t.on.event}`;
  if (t.on.event === "hit" && t.on.crit !== undefined) return `${t.id}: on crits`;
  if (t.chance !== undefined) return `${t.id}: a chance`;
  return null;
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
    const own = unjudged(t);
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
}

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
  readonly landings: readonly { readonly hitId: string; readonly nth: number; readonly frame: number }[];
}

/**
 * The logged casts (distinctCasts) as the replay casts them, in time order,
 * each with its logged landings: the timeline lands the cast's hits the log
 * shows at their logged frames (the log's time has other casts' time stops
 * and hit-stop in it), the others at their kit frames.
 */
export function replayedCasts(placement: Placement): ReplayedCast[] {
  const casts = distinctCasts(placement);
  const ofCast = (c: LoggedCast): LoggedCast | undefined => casts.find((d) => d.operator === c.operator && d.skillId === c.skillId && Math.abs(d.start - c.start) <= 1000);
  const last = new Map<LoggedCast, number>();
  const landings = new Map<LoggedCast, { hitId: string; nth: number; frame: number }[]>();
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
      landings.set(d, [...(landings.get(d) ?? []), { hitId: k.id, nth, frame: frameOf(h.t) }]);
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
  // Per game buff and operator: its instances (summed over the kit buffs standing for it: theirs don't overlap at one recipient).
  const instances = new Map<string, Instance[]>();
  let brokenAt: number | null = null;
  if (decided.size > 0 && kits.length > 0) {
    const sampleFrames = [...new Set(fx.hits.flatMap((h) => [frameOf(h.t) - edge, frameOf(h.t), frameOf(h.t) + edge]))].filter((f) => f >= 0).sort((a, b) => a - b);
    const followUps = new Set(kits.flatMap((k) => k.skills.filter((s) => s.followUpOnly).map((s) => `${k.operator}|${s.skillId}`)));
    const casts = replayedCasts(placement).filter((c) => !followUps.has(`${c.operator}|${c.skillId}`));
    const firstBasic = casts.find((c) => c.kind === "basic");
    const enemyHp = loggedEnemyHp(data, fx);
    const scenario: TimelineScenario = {
      team: fx.team,
      target: { enemy: fx.enemy.id, level: fx.enemy.level },
      durationFrames: (sampleFrames.at(-1) ?? 0) + 1,
      rotation: [],
      options: { crit: "never" },
      ...(firstBasic ? { controlled: firstBasic.operator } : {}),
      ...(enemyHp?.length ? { enemyHp } : {}),
    };
    const ctx = createContext(data, scenario);
    let st: TimelineState = init(ctx);
    // The instances seen at the last sample, by identity (kit buff, owner, start, recipients, and which of several at one start).
    const open = new Map<string, { key: string; owner: string; id: string; start: number; expiresAt: number }>();
    const close = (key: string, start: number, end: number, expired: boolean) => instances.set(key, [...(instances.get(key) ?? []), { start, end, expired }]);
    const kitIds = [...decided].flatMap(([g, defs]) => defs.map((d) => ({ g, owner: d.split(":", 2)[0] as string, id: d.split(":", 2)[1] as string })));
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
        close(rec.key, rec.start, expired ? rec.expiresAt : replacement.length ? Math.min(...replacement) : frame, expired);
      }
      open.clear();
      for (const [k, v] of seen) open.set(k, v);
    };
    // Casts and samples in frame order; a cast before a sample at its frame (its frame-0 hits land first).
    const steps = [
      ...casts.map((c) => ({ frame: Math.max(0, frameOf(c.start)), cast: c as ReplayedCast | null })),
      ...sampleFrames.map((frame) => ({ frame, cast: null as ReplayedCast | null })),
    ].sort((a, b) => a.frame - b.frame || (a.cast ? 0 : 1) - (b.cast ? 0 : 1));
    for (const s of steps) {
      if (s.cast) {
        try {
          st = replayCast(ctx, st, s.cast.operator, s.cast.skillId, Math.max(s.frame, st.frame), { keepPrevious: s.cast.keepPrevious, landings: s.cast.landings });
        } catch (e) {
          failed.push({ cast: s.cast, error: e instanceof Error ? e.message : String(e) });
        }
        continue;
      }
      try {
        st = advance(ctx, st, Math.max(s.frame, st.frame));
      } catch (e) {
        // The timeline can't go on (a hit it can't land from what the replay knows): it decides nothing from here.
        brokenAt = s.frame;
        failed.push({ cast: casts.filter((c) => frameOf(c.start) <= s.frame).at(-1) as ReplayedCast, error: `the replay stops at ${Math.round((s.frame * 1000) / FPS)} ms: ${e instanceof Error ? e.message : String(e)}` });
        break;
      }
      sample(s.frame);
    }
    for (const rec of open.values()) close(rec.key, rec.start, brokenAt ?? rec.expiresAt, brokenAt === null && Number.isFinite(rec.expiresAt));
  }
  // The changes in each key's count: starts and ends at one frame net out (a refresh), each with its slack.
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
  return {
    decided,
    undecided,
    failed,
    instances(hit, gameBuff) {
      if (!decided.has(gameBuff)) return null;
      const f = frameOf(hit.t);
      if (brokenAt !== null && f >= brokenAt - edge) return null;
      const key = `${gameBuff}|${hit.operator}`;
      if ((changes.get(key) ?? []).some((c) => Math.abs(c.frame - f) <= c.slack)) return null;
      return (instances.get(key) ?? []).filter((i) => i.start <= f && f < i.end).length;
    },
  };
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

/** The logged hits as the replay decides their kit buffs (replayedHits), with the disagreements found. */
export interface ReplayedHits {
  /** Each logged hit with its decided buffs' effects as the replay has them; a hit the replay doesn't change is itself. */
  readonly hits: ReadonlyMap<LogHit, LogHit>;
  /** Per hit, the game buffs whose entries the replay set (added or took away). */
  readonly decidedAt: ReadonlyMap<LogHit, ReadonlySet<string>>;
  /** Per hit, the game buffs the replay judged there (it decides them: not near one of its changes). */
  readonly judgedAt: ReadonlyMap<LogHit, ReadonlySet<string>>;
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
  const disagreements: BuffDisagreement[] = [];
  for (const hit of fx.hits) {
    const judged = new Set<string>();
    const set = new Set<string>();
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
      if (n > 0 && inside.length) continue; // the log's entries stand
      if (n === 0 && !inside.length && !atBoundary && !hit.unquantified.some((u) => u.buff === buff)) continue; // nothing to change
      set.add(buff);
      if (n === 0) continue;
      const one = template(buff, hit);
      if (listedOnce(buff)) added.push(...one.map((e) => ({ ...e, value: e.value * n })));
      else for (let i = 0; i < n; i++) added.push(...one);
    }
    if (judged.size) judgedAt.set(hit, judged);
    if (set.size === 0) {
      hits.set(hit, hit);
      continue;
    }
    decidedAt.set(hit, set);
    hits.set(hit, {
      ...hit,
      effects: [...hit.effects.filter((e) => !set.has(e.buff)), ...added],
      boundaryEffects: hit.boundaryEffects.filter((e) => !set.has(e.buff)),
      unquantified: hit.unquantified.filter((u) => !set.has(u.buff)),
    });
  }
  return { hits, decidedAt, judgedAt, disagreements };
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
