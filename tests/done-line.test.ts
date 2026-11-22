// scripts/done-line.sh: the `EFSIM-DONE <job> pass|fail|killed` line of premerge.sh. Round 5: a premerge stopped by the
// Bash tool's background limit while it waited for the test lock printed `EFSIM-DONE premerge pass` after a failed
// test step, because its EXIT trap read `$?` (0 after a signal).

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const LIB = resolve(import.meta.dirname, "../scripts/done-line.sh");
const dir = mkdtempSync(join(tmpdir(), "efsim-done-line-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A script that sources the library and then runs `body`. */
function script(name: string, body: string): string {
  const file = join(dir, `${name}.sh`);
  writeFileSync(file, ["#!/usr/bin/env bash", "set -euo pipefail", `source ${JSON.stringify(LIB)}`, "done_init job", body, ""].join("\n"));
  return file;
}

const lastLine = (out: string) => out.trim().split("\n").at(-1);

describe("the EFSIM-DONE line (scripts/done-line.sh)", () => {
  it("says pass only when the script reached done_pass", () => {
    const r = spawnSync("bash", [script("pass", "true\ndone_pass")], { cwd: dir, encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(lastLine(r.stdout)).toBe("EFSIM-DONE job pass");
  });

  it("says fail on an early exit, a failed step and a failing command under set -e", () => {
    for (const body of ["exit 1", "status=0\ndone_run false || status=$?\n[ \"$status\" -eq 0 ] || exit \"$status\"\ndone_pass", "false\ndone_pass"]) {
      const r = spawnSync("bash", [script("fail", body)], { cwd: dir, encoding: "utf8" });
      expect(r.status).not.toBe(0);
      expect(lastLine(r.stdout)).toBe("EFSIM-DONE job fail");
    }
  });

  it("says killed (not pass) when a signal stops it during a step, at once, and stops the step too", async () => {
    const pidFile = join(dir, "child.pid");
    const file = script("killed", `true\ndone_run bash -c 'echo $$ > ${pidFile}; exec sleep 30'\ndone_pass`);
    const child = spawn("bash", [file], { cwd: dir });
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    const started = Date.now();
    while (!existsSync(pidFile) || !readFileSync(pidFile, "utf8").trim()) {
      if (Date.now() - started > 10_000) throw new Error("the step never started");
      await new Promise((r) => setTimeout(r, 50));
    }
    const stepPid = Number(readFileSync(pidFile, "utf8").trim());
    child.kill("SIGTERM"); // the shell only, as a background limit may
    const code = await new Promise<number | null>((r) => child.on("exit", (c) => r(c)));
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(code).toBe(143);
    expect(lastLine(out)).toBe("EFSIM-DONE job killed");
    await new Promise((r) => setTimeout(r, 200));
    expect(() => process.kill(stepPid, 0)).toThrow();
  });

  it("is what premerge.sh uses (no verdict from $? in its own trap)", () => {
    const text = readFileSync(resolve(import.meta.dirname, "../scripts/premerge.sh"), "utf8");
    expect(text).toContain("source scripts/done-line.sh");
    expect(text).toMatch(/done_run node scripts\/premerge\.ts/);
    expect(text.trim().split("\n").at(-1)).toBe("done_pass");
    expect(text).not.toMatch(/trap \w+ EXIT/);
  });
});
