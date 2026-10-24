// Every example scenario (examples/*.scenario.json), simulated, against a committed snapshot of its results
// (tests/snapshots/examples.json): total, hit and cast counts, damage per operator, and a digest of its hits
// (frame, operator, skill and hit, exact damage to 3 decimals), whole and per 10 s of fight time.
//
// These are a REGRESSION BASELINE, not values with provenance (docs/design.md principle 11): nothing here says the
// numbers are right, only that they haven't moved. A change that moves one must be deliberate: regenerate with
// `npm run snapshots:update` (EFSIM_UPDATE_SNAPSHOTS=1) and commit the snapshot's diff with the reason.

import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { FPS, simulate, type LandedHit } from "@efsim/engine";
import { readScenario } from "@efsim/cli";
import { Snapshot, UPDATE_HINT, UPDATING } from "./snapshot.ts";

const dir = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "examples");
const files = readdirSync(dir).filter((f) => f.endsWith(".scenario.json")).sort();
const data = loadGameData();

/** Seconds of fight time per window digest. */
const WINDOW_S = 10;

interface ExampleSnapshot {
  readonly total: number;
  readonly hits: number;
  readonly casts: number;
  readonly perOperator: Readonly<Record<string, number>>;
  readonly digest: string;
  /** The digest of each WINDOW_S seconds' hits (by frame), so a failure says where the hits first differ. */
  readonly windows: readonly string[];
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const line = (h: LandedHit) => `${h.frame} ${h.operator} ${h.skillId}:${h.hitId} ${h.exact.toFixed(3)}`;
const digest = (lines: readonly string[]) => createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 12);

const snapshot = new Snapshot<ExampleSnapshot>("examples.json");
afterAll(() => snapshot.write((key) => existsSync(join(dir, key))));

describe("example scenarios against their snapshot (a regression baseline, not values with provenance)", () => {
  it("has an entry for every example and none for a removed one", () => {
    if (UPDATING) return;
    expect(Object.keys(snapshot.stored).filter((k) => !files.includes(k)), "stale snapshot entries").toEqual([]);
    expect(files.filter((f) => !(f in snapshot.stored)), `examples without a snapshot entry (${UPDATE_HINT})`).toEqual([]);
  });

  it.each(files)("%s", (file) => {
    const r = simulate(data, readScenario(join(dir, file)));
    const lines = [...r.hits].sort((a, b) => a.frame - b.frame).map(line);
    const window = (h: LandedHit) => Math.floor(h.frame / (WINDOW_S * FPS));
    const windowCount = r.hits.reduce((m, h) => Math.max(m, window(h) + 1), 0);
    const byWindow = Array.from({ length: windowCount }, (_, w) => r.hits.filter((h) => window(h) === w).sort((a, b) => a.frame - b.frame).map(line));
    const now: ExampleSnapshot = {
      total: r3(r.total),
      hits: r.hits.length,
      casts: r.casts.length,
      perOperator: Object.fromEntries(Object.entries(r.perOperator).map(([op, d]) => [op, r3(d)])),
      digest: digest(lines),
      windows: byWindow.map(digest),
    };
    const stored = snapshot.record(file, now);
    if (UPDATING || stored === undefined) return; // a missing entry fails the test above
    if (JSON.stringify(stored) === JSON.stringify(now)) return;
    // The hit list only in the failure message: from the first 10 s window whose hits differ.
    const first = now.windows.findIndex((d, i) => stored.windows[i] !== d);
    const from = first < 0 ? Math.min(now.windows.length, stored.windows.length) : first;
    const shown = byWindow.slice(from).flat().slice(0, 60);
    const message = [
      `${file} moved from its snapshot (${UPDATE_HINT}).`,
      `Hits first differ in ${from * WINDOW_S}–${(from + 1) * WINDOW_S} s; this run's hits from there (frame operator skill:hit exact):`,
      ...shown.map((l) => `  ${l}`),
    ].join("\n");
    expect(now, message).toEqual(stored);
  });
});
