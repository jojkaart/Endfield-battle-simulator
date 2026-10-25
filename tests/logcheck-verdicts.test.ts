// What a log check's verdicts say (2026-10-24, docs/design.md "What a log check verifies"): a match's class,
// readings and assumptions as data; Corrosion as an excuse only where its shred range brackets the damage; buffs
// no kit values as their own verdict; only "the reading doesn't apply" errors taken as such; and what verifies a
// fixture. Shown with a small hand-made change to Laevatain's kit and a synthetic log whose numbers the engine
// computes itself.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeHit, computeStats, corrosionShred, roundDamage, type Build, type GameData, type KitHit, type KitSkill, type Modifier, type OperatorKit } from "@efsim/engine";
import { loadGameData, type LogFixture, type LogHit } from "@efsim/data";
import { checkLog, formatLogCheck, verdictCounts, verificationProblems } from "@efsim/cli";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const panel = computeStats(data, build);
const target = { enemy: "eny_0051_rodin", level: 90 };
const BATTLE = "chr_0016_laevat_normal_skill";
const CORROSION = "buff_common_natural_natural_corrupt_do";

const withKit = (skills: KitSkill[]): GameData => ({ ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, skills } } } });
const hit = (id: string, extra: Partial<KitHit> = {}): KitHit => ({ id, label: id, scale: ["atk_scale"], count: 1, events: ["k"], damageType: "battle", element: "fire", ...extra });
const battle = (hits: KitHit[]): KitSkill => ({ skillId: BATTLE, label: "battle", kind: "battle", hits });
const logHit = (t: number, value: number, extra: Partial<LogHit> = {}): LogHit => ({ t, operator: op, event: "k", value, crit: false, element: "fire", effects: [], boundaryEffects: [], unquantified: [], ...extra });
const fixture = (hits: LogHit[]): LogFixture => ({
  id: "synthetic",
  description: "synthetic log",
  provenance: { source: "test", url: "test", battleId: "test", parserVersion: "test", inGame: true, measured: "test", verifiedAgainst: {}, notes: [] },
  enemy: { id: target.enemy, level: target.level },
  team: [build],
  hits,
});
const h = hit("h");
const g = withKit([battle([h])]);
const damage = (x: KitHit, modifiers: Modifier[] = [], crit: "never" | "always" = "never") =>
  roundDamage(computeHit(g, build, panel, target, { skillId: BATTLE }, x, { crit, staggered: false, conditions: [], modifiers, assumeUnknown: true }).exact);

describe("a match's class, readings and assumptions", () => {
  it("plain: no assumption; assumed: what it takes for granted, as data; every reading is tried and counted", () => {
    const [plain, assumed] = checkLog(g, fixture([logHit(1000, damage(h)), logHit(2000, damage(h, [], "always"), { crit: null })]), { buffs: "log" });
    expect(plain).toMatchObject({ kind: "match", class: "plain", assumed: [], assumptions: [] });
    // Crit unknown: the crit reading matches; the no-crit ones are tried too (and Laevatain's own unlogged buffs and Link around them).
    expect(assumed).toMatchObject({ kind: "match", class: "assumed", assumed: ["crit"], assumptions: [{ kind: "crit", label: "crit" }] });
    if (plain?.kind !== "match" || assumed?.kind !== "match") return;
    expect(plain.readings.matching).toBeGreaterThanOrEqual(1);
    expect(plain.readings.tried).toBeGreaterThanOrEqual(plain.readings.matching);
    expect(assumed.readings.tried).toBeGreaterThan(plain.readings.tried);
  });

  it("the check's report gives plain / assumed / fallback counts and a strength line", () => {
    const fx = fixture([logHit(1000, damage(h)), logHit(2000, damage(h, [], "always"), { crit: null })]);
    const v = checkLog(g, fx, { buffs: "log" });
    expect(verdictCounts(fx, v)[op]).toEqual({ plain: 1, assumed: 1, fallback: 0, mismatch: 0, unvalued: 0, unquantified: 0, uncovered: 0 });
    const text = formatLogCheck(g, fx, v);
    expect(text).toContain("2 match (1 plain, 1 assumed, 0 log-listing fallback)");
    expect(text).toMatch(/strength: readings per match median \d+ tried \(max \d+\), \d+ matching; 0 matched by the only fitting reading of ≥100/);
    expect(text).toContain("Verified:");
  });
});

describe("Corrosion: unmodelled only where its shred range brackets the damage", () => {
  const ai = panel.attrs[87]?.total ?? 0;
  const under = { unquantified: [{ buff: CORROSION, since: 0, source: op }] };
  const at = (shred: number) => damage(h, [{ zone: "ignoreResistance", value: shred, source: "test" }]);

  it("a level matches; between two levels it's unmodelled (reason corrosion); outside every bracket a mismatch", () => {
    const between = (corrosionShred(1, 1000, ai) + corrosionShred(2, 1000, ai)) / 2;
    expect(at(between)).not.toBe(at(corrosionShred(1, 1000, ai)));
    const v = checkLog(g, fixture([logHit(1000, at(corrosionShred(2, 1000, ai)), under), logHit(1000, at(between), under), logHit(1000, Math.round(damage(h) * 0.9), under)]), { buffs: "log" });
    expect(v[0]).toMatchObject({ kind: "match", assumptions: [{ kind: "corrosion", n: 2 }] });
    expect(v[1]).toMatchObject({ kind: "unquantified", reason: "corrosion" });
    // Below the damage with no shred at all: Corrosion can't explain it (until 2026-10-24 this was "unquantified" too).
    expect(v[2]?.kind).toBe("mismatch");
  });

  it("a fixture whose every hit is under Corrosion that fits no level verifies nothing", () => {
    const fx = fixture([logHit(1000, at((corrosionShred(1, 1000, ai) + corrosionShred(2, 1000, ai)) / 2), under)]);
    const v = checkLog(g, fx, { buffs: "log" });
    expect(v.map((x) => x.kind)).toEqual(["unquantified"]);
    expect(verificationProblems(g, fx, v)).toEqual([`Laevatain: no plain or assumed match among 1 judged hits (0 log-listing fallback, 1 unmodelled)`]);
  });
});

describe("buffs the log lists without a value and no kit values", () => {
  it("make a hit no reading fits unvalued, which a verified fixture can't have", () => {
    const fx = fixture([logHit(1000, damage(h)), logHit(2000, Math.round(damage(h) * 1.1), { unquantified: [{ buff: "buff_test_unknown", since: 0, source: op }] })]);
    const v = checkLog(g, fx, { buffs: "log" });
    expect(v[1]).toMatchObject({ kind: "unvalued", buffs: ["buff_test_unknown"] });
    expect(verificationProblems(g, fx, v)).toEqual(["Laevatain t=2000 k: under buff_test_unknown, which no kit values"]);
    expect(formatLogCheck(g, fx, v)).toContain("UNVALUED: 1 hit(s) under buff_test_unknown");
  });
});

describe("errors in a reading", () => {
  it("a hit its situation rules out (HitRuledOut) is a reading that doesn't apply", () => {
    // Undecided without the enemy's state: tried as not happening (computeHit throws HitRuledOut) and as happening.
    const situational = hit("s", { if: { enemyInfliction: "fire" } });
    const v = checkLog(withKit([battle([situational])]), fixture([logHit(1000, damage(situational, []))]), { buffs: "log" });
    expect(v[0]).toMatchObject({ kind: "match", assumed: ["situational parts assumed (the replay can't say: no replay)"] });
  });

  it("any other error propagates instead of reading as \"doesn't apply\"", () => {
    const broken = hit("x", { scale: ["no_such_key"] });
    expect(() => checkLog(withKit([battle([broken])]), fixture([logHit(1000, 1000)]), { buffs: "log" })).toThrow(/no value no_such_key/);
  });
});
