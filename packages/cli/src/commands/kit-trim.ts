// efsim kit-trim: kit values the loader takes from the data anyway.

import { command } from "../command.ts";
import { formatTrim, kitTrim } from "../kittrim.ts";

export default command({
  name: "kit-trim",
  usage: `  efsim kit-trim [--write]                Kit values the loader takes from the data anyway (--write removes them)
`,
  options: { write: { type: "boolean", default: false } },
  run: (ctx) => formatTrim(kitTrim(ctx.data(), ctx.values.write), ctx.values.write),
});
