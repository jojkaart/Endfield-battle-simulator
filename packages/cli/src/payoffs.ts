// efsim payoffs: the payoff table, the trigger graph's chains and a rotation's setup efficiency (docs/design.md
// "Payoffs and chains"). Display only: `--top` limits what's printed, never the data (`--json` has everything).

import { EngineError, FPS, payoffs, setupEfficiency, type GameData, type PayoffOptions, type PayoffReport, type SetupEfficiency, type TimelineScenario } from "@efsim/engine";
import { num, table } from "./format.ts";

/** A step's name: the operator's and the kit skill's label (or "chain to Final Strike"). */
function stepName(data: GameData, id: string): string {
  if (id.startsWith("(")) return id;
  const [op, skill] = id.split(":") as [string, string];
  const name = data.operators[op]?.name ?? op;
  if (skill === "chain") return `${name} basic chain`;
  const label = data.kits.operators[op]?.skills.find((s) => s.skillId === skill)?.label;
  return `${name} ${label ?? skill.replace(`${op}_`, "")}`;
}

const n = (x: number) => num(Math.round(x), 0);
const s = (f: number) => (Number.isFinite(f) ? `${(f / FPS).toFixed(1)} s` : "∞");

/** Everything the command computes: the report, and the scenario's own rotation against it (when it has one). */
export interface PayoffsRun {
  readonly report: PayoffReport;
  readonly efficiency?: SetupEfficiency;
  /** Why the scenario's rotation couldn't be checked (an action not legal in this scenario). */
  readonly efficiencyError?: string;
}

export function runPayoffs(data: GameData, scenario: TimelineScenario, options: PayoffOptions = {}): PayoffsRun {
  const { rotation, ...rest } = scenario;
  const report = payoffs(data, rest, options);
  if (rotation.length === 0) return { report };
  try {
    return { report, efficiency: setupEfficiency(data, scenario, report, report.chains.map((c) => c.steps.map((x) => x.step))) };
  } catch (e) {
    if (!(e instanceof EngineError)) throw e;
    return { report, efficiencyError: e.message };
  }
}

/** The tables: steps and what they open, ceilings with their bundles, window payoffs, chains, the rotation's efficiency. */
export function formatPayoffs(data: GameData, run: PayoffsRun, top = 15): string {
  const r = run.report;
  const name = (id: string) => stepName(data, id);
  const out: string[] = [];
  out.push(`Payoffs of ${r.steps.length} steps (${r.probes} probes; full ultimate energy, the fight's start). Every number is the fight with the step against it without (engine probes).`);
  if (r.unreachable.length) out.push(`Not castable from the start or after two steps: ${r.unreachable.map((u) => `${name(u.step)} (${u.why})`).join("; ")}.`);
  // What each step produces (no situation, and what opens only from a situation).
  out.push("", "What each step does (from the start; windows it opens, enemy events, buffs that change damage):");
  const rows = r.steps.flatMap((st) => {
    const e = r.effects.find((x) => x.step === st.id && x.situation === "none");
    if (!e) return [];
    const extra = r.effects.filter((x) => x.step === st.id && x.situation !== "none").flatMap((x) => x.windows.filter((w) => !e.windows.some((y) => y.key === w.key)).map((w) => `${w.key} (${x.situation})`));
    return [[name(st.id), e.prefix.length ? e.prefix.map(name).join(" → ") : "", n(e.damage), [...e.windows.map((w) => `${w.key} +${s(w.offset)}`), ...new Set(extra)].join(", "), [...new Set(e.enemy.map((x) => x.event))].join(", "), e.buffs.filter((b) => b.damage).map((b) => `${b.id} ${s(b.duration)}${b.layers > 1 ? ` ×${b.layers}` : ""}`).join(", "), `${e.cost.sp ? `${e.cost.sp} SP ` : ""}${e.cost.energy ? `${e.cost.energy} energy ` : ""}${e.cost.cooldown ? `cd ${s(e.cost.cooldown)}` : ""}`.trim()]];
  });
  out.push(table(["step", "after", "damage", "opens windows", "enemy", "buffs", "cost"], rows, ["l", "l", "r", "l", "l", "l", "l"]));
  // Ceilings.
  out.push("", `Ceilings (damage bare → under the best bundle of what the team achieves; best situation; the bundle's pieces with what each adds and who makes it, lead = how long before the payoff it may be cast):`);
  for (const c of r.ceilings.slice(0, top)) {
    out.push(`  ${name(c.step)}: ${n(c.bare)} → ${n(c.best)} (×${(c.best / Math.max(1, c.bare)).toFixed(2)}; own kit hits ${n(c.bestCast)}, every hit ${n(c.bestAll)}), ${c.situation}${c.against.length ? `; left out (lower it): ${c.against.join(", ")}` : ""}`);
    for (const b of c.bundle) {
      const who = b.achievers.slice(0, 3).map((a) => `${name(a.step)}${a.lead ? ` lead ${s(a.lead.min)}–${s(a.lead.max)}` : " (too short for all hits)"}${a.cost.sp ? `, ${a.cost.sp} SP` : ""}${a.cost.energy ? `, ${a.cost.energy} energy` : ""}`).join("; ");
      out.push(`      +${n(b.worth).padStart(7)}  ${b.key}  ← ${who}${b.achievers.length > 3 ? `; +${b.achievers.length - 3} more` : ""}`);
    }
  }
  if (r.ceilings.length > top) out.push(`  … ${r.ceilings.length - top} more (--top, or --json for all)`);
  if (r.windows.length) {
    out.push("", "Window payoffs:");
    for (const w of r.windows) out.push(`  ${w.what}: ${w.damage ? `${n(w.damage)} at most in a probe, ` : ""}made by ${[...new Set(w.achievers.map((a) => name(a.step)))].join(", ")}`);
  }
  // Chains.
  out.push("", `Chains (${r.chains.length}${r.capped ? ", search stopped at its probe budget" : ""}; each step opens or sets up the next; by damage per second of the chain's span):`);
  for (const c of r.chains.slice(0, top)) {
    out.push(`  ${n(c.perSecond)}/s: ${n(c.damage)} in ${s(c.span)}${c.cost.sp ? `, ${c.cost.sp} SP` : ""}${Object.keys(c.cost.energy).length ? `, energy ${Object.entries(c.cost.energy).map(([op, e]) => `${data.operators[op]?.name ?? op} ${Math.round(e)}`).join(", ")}` : ""}`);
    out.push(`      ${c.steps.map((x) => `${name(x.step)} (+${s(x.at)}${x.link === "first" ? "" : `, ${x.link}`}${x.slack !== null ? `, slack ${s(x.slack)}` : ""})`).join(" → ")}`);
    if (c.merged && (c.merged.setups.length || c.merged.fillers.length)) {
      out.push(`      merged: ${n(c.merged.damage)} with ${[...c.merged.setups.map((x) => `setup ${name(x.step)} (+${n(x.synergy)} synergy)`), ...c.merged.fillers.map((x) => `filler ${name(x.step)} after step ${x.after + 1} (+${n(x.gain)})`)].join(", ")}`);
    }
  }
  if (r.chains.length > top) out.push(`  … ${r.chains.length - top} more (--top, or --json for all)`);
  if (run.efficiencyError) out.push("", `The scenario's rotation isn't legal here, so it isn't compared: ${run.efficiencyError}`);
  const e = run.efficiency;
  if (e) {
    out.push("", `The scenario's rotation (${n(e.total)}): each cast's own damage against its ceiling's own hits (setup efficiency):`);
    const big = [...e.casts].sort((a, b) => b.own - a.own).slice(0, top);
    // A recording buff's burst lands as the recording step's own hits: a window payoff, not a ceiling's.
    const records = new Set(r.effects.filter((x) => x.recordRate && x.situation === "none" && x.prefix.length === 0).map((x) => x.step));
    out.push(table(["time", "cast", "own damage", "ceiling", "efficiency"], big.map((c) => [s(c.frame), `${name(c.step)}${records.has(c.step) ? " (with its recording burst)" : ""}`, n(c.own), n(c.ceiling), `${(c.efficiency * 100).toFixed(0)}%`]), ["r", "l", "r", "r", "r"]));
    const played = e.chains.filter((c) => c.at.length > 0).sort((a, b) => b.at.length - a.at.length);
    out.push("", `Chains the rotation plays (${played.length} of ${e.chains.length}):`);
    for (const c of played.slice(0, top)) out.push(`  ${c.at.length}×  ${c.chain.split(" → ").map(name).join(" → ")} (at ${c.at.map(s).join(", ")})`);
  }
  return out.join("\n");
}
