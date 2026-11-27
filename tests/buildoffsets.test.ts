// The build-offset screen (packages/logs/src/buildoffsets.ts; `efsim zmdlogs offsets`, and the check in the verified and
// pending log suites): one operator's hits off by one tight factor all fight is a fit-build candidate; a spread-out
// median isn't; a buildOverride or an OFFSETS_EXPLAINED entry accounts for one.
import { describe, expect, it } from "vitest";
import { factorBoundLines, factorBounds, factorStretches, factorStretchLines, isOffsetCandidate, offsetHitsOfRecords, offsetsView, screenOffsets, unexplainedOffsets, type HitRecord, type LogFixture, type OffsetHit } from "@efsim/logs";

const hits = (operator: string, ratios: readonly number[]): OffsetHit[] => ratios.map((ratio) => ({ operator, ratio }));
const tight = (operator: string, factor: number, n = 30) => hits(operator, Array.from({ length: n }, (_, i) => factor * (1 + ((i % 5) - 2) * 0.002)));

describe("the build-offset screen", () => {
  it("finds a tight median off by 0.3% or more, not a loose one, a small one or too few hits", () => {
    const loose = hits("loose", Array.from({ length: 30 }, (_, i) => 0.5 + i * 0.05));
    const offsets = screenOffsets([...tight("food", 0.85), ...tight("fine", 1.002), ...tight("few", 0.8, 10), ...loose]);
    expect(offsets.map((o) => [o.operator, o.n, Number(o.median.toFixed(3)), isOffsetCandidate(o)])).toEqual([
      ["food", 30, 0.85, true],
      ["fine", 30, 1.002, false],
      ["few", 10, 0.8, false],
      ["loose", 30, 1.225, false],
    ]);
  });

  // Round 20 (the build-fits report point 1): the check's tolerance is ±1, so a 2.3% offset on a tight row makes most
  // hits mismatches (04d4's Ember, 80%): the screen flags an offset worth 2 damage or more on its median hit.
  it("flags a small exact offset where it costs the check's ±1, not where the hits are too small to show it", () => {
    const valued = (operator: string, factor: number, value: number) => tight(operator, factor).map((h) => ({ ...h, value, mismatch: true }));
    const offsets = screenOffsets([...valued("ember", 1.0226, 2000), ...valued("small", 1.004, 1000), ...valued("tiny", 1.004, 300)]);
    expect(offsets.map((o) => [o.operator, isOffsetCandidate(o), o.mismatched, o.medianValue])).toEqual([
      ["ember", true, 30, 2000],
      ["small", true, 30, 1000],
      ["tiny", false, 30, 300],
    ]);
  });

  // Round 20 (the build-fits report point 3): Snowshine's [0.96232, 0.96258] came from a scratch script.
  it("bounds the factor that puts every clean hit within ±1, per operator and event, and the best overlap when none does", () => {
    const rec = (event: string, value: number, exact: number): Parameters<typeof factorBounds>[0][number] => ({ operator: "chr_a", event, kind: "skill", value, crit: false, class: "mismatch", landing: { exact } as NonNullable<HitRecord["landing"]> });
    const bounds = factorBounds([rec("e1", 962, 1000), rec("e1", 1925, 2000), rec("e2", 481, 500), rec("e2", 700, 700), { ...rec("e1", 5000, 1000), crit: true }]);
    const all = bounds.find((b) => b.event === null);
    expect(all?.n).toBe(4);
    expect(all?.bound).toBeNull();
    expect(all?.best.fits).toBe(3);
    const e1 = bounds.find((b) => b.event === "e1");
    expect(e1?.bound?.[0]).toBeCloseTo(0.962, 6);
    expect(e1?.bound?.[1]).toBeCloseTo(0.963, 6);
    expect(bounds.map((b) => b.event)).toEqual([null, "e1", "e2"]);
    expect(factorBoundLines({ operators: { chr_a: { name: "Ada" } } }, [{ short: "abcd", bounds }]).slice(2)).toEqual([
      "  abcd  Ada  n 4  empty  best ×0.96250 fits 3 of 4",
      "          e1  n 2  [0.96200, 0.96300]  best ×0.96250 fits 2 of 2",
      "          e2  n 2  empty  best ×0.96200 fits 1 of 2",
    ]);
  });

  it("leaves an operator a buildOverride or an explained entry accounts for", () => {
    const fx = { id: "zmdlogs-abcd12345678", buildOverrides: [{ operator: "fitted", set: { food: "x" }, why: "fit-build" }] } as unknown as LogFixture;
    const offsets = screenOffsets([...tight("fitted", 0.9), ...tight("open", 1.2)]);
    expect(unexplainedOffsets(fx, offsets).map((o) => o.operator)).toEqual(["open"]);
  });

  it("reads the hit records' non-crit kit hits with a reading, and prints the candidates first with the next step", () => {
    const rec = (operator: string, value: number, extra: Partial<HitRecord> = {}): HitRecord => ({ fixture: "f", t: 0, operator, event: "e", kind: "skill", value, crit: false, verdict: "match", class: "plain", predicted: 1000, error: null, listed: [], ...extra }) as HitRecord;
    const records = [...Array.from({ length: 25 }, () => rec("chr_a", 900, { logReading: 1000 })), rec("chr_a", 2000, { crit: true }), rec("chr_a", 2000, { kind: "combustion" }), rec("chr_a", 2000, { class: "unvalued" })];
    const ohits = offsetHitsOfRecords(records);
    expect(ohits.length).toBe(25);
    const fx = { id: "zmdlogs-abcd12345678" } as unknown as LogFixture;
    const text = offsetsView({ operators: { chr_a: { name: "Alpha" } } }, screenOffsets(ohits).map((offset) => ({ short: "abcd", fx, offset })));
    expect(text).toMatch(/^\* abcd {2}Alpha\s+25\s+-10\.0%\s+100%\s+-10\.0%\s+0 {2}→ zmdlogs fit-build abcd --operator chr_a$/m);
    expect(text).toMatch(/1 candidate\(s\) over 1 logs, 1 with nothing accounting for them/);
    // The check's own explanation (logcheck.ts offsetExplanations) beside the fit-build hint (round 10).
    const fitted = offsetsView({ operators: {} }, screenOffsets(ohits).map((offset) => ({ short: "abcd", fx, offset, fits: ["the weapon at level 80"] })));
    expect(fitted).toMatch(/→ zmdlogs fit-build abcd --operator chr_a \(its ATK fits the weapon at level 80\)$/m);
  });
});

describe("fight-wide factors no fixture holds (round 17, the Arcane stage-factors report point 2)", () => {
  // A ×0.1 shield phase on two operators from 10 s, a plain stretch around it.
  const hit = (t: number, operator: string, ratio: number) => ({ t, operator, value: Math.round(1000 * ratio), predicted: 1000, logReading: null });
  const hits = [...Array.from({ length: 6 }, (_, i) => hit(1000 * i, "chr_a", 1)), ...Array.from({ length: 14 }, (_, i) => hit(10000 + 500 * i, i % 2 ? "chr_a" : "chr_b", 0.1)), ...Array.from({ length: 6 }, (_, i) => hit(20000 + 1000 * i, "chr_b", 1))];

  it("finds a stretch of every operator's hits at one ratio, and prints it with the operators' names", () => {
    const st = factorStretches(hits);
    expect(st).toHaveLength(1);
    expect(st[0]).toMatchObject({ from: 10000, to: 16500, factor: 0.1, at: 14, inside: 14 });
    expect(factorStretchLines({ operators: { chr_a: { name: "Ada" }, chr_b: { name: "Bo" } } }, [{ short: "abcd", stretches: st }]).at(-1)).toBe("  abcd  10.00–16.50 s  ×0.1000  14 of 14 hits at it  Bo, Ada");
  });

  it("needs two operators and enough hits", () => {
    expect(factorStretches(hits.map((h) => ({ ...h, operator: "chr_a" })))).toEqual([]);
    expect(factorStretches(hits.slice(0, 15))).toEqual([]);
  });
});
