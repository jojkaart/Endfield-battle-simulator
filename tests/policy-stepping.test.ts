// The rule driver's event stepping against its frame-by-frame reference, and the checks on a rules run (engine
// policy.ts playRules, policydiag.ts checkRuleRun; docs/design/rules.md "Rule-based rotations").
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import {
  checkRuleRun,
  playRules,
  resolveRuleList,
} from "@efsim/engine";
import { readScenario } from "@efsim/cli";
import { readRuleList } from "../packages/cli/src/rules.ts";

const data = loadGameData();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLE_TEAMS = ["estella-si-akekuri-arcane", "ink-melt", "typhoeus-arcane-liino-perlica"] as const;
const example = (t: string, zero = false) => {
  const sc = readScenario(join(ROOT, "examples", `${t}${zero ? "-zero" : ""}.scenario.json`));
  return { sc, list: resolveRuleList(data, sc.team.map((b) => b.operator), readRuleList(join(ROOT, "examples", `${t}.rules.json`))) };
};

describe("event stepping", () => {
  it.each(EXAMPLE_TEAMS)("%s: the same run as stepping frame by frame (several seeds, full energy and from zero)", (t) => {
    for (const [zero, seed] of [[false, 1], [false, 2], [false, 3], [true, 4]] as const) {
      const { sc, list: l } = example(t, zero);
      const fight90 = { ...sc, durationFrames: 90 * 30, rotation: [] };
      const a = playRules(data, fight90, l, { seed });
      const b = playRules(data, fight90, l, { seed, stepping: "frames" });
      expect(a.rotation).toEqual(b.rotation);
      expect(a.sustainedDps).toBe(b.sustainedDps);
      expect(a.fired).toEqual(b.fired);
    }
  });
});

describe("rules runs: what a player of the list would do", () => {
  it.each(EXAMPLE_TEAMS)("%s: no press casts another skill than its button showed, none cuts its operator's own ultimate state, and `simulate` replays it", (t) => {
    for (const [zero, seed] of [[false, 1], [false, 2], [true, 3]] as const) {
      const { sc, list: l } = example(t, zero);
      const fight120 = { ...sc, durationFrames: 120 * 30, rotation: [] };
      const r = playRules(data, fight120, l, { seed });
      const c = checkRuleRun(data, fight120, r);
      expect(c.wrongSkill).toEqual([]);
      expect(c.cutsOwnUltimate).toEqual([]);
      expect(c.replays).toBe(true);
      expect(r.presses.length).toBe(r.rotation.length);
    }
  });
  it("catches the End Stance class: Liino's battle button pressed in Cosmovoice ends her ultimate's stance", () => {
    const { sc } = example("typhoeus-arcane-liino-perlica");
    const l = resolveRuleList(data, sc.team.map((b) => b.operator), {
      opener: [{ operator: "Liino", cast: "ultimate" }],
      rules: [{ when: { buff: { operator: "Liino", buff: "cosmovoice_amp" } }, do: { operator: "Liino", cast: "battle" } }],
    });
    const fight20 = { ...sc, durationFrames: 20 * 30, rotation: [], startEnergy: { chr_0035_liino: "full" as const } };
    const r = playRules(data, fight20, l, { seed: 1 });
    const c = checkRuleRun(data, fight20, r);
    expect(c.cutsOwnUltimate.some((x) => x.operator === "chr_0035_liino" && x.skill === "chr_0035_liino_normal_skill_end")).toBe(true);
    expect(c.wrongSkill).toEqual([]);
  });
});
