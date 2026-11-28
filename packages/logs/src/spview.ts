// The log replay's team SP as lines of `zmdlogs replay`: TOPUP, the SP a logged cast lacked (BuffReplay.spTopUps:
// drivers.ts replayCast raises SP to the cost silently), always; with `--sp`, SP each grant (TimelineState.spGained's
// change: the operator and source, `hit <skill> <hit>`, `kit:<trigger>`, `dodge`) and each cast's spend, with the team's
// SP after. Round 23 (the team-SP report points 1 and 3): the shortfall was visible only to a probe replaying every log,
// and where the replay's SP came from took a frame-by-frame scan (scripts/probes/sp/grants.ts) and a wrong patch.
import { secondsOf, spAt, type GameData, type TimelineState } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import { shortSkill } from "./labels.ts";

const msOf = (frames: number) => secondsOf(frames) * 1000;
const label = (data: GameData, op: string) => data.operators[op]?.name ?? op.replace(/^chr_\d+_/, "");

/** One SP line of the replay view: its time (ms) and text. */
export interface SpLine {
  readonly t: number;
  readonly text: string;
}

/** TOPUP lines: each logged cast the replay's own SP couldn't pay, and by how much (BuffReplay.spTopUps). */
export function topUpLines(data: GameData, replay: Pick<BuffReplay, "spTopUps">, f: { readonly from?: number; readonly to?: number; readonly operators?: readonly string[] } = {}): SpLine[] {
  return replay.spTopUps.flatMap((x) => {
    const t = msOf(x.frame);
    if (t < (f.from ?? -Infinity) || t > (f.to ?? Infinity) || (f.operators?.length && !f.operators.includes(x.operator))) return [];
    return [{ t, text: `TOPUP  ${label(data, x.operator)} ${shortSkill(x.skillId)}: the replay's SP was ${x.sp.toFixed(1)} short of its cost (drivers.ts replayCast raises it to the cost: docs/open-problems.md "Team SP")` }];
  });
}

/** The SP granted between two states, per operator and source (TimelineState.spGained), the changes only. */
export function spGrants(before: Pick<TimelineState, "spGained">, after: Pick<TimelineState, "spGained">): { readonly operator: string; readonly source: string; readonly sp: number }[] {
  const out: { operator: string; source: string; sp: number }[] = [];
  for (const [operator, by] of Object.entries(after.spGained ?? {})) {
    for (const [source, v] of Object.entries(by)) {
      const d = v - (before.spGained?.[operator]?.[source] ?? 0);
      if (d > 1e-6) out.push({ operator, source, sp: d });
    }
  }
  return out.sort((a, b) => a.operator.localeCompare(b.operator) || a.source.localeCompare(b.source));
}

/**
 * `zmdlogs replay --sp`: each SP grant (at the landing or cast frame it was seen by: the replay's states sampled at
 * every landing and cast) with its operator and source, and each cast with what it spent and the team's SP after;
 * regeneration is the rest (8/s unless paused, engine assumption sp-regen).
 */
export function spLines(data: GameData, replay: Pick<BuffReplay, "stateAt" | "hits" | "spTopUps">, f: { readonly from?: number; readonly to?: number; readonly operators?: readonly string[] } = {}): SpLine[] {
  const end = Math.max(0, ...replay.hits.map((h) => h.frame));
  const last = replay.stateAt(end);
  if (!last) return [];
  const frames = [...new Set([...replay.hits.map((h) => h.frame), ...last.casts.map((c) => c.frame)])].sort((a, b) => a - b);
  const mine = (op: string) => !f.operators?.length || f.operators.includes(op);
  const out: SpLine[] = [];
  let prev: TimelineState | null = replay.stateAt(0);
  for (const fr of frames) {
    const st = replay.stateAt(fr);
    if (!st || !prev) continue;
    const t = msOf(fr);
    if (t >= (f.from ?? -Infinity) && t <= (f.to ?? Infinity)) {
      const grants = spGrants(prev, st);
      const sp = spAt(st, fr);
      for (const g of grants) if (mine(g.operator)) out.push({ t, text: `SP     +${g.sp.toFixed(1)} from ${label(data, g.operator)} ${g.source.replace(/chr_\d+_[a-z0-9]+_/g, "")}: the team's SP ${sp.toFixed(1)}` });
      const granted = grants.reduce((a, g) => a + g.sp, 0);
      for (const c of st.casts) {
        if (c.frame !== fr || !mine(c.operator)) continue;
        // A cast the replay topped up (TOPUP) spent its whole cost: the top-up came first.
        const topUp = replay.spTopUps.filter((x) => x.frame === fr && x.operator === c.operator).reduce((a, x) => a + x.sp, 0);
        const spent = spAt(prev, fr) + granted + topUp - c.spAfter;
        if (spent > 0.05) out.push({ t, text: `SP     −${spent.toFixed(1)} ${label(data, c.operator)} ${shortSkill(c.skill)}${topUp > 0 ? ` (${topUp.toFixed(1)} of it the replay's top-up)` : ""}: the team's SP ${c.spAfter.toFixed(1)} after` });
      }
    }
    prev = st;
  }
  return out;
}
