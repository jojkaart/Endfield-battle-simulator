// efsim gamedata: BuffData / SkillData files as trees, and who names an id.

import { command } from "../command.ts";
import { findActions, formatFound, formatMentions, gamedataTree, whoMentions } from "../gamedata.ts";

export default command({
  name: "gamedata",
  usage: `  efsim gamedata tree <id>                A BuffData or SkillData file as an event → action → condition tree:
                                          presentation and defaults left out, value fields as "key k (default v)",
                                          known enums named (docs/game-data-format.md)
                [--grep <regex>] [--depth n]  Only matching lines (with their ancestors and subtrees); levels shown
  efsim gamedata who <id>                 Every BuffData / SkillData file that names a buff or skill id: the action
                                          around it (who creates, finishes or checks it), its buff event or frame
  efsim gamedata find <type>              Every action of a type (regex on the short $type: HitStop, TimeDilation,
                                          Slow|Seal) in the BuffData / SkillData files: file, buff / ability event
                                          or frame, its own fields (no selectors), JSON path
                [--file <regex>] [--folder BuffData|SkillData] [--enabled]  Only these files; not switched off
                [--fields a,b] [--count <field>]  Only these fields; or the counts of one field's values
`,
  options: { grep: { type: "string" }, depth: { type: "string" }, file: { type: "string" }, folder: { type: "string" }, enabled: { type: "boolean", default: false }, fields: { type: "string" }, count: { type: "string" } },
  run: (ctx) => {
    const { values, args } = ctx;
    const [sub, id] = args;
    if (args.length !== 2 || !id || (sub !== "tree" && sub !== "who" && sub !== "find")) throw new Error(`gamedata takes tree <id>, who <id> or find <type>\n\n${ctx.usage}`);
    if (sub === "find") {
      if (values.folder !== undefined && values.folder !== "BuffData" && values.folder !== "SkillData") throw new Error("--folder takes BuffData or SkillData");
      const found = findActions({ type: id, ...(values.file !== undefined ? { file: values.file } : {}), ...(values.folder !== undefined ? { folder: values.folder } : {}), enabled: values.enabled });
      return formatFound(found, { ...(values.fields !== undefined ? { fields: values.fields.split(",") } : {}), ...(values.count !== undefined ? { count: values.count } : {}) });
    }
    if (sub === "who") return formatMentions(id, whoMentions(id));
    const depth = values.depth === undefined ? undefined : Number(values.depth);
    if (depth !== undefined && !(Number.isInteger(depth) && depth >= 0)) throw new Error("--depth must be a whole number ≥ 0");
    return gamedataTree(id, { ...(values.grep !== undefined ? { grep: values.grep } : {}), ...(depth !== undefined ? { depth } : {}) });
  },
});
