// scripts/holdout-refresh.ts: the blind refresh of the hold-out fixtures, on a synthetic repository root (its own
// fixtures/holdout/ with a split and old-style fixtures of synthetic battles) and a fake fetch: never a real hold-out,
// never the network. What it prints may carry no id, battle, operator or error message.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { zmdlogsCasts, zmdlogsHits, type LogFixture } from "../packages/logs/src/zmdlogs.ts";
import { categorize, hasSince, refreshHoldouts, REQUEST_GAP_MS } from "../scripts/holdout-refresh.ts";
import { RefreshMismatch } from "../packages/logs/src/logs.ts";
import { oldHit, plainBuild, syntheticDetail, type DetailEvent } from "./helpers/zmdlogs.ts";

const root = mkdtempSync(join(tmpdir(), "efsim-holdout-refresh-test-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const BOSS = "eny_0001_test";
const SI = "chr_0036_jsspsi";
const LAEV = "chr_0016_laevat";
const events: DetailEvent[] = [
  { t: 500, from: SI, key: "chr_0036_jsspsi_normal_skill", value: null },
  { t: 1000, from: SI, key: "chr_0036_jsspsi_normal_skill_burst", value: 900, element: "natural", poise: { dealt: 10, bar: 90, origin: "chr_0036_jsspsi_normal_skill_2" } },
  { t: 2000, from: LAEV, key: "chr_0016_laevat_attack1", value: 400, element: "fire" },
];
const buffs = [{ key: "buff_chr_0036_jsspsi_debuff", from: SI, start: 800, end: 5000, effects: [{ zone: "fragile", rate: 0.1, element: "natural" }] }];
const detailOf = (hex: string) => syntheticDetail(`btl_upload_${hex}`, BOSS, buffs, events);

/** A hold-out fixture of the synthetic battle `hex`: as an older import wrote it, or (`fresh`) with `since`. */
function holdout(hex: string, fresh = false): string {
  const detail = detailOf(hex);
  const fx: LogFixture = {
    id: `zmdlogs-${hex}`,
    description: "synthetic",
    provenance: { source: "test", url: "test", battleId: `btl_upload_${hex}`, parserVersion: "raw-log-parser-test", inGame: true, measured: "test", verifiedAgainst: {}, notes: ["An older note."] },
    enemy: { id: BOSS, level: 90 },
    team: [plainBuild(SI), plainBuild(LAEV)],
    hits: fresh ? zmdlogsHits(detail) : zmdlogsHits(detail).map((h) => oldHit(h, true)),
    casts: zmdlogsCasts(detail, [SI, LAEV]),
  };
  const file = join(root, "fixtures/holdout", `${fx.id}.json`);
  writeFileSync(file, JSON.stringify(fx, null, 1) + "\n");
  return file;
}

const IDS = ["a1a1a1a1a1a1", "b2b2b2b2b2b2", "c3c3c3c3c3c3", "d4d4d4d4d4d4", "e5e5e5e5e5e5", "f6f6f6f6f6f6"];
mkdirSync(join(root, "fixtures/holdout"), { recursive: true });
writeFileSync(join(root, "fixtures/holdout/holdout.json"), JSON.stringify({ development: ["zmdlogs-999999999999"], holdout: IDS.map((h) => `zmdlogs-${h}`) }, null, 1) + "\n");
const [ok1, ok2, had, missing, shape, offline] = IDS as [string, string, string, string, string, string];
const files = { ok1: holdout(ok1), ok2: holdout(ok2), had: holdout(had, true), shape: holdout(shape), offline: holdout(offline) };
const read = (file: string) => JSON.parse(readFileSync(file, "utf8")) as LogFixture;

/** The fake network: the battle's detail, a changed one for `shape`, an HTTP error naming the battle for `offline`. */
function fakeFetch(calls: string[]) {
  return async (battleId: string) => {
    calls.push(battleId);
    if (battleId.endsWith(shape)) return syntheticDetail(battleId, BOSS, buffs, events.map((e) => (e.t === 2000 ? { ...e, value: 401 } : e)));
    if (battleId.endsWith(offline)) throw new Error(`https://zmdlogs.com/api/battles/${battleId}: HTTP 429`);
    return detailOf(battleId.replace(/^btl_upload_/, ""));
  };
}

describe("scripts/holdout-refresh.ts", () => {
  it("a dry run refreshes only temporary copies", async () => {
    const before = Object.values(files).map((f) => readFileSync(f, "utf8"));
    const lines: string[] = [];
    const c = await refreshHoldouts({ root, fetch: fakeFetch([]), sleep: async () => {}, dryRun: true, write: (l) => lines.push(l) });
    expect(c).toMatchObject({ fixtures: 6, ok: 3, already: 1 });
    expect(Object.values(files).map((f) => readFileSync(f, "utf8"))).toEqual(before);
    expect(lines.at(-1)).toMatch(/dry run: nothing written/);
  });

  it("refreshes each old fixture once, 3.5 s apart, and prints only indices, outcomes and counts", async () => {
    const calls: string[] = [];
    const waits: number[] = [];
    const lines: string[] = [];
    const c = await refreshHoldouts({ root, fetch: fakeFetch(calls), sleep: async (ms) => void waits.push(ms), write: (l) => lines.push(l) });
    // One request per fixture without since (the one that has it and the missing one aren't fetched).
    expect(calls).toHaveLength(4);
    expect(waits).toEqual([REQUEST_GAP_MS, REQUEST_GAP_MS, REQUEST_GAP_MS]);
    expect(REQUEST_GAP_MS).toBeGreaterThanOrEqual(3000);
    expect(c).toEqual({ fixtures: 6, ok: 3, already: 1, failed: { missing: 1, "changed shape": 1, network: 1 }, sinceBefore: 1, sinceAfter: 3, keptUnquantified: 0 });
    expect(lines).toEqual([
      "#1/6 ok; since yes",
      "#2/6 ok; since yes",
      "#3/6 ok (had since already; not fetched); since yes",
      "#4/6 failed (missing); since no",
      "#5/6 failed (changed shape); since no",
      "#6/6 failed (network); since no",
      "holdout-refresh: 6 hold-out fixture(s): 3 ok (1 had since already), failed 1 missing, 1 changed shape, 1 network; since 1 → 3; 0 hit(s) keep an unquantified listing the detail no longer marks",
    ]);
    const printed = lines.join("\n");
    for (const s of [...IDS.map((h) => h.slice(0, 4)), "btl_", "zmdlogs-", SI, LAEV, BOSS, "HTTP", "429", "ms"]) expect(printed).not.toContain(s);
    expect(hasSince(read(files.ok1))).toBe(true);
    expect(read(files.ok1).hits).toEqual(zmdlogsHits(detailOf(ok1)));
    expect(read(files.ok1)).toMatchObject({ id: `zmdlogs-${ok1}`, team: [plainBuild(SI), plainBuild(LAEV)] });
    expect(hasSince(read(files.shape))).toBe(false);
    expect(existsSync(join(root, "fixtures/holdout", `zmdlogs-${missing}.json`))).toBe(false);
  });

  it("a second run fetches only what still lacks since", async () => {
    const calls: string[] = [];
    const c = await refreshHoldouts({ root, fetch: fakeFetch(calls), sleep: async () => {}, write: () => {} });
    expect(calls).toHaveLength(2);
    expect(c).toMatchObject({ ok: 3, already: 3, sinceBefore: 3, sinceAfter: 3 });
  });

  it("reduces errors to categories", () => {
    expect(categorize(new RefreshMismatch("hit 3 (1200 ms x): value"))).toBe("changed shape");
    expect(categorize(new SyntaxError("Unexpected token"))).toBe("parse");
    expect(categorize(new TypeError("fetch failed"))).toBe("network");
    expect(categorize(new Error("ZMDLogs: unknown zone x on y"))).toBe("parse");
    expect(categorize(new Error("the detail is battle a, not b"))).toBe("changed shape");
    expect(categorize(new Error("refreshed fixture is invalid: …"))).toBe("invalid");
    expect(categorize(new Error("anything else"))).toBe("other");
  });
});
