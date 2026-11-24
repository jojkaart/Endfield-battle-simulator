// The lock every worktree's long CPU jobs share: premerge's vitest steps, scripts/snapshots.ts, scripts/measure.ts and
// anything run through scripts/with-lock.ts (measurements, seed tables, long `gear --rules` runs). Jobs queue instead
// of slowing each other past the tests' timeouts or making timings incomparable.
//
// A queue, not a plain flock (round 3, after a premerge waited 40 min while measurement jobs took the lock back to
// back): each waiter writes a ticket (pid, boot, kind, worktree, command, arrival time) into a directory beside the
// lock file, and only the ticket at the head of the queue goes on to take the flock. The order:
//   - the ticket that claimed the lock (the holder) first;
//   - then by arrival time less a head start for merge-blocking and short kinds: "premerge", "tests" (test suites,
//     snapshots.ts) and "short" go ahead of "job"s (long runs: with-lock) that arrived up to PRIORITY_MS before them,
//     but a job that has waited longer than that goes first, so a stream of premerges can't starve it;
//   - a worktree's second, third, … waiting job (or short job) counts as arriving FAIR_MS later each (round 5), so one
//     agent's batch of jobs doesn't hold everyone else's;
//   - ties by arrival, then pid.
// Two lanes (round 4, after one-minute measures waited an hour behind long rule searches): a "short" job (measure, or
// with-lock --kind short: a few minutes at most) runs in a side lane beside a long "job", never beside a premerge, a
// test suite, another short job or an --exclusive job (a timing run). It has its own flock (<lock>.short), which
// premerge, test suites and exclusive jobs take too, so they wait for a running short job (minutes) and it for them.
// Tickets of dead processes (or of an earlier boot: a container restart) are pruned by whoever reads the queue.
// While waiting, a heartbeat line on stderr every HEARTBEAT_MS says who holds the lock and for how long, how many are
// ahead and the estimated wait (from the durations of earlier runs of the same jobs: <lock>.history.jsonl).
//
// A command run under the lock gets EFSIM_TEST_LOCK_HELD=1, so a nested one (with-lock around snapshots.ts) doesn't
// wait for itself. EFSIM_NO_TEST_LOCK=1 skips the lock; without flock there is none. The flock itself stays (taken by
// the head only), so a worktree on older scripts still excludes and is excluded. With a `done` name, a run killed by a
// signal (a `timeout`, Ctrl-C) prints `EFSIM-DONE <done> killed` before it exits, so a Monitor waiting on it ends.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * What a lock taker is: a premerge step, a test suite (snapshots.ts), a long job (with-lock: rule searches, seed
 * tables) or a short one (measure: minutes; runs beside a long job, in the side lane).
 */
export type LockKind = "premerge" | "tests" | "job" | "short";
export const LOCK_KINDS: readonly LockKind[] = ["premerge", "tests", "job", "short"];

/** How far ahead of a job a premerge, test suite or short job goes: a job that arrived more than this earlier still goes first. */
export const PRIORITY_MS = 20 * 60_000;
const HEAD_START: Record<LockKind, number> = { premerge: PRIORITY_MS, tests: PRIORITY_MS, short: PRIORITY_MS, job: 0 };
export const HEARTBEAT_MS = 60_000;
const POLL_MS = 1000;
/** A kind's expected run time when no earlier run of the job is recorded (ms). */
const DEFAULT_MS: Record<LockKind, number> = { premerge: 8 * 60_000, tests: 8 * 60_000, job: 15 * 60_000, short: 2 * 60_000 };

export interface Ticket {
  readonly pid: number;
  readonly boot: string;
  readonly kind: LockKind;
  /** The worktree (its directory name) and the command, for the heartbeat lines of the others. */
  readonly worktree: string;
  readonly command: string;
  readonly arrival: number;
  /** When it became the head and went on to take the flock (the holder from then on). */
  readonly claimed?: number;
  /** The job's name for the duration history (jobLabel). */
  readonly label?: string;
  /** A long job that no short job may run beside (a timing run: with-lock --exclusive). */
  readonly exclusive?: true;
}

/**
 * Fair shares between worktrees (round 5, after one agent's chain of a dozen rule searches held every other agent's
 * jobs for an hour): a worktree's n-th waiting job (or short job) counts as arriving n × FAIR_MS later, so other
 * worktrees' jobs that arrived within that go between them. Premerges and test suites aren't spread (one at a time
 * per worktree anyway).
 */
export const FAIR_MS = PRIORITY_MS;

/** How many waiting tickets of the same worktree and kind arrived before this one (the fair-share rank). */
function fairRank(tickets: readonly Ticket[], t: Ticket): number {
  if (t.claimed !== undefined || (t.kind !== "job" && t.kind !== "short")) return 0;
  return tickets.filter((o) => o.claimed === undefined && o.kind === t.kind && o.worktree === t.worktree && (o.arrival < t.arrival || (o.arrival === t.arrival && o.pid < t.pid))).length;
}

/**
 * The queue in order: the holder (claimed) first, then by arrival less the kind's head start plus the worktree's fair
 * share (FAIR_MS per earlier waiting ticket of its own); ties by arrival, pid.
 */
export function queueOrder(tickets: readonly Ticket[]): Ticket[] {
  const key = new Map(tickets.map((t) => [t, t.arrival - HEAD_START[t.kind] + fairRank(tickets, t) * FAIR_MS]));
  return [...tickets].sort(
    (a, b) =>
      (a.claimed !== undefined ? 0 : 1) - (b.claimed !== undefined ? 0 : 1) ||
      (a.claimed ?? 0) - (b.claimed ?? 0) ||
      (key.get(a) as number) - (key.get(b) as number) ||
      a.arrival - b.arrival ||
      a.pid - b.pid,
  );
}

const same = (a: Ticket, b: Ticket) => a.pid === b.pid && a.arrival === b.arrival;
/** Whether a ticket runs in the main lane (everything but short jobs). */
const mainLane = (t: Ticket) => t.kind !== "short";
/** Whether a short job may run beside a ticket that holds (or is about to take) the main lane: only beside a long, non-exclusive job. */
const shortMayJoin = (t: Ticket) => t.kind === "job" && !t.exclusive;

/**
 * Whether a ticket may go on to take its flock now, in a queue in order (queueOrder): a main-lane ticket when it heads
 * the main lane (short jobs left out: one running holds only the side lane, which premerge and test suites then wait
 * for); a short job when it is the first short job, none is running, and the main lane's head is a long job (or none).
 */
export function mayGo(order: readonly Ticket[], mine: Ticket): boolean {
  if (mainLane(mine)) {
    const head = order.find(mainLane);
    return head !== undefined && same(head, mine);
  }
  const shorts = order.filter((t) => !mainLane(t));
  if (shorts.some((t) => t.claimed !== undefined && !same(t, mine))) return false;
  const first = shorts.find((t) => t.claimed === undefined) ?? shorts[0];
  if (!first || !same(first, mine)) return false;
  const head = order.find(mainLane);
  return head === undefined || shortMayJoin(head);
}

/** The tickets a ticket waits for (each until it ends): those ahead of it in its lane, and for a short job a main-lane head it can't run beside. */
export function waitingFor(order: readonly Ticket[], mine: Ticket): Ticket[] {
  const at = order.findIndex((t) => same(t, mine));
  const ahead = at < 0 ? [...order] : order.slice(0, at);
  if (mainLane(mine)) return ahead.filter(mainLane);
  const head = order.find(mainLane);
  return [...ahead.filter((t) => !mainLane(t)), ...(head && !shortMayJoin(head) ? [head] : [])];
}

/** A command's job name for the duration history: `efsim <command>` for the CLI, else the script's or program's name. */
export function jobLabel(command: readonly string[]): string {
  const words = command.filter((w) => !w.startsWith("-") && !["node", "npx", "npm", "run", "exec", "flock"].includes(basename(w)));
  const main = words.findIndex((w) => /packages\/cli\/src\/main\.ts$/.test(w) || w === "efsim");
  if (main >= 0) return `efsim ${words[main + 1] ?? ""}`.trim();
  return basename(words[0] ?? command[0] ?? "?");
}

/** One finished run, as the history keeps it. */
interface Past {
  readonly key: string;
  readonly ms: number;
}

const historyFile = (lock: string) => `${lock}.history.jsonl`;
const keyOf = (t: Pick<Ticket, "kind" | "label" | "command">) => `${t.kind}:${t.label ?? jobLabel(t.command.split(" "))}`;

function readHistory(lock: string): Past[] {
  try {
    return readFileSync(historyFile(lock), "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as Past];
        } catch {
          return [];
        }
      })
      .slice(-500);
  } catch {
    return [];
  }
}

/** A ticket's expected run time: the median of its job's last five recorded runs, else its kind's default (ms). */
export function expectedMs(history: readonly Past[], t: Pick<Ticket, "kind" | "label" | "command">): number {
  const key = keyOf(t);
  const runs = history.filter((p) => p.key === key).slice(-5).map((p) => p.ms).sort((a, b) => a - b);
  return runs.length ? (runs[Math.floor((runs.length - 1) / 2)] as number) : DEFAULT_MS[t.kind];
}

/** The estimated wait of a ticket: what is left of each ticket it waits for (waitingFor), by expectedMs (ms). */
export function estimateWait(order: readonly Ticket[], mine: Ticket, history: readonly Past[], now = Date.now()): number {
  return waitingFor(order, mine).reduce((s, t) => s + Math.max(t.claimed !== undefined ? 30_000 : 0, expectedMs(history, t) - (t.claimed !== undefined ? now - t.claimed : 0)), 0);
}

function gitCommonDir(): string | undefined {
  const r = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

/** The lock file, or undefined when there is no lock to take (off, already held by a parent, no git or flock). */
export function testLockFile(): string | undefined {
  if (process.env.EFSIM_NO_TEST_LOCK === "1" || process.env.EFSIM_TEST_LOCK_HELD === "1") return undefined;
  const dir = gitCommonDir();
  if (!dir || spawnSync("flock", ["--version"]).status !== 0) return undefined;
  return join(dir, "efsim-tests.lock");
}

/** The ticket directory beside a lock file. */
export const queueDir = (lock: string) => `${lock}.queue`;
/** The side lane's flock beside a lock file (short jobs; premerge, test suites and exclusive jobs take it too). */
export const shortLock = (lock: string) => `${lock}.short`;

const bootId = (() => {
  let id: string | undefined;
  return () => (id ??= existsSync("/proc/sys/kernel/random/boot_id") ? readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim() : "");
})();

function alive(t: Ticket): boolean {
  if (t.boot !== bootId()) return false;
  try {
    process.kill(t.pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The live tickets of a queue directory (the files of dead or earlier-boot processes removed on the way). */
export function liveTickets(dir: string): { file: string; ticket: Ticket }[] {
  if (!existsSync(dir)) return [];
  const out: { file: string; ticket: Ticket }[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const file = join(dir, f);
    let t: Ticket;
    try {
      t = JSON.parse(readFileSync(file, "utf8")) as Ticket;
    } catch {
      continue; // being written
    }
    if (alive(t)) out.push({ file, ticket: t });
    else rmSync(file, { force: true });
  }
  return out;
}

const minutes = (ms: number) => `${Math.max(0, Math.round(ms / 60_000))} min`;

/** The Bash tool's longest background limit (ms): a queued job's wait counts against it. */
export const BACKGROUND_LIMIT_MS = 120 * 60_000;

/**
 * The line a waiter prints once, when it starts waiting: the estimated wait plus its own run against the Bash tool's
 * background limit, which starts when the command does, not when the lock is taken (round 5: runs killed in the queue
 * before doing any work).
 */
export function limitAdvice(who: string, waitMs: number, runMs: number): string {
  const total = waitMs + runMs;
  const base = `${who}: wait plus run estimated at ~${minutes(total)}; the Bash tool's background limit counts the wait`;
  if (total > BACKGROUND_LIMIT_MS) return `${base}, and this is over its 2 h maximum: the job may be killed in the queue (EFSIM-DONE … killed); try later, or narrow it (measure --logs / --with)`;
  return `${base}: give it a limit of at least ~${minutes(Math.max(total * 1.5, 10 * 60_000))} (the maximum, 2 h, is always safe)`;
}

/** One line on a ticket for the others: "<worktree> (<kind>: <command>)". */
export function describeTicket(t: Ticket): string {
  const cmd = t.command.length > 70 ? `${t.command.slice(0, 67)}…` : t.command;
  return `${t.worktree} (${t.kind}${t.exclusive ? ", exclusive" : ""}: ${cmd})`;
}

/** The queue now, a line per ticket in order (for `node scripts/with-lock.ts --status`). */
export function queueStatus(now = Date.now()): string {
  const lock = testLockFile();
  if (!lock) return "test lock: none to take here (EFSIM_NO_TEST_LOCK, already held by a parent, or no git / flock)";
  const order = queueOrder(liveTickets(queueDir(lock)).map((x) => x.ticket));
  const history = readHistory(lock);
  const free = spawnSync("flock", ["-n", lock, "true"]).status === 0;
  const head = free ? "test lock: free" : order[0]?.claimed !== undefined ? "test lock: held" : "test lock: held by a process without a ticket (older scripts in another worktree)";
  return [
    `${head}; ${order.length} ticket(s)`,
    ...order.map((t, i) => {
      const state = t.claimed !== undefined ? `holding for ${minutes(now - t.claimed)} (expected ~${minutes(expectedMs(history, t))})` : `waiting for ${minutes(now - t.arrival)} (~${minutes(estimateWait(order, t, history, now))} more)`;
      return `  ${i + 1}. ${describeTicket(t)}, ${state}, pid ${t.pid}`;
    }),
  ].join("\n");
}


const sleepAsync = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface LockOptions {
  readonly kind: LockKind;
  readonly who: string;
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  /** Where waiting lines go (default stderr: stdout stays the command's own, e.g. JSON). */
  readonly say?: (line: string) => void;
  /** A long job no short job may run beside (a timing run). */
  readonly exclusive?: boolean;
  /** The job name for the history (default jobLabel of the command). */
  readonly label?: string;
}

/** A waiter's state between polls (shared by the synchronous and asynchronous waits). */
class Waiter {
  readonly dir: string;
  readonly file: string;
  readonly mine: Ticket;
  readonly history: readonly Past[];
  readonly lock: string;
  readonly opts: LockOptions;
  private lastBeat: number;
  private announced = false;
  constructor(lock: string, command: readonly string[], opts: LockOptions) {
    this.lock = lock;
    this.opts = opts;
    this.dir = queueDir(lock);
    mkdirSync(this.dir, { recursive: true });
    const arrival = Date.now();
    this.mine = { pid: process.pid, boot: bootId(), kind: opts.kind, worktree: basename(ROOT), command: command.join(" "), arrival, label: opts.label ?? jobLabel(command), ...(opts.exclusive ? { exclusive: true as const } : {}) };
    this.file = join(this.dir, `${arrival}-${process.pid}.json`);
    writeFileSync(this.file, JSON.stringify(this.mine));
    this.history = readHistory(lock);
    this.lastBeat = arrival;
  }

  /** One poll: true when it's this ticket's turn (marked the holder), else a heartbeat line when one is due. */
  poll(): boolean {
    const say = this.opts.say ?? ((l: string) => process.stderr.write(l + "\n"));
    const order = queueOrder(liveTickets(this.dir).map((x) => x.ticket));
    if (!order.some((t) => same(t, this.mine))) writeFileSync(this.file, JSON.stringify(this.mine)); // pruned by mistake (a clock or boot oddity): back in
    const now = Date.now();
    if (mayGo(order, this.mine)) {
      writeFileSync(this.file, JSON.stringify({ ...this.mine, claimed: now }));
      if (this.announced) say(`${this.opts.who}: the test lock's turn came after ${minutes(now - this.mine.arrival)}`);
      return true;
    }
    if (!this.announced || now - this.lastBeat >= HEARTBEAT_MS) {
      const ahead = waitingFor(order, this.mine);
      const holder = order[0];
      const held = holder?.claimed !== undefined ? `held by ${describeTicket(holder)} for ${minutes(now - holder.claimed)}` : holder ? `next: ${describeTicket(holder)}` : "held";
      const list = ahead.map((t) => `${t.label ?? jobLabel(t.command.split(" "))} ~${minutes(expectedMs(this.history, t))}`).join(", ");
      const wait = estimateWait(order, this.mine, this.history, now);
      say(
        `${this.opts.who}: waiting ${minutes(now - this.mine.arrival)} for the test lock (${this.opts.kind}); ${held}; ${ahead.length} ahead of this one${list ? ` (${list})` : ""}, ` +
          `estimated ~${minutes(wait)} more (node scripts/with-lock.ts --status; EFSIM_NO_TEST_LOCK=1 skips the lock)`,
      );
      if (!this.announced) say(limitAdvice(this.opts.who, wait, expectedMs(this.history, this.mine)));
      this.announced = true;
      this.lastBeat = now;
    }
    return false;
  }

  /** The flock chain for this ticket's lane: short jobs the side lane's; premerge, test suites and exclusive jobs both. */
  chain(command: readonly string[]): string[] {
    const k = this.opts.kind;
    if (k === "short") return ["flock", shortLock(this.lock), ...command];
    if (k === "job" && !this.opts.exclusive) return ["flock", this.lock, ...command];
    return ["flock", shortLock(this.lock), "flock", this.lock, ...command];
  }

  /** Records the run's duration (from its claim) and removes the ticket. */
  finish(claimed: number | undefined): void {
    rmSync(this.file, { force: true });
    if (claimed === undefined) return;
    try {
      appendFileSync(historyFile(this.lock), JSON.stringify({ key: keyOf(this.mine), ms: Date.now() - claimed } satisfies Past) + "\n");
    } catch {
      // the history is only for estimates
    }
  }
}

const SIGNALS = { SIGINT: 2, SIGTERM: 15, SIGHUP: 1 } as const;

/**
 * Runs a command under the lock: waits for its turn in the queue (with heartbeat lines through `say`, stderr by
 * default), then runs it under its lane's flock(s) with EFSIM_TEST_LOCK_HELD=1; without a lock to take, just the
 * command. Returns the exit status (1 when it failed to start). Asynchronous, so a signal (a `timeout`, Ctrl-C, the
 * Bash tool stopping a background job) is handled: the ticket is released, the command (if running) gets the same signal, `EFSIM-DONE <done> killed` is
 * printed on stdout (`doneTo` "stderr": there) when `done` names the job, and the process exits with 128 + the
 * signal's number.
 */
export async function runLockedAsync(command: readonly string[], opts: LockOptions & { readonly done?: string; readonly doneTo?: "stdout" | "stderr" }): Promise<number> {
  const lock = testLockFile();
  const env = { ...(opts.env ?? process.env), EFSIM_TEST_LOCK_HELD: "1" };
  const w = lock ? new Waiter(lock, command, opts) : undefined;
  let child: ChildProcess | undefined;
  let claimed: number | undefined;
  const onSignal = (sig: keyof typeof SIGNALS) => {
    w?.finish(claimed);
    if (child && child.exitCode === null) child.kill(sig);
    const queued = claimed === undefined && w !== undefined;
    const where = queued ? ` (in the queue after ${minutes(Date.now() - w.mine.arrival)}: nothing ran; the background limit counts the wait)` : "";
    if (opts.done) (opts.doneTo === "stderr" ? process.stderr : process.stdout).write(`EFSIM-DONE ${opts.done} killed${where}\n`);
    process.stderr.write(`${opts.who}: killed by ${sig}${queued ? " while waiting for the test lock" : ""}\n`);
    process.exit(128 + SIGNALS[sig]);
  };
  for (const sig of Object.keys(SIGNALS) as (keyof typeof SIGNALS)[]) process.on(sig, onSignal);
  try {
    if (w) while (!w.poll()) await sleepAsync(POLL_MS);
    claimed = Date.now();
    const [cmd, ...args] = (w ? w.chain(command) : [...command]) as [string, ...string[]];
    return await new Promise<number>((done) => {
      child = spawn(cmd, args, { cwd: opts.cwd ?? ROOT, stdio: "inherit", env });
      child.on("error", () => done(1));
      child.on("exit", (code) => done(code ?? 1));
    });
  } finally {
    for (const sig of Object.keys(SIGNALS) as (keyof typeof SIGNALS)[]) process.off(sig, onSignal);
    w?.finish(claimed);
  }
}

/** The environment for a command run under the lock: nested lock takers inside it don't wait for it. */
export function heldEnv(): NodeJS.ProcessEnv {
  return { ...process.env, EFSIM_TEST_LOCK_HELD: "1" };
}

// Usage: node scripts/testlock.ts --kind <kind> --who <name> [--done <job>] -- <command> [args…]
//   runs the command under the lock, printing nothing but the heartbeat (stderr) and, when killed with --done, the
//   killed marker (premerge runs its vitest steps so); by hand, use scripts/with-lock.ts.
async function main(argv: string[]): Promise<number> {
  const sep = argv.indexOf("--");
  const opt = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 && (sep < 0 || i < sep) ? argv[i + 1] : undefined;
  };
  const kind = (opt("--kind") ?? "job") as LockKind;
  const command = sep >= 0 ? argv.slice(sep + 1) : [];
  if (!LOCK_KINDS.includes(kind) || !command.length) {
    process.stderr.write("usage: node scripts/testlock.ts --kind premerge|tests|job|short --who <name> [--done <job>] -- <command> [args…]\n");
    return 2;
  }
  const done = opt("--done");
  return runLockedAsync(command, { kind, who: opt("--who") ?? "testlock", cwd: process.cwd(), ...(done ? { done } : {}) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main(process.argv.slice(2)).then((c) => (process.exitCode = c));
