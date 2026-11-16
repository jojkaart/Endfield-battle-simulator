// efsim cache [clear]: the compiled game-data cache (packages/data cache.ts).

import { basename } from "node:path";
import { cacheDir, cacheDisabled, clearGameDataCache, gameDataCacheKey, listGameDataCache } from "@efsim/data";
import { command } from "../command.ts";

export default command({
  name: "cache",
  usage: `  efsim cache [clear]                     The compiled game-data cache: where it is, its entries, whether the
                                          current inputs have one; clear removes them (EFSIM_NO_CACHE=1: off)
`,
  options: {},
  run: (ctx) => {
    const sub = ctx.args[0];
    const dir = cacheDir();
    if (sub === "clear") {
      const n = clearGameDataCache(dir);
      return `Removed ${n} file${n === 1 ? "" : "s"} from ${dir}.`;
    }
    if (sub !== undefined) throw new Error(`efsim cache takes no argument, or "clear"`);
    let key: string;
    try {
      key = gameDataCacheKey();
    } catch (e) {
      key = `(none: ${e instanceof Error ? e.message : String(e)})`;
    }
    const entries = listGameDataCache(dir);
    const cached = entries.some((e) => basename(e.file) === `gamedata-${key}.v8`);
    return [
      `Game-data cache: ${dir}${cacheDisabled() ? " (off: EFSIM_NO_CACHE)" : ""}`,
      `The current inputs' key: ${key} (${cached ? "cached" : "not cached: the next load builds it"})`,
      ...entries.map((e) => `  ${basename(e.file)}  ${(e.bytes / 1e6).toFixed(1)} MB  used ${e.used.toISOString()}`),
    ].join("\n");
  },
});
