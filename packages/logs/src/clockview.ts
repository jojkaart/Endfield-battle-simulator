// `efsim zmdlogs clock`: a kit buff's own clock in the replay against the log, per instance. The first table of every
// "the buff runs long / short" question (Twilight, Si's Amp and Artful Intent, the buff clock): four agents wrote it
// as a scratch script (scratch/bc/lanes.ts, ai-natural.ts, final-win.ts, twl/fg.ts), each first reading the window the
// check uses, which is already cut or held to the log's end, as the buff's natural end (round 6).
//
// Per instance of the kit buff (its start, BuffReplay.traces' appliedAt):
// - first: the expiry the replay first gave it (its data duration, plus the holds of a stop it was created in);
// - own: its expiry on the replay's own clock (every stop and slow-down the replay places, no hidden holds, no log
//   ends: `hidden-holds=none`), up to the first step that shortened or removed it;
// - ended: when and how it ended under `hidden-holds=none` (ran out at its expiry, or the step that cut it: a cast,
//   an inferred cast's `expires`, the log's Stagger);
// - check: when it ended in the replay the log check uses (the default readings, or --assume), and how;
// - log: the run of its game buff (buffLanes: the kit buff's logged names, its owner as source) the instance stands
//   for: since, last listed hit, next unlisted hit; and the last listed hit's lateness past `own`, in real and in
//   world time (the replay's casts' stops out: replayTimeStops).
// Instances of the same kit buff on several recipients share one start and are one row (the traces key by owner, id
// and start). An instance whose application cut an earlier one on the own clock says so ("refreshes the one from"):
// the log keeps a refreshed run's `since`, the replay starts a new instance (round 8).

import { FPS, type GameData } from "@efsim/engine";
import { teamBuffNames } from "./enginecheck.ts";
import { logBuffReplay } from "./logcheck.ts";
import { worldMs } from "./logcasts.ts";
import type { DevFixture } from "./logs.ts";
import { buffLanes, replayTimeStops, type BuffLane } from "./query.ts";
import type { BuffTrace } from "./replayrecord.ts";
import type { LogFixture } from "./zmdlogs.ts";
import { operatorLabel, secondsText as s } from "./labels.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;

/** How an instance ended in one replay: at a frame (ms) and why, or not before the fight's end. */
export interface ClockEnd {
  /** ms; null: still on at the replay's last step. */
  readonly at: number | null;
  /** "ran out" (removed at its expiry), the step that cut it, or "fight's end". */
  readonly how: string;
}

/** One instance of a kit buff: the replay's clocks against the log's run (ms). */
export interface ClockRow {
  readonly start: number;
  /** The first expiry the replay gave it (null: none traced; Infinity: never expires). */
  readonly first: number | null;
  /** Its expiry on the replay's own clock (hidden-holds=none) before any step shortened or removed it. */
  readonly own: number | null;
  readonly ended: ClockEnd;
  /**
   * In the replay the check uses (the default readings or the ones given): its instance nearest this one's start
   * (within CHECK_PAIR_MS, each paired once: the hidden holds move the check's starts, round 15), how it ended and
   * where it started (`checkStart`); null: none there.
   */
  readonly check: ClockEnd | null;
  readonly checkStart?: number;
  /**
   * The log's run of its game buff this instance stands for (null: none listed from near its start), with its values
   * and whether one is the instance's own (`byValue`; null: the instance has no value to compare, or none was traced).
   */
  readonly lane: (Pick<BuffLane, "buff" | "since" | "firstListed" | "lastListed" | "nextUnlisted" | "values"> & { readonly byValue: boolean | null }) | null;
  /** The instance's modifier and attribute values (BuffTrace.values), as the replay resolved them. */
  readonly values?: readonly number[];
  /** The last listed hit less `own`, real and world time (ms; null without a lane or an own expiry). */
  readonly late: { readonly real: number; readonly world: number } | null;
  /**
   * The start of the instance this one's application cut on the replay's own clock (a refresh in the replay: the
   * log keeps a refreshed run's `since`, the replay starts a new instance), if one did.
   */
  readonly replaces?: number;
}

/**
 * How far (ms) the check replay's instance of a kit buff may start from the own clock's and be the same one: the hidden
 * holds the check places move its starts (low-plain-low-mismatch report point 3: c4f3's Wolven Blood final, "check
 * none" for every instance the check's replay had, its starts 68.50 s against the check's modifiers on the same hits).
 */
export const CHECK_PAIR_MS = 5000;

/** Each own instance's check instance (the nearest start within CHECK_PAIR_MS, in start order, each paired once), and the check's unpaired ones. */
export function pairInstances(own: readonly ClockInstance[], check: readonly ClockInstance[]): { readonly paired: readonly (ClockInstance | null)[]; readonly unpaired: readonly ClockInstance[] } {
  const used = new Set<ClockInstance>();
  const paired = own.map((i) => {
    const c = check.filter((x) => !used.has(x) && Math.abs(x.start - i.start) <= CHECK_PAIR_MS).sort((a, b) => Math.abs(a.start - i.start) - Math.abs(b.start - i.start))[0] ?? null;
    if (c) used.add(c);
    return c;
  });
  return { paired, unpaired: check.filter((x) => !used.has(x)) };
}

export interface ClockInstance {
  readonly start: number;
  readonly first: number | null;
  readonly own: number | null;
  readonly ended: ClockEnd;
  readonly values?: readonly number[];
}

/** A lane value this close to a kit buff's (absolute, or relative to it) is the same number (the log rounds to 6 decimals). */
const VALUE_TOLERANCE = 5e-6;
const sameValue = (a: number, b: number) => Math.abs(a - b) <= Math.max(VALUE_TOLERANCE, 1e-4 * Math.abs(b));

/**
 * The log's run an instance stands for (round 16, arcane-will report point 2: e82d's first Doubles Susceptibility
 * instance was paired with Arcane's talent Susceptibility, logged under the same buff_common_affixes_vulnerable_crystal
 * from the same source at 0.197 against its 0.1794). Candidates: the runs whose since falls from its start (less the
 * log's batching) to the next instance's, then those listed across its start (a refresh keeps the run's since). With
 * the instance's values, the first candidate of one of them; without a match, or without values, the first by since of
 * the first group (the rule before round 16).
 */
export function laneOfInstance(lanes: readonly BuffLane[], start: number, next: number, values: readonly number[] = []): { readonly lane: BuffLane; readonly byValue: boolean | null } | undefined {
  const by = (l: BuffLane) => l.since ?? l.firstListed;
  const from = lanes.filter((l) => by(l) >= start - 300 && by(l) < next - 300).sort((a, b) => by(a) - by(b));
  const across = lanes.filter((l) => by(l) < start - 300 && l.lastListed >= start).sort((a, b) => by(b) - by(a));
  const matches = (l: BuffLane) => l.values.some((v) => values.some((x) => sameValue(v, x)));
  if (values.length) {
    const hit = [...from, ...across].find(matches);
    if (hit) return { lane: hit, byValue: true };
  }
  const first = from[0];
  return first ? { lane: first, byValue: values.length ? false : null } : undefined;
}

/** A replay's instances of a traced buff from its traces (frames → ms). */
function instancesOf(traces: readonly BuffTrace[], buff: string): ClockInstance[] {
  const by = new Map<number, BuffTrace[]>();
  for (const t of traces) if (t.buff === buff) by.set(t.appliedAt, [...(by.get(t.appliedAt) ?? []), t]);
  const ms = (f: number | null) => (f === null ? null : Number.isFinite(f) ? msOf(f) : Infinity);
  return [...by]
    .sort((a, b) => a[0] - b[0])
    .map(([at, ts]) => {
      const first = ts[0]?.from === null ? (ts[0]?.to ?? null) : null;
      let own = first;
      for (const t of ts.slice(1)) {
        if (t.to === null || t.from === null || t.to < t.from) break;
        own = t.to;
      }
      const gone = ts.find((t) => t.to === null);
      // Traces sample the state after each step, so a buff that ran out between two steps is seen gone at the later
      // one: ran out when its expiry was at or before that frame (then it ended at its expiry).
      const ended: ClockEnd = !gone
        ? { at: null, how: "fight's end" }
        : gone.from !== null && gone.from <= gone.frame + 1
          ? { at: msOf(Math.min(gone.from, gone.frame)), how: "ran out" }
          : { at: msOf(gone.frame), how: `cut at ${gone.step}${gone.from !== null && Number.isFinite(gone.from) ? ` (its expiry ${s(msOf(gone.from))} s)` : ""}` };
      const values = ts.find((t) => t.values)?.values;
      return { start: msOf(at), first: ms(first), own: ms(own), ended, ...(values ? { values } : {}) };
    });
}

/** The rows of `kitBuff` (owner:id) in one log; `assume` the readings of the check's replay (its own clock always under hidden-holds=none on top). */
export function kitBuffClock(data: GameData, fx: LogFixture, kitBuff: string, assume: Readonly<Record<string, string>> = {}): ClockRow[] {
  const owner = kitBuff.split(":")[0] as string;
  const names = teamBuffNames(data, fx);
  if (!names.defs.has(kitBuff)) throw new Error(`${fx.id}: no kit buff ${kitBuff} in this team (efsim kit ${owner} lists its buffs)`);
  const ownRun = logBuffReplay(data, fx, undefined, { assume: { ...assume, "hidden-holds": "none" }, trace: [kitBuff] }).replay;
  const own = instancesOf(ownRun.traces, kitBuff);
  const check = instancesOf(logBuffReplay(data, fx, undefined, { ...(Object.keys(assume).length ? { assume } : {}), trace: [kitBuff] }).replay.traces, kitBuff);
  const logged = new Set(names.ofKitBuff.get(kitBuff) ?? []);
  const lanes = buffLanes(fx).filter((l) => logged.has(l.buff) && (l.source === null || l.source === owner));
  // The stops the replay applied (a hitless event it read as a buff's tick holds nothing: replayTimeStops).
  const stops = replayTimeStops(data, fx, undefined, ownRun);
  const { paired, unpaired } = pairInstances(own, check);
  const rows = own.map((i, n): ClockRow => {
    const next = own[n + 1]?.start ?? Infinity;
    // The lane this instance stands for: by its value where one matches, else listed from its start (less the log's
    // batching) before the next instance's (laneOfInstance).
    const found = laneOfInstance(lanes, i.start, next, i.values);
    const lane = found?.lane;
    const c = paired[n] ?? null;
    const late = lane && i.own !== null && Number.isFinite(i.own) ? { real: lane.lastListed - i.own, world: lane.lastListed >= i.own ? worldMs(i.own, lane.lastListed, stops) : -worldMs(lane.lastListed, i.own, stops) } : null;
    // Cut at the step that applied this one (the same frame): this one refreshed it.
    const replaced = own.find((o) => o.start < i.start && o.ended.how.startsWith("cut") && o.ended.at !== null && Math.abs(o.ended.at - i.start) <= 1000 / FPS);
    return { ...(replaced ? { replaces: replaced.start } : {}), start: i.start, first: i.first, own: i.own, ended: i.ended, check: c ? c.ended : null, ...(c ? { checkStart: c.start } : {}), lane: lane && found ? { buff: lane.buff, since: lane.since, firstListed: lane.firstListed, lastListed: lane.lastListed, nextUnlisted: lane.nextUnlisted, values: lane.values, byValue: found.byValue } : null, late, ...(i.values ? { values: i.values } : {}) };
  });
  // The check's instances with no own one near: a row of their own (no own clock, no lane read).
  return [...rows, ...unpaired.map((c): ClockRow => ({ start: c.start, first: null, own: null, ended: { at: null, how: "no instance on the own clock" }, check: c.ended, checkStart: c.start, lane: null, late: null }))].sort((a, b) => a.start - b.start);
}

const t = (ms: number | null) => (ms === null ? "-" : ms === Infinity ? "never" : s(ms));
const end = (e: ClockEnd | null) => (e === null ? "none" : `${t(e.at)} ${e.how}`);

/** `zmdlogs clock`: the rows of a kit buff in each log, then (several logs) the lateness's spread. */
export function clockView(data: GameData, logs: readonly DevFixture[], kitBuff: string, assume: Readonly<Record<string, string>> = {}): string {
  const owner = kitBuff.split(":")[0] as string;
  const out = [
    `${kitBuff} (${operatorLabel(data, owner)}): each instance's clock in the replay against the log (times in s). first: the expiry the replay first gave it; own: its expiry on the replay's own clock (hidden-holds=none: the replay's casts' stops, no hidden holds, no log ends) before a step shortened or removed it; ended: how it ended there; check: how it ended in the check's replay (its instance nearest the start within ${CHECK_PAIR_MS / 1000} s, "from" where its start differs: the check's hidden holds moved it)${Object.keys(assume).length ? ` (under ${Object.entries(assume).map(([k, v]) => `${k}=${v}`).join(", ")})` : ""}; log: its game buff's run (since, last listed, next unlisted hit; the run of the instance's value where one is, a refreshed run's since included: laneOfInstance); late: the last listed hit less own (world: stops out)`,
  ];
  const lates: number[] = [];
  let rows = 0;
  let unlisted = 0;
  for (const d of logs) {
    const r = kitBuffClock(data, d.fx, kitBuff, assume);
    if (!r.length) continue;
    out.push(`  ${d.short}: ${r.length} instance(s)`);
    for (const x of r) {
      rows++;
      if (!x.lane) unlisted++;
      if (x.late && x.lane?.nextUnlisted !== null) lates.push(x.late.world);
      const num = (v: number) => String(Number(v.toPrecision(6)));
      const value = !x.lane ? "" : x.lane.byValue === true ? ` (value ${x.lane.values.map(num).join(", ")}, the instance's)` : x.lane.byValue === false ? ` (value ${x.lane.values.map(num).join(", ")}, not the instance's ${(x.values ?? []).map(num).join(", ")}: another buff under this name?)` : "";
      const log = x.lane ? `log since ${t(x.lane.since)}, listed to ${t(x.lane.lastListed)}, next unlisted ${t(x.lane.nextUnlisted)}${value}` : "log: no run listed";
      const late = x.late ? `; late ${x.late.real >= 0 ? "+" : ""}${s(x.late.real)} (world ${x.late.world >= 0 ? "+" : ""}${s(x.late.world)})` : "";
      const chain = x.replaces !== undefined ? ` (refreshes the one from ${t(x.replaces)})` : "";
      // The check's instance start where it differs from the own clock's (its hidden holds moved it).
      const checkFrom = x.check && x.checkStart !== undefined && Math.abs(x.checkStart - x.start) > 1000 / FPS ? `from ${t(x.checkStart)}, ` : "";
      out.push(`    ${t(x.start).padStart(7)}${chain}  first ${t(x.first)}, own ${t(x.own)}, ended ${end(x.ended)}; check ${checkFrom}${end(x.check)}; ${log}${late}`);
    }
  }
  if (!rows) out.push("  no instance in these logs");
  const v = [...lates].sort((a, b) => a - b);
  const q = (p: number) => s(v[Math.floor(p * (v.length - 1))] as number);
  if (v.length > 1) {
    out.push(
      `late in world time, over ${v.length} instances with a logged end (a next unlisted hit): min ${q(0)}, quartiles ${q(0.25)} ${q(0.5)} ${q(0.75)}, max ${q(1)} s; listed past own: ${v.filter((x) => x > 0).length}, ended first in the log: ${v.filter((x) => x <= 0).length}${unlisted ? `; ${unlisted} instance(s) without a listed run` : ""}`,
    );
  }
  out.push("A last listed hit brackets the logged end from below (the next unlisted hit from above); the log's ms are batched, so under ~0.2 s isn't evidence (docs/design/data.md \"What the log records\").");
  return out.join("\n");
}
