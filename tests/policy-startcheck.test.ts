// One "can this start now" (timeline drivers.ts canStartAt; docs/design.md "Rule-based rotations"): the start check a
// frame-stepping driver asks agrees with earliestStart's `at`, so `simulate` replays what the rule driver pressed.
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import {
  advance,
  apply,
  buttonSkill,
  canStartAt,
  createContext,
  earliestStart,
  init,
  memoised,
  nextBasics,
  playRules,
  resolveRuleList,
  SKILL_BUTTONS,
  startsNow,
  type RotationAction,
  type TimelineScenario,
} from "@efsim/engine";
import { readScenario } from "@efsim/cli";
import { readRuleList } from "../packages/cli/src/rules.ts";
import { ownHitsLanded } from "../packages/engine/src/timeline/timing.ts";

const data = loadGameData();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLE_TEAMS = ["estella-si-akekuri-arcane", "ink-melt", "typhoeus-arcane-liino-perlica"] as const;
const example = (t: string, zero = false) => {
  const sc = readScenario(join(ROOT, "examples", `${t}${zero ? "-zero" : ""}.scenario.json`));
  return { sc, list: resolveRuleList(data, sc.team.map((b) => b.operator), readRuleList(join(ROOT, "examples", `${t}.rules.json`))) };
};

describe("one start check (canStartAt)", () => {
  // At sampled frames between the presses of a rotation: whatever startsNow allows on the state advanced to a frame,
  // earliestStart from the state after the last press, with the frame as `at`, starts there too (so `simulate` replays
  // what a driver pressed); the other way round, the only difference is the current skill's own hits, which a press
  // without a time waits for and one with a time may cut.
  const agree = (sc: TimelineScenario, rotation: readonly RotationAction[], seconds: number) => {
    const ctx = memoised(createContext(data, { ...sc, rotation: [] }));
    const end = seconds * 30;
    let st = init(ctx);
    let checked = 0;
    for (const a of rotation) {
      const next = Math.min(end, a.at ?? st.frame);
      for (let f = st.frame + 1; f <= next; f += 11) {
        const adv = advance(ctx, st, f);
        const actions: RotationAction[] = [
          ...sc.team.flatMap((b) => SKILL_BUTTONS.map((k) => buttonSkill(ctx, adv, b.operator, k, f)).filter((x): x is string => x !== null).map((skill) => ({ operator: b.operator, skill }))),
          ...nextBasics(data, adv, adv.controlled).map((skill) => ({ operator: adv.controlled, skill })),
        ];
        for (const x of actions) {
          const now = canStartAt(ctx, st, x, f);
          expect(now).toBe(startsNow(ctx, adv, x));
          const e = earliestStart(ctx, st, { ...x, at: f });
          if (now) expect(e).toEqual({ frame: f });
          else if ("frame" in e && e.frame === f) expect(ownHitsLanded(adv, x.operator)).toBeGreaterThan(f);
          checked++;
        }
      }
      if ((a.at ?? 0) > end) break;
      st = apply(ctx, st, a);
    }
    return checked;
  };
  it.each(EXAMPLE_TEAMS)("%s: on the scenario's own rotation and on a rules run", (t) => {
    const { sc, list: l } = example(t);
    expect(agree(sc, sc.rotation, 20)).toBeGreaterThan(50);
    const r = playRules(data, { ...sc, durationFrames: 20 * 30 }, l, { seed: 3 });
    expect(agree(sc, r.rotation, 20)).toBeGreaterThan(50);
  }, 120_000);
});
