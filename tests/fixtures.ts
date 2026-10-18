// Loads and validates the language-neutral fixtures in fixtures/.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Build } from "@efsim/engine";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface StatExpectation {
  stat: string;
  expected: number;
  display?: "exact" | "floor";
  tolerance?: number;
  note?: string;
}

export interface DamageExpectation {
  label: string;
  hits: { skill: string; hit: string; times?: number }[];
  conditions?: string[];
  /** Kit buffs (own or equipment) active for the hit: an ID, or an ID with layers. */
  buffs?: (string | { buff: string; layers?: number })[];
  crit?: "never" | "always" | "expected";
  expected: number;
  tolerance?: number;
}

export interface Fixture {
  id: string;
  description: string;
  provenance: { source: string; inGame: boolean; verifiedAgainst: Record<string, string>; notes?: string[] };
  build: Build;
  enemy: { id: string; level: number };
  expected: { stats?: StatExpectation[]; damage?: DamageExpectation[] };
}

function schema(name: string): object {
  return JSON.parse(readFileSync(join(ROOT, "schemas", name), "utf8")) as object;
}

export function loadFixtures(): { file: string; fixture: Fixture }[] {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(schema("build.schema.json"));
  const validate = ajv.compile(schema("fixture.schema.json"));
  const dir = join(ROOT, "fixtures");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("zmdlogs-"))
    .sort()
    .map((file) => {
      const fixture: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
      if (!validate(fixture)) throw new Error(`${file}: ${ajv.errorsText(validate.errors)}`);
      return { file, fixture: fixture as Fixture };
    });
}
