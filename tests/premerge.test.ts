import { describe, expect, it } from "vitest";
import { STEPS, table, timeoutOnlyFiles, type VitestReport } from "../scripts/premerge.ts";

const file = (name: string, results: { status: string; failureMessages?: string[] }[], status = results.some((r) => r.status === "failed") ? "failed" : "passed", message = ""): VitestReport["testResults"][number] => ({
  name,
  status,
  message,
  assertionResults: results.map((r, i) => ({ status: r.status, fullName: `t${i}`, failureMessages: r.failureMessages ?? [] })),
});

describe("premerge's timeout re-run", () => {
  it("re-runs the files whose only failures are timeouts", () => {
    const report = { testResults: [file("/a.test.ts", [{ status: "passed" }, { status: "failed", failureMessages: ["Error: Test timed out in 60000ms.\nIf this is a long-running test, …"] }]), file("/b.test.ts", [{ status: "passed" }])] };
    expect(timeoutOnlyFiles(report)).toEqual(["/a.test.ts"]);
  });

  it("counts a hook timeout as a timeout", () => {
    expect(timeoutOnlyFiles({ testResults: [file("/a.test.ts", [], "failed", "Error: Hook timed out in 10000ms.")] })).toEqual(["/a.test.ts"]);
  });

  it("re-runs nothing when any failure is something else", () => {
    const report = { testResults: [file("/a.test.ts", [{ status: "failed", failureMessages: ["Error: Test timed out in 60000ms."] }]), file("/b.test.ts", [{ status: "failed", failureMessages: ["AssertionError: expected 1 to be 2"] }])] };
    expect(timeoutOnlyFiles(report)).toBeNull();
    expect(timeoutOnlyFiles({ testResults: [file("/a.test.ts", [], "failed", "SyntaxError: no export named x")] })).toBeNull();
  });

  it("re-runs nothing when nothing failed", () => {
    expect(timeoutOnlyFiles({ testResults: [file("/a.test.ts", [{ status: "passed" }])] })).toBeNull();
  });
});

describe("premerge's steps", () => {
  it("are the steps of npm run check", async () => {
    const pkg = (await import("../package.json", { with: { type: "json" } })).default as { scripts: Record<string, string> };
    const check = pkg.scripts["check"] as string;
    // Each npm script that check chains has a step here (the steps call the tools directly, with vitest's JSON report).
    for (const [script, step] of [["journal:check", "journal"], ["typecheck", "typecheck"], ["lint", "lint"], ["npm test", "test"], ["test:logs", "logs"], ["test:tools", "tools"]] as const) {
      expect(check).toContain(script);
      expect(STEPS.map((s) => s.name)).toContain(step);
    }
  });

  it("prints a table with a line per step and the verdict", () => {
    const t = table([
      { step: "lint", ok: true, seconds: 20, note: "" },
      { step: "test", ok: true, seconds: 400, note: "timeouts under load, passed on re-run (70 s): tests/x.test.ts" },
      { step: "logs", ok: false, seconds: 600, note: "" },
    ]);
    expect(t).toContain("test  pass    400 s  timeouts under load");
    expect(t).toContain("logs  FAIL    600 s");
    expect(t.split("\n").at(-1)).toMatch(/all\s+FAIL\s+1020 s/);
  });
});
