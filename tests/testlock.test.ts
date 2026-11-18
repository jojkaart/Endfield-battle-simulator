import { describe, expect, it } from "vitest";
import { PRIORITY_MS, queueOrder, type LockKind, type Ticket } from "../scripts/testlock.ts";
import { batchWarning } from "../scripts/with-lock.ts";

const MIN = 60_000;
const ticket = (pid: number, kind: LockKind, arrival: number, claimed?: number): Ticket => ({ pid, boot: "b", kind, worktree: `w${pid}`, command: "x", arrival, ...(claimed !== undefined ? { claimed } : {}) });
const order = (ts: Ticket[]) => queueOrder(ts).map((t) => t.pid);

describe("the test lock's queue", () => {
  it("serves jobs of one kind in arrival order, the holder first", () => {
    expect(order([ticket(3, "job", 30 * MIN), ticket(1, "job", 10 * MIN), ticket(2, "job", 20 * MIN)])).toEqual([1, 2, 3]);
    expect(order([ticket(1, "job", 10 * MIN), ticket(2, "job", 20 * MIN, 25 * MIN)])).toEqual([2, 1]);
  });

  it("puts a premerge or test suite ahead of jobs that arrived shortly before it, never ahead of the holder", () => {
    expect(order([ticket(1, "job", 0, 1), ticket(2, "job", 1 * MIN), ticket(3, "job", 2 * MIN), ticket(4, "premerge", 5 * MIN)])).toEqual([1, 4, 2, 3]);
    expect(order([ticket(2, "job", 1 * MIN), ticket(4, "tests", 5 * MIN)])).toEqual([4, 2]);
  });

  it("lets a job that has waited longer than the head start go first (no starvation)", () => {
    expect(order([ticket(1, "job", 0), ticket(2, "premerge", PRIORITY_MS + MIN)])).toEqual([1, 2]);
    // A stream of premerges: the job is passed by those arriving within the head start only.
    expect(order([ticket(1, "job", 0), ticket(2, "premerge", 5 * MIN), ticket(3, "premerge", PRIORITY_MS + 5 * MIN)])).toEqual([2, 1, 3]);
  });
});

describe("with-lock's batch warning", () => {
  it("warns about shell scripts and self-locking scripts, not about plain commands", () => {
    expect(batchWarning(["bash", "scratch/runs.sh"])).toMatch(/shell script/);
    expect(batchWarning(["scratch/runs.sh"])).toMatch(/shell script/);
    expect(batchWarning(["scripts/snapshots.sh"])).toMatch(/takes the test lock itself/);
    expect(batchWarning(["node", "packages/cli/src/main.ts", "rules", "x.json"])).toBe("");
    expect(batchWarning(["bash", "-c", "sleep 1"])).toBe("");
    expect(batchWarning(["bash", "-c", "a; b"])).toMatch(/inline batch/);
    expect(batchWarning(["node", "scripts/measure.ts"])).toMatch(/takes the test lock itself/);
  });
});
