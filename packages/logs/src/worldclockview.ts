// `zmdlogs worldtime` with the replay's clock (round 22, the barrage-array report point 1): the world's time between
// two log moments with each thing that holds a clock taken out in turn (the placement's stop list or the timeline's
// applied slow-downs, an operator's own stops left in, the hidden holds), and a tick series' chains against their
// period on that clock (`--series`). The Barrage Array question ("does this entity's channel fit its 180 frames on
// some clock?") took two scratch scripts before; Tangtang's stare, Pogranichnik's harasses and Zhuang Fangyi's
// Sunderblades ask the same.

import { FPS, type GameData } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import { tickChains } from "./holds.ts";
import { worldMs, type TimeStop } from "./logcasts.ts";
import { heldWorldMs, holdsMs, replayClockStops, replayHolds } from "./replayclock.ts";
import { operatorLabel, secondsText as s } from "./labels.ts";
import type { LogFixture } from "./zmdlogs.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;

/** The replay parts a clock reads. */
export type ClockReplay = Pick<BuffReplay, "appliedStops" | "hiddenHolds">;

/**
 * The lines `worldtime <fixture> <a> <b> --holds / --without <op>` adds: per stop source (the placement's list, the
 * timeline's applied slow-downs), the world with every stop out, with `without`'s own left in, and with every stop and
 * the hidden holds out (the engine adds a hold to any stop: replayclock.ts heldWorldMs).
 */
export function worldClockLines(data: GameData, from: number, to: number, list: readonly TimeStop[], replay: ClockReplay, opts: { readonly without?: string; readonly holds?: boolean }): string[] {
  const holds = opts.holds ? replayHolds(replay) : [];
  const own = opts.without;
  const sources: [string, readonly TimeStop[], readonly TimeStop[]][] = [
    ["the placement's stop list (the views')", list, own !== undefined ? list.filter((st) => st.operator !== own) : list],
    ["the timeline's applied slow-downs (breaks' holds too)", replayClockStops(replay), replayClockStops(replay, own !== undefined ? { without: own } : {})],
  ];
  const cols = ["every stop out", ...(own !== undefined ? [`${operatorLabel(data, own)}'s own left in`] : []), ...(opts.holds ? ["every stop and the hidden holds out"] : [])];
  const out = [`World time (s) between ${s(from)} and ${s(to)} by what is taken out (${cols.join(" | ")}); the hidden holds there: ${opts.holds ? `${s(holdsMs(holds, from, to))} s` : "not asked (--holds)"}${replay.hiddenHolds ? "" : " (this replay placed none)"}:`];
  for (const [name, all, kept] of sources) {
    const xs = [worldMs(from, to, all), ...(own !== undefined ? [worldMs(from, to, kept)] : []), ...(opts.holds ? [heldWorldMs(from, to, all, holds)] : [])];
    out.push(`  ${name}: ${xs.map((x) => s(x)).join(" | ")}`);
  }
  return out;
}

/**
 * `zmdlogs worldtime <fixture> --series <regex>`: each chain of a tick series (holds.ts tickChains: HOLD_SERIES' events,
 * or `period` for any event the log records as hits) with its log span, its world span with the timeline's applied
 * slow-downs out, with the series operator's own stops left in, and with every stop and the hidden holds out, against
 * the period's expectation ((ticks − 1) × period) and the residual on the last clock. A chain's residual near 0 on some
 * clock says which holds hold it.
 */
export function seriesClockView(data: GameData, fx: LogFixture, replay: ClockReplay, opts: { readonly event: RegExp; readonly period?: number; readonly gap?: number; readonly operators?: readonly string[] }): string {
  const events = [...new Set(fx.hits.map((h) => h.event))].filter((e) => opts.event.test(e));
  const periods = opts.period !== undefined ? Object.fromEntries(events.map((e) => [e, opts.period as number])) : undefined;
  const series = tickChains(fx, { ...(periods ? { periods } : {}), ...(opts.gap !== undefined ? { gap: opts.gap } : {}) }).filter((x) => opts.event.test(x.event) && (!opts.operators?.length || opts.operators.includes(x.operator)));
  if (!series.length) {
    const why = opts.period === undefined ? "a tick series of holds.ts HOLD_SERIES (others: --period <ms>)" : `an event logged as hits (${events.length} match)`;
    throw new Error(`zmdlogs worldtime --series /${opts.event.source}/: no ${why} in ${fx.id}`);
  }
  const holds = replayHolds(replay);
  const all = replayClockStops(replay);
  const out = [
    `${fx.id}: tick chains of /${opts.event.source}/ (a tick half a period to a period + ${s(opts.gap ?? 1500)} s of log time after the last; holds.ts tickChains) on the replay's clock: log span, world spans with the timeline's applied slow-downs out (every stop | the series operator's own left in | every stop and the hidden holds), the period's expectation and the residual on the last; times in s${replay.hiddenHolds ? "" : "; this replay placed no hidden holds"}`,
  ];
  for (const x of series) {
    const kept = replayClockStops(replay, { without: x.operator });
    out.push(`${x.event} by ${operatorLabel(data, x.operator)}${x.target ? ` on ${x.target}` : ""} (period ${s(x.period)} s):`);
    for (const c of x.chains) {
      const [a, b] = [c[0] as number, c.at(-1) as number];
      if (c.length < 2) {
        out.push(`  ${s(a).padStart(7)}  1 tick`);
        continue;
      }
      const expected = (c.length - 1) * x.period;
      const [w, wOwn, wHeld] = [worldMs(a, b, all), worldMs(a, b, kept), heldWorldMs(a, b, all, holds)];
      out.push(`  ${s(a).padStart(7)}–${s(b).padEnd(7)} ${String(c.length).padStart(3)} ticks  log ${s(b - a)}  world ${s(w)} | ${s(wOwn)} | ${s(wHeld)}  expected ${s(expected)}  residual ${wHeld - expected >= 0 ? "+" : ""}${s(wHeld - expected)}`);
    }
  }
  out.push(`A stop's frames at 30 a second (${s(msOf(1))} s each); the log's ms are batched (docs/design/data.md "What the log records"), so under ~0.2 s isn't evidence. Which clock each hold holds: docs/design/timeline.md "Which clock each hold holds".`);
  return out.join("\n");
}
