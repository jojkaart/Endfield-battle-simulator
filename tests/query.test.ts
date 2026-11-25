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
  lanesView,
  listedGameBuffs,
  loggedSkillInstances,
  parseSelector,
  placeHits,
  selectItems,
  worldMs,
  castTimeStops,
  replayTimeStops,
  worldTimeView,
  castEventPlace,
  logBuffReplay,
  replayView,
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

  it("selects hit groups by their Stagger origin (origin:)", () => {
    const items = logs.flatMap((d) => selectItems(data, d.fx, parseSelector("origin:normal_skill")));
    const hits = logs.flatMap((d) => d.fx.hits.filter((h) => /normal_skill/.test(h.poise?.origin ?? "")));
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(hits.length);
    for (const i of items) expect(i.label).toMatch(/\(origin .*normal_skill/);
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

describe("world time in a log (zmdlogs worldtime, lanes --world)", () => {
  it("gives the real and the world time between two moments, and the stops between", () => {
    const text = worldTimeView(data, a.fx, 2000, 8000);
    const world = worldMs(2000, 8000, replayTimeStops(data, a.fx));
    expect(world).toBeLessThan(6000);
    expect(text.split("\n")[0]).toContain(`real 6.00 s, world ${(world / 1000).toFixed(2)} s`);
    expect(text).toMatch(/frame\(s\), lowest scale/);
    expect(() => worldTimeView(data, a.fx, 8000, 2000)).toThrow(/to after from/);
  });

  it("counts the stops of casts the replay places from their cast event (round 6: db87's Laevatain ultimate)", () => {
    const [d] = devFixtures({ ids: ["db87"] });
    const fx = (d as (typeof logs)[number]).fx;
    const placed = castTimeStops(data, placeHits(data, fx).casts);
    const replayed = replayTimeStops(data, fx);
    // Every placed cast's stop is among the replay's; the ultimate at 16.6 s comes from its cast event alone.
    for (const st of placed) expect(replayed.some((r) => r.start === st.start && r.skillId === st.skillId)).toBe(true);
    const ult = replayed.find((r) => !r.placed && r.kind === "ultimate" && r.start >= 16 * 30 && r.start <= 17 * 30);
    expect(ult?.operator).toBe("chr_0016_laevat");
    expect(worldTimeView(data, fx, 16000, 21000)).toMatch(/Laevatain ultimate_skill \(ultimate\).*no placed hits/);
  });

  it("adds each listed run's world-time length", () => {
    const text = lanesView(data, a.fx, /liino_atkup$/, { world: true });
    expect(text).toMatch(/world time from since: to the last listed \d+\.\d\d s \(real \d+\.\d\d\)/);
    expect(lanesView(data, a.fx, /liino_atkup$/)).not.toContain("world time");
  });
});

describe("a cast event's place in its stop (round 11, placement leads report point 1)", () => {
  // A skill whose timing stops the world (a slow-down down to scale 0), and its stop's length in ms.
  const [skill, stopMs] = (() => {
    for (const [id, sk] of Object.entries(data.skills)) {
      const d = sk.timing?.slowdowns.find((x) => Math.min(...x.scales) === 0);
      if (d && d.scales.length >= 30) return [id, (d.scales.length * 1000) / 30] as const;
    }
    throw new Error("no skill with a full time stop");
  })();

  it("says press, the stop's end, inside or unclear by the logged hits around the event", () => {
    const t = 10000;
    expect(castEventPlace(data, [t - 100, t + stopMs + 200], { t, skill })?.place).toBe("press");
    expect(castEventPlace(data, [t - stopMs - 200, t + 100], { t, skill })?.place).toBe("end");
    expect(castEventPlace(data, [t - stopMs - 200, t + stopMs + 200], { t, skill })?.place).toBe("inside");
    expect(castEventPlace(data, [t - 100, t + 100], { t, skill })?.place).toBe("unclear");
    // A hit at the event's own ms (the log batches) is neither before nor after it.
    const p = castEventPlace(data, [t - 100, t, t + stopMs + 200], { t, skill });
    expect(p?.place).toBe("press");
    expect(p?.before).toBe(100);
    expect(p?.after).toBeCloseTo(stopMs + 200, 6);
    expect(castEventPlace(data, [], { t, skill: "no_such_skill" })).toBeNull();
  });

  it("is in `zmdlogs instances` for a skill that stops the world, with the event's log time from the placed start", () => {
    const [si] = devFixtures({ ids: ["4a64"] });
    expect(instancesView(data, (si as (typeof logs)[number]).fx, { kind: "ultimate" })).toMatch(/cast event\(s\) at .* \([+-]\d+\.\d\d s of log time from the placed start\); (the first )?logged (at its press|at its stop's end|inside a hitless stretch|at no clear edge) \(hits /);
  });
});

describe("the views' stops and the replay's ticks (round 11, kit-buff leads report point 2)", () => {
  it("leaves out, with the replay, a hitless event the replay read as a buff's tick; marks it without one", () => {
    const [d] = devFixtures({ ids: ["4d60"] });
    const fx = (d as (typeof logs)[number]).fx;
    const placement = placeHits(data, fx);
    const { replay } = logBuffReplay(data, fx, placement);
    const all = replayTimeStops(data, fx, placement);
    const kept = replayTimeStops(data, fx, placement, replay);
    const gone = all.filter((st) => !kept.includes(st) && !kept.some((k) => k.start === st.start && k.operator === st.operator && k.skillId === st.skillId));
    // 4d60's Empyrean end at 106.47 s, logged as Zhuang Fangyi's ultimate: a tick, no stop.
    expect(gone.some((st) => st.operator === "chr_0030_zhuangfy" && Math.abs((st.start * 1000) / 30 - 106470) < 100)).toBe(true);
    for (const st of gone) {
      expect(st.tickRead).toBe(true);
      expect(replay.appliedStops.some((x) => x.operator === st.operator && x.start === st.start)).toBe(false);
    }
    expect(kept.length).toBe(all.length - gone.length);
  });

  it("says on the EVENT line when the replay made a cast whose key a buff ticks as (3aa6: Zhuang Fangyi's real ultimates)", () => {
    const [d] = devFixtures({ ids: ["3aa6"] });
    const fx = (d as (typeof logs)[number]).fx;
    // From the replay's own decision (BuffReplay.skipped: not skipped as a tick), with the buff's last end in frames.
    expect(replayView(data, fx, { from: 5000, to: 9000, operators: ["chr_0030_zhuangfy"] })).toMatch(/EVENT {2}Zhuang Fangyi ultimate_skill \(the log's cast event\): its key is a tick of empyrean .*, but the replay made the cast: the buff wasn't on \(no instance ended before it\)/);
    expect(replayView(data, fx, { from: 117000, to: 117500, operators: ["chr_0030_zhuangfy"] })).toMatch(/but the replay made the cast: the buff wasn't on \(its last instance \S+–\S+ ended at frame \d+, the event's frame 3517\)/);
  });
});
