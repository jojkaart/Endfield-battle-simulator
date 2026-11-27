// `efsim kit <operator>` (packages/cli/src/commands/kit.ts): the compiled kit with each skill's timing and hits' frames.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { landingFrames } from "@efsim/logs";
import { kitView } from "../packages/cli/src/commands/kit.ts";
import { assumptionsList } from "../packages/cli/src/commands/assumptions.ts";
import { heldFrames } from "../packages/cli/src/gamedata.ts";

const data = loadGameData();

describe("efsim kit", () => {
  it("prints an operator's skills by name with their timing and each hit's landing frames", () => {
    const text = kitView(data, "Si", /attack5$/);
    const kit = data.kits.operators["chr_0036_jsspsi"];
    const hit = kit?.skills.find((s) => s.skillId === "chr_0036_jsspsi_attack5")?.hits[0];
    expect(hit).toBeDefined();
    expect(text).toContain("chr_0036_jsspsi_attack5 (basic)");
    expect(text).toMatch(/duration \d+ frames \(\d+\.\d\d s\), uncuttable to frame \d+/);
    expect(text).toContain(`frames ${(landingFrames(hit as NonNullable<typeof hit>) ?? []).join(",")}`);
    expect(text).not.toMatch(/^Buffs:/m);
    expect(kitView(data, "chr_0036_jsspsi")).toMatch(/^Buffs:\n {2}\S+ "/m);
    expect(() => kitView(data, "nobody-at-all")).toThrow(/no operator is called or has an id with "nobody-at-all"/);
  });
});

describe("efsim kit: paths and triggers' actions (round 10)", () => {
  it("prints a skill's ends and the triggers' jumps on it (Snowshine's battle skill: the counter's jump, the end at 106)", () => {
    const text = kitView(data, "Snowshine");
    expect(text).toMatch(/chr_0014_aurora_normal_skill \(battle\)[^\n]*\n(?: {6}[^\n]*\n)*? {6}paths: ends at frame 106;[^\n]*trigger counter \(on \{"event":"attacked"\}\) jumps it from frame 0 until 51 to 107/);
    expect(text).toMatch(/^ {2}counter: on \{"event":"attacked"\}; by self\n {6}jump chr_0014_aurora_normal_skill: from frame 0 until 51 to 107$/m);
  });

  it("prints a trigger's hits as a skill's, with their conditions (Si's Artful Intent bursts)", () => {
    const text = kitView(data, "Si");
    expect(text).toMatch(/^ {6}hits if \{"buffActive":"inksoul"\}:\n {8}burst_inksoul "[^"]+"; frames \d+; battle cryst; keys /m);
    expect(text).toMatch(/^ {6}endBuff: buff inksoul$/m);
  });

  it("prints a choice's options with their weights and actions (Purrchena's giftbox)", () => {
    expect(kitView(data, "Purrchena")).toMatch(/^ +choose one:\n +option 1, weight [^\n]+:\n +\S/m);
  });
});

describe("efsim kit: skill groups and applications", () => {
  it("marks an enhanced basic attack by its skill group and lists each hit's applications", () => {
    const text = kitView(data, "Laevatain", /ult_attack[13]$/);
    expect(text).toContain("chr_0016_laevat_ult_attack1 (basic; skill group ultimate: an enhanced basic attack)");
    expect(text).toMatch(/applies infliction fire/);
  });
});

describe("efsim kit: what the compiler made of each time dilation", () => {
  it("shows Arcane's combo reset, its priority, and the layer-1 dilation it drops", () => {
    const text = kitView(data, "Arcane", /_combo_skill$/);
    expect(text).toMatch(/time dilations: .*frame 9 dilation layer 0 \(RESETto1\) priority -?\d+: reset/);
    expect(text).toMatch(/layer 1 \(own curve\) priority -?\d+: dropped: layer 1/);
  });

  it("gives the world frames each slow-down holds, and a skill's several together at the lowest scale", () => {
    // Rossi's combo_3: 12 and 19 frames from frame 0 hold 11.9 and 12.5 (the combo curve ramps), not 7 apart.
    const text = kitView(data, "Rossi", /_combo_3_skill$/);
    expect(text).toMatch(/slow-downs from frame 0 \(12 frames, lowest 0\.01, holds 11\.9\), 0 \(19 frames, lowest 0\.01, holds 12\.5\), 212 \(19 frames, lowest 0\.01, holds 12\.5\) \(together 26\.0 frames held at the lowest scale\)/);
    expect(heldFrames([{ from: 0, scales: [0, 0, 0.5] }, { from: 1, scales: [0.5, 0, 1] }])).toEqual({ each: [2.5, 1.5], together: 3 });
  });
});

describe("efsim assumptions", () => {
  it("lists every open assumption with its readings and default, filtered by a regex", () => {
    const all = assumptionsList(data);
    expect(all).toMatch(/^\d+ open assumption\(s\)/);
    expect(all).toMatch(/^control-immunity {2}\(the engine \(assumptions\.ts\); waits on \d+\)$/m);
    expect(all).toMatch(/^hidden-holds {2}\(the log replay \(engine replay-assumptions\.ts\); waits on \d+\)$/m);
    // The evidence from docs/design/assumptions.md, indented under its reading (round 19).
    expect(assumptionsList(data, /^break-hold$/)).toMatch(/^ {2}\* 14f: .*\n {6}the Stagger Node's own dilation/m);
    expect(all).toMatch(/^ {2}\* \S+: /m);
    const one = assumptionsList(data, /^buff-in-stop$/);
    expect(one).toMatch(/^1 open assumption/);
  });
});

describe("efsim kit: a cooldown's clock and its mechanism (cooldown-clock report point 3)", () => {
  it("prints an equipment kit by id, each cooldown with the game's mechanism the compiler found (KitTrigger.cooldownFrom)", () => {
    const sword = kitView(data, "suit_phy01");
    expect(sword).toMatch(/^suit_phy01: the compiled equipment kit/);
    expect(sword).toMatch(/cooldown "duration" on the world's clock \(held by stops and holds\): a CD timer \(AddGlobalCDTimer\) in passive_equipsuit_physuit_01, length key duration/);
    expect(data.kits.equipment["suit_phy01"]?.triggers[0]?.cooldownFrom).toEqual([{ kind: "globalCd", source: "passive_equipsuit_physuit_01", length: "duration" }]);
    // A timed marker runs on raw time, and a cooldown the data doesn't show says so.
    const xaihi = kitView(data, "Xaihi");
    expect(xaihi).toMatch(/cooldown 0\.3 on raw time: a timed marker \(CreateTimedMarker\) in chr_0011_seraph_normal_skill, length 0\.3 s/);
    expect(xaihi).toMatch(/cooldown 0\.3 on raw time: none in the data /);
  });
});
