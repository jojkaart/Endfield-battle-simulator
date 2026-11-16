// What several command modules share: option groups (declared once, so the shared parse sees one definition), the
// checks that turn their values into engine inputs, and the repository root.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParseArgsOptionsConfig } from "node:util";
import { FPS, withSeconds, type CritMode, type TimelineScenario } from "@efsim/engine";
import type { CalcOptions } from "../commands.ts";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** A group of options, typed as a command's own declaration is (command.ts `command`). */
function optionGroup<const O extends ParseArgsOptionsConfig>(o: O): O {
  return o;
}

/** Options every command takes (cli.ts adds them to the parse): help, and --kit for any command reading the game data. */
export const GLOBAL_OPTIONS = optionGroup({
  kit: { type: "string", multiple: true, default: [] },
  help: { type: "boolean", short: "h", default: false },
});

/** The usage text's section on --kit (after the list of commands). */
export const GLOBAL_NOTES = [
  `Any command reading the game data:
  --kit <file>        An operator kit file (as in packages/data/kits/operators/, any name) in place of that
                      operator's own, for this run (repeatable): what-if variants without editing the real kit
`,
];

/** calc and compare's options (checked for every command, as the one parse always did: calcOptions). */
export const CALC_OPTIONS = optionGroup({
  enemy: { type: "string", default: "eny_0051_rodin" },
  level: { type: "string", default: "90" },
  crit: { type: "string", default: "expected" },
  staggered: { type: "boolean", default: false },
  buff: { type: "string", multiple: true, default: [] },
  verbose: { type: "boolean", default: false },
});

export const CALC_NOTES = `Options for calc and compare:
  --enemy <id>        Target (default eny_0051_rodin, Rhodagn)
  --level <n>         Enemy level (default 90)
  --crit <mode>       never | always | expected (default expected)
  --staggered         Target is staggered
  --buff <id>[:<n>]   Count a kit buff (own or equipment) as active, with n layers (repeatable; calc)
  --verbose           Every stat contribution and the zones of a hit
`;

/** calc and compare's options as CalcOptions; throws on a bad --crit, --level or --buff. */
export function calcOptions(values: { readonly enemy: string; readonly level: string; readonly crit: string; readonly staggered: boolean; readonly buff: readonly string[]; readonly verbose: boolean }): CalcOptions {
  const crit = values.crit as CritMode;
  if (!["never", "always", "expected"].includes(crit)) throw new Error(`--crit must be never, always or expected`);
  const level = Number(values.level);
  if (!Number.isInteger(level) || level < 1) throw new Error(`--level must be a whole number`);
  return {
    target: { enemy: values.enemy, level },
    crit,
    staggered: values.staggered,
    buffs: values.buff.map((b) => {
      const [buff, n] = b.split(":");
      const layers = n === undefined ? 1 : Number(n);
      if (!buff || !Number.isInteger(layers) || layers < 1) throw new Error(`--buff takes <id> or <id>:<layers>`);
      return { buff, layers };
    }),
    verbose: values.verbose,
  };
}

/** --seed, --dodge and --attack-every (simulate, search, rules). */
export const BATTLE_OPTIONS = optionGroup({
  seed: { type: "string" },
  dodge: { type: "string" },
  "attack-every": { type: "string" },
});

/** The scenario with --seed, --dodge and --attack-every applied (simulate, search, rules). */
export function withBattleOptions(values: { readonly seed?: string | undefined; readonly dodge?: string | undefined; readonly "attack-every"?: string | undefined }, scenario: TimelineScenario): TimelineScenario {
  const seed = values.seed === undefined ? undefined : Number(values.seed);
  if (seed !== undefined && !(Number.isInteger(seed) && seed >= 0)) throw new Error(`--seed must be a whole number ≥ 0`);
  const chance = values.dodge === undefined ? undefined : Number(values.dodge);
  if (chance !== undefined && !(chance >= 0 && chance <= 1)) throw new Error(`--dodge must be a chance from 0 to 1`);
  const every = values["attack-every"] === undefined ? undefined : Number(values["attack-every"]);
  if (every !== undefined && !(every > 0)) throw new Error(`--attack-every must be a positive number of seconds`);
  return {
    ...scenario,
    options: { ...scenario.options, ...(seed !== undefined ? { seed } : {}), ...(chance !== undefined ? { dodge: { chance } } : {}) },
    ...(every !== undefined ? { enemyActions: [...(scenario.enemyActions ?? []), { kind: "attack" as const, every: every * FPS }] } : {}),
  };
}

/** The scenario with --duration (simulate, search): the fight's length in seconds. */
export function withDuration(values: { readonly duration?: string | undefined }, scenario: TimelineScenario): TimelineScenario {
  if (values.duration === undefined) return scenario;
  const s = Number(values.duration);
  if (!(s > 0)) throw new Error("--duration must be a number of seconds > 0");
  return withSeconds(scenario, s);
}

/** A whole-number option at least `min`, or undefined when not given. */
export function wholeAtLeast(v: string | undefined, name: string, min: number): number | undefined {
  if (v === undefined) return undefined;
  const x = Number(v);
  if (!(Number.isInteger(x) && x >= min)) throw new Error(`--${name} must be a whole number ≥ ${min}`);
  return x;
}

/** `{ [key]: v }`, or nothing when v is undefined (for optional fields under exactOptionalPropertyTypes). */
export const opt = (k: string, v: number | undefined) => (v === undefined ? {} : { [k]: v });

/** --operator values as the scenario team's operator ids (by id or name); throws for one not in the team. */
export function teamOperators(names: readonly string[], team: readonly string[], nameOf: (op: string) => string | undefined): string[] {
  return names.map((x) => {
    const id = team.find((op) => op === x || nameOf(op)?.toLowerCase() === x.toLowerCase());
    if (!id) throw new Error(`--operator ${x}: not in the scenario's team`);
    return id;
  });
}
