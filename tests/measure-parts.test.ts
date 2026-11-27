// scripts/measure.ts, round 18: a constant's value measured without an edit (--set, and as a --variant entry), a
// change split by its diff hunks (--split hunks, `split:<name>` markers), per split part the hold-outs it moves the way
// the whole change did (counts), and the moved hold-outs' replay decisions by kind (counts). The patches these build
// are applied with git apply in a scratch repository, as atCommit applies them.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Snapshots } from "../scripts/accuracy.ts";
import { codeErrors, threwNote } from "../scripts/code-errors.ts";
import { applySets, combinedPatch, crossHunkNames, decisionLines, diffHunks, hunkParts, isSetEntry, measureOptions, MAX_HUNK_PARTS, overlay, parseSet, pinRefs, replacementDiff, setsProblem, splitLines } from "../scripts/measure.ts";

const SOURCE = ["// a module", "import x from \"y\";", "", "/** The window. */", "export const WIDE = 60;", "const NARROW: number = 16; // frames", "", "export function f() {", "  return WIDE + NARROW;", "}", ""].join("\n");

/** A scratch git repository holding `files`, for git apply. */
function repo(files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), "measure-parts-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
  git("add", ".");
  git("-c", "user.email=a@b", "-c", "user.name=t", "commit", "-qm", "base");
  return dir;
}

describe("measure --set (round 18, the status-pairing report point 2)", () => {
  it("parses <file>:<CONST>=<value> and tells it from an assumption's <id>=<reading>", () => {
    expect(parseSet("packages/logs/src/a.ts:WIDE=30")).toEqual({ file: "packages/logs/src/a.ts", name: "WIDE", value: "30" });
    expect(isSetEntry("packages/logs/src/a.ts:WIDE=30")).toBe(true);
    expect(isSetEntry("status-pairing=nearest")).toBe(false);
    expect(() => parseSet("a.ts=3")).toThrow(/<file>:<CONST>=<value>/);
  });

  it("sets a one-line declaration, exported or not, typed or not, its comment kept; refuses none or two", () => {
    const now = applySets("a.ts", SOURCE, [parseSet("a.ts:WIDE=30"), parseSet("a.ts:NARROW=8")]);
    expect(now).toContain("export const WIDE = 30;");
    expect(now).toContain("const NARROW: number = 8; // frames");
    expect(() => applySets("a.ts", SOURCE, [parseSet("a.ts:MISSING=1")])).toThrow(/no one-line declaration/);
    expect(() => applySets("a.ts", `${SOURCE}const WIDE = 2;\n`, [parseSet("a.ts:WIDE=1")])).toThrow(/2 one-line declarations/);
  });

  it("makes a diff git apply takes, with --patch's diff on another file beside it", () => {
    const dir = repo({ "a.ts": SOURCE, "b.ts": "export const B = 1;\n" });
    try {
      const other = "diff --git a/b.ts b/b.ts\n--- a/b.ts\n+++ b/b.ts\n@@ -1,1 +1,1 @@\n-export const B = 1;\n+export const B = 2;\n";
      const diff = combinedPatch(other, [parseSet("a.ts:WIDE=30")], (f) => readFileSync(join(dir, f), "utf8"));
      writeFileSync(join(dir, "p.diff"), diff);
      expect(spawnSync("git", ["apply", "p.diff"], { cwd: dir }).status).toBe(0);
      expect(readFileSync(join(dir, "a.ts"), "utf8")).toBe(SOURCE.replace("WIDE = 60", "WIDE = 30"));
      expect(readFileSync(join(dir, "b.ts"), "utf8")).toBe("export const B = 2;\n");
      expect(() => combinedPatch(other, [parseSet("b.ts:B=3")], (f) => readFileSync(join(dir, f), "utf8"))).toThrow(/the --patch changes that file too/);
      expect(replacementDiff("a.ts", SOURCE, SOURCE)).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("checks the options before the queue: not with --live; a missing declaration in the tree fails there", () => {
    expect(measureOptions(["--set", "a.ts:WIDE=30"]).values.set).toEqual(["a.ts:WIDE=30"]);
    expect(() => measureOptions(["--set", "a.ts:WIDE=30", "--live"])).toThrow(/not with --live/);
    expect(() => measureOptions(["--variant", "a.ts:WIDE=30", "--live"])).toThrow(/not with --live/);
    expect(() => measureOptions(["--set", "a.ts=30"])).toThrow(/<file>:<CONST>=<value>/);
    // A --variant may mix a set and readings; the readings alone are checked as readings.
    expect(measureOptions(["--variant", "a.ts:WIDE=30,status-pairing=nearest"]).values.variant).toHaveLength(1);
    const dir = repo({ "a.ts": SOURCE });
    try {
      expect(setsProblem({ set: ["a.ts:WIDE=30"], variant: [] }, dir)).toBeNull();
      expect(setsProblem({ set: [], variant: ["a.ts:NOPE=1"] }, dir)).toMatch(/no one-line declaration/);
      expect(setsProblem({ set: ["missing.ts:A=1"], variant: [] }, dir)).toMatch(/no file missing\.ts/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("measure --split hunks (round 18, the replay-only report point 1)", () => {
  const before = Array.from({ length: 40 }, (_x, i) => `line ${i}`).join("\n") + "\n";
  const after = before.replace("line 3\n", "line 3 changed\n").replace("line 20\n", "line 20 changed // split:rule-a\n").replace("line 35\n", "line 35 changed // split:rule-a\n");

  it("splits a diff into its hunks with their markers, a marker's hunks one part", () => {
    const dir = repo({ "a.ts": before, "c.ts": "c\n" });
    try {
      writeFileSync(join(dir, "a.ts"), after);
      writeFileSync(join(dir, "c.ts"), "c2\n");
      const diff = execFileSync("git", ["diff"], { cwd: dir, encoding: "utf8" });
      const hunks = diffHunks(diff);
      expect(hunks.map((h) => [h.file, h.marker ?? null])).toEqual([["a.ts", null], ["a.ts", "rule-a"], ["a.ts", "rule-a"], ["c.ts", null]]);
      const parts = hunkParts(hunks);
      expect(parts.map((p) => p.label)).toEqual(["a.ts:1", "split:rule-a", "c.ts:1"]);
      // Each part applies alone on the base.
      execFileSync("git", ["checkout", "-q", "--", "."], { cwd: dir });
      writeFileSync(join(dir, "p.diff"), (parts[1] as { patch: string }).patch);
      expect(spawnSync("git", ["apply", "p.diff"], { cwd: dir }).status).toBe(0);
      const text = readFileSync(join(dir, "a.ts"), "utf8");
      expect(text).toContain("line 20 changed");
      expect(text).toContain("line 35 changed");
      expect(text).not.toContain("line 3 changed");
      // --only: those files' hunks apart, the rest one part.
      expect(hunkParts(hunks, "c.ts").map((p) => p.label)).toEqual(["the rest (1 file(s))", "c.ts:1"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("names hold-out fixtures by their count only, and caps the parts", () => {
    const h = (file: string, label: string) => ({ file, header: `diff --git a/${file} b/${file}`, text: "@@ -1 +1 @@\n-a\n+b", label });
    const parts = hunkParts([h("fixtures/holdout/zmdlogs-cccc11112222.json", "x:1"), h("a.ts", "a.ts:1")]);
    expect(parts.map((p) => p.label)).toEqual(["fixtures/holdout/ (1 file(s))", "a.ts:1"]);
    expect(() => hunkParts(Array.from({ length: MAX_HUNK_PARTS + 1 }, (_x, i) => h("a.ts", `a.ts:${i}`)))).toThrow(/split:<name>/);
    expect(() => measureOptions(["--split", "hunks", "--only", "a.ts"])).not.toThrow();
  });
});

describe("the hold-outs in a split's parts and the replay's decisions (round 18)", () => {
  const entry = (plain: number, mismatch: number) => ({ a: { plain, mismatch }, totals: { damage: 1 } });
  const dev = "pending/zmdlogs-bbbb11112222.json";
  const hold = "holdout/zmdlogs-cccc11112222.json";
  const hold2 = "holdout/zmdlogs-cccd11112222.json";
  const base: Snapshots = {
    verified: {},
    pending: { [dev]: entry(5, 5), [hold]: entry(3, 3), [hold2]: entry(3, 3) },
    split: { development: new Set(["zmdlogs-bbbb11112222"]), holdout: new Set(["zmdlogs-cccc11112222", "zmdlogs-cccd11112222"]) },
  };

  it("counts per part the hold-outs it moves as the whole change did, and never names a hold-out moved by no part", () => {
    const whole = overlay(base, new Map([[dev, entry(6, 4)], [hold, entry(2, 4)], [hold2, entry(2, 4)]]));
    const partA = overlay(base, new Map([[hold, entry(2, 4)]]));
    const partB = overlay(base, new Map([[dev, entry(6, 4)]]));
    const text = splitLines([{ label: "a", from: base, to: partA }, { label: "b", from: base, to: partB }], base, whole).join("\n");
    expect(text).toMatch(/Part 1: a\n(.*\n)*? {2}of the hold-outs the whole change moved: worse 2 \(this part alone: 1 worse\)/);
    expect(text).toMatch(/by no part alone \(parts acting together\): 1 hold-out\(s\)$/m);
    expect(text).not.toMatch(/cccc|cccd/);
  });

  it("sums the moved hold-outs' decision kinds per direction, counts only", () => {
    const lines = decisionLines([
      { direction: "worse", before: { JUMPDROP: 3, MADE: 1 }, after: { MADE: 2 } },
      { direction: "worse", before: { SKIP: 1 }, after: { SKIP: 1 } },
      { direction: "better", before: undefined, after: { SKIP: 1 } },
    ], "against base HEAD");
    expect(lines[0]).toMatch(/^The moved hold-outs' replay decisions, against base HEAD/);
    expect(lines).toContain("  worse (2): JUMPDROP −3, MADE +1");
    expect(lines).toContain("  better (1): no decision kind's count moved (1 without decisions on a side: that commit's code has none)");
    expect(decisionLines([])).toEqual([]);
  });

  it("takes --several-targets (round 20, the twins report point 2)", () => {
    expect(measureOptions(["--several-targets"]).values["several-targets"]).toBe(true);
  });
});

describe("a split part that throws, and the refs fixed at queue time (round 21, the interrupted-casts report points 1 and 2)", () => {
  it("tells the code's own errors from the replay's refusals, the stop's prefix dropped", () => {
    expect(codeErrors(["pastChannel is not defined", "operator x can't cast: no SP", "the replay stops at 1200 ms: Cannot read properties of undefined (reading 'end')", "pastChannel is not defined"])).toEqual(["pastChannel is not defined", "Cannot read properties of undefined (reading 'end')"]);
    expect(threwNote(new Map(), 4)).toBeNull();
    expect(threwNote(new Map([["a.json", ["turned is not defined"]]]), 4)).toBe("the replay threw in 1 of the 4 log(s) measured: turned is not defined");
  });

  it("pins --at, --base and --against to commits, and gives --split HEAD's as its base", () => {
    const refs: Record<string, string> = { HEAD: "a".repeat(40), main: "b".repeat(40) };
    const r = pinRefs(["--at", "HEAD", "--against=main", "--split", "hunks"], (x) => refs[x] ?? null);
    expect(r.argv).toEqual(["--at", "a".repeat(40), `--against=${"b".repeat(40)}`, "--split", "hunks", "--base", "a".repeat(40)]);
    expect(r.said).toEqual(["--at HEAD is aaaaaaaaa", "--against main is bbbbbbbbb", "--split's base HEAD is aaaaaaaaa"]);
    // A full hash stays; a ref that doesn't resolve stays for main to refuse.
    expect(pinRefs(["--base", "a".repeat(40), "--at", "nope"], (x) => refs[x] ?? null).argv).toEqual(["--base", "a".repeat(40), "--at", "nope"]);
  });

  it("names a hunk that uses a name only another hunk declares", () => {
    const patch = (file: string, ...lines: string[]) => [`diff --git a/${file} b/${file}`, "--- a/x", "+++ b/x", "@@ -1 +1 @@", ...lines.map((l) => `+${l}`)].join("\n");
    const parts = [
      { label: "logcasts.ts:10", patch: patch("logcasts.ts", "const pastChannel = (c) => c.end > 3;") },
      { label: "drivers.ts:40", patch: patch("drivers.ts", "if (pastChannel(c) && turned) skip(\"pastChannel\"); // pastChannel"), },
      { label: "drivers.ts:90", patch: patch("drivers.ts", "let turned = true;") },
    ];
    const base = (f: string) => (f === "drivers.ts" ? "function skip() {}\n" : "");
    expect(crossHunkNames(parts, base)).toEqual(["  drivers.ts:40 uses pastChannel (declared in logcasts.ts:10), turned (declared in drivers.ts:90): it can't run alone; mark it and those hunks with one `split:<name>` comment"]);
    // A name the base already has isn't the other hunk's.
    expect(crossHunkNames(parts, () => "let turned; const pastChannel = 1;")).toEqual([]);
  });
});
