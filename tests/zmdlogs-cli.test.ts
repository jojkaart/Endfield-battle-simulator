// `efsim zmdlogs`'s --assume on every view that replays (holds-and-placement report point 2, round 13): each subcommand
// of the usage is either replaying (it takes --assume and passes it to its replay) or not (it refuses it), never neither,
// so a new view can't silently ignore the reading a measure just named.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import zmdlogs, { NOT_REPLAYING, REPLAYING } from "../packages/cli/src/commands/zmdlogs.ts";

const ROOT = join(import.meta.dirname, "..");

describe("zmdlogs --assume", () => {
  it("puts every subcommand of the usage in exactly one of REPLAYING and NOT_REPLAYING", () => {
    const named = new Set([...zmdlogs.usage.matchAll(/^ {2}efsim zmdlogs ([a-z-]+)/gm)].map((m) => m[1] as string));
    expect(named.size).toBeGreaterThan(20);
    for (const sub of named) expect([REPLAYING.has(sub), NOT_REPLAYING.has(sub)].filter(Boolean)).toHaveLength(1);
    // And no stale name in either.
    for (const sub of [...REPLAYING, ...NOT_REPLAYING]) expect(named.has(sub)).toBe(true);
  });

  it("refuses --assume on a view that doesn't replay, naming those that do", () => {
    const r = spawnSync(process.execPath, [join(ROOT, "packages/cli/src/main.ts"), "zmdlogs", "casts", "db87", "--assume", "hidden-holds=none"], { cwd: ROOT, encoding: "utf8" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/zmdlogs casts doesn't replay the kits, so --assume changes nothing there; the subcommands that do: hits, check/);
  });
});
