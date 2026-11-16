// scripts/journal.ts: entry files, the built journal and index, and adopting entries written the old way (CLAUDE.md
// "Journal and roadmap"). Whether the committed docs/journal.md is up to date is `npm run journal:check`.
import { describe, expect, it } from "vitest";
import {
  adoptPlan,
  buildIndex,
  buildJournal,
  linksToDocs,
  linksToEntries,
  newFileName,
  parseEntry,
  RECENT,
  slugOf,
  sortEntries,
  splitOldJournal,
} from "../scripts/journal.ts";

const entry = (file: string, heading: string, body = "Text.") => parseEntry(file, `${heading}\n\n${body}\n`);

describe("journal entries", () => {
  it("parses an entry file and refuses malformed ones", () => {
    const e = entry("2026-11-16-02-a-title.md", "## 2026-11-16: A title");
    expect(e).toMatchObject({ date: "2026-11-16", seq: 2, heading: "## 2026-11-16: A title" });
    expect(() => entry("2026-11-16-a-title.md", "## 2026-11-16: A title")).toThrow(/name/);
    expect(() => entry("2026-11-16-01-a.md", "## 2026-11-15: A title")).toThrow(/date/);
    expect(() => entry("2026-11-16-01-a.md", "# 2026-11-16: A title")).toThrow(/first line/);
    expect(() => entry("2026-11-16-01-a.md", "## 2026-11-16: A", "x\n\n## Another")).toThrow(/second/);
    expect(entry("2026-11-13-03-a.md", "## 2026-11-13 (night): A").date).toBe("2026-11-13");
  });

  it("sorts newest first by date, then sequence", () => {
    const es = [
      entry("2026-11-15-09-z.md", "## 2026-11-15: Z"),
      entry("2026-11-16-01-a.md", "## 2026-11-16: A"),
      entry("2026-11-16-10-b.md", "## 2026-11-16: B"),
    ];
    expect(sortEntries(es).map((e) => e.file)).toEqual(["2026-11-16-10-b.md", "2026-11-16-01-a.md", "2026-11-15-09-z.md"]);
  });

  it("names a new entry after the date's last one", () => {
    const es = [entry("2026-11-16-07-a.md", "## 2026-11-16: A")];
    expect(newFileName("2026-11-16", "Ink Melt's surge at 80 s", es)).toBe("2026-11-16-08-ink-melt-s-surge-at-80-s.md");
    expect(newFileName("2026-11-17", "Équipe", es)).toBe("2026-11-17-01-equipe.md");
    expect(slugOf("a ".repeat(50)).length).toBeLessThanOrEqual(60);
  });

  it("rebases relative links between docs/journal/ and docs/", () => {
    const inEntry = "[d](../design.md#x), [e](2026-11-16-01-a.md), [w](https://x.org/a), [s](#top)";
    const inDocs = "[d](design.md#x), [e](journal/2026-11-16-01-a.md), [w](https://x.org/a), [s](#top)";
    expect(linksToDocs(inEntry)).toBe(inDocs);
    expect(linksToEntries(inDocs)).toBe(inEntry);
  });

  it("builds the journal from the last RECENT entries and indexes all", () => {
    const es = Array.from({ length: RECENT + 2 }, (_, i) =>
      entry(`2026-11-${String(i + 1).padStart(2, "0")}-01-e.md`, `## 2026-11-${String(i + 1).padStart(2, "0")}: E${i}`),
    );
    const j = buildJournal(es);
    expect(j).toContain(`## 2026-11-${RECENT + 2}: E${RECENT + 1}`);
    expect(j).not.toContain("## 2026-11-02: E1");
    const idx = buildIndex(es);
    expect(idx).toContain("- [2026-11-01: E0](2026-11-01-01-e.md)");
    // The built journal reads back as the entries it shows: adopting it writes nothing.
    expect(adoptPlan(splitOldJournal(j), es)).toEqual({ write: [], differ: [] });
  });
});

describe("adopting entries written the old way", () => {
  const existing = [entry("2026-11-16-08-architecture-review.md", "## 2026-11-16: Architecture review", "See [r](../roadmap.md).")];
  const old = [
    "# Journal",
    "",
    "Intro with a [link](journal-archive.md).",
    "",
    "<<<<<<< HEAD",
    "=======",
    "## 2026-11-16: New work",
    "",
    "Did [things](design.md).",
    ">>>>>>> branch",
    "## 2026-11-16: Architecture review",
    "",
    "See [r](roadmap.md).",
    "",
    "## 2026-11-15: Edited old entry",
    "",
    "Changed.",
  ].join("\n");

  it("writes entries whose heading has no file, keeps the rest, and drops conflict markers", () => {
    const withOld = [...existing, entry("2026-11-15-03-edited-old-entry.md", "## 2026-11-15: Edited old entry", "Original.")];
    const plan = adoptPlan(splitOldJournal(old), withOld);
    expect(plan.write).toEqual([
      { file: "2026-11-16-09-new-work.md", text: "## 2026-11-16: New work\n\nDid [things](../design.md).\n" },
    ]);
    expect(plan.differ).toEqual(["2026-11-15-03-edited-old-entry.md"]);
  });

  it("ends an entry where its side of a conflict ends", () => {
    const conflicted = [
      "<<<<<<< HEAD",
      "## 2026-11-16: Architecture review",
      "",
      "See [r](roadmap.md).",
      "=======",
      "Older entries: the old header, edited on the branch.",
      "",
      "## 2026-11-17: Branch work",
      "",
      "B.",
      ">>>>>>> branch",
    ].join("\n");
    expect(adoptPlan(splitOldJournal(conflicted), existing)).toEqual({
      write: [{ file: "2026-11-17-01-branch-work.md", text: "## 2026-11-17: Branch work\n\nB.\n" }],
      differ: [],
    });
  });

  it("numbers several new entries of one date in their order (the lower one older)", () => {
    const two = "## 2026-11-17: Second\n\nB.\n\n## 2026-11-17: First\n\nA.\n";
    expect(adoptPlan(splitOldJournal(two), existing).write.map((w) => w.file)).toEqual([
      "2026-11-17-01-first.md",
      "2026-11-17-02-second.md",
    ]);
  });
});
