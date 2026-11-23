// Probe (scripts/probes/README.md): buff-clock round (2026-11-22), docs/open-problems.md "The buff clock"; writes the rows the others read: node scripts/probes/buff-clock/lanes.ts > scratch/bc/rows.jsonl (zmdlogs clock is the committed per-buff view).
// Promoted from that round's scratch/bc/lanes.ts unchanged but for this header; run it from the repository root.
// The buff clock over every development log: each listed lane of a game buff a kit stands for with a fixed duration,
// its logged end (bracketed by hits, exact at a boundary hit or from the raw detail when cached) against the data's
// duration in world time (the placed casts' stops out) and against the replay's own expiry.
// node scratch/bc/lanes.ts [ids…] > scratch/bc/rows.jsonl
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { castTimeStops, devFixtures, logBuffReplay, loggedSkillInstances, placeHits, rawDir, teamBuffNames, worldMs } from "@efsim/logs";

const data = loadGameData();
const TARGET_SIDE = new Set(["susceptibility", "damageTaken", "multiplicative"]);
const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dirs = process.argv.includes("--multi") ? (["verified", "pending", "multi"] as const) : (["verified", "pending"] as const);
const logs = devFixtures({ dirs: [...dirs], ...(ids.length ? { ids } : {}) });
const msOf = (f: number) => (f * 1000) / FPS;

for (const { short, fx } of logs) {
  let placement, replay;
  try {
    placement = placeHits(data, fx);
    const names0 = teamBuffNames(data, fx);
    const traced = [...names0.defs.keys()];
    replay = logBuffReplay(data, fx, placement, { trace: traced }).replay;
  } catch (e) {
    process.stderr.write(`${short}: ${(e as Error).message}\n`);
    continue;
  }
  const names = teamBuffNames(data, fx);
  const stops = castTimeStops(data, placement.casts);
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const lastT = hits.at(-1)?.t ?? 0;
  // Raw lanes when cached.
  const rawFile = join(rawDir(), `${fx.provenance?.battleId ?? `btl_upload_${fx.id.replace(/^zmdlogs-/, "")}`}.json`);
  const raw: { buff: string; source: string; start: number; end: number; target: string }[] = [];
  if (existsSync(rawFile)) {
    const d = JSON.parse(readFileSync(rawFile, "utf8")) as { timelineEvents: Record<string, any>[] };
    for (const e of d.timelineEvents) if (e.laneType === "buff") raw.push({ buff: String(e.eventKey).replace(/::.*$/, ""), source: e.sourceCharacterKey, start: e.actualStartMsFromStart, end: e.actualEndMsFromStart, target: e.targetEnemyKey ?? e.targetCharacterKey });
  }
  // Nominal durations from the traces: an instance's first expiry less its start, the least per kit buff.
  const nominal = new Map<string, number>();
  const firstSeen = new Set<string>();
  for (const t of replay.traces) {
    const k = `${t.buff}|${t.appliedAt}`;
    if (firstSeen.has(k) || t.to === null || t.from !== null) continue;
    firstSeen.add(k);
    if (!Number.isFinite(t.to)) continue;
    const d = t.to - t.appliedAt;
    nominal.set(t.buff, Math.min(nominal.get(t.buff) ?? Infinity, d));
  }
  // Lanes.
  type Lane = { buff: string; source: string; since: number; holder: string; enemy: boolean; listed: number[]; endExact: number | null; values: Set<number> };
  const lanes = new Map<string, Lane>();
  for (const h of hits) {
    for (const [e, boundary] of [...h.effects.map((x) => [x, false] as const), ...h.boundaryEffects.map((x) => [x, true] as const)]) {
      if (e.since === undefined || !e.source) continue;
      const enemy = TARGET_SIDE.has(e.zone);
      const holder = enemy ? (h.target ?? "enemy") : h.operator;
      const key = `${e.buff}|${e.source}|${e.since}|${holder}`;
      const l = lanes.get(key) ?? { buff: e.buff, source: e.source, since: e.since, holder, enemy, listed: [], endExact: null, values: new Set() };
      lanes.set(key, l);
      l.values.add(+e.value.toFixed(4));
      if (boundary) {
        if (h.t !== e.since) l.endExact = h.t;
      } else if (!l.listed.includes(h.t)) l.listed.push(h.t);
    }
  }
  const instances = loggedSkillInstances(data, fx, { placement });
  const staggerSpans = replay.staggerSpans.map((s) => ({ start: msOf(s.start), end: Number.isFinite(s.end) ? msOf(s.end) : Infinity }));
  for (const l of lanes.values()) {
    const kitKeys = (names.byGameBuff.get(l.buff) ?? []).filter((k) => k.startsWith(`${l.source}:`));
    const kitKey = kitKeys[0];
    if (!kitKey) continue;
    const def = names.defs.get(kitKey);
    if (!def || def.consumedBy || def.endsWithCast || def.link) continue;
    const D = nominal.get(kitKey);
    if (D === undefined || !Number.isFinite(D)) continue;
    const lo = l.listed.length ? Math.max(...l.listed) : l.since;
    const listsIt = (h: (typeof hits)[number]) => [...h.effects, ...h.boundaryEffects].some((e) => e.buff === l.buff && e.source === l.source && e.since === l.since);
    const bounding = (h: (typeof hits)[number]) => (l.enemy ? (h.target ?? "enemy") === l.holder : h.operator === l.holder);
    const next = hits.find((h) => h.t > lo && bounding(h) && !listsIt(h));
    let hi: number | null = l.endExact ?? next?.t ?? null;
    let loB = l.endExact ?? lo;
    let exact = l.endExact !== null ? "boundary" : "";
    const r = raw.find((x) => x.buff === l.buff && x.source === l.source && x.start === l.since && (l.enemy ? x.target?.startsWith("eny_") : x.target === l.holder));
    if (r) {
      loB = r.end;
      hi = r.end;
      exact = "raw";
    }
    if (hi === null && lastT - lo < 3000) continue; // to the fight's end
    // The replay's instance: the last of the kit buff's windows at the holder starting from the lane's since − 1 s to its last listed hit.
    const holderOp = l.enemy ? l.source : l.holder;
    const wins = replay.kitWindows(kitKey, holderOp).filter((w) => w.start >= l.since - 3000 && w.start <= lo);
    const w = wins.at(-1);
    // Ended by a refresh: another lane of it (same source and holder) starts at this one's end.
    const endAt = hi ?? loB;
    const refreshed = [...lanes.values()].some((o) => o !== l && o.buff === l.buff && o.source === l.source && o.holder === l.holder && o.since > l.since && o.since <= endAt + 50);
    const row = {
      log: short,
      buff: l.buff,
      kit: kitKey,
      holder: l.enemy ? "enemy" : l.holder,
      source: l.source,
      enemyId: fx.enemy.id,
      D: +(msOf(D) / 1000).toFixed(2),
      maxStacks: def.maxStacks !== undefined,
      sharedTimer: def.sharedTimer === true,
      since: l.since,
      lo: loB,
      hi,
      exact,
      worldLo: +(worldMs(l.since, loB, stops) / 1000).toFixed(3),
      worldHi: hi === null ? null : +(worldMs(l.since, hi, stops) / 1000).toFixed(3),
      refreshed,
      values: [...l.values],
      replay: w ? { start: w.start, end: Number.isFinite(w.end) ? w.end : null, expired: w.expired, n: wins.length, world: Number.isFinite(w.end) ? +(worldMs(w.start, w.end, stops) / 1000).toFixed(3) : null } : null,
      ctx: {} as Record<string, unknown>,
    };
    // Context in [since, hi ?? lo].
    const to = hi ?? loB;
    const inside = stops.filter((s) => msOf(s.start) < to && msOf(s.start + s.scales.length) > l.since);
    const heldBy = (pred: (s: (typeof stops)[number]) => boolean) => {
      const sub = inside.filter(pred);
      return +((to - l.since - worldMs(l.since, to, sub)) / 1000).toFixed(2);
    };
    const holderOperator = l.enemy ? null : l.holder;
    const ins = instances.filter((i) => i.start > l.since && i.start < to);
    const winHits = hits.filter((h) => h.t >= l.since && h.t <= to);
    let gap = 0;
    let prev = l.since;
    for (const h of winHits) {
      gap = Math.max(gap, h.t - prev);
      prev = h.t;
    }
    gap = Math.max(gap, to - prev);
    row.ctx = {
      ownHeld: holderOperator ? heldBy((s) => s.operator === holderOperator) : null,
      othersHeld: heldBy((s) => s.operator !== holderOperator),
      allHeld: heldBy(() => true),
      othersUlts: ins.filter((i) => i.kind === "ultimate" && i.operator !== holderOperator).length,
      ownCombos: holderOperator ? ins.filter((i) => i.kind === "combo" && i.operator === holderOperator).length : null,
      ownBattle: holderOperator ? ins.filter((i) => i.kind === "battle" && i.operator === holderOperator).length : null,
      othersCombos: ins.filter((i) => i.kind === "combo" && i.operator !== holderOperator).length,
      ownHits: holderOperator ? winHits.filter((h) => h.operator === holderOperator).length : null,
      allHits: winHits.length,
      maxGap: +(gap / 1000).toFixed(2),
      casts: ins.filter((i) => i.kind === "ultimate" || i.kind === "combo" || i.kind === "battle").map((i) => [i.operator.slice(4, 12), i.kind, Math.round(i.start)]),
      stops: inside.map((s) => [s.operator.slice(4, 12), s.kind, Math.round(msOf(s.start)), s.scales.length, Math.min(...s.scales)]),
      stagger: +(staggerSpans.reduce((s, sp) => s + Math.max(0, Math.min(to, sp.end) - Math.max(l.since, sp.start)), 0) / 1000).toFixed(2),
    };
    process.stdout.write(`${JSON.stringify(row)}\n`);
  }
  process.stderr.write(`${short} done\n`);
}
process.stderr.write("EFSIM-DONE lanes pass\n");
