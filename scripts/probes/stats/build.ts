// Misprediction statistics, 2026-11-24 (docs/analysis/2026-11-24-misprediction-stats.md): the per-hit and per-landing
// tables the analysis (scripts/probes/stats/analyze.py) reads. Every verified and pending development log (never a
// hold-out: devFixtures), each replayed once on a worker thread (the same computations as `zmdlogs hits --json` and
// `zmdlogs totals --kinds`: placeHits, logBuffReplay, engineHits, checkLog, engineReport), with features the hit
// export doesn't give: the hit's placed cast (kind, start, slot), whether it sits inside a slow-down the replay
// applied, near a placed hidden hold, a cast made as a cut, the fight's end or an away stretch, the replay's Stagger
// changing near it, the log's listed effects' ages, and the fixture's provenance (parser version, import date, group).
//
//   node scripts/probes/stats/build.ts [--workers 4] [ids…]
//
// Writes scratch/stats/hits.jsonl (one row per logged hit), scratch/stats/onesided.jsonl (one row per replay-only
// landing and log-only hit of the totals, onesided.ts), scratch/stats/fights.jsonl (per fight: group, shares). Ends
// with `EFSIM-DONE stats-build pass` on stdout. About 4 minutes on 4 threads.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { loadGameData } from "@efsim/data";
import { effectiveKit, FPS, landingDamage, parseReactionEvent, readingDoesNotApply, roundDamage } from "@efsim/engine";
import {
  awayWindows,
  checkLog,
  devFixtures,
  engineCheck,
  engineHits,
  engineReport,
  hitPlace,
  listedBuffs,
  logBuffReplay,
  loggedEntries,
  logDifferences,
  placeHits,
  readingBasis,
  readLogFixture,
  readLogSplit,
  shortId,
  totalsShares,
  verdictCount,
  verdictReadingOf,
} from "@efsim/logs";

const OUT = join(process.cwd(), "scratch", "stats");
const msOf = (f: number) => (f * 1000) / FPS;

type Row = Record<string, unknown>;

let gameData: ReturnType<typeof loadGameData> | undefined;

function fixtureRows(file: string): { hits: Row[]; onesided: Row[]; fight: Row } {
  const data = (gameData ??= loadGameData());
  const fx = readLogFixture(file);
  const split = readLogSplit();
  const group = file.includes("/pending/") ? (split.development.includes(fx.id) ? "development" : "earlier") : "verified";
  const placement = placeHits(data, fx);
  const lbr = logBuffReplay(data, fx, placement);
  const byHit = engineHits(data, fx, lbr, placement);
  const verdicts = new Map(checkLog(data, fx, { replay: lbr, engineHits: byHit }).map((v) => [v.hit, v]));
  const report = engineReport(data, fx, lbr, byHit, [...verdicts.values()]);
  const replay = lbr.replay;
  const c = engineCheck(data, fx, replay);
  const last = fx.hits.reduce((m, h) => Math.max(m, h.t), 0);
  const away = awayWindows(fx);
  const stops = replay.appliedStops;
  const holds = replay.hiddenHolds?.holds ?? [];
  const team = fx.team.map((b) => b.operator).sort();
  const fight = {
    fx: shortId(fx.id),
    group,
    enemy: fx.enemy.id,
    level: fx.enemy.level,
    parser: fx.provenance.parserVersion,
    measured: (fx.provenance as { measured?: string }).measured ?? null,
    refreshed: fx.hits.some((h) => h.effects.some((e) => (e as { since?: number }).since !== undefined)),
    team,
    lengthS: last / 1000,
    hits: fx.hits.length,
  };
  const stopAt = (t: number) => {
    const s = stops.find((x) => msOf(x.start) <= t && t < msOf(x.start + x.scales.length) && x.scales[Math.min(x.scales.length - 1, Math.max(0, Math.round(((t - msOf(x.start)) * FPS) / 1000)))]! < 1);
    return s ? (s.ultimate ? "ultimate" : `p${s.priority ?? "-"}`) : null;
  };
  const holdNear = (t: number, ms: number) => holds.filter((x) => Math.abs(msOf(x.frame) - t) <= ms).reduce((n, x) => n + x.frames, 0);
  const holdBefore = (t: number, ms: number) => holds.filter((x) => msOf(x.frame) <= t && t - msOf(x.frame) <= ms).reduce((n, x) => n + x.frames, 0);
  const cutNear = (op: string, t: number) => replay.castFlags.filter((x) => x.cast.operator === op && msOf(x.frame) <= t + 100 && t - msOf(x.frame) <= 1500).map((x) => x.kind);
  const spNear = (op: string, start: number) => replay.spTopUps.some((x) => x.operator === op && Math.abs(msOf(x.frame) - start) <= 200);
  const kitOf = new Map(fx.team.map((b) => [b.operator, effectiveKit(data, b)]));

  const hits: Row[] = [];
  for (const hit of fx.hits) {
    const v = verdicts.get(hit)!;
    const placed = placement.hits.get(hit);
    const reaction = parseReactionEvent(hit.event);
    const kit = kitOf.get(hit.operator);
    const ages = hit.effects.map((e) => (e as { since?: number }).since).filter((s): s is number => typeof s === "number").map((s) => hit.t - s);
    const row: Row = {
      fx: fight.fx,
      group,
      enemy: fx.enemy.id,
      parser: fight.parser,
      measured: fight.measured,
      team: team.join(","),
      lengthS: fight.lengthS,
      t: hit.t,
      tFrac: last ? hit.t / last : 0,
      operator: hit.operator,
      event: hit.event,
      kind: reaction?.kind ?? "skill",
      value: hit.value,
      uncapped: hit.uncapped ?? null,
      crit: hit.crit,
      element: hit.element,
      cls: verdictCount(v),
      assumed: v.kind === "match" ? v.assumptions.map((a) => a.kind) : [],
      assumedLabels: v.kind === "match" ? v.assumed : [],
      readingsTried: "readings" in v ? v.readings.tried : null,
      ...verdictReadingOf(v),
      listed: listedBuffs(hit.effects),
      boundary: hit.boundaryEffects.length,
      unquantified: hit.unquantified.map((u) => u.buff),
      minAge: ages.length ? Math.min(...ages) : null,
      loggedStagger: hit.effects.some((e) => /poise_break/.test(e.buff)),
      poiseBar: hit.poise?.bar ?? null,
      poiseDealt: hit.poise?.dealt ?? null,
      critSource: replay.critSource(hit),
      castKind: placed?.cast.kind ?? null,
      castSkill: placed?.cast.skillId ?? null,
      castGroup: placed?.cast.group ?? null,
      castStart: placed ? placed.cast.start : null,
      sinceCast: placed ? hit.t - placed.cast.start : null,
      slotIndex: placed?.index ?? null,
      slotFrame: placed?.frame ?? null,
      beforeStop: placed?.cast.beforeStop !== undefined,
      spTopUp: placed ? spNear(hit.operator, placed.cast.start) : false,
      stop: stopAt(hit.t),
      hold1s: holdNear(hit.t, 1000),
      holdBefore5s: holdBefore(hit.t, 5000),
      cuts: cutNear(hit.operator, hit.t),
      nearEnd: hit.t >= last - 1500,
      nearAway: away.some((w) => Math.abs(hit.t - w.from) <= 1000 || Math.abs(hit.t - w.to) <= 1000),
      staggerNear: replay.staggerNearChange(hit.t),
    };
    const e = byHit.get(hit);
    const predicted = e?.primary ?? null;
    row["predicted"] = predicted;
    row["expected"] = e?.expected ?? null;
    row["nReadings"] = e?.readings.length ?? 0;
    const basis = readingBasis(c, hit, hitPlace(data, fx, placement, lbr, hit));
    if ("unknown" in basis.landing) {
      row["unknown"] = basis.landing.unknown;
      hits.push(row);
      continue;
    }
    const ok = basis as Exclude<typeof basis, { readonly landing: { readonly unknown: string } }>;
    const { landing, primary } = ok;
    let d;
    try {
      d = landingDamage(data, c.target, primary.inputs, primary.options, primary.other);
    } catch (err) {
      if (!readingDoesNotApply(err)) throw err;
      row["unknown"] = "no reading applies";
      hits.push(row);
      continue;
    }
    let logReading: number | null = null;
    try {
      const lr = ok.logReading();
      logReading = roundDamage(landingDamage(data, c.target, lr.inputs, lr.options, lr.other).exact);
    } catch (err) {
      if (!readingDoesNotApply(err)) throw err;
    }
    const inputs = primary.inputs;
    const differences = logDifferences(c, hit, landing as Parameters<typeof logDifferences>[2]);
    // One difference at a time as the log lists it (its kit buffs' entries replaced by the log's, as the check's edge
    // toggles do), and Stagger the other way: which single disagreement, taken the log's way, moves the reading where.
    const readAt = (r: typeof primary): number | null => {
      try {
        return roundDamage(landingDamage(data, c.target, r.inputs, r.options, r.other).exact);
      } catch (err) {
        if (!readingDoesNotApply(err)) throw err;
        return null;
      }
    };
    const cf: Row[] = [];
    if (hit.crit !== null) cf.push({ what: "crit flipped", kind: "crit", reading: readAt({ ...primary, options: { ...primary.options, crit: hit.crit ? "never" : "always" } }) });
    for (const diff of differences) {
      if (diff.what === "Stagger") {
        cf.push({ what: "Stagger", kind: diff.kind, reading: readAt({ ...primary, options: { ...primary.options, staggered: !primary.options.staggered } }) });
        continue;
      }
      const keys = new Set(diff.what.split(" + "));
      const ofIt = (m: { kitBuff?: { owner: string; id: string } }) => m.kitBuff !== undefined && keys.has(`${m.kitBuff.owner}:${m.kitBuff.id}`);
      const names = new Set([...keys].flatMap((k) => c.names.ofKitBuff.get(k) ?? []));
      const listed = hit.effects.filter((x) => names.has(x.buff));
      const mods = primary.options.modifiers ?? [];
      const kept = ok.judged.filter((m) => !ofIt(m));
      cf.push({ what: diff.what, kind: diff.kind, reading: readAt({ ...primary, options: { ...primary.options, modifiers: [...mods.filter((m) => !ofIt(m)), ...loggedEntries(c, listed, names, kept, ok.category)] } }) });
    }
    const kitSkill = kit?.skills.find((s) => s.skillId === d.skillId);
    const kitHit = inputs.kind === "hit" ? inputs.hit : undefined;
    const facts = landing.facts;
    const mods = d.modifiers.map((m) => ({ zone: m.zone, value: m.value, src: m.kitBuff ? `kit ${m.kitBuff.owner}:${m.kitBuff.id}` : m.source }));
    Object.assign(row, {
      predicted: predicted ?? roundDamage(d.exact),
      exact: d.exact,
      logReading,
      landingMs: msOf(landing.frame),
      landingOperator: inputs.operator,
      skillId: d.skillId,
      hitId: d.hitId,
      skillKind: d.skillId.startsWith("reaction:") ? "status" : (kitSkill?.kind ?? (landing.cast === undefined ? "trigger" : "none")),
      damageType: kitHit?.damageType ?? null,
      nature: inputs.kind === "status" ? (reaction?.kind ?? "status") : landing.fixed ? "fixed" : landing.cast === undefined ? "trigger hit" : "kit hit",
      hitElement: d.element,
      reaction: inputs.kind === "status" ? { kind: inputs.reaction.kind, element: inputs.reaction.element, stacks: inputs.reaction.stacks } : null,
      replayCrit: typeof landing.loggedCrit === "boolean" ? landing.loggedCrit : (landing.crit ?? (landing.loggedCrit === null ? false : null)),
      engineStagger: inputs.options.staggered ?? false,
      zones: d.zones,
      mods,
      differences,
      cf,
      enemyStatus: facts ? [...facts.enemy.statuses.map((s) => `${s.status}${s.level > 1 ? s.level : ""}`), ...facts.enemy.physical.map((s) => s.status)] : [],
      controlled: facts?.controlled ?? null,
      layers: facts ? Object.entries(facts.buffLayers).filter(([, n]) => n > 1).map(([k, n]) => `${k}×${n}`) : [],
      consumed: facts?.consumed ?? null,
      castLink: facts?.castLink ?? null,
    });
    hits.push(row);
  }
  const shares = totalsShares(fx.hits, report.totals);
  const onesided: Row[] = report.totals.oneSided.map((x) => ({ fx: fight.fx, group, enemy: fx.enemy.id, team: team.join(","), logged: shares.logged, share: (100 * x.damage) / (shares.logged || 1), tFrac: last ? x.t / last : 0, ...x }));
  return { hits, onesided, fight: { ...fight, error: shares.error, matched: shares.matched, replayOnly: shares.replayOnly, logOnly: shares.logOnly, logged: shares.logged, errors: report.errors } };
}

if (!isMainThread) {
  parentPort?.on("message", (file: string) => {
    try {
      parentPort?.postMessage({ file, ...fixtureRows(file) });
    } catch (e) {
      parentPort?.postMessage({ file, error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) });
    }
  });
} else {
  const args = process.argv.slice(2);
  const wi = args.indexOf("--workers");
  const workers = wi >= 0 ? Number(args[wi + 1]) : 4;
  const ids = args.filter((a, i) => !a.startsWith("--") && (wi < 0 || i !== wi + 1));
  const files = devFixtures(ids.length ? { ids } : {}).filter((f) => f.dir !== "multi").map((f) => f.file);
  mkdirSync(OUT, { recursive: true });
  const all: { hits: Row[]; onesided: Row[]; fights: Row[] } = { hits: [], onesided: [], fights: [] };
  const queue = [...files];
  let failed = 0;
  const one = () =>
    new Promise<void>((done) => {
      const w = new Worker(new URL(import.meta.url));
      const next = () => {
        const f = queue.shift();
        if (f === undefined) {
          void w.terminate().then(() => done());
          return;
        }
        w.postMessage(f);
      };
      w.on("message", (m: { file: string; error?: string; hits?: Row[]; onesided?: Row[]; fight?: Row }) => {
        if (m.error) {
          failed++;
          process.stderr.write(`${m.file}: ${m.error}\n`);
        } else {
          all.hits.push(...(m.hits ?? []));
          all.onesided.push(...(m.onesided ?? []));
          all.fights.push(m.fight as Row);
          process.stderr.write(`done ${m.file} (${files.length - queue.length}/${files.length})\n`);
        }
        next();
      });
      w.on("error", (e) => {
        process.stderr.write(`worker: ${String(e)}\n`);
        failed++;
        done();
      });
      next();
    });
  await Promise.all(Array.from({ length: Math.max(1, Math.min(workers, files.length)) }, one));
  const jsonl = (rows: Row[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(join(OUT, "hits.jsonl"), jsonl(all.hits));
  writeFileSync(join(OUT, "onesided.jsonl"), jsonl(all.onesided));
  writeFileSync(join(OUT, "fights.jsonl"), jsonl(all.fights));
  process.stdout.write(`${all.fights.length} fights, ${all.hits.length} hits, ${all.onesided.length} one-sided rows\nEFSIM-DONE stats-build ${failed ? "fail" : "pass"}\n`);
}
