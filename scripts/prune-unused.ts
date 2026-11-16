// Removes unused imports and unused top-level declarations from TypeScript files, through TypeScript's own language
// service (the editor's "remove unused imports" and "delete unused declaration" fixes): for a test file split in two,
// where each half keeps imports and helpers only the other uses. ESLint reports them but its --fix doesn't remove them.
//
// Usage: node scripts/prune-unused.ts <file.ts> […]      (npm run prune-unused -- <files>; rewrites the files)
// Check the diff afterwards: a declaration kept only for its side effects would go too.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

function service(files: readonly string[]): { ls: ts.LanguageService; text: Map<string, string> } {
  const config = ts.getParsedCommandLineOfConfigFile(resolve(ROOT, "tsconfig.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  const options: ts.CompilerOptions = { ...(config?.options ?? {}), noUnusedLocals: true, noUnusedParameters: false };
  const text = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
  const version = new Map(files.map((f) => [f, 0]));
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => options,
    getScriptFileNames: () => [...files],
    getScriptVersion: (f) => String(version.get(f) ?? 0),
    getScriptSnapshot: (f) => {
      const t = text.get(f) ?? (ts.sys.fileExists(f) ? ts.sys.readFile(f) : undefined);
      return t === undefined ? undefined : ts.ScriptSnapshot.fromString(t);
    },
    getCurrentDirectory: () => ROOT,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  const ls = ts.createLanguageService(host);
  // Edits bump the file's version so the service reads the new text.
  const set = text.set.bind(text);
  text.set = (f, t) => {
    version.set(f, (version.get(f) ?? 0) + 1);
    return set(f, t);
  };
  return { ls, text };
}

function applyChanges(text: string, changes: readonly ts.TextChange[]): string {
  let out = text;
  for (const c of [...changes].sort((a, b) => b.span.start - a.span.start)) out = out.slice(0, c.span.start) + c.newText + out.slice(c.span.start + c.span.length);
  return out;
}

/** The repository's style for the import lines the service rewrites (`{ a, b }`, double quotes). */
const FORMAT: ts.FormatCodeSettings = {
  ...ts.getDefaultFormatCodeSettings("\n"),
  indentSize: 2,
  tabSize: 2,
  convertTabsToSpaces: true,
  insertSpaceAfterCommaDelimiter: true,
  insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
  semicolons: ts.SemicolonPreference.Insert,
};

/** Prunes the files in place; returns how many changed. */
export function pruneUnused(files: readonly string[]): number {
  const abs = files.map((f) => resolve(f));
  const { ls, text } = service(abs);
  let changed = 0;
  for (const f of abs) {
    const before = text.get(f) as string;
    // Unused declarations first (deleting a helper can leave its imports unused), a few rounds.
    for (let round = 0; round < 3; round++) {
      const fix = ls.getCombinedCodeFix({ type: "file", fileName: f }, "unusedIdentifier_delete", {}, {});
      const edits = fix.changes.filter((c) => c.fileName === f).flatMap((c) => c.textChanges);
      if (!edits.length) break;
      text.set(f, applyChanges(text.get(f) as string, edits));
    }
    const organized = ls.organizeImports({ type: "file", fileName: f, mode: ts.OrganizeImportsMode.RemoveUnused }, FORMAT, {});
    const edits = organized.filter((c) => c.fileName === f).flatMap((c) => c.textChanges);
    if (edits.length) text.set(f, applyChanges(text.get(f) as string, edits));
    const after = text.get(f) as string;
    if (after !== before) {
      writeFileSync(f, after);
      changed++;
      process.stdout.write(`prune-unused: ${f}\n`);
    }
  }
  return changed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("usage: node scripts/prune-unused.ts <file.ts> […]");
  process.stdout.write(`prune-unused: ${pruneUnused(files)} file(s) changed\n`);
}
