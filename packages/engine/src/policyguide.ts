// A payoff-guided rule search's analysis (docs/design.md "Rule-based rotations", the guided search; the owner,
// 2026-11-16: "put together ideal combos and seek to change the rules in directions that can get closer to achieving
// the optimal damage output"). A rules run is watched (playRules' observer: it never changes the run) and its hits
// read afterwards:
//
// - **windows**: a team's damage windows, each operator's skill family (its skills without their step number:
//   Laevatain's Twilight attacks 1–4 are one, Typhoeus's hover shots 1–5 one; a reaction kind one), its occurrences
//   (its hits in clusters, a gap of over 3 s starting the next);
// - **multipliers**: what other operators and the enemy add to a window's hits (each modifier's kit buff, Stagger's
//   ×1.3, a reaction or physical status's), each with **who gives it** (the press of its owner that created the buff:
//   the owner's latest cast at or before it, by kind);
// - **the ideal combo** of a window: every multiplier the team puts on that window at least once in the run, on every
//   hit; each missing multiplier's **loss** is what the hits missing it would gain with it (its modifiers as they were
//   on that hit's own kind elsewhere in the run, the damage zones recomputed: `withModifiers`), and the window's ideal
//   is all of them at once;
// - **visible cues** at each occurrence's start (the frame before its cast): which of the team's visible cues held,
//   against how often each holds over the fight (its lift), to say "when" a window comes in a player's terms.
//
// `guidedEdits` turns the biggest losses into rule edits a player can follow (hold the giver's press until the
// window's cue; chain the two presses; start the window when the multiplier is up; save SP; `shows`; spare SP), each
// judged by play on common random numbers (the CLI's guided search). A planning aid, never part of a fight's result.

import type { Modifier, Zone } from "./effects.ts";
import { EngineError } from "./errors.ts";
import type { GameData } from "./model.ts";
import {
  describeCue,
  describeStep,
  playRules,
  POLICY_VISIBLE_BUFFS,
  POLICY_VISIBLE_STACKS,
  stepsOf,
  type PolicyCue,
  type PolicyFrameView,
  type PolicyOptions,
  type PolicyRule,
  type PolicyRun,
  type PolicyStep,
  type RuleList,
} from "./policy.ts";
import { SP } from "./timeline/rules.ts";
import { spAt } from "./timeline/resources.ts";
import { kitSkill, panelAt } from "./timeline/context.ts";
import type { LandedHit, TimelineScenario } from "./timeline/state.ts";
import type { StatPanel } from "./stats.ts";
import { FPS } from "./units.ts";

// --- Multipliers ------------------------------------------------------------------------------------------------

/**
 * The multiplier a modifier belongs to, or null when no rule can line it up (the stat panel's, a finisher's, Link's,
 * a skill's own conditional bonus without a kit buff): a kit buff `owner:id`, `stagger`, or `status:<reaction or
 * physical status>` (Corrosion, Electrification, Breach: their level folded in).
 */
export function multiplierKey(m: Modifier): string | null {
  if (m.kitBuff) return `${m.kitBuff.owner}:${m.kitBuff.id}`;
  if (m.source === "Staggered") return "stagger";
  const s = /^(Corrosion|Electrification|Breach|Combustion|Solidification) level \d+/.exec(m.source);
  if (s) return `status:${(s[1] as string).toLowerCase()}`;
  return null;
}

/**
 * The hit's damage with `add` modifiers more and those `drop` says less, its zones recomputed from the modifiers it
 * had (computeDamage's formulas: damage bonus, Amp, Susceptibility, DMG Taken as 1 + Σ, the multiplicative zone as a
 * product, ignored resistance added to the resistance zone, the crit zone at its expected value, ATK % into ATK with
 * the panel's base and flat ATK). Attribute points and Arts Intensity aren't recomputed (taken as they were: a ×1
 * approximation for multipliers of those zones). Added modifiers keep only those whose element filter the hit meets
 * (the templates come from hits of the same skill family, so the other filters held there).
 */
export function withModifiers(h: LandedHit, add: readonly Modifier[], drop: (m: Modifier) => boolean, panel?: StatPanel): number {
  if (h.exact === 0) return 0;
  const before = h.modifiers;
  const after = [...before.filter((m) => !drop(m)), ...add.filter((m) => m.element === undefined || m.element === h.element)];
  const sum = (mods: readonly Modifier[], zone: Zone) => mods.reduce((a, m) => (m.zone === zone ? a + m.value : a), 0);
  const prod = (mods: readonly Modifier[], zone: Zone) => mods.reduce((a, m) => (m.zone === zone ? a * (1 + m.value) : a), 1);
  let f = 1;
  for (const zone of ["damageBonus", "amp", "susceptibility", "damageTaken"] as const) f *= (1 + sum(after, zone)) / (1 + sum(before, zone));
  f *= prod(after, "multiplicative") / prod(before, "multiplicative");
  const z = h.zones;
  if (z.resistance > 0) f *= (z.resistance * 100 + sum(after, "ignoreResistance") - sum(before, "ignoreResistance")) / (z.resistance * 100);
  if (z.crit !== 1 || after.some((m) => m.zone === "critRate" || m.zone === "critDamage")) {
    const crit = (mods: readonly Modifier[]) => 1 + Math.min(1, Math.max(0, sum(mods, "critRate"))) * sum(mods, "critDamage");
    const c0 = crit(before);
    if (c0 > 0 && Math.abs(c0 - z.crit) < 1e-6) f *= crit(after) / c0;
  }
  const da = sum(after, "atk") - sum(before, "atk");
  if (da !== 0 && panel) {
    const a = panel.atk;
    const b = a.operatorBase + a.weaponBase;
    const atk0 = b * (1 + a.percent + sum(before, "atk")) + a.flat;
    if (atk0 > 0) f *= (atk0 + b * da) / atk0;
  }
  return h.exact * f;
}

// --- One run --------------------------------------------------------------------------------------------------

/** A multiplier on one window in one run. */
export interface WindowMultiplierRun {
  /** Damage of the window's hits that had it, and what those hits would have dealt without it. */
  readonly present: number;
  readonly without: number;
  /** What the window's hits that lacked it would have gained with it (its template modifiers added). */
  readonly loss: number;
  readonly hits: number;
  readonly missingHits: number;
}

export interface GuideWindowRun {
  /** `operator|family`. */
  readonly key: string;
  readonly operator: string;
  readonly family: string;
  readonly label: string;
  /** Its skills' kind in the kit (basic, battle, combo, ultimate; `reaction` for a reaction family). */
  readonly kind: string;
  readonly damage: number;
  readonly occurrences: number;
  readonly multipliers: Readonly<Record<string, WindowMultiplierRun>>;
  /** What its hits would have gained with every multiplier of its ideal combo on (all at once). */
  readonly ideal: number;
  /** For each candidate cue (GuideRun.cues), at how many of its occurrences' starts it held. */
  readonly cueAtStart: readonly number[];
}

export interface MultiplierInfo {
  readonly label: string;
  /** The kit buff's owner (null: Stagger, a status). */
  readonly owner: string | null;
  readonly zones: readonly string[];
  /** Instances created, by the press that gave them: `operator:kind` (kind: basic, battle, combo, ultimate, or `passive` without a cast of its owner in the 20 s before). */
  readonly givers: Readonly<Record<string, number>>;
}

export interface GuideRun {
  readonly seconds: number;
  readonly total: number;
  readonly sustainedDps: number;
  /** The candidate cues (the team's visible ones), and the frames each held over the fight. */
  readonly cues: readonly PolicyCue[];
  readonly cueFrames: readonly number[];
  readonly frames: number;
  /** Families with at least 2% of the team's damage. */
  readonly windows: readonly GuideWindowRun[];
  readonly multipliers: Readonly<Record<string, MultiplierInfo>>;
  /** Who gives each visible operator state (Laevatain's Twilight, Typhoeus's hover): `operator:buff` → givers. */
  readonly visibleGivers: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Seconds team SP sat at the cap. */
  readonly spAtCapSeconds: number;
}

const has = (data: GameData, op: string, kind: string) => (data.kits.operators[op]?.skills ?? []).some((s) => s.kind === kind && !s.followUpOnly);

/** The visible cues a guided search reads windows by, for a team (ranks 1–4: no Final Strikes, cooldowns or timers). */
export function guideCues(data: GameData, team: readonly string[]): PolicyCue[] {
  const cues: PolicyCue[] = [];
  for (const op of team) {
    if (has(data, op, "ultimate")) cues.push({ ultimate: op });
    if (has(data, op, "combo")) cues.push({ combo: op });
    for (const buff of POLICY_VISIBLE_BUFFS[op] ?? []) cues.push({ buff: { operator: op, buff } });
    for (const stack of POLICY_VISIBLE_STACKS[op] ?? []) {
      const max = data.kits.operators[op]?.stacks?.find((s) => s.id === stack)?.max ?? 1;
      for (const n of new Set([1, max])) cues.push({ stacks: { operator: op, stack, atLeast: n } });
    }
  }
  cues.push({ staggered: true });
  for (const n of [50, 70, 85]) cues.push({ stagger: { atLeast: n } });
  for (const status of ["solidification", "corrosion", "combustion", "electrification", "breach", "lift", "knockdown", "crush"]) cues.push({ status });
  for (const element of ["heat", "electric", "cryo", "nature"]) cues.push({ infliction: { element } });
  cues.push({ vulnerable: { atLeast: 1 } }, { sp: { atLeast: 100 } }, { sp: { atLeast: 200 } });
  return cues;
}

/** A skill's family: its ID without a trailing step number (`…_ult_attack3` → `…_ult_attack`). */
export const skillFamily = (skillId: string) => skillId.replace(/\d+$/, "");

/** Gap that starts a window's next occurrence. */
const OCCURRENCE_GAP = 3 * FPS;
/** A family is a window from this share of the team's damage. */
const WINDOW_SHARE = 0.02;

/**
 * Plays the list once (playRules with these options) and reads its windows, multipliers and cues (module comment).
 * The run is the same as without the analysis.
 */
export function guideRules(data: GameData, scenario: Omit<TimelineScenario, "rotation">, list: RuleList, options: PolicyOptions = {}): { readonly run: PolicyRun; readonly guide: GuideRun } {
  const team = scenario.team.map((b) => b.operator);
  const cues = guideCues(data, team);
  const n = cues.length;
  const end = scenario.durationFrames;
  const frames = end + 1;
  const bits = new Uint8Array(frames * n);
  const cueFrames = cues.map(() => 0);
  let atCap = 0;
  const seen = new WeakSet<object>();
  const givers = new Map<string, Map<string, number>>();
  let castsSeen = 0;
  const lastCast = new Map<string, { frame: number; kind: string }>();
  let last: PolicyFrameView | null = null;
  const kindCache = new Map<string, string>();
  const kindOf = (v: PolicyFrameView, op: string, skill: string) => {
    const k = `${op}|${skill}`;
    let kind = kindCache.get(k);
    if (kind === undefined) {
      try {
        kind = kitSkill(v.ctx, op, skill).kind;
      } catch {
        kind = "other";
      }
      kindCache.set(k, kind);
    }
    return kind;
  };
  const frame = (v: PolicyFrameView) => {
    last = v;
    const f = v.frame;
    for (let i = 0; i < n; i++) {
      if (v.cueHolds(cues[i] as PolicyCue)) {
        bits[f * n + i] = 1;
        cueFrames[i] = (cueFrames[i] as number) + 1;
      }
    }
    if (spAt(v.st, f) >= SP.max - 1e-9) atCap++;
    const casts = v.st.casts;
    for (; castsSeen < casts.length; castsSeen++) {
      const c = casts[castsSeen];
      if (c && !c.teammate) lastCast.set(c.operator, { frame: c.frame, kind: kindOf(v, c.operator, c.skill) });
    }
    for (const b of v.st.buffs) {
      if (seen.has(b)) continue;
      seen.add(b);
      if (b.appliedAt !== f && b.appliedAt < f - 1) continue;
      const key = `${b.owner}:${b.id}`;
      const lc = lastCast.get(b.owner);
      const giver = lc && b.appliedAt - lc.frame <= 20 * FPS ? `${b.owner}:${lc.kind}` : `${b.owner}:passive`;
      let m = givers.get(key);
      if (!m) givers.set(key, (m = new Map()));
      m.set(giver, (m.get(giver) ?? 0) + 1);
    }
  };
  const run = playRules(data, scenario, list, { ...options, observer: { frame } });
  const view = last as PolicyFrameView | null;
  if (!view) throw new EngineError("the run watched no frame");
  const { ctx, st } = view;
  const total = st.hits.reduce((a, h) => a + h.exact, 0);

  // Families and their hits.
  const famHits = new Map<string, LandedHit[]>();
  for (const h of st.hits) {
    const key = `${h.operator}|${skillFamily(h.skillId)}`;
    let a = famHits.get(key);
    if (!a) famHits.set(key, (a = []));
    a.push(h);
  }
  const multipliers = new Map<string, { label: string; owner: string | null; zones: Set<string> }>();
  const label = (key: string, m: Modifier): string => {
    if (key === "stagger") return "Stagger (×1.3)";
    if (key.startsWith("status:")) {
      const s = key.slice(7);
      return `${s[0]?.toUpperCase()}${s.slice(1)}`;
    }
    const owner = m.kitBuff?.owner as string;
    const id = m.kitBuff?.id as string;
    return `${data.operators[owner]?.name ?? owner}'s ${ctx.kits.get(owner)?.buffs.find((b) => b.id === id)?.label ?? id}`;
  };
  const windows: GuideWindowRun[] = [];
  for (const [key, hits] of famHits) {
    const damage = hits.reduce((a, h) => a + h.exact, 0);
    if (total <= 0 || damage < WINDOW_SHARE * total) continue;
    const [operator, family] = key.split("|") as [string, string];
    hits.sort((a, b) => a.frame - b.frame);
    // Kind and label from the skill with the most damage.
    const bySkill = new Map<string, number>();
    for (const h of hits) bySkill.set(h.skillId, (bySkill.get(h.skillId) ?? 0) + h.exact);
    const topSkill = [...bySkill].sort((a, b) => b[1] - a[1])[0]?.[0] as string;
    const reaction = topSkill.startsWith("reaction:");
    const kind = reaction ? "reaction" : kindOf(view, operator, topSkill);
    const kitLabel = reaction ? topSkill.slice(9) : (ctx.kits.get(operator)?.skills.find((s) => s.skillId === topSkill)?.label ?? topSkill);
    const wlabel = `${data.operators[operator]?.name ?? operator}'s ${kitLabel.replace(/\s\d+(?=\s|$)/, "")}`;
    const panel = (() => {
      try {
        return panelAt(ctx, operator, 0);
      } catch {
        return undefined;
      }
    })();
    // Modifiers per hit by multiplier; templates: per (multiplier, hit ID) the middle one of the hits that had it, else of any hit of the family.
    const perHit = hits.map((h) => {
      const m = new Map<string, Modifier[]>();
      for (const x of h.modifiers) {
        const k = multiplierKey(x);
        if (k === null) continue;
        let a = m.get(k);
        if (!a) m.set(k, (a = []));
        a.push(x);
        if (!multipliers.has(k)) multipliers.set(k, { label: label(k, x), owner: x.kitBuff?.owner ?? null, zones: new Set() });
        multipliers.get(k)?.zones.add(x.zone);
      }
      return m;
    });
    const withIt = new Map<string, Map<string, Modifier[][]>>();
    const anyHit = new Map<string, Modifier[][]>();
    perHit.forEach((m, i) => {
      const h = hits[i] as LandedHit;
      for (const [k, mods] of m) {
        let byId = withIt.get(k);
        if (!byId) withIt.set(k, (byId = new Map()));
        const a = byId.get(h.hitId) ?? [];
        a.push(mods);
        byId.set(h.hitId, a);
        const b = anyHit.get(k) ?? [];
        b.push(mods);
        anyHit.set(k, b);
      }
    });
    // Stagger is the same everywhere: its template exists without an occurrence.
    if (!anyHit.has("stagger")) {
      const st0 = { zone: "multiplicative" as const, value: data.constants.staggerDamageTaken, source: "Staggered" };
      anyHit.set("stagger", [[st0]]);
      if (!multipliers.has("stagger")) multipliers.set("stagger", { label: "Stagger (×1.3)", owner: null, zones: new Set(["multiplicative"]) });
    }
    const middle = <T,>(xs: readonly T[]): T => xs[Math.floor(xs.length / 2)] as T;
    const template = (k: string, hitId: string): Modifier[] | undefined => {
      const a = withIt.get(k)?.get(hitId);
      if (a?.length) return middle(a);
      const b = anyHit.get(k);
      return b?.length ? middle(b) : undefined;
    };
    const keys = [...anyHit.keys()];
    const acc: Record<string, { present: number; without: number; loss: number; hits: number; missingHits: number }> = Object.fromEntries(keys.map((k) => [k, { present: 0, without: 0, loss: 0, hits: 0, missingHits: 0 }]));
    let ideal = 0;
    hits.forEach((h, i) => {
      // Fixed damage (Si's recorded burst) takes no modifiers: what lifts it is on the hits it recorded.
      if (h.fixed) return;
      const m = perHit[i] as Map<string, Modifier[]>;
      const missing: Modifier[] = [];
      for (const k of keys) {
        const a = acc[k] as { present: number; without: number; loss: number; hits: number; missingHits: number };
        if (m.has(k)) {
          a.hits++;
          a.present += h.exact;
          a.without += withModifiers(h, [], (x) => multiplierKey(x) === k, panel);
        } else {
          const t = template(k, h.hitId);
          if (!t) continue;
          a.missingHits++;
          a.loss += withModifiers(h, t, () => false, panel) - h.exact;
          missing.push(...t);
        }
      }
      if (missing.length) ideal += withModifiers(h, missing, () => false, panel) - h.exact;
    });
    // Occurrences and the cues at their starts (the frame before the cast that started each).
    const castFrames = st.casts.filter((c) => c.operator === operator && skillFamily(c.skill) === family).map((c) => c.frame);
    const cueAtStart = cues.map(() => 0);
    let occurrences = 0;
    let prev = -Infinity;
    for (const h of hits) {
      if (h.frame - prev > OCCURRENCE_GAP) {
        occurrences++;
        let start = h.frame;
        for (const f of castFrames) if (f <= h.frame && f > prev) start = Math.min(start, f);
        const at = Math.max(0, Math.min(end, start - 1));
        for (let i = 0; i < n; i++) if (bits[at * n + i]) cueAtStart[i] = (cueAtStart[i] as number) + 1;
      }
      prev = h.frame;
    }
    windows.push({ key, operator, family, label: wlabel, kind, damage, occurrences, multipliers: acc, ideal, cueAtStart });
  }
  windows.sort((a, b) => b.damage - a.damage);
  const giverRecord = (key: string) => Object.fromEntries(givers.get(key) ?? []);
  const visibleGivers: Record<string, Record<string, number>> = {};
  for (const op of team) for (const buff of POLICY_VISIBLE_BUFFS[op] ?? []) visibleGivers[`${op}:${buff}`] = giverRecord(`${op}:${buff}`);
  return {
    run,
    guide: {
      seconds: end / FPS,
      total,
      sustainedDps: run.sustainedDps,
      cues,
      cueFrames,
      frames,
      windows,
      multipliers: Object.fromEntries([...multipliers].map(([k, v]) => [k, { label: v.label, owner: v.owner, zones: [...v.zones], givers: v.owner ? giverRecord(k) : {} }])),
      visibleGivers,
      spAtCapSeconds: atCap / FPS,
    },
  };
}

// --- Over runs ------------------------------------------------------------------------------------------------

export interface CueStat {
  readonly cue: PolicyCue;
  /** Share of the window's occurrences whose start it held at, of the fight's frames it held, and their ratio. */
  readonly atStart: number;
  readonly base: number;
  readonly lift: number;
}

export interface GuideLoss {
  readonly window: string;
  readonly multiplier: string;
  readonly label: string;
  readonly owner: string | null;
  /** Share of the window's damage dealt with it on. */
  readonly presence: number;
  /** Its factor on the hits it was on (their damage over the same without it; 1 if never on). */
  readonly factor: number;
  /** DPS the window would gain with it on every hit missing it (averaged over the runs). */
  readonly lossDps: number;
  /** The press that gives it most often (`operator:kind`), or null (Stagger, a status, a passive). */
  readonly giver: string | null;
}

export interface GuideWindow {
  readonly key: string;
  readonly operator: string;
  readonly family: string;
  readonly label: string;
  readonly kind: string;
  readonly dps: number;
  readonly perMinute: number;
  /** DPS its ideal combo would add (every multiplier on every hit). */
  readonly idealDps: number;
  /** Its damage over its ideal (actual / (actual + ideal gain)). */
  readonly achievement: number;
  readonly losses: readonly GuideLoss[];
  /** The cues that come with it, by lift (those that hold at ≥ half its starts first). */
  readonly cues: readonly CueStat[];
}

export interface GuideSummary {
  readonly runs: number;
  readonly seconds: number;
  readonly dps: number;
  readonly windows: readonly GuideWindow[];
  /** Every (window, multiplier) loss, largest first. */
  readonly losses: readonly GuideLoss[];
  readonly multipliers: Readonly<Record<string, MultiplierInfo>>;
  readonly visibleGivers: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Team DPS over the fight's whole length, its ideal-combo gain summed over the windows, and their ratio. */
  readonly totalDps: number;
  readonly idealDps: number;
  readonly achievement: number;
  readonly spAtCapShare: number;
  /** Share of the fight each cue held (GuideRun.cues order), for an operator's ultimate: ready and not cast. */
  readonly cueShare: readonly { readonly cue: PolicyCue; readonly share: number }[];
}

const topOf = (m: Readonly<Record<string, number>> | undefined): string | null => {
  const e = Object.entries(m ?? {}).sort((a, b) => b[1] - a[1])[0];
  return e ? e[0] : null;
};

/** Several runs of one list (seeds differ) aggregated: windows by key, losses averaged over the runs as DPS over the fight. */
export function summariseGuide(runs: readonly GuideRun[]): GuideSummary {
  const first = runs[0];
  if (!first) throw new EngineError("no guide runs");
  const R = runs.length;
  const seconds = first.seconds;
  const perSec = (x: number) => x / R / seconds;
  const multipliers: Record<string, { label: string; owner: string | null; zones: Set<string>; givers: Map<string, number> }> = {};
  for (const r of runs)
    for (const [k, m] of Object.entries(r.multipliers)) {
      const e = (multipliers[k] ??= { label: m.label, owner: m.owner, zones: new Set(), givers: new Map() });
      for (const z of m.zones) e.zones.add(z);
      for (const [g, c] of Object.entries(m.givers)) e.givers.set(g, (e.givers.get(g) ?? 0) + c);
    }
  const info: Record<string, MultiplierInfo> = Object.fromEntries(Object.entries(multipliers).map(([k, v]) => [k, { label: v.label, owner: v.owner, zones: [...v.zones], givers: Object.fromEntries(v.givers) }]));
  const visibleGivers: Record<string, Record<string, number>> = {};
  for (const r of runs) for (const [k, g] of Object.entries(r.visibleGivers)) for (const [x, c] of Object.entries(g)) (visibleGivers[k] ??= {})[x] = (visibleGivers[k]?.[x] ?? 0) + c;
  const totalFrames = runs.reduce((a, r) => a + r.frames, 0);
  const cueShare = first.cues.map((cue, i) => ({ cue, share: runs.reduce((a, r) => a + (r.cueFrames[i] ?? 0), 0) / totalFrames }));
  const keys = [...new Set(runs.flatMap((r) => r.windows.map((w) => w.key)))];
  const windows: GuideWindow[] = keys.map((key) => {
    const ws = runs.map((r) => r.windows.find((w) => w.key === key)).filter((w): w is GuideWindowRun => w !== undefined);
    const w0 = ws[0] as GuideWindowRun;
    const damage = ws.reduce((a, w) => a + w.damage, 0);
    const ideal = ws.reduce((a, w) => a + w.ideal, 0);
    const occ = ws.reduce((a, w) => a + w.occurrences, 0);
    const mkeys = [...new Set(ws.flatMap((w) => Object.keys(w.multipliers)))];
    const losses: GuideLoss[] = mkeys.map((k) => {
      const a = ws.reduce((s, w) => {
        const m = w.multipliers[k];
        return m ? { present: s.present + m.present, without: s.without + m.without, loss: s.loss + m.loss } : s;
      }, { present: 0, without: 0, loss: 0 });
      const mi = info[k];
      // A buff of the window's own operator from a press of its own is its kit's sequence, not something to line up; the giver is kept for display.
      const giver = mi && mi.owner ? topOf(mi.givers) : null;
      return { window: key, multiplier: k, label: mi?.label ?? k, owner: mi?.owner ?? null, presence: damage > 0 ? a.present / damage : 0, factor: a.without > 0 ? a.present / a.without : 1, lossDps: perSec(a.loss), giver };
    }).filter((l) => l.lossDps > 0 || l.presence > 0).sort((a, b) => b.lossDps - a.lossDps);
    const cues: CueStat[] = first.cues.map((cue, i) => {
      const atStart = occ > 0 ? ws.reduce((a, w) => a + (w.cueAtStart[i] ?? 0), 0) / occ : 0;
      const base = (cueShare[i] as { share: number }).share;
      return { cue, atStart, base, lift: base > 0 ? atStart / base : atStart > 0 ? Infinity : 0 };
    }).filter((c) => c.atStart > 0).sort((a, b) => Number(b.atStart >= 0.5) - Number(a.atStart >= 0.5) || b.lift - a.lift);
    return { key, operator: w0.operator, family: w0.family, label: w0.label, kind: w0.kind, dps: perSec(damage), perMinute: occ / R / (seconds / 60), idealDps: perSec(ideal), achievement: damage + ideal > 0 ? damage / (damage + ideal) : 1, losses, cues };
  }).sort((a, b) => b.dps - a.dps);
  const totalDps = runs.reduce((a, r) => a + r.total, 0) / R / seconds;
  const idealDps = windows.reduce((a, w) => a + w.idealDps, 0);
  return {
    runs: R,
    seconds,
    dps: runs.reduce((a, r) => a + r.sustainedDps, 0) / R,
    windows,
    losses: windows.flatMap((w) => w.losses).sort((a, b) => b.lossDps - a.lossDps),
    multipliers: info,
    visibleGivers,
    totalDps,
    idealDps,
    achievement: totalDps / (totalDps + idealDps),
    spAtCapShare: runs.reduce((a, r) => a + r.spAtCapSeconds, 0) / R / seconds,
    cueShare,
  };
}

// --- Directed edits -------------------------------------------------------------------------------------------

export type GuidedEditKind = "hold-giver" | "chain" | "start-window" | "save-sp" | "shows" | "spare-sp" | "move-up" | "random";

export interface GuidedCandidate {
  readonly list: RuleList;
  readonly kind: GuidedEditKind;
  /** The edit in plain words. */
  readonly text: string;
  /** The loss it aims at (window key, multiplier key), if any. */
  readonly target?: { readonly window: string; readonly multiplier: string };
}

const cueKey = (c: PolicyCue) => JSON.stringify(c);
const mentions = (c: PolicyCue, x: PolicyCue): boolean => {
  if (cueKey(c) === cueKey(x)) return true;
  if ("all" in c) return c.all.some((y) => mentions(y, x));
  if ("any" in c) return c.any.some((y) => mentions(y, x));
  if ("not" in c) return mentions(c.not, x);
  return false;
};
const andCue = (a: PolicyCue, b: PolicyCue): PolicyCue => ({ all: [...("all" in a ? a.all : [a]), ...("all" in b ? b.all : [b])] });
const anyOf = (xs: readonly PolicyCue[]): PolicyCue => (xs.length === 1 ? (xs[0] as PolicyCue) : { any: xs });
const pressesFirst = (r: PolicyRule, op: string, cast: PolicyStep["cast"]) => {
  const s = stepsOf(r)[0];
  return s !== undefined && s.operator === op && s.cast === cast;
};

/** The press that starts a window: its own button for a battle skill, combo or ultimate; for basic attacks under an operator state (Twilight, hovering), the press that gives that state. */
export function windowTrigger(w: GuideWindow, s: GuideSummary): PolicyStep | null {
  if (w.kind === "battle" || w.kind === "combo" || w.kind === "ultimate") return { operator: w.operator, cast: w.kind };
  if (w.kind !== "basic") return null;
  for (const c of w.cues) {
    if (!("buff" in c.cue) || c.cue.buff.operator !== w.operator || c.atStart < 0.8) continue;
    const g = topOf(Object.fromEntries(Object.entries(s.visibleGivers[`${w.operator}:${c.cue.buff.buff}`] ?? {}).filter(([k]) => /:(battle|combo|ultimate)$/.test(k))));
    if (g) return { operator: w.operator, cast: g.split(":")[1] as PolicyStep["cast"] };
  }
  return null;
}

/** The visible cues that say a window is on or coming: held at ≥ 60% of its starts and at least 1.3× as often as over the fight (at most two; an SP level isn't a window's cue). */
export function windowCues(w: GuideWindow): PolicyCue[] {
  return w.cues.filter((c) => c.atStart >= 0.6 && c.lift >= 1.3 && !("sp" in c.cue)).slice(0, 2).map((c) => c.cue);
}

/** A visible cue that says a multiplier is up, if the game shows one: Stagger, a status, a visible operator state; for a buff from an ultimate, its giver's ultimate being ready (the press comes next). */
export function multiplierCues(key: string, s: GuideSummary): PolicyCue[] {
  if (key === "stagger") return [{ staggered: true }, { stagger: { atLeast: 70 } }];
  if (key.startsWith("status:")) return [{ status: key.slice(7) }];
  const [owner, id] = key.split(":") as [string, string];
  if ((POLICY_VISIBLE_BUFFS[owner] ?? []).includes(id)) return [{ buff: { operator: owner, buff: id } }];
  const g = topOf(s.multipliers[key]?.givers);
  if (g === `${owner}:ultimate`) return [{ ultimate: owner }];
  return [];
}

export interface GuidedEditOptions {
  /** (window, multiplier) losses edits are made for, largest first (default 6). */
  readonly targets?: number;
  /** At most this many candidates (default 28). */
  readonly max?: number;
  /** Random edits (the rule search's moves) added as a complement (default 4). */
  readonly random?: number;
  readonly rng?: () => number;
  /** A random edit of a list (policysearch editRuleList with the team's pool). */
  readonly randomEdit?: (rng: () => number, list: RuleList) => RuleList;
  /** Lists already judged (resolved JSON): not proposed again. */
  readonly tried?: ReadonlySet<string>;
}

/**
 * Rule edits aimed at the summary's biggest losses (docs/design.md "Rule-based rotations", the guided search), each
 * a player can follow by visible cues:
 *
 * - `hold-giver`: the rules that press the multiplier's giver wait for the window's cue (or the window operator's
 *   ultimate being ready, when the window comes with it);
 * - `chain`: "when both are ready: the giver's ultimate, then the window's" as one rule at the top (alone, and with
 *   the giver held for the window's cue);
 * - `start-window`: the rule that starts the window waits until the multiplier is up (its visible cue);
 * - `save-sp`: other operators' battle skills wait while the window's cue holds (an SP-gated window);
 * - `shows`: a press of a button that changes (Si's, Liino's) only when it shows its first skill;
 * - `spare-sp`: with SP at the cap, a last rule spends 200 SP on a battle skill;
 * - `move-up`: the giver's rule one place up;
 * - `random`: the rule search's random moves, as a complement.
 */
export function guidedEdits(data: GameData, list: RuleList, s: GuideSummary, options: GuidedEditOptions = {}): GuidedCandidate[] {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const out: GuidedCandidate[] = [];
  const keys = new Set<string>([JSON.stringify(list), ...(options.tried ?? [])]);
  const push = (c: GuidedCandidate) => {
    const k = JSON.stringify(c.list);
    if (keys.has(k)) return;
    keys.add(k);
    out.push(c);
  };
  const withRules = (rules: readonly PolicyRule[]): RuleList => ({ ...list, rules });
  const cueWords = (c: PolicyCue) => describeCue(data, c);
  const winOf = new Map(s.windows.map((w) => [w.key, w]));
  const targets = s.losses.filter((l) => l.lossDps > 0).slice(0, options.targets ?? 6);
  for (const l of targets) {
    const w = winOf.get(l.window);
    if (!w) continue;
    const target = { window: l.window, multiplier: l.multiplier };
    const wCues = windowCues(w);
    const giver = l.giver ? { operator: l.giver.split(":")[0] as string, cast: l.giver.split(":")[1] as string } : null;
    // Another operator's press, or the window operator's own ultimate for a window its ultimate doesn't start (Si's Amp on her combos).
    const trigger0 = windowTrigger(w, s);
    const actionable =
      giver !== null &&
      (giver.operator !== w.operator ? giver.cast === "ultimate" || giver.cast === "battle" || giver.cast === "combo" : giver.cast === "ultimate" && trigger0 !== null && trigger0.cast !== "ultimate");
    const why = `for ${l.label} on ${w.label}`;
    if (actionable && giver) {
      const gcast = giver.cast as PolicyStep["cast"];
      const gStep = { operator: giver.operator, cast: gcast };
      const idx = list.rules.map((r, i) => (pressesFirst(r, giver.operator, gcast) ? i : -1)).filter((i) => i >= 0);
      const wUlt: PolicyCue | null = has(data, w.operator, "ultimate") && giver.operator !== w.operator ? { ultimate: w.operator } : null;
      // Hold the giver for the window's cue (alone, or with the window operator's ultimate ready).
      for (const c of wCues) {
        const variants: PolicyCue[][] = [[c]];
        if (wUlt && cueKey(wUlt) !== cueKey(c)) variants.push([c, wUlt]);
        for (const v of variants) {
          const hold = anyOf(v);
          if (idx.length === 0 || idx.every((i) => mentions((list.rules[i] as PolicyRule).when, hold))) continue;
          push({ list: withRules(list.rules.map((r, i) => (idx.includes(i) && !mentions(r.when, hold) ? { ...r, when: andCue(r.when, hold) } : r))), kind: "hold-giver", text: `${describeStep(data, gStep)} waits until ${cueWords(hold)} (${why})`, target });
        }
      }
      // Chain: when both ultimates are ready, the giver's then the window's (alone, and with the giver held for the window's cue).
      if (gcast === "ultimate" && wUlt) {
        const chain: PolicyRule = { when: { all: [{ ultimate: giver.operator }, { ultimate: w.operator }] }, do: [gStep, { operator: w.operator, cast: "ultimate" }] };
        if (!list.rules.some((r) => JSON.stringify(r) === JSON.stringify(chain))) {
          push({ list: withRules([chain, ...list.rules]), kind: "chain", text: `New first rule: when ${name(giver.operator)}'s and ${name(w.operator)}'s ultimates are both ready: ${name(giver.operator)}'s ultimate, then ${name(w.operator)}'s (${why})`, target });
          const c = wCues[0];
          if (c && idx.length) {
            const hold = anyOf([c, ...(cueKey(c) !== cueKey(wUlt) ? [wUlt] : [])]);
            push({
              list: withRules([chain, ...list.rules.map((r, i) => (idx.includes(i) && !mentions(r.when, hold) ? { ...r, when: andCue(r.when, hold) } : r))]),
              kind: "chain",
              text: `New first rule: both ultimates ready: ${name(giver.operator)}'s, then ${name(w.operator)}'s; otherwise ${name(giver.operator)}'s waits until ${cueWords(hold)} (${why})`,
              target,
            });
          }
        }
      }
      // The giver's rule one place up.
      for (const i of idx.slice(0, 1)) {
        if (i === 0) continue;
        const rules = [...list.rules];
        [rules[i - 1], rules[i]] = [rules[i] as PolicyRule, rules[i - 1] as PolicyRule];
        push({ list: withRules(rules), kind: "move-up", text: `${describeStep(data, gStep)}'s rule one place up, to ${i} (${why})`, target });
      }
    }
    // Start the window when the multiplier is up.
    const trig = windowTrigger(w, s);
    if (trig && (giver === null || giver.operator !== w.operator)) {
      const all = list.rules.map((r, i) => (pressesFirst(r, trig.operator, trig.cast) ? i : -1)).filter((i) => i >= 0);
      // Of several rules pressing that button, those that read the window's own cue (Laevatain's battle skill in Twilight, not her plain one).
      const own = all.filter((i) => wCues.some((c) => mentions((list.rules[i] as PolicyRule).when, c)));
      const idx = own.length ? own : all;
      for (const mc of multiplierCues(l.multiplier, s)) {
        const hold = mc;
        if (idx.length === 0 || idx.every((i) => mentions((list.rules[i] as PolicyRule).when, hold))) continue;
        push({ list: withRules(list.rules.map((r, i) => (idx.includes(i) && !mentions(r.when, hold) ? { ...r, when: andCue(r.when, hold) } : r))), kind: "start-window", text: `${describeStep(data, trig)} waits until ${cueWords(hold)} (${why})`, target });
      }
    }
  }
  // Save SP for an SP-gated window (a battle skill) by its visible cue: other operators' battle skills wait while it holds.
  for (const w of s.windows.slice(0, 3)) {
    if (w.kind !== "battle") continue;
    const c = windowCues(w).find((x) => "buff" in x);
    if (!c) continue;
    const idx = list.rules.map((r, i) => (stepsOf(r).some((x) => x.cast === "battle" && x.operator !== w.operator) && stepsOf(r).length === 1 && !mentions(r.when, c) ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) continue;
    push({ list: withRules(list.rules.map((r, i) => (idx.includes(i) ? { ...r, when: andCue(r.when, { not: c }) } : r))), kind: "save-sp", text: `Other operators' battle skills wait while ${cueWords(c)} (SP saved for ${w.label})` });
  }
  // A press whose button changes, only when it shows its first skill.
  list.rules.forEach((r, i) => {
    const st = stepsOf(r);
    st.forEach((x, j) => {
      if (x.shows !== undefined || !(x.cast === "battle" || x.cast === "combo" || x.cast === "ultimate")) return;
      const labels = (data.kits.operators[x.operator]?.skills ?? []).filter((k) => k.kind === x.cast && !k.followUpOnly).map((k) => k.label ?? k.skillId);
      if (labels.length < 2) return;
      const label = labels[0] as string;
      const rules = [...list.rules];
      rules[i] = { ...r, do: st.map((y, k) => (k === j ? { ...y, shows: label } : y)) };
      push({ list: withRules(rules), kind: "shows", text: `Rule ${i + 1}: ${describeStep(data, x)} only if its button shows ${label}` });
    });
  });
  // Spare SP at the cap: a last rule spends it.
  if (s.spAtCapShare > 0.03) {
    for (const op of new Set(list.rules.flatMap((r) => stepsOf(r)).map((x) => x.operator))) {
      if (!has(data, op, "battle")) continue;
      const rule: PolicyRule = { when: { sp: { atLeast: 200 } }, do: { operator: op, cast: "battle" } };
      push({ list: withRules([...list.rules, rule]), kind: "spare-sp", text: `New last rule: SP at least 200: ${name(op)}'s battle skill (SP at the cap ${(s.spAtCapShare * 100).toFixed(0)}% of the fight)` });
    }
  }
  const max = options.max ?? 28;
  const guided = out.slice(0, max);
  // The rule search's random moves, as a complement.
  if (options.randomEdit && options.rng) {
    for (let i = 0, made = 0; made < (options.random ?? 4) && i < 40; i++) {
      const l2 = options.randomEdit(options.rng, list);
      const k = JSON.stringify(l2);
      if (keys.has(k)) continue;
      keys.add(k);
      guided.push({ list: l2, kind: "random", text: "A random edit (the rule search's moves)" });
      made++;
    }
  }
  return guided;
}

// --- Judging an edit ------------------------------------------------------------------------------------------

export interface EditJudgement {
  /** Mean relative change of sustained DPS over the paired seeds, and its standard error (the per-seed differences' sample sd / √n, over the base's mean). */
  readonly gain: number;
  readonly se: number;
  /** The same over the seeds after the screening ones only (not used to pick the edit: free of the pick's bias). */
  readonly freshGain: number;
  readonly freshSe: number;
  readonly seeds: number;
  /** Kept: the gain beyond twice its standard error and at least `minGain`, and positive on the fresh seeds. */
  readonly pass: boolean;
}

/** A paired relative change over common seeds: mean difference / base mean, and its standard error. */
export function pairedGain(base: readonly number[], other: readonly number[]): { readonly gain: number; readonly se: number } {
  const n = Math.min(base.length, other.length);
  if (n === 0) return { gain: 0, se: Infinity };
  const d = Array.from({ length: n }, (_, i) => (other[i] as number) - (base[i] as number));
  const b = base.slice(0, n).reduce((a, x) => a + x, 0) / n;
  const m = d.reduce((a, x) => a + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)) : Infinity;
  return { gain: m / b, se: sd / Math.sqrt(n) / b };
}

/**
 * The guided search's acceptance rule (docs/design.md "Rule-based rotations", the guided search): an edit screened
 * on the first `screenSeeds` seeds and played on more is kept when its paired gain over all of them exceeds twice its
 * standard error and `minGain` (default 0.2%), and is positive on the seeds after the screening ones alone (the pick
 * of the best screened edit biases its screening seeds up).
 */
export function judgeEdit(base: readonly number[], other: readonly number[], screenSeeds: number, minGain = 0.002): EditJudgement {
  const all = pairedGain(base, other);
  const fresh = pairedGain(base.slice(screenSeeds), other.slice(screenSeeds));
  const n = Math.min(base.length, other.length);
  const freshOk = n <= screenSeeds || fresh.gain > 0;
  return { gain: all.gain, se: all.se, freshGain: fresh.gain, freshSe: fresh.se, seeds: n, pass: all.gain > 2 * all.se && all.gain >= minGain && freshOk };
}
