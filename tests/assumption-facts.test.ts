// Each assumption kind's fact (packages/logs/src/assumptions.ts ASSUMPTION_FACTS, round 15: low-plain-low-mismatch
// report point 2): the docs' table is the code's, and where the replay decides a fact the check offers an alternative
// only with the replay's reason for not deciding it this time (a crit only where the replay read none), so the next
// "assumed, but the replay knew" fails here rather than as an operator's low plain share.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { ASSUMPTION_FACTS, assumptionFactsTable, devFixtures, hitRecords, type AssumptionKind } from "@efsim/logs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("each assumption kind's fact (ASSUMPTION_FACTS)", () => {
  it("is docs/design/data.md's table", () => {
    const doc = readFileSync(join(ROOT, "docs/design/data.md"), "utf8");
    expect(doc.includes(assumptionFactsTable()), `docs/design/data.md "Each assumption kind's fact": replace its table with assumptionFactsTable()'s:\n${assumptionFactsTable()}`).toBe(true);
  });

  it("offers an alternative of a fact the replay decides only with the replay's reason (0c14: Rossi, Alesh, Si, the Endministrator)", () => {
    const data = loadGameData();
    const [d] = devFixtures({ ids: ["0c14"] });
    const records = hitRecords(data, (d as NonNullable<typeof d>).fx);
    const seen = new Map<AssumptionKind, number>();
    for (const r of records) {
      for (const a of r.assumptions ?? []) {
        seen.set(a.kind, (seen.get(a.kind) ?? 0) + 1);
        const row = ASSUMPTION_FACTS[a.kind];
        // The log-listing fallback's readings (logcheck.ts candidates) try both crits whatever the replay read: a fallback
        // stays one either way (ASSUMPTION_FACTS crit, a candidate).
        if (a.kind === "crit" && r.class !== "fallback") expect(r.critSource, `${r.t} ${r.event}: a crit assumed where the replay read one`).toBe("none");
        else if (row.undecided) expect(a.label, `${r.t} ${r.event}: a ${a.kind} alternative without the replay's reason`).toMatch(row.undecided);
      }
    }
    // The log has assumed matches of several kinds, or the test checks nothing.
    expect(seen.size).toBeGreaterThan(3);
  });
});
