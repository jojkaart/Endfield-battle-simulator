// The placement and cast-assembly cases the one-sided rounds left (docs/open-problems.md "Log-only landings", 2026-11-27):
// an ability entity's landings that came too late for the cast they were joined to (logcasts.ts onEntityClock), a kit
// jump a landing launched before it doesn't contradict (engine drivers.ts replayCast), a slot press whose landings fall
// where the enemy is away (castassembly.ts withLoggedCasts `unseen`) made as the button's variant (replayrun.ts
// replayedSkill). Each on the log that showed it.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay, placeHits, type LogFixture } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;
const frameOf = (ms: number) => Math.round((ms * 30) / 1000);

describe("an ability entity's landings are due within its slots' span (onEntityClock)", () => {
  const L = "chr_0016_laevat";
  const key = `${L}_normal_skill_abilityentity`;

  // f879 94.71 s: the Magma Fragment's explosion of a battle skill the log shows by it, its ten ticks and its 95.94 s
  // empowered hit; the 87.12 s battle skill's own ticks are unlogged. Taken for that cast's first tick, it left the
  // empowered hit a battle skill of its own at 92.48 s, before her final strike's Heat absorption at 92.49 s.
  it("a landing 6.9 s after its cast's explosion starts a new battle skill (f879 94.71 s)", () => {
    const fx = fixture("f879");
    const p = placeHits(data, fx);
    const explosion = fx.hits.find((h) => h.t === 94713 && h.event === key) ?? fx.hits.find((h) => Math.abs(h.t - 94710) < 10 && h.event === key);
    expect(explosion).toBeDefined();
    const placed = p.hits.get(explosion as (typeof fx.hits)[number]);
    expect(placed?.frame).toBe(22);
    const empowered = fx.hits.find((h) => Math.abs(h.t - 95940) < 10 && h.event === `${L}_normal_skill`);
    expect(p.hits.get(empowered as (typeof fx.hits)[number])?.cast).toBe(placed?.cast);
    const battle = [...new Set([...p.hits.values()].map((x) => x.cast))].filter((c) => c.operator === L && c.skillId === `${L}_normal_skill` && c.start > 90000 && c.start < 97000);
    expect(battle.length).toBe(1);
  });

  it("the replay lands that battle skill's empowered hit, 162,889 (f879 95.94 s)", () => {
    const { replay } = logBuffReplay(data, fixture("f879"));
    const hit = replay.hits.find((h) => h.operator === L && h.hitId === "empowered_extra" && Math.abs(h.frame - frameOf(95940)) <= 1);
    expect(hit).toBeDefined();
  });

  // 9a80 29.20 s: Rossi's combo afterhits are a buff's timeline (buff_chr_0028_wulfa_combo_2_damage), held as the world
  // is: the third, 3.7 s after the second, stays her 23.40 s combo's.
  it("not a buff's timeline: Rossi's third combo afterhit stays its cast's (9a80 29.20 s)", () => {
    const fx = fixture("9a80");
    const p = placeHits(data, fx);
    const third = fx.hits.find((h) => Math.abs(h.t - 29200) < 10 && h.event === "buff_chr_0028_wulfa_combo_2_damage");
    const placed = p.hits.get(third as (typeof fx.hits)[number]);
    expect(placed?.index).toBe(2);
    expect(Math.abs((placed?.cast.start ?? 0) - 23400)).toBeLessThan(50);
  });
});

describe("a second landing at a used-up cast's last ms (unlikeByValue)", () => {
  // 9a80 34.94 s: Si's 25.00 s combo's final (349,888) and her 32.51 s combo's first slash (28,396), both non-crits at
  // one ms. ×12 apart, the slash isn't the final on a second enemy: it is the next combo's slot 0, and the 36.10 s
  // 495,353 that combo's final.
  it("is the next cast's first landing, and the next cast's final lands on its slot", () => {
    const fx = fixture("9a80");
    const p = placeHits(data, fx);
    const key = "chr_0036_jsspsi_combo_skill_abilityrange";
    const slash = fx.hits.find((h) => h.t === 34940 && h.event === key && h.value === 28396);
    const placed = p.hits.get(slash as (typeof fx.hits)[number]);
    expect(placed?.sameAs).toBeUndefined();
    expect(placed?.index).toBe(0);
    const { replay } = logBuffReplay(data, fx);
    expect(replay.hits.some((h) => h.operator === "chr_0036_jsspsi" && h.hitId === "final" && Math.abs(h.frame - frameOf(36104)) <= 1)).toBe(true);
  });
});

describe("a slot press whose landings fall where the enemy is away (unseen)", () => {
  // 3aa6 125.65 s: Zhuang Fangyi's battle-skill press in her Empyrean, 0.08 s after Perlica's last hit, then no hit by
  // anyone to 139.57 s. Made as normal_skill_ult, its Sunderblade (made without a hit) is the 145.74 s cast's ninth:
  // the 148.68 s final of 9 blades lands.
  it("is made as the button's variant, and the later final has its ninth blade", () => {
    const { replay } = logBuffReplay(data, fixture("3aa6"));
    const ZF = "chr_0030_zhuangfy";
    expect(replay.skipped.some((s) => s.cast.operator === ZF && Math.abs(s.cast.start - 125650) < 50)).toBe(false);
    const final = replay.hits.find((h) => h.operator === ZF && h.hitId === "final_9" && Math.abs(h.frame - frameOf(148680)) <= 2);
    expect(final).toBeDefined();
  });
});

describe("a cast's slots end with its path (pathEnd)", () => {
  // de6a 132.20 s: Pogranichnik's combo (no logged events in de6a), its three slashes at 132.20, 132.77 and 133.66 s,
  // were joined to the 108.61 s combo: its path-0 slots ran on into the jumped paths' frames 223, 237 and 261 (the
  // combo jumps at frame 0 to 200, 400 or 600 by its count, each path ended by an InterruptCurSkillAction).
  it("places those slashes as a combo of their own, on its first three slots, and the replay lands them", () => {
    const fx = fixture("de6a");
    const P = "chr_0029_pograni";
    const p = placeHits(data, fx);
    const slashes = [...p.hits].filter(([h]) => h.operator === P && h.event === `${P}_combo_skill` && h.t >= 132_000 && h.t < 134_000);
    expect(slashes.length).toBe(3);
    expect(new Set(slashes.map(([, x]) => x.cast)).size).toBe(1);
    expect(Math.round((slashes[0] as [unknown, { cast: { start: number } }])[1].cast.start / 100)).toBe(1314);
    expect(slashes.map(([, x]) => x.index)).toEqual([0, 1, 2]);
    const { replay } = logBuffReplay(data, fx);
    expect(replay.hits.filter((h) => h.operator === P && h.skillId === `${P}_combo_skill` && h.frame >= frameOf(132_000) && h.frame <= frameOf(134_000)).length).toBe(3);
  });
});
