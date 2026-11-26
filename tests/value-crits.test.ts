// Crits the log leaves out that the hits' values show (replaycrits.ts valueCrits): 5082's Yvonne, and a cross-validation
// on Rossi's logged crits (split from tests/buffreplay-fixtures.test.ts, 2026-11-23).
import { describe, expect, it } from "vitest";
import { effectiveKit } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { valueCrits, type LogFixture, type LogHit } from "@efsim/logs";
import { logBuffReplay, readLogFixture } from "@efsim/cli";
import { placeHits } from "../packages/logs/src/logcasts.ts";

const data = loadGameData();

describe("5082ceaffad1: crits the hits' values show where the log gives none (valueCrits, 2026-11-23)", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-5082ceaffad1.json", import.meta.url).pathname);
  const kits = fx.team.flatMap((b) => effectiveKit(data, b) ?? []);
  const yvonne = (t: number, event: string) => fx.hits.findIndex((h) => h.t === t && h.event === `chr_0017_yvonne_${event}`);

  it("takes Yvonne's ultimate hits ×3 above their neighbours as crits, not the neighbours", () => {
    const crits = valueCrits(kits, fx, placeHits(data, fx));
    // attack1 at 45636, 45761 and 45971 ms: 34125, 11375, 34125; the log gives none of them a crit flag.
    expect(fx.hits[yvonne(45971, "ult_attack1_projhit")]?.crit).toBeNull();
    expect(crits.get(yvonne(45636, "ult_attack1_projhit"))).toBe(true);
    expect(crits.get(yvonne(45971, "ult_attack1_projhit"))).toBe(true);
    expect(crits.has(yvonne(45761, "ult_attack1_projhit"))).toBe(false);
  });

  it("keeps MI Security's layers, which each of her crits refreshes, on her finisher (49.78 s), as the log lists them", () => {
    const r = logBuffReplay(data, fx);
    const finisher = fx.hits.find((h) => h.t === 49782 && h.event === "chr_0017_yvonne_ult_attack_end") as LogHit;
    // Without the crits they ran out at 49.73 s: the finisher ×1.17 below the log.
    expect(r.replay.instances(finisher, "buff_equipsuit_critsuitatk_01")).toBe(5);
  });
});

describe("valueCrits against Rossi's logged crits (489c0be3e162): half the flags hidden", () => {
  it("reads the hidden flags back from the values, and not from values moved between hits of a key (negative control)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-489c0be3e162.json", import.meta.url).pathname);
    const kits = fx.team.flatMap((b) => effectiveKit(data, b) ?? []);
    const precision = (values: (h: LogHit, i: number) => number) => {
      let [right, all] = [0, 0];
      for (const fold of [0, 1]) {
        const hide = (i: number) => i % 2 === fold && fx.hits[i]?.crit !== null;
        const hidden: LogFixture = { ...fx, hits: fx.hits.map((h, i) => ({ ...h, value: values(h, i), crit: hide(i) ? null : h.crit })) };
        for (const [i, c] of valueCrits(kits, hidden, placeHits(data, hidden))) {
          if (!hide(i)) continue;
          all++;
          if (fx.hits[i]?.crit === c) right++;
        }
      }
      return { all, right: right / all };
    };
    const own = precision((h) => h.value);
    expect(own.all).toBeGreaterThan(50);
    expect(own.right).toBeGreaterThan(0.97);
    // Each value from another hit of its key (a fixed shuffle).
    const byKey = new Map<string, number[]>();
    for (const h of fx.hits) byKey.set(`${h.operator}|${h.event}`, [...(byKey.get(`${h.operator}|${h.event}`) ?? []), h.value]);
    const shuffled = precision((h, i) => {
      const vs = byKey.get(`${h.operator}|${h.event}`) as number[];
      return vs[(i * 7919 + 13) % vs.length] as number;
    });
    // As measured 2026-11-23: 62 of 62 right; shuffled 32 of 40 (her flagged hits' base rate 0.64: a high value of a key
    // is more often a crit, wherever it lands).
    expect(shuffled.right).toBeLessThan(0.9);
  });
});
