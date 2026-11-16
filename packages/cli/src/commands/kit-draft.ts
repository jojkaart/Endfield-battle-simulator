// efsim kit-draft: a kit drafted from SkillData.

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { command } from "../command.ts";
import { kitDraft } from "../kitdraft.ts";
import { readLogFixture } from "@efsim/logs";
import { ROOT } from "./shared.ts";

export default command({
  name: "kit-draft",
  usage: `  efsim kit-draft <operator>              Draft a kit from SkillData (to verify against logs)
`,
  options: {},
  run: (ctx) => {
    ctx.need(1);
    const op = ctx.args[0] as string;
    const logged = new Map<string, number>();
    for (const f of readdirSync(join(ROOT, "fixtures")).filter((x) => x.startsWith("zmdlogs-"))) {
      for (const h of readLogFixture(join(ROOT, "fixtures", f)).hits) if (h.operator === op) logged.set(h.event, (logged.get(h.event) ?? 0) + 1);
    }
    return kitDraft(ctx.data(), op, logged);
  },
});
