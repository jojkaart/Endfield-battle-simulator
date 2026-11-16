// The raw ZMDLogs detail cache and `efsim zmdlogs raw` (packages/logs/src/zmdraw.ts), on a synthetic detail, with the
// cache in a temporary folder and no network.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readLogSplit } from "../packages/logs/src/logs.ts";
import { battleIdOf, formatRaw, rawDetail, rawDir } from "../packages/logs/src/zmdraw.ts";

const dir = mkdtempSync(join(tmpdir(), "efsim-raw-"));
const before = process.env["EFSIM_CACHE_DIR"];
process.env["EFSIM_CACHE_DIR"] = dir;
afterAll(() => {
  if (before === undefined) delete process.env["EFSIM_CACHE_DIR"];
  else process.env["EFSIM_CACHE_DIR"] = before;
  rmSync(dir, { recursive: true, force: true });
});

const detail = {
  battle: { id: "btl_upload_aaaaaaaaaaaa" },
  timelineEvents: [
    { laneType: "buff", eventKey: "buff_chr_0036_jsspsi_talent1_speedup::1", sourceCharacterKey: "chr_0036_jsspsi", targetCharacterKey: "chr_0036_jsspsi", targetEnemyKey: null, actualStartMsFromStart: 1000, actualEndMsFromStart: 6000, effects: [], dynamicEffects: [] },
    { laneType: "skill", eventKey: "chr_0036_jsspsi_normal_skill_burst", sourceCharacterKey: "chr_0036_jsspsi", targetCharacterKey: "eny_x", tsMsFromStart: 2000, value: 900, poiseDamage: { value: -10, current_value: 50, orig_source: "chr_0036_jsspsi_normal_skill_2" } },
  ],
};

describe("raw battle details", () => {
  it("fetches a detail once, then reads it from the cache", async () => {
    let calls = 0;
    const fetch = async () => {
      calls++;
      return detail;
    };
    expect((await rawDetail("btl_upload_aaaaaaaaaaaa", fetch)).fetched).toBe(true);
    expect((await rawDetail("btl_upload_aaaaaaaaaaaa", fetch)).fetched).toBe(false);
    expect(calls).toBe(1);
    expect(existsSync(join(rawDir(), "btl_upload_aaaaaaaaaaaa.json"))).toBe(true);
  });

  it("refuses a hold-out's detail", async () => {
    const [h] = readLogSplit().holdout;
    await expect(rawDetail(battleIdOf(h as string), async () => detail)).rejects.toThrow(/hold-out/);
  });

  it("prints buff lanes and events, filtered by key", () => {
    expect(battleIdOf("zmdlogs-0eef2474a26f")).toBe("btl_upload_0eef2474a26f");
    const all = formatRaw(detail);
    expect(all).toContain("buff  1000–6000 ms  buff_chr_0036_jsspsi_talent1_speedup::1");
    expect(all).toContain("Stagger -10 from chr_0036_jsspsi_normal_skill_2");
    expect(formatRaw(detail, { buffs: "speedup" }).split("\n")).toHaveLength(1);
    expect(formatRaw(detail, { events: "burst" })).not.toContain("speedup");
  });
});
