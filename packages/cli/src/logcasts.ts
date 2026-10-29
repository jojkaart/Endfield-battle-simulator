// Where a battle log's hits fall in their casts (batch 4 L1): each logged hit
// of an operator with a kit is mapped to the kit landing it is (the n-th
// logged landing of a key within a cast is the n-th kit landing with that
// key, in frame order), and each cast is placed in time from its first logged
// hit. The reaction replay applies the landing's own applications (L1) and
// the casts' time stops (L5); the log check counts Link sources (L3).

import { computeStats, effectiveKit, FPS, hitAvailable, triggerSkillId, allActions, type Build, type GameData, type KitHit, type SkillTiming, type SkillType, type StatPanel } from "@efsim/engine";
import type { LogFixture, LogHit } from "@efsim/data";

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
  readonly start: number;
  readonly scales: readonly number[];
  readonly operator: string;
  readonly skillId: string;
}

/** The time stops of logged casts of skills that have them, each cast placed from its first logged hit. */
export function castTimeStops(data: GameData, casts: readonly LoggedCast[]): TimeStop[] {
  return distinctCasts({ hits: new Map(), casts }).flatMap((c) => {
    const at = Math.round((c.start * FPS) / 1000);
    return (data.skills[c.skillId]?.timing?.slowdowns ?? []).map((d) => ({ start: at + d.from, scales: d.scales, operator: c.operator, skillId: c.skillId }));
  });
}

/** The world's time from `from` to `to` ms under time stops, in ms: each frame counts at the lowest scale of the stops then (1 without one). */
export function worldMs(from: number, to: number, stops: readonly TimeStop[]): number {
  const [a, b] = [Math.round((from * FPS) / 1000), Math.round((to * FPS) / 1000)];
  const relevant = stops.filter((s) => s.start < b && s.start + s.scales.length > a);
  if (relevant.length === 0) return to - from;
  let held = 0;
  for (let f = a; f < b; f++) {
    let rate = 1;
    for (const s of relevant) if (f >= s.start && f < s.start + s.scales.length) rate = Math.min(rate, s.scales[f - s.start] as number);
    held += 1 - rate;
  }
  return to - from - msOf(held);
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
}

export interface PlacedHit {
  readonly cast: LoggedCast;
  /** Which logged landing of its key in the cast it is (0: the first). */
  readonly index: number;
  /** The kit hits it can be (the slot's), the likeliest first. */
  readonly hits: readonly KitHit[];
  /** The slot's frame in its cast (absent when the key's landing order is unknown). */
  readonly frame?: number;
}

export interface Placement {
  readonly hits: ReadonlyMap<LogHit, PlacedHit>;
  readonly casts: readonly LoggedCast[];
}

function groupsOf(data: GameData, build: Build, panel: StatPanel, team: readonly Build[]): Group[] {
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
      return [{ id: `trigger:${t.id}`, skillId, kind: null, anchor, hits }];
    }),
  ];
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
  return placeWith(data, fx, castTimeStops(data, placeWith(data, fx, []).casts));
}

function placeWith(data: GameData, fx: LogFixture, stops: readonly TimeStop[]): Placement {
  const hits = new Map<LogHit, PlacedHit>();
  const casts: LoggedCast[] = [];
  const sorted = [...fx.hits].sort((a, b) => a.t - b.t);
  for (const build of fx.team) {
    const groups = groupsOf(data, build, computeStats(data, build), fx.team);
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
    /** One pass over the operator's logged hits; `starts` (by skill) picks among groups sharing a key. */
    const pass = (starts: ReadonlyMap<string, readonly number[]> | null) => {
      const placed = new Map<LogHit, PlacedHit>();
      const current = new Map<string, { cast: LoggedCast; first: number; index: number; span: number; longest: number; slots: Slot[] | null; exact: boolean }>();
      // Casts placed so far, per group: a key's first landing within an earlier cast's reach is that cast's (joinable).
      const opened = new Map<string, LoggedCast[]>();
      // The operator's latest cast of a skill, for a key several chain steps share (choose: the step after it).
      let latest: LoggedCast | null = null;
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
        if (cur && !superseded && !used && !pressed && (elapsed <= cur.span + CAST_SLACK_MS || toCome)) {
          cur.index++;
          const s = cur.slots;
          const slot = s ? s[Math.min(cur.index, s.length - 1)] : undefined;
          placed.set(h, { cast: cur.cast, index: cur.index, hits: slot ? slot.hits : allHits(candidates, h.event), ...(slot ? { frame: slot.frame } : {}) });
          continue;
        }
        const free = (c: LoggedCast) => ![...placed].some(([x, p]) => p.cast === c && x.event === h.event);
        const late = joinDelayed(candidates, h, slots, opened, stops, free);
        const g: Group = late?.g ?? choose(candidates, h, starts, slots, latest ? { cast: latest, timing: data.skills[latest.skillId]?.timing } : null);
        const s = slots(g, h.event);
        const first = s?.[0];
        const cast: LoggedCast = late?.cast ?? joinable(opened.get(g.id) ?? [], h, first?.frame ?? 0) ?? { operator: build.operator, key: h.event, group: g.id, skillId: g.skillId, kind: g.kind, start: h.t - msOf(first?.frame ?? 0) };
        if (!opened.get(g.id)?.includes(cast)) opened.set(g.id, [...(opened.get(g.id) ?? []), cast]);
        if (cast.kind !== null && (!latest || cast.start >= latest.start)) latest = cast;
        const span = s && first ? msOf((s.at(-1) as Slot).frame - first.frame) : 0;
        const longest = Math.max(span, g.kind !== null ? msOf(data.skills[g.skillId]?.timing?.durationFrames ?? 0) : 0);
        current.set(h.event, { cast, first: h.t, index: 0, span, longest, slots: s, exact: exactSlots(g, h.event) });
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
 * started no later than the landing and no earlier than the landing's kit frame (plus CAST_SLACK_MS) before it. A
 * skill's jumps shorten its timeline, so a late landing comes sooner than its kit frame says
 * (fixtures/zmdlogs-4e5e1390085e.json: Rossi's wolves, kit frame 230, land 115 frames after her battle skill at 9483 ms;
 * placed from their frame alone, they made a battle skill at 5647 ms the log doesn't have). Null: none, a new cast.
 */
function joinable(casts: readonly LoggedCast[], h: LogHit, frame: number): LoggedCast | null {
  let best: LoggedCast | null = null;
  for (const c of casts) {
    if (c.key === h.event || c.start > h.t || c.start < h.t - msOf(frame) - CAST_SLACK_MS) continue;
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

/** The logged casts of kit skills (not triggers' hits), one per cast: a cast placed from several of its keys counts once, at its earliest start. */
export function distinctCasts(placement: Placement): LoggedCast[] {
  const out: LoggedCast[] = [];
  for (const c of [...placement.casts].sort((a, b) => a.start - b.start)) {
    if (c.kind === null) continue;
    // Placed from the same key they are two casts (the placement already joined what one cast's landings of it can be).
    if (out.some((x) => x.operator === c.operator && x.skillId === c.skillId && x.key !== c.key && Math.abs(x.start - c.start) <= CAST_MERGE_MS)) continue;
    out.push(c);
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
 * (`prev`: a candidate its windows list, starting within its action plus
 * CAST_SLACK_MS: Rossi's chain steps share keys); else the first in kit
 * order. Steps gated by the kit's state rather than windows (Typhoeus's
 * hover attacks): the replay casts the step the engine allows
 * (buffreplay.ts chainStepFor).
 */
function choose(candidates: readonly Group[], h: LogHit, starts: ReadonlyMap<string, readonly number[]> | null, slots: (g: Group, key: string) => Slot[] | null, prev: { cast: LoggedCast; timing: SkillTiming | null | undefined } | null): Group {
  if (candidates.length === 1 || !starts) return candidates[0] as Group;
  let best: { g: Group; d: number } | null = null;
  for (const g of candidates) {
    const start = h.t - msOf(slots(g, h.event)?.[0]?.frame ?? 0);
    const refs = g.anchor ? g.anchor.skills.flatMap((s) => (starts.get(s) ?? []).map((t) => t + msOf((g.anchor as { delay: number }).delay))) : (starts.get(g.id) ?? []);
    for (const r of refs) {
      const d = Math.abs(start - r);
      if (d <= ANCHOR_MS && (!best || d < best.d)) best = { g, d };
    }
  }
  if (best) return best.g;
  if (prev?.timing) {
    const start = (g: Group) => h.t - msOf(slots(g, h.event)?.[0]?.frame ?? 0);
    const listed = new Set(prev.timing.windows.flatMap((w) => w.skills));
    const next = candidates.find((g) => g.kind !== null && listed.has(g.skillId) && start(g) >= prev.cast.start && start(g) <= prev.cast.start + msOf(prev.timing?.durationFrames ?? 0) + CAST_SLACK_MS);
    if (next) return next;
  }
  return candidates[0] as Group;
}
