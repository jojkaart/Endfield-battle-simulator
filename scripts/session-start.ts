// Cloud sessions' start hook (.claude/hooks/session-start.sh, the file .claude/settings.json names, calls this): fetch
// the game tables the tests read and install npm dependencies, so typecheck, lint and tests run straight away. Does
// nothing outside a cloud session (CLAUDE_CODE_REMOTE unset). Round 10 moved it out of the shell.
//
// Usage: node scripts/session-start.ts

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { main as fetchData } from "./fetch-data.ts";
import { printHelp } from "./usage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function main(): number {
  if (process.env.CLAUDE_CODE_REMOTE !== "true") return 0;
  const fetched = fetchData([]);
  if (fetched !== 0) return fetched;
  return spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: ROOT, stdio: "inherit" }).status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);
  process.exitCode = main();
}
