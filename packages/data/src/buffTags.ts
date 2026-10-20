// The game's buff tags (BuffData applyTags) that buff checks name
// (CheckBuffIdInContext tag queries, CheckBuffStackNumAdvanced on a tag) and
// what each means as a buff category with an element filter (engine
// events.ts, `buffApplied` with `categories`). Read off the common affix
// buffs' applyTags (rmxlinux Json/BuffData, batch 4 T1):
// - Susceptibility: −881002460 on every buff_common_affixes_vulnerable_*;
//   1066759270 on _physical and _all; 1427729990 on each Arts one (_fire,
//   _pulse, _crystal, _natural), _spell and _all; the element tags
//   (458037917 Heat, 1425735059 Cryo, −1640994543 Electric, −575106878
//   Nature) on their element's, _spell and _all.
// - Amp: 342438932 on _enhance_physical and _all; 486772476 only on
//   _enhance_spell and _all (an all-Arts Amp, not a single element's);
//   191477865 Cryo, −1920931676 Heat, −1046270741 Electric, 895316857 Nature
//   on their element's, _spell and _all. −1748167886 (on _all, _physical and
//   _spell, not the single Arts ones) is left out: its meaning isn't clear.
// - −1957150384 Protection (buff_common_affixes_shelter), 2029588776
//   Weakness (buff_common_affixes_weak), −1757502026 a shield (Ember's,
//   Mi Fu's, Catcher's, Thunderberge's shield buffs).

import type { BuffCategory, Element } from "@efsim/engine";

const ARTS: readonly Element[] = ["fire", "pulse", "cryst", "natural"];

/** One tag as a filter: its category; with `elements`, a buff of it reaching one of them; with `allElements`, every one. */
export interface BuffTagFilter {
  readonly category: BuffCategory;
  readonly elements?: readonly Element[];
  readonly allElements?: readonly Element[];
}

export const BUFF_TAGS: ReadonlyMap<number, BuffTagFilter> = new Map<number, BuffTagFilter>([
  [-881002460, { category: "susceptibility" }],
  [1066759270, { category: "susceptibility", elements: ["physical"] }],
  [1427729990, { category: "susceptibility", elements: ARTS }],
  [458037917, { category: "susceptibility", elements: ["fire"] }],
  [1425735059, { category: "susceptibility", elements: ["cryst"] }],
  [-1640994543, { category: "susceptibility", elements: ["pulse"] }],
  [-575106878, { category: "susceptibility", elements: ["natural"] }],
  [342438932, { category: "amp", elements: ["physical"] }],
  [486772476, { category: "amp", allElements: ARTS }],
  [191477865, { category: "amp", elements: ["cryst"] }],
  [-1920931676, { category: "amp", elements: ["fire"] }],
  [-1046270741, { category: "amp", elements: ["pulse"] }],
  [895316857, { category: "amp", elements: ["natural"] }],
  [-1957150384, { category: "protection" }],
  [2029588776, { category: "weakness" }],
  [-1757502026, { category: "shield" }],
]);

/** The shield tag: a kit buff whose game buff has it is of category `shield`. */
export const SHIELD_TAG = -1757502026;

/**
 * A tag query (any of these tags) as one `buffApplied` category filter. Exact
 * when the tags have no element filter, or all are of one category without
 * `allElements` (the union of their elements); a single tag may have
 * `allElements`. Other mixes (Physical Susceptibility or Heat Amp) aren't one
 * filter: an error, write two triggers.
 */
export function buffTagFilter(tags: readonly number[]): { categories: BuffCategory[]; elements?: Element[]; allElements?: Element[] } {
  if (tags.length === 0) throw new Error("a tag filter needs a tag");
  const filters = tags.map((t) => {
    const f = BUFF_TAGS.get(t);
    if (!f) throw new Error(`buff tag ${t} has no category filter (known: ${[...BUFF_TAGS.keys()].join(", ")})`);
    return f;
  });
  const categories = [...new Set(filters.map((f) => f.category))];
  if (filters.length === 1) {
    const [f] = filters as [BuffTagFilter];
    return { categories, ...(f.elements ? { elements: [...f.elements] } : {}), ...(f.allElements ? { allElements: [...f.allElements] } : {}) };
  }
  if (filters.every((f) => !f.elements && !f.allElements)) return { categories };
  // One category: any of the tags is the union of their elements, or no filter when one of them has none.
  if (categories.length === 1 && filters.every((f) => !f.allElements)) {
    return filters.every((f) => f.elements) ? { categories, elements: [...new Set(filters.flatMap((f) => f.elements ?? []))] } : { categories };
  }
  throw new Error(`buff tags ${tags.join(", ")} don't make one category filter (an element filter mixed with other categories or none): write a trigger per tag`);
}
