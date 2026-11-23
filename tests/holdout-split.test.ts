// scripts/holdout-split.ts: a development log registered in the split's text without the file being read by anyone.
// Synthetic split texts only: the real fixtures/holdout/holdout.json is never read here.
import { describe, expect, it } from "vitest";
import { addDevelopment, groupOfPending } from "../scripts/holdout-split.ts";

const pretty = JSON.stringify({ development: ["zmdlogs-aaaa", "zmdlogs-cccc"], holdout: ["zmdlogs-hhhh", "zmdlogs-iiii"] }, null, 2) + "\n";
const oneLine = '{"development": ["zmdlogs-cccc", "zmdlogs-aaaa"], "holdout": ["zmdlogs-hhhh"]}\n';

describe("holdout-split add-development", () => {
  it("inserts in sorted position, in the list's own layout, and leaves the rest byte for byte", () => {
    const r = addDevelopment(pretty, "zmdlogs-bbbb");
    expect(r.added).toBe(true);
    expect(r.development).toBe(3);
    expect(r.text).toBe(JSON.stringify({ development: ["zmdlogs-aaaa", "zmdlogs-bbbb", "zmdlogs-cccc"], holdout: ["zmdlogs-hhhh", "zmdlogs-iiii"] }, null, 2) + "\n");
    expect(r.holdoutOnChangedLine).toBe(false);
    expect(addDevelopment(pretty, "zmdlogs-dddd").text).toContain('"zmdlogs-cccc",\n    "zmdlogs-dddd"\n  ]');
  });

  it("appends to an unsorted list and warns when a changed line holds a hold-out id", () => {
    const r = addDevelopment(oneLine, "zmdlogs-bbbb");
    expect(r.text).toBe('{"development": ["zmdlogs-cccc", "zmdlogs-aaaa", "zmdlogs-bbbb"], "holdout": ["zmdlogs-hhhh"]}\n');
    expect(r.holdoutOnChangedLine).toBe(true);
  });

  it("fills an empty list, keeps a registered id, refuses a hold-out", () => {
    expect(addDevelopment('{ "development": [], "holdout": ["zmdlogs-hhhh"] }', "zmdlogs-aaaa").text).toBe('{ "development": ["zmdlogs-aaaa"], "holdout": ["zmdlogs-hhhh"] }');
    expect(addDevelopment(pretty, "zmdlogs-aaaa")).toMatchObject({ added: false, text: pretty });
    expect(() => addDevelopment(pretty, "zmdlogs-hhhh")).toThrow(/hold-out list/);
  });

  it("names a pending log's group", () => {
    expect(groupOfPending(pretty, "zmdlogs-aaaa")).toBe("development");
    expect(groupOfPending(pretty, "zmdlogs-zzzz")).toBe("earlier pending");
    expect(() => groupOfPending(pretty, "zmdlogs-iiii")).toThrow(/hold-out/);
  });
});
