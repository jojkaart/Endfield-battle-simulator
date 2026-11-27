// `efsim zmdlogs followups <fixture…|--all> --operator <op> [--trigger <id>]`: a kit trigger's own landings (its `hits`
// actions: an entity's follow-ups, Pogranichnik's harasses, Camille's explosion, Typhoeus's bursts, Arcane's lasers)
// against the events that fired them and the logged hits they stand for (round 19, the Camille report point 1: the
// harass question "how long after its status or slash does each harass land, in the log and in the replay" took a
// regex over `zmdlogs replay`'s LAND lines and a second script, per kit variant and log). From the replay's record of
// each triggered landing's firing (LandedHit.fired: the trigger, its event's frame and kind) and its pairing with the
// log (landingsOf): per landing the event and its frame, the landing's delay after it, the logged hit it stands for and
// the log's own delay after the event's logged hit; the trigger's logged hits no landing stands for, with the nearest
// landing; per trigger the counts and medians. Takes --assume and --kit like every replaying view.

import type { GameData, LandedHit } from "@efsim/engine";
import { FPS } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import { landingsOf } from "./decisionsview.ts";
import { operatorLabel, secondsText as s, shortSkill } from "./labels.ts";
import { logBuffReplay } from "./logcheck.ts";
import type { DevFixture } from "./logs.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;

/** How far (ms) a trigger's logged hit no landing stands for looks for the nearest landing of its trigger (followUps). */
export const FOLLOWUP_NEAR_MS = 3000;

/** One triggered landing (followUps): times in ms. */
export interface FollowUp {
  readonly trigger: string;
  readonly operator: string;
  readonly hitId: string;
  /** The landing's time, the firing event's time and what it was (TriggerFiring). */
  readonly t: number;
  readonly firedAt: number;
  readonly event: string;
  /** The logged hit it stands for (null: replay only), and the logged hit of the firing event (null: none, or not a hit's). */
  readonly logged: Pick<LogHit, "t" | "event" | "value"> | null;
  readonly loggedEvent: number | null;
  readonly damage: number;
}

/** A logged hit of a triggered kit hit's events no landing stands for (followUps), with the nearest replay-only landing of that kit hit (any of its triggers). */
export interface LogOnlyFollowUp {
  readonly hitId: string;
  readonly hit: Pick<LogHit, "t" | "event" | "value">;
  readonly nearest: { readonly t: number; readonly trigger: string } | null;
}

/** The triggered landings of `operator` (and their trigger `trigger`, a regex on its id) in one replay, and the trigger's log-only hits. */
export function followUps(data: GameData, fx: LogFixture, operator: string, opts: { readonly trigger?: RegExp; readonly assume?: Readonly<Record<string, string>>; readonly replay?: BuffReplay } = {}): { readonly landings: FollowUp[]; readonly logOnly: LogOnlyFollowUp[] } {
  const replay = opts.replay ?? logBuffReplay(data, fx, undefined, opts.assume && Object.keys(opts.assume).length ? { assume: opts.assume } : {}).replay;
  const { byLanding, missing } = landingsOf(replay, fx);
  const mine = replay.hits.filter((l): l is LandedHit & { fired: NonNullable<LandedHit["fired"]> } => l.operator === operator && l.fired !== undefined && (!opts.trigger || opts.trigger.test(l.fired.trigger)));
  // The firing event's own landing (a hit event: the landing at its frame of its operator's skill), and its logged hit.
  const eventLanding = (l: (typeof mine)[number]): LandedHit | undefined => {
    const m = /^hit (\S+) (\S+)$/.exec(l.fired.event);
    return m ? replay.hits.find((x) => x.frame === l.fired.frame && x.operator === m[1] && x.skillId === m[2] && byLanding.has(x)) : undefined;
  };
  const landings: FollowUp[] = mine.map((l) => {
    const h = byLanding.get(l);
    const ev = eventLanding(l);
    return {
      trigger: l.fired.trigger,
      operator: l.operator,
      hitId: l.hitId,
      t: msOf(l.frame),
      firedAt: msOf(l.fired.frame),
      event: l.fired.event,
      logged: h ? { t: h.t, event: h.event, value: h.value } : null,
      loggedEvent: ev ? (byLanding.get(ev) as LogHit).t : null,
      damage: l.damage,
    };
  });
  // A kit hit's logged events: those its paired landings (any of its triggers') stand for; its log-only hits are the
  // unpaired logged hits of them (Pogranichnik's Decisive Assault from his combo or a teammate's status: one event).
  const eventsOf = new Map<string, Set<string>>();
  for (const x of landings) if (x.logged) eventsOf.set(x.hitId, new Set([...(eventsOf.get(x.hitId) ?? []), x.logged.event]));
  const logOnly: LogOnlyFollowUp[] = [];
  for (const h of missing.keys()) {
    if (h.operator !== operator) continue;
    for (const [hitId, events] of eventsOf) {
      if (!events.has(h.event)) continue;
      const near = landings.filter((x) => x.hitId === hitId && !x.logged && Math.abs(x.t - h.t) <= FOLLOWUP_NEAR_MS).sort((a, b) => Math.abs(a.t - h.t) - Math.abs(b.t - h.t))[0];
      logOnly.push({ hitId, hit: { t: h.t, event: h.event, value: h.value }, nearest: near ? { t: near.t, trigger: near.trigger } : null });
    }
  }
  return { landings, logOnly: logOnly.sort((a, b) => a.hit.t - b.hit.t) };
}

const median = (xs: readonly number[]): number | null => {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.floor((v.length - 1) / 2)] as number;
};
const signed = (ms: number) => `${ms >= 0 ? "+" : ""}${s(ms)}`;

/** `zmdlogs followups`: per log each triggered landing's line, its trigger's log-only hits, then per trigger the counts and medians over the logs. */
export function followUpsView(data: GameData, logs: readonly DevFixture[], operator: string, opts: { readonly trigger?: RegExp; readonly assume?: Readonly<Record<string, string>>; readonly progress?: (line: string) => void } = {}): string {
  const who = operatorLabel(data, operator);
  const out = [
    `${who}'s kit triggers' own landings${opts.trigger ? ` (triggers matching /${opts.trigger.source}/)` : ""} against the events that fired them (LandedHit.fired) and the logged hits they stand for (the replay's pairing); times in s. A line: the landing, its delay after its event (the event and its time), the logged hit (Δ logged − replay) and the log's delay after the event's own logged hit; LOGONLY a hit of a trigger's logged events no landing stands for, with the nearest replay-only landing of it within ${FOLLOWUP_NEAR_MS / 1000} s.`,
  ];
  const all = new Map<string, { n: number; paired: number; replayOnly: number; d: number[]; delay: number[]; logDelay: number[] }>();
  const logOnlyBy = new Map<string, number>();
  for (const d of logs) {
    if (!d.fx.team.some((b) => b.operator === operator)) continue;
    opts.progress?.(`followups ${d.short}`);
    const { landings, logOnly } = followUps(data, d.fx, operator, opts);
    if (!landings.length && !logOnly.length) continue;
    out.push("", `${d.short}:`);
    const rows = [
      ...landings.map((x) => {
        const a = all.get(x.trigger) ?? { n: 0, paired: 0, replayOnly: 0, d: [], delay: [], logDelay: [] };
        all.set(x.trigger, a);
        a.n++;
        a.delay.push(x.t - x.firedAt);
        if (x.logged) {
          a.paired++;
          a.d.push(x.logged.t - x.t);
          if (x.loggedEvent !== null) a.logDelay.push(x.logged.t - x.loggedEvent);
        } else a.replayOnly++;
        const logged = x.logged ? `= logged ${shortSkill(x.logged.event)} ${x.logged.value} at ${s(x.logged.t)} (Δ ${signed(x.logged.t - x.t)} s${x.loggedEvent !== null ? `; log ${signed(x.logged.t - x.loggedEvent)} s after the event's logged hit at ${s(x.loggedEvent)}` : ""})` : "replay only";
        return { t: x.t, text: `  ${s(x.t).padStart(7)}  ${x.trigger} ${x.hitId} ${x.damage}: ${signed(x.t - x.firedAt)} s after ${x.event} at ${s(x.firedAt)} ${logged}` };
      }),
      ...logOnly.map((x) => {
        logOnlyBy.set(x.hitId, (logOnlyBy.get(x.hitId) ?? 0) + 1);
        return { t: x.hit.t, text: `  ${s(x.hit.t).padStart(7)}  LOGONLY ${x.hitId}: logged ${shortSkill(x.hit.event)} ${x.hit.value}${x.nearest !== null ? `, nearest replay-only landing ${x.nearest.trigger} at ${s(x.nearest.t)} (${signed(x.hit.t - x.nearest.t)} s)` : ", no replay-only landing near"}` };
      }),
    ].sort((p, q) => p.t - q.t);
    out.push(...rows.map((r) => r.text));
  }
  const fmt = (x: number | null) => (x === null ? "-" : `${signed(x)} s`);
  out.push("", `Per trigger over the logs: landings, paired, replay only; medians of the replay's delay after the event, of Δ logged − replay, of |Δ|, and of the log's delay after the event's logged hit:`);
  for (const [t, a] of [...all].sort((x, y) => y[1].n - x[1].n))
    out.push(`  ${t}: ${a.n} landing(s), ${a.paired} paired, ${a.replayOnly} replay only; delay ${fmt(median(a.delay))}, Δ ${fmt(median(a.d))}, |Δ| ${((m) => (m === null ? "-" : `${s(m)} s`))(median(a.d.map(Math.abs)))}, log delay ${fmt(median(a.logDelay))}`);
  if (!all.size) out.push(`  none: no landing of ${who}'s triggers in these logs`);
  if (logOnlyBy.size) out.push(`Log only, by kit hit: ${[...logOnlyBy].map(([h, n]) => `${h} ${n}`).join(", ")}`);
  return out.join("\n");
}
