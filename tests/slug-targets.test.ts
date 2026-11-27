// Hard 33's Woodcraft Slugs (pending/zmdlogs-63398339803e.json, pending/zmdlogs-7b54dc249bcd.json): eight slugs of
// 1.2 Max HP under the one id, the fixtures' severalTargets (scripts/probes/targets/slugs.ts), and the replay's enemy
// shedding the team's debuffs at each logged kill of such a fight (engine assumption logged-purges `log-kills`:
// enginecheck.ts killPurges).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { Attr } from "@efsim/engine";
import { checkLog, devFixtures, engineHits, killGaps, killPurges, logBuffReplay, type LogFixture, type LogHit } from "@efsim/logs";
import { snapshotEntry, SEVERAL_TARGETS_KEY } from "../packages/logs/src/snapshotentry.ts";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;

describe("Hard 33's Woodcraft Slugs", () => {
  it("both slug logs total eight slugs of 1.2 Max HP and carry severalTargets", () => {
    for (const id of ["6339", "7b54"]) {
      const fx = fixture(id);
      const max = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp] as number;
      const total = fx.hits.reduce((s, h) => s + h.value, 0);
      expect(total / (1.2 * max)).toBeCloseTo(8, 3);
      expect(fx.severalTargets?.why).toMatch(/Woodcraft Slugs/);
      expect((snapshotEntry(data, fx).totals as Record<string, unknown>)[SEVERAL_TARGETS_KEY]).toBe(1);
    }
  });

  it("6339's kills fall at whole slugs of damage (two at one ms at 11.31 s)", () => {
    const fx = fixture("6339");
    const max = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp] as number;
    const upTo = (t: number) => fx.hits.filter((h) => h.t <= t).reduce((s, h) => s + h.value, 0) / (1.2 * max);
    const kills = [...new Set(fx.hits.filter((h) => h.uncapped !== undefined && h.uncapped !== null && h.uncapped > h.value).map((h) => h.t))];
    expect(kills.map((t) => Math.round(upTo(t) * 100) / 100)).toEqual([1, 3, 4.46, 5, 6, 7, 8]);
  });

  it("purges at each kill of a several-targets fight only", () => {
    const fx = fixture("7b54");
    const kills = killGaps(fx).map((k) => k.from);
    expect(kills).toEqual([16360, 19592, 32944, 47477]);
    expect(killPurges(fx)).toEqual([492, 589, 989, 1425]);
    const { severalTargets: _, ...unmarked } = fx;
    expect(killPurges(unmarked as LogFixture)).toEqual([]);
  });

  // 7b54 19.00 s: Si's attack 1 on the slug after the 16.36 s kills, without the killed slugs' debuffs (Arcane's WILL
  // lines, Camille's Susceptibility, Jade Vessel): ×0.763 with them on.
  it("reads 7b54's hits after a kill without the killed slug's debuffs (log-kills)", () => {
    const fx = fixture("7b54");
    const hit = fx.hits.find((h) => h.t === 18999 && h.event === "chr_0036_jsspsi_attack1") as LogHit;
    const verdictUnder = (reading: string) => {
      const replay = logBuffReplay(data, fx, { assume: { "logged-purges": reading } });
      const v = checkLog(data, fx, { replay, engineHits: engineHits(data, fx, replay) }).find((x) => x.hit === hit);
      return v?.kind === "match" ? v.class : v?.kind;
    };
    expect(verdictUnder("log-kills")).toBe("plain");
    expect(verdictUnder("log")).toBe("mismatch");
  });
});
