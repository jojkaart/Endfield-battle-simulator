// Checks that the repository's relative Markdown links resolve: every `[text](path)` and `[text](path#anchor)` in a
// tracked .md file (outside data/, reference/, node_modules/ and scratch/) names a file or folder that exists and, for
// an anchor into a Markdown file, a heading there (GitHub's slugs). Links in code blocks and inline code are skipped,
// as are web links. tests/doc-links.test.ts runs it; after moving a doc or splitting one, run it to find what to fix.
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const broken = brokenLinks();
  for (const b of broken) process.stdout.write(`${b.file}:${b.line}: ${b.target} — ${b.why}\n`);
  process.stdout.write(`check-links: ${broken.length} broken relative link${broken.length === 1 ? "" : "s"} in ${markdownFiles().length} Markdown files\n`);
  process.exitCode = broken.length ? 1 : 0;
}
