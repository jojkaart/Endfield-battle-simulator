// `efsim zmdlogs clocks`: how late each clock of known pace runs across each kind of time stop (the enemy-clock report
// point 1: "every clock runs late across a combo's stop, on time across an ultimate's" took five scratch probes, one per
// clock, each rebuilding the same plumbing: the logs, the stops, worldMs by stop kind, the log's Stagger spans).
//
// A clock here is a stretch of a log whose world time is known without the replay's buffs:
// - tick: an enemy tick chain (holds.ts HOLD_SERIES: Combustion, Rossi's bleed, ...): consecutive ticks a period apart,
//   n periods of world time; a chain is cut where the log's Stagger starts or ends (query.ts loggedStaggerSpans), so a
//   row is all in the Stagger or all out of it;
// - cast: one placed cast's first and last logged landings outside every other operator's stop: their kit frames'
//   distance (the placement's PlacedHit.frame) of world time;
// - burst: a logged Arts Burst after its likely cause (burstsview.ts burstRows: a replay per log, so only with
//   `--clock burst`): the element's burst delay of world time.
// Each row: the clock's world time under the replay's casts' stops (query.ts replayTimeStops, the views' one list) less
// the time it should take (the residual: positive, the clock ran late, so something held it more than the stop list),
// and the time the stops inside hold, by the stops' kind and operator. Rows whose span a stop straddles (one that starts
// before it and ends inside, or the other way) are counted and left out: such a stop's time splits between neighbouring
// rows, which made per-pair numbers alternate ±0.2 s in d572 (the enemy-clock round). Chains are summed whole.
//
// The summary per clock kind and what holds inside (no stop, combos only, an ultimate, other stops only): rows, the
// residual's median, the held time's median and Σ residual ÷ Σ held (the share of the held time the clock runs late by);
// `by: "operator"` the same per combo operator over the rows with one operator's combos only.

import { FPS, type ArtsElement, type GameData } from "@efsim/engine";
import { burstRows } from "./burstsview.ts";
import { HOLD_SERIES } from "./holds.ts";
import { placeHits, worldMs, type LoggedCast } from "./logcasts.ts";
import { loggedStaggerSpans, operatorLabel, replayTimeStops, type ReplayTimeStop } from "./query.ts";
import type { LogFixture } from "./zmdlogs.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;
const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);
const s = (ms: number) => (ms / 1000).toFixed(2);

/** The clock kinds of `zmdlogs clocks` (`--clock`). */
export const CLOCK_KINDS = ["tick", "cast", "burst"] as const;
export type ClockKind = (typeof CLOCK_KINDS)[number];

/** What a row's stops are, for the summary: none inside, combos only, an ultimate (with or without others), other kinds only. */
export type HeldBy = "no stop" | "combos only" | "an ultimate" | "other stops only";

/** One clock of a log (times in ms). */
export interface PaceRow {
  readonly log: string;
  readonly kind: ClockKind;
  /** Whose clock: the tick series' event and applier, the cast's operator and skill, the burst's operator and element. */
  readonly what: string;
  readonly a: number;
  readonly b: number;
  /** How much world time it should take (n periods, the kit frames' distance, the burst delay). */
  readonly expected: number;
  /** Its world time under the stops counted (worldMs) less `expected`: positive when the clock ran late. */
  readonly residual: number;
  /** The time the stops counted inside hold (real less world), per stop kind ("other" for a stop of no known kind). */
  readonly held: Readonly<Record<string, number>>;
  /** The same per operator and kind ("<operator>|<kind>"). */
  readonly heldByOperator: Readonly<Record<string, number>>;
  /** All of it inside the log's Stagger (loggedStaggerSpans). */
  readonly staggered: boolean;
}

/** The rows of a log, and how many were left out because a stop straddles them. */
export interface LogPaces {
  readonly rows: readonly PaceRow[];
  readonly straddled: number;
}

const kindOf = (st: ReplayTimeStop) => st.kind ?? "other";

/** The time the stops inside [a, b] hold, per kind and per operator and kind; whether one straddles an end. */
function heldInside(a: number, b: number, stops: readonly ReplayTimeStop[]): { held: Record<string, number>; byOp: Record<string, number>; straddled: boolean } {
  const [fa, fb] = [frameOf(a), frameOf(b)];
  const inside = stops.filter((st) => st.start < fb && st.start + st.scales.length > fa && st.scales.some((x) => x < 1));
  const straddled = inside.some((st) => st.start < fa || st.start + st.scales.length > fb);
  const held: Record<string, number> = {};
  const byOp: Record<string, number> = {};
  for (const k of new Set(inside.map(kindOf))) held[k] = b - a - worldMs(a, b, inside.filter((st) => kindOf(st) === k));
  for (const key of new Set(inside.map((st) => `${st.operator}|${kindOf(st)}`))) byOp[key] = b - a - worldMs(a, b, inside.filter((st) => `${st.operator}|${kindOf(st)}` === key));
  return { held, byOp, straddled };
}

/** The clocks of one log (`kinds`: which; `assume`: the readings of the burst clock's replay). */
export function logClocks(data: GameData, log: { readonly short: string; readonly fx: LogFixture }, opts: { readonly kinds?: readonly ClockKind[]; readonly assume?: Readonly<Record<string, string>> } = {}): LogPaces {
  const { short, fx } = log;
  const kinds = new Set(opts.kinds ?? ["tick", "cast"]);
  const placement = placeHits(data, fx);
  const stops = replayTimeStops(data, fx, placement);
  const spans = loggedStaggerSpans(fx);
  const spanOf = (t: number) => spans.findIndex((x) => x.from <= t && t <= x.to);
  const rows: PaceRow[] = [];
  let straddled = 0;
  const add = (r: Omit<PaceRow, "log" | "residual" | "held" | "heldByOperator" | "staggered">, counted: readonly ReplayTimeStop[]) => {
    const h = heldInside(r.a, r.b, counted);
    if (h.straddled) {
      straddled++;
      return;
    }
    rows.push({ ...r, log: short, residual: worldMs(r.a, r.b, counted) - r.expected, held: h.held, heldByOperator: h.byOp, staggered: spanOf(r.a) >= 0 && spanOf(r.a) === spanOf(r.b) });
  };
  if (kinds.has("tick")) {
    // The enemy's clock: every stop counts (holds.ts tickBounds' chains, cut at the log's Stagger's edges).
    const series = new Map<string, number[]>();
    for (const h of fx.hits) if (HOLD_SERIES[h.event]) series.set(`${h.event}|${h.operator}|${h.target ?? ""}`, [...(series.get(`${h.event}|${h.operator}|${h.target ?? ""}`) ?? []), h.t]);
    for (const [k, ts0] of series) {
      const [event, op] = k.split("|") as [string, string];
      const { period } = HOLD_SERIES[event] as { period: number };
      const chains: number[][] = [];
      for (const t of [...new Set(ts0)].sort((x, y) => x - y)) {
        const c = chains.at(-1);
        const prev = c?.at(-1);
        if (c && prev !== undefined && t - prev >= 0.5 * period && t - prev <= period + 1500 && spanOf(t) === spanOf(prev)) c.push(t);
        else chains.push([t]);
      }
      for (const c of chains) if (c.length >= 2) add({ kind: "tick", what: `${event.replace(/^buff_/, "")} by ${operatorLabel(data, op)}`, a: c[0] as number, b: c.at(-1) as number, expected: (c.length - 1) * period }, stops);
    }
  }
  if (kinds.has("cast")) {
    // The operators' clocks: within a cast, its landings outside every other operator's stop (±2 frames), against the
    // kit frames' distance; the cast's own stops are in its frames, so only the others' count.
    const byCast = new Map<LoggedCast, { t: number; frame: number }[]>();
    for (const [h, p] of placement.hits) if (p.frame !== undefined && p.cast.kind !== null) byCast.set(p.cast, [...(byCast.get(p.cast) ?? []), { t: h.t, frame: p.frame }]);
    for (const [c, list] of byCast) {
      const others = stops.filter((st) => st.operator !== c.operator);
      const inStop = (t: number) => others.some((st) => frameOf(t) >= st.start - 2 && frameOf(t) < st.start + st.scales.length + 2);
      const ok = list.filter((x) => !inStop(x.t)).sort((x, y) => x.t - y.t);
      const [first, last] = [ok[0], ok.at(-1)];
      if (!first || !last || last.frame <= first.frame || last.t - first.t > 6000) continue;
      add({ kind: "cast", what: `${operatorLabel(data, c.operator)} ${c.skillId.replace(/^chr_\d+_[a-z0-9]+_/, "")}`, a: first.t, b: last.t, expected: msOf(last.frame - first.frame) }, others);
    }
  }
  if (kinds.has("burst")) {
    for (const r of burstRows(data, fx, opts.assume ? { assume: opts.assume } : {})) {
      const c = r.logged?.cause;
      if (!r.logged || !c) continue;
      const delay = msOf(data.constants.burstDelayFrames?.[r.element as ArtsElement] ?? 0);
      add({ kind: "burst", what: `${operatorLabel(data, r.operator)} ${r.element} burst`, a: c.t, b: r.logged.t, expected: delay }, stops.filter((st) => st.operator !== r.operator));
    }
  }
  return { rows, straddled };
}

/** What holds a row inside (HeldBy). */
export function heldBy(r: Pick<PaceRow, "held">): HeldBy {
  const ks = Object.keys(r.held).filter((k) => (r.held[k] ?? 0) > 0);
  if (!ks.length) return "no stop";
  if (ks.includes("ultimate")) return "an ultimate";
  return ks.every((k) => k === "combo") ? "combos only" : "other stops only";
}

const total = (r: Pick<PaceRow, "held">) => Object.values(r.held).reduce((x, y) => x + y, 0);
const median = (xs: readonly number[]) => (xs.length ? ([...xs].sort((x, y) => x - y)[Math.floor((xs.length - 1) / 2)] as number) : NaN);

/**
 * How far off (ms) a row's residual may be and count in a summary's sums: a cast whose landings the placement put in
 * another cast, a burst on an older cause, are seconds off and would swamp the sums (the enemy-clock probes trimmed at
 * the same 0.4 s). The medians take every row.
 */
export const PACE_TRIM_MS = 400;

/** One summary line over some rows: count, the residual's median, the held time's median, Σ residual ÷ Σ held over the rows within PACE_TRIM_MS. */
function summaryLine(label: string, rows: readonly PaceRow[]): string {
  const kept = rows.filter((r) => Math.abs(r.residual) < PACE_TRIM_MS);
  const held = kept.reduce((x, r) => x + total(r), 0);
  const res = kept.reduce((x, r) => x + r.residual, 0);
  const out = rows.length - kept.length;
  return `  ${label.padEnd(34)} ${String(rows.length).padStart(5)} rows  residual median ${median(rows.map((r) => r.residual)).toFixed(0).padStart(5)} ms  held median ${median(rows.map(total)).toFixed(0).padStart(5)} ms  Σ residual ${s(res)} s${held > 0 ? ` = ${(res / held).toFixed(2)} × Σ held ${s(held)} s` : ""}${out ? ` (${out} row(s) off by ${PACE_TRIM_MS / 1000} s or more not summed)` : ""}`;
}

/** A row in full (`rows`). */
function rowLine(data: GameData, r: PaceRow): string {
  const by = Object.entries(r.heldByOperator).map(([k, v]) => {
    const [op, kind] = k.split("|") as [string, string];
    return `${operatorLabel(data, op)} ${kind} ${s(v)}`;
  });
  return `  ${r.log} ${r.kind} ${r.what} ${s(r.a)}⇒${s(r.b)}: expected ${s(r.expected)}, residual ${r.residual >= 0 ? "+" : ""}${s(r.residual)} s; held ${by.length ? by.join(", ") : "nothing"}${r.staggered ? " [in the log's Stagger]" : ""}`;
}

/**
 * `efsim zmdlogs clocks <fixture…|--all>`: every clock of the logs (logClocks) summed by clock kind and what holds it
 * (`by` "operator": per combo operator too), the tick chains also split by the log's Stagger; `rows`: each row.
 */
export function clocksView(data: GameData, logs: readonly { readonly short: string; readonly fx: LogFixture }[], opts: { readonly kinds?: readonly ClockKind[]; readonly by?: "kind" | "operator"; readonly rows?: boolean; readonly assume?: Readonly<Record<string, string>>; readonly progress?: (line: string) => void } = {}): string {
  const kinds = opts.kinds ?? ["tick", "cast"];
  const all: PaceRow[] = [];
  let straddled = 0;
  for (const log of logs) {
    opts.progress?.(`clocks ${log.short}`);
    const got = logClocks(data, log, { kinds, ...(opts.assume && Object.keys(opts.assume).length ? { assume: opts.assume } : {}) });
    all.push(...got.rows);
    straddled += got.straddled;
  }
  const out = [
    `How late each clock runs across the time stops inside it (clocksview.ts; ${kinds.join(", ")}; ${logs.length} logs): residual = its world time under the replay's casts' stops (replayTimeStops; tick: every stop, cast and burst: other operators') less what it should take; held = real less world time of the stops inside; the sums leave out rows off by ${PACE_TRIM_MS / 1000} s or more. ${straddled} row(s) left out: a stop straddles an end (its time would split between rows).`,
  ];
  const groups: HeldBy[] = ["no stop", "combos only", "an ultimate", "other stops only"];
  for (const k of kinds) {
    const mine = all.filter((r) => r.kind === k);
    out.push("", `${k} (${mine.length} rows):`);
    for (const g of groups) {
      const sel = mine.filter((r) => heldBy(r) === g);
      if (!sel.length) continue;
      out.push(summaryLine(g, sel));
      if (k === "tick") for (const [label, st] of [["  in the log's Stagger", true], ["  outside it", false]] as const) if (sel.some((r) => r.staggered === st)) out.push(summaryLine(label, sel.filter((r) => r.staggered === st)));
    }
    if (opts.by === "operator") {
      const byOp = new Map<string, PaceRow[]>();
      for (const r of mine) {
        const ops = Object.keys(r.heldByOperator).filter((x) => x.endsWith("|combo"));
        if (heldBy(r) !== "combos only" || ops.length !== 1) continue;
        const op = (ops[0] as string).split("|")[0] as string;
        byOp.set(op, [...(byOp.get(op) ?? []), r]);
      }
      if (byOp.size) out.push("  one operator's combos only:");
      // Two ids of one name (the Endministrator's) apart by id.
      const names = [...byOp.keys()].map((op) => operatorLabel(data, op));
      const named = (op: string) => (names.filter((n) => n === operatorLabel(data, op)).length > 1 ? `${operatorLabel(data, op)} (${op})` : operatorLabel(data, op));
      for (const [op, rs] of [...byOp].sort((x, y) => y[1].length - x[1].length)) out.push(summaryLine(`  ${named(op)}`, rs));
    }
  }
  if (opts.rows) out.push("", "Each row (times in s):", ...all.map((r) => rowLine(data, r)));
  return out.join("\n");
}
