// `zmdlogs casts --event-lags` (round 22, the barrage-array report point 3): each operator's logged cast events against
// the placed starts of the casts they belong to (query.ts loggedSkillInstances), per skill kind: how late the log's
// event of a cast comes after its kit frame 0. The lag is a fact of the log (combos 0.3–0.7 s by operator, ultimates at
// their stop's end, docs/design/data.md "What the log records"), so a lead that compares a press's log time with a kit
// frame checks it here first: Typhoeus's Barrage Array's "first tick 0.5–0.7 s after the press" was her combo's usual
// lag (median 0.52 s over 23 combos), found by a scratch script per operator.

import { FPS, type GameData } from "@efsim/engine";
import { heldStart, placeHits, worldMs } from "./logcasts.ts";
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

/**
 * One cast's event against the start its first landing gives under two hold readings (eventsAgainstHolds): unheld by
 * the teammates' stops before that landing (the placement's plain start: landing less its kit frame) and held by them
 * (logcasts.ts heldStart, the lowest scale where they overlap); the event's world lag from each (ms), and the stops.
 */
export interface EventAgainstHolds {
  readonly log: string;
  readonly operator: string;
  readonly skillId: string;
  readonly kind: string;
  readonly event: number;
  readonly unheld: { readonly start: number; readonly lag: number };
  readonly held: { readonly start: number; readonly lag: number };
  /** The teammates' stops between the held start and the first landing: operator, kind, from and to (ms). */
  readonly between: readonly { readonly operator: string; readonly kind: string; readonly from: number; readonly to: number }[];
}

/**
 * `zmdlogs casts --event-lags --against-holds` (round 24, the overlap-clock report point 3: whether the first combo's
 * caster is held by the second's slow-down took a probe, scripts/probes/combo-hold/overlap-events.ts): the cast event
 * is stamped on the world's clock, whatever holds the operator, so its world lag from the right start is the
 * operator's plain one; per cast with a logged event whose first landing has at least 2 frames of teammates' stops
 * before it, the lag from the start unheld and held by them. A landing pair can't tell the two (both sides come after
 * the stops); the event can.
 */
export function eventsAgainstHolds(data: GameData, logs: readonly DevFixture[], opts: { readonly operators?: readonly string[] } = {}): EventAgainstHolds[] {
  const fr = (t: number) => Math.round((t * FPS) / 1000);
  const msOf = (f: number) => (f * 1000) / FPS;
  return logs.flatMap((d) => {
    const placement = placeHits(data, d.fx);
    const stops = replayTimeStops(data, d.fx, placement);
    const firstLanding = new Map<object, { t: number; frame: number }>();
    for (const [h, p] of placement.hits) {
      if (p.frame === undefined) continue;
      const cur = firstLanding.get(p.cast);
      if (!cur || h.t < cur.t) firstLanding.set(p.cast, { t: h.t, frame: p.frame });
    }
    return loggedSkillInstances(data, d.fx, { placement }).flatMap((i) => {
      if (i.from !== "hits" || i.events[0] === undefined || (opts.operators?.length && !opts.operators.includes(i.operator))) return [];
      const cast = [...firstLanding.keys()].find((c) => (c as { operator: string }).operator === i.operator && Math.abs((c as { start: number }).start - i.start) < 40);
      const first = cast ? firstLanding.get(cast) : undefined;
      if (!first) return [];
      const e = i.events[0];
      const others = stops.filter((st) => st.operator !== i.operator);
      const plain = first.t - msOf(first.frame);
      const held = heldStart(first.t, first.frame, others);
      if (plain - held < msOf(2)) return [];
      const [a, b] = [fr(held), fr(first.t)];
      const lag = (start: number) => (e >= start ? worldMs(start, e, stops) : -worldMs(e, start, stops));
      const between = others.filter((st) => st.start < b && st.start + st.scales.length > a).map((st) => ({ operator: st.operator, kind: st.kind ?? "other", from: msOf(st.start), to: msOf(st.start + st.scales.length) }));
      return [{ log: d.short, operator: i.operator, skillId: i.skillId, kind: i.kind ?? "other", event: e, unheld: { start: plain, lag: lag(plain) }, held: { start: held, lag: lag(held) }, between }];
    });
  });
}

/** The table of eventsAgainstHolds: per operator and skill kind, n, each reading's median world lag and how many within 0.1 / 0.25 s; per cast with `verbose`. */
export function eventsAgainstHoldsView(data: GameData, logs: readonly DevFixture[], opts: { readonly operators?: readonly string[]; readonly verbose?: boolean } = {}): string {
  const rows = eventsAgainstHolds(data, logs, opts);
  const signed = (ms: number) => `${ms >= 0 ? "+" : "−"}${s(Math.abs(ms))}`;
  const near = (xs: readonly number[], lim: number) => xs.filter((x) => Math.abs(x) < lim).length;
  const line = (label: string, xs: readonly EventAgainstHolds[]) => {
    const [u, h] = [xs.map((x) => x.unheld.lag), xs.map((x) => x.held.lag)];
    return `  ${label.padEnd(28)} n=${String(xs.length).padStart(3)}  world lag median: unheld ${signed(quantile(u, 0.5))}, held ${signed(quantile(h, 0.5))}  within 0.1 s: ${near(u, 100)} / ${near(h, 100)}  within 0.25 s: ${near(u, 250)} / ${near(h, 250)}`;
  };
  const out = [
    `Cast events against the start each cast's first landing gives, unheld and held by the teammates' stops before it (logcasts.ts heldStart; the event is on the world's clock, so the right start gives the operator's plain world lag: a combo about +0.05 s, \`--event-lags\`), over ${logs.length} log(s), the casts with at least 2 frames of such stops; times in s.`,
    rows.length ? line("every cast", rows) : "  no cast with a logged event and a teammate's stop before its first landing",
  ];
  const groups = new Map<string, EventAgainstHolds[]>();
  for (const r of rows) groups.set(`${r.operator}|${r.kind}`, [...(groups.get(`${r.operator}|${r.kind}`) ?? []), r]);
  for (const [k, xs] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const [op, kind] = k.split("|") as [string, string];
    out.push(line(`${operatorLabel(data, op)} ${kind}`, xs));
    if (opts.verbose) for (const x of xs) out.push(`      ${x.log} event ${s(x.event)} ${x.skillId.replace(/^chr_\d+_[a-z0-9]+_/, "")}: start unheld ${s(x.unheld.start)} (${signed(x.unheld.lag)}), held ${s(x.held.start)} (${signed(x.held.lag)}); stops ${x.between.map((b) => `${operatorLabel(data, b.operator)} ${b.kind} ${s(b.from)}–${s(b.to)}`).join(", ")}`);
  }
  return out.join("\n");
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
