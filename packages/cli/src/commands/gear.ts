// efsim gear: each operator's gear from the logs' loadouts, on the scenario's rotation or on a rule list.

import { readFileSync, writeFileSync } from "node:fs";
import { EngineError, FPS, simulate as simulateScenario, type TimelineScenario } from "@efsim/engine";
import { command } from "../command.ts";
import { parseAssume, underAssume, zeroCompanion } from "../assume.ts";
import { formatGear, gearAscent, gearCandidates, type GearCandidatesFile } from "../gear.ts";
import { formatRuleGear, gearOnRules } from "../gearrules.ts";
import { logFixtureFiles } from "../logs.ts";
import { readRuleList } from "../rules.ts";
import { readScenario } from "../simulate.ts";
import { opt, ROOT, teamOperators, wholeAtLeast } from "./shared.ts";

/** A scenario file with its team's gear replaced (efsim gear --out): everything else as it was. */
function writeGearScenario(from: string, to: string, team: readonly { readonly operator: string; readonly gear: readonly unknown[] }[], rotation?: TimelineScenario["rotation"]): void {
  const doc = JSON.parse(readFileSync(from, "utf8")) as { team: ({ operator: string; gear: unknown[] } | string)[]; rotation: unknown[] };
  if (rotation) doc.rotation = rotation.map((a) => ({ operator: a.operator, skill: a.skill, ...(a.at !== undefined ? { at: a.at / FPS } : {}) }));
  doc.team = doc.team.map((t) => {
    if (typeof t === "string") throw new Error(`${from}: --out needs the team's builds inline, not as files`);
    const b = team.find((x) => x.operator === t.operator);
    return b ? { ...t, gear: [...b.gear] } : t;
  });
  writeFileSync(to, JSON.stringify(doc, null, 2) + "\n");
}

export default command({
  name: "gear",
  usage: `  efsim gear <scenario.json>              Each operator's gear from the loadouts seen in the logs (fixtures; hold-outs left out), scored
                                          on the scenario's rotation with only that operator's gear swapped (full artifice), best
                                          per operator with the others fixed until nothing changes; a table per operator
                [--candidates file]       More loadouts to try: {"candidates": [{"operator", "gear": [4 ids], "source"}]}
                [--keep <operator>]       Don't vary this operator (repeatable); its candidates' mode attributes are shown
                [--min-count n] [--top n] Log loadouts seen at least n times (default 2), at most n per operator (default 6)
                [--repairs n]             Where steps of the rotation can't be played with a loadout: start each later (up to 2 s,
                                          or with a later step) or drop it, if at most n (default 20; 0: never)
                [--search-beam n]         With more: a narrow search at beam n (default 12)
                [--passes n] [--out file] Passes at most (default 4; 3 with --rules); save the scenario with the chosen gear (its rotation kept)
                [--rules <rules.json>]    Score loadouts by playing this rule list instead (sustained DPS over reaction-delay
                                          seeds, common random numbers; a change only when its gain is beyond twice its
                                          standard error); candidates also from the diagnosis' marginal values (piece swaps
                                          that keep the active sets, each set's best loadout screened by play); prints the
                                          diagnosis before and after (efsim diagnose)
                [--seeds k] [--duration s] [--reaction s] [--marginal-seeds k] [--workers n]  With --rules (default 6 seeds,
                                          300 s, 0.3 s, 4, cores less one)
                [--generated n] [--sets n]  With --rules: swaps per operator per pass (default 4), set builds kept after
                                          screening (default 2)
                [--also <scenario.json>]  With --rules: a change is taken only if it isn't worse on this start (by more
                                          than one standard error); default the zero-energy companion if there is one
                [--assume <id>=<reading>] [--assumptions]  With --rules: as for rules (the chosen gear on fresh seeds
                                          under each other reading)
`,
  options: {
    candidates: { type: "string" },
    keep: { type: "string", multiple: true, default: [] },
    "min-count": { type: "string" },
    top: { type: "string" },
    repairs: { type: "string" },
    "search-beam": { type: "string" },
    passes: { type: "string" },
    out: { type: "string" },
    rules: { type: "string" },
    seeds: { type: "string" },
    duration: { type: "string" },
    reaction: { type: "string" },
    "marginal-seeds": { type: "string" },
    workers: { type: "string" },
    generated: { type: "string" },
    sets: { type: "string" },
    also: { type: "string" },
    operator: { type: "string", multiple: true, default: [] },
    assume: { type: "string", multiple: true, default: [] },
    assumptions: { type: "boolean", default: false },
  },
  run: async (ctx) => {
    ctx.need(1);
    const { values, args, data } = ctx;
    const whole = wholeAtLeast;
    const scenario = readScenario(args[0] as string);
    const extra = values.candidates ? (JSON.parse(readFileSync(values.candidates, "utf8")) as GearCandidatesFile) : undefined;
    if (extra && !Array.isArray(extra.candidates)) throw new Error(`${values.candidates}: a candidates file has "candidates": [{ "operator", "gear", "source" }]`);
    const keep = new Set(values.keep);
    for (const k of keep) if (!scenario.team.some((b) => b.operator === k)) throw new Error(`--keep ${k}: not in the scenario's team`);
    const minCount = whole(values["min-count"], "min-count", 1);
    const top = whole(values.top, "top", 0);
    const candidates = gearCandidates(data(), scenario, { files: logFixtureFiles(ROOT), ...(extra ? { extra } : {}), ...(minCount !== undefined ? { minCount } : {}), ...(top !== undefined ? { top } : {}) });
    const beam = whole(values["search-beam"], "search-beam", 1);
    const passes = whole(values.passes, "passes", 1);
    const repairs = whole(values.repairs, "repairs", 0);
    if (values.rules) {
      const reaction = values.reaction === undefined ? undefined : Number(values.reaction);
      if (reaction !== undefined && !(reaction >= 0)) throw new Error("--reaction must be a number of seconds ≥ 0");
      const seconds = values.duration === undefined ? undefined : Number(values.duration);
      if (seconds !== undefined && !(seconds > 0)) throw new Error("--duration must be > 0");
      const also = values.also ?? zeroCompanion(args[0] as string);
      const assume = parseAssume(data(), values.assume);
      const rg = await gearOnRules(data(), underAssume(scenario, assume), readRuleList(values.rules), candidates, {
        keep,
        ...(also ? { also: { scenario: underAssume(readScenario(also), assume), label: also } } : {}),
        assumptions: values.assumptions,
        ...opt("seconds", seconds),
        ...opt("reaction", reaction),
        ...opt("seeds", whole(values.seeds, "seeds", 2)),
        ...opt("marginalSeeds", whole(values["marginal-seeds"], "marginal-seeds", 0)),
        ...opt("workers", whole(values.workers, "workers", 1)),
        ...opt("passes", passes),
        ...opt("generated", whole(values.generated, "generated", 0)),
        ...opt("sets", whole(values.sets, "sets", 0)),
        ...(values.operator.length ? { operators: teamOperators(values.operator, scenario.team.map((b) => b.operator), (op) => data().operators[op]?.name) } : {}),
        progress: (line) => process.stderr.write(line + "\n"),
      });
      let text = formatRuleGear(data(), rg, `efsim gear --rules ${values.rules} on ${args[0]}`);
      if (values.out) {
        // The timeline rotation only if the chosen gear still plays it (a loadout that moves ultimates may not); else none.
        let plays = true;
        try {
          simulateScenario(data(), { ...scenario, team: [...rg.team] });
        } catch (e) {
          if (!(e instanceof EngineError)) throw e;
          plays = false;
        }
        writeGearScenario(args[0] as string, values.out, rg.team, plays ? undefined : []);
        text += `\n\nWrote ${values.out} (the chosen gear; ${plays ? "the timeline rotation as it was, which it still plays" : "no timeline rotation: the old one can't be played with this gear"}; the rules are the rotation here).`;
      }
      return text;
    }
    const r = gearAscent(data(), scenario, candidates, { keep, ...(beam !== undefined ? { beam } : {}), ...(repairs !== undefined ? { repairs } : {}), ...(passes !== undefined ? { passes } : {}), progress: (line) => process.stderr.write(line + "\n") });
    let text = formatGear(data(), scenario, r);
    if (values.out) {
      writeGearScenario(args[0] as string, values.out, r.team, r.rotationReplaced || r.rotationRepaired ? r.rotation : undefined);
      text += `\n\nWrote ${values.out} (the chosen gear, ${r.rotationReplaced ? "the narrow search's rotation" : r.rotationRepaired ? `the rotation with the ${r.rotationRepaired} step${r.rotationRepaired === 1 ? "" : "s"} it couldn't play moved or dropped` : "the rotation as it was"}).`;
    }
    return text;
  },
});
