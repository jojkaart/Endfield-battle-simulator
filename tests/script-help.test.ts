// Every script with an entry point answers --help from its header (scripts/usage.ts printHelp; round 23, round 22's own
// report point 4: `node scripts/friction.ts --help` failed with parseArgs' "Unknown option" and the usage was read
// from the source). Static: a script's entry point calls printHelp (or wantsHelp) before it runs anything.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { headerUsage } from "../scripts/usage.ts";

const DIR = join(import.meta.dirname, "../scripts");
const ENTRY = "resolve(process.argv[1]) === fileURLToPath(import.meta.url)";

describe("scripts' --help", () => {
  it("is answered by every script with an entry point, from a header that says how to run it", () => {
    const scripts = readdirSync(DIR).filter((f) => f.endsWith(".ts")).sort();
    const entries = scripts.filter((f) => readFileSync(join(DIR, f), "utf8").includes(ENTRY));
    expect(entries.length).toBeGreaterThan(20);
    const silent = entries.filter((f) => !/printHelp\(|wantsHelp\(/.test(readFileSync(join(DIR, f), "utf8")));
    expect(silent, "a script whose entry point doesn't answer --help: add `if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);` (scripts/usage.ts)").toEqual([]);
    const bare = entries.filter((f) => headerUsage(join(DIR, f)).trim().length < 20);
    expect(bare, "a script whose header comment says nothing printHelp could show").toEqual([]);
  });
});
