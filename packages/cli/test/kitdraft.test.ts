// efsim kit-draft v2: the draft is a kit in the current format (it validates
// against schemas/kit.schema.json) and carries the compiled values.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { kitDraft } from "../src/kitdraft.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const data = loadGameData();
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(JSON.parse(readFileSync(join(ROOT, "schemas", "kit.schema.json"), "utf8")) as object);

interface DraftHit {
  id: string;
  frames: number[];
  events: string[];
  factor?: number;
  energy?: unknown;
  finalStrike?: boolean;
  detached?: boolean;
  applies?: { kind: string; element?: string; status?: string }[];
}
interface DraftSkill {
  skillId: string;
  damageType: string;
  teamEnergyFrame?: number;
  energyBlockSeconds?: number;
  hits: DraftHit[];
}

/** The draft's JSON part (comments about logged keys follow it). */
function draft(operator: string, logged: ReadonlyMap<string, number> = new Map()): { skills: DraftSkill[]; text: string } {
  const text = kitDraft(data, operator, logged);
  const json = text.split("\n\n//")[0] as string;
  const kit = JSON.parse(json) as { skills: DraftSkill[] };
  return { skills: kit.skills, text };
}
const skill = (skills: DraftSkill[], id: string) => skills.find((s) => s.skillId === id) as DraftSkill;

describe("kit-draft v2", () => {
  it.each(["chr_0016_laevat", "chr_0034_typhoea", "chr_0032_lizhiyan", "chr_0036_jsspsi", "chr_0013_aglina", "chr_0035_liino", "chr_0021_whiten"])("drafts %s in the current kit format", (operator) => {
    const { text } = draft(operator);
    const kit = JSON.parse(text.split("\n\n//")[0] as string) as unknown;
    const ok = validate(kit);
    expect(ok ? [] : validate.errors).toEqual([]);
  });

  it("carries frames, event keys, detached and Final Strike per landing", () => {
    const { skills } = draft("chr_0016_laevat");
    const a4 = skill(skills, "chr_0016_laevat_attack4");
    expect(a4.hits.map((h) => [h.frames, h.events, h.detached ?? false])).toEqual([
      [[6], ["chr_0016_laevat_attack4"], false],
      [[12, 19], ["chr_0016_laevat_attack_5_projhit"], true],
    ]);
    const a5 = skill(skills, "chr_0016_laevat_attack5");
    expect(a5.hits.map((h) => [h.frames, h.finalStrike])).toEqual([
      [[23], false],
      [[26], true],
    ]);
  });

  it("carries the team-energy frame, energy blocks, energy and inflictions", () => {
    const laevat = draft("chr_0016_laevat").skills;
    expect(skill(laevat, "chr_0016_laevat_normal_skill").teamEnergyFrame).toBe(22);
    expect(skill(laevat, "chr_0016_laevat_ultimate_skill").energyBlockSeconds).toBe(16);
    const extra = skill(laevat, "chr_0016_laevat_normal_skill").hits.find((h) => h.frames.includes(104));
    expect(extra?.energy).toBe("extra_usp");
    expect(extra?.applies).toEqual([{ kind: "forcedReaction", status: "combustion" }]);
    const gilberta = draft("chr_0013_aglina").skills;
    expect(skill(gilberta, "chr_0013_aglina_ultimate_skill").hits.map((h) => h.applies)).toEqual([[{ kind: "infliction", element: "natural" }]]);
    const typhoeus = draft("chr_0034_typhoea").skills;
    expect(skill(typhoeus, "chr_0034_typhoea_attack1").hits.map((h) => [h.frames, h.factor])).toEqual([[[5, 8], 0.5]]);
  });

  it("keeps the logged-event cross-check", () => {
    const { text } = draft("chr_0016_laevat", new Map([["chr_0016_laevat_attack1", 3], ["chr_0016_laevat_nothing_like_it", 2]]));
    expect(text).toContain("logged 3×");
    expect(text).toContain("// Logged event keys not in the draft:\n//   chr_0016_laevat_nothing_like_it ×2");
  });
});
