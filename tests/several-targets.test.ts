// A fight against several targets under one enemy id read per target (engine assumption several-targets `targets`:
// packages/logs targets.ts, enginecheck.ts fightTargets; docs/design/data.md "Several targets"): each logged hit on a
// target, each target's own debuffs, a kill ending its own target's only, a kill gap with targets left, and a landing
// counted once per target in the totals.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import type { LandedHit } from "@efsim/engine";
import { assignTargets, checkLog, devFixtures, engineHits, gapsWithTargetsLeft, killGaps, logBuffReplay, type LogFixture, type LogHit, type TargetHitInput } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;
const ONE = { "several-targets": "one" };

/** A logged hit at `t` ms (`uncapped` above its value: a kill). */
const hit = (t: number, value: number, uncapped?: number): LogHit => ({ t, operator: "op", event: "op_hit", value, crit: false, element: null, effects: [], boundaryEffects: [], unquantified: [], ...(uncapped !== undefined ? { uncapped } : {}) }) as unknown as LogHit;
const landing = (frame: number) => ({ frame, operator: "op", skillId: "s", hitId: "h", exact: 0 }) as unknown as LandedHit;
/** A hit whose reading fits its value exactly when `fitsWithout` is the set of units it drops (any order). */
const input = (h: LogHit, l: LandedHit, units: string[], fitsWithout: string[][]): TargetHitInput => ({
  hit: h,
  landing: l,
  frame: l.frame,
  units: units.map((key) => ({ key, appliedAt: 0, expiresAt: 10_000 })),
  fits: (drop) => fitsWithout.some((w) => w.length === drop.size && w.every((k) => drop.has(k))),
});

describe("targets.ts assignTargets", () => {
  it("puts two logged hits one landing stands for on two targets, and a kill ends its own", () => {
    const l = landing(30);
    const [a, b, c] = [hit(1000, 100), hit(1000, 100), hit(2000, 50, 80)];
    const t = assignTargets({ severalTargets: { why: "", atOnce: 2 } }, [input(a, l, [], [[]]), input(b, l, [], [[]]), input(c, landing(60), [], [[]])]);
    expect(t.of.get(a)?.target).not.toBe(t.of.get(b)?.target);
    expect(t.of.get(c)?.kills).toBe(true);
    expect(t.count).toBe(2);
  });

  it("decides an open unit by the first hit only one choice fits, and holds the target to it", () => {
    // 7b54's shape: the first slug's hit fits with Jade Vessel, the next one only without it; a later hit that fits
    // with it goes back to the first slug, one that fits only without it to the second.
    const [h1, h2, h3, h4] = [hit(1000, 1), hit(2000, 2), hit(3000, 3), hit(4000, 4)];
    const t = assignTargets({ severalTargets: { why: "", atOnce: 8, fromStart: true } }, [
      input(h1, landing(30), ["jv"], [[]]),
      input(h2, landing(60), ["jv"], [["jv"]]),
      input(h3, landing(90), ["jv"], [[]]),
      input(h4, landing(120), ["jv"], [["jv"]]),
    ]);
    const [a, b, c, d] = [h1, h2, h3, h4].map((h) => t.of.get(h));
    expect(a?.target).toBe(0);
    expect(b?.target).toBe(1);
    expect([...(b?.drop ?? [])]).toEqual(["jv"]);
    expect(c?.target).toBe(0);
    expect(d?.target).toBe(1);
    expect(d?.how).toBe("fits");
  });

  it("puts a hit no state fits on the target hit last, read with what it is known to lack", () => {
    const [h1, h2, h3] = [hit(1000, 1), hit(2000, 2), hit(3000, 3)];
    const t = assignTargets({ severalTargets: { why: "", atOnce: 1 + 1 } }, [input(h1, landing(30), ["x"], [["x"]]), input(h2, landing(60), ["x"], [[]]), input(h3, landing(90), ["x"], [])]);
    expect(t.of.get(h3)?.how).toBe("none fits");
    expect(t.of.get(h3)?.target).toBe(t.of.get(h2)?.target);
    expect([...(t.of.get(h3)?.drop ?? [])]).toEqual([]);
  });

  it("with ids `landings` (the second replay's assignment), numbers a new target as a target its landing reached", () => {
    // The second replay's landings carry the first assignment's ids (LandedHit.target, otherTargets): a new target
    // takes one of its landing's no target has yet, the first that fits; none free, an id past every landing's.
    const on = (frame: number, target: number, ...others: number[]) => ({ ...landing(frame), target, ...(others.length ? { otherTargets: others.map((t) => ({ target: t, enemy: {} })) } : {}) }) as unknown as LandedHit;
    const twins = on(30, 4, 2);
    const [a, b, c, d] = [hit(1000, 1), hit(1000, 1), hit(2000, 2), hit(3000, 3)];
    // a and b one landing on targets 4 and 2, each with unit x; c, landed on target 2, fits only without x, so on a new
    // target (2 is taken); d, landed on 4, with x.
    const fx = { severalTargets: { why: "", atOnce: 8, fromStart: true as const } };
    const inputs = [input(a, twins, ["x"], [[]]), input(b, twins, ["x"], [[]]), input(c, on(60, 2), ["x"], [["x"]]), input(d, on(90, 4), ["x"], [[]])];
    const t = assignTargets(fx, inputs, { ids: "landings" });
    expect([a, b, c, d].map((h) => t.of.get(h)?.target)).toEqual([4, 2, 5, 4]);
    // In order of first hit (the default).
    const o = assignTargets(fx, inputs);
    expect([a, b, c, d].map((h) => o.of.get(h)?.target)).toEqual([0, 1, 2, 0]);
  });

  it("puts a landing's third logged hit on a target its twins have when atOnce allows no third", () => {
    const l = landing(30);
    const hs = [hit(1000, 1), hit(1000, 1), hit(1000, 1)];
    const t = assignTargets({ severalTargets: { why: "", atOnce: 2, fromStart: true } }, hs.map((h) => input(h, l, [], [[]])));
    expect(t.count).toBe(2);
    expect(t.of.get(hs[2] as LogHit)?.how).toBe("none fits");
  });
});

describe("several targets in the slug logs", () => {
  it("keeps 6339's kill gaps with slugs left (fromStart), not 9c6e's", () => {
    const fx = fixture("6339");
    expect(fx.severalTargets).toMatchObject({ atOnce: 8, fromStart: true });
    // Kills at 10.35, 11.31 (two), 20.37, 24.02, 29.38 s and so on: every gap before the eighth kill has slugs left.
    expect(gapsWithTargetsLeft(fx, killGaps(fx)).map((g) => g.from)).toEqual(killGaps(fx).map((g) => g.from));
    const two = fixture("9c6e");
    expect(gapsWithTargetsLeft(two, killGaps(two))).toEqual([]);
  });

  // 6339 23.04 s: Laevatain's battle skill on the slug after the 20.37 s kill, which had Camille's Vesperwings from
  // her 20.10 s landing (the log lists it from 20.60 s): read as one target the kill shed it (×1.12 low, the log's
  // listing fits), per target the next slug keeps it.
  it("reads 6339's 23.04 s hit with the Susceptibility the next slug kept (per target, not as one)", () => {
    const fx = fixture("6339");
    const h = fx.hits.find((x) => x.t === 23044 && x.event === "chr_0016_laevat_normal_skill_abilityentity") as LogHit;
    const verdictUnder = (assume: Readonly<Record<string, string>>) => {
      const replay = logBuffReplay(data, fx, { assume });
      const v = checkLog(data, fx, { replay, engineHits: engineHits(data, fx, replay) }).find((x) => x.hit === h);
      return v?.kind === "match" ? v.class : v?.kind;
    };
    expect(verdictUnder({})).toBe("plain");
    expect(verdictUnder(ONE)).toBe("fallback");
  });

  // 9c6e: two Wanderers, Typhoeus's shots and bursts logged twice at one ms; per target a landing stands for each
  // fitting twin, so less of the fight is log-only ("a landing a teammate's hit's"), and the shares still add up.
  it("counts 9c6e's landings once per target whose hit fits them", async () => {
    const { engineReport } = await import("../packages/logs/src/logcheck.ts");
    const { totalsShares } = await import("../packages/logs/src/enginecheck.ts");
    const fx = fixture("9c6e");
    const shares = (assume: Readonly<Record<string, string>>) => {
      const replay = logBuffReplay(data, fx, { assume });
      return totalsShares(fx.hits, engineReport(data, fx, replay, engineHits(data, fx, replay)).totals);
    };
    const [per, once] = [shares({}), shares({ "several-targets": "targets-once" })];
    expect(per.logOnly).toBeGreaterThan(once.logOnly + 0.02);
    expect(per.matched + per.replayOnly + per.logOnly).toBeCloseTo(per.error, 6);
  });
});
