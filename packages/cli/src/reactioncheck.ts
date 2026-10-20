// Checks the kits' inflictions (KitHit.applies) against a battle log: replays
// the logged hits through the enemy state machine (status.ts) and compares
// the bursts and reactions it predicts with the ones the log records. Logs
// don't record inflictions, so this is how a kit's `applies` gets verified.

import { applyToEnemy, computeStats, expireStatus, FPS, effectiveKit, hitAvailable, hitEffects, kitHitEntries, NO_STATUS, resolveApplication, statusEventKey, type EnemyStatus, type GameData, type KitHit, type Predicate, type StatusEvent } from "@efsim/engine";
import type { LogFixture, LogHit } from "@efsim/data";
import { distinctCasts, placeHits, type Placement } from "./logcasts.ts";

/**
 * Reactions show up in logs at the hit that caused them. A logged event
 * matches a prediction by the same operator and key within this window
 * after it (bursts: BURST_LOG_DELAY_MS).
 */
export const REACTION_LOG_DELAY_MS = 1200;

/**
 * An Arts Burst (same element) deals its damage on the burst buff's first
 * 1 s tick (BuffData `buff_common_<e>_<e>_triggered`: waitFirstTriggerInterval,
 * triggerInterval 1.0), on the enemy's clock, which time stops, stagger and
 * hit-stop hold back: Xaihi's Cryo bursts in btl_upload_abfd4b7478ec come
 * +1.52, +1.41 and +3.53 s (the last across a stagger) after her combo
 * hits. Until the engine delays bursts (batch 3's A5), a predicted burst
 * matches a logged one within this window.
 */
export const BURST_LOG_DELAY_MS = 4000;

export interface ReactionCheck {
  /** `due`: a burst the logged casts' time stops held (L5): when it lands on the enemy's clock, in ms. */
  readonly matched: readonly { readonly predicted: StatusEvent; readonly t: number; readonly loggedT: number; readonly due?: number }[];
  /** Predicted with an initial hit, but not in the log. */
  readonly unlogged: readonly { readonly predicted: StatusEvent; readonly t: number; readonly due?: number }[];
  /** In the log, but not predicted. */
  readonly unpredicted: readonly { readonly t: number; readonly operator: string; readonly event: string }[];
  /** Forced reactions and consumptions: nothing in the log to match them against. */
  readonly other: readonly { readonly predicted: StatusEvent; readonly t: number }[];
  /** Team members whose kit declares no inflictions, so the replay can't be complete. */
  readonly withoutApplies: readonly string[];
}

/** buff_common_<new>_<consumed>_triggered, or buff_common_<new>_triggered in newer logs (reactions only). */
const REACTION_KEY = /^buff_common_(fire|natural|pulse|cryst)(_(fire|natural|pulse|cryst))?_triggered$|^buff_physical_(airborne|knockdown|do_crushed|do_fracture)$|^buff_common_cryst_triggered_physical_break$/;

/** Whether a logged key is what a predicted event would be logged as. */
function sameKey(logged: string, predicted: StatusEvent): boolean {
  const key = statusEventKey(predicted);
  return logged === key || (predicted.kind === "reaction" && logged === `buff_common_${predicted.element}_triggered`);
}

/**
 * The kit hit a logged event is, among those this build can have (modes:
 * KitHit.if): the landing its place in its cast says (logcasts.ts: the n-th
 * logged landing of a key in a cast is the n-th kit landing with it), else
 * the first with its key.
 */
function kitHit(data: GameData, fixture: LogFixture, placement: Placement, h: LogHit): KitHit | null {
  const placed = placement.hits.get(h)?.hits[0];
  if (placed) return placed;
  const build = fixture.team.find((b) => b.operator === h.operator);
  if (!build) return null;
  const panel = computeStats(data, build);
  for (const e of kitHitEntries(effectiveKit(data, build))) if (e.hit.events.includes(h.event) && hitAvailable(data, build, panel, e.skillId, e.hit, { team: fixture.team })) return e.hit;
  return null;
}

/** A global slow-down a logged cast caused (SkillTiming.slowdowns: UltimateTimeAction, global TimeDilationAction): from frame `start`, the world's time scale per frame. */
export interface TimeStop {
  readonly start: number;
  readonly scales: readonly number[];
  readonly operator: string;
  readonly skillId: string;
}

/** The time stops of the logged casts of skills that have them, each cast placed from its first logged hit (logcasts.ts). */
export function loggedTimeStops(data: GameData, placement: Placement): TimeStop[] {
  return distinctCasts(placement).flatMap((c) => {
    const at = Math.round((c.start * FPS) / 1000);
    return (data.skills[c.skillId]?.timing?.slowdowns ?? []).map((d) => ({ start: at + d.from, scales: d.scales, operator: c.operator, skillId: c.skillId }));
  });
}

/**
 * When something due `frames` frames after `t` ms on the enemy's clock
 * happens, in ms: over each frame the clock runs at the lowest scale of the
 * time stops then (the engine's pending bursts: batch-3 A5).
 */
export function enemyClockDue(t: number, frames: number, stops: readonly TimeStop[]): number {
  const from = Math.round((t * FPS) / 1000);
  const relevant = stops.filter((s) => s.start + s.scales.length > from);
  let remaining = frames;
  let f = from;
  for (; remaining > 1e-9 && f < from + 100 * FPS; f++) {
    let rate = 1;
    for (const s of relevant) if (f >= s.start && f < s.start + s.scales.length) rate = Math.min(rate, s.scales[f - s.start] as number);
    remaining -= rate;
  }
  return t + ((f - from) * 1000) / FPS;
}

/**
 * Whether a predicate can hold for an operator of the fixture: false only
 * when its build, or the replay's enemy state for what reads the enemy
 * (inflictions, statuses, Vulnerable), decides it is false.
 */
function possible(data: GameData, fixture: LogFixture, operator: string, event: string, p: Predicate, enemy: EnemyStatus): boolean {
  const build = fixture.team.find((b) => b.operator === operator);
  if (!build) return true;
  const hit: KitHit = { id: "x", label: "", scale: [], count: 1, events: [event], damageType: "basic", element: "physical", if: p };
  try {
    return hitAvailable(data, build, computeStats(data, build), "", hit, { team: fixture.team, enemy });
  } catch {
    // It reads a skill value the replay doesn't know: undecided.
    return true;
  }
}

export function checkReactions(data: GameData, fixture: LogFixture): ReactionCheck {
  const hits = [...fixture.hits].sort((a, b) => a.t - b.t);
  let enemy = NO_STATUS;
  const teamKits = fixture.team.flatMap((b) => effectiveKit(data, b) ?? []);
  const placement = placeHits(data, fixture);
  const stops = loggedTimeStops(data, placement);
  const predicted: { predicted: StatusEvent; t: number }[] = [];
  for (const h of hits) {
    const kh = kitHit(data, fixture, placement, h);
    if (!kh) continue;
    const frame = (h.t * FPS) / 1000;
    // Only the controlled operator does basic attacks, so a logged Final Strike counts for Final Strike triggers.
    for (const effect of hitEffects(teamKits, h.operator, kh, h.event)) {
      for (const app of effect.applies) {
        // An application that can't happen for this build (a mode: KitApplication.if), or on the replay's enemy (Fluorite's
        // ultimate branches on the enemy's infliction), is left out; one neither decides stays.
        if (app.if && !possible(data, fixture, effect.owner, h.event, app.if, expireStatus(enemy, frame))) continue;
        // Arts Intensity only scales status strength, and skill values only a forced status's duration and damage, which this check doesn't compare.
        // A replay doesn't know stack counts: a stack amount that's a value counts as all (4).
        // An application repeating the event behind it (a combo's window) can't be replayed from a log.
        const resolved = resolveApplication(app, (v) => (typeof v === "number" ? v : 4));
        if (!resolved) continue;
        const r = applyToEnemy(expireStatus(enemy, frame), resolved, frame, h.operator, 0, () => 1);
        enemy = r.state;
        for (const e of r.events) predicted.push({ predicted: e, t: h.t });
      }
    }
  }
  const logged = hits.filter((h) => REACTION_KEY.test(h.event)).map((h) => ({ t: h.t, operator: h.operator, event: h.event, used: false }));
  const matched: ReactionCheck["matched"][number][] = [];
  const unlogged: ReactionCheck["unlogged"][number][] = [];
  const other: ReactionCheck["other"][number][] = [];
  for (const p of predicted) {
    if (p.predicted.kind === "inflicted") continue;
    const key = statusEventKey(p.predicted);
    if (!key || p.predicted.kind === "combustionTick") {
      other.push(p);
      continue;
    }
    // A burst lands its element's delay later on the enemy's clock, which the logged casts' time stops hold (L5): its window grows by that.
    const delay = p.predicted.kind === "burst" ? (data.constants.burstDelayFrames?.[p.predicted.element] ?? 0) : 0;
    const held = p.predicted.kind === "burst" && stops.length ? Math.max(0, enemyClockDue(p.t, delay, stops) - p.t - (delay * 1000) / FPS) : 0;
    const window = (p.predicted.kind === "burst" ? BURST_LOG_DELAY_MS : REACTION_LOG_DELAY_MS) + held;
    const m = logged.find((l) => !l.used && sameKey(l.event, p.predicted) && l.operator === p.predicted.operator && l.t >= p.t && l.t - p.t <= window);
    const due = held > 0 ? { due: Math.round(p.t + (delay * 1000) / FPS + held) } : {};
    if (m) {
      m.used = true;
      matched.push({ ...p, loggedT: m.t, ...due });
    } else unlogged.push({ ...p, ...due });
  }
  return {
    matched,
    unlogged,
    unpredicted: logged.filter((l) => !l.used).map(({ used: _used, ...l }) => l),
    other,
    withoutApplies: fixture.team
      .filter((b) => {
        const kit = effectiveKit(data, b);
        return !kitHitEntries(kit).some((e) => e.hit.applies?.length) && !(kit?.triggers ?? []).some((t) => t.do.some((a) => a.kind === "apply"));
      })
      .map((b) => b.operator),
  };
}

function describe(e: StatusEvent): string {
  if (e.kind === "burst") return `${e.operator}: ${e.element} burst`;
  if (e.kind === "reaction") return `${e.operator}: ${e.status} level ${e.level}${e.consumed ? ` (consumed ${e.consumed})` : " (forced)"}`;
  if (e.kind === "inflicted") return `${e.operator}: ${e.element} infliction (${e.stacks})`;
  if (e.kind === "consumed") return `${e.operator}: consumed ${e.stacks} ${e.element}`;
  if (e.kind === "statusConsumed") return `${e.operator}: consumed ${e.status} level ${e.level}`;
  if (e.kind === "vulnerable") return `${e.operator}: Vulnerable (${e.stacks})`;
  if (e.kind === "physical") return `${e.operator}: ${e.status} level ${e.level}${e.forced ? " (forced)" : ""}`;
  if (e.kind === "shatter") return `${e.operator}: Shatter level ${e.level}`;
  if (e.kind === "control") return `${e.operator}: ${e.status} (${e.frames} frames)`;
  return `${e.operator}: combustion tick level ${e.level}`;
}

export function formatReactionCheck(c: ReactionCheck): string {
  const lines: string[] = [];
  lines.push(`Reactions: ${c.matched.length} matched, ${c.unlogged.length} predicted but not logged, ${c.unpredicted.length} logged but not predicted.`);
  if (c.withoutApplies.length) lines.push(`No inflictions in the kit (replay incomplete): ${c.withoutApplies.join(", ")}`);
  const due = (x: { readonly due?: number }) => (x.due !== undefined ? ` (due ${x.due} ms: held by time stops)` : "");
  for (const m of c.matched) lines.push(`  match      ${m.t} ms → logged ${m.loggedT} ms  ${describe(m.predicted)}${due(m)}`);
  for (const u of c.unlogged) lines.push(`  not logged ${u.t} ms  ${describe(u.predicted)}${due(u)}`);
  for (const u of c.unpredicted) lines.push(`  unexpected ${u.t} ms  ${u.operator}: ${u.event}`);
  for (const o of c.other) lines.push(`  other      ${o.t} ms  ${describe(o.predicted)}`);
  return lines.join("\n");
}
