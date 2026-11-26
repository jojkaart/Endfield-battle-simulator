// The replay's own decisions as lines (improvement round 14; combo-hold report point 1): what it skipped and why, the
// casts it ended early (TAILCUT), couldn't make (FAILED), added (MISSED), made from the listing (INFER) or as another
// skill than the placement's (MADE), and those it made against the kit (FORCED, INSIDE, CUTS), each from BuffReplay's
// records. `zmdlogs replay` prints them among its landings; `zmdlogs decisions` prints those that differ between the
// default readings and another (`--assume`), over one log or every one: a new replay rule's false positives in one
// list before its first measure.

import { FPS, type GameData } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import { logBuffReplay } from "./logcheck.ts";
import type { LogFixture } from "./zmdlogs.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;
const s = (ms: number) => (ms / 1000).toFixed(2);
const shortSkill = (id: string) => id.replace(/^chr_\d+_[a-z0-9]+_/, "");
const label = (data: GameData, op: string) => data.operators[op]?.name ?? op.replace(/^chr_\d+_/, "");

/** One decision of the replay: its time (ms), its kind (the line's tag) and its text. */
export interface DecisionLine {
  readonly t: number;
  readonly kind: "SKIP" | "TAILCUT" | "FAILED" | "MISSED" | "INFER" | "MADE" | "FORCED" | "INSIDE" | "CUTS";
  readonly operator: string;
  readonly text: string;
}

/** The decision kinds, in the order `zmdlogs decisions` counts them. */
export const DECISION_KINDS: readonly DecisionLine["kind"][] = ["SKIP", "TAILCUT", "FAILED", "MISSED", "INFER", "MADE", "FORCED", "INSIDE", "CUTS"];

/** The replay's decisions (BuffReplay.skipped, tailCuts, failed, missed, made, castFlags), in time order. */
export function replayDecisions(data: GameData, replay: BuffReplay): DecisionLine[] {
  const out: DecisionLine[] = [];
  const who = (op: string) => label(data, op);
  for (const x of replay.skipped) out.push({ t: msOf(x.frame), kind: "SKIP", operator: x.cast.operator, text: `${who(x.cast.operator)} ${shortSkill(x.cast.skillId)} (logged at ${s(x.cast.start)}): ${x.why}` });
  for (const x of replay.tailCuts) out.push({ t: msOf(x.frame), kind: "TAILCUT", operator: x.cast.operator, text: `${who(x.cast.operator)} ${shortSkill(x.cast.skillId)} (placed at ${s(x.cast.start)}): ended after its last logged landing, none of its later ones in the log (unlogged-tails)` });
  for (const x of replay.failed) out.push({ t: x.cast.start, kind: "FAILED", operator: x.cast.operator, text: `${who(x.cast.operator)} ${shortSkill(x.cast.skillId)}: ${x.error}` });
  for (const m of replay.missed) out.push({ t: m.start, kind: "MISSED", operator: m.operator, text: `${who(m.operator)} ${shortSkill(m.skillId)} made for ${shortSkill(m.need.skillId)}@${s(m.need.start)} (a cast that hits nothing, which the log can't show)` });
  for (const m of replay.made) {
    if (m.cast.missed) continue;
    if (m.inferred !== undefined) out.push({ t: msOf(m.frame), kind: "INFER", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.skillId)} (logged at ${s(m.cast.start)}): a hitless press made from the listing (hitless-presses inferred): ${m.inferred}` });
    else if (m.skillId !== m.cast.skillId) out.push({ t: msOf(m.frame), kind: "MADE", operator: m.cast.operator, text: `${who(m.cast.operator)} ${shortSkill(m.cast.skillId)} (placed at ${s(m.cast.start)}) made as ${shortSkill(m.skillId)}` });
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
  const counts = new Map<string, { minus: number; plus: number; logs: Set<string> }>();
  let changed = 0;
  for (const [i, { short, fx }] of logs.entries()) {
    opts.progress?.(`decisions: ${short} (${i + 1}/${logs.length})`);
    const base = replayDecisions(data, logBuffReplay(data, fx).replay).filter(mine);
    if (!under) {
      if (base.length) lines.push(`${short}:`, ...base.map((d) => `  ${s(d.t).padStart(7)}  ${decisionText(d)}`));
      for (const d of base) {
        const c = counts.get(d.kind) ?? { minus: 0, plus: 0, logs: new Set<string>() };
        c.plus++;
        c.logs.add(short);
        counts.set(d.kind, c);
      }
      continue;
    }
    const other = replayDecisions(data, logBuffReplay(data, fx, undefined, { assume }).replay).filter(mine);
    const diff = decisionsDiff(base, other);
    if (!diff.length) continue;
    changed++;
    lines.push(`${short}:`, ...diff.map(({ side, d }) => `  ${side} ${s(d.t).padStart(7)}  ${decisionText(d)}`));
    for (const { side, d } of diff) {
      const c = counts.get(d.kind) ?? { minus: 0, plus: 0, logs: new Set<string>() };
      if (side === "-") c.minus++;
      else c.plus++;
      c.logs.add(short);
      counts.set(d.kind, c);
    }
  }
  const reading = Object.entries(assume).map(([k, v]) => `${k}=${v}`).join(", ");
  const head = under
    ? `The replay's decisions that differ under ${reading} (decisionsview.ts; - only under the defaults, + only under the reading), ${changed} of ${logs.length} log(s):`
    : `The replay's decisions (decisionsview.ts: SKIP, TAILCUT, FAILED, MISSED, INFER, MADE, FORCED, INSIDE, CUTS), ${logs.length} log(s):`;
  const summary = DECISION_KINDS.filter((k) => counts.has(k)).map((k) => {
    const c = counts.get(k) as { minus: number; plus: number; logs: Set<string> };
    return `  ${k.padEnd(7)} ${under ? `-${c.minus} +${c.plus}` : String(c.plus)} in ${c.logs.size} log(s)`;
  });
  return [head, ...lines, "", under ? "Per kind (only under the defaults, only under the reading):" : "Per kind:", ...(summary.length ? summary : ["  none"])].join("\n");
}
