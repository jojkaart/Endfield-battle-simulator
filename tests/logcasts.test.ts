// How logged hits are grouped into casts (packages/cli/src/logcasts.ts), on real logs: the accuracy plan's A1
// (docs/accuracy-plan.md), where casts of one key less than CAST_SLACK_MS apart were merged.

import { describe, expect, it } from "vitest";
import { loadGameData, type LogHit } from "@efsim/data";
import { readLogFixture } from "@efsim/cli";
import { distinctCasts, placeHits } from "../packages/cli/src/logcasts.ts";

const data = loadGameData();
const T = "chr_0034_typhoea";

describe("cast placement (accuracy plan A1)", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-92b450306768.json", import.meta.url).pathname);
  const placement = placeHits(data, fx);
  const shots = fx.hits.filter((h) => h.operator === T && h.event === `${T}_floating_attack1_01_projhit`).sort((a, b) => a.t - b.t);

  it("a cast whose known landings are all logged doesn't take another landing of the key: Typhoeus's hover shots, 0.6 s apart, are casts of their own", () => {
    const [a, b] = shots;
    expect((b as LogHit).t - (a as LogHit).t).toBeLessThan(1000);
    const cast = (h: LogHit | undefined) => placement.hits.get(h as LogHit)?.cast;
    expect(cast(b)).not.toBe(cast(a));
    // Her power and plain shots (a stack requirement each) are alternatives: one landing slot, each shot index 0.
    expect(shots.slice(0, 4).map((h) => placement.hits.get(h)?.index)).toEqual([0, 0, 0, 0]);
  });

  it("casts of one skill placed from the same key stay two casts in the replay's list, however close", () => {
    const starts = distinctCasts(placement).filter((c) => c.operator === T && c.skillId === `${T}_floating_attack1`).map((c) => Math.round(c.start));
    expect(starts.slice(0, 4)).toEqual([4240, 4849, 5557, 6166]);
  });

  it("Typhoeus's arrowrain is placed (its log key from the data; the mark that kept it off is gone): her ultimate is replayed", () => {
    const dbae = readLogFixture(new URL("../fixtures/zmdlogs-dbaee23b801d.json", import.meta.url).pathname);
    const rain = dbae.hits.find((h) => h.event === `${T}_ultimate_skill_arrowrain`);
    expect(placeHits(data, dbae).hits.get(rain as LogHit)?.cast.skillId).toBe(`${T}_ultimate_skillfloating`);
  });

  it("a landing at its next slot's own frame stays in its cast, though another cast seems to start between (Camille's combo in 012a)", async () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-012ae1c80ae6.json", import.meta.url).pathname);
    const C = "chr_0033_camille";
    const p = placeHits(data, fx);
    // One combo: its hits at frames 19 / 27 / 47, logged at 33910 / 34117 / 34798 ms around an attack 3 placed at 33552 ms.
    const combo = fx.hits.filter((h) => h.operator === C && h.event === `${C}_combo_skill` && h.t > 33000 && h.t < 35000);
    expect(combo.map((h) => h.t)).toEqual([33910, 34117, 34798]);
    expect(new Set(combo.map((h) => p.hits.get(h)?.cast)).size).toBe(1);
    expect(combo.map((h) => p.hits.get(h)?.index)).toEqual([0, 1, 2]);
    // Its one poised hit (hit_3) is the only Stagger the replay deals there, and the bar breaks near the log's 53.4 s, not
    // at 35.9 s (with Arcane's Cluster Strike lasers' 20 each and three combos it did).
    const { logBuffReplay } = await import("@efsim/cli");
    const first = logBuffReplay(data, fx).replay.staggers[0] as number;
    expect((first * 1000) / 30).toBeGreaterThan(45000);
  });
});

describe("the replay casts the basic-attack step the engine's state allows (accuracy plan A1)", () => {
  it("Typhoeus's second hover shot in 92b4, placed as attack 1 (one key for attacks 1–4), is replayed as attack 2 (her ABATK attempts)", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-92b450306768.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const steps = r.hits.filter((h) => h.operator === T && h.skillId.startsWith(`${T}_floating_attack`) && h.hitId.endsWith("_shot")).map((h) => h.skillId.slice(-1));
    expect(steps.slice(0, 3)).toEqual(["1", "2", "3"]);
  });
});

describe("the fight's totals (accuracy plan A3, A4)", () => {
  it("a kill: the replay's damage stops at the enemy's HP, its last hit is its time to kill (b7b3: Rhodagn dies ~1.9 s sooner in the replay)", async () => {
    const { engineHits, engineReport, logBuffReplay } = await import("../packages/cli/src/logcheck.ts");
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-b7b3762d5da8.json", import.meta.url).pathname);
    const replay = logBuffReplay(data, fx);
    const report = engineReport(data, fx, replay, engineHits(data, fx, replay));
    expect(report.totals.simulated.damage).toBeCloseTo(report.totals.logged.damage, -2);
    expect(report.errors["last hit"]).toBeLessThan(-5);
  });
});

describe("Si's strokes and Artful Intent's burst (accuracy plan A2)", () => {
  it("0eef: the logged press under Artful Intent is Initial Stroke, Final Stroke is inferred from the burst after the buff's end, and the burst lands at its logged time", async () => {
    const { logBuffReplay } = await import("@efsim/cli");
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-0eef2474a26f.json", import.meta.url).pathname);
    const r = logBuffReplay(data, fx).replay;
    const si = "chr_0036_jsspsi";
    const burst = r.hits.find((h) => h.operator === si && h.hitId === "burst_inksoul");
    expect(Math.abs(((burst?.frame ?? 0) * 1000) / 30 - 10030)).toBeLessThan(50);
    // Liino's logged battle skill during her Vocalist Stance (4187 ms) leads to nothing the log shows: not cast as End
    // Stance, so the stance's ATK stays on Si's combo at 8026 ms.
    const hit = fx.hits.find((h) => h.operator === si && h.t === 8026);
    const l = r.landing(hit as LogHit);
    expect("unknown" in l ? [] : l.modifiers.map((m) => m.source).filter((x) => x.includes("Vocalist Stance"))).toHaveLength(1);
  });
});
