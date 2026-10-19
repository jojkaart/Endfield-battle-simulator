// efsim simulate: run a scenario file on the timeline.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { FPS, searchRotation, simulate, type TimelineResult, type Build, type CritMode, type GameData, type RotationAction, type TimelineScenario } from "@efsim/engine";
import { readBuild } from "./commands.ts";
import { num, table } from "./format.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

interface RawScenario {
  team: (string | Build)[];
  controlled?: string;
  target: { enemy: string; level: number; controlImmune?: boolean };
  durationSeconds: number;
  crit?: CritMode;
  conditions?: Record<string, string[]>;
  startEnergy?: Record<string, number | "full">;
  startStacks?: Record<string, Record<string, number>>;
  rotation: { operator: string; skill: string; at?: number; repeat?: number }[];
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
    options: { crit: s.crit ?? "expected", ...(s.conditions ? { conditions: s.conditions } : {}) },
    ...(s.controlled ? { controlled: s.controlled } : {}),
    ...(s.startEnergy ? { startEnergy: s.startEnergy } : {}),
    ...(s.startStacks ? { startStacks: s.startStacks } : {}),
  };
}

export function formatSimulation(data: GameData, scenario: TimelineScenario, verbose: boolean): string {
  return formatResult(data, scenario, simulate(data, scenario), verbose);
}

/** Search a rotation for the scenario's team (its own rotation is ignored); optionally save it as a scenario that `simulate` replays. */
export function searchCommand(data: GameData, scenario: TimelineScenario, options: { beam: number; out?: string; verbose: boolean }): string {
  const { rotation: _ignored, ...rest } = scenario;
  const t0 = Date.now();
  const found = searchRotation(data, rest, { beamWidth: options.beam });
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  const lines = [
    `Searched ${found.expanded} states (beam ${options.beam}) in ${seconds} s.`,
    "",
    formatResult(data, { ...scenario, rotation: found.rotation }, found.result, options.verbose),
  ];
  if (options.out) {
    const doc = {
      $schema: "../schemas/scenario.schema.json",
      description: `Rotation found by efsim search (beam ${options.beam}); replays with efsim simulate.`,
      team: scenario.team,
      target: scenario.target,
      ...(scenario.controlled ? { controlled: scenario.controlled } : {}),
      ...(scenario.startEnergy ? { startEnergy: scenario.startEnergy } : {}),
      ...(scenario.startStacks ? { startStacks: scenario.startStacks } : {}),
      durationSeconds: scenario.durationFrames / FPS,
      crit: scenario.options.crit,
      ...(scenario.options.conditions ? { conditions: scenario.options.conditions } : {}),
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
      ` vs ${data.enemies[scenario.target.enemy]?.name ?? scenario.target.enemy} Lv${scenario.target.level}, crit: ${scenario.options.crit}`,
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
