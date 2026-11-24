import { describe, expect, it } from "vitest";
import { estimateWait, expectedMs, FAIR_MS, jobLabel, limitAdvice, mayGo, PRIORITY_MS, queueOrder, waitingFor, type LockKind, type Ticket } from "../scripts/testlock.ts";
import { batchWarning } from "../scripts/with-lock.ts";

const MIN = 60_000;
const ticket = (pid: number, kind: LockKind, arrival: number, claimed?: number, more: Partial<Ticket> = {}): Ticket => ({ pid, boot: "b", kind, worktree: `w${pid}`, command: "x", arrival, ...(claimed !== undefined ? { claimed } : {}), ...more });
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

describe("fair shares between worktrees", () => {
  const of = (pid: number, kind: LockKind, arrival: number, worktree: string, claimed?: number) => ticket(pid, kind, arrival, claimed, { worktree });

  it("puts other worktrees' jobs between one worktree's batch of jobs", () => {
    // w1 queued three rule searches at once; w2's job arrived a minute later and goes second, not fourth.
    expect(order([of(1, "job", 0, "w1"), of(2, "job", 0, "w1"), of(3, "job", 0, "w1"), of(4, "job", 1 * MIN, "w2")])).toEqual([1, 4, 2, 3]);
    // The same for short jobs (measures).
    expect(order([of(1, "short", 0, "w1"), of(2, "short", 1 * MIN, "w1"), of(3, "short", 5 * MIN, "w2")])).toEqual([1, 3, 2]);
  });

  it("doesn't count the worktree's running job, and leaves premerges and test suites alone", () => {
    expect(order([of(1, "job", 0, "w1", 1), of(2, "job", 1 * MIN, "w1"), of(3, "job", 2 * MIN, "w2")])).toEqual([1, 2, 3]);
    expect(order([of(1, "premerge", 0, "w1"), of(2, "premerge", 1 * MIN, "w1"), of(3, "premerge", 2 * MIN, "w2")])).toEqual([1, 2, 3]);
  });

  it("still serves a worktree's later job once others' have waited less than the share", () => {
    expect(order([of(1, "job", 0, "w1"), of(2, "job", 0, "w1"), of(3, "job", FAIR_MS + MIN, "w2")])).toEqual([1, 2, 3]);
  });
});

describe("the background-limit advice", () => {
  it("names a limit with a margin, and warns when the estimate is over the 2 h maximum", () => {
    expect(limitAdvice("measure", 30 * MIN, 2 * MIN)).toContain("at least ~48 min");
    expect(limitAdvice("measure", 0, 2 * MIN)).toContain("at least ~10 min");
    expect(limitAdvice("rules", 100 * MIN, 30 * MIN)).toContain("may be killed in the queue");
  });
});

describe("the short lane", () => {
  const goes = (ts: Ticket[], pid: number) => mayGo(queueOrder(ts), ts.find((t) => t.pid === pid) as Ticket);

  it("runs a short job beside a long job, but not beside a premerge, a test suite, an exclusive job or another short job", () => {
    expect(goes([ticket(1, "job", 0, 1), ticket(2, "short", 5 * MIN)], 2)).toBe(true);
    expect(goes([ticket(1, "premerge", 0, 1), ticket(2, "short", 5 * MIN)], 2)).toBe(false);
    expect(goes([ticket(1, "tests", 0, 1), ticket(2, "short", 5 * MIN)], 2)).toBe(false);
    expect(goes([ticket(1, "job", 0, 1, { exclusive: true }), ticket(2, "short", 5 * MIN)], 2)).toBe(false);
    expect(goes([ticket(1, "job", 0, 1), ticket(3, "short", 1 * MIN, 2 * MIN), ticket(2, "short", 5 * MIN)], 2)).toBe(false);
    expect(goes([ticket(2, "short", 5 * MIN)], 2)).toBe(true);
  });

  it("keeps short jobs in their order, and the main lane ignores a running short job", () => {
    expect(goes([ticket(1, "job", 0, 1), ticket(2, "short", 5 * MIN), ticket(3, "short", 6 * MIN)], 3)).toBe(false);
    // A premerge heads the main lane while a short job runs: it goes on (and its flock chain waits for the short lane).
    expect(goes([ticket(3, "short", 1 * MIN, 2 * MIN), ticket(4, "premerge", 5 * MIN)], 4)).toBe(true);
    // A waiting premerge that heads the main lane (nothing holds it) keeps a short job out.
    expect(goes([ticket(4, "premerge", 5 * MIN), ticket(2, "short", 6 * MIN)], 2)).toBe(false);
  });

  it("estimates the wait from the job's earlier runs, else its kind's default", () => {
    const history = [1, 2, 3].map((m) => ({ key: "job:efsim rules", ms: m * 10 * MIN }));
    const long = ticket(1, "job", 0, 0, { label: "efsim rules" });
    expect(expectedMs(history, long)).toBe(20 * MIN);
    const order = queueOrder([long, ticket(2, "job", 1 * MIN, undefined, { label: "efsim gear" }), ticket(3, "job", 2 * MIN)]);
    const mine = order[2] as Ticket;
    expect(waitingFor(order, mine).map((t) => t.pid)).toEqual([1, 2]);
    expect(estimateWait(order, mine, history, 5 * MIN)).toBe(15 * MIN + 15 * MIN);
    expect(jobLabel(["node", "packages/cli/src/main.ts", "rules", "x.json"])).toBe("efsim rules");
    expect(jobLabel(["npx", "vitest", "run", "--config", "vitest.logs.config.ts"])).toBe("vitest");
    expect(jobLabel(["/usr/bin/node", "/x/scripts/measure.ts", "--with", "a"])).toBe("measure.ts");
  });
});

describe("with-lock's batch warning", () => {
  it("warns about shell scripts and self-locking scripts, not about plain commands", () => {
    expect(batchWarning(["bash", "scratch/runs.sh"])).toMatch(/shell script/);
    expect(batchWarning(["scratch/runs.sh"])).toMatch(/shell script/);
    expect(batchWarning(["node", "scripts/snapshots.ts"])).toMatch(/takes the test lock itself/);
    expect(batchWarning(["node", "scripts/premerge.ts"])).toMatch(/takes the test lock itself/);
    expect(batchWarning(["node", "packages/cli/src/main.ts", "rules", "x.json"])).toBe("");
    expect(batchWarning(["bash", "-c", "sleep 1"])).toBe("");
    expect(batchWarning(["bash", "-c", "a; b"])).toMatch(/inline batch/);
    expect(batchWarning(["node", "scripts/measure.ts"])).toMatch(/takes the test lock itself/);
  });
});
