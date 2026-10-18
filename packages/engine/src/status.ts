// The enemy's arts state: inflictions, the reactions they trigger, and the
// statuses those reactions leave. One state machine for every operator
// (design principle 15): kits only say what a hit applies (KitHit.applies),
// and this module decides what happens. Plain data in, plain data out, so
// the timeline can branch on it.
//
// Rules from the Talos Wiki (Arts Infliction, Arts Reaction, Combustion,
// Corrosion, Electrification, Solidification; read 2026-10-18):
// - An infliction lasts 20 s. The same element again adds stacks (max 4),
//   resets the duration and triggers an Arts Burst (160% ATK).
// - A different element consumes the existing infliction and triggers the
//   reaction of the *new* element at Status Level = consumed stacks, with an
//   initial hit of the new element (160–400% ATK). The new element isn't
//   left behind as an infliction.
// - A forced reaction consumes nothing, is Status Level I unless the skill
//   says otherwise, and has no initial hit.
// - Reapplying a status overrides it and resets its duration.
// Battle logs name a reaction buff_common_<new>_<consumed>_triggered and a
// burst buff_common_<e>_<e>_triggered (fixtures/zmdlogs-40d9a3c1da37.json).

import type { Modifier } from "./effects.ts";
import { EngineError } from "./errors.ts";
import { artsIntensityEffect, corrosionModifier, type ArtsElement } from "./reactions.ts";
import { FPS } from "./units.ts";

export const ARTS_ELEMENTS: readonly ArtsElement[] = ["fire", "pulse", "cryst", "natural"];

export type ReactionStatus = "combustion" | "electrification" | "solidification" | "corrosion";

/** The reaction each element triggers when it meets another element. */
export const REACTION_OF: Readonly<Record<ArtsElement, ReactionStatus>> = {
  fire: "combustion",
  pulse: "electrification",
  cryst: "solidification",
  natural: "corrosion",
};

export const ELEMENT_OF: Readonly<Record<ReactionStatus, ArtsElement>> = {
  combustion: "fire",
  electrification: "pulse",
  solidification: "cryst",
  corrosion: "natural",
};

export const MAX_INFLICTION_STACKS = 4;
export const INFLICTION_FRAMES = 20 * FPS;

/** Status durations in frames by level 1–4 (Talos Wiki). */
export const STATUS_FRAMES: Readonly<Record<ReactionStatus, readonly number[]>> = {
  combustion: [10, 10, 10, 10].map((s) => s * FPS),
  corrosion: [15, 15, 15, 15].map((s) => s * FPS),
  electrification: [12, 18, 24, 30].map((s) => s * FPS),
  solidification: [5.75, 6.75, 7.75, 8.75].map((s) => Math.round(s * FPS)),
};

/** Combustion deals its damage over time once per second. */
export const COMBUSTION_TICK_FRAMES = FPS;

/** Electrification's Arts DMG Taken by level, before Arts Intensity (Talos Wiki). */
export const ELECTRIFICATION_DAMAGE_TAKEN = [0.12, 0.16, 0.2, 0.24] as const;

/** What a hit does to the enemy's arts state besides damage. Kits list these per hit. */
export type HitApplication =
  /** Apply an infliction (usually 1 stack). */
  | { readonly kind: "infliction"; readonly element: ArtsElement; readonly stacks?: number }
  /**
   * Forcibly apply a reaction status. Some skills set its duration (seconds)
   * or scale its damage with their own blackboard values, e.g. Laevatain's
   * temporary Combustion (`duration`, `extra_scaling`, both raised by her P3).
   */
  | {
      readonly kind: "forcedReaction";
      readonly status: ReactionStatus;
      readonly level?: number;
      readonly durationKey?: string;
      readonly scaleKey?: string;
    }
  /** Consume (absorb) the infliction without a reaction, e.g. a final strike absorbing Heat. Only the listed elements, when given. */
  | { readonly kind: "consumeInfliction"; readonly elements?: readonly ArtsElement[] };

export interface Infliction {
  readonly element: ArtsElement;
  readonly stacks: number;
  readonly expiresAt: number;
}

export interface ActiveStatus {
  readonly status: ReactionStatus;
  readonly level: number;
  readonly appliedAt: number;
  readonly expiresAt: number;
  /** The operator whose hit applied it (Combustion ticks are its damage). */
  readonly operator: string;
  /** The applier's Arts Intensity when it was applied: it sets Corrosion's and Electrification's strength. */
  readonly artsIntensity: number;
  /** Frame of the next damage tick (Combustion only). */
  readonly nextTickAt?: number;
  /** Multiplier on its damage over time, from the applying skill (default none). */
  readonly damageScale?: { readonly key: string; readonly value: number };
}

export interface EnemyStatus {
  readonly infliction: Infliction | null;
  /** At most one of each status. */
  readonly statuses: readonly ActiveStatus[];
}

export const NO_STATUS: EnemyStatus = { infliction: null, statuses: [] };

export type StatusEvent =
  /** An infliction landed without a reaction (fresh, or stacking with a burst); `stacks` is the count after it. */
  | { readonly kind: "inflicted"; readonly frame: number; readonly operator: string; readonly element: ArtsElement; readonly stacks: number }
  | { readonly kind: "burst"; readonly frame: number; readonly operator: string; readonly element: ArtsElement }
  | {
      readonly kind: "reaction";
      readonly frame: number;
      readonly operator: string;
      readonly status: ReactionStatus;
      readonly element: ArtsElement;
      readonly level: number;
      /** The element consumed; null for a forced reaction. */
      readonly consumed: ArtsElement | null;
      /** Forced reactions have no initial hit. */
      readonly initialHit: boolean;
    }
  | { readonly kind: "consumed"; readonly frame: number; readonly operator: string; readonly element: ArtsElement; readonly stacks: number }
  | {
      readonly kind: "combustionTick";
      readonly frame: number;
      readonly operator: string;
      readonly level: number;
      readonly damageScale?: { readonly key: string; readonly value: number };
    };

/** The log event key of a burst or reaction's initial hit (ZMDLogs naming). */
export function statusEventKey(e: StatusEvent): string | null {
  if (e.kind === "burst") return `buff_common_${e.element}_${e.element}_triggered`;
  if (e.kind === "reaction") return e.consumed ? `buff_common_${e.element}_${e.consumed}_triggered` : null;
  if (e.kind === "combustionTick") return "buff_common_burning_status";
  return null;
}

/** Drops what has expired by a frame. Doesn't emit ticks; use tickStatus for those. */
export function expireStatus(s: EnemyStatus, frame: number): EnemyStatus {
  const infliction = s.infliction && s.infliction.expiresAt > frame ? s.infliction : null;
  const statuses = s.statuses.filter((x) => x.expiresAt > frame);
  return infliction === s.infliction && statuses.length === s.statuses.length ? s : { infliction, statuses };
}

/** Frame of the next damage tick, or null. */
export function nextTick(s: EnemyStatus): number | null {
  let next: number | null = null;
  for (const x of s.statuses) if (x.nextTickAt !== undefined && x.nextTickAt <= x.expiresAt && (next === null || x.nextTickAt < next)) next = x.nextTickAt;
  return next;
}

/** Emits the damage ticks due at or before a frame, in order. */
export function tickStatus(s: EnemyStatus, frame: number): { state: EnemyStatus; events: StatusEvent[] } {
  const events: StatusEvent[] = [];
  const statuses = s.statuses.map((x) => {
    let next = x.nextTickAt;
    if (next === undefined) return x;
    while (next <= frame && next <= x.expiresAt) {
      events.push({ kind: "combustionTick", frame: next, operator: x.operator, level: x.level, ...(x.damageScale ? { damageScale: x.damageScale } : {}) });
      next += COMBUSTION_TICK_FRAMES;
    }
    return next === x.nextTickAt ? x : { ...x, nextTickAt: next };
  });
  events.sort((a, b) => a.frame - b.frame);
  return { state: events.length ? { ...s, statuses } : s, events };
}

function checkLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > 4) throw new EngineError(`status level ${level} isn't 1–4`);
  return level;
}

interface StatusOverrides {
  readonly durationFrames?: number;
  readonly damageScale?: { readonly key: string; readonly value: number };
}

function withStatus(s: EnemyStatus, st: ReactionStatus, level: number, frame: number, operator: string, artsIntensity: number, o: StatusOverrides = {}): EnemyStatus {
  const status: ActiveStatus = {
    status: st,
    level: checkLevel(level),
    appliedAt: frame,
    expiresAt: frame + (o.durationFrames ?? (STATUS_FRAMES[st][level - 1] as number)),
    operator,
    artsIntensity,
    ...(st === "combustion" ? { nextTickAt: frame + COMBUSTION_TICK_FRAMES } : {}),
    ...(o.damageScale ? { damageScale: o.damageScale } : {}),
  };
  return { ...s, statuses: [...s.statuses.filter((x) => x.status !== st), status] };
}

function noSkillValues(key: string): number {
  throw new EngineError(`a forced reaction names skill value ${key}, but no skill values were given`);
}

/**
 * Applies what a hit does, at a frame, by an operator with the given Arts
 * Intensity. `skillValue` resolves the applying skill's blackboard keys.
 * Returns the new state and what happened (bursts and reactions to deal
 * damage for, consumptions for skills that count them).
 */
export function applyToEnemy(
  state: EnemyStatus,
  app: HitApplication,
  frame: number,
  operator: string,
  artsIntensity: number,
  skillValue: (key: string) => number = noSkillValues,
): { state: EnemyStatus; events: StatusEvent[] } {
  const s = expireStatus(state, frame);
  const cur = s.infliction;
  if (app.kind === "infliction") {
    const stacks = app.stacks ?? 1;
    if (!Number.isInteger(stacks) || stacks < 1) throw new EngineError(`infliction stacks ${stacks}`);
    if (!cur) {
      const n = Math.min(MAX_INFLICTION_STACKS, stacks);
      return {
        state: { ...s, infliction: { element: app.element, stacks: n, expiresAt: frame + INFLICTION_FRAMES } },
        events: [{ kind: "inflicted", frame, operator, element: app.element, stacks: n }],
      };
    }
    if (cur.element === app.element) {
      const n = Math.min(MAX_INFLICTION_STACKS, cur.stacks + stacks);
      return {
        state: { ...s, infliction: { element: cur.element, stacks: n, expiresAt: frame + INFLICTION_FRAMES } },
        events: [{ kind: "inflicted", frame, operator, element: app.element, stacks: n }, { kind: "burst", frame, operator, element: app.element }],
      };
    }
    const status = REACTION_OF[app.element];
    const level = Math.min(MAX_INFLICTION_STACKS, cur.stacks);
    return {
      state: withStatus({ ...s, infliction: null }, status, level, frame, operator, artsIntensity),
      events: [{ kind: "reaction", frame, operator, status, element: app.element, level, consumed: cur.element, initialHit: true }],
    };
  }
  if (app.kind === "forcedReaction") {
    const level = app.level ?? 1;
    const o: StatusOverrides = {
      ...(app.durationKey ? { durationFrames: Math.round(skillValue(app.durationKey) * FPS) } : {}),
      ...(app.scaleKey ? { damageScale: { key: app.scaleKey, value: skillValue(app.scaleKey) } } : {}),
    };
    return {
      state: withStatus(s, app.status, level, frame, operator, artsIntensity, o),
      events: [{ kind: "reaction", frame, operator, status: app.status, element: ELEMENT_OF[app.status], level, consumed: null, initialHit: false }],
    };
  }
  if (!cur || (app.elements && !app.elements.includes(cur.element))) return { state: s, events: [] };
  return { state: { ...s, infliction: null }, events: [{ kind: "consumed", frame, operator, element: cur.element, stacks: cur.stacks }] };
}

/** The damage modifiers the enemy's statuses give at a frame: Corrosion's resistance shred, Electrification's Arts DMG Taken. */
export function statusModifiers(state: EnemyStatus, frame: number): Modifier[] {
  const out: Modifier[] = [];
  for (const x of expireStatus(state, frame).statuses) {
    if (x.status === "corrosion") {
      out.push(corrosionModifier(x.level, ((frame - x.appliedAt) * 1000) / FPS, x.artsIntensity));
    } else if (x.status === "electrification") {
      const value = (ELECTRIFICATION_DAMAGE_TAKEN[x.level - 1] as number) * artsIntensityEffect(x.artsIntensity);
      for (const element of ARTS_ELEMENTS) out.push({ zone: "damageTaken", value, element, source: `Electrification level ${x.level}` });
    }
  }
  return out;
}
