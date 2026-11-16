// efsim find: operator, weapon, gear and enemy IDs by name.

import { command } from "../command.ts";
import { find } from "../commands.ts";

export default command({
  name: "find",
  usage: `  efsim find <text>                       Look up operator, weapon, gear and enemy IDs by name
`,
  options: {},
  run: (ctx) => {
    ctx.need(1);
    return find(ctx.data(), ctx.args[0] as string);
  },
});
