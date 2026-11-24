// Which clock a kit trigger's cooldown runs on (KitTrigger.cooldownClock): the kit compiler reads it from the game's
// mechanism behind the cooldown (packages/data skillData.ts cooldownTimers, kits.ts cooldownClockOf). A CD timer
// (AddGlobalCDTimer) or a `…_cd` buff is on the world's clock, held by stops and hidden holds; a timed marker
// (CreateTimedMarker) on raw time. The engine side: tests/holds.test.ts (holdWorld), tests/kit-chen.test.ts (the
// example's Swordmancer held by Chen's ultimate stop).
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cooldownTimers, loadGameData, loadKits } from "@efsim/data";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = loadGameData();
const clockOf = (owner: string, trigger: string): string | undefined => {
  const kit = data.kits.operators[owner] ?? data.kits.equipment[owner];
  const t = kit?.triggers.find((x) => x.id === trigger);
  if (!t) throw new Error(`no trigger ${trigger} in ${owner}`);
  return t.cooldownClock ?? "raw";
};

describe("a trigger's cooldown clock from the data", () => {
  it("finds the mechanisms: Swordmancer's CD timer, Glorious Memory's timed marker, Claymore 0004's cooldown buff", () => {
    expect(cooldownTimers("passive_equipsuit_physuit_01")).toContainEqual({ kind: "globalCd", length: "duration" });
    expect(cooldownTimers("sk_wpn_sword_0017")).toEqual([{ kind: "marker", length: "cd" }]);
    expect(cooldownTimers("sk_wpn_claym_0004")).toContainEqual({ kind: "cdBuff", length: "cd_duraton" });
  });

  it("puts the CD timers and cooldown buffs on the world's clock, the timed markers on raw time", () => {
    expect(clockOf("suit_phy01", "suit_phy01.proc")).toBe("world");
    expect(clockOf("chr_0031_mifu", "p3_shield_atk")).toBe("world");
    expect(clockOf("chr_0023_antal", "talent1_heal")).toBe("world");
    expect(clockOf("wpn_claym_0004", "wpn_claym_0004.on_hit")).toBe("world");
    expect(clockOf("wpn_sword_0017", "wpn_sword_0017.on_vulnerable")).toBe("raw");
    expect(clockOf("wpn_sword_0005", "wpn_sword_0005.on_physical_status")).toBe("raw");
    expect(clockOf("chr_0011_seraph", "crystal_heal")).toBe("raw");
    // Written by the kit where the trigger reaches no source: its cooldown buff (passive_teammate_cd).
    expect(clockOf("chr_0016_laevat", "final_strike_absorb")).toBe("world");
  });

  it("refuses a written clock where the data says it", () => {
    const dir = mkdtempSync(join(tmpdir(), "efsim-kits-"));
    mkdirSync(join(dir, "equipment"));
    const raw = JSON.parse(readFileSync(join(ROOT, "packages/data/kits/equipment/suit_phy01.json"), "utf8")) as { triggers: Record<string, unknown>[] };
    (raw.triggers[0] as Record<string, unknown>)["cooldownClock"] = "raw";
    writeFileSync(join(dir, "equipment", "suit_phy01.json"), JSON.stringify(raw));
    expect(() => loadKits(data, dir)).toThrow(/cooldownClock raw is the data's to say \(world/);
  });
});
