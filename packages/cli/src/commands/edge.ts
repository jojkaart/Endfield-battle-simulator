// efsim edge: loadouts that put a mode's two attributes on a knife edge.

import { readFileSync } from "node:fs";
import { command } from "../command.ts";
import { readBuild } from "../commands.ts";
import { knifeEdge, type EdgePool } from "../edge.ts";

export default command({
  name: "edge",
  usage: `  efsim edge <build.json> <pool.json>     Loadouts from owned weapons and gear that put a mode's two attributes
                                          on a knife edge (Arcane's INT / WILL; pool: {weapons?, gear}; --top n)
`,
  options: { top: { type: "string" } },
  run: (ctx) => {
    ctx.need(2);
    const build = readBuild(ctx.args[0] as string);
    const pool = JSON.parse(readFileSync(ctx.args[1] as string, "utf8")) as EdgePool;
    if (!Array.isArray(pool.gear)) throw new Error(`${ctx.args[1]}: a pool has "gear": [{ "id", "artifice" }] (and optional "weapons")`);
    return knifeEdge(ctx.data(), build, pool, ctx.values.top === undefined ? 5 : Number(ctx.values.top));
  },
});
