// A channel's ticks and the casts they belong to (round 22: the interrupted-cast round, docs/open-problems.md): the kit
// compiler records a per-target-capped channel's end (KitHit.latestFrame), the placement joins no tick to a cast past
// it (logcasts.ts placeWith `pastChannel`), the replay keeps a channel's ticks in turn (drivers.ts replayCast), and a
// cast made from a log event alone isn't the previous cast whose hits the next one keeps (castassembly.ts ordered).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay, placeHits, type LogFixture } from "@efsim/logs";

const data = loadGameData();
const fixture = (id: string) => (devFixtures({ ids: [id] })[0] as { fx: LogFixture }).fx;
const frameOf = (ms: number) => Math.round((ms * 30) / 1000);
const SI = "chr_0036_jsspsi";
const kitHit = (op: string, skillId: string, hitId: string) => data.kits.operators[op]?.skills.find((s) => s.skillId === skillId)?.hits.find((h) => h.id === hitId);

describe("a capped channel's end from the data (KitHit.latestFrame)", () => {
  it("Si's attack 4: six ticks at frames 5–20 of a channel to frame 40", () => {
    const h = kitHit(SI, `${SI}_attack4`, "hit");
    expect(h?.frames).toEqual([5, 8, 11, 14, 17, 20]);
    expect(h?.latestFrame).toBe(40);
  });

  it("not on what a tick's buff deals later (Rossi's combo afterhits, frames 33–41)", () => {
    expect(kitHit("chr_0028_wulfa", "chr_0028_wulfa_combo_2_skill", "ticks")?.latestFrame).toBeUndefined();
  });
});

describe("no tick joins a cast past its channel's end (pastChannel)", () => {
  const attack4 = (fx: LogFixture, from: number, to: number) => fx.hits.filter((h) => h.operator === SI && h.event === `${SI}_attack4` && h.t >= from && h.t <= to);

  // abfd 61.79 s: two ticks, a battle press at 62.08 s, then six ticks 63.77–64.35 s: one attack 4 of its own (its six
  // ticks the channel's cap), not the first cast's four slots left and a second cast cut at 64.10 s.
  it("six ticks 1.8 s after a cast's first are one new cast, and every one lands (abfd 63.77 s)", () => {
    const fx = fixture("abfd");
    const p = placeHits(data, fx);
    const six = attack4(fx, 63700, 64400);
    expect(six.length).toBe(6);
    const casts = new Set(six.map((h) => p.hits.get(h)?.cast));
    expect(casts.size).toBe(1);
    expect(Math.abs(([...casts][0]?.start ?? 0) - 63605)).toBeLessThan(20);
    const { replay } = logBuffReplay(data, fx, { placement: p });
    expect(replay.hits.filter((h) => h.operator === SI && h.skillId === `${SI}_attack4` && Math.abs(h.frame - frameOf(64103)) <= 1).length).toBe(2);
  });

  // c3c7 59.30 s: one tick, a battle press at 59.50 s, five ticks 0.1 s apart from 60.64 s (1.34 s on: past the channel
  // by 0.17 s, under the slack, with the press between).
  it("past it by less than the slack, with a press between: a new cast (c3c7 60.64 s)", () => {
    const fx = fixture("c3c7");
    const p = placeHits(data, fx);
    const first = attack4(fx, 59200, 59400)[0];
    const five = attack4(fx, 60600, 61100);
    expect(five.length).toBe(5);
    expect(new Set(five.map((h) => p.hits.get(h)?.cast)).size).toBe(1);
    expect(p.hits.get(five[0] as (typeof five)[number])?.cast).not.toBe(p.hits.get(first as (typeof five)[number])?.cast);
  });

  // 9090 93.91 s: Liino's attack 2's fifth tick 0.61 s after its first, 0.21 s past the channel's frame 19, no press
  // between: the same cast (the logs run channels up to 0.23 s past the data's end).
  it("past it by less than the slack, no press between: the same cast (9090 93.91 s)", () => {
    const fx = fixture("9090");
    const p = placeHits(data, fx);
    const ticks = fx.hits.filter((h) => h.operator === "chr_0035_liino" && h.event === "chr_0035_liino_attack2" && h.t >= 93250 && h.t <= 93950);
    expect(ticks.length).toBe(5);
    expect(new Set(ticks.map((h) => p.hits.get(h)?.cast)).size).toBe(1);
  });

  // c83c 92.48 s: Si's third tick 0.01 s after Laevatain's ultimate stop (90.43–92.47 s), whose event the log has at the
  // stop's end: the stop held the channel, so the tick is the 90.04 s cast's.
  it("not across an ultimate's event: its stop held the channel (c83c 92.48 s)", () => {
    const fx = fixture("c83c");
    const p = placeHits(data, fx);
    const [a, , c] = attack4(fx, 90100, 92500);
    expect(p.hits.get(c as NonNullable<typeof c>)?.cast).toBe(p.hits.get(a as NonNullable<typeof a>)?.cast);
  });
});

describe("the replay's channel ticks in turn, and the previous cast past a hitless one", () => {
  // c3c7 31.67 s: five ticks logged, the fourth 0.2 s after the third, the fifth at 32.34 s; the sixth at its kit frame
  // (32.33 s) sat beside the fifth and stayed as a replay-only landing; in turn it is a tail the cut takes.
  it("a tick after a late pinned one comes as late, and is cut as a tail (c3c7 32.33 s)", () => {
    const { replay } = logBuffReplay(data, fixture("c3c7"));
    const near = replay.hits.filter((h) => h.operator === SI && h.skillId === `${SI}_attack4` && h.frame >= frameOf(32300) && h.frame <= frameOf(32500));
    expect(near.length).toBe(1);
  });

  // fc63 94.79 s: Arcane's attack 2 hit 3, logged after her attack 3's start, was cut because her combo event at 94.49 s
  // (a tick of her Imprisonment, which the replay skips) stood between as the previous cast.
  it("a cast from a log event alone isn't the previous cast (fc63 94.79 s)", () => {
    const { replay } = logBuffReplay(data, fixture("fc63"));
    expect(replay.hits.some((h) => h.operator === "chr_0032_lizhiyan" && h.skillId === "chr_0032_lizhiyan_attack2" && Math.abs(h.frame - frameOf(94790)) <= 1)).toBe(true);
  });
});
