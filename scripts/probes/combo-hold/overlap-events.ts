// Probe (scripts/probes/README.md): the overlap-clock round (2026-11-28), docs/open-problems.md "The enemy's clock".
// node scripts/probes/combo-hold/overlap-events.ts [--rows]; reads the development logs, writes nothing.
// Is an operator in her own combo held by a teammate's combo slow-down that overlaps hers (two combos pressed together)?
// Her combo's first landing gives its start three ways: unheld by the overlapping combo slow-downs ("plain", the
// placement's start, logcasts.ts castStart), held by every one between (heldStart, the lowest scale), and held only by
// those that don't overlap her own slow-down ("own", engine assumption combo-overlap's default). The log's cast event
// is stamped on the world's clock, whatever holds hers (a plain combo's event comes +0.5 s in log time, ~+0.05 s in
// world time: `zmdlogs casts --event-lags`), so its world lag from the right start is about 0. Rows: combos with a cast
// event whose first landing has at least 2 frames of other combos' slow-downs before it, no ultimate's stop there;
// classed by where each overlapping slow-down starts against her own (in: inside it; around: before it, overlapping;
// after: after hers ended; before: ended before hers).
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { devFixtures, heldStart, loggedSkillInstances, placeHits, replayTimeStops, worldMs } from "@efsim/logs";

const data = loadGameData();
const fr = (t: number) => Math.round((t * FPS) / 1000);
const msOf = (f: number) => (f * 1000) / FPS;
const s = (ms: number) => (ms / 1000).toFixed(2);
type Row = { tag: string; cls: string; plain: number; held: number; own: number };
const rows: Row[] = [];
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"] })) {
  const placement = placeHits(data, fx);
  const stops = replayTimeStops(data, fx, placement);
  const firstLanding = new Map<object, { t: number; frame: number }>();
  for (const [h, p] of placement.hits) {
    if (p.frame === undefined || p.cast.kind !== "combo") continue;
    const cur = firstLanding.get(p.cast);
    if (!cur || h.t < cur.t) firstLanding.set(p.cast, { t: h.t, frame: p.frame });
  }
  for (const i of loggedSkillInstances(data, fx, { placement }).filter((x) => x.kind === "combo" && x.from === "hits" && x.events.length > 0)) {
    const cast = [...firstLanding.keys()].find((c) => (c as { operator: string }).operator === i.operator && Math.abs((c as { start: number }).start - i.start) < 40);
    const first = cast ? firstLanding.get(cast) : undefined;
    if (!first) continue;
    const e = i.events[0] as number;
    const others = stops.filter((st) => st.operator !== i.operator && st.kind === "combo");
    const plain = first.t - msOf(first.frame);
    const held = heldStart(first.t, first.frame, others);
    if (plain - held < msOf(2)) continue;
    const [a, b] = [fr(held), fr(first.t)];
    if (stops.some((st) => st.operator !== i.operator && st.kind !== "combo" && st.start < b && st.start + st.scales.length > a)) continue;
    const between = others.filter((st) => st.start < b && st.start + st.scales.length > a);
    // Her own slow-down's span from a start; held only by the others that don't overlap it (two passes).
    const span = (data.skills[i.skillId]?.timing?.slowdowns ?? []).reduce((m, d) => Math.max(m, d.from + d.scales.length), 0);
    const ownAt = (start: number) => heldStart(first.t, first.frame, others.filter((st) => !(st.start < fr(start) + span && st.start + st.scales.length > fr(start))));
    const own = ownAt(ownAt(plain));
    const [o0, o1] = [fr(own), fr(own) + span];
    const cls = between.map((st) => (st.start >= o1 ? "after" : st.start + st.scales.length <= o0 ? "before" : st.start >= o0 ? "in" : "around")).sort().join("+");
    const lag = (start: number) => (e >= start ? worldMs(start, e, stops) : -worldMs(e, start, stops));
    rows.push({ tag: `${short} ${i.operator.split("_")[2]} event ${s(e)}, first landing f${first.frame} at ${s(first.t)}, starts plain ${s(plain)} held ${s(held)} own ${s(own)} [${between.map((st) => `${st.operator.split("_")[2]} ${s(msOf(st.start))}–${s(msOf(st.start + st.scales.length))}`).join(", ")}]`, cls, plain: lag(plain), held: lag(held), own: lag(own) });
  }
}
const med = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? NaN;
const show = (label: string, sel: Row[]) => {
  const n = (k: "plain" | "held" | "own", lim: number) => sel.filter((r) => Math.abs(r[k]) < lim).length;
  process.stdout.write(`${label.padEnd(22)} n ${String(sel.length).padStart(3)}  event world lag median: plain ${s(med(sel.map((r) => r.plain)))}, held ${s(med(sel.map((r) => r.held)))}, own ${s(med(sel.map((r) => r.own)))} s;  within 0.1 s: ${n("plain", 100)} / ${n("held", 100)} / ${n("own", 100)};  within 0.25 s: ${n("plain", 250)} / ${n("held", 250)} / ${n("own", 250)}\n`);
};
show("every row", rows);
for (const c of [...new Set(rows.map((r) => r.cls))].sort()) show(c, rows.filter((r) => r.cls === c));
if (process.argv.includes("--rows")) for (const r of rows) process.stdout.write(`${r.tag} (${r.cls}): world lag plain ${s(r.plain)} held ${s(r.held)} own ${s(r.own)}\n`);
