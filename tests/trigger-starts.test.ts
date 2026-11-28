// `zmdlogs replay --trace-trigger <spec> --against-starts <game buff>` (round 22, the Estella-Akekuri report point 3):
// a trigger's firings against the log's starts of the buff it makes. 8056's first Akekuri ultimate: the replay's
// Frontiers SP trigger fires three times (17.27, 18.33, 19.20 s), the log starts the buff once; the two extra firings
// come at the SP cap (in-game test 112, open-problems "Akekuri: her SP grants").
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay, replayView, startPairs } from "@efsim/logs";

const data = loadGameData();

describe("firings against a game buff's logged starts", () => {
  it("pairs each firing with the nearest start within 400 ms, once, and keeps the rest on their side", () => {
    const noState = { stateAt: () => undefined as never };
    const pairs = startPairs(noState, [30, 60, 150], [1000, 1100, 5000]);
    expect(pairs.map((p) => [p.firing, p.logged])).toEqual([[1000, 1000], [null, 1100], [2000, null], [5000, 5000]]);
  });

  it("8056: Frontiers fires twice more at the SP cap than the log applies it in her first ultimate", () => {
    const [d] = devFixtures({ ids: ["8056"] });
    const fx = (d as NonNullable<typeof d>).fx;
    const text = replayView(data, fx, { trace: ["trigger:suit_atb01.skill_sp"], againstStarts: /buff_equipsuit_combosuit_01_adddamage/ });
    const head = text.split("\n").find((l) => l.startsWith("STARTS chr_0019_karin:suit_atb01.skill_sp"));
    expect(head).toMatch(/: \d+ both, [2-9] replay only \([2-9] at the SP cap\), \d+ log only$/);
    expect(text).toMatch(/^ +18\.3\d {2}fired 18\.3\d {2}replay only {2}SP 300 \(at the cap\)$/m);
    expect(logBuffReplay(data, fx).replay.triggerTraces).toEqual([]);
  });
});
