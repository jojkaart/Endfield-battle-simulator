// The development logs' batched ms (several casts' Stagger events at one logged ms): which order rule the log's
// Stagger bars follow (each event's bar is the one before it less its dealt, so they fall in the game's order). Pairs of
// consecutive events of two operators' casts: lower operator ID first, earlier team slot first, earlier cast start
// first (the replay's made frame of each hit's cast). The order of a stop's batched landings (2026-11-26): 60 pairs,
// ID 28, team 39, cast start 29 of 44, so the replay takes the bars' order (castassembly.ts batchOrder). Run:
// node scripts/probes/physical/batch-rules.ts (stdout: the tally; stderr: the logs read).
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay } from "@efsim/logs";
import type { LogHit } from "@efsim/logs";

const data = loadGameData();
const tally = { pairs: 0, id: 0, team: 0, castStart: 0, castKnown: 0 };
const opOf = (h: LogHit) => h.poise?.origin?.match(/^chr_\d+_[a-z0-9]+/)?.[0] ?? h.operator;
for (const { short, fx } of devFixtures()) {
  const byT = new Map<number, LogHit[]>();
  for (const h of fx.hits) if (h.poise?.origin) byT.set(h.t, [...(byT.get(h.t) ?? []), h]);
  const groups = [...byT.values()].filter((hs) => new Set(hs.map((h) => h.poise?.origin)).size >= 2);
  if (!groups.length) continue;
  const slot = new Map(fx.team.map((b, i) => [b.operator, i]));
  const rep = logBuffReplay(data, fx).replay;
  const made = new Map(rep.made.map((m) => [m.index, m.frame]));
  for (const hs of groups) {
    // Several events leaving the bar at 0 (a break): their order isn't in the bars.
    if (hs.filter((h) => h.poise?.bar === 0).length > 1) continue;
    const ev = new Map<string, { bar: number; op: string; start?: number }>();
    for (const h of hs) {
      const k = `${h.poise?.origin}|${h.poise?.bar}`;
      const e = ev.get(k) ?? { bar: h.poise?.bar ?? 0, op: opOf(h) };
      const l = /^buff_/.test(h.event) ? null : rep.landing(h);
      const start = l && !("unknown" in l) && l.cast !== undefined ? made.get(l.cast) : undefined;
      if (start !== undefined) e.start = start;
      ev.set(k, e);
    }
    const list = [...ev.values()].sort((a, b) => b.bar - a.bar);
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i] as (typeof list)[number];
      const b = list[i + 1] as (typeof list)[number];
      if (a.op === b.op) continue;
      tally.pairs++;
      if (a.op < b.op) tally.id++;
      if ((slot.get(a.op) ?? 0) < (slot.get(b.op) ?? 0)) tally.team++;
      if (a.start !== undefined && b.start !== undefined && a.start !== b.start) {
        tally.castKnown++;
        if (a.start < b.start) tally.castStart++;
      }
    }
  }
  process.stderr.write(`${short} `);
}
process.stdout.write(`\n${tally.pairs} pairs of two operators' events at one ms, in the bars' order: lower operator ID first ${tally.id}, earlier team slot first ${tally.team}; of the ${tally.castKnown} with both casts' starts known and apart, the earlier cast first ${tally.castStart}\n`);
