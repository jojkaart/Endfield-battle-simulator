// A BuffReplay for unit tests of what reads its records (round 17, round 16's own report point 3: a decisions test cast
// `{ skipped: [], … } as unknown as BuffReplay`, which compiles whatever fields BuffReplay gains or drops). fakeReplay
// takes the records a test sets, each field named as BuffReplay has it (a renamed field fails to compile), the rest
// empty; a member it doesn't fake throws "not faked" when read, so a test can't pass on a field it never set.
import type { LandedHit } from "@efsim/engine";
import type { BuffReplay } from "@efsim/logs";

/** The records fakeReplay fakes: the replay's decisions' (decisionsview.ts replayDecisions) and its landings. */
export type FakedReplay = Pick<BuffReplay, "made" | "skipped" | "tailCuts" | "tailsKept" | "failed" | "missed" | "castFlags" | "hits" | "landing" | "statusLanding">;

/** A part of a record, its fields checked by name at every depth: what a test sets of it. */
type Part<T> = T extends (...args: never[]) => unknown ? T : T extends readonly (infer E)[] ? readonly Part<E>[] : T extends object ? { readonly [K in keyof T]?: Part<T[K]> } : T;

/** A BuffReplay with `parts` (the others empty: no records, no landing for any hit); any other member throws when read. */
export function fakeReplay(parts: { readonly [K in keyof FakedReplay]?: Part<FakedReplay[K]> } = {}): BuffReplay {
  const none = () => ({ unknown: "not faked" }) as const;
  const base: Record<string, unknown> = { made: [], skipped: [], tailCuts: [], tailsKept: [], failed: [], missed: [], castFlags: [], hits: [] as LandedHit[], landing: none, statusLanding: none, ...parts };
  return new Proxy(base, {
    get(target, key) {
      if (typeof key === "symbol" || key === "then") return undefined;
      if (key in target) return target[key];
      throw new Error(`fakeReplay: BuffReplay.${key} is not faked (tests/helpers/replay.ts)`);
    },
  }) as unknown as BuffReplay;
}
