// The replay's unlogged tails (engine assumption unlogged-tails `cut`: packages/logs replayrun.ts tailCuts): a cast
// whose landings after its last logged one are none of them in the log, the enemy there, ends after it.
// pending/zmdlogs-0c14fb3ce77d.json: Rossi's battle skill at 35.40 s lands its two charge hits (35.94, 36.06 s) and
// then neither her Lift (frame 35) nor the wolves and their bleed; her 52.04 s battle skill, with no Vulnerable stack
// left, takes no follow-up (its Lift's hit logged at 53.55 s, no Lift status, no wolves), so it isn't cut.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const fx = (devFixtures({ ids: ["0c14"] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx;
const ROSSI = "chr_0028_wulfa";
const SKILL = `${ROSSI}_normal_skill`;

describe("unlogged tails (0c14's Rossi)", () => {
  const { replay } = logBuffReplay(data, fx);
  it("cuts her 35.40 s battle skill after its last logged landing, and only casts the rule names", () => {
    // Her basic attacks' tails are cut too (`cut-all`); of her skills, only this one.
    const rossi = replay.tailCuts.filter((x) => x.cast.operator === ROSSI && x.cast.kind !== "basic");
    expect(rossi.map((x) => [x.cast.skillId, Math.round(x.cast.start / 10) * 10])).toEqual([[SKILL, 35400]]);
    const last = Math.max(...(rossi[0]?.cast.landings ?? []).map((l) => l.frame));
    expect(rossi[0]?.frame).toBe(last);
  });

  // c83c75d02a85: Si's combo final at 56.73 s comes a frame after her last logged slash (56.70 s); an end at the frame
  // after that slash ran after the frame's hits (schedule.ts IN_FRAME) and let the final land (374k, 5.0% of the fight).
  it("cuts a tail landing the frame after the last logged one (c83c's Si combo final)", () => {
    const c83c = (devFixtures({ ids: ["c83c"] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx;
    const r = logBuffReplay(data, c83c).replay;
    const finals = r.hits.filter((h) => h.operator === "chr_0036_jsspsi" && h.skillId === "chr_0036_jsspsi_combo_skill" && h.hitId === "final" && h.frame >= 1695 && h.frame <= 1710);
    expect(finals).toEqual([]);
  });

  // Round 18 (the replay-only report point 3): a guard that keeps a tail says so (TAILKEPT), as a cut does (TAILCUT).
  it("records the tails its guards kept, with the guard (TAILKEPT)", () => {
    const kept = replay.tailsKept;
    expect(kept.length).toBeGreaterThan(0);
    for (const k of kept) {
      expect(replay.tailCuts.some((c) => c.cast === k.cast)).toBe(false);
      expect(k.why).toMatch(/logged hit|away stretch|last hit|another cast's|new run of|lost the landing/);
    }
    // Under `kept` the cut's rule doesn't run: no guard to report.
    expect(logBuffReplay(data, fx, undefined, { assume: { "unlogged-tails": "kept" } }).replay.tailsKept).toEqual([]);
  });

  // Round 20 (three reports: twins point 1, Liino point 4, the backlog's tail-own-landing diff): the "logged hit no other
  // cast holds" guard kept 6339's 21.60 s Laevatain tail on the cast's own killing hit at 20.37 s, logged 0.3 ms into
  // its frame. Round 21: the cast's own landings are no evidence; the tail is cut (its 105,356 hit_2 no log line has).
  it("takes none of the cast's own landings for the log showing its tail (6339's Laevatain at 21.60 s)", () => {
    const f6339 = (devFixtures({ ids: ["6339"] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx;
    const r = logBuffReplay(data, f6339).replay;
    const at = (frame: number) => Math.abs(frame * (1000 / 30) - 20370) < 50;
    expect(r.tailCuts.some((x) => x.cast.operator === "chr_0016_laevat" && x.cast.skillId === "chr_0016_laevat_power_attack" && at(x.frame))).toBe(true);
    expect(r.hits.filter((h) => h.operator === "chr_0016_laevat" && h.skillId === "chr_0016_laevat_power_attack" && Math.abs(h.frame * (1000 / 30) - 21600) < 50)).toEqual([]);
    for (const k of replay.tailsKept) expect(k.guard).toMatch(/^(variant|fight-end|away|no-enemy|landed|status|shown-free|effect|needed|rounds)$/);
  });

  // Round 21: a tail is kept where the log shows what it set off. c4f3: Pogranichnik's battle skill at 108.08 s, its
  // hit_2 at 109.33 s the Breach the log has at 109.01 s (`status`); 9847: Liino's battle skill at 75.44 s, the volley
  // timer it opens at its frame 45, after its last logged projectile: cut, the replay loses the volley logged at 78.36 s
  // (`needed`).
  it("keeps a tail whose status or later landings the log has (c4f3's Pogranichnik, 9847's Liino)", () => {
    const one = (id: string) => logBuffReplay(data, (devFixtures({ ids: [id] })[0] as { fx: Parameters<typeof logBuffReplay>[1] }).fx).replay;
    const pog = one("c4f3").tailsKept.find((x) => x.cast.skillId === "chr_0029_pograni_normal_skill" && Math.abs(x.cast.start - 108080) < 50);
    expect(pog?.guard).toBe("status");
    expect(pog?.cites?.hit.event).toBe("buff_physical_do_fracture");
    const liino = one("9847");
    const stance = liino.tailsKept.find((x) => x.cast.skillId === "chr_0035_liino_normal_skill" && Math.abs(x.cast.start - 75440) < 50);
    expect(stance?.guard).toBe("needed");
    expect(stance?.cites?.hit.event).toBe("chr_0035_liino_normal_skill_projhit_hit");
    expect(liino.tailCuts.some((x) => x.cast.skillId === "chr_0035_liino_normal_skill" && Math.abs(x.cast.start - 75440) < 50)).toBe(false);
  });

  it("lands none of its Lift, wolves or bleed; under `kept` they come back", () => {
    const tail = (hits: typeof replay.hits) => hits.filter((h) => h.operator === ROSSI && h.skillId === SKILL && h.frame >= 1095 && h.frame <= 1120);
    expect(tail(replay.hits).map((h) => h.hitId)).toEqual([]);
    const kept = logBuffReplay(data, fx, undefined, { assume: { "unlogged-tails": "kept" } }).replay;
    expect(kept.tailCuts).toEqual([]);
    expect(new Set(tail(kept.hits).map((h) => h.hitId))).toEqual(new Set(["bleed", "lift", "wolf_1", "wolf_2", "wolf_3", "wolf_4"]));
  });
});
