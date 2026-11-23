// The safe path for text edits and its guards (improvement round 9: a multi-line `python3 -c` or a heredoc slipped
// through in three agent rounds of four, once writing a shell's empty command substitutions into a doc):
// scripts/edit.ts (exact replacements from an edits file), scripts/check-links.ts damagedText (the damage's shapes in
// a doc) and scripts/bash-guard.ts (the hook that refuses the forms).
import { describe, expect, it } from "vitest";
import { refusal } from "../scripts/bash-guard.ts";
import { damagedDocs, damagedText } from "../scripts/check-links.ts";
import { applyEdits, parseEdits } from "../scripts/edit.ts";

const B = "`";

describe("scripts/edit.ts", () => {
  const edits = [
    "comments outside blocks are ignored",
    "@@@ docs/a.md",
    "<<<<<<<",
    `the ${B}enemy-away${B} assumption ($x)`,
    "=======",
    `the ${B}enemy-away${B} reading ("away")`,
    ">>>>>>>",
    "<<<<<<< end",
    "=======",
    "an appended line",
    ">>>>>>>",
    "@@@ new docs/b.md",
    "<<<<<<<",
    "=======",
    "# B",
    ">>>>>>>",
  ].join("\n");

  it("applies exact replacements, appends and creates, taking backticks, $ and quotes as they are", () => {
    const files = parseEdits(edits);
    expect(files.map((f) => [f.path, f.create, f.blocks.map((b) => b.mode)])).toEqual([
      ["docs/a.md", false, ["once", "end"]],
      ["docs/b.md", true, ["once"]],
    ]);
    const read = (p: string) => (p === "docs/a.md" ? `x\nthe ${B}enemy-away${B} assumption ($x)\ny\n` : undefined);
    const { texts, errors } = applyEdits(files, read);
    expect(errors).toEqual([]);
    expect(texts.get("docs/a.md")).toBe(`x\nthe ${B}enemy-away${B} reading ("away")\ny\nan appended line\n`);
    expect(texts.get("docs/b.md")).toBe("# B\n");
  });

  it("writes nothing when a block misses or matches twice, and says where the nearest line is", () => {
    const files = parseEdits(["@@@ a.md", "<<<<<<<", "the old line", "=======", "new", ">>>>>>>", "<<<<<<<", "twice", "=======", "once", ">>>>>>>"].join("\n"));
    const { errors } = applyEdits(files, () => "the old  line\ntwice\ntwice\n");
    expect(errors).toEqual([`a.md: the block at line 2 doesn't match (nearest: line 1: the old  line)`, `a.md: the block at line 7 matches 2 times (give more context, or "<<<<<<< all")`]);
    expect(applyEdits(parseEdits(["@@@ a.md", "<<<<<<< all", "twice", "=======", "once", ">>>>>>>"].join("\n")), () => "twice twice\n").texts.get("a.md")).toBe("once once\n");
  });

  it("refuses a malformed block", () => {
    expect(() => parseEdits("<<<<<<<\nx\n=======\ny\n>>>>>>>")).toThrow(/before any "@@@ <path>"/);
    expect(() => parseEdits("@@@ a.md\n<<<<<<<\nx\n>>>>>>>")).toThrow(/no "=======" line/);
    expect(() => parseEdits("@@@ a.md\n<<<<<<<\nx\n=======\ny")).toThrow(/isn't closed/);
    expect(() => parseEdits("@@@ a.md\n<<<<<<<\n=======\ny\n>>>>>>>")).toThrow(/no old text/);
  });
});

describe("a shell substitution's damage in a doc", () => {
  it("finds the shapes the shell leaves of code spans: double spaces, (), a space before punctuation, an empty span", () => {
    // "the `enemy-away` assumption (`away`), read `x`." with each span run as a command that printed nothing:
    const damaged = ["the  assumption (), read .", "an empty `` span", "fine `code  spaced` and (a) call() and [x]()"];
    expect(damagedText(damaged.join("\n")).map((d) => [d.line, d.why])).toEqual([
      [1, "two spaces between words"],
      [2, "an empty code span"],
    ]);
    expect(damagedText("a `` ` `` double span\n```\nfenced  block\n```\n| a  table |\n| row  |")).toEqual([]);
    expect(damagedText("a span `over\ntwo  lines` is code")).toEqual([]);
  });

  it("no doc in the repository has any (scripts/check-links.ts prints them)", () => {
    expect(damagedDocs().map((d) => `${d.file}:${d.line}: ${d.why}: ${d.text}`)).toEqual([]);
  });
});

describe("scripts/bash-guard.ts", () => {
  it("refuses a heredoc and an inline script over lines or with a backtick", () => {
    expect(refusal("cat > scratch/x.py <<'EOF'\nprint(1)\nEOF")).toMatch(/a heredoc/);
    expect(refusal("python3 -I -c \"import sys\nprint(1)\"")).toMatch(/several lines/);
    expect(refusal(`python3 -c "s = s.replace('${B}x${B}', 'y')"`)).toMatch(/backtick/);
    expect(refusal("node -e \"a\nb\"")).toMatch(/several lines/);
    expect(refusal("bash -c 'a\nb'")).toMatch(/several lines/);
  });

  it("lets plain commands through", () => {
    for (const c of ["python3 -I scratch/patch.py", "python3 -I -c \"print(1)\"", "node scratch/x.ts --flag", "node scripts/edit.ts scratch/e.txt", "git commit -F scratch/msg.txt -- docs", "npx vitest run tests/x.test.ts -t \"a << b\"".replace("<< b", "<<1"), "echo $((1 << 2))", "bash scratch/x.sh"]) expect(refusal(c), c).toBeUndefined();
  });
});
