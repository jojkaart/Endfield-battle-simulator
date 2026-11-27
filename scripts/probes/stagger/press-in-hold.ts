// The casts whose first landing comes after a logged Stagger break (one the replay holds) and whose start, from that
// landing less its frame and the other operators' stops, falls before the break (BEFORE: the cast ran through it, its
// start that hold earlier: engine assumption break-held-starts `held`) or inside its hold (INHOLD: pressed in the hold
// and not held, or started before the break and held; the landings can't tell). Per cast: the start against the
// break, the start a hold earlier, the operator's cast before it (start, an unheld estimate of its uncuttable end) and
// ALT-COLLIDES where the earlier start falls inside it; the log's cast events of the operator within 1.5 s.
// 2026-11-27 (the break placement round, break-hold-place `moments`): 3 BEFORE, 30 INHOLD with the start 9–484 ms
// after the break (12 of them 412–484 ms, the rest spread), 20 of the 30 with the earlier start colliding (an estimate:
// a basic chain's windows aren't read). Neither "a press waits out the hold" nor "a press in the hold runs unheld" is
// ruled out by the landings; d4fb 196.05 s (Chen Qianyu's combo 0.27 s into the hold of her own battle skill's break,
// its kit's uncuttable frames to 196.07 s) and 9847 57.64 s (Perlica's combo event at the break, its landing 0.82 s
// later at frame 24) read as presses in the hold that weren't held.
//   node scripts/probes/stagger/press-in-hold.ts [fixture id]
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { devFixtures, placementPasses, replayTimeStops, heldStart, loggedBreaks, breakStops, operatorLabel } from "@efsim/logs";

const data = loadGameData();
const only = process.argv[2];
const HOLD = (14 * 1000) / FPS;
const msOf = (f: number) => (f * 1000) / FPS;
for (const { short, fx } of devFixtures(only ? { ids: [only] } : {})) {
  if (fx.hits.some((h: any) => h.target)) continue;
  const placement = placementPasses(data, fx).second;
  const stops = replayTimeStops(data, fx, placement);
  const brk = breakStops(fx, stops as any, undefined);
  const first = new Map<any, { t: number; frame: number }>();
  for (const [h, p] of placement.hits) {
    if (p.frame === undefined || p.cast.kind === null) continue;
    const f = first.get(p.cast);
    if (!f || h.t < f.t) first.set(p.cast, { t: h.t, frame: p.frame });
  }
  const casts = [...placement.casts].filter((c) => c.kind !== null).sort((a, b) => a.start - b.start);
  for (const tb of loggedBreaks(fx)) {
    const held = brk.find((b) => Math.abs(msOf(b.start) - tb) < 40);
    if (!held) continue;
    for (const [c, l] of first) {
      if (l.t <= tb + 20 || l.t > tb + 4000) continue;
      const own = stops.filter((st) => st.operator !== c.operator && !(c.kind === "combo" && st.kind === "combo"));
      const plain = heldStart(l.t, l.frame, own as any);
      if (plain >= tb + HOLD + 20 || plain < tb - 1500) continue;
      const alt = heldStart(l.t, l.frame, [...(own as any), held]);
      const prev = casts.filter((x) => x.operator === c.operator && x !== c && x.start < plain - 30).at(-1);
      let prevEnd = NaN;
      if (prev) {
        const ex = data.skills[prev.skillId]?.timing?.exclusiveFrames ?? 0;
        prevEnd = prev.start + msOf(ex) + (prev.start < tb && prev.start + msOf(ex) > tb ? HOLD : 0);
      }
      const ev = (fx.casts ?? []).filter((e) => e.operator === c.operator && Math.abs(e.t - plain) < 1500).map((e) => `${e.skill.replace(/^chr_\d+_[a-z0-9]+_/, "")}@${(e.t / 1000).toFixed(2)}`).join(",");
      const cls = plain < tb - 20 ? "BEFORE" : "INHOLD";
      process.stdout.write(`${short} brk ${(tb / 1000).toFixed(2)} ${cls} ${operatorLabel(data, c.operator)} ${c.skillId.replace(/^chr_\d+_[a-z0-9]+_/, "")} (${c.kind}) land ${(l.t / 1000).toFixed(2)} f${l.frame} plain-tb ${(plain - tb).toFixed(0)} alt ${(alt / 1000).toFixed(2)} prev ${prev ? prev.skillId.replace(/^chr_\d+_[a-z0-9]+_/, "") + "@" + (prev.start / 1000).toFixed(2) + " uncut→" + (prevEnd / 1000).toFixed(2) : "-"} ${prev && alt < prevEnd ? "ALT-COLLIDES" : ""} ev[${ev}]\n`);
    }
  }
}
