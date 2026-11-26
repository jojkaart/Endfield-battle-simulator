// `efsim zmdlogs ends`: per logged moment, which runs of the listed buffs end there and which go on across it (round
// 16, arcane-doubles-end report point 1: "did this buff end alone or with everything else?" took three scratch scripts,
// a per-run survey, a two-moment listing diff and a detector of moments where several enemy-side runs end together;
// every view until then was per buff: lanes, clock, trace-buff). The same table loggedPurges (holdinputs.ts) reads one
// rule over, and the log's moment spacing around each end (arcane-doubles-end point 3: an end within one grain of an
// event isn't evidence for either order; the log flushes every ~100 ms and at a stop's end).
//
// - listedRuns: every run of every listed game buff, one per buff, source, since and holder (the enemy for a debuff in
//   an enemy-side zone, TARGET_SIDE_ZONES, else the hitter), as holdinputs.ts loggedLaneEnds keys them: a boundary
//   effect at the run's start says nothing of its end, one at its end is the end.
// - momentSpacing: the gaps from a moment to the log's moments before and after it (the batching grain there).
// - momentEnds: at one moment, the runs whose last listing it is, those listed before or at it and again after, and
//   those starting at it or at the next moment.

import type { GameData } from "@efsim/engine";
import { loggedPurges } from "./holdinputs.ts";
import { frameOf } from "./castassembly.ts";
import { castsWithinGrain, logMoments, momentSpacing, operatorLabel, spacingText } from "./query.ts";
import { TARGET_SIDE_ZONES, type LogFixture } from "./zmdlogs.ts";

const s = (ms: number) => (ms / 1000).toFixed(2);

/** One run of a listed game buff (listedRuns): its holder's side, first and last listing, ms. */
export interface ListedRun {
  readonly buff: string;
  readonly source: string | null;
  readonly since: number | null;
  /** "enemy" (a debuff: an enemy-side zone) or the operator whose hits list it. */
  readonly holder: string;
  readonly side: "enemy" | "team";
  readonly first: number;
  readonly last: number;
  readonly listedHits: number;
  readonly values: readonly number[];
  /**
   * The first logged moment after `last` that could list it and doesn't: the next moment for a debuff (every hit lists
   * the enemy's), the holder's next hit for a team-side run; null: none.
   */
  readonly nextUnlisted: number | null;
}

/** One debuff's per-element affixes (buff_common_affixes_vulnerable_crystal and _natural) as one name (loggedPurges counts them once). */
export const affixFamily = (buff: string) => buff.replace(/^(buff_common_affixes_[a-z]+)_[a-z]+$/, "$1");

/** Every run of every listed game buff of a fight (one per buff, source, since and holder), in order of first listing. */
export function listedRuns(fx: Pick<LogFixture, "hits">): ListedRun[] {
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const runs = new Map<string, { buff: string; source: string | null; since: number | null; holder: string; side: "enemy" | "team"; first: number; last: number; at: Set<number>; values: Set<number> }>();
  for (const h of hits) {
    for (const e of [...h.effects, ...h.boundaryEffects.filter((x) => x.since !== h.t)]) {
      const side = TARGET_SIDE_ZONES.has(e.zone) ? "enemy" : "team";
      const holder = side === "enemy" ? `enemy${h.target ? `:${h.target}` : ""}` : h.operator;
      const key = `${e.buff}|${e.source ?? ""}|${e.since ?? ""}|${holder}`;
      const r = runs.get(key) ?? { buff: e.buff, source: e.source ?? null, since: e.since ?? null, holder, side, first: h.t, last: h.t, at: new Set<number>(), values: new Set<number>() };
      r.last = Math.max(r.last, h.t);
      r.at.add(h.t);
      r.values.add(+e.value.toFixed(6));
      runs.set(key, r);
    }
  }
  return [...runs.values()]
    .map((r): ListedRun => {
      // A debuff: the next hit on its enemy ("enemy" or "enemy:<target>"); a team-side run: its holder's next hit.
      const next = hits.find((h) => h.t > r.last && (r.side === "enemy" ? (h.target ?? "") === r.holder.slice("enemy:".length) : h.operator === r.holder));
      return { buff: r.buff, source: r.source, since: r.since, holder: r.holder, side: r.side, first: r.first, last: r.last, listedHits: r.at.size, values: [...r.values].sort((a, b) => a - b), nextUnlisted: next?.t ?? null };
    })
    .sort((a, b) => a.first - b.first || a.buff.localeCompare(b.buff));
}


/** At one logged moment (MomentEnds): the runs ending there, going on across it, starting at it or at the next moment. */
export interface MomentEnds {
  readonly t: number;
  readonly spacing: ReturnType<typeof momentSpacing>;
  readonly ending: readonly ListedRun[];
  readonly goingOn: readonly ListedRun[];
  readonly starting: readonly ListedRun[];
  /** loggedPurges reads it as the enemy's debuffs cleared at once (engine assumption logged-purges). */
  readonly purge: boolean;
}

/** The runs at moment `t` (momentEnds). */
export function momentEnds(t: number, runs: readonly ListedRun[], moments: readonly number[], purges: ReadonlySet<number> = new Set()): MomentEnds {
  const spacing = momentSpacing(moments, t);
  return {
    t,
    spacing,
    ending: runs.filter((r) => r.last === t),
    goingOn: runs.filter((r) => r.first <= t && r.last > t),
    starting: runs.filter((r) => r.first === t || (spacing.next !== null && r.first === spacing.next)),
    purge: purges.has(frameOf(t) + 1),
  };
}

export interface EndsOptions {
  /** One moment (ms; the nearest logged one): every run ending, going on and starting there. */
  readonly at?: number;
  readonly side?: "enemy" | "team";
  /** Without `at`: the moments where at least this many runs of the side end (debuffs' affixes once; default 2). */
  readonly min?: number;
  readonly from?: number;
  readonly to?: number;
  /** Only runs from these sources. */
  readonly operators?: readonly string[];
}

/**
 * `zmdlogs ends`: without `at`, every moment where at least `min` runs end (per side: how many end, how many of the
 * side's runs go on across it, a purge's shape and loggedPurges' reading), with the log's moment spacing; with `at`,
 * that moment's runs ending (with each one's next unlisted moment), going on (to their last listing) and starting.
 */
export function endsView(data: GameData, fx: LogFixture, o: EndsOptions = {}): string {
  const keep = (r: ListedRun) => (!o.side || r.side === o.side) && (!o.operators?.length || (r.source !== null && o.operators.includes(r.source)));
  const runs = listedRuns(fx).filter(keep);
  const moments = logMoments(fx);
  const purges = new Set(loggedPurges(fx));
  const who = (op: string | null) => (op ? operatorLabel(data, op) : "?");
  const holderWords = (r: ListedRun) => (r.side === "enemy" ? "on the enemy" : `on ${who(r.holder)}`);
  const vals = (r: ListedRun) => r.values.join(", ");
  // A debuff's per-element affixes from one source and since as one line.
  const fold = (rs: readonly ListedRun[]) => {
    const by = new Map<string, ListedRun[]>();
    for (const r of rs) {
      const k = `${affixFamily(r.buff)}|${r.source ?? ""}|${r.since ?? ""}|${r.holder}`;
      by.set(k, [...(by.get(k) ?? []), r]);
    }
    return [...by.values()];
  };
  const names = (g: readonly ListedRun[]) => (g.length === 1 ? (g[0] as ListedRun).buff : `${affixFamily((g[0] as ListedRun).buff)}_{${g.map((r) => r.buff.slice(affixFamily(r.buff).length + 1)).join(",")}}`);
  if (o.at !== undefined) {
    const at = o.at;
    const t = moments.reduce((best, m) => (Math.abs(m - at) < Math.abs(best - at) ? m : best), moments[0] ?? at);
    const m = momentEnds(t, runs, moments, purges);
    const casts = castsWithinGrain(fx, m.spacing, t);
    const line = (r: readonly ListedRun[], what: (x: ListedRun) => string) => `    ${names(r)} from ${who((r[0] as ListedRun).source)} ${holderWords(r[0] as ListedRun)}: since ${(r[0] as ListedRun).since === null ? "?" : s((r[0] as ListedRun).since as number)}, ${what(r[0] as ListedRun)}; value(s) ${vals(r[0] as ListedRun)}`;
    const side = (x: "enemy" | "team") => (g: readonly ListedRun[]) => (g[0] as ListedRun).side === x;
    const sections = (["enemy", "team"] as const).flatMap((x) => {
      const ending = fold(m.ending).filter(side(x));
      const going = fold(m.goingOn).filter(side(x));
      const starting = fold(m.starting).filter(side(x));
      if (!ending.length && !going.length && !starting.length) return [];
      return [
        `  ${x === "enemy" ? "enemy-side (debuffs)" : "team-side"}: ${ending.length} end here, ${going.length} go on${x === "enemy" && ending.length && !going.length ? " (every debuff listed at it ends: a purge's shape)" : ""}`,
        ...ending.map((g) => line(g, (r) => `listed ${s(r.first)}–${s(r.last)} on ${r.listedHits} hit(s), next unlisted ${r.nextUnlisted === null ? "none (the fight's end)" : s(r.nextUnlisted)}`)).map((l) => l.replace(/^ {4}/, "    END   ")),
        ...going.map((g) => line(g, (r) => `listed ${s(r.first)}–${s(r.last)}`)).map((l) => l.replace(/^ {4}/, "    ON    ")),
        ...starting.map((g) => line(g, (r) => `first listed ${s(r.first)}${r.first === t ? " (at this moment)" : " (the next moment)"}`)).map((l) => l.replace(/^ {4}/, "    START ")),
      ];
    });
    return [
      `${fx.id}: the runs of the listed buffs at ${s(t)} s${Math.abs(t - at) > 0.5 ? ` (the logged moment nearest ${s(at)} s)` : ""}: those whose last listing it is (END, with the next moment that could list them and doesn't), those listed before or at it and again after (ON), those first listed at it or at the next moment (START); ${spacingText(m.spacing)}${m.purge ? "; loggedPurges reads it as a purge (engine assumption logged-purges)" : ""}`,
      ...sections,
      ...(casts.length ? [`  the log's cast events from the moment before to the next: ${casts.map((c) => `${who(c.operator)} ${c.skill.replace(/^chr_\d+_[a-z0-9]+_/, "")} at ${s(c.t)}`).join(", ")} (within one grain of the end: the log can't order them)`] : []),
      "A run is one buff, source, since and holder (the enemy for an enemy-side zone, else the hitter); a team-side run is listed only on its holder's hits. The log's ms are batched (docs/design/data.md \"What the log records\"): within the spacing above, an end and an event have no order.",
    ].join("\n");
  }
  const min = o.min ?? 2;
  const lines: string[] = [];
  for (const t of moments) {
    if ((o.from !== undefined && t < o.from) || (o.to !== undefined && t > o.to)) continue;
    const m = momentEnds(t, runs, moments, purges);
    const parts = (["enemy", "team"] as const).flatMap((x) => {
      const ending = fold(m.ending).filter((g) => (g[0] as ListedRun).side === x);
      if (ending.length < min) return [];
      const going = fold(m.goingOn).filter((g) => (g[0] as ListedRun).side === x);
      const list = ending.map((g) => `${names(g)} from ${who((g[0] as ListedRun).source)}${x === "team" ? ` ${holderWords(g[0] as ListedRun)}` : ""}`).join("; ");
      return [`${x}: ${ending.length} end, ${going.length} go on${x === "enemy" && !going.length ? " (all)" : ""}: ${list}`];
    });
    if (!parts.length) continue;
    lines.push(`${s(t).padStart(7)}  ${spacingText(m.spacing)}${m.purge ? "  PURGE (loggedPurges)" : ""}\n           ${parts.join("\n           ")}`);
  }
  return [
    `${fx.id}: the logged moments where at least ${min} run(s) of the listed buffs end together${o.side ? ` (${o.side}-side only)` : ""} (a debuff's per-element affixes once), each with how many of that side's runs go on across it and the log's moment spacing there; "(all)": every debuff listed at it ends (a purge's shape; PURGE: loggedPurges' reading); times in s. --at <s> for one moment's runs`,
    ...(lines.length ? lines : ["  none"]),
  ].join("\n");
}
