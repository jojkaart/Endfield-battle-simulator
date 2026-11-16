// The raw ZMDLogs battle details, cached on disk (git-ignored: node_modules/.cache/efsim/zmdlogs/, with the game-data
// cache), so mechanism questions a fixture can't answer (buffs without a damage zone, what started a hit's Stagger) are
// answered from disk: `efsim zmdlogs raw`. A detail holds player data: it stays in the cache, never in the repository
// or a report. Hold-out logs are refused.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cacheDir } from "@efsim/data";
import { fetchDetail } from "./zmdlogs.ts";
import { readDevFixture, refreshFixture, refuseHoldout, type RefreshResult } from "./logs.ts";

export function rawDir(): string {
  return join(cacheDir(), "zmdlogs");
}

function rawPath(battleId: string): string {
  if (!/^btl_[a-z0-9_]+$/.test(battleId)) throw new Error(`not a battle ID: ${battleId}`);
  return join(rawDir(), `${battleId}.json`);
}

/** Keeps a downloaded detail in the cache (importBattle, refreshFixture). A hold-out's is refused. */
export function cacheRawDetail(battleId: string, detail: unknown): void {
  refuseHoldout(battleId.replace(/^btl_upload_/, ""));
  mkdirSync(rawDir(), { recursive: true });
  writeFileSync(rawPath(battleId), JSON.stringify(detail));
}

/** The battle id an argument names: a battle id, or a fixture id / log id (for a fixture file, its provenance's). */
export function battleIdOf(arg: string): string {
  if (arg.startsWith("btl_")) return arg;
  return `btl_upload_${arg.replace(/^zmdlogs-/, "")}`;
}

/** A battle's detail from the cache, else fetched once (one request to zmdlogs.com) and cached. Refuses a hold-out. */
export async function rawDetail(battleId: string, fetch: (id: string) => Promise<unknown> = fetchDetail): Promise<{ detail: unknown; fetched: boolean }> {
  refuseHoldout(battleId.replace(/^btl_upload_/, ""));
  const file = rawPath(battleId);
  if (existsSync(file)) return { detail: JSON.parse(readFileSync(file, "utf8")) as unknown, fetched: false };
  const detail = await fetch(battleId);
  cacheRawDetail(battleId, detail);
  return { detail, fetched: true };
}

/**
 * `efsim zmdlogs refresh`: refreshes a development fixture (refreshFixture) from `detailFile` (then cached), else
 * from the cached detail, else fetched once (rawDetail) and cached. Refuses a hold-out.
 */
export async function refreshFromDetail(file: string, opts: { readonly detailFile?: string; readonly fetch?: (id: string) => Promise<unknown> } = {}): Promise<RefreshResult & { readonly fetched: boolean }> {
  const battleId = readDevFixture(file).provenance.battleId;
  if (opts.detailFile !== undefined) {
    const detail: unknown = JSON.parse(readFileSync(opts.detailFile, "utf8"));
    return { ...refreshFixture(file, detail, (d) => cacheRawDetail(battleId, d)), fetched: false };
  }
  const { detail, fetched } = await rawDetail(battleId, opts.fetch);
  return { ...refreshFixture(file, detail), fetched };
}

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "-" : JSON.stringify(v));

/**
 * A detail's timeline as lines: buff lanes (key, target, source, start–end ms, how many effects, and whether the log
 * values them) and other events (time, lane, key, source → target, value, the Stagger's credited skill), filtered by
 * regular expressions on the key. No battle metadata (it names players).
 */
export function formatRaw(detail: unknown, opts: { readonly buffs?: string; readonly events?: string } = {}): string {
  const events = ((detail as { timelineEvents?: unknown[] }).timelineEvents ?? []) as Json[];
  const buffRe = opts.buffs !== undefined ? new RegExp(opts.buffs) : undefined;
  const eventRe = opts.events !== undefined ? new RegExp(opts.events) : undefined;
  const showBuffs = buffRe !== undefined || eventRe === undefined;
  const showEvents = eventRe !== undefined || buffRe === undefined;
  const lines: string[] = [];
  for (const e of events) {
    const key = str(e["eventKey"]);
    if (e["laneType"] === "buff") {
      if (!showBuffs || (buffRe && !buffRe.test(key))) continue;
      const effects = Array.isArray(e["effects"]) ? e["effects"].length : 0;
      const dynamic = Array.isArray(e["dynamicEffects"]) ? e["dynamicEffects"].length : 0;
      lines.push(`buff  ${str(e["actualStartMsFromStart"])}–${str(e["actualEndMsFromStart"])} ms  ${key}  on ${str(e["targetEnemyKey"] ?? e["targetCharacterKey"])}  from ${str(e["sourceCharacterKey"])}  effects ${effects}${dynamic ? `, unvalued ${dynamic}` : ""}`);
    } else {
      if (!showEvents || (eventRe && !eventRe.test(key))) continue;
      const poise = e["poiseDamage"] as Json | null | undefined;
      lines.push(`${str(e["laneType"])}  ${str(e["tsMsFromStart"])} ms  ${key}  ${str(e["sourceCharacterKey"])} → ${str(e["targetCharacterKey"])}  value ${str(e["value"])}${poise ? `  Stagger ${str(poise["value"])} from ${str(poise["orig_source"])}` : ""}`);
    }
  }
  return lines.join("\n");
}
