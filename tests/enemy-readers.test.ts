// The readers of one enemy's state fields (TimelineState.enemy's statuses, physical, infliction, vulnerable), each
// classified (round 21, the statuses-per-target report point 1: in a fight read per target `enemy` is the current
// target's, the others wait in TimelineState.targets.others; the hidden holds shifted `st.enemy` only and 9c6e's
// swapped-out Corrosion missed every hold, three more such readers turned up by a grep, a measure each). A new reader
// fails here until it is listed with what it means: the landing's target (st.enemy on purpose), every target
// (timeline/targets.ts everyTarget, targetEnemy), or one enemy by construction. docs/design/timeline.md says so.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const READ = /\.enemy\.(statuses|physical|infliction|vulnerable)\b/g;

/** Each file's reads of the fields, with why it may read one enemy's. */
const READERS: Readonly<Record<string, { readonly n: number; readonly why: string }>> = {
  "packages/engine/src/expr.ts": { n: 6, why: "a condition's context: the landing's (or the cast's) target, which landing.ts swaps in first" },
  "packages/engine/src/timeline/landing.ts": { n: 2, why: "the landing's own target (swapped in by onTarget)" },
  "packages/engine/src/status.ts": { n: 2, why: "functions of one EnemyStatus argument, called per target" },
  "packages/engine/src/timeline/advance.ts": { n: 1, why: "the current target's next tick; the others' through otherTargetTick" },
  "packages/engine/src/timeline/clock.ts": { n: 3, why: "a freeze's ramp and statuses (rampRunsOn, statusesRunOn): the current target's only; no fight read per target has a freeze yet" },
  "packages/engine/src/planning/payoffs.ts": { n: 5, why: "the search's simulations: one enemy (no landingTargets outside the log check's replay)" },
  "packages/engine/src/planning/policy.ts": { n: 8, why: "the rule driver's cues: one enemy, as payoffs.ts" },
  "packages/engine/src/planning/setupvalue.ts": { n: 3, why: "the search's setup value: one enemy, as payoffs.ts" },
  "packages/logs/src/holdinputs.ts": { n: 2, why: "statusInstances: every target's (everyTarget), filtered to the application's" },
  "packages/logs/src/rampsteps.ts": { n: 1, why: "a landing's facts (LandingFacts.enemy): the landing's target" },
  "packages/logs/src/hitexport.ts": { n: 2, why: "a landing's facts: the landing's target" },
  "packages/logs/src/targets.ts": { n: 2, why: "unitsAt: the first replay's one enemy (the second pass leaves status units out: enginecheck.ts fightTargets)" },
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("one enemy's state fields are read where the list says (timeline/targets.ts)", () => {
  it("every reader of .enemy.statuses / physical / infliction / vulnerable is listed with its meaning, the counts exact", () => {
    const found: Record<string, number> = {};
    for (const pkg of ["engine", "logs", "data", "cli"]) {
      for (const f of files(join(ROOT, "packages", pkg, "src"))) {
        const n = [...readFileSync(f, "utf8").matchAll(READ)].length;
        if (n) found[relative(ROOT, f)] = n;
      }
    }
    const listed = Object.fromEntries(Object.entries(READERS).map(([f, r]) => [f, r.n]));
    expect(found, "a new reader of one enemy's fields: read the landing's target on purpose, or every target (everyTarget / targetEnemy), and list it in READERS with why").toEqual(listed);
  });
});
