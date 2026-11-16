// Development-log tools of `efsim zmdlogs`: the safe lister (never a hold-out) and its formatting.

import type { GameData } from "@efsim/engine";
import { table } from "./format.ts";
import { LOG_DIRS, listLogs, type LogDir, type LogSummary } from "@efsim/logs";

/** --dir's values: a LOG_DIRS key. */
export function logDirs(values: readonly string[]): LogDir[] | undefined {
  if (!values.length) return undefined;
  for (const v of values) if (!(v in LOG_DIRS)) throw new Error(`--dir takes ${Object.keys(LOG_DIRS).join(", ")} (hold-out logs are never listed)`);
  return values as LogDir[];
}

/** `efsim zmdlogs list`: the development logs, with team, enemy and size; JSON with `json`. */
export function formatLogList(data: GameData, opts: { readonly withOperators?: readonly string[]; readonly dirs?: readonly LogDir[]; readonly json?: boolean } = {}): string {
  const name = (op: string) => data.operators[op]?.name;
  const logs = listLogs({ ...(opts.dirs ? { dirs: opts.dirs } : {}), ...(opts.withOperators?.length ? { withOperators: opts.withOperators } : {}), names: name });
  if (opts.json) return JSON.stringify(logs, null, 1);
  const who = (t: LogSummary["team"][number]) => `${name(t.operator) ?? t.operator}${t.potential ? ` P${t.potential}` : ""}`;
  const rows = logs.map((l) => [l.file, l.dir, l.team.map(who).join(", "), l.enemy, String(l.hits), String(l.casts), `${l.seconds.toFixed(0)} s`]);
  return [
    `${logs.length} development log(s)${opts.withOperators?.length ? ` with ${opts.withOperators.join(" and ")}` : ""} (hold-out logs are never listed):`,
    table(["file", "dir", "team", "enemy", "hits", "casts", "length"], rows),
  ].join("\n");
}
