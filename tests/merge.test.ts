// scripts/merge.ts: merging a branch rebuilds the built journal files instead of leaving their conflict, in a
// throwaway repository with two branches that each add a journal entry.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { classify, mergeBranch, sharedCode, shownPaths } from "../scripts/merge.ts";
import { ROOT } from "./logverdicts.ts";

const tmp = mkdtempSync(join(tmpdir(), "efsim-merge-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function repo(name: string): { root: string; git: (...a: string[]) => string; entry: (file: string, title: string) => void } {
  const root = join(tmp, name);
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "docs", "journal"), { recursive: true });
  for (const f of ["journal.ts", "merge.ts", "usage.ts"]) copyFileSync(join(ROOT, "scripts", f), join(root, "scripts", f));
  writeFileSync(join(root, "package.json"), '{ "type": "module" }\n');
  const git = (...a: string[]) => execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const entry = (file: string, title: string) => {
    writeFileSync(join(root, "docs", "journal", file), `## ${file.slice(0, 10)}: ${title}\n\nText of ${title}.\n`);
    execFileSync("node", ["scripts/journal.ts"], { cwd: root, stdio: "ignore" });
    git("add", "-A");
    git("commit", "-q", "-m", title);
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "test");
  entry("2026-11-01-01-base.md", "Base");
  return { root, git, entry };
}

describe("merging a branch (scripts/merge.ts)", () => {
  it("rebuilds the built journal files of two branches that each added an entry", () => {
    const { root, git, entry } = repo("journal");
    git("checkout", "-q", "-b", "side");
    entry("2026-11-02-01-side.md", "Side");
    git("checkout", "-q", "main");
    entry("2026-11-02-01-main.md", "Main");
    const r = mergeBranch(root, "side", { log: () => {} });
    expect(r).toMatchObject({ committed: true, rebuiltJournal: true, left: [] });
    const journal = readFileSync(join(root, "docs", "journal.md"), "utf8");
    expect(journal).toContain("2026-11-02: Side");
    expect(journal).toContain("2026-11-02: Main");
    expect(git("status", "--porcelain")).toBe("");
    execFileSync("node", ["scripts/journal.ts", "--check"], { cwd: root, stdio: "ignore" });
  });

  it("leaves other conflicts for a person and doesn't commit", () => {
    const { root, git } = repo("other");
    const edit = (text: string) => {
      writeFileSync(join(root, "notes.txt"), text);
      git("add", "notes.txt");
      git("commit", "-q", "-m", text);
    };
    edit("base\n");
    git("checkout", "-q", "-b", "side");
    edit("side\n");
    git("checkout", "-q", "main");
    edit("main\n");
    const r = mergeBranch(root, "side", { log: () => {} });
    expect(r).toMatchObject({ committed: false, left: ["notes.txt"] });
    git("merge", "--abort");
  });

  it("sorts conflicts into journal, snapshots and the rest", () => {
    expect(classify(["docs/journal.md", "tests/snapshots/examples.json", "docs/accuracy.md", "packages/x.ts", "docs/journal/README.md"])).toEqual({
      journal: ["docs/journal.md", "docs/journal/README.md"],
      snapshots: ["tests/snapshots/examples.json", "docs/accuracy.md"],
      left: ["packages/x.ts"],
    });
  });
});

describe("the code both sides of a merge changed (scripts/merge.ts sharedCode)", () => {
  it("takes either side's source files in a package both changed, and files both changed", () => {
    // Round 5: one branch's tick hold in buffreplay.ts, the other's kit and replay change: both touch packages/logs.
    const ours = ["packages/logs/src/buffreplay.ts", "packages/engine/src/x.ts", "scripts/a.ts", "docs/x.md"];
    const theirs = ["packages/logs/src/query.ts", "packages/data/kits/k.json", "scripts/a.ts", "docs/x.md"];
    expect(sharedCode(ours, theirs)).toEqual(["packages/logs/src/buffreplay.ts", "packages/logs/src/query.ts", "scripts/a.ts"]);
    expect(sharedCode(["packages/engine/src/x.ts"], ["packages/logs/src/y.ts"])).toEqual([]);
  });
});

describe("paths merge prints (scripts/merge.ts shownPaths)", () => {
  it("never names a hold-out fixture, only counts them (round 8)", () => {
    const shown = shownPaths(["docs/a.md", "fixtures/holdout/zmdlogs-x.json", "fixtures/holdout/zmdlogs-y.json"]);
    expect(shown).toEqual(["docs/a.md", "2 file(s) under fixtures/holdout/ (not named)"]);
    expect(shown.join(" ")).not.toMatch(/zmdlogs-[xy]/);
  });
});
