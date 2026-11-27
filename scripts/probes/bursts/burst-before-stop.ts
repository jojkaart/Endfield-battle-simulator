// Bursts due just before a stop starts, 2026-11-27 (the log-only round; docs/open-problems.md "Log-only landings"):
// for every replay Arts Burst (zmdlogs bursts' rows, burstsview.ts burstRows) the time stops starting from one frame
// before it to WINDOW frames after it (any operator's; own marked), then the logged burst of its operator and element:
// at the replay's time (notHeld, within 200 ms), at the replay's time plus the stops' held world time (held, within
// 250 ms), else unclear. 2026-11-27, WINDOW 12: held 13, not held 16, unclear 11 over the development logs but 9c6e,
// 6339, 7b54: a stop starting 0-300 ms after the replay's burst holds the game's about half the time, both ways at the
// same offsets (Wulfgard's combo at +200-300 ms held, Camille's at +167-267 not), so no edge rule decides them.
//
//   node scripts/probes/bursts/burst-before-stop.ts [WINDOW frames, default 12]
//
// Development logs only (devFixtures). Writes nothing.
import { loadGameData } from "@efsim/data";
import { FPS, parseReactionEvent } from "@efsim/engine";
import { burstRows, devFixtures, placeHits, replayTimeStops } from "@efsim/logs";

const data = loadGameData();
const WINDOW = Number(process.argv[2] ?? 12);
const ms = (f: number) => (f * 1000) / FPS;
const held = (scales: readonly number[]) => scales.reduce((s, x) => s + (1 - x), 0);
const counts = { held: 0, notHeld: 0, unclear: 0 };
const rows: string[] = [];
for (const { short, fx } of devFixtures()) {
  if (["9c6e", "6339", "7b54"].includes(short)) continue;
  const placement = placeHits(data, fx);
  const stops = replayTimeStops(data, fx, placement);
  const logged = fx.hits.filter((h) => parseReactionEvent(h.event)?.kind === "burst");
  for (const b of burstRows(data, fx)) {
    if (!b.replay) continue;
    const t0 = b.replay.t;
    const R = (t0 * FPS) / 1000;
    const after = stops.filter((s) => s.start >= R - 1 && s.start <= R + WINDOW && s.scales.some((x) => x < 1));
    if (!after.length) continue;
    const hold = after.reduce((s, x) => s + held(x.scales), 0);
    const near = logged.filter((h) => h.operator === b.operator && parseReactionEvent(h.event)?.element === b.element && h.t > t0 - 400 && h.t < t0 + ms(hold) + 600);
    const t = b.logged?.t ?? near[0]?.t;
    let verdict: keyof typeof counts = "unclear";
    if (t !== undefined) {
      const d = t - t0;
      if (Math.abs(d) <= 200) verdict = "notHeld";
      else if (Math.abs(d - ms(hold)) <= 250) verdict = "held";
    }
    counts[verdict]++;
    const st = after.map((s) => `${s.operator.replace(/^chr_\d+_/, "")}${s.operator === b.operator ? "(own)" : ""} ${s.kind} ${s.scales.length}f +${Math.round(ms(s.start) - t0)}ms`).join(", ");
    rows.push(`${short} ${(t0 / 1000).toFixed(2)} ${b.operator.replace(/^chr_\d+_/, "")} ${b.element}: logged ${t !== undefined ? (t / 1000).toFixed(2) : "-"} (${t !== undefined ? Math.round(t - t0) : "-"} ms; hold ${Math.round(ms(hold))} ms) ${verdict}${b.logged ? "" : " [replay only]"}; stops ${st}`);
  }
}
process.stdout.write(rows.join("\n") + "\n" + JSON.stringify(counts) + "\n");
