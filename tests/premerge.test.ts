import { describe, expect, it } from "vitest";
import { GATES, locked, missingJournal, slowest, STEPS, table, timeoutOnlyFiles, type VitestReport } from "../scripts/premerge.ts";
import { testsNaming } from "../scripts/snapshots.ts";

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

describe("premerge's slowest list", () => {
  it("names the slowest files and tests", () => {
    const report: VitestReport = { testResults: [
      { name: "/r/tests/a.test.ts", status: "passed", startTime: 0, endTime: 50_000, assertionResults: [{ status: "passed", fullName: "big", failureMessages: [], duration: 45_000 }] },
      { name: "/r/tests/b.test.ts", status: "passed", startTime: 0, endTime: 2_000, assertionResults: [{ status: "passed", fullName: "small", failureMessages: [], duration: 1_000 }] },
    ] };
    expect(slowest(report, "/r", 1)).toBe("slowest files: tests/a.test.ts 50 s\nslowest tests: tests/a.test.ts > big 45 s");
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

  it("stops after a failed typecheck or lint (they come first): the long steps show as skipped", () => {
    expect([...GATES].sort()).toEqual(["lint", "typecheck"]);
    const names = STEPS.map((s) => s.name);
    expect(names.indexOf("typecheck")).toBeLessThan(names.indexOf("test"));
    expect(names.indexOf("lint")).toBeLessThan(names.indexOf("test"));
    expect(table([{ step: "lint", ok: false, seconds: 9, note: "" }, { step: "test", ok: false, seconds: 0, note: "skipped: lint failed (--keep-going runs it anyway)" }])).toContain("test  skip      0 s  skipped: lint failed");
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

describe("premerge's preconditions (round 10: from premerge.sh)", () => {
  it("asks for a journal entry when code, kits, examples or schemas change", () => {
    expect(missingJournal(["packages/cli/src/main.ts"])).toBe(true);
    expect(missingJournal(["examples/x.scenario.json", "docs/journal/2026-11-24-01-x.md"])).toBe(false);
    expect(missingJournal(["scripts/premerge.ts", "docs/design/tests.md"])).toBe(false);
    expect(missingJournal(["schemas/x.json", "docs/journal.md"])).toBe(true);
  });

  it("runs the vitest steps under the shared lock as a child (a signal to premerge stops it and frees its ticket)", () => {
    expect(locked(["npx", "vitest", "run"])).toEqual(["node", "scripts/testlock.ts", "--kind", "premerge", "--who", "premerge", "--", "npx", "vitest", "run"]);
  });
});

describe("snapshots' knock-on tests (misprediction-stats report point 6)", () => {
  it("are the test files naming a changed log's fixture by its id", () => {
    const files = [
      { path: "tests/logcasts.test.ts", text: 'readLogFixture("../fixtures/pending/zmdlogs-d774d0ce7bd3.json")' },
      { path: "tests/kit-si.test.ts", text: "d774 102 s, in a comment only" },
      { path: "tests/other.test.ts", text: "zmdlogs-0eef2474a26f.json" },
    ];
    expect(testsNaming(["pending/zmdlogs-d774d0ce7bd3.json"], files)).toEqual(["tests/logcasts.test.ts"]);
    expect(testsNaming(["zmdlogs-0eef2474a26f.json", "pending/zmdlogs-d774d0ce7bd3.json"], files)).toEqual(["tests/logcasts.test.ts", "tests/other.test.ts"]);
    expect(testsNaming([], files)).toEqual([]);
  });
});
