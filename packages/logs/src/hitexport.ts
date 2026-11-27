// `efsim zmdlogs hits`: the log check's per-hit numbers as records, one per logged hit, for analyses across logs ("does
// X trend with Y"): the logged value, the verdict, the engine's primary reading with its scale parts, zones and
// modifier sources, the landing's operator, and for kit hits the enemy's statuses there (applier, level, Arts
// Intensity: the landing's facts; a status event's own landing records none, so read the next kit hit's); beside the
// engine's side, the log's own listing at the hit (`listed`) and where the two disagree (`differences`: logDifferences,
// what the check's "where it and the log disagree" counts).
// The same computations as `zmdlogs check` (logBuffReplay, engineHits, checkLog, readingBasis), not a copy of them.
// The engine's error on a hit, as the check judges it: `graded` (the uncapped logged value against the verdict's
// reading); `predicted` / `error` are the primary reading's, `logReading` the log's; `counterfactuals` (round 11) the
// primary with one disagreement taken the log's way (hitCounterfactuals).

import { basename } from "node:path";
import { activeAt, FPS, landingDamage, parseReactionEvent, readingDoesNotApply, reaches, roundDamage, type ActiveBuff, type AttrType, type GameData, type KitHit, type LandedHit, type LandingInputs, type Situation, type StatPanel, type Zones } from "@efsim/engine";
import type { LogFixture } from "./zmdlogs.ts";
import { fightTargets, logDifferences, loggedEntries, type EngineCheck, type LogDifference, type ReadingBasis, type TotalsCrit } from "./enginecheck.ts";
import type { LogHit } from "./zmdlogs.ts";
import { verdictCount, type HitVerdict, type VerdictCount } from "./logcheck.ts";
import type { Assumption } from "./assumptions.ts";
import { unknownFacts } from "./buffreplay.ts";
import { composeCheck } from "./snapshotentry.ts";
import type { CritSource } from "./replaycrits.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;

export interface HitRecord {
  /** The fixture's path as given (or its id). */
  readonly fixture: string;
  readonly t: number;
  readonly operator: string;
  readonly event: string;
  /** The reaction kind (reactions.ts parseReactionEvent), or "skill" for a kit hit. */
  readonly kind: string;
  readonly value: number;
  readonly crit: boolean | null;
  /** The verdict's kind: "match" for every match class (plain, assumed, fallback); the class is `class`. */
  readonly verdict: HitVerdict["kind"];
  /** The verdict's count class (plain, assumed, fallback, mismatch, …), as the snapshots count it. */
  readonly class: VerdictCount;
  /**
   * A non-plain match's assumptions (the verdict's first fitting reading: kind, label, buffs, n), which `zmdlogs
   * assumed` folds and `zmdlogs groups` reads for the casts matched only as another kit hit (round 15: the low-plain
   * round needed a probe over composeCheck for them, and the 0c14 round a ratio hunt). Absent for every other hit.
   */
  readonly assumptions?: readonly Assumption[];
  /**
   * The engine's primary reading of the replay's landing (engineHits), rounded; null without a landing or when no
   * reading applies. Not always the number the verdict rests on: a fallback match is the log listing's reading, and the
   * landing has the replay's own crit where the log gives none (`crit: null`), the verdict the logged one. That one is
   * `verdictReading` (round 5: Rossi's ticks read −31.7% here while their verdict was a plain match).
   */
  readonly predicted: number | null;
  /** logged / predicted − 1 (null without a prediction). Not the verdict's error: `verdictError`. */
  readonly error: number | null;
  /**
   * The number the fight's totals count for the hit (logcheck.ts engineReport: the primary reading, or for a hit whose
   * crit the log doesn't give its reading at the crit the totals take), rounded, and how they took that crit
   * (enginecheck.ts TotalsCrit: known, exact, read, expected); absent without a primary reading. `zmdlogs totals --by
   * crit` sums them per operator.
   */
  readonly totalsPredicted?: number;
  readonly totalsCrit?: TotalsCrit;
  /**
   * The reading the verdict rests on: a match's, an unquantified or unvalued hit's predicted value; a mismatch's nearest
   * reading tried (its first); null for an uncovered hit.
   */
  readonly verdictReading?: number | null;
  /** logged / verdictReading − 1 (a mismatch: its ratio − 1; null without one). */
  readonly verdictError?: number | null;
  /** The pair the check judges (Graded): use it for the engine's error on a hit. */
  readonly graded?: Graded | null;
  /**
   * The log's reading (ReadingBasis.logReading): the hit with every team kit buff as the log lists it, in place of the
   * replay's, rounded; and logged / it − 1. Off under both readings: the build or a kit value; off only under the
   * primary: the replay's timing. Kit and status hits with a landing; null when no reading applies. A ticking buff's
   * hit is read at its tick, with no snapshot of the buffs at its application but a Combustion's.
   */
  readonly logReading?: number | null;
  readonly logError?: number | null;
  /**
   * Facts the replay doesn't know that the hit's operator's kit reads (buffreplay.ts unknownFacts: "enemy HP unknown"
   * where an enemyHpBelow condition is read as full HP). A label: the verdict doesn't take it.
   */
  readonly unknownFacts?: readonly string[];
  /** Why the replay has no landing for the hit. */
  readonly unknown?: string;
  /**
   * In a fight read per target (fixture severalTargets, several-targets `targets`: enginecheck.ts fightTargets), the
   * hit's target: its index (in order of first hit), how it was chosen (targets.ts HitTarget.how), the enemy-side units
   * its reading leaves out (`drop`: `owner:buff`, `status:corrosion`, …) and whether it killed it. Text lines: `T<n>`.
   * `landing`: the targets the replay's landing was on (LandedHit.target, then its otherTargets: a landing logged on
   * several; target-statuses `per-target`, the second replay's ids from the first assignment), where it has them; the
   * text line flags a hit whose target isn't among them (`≠ landing T<m>`: the check read the hit at another target's
   * statuses than the replay landed it on; round 21, the statuses-per-target report point 2).
   */
  readonly target?: { readonly index: number; readonly how: string; readonly drop: readonly string[]; readonly kills: boolean; readonly landing?: readonly number[] };
  /** The crit the replay's landing took (LandedHit.crit; null where the hit can't crit), with a landing. */
  readonly replayCrit?: boolean | null;
  /** Where that crit comes from (replaycrits.ts CritSource: the log, an inference from the log, or none). */
  readonly critSource?: CritSource;
  /** The game buffs the log lists at the hit (its effects, one entry per buff with its instance count when above 1: "id ×2"). */
  readonly listed: readonly string[];
  /**
   * For a buff the log lists more than once at the hit: each entry's lane start (ms; null where the import has none), in
   * the listing's order (round 20, the Liino report point 3: whether 9 listed Medicant entries are 9 layers took a join
   * of every JSON line back to its fixture).
   */
  readonly listedSinces?: Readonly<Record<string, readonly (number | null)[]>>;
  /**
   * Where the log's listing and the engine's modifiers at the landing disagree (logDifferences: kit buffs by their
   * logged names, Stagger): "engine" has it and the log doesn't list it, "log" the reverse, "values" both with other
   * values. Kit hits with a landing only.
   */
  readonly differences?: readonly LogDifference[];
  /**
   * The primary reading with one disagreement taken the log's way, each rounded (null: no reading applies): per
   * difference its kit buffs' entries as the log lists them (Stagger: the other way); the crit flipped where the log
   * gives one; a kit buff the log lists at the hit's boundary on and off; Stagger the other way at its boundary
   * (hitCounterfactuals). Which single disagreement makes the hit fit (backlog after round 10 point 5: the
   * misprediction analysis's largest class, which scripts/probes/stats/build.ts re-derived). Kit hits with a landing.
   */
  readonly counterfactuals?: readonly Counterfactual[];
  readonly landing?: {
    readonly frame: number;
    /** The replay's cast it belongs to (LandedHit.cast: an index into its timeline's casts), when a cast made it. */
    readonly cast?: number;
    readonly operator: string;
    readonly skillId: string;
    readonly hitId: string;
    /** The primary reading's unrounded damage, scale parts, zones and modifiers (source, zone, element, value). */
    readonly exact: number;
    readonly scaleParts: readonly { readonly key: string; readonly value: number }[];
    readonly zones: Zones;
    readonly modifiers: readonly { readonly source: string; readonly zone: string; readonly element?: string; readonly value: number; readonly kitBuff?: string }[];
    /** A status event's reaction (kind, element, stacks). */
    readonly reaction?: { readonly kind: string; readonly element: string; readonly stacks: number };
    /** A hit whose multiplier multiplies another base than ATK (KitHit.base): that base and its attributes' parts (baseBreakdown). */
    readonly base?: HitBase;
    /**
     * A kit hit's enemy statuses at the landing (before its own applications): applier, level, Arts Intensity, from
     * EnemyStatus.statuses (reactions: Combustion, Corrosion, ...) and, with `physical: true`, EnemyStatus.physical
     * (Breach, Lift, Crush, Knock Down). `appliedAt` is the engine's frame (30 a second), `appliedAtMs` the same in ms
     * (the log's LogEffect.since is in ms). Control statuses and Vulnerable aren't exported. Status events record none.
     */
    readonly enemy?: readonly { readonly status: string; readonly level: number; readonly operator: string; readonly artsIntensity: number; readonly appliedAt: number; readonly appliedAtMs: number; readonly damageScale?: number; readonly physical?: true }[];
  };
}

/**
 * A base other than ATK (KitHit.base, an expression of the operator's attributes: 04d4's Catcher strikes at 300 + 5 ×
 * DEF), with each attribute it reads: the panel's line (base, add, percent, flat, multiply, its total and the sources
 * that make it), what the fight's buffs add (the reading's own attrBonus) and the active buffs with entries on it
 * (points, or a percentage of the line). Round 20 (the build-fits report point 4): Catcher's 1457.6 took three kit
 * files and the BuffData trees to take apart.
 */
export interface HitBase {
  readonly value: number;
  readonly expr: unknown;
  readonly attrs: readonly {
    readonly attr: number;
    readonly name: string;
    /** The panel's value of it plus the fight's buffs': what the expression read. */
    readonly value: number;
    readonly panel: { readonly base: number; readonly add: number; readonly percent: number; readonly flat: number; readonly multiply: number; readonly total: number; readonly contributions: readonly { readonly source: string; readonly value: number }[] } | null;
    readonly inFight: number;
    readonly buffs: readonly { readonly buff: string; readonly value: number; readonly percent?: true }[];
  }[];
}

/** The attributes an expression reads (`{attr: n}` anywhere in it, `attrAtLeast` too). */
function exprAttrs(e: unknown, out = new Set<number>()): Set<number> {
  if (Array.isArray(e)) for (const x of e) exprAttrs(x, out);
  else if (e && typeof e === "object") {
    for (const [k, v] of Object.entries(e)) {
      if (k === "attr" && typeof v === "number") out.add(v);
      else if (k === "attrAtLeast" && Array.isArray(v)) {
        for (const a of v) if (typeof a === "number") out.add(a);
      } else exprAttrs(v, out);
    }
  }
  return out;
}

/** A kit hit's base breakdown (HitBase), or undefined for a hit on ATK. `buffs`: the replay's active buffs at the landing. */
export function baseBreakdown(inputs: LandingInputs, hit: KitHit, situation: Situation | undefined, frame: number, baseValue: number, buffs: readonly ActiveBuff[] | null): HitBase | undefined {
  if (inputs.kind !== "hit" || hit.base === undefined) return undefined;
  const panel: StatPanel = inputs.panel;
  const attrs = [...exprAttrs(hit.base)].map((attr) => {
    const line = panel.attrs[attr];
    const inFight = situation?.attrBonus?.(attr as AttrType) ?? 0;
    const on = (buffs ?? []).filter((b) => activeAt(b, frame) && reaches(b, inputs.operator) && b.attrs?.some((a) => a.attr === attr));
    return {
      attr,
      name: line?.name ?? String(attr),
      value: (line?.total ?? 0) + inFight,
      panel: line ? { base: line.base, add: line.add, percent: line.percent, flat: line.flat, multiply: line.multiply, total: line.total, contributions: line.contributions.map((c) => ({ source: c.source, value: c.value })) } : null,
      inFight,
      buffs: on.flatMap((b) => (b.attrs ?? []).filter((a) => a.attr === attr).map((a) => ({ buff: `${b.owner}:${b.id}`, value: a.value, ...(a.percent ? { percent: true as const } : {}) }))),
    };
  });
  return { value: baseValue, expr: hit.base, attrs };
}

/** Every logged hit of a fixture as a record (the multi-target fixtures aren't checked: single-target engine). */
export function hitRecords(raw: GameData, fx: LogFixture, fixture: string = fx.id, assume: Readonly<Record<string, string>> = {}): HitRecord[] {
  // The snapshots' composition (snapshotentry.ts composeCheck): the same placement, replay (under other readings of
  // open assumptions, `zmdlogs hits --assume`), engine readings and verdicts, so the records are the suite's reading.
  const k = composeCheck(raw, fx, { assume });
  const { data, replay, byHit } = k;
  const verdicts = new Map(k.verdicts.map((v) => [v.hit, v]));
  const c = k.check();
  const facts = unknownFacts(data, fx, assume);
  const targets = fightTargets(c);
  return fx.hits.map((hit) => {
    const v = verdicts.get(hit) as HitVerdict;
    const tg = targets?.of.get(hit);
    const base = {
      fixture,
      t: hit.t,
      operator: hit.operator,
      event: hit.event,
      kind: parseReactionEvent(hit.event)?.kind ?? "skill",
      value: hit.value,
      crit: hit.crit,
      verdict: v.kind,
      class: verdictCount(v),
      ...(v.kind === "match" && v.assumptions.length ? { assumptions: v.assumptions } : {}),
      ...verdictReadingOf(v),
      listed: listedBuffs(hit.effects),
      ...listedSincesOf(hit.effects),
      critSource: replay.replay.critSource(hit),
      ...(facts.get(hit.operator) ? { unknownFacts: facts.get(hit.operator) as readonly string[] } : {}),
      ...(tg ? { target: { index: tg.target, how: tg.how, drop: [...tg.drop].sort(), kills: tg.kills, ...landingTarget(byHit.get(hit)?.landing) } } : {}),
    };
    const e = byHit.get(hit);
    const predicted = e?.primary ?? null;
    const error = predicted ? hit.value / predicted - 1 : null;
    const totals = predicted !== null && e ? { totalsPredicted: roundDamage(e.expected ?? predicted), totalsCrit: e.totalsCrit ?? ("known" as const) } : {};
    const basis = k.basis(hit);
    if ("unknown" in basis.landing) return { ...base, predicted, error, ...totals, unknown: basis.landing.unknown };
    const ok = basis as Exclude<typeof basis, { readonly landing: { readonly unknown: string } }>;
    const { landing, primary } = ok;
    let d;
    try {
      d = landingDamage(data, c.target, primary.inputs, primary.options, primary.other);
    } catch (err) {
      if (!readingDoesNotApply(err)) throw err;
      return { ...base, predicted, error, ...totals, unknown: "no reading applies" };
    }
    const inputs = primary.inputs;
    const lr = ok.logReading();
    let logReading: number | null = null;
    try {
      logReading = roundDamage(landingDamage(data, c.target, lr.inputs, lr.options, lr.other).exact);
    } catch (err) {
      if (!readingDoesNotApply(err)) throw err;
    }
    const differences = landing.inputs ? logDifferences(c, hit, landing as typeof landing & { readonly inputs: NonNullable<typeof landing.inputs> }) : [];
    const counterfactuals = hitCounterfactuals(c, hit, ok, differences);
    return {
      ...base,
      // A logged (or inferred) crit is the landing's; one the log doesn't give lands without one in the replay the check reads.
      replayCrit: typeof landing.loggedCrit === "boolean" ? landing.loggedCrit : (landing.crit ?? (landing.loggedCrit === null ? false : null)),
      ...(differences.length ? { differences } : {}),
      ...(counterfactuals.length ? { counterfactuals } : {}),
      predicted: predicted ?? roundDamage(d.exact),
      error: hit.value / (predicted ?? roundDamage(d.exact)) - 1,
      ...totals,
      logReading,
      logError: logReading ? hit.value / logReading - 1 : null,
      landing: {
        frame: landing.frame,
        ...(landing.cast !== undefined ? { cast: landing.cast } : {}),
        operator: inputs.operator,
        skillId: d.skillId,
        hitId: d.hitId,
        exact: d.exact,
        scaleParts: d.scaleParts,
        zones: d.zones,
        modifiers: d.modifiers.map((m) => ({ source: m.source, zone: m.zone, ...(m.element ? { element: m.element } : {}), value: m.value, ...(m.kitBuff ? { kitBuff: `${m.kitBuff.owner}:${m.kitBuff.id}` } : {}) })),
        ...(inputs.kind === "status" ? { reaction: { kind: inputs.reaction.kind, element: inputs.reaction.element, stacks: inputs.reaction.stacks } } : {}),
        ...(() => {
          if (inputs.kind !== "hit") return {};
          const b = baseBreakdown(inputs, primary.other?.hit ?? inputs.hit, primary.options.situation, landing.frame, d.zones.atk, (primary.other?.hit ?? inputs.hit).base !== undefined ? (replay.replay.stateAt(landing.frame)?.buffs ?? null) : null);
          return b ? { base: b } : {};
        })(),
        ...(landing.facts
          ? {
              enemy: [...landing.facts.enemy.statuses.map((s) => ({ s, physical: false })), ...landing.facts.enemy.physical.map((s) => ({ s, physical: true }))].map(({ s, physical }) => ({
                status: s.status,
                level: s.level,
                operator: s.operator,
                artsIntensity: s.artsIntensity,
                appliedAt: s.appliedAt,
                appliedAtMs: msOf(s.appliedAt),
                ...(s.damageScale ? { damageScale: s.damageScale.value } : {}),
                ...(physical ? { physical: true as const } : {}),
              })),
            }
          : {}),
      },
    };
  });
}

/** One counterfactual reading of a hit (HitRecord.counterfactuals). */
export interface Counterfactual {
  /** Its kit buffs (`owner:id`, joined), "Stagger" or "crit flipped". */
  readonly what: string;
  /** A difference's kind (engine / log / values), "crit", or a boundary's: "boundary on" / "boundary off" (a kit buff), "boundary" (Stagger). */
  readonly kind: LogDifference["kind"] | "crit" | "boundary on" | "boundary off" | "boundary";
  /** For a boundary kit buff: whether the engine has it at the hit. */
  readonly engineHas?: boolean;
  readonly reading: number | null;
}

/**
 * A hit's counterfactual readings (HitRecord.counterfactuals): the primary reading of `basis` with one change each, as
 * the check's own edge toggles make it (its kit buffs' engine modifiers replaced by the log's entries: loggedEntries).
 */
export function hitCounterfactuals(c: EngineCheck, hit: LogHit, basis: Exclude<ReadingBasis, { readonly landing: { readonly unknown: string } }> | ReadingBasis, differences: readonly LogDifference[]): Counterfactual[] {
  if ("unknown" in basis.landing) return [];
  const ok = basis as ReadingBasis;
  const { primary } = ok;
  const readAt = (r: typeof primary): number | null => {
    try {
      return roundDamage(landingDamage(c.data, c.target, r.inputs, r.options, r.other).exact);
    } catch (err) {
      if (!readingDoesNotApply(err)) throw err;
      return null;
    }
  };
  type KitMod = { readonly kitBuff?: { readonly owner: string; readonly id: string } };
  const of = (keys: ReadonlySet<string>) => (m: KitMod) => m.kitBuff !== undefined && keys.has(`${m.kitBuff.owner}:${m.kitBuff.id}`);
  const out: Counterfactual[] = [];
  if (hit.crit !== null) out.push({ what: "crit flipped", kind: "crit", reading: readAt({ ...primary, options: { ...primary.options, crit: hit.crit ? "never" : "always" } }) });
  // The log's boundary effects (a buff starting or ending at the hit) of team kit buffs, one kit buff at a time: as the
  // log lists them there (added) and off (the engine's modifiers of it removed); Stagger the other way at its boundary.
  const mods = primary.options.modifiers ?? [];
  for (const k of new Set(hit.boundaryEffects.flatMap((e) => c.names.byGameBuff.get(e.buff) ?? []))) {
    const ofIt = of(new Set([k]));
    const names = new Set(c.names.ofKitBuff.get(k) ?? []);
    const at = hit.boundaryEffects.filter((x) => names.has(x.buff));
    const kept = ok.judged.filter((m) => !ofIt(m));
    const on = mods.some(ofIt);
    out.push({ what: k, kind: "boundary on", engineHas: on, reading: readAt({ ...primary, options: { ...primary.options, modifiers: [...mods, ...loggedEntries(c, at, names, kept, ok.category)] } }) });
    if (on) out.push({ what: k, kind: "boundary off", engineHas: on, reading: readAt({ ...primary, options: { ...primary.options, modifiers: mods.filter((m) => !ofIt(m)) } }) });
  }
  if (hit.boundaryEffects.some((e) => /poise_break/.test(e.buff)) && !differences.some((x) => x.what === "Stagger")) {
    out.push({ what: "Stagger", kind: "boundary", reading: readAt({ ...primary, options: { ...primary.options, staggered: !primary.options.staggered } }) });
  }
  for (const diff of differences) {
    if (diff.what === "Stagger") {
      out.push({ what: "Stagger", kind: diff.kind, reading: readAt({ ...primary, options: { ...primary.options, staggered: !primary.options.staggered } }) });
      continue;
    }
    const keys = new Set(diff.what.split(" + "));
    const ofIt = of(keys);
    const names = new Set([...keys].flatMap((k) => c.names.ofKitBuff.get(k) ?? []));
    const listed = hit.effects.filter((x) => names.has(x.buff));
    const kept = ok.judged.filter((m) => !ofIt(m));
    out.push({ what: diff.what, kind: diff.kind, reading: readAt({ ...primary, options: { ...primary.options, modifiers: [...mods.filter((m) => !ofIt(m)), ...loggedEntries(c, listed, names, kept, ok.category)] } }) });
  }
  return out;
}

/** The reading a verdict rests on and the logged value's error against it (HitRecord.verdictReading, verdictError). */
export function verdictReadingOf(v: HitVerdict): { verdictReading: number | null; verdictError: number | null; graded: Graded | null } {
  if (v.kind === "uncovered") return { verdictReading: null, verdictError: null, graded: null };
  // What the check compares: a killing blow's uncapped value (its value is the HP that was left), against the reading
  // it matched or the nearest tried (a crit-less hit's: the crit or not that fits).
  const logged = v.hit.uncapped ?? v.hit.value;
  if (v.kind === "mismatch") {
    const p = v.predicted[0] ?? null;
    return { verdictReading: p, verdictError: v.ratio - 1, graded: p ? { logged, predicted: p, error: v.ratio - 1 } : null };
  }
  return { verdictReading: v.predicted, verdictError: v.predicted ? v.hit.value / v.predicted - 1 : null, graded: v.predicted ? { logged, predicted: v.predicted, error: logged / v.predicted - 1 } : null };
}

/**
 * The pair the log check judges a hit by: the logged value it compares (`uncapped` for a killing blow) and the reading
 * the verdict rests on (verdictReading: a match's, a mismatch's nearest; for a hit without a logged crit, the crit or
 * not that the check found nearer), with logged / predicted − 1. The engine's error on the hit for any statistic
 * across logs (misprediction-stats report point 2: plain `value` against `predicted` put 10.7% of the error on plain
 * matches, the killing blows'). Null for an uncovered hit or one without a reading.
 */
export interface Graded {
  readonly logged: number;
  readonly predicted: number;
  readonly error: number;
}

/** The game buffs a hit's effects list, each once with its instance count when above 1 ("id ×2"), in listing order. */
/** HitRecord.listedSinces: the lane starts of each buff listed more than once (no field when none is). */
export function listedSincesOf(effects: readonly { readonly buff: string; readonly since?: number }[]): { listedSinces?: Record<string, (number | null)[]> } {
  const by = new Map<string, (number | null)[]>();
  for (const e of effects) by.set(e.buff, [...(by.get(e.buff) ?? []), e.since ?? null]);
  const many = [...by].filter(([, s]) => s.length > 1);
  return many.length ? { listedSinces: Object.fromEntries(many) } : {};
}

export function listedBuffs(effects: readonly { readonly buff: string }[]): string[] {
  const n = new Map<string, number>();
  for (const e of effects) n.set(e.buff, (n.get(e.buff) ?? 0) + 1);
  return [...n].map(([b, k]) => (k > 1 ? `${b} ×${k}` : b));
}

/** The records of a reaction kind, of some operators, whose event key matches, logged from `from` to `to` (ms, both included). */
export function filterRecords(records: readonly HitRecord[], opts: { readonly kind?: string; readonly operators?: readonly string[]; readonly event?: RegExp; readonly from?: number; readonly to?: number }): HitRecord[] {
  return records.filter(
    (r) =>
      (opts.kind === undefined || r.kind === opts.kind) &&
      (!opts.operators?.length || opts.operators.includes(r.operator)) &&
      (!opts.event || opts.event.test(r.event)) &&
      (opts.from === undefined || r.t >= opts.from) &&
      (opts.to === undefined || r.t <= opts.to),
  );
}

/**
 * One line per record: JSON Lines with `json`, else a readable table row (`reading` "log": the log's reading beside the
 * primary; `zones`: the primary reading's zones, the replay's crit and its source, and the modifiers by source, so
 * `node scripts/cli-ab.ts <ref> --key '^(\S+  t=\d+  \S+  \S+)' -- zmdlogs hits <fixture> --zones` shows which zone
 * and modifier moved at each hit between two commits: round 8, an hour of hand diffing per regression).
 */
export function formatRecord(r: HitRecord, json: boolean, reading: "primary" | "log" = "primary", zones = false): string {
  if (json) return JSON.stringify(r);
  const pct = (e: number | null | undefined) => (e === null || e === undefined ? "-" : `${(100 * e).toFixed(1)}%`);
  const log = reading === "log" ? `  log reading ${r.logReading ?? "-"}  ${pct(r.logError)}` : "";
  const z = zones && r.landing ? `  ${zoneWords(r)}` : "";
  const target = r.target ? `  T${r.target.index}${r.target.how === "fits" ? "" : ` (${r.target.how})`}${r.target.landing !== undefined && !r.target.landing.includes(r.target.index) ? ` ≠ landing ${r.target.landing.map((t) => `T${t}`).join("+")}` : ""}${r.target.drop.length ? ` without ${r.target.drop.join(", ")}` : ""}${r.target.kills ? " killed" : ""}` : "";
  return `${basename(r.fixture).replace(/\.json$/, "")}  t=${r.t}${target}  ${r.operator}  ${r.event}  ${r.class}  logged ${r.value}  predicted ${r.predicted ?? "-"}  ${pct(r.error)}${log}${r.unknown ? `  (${r.unknown})` : ""}${z}`;
}

/**
 * `zmdlogs hits --against <id>=<r>`: the hits whose class or primary reading differ between two readings' records of the
 * same logs (`before` the defaults, `after` the reading; each fixture's records in its hits' order, filtered alike), with
 * both and the modifiers only one side has: measure's `--hits` lines for the named logs, without the lock (combo-hold
 * report point 2: a reading's effect on its target log took two `hits --json` runs and a scratch pairing).
 */
export function recordChanges(before: readonly HitRecord[], after: readonly HitRecord[]): string[] {
  const pct = (e: number | null | undefined) => (e === null || e === undefined ? "-" : `${(100 * e).toFixed(1)}%`);
  const mods = (r: HitRecord) => new Set((r.landing?.modifiers ?? []).map((m) => `${m.kitBuff ?? m.source}:${m.zone} ${Number(m.value.toPrecision(4))}`));
  const byFixture = (rs: readonly HitRecord[]) => {
    const m = new Map<string, HitRecord[]>();
    for (const r of rs) m.set(r.fixture, [...(m.get(r.fixture) ?? []), r]);
    return m;
  };
  const [a, b] = [byFixture(before), byFixture(after)];
  const out: string[] = [];
  const counts = new Map<string, number>();
  for (const [fixture, rs] of a) {
    const other = b.get(fixture) ?? [];
    const name = basename(fixture).replace(/\.json$/, "");
    if (other.length !== rs.length) {
      out.push(`${name}: not comparable (${rs.length} records against ${other.length})`);
      continue;
    }
    for (const [i, x] of rs.entries()) {
      const y = other[i] as HitRecord;
      if (x.t !== y.t || x.event !== y.event) throw new Error(`${name}: records out of step at ${i} (${x.t} ${x.event} against ${y.t} ${y.event})`);
      if (x.class === y.class && x.predicted === y.predicted) continue;
      const [mx, my] = [mods(x), mods(y)];
      const gone = [...mx].filter((m) => !my.has(m));
      const added = [...my].filter((m) => !mx.has(m));
      const diff = gone.length || added.length ? `; modifiers ${[...added.map((m) => `+${m}`), ...gone.map((m) => `-${m}`)].join(", ")}` : "";
      const why = y.unknown && y.unknown !== x.unknown ? `; now: ${y.unknown}` : "";
      // In a fight read per target, its target on each side (round 21, the statuses-per-target report point 3).
      const [tx, ty] = [x.target ? `T${x.target.index}` : "", y.target ? `T${y.target.index}` : ""];
      const tg = tx || ty ? `  ${tx === ty ? tx : `${tx || "-"} → ${ty || "-"}`}` : "";
      out.push(`${name}  t=${x.t}${tg}  ${x.operator}  ${x.event}  logged ${x.value}: ${x.class} ${x.predicted ?? "-"} (${pct(x.error)}) → ${y.class} ${y.predicted ?? "-"} (${pct(y.error)})${diff}${why}`);
      const k = `${x.class} → ${y.class}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const summary = [...counts].sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k} ${n}`).join(", ");
  return [...out, `${out.length} hit(s) changed${summary ? `: ${summary}` : ""}`];
}

/** A record's zones, crit and modifiers in words (formatRecord `zones`): numbers to 4 significant digits. */
function zoneWords(r: HitRecord): string {
  const l = r.landing as NonNullable<HitRecord["landing"]>;
  const n = (v: number) => String(Number(v.toPrecision(4)));
  const zs = Object.entries(l.zones).map(([k, v]) => `${k} ${n(v as number)}`).join(", ");
  const crit = `crit ${r.replayCrit === null || r.replayCrit === undefined ? "-" : r.replayCrit ? "yes" : "no"} (${r.critSource ?? "-"})`;
  const mods = [...l.modifiers].map((m) => `${m.kitBuff ?? m.source}:${m.zone} ${n(m.value)}`).sort().join("; ");
  return `zones ${zs}; ${crit}; modifiers ${mods || "none"}`;
}

/**
 * A hit's zones, crit and modifiers as their difference from another hit's (`zmdlogs hits --against-hit <s>`; round 17,
 * the exposed-totals report point 4: 3f78's +1.7% from 58.90 s was Corrosion's ignoreResistance 18.27 against 20.23,
 * found by diffing two `--zones` lines by hand): only what differs, "<this> vs <the reference's>", a modifier by its kit
 * buff (or source) and zone; "same zones and modifiers" when nothing does, "no landing" for either side without one.
 */
export function zoneDifference(r: HitRecord, ref: HitRecord): string {
  if (!r.landing || !ref.landing) return "no landing";
  const n = (v: number | undefined) => (v === undefined ? "-" : String(Number(v.toPrecision(4))));
  const out: string[] = [];
  const [za, zb] = [Object.fromEntries(Object.entries(r.landing.zones)) as Readonly<Record<string, number>>, Object.fromEntries(Object.entries(ref.landing.zones)) as Readonly<Record<string, number>>];
  for (const k of new Set([...Object.keys(za), ...Object.keys(zb)])) if (n(za[k]) !== n(zb[k])) out.push(`${k} ${n(za[k])} vs ${n(zb[k])}`);
  const crit = (x: HitRecord) => (x.replayCrit === null || x.replayCrit === undefined ? "-" : x.replayCrit ? "yes" : "no");
  if (crit(r) !== crit(ref)) out.push(`crit ${crit(r)} vs ${crit(ref)}`);
  const mods = (x: HitRecord) => {
    const m = new Map<string, number[]>();
    for (const y of x.landing?.modifiers ?? []) m.set(`${y.kitBuff ?? y.source}:${y.zone}`, [...(m.get(`${y.kitBuff ?? y.source}:${y.zone}`) ?? []), y.value]);
    return m;
  };
  const [ma, mb] = [mods(r), mods(ref)];
  for (const k of [...new Set([...ma.keys(), ...mb.keys()])].sort()) {
    const [a, b] = [(ma.get(k) ?? []).map(n).sort().join("+"), (mb.get(k) ?? []).map(n).sort().join("+")];
    if (a !== b) out.push(`${k} ${a || "none"} vs ${b || "none"}`);
  }
  return out.length ? out.join("; ") : "same zones and modifiers";
}

/** The hits of a list of fixtures, read one at a time (readFixture), each record handed to `out` as it's made. */
export function exportHits(data: GameData, files: readonly string[], readFixture: (file: string) => LogFixture, out: (r: HitRecord) => void, opts: { readonly kind?: string; readonly operators?: readonly string[]; readonly progress?: (line: string) => void; readonly assume?: Readonly<Record<string, string>> } = {}): number {
  let n = 0;
  for (const f of files) {
    opts.progress?.(`hits ${f}`);
    for (const r of filterRecords(hitRecords(data, readFixture(f), f, opts.assume), opts)) {
      out(r);
      n++;
    }
  }
  return n;
}

/**
 * As exportHits, on `workers` worker threads (hitsworker.ts), each loading the game data once: a fixture's records
 * arrive together, in the order fixtures finish.
 */
export async function exportHitsParallel(files: readonly string[], workers: number, out: (r: HitRecord) => void, opts: { readonly kind?: string; readonly operators?: readonly string[]; readonly progress?: (line: string) => void; readonly assume?: Readonly<Record<string, string>> } = {}): Promise<number> {
  const { Worker } = await import("node:worker_threads");
  const queue = [...files];
  let n = 0;
  const one = () =>
    new Promise<void>((resolveAll, reject) => {
      const w = new Worker(new URL("./hitsworker.ts", import.meta.url));
      const next = () => {
        const file = queue.shift();
        if (file === undefined) {
          void w.terminate().then(() => resolveAll());
          return;
        }
        opts.progress?.(`hits ${file}`);
        w.postMessage({ file, ...(opts.kind !== undefined ? { kind: opts.kind } : {}), ...(opts.operators?.length ? { operators: [...opts.operators] } : {}), ...(opts.assume && Object.keys(opts.assume).length ? { assume: { ...opts.assume } } : {}) });
      };
      w.on("message", (m: { file: string; records?: HitRecord[]; error?: string }) => {
        if (m.error !== undefined) {
          void w.terminate();
          reject(new Error(`${m.file}: ${m.error}`));
          return;
        }
        for (const r of m.records ?? []) {
          out(r);
          n++;
        }
        next();
      });
      w.on("error", reject);
      next();
    });
  await Promise.all(Array.from({ length: Math.max(1, Math.min(workers, files.length)) }, one));
  return n;
}

/** The targets a hit's landing was on (LandedHit.target, otherTargets), as HitRecord.target's `landing`; none without one. */
function landingTarget(landing: LandedHit | { readonly unknown: string } | undefined): { landing?: readonly number[] } {
  return landing && !("unknown" in landing) && landing.target !== undefined ? { landing: [landing.target, ...(landing.otherTargets ?? []).map((o) => o.target)] } : {};
}

/** The hits whose check target isn't among their landing's targets (HitRecord.target `landing`), of those with both. */
export function targetMismatches(records: readonly HitRecord[]): { readonly both: number; readonly differ: readonly HitRecord[] } {
  const both = records.filter((r) => r.target?.landing !== undefined);
  return { both: both.length, differ: both.filter((r) => !(r.target?.landing ?? []).includes(r.target?.index ?? -1)) };
}

/** The zones a layer of a kit buff adds its value to whole (the zone is 1 + Σ), besides ATK (base ATK × Σ). */
const ADDITIVE_ZONES = new Set(["damageBonus", "amp", "susceptibility", "damageTaken"]);

/** One hit's layers of a kit buff (layerRows): the log's entries of its game buff, the replay's and the value's. */
export interface LayerRow {
  readonly record: HitRecord;
  /** The log's entries of the game buff at the hit (HitRecord.listed), and their lane starts where listed more than once. */
  readonly listed: number;
  readonly sinces: readonly (number | null)[];
  /** The kit buff's modifiers in the primary reading (one per layer). */
  readonly replay: number;
  /**
   * The layers the logged value implies with every other input as the primary reading has them: the replay's plus (logged
   * ÷ reading − 1) × the zone ÷ one layer's part of it (ATK: base ATK × its value, flat ATK ignored; an additive zone:
   * its value). Null: no reading, a zone that isn't additive, or no layer's value known in the fight.
   */
  readonly implied: number | null;
}

/**
 * `zmdlogs hits --layers <owner:id>` (round 21, backlog after round 20 point 3; round 8's parked layers point; the Liino
 * report's probe, scripts/probes/kits/liino-medicant-layers.ts, made general): per hit where the log lists the kit
 * buff's game buff or the reading has a layer, the log's count, the replay's and the one the value implies.
 */
export function layerRows(records: readonly HitRecord[], kitBuff: string, gameBuff: string | null): LayerRow[] {
  const count = (r: HitRecord) => {
    if (gameBuff === null) return 0;
    const e = r.listed.find((x) => x === gameBuff || x.startsWith(`${gameBuff} ×`));
    return e === undefined ? 0 : e === gameBuff ? 1 : Number(e.slice(gameBuff.length + 2));
  };
  // A layer's zone and value: the hit's own modifier, else the fight's first.
  const layerOf = new Map<string, { zone: string; value: number }>();
  for (const r of records) {
    const m = r.landing?.modifiers.find((x) => x.kitBuff === kitBuff);
    if (m && !layerOf.has(r.fixture)) layerOf.set(r.fixture, { zone: m.zone, value: m.value });
  }
  const out: LayerRow[] = [];
  for (const r of records) {
    const mods = r.landing?.modifiers.filter((x) => x.kitBuff === kitBuff) ?? [];
    const listed = count(r);
    if (!listed && !mods.length) continue;
    const layer = mods[0] ? { zone: mods[0].zone, value: mods[0].value } : layerOf.get(r.fixture);
    let implied: number | null = null;
    if (r.landing && r.predicted && layer && layer.value !== 0) {
      const zones = r.landing.zones as unknown as Record<string, number>;
      const zone = zones[layer.zone];
      const pct = r.landing.modifiers.filter((x) => x.zone === "atk").reduce((s, x) => s + x.value, 0);
      const part = layer.zone === "atk" ? (zone ?? 0) / (1 + pct) * layer.value : ADDITIVE_ZONES.has(layer.zone) ? layer.value : null;
      if (zone !== undefined && part) implied = mods.length + ((r.value / r.predicted - 1) * zone) / part;
    }
    out.push({ record: r, listed, sinces: gameBuff ? (r.listedSinces?.[gameBuff] ?? []) : [], replay: mods.length, implied });
  }
  return out;
}

/** layerRows as lines: one per hit, then per listed count the hits, the replay's layers and the implied ones (rounded, ×hits). */
export function layerLines(rows: readonly LayerRow[], kitBuff: string, gameBuff: string | null): string[] {
  const n = (x: number | null) => (x === null ? "-" : x.toFixed(2));
  const lines = rows.map(({ record: r, listed, sinces, replay, implied }) => {
    const since = sinces.length ? ` (since ${sinces.map((x) => (x === null ? "?" : (x / 1000).toFixed(1))).join(", ")})` : "";
    return `${basename(r.fixture).replace(/\.json$/, "")}  t=${r.t}  ${r.operator}  ${r.event}  ${r.class}  listed ${listed}${since}  replay ${replay}  implied ${n(implied)}`;
  });
  const by = new Map<number, LayerRow[]>();
  for (const x of rows) by.set(x.listed, [...(by.get(x.listed) ?? []), x]);
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const summary = [...by].sort((a, b) => a[0] - b[0]).map(([k, xs]) => {
    const hist = new Map<number, number>();
    for (const x of xs) if (x.implied !== null && Number.isFinite(x.implied)) hist.set(Math.round(x.implied), (hist.get(Math.round(x.implied)) ?? 0) + 1);
    return `  listed ${String(k).padStart(2)}: ${String(xs.length).padStart(5)} hit(s), the replay's layers median ${median(xs.map((x) => x.replay))}, implied ${[...hist].sort((a, b) => a[0] - b[0]).map(([v, c]) => `${v}:${c}`).join(" ") || "-"}`;
  });
  return [`${kitBuff}${gameBuff ? ` (the log's ${gameBuff})` : " (no game buff: the log's count is 0)"}: per hit the log's entries, the replay's layers (its modifiers in the primary reading) and the layers the logged value implies with the rest as read`, ...lines, `By the log's count:`, ...summary];
}
