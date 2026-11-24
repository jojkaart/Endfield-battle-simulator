// Misprediction statistics, 2026-11-24: operator ids → display names for the analysis's tables, and (round 11) weapon
// and gear set ids → display names for its kit buff labels (analyze.py equipment_name).
//   node scripts/probes/stats/names.ts   (writes scratch/stats/names.json and equipment.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const out = Object.fromEntries(Object.entries(data.operators).map(([id, op]) => [id, op.name]));
mkdirSync(join(process.cwd(), "scratch", "stats"), { recursive: true });
writeFileSync(join(process.cwd(), "scratch", "stats", "names.json"), JSON.stringify(out, null, 1));
const equipment = Object.fromEntries([...Object.entries(data.weapons).map(([id, w]) => [id, w.name] as const), ...Object.entries(data.gearSets).map(([id, g]) => [id, g.name] as const)]);
writeFileSync(join(process.cwd(), "scratch", "stats", "equipment.json"), JSON.stringify(equipment, null, 1));
process.stdout.write(`${Object.keys(out).length} operators, ${Object.keys(equipment).length} weapons and gear sets\n`);
