// Misprediction statistics, 2026-11-24: operator ids → display names for the analysis's tables.
//   node scripts/probes/stats/names.ts   (writes scratch/stats/names.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const out = Object.fromEntries(Object.entries(data.operators).map(([id, op]) => [id, op.name]));
mkdirSync(join(process.cwd(), "scratch", "stats"), { recursive: true });
writeFileSync(join(process.cwd(), "scratch", "stats", "names.json"), JSON.stringify(out, null, 1));
process.stdout.write(`${Object.keys(out).length} operators\n`);
