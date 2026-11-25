// The kit compiler's messages and screens (improvement round 12): a hit whose written keys the data's landings don't
// log gets the whole fix in one message (backlog after round 11 point 5: four tries for Zhuang Fangyi's combo_skill_ult),
// a stale mark says to drop it, and no kit buff misses the loggedAs of a buff its source attaches to a cast (point 9).
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { KitBuff } from "@efsim/engine";
import { loadGameData, loadKits, unloggedAttachedBuffs } from "@efsim/data";
import { compiledCensus } from "../packages/cli/src/commands/kit-census.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = loadGameData();
const L = "chr_0016_laevat_";

/** Laevatain's kit file with attack1's hit changed, loaded from a scratch directory (only her kit in it). */
function loadWithHit(hit: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), "efsim-kits-"));
  mkdirSync(join(dir, "operators"));
  const raw = JSON.parse(readFileSync(join(ROOT, "packages/data/kits/operators/chr_0016_laevat.json"), "utf8")) as { skills: { skillId: string; hits: Record<string, unknown>[] }[] };
  const a1 = raw.skills.find((s) => s.skillId === `${L}attack1`) as { hits: Record<string, unknown>[] };
  a1.hits[0] = { ...a1.hits[0], ...hit };
  writeFileSync(join(dir, "operators", "chr_0016_laevat.json"), JSON.stringify(raw));
  return () => loadKits(data, dir);
}

describe("the kit compiler's messages", () => {
  it("says the whole fix for a hit logged under another key: frames written, events marked", () => {
    const events = ["chr_0016_laevat_attack2"];
    expect(loadWithHit({ events })).toThrow(/its events aren't the data's keys for its landings \(.*events: kit \[chr_0016_laevat_attack2\], data \[chr_0016_laevat_attack1\]\).*write its `frames` and mark `events` in its dataOverride/);
    // Frames marked too: the mark is stale, and the message says to drop it.
    const frames = data.kits.operators["chr_0016_laevat"]?.skills.find((s) => s.skillId === `${L}attack1`)?.hits[0]?.frames;
    expect(frames?.length).toBeGreaterThan(0);
    expect(loadWithHit({ events, frames, dataOverride: { events: "a test of the message", frames: "a test of the message" } })).toThrow(/frames: marked as differing from the data \(dataOverride\), but it agrees: drop the mark/);
    // Frames written and only events marked: it loads.
    expect(loadWithHit({ events, frames, dataOverride: { events: "a test of the message" } })().operators["chr_0016_laevat"]?.skills.find((s) => s.skillId === `${L}attack1`)?.hits[0]?.events).toEqual(events);
  });
});

describe("the likely-loggedAs screen from the data (kits.ts unloggedAttachedBuffs)", () => {
  it("finds none in the kits, and finds Glorious Memory's _valid when its loggedAs is dropped", () => {
    expect(unloggedAttachedBuffs(data.kits)).toEqual([]);
    const gm = data.kits.equipment["wpn_sword_0017"];
    expect(gm).toBeDefined();
    const without = { ...data.kits, equipment: { ...data.kits.equipment, wpn_sword_0017: { ...(gm as NonNullable<typeof gm>), buffs: (gm?.buffs ?? []).map((b): KitBuff => { const { loggedAs: _l, ...rest } = b; return rest; }) } } };
    expect(unloggedAttachedBuffs(without)).toEqual([{ kit: "wpn_sword_0017", buff: "wpn_sword_0017.ready", gameBuff: "buff_wpn_sword_0017_exist", attached: ["buff_wpn_sword_0017_valid"] }]);
  });

  it("kit-census counts the cooldowns by clock and mechanism", () => {
    const text = compiledCensus(data);
    expect(text).toMatch(/^ +\d+ {2}world: globalCd$/m);
    expect(text).toMatch(/^ +\d+ {2}raw: marker$/m);
    expect(text).toMatch(/^Kit buffs that likely need a loggedAs: none$/m);
  });
});
