// The status pairing's `check` reading (engine assumption status-pairing; buffreplay.ts, statuspairs.ts
// statusValueFits with enginecheck.ts primaryParts): a burst the replay landed on the other side of a buff's edge than
// the game's pairs with its logged hit where the check's primary reading of the pair fits, at the landing's frame or
// with the replay's modifiers at the logged hit's (BuffReplay.statusInputs), and the check reads it there.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { checkLog, devFixtures, engineHits, logBuffReplay, type LogFixture, type LogHit } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;

/** The logged hit's pair and verdict under a status-pairing reading. */
function pairOf(id: string, t: number, reading: string) {
  const fx = fixture(id);
  const hit = fx.hits.find((h) => h.t === t) as LogHit;
  const replay = logBuffReplay(data, fx, { assume: { "status-pairing": reading } });
  const l = replay.replay.statusLanding(hit);
  const verdict = checkLog(data, fx, { replay, engineHits: engineHits(data, fx, replay) }).find((v) => v.hit === hit);
  return { frame: "frame" in l ? l.frame : null, read: replay.replay.statusInputs?.(hit) ?? null, verdict: verdict?.kind === "match" ? verdict.class : verdict?.kind };
}

describe("status-pairing check", () => {
  // 1d91: Arcane's Nature burst at 50.47 s in the replay, before her combo's Tactical Doubles Susceptibility (the
  // touch at 50.60 s); the game's at 51.02 s lists it (since 50.50 s): ×1.095, 17 frames apart.
  it("pairs 1d91's 51.02 s burst with the replay's 50.47 s one, read at the logged frame", () => {
    const old = pairOf("1d91", 51024, "assignment");
    expect(old.frame).toBeNull();
    const now = pairOf("1d91", 51024, "check");
    expect(now.frame).toBe(1514);
    expect(now.read).not.toBeNull();
    expect(now.verdict).toBe("plain");
  });

  // a7a7: Wulfgard's Heat burst at 39.27 s with Liino's Medicant ×4, a kit buff the replay can't judge, which the
  // logged burst at 40.87 s doesn't list: ×0.838; the check's reading of the pair takes the log's (none).
  it("pairs a7a7's 40.87 s burst with the replay's 39.27 s one by the check's reading of its unjudged buffs", () => {
    expect(pairOf("a7a7", 40865, "assignment").frame).toBeNull();
    const now = pairOf("a7a7", 40865, "check");
    expect(now.frame).toBe(1178);
    expect(now.read).toBeNull();
    expect(now.verdict).toBe("plain");
  });
});
