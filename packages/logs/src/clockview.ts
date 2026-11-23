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
// and start).

import { FPS, type GameData } from "@efsim/engine";
import { teamBuffNames } from "./enginecheck.ts";
import { logBuffReplay } from "./logcheck.ts";
import { worldMs } from "./logcasts.ts";
import type { DevFixture } from "./logs.ts";
import { buffLanes, operatorLabel, replayTimeStops, type BuffLane } from "./query.ts";
import type { BuffTrace } from "./buffreplay.ts";
import type { LogFixture } from "./zmdlogs.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;
const s = (ms: number) => (ms / 1000).toFixed(2);

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
  /** In the replay the check uses (the default readings or the ones given); null: no instance there at this start. */
  readonly check: ClockEnd | null;
  /** The log's run of its game buff this instance stands for (null: none listed from near its start). */
  readonly lane: Pick<BuffLane, "buff" | "since" | "firstListed" | "lastListed" | "nextUnlisted"> | null;
  /** The last listed hit less `own`, real and world time (ms; null without a lane or an own expiry). */
  readonly late: { readonly real: number; readonly world: number } | null;
}

interface Instance {
  readonly start: number;
  readonly first: number | null;
  readonly own: number | null;
  readonly ended: ClockEnd;
}

/** A replay's instances of a traced buff from its traces (frames → ms). */
function instancesOf(traces: readonly BuffTrace[], buff: string): Instance[] {
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
      return { start: msOf(at), first: ms(first), own: ms(own), ended };
    });
}

/** The rows of `kitBuff` (owner:id) in one log; `assume` the readings of the check's replay (its own clock always under hidden-holds=none on top). */
export function kitBuffClock(data: GameData, fx: LogFixture, kitBuff: string, assume: Readonly<Record<string, string>> = {}): ClockRow[] {
  const owner = kitBuff.split(":")[0] as string;
  const names = teamBuffNames(data, fx);
  if (!names.defs.has(kitBuff)) throw new Error(`${fx.id}: no kit buff ${kitBuff} in this team (efsim kit ${owner} lists its buffs)`);
  const own = instancesOf(logBuffReplay(data, fx, undefined, { assume: { ...assume, "hidden-holds": "none" }, trace: [kitBuff] }).replay.traces, kitBuff);
  const check = instancesOf(logBuffReplay(data, fx, undefined, { ...(Object.keys(assume).length ? { assume } : {}), trace: [kitBuff] }).replay.traces, kitBuff);
  const logged = new Set(names.ofKitBuff.get(kitBuff) ?? []);
  const lanes = buffLanes(fx).filter((l) => logged.has(l.buff) && (l.source === null || l.source === owner));
  const stops = replayTimeStops(data, fx);
  return own.map((i, n) => {
    const next = own[n + 1]?.start ?? Infinity;
    // The lane this instance stands for: listed from its start (less the log's batching) before the next instance's.
    const lane = lanes.filter((l) => (l.since ?? l.firstListed) >= i.start - 300 && (l.since ?? l.firstListed) < next - 300).sort((a, b) => (a.since ?? a.firstListed) - (b.since ?? b.firstListed))[0];
    const c = check.find((x) => x.start === i.start) ?? null;
    const late = lane && i.own !== null && Number.isFinite(i.own) ? { real: lane.lastListed - i.own, world: lane.lastListed >= i.own ? worldMs(i.own, lane.lastListed, stops) : -worldMs(lane.lastListed, i.own, stops) } : null;
    return { start: i.start, first: i.first, own: i.own, ended: i.ended, check: c ? c.ended : null, lane: lane ? { buff: lane.buff, since: lane.since, firstListed: lane.firstListed, lastListed: lane.lastListed, nextUnlisted: lane.nextUnlisted } : null, late };
  });
}

const t = (ms: number | null) => (ms === null ? "-" : ms === Infinity ? "never" : s(ms));
const end = (e: ClockEnd | null) => (e === null ? "none" : `${t(e.at)} ${e.how}`);

/** `zmdlogs clock`: the rows of a kit buff in each log, then (several logs) the lateness's spread. */
export function clockView(data: GameData, logs: readonly DevFixture[], kitBuff: string, assume: Readonly<Record<string, string>> = {}): string {
  const owner = kitBuff.split(":")[0] as string;
  const out = [
    `${kitBuff} (${operatorLabel(data, owner)}): each instance's clock in the replay against the log (times in s). first: the expiry the replay first gave it; own: its expiry on the replay's own clock (hidden-holds=none: the replay's casts' stops, no hidden holds, no log ends) before a step shortened or removed it; ended: how it ended there; check: how it ended in the check's replay${Object.keys(assume).length ? ` (under ${Object.entries(assume).map(([k, v]) => `${k}=${v}`).join(", ")})` : ""}; log: its game buff's run (since, last listed, next unlisted hit); late: the last listed hit less own (world: stops out)`,
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
      const log = x.lane ? `log since ${t(x.lane.since)}, listed to ${t(x.lane.lastListed)}, next unlisted ${t(x.lane.nextUnlisted)}` : "log: no run listed";
      const late = x.late ? `; late ${x.late.real >= 0 ? "+" : ""}${s(x.late.real)} (world ${x.late.world >= 0 ? "+" : ""}${s(x.late.world)})` : "";
      out.push(`    ${t(x.start).padStart(7)}  first ${t(x.first)}, own ${t(x.own)}, ended ${end(x.ended)}; check ${end(x.check)}; ${log}${late}`);
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
