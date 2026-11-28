// Refreshes every hold-out fixture from its ZMDLogs battle detail (`efsim zmdlogs refresh`'s refreshFixture) without
// anyone seeing one: agents never open, list or grep fixtures/holdout/ (CLAUDE.md "Hold-out logs"), and the CLI's
// refresh refuses a hold-out. The script reads the split's hold-out ids (holdout.json, by code), fetches each detail
// once (3.5 s apart, the importer's user agent; kept in memory only, never in the raw cache), refreshes a temporary copy
// of the fixture, checks that the copy keeps the fixture's id, battle, team and enemy, and only then writes it back.
//
// It prints per fixture only a running index, ok or failed (an error category: network, parse, changed shape,
// invalid, identity, missing, other; never an error's message, which can name a battle or a hit) and whether the
// fixture's listed effects now carry `since`; then counts. Nothing else of a hold-out: no id, no team, no hit.
//
// Usage: node scripts/holdout-refresh.ts [--dry-run]
//          --dry-run: fetch and refresh the temporary copies, write nothing back
//          (about 45 s a fixture: the details are large; run it in the Bash tool's background mode)
//        then `npm run snapshots:update` (the hold-out row of the scoreboard, aggregates only). Commit the refreshed
//        files by their directory (`git commit -q -F scratch/msg.txt -- fixtures/holdout`); never `git status`,
//        `git diff --stat` or `git show --stat` without excluding it (`-- . ':!fixtures/holdout'`): they name the files.
// Why (2026-11-23): fixtures imported before 2026-11-16 list effects without `since` / `source`, so the replay's
// rules that read the log's buff runs (holds.ts, heldToLoggedEnds, layerCrits) had nothing to read on the hold-outs.

import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { fetchDetail, HOLDOUT_DIR, readLogSplit, refreshFixture, RefreshMismatch, type LogFixture } from "@efsim/logs";
import { printHelp } from "./usage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The pause between two requests to zmdlogs.com (docs/accuracy-plan.md "Screening": 3 s or more). */
export const REQUEST_GAP_MS = 3500;

export type FailureCategory = "network" | "parse" | "changed shape" | "invalid" | "identity" | "missing" | "other";

export interface HoldoutRefreshOptions {
  /** The repository root holding fixtures/holdout/ (a synthetic one in tests). */
  readonly root?: string;
  /** Fetches a battle's detail (default: one request to zmdlogs.com, fetchDetail). */
  readonly fetch?: (battleId: string) => Promise<unknown>;
  /** Waits between requests (default: a timer). */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Refreshes the temporary copies only. */
  readonly dryRun?: boolean;
  /** Where the lines go (default: stdout). */
  readonly write?: (line: string) => void;
}

export interface HoldoutRefreshCounts {
  readonly fixtures: number;
  readonly ok: number;
  /** Fixtures that had `since` already: not fetched, not touched. */
  readonly already: number;
  readonly failed: Readonly<Partial<Record<FailureCategory, number>>>;
  readonly sinceBefore: number;
  readonly sinceAfter: number;
  /** Hits, over every refreshed fixture, that keep an unquantified listing the detail no longer marks (RefreshResult). */
  readonly keptUnquantified: number;
}

/** Whether a fixture's listed effects carry their lane's start (`since`, imports since 2026-11-16). */
export function hasSince(fx: Pick<LogFixture, "hits">): boolean {
  return fx.hits.some((h) => [...h.effects, ...h.boundaryEffects].some((e) => e.since !== undefined));
}

/** An error as a category only: its message can carry a battle id, a hit's time or a skill (never printed). */
export function categorize(e: unknown): FailureCategory {
  if (e instanceof RefreshMismatch) return "changed shape";
  if (e instanceof SyntaxError) return "parse";
  const message = e instanceof Error ? e.message : String(e);
  if (/HTTP \d+|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket/i.test(message) || (e instanceof TypeError && /fetch/i.test(message))) return "network";
  if (/^ZMDLogs: /.test(message)) return "parse";
  if (/^the detail is battle /.test(message)) return "changed shape";
  if (/invalid/.test(message)) return "invalid";
  return "other";
}

/** The fields a refresh must leave as they were (else the copy is dropped: category identity). */
function identity(fx: LogFixture): unknown {
  return { id: fx.id, battleId: fx.provenance.battleId, url: fx.provenance.url, team: fx.team, enemy: fx.enemy, description: fx.description, keys: Object.keys(fx).filter((k) => k !== "casts").sort() };
}

const readFx = (file: string) => JSON.parse(readFileSync(file, "utf8")) as LogFixture;

/** Refreshes every hold-out fixture of the split (see the file's comment); prints only indices, outcomes and counts. */
export async function refreshHoldouts(opts: HoldoutRefreshOptions = {}): Promise<HoldoutRefreshCounts> {
  const root = opts.root ?? ROOT;
  const fetch = opts.fetch ?? fetchDetail;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const write = opts.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  const ids = [...readLogSplit(root).holdout].sort();
  const tmp = mkdtempSync(join(tmpdir(), "efsim-holdout-refresh-"));
  const failed: Partial<Record<FailureCategory, number>> = {};
  let ok = 0;
  let already = 0;
  let sinceBefore = 0;
  let sinceAfter = 0;
  let keptUnquantified = 0;
  let requested = false;
  try {
    for (const [i, id] of ids.entries()) {
      const index = `#${i + 1}/${ids.length}`;
      const fail = (c: FailureCategory, since: boolean) => {
        failed[c] = (failed[c] ?? 0) + 1;
        if (since) sinceAfter++;
        write(`${index} failed (${c}); since ${since ? "yes" : "no"}`);
      };
      const file = join(root, HOLDOUT_DIR, `${id}.json`);
      if (!/^zmdlogs-[0-9a-z]+$/.test(id) || !existsSync(file)) {
        fail("missing", false);
        continue;
      }
      let before: LogFixture;
      try {
        before = readFx(file);
      } catch (e) {
        fail(categorize(e) === "parse" ? "parse" : "other", false);
        continue;
      }
      const sinceThen = hasSince(before);
      if (sinceThen) {
        sinceBefore++;
        sinceAfter++;
        already++;
        write(`${index} ok (had since already; not fetched); since yes`);
        continue;
      }
      try {
        if (requested) await sleep(REQUEST_GAP_MS);
        requested = true;
        const detail = await fetch(before.provenance.battleId);
        const copy = join(tmp, `${i}.json`);
        copyFileSync(file, copy);
        const r = refreshFixture(copy, detail);
        const after = readFx(copy);
        if (!isDeepStrictEqual(identity(before), identity(after))) {
          fail("identity", false);
          continue;
        }
        if (!opts.dryRun) writeFileSync(file, readFileSync(copy));
        rmSync(copy);
        ok++;
        keptUnquantified += r.keptUnquantified;
        const since = hasSince(after);
        if (since) sinceAfter++;
        write(`${index} ok${opts.dryRun ? " (dry run: not written)" : ""}; since ${since ? "yes" : "no"}`);
      } catch (e) {
        fail(categorize(e), false);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const counts: HoldoutRefreshCounts = { fixtures: ids.length, ok: ok + already, already, failed, sinceBefore, sinceAfter, keptUnquantified };
  const failures = Object.entries(failed).map(([c, n]) => `${n} ${c}`);
  write(
    `holdout-refresh: ${counts.fixtures} hold-out fixture(s): ${counts.ok} ok (${already} had since already), ${failures.length ? `failed ${failures.join(", ")}` : "none failed"}; ` +
      `since ${sinceBefore} → ${sinceAfter}; ${keptUnquantified} hit(s) keep an unquantified listing the detail no longer marks${opts.dryRun ? "; dry run: nothing written" : ""}`,
  );
  return counts;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);
  const args = process.argv.slice(2);
  if (args.some((a) => a !== "--dry-run")) {
    process.stderr.write("usage: node scripts/holdout-refresh.ts [--dry-run]\n");
    process.exitCode = 2;
  } else {
    refreshHoldouts({ dryRun: args.includes("--dry-run") }).then(
      (c) => {
        process.exitCode = Object.keys(c.failed).length ? 1 : 0;
      },
      (e: unknown) => {
        process.stderr.write(`holdout-refresh: stopped (${categorize(e)})\n`);
        process.exitCode = 1;
      },
    );
  }
}
