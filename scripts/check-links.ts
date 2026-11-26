// Checks that the repository's relative Markdown links resolve: every `[text](path)` and `[text](path#anchor)` in a
// tracked .md file (outside data/, reference/, node_modules/ and scratch/) names a file or folder that exists and, for
// an anchor into a Markdown file, a heading there (GitHub's slugs). Links in code blocks and inline code are skipped,
// as are web links. tests/doc-links.test.ts runs it; after moving a doc or splitting one, run it to find what to fix.
//
// Also the prose citations of a source file's function, "<file>.ts <identifier>" or "<file>.ts `<identifier>`"
// (staleCitations; round 14's own report point 3: after buffreplay.ts's split some fifty cited it for functions then
// in other files, three of them wrong before the split): in the docs (the journal's, friction's and tried diffs'
// history aside) and the packages' and scripts' sources, each code-shaped identifier (camelCase, PascalCase,
// UPPER_CASE, or in backticks) must be declared in a file of that name. Printed as warnings; tests/doc-links.test.ts
// holds the tree to none.
//
// Usage: node scripts/check-links.ts      (prints each broken link as file:line: target — why; exit 1 if any)

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = /^(data|reference|node_modules|scratch|\.claude)\//;

/** GitHub's anchor for a heading: lower case, punctuation dropped (letters, digits, spaces, - and _ kept), spaces to -. */
export function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_]{1,2}([^`*_]+)[`*_]{1,2}/g, "$1")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** The text without fenced code blocks and inline code (blanked to keep line numbers). */
function withoutCode(text: string): string {
  return text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, (m) => m.replace(/[^\n]/g, " ")).replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
}

const anchorCache = new Map<string, Set<string>>();

/** The anchors a Markdown file's headings make (duplicates numbered as GitHub does), and explicit <a id/name> ones. */
export function anchorsOf(file: string): Set<string> {
  const cached = anchorCache.get(file);
  if (cached) return cached;
  const out = new Set<string>();
  const counts = new Map<string, number>();
  for (const line of withoutCode(readFileSync(file, "utf8")).split("\n")) {
    const h = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const base = slug(h[1] as string);
      const n = counts.get(base) ?? 0;
      counts.set(base, n + 1);
      out.add(n ? `${base}-${n}` : base);
    }
    for (const m of line.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) out.add(m[1] as string);
  }
  anchorCache.set(file, out);
  return out;
}

export interface BrokenLink {
  readonly file: string;
  readonly line: number;
  readonly target: string;
  readonly why: string;
}

/** The tracked Markdown files to check (git ls-files; untracked new ones too). */
export function markdownFiles(root: string = ROOT): string[] {
  const r = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.md"], { cwd: root, encoding: "utf8" });
  return r.stdout.split("\n").filter((f) => f && !SKIP.test(f) && existsSync(join(root, f)));
}

/** Every relative link in the files that doesn't resolve. */
export function brokenLinks(files: readonly string[] = markdownFiles(), root: string = ROOT): BrokenLink[] {
  const out: BrokenLink[] = [];
  for (const rel of files) {
    const file = join(root, rel);
    const lines = withoutCode(readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
        const target = m[1] as string;
        if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // https:, mailto:, …
        const [path, anchor] = target.split("#", 2) as [string, string | undefined];
        const dest = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
        const bad = (why: string) => out.push({ file: rel, line: i + 1, target, why });
        if (!existsSync(dest)) {
          bad("no such file");
          continue;
        }
        if (anchor === undefined || anchor === "") continue;
        if (statSync(dest).isDirectory() || !dest.endsWith(".md")) continue;
        if (/^L\d+(-L\d+)?$/.test(anchor)) continue; // a line link
        if (!anchorsOf(dest).has(anchor.toLowerCase())) bad(`no heading for #${anchor} in ${relative(root, dest)}`);
      }
    });
  }
  return out;
}

export interface DamagedLine {
  readonly line: number;
  readonly why: string;
  readonly text: string;
}

/**
 * Lines of a Markdown text that look like a shell's substitution damage: what a doc edit passed through `python3 -c
 * "…"` or a heredoc leaves when the shell runs the text's `code spans` (or `$x`) as commands and puts their (empty)
 * output in their place (fight-totals report point 3: "the  assumption ()" in docs/open-problems.md). In prose, outside
 * fenced blocks, code spans and tables: an empty code span, two spaces between words, "()" not after a name, a space
 * before a comma, full stop or closing parenthesis. The docs have none of these on purpose; scripts/edit.ts checks the
 * files it edits, tests/doc-links.test.ts every doc.
 */
export function damagedText(text: string): DamagedLine[] {
  const fill = (m: string) => m.replace(/[^\n]/g, "x");
  const lines = text.split("\n");
  // Fenced blocks blanked (kept as lines); then code spans, which may run over lines of one paragraph, filled with x.
  const unfenced = text.replace(/^(\s*)(```|~~~)[^\n]*\n[\s\S]*?^\s*\2[^\n]*$/gm, (m) => m.replace(/[^\n]/g, ""));
  // Double-backtick spans (`` ` ``) first, so what is left of "``" is an empty span.
  const doubled = unfenced.replace(/`` (?:[^`\n]|`(?!`)|\n(?!\s*\n))+? ``/g, fill);
  const raw = doubled.split("\n");
  const prose = doubled.replace(/(?<!`)`(?!`)(?:[^`\n]|\n(?!\s*\n))+`/g, fill).split("\n");
  const out: DamagedLine[] = [];
  const checks: [RegExp, string, "raw" | "prose"][] = [
    [/(^|[^`])``([^`]|$)/, "an empty code span", "raw"],
    [/\S {2,}\S/, "two spaces between words", "prose"],
    [/(^|[^\w\]])\(\s*\)/, '"()" with nothing in it', "prose"],
    [/\w [,.)](\s|$)/, "a space before a comma, full stop or parenthesis", "prose"],
  ];
  prose.forEach((p, i) => {
    if (/^\s*\|/.test(p) || /^\s*<!--/.test(p)) return;
    for (const [re, why, which] of checks) {
      if (re.test(which === "raw" ? (raw[i] as string) : p)) {
        out.push({ line: i + 1, why, text: (lines[i] as string).trim().slice(0, 120) });
        break;
      }
    }
  });
  return out;
}

/** damagedText over the docs: file, line and why. */
export function damagedDocs(files: readonly string[] = markdownFiles(), root: string = ROOT): (DamagedLine & { readonly file: string })[] {
  return files.flatMap((rel) => damagedText(readFileSync(join(root, rel), "utf8")).map((d) => ({ file: rel, ...d })));
}

/** Docs whose citations are history (an entry or report cites the code as it was then). */
const HISTORY = /^docs\/(journal\/|journal\.md$|friction\/|friction-done\/|tried\/|analysis\/|kit-batches\/)/;

/** Keywords a backticked citation may start with (`case "jump"`, `if`): not identifiers. */
const KEYWORDS = new Set(["case", "if", "else", "return", "const", "let", "function", "for", "while", "new", "typeof", "await"]);

/** A prose citation of an identifier in a file that declares no such name (staleCitations). */
export interface StaleCitation {
  readonly file: string;
  readonly line: number;
  readonly cited: string;
  readonly identifier: string;
  readonly why: string;
}

/** The names a TypeScript source declares (functions, consts, lets, classes, interfaces, types, enums, re-exports, members `name:` / `name(`). */
export function declaredNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b(?:function\*?|const|let|var|class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) for (const n of (m[1] as string).split(",")) out.add(n.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, "") ?? "");
  // Members and properties (an interface's fields, an object's keys, a method): `BuffReplay.made` cites its first part.
  for (const m of text.matchAll(/^\s*(?:readonly\s+|async\s+|static\s+|get\s+|private\s+|public\s+)*([A-Za-z_$][\w$]*)\??\s*[:(]/gm)) out.add(m[1] as string);
  // An inline type's fields (`| { readonly attr: AttrType }`).
  for (const m of text.matchAll(/\{\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/g)) out.add(m[1] as string);
  // A kind or case its code names as a string (an action's `case "openCombo"`, an expression's `kind: "attr"`).
  for (const m of text.matchAll(/(?:case\s+|kind:\s*|kind\s*===\s*)"([A-Za-z_$][\w$]*)"/g)) out.add(m[1] as string);
  return out;
}

/** Whether a cited word is code-shaped: camelCase, PascalCase with two parts, UPPER_CASE, or with a digit or underscore inside. */
const codeShaped = (w: string, quoted: boolean) => quoted || /[a-z][A-Z]/.test(w) || /^[A-Z][a-z0-9]+[A-Z]/.test(w) || /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(w) || /^[a-z]+_[a-z_]+$/.test(w);

/** Every "<file>.ts <identifier>" citation in the docs and sources whose file of that name declares no such identifier. */
export function staleCitations(root: string = ROOT): StaleCitation[] {
  const ls = (pattern: string) => spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", pattern], { cwd: root, encoding: "utf8" }).stdout.split("\n").filter((f) => f && !SKIP.test(f) && existsSync(join(root, f)));
  const sources = ls("*.ts").filter((f) => /^(packages|scripts)\//.test(f));
  const byName = new Map<string, Set<string>>();
  const texts = new Map<string, string>();
  for (const f of sources) {
    const text = readFileSync(join(root, f), "utf8");
    texts.set(f, text);
    const base = f.slice(f.lastIndexOf("/") + 1);
    const names = byName.get(base) ?? new Set<string>();
    for (const n of declaredNames(text)) names.add(n);
    byName.set(base, names);
  }
  const files = [...ls("*.md").filter((f) => !HISTORY.test(f)), ...sources];
  const out: StaleCitation[] = [];
  for (const rel of files) {
    const text = texts.get(rel) ?? readFileSync(join(root, rel), "utf8");
    for (const [i, line] of text.split("\n").entries()) {
      for (const m of line.matchAll(/([\w./-]*\/)?\b([a-z][\w-]*\.ts) (`?)([A-Za-z_$][\w$]*)((?:\.[\w$]+)*)(\*?)/g)) {
        const [, dir, file, tick, id, , star] = m as unknown as [string, string | undefined, string, string, string, string, string];
        if (star || KEYWORDS.has(id) || !codeShaped(id, tick === "`")) continue;
        // A path cites that file (tests/helpers/buffs.ts buffHistory); a bare name any file of that name.
        const path = dir ? join(dir, file) : undefined;
        const names = path && !path.startsWith("packages/") && !path.startsWith("scripts/") && existsSync(join(root, path)) ? declaredNames(readFileSync(join(root, path), "utf8")) : byName.get(file);
        if (!names) continue; // a file outside packages/ and scripts/ (a test's, a scratch script's), or one gone: the links' and the reader's
        if (names.has(id)) continue;
        out.push({ file: rel, line: i + 1, cited: m[0], identifier: id, why: `no file named ${file} declares ${id}` });
      }
    }
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const broken = brokenLinks();
  for (const b of broken) process.stdout.write(`${b.file}:${b.line}: ${b.target} — ${b.why}\n`);
  const stale = staleCitations();
  for (const c of stale) process.stdout.write(`${c.file}:${c.line}: warning: "${c.cited}": ${c.why}\n`);
  if (stale.length) process.stdout.write(`check-links: ${stale.length} stale citation(s) of a source file's identifier (warnings; tests/doc-links.test.ts fails on them)\n`);
  const damaged = damagedDocs();
  for (const d of damaged) process.stdout.write(`${d.file}:${d.line}: ${d.why} (a shell substitution's damage?): ${d.text}\n`);
  process.stdout.write(`check-links: ${broken.length} broken relative link${broken.length === 1 ? "" : "s"}, ${damaged.length} damaged-looking line${damaged.length === 1 ? "" : "s"} in ${markdownFiles().length} Markdown files\n`);
  process.exitCode = broken.length || damaged.length ? 1 : 0;
}
