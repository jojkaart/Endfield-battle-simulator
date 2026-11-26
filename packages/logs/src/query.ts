// Questions about what a log itself says, for triage and diagnosis (`efsim zmdlogs instances | census | buffs |
// lanes | control | cadence`): what the round-3 re-triage and test-deciding agents each wrote 10–30 throwaway scripts
// for (round-4 friction reports). The engine-check views are views.ts; these read the log (and the placement, which
// knows what the log's events mean), not the replay's buffs.
//
// - loggedSkillInstances: one entry per real cast, as the log means it: casts placed from their hits (combos, which
//   log no cast event; skills logged under a buff's key the kit names), each with the log's cast events that belong to
//   it (an ultimate's event repeats every ~3.5 s while it lasts), and cast events with no hit of their skill (Si's
//   periodic battle-button events: presses or not, the log can't say).
// - buffLanes / listedGameBuffs: a listed game buff's runs (its `source` and `since`: first and last listed hit, the next
//   hit of the same hitter that doesn't list it) and what each listed id stands for in the kits (KitBuff.gameBuff,
//   loggedAs and their affixes: teamBuffNames), with whose hits list it.
// - census: counts of a selection (casts, hit groups or lanes) per log, optionally with the nearest item of another
//   selection; its first lines record the selection and the command that reruns it, so a claim cites it.
// - controlSpans: who the log shows controlled when (castassembly.ts controlledFromLog's evidence), with each cast.
// - cadence: one event key's hit groups across logs with the world-time gaps between them (time stops taken out).

import { effectiveKit, FPS, type GameData, type SkillType } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import { assembleCasts, controlSwaps, replayStops, type ReplayTimeStop } from "./castassembly.ts";
import { ENGINE_STATUS_BUFF, teamBuffNames } from "./enginecheck.ts";
import { castEventOf, distinctCasts, mergeMs, placeHits, worldMs, type LoggedCast, type Placement } from "./logcasts.ts";
import type { DevFixture } from "./logs.ts";
import type { LogCast, LogEffect, LogFixture, LogHit } from "./zmdlogs.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;
const s = (ms: number) => (ms / 1000).toFixed(2);
/** An operator's label: its English name, else its id without the chr_NNNN_ prefix. */
export function operatorLabel(data: GameData, op: string): string {
  return data.operators[op]?.name ?? op.replace(/^chr_\d+_/, "");
}
const shortSkill = (id: string) => id.replace(/^chr_\d+_[a-z0-9]+_/, "");

export type { ReplayTimeStop } from "./castassembly.ts";

/**
 * The time stops of the casts the replay assembles (assembleCasts: the placed casts, the log's hitless cast events at
 * the start the replay gives them, the inferred casts), before control drops any: what the world-time views take out.
 * Round 6: they took castTimeStops of the placed casts only, which misses an ultimate placed from its cast event
 * (db8711232de9: Laevatain's at 16.60 s, logged at its stop's end, so `worldtime 16 21` counted Camille's combo alone).
 * A slot press counts only when the replay makes it as a variant (`as`).
 *
 * Round 11 (kit-buff leads report point 2): a hitless cast event of a skill a kit buff of its operator ticks as
 * (KitBuff.ticksLoggedAs) is the buff's tick where the replay didn't make the cast (its buff was on: 4d60e7fe92c2's
 * late ultimate_skill events, Zhuang Fangyi's Empyrean ending), and a real cast where it did (3aa6ab93bad4's seven
 * ultimates, whose hits the placement doesn't place). With `replay`, those the replay didn't make are left out, by
 * its own record (BuffReplay.made) and the rule the hold placement reads (castassembly.ts replayStops, round 15: one
 * list; until then the views read BuffReplay.skipped's reasons, the placement the made casts); without one they stay,
 * `tickRead` (`casts`, `worldtime` without the replay say so). replayTimeStopsWithTicks also returns those casts.
 */
export function replayTimeStops(data: GameData, fx: LogFixture, placement: Placement = placeHits(data, fx), replay?: Pick<BuffReplay, "made">): ReplayTimeStop[] {
  return replayTimeStopsWithTicks(data, fx, placement, replay).stops;
}

/** replayTimeStops and, with the replay, the hitless events it read as a buff's tick (replayStops `ticks`: no stop). */
export function replayTimeStopsWithTicks(data: GameData, fx: LogFixture, placement: Placement = placeHits(data, fx), replay?: Pick<BuffReplay, "made">): ReturnType<typeof replayStops> {
  const kits = fx.team.flatMap((b) => {
    const k = effectiveKit(data, b);
    return k ? [k] : [];
  });
  return replayStops(data, kits, assembleCasts(data, fx, placement, kits), replay?.made.map((m) => m.cast));
}

/** A tickRead stop's mark in a view without the replay (`casts`, `worldtime`). */
export const tickReadNote = (st: ReplayTimeStop) => (st.tickRead ? " [a hitless event of a skill a kit buff ticks as: the replay's tick unless it made the cast; replay --stops says which]" : "");

const notPlaced = (st: ReplayTimeStop) => (st.placed ? "" : " [no placed hits: from its cast event or inferred]");

/** A logged hit this close to a cast event (ms) is at it, not before or after it (the log batches its ms). */
const EVENT_EDGE_MS = 30;
/** A logged hit within this of a cast event (ms) puts the event at an edge of the hitless stretch around it. */
const EVENT_NEAR_MS = 400;

/**
 * Where one of the log's cast events sits in the hitless stretch around it, for a skill whose timing stops the world
 * (a slow-down down to scale 0: no hit can land inside it), else null (placement leads report point 1: whether an
 * ultimate's event is logged at its press or at its stop's end took a probe, scripts/probes/placement/ult-events.ts:
 * the end for most operators, Si 26 of 35, Liino 13 of 21, Laevatain 11 of 16; docs/design/data.md "What the log
 * records"). `before` / `after`: the log time to the nearest logged hit on each side (more than EVENT_EDGE_MS away);
 * "press": a hit just before, none for most of the stop after; "end": the reverse; "inside": no hit near either side;
 * "unclear": hits near both (no stop there in the log), or a stretch shorter than the stop on the far side.
 */
export function castEventPlace(data: GameData, hitTimes: readonly number[], event: { readonly t: number; readonly skill: string }): { readonly place: "press" | "end" | "inside" | "unclear"; readonly before: number; readonly after: number; readonly stopMs: number } | null {
  const stop = data.skills[event.skill]?.timing?.slowdowns.find((d) => Math.min(...d.scales) === 0);
  if (!stop) return null;
  const stopMs = msOf(stop.scales.length);
  const before = event.t - ([...hitTimes].reverse().find((t) => t < event.t - EVENT_EDGE_MS) ?? -Infinity);
  const after = (hitTimes.find((t) => t > event.t + EVENT_EDGE_MS) ?? Infinity) - event.t;
  const place = before < EVENT_NEAR_MS && after > stopMs * 0.8 ? "press" : after < EVENT_NEAR_MS && before > stopMs * 0.8 ? "end" : before >= EVENT_NEAR_MS && after >= EVENT_NEAR_MS ? "inside" : "unclear";
  return { place, before, after, stopMs };
}

/** castEventPlace as words: "logged at its stop's end (hits 1.76 s before, 0.02 s after; a 1.80 s stop)". */
export function eventPlaceText(p: NonNullable<ReturnType<typeof castEventPlace>>): string {
  const what = p.place === "press" ? "at its press" : p.place === "end" ? "at its stop's end" : p.place === "inside" ? "inside a hitless stretch" : "at no clear edge";
  const gap = (ms: number) => (Number.isFinite(ms) ? `${s(ms)} s` : "none");
  return `logged ${what} (hits ${gap(p.before)} before, ${gap(p.after)} after; a ${s(p.stopMs)} s stop)`;
}

/** One real cast of a skill as the log means it (loggedSkillInstances). Times in ms. */
export interface SkillInstance {
  readonly operator: string;
  readonly skillId: string;
  readonly kind: SkillType | null;
  /** The placed start (first landing less its frame), or for a cast event without hits the event's time. */
  readonly start: number;
  /** Its logged hits: first and last time and how many (0 for an event-only instance). */
  readonly firstHit: number | null;
  readonly lastHit: number | null;
  readonly hits: number;
  /** The event keys its hits are logged under. */
  readonly keys: readonly string[];
  /** The log's cast events of it (ms): none for a combo (never logged), several for an ultimate (repeated while it lasts). */
  readonly events: readonly number[];
  /** "hits": placed from its logged hits; "event": a cast event of a skill with no hit of it (a press that may have done nothing). */
  readonly from: "hits" | "event";
}

/** How long after a cast's last hit (or its skill's duration, whichever is later) the log's repeated cast event of it may come (ms). */
const EVENT_TAIL_MS = 500;
/** How far before a placed start the log's cast event of its skill may come (ms; logcasts.ts' held starts allow this much). */
const EVENT_LEAD_MS = 2500;

/**
 * Every real cast of a fight (or of one operator's), in time order: the placement's distinct casts of kit skills
 * (logcasts.ts distinctCasts: combos from their hits, a cast placed from several keys once) with their hits and the
 * log's cast events of them, then the cast events no placed cast of their skill accounts for (each with the repeats
 * that follow within the skill's duration). Triggers' hits (talents, weapons) aren't casts and aren't listed.
 */
export function loggedSkillInstances(data: GameData, fx: LogFixture, opts: { readonly operator?: string; readonly placement?: Placement } = {}): SkillInstance[] {
  const placement = opts.placement ?? placeHits(data, fx);
  const casts = distinctCasts(placement);
  const ofCast = (c: LoggedCast): LoggedCast | undefined => (casts.includes(c) ? c : casts.find((d) => d.operator === c.operator && d.skillId === c.skillId && Math.abs(d.start - c.start) <= mergeMs(placement, c.skillId)));
  const hitsOf = new Map<LoggedCast, LogHit[]>();
  for (const [h, p] of placement.hits) {
    const d = p.cast.kind === null ? undefined : ofCast(p.cast);
    if (d) hitsOf.set(d, [...(hitsOf.get(d) ?? []), h]);
  }
  const kitSkills = new Map(fx.team.map((b) => [b.operator, new Set((effectiveKit(data, b)?.skills ?? []).map((k) => k.skillId))]));
  const kits = new Map(fx.team.map((b) => [b.operator, effectiveKit(data, b)]));
  const kindOf = (op: string, skill: string) => kits.get(op)?.skills.find((k) => k.skillId === skill)?.kind ?? null;
  // Only an ultimate's event repeats while it lasts (docs/design/data.md "What the log records"); any other event is a press of its own.
  const repeatsFor = (skill: string, kind: SkillType | null) => (kind === "ultimate" ? msOf(data.skills[skill]?.timing?.durationFrames ?? 0) : 0);
  const placed = casts.map((c) => {
    const hs = (hitsOf.get(c) ?? []).sort((a, b) => a.t - b.t);
    return { c, hs, events: [] as number[] };
  });
  const loose: { t: number; operator: string; skill: string }[] = [];
  for (const lc of fx.casts ?? []) {
    const kit = kitSkills.get(lc.operator) ?? new Set<string>();
    const fits = placed.filter(({ c, hs }) => c.operator === lc.operator && castEventOf(lc.skill, c.skillId, kit) && lc.t >= c.start - EVENT_LEAD_MS && lc.t <= Math.max(hs.at(-1)?.t ?? c.start, c.start + repeatsFor(c.skillId, c.kind)) + EVENT_TAIL_MS);
    const best = fits.sort((a, b) => Math.abs(a.c.start - lc.t) - Math.abs(b.c.start - lc.t))[0];
    if (best) best.events.push(lc.t);
    else loose.push(lc);
  }
  const out: SkillInstance[] = placed.map(({ c, hs, events }) => ({
    operator: c.operator,
    skillId: c.skillId,
    kind: c.kind,
    start: c.start,
    firstHit: hs[0]?.t ?? null,
    lastHit: hs.at(-1)?.t ?? null,
    hits: hs.length,
    keys: [...new Set(hs.map((h) => h.event))],
    events: events.sort((a, b) => a - b),
    from: "hits" as const,
  }));
  // Cast events with no placed cast: one instance per event, its repeats within the skill's duration folded in.
  const open = new Map<string, { inst: SkillInstance & { events: number[] }; until: number }>();
  for (const lc of loose) {
    const key = `${lc.operator}|${lc.skill}`;
    const o = open.get(key);
    if (o && lc.t <= o.until) {
      o.inst.events.push(lc.t);
      continue;
    }
    const skill = [...(kitSkills.get(lc.operator) ?? [])].find((k) => castEventOf(lc.skill, k, kitSkills.get(lc.operator) ?? new Set())) ?? lc.skill;
    const inst = { operator: lc.operator, skillId: skill, kind: kindOf(lc.operator, skill), start: lc.t, firstHit: null, lastHit: null, hits: 0, keys: [], events: [lc.t], from: "event" as const };
    out.push(inst);
    open.set(key, { inst, until: lc.t + repeatsFor(skill, inst.kind) });
  }
  return out.filter((i) => !opts.operator || i.operator === opts.operator).sort((a, b) => a.start - b.start);
}

/** `zmdlogs instances`: a fight's skill instances, one line each. */
export function instancesView(data: GameData, fx: LogFixture, opts: { readonly operators?: readonly string[]; readonly kind?: string } = {}): string {
  const all = loggedSkillInstances(data, fx).filter((i) => (!opts.operators?.length || opts.operators.includes(i.operator)) && (!opts.kind || i.kind === opts.kind));
  const hitTimes = fx.hits.map((h) => h.t).sort((a, b) => a - b);
  const lines = all.map((i) => {
    const after = i.from === "event" && i.kind === "combo" ? all.filter((x) => x.operator === i.operator && x.kind === "combo" && x.from === "hits" && i.start - x.start > 0 && i.start - x.start < 9000).at(-1) : undefined;
    const hits = i.from === "event" ? `no hit of it (an event only: a press that may have done nothing${after ? `; ${s(i.start - after.start)} s after a real combo: an entity's end logged as a cast, as Arcane's Imprisonment` : ""})` : `${i.hits} hit(s) ${s(i.firstHit as number)}–${s(i.lastHit as number)}`;
    const ev = i.events.length > 3 ? `, cast event at ${s(i.events[0] as number)} and ${i.events.length - 1} more while it lasts (to ${s(i.events.at(-1) as number)})` : i.events.length ? `, cast event(s) at ${i.events.map(s).join(", ")}` : i.from === "hits" ? ", no cast event" : "";
    // The first event against the placed start in log time (the world time across the cast's own stop is about 0), and
    // where it sits in its stop (placement leads report point 1).
    const first = i.events[0];
    const lead = first !== undefined && i.from === "hits" ? ` (${first - i.start >= 0 ? "+" : ""}${s(first - i.start)} s of log time from the placed start)` : "";
    const place = first !== undefined ? castEventPlace(data, hitTimes, { t: first, skill: i.skillId }) : null;
    return `${s(i.start).padStart(7)}  ${operatorLabel(data, i.operator)} ${shortSkill(i.skillId)}${i.kind ? ` (${i.kind})` : ""}: ${hits}${ev}${lead}${place ? `; ${i.events.length > 1 ? "the first " : ""}${eventPlaceText(place)}` : ""}`;
  });
  return [`${fx.id}: ${all.length} skill instance(s), as the log means them (query.ts loggedSkillInstances: placed from hits, else a cast event alone); times in s; for a skill that stops the world, where its (first) cast event sits in the hitless stretch (castEventPlace: at its press, at its stop's end, inside, unclear)`, ...lines].join("\n");
}

/** One run of a listed game buff (buffLanes): one `source` and `since`, with the hits that list it. Times in ms. */
export interface BuffLane {
  readonly buff: string;
  readonly source: string | null;
  /** When the log says the lane started (LogEffect.since; null in imports before 2026-11-16). */
  readonly since: number | null;
  readonly firstListed: number;
  readonly lastListed: number;
  /** The first hit after the last listed one, by one of the hitters it was listed on, that doesn't list it (null: none). */
  readonly nextUnlisted: number | null;
  readonly listedHits: number;
  /** Listed at a hit's boundary only (LogHit.boundaryEffects: the log can't say whether it applied). */
  readonly boundaryOnly: boolean;
  readonly values: readonly number[];
  /** Whose hits list it. */
  readonly hitters: readonly string[];
}

/** Every run of the listed game buffs matching `buff` (all without one), in order of start. */
export function buffLanes(fx: LogFixture, buff?: RegExp): BuffLane[] {
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const lanes = new Map<string, { buff: string; source: string | null; since: number | null; hits: LogHit[]; inside: number; values: Set<number> }>();
  for (const h of hits) {
    const seen = new Set<string>();
    for (const [e, inside] of [...h.effects.map((x) => [x, true] as const), ...h.boundaryEffects.map((x) => [x, false] as const)] as [LogEffect, boolean][]) {
      if (buff && !buff.test(e.buff)) continue;
      const key = `${e.buff}|${e.source ?? ""}|${e.since ?? ""}`;
      const l = lanes.get(key) ?? { buff: e.buff, source: e.source ?? null, since: e.since ?? null, hits: [], inside: 0, values: new Set<number>() };
      if (!seen.has(key)) {
        l.hits.push(h);
        if (inside) l.inside++;
      }
      seen.add(key);
      l.values.add(+e.value.toFixed(6));
      lanes.set(key, l);
    }
  }
  return [...lanes.values()]
    .map((l) => {
      const last = l.hits.at(-1) as LogHit;
      const hitters = [...new Set(l.hits.map((h) => h.operator))];
      const lists = (h: LogHit) => [...h.effects, ...h.boundaryEffects].some((e) => e.buff === l.buff && (e.source ?? null) === l.source && (e.since ?? null) === l.since);
      const next = hits.find((h) => h.t > last.t && hitters.includes(h.operator) && !lists(h));
      return { buff: l.buff, source: l.source, since: l.since, firstListed: (l.hits[0] as LogHit).t, lastListed: last.t, nextUnlisted: next?.t ?? null, listedHits: l.hits.length, boundaryOnly: l.inside === 0, values: [...l.values].sort((a, b) => a - b), hitters };
    })
    .sort((a, b) => (a.since ?? a.firstListed) - (b.since ?? b.firstListed) || a.buff.localeCompare(b.buff));
}

/** The log's Stagger listing (each hit's, inside or at its boundary). */
export const STAGGER_LISTED = "buff_common_poise_break_damage_taken_scale";

/** How far apart (ms) two hits listing Stagger may be and still be one span (loggedStaggerSpans). */
export const STAGGER_SPAN_GAP_MS = 1500;

/**
 * The log's Stagger as spans of time (ms): the hits listing it (STAGGER_LISTED, as an effect or at their boundary),
 * first to last listed, merged where under STAGGER_SPAN_GAP_MS apart. The probes' and the views' one definition (the
 * enemy-clock report point 1: tickstag.ts, its probes and the replay's loggedStagger each rebuilt it); a hit inside a
 * span is in the log's Stagger, one between spans isn't (the replay's own steps are replaysteps.ts loggedStaggerSteps).
 */
export function loggedStaggerSpans(fx: Pick<LogFixture, "hits">): { readonly from: number; readonly to: number }[] {
  const ts = [...new Set(fx.hits.filter((h) => [...h.effects, ...h.boundaryEffects].some((e) => e.buff === STAGGER_LISTED)).map((h) => h.t))].sort((a, b) => a - b);
  const spans: { from: number; to: number }[] = [];
  for (const t of ts) {
    const last = spans.at(-1);
    if (last && t - last.to < STAGGER_SPAN_GAP_MS) last.to = t;
    else spans.push({ from: t, to: t });
  }
  return spans;
}

/** The log's moments (distinct hit times, ms), in order. */
export function logMoments(fx: Pick<LogFixture, "hits">): number[] {
  return [...new Set(fx.hits.map((h) => h.t))].sort((a, b) => a - b);
}

/** The gaps (ms) from a moment to the log's moments before and after it (null: none), and those moments: the log's batching grain there. */
export function momentSpacing(moments: readonly number[], t: number): { readonly before: number | null; readonly after: number | null; readonly prev: number | null; readonly next: number | null } {
  const prev = [...moments].reverse().find((m) => m < t) ?? null;
  const next = moments.find((m) => m > t) ?? null;
  return { before: prev === null ? null : t - prev, after: next === null ? null : next - t, prev, next };
}

/** The spacing as words: "moments −87 / +104 ms", "moments −103 ms / none (the fight's last)". */
export function spacingText(sp: ReturnType<typeof momentSpacing>): string {
  if (sp.after === null) return `moments ${sp.before === null ? "none" : `−${Math.round(sp.before)} ms`} / none (the fight's last)`;
  return `moments ${sp.before === null ? "none" : `−${Math.round(sp.before)}`} / +${Math.round(sp.after)} ms`;
}

/**
 * The log's cast events from the moment before `t` to the one after it (ms): within the log's grain of an end at `t`,
 * so the log doesn't order them against it (arcane-doubles-end report point 3: e82d's last inside listing 87 ms after
 * the second touch, the boundary 191 ms after).
 */
export function castsWithinGrain(fx: Pick<LogFixture, "casts">, sp: ReturnType<typeof momentSpacing>, t: number): LogCast[] {
  return (fx.casts ?? []).filter((c) => c.t >= (sp.prev ?? t) && c.t <= (sp.next ?? t));
}

/**
 * `zmdlogs lanes`: a fight's runs of the listed buffs matching `buff`; beside each end the log's moment spacing there
 * and the cast events within it (round 16); with `world`, each run's length in world time too.
 */
export function lanesView(data: GameData, fx: LogFixture, buff?: RegExp, opts: { readonly world?: boolean } = {}): string {
  const lanes = buffLanes(fx, buff);
  const stops = opts.world ? replayTimeStops(data, fx) : [];
  const moments = logMoments(fx);
  const lines = lanes.map((l) => {
    const sp = momentSpacing(moments, l.lastListed);
    const within = castsWithinGrain(fx, sp, l.lastListed).map((c) => `${operatorLabel(data, c.operator)} ${shortSkill(c.skill)} ${s(c.t)}`);
    const grain = `; at its last listing ${spacingText(sp)}${within.length ? `, cast event(s) within: ${within.join(", ")} (no order against the end)` : ""}`;
    const end = l.nextUnlisted === null ? "listed to the fight's end" : `next unlisted hit ${s(l.nextUnlisted)}${grain}`;
    const from = l.since ?? l.firstListed;
    const world = opts.world
      ? `; world time from ${l.since === null ? "the first listed hit" : "since"}: to the last listed ${s(worldMs(from, l.lastListed, stops))} s (real ${s(l.lastListed - from)})${l.nextUnlisted === null ? "" : `, to the next unlisted ${s(worldMs(from, l.nextUnlisted, stops))} s (real ${s(l.nextUnlisted - from)})`}`
      : "";
    return `  ${l.buff} from ${l.source ? operatorLabel(data, l.source) : "?"}: since ${l.since === null ? "?" : s(l.since)}, listed ${s(l.firstListed)}–${s(l.lastListed)} on ${l.listedHits} hit(s)${l.boundaryOnly ? " (boundary only)" : ""} of ${l.hitters.map((h) => operatorLabel(data, h)).join(", ")}, ${end}; value(s) ${l.values.join(", ")}${world}`;
  });
  const note = opts.world ? "; world time takes the time stops of the replay's casts out (replayTimeStops ; worldMs; the log's ms are batched, so under ~0.2 s isn't evidence)" : "";
  return [`${fx.id}: ${lanes.length} run(s) of listed buffs${buff ? ` matching /${buff.source}/` : ""} (one per source and since; times in s; since is the lane's start as the log has it: a refresh may move it${note})`, ...lines].join("\n");
}

/**
 * `zmdlogs worldtime`: the world's time between two moments of a log (ms), under the time stops of the casts the
 * replay makes (replayTimeStops, worldMs), and the stops between with their frames and lowest scale. The first number of every "lasts
 * longer than its duration" question (round 5: three agents wrote it as a scratch script).
 */
export function worldTimeView(data: GameData, fx: LogFixture, from: number, to: number, replay?: Pick<BuffReplay, "made">, placement: Placement = placeHits(data, fx)): string {
  if (!(to > from)) throw new Error("zmdlogs worldtime takes <from s> <to s> with to after from");
  // With the replay (the CLI's), the hold placement's own list: an event the replay read as a buff's tick holds nothing
  // and gets a line without frames (round 15, bursts-and-cooldowns report point 1).
  const { stops, ticks } = replayTimeStopsWithTicks(data, fx, placement, replay);
  const [a, b] = [Math.round((from * FPS) / 1000), Math.round((to * FPS) / 1000)];
  const between = stops.filter((st) => st.start < b && st.start + st.scales.length > a).sort((x, y) => x.start - y.start);
  const ticked = ticks.filter((c) => c.start >= from && c.start <= to);
  const world = worldMs(from, to, stops);
  return [
    `${fx.id}: ${s(from)}–${s(to)} s: real ${s(to - from)} s, world ${s(world)} s (held ${s(to - from - world)} s by ${between.length} time stop(s) of the replay's casts; times in s, a stop's frames at 30 a second)`,
    ...[
      ...between.map((st) => {
        const inside = Math.min(b, st.start + st.scales.length) - Math.max(a, st.start);
        return { t: msOf(st.start), text: `  ${s(msOf(st.start)).padStart(7)}  ${operatorLabel(data, st.operator)} ${shortSkill(st.skillId)}${st.kind ? ` (${st.kind})` : ""}: ${st.scales.length} frame(s), lowest scale ${Math.min(...st.scales)}, ${inside} frame(s) inside the window${notPlaced(st)}${tickReadNote(st)}` };
      }),
      ...ticked.map((c) => ({ t: c.start, text: `  ${s(c.start).padStart(7)}  ${operatorLabel(data, c.operator)} ${shortSkill(c.skillId)}${c.kind ? ` (${c.kind})` : ""}: no stop (a hitless event of a skill a kit buff ticks as, which the replay read as the buff's tick and didn't make; the hold placement leaves it out too)` })),
    ].sort((x, y) => x.t - y.t).map((x) => x.text),
    "Overlapping stops count once per frame, at the lowest scale then; the log's ms are batched (docs/design/data.md \"What the log records\"), so a difference under ~0.2 s isn't timing evidence.",
  ].join("\n");
}

/** What a listed game buff stands for (listedGameBuffs). */
export interface ListedBuff {
  readonly buff: string;
  readonly hits: number;
  readonly lanes: number;
  readonly sources: readonly string[];
  readonly hitters: readonly string[];
  readonly values: readonly number[];
  /** The team's kit buffs a log's entries under it stand for (`owner:id` and label: KitBuff.gameBuff, loggedAs, their affixes). */
  readonly kitBuffs: readonly { readonly key: string; readonly label: string }[];
  /** One of the engine's own statuses (reactions, physical statuses, Stagger, Link): ENGINE_STATUS_BUFF. */
  readonly engineStatus: boolean;
}

/** Every game buff a fight's hits list (effects and boundary effects), with what it stands for in the team's kits. */
export function listedGameBuffs(data: GameData, fx: LogFixture, buff?: RegExp): ListedBuff[] {
  const names = teamBuffNames(data, fx);
  const lanes = buffLanes(fx, buff);
  const by = new Map<string, BuffLane[]>();
  for (const l of lanes) by.set(l.buff, [...(by.get(l.buff) ?? []), l]);
  return [...by]
    .map(([b, ls]) => ({
      buff: b,
      hits: ls.reduce((n, l) => n + l.listedHits, 0),
      lanes: ls.length,
      sources: [...new Set(ls.flatMap((l) => (l.source ? [l.source] : [])))],
      hitters: [...new Set(ls.flatMap((l) => l.hitters))],
      values: [...new Set(ls.flatMap((l) => l.values))].sort((x, y) => x - y),
      kitBuffs: (names.byGameBuff.get(b) ?? []).map((key) => ({ key, label: names.defs.get(key)?.label ?? "" })),
      engineStatus: ENGINE_STATUS_BUFF.test(b),
    }))
    .sort((a, b) => b.hits - a.hits || a.buff.localeCompare(b.buff));
}

/** `zmdlogs buffs`: per listed game buff over some logs, what it stands for and whose hits list it. */
export function buffsView(data: GameData, logs: readonly DevFixture[], opts: { readonly buff?: RegExp; readonly operators?: readonly string[] } = {}): string {
  const rows = new Map<string, { hits: number; logs: Set<string>; lanes: number; sources: Set<string>; hitters: Set<string>; values: Set<number>; kit: Map<string, string>; status: boolean }>();
  for (const d of logs) {
    for (const b of listedGameBuffs(data, d.fx, opts.buff)) {
      if (opts.operators?.length && !b.sources.some((x) => opts.operators?.includes(x)) && !b.kitBuffs.some((k) => opts.operators?.includes(k.key.split(":")[0] as string))) continue;
      const r = rows.get(b.buff) ?? { hits: 0, logs: new Set<string>(), lanes: 0, sources: new Set<string>(), hitters: new Set<string>(), values: new Set<number>(), kit: new Map<string, string>(), status: b.engineStatus };
      r.hits += b.hits;
      r.logs.add(d.short);
      r.lanes += b.lanes;
      for (const x of b.sources) r.sources.add(x);
      for (const x of b.hitters) r.hitters.add(x);
      for (const x of b.values) r.values.add(x);
      for (const k of b.kitBuffs) r.kit.set(k.key, k.label);
      rows.set(b.buff, r);
    }
  }
  const name = (op: string) => operatorLabel(data, op);
  const lines = [...rows].sort((a, b) => b[1].hits - a[1].hits).map(([b, r]) => {
    const what = r.kit.size ? [...r.kit].map(([k, l]) => `${k}${l ? ` "${l}"` : ""}`).join("; ") : r.status ? "an engine status (reaction, physical status, Stagger or Link)" : "no kit buff (the log check adds its entries as listed)";
    const onlySource = r.sources.size > 0 && [...r.hitters].every((h) => r.sources.has(h)) ? " (only on its source's own hits)" : "";
    const vals = [...r.values].sort((x, y) => x - y);
    return `  ${b}\n      = ${what}\n      ${r.hits} listed hit(s) in ${r.logs.size} log(s), ${r.lanes} run(s); from ${[...r.sources].map(name).join(", ") || "?"}; on hits of ${[...r.hitters].map(name).join(", ")}${onlySource}; value(s) ${vals.slice(0, 6).join(", ")}${vals.length > 6 ? ", …" : ""}`;
  });
  return [`${rows.size} listed game buff(s) over ${logs.length} log(s)${opts.buff ? ` matching /${opts.buff.source}/` : ""}, each with the team kit buffs it stands for (enginecheck.ts teamBuffNames: KitBuff.gameBuff, loggedAs and their affixes)`, ...lines].join("\n");
}

/** A census selector: casts of a skill, hits of an event key (grouped: a gap over GROUP_GAP_MS starts a new group), or runs of a listed buff. */
export interface Selector {
  /** origin: hit groups (as event's) of hits whose poise.origin matches (round 6: Si's bursts by the skill they're credited to). */
  readonly what: "cast" | "event" | "buff" | "origin";
  readonly re: RegExp;
}
/** A gap between two hits of one key that starts a new group (ms). */
export const GROUP_GAP_MS = 1000;

/** `cast:<regex>`, `event:<regex>` or `buff:<regex>` as a Selector. */
export function parseSelector(text: string): Selector {
  const m = /^(cast|event|buff|origin):(.+)$/.exec(text);
  if (!m) throw new Error(`${text}: a selector is cast:<regex> (skill instances), event:<regex> (hit groups of a logged event key), buff:<regex> (runs of a listed buff) or origin:<regex> (hit groups whose Stagger is credited to a matching skill: LogHit.poise.origin)`);
  return { what: m[1] as Selector["what"], re: new RegExp(m[2] as string) };
}

/** One item a selector picks in a fight: its time (ms), operator and a label. */
export interface Item {
  readonly t: number;
  readonly operator: string;
  readonly label: string;
}

/** The items a selector picks in a fight (`operators`: only theirs). */
export function selectItems(data: GameData, fx: LogFixture, sel: Selector, operators: readonly string[] = [], cache: { instances?: SkillInstance[] } = {}): Item[] {
  const mine = (op: string) => !operators.length || operators.includes(op);
  if (sel.what === "cast") {
    cache.instances ??= loggedSkillInstances(data, fx);
    return cache.instances.filter((i) => mine(i.operator) && sel.re.test(i.skillId)).map((i) => ({ t: i.start, operator: i.operator, label: `${shortSkill(i.skillId)}${i.from === "event" ? " (event only)" : ""}` }));
  }
  if (sel.what === "buff") return buffLanes(fx, sel.re).filter((l) => mine(l.source ?? "")).map((l) => ({ t: l.since ?? l.firstListed, operator: l.source ?? "", label: l.buff }));
  const out: Item[] = [];
  const last = new Map<string, number>();
  for (const h of [...fx.hits].sort((a, b) => a.t - b.t)) {
    const origin = h.poise?.origin;
    if (!mine(h.operator) || !(sel.what === "origin" ? origin !== undefined && sel.re.test(origin) : sel.re.test(h.event))) continue;
    const key = `${h.operator}|${h.event}|${sel.what === "origin" ? origin : ""}`;
    const prev = last.get(key);
    last.set(key, h.t);
    if (prev !== undefined && h.t - prev <= GROUP_GAP_MS) continue;
    out.push({ t: h.t, operator: h.operator, label: sel.what === "origin" ? `${shortSkill(h.event)} (origin ${shortSkill(origin as string)})` : shortSkill(h.event) });
  }
  return out;
}

export interface CensusOptions {
  readonly select: Selector;
  readonly operators?: readonly string[];
  readonly near?: Selector;
  readonly nearOperators?: readonly string[];
  /** The window around each item a near item counts in (ms): `from` to `to` relative to the item (e.g. −1000 to 1000, or 0 to 700). */
  readonly window?: { readonly from: number; readonly to: number };
  readonly list?: boolean;
  /** The command line that reruns it (printed in the header). */
  readonly rerun: string;
  /** How the logs were chosen, for the header ("every verified and pending development log", or the ids). */
  readonly logs: string;
}

/**
 * `zmdlogs census`: per log, how many items the selection picks, and with `near`, how many have an item of the near
 * selection inside the window around them, with the quartiles of the nearest one's offset; the header records the
 * selection and the command that reruns it.
 */
export function census(data: GameData, fixtures: readonly DevFixture[], o: CensusOptions): string {
  const w = o.window ?? { from: -1000, to: 1000 };
  const out = [
    `census: ${o.select.what}:/${o.select.re.source}/${o.operators?.length ? ` of ${o.operators.map((x) => operatorLabel(data, x)).join(", ")}` : ""}` +
      (o.near ? `; near: ${o.near.what}:/${o.near.re.source}/${o.nearOperators?.length ? ` of ${o.nearOperators.map((x) => operatorLabel(data, x)).join(", ")}` : ""} from ${w.from} to ${w.to} ms around each` : "") +
      `; over ${fixtures.length} log(s): ${o.logs}`,
    `rerun: ${o.rerun}`,
  ];
  let [total, withNear] = [0, 0];
  const offsets: number[] = [];
  for (const d of fixtures) {
    const cache: { instances?: SkillInstance[] } = {};
    const items = selectItems(data, d.fx, o.select, o.operators, cache);
    if (!items.length) continue;
    const near = o.near ? selectItems(data, d.fx, o.near, o.nearOperators, cache) : [];
    let n = 0;
    const rows: string[] = [];
    for (const it of items) {
      const found = near.filter((x) => x !== it && x.t - it.t >= w.from && x.t - it.t <= w.to).sort((a, b) => Math.abs(a.t - it.t) - Math.abs(b.t - it.t))[0];
      if (found) {
        n++;
        offsets.push(found.t - it.t);
      }
      if (o.list) rows.push(`    ${s(it.t).padStart(7)} ${operatorLabel(data, it.operator)} ${it.label}${o.near ? (found ? `  near: ${operatorLabel(data, found.operator)} ${found.label} at ${found.t - it.t >= 0 ? "+" : ""}${Math.round(found.t - it.t)} ms` : "  near: none") : ""}`);
    }
    total += items.length;
    withNear += n;
    out.push(`  ${d.short} ${String(items.length).padStart(4)} item(s)${o.near ? `, ${n} with a near item` : ""}`, ...rows);
  }
  const q = (p: number) => {
    const v = [...offsets].sort((a, b) => a - b);
    return Math.round(v[Math.floor(p * (v.length - 1))] as number);
  };
  out.push(`total: ${total} item(s)${o.near ? `, ${withNear} with a near item${offsets.length ? ` (its offset in ms, quartiles ${q(0.25)} ${q(0.5)} ${q(0.75)}, min ${q(0)}, max ${q(1)})` : ""}` : ""}`);
  return out.join("\n");
}

/** Who the log shows controlled when (controlSpans), ms: from, to (null: the fight's end), and the hit that shows it. */
export interface ControlSpan {
  readonly operator: string;
  readonly from: number;
  readonly to: number | null;
  /** The logged basic hit with Stagger (controlled-only) that names the operator, and its event key. */
  readonly evidence: { readonly t: number; readonly event: string } | null;
}

/**
 * The control spans of a fight as the replay reads them (castassembly.ts controlledFromLog: a basic hit with Stagger is
 * the controlled operator's; a swap is at the start of the run of basic casts that ends with the next such hit of
 * another operator). Empty when no hit names anyone.
 */
export function controlSpans(data: GameData, fx: LogFixture, placement: Placement = placeHits(data, fx)): ControlSpan[] {
  const kits = fx.team.flatMap((b) => {
    const k = effectiveKit(data, b);
    return k ? [k] : [];
  });
  const c = controlSwaps(placement, assembleCasts(data, fx, placement, kits));
  if (!c) return [];
  const points = [{ at: -Infinity, operator: c.first, evidence: c.firstEvidence }, ...c.swaps];
  return points.map((p, i) => ({ operator: p.operator, from: Number.isFinite(p.at) ? p.at : 0, to: points[i + 1]?.at ?? null, evidence: p.evidence }));
}

/** `zmdlogs control`: the control spans, and every skill instance with the operator controlled at its start. */
export function controlView(data: GameData, fx: LogFixture, opts: { readonly operators?: readonly string[] } = {}): string {
  const placement = placeHits(data, fx);
  const spans = controlSpans(data, fx, placement);
  const at = (t: number) => spans.find((x) => x.from <= t && (x.to === null || t < x.to))?.operator;
  const lines: { t: number; text: string }[] = spans.map((x) => ({ t: x.from, text: `CONTROL ${operatorLabel(data, x.operator)} ${s(x.from)}–${x.to === null ? "end" : s(x.to)}${x.evidence ? ` (shown by ${shortSkill(x.evidence.event)} with Stagger at ${s(x.evidence.t)})` : ""}` }));
  for (const i of loggedSkillInstances(data, fx, { placement })) {
    if (opts.operators?.length && !opts.operators.includes(i.operator)) continue;
    const who = at(i.start);
    const how = i.from === "event" ? "a cast event alone" : i.events.length ? "logged event and hits" : "inferred from its hits (no cast event)";
    lines.push({ t: i.start, text: `  CAST  ${operatorLabel(data, i.operator)} ${shortSkill(i.skillId)}${i.kind ? ` (${i.kind})` : ""}: ${how}; controlled then: ${who ? operatorLabel(data, who) : "?"}${who && who !== i.operator && i.kind === "basic" ? " (a teammate's own attack)" : ""}` });
  }
  const head = spans.length
    ? `${fx.id}: who the log shows controlled (a basic hit with Stagger is the controlled operator's: castassembly.ts controlledFromLog), and every cast (times in s)`
    : `${fx.id}: no basic hit with Stagger names the controlled operator (the replay takes each basic cast's operator as controlled)`;
  return [head, ...lines.sort((a, b) => a.t - b.t).map((l) => `${s(l.t).padStart(7)}  ${l.text}`)].join("\n");
}

/**
 * `zmdlogs cadence`: an operator's hit groups of event keys matching `key` (a gap over GROUP_GAP_MS starts one) in each
 * log, each with its hit count, the world-time gap from the previous group (the time stops of the replay's casts taken
 * out: replayTimeStops, logcasts.ts worldMs), the stops between by operator and skill, and the operator's nearest cast event; then the gaps'
 * spread over all logs (is it a timer, a cooldown or event-driven?).
 */
export function cadenceView(data: GameData, logs: readonly DevFixture[], operator: string, key: RegExp): string {
  const gaps: number[] = [];
  const out = [`cadence of ${operatorLabel(data, operator)}'s hits matching /${key.source}/ (a gap over ${GROUP_GAP_MS} ms starts a group); world-time gaps take the time stops of the replay's casts out (replayTimeStops; times in s)`];
  for (const d of logs) {
    const fx = d.fx;
    const groups: { t: number; last: number; n: number; value: number }[] = [];
    for (const h of [...fx.hits].sort((a, b) => a.t - b.t)) {
      if (h.operator !== operator || !key.test(h.event)) continue;
      const g = groups.at(-1);
      if (g && h.t - g.last <= GROUP_GAP_MS) {
        g.last = h.t;
        g.n++;
        g.value += h.value;
      } else groups.push({ t: h.t, last: h.t, n: 1, value: h.value });
    }
    if (!groups.length) continue;
    const stops = replayTimeStops(data, fx);
    out.push(`  ${d.short}: ${groups.length} group(s)`);
    for (const [i, g] of groups.entries()) {
      const prev = groups[i - 1];
      const world = prev ? worldMs(prev.t, g.t, stops) : null;
      if (world !== null) gaps.push(world);
      const between = prev ? stops.filter((st) => msOf(st.start) < g.t && msOf(st.start + st.scales.length) > prev.t).map((st) => `${operatorLabel(data, st.operator)} ${shortSkill(st.skillId)}`) : [];
      const ev = (fx.casts ?? []).filter((c) => c.operator === operator).sort((a, b) => Math.abs(a.t - g.t) - Math.abs(b.t - g.t))[0];
      out.push(
        `    ${s(g.t).padStart(7)}  ${g.n} hit(s), ${g.value}` +
          (prev ? `; ${s(g.t - prev.t)} s after the last (world ${s(world as number)} s)${between.length ? `, stops between: ${[...new Set(between)].map((b) => { const n = between.filter((x) => x === b).length; return n > 1 ? `${b} ×${n}` : b; }).join(", ")}` : ""}` : "") +
          (ev ? `; nearest cast event ${shortSkill(ev.skill)} at ${ev.t - g.t >= 0 ? "+" : ""}${Math.round(ev.t - g.t)} ms` : ""),
      );
    }
  }
  const v = [...gaps].sort((a, b) => a - b);
  const q = (p: number) => s(v[Math.floor(p * (v.length - 1))] as number);
  out.push(v.length ? `world-time gaps: ${v.length}; min ${q(0)}, quartiles ${q(0.25)} ${q(0.5)} ${q(0.75)}, max ${q(1)} s` : "no two groups in one log");
  return out.join("\n");
}
