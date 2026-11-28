// `zmdlogs replay --trace-trigger <spec> --against-starts <game buff>` (round 22, the Estella-Akekuri report point 3):
// a kit trigger's firings in the replay beside the log's distinct starts (`since`) of the game buff it makes, from its
// owner, each firing with the nearest start within STARTS_NEAR_MS (each once), the unpaired on both sides, and the
// replay's SP just before each firing (an SP trigger's grant at the cap obtains nothing). `--against-lanes` pairs a kit
// buff's chain starts only, so a refreshed or layered buff (Positive Feedback's shared timer) or one listed per
// application (Thermite Cutter, OBJ Edge) didn't show the count; scripts/probes/sp/spcap.ts did it for three triggers.

import { FPS, SP, spAt, type GameData } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import { tracesTrigger } from "./replayrecord.ts";
import { operatorLabel, secondsText as s } from "./labels.ts";
import type { LogFixture } from "./zmdlogs.ts";

/** How far (ms) a firing and a logged start may be apart and pair. */
export const STARTS_NEAR_MS = 400;

const msOf = (f: number) => (f * 1000) / FPS;

/** One row of a firing / start pairing: either side may be missing; the replay's SP before a firing. */
export interface StartPair {
  readonly firing: number | null;
  readonly logged: number | null;
  readonly sp: number | null;
}

/** The firings (frames) of each trigger key a trace spec names (TriggerTrace: a count that rises). */
export function triggerFirings(replay: Pick<BuffReplay, "triggerTraces">, spec: string): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const t of replay.triggerTraces) {
    if (!tracesTrigger(spec, t.key) || !(t.from === null || t.to.count > t.from.count)) continue;
    out.set(t.key, [...new Set([...(out.get(t.key) ?? []), t.frame])].sort((a, b) => a - b));
  }
  return out;
}

/** The distinct starts (since, ms) the log lists of a game buff from `source` (effects and boundary effects). */
export function loggedStarts(fx: Pick<LogFixture, "hits">, buff: RegExp, source: string): number[] {
  const sinces = new Set<number>();
  for (const h of fx.hits) for (const e of [...(h.effects ?? []), ...(h.boundaryEffects ?? [])]) if (e.source === source && buff.test(e.buff) && e.since !== undefined && e.since !== null) sinces.add(e.since);
  return [...sinces].sort((a, b) => a - b);
}

/** Firings against starts: in time order, the nearest unused start within STARTS_NEAR_MS each; the starts left after. */
export function startPairs(replay: Pick<BuffReplay, "stateAt">, firings: readonly number[], starts: readonly number[]): StartPair[] {
  const used = new Set<number>();
  const out: StartPair[] = firings.map((f) => {
    const st = replay.stateAt(Math.max(0, f - 1));
    const sp = st ? spAt(st, Math.max(0, f - 1)) : null;
    const ms = msOf(f);
    const near = starts.filter((t) => !used.has(t) && Math.abs(t - ms) <= STARTS_NEAR_MS).sort((a, b) => Math.abs(a - ms) - Math.abs(b - ms))[0];
    if (near !== undefined) used.add(near);
    return { firing: ms, logged: near ?? null, sp };
  });
  for (const t of starts) if (!used.has(t)) out.push({ firing: null, logged: t, sp: null });
  return out.sort((a, b) => (a.firing ?? a.logged ?? 0) - (b.firing ?? b.logged ?? 0));
}

/** The lines: per trigger key, its pairs and counts (both, replay only, log only; replay only at the SP cap). */
export function triggerStartLines(data: GameData, fx: LogFixture, replay: Pick<BuffReplay, "triggerTraces" | "stateAt">, specs: readonly string[], buff: RegExp, window: { readonly from?: number; readonly to?: number } = {}): string[] {
  const out: string[] = [];
  const inWindow = (ms: number) => (window.from === undefined || ms >= window.from) && (window.to === undefined || ms <= window.to);
  for (const spec of specs) {
    const firings = triggerFirings(replay, spec);
    if (!firings.size) out.push(`STARTS ${spec}: no firing in the replay (trace it with --trace-trigger ${spec})`);
    for (const [key, frames] of firings) {
      const owner = key.split(":")[0] as string;
      const pairs = startPairs(replay, frames, loggedStarts(fx, buff, owner)).filter((p) => inWindow((p.firing ?? p.logged) as number));
      const cap = (sp: number | null) => sp !== null && sp >= SP.max - 0.5;
      const both = pairs.filter((p) => p.firing !== null && p.logged !== null).length;
      const replayOnly = pairs.filter((p) => p.firing !== null && p.logged === null);
      const logOnly = pairs.filter((p) => p.firing === null).length;
      out.push(`STARTS ${key} against /${buff.source}/ from ${operatorLabel(data, owner)} (the log's distinct since values, within ±${STARTS_NEAR_MS} ms): ${both} both, ${replayOnly.length} replay only (${replayOnly.filter((p) => cap(p.sp)).length} at the SP cap), ${logOnly} log only`);
      for (const p of pairs) {
        const sp = p.sp !== null ? `  SP ${p.sp.toFixed(0)}${cap(p.sp) ? " (at the cap)" : ""}` : "";
        const text = p.firing !== null && p.logged !== null ? `fired ${s(p.firing)}  logged ${s(p.logged)} (${p.logged - p.firing >= 0 ? "+" : ""}${s(p.logged - p.firing)})` : p.firing !== null ? `fired ${s(p.firing)}  replay only` : `logged ${s(p.logged as number)}  log only`;
        out.push(`  ${s((p.firing ?? p.logged) as number).padStart(7)}  ${text}${sp}`);
      }
    }
  }
  return out;
}
