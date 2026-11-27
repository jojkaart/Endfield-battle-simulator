// The replay's own decisions as lines (improvement round 14; combo-hold report point 1): what it skipped and why, the
// casts it ended early (TAILCUT), couldn't make (FAILED), added (MISSED), made from the listing (INFER) or as another
// skill than the placement's (MADE), the kit jumps its logged landings contradicted (JUMPDROP: drivers.ts replayCast
// `dropped`), and those it made against the kit (FORCED, INSIDE, CUTS), each from BuffReplay's records. `zmdlogs
// replay` prints them among its landings; `zmdlogs decisions` prints those that differ between the
// default readings and another (`--assume`), over one log or every one: a new replay rule's false positives in one
// list before its first measure.

import { effectiveKit, FPS, parseReactionEvent, withCurveReading, type GameData, type LandedHit, type OperatorKit } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import { batchOrder } from "./castassembly.ts";
import { logBuffReplay } from "./logcheck.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { secondsText as s, shortSkill } from "./labels.ts";
import { deathMoves } from "./targets.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;
const label = (data: GameData, op: string) => data.operators[op]?.name ?? op.replace(/^chr_\d+_/, "");

/** One decision of the replay: its time (ms), its kind (the line's tag) and its text. */
export interface DecisionLine {
  readonly t: number;
  readonly kind: "SKIP" | "TAILCUT" | "TAILKEPT" | "FAILED" | "MISSED" | "INFER" | "MADE" | "PATH" | "JUMPDROP" | "BOTHPATHS" | "BATCH" | "LINK" | "FORCED" | "INSIDE" | "CUTS" | "DEATH";
  readonly operator: string;
  readonly text: string;
  /** A sub-kind `zmdlogs decisions` counts the kind's lines by (TAILKEPT: the guard, replayrun.ts TAIL_GUARDS). */
  readonly detail?: string;
}

/**
 * The targets' deaths the replay makes (replayrun.ts, engine targetDies) where a kit's targetDeath trigger's hit is
 * logged (targets.ts deathMoves: Camille's Vesperwings moving to the next slug): DEATH lines.
 */
export function deathDecisions(data: GameData, fx: LogFixture): DecisionLine[] {
  const kits = fx.team.flatMap((b): OperatorKit[] => {
    const k = effectiveKit(data, b);
    return k ? [k] : [];
  });
  return deathMoves(fx, kits).map((m) => ({
    t: msOf(m.frame),
    kind: "DEATH",
    operator: m.operator,
    text: `a target's death made at ${s(msOf(m.frame))} (${m.kill ? `the logged kill, ${shortSkill(m.kill.event)} at ${s(m.kill.t)}` : "no logged kill within 1 s before: the trigger's lead before its landing"}) for ${label(data, m.operator)}'s ${m.trigger}, its landing pinned at the logged ${shortSkill(m.hit.event)} ${m.hit.value} at ${s(m.hit.t)} (targets.ts deathMoves); a cast event of its operator at that ms is no press (moveEvent)`,
  }));
}

/** The decision kinds, in the order `zmdlogs decisions` counts them. */
export const DECISION_KINDS: readonly DecisionLine["kind"][] = ["SKIP", "TAILCUT", "TAILKEPT", "FAILED", "MISSED", "INFER", "MADE", "PATH", "JUMPDROP", "BOTHPATHS", "BATCH", "LINK", "FORCED", "INSIDE", "CUTS", "DEATH"];

/** The replay's landing of each logged hit (the hit it stands for), as the log check finds it, and why the others have none. */
export function landingsOf(replay: Pick<BuffReplay, "landing" | "statusLanding">, fx: LogFixture): { byLanding: Map<LandedHit, LogHit>; missing: Map<LogHit, string> } {
  const byLanding = new Map<LandedHit, LogHit>();
  const missing = new Map<LogHit, string>();
  for (const h of fx.hits) {
    const l = parseReactionEvent(h.event) ? replay.statusLanding(h) : replay.landing(h);
    if ("unknown" in l) missing.set(h, l.unknown);
    else byLanding.set(l, h);
  }
  return { byLanding, missing };
}

/** A batched ms whose replay landings came in another order than the log's bars give (batchDisagreements). */
export interface BatchDisagreement {
  readonly t: number;
  /** The logged hits in the replay's landing order, and in the bars'. */
  readonly replay: readonly LogHit[];
  readonly bars: readonly LogHit[];
}

/**
 * The batched ms (castassembly.ts batchOrder) where the replay's landings of the logged hits came in another order
 * than the bars' (a place lower than one landed before it): the BATCH lines of `zmdlogs replay` and `zmdlogs
 * decisions`. Pinned landings land in the bars' order since 2026-11-26 (schedule.ts dueBefore), so these are landings
 * the bars didn't order (a trigger's hit, a cast the replay moved).
 */
export function batchDisagreements(fx: LogFixture, landings: readonly LandedHit[], byLanding: ReadonlyMap<LandedHit, LogHit>): BatchDisagreement[] {
  const order = batchOrder(fx.hits);
  const at = new Map<number, LogHit[]>();
  for (const l of landings) {
    const h = byLanding.get(l);
    if (!h || !order.has(h)) continue;
    const list = at.get(h.t) ?? [];
    if (!list.includes(h)) list.push(h);
    at.set(h.t, list);
  }
  const out: BatchDisagreement[] = [];
  for (const [t, replayed] of at) {
    const places = replayed.map((h) => order.get(h) as number);
    if (places.every((p, i) => i === 0 || p >= (places[i - 1] as number))) continue;
    out.push({ t, replay: replayed, bars: [...replayed].sort((a, b) => (order.get(a) as number) - (order.get(b) as number)) });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** A batch disagreement as a BATCH decision (its operator: the first hit the replay landed there). */
export function batchDecision(data: GameData, b: BatchDisagreement): DecisionLine {
  const words = (hs: readonly LogHit[]) => hs.map((h) => `${label(data, h.operator)} ${shortSkill(h.event)}`).join(", ");
  return { t: b.t, kind: "BATCH", operator: (b.replay[0] as LogHit).operator, text: `the replay landed ${words(b.replay)}; the log's bars give ${words(b.bars)}` };
}

/**
 * The replay's decisions (BuffReplay.skipped, tailCuts, failed, missed, made, castFlags), in time order; with the
 * fixture, its BATCH lines too (batchDisagreements: the bars are the fixture's; backlog after round 16 point 3, so
 * `zmdlogs decisions --all` counts them per log and `--assume` shows a reading's effect on the batches).
 */
export function replayDecisions(data: GameData, replay: BuffReplay, fx?: LogFixture): DecisionLine[] {
  const out: DecisionLine[] = [];
  const who = (op: string) => label(data, op);
  if (fx) for (const b of batchDisagreements(fx, replay.hits, landingsOf(replay, fx).byLanding)) out.push(batchDecision(data, b));
  if (fx) out.push(...deathDecisions(data, fx));
  for (const x of replay.skipped) out.push({ t: msOf(x.frame), kind: "SKIP", operator: x.cast.operator, text: `${who(x.cast.operator)} ${shortSkill(x.cast.skillId)} (logged at ${s(x.cast.start)}): ${x.why}` });
  for (const x of replay.tailCuts) out.push({ t: msOf(x.frame), kind: "TAILCUT", operator: x.cast.operator, text: `${who(x.cast.operator)} ${shortSkill(x.cast.skillId)} (placed at ${s(x.cast.start)}): ended after its last logged landing, none of its later ones in the log (unlogged-tails)` });
  // A tail the cut's guards kept (replayrun.ts tailCuts' `kept`): which guard, and what it found.
  for (const x of replay.tailsKept ?? []) out.push({ t: msOf(x.frame), kind: "TAILKEPT", operator: x.cast.operator, text: `${who(x.cast.operator)} ${shortSkill(x.cast.skillId)} (placed at ${s(x.cast.start)}): its unlogged tail kept [${x.guard}]: ${x.why}`, detail: x.guard });
  for (const x of replay.failed) out.push({ t: x.cast.start, kind: "FAILED", operator: x.cast.operator, text: `${who(x.cast.operator)} ${shortSkill(x.cast.skillId)}: ${x.error}` });
  for (const m of replay.missed) out.push({ t: m.start, kind: "MISSED", operator: m.operator, text: `${who(m.operator)} ${shortSkill(m.skillId)} made for ${shortSkill(m.need.skillId)}@${s(m.need.start)} (a cast that hits nothing, which the log can't show)` });
  for (const m of replay.made) {
    if (m.cast.missed) continue;
    // A chance jump the listing decided (castassembly.ts listedPaths, castsFromHitBuffs: ReplayedCast.chanceJumps).
    for (const [trigger, taken] of Object.entries(m.cast.chanceJumps ?? {})) out.push({ t: msOf(m.frame), kind: "PATH", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.skillId)} (made at ${s(msOf(m.frame))}): its chance jump ${trigger} ${taken ? "taken: a buff only that path gives starts a run at its hit's landing" : "not taken: a buff only that path gives starts no run at its hit's landing, nor runs on as its refresh would"} (listedPaths)` });
    // A kit jump on the cast's state its landings' values decided (castassembly.ts valuePaths: ReplayedCast.kitJumps).
    const taken = (m.cast.kitJumps ?? []).filter((j) => j.taken);
    if (m.cast.kitJumps?.length) out.push({ t: msOf(m.frame), kind: "PATH", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.skillId)} (made at ${s(msOf(m.frame))}): ${taken.length ? `its jump ${taken.map((j) => `${j.at} → ${j.to}`).join(", ")} taken` : `no jump from frame ${[...new Set(m.cast.kitJumps.map((j) => j.at))].join(", ")} taken`}: its landings' values fit that path's hits only (valuePaths)` });
    if (m.inferred !== undefined && m.cast.listed) out.push({ t: msOf(m.frame), kind: "INFER", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.skillId)} (no logged hit or cast event): ${m.inferred}` });
    else if (m.inferred !== undefined) out.push({ t: msOf(m.frame), kind: "INFER", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.skillId)} (logged at ${s(m.cast.start)}): a hitless press made from the listing (hitless-presses inferred): ${m.inferred}` });
    else if (m.skillId !== m.cast.skillId) out.push({ t: msOf(m.frame), kind: "MADE", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.cast.skillId)} (placed at ${s(m.cast.start)}) made as ${shortSkill(m.skillId)}` });
    // Two casts of one operator at one frame (totals-off report point 1: db87's forced normal_skill beside the placed
    // normal_skill_during_ult, one press, the phantom taking the Link): each says so.
    const beside = replay.made.filter((o) => o !== m && !o.cast.missed && o.cast.operator === m.cast.operator && Math.abs(o.frame - m.frame) <= 1);
    if (beside.length) out.push({ t: msOf(m.frame), kind: "MADE", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.skillId)} (${m.cast.landings.length ? "placed" : "logged"} at ${s(m.cast.start)}) made at the frame of ${beside.map((o) => `${shortSkill(o.skillId)} (${o.cast.landings.length ? "placed" : "logged"} at ${s(o.cast.start)})`).join(", ")} too: two casts for one press?` });
    // Link: the stacks the team gained in its step (by expiry less LINK_FRAMES), and those the cast took (Cast.link).
    for (const g of m.linkGained ?? []) out.push({ t: msOf(g.frame), kind: "LINK", operator: m.cast.operator, text: `+${g.n} Link stack(s) for the team at ${s(msOf(g.frame))}, in the step of ${who(m.cast.operator)} ${shortSkill(m.skillId)} (made at ${s(msOf(m.frame))})` });
    if (m.link) out.push({ t: msOf(m.frame), kind: "LINK", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.skillId)} (made at ${s(msOf(m.frame))}) took ${m.link} Link stack(s)` });
    // A kit jump the logged landings contradicted (drivers.ts replayCast `dropped`): the path the cast took is the log's.
    for (const j of m.dropped ?? []) {
      const at = j.landings.map((l) => `${l.hitId}@${s(msOf(l.frame))}`).join(", ");
      out.push({ t: msOf(j.frame), kind: "JUMPDROP", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.skillId)} (made at ${s(msOf(m.frame))}): its jump ${j.from} → ${j.to} dropped, the logged landing(s) ${at} in the part it skips (a shared key's other path, or its condition read otherwise in the game)` });
    }
    // A kit jump kept with pinned landings in its skipped part (drivers.ts replayCast `keptSkipped`): they land all the
    // same, beside the path the jump goes to (round 16, slots-and-paths report point 1: six slashes for one combo).
    for (const j of m.keptSkipped ?? []) {
      const at = j.landings.map((l) => `${l.hitId}@${s(msOf(l.frame))}`).join(", ");
      out.push({ t: msOf(j.frame), kind: "BOTHPATHS", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.skillId)} (made at ${s(msOf(m.frame))}): its jump ${j.from} → ${j.to} kept, yet the pinned landing(s) ${at} are in the part it skips and land too: both paths' hits in one cast (their SP, stacks and triggers twice)?` });
    }
  }
  for (const x of replay.castFlags) {
    const kind = x.kind === "cuts" ? "CUTS" : x.kind === "forced" ? "FORCED" : "INSIDE";
    out.push({ t: msOf(x.frame), kind, operator: x.cast.operator, text: x.kind === "cuts" ? `${who(x.cast.operator)} ${shortSkill(x.skillId)}: ${x.why}` : `${who(x.cast.operator)} ${shortSkill(x.skillId)} made against its kit: ${x.why}` });
  }
  return out.sort((a, b) => a.t - b.t || DECISION_KINDS.indexOf(a.kind) - DECISION_KINDS.indexOf(b.kind));
}

/** A decision line as `zmdlogs replay` and `zmdlogs decisions` print it (the tag padded to the views' column). */
export const decisionText = (d: DecisionLine): string => `${d.kind.padEnd(6)} ${d.text}`;

/** The decisions only one of two replays made: `-` the first's (the defaults), `+` the second's (the reading), keyed by time and text. */
export function decisionsDiff(a: readonly DecisionLine[], b: readonly DecisionLine[]): { readonly side: "-" | "+"; readonly d: DecisionLine }[] {
  const key = (d: DecisionLine) => `${Math.round(d.t)}|${d.kind}|${d.text}`;
  const inA = new Map<string, number>();
  for (const d of a) inA.set(key(d), (inA.get(key(d)) ?? 0) + 1);
  const inB = new Map<string, number>();
  for (const d of b) inB.set(key(d), (inB.get(key(d)) ?? 0) + 1);
  const only = (list: readonly DecisionLine[], other: Map<string, number>, side: "-" | "+") => {
    const left = new Map(other);
    return list.flatMap((d) => {
      const n = left.get(key(d)) ?? 0;
      if (n > 0) {
        left.set(key(d), n - 1);
        return [];
      }
      return [{ side, d }];
    });
  };
  return [...only(a, inB, "-"), ...only(b, inA, "+")].sort((x, y) => x.d.t - y.d.t || (x.side === y.side ? 0 : x.side === "-" ? -1 : 1));
}

/**
 * `zmdlogs decisions <fixture…|--all> --assume <id>=<r>`: per log, the replay's decisions that differ between the
 * default readings and the given ones (`-` only under the defaults, `+` only under the reading), then a count per kind
 * and the logs with any; without `--assume`, every decision of each log. Two replays per log (seconds each).
 */
export function decisionsView(data: GameData, logs: readonly { readonly short: string; readonly fx: LogFixture }[], opts: { readonly assume?: Readonly<Record<string, string>>; readonly operators?: readonly string[]; readonly progress?: (line: string) => void } = {}): string {
  const assume = opts.assume ?? {};
  const under = Object.keys(assume).length > 0;
  const mine = (d: DecisionLine) => !opts.operators?.length || opts.operators.includes(d.operator);
  const lines: string[] = [];
  const counts = new Map<string, { minus: number; plus: number; logs: Set<string>; details: Map<string, number> }>();
  const counted = (d: DecisionLine) => {
    const c = counts.get(d.kind) ?? { minus: 0, plus: 0, logs: new Set<string>(), details: new Map<string, number>() };
    if (d.detail !== undefined) c.details.set(d.detail, (c.details.get(d.detail) ?? 0) + 1);
    counts.set(d.kind, c);
    return c;
  };
  let changed = 0;
  for (const [i, { short, fx }] of logs.entries()) {
    opts.progress?.(`decisions: ${short} (${i + 1}/${logs.length})`);
    // Each side's data under its own readings (combo-curve is a reading of the data: logBuffReplay refuses a mix).
    const plain = withCurveReading(data, {});
    const base = replayDecisions(plain, logBuffReplay(plain, fx).replay, fx).filter(mine);
    if (!under) {
      if (base.length) lines.push(`${short}:`, ...base.map((d) => `  ${s(d.t).padStart(7)}  ${decisionText(d)}`));
      for (const d of base) {
        const c = counted(d);
        c.plus++;
        c.logs.add(short);
      }
      continue;
    }
    const readData = withCurveReading(data, assume);
    const other = replayDecisions(readData, logBuffReplay(readData, fx, { assume }).replay, fx).filter(mine);
    const diff = decisionsDiff(base, other);
    if (!diff.length) continue;
    changed++;
    lines.push(`${short}:`, ...diff.map(({ side, d }) => `  ${side} ${s(d.t).padStart(7)}  ${decisionText(d)}`));
    for (const { side, d } of diff) {
      const c = counted(d);
      if (side === "-") c.minus++;
      else c.plus++;
      c.logs.add(short);
    }
  }
  const reading = Object.entries(assume).map(([k, v]) => `${k}=${v}`).join(", ");
  const head = under
    ? `The replay's decisions that differ under ${reading} (decisionsview.ts; - only under the defaults, + only under the reading), ${changed} of ${logs.length} log(s):`
    : `The replay's decisions (decisionsview.ts: ${DECISION_KINDS.join(", ")}), ${logs.length} log(s):`;
  // A kind with sub-kinds (TAILKEPT's guards) says how its lines split (round 20, the twins report point 1: that the
  // own-landing pass keeps most tails, before a change to it is measured).
  const summary = DECISION_KINDS.filter((k) => counts.has(k)).map((k) => {
    const c = counts.get(k) as { minus: number; plus: number; logs: Set<string>; details: Map<string, number> };
    const by = [...c.details].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([x, n]) => `${x} ${n}`);
    return `  ${k.padEnd(7)} ${under ? `-${c.minus} +${c.plus}` : String(c.plus)} in ${c.logs.size} log(s)${by.length ? ` (by ${under ? "line, either side" : "line"}: ${by.join(", ")})` : ""}`;
  });
  return [head, ...lines, "", under ? "Per kind (only under the defaults, only under the reading):" : "Per kind:", ...(summary.length ? summary : ["  none"])].join("\n");
}
