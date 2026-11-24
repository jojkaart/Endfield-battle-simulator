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
import { FPS, landingDamage, parseReactionEvent, readingDoesNotApply, roundDamage, type GameData, type Zones } from "@efsim/engine";
import type { LogFixture } from "./zmdlogs.ts";
import { engineCheck, logDifferences, loggedEntries, readingBasis, type EngineCheck, type LogDifference, type ReadingBasis } from "./enginecheck.ts";
import type { LogHit } from "./zmdlogs.ts";
import { placeHits } from "./logcasts.ts";
import { checkLog, engineHits, hitPlace, logBuffReplay, verdictCount, type HitVerdict, type VerdictCount } from "./logcheck.ts";
import type { CritSource } from "./buffreplay.ts";

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
   * The engine's primary reading of the replay's landing (engineHits), rounded; null without a landing or when no
   * reading applies. Not always the number the verdict rests on: a fallback match is the log listing's reading, and the
   * landing has the replay's own crit where the log gives none (`crit: null`), the verdict the logged one. That one is
   * `verdictReading` (round 5: Rossi's ticks read −31.7% here while their verdict was a plain match).
   */
  readonly predicted: number | null;
  /** logged / predicted − 1 (null without a prediction). Not the verdict's error: `verdictError`. */
  readonly error: number | null;
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
  /** Why the replay has no landing for the hit. */
  readonly unknown?: string;
  /** The crit the replay's landing took (LandedHit.crit; null where the hit can't crit), with a landing. */
  readonly replayCrit?: boolean | null;
  /** Where that crit comes from (buffreplay.ts CritSource: the log, an inference from the log, or none). */
  readonly critSource?: CritSource;
  /** The game buffs the log lists at the hit (its effects, one entry per buff with its instance count when above 1: "id ×2"). */
  readonly listed: readonly string[];
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
    /**
     * A kit hit's enemy statuses at the landing (before its own applications): applier, level, Arts Intensity, from
     * EnemyStatus.statuses (reactions: Combustion, Corrosion, ...) and, with `physical: true`, EnemyStatus.physical
     * (Breach, Lift, Crush, Knock Down). `appliedAt` is the engine's frame (30 a second), `appliedAtMs` the same in ms
     * (the log's LogEffect.since is in ms). Control statuses and Vulnerable aren't exported. Status events record none.
     */
    readonly enemy?: readonly { readonly status: string; readonly level: number; readonly operator: string; readonly artsIntensity: number; readonly appliedAt: number; readonly appliedAtMs: number; readonly damageScale?: number; readonly physical?: true }[];
  };
}

/** Every logged hit of a fixture as a record (the multi-target fixtures aren't checked: single-target engine). */
export function hitRecords(data: GameData, fx: LogFixture, fixture: string = fx.id, assume: Readonly<Record<string, string>> = {}): HitRecord[] {
  const placement = placeHits(data, fx);
  // Under other readings of open assumptions (`zmdlogs hits --assume`; round 6: it ignored the option and printed the
  // defaults' verdicts), as measure and the check replay them (snapshotentry.ts).
  const replay = Object.keys(assume).length ? logBuffReplay(data, fx, placement, { assume }) : logBuffReplay(data, fx, placement);
  const byHit = engineHits(data, fx, replay, placement);
  const verdicts = new Map(checkLog(data, fx, { replay, engineHits: byHit }).map((v) => [v.hit, v]));
  const c = engineCheck(data, fx, replay.replay);
  return fx.hits.map((hit) => {
    const v = verdicts.get(hit) as HitVerdict;
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
      ...verdictReadingOf(v),
      listed: listedBuffs(hit.effects),
      critSource: replay.replay.critSource(hit),
    };
    const e = byHit.get(hit);
    const predicted = e?.primary ?? null;
    const error = predicted ? hit.value / predicted - 1 : null;
    const basis = readingBasis(c, hit, hitPlace(data, fx, placement, replay, hit));
    if ("unknown" in basis.landing) return { ...base, predicted, error, unknown: basis.landing.unknown };
    const ok = basis as Exclude<typeof basis, { readonly landing: { readonly unknown: string } }>;
    const { landing, primary } = ok;
    let d;
    try {
      d = landingDamage(data, c.target, primary.inputs, primary.options, primary.other);
    } catch (err) {
      if (!readingDoesNotApply(err)) throw err;
      return { ...base, predicted, error, unknown: "no reading applies" };
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
      logReading,
      logError: logReading ? hit.value / logReading - 1 : null,
      landing: {
        frame: landing.frame,
        operator: inputs.operator,
        skillId: d.skillId,
        hitId: d.hitId,
        exact: d.exact,
        scaleParts: d.scaleParts,
        zones: d.zones,
        modifiers: d.modifiers.map((m) => ({ source: m.source, zone: m.zone, ...(m.element ? { element: m.element } : {}), value: m.value, ...(m.kitBuff ? { kitBuff: `${m.kitBuff.owner}:${m.kitBuff.id}` } : {}) })),
        ...(inputs.kind === "status" ? { reaction: { kind: inputs.reaction.kind, element: inputs.reaction.element, stacks: inputs.reaction.stacks } } : {}),
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
  return `${basename(r.fixture).replace(/\.json$/, "")}  t=${r.t}  ${r.operator}  ${r.event}  ${r.class}  logged ${r.value}  predicted ${r.predicted ?? "-"}  ${pct(r.error)}${log}${r.unknown ? `  (${r.unknown})` : ""}${z}`;
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
