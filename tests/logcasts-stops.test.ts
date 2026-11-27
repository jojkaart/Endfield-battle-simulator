// Cast starts across other operators' time stops (packages/logs/src/logcasts.ts castStart, heldStart), and two hits of
// one landing on two enemies in a single-target log (PlacedHit.sameAs). 2026-11-18.

import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, settleCheck, ultimateOverlaps, type LogHit } from "@efsim/logs";
import { readLogFixture } from "@efsim/cli";
import { distinctCasts, heldStart, placeHits, type TimeStop } from "../packages/logs/src/logcasts.ts";

const data = loadGameData();
const T = "chr_0034_typhoea";
const fixture = (path: string) => readLogFixture(new URL(`../fixtures/${path}`, import.meta.url).pathname);
const startOf = (path: string, operator: string, skillId: string, near: number) => {
  const casts = distinctCasts(placeHits(data, fixture(path))).filter((c) => c.operator === operator && c.skillId === skillId);
  return casts.reduce((a, c) => (Math.abs(c.start - near) < Math.abs(a.start - near) ? c : a)).start;
};

describe("heldStart: a landing's frames counted back in the world's time", () => {
  const stop = (start: number, length: number, scale: number): TimeStop => ({ start, scales: Array<number>(length).fill(scale), operator: "x", skillId: "x" });
  it("is the landing less its frame without a stop between", () => {
    expect(heldStart(10000, 30, [stop(400, 60, 0)])).toBeCloseTo(9000, 6);
  });
  it("skips a full stop's frames and counts a slow-down's at its scale", () => {
    // Landing at frame 300 (10 s), 30 frames: a full stop over frames 280–299 leaves 20 frames before it (to frame 260).
    expect(heldStart(10000, 30, [stop(280, 20, 0)])).toBeCloseTo((250 * 1000) / 30, 6);
    // At 0.5 over frames 280–299 those 20 count 10.
    expect(heldStart(10000, 30, [stop(280, 20, 0.5)])).toBeCloseTo((260 * 1000) / 30, 6);
  });
});

describe("a cast's start across another operator's time stop, from the log's cast event", () => {
  it("1cd1: Typhoeus's combo, pressed at 34.70 s, its arrows at 39.04 s after Liino's ultimate stop, starts before the stop", () => {
    const start = startOf("pending/zmdlogs-1cd1657bc305.json", T, `${T}_combo_skill`, 37000);
    expect(start).toBeGreaterThanOrEqual(34700);
    expect(start).toBeLessThan(36200);
  });
  it("not before its event: 9090's combo, pressed at 60.63 s after her shot at 60.60 s, isn't cast before the shot", () => {
    expect(startOf("pending/zmdlogs-9090afbacec9.json", T, `${T}_combo_skill`, 61000)).toBeCloseTo(60630, 0);
  });
  it("matches an event of the slot's skill: dbae's battle skill (floating_start), logged as normal_skill at 0.43 s, before Li Zhiyan's ultimate stop", () => {
    const start = startOf("zmdlogs-dbaee23b801d.json", T, `${T}_normal_skill_floating_start`, 1500);
    expect(start).toBeGreaterThanOrEqual(430);
    expect(start).toBeLessThan(930);
  });
  it("without an event near the held start, the plain one: dbae's Li Zhiyan combo (event 8.26 s) stays after Liino's ultimate stop", () => {
    expect(startOf("zmdlogs-dbaee23b801d.json", "chr_0032_lizhiyan", "chr_0032_lizhiyan_combo_skill", 8000)).toBeCloseTo(8000, -2);
  });
  it("a combo isn't held by others' combos: bdf2's Jsspsi combo (event 10.46 s) starts from its first slash, after Typhoeus's and Liino's", () => {
    expect(startOf("zmdlogs-bdf223db8e49.json", "chr_0036_jsspsi", "chr_0036_jsspsi_combo_skill", 11000)).toBeCloseTo(11470, -2);
  });
});

describe("an ultimate whose first landing travels (KitHit.travels), from its cast event at an edge of its stop (eventStopStart, 2026-11-24)", () => {
  const L = "chr_0035_liino";
  it("1cd1: Liino's event at 37.95 s ends her stop (3.6 s without a hit before it), not her projectiles at 38.73 s less frame 76", () => {
    expect(startOf("pending/zmdlogs-1cd1657bc305.json", L, `${L}_ultimate_skill`, 36000)).toBeCloseTo(37948 - (77 * 1000) / 30, -1);
  });
  it("af7b: her event at 56.50 s ends her stop, the projectiles at 59.94 s across Ardelia's, whose press at 56.84 s starts hers", () => {
    expect(startOf("pending/zmdlogs-af7b7f865906.json", L, `${L}_ultimate_skill`, 57000)).toBeCloseTo(56502 - (77 * 1000) / 30, -1);
    expect(startOf("pending/zmdlogs-af7b7f865906.json", "chr_0025_ardelia", "chr_0025_ardelia_ultimate_skill", 57000)).toBeCloseTo(56836, -1);
  });
  it("1d91: an event at the press (no hit for the stop's length after it) starts the stop there", () => {
    expect(startOf("pending/zmdlogs-1d9198480e75.json", L, `${L}_ultimate_skill`, 65000)).toBeCloseTo(64219, -1);
  });
  it("only a projectile's landing travels; another detached one only where its frame's stop covers a teammate's hit: Si's ultimate in b6aa (an ability entity's slashes) stays where her slashes place it", () => {
    expect(data.kits.operators["chr_0036_jsspsi"]?.skills.find((s) => s.skillId === "chr_0036_jsspsi_ultimate_skill")?.hits.some((h) => h.travels)).toBe(false);
    expect(data.kits.operators[L]?.skills.find((s) => s.skillId === `${L}_ultimate_skill`)?.hits.find((h) => h.id === "projectiles_first")?.travels).toBe(true);
    expect(startOf("pending/zmdlogs-b6aa15281db4.json", "chr_0036_jsspsi", "chr_0036_jsspsi_ultimate_skill", 35000)).toBeGreaterThan(35300);
  });
  it("the first song beat's start when within MIN_MOVE_MS after the event's: d9e5 stays at 6.94 s", () => {
    expect(startOf("pending/zmdlogs-d9e59d0fb737.json", L, `${L}_ultimate_skill`, 7000)).toBeCloseTo(6940, -1.5);
  });
});

describe("ultimates pressed together play their time stops in turn (logcasts.ts inTurn, 2026-11-25)", () => {
  const G = "chr_0013_aglina";
  const P = "chr_0004_pelica";
  it("fc63: Gilberta's ultimate (frame 60 at 43.58 s) before Perlica's (41.77 s), not over it: the log quiet in 39.94–41.73 s", () => {
    // Placed from its frame it was at 41.58 s, its stop over Perlica's; in turn, held by Perlica's stop: 39.92 s.
    expect(startOf("pending/zmdlogs-fc63a2001251.json", G, `${G}_ultimate_skill`, 41000)).toBeCloseTo(39920, -2);
    expect(startOf("pending/zmdlogs-fc63a2001251.json", P, `${P}_ultimate_skill`, 41000)).toBeCloseTo(41770, -2);
  });
  it("4360: an ultimate already after the other's stop stays (Gilberta's at 52.97 s, after Liino's from her event)", () => {
    expect(startOf("pending/zmdlogs-4360447193ac.json", G, `${G}_ultimate_skill`, 52000)).toBeCloseTo(52970, -2);
  });
  it("40d9: a landing batched at the other's stop end (12.95 s): the latest start the log leaves quiet, its stop ending at Si's start", () => {
    expect(startOf("zmdlogs-40d9a3c1da37.json", G, `${G}_ultimate_skill`, 10000)).toBeCloseTo(9300, -2);
  });

  it("leaves these overlapping ultimate pairs in the development logs, and no other (ultimateOverlaps; `zmdlogs placement --all`)", () => {
    // The overlap list as a measurable property (remaining-leads report point 2): a placement change that resolves a pair
    // or makes one updates this list, with the reason in its commit. scripts/probes/placement/ult-overlap.ts prints the
    // log's evidence per pair (the hits inside the earlier stop, the events).
    const pairs = devFixtures().flatMap(({ short, fx }) => ultimateOverlaps(data, placeHits(data, fx)).map((o) => `${short} ${o.a.operator}@${(o.a.start / 1000).toFixed(1)} ${o.b.operator}@${(o.b.start / 1000).toFixed(1)}`));
    expect(pairs, "the ultimates whose stops overlap after the in-turn rule changed (efsim zmdlogs placement --all): update the list with the reason").toEqual([
      "04d4 chr_0009_azrila@135.9 chr_0014_aurora@137.4",
      "04d4 chr_0014_aurora@46.9 chr_0009_azrila@47.9",
      "3f78 chr_0036_jsspsi@15.0 chr_0028_wulfa@16.9",
      "3f78 chr_0028_wulfa@16.9 chr_0013_aglina@17.2",
      "4a64 chr_0036_jsspsi@23.1 chr_0013_aglina@24.9",
      "4a64 chr_0036_jsspsi@67.1 chr_0028_wulfa@67.3",
      "4a64 chr_0032_lizhiyan@62.0 chr_0013_aglina@63.5",
      // 7910's Liino@55.2 is gone (2026-11-27, the placement-cases round's logcasts.ts rules): her finale at 59.03 s, frame 116, is her
      // 51.65 s ultimate's, its projectiles logged to 58.81 s across Ardelia's stop, not a second ultimate of its own.
      "9c6e chr_0035_liino@71.2 chr_0032_lizhiyan@71.9",
      "a7a7 chr_0036_jsspsi@45.9 chr_0035_liino@46.9",
      "b6aa chr_0032_lizhiyan@35.4 chr_0036_jsspsi@35.5",
      "d774 chr_0032_lizhiyan@120.7 chr_0004_pelica@121.1",
      "d9e5 chr_0034_typhoea@2.3 chr_0013_aglina@4.3",
      "d9e5 chr_0013_aglina@4.3 chr_0032_lizhiyan@4.5",
    ]);
  });
});

describe("the placement's passes (logcasts.ts placeHits: settleCheck)", () => {
  it("names the casts a third pass would move: 4a64's Rossi and Si, the in-turn pair at 21–25 s", () => {
    const [d] = devFixtures({ ids: ["4a64"] });
    const moved = settleCheck(data, (d as NonNullable<typeof d>).fx).map((x) => `${x.operator} ${x.now === null ? "-" : (x.now / 1000).toFixed(2)}`);
    expect(moved).toEqual(expect.arrayContaining(["chr_0028_wulfa 21.23", "chr_0036_jsspsi 23.09"]));
  });
});

describe("two hits of one landing at one time, its cast's landings all logged (a second enemy)", () => {
  it("9c6e: the second shares the first's cast, slot and landing; no shot is made twice", () => {
    const fx = fixture("pending/zmdlogs-9c6e97486a9d.json");
    const p = placeHits(data, fx);
    const shots = fx.hits.filter((h) => h.operator === T && h.event === `${T}_floating_attack1_01_projhit` && h.t === 30754);
    expect(shots).toHaveLength(2);
    const [a, b] = shots.map((h) => p.hits.get(h));
    expect(b?.cast).toBe(a?.cast);
    expect(b?.sameAs).toBe(shots[0] as LogHit);
    const near = distinctCasts(p).filter((c) => c.operator === T && c.skillId === `${T}_floating_attack1` && Math.abs(c.start - 30720) < 100);
    expect(near).toHaveLength(1);
  });
});

describe("basic-attack steps sharing a key: the latest cast says the step (logcasts.ts choose)", () => {
  const A = "chr_0025_ardelia";
  it("af7b: Ardelia's attack 1 after her attack 3 and combo is attack 1, not attack 2 from an older attack 1's window", () => {
    const fx = fixture("pending/zmdlogs-af7b7f865906.json");
    const p = placeHits(data, fx);
    const skillAt = (t: number) => fx.hits.filter((h) => h.operator === A && h.event === `${A}_attack1_projhit` && h.t === t).map((h) => p.hits.get(h)?.cast.skillId);
    // 1178 at 7785 ms is attack 1's projectile (×1.5 attack 2's 808 each, both at 9190 ms).
    expect(skillAt(7785)).toEqual([`${A}_attack1`]);
    expect(skillAt(9190)).toEqual([`${A}_attack2`, `${A}_attack2`]);
  });
});
