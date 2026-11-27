// Every development log's placement with the rule that chose each cast's skill (`efsim zmdlogs casts <fixture>
// --choices` for each, in one process): what scripts/cli-ab.ts --placement runs at both commits' code (round 17, the
// Zhuang Fangyi and Liino report point 2: three placement rules each fixed her and broke someone else's casts, each
// found by a full measure and a hand diff of `casts --choices` per log).
//
// Usage: node scripts/placement-lines.ts [<fixture id>…]   (default: every verified and pending development log; never
// a hold-out). Each log's lines start with its `zmdlogs-<id>: placement` header.

import { loadGameData } from "@efsim/data";
import { castsReport, devFixtures } from "@efsim/logs";

const ids = process.argv.slice(2);
const data = loadGameData();
for (const d of devFixtures(ids.length ? { ids } : {})) process.stdout.write(castsReport(data, d.fx, { rules: true }) + "\n");
