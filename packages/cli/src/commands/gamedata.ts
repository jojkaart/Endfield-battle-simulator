// efsim gamedata: BuffData / SkillData files as trees, and who names an id.

import { command } from "../command.ts";
import { formatMentions, gamedataTree, whoMentions } from "../gamedata.ts";

export default command({
  name: "gamedata",
  usage: `  efsim gamedata tree <id>                A BuffData or SkillData file as an event → action → condition tree:
                                          presentation and defaults left out, value fields as "key k (default v)",
                                          known enums named (docs/game-data-format.md)
                [--grep <regex>] [--depth n]  Only matching lines (with their ancestors and subtrees); levels shown
  efsim gamedata who <id>                 Every BuffData / SkillData file that names a buff or skill id: the action
                                          around it (who creates, finishes or checks it), its buff event or frame
`,
  options: { grep: { type: "string" }, depth: { type: "string" } },
  run: (ctx) => {
    const { values, args } = ctx;
    const [sub, id] = args;
    if (args.length !== 2 || !id || (sub !== "tree" && sub !== "who")) throw new Error(`gamedata takes tree <id> or who <id>\n\n${ctx.usage}`);
    if (sub === "who") return formatMentions(id, whoMentions(id));
    const depth = values.depth === undefined ? undefined : Number(values.depth);
    if (depth !== undefined && !(Number.isInteger(depth) && depth >= 0)) throw new Error("--depth must be a whole number ≥ 0");
    return gamedataTree(id, { ...(values.grep !== undefined ? { grep: values.grep } : {}), ...(depth !== undefined ? { depth } : {}) });
  },
});
