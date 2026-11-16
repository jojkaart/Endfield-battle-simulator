# Rule-based rotations, phase 1 (2026-11-16)

Task: design and build rule-based rotations: an opener plus "when cue X is visible, do Y" rules, played by a
simulated player with a reaction delay on the existing timeline. This covered `efsim rules`, a rule search,
hand-written and searched lists for three teams, tests and docs. Branch `worktree-agent-af28ce94876f3b3ea`.

## 1. "Can this action start now?" has two answers in the engine

- **What happened:** the rule driver (packages/engine/src/policy.ts `playRules`) advances the state one frame at a
  time. At each frame it asks `startsNow(ctx, advancedState, action)` and then calls `apply` with `at: frame`. For
  the owner's team, `simulate` replayed the recorded rotation exactly. For Typhoeus's team the replay threw
  `EngineError: frame 1774: … floating_attack1 can't start before the fight ends`. Tracing it took a debug script
  that compared `earliestStart` at every press. It showed that after a dive, `startsNow` on the advanced state
  allowed Typhoeus's battle skill at frame 1280. `earliestStart` from the state right after the previous press,
  with `at: 1280`, said 1328. That state still holds the dive's jump; the advanced one already has the landing
  that replaced it. Every list scored before the fix was slightly wrong. The first round of rule searches (about
  15 min of compute for three teams) had to be thrown away. Seed-1 results moved by up to 7% (one Typhoeus list
  went from 46.8k to 43.5k).
- **Cause:** legality is judged by several functions that are each exact only from a particular kind of state:
  `startFrom` / `gatesFrom`, `earliestStart` (which binary-searches for "the current action ends sooner" when a
  kit has `endAction`/`cast` triggers or a jump is scheduled), and `startsNow` (a fast path of `startFrom`). The
  search only ever calls `earliestStart` from node states, so it never saw the disagreement. Nothing documents
  that "advance the state to the frame, then ask `startsNow`" is not the same as "ask `earliestStart` from an
  earlier state with `at`". No test pins down that the two agree.
- **Suggestion:** add to `timeline/drivers.ts` one exported predicate,
  `canStartAt(ctx, lastApplied, advanced, action, frame)`, that every driver uses. It would be `startsNow` on
  the advanced state plus `earliestStart(lastApplied, {…action, at: frame}).frame === frame`; this is what
  `playRules` does now in its `canPress`. Better still, find out why `earliestStart`'s `same()` check (acting
  frame/skill/skips) misses a dive's landing, and fix it. Add a property test: for random rotations of a few
  example teams, at each frame f, `startsNow(advance(s, f), a)` implies `earliestStart(s, {a, at: f}).frame === f`.
- **Why it helps:** any new driver (rules, interactive play, the planned gear-on-rules work) inherits replay
  consistency instead of rediscovering it on whichever kit triggers it. Fixing `earliestStart` itself could
  change search results, so that change needs a snapshot review.

## 2. The scoring is noisier than the edits the search makes

- **What happened:** the first rule searches (150 lists, 2 seeds, 180 s fights) reported gains of +5–11% for the
  owner's team. Scored again at 10 seeds over 300 s, all of them were within noise: the hand list scored
  55,462, the "best" lists 54,880 and 56,341, with an sd of about 2,900. I ran a second round (200 lists, 3 seeds,
  240 s; about 20 min per team) and then a 10-seed final evaluation of every candidate to tell real gains
  (Ink Melt +28%, Typhoeus +16%) from luck. Robustness rows were confusing too: the bot run (delay 0) often
  scored below the 0.3 s player.
- **Cause:** the timeline is chaotic with respect to timing. A different reaction-delay draw moves Stagger
  windows, combo triggers and ultimates, so a list's sustained DPS has a 2–5% sd between seeds. The search
  scores each list with independent full-fight runs and keeps the max, which selects lucky lists. The
  report shows no standard error, so the noise isn't visible when reading results.
- **Suggestion:** in `packages/engine/src/policysearch.ts`, score with common random numbers: draw each rule's
  delays from a stream keyed by (seed, rule index, onset count), so two lists that differ in one rule share
  every other draw. Report mean ± standard error. Before replacing `best`, re-score the challenger with more
  seeds (racing). In `packages/cli/src/rules.ts`, print the standard error next to each DPS, and score the bot
  over a few jittered-crit or enemy-timing seeds rather than one run.
- **Why it helps:** it saves the second search round and the manual 10-seed re-checks (about 1 h of compute
  here), and stops lists that are pure luck from being reported as gains. The cost is more runs per accepted
  edit, which racing mostly offsets.

## 3. Per-frame driving is slow without caches the engine doesn't provide

- **What happened:** the first `playRules` took 4.8 s for a 300 s fight of the owner's team. For Typhoeus's team
  it took about 40 s, making a 150-list search impossible. Profiling (`node --cpu-prof` plus a hand-written
  `.cpuprofile` summariser) showed two causes. First, judging the controlled operator's basic-attack options at
  every frame was about 65% of the run. Second, for Typhoeus, re-running `earliestStart` on options that had
  errored (aerial attacks while grounded) triggered its "action ends sooner" binary search, which advances the
  state many times. Fixes: cache each option's earliest frame after each press, keep a cheap `skillAvailable`
  pre-check, and re-judge errored options with `startsNow` only. That brought runs to 1–2 s and 3–5 s, plus a
  `judgeEveryFrame` option to check the cache is exact. It took about an hour.
- **Cause:** the stepping API is designed for the search, which judges once per node. It offers no "next frame
  this action could start, valid until the next apply" value. `earliestStart` cost varies by orders of
  magnitude by kit (the `ends` path), and nothing documents that. Errors from `earliestStart` don't say which
  gate failed or from which frame it might pass, so callers can't cache them.
- **Suggestion:** move the basic-attack cache into `timeline/` as `nextStartCache(ctx, stateAfterApply)` with
  the exactness argument in its doc comment. Make `earliestStart` errors structured, e.g.
  `{ error, gate: "available" | "finisher" | "window" | …, notBefore: frame }`, so callers can skip frames safely.
  Note `earliestStart`'s cost profile in its doc comment.
- **Why it helps:** the next frame-stepping driver starts fast. Structured errors also make search debugging
  easier. The risk is low if the shortcut keeps an exact-mode check like `judgeEveryFrame`.

## 4. There's no in-tree scratch place that can import the packages

- **What happened:** scratch scripts had to import `@efsim/data`, `@efsim/engine` and `@efsim/cli`. Placed in the
  session scratchpad (outside the worktree) they couldn't resolve those packages, so I put six `_tmp_*.ts` files
  in the worktree root. `npm run lint` then failed on them (non-null assertions), and `scripts/premerge.sh`
  refuses an unclean tree, so I had to delete them before the final check and lose my debug tools. The sandbox
  separately refused heredocs and compound `cd …; for …` commands in the worktree ("too complex to verify that it
  stays inside the worktree"). JSON and scratch files had to be created with the Write tool one at a time, and
  some edits that would have been one `python3 - <<EOF` became several Edit calls.
- **Cause:** the repo has no scratch directory that is ignored by git and eslint but sits under the workspace
  `node_modules` resolution. CLAUDE.md says not to commit `_tmp_*` scripts but gives no place for them.
- **Suggestion:** add `scratch/` to `.gitignore` and to `eslint.config.js` ignores, with a one-line README (in
  the directory, ignored files aside). Have `scripts/premerge.sh` ignore it when checking for a clean tree, and
  document it in CLAUDE.md "Worktrees and sub-agents". A tiny `scripts/run-ts.sh <file>` that sets
  `EFSIM_DATA_DIR` would also cut repetition.
- **Why it helps:** agents keep their debug scripts through the whole session and stop fighting lint and
  premerge over throwaway files. Gitignored files are never committed by accident.

## 5. Skill buttons aren't a concept in the data or the engine

- **What happened:** a player presses "battle skill", not `chr_0036_jsspsi_normal_skill_1`. To map buttons to
  skills I dumped every team kit's skills with their `available` predicates (scratch script) and read them by
  hand. Several cases only became clear that way: Si's battle skill is three skills chosen by buffs, Arcane's
  ultimate is two, Typhoeus's combo and attacks switch while hovering, Liino's battle button ends her stance,
  Laevatain's battle skill changes in Twilight. `buttonSkills` in policy.ts now resolves "the first non-follow-up
  skill of that kind whose gates pass". That relies on the `available` conditions being mutually exclusive, which
  nothing checks.
- **Cause:** kits list skills by ID with `kind`, `available`, `followUpOnly` and `chainStep`, but there is no
  "button" grouping and no invariant that one press maps to one castable skill.
- **Suggestion:** add a kit-loader check, plus a test in tests/kits.test.ts, that within one operator and kind
  (battle / combo / ultimate, non-follow-up) at most one skill's `available` can hold. Alternatively give kits
  an explicit `button` field. Move `buttonSkills` into `timeline/context.ts` so drivers share it.
- **Why it helps:** rule lists, interactive drivers and reports can talk in buttons without reverse-engineering
  each kit, and an ambiguous mapping fails loudly instead of quietly picking kit order.

## 6. Sustained references take 0.5–1.5 h and the docs don't say so

- **What happened:** to compare rules with a sustained reference I ran `efsim search` on 300 s copies of the
  scenarios (beam 6, `--single --no-macros`). They took 34 min (the owner's team), 36 min (Ink Melt) and 86 min
  (Typhoeus's team) while sharing four cores. `--loop --sync` was out of reach (44 min to 5 h per run per
  design.md). I had to build 300 s scenario copies by hand, rewriting build paths relative to the scratch
  directory, because a scenario's `team` entries are paths relative to the scenario file.
- **Cause:** there's no `--duration` override on `efsim search` or `simulate`, and design.md gives loop run times
  but not fixed-search times per team or length.
- **Suggestion:** add `--duration s` to `efsim search` and `efsim simulate` (the same override `efsim rules`
  has). Add a small table of measured search times (team × length × beam) to design.md "Rotation search".
- **Why it helps:** no hand-edited scenario copies with fragile relative paths, and agents can plan long
  references (or skip them) before starting.

## 7. Engine internals needed by drivers aren't exported

- **What happened:** to list SP and energy costs I imported `skillCosts` by a deep path
  (`./packages/engine/src/timeline/context.ts`). The first attempt used an absolute-looking relative path that
  resolved to `/home/home/…` and failed. `policy.ts` also imports `isStaggered`, `maxEnergy`, `skillSpGain`,
  `spAt`, `kitSkill`, `needsWindow`, `windowKey` and `windowOpen` from `timeline/*` directly, because
  `timeline.ts` doesn't re-export them.
- **Cause:** `packages/engine/src/timeline.ts` re-exports only part of the stepping API, so outside code (the
  CLI, scratch scripts) can't reach costs, windows or SP without deep imports.
- **Suggestion:** re-export the read-only state queries (`skillCosts`, `spAt`, `maxEnergy`, `windowOpen`,
  `windowKey`, `needsWindow`, `isStaggered`, `kitSkill`) from `timeline.ts` as a documented "state queries"
  group.
- **Why it helps:** fewer deep imports and path mistakes. It also defines which queries are safe for drivers to
  read, which a future Rust port has to match anyway.

## What worked well

- **Building on `init` / `advance` / `apply`:** the whole driver needed no change to the damage model, and
  `simulate` replaying the driver's rotation was a strong, cheap correctness check. It is what caught problem 1.
- **Memoised advance and the purity of states:** forking and frame-stepping were safe to cache.
- **`scripts/setup-worktree.sh` and `EFSIM_DATA_DIR`:** worked first time. `premerge.sh` caught the clean-tree
  issue before a merge would have.
- **The team pages and the payoff tables:** they gave good starting rules (Si's Heat battle skill opening
  Arcane's combo, Typhoeus's hover upkeep), so the hand-written lists were close from the first try.
- **Kit labels and notes in the kit JSON** (e.g. Typhoeus's stacks, Liino's stance): they explained mechanics
  without reading SkillData.

## Outcome (round 1)

1. Two answers to "can this start now": **assigned to phase 2.**
2. Scoring noise: **assigned to phase 2.**
3. Per-frame driving caches, structured `earliestStart` errors: **assigned to phase 2.**
4. A scratch place that imports the packages: **done** (git-ignored `scratch/`, ignored by lint, typecheck and premerge; `scripts/scratch-template.ts`; CLAUDE.md).
5. Skill buttons: **assigned to phase 2.**
6. `--duration` on search and simulate: **done** (packages/cli/src/main.ts). A table of measured search times: **backlog** (needs runs of tens of minutes per team).
7. Engine internals exported: **done** (packages/engine/src/timeline.ts re-exports the state queries kitSkill, skillCosts, maxPoise, spAt, maxEnergy, isStaggered, skillSpGain, windowKey, windowOpen, needsWindow; policy.ts's deep imports are phase 2's to switch).
