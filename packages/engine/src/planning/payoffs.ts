// Payoffs and chains (docs/design.md "Payoffs and chains"): what each action of a team produces, what each damaging
// action deals at most under the setups the team can make, and the chains of actions in which each step opens or sets
// up the next. Everything is measured by the engine (probes on the stepping API: apply, advance, earliestStart), never
// re-derived from the kits by hand: a kit change moves the table with it. A planning aid and the input of a planner
// that builds rotations backward from the payoffs (phase 3); never part of a fight's result.

import { activeAt, EngineError, ARTS_ELEMENTS, INFLICTION_FRAMES, MAX_INFLICTION_STACKS, advance, apply, createContext, earliestStart, exclusiveUntil, init, memoised, simulate, skillCosts, COMBO_WINDOW_FRAMES, LINK_FRAMES, skillAvailable, windowKey, addBuff, situationAt, predicateRefs, FPS, type ActiveBuff, type SkillType, type GameData, type Modifier, type ActiveStatus, type StatusEvent, type ArtsElement, type RotationAction, type TimelineContext, type TimelineScenario, type TimelineState } from "../core.ts";

/**
 * One planning action: a kit skill an operator casts from a rotation (battle skill, combo, ultimate), or the
 * controlled operator's basic-attack chain from its head to its Final Strike (`chain`: several rotation actions,
 * taken as one step because what it opens, SP and windows on a Final Strike, comes at its end).
 */
export interface PlanStep {
  /** `operator:skillId`, or `operator:chain`. */
  readonly id: string;
  readonly operator: string;
  readonly kind: SkillType | "chain";
  /** The kit skill (absent for a chain, whose steps follow the chain as it goes). */
  readonly skill?: string;
}

/** An enemy state a probe starts from: an infliction (element, stacks), Staggered, Link stacks. */
export interface ProbeSituation {
  readonly label: string;
  readonly infliction?: { readonly element: ArtsElement; readonly stacks: number };
  readonly staggered?: boolean;
  readonly link?: number;
  /** The step's operator's kit stacks at their maximum (ceilings only). */
  readonly stacks?: boolean;
}

/** A buff an action created (new instances against the same fight without it), per owner and buff. */
export interface BuffEffect {
  readonly owner: string;
  readonly id: string;
  readonly target: ActiveBuff["target"];
  /** Frames from the action's start to the first new instance. */
  readonly offset: number;
  /** Frames the longest instance lasted (Infinity: until something ends it). */
  readonly duration: number;
  /** Most new instances active at once. */
  readonly layers: number;
  readonly stackGroup?: string;
  /** Whether it changes damage (modifiers) or Link. */
  readonly damage: boolean;
  /** Its modifiers, as text (zone, value, filters). */
  readonly modifiers: string;
}

/** An event on the enemy an action caused (StatusEvent, without its frame), with its offset from the action's start. */
export interface EnemyEffect {
  readonly event: string;
  readonly offset: number;
}

/** A combo window an action opened: whose (windowKey) and when, from the action's start. */
export interface WindowEffect {
  readonly key: string;
  readonly offset: number;
}

/** What one action did from one situation (a probe): every number is the fight with it against the fight without it. */
export interface ActionEffect {
  readonly step: string;
  readonly situation: string;
  /** Steps cast first so that it can be cast at all (its `available` condition, a combo's window), in order. */
  readonly prefix: readonly string[];
  /** Frames it waited for its start (a combo for its window, a skill for its availability). */
  readonly wait: number;
  /** Damage committed within the probe's horizon, more than without it (all hits, everyone's). */
  readonly damage: number;
  /** Of that, its operator's own hits (kit and trigger hits, not reactions). */
  readonly own: number;
  /** Of that, reaction and status damage (Combustion and Corrosion hits and ticks, Shatter, bursts). */
  readonly reactions: number;
  /** Its own hits' first and last landing, frames from its start. */
  readonly hits: { readonly first: number; readonly last: number } | null;
  readonly buffs: readonly BuffEffect[];
  readonly enemy: readonly EnemyEffect[];
  readonly windows: readonly WindowEffect[];
  /** Team SP and each operator's ultimate energy at the horizon, more than without it (its own cost included). */
  readonly sp: number;
  readonly energy: Readonly<Record<string, number>>;
  readonly cost: Cost;
  /** Frames its operator is busy (its exclusive frames). */
  readonly busy: number;
  /** Damage-changing buffs and enemy states it left (the pieces it achieves), as found in the fight with it. */
  readonly pieces: readonly Piece[];
  /** The highest rate of a recording buff in the fight with it (Si's Artful Intent: a share of the damage in its window, dealt at its end). */
  readonly recordRate?: number;
}

/** What an action costs: SP, its operator's ultimate energy, the longest cooldown it starts (frames). */
export interface Cost {
  readonly sp: number;
  readonly energy: number;
  readonly cooldown: number;
}

/**
 * A piece of a setup: something the team can have on when a payoff lands. `buff` (a kit or worn buff instance as the
 * engine created it), `status` (a reaction status on the enemy: Corrosion, Electrification, Solidification,
 * Combustion), `vulnerable` (stacks), `physical` (Breach…), `link` (stacks); inflictions and Stagger are the
 * situations a ceiling is tried in, one at a time.
 */
export type Piece =
  | { readonly kind: "buff"; readonly key: string; readonly buff: ActiveBuff; readonly layers: number }
  | { readonly kind: "status"; readonly key: string; readonly status: ActiveStatus }
  | { readonly kind: "vulnerable"; readonly key: string; readonly stacks: number }
  | { readonly kind: "physical"; readonly key: string; readonly physical: TimelineState["enemy"]["physical"][number] }
  | { readonly kind: "link"; readonly key: string; readonly stacks: number };

/** Who makes a piece: the step, the situation it did it from, when it's on (offset, duration from the step's start), at what cost. */
export interface Achiever {
  readonly step: string;
  readonly situation: string;
  readonly offset: number;
  readonly duration: number;
  readonly cost: Cost;
}

/** A piece in a ceiling's bundle: what it adds there, who makes it and how long before the payoff each may be cast. */
export interface BundlePiece {
  readonly key: string;
  /** Damage the ceiling loses without it. */
  readonly worth: number;
  readonly achievers: readonly (Achiever & {
    /**
     * Frames before the payoff's start the achiever may start for the piece to be on for every hit of the payoff
     * ([min, max]; max Infinity: it lasts until ended; null when no start covers them all: it's shorter than they are).
     */
    readonly lead: { readonly min: number; readonly max: number } | null;
  })[];
}

/** A damaging action's ceiling: bare and under the best bundle of pieces the team achieves, in the best situation. */
export interface Ceiling {
  readonly step: string;
  readonly prefix: readonly string[];
  /** What it deals (StepDamage `dealt`: its own kit hits and the reaction hits it adds) from the fight's start state, no situation; and every hit's difference (`bareAll`). */
  readonly bare: number;
  readonly bareAll: number;
  /** What it deals under the best bundle (what the bundle maximises), of which its own kit hits (`bestCast`), and every hit's difference there (`bestAll`). */
  readonly best: number;
  readonly bestCast: number;
  readonly bestAll: number;
  /** Frames its operator is busy with it (the least of the bare and the best cast's). */
  readonly busy: number;
  /** The situation (infliction, Stagger) the best is in. */
  readonly situation: string;
  /** The pieces it lost something without, largest first. */
  readonly bundle: readonly BundlePiece[];
  /** Pieces that lowered it (left out of the best: a conflict the engine knows, e.g. a status its hit consumes). */
  readonly against: readonly string[];
  readonly cost: Cost;
}

/** A payoff that is a window, not a cast: a reaction status's damage, or a recording buff's burst. */
export interface WindowPayoff {
  readonly key: string;
  readonly what: string;
  /** The most it dealt in a probe (reaction hits; for a recording buff, what it recorded × its rate in the chains). */
  readonly damage: number;
  readonly achievers: readonly Achiever[];
}

/** A step of a chain: when it starts and how it's tied to what came before. */
export interface PlanChainStep {
  readonly step: string;
  /** Frames from the chain's first start. */
  readonly at: number;
  /** `opens`: a combo cast in a window an earlier step opened; `sets up`: the steps before make it open a window or cause a reaction it doesn't on its own; `first`. */
  readonly link: "first" | "opens" | "sets up";
  /** Which earlier step it's tied to (its index), and through what (a window key, or the events it caused only after them). */
  readonly by?: { readonly index: number; readonly through: string };
  /** How much later it may start (frames) with every later step still legal and the chain's damage within 1%; null: not measured. */
  readonly slack: number | null;
}

/** A chain: steps each opened or set up by the ones before. */
export interface Chain {
  readonly steps: readonly PlanChainStep[];
  /** Damage committed (within 20 s of its last start) more than without it. */
  readonly damage: number;
  /** Frames from its first start to the last moment one of its operators is busy with it. */
  readonly span: number;
  readonly cost: { readonly sp: number; readonly energy: Readonly<Record<string, number>>; readonly cooldown: number };
  /** Damage per second of its span. */
  readonly perSecond: number;
  /** Damage per SP it costs (null when it costs none). */
  readonly perSp: number | null;
  /** Setups cast before it (greedy, best synergy first) and fillers fitted into its idle time (no step moved); null: not tried. */
  readonly merged: Merge | null;
}

/** A chain merged with setups and fillers (each with what it adds on top of the chain and of itself alone). */
export interface Merge {
  readonly setups: readonly { readonly step: string; readonly synergy: number }[];
  readonly fillers: readonly { readonly step: string; readonly after: number; readonly gain: number }[];
  /** Damage of the chain with its setups and fillers. */
  readonly damage: number;
}

/** Everything `payoffs` measured. */
export interface PayoffReport {
  readonly steps: readonly PlanStep[];
  readonly situations: readonly ProbeSituation[];
  readonly effects: readonly ActionEffect[];
  /** Steps that couldn't be cast from any situation (with why). */
  readonly unreachable: readonly { readonly step: string; readonly why: string }[];
  readonly ceilings: readonly Ceiling[];
  readonly windows: readonly WindowPayoff[];
  readonly chains: readonly Chain[];
  /** Whether the chain search stopped at its probe budget (chains beyond it weren't looked for). */
  readonly capped: boolean;
  readonly probes: number;
}

export interface PayoffOptions {
  /** Frames a probe watches after its start (default 20 s: a Corrosion, a recording window). */
  readonly horizon?: number;
  /** Longest chain (default 6). */
  readonly depth?: number;
  /** Probes the chain search may make (default 6,000); beyond it, `capped`. */
  readonly budget?: number;
  /** Chains (best per second first) whose slack and merges are measured (default 10; the rest are listed without). */
  readonly measure?: number;
  /** Whether to look for chains (default true; the search's bound needs only the ceilings). */
  readonly chains?: boolean;
  /** Whether to measure ceilings (default true; a chain search alone needs none). */
  readonly ceilings?: boolean;
}

/** How long a step may wait for its start in a probe (a combo for its window, a skill for its availability): 12 s. */
const MAX_WAIT = 12 * FPS;
/** The sampling step of a probe's buffs and windows: a quarter second. */
const SAMPLE = 8;

/** The fight a plan is measured in: the scenario's team and enemy, every ultimate charged, no enemy actions, nothing recorded. */
export function planContext(data: GameData, scenario: Omit<TimelineScenario, "rotation">): TimelineContext {
  const full = Object.fromEntries(scenario.team.map((b) => [b.operator, "full" as const]));
  const { enemyActions: _a, enemyHp: _h, ...rest } = scenario;
  const { dodge: _d, ...options } = rest.options;
  return memoised(createContext(data, { ...rest, options, rotation: [], startEnergy: full }));
}

/** The team's planning actions, in team order: each operator's battle skills, combos and ultimates (not follow-ups), and the controlled operator's chain. */
export function planSteps(ctx: TimelineContext): PlanStep[] {
  const out: PlanStep[] = [];
  const controlled = ctx.scenario.controlled ?? ctx.scenario.team[0]?.operator;
  for (const b of ctx.scenario.team) {
    const op = b.operator;
    for (const s of ctx.kits.get(op)?.skills ?? []) {
      if (s.followUpOnly || s.kind === "basic") continue;
      out.push({ id: `${op}:${s.skillId}`, operator: op, kind: s.kind, skill: s.skillId });
    }
    if (op === controlled) out.push({ id: `${op}:chain`, operator: op, kind: "chain" });
  }
  return out;
}

/** The basic attack a chain starts with at a state: the first chain head (a basic attack that isn't a chain step) available then (Laevatain's enhanced attacks in Twilight). */
function chainHead(ctx: TimelineContext, op: string, state: TimelineState): string {
  const heads = (ctx.kits.get(op)?.skills ?? []).filter((s) => s.kind === "basic" && !s.chainStep && ctx.data.skills[s.skillId]?.timing?.specification === 1);
  const head = heads.find((h) => skillAvailable(ctx, state, op, h.skillId, state.frame)) ?? heads[0];
  if (!head) throw new EngineError(`${op} has no basic-attack chain head`);
  return head.skillId;
}

/**
 * The buffs a team's skills are gated by (`owner:buffId` in an `available` condition: Laevatain's Twilight, Si's
 * Artful Intent): states that change what can be cast, so pieces of a setup whatever their modifiers.
 */
export function stateBuffs(ctx: TimelineContext): Set<string> {
  const out = new Set<string>();
  for (const b of ctx.scenario.team) for (const s of ctx.kits.get(b.operator)?.skills ?? []) if (s.available) for (const id of predicateRefs(s.available).buffs) out.add(`${b.operator}:${id}`);
  return out;
}

function hasFinalStrike(ctx: TimelineContext, op: string, skill: string): boolean {
  return (ctx.kits.get(op)?.skills.find((s) => s.skillId === skill)?.hits ?? []).some((h) => h.finalStrike);
}

/** apply, or why not (a start judged legal by earliestStart that apply's own judgement refuses: a forced window, say). */
function tryApply(ctx: TimelineContext, s: TimelineState, act: RotationAction): TimelineState | string {
  try {
    return apply(ctx, s, act);
  } catch (e) {
    if (e instanceof EngineError) return e.message;
    throw e;
  }
}

/**
 * Run one step from a state: each of its rotation actions at its earliest legal frame, waiting up to `maxWait` for
 * the first (a window, availability). The actions it took, the state after and its start frame, or why it couldn't.
 */
export function runStep(ctx: TimelineContext, state: TimelineState, step: PlanStep, maxWait = MAX_WAIT, at?: number): { state: TimelineState; start: number; actions: RotationAction[] } | { error: string } {
  const startOf = (s: TimelineState, a: RotationAction, wait: number): number | string => {
    const from = Math.max(s.frame, a.at ?? 0);
    let e = earliestStart(ctx, s, a);
    // Not available yet (a buff its condition reads is on its way): judged again at later frames, as a player waits.
    for (let f = from + 15; "error" in e && f <= from + wait && f <= ctx.scenario.durationFrames; f += 15) e = earliestStart(ctx, s, { ...a, at: f });
    if ("error" in e) return e.error;
    return e.frame - from > wait ? `starts only ${((e.frame - from) / FPS).toFixed(1)} s later` : e.frame;
  };
  const actions: RotationAction[] = [];
  let s = state;
  let start = -1;
  if (step.kind !== "chain") {
    const a = { operator: step.operator, skill: step.skill as string, ...(at !== undefined ? { at } : {}) };
    const f = startOf(s, a, maxWait);
    if (typeof f === "string") return { error: f };
    const act = { operator: a.operator, skill: a.skill, at: f };
    const next = tryApply(ctx, s, act);
    return typeof next === "string" ? { error: next } : { state: next, start: f, actions: [act] };
  }
  // The chain: from the attack input (its head, or what a buff maps the input to: Laevatain's enhanced attacks in
  // Twilight), step by step to the Final Strike or the chain's end.
  const input = (x: TimelineState) => x.buffs.find((b) => b.basicAttack !== undefined && b.owner === step.operator && b.cast === undefined && activeAt(b, x.frame))?.basicAttack ?? chainHead(ctx, step.operator, x);
  for (let i = 0; i < 10; i++) {
    const c = s.chainNext[step.operator];
    const live = c && c.until >= s.frame ? c.skill : undefined;
    const skill = i === 0 ? input(s) : (live ?? input(s));
    const a = { operator: step.operator, skill, ...(i === 0 && at !== undefined ? { at } : {}) };
    const f = startOf(s, a, i === 0 ? maxWait : 2 * FPS);
    if (typeof f === "string") return { error: f };
    if (i === 0) start = f;
    const act = { operator: a.operator, skill, at: f };
    actions.push(act);
    const next = tryApply(ctx, s, act);
    if (typeof next === "string") return { error: next };
    s = next;
    if (hasFinalStrike(ctx, step.operator, skill) || (i > 0 && !s.chainNext[step.operator])) return { state: s, start, actions };
  }
  return { error: "the chain has no Final Strike within 10 steps" };
}

/** A state put in a situation (plain data: the enemy's infliction, its Stagger, the team's Link stacks), from its frame on. */
export function inSituation(state: TimelineState, sit: ProbeSituation, until: number): TimelineState {
  let s = state;
  if (sit.infliction) s = { ...s, enemy: { ...s.enemy, infliction: { element: sit.infliction.element, stacks: sit.infliction.stacks, expiresAt: s.frame + INFLICTION_FRAMES } } };
  if (sit.staggered) s = { ...s, stagger: { poise: 0, until, finisherUsed: false } };
  if (sit.link) s = { ...s, link: [...s.link, ...Array.from({ length: sit.link }, () => until)] };
  return s;
}

/** A state with an operator's kit stacks at their maximum (plain data: a trigger on reaching it, stackAtLeast, doesn't fire). */
export function fullStacks(ctx: TimelineContext, state: TimelineState, operator: string): TimelineState {
  const defs = ctx.kits.get(operator)?.stacks ?? [];
  return defs.length ? { ...state, stacks: { ...state.stacks, [operator]: { ...(state.stacks[operator] ?? {}), ...Object.fromEntries(defs.map((d) => [d.id, d.max])) } } } : state;
}

/** Text that two plain values share exactly when they're equal (keys sorted). */
function text(v: unknown): string {
  if (v === null || typeof v !== "object") return typeof v === "number" && !Number.isFinite(v) ? String(v) : JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(text).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${k}:${text(o[k])}`).join(",")}}`;
}

/** A status event as text, without its frame and operator (what happened, not when or by whom). */
function eventText(e: StatusEvent): string {
  const { frame: _f, operator: _o, ...rest } = e;
  if (rest.kind === "reaction") return `reaction ${rest.status} ${rest.level} (${rest.consumed ?? "forced"})`;
  if (rest.kind === "inflicted") return `inflicted ${rest.element} ×${rest.stacks}`;
  if (rest.kind === "consumed") return `consumed ${rest.element} ×${rest.stacks}`;
  if (rest.kind === "burst") return `burst ${rest.element}`;
  if (rest.kind === "physical") return `${rest.status} ${rest.level}${rest.forced ? " (forced)" : ""}`;
  if (rest.kind === "vulnerable") return `vulnerable ${rest.before}→${rest.stacks}`;
  if (rest.kind === "control") return `control ${rest.status}`;
  if (rest.kind === "shatter") return `shatter ${rest.level}`;
  if (rest.kind === "statusConsumed") return `consumed ${rest.status} ${rest.level}`;
  return text(rest);
}

/** Elements of the multiset `a` not in `b` (by key), in `a`'s order. */
function minus<T>(a: readonly T[], b: readonly T[], key: (x: T) => string): T[] {
  const left = new Map<string, number>();
  for (const x of b) left.set(key(x), (left.get(key(x)) ?? 0) + 1);
  const out: T[] = [];
  for (const x of a) {
    const k = key(x);
    const n = left.get(k) ?? 0;
    if (n > 0) left.set(k, n - 1);
    else out.push(x);
  }
  return out;
}

const hitKey = (h: TimelineState["hits"][number]) => `${h.frame}|${h.operator}|${h.skillId}|${h.hitId}|${h.exact}`;
const sumExact = (hs: readonly TimelineState["hits"][number][]) => hs.reduce((a, h) => a + h.exact, 0);

/** A modifier as short text: zone, value and its filters. */
function modifierText(m: Modifier): string {
  const f = [m.element, m.skillType, m.staggeredOnly ? "staggered" : undefined, m.onlyKinds?.join("/"), m.decorations?.join("/"), m.when ? "if" : undefined].filter((x) => x !== undefined);
  return `${m.zone} ${Math.abs(m.value) < 10 ? m.value.toFixed(3) : m.value.toFixed(1)}${f.length ? ` (${f.join(", ")})` : ""}`;
}

/** The cost of a step's actions. */
function costOf(ctx: TimelineContext, actions: readonly RotationAction[]): Cost {
  let sp = 0;
  let energy = 0;
  let cooldown = 0;
  for (const a of actions) {
    const c = skillCosts(ctx, a.operator, a.skill, a.at ?? 0);
    if (c.kind === "basic") continue;
    sp += c.spCost;
    energy += c.energyCost;
    cooldown = Math.max(cooldown, c.cooldownFrames);
  }
  return { sp, energy, cooldown };
}

/**
 * What one fight held over a stretch of frames, sampled: each buff's instances (by owner and buff), the most active
 * at once, enemy statuses and physical statuses (by kind), the most Vulnerable stacks and Link stacks, and each combo
 * window's openings. Compared by counts, not frames: an ultimate's time stop moves everything else in its fight
 * later, so the same buff applied by something else is at another frame in the fight with it than without it.
 */
interface Held {
  readonly buffs: Map<string, Map<string, ActiveBuff>>;
  readonly layers: Map<string, number>;
  readonly statuses: Map<string, Map<number, ActiveStatus>>;
  readonly physical: Map<string, Map<number, TimelineState["enemy"]["physical"][number]>>;
  vulnerable: number;
  link: number;
  /** The highest rate of a recording buff seen (ActiveBuff.records). */
  recordRate: number;
  readonly windows: Map<string, Set<number>>;
}

function held(): Held {
  return { buffs: new Map(), layers: new Map(), statuses: new Map(), physical: new Map(), vulnerable: 0, link: 0, recordRate: 0, windows: new Map() };
}

/** Adds one sample of a fight at frame `f` to what it held (only what began at `start` or later). */
function sample(h: Held, st: TimelineState, f: number, start: number): void {
  const count = new Map<string, number>();
  for (const b of st.buffs) {
    if (b.appliedAt < start || b.cast !== undefined) continue;
    if (b.records) h.recordRate = Math.max(h.recordRate, b.records.rate);
    const g = `${b.owner}:${b.id}`;
    const m = h.buffs.get(g) ?? new Map<string, ActiveBuff>();
    const k = `${b.target}|${b.appliedAt}`;
    const was = m.get(k);
    if (!was || b.expiresAt > was.expiresAt) m.set(k, b);
    h.buffs.set(g, m);
    if (b.appliedAt <= f && b.expiresAt > f) count.set(g, (count.get(g) ?? 0) + 1);
  }
  for (const [g, n] of count) h.layers.set(g, Math.max(h.layers.get(g) ?? 0, n));
  for (const x of st.enemy.statuses) {
    if (x.appliedAt < start) continue;
    const m = h.statuses.get(x.status) ?? new Map<number, ActiveStatus>();
    m.set(x.appliedAt, x);
    h.statuses.set(x.status, m);
  }
  for (const x of st.enemy.physical) {
    if (x.appliedAt < start) continue;
    const m = h.physical.get(x.status) ?? new Map<number, TimelineState["enemy"]["physical"][number]>();
    m.set(x.appliedAt, x);
    h.physical.set(x.status, m);
  }
  const v = st.enemy.vulnerable;
  if (v && v.expiresAt > f) h.vulnerable = Math.max(h.vulnerable, v.stacks);
  h.link = Math.max(h.link, st.link.filter((x) => x > f).length + st.buffs.filter((b) => b.link && b.appliedAt <= f && b.expiresAt > f).length);
  for (const [k, w] of Object.entries(st.comboWindow)) {
    if (w.from < start || w.from > f) continue;
    const set = h.windows.get(k) ?? new Set<number>();
    set.add(w.from);
    h.windows.set(k, set);
  }
}

/** Both fights sampled from `start` to `end` (each advanced from its last sample), and both at `end`. */
function sampleBoth(ctx: TimelineContext, withS: TimelineState, without: TimelineState, start: number, end: number): { w: Held; wo: Held; withEnd: TimelineState; withoutEnd: TimelineState } {
  const w = held();
  const wo = held();
  let a = withS;
  let b = without;
  for (let f = start; ; f = Math.min(end, f + SAMPLE)) {
    a = advance(ctx, a, Math.max(f, a.frame));
    b = advance(ctx, b, Math.max(f, b.frame));
    sample(w, a, f, start);
    sample(wo, b, f, start);
    if (f >= end) break;
  }
  return { w, wo, withEnd: a, withoutEnd: b };
}

/** Window keys the fight with the step opened more often than the one without, with the first opening it added (frame). */
function newWindows(w: Held, wo: Held): Map<string, number> {
  const out = new Map<string, number>();
  for (const [k, set] of w.windows) {
    const n = wo.windows.get(k)?.size ?? 0;
    if (set.size > n) out.set(k, [...set].sort((x, y) => x - y)[n] as number);
  }
  return out;
}

/** Enemy events of the fight with the step beyond the fight without it, by what happened (not when): each with its frame. */
function newEvents(withEnd: TimelineState, withoutEnd: TimelineState, start: number): { text: string; frame: number; operator: string }[] {
  const a = withEnd.reactions.filter((e) => e.frame >= start).map((e) => ({ text: eventText(e), frame: e.frame, operator: e.operator }));
  const b = withoutEnd.reactions.filter((e) => e.frame >= start).map((e) => ({ text: eventText(e), frame: e.frame, operator: e.operator }));
  return minus(a, b, (x) => `${x.operator}|${x.text}`);
}

/** The pieces the fight with the step achieved beyond the one without: more instances of a buff, status or physical status, more Vulnerable or Link (the strongest instance). */
function newPieces(w: Held, wo: Held, gates: ReadonlySet<string>): Piece[] {
  const out: Piece[] = [];
  for (const [g, m] of w.buffs) {
    if (m.size <= (wo.buffs.get(g)?.size ?? 0)) continue;
    const bs = [...m.values()].filter((b) => !b.records && (b.modifiers.length > 0 || b.link || b.basicAttack !== undefined || gates.has(g)));
    if (!bs.length) continue;
    const strongest = bs.reduce((x, y) => (y.modifiers.reduce((a, q) => a + Math.abs(q.value), 0) > x.modifiers.reduce((a, q) => a + Math.abs(q.value), 0) ? y : x));
    out.push({ kind: "buff", key: `buff ${g}`, buff: strongest, layers: Math.max(1, w.layers.get(g) ?? 1) });
  }
  for (const [k, m] of w.statuses) {
    if (m.size <= (wo.statuses.get(k)?.size ?? 0)) continue;
    const st = [...m.values()].reduce((x, y) => (y.level > x.level ? y : x));
    out.push({ kind: "status", key: `status ${st.status} ${st.level}`, status: st });
  }
  for (const [k, m] of w.physical) {
    if (k === "lift" || k === "knockdown" || m.size <= (wo.physical.get(k)?.size ?? 0)) continue;
    const p = [...m.values()].reduce((x, y) => (y.level > x.level ? y : x));
    out.push({ kind: "physical", key: `physical ${p.status} ${p.level}`, physical: p });
  }
  if (w.vulnerable > wo.vulnerable) out.push({ kind: "vulnerable", key: `vulnerable ${w.vulnerable}`, stacks: w.vulnerable });
  if (w.link > wo.link) out.push({ kind: "link", key: `link ${w.link - wo.link}`, stacks: w.link - wo.link });
  return out;
}

/**
 * Probe a step from a state (after `prefix` steps from it): the fight with the step against the fight without it,
 * watched for `horizon` frames from its start. Why, when it can't be cast.
 */
export function probeStep(ctx: TimelineContext, from: TimelineState, step: PlanStep, horizon: number, label: string, prefix: readonly PlanStep[] = []): ActionEffect | { error: string } {
  let s = from;
  for (const p of prefix) {
    const r = runStep(ctx, s, p);
    if ("error" in r) return { error: `${p.id} (before it): ${r.error}` };
    s = r.state;
  }
  const r = runStep(ctx, s, step);
  if ("error" in r) return r;
  return observe(ctx, s, r, step, horizon, label, prefix.map((p) => p.id));
}

/**
 * What a step did: the fight after it (`r`) against the fight from `s` without it, for `horizon` frames from its
 * start (sampleBoth: compared by counts, as time stops move frames). Damage is the difference of the hits from its
 * start to the horizon; its own hits' offsets are those of the skills it cast.
 */
export function observe(ctx: TimelineContext, s: TimelineState, r: { state: TimelineState; start: number; actions: readonly RotationAction[] }, step: PlanStep, horizon: number, label: string, prefix: readonly string[] = []): ActionEffect {
  const start = r.start;
  const end = Math.min(ctx.scenario.durationFrames, start + horizon);
  const { w, wo, withEnd, withoutEnd } = sampleBoth(ctx, r.state, s, start, end);
  const withHits = withEnd.hits.filter((h) => h.frame >= start);
  const withoutHits = withoutEnd.hits.filter((h) => h.frame >= start);
  const isReaction = (h: TimelineState["hits"][number]) => h.skillId.startsWith("reaction:");
  const mine = (h: TimelineState["hits"][number]) => h.operator === step.operator && !isReaction(h);
  const net = (keep: (h: TimelineState["hits"][number]) => boolean) => sumExact(withHits.filter(keep)) - sumExact(withoutHits.filter(keep));
  const skills = new Set(r.actions.map((a) => a.skill));
  const cast = minus(withHits, withoutHits, hitKey).filter((h) => h.operator === step.operator && skills.has(h.skillId));
  const energy: Record<string, number> = {};
  for (const b of ctx.scenario.team) energy[b.operator] = (withEnd.energy[b.operator] ?? 0) - (withoutEnd.energy[b.operator] ?? 0);
  const buffs: BuffEffect[] = [];
  for (const [g, m] of w.buffs) {
    const before = wo.buffs.get(g)?.size ?? 0;
    if (m.size <= before) continue;
    const list = [...m.values()].sort((x, y) => x.appliedAt - y.appliedAt);
    const first = list[0] as ActiveBuff;
    buffs.push({
      owner: first.owner, id: first.id, target: first.target, offset: first.appliedAt - start,
      duration: Math.max(...list.map((b) => b.expiresAt - b.appliedAt)), layers: Math.max(1, (w.layers.get(g) ?? 1) - (before > 0 ? (wo.layers.get(g) ?? 0) : 0)),
      ...(first.stackGroup ? { stackGroup: first.stackGroup } : {}), damage: first.modifiers.length > 0 || first.link === true, modifiers: first.modifiers.map(modifierText).join("; "),
    });
  }
  return {
    step: step.id,
    situation: label,
    prefix,
    wait: start - s.frame,
    damage: net(() => true),
    own: net(mine),
    reactions: net(isReaction),
    hits: cast.length ? { first: Math.min(...cast.map((h) => h.frame)) - start, last: Math.max(...cast.map((h) => h.frame)) - start } : null,
    buffs,
    enemy: newEvents(withEnd, withoutEnd, start).map((e) => ({ event: e.text, offset: e.frame - start })),
    windows: [...newWindows(w, wo)].map(([key, f]) => ({ key, offset: f - start })),
    sp: withEnd.sp - withoutEnd.sp,
    energy,
    cost: costOf(ctx, r.actions),
    busy: exclusiveUntil(ctx, r.state, step.operator) - start,
    pieces: newPieces(w, wo, stateBuffs(ctx)),
    ...(w.recordRate > 0 ? { recordRate: w.recordRate } : {}),
  };
}

/**
 * What a step opens or causes from a state (window keys, and tie events its own operator caused): the cheap half of a
 * probe, for the chain search. Events of others are left out: a time stop reorders what's already on its way (a
 * reaction of another level), which isn't the step setting anything up.
 */
function tiesOf(ctx: TimelineContext, s: TimelineState, r: { state: TimelineState; start: number }, horizon: number, operator: string): { windows: string[]; events: string[] } {
  const end = Math.min(ctx.scenario.durationFrames, r.start + horizon);
  const { w, wo, withEnd, withoutEnd } = sampleBoth(ctx, r.state, s, r.start, end);
  return { windows: [...newWindows(w, wo).keys()], events: [...new Set(newEvents(withEnd, withoutEnd, r.start).filter((e) => e.operator === operator).map((e) => e.text).filter(tieEvent))] };
}

/** How strong a piece is, to keep the strongest of one kind (layers, level, stacks). */
function rank(p: Piece): number {
  if (p.kind === "buff") return p.layers * 1e6 + p.buff.modifiers.reduce((a, m) => a + Math.abs(m.value), 0);
  if (p.kind === "status") return p.status.level * 1e6 + p.status.artsIntensity;
  if (p.kind === "physical") return p.physical.level;
  return p.stacks;
}

/** The piece's key without its level (one entry per buff, status, physical status). */
const pieceGroup = (p: Piece) => (p.kind === "buff" ? p.key : p.key.replace(/ \d+$/, ""));

/** A state with pieces put on, from its frame for `length` frames (statuses old enough to be at full strength: Corrosion's shred ramps). */
export function withPieces(state: TimelineState, pieces: readonly Piece[], length: number): TimelineState {
  const f = state.frame;
  let buffs = state.buffs;
  let enemy = state.enemy;
  let link = state.link;
  for (const p of pieces) {
    if (p.kind === "buff") {
      const { cast: _c, whileCasting: _w, endsWithCast: _e, skipped: _s, ...b } = p.buff;
      const inst: ActiveBuff = { ...b, appliedAt: f, expiresAt: Number.isFinite(b.expiresAt) ? f + length : Infinity, ...(b.every !== undefined ? { nextTick: f + b.every } : {}) };
      buffs = [...buffs, ...Array.from({ length: p.layers }, () => inst)];
    } else if (p.kind === "status") {
      const life = p.status.expiresAt - p.status.appliedAt;
      const st: ActiveStatus = { ...p.status, appliedAt: f - Math.max(0, life - FPS), expiresAt: f + length, ...(p.status.nextTickAt !== undefined ? { nextTickAt: f + FPS } : {}) };
      enemy = { ...enemy, statuses: [...enemy.statuses.filter((x) => x.status !== st.status), st] };
    } else if (p.kind === "physical") {
      enemy = { ...enemy, physical: [...enemy.physical.filter((x) => x.status !== p.physical.status), { ...p.physical, appliedAt: f, expiresAt: f + length }] };
    } else if (p.kind === "vulnerable") {
      enemy = { ...enemy, vulnerable: { stacks: p.stacks, expiresAt: f + length } };
    } else link = [...link, ...Array.from({ length: p.stacks }, () => f + length)];
  }
  return { ...state, buffs, enemy, link };
}

/** A step's damage (all, and its operator's own) from a state, within `horizon`; null when it can't be cast. */
function stepDamage(ctx: TimelineContext, s: TimelineState, step: PlanStep, horizon: number, wait = MAX_WAIT): StepDamage | null {
  const r = runStep(ctx, s, step, wait);
  if ("error" in r) return null;
  const end = Math.min(ctx.scenario.durationFrames, r.start + horizon);
  const a = advance(ctx, r.state, end).hits.filter((h) => h.frame >= r.start);
  const b = advance(ctx, s, end).hits.filter((h) => h.frame >= r.start);
  const skills = new Set(r.actions.map((x) => x.skill));
  const net = (keep: (h: TimelineState["hits"][number]) => boolean) => sumExact(a.filter(keep)) - sumExact(b.filter(keep));
  const cast = net((h) => h.operator === step.operator && skills.has(h.skillId));
  const reactions = net((h) => h.skillId.startsWith("reaction:"));
  return { all: net(() => true), cast, dealt: cast + Math.max(0, reactions), busy: exclusiveUntil(ctx, r.state, step.operator) - r.start };
}

/**
 * A step's damage in a probe: `cast`, its own kit hits (the skills it cast: not its trigger hits, which are window
 * payoffs such as Si's burst); `dealt`, those and the reaction hits it adds (Shatter, a reaction's hit and ticks; not
 * less when it consumes a status whose ticks it ends); `all`, every hit's difference (others' too: the buffs it gives).
 */
export interface StepDamage {
  readonly cast: number;
  readonly dealt: number;
  readonly all: number;
  /** Frames its operator is busy with it (its exclusive frames). */
  readonly busy: number;
}

/**
 * What a step needs first: steps cast before it (its `available` condition, a combo's opener), or, for a combo whose
 * window nothing the team does from the fight's start opens within two steps (Akekuri's on a Stagger), its window
 * forced open (`forced`: the window key; then its effects and ceiling are those of a cast in a window, not a chain).
 */
export interface Prefix {
  readonly steps: readonly PlanStep[];
  readonly forced?: string;
  /** Buffs of the step's operator its `available` condition reads, put on through the engine (addBuff) when no steps make them (Arcane's Gloompurge Arcana). */
  readonly buffs?: readonly string[];
}

/** How long a step may wait for what its prefix sets up (Arcane's sequence 2 for two Final Strikes of the array): 20 s. */
const PREFIX_WAIT = 20 * FPS;

/** A state after a step's prefix: its steps from `from`, then its forced window; why, when a step can't be cast. */
function prepare(ctx: TimelineContext, from: TimelineState, pre: Prefix): TimelineState | { error: string } {
  let s = from;
  for (const p of pre.steps) {
    const r = runStep(ctx, s, p);
    if ("error" in r) return { error: `${p.id} (before it): ${r.error}` };
    s = r.state;
  }
  if (pre.forced) s = { ...s, comboWindow: { ...s.comboWindow, [pre.forced]: { from: s.frame, until: s.frame + COMBO_WINDOW_FRAMES, count: 1 } } };
  for (const id of pre.buffs ?? []) {
    const [op, buff] = id.split(":") as [string, string];
    const def = ctx.kits.get(op)?.buffs.find((b) => b.id === buff);
    if (!def) return { error: `${op} has no kit buff ${buff}` };
    const skill = ctx.kits.get(op)?.skills.find((k) => k.kind === "ultimate")?.skillId ?? (ctx.kits.get(op)?.skills[0]?.skillId as string);
    s = addBuff(ctx, s, op, skill, def, s.frame, situationAt(ctx, op, s, s.frame)).state;
  }
  return s;
}

/** A prefix of nothing: the step is castable from the fight's start. */
const isPlain = (pre: Prefix | undefined) => pre !== undefined && pre.steps.length === 0 && !pre.forced && !pre.buffs?.length;

const prefixLabel = (pre: Prefix) => [...pre.steps.map((p) => p.id), ...(pre.forced ? [`(window ${pre.forced} forced)`] : []), ...(pre.buffs ?? []).map((b) => `(${b} put on)`)];

/**
 * Everything about a team's payoffs: probes of every step from every situation, the ceilings of the damaging steps,
 * window payoffs, and chains. Deterministic. Every entry is kept, however small: a low-value step can still combine
 * with high-value ones on resources that would otherwise go unused (the owner, 2026-11-15); rank is for display.
 */
export function payoffs(data: GameData, scenario: Omit<TimelineScenario, "rotation">, options: PayoffOptions = {}): PayoffReport {
  const horizon = options.horizon ?? 20 * FPS;
  const ctx = planContext(data, scenario);
  const base = init(ctx);
  const steps = planSteps(ctx);
  const byId = new Map(steps.map((s) => [s.id, s]));
  let probes = 0;
  const effects: ActionEffect[] = [];
  const unreachable: { step: string; why: string }[] = [];
  const probeFrom = (s: TimelineState, step: PlanStep, label: string, pre: Prefix, wait = MAX_WAIT): ActionEffect | { error: string } => {
    probes++;
    const r = runStep(ctx, s, step, wait);
    return "error" in r ? r : observe(ctx, s, r, step, horizon, label, prefixLabel(pre));
  };
  const reach = (step: PlanStep, label: string, pre: Prefix, wait = MAX_WAIT): ActionEffect | { error: string } => {
    const s = prepare(ctx, base, pre);
    return "error" in s ? s : probeFrom(s, step, label, pre, wait);
  };
  // 1. From the start, no situation: what each step does, and which steps need others first.
  const none: ProbeSituation = { label: "none" };
  const prefixes = new Map<string, Prefix>();
  const pending: PlanStep[] = [];
  for (const st of steps) {
    const e = reach(st, none.label, { steps: [] });
    if ("error" in e) pending.push(st);
    else {
      effects.push(e);
      prefixes.set(st.id, { steps: [] });
    }
  }
  // Steps that need a window or a state first: after an opener (a step whose probe opened the step's window, itself
  // after its prefix), after two steps from the start (a reaction: an infliction, then another element), or after one
  // or two of the operator's own steps (Si's strokes after her battle skill, Arcane's sequence 2 after her array).
  const plainSteps = () => steps.filter((x) => isPlain(prefixes.get(x.id)));
  for (let round = 0; round < 3 && pending.length; round++) {
    for (const st of [...pending]) {
      const candidates: PlanStep[][] = [];
      const key = st.kind === "combo" && st.skill ? windowKey(ctx, st.operator, st.skill) : undefined;
      if (key !== undefined) {
        for (const e of effects) if (e.windows.some((w) => w.key === key)) candidates.push([...(prefixes.get(e.step)?.steps ?? []), byId.get(e.step) as PlanStep]);
        for (const a of plainSteps()) for (const b of plainSteps()) if (a !== b && a.kind !== "combo" && b.kind !== "combo") candidates.push([a, b]);
      }
      const own = steps.filter((x) => x.operator === st.operator && x.id !== st.id && prefixes.has(x.id) && !prefixes.get(x.id)?.forced && !prefixes.get(x.id)?.buffs?.length);
      for (const a of own) candidates.push([...(prefixes.get(a.id)?.steps ?? []), a]);
      for (const a of own) for (const b of own) if (a !== b) candidates.push([...(prefixes.get(a.id)?.steps ?? []), a, b]);
      for (const c of candidates) {
        const e = reach(st, none.label, { steps: c }, PREFIX_WAIT);
        if ("error" in e) continue;
        effects.push(e);
        prefixes.set(st.id, { steps: c });
        pending.splice(pending.indexOf(st), 1);
        break;
      }
    }
  }
  // The rest: a combo with its window forced open, a skill with the buffs its condition reads put on.
  for (const st of [...pending]) {
    const e = reach(st, none.label, { steps: [] });
    const key = st.kind === "combo" && st.skill ? windowKey(ctx, st.operator, st.skill) : undefined;
    const avail = st.skill ? ctx.kits.get(st.operator)?.skills.find((k) => k.skillId === st.skill)?.available : undefined;
    const pre: Prefix = key !== undefined ? { steps: [], forced: key } : { steps: [], buffs: avail ? predicateRefs(avail).buffs.map((b) => `${st.operator}:${b}`) : [] };
    const forced = reach(st, none.label, pre, PREFIX_WAIT);
    unreachable.push({ step: st.id, why: `${"error" in e ? e.error : "?"}${"error" in forced ? "" : key ? "; probed with its window forced open" : "; probed with the buffs its condition reads put on"}` });
    if ("error" in forced) continue;
    effects.push(forced);
    prefixes.set(st.id, pre);
  }
  // 2. The situations: Staggered, each element the team inflicts (1 stack), Link when the team makes it.
  const inflicted = new Set<ArtsElement>();
  let links = 0;
  for (const e of effects) {
    for (const x of e.enemy) {
      const m = /^inflicted (\w+)/.exec(x.event);
      if (m && (ARTS_ELEMENTS as readonly string[]).includes(m[1] as string)) inflicted.add(m[1] as ArtsElement);
    }
    for (const p of e.pieces) if (p.kind === "link") links = Math.max(links, p.stacks);
  }
  const situations: ProbeSituation[] = [
    none,
    { label: "Staggered", staggered: true },
    ...ARTS_ELEMENTS.filter((el) => inflicted.has(el)).map((el) => ({ label: `${el} ×1`, infliction: { element: el, stacks: 1 } })),
    ...(links > 0 ? [{ label: "Link ×1", link: 1 }] : []),
    ...(steps.some((st) => (ctx.kits.get(st.operator)?.stacks.length ?? 0) > 0) ? [{ label: "own stacks full", stacks: true }] : []),
  ];
  for (const sit of situations.slice(1)) {
    for (const st of steps) {
      const pre = prefixes.get(st.id);
      if (!pre) continue;
      if (sit.stacks && !(ctx.kits.get(st.operator)?.stacks.length ?? 0)) continue;
      // The situation is put on after the steps before it (an opener's own infliction would replace it otherwise).
      const s = prepare(ctx, base, pre);
      if ("error" in s) continue;
      const e = probeFrom(inSituation(sit.stacks ? fullStacks(ctx, s, st.operator) : s, sit, s.frame + horizon), st, sit.label, pre, pre.steps.length ? PREFIX_WAIT : MAX_WAIT);
      if (!("error" in e)) effects.push(e);
    }
  }
  // 3. Pieces and their achievers.
  const pieceBest = new Map<string, Piece>();
  const achievers = new Map<string, Achiever[]>();
  for (const e of effects) {
    for (const p of e.pieces) {
      const g = pieceGroup(p);
      const was = pieceBest.get(g);
      if (!was || rank(p) > rank(was)) pieceBest.set(g, p);
      const list = achievers.get(g) ?? [];
      const b = p.kind === "buff" ? e.buffs.find((x) => `buff ${x.owner}:${x.id}` === g) : undefined;
      const offset = b ? b.offset : p.kind === "status" ? p.status.appliedAt : 0;
      const duration = b ? b.duration : p.kind === "status" ? p.status.expiresAt - p.status.appliedAt : p.kind === "physical" ? p.physical.expiresAt - p.physical.appliedAt : p.kind === "link" ? LINK_FRAMES : INFLICTION_FRAMES;
      if (!list.some((a) => a.step === e.step && a.situation === e.situation)) list.push({ step: e.step, situation: e.situation, offset: p.kind === "status" ? 0 : offset, duration, cost: e.cost });
      achievers.set(g, list);
    }
  }
  const allPieces = [...pieceBest.values()];
  const gates = stateBuffs(ctx);
  // 4. Ceilings.
  const ceilings: Ceiling[] = [];
  for (const st of options.ceilings === false ? [] : steps) {
    const pre = prefixes.get(st.id);
    if (!pre) continue;
    const plain = effects.find((e) => e.step === st.id && e.situation === "none");
    if (!plain) continue;
    const s0 = prepare(ctx, base, pre);
    if ("error" in s0) continue;
    const length = horizon + PREFIX_WAIT;
    const variants: ProbeSituation[] = [none, { label: "Staggered", staggered: true }];
    for (const el of ARTS_ELEMENTS.filter((x) => inflicted.has(x))) {
      for (const n of [1, MAX_INFLICTION_STACKS]) {
        variants.push({ label: `${el} ×${n}`, infliction: { element: el, stacks: n } });
        variants.push({ label: `${el} ×${n}, Staggered`, infliction: { element: el, stacks: n }, staggered: true });
      }
    }
    // Its operator's kit stacks at their maximum, too (Laevatain's Melting Flame empowers her battle skill): set as
    // plain data, so a trigger on reaching it (stackAtLeast) doesn't fire.
    const full = (ctx.kits.get(st.operator)?.stacks.length ?? 0) > 0 ? fullStacks(ctx, s0, st.operator).stacks : undefined;
    for (const v of [...variants]) if (full) variants.push({ ...v, label: `${v.label}, own stacks full`, stacks: true });
    const wait = pre.steps.length ? PREFIX_WAIT : MAX_WAIT;
    const measure = (sit: ProbeSituation, ps: readonly Piece[]) => {
      probes++;
      const s1 = sit.stacks && full ? { ...s0, stacks: full } : s0;
      return stepDamage(ctx, withPieces(inSituation(s1, sit, s0.frame + length), ps, length), st, horizon, wait);
    };
    // Every piece on, and every piece but the gating buffs (Twilight shuts Laevatain's plain battle skill), per variant.
    const gated = allPieces.filter((p) => p.kind === "buff" && gates.has(`${p.buff.owner}:${p.buff.id}`));
    const sets = gated.length ? [allPieces, allPieces.filter((p) => !gated.includes(p))] : [allPieces];
    let best: { sit: ProbeSituation; d: StepDamage; set: readonly Piece[] } | null = null;
    for (const v of variants) {
      for (const set of sets) {
        const d = measure(v, set);
        if (d && (!best || d.dealt > best.d.dealt)) best = { sit: v, d, set };
      }
    }
    if (!best) continue;
    // Pieces that lower it are left out, one at a time, until none does; then each kept piece's worth (left out alone).
    let kept = [...best.set];
    const against: string[] = allPieces.filter((p) => !kept.includes(p)).map((p) => p.key);
    for (let changed = true; changed; ) {
      changed = false;
      for (const p of kept) {
        const d = measure(best.sit, kept.filter((x) => x !== p));
        if (d && d.dealt > best.d.dealt + 1e-6) {
          best = { sit: best.sit, d, set: best.set };
          kept = kept.filter((x) => x !== p);
          against.push(p.key);
          changed = true;
          break;
        }
      }
    }
    const bundle: BundlePiece[] = [];
    const hits = effects.find((e) => e.step === st.id && e.hits)?.hits ?? { first: 0, last: 0 };
    for (const p of kept) {
      const d = measure(best.sit, kept.filter((x) => x !== p));
      const worth = best.d.dealt - (d?.dealt ?? 0);
      if (worth <= Math.max(1, best.d.dealt * 1e-4)) continue;
      // One achiever per step (the first found), each with its lead.
      const list: BundlePiece["achievers"][number][] = [];
      for (const a of achievers.get(pieceGroup(p)) ?? []) {
        if (list.some((x) => x.step === a.step)) continue;
        const min = a.offset - hits.first;
        const max = a.offset + a.duration - hits.last;
        list.push({ ...a, lead: max >= min ? { min, max } : null });
      }
      bundle.push({ key: p.key, worth, achievers: list });
    }
    bundle.sort((a, b) => b.worth - a.worth);
    probes++;
    const bare = stepDamage(ctx, s0, st, horizon, wait) ?? { all: 0, cast: 0, dealt: 0, busy: plain.busy };
    ceilings.push({ step: st.id, prefix: prefixLabel(pre), bare: bare.dealt, bareAll: bare.all, best: best.d.dealt, bestCast: best.d.cast, bestAll: best.d.all, busy: Math.min(best.d.busy, bare.busy), situation: best.sit.label, bundle, against, cost: plain.cost });
  }
  ceilings.sort((a, b) => b.best - a.best);
  // 5. Window payoffs: reaction statuses (their damage where they formed) and recording buffs.
  const windowsOut: WindowPayoff[] = [];
  for (const e of effects) {
    for (const x of e.enemy) {
      const m = /^reaction (\w+)/.exec(x.event) ?? /^(shatter)/.exec(x.event);
      if (!m) continue;
      const key = m[1] as string;
      let w = windowsOut.find((y) => y.key === key);
      if (!w) windowsOut.push((w = { key, what: key === "shatter" ? "Shatter (a physical status on a Solidified enemy)" : `${key} (reaction status: its hit, ticks and what it does)`, damage: 0, achievers: [] }));
      const ach = w.achievers as Achiever[];
      if (!ach.some((a) => a.step === e.step && a.situation === e.situation)) ach.push({ step: e.step, situation: e.situation, offset: x.offset, duration: 0, cost: e.cost });
      (w as { damage: number }).damage = Math.max(w.damage, e.reactions);
    }
  }
  // 6. Chains.
  const chainsFound = options.chains === false ? { chains: [], capped: false, probes: 0 } : findChains(ctx, base, steps, prefixes, horizon, options);
  probes += chainsFound.probes;
  // Recording buffs: their key and rate, with what the chains' bursts dealt (in the chains' damage).
  for (const e of effects) {
    for (const b of e.buffs) {
      if (windowsOut.some((w) => w.key === `records ${b.owner}:${b.id}`)) continue;
      const kit = ctx.kits.get(b.owner)?.buffs.find((x) => x.id === b.id);
      if (!kit?.records) continue;
      windowsOut.push({ key: `records ${b.owner}:${b.id}`, what: `${b.id}: records a share of the damage in its window (${(b.duration / FPS).toFixed(1)} s) and deals it when it ends`, damage: 0, achievers: [{ step: e.step, situation: e.situation, offset: b.offset, duration: b.duration, cost: e.cost }] });
    }
  }
  return { steps, situations, effects, unreachable, ceilings, windows: windowsOut, chains: chainsFound.chains, capped: chainsFound.capped, probes };
}

/** Events that tie steps together: reactions, consumptions, Shatter, physical and control statuses (not plain inflictions or bursts). */
const tieEvent = (ev: string) => /^(reaction|consumed|shatter|lift|knockdown|crush|breach|control)/.test(ev);

interface ChainSearch {
  readonly chains: Chain[];
  readonly capped: boolean;
  readonly probes: number;
}

/** How long a chain search watches a step for what it opens or causes: 8 s (a combo window is 6 s). */
const TIE_FRAMES = 8 * FPS;

/**
 * Chains by depth-first search from the fight's start (every ultimate charged), each step cast at its earliest in the
 * engine after the ones before: a combo whose window an earlier step of the chain opened (`opens`, cast within the
 * window), or a step that after them opens a window or causes a reaction it doesn't from the fight's start
 * (`sets up`, starting within 3 s). Each step once a chain; chains with the same steps starting at the same frames are
 * one (the order of simultaneous casts). Every chain of two steps or more is kept: rank is for display only.
 */
function findChains(ctx: TimelineContext, base: TimelineState, steps: readonly PlanStep[], prefixes: ReadonlyMap<string, Prefix>, horizon: number, options: PayoffOptions): ChainSearch {
  const depth = options.depth ?? 6;
  const budget = options.budget ?? 6000;
  let probes = 0;
  let capped = false;
  const found: { steps: PlanChainStep[]; ids: PlanStep[] }[] = [];
  const seen = new Set<string>();
  const windowOf = (st: PlanStep) => (st.kind === "combo" && st.skill ? windowKey(ctx, st.operator, st.skill) : undefined);
  const free = steps.filter((s) => isPlain(prefixes.get(s.id)));
  // What each step opens or causes from the fight's start: a tie must be more than that.
  const plain = new Map<string, Set<string>>();
  for (const st of free) {
    const r = runStep(ctx, base, st);
    if ("error" in r) continue;
    probes++;
    const t = tiesOf(ctx, base, r, TIE_FRAMES, st.operator);
    plain.set(st.id, new Set([...t.windows.map((w) => `window ${w}`), ...t.events]));
  }
  const visit = (state: TimelineState, chain: PlanChainStep[], ids: PlanStep[], starts: number[], opened: Map<string, number>) => {
    if (chain.length >= 2) {
      const key = ids.map((x, i) => `${x.id}@${starts[i]}`).sort().join("|");
      if (seen.has(key)) return;
      seen.add(key);
      found.push({ steps: chain, ids });
    }
    if (chain.length >= depth) return;
    for (const st of steps) {
      if (ids.includes(st)) continue;
      if (probes >= budget) {
        capped = true;
        return;
      }
      const w = windowOf(st);
      const opens = w !== undefined && opened.has(w);
      if (w !== undefined && !opens && st.kind === "combo") continue;
      const r = runStep(ctx, state, st, opens ? COMBO_WINDOW_FRAMES : 3 * FPS);
      if ("error" in r) continue;
      probes++;
      const t = tiesOf(ctx, state, r, TIE_FRAMES, st.operator);
      const ties = [...t.windows.map((x) => `window ${x}`), ...t.events].filter((x) => !plain.get(st.id)?.has(x));
      if (!opens && ties.length === 0) continue;
      const next = new Map(opened);
      for (const x of t.windows) if (!next.has(x)) next.set(x, chain.length);
      const link: PlanChainStep = opens
        ? { step: st.id, at: r.start - (starts[0] as number), link: "opens", by: { index: opened.get(w as string) as number, through: `window ${w}` }, slack: null }
        : { step: st.id, at: r.start - (starts[0] as number), link: "sets up", by: { index: chain.length - 1, through: [...new Set(ties)].join(", ") }, slack: null };
      visit(r.state, [...chain, link], [...ids, st], [...starts, r.start], next);
    }
  };
  for (const st of free) {
    if (st.kind === "combo" && windowOf(st) !== undefined) continue;
    const r = runStep(ctx, base, st);
    if ("error" in r) continue;
    const opened = new Map<string, number>([...(plain.get(st.id) ?? [])].filter((x) => x.startsWith("window ")).map((x) => [x.slice(7), 0]));
    visit(r.state, [{ step: st.id, at: 0, link: "first", slack: null }], [st], [r.start], opened);
  }
  // Each chain's damage, span and cost, replayed from the start.
  const chains: Chain[] = found.map((f) => chainValue(ctx, base, f.ids, f.steps, horizon));
  chains.sort((a, b) => b.perSecond - a.perSecond || b.damage - a.damage);
  // Slack and merges for the best per second first (rank decides only what's measured; every chain stays listed).
  const measure = options.measure ?? 10;
  for (let i = 0; i < Math.min(measure, chains.length); i++) {
    const c = chains[i] as Chain;
    const ids = c.steps.map((x) => steps.find((s) => s.id === x.step) as PlanStep);
    const withSlack = c.steps.map((x, k) => ({ ...x, slack: slackOf(ctx, base, ids, c, k, horizon) }));
    chains[i] = { ...c, steps: withSlack, merged: mergeChain(ctx, base, ids, c, free, horizon) };
  }
  return { chains, capped, probes };
}

/** Plays steps in order from a state, each at its earliest (or at `at[k]` when given); the states' frames of each start, or null when one can't. */
function playChain(ctx: TimelineContext, base: TimelineState, ids: readonly PlanStep[], at: readonly (number | undefined)[] = [], maxWait = MAX_WAIT): { state: TimelineState; starts: number[]; busy: number } | null {
  let s = base;
  const starts: number[] = [];
  let busy = 0;
  for (let k = 0; k < ids.length; k++) {
    const r = runStep(ctx, s, ids[k] as PlanStep, maxWait, at[k]);
    if ("error" in r) return null;
    s = r.state;
    starts.push(r.start);
    busy = Math.max(busy, exclusiveUntil(ctx, s, (ids[k] as PlanStep).operator));
  }
  return { state: s, starts, busy };
}

/** Damage committed by a state up to a frame, from a frame on. */
function damageBy(ctx: TimelineContext, s: TimelineState, from: number, until: number): number {
  return sumExact(advance(ctx, s, Math.min(until, ctx.scenario.durationFrames)).hits.filter((h) => h.frame >= from));
}

function chainValue(ctx: TimelineContext, base: TimelineState, ids: readonly PlanStep[], steps: PlanChainStep[], horizon: number): Chain {
  const p = playChain(ctx, base, ids) as { state: TimelineState; starts: number[]; busy: number };
  const first = p.starts[0] as number;
  const until = (p.starts.at(-1) as number) + horizon;
  const damage = damageBy(ctx, p.state, first, until) - damageBy(ctx, base, first, until);
  const span = Math.max(1, p.busy - first);
  const energy: Record<string, number> = {};
  let sp = 0;
  let cooldown = 0;
  for (let k = 0; k < ids.length; k++) {
    const st = ids[k] as PlanStep;
    if (st.kind === "chain") continue;
    const c = skillCosts(ctx, st.operator, st.skill as string, p.starts[k] as number);
    sp += c.spCost;
    if (c.energyCost) energy[st.operator] = (energy[st.operator] ?? 0) + c.energyCost;
    cooldown = Math.max(cooldown, c.cooldownFrames);
  }
  return { steps, damage, span, cost: { sp, energy, cooldown }, perSecond: damage / (span / FPS), perSp: sp > 0 ? damage / sp : null, merged: null };
}

/** How much later step k may start (half seconds, up to 6 s) with the later steps legal and the damage within 1%. */
function slackOf(ctx: TimelineContext, base: TimelineState, ids: readonly PlanStep[], c: Chain, k: number, horizon: number): number {
  const orig = playChain(ctx, base, ids);
  if (!orig) return 0;
  const first = orig.starts[0] as number;
  const until = (orig.starts.at(-1) as number) + horizon + COMBO_WINDOW_FRAMES;
  let slack = 0;
  for (let d = 15; d <= COMBO_WINDOW_FRAMES; d += 15) {
    const at = ids.map((_, i) => (i === k ? (orig.starts[k] as number) + d : undefined));
    const p = playChain(ctx, base, ids, at, COMBO_WINDOW_FRAMES);
    // A later step that now waits far longer for a window than in the chain has lost its tie.
    if (!p || p.starts.some((f, i) => i > k && f - (orig.starts[i] as number) > d + 2 * FPS)) break;
    const dmg = damageBy(ctx, p.state, first, until) - damageBy(ctx, base, first, until);
    if (dmg < c.damage * 0.99) break;
    slack = d;
  }
  return slack;
}

/**
 * A chain merged: setups cast before it (each other step at the chain's start, kept when the chain and it deal more
 * together than apart: synergy), then fillers (each other step after each chain step, kept when no chain step moves
 * and the damage rises: idle operators, spare SP, gaps in cooldowns). Greedy, best first.
 */
function mergeChain(ctx: TimelineContext, base: TimelineState, ids: readonly PlanStep[], c: Chain, others: readonly PlanStep[], horizon: number): Merge {
  const orig = playChain(ctx, base, ids);
  if (!orig) return { setups: [], fillers: [], damage: c.damage };
  const until = (orig.starts.at(-1) as number) + horizon;
  const dmg = (s: TimelineState) => damageBy(ctx, s, 0, until + 4 * FPS) - damageBy(ctx, base, 0, until + 4 * FPS);
  const alone = new Map<string, number>();
  const aloneOf = (st: PlanStep) => {
    if (!alone.has(st.id)) {
      const r = runStep(ctx, base, st);
      alone.set(st.id, "error" in r ? 0 : dmg(r.state));
    }
    return alone.get(st.id) as number;
  };
  // Synergy of a setup: what the setups so far, it and the chain deal together, less the setups and the chain without
  // it, less it alone (each step's own worth counted once).
  const setups: { step: string; synergy: number }[] = [];
  let pre: PlanStep[] = [];
  let preState = base;
  let current = dmg(orig.state);
  const candidates = others.filter((o) => !ids.includes(o) && o.kind !== "combo");
  for (let round = 0; round < 3; round++) {
    let bestS: { st: PlanStep; state: TimelineState; synergy: number; total: number } | null = null;
    for (const st of candidates) {
      if (pre.includes(st)) continue;
      const r = runStep(ctx, preState, st);
      if ("error" in r) continue;
      const p = playChain(ctx, r.state, ids);
      if (!p) continue;
      const total = dmg(p.state);
      const synergy = total - current - aloneOf(st);
      if (synergy > Math.max(1, c.damage * 0.005) && (!bestS || synergy > bestS.synergy)) bestS = { st, state: r.state, synergy, total };
    }
    if (!bestS) break;
    setups.push({ step: bestS.st.id, synergy: bestS.synergy });
    pre = [...pre, bestS.st];
    preState = bestS.state;
    current = bestS.total;
  }
  // Fillers: after chain step k, another step at its earliest; the chain's steps must start where they did.
  const fillers: { step: string; after: number; gain: number }[] = [];
  const played = playChain(ctx, preState, ids);
  if (!played) return { setups, fillers, damage: c.damage };
  let seq: { st: PlanStep; filler: boolean }[] = ids.map((st) => ({ st, filler: false }));
  let total = dmg(played.state);
  const chainStarts = played.starts;
  const replay = (q: { st: PlanStep; filler: boolean }[]) => {
    let s = preState;
    const starts: number[] = [];
    for (const x of q) {
      const r = runStep(ctx, s, x.st, x.filler ? 2 * FPS : MAX_WAIT);
      if ("error" in r) return null;
      s = r.state;
      if (!x.filler) starts.push(r.start);
    }
    return starts.every((f, i) => f === chainStarts[i]) ? s : null;
  };
  for (let round = 0; round < 3; round++) {
    let bestF: { q: typeof seq; gain: number; step: string; after: number; total: number } | null = null;
    for (const st of others) {
      if (seq.some((x) => x.st === st) || pre.includes(st)) continue;
      for (let k = 0; k < seq.length; k++) {
        const q = [...seq.slice(0, k + 1), { st, filler: true }, ...seq.slice(k + 1)];
        const s = replay(q);
        if (!s) continue;
        const t = dmg(s);
        if (t - total > Math.max(1, total * 0.001) && (!bestF || t - total > bestF.gain)) bestF = { q, gain: t - total, step: st.id, after: seq.slice(0, k + 1).filter((x) => !x.filler).length - 1, total: t };
      }
    }
    if (!bestF) break;
    fillers.push({ step: bestF.step, after: bestF.after, gain: bestF.gain });
    seq = bestF.q;
    total = bestF.total;
  }
  return { setups, fillers, damage: total };
}

/** One cast of a rotation against its step's ceiling: its own kit hits (the skills it cast), the measure of the ceiling's `bestCast`. */
export interface CastEfficiency {
  readonly step: string;
  readonly frame: number;
  readonly own: number;
  readonly ceiling: number;
  readonly efficiency: number;
}

/** A rotation's casts against the ceilings, and which chains it plays (each step within a combo window of the one before). */
export interface SetupEfficiency {
  readonly casts: readonly CastEfficiency[];
  readonly total: number;
  /** Per chain (by its steps' ids joined with " → "): the frames of the first step of each time the rotation plays it. */
  readonly chains: readonly { readonly chain: string; readonly at: readonly number[] }[];
}

/**
 * How close a rotation's casts came to their ceilings: each cast's own kit hits (its skill's hits, from its start to
 * the operator's next cast of the same skill; trigger hits such as Si's burst are window payoffs, reactions the
 * team's) against the ceiling's `bestCast`. And where it plays the given chains.
 */
export function setupEfficiency(data: GameData, scenario: TimelineScenario, report: Pick<PayoffReport, "ceilings">, chains: readonly (readonly string[])[]): SetupEfficiency {
  const ctx = createContext(data, scenario);
  let s = init(ctx);
  for (const a of scenario.rotation) s = apply(ctx, s, a);
  s = advance(ctx, s, scenario.durationFrames);
  const own = s.casts.filter((c) => !c.teammate);
  const casts: CastEfficiency[] = [];
  for (let i = 0; i < own.length; i++) {
    const c = own[i] as (typeof own)[number];
    const id = `${c.operator}:${c.skill}`;
    const ceil = report.ceilings.find((x) => x.step === id);
    if (!ceil) continue;
    const next = own.slice(i + 1).find((x) => x.operator === c.operator && x.skill === c.skill);
    const end = next ? next.frame : scenario.durationFrames + 1;
    const dealt = sumExact(s.hits.filter((h) => h.operator === c.operator && h.skillId === c.skill && h.frame >= c.frame && h.frame < end));
    casts.push({ step: id, frame: c.frame, own: dealt, ceiling: ceil.bestCast, efficiency: ceil.bestCast > 0 ? dealt / ceil.bestCast : 0 });
  }
  // A chain is played when each of its steps is cast at or after the one before (casts at one frame in any order) and
  // within a combo window and 2 s of it.
  const found: { chain: string; at: number[] }[] = [];
  const idOf = (c: (typeof own)[number]) => `${c.operator}:${c.skill}`;
  for (const ch of chains) {
    const at: number[] = [];
    for (const c0 of own) {
      if (idOf(c0) !== ch[0]) continue;
      const used = new Set([c0]);
      let last = c0.frame;
      let k = 1;
      for (; k < ch.length; k++) {
        const next = own.find((c) => !used.has(c) && idOf(c) === ch[k] && c.frame >= last && c.frame - last <= COMBO_WINDOW_FRAMES + 2 * FPS);
        if (!next) break;
        used.add(next);
        last = next.frame;
      }
      if (k === ch.length) at.push(c0.frame);
    }
    found.push({ chain: ch.join(" → "), at });
  }
  return { casts, total: simulate(data, scenario).total, chains: found };
}
