// efsim gear --rules: gear scored by playing a rule list over a long fight (sustained DPS over reaction-delay seeds,
// common random numbers), with candidates proposed by the diagnosis' marginal values: single-piece swaps that keep
// the active sets (ranked by the lines' predicted worth), each set's best loadout (screened by play), plus the logs'
// and a candidates file's loadouts (gear.ts gearCandidates). Coordinate ascent across operators, a change taken only
// when its gain is beyond the seeds' spread of the difference (docs/design.md "Rule-based rotations", gear on rules).

import { activeGearSets, attrName, computeStats, resolveRuleList, Target, type Build, type GameData, type GearData, type RuleList, type TimelineScenario } from "@efsim/engine";
import { beyondNoise, diagnose, findings, formatDiagnosis, MARGINAL_NOISY, mvText, paired, seedJobs, type Diagnosed, type DiagnoseOptions, type MarginalValue, type PlaySettings } from "./diagnose.ts";
import { modePair } from "./edge.ts";
import { describeGear, type GearCandidate } from "./gear.ts";
import { num, pct, table } from "./format.ts";
import { runRulesJobs } from "./rulespool.ts";
import { alternatives, holds, underAssume } from "./assume.ts";

const FULL = [3, 3, 3] as const;
const key = (gear: readonly string[]) => [...gear].sort().join("+");

/** A line's worth by the marginal values (linear in its size; an attribute that is the operator's main or secondary counts as that). */
function lineWorth(data: GameData, operator: string, l: { readonly attr: number; readonly slot: number; readonly target: number; readonly value: number }, mv: ReadonlyMap<string, MarginalValue>): number {
  const op = data.operators[operator];
  let attr = l.attr;
  let target = l.target;
  if (target === Target.AsWritten && op) {
    if (attr === op.mainAttr) [attr, target] = [0, Target.MainAttribute];
    else if (attr === op.subAttr) [attr, target] = [0, Target.SecondaryAttribute];
  }
  const m = mv.get(`${attr}:${l.slot}:${target}`);
  return m ? (m.gain * l.value) / m.probe.value : 0;
}

/** A piece's lines' worth at full artifice (its base DEF line aside). */
export function pieceWorth(data: GameData, operator: string, g: GearData, mv: ReadonlyMap<string, MarginalValue>): number {
  return g.lines.filter((l) => l.line > 0).reduce((a, l) => a + lineWorth(data, operator, { attr: l.attr, slot: l.slot, target: l.target, value: l.values[l.values.length - 1] as number }, mv), 0);
}

/** The game's T4 pieces by part (0 body, 1 gloves, 2 kit). */
function t4ByPart(data: GameData): Map<number, GearData[]> {
  const out = new Map<number, GearData[]>();
  for (const g of Object.values(data.gear)) if (g.id.includes("_t4_")) out.set(g.part, [...(out.get(g.part) ?? []), g]);
  return out;
}

export interface Proposal {
  readonly gear: readonly string[];
  /** Why: the swap and what it trades, or the set build. */
  readonly why: string;
  /** Predicted team gain from the marginal values (lines only; a set's effect isn't in it): for a swap the change, for a set build the loadout's lines' whole worth. */
  readonly predicted: number;
}

/**
 * Single-piece swaps of a loadout that keep every active set (a piece of an active set only for another of that
 * set, or the set still complete without it), ranked by the lines' predicted worth; the best `top` with a gain.
 */
export function swapProposals(data: GameData, build: Build, mv: ReadonlyMap<string, MarginalValue>, top: number): Proposal[] {
  const parts = t4ByPart(data);
  const ids = build.gear.map((g) => g.id);
  const sets = new Set(activeGearSets(data, build).map((s) => s.set.id));
  const out: Proposal[] = [];
  const seen = new Set<string>();
  ids.forEach((id, j) => {
    const old = data.gear[id];
    if (!old) return;
    const w0 = pieceWorth(data, build.operator, old, mv);
    for (const g of parts.get(old.part) ?? []) {
      if (g.id === id) continue;
      const gear = ids.map((x, k) => (k === j ? g.id : x));
      const after = new Set(activeGearSets(data, { ...build, gear: gear.map((x) => ({ id: x, artifice: FULL })) }).map((s) => s.set.id));
      if ([...sets].some((s) => !after.has(s))) continue;
      const k = key(gear);
      if (seen.has(k)) continue;
      seen.add(k);
      const predicted = pieceWorth(data, build.operator, g, mv) - w0;
      if (predicted > 0) out.push({ gear, predicted, why: `${old.name} → ${g.name} (lines: predicted ${predicted >= 0 ? "+" : ""}${(predicted * 100).toFixed(2)}%)` });
    }
  });
  return out.sort((a, b) => b.predicted - a.predicted).slice(0, top);
}

/** Each set's best loadout by the lines' worth: three or four of its pieces (accessories may repeat), the rest the best piece of any set. */
export function setProposals(data: GameData, operator: string, mv: ReadonlyMap<string, MarginalValue>): Proposal[] {
  const parts = t4ByPart(data);
  const worth = (g: GearData) => pieceWorth(data, operator, g, mv);
  const best = (list: readonly GearData[]) => [...list].sort((a, b) => worth(b) - worth(a))[0];
  const out: Proposal[] = [];
  for (const set of Object.values(data.gearSets)) {
    const of = (part: number) => (parts.get(part) ?? []).filter((g) => g.setId === set.id);
    const body = best(of(0));
    const hand = best(of(1));
    const acc = best(of(2));
    const any = { body: best(parts.get(0) ?? []), hand: best(parts.get(1) ?? []), acc: best(parts.get(2) ?? []) };
    if (!acc) continue;
    // Which slot goes outside the set (none: all four in it).
    const options: (GearData | undefined)[][] = [
      [body, hand, acc, acc],
      [any.body, hand, acc, acc],
      [body, any.hand, acc, acc],
      [body, hand, acc, any.acc],
    ];
    let pick: { gear: string[]; w: number } | null = null;
    for (const o of options) {
      if (o.some((g) => !g)) continue;
      const gs = o as GearData[];
      if (gs.filter((g) => g.setId === set.id).length < set.piecesRequired) continue;
      const w = gs.reduce((a, g) => a + worth(g), 0);
      if (!pick || w > pick.w) pick = { gear: gs.map((g) => g.id), w };
    }
    if (pick) out.push({ gear: pick.gear, predicted: pick.w, why: `${set.name} set: its best pieces by the marginal values` });
  }
  return out;
}

export interface RuleGearRow {
  readonly gear: readonly string[];
  readonly sources: readonly string[];
  /** Mean sustained DPS over the seeds, and the paired change against the operator's loadout then current. */
  readonly dps: number;
  readonly gain: number;
  readonly se: number;
  /** Seeds it's over (more for a noisy gain). */
  readonly seeds: number;
  readonly predicted?: number;
  /** Set when the loadout flips the operator's mode (two attributes decide it: Arcane's Intellect / Will). */
  readonly modeFlip?: string;
}

export interface RuleGearResult {
  readonly before: Diagnosed;
  readonly after: Diagnosed | null;
  readonly team: readonly Build[];
  readonly tables: ReadonlyMap<string, readonly RuleGearRow[]>;
  /** The changes taken, in order: operator, from, to, gain, se, why. */
  readonly changes: readonly { readonly operator: string; readonly from: readonly string[]; readonly to: readonly string[]; readonly gain: number; readonly se: number; readonly sources: readonly string[]; readonly also?: { readonly gain: number; readonly se: number } }[];
  /** Changes that gained but were worse on the second start (RuleGearOptions.also) by more than one standard error. */
  readonly rejected: readonly { readonly operator: string; readonly to: readonly string[]; readonly gain: number; readonly se: number; readonly also: { readonly gain: number; readonly se: number } }[];
  /** The second start's label, and the chosen gear against the start there on the fresh seeds. */
  readonly also?: string;
  readonly confirmAlso?: { readonly gain: number; readonly se: number } | null;
  /** The chosen gear against the start on the fresh seeds under each other reading of the team's kits' open assumptions (assume.ts). */
  readonly assumptions?: readonly { readonly label: string; readonly gain: number; readonly se: number; readonly holds: "holds" | "flips" | "unclear" }[];
  /** The code the run used (rulespool.ts codeStamp). */
  readonly code: string;
  readonly start: readonly number[];
  readonly final: readonly number[];
  /** The start and the chosen gear on fresh seeds (1001…), and the paired gain there; null without a change. */
  readonly confirm: { readonly start: readonly number[]; readonly final: readonly number[]; readonly gain: number; readonly se: number } | null;
  readonly passes: number;
  readonly runs: number;
  readonly secondsTaken: number;
  readonly settings: PlaySettings;
}

export interface RuleGearOptions extends DiagnoseOptions {
  /** Passes of the ascent at most (default 3). */
  readonly passes?: number;
  readonly keep?: ReadonlySet<string>;
  /** Swaps proposed per operator per pass (default 4). */
  readonly generated?: number;
  /** Set builds kept per operator after screening (default 2; 0: none). */
  readonly sets?: number;
  /** Seeds of the set builds' screening (default 2). */
  readonly screenSeeds?: number;
  /** Seeds a gain with a large noise (standard error over MARGINAL_NOISY) is taken to (default 16). */
  readonly maxSeeds?: number;
  /** Skip the diagnosis with the chosen gear. */
  readonly noAfter?: boolean;
  /**
   * A second start of the fight (the team's zero-energy scenario: main.ts passes examples/<team>-zero.scenario.json by
   * default when it exists): a change is played there too on the same seeds and taken only if it isn't worse there by
   * more than one standard error.
   */
  readonly also?: { readonly scenario: Omit<TimelineScenario, "rotation">; readonly label: string };
}

/** Gear chosen by playing the rule list (see the file's comment). `candidates`: the logs' and file's (gear.ts gearCandidates). */
export async function gearOnRules(data: GameData, scenario: Omit<TimelineScenario, "rotation">, rawList: RuleList, candidates: ReadonlyMap<string, readonly GearCandidate[]>, o: RuleGearOptions = {}): Promise<RuleGearResult> {
  const t0 = performance.now();
  const team0 = scenario.team.map((b) => b.operator);
  const list = resolveRuleList(data, team0, rawList);
  const seeds = o.seeds ?? 6;
  const before = await diagnose(data, scenario, list, { ...o, seeds });
  const s = before.settings;
  const mv = new Map(before.marginal.map((m) => [`${m.operator}#${m.probe.key}`, m]));
  const mvFor = (op: string) => new Map([...mv].filter(([k]) => k.startsWith(`${op}#`)).map(([k, m]) => [k.slice(op.length + 1), m]));
  let runs = before.runs;
  const own = new Map(scenario.team.map((b) => [b.operator, key(b.gear.map((g) => g.id))]));
  const gearOf = (op: string, gear: readonly string[]): Build["gear"] => {
    const b = scenario.team.find((x) => x.operator === op) as Build;
    return key(gear) === own.get(op) ? b.gear : gear.map((id) => ({ id, artifice: FULL }));
  };
  const teamKey = (team: readonly Build[]) => team.map((b) => key(b.gear.map((g) => `${g.id}:${g.artifice.join("")}`))).join("|");
  // Per team: sustained DPS on seeds 1, 2, … as far as played; a longer request plays only the seeds after those.
  const cache = new Map<string, number[]>([[teamKey(scenario.team), [...before.dps]]]);
  /** Sustained DPS per seed (1…n) for each team; what isn't cached runs together. */
  const score = async (teams: readonly Build[][], n = seeds): Promise<number[][]> => {
    const todo = teams.filter((t, i) => (cache.get(teamKey(t))?.length ?? 0) < n && teams.findIndex((u) => teamKey(u) === teamKey(t)) === i);
    const have = todo.map((t) => cache.get(teamKey(t))?.length ?? 0);
    const jobs = todo.flatMap((t, i) => seedJobs({ ...scenario, team: t }, list, s, n - (have[i] as number), {}, (have[i] as number) + 1));
    const res = await runRulesJobs(data, jobs, s.workers);
    runs += jobs.length;
    let at = 0;
    todo.forEach((t, i) => {
      const m = n - (have[i] as number);
      cache.set(teamKey(t), [...(cache.get(teamKey(t)) ?? []), ...res.slice(at, at + m).map((r) => r.sustainedDps)]);
      at += m;
    });
    return teams.map((t) => (cache.get(teamKey(t)) as number[]).slice(0, n));
  };
  // Set builds per operator, screened once on a few seeds against the scenario's gear.
  const screenSeeds = Math.min(o.screenSeeds ?? 2, seeds);
  const setPicks = new Map<string, { gear: readonly string[]; why: string; predicted: number }[]>();
  if ((o.sets ?? 2) > 0) {
    const plan = team0.filter((op) => !o.keep?.has(op)).flatMap((op) => setProposals(data, op, mvFor(op)).map((p) => ({ op, p })));
    o.progress?.(`screening ${plan.length} set builds on ${screenSeeds} seeds`);
    const teams = plan.map(({ op, p }) => scenario.team.map((b) => (b.operator === op ? { ...b, gear: gearOf(op, p.gear) } : b)));
    const got = await score(teams, screenSeeds);
    for (const op of team0) {
      const mine = plan.map((x, i) => ({ ...x, d: got[i] as number[] })).filter((x) => x.op === op);
      mine.sort((a, b) => b.d.reduce((p, q) => p + q, 0) - a.d.reduce((p, q) => p + q, 0));
      setPicks.set(op, mine.slice(0, o.sets ?? 2).map((x) => x.p));
    }
  }
  let team: Build[] = scenario.team.map((b) => ({ ...b }));
  const tables = new Map<string, RuleGearRow[]>();
  const changes: { operator: string; from: readonly string[]; to: readonly string[]; gain: number; se: number; sources: readonly string[]; also?: { gain: number; se: number } }[] = [];
  const rejected: RuleGearResult["rejected"][number][] = [];
  /** Sustained DPS per seed (1…n) on the second start, for each team. */
  const alsoScore = async (teams: readonly Build[][], n = seeds): Promise<number[][]> => {
    const sc = o.also?.scenario as Omit<TimelineScenario, "rotation">;
    const res = await runRulesJobs(data, teams.flatMap((t) => seedJobs({ ...sc, team: t }, list, s, n)), s.workers);
    runs += res.length;
    return teams.map((_, i) => res.slice(i * n, (i + 1) * n).map((r) => r.sustainedDps));
  };
  let passes = 0;
  for (let pass = 1; pass <= (o.passes ?? 3); pass++) {
    passes = pass;
    let changed = false;
    for (const op of team0) {
      if (o.keep?.has(op)) continue;
      const i = team.findIndex((b) => b.operator === op);
      const cur = team[i] as Build;
      const rows = new Map<string, { gear: readonly string[]; sources: string[]; predicted?: number }>();
      const add = (gear: readonly string[], source: string, predicted?: number) => {
        const k = key(gear);
        const e = rows.get(k) ?? { gear: [...gear].sort(), sources: [], ...(predicted !== undefined ? { predicted } : {}) };
        if (!e.sources.includes(source)) e.sources.push(source);
        rows.set(k, e);
      };
      add(cur.gear.map((g) => g.id), "current");
      for (const c of candidates.get(op) ?? []) add(c.gear, c.sources.map((x) => (x.kind === "log" ? `logs (${x.label})` : x.kind === "scenario" ? "scenario" : x.label)).join("; "));
      for (const p of swapProposals(data, cur, mvFor(op), o.generated ?? 4)) add(p.gear, `swap: ${p.why}`, p.predicted);
      const curWorth = cur.gear.reduce((a, g) => a + (data.gear[g.id] ? pieceWorth(data, op, data.gear[g.id] as GearData, mvFor(op)) : 0), 0);
      for (const p of setPicks.get(op) ?? []) add(p.gear, p.why, p.predicted - curWorth);
      const list2 = [...rows.values()];
      const teams = list2.map((r) => team.map((b, j) => (j === i ? { ...b, gear: gearOf(op, r.gear) } : b)));
      o.progress?.(`pass ${pass}: ${data.operators[op]?.name ?? op}, ${list2.length} loadouts × ${seeds} seeds`);
      // An operator whose mode two attributes decide (Arcane's Intellect / Will): a loadout that flips it is flagged.
      const pair = (() => {
        try {
          return modePair(data, op);
        } catch {
          return undefined;
        }
      })();
      const modeOf = (gear: readonly string[]) => {
        if (!pair) return undefined;
        const st = computeStats(data, { ...cur, gear: gearOf(op, gear) });
        return (st.attrs[pair.a]?.total ?? 0) >= (st.attrs[pair.b]?.total ?? 0) ? pair.a : pair.b;
      };
      const curMode = modeOf(cur.gear.map((g) => g.id));
      const flip = (gear: readonly string[]) => {
        const m = modeOf(gear);
        const word = (n: number) => (n === 41 ? "Intellect" : n === 42 ? "Will" : attrName(n));
        return m !== undefined && m !== curMode ? `flips the mode: ${word(m)} over ${word(m === pair?.a ? pair.b : (pair?.a ?? 0))}` : undefined;
      };
      const rowOf = (r: (typeof list2)[number], base: readonly number[], d: readonly number[]): RuleGearRow => {
        const f = flip(r.gear);
        return { gear: r.gear, sources: r.sources, dps: d.reduce((a, b) => a + b, 0) / d.length, ...paired(base, d), seeds: d.length, ...(r.predicted !== undefined ? { predicted: r.predicted } : {}), ...(f ? { modeFlip: f } : {}) };
      };
      const got = await score([team, ...teams]);
      let scored: RuleGearRow[] = list2.map((r, j) => rowOf(r, got[0] as number[], got[j + 1] as number[]));
      // Gains with a large noise (a change of timing) get more seeds, up to maxSeeds, before one is taken.
      const maxSeeds = o.maxSeeds ?? 16;
      const close = list2.map((_, j) => j).filter((j) => {
        const x = scored[j] as RuleGearRow;
        return x.gain > 0 && x.se > MARGINAL_NOISY;
      });
      if (close.length && maxSeeds > seeds) {
        o.progress?.(`  ${close.length} noisy gain${close.length === 1 ? "" : "s"}: ${maxSeeds} seeds`);
        const more = await score([team, ...close.map((j) => teams[j] as Build[])], maxSeeds);
        scored = scored.map((x, j) => (close.includes(j) ? rowOf(list2[j] as (typeof list2)[number], more[0] as number[], more[close.indexOf(j) + 1] as number[]) : x));
      }
      scored.sort((a, b) => b.gain - a.gain);
      tables.set(op, scored);
      const best = scored[0];
      if (best && key(best.gear) !== key(cur.gear.map((g) => g.id)) && best.gain > 0 && beyondNoise(best)) {
        const next = team.map((b, j) => (j === i ? { ...b, gear: gearOf(op, best.gear) } : b));
        let alsoGain: { gain: number; se: number } | undefined;
        if (o.also) {
          const [a, b] = await alsoScore([team, next], best.seeds);
          alsoGain = paired(a as number[], b as number[]);
          if (alsoGain.gain < -alsoGain.se) {
            rejected.push({ operator: op, to: best.gear, gain: best.gain, se: best.se, also: alsoGain });
            o.progress?.(`  ✗ ${describeGear(data, best.gear)}: ${mvText(best)}, but ${mvText(alsoGain)} on ${o.also.label}: not taken`);
            continue;
          }
        }
        changes.push({ operator: op, from: cur.gear.map((g) => g.id), to: best.gear, gain: best.gain, se: best.se, sources: best.modeFlip ? [...best.sources, `NOTE: ${best.modeFlip}`] : best.sources, ...(alsoGain ? { also: alsoGain } : {}) });
        team = next;
        changed = true;
        o.progress?.(`  → ${describeGear(data, best.gear)}: ${mvText(best)}`);
      }
    }
    if (!changed) break;
  }
  const final = (await score([team]))[0] as number[];
  // The chosen gear against the start on fresh seeds (the ascent picked the best of many on seeds 1…n: its gain there
  // is biased up), so the gain reported is one no choice was made on.
  let confirm: RuleGearResult["confirm"] = null;
  if (changes.length) {
    const fresh = await runRulesJobs(data, [...seedJobs(scenario, list, s, seeds, {}, 1001), ...seedJobs({ ...scenario, team }, list, s, seeds, {}, 1001)], s.workers);
    runs += fresh.length;
    const a = fresh.slice(0, seeds).map((r) => r.sustainedDps);
    const b = fresh.slice(seeds).map((r) => r.sustainedDps);
    confirm = { start: a, final: b, ...paired(a, b) };
  }
  let confirmAlso: RuleGearResult["confirmAlso"] = null;
  if (changes.length && o.also) {
    const fresh = await runRulesJobs(data, [...seedJobs(o.also.scenario, list, s, seeds, {}, 1001), ...seedJobs({ ...o.also.scenario, team }, list, s, seeds, {}, 1001)], s.workers);
    runs += fresh.length;
    confirmAlso = paired(fresh.slice(0, seeds).map((r) => r.sustainedDps), fresh.slice(seeds).map((r) => r.sustainedDps));
  }
  // The chosen gear under each other reading of an open assumption, on the fresh seeds (does the advice depend on it?).
  const assumptions: { label: string; gain: number; se: number; holds: "holds" | "flips" | "unclear" }[] = [];
  if (changes.length && o.assumptions && confirm) {
    for (const alt of alternatives(data, scenario)) {
      o.progress?.(`assumption ${alt.id}=${alt.reading}: the chosen gear on ${seeds} fresh seeds`);
      const sc = underAssume(scenario, alt.assume);
      const r = await runRulesJobs(data, [...seedJobs(sc, list, s, seeds, {}, 1001), ...seedJobs({ ...sc, team }, list, s, seeds, {}, 1001)], s.workers);
      runs += r.length;
      const g = paired(r.slice(0, seeds).map((x) => x.sustainedDps), r.slice(seeds).map((x) => x.sustainedDps));
      assumptions.push({ label: alt.label, ...g, holds: holds(confirm, g) });
    }
  }
  const after = changes.length && !o.noAfter ? await diagnose(data, { ...scenario, team }, list, { ...o, seeds }) : null;
  if (after) runs += after.runs;
  return {
    before, after, team, tables, changes, rejected, start: before.dps, final, confirm, passes, runs, secondsTaken: (performance.now() - t0) / 1000, settings: s, code: before.code,
    ...(o.also ? { also: o.also.label, confirmAlso } : {}),
    ...(o.assumptions ? { assumptions } : {}),
  };
}

/** The result as text: the diagnosis before, each operator's candidates, the changes, the diagnosis after and what changed. */
export function formatRuleGear(data: GameData, r: RuleGearResult, title: string): string {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const total = paired(r.start, r.final);
  const lines = [
    formatDiagnosis(data, r.before, `${title}\n\nBefore (the scenario's gear):`),
    "",
    `Gear on rules: ${r.passes} pass${r.passes === 1 ? "" : "es"}, ${r.runs} runs in ${r.secondsTaken.toFixed(0)} s; sustained DPS ${num(Math.round(mean(r.start)), 0)} → ${num(Math.round(mean(r.final)), 0)} (${mvText(total)} on ${r.start.length} common seeds${beyondNoise(total) ? "" : "; within the noise"}). A change is taken only when its gain is over twice its standard error (paired on common seeds).`,
  ];
  for (const [op, rows] of r.tables) {
    lines.push("", `${name(op)} (last pass; against the loadout current then):`);
    lines.push(table(["loadout", "sources", "predicted (lines)", "sustained DPS", "vs current"], rows.map((x) => [describeGear(data, x.gear), [...x.sources, ...(x.modeFlip ? [x.modeFlip] : [])].join("; "), x.predicted !== undefined ? `${x.predicted >= 0 ? "+" : ""}${(x.predicted * 100).toFixed(2)}%` : "", num(Math.round(x.dps), 0), `${mvText(x)}${x.seeds > r.start.length ? ` [${x.seeds} seeds]` : ""}${beyondNoise(x) ? "" : " (noise)"}`]), ["l", "l", "r", "r", "r"]));
  }
  if (r.confirm) lines.push("", `On ${r.confirm.start.length} fresh seeds (1001…, no choice made on them): ${num(Math.round(mean(r.confirm.start)), 0)} → ${num(Math.round(mean(r.confirm.final)), 0)}, ${mvText(r.confirm)}${beyondNoise(r.confirm) && r.confirm.gain > 0 ? "" : ": not confirmed (within the noise), so not a gain to rely on; more seeds decide it"}.`);
  if (r.confirmAlso) lines.push(`On ${r.also} (the second start), the same fresh seeds: ${mvText(r.confirmAlso)}${beyondNoise(r.confirmAlso) ? (r.confirmAlso.gain > 0 ? "" : ": worse from this start") : " (within the noise)"}.`);
  lines.push("", r.changes.length ? "Changes taken:" : "No change beyond the noise: the scenario's gear stays.");
  for (const c of r.changes) lines.push(`- ${name(c.operator)}: ${describeGear(data, c.from)} → ${describeGear(data, c.to)} (${mvText(c)}${c.also ? `; ${mvText(c.also)} on ${r.also}` : ""}; ${c.sources.join("; ")})`);
  if (r.rejected.length) lines.push("", `Gains not taken: worse on ${r.also} by more than one standard error:`, ...r.rejected.map((c) => `- ${name(c.operator)}: ${describeGear(data, c.to)} (${mvText(c)}; ${mvText(c.also)} there)`));
  if (r.assumptions) {
    lines.push("", r.assumptions.length ? "The chosen gear under the kits' open assumptions (each other reading of an in-game test; fresh seeds, paired):" : "The kits' open assumptions: none for this team (or no change to check).");
    for (const a of r.assumptions) lines.push(`- ${a.label}: ${mvText(a)}: ${a.holds}`);
  }
  if (r.after) {
    lines.push("", formatDiagnosis(data, r.after, "After (the chosen gear):"));
    lines.push("", "What changed (before → after):");
    for (const o of r.after.diagnosis.operators) {
      const b = r.before.diagnosis.operators.find((x) => x.operator === o.operator);
      if (!b) continue;
      const wasted = (x: typeof o) => (x.energy.gained > 0 ? x.energy.wasted / x.energy.gained : 0);
      lines.push(`- ${name(o.operator)}: share ${pct(b.share)} → ${pct(o.share)}; ultimates/min ${(b.ultimate?.perMinute ?? 0).toFixed(2)} → ${(o.ultimate?.perMinute ?? 0).toFixed(2)}; ready but not cast ${(b.ultimate?.heldSeconds ?? 0).toFixed(1)} → ${(o.ultimate?.heldSeconds ?? 0).toFixed(1)} s; energy wasted ${pct(wasted(b))} → ${pct(wasted(o))}`);
    }
    const fb = findings(data, r.before).filter((x) => !x.key.startsWith("best:") && x.key !== "per-minute");
    const fa = findings(data, r.after).filter((x) => !x.key.startsWith("best:") && x.key !== "per-minute");
    const gone = fb.filter((x) => !fa.some((y) => y.key === x.key));
    const came = fa.filter((x) => !fb.some((y) => y.key === x.key));
    if (gone.length) lines.push("", "Findings no longer there:", ...gone.map((x) => `- ${x.text}`));
    if (came.length) lines.push("", "New findings:", ...came.map((x) => `- ${x.text}`));
  }
  return lines.join("\n");
}
