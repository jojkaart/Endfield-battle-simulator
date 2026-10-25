// The loaded kits (data.kits: every operator and equipment kit as the loader normalises it, with what it fills in
// from the game data) against a committed snapshot of their digests (tests/snapshots/kits.json). A REGRESSION
// BASELINE, not values with provenance (docs/design.md principle 11): it says a change to the kit files or the
// loader left what the engine gets unchanged, e.g. when a hand-written value equal to the compiled one is removed.
// A deliberate change is written with `npm run snapshots:update`. EFSIM_KITS_DUMP=<dir> writes each loaded kit as
// canonical JSON there, to diff two versions.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { canonicalJson as canonical } from "@efsim/cli";
import { Snapshot, UPDATE_HINT, UPDATING } from "./snapshot.ts";

const data = loadGameData();

interface KitSnapshot {
  readonly digest: string;
}

const kits: [string, unknown][] = [
  ...Object.entries(data.kits.operators).map(([id, k]): [string, unknown] => [`operator ${id}`, k]),
  ...Object.entries(data.kits.equipment).map(([id, k]): [string, unknown] => [`equipment ${id}`, k]),
].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const snapshot = new Snapshot<KitSnapshot>("kits.json", true);
afterAll(() => snapshot.write((key) => kits.some(([k]) => k === key)));

const dump = process.env.EFSIM_KITS_DUMP;
if (dump) mkdirSync(dump, { recursive: true });

describe("loaded kits against their snapshot (a regression baseline, not values with provenance)", () => {
  it("has an entry for every kit and none for a removed one", () => {
    if (UPDATING) return;
    const ids = new Set(kits.map(([k]) => k));
    expect(Object.keys(snapshot.stored).filter((k) => !ids.has(k)), "stale snapshot entries").toEqual([]);
    expect([...ids].filter((k) => !(k in snapshot.stored)), `kits without a snapshot entry (${UPDATE_HINT})`).toEqual([]);
  });

  it.each(kits)("%s", (key, kit) => {
    const text = canonical(kit);
    if (dump) writeFileSync(join(dump, `${key.replace(" ", "_")}.json`), JSON.stringify(JSON.parse(text), null, 1) + "\n");
    const now: KitSnapshot = { digest: createHash("sha256").update(text).digest("hex").slice(0, 16) };
    const stored = snapshot.record(key, now);
    if (UPDATING) return;
    expect(now, `${key} differs from its snapshot (${UPDATE_HINT})`).toEqual(stored);
  });
});
