// How a stack group's instances are ranked (KitBuff.priority) against what the game data does when it creates
// them: a CreateBuffAction may fill the game buff's priority key from another value (assignItems). Where it does,
// the kit must state the priority itself; where nothing fills the key, the loader's reading (the applying skill's
// value of the key, else the buff's own) stands.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData, readBuffFile, sourceDir } from "@efsim/data";

const data = loadGameData();

type Assign = { readonly inputValueKey: string | null; readonly targetKey: string; readonly useDirectValue: boolean; readonly numericValue: number };
/** Per game buff, how each CreateBuffAction in the fetched SkillData and BuffData fills its blackboard: file → items. */
function creations(): Map<string, { file: string; items: readonly Assign[] }[]> {
  const out = new Map<string, { file: string; items: readonly Assign[] }[]>();
  const walk = (o: unknown, file: string): void => {
    if (Array.isArray(o)) for (const x of o) walk(x, file);
    else if (o && typeof o === "object") {
      const r = o as Record<string, unknown>;
      if (String(r["$type"]).includes("CreateBuffAction") && Array.isArray(r["buffs"])) {
        for (const b of r["buffs"] as Record<string, unknown>[]) {
          if (typeof b["buffId"] !== "string") continue;
          const items = b["assignBlackboard"] === true && Array.isArray(b["assignItems"]) ? (b["assignItems"] as Assign[]) : [];
          out.set(b["buffId"], [...(out.get(b["buffId"]) ?? []), { file, items }]);
        }
      }
      for (const v of Object.values(r)) walk(v, file);
    }
  };
  for (const dir of ["SkillData", "BuffData"]) {
    const root = join(sourceDir("rmxlinux"), "Json", dir);
    for (const f of readdirSync(root)) if (f.endsWith(".json")) walk(JSON.parse(readFileSync(join(root, f), "utf8")), f);
  }
  return out;
}

describe("stack-group priorities against the data's CreateBuffActions", () => {
  const made = creations();
  const grouped = [...Object.entries(data.kits.operators), ...Object.entries(data.kits.equipment)].flatMap(([owner, k]) =>
    (k.buffs ?? []).filter((b) => b.priority && b.gameBuff).map((b) => ({ name: `${owner}:${b.id}`, b, key: readBuffFile(b.gameBuff as string)?.stacking.priorityKey })));

  it("finds grouped buffs and their creations (a control)", () => {
    expect(grouped.length).toBeGreaterThan(40);
    expect(made.get("buff_wpn_pistol_0008")?.length).toBeGreaterThan(0);
  });

  it("a kit states the priority exactly where the game fills the priority key from another value", () => {
    const wrong: string[] = [];
    for (const { name, b, key } of grouped) {
      const fills = (made.get(b.gameBuff as string) ?? []).flatMap((c) => c.items.filter((i) => i.targetKey === key).map((i) => ({ ...i, file: c.file })));
      const fromElsewhere = fills.filter((i) => i.useDirectValue || i.inputValueKey !== key);
      const p = b.priority;
      // Filled from another value at creation: the effect reading the key (`effect`) or the kit (`kit`) must say what it is.
      if (fromElsewhere.length && p?.from === "key") wrong.push(`${name}: the data fills ${key} from ${fromElsewhere.map((i) => (i.useDirectValue ? i.numericValue : i.inputValueKey)).join(", ")} (${fromElsewhere[0]?.file}): state the kit's priority`);
      // No applier has the key and the buff's own value is 0: the key comes from where the buff is created (a parent buff), which the loader can't read.
      const unread = p?.from === "key" && p.skills?.length === 0 && p.otherwise === 0;
      if (unread) wrong.push(`${name}: no skill applying it has ${key} and the buff's own is 0 (filled where it's created: ${fills.map((i) => i.file).join(", ") || "nowhere found"}): state the kit's priority`);
      if (p?.from === "kit" && !fromElsewhere.length && !(fills.length && b.priority?.skills === undefined)) {
        // A kit's own priority stands only where the loader's reading can't: filled elsewhere, or by a creator it doesn't read.
        if (!fills.length) wrong.push(`${name}: states a priority, but nothing in the data fills ${key}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
