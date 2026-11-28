// `efsim zmdlogs which` (round 22, round 21's own report point 2): a question's words against docs/design/data.md's
// question table and the zmdlogs usage, so a report doesn't ask for a view that exists (`hits --against` since round 13).
import { describe, expect, it } from "vitest";
import zmdlogs from "../packages/cli/src/commands/zmdlogs.ts";
import { dataQuestions, rankWhich, usageEntries, whichView, whichWords } from "../packages/cli/src/which.ts";

const TABLE = ["**Questions and the command that answers them** (round 4):", "", "| Question | Command |", "|---|---|", "| Who is controlled when | `efsim zmdlogs control <fixture>` |", "| A buff's listed runs \\| lanes | `efsim zmdlogs lanes <fixture>` |", "", "after"].join("\n");
const USAGE = ["  efsim zmdlogs stops <fixture…|--all>    The slow-downs each replay applied", "                [--differ] [--operator <op>]  Only the lines that differ", "                                          (not as listed)", "  efsim other thing                        not zmdlogs"].join("\n");

describe("zmdlogs which", () => {
  it("reads the table's rows and the usage's entries, an option line its own", () => {
    expect(dataQuestions(TABLE).map((e) => e.question)).toEqual(["Who is controlled when", "A buff's listed runs | lanes"]);
    const u = usageEntries(USAGE);
    expect(u.map((e) => e.command)).toEqual(["efsim zmdlogs stops <fixture…|--all>", "efsim zmdlogs stops <fixture…|--all> [--differ] [--operator <op>]"]);
    expect(u[1]?.question).toBe("Only the lines that differ (not as listed)");
    expect(whichWords("The stops it applies, firing")).toEqual(["stop", "apply", "fir"]);
  });

  it("ranks by the shared words, rarer ones heavier", () => {
    const ranked = rankWhich("who was controlled", [...dataQuestions(TABLE), ...usageEntries(USAGE)]);
    expect(ranked[0]?.entry.command).toBe("`efsim zmdlogs control <fixture>`");
  });

  it("finds the round's own views from the real table and usage", () => {
    const usage = (zmdlogs as unknown as { usage: string }).usage;
    expect(whichView("is there a freeze in this fight", usage).split("\n")[1]).toMatch(/statuses --controls/);
    expect(whichView("per-hit diff of two readings verdicts", usage).split("\n")[1]).toMatch(/hits <fixture…> --against/);
    expect(whichView("zzzqqq", usage)).toMatch(/^No entry shares a word/);
  });
});
