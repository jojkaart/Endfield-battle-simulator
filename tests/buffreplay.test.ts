// The log check's kit-buff replay (2026-10-22, packages/cli/src/buffreplay.ts):
// the logged casts are cast again on the timeline and the kits' triggers
// decide which kit buffs are on at each logged hit, not the log's listing.
// Shown with a small hand-made change to Laevatain's kit and a synthetic log
// whose numbers the engine computes itself, and on 4e5e1390085e, where the
// log stops listing Camille's weapon buffs.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, computeHit, computeStats, createContext, FPS, init, replayCast, replayWindowCount, roundDamage, type Build, type GameData, type KitBuff, type KitHit, type KitSkill, type KitTrigger, type Modifier, type OperatorKit, type TimelineState } from "@efsim/engine";
import { loadGameData, type LogEffect, type LogFixture, type LogHit } from "@efsim/data";
import { checkLog, formatBuffReplay, LOG_LISTING, logBuffReplay, readLogFixture, replayedCasts, withLoggedCasts, type HitVerdict } from "@efsim/cli";
import { placeHits } from "../packages/cli/src/logcasts.ts";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const panel = computeStats(data, build);
const target = { enemy: "eny_0051_rodin", level: 90 };
const BATTLE = "chr_0016_laevat_normal_skill";
const BASIC = "chr_0016_laevat_attack1";
const GAME_BUFF = "buff_test_atk";

const withKit = (k: { skills: KitSkill[]; buffs?: KitBuff[]; triggers?: KitTrigger[] }): GameData => ({
  ...data,
  kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, skills: k.skills, buffs: [...kit.buffs, ...(k.buffs ?? [])], triggers: [...kit.triggers, ...(k.triggers ?? [])] } } },
});
const hit = (id: string, events: string[], extra: Partial<KitHit> = {}): KitHit => ({ id, label: id, scale: ["atk_scale"], count: 1, events, damageType: "battle", element: "fire", frames: [0], ...extra });
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
const atk: LogEffect = { buff: GAME_BUFF, zone: "atk", element: null, value: 0.1 };
const kind = (v: HitVerdict | undefined) => v?.kind ?? "none";

describe("kit buffs from the replay of the logged casts", () => {
  const h = hit("h", ["k"]);
  const b = hit("b", ["b"], { damageType: "basic" });
  const basic: KitSkill = { skillId: BASIC, label: "basic", kind: "basic", hits: [b] };
  // Team ATK +10% for 10 s on each battle-skill cast, standing for a game buff the log lists.
  const buff: KitBuff = { id: "t_atk", label: "test ATK", target: "team", gameBuff: GAME_BUFF, duration: 10, modifiers: [{ zone: "atk", value: 0.1 }] };
  const onCast: KitTrigger = { id: "t_on_cast", on: { event: "cast", skills: [BATTLE] }, by: "self", do: [{ kind: "buff", buff: "t_atk" }] };
  const g = withKit({ skills: [battle([h]), basic], buffs: [buff], triggers: [onCast] });
  const dmg = (skillId: string, x: KitHit, modifiers: Modifier[]) => roundDamage(computeHit(g, build, panel, target, { skillId }, x, { crit: "never", staggered: false, conditions: [], modifiers }).exact);
  const plus10: Modifier[] = [{ zone: "atk", value: 0.1, source: "test" }];
  const buffed = dmg(BATTLE, h, plus10);
  const plain = dmg(BASIC, b, []);
  // Battle skills at 1, 8 and 15 s: the second and third refresh the buff (to 25 s), but the log lists it only to 11 s (refreshes
  // it didn't record); and it lists it at a basic attack at 30 s, where nothing applied it (5 s after it ran out).
  const fx = fixture([
    logHit(1000, buffed, { boundaryEffects: [atk] }),
    logHit(8000, buffed, { effects: [atk] }),
    logHit(15000, buffed),
    logHit(30000, plain, { event: "b", effects: [atk] }),
  ]);

  it("keeps a buff the log stops listing on where its trigger refreshed it, and off where nothing applied it", () => {
    expect(dmg(BASIC, b, plus10)).toBeGreaterThan(plain);
    const v = checkLog(g, fx);
    expect(v.map(kind)).toEqual(["match", "match", "match", "match"]);
    expect(v.flatMap((x) => (x.kind === "match" ? x.assumed : [])).filter((a) => a.startsWith(LOG_LISTING))).toEqual([]);
    // The log's own listing (the check before 2026-10-22, `zmdlogs check --log-buffs`) misses both.
    expect(checkLog(g, fx, { buffs: "log" }).map(kind)).toEqual(["match", "match", "mismatch", "mismatch"]);
  });

  it("decides only away from its own changes: a start at a logged landing, an expiry with slack for the instance's life", () => {
    const r = logBuffReplay(g, fx);
    expect([...r.replay.decided.keys()]).toEqual([GAME_BUFF]);
    // At the cast that applies it the log's listing stands; at 15 s (a refresh) it's on, at 30 s off; near its end at 25 s
    // (0.5 s + 10% of its 10 s life either side), undecided.
    expect(fx.hits.map((x) => r.replay.instances(x, GAME_BUFF))).toEqual([null, 1, 1, 0]);
    expect([23400, 23600, 26400, 26600].map((t) => r.replay.instances({ t, operator: op }, GAME_BUFF))).toEqual([1, null, null, 0]);
  });

  it("reports where the replay and the log disagree, with times", () => {
    const r = logBuffReplay(g, fx);
    expect(r.runs).toEqual([
      { buff: GAME_BUFF, operator: op, on: "replay", from: 15000, to: 15000, hits: 1 },
      { buff: GAME_BUFF, operator: op, on: "log", from: 30000, to: 30000, hits: 1 },
    ]);
    const text = formatBuffReplay(g, r).join("\n");
    expect(text).toContain(`${GAME_BUFF} on Laevatain: replay on, log doesn't list it, 1 hit(s) at 15.0 s`);
    expect(text).toContain(`${GAME_BUFF} on Laevatain: log lists it, replay off, 1 hit(s) at 30.0 s`);
  });

  it("falls back on the log's listing where the replay's reading fits nothing, and says so", () => {
    // The log is right at 30 s this time (the damage has the buff): the replay's trigger missed something.
    const fx2 = fixture([...fx.hits.slice(0, 3), logHit(30000, dmg(BASIC, b, plus10), { event: "b", effects: [atk] })]);
    const r = logBuffReplay(g, fx2);
    const v = checkLog(g, fx2, { replay: r });
    expect(v.map(kind)).toEqual(["match", "match", "match", "match"]);
    expect(v[3]?.kind === "match" && v[3].assumed).toContain(`${LOG_LISTING} (replay: ${GAME_BUFF})`);
    expect(formatBuffReplay(g, r, v).join("\n")).toContain("log lists it, replay off, 1 hit(s) at 30.0 s (fit the replay 0, the log 1, neither 0)");
  });

  it("counts a disputed hit under effects it can't value as fitting neither (not only mismatches; 2026-10-24)", () => {
    const unknown = { buff: "buff_test_unknown", since: 0, source: op };
    const fx3 = fixture([...fx.hits.slice(0, 3), logHit(30000, Math.round(plain * 1.3), { event: "b", effects: [atk], unquantified: [unknown] })]);
    const r = logBuffReplay(g, fx3);
    const v = checkLog(g, fx3, { replay: r });
    expect(v[3]?.kind).toBe("unvalued");
    expect(formatBuffReplay(g, r, v).join("\n")).toContain("log lists it, replay off, 1 hit(s) at 30.0 s (fit the replay 0, the log 0, neither 1)");
  });

  it("decides a buff a trigger on crits applies from the log's crits, and not where a landing's crit isn't logged", () => {
    const onCrit: KitTrigger = { id: "t_on_crit", on: { event: "hit", crit: true }, by: "self", do: [{ kind: "buff", buff: "t_atk" }] };
    const g2 = withKit({ skills: [battle([h]), basic], buffs: [buff], triggers: [onCrit] });
    // A crit at 1 s applies it (after its own damage) to 11 s; the hits at 4 s and 8 s are under it, the one at 15 s isn't.
    const crits = (first: boolean | null) => fixture([logHit(1000, 1, { crit: first }), logHit(4000, dmg(BATTLE, h, plus10), { effects: [atk] }), logHit(8000, dmg(BATTLE, h, plus10), { effects: [atk] }), logHit(15000, 1)]);
    const r = logBuffReplay(g2, crits(true));
    expect([...r.replay.decided.keys()]).toEqual([GAME_BUFF]);
    expect(crits(true).hits.map((x) => r.replay.instances(x, GAME_BUFF))).toEqual([null, 1, 1, 0]);
    // Its crit not logged: a crit or not there changes the buff (the replay with such landings critting disagrees), undecided.
    const unknown = logBuffReplay(g2, crits(null));
    expect(crits(null).hits.map((x) => unknown.replay.instances(x, GAME_BUFF))).toEqual([null, null, null, 0]);
  });
});

describe("replayCast: a logged cast at its logged frame", () => {
  // Laevatain's battle skill jumps from frame 37 (SkillData): both hits come before.
  const h1 = hit("h1", ["k"], { frames: [10] });
  const h2 = hit("h2", ["k2"], { frames: [20] });
  const g = withKit({ skills: [battle([h1, h2])] });
  const ctx = createContext(g, { team: [build], target, durationFrames: 10 * FPS, rotation: [], options: { crit: "never" } });
  const landed = (st: TimelineState) => st.hits.filter((x) => x.skillId === BATTLE).map((x) => [x.hitId, x.frame]);

  it("lands a logged landing at its logged frame instead of the kit's", () => {
    expect(landed(advance(ctx, replayCast(ctx, init(ctx), op, BATTLE, 30, { landings: [{ hitId: "h1", nth: 0, frame: 45 }] }), 200))).toEqual([["h1", 45], ["h2", 50]]);
  });

  it("cuts the operator's previous cast short, unless the log shows its hits after the new one started", () => {
    const twice = (keepPrevious: boolean) => landed(advance(ctx, replayCast(ctx, replayCast(ctx, init(ctx), op, BATTLE, 0), op, BATTLE, 15, { keepPrevious }), 200));
    expect(twice(false)).toEqual([["h1", 10], ["h1", 25], ["h2", 35]]);
    expect(twice(true)).toEqual([["h1", 10], ["h2", 20], ["h1", 25], ["h2", 35]]);
  });

  it("keeps a pinned landing at its logged frame across the skill's jumps, a detached one's launch with it", () => {
    // Frames 100 and 230 are past the jump at 37 (to 215): unpinned, the first is skipped and the second (a projectile
    // launched at 230) comes 178 frames sooner. The log's frames have the jump in already (4e5e1390085e: Rossi's wolves).
    const late = hit("late", ["k3"], { frames: [100] });
    const wolf = hit("wolf", ["k4"], { frames: [230], launch: 230 });
    const g2 = withKit({ skills: [battle([h1, late, wolf])] });
    const ctx2 = createContext(g2, { team: [build], target, durationFrames: 10 * FPS, rotation: [], options: { crit: "never" } });
    const run = (landings: { hitId: string; nth: number; frame: number; ref?: string }[]) => advance(ctx2, replayCast(ctx2, init(ctx2), op, BATTLE, 0, { landings }), 250);
    expect(landed(run([]))).toEqual([["h1", 10], ["wolf", 52]]);
    const st = run([{ hitId: "late", nth: 0, frame: 60, ref: "a" }, { hitId: "wolf", nth: 0, frame: 120, ref: "b" }]);
    expect(landed(st)).toEqual([["h1", 10], ["late", 60], ["wolf", 120]]);
    // A landing with a reference carries it, with what its values read (LandingFacts).
    const wolfHit = st.hits.find((x) => x.hitId === "wolf");
    expect([wolfHit?.ref, wolfHit?.facts?.castLink, wolfHit?.facts?.consumed]).toEqual(["b", 0, 0]);
    expect(st.hits.find((x) => x.hitId === "h1")?.ref).toBeUndefined();
  });

  it("tells whether a replayed combo finds its window open, and its count (replayWindowCount)", () => {
    const combo = kit.skills.find((s) => s.kind === "combo")?.skillId as string;
    const full = createContext(data, { team: [build], target, durationFrames: 10 * FPS, rotation: [], options: { crit: "never" } });
    const st = init(full);
    const open = { ...st, comboWindow: { [op]: { from: 0, until: 100, count: 3 } } };
    expect(replayWindowCount(full, st, op, combo, 0)).toBeNull();
    expect(replayWindowCount(full, open, op, combo, 50)).toBe(3);
    expect(replayWindowCount(full, open, op, combo, 150)).toBeNull();
    expect(replayWindowCount(full, open, op, BATTLE, 50)).toBeNull();
  });
});

describe("40d9a3c1da37: a cast the log shows only as a skill event", () => {
  const fx = readLogFixture(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url).pathname);

  it("casts Laevatain's ultimate at the log's 3041 ms, so its weapon's buff is on for her enhanced attacks", () => {
    const placement = placeHits(data, fx);
    const casts = withLoggedCasts(replayedCasts(placement, fx), fx, [data.kits.operators["chr_0016_laevat"] as OperatorKit]);
    expect(casts.filter((c) => c.skillId === "chr_0016_laevat_ultimate_skill").map((c) => c.start)).toEqual([3041]);
    // Si's casts the log also records are placed from their hits already: not cast twice.
    expect(casts.filter((c) => c.skillId === "chr_0036_jsspsi_normal_skill").length).toBe(replayedCasts(placement, fx).filter((c) => c.skillId === "chr_0036_jsspsi_normal_skill").length);
    const laevatain = checkLog(data, fx).filter((v) => v.hit.operator === "chr_0016_laevat");
    expect(laevatain.filter((v) => v.kind === "match" && v.class === "fallback")).toEqual([]);
    // Without the cast events (as imported before 2026-10-25), the replay never starts buff_wpn_sword_0006_valid.
    const { casts: _c, ...without } = fx;
    expect(checkLog(data, without).filter((v) => v.hit.operator === "chr_0016_laevat" && v.kind === "match" && v.class === "fallback").length).toBeGreaterThan(5);
  });
});

describe("0eef2474a26f: what the replay can't know, and landings a trigger makes", () => {
  const fx = readLogFixture(new URL("../fixtures/zmdlogs-0eef2474a26f.json", import.meta.url).pathname);
  const r = logBuffReplay(data, fx);

  it("leaves a buff on heals of the controlled operator to the log (who's controlled isn't logged)", () => {
    // Liino's weapon buff goes to whom her combo heals: Typhoeus and Si in the log, Arcane in the replay.
    expect(r.replay.decided.has("buff_wpn_lance_0014_damageup")).toBe(false);
    expect(r.replay.undecided.get("buff_wpn_lance_0014_damageup")).toContain("controlled operator");
  });

  it("takes a trigger's landing within NEAR_FRAMES for a logged hit (Liino's volley at 4187 ms: the replay's Corrosion there)", () => {
    const volley = fx.hits.filter((h) => h.event === "chr_0035_liino_normal_skill_projhit_hit");
    const landings = volley.map((h) => r.replay.landing(h));
    expect(landings.every((l) => !("unknown" in l) && l.hitId === "volley")).toBe(true);
    expect(new Set(landings).size).toBe(volley.length);
  });
});

describe("bdf223db8e49: Corrosion from the replay's landings", () => {
  it("reads hits under Corrosion at the engine's level and shred where the replay landed them (levels tried only elsewhere)", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-bdf223db8e49.json", import.meta.url).pathname);
    const under = checkLog(data, fx).filter((v) => v.hit.unquantified.some((u) => u.buff.startsWith("buff_common_natural")));
    const matched = under.filter((v): v is Extract<HitVerdict, { kind: "match" }> => v.kind === "match");
    const tried = matched.filter((v) => v.assumptions.some((a) => a.kind === "corrosion"));
    expect(matched.length).toBeGreaterThan(60);
    expect(tried.length).toBeLessThanOrEqual(3);
    expect(tried.every((v) => v.assumed.some((a) => a.includes("the replay can't say")))).toBe(true);
  });
});

describe("4e5e1390085e: Camille's weapon buffs after the log stops listing them", () => {
  const fx = readLogFixture(new URL("../fixtures/zmdlogs-4e5e1390085e.json", import.meta.url).pathname);
  const r = logBuffReplay(data, fx);

  it("gives Rossi's MI Security layers (on her logged crits) where the log lists one, and counts layers that push each other out", () => {
    const at = (t: number) => fx.hits.find((x) => x.t === t && x.operator === "chr_0028_wulfa" && x.event === "chr_0028_wulfa_attack4") as LogHit;
    // 15015 ms: five layers on one timer (the oldest pushed out by each new one: an instance ends at the newest layer's start).
    expect(r.replay.instances(at(15015), "buff_equipsuit_critsuitatk_01")).toBe(5);
    expect(r.replayed.layersAt.get(at(15015))?.get("buff_equipsuit_critsuitatk_01")).toBe(5);
    const v = checkLog(data, fx, { replay: r }).find((x) => x.hit === at(15015));
    expect(v?.kind === "match" && v.assumed.some((a) => a.includes("critsuitatk"))).toBe(false);
  });

  it("has both on to the end by Camille's casts, and reports the log's gaps", () => {
    const late = fx.hits.filter((x) => x.t > 66000);
    expect(late.every((x) => r.replay.instances(x, "buff_wpn_lance_0015_atkup") !== 0 && r.replay.instances(x, "buff_wpn_lance_0015_dmgup") !== 0)).toBe(true);
    const gaps = r.runs.filter((x) => x.on === "replay" && x.buff.startsWith("buff_wpn_lance_0015_") && x.operator === "chr_0028_wulfa");
    expect(gaps.find((x) => x.buff === "buff_wpn_lance_0015_atkup")?.from).toBeGreaterThan(49418);
    expect(gaps.find((x) => x.buff === "buff_wpn_lance_0015_dmgup")?.from).toBeGreaterThanOrEqual(65597);
  });

  it("matches Rossi's hits under them without a hand annotation (all but the killing blow)", () => {
    const rossi = checkLog(data, fx, { replay: r }).filter((v) => v.hit.operator === "chr_0028_wulfa");
    expect(rossi.filter((v) => v.kind === "match").length).toBe(161);
    expect(rossi.filter((v) => v.kind !== "match").map((v) => [v.hit.t, v.kind])).toEqual([[69142, "unquantified"]]);
    // …by the replay's buffs, not the log's listing.
    expect(rossi.filter((v) => v.kind === "match" && v.hit.t > 65500 && v.assumed.some((a) => a.startsWith(LOG_LISTING)))).toEqual([]);
  });
});
