// `efsim zmdlogs screen` and the enemy facts the data lacks (round 22, the Estella-Akekuri report points 1 and 2): the
// "Choosing logs" rules as checks on a candidate's detail (synthetic here: no network, no player data), and a replay
// that stops on a missing enemy fact said at the check's head, with the fact.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import type { GameData } from "@efsim/engine";
import { checkReport, devFixtures, missingEnemyFacts, screenDetail, screenLines } from "@efsim/logs";
import { syntheticDetail } from "./helpers/zmdlogs.ts";

const data = loadGameData();
const BOSS = "eny_0134_jsspsi";

/** A synthetic detail with a roster, a stage and an uploader (the importer's own helper has none of them). */
function candidate(over: { roster?: { op: string; level: number }[]; stage?: string; boss?: string; parser?: string; uploader?: string; ms?: number; targets?: string[] } = {}): unknown {
  const boss = over.boss ?? BOSS;
  const d = syntheticDetail("btl_upload_aaaaaaaaaaaa", boss, [], (over.targets ?? [boss]).map((t, i) => ({ t: 1000 + i, from: "chr_0016_laevat", key: "chr_0016_laevat_attack1", value: 100 })), over.parser ?? "raw-log-parser-v60") as { battle: Record<string, unknown>; timelineEvents: Record<string, unknown>[] };
  (over.targets ?? []).forEach((t, i) => ((d.timelineEvents[i] as Record<string, unknown>)["targetCharacterKey"] = t));
  const roster = (over.roster ?? [{ op: "chr_0016_laevat", level: 90 }]).map((r) => ({ characterKey: r.op, characterLevel: r.level, characterPotential: 0, weapon: { weaponTemplate: "wpn_sword_0006", skills: [{ level: 9 }, { level: 9 }, { level: 9 }] } }));
  return { ...d, battle: { ...d.battle, roster, dungeonContextId: over.stage ?? "dung02_bossrush04_03", durationMs: over.ms ?? 90000, clearFlag: true, uploaderUserId: over.uploader ?? "u1" } };
}

describe("zmdlogs screen (screen.ts screenDetail)", () => {
  it("passes a candidate the rules allow, and says why one fails", () => {
    const ok = screenDetail(data, "btl_upload_aaaaaaaaaaaa", candidate(), { uploads: new Map(), fixture: null });
    expect(ok.verdict).toBe("usable");
    const bad = screenDetail(data, "btl_upload_aaaaaaaaaaaa", candidate({ roster: [{ op: "chr_0016_laevat", level: 80 }, { op: "chr_9999_nobody", level: 90 }], parser: "raw-log-parser-v58", stage: "no_such_stage", targets: [BOSS, "eny_0051_rodin"] }), { uploads: new Map(), fixture: null });
    expect(bad.verdict).toBe("not usable");
    const failed = bad.checks.filter((c) => c.ok === false).map((c) => c.rule);
    expect(failed).toEqual(expect.arrayContaining(["parser", "levels", "kits", "targets", "stage"]));
    expect(screenLines(bad).join("\n")).toMatch(/NO {2}levels +not level 90: Laevatain 80/);
  });

  it("counts the account's other development logs, never naming it; an existing fixture is a no", () => {
    const uploads = new Map([["u1", new Set(["btl_upload_bbbbbbbbbbbb", "btl_upload_cccccccccccc"])]]);
    const row = screenDetail(data, "btl_upload_aaaaaaaaaaaa", candidate(), { uploads, fixture: "/x/fixtures/pending/zmdlogs-aaaaaaaaaaaa.json" });
    const text = screenLines(row).join("\n");
    expect(text).toMatch(/NO {2}account +its account has 2 other cached development log\(s\)/);
    expect(text).not.toMatch(/u1/);
    expect(row.checks.find((c) => c.rule === "fixture")?.ok).toBe(false);
  });

  it("names an enemy the data lacks, and the facts a known one lacks", () => {
    const row = screenDetail(data, "btl_upload_aaaaaaaaaaaa", candidate({ boss: "eny_9999_nowhere" }));
    expect(row.checks.find((c) => c.rule === "enemy")).toMatchObject({ ok: false, text: expect.stringMatching(/isn't in the data/) });
    expect(missingEnemyFacts(data, BOSS)).toEqual([]);
    const noRank: GameData = { ...data, enemies: { ...data.enemies, [BOSS]: { ...(data.enemies[BOSS] as NonNullable<GameData["enemies"][string]>), rank: undefined } as unknown as NonNullable<GameData["enemies"][string]> } };
    expect(missingEnemyFacts(noRank, BOSS)).toEqual([expect.stringMatching(/^no rank/)]);
  });
});

describe("a replay that stops on a missing enemy fact (8f32 before its rank fix)", () => {
  it("is said at the check's head, with what the data lacks", () => {
    const [d] = devFixtures({ ids: ["8f32"] });
    const fx = (d as NonNullable<typeof d>).fx;
    const e = data.enemies[fx.enemy.id] as NonNullable<GameData["enemies"][string]>;
    const { rank: _rank, ...rest } = e;
    const without: GameData = { ...data, enemies: { ...data.enemies, [fx.enemy.id]: rest } };
    const head = checkReport(without, fx, { logBuffs: false, simulate: false }).split("\n").slice(0, 3).join("\n");
    expect(head).toMatch(/^The replay stopped: at \d+\.\d\d s: .*enemyRank.*fix this first\. The enemy eny_0082_hsbear_race007 lacks in the data: no rank/m);
  });
});
