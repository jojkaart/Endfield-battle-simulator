// `efsim zmdlogs ends` (packages/logs/src/endsview.ts, round 16, arcane-doubles-end report point 1): per logged
// moment the runs of the listed buffs ending there and those going on across it, with the moment spacing (point 3);
// on the report's own episodes: 6339's two purges (every team debuff on the slug ending at once) and e82d's Doubles
// Susceptibility ending alone at 8.93 s, the next moment 191 ms later.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, endsView, lanesView, listedRuns, logMoments, loggedPurges, momentEnds, momentSpacing } from "@efsim/logs";

const data = loadGameData();
const [p6339, e82d] = devFixtures({ ids: ["6339", "e82d"] }) as [ReturnType<typeof devFixtures>[number], ReturnType<typeof devFixtures>[number]];

describe("which listed buffs end at a moment and which go on", () => {
  it("shows 6339's purges as every enemy-side debuff ending, none going on, the moments loggedPurges reads", () => {
    const runs = listedRuns(p6339.fx);
    const moments = logMoments(p6339.fx);
    const purges = new Set(loggedPurges(p6339.fx));
    const at = momentEnds(10349, runs, moments, purges);
    expect(at.purge).toBe(true);
    expect(at.ending.filter((r) => r.side === "enemy").length).toBeGreaterThanOrEqual(3);
    expect(at.goingOn.filter((r) => r.side === "enemy")).toHaveLength(0);
    const text = endsView(data, p6339.fx, { side: "enemy", min: 3 });
    expect(text.split("\n").filter((l) => /PURGE \(loggedPurges\)/.test(l))).toHaveLength(purges.size);
    expect(text).toMatch(/10\.35 {2}moments −\d+ \/ \+\d+ ms {2}PURGE/);
    expect(text).toMatch(/enemy: \d end, 0 go on \(all\)/);
  });

  it("shows e82d's Doubles Susceptibility ending alone at 8.93 s with its grain (the next moment 191 ms on)", () => {
    const text = endsView(data, e82d.fx, { at: 8930 });
    expect(text.split("\n")[0]).toMatch(/at 8\.93 s.*moments −104 \/ \+191 ms/);
    expect(text).toMatch(/enemy-side \(debuffs\): 1 end here, \d+ go on\n {4}END {3}buff_common_affixes_vulnerable_\{crystal,natural\} from Arcane on the enemy: since 8\.56,.*next unlisted 9\.12; value\(s\) 0\.179399/);
    // The talent's run under the same name goes on across it.
    expect(text).toMatch(/ON {4}buff_common_affixes_vulnerable_\{crystal,natural\} from Arcane on the enemy: since 7\.02.*0\.197039/);
  });

  it("keys a run by buff, source, since and holder, a team-side run's next unlisted moment its holder's next hit", () => {
    for (const r of listedRuns(e82d.fx)) {
      expect(r.first).toBeLessThanOrEqual(r.last);
      if (r.nextUnlisted !== null) {
        expect(r.nextUnlisted).toBeGreaterThan(r.last);
        if (r.side === "team") expect(e82d.fx.hits.some((h) => h.t === r.nextUnlisted && h.operator === r.holder)).toBe(true);
      }
    }
    expect(momentSpacing([1, 5, 9], 5)).toEqual({ before: 4, after: 4, prev: 1, next: 9 });
    expect(momentSpacing([1, 5, 9], 9)).toEqual({ before: 4, after: null, prev: 5, next: null });
  });

  it("gives the moment spacing beside each lane's end in `zmdlogs lanes` (arcane-doubles-end point 3)", () => {
    expect(lanesView(data, e82d.fx, /vulnerable_crystal$/)).toMatch(/since 8\.56, listed 8\.56–8\.93 .*next unlisted hit 9\.12; at its last listing moments −104 \/ \+191 ms/);
  });
});
