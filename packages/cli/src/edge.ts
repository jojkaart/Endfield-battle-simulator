// `efsim edge`: loadouts from pieces the player owns that put an operator's mode-deciding attributes on a knife edge
// (docs/open-problems.md "Arcane's Array Arcana on a knife edge"; in-game test 105). The game decides Arcane's mode in
// two places: a skill condition (Intellect ≥ Will, its toast flooring both: the talent's combo-cooldown cut, the skill
// set shown) and her passive buff's CompareDeckAttr (her skills' branches). If one floors and the other doesn't, a
// build whose floors tie while raw Intellect is still below Will is INT for the first and WILL for the second.

import { computeStats, type Build, type GameData } from "@efsim/engine";

/** What the player owns to try: weapons (optional: else the build's) and gear pieces, each piece usable once. */
export interface EdgePool {
  readonly weapons?: readonly Build["weapon"][];
  readonly gear: readonly Build["gear"][number][];
}

interface Candidate {
  readonly weapon: Build["weapon"];
  readonly gear: readonly Build["gear"][number][];
  readonly a: number;
  readonly b: number;
}

/** The pair of attributes a kit's mode condition compares (`attrAtLeast: [a, b]`), with the condition's ID. */
function modePair(data: GameData, operator: string): { readonly id: string; readonly a: number; readonly b: number } {
  for (const [id, p] of Object.entries(data.kits.operators[operator]?.activeConditions ?? {}))
    if (typeof p === "object" && p !== null && "attrAtLeast" in p) {
      const [a, b] = (p as { readonly attrAtLeast: readonly [number, number] }).attrAtLeast;
      return { id, a, b };
    }
  throw new Error(`${data.operators[operator]?.name ?? operator}'s kit has no mode decided by two attributes`);
}

/** Every loadout from the pool: one body, one hand and two accessories (distinct pieces), each owned weapon. */
function loadouts(data: GameData, build: Build, pool: EdgePool): { weapon: Build["weapon"]; gear: Build["gear"][number][] }[] {
  const byPart = new Map<number, Build["gear"][number][]>();
  for (const piece of pool.gear) {
    const part = data.gear[piece.id]?.part;
    if (part === undefined) throw new Error(`${piece.id} isn't a gear piece`);
    byPart.set(part, [...(byPart.get(part) ?? []), piece]);
  }
  const parts = [...byPart.keys()].sort((x, y) => (byPart.get(x)?.length ?? 0) - (byPart.get(y)?.length ?? 0));
  // The accessory part is the one a loadout holds two of: the game's part 2 (data.gear part; fixtures' "edc").
  const accessory = 2;
  const singles = parts.filter((p) => p !== accessory);
  const acc = byPart.get(accessory) ?? [];
  const pairs: Build["gear"][number][][] = [];
  for (let i = 0; i < acc.length; i++) for (let j = i + 1; j < acc.length; j++) pairs.push([acc[i] as Build["gear"][number], acc[j] as Build["gear"][number]]);
  if (acc.length === 1) pairs.push([acc[0] as Build["gear"][number]]);
  let partial: Build["gear"][number][][] = pairs.length ? pairs : [[]];
  for (const p of singles) partial = partial.flatMap((g) => (byPart.get(p) ?? []).map((piece) => [piece, ...g]));
  const weapons = pool.weapons?.length ? pool.weapons : [build.weapon];
  return weapons.flatMap((weapon) => partial.map((gear) => ({ weapon, gear })));
}

/**
 * The loadouts nearest the line, in three groups: a split (floors tie, raw first attribute below the second: the
 * skill condition by floors says the first mode, the passive by raw values the second), both checks the first mode
 * (raw first ≥ second), and both the second (floors apart).
 */
export function knifeEdge(data: GameData, build: Build, pool: EdgePool, top = 5): string {
  const pair = modePair(data, build.operator);
  const out: Candidate[] = [];
  for (const l of loadouts(data, build, pool)) {
    const p = computeStats(data, { ...build, weapon: l.weapon, gear: l.gear });
    out.push({ ...l, a: p.attrs[pair.a]?.total ?? 0, b: p.attrs[pair.b]?.total ?? 0 });
  }
  const name = (attr: number) => (attr === 41 ? "Intellect" : attr === 42 ? "Will" : `attribute ${attr}`);
  const line = (c: Candidate) =>
    `  ${name(pair.a)} ${c.a.toFixed(2)} (${Math.floor(c.a)}), ${name(pair.b)} ${c.b.toFixed(2)} (${Math.floor(c.b)}), difference ${(c.a - c.b).toFixed(2)}\n` +
    `    weapon ${c.weapon ? (data.weapons[c.weapon.id]?.name ?? c.weapon.id) : "none"}; gear ${c.gear.map((g) => `${data.gear[g.id]?.name ?? g.id} [${g.artifice.join(",")}]`).join(", ")}`;
  // One loadout per distinct pair of values (pieces whose lines don't touch the two attributes give the same pair).
  const near = (cs: Candidate[]) => {
    const seen = new Set<string>();
    return [...cs]
      .sort((x, y) => Math.abs(x.a - x.b) - Math.abs(y.a - y.b))
      .filter((c) => {
        const k = `${c.a.toFixed(4)}|${c.b.toFixed(4)}`;
        return seen.has(k) ? false : (seen.add(k), true);
      })
      .slice(0, top);
  };
  const split = out.filter((c) => Math.floor(c.a) === Math.floor(c.b) && c.a < c.b);
  const first = out.filter((c) => c.a >= c.b);
  const second = out.filter((c) => Math.floor(c.a) < Math.floor(c.b));
  const group = (title: string, cs: Candidate[]) => [title, ...(cs.length ? near(cs).map(line) : ["  none in this pool"])].join("\n");
  return [
    `${data.operators[build.operator]?.name ?? build.operator}: ${out.length} loadouts from the pool; mode condition ${pair.id} (${name(pair.a)} ≥ ${name(pair.b)}).`,
    `Values are the engine's stat panel (two decimals; the game's toast shows the whole parts in brackets). Check the in-game panel against them first.`,
    "",
    group(`Split candidates (whole parts tie, raw ${name(pair.a)} below ${name(pair.b)}): if one check floors and the other doesn't, these come out differently`, split),
    "",
    group(`Both checks the first mode (raw ${name(pair.a)} ≥ ${name(pair.b)}), nearest the line: controls`, first),
    "",
    group(`Both checks the second mode (whole parts apart), nearest the line: controls`, second),
  ].join("\n");
}
