// `efsim zmdlogs bursts`: each operator's Arts Bursts, logged against replayed (kit-buff leads report point 3: judging
// Arcane's Will burst buff took joins of the hit tables, the one-sided rows, `replay` greps and `reactions` per fixture
// path, then a probe, scripts/probes/kits/arcane-will-burst.ts, and each burst's cause found by hand).
//
// Per burst, in time order:
// - the logged burst (a hit logged under buff_common_<e>_<e>_triggered) and the replay's burst landing the log check
//   pairs with it (BuffReplay.statusLanding: same operator and element, one assignment by value and time: statuspairs.ts), with the offset;
//   a logged burst without one says why; a replay burst no logged one took is "replay only";
// - its cause on each side: on the replay's, the landing whose infliction set it off, from the burst's own record
//   (StatusEvent `inflictedAt`, engine landing.ts delayBursts; improvement round 14, backlog after round 13 point 2),
//   and on the log's the logged hit that landing stands for; where there is none of those (a burst with no delay, a
//   cause the log has no hit for), the operator's latest hit with an infliction (KitHit.applies) at least the element's
//   burst delay (BattleConstants burstDelayFrames, on the operator's clock) of world time before it, marked "nearest"
//   (the log records no infliction: a candidate, not a certainty); each with the world time between (the replay's
//   casts' stops out: query.ts replayTimeStops);
// - the time stops between the cause and the burst (whose, which skill, frames): a burst delayed across a stop.
// Then per operator: logged bursts, those with a replay landing (the offsets' median), log only, replay only.

import { allActions, effectiveKit, FPS, parseReactionEvent, type ArtsElement, type GameData, type KitHit, type LandedHit, type OperatorKit } from "@efsim/engine";
import { stageNote } from "./enginecheck.ts";
import { logBuffReplay } from "./logcheck.ts";
import { placeHits, worldMs } from "./logcasts.ts";
import { replayTimeStops, type ReplayTimeStop } from "./query.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { operatorLabel, secondsText as s, shortSkill } from "./labels.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;

/** A burst's cause on one side: the hit (logged event or replayed skill and hit), its time and the world time to the burst (ms). */
export interface BurstCause {
  readonly t: number;
  readonly what: string;
  readonly world: number;
  /** From the replay's record of the burst (its infliction's landing, or the logged hit standing for it); absent: the nearest candidate. */
  readonly recorded?: true;
}

/** One Arts Burst of a fight: the log's, the replay's, or both paired. Times in ms. */
export interface BurstRow {
  readonly operator: string;
  readonly element: string;
  readonly logged?: { readonly t: number; readonly value: number; readonly cause: BurstCause | null };
  /** `stage`: the damage under the fixture's stage factor there, as the check reads it (enginecheck.ts stageNote). */
  readonly replay?: { readonly t: number; readonly damage: number; readonly cause: BurstCause | null; readonly stage?: string };
  /** Why a logged burst has no replay landing (BuffReplay.statusLanding). */
  readonly unknown?: string;
  /** The replay's burst comes after the log's last hit (the replay runs on; the totals don't count it). */
  readonly afterLog?: boolean;
  /** The stops between the (earliest) cause and the burst: operator, skill, frames. */
  readonly stops: readonly string[];
}

/** Whether a kit hit inflicts (an `infliction` application, whatever element it resolves to). */
const inflicts = (h: KitHit | undefined) => (h?.applies ?? []).some((a) => a.kind === "infliction");

/** A replay landing's kit hit: a skill's, else a trigger's `hits` action's. */
function kitHitOf(kit: OperatorKit | undefined, l: LandedHit): KitHit | undefined {
  const fromSkill = kit?.skills.find((k) => k.skillId === l.skillId)?.hits.find((h) => h.id === l.hitId);
  if (fromSkill) return fromSkill;
  for (const t of kit?.triggers ?? []) for (const a of allActions(t.do)) if (a.kind === "hits") for (const h of a.hits) if (h.id === l.hitId) return h;
  return undefined;
}

/** Every Arts Burst of a fight, logged against replayed, with each side's likely cause and the stops between. */
export function burstRows(data: GameData, fx: LogFixture, opts: { readonly operators?: readonly string[]; readonly assume?: Readonly<Record<string, string>> } = {}): BurstRow[] {
  const placement = placeHits(data, fx);
  const { replay } = logBuffReplay(data, fx, placement, opts.assume && Object.keys(opts.assume).length ? { assume: opts.assume } : {});
  const stops = replayTimeStops(data, fx, placement);
  const kits = new Map(fx.team.map((b) => [b.operator, effectiveKit(data, b)]));
  const delayMs = (e: string) => msOf(data.constants.burstDelayFrames?.[e as ArtsElement] ?? 0);
  const mine = (op: string) => !opts.operators?.length || opts.operators.includes(op);
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const landings = [...replay.hits].sort((a, b) => a.frame - b.frame);
  const lastLogged = hits.at(-1)?.t ?? 0;
  const loggedInflicting = (h: LogHit) => inflicts(placement.hits.get(h)?.hits[0]);
  /** The latest candidate before `t` with at least the delay of world time to it. */
  const latest = <T>(xs: readonly T[], tOf: (x: T) => number, t: number, delay: number): T | undefined => {
    for (let i = xs.length - 1; i >= 0; i--) {
      const x = xs[i] as T;
      if (tOf(x) > t) continue;
      if (worldMs(tOf(x), t, stops) >= delay - 1000 / FPS) return x;
    }
    return undefined;
  };
  // The logged hit each replay landing stands for (BuffReplay.landing), for a recorded cause on the log's side.
  const loggedOf = new Map<LandedHit, LogHit>();
  for (const h of hits) {
    if (parseReactionEvent(h.event)) continue;
    const l = replay.landing(h);
    if (!("unknown" in l)) loggedOf.set(l, h);
  }
  // The replay's landing whose infliction set a burst landing off (the burst's record: StatusEvent inflictedAt).
  const recordedSource = (b: LandedHit): LandedHit | undefined => {
    const rec = replay.reactions.find((r) => r.kind === "burst" && r.frame === b.frame && r.operator === b.operator && r.element === b.element);
    const at = rec?.kind === "burst" ? rec.inflictedAt : undefined;
    if (at === undefined) return undefined;
    return landings.filter((l) => l.operator === b.operator && l.frame === at && !l.skillId.startsWith("reaction:") && inflicts(kitHitOf(kits.get(b.operator), l))).at(-1);
  };
  const loggedCause = (b: LogHit, element: string, source?: LandedHit): BurstCause | null => {
    const shown = source ? loggedOf.get(source) : undefined;
    if (shown && shown.t <= b.t) return { t: shown.t, what: shortSkill(shown.event), world: worldMs(shown.t, b.t, stops), recorded: true };
    const own = hits.filter((h) => h.operator === b.operator && h !== b && !parseReactionEvent(h.event) && loggedInflicting(h));
    const c = latest(own, (h) => h.t, b.t, delayMs(element));
    return c ? { t: c.t, what: shortSkill(c.event), world: worldMs(c.t, b.t, stops) } : null;
  };
  const replayCause = (b: LandedHit): BurstCause | null => {
    const src = recordedSource(b);
    if (src) return { t: msOf(src.frame), what: `${shortSkill(src.skillId)} ${src.hitId}`, world: worldMs(msOf(src.frame), msOf(b.frame), stops), recorded: true };
    const own = landings.filter((l) => l.operator === b.operator && !l.skillId.startsWith("reaction:") && inflicts(kitHitOf(kits.get(b.operator), l)));
    const c = latest(own, (l) => msOf(l.frame), msOf(b.frame), delayMs(b.element));
    return c ? { t: msOf(c.frame), what: `${shortSkill(c.skillId)} ${c.hitId}`, world: worldMs(msOf(c.frame), msOf(b.frame), stops) } : null;
  };
  const between = (from: number, to: number) =>
    stops
      .filter((st: ReplayTimeStop) => msOf(st.start) < to && msOf(st.start + st.scales.length) > from && st.scales.some((x) => x < 1))
      .map((st) => `${operatorLabel(data, st.operator)} ${shortSkill(st.skillId)} ${st.scales.length}f at ${s(msOf(st.start))}`);
  const rows: BurstRow[] = [];
  const taken = new Set<LandedHit>();
  for (const h of hits) {
    const r = parseReactionEvent(h.event);
    if (!r || r.kind !== "burst" || !mine(h.operator)) continue;
    const l = replay.statusLanding(h);
    const lc = loggedCause(h, r.element, "unknown" in l ? undefined : recordedSource(l));
    if ("unknown" in l) {
      rows.push({ operator: h.operator, element: r.element, logged: { t: h.t, value: h.value, cause: lc }, unknown: l.unknown, stops: lc ? between(lc.t, h.t) : [] });
      continue;
    }
    taken.add(l);
    const rc = replayCause(l);
    const from = Math.min(lc?.t ?? Infinity, rc?.t ?? Infinity);
    const stage = stageNote(fx, l.damage, h.t);
    rows.push({ operator: h.operator, element: r.element, logged: { t: h.t, value: h.value, cause: lc }, replay: { t: msOf(l.frame), damage: l.damage, cause: rc, ...(stage ? { stage } : {}) }, stops: Number.isFinite(from) ? between(from, Math.max(h.t, msOf(l.frame))) : [] });
  }
  for (const l of landings) {
    if (l.skillId !== "reaction:burst" || taken.has(l) || !mine(l.operator)) continue;
    const rc = replayCause(l);
    const t = msOf(l.frame);
    const stage = stageNote(fx, l.damage, t);
    rows.push({ operator: l.operator, element: l.element, replay: { t, damage: l.damage, cause: rc, ...(stage ? { stage } : {}) }, ...(t > lastLogged ? { afterLog: true } : {}), stops: rc ? between(rc.t, t) : [] });
  }
  return rows.sort((a, b) => (a.logged?.t ?? a.replay?.t ?? 0) - (b.logged?.t ?? b.replay?.t ?? 0));
}

const cause = (c: BurstCause | null) => (c ? `${c.what} at ${s(c.t)} (${s(c.world)} s of world time before${c.recorded ? "" : "; nearest"})` : "none found");

/** One row as a line. */
export function burstLine(data: GameData, r: BurstRow): string {
  const who = `${operatorLabel(data, r.operator)} ${r.element}`;
  const stops = r.stops.length ? `; stops between: ${r.stops.join(", ")}` : "";
  if (r.logged && r.replay) {
    const off = Math.round(r.replay.t - r.logged.t);
    return `${s(r.logged.t).padStart(7)}  ${who}: logged ${r.logged.value}, replay ${r.replay.damage}${r.replay.stage ?? ""} at ${s(r.replay.t)} (${off >= 0 ? "+" : ""}${off} ms); cause: log ${cause(r.logged.cause)}, replay ${cause(r.replay.cause)}${stops}`;
  }
  if (r.logged) return `${s(r.logged.t).padStart(7)}  ${who}: logged ${r.logged.value}, LOG ONLY (${r.unknown ?? "no replay landing"}); cause: log ${cause(r.logged.cause)}${stops}`;
  const rp = r.replay as NonNullable<BurstRow["replay"]>;
  return `${s(rp.t).padStart(7)}  ${who}: REPLAY ONLY ${rp.damage}${rp.stage ?? ""}${r.afterLog ? " (after the log's last hit)" : ""}; cause: replay ${cause(rp.cause)}${stops}`;
}

/** The per-operator counts of some rows: logged, paired (median offset), log only, replay only (in the log's span). */
export function burstCounts(data: GameData, rows: readonly BurstRow[]): string[] {
  const by = new Map<string, BurstRow[]>();
  for (const r of rows) by.set(r.operator, [...(by.get(r.operator) ?? []), r]);
  return [...by].sort((a, b) => b[1].length - a[1].length).map(([op, rs]) => {
    const paired = rs.filter((r) => r.logged && r.replay);
    const offs = paired.map((r) => (r.replay as NonNullable<BurstRow["replay"]>).t - (r.logged as NonNullable<BurstRow["logged"]>).t).sort((a, b) => a - b);
    const median = offs.length ? Math.round(offs[Math.floor((offs.length - 1) / 2)] as number) : null;
    const logged = rs.filter((r) => r.logged).length;
    const replayOnly = rs.filter((r) => !r.logged && !r.afterLog).length;
    return `  ${operatorLabel(data, op)}: ${logged} logged, ${paired.length} with a replay landing${median !== null ? ` (median offset ${median >= 0 ? "+" : ""}${median} ms)` : ""}, ${logged - paired.length} log only, ${replayOnly} replay only${rs.some((r) => r.afterLog) ? ` (+${rs.filter((r) => r.afterLog).length} after the log's last hit)` : ""}`;
  });
}

/** `zmdlogs bursts`: per log its bursts' lines, then the counts per operator (over every log given, too). */
export function burstsView(data: GameData, logs: readonly { readonly short: string; readonly fx: LogFixture }[], opts: { readonly operators?: readonly string[]; readonly from?: number; readonly to?: number; readonly assume?: Readonly<Record<string, string>>; readonly progress?: (line: string) => void } = {}): string {
  const out = [
    "Arts Bursts, logged against replayed (BuffReplay.statusLanding pairs them; offset = replay − log). cause: the replay's landing whose infliction set the burst off (its record) and the logged hit standing for it; marked nearest where there is none: the operator's latest hit with an infliction at least the element's burst delay of world time before it (the log records no infliction: a candidate); stops between: the replay's casts' time stops from the cause to the burst. Times in s.",
  ];
  const all: BurstRow[] = [];
  for (const { short, fx } of logs) {
    opts.progress?.(`bursts ${short}`);
    const rows = burstRows(data, fx, { ...(opts.operators ? { operators: opts.operators } : {}), ...(opts.assume ? { assume: opts.assume } : {}) }).filter((r) => {
      const t = r.logged?.t ?? r.replay?.t ?? 0;
      return t >= (opts.from ?? -Infinity) && t <= (opts.to ?? Infinity);
    });
    all.push(...rows);
    if (!rows.length) continue;
    out.push(`${short}:`, ...rows.map((r) => `  ${burstLine(data, r)}`), ...burstCounts(data, rows).map((l) => `  ${l}`));
  }
  if (logs.length > 1) out.push("", `Over ${logs.length} logs:`, ...burstCounts(data, all));
  return out.join("\n");
}
