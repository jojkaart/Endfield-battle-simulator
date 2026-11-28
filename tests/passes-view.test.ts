// `zmdlogs casts <fixture> --passes` (passesview.ts; round 24, the placement-paths report point 1): each placement
// pass's casts and the stops the second pass read, on 9c6e 78.88 s (fixed 2026-11-28: passStops' ultimate merge).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { passesView, readLogFixture } from "@efsim/logs";

const data = loadGameData();

describe("zmdlogs casts --passes", () => {
  it("9c6e: pass 1's distinct Liino ultimate at 76.31 s, and pass 2 reads no stop of it from there (the ultimate merge)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-9c6e97486a9d.json", import.meta.url).pathname);
    const text = passesView(data, fx, { from: 60000, to: 79000, operators: ["chr_0035_liino"] });
    const lines = text.split("\n").slice(1);
    expect(lines).toContainEqual(expect.stringMatching(/^ +76\.31 {2}pass 1 {2}DISTINCT Liino ultimate_skill at 76\.31$/));
    expect(lines.filter((l) => /pass 2 {2}STOP {5}Liino ultimate_skill/.test(l)).map((l) => l.trim().split(/\s+/)[0])).not.toContain("76.30");
    expect(lines.some((l) => /placed {2}STOP .*\(the final placement's own\)/.test(l))).toBe(true);
  });
});
