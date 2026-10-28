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
//
// Physical state (research 2026-10-18 from BuffData, the in-game tutorial
// text, the Talos Wiki and Endaxis's runtime; docs/data-sources.md):
// - Vulnerable (buff_physical_no_guard): max 4 stacks, 20 s, each new stack
//   refreshes it. Only physical-status applications and skills that apply it
//   directly add stacks; plain physical hits don't.
// - A physical status on an enemy without Vulnerable only adds 1 stack,
//   unless forced (a forced Lift / Knock Down always lands).
// - Lift / Knock Down: +1 Vulnerable (not consumed), a 120% hit, the status
//   (3 s / 10 s). Crush: consumes all n stacks for a 300–750% hit. Breach:
//   consumes all n stacks for a 100–250% hit and Physical DMG taken
//   +12–24% (× Arts Intensity effect) for 12–30 s, replacing any Breach.
// - Shatter: a physical status, or any new Vulnerable stack, on a
//   Solidified enemy consumes Solidification for a 240–600% hit (by its
//   level), after the status's own hit.

import type { Modifier } from "./effects.ts";
import { EngineError } from "./errors.ts";
import { artsIntensityEffect, corrosionModifier, corrosionShred, type ArtsElement } from "./reactions.ts";
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

export type PhysicalStatus = "lift" | "knockdown" | "crush" | "breach";

export const MAX_VULNERABLE_STACKS = 4;
export const VULNERABLE_FRAMES = 20 * FPS;
/** How long the status itself lasts (BuffData duration; Breach by level). */
export const PHYSICAL_FRAMES: Readonly<Record<PhysicalStatus, readonly number[]>> = {
  lift: [3, 3, 3, 3].map((x) => x * FPS),
  knockdown: [10, 10, 10, 10].map((x) => x * FPS),
  crush: [3, 3, 3, 3].map((x) => x * FPS),
  breach: [12, 18, 24, 30].map((x) => x * FPS),
};
/** Breach's Physical DMG Taken by level, before Arts Intensity. */
export const BREACH_DAMAGE_TAKEN = [0.12, 0.16, 0.2, 0.24] as const;

export const MAX_INFLICTION_STACKS = 4;
export const INFLICTION_FRAMES = 20 * FPS;

/**
 * Status durations in frames by level 1–4 (Talos Wiki). Combustion: 10 s, a tick each second, the last as it ends.
 * buff_common_burning_status says 11 s (its blackboard `duration` unused), but 11 s with the last tick before the end
 * fits the logs worse (2026-10-28, accuracy plan B5: replayed ticks 458b 60 → 53 and 012a 13 → 11, logged 58 and 13;
 * a Heat reaction inside the extra second meets the running Combustion, which the game must handle otherwise).
 */
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
  /** Apply an infliction (usually 1 stack); `enemy`: of the element the enemy already has (none: nothing happens). */
  | { readonly kind: "infliction"; readonly element: ArtsElement | "enemy"; readonly stacks?: number }
  /**
   * Forcibly apply a reaction status. Some skills set its duration (seconds)
   * or scale its strength with their own blackboard values, e.g. Laevatain's
   * temporary Combustion (`duration`, `extra_scaling`, both raised by her P3).
   * `scaleKey` multiplies whatever strength the status has (the common
   * buffs' `extra_scaling`): Combustion's damage over time, Electrification's
   * Arts DMG Taken (buff_common_pulse_pulse_conduct_triggered_do), Corrosion's
   * shred (buff_common_natural_natural_corrupt_triggered: start, per second
   * and cap). `extraSeconds` lengthens this application only
   * (buff_common_cryst_cryst_frozen_triggered's `extra_duration`).
   */
  | {
      readonly kind: "forcedReaction";
      readonly status: ReactionStatus;
      readonly level?: number;
      readonly durationKey?: string;
      readonly scaleKey?: string;
      readonly extraSeconds?: number;
    }
  /**
   * Consume (absorb) the infliction without a reaction, e.g. a final strike
   * absorbing Heat: only the listed elements, when given; at most `stacks`
   * (the rest stays, with its timer), all when absent.
   */
  | { readonly kind: "consumeInfliction"; readonly elements?: readonly ArtsElement[]; readonly stacks?: number }
  /** Remove a reaction status (only the listed ones, when given), e.g. a skill that consumes Solidification. */
  | { readonly kind: "consumeStatus"; readonly statuses?: readonly ReactionStatus[] }
  /** Add Vulnerable stacks directly (CreateBuff buff_physical_no_guard). */
  | { readonly kind: "vulnerable"; readonly stacks?: number }
  /**
   * A physical status (AirborneAction, KnockDownAction, CrushAction,
   * FractureAction). `forced`: a Lift or Knock Down that lands without
   * Vulnerable (forceAirborne / forceKnockDown). `multiplierKey`: a skill
   * value multiplying its hit (CrushAction damageMultiplier). `scaleKey`: a
   * skill value multiplying a Breach's Physical DMG Taken, not its hit
   * (buff_physical_do_fracture: `physical_res_down` × `extra_scaling`).
   */
  | { readonly kind: "physicalStatus"; readonly status: PhysicalStatus; readonly forced?: boolean; readonly multiplierKey?: string; readonly scaleKey?: string }
  /**
   * A control status the game marks with a tag (Immobilization: tag
   * −1065936627), for its duration (seconds, or a skill value). `freezes`:
   * it stops the enemy's own clock meanwhile (an entity time dilation of
   * scale 0, e.g. Si's battle-skill hit-stop).
   */
  | { readonly kind: "control"; readonly status: string; readonly seconds?: number; readonly durationKey?: string; readonly freezes?: boolean };

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
  /**
   * Multiplier on its strength from the applying skill, taken at application
   * (HitApplication `scaleKey`; default none, ×1): Combustion's damage over
   * time, Electrification's Arts DMG Taken, Corrosion's shred.
   */
  readonly damageScale?: { readonly key: string; readonly value: number };
  /** Its strength cap × this (Corrosion's shred cap; an applier's talent). */
  readonly capScale?: number;
  /** Corrosion: the shred of the Corrosion it replaced, when it did (corrosionShred `carried`). */
  readonly carried?: number;
  /**
   * Combustion: the applier's attacker-side modifiers when it was applied
   * (effects.ts SNAPSHOT_ZONES; buff_common_burning_status takeAtkSnapshot),
   * which its ticks keep; absent when the caller gave none.
   */
  readonly snapshot?: readonly Modifier[];
}

export interface ActivePhysical {
  readonly status: PhysicalStatus;
  /** Crush and Breach: the Vulnerable stacks consumed; Lift and Knock Down: 1. */
  readonly level: number;
  readonly appliedAt: number;
  readonly expiresAt: number;
  readonly operator: string;
  /** Breach's strength follows the applier's Arts Intensity. */
  readonly artsIntensity: number;
  /** Breach: multiplier on its Physical DMG Taken from the applying skill (HitApplication `scaleKey`; default ×1). */
  readonly damageScale?: { readonly key: string; readonly value: number };
}

export interface EnemyStatus {
  readonly infliction: Infliction | null;
  /** At most one of each status. */
  readonly statuses: readonly ActiveStatus[];
  readonly vulnerable: { readonly stacks: number; readonly expiresAt: number } | null;
  /** At most one of each physical status. */
  readonly physical: readonly ActivePhysical[];
  /** Control statuses (Immobilization, …), at most one of each. */
  readonly controls: readonly { readonly status: string; readonly appliedAt: number; readonly expiresAt: number; readonly operator: string }[];
}

export const NO_STATUS: EnemyStatus = { infliction: null, statuses: [], vulnerable: null, physical: [], controls: [] };

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
  /** A reaction status was removed by a hit before it ran out. */
  | { readonly kind: "statusConsumed"; readonly frame: number; readonly operator: string; readonly status: ReactionStatus; readonly level: number }
  /** Vulnerable stacks were added; `stacks` is the count after, `before` the count before (equal when added at the cap). */
  | { readonly kind: "vulnerable"; readonly frame: number; readonly operator: string; readonly stacks: number; readonly before: number }
  /** A physical status landed (its hit is its damage); `multiplier` scales the hit (Crush). */
  | { readonly kind: "physical"; readonly frame: number; readonly operator: string; readonly status: PhysicalStatus; readonly level: number; readonly forced: boolean; readonly multiplier?: number }
  /** A control status was applied (`frames` long); `freezes`: the enemy's own clock stops meanwhile. */
  | { readonly kind: "control"; readonly frame: number; readonly operator: string; readonly status: string; readonly frames: number; readonly freezes: boolean }
  /** Solidification shattered (its level). */
  | { readonly kind: "shatter"; readonly frame: number; readonly operator: string; readonly level: number }
  | {
      readonly kind: "combustionTick";
      readonly frame: number;
      readonly operator: string;
      readonly level: number;
      readonly damageScale?: { readonly key: string; readonly value: number };
      /** The applier's attacker-side modifiers at the Combustion's application (ActiveStatus.snapshot). */
      readonly snapshot?: readonly Modifier[];
    };

/** The BuffData file that holds each physical status's hit: battle logs name the hit after it. */
export const PHYSICAL_KEYS: Readonly<Record<PhysicalStatus, string>> = {
  lift: "buff_physical_airborne",
  knockdown: "buff_physical_knockdown",
  crush: "buff_physical_do_crushed",
  breach: "buff_physical_do_fracture",
};

/** The log event key of a burst or reaction's initial hit (ZMDLogs naming). */
export function statusEventKey(e: StatusEvent): string | null {
  if (e.kind === "burst") return `buff_common_${e.element}_${e.element}_triggered`;
  if (e.kind === "reaction") return e.consumed ? `buff_common_${e.element}_${e.consumed}_triggered` : null;
  if (e.kind === "combustionTick") return "buff_common_burning_status";
  if (e.kind === "physical") return PHYSICAL_KEYS[e.status];
  if (e.kind === "shatter") return "buff_common_cryst_triggered_physical_break";
  return null;
}

/** Drops what has expired by a frame. Doesn't emit ticks; use tickStatus for those. */
export function expireStatus(s: EnemyStatus, frame: number): EnemyStatus {
  const infliction = s.infliction && s.infliction.expiresAt > frame ? s.infliction : null;
  const statuses = s.statuses.filter((x) => x.expiresAt > frame);
  const vulnerable = s.vulnerable && s.vulnerable.expiresAt > frame ? s.vulnerable : null;
  const physical = s.physical.filter((x) => x.expiresAt > frame);
  const controls = s.controls.filter((x) => x.expiresAt > frame);
  if (infliction === s.infliction && statuses.length === s.statuses.length && vulnerable === s.vulnerable && physical.length === s.physical.length && controls.length === s.controls.length) return s;
  return { infliction, statuses, vulnerable, physical, controls };
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
      events.push({ kind: "combustionTick", frame: next, operator: x.operator, level: x.level, ...(x.damageScale ? { damageScale: x.damageScale } : {}), ...(x.snapshot ? { snapshot: x.snapshot } : {}) });
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
  /** Frames added to this application's duration (HitApplication `extraSeconds`). */
  readonly extraFrames?: number;
  readonly damageScale?: { readonly key: string; readonly value: number };
  /** The applier's attacker-side modifiers now, kept by a status with damage ticks (Combustion): asked for only then. */
  readonly snapshot?: () => readonly Modifier[];
}

/** How an applier's kit changes the statuses it applies (OperatorKit.statusTweaks, resolved for the applier). */
export type StatusTweaks = Partial<Record<ReactionStatus, { readonly extraFrames: number; readonly capScale: number }>>;

function withStatus(s: EnemyStatus, st: ReactionStatus, level: number, frame: number, operator: string, artsIntensity: number, o: StatusOverrides = {}, tweaks: StatusTweaks = {}): EnemyStatus {
  const t = tweaks[st];
  // A Corrosion still on the enemy passes its shred on (buff_common_natural_*_triggered_wrapper).
  const running = st === "corrosion" ? s.statuses.find((x) => x.status === "corrosion" && x.expiresAt > frame) : undefined;
  const carried = running ? corrosionShred(running.level, ((frame - running.appliedAt) * 1000) / FPS, running.artsIntensity, running.capScale ?? 1, running.damageScale?.value ?? 1, running.carried ?? 0) : 0;
  const status: ActiveStatus = {
    status: st,
    level: checkLevel(level),
    appliedAt: frame,
    expiresAt: frame + (o.durationFrames ?? (STATUS_FRAMES[st][level - 1] as number)) + (o.extraFrames ?? 0) + (t?.extraFrames ?? 0),
    ...(t && t.capScale !== 1 ? { capScale: t.capScale } : {}),
    ...(carried > 0 ? { carried } : {}),
    operator,
    artsIntensity,
    ...(st === "combustion" ? { nextTickAt: frame + COMBUSTION_TICK_FRAMES } : {}),
    ...(o.damageScale ? { damageScale: o.damageScale } : {}),
    ...(st === "combustion" && o.snapshot ? { snapshot: o.snapshot() } : {}),
  };
  return { ...s, statuses: [...s.statuses.filter((x) => x.status !== st), status] };
}

function noSkillValues(key: string): number {
  throw new EngineError(`a forced reaction names skill value ${key}, but no skill values were given`);
}

/**
 * Applies what a hit does, at a frame, by an operator with the given Arts
 * Intensity. `skillValue` resolves the applying skill's blackboard keys;
 * `snapshot` gives the applier's attacker-side modifiers, which a Combustion
 * it applies keeps for its ticks (ActiveStatus.snapshot). Returns the new state and what happened (bursts and reactions to deal
 * damage for, consumptions for skills that count them).
 */
export function applyToEnemy(
  state: EnemyStatus,
  app: HitApplication,
  frame: number,
  operator: string,
  artsIntensity: number,
  skillValue: (key: string) => number = noSkillValues,
  tweaks: StatusTweaks = {},
  snapshot?: () => readonly Modifier[],
): { state: EnemyStatus; events: StatusEvent[] } {
  const s = expireStatus(state, frame);
  const cur = s.infliction;
  if (app.kind === "infliction") {
    if (app.element === "enemy") return cur ? applyToEnemy(s, { ...app, element: cur.element }, frame, operator, artsIntensity, skillValue, tweaks, snapshot) : { state: s, events: [] };
    const element = app.element;
    const stacks = app.stacks ?? 1;
    if (!Number.isInteger(stacks) || stacks < 1) throw new EngineError(`infliction stacks ${stacks}`);
    if (!cur) {
      const n = Math.min(MAX_INFLICTION_STACKS, stacks);
      return {
        state: { ...s, infliction: { element: element, stacks: n, expiresAt: frame + INFLICTION_FRAMES } },
        events: [{ kind: "inflicted", frame, operator, element: element, stacks: n }],
      };
    }
    if (cur.element === element) {
      const n = Math.min(MAX_INFLICTION_STACKS, cur.stacks + stacks);
      return {
        state: { ...s, infliction: { element: cur.element, stacks: n, expiresAt: frame + INFLICTION_FRAMES } },
        events: [{ kind: "inflicted", frame, operator, element: element, stacks: n }, { kind: "burst", frame, operator, element: element }],
      };
    }
    const status = REACTION_OF[element];
    const level = Math.min(MAX_INFLICTION_STACKS, cur.stacks);
    return {
      state: withStatus({ ...s, infliction: null }, status, level, frame, operator, artsIntensity, snapshot ? { snapshot } : {}, tweaks),
      events: [{ kind: "reaction", frame, operator, status, element: element, level, consumed: cur.element, initialHit: true }],
    };
  }
  if (app.kind === "forcedReaction") {
    const level = app.level ?? 1;
    const o: StatusOverrides = {
      ...(app.durationKey ? { durationFrames: Math.round(skillValue(app.durationKey) * FPS) } : {}),
      ...(app.extraSeconds ? { extraFrames: Math.round(app.extraSeconds * FPS) } : {}),
      ...(app.scaleKey ? { damageScale: { key: app.scaleKey, value: skillValue(app.scaleKey) } } : {}),
      ...(snapshot ? { snapshot } : {}),
    };
    return {
      state: withStatus(s, app.status, level, frame, operator, artsIntensity, o, tweaks),
      events: [{ kind: "reaction", frame, operator, status: app.status, element: ELEMENT_OF[app.status], level, consumed: null, initialHit: false }],
    };
  }
  if (app.kind === "vulnerable") return addVulnerable(s, app.stacks ?? 1, frame, operator, true);
  if (app.kind === "control") {
    const frames = Math.round((app.durationKey ? skillValue(app.durationKey) : (app.seconds ?? 0)) * FPS);
    if (frames <= 0) throw new EngineError(`control status ${app.status}: ${frames} frames`);
    const c = { status: app.status, appliedAt: frame, expiresAt: frame + frames, operator };
    return {
      state: { ...s, controls: [...s.controls.filter((x) => x.status !== app.status), c] },
      events: [{ kind: "control", frame, operator, status: app.status, frames, freezes: app.freezes === true }],
    };
  }
  if (app.kind === "physicalStatus") {
    if (app.scaleKey && app.status !== "breach") throw new EngineError(`a ${app.status} has no strength for scaleKey ${app.scaleKey} to scale (only Breach's DMG Taken)`);
    const n = s.vulnerable?.stacks ?? 0;
    const lifting = app.status === "lift" || app.status === "knockdown";
    // Without Vulnerable (and not a forced Lift / Knock Down) it only adds a stack.
    if (n === 0 && !(lifting && app.forced)) return addVulnerable(s, 1, frame, operator, true);
    const level = lifting ? 1 : n;
    const multiplier = app.multiplierKey ? skillValue(app.multiplierKey) : undefined;
    const added = lifting ? addVulnerable(s, 1, frame, operator, false) : { state: { ...s, vulnerable: null }, events: [] };
    const phys: ActivePhysical = {
      status: app.status, level, appliedAt: frame, expiresAt: frame + (PHYSICAL_FRAMES[app.status][level - 1] as number), operator, artsIntensity,
      ...(app.scaleKey ? { damageScale: { key: app.scaleKey, value: skillValue(app.scaleKey) } } : {}),
    };
    const state = { ...added.state, physical: [...added.state.physical.filter((x) => x.status !== app.status), phys] };
    const hit: StatusEvent = { kind: "physical", frame, operator, status: app.status, level, forced: app.forced === true, ...(multiplier !== undefined ? { multiplier } : {}) };
    const sh = shatter(state, frame, operator);
    return { state: sh.state, events: [...added.events, hit, ...sh.events] };
  }
  if (app.kind === "consumeStatus") {
    const gone = s.statuses.filter((x) => !app.statuses || app.statuses.includes(x.status));
    if (gone.length === 0) return { state: s, events: [] };
    return {
      state: { ...s, statuses: s.statuses.filter((x) => !gone.includes(x)) },
      events: gone.map((x) => ({ kind: "statusConsumed", frame, operator, status: x.status, level: x.level })),
    };
  }
  if (!cur || (app.elements && !app.elements.includes(cur.element))) return { state: s, events: [] };
  const n = app.stacks === undefined ? cur.stacks : Math.min(cur.stacks, Math.max(0, Math.floor(app.stacks)));
  if (n <= 0) return { state: s, events: [] };
  const left = cur.stacks - n;
  return { state: { ...s, infliction: left > 0 ? { ...cur, stacks: left } : null }, events: [{ kind: "consumed", frame, operator, element: cur.element, stacks: n }] };
}

/** Adds Vulnerable stacks (refreshing it to at least 20 s); a new stack on a Solidified enemy shatters it, unless `shatters` is false. */
function addVulnerable(s: EnemyStatus, n: number, frame: number, operator: string, shatters: boolean): { state: EnemyStatus; events: StatusEvent[] } {
  if (!Number.isInteger(n) || n < 1) throw new EngineError(`Vulnerable stacks ${n}`);
  const cur = s.vulnerable;
  const stacks = Math.min(MAX_VULNERABLE_STACKS, (cur?.stacks ?? 0) + n);
  const state: EnemyStatus = { ...s, vulnerable: { stacks, expiresAt: Math.max(cur?.expiresAt ?? 0, frame + VULNERABLE_FRAMES) } };
  const events: StatusEvent[] = [{ kind: "vulnerable", frame, operator, stacks, before: cur?.stacks ?? 0 }];
  if (!shatters) return { state, events };
  const sh = shatter(state, frame, operator);
  return { state: sh.state, events: [...events, ...sh.events] };
}

/** Shatter: on a Solidified enemy, Solidification ends with a hit of its level. */
function shatter(s: EnemyStatus, frame: number, operator: string): { state: EnemyStatus; events: StatusEvent[] } {
  const solid = s.statuses.find((x) => x.status === "solidification" && x.expiresAt > frame);
  if (!solid) return { state: s, events: [] };
  return { state: { ...s, statuses: s.statuses.filter((x) => x !== solid) }, events: [{ kind: "shatter", frame, operator, level: solid.level }] };
}

/**
 * The damage modifiers the enemy's statuses give at a frame: Corrosion's
 * resistance shred, Electrification's Arts DMG Taken, Breach's Physical DMG
 * Taken, each × its applying skill's scale (`damageScale`, default ×1).
 */
export function statusModifiers(state: EnemyStatus, frame: number): Modifier[] {
  const out: Modifier[] = [];
  const scaled = (x: { readonly damageScale?: { readonly value: number } }) => x.damageScale?.value ?? 1;
  for (const x of expireStatus(state, frame).statuses) {
    if (x.status === "corrosion") {
      out.push(corrosionModifier(x.level, ((frame - x.appliedAt) * 1000) / FPS, x.artsIntensity, x.capScale ?? 1, scaled(x), x.carried ?? 0));
    } else if (x.status === "electrification") {
      const value = (ELECTRIFICATION_DAMAGE_TAKEN[x.level - 1] as number) * artsIntensityEffect(x.artsIntensity) * scaled(x);
      for (const element of ARTS_ELEMENTS) out.push({ zone: "damageTaken", value, element, source: `Electrification level ${x.level}` });
    }
  }
  for (const x of expireStatus(state, frame).physical) {
    if (x.status !== "breach") continue;
    out.push({ zone: "damageTaken", value: (BREACH_DAMAGE_TAKEN[x.level - 1] as number) * artsIntensityEffect(x.artsIntensity) * scaled(x), element: "physical", source: `Breach level ${x.level}` });
  }
  return out;
}
