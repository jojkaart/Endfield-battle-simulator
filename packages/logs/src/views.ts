// Views of how the log check sees a fight, for diagnosis (`efsim zmdlogs casts | replay | stagger | differences |
// groups`): what agents otherwise rebuilt in three to five scratch scripts each (round-3 friction reports).
//
// - castsView: the placement (logcasts.ts placeHits): logged hits with the cast, slot and frame each was placed at,
//   the log's cast events, the placed casts and their time stops, in time order.
// - replayView: the replay (buffreplay.ts): its landings, each with the logged hit it stands for or "replay only",
//   logged hits without a landing and why, casts it couldn't make or made without the log, its Stagger windows, and
//   chosen kit buffs' windows.
// - staggerView / staggerSummary: per logged Stagger run (consecutive hits listing buff_common_poise_break_*), the
//   replay's window against it and where the engine's own would have ended (BuffReplay.staggerSpans, staggerHolds).
// - differencesReport: where the log's listing and the replay disagree (logDifferences), grouped by what differs, with
//   the damage's verdict (logged value over the engine's primary reading) per group: does the damage side with the
//   log or the replay?
// - groupsReport: one operator's mismatches grouped: by skill event, by what the log and replay disagree on, and
//   whether a teammate mismatches at the same ratio nearby (team-wide, so not this operator's kit).
// The last two read hit records (hitexport.ts), so they run on worker threads with --workers like `zmdlogs hits`.

import { effectiveKit, FPS, parseReactionEvent, type GameData, type LandedHit } from "@efsim/engine";
import { loggedCastFates, type BuffReplay } from "./buffreplay.ts";
import type { HitRecord } from "./hitexport.ts";
import type { PlacedHolds } from "./holds.ts";
import { castTimeStops, distinctCasts, placeHits } from "./logcasts.ts";
import { corrosionRamp, logBuffReplay } from "./logcheck.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";

/** A time window and operator filter of a view (ms; operator ids). */
export interface ViewFilter {
  readonly from?: number;
  readonly to?: number;
  readonly operators?: readonly string[];
}

const msOf = (frames: number) => (frames * 1000) / FPS;
const s = (ms: number) => (ms / 1000).toFixed(2);
const inWindow = (f: ViewFilter, t: number) => t >= (f.from ?? -Infinity) && t <= (f.to ?? Infinity);
const mine = (f: ViewFilter, op: string) => !f.operators?.length || f.operators.includes(op);

/** An operator's short label: its name, else its id without the chr_NNNN_ prefix. */
function label(data: GameData, op: string): string {
  return data.operators[op]?.name ?? op.replace(/^chr_\d+_/, "");
}
const shortSkill = (id: string) => id.replace(/^chr_\d+_[a-z0-9]+_/, "");

type Line = { readonly t: number; readonly order: number; readonly text: string };
const render = (lines: Line[]) =>
  lines
    .sort((a, b) => a.t - b.t || a.order - b.order)
    .map((l) => `${s(l.t).padStart(7)}  ${l.text}`)
    .join("\n");

/** `zmdlogs casts`: the placement of a fight in time order (hits, cast events, placed casts, time stops). */
export function castsView(data: GameData, fx: LogFixture, f: ViewFilter = {}): string {
  const placement = placeHits(data, fx);
  const lines: Line[] = [];
  for (const c of fx.casts ?? []) if (inWindow(f, c.t) && mine(f, c.operator)) lines.push({ t: c.t, order: 0, text: `EVENT  ${label(data, c.operator)} ${shortSkill(c.skill)} (the log's cast event)` });
  for (const c of distinctCasts(placement)) {
    if (!inWindow(f, c.start) || !mine(f, c.operator)) continue;
    lines.push({ t: c.start, order: 1, text: `CAST   ${label(data, c.operator)} ${shortSkill(c.group)}${c.kind ? ` (${c.kind})` : ""} key ${shortSkill(c.key)}` });
  }
  for (const st of castTimeStops(data, placement.casts)) {
    const [a, z] = [msOf(st.start), msOf(st.start + st.scales.length)];
    if (z < (f.from ?? -Infinity) || a > (f.to ?? Infinity)) continue;
    const zero = st.scales.filter((x) => x === 0).length;
    lines.push({ t: a, order: 2, text: `STOP   ${label(data, st.operator)} ${shortSkill(st.skillId)} ${s(a)}–${s(z)} s (${zero} of ${st.scales.length} frames at 0, lowest scale ${Math.min(...st.scales).toFixed(2)})` });
  }
  for (const h of fx.hits) {
    if (!inWindow(f, h.t)) continue;
    if (!mine(f, h.operator)) {
      lines.push({ t: h.t, order: 4, text: `  .    ${label(data, h.operator)} ${shortSkill(h.event)}` });
      continue;
    }
    const p = placement.hits.get(h);
    const where = p ? `${shortSkill(p.cast.group)}@${s(p.cast.start)} #${p.index}${p.frame !== undefined ? ` frame ${p.frame}` : ""}${p.sameAs ? " (same landing as another enemy's)" : ""}` : parseReactionEvent(h.event) ? "a status event" : "unplaced";
    lines.push({ t: h.t, order: 3, text: `HIT    ${label(data, h.operator)} ${shortSkill(h.event)} ${h.value} → ${where}` });
  }
  return [`${fx.id}: placement (logcasts.ts placeHits); times in s, EVENT the log's cast events, CAST the casts as placed (start = first landing less its frame)`, render(lines)].join("\n");
}

/** The replay's landing of each logged hit (the hit it stands for), as the log check finds it. */
function landingsOf(replay: BuffReplay, fx: LogFixture): { byLanding: Map<LandedHit, LogHit>; missing: Map<LogHit, string> } {
  const byLanding = new Map<LandedHit, LogHit>();
  const missing = new Map<LogHit, string>();
  for (const h of fx.hits) {
    const l = parseReactionEvent(h.event) ? replay.statusLanding(h) : replay.landing(h);
    if ("unknown" in l) missing.set(h, l.unknown);
    else byLanding.set(l, h);
  }
  return { byLanding, missing };
}

/**
 * `zmdlogs replay`: the replay of a fight in time order: its landings (with the logged hit each stands for, or
 * "replay only"), logged hits without a landing and why, failed and missed casts, Stagger windows, and the windows of
 * the kit buffs named (`owner:id`, at the owner unless `@operator` follows); under other readings of open assumptions
 * with `assume` (as `zmdlogs check --assume`).
 */
export function replayView(data: GameData, fx: LogFixture, f: ViewFilter & { readonly buffs?: readonly string[]; readonly trace?: readonly string[]; readonly assume?: Readonly<Record<string, string>> } = {}): string {
  const { replay } = logBuffReplay(data, fx, undefined, { ...(f.assume && Object.keys(f.assume).length ? { assume: f.assume } : {}), ...(f.trace?.length ? { trace: f.trace } : {}) });
  const { byLanding, missing } = landingsOf(replay, fx);
  const lines: Line[] = [];
  for (const l of replay.hits) {
    const t = msOf(l.frame);
    if (!inWindow(f, t) || !mine(f, l.operator)) continue;
    const h = byLanding.get(l);
    const what = h ? `= logged ${shortSkill(h.event)} ${h.value} at ${s(h.t)}${h.t !== Math.round(t) ? ` (${Math.round(h.t - t) > 0 ? "+" : ""}${Math.round(h.t - t)} ms)` : ""}` : "replay only";
    lines.push({ t, order: 2, text: `LAND   ${label(data, l.operator)} ${shortSkill(l.skillId)} ${l.hitId} ${l.damage}${l.count > 1 ? ` ×${l.count}` : ""} ${what}` });
  }
  for (const [h, why] of missing) if (inWindow(f, h.t) && mine(f, h.operator)) lines.push({ t: h.t, order: 3, text: `NOLAND ${label(data, h.operator)} ${shortSkill(h.event)} ${h.value}: ${why}` });
  for (const x of replay.failed) if (inWindow(f, x.cast.start) && mine(f, x.cast.operator)) lines.push({ t: x.cast.start, order: 1, text: `FAILED ${label(data, x.cast.operator)} ${shortSkill(x.cast.skillId)}: ${x.error}` });
  for (const m of replay.missed) if (inWindow(f, m.start) && mine(f, m.operator)) lines.push({ t: m.start, order: 1, text: `MISSED ${label(data, m.operator)} ${shortSkill(m.skillId)} made for ${shortSkill(m.need.skillId)}@${s(m.need.start)} (a cast that hits nothing, which the log can't show)` });
  // The log's cast events and what the cast assembly made of each (loggedCastFates).
  for (const e of loggedCastFates(data, fx)) {
    if (!inWindow(f, e.t) || !mine(f, e.operator)) continue;
    const what =
      e.fate === "placed" && e.cast
        ? `the placed cast's at ${s(e.cast.start)} s (${s(e.cast.world)} s of world time apart)`
        : e.fate === "tick"
          ? `a tick of ${e.buff} (KitBuff.ticksLoggedAs)`
          : e.fate === "press"
            ? "a press of its own (the skill's hits show elsewhere: a slot press)"
            : e.fate === "cast"
              ? "a cast of its own (no hit of the skill in the log)"
              : e.fate === "follow-up"
                ? "a follow-up-only skill: left to the engine"
                : "no kit skill of that id: ignored";
    lines.push({ t: e.t, order: 1, text: `EVENT  ${label(data, e.operator)} ${shortSkill(e.skill)} (the log's cast event): ${what}` });
  }
  for (const x of replay.castFlags) {
    const t = msOf(x.frame);
    if (inWindow(f, t) && mine(f, x.cast.operator)) lines.push({ t, order: 1, text: `${x.kind === "forced" ? "FORCED" : "INSIDE"} ${label(data, x.cast.operator)} ${shortSkill(x.skillId)} made against its kit: ${x.why}` });
  }
  for (const x of replay.traces) {
    const t = msOf(x.frame);
    if (!inWindow(f, t)) continue;
    const exp = (v: number | null) => (v === null ? "none" : v === Infinity ? "never" : `${s(msOf(v))} s`);
    const moved = x.from !== null && x.to !== null ? ` (${x.to - x.from > 0 ? "+" : ""}${x.to - x.from} frames)` : "";
    lines.push({ t, order: 0, text: `TRACE  ${x.buff} from ${s(msOf(x.appliedAt))}: expiry ${exp(x.from)} → ${exp(x.to)}${moved} at ${x.step}` });
  }
  for (const w of replay.staggerSpans) {
    const [a, z] = [msOf(w.start), msOf(w.end)];
    if (z >= (f.from ?? -Infinity) && a <= (f.to ?? Infinity)) lines.push({ t: a, order: 0, text: `STAGGER the replay's window ${s(a)}–${s(z)} s` });
  }
  for (const spec of f.buffs ?? []) {
    const [buff, at] = spec.split("@") as [string, string | undefined];
    const operator = at ?? buff.split(":")[0] ?? "";
    for (const w of replay.kitWindows(buff, operator)) {
      if (w.end < (f.from ?? -Infinity) || w.start > (f.to ?? Infinity)) continue;
      lines.push({ t: w.start, order: 0, text: `BUFF   ${buff} at ${label(data, operator)} ${s(w.start)}–${w.end === Infinity ? "end" : s(w.end)}${w.expired ? " (ran out)" : ""}` });
    }
  }
  const forced = replay.castFlags.filter((x) => x.kind === "forced").length;
  const inside = replay.castFlags.length - forced;
  const flagged = replay.castFlags.length ? `${forced} cast(s) FORCED against the kit's availability and ${inside} INSIDE another action's uncuttable frames: the replay's state may be wrong from each on. ` : "";
  const head = `${fx.id}: the replay (buffreplay.ts); times in s. ${replay.brokenAt !== null ? `It stopped at ${s(msOf(replay.brokenAt))} s. ` : ""}${flagged}LAND its landings, NOLAND logged hits without one, EVENT the log's cast events and what the replay made of each, FAILED / MISSED casts it couldn't make / made without the log${f.trace?.length ? ", TRACE each change of a traced kit buff's expiry and the step that made it" : ""}`;
  return [head, render(lines)].join("\n");
}

const isStaggered = (h: Pick<LogHit, "effects">) => h.effects.some((e) => /poise_break/.test(e.buff));

/** A logged Stagger run against the replay: the log's first and last Staggered hit, the next hit, the replay's window and the engine's own end (ms). */
export interface StaggerRun {
  readonly start: number;
  readonly last: number;
  /** The first hit after the run (null: the fight ended Staggered). */
  readonly next: number | null;
  /** The replay's windows overlapping the run (ms). */
  readonly replay: readonly { readonly start: number; readonly end: number }[];
  /** Where the engine's own Stagger would have ended, where the replay held it past that for the log (null: none held; "none": it had none running). */
  readonly engineEnd: number | "none" | null;
  /** Where the log's calm hit ended the run while the engine's own Stagger still ran: when the engine's would have ended (ms; null: it didn't). */
  readonly engineCut: number | null;
  /** The Stagger dealt during the run (each logged event once). */
  readonly dealt: number;
}

/** Every logged Stagger run of a fight with the replay's windows and the engine's own ends (`assume`: readings of open assumptions to replay under, TimelineOptions.assume). */
export function staggerRuns(data: GameData, fx: LogFixture, opts: { readonly assume?: Readonly<Record<string, string>> } = {}): StaggerRun[] {
  const { replay } = logBuffReplay(data, fx, undefined, opts);
  const spans = replay.staggerSpans.map((w) => ({ start: msOf(w.start), end: msOf(w.end) }));
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const out: StaggerRun[] = [];
  for (let i = 0; i < hits.length; i++) {
    if (!isStaggered(hits[i] as LogHit) || (i > 0 && isStaggered(hits[i - 1] as LogHit))) continue;
    let k = i;
    while (k + 1 < hits.length && isStaggered(hits[k + 1] as LogHit)) k++;
    const [a, b] = [(hits[i] as LogHit).t, (hits[k] as LogHit).t];
    const holds = replay.staggerHolds.filter((h) => msOf(h.frame) >= a - 100 && msOf(h.frame) <= b);
    const own = holds.find((h) => h.engineUntil !== null);
    const seen = new Set<string>();
    let dealt = 0;
    for (const x of hits.slice(i, k + 1)) {
      if (!x.poise) continue;
      const key = `${x.t}|${x.poise.origin ?? x.event}|${x.poise.dealt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dealt += x.poise.dealt;
    }
    out.push({
      start: a,
      last: b,
      next: hits[k + 1]?.t ?? null,
      replay: spans.filter((w) => w.end > a - 2000 && w.start < b),
      engineEnd: own ? msOf(own.engineUntil as number) : holds.length ? "none" : null,
      engineCut: ((c) => (c ? msOf(c.engineUntil) : null))(replay.staggerCuts.find((c) => msOf(c.frame) >= b && msOf(c.frame) <= (hits[k + 1]?.t ?? b) + 100)),
      dealt,
    });
    i = k;
  }
  return out;
}

/** `zmdlogs stagger`: a fight's Stagger runs, the log's against the replay's. */
export function staggerView(data: GameData, fx: LogFixture): string {
  const runs = staggerRuns(data, fx);
  const input = attackInputKeys(data, fx);
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const lines = runs.map((r) => {
    // Each run's Finishers (their hits up to 1.5 s past its last Staggered hit: the second one may land after) and the
    // enhanced basic attacks landed in it (in-game test 108: no Finisher while one is the input).
    const fin = hits.filter((h) => h.t >= r.start && h.t <= r.last + 1500 && input.get(`${h.operator}|${h.event}`) === "finisher");
    const enh = new Map<string, LogHit[]>();
    for (const h of hits) if (h.t >= r.start && h.t <= r.last && input.get(`${h.operator}|${h.event}`) === "enhanced") enh.set(h.operator, [...(enh.get(h.operator) ?? []), h]);
    const name = (op: string) => data.operators[op]?.name ?? op;
    const attacks = `; ${fin[0] ? `Finisher ${s(fin[0].t)} (${name(fin[0].operator)})` : "no Finisher"}${[...enh].map(([op, hs]) => `, ${name(op)}'s enhanced basic hits ${hs.length} (${s((hs[0] as LogHit).t)}–${s((hs.at(-1) as LogHit).t)})`).join("")}`;
    return staggerLine(r) + attacks;
  });
  return [`${fx.id} (${fx.enemy.id}): ${runs.length} logged Stagger run(s), the log's (first–last Staggered hit) against the replay's windows (times in s), with the Finisher and enhanced basic attacks in each`, ...lines].join("\n");
}

/**
 * The team's basic-attack event keys (`operator|event`) of a Finisher (skillSpecification 8) and of an enhanced basic
 * attack (skillSpecification 1 in the battle skill's or ultimate's skill group: engine timing.ts enhancedBasic).
 */
function attackInputKeys(data: GameData, fx: LogFixture): Map<string, "finisher" | "enhanced"> {
  const out = new Map<string, "finisher" | "enhanced">();
  for (const b of fx.team) {
    for (const k of effectiveKit(data, b)?.skills ?? []) {
      if (k.kind !== "basic") continue;
      const spec = data.skills[k.skillId]?.timing?.specification;
      const cls = spec === 8 ? "finisher" : spec === 1 && (data.operators[b.operator]?.skillGroups[k.skillId] ?? "basic") !== "basic" ? "enhanced" : null;
      if (cls) for (const h of k.hits) for (const e of h.events) out.set(`${b.operator}|${e}`, cls);
    }
  }
  return out;
}

/** One Stagger run against the replay's windows and the engine's own end. */
function staggerLine(r: StaggerRun): string {
  const first = r.replay[0];
  const gap = first ? r.last - first.end : 0;
  const short = first ? `; the replay's first window ends ${s(Math.abs(gap))} s ${gap >= 0 ? "before" : "after"} the log's last Staggered hit` : "";
  const engine = r.engineEnd === null ? (r.engineCut !== null ? `the engine's own would have run to ${s(r.engineCut)} (cut by the log's calm hit)` : "the engine's own covered it") : r.engineEnd === "none" ? "the engine had none running (held for the log)" : `the engine's own ended ${s(r.engineEnd)} (held for the log)`;
  return `  log ${s(r.start)}–${s(r.last)}${r.next === null ? " (to the fight's end)" : ` (next hit ${s(r.next)})`}, Stagger dealt ${r.dealt}: replay ${r.replay.map((w) => `${s(w.start)}–${s(w.end)}`).join(", ") || "none"}${short}; ${engine}`;
}

const quartiles = (xs: readonly number[], digits = 3) => {
  if (!xs.length) return "-";
  const v = [...xs].sort((a, b) => a - b);
  const q = (p: number) => (v[Math.floor(p * (v.length - 1))] as number).toFixed(digits);
  return `${q(0.25)} ${q(0.5)} ${q(0.75)}`;
};

/** Over many fights: how the replay's Stagger ends compare with the log's (each fight's runs from staggerRuns). */
export function staggerSummary(runs: readonly StaggerRun[]): string {
  const ended = runs.filter((r) => r.next !== null);
  const short = ended.flatMap((r) => (typeof r.engineEnd === "number" ? [(r.last - r.engineEnd) / 1000] : []));
  const none = ended.filter((r) => r.engineEnd === "none").length;
  const noReplay = runs.filter((r) => !r.replay.length).length;
  return `${runs.length} logged Stagger runs: the engine's own ran short in ${short.length} (shortfall quartiles ${quartiles(short, 2)} s), had none running in ${none}, and the replay had no window at all in ${noReplay}`;
}

/** A record's ratio: logged value over the engine's primary reading (null without one). */
const ratioOf = (r: HitRecord) => (r.predicted ? r.value / r.predicted : null);

/**
 * `zmdlogs differences`: the logged hits where the log's listing and the replay disagree (HitRecord.differences),
 * grouped by what differs and which side has it, each with its count, its mismatches and the quartiles of the logged
 * value over the engine's primary reading: a group whose damage follows the log (×1.3 where the log alone lists
 * Stagger) says the replay is wrong, one at ×1.000 that the log's listing is. Hits without a difference are the
 * baseline row.
 */
export function differencesReport(records: readonly HitRecord[], opts: { readonly what?: RegExp; readonly hits?: boolean; readonly fixtureLabel?: (fixture: string) => string } = {}): string {
  const groups = new Map<string, { n: number; mismatch: number; ratios: number[]; hits: string[] }>();
  const add = (key: string, r: HitRecord, detail: string) => {
    const g = groups.get(key) ?? { n: 0, mismatch: 0, ratios: [], hits: [] };
    g.n++;
    if (r.class === "mismatch") g.mismatch++;
    const q = ratioOf(r);
    if (q !== null) g.ratios.push(q);
    if (opts.hits) g.hits.push(`    ${(opts.fixtureLabel ?? ((x: string) => x))(r.fixture)} ${s(r.t)} ${r.operator} ${r.event} ${r.class} ×${q?.toFixed(4) ?? "-"}${detail ? ` ${detail}` : ""}`);
    groups.set(key, g);
  };
  let baseline = 0;
  for (const r of records) {
    if (r.kind !== "skill" || !r.landing) continue;
    const ds = (r.differences ?? []).filter((d) => !opts.what || opts.what.test(d.what));
    if (!r.differences?.length) {
      if (!opts.what) add("(no difference)", r, "");
      baseline++;
      continue;
    }
    for (const d of ds) add(`${d.what} | ${d.kind === "engine" ? "replay only" : d.kind === "log" ? "log only" : "other values"}`, r, `engine [${d.engine.join(", ")}] log [${d.log.join(", ")}]`);
  }
  const rows = [...groups].sort((a, b) => b[1].n - a[1].n);
  const out = [`Where the log's listing and the replay disagree at kit hits with a landing (${records.length} records, ${baseline} without a difference); ratio = logged value ÷ the engine's primary reading (quartiles):`];
  const w = Math.min(70, Math.max(10, ...rows.map(([k]) => k.length)));
  for (const [k, g] of rows) {
    out.push(`  ${k.padEnd(w)}  ${String(g.n).padStart(5)} hits  ${String(g.mismatch).padStart(5)} mismatches  ratio ${quartiles(g.ratios)}`);
    out.push(...g.hits);
  }
  return out.join("\n");
}

/** How close two ratios count as the same, and how near in time a teammate's mismatch counts as nearby, for groupsReport. */
const SAME_RATIO = 0.015;
const NEAR_MS = 1500;

/**
 * The matches only the log's listing made (class "fallback") by skill event, each group's median logged ÷ the engine's
 * primary reading: a fallback match counts as a match, so a missing modifier hides behind it (round 5: Perlica's combo
 * hits, "match" at ×1.500 of the primary in three logs, Pulser Labs' +0.5 missing from the applying hit). A constant
 * ratio away from 1 is a modifier the replay lacks or has too much of.
 */
export function fallbackGroups(records: readonly HitRecord[]): string[] {
  const groups = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.class !== "fallback") continue;
    const k = shortSkill(r.event).replace(/\d+$/, "");
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (r.predicted) groups.set(k, [...(groups.get(k) ?? []), r.value / r.predicted]);
  }
  if (!counts.size) return ["Matches only by the log's listing (fallback): none"];
  const median = (xs: readonly number[]) => (xs.length ? ([...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] as number) : null);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [
    `Matches only by the log's listing (fallback: counted as matches, though the replay's reading is off), ${total} by skill event, with the median logged ÷ primary (a constant ratio: a modifier the replay lacks):`,
    ...[...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => {
        const m = median(groups.get(k) ?? []);
        return `  ${String(n).padStart(5)}  ${k}  median logged ÷ primary ${m === null ? "- (no primary reading)" : `×${m.toFixed(3)}`}`;
      }),
  ];
}

/**
 * `zmdlogs groups --operator`: an operator's mismatches sorted into causes. Per log: its hits, mismatches, those a
 * teammate shares (a teammate's mismatch at the same ratio within NEAR_MS: a team-wide factor, not this kit), those
 * without a landing; then the operator's own mismatches by skill event and by what the log and replay disagree on, each
 * with its median ratio.
 */
export function groupsReport(records: readonly HitRecord[], operator: string, opts: { readonly verbose?: boolean; readonly fixtureLabel?: (fixture: string) => string } = {}): string {
  const fxLabel = opts.fixtureLabel ?? ((x: string) => x);
  const byFixture = new Map<string, HitRecord[]>();
  for (const r of records) byFixture.set(r.fixture, [...(byFixture.get(r.fixture) ?? []), r]);
  const own: { r: HitRecord; q: number | null }[] = [];
  const perLog: string[] = [];
  let [hits, mism, team, noLanding] = [0, 0, 0, 0];
  for (const [fixture, rs] of byFixture) {
    const ops = rs.filter((r) => r.operator === operator);
    if (!ops.length) continue;
    let [m, tw, nl] = [0, 0, 0];
    for (const r of ops) {
      if (r.class !== "mismatch") continue;
      m++;
      const q = ratioOf(r);
      if (!r.landing) {
        nl++;
        own.push({ r, q });
        continue;
      }
      const shared = q !== null && rs.some((o) => o.operator !== operator && o.class === "mismatch" && Math.abs(o.t - r.t) <= NEAR_MS && (ratioOf(o) ?? 0) > 0 && Math.abs((ratioOf(o) as number) / q - 1) < SAME_RATIO);
      if (shared) tw++;
      else own.push({ r, q });
    }
    hits += ops.length;
    mism += m;
    team += tw;
    noLanding += nl;
    perLog.push(`  ${fxLabel(fixture)}  ${String(ops.length).padStart(5)} hits  ${String(m).padStart(4)} mismatches  ${String(tw).padStart(4)} team-wide  ${String(nl).padStart(4)} no landing  ${String(m - tw - nl).padStart(4)} own`);
  }
  const median = (xs: number[]) => (xs.length ? ([...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] as number).toFixed(3) : "-");
  const by = (key: (x: { r: HitRecord; q: number | null }) => string[]) => {
    const g = new Map<string, number[]>();
    const n = new Map<string, number>();
    for (const x of own) {
      for (const k of key(x)) {
        n.set(k, (n.get(k) ?? 0) + 1);
        if (x.q !== null) g.set(k, [...(g.get(k) ?? []), x.q]);
      }
    }
    return [...n].sort((a, b) => b[1] - a[1]).map(([k, c]) => `  ${String(c).padStart(5)}  ${k}  median ratio ${median(g.get(k) ?? [])}`);
  };
  const event = (r: HitRecord) => shortSkill(r.event).replace(/\d+$/, "");
  const out = [
    `${operator}: ${hits} hits in ${perLog.length} logs, ${mism} mismatches: ${team} team-wide (a teammate mismatches at the same ratio ±${100 * SAME_RATIO}% within ${NEAR_MS / 1000} s), ${noLanding} without a landing, ${mism - team - noLanding} own`,
    ...perLog,
    "",
    "Own mismatches (not team-wide) by skill event:",
    ...by(({ r }) => [event(r)]),
    "",
    "Own mismatches by where the log and the replay disagree (none: they agree on every buff they both model):",
    ...by(({ r }) => (r.differences?.length ? r.differences.map((d) => `${d.what} (${d.kind === "engine" ? "replay only" : d.kind === "log" ? "log only" : "other values"})`) : [r.landing ? "none" : `no landing: ${r.unknown ?? "?"}`])),
    "",
    ...fallbackGroups(records.filter((r) => r.operator === operator)),
  ];
  if (opts.verbose) {
    out.push("", "Each own mismatch:");
    for (const { r, q } of own) out.push(`  ${fxLabel(r.fixture)} ${s(r.t)} ${r.event} logged ${r.value} predicted ${r.predicted ?? "-"} ×${q?.toFixed(4) ?? "-"}${r.differences?.length ? `  ${r.differences.map((d) => `${d.kind}:${d.what}`).join("; ")}` : ""}`);
  }
  return out.join("\n");
}

/** How much of a placed hold a unit is: a perfect dodge's world slow-down (BuffData, 0.512 s). */
const HOLD_UNIT_MS = 512;

/** A clock's earliest or latest P at a time (ms, linear between nodes), and the time P first reaches a mass. */
function clockAt(h: PlacedHolds, P: readonly number[], t: number): number {
  let i = 1;
  while (i < h.times.length - 1 && (h.times[i] as number) < t) i++;
  const [t0, t1, p0, p1] = [h.times[i - 1] as number, h.times[i] as number, P[i - 1] as number, P[i] as number];
  return t1 === t0 ? p1 : p0 + (p1 - p0) * Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
}
function clockReaches(h: PlacedHolds, P: readonly number[], m: number): number {
  const i = P.findIndex((x) => x >= m - 1e-6);
  if (i <= 0) return h.times[0] as number;
  const [t0, t1, p0, p1] = [h.times[i - 1] as number, h.times[i] as number, P[i - 1] as number, P[i] as number];
  return p1 === p0 ? t1 : t0 + ((m - p0) / (p1 - p0)) * (t1 - t0);
}

/**
 * `zmdlogs holds`: the fight's hidden holds the replay places (engine assumption hidden-holds, reading `placed`:
 * holds.ts placeHolds): the least total, each dodge-sized unit of it with its earliest and latest time and the clocks
 * spanning it (a buff's run, a tick series), the bounds dropped as conflicting, and (with `verbose`) every bound.
 */
export function holdsView(data: GameData, fx: LogFixture, opts: { readonly verbose?: boolean } = {}): string {
  const r = logBuffReplay(data, fx, placeHits(data, fx), { assume: { "hidden-holds": "placed" } }).replay;
  const h = r.hiddenHolds;
  if (!h) return `${fx.id}: no holds placed (no kit to replay)`;
  const series = (tag: string) => tag.replace(/ [0-9]+[→⇒][0-9]+ ms$/, "");
  const lines = [`${fx.id}: ${s(h.total)} s of hidden holds placed (the least total the clocks allow; ${Math.round(h.total / HOLD_UNIT_MS)} perfect dodges' worth at 0.512 s), ${new Set(h.kept.filter((b) => b.kind === "run").map((b) => b.tag)).size} buff runs and ${new Set(h.kept.filter((b) => b.kind === "tick").map((b) => series(b.tag))).size} tick series kept, ${h.dropped.length} bound(s) dropped; times in s`];
  for (let m = HOLD_UNIT_MS / 2; m < h.total; m += HOLD_UNIT_MS) {
    const [early, late, mid] = [clockReaches(h, h.early, m), clockReaches(h, h.late, m), clockReaches(h, h.mid, m)];
    const clocks = [...new Set(h.kept.filter((b) => b.a <= early && late <= b.b).map((b) => (b.kind === "run" ? b.tag : series(b.tag))))];
    lines.push(`  unit ${s(m)} s: placed at ${s(mid)} (earliest ${s(early)}, latest ${s(late)}), ${clocks.length} clock(s) span it${opts.verbose && clocks.length ? `: ${clocks.join("; ")}` : ""}`);
  }
  for (const b of h.dropped) lines.push(`  dropped: ${b.tag} (asks ${b.ex.toFixed(2)} s)`);
  if (opts.verbose) for (const b of h.kept) lines.push(`  bound: ${b.tag}: P(${s(b.b)}) − P(${s(b.a)}) in [${Number.isFinite(b.min) ? s(b.min) : "−∞"}, ${Number.isFinite(b.max) ? s(b.max) : "∞"}] s; placed ${s(clockAt(h, h.mid, b.b) - clockAt(h, h.mid, b.a))}`);
  return lines.join("\n");
}

/**
 * `zmdlogs ramp`: Corrosion's ramp as the logged hits read it (rampsteps.ts rampSteps, at the replay's landings): per
 * Corrosion the log lists (its applier and application), each hit's steps that fit against the replay's own step, and
 * the hidden hold that reading allows between the application and the hit (P(hit) − P(since), s) beside the one the
 * replay placed. A hit outside its range says the placed holds miss the ramp there (`!`). `verbose`: every hit, not only
 * those where the log's step differs from the replay's or the placed hold falls outside.
 */
export function rampView(data: GameData, fx: LogFixture, opts: { readonly verbose?: boolean } = {}): string {
  const placement = placeHits(data, fx);
  const { replay } = logBuffReplay(data, fx, placement);
  const steps = corrosionRamp(data, fx, placement, replay);
  const h = replay.hiddenHolds;
  if (steps.length === 0) return `${fx.id}: no hit under the log's Corrosion reads a step (none listed, no landing with the replay's Corrosion, or no step fits)`;
  const lines = [`${fx.id}: ${steps.length} hits read Corrosion's ramp (steps: whole seconds of its world time; hold: P(hit) − P(since) in s, as the steps allow and as placed)`];
  const by = new Map<string, typeof steps>();
  for (const x of steps) by.set(`${x.source}|${x.since}`, [...(by.get(`${x.source}|${x.since}`) ?? []), x]);
  for (const [k, list] of by) {
    const [source, since] = k.split("|") as [string, string];
    const off = list.filter((x) => x.replayStep < x.low || x.replayStep > x.high);
    lines.push(`  Corrosion level ${list[0]?.level} by ${label(data, source)} since ${s(Number(since))}: ${list.length} hits, ${off.length} at another step than the replay's`);
    for (const x of list) {
      const lo = x.capped ? -Infinity : x.world - (x.high + 1) * 1000;
      const hi = x.world - x.low * 1000;
      const placed = h ? clockAt(h, h.mid, x.hit.t) - clockAt(h, h.mid, x.since) : 0;
      const outside = placed < lo - 70 || placed > hi + 70;
      if (!opts.verbose && !outside && x.replayStep >= x.low && x.replayStep <= x.high) continue;
      const steps = `${x.low}${x.high !== x.low ? `–${x.high}` : ""}${x.capped ? "+" : ""}`;
      lines.push(`    ${s(x.hit.t)} ${label(data, x.hit.operator)} ${x.hit.event}: log step ${steps}, replay ${x.replayStep} (${x.reading}); hold ${Number.isFinite(lo) ? s(lo) : "−∞"}…${s(hi)}, placed ${s(placed)}${outside ? " !" : ""}`);
    }
  }
  return lines.join("\n");
}
