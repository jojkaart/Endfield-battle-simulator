// Lints only what this branch changed: the .ts / .js files that differ from the merge base with a base ref (main by
// default), committed or not, plus the untracked ones. `npm run lint` lints the whole repository (10 s idle, much
// more under load); this takes a few seconds, so run it while working, next to `npx vitest related --run <files>`,
// instead of linting a hand-picked list of files (one missed file cost a full premerge, round 1). Files the ESLint config
// ignores (scratch/, data/, reference/, …) are skipped without a warning; deleted files are left out.
//
// A file a registry test checks (REGISTRY_CHECKS: the assumption registries' sentence length, their notes) also runs
// that test, by name, in seconds (round 21, the tail-cut report point 5: a reading lengthened past 320 characters failed
// only the full suite, at premerge, since no test importing the file names it to `vitest related`).
//
// Usage: npm run lint:changed [-- <base-ref>]      (exit code: ESLint's, else the registry tests'; 0 when nothing changed)

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(...args: string[]): string {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout;
}

/** The repository-relative .ts / .js files changed since the merge base with `base`, and the untracked ones. */
export function changedFiles(base: string): string[] {
  const from = git("merge-base", base, "HEAD").trim();
  const lines = [...git("diff", "--name-only", "--diff-filter=d", from).split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")];
  return [...new Set(lines.map((l) => l.trim()).filter((f) => /\.(ts|js|mjs|cjs)$/.test(f) && existsSync(join(ROOT, f))))].sort();
}

/**
 * Registry checks a change to one of these files must pass, run by lint:changed: the files (repository-relative
 * prefixes), the test file and the tests' names (vitest -t, a regular expression).
 */
export const REGISTRY_CHECKS: readonly { readonly files: readonly string[]; readonly test: string; readonly names: string }[] = [
  {
    files: ["packages/engine/src/assumptions.ts", "packages/engine/src/replay-assumptions.ts", "docs/design/assumptions.md"],
    test: "tests/engine-assumptions.test.ts",
    names: "have IDs no kit assumption uses|have their evidence in docs/design/assumptions.md",
  },
];

/** The registry checks the changed files call for (REGISTRY_CHECKS), each once. */
export function registryChecks(changed: readonly string[]): (typeof REGISTRY_CHECKS)[number][] {
  return REGISTRY_CHECKS.filter((c) => changed.some((f) => c.files.some((p) => f === p || f.startsWith(p))));
}

/** Every file changed since the merge base with `base` (any kind), and the untracked ones. */
function changedAny(base: string): string[] {
  const from = git("merge-base", base, "HEAD").trim();
  return [...git("diff", "--name-only", "--diff-filter=d", from).split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")].map((l) => l.trim()).filter(Boolean);
}

function main(argv: string[]): number {
  const lint = lintMain(argv);
  const checks = registryChecks(changedAny(argv[0] ?? "main"));
  let status = lint;
  for (const c of checks) {
    process.stdout.write(`lint:changed: ${c.files.join(", ")} changed: ${c.test} -t "${c.names}"\n`);
    const r = spawnSync("npx", ["vitest", "run", c.test, "-t", c.names], { cwd: ROOT, stdio: "inherit" });
    if (r.status !== 0 && status === 0) status = r.status ?? 1;
  }
  return status;
}

function lintMain(argv: string[]): number {
  const base = argv[0] ?? "main";
  const files = changedFiles(base);
  if (!files.length) {
    process.stdout.write(`lint:changed: no .ts / .js file changed since the merge base with ${base}\n`);
    return 0;
  }
  process.stdout.write(`lint:changed: ${files.length} file${files.length === 1 ? "" : "s"} changed since the merge base with ${base}\n`);
  const r = spawnSync("npx", ["eslint", "--no-warn-ignored", ...files], { cwd: ROOT, stdio: "inherit" });
  return r.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
