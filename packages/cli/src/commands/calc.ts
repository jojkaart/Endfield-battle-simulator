// efsim calc: a build's stat panel and damage per hit.

import { command } from "../command.ts";
import { calc, readBuild } from "../commands.ts";
import { CALC_NOTES, CALC_OPTIONS, calcOptions } from "./shared.ts";

export default command({
  name: "calc",
  usage: `  efsim calc <build.json> [options]       Stat panel and damage per hit
`,
  notes: [CALC_NOTES],
  options: CALC_OPTIONS,
  run: (ctx) => {
    ctx.need(1);
    const build = readBuild(ctx.args[0] as string);
    return calc(ctx.data(), build, calcOptions(ctx.values));
  },
});
