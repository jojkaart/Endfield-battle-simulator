// efsim diagnose: what a rule list leaves on the table (engine policydiag.ts) and what each stat gear can change is
// worth to the team (marginal values: the list played again with one gear-line-sized step more of a stat on one
// operator, on the same reaction-delay seeds: common random numbers), with the inefficiencies in plain words
// (docs/design.md "Rule-based rotations", diagnosis and marginal values; the owner, 2026-11-16).

import {
  Attr,
  attrName,
  averageDiagnoses,
  distributionCritMode,
  critTriggers,
  ELEMENT_DAMAGE_INCREASE,
  FPS,
  policyDistribution,
  POLICY_REACTION_SECONDS,
  resolveRuleList,
  Slot,
  Target,
  type Build,
  type GameData,
  type GearData,
  type OperatorDiagnosis,
  type PolicyDiagnosis,
  type RuleList,
  type SustainedDistribution,
  type TimelineScenario,
} from "@efsim/engine";
import { num, pct, table } from "./format.ts";
import { codeStamp, defaultWorkers, runRulesJobs, type RulesJob, type RulesResult } from "./rulespool.ts";
import { alternatives, underAssume } from "./assume.ts";

// --- Probes: one gear stat line of a typical size ---------------------------------------------------------

/** A stat step to measure: one stat line (attribute, formula slot, target) of the size a gear piece's line has. */
export interface Probe {
  readonly key: string;
  readonly label: string;
  readonly attr: number;
  readonly slot: number;
  readonly target: number;
  readonly value: number;
  /** Not a gear line (ATK %, flat ATK, crit DMG: sets and weapons give them): a reference step, sized from the sets where they have one. */
  readonly reference?: boolean;
  /** Matters only for this element's / skill kind's / Staggered damage (probesFor skips it for an operator without such damage). */
  readonly only?: { readonly element?: string; readonly kind?: string; readonly staggered?: true };
}

/** Attributes no damage reads: healing, HP, damage taken (the wearer's). */
const NOT_DAMAGE = new Set<number>([Attr.HealOutputIncrease, Attr.MaxHp]);
const ELEMENT_OF = new Map<number, string>(Object.entries(ELEMENT_DAMAGE_INCREASE).map(([e, a]) => [a, e]));
const KIND_OF = new Map<number, string>([[Attr.NormalAttackDamageIncrease, "basic"], [Attr.NormalSkillDamageIncrease, "battle"], [Attr.ComboSkillDamageIncrease, "combo"], [Attr.UltimateSkillDamageIncrease, "ultimate"]]);
const ATTR_WORDS: Readonly<Record<number, string>> = {
  [Attr.Str]: "Strength",
  [Attr.Agi]: "Agility",
  [Attr.Wisd]: "Intellect",
  [Attr.Will]: "Will",
  [Attr.CriticalRate]: "Crit Rate",
  [Attr.CriticalDamageIncrease]: "Crit DMG",
  [Attr.UltimateSpGainScalar]: "Ultimate Gain Efficiency",
  [Attr.PhysicalAndSpellInflictionEnhance]: "Arts Intensity",
  [Attr.PhysicalDamageIncrease]: "Physical DMG",
  [Attr.FireDamageIncrease]: "Heat DMG",
  [Attr.PulseDamageIncrease]: "Electric DMG",
  [Attr.CrystDamageIncrease]: "Cryo DMG",
  [Attr.NaturalDamageIncrease]: "Nature DMG",
  [Attr.NormalAttackDamageIncrease]: "Basic Attack DMG",
  [Attr.NormalSkillDamageIncrease]: "Battle Skill DMG",
  [Attr.ComboSkillDamageIncrease]: "Combo Skill DMG",
  [Attr.UltimateSkillDamageIncrease]: "Ultimate DMG",
  [Attr.DamageToBrokenUnitIncrease]: "DMG to Staggered",
  [Attr.Atk]: "ATK",
};

const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] as number;

function probeLabel(attr: number, slot: number, target: number, value: number): string {
  const who = target === Target.MainAttribute ? "main attribute" : target === Target.SecondaryAttribute ? "secondary attribute" : (ATTR_WORDS[attr] ?? attrName(attr));
  const percent = slot === Slot.Percent || (slot === Slot.Add && value < 1.5 && attr !== Attr.PhysicalAndSpellInflictionEnhance && target === Target.AsWritten && ![Attr.Str, Attr.Agi, Attr.Wisd, Attr.Will].includes(attr as 39));
  return `${who} +${percent ? `${(value * 100).toFixed(1)}%` : Math.round(value)}`;
}

/**
 * The stat lines the game's gear offers (T4 pieces, lines 1–3 at full artifice; healing, HP and damage-taken lines
 * left out), each at the median size of its lines, plus reference steps for what only sets and weapons give: ATK +10%
 * (sets: 8–15%), flat ATK +20 (AIC Light's), Crit DMG +10%.
 */
export function gearProbes(data: GameData): Probe[] {
  const by = new Map<string, { attr: number; slot: number; target: number; values: number[] }>();
  for (const g of Object.values(data.gear)) {
    if (!g.id.includes("_t4_")) continue;
    for (const l of g.lines) {
      if (l.line === 0 || NOT_DAMAGE.has(l.attr) || l.slot === Slot.Multiply) continue;
      const k = `${l.attr}:${l.slot}:${l.target}`;
      const e = by.get(k) ?? { attr: l.attr, slot: l.slot, target: l.target, values: [] };
      e.values.push(l.values[l.values.length - 1] as number);
      by.set(k, e);
    }
  }
  const out: Probe[] = [...by.entries()].map(([key, e]) => {
    const value = median(e.values);
    const element = ELEMENT_OF.get(e.attr);
    const kind = KIND_OF.get(e.attr);
    const only = element ? { element } : kind ? { kind } : e.attr === Attr.DamageToBrokenUnitIncrease ? { staggered: true as const } : undefined;
    return { key, label: probeLabel(e.attr, e.slot, e.target, value), attr: e.attr, slot: e.slot, target: e.target, value, ...(only ? { only } : {}) };
  });
  out.push(
    { key: "ref:atk%", label: "ATK +10% (reference: sets give 8–15%)", attr: Attr.Atk, slot: Slot.Percent, target: Target.AsWritten, value: 0.1, reference: true },
    { key: "ref:atk", label: "flat ATK +20 (reference)", attr: Attr.Atk, slot: Slot.Flat, target: Target.AsWritten, value: 20, reference: true },
    { key: "ref:critdmg", label: "Crit DMG +10% (reference)", attr: Attr.CriticalDamageIncrease, slot: Slot.Add, target: Target.AsWritten, value: 0.1, reference: true },
  );
  return out;
}

/** The probes that can matter for an operator: an element's / kind's / Staggered bonus only with such damage (≥ 1% of its own); an attribute written out only if it's neither its main nor its secondary (those come as main / secondary attribute lines). */
export function probesFor(data: GameData, operator: string, d: OperatorDiagnosis, probes: readonly Probe[]): Probe[] {
  const op = data.operators[operator];
  return probes.filter((p) => {
    if (p.target === Target.AsWritten && op && (p.attr === op.mainAttr || p.attr === op.subAttr)) return false;
    if (!p.only) return true;
    const min = 0.01 * d.damage;
    if (p.only.element) return (d.byElement[p.only.element] ?? 0) > min;
    if (p.only.kind) return (d.byKind[p.only.kind] ?? 0) > min;
    return d.whileStaggered > min;
  });
}

/** A synthetic gear piece with only the probe's line (artifice 0), for the operator to wear as a fifth piece. */
export function probePiece(p: Probe): GearData {
  return { id: `probe:${p.key}`, name: p.label, part: 9, setId: null, lines: [{ line: 1, attr: p.attr, slot: p.slot, target: p.target, values: [p.value] }] };
}

/** The scenario with one operator wearing extra pieces. */
export function wearing(scenario: Omit<TimelineScenario, "rotation">, operator: string, pieces: readonly string[]): Omit<TimelineScenario, "rotation"> {
  return { ...scenario, team: scenario.team.map((b): Build => (b.operator === operator ? { ...b, gear: [...b.gear, ...pieces.map((id) => ({ id, artifice: [0, 0, 0] as const }))] } : b)) };
}

// --- Runs over seeds ------------------------------------------------------------------------------------------

export interface PlaySettings {
  readonly seconds: number;
  readonly reaction: number;
  readonly workers: number;
  /** The battle's crit mode: the scenario's, or `distribution` when a crit-triggered effect is in the team (crits that change what follows are rolled, seeded with the delays' seed). */
  readonly crit: TimelineScenario["options"]["crit"];
}

/** Jobs for seeds first…first + n − 1 (default 1…n) of a list on a scenario (the fight at the settings' length). */
export function seedJobs(scenario: Omit<TimelineScenario, "rotation">, list: RuleList, s: PlaySettings, seeds: number, extra: Partial<RulesJob> = {}, first = 1): RulesJob[] {
  return Array.from({ length: seeds }, (_, i) => ({
    scenario: { ...scenario, durationFrames: Math.round(s.seconds * FPS), options: { ...scenario.options, crit: s.crit, seed: first + i } },
    list,
    options: { reactionSeconds: s.reaction, seed: first + i },
    ...extra,
  }));
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sampleSd = (xs: readonly number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

/** A paired comparison over common seeds: the mean relative change and its standard error (the per-seed differences' sd / √n, over the base mean). */
export function paired(base: readonly number[], other: readonly number[]): { readonly gain: number; readonly se: number } {
  const n = Math.min(base.length, other.length);
  const d = Array.from({ length: n }, (_, i) => (other[i] as number) - (base[i] as number));
  const b = mean(base.slice(0, n));
  return { gain: mean(d) / b, se: sampleSd(d) / Math.sqrt(n) / b };
}

export interface MarginalValue {
  readonly operator: string;
  readonly probe: Probe;
  /** Team sustained DPS change for one step (fraction), on common seeds, and its standard error. */
  readonly gain: number;
  readonly se: number;
  /** Seeds it's over (more for a noisy one: DiagnoseOptions.marginalMaxSeeds). */
  readonly seeds: number;
}

/** A marginal value's standard error above which it gets more seeds (0.25% of team DPS). */
export const MARGINAL_NOISY = 0.0025;

export interface Diagnosed {
  readonly list: RuleList;
  readonly diagnosis: PolicyDiagnosis;
  readonly distribution: SustainedDistribution;
  /** Sustained DPS per seed (1…n). */
  readonly dps: readonly number[];
  readonly marginal: readonly MarginalValue[];
  readonly settings: PlaySettings;
  readonly critNote?: string;
  /** Runs played and seconds taken. */
  readonly runs: number;
  readonly secondsTaken: number;
  /** The code the run used (rulespool.ts codeStamp). */
  readonly code: string;
  /**
   * Under each other reading of the team's kits' open assumptions (DiagnoseOptions.assumptions): sustained DPS on the
   * same seeds, paired against the reading in use, and the findings that go away or come.
   */
  readonly assumptions?: readonly { readonly label: string; readonly dps: number; readonly gain: number; readonly se: number; readonly gone: readonly string[]; readonly came: readonly string[] }[];
}

export interface DiagnoseOptions {
  readonly seconds?: number;
  readonly reaction?: number;
  /** Seeds of the diagnosis (default 5). */
  readonly seeds?: number;
  /** Seeds of each marginal value (default 4; common with the diagnosis' first ones); 0: none. */
  readonly marginalSeeds?: number;
  /** Seeds a noisy marginal value (standard error over MARGINAL_NOISY) is taken to (default 16). */
  readonly marginalMaxSeeds?: number;
  readonly workers?: number;
  /** Only these operators' marginal values (default all). */
  readonly operators?: readonly string[];
  /** The diagnosis again under each other reading of the team's kits' open assumptions (assume.ts). */
  readonly assumptions?: boolean;
  readonly progress?: (line: string) => void;
}

export const DIAGNOSE_SECONDS = 300;

/** The play settings for a scenario (crit mode by its crit triggers). */
export function playSettings(data: GameData, scenario: Omit<TimelineScenario, "rotation">, o: { readonly seconds?: number; readonly reaction?: number; readonly workers?: number }): { settings: PlaySettings; critNote?: string } {
  const crit = distributionCritMode(data, scenario);
  const triggers = crit === "distribution" ? critTriggers(data, scenario) : [];
  return {
    settings: { seconds: o.seconds ?? DIAGNOSE_SECONDS, reaction: o.reaction ?? POLICY_REACTION_SECONDS, workers: o.workers ?? defaultWorkers(), crit },
    ...(triggers.length ? { critNote: `crit-triggered effects in the team (${triggers.join(", ")}): the crits they read are rolled (seeded with the delays' seed), so the crit spread mixes into the delays' and differences are less common` } : {}),
  };
}

/** Diagnosis over seeds, then the marginal values (each probe on each operator, on the first seeds). */
export async function diagnose(data: GameData, scenario: Omit<TimelineScenario, "rotation">, rawList: RuleList, o: DiagnoseOptions = {}): Promise<Diagnosed> {
  const t0 = performance.now();
  const team = scenario.team.map((b) => b.operator);
  const list = resolveRuleList(data, team, rawList);
  const { settings, critNote } = playSettings(data, scenario, o);
  const seeds = o.seeds ?? 5;
  const mSeeds = Math.min(o.marginalSeeds ?? 4, seeds);
  o.progress?.(`diagnosis: ${seeds} seeds`);
  const base = await runRulesJobs(data, seedJobs(scenario, list, settings, seeds, { diagnose: true }), settings.workers);
  const diagnosis = averageDiagnoses(base.map((r) => r.diagnosis as PolicyDiagnosis));
  const dps = base.map((r) => r.sustainedDps);
  let marginal: MarginalValue[] = [];
  let runs = seeds;
  if (mSeeds > 0) {
    const all = gearProbes(data);
    const ops = o.operators ?? team;
    const plan = ops.flatMap((op) => probesFor(data, op, diagnosis.operators.find((d) => d.operator === op) as OperatorDiagnosis, all).map((p) => ({ op, p })));
    const probes = Object.fromEntries(all.map((p) => [`probe:${p.key}`, probePiece(p)]));
    const jobs = plan.flatMap(({ op, p }) => seedJobs(wearing(scenario, op, [`probe:${p.key}`]), list, settings, mSeeds, { probes }));
    o.progress?.(`marginal values: ${plan.length} steps × ${mSeeds} seeds = ${jobs.length} runs on ${settings.workers} worker${settings.workers === 1 ? "" : "s"}`);
    const res = await runRulesJobs(data, jobs, settings.workers, (done, of) => {
      if (done % 20 === 0 || done === of) o.progress?.(`  ${done} / ${of} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
    });
    runs += jobs.length;
    const got = plan.map((_, i) => res.slice(i * mSeeds, (i + 1) * mSeeds).map((r: RulesResult) => r.sustainedDps));
    marginal = plan.map(({ op, p }, i) => ({ operator: op, probe: p, ...paired(dps.slice(0, mSeeds), got[i] as number[]), seeds: mSeeds }));
    // Steps that move the timeline (Ultimate Gain Efficiency, an attribute that flips a mode) don't line up with the
    // base's events, so their differences stay noisy on common seeds: those whose standard error is over the bar get
    // more seeds, up to marginalMaxSeeds (the base's extra seeds played once).
    const maxSeeds = o.marginalMaxSeeds ?? 16;
    const noisy = marginal.map((m, i) => (m.se > MARGINAL_NOISY ? i : -1)).filter((i) => i >= 0);
    if (noisy.length && maxSeeds > mSeeds) {
      const more = maxSeeds - mSeeds;
      const baseFrom = dps.length + 1;
      const baseJobs = maxSeeds > dps.length ? seedJobs(scenario, list, settings, maxSeeds - dps.length, {}, baseFrom) : [];
      const extra = noisy.flatMap((i) => seedJobs(wearing(scenario, (plan[i] as { op: string }).op, [`probe:${(plan[i] as { p: Probe }).p.key}`]), list, settings, more, { probes }, mSeeds + 1));
      o.progress?.(`  ${noisy.length} noisy steps (se over ${(MARGINAL_NOISY * 100).toFixed(2)}%): ${more} more seeds each, ${extra.length + baseJobs.length} runs`);
      const r2 = await runRulesJobs(data, [...baseJobs, ...extra], settings.workers);
      runs += r2.length;
      const baseAll = [...dps, ...r2.slice(0, baseJobs.length).map((r) => r.sustainedDps)];
      noisy.forEach((i, j) => {
        const all = [...(got[i] as number[]), ...r2.slice(baseJobs.length + j * more, baseJobs.length + (j + 1) * more).map((r) => r.sustainedDps)];
        marginal[i] = { ...(marginal[i] as MarginalValue), ...paired(baseAll.slice(0, maxSeeds), all), seeds: maxSeeds };
      });
    }
  }
  const out: Diagnosed = { list, diagnosis, distribution: policyDistribution(base.map((r) => r.moments)), dps, marginal, settings, ...(critNote ? { critNote } : {}), runs, secondsTaken: (performance.now() - t0) / 1000, code: codeStamp() };
  if (!o.assumptions) return out;
  // The same seeds under each other reading (the marginal values stay the reading in use's: findings that read them are kept).
  const keyed = (f: readonly Finding[]) => new Map(f.filter((x) => x.key !== "per-minute").map((x) => [x.key, x.text]));
  const now = keyed(findings(data, out));
  const assumptions: NonNullable<Diagnosed["assumptions"]>[number][] = [];
  for (const alt of alternatives(data, scenario)) {
    o.progress?.(`assumption ${alt.id}=${alt.reading}: ${seeds} seeds`);
    const r = await runRulesJobs(data, seedJobs(underAssume(scenario, alt.assume), list, settings, seeds, { diagnose: true }), settings.workers);
    runs += r.length;
    const altDps = r.map((x) => x.sustainedDps);
    const there = keyed(findings(data, { ...out, diagnosis: averageDiagnoses(r.map((x) => x.diagnosis as PolicyDiagnosis)), dps: altDps, distribution: policyDistribution(r.map((x) => x.moments)) }));
    assumptions.push({
      label: alt.label,
      dps: mean(altDps),
      ...paired(dps, altDps),
      gone: [...now].filter(([k]) => !there.has(k)).map(([, t]) => t),
      came: [...there].filter(([k]) => !now.has(k)).map(([, t]) => t),
    });
  }
  return { ...out, runs, secondsTaken: (performance.now() - t0) / 1000, assumptions };
}

// --- In plain words ---------------------------------------------------------------------------------------------

const n0 = (x: number) => num(Math.round(x), 0);
const s1 = (x: number) => x.toFixed(1);
const signed = (x: number, d = 2) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;

/** A marginal value "+0.84% ± 0.05". */
export function mvText(m: { readonly gain: number; readonly se: number }): string {
  return `${signed(m.gain)} ± ${(m.se * 100).toFixed(2)}`;
}

/** Whether a measured change is beyond its noise (two standard errors) and at least 0.1%. */
export const beyondNoise = (m: { readonly gain: number; readonly se: number }) => Math.abs(m.gain) > 2 * m.se && Math.abs(m.gain) >= 0.001;

const SOURCE_WORDS = (data: GameData, s: string) => (s === "sp" ? "SP spent" : s === "hits" ? "own hits" : s.startsWith("kit:") ? s.slice(4) : s);

/** A finding: a stable key (its kind and who: to tell which went away with other gear) and its text. */
export interface Finding {
  readonly key: string;
  readonly text: string;
}

/** The inefficiencies, in plain words (findings the gear search uses too). */
export function findings(data: GameData, d: Diagnosed): Finding[] {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const out: Finding[] = [];
  const add = (key: string, text: string) => out.push({ key, text });
  const dg = d.diagnosis;
  const mvOf = (op: string, attr: number) => d.marginal.find((m) => m.operator === op && m.probe.attr === attr && m.probe.target === Target.AsWritten && !m.probe.reference);
  const bestOf = (op: string, but?: string) => d.marginal.filter((m) => m.operator === op && !m.probe.reference && m.probe.key !== but).sort((a, b) => b.gain - a.gain)[0];
  for (const o of dg.operators) {
    const u = o.ultimate;
    const ue = mvOf(o.operator, Attr.UltimateSpGainScalar);
    const wasted = o.energy.gained > 0 ? o.energy.wasted / o.energy.gained : 0;
    if (u && ue) {
      const heldPart = u.heldSeconds / dg.seconds;
      const why = [u.held.priority > 0.5 ? `${s1(u.held.priority)} s behind other presses` : "", u.held.condition > 0.5 ? `${s1(u.held.condition)} s held by its rule's condition` : "", u.held.noRule > 0.5 ? `${s1(u.held.noRule)} s with no rule for it` : "", u.held.reaction > 0.5 ? `${s1(u.held.reaction)} s reaction` : ""].filter(Boolean).join(", ");
      const best = bestOf(o.operator, ue.probe.key);
      const surplus = heldPart > 0.03 || wasted > 0.05;
      const state = `ready but not cast ${pct(heldPart)} of the fight (${why || "reaction"}), ${pct(wasted)} of its energy lost at a full bar`;
      // Clearly below its best damage line: the difference beyond both errors.
      const below = best !== undefined && best.gain - ue.gain > 2 * Math.hypot(best.se, ue.se);
      if (below && surplus && best)
        add(`ue-low:${o.operator}`, `${name(o.operator)}'s ultimate is ${state}: its Ultimate Gain Efficiency is worth ${mvText(ue)} a line, clearly less than ${best.probe.label} (${mvText(best)}): a line spent on efficiency would do more as damage.`);
      else if (beyondNoise(ue) && ue.gain > 0)
        add(`ue-bottleneck:${o.operator}`, `${name(o.operator)}'s ultimate energy is a bottleneck: ${ue.probe.label} on it is worth ${mvText(ue)}${best ? ` (its best damage line: ${best.probe.label}, ${mvText(best)})` : ""}.`);
      else if (surplus && ue.se > MARGINAL_NOISY)
        add(`ue-noisy:${o.operator}`, `${name(o.operator)}'s ultimate is ${state}, but what its Ultimate Gain Efficiency is worth can't be told from the seeds' noise (${mvText(ue)} at ${ue.seeds} seeds: a change of timing moves the whole fight).`);
    }
    if (u && u.held.noRule > 1) add(`norule:${o.operator}`, `The list has no rule for ${name(o.operator)}'s ultimate: it sits ready ${s1(u.held.noRule)} s.`);
    if (o.combo && o.combo.litSeconds / dg.seconds > 0.08) add(`combo:${o.operator}`, `${name(o.operator)}'s combo is lit but unused ${s1(o.combo.litSeconds)} s (${pct(o.combo.litSeconds / dg.seconds)} of the fight).`);
    // More of a stat that loses beyond the noise: an attribute crossing a kit threshold (a mode decided by two
    // attributes), or a stat that moves the timeline putting ultimates at worse moments for this list.
    for (const m of d.marginal.filter((x) => x.operator === o.operator && x.gain < 0 && beyondNoise(x))) {
      const attribute = m.probe.attr === 0 || [Attr.Str, Attr.Agi, Attr.Wisd, Attr.Will].includes(m.probe.attr as 39);
      add(`loses:${o.operator}:${m.probe.key}`, `${m.probe.label} on ${name(o.operator)} loses ${mvText(m)}: ${attribute ? "it crosses a threshold of the kit (such as a mode decided by two attributes)" : "it moves when ultimates come, to worse moments for this list"}.`);
    }
  }
  if (dg.sp.atCapSeconds / dg.seconds > 0.03) add("sp", `Team SP sits at the cap ${s1(dg.sp.atCapSeconds)} s (${n0(dg.sp.wastedRegen + dg.sp.wastedGrants)} SP lost): room for more battle skills.`);
  const main = dg.operators.find((o) => o.operator === dg.main);
  if (main?.ultimate) add("per-minute", `Ultimates per minute: ${dg.operators.filter((o) => o.ultimate).map((o) => `${name(o.operator)} ${(o.ultimate?.perMinute ?? 0).toFixed(2)}`).join(", ")} (${name(dg.main)} deals the most damage, ${pct(main.share)}).`);
  // Only for a main damage dealer whose ultimate deals damage itself (Laevatain's empowers her other skills).
  const ultDamage = main?.byKind["ultimate"] ?? 0;
  for (const e of dg.effects.slice(0, 6)) {
    if (e.onMain > 0.15 && e.onMainUltimate < 0.7 && dg.mainUltimates > 0 && ultDamage > 0.05 * (main?.damage ?? 0)) add(`overlap:${e.owner}:${e.id}`, `${name(dg.main)}'s ultimate lands under ${name(e.owner)}'s ${e.label} for only ${pct(e.onMainUltimate)} of its damage (all its damage: ${pct(e.onMain)}; uptime ${pct(e.uptime)}).`);
  }
  for (const o of dg.operators) {
    const ms = d.marginal.filter((m) => m.operator === o.operator && !m.probe.reference).sort((a, b) => b.gain - a.gain);
    const best = ms[0];
    if (best && beyondNoise(best)) add(`best:${o.operator}`, `Best gear line for ${name(o.operator)}: ${best.probe.label} (${mvText(best)}); then ${ms.slice(1, 3).map((m) => `${m.probe.label} ${mvText(m)}`).join(", ")}.`);
  }
  return out;
}

/** The diagnosis as text. */
export function formatDiagnosis(data: GameData, d: Diagnosed, title: string): string {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const dg = d.diagnosis;
  const s = d.distribution;
  const lines = [
    title,
    `${d.code}; ${d.settings.seconds} s fight, reaction ${d.settings.reaction} s ± 50%, ${s.runs} seeds (common random numbers: each rule's k-th cue onset draws the same delay in every run), crits ${d.settings.crit === "distribution" ? "rolled where an effect reads them, else expected" : "expected, their spread from each hit's chance"}; ${d.runs} runs in ${d.secondsTaken.toFixed(0)} s.`,
    ...(d.critNote ? [`Note: ${d.critNote}.`] : []),
    "",
    `Sustained DPS: ${n0(s.mean)} (sd ${n0(s.sd)}: reaction delays ${n0(s.sdDelays)}, crits ${n0(s.sdCrits)}; 5–95% ${n0(s.p5)}–${n0(s.p95)})`,
    "",
    "Per operator (averaged over the seeds; energy over the whole fight; held: seconds ready but not cast, by why):",
    table(
      ["", "share", "ult/min", "held s (react/prio/cond/none)", "energy gained", "spent", "wasted", "end", "efficiency", "sources", "combo/min", "combo lit unused s", "battle/min"],
      dg.operators.map((o) => [
        name(o.operator),
        pct(o.share),
        o.ultimate ? o.ultimate.perMinute.toFixed(2) : "",
        o.ultimate ? `${s1(o.ultimate.heldSeconds)} (${s1(o.ultimate.held.reaction)}/${s1(o.ultimate.held.priority)}/${s1(o.ultimate.held.condition)}/${s1(o.ultimate.held.noRule)})` : "",
        n0(o.energy.gained),
        n0(o.energy.spent),
        `${n0(o.energy.wasted)} (${pct(o.energy.gained > 0 ? o.energy.wasted / o.energy.gained : 0, 0)})`,
        n0(o.energy.end),
        `${(o.energy.efficiency * 100).toFixed(0)}%`,
        Object.entries(o.energy.bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${SOURCE_WORDS(data, k)} ${pct(o.energy.gained > 0 ? v / o.energy.gained : 0, 0)}`).join(", "),
        o.combo ? o.combo.perMinute.toFixed(2) : "",
        o.combo ? s1(o.combo.litSeconds) : "",
        o.battlePerMinute.toFixed(2),
      ]),
      ["l", "r", "r", "r", "r", "r", "r", "r", "r", "l", "r", "r", "r"],
    ),
    `Team SP: at the cap ${s1(dg.sp.atCapSeconds)} s; lost to it ${n0(dg.sp.wastedRegen)} by regeneration, ${n0(dg.sp.wastedGrants)} by grants.`,
    "",
    `What drives ${name(dg.main)} (the most damage; ${s1(dg.mainUltimates)} ultimates): other operators' effects on its hits (uptime on it; share of its damage, and of its ultimate's, they applied to):`,
    table(["effect", "uptime", "on its damage", "on its ultimate"], dg.effects.slice(0, 10).map((e) => [`${name(e.owner)}: ${e.label}`, pct(e.uptime), pct(e.onMain), pct(e.onMainUltimate)]), ["l", "r", "r", "r"]),
    table(["enemy state", "uptime", "on its damage", "on its ultimate"], dg.enemy.map((e) => [e.label, pct(e.uptime), pct(e.onMain), pct(e.onMainUltimate)]), ["l", "r", "r", "r"]),
  ];
  if (d.marginal.length) {
    lines.push("", `Marginal values: team sustained DPS for one gear-line-sized step more of a stat on one operator (median line of the game's T4 gear at full artifice), ${d.marginal.length ? "paired on common seeds" : ""}; ± one standard error:`);
    const ops = [...new Set(d.marginal.map((m) => m.operator))];
    for (const op of ops) {
      const ms = d.marginal.filter((m) => m.operator === op).sort((a, b) => b.gain - a.gain);
      lines.push(`  ${name(op)}: ${ms.map((m) => `${m.probe.label} ${mvText(m)}${m.seeds > Math.min(...d.marginal.map((x) => x.seeds)) ? ` [${m.seeds} seeds]` : ""}${beyondNoise(m) ? "" : " (noise)"}`).join("; ")}`);
    }
  }
  const f = findings(data, d);
  if (f.length) lines.push("", "Findings:", ...f.map((x) => `- ${x.text}`));
  if (d.assumptions) {
    lines.push("", d.assumptions.length ? "Under the kits' open assumptions (each other reading of an in-game test the team's kits register; the same seeds):" : "The kits' open assumptions: none for this team.");
    for (const a of d.assumptions) {
      lines.push(`- ${a.label}: sustained DPS ${n0(a.dps)} (${mvText(a)} against the reading in use)${a.gone.length || a.came.length ? "" : "; the same findings"}`);
      for (const t of a.gone) lines.push(`    no longer: ${t}`);
      for (const t of a.came) lines.push(`    new: ${t}`);
    }
  }
  return lines.join("\n");
}
