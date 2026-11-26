// The named slow-down curves the game data names but doesn't hold (TimeDilationAction useCurveKey: an asset), as
// readings: the compiler samples the guess (packages/data skillData.ts slowdownOf) and keeps the curve's name on the
// timing (SkillTiming.slowdowns `curve`), and a scenario's reading of engine assumption combo-curve resamples it
// (withCurveReading: createContext for the timeline, and the log tools' entries for their stop lists), so a guess is
// tried with `measure --variant combo-curve=<r>` rather than a patch of the compiler (round 13's backlog point 4).

import type { GameData, SkillData } from "../model.ts";
import { ENGINE_ASSUMPTIONS } from "./assumptions.ts";

/** The combo slow-down's curve name in the data (every combo's global TimeDilationAction). */
export const COMBO_CURVE = "ComboSkill";

/** The ComboSkill curve's readings over its normalised time t in [0, 1] (engine assumption combo-curve). */
export const COMBO_CURVES: Readonly<Record<string, (t: number) => number>> = {
  // 0.01 for 40% of the duration, then a linear ramp to 1 at 93% (the guess since batch 1; the logs' Corrosion ramps,
  // buff ends and landings fit it).
  guess: (t) => (t <= 0.4 ? 0.01 : t >= 0.93 ? 1 : 0.01 + ((t - 0.4) / 0.53) * 0.99),
  flat: () => 0.01,
  middle: (t) => (t <= 0.7 ? 0.01 : 0.01 + ((t - 0.7) / 0.3) * 0.99),
};

/** A curve sampled at mid-frame over `frames` frames, clamped to [0, 1] (as the compiler samples it). */
export function curveScales(at: (t: number) => number, frames: number): number[] {
  return Array.from({ length: frames }, (_, k) => Math.max(0, Math.min(1, at((k + 0.5) / frames))));
}

const byReading = new WeakMap<GameData, Map<string, GameData>>();
const readingOf = new WeakMap<GameData, { readonly raw: GameData; readonly reading: string }>();

/**
 * The game data with every ComboSkill slow-down resampled under the readings' combo-curve (the data itself under its
 * default, `guess`, or when it already is that reading's). Memoised per data and reading: one copy per variant.
 */
export function withCurveReading(data: GameData, assume: Readonly<Record<string, string>> | undefined): GameData {
  const reading = assume?.["combo-curve"] ?? ENGINE_ASSUMPTIONS.find((a) => a.id === "combo-curve")?.default ?? "guess";
  const known = readingOf.get(data);
  const raw = known?.raw ?? data;
  if (known?.reading === reading) return data;
  if (reading === "guess") return raw;
  const at = COMBO_CURVES[reading];
  if (!at) return raw;
  let memo = byReading.get(raw);
  if (!memo) byReading.set(raw, (memo = new Map()));
  const hit = memo.get(reading);
  if (hit) return hit;
  const skills: Record<string, SkillData> = {};
  for (const [id, s] of Object.entries(raw.skills)) {
    const t = s.timing;
    skills[id] = t && t.slowdowns.some((d) => d.curve === COMBO_CURVE) ? { ...s, timing: { ...t, slowdowns: t.slowdowns.map((d) => (d.curve === COMBO_CURVE ? { ...d, scales: curveScales(at, d.scales.length) } : d)) } } : s;
  }
  const out: GameData = { ...raw, skills };
  memo.set(reading, out);
  readingOf.set(out, { raw, reading });
  return out;
}
