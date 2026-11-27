// Every development log's placement with the rule that chose each cast's skill (`efsim zmdlogs casts <fixture>
// --choices` for each, in one process): what scripts/cli-ab.ts --placement runs at both commits' code (round 17, the
// Zhuang Fangyi and Liino report point 2: three placement rules each fixed her and broke someone else's casts, each
// found by a full measure and a hand diff of `casts --choices` per log).
//
// Usage: node scripts/placement-lines.ts [<fixture id>…]   (default: every verified and pending development log; never
// a hold-out). Where the code has `castsRecords` (round 18, round 17's own report point 2), one JSON line per record
// (packages/logs views.ts CastsRecord, with its `log`), each log's first a HEADER record with the view's header; at an
// older commit's code, the view's text, each log's lines after its `zmdlogs-<id>: placement` header. cli-ab pairs the
// records by their fields, the text by regexes.

import { loadGameData } from "@efsim/data";
import * as logs from "@efsim/logs";

const ids = process.argv.slice(2);
const data = loadGameData();
// Read through the namespace: a commit before castsRecords links this script all the same and prints the text.
const records = (logs as Record<string, unknown>)["castsRecords"] as typeof logs.castsRecords | undefined;
for (const d of logs.devFixtures(ids.length ? { ids } : {})) {
  if (!records) {
    process.stdout.write(logs.castsReport(data, d.fx, { rules: true }) + "\n");
    continue;
  }
  const { header, records: rs } = records(data, d.fx, { rules: true });
  process.stdout.write([JSON.stringify({ log: d.fx.id, kind: "HEADER", text: header }), ...rs.map((r) => JSON.stringify({ log: d.fx.id, ...r }))].join("\n") + "\n");
}
