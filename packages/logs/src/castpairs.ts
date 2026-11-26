// One pairing of casts between two placements (round 12 friction point 2: settleCheck paired each cast with the nearest
// of its key, so 9a80's Rossi battle skills read as five moved casts when one had gone; scripts/measure.ts `--changed
// placement` compared them as text). The casts that stay first, so a moved cast doesn't take a neighbour's place, then
// the moved ones by nearest start; the rest gone (only before) or new (only after).

/** A cast as the pairing reads it: whose, which skill, its start (ms). */
export interface CastAt {
  readonly operator: string;
  readonly skillId: string;
  readonly start: number;
}

/** How far a cast's start may move and still count as the same start (ms: a frame and its rounding). */
export const SAME_START_MS = 40;
/** How far a cast's start may move and still be paired as moved (ms); farther, it is gone and new. */
export const MOVED_MAX_MS = 5000;

/** Two placements' casts paired: kept (within SAME_START_MS), moved (paired within MOVED_MAX_MS), gone, new. */
export interface CastPairs<C extends CastAt> {
  readonly kept: readonly (readonly [C, C])[];
  readonly moved: readonly (readonly [C, C])[];
  readonly gone: readonly C[];
  readonly added: readonly C[];
}

/** The casts of `before` and `after` paired (CastPairs); a cast pairs only with one of the same operator and skill. */
export function pairCasts<C extends CastAt>(before: readonly C[], after: readonly C[], opts: { readonly same?: number; readonly far?: number } = {}): CastPairs<C> {
  const [same, far] = [opts.same ?? SAME_START_MS, opts.far ?? MOVED_MAX_MS];
  const used = new Set<C>();
  const key = (c: CastAt) => `${c.operator}|${c.skillId}`;
  const nearest = (c: C) =>
    after
      .filter((x) => !used.has(x) && key(x) === key(c))
      .sort((a, b) => Math.abs(a.start - c.start) - Math.abs(b.start - c.start))[0];
  const kept: (readonly [C, C])[] = [];
  const rest: C[] = [];
  for (const c of before) {
    const d = nearest(c);
    if (d && Math.abs(d.start - c.start) <= same) {
      used.add(d);
      kept.push([c, d]);
    } else rest.push(c);
  }
  const moved: (readonly [C, C])[] = [];
  const gone: C[] = [];
  for (const c of rest) {
    const d = nearest(c);
    if (d && Math.abs(d.start - c.start) <= far) {
      used.add(d);
      moved.push([c, d]);
    } else gone.push(c);
  }
  return { kept, moved, gone, added: after.filter((x) => !used.has(x)) };
}
