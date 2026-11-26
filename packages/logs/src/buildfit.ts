// `efsim zmdlogs fit-build`: the build inputs a ZMDLogs export omits or may have wrong (attribute nodes, the weapon's
// level, food), fitted to an operator's hits. Each candidate build is scored by how many of the operator's landed kit
// hits its primary reading gives within the log check's ±1 (the reading recomputed with the candidate's panel:
// landingDamage, so a food's DMG and crit lines count as well as ATK), and separately on the clean ones: those where the
// log's listing and the engine's modifiers agree (no logDifferences), whose error can only be the build's. The exported
// build is scored too: an override (LogFixture.buildOverrides) is worth writing only when a candidate fits clearly more.
//
// It replaces hand fits in notes (docs/open-problems.md, "build offsets"): the counts are the evidence an override's
// `why` cites. Not searched: gear artifice, weapon skill levels, potential, skill levels (the log gives those), operator
// level. The weapon's level isn't bounded by its logged skill levels yet (WeaponBreakThroughTemplateTable's
// skillLevelBounds aren't loaded): check a fitted level against them by hand.

import { computeStats, DEFAULT_STAT_OPTIONS, foodOf, landingDamage, readingDoesNotApply, roundDamage, type Build, type GameData, type StatPanel } from "@efsim/engine";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { engineCheck, logDifferences, readingBasis, type Reading } from "./enginecheck.ts";
import { placeHits } from "./logcasts.ts";
import { hitPlace, logBuffReplay } from "./logcheck.ts";

/** One landed kit hit: its primary reading, which a candidate panel is put into; clean when the log and the engine agree on its modifiers. */
interface FitHit {
  readonly hit: LogHit;
  readonly reading: Reading;
  readonly clean: boolean;
}

/** The fields a candidate changes from the exported build (`food: null`: none). */
export interface BuildFitSet {
  readonly attributeNodes?: number;
  readonly weapon?: { readonly level: number };
  readonly food?: string | null;
}

export interface BuildCandidate {
  readonly set: BuildFitSet;
  readonly label: string;
  /** Landed hits within ±1 of the candidate's reading. */
  readonly fits: number;
  /** Of them, clean hits. */
  readonly cleanFits: number;
  /** Median of logged / the candidate's reading over the clean hits (over every landed hit without one). */
  readonly median: number;
}

export interface BuildFit {
  readonly operator: string;
  /** The operator's kit hits with a landing, and how many of them are clean. */
  readonly landed: number;
  readonly clean: number;
  readonly exported: BuildCandidate;
  /** The best candidates, most fitting hits first (fewest changed fields on a tie; one that a food or a level doesn't change is left out). */
  readonly best: readonly BuildCandidate[];
}

const median = (xs: readonly number[]) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
};

/** The operator's landed kit hits in a fixture (its builds as read: overrides applied). */
function fitHits(data: GameData, fx: LogFixture, operator: string, assume: Readonly<Record<string, string>> = {}): FitHit[] {
  const placement = placeHits(data, fx);
  const replay = logBuffReplay(data, fx, placement, Object.keys(assume).length ? { assume } : {});
  const c = engineCheck(data, fx, replay.replay);
  const out: FitHit[] = [];
  for (const hit of fx.hits) {
    if (hit.operator !== operator) continue;
    const basis = readingBasis(c, hit, hitPlace(data, fx, placement, replay, hit));
    if ("unknown" in basis.landing) continue;
    const { landing, primary } = basis as Exclude<typeof basis, { readonly landing: { readonly unknown: string } }>;
    if (primary.inputs.kind !== "hit" || !landing.inputs) continue;
    const clean = logDifferences(c, hit, landing as typeof landing & { readonly inputs: NonNullable<typeof landing.inputs> }).length === 0;
    out.push({ hit, reading: primary, clean });
  }
  return out;
}

/** The candidate's readings of a hit: its own panel (with food only within the food's duration); both crit readings when the log doesn't say. */
function readings(data: GameData, fx: LogFixture, h: FitHit, build: Build, panels: { readonly fed: StatPanel; readonly unfed: StatPanel }): number[] {
  const food = foodOf(data, build);
  const panel = food && h.hit.t >= food.duration * 1000 ? panels.unfed : panels.fed;
  const inputs = { ...h.reading.inputs, build, panel };
  const target = { enemy: fx.enemy.id, level: fx.enemy.level };
  const crits = h.hit.crit === null ? (["never", "always"] as const) : ([h.hit.crit ? "always" : "never"] as const);
  const out: number[] = [];
  for (const crit of crits) {
    try {
      out.push(landingDamage(data, target, inputs, { ...h.reading.options, crit }).exact);
    } catch (err) {
      if (!readingDoesNotApply(err)) throw err;
    }
  }
  return out;
}

/**
 * Fit an operator's attribute nodes, weapon level and food to its hits in a fixture: every combination is screened on
 * a sample of the hits, the promising ones scored on all of them. `top` candidates are returned.
 */
export function fitBuild(data: GameData, fx: LogFixture, operator: string, opts: { readonly top?: number; readonly foods?: boolean; readonly assume?: Readonly<Record<string, string>> } = {}): BuildFit {
  const base = fx.team.find((b) => b.operator === operator);
  if (!base) throw new Error(`${fx.id}: ${operator} isn't in the team`);
  const hits = fitHits(data, fx, operator, opts.assume);
  const score = (build: Build, hs: readonly FitHit[]): { fits: number; cleanFits: number; median: number } => {
    let panels: { fed: StatPanel; unfed: StatPanel };
    try {
      panels = { fed: computeStats(data, build), unfed: computeStats(data, build, { ...DEFAULT_STAT_OPTIONS, withoutFood: true }) };
    } catch {
      return { fits: -1, cleanFits: -1, median: NaN };
    }
    // A line with a part in an unknown formula slot (a food's DEF %: StatLine.unmodelled) can't be read by a kit value
    // that needs it (04d4's Catcher: his P1 hits scale with DEF), so such a candidate isn't scored.
    if (Object.values(panels.fed.attrs).some((l) => l?.unmodelled?.length)) return { fits: -1, cleanFits: -1, median: NaN };
    let fits = 0;
    let cleanFits = 0;
    const ratios: number[] = [];
    const cleanRatios: number[] = [];
    for (const h of hs) {
      const rs = readings(data, fx, h, build, panels);
      if (rs.length === 0) continue;
      const best = rs.reduce((a, r) => (Math.abs(roundDamage(r) - h.hit.value) < Math.abs(roundDamage(a) - h.hit.value) ? r : a));
      const fit = Math.abs(roundDamage(best) - h.hit.value) <= 1;
      if (fit) fits++;
      if (fit && h.clean) cleanFits++;
      ratios.push(h.hit.value / best);
      if (h.clean) cleanRatios.push(h.hit.value / best);
    }
    return { fits, cleanFits, median: median(cleanRatios.length ? cleanRatios : ratios) };
  };

  const nodeCounts: number[] = [];
  for (let n = 0; n <= 8; n++) {
    try {
      computeStats(data, { ...base, attributeNodes: n });
      nodeCounts.push(n);
    } catch {
      break;
    }
  }
  const allNodes = nodeCounts[nodeCounts.length - 1];
  const weapon = base.weapon;
  const levels = weapon ? Array.from({ length: 90 }, (_, i) => i + 1).filter((l) => data.weapons[weapon.id]?.baseAtk[l - 1] !== undefined) : [];
  const foods: (string | null)[] = [null, ...(opts.foods === false ? [] : Object.keys(data.foods ?? {}))];
  if (base.food !== undefined && !foods.includes(base.food)) foods.push(base.food);

  const describe = (set: BuildFitSet) =>
    [
      set.attributeNodes !== undefined ? `attributeNodes ${set.attributeNodes}` : null,
      set.weapon ? `weapon level ${set.weapon.level}` : null,
      set.food !== undefined ? (set.food === null ? "no food" : `food ${set.food} (${data.foods?.[set.food]?.name ?? "?"})`) : null,
    ]
      .filter(Boolean)
      .join(", ") || "as exported";
  const buildOf = (set: BuildFitSet): Build => {
    const { food, weapon: w, ...rest } = set;
    const b: Build = { ...base, ...rest, ...(w && weapon ? { weapon: { ...weapon, level: w.level } } : {}) };
    if (food === null) {
      const { food: _dropped, ...noFood } = b;
      void _dropped;
      return noFood;
    }
    return food !== undefined ? { ...b, food } : b;
  };
  const changes = (set: BuildFitSet) => Object.keys(set).length;

  const exported: BuildCandidate = { set: {}, label: "as exported", ...score(base, hits) };
  // A sample (about 24 hits, clean ones first) screens the combinations; those within a margin of the best are scored on all.
  const ordered = [...hits.filter((h) => h.clean), ...hits.filter((h) => !h.clean)];
  const step = Math.max(1, Math.floor(ordered.length / 24));
  const sample = ordered.filter((_, i) => i % step === 0);
  const screened: { set: BuildFitSet; fits: number }[] = [];
  for (const n of nodeCounts) {
    for (const level of weapon ? levels : [0]) {
      for (const food of foods) {
        const set: { attributeNodes?: number; weapon?: { level: number }; food?: string | null } = {};
        if (n !== (base.attributeNodes ?? allNodes)) set.attributeNodes = n;
        if (weapon && level !== weapon.level) set.weapon = { level };
        if ((food ?? undefined) !== base.food) set.food = food;
        screened.push({ set, fits: score(buildOf(set), sample).fits });
      }
    }
  }
  const bestSample = Math.max(...screened.map((s) => s.fits));
  const finalists = screened.filter((s) => s.fits > 0 && s.fits >= bestSample - Math.max(1, Math.ceil(sample.length / 8)));
  const scored = finalists.map((s): BuildCandidate => ({ set: s.set, label: describe(s.set), ...score(buildOf(s.set), hits) }));
  scored.sort((a, b) => b.fits - a.fits || b.cleanFits - a.cleanFits || changes(a.set) - changes(b.set) || Math.abs(a.median - 1) - Math.abs(b.median - 1));
  // A candidate that reads every hit as a simpler one does (a food without a line these hits see) says nothing more.
  const seen = new Set<string>();
  const best = scored.filter((c) => {
    const key = `${c.fits}|${c.cleanFits}|${c.median.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { operator, landed: hits.length, clean: hits.filter((h) => h.clean).length, exported, best: best.slice(0, opts.top ?? 8) };
}
