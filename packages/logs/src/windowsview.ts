// An operator's combo windows in the replay (`zmdlogs replay <fixture> --windows <operator>`; round 24, the
// combo-windows report point 1: the opener of each of 18 INSIDE lines was pieced together from three views, a trigger
// trace by id and a scratch script for the cooldown, about an hour). WINDOW lines from the replay's own record
// (ReplayOptions.trace `window:<operator>`: replayrecord.ts WindowTrace, a change per step) and its made casts
// (BuffReplay.made: each combo's window at its press, MadeCast.window; its COOLDOWN record, MadeCast.early): what opened
// or refreshed each window and when (the event's source), where the latest event left it shut and the cooldown that
// did, each window's end (used by a cast, ran out, its buff's end), and each combo skill's ready frame as casts and
// holds set it.

import { FPS, type GameData } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import { shortSkill, secondsText as s } from "./labels.ts";
import type { TracedWindow } from "./replayrecord.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;
const at = (frame: number) => (Number.isFinite(frame) ? `${s(msOf(frame))} s` : "never");

/** A WINDOW line: its time (ms) and text. */
export interface WindowLine {
  readonly t: number;
  readonly text: string;
}

/** A window in words: its count, source and end. */
const windowWords = (w: TracedWindow) => `count ${w.count}, ${w.source ?? "no source"}, until ${w.whileBuff ? `its buff ${w.whileBuff} ends` : at(w.until)}`;

/**
 * The WINDOW lines of `operator` in a replay traced with `window:<operator>` (replayrecord.ts WindowTrace) and its made
 * combos: openings, refreshes, a trigger the cooldown kept out, ends (used, ran out, its buff's end), the combo skills'
 * ready frames, and each press with the window it found. `combos`: the operator's combo skill IDs (the ready frames
 * shown). Within `f`'s window (ms).
 */
export function windowLines(data: GameData, replay: Pick<BuffReplay, "windowTraces" | "made">, operator: string, combos: readonly string[], f: { readonly from?: number; readonly to?: number } = {}): WindowLine[] {
  const out: WindowLine[] = [];
  const name = data.operators[operator]?.name ?? operator;
  const keyWords = (key: string) => (key === operator ? name : `${name}'s ${shortSkill(key.slice(operator.length + 1))}`);
  const casts = replay.made.filter((m) => m.cast.operator === operator && !m.cast.missed && m.window !== undefined);
  // The latest ready frame per combo skill as the traces go, for the trigger a cooldown kept out.
  const ready = new Map<string, number>();
  // Each key's open window, for its expiry between traces.
  const open = new Map<string, TracedWindow>();
  const expire = (key: string, before: number) => {
    const w = open.get(key);
    if (w && !w.whileBuff && w.until <= before) {
      out.push({ t: msOf(w.until), text: `WINDOW ${keyWords(key)}: the window from ${at(w.from)} ran out at ${at(w.until)} unused` });
      open.delete(key);
    }
  };
  for (const x of replay.windowTraces) {
    for (const key of [...open.keys()]) expire(key, x.frame);
    for (const r of x.ready ?? []) {
      if (!combos.includes(r.skillId)) continue;
      const cast = casts.find((m) => m.skillId === r.skillId && m.frame === x.frame);
      out.push({ t: msOf(x.frame), text: `WINDOW ${shortSkill(r.skillId)} ready at ${at(r.to)}${cast ? `: its cast at ${at(x.frame)} set its cooldown (${s(msOf(r.to - x.frame))} s)` : r.from !== null ? ` (was ${at(r.from)}, ${r.to > r.from ? "+" : "−"}${s(msOf(Math.abs(r.to - r.from)))} s: held, reduced or a cooldown group's cast) at ${x.step}` : ` at ${x.step}`}` });
      ready.set(r.skillId, r.to);
    }
    const [from, to] = [x.from, x.to];
    if (to && (!from || to.from !== from.from)) {
      const how = from && from.until > to.from ? `refreshed (the one from ${at(from.from)} still open)` : "opened";
      out.push({ t: msOf(to.from), text: `WINDOW ${keyWords(x.key)}: ${how} at ${at(to.from)} (${windowWords(to)})${x.trigger && x.trigger.frame === to.from ? `, by ${x.trigger.source}` : ""}, seen at ${x.step}` });
      open.set(x.key, to);
    } else if (to && from && to.until !== from.until) {
      open.set(x.key, to);
    } else if (!to && from) {
      const used = casts.find((m) => m.frame === x.frame || (m.frame <= x.frame && m.frame >= from.from));
      const text = used ? `used by ${shortSkill(used.skillId)} made at ${at(used.frame)}` : from.whileBuff ? `closed with its buff ${from.whileBuff}` : `gone at ${x.step}`;
      if (open.has(x.key)) out.push({ t: msOf(used?.frame ?? x.frame), text: `WINDOW ${keyWords(x.key)}: the window from ${at(from.from)} ${text}` });
      open.delete(x.key);
    }
    // The latest event its openCombo saw, where it opened nothing: the cooldown kept it shut (actions.ts openCombo).
    if (x.trigger && (!to || to.from !== x.trigger.frame)) {
      const cd = combos.map((id) => [id, ready.get(id) ?? 0] as const).filter(([, r]) => r > (x.trigger?.frame ?? 0));
      const why = cd.length === combos.length && cd.length ? `kept shut by the cooldown (${cd.map(([id, r]) => `${shortSkill(id)} ready at ${at(r)}`).join(", ")})` : to ? "the window already open from before" : "opened nothing (its own combo's event, or a window of other skills)";
      out.push({ t: msOf(x.trigger.frame), text: `WINDOW ${keyWords(x.key)}: an event at ${at(x.trigger.frame)} (${x.trigger.source}) ${why}` });
    }
  }
  for (const key of [...open.keys()]) expire(key, Infinity);
  // Each press with the window it found (MadeCast.window: null, shut; replayCast then opens one counting 1).
  for (const m of casts) {
    const early = m.early ? `; ${s(msOf(m.early.readyAt - m.frame))} s before its cooldown (COOLDOWN)` : "";
    out.push({ t: msOf(m.frame), text: `WINDOW ${shortSkill(m.skillId)} pressed at ${at(m.frame)}: ${m.window === null ? "its window shut at the press (the replay opens one counting 1 there: replayCast; see its INSIDE or OPENER line)" : `its window open, count ${m.window}`}${early}` });
  }
  return out.filter((l) => l.t >= (f.from ?? -Infinity) && l.t <= (f.to ?? Infinity)).sort((a, b) => a.t - b.t);
}
