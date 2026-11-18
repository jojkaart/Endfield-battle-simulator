// Cast starts across other operators' time stops (packages/logs/src/logcasts.ts castStart, heldStart), and two hits of
// one landing on two enemies in a single-target log (PlacedHit.sameAs). 2026-11-18.

import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { type LogHit } from "@efsim/logs";
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
