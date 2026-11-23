// efsim gamedata: BuffData / SkillData files as trees, and who names an id.

import { command } from "../command.ts";
import { isSkillFileListed, readSkillFile } from "@efsim/data";
import type { GameData } from "@efsim/engine";
import { findActions, formatFound, formatMentions, gamedataTree, heldFrames, whoMentions } from "../gamedata.ts";

/** `gamedata dilations`: each skill's time-dilation actions and what the compiler made of them (RawSkillFile.dilations). */
function dilationsView(data: GameData, re: RegExp | undefined, dropped: boolean): string {
  const lines: string[] = [];
  const why = new Map<string, number>();
  for (const id of Object.keys(data.skills).sort()) {
    if ((re && !re.test(id)) || !isSkillFileListed(id)) continue;
    const file = readSkillFile(id);
    // The compiled slow-downs (SkillTiming.slowdowns) and the world frames each holds (heldFrames), by their frame.
    const slowdowns = data.skills[id]?.timing?.slowdowns ?? [];
    const held = heldFrames(slowdowns);
    // A dilation's compiled slow-down is the one carrying its index (SkillTiming.slowdowns' `n`: Rossi's combo_3 has two at frame 0).
    const holds = (n: number) => {
      const i = slowdowns.findIndex((x) => x.n === n);
      if (i < 0) return "";
      return ` (${slowdowns[i]?.scales.length} frames, lowest ×${Number(Math.min(...(slowdowns[i]?.scales ?? [1])).toPrecision(2))}, holds ${(held.each[i] as number).toFixed(1)} frames)`;
    };
    let shown = 0;
    for (const d of [...(file?.dilations ?? [])].sort((a, b) => a.frame - b.frame)) {
      if (d.compiled.startsWith("dropped")) why.set(d.compiled, (why.get(d.compiled) ?? 0) + 1);
      if (dropped && !d.compiled.startsWith("dropped")) continue;
      shown++;
      lines.push(`${id} frame ${d.frame}: ${d.type}${d.layer !== null ? ` layer ${d.layer}` : ""}${d.curve ? ` (${d.curve})` : ""}${d.priority !== null ? ` priority ${d.priority}` : ""}: ${d.compiled}${d.compiled === "slow-down" ? holds(d.n) : ""}`);
    }
    if (shown && !dropped && slowdowns.length > 1) lines.push(`${id}: its ${slowdowns.length} slow-downs hold ${held.together.toFixed(1)} frames together at the lowest scale (each alone ${held.each.map((x) => x.toFixed(1)).join(" + ")}; a path's ends and jumps can leave some out: pathSlowdowns)`);
  }
  return [...lines, `${lines.length} dilation(s)${why.size ? `; dropped: ${[...why].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${n} ${w.replace(/^dropped: /, "")}`).join("; ")}` : ""}`].join("\n");
}

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
  efsim gamedata dilations [<skill regex>]  The time-dilation actions (ultimate stops, TimeDilationAction) of
                                          every compiled skill's SkillData file and what the compiler made of each:
                                          a slow-down (its frames, lowest scale and the world frames it holds,
                                          Σ(1 − scale); a skill's several together at the lowest scale), a reset,
                                          or dropped and why (a layer other than the world's, an unknown curve,
                                          switched off); the dropped ones counted by why
                [--dropped]               Only the dropped ones
`,
  options: { grep: { type: "string" }, depth: { type: "string" }, file: { type: "string" }, folder: { type: "string" }, enabled: { type: "boolean", default: false }, fields: { type: "string" }, count: { type: "string" }, dropped: { type: "boolean", default: false } },
  run: (ctx) => {
    const { values, args } = ctx;
    const [sub, id] = args;
    if (sub === "dilations") return dilationsView(ctx.data(), id === undefined ? undefined : new RegExp(id), values.dropped);
    if (args.length !== 2 || !id || (sub !== "tree" && sub !== "who" && sub !== "find")) throw new Error(`gamedata takes tree <id>, who <id>, find <type> or dilations [<skill regex>]\n\n${ctx.usage}`);
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
