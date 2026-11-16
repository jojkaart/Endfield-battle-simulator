// Imported by main.ts before the CLI (cli.ts) is loaded: stops the CLI when @efsim/* would resolve to another checkout's packages (and so its
// kits). That happens in a git worktree under the main checkout without its own node_modules/@efsim links: Node walks
// up to the main checkout's node_modules and silently runs the main checkout's code. `node scripts/setup-worktree.ts`
// (and every vitest run) makes the links. No imports of @efsim/* here: this module is evaluated before them.

import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../.."));

/** The @efsim packages that resolve outside this checkout, with where they resolve to. */
export function foreignPackages(): { name: string; resolved: string }[] {
  const out: { name: string; resolved: string }[] = [];
  for (const p of ["cli", "data", "engine"]) {
    const name = `@efsim/${p}`;
    let resolved: string;
    try {
      resolved = realpathSync(fileURLToPath(import.meta.resolve(name)));
    } catch {
      resolved = "(not found)";
    }
    if (resolved !== resolve(ROOT, "packages", p, "src", "index.ts")) out.push({ name, resolved });
  }
  return out;
}

const foreign = foreignPackages();
if (foreign.length) {
  process.stderr.write(
    `efsim: this checkout is ${ROOT}, but ${foreign.map((f) => `${f.name} resolves to ${f.resolved}`).join("; ")}.\n` +
      `The CLI would run another checkout's code and kits. In a git worktree, link its own packages first:\n` +
      `  node scripts/setup-worktree.ts\n`,
  );
  process.exit(2);
}
