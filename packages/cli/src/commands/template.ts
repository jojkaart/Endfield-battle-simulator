// efsim template: a build file to start from.

import { command } from "../command.ts";
import { template } from "../commands.ts";

export default command({
  name: "template",
  usage: `  efsim template <operator> [--weapon id] Print a build file to start from
`,
  options: { weapon: { type: "string" } },
  run: (ctx) => {
    ctx.need(1);
    return template(ctx.data(), ctx.args[0] as string, ctx.values.weapon);
  },
});
