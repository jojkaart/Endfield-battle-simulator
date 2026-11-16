# Rule driver phase 2 (2026-11-16)

Task: phase 2 of the architecture review (button model, one start check,
event-driven rule stepping, rule-run checks, visible states in kits,
assumption switches) and the rule-noise points (seed/power table,
`efsim rules --compare`, zero-energy companion, one pool per command);
then refreshing the rule numbers and re-tuning Ink Melt's list. Branch
`worktree-agent-acd9fa18155546323`.

## 1. There's no way to run an earlier commit's code next to the current one

- **What happened:**
  - The brief asked for the example lists' results before and after,
    and later I had to attribute a +5% change to one of four fixes.
  - Both needed the old code running beside the new. I extracted HEAD
    with `git archive` into the scratchpad. I gave it a hand-made
    `node_modules` (one symlink per entry of the main checkout's, plus
    `@efsim/*` to the copy) and passed `EFSIM_DATA_DIR`, since the
    worktree's own `data/` is empty.
  - For the attribution I needed a second copy with one fix applied.
  - About 30 minutes went into the setup and a failed first start (no
    data).
- **Cause:** the setup script links one checkout's packages, and nothing
  materialises another commit's packages with their dependencies and the
  data.
- **Suggestion:** a `scripts/at-commit.ts <ref> <dir>` that:
  - writes `packages/`, `schemas/` and `examples/` of `<ref>` into
    `<dir>` (under `scratch/`);
  - links `node_modules` and `@efsim/*`;
  - prints the `EFSIM_DATA_DIR` to use.

  It can also apply a patch on top (`--patch file`) for "the old code
  with only this fix".
- **Why it helps:** before/after measurements and attributing behaviour
  changes come up in every engine change that moves results. With this
  they take one command, and nobody ends up comparing different trees by
  mistake.

## 2. A scratch script hard-coded 60 frames a second, and a 15-minute baseline was thrown away

- **What happened:** my baseline script built fights as
  `durationFrames: 300 * 60`. The engine runs at 30 frames a second, so
  every "300 s" run was 600 s. I found out only from a test file's
  `seconds * 30`, after a 32-seed × 6-scenario baseline had finished,
  and I had to run it again (15 minutes under load).
- **Cause:**
  - Scratch scripts build `TimelineScenario`s by hand.
  - The CLI's `--duration` applies seconds, but no engine helper takes a
    fight length in seconds.
  - `FPS` is exported, but nothing makes a script use it.
- **Suggestion:**
  - Add `withSeconds(scenario, s)` to the engine (or to `@efsim/cli`
    beside `readScenario`) and use it in tests and the CLI.
  - Add one line to CLAUDE.md's scratch section: "fight lengths go
    through FPS (30) or `withSeconds`, never a literal".
- **Why it helps:** the error is silent (the numbers look plausible) and
  costs a whole measurement round. The fix is small.

## 3. SP depended on how a state was advanced, so two exact driver modes disagreed

- **What happened:**
  - The event-stepping driver had to match its frame-by-frame reference
    exactly.
  - They disagreed until I found the cause: every `advance` rebases
    `state.sp` with `spAt`. Adding 4/15 SP frame by frame gives
    99.99999999999997 where advancing once gives 100, so an SP-gated
    press started a frame apart.
  - The fix was to snap regenerated SP to its grid in `spAt`. That moved
    two example snapshots (SP ties).
  - Finding it took about an hour of first-differing-press scripts.
- **Cause:** `TimelineState` stores SP as a value at `state.frame`, and
  every advance rewrites both. So a state's SP depends on the advance
  path, not only on the events.
- **Suggestion:** store an SP anchor (`sp` and the frame it was measured
  at) that only grants, spends and the cap change, and have `advance`
  leave it alone. `spAt` already computes from a base. Then states
  reached by different advance paths are equal by construction, and the
  snap can go.
- **Why it helps:** any future shortcut (event stepping, memoised
  advance from the nearest cached frame, a Rust port) needs advance to be
  path-independent. Today a shortcut checks equality against the frame
  loop and finds float noise.

## 4. CPU-heavy measurements from several agents overlap, and nothing coordinates them

- **What happened:**
  - During my measurements the load was 8–12 on 4 cores: another
    agent's test suite, my baselines and the power table all at once.
  - Runs took 2–3× longer. Speed comparisons had to be repeated at a
    quiet moment.
  - One full `npm test` hit the 60 s timeout on a property test that
    takes 15 s alone.
- **Cause:** premerge's vitest steps take a lock shared by the
  worktrees, but measurement scripts and long CLI runs (`gear --rules`,
  `--guided`, seed tables) don't.
- **Suggestion:**
  - Expose premerge's lock as a small helper:
    `node scripts/heavy-lock.ts -- <command>` queues behind the test
    lock and other heavy jobs.
  - Document it in CLAUDE.md for long measurements, and make the rule
    tooling print the load average beside its timings.
- **Why it helps:** timings become comparable, and tests stop timing out
  because someone is benchmarking. Cost: a little waiting in the queue.

## 5. A background job started with `&` can't be stopped

- **What happened:**
  - I started baselines and the seed table as `(node script.ts … &)`.
  - When the antithetic half of the seed table turned out not to be
    needed, I couldn't stop it: `pkill` is forbidden (rightly) and
    TaskStop doesn't know such processes.
  - It ran for about 15 more minutes on two cores, under everything
    else.
- **Cause:** jobs detached with `&` are invisible to the harness. Only
  `run_in_background` commands are tracked.
- **Suggestion:** CLAUDE.md "Worktrees and sub-agents": start every long
  job with the Bash tool's `run_in_background`, never with `&` or
  `nohup`, so TaskStop can end it. Mention `scratch/`.
- **Why it helps:** wasted CPU on a shared machine hurts every agent.
  No cost.

## 6. Diagnosing the stale-SP discrepancy needed instrumenting the engine by hand

- **What happened:**
  - To find why startsNow and earliestStart disagreed I added debug code
    to policy.ts (a `globalThis` array) and a `globalThis` switch in
    timing.ts for the old behaviour, ran scratch scripts, then removed
    both.
  - Reverting them with `git checkout` was refused, rightly: it would
    have dropped real edits in the same files.
  - The first instrumented version called earliestStart at every frame
    and ran out of memory (2 GB) on Typhoeus's list.
- **Cause:** the driver has an observer for frames but none for its
  start checks, and the engine has no switch for comparing an old
  behaviour.
- **Suggestion:** a `PolicyObserver.press?(…)` / `.check?(action, frame,
  result)` hook. Optionally, a test-only `TimelineOptions.legacy` set of
  named switches for behaviour comparisons that a test pins and a later
  commit removes.
- **Why it helps:** the next "why do these two disagree" investigation
  needs no engine edits to revert.

## What worked well

- `playRules`'s `judgeEveryFrame` pattern (an exact reference mode beside
  a shortcut) made event stepping safe to build. The same pattern with
  `stepping: "frames"` caught three missed wake-up classes in minutes.
- Common random numbers and `paired` from diagnose.ts made every
  before/after and attribution measurement a few lines.
- `scripts/snapshots.sh` regenerated the snapshots deterministically,
  and its accuracy comparison showed at once that no log verdict moved.
- The round-1 façade (`timeline.ts` state queries), `statLabel` and
  `codeProvenance` were drop-in replacements.
- `scripts/premerge.ts`'s step table and re-run of timeouts made the
  final check readable under load.
