// Basic-attack chain steps that share a key, and a stance's end the log shows only by its beats stopping
// (packages/logs/src/logcasts.ts choose, castassembly.ts silentExits), on real logs.

import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { type LogHit } from "@efsim/logs";
import { effectiveKit } from "@efsim/engine";
import { readLogFixture } from "@efsim/cli";
import { placeHits } from "../packages/logs/src/logcasts.ts";
import { assembleCasts } from "../packages/logs/src/castassembly.ts";

const data = loadGameData();

describe("chain steps sharing a key (logcasts.ts choose)", () => {
  it("Zhuang Fangyi's attack 4, whose range entity's key is attack 2's: a skill's own start from its other keys anchors one cast, a batch's one-group keys come first, and a step the log lacks is stepped through (4d60: ×3.125 attack 2's value)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-4d60e7fe92c2.json", import.meta.url).pathname);
    const Z = "chr_0030_zhuangfy";
    const p = placeHits(data, fx);
    const step = (t: number) => p.hits.get(fx.hits.find((h) => h.operator === Z && h.t === t && h.event === `${Z}_attack2_abilityrange`) as LogHit)?.cast.skillId.replace(`${Z}_`, "");
    // 1655 ms attack 2 (263); 2804 ms attack 4 (907), after attack 3's swords (the anchor at 1.87 s taken by attack 2);
    // 25785 ms attack 4, logged before attack 3's swords at its ms; 148723 ms attack 4, attack 3's swords unlogged.
    expect([1655, 2804, 3103, 25785, 148723].map(step)).toEqual(["attack2", "attack4", "attack4", "attack4", "attack4"]);
  });
});

describe("a stance's end the log shows by its beats stopping (castassembly.ts silentExits)", () => {
  it("Liino's beats stop at 25.54 s, her combo at 27.68 s, her basic attacks from 33.78 s: an End Stance after the combo's last landing (9847)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-984748cfa662.json", import.meta.url).pathname);
    const L = "chr_0035_liino";
    const placement = placeHits(data, fx);
    const kits = fx.team.flatMap((m) => effectiveKit(data, m) ?? []);
    const exits = assembleCasts(data, fx, placement, kits).filter((c) => c.operator === L && c.skillId === `${L}_normal_skill_end` && c.whileBuff?.buff === "vocalist_stance");
    // One after the combo's hit 2 (28.80 s), before her attack 1 (73.16 s: exitPresses', Cosmovoice's Amp unlisted from
    // 74.44 s, her battle skill at 75.84 s).
    expect(exits.map((c) => Math.round(c.start / 10) / 100)).toEqual([28.83, 73.16]);
  });
});
