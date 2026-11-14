// The buff timing report (`efsim zmdlogs timing`): a diagnostic, never scored (docs/design.md, "The buff timing
// report"; docs/accuracy-plan.md, "Fits need a mechanism"). The log check toggles a kit buff only where its replayed
// instances change within REPLAY_EDGE_MS of a hit; a timing error of seconds (a time stop, a missing trigger, the
// wrong teammate) shows up as a fallback or a mismatch instead. For each such hit this tries every kit buff of the
// battle on (as the log lists it, as the engine values it at another landing, or as the kit values it) and off, on
// the hit's engine reading alone (the damage formula again with other modifiers, not the fight), says how far the hit
// is from where the engine starts or ends that buff, gathers fits of the same buff, direction and edge into patterns,
// and lists what happens near each pattern (casts, time stops, reactions, Stagger) beside the kit's triggers that
// create or end the buff. A fit is a hint, not a fix: a change needs a mechanism.

import { allActions, effectiveKit, FPS, kitBuffModifiers, landingDamage, parseReactionEvent, readingDoesNotApply, roundDamage, STATUS_EVENTS, type GameData, type KitBuff, type KitTrigger, type Modifier, type OperatorKit } from "@efsim/engine";
import type { LogFixture, LogHit } from "@efsim/data";
import { engineCheck, loggedEntries, readingBasis, type Alternative, type EngineCheck, type Reading, type ReadingBasis } from "./enginecheck.ts";
import { checkLog, engineHits, hitPlace, logBuffReplay, verdictCount, type HitVerdict, type VerdictCount } from "./logcheck.ts";
import { castTimeStops, placeHits, type Placement } from "./logcasts.ts";
import { loggedRecoveries, type BuffReplay, type KitWindow } from "./buffreplay.ts";
import { teamPanels } from "./logeffects.ts";

/** For a buff the engine misses or starts late, casts that would apply it are looked for this far before the window too (ms). */
const LOOKBACK_MS = 20000;
/** Within this of an edge of the engine's instances (ms), a fit is placed against that edge; farther, it is "missing" or "extra". */
export const TIMING_EDGE_MS = 5000;
/** Fits of one buff and direction without an edge (missing, extra, inactive, values) are one pattern while consecutive ones are this close (ms). */
const CLUSTER_MS = 3000;
/** Base readings (the check's other alternatives, crit included) tried under each toggle at most; past it, the plain reading and the crit's. */
const MAX_BASES = 16;
/** Pairs are tried from at most this many toggles of a hit, the nearest to an edge (each within TIMING_EDGE_MS). */
const MAX_PAIR_TOGGLES = 16;
/** Engine valuations of one kit buff tried at most (distinct modifier sets at other landings, the nearest first). */
const MAX_ENGINE_VALUES = 3;
/** Kit valuations (layers) tried at most where the replay never values a buff. */
const MAX_KIT_LAYERS = 5;
/** A fit is within the check's ±1; below this logged value, ±1 is coarser than 0.05% (a chance fit is likelier). */
const COARSE_VALUE = 2000;

/** Where a toggle puts the buff against the engine's instances of it at the hit's operator. */
export type TimingDirection =
  /** The damage wants it after the engine's end: the engine ends it early. */
  | "endsLater"
  /** The damage wants it gone before the engine's end: the engine ends it late. */
  | "endsEarlier"
  /** The damage wants it before the engine's start: the engine starts it late. */
  | "startsEarlier"
  /** The damage wants it not yet at the engine's start: the engine starts it early. */
  | "startsLater"
  /** The damage wants it, and the engine has no instance within TIMING_EDGE_MS. */
  | "missing"
  /** The damage wants it absent, and the engine's instance runs on more than TIMING_EDGE_MS either side. */
  | "extra"
  /** The engine has an instance at the hit's operator, but none of its modifiers act on the hit. */
  | "inactive"
  /** The engine has it, with other values (or layers) than fit. */
  | "values"
  /** The damage wants it absent, and no instance reaches the hit's operator: a snapshot or a cast carries the engine's modifiers. */
  | "carried";

const DIRECTION_TEXT: Record<TimingDirection, string> = {
  endsLater: "engine ends it early",
  endsEarlier: "engine ends it late",
  startsEarlier: "engine starts it late",
  startsLater: "engine starts it early",
  missing: "never present in the engine there",
  extra: "engine has it, damage says absent",
  inactive: "engine's instance doesn't act on the hit",
  values: "engine has other values or layers",
  carried: "engine carries it (snapshot or cast), damage says absent",
};

/** One change to a hit's engine reading: a kit buff off, or on (or at other layers) with some values. */
export interface TimingToggle {
  /** `owner:id`. */
  readonly kitBuff: string;
  /** off; as the log lists it at the hit; as the replay values it at another landing (`at`, ms); as the kit values it (`layers`). */
  readonly how: "off" | "log" | "engine" | "kit";
  readonly at?: number;
  readonly layers?: number;
  /** Its modifiers in the reading before and after. */
  readonly before: number;
  readonly after: number;
}

/** A toggle placed against the engine's instances (TimingDirection), with its distance from the edge. */
export interface PlacedToggle extends TimingToggle {
  readonly direction: TimingDirection;
  /** How far the hit is from the edge (ms); null without one. */
  readonly offsetMs: number | null;
  /** The engine's edge (start or end, ms); null without one. */
  readonly edgeMs: number | null;
  readonly label: string;
}

/** A reading that fits the logged hit (±1) with one or two toggles, and the check's alternatives it takes besides (crit, Link…). */
export interface TimingFit {
  readonly toggles: readonly PlacedToggle[];
  readonly predicted: number;
  readonly base: readonly string[];
}

/** What the report found for one logged hit. */
export interface HitTiming {
  readonly index: number;
  readonly hit: LogHit;
  readonly verdict: VerdictCount;
  /** The engine's primary reading (null: none applies). */
  readonly primary: number | null;
  /** Single toggles that fit, the smallest explanation first (nearest an edge; missing / extra last). */
  readonly fits: readonly TimingFit[];
  /** Pairs that fit, for a hit no single toggle fits. */
  readonly pairs: readonly TimingFit[];
  /** Readings tried. */
  readonly tried: number;
  /** |logged − primary| (the logged value when no reading applies). */
  readonly stake: number;
}

/** A run of hits in one log that fit one buff the same way: one edge, or (without one) consecutive within CLUSTER_MS. */
export interface TimingPattern {
  readonly fixture: string;
  readonly kitBuff: string;
  readonly direction: TimingDirection;
  readonly edgeMs: number | null;
  readonly hits: readonly HitTiming[];
  /** Each hit's fit for this pattern (the same order as hits). */
  readonly fits: readonly PlacedToggle[];
  readonly stake: number;
  /** Plain matches in the pattern's span at its operators whose damage the same change would break. */
  readonly against: number;
  /** Other buffs a single toggle of which fits some of these hits too: buff → hits. */
  readonly alsoFits: ReadonlyMap<string, number>;
  /** Hits whose ±1 is coarser than 0.05% (COARSE_VALUE). */
  readonly coarse: number;
  /** Hits whose log lists the buff inside them. */
  readonly listed: number;
  readonly mechanism: Mechanism;
}

/** What happens near a pattern, and the kit's ways to create or end its buff. */
export interface Mechanism {
  /** The window looked in (ms). */
  readonly window: readonly [number, number];
  /** The kit's sources of the buff (triggers, skill hits, its duration and game buff), each as text. */
  readonly kit: readonly string[];
  /** Kit sources an event in the window matches, each with the event. */
  readonly matched: readonly string[];
  readonly casts: readonly string[];
  readonly stops: readonly string[];
  readonly reactions: readonly string[];
  readonly staggers: readonly string[];
}

/** One log's report. */
export interface FixtureTiming {
  readonly fixture: string;
  readonly verdicts: readonly HitVerdict[];
  readonly hits: readonly HitTiming[];
  readonly patterns: readonly TimingPattern[];
}

export interface TimingOptions {
  /** Assumed matches too (their primary reading with a toggle; default: fallback and mismatch only). */
  readonly assumed?: boolean;
  /** Pairs for hits no single toggle fits (default true). */
  readonly pairs?: boolean;
}

const ms = (f: number) => (f * 1000) / FPS;
const fits = (p: number, actual: number) => Math.abs(p - actual) <= 1;
const sig = (mods: readonly Modifier[]) =>
  mods.map((m) => `${m.zone}|${m.element ?? ""}|${m.skillType ?? ""}|${m.attr ?? ""}|${m.percent ? "%" : ""}|${+m.value.toFixed(6)}`).sort().join(";");
const ofBuff = (k: string) => {
  const [owner, id] = k.split(":", 2) as [string, string];
  return (m: Modifier) => m.kitBuff?.owner === owner && m.kitBuff.id === id;
};

/** Per kit buff (`owner:id`), its modifiers at each replay landing that has them (the engine's valuations). */
function engineValuations(replay: BuffReplay): Map<string, { t: number; operator: string; mods: Modifier[] }[]> {
  const out = new Map<string, { t: number; operator: string; mods: Modifier[] }[]>();
  for (const h of replay.hits) {
    const by = new Map<string, Modifier[]>();
    for (const m of h.inputs?.options.modifiers ?? []) {
      if (!m.kitBuff) continue;
      const k = `${m.kitBuff.owner}:${m.kitBuff.id}`;
      by.set(k, [...(by.get(k) ?? []), m]);
    }
    for (const [k, mods] of by) out.set(k, [...(out.get(k) ?? []), { t: ms(h.frame), operator: h.operator, mods }]);
  }
  return out;
}

/** The toggles of every kit buff the replay judges at one hit, each with how it changes the reading. */
function togglesAt(c: EngineCheck, b: ReadingBasis, hit: LogHit, valuations: ReturnType<typeof engineValuations>, panels: ReturnType<typeof teamPanels>["panels"]): { toggle: TimingToggle; apply: (o: Reading) => Reading }[] {
  const out: { toggle: TimingToggle; apply: (o: Reading) => Reading }[] = [];
  for (const k of c.names.defs.keys()) {
    if (c.replay.unjudgedKitBuffs.has(k)) continue;
    // A buff on its owner alone never reaches a teammate's hit (its values read its owner's skills).
    if (c.names.defs.get(k)?.target === "self" && !k.startsWith(`${hit.operator}:`)) continue;
    const ofIt = ofBuff(k);
    const mine = b.judged.filter(ofIt);
    const others = b.judged.filter((m) => !ofIt(m));
    const seen = new Set([sig(mine)]);
    const replace = (mods: readonly Modifier[]) => (o: Reading): Reading => ({ ...o, options: { ...o.options, modifiers: [...(o.options.modifiers ?? []).filter((m) => !ofIt(m)), ...mods] } });
    const push = (how: TimingToggle["how"], mods: readonly Modifier[], extra: Partial<TimingToggle> = {}) => {
      const s = sig(mods);
      if (seen.has(s)) return;
      seen.add(s);
      out.push({ toggle: { kitBuff: k, how, before: mine.length, after: mods.length, ...extra }, apply: replace(mods) });
    };
    if (mine.length) push("off", []);
    // As the log lists it at the hit (inside it, else at its boundary).
    const names = new Set(c.names.ofKitBuff.get(k) ?? []);
    const inside = hit.effects.filter((e) => names.has(e.buff));
    const listed = inside.length ? inside : hit.boundaryEffects.filter((e) => names.has(e.buff));
    if (listed.length) push("log", loggedEntries(c, listed, names, others, b.category));
    // As the replay values it at other landings (the nearest first, the hitter's own first at equal distance).
    const vals = [...(valuations.get(k) ?? [])].sort((x, y) => Math.abs(x.t - hit.t) - Math.abs(y.t - hit.t) || Number(y.operator === hit.operator) - Number(x.operator === hit.operator));
    let taken = 0;
    for (const v of vals) {
      if (taken >= MAX_ENGINE_VALUES) break;
      const before = seen.size;
      push("engine", v.mods, { at: Math.round(v.t) });
      if (seen.size > before) taken++;
    }
    // As the kit values it, where the replay never does.
    if (vals.length === 0) {
      const [owner, id] = k.split(":", 2) as [string, string];
      const member = panels.get(owner);
      let prev = "";
      for (let n = 1; member && n <= MAX_KIT_LAYERS; n++) {
        let mods: Modifier[];
        try {
          mods = kitBuffModifiers(c.data, member.build, member.panel, id, n);
        } catch {
          break; // its values need a fight, or nothing in the kit applies it
        }
        const s = sig(mods);
        if (!mods.length || s === prev) break;
        prev = s;
        push("kit", mods, { layers: n });
      }
    }
  }
  return out;
}

/** Where a toggle at a hit sits against the engine's instances of its buff at the hit's operator. */
export function placeToggle(windows: readonly KitWindow[], t: number, toggle: TimingToggle, name: string): PlacedToggle {
  const s = (x: number) => (x / 1000).toFixed(1);
  const adds = toggle.after > toggle.before;
  const removes = toggle.after < toggle.before;
  const layer = toggle.before > 0 && toggle.after > 0 ? (adds ? " (more layers)" : removes ? " (fewer layers)" : "") : "";
  const containing = windows.filter((w) => w.start <= t && t < w.end);
  const placed = (direction: TimingDirection, offsetMs: number | null, edgeMs: number | null, label: string): PlacedToggle => ({ ...toggle, direction, offsetMs, edgeMs, label: `${name}: ${label}${layer}` });
  if (adds) {
    if (toggle.before === 0 && containing.length) return placed("inactive", null, null, "the engine has an instance here, but its modifiers don't act on the hit");
    const ends = windows.filter((w) => w.end <= t && Number.isFinite(w.end));
    const starts = windows.filter((w) => w.start > t);
    const end = ends.length ? Math.max(...ends.map((w) => w.end)) : null;
    const start = starts.length ? Math.min(...starts.map((w) => w.start)) : null;
    const dEnd = end === null ? Infinity : t - end;
    const dStart = start === null ? Infinity : start - t;
    if (Math.min(dEnd, dStart) > TIMING_EDGE_MS) {
      const near = Math.min(dEnd, dStart);
      return placed("missing", null, null, `never present in the engine at this time${Number.isFinite(near) ? ` (its nearest instance ${s(near)} s away)` : windows.length ? "" : " (the engine never has it here)"}`);
    }
    if (dEnd <= dStart) return placed("endsLater", dEnd, end, `fits if it ended ${s(dEnd)} s later (the engine ends it at ${s(end as number)} s)`);
    return placed("startsEarlier", dStart, start, `fits if it started ${s(dStart)} s earlier (the engine starts it at ${s(start as number)} s)`);
  }
  if (removes) {
    if (!containing.length) {
      const ended = windows.filter((w) => w.end <= t);
      const last = ended.length ? Math.max(...ended.map((w) => w.end)) : null;
      return placed("carried", null, null, `the engine has it, the damage says absent; no instance reaches the hit's operator at the hit, a snapshot (Combustion's) or the cast carries it${last !== null ? ` (its last instance ended at ${s(last)} s, ${s(t - last)} s before)` : ""}`);
    }
    let best: { d: number; edge: number; start: boolean } | null = null;
    for (const w of containing) {
      const dStart = t - w.start;
      const dEnd = w.end - t;
      const cand = dStart <= dEnd ? { d: dStart, edge: w.start, start: true } : { d: dEnd, edge: w.end, start: false };
      if (!best || cand.d < best.d) best = cand;
    }
    const b = best as { d: number; edge: number; start: boolean };
    if (b.d > TIMING_EDGE_MS) {
      const w = containing[0] as KitWindow;
      return placed("extra", null, null, `the engine has it, the damage says absent (its instance runs ${s(w.start)}–${Number.isFinite(w.end) ? s(w.end) : "end"} s)`);
    }
    if (b.start) return placed("startsLater", b.d, b.edge, `fits if it started ${s(b.d)} s later (the engine starts it at ${s(b.edge)} s)`);
    return placed("endsEarlier", b.d, b.edge, `fits if it ended ${s(b.d)} s earlier (the engine ends it at ${s(b.edge)} s)`);
  }
  return placed("values", null, null, `fits with other values (${toggle.how === "log" ? "as the log lists it" : toggle.how === "engine" ? `as the engine values it at ${s(toggle.at ?? 0)} s` : `as the kit values it at ${toggle.layers} layer(s)`})`);
}

const DIRECTION_RANK: Record<TimingDirection, number> = { endsLater: 0, endsEarlier: 0, startsEarlier: 0, startsLater: 0, values: 1, inactive: 2, carried: 2, missing: 3, extra: 3 };
/** Smaller explanations first: an edge's (nearest first), then values, an inactive instance, missing or extra. */
const fitOrder = (a: TimingFit, b: TimingFit) => {
  const key = (f: TimingFit) => [f.toggles.length, Math.max(...f.toggles.map((t) => DIRECTION_RANK[t.direction])), f.toggles.reduce((s, t) => s + (t.offsetMs ?? TIMING_EDGE_MS), 0), f.base.length] as const;
  const [x, y] = [key(a), key(b)];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return (x[i] as number) - (y[i] as number);
  return 0;
};

/** A kit buff's display name: its owner's name and its label. */
function buffName(data: GameData, c: EngineCheck, k: string): string {
  const [owner] = k.split(":", 1) as [string];
  return `${data.operators[owner]?.name ?? owner}'s ${c.names.defs.get(k)?.label ?? k}`;
}

/** The base readings a toggle is tried on: the check's alternatives without its own kit-buff toggles (all combinations up to MAX_BASES, else the plain one and the crit's). */
function bases(b: ReadingBasis): Alternative[][] {
  const groups = b.groups.filter((g) => !b.edgeToggles.has(g));
  const n = groups.reduce((x, g) => x * g.length, 1);
  if (n <= MAX_BASES) return groups.reduce<Alternative[][]>((acc, g) => acc.flatMap((a) => g.map((x) => [...a, x])), [[]]);
  const crit = groups.find((g) => g.some((a) => a.assumption?.kind === "crit"));
  return [[], ...(crit ? crit.filter((a) => a.assumption).map((a) => [a]) : [])];
}

/** The damage of a reading, or null where it doesn't apply. */
function damageOf(c: EngineCheck, r: Reading): number | null {
  try {
    return roundDamage(landingDamage(c.data, c.target, r.inputs, r.options, r.other).exact);
  } catch (e) {
    if (!readingDoesNotApply(e)) throw e;
    return null;
  }
}

/** The report for one log (never a hold-out: the caller chooses). */
export function fixtureTiming(data: GameData, fx: LogFixture, opts: TimingOptions = {}): FixtureTiming {
  const placement = placeHits(data, fx);
  const replay = logBuffReplay(data, fx, placement);
  const byHit = engineHits(data, fx, replay, placement);
  const verdicts = checkLog(data, fx, { replay, engineHits: byHit });
  const c = engineCheck(data, fx, replay.replay);
  const valuations = engineValuations(replay.replay);
  const panels = teamPanels(data, fx).panels;
  const judgedKinds = new Set<VerdictCount>(["fallback", "mismatch", ...(opts.assumed ? (["assumed"] as const) : [])]);
  const basisCache = new Map<number, ReadingBasis | null>();
  const basisOf = (i: number): ReadingBasis | null => {
    if (!basisCache.has(i)) {
      const h = fx.hits[i] as LogHit;
      const b = readingBasis(c, h, hitPlace(data, fx, placement, replay, h));
      basisCache.set(i, "unknown" in b.landing ? null : (b as ReadingBasis));
    }
    return basisCache.get(i) as ReadingBasis | null;
  };
  const windowsOf = (k: string, op: string) => replay.replay.kitWindows(k, op);
  const out: HitTiming[] = [];
  for (const [i, h] of fx.hits.entries()) {
    const v = verdicts[i] as HitVerdict;
    const verdict = verdictCount(v);
    if (!judgedKinds.has(verdict)) continue;
    const b = basisOf(i);
    const primaryDamage = byHit.get(h)?.primary ?? null;
    const actual = h.uncapped ?? h.value;
    const stake = Math.abs(actual - (primaryDamage ?? 0));
    if (!b) {
      out.push({ index: i, hit: h, verdict, primary: primaryDamage, fits: [], pairs: [], tried: 0, stake });
      continue;
    }
    const toggles = togglesAt(c, b, h, valuations, panels);
    const baseSets = bases(b);
    const place = (t: TimingToggle) => placeToggle(windowsOf(t.kitBuff, h.operator), h.t, t, buffName(data, c, t.kitBuff));
    let tried = 0;
    const tryWith = (apply: (o: Reading) => Reading, sets: readonly Alternative[][]): { predicted: number; base: string[] } | null => {
      for (const set of sets) {
        const p = damageOf(c, apply(set.reduce((o, a) => a.apply(o), b.primary)));
        tried++;
        if (p !== null && fits(p, actual)) return { predicted: p, base: set.flatMap((a) => (a.assumption ? [a.assumption.label] : [])) };
      }
      return null;
    };
    const singles: TimingFit[] = [];
    for (const t of toggles) {
      const f = tryWith(t.apply, baseSets);
      if (f) singles.push({ toggles: [place(t.toggle)], ...f });
    }
    const pairs: TimingFit[] = [];
    if (!singles.length && opts.pairs !== false) {
      const near = toggles.map((t) => ({ t, p: place(t.toggle) })).filter((x) => x.p.offsetMs !== null).sort((x, y) => (x.p.offsetMs as number) - (y.p.offsetMs as number)).slice(0, MAX_PAIR_TOGGLES);
      const pairBases = baseSets.slice(0, 2);
      for (let a = 0; a < near.length; a++) for (let z = a + 1; z < near.length; z++) {
        const [x, y] = [near[a], near[z]] as [(typeof near)[number], (typeof near)[number]];
        if (x.t.toggle.kitBuff === y.t.toggle.kitBuff) continue;
        const f = tryWith((o) => y.t.apply(x.t.apply(o)), pairBases);
        if (f) pairs.push({ toggles: [x.p, y.p], ...f });
      }
    }
    out.push({ index: i, hit: h, verdict, primary: primaryDamage, fits: singles.sort(fitOrder), pairs: pairs.sort(fitOrder), tried, stake });
  }
  // Counter-evidence: plain matches at an operator in a span where the same change of the same buff would break them.
  const against = (k: string, adds: boolean, operators: ReadonlySet<string>, from: number, to: number): number => {
    let n = 0;
    for (const [i, h] of fx.hits.entries()) {
      if (h.t < from || h.t > to || !operators.has(h.operator)) continue;
      const v = verdicts[i] as HitVerdict;
      if (v.kind !== "match" || v.class !== "plain") continue;
      const b = basisOf(i);
      if (!b) continue;
      const mine = togglesAt(c, b, h, valuations, panels).filter((t) => t.toggle.kitBuff === k && (adds ? t.toggle.after > t.toggle.before : t.toggle.after < t.toggle.before));
      if (!mine.length) continue;
      const actual = h.uncapped ?? h.value;
      const ps = mine.map((t) => damageOf(c, t.apply(b.primary)));
      if (ps.every((p) => p !== null && !fits(p, actual))) n++;
    }
    return n;
  };
  return { fixture: fx.id, verdicts, hits: out, patterns: patternsOf(data, fx, c, placement, replay.replay, out, against) };
}

/** Patterns of one log: each hit's smallest single fit, grouped by buff, direction and edge (or consecutive within CLUSTER_MS); two hits or more. */
function patternsOf(data: GameData, fx: LogFixture, c: EngineCheck, placement: Placement, replay: BuffReplay, hits: readonly HitTiming[], against: (k: string, adds: boolean, ops: ReadonlySet<string>, from: number, to: number) => number): TimingPattern[] {
  const groups = new Map<string, { k: string; d: TimingDirection; edge: number | null; items: { h: HitTiming; f: PlacedToggle }[] }[]>();
  for (const h of [...hits].sort((a, b) => a.hit.t - b.hit.t)) {
    const best = h.fits[0]?.toggles[0];
    if (!best) continue;
    const key = `${best.kitBuff}|${best.direction}`;
    const list = groups.get(key) ?? [];
    groups.set(key, list);
    const last = list.at(-1);
    const sameRun = best.edgeMs !== null ? list.find((g) => g.edge === best.edgeMs) : last && last.edge === null && h.hit.t - (last.items.at(-1) as { h: HitTiming }).h.hit.t <= CLUSTER_MS ? last : undefined;
    if (sameRun) sameRun.items.push({ h, f: best });
    else list.push({ k: best.kitBuff, d: best.direction, edge: best.edgeMs, items: [{ h, f: best }] });
  }
  const out: TimingPattern[] = [];
  for (const list of groups.values()) for (const g of list) {
    if (g.items.length < 2) continue;
    const ts = g.items.map((x) => x.h.hit.t);
    const [lo, hi] = [Math.min(...ts), Math.max(...ts)];
    const span: [number, number] =
      g.d === "endsLater" || g.d === "startsLater" ? [Math.min(g.edge ?? lo, lo), hi] : g.d === "endsEarlier" || g.d === "startsEarlier" ? [lo, Math.max(g.edge ?? hi, hi)] : [lo, hi];
    const adds = (g.items[0] as { f: PlacedToggle }).f.after > (g.items[0] as { f: PlacedToggle }).f.before;
    const alsoFits = new Map<string, number>();
    for (const { h } of g.items) for (const k of new Set(h.fits.slice(1).map((f) => (f.toggles[0] as PlacedToggle).kitBuff).filter((k) => k !== g.k))) alsoFits.set(k, (alsoFits.get(k) ?? 0) + 1);
    const names = new Set(c.names.ofKitBuff.get(g.k) ?? []);
    out.push({
      fixture: fx.id, kitBuff: g.k, direction: g.d, edgeMs: g.edge, hits: g.items.map((x) => x.h), fits: g.items.map((x) => x.f),
      stake: g.items.reduce((s, x) => s + x.h.stake, 0),
      against: against(g.k, adds, new Set(g.items.map((x) => x.h.hit.operator)), span[0], span[1]),
      alsoFits, coarse: g.items.filter((x) => x.h.hit.value < COARSE_VALUE).length,
      listed: g.items.filter((x) => x.h.hit.effects.some((e) => names.has(e.buff))).length,
      mechanism: mechanismNear(data, fx, c, placement, replay, g.k, g.d, g.edge, lo, hi),
    });
  }
  return out.sort((a, b) => b.stake - a.stake);
}

/** The window a pattern's mechanism is looked for in (ms): around where the buff would have to start or end. */
function mechanismWindow(d: TimingDirection, edge: number | null, lo: number, hi: number): [number, number] {
  const e = edge ?? lo;
  switch (d) {
    case "endsLater":
      return [e - 2000, lo + 500];
    case "endsEarlier":
      return [hi - 500, e + 500];
    case "startsEarlier":
      return [hi - 2000, e + 500];
    case "startsLater":
      return [e - 500, lo + 500];
    default:
      return [lo - 2000, hi + 500];
  }
}

/** A trigger's event, as text. */
function onText(t: KitTrigger): string {
  const on = t.on as Record<string, unknown>;
  const parts = Object.entries(on).filter(([k]) => k !== "event").map(([k, v]) => `${k} ${Array.isArray(v) ? v.join("/") : String(v)}`);
  return `on ${on["event"] as string}${parts.length ? ` (${parts.join(", ")})` : ""} by ${t.by}${t.if ? ", if …" : ""}${t.delay ? `, +${t.delay} frames` : ""}${t.chance !== undefined ? ", by chance" : ""}`;
}

/** The kit's ways to create, extend or end a buff: skill hits and triggers, its duration, consumption, game buff. */
function kitSources(kit: OperatorKit, def: KitBuff): { text: string; creates: boolean; skill?: string; trigger?: KitTrigger }[] {
  const out: { text: string; creates: boolean; skill?: string; trigger?: KitTrigger }[] = [];
  for (const s of kit.skills) for (const h of s.hits) if (h.buffs?.some((a) => a.buff === def.id)) out.push({ text: `${s.kind} ${s.skillId} hit ${h.id} applies it`, creates: true, skill: s.skillId });
  for (const t of kit.triggers) {
    const acts = allActions(t.do);
    if (acts.some((a) => (a.kind === "buff" || a.kind === "extendBuff") && a.buff === def.id)) out.push({ text: `trigger ${t.id} ${acts.some((a) => a.kind === "extendBuff" && a.buff === def.id) ? "extends" : "applies"} it, ${onText(t)}`, creates: true, trigger: t });
    if (acts.some((a) => a.kind === "endBuff" && a.buff === def.id)) out.push({ text: `trigger ${t.id} ends it, ${onText(t)}`, creates: false, trigger: t });
  }
  const dur = def.duration === undefined ? "no duration (until something ends it)" : `duration ${typeof def.duration === "number" ? `${def.duration} s` : JSON.stringify(def.duration)}`;
  out.push({ text: `${dur}${def.consumedBy ? `; consumed by ${def.consumedBy.join("/")} casts` : ""}${def.endsWithCast ? "; ends with its cast" : ""}${def.gameBuff ? `; BuffData ${def.gameBuff}` : ""}${def.loggedAs?.length ? ` (logged as ${def.loggedAs.join(", ")})` : ""}`, creates: false });
  return out;
}

/** What happens near a pattern (casts, stops, reactions, Stagger) and the kit sources an event there matches. */
function mechanismNear(data: GameData, fx: LogFixture, c: EngineCheck, placement: Placement, replay: BuffReplay, k: string, d: TimingDirection, edge: number | null, lo: number, hi: number): Mechanism {
  const window = mechanismWindow(d, edge, lo, hi);
  const [a, z] = window;
  const inWindow = (t: number) => t >= a && t <= z;
  const s = (t: number) => `${(t / 1000).toFixed(1)} s`;
  const name = (op: string) => data.operators[op]?.name ?? op;
  const [owner, id] = k.split(":", 2) as [string, string];
  const build = fx.team.find((b) => b.operator === owner);
  const kit = build ? effectiveKit(data, build) : undefined;
  const def = kit?.buffs.find((b) => b.id === id);
  const sources = kit && def ? kitSources(kit, def) : [];
  const casts = placement.casts.filter((x) => x.kind !== null && inWindow(x.start));
  const hitless = (fx.casts ?? []).filter((x) => inWindow(x.t) && !casts.some((y) => y.operator === x.operator && Math.abs(y.start - x.t) <= 1000));
  const castText = [...casts.map((x) => ({ t: x.start, text: `${name(x.operator)} ${x.kind} ${s(x.start)}` })), ...hitless.map((x) => ({ t: x.t, text: `${name(x.operator)} ${x.skill} ${s(x.t)} (logged, hitless)` }))].sort((x, y) => x.t - y.t).map((x) => x.text);
  const stops = castTimeStops(data, placement.casts).filter((x) => ms(x.start) <= z && ms(x.start + x.scales.length) >= a);
  const stopText = stops.map((x) => `${name(x.operator)} ${data.skills[x.skillId] ? x.skillId.replace(/^chr_\d+_/, "") : x.skillId} ${s(ms(x.start))}–${s(ms(x.start + x.scales.length))}${Math.min(...x.scales) === 0 ? " stop" : " slow-down"}`);
  const reactionHits = fx.hits.filter((h) => inWindow(h.t) && parseReactionEvent(h.event));
  const reactions = [...new Map(reactionHits.map((h) => {
    const r = parseReactionEvent(h.event) as NonNullable<ReturnType<typeof parseReactionEvent>>;
    return [`${r.kind}|${r.element}|${Math.round(h.t / 200)}`, `${name(h.operator)} ${r.kind}${r.element ? ` ${r.element}` : ""} ${s(h.t)}`] as const;
  })).values()];
  const staggers = [...replay.staggers.map((f) => ({ t: ms(f), text: `engine Stagger ${s(ms(f))}` })), ...loggedRecoveries(fx).map((t) => ({ t, text: `logged Stagger recovery ${s(t)}` }))].filter((x) => inWindow(x.t)).map((x) => x.text);
  // Kit sources an event in the window matches.
  const matched: string[] = [];
  const team = fx.team.map((b) => b.operator);
  const byOk = (by: KitTrigger["by"], op: string) => by === "self" ? op === owner : by === "teammate" ? op !== owner : true;
  // Casts a source may match: placed ones, and logged hitless ones (their kind from the caster's kit); for a buff the
  // engine misses or starts late, from up to LOOKBACK_MS before the window (a cast whose buff runs that long).
  const back = d === "missing" || d === "startsEarlier" ? LOOKBACK_MS : 0;
  const inCastWindow = (t: number) => t >= a - back && t <= z;
  const kindOf = (op: string, skill: string) => { const b2 = fx.team.find((b) => b.operator === op); return (b2 ? effectiveKit(data, b2)?.skills.find((x) => x.skillId === skill)?.kind : undefined) ?? null; };
  const matchable = [
    ...placement.casts.filter((x) => x.kind !== null && inCastWindow(x.start)).map((x) => ({ operator: x.operator, skillId: x.skillId, kind: x.kind, start: x.start, hitless: false })),
    ...(fx.casts ?? []).filter((x) => inCastWindow(x.t) && !placement.casts.some((y) => y.operator === x.operator && y.skillId === x.skill && Math.abs(y.start - x.t) <= 1000)).map((x) => ({ operator: x.operator, skillId: x.skill, kind: kindOf(x.operator, x.skill), start: x.t, hitless: true })),
  ].sort((x, y) => x.start - y.start);
  const castNote = (x: (typeof matchable)[number]) => `${x.hitless ? ", logged hitless" : ""}${x.start < a ? `, ${s(a - x.start)} before the window` : ""}`;
  for (const src of sources) {
    if (src.skill) {
      const hit = matchable.find((x) => x.operator === owner && x.skillId === src.skill);
      if (hit) matched.push(`${src.text}: cast ${s(hit.start)}${castNote(hit)}`);
      continue;
    }
    const t = src.trigger;
    if (!t) continue;
    const on = t.on;
    let ev: string | null = null;
    if (on.event === "cast") {
      const x = matchable.find((y) => byOk(t.by, y.operator) && team.includes(y.operator) && (!on.kinds || on.kinds.includes(y.kind as never)) && (!on.skills || on.skills.includes(y.skillId)));
      if (x) ev = `${name(x.operator)} ${x.kind} ${s(x.start)}${castNote(x)}`;
    } else if (on.event === "hit") {
      const x = fx.hits.find((h) => {
        if (!inWindow(h.t) || !byOk(t.by, h.operator) || parseReactionEvent(h.event)) return false;
        // A crit filter: a hit the log gives as one (or not), or whose crit it doesn't give (the replay takes it as none).
        if (on.crit !== undefined && h.crit !== on.crit && h.crit !== null) return false;
        const p = placement.hits.get(h);
        return (!on.kinds || (p?.cast.kind !== undefined && on.kinds.includes((p.cast.kind ?? "none") as never))) && (!on.skills || (p !== undefined && on.skills.includes(p.cast.skillId)));
      });
      if (x) ev = `${name(x.operator)} ${on.crit === undefined ? "hit" : x.crit === null ? "hit whose crit the log doesn't give" : on.crit ? "crit" : "non-crit"} ${s(x.t)}`;
    } else if (on.event === "heal") {
      // Heals come from casts (no amounts in the log): a cast of the healer's of a kind that heals.
      const x = casts.find((y) => byOk(t.by, y.operator) && (!on.kinds || on.kinds.includes(y.kind as never)));
      if (x) ev = `${name(x.operator)} ${x.kind} ${s(x.start)} (heals?)`;
    } else if ((STATUS_EVENTS as readonly string[]).includes(on.event)) {
      const x = reactionHits.find((h) => byOk(t.by, h.operator));
      if (x) ev = `${name(x.operator)} ${parseReactionEvent(x.event)?.kind} ${s(x.t)}`;
    } else if (on.event === "staggered" || on.event === "staggerNode") {
      if (staggers.length) ev = staggers[0] as string;
    }
    if (ev) matched.push(`${src.text}: ${ev}`);
  }
  // A time stop or slow-down at the engine's end (within REPLAY_EDGE_MS-like 0.5 s): its hold may be another length than the engine's.
  if ((d === "endsLater" || d === "endsEarlier") && edge !== null) {
    for (const [i, x] of stops.entries()) if (ms(x.start) <= edge + 500 && ms(x.start + x.scales.length) >= edge - 500) matched.push(`a ${Math.min(...x.scales) === 0 ? "time stop" : "slow-down"} at the engine's end (holds it?): ${stopText[i]}`);
  }
  return { window, kit: sources.map((x) => x.text), matched, casts: castText, stops: stopText, reactions, staggers };
}

/** A pattern's buff and direction across logs. */
export interface TimingSummary {
  readonly kitBuff: string;
  readonly direction: TimingDirection;
  readonly patterns: readonly TimingPattern[];
  readonly hits: number;
  readonly stake: number;
  readonly against: number;
  /** Offsets of the hits that have one (ms). */
  readonly offsets: readonly number[];
  /** Patterns some kit source of the buff has a matching event near. */
  readonly withMechanism: number;
}

/** Patterns across logs, per buff and direction, by damage at stake. */
export function timingSummaries(reports: readonly FixtureTiming[]): TimingSummary[] {
  const by = new Map<string, TimingPattern[]>();
  for (const r of reports) for (const p of r.patterns) by.set(`${p.kitBuff}|${p.direction}`, [...(by.get(`${p.kitBuff}|${p.direction}`) ?? []), p]);
  return [...by.values()].map((ps) => ({
    kitBuff: (ps[0] as TimingPattern).kitBuff, direction: (ps[0] as TimingPattern).direction, patterns: ps,
    hits: ps.reduce((s, p) => s + p.hits.length, 0), stake: ps.reduce((s, p) => s + p.stake, 0), against: ps.reduce((s, p) => s + p.against, 0),
    offsets: ps.flatMap((p) => p.fits.flatMap((f) => (f.offsetMs === null ? [] : [f.offsetMs]))),
    withMechanism: ps.filter((p) => p.mechanism.matched.length > 0).length,
  })).sort((a, b) => b.stake - a.stake);
}

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? ((s[(s.length - 1) >> 1] as number) + (s[s.length >> 1] as number)) / 2 : 0;
};
const big = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}k` : `${Math.round(x)}`);
const short = (id: string) => id.replace(/^zmdlogs-/, "").slice(0, 4);

/** The report as text: the summary, the top patterns with their mechanisms, single fits, pairs, and the unexplained. */
export function formatTimingReport(data: GameData, reports: readonly FixtureTiming[], opts: { top?: number; verbose?: boolean; skipped?: number; seconds?: number } = {}): string {
  const lines: string[] = [];
  const s = (t: number) => (t / 1000).toFixed(1);
  const all = reports.flatMap((r) => r.hits);
  const one = all.filter((h) => h.fits.length);
  const two = all.filter((h) => !h.fits.length && h.pairs.length);
  const none = all.filter((h) => !h.fits.length && !h.pairs.length);
  const count = (v: VerdictCount) => all.filter((h) => h.verdict === v).length;
  const nameOf = (k: string) => {
    const [owner, id] = k.split(":", 2) as [string, string];
    return `${data.operators[owner]?.name ?? owner}'s ${id}`;
  };
  lines.push(`Buff timing report (a diagnostic, never scored: a fit is a hint, a change needs a mechanism; docs/accuracy-plan.md)`);
  lines.push(`${reports.length} log(s)${opts.skipped ? `, ${opts.skipped} hold-out log(s) skipped` : ""}${opts.seconds !== undefined ? `, ${opts.seconds.toFixed(1)} s` : ""}: ${all.length} hits read ` +
    `(${count("fallback")} fallback, ${count("mismatch")} mismatch${count("assumed") ? `, ${count("assumed")} assumed` : ""}); ` +
    `${one.length} fit one toggle (at stake ${big(one.reduce((x, h) => x + h.stake, 0))}), ${two.length} only a pair, ${none.length} none (at stake ${big(none.reduce((x, h) => x + h.stake, 0))}).`);
  const summaries = timingSummaries(reports);
  lines.push("", `Patterns across logs (runs of ≥2 hits whose smallest single fit is the same buff, direction and edge), by damage at stake:`);
  for (const [i, sm] of summaries.slice(0, opts.top ?? 20).entries()) {
    const offs = sm.offsets;
    const logs = [...new Set(sm.patterns.map((p) => short(p.fixture)))];
    lines.push(`${String(i + 1).padStart(2)}. ${nameOf(sm.kitBuff)} — ${DIRECTION_TEXT[sm.direction]}: ${sm.hits} hits in ${sm.patterns.length} run(s) (${logs.join(", ")})` +
      `${offs.length ? `; offset median ${s(median(offs))} s (${s(Math.min(...offs))}–${s(Math.max(...offs))})` : ""}; at stake ${big(sm.stake)}; against ${sm.against}; mechanism near ${sm.withMechanism} of ${sm.patterns.length}`);
    for (const p of sm.patterns.slice(0, opts.verbose ? 99 : 3)) {
      const ts = p.hits.map((h) => h.hit.t);
      const ops = [...new Set(p.hits.map((h) => data.operators[h.hit.operator]?.name ?? h.hit.operator))].join(", ");
      const fo = p.fits.flatMap((f) => (f.offsetMs === null ? [] : [f.offsetMs]));
      const also = [...p.alsoFits].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, n]) => `${nameOf(k)} ×${n}`);
      lines.push(`      ${short(p.fixture)}${p.edgeMs !== null ? ` edge ${s(p.edgeMs)} s` : ""}: ${p.hits.length} hits ${s(Math.min(...ts))}–${s(Math.max(...ts))} s (${ops})` +
        `${fo.length ? `, ${s(Math.min(...fo))}–${s(Math.max(...fo))} s from it` : ""}; at stake ${big(p.stake)}; against ${p.against}; log lists it at ${p.listed}/${p.hits.length}` +
        `${p.coarse ? `; ${p.coarse} coarse (±1 > 0.05%)` : ""}${also.length ? `; also fits ${also.join(", ")}` : ""}`);
      lines.push(`        e.g. ${(p.fits[0] as PlacedToggle).label} [${(p.fits[0] as PlacedToggle).how}]`);
      const m = p.mechanism;
      if (m.matched.length) lines.push(`        mechanism candidates (${s(m.window[0])}–${s(m.window[1])} s): ${m.matched.slice(0, 4).join("; ")}`);
      else lines.push(`        NO MECHANISM: no kit source of it has an event in ${s(m.window[0])}–${s(m.window[1])} s (kit: ${m.kit.slice(0, 3).join("; ") || "none"})`);
      const near = [m.casts.length ? `casts ${m.casts.slice(0, 6).join(", ")}${m.casts.length > 6 ? ` +${m.casts.length - 6}` : ""}` : "", m.stops.length ? `stops ${m.stops.slice(0, 4).join(", ")}` : "", m.reactions.length ? `reactions ${m.reactions.slice(0, 4).join(", ")}` : "", m.staggers.length ? m.staggers.slice(0, 2).join(", ") : ""].filter(Boolean);
      if (near.length) lines.push(`        near: ${near.join("; ")}`);
    }
    if (!opts.verbose && sm.patterns.length > 3) lines.push(`      … ${sm.patterns.length - 3} more run(s)`);
  }
  // Single fits outside every pattern (noise unless they repeat).
  const inPattern = new Set(reports.flatMap((r) => r.patterns.flatMap((p) => p.hits)));
  const isolated = one.filter((h) => !inPattern.has(h));
  const byBuff = new Map<string, number>();
  for (const h of isolated) {
    const k = (h.fits[0]?.toggles[0] as PlacedToggle).kitBuff;
    byBuff.set(k, (byBuff.get(k) ?? 0) + 1);
  }
  lines.push("", `Isolated single fits (noise unless they repeat): ${isolated.length} hits; ${[...byBuff].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${nameOf(k)} ×${n}`).join(", ")}`);
  if (two.length) {
    const pairs = new Map<string, number>();
    for (const h of two) {
      const f = h.pairs[0] as TimingFit;
      const k = f.toggles.map((t) => `${nameOf(t.kitBuff)} (${DIRECTION_TEXT[t.direction]})`).join(" + ");
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
    lines.push(`Pairs (hits no single toggle fits): ${[...pairs].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k} ×${n}`).join("; ")}`);
  }
  if (opts.verbose) {
    for (const r of reports) {
      lines.push("", `${r.fixture}:`);
      for (const h of r.hits) {
        const f = h.fits[0] ?? h.pairs[0];
        lines.push(`  t=${h.hit.t} ${data.operators[h.hit.operator]?.name ?? h.hit.operator} ${h.hit.event} ${h.verdict}: logged ${h.hit.value}, engine ${h.primary ?? "none"}; ` +
          (f ? `${f.toggles.map((t) => t.label).join(" + ")}${f.base.length ? ` (with ${f.base.join(", ")})` : ""}${h.fits.length > 1 ? `; ${h.fits.length - 1} more fit(s)` : ""}` : `no toggle fits (${h.tried} tried)`));
      }
    }
  }
  return lines.join("\n");
}
