// Test helper (not a test file): every buff instance a run had. TimelineState.buffs holds only the buffs still active
// (advance prunes the ended ones), so a run's final state can't show a buff that ran out: step through the run instead.

import { advance, apply, createContext, init, type GameData, type TimelineContext, type TimelineScenario, type TimelineState } from "@efsim/engine";

export interface BuffInstance {
  readonly id: string;
  readonly owner: string;
  readonly appliedAt: number;
  /** Its end as last seen (expiresAt; Infinity for one that lasts until something ends it). */
  readonly expiresAt: number;
  /** The last frame it was seen active at (stepping by `step`). */
  readonly lastSeen: number;
}

/** Every buff instance seen active from `state` to frame `to`, stepping `step` frames (1: every frame). */
export function buffHistory(ctx: TimelineContext, state: TimelineState, to: number, step = 1): BuffInstance[] {
  const seen = new Map<string, BuffInstance>();
  for (let f = state.frame; f <= to; f += step) {
    const st = advance(ctx, state, f);
    for (const b of st.buffs) {
      if (b.appliedAt > f) continue;
      seen.set(`${b.owner}|${b.id}|${b.appliedAt}`, { id: b.id, owner: b.owner, appliedAt: b.appliedAt, expiresAt: b.expiresAt, lastSeen: f });
    }
  }
  return [...seen.values()].sort((a, b) => a.appliedAt - b.appliedAt || a.id.localeCompare(b.id));
}

/**
 * Every buff instance of a scenario's run (its rotation applied press by press), to the fight's end: between two
 * presses, the state after the first is stepped to the second's frame (buffHistory).
 */
export function scenarioBuffHistory(data: GameData, scenario: TimelineScenario, step = 1): BuffInstance[] {
  const ctx = createContext(data, scenario);
  const steps: TimelineState[] = [init(ctx)];
  for (const a of scenario.rotation) steps.push(apply(ctx, steps.at(-1) as TimelineState, a));
  const out = new Map<string, BuffInstance>();
  for (let i = 0; i < steps.length; i++) {
    const from = steps[i] as TimelineState;
    const to = i + 1 < steps.length ? (steps[i + 1] as TimelineState).frame : scenario.durationFrames;
    for (const b of buffHistory(ctx, from, to, step)) out.set(`${b.owner}|${b.id}|${b.appliedAt}`, b);
  }
  return [...out.values()].sort((a, b) => a.appliedAt - b.appliedAt || a.id.localeCompare(b.id));
}
