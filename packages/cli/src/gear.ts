// `efsim gear`: which of the gear loadouts seen in logs (and any given by hand, e.g. from guide sites) does best for
// each operator of a team, scored on the team's own rotation (docs/design.md "Gear from the logs"). Per operator the
// candidates are the distinct loadouts of the log fixtures (pieces as logged, full artifice), counted overall and by
// how many of the scenario's teammates the log has; each is scored by replaying the scenario's rotation with only that
// operator's gear swapped (a step that can't be played is moved later or dropped: a repaired replay; with too many such
// steps, a narrow search), and a coordinate ascent takes each operator's best with the others fixed until nothing changes.

import { apply, computeStats, createContext, EngineError, init, searchBeams, simulate, type Build, type GameData, type TimelineScenario } from "@efsim/engine";
import { modePair } from "./edge.ts";
import { num, table } from "./format.ts";
import { readLogFixture } from "./logs.ts";

/** Where a candidate loadout comes from. */
export interface GearSource {
  /** `scenario`: the scenario's own; `log`: the log fixtures; `file`: a candidates file (a guide site, another tool). */
  readonly kind: "scenario" | "log" | "file";
  /** What to cite: for logs the count, for a file its `source` text. */
  readonly label: string;
}

export interface GearCandidate {
  readonly operator: string;
  /** Gear piece IDs (one body, one hand, two accessories), sorted. */
  readonly gear: readonly string[];
  readonly sources: readonly GearSource[];
  /** Logs that have it: in all, and by how many of the scenario's teammates they have (index = that number). */
  readonly logs?: { readonly total: number; readonly byTeammates: readonly number[] };
}

/** One operator's loadouts in a set of log fixtures. */
export interface LogLoadout {
  readonly gear: readonly string[];
  readonly total: number;
  /** Logs by how many of the given teammates they also have (index = that number). */
  readonly byTeammates: readonly number[];
}

const key = (gear: readonly string[]) => [...gear].sort().join("+");


/** An operator's loadouts (four pieces) in the logs, with how many of `teammates` each log also has. */
export function logLoadouts(files: readonly string[], operator: string, teammates: readonly string[]): LogLoadout[] {
  const by = new Map<string, { gear: string[]; byTeammates: number[] }>();
  for (const f of files) {
    const fx = readLogFixture(f);
    const me = fx.team.find((t) => t.operator === operator);
    if (!me || me.gear.length < 4) continue;
    const n = teammates.filter((t) => fx.team.some((m) => m.operator === t)).length;
    const gear = me.gear.map((g) => g.id).sort();
    const e = by.get(key(gear)) ?? { gear, byTeammates: teammates.map(() => 0).concat(0) };
    e.byTeammates[n] = (e.byTeammates[n] ?? 0) + 1;
    by.set(key(gear), e);
  }
  return [...by.values()].map((e) => ({ gear: e.gear, byTeammates: e.byTeammates, total: e.byTeammates.reduce((a, b) => a + b, 0) })).sort(byTeamCount);
}

/** Most logs with the most teammates first (whole team, then one fewer, …), then most logs. */
function byTeamCount(x: LogLoadout, y: LogLoadout): number {
  for (let i = x.byTeammates.length - 1; i >= 1; i--) if ((y.byTeammates[i] ?? 0) !== (x.byTeammates[i] ?? 0)) return (y.byTeammates[i] ?? 0) - (x.byTeammates[i] ?? 0);
  return y.total - x.total;
}

/** A candidates file: loadouts given by hand, each with what to cite. */
export interface GearCandidatesFile {
  readonly candidates: readonly { readonly operator: string; readonly gear: readonly string[]; readonly source: string }[];
}

/**
 * Each varied operator's candidates: its gear in the scenario, the logs' loadouts seen at least `minCount` times (at
 * most `top`, most teammates first), and the file's. A loadout from several places is one candidate with every source.
 */
export function gearCandidates(
  data: GameData,
  scenario: TimelineScenario,
  options: { readonly files: readonly string[]; readonly extra?: GearCandidatesFile; readonly minCount?: number; readonly top?: number },
): Map<string, GearCandidate[]> {
  const ops = scenario.team.map((b) => b.operator);
  const out = new Map<string, GearCandidate[]>();
  for (const b of scenario.team) {
    const list: { gear: string[]; sources: GearSource[]; logs?: GearCandidate["logs"] }[] = [];
    const add = (gear: readonly string[], source: GearSource, logs?: GearCandidate["logs"]) => {
      for (const id of gear) if (!data.gear[id]) throw new Error(`${id} isn't a gear piece`);
      if (gear.length !== 4) throw new Error(`${data.operators[b.operator]?.name ?? b.operator}: a loadout has four pieces, not ${gear.length} (${gear.join(", ")})`);
      const k = key(gear);
      const e = list.find((x) => key(x.gear) === k);
      if (e) {
        e.sources.push(source);
        if (logs) e.logs = logs;
      } else list.push({ gear: [...gear].sort(), sources: [source], ...(logs ? { logs } : {}) });
    };
    add(b.gear.map((g) => g.id), { kind: "scenario", label: "the scenario's" });
    const mates = ops.filter((o) => o !== b.operator);
    const seen = logLoadouts(options.files, b.operator, mates);
    for (const l of seen.filter((x) => x.total >= (options.minCount ?? 2)).slice(0, options.top ?? 6))
      add(l.gear, { kind: "log", label: `${l.total} log${l.total === 1 ? "" : "s"}` }, { total: l.total, byTeammates: l.byTeammates });
    // The scenario's own loadout keeps its log counts even when it's below the bar.
    for (const e of list) if (!e.logs) {
      const l = seen.find((x) => key(x.gear) === key(e.gear));
      if (l) e.logs = { total: l.total, byTeammates: l.byTeammates };
    }
    for (const c of options.extra?.candidates ?? []) if (c.operator === b.operator) add(c.gear, { kind: "file", label: c.source });
    out.set(b.operator, list.map((e) => ({ operator: b.operator, gear: e.gear, sources: e.sources, ...(e.logs ? { logs: e.logs } : {}) })));
  }
  return out;
}

/** A candidate's score: the team's total with it (the others at their current loadouts), and how it was found. */
export interface GearScore {
  readonly candidate: GearCandidate;
  readonly total: number;
  /**
   * `replay`: the current rotation played as it is; `repaired`: played with each step it can't play with this loadout
   * moved later (`moved`: up to 2 s, else before a later step, else after the last) or, where nothing works, dropped (`dropped`; together at most the ascent's
   * `repairs`), compared with the current loadout's replay; `search`: more steps than that fail, so a narrow search's
   * best, compared with the current loadout's own narrow search (`against`).
   */
  readonly how: "replay" | "repaired" | "search";
  /** For a repaired replay: the rotation's steps it started later, and those it dropped. */
  readonly moved?: number;
  readonly dropped?: number;
  /** For a searched score: the current loadout's narrow search, which it's compared with. */
  readonly against?: number;
  /** Against the current loadout on the same footing (replay to replay, search to search): 1 is as good. */
  readonly gain: number;
  /** For an operator whose mode two attributes decide (Arcane's INT / WILL): the pair with this loadout. */
  readonly mode?: { readonly a: number; readonly b: number };
}

export interface GearResult {
  readonly start: number;
  readonly final: number;
  readonly passes: number;
  /** Each varied operator's candidates in the last pass (each against the loadout then current: the chosen one when that pass changed nothing), best first. */
  readonly tables: ReadonlyMap<string, readonly GearScore[]>;
  readonly chosen: ReadonlyMap<string, readonly string[]>;
  readonly team: readonly Build[];
  /** The rotation at the end: the scenario's, a repaired one (steps a chosen loadout couldn't play moved or dropped), or a narrow search's. */
  readonly rotation: TimelineScenario["rotation"];
  readonly rotationReplaced: boolean;
  /** Steps of the scenario's rotation moved later or dropped by repaired replays the ascent took (0 when it took none). */
  readonly rotationRepaired: number;
  /** Kept operators (not varied) whose mode two attributes decide: each candidate's pair, to see none would change it. */
  readonly modes: ReadonlyMap<string, readonly { readonly candidate: GearCandidate; readonly a: number; readonly b: number }[]>;
  /** Narrow searches run (loadouts the rotation couldn't be played with, and the current loadouts they're compared with). */
  readonly searched: number;
  /** Team loadouts replayed. */
  readonly scored: number;
}

const FULL: readonly [number, number, number] = [3, 3, 3];

/** How much later a repaired replay tries a step it can't play (frames: 0.33 to 2 s at once, up to 15 s after the last step), first that works. */
const LATER = [10, 20, 30, 45, 60, 90, 120, 150, 210, 300, 450];

/** A repaired replay's changes: "2 steps later, 1 dropped". */
function repairText(x: { readonly moved?: number; readonly dropped?: number }): string {
  const m = x.moved ?? 0;
  const d = x.dropped ?? 0;
  return [m ? `${m} step${m === 1 ? "" : "s"} later` : "", d ? `${d} dropped` : ""].filter(Boolean).join(", ");
}

/**
 * Coordinate ascent over the candidates: per pass, each varied operator in team order takes its best candidate with
 * the others fixed, until a pass changes nothing or `passes` is reached. A candidate is scored by replaying the current
 * rotation; where a step can't be played with it (EngineError: a finisher whose Stagger came later, a combo whose window
 * didn't open, an ultimate whose energy comes later), by the replay with each such step moved to the first later start
 * that works (up to 2 s later, else before the first later step it can go before, else up to 15 s after the last) or
 * else dropped (at most `repairs` such steps, default 20; the rest as it was), against
 * the current loadout's replay: a lower bound for the candidate, which plays its rotation late; with more, by a narrow
 * search (`beam`, default 12) compared with the current loadout's narrow search, so replays meet replays and searches
 * searches. Taking a repaired or searched loadout takes its rotation too. A loadout's pieces get full artifice; the
 * scenario's own loadout keeps its artifice.
 */
export function gearAscent(
  data: GameData,
  scenario: TimelineScenario,
  candidates: ReadonlyMap<string, readonly GearCandidate[]>,
  options: { readonly beam?: number; readonly repairs?: number; readonly passes?: number; readonly keep?: ReadonlySet<string>; readonly progress?: (line: string) => void } = {},
): GearResult {
  const own = new Map(scenario.team.map((b) => [b.operator, key(b.gear.map((g) => g.id))]));
  const gearOf = (op: string, gear: readonly string[]): Build["gear"] => {
    const b = scenario.team.find((x) => x.operator === op) as Build;
    return key(gear) === own.get(op) ? b.gear : gear.map((id) => ({ id, artifice: FULL }));
  };
  const teamKey = (team: readonly Build[]) => team.map((b) => key(b.gear.map((g) => `${g.id}:${g.artifice.join("")}`))).join("|");
  let rotation = scenario.rotation;
  let version = 0;
  const replays = new Map<string, number | null>();
  const replay = (team: readonly Build[]): number | null => {
    const k = `${version}#${teamKey(team)}`;
    if (replays.has(k)) return replays.get(k) as number | null;
    let r: number | null;
    try {
      r = simulate(data, { ...scenario, team, rotation }).total;
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      r = null;
    }
    replays.set(k, r);
    return r;
  };
  // The rotation with each step this team can't play moved to a later start that works, or dropped (each tried from the
  // state the kept ones left), or null when more than `repairs` steps fail.
  type Repaired = { total: number; rotation: TimelineScenario["rotation"]; moved: number; dropped: number };
  const limit = options.repairs ?? 20;
  const repairs = new Map<string, Repaired | null>();
  const repair = (team: readonly Build[]): Repaired | null => {
    const k = `${version}#${teamKey(team)}`;
    if (repairs.has(k)) return repairs.get(k) ?? null;
    const sc = { ...scenario, team, rotation };
    const ctx = createContext(data, sc);
    let state = init(ctx);
    const kept: TimelineScenario["rotation"][number][] = [];
    let moved = 0;
    let dropped = 0;
    const tryApply = (a: TimelineScenario["rotation"][number]) => {
      try {
        state = apply(ctx, state, a);
        kept.push(a);
        return true;
      } catch (e) {
        if (!(e instanceof EngineError)) throw e;
        return false;
      }
    };
    // A step that can't start within 2 s waits (an ultimate's energy may come from the steps after it): it's tried again
    // before each later step, and after the last one up to 15 s on; dropped only if none of that works.
    const pending: TimelineScenario["rotation"][number][] = [];
    for (const action of rotation) {
      for (let i = 0; i < pending.length; ) {
        if (tryApply({ ...(pending[i] as TimelineScenario["rotation"][number]), at: state.frame })) {
          pending.splice(i, 1);
          moved++;
        } else i++;
      }
      if (tryApply(action)) continue;
      const from = Math.max(action.at ?? 0, state.frame);
      if (LATER.slice(0, 5).some((d) => tryApply({ ...action, at: from + d }))) moved++;
      else pending.push(action);
      if (moved + pending.length > limit) break;
    }
    const over = moved + pending.length > limit;
    if (!over) for (const a of pending) {
      if (LATER.some((d) => tryApply({ ...a, at: state.frame + d }))) moved++;
      else dropped++;
    }
    const r = !over ? { total: simulate(data, { ...sc, rotation: kept }).total, rotation: kept, moved, dropped } : null;
    repairs.set(k, r);
    return r;
  };
  let repaired = 0;
  const searches = new Map<string, { total: number; rotation: TimelineScenario["rotation"] }>();
  const search = (team: readonly Build[]) => {
    const k = teamKey(team);
    const hit = searches.get(k);
    if (hit) return hit;
    const { rotation: _r, ...rest } = scenario;
    const found = searchBeams(data, { ...rest, team }, { beams: [options.beam ?? 12] });
    const r = { total: found.result.total, rotation: found.rotation };
    searches.set(k, r);
    return r;
  };
  let team: Build[] = scenario.team.map((b) => ({ ...b }));
  const start = replay(team);
  if (start === null) throw new Error("the scenario's rotation can't be played with its own gear");
  const tables = new Map<string, GearScore[]>();
  let passes = 0;
  let replaced = false;
  for (let pass = 1; pass <= (options.passes ?? 4); pass++) {
    passes = pass;
    let changed = false;
    for (const [op, list] of candidates) {
      if (options.keep?.has(op)) continue;
      const i = team.findIndex((b) => b.operator === op);
      const current = key((team[i] as Build).gear.map((g) => g.id));
      const pair = (() => {
        try {
          return modePair(data, op);
        } catch {
          return undefined;
        }
      })();
      const now = replay(team) as number;
      const rows: GearScore[] = list.map((c) => {
        const build: Build = { ...(team[i] as Build), gear: gearOf(op, c.gear) };
        const t = team.map((b, j) => (j === i ? build : b));
        const stats = pair ? computeStats(data, build) : undefined;
        const mode = pair && stats ? { mode: { a: stats.attrs[pair.a]?.total ?? 0, b: stats.attrs[pair.b]?.total ?? 0 } } : {};
        const r = replay(t);
        if (r !== null) return { candidate: c, total: r, how: "replay" as const, gain: r / now, ...mode };
        const fixed = repair(t);
        if (fixed) return { candidate: c, total: fixed.total, how: "repaired" as const, moved: fixed.moved, dropped: fixed.dropped, gain: fixed.total / now, ...mode };
        const s = search(t).total;
        const against = search(team).total;
        return { candidate: c, total: s, how: "search" as const, against, gain: s / against, ...mode };
      });
      rows.sort((x, y) => y.gain - x.gain);
      tables.set(op, rows);
      const best = rows[0] as GearScore;
      if (key(best.candidate.gear) !== current && best.gain > 1) {
        team = team.map((b, j) => (j === i ? { ...b, gear: gearOf(op, best.candidate.gear) } : b));
        if (best.how === "repaired") {
          const fixed = repair(team);
          if (fixed) {
            rotation = fixed.rotation;
            repaired += fixed.moved + fixed.dropped;
            version++;
          }
        } else if (best.how === "search") {
          rotation = search(team).rotation;
          version++;
          replaced = true;
        }
        changed = true;
        options.progress?.(`pass ${pass}: ${data.operators[op]?.name ?? op} → ${describeGear(data, best.candidate.gear)} (${best.how === "search" ? `narrow search ${num(Math.round(best.total), 0)} against ${num(Math.round(best.against ?? 0), 0)}; its rotation from now on` : best.how === "repaired" ? `${num(Math.round(best.total), 0)}, the replay ${repairText(best)}; that rotation from now on` : num(Math.round(best.total), 0)})`);
      }
    }
    if (!changed) break;
  }
  const modes = new Map<string, { candidate: GearCandidate; a: number; b: number }[]>();
  for (const [op, list] of candidates) {
    if (!options.keep?.has(op)) continue;
    let pair: { a: number; b: number } | undefined;
    try {
      pair = modePair(data, op);
    } catch {
      continue;
    }
    const b = team.find((x) => x.operator === op) as Build;
    modes.set(op, list.map((c) => {
      const stats = computeStats(data, { ...b, gear: gearOf(op, c.gear) });
      return { candidate: c, a: stats.attrs[(pair as { a: number }).a]?.total ?? 0, b: stats.attrs[(pair as { b: number }).b]?.total ?? 0 };
    }));
  }
  return {
    start,
    modes,
    final: replay(team) as number,
    passes,
    tables,
    chosen: new Map([...candidates.keys()].filter((op) => !options.keep?.has(op)).map((op) => [op, (team.find((b) => b.operator === op) as Build).gear.map((g) => g.id)])),
    team,
    rotation,
    rotationReplaced: replaced,
    rotationRepaired: repaired,
    searched: searches.size,
    scored: replays.size,
  };
}

/** A loadout as text: pieces by set ("Deep Rampart: Armor, Gauntlets, Comms ×2"; pieces outside a set by name). */
export function describeGear(data: GameData, gear: readonly string[]): string {
  const bySet = new Map<string, string[]>();
  // Body, gloves, then accessories (data.gear part 0, 1, 2).
  for (const id of [...gear].sort((x, y) => (data.gear[x]?.part ?? 9) - (data.gear[y]?.part ?? 9))) {
    const g = data.gear[id];
    const set = g?.setId ? (data.gearSets[g.setId]?.name ?? g.setId) : "";
    const name = g?.name ?? id;
    const short = set && name.startsWith(set + " ") ? name.slice(set.length + 1) : name;
    bySet.set(set, [...(bySet.get(set) ?? []), short]);
  }
  const part = (names: string[]) => {
    const counts = new Map<string, number>();
    for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
    return [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(", ");
  };
  return [...bySet]
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([set, names]) => (set ? `${set}: ${part(names)}` : part(names)))
    .join(" + ");
}

/** The ascent as text: a table per varied operator (each candidate, its sources, logs with the team, the total). */
export function formatGear(data: GameData, scenario: TimelineScenario, r: GearResult): string {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const lines = [
    `Team total ${num(Math.round(r.start), 0)} with the scenario's gear → ${num(Math.round(r.final), 0)} (${r.final >= r.start ? "+" : ""}${((r.final / r.start - 1) * 100).toFixed(1)}%) after ${r.passes} pass${r.passes === 1 ? "" : "es"}${r.rotationReplaced ? " (on a narrow search's rotation: a chosen loadout couldn't play the scenario's)" : r.rotationRepaired ? ` (on the scenario's rotation with ${r.rotationRepaired} step${r.rotationRepaired === 1 ? "" : "s"} a chosen loadout couldn't play moved later or dropped)` : ""}; ${r.scored} replays, ${r.searched} narrow searches (loadouts the rotation couldn't be played with, and the loadouts they're compared with).`,
    "Each candidate is scored with the others at their final loadouts (the last pass) on the rotation, against the chosen loadout on the same footing (\"n steps later, m dropped\": the replay with the steps it couldn't play started later or dropped, against the chosen loadout's replay; \"searched\": a narrow search, against the chosen loadout's own): a lower bound for gear the rotation wasn't searched with.",
  ];
  for (const [op, rows] of r.tables) {
    const chosen = key(r.chosen.get(op) ?? []);
    const mates = scenario.team.length - 1;
    lines.push("", `${name(op)}:`);
    lines.push(
      table(
        ["", "loadout", "sources", `logs (with ${Array.from({ length: mates + 1 }, (_, i) => i).join("/")} teammates)`, ...(rows.some((x) => x.mode) ? ["mode attributes"] : []), "team total", "vs chosen"],
        rows.map((x) => {
          return [
            key(x.candidate.gear) === chosen ? "*" : "",
            describeGear(data, x.candidate.gear),
            x.candidate.sources.map((s) => (s.kind === "log" ? "logs" : s.kind === "scenario" ? "scenario" : s.label)).join("; "),
            x.candidate.logs ? `${x.candidate.logs.total} (${x.candidate.logs.byTeammates.join("/")})` : "",
            ...(rows.some((y) => y.mode) ? [x.mode ? `${x.mode.a.toFixed(2)} / ${x.mode.b.toFixed(2)}` : ""] : []),
            `${num(Math.round(x.total), 0)}${x.how === "search" ? ` (searched; chosen ${num(Math.round(x.against ?? 0), 0)})` : x.how === "repaired" ? ` (${repairText(x)})` : ""}`,
            `${((x.gain - 1) * 100).toFixed(1)}%`,
          ];
        }),
      ),
    );
  }
  for (const [op, rows] of r.modes) {
    let pair: { a: number; b: number } | undefined;
    try {
      pair = modePair(data, op);
    } catch {
      continue;
    }
    const attr = (n: number) => (n === 41 ? "Intellect" : n === 42 ? "Will" : `attribute ${n}`);
    lines.push("", `${name(op)} (kept as in the scenario; ${attr(pair.a)} / ${attr(pair.b)} with each candidate, full artifice):`);
    lines.push(table(["loadout", "sources", attr(pair.a), attr(pair.b), "mode"], rows.map((x) => [
      describeGear(data, x.candidate.gear),
      x.candidate.sources.map((s) => (s.kind === "log" ? `logs (${s.label})` : s.kind === "scenario" ? "scenario" : s.label)).join("; "),
      x.a.toFixed(2), x.b.toFixed(2), x.a >= x.b ? attr(pair.a) : attr(pair.b),
    ])));
  }
  return lines.join("\n");
}
