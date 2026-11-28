// The placement's passes and the stops each pass read (`zmdlogs casts <fixture> --passes`; round 24, the
// placement-paths report point 1: 9c6e 78.88 s looked like a wrong twin rule until two scratch scripts showed pass 1
// placing Liino's ultimate again at 76.31 s, a stop pass 2 read that the final placement never has). Per pass
// (logcasts.ts placementPasses: first, second, placed), its casts (CAST: group, start, key) and distinct casts
// (DISTINCT, with the merge that pass has), and the stops the second pass read (STOP: passStops of the first, the
// unplaced cast events' marked) beside the final placement's own (castTimeStops with its merge), so a rule that reads
// `stops` (byTime, castStart, beforeStopStart, joinable) is checked against what it read.

import { FPS, type GameData } from "@efsim/engine";
import { castFrames, castTimeStops, distinctCasts, passStopParts, placementPasses, type TimeStop } from "./logcasts.ts";
import type { LogFixture } from "./zmdlogs.ts";
import { secondsText as s, shortSkill } from "./labels.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;

/** `zmdlogs casts <fixture> --passes`: each pass's casts and the stops the next pass read, within `f` (ms; operators). */
export function passesView(data: GameData, fx: LogFixture, f: { readonly from?: number; readonly to?: number; readonly operators?: readonly string[]; readonly assume?: Readonly<Record<string, string>> } = {}): string {
  const inWindow = (ms: number) => ms >= (f.from ?? -Infinity) && ms <= (f.to ?? Infinity);
  const mine = (op: string) => !f.operators?.length || f.operators.includes(op);
  const label = (op: string) => data.operators[op]?.name ?? op;
  const passes = placementPasses(data, fx, f.assume);
  const lines: { t: number; order: number; text: string }[] = [];
  const names = { first: "pass 1", second: "pass 2", placed: "placed" } as const;
  for (const [key, p] of Object.entries(passes) as [keyof typeof names, (typeof passes)[keyof typeof names]][]) {
    for (const c of p.casts) if (mine(c.operator) && inWindow(c.start)) lines.push({ t: c.start, order: 0, text: `${names[key].padEnd(7)} CAST     ${label(c.operator)} ${c.group} ${shortSkill(c.skillId)} at ${s(c.start)} (key ${shortSkill(c.key)}${c.fromEvent ? ", from its cast event" : ""})` });
    for (const c of distinctCasts(p)) if (mine(c.operator) && inWindow(c.start)) lines.push({ t: c.start, order: 1, text: `${names[key].padEnd(7)} DISTINCT ${label(c.operator)} ${shortSkill(c.skillId)} at ${s(c.start)}` });
  }
  const stop = (who: string, x: TimeStop, mark = "") => {
    const [a, b] = [msOf(x.start), msOf(x.start + x.scales.length)];
    return b < (f.from ?? -Infinity) || a > (f.to ?? Infinity) || !mine(x.operator) ? null : { t: a, order: 2, text: `${who.padEnd(7)} STOP     ${label(x.operator)} ${shortSkill(x.skillId)} ${s(a)}–${s(b)}, lowest ${Math.min(...x.scales).toFixed(2)}${mark}` };
  };
  const read = passStopParts(data, fx, passes.first);
  for (const x of read.placed) {
    const l = stop("pass 2", x, " (read by pass 2: a pass-1 cast's)");
    if (l) lines.push(l);
  }
  for (const x of read.unplaced) {
    const l = stop("pass 2", x, " (read by pass 2: an unplaced cast event's)");
    if (l) lines.push(l);
  }
  for (const x of castTimeStops(data, passes.placed.casts, castFrames(passes.placed), passes.placed.merge)) {
    const l = stop("placed", x, " (the final placement's own)");
    if (l) lines.push(l);
  }
  lines.sort((a, b) => a.t - b.t || a.order - b.order);
  const head = `${fx.id}: the placement's passes (logcasts.ts placementPasses; times in s): CAST each pass's casts (group, start, the key it was placed from), DISTINCT its distinct casts (with the merge that pass has), STOP the stops pass 2 read (passStops of pass 1: its casts', and the unplaced cast events') beside the final placement's own. A rule reading \`stops\` reads pass 2's.`;
  return [head, ...lines.map((l) => `  ${s(l.t).padStart(7)}  ${l.text}`)].join("\n");
}
