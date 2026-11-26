// `efsim zmdlogs assumed --operator <op> [fixture…|--all]`: what an operator's non-plain matches assume, from the hit
// records' verdict assumptions (HitRecord.assumptions, the verdict's first fitting reading): by kind (a hit counted once
// per kind), by kind set, by event and kind, and by label with its numbers folded; `--kind <set>` lists the hits of one
// kind set (`crit`, `boundary+logListing`). The low-plain-low-mismatch round (2026-11-26) wrote it as a probe
// (scripts/probes/assumed/kinds.ts, ten minutes to write, two to run per operator); round 15 made it a view on the
// cached records, the first step of any "low plain" lead.

import type { HitRecord } from "./hitexport.ts";

/** A label with its numbers folded (`Link (3)` → `Link (n)`, a long id's digits → N), so one kind of reason is one row. */
export function foldLabel(label: string): string {
  return label.replace(/\(\d+\)/g, "(n)").replace(/\d{3,}/g, "N").replace(/×\d+(\.\d+)?/g, "×n");
}

/** The kind set of a record's assumptions (sorted, joined by +), or null for a hit that isn't a non-plain match. */
export function kindSet(r: Pick<HitRecord, "class" | "assumptions">): string | null {
  if (r.class !== "assumed" && r.class !== "fallback") return null;
  return [...new Set((r.assumptions ?? []).map((a) => a.kind))].sort().join("+");
}

const shortEvent = (e: string) => e.replace(/^chr_\d+_[a-z0-9]+_/, "");

/** The view: per log, then the four tables; `kind` lists the hits of that kind set. */
export function assumedView(records: readonly HitRecord[], operator: string, opts: { readonly kind?: string; readonly fixtureLabel?: (fixture: string) => string; readonly top?: number } = {}): string {
  const label = opts.fixtureLabel ?? ((f: string) => f);
  const top = opts.top ?? 40;
  const mine = records.filter((r) => r.operator === operator);
  const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const [byKind, bySet, byEventKind, byLabel] = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const perLog = new Map<string, { hits: number; plain: number; other: number }>();
  const listed: string[] = [];
  for (const r of mine) {
    const log = perLog.get(r.fixture) ?? { hits: 0, plain: 0, other: 0 };
    perLog.set(r.fixture, log);
    log.hits++;
    if (r.class === "plain") log.plain++;
    const set = kindSet(r);
    if (set === null) continue;
    log.other++;
    const kinds = set.split("+").filter(Boolean);
    for (const k of kinds) count(byKind, k);
    count(bySet, set || "(none)");
    for (const k of kinds) count(byEventKind, `${shortEvent(r.event)}  ${k}`);
    for (const a of r.assumptions ?? []) count(byLabel, foldLabel(a.label));
    if (opts.kind !== undefined && set === opts.kind) listed.push(`  ${label(r.fixture)} ${(r.t / 1000).toFixed(2)} s ${shortEvent(r.event)} logged ${r.value}${r.crit === null ? "" : r.crit ? " crit" : " no crit"} reading ${r.verdictReading ?? "-"} | ${(r.assumptions ?? []).map((a) => a.label).join(" ; ")}`);
  }
  const table = (title: string, m: Map<string, number>, n = top) => ["", title, ...[...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k, c]) => `${String(c).padStart(6)}  ${k}`), ...(m.size > n ? [`  … ${m.size - n} more`] : [])];
  const totals = [...perLog.values()].reduce((a, x) => ({ hits: a.hits + x.hits, plain: a.plain + x.plain, other: a.other + x.other }), { hits: 0, plain: 0, other: 0 });
  return [
    `${operator}: ${totals.hits} hits in ${perLog.size} logs, ${totals.plain} plain, ${totals.other} matched under an assumption or the log-listing fallback (the verdict's first fitting reading's assumptions: HitRecord.assumptions)`,
    ...[...perLog].map(([f, x]) => `  ${label(f)}  ${String(x.hits).padStart(5)} hits  ${String(x.plain).padStart(5)} plain  ${String(x.other).padStart(5)} other matches`),
    ...table("By kind (a hit counted once per kind):", byKind),
    ...table("By kind set (--kind <set> lists its hits):", bySet),
    ...table("By event and kind:", byEventKind),
    ...table("By label (numbers folded):", byLabel),
    ...(opts.kind !== undefined ? ["", `The hits of kind set ${opts.kind || "(none)"} (${listed.length}):`, ...listed] : []),
  ].join("\n");
}
