# Payoff-guided rule search (2026-11-16)

Task: build a rule search guided by ideal combos (the damage windows, the multipliers that can stack on them, what each missing one costs) that makes directed rule edits and judges them by play; run it on the three example teams. Branch: `worktree-agent-af44ca3170ce8006e`.

## 1. Seed noise decides everything, and nothing in the repo says how many seeds a verdict needs

- **What happened:** my first acceptance bar was 6 screening seeds and 16 confirm seeds, as earlier docs suggested ("judge a list at 10 seeds"). On the old Ink Melt list, the hand-found Twilight hold scored +4.35% on seeds 1–6 but +1.15% ± 1.19 on seeds 1–16, and −0.72% on seeds 7–16. I raised the confirm seeds to 32 and added 64 for borderline gains. That meant rerunning the whole search (about 6 min a run, three times). Then on the current Ink Melt list a `shows` edit scored +1.52% ± 1.42 on seeds 1–32 (missed), but +3.93% ± 0.77 and +2.54% ± 0.86 on two fresh sets of 64 seeds. The Twilight hold itself, documented in the journal and on the team page as +4.1% (10 seeds), measured −0.11% ± 0.71 on 64 fresh seeds. About an hour went into chasing and re-checking verdicts, and a published "gain" turned out to be noise.
- **Cause:** a held ultimate moves every later event, so per-seed differences are heavy-tailed. Their standard error is 0.5–1.2% at 32 seeds, while most structured edits gain 0–2%. The docs give one seed count ("10 seeds") with no power analysis. Numbers on team pages and in the journal are reported on seeds 1–10, which every later check reuses, so a lucky draw on those seeds is never caught.
- **Suggestion:** (a) In docs/design.md "Rule-based rotations", add a short "how many seeds" table: the paired SE per team at 10, 32 and 64 seeds, and the smallest gain each can show. (b) Require any rule-list gain written in docs to be confirmed on fresh seeds (1001… or 2001…), not on seeds 1–k. (c) Give `efsim rules` a `--compare <other.rules.json> --seeds N --first S` option that prints the paired gain ± SE. I had to write a scratch script (`pair.ts`) for this and ran it seven times. (d) Try variance reduction: a control variate from the guided analysis (a run's Stagger uptime or ideal-combo achievement explains much of its DPS spread), or many shorter fights.
- **Why it helps:** it stops agents from publishing noise as findings and from re-running searches at the wrong budget. (c) is about 30 lines in `packages/cli/src/rules.ts`. The risk of (d) is bias, so it needs checking against plain seeds.

## 2. Full energy and zero energy disagree, and the search judged one start only

- **What happened:** both edits that gained beyond noise with full energy lost from zero energy: the owner's team's "Estella's ultimate only while Staggered" (+1.70% / −0.94% ± 0.47) and Ink Melt's `shows` edit (+2.5–3.9% / −3.27% ± 1.26). I found this only after each search ended, with extra 32-seed scratch runs on the `-zero` scenarios. I first changed the Ink Melt example, then reverted it. I added `--also <scenario>` afterwards, so none of the team runs used it.
- **Cause:** each team has two starting scenarios (`examples/<team>.scenario.json` and `-zero`), but nothing ties them together. `efsim rules` and `diagnose` take one scenario, and the search's objective is a single number.
- **Suggestion:** make the zero-energy scenario a known companion: either a scenario field `"companions": ["<team>-zero.scenario.json"]` or a naming convention the CLI checks. Then `efsim rules --guided` and `--search` should judge on both by default (`--also` already does this when passed). The report should show both columns.
- **Why it helps:** edits that only work from one start get caught inside the search, not afterwards by hand. The cost is 30–50% more runs per round.

## 3. Runtimes force long background jobs with no partial results

- **What happened:** one 300 s rules run takes 3.5–5 s (Typhoeus's is the slowest). A guided round is 150–250 runs, so 4–14 min on 3 workers, and a team takes 7–25 min. Four full searches plus their re-runs and checks took about 2.5 h of wall time. The sandbox blocks a foreground `sleep`, so I waited with `Monitor` or `until grep …; do sleep; done` loops on the stderr progress file. Several of those hit the 600 s tool timeout, were moved to the background and expired. The report is written only at the end, so a crash or a wrong setting is found late: the first 16-seed run had to be redone in full.
- **Cause:** the per-frame driver (`playRules` in `packages/engine/src/policy.ts`) reruns the full engine for every seed. Each worker reloads the game data (about 15 s). `runRulesJobs` used to spawn new workers per batch; I added `openRulesPool` to keep them alive. `guided.ts` keeps everything in memory until the end.
- **Suggestion:** (a) Have `guided.ts` append each round's table to the output file as it completes, and write a JSON checkpoint (current list, base DPS per seed, the set of tried edits) so `--resume` can continue a run. (b) Profile `playRules` for 300 s fights. Earlier work found the basic-attack options dominated; the observer's per-frame `cueHolds` over about 40 cues in `guideRules` adds more and could sample only at cast frames. (c) Document in CLAUDE.md or the session docs the pattern for waiting on long runs: background command, then a `Monitor` on the progress file.
- **Why it helps:** fewer full reruns, earlier feedback, less babysitting. A checkpoint is about 50 lines; profiling may speed up every rules-based tool.

## 4. Windows and multipliers had to be reconstructed from raw hits; hits don't know their cast or their buff's giver

- **What happened:** to attribute damage to windows and multipliers I had to: group hits by skill ID with trailing digits stripped (`skillFamily`); find each occurrence's cast by scanning `st.casts` for the latest cast before the first hit; key multipliers from `Modifier.kitBuff`, the literal source `"Staggered"` and regexes over strings like `"Corrosion level 1"` (`multiplierKey`); infer a buff's giver from its owner's latest cast at or before `appliedAt` (an observer over every frame, since `ActiveBuff` has no source cast); and recompute damage zones by hand (`withModifiers`) because `computeDamage`'s zone logic and `buffedAttributeBonus` in `damage.ts` aren't reusable from a landed hit. I couldn't touch `damage.ts` (another agent was working on it), so attribute points and Arts Intensity are approximated as ×1. I also found that Si's recorded burst hits are `fixed` with all zones at 1; they first inflated the losses until I skipped them.
- **Cause:** `LandedHit` (`packages/engine/src/timeline/state.ts`) carries skill, frame and modifiers but no cast index. `ActiveBuff` has no creating cast or skill. Status modifiers are identified only by human-readable `source` strings. The damage formula has no "recompute this hit with a different modifier set" entry point.
- **Suggestion:** (a) Add `cast?: number` (index into `st.casts`) to `LandedHit` and `createdBy?: { operator; skill; cast }` to `ActiveBuff` when a cast creates it. (b) Give status and Stagger modifiers a structured tag, e.g. `Modifier.status?: "corrosion" | "electrification" | "breach" | "stagger"`, instead of parsing `source`. (c) Export from `damage.ts` a pure `recomputeHit(hit: LandedHit, modifiers: Modifier[], panel)` built on the same code as `computeDamage`.
- **Why it helps:** the guided analysis, `policydiag.ts` and payoffs could all drop their heuristics (giver inference, string regexes, a hand copy of the zone formulas that can drift from the real one). The cost is a small amount of memory per hit and buff. (c) must be done by whoever owns the damage formula.

## 5. Worktree sandbox: complex shell commands, heredocs and `git -C` are refused

- **What happened:** several commands were rejected with "this command is too complex to verify that it stays inside the worktree". These included a `cat > file <<'EOF'` heredoc that writes a TypeScript scratch file, a Python heredoc whose text contained `new URL(...)`, a chain of `git show … > file && git show … > file && git log`, and `git -C <main checkout> branch`. Each refusal cost a retry, usually by switching to the Write or Edit tool or splitting the command. Scratch scripts outside the worktree also can't resolve `@efsim/*`, so they need absolute dynamic imports (`await import("/…/packages/engine/src/index.ts")`).
- **Cause:** the sandbox's path check is conservative about heredocs and redirections. The repo has no documented home for scratch analysis scripts that resolves the workspace packages.
- **Suggestion:** in CLAUDE.md "Worktrees and sub-agents", add: write files with the Write or Edit tools, not heredocs; run one `git` command per call; and a scratch-script template (a `tools/scratch-template.ts` showing the absolute-import pattern and `EFSIM_DATA_DIR`).
- **Why it helps:** it saves the 5–10 refused attempts a session spends rediscovering this. No risk.

## 6. The task referenced a cue that wasn't on my branch

- **What happened:** the brief mentioned "the new `stagger` bar cue" in `policy.ts`, but my worktree was at 87cc966 without it. I had to find it on `claude/beautiful-rubin-rpg8vp` (`git branch -a --contains`) and fast-forward before starting.
- **Cause:** worktrees are created from `main`, while the lead's newest work sits on another branch.
- **Suggestion:** create sub-agent worktrees from the branch the lead is on, or name the base commit in the brief.
- **Why it helps:** a few minutes saved, and no risk of building on stale code.

## What worked well

- `playRules`'s observer hook (`PolicyObserver`) let me analyse a run frame by frame without touching the driver. I checked that the guided run gives the identical rotation.
- Common random numbers (`policyDelay` keyed by each rule) made paired comparisons meaningful at all.
- `rulespool.ts`'s job model extended easily (a `guide` flag, then a persistent pool).
- `diagnose.ts`'s `playSettings`, `seedJobs` and `paired` were directly reusable.
- `scripts/premerge.sh` caught nothing but gave confidence in one command.
- The design doc's sections on rules, diagnosis and payoffs were accurate and quick to orient from.

## Outcome (round 1)

1. Seed counts, fresh-seed confirmation, `rules --compare`, variance reduction: **assigned to phase 2.**
2. The zero-energy companion: **assigned to phase 2.**
3. Partial results and checkpoints of guided runs, profiling `playRules`: **assigned to phase 2.** The waiting pattern (background run, Monitor on its progress file): **done** (CLAUDE.md).
4. Hits and buffs that know their cast, a structured status tag, `recomputeHit`: **done** except the tag. `LandedHit.cast`, `ActiveBuff.createdBy` {skill, cast} (left out of the search's state key), `TimelineScenario.keepInputs` and `recomputeHit(data, target, hit, modifiers)` (landing.ts, exported); no number changed (tests/engine-records.test.ts). `Modifier.status`: **backlog** (the log check matches engine and log modifiers by their fields, so a new field needs an audit first).
5. Sandbox: **done** (CLAUDE.md command shapes, `scratch/`, template).
6. Worktrees on a stale base: **done** (CLAUDE.md: the lead names the base commit or branch in the brief).
