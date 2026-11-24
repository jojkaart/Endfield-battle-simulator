// Applies a batch of exact text replacements from an edits file: the one-command form of an edit that would otherwise
// tempt a heredoc or a multi-line `python3 -c` (CLAUDE.md "Worktrees and sub-agents"; three rounds in four had one
// slip through, once writing a shell's command substitutions of Markdown backticks into docs/open-problems.md). The
// edits file is written with the Write tool, so its text never passes through a shell: backticks, `$`, quotes and
// newlines are taken as they are.
//
// Usage: node scripts/edit.ts <edits file> [--dry-run]
//
// The edits file: a `@@@ <path>` line names the file (relative to the repository root, or absolute) for the blocks
// after it; each block replaces one exact text with another:
//
//   @@@ docs/open-problems.md
//   <<<<<<<
//   the old text (one or more whole lines, exactly as in the file)
//   =======
//   the new text (empty: the old lines are deleted)
//   >>>>>>>
//
// `<<<<<<< all` replaces every occurrence (at least one); `<<<<<<< end` takes no old text and appends the new lines at
// the end of the file (a new describe block, a journal paragraph); `@@@ new <path>` creates a file that mustn't exist
// yet, from its blocks' new text. Markers are whole lines; anything outside blocks is ignored (comments).
//
// All or nothing: every old text must occur exactly once (`all`: at least once) in the file as the earlier blocks
// left it, or nothing is written and each miss is reported with the file's nearest line. After writing, each edited
// Markdown file is checked for shell-substitution damage (scripts/check-links.ts damagedText: an empty code span, a
// double space or "()" in prose, a space before a comma or full stop), which `npm test` checks over every doc too.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { damagedText } from "./check-links.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface EditBlock {
  readonly mode: "once" | "all" | "end";
  readonly old: string;
  readonly new: string;
  /** The block's first line in the edits file (1-based), for messages. */
  readonly line: number;
}

export interface FileEdits {
  readonly path: string;
  /** `@@@ new <path>`: the file is created (it mustn't exist). */
  readonly create: boolean;
  readonly blocks: readonly EditBlock[];
}

const OPEN = /^<{7}(?: (all|end))?$/;
const MID = /^={7}$/;
const CLOSE = /^>{7}$/;
const FILE = /^@@@ (new )?(.+?)\s*$/;

/** The edits file's files and blocks, in order; throws on a malformed block. */
export function parseEdits(text: string): FileEdits[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: { path: string; create: boolean; blocks: EditBlock[] }[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i] as string;
    const f = FILE.exec(l);
    if (f) {
      out.push({ path: f[2] as string, create: f[1] !== undefined, blocks: [] });
      i++;
      continue;
    }
    const o = OPEN.exec(l);
    if (!o) {
      i++;
      continue;
    }
    const start = i + 1;
    const file = out[out.length - 1];
    if (!file) throw new Error(`line ${start}: a block before any "@@@ <path>" line`);
    const mode = (o[1] ?? "once") as EditBlock["mode"];
    const old: string[] = [];
    const neu: string[] = [];
    let part: string[] = old;
    let mid = false;
    i++;
    for (;;) {
      if (i >= lines.length) throw new Error(`line ${start}: the block isn't closed (">>>>>>>")`);
      const x = lines[i] as string;
      i++;
      if (MID.test(x) && !mid) {
        mid = true;
        part = neu;
        continue;
      }
      if (CLOSE.test(x)) break;
      if (OPEN.test(x) || FILE.test(x)) throw new Error(`line ${i}: "${x}" inside the block opened at line ${start}`);
      part.push(x);
    }
    if (!mid) throw new Error(`line ${start}: the block has no "=======" line${mode === "end" ? ` (an "end" block too: "<<<<<<< end", then "=======", the new lines, ">>>>>>>")` : ""}`);
    // The markers' one easy typo (round 10 friction point 4): the mode on a line of its own, read as the old text.
    if (mode === "once" && (old.join("\n").trim() === "end" || old.join("\n").trim() === "all")) throw new Error(`line ${start}: the old text is "${old.join("").trim()}": did you mean "<<<<<<< ${old.join("").trim()}" (the mode on the marker's own line)?`);
    if (mode === "end" && old.length) throw new Error(`line ${start}: an "end" block takes no old text (it appends)`);
    if (mode !== "end" && !file.create && !old.length) throw new Error(`line ${start}: no old text (use "<<<<<<< end" to append)`);
    file.blocks.push({ mode, old: old.join("\n"), new: neu.join("\n"), line: start });
  }
  return out;
}

const count = (s: string, sub: string) => {
  let n = 0;
  for (let at = s.indexOf(sub); at >= 0; at = s.indexOf(sub, at + sub.length)) n++;
  return n;
};

/** The line of `text` most like `old`'s first non-blank line (for a miss's message), or "". */
function nearest(text: string, old: string): string {
  const want = (old.split("\n").find((l) => l.trim()) ?? "").trim();
  if (!want) return "";
  const words = new Set(want.split(/\s+/));
  let best = { score: 0, line: 0, text: "" };
  text.split("\n").forEach((l, i) => {
    const score = l.split(/\s+/).filter((w) => words.has(w)).length;
    if (score > best.score) best = { score, line: i + 1, text: l.trim() };
  });
  return best.score ? ` (nearest: line ${best.line}: ${best.text.slice(0, 120)})` : "";
}

/**
 * The files' new texts, or the misses: every block applied in order to the text the earlier ones left. `read` gives a
 * file's current text (undefined: it doesn't exist).
 */
export function applyEdits(files: readonly FileEdits[], read: (path: string) => string | undefined): { texts: Map<string, string>; errors: string[] } {
  const texts = new Map<string, string>();
  const errors: string[] = [];
  for (const f of files) {
    const had = texts.get(f.path) ?? read(f.path);
    if (f.create && had !== undefined) {
      errors.push(`${f.path}: "@@@ new" but the file exists`);
      continue;
    }
    if (!f.create && had === undefined) {
      errors.push(`${f.path}: no such file ("@@@ new ${f.path}" creates one)`);
      continue;
    }
    let s = had ?? "";
    for (const b of f.blocks) {
      if (f.create || b.mode === "end") {
        s = s === "" ? `${b.new}\n` : `${s}${s.endsWith("\n") ? "" : "\n"}${b.new}\n`;
        continue;
      }
      const n = count(s, b.old);
      if (b.mode === "all" ? n === 0 : n !== 1) {
        errors.push(`${f.path}: the block at line ${b.line} ${n === 0 ? "doesn't match" : `matches ${n} times (give more context, or "<<<<<<< all")`}${n === 0 ? nearest(s, b.old) : ""}`);
        continue;
      }
      s = b.mode === "all" ? s.split(b.old).join(b.new) : s.replace(b.old, () => b.new);
    }
    texts.set(f.path, s);
  }
  return { texts, errors };
}

function main(argv: readonly string[]): number {
  const dry = argv.includes("--dry-run");
  const file = argv.find((a) => !a.startsWith("--"));
  if (!file) {
    process.stderr.write("usage: node scripts/edit.ts <edits file> [--dry-run]   (the format: this script's header)\n");
    return 2;
  }
  const files = parseEdits(readFileSync(file, "utf8")).map((f) => ({ ...f, path: isAbsolute(f.path) ? f.path : join(ROOT, f.path) }));
  if (!files.length) {
    process.stderr.write(`edit: ${file} names no file ("@@@ <path>" lines)\n`);
    return 2;
  }
  const { texts, errors } = applyEdits(files, (p) => (existsSync(p) ? readFileSync(p, "utf8") : undefined));
  const rel = (p: string) => relative(ROOT, p) || p;
  if (errors.length) {
    for (const e of errors) process.stderr.write(`edit: ${e.replace(ROOT + "/", "")}\n`);
    process.stderr.write("edit: nothing written\n");
    return 1;
  }
  for (const [p, s] of texts) {
    const blocks = files.filter((f) => f.path === p).reduce((n, f) => n + f.blocks.length, 0);
    if (!dry) writeFileSync(p, s);
    process.stdout.write(`edit: ${rel(p)}: ${blocks} block(s) ${dry ? "would apply" : "applied"}\n`);
    if (p.endsWith(".md")) for (const d of damagedText(s)) process.stderr.write(`edit: ${rel(p)}:${d.line}: ${d.why}: ${d.text}\n`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
