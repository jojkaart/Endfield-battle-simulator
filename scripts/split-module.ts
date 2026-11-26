// Splits a TypeScript module by top-level statement into several (a move only; round 14's own report point 1: the
// buffreplay.ts split took about forty minutes of scratch tooling, the move itself one run). Each new file gets the
// original's import block, imports of the sibling names it references (types as `import type`), and its statements in
// their original order; a name another file reads gets `export`. The original keeps the rest and imports what it reads
// from the new files. Then every importer of the original in packages/, scripts/ and tests/ imports each name from
// where it went (an `export * from` of the original in an index gains one of each new file), unused imports are pruned
// (imports only: scripts/prune-unused.ts), the files' statements are checked against the original's by AST (the same
// multiset, `export` aside), and the prose citations "<file>.ts <name>" of a moved name in the docs (history aside) and
// the sources follow it (scripts/check-links.ts staleCitations checks the rest).
//
// Usage: node scripts/split-module.ts <file.ts> --to <new.ts>=<name>,<name>… [--to …] [--dry-run]
//   <new.ts> is a file name beside <file.ts>; each name a top-level declaration of it (a function, const, type,
//   interface, class or enum). --dry-run prints the plan (each file's names, the references across files, the exports
//   added, the importers rewritten) and writes nothing. Give each new file its header comment afterwards (a
//   placeholder line says where), then `npx tsc --noEmit`, `npm run lint:changed` and `npm run measure -- --base HEAD`
//   (CLAUDE.md "Code layout": a split is a move, checked by a measure that moves no log).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { pruneUnused } from "./prune-unused.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A top-level statement's declared names (a variable statement may declare several). */
function namesOf(s: ts.Statement): string[] {
  if (ts.isVariableStatement(s)) return s.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []));
  const n = (s as { name?: ts.Node }).name;
  return n && ts.isIdentifier(n) ? [n.text] : [];
}

const exported = (s: ts.Statement) => ts.canHaveModifiers(s) && (ts.getModifiers(s) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
const typeOnly = (s: ts.Statement) => ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s);

/** The plan of a split (splitPlan): per file, its statements' texts, the names it imports from its siblings, the exports added. */
export interface SplitPlan {
  readonly files: ReadonlyMap<string, { readonly names: readonly string[]; readonly imports: ReadonlyMap<string, readonly string[]> }>;
  readonly exportsAdded: readonly string[];
  readonly texts: ReadonlyMap<string, string>;
  /** Name → file it is declared in after the split; whether it is a type only. */
  readonly home: ReadonlyMap<string, string>;
  readonly isType: ReadonlyMap<string, boolean>;
}

/**
 * The split of `source` (its text, its file name) into `targets` (new file name → names): every new file's text and
 * the original's, as the file comment says. Throws on a name the source doesn't declare at its top level.
 */
export function splitPlan(sourceName: string, source: string, targets: Readonly<Record<string, readonly string[]>>): SplitPlan {
  const sf = ts.createSourceFile(sourceName, source, ts.ScriptTarget.Latest, true);
  const imports = sf.statements.filter(ts.isImportDeclaration);
  const stmts = sf.statements.filter((s) => !ts.isImportDeclaration(s));
  const importText = imports.length ? source.slice((imports[0] as ts.Statement).getStart(), (imports.at(-1) as ts.Statement).getEnd()) : "";
  const head = imports.length ? source.slice(0, (imports[0] as ts.Statement).getStart()).trimEnd() : "";
  const wanted = new Map<string, string>();
  for (const [f, ns] of Object.entries(targets)) for (const n of ns) wanted.set(n, f);
  const home = new Map<string, string>();
  const isType = new Map<string, boolean>();
  for (const s of stmts) for (const n of namesOf(s)) {
    home.set(n, wanted.get(n) ?? sourceName);
    isType.set(n, typeOnly(s));
  }
  for (const n of wanted.keys()) if (!home.has(n)) throw new Error(`split-module: ${sourceName} declares no top-level ${n}`);
  // A variable statement's names must go together.
  for (const s of stmts) {
    const files = new Set(namesOf(s).map((n) => home.get(n)));
    if (files.size > 1) throw new Error(`split-module: ${namesOf(s).join(", ")} are one statement: name them all for one file`);
  }
  const fileOfStmt = (s: ts.Statement) => home.get(namesOf(s)[0] ?? "") ?? sourceName;
  const refs = new Map<ts.Statement, Set<string>>();
  const needExport = new Set<string>();
  for (const s of stmts) {
    const own = new Set(namesOf(s));
    const r = new Set<string>();
    const visit = (n: ts.Node) => {
      if (ts.isIdentifier(n) && home.has(n.text) && !own.has(n.text)) {
        // Not a property name (x.name, { name: … }): those aren't references to the declaration.
        const p = n.parent;
        const isProp = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isPropertySignature(p) && p.name === n) || (ts.isPropertyDeclaration(p) && p.name === n) || (ts.isMethodDeclaration(p) && p.name === n);
        if (!isProp) r.add(n.text);
      }
      ts.forEachChild(n, visit);
    };
    ts.forEachChild(s, visit);
    refs.set(s, r);
    for (const x of r) if (home.get(x) !== fileOfStmt(s)) needExport.add(x);
  }
  const files = [...Object.keys(targets), sourceName];
  const body = new Map(files.map((f) => [f, [] as string[]]));
  const sibling = new Map(files.map((f) => [f, new Map<string, Set<string>>()]));
  const exportsAdded: string[] = [];
  for (const s of stmts) {
    const f = fileOfStmt(s);
    let piece = source.slice(s.getFullStart(), s.getEnd());
    if (!exported(s) && namesOf(s).some((n) => needExport.has(n))) {
      const at = s.getStart() - s.getFullStart();
      piece = `${piece.slice(0, at)}export ${piece.slice(at)}`;
      exportsAdded.push(...namesOf(s));
    }
    body.get(f)?.push(piece);
    for (const x of refs.get(s) ?? []) {
      const g = home.get(x) as string;
      if (g === f) continue;
      const m = sibling.get(f) as Map<string, Set<string>>;
      m.set(g, (m.get(g) ?? new Set()).add(x));
    }
  }
  const importLines = (f: string) =>
    [...(sibling.get(f) as Map<string, Set<string>>)].sort((a, b) => a[0].localeCompare(b[0])).map(([g, set]) => {
      const ns = [...set].sort();
      return ns.every((n) => isType.get(n)) ? `import type { ${ns.join(", ")} } from "./${g}";` : `import { ${ns.map((n) => (isType.get(n) ? `type ${n}` : n)).join(", ")} } from "./${g}";`;
    });
  const texts = new Map<string, string>();
  for (const f of files) {
    const own = importLines(f);
    const top = f === sourceName ? head : `// ${f}: split from ${sourceName} (split-module.ts). Say here what the module holds.`;
    const block = [importText, ...own].filter(Boolean).join("\n");
    texts.set(f, `${top ? `${top}\n\n` : ""}${block ? `${block}\n\n` : ""}${(body.get(f) as string[]).join("").replace(/^\n+/, "")}\n`);
  }
  const planFiles = new Map(files.map((f) => [f, { names: [...home].filter(([, g]) => g === f).map(([n]) => n), imports: new Map([...(sibling.get(f) as Map<string, Set<string>>)].map(([g, s]) => [g, [...s].sort()])) }]));
  return { files: planFiles, exportsAdded, texts, home, isType };
}

/** The top-level statements of some texts, `export` stripped, as a sorted list (the AST check of a move). */
export function statementTexts(texts: Iterable<readonly [string, string]>): string[] {
  const out: string[] = [];
  for (const [name, text] of texts) {
    const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    for (const s of sf.statements) if (!ts.isImportDeclaration(s)) out.push(s.getText().replace(/^export /, ""));
  }
  return out.sort();
}

/**
 * An importer's text with its imports of `from` (a relative specifier naming that file) split by where each name
 * went (`home`), and an `export * from` of it followed by one of each new file; unchanged when it imports none.
 */
export function rewriteImporter(importerPath: string, text: string, sourcePath: string, home: ReadonlyMap<string, string>, newFiles: readonly string[]): string {
  const sf = ts.createSourceFile(importerPath, text, ts.ScriptTarget.Latest, true);
  const dir = dirname(sourcePath);
  const spec = (f: string) => {
    const r = relative(dirname(importerPath), join(dir, f)).replace(/\\/g, "/");
    return r.startsWith(".") ? r : `./${r}`;
  };
  const edits: { start: number; end: number; text: string }[] = [];
  for (const d of sf.statements) {
    const isImport = ts.isImportDeclaration(d);
    const isExportFrom = ts.isExportDeclaration(d) && d.moduleSpecifier !== undefined;
    if (!isImport && !isExportFrom) continue;
    const m = (d as ts.ImportDeclaration | ts.ExportDeclaration).moduleSpecifier as ts.StringLiteral;
    if (!m.text.startsWith(".") || resolve(dirname(importerPath), m.text) !== resolve(sourcePath)) continue;
    if (isExportFrom && !(d as ts.ExportDeclaration).exportClause) {
      // export * from the original: one of each new file after it.
      edits.push({ start: d.getEnd(), end: d.getEnd(), text: newFiles.map((f) => `\nexport * from "${spec(f)}";`).join("") });
      continue;
    }
    const elements = isImport ? ((d as ts.ImportDeclaration).importClause?.namedBindings as ts.NamedImports | undefined)?.elements : ((d as ts.ExportDeclaration).exportClause as ts.NamedExports).elements;
    if (!elements) continue;
    const whole = isImport ? (d as ts.ImportDeclaration).importClause?.isTypeOnly === true : (d as ts.ExportDeclaration).isTypeOnly;
    const byFile = new Map<string, string[]>();
    for (const e of elements) {
      const name = (e.propertyName ?? e.name).text;
      const g = home.get(name) ?? basename(sourcePath);
      byFile.set(g, [...(byFile.get(g) ?? []), `${whole || e.isTypeOnly ? "type " : ""}${e.getText().replace(/^type\s+/, "")}`]);
    }
    if (byFile.size === 1 && byFile.has(basename(sourcePath))) continue;
    const kw = isImport ? "import" : "export";
    const lines = [...byFile].sort((a, b) => a[0].localeCompare(b[0])).map(([g, ns]) => {
      const allTypes = ns.every((n) => n.startsWith("type "));
      return allTypes ? `${kw} type { ${ns.map((n) => n.slice(5)).join(", ")} } from "${spec(g)}";` : `${kw} { ${ns.join(", ")} } from "${spec(g)}";`;
    });
    edits.push({ start: d.getStart(), end: d.getEnd(), text: lines.join("\n") });
  }
  let out = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** Prose citations "<source>.ts <name>" (the name in backticks too) of a moved name, rewritten to its new file. */
export function rewriteCitations(text: string, sourceFile: string, home: ReadonlyMap<string, string>): string {
  const esc = sourceFile.replace(/[.]/g, "\\.");
  return text.replace(new RegExp(`\\b${esc} (\`?)([A-Za-z_$][\\w$]*)`, "g"), (whole, tick: string, name: string) => {
    const g = home.get(name);
    return g && g !== sourceFile ? `${g} ${tick}${name}` : whole;
  });
}

function trackedFiles(pattern: string): string[] {
  return spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", pattern], { cwd: ROOT, encoding: "utf8" }).stdout.split("\n").filter((f) => f && !/^(data|reference|node_modules|scratch|\.claude|fixtures)\//.test(f) && existsSync(join(ROOT, f)));
}

function main(argv: readonly string[]): number {
  const source = argv[0];
  if (!source || source.startsWith("--")) throw new Error("usage: node scripts/split-module.ts <file.ts> --to <new.ts>=<name>,<name>… [--to …] [--dry-run]");
  const dry = argv.includes("--dry-run");
  const targets: Record<string, string[]> = {};
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] !== "--to") continue;
    const [f, list] = (argv[i + 1] ?? "").split("=");
    if (!f || !list || f.includes("/")) throw new Error(`split-module: --to takes <new.ts>=<name>,… with a file name beside ${source} (got ${argv[i + 1]})`);
    targets[f] = list.split(",").filter(Boolean);
  }
  if (!Object.keys(targets).length) throw new Error("split-module: no --to <new.ts>=<names>");
  const sourcePath = resolve(ROOT, source);
  const dir = dirname(sourcePath);
  const sourceFile = basename(sourcePath);
  for (const f of Object.keys(targets)) if (existsSync(join(dir, f))) throw new Error(`split-module: ${join(dir, f)} exists`);
  const original = readFileSync(sourcePath, "utf8");
  const plan = splitPlan(sourceFile, original, targets);
  const say = (l: string) => process.stdout.write(`${l}\n`);
  for (const [f, p] of plan.files) say(`${f}: ${p.names.length} name(s)${p.imports.size ? `; imports ${[...p.imports].map(([g, ns]) => `${ns.join(", ")} from ${g}`).join("; ")}` : ""}`);
  say(`exports added: ${plan.exportsAdded.join(", ") || "none"}`);
  // Two files reading each other: a cycle the loader takes (functions), but a top-level read of the other's const wouldn't.
  for (const [f, p] of plan.files) for (const g of p.imports.keys()) if (f < g && plan.files.get(g)?.imports.has(f)) say(`warning: ${f} and ${g} import each other (${p.imports.get(g)?.join(", ")} / ${plan.files.get(g)?.imports.get(f)?.join(", ")}): move the shared names to one side unless only functions read them`);
  // The importers.
  const importers = trackedFiles("*.ts").filter((f) => /^(packages|scripts|tests)\//.test(f) && resolve(ROOT, f) !== sourcePath);
  const rewritten = new Map<string, string>();
  for (const f of importers) {
    const p = resolve(ROOT, f);
    const text = readFileSync(p, "utf8");
    const out = rewriteImporter(p, text, sourcePath, plan.home, Object.keys(targets));
    if (out !== text) rewritten.set(p, out);
  }
  say(`importers rewritten: ${[...rewritten.keys()].map((p) => relative(ROOT, p)).join(", ") || "none"}`);
  if (dry) return 0;
  const written = [...plan.texts].map(([f, t]) => [join(dir, f), t] as const);
  for (const [p, t] of [...written, ...rewritten]) writeFileSync(p, t);
  pruneUnused([...written.map(([p]) => p), ...rewritten.keys()], { importsOnly: true });
  // The AST check: the files hold the original's statements, no more, no fewer.
  const was = statementTexts([[sourceFile, original]]);
  const now = statementTexts(written.map(([p]) => [basename(p), readFileSync(p, "utf8")] as const));
  const missing = was.filter((s, i) => now[i] !== s);
  if (was.length !== now.length || missing.length) {
    say(`split-module: the statements differ from the original's (${was.length} before, ${now.length} after): check the diff`);
    return 1;
  }
  say(`split-module: the ${was.length} top-level statements are the original's (export aside)`);
  // The citations.
  let cited = 0;
  for (const f of [...trackedFiles("*.md").filter((x) => !/^docs\/(journal\/|journal\.md$|friction\/|friction-done\/|tried\/|analysis\/|kit-batches\/)/.test(x)), ...importers, ...written.map(([p]) => relative(ROOT, p))]) {
    const p = resolve(ROOT, f);
    const text = readFileSync(p, "utf8");
    const out = rewriteCitations(text, sourceFile, plan.home);
    if (out !== text) {
      writeFileSync(p, out);
      cited++;
    }
  }
  say(`split-module: citations of moved names rewritten in ${cited} file(s); now npx tsc --noEmit, npm run lint:changed, node scripts/check-links.ts, and a measure --base HEAD that moves no log`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  }
}
