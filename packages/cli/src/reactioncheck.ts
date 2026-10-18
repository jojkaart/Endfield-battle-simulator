// Checks the kits' inflictions (KitHit.applies) against a battle log: replays
// the logged hits through the enemy state machine (status.ts) and compares
// the bursts and reactions it predicts with the ones the log records. Logs
// don't record inflictions, so this is how a kit's `applies` gets verified.

import { applyToEnemy, expireStatus, FPS, NO_STATUS, statusEventKey, type GameData, type KitHit, type StatusEvent } from "@efsim/engine";
import type { LogFixture } from "@efsim/data";

/**
 * Bursts show up in logs up to about a second after the hit that caused them
 * (btl_upload_40d9a3c1da37: +893 ms and +912 ms), reactions at the same
 * time. A logged event matches a prediction by the same operator and key
 * within this window after it.
 */
export const REACTION_LOG_DELAY_MS = 1200;

export interface ReactionCheck {
  readonly matched: readonly { readonly predicted: StatusEvent; readonly t: number; readonly loggedT: number }[];
  /** Predicted with an initial hit, but not in the log. */
  readonly unlogged: readonly { readonly predicted: StatusEvent; readonly t: number }[];
  /** In the log, but not predicted. */
  readonly unpredicted: readonly { readonly t: number; readonly operator: string; readonly event: string }[];
  /** Forced reactions and consumptions: nothing in the log to match them against. */
  readonly other: readonly { readonly predicted: StatusEvent; readonly t: number }[];
  /** Team members whose kit declares no inflictions, so the replay can't be complete. */
  readonly withoutApplies: readonly string[];
}

/** buff_common_<new>_<consumed>_triggered, or buff_common_<new>_triggered in newer logs (reactions only). */
const REACTION_KEY = /^buff_common_(fire|natural|pulse|cryst)(_(fire|natural|pulse|cryst))?_triggered$/;

/** Whether a logged key is what a predicted event would be logged as. */
function sameKey(logged: string, predicted: StatusEvent): boolean {
  const key = statusEventKey(predicted);
  return logged === key || (predicted.kind === "reaction" && logged === `buff_common_${predicted.element}_triggered`);
}

function kitHit(data: GameData, operator: string, event: string): KitHit | null {
  for (const s of data.kits.operators[operator]?.skills ?? []) for (const h of s.hits) if (h.events.includes(event)) return h;
  return null;
}

export function checkReactions(data: GameData, fixture: LogFixture): ReactionCheck {
  const hits = [...fixture.hits].sort((a, b) => a.t - b.t);
  let enemy = NO_STATUS;
  const predicted: { predicted: StatusEvent; t: number }[] = [];
  for (const h of hits) {
    const kh = kitHit(data, h.operator, h.event);
    if (!kh?.applies) continue;
    const frame = (h.t * FPS) / 1000;
    for (const app of kh.applies) {
      // Arts Intensity only scales status strength, which this check doesn't compare.
      const r = applyToEnemy(expireStatus(enemy, frame), app, frame, h.operator, 0);
      enemy = r.state;
      for (const e of r.events) predicted.push({ predicted: e, t: h.t });
    }
  }
  const logged = hits.filter((h) => REACTION_KEY.test(h.event)).map((h) => ({ t: h.t, operator: h.operator, event: h.event, used: false }));
  const matched: ReactionCheck["matched"][number][] = [];
  const unlogged: ReactionCheck["unlogged"][number][] = [];
  const other: ReactionCheck["other"][number][] = [];
  for (const p of predicted) {
    const key = statusEventKey(p.predicted);
    if (!key || p.predicted.kind === "combustionTick") {
      other.push(p);
      continue;
    }
    const m = logged.find((l) => !l.used && sameKey(l.event, p.predicted) && l.operator === p.predicted.operator && l.t >= p.t && l.t - p.t <= REACTION_LOG_DELAY_MS);
    if (m) {
      m.used = true;
      matched.push({ ...p, loggedT: m.t });
    } else unlogged.push(p);
  }
  return {
    matched,
    unlogged,
    unpredicted: logged.filter((l) => !l.used).map(({ used: _used, ...l }) => l),
    other,
    withoutApplies: fixture.team
      .map((b) => b.operator)
      .filter((op) => !(data.kits.operators[op]?.skills ?? []).some((s) => s.hits.some((h) => h.applies?.length))),
  };
}

function describe(e: StatusEvent): string {
  if (e.kind === "burst") return `${e.operator}: ${e.element} burst`;
  if (e.kind === "reaction") return `${e.operator}: ${e.status} level ${e.level}${e.consumed ? ` (consumed ${e.consumed})` : " (forced)"}`;
  if (e.kind === "consumed") return `${e.operator}: consumed ${e.stacks} ${e.element}`;
  return `${e.operator}: combustion tick level ${e.level}`;
}

export function formatReactionCheck(c: ReactionCheck): string {
  const lines: string[] = [];
  lines.push(`Reactions: ${c.matched.length} matched, ${c.unlogged.length} predicted but not logged, ${c.unpredicted.length} logged but not predicted.`);
  if (c.withoutApplies.length) lines.push(`No inflictions in the kit (replay incomplete): ${c.withoutApplies.join(", ")}`);
  for (const m of c.matched) lines.push(`  match      ${m.t} ms → logged ${m.loggedT} ms  ${describe(m.predicted)}`);
  for (const u of c.unlogged) lines.push(`  not logged ${u.t} ms  ${describe(u.predicted)}`);
  for (const u of c.unpredicted) lines.push(`  unexpected ${u.t} ms  ${u.operator}: ${u.event}`);
  for (const o of c.other) lines.push(`  other      ${o.t} ms  ${describe(o.predicted)}`);
  return lines.join("\n");
}
