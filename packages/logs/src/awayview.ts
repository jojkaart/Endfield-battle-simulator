// `efsim zmdlogs away`: what happens in a fight's away stretches (round 17, the away-statuses report point 1: "does the
// world stop in this stretch?" took a scratch probe in two drafts, now this view, pairing the stretches, an
// enginecheck.ts notion, with the hold placement's clocks, a holds.ts one). Per away stretch (no logged hit for
// ENEMY_AWAY_MS or more: enginecheck.ts awayWindows): its length; the clocks of the placement whose log run is listed on
// both sides of it (team and enemy, every kind), each with its ask (world s past the replayed expiry: holds.ts ClockWhy);
// the hold the placement put inside it; each operator's basic step across it (a pause keeps a string going: 4d60's
// Arcane attack 2 → attack 3); and a verdict. A whole-game pause asks most of its length on every clock across it
// (4d60's two stretches, engine assumption pause-holds `paused`); a phase the world runs through asks about nothing.

import { ENGINE_ASSUMPTIONS, withCurveReading, type GameData } from "@efsim/engine";
import { awayWindows } from "./enginecheck.ts";
import { clockAt, type ClockWhy } from "./holds.ts";
import { msOfFrame } from "./holdinputs.ts";
import { operatorLabel, secondsText as s, shortSkill } from "./labels.ts";
import { logBuffReplay } from "./logcheck.ts";
import type { DevFixture } from "./logs.ts";
import type { LogFixture } from "./zmdlogs.ts";

/** A clock's ask over a stretch at which the stretch reads as a pause: half its length (the asks of 4d60's are 0.8–1.0 of it, the phases' under 0.1). */
export const PAUSE_ASK_SHARE = 0.5;
/** Every clock's ask under this share of the stretch: the world ran on through it (the phases' asks are −2.8 to +1.1 s over 7–46 s). */
export const RUNS_ON_SHARE = 0.25;

/** One away stretch as the view reads it. */
export interface AwayStretch {
  readonly from: number;
  readonly to: number;
  /** The placement's clocks listed on both sides of it (one per clock, run and instance). */
  readonly clocks: readonly ClockWhy[];
  /** The hold the placement put inside it (ms; null: no holds placed). */
  readonly held: number | null;
  /** Each operator's last basic step before it and first after (its event and time, ms). */
  readonly basics: readonly { readonly operator: string; readonly before: { readonly event: string; readonly t: number }; readonly after: { readonly event: string; readonly t: number } }[];
  /** "pause": most clocks across it ask PAUSE_ASK_SHARE of its length or more; "runs on": every one asks under RUNS_ON_SHARE of it; "mixed"; "no clock": none across it. */
  readonly verdict: "pause" | "runs on" | "mixed" | "no clock";
}

const isBasic = (event: string | undefined) => /_attack\d/.test(event ?? "");

/** A fight's away stretches with their clocks, held time, basic steps and verdicts, under `assume`'s readings. */
export function awayStretches(data: GameData, fx: LogFixture, assume: Readonly<Record<string, string>> = {}): AwayStretch[] {
  const ws = awayWindows(fx);
  if (!ws.length) return [];
  const { replay } = logBuffReplay(withCurveReading(data, assume), fx, { assume });
  const h = replay.hiddenHolds;
  return ws.map((w) => {
    const seen = new Set<string>();
    const clocks = (replay.holdClocks ?? []).filter((c) => {
      if (!c.instance || !c.run || !(c.run.since < w.from && c.run.lastListed >= w.to)) return false;
      const k = `${c.clock}|${c.run.name}|${c.run.since}|${c.run.lastListed}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const basics = [...new Set(fx.hits.map((x) => x.operator))].flatMap((op) => {
      const own = fx.hits.filter((x) => x.operator === op && isBasic(x.event));
      const before = own.filter((x) => x.t <= w.from).sort((a, b) => b.t - a.t)[0];
      const after = own.filter((x) => x.t >= w.to).sort((a, b) => a.t - b.t)[0];
      return before && after ? [{ operator: op, before: { event: before.event, t: before.t }, after: { event: after.event, t: after.t } }] : [];
    });
    const len = w.to - w.from;
    const asks = clocks.map((c) => (c.ask ?? 0) * 1000);
    const verdict = !asks.length ? "no clock" : asks.every((a) => a < RUNS_ON_SHARE * len) ? "runs on" : asks.filter((a) => a >= PAUSE_ASK_SHARE * len).length * 2 > asks.length ? "pause" : "mixed";
    return { from: w.from, to: w.to, clocks, held: h ? clockAt(h, h.mid, w.to) - clockAt(h, h.mid, w.from) : null, basics, verdict };
  });
}

/** `efsim zmdlogs away [<fixture…>|--all]`: each log's away stretches (awayStretches) and a count of the verdicts. */
export function awayView(data: GameData, logs: readonly DevFixture[], opts: { readonly assume?: Readonly<Record<string, string>>; readonly progress?: (line: string) => void } = {}): string {
  const assume = opts.assume ?? {};
  const reading = assume["pause-holds"] ?? ENGINE_ASSUMPTIONS.find((a) => a.id === "pause-holds")?.default ?? "-";
  const out = [
    `Away stretches (no logged hit for 6 s or more: enginecheck.ts awayWindows) and the hold placement's clocks listed on both sides of each, with their asks (world s past the replayed expiry; a pause asks most of the stretch, a phase about nothing), the hold placed inside it and each operator's basic step across it; engine assumption pause-holds ${reading}; times in s:`,
  ];
  const counts = new Map<AwayStretch["verdict"], number>();
  for (const d of logs) {
    opts.progress?.(`away ${d.short}`);
    const stretches = awayStretches(data, d.fx, assume);
    for (const st of stretches) {
      counts.set(st.verdict, (counts.get(st.verdict) ?? 0) + 1);
      const len = st.to - st.from;
      const asks = st.clocks.filter((c) => (c.ask ?? 0) * 1000 >= PAUSE_ASK_SHARE * len).length;
      out.push(
        "",
        `${d.short} ${d.fx.enemy.id} away ${s(st.from)}–${s(st.to)} (${s(len)} s): ${st.verdict}${st.clocks.length ? ` (${asks} of ${st.clocks.length} clock(s) ask ≥ ${PAUSE_ASK_SHARE * 100}% of it, asks ${Math.min(...st.clocks.map((c) => c.ask ?? 0)).toFixed(2)} to ${Math.max(...st.clocks.map((c) => c.ask ?? 0)).toFixed(2)} s)` : ""}; held inside it ${st.held === null ? "- (no holds placed)" : `${s(st.held)} s`}`,
      );
      for (const c of st.clocks) {
        const inst = c.instance as NonNullable<ClockWhy["instance"]>;
        const run = c.run as NonNullable<ClockWhy["run"]>;
        out.push(`  clock ${c.clock} on ${operatorLabel(data, c.holder)}: instance ${s(msOfFrame(inst.start))}–${s(msOfFrame(inst.end))}, run ${run.name.replace(/^buff_/, "")} ${s(run.since)}–${s(run.lastListed)}${c.ask !== undefined ? `, asks ${c.ask.toFixed(2)} s` : ""}: ${c.verdict}`);
      }
      for (const b of st.basics) out.push(`  basic ${operatorLabel(data, b.operator)}: ${shortSkill(b.before.event)} ${s(b.before.t)} → ${shortSkill(b.after.event)} ${s(b.after.t)}`);
    }
  }
  const order: AwayStretch["verdict"][] = ["pause", "runs on", "mixed", "no clock"];
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  out.push("", total ? `${total} away stretch(es) in ${logs.length} log(s): ${order.filter((v) => counts.has(v)).map((v) => `${counts.get(v)} ${v}`).join(", ")}` : `No away stretch in ${logs.length} log(s).`);
  return out.join("\n");
}
