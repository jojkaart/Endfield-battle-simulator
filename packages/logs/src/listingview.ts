// A hit's listing against its neighbours' and across logs (`zmdlogs hits --same-listing <s>`, `hits --listed <regex>`;
// round 16, the arcane-will report point 1): a lead written "the log lists X five times, the engine has two" pointed a
// round at the line count, while the combo slash 0.19 s before the final listed the same five lines and read plain
// with two; that one neighbour settled it, after the WILL buffs' data trees and the kit were read. And a cross-log
// table of one hit key's instances with their listed values took three scratch scripts over `hits --json`.
//
// - listingKey: a hit's listing as one string (its effects' buff, source and value; boundary effects left out: the
//   log can't say whether they applied, and a neighbour rarely shares them).
// - sameListingLines: the hit at a moment and the nearest hits with the same listing, with their verdicts: a
//   listing difference that reads plain next door is no cause.
// - listedEntryWords: a hit's listed entries matching a pattern, with source, since and value, for `--listed`.

import type { HitRecord } from "./hitexport.ts";
import type { LogEffect, LogFixture, LogHit } from "./zmdlogs.ts";
import { secondsText as s } from "./labels.ts";

const pct = (e: number | null | undefined) => (e === null || e === undefined ? "-" : `${(100 * e).toFixed(1)}%`);
const entry = (e: LogEffect) => `${e.buff}${e.source ? ` from ${e.source}` : ""}=${+e.value.toFixed(6)}`;

/** A hit's listing (its effects: buff, source, value; not its boundary effects), order-free. */
export function listingKey(h: Pick<LogHit, "effects">): string {
  return h.effects.map(entry).sort().join("; ");
}

/** A record's logged hit in its fixture (by time, operator, event and value). */
export function hitOfRecord(fx: Pick<LogFixture, "hits">): (r: Pick<HitRecord, "t" | "operator" | "event" | "value">) => LogHit | undefined {
  const by = new Map(fx.hits.map((h) => [`${h.t}|${h.operator}|${h.event}|${h.value}`, h]));
  return (r) => by.get(`${r.t}|${r.operator}|${r.event}|${r.value}`);
}

/** A hit's listed entries (effects, then boundary ones marked) whose buff matches, each with source, since and value. */
export function listedEntryWords(h: Pick<LogHit, "effects" | "boundaryEffects">, re: RegExp): string[] {
  const one = (e: LogEffect, boundary: boolean) => `${e.buff}${e.source ? ` from ${e.source}` : ""}${e.since !== undefined ? ` @${s(e.since)}` : ""} = ${+e.value.toFixed(6)}${boundary ? " (boundary)" : ""}`;
  return [...h.effects.filter((e) => re.test(e.buff)).map((e) => one(e, false)), ...h.boundaryEffects.filter((e) => re.test(e.buff)).map((e) => one(e, true))];
}

/** How many neighbours with the same listing to show on each side (sameListingLines). */
export const SAME_LISTING_EACH_SIDE = 4;

/**
 * `zmdlogs hits <fixture> --same-listing <s>`: the hit(s) logged nearest `t` (ms; `pick` narrows them: an operator,
 * an event key), then for each the nearest hits before and after with the very same listing (listingKey: every effect's
 * buff, source and value; not the boundary effects) and their verdicts, and a count by class over every such hit of the
 * fight. A listing difference against the replay that reads plain next door, under the same listing, is no cause.
 */
export function sameListingLines(records: readonly HitRecord[], fx: LogFixture, t: number, pick: (r: HitRecord) => boolean = () => true, each = SAME_LISTING_EACH_SIDE): string[] {
  const hitOf = hitOfRecord(fx);
  const keyed = records.flatMap((r) => {
    const h = hitOf(r);
    return h ? [{ r, key: listingKey(h), boundary: [...new Set(h.boundaryEffects.map((e) => e.buff))] }] : [];
  });
  const candidates = keyed.filter((x) => pick(x.r));
  if (!candidates.length) return [`${fx.id}: no hit to compare (check --operator / --event)`];
  const nearest = candidates.reduce((best, x) => (Math.abs(x.r.t - t) < Math.abs(best.r.t - t) ? x : best));
  const targets = candidates.filter((x) => x.r.t === nearest.r.t);
  // A hit's boundary entries (the log can't say whether they applied: not compared, but shown).
  const line = (x: (typeof keyed)[number], mark: string) => {
    const r = x.r;
    return `  ${mark} ${s(r.t).padStart(7)}  ${r.operator}  ${r.event}  ${r.class}  logged ${r.value}  predicted ${r.predicted ?? "-"}  ${pct(r.error)}${r.logError !== undefined ? `  log reading ${pct(r.logError)}` : ""}${x.boundary.length ? `  boundary: ${x.boundary.join(", ")}` : ""}`;
  };
  const out = [`${fx.id}: the hit(s) at ${s(nearest.r.t)} s and the nearest hits with the very same listing (every effect's buff, source and value; boundary effects are shown, not compared), with their verdicts; a listing difference that reads plain next door is no cause`];
  for (const x of targets) {
    const same = keyed.filter((y) => y.key === x.key && y.r !== x.r);
    const before = same.filter((y) => y.r.t <= x.r.t).slice(-each);
    const after = same.filter((y) => y.r.t > x.r.t).slice(0, each);
    const counts = new Map<string, number>();
    for (const y of same) counts.set(y.r.class, (counts.get(y.r.class) ?? 0) + 1);
    out.push(
      line(x, "AT  "),
      ...before.map((y) => line(y, "SAME")),
      ...after.map((y) => line(y, "SAME")),
      `    ${same.length} other hit(s) of the fight with this listing${same.length ? `: ${[...counts].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ")}` : " (none: compare by hand, `zmdlogs hits --listed <regex>`)"}`,
    );
  }
  return out;
}
