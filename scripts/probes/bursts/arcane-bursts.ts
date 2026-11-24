// Arcane's bursts, 2026-11-24 (the cooldown-clock round; docs/open-problems.md "Misprediction statistics", Arcane's
// Will burst buff): each logged Arts Burst credited to an operator (buff_common_<e>_<e>_triggered) against the replay's
// bursts of that operator (BuffReplay.reactions, kind burst): the nearest unused one of the same element within 550 ms
// of the world's time... simply ms here: within 150 ms, 150–550 ms, or none; then the replay's bursts no logged one took
// (replay-only). Prints per log the off and missing ones, then the counts.
//
//   node scripts/probes/bursts/arcane-bursts.ts [operator name or id, default Arcane] [--assume id=reading]… [--ids a,b]
//
// Development logs only (devFixtures). Writes nothing.

import { loadGameData, operatorId } from "@efsim/data";
import { devFixtures, logBuffReplay } from "@efsim/logs";
import { FPS } from "@efsim/engine";

const data = loadGameData();
const args = process.argv.slice(2);
const assume: Record<string, string> = {};
let ids: string[] | undefined;
let name = "Arcane";
for (let i = 0; i < args.length; i++) {
  const a = args[i] as string;
  if (a === "--assume") {
    const [k, v] = (args[++i] as string).split("=");
    assume[k as string] = v as string;
  } else if (a === "--ids") ids = (args[++i] as string).split(",");
  else name = a;
}
const A = name.startsWith("chr_") ? name : operatorId(data, name);
const ms = (f: number) => Math.round((f * 1000) / FPS);
let near = 0;
let off = 0;
let none = 0;
let only = 0;
for (const { short, fx } of devFixtures({ withOperators: [A], ...(ids ? { ids } : {}) })) {
  const logged = fx.hits.filter((h) => h.operator === A && /^buff_common_([a-z]+)_\1_triggered$/.test(h.event)).map((h) => ({ t: h.t, element: (/^buff_common_([a-z]+)_/.exec(h.event) as RegExpExecArray)[1] as string }));
  if (!logged.length) continue;
  const { replay } = logBuffReplay(data, fx, undefined, { assume });
  const bursts = replay.reactions.filter((r) => r.kind === "burst" && r.operator === A).map((r) => ({ t: ms(r.frame), element: r.element as string, used: false }));
  const notes: string[] = [];
  for (const l of logged) {
    const cands = bursts.filter((b) => !b.used && b.element === l.element).sort((x, y) => Math.abs(x.t - l.t) - Math.abs(y.t - l.t));
    const b = cands[0];
    const d = b ? b.t - l.t : Infinity;
    if (b && Math.abs(d) <= 150) {
      near++;
      b.used = true;
    } else if (b && Math.abs(d) <= 550) {
      off++;
      b.used = true;
      notes.push(`${(l.t / 1000).toFixed(2)} ${l.element} off ${d > 0 ? "+" : ""}${d}`);
    } else {
      none++;
      notes.push(`${(l.t / 1000).toFixed(2)} ${l.element} none`);
    }
  }
  for (const b of bursts.filter((x) => !x.used)) {
    only++;
    notes.push(`replay-only ${(b.t / 1000).toFixed(2)} ${b.element}`);
  }
  process.stdout.write(`${short}: ${logged.length} logged; ${notes.join("; ") || "all within 150 ms"}\n`);
}
process.stdout.write(`within 150 ms ${near}, 150–550 ms ${off}, none ${none}; replay-only ${only}\n`);
