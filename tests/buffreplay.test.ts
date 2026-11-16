// The log check's kit-buff replay (2026-10-22, packages/cli/src/buffreplay.ts):
// the logged casts are cast again on the timeline and the kits' triggers
// decide which kit buffs are on at each logged hit, not the log's listing.
// Shown with a small hand-made change to Laevatain's kit and a synthetic log
// whose numbers the engine computes itself, and on 4e5e1390085e, where the
// log stops listing Camille's weapon buffs.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, computeHit, computeStats, createContext, effectiveKit, FPS, init, parseReactionEvent, replayCast, replayWindowCount, roundDamage, type ActiveBuff, type Build, type GameData, type KitBuff, type KitHit, type KitSkill, type KitTrigger, type Modifier, type OperatorKit, type TimelineState } from "@efsim/engine";
import { loadGameData, type LogEffect, type LogFixture, type LogHit } from "@efsim/data";
import { castsFromBuffLanes, checkLog, controlledFromLog, formatBuffReplay, LOG_LISTING, logBuffReplay, loggedRecoveries, readLogFixture, replayedCasts, withLoggedCasts, type HitVerdict } from "@efsim/cli";
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
  const dmg = (skillId: string, x: KitHit, modifiers: Modifier[]) => roundDamage(computeHit(g, build, panel, target, { skillId }, x, { crit: "never", staggered: false, modifiers }).exact);
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
    expect(v[3]?.kind === "match" && v[3].class).toBe("fallback");
    expect(v[3]?.kind === "match" && v[3].assumed.some((a) => a.startsWith(`${LOG_LISTING} (no engine reading fits`) && a.endsWith(`replay: ${GAME_BUFF})`))).toBe(true);
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

  it("gives the buffs a cast uses up to every hit of the cast, however late the log lands it (2026-11-14)", () => {
    // 0eef2474a26f / bdf223db8e49: Si's combo final logged 10 and 1 frames past its planned frame lost Jade Vessel's DMG
    // and Yinglung's Edge, which ended at the planned last hit + 1 (bdf: 287,297 logged, with them exactly).
    const ready: ActiveBuff = { id: "ready", owner: op, target: "self", appliedAt: 0, expiresAt: Infinity, consumedBy: ["battle"], modifiers: [{ zone: "amp", value: 0.5, source: "ready" }] };
    // A Link stack (its expiry frame) too.
    const st: TimelineState = { ...init(ctx), buffs: [ready], link: [1000] };
    const r = advance(ctx, replayCast(ctx, st, op, BATTLE, 30, { landings: [{ hitId: "h2", nth: 0, frame: 120 }] }), 200);
    const late = r.hits.find((x) => x.hitId === "h2");
    expect(late?.frame).toBe(120);
    expect(late?.modifiers.filter((m) => m.source === "ready" || m.source.startsWith("Link")).map((m) => m.source).sort()).toEqual(["Link (1)", "ready"]);
    // Used up, they end on the frame after the cast's last hit has landed.
    expect(r.buffs.filter((b) => b.cast !== undefined)).toEqual([]);
    expect(advance(ctx, replayCast(ctx, st, op, BATTLE, 30, { landings: [{ hitId: "h2", nth: 0, frame: 120 }] }), 120).buffs.filter((b) => b.cast !== undefined).map((b) => [b.id, b.expiresAt])).toEqual([["link", 121], ["ready", 121]]);
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
    // With it the engine matches her hits until Gilberta's ultimate (12951 ms), after which the replay has a Corrosion the
    // log doesn't list (a lead: the replay's inflictions aren't checked against the log's reactions).
    // (Her Heat bursts the replay doesn't deal near their logged times fall back too: the status side's lead.)
    const laevatain = checkLog(data, fx).filter((v) => v.hit.operator === "chr_0016_laevat" && v.hit.t < 12951 && !parseReactionEvent(v.hit.event));
    expect(laevatain.filter((v) => v.kind === "match" && v.class === "fallback")).toEqual([]);
    // Without the cast events (as imported before 2026-10-25), the buff's own lane gives the cast (castsFromBuffLanes):
    // a frame before buff_wpn_sword_0006_valid first shows, 3.6 s after the logged cast.
    const { casts: _c, ...without } = fx;
    const inferred = castsFromBuffLanes(data, without, fx.team.map((b) => effectiveKit(data, b) as OperatorKit), replayedCasts(placement, without));
    expect(inferred.filter((c) => c.skillId === "chr_0016_laevat_ultimate_skill").map((c) => Math.round(c.start))).toEqual([Math.round(6657 - 1000 / FPS)]);
    expect(checkLog(data, without).filter((v) => v.hit.operator === "chr_0016_laevat" && v.hit.t < 12951 && !parseReactionEvent(v.hit.event) && v.kind === "match" && v.class === "fallback")).toEqual([]);
  });
});

describe("dbaee23b801d: a cast the log shows only by the buff it applies", () => {
  const fx = readLogFixture(new URL("../fixtures/zmdlogs-dbaee23b801d.json", import.meta.url).pathname);

  it("casts Xaihi's ultimate (no damage) a frame before her weapon's team ATK first shows in the log", () => {
    const placement = placeHits(data, fx);
    const kits = fx.team.map((b) => effectiveKit(data, b) as OperatorKit);
    const base = replayedCasts(placement, fx);
    const casts = castsFromBuffLanes(data, fx, kits, base);
    const first = Math.min(...fx.hits.filter((h) => h.effects.some((e) => e.buff === "buff_wpn_funnel_0005_atk_up")).map((h) => h.t));
    expect(casts.filter((c) => !base.includes(c) && c.skillId === "chr_0011_seraph_ultimate_skill").map((c) => Math.round(c.start))).toEqual([Math.round(first - 1000 / FPS)]);
    expect(base.some((c) => c.skillId === "chr_0011_seraph_ultimate_skill")).toBe(false);
    // Liino's hits under it now match by the replay's buffs, not the log's listing.
    const liino = checkLog(data, fx).filter((v) => v.hit.operator === "chr_0035_liino" && v.kind === "match");
    expect(liino.filter((v) => v.kind === "match" && v.class !== "fallback").length).toBeGreaterThan(20);
  });

  it("keeps Xaihi's logged ultimate (7606 ms) through her attack 1 placed inside its cantCastSkill channel: its Amp reaches her later hits", () => {
    const r = logBuffReplay(data, fx);
    const amped = (t: number) => {
      const l = r.replay.landing(fx.hits.find((h) => h.operator === "chr_0011_seraph" && h.t === t) as LogHit);
      if ("unknown" in l || l.inputs?.kind !== "hit") throw new Error(`no landing at ${t}`);
      return (l.inputs.options.modifiers ?? []).some((m) => m.kitBuff?.id === "stack_overflow");
    };
    // Frame 58 of the ultimate (the 1.5 s time stop doesn't hold its caster) is after the first hit, before the second.
    expect([amped(8391), amped(10692)]).toEqual([false, true]);
  });

  it("joins each Power Shot burst to its arrow, across time stops, and so makes Arcane's Nature burst at 10341 ms", () => {
    const T = "chr_0034_typhoea";
    const placement = placeHits(data, fx);
    // Seven arrows, seven bursts (0.26 s to 2.5 s after their arrows: 5890 → 8391 across Liino's ultimate): one shot cast each.
    const shots = replayedCasts(placement, fx).filter((c) => c.operator === T && /floating_attack\d$/.test(c.skillId));
    expect(shots).toHaveLength(7);
    expect(shots.every((c) => c.landings.some((l) => l.hitId === "burst") && c.landings.some((l) => l.hitId === "power_shot"))).toBe(true);
    // The burst at 8391 ms is the 5890 ms arrow's, not a shot of its own using up the stack Arcane's battle skill left at
    // 8258 ms: her touch at 8501 ms meets that stack and bursts (her weapon's will_atk follows); the 8613 ms arrow uses
    // up the touch's.
    const r = logBuffReplay(data, fx).replay;
    const burst = fx.hits.find((h) => h.operator === "chr_0032_lizhiyan" && h.event === "buff_common_natural_natural_triggered") as LogHit;
    expect("unknown" in r.statusLanding(burst)).toBe(false);
    const frame = (ms: number) => Math.round((ms * FPS) / 1000);
    const used = r.reactions.filter((x) => x.kind === "consumed" && x.operator === T).map((x) => x.frame);
    expect(used.filter((f) => f >= frame(8258) && f <= frame(8501))).toEqual([]);
    expect(used).toContain(frame(8613));
  });

  it("makes a logged shot the off-field chain's own next shot, not one more (her kit's 22 frames, the log's 24)", () => {
    const T = "chr_0034_typhoea";
    const r = logBuffReplay(data, fx).replay;
    // Every power shot and burst the replay lands is a logged one.
    expect(r.hits.filter((h) => h.operator === T && (h.hitId === "power_shot" || h.hitId === "burst") && h.ref === undefined).map((h) => h.frame)).toEqual([]);
  });
});

describe("4e5e1390085e: who the log shows controlled, and the enemy's own Stagger recovery", () => {
  const fx = readLogFixture(new URL("../fixtures/zmdlogs-4e5e1390085e.json", import.meta.url).pathname);
  const R = "chr_0028_wulfa";

  it("takes the controlled operator from the basic hits with Stagger: the others' basic casts are teammates' own", () => {
    const placement = placeHits(data, fx);
    const control = controlledFromLog(placement, replayedCasts(placement, fx));
    // Rossi's Final Strikes deal Stagger (8.6, 16.2, 23.4 s); Camille's attack 5 at 14.5 s and Gilberta's attack 4 don't.
    expect(control?.first).toBe(R);
    const basics = (control?.casts ?? []).filter((c) => c.kind === "basic");
    expect(new Set(basics.filter((c) => !c.teammate).map((c) => c.operator))).toEqual(new Set([R]));
    expect(basics.some((c) => c.operator === "chr_0033_camille" && c.skillId.endsWith("attack5") && c.teammate)).toBe(true);
  });

  it("refills the bar where the log's jumps back to full: Rhodagn's own recovery at 29.5 s, not a Stagger's end", () => {
    expect(loggedRecoveries(fx)).toContain(29524);
    const r = logBuffReplay(data, fx).replay;
    // The replay's only Stagger is the log's last one (66.6 s); before, it Staggered at 29.5 s, where the log's bar refilled.
    expect(r.staggers.every((f) => f * (1000 / FPS) > 60_000)).toBe(true);
  });
});

describe("7e19489ae503: a recovery cuts a Stagger short", () => {
  it("ends the replay's Stagger where the log's bar is full again (33.2 s, the log's Stagger 29.8–33.2 s)", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-7e19489ae503.json", import.meta.url).pathname);
    const t = loggedRecoveries(fx).find((x) => x > 30_000 && x < 34_000);
    expect(t).toBeDefined();
    const r = logBuffReplay(data, fx).replay;
    const at = (ms: number) => r.staggerNearChange(ms);
    expect(at(t as number)).toBe(true);
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

describe("3aa6ab93bad4: a press the log shows as a variant by its own keys", () => {
  it("replays Zhuang Fangyi's battle-skill presses during her ultimate (logged as normal_skill) as normal_skill_ult", () => {
    const fx = readLogFixture(new URL("../fixtures/pending/zmdlogs-3aa6ab93bad4.json", import.meta.url).pathname);
    const Z = "chr_0030_zhuangfy";
    const kits = fx.team.map((b) => effectiveKit(data, b) as OperatorKit);
    const casts = withLoggedCasts(replayedCasts(placeHits(data, fx), fx), fx, kits);
    // The press at 19639 ms: placed from its own hits since the placement follows her strike variants (before, they went
    // to the cast before it and the press was made from its variant's keys, `shows`).
    expect(casts.some((c) => c.operator === Z && c.skillId === `${Z}_normal_skill_ult` && Math.abs(c.start - 19639) <= 2500 && c.landings.length > 0)).toBe(true);
    // Every logged hit of the variant lands now but those of the first seconds of a press the placement merged.
    const r = logBuffReplay(data, fx).replay;
    const ult = fx.hits.filter((h) => h.operator === Z && h.event === `${Z}_normal_skill_ult_abilityrange` && h.t > 19639 && h.t < 22000);
    expect(ult.length).toBeGreaterThan(0);
    expect(ult.every((h) => !("unknown" in r.landing(h)))).toBe(true);
  });
});

// Typhoeus's shots and hover (fixtures): tests/buffreplay-typhoeus.test.ts. Camille's weapon buffs, simulateLog and
// the later fixture cases: tests/buffreplay-fixtures.test.ts. (Split 2026-11-16 so the default suite's workers balance.)
