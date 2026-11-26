// Relative Markdown links resolve (scripts/check-links.ts): every link to a file or folder in the repository's docs
// names one that exists, and every #anchor into a Markdown file names one of its headings. After moving or splitting
// a doc (design.md became docs/design/, 2026-11-16), this lists what to fix.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brokenLinks, declaredNames, slug, staleCitations } from "../scripts/check-links.ts";

describe("documentation links", () => {
  it("every relative link and anchor in the repository's Markdown resolves", () => {
    expect(brokenLinks().map((b) => `${b.file}:${b.line}: ${b.target} — ${b.why}`)).toEqual([]);
  });

  it("finds a missing file, a missing anchor, and skips code and web links", () => {
    const root = mkdtempSync(join(tmpdir(), "efsim-links-"));
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs", "a.md"), "# A title\n\n## Skills and buffs from SkillData / BuffData\n");
    writeFileSync(
      join(root, "docs", "b.md"),
      ["[ok](a.md#a-title) [ok2](a.md#skills-and-buffs-from-skilldata--buffdata) [web](https://x.org/y)", "[gone](c.md) [bad](a.md#nope)", "`[code](z.md)`", "```", "[fenced](z.md)", "```", "[self](#b) ", "# B"].join("\n"),
    );
    expect(brokenLinks(["docs/a.md", "docs/b.md"], root).map((b) => [b.line, b.target])).toEqual([
      [2, "c.md"],
      [2, "a.md#nope"],
    ]);
    expect(slug("Diagnosis, marginal values, gear on rules (phase 2, 2026-11-16)")).toBe("diagnosis-marginal-values-gear-on-rules-phase-2-2026-11-16");
  });
});

describe("citations of a source file's identifier (round 15: round 14's own report point 3)", () => {
  it("every \"<file>.ts <identifier>\" in the docs and sources names one that file declares", () => {
    expect(staleCitations().map((c) => `${c.file}:${c.line}: "${c.cited}": ${c.why}`)).toEqual([]);
  });

  it("finds a moved function's citation, and skips prose words, wildcards, history and other trees' files", () => {
    const root = mkdtempSync(join(tmpdir(), "efsim-cites-"));
    mkdirSync(join(root, "packages", "logs"), { recursive: true });
    mkdirSync(join(root, "docs", "journal"), { recursive: true });
    writeFileSync(join(root, "packages", "logs", "query.ts"), "export function replayTimeStops() {}\nexport interface ReplayTimeStop {\n  readonly tickRead?: true;\n}\n");
    writeFileSync(join(root, "docs", "a.md"), ["query.ts replayTimeStops and query.ts `ReplayTimeStop.tickRead`", "query.ts chainStepFor; query.ts and more; query.ts `POLICY_*`", "other.ts movedAway"].join("\n"));
    writeFileSync(join(root, "docs", "journal", "x.md"), "query.ts chainStepFor\n");
    spawnSync("git", ["init", "-q"], { cwd: root });
    expect(staleCitations(root).map((c) => [c.file, c.line, c.identifier])).toEqual([["docs/a.md", 2, "chainStepFor"]]);
    expect([...declaredNames('case "openCombo": { readonly attr: X }')]).toEqual(expect.arrayContaining(["openCombo", "attr"]));
  });
});
