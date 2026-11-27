// Counterfactual replays (packages/logs counterfactual.ts; round 21, the tail-cut report point 2): the replay with a cast
// cut (ReplayOptions.cutCasts) composed into the snapshots' check, compared hit by hit; `zmdlogs decisions --why-kept`.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { changeLine, devFixtures, hitChanges, landingWords, whyKeptView, type HitSide, type LogFixture, type LogHit } from "@efsim/logs";

const data = loadGameData();

describe("hitChanges", () => {
  const hit = (t: number): LogHit => ({ t, operator: "chr_0016_laevat", event: "chr_0016_laevat_attack1", value: 100, crit: false, effects: [] }) as unknown as LogHit;
  it("lists the hits whose class, prediction or landing moved, in time order", () => {
    const [a, b, c] = [hit(3000), hit(1000), hit(2000)];
    const side = (cls: HitSide["class"], predicted: number | null, landing: string): HitSide => ({ class: cls, predicted, landing });
    const before = new Map([[a, side("plain", 100, "attack1 hit1 @3.00")], [b, side("plain", 100, "attack1 hit1 @1.00")], [c, side("mismatch", 90, "attack1 hit1 @2.00")]]);
    const after = new Map([[a, side("mismatch", null, "none (a landing the replay didn't land)")], [b, side("plain", 100, "attack1 hit1 @1.00")], [c, side("mismatch", 91, "attack1 hit1 @2.00")]]);
    const changes = hitChanges(before, after);
    expect(changes.map((x) => x.hit.t)).toEqual([2000, 3000]);
    expect(changeLine(data, changes[0] as (typeof changes)[number])).toMatch(/2\.00 +Laevatain attack1 logged 100: mismatch 90 → mismatch 91 \[attack1 hit1 @2\.00\]$/);
    expect(changeLine(data, changes[1] as (typeof changes)[number])).toMatch(/plain 100 \[attack1 hit1 @3\.00\] → mismatch - \[none/);
    expect(landingWords({ unknown: "x" })).toBe("none (x)");
  });
});

describe("zmdlogs decisions --why-kept (9847: Liino's 75.44 s battle skill, kept as `needed`)", () => {
  it("cuts each kept tail and names the logged hits that lose their landing", () => {
    const fx = (devFixtures({ ids: ["9847"] })[0] as { fx: LogFixture }).fx;
    const text = whyKeptView(data, fx);
    const line = text.split("\n").find((l) => /TAILKEPT Liino normal_skill \(placed at 75\.44\) \[needed\], cut:/.test(l));
    expect(line, text.slice(0, 2000)).toBeDefined();
    expect(line).toMatch(/\d+ lose their landing/);
    expect(text).toMatch(/78\.36 +Liino normal_skill_projhit_hit logged 1099: plain 1099 \[normal_skill volley @78\.\d\d\] → mismatch - \[none/);
  });
});
