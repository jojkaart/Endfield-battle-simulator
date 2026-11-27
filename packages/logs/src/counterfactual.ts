// Counterfactual replays: what the log's hits lose when the replay does without something (round 21, the tail-cut
// report point 2: the round's whole diagnosis was "replay with the exact guard, which later hits lost their landing or
// a modifier", done by hand for two logs with cli-ab and a patch). A counterfactual is a ReplayOptions field the
// replay reads (cutCasts: casts ended after their last logged landing, as tailCuts would), composed into the same check
// the snapshots read (snapshotentry.ts composeCheck), and compared hit by hit with the replay as it is.
//
// `zmdlogs decisions --why-kept <fixture>`: per TAILKEPT line, the replay with that tail cut, and the logged hits whose
// landing, class or primary reading moved: what the kept tail stands for in the log.

import { FPS, type GameData, type LandedHit } from "@efsim/engine";
import { verdictCount, type VerdictCount } from "./logcheck.ts";
import type { ReplayOptions } from "./buffreplay.ts";
import { composeCheck, type CheckComposition } from "./snapshotentry.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { secondsText as s, shortSkill } from "./labels.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;
const label = (data: GameData, op: string) => data.operators[op]?.name ?? op.replace(/^chr_\d+_/, "");

/** A logged hit as one composition reads it: its class, its primary reading and its landing in words. */
export interface HitSide {
  readonly class: VerdictCount;
  readonly predicted: number | null;
  readonly landing: string;
}

/** A logged hit two compositions read otherwise (hitChanges). */
export interface HitChange {
  readonly hit: LogHit;
  readonly before: HitSide;
  readonly after: HitSide;
}

/** A landing in words: its skill, hit, time and target, or why there is none. */
export function landingWords(l: LandedHit | { readonly unknown: string } | undefined): string {
  if (!l) return "none";
  if ("unknown" in l) return `none (${l.unknown})`;
  return `${shortSkill(l.skillId)} ${l.hitId} @${s(msOf(l.frame))}${l.target !== undefined ? ` T${l.target}` : ""}`;
}

/** Each logged hit as a composition reads it (HitSide). */
export function hitSides(k: CheckComposition): Map<LogHit, HitSide> {
  const verdicts = new Map(k.verdicts.map((v) => [v.hit, v]));
  return new Map([...verdicts].map(([h, v]) => {
    const e = k.byHit.get(h);
    return [h, { class: verdictCount(v), predicted: e?.primary ?? null, landing: landingWords(e?.landing) }];
  }));
}

/** The logged hits whose class, primary reading or landing differ between two compositions of one fixture, in time order. */
export function hitChanges(before: ReadonlyMap<LogHit, HitSide>, after: ReadonlyMap<LogHit, HitSide>): HitChange[] {
  const out: HitChange[] = [];
  for (const [h, a] of before) {
    const b = after.get(h);
    if (!b || (a.class === b.class && a.predicted === b.predicted && a.landing === b.landing)) continue;
    out.push({ hit: h, before: a, after: b });
  }
  return out.sort((x, y) => x.hit.t - y.hit.t);
}

/** A change as a line: the hit, then each side's class, primary reading and landing (the landing once where it is the same). */
export function changeLine(data: GameData, c: HitChange): string {
  const side = (x: HitSide, landing: boolean) => `${x.class} ${x.predicted ?? "-"}${landing ? ` [${x.landing}]` : ""}`;
  const moved = c.before.landing !== c.after.landing;
  return `${s(c.hit.t).padStart(7)}  ${label(data, c.hit.operator)} ${shortSkill(c.hit.event)} logged ${c.hit.value}: ${side(c.before, moved)} → ${side(c.after, moved)}${moved ? "" : ` [${c.before.landing}]`}`;
}

/** How many changed hits a view prints per counterfactual before "… and n more". */
export const CHANGES_SHOWN = 8;

/**
 * `zmdlogs decisions --why-kept <fixture>`: per tail the replay kept (TAILKEPT: BuffReplay.tailsKept), the replay with
 * that tail cut (ReplayOptions.cutCasts) and the logged hits whose landing, class or primary reading moved, with a
 * count per class change: what the kept tail stands for in the log. One check per kept tail (seconds each).
 */
export function whyKeptView(raw: GameData, fx: LogFixture, opts: Pick<ReplayOptions, "assume"> & { readonly operators?: readonly string[]; readonly progress?: (line: string) => void } = {}): string {
  const base = composeCheck(raw, fx, opts.assume ? { assume: opts.assume } : {});
  const data = base.data;
  const sides = hitSides(base);
  const kept = (base.replay.replay.tailsKept ?? []).filter((k) => !opts.operators?.length || opts.operators.includes(k.cast.operator));
  const head = `${fx.id}: each tail the replay kept (TAILKEPT, its guard) cut as tailCuts would (at its last logged landing; ReplayOptions.cutCasts), and the logged hits whose landing, class or primary reading moved then (time s, operator, skill, logged value: class prediction [landing] before → after): what the kept tail stands for in the log`;
  if (!kept.length) return [head, "  (no tail kept)"].join("\n");
  const out = [head];
  for (const [i, k] of kept.entries()) {
    opts.progress?.(`why-kept: ${i + 1}/${kept.length} ${shortSkill(k.cast.skillId)} at ${s(k.cast.start)} s`);
    const cut = composeCheck(raw, fx, { ...(opts.assume ? { assume: opts.assume } : {}), cutCasts: [{ operator: k.cast.operator, skillId: k.cast.skillId, start: k.cast.start }] });
    const changes = hitChanges(sides, hitSides(cut));
    const counts = new Map<string, number>();
    for (const c of changes) counts.set(`${c.before.class} → ${c.after.class}`, (counts.get(`${c.before.class} → ${c.after.class}`) ?? 0) + 1);
    const lost = changes.filter((c) => !c.before.landing.startsWith("none") && c.after.landing.startsWith("none")).length;
    const summary = changes.length ? `${changes.length} hit(s) move${lost ? `, ${lost} lose their landing` : ""}: ${[...counts].sort((a, b) => b[1] - a[1]).map(([x, n]) => `${x} ${n}`).join(", ")}` : "no logged hit moves: nothing in the log stands for the tail";
    out.push(`${s(msOf(k.frame)).padStart(7)}  TAILKEPT ${label(data, k.cast.operator)} ${shortSkill(k.cast.skillId)} (placed at ${s(k.cast.start)}) [${k.guard}], cut: ${summary}`);
    for (const c of changes.slice(0, CHANGES_SHOWN)) out.push(`    ${changeLine(data, c)}`);
    if (changes.length > CHANGES_SHOWN) out.push(`    … and ${changes.length - CHANGES_SHOWN} more`);
  }
  return out.join("\n");
}
