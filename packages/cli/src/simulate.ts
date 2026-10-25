// efsim simulate: run a scenario file on the timeline.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { FPS, critTriggers, randomOutcomes, searchBeams, simulate, simulateRuns, type RotationSpread, type TimelineResult, type Build, type CritMode, type Element, type GameData, type RotationAction, type TimelineScenario } from "@efsim/engine";
import { readBuild } from "./commands.ts";
import { num, table } from "./format.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

interface RawScenario {
  team: (string | Build)[];
  controlled?: string;
  target: { enemy: string; level: number; controlImmune?: boolean };
  durationSeconds: number;
  crit?: CritMode;
  seed?: number;
  dodge?: { chance: number };
  startEnergy?: Record<string, number | "full">;
  startStacks?: Record<string, Record<string, number>>;
  rotation: { operator: string; skill: string; at?: number; repeat?: number }[];
  enemyHp?: { at: number; fraction: number }[];
  enemyActions?: { kind: "attack" | "charge"; at?: number[]; every?: number; from?: number; target?: string; element?: Element }[];
}

export function readScenario(file: string): TimelineScenario {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schema = (name: string) => JSON.parse(readFileSync(join(ROOT, "schemas", name), "utf8")) as object;
  ajv.addSchema(schema("build.schema.json"));
  const validate = ajv.compile(schema("scenario.schema.json"));
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!validate(raw)) throw new Error(`${file}: ${ajv.errorsText(validate.errors)}`);
  const s = raw as RawScenario;
  const rotation: RotationAction[] = s.rotation.flatMap((a) =>
    Array.from({ length: a.repeat ?? 1 }, () => ({ operator: a.operator, skill: a.skill, ...(a.at !== undefined ? { at: Math.round(a.at * FPS) } : {}) })),
  );
  return {
    team: s.team.map((t) => (typeof t === "string" ? readBuild(resolve(dirname(file), t)) : t)),
    target: s.target,
    durationFrames: Math.round(s.durationSeconds * FPS),
    rotation,
    options: { crit: s.crit ?? "expected", ...(s.seed !== undefined ? { seed: s.seed } : {}), ...(s.dodge ? { dodge: s.dodge } : {}) },
    ...(s.controlled ? { controlled: s.controlled } : {}),
    ...(s.startEnergy ? { startEnergy: s.startEnergy } : {}),
    ...(s.startStacks ? { startStacks: s.startStacks } : {}),
    ...(s.enemyHp ? { enemyHp: s.enemyHp.map((e) => ({ from: Math.round(e.at * FPS), fraction: e.fraction })) } : {}),
    ...(s.enemyActions ? { enemyActions: s.enemyActions.map((a) => ({
      kind: a.kind,
      ...(a.at ? { at: a.at.map((t) => Math.round(t * FPS)) } : {}),
      ...(a.every !== undefined ? { every: a.every * FPS } : {}),
      ...(a.from !== undefined ? { from: Math.round(a.from * FPS) } : {}),
      ...(a.target ? { target: a.target } : {}),
      ...(a.element ? { element: a.element } : {}),
    })) } : {}),
  };
}

/** One battle of the scenario; with random outcomes, a note that it's one battle of a distribution (unless `runs` was asked for, which prints formatRuns instead). */
export function formatSimulation(data: GameData, scenario: TimelineScenario, verbose: boolean): string {
  const text = formatResult(data, scenario, simulate(data, scenario), verbose);
  // With expected crits, crit-triggered effects never fire (no hit counts as a crit): a warning, not a distribution.
  const offCrits = scenario.options.crit === "expected" ? critTriggers(data, scenario) : [];
  const random = randomOutcomes(data, scenario).filter((x) => offCrits.length === 0 || !x.startsWith("crit-triggered effects"));
  if (random.length === 0 && offCrits.length === 0) return text;
  const [first, ...rest] = text.split("\n");
  return [
    first,
    ...(offCrits.length ? [`Warning: crit-triggered effects never fire with expected crits (${offCrits.join("; ")}); crit "rolled" or --runs n plays them.`] : []),
    ...(random.length ? [`Note: random outcomes (${random.join("; ")}): this is one battle (seed ${scenario.options.seed ?? 1}) of a distribution; --runs n shows the spread over n battles.`] : []),
    ...rest,
  ].join("\n");
}

/** The spread of a rotation's damage over many battles with rolled crits, beside its expected-crit total. */
export function formatRuns(data: GameData, scenario: TimelineScenario, runs: number): string {
  const r = simulateRuns(data, scenario, runs);
  const expected = simulate(data, { ...scenario, options: { ...scenario.options, crit: "expected" } }).total;
  const n = (x: number) => num(Math.round(x), 0);
  return [
    `${runs} battles with rolled crits (seeds ${r.seed}–${r.seed + runs - 1}) vs ${data.enemies[scenario.target.enemy]?.name ?? scenario.target.enemy} Lv${scenario.target.level}:`,
    "",
    table(
      ["", "total damage"],
      [
        ["mean", n(r.mean)],
        ["standard deviation", `${n(r.sd)} (${r.mean ? ((r.sd / r.mean) * 100).toFixed(1) : "0.0"}%)`],
        ["min", n(r.min)],
        ["5th percentile", n(r.p5)],
        ["median", n(r.p50)],
        ["95th percentile", n(r.p95)],
        ["max", n(r.max)],
        ["expected crits", n(expected)],
      ],
      ["l", "r"],
    ),
  ].join("\n");
}

/** A search result's distribution over seeded battles, beside the one battle with the scenario's own seed. */
export function formatSpread(data: GameData, scenario: TimelineScenario, spread: RotationSpread, single: number): string {
  const n = (x: number) => num(Math.round(x), 0);
  const legal = spread.runs - spread.illegal;
  return [
    `The found rotation over ${spread.runs} battles (seeds ${spread.seed}–${spread.seed + spread.runs - 1}, crit: ${scenario.options.crit}) vs ${data.enemies[scenario.target.enemy]?.name ?? scenario.target.enemy} Lv${scenario.target.level}:`,
    ...(spread.illegal > 0 ? [`Not legal in ${spread.illegal} of them (an action's random outcome went otherwise there); the figures are over the other ${legal}.`] : []),
    "",
    table(
      ["", "total damage"],
      [
        ["mean", n(spread.mean)],
        ["standard deviation", `${n(spread.sd)} (${spread.mean ? ((spread.sd / spread.mean) * 100).toFixed(1) : "0.0"}%)`],
        ["min", n(spread.min)],
        ["5th percentile", n(spread.p5)],
        ["median", n(spread.p50)],
        ["95th percentile", n(spread.p95)],
        ["max", n(spread.max)],
        [`one battle (seed ${scenario.options.seed ?? 1})`, n(single)],
      ],
      ["l", "r"],
    ),
  ].join("\n");
}

/** The beam widths `efsim search` runs for `--beam w`: w/2, w and 2w (searchBeams), or w alone with `single`. */
export function searchWidths(beam: number, single: boolean): number[] {
  return single ? [beam] : [...new Set([Math.max(1, Math.round(beam / 2)), beam, beam * 2])];
}

/**
 * Search a rotation for the scenario's team (its own rotation is ignored) at beam widths w/2, w and 2w (or w alone:
 * `single`), keep the best, and say how far apart the widths' results are; optionally save it as a scenario that
 * `simulate` replays.
 */
export function searchCommand(
  data: GameData,
  scenario: TimelineScenario,
  options: { beam: number; single?: boolean; swaps?: boolean; out?: string; seeds?: number; percentile?: number; runs?: number; verbose: boolean },
): string {
  const { rotation: _ignored, ...rest } = scenario;
  const widths = searchWidths(options.beam, options.single ?? false);
  const seconds = new Map<number, number>();
  let t = Date.now();
  const found = searchBeams(data, rest, {
    beams: widths,
    swaps: options.swaps ?? false,
    ...(options.seeds !== undefined ? { seeds: options.seeds } : {}),
    ...(options.percentile !== undefined ? { percentile: options.percentile } : {}),
    ...(options.runs !== undefined ? { runs: options.runs } : {}),
  }, (_r, w) => {
    const now = Date.now();
    seconds.set(w, (now - t) / 1000);
    t = now;
  });
  const total = [...seconds.values()].reduce((a, b) => a + b, 0);
  const states = found.beams.reduce((a, b) => a + b.expanded, 0);
  const seeds = found.seeds.length === 1 ? `seed ${found.seeds[0]}` : `seeds ${found.seeds[0]}–${found.seeds.at(-1)}`;
  const ranked = typeof found.rankedBy === "string" ? "the mean" : `percentile ${found.rankedBy.percentile}`;
  // Played in the search's crit mode (rolled for crit-triggered effects under expected crits: searchCritMode).
  const full = { ...scenario, rotation: found.rotation, options: { ...scenario.options, crit: found.crit } };
  const what = found.random.length > 0 ? `${ranked} of ${found.seeds.length} battles` : "damage";
  const capped = found.beams.filter((b) => b.capped);
  const lines = [
    widths.length === 1
      ? `Searched ${states} states (beam ${widths[0]}) in ${total.toFixed(1)} s.`
      : `Searched beams ${widths.join(", ")} (${states} states, ${total.toFixed(1)} s); the best at beam ${found.beamWidth}:`,
    ...(widths.length === 1 ? [] : [
      ...found.beams.map((b) => `  beam ${String(b.beamWidth).padStart(3)}: ${num(Math.round(b.score), 0)} (${what}; ${b.expanded} states, ${(seconds.get(b.beamWidth) ?? 0).toFixed(1)} s)${b.beamWidth === found.beamWidth ? "  best" : ""}`),
      `  Spread ${(found.beamSpread * 100).toFixed(1)}%: ${found.beamSpread < 0.01 ? "the widths agree within 1%." : "the widths disagree; the beam ranks by damage so far, so a rotation that pays off later can be dropped. Treat the best as a lower bound."}`,
    ]),
    ...capped.map((b) => `Warning: beam ${b.beamWidth} stopped at the expansion cap (${b.expanded} states) before the fight's end: its rotation is the best found by then.`),
    ...(found.random.length > 0 ? [`Random outcomes (${found.random.join("; ")}): each candidate ranked by ${ranked} of ${found.seeds.length} battle${found.seeds.length === 1 ? "" : "s"} (${seeds}).`] : []),
    "",
    formatResult(data, full, found.result, options.verbose),
    ...(found.spread ? ["", formatSpread(data, full, found.spread, found.result.total)] : []),
  ];
  if (options.out) {
    const doc = {
      $schema: "../schemas/scenario.schema.json",
      description: `Rotation found by efsim search (beam ${found.beamWidth} of ${widths.join(", ")}${found.random.length > 0 ? `, ranked by ${ranked} of ${found.seeds.length} seeded battles` : ""}); replays with efsim simulate.`,
      team: scenario.team,
      target: scenario.target,
      ...(scenario.controlled ? { controlled: scenario.controlled } : {}),
      ...(scenario.startEnergy ? { startEnergy: scenario.startEnergy } : {}),
      ...(scenario.startStacks ? { startStacks: scenario.startStacks } : {}),
      durationSeconds: scenario.durationFrames / FPS,
      crit: found.crit,
      ...(scenario.options.seed !== undefined ? { seed: scenario.options.seed } : {}),
      ...(scenario.options.dodge ? { dodge: scenario.options.dodge } : {}),
      ...(scenario.enemyHp ? { enemyHp: scenario.enemyHp.map((e) => ({ at: e.from / FPS, fraction: e.fraction })) } : {}),
      ...(scenario.enemyActions ? { enemyActions: scenario.enemyActions.map((a) => ({ ...a, ...(a.at ? { at: a.at.map((f) => f / FPS) } : {}), ...(a.every !== undefined ? { every: a.every / FPS } : {}), ...(a.from !== undefined ? { from: a.from / FPS } : {}) })) } : {}),
      rotation: found.rotation.map((a) => ({ operator: a.operator, skill: a.skill, ...(a.at !== undefined ? { at: a.at / FPS } : {}) })),
    };
    writeFileSync(options.out, JSON.stringify(doc, null, 2) + "\n");
    lines.push("", `Wrote ${options.out}.`);
  }
  return lines.join("\n");
}

export function formatResult(data: GameData, scenario: TimelineScenario, r: TimelineResult, verbose: boolean): string {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const out = [
    `Total ${num(Math.round(r.total), 0)} damage in ${(r.lastHitFrame / FPS).toFixed(2)} s (last hit) → ${num(Math.round(r.dps), 0)} DPS` +
      ` vs ${data.enemies[scenario.target.enemy]?.name ?? scenario.target.enemy} Lv${scenario.target.level}, crit: ${scenario.options.crit}` +
      (scenario.options.crit === "rolled" ? ` (seed ${scenario.options.seed ?? 1}: ${r.hits.filter((h) => h.crit).length} of ${r.hits.filter((h) => h.crit !== undefined).length} hits crit)` : "") +
      (scenario.options.dodge ? `, perfect dodges ${r.casts.filter((c) => c.skill === "dodge").length} (chance ${scenario.options.dodge.chance})` : ""),
    "",
    table(
      ["operator", "damage", "share"],
      Object.entries(r.perOperator).map(([op, d]) => [name(op), num(Math.round(d), 0), r.total ? `${((d / r.total) * 100).toFixed(1)}%` : "-"]),
      ["l", "r", "r"],
    ),
    "",
    table(
      ["time", "operator", "skill", "SP after", "energy after"],
      r.casts.map((c) => [`${(c.frame / FPS).toFixed(2)} s`, name(c.operator), c.skill.replace(/^chr_\d+_[a-z]+_/, ""), c.spAfter.toFixed(0), c.energyAfter.toFixed(1)]),
      ["r", "l", "l", "r", "r"],
    ),
  ];
  const reactions = r.reactions.filter((e) => e.kind !== "combustionTick");
  if (reactions.length) {
    const what = (e: (typeof reactions)[number]) =>
      e.kind === "burst" ? `${e.element} burst`
      : e.kind === "reaction" ? `${e.status} level ${e.level}${e.consumed ? ` (consumed ${e.consumed})` : " (forced)"}`
      : e.kind === "consumed" ? `consumed ${e.stacks} ${e.element}`
      : e.kind === "statusConsumed" ? `consumed ${e.status} level ${e.level}`
      : e.kind === "physical" ? `${e.status} level ${e.level}${e.forced ? " (forced)" : ""}`
      : e.kind === "vulnerable" ? `vulnerable ${e.stacks} stack${e.stacks === 1 ? "" : "s"}`
      : e.kind === "shatter" ? `shatter (solidification level ${e.level})`
      : e.kind === "control" ? `${e.status} (${(e.frames / FPS).toFixed(2)} s)` : "";
    const ticks = r.hits.filter((h) => h.skillId === "reaction:combustionTick");
    out.push(
      "",
      table(["time", "operator", "arts reaction"], reactions.map((e) => [`${(e.frame / FPS).toFixed(2)} s`, name(e.operator), what(e)]), ["r", "l", "l"]),
      ...(ticks.length ? [`Combustion ticks: ${ticks.length}, ${num(Math.round(ticks.reduce((t, h) => t + h.exact, 0)), 0)} damage`] : []),
    );
  }
  if (verbose) {
    out.push("", table(["time", "operator", "hit", "damage"], r.hits.map((h) => [`${(h.frame / FPS).toFixed(2)} s`, name(h.operator), `${h.skillId.replace(/^chr_\d+_[a-z]+_/, "")} ${h.hitId}`, num(h.damage, 0)]), ["r", "l", "l", "r"]));
  }
  out.push("", "Assumptions (v1 timeline):", ...r.assumptions.map((a) => `  - ${a}`));
  return out.join("\n");
}
