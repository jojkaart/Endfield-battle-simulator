// efsim rules --guided: the payoff-guided rule search (docs/design/rules.md "Rule-based rotations", the guided search; the
// owner, 2026-11-16: "put together ideal combos and seek to change the rules in directions that can get closer to
// achieving the optimal damage output"). From the list's runs (common random numbers), each damage window's ideal
// combo (every multiplier the team puts on it, on every hit) and what each missing multiplier costs (engine
// policyguide.ts); edits aimed at the biggest losses (hold the giver for the window's cue, chain the presses, start
// the window when the multiplier is up, save SP, `shows`, spare SP, the same edit only when a cue that tells the starts
// apart holds; a few random moves as a complement), screened on a few seeds, the best few played on more, one kept per
// round when its gain clears the bar (judgeEdit); then the analysis again on the new list, until nothing clears it.
//
// The objective (docs/design/rules.md "The objective across starts", 2026-11-22): with a second start of the fight
// (the team's zero-energy companion), every list is played on both starts and scored per seed by the mean of the
// two (startsObjective): the team's sustained DPS when half its fights start with full bars and half from zero. The
// old objective (the given start only, the second a veto) is `objective: "first"`.

import { writeFileSync } from "node:fs";
import {
  describeCue,
  editRuleList,
  judgeEdit,
  mergeEdits,
  learnability,
  pairedGain,
  resolveRuleList,
  RULE_SEARCH_PENALTY,
  rulePool,
  startsObjective,
  summariseGuide,
  guidedEdits,
  splitEdit,
  EngineError,
  type PolicyCue,
  type EditJudgement,
  type GameData,
  type GuideRun,
  type GuideSummary,
  type GuidedEditKind,
  type Learnability,
  type RuleList,
  type TimelineScenario,
} from "@efsim/engine";
import { num, pct, table } from "./format.ts";
import { playSettings, seedJobs, type PlaySettings } from "./diagnose.ts";
import { describeRuleList } from "./rules.ts";
import { commandPool, type RulesPool, type RulesResult } from "./rulespool.ts";
import { codeProvenance } from "./provenance.ts";
import { alternatives, holds, underAssume } from "./assume.ts";

/**
 * How a list is scored over the fight's starts (docs/design/rules.md "The objective across starts"): `mean` (the
 * default when there is a second start) plays every list on every start and scores each seed by the starts' mean
 * sustained DPS; `first` scores the given start only, the second start a veto on the confirm seeds (the search before
 * 2026-11-22).
 */
export type GuidedObjective = "mean" | "first";

export interface GuidedOptions {
  readonly seconds?: number;
  readonly reaction?: number;
  /** Seeds every candidate is screened on (default 6). */
  readonly screenSeeds?: number;
  /** Seeds the best screened candidates are played on before one is kept (default 32). */
  readonly confirmSeeds?: number;
  /** Seeds a close call (over 1.2 standard errors at the confirm seeds, not 2) is taken to (default 64). */
  readonly maxSeeds?: number;
  /** Screened candidates played on the confirm seeds each round (default 4). */
  readonly extend?: number;
  /** Rounds at most (default 6; a round that keeps nothing is followed by one aimed at more losses, then the search stops). */
  readonly rounds?: number;
  /** Directed candidates a round at most (default 28), and random ones added (default 4). */
  readonly candidates?: number;
  readonly random?: number;
  /** DPS less this a complexity point when choosing among kept candidates (default the rule search's, 0.2%). */
  readonly penalty?: number;
  /** Seeds of the final check against the start, fresh (1001…; default the confirm seeds' count; 0: none). */
  readonly checkSeeds?: number;
  readonly workers?: number;
  readonly out?: string;
  /**
   * A second start of the same fight (the team's zero-energy scenario). With `objective` `mean` (the default) every
   * list is played there too and scored by the mean of the two starts; with `first` the best screened edits are
   * played on it (the confirm seeds, paired), and an edit is kept only if it isn't worse there by more than one
   * standard error.
   */
  readonly also?: { readonly scenario: Omit<TimelineScenario, "rotation">; readonly label: string };
  /** The given scenario's label in reports (default "the given start"). */
  readonly label?: string;
  readonly objective?: GuidedObjective;
  /** The final list against the start, on the fresh seeds, under each other reading of the team's kits' open assumptions (assume.ts). */
  readonly assumptions?: boolean;
  readonly progress?: (line: string) => void;
}

/** A gain and its standard error. */
interface Gain {
  readonly gain: number;
  readonly se: number;
}

/** A list's runs on each start scored (the given one first), seeds 1…n on each. */
type Played = readonly (readonly RulesResult[])[];

interface Tried {
  readonly text: string;
  readonly kind: GuidedEditKind | "merge";
  readonly list: RuleList;
  readonly learn: Learnability;
  /** On the screening seeds (the objective). */
  readonly screen: Gain;
  /** On the confirm seeds, when extended (the objective). */
  readonly judged?: EditJudgement;
  /** With the `mean` objective: each start's own paired gain on the confirm seeds (the given start first). */
  readonly perStart?: readonly Gain[];
  /** With the `first` objective: on the second start (GuidedOptions.also), paired on the confirm seeds. */
  readonly also?: Gain;
  readonly runs?: Played;
  readonly alsoRuns?: readonly number[];
}

export interface GuidedRound {
  readonly round: number;
  readonly base: number;
  readonly tried: readonly Tried[];
  readonly kept: Tried | null;
  /** Candidates that passed too but weren't chosen (the penalised score preferred another). */
  readonly alternatives: readonly Tried[];
}

export interface GuidedResult {
  readonly settings: PlaySettings;
  readonly screenSeeds: number;
  readonly confirmSeeds: number;
  readonly objective: GuidedObjective;
  /** The starts scored (the given one first); with the `first` objective only the given one. */
  readonly starts: readonly string[];
  /** The objective's per-seed values (startsObjective over `starts`), and each start's mean. */
  readonly start: { readonly list: RuleList; readonly dps: readonly number[]; readonly perStart: readonly number[]; readonly summary: GuideSummary; readonly learn: Learnability };
  readonly final: { readonly list: RuleList; readonly dps: readonly number[]; readonly perStart: readonly number[]; readonly summary: GuideSummary; readonly learn: Learnability };
  readonly rounds: readonly GuidedRound[];
  /** The second start's label (GuidedOptions.also), if any. */
  readonly also?: string;
  /** Final against start on fresh seeds (1001…), paired: the objective, and each start's own. */
  readonly check: { readonly seeds: number; readonly gain: number; readonly se: number; readonly start: number; readonly final: number; readonly perStart: readonly (Gain & { readonly start: number; readonly final: number })[] } | null;
  /** The check under each other reading of the team's kits' open assumptions (GuidedOptions.assumptions). */
  readonly assumptions?: readonly { readonly label: string; readonly gain: number; readonly se: number; readonly holds: "holds" | "flips" | "unclear" }[];
  readonly runs: number;
  readonly secondsTaken: number;
  /** The code the run used (provenance.ts codeProvenance). */
  readonly code: string;
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** A small seeded generator (mulberry32) for the random complement. */
function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The objective's per-seed values of a list's runs on the starts (startsObjective), the first n seeds. */
export function objectiveOf(p: Played, n = Infinity): number[] {
  return startsObjective(p.map((rs) => rs.slice(0, n).map((r) => r.sustainedDps)));
}

/** Each start's paired gain of `b` over `a` (the first n seeds). */
function perStartGains(a: Played, b: Played, n = Infinity): Gain[] {
  return a.map((rs, s) => pairedGain(rs.slice(0, n).map((r) => r.sustainedDps), (b[s] as readonly RulesResult[]).slice(0, n).map((r) => r.sustainedDps)));
}

/**
 * Cues that tell the starts apart in play (the first start against the second): the team's visible cues by how much
 * more of the fight each holds from one start than the other (the guide's cue shares), the top three, and "two or
 * more ultimates ready" (a full-energy start's opening) always.
 */
function startCues(p: Played): PolicyCue[] {
  const share = (rs: readonly RulesResult[]) => summariseGuide(rs.map((r) => r.guide as GuideRun)).cueShare;
  const a = share(p[0] as readonly RulesResult[]);
  const b = share(p[1] as readonly RulesResult[]);
  const diffs = a.map((x, i) => ({ cue: x.cue, d: x.share - (b[i]?.share ?? 0) })).filter((x) => Math.abs(x.d) >= 0.01 && !("sp" in x.cue) && !("combo" in x.cue));
  diffs.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const out: PolicyCue[] = [{ ultimates: { atLeast: 2 } }];
  for (const x of diffs) {
    if (out.length >= 4) break;
    const c = x.d > 0 ? x.cue : { not: x.cue };
    if (!out.some((y) => JSON.stringify(y) === JSON.stringify(c))) out.push(c);
  }
  return out;
}

/** The guided search (module comment). */
export async function guidedSearch(data: GameData, scenario: Omit<TimelineScenario, "rotation">, rawList: RuleList, o: GuidedOptions = {}): Promise<GuidedResult> {
  const t0 = performance.now();
  const team = scenario.team.map((b) => b.operator);
  const controlled = scenario.controlled ?? (team[0] as string);
  const { settings } = playSettings(data, scenario, { ...(o.seconds !== undefined ? { seconds: o.seconds } : {}), ...(o.reaction !== undefined ? { reaction: o.reaction } : {}), ...(o.workers !== undefined ? { workers: o.workers } : {}) });
  const S = o.screenSeeds ?? 6;
  const C = Math.max(S, o.confirmSeeds ?? 32);
  const M = Math.max(C, o.maxSeeds ?? 64);
  const penalty = o.penalty ?? RULE_SEARCH_PENALTY;
  const objective: GuidedObjective = o.also ? (o.objective ?? "mean") : "first";
  const starts: { scenario: Omit<TimelineScenario, "rotation">; label: string }[] = [{ scenario, label: o.label ?? "the given start" }, ...(objective === "mean" && o.also ? [o.also] : [])];
  const veto = objective === "first" ? o.also : undefined;
  // The command's pool, kept for its other batches (rulespool.ts commandPool).
  const pool: RulesPool = commandPool(data, settings.workers);
  const elapsed = () => `${((performance.now() - t0) / 1000).toFixed(0)} s`;
  let runs = 0;
  /** Lists on every start, seeds first…first + n − 1, one batch: per list, per start. */
  const playMany = async (lists: readonly RuleList[], n: readonly number[] | number, first: readonly number[] | number = 1, guide = true): Promise<RulesResult[][][]> => {
    const ns = typeof n === "number" ? lists.map(() => n) : n;
    const fs = typeof first === "number" ? lists.map(() => first) : first;
    const jobs = lists.flatMap((l, i) => starts.flatMap((st) => seedJobs(st.scenario, l, settings, ns[i] as number, guide ? { guide: true } : {}, fs[i] as number)));
    const r = jobs.length ? await pool.run(jobs) : [];
    runs += r.length;
    let at = 0;
    return lists.map((_, i) =>
      starts.map(() => {
        const k = ns[i] as number;
        const x = r.slice(at, at + k);
        at += k;
        return x;
      }),
    );
  };
  const play = async (list: RuleList, n: number, first = 1, guide = true): Promise<RulesResult[][]> => (await playMany([list], n, first, guide))[0] as RulesResult[][];
  const guidesOf = (p: Played, n = Infinity) => p.flatMap((rs) => rs.slice(0, n).map((r) => r.guide as GuideRun));
  const meanPerStart = (p: Played, n = Infinity) => p.map((rs) => mean(rs.slice(0, n).map((r) => r.sustainedDps)));
  const randomRng = stream(1);
  const randomPool = rulePool(data, team, controlled);
  let cur = resolveRuleList(data, team, rawList);
  o.progress?.(`start: ${C} seeds of the list on ${starts.length === 1 ? "one start" : `${starts.length} starts (objective: their mean)`}`);
  let curRuns: Played = await play(cur, C);
  const start = { list: cur, dps: objectiveOf(curRuns), perStart: meanPerStart(curRuns), summary: summariseGuide(guidesOf(curRuns)), learn: learnability(cur) };
  const tried = new Set<string>([JSON.stringify(cur)]);
  const rounds: GuidedRound[] = [];
  let widen = false;
  let alsoBase: number[] | null = null;
  // Edits that gained from one start and lost from the other (each beyond one standard error), with the list they
  // edited: the next round tries each read only while a cue that tells the starts apart holds (splitEdit; rules.md
  // "The objective across starts"). After a round that kept nothing, its disagreeing edits of the current list; after
  // one that kept a disagreeing edit, that edit (the split of it is then an edit of the new list too).
  let split: { readonly base: RuleList; readonly t: Tried }[] = [];
  const disagrees = (t: Tried) => t.perStart !== undefined && t.perStart.length > 1 && t.perStart.some((g) => g.gain > g.se) && t.perStart.some((g) => g.gain < -g.se);
  for (let round = 1; round <= (o.rounds ?? 6); round++) {
    let curDps = objectiveOf(curRuns);
    const summary = summariseGuide(guidesOf(curRuns, C));
    const raw = guidedEdits(data, cur, summary, {
      tried,
      targets: widen ? 14 : 6,
      max: (o.candidates ?? 28) + (widen ? 16 : 0),
      random: o.random ?? 4,
      rng: randomRng,
      randomEdit: (rng, l) => editRuleList(rng, randomPool, l, 12),
    });
    const cands: { text: string; kind: GuidedEditKind | "merge"; list: RuleList }[] = [];
    if (split.length && starts.length > 1) {
      const cues = startCues(curRuns);
      for (const { base, t } of split.slice(0, 2))
        for (const c of cues) {
          const l = splitEdit(base, t.list, c, describeCue(data, c));
          if (l) raw.push({ list: l, kind: "by-start", text: `${t.text}, only while ${describeCue(data, c)}` });
        }
    }
    split = [];
    for (const c of raw) {
      let list: RuleList;
      try {
        list = resolveRuleList(data, team, c.list);
      } catch (e) {
        if (e instanceof EngineError) continue;
        throw e;
      }
      const k = JSON.stringify(list);
      if (tried.has(k)) continue;
      tried.add(k);
      cands.push({ text: c.text, kind: c.kind, list });
    }
    if (cands.length === 0) break;
    o.progress?.(`round ${round}: ${cands.length} candidates × ${S} seeds${starts.length > 1 ? ` × ${starts.length} starts` : ""}${widen ? " (widened)" : ""} (${elapsed()})`);
    const screen = async (cs: { text: string; kind: GuidedEditKind | "merge"; list: RuleList }[]): Promise<Tried[]> => {
      let res: RulesResult[][][] = [];
      try {
        res = await playMany(cs.map((c) => c.list), S);
      } catch (e) {
        // A candidate the team can't play fails its run: each judged alone, those that fail dropped.
        if (!(e instanceof Error)) throw e;
        const ok: typeof cs = [];
        res = [];
        for (const c of cs) {
          try {
            res.push(await play(c.list, S));
            ok.push(c);
          } catch {
            // dropped
          }
        }
        cs = ok;
      }
      return cs.map((c, i) => {
        const p = res[i] as RulesResult[][];
        return { text: c.text, kind: c.kind, list: c.list, learn: learnability(c.list), screen: pairedGain(curDps.slice(0, S), objectiveOf(p)), runs: p };
      });
    };
    const triedRound: Tried[] = await screen(cands);
    // Two edits that each gained on the screening seeds and change different rules, together.
    const good = [...triedRound].filter((t) => t.screen.gain > 0.002).sort((a, b) => b.screen.gain - a.screen.gain).slice(0, 4);
    const merges: { text: string; kind: GuidedEditKind | "merge"; list: RuleList }[] = [];
    for (let i = 0; i < good.length; i++)
      for (let j = i + 1; j < good.length; j++) {
        const a = good[i] as Tried;
        const b = good[j] as Tried;
        const m = mergeEdits(cur, a.list, b.list);
        if (!m) continue;
        const k = JSON.stringify(m);
        if (tried.has(k)) continue;
        tried.add(k);
        merges.push({ text: `Both: ${a.text}; and ${b.text}`, kind: "merge", list: m });
      }
    if (merges.length) triedRound.push(...(await screen(merges.slice(0, 3))));
    // The best few by screened gain are played on the confirm seeds (one batch).
    const top = [...triedRound].filter((t) => t.screen.gain > 0).sort((a, b) => b.screen.gain - a.screen.gain).slice(0, o.extend ?? 4);
    const extendTo = async (ts: readonly Tried[], to: number) => {
      const have = ts.map((t) => ((t.runs as Played)[0] as readonly RulesResult[]).length);
      const res = await playMany(ts.map((t) => t.list), have.map((h) => to - h), have.map((h) => h + 1));
      ts.forEach((t, i) => {
        const all: Played = (t.runs as Played).map((rs, s) => [...rs, ...((res[i] as RulesResult[][])[s] as RulesResult[])]);
        const idx = triedRound.indexOf(t);
        triedRound[idx] = { ...t, judged: judgeEdit(curDps, objectiveOf(all), S), ...(starts.length > 1 ? { perStart: perStartGains(curRuns, all) } : {}), runs: all };
      });
    };
    if (top.length && C > S) await extendTo(top, C);
    if (veto && top.length) {
      alsoBase ??= (await pool.run(seedJobs(veto.scenario, cur, settings, C))).map((r) => r.sustainedDps);
      const res = await pool.run(top.flatMap((t) => seedJobs(veto.scenario, t.list, settings, C)));
      runs += res.length;
      top.forEach((t0, i) => {
        const t = triedRound.find((x) => x.list === t0.list) as Tried;
        const a = res.slice(i * C, (i + 1) * C).map((r) => r.sustainedDps);
        triedRound[triedRound.indexOf(t)] = { ...t, also: pairedGain(alsoBase as number[], a), alsoRuns: a };
      });
    }
    // Close calls (over 1.2 standard errors but not 2) get the max seeds, the base too.
    const close = triedRound.filter((t) => t.judged && !t.judged.pass && t.judged.gain > 1.2 * t.judged.se && t.judged.gain >= 0.002);
    if (close.length && M > C) {
      o.progress?.(`round ${round}: ${close.length} close call${close.length === 1 ? "" : "s"}: ${M} seeds (${elapsed()})`);
      const have = (curRuns[0] as readonly RulesResult[]).length;
      if (have < M) {
        const more = await play(cur, M - have, have + 1);
        curRuns = curRuns.map((rs, s) => [...rs, ...(more[s] as RulesResult[])]);
        curDps = objectiveOf(curRuns);
      }
      await extendTo(close, M);
    }
    const passed = triedRound.filter((t) => t.judged?.pass && (!veto || (t.also !== undefined && t.also.gain > -t.also.se)));
    const score = (t: Tried) => (t.judged as EditJudgement).gain - penalty * (t.learn.complexity - learnability(cur).complexity);
    const kept = passed.length ? passed.reduce((a, b) => (score(b) > score(a) ? b : a)) : null;
    rounds.push({ round, base: mean(curDps), tried: triedRound.map(({ runs: _r, ...t }) => t), kept: kept ? { ...kept, runs: [] } : null, alternatives: passed.filter((t) => t !== kept).map(({ runs: _r, ...t }) => t) });
    if (!kept) {
      split = triedRound.filter(disagrees).sort((a, b) => b.screen.gain - a.screen.gain).map((t) => ({ base: cur, t }));
      o.progress?.(`round ${round}: nothing clears the bar (${elapsed()})${split.length ? `; ${split.length} edit${split.length === 1 ? "" : "s"} split by the start next` : ""}`);
      // Once more with more losses aimed at, then stop.
      if (widen) break;
      widen = true;
      continue;
    }
    widen = false;
    o.progress?.(`round ${round}: kept "${kept.text}" ${signed((kept.judged as EditJudgement).gain)} ± ${((kept.judged as EditJudgement).se * 100).toFixed(2)}${kept.perStart ? ` (${kept.perStart.map(pm).join(" / ")} by start)` : ""} (${elapsed()})`);
    if (disagrees(kept)) split = [{ base: cur, t: kept }];
    cur = kept.list;
    curRuns = kept.runs as Played;
    alsoBase = kept.alsoRuns ? [...kept.alsoRuns] : null;
    // A long run's partial result: the list kept so far, saved as it goes (overwritten by the final one).
    if (o.out) writeFileSync(o.out, JSON.stringify({ ...cur, description: `Partial result of efsim rules --guided (after round ${round}, ${elapsed()}): the list kept so far.` }, null, 2) + "\n");
  }
  const final = { list: cur, dps: objectiveOf(curRuns, C), perStart: meanPerStart(curRuns, C), summary: summariseGuide(guidesOf(curRuns)), learn: learnability(cur) };
  let check: GuidedResult["check"] = null;
  const K = o.checkSeeds ?? C;
  if (K > 0 && rounds.some((r) => r.kept)) {
    o.progress?.(`check: start and final on ${K} fresh seeds (${elapsed()})`);
    const [a, b] = (await playMany([start.list, cur], K, 1001, false)) as [RulesResult[][], RulesResult[][]];
    const pa = objectiveOf(a);
    const pb = objectiveOf(b);
    const perStart = perStartGains(a, b).map((g, s) => ({ ...g, start: mean((a[s] as RulesResult[]).map((r) => r.sustainedDps)), final: mean((b[s] as RulesResult[]).map((r) => r.sustainedDps)) }));
    check = { seeds: K, ...pairedGain(pa, pb), start: mean(pa), final: mean(pb), perStart };
  }
  const assumptions: NonNullable<GuidedResult["assumptions"]>[number][] = [];
  if (o.assumptions && check) {
    for (const alt of alternatives(data, scenario)) {
      o.progress?.(`assumption ${alt.id}=${alt.reading}: start and final on ${K} fresh seeds (${elapsed()})`);
      const jobs = (l: RuleList) => starts.flatMap((st) => seedJobs(underAssume(st.scenario, alt.assume), l, settings, K, {}, 1001));
      const r = await pool.run([...jobs(start.list), ...jobs(cur)]);
      runs += r.length;
      const half = (xs: RulesResult[]) => starts.map((_, s) => xs.slice(s * K, (s + 1) * K));
      const g = pairedGain(objectiveOf(half(r.slice(0, K * starts.length))), objectiveOf(half(r.slice(K * starts.length))));
      assumptions.push({ label: alt.label, ...g, holds: holds(check, g) });
    }
  }
  return {
    settings,
    screenSeeds: S,
    confirmSeeds: C,
    objective,
    starts: starts.map((s) => s.label),
    start,
    final,
    rounds,
    check,
    runs,
    secondsTaken: (performance.now() - t0) / 1000,
    code: codeProvenance(),
    ...(o.also ? { also: o.also.label } : {}),
    ...(o.assumptions ? { assumptions } : {}),
  };
}

// --- In plain words ---------------------------------------------------------------------------------------------

const n0 = (x: number) => num(Math.round(x), 0);
const signed = (x: number, d = 2) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;
const pm = (g: { readonly gain: number; readonly se: number }) => `${signed(g.gain)} ± ${(g.se * 100).toFixed(2)}`;
const RANK_WORDS: Readonly<Record<number, string>> = { 0: "none", 1: "a combo lighting up", 2: "SP or Typhoeus's arrows / Signs", 3: "the enemy's state or an operator's visible state", 4: "an ultimate ready", 5: "counting Final Strikes", 6: "a combo's cooldown", 7: "a timer" };
const learnWords = (l: Learnability) => `complexity ${l.complexity} (${l.rules} rules, ${l.ruleSteps} presses, cue cost ${l.cueCost}; hardest cue: rank ${l.hardestRank}, ${RANK_WORDS[l.hardestRank]})`;

/** The ideal combos: each window, what it deals, its ideal's gain, the multipliers it misses most and the cues that come with it. */
export function formatIdeal(data: GameData, s: GuideSummary, top = 6): string[] {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const giverWords = (g: string | null) => {
    if (!g) return "";
    const [op, kind] = g.split(":") as [string, string];
    return kind === "passive" ? `${name(op)}, passive` : `${name(op)}'s ${kind === "battle" ? "battle skill" : kind}`;
  };
  const lines = [
    `Team DPS over the whole fight ${n0(s.totalDps)}; the windows' ideal combos (every multiplier the team puts on a window, on every hit of it: an upper bound) would add ${n0(s.idealDps)}: achieved ${pct(s.achievement)}.${s.spAtCapShare > 0.01 ? ` Team SP at the cap ${pct(s.spAtCapShare)} of the fight.` : ""}`,
    table(
      ["window", "DPS", "per min", "ideal +DPS", "achieved", "missing most (on: share of its damage; ×factor when on; DPS lost; given by)"],
      s.windows.slice(0, top).map((w) => [
        w.label,
        n0(w.dps),
        w.perMinute.toFixed(1),
        n0(w.idealDps),
        pct(w.achievement, 0),
        w.losses.slice(0, 3).map((l) => `${l.label} (on ${pct(l.presence, 0)}, ×${l.factor.toFixed(2)}, −${n0(l.lossDps)}${l.giver ? `; ${giverWords(l.giver)}` : ""})`).join("; "),
      ]),
      ["l", "r", "r", "r", "r", "l"],
    ),
  ];
  for (const w of s.windows.slice(0, top)) {
    const cues = w.cues.filter((c) => c.atStart >= 0.5 && c.lift >= 1.3 && !("sp" in c.cue)).slice(0, 3);
    if (cues.length) lines.push(`  ${w.label} comes with: ${cues.map((c) => `${describeCue(data, c.cue)} (${pct(c.atStart, 0)} of its starts, ${pct(c.base, 0)} of the fight)`).join("; ")}`);
  }
  return lines;
}

/** Achievement per window, start against final. */
function formatAchievement(data: GameData, a: GuideSummary, b: GuideSummary, top = 6): string[] {
  const keys = [...new Set([...a.windows.slice(0, top), ...b.windows.slice(0, top)].map((w) => w.key))];
  const rows = keys.map((k) => {
    const x = a.windows.find((w) => w.key === k);
    const y = b.windows.find((w) => w.key === k);
    const lab = (x ?? y)?.label ?? k;
    return [lab, x ? n0(x.dps) : "–", y ? n0(y.dps) : "–", x ? pct(x.achievement, 0) : "–", y ? pct(y.achievement, 0) : "–"];
  });
  rows.push(["team (whole fight)", n0(a.totalDps), n0(b.totalDps), pct(a.achievement, 0), pct(b.achievement, 0)]);
  return [table(["window", "DPS before", "after", "achieved before", "after"], rows, ["l", "r", "r", "r", "r"])];
}

/** Values per start, labelled ("a on the given start / b on …-zero"). */
const byStart = (r: GuidedResult, xs: readonly string[]) => xs.map((x, s) => `${x} on ${r.starts[s]}`).join(" / ");

export function formatGuided(data: GameData, r: GuidedResult, title: string, file: string): string {
  const veto = r.objective === "first" && r.also !== undefined;
  const perStart = r.starts.length > 1;
  const lines = [
    title,
    `${r.code}; ${r.settings.seconds} s fights, reaction ${r.settings.reaction} s ± 50%; common random numbers: candidates screened on seeds 1–${r.screenSeeds}, the best few played on 1–${r.confirmSeeds} (close calls on more); kept when the paired gain is over twice its standard error (and 0.2%) and positive on seeds ${r.screenSeeds + 1}–${r.confirmSeeds} alone; ${r.runs} runs in ${r.secondsTaken.toFixed(0)} s on ${r.settings.workers} worker${r.settings.workers === 1 ? "" : "s"}.`,
    r.objective === "mean"
      ? `Objective: the mean sustained DPS over ${r.starts.length} starts (${r.starts.join("; ")}), every list played on each, paired per seed (docs/design/rules.md "The objective across starts").`
      : r.also
        ? `Objective: the given start only; second start ${r.also}: the edits played on the confirm seeds are played there too (paired), and one is kept only if it isn't worse there by more than one standard error.`
        : "Objective: the given start only (no second start).",
    "",
    `Start (${file}): ${n0(mean(r.start.dps))} sustained DPS over ${r.confirmSeeds} seeds${r.starts.length > 1 ? ` (${byStart(r, r.start.perStart.map(n0))})` : ""}; ${learnWords(r.start.learn)}.`,
    "",
    "Ideal combos (the start list's runs):",
    ...formatIdeal(data, r.start.summary),
  ];
  for (const rd of r.rounds) {
    lines.push("", `Round ${rd.round} (base ${n0(rd.base)}): ${rd.tried.length} edits tried on seeds 1–${r.screenSeeds}${rd.tried.some((t) => t.judged) ? `, the best played on 1–${r.confirmSeeds}` : ""}:`);
    const sorted = [...rd.tried].sort((a, b) => b.screen.gain - a.screen.gain);
    lines.push(
      table(
        ["edit", "kind", `gain (${r.screenSeeds} seeds)`, `gain (${r.confirmSeeds} seeds)`, "fresh seeds", ...(veto ? ["second start"] : []), ...(perStart ? ["by start"] : []), "complexity", "hardest"],
        sorted.map((t) => [
          t.text.length > 110 ? `${t.text.slice(0, 107)}...` : t.text,
          t.kind,
          pm(t.screen),
          t.judged ? `${pm(t.judged)}${t.judged.seeds !== r.confirmSeeds ? ` [${t.judged.seeds} seeds]` : ""}${t.judged.pass ? (t === rd.kept || (rd.kept && t.text === rd.kept.text) ? " kept" : veto && !(t.also && t.also.gain > -t.also.se) ? " (not on the second start)" : " passed") : ""}` : "",
          t.judged ? signed(t.judged.freshGain) : "",
          ...(veto ? [t.also ? pm(t.also) : ""] : []),
          ...(perStart ? [t.perStart ? t.perStart.map(pm).join(" / ") : ""] : []),
          String(t.learn.complexity),
          String(t.learn.hardestRank),
        ]),
        ["l", "l", "r", "r", "r", ...(veto ? ["r" as const] : []), ...(perStart ? ["r" as const] : []), "r", "r"],
      ),
    );
    if (rd.kept) lines.push(`Kept: ${rd.kept.text}: ${pm(rd.kept.judged as EditJudgement)} over ${(rd.kept.judged as EditJudgement).seeds} seeds (${signed((rd.kept.judged as EditJudgement).freshGain)} on the seeds after the screening ones${rd.kept.perStart ? `; by start ${byStart(r, rd.kept.perStart.map(pm))}` : ""}); ${learnWords(rd.kept.learn)}.`);
    else lines.push("Nothing clears the bar: the search stops.");
    for (const a of rd.alternatives) lines.push(`  Also passed (not chosen: the penalised score preferred the kept one): ${a.text}: ${pm(a.judged as EditJudgement)}; ${learnWords(a.learn)}.`);
  }
  lines.push("", `Final: ${n0(mean(r.final.dps))} sustained DPS over ${r.confirmSeeds} seeds (start ${n0(mean(r.start.dps))})${r.starts.length > 1 ? `; by start ${byStart(r, r.final.perStart.map(n0))}` : ""}; ${learnWords(r.final.learn)}.`);
  if (r.check) {
    lines.push(`Check on ${r.check.seeds} fresh seeds (1001…): start ${n0(r.check.start)}, final ${n0(r.check.final)}: ${pm(r.check)}${r.starts.length > 1 ? " (the objective)" : ""}.`);
    if (r.check.perStart.length > 1) for (const [s, g] of r.check.perStart.entries()) lines.push(`  ${r.starts[s]}: ${n0(g.start)} → ${n0(g.final)}: ${pm(g)}`);
  }
  if (r.assumptions) {
    lines.push(r.assumptions.length ? "The check under the kits' open assumptions (each other reading of an in-game test; the same fresh seeds):" : "The kits' open assumptions: none for this team (or no change to check).");
    for (const a of r.assumptions) lines.push(`- ${a.label}: ${pm(a)}: ${a.holds}`);
  }
  const kept = r.rounds.filter((x) => x.kept);
  if (kept.length) {
    lines.push("", "The path (each kept list; a Pareto choice of DPS against what it takes to learn):");
    lines.push(
      table(
        ["list", "sustained DPS", "complexity", "hardest cue"],
        [
          ["start", n0(mean(r.start.dps)), String(r.start.learn.complexity), String(r.start.learn.hardestRank)],
          ...kept.map((x) => [`after round ${x.round}: ${(x.kept as Tried).text.slice(0, 80)}`, n0(x.base * (1 + ((x.kept as Tried).judged as EditJudgement).gain)), String((x.kept as Tried).learn.complexity), String((x.kept as Tried).learn.hardestRank)]),
        ],
        ["l", "r", "r", "r"],
      ),
    );
  }
  lines.push("", "Achievement of the ideal combos, start against final:", ...formatAchievement(data, r.start.summary, r.final.summary));
  lines.push("", "Final list:", ...describeRuleList(data, r.final.list));
  return lines.join("\n");
}

/** Writes the final list (with a description of how it was found). */
export function writeGuided(r: GuidedResult, out: string, file: string): void {
  const desc = `Found by efsim rules --guided from ${file}: ${n0(mean(r.final.dps))} sustained DPS over ${r.settings.seconds} s at a ${r.settings.reaction} s reaction delay (${r.confirmSeeds} seeds; start ${n0(mean(r.start.dps))}${r.starts.length > 1 ? `; the mean of ${r.starts.join(" and ")}` : ""})${r.check ? `; on ${r.check.seeds} fresh seeds ${pm(r.check)}` : ""}; complexity ${r.final.learn.complexity}.`;
  writeFileSync(out, JSON.stringify({ ...r.final.list, description: desc }, null, 2) + "\n");
}
