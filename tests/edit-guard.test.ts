// The safe path for text edits and its guards (improvement round 9: a multi-line `python3 -c` or a heredoc slipped
// through in three agent rounds of four, once writing a shell's empty command substitutions into a doc):
// scripts/edit.ts (exact replacements from an edits file), scripts/check-links.ts damagedText (the damage's shapes in
// a doc) and scripts/bash-guard.ts (the hook that refuses the forms).
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chained, commitMessageFile, refusal, refusalText, staleMessage } from "../scripts/bash-guard.ts";
import { damagedDocs, damagedText } from "../scripts/check-links.ts";
import { applyEdits, parseEdits } from "../scripts/edit.ts";

const B = "`";

describe("scripts/edit.ts", () => {
  it("replaces a part of one line: a name inside a long import (round 23, the team-SP report point 4)", () => {
    const line = `import { a, b, c, ${Array.from({ length: 40 }, (_, i) => `name${i}`).join(", ")} } from "./x.ts";`;
    const files = parseEdits(["@@@ x.ts", "<<<<<<<", "name7, name8,", "=======", "name7, engineReading, name8,", ">>>>>>>"].join("\n"));
    const { texts, errors } = applyEdits(files, () => `${line}\nconst y = 1;\n`);
    expect(errors).toEqual([]);
    expect(texts.get("x.ts")).toContain("name7, engineReading, name8,");
    expect(texts.get("x.ts")?.split("\n")).toHaveLength(3);
    // A part that repeats is refused, as a whole line is.
    expect(applyEdits(parseEdits(["@@@ x.ts", "<<<<<<<", "name", "=======", "x", ">>>>>>>"].join("\n")), () => line).errors[0]).toMatch(/matches 4\d times/);
  });

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
    // The markers' typo (round 10 friction point 4): the mode on its own line.
    expect(() => parseEdits("@@@ a.md\n<<<<<<<\nend\n=======\ny\n>>>>>>>")).toThrow(/did you mean "<<<<<<< end"/);
  });

  it("takes an end block without its \"=======\" (round 12 friction point 6: nothing to replace, so no separator)", () => {
    const [f] = parseEdits("@@@ a.md\n<<<<<<< end\ny\nz\n>>>>>>>");
    expect(f?.blocks).toEqual([{ mode: "end", old: "", new: "y\nz", line: 2 }]);
    expect(parseEdits("@@@ a.md\n<<<<<<< end\n=======\ny\nz\n>>>>>>>")[0]?.blocks).toEqual(f?.blocks);
  });

  it("closes an end block at the next \"@@@\" line or the file's end (round 21, round 20's own report point 2)", () => {
    const files = parseEdits("@@@ a.md\n<<<<<<< end\ny\n\n@@@ b.md\n<<<<<<< end\nz\n\n");
    expect(files.map((f) => [f.path, f.blocks.map((b) => b.new)])).toEqual([["a.md", ["y"]], ["b.md", ["z"]]]);
    // A replacing block still needs its closer.
    expect(() => parseEdits("@@@ a.md\n<<<<<<<\nx\n=======\ny\n@@@ b.md")).toThrow(/inside the block/);
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
    // A merge's conflict markers (round 15: docs/roadmap.md had one).
    expect(damagedText("text\n>>>>>>> 9e1904d\nmore").map((d) => d.why)).toEqual(["a merge's conflict marker"]);
    expect(damagedText("<<<<<<< HEAD").map((d) => d.why)).toEqual(["a merge's conflict marker"]);
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
    expect(refusal("git commit -q -m \"title\n\nbody\" -- a.ts")).toMatch(/multi-line commit message/);
    expect(refusal(`git commit -m "the ${B}x${B} view" -- a.ts`)).toMatch(/backtick the shell would run/);
    expect(refusal(`echo "${B}date${B}" > a.md`)).toMatch(/backtick the shell would run/);
    // A sed insertion the harness's worktree check refuses (round 15): the refusal names the Edit tool first.
    expect(refusal("sed -i '288a\\ a new line' packages/logs/src/x.ts")).toMatch(/a sed insertion .*the Edit tool/);
    expect(refusal("sed -i 's/a/b/' packages/logs/src/x.ts")).toBeUndefined();
  });

  it("lets a backtick in single quotes or escaped through", () => {
    expect(refusal(`grep -n '${B}x${B}' docs/a.md`)).toBeUndefined();
    expect(refusal(`echo "a \\${B}b\\${B}"`)).toBeUndefined();
  });

  it("lets plain commands through", () => {
    for (const c of ["python3 -I scratch/patch.py", "python3 -I -c \"print(1)\"", "node scratch/x.ts --flag", "node scripts/edit.ts scratch/e.txt", "git commit -F scratch/msg.txt -- docs", "npx vitest run tests/x.test.ts -t \"a << b\"".replace("<< b", "<<1"), "echo $((1 << 2))", "bash scratch/x.sh"]) expect(refusal(c), c).toBeUndefined();
  });

  it("says a refused chained call ran nothing (round 16, round 15's own report point 1)", () => {
    const heredoc = "cat > a <<'EOF'\nx\nEOF";
    expect(chained(`node scripts/edit.ts e.txt && ${heredoc}`)).toBe(true);
    expect(chained("node scripts/edit.ts e.txt | head")).toBe(true);
    expect(chained("grep -n 'a && b; c | d' docs/x.md")).toBe(false);
    expect(chained("node scripts/edit.ts e.txt")).toBe(false);
    expect(refusalText(`node scripts/edit.ts e.txt && ${heredoc}`, "a heredoc.")).toMatch(/Nothing in this call ran, its other commands included/);
    expect(refusalText("echo \"`date`\"", "a backtick.")).not.toMatch(/Nothing in this call ran/);
  });

  it("refuses a commit whose message file still holds the last commit's message (round 18, round 17's own report point 1)", () => {
    expect(commitMessageFile("git commit -F scratch/msg.txt -- docs")).toBe("scratch/msg.txt");
    expect(commitMessageFile("git commit -q --file=scratch/m.txt -- a")).toBe("scratch/m.txt");
    expect(commitMessageFile("git commit -qF 'scratch/m 2.txt'")).toBe("scratch/m 2.txt");
    expect(commitMessageFile("git log -F x")).toBeUndefined();
    expect(commitMessageFile("git commit -m title -- a")).toBeUndefined();
    const head = "Totals: share per line\n\nbody\n\nCo-Authored-By: x\n";
    expect(staleMessage("scratch/msg.txt", head.trim() + "\n", head)).toMatch(/still holds the last commit's message/);
    expect(staleMessage("scratch/msg.txt", "Another change\n", head)).toBeUndefined();
    expect(staleMessage("scratch/msg.txt", "  \n", head)).toBeUndefined();
  });

  it("checks a command written to a file (--check-file), so a forbidden form is tried without the harness seeing it", () => {
    const file = join(mkdtempSync(join(tmpdir(), "guard-")), "cmd.txt");
    writeFileSync(file, "sed -i '288a\\ a new line' packages/logs/src/x.ts\n");
    const r = spawnSync(process.execPath, [join(import.meta.dirname, "..", "scripts", "bash-guard.ts"), "--check-file", file], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^refused: a sed insertion/);
  });
});
