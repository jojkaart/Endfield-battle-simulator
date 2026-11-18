// The lock every worktree's long CPU jobs share: premerge's vitest steps, scripts/snapshots.sh, scripts/measure.ts and
// anything run through scripts/with-lock.ts (measurements, seed tables, long `gear --rules` runs). Jobs queue instead
// of slowing each other past the tests' timeouts or making timings incomparable.
//
// A queue, not a plain flock (round 3, after a premerge waited 40 min while measurement jobs took the lock back to
// back): each waiter writes a ticket (pid, boot, kind, worktree, command, arrival time) into a directory beside the
// lock file, and only the ticket at the head of the queue goes on to take the flock. The order:
//   - the ticket that claimed the lock (the holder) first;
//   - then by arrival time less a head start for merge-blocking kinds: "premerge" and "tests" (test suites,
//     snapshots.sh) go ahead of "job"s (measurements, with-lock) that arrived up to PRIORITY_MS before them, but a job
//     that has waited longer than that goes first, so a stream of premerges can't starve it;
//   - ties by arrival, then pid.
// Tickets of dead processes (or of an earlier boot: a container restart) are pruned by whoever reads the queue.
// While waiting, a heartbeat line every HEARTBEAT_MS says who holds the lock and for how long, and how many are ahead.
//
// A command run under the lock gets EFSIM_TEST_LOCK_HELD=1, so a nested one (with-lock around snapshots.sh) doesn't
// wait for itself. EFSIM_NO_TEST_LOCK=1 skips the lock; without flock there is none. The flock itself stays (taken by
// the head only), so a worktree on older scripts still excludes and is excluded.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** What a lock taker is: a premerge step, a test suite (snapshots.sh), or any other heavy job (with-lock, measure). */
export type LockKind = "premerge" | "tests" | "job";
export const LOCK_KINDS: readonly LockKind[] = ["premerge", "tests", "job"];

/** How far ahead of a job a premerge or test suite goes: a job that arrived more than this earlier still goes first. */
export const PRIORITY_MS = 20 * 60_000;
const HEAD_START: Record<LockKind, number> = { premerge: PRIORITY_MS, tests: PRIORITY_MS, job: 0 };
export const HEARTBEAT_MS = 60_000;
const POLL_MS = 1000;

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
}

/** The queue in order: the holder (claimed) first, then by arrival less the kind's head start; ties by arrival, pid. */
export function queueOrder(tickets: readonly Ticket[]): Ticket[] {
  return [...tickets].sort(
    (a, b) =>
      (a.claimed !== undefined ? 0 : 1) - (b.claimed !== undefined ? 0 : 1) ||
      (a.claimed ?? 0) - (b.claimed ?? 0) ||
      a.arrival - HEAD_START[a.kind] - (b.arrival - HEAD_START[b.kind]) ||
      a.arrival - b.arrival ||
      a.pid - b.pid,
  );
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

/** One line on a ticket for the others: "<worktree> (<kind>: <command>)". */
export function describeTicket(t: Ticket): string {
  const cmd = t.command.length > 70 ? `${t.command.slice(0, 67)}…` : t.command;
  return `${t.worktree} (${t.kind}: ${cmd})`;
}

/** The queue now, a line per ticket in order (for `node scripts/with-lock.ts --status`). */
export function queueStatus(now = Date.now()): string {
  const lock = testLockFile();
  if (!lock) return "test lock: none to take here (EFSIM_NO_TEST_LOCK, already held by a parent, or no git / flock)";
  const order = queueOrder(liveTickets(queueDir(lock)).map((x) => x.ticket));
  const free = spawnSync("flock", ["-n", lock, "true"]).status === 0;
  const head = free ? "test lock: free" : order[0]?.claimed !== undefined ? "test lock: held" : "test lock: held by a process without a ticket (older scripts in another worktree)";
  return [
    `${head}; ${order.length} ticket(s)`,
    ...order.map((t, i) => `  ${i + 1}. ${describeTicket(t)}, ${t.claimed !== undefined ? `holding for ${minutes(now - t.claimed)}` : `waiting for ${minutes(now - t.arrival)}`}, pid ${t.pid}`),
  ].join("\n");
}

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Waits for this process's turn in the queue (writing its ticket, a heartbeat line while waiting), marks it the holder
 * and returns the ticket's release; the caller then takes the flock (`flock <lock> <command>`). Synchronous.
 */
function waitForTurn(lock: string, kind: LockKind, who: string, command: string, say: (line: string) => void): () => void {
  const dir = queueDir(lock);
  mkdirSync(dir, { recursive: true });
  const arrival = Date.now();
  const mine: Ticket = { pid: process.pid, boot: bootId(), kind, worktree: basename(ROOT), command, arrival };
  const file = join(dir, `${arrival}-${process.pid}.json`);
  writeFileSync(file, JSON.stringify(mine));
  const release = () => rmSync(file, { force: true });
  let lastBeat = arrival;
  let announced = false;
  for (;;) {
    const order = queueOrder(liveTickets(dir).map((x) => x.ticket));
    const at = order.findIndex((t) => t.pid === mine.pid && t.arrival === mine.arrival);
    if (at < 0) writeFileSync(file, JSON.stringify(mine)); // pruned by mistake (a clock or boot oddity): back in
    if (at === 0) {
      writeFileSync(file, JSON.stringify({ ...mine, claimed: Date.now() }));
      if (announced) say(`${who}: the test lock's turn came after ${minutes(Date.now() - arrival)}`);
      return release;
    }
    const now = Date.now();
    if (!announced || now - lastBeat >= HEARTBEAT_MS) {
      const holder = order[0];
      const held = holder?.claimed !== undefined ? `held by ${describeTicket(holder)} for ${minutes(now - holder.claimed)}` : holder ? `next: ${describeTicket(holder)}` : "held";
      say(`${who}: waiting ${minutes(now - arrival)} for the test lock (${kind}); ${held}; ${Math.max(0, at)} ahead of this one (node scripts/with-lock.ts --status; EFSIM_NO_TEST_LOCK=1 skips the lock)`);
      announced = true;
      lastBeat = now;
    }
    sleep(POLL_MS);
  }
}

/**
 * Runs a command under the lock: waits for its turn in the queue (with heartbeat lines through `say`), then runs
 * `flock <lock> <command>` with EFSIM_TEST_LOCK_HELD=1; without a lock to take, just the command. Returns the exit
 * status (1 when killed by a signal). Synchronous.
 */
export function runLocked(command: readonly string[], opts: { readonly kind: LockKind; readonly who: string; readonly cwd?: string; readonly env?: NodeJS.ProcessEnv; readonly say?: (line: string) => void }): number {
  const say = opts.say ?? ((l: string) => process.stdout.write(l + "\n"));
  const lock = testLockFile();
  const env = { ...(opts.env ?? process.env), EFSIM_TEST_LOCK_HELD: "1" };
  const [cmd, ...args] = (lock ? ["flock", lock, ...command] : command) as [string, ...string[]];
  const release = lock ? waitForTurn(lock, opts.kind, opts.who, command.join(" "), say) : () => {};
  try {
    const r = spawnSync(cmd, args, { cwd: opts.cwd ?? ROOT, stdio: "inherit", env });
    return r.status ?? 1;
  } finally {
    release();
  }
}

/** The environment for a command run under the lock: nested lock takers inside it don't wait for it. */
export function heldEnv(): NodeJS.ProcessEnv {
  return { ...process.env, EFSIM_TEST_LOCK_HELD: "1" };
}

// Usage: node scripts/testlock.ts --kind <kind> --who <name> -- <command> [args…]
//   runs the command under the lock, printing nothing but the heartbeat (scripts/snapshots.sh re-runs itself so);
//   by hand, use scripts/with-lock.ts.
function main(argv: string[]): number {
  const sep = argv.indexOf("--");
  const opt = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 && (sep < 0 || i < sep) ? argv[i + 1] : undefined;
  };
  const kind = (opt("--kind") ?? "job") as LockKind;
  const command = sep >= 0 ? argv.slice(sep + 1) : [];
  if (!LOCK_KINDS.includes(kind) || !command.length) {
    process.stderr.write("usage: node scripts/testlock.ts --kind premerge|tests|job --who <name> -- <command> [args…]\n");
    return 2;
  }
  return runLocked(command, { kind, who: opt("--who") ?? "testlock", cwd: process.cwd() });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
