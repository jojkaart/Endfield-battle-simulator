// Typechecks scratch scripts (or probes) with the repository's compiler options: scratch/ and scripts/probes/ are left
// out of `npm run typecheck`, so a call into the packages with the wrong shape runs and prints numbers of something
// else (away-and-presses report point 5: `logBuffReplay(data, fx, { assume })` ran on the defaults, and its result's
// `.inferred` was undefined: the BuffReplay is `.replay`). Only the named files' own errors are printed.
//
// Usage: node scripts/typecheck-scratch.ts <file.ts> […]      exit 1 on an error, 0 with "no type errors"

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const files = process.argv.slice(2).map((f) => resolve(f));
if (!files.length || process.argv.includes("--help")) {
  process.stdout.write("Usage: node scripts/typecheck-scratch.ts <file.ts> […]   (the repository's compiler options; only these files' errors)\n");
  process.exit(files.length ? 0 : 1);
}
const config = ts.getParsedCommandLineOfConfigFile(resolve(ROOT, "tsconfig.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
if (!config) throw new Error("tsconfig.json didn't parse");
const program = ts.createProgram(files, config.options);
const wanted = new Set(files);
const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => d.file && wanted.has(resolve(d.file.fileName)));
const host: ts.FormatDiagnosticsHost = { getCanonicalFileName: (f) => f, getCurrentDirectory: () => ROOT, getNewLine: () => "\n" };
if (diagnostics.length) {
  process.stdout.write(ts.formatDiagnostics(diagnostics, host));
  process.exitCode = 1;
} else process.stdout.write(`typecheck-scratch: no type errors in ${files.length} file(s)\n`);
