// Misprediction statistics, 2026-11-24: every team kit buff of the development logs with the properties the analysis
// groups disagreements by (target, duration, stacks, consumed by a cast, instance buff, ends with its cast, where it
// comes from: weapon / gear set / the operator's own, and which trigger events apply it).
//   node scripts/probes/stats/buffprops.ts   (writes scratch/stats/buffs.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadGameData } from "@efsim/data";
import { effectiveKit } from "@efsim/engine";
import { devFixtures } from "@efsim/logs";

const data = loadGameData();
const out: Record<string, unknown> = {};
const walk = (x: unknown, f: (a: Record<string, unknown>) => void): void => {
  if (Array.isArray(x)) for (const y of x) walk(y, f);
  else if (x && typeof x === "object") {
    f(x as Record<string, unknown>);
    for (const v of Object.values(x)) walk(v, f);
  }
};
for (const { fx } of devFixtures()) {
  for (const b of fx.team) {
    const kit = effectiveKit(data, b);
    if (!kit) continue;
    for (const def of kit.buffs) {
      const key = `${b.operator}:${def.id}`;
      if (out[key]) continue;
      const on = new Set<string>();
      for (const t of kit.triggers) {
        let applies = false;
        walk(t.do, (a) => {
          if (a["kind"] === "buff" && a["buff"] === def.id) applies = true;
        });
        if (applies) on.add(String((t.on as { event?: string }).event ?? "?") + ((t.on as { crit?: boolean }).crit !== undefined ? ":crit" : ""));
      }
      const fromHits = kit.skills.some((s) => s.hits.some((h) => (h.buffs ?? []).some((x) => x.buff === def.id)));
      if (fromHits) on.add("kit hit");
      out[key] = {
        target: def.target,
        duration: def.duration ?? null,
        maxStacks: def.maxStacks ?? null,
        consumedBy: def.consumedBy ?? null,
        instances: def.instances ?? null,
        endsWithCast: def.endsWithCast ?? false,
        sharedTimer: def.sharedTimer ?? false,
        every: def.every ?? null,
        origin: def.id.startsWith("wpn_") ? "weapon" : def.id.startsWith("suit_") ? "gear" : "own",
        on: [...on].sort(),
      };
    }
  }
}
mkdirSync(join(process.cwd(), "scratch", "stats"), { recursive: true });
writeFileSync(join(process.cwd(), "scratch", "stats", "buffs.json"), JSON.stringify(out, null, 1));
process.stdout.write(`${Object.keys(out).length} kit buffs\n`);
