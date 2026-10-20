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
  element?: string;
  poise?: unknown;
  poiseControlledOnly?: boolean;
  bonuses?: { zone: string; key: string }[];
  branch?: string;
}
interface DraftSkill {
  skillId: string;
  damageType: string;
  teamEnergy?: { frame: number; ratio: number }[];
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
  // Every operator with a kit, and batch 3's ten.
  const BATCH_3 = ["chr_0004_pelica", "chr_0005_chen", "chr_0006_wolfgd", "chr_0007_ikut", "chr_0011_seraph", "chr_0012_avywen", "chr_0014_aurora", "chr_0018_dapan", "chr_0024_deepfin", "chr_0038_purrche"];
  it.each([...Object.keys(data.kits.operators), ...BATCH_3])("drafts %s in the current kit format", (operator) => {
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
    expect(skill(laevat, "chr_0016_laevat_normal_skill").teamEnergy).toEqual([{ frame: 22, ratio: 1 }]);
    // Catcher's battle skill: half at the cast, half at frame 60 (each CreateBuff's ratio).
    expect(skill(draft("chr_0020_meurs").skills, "chr_0020_meurs_normal_skill").teamEnergy).toEqual([{ frame: 0, ratio: 0.5 }, { frame: 60, ratio: 0.5 }]);
    expect(skill(laevat, "chr_0016_laevat_ultimate_skill").energyBlockSeconds).toBe(16);
    const extra = skill(laevat, "chr_0016_laevat_normal_skill").hits.find((h) => h.frames.includes(104));
    expect(extra?.energy).toBe("extra_usp");
    // The created status buff's assigned keys (CreateBuff buff_common_fire_fire_burning_triggered duration, extra_scaling), as the kit writes them.
    expect(extra?.applies).toEqual([{ kind: "forcedReaction", status: "combustion", durationKey: "duration", scaleKey: "extra_scaling" }]);
    const gilberta = draft("chr_0013_aglina").skills;
    expect(skill(gilberta, "chr_0013_aglina_ultimate_skill").hits.map((h) => h.applies)).toEqual([[{ kind: "infliction", element: "natural" }]]);
    const typhoeus = draft("chr_0034_typhoea").skills;
    expect(skill(typhoeus, "chr_0034_typhoea_attack1").hits.map((h) => [h.frames, h.factor])).toEqual([[[5, 8], 0.5]]);
  });

  it("carries per-hit element, stagger, finisher factors, bonuses and talent gates", () => {
    const avywen = draft("chr_0012_avywen").skills;
    // Electric operator, Physical basic attacks.
    expect(skill(avywen, "chr_0012_avywen_attack1").hits.map((h) => h.element)).toEqual(["physical"]);
    expect(skill(avywen, "chr_0012_avywen_attack5").hits.map((h) => [h.poise, h.poiseControlledOnly])).toEqual([["poise", true]]);
    expect(skill(avywen, "chr_0012_avywen_power_attack").hits.map((h) => [h.frames, h.factor])).toEqual([
      [[27], 0.3],
      [[28], 0.2],
      [[29], 0.5],
    ]);
    // Talent 1's buff gates the combo's energy (CheckBuffStackNumAdvanced on the buff the talent attaches).
    expect(skill(avywen, "chr_0012_avywen_combo_skill").hits.map((h) => h.energy)).toEqual([{ if: { talentAtLeast: [0, 1] }, then: "talent0_usp" }]);
    expect(skill(draft("chr_0004_pelica").skills, "chr_0004_pelica_ultimate_skill").hits.map((h) => h.bonuses)).toEqual([[{ zone: "critRate", key: "crit" }]]);
  });

  it("drafts alternatives of one landing as branch hits", () => {
    const wulfgard = skill(draft("chr_0006_wolfgd").skills, "chr_0006_wolfgd_normal_skill");
    expect(wulfgard.hits.filter((h) => h.frames.includes(23)).map((h) => [h.events[0], h.branch])).toEqual([
      ["chr_0006_wolfgd_normal_skill_projhit_1", "at23"],
      ["chr_0006_wolfgd_normal_skill_projhit_FireSpellInfiction", "at23"],
    ]);
  });

  it("drafts what has no landing as cast triggers", () => {
    const triggers = (operator: string) => (JSON.parse(kitDraft(data, operator, new Map()).split("\n\n//")[0] as string) as { triggers?: { id: string; delay?: number; do: unknown[] }[] }).triggers ?? [];
    // Da Pan's ultimate Lifts every enemy at the cast; Snowshine's combo has energy and no damage.
    expect(triggers("chr_0018_dapan").find((t) => t.id === "ultimate_skill_f0")?.do).toEqual([{ kind: "apply", applies: [{ kind: "physicalStatus", status: "lift", forced: true }] }]);
    expect(triggers("chr_0014_aurora").find((t) => t.id === "combo_skill_f12")).toMatchObject({ delay: 12, do: [{ kind: "energy", value: "usp" }] });
    // Purrchena's giftbox energy is on both sides of "controlled": one unconditional grant.
    expect(triggers("chr_0038_purrche").find((t) => t.id === "combo_skill_f61")?.do).toEqual([{ kind: "energy", value: "usp" }]);
  });

  it("keeps the logged-event cross-check", () => {
    const { text } = draft("chr_0016_laevat", new Map([["chr_0016_laevat_attack1", 3], ["chr_0016_laevat_nothing_like_it", 2]]));
    expect(text).toContain("logged 3×");
    expect(text).toContain("// Logged event keys not in the draft:\n//   chr_0016_laevat_nothing_like_it ×2");
  });
});
