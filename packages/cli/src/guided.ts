// efsim rules --guided: the payoff-guided rule search (docs/design.md "Rule-based rotations", the guided search; the
// owner, 2026-11-16: "put together ideal combos and seek to change the rules in directions that can get closer to
// achieving the optimal damage output"). From the list's runs (common random numbers), each damage window's ideal
// combo (every multiplier the team puts on it, on every hit) and what each missing multiplier costs (engine
// policyguide.ts); edits aimed at the biggest losses (hold the giver for the window's cue, chain the presses, start
// the window when the multiplier is up, save SP, `shows`, spare SP; a few random moves as a complement), screened on
// a few seeds, the best few played on more, one kept per round when its gain clears the bar (judgeEdit); then the
// analysis again on the new list, until nothing clears it.

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
  summariseGuide,
  guidedEdits,
  EngineError,
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
import { openRulesPool, type RulesPool, type RulesResult } from "./rulespool.ts";

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
  readonly progress?: (line: string) => void;
}

interface Tried {
  readonly text: string;
  readonly kind: GuidedEditKind | "merge";
  readonly list: RuleList;
  readonly learn: Learnability;
  /** On the screening seeds. */
  readonly screen: { readonly gain: number; readonly se: number };
  /** On the confirm seeds, when extended. */
  readonly judged?: EditJudgement;
  readonly runs?: readonly RulesResult[];
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
  readonly start: { readonly list: RuleList; readonly dps: readonly number[]; readonly summary: GuideSummary; readonly learn: Learnability };
  readonly final: { readonly list: RuleList; readonly dps: readonly number[]; readonly summary: GuideSummary; readonly learn: Learnability };
  readonly rounds: readonly GuidedRound[];
  /** Final against start on fresh seeds (1001…), paired. */
  readonly check: { readonly seeds: number; readonly gain: number; readonly se: number; readonly start: number; readonly final: number } | null;
  readonly runs: number;
  readonly secondsTaken: number;
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
  const pool: RulesPool = openRulesPool(data, settings.workers);
  const elapsed = () => `${((performance.now() - t0) / 1000).toFixed(0)} s`;
  let runs = 0;
  const play = async (list: RuleList, seeds: number, first = 1, guide = true) => {
    const r = await pool.run(seedJobs(scenario, list, settings, seeds, guide ? { guide: true } : {}, first));
    runs += r.length;
    return r;
  };
  const guidesOf = (rs: readonly RulesResult[]) => rs.map((r) => r.guide as GuideRun);
  const randomRng = stream(1);
  const randomPool = rulePool(data, team, controlled);
  try {
    let cur = resolveRuleList(data, team, rawList);
    o.progress?.(`start: ${C} seeds of the list`);
    let curRuns = await play(cur, C);
    const start = { list: cur, dps: curRuns.map((r) => r.sustainedDps), summary: summariseGuide(guidesOf(curRuns)), learn: learnability(cur) };
    const tried = new Set<string>([JSON.stringify(cur)]);
    const rounds: GuidedRound[] = [];
    let widen = false;
    for (let round = 1; round <= (o.rounds ?? 6); round++) {
      let curDps = curRuns.map((r) => r.sustainedDps);
      const summary = summariseGuide(guidesOf(curRuns.slice(0, C)));
      const raw = guidedEdits(data, cur, summary, {
        tried,
        targets: widen ? 14 : 6,
        max: (o.candidates ?? 28) + (widen ? 16 : 0),
        random: o.random ?? 4,
        rng: randomRng,
        randomEdit: (rng, l) => editRuleList(rng, randomPool, l, 12),
      });
      const cands: { text: string; kind: GuidedEditKind | "merge"; list: RuleList }[] = [];
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
      o.progress?.(`round ${round}: ${cands.length} candidates × ${S} seeds${widen ? " (widened)" : ""} (${elapsed()})`);
      const screen = async (cs: { text: string; kind: GuidedEditKind | "merge"; list: RuleList }[]): Promise<Tried[]> => {
        const jobs = cs.flatMap((c) => seedJobs(scenario, c.list, settings, S, { guide: true }));
        let res: RulesResult[] = [];
        try {
          res = await pool.run(jobs);
          runs += jobs.length;
        } catch (e) {
          // A candidate the team can't play fails its run: each judged alone, those that fail dropped.
          if (!(e instanceof Error)) throw e;
          const ok: typeof cs = [];
          res = [];
          for (const c of cs) {
            try {
              res.push(...(await play(c.list, S)));
              ok.push(c);
            } catch {
              // dropped
            }
          }
          cs = ok;
        }
        return cs.map((c, i) => {
          const rs = res.slice(i * S, (i + 1) * S);
          return { text: c.text, kind: c.kind, list: c.list, learn: learnability(c.list), screen: pairedGain(curDps.slice(0, S), rs.map((r) => r.sustainedDps)), runs: rs };
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
        const jobs = ts.flatMap((t) => seedJobs(scenario, t.list, settings, to - (t.runs as RulesResult[]).length, { guide: true }, (t.runs as RulesResult[]).length + 1));
        const res = await pool.run(jobs);
        runs += res.length;
        let at = 0;
        for (const t of ts) {
          const n = to - (t.runs as RulesResult[]).length;
          const all = [...(t.runs as RulesResult[]), ...res.slice(at, at + n)];
          at += n;
          const idx = triedRound.indexOf(t);
          triedRound[idx] = { ...t, judged: judgeEdit(curDps, all.map((r) => r.sustainedDps), S), runs: all };
        }
      };
      if (top.length && C > S) await extendTo(top, C);
      // Close calls (over 1.2 standard errors but not 2) get the max seeds, the base too.
      const close = triedRound.filter((t) => t.judged && !t.judged.pass && t.judged.gain > 1.2 * t.judged.se && t.judged.gain >= 0.002);
      if (close.length && M > C) {
        o.progress?.(`round ${round}: ${close.length} close call${close.length === 1 ? "" : "s"}: ${M} seeds (${elapsed()})`);
        if (curRuns.length < M) {
          curRuns = [...curRuns, ...(await play(cur, M - curRuns.length, curRuns.length + 1))];
          curDps = curRuns.map((r) => r.sustainedDps);
        }
        await extendTo(close, M);
      }
      const passed = triedRound.filter((t) => t.judged?.pass);
      const score = (t: Tried) => (t.judged as EditJudgement).gain - penalty * (t.learn.complexity - learnability(cur).complexity);
      const kept = passed.length ? passed.reduce((a, b) => (score(b) > score(a) ? b : a)) : null;
      rounds.push({ round, base: mean(curDps), tried: triedRound.map(({ runs: _r, ...t }) => t), kept: kept ? { ...kept, runs: [] } : null, alternatives: passed.filter((t) => t !== kept).map(({ runs: _r, ...t }) => t) });
      if (!kept) {
        o.progress?.(`round ${round}: nothing clears the bar (${elapsed()})`);
        // Once more with more losses aimed at, then stop.
        if (widen) break;
        widen = true;
        continue;
      }
      widen = false;
      o.progress?.(`round ${round}: kept "${kept.text}" ${signed((kept.judged as EditJudgement).gain)} ± ${((kept.judged as EditJudgement).se * 100).toFixed(2)} (${elapsed()})`);
      cur = kept.list;
      curRuns = kept.runs as RulesResult[];
    }
    const final = { list: cur, dps: curRuns.slice(0, C).map((r) => r.sustainedDps), summary: summariseGuide(guidesOf(curRuns)), learn: learnability(cur) };
    let check: GuidedResult["check"] = null;
    const K = o.checkSeeds ?? C;
    if (K > 0 && rounds.some((r) => r.kept)) {
      o.progress?.(`check: start and final on ${K} fresh seeds (${elapsed()})`);
      const a = (await play(start.list, K, 1001, false)).map((r) => r.sustainedDps);
      const b = (await play(cur, K, 1001, false)).map((r) => r.sustainedDps);
      check = { seeds: K, ...pairedGain(a, b), start: mean(a), final: mean(b) };
    }
    return { settings, screenSeeds: S, confirmSeeds: C, start, final, rounds, check, runs, secondsTaken: (performance.now() - t0) / 1000 };
  } finally {
    await pool.close();
  }
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

export function formatGuided(data: GameData, r: GuidedResult, title: string, file: string): string {
  const lines = [
    title,
    `${r.settings.seconds} s fights, reaction ${r.settings.reaction} s ± 50%; common random numbers: candidates screened on seeds 1–${r.screenSeeds}, the best few played on 1–${r.confirmSeeds} (close calls on more); kept when the paired gain is over twice its standard error (and 0.2%) and positive on seeds ${r.screenSeeds + 1}–${r.confirmSeeds} alone; ${r.runs} runs in ${r.secondsTaken.toFixed(0)} s on ${r.settings.workers} worker${r.settings.workers === 1 ? "" : "s"}.`,
    "",
    `Start (${file}): ${n0(mean(r.start.dps))} sustained DPS over ${r.confirmSeeds} seeds; ${learnWords(r.start.learn)}.`,
    "",
    "Ideal combos (the start list's runs):",
    ...formatIdeal(data, r.start.summary),
  ];
  for (const rd of r.rounds) {
    lines.push("", `Round ${rd.round} (base ${n0(rd.base)}): ${rd.tried.length} edits tried on seeds 1–${r.screenSeeds}${rd.tried.some((t) => t.judged) ? `, the best played on 1–${r.confirmSeeds}` : ""}:`);
    const sorted = [...rd.tried].sort((a, b) => b.screen.gain - a.screen.gain);
    lines.push(
      table(
        ["edit", "kind", `gain (${r.screenSeeds} seeds)`, `gain (${r.confirmSeeds} seeds)`, "fresh seeds", "complexity", "hardest"],
        sorted.map((t) => [
          t.text.length > 110 ? `${t.text.slice(0, 107)}...` : t.text,
          t.kind,
          pm(t.screen),
          t.judged ? `${pm(t.judged)}${t.judged.seeds !== r.confirmSeeds ? ` [${t.judged.seeds} seeds]` : ""}${t.judged.pass ? (t === rd.kept || (rd.kept && t.text === rd.kept.text) ? " kept" : " passed") : ""}` : "",
          t.judged ? signed(t.judged.freshGain) : "",
          String(t.learn.complexity),
          String(t.learn.hardestRank),
        ]),
        ["l", "l", "r", "r", "r", "r", "r"],
      ),
    );
    if (rd.kept) lines.push(`Kept: ${rd.kept.text}: ${pm(rd.kept.judged as EditJudgement)} over ${(rd.kept.judged as EditJudgement).seeds} seeds (${signed((rd.kept.judged as EditJudgement).freshGain)} on the fresh ones); ${learnWords(rd.kept.learn)}.`);
    else lines.push("Nothing clears the bar: the search stops.");
    for (const a of rd.alternatives) lines.push(`  Also passed (not chosen: the penalised score preferred the kept one): ${a.text}: ${pm(a.judged as EditJudgement)}; ${learnWords(a.learn)}.`);
  }
  lines.push("", `Final: ${n0(mean(r.final.dps))} sustained DPS over ${r.confirmSeeds} seeds (start ${n0(mean(r.start.dps))}); ${learnWords(r.final.learn)}.`);
  if (r.check) lines.push(`Check on ${r.check.seeds} fresh seeds (1001…): start ${n0(r.check.start)}, final ${n0(r.check.final)}: ${pm(r.check)}.`);
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
  const desc = `Found by efsim rules --guided from ${file}: ${n0(mean(r.final.dps))} sustained DPS over ${r.settings.seconds} s at a ${r.settings.reaction} s reaction delay (${r.confirmSeeds} seeds; start ${n0(mean(r.start.dps))})${r.check ? `; on ${r.check.seeds} fresh seeds ${pm(r.check)}` : ""}; complexity ${r.final.learn.complexity}.`;
  writeFileSync(out, JSON.stringify({ ...r.final.list, description: desc }, null, 2) + "\n");
}
