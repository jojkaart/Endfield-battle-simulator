// `zmdlogs casts --event-lags` (round 22, the barrage-array report point 3): each operator's logged cast events against
// the placed starts of the casts they belong to (query.ts loggedSkillInstances), per skill kind: how late the log's
// event of a cast comes after its kit frame 0. The lag is a fact of the log (combos 0.3–0.7 s by operator, ultimates at
// their stop's end, docs/design/data.md "What the log records"), so a lead that compares a press's log time with a kit
// frame checks it here first: Typhoeus's Barrage Array's "first tick 0.5–0.7 s after the press" was her combo's usual
// lag (median 0.52 s over 23 combos), found by a scratch script per operator.

import { FPS, type GameData } from "@efsim/engine";
import { placeHits, worldMs } from "./logcasts.ts";
import type { DevFixture } from "./logs.ts";
import { loggedSkillInstances, replayTimeStops } from "./query.ts";
import { operatorLabel, secondsText as s } from "./labels.ts";

/** One cast's event lag (eventLags): its first logged cast event less its placed start, in log and world time (ms). */
export interface EventLag {
  readonly log: string;
  readonly operator: string;
  readonly skillId: string;
  readonly kind: string;
  readonly start: number;
  readonly lag: number;
  /** The lag with the time stops of the replay's casts out (replayTimeStops: the placement's list, the cast's own in it). */
  readonly worldLag: number;
  /**
   * Why the lag isn't the operator's plain one (null: it is): the event comes over EARLY_MS before the placed start
   * (an earlier press, or a cast placed late: fc63 57.48 s, its combo event at 55.10 s), or a teammate's stop runs
   * between the start and the event (a press in another's stop is logged at its end).
   */
  readonly odd: "event before the start" | "a teammate's stop between" | null;
}

/** Every placed cast's event lag in these logs (casts placed from hits that have a cast event), these operators only. */
export function eventLags(data: GameData, logs: readonly DevFixture[], opts: { readonly operators?: readonly string[] } = {}): EventLag[] {
  return logs.flatMap((d) => {
    const placement = placeHits(data, d.fx);
    const stops = replayTimeStops(data, d.fx, placement);
    return loggedSkillInstances(data, d.fx, { placement }).flatMap((i) => {
      const first = i.events[0];
      if (i.from !== "hits" || first === undefined || (opts.operators?.length && !opts.operators.includes(i.operator))) return [];
      const lag = first - i.start;
      const [a, b] = [Math.round((Math.min(i.start, first) * FPS) / 1000), Math.round((Math.max(i.start, first) * FPS) / 1000)];
      const odd = lag < -EARLY_MS ? "event before the start" : stops.some((st) => st.operator !== i.operator && st.start <= b && st.start + st.scales.length > a) ? "a teammate's stop between" : null;
      return [{ log: d.short, operator: i.operator, skillId: i.skillId, kind: i.kind ?? "other", start: i.start, lag, worldLag: lag >= 0 ? worldMs(i.start, first, stops) : -worldMs(first, i.start, stops), odd }];
    });
  });
}

/** An event this much before its placed start is an earlier press or a cast placed late, not its lag (a battle skill's event comes up to ~0.4 s before: Typhoeus's floating start). */
const EARLY_MS = 1000;

const quantile = (xs: readonly number[], q: number) => {
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.max(0, Math.round(q * (v.length - 1))))] as number;
};

/**
 * The table: per operator and skill kind, the count and, over the plain casts (EventLag.odd null), the lag's median,
 * 10–90% range and extremes (log time) and its median in world time; the odd ones counted by why.
 */
export function eventLagsView(data: GameData, logs: readonly DevFixture[], opts: { readonly operators?: readonly string[]; readonly verbose?: boolean } = {}): string {
  const lags = eventLags(data, logs, opts);
  const groups = new Map<string, EventLag[]>();
  for (const l of lags) groups.set(`${l.operator}|${l.kind}`, [...(groups.get(`${l.operator}|${l.kind}`) ?? []), l]);
  const signed = (ms: number) => `${ms >= 0 ? "+" : "−"}${s(Math.abs(ms))}`;
  const out = [
    `Cast events against their casts' placed starts (query.ts loggedSkillInstances: the first logged event of a cast placed from its hits, less its kit frame 0) over ${logs.length} log(s): per operator and skill kind, n, then over the plain casts (no teammate's stop between, the event not over 1 s before the start) the median, 10–90% and min–max of the lag in log time and its median with the replay's casts' stops out (world: a combo's or an ultimate's own stop is the lag); times in s. A press's log time compared with a kit frame is off by this much before anything is wrong.`,
  ];
  const rows = [...groups].sort(([a], [b]) => a.localeCompare(b));
  for (const [k, xs] of rows) {
    const [op, kind] = k.split("|") as [string, string];
    const plain = xs.filter((x) => x.odd === null);
    const v = plain.map((x) => x.lag);
    const odd = ["event before the start", "a teammate's stop between"].map((w) => [w, xs.filter((x) => x.odd === w).length] as const).filter(([, n]) => n > 0);
    const oddText = odd.length ? `; not counted: ${odd.map(([w, n]) => `${n} ${w}`).join(", ")}` : "";
    const stats = v.length ? `median ${signed(quantile(v, 0.5))}  10–90% ${signed(quantile(v, 0.1))}…${signed(quantile(v, 0.9))}  min–max ${signed(Math.min(...v))}…${signed(Math.max(...v))}  world median ${signed(quantile(plain.map((x) => x.worldLag), 0.5))}` : "no plain cast";
    out.push(`  ${`${operatorLabel(data, op)} ${kind}`.padEnd(28)} n=${String(xs.length).padStart(3)} (plain ${String(plain.length).padStart(3)})  ${stats}${oddText}`);
    if (opts.verbose) for (const x of xs.sort((a, b) => a.lag - b.lag)) out.push(`      ${x.log} ${s(x.start).padStart(7)} ${x.skillId.replace(/^chr_\d+_[a-z0-9]+_/, "")}: ${signed(x.lag)} (world ${signed(x.worldLag)})${x.odd ? ` [${x.odd}]` : ""}`);
  }
  if (!rows.length) out.push("  no placed cast with a logged event");
  return out.join("\n");
}
