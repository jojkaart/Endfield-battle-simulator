// Timing under other agents' load: runs shell commands alternately (A B A B …), so load drifts hit each the same, and
// prints each one's median wall time and median CPU time (user + system of the command and its children, which load
// hardly changes), with the load average at the start and the end. Quote CPU seconds, or a paired run like this, in
// timing claims (CLAUDE.md "Correctness").
//
// Usage: node scripts/bench.ts [-n runs] [--names a,b] "<command A>" ["<command B>" …]   (npm run bench -- …)
//   e.g. node scripts/bench.ts -n 3 --names cached,fresh "node packages/cli/src/main.ts find si" \
//          "EFSIM_NO_CACHE=1 node packages/cli/src/main.ts find si"
// A command's output is discarded; a failing run is reported and counted.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadavg } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { printHelp } from "./usage.ts";

/** CPU seconds this process's waited-for children have used (/proc/self/stat cutime + cstime; Linux). */
function childCpu(): number {
  const stat = readFileSync("/proc/self/stat", "utf8");
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  // After the ")": state is field 3, so cutime (16) and cstime (17) are at 13 and 14.
  return (Number(fields[13]) + Number(fields[14])) / 100;
}

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export interface Variant {
  readonly name: string;
  readonly command: string;
  readonly wall: number[];
  readonly cpu: number[];
  failed: number;
}

export function parseArgs(argv: readonly string[]): { runs: number; variants: Variant[] } {
  let runs = 3;
  let names: string[] = [];
  const commands: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "-n") runs = Number(argv[++i]);
    else if (a === "--names") names = (argv[++i] ?? "").split(",");
    else commands.push(a);
  }
  if (!commands.length || !(Number.isInteger(runs) && runs >= 1)) throw new Error('usage: node scripts/bench.ts [-n runs] [--names a,b] "<command A>" ["<command B>" …]');
  return { runs, variants: commands.map((command, i) => ({ name: names[i] ?? String.fromCharCode(65 + i), command, wall: [], cpu: [], failed: 0 })) };
}

export function report(variants: readonly Variant[], loadStart: string, loadEnd: string): string {
  const lines = variants.map((v) => {
    const w = median(v.wall);
    return `  ${v.name}: wall ${w.toFixed(2)} s (min ${Math.min(...v.wall).toFixed(2)}, max ${Math.max(...v.wall).toFixed(2)}), CPU ${median(v.cpu).toFixed(2)} s, ${v.wall.length} run(s)${v.failed ? `, ${v.failed} FAILED` : ""}  ${v.command}`;
  });
  const [a, b] = variants;
  if (a && b && variants.length === 2) lines.push(`  ${b.name} / ${a.name}: wall ×${(median(b.wall) / median(a.wall)).toFixed(2)}, CPU ×${(median(b.cpu) / median(a.cpu)).toFixed(2)}`);
  return [`bench (medians; load ${loadStart} → ${loadEnd}):`, ...lines].join("\n");
}

function main(argv: readonly string[]): number {
  const { runs, variants } = parseArgs(argv);
  const load = () => loadavg().map((x) => x.toFixed(1)).join(" ");
  const start = load();
  for (let r = 0; r < runs; r++) {
    for (const v of variants) {
      const cpu0 = childCpu();
      const t0 = performance.now();
      const res = spawnSync("bash", ["-c", v.command], { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 64 << 20 });
      v.wall.push((performance.now() - t0) / 1000);
      v.cpu.push(childCpu() - cpu0);
      if (res.status !== 0) {
        v.failed++;
        process.stderr.write(`bench: ${v.name} failed (exit ${res.status}): ${String(res.stderr).trim().split("\n").slice(-3).join(" | ")}\n`);
      }
      process.stderr.write(`bench: run ${r + 1}/${runs} ${v.name} ${(v.wall.at(-1) as number).toFixed(2)} s\n`);
    }
  }
  process.stdout.write(report(variants, start, load()) + "\n");
  return variants.some((v) => v.failed) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);
  process.exitCode = main(process.argv.slice(2));
}
