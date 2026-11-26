// `efsim zmdlogs boundaries <fixture…|--all>`: at the hits where a kit buff's logged run starts or ends (the log lists
// it at the hit's boundary: it can't say whether it applied), does the hit read with it or without it? Per kit buff and
// side (start, end), from the hit records' boundary counterfactuals (hitexport.ts hitCounterfactuals: the primary
// reading with the boundary entries as the log lists them, and with the engine's modifiers of it off). Round 16, the
// arcane-will report point 3: a rule "an end-boundary hit is past the run" was measured (5 min) and moved 30 logs both
// ways; this table is the pattern's base rate in seconds, its direction known before a measure.

import type { GameData } from "@efsim/engine";
import { teamBuffNames } from "./enginecheck.ts";
import type { HitRecord } from "./hitexport.ts";
import { hitOfRecord } from "./listingview.ts";
import type { LogFixture } from "./zmdlogs.ts";

/** A reading this close to the logged value fits it (|logged − reading| ≤ max(1, this share of logged)). */
export const BOUNDARY_FIT = 0.001;

const fits = (logged: number, reading: number | null) => reading !== null && Math.abs(logged - reading) <= Math.max(1, BOUNDARY_FIT * logged);

/** One kit buff's boundary hits on one side (boundaryRows). */
export interface BoundaryRow {
  readonly kitBuff: string;
  /** "start": the hit is at the run's start (its since); "end": at its end. */
  readonly side: "start" | "end";
  readonly hits: number;
  /** Hits where the engine had the kit buff on at the landing. */
  readonly engineOn: number;
  /** Fits with it (as the log lists it there), without it (the engine's modifiers of it off: only where it had it), both, neither. */
  readonly withIt: number;
  readonly withoutIt: number;
  readonly both: number;
  readonly neither: number;
  readonly logs: number;
}

/**
 * The rows over some fixtures' records: every kit hit with a "boundary on" counterfactual, its side by the boundary
 * entry's since (at the hit: the run's start, else its end), what fits. Without the engine having it, "without" is the
 * primary reading itself (nothing to take off).
 */
export function boundaryRows(data: GameData, records: readonly HitRecord[], fixtureOf: (file: string) => LogFixture, opts: { readonly kitBuff?: RegExp } = {}): BoundaryRow[] {
  const hitOf = new Map<string, ReturnType<typeof hitOfRecord>>();
  const namesOf = new Map<string, ReturnType<typeof teamBuffNames>>();
  const acc = new Map<string, { hits: number; engineOn: number; withIt: number; withoutIt: number; both: number; neither: number; logs: Set<string> }>();
  for (const r of records) {
    const cfs = r.counterfactuals ?? [];
    if (!cfs.some((c) => c.kind === "boundary on")) continue;
    let of = hitOf.get(r.fixture);
    if (!of) {
      const fx = fixtureOf(r.fixture);
      hitOf.set(r.fixture, (of = hitOfRecord(fx)));
      namesOf.set(r.fixture, teamBuffNames(data, fx));
    }
    const h = of(r);
    const names = namesOf.get(r.fixture);
    if (!h || !names) continue;
    for (const on of cfs.filter((c) => c.kind === "boundary on")) {
      if (opts.kitBuff && !opts.kitBuff.test(on.what)) continue;
      const off = cfs.find((c) => c.kind === "boundary off" && c.what === on.what);
      // The kit buff's own boundary entries at the hit (its logged names): at the run's since a start, else an end.
      const logged = new Set(names.ofKitBuff.get(on.what) ?? []);
      const side: "start" | "end" = h.boundaryEffects.some((e) => logged.has(e.buff) && e.since === h.t) ? "start" : "end";
      const k = `${on.what}|${side}`;
      const a = acc.get(k) ?? { hits: 0, engineOn: 0, withIt: 0, withoutIt: 0, both: 0, neither: 0, logs: new Set<string>() };
      a.hits++;
      a.logs.add(r.fixture);
      if (on.engineHas) a.engineOn++;
      // With it: the primary reading where the engine had it on, else the log's entries added ("boundary on" adds them
      // to the engine's modifiers, so it would count the buff twice where the engine had it); without it: the engine's
      // modifiers of it off ("boundary off"), else the primary reading.
      const [w, wo] = on.engineHas ? [fits(r.value, r.predicted), fits(r.value, off?.reading ?? null)] : [fits(r.value, on.reading), fits(r.value, r.predicted)];
      if (w && wo) a.both++;
      else if (w) a.withIt++;
      else if (wo) a.withoutIt++;
      else a.neither++;
      acc.set(k, a);
    }
  }
  return [...acc]
    .map(([k, a]) => {
      const [kitBuff, side] = k.split("|") as [string, "start" | "end"];
      return { kitBuff, side, hits: a.hits, engineOn: a.engineOn, withIt: a.withIt, withoutIt: a.withoutIt, both: a.both, neither: a.neither, logs: a.logs.size };
    })
    .sort((a, b) => b.hits - a.hits || a.kitBuff.localeCompare(b.kitBuff) || a.side.localeCompare(b.side));
}

/** The view: a row per kit buff and side, then the totals per side. */
export function boundaryView(rows: readonly BoundaryRow[], logs: number): string {
  const sum = (side: "start" | "end", k: keyof Pick<BoundaryRow, "hits" | "withIt" | "withoutIt" | "both" | "neither">) => rows.filter((r) => r.side === side).reduce((n, r) => n + r[k], 0);
  const row = (r: Pick<BoundaryRow, "hits" | "withIt" | "withoutIt" | "both" | "neither">) => `${String(r.hits).padStart(5)} hits: with it ${String(r.withIt).padStart(4)}, without ${String(r.withoutIt).padStart(4)}, both ${String(r.both).padStart(4)}, neither ${String(r.neither).padStart(4)}`;
  return [
    `Kit buffs listed at a hit's boundary (the log can't say whether they applied) over ${logs} log(s): per kit buff and side (start: the hit at the run's since; end: at its last listing), whether the hit fits (within ${100 * BOUNDARY_FIT}%) with it (the primary reading where the engine had it, else the log's entries added), without it (the engine's modifiers of it off, else the primary reading), both or neither (another factor off too: hitexport.ts hitCounterfactuals change one thing). A rule for one side reads its row first`,
    ...rows.map((r) => `  ${r.side.padEnd(5)} ${row(r)}  (engine had it ${r.engineOn}; ${r.logs} log(s))  ${r.kitBuff}`),
    `total start ${row({ hits: sum("start", "hits"), withIt: sum("start", "withIt"), withoutIt: sum("start", "withoutIt"), both: sum("start", "both"), neither: sum("start", "neither") })}`,
    `total end   ${row({ hits: sum("end", "hits"), withIt: sum("end", "withIt"), withoutIt: sum("end", "withoutIt"), both: sum("end", "both"), neither: sum("end", "neither") })}`,
  ].join("\n");
}
