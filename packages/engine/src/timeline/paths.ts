// A skill's paths: the hits a kit jump skips, and each one's twin on the path the jump goes to. The replay of a logged
// cast (drivers.ts replayCast) moves a logged landing to the path the cast took, and the log tools ask which of a
// chance path's hits stands for which (castassembly.ts chancePathHits). Round 15 (alesh-rare-fin report point 2): "the
// same hit on the other path" was computed by hand in three places, two of them pairing by the keys alone (one key
// covers Alesh's whole combo), so the chance path's first pairing gave slam_ex the hook's landing.

import type { KitHit, KitSkill } from "../model.ts";
import type { KitTrigger } from "../events.ts";

const framesOf = (h: KitHit) => h.frames ?? [];
const sameKeys = (a: KitHit, b: KitHit) => a.events.length === b.events.length && a.events.every((e) => b.events.includes(e));

/** A skill's hits a jump at kit frame `at` to `to` skips: those with frames, every one in [at, to). */
export function skippedHits(skill: Pick<KitSkill, "hits">, at: number, to: number): KitHit[] {
  return skill.hits.filter((h) => framesOf(h).length > 0 && framesOf(h).every((f) => f >= at && f < to));
}

/**
 * A kit hit's twin on the path a jump at `at` to `to` goes to: among the skill's hits past the target (every frame at
 * or after `to`) with the same keys, the one whose frames lie nearest the hit's moved by the jump's length (to − at),
 * one with as many frames before any other; the first on a tie; undefined when none has its keys. Exactly there for
 * Alesh's Rare Fin (combo 10 → 65: hook 22 → hook_ex 77, slam 38 → slam_ex 93, all four under one key), within a frame
 * for Rossi's attack 4 not controlled (0 → 189: 6, 8, 13, 15, 23 → 195, 198, 203, 205, 213).
 */
export function pathTwin(skill: Pick<KitSkill, "hits">, hit: KitHit, at: number, to: number): KitHit | undefined {
  const by = to - at;
  const fa = framesOf(hit);
  let best: { readonly hit: KitHit; readonly cost: number } | undefined;
  for (const x of skill.hits) {
    const fx = framesOf(x);
    if (x === hit || fx.length === 0 || !fx.every((f) => f >= to) || !sameKeys(hit, x)) continue;
    // As many frames: the summed distance from the moved frames; otherwise after every such hit.
    const cost = fx.length === fa.length ? fa.reduce((s, f, i) => s + Math.abs((fx[i] as number) - f - by), 0) : Number.MAX_SAFE_INTEGER;
    if (!best || cost < best.cost) best = { hit: x, cost };
  }
  return best?.hit;
}

/**
 * A skill's chance jumps (drivers.ts ReplayCastOptions.chanceJumps): its operator's kit triggers on its own cast of the
 * skill with a `chance` whose actions are a jump on the skill, each with the skill frame it jumps at (its delay, within
 * the jump's frames) and to. Alesh's Rare Fin (rare_fin: combo frame 10 → 65, its chance from her Intellect).
 */
export function chanceJumpsOf(triggers: readonly KitTrigger[], skillId: string): { readonly trigger: string; readonly at: number; readonly to: number }[] {
  return triggers.flatMap((t) => {
    if (t.chance === undefined || t.on.event !== "cast" || t.by !== "self" || !(t.on.skills ?? []).includes(skillId) || t.do.length !== 1) return [];
    const a = t.do[0];
    if (a?.kind !== "jump" || a.skill !== skillId) return [];
    const at = Math.max(t.delay ?? 0, a.from);
    return at < a.until && a.to > at ? [{ trigger: t.id, at, to: a.to }] : [];
  });
}

/** A kit hit's landing frames: its frames, and past them, up to a literal count, its last frame `framesEvery` apart. */
export function hitLandingFrames(h: Pick<KitHit, "frames" | "count" | "framesEvery">): number[] {
  const frames = [...framesOf(h as KitHit)];
  if (typeof h.count === "number" && frames.length) for (let i = frames.length; i < h.count; i++) frames.push((frames.at(-1) as number) + (h.framesEvery ?? 0));
  return frames;
}

/**
 * A replayed cast's logged landings on the path its taken jumps (at, to) go to: a landing whose kit frame lies in a
 * taken jump's skipped part is that logged hit's landing on the jumped-to path, the landing to − at frames later of
 * the same hit (a slash both paths have) or of another hit with its keys landing there (its path twin at that frame);
 * left where it is when there is none (drivers.ts replayCast then judges the jump contradicted). Pogranichnik's combo
 * jumps from frame 0 to 200 on three Vulnerable stacks consumed: the placement gives its slashes the 4-stack path's
 * frames 23, 37, 61 by kit order, and the replay landed them there besides the 3-stack path's own 223, 237 and 261
 * (a9d7fcb089c5 49.7–50.9 s and 142.0–145.8 s, d4fb69b036fe 47.2–48.5 s: six slashes a cast, twice its SP into his
 * Living Banner's bank).
 */
export function takenPathLandings<L extends PathLanding>(skill: Pick<KitSkill, "hits">, jumps: readonly { readonly at: number; readonly to: number }[], landings: readonly L[]): L[] {
  if (jumps.length === 0) return [...landings];
  const used = new Set(landings.map((l) => `${l.hitId}|${l.nth}`));
  return landings.map((l) => {
    const hit = skill.hits.find((h) => h.id === l.hitId);
    const f = hit ? hitLandingFrames(hit)[l.nth] : undefined;
    const j = f === undefined ? undefined : jumps.find((x) => f >= x.at && f < x.to);
    if (!hit || f === undefined || !j) return l;
    const g = f + (j.to - j.at);
    for (const x of [hit, ...skill.hits.filter((y) => y !== hit && sameKeys(hit, y))]) {
      const nth = hitLandingFrames(x).indexOf(g);
      if (nth < 0 || used.has(`${x.id}|${nth}`)) continue;
      used.delete(`${l.hitId}|${l.nth}`);
      used.add(`${x.id}|${nth}`);
      return { ...l, hitId: x.id, nth };
    }
    return l;
  });
}

/** A replayed cast's landing of a kit hit (drivers.ts ReplayCastOptions.landings). */
interface PathLanding {
  readonly hitId: string;
  readonly nth: number;
  readonly frame: number;
}

/**
 * A replayed cast's logged landings on the paths its jumps took: for each jump (at, to, taken or not), a hit it skips
 * and its twin past the target (pathTwin) are one logged hit on either path, so the landings the placement gave either
 * go to the taken path's one, in frame order (renumbered). Not when the cast has more such landings than that hit lands
 * (d5720d9ceb94's attack 4 at 7.91 s: 7 landings placed in one 5-hit cast). The replay decides a jump on control by who
 * the log shows controlled (Rossi's attack 4) and a chance jump by the listing (Alesh's Rare Fin: drivers.ts
 * replayCast).
 */
export function pathLandings<L extends PathLanding>(skill: Pick<KitSkill, "hits">, jumps: readonly { readonly at: number; readonly to: number; readonly taken: boolean }[], landings: readonly L[]): L[] {
  let out = [...landings];
  for (const j of jumps) {
    for (const a of skippedHits(skill, j.at, j.to)) {
      const b = pathTwin(skill, a, j.at, j.to);
      if (!b) continue;
      const path = j.taken ? b : a;
      const mine = out.filter((l) => l.hitId === a.id || l.hitId === b.id).sort((x, y) => x.frame - y.frame);
      if (mine.every((l) => l.hitId === path.id) || mine.length > framesOf(path).length) continue;
      const renamed = new Map(mine.map((l, i) => [l, { ...l, hitId: path.id, nth: i }]));
      out = out.map((l) => renamed.get(l) ?? l);
    }
  }
  return out;
}
