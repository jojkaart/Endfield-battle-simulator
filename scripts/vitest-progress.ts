// A vitest reporter that prints one line per finished test file, at once: `[12/83] pass tests/x.test.ts 4.2 s (load
// 2.1)`. When its output isn't a terminal, vitest's own reporters show little until the end, so a background run
// (premerge, scripts/snapshots.sh, a long `npx vitest run > scratch/x.txt`) looked stalled for minutes; with this, a
// file that waits shows as one. Use it beside the default reporter, which still prints the failures and the summary:
//
//   npx vitest run --reporter=default --reporter=./scripts/vitest-progress.ts > scratch/x.txt
//
// premerge and snapshots.sh add it themselves when their output isn't a terminal.

import { loadavg } from "node:os";
import type { Reporter, TestModule, TestSpecification } from "vitest/node";

export default class ProgressReporter implements Reporter {
  private total = 0;
  private done = 0;
  private readonly start = performance.now();

  onTestRunStart(specifications: readonly TestSpecification[]): void {
    this.total = specifications.length;
    this.done = 0;
  }

  onTestModuleEnd(module: TestModule): void {
    this.done++;
    const d = module.diagnostic();
    const seconds = (d.duration + d.collectDuration + d.setupDuration + d.prepareDuration) / 1000;
    const state = module.state();
    const verdict = state === "passed" ? "pass" : state === "failed" ? "FAIL" : state;
    const elapsed = ((performance.now() - this.start) / 1000).toFixed(0);
    process.stdout.write(`[${this.done}/${this.total || "?"}] ${verdict} ${module.relativeModuleId} ${seconds.toFixed(1)} s (at ${elapsed} s, load ${loadavg()[0]?.toFixed(1)})\n`);
  }
}
