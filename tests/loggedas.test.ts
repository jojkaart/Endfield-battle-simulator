// The likely-loggedAs screen (packages/logs/src/loggedas.ts; stats-candidates report point 1, round 11): a kit buff's
// modifier and a listed game buff no kit buff stands for, with one effect at a hit. The development logs have none
// since the candidates' fixes (the pending suite fails on a new one); here, the rule on a real log's listing.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, logOnly, loggedAsLines, loggedAsPairs, teamBuffNames, unexplainedLoggedAs, type LogHit } from "@efsim/logs";

const data = loadGameData();

describe("the likely-loggedAs screen", () => {
  const logs = devFixtures({});
  // A hit listing a game buff no kit buff stands for, from a teammate (logOnly), in some development log.
  const found = (() => {
    for (const d of logs) {
      const names = teamBuffNames(data, d.fx);
      for (const h of d.fx.hits) {
        const e = logOnly(data, d.fx, names, h).effects.find((x) => x.source !== undefined && x.value !== 0);
        if (e) return { fx: d.fx, hit: h, effect: e };
      }
    }
    throw new Error("no development log lists an unmapped buff with a source");
  })();
  const at = (value: number, owner = found.effect.source as string, id = "some_buff") => (h: LogHit) => (h === found.hit ? { modifiers: [{ zone: found.effect.zone, element: found.effect.element, value, kitBuff: { owner, id } }] } : null);

  it("pairs a kit modifier with an unmapped listed effect of the same zone, element and value from its owner", () => {
    const pairs = loggedAsPairs(data, found.fx, at(found.effect.value));
    expect(pairs).toEqual([{ kitBuff: `${found.effect.source}:some_buff`, gameBuff: found.effect.buff, hits: 1, first: found.hit.t }]);
    expect(unexplainedLoggedAs(pairs)).toEqual(pairs);
    expect(loggedAsLines([{ label: "x", pairs }]).join("\n")).toMatch(new RegExp(`some_buff ~ ${found.effect.buff}: 1 hit\\(s\\) in 1 fight\\(s\\)`));
  });

  it("leaves another value, another owner without the equipment's id, and a landing without kit modifiers alone", () => {
    expect(loggedAsPairs(data, found.fx, at(found.effect.value * 1.5 + 0.1))).toEqual([]);
    expect(loggedAsPairs(data, found.fx, at(found.effect.value, "chr_9999_nobody"))).toEqual([]);
    expect(loggedAsPairs(data, found.fx, () => ({ modifiers: [] }))).toEqual([]);
    expect(loggedAsLines([])).toEqual([expect.stringMatching(/: none$/)]);
  });
});
