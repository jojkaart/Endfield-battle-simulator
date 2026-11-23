// efsim find: operator, weapon, gear and enemy IDs by name.

import { command } from "../command.ts";
import { find } from "../commands.ts";
import { table } from "../format.ts";

export default command({
  name: "find",
  usage: `  efsim find <text>                       Look up operator, weapon, gear and enemy IDs by name
  efsim find --operators                  Every operator with a kit: id and display name (ids name the
                                          internal name: Arcane is chr_0032_lizhiyan; in a script
                                          operatorId(data, "Arcane") from @efsim/data)
`,
  options: { operators: { type: "boolean", default: false } },
  run: (ctx) => {
    if (ctx.values.operators) {
      const d = ctx.data();
      const rows = Object.values(d.operators)
        .filter((o) => d.kits.operators[o.id])
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((o) => [o.id, o.name]);
      return table(["id", "name"], rows);
    }
    ctx.need(1);
    return find(ctx.data(), ctx.args[0] as string);
  },
});
