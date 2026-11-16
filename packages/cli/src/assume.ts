// Assumption switches (docs/design.md "Rule-based rotations"; the architecture review's item 10): the kits' open
// readings that move results and wait for an in-game test (OperatorKit.assumptions, e.g. test 109: does Si's Haste come
// with every end of Artful Intent?). A command runs under chosen readings (--assume <id>=<reading>) and, with
// --assumptions, says whether its conclusion holds or flips under each other reading of an assumption the team has.

import { existsSync } from "node:fs";
import { kitAssumptions, type GameData, type TimelineScenario } from "@efsim/engine";

/** `--assume <id>=<reading>` values as readings by assumption ID (checked against the kits). */
export function parseAssume(data: GameData, values: readonly string[]): Readonly<Record<string, string>> {
  const known = kitAssumptions(data);
  const out: Record<string, string> = {};
  for (const v of values) {
    const [id, reading] = v.split("=");
    const a = known.find((x) => x.id === id);
    if (!id || !reading || !a) throw new Error(`--assume takes <id>=<reading>; the kits' assumptions: ${known.map((x) => `${x.id} (${Object.keys(x.readings).join(" / ")})`).join(", ") || "none"}`);
    if (!(reading in a.readings)) throw new Error(`--assume ${id}: no reading ${reading} (${Object.keys(a.readings).join(", ")})`);
    out[id] = reading;
  }
  return out;
}

/** The scenario under these readings (on top of any it has). */
export function underAssume<S extends Omit<TimelineScenario, "rotation">>(scenario: S, assume: Readonly<Record<string, string>>): S {
  if (Object.keys(assume).length === 0) return scenario;
  return { ...scenario, options: { ...scenario.options, assume: { ...scenario.options.assume, ...assume } } };
}

/** One other reading of an assumption the team's kits have. */
export interface Alternative {
  readonly id: string;
  readonly reading: string;
  /** "test 109's alternative (every-end: on every end of Artful Intent, …)". */
  readonly label: string;
  /** The readings to run under: the scenario's, with this one. */
  readonly assume: Readonly<Record<string, string>>;
}

/** Every reading, other than the one in use, of each assumption of the team's kits (registered in the kits' data). */
export function alternatives(data: GameData, scenario: Omit<TimelineScenario, "rotation">): Alternative[] {
  const team = new Set(scenario.team.map((b) => b.operator));
  const now = scenario.options.assume ?? {};
  return kitAssumptions(data)
    .filter((a) => team.has(a.operator))
    .flatMap((a) =>
      Object.entries(a.readings)
        .filter(([r]) => r !== (now[a.id] ?? a.default))
        .map(([reading, words]) => ({ id: a.id, reading, label: `${a.test ? `test ${a.test}'s alternative` : a.id} (${reading}: ${words})`, assume: { ...now, [a.id]: reading } })),
    );
}

/**
 * The zero-energy companion of a scenario file (examples/<team>-zero.scenario.json beside examples/<team>.scenario.json),
 * if there is one: the guided search and gear on rules judge their changes on it too by default (the owner's teams start
 * fights both ways; changes that won with full energy lost from zero, 2026-11-16).
 */
export function zeroCompanion(file: string): string | undefined {
  if (!file.endsWith(".scenario.json") || file.endsWith("-zero.scenario.json")) return undefined;
  const zero = file.replace(/\.scenario\.json$/, "-zero.scenario.json");
  return existsSync(zero) ? zero : undefined;
}

/** A paired comparison's verdict: beyond twice its standard error (and 0.1%) a gain or a loss, else noise. */
export function verdict(m: { readonly gain: number; readonly se: number }): "gain" | "loss" | "noise" {
  if (Math.abs(m.gain) <= 2 * m.se || Math.abs(m.gain) < 0.001) return "noise";
  return m.gain > 0 ? "gain" : "loss";
}

/** Whether a conclusion (a paired gain) holds under another reading: the same verdict holds, the opposite flips, else it's unclear there. */
export function holds(base: { readonly gain: number; readonly se: number }, alt: { readonly gain: number; readonly se: number }): "holds" | "flips" | "unclear" {
  const a = verdict(base);
  const b = verdict(alt);
  if (a === b) return "holds";
  return a !== "noise" && b !== "noise" ? "flips" : "unclear";
}

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`;
/** A paired gain in words: "+1.20% ± 0.40". */
export const gainText = (m: { readonly gain: number; readonly se: number }) => `${pct(m.gain)} ± ${(m.se * 100).toFixed(2)}`;
