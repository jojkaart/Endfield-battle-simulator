// A Combustion's ticks against the log: which attacker side each deals with (engine assumption combustion-snapshot).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, logBuffReplay, readLogFixture } from "@efsim/cli";
import { placeHits } from "../packages/logs/src/logcasts.ts";

const data = loadGameData();

describe("458b03609665: Wulfgard's Combustion ticks take the attacker side of the tick before (combustion-snapshot)", () => {
  const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-458b03609665.json", import.meta.url).pathname);
  const placement = placeHits(data, fx);
  const ticks = (reading: string) =>
    checkLog(data, fx, { replay: logBuffReplay(data, fx, placement, { assume: { "combustion-snapshot": reading } }) }).filter((v) => v.hit.operator === "chr_0006_wolfgd" && v.hit.event === "buff_common_burning_status");
  const plain = (vs: ReturnType<typeof ticks>, t: number) => {
    const v = vs.find((x) => x.hit.t === t);
    return v?.kind === "match" && v.class === "plain";
  };

  it("matches the ticks after Akekuri's team ATK came and went, which the application's snapshot misses", () => {
    const last = ticks("last-tick");
    // 89.34 s: 2941 = 1917 × 1.3 (Stagger) × 1.18 (Akekuri's weapon ATK, from 84.37 s); 230.62 s: 3190 with her
    // potential's +0.10, which the tick before lists and its own listing doesn't.
    for (const t of [89342, 90901, 93549, 162450, 228675, 230615, 233584]) expect(plain(last, t)).toBe(true);
    const application = ticks("application");
    expect([89342, 230615].filter((t) => plain(application, t))).toEqual([]);
    expect(last.filter((v) => v.kind === "match" && v.class === "plain").length).toBeGreaterThan(application.filter((v) => v.kind === "match" && v.class === "plain").length + 5);
  });
});
