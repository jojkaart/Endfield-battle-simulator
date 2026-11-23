// Where a battle log's hits fall in their casts (batch 4 L1): each logged hit
// of an operator with a kit is mapped to the kit landing it is (the n-th
// logged landing of a key within a cast is the n-th kit landing with that
// key, in frame order), and each cast is placed in time from its first logged
// hit. The reaction replay applies the landing's own applications (L1) and
// the casts' time stops (L5); the log check counts Link sources (L3).

import { computeStats, effectiveKit, FPS, hitAvailable, hitDecorations, triggerSkillId, allActions, type Build, type HitDecoration, type GameData, type KitHit, type SkillTiming, type SkillType, type StatPanel } from "@efsim/engine";
import type { LogFixture, LogHit } from "./zmdlogs.ts";

/**
 * A logged cast whose next landing comes later than the key's landings span
 * plus this is a new cast: hit-stop and frame rounding stretch a cast in the
 * log (Haste shortens it). Other operators' logged time stops are taken out
 * of the time between landings first (worldMs).
 */
export const CAST_SLACK_MS = 1000;

/** A cast's next landing of a key logged this close to its slot's frame (from the key's first landing) is that landing (ms). */
const ON_TIME_MS = 150;

/** A global slow-down a logged cast caused (SkillTiming.slowdowns: UltimateTimeAction, global TimeDilationAction): from frame `start`, the world's time scale per frame. */
export interface TimeStop {
  /** A frame (30 a second), not ms as the log's times; it lasts `scales.length` frames. */
  readonly start: number;
  readonly scales: readonly number[];
  readonly operator: string;
  readonly skillId: string;
  /** The cast kind of the skill that made it (absent: unknown). */
  readonly kind?: SkillType | null;
}

/** The time stops of logged casts of skills that have them, each cast placed from its first logged hit. */
export function castTimeStops(data: GameData, casts: readonly LoggedCast[]): TimeStop[] {
  return distinctCasts({ hits: new Map(), casts }).flatMap((c) => {
    const at = Math.round((c.start * FPS) / 1000);
    return (data.skills[c.skillId]?.timing?.slowdowns ?? []).map((d) => ({ start: at + d.from, scales: d.scales, operator: c.operator, skillId: c.skillId, kind: c.kind }));
  });
}

/** The world's time from `from` to `to` ms under time stops, in ms: each frame counts at the lowest scale of the stops then (1 without one). */
export function worldMs(from: number, to: number, stops: readonly TimeStop[]): number {
  const [a, b] = [Math.round((from * FPS) / 1000), Math.round((to * FPS) / 1000)];
  const relevant = stops.filter((s) => s.start < b && s.start + s.scales.length > a);
  if (relevant.length === 0) return to - from;
  // Only the frames a stop covers (a cast long before a landing spans many without one), in frame order.
  const rates = new Map<number, number>();
  for (const s of relevant) {
    for (let f = Math.max(a, s.start); f < Math.min(b, s.start + s.scales.length); f++) rates.set(f, Math.min(rates.get(f) ?? 1, s.scales[f - s.start] as number));
  }
  let held = 0;
  for (const f of [...rates.keys()].sort((x, y) => x - y)) held += 1 - (rates.get(f) as number);
  return to - from - msOf(held);
}

/**
 * Where a cast started whose landing at kit frame `frame` is logged at `t` ms, if other casts' time stops held it:
 * `frame` frames of the world's time before it, each frame a stop covers counting at its lowest scale (worldMs's
 * inverse). Without a stop between, `t` less the frame.
 */
export function heldStart(t: number, frame: number, stops: readonly TimeStop[]): number {
  const plain = t - msOf(frame);
  if (frame <= 0) return plain;
  const b = Math.round((t * FPS) / 1000);
  if (!stops.some((s) => s.start < b && s.start + s.scales.length > Math.round((plain * FPS) / 1000))) return plain;
  const reach = frame + stops.reduce((n, s) => n + s.scales.length, 0);
  const relevant = stops.filter((s) => s.start < b && s.start + s.scales.length > b - reach);
  let world = 0;
  let n = 0;
  while (world < frame - 1e-9 && n < reach) {
    const f = b - 1 - n;
    let rate = 1;
    for (const s of relevant) if (f >= s.start && f < s.start + s.scales.length) rate = Math.min(rate, s.scales[f - s.start] as number);
    world += rate;
    n++;
  }
  return t - msOf(n);
}

/**
 * A slow-down's scale at or below which the world stands still for the log (ownStopLoggedFrame). A partial one doesn't
 * hold the log's hits: with any frame below 1 counted, 4e5e1390085e, db8711232de9, 0eef2474a26f and others moved too.
 */
export const OWN_STOP_SCALE = 0.05;

/**
 * The frame of its cast a landing at kit frame `frame` is logged at: inside the cast's own stop (a frame its slow-down,
 * SkillTiming.slowdowns, stops the world: OWN_STOP_SCALE) the log has it where the slow-down ends (its last frame below
 * scale 1), as it
 * batches every hit inside a stop (docs/design/data.md "What the log records"); elsewhere its frame. Liino's combo, hit 1
 * at frame 9 inside its slow-down (0.01 to frame 10, back to 1 at frame 26): in her 64 combos in the development logs
 * the latest teammate's hit before hit 1 is logged 0.79–1.8 s before it (median 1.0 s; 5 under 0.65 s where hits
 * overlap a log's start or another stop), and hit 2 (frame 33) follows it by 0.1–0.9 s (median 0.23 s), not 0.8 s;
 * placed at frame 9, her cast and its stop came 0.6 s late (d774d0ce7bd3 98.43 s: Zhuang Fangyi's Thunder Strikes ran on
 * 0.6 s into the hold the log shows from 97.9 s). A detached hit (on its way) isn't the cast's own landing.
 */
export function ownStopLoggedFrame(timing: SkillTiming | null | undefined, hits: readonly KitHit[], frame: number): number {
  if (!timing || hits.length === 0 || hits.some((h) => h.detached || h.launch !== undefined || h.enemyDelay !== undefined)) return frame;
  for (const d of timing.slowdowns) {
    const i = frame - d.from;
    if (i >= 0 && i < d.scales.length && (d.scales[i] as number) <= OWN_STOP_SCALE) return d.from + d.scales.findLastIndex((x) => x < 1) + 1;
  }
  return frame;
}

/** How far before a cast's held start (heldStart) the log's cast event of its skill may be and still be its (ms). */
const HELD_EVENT_MS = 2000;

/**
 * Where a new cast starts: its first logged landing less the landing's frame; or, when other casts' time stops fall
 * between, that many frames of the world's time before the landing (heldStart), if the log's cast event of the skill
 * says so: the event nearest the held start is nearer it than the plain one (1cd1657bc305: Typhoeus's combo, its
 * arrows at 39.04 s at frame 35, pressed at 34.70 s; placed at 37.87 s, after Liino's ultimate stop, the replay cast it
 * after her hover had ended). Without such an event the plain start: a stop placed a little off would move a cast
 * pressed as it ended to before it (dbaee23b801d: Li Zhiyan's combo at 8.0 s, its event at 8.26 s, after Liino's
 * ultimate stop). A combo isn't held by another's combo: combos pressed together take their turns, each starting as
 * the one before lets it (bdf223db8e49: Jsspsi's combo, its event at 10.46 s, its first slash at 11.94 s at frame 14
 * across Typhoeus's and Liino's combos; started before them, the replay held Corrosion's ramp 0.4 s too long). Not
 * before the event: a stop placed a little early moves the held start before what the operator did up to the press
 * (9090afbacec9: Typhoeus's combo, pressed at 60.63 s after her shot at 60.60 s, held from 60.01 s; cast before the
 * shot, the replay cast it grounded; 4d60e7fe92c2: Li Zhiyan's combo before her attack 4's last hits at 80.14 s).
 */
function castStart(t: number, frame: number, stops: readonly TimeStop[], events: readonly number[]): number {
  const plain = t - msOf(frame);
  const held = heldStart(t, frame, stops);
  if (held >= plain - msOf(1)) return plain;
  const near = events.filter((e) => e >= held - HELD_EVENT_MS && e <= t);
  if (near.length === 0) return plain;
  const e = near.reduce((a, x) => (Math.abs(x - held) < Math.abs(a - held) ? x : a));
  return Math.abs(e - held) < Math.abs(e - plain) ? Math.max(held, e) : plain;
}

/**
 * Whether the log's cast event of `eventSkill` (LogFixture.casts) is one of the kit skill `skillId`: the same skill, or,
 * for an event of a skill the operator's kit doesn't have, the kit's skill in its slot (the log names the slot:
 * Typhoeus's battle skill normal_skill_floating_start as normal_skill, her hovering ultimate as ultimate_skill).
 */
export function castEventOf(eventSkill: string, skillId: string, kitSkills: ReadonlySet<string>): boolean {
  return skillId === eventSkill || (!kitSkills.has(eventSkill) && skillId.startsWith(eventSkill));
}

/** A kit skill's or trigger's hits: a skill's land on its cast's frames, a trigger's on its firing's. */
interface Group {
  readonly id: string;
  /** Where its hits' values come from (the skill, or the trigger's skill). */
  readonly skillId: string;
  /** The cast kind of a skill's hits; null for a trigger's. */
  readonly kind: SkillType | null;
  /** For a trigger on casts of some skills: those skills, and its delay in frames. */
  readonly anchor: { readonly skills: readonly string[]; readonly delay: number } | null;
  /**
   * For a trigger on landings with a decoration (a dive attack): the logged times (ms) of the hits that can fire it, its
   * firings' starts; its hits' casts are placed from these as a skill's are from its other keys (choose).
   */
  readonly firedAt?: readonly number[];
  readonly hits: readonly KitHit[];
}

/** One landing slot of a key: the kit hits it can be (alternatives at one frame), the likeliest first. */
interface Slot {
  readonly frame: number;
  readonly hits: readonly KitHit[];
  /** The slots follow one of the key's variants (variantOrder): a cast may make fewer of them. */
  readonly variant?: true;
}

export interface LoggedCast {
  readonly operator: string;
  readonly key: string;
  /** The kit skill whose cast this is, or the trigger's group (`trigger:<id>`). */
  readonly group: string;
  /** Where the cast's hits' values come from. */
  readonly skillId: string;
  /** The skill's cast kind; null for a trigger's hits. */
  readonly kind: SkillType | null;
  /** The cast's start in ms: its first logged landing's time less that landing's frame. */
  readonly start: number;
  /** A trigger's hits on casts of some skills: those skills and its delay in frames (Group.anchor). */
  readonly anchor?: { readonly skills: readonly string[]; readonly delay: number };
}

export interface PlacedHit {
  readonly cast: LoggedCast;
  /** Which logged landing of its key in the cast it is (0: the first). */
  readonly index: number;
  /** The kit hits it can be (the slot's), the likeliest first. */
  readonly hits: readonly KitHit[];
  /** The slot's frame in its cast (absent when the key's landing order is unknown). */
  readonly frame?: number;
  /** The same landing on another enemy (a fight against several in a single-target log): the logged hit whose landing it shares. */
  readonly sameAs?: LogHit;
}

export interface Placement {
  readonly hits: ReadonlyMap<LogHit, PlacedHit>;
  readonly casts: readonly LoggedCast[];
  /** Per skill, how close casts of it placed from different keys are one cast, in ms (mergeMs; absent: CAST_MERGE_MS). */
  readonly merge?: ReadonlyMap<string, number>;
}

function groupsOf(data: GameData, build: Build, panel: StatPanel, fx: LogFixture): Group[] {
  const team = fx.team;
  const kit = effectiveKit(data, build);
  if (!kit) return [];
  const available = (skillId: string) => (h: KitHit) => hitAvailable(data, build, panel, skillId, h, { team });
  return [
    ...kit.skills.map((s): Group => ({ id: s.skillId, skillId: s.skillId, kind: s.kind, anchor: null, hits: s.hits.filter(available(s.skillId)) })),
    ...kit.triggers.flatMap((t): Group[] => {
      const skillId = triggerSkillId(kit.operator, t);
      const hits = allActions(t.do).flatMap((a) => (a.kind === "hits" ? a.hits : [])).filter(available(skillId));
      if (hits.length === 0) return [];
      const anchor = t.on.event === "cast" && t.on.skills?.length ? { skills: t.on.skills, delay: t.delay ?? 0 } : null;
      const firedAt = t.on.event === "hit" && t.on.decorations?.length ? decoratedHits(data, fx, t.on.decorations, t.by === "self" ? build.operator : null).map((h) => h.t + msOf(t.delay ?? 0)) : undefined;
      return [{ id: `trigger:${t.id}`, skillId, kind: null, anchor, ...(firedAt ? { firedAt } : {}), hits }];
    }),
  ];
}

/**
 * The logged hits that are landings with any of these decorations (hitDecorations: a kit hit of their operator's with the
 * key that has one), all operators' or one's (b7b3762d5da8: Arcane's plunging attack at 15374 ms fires Tangtang's
 * OLDEN STARE dive, whose riot spouts from 15928 ms share her battle skill's key: placed as a battle skill, they made
 * one the log doesn't have, with five shots).
 */
function decoratedHits(data: GameData, fx: LogFixture, decorations: readonly HitDecoration[], operator: string | null): LogHit[] {
  const keys = new Set<string>();
  for (const b of fx.team) {
    if (operator !== null && b.operator !== operator) continue;
    for (const s of effectiveKit(data, b)?.skills ?? []) {
      const finisher = data.skills[s.skillId]?.timing?.specification === 8;
      for (const h of s.hits) if (hitDecorations(h, finisher).some((d) => decorations.includes(d))) for (const e of h.events) keys.add(`${b.operator}|${e}`);
    }
  }
  return fx.hits.filter((h) => keys.has(`${h.operator}|${h.event}`));
}

/** A hit's landing frames (a count past its frames repeats the last, `framesEvery` apart); null when it has none. */
export function landingFrames(h: KitHit): number[] | null {
  if (!h.frames?.length) return null;
  const frames = [...h.frames];
  if (typeof h.count === "number") for (let i = frames.length; i < h.count; i++) frames.push((frames.at(-1) as number) + (h.framesEvery ?? 0));
  return frames;
}

/** The frames a hit's landings are logged at: its damage's, `enemyDelay` after a delayed hit's landing (KitHit.enemyDelay). */
export function loggedFrames(h: KitHit): number[] | null {
  return landingFrames(h)?.map((f) => f + (h.enemyDelay ?? 0)) ?? null;
}

/**
 * A group's landing slots of a key in frame order (kit order at one frame);
 * landings of different hits at one frame that both have conditions (`if`,
 * `branch` or `requires`) are alternatives, one slot. Null when a hit with the key has
 * no frames: the order is unknown.
 */
function slotsOf(g: Group, key: string): Slot[] | null {
  const withKey = g.hits.filter((h) => !h.poiseOnly && h.events.includes(key)); // a stagger-only landing (poiseOnly) isn't logged
  if (withKey.some((h) => !loggedFrames(h))) return null;
  const order = variantOrder(withKey);
  const landings: { frame: number; hit: KitHit; order: number }[] = [];
  let n = 0;
  for (const h of order.slotted) for (const frame of loggedFrames(h) as number[]) landings.push({ frame, hit: h, order: n++ });
  landings.sort((a, b) => a.frame - b.frame || a.order - b.order);
  // Alternatives: hits with a condition (`if`), a branch, or a stack requirement (Typhoeus's power shot needs an arrow, the
  // plain one none: one landing per cast, not two).
  const conditional = (h: KitHit) => h.if !== undefined || h.branch !== undefined || h.requires !== undefined;
  const slots: { frame: number; hits: KitHit[] }[] = [];
  for (const l of landings) {
    const last = slots.at(-1);
    if (last && last.frame === l.frame && conditional(l.hit) && last.hits.every((x) => x !== l.hit && conditional(x))) last.hits.push(l.hit);
    else slots.push({ frame: l.frame, hits: [l.hit] });
  }
  // The other variants' hits are alternatives where they land at a slot's frame.
  for (const slot of slots) for (const h of order.others) if ((loggedFrames(h) as number[]).includes(slot.frame) && !slot.hits.includes(h)) slot.hits.push(h);
  return order.others.length ? slots.map((x) => ({ ...x, variant: true as const })) : slots;
}

/**
 * A key's hits split into variants by ranges of one stack (a requirement, or the hit's whole `if`; a cast makes one: Zhuang Fangyi's
 * strike_N / final_N by her Sunderblade count): the slots follow the variant with the most landings, and the others'
 * hits are only alternatives at its frames (3aa6ab93bad4: final_1 at frame 32, between strike_9's 27 and 33, took a
 * cast's second strike, so its seven strikes went to three casts). Without such variants every hit is slotted.
 */
function variantOrder(hits: readonly KitHit[]): { slotted: readonly KitHit[]; others: readonly KitHit[] } {
  const byStack = new Map<string, Map<string, KitHit[]>>();
  // A stack range as a requirement or as the hit's whole condition.
  const rangeOf = (h: KitHit): { stack: string; atLeast?: unknown; below?: unknown } | null => {
    if (h.requires) return h.requires;
    const c = h.if as { stack?: unknown; atLeast?: unknown; below?: unknown } | undefined;
    return c && typeof c.stack === "string" && Object.keys(c).every((k) => k === "stack" || k === "atLeast" || k === "below") ? { stack: c.stack, atLeast: c.atLeast, below: c.below } : null;
  };
  for (const h of hits) {
    const r = rangeOf(h);
    if (!r) continue;
    const range = `${r.atLeast ?? ""}..${r.below ?? ""}`;
    const ranges = byStack.get(r.stack) ?? new Map<string, KitHit[]>();
    ranges.set(range, [...(ranges.get(range) ?? []), h]);
    byStack.set(r.stack, ranges);
  }
  const others = new Set<KitHit>();
  for (const ranges of byStack.values()) {
    if (ranges.size < 3) continue; // two ranges are alternatives at one frame (an arrow or none)
    const count = (list: readonly KitHit[]) => list.reduce((a, h) => a + (loggedFrames(h)?.length ?? 0), 0);
    const best = [...ranges.values()].reduce((a, b) => (count(b) > count(a) ? b : a));
    for (const list of ranges.values()) if (list !== best) for (const h of list) others.add(h);
  }
  return { slotted: hits.filter((h) => !others.has(h)), others: hits.filter((h) => others.has(h)) };
}

const msOf = (frames: number) => (frames * 1000) / FPS;

/**
 * Whether a group's landings of a key are all known in number: every hit with the key has frames and a literal count (or
 * none). A landing on its way (`detached`, `launch`) may come late, but a cast still makes that many. Alternatives at one
 * frame are one slot (slotsOf).
 */
function exactSlots(g: Group, key: string): boolean {
  return g.hits.filter((h) => !h.poiseOnly && h.events.includes(key)).every((h) => landingFrames(h) !== null && (h.count === undefined || typeof h.count === "number"));
}

/**
 * Places every logged hit (see the file comment), twice: the second time,
 * other operators' time stops from the first placement are taken out of the
 * time between a cast's landings (b7b3762d5da8: Tangtang's battle skill from
 * 11.3 s runs on across Jsspsi's combo and Last Rite's ultimate).
 */
export function placeHits(data: GameData, fx: LogFixture): Placement {
  const first = placeWith(data, fx, []).casts;
  const placed = placeWith(data, fx, [...castTimeStops(data, first), ...unplacedCastStops(data, fx, first)]);
  // An ultimate isn't cast again within its own action: its casts placed from different keys within its duration are one
  // (d774d0ce7bd3: Liino's at 116.5 s, its beats, projectiles and side projectiles placed 2 s apart: three casts, three bombs).
  const merge = new Map<string, number>();
  for (const c of placed.casts) if (c.kind === "ultimate") merge.set(c.skillId, Math.max(CAST_MERGE_MS, msOf(data.skills[c.skillId]?.timing?.durationFrames ?? 0)));
  return { ...placed, merge };
}

/** How far from a placed cast of its skill a logged cast event may be and still be that cast (ms; unplacedCastStops). */
const UNPLACED_CAST_MS = 2500;

/**
 * The time stops of the log's cast events (LogFixture.casts) that no placed cast of their skill is near
 * (UNPLACED_CAST_MS): skills whose damage comes as other skills' keys, or none (5082ceaffad1: Yvonne's ultimate at
 * 38160 ms, between Ardelia's combo projectile at 36030 ms and its bomb at 42441 ms). Each from its event's time; an
 * event within the skill's duration of an earlier one is that cast's (the log repeats some ultimates' events while they
 * last: Liino's every ~3.5 s of Cosmovoice, Ardelia's ~3 s after hers).
 */
function unplacedCastStops(data: GameData, fx: LogFixture, placed: readonly LoggedCast[]): TimeStop[] {
  const out: TimeStop[] = [];
  const last = new Map<string, number>();
  const kits = new Map(fx.team.map((b) => [b.operator, effectiveKit(data, b)?.skills ?? []]));
  for (const lc of fx.casts ?? []) {
    const timing = data.skills[lc.skill]?.timing;
    if (!timing?.slowdowns.length) continue;
    const key = `${lc.operator}|${lc.skill}`;
    const prev = last.get(key);
    if (prev !== undefined && lc.t - prev <= msOf(timing.durationFrames)) continue;
    last.set(key, lc.t);
    const skills = kits.get(lc.operator) ?? [];
    const kit = new Set(skills.map((s) => s.skillId));
    if (placed.some((c) => c.operator === lc.operator && castEventOf(lc.skill, c.skillId, kit) && Math.abs(c.start - lc.t) <= UNPLACED_CAST_MS)) continue;
    const at = Math.round((lc.t * FPS) / 1000);
    const kind = skills.find((s) => castEventOf(lc.skill, s.skillId, kit))?.kind;
    out.push(...timing.slowdowns.map((d) => ({ start: at + d.from, scales: d.scales, operator: lc.operator, skillId: lc.skill, ...(kind ? { kind } : {}) })));
  }
  return out;
}

function placeWith(data: GameData, fx: LogFixture, stops: readonly TimeStop[]): Placement {
  const hits = new Map<LogHit, PlacedHit>();
  const casts: LoggedCast[] = [];
  const sorted = [...fx.hits].sort((a, b) => a.t - b.t);
  for (const build of fx.team) {
    const groups = groupsOf(data, build, computeStats(data, build), fx);
    if (groups.length === 0) continue;
    const mine = sorted.filter((h) => h.operator === build.operator);
    const others = stops.filter((x) => x.operator !== build.operator);
    const slotCache = new Map<string, Slot[] | null>();
    const slots = (g: Group, key: string) => {
      const k = `${g.id}|${key}`;
      if (!slotCache.has(k)) slotCache.set(k, slotsOf(g, key));
      return slotCache.get(k) ?? null;
    };
    const groupsWith = (key: string) => groups.filter((g) => g.hits.some((h) => h.events.includes(key)));
    const kitSkills = new Set(groups.filter((g) => g.kind !== null).map((g) => g.skillId));
    // Not one logged at another operator's time-stopping cast's event: pressed during its stop, the log has it at the
    // stop's end (5082ceaffad1: Yvonne's and Ardelia's combos at Seraph's ultimate's 33.71 s; e82d45c46040: Li Zhiyan's at
    // 3.90 s, her seal at 7.02 s at frame 15 only after Jsspsi's and her own ultimates).
    const stopping = (fx.casts ?? []).filter((c) => c.operator !== build.operator && data.skills[c.skill]?.timing?.slowdowns.some((d) => Math.min(...d.scales) === 0));
    const events = (fx.casts ?? []).filter((c) => c.operator === build.operator && !stopping.some((x) => Math.abs(x.t - c.t) <= 1));
    const eventsOf = (g: Group) => (g.kind === null ? [] : events.filter((e) => castEventOf(e.skill, g.skillId, kitSkills)).map((e) => e.t));
    /** One pass over the operator's logged hits; `starts` (by skill) picks among groups sharing a key. */
    const pass = (starts: ReadonlyMap<string, readonly number[]> | null) => {
      const placed = new Map<LogHit, PlacedHit>();
      const current = new Map<string, { cast: LoggedCast; first: number; last: LogHit; index: number; span: number; longest: number; slots: Slot[] | null; exact: boolean }>();
      // Casts placed so far, per group: a key's first landing within an earlier cast's reach is that cast's (joinable).
      const opened = new Map<string, LoggedCast[]>();
      // The operator's casts of skills so far, for a key several chain steps share (choose: the step after the latest
      // whose windows list one).
      const skillCasts: LoggedCast[] = [];
      for (const h of mine) {
        const candidates = groupsWith(h.event);
        if (candidates.length === 0) continue;
        if (!starts && candidates.length > 1) continue; // the first pass places only keys of one group
        const cur = current.get(h.event);
        // The same cast while within its landings' span, or while it has landings to come within the skill's whole action
        // (a landing after a wait: Rossi's Lift 2.2 s after her charge, where the logged span is 0.6 s).
        const elapsed = cur ? worldMs(cur.first, h.t, others) : 0;
        // Not once another of the operator's skills was cast since, unless the landing to come is on its way (detached): the
        // new cast ended this one (4e5e1390085e: Rossi's attack 4 at 14708 ms after her attack 3, not hit_ai's landings at
        // frame 195+ of her attack 4 at 6974 ms).
        // A landing at its next slot's own frame is the cast's, whatever seems to start in between (012ae1c80ae6: Camille's
        // combo hits at 33910 / 34117 / 34798 ms, its frames 19 / 27 / 47, around an attack 3 placed at 33552 ms).
        const next = cur?.slots?.[cur.index + 1];
        const head = cur?.slots?.[0];
        const onTime = cur !== undefined && next !== undefined && head !== undefined && Math.abs(elapsed - msOf(next.frame - head.frame)) <= ON_TIME_MS;
        const superseded = cur !== undefined && next !== undefined && !onTime && !next.hits.some((x) => x.detached || x.launch !== undefined) &&
          [...opened.values()].flat().some((c) => c !== cur.cast && c.kind !== null && c.start > cur.cast.start && c.start <= h.t);
        const toCome = cur?.slots && cur.index + 1 < cur.slots.length && elapsed <= cur.longest + CAST_SLACK_MS;
        // A variant's slot may never come (variantOrder): a logged press of a skill of the cast's kind since its first
        // landing starts a new cast (3aa6ab93bad4: a cast of two strikes doesn't take the next cast's seven; d774d0ce7bd3:
        // a battle skill's strikes 2.6 s apart, no press between, are one cast's).
        const pressed = next?.variant === true && cur !== undefined && (fx.casts ?? []).some((c) => c.operator === build.operator && c.t > cur.first && c.t <= h.t && groups.find((x) => x.id === c.skill)?.kind === cur.cast.kind);
        // A cast whose landings of the key are all known (exactSlots) and all logged already: another is a new cast, however
        // soon (Typhoeus's hover shots, 0.6 s apart under one key, were one cast with one landing: every second shot unlanded).
        const used = cur?.exact === true && cur.slots !== null && cur.index + 1 >= cur.slots.length;
        // Its landings all logged, another at its last one's time is that landing on a second enemy (9c6e97486a9d: two
        // targets, two hits per Typhoeus shot, were two shots each, which ended her hovers early): the same slot.
        if (cur && used && h.t === cur.last.t) {
          const slot = cur.slots?.[cur.index];
          placed.set(h, { cast: cur.cast, index: cur.index, hits: slot ? slot.hits : allHits(candidates, h.event), ...(slot ? { frame: slot.frame } : {}), sameAs: cur.last });
          continue;
        }
        // An ultimate isn't cast again within its own action: a landing of its key within the skill's duration is the same
        // cast's while it has landings to come, whatever the operator did since (5082ceaffad1: Ardelia's sheep, which fly
        // at random, so off their slots' frames, made three casts from 41880 to 45866 ms, around her combo's bomb;
        // af7b7f865906: five sheep, four casts, around her attack 3 at 59.7 s).
        const sameUltimate = cur !== undefined && cur.cast.kind === "ultimate" && (cur.slots === null || cur.index + 1 < cur.slots.length) && worldMs(cur.cast.start, h.t, others) <= cur.longest + CAST_SLACK_MS;
        if (cur && !used && (sameUltimate || (!superseded && !pressed && (elapsed <= cur.span + CAST_SLACK_MS || toCome)))) {
          cur.index++;
          cur.last = h;
          const s = cur.slots;
          const slot = s ? s[Math.min(cur.index, s.length - 1)] : undefined;
          placed.set(h, { cast: cur.cast, index: cur.index, hits: slot ? slot.hits : allHits(candidates, h.event), ...(slot ? { frame: slot.frame } : {}) });
          continue;
        }
        const free = (c: LoggedCast) => ![...placed].some(([x, p]) => p.cast === c && x.event === h.event);
        const late = joinDelayed(candidates, h, slots, opened, stops, free);
        // A trigger on casts fires once per cast: no new cast of its group once one was placed since the anchor before
        // the latest one it could be (a cast of the skills it fires on, plus its delay, placed up to the skill's duration
        // after where this cast would start: an ultimate's casts placed from its keys merge within it), while another
        // candidate is left (Liino's ultimate's first beat, trigger ult_song at frame 77, and her song's later beats,
        // cosmovoice_beat's ticks: each later beat made an ult_song of its own, so no tick was pinned to its logged beat;
        // a7a7a40c97ed's first beat at 45.64 s comes 3.1 s before the projectiles its ultimate is placed from,
        // 984748cfa662's at 129.37 s 2.0 s before, and each is still that ultimate's).
        const anchorFree = (g: Group) => {
          if (!g.anchor || !starts) return true;
          const a = g.anchor;
          const start = h.t - msOf(slots(g, h.event)?.[0]?.frame ?? 0);
          const reach = (s: string) => Math.max(ANCHOR_MS, msOf(data.skills[s]?.timing?.durationFrames ?? 0));
          const refs = a.skills.flatMap((s) => (starts.get(s) ?? []).map((t) => ({ at: t + msOf(a.delay), reach: reach(s) }))).filter((r) => r.at <= start + r.reach).sort((x, y) => x.at - y.at);
          if (refs.length === 0) return true;
          // One cast placed from several keys is one anchor (4bfc6f3e84b8: Liino's ultimate at 52.70, 52.84 and 55.40 s).
          const anchors: { first: number; last: number; reach: number }[] = [];
          for (const r of refs) {
            const cur = anchors.at(-1);
            if (cur && r.at - cur.last <= cur.reach) cur.last = r.at;
            else anchors.push({ first: r.at, last: r.at, reach: r.reach });
          }
          const prev = anchors.at(-2);
          const since = prev ? prev.last + prev.reach : -Infinity;
          return !(opened.get(g.id) ?? []).some((c) => c.start > since);
        };
        const eligible = candidates.filter(anchorFree);
        const g: Group = late?.g ?? choose(eligible.length ? eligible : candidates, h, starts, slots, skillCasts.map((c) => ({ cast: c, timing: data.skills[c.skillId]?.timing })), stops);
        const s = slots(g, h.event);
        const first = s?.[0];
        const cast: LoggedCast = late?.cast ?? joinable(opened.get(g.id) ?? [], h, first?.frame ?? 0, stops) ?? { operator: build.operator, key: h.event, group: g.id, skillId: g.skillId, kind: g.kind, start: castStart(h.t, first ? (g.kind === null ? first.frame : ownStopLoggedFrame(data.skills[g.skillId]?.timing, first.hits, first.frame)) : 0, g.kind === "combo" ? others.filter((x) => x.kind !== "combo") : others, eventsOf(g)), ...(g.anchor ? { anchor: g.anchor } : {}) };
        if (!opened.get(g.id)?.includes(cast)) opened.set(g.id, [...(opened.get(g.id) ?? []), cast]);
        if (cast.kind !== null && !skillCasts.includes(cast)) skillCasts.push(cast);
        const span = s && first ? msOf((s.at(-1) as Slot).frame - first.frame) : 0;
        const longest = Math.max(span, g.kind !== null ? msOf(data.skills[g.skillId]?.timing?.durationFrames ?? 0) : 0);
        current.set(h.event, { cast, first: h.t, last: h, index: 0, span, longest, slots: s, exact: exactSlots(g, h.event) });
        placed.set(h, { cast, index: 0, hits: first ? first.hits : allHits(candidates, h.event), ...(first ? { frame: first.frame } : {}) });
      }
      return placed;
    };
    const first = pass(null);
    const starts = new Map<string, number[]>();
    for (const p of new Set([...first.values()].map((x) => x.cast))) starts.set(p.group, [...(starts.get(p.group) ?? []), p.start]);
    const placed = pass(starts);
    for (const [h, p] of placed) hits.set(h, p);
    casts.push(...new Set([...placed.values()].map((p) => p.cast)));
  }
  return { hits, casts };
}

/**
 * The cast of the same skill, placed from another key, that a key's first logged landing belongs to: the latest that
 * started no later than the landing and no earlier than the landing's kit frame (plus CAST_SLACK_MS) of the world's time
 * before it. A skill's jumps shorten its timeline, so a late landing comes sooner than its kit frame says
 * (fixtures/zmdlogs-4e5e1390085e.json: Rossi's wolves, kit frame 230, land 115 frames after her battle skill at 9483 ms;
 * placed from their frame alone, they made a battle skill at 5647 ms the log doesn't have). The log's time runs on
 * through time stops, which hold a landing still to come, its own operator's too (5082ceaffad1: Ardelia's combo bomb,
 * 52 frames after its projectile at 36030 ms, logged at 42441 ms across Yvonne's ultimate and her own). Null: none, a
 * new cast.
 */
function joinable(casts: readonly LoggedCast[], h: LogHit, frame: number, stops: readonly TimeStop[]): LoggedCast | null {
  let best: LoggedCast | null = null;
  for (const c of casts) {
    // Not the cast's own stops: its frames run on through them (Liino's ultimate).
    const held = stops.filter((s) => s.operator !== c.operator || s.skillId !== c.skillId);
    if (c.key === h.event || c.start > h.t || worldMs(c.start, h.t, held) > msOf(frame) + CAST_SLACK_MS) continue;
    if (!best || c.start > best.start) best = c;
  }
  return best;
}

/**
 * The cast a delayed hit's logged landing (KitHit.enemyDelay: its damage) belongs to: of the groups whose landing of the
 * key is delayed, the latest cast that started before it and has no landing of the key yet, within the landing's frame
 * plus CAST_SLACK_MS of the enemy's time: every time stop holds it, its own operator's too (dbaee23b801d: Typhoeus's
 * burst 2.5 s after her arrow at 5890 ms, across Liino's ultimate). A shot's burst is the latest shot's, whichever step
 * (bdf223db8e49: a burst at 14487 ms made a shot 5 the log doesn't have, its own shot 1 at 14025 ms none). Null: none.
 */
function joinDelayed(candidates: readonly Group[], h: LogHit, slots: (g: Group, key: string) => Slot[] | null, opened: ReadonlyMap<string, readonly LoggedCast[]>, stops: readonly TimeStop[], free: (c: LoggedCast) => boolean): { g: Group; cast: LoggedCast } | null {
  let best: { g: Group; cast: LoggedCast } | null = null;
  for (const g of candidates) {
    const first = slots(g, h.event)?.[0];
    if (!first?.hits.some((x) => x.enemyDelay !== undefined)) continue;
    for (const c of opened.get(g.id) ?? []) {
      if (c.key === h.event || c.start > h.t || worldMs(c.start, h.t, stops) > msOf(first.frame) + CAST_SLACK_MS || !free(c)) continue;
      if (!best || c.start > best.cast.start) best = { g, cast: c };
    }
  }
  return best;
}

/** Casts of one skill placed from different keys this close are one cast. */
const CAST_MERGE_MS = 1000;

/** How close casts of a skill placed from different keys are one cast (ms): Placement.merge, else CAST_MERGE_MS. */
export function mergeMs(placement: Pick<Placement, "merge">, skillId: string): number {
  return placement.merge?.get(skillId) ?? CAST_MERGE_MS;
}

/** The logged casts of kit skills (not triggers' hits), one per cast: a cast placed from several of its keys counts once, at its earliest start. */
export function distinctCasts(placement: Placement): LoggedCast[] {
  const out: LoggedCast[] = [];
  for (const c of [...placement.casts].sort((a, b) => a.start - b.start)) {
    if (c.kind === null) continue;
    // Placed from the same key they are two casts (the placement already joined what one cast's landings of it can be),
    // unless an ultimate's, which isn't cast again within its own action (9c6e97486a9d: Liino's projectiles at 71835 to
    // 73824 ms fill their slots, the rest at 74159 ms start another cast 2.3 s after the first).
    if (out.some((x) => x.operator === c.operator && x.skillId === c.skillId && (x.key !== c.key || c.kind === "ultimate") && Math.abs(x.start - c.start) <= mergeMs(placement, c.skillId))) continue;
    out.push(c);
  }
  // A trigger's landing on a skill's cast that puts the cast earlier than its own keys do moves it there (dbaee23b801d:
  // Liino's ultimate, its first song beat at 8258 ms at frame 77, its projectiles' start 0.4 s later, its Cosmovoice
  // buffs then after Arcane's hits that the log has them on).
  for (const t of placement.casts) {
    if (t.kind !== null || !t.anchor) continue;
    const at = t.start - msOf(t.anchor.delay);
    const i = out.findIndex((x) => x.operator === t.operator && t.anchor?.skills.includes(x.skillId) && at < x.start && x.start - at <= mergeMs(placement, x.skillId));
    if (i >= 0) out[i] = { ...(out[i] as LoggedCast), start: at };
  }
  return out;
}

/** Without a landing order: every hit with the key, in kit order (the replay takes the first). */
function allHits(groups: readonly Group[], key: string): KitHit[] {
  return groups.flatMap((g) => g.hits.filter((h) => h.events.includes(key)));
}

/** How far a cast's start may be from its anchor's (a skill's own cast placed from another key, or the skill a trigger fires on). */
const ANCHOR_MS = 1500;

/**
 * Which group a new cast of a key shared by several is: the one whose
 * anchor (the skill itself, placed from its other keys, or the skill whose
 * cast fires the trigger, plus the delay) started closest to where this
 * cast would start; else the chain step after the operator's latest cast
 * whose windows list a candidate starting within its action plus
 * CAST_SLACK_MS (for steps alike in every key, the one whose window lies
 * nearest its start, past a skill that keeps the chain) (`prev`: Rossi's
 * chain steps share keys; a follow-up after
 * a basic attack cast during its skill: Wulfgard's combo 3); else the
 * first in kit order. Steps gated by the kit's state rather than windows (Typhoeus's
 * hover attacks): the replay casts the step the engine allows
 * (buffreplay.ts chainStepFor).
 */
function choose(candidates: readonly Group[], h: LogHit, starts: ReadonlyMap<string, readonly number[]> | null, slots: (g: Group, key: string) => Slot[] | null, prevs: readonly { cast: LoggedCast; timing: SkillTiming | null | undefined }[], stops: readonly TimeStop[]): Group {
  if (candidates.length === 1 || !starts) return candidates[0] as Group;
  let best: { g: Group; d: number } | null = null;
  for (const g of candidates) {
    const start = h.t - msOf(slots(g, h.event)?.[0]?.frame ?? 0);
    const refs = g.anchor ? g.anchor.skills.flatMap((s) => (starts.get(s) ?? []).map((t) => t + msOf((g.anchor as { delay: number }).delay))) : (g.firedAt ?? starts.get(g.id) ?? []);
    for (const r of refs) {
      const d = Math.abs(start - r);
      if (d <= ANCHOR_MS && (!best || d < best.d)) best = { g, d };
    }
  }
  if (best) return best.g;
  const start = (g: Group) => h.t - msOf(slots(g, h.event)?.[0]?.frame ?? 0);
  // The latest first. Within a cast's action in the world's time: other casts' time stops hold it (489c0be3e162:
  // Wulfgard's combo 2 at 103625 ms, its ticks after Li Zhiyan's ultimate, an attack 3 at 103925 ms, then combo 3's
  // perfect hit at 107319 ms).
  // Steps alike in every key (the same keys, one landing each: Zhuang Fangyi's Empyrean attacks 1 and 2, whose four
  // entities are the same files) only the windows tell apart.
  const keys = (g: Group) => [...new Set(g.hits.flatMap((x) => x.events))].sort().join(" ");
  const alike = candidates.length > 1 && candidates.every((g) => g.kind === "basic" && g.hits.length === 1 && g.hits[0]?.count === 1 && keys(g) === keys(candidates[0] as Group));
  for (const prev of [...prevs].sort((a, b) => b.cast.start - a.cast.start)) {
    if (!prev.timing) continue;
    const timing = prev.timing;
    const held = stops.filter((s) => s.operator !== prev.cast.operator || s.skillId !== prev.cast.skillId);
    if (alike) {
      // A skill that keeps the basic-attack chain (dontInterruptCombo) doesn't decide its next step; the step before it
      // does (her Empyrean battle skill between her Empyrean attacks 1 and 2: d774d0ce7bd3 26504 ms).
      if (timing.keepsChain) continue;
      // The one whose window of the latest cast lies nearest its start (in it, or the least outside it), the kit's order
      // between equals: attack 1's windows list attack 2 from frame 22 and attack 1 from 60 (d774d0ce7bd3's 17896 ms is
      // attack 2's, its damage x1.4 attack 1's; 3aa6ab93bad4's 120691 ms 0.43 s of the world's time after attack 1).
      let near: { g: Group; d: number } | null = null;
      for (const g of candidates) {
        if (start(g) < prev.cast.start) continue;
        const at = worldMs(prev.cast.start, start(g), held);
        if (at > msOf(timing.durationFrames) + CAST_SLACK_MS) continue;
        for (const w of timing.windows) {
          if (!w.skills.includes(g.skillId)) continue;
          const d = Math.max(0, msOf(w.from) - at, at - msOf(w.to));
          if (!near || d < near.d) near = { g, d };
        }
      }
      if (near) return near.g;
      continue;
    }
    const listed = new Set(timing.windows.flatMap((w) => w.skills));
    const next = candidates.find((g) => g.kind !== null && listed.has(g.skillId) && start(g) >= prev.cast.start && worldMs(prev.cast.start, start(g), held) <= msOf(timing.durationFrames) + CAST_SLACK_MS);
    if (next) return next;
  }
  return candidates[0] as Group;
}
