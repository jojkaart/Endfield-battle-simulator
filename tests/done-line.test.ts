// scripts/done-line.ts: the `EFSIM-DONE <job> pass|fail|killed` line of premerge and snapshots. Round 5: a premerge
// stopped by the Bash tool's background limit while it waited for the test lock printed `EFSIM-DONE premerge pass`
// after a failed test step, because its shell's EXIT trap read `$?` (0 after a signal). Round 10 ported the shell
// library to TypeScript; the same cases hold.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const LIB = resolve(import.meta.dirname, "../scripts/done-line.ts");
const JOB = "done-line-test";
const dir = mkdtempSync(join(tmpdir(), "efsim-done-line-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A script whose job body is `body` (it has `run`, `onKill` and fs's `writeFileSync`). */
function script(name: string, body: string): string {
  const file = join(dir, `${name}.ts`);
  writeFileSync(
    file,
    [`import { writeFileSync } from "node:fs";`, `import { doneJob } from ${JSON.stringify(LIB)};`, `process.exitCode = await doneJob(${JSON.stringify(JOB)}, undefined, async (run, onKill) => {`, body, "});", ""].join("\n"),
  );
  return file;
}

const lastLine = (out: string) => out.trim().split("\n").at(-1);
const node = (file: string) => spawnSync(process.execPath, [file], { cwd: dir, encoding: "utf8" });

describe("the EFSIM-DONE line (scripts/done-line.ts)", () => {
  it("says pass only when the body returned 0", () => {
    const r = node(script("pass", `return (await run([process.execPath, "-e", ""])) === 0 ? 0 : 1;`));
    expect(r.status).toBe(0);
    expect(lastLine(r.stdout)).toBe(`EFSIM-DONE ${JOB} pass`);
  });

  it("says fail on a non-zero return, a failed step and a thrown error", () => {
    for (const body of ["return 1;", `return await run([process.execPath, "-e", "process.exit(3)"]);`, `throw new Error("boom");`, `return await run(["no-such-command-efsim"]);`]) {
      const r = node(script("fail", body));
      expect(r.status).not.toBe(0);
      expect(lastLine(r.stdout)).toBe(`EFSIM-DONE ${JOB} fail`);
    }
  });

  it("says killed (not pass) when a signal stops it during a step, at once, stops the step and runs the cleanups", async () => {
    const pidFile = join(dir, "child.pid");
    const marker = join(dir, "cleaned");
    const step = `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => {}, 30000)`;
    const file = script("killed", [`onKill(() => writeFileSync(${JSON.stringify(marker)}, "x"));`, `await run([process.execPath, "-e", ${JSON.stringify(step)}]);`, "return 0;"].join("\n"));
    const child = spawn(process.execPath, [file], { cwd: dir });
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    const started = Date.now();
    while (!existsSync(pidFile) || !readFileSync(pidFile, "utf8").trim()) {
      if (Date.now() - started > 10_000) throw new Error("the step never started");
      await new Promise((r) => setTimeout(r, 50));
    }
    const stepPid = Number(readFileSync(pidFile, "utf8").trim());
    child.kill("SIGTERM"); // the job only, as a background limit may
    const code = await new Promise<number | null>((r) => child.on("exit", (c) => r(c)));
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(code).toBe(143);
    expect(lastLine(out)).toBe(`EFSIM-DONE ${JOB} killed`);
    expect(existsSync(marker)).toBe(true);
    // Stopped and reaped by the job before it exited (not left a zombie for init to collect).
    expect(() => process.kill(stepPid, 0)).toThrow();
  });

  it("is what premerge and snapshots use", () => {
    for (const f of ["premerge.ts", "snapshots.ts"]) expect(readFileSync(resolve(import.meta.dirname, `../scripts/${f}`), "utf8")).toMatch(/doneJob\("(premerge|snapshots)"/);
  });

  it("leaves no logic in a shell file: each tracked .sh is one `exec node <script>.ts` line (round 10, the owner)", () => {
    const root = resolve(import.meta.dirname, "..");
    const files = spawnSync("git", ["ls-files", "*.sh", "*.bash", ":!fixtures/holdout"], { cwd: root, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const code = readFileSync(join(root, f), "utf8").split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
      expect({ f, code }).toEqual({ f, code: [expect.stringMatching(/^exec node ".+\.ts"( "\$@")?$/)] });
    }
  });
});
