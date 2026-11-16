// efsim compare: two builds of one operator side by side.

import { basename } from "node:path";
import { command } from "../command.ts";
import { compare, readBuild } from "../commands.ts";
import { CALC_NOTES, CALC_OPTIONS, calcOptions } from "./shared.ts";

export default command({
  name: "compare",
  usage: `  efsim compare <a.json> <b.json> [opts]  Two builds of one operator side by side
`,
  notes: [CALC_NOTES],
  options: CALC_OPTIONS,
  run: (ctx) => {
    ctx.need(2);
    const [a, b] = ctx.args as [string, string];
    const builds = [readBuild(a), readBuild(b)] as const;
    return compare(ctx.data(), builds[0], builds[1], calcOptions(ctx.values), [basename(a), basename(b)]);
  },
});
