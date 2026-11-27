// The same efsim command at another commit's code and at this tree's, and what differs between the two outputs
// (friction round 7: "which bound moved this log" took two at-commit runs and a hand diff per question, four measure
// rounds in one task; round 5's parked point 8, "no harness for same CLI output"). The other commit runs in its own
// worktree under scratch/at/ (scripts/at-commit.ts: its own packages linked), this tree from here.
//
// Usage:
//   node scripts/cli-ab.ts <ref> [--key <regex>] [--all] [--raw] -- <efsim args…>
//   node scripts/cli-ab.ts <ref> --holds <fixture>    zmdlogs holds <fixture> --verbose, keyed by unit, bound and
//                                                     dropped bound: the bounds added and removed, each unit's and
//                                                     each bound's placement before and after, the bounds that pin
//                                                     each unit (holds.ts holdPins) and what each dropped bound
//                                                     conflicted with
//   node scripts/cli-ab.ts <ref> --placement [<fixture id>…] [--operator <name>] [--summary]
//                                                     every development log's placement with its rules (`zmdlogs
//                                                     casts <fixture> --choices`, scripts/placement-lines.ts, one
//                                                     process per side): per log the CAST and HIT lines that
//                                                     differ, paired by a HIT's logged hit and a CAST's start and
//                                                     operator, then counts per log, per rule (this tree's ← the
//                                                     ref's) and per operator; --summary only the counts, --operator
//                                                     only its lines (round 17, the Zhuang Fangyi and Liino report
//                                                     point 2: a placement rule's false positives before a measure)
//   node scripts/cli-ab.ts <ref> --hits-zones <fixture> [--assume <id>=<r>]
//                                                     `zmdlogs hits <fixture> --json` on both sides, paired by hit:
//                                                     for each hit whose verdict class or primary reading moved, its
//                                                     class and reading before and after and the modifiers (by kit
//                                                     buff, else source, and zone) that differ, one line each (round
//                                                     20, the Vesperwings report point 3: a removed press's Yinglung's
//                                                     Edge layer was found by comparing zone products by hand)
//   … --patch <diff>                                  the patch applied on <ref>'s code first (git apply, in its own
//                                                     worktree scratch/at/<hash>-patched, made afresh): a view this
//                                                     tree added, run on the old code too (`git diff <base> --
//                                                     packages/logs/src/views.ts packages/logs/src/holds.ts >
//                                                     scratch/view.diff`), so both sides print what it prints
//
// The other side runs in scratch/at/<hash>/, so an output that prints paths (hits --json's `fixture`, census's rerun
// line) names that root: it is read as this checkout's before comparing (round 14's own report point 2: all 2,353 records
// of `hits --json` differed by their path alone); --raw keeps it.
//
// Lines only at <ref> print as "- ", only here as "+ ". With --key, a line's key is its first match of the regex (its
// first capture group when it has one): lines of the same key on both sides that differ print once as "~ " with the
// text at <ref> and here ("was … / now …"). Identical outputs print one line saying so. --all prints the lines the two
// share too ("  "). It exits 0 either way (1 when a side fails), so a script can read the difference.

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { atCommit, outputInTree, removeAtCommit } from "./at-commit.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** zmdlogs holds --verbose's lines by what they are: the header, a unit by its middle, a kept bound by its tag, a dropped one. */
export const HOLDS_KEY = String.raw`^(zmdlogs-[0-9a-f]+: |  unit [0-9.]+ s|  bound: .+?(?=: P\()|  dropped: .+?(?= \(asks))`;

/** An output of the other side with its worktree's root read as this checkout's (a path it prints compares as this side's). */
export function withRoot(output: string, from: string, to: string): string {
  return from === to ? output : output.split(from).join(to);
}

/** The difference of two outputs as printed (see the file comment): `-`, `+`, `~` lines in this side's order, then the rest of the other's. */
export function outputDiff(was: string, now: string, opts: { readonly key?: RegExp; readonly all?: boolean } = {}): string[] {
  const [a, b] = [was.split("\n"), now.split("\n")];
  const keyOf = (l: string) => {
    if (!opts.key) return null;
    const m = opts.key.exec(l);
    return m ? (m[1] ?? m[0]) : null;
  };
  // Lines as multisets: a repeated line is shared as often as both sides have it.
  const left = new Map<string, number>();
  for (const l of a) left.set(l, (left.get(l) ?? 0) + 1);
  const shared = b.map((l) => {
    const n = left.get(l) ?? 0;
    if (n > 0) left.set(l, n - 1);
    return n > 0;
  });
  // The lines only `was` has, in its order (by index), queued by key for pairing.
  const onlyA: number[] = [];
  for (const [i, l] of a.entries()) {
    const n = left.get(l) ?? 0;
    if (n > 0) {
      left.set(l, n - 1);
      onlyA.push(i);
    }
  }
  const byKey = new Map<string, number[]>();
  for (const i of onlyA) {
    const k = keyOf(a[i] as string);
    if (k !== null) byKey.set(k, [...(byKey.get(k) ?? []), i]);
  }
  const paired = new Set<number>();
  const out: string[] = [];
  for (const [i, l] of b.entries()) {
    if (shared[i]) {
      if (opts.all) out.push(`  ${l}`);
      continue;
    }
    const k = keyOf(l);
    const j = k !== null ? byKey.get(k)?.shift() : undefined;
    if (j === undefined) out.push(`+ ${l}`);
    else {
      paired.add(j);
      out.push(`~ ${(k as string).trim()}`, `    was: ${(a[j] as string).trim()}`, `    now: ${l.trim()}`);
    }
  }
  for (const i of onlyA) if (!paired.has(i)) out.push(`- ${a[i] as string}`);
  return out;
}

/**
 * The key of a placement line (`zmdlogs casts --choices`): a HIT line by its logged hit (time, operator, event, value:
 * the text before " → "), a CAST line by its start and its operator's name (the words before the skill id).
 */
export const PLACEMENT_KEY = String.raw`^(\s*[0-9.]+\s+(?:HIT\s+.*?(?= → )|CAST\s+.+?(?= \S+ \([a-z]+\))))`;

/** A placement output's logs: the lines of each, by the `zmdlogs-<id>: placement` header line each starts with. */
export function placementLogs(text: string): Map<string, string> {
  const out = new Map<string, string[]>();
  let cur: string[] | undefined;
  for (const l of text.split("\n")) {
    const m = /^(zmdlogs-[0-9a-f]+): placement/.exec(l);
    if (m) out.set(m[1] as string, (cur = [l]));
    else cur?.push(l);
  }
  return new Map([...out].map(([k, ls]) => [k, ls.join("\n").replace(/\n+$/, "")]));
}

/** One record of scripts/placement-lines.ts's JSON output (packages/logs views.ts CastsRecord, its `log`; HEADER: the view's header). */
interface PlacementRecord {
  readonly log: string;
  readonly kind: string;
  readonly t?: number;
  readonly name?: string;
  readonly skill?: string;
  readonly castKind?: string | null;
  readonly key?: string;
  readonly rule?: string;
  readonly value?: number;
  readonly cast?: { readonly skill: string; readonly start: number; readonly index: number; readonly frame?: number; readonly sameAs?: boolean };
  readonly text: string;
}

/** The fields of a `zmdlogs hits --json` record --hits-zones reads. */
interface HitZonesRecord {
  readonly t: number;
  readonly operator: string;
  readonly event: string;
  readonly value: number;
  readonly class: string;
  readonly predicted: number | null;
  readonly landing?: { readonly modifiers: readonly { readonly source: string; readonly zone: string; readonly value: number; readonly kitBuff?: string }[] };
}

/**
 * cli-ab --hits-zones: two `zmdlogs hits --json` outputs paired by hit (time, operator, event, value; repeats in
 * order), and for each hit whose class or primary reading moved, a line with both and a line per modifier that differs
 * (keyed by its kit buff, else its source, and its zone: "- was", "+ now", "~ was → now").
 */
export function hitsZonesDiff(was: string, now: string): string[] {
  const parse = (s: string) => s.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as HitZonesRecord);
  const keyed = (rs: readonly HitZonesRecord[]) => {
    const seen = new Map<string, number>();
    return new Map(rs.map((r) => {
      const k = `${r.t}|${r.operator}|${r.event}|${r.value}`;
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      return [`${k}|${n}`, r] as const;
    }));
  };
  const [a, b] = [keyed(parse(was)), keyed(parse(now))];
  const mods = (r: HitZonesRecord | undefined) => {
    const m = new Map<string, number>();
    for (const x of r?.landing?.modifiers ?? []) {
      const k = `${x.kitBuff ?? x.source} ${x.zone}`;
      m.set(k, (m.get(k) ?? 0) + x.value);
    }
    return m;
  };
  const r4 = (x: number) => Number(x.toFixed(4));
  const out: string[] = [];
  let moved = 0;
  for (const [k, after] of b) {
    const before = a.get(k);
    if (before && before.class === after.class && before.predicted === after.predicted) continue;
    moved++;
    out.push(`${(after.t / 1000).toFixed(2).padStart(7)}  ${after.operator} ${after.event} ${after.value}: ${before ? `${before.class} ${before.predicted ?? "-"}` : "(not at the ref)"} → ${after.class} ${after.predicted ?? "-"}`);
    const [x, y] = [mods(before), mods(after)];
    for (const key of [...new Set([...x.keys(), ...y.keys()])].sort()) {
      const [p, q] = [x.get(key), y.get(key)];
      if (p !== undefined && q !== undefined && r4(p) === r4(q)) continue;
      out.push(p === undefined ? `    + ${key} ${r4(q as number)}` : q === undefined ? `    - ${key} ${r4(p)}` : `    ~ ${key} ${r4(p)} → ${r4(q)}`);
    }
  }
  return [moved ? `${moved} hit(s) whose class or primary reading moved, with the modifiers that differ (by kit buff, else source, and zone):` : "no hit's class or primary reading moved", ...out];
}

const short = (id: string) => id.replace(/^chr_\d+_[a-z]+_/, "");
const timeText = (ms: number) => (ms / 1000).toFixed(2).padStart(7);

/** A placement-lines output's records, or null where it is the view's text (a commit before castsRecords). */
function parseRecords(output: string): PlacementRecord[] | null {
  const lines = output.split("\n").filter((l) => l.trim());
  if (!lines.length || !lines[0]?.startsWith("{")) return null;
  return lines.map((l) => JSON.parse(l) as PlacementRecord);
}

/**
 * Records as the text placementDiff pairs (round 18, round 17's own report point 2): a CAST and a HIT line each built
 * from the record's fields, never from the view's wording, so a new note on a line (a HIT's [joined: …]) or a changed
 * word moves nothing; `display` maps each built line back to the view's own text for printing.
 */
export function recordsAsLines(records: readonly PlacementRecord[]): { readonly text: string; readonly display: ReadonlyMap<string, string> } {
  const out: string[] = [];
  const display = new Map<string, string>();
  for (const r of records) {
    if (r.kind === "HEADER") {
      out.push(`${r.log}: placement`);
      continue;
    }
    if (r.t === undefined) continue;
    let line: string | undefined;
    if (r.kind === "CAST") line = `${timeText(r.t)}  CAST   ${r.name} ${short(r.skill ?? "")} (${r.castKind ?? "none"}) key ${short(r.key ?? "")}  [${r.rule ?? "-"}]`;
    else if (r.kind === "HIT") {
      const c = r.cast;
      line = `${timeText(r.t)}  HIT    ${r.name} ${short(r.skill ?? "")} ${r.value} → ${c ? `${short(c.skill)}@${(c.start / 1000).toFixed(2)} #${c.index}${c.frame !== undefined ? ` frame ${c.frame}` : ""}${c.sameAs ? " (same landing)" : ""}` : "unplaced"}`;
    }
    if (line === undefined) continue;
    out.push(line);
    display.set(line, `${timeText(r.t)}  ${r.text}`);
  }
  return { text: out.join("\n"), display };
}

/**
 * Records as the view prints them (header, then each line with its time): the text pairing's input when the other side
 * is text. A HIT's [joined: …] note (round 18) is left out, as the older side's view has none.
 */
export function recordsAsView(records: readonly PlacementRecord[]): string {
  return records.map((r) => (r.kind === "HEADER" ? r.text : `${timeText(r.t ?? 0)}  ${r.kind === "HIT" ? r.text.replace(/ {2}\[joined: [^\]]*\]$/, "") : r.text}`)).join("\n");
}

/**
 * placementDiff over two placement-lines outputs: by the records' fields where both are records (the built lines,
 * printed as the view's text), else by the text (a side before castsRecords: the records side as the view prints it).
 */
export function placementOutputsDiff(was: string, now: string, opts: { readonly summary?: boolean; readonly operator?: string } = {}): string[] {
  const [a, b] = [parseRecords(was), parseRecords(now)];
  if (!a || !b) return placementDiff(a ? recordsAsView(a) : was, b ? recordsAsView(b) : now, opts);
  const [x, y] = [recordsAsLines(a), recordsAsLines(b)];
  // A diff line's text as the view has it: `~` / `+` / `now:` from this tree's records, `-` / `was:` from the ref's.
  return placementDiff(x.text, y.text, opts).map((l) => {
    const m = /^(~ |\+ |- | {4}was: | {4}now: )(.*)$/.exec(l);
    if (!m) return l;
    const [prefix, rest] = [m[1] as string, m[2] as string];
    const map = prefix === "- " || prefix.trim() === "was:" ? x.display : y.display;
    const shown = map.get(rest) ?? map.get(`   ${rest.trimStart()}`) ?? [...map].find(([k]) => k.trim() === rest.trim())?.[1];
    return shown !== undefined ? `${prefix}${prefix === "~ " ? shown.trim() : shown}` : l;
  });
}

/** A CAST line's rule ("anchor", "window", …: the bracket logcasts.ts choose writes), operator and skill. */
function castFacts(line: string): { readonly rule: string; readonly operator: string; readonly skill: string } | null {
  const m = /^\s*[0-9.]+\s+CAST\s+(.+?) (\S+) \([a-z]+\).*?(?:\[(\w+)[:\]]|$)/.exec(line);
  return m ? { operator: (m[1] as string).trim(), skill: m[2] as string, rule: m[3] ?? "-" } : null;
}

/** A HIT line's operator (the words before its event id). */
const hitOperator = (line: string) => /^\s*[0-9.]+\s+HIT\s+(.+?) \S+ \d+ → /.exec(line)?.[1]?.trim() ?? "?";

/**
 * cli-ab --placement's report: per log the placement lines that differ (outputDiff by PLACEMENT_KEY), then the counts
 * per log, per rule of a CAST that differs (this tree's ← the ref's, "new"/"gone" for an unpaired one) and per operator.
 */
export function placementDiff(was: string, now: string, opts: { readonly summary?: boolean; readonly operator?: string } = {}): string[] {
  const [a, b] = [placementLogs(was), placementLogs(now)];
  const key = new RegExp(PLACEMENT_KEY);
  const perLog: string[] = [];
  const detail: string[] = [];
  const rules = new Map<string, number>();
  const ops = new Map<string, { casts: number; hits: number }>();
  const op = (name: string) => ops.get(name) ?? (ops.set(name, { casts: 0, hits: 0 }).get(name) as { casts: number; hits: number });
  for (const [id, text] of b) {
    const before = a.get(id);
    if (before === undefined) {
      perLog.push(`  ${id.slice(8, 12)}  only in this tree`);
      continue;
    }
    if (before === text) continue;
    let lines = outputDiff(before, text, { key });
    // Only CAST and HIT lines (a `~` keeps its was / now lines), of the operator if one is named.
    const groups: string[][] = [];
    for (const l of lines) if (/^ {4}(was|now): /.test(l)) groups.at(-1)?.push(l);
    else groups.push([l]);
    // Not a log's header line (its wording names CAST and HIT lines too: round 18's header changed so).
    const kept = groups.filter((g) => !/^[-+~] zmdlogs-[0-9a-f]+: placement/.test(g[0] ?? "") && /\b(CAST|HIT)\b/.test(g.join(" ")) && (!opts.operator || g.join(" ").includes(` ${opts.operator} `)));
    if (!kept.length) continue;
    lines = kept.flat();
    let hits = 0;
    const casts: { was: ReturnType<typeof castFacts>; now: ReturnType<typeof castFacts> }[] = [];
    for (const g of kept) {
      if (/\bCAST\b/.test(g[0] as string)) {
        const was = g.find((l) => /^ {4}was: |^- /.test(l));
        const now = g.find((l) => /^ {4}now: |^\+ /.test(l));
        casts.push({ was: was ? castFacts(was.replace(/^ {4}was: |^- /, "   ")) : null, now: now ? castFacts(now.replace(/^ {4}now: |^\+ /, "   ")) : null });
      } else {
        hits++;
        const l = (g.find((x) => /^ {4}now: |^\+ /.test(x)) ?? g.find((x) => /^ {4}was: |^- /.test(x)) ?? "").replace(/^ {4}(was|now): |^[-+] /, "   ");
        op(hitOperator(l)).hits++;
      }
    }
    // A cast gone at one start and new at another, of one operator and skill: one cast moved.
    const paired: typeof casts = [];
    for (const c of casts) {
      const twin = c.now && !c.was ? paired.find((p) => p.was && !p.now && p.was.operator === c.now?.operator && p.was.skill === c.now?.skill) : c.was && !c.now ? paired.find((p) => p.now && !p.was && p.now.operator === c.was?.operator && p.now.skill === c.was?.skill) : undefined;
      if (twin) {
        twin.was ??= c.was;
        twin.now ??= c.now;
      } else paired.push({ ...c });
    }
    for (const c of paired) {
      const k = `${c.now?.rule ?? "gone"} ← ${c.was?.rule ?? "new"}${c.now && c.was && c.now.skill === c.was.skill ? " (same skill)" : ""}`;
      rules.set(k, (rules.get(k) ?? 0) + 1);
      op((c.now ?? c.was)?.operator ?? "?").casts++;
    }
    perLog.push(`  ${id.slice(8, 12)}  ${paired.length} cast(s), ${hits} HIT line(s) differ`);
    detail.push(`${id}:`, ...lines);
  }
  for (const id of a.keys()) if (!b.has(id)) perLog.push(`  ${id.slice(8, 12)}  only at the ref`);
  if (!perLog.length) return [`the placement of every log (${b.size}) is the same`];
  const sorted = (m: Map<string, number>) => [...m].sort((x, y) => y[1] - x[1]);
  return [
    `Logs whose placement differs (${perLog.length} of ${b.size}):`,
    ...perLog,
    "By rule (a cast that differs, paired by its start or as one operator's same skill gone at one start and new at another: this tree's rule ← the ref's; new / gone: on one side only; `-`: no rule, the key names one skill):",
    ...sorted(rules).map(([k, n]) => `  ${String(n).padStart(4)}  ${k}`),
    "By operator (casts and HIT lines that differ):",
    ...[...ops].sort((x, y) => y[1].casts + y[1].hits - (x[1].casts + x[1].hits)).map(([name, c]) => `  ${name.padEnd(16)} ${String(c.casts).padStart(4)} casts ${String(c.hits).padStart(5)} hits`),
    ...(opts.summary ? [] : ["", ...detail]),
  ];
}

function main(argv: string[]): number {
  const dash = argv.indexOf("--");
  const own = dash >= 0 ? argv.slice(0, dash) : argv;
  let efsim = dash >= 0 ? argv.slice(dash + 1) : [];
  const ref = own[0];
  const opt = (name: string) => {
    const i = own.indexOf(name);
    return i >= 0 ? own[i + 1] : undefined;
  };
  let key = opt("--key");
  const holds = opt("--holds");
  if (holds !== undefined) {
    efsim = ["zmdlogs", "holds", holds, "--verbose"];
    key ??= HOLDS_KEY;
  }
  const placement = own.includes("--placement");
  const hitsZones = opt("--hits-zones");
  if (hitsZones !== undefined) {
    const assume = opt("--assume");
    efsim = ["zmdlogs", "hits", hitsZones, "--json", ...(assume !== undefined ? ["--assume", assume] : [])];
  }
  if (!ref || ref.startsWith("--") || (efsim.length === 0 && !placement)) {
    process.stderr.write("usage: node scripts/cli-ab.ts <ref> [--key <regex>] [--all] [--raw] [--patch <diff>] -- <efsim args…> | <ref> [--patch <diff>] --holds <fixture> | <ref> --placement [<fixture id>…] [--operator <name>] [--summary] | <ref> [--patch <diff>] --hits-zones <fixture> [--assume <id>=<r>]\n");
    return 2;
  }
  const short = spawnSync("git", ["rev-parse", "--short=9", "--verify", `${ref}^{commit}`], { cwd: ROOT, encoding: "utf8" });
  if (short.status !== 0) throw new Error(`cli-ab: no commit ${ref}`);
  const patch = opt("--patch");
  const tree = join(ROOT, "scratch", "at", `${short.stdout.trim()}${patch !== undefined ? "-patched" : ""}`);
  // A patched tree is made afresh: the patch may have changed since the last run.
  if (patch !== undefined && existsSync(join(tree, ".git"))) removeAtCommit(tree);
  atCommit(ref, tree, patch);
  if (placement) {
    // The fixture ids: own's positionals after the ref, not an option's value.
    const valued = new Set(["--patch", "--operator", "--key"]);
    const ids = own.slice(1).filter((x, i, all) => !x.startsWith("--") && !valued.has(all[i - 1] ?? ""));
    const script = join(ROOT, "scripts", "placement-lines.ts");
    const now = spawnSync(process.execPath, [script, ...ids], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 << 20 });
    if (now.status !== 0) throw new Error(`cli-ab: placement-lines failed in this tree: ${(now.stderr || now.stdout).trim().split("\n").slice(-5).join("\n")}`);
    const was = outputInTree(tree, script, ids);
    const fields = parseRecords(was) !== null && parseRecords(now.stdout) !== null;
    process.stdout.write(`cli-ab --placement: zmdlogs casts --choices for ${ids.length ? ids.join(", ") : "every development log"}: ${ref} (${short.stdout.trim()}, -) against this tree (+), lines paired by a HIT's logged hit and a CAST's start and operator (~)${fields ? ", compared by their records' fields (a cast's skill, kind, key and rule; a hit's cast and slot)" : ", compared by their text (a side's code is older than castsRecords)"}\n`);
    const operator = opt("--operator");
    for (const l of placementOutputsDiff(was, now.stdout, { summary: own.includes("--summary"), ...(operator !== undefined ? { operator } : {}) })) process.stdout.write(l + "\n");
    return 0;
  }
  const run = (root: string) => {
    const r = spawnSync(process.execPath, [join(root, "packages/cli/src/main.ts"), ...efsim], { cwd: root, encoding: "utf8", maxBuffer: 256 << 20 });
    if (r.status !== 0) throw new Error(`cli-ab: efsim ${efsim.join(" ")} failed at ${root === ROOT ? "this tree" : ref}: ${(r.stderr || r.stdout).trim().split("\n").slice(-5).join("\n")}`);
    return r.stdout.replace(/\n$/, "");
  };
  const [was, now] = [own.includes("--raw") ? run(tree) : withRoot(run(tree), tree, ROOT), run(ROOT)];
  const say = (l: string) => process.stdout.write(l + "\n");
  if (hitsZones !== undefined) {
    say(`cli-ab --hits-zones: efsim ${efsim.join(" ")}: ${ref} (${short.stdout.trim()}${patch !== undefined ? ` with ${patch}` : ""}) against this tree`);
    for (const l of hitsZonesDiff(was, now)) say(l);
    return 0;
  }
  say(`cli-ab: efsim ${efsim.join(" ")}: ${ref} (${short.stdout.trim()}${patch !== undefined ? ` with ${patch}` : ""}, -) against this tree (+)${key ? `, lines paired by /${key}/ (~)` : ""}`);
  if (was === now) {
    say("the outputs are identical");
    return 0;
  }
  for (const l of outputDiff(was, now, { ...(key ? { key: new RegExp(key) } : {}), all: own.includes("--all") })) say(l);
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
