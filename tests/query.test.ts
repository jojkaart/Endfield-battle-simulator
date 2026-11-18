// Questions about what a log itself says (packages/logs/src/query.ts: `efsim zmdlogs instances | census | buffs | lanes
// | control | cadence`): skill instances as the log means them, listed buffs' runs and kit buffs, a census that records
// its selection, control spans and a key's cadence.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { effectiveKit } from "@efsim/engine";
import {
  assembleCasts,
  buffLanes,
  buffsView,
  cadenceView,
  census,
  controlledFromLog,
  controlSpans,
  controlView,
  devFixtures,
  instancesView,
  listedGameBuffs,
  loggedSkillInstances,
  parseSelector,
  placeHits,
  selectItems,
} from "@efsim/logs";

const data = loadGameData();
const logs = devFixtures({ ids: ["0eef", "4e5e", "c83c"] });
const [a, b, c] = logs as [(typeof logs)[number], (typeof logs)[number], (typeof logs)[number]];

describe("skill instances as the log means them", () => {
  it("puts every placed hit of a kit skill and every cast event in exactly one instance", () => {
    for (const d of logs) {
      const inst = loggedSkillInstances(data, d.fx);
      const placement = placeHits(data, d.fx);
      const skillHits = [...placement.hits].filter(([, p]) => p.cast.kind !== null).length;
      expect(inst.reduce((n, i) => n + i.hits, 0), d.short).toBe(skillHits);
      expect(inst.reduce((n, i) => n + i.events.length, 0), d.short).toBe(d.fx.casts?.length ?? 0);
      expect(inst.every((i) => (i.from === "event" ? i.hits === 0 && i.events.length > 0 : i.hits > 0 && i.firstHit !== null))).toBe(true);
      expect(inst.map((i) => i.start)).toEqual([...inst.map((i) => i.start)].sort((x, y) => x - y));
    }
  });

  it("lists combos from their hits (some log no cast event), Arcane's Imprisonment ends and Si's hitless battle-button events as events alone", () => {
    const combos = logs.flatMap((d) => loggedSkillInstances(data, d.fx).filter((i) => i.kind === "combo"));
    expect(combos.some((i) => i.from === "hits" && i.events.length === 0)).toBe(true);
    expect(combos.filter((i) => i.from === "event").every((i) => i.operator === "chr_0032_lizhiyan")).toBe(true);
    expect(instancesView(data, a.fx, { kind: "combo" })).toMatch(/after a real combo: an entity's end logged as a cast/);
    const si = loggedSkillInstances(data, c.fx, { operator: "chr_0036_jsspsi" }).filter((i) => i.kind === "battle");
    expect(si.filter((i) => i.from === "event").length).toBeGreaterThan(si.filter((i) => i.from === "hits").length);
    expect(instancesView(data, c.fx, { operators: ["chr_0036_jsspsi"] })).toMatch(/an event only/);
  });
});

describe("listed buffs", () => {
  it("splits a buff's listing into runs by source and since, each bounded by the hits that list it", () => {
    const lanes = buffLanes(a.fx);
    expect(lanes.length).toBeGreaterThan(0);
    for (const l of lanes) {
      expect(l.firstListed).toBeLessThanOrEqual(l.lastListed);
      if (l.nextUnlisted !== null) expect(l.nextUnlisted).toBeGreaterThan(l.lastListed);
      expect(l.listedHits).toBeGreaterThan(0);
    }
    const listing = a.fx.hits.filter((h) => [...h.effects, ...h.boundaryEffects].some((e) => e.buff === lanes[0]?.buff)).length;
    expect(lanes.filter((l) => l.buff === lanes[0]?.buff).reduce((n, l) => n + l.listedHits, 0)).toBeGreaterThanOrEqual(listing);
  });

  it("maps each listed game buff to the team kit buffs whose gameBuff it is", () => {
    const listed = listedGameBuffs(data, b.fx);
    const kitGameBuffs = new Map(b.fx.team.flatMap((m) => (effectiveKit(data, m)?.buffs ?? []).flatMap((k) => (k.gameBuff ? [[k.gameBuff, `${m.operator}:${k.id}`] as const] : []))));
    const mapped = listed.filter((l) => kitGameBuffs.has(l.buff));
    expect(mapped.length).toBeGreaterThan(0);
    for (const l of mapped) expect(l.kitBuffs.map((k) => k.key)).toContain(kitGameBuffs.get(l.buff));
    expect(buffsView(data, [b])).toMatch(/= chr_\d+_\w+:\w+/);
  });
});

describe("the census", () => {
  it("records its selection and the command that reruns it, and counts what selectItems picks", () => {
    const select = parseSelector("cast:combo_skill");
    const text = census(data, logs, { select, rerun: "efsim zmdlogs census 0eef 4e5e c83c --select 'cast:combo_skill'", logs: "0eef 4e5e c83c" });
    const lines = text.split("\n");
    expect(lines[0]).toMatch(/^census: cast:\/combo_skill\/; over 3 log\(s\): 0eef 4e5e c83c$/);
    expect(lines[1]).toBe("rerun: efsim zmdlogs census 0eef 4e5e c83c --select 'cast:combo_skill'");
    const total = logs.reduce((n, d) => n + selectItems(data, d.fx, select).length, 0);
    expect(lines.at(-1)).toBe(`total: ${total} item(s)`);
    expect(() => parseSelector("combo")).toThrow(/cast:<regex>/);
  });

  it("finds the nearest item of another selection inside the window", () => {
    const text = census(data, logs, { select: parseSelector("event:attack"), near: parseSelector("cast:combo_skill"), window: { from: -2000, to: 2000 }, list: true, rerun: "x", logs: "y" });
    expect(text).toMatch(/with a near item/);
    expect(text).toMatch(/near: \S+ .* at [+-]\d+ ms|near: none/);
  });
});

describe("control and cadence", () => {
  it("gives contiguous control spans that agree with the replay's teammate attacks", () => {
    const spans = controlSpans(data, b.fx);
    expect(spans.length).toBeGreaterThan(0);
    spans.forEach((s, i) => expect(s.to === null ? i === spans.length - 1 : spans[i + 1]?.from === s.to).toBe(true));
    expect(controlView(data, b.fx)).toMatch(/CONTROL /);
    // The replay's own reading: a basic cast flagged as a teammate's is by someone not controlled then.
    const at = (t: number) => spans.find((s) => s.from <= t && (s.to === null || t < s.to))?.operator;
    const placement = placeHits(data, b.fx);
    const kits = b.fx.team.flatMap((m) => effectiveKit(data, m) ?? []);
    const flagged = controlledFromLog(placement, assembleCasts(data, b.fx, placement, kits))?.casts ?? [];
    expect(flagged.some((x) => x.teammate)).toBe(true);
    expect(flagged.every((x) => !x.teammate || at(x.start) !== x.operator)).toBe(true);
  });

  it("lists a key's hit groups with world-time gaps", () => {
    const text = cadenceView(data, [a], "chr_0036_jsspsi", /combo_skill/);
    expect(text).toMatch(/group\(s\)/);
    expect(text).toMatch(/world-time gaps: \d+|no two groups/);
  });
});
