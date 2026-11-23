// Landings the log gives at another cast's frozen stop's end though they landed before it (LoggedCast.beforeStop).
import { describe, expect, it } from "vitest";
import { FPS } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { logBuffReplay, readLogFixture } from "@efsim/cli";
import { placeHits } from "../packages/logs/src/logcasts.ts";

const data = loadGameData();

describe("a7a7a40c97ed: Arcane's battle skill landing before Liino's combo stop, logged at its end", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-a7a7a40c97ed.json", import.meta.url).pathname);
  const placement = placeHits(data, fx);

  it("starts the cast at its event (2.31 s) and lands the hit and its Corrosion before the stop (3.00 s)", () => {
    const cast = placement.casts.find((c) => c.operator === "chr_0032_lizhiyan" && c.skillId === "chr_0032_lizhiyan_normal_skill" && c.start < 5000);
    expect(cast?.start).toBe(2313);
    expect(cast?.beforeStop).toBe(3859);
    const r = logBuffReplay(data, fx, placement);
    const hit = fx.hits.find((h) => h.t === 3859 && h.event === "chr_0032_lizhiyan_normal_skill_abilityrange2");
    const corrosion = fx.hits.find((h) => h.t === 3859 && h.event === "buff_common_natural_triggered");
    const ms = (l: ReturnType<typeof r.replay.landing>) => ("unknown" in l ? null : (l.frame * 1000) / FPS);
    expect(ms(r.replay.landing(hit as never))).toBeLessThan(3000);
    expect(ms(r.replay.statusLanding(corrosion as never))).toBeLessThan(3000);
  });
});
