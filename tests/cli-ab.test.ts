// scripts/cli-ab.ts outputDiff: two outputs of one efsim command (another commit's code and this tree's), the lines
// only one side has, and with a key the lines that changed paired up (zmdlogs holds --verbose: a bound by its tag).
import { describe, expect, it } from "vitest";
import { HOLDS_KEY, hitsZonesDiff, outputDiff, placementDiff, placementLogs, placementOutputsDiff, withRoot } from "../scripts/cli-ab.ts";

// Round 20 (the Vesperwings report point 3): which kit buff moved a hit, from two `zmdlogs hits --json` outputs.
describe("hitsZonesDiff (cli-ab --hits-zones)", () => {
  const rec = (value: number, cls: string, predicted: number, mods: readonly [string, string, number][]) => JSON.stringify({ t: 1000, operator: "chr_a", event: "e", value, class: cls, predicted, landing: { modifiers: mods.map(([kitBuff, zone, v]) => ({ source: "s", zone, value: v, kitBuff })) } });
  it("prints each moved hit with the modifiers that differ by kit buff and zone", () => {
    const was = [rec(100, "plain", 100, [["si:edge", "damageBonus", 0.4], ["si:x", "atk", 0.1]]), rec(50, "plain", 50, [])].join("\n");
    const now = [rec(100, "mismatch", 95, [["si:edge", "damageBonus", 0.2], ["si:y", "atk", 0.1]]), rec(50, "plain", 50, [])].join("\n");
    expect(hitsZonesDiff(was, now)).toEqual([
      "1 hit(s) whose class or primary reading moved, with the modifiers that differ (by kit buff, else source, and zone):",
      "   1.00  chr_a e 100: plain 100 → mismatch 95",
      "    ~ si:edge damageBonus 0.4 → 0.2",
      "    - si:x atk 0.1",
      "    + si:y atk 0.1",
    ]);
    expect(hitsZonesDiff(was, was)).toEqual(["no hit's class or primary reading moved"]);
  });
});

describe("outputDiff", () => {
  it("lists lines only at the ref (-) and only here (+), a repeated line as often as it differs", () => {
    expect(outputDiff("a\nb\nb\nc", "a\nb\nd")).toEqual(["+ d", "- b", "- c"]);
    expect(outputDiff("a", "a", { all: true })).toEqual(["  a"]);
  });
  it("pairs a changed line with its key (~), holds' bounds by their tag", () => {
    const was = ["zmdlogs-ab12: 0.5 s of hidden holds placed", "  bound: run x 0→9 ms over 8: P(9.00) − P(0.00) in [0.5, ∞] s; placed 0.50", "  dropped: tick y (asks 1.00 s)"].join("\n");
    const now = ["zmdlogs-ab12: 0.7 s of hidden holds placed", "  bound: run x 0→9 ms over 8: P(9.00) − P(0.00) in [0.5, ∞] s; placed 0.70", "  bound: status z: P(2.00) − P(1.00) in [0.1, ∞] s; placed 0.20"].join("\n");
    const d = outputDiff(was, now, { key: new RegExp(HOLDS_KEY) });
    expect(d[0]).toBe("~ zmdlogs-ab12:");
    expect(d).toContain("~ bound: run x 0→9 ms over 8");
    expect(d).toContain("+   bound: status z: P(2.00) − P(1.00) in [0.1, ∞] s; placed 0.20");
    expect(d.at(-1)).toBe("-   dropped: tick y (asks 1.00 s)");
  });
});

describe("withRoot (round 15: hits --json's records differed by the other worktree's path alone)", () => {
  it("reads the other side's worktree root as this checkout's", () => {
    const other = '{"fixture":"/repo/scratch/at/abc123def/fixtures/pending/zmdlogs-0c14.json","t":1}';
    expect(withRoot(other, "/repo/scratch/at/abc123def", "/repo")).toBe('{"fixture":"/repo/fixtures/pending/zmdlogs-0c14.json","t":1}');
    expect(withRoot("x", "/repo", "/repo")).toBe("x");
  });
});

describe("cli-ab --placement (round 17, the Zhuang Fangyi and Liino report point 2)", () => {
  const log = (id: string, lines: readonly string[]) => [`zmdlogs-${id}: placement (logcasts.ts placeHits); times in s`, ...lines].join("\n");
  const cast = (t: string, skill: string, rule: string) => `   ${t}  CAST   Zhuang Fangyi ${skill} (basic) key attack2_abilityrange  [${rule}: x, of attack2, attack4]`;
  const hit = (t: string, to: string) => `   ${t}  HIT    Zhuang Fangyi attack2_abilityrange 4899 → ${to} #0 frame 15`;

  it("splits an output into its logs by their headers", () => {
    expect([...placementLogs(`${log("ab12", ["a"])}\n${log("cd34", ["b", ""])}\n`).keys()]).toEqual(["zmdlogs-ab12", "zmdlogs-cd34"]);
  });

  it("counts the casts and hits that differ per log, per rule (this tree's ← the ref's) and per operator, a moved cast once", () => {
    const was = [log("ab12", [cast("2.40", "attack2", "anchor"), hit("2.50", "attack2@2.40"), cast("5.00", "attack3", "first")]), log("cd34", ["same"])].join("\n");
    const now = [log("ab12", [cast("2.44", "attack4", "window"), hit("2.50", "attack4@2.44"), cast("5.10", "attack3", "first")]), log("cd34", ["same"])].join("\n");
    const out = placementDiff(was, now, { summary: true });
    expect(out[0]).toBe("Logs whose placement differs (1 of 2):");
    expect(out).toContain("  ab12  3 cast(s), 1 HIT line(s) differ");
    // attack3 moved 5.00 → 5.10: one cast, its rule on both sides; attack2 gone and attack4 new: two.
    expect(out).toContain("     1  first ← first (same skill)");
    expect(out).toContain("     1  window ← new");
    expect(out).toContain("     1  gone ← anchor");
    expect(out.some((l) => /^ {2}Zhuang Fangyi +3 casts +1 hits$/.test(l))).toBe(true);
    expect(placementDiff(was, was)).toEqual(["the placement of every log (2) is the same"]);
  });

  // Round 18 (round 17's own report point 2): placement-lines prints records (views.ts castsRecords), compared by their
  // fields: a skill id without an underscore parses, and a note added to a line's text (a HIT's [joined: …]) moves nothing.
  it("compares records by their fields, prints the view's text, and falls back to the text for an older side", () => {
    const head = (id: string) => JSON.stringify({ log: `zmdlogs-${id}`, kind: "HEADER", text: `zmdlogs-${id}: placement (logcasts.ts placeHits); times in s` });
    const castR = (t: number, skill: string, rule: string) => JSON.stringify({ log: "zmdlogs-ab12", kind: "CAST", t, operator: "chr_0030_zhuangfy", name: "Zhuang Fangyi", skill, castKind: "basic", key: "attack2_abilityrange", rule, text: `CAST   Zhuang Fangyi ${skill} (basic) key attack2_abilityrange  [${rule}: x]` });
    const hitR = (t: number, start: number, skill: string, note = "") => JSON.stringify({ log: "zmdlogs-ab12", kind: "HIT", t, operator: "chr_0030_zhuangfy", name: "Zhuang Fangyi", skill: "chr_0030_zhuangfy_attack2_abilityrange", value: 4899, cast: { skill, start, index: 0, frame: 15 }, text: `HIT    Zhuang Fangyi attack2_abilityrange 4899 → ${skill}@${(start / 1000).toFixed(2)} #0 frame 15${note}` });
    const was = [head("ab12"), castR(2400, "attack2", "anchor"), hitR(2500, 2400, "attack2", "  [joined: to come, …]"), castR(5000, "attack4", "first")].join("\n");
    const same = [head("ab12"), castR(2400, "attack2", "anchor"), hitR(2500, 2400, "attack2"), castR(5000, "attack4", "first")].join("\n");
    expect(placementOutputsDiff(was, same)).toEqual(["the placement of every log (1) is the same"]);
    const now = [head("ab12"), castR(2440, "attack4", "window"), hitR(2500, 2440, "attack4"), castR(5000, "attack4", "first")].join("\n");
    const out = placementOutputsDiff(was, now);
    expect(out).toContain("  ab12  2 cast(s), 1 HIT line(s) differ");
    expect(out).toContain("     1  window ← new");
    expect(out).toContain("     1  gone ← anchor");
    // The detail prints the view's own text (its rule's reasons), not the built line.
    expect(out.some((l) => l.includes("[window: x]"))).toBe(true);
    // A side from before castsRecords (text): the records side is compared as the view prints it.
    const text = [`zmdlogs-ab12: placement (logcasts.ts placeHits); times in s`, `   2.40  CAST   Zhuang Fangyi attack2 (basic) key attack2_abilityrange  [anchor: x]`, `   2.50  HIT    Zhuang Fangyi attack2_abilityrange 4899 → attack2@2.40 #0 frame 15`, `   5.00  CAST   Zhuang Fangyi attack4 (basic) key attack2_abilityrange  [first: x]`].join("\n");
    expect(placementOutputsDiff(text, same)).toEqual(["the placement of every log (1) is the same"]);
  });
});
