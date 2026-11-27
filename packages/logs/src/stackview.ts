// `efsim zmdlogs stack <owner:stack> [fixture…|--all] [--at-cast <skill>]`: a kit stack's value at each cast the
// replay made, over one log or every one with its owner (round 18, the log-only report point 3: Typhoeus's missing
// Sign took `replay --trace-stack` per log and a scratch script grepping "signs N → 0" lines across 12 logs). From the
// replay's stack trace (BuffReplay.stackTraces, `--trace-stack`'s changes) and its made casts (BuffReplay.made): the
// value before the cast's frame, the value just before its owner's next cast (what the cast left), and the changes
// between with their steps.

import type { GameData } from "@efsim/engine";
import { FPS } from "@efsim/engine";
import { operatorLabel, secondsText as s, shortSkill } from "./labels.ts";
import { logBuffReplay } from "./logcheck.ts";
import type { DevFixture } from "./logs.ts";
import type { StackTrace } from "./replayrecord.ts";
import type { LogFixture } from "./zmdlogs.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;

/** A kit stack's value at one cast the replay made (stackAtCasts). Times in ms. */
export interface StackAtCast {
  readonly t: number;
  readonly operator: string;
  /** The skill it was made as, and the one placed where they differ. */
  readonly skillId: string;
  readonly placed?: string;
  /** The value before its frame, and just before its owner's next cast (or the fight's end); null: unset. */
  readonly before: number | null;
  readonly after: number | null;
  /** The changes from its frame to then: "a → b at <step>". */
  readonly changes: readonly string[];
}

/**
 * A kit stack's value at each cast of the replay (by default its owner's; `skill`: the casts whose made skill matches,
 * any operator's), from one replay with the stack traced.
 */
export function stackAtCasts(data: GameData, fx: LogFixture, owner: string, stack: string, opts: { readonly skill?: RegExp; readonly assume?: Readonly<Record<string, string>> } = {}): StackAtCast[] {
  const { replay } = logBuffReplay(data, fx, undefined, { trace: [`stack:${owner}:${stack}`], ...(opts.assume && Object.keys(opts.assume).length ? { assume: opts.assume } : {}) });
  const changes: StackTrace[] = replay.stackTraces.filter((x) => x.operator === owner && x.stack === stack).sort((a, b) => a.frame - b.frame);
  const valueBefore = (f: number): number | null => {
    const last = changes.filter((x) => x.frame < f).at(-1);
    return last ? last.to : (changes[0]?.from ?? null);
  };
  const made = replay.made.filter((m) => !m.cast.missed).sort((a, b) => a.frame - b.frame);
  const ownerCasts = made.filter((m) => m.cast.operator === owner);
  const out: StackAtCast[] = [];
  for (const m of made) {
    if (opts.skill ? !opts.skill.test(m.skillId) : m.cast.operator !== owner) continue;
    const next = ownerCasts.find((x) => x.frame > m.frame);
    const end = next ? next.frame : Infinity;
    const between = changes.filter((x) => x.frame >= m.frame && x.frame < end);
    out.push({
      t: msOf(m.frame),
      operator: m.cast.operator,
      skillId: m.skillId,
      ...(m.skillId !== m.cast.skillId ? { placed: m.cast.skillId } : {}),
      before: valueBefore(m.frame),
      after: between.length ? (between.at(-1) as StackTrace).to : valueBefore(m.frame),
      changes: between.map((x) => `${x.from ?? "unset"} → ${x.to ?? "unset"} at ${s(msOf(x.frame))} (${x.step})`),
    });
  }
  return out;
}

/** `zmdlogs stack`: per log its casts' lines (stackAtCasts), then a count per skill and value before. */
export function stackView(data: GameData, logs: readonly DevFixture[], owner: string, stack: string, opts: { readonly skill?: RegExp; readonly assume?: Readonly<Record<string, string>>; readonly progress?: (line: string) => void } = {}): string {
  const val = (v: number | null) => (v === null ? "unset" : String(v));
  const out = [
    `${operatorLabel(data, owner)}:${stack} at each cast the replay made (${opts.skill ? `skills matching /${opts.skill.source}/, any operator's` : `${operatorLabel(data, owner)}'s casts`}): its value before the cast's frame → just before ${operatorLabel(data, owner)}'s next cast, and the changes between (BuffReplay.stackTraces, as replay --trace-stack prints them); times in s.`,
  ];
  const tally = new Map<string, number>();
  let n = 0;
  for (const d of logs) {
    if (!d.fx.team.some((b) => b.operator === owner)) continue;
    opts.progress?.(`stack ${d.short}`);
    const rows = stackAtCasts(data, d.fx, owner, stack, opts);
    n++;
    if (!rows.length) continue;
    out.push("", `${d.short}:`);
    for (const r of rows) {
      out.push(`  ${s(r.t).padStart(7)}  ${operatorLabel(data, r.operator)} ${shortSkill(r.skillId)}${r.placed ? ` (placed as ${shortSkill(r.placed)})` : ""}: ${val(r.before)} → ${val(r.after)}${r.changes.length ? `  [${r.changes.join("; ")}]` : ""}`);
      const k = `${shortSkill(r.skillId)} at ${val(r.before)}`;
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
  }
  out.push("", `Over ${n} log(s) with ${operatorLabel(data, owner)}: casts by skill and the value before them:`, ...[...tally].sort((a, b) => b[1] - a[1]).map(([k, c]) => `  ${String(c).padStart(4)}  ${k}`));
  return out.join("\n");
}
