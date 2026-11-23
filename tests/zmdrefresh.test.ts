// `efsim zmdlogs refresh` (packages/logs/src/logs.ts refreshFixture, zmdraw.ts refreshFromDetail): an older fixture
// gets what newer imports keep, from a synthetic battle detail, with the raw cache in a temporary folder and no network.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { refreshFixture, RefreshMismatch } from "../packages/logs/src/logs.ts";
import { zmdlogsCasts, zmdlogsHits, type LogFixture, type LogHit } from "../packages/logs/src/zmdlogs.ts";
import { refreshFromDetail } from "../packages/logs/src/zmdraw.ts";
import { oldHit, plainBuild, syntheticDetail, type DetailEvent } from "./helpers/zmdlogs.ts";

const dir = mkdtempSync(join(tmpdir(), "efsim-refresh-"));
const before = process.env["EFSIM_CACHE_DIR"];
process.env["EFSIM_CACHE_DIR"] = join(dir, "cache");
afterAll(() => {
  if (before === undefined) delete process.env["EFSIM_CACHE_DIR"];
  else process.env["EFSIM_CACHE_DIR"] = before;
  rmSync(dir, { recursive: true, force: true });
});

const ID = "btl_upload_bbbbbbbbbbbb";
const BOSS = "eny_0001_test";
const SI = "chr_0036_jsspsi";
const LAEV = "chr_0016_laevat";
const events: DetailEvent[] = [
  { t: 500, from: SI, key: "chr_0036_jsspsi_normal_skill", value: null },
  { t: 1000, from: SI, key: "chr_0036_jsspsi_normal_skill_burst", value: 900, element: "natural", poise: { dealt: 10, bar: 90, origin: "chr_0036_jsspsi_normal_skill_2" } },
  { t: 2000, from: LAEV, key: "chr_0016_laevat_attack1", value: 400, element: "fire" },
  { t: 3000, from: SI, key: "chr_0036_jsspsi_inkmove", value: 1200, element: "natural", poise: { dealt: 20, bar: 70, origin: "chr_0036_jsspsi_normal_skill_inkmove_2" } },
];
const buffs = [
  { key: "buff_chr_0036_jsspsi_debuff", from: SI, start: 800, end: 5000, effects: [{ zone: "fragile", rate: 0.1, element: "natural" }] },
  { key: "buff_chr_0016_laevat_atkup", from: LAEV, on: SI, start: 200, end: 1000, effects: [{ zone: "atk", rate: 0.2 }] },
];
const detail = syntheticDetail(ID, BOSS, buffs, events);
const team = [plainBuild(SI), plainBuild(LAEV)];

/** An older fixture of the synthetic battle, written to a file; `casts` and `poise`: whether that import kept them. */
function oldFixture(name: string, opts: { readonly casts: boolean; readonly poise: boolean; readonly hits?: LogHit[] }): string {
  const fx: LogFixture = {
    id: `zmdlogs-${name}`,
    description: "synthetic",
    provenance: { source: "test", url: "test", battleId: ID, parserVersion: "raw-log-parser-test", inGame: true, measured: "test", verifiedAgainst: {}, notes: ["An older note."] },
    enemy: { id: BOSS, level: 90 },
    team,
    hits: opts.hits ?? zmdlogsHits(detail).map((h) => oldHit(h, opts.poise)),
    ...(opts.casts ? { casts: zmdlogsCasts(detail, [SI, LAEV]) } : {}),
  };
  const file = join(dir, `zmdlogs-${name}.json`);
  writeFileSync(file, JSON.stringify(fx, null, 1) + "\n");
  return file;
}
const read = (file: string) => JSON.parse(readFileSync(file, "utf8")) as LogFixture;

describe("zmdlogs refresh", () => {
  it("the synthetic detail imports with effect sources, starts and Stagger origins", () => {
    const hits = zmdlogsHits(detail);
    expect(hits).toHaveLength(3);
    expect(hits[0]?.effects).toEqual([
      { buff: "buff_chr_0036_jsspsi_debuff", zone: "susceptibility", element: "natural", value: 0.1, source: SI, since: 800 },
    ]);
    expect(hits[0]?.boundaryEffects).toEqual([{ buff: "buff_chr_0016_laevat_atkup", zone: "atk", element: null, value: 0.2, source: LAEV, since: 200 }]);
    expect(hits[2]?.poise).toEqual({ dealt: 20, bar: 70, origin: "chr_0036_jsspsi_normal_skill_inkmove_2" });
  });

  it("adds effects' source and since and Stagger origins, one note per kind, and nothing on a second run", () => {
    const file = oldFixture("aaaaaaaaaaa1", { casts: true, poise: true });
    const r = refreshFixture(file, detail);
    expect(r.added).toEqual(["poise.origin", "source", "since"]);
    const fx = read(file);
    expect(fx.hits).toEqual(zmdlogsHits(detail));
    expect(fx.provenance.notes).toHaveLength(4);
    expect(fx.provenance.notes.filter((n) => /source|since|origin/.test(n))).toHaveLength(3);
    const again = refreshFixture(file, detail);
    expect(again.added).toEqual([]);
    expect(read(file)).toEqual(fx);
  });

  it("adds casts and Stagger to a fixture imported before them", () => {
    const file = oldFixture("aaaaaaaaaaa2", { casts: false, poise: false });
    const r = refreshFixture(file, detail);
    expect(r).toMatchObject({ casts: 1, poise: 2, added: ["casts", "poise", "poise.origin", "source", "since"] });
    expect(read(file).casts).toEqual([{ t: 500, operator: SI, skill: "chr_0036_jsspsi_normal_skill" }]);
    expect(read(file).provenance.notes).toHaveLength(6);
  });

  it("writes nothing when the detail's hits aren't the fixture's", () => {
    const changed = syntheticDetail(ID, BOSS, buffs, events.map((e) => (e.t === 2000 ? { ...e, value: 401 } : e)));
    const file = oldFixture("aaaaaaaaaaa3", { casts: true, poise: true });
    const text = readFileSync(file, "utf8");
    expect(() => refreshFixture(file, changed)).toThrow(RefreshMismatch);
    expect(() => refreshFixture(file, changed)).toThrow(/value on 1 hit/);
    // The values that differ, apart from the message (round 8): `zmdlogs refresh` prints them for a development fixture.
    let refused: unknown;
    try {
      refreshFixture(file, changed);
    } catch (e) {
      refused = e;
    }
    expect(refused instanceof RefreshMismatch && refused.values).toEqual(["hit 1 value: fixture 400 / detail 401"]);
    expect((refused as Error).message).not.toMatch(/fixture 400/);
    const fewer = syntheticDetail(ID, BOSS, buffs, events.slice(0, 3));
    expect(() => refreshFixture(file, fewer)).toThrow(/2 damage events \(total 1300\), the fixture 3 hits \(total 2500\)/);
    const otherBuff = syntheticDetail(ID, BOSS, buffs.map((b, i) => (i === 0 ? { ...b, effects: [{ zone: "fragile", rate: 0.2, element: "natural" }] } : b)), events);
    expect(() => refreshFixture(file, otherBuff)).toThrow(/effects on 3 hit/);
    expect(() => refreshFixture(file, syntheticDetail("btl_upload_cccccccccccc", BOSS, buffs, events))).toThrow(/not btl_upload_bbbbbbbbbbbb/);
    expect(readFileSync(file, "utf8")).toBe(text);
  });

  it("refuses a fixture whose logged casts differ from the detail's", () => {
    const file = oldFixture("aaaaaaaaaaa4", { casts: true, poise: true });
    const fx = read(file);
    writeFileSync(file, JSON.stringify({ ...fx, casts: [] }, null, 1) + "\n");
    expect(() => refreshFixture(file, detail)).toThrow(/casts/);
  });

  it("reads the cached detail, else fetches it once", async () => {
    let calls = 0;
    const fetch = async () => {
      calls++;
      return detail;
    };
    const file = oldFixture("aaaaaaaaaaa5", { casts: true, poise: true });
    expect(await refreshFromDetail(file, { fetch })).toMatchObject({ fetched: true, added: ["poise.origin", "source", "since"] });
    const second = oldFixture("aaaaaaaaaaa6", { casts: true, poise: true });
    expect(await refreshFromDetail(second, { fetch })).toMatchObject({ fetched: false });
    expect(calls).toBe(1);
    expect(read(second).hits).toEqual(zmdlogsHits(detail));
  });

  it("keeps an unquantified listing the detail no longer marks as unvalued, and refuses a new one", () => {
    const marked = [...buffs, { key: "buff_common_natural_triggered", from: SI, start: 1000, end: 1000, effects: [], dynamic: 1 }];
    const old = syntheticDetail(ID, BOSS, marked, events);
    const listing = zmdlogsHits(old).map((h) => h.unquantified);
    expect(listing.filter((u) => u.length)).toEqual([[{ buff: "buff_common_natural_triggered", since: 1000, source: SI }]]);
    const file = oldFixture("aaaaaaaaaaa8", { casts: true, poise: true, hits: zmdlogsHits(old).map((h) => oldHit(h, true)) });
    const now = syntheticDetail(ID, BOSS, marked.map((b) => ({ ...b, dynamic: 0 })), events);
    const r = refreshFixture(file, now);
    expect(r.keptUnquantified).toBe(1);
    expect(read(file).hits.map((h) => h.unquantified)).toEqual(listing);
    expect(read(file).provenance.notes.filter((n) => /no longer marks/.test(n))).toHaveLength(1);
    expect(refreshFixture(file, now).keptUnquantified).toBe(1);
    expect(read(file).provenance.notes.filter((n) => /no longer marks/.test(n))).toHaveLength(1);
    const plain = oldFixture("aaaaaaaaaaa9", { casts: true, poise: true });
    const text = readFileSync(plain, "utf8");
    expect(() => refreshFixture(plain, old)).toThrow(/unquantified on 1 hit/);
    try {
      refreshFixture(plain, old);
    } catch (e) {
      expect((e as RefreshMismatch).values.join("\n")).toMatch(/^hit \d+ unquantified: new in the detail \[\{/m);
    }
    expect(readFileSync(plain, "utf8")).toBe(text);
  });

  it("reports when ZMDLogs now parses the battle with another parser version", () => {
    const file = oldFixture("aaaaaaaaaaa7", { casts: true, poise: true });
    expect(refreshFixture(file, syntheticDetail(ID, BOSS, buffs, events, "raw-log-parser-v99")).parserVersion).toBe("raw-log-parser-v99");
  });
});
